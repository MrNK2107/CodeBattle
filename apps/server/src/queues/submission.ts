import Bull from 'bull';
import { isLanguage, type SubmissionResult } from '@codebattle/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { useMemoryRedis } from '../redis';
import type { BattleNamespace } from '../types';
import { judge } from '../services/judge';
import { handleJudgedSubmission } from '../services/match';
import { loadQuestion, toDisplayResults } from '../services/questions';
import { tellSpectators } from '../socket/spectate';

export interface SubmissionJobData {
  submissionId: string;
}

/** Minimal queue contract used by the socket handlers. */
export interface SubmissionQueue {
  add(data: SubmissionJobData): Promise<unknown>;
  start(namespace: BattleNamespace): void;
  close(): Promise<void>;
}

const userRoom = (userId: string) => `user:${userId}`;

/** Judges one submission against the hidden tests and publishes the outcome. */
export async function processSubmission(namespace: BattleNamespace, data: SubmissionJobData): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: data.submissionId },
    include: { match: { select: { questionId: true } } },
  });
  if (!submission || submission.status !== 'PENDING') return;
  const question = await loadQuestion({ id: submission.match.questionId });
  if (!question || !isLanguage(submission.language)) throw new Error(`cannot judge submission ${submission.id}`);

  const result = await judge(question.signature, submission.language, submission.code, question.hidden);
  const firstFail = result.outcomes.findIndex(o => o.status !== 'passed');

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: result.verdict,
      passedTests: result.passed,
      totalTests: result.total,
      runtimeMs: result.runtimeMs,
      memoryKb: result.memoryKb ?? null,
      message: result.message ?? null,
      results: result.outcomes.map(o => ({ status: o.status, ms: o.ms ?? null })) as Prisma.InputJsonArray,
    },
  });

  const summary: SubmissionResult = {
    matchId: submission.matchId,
    userId: submission.userId,
    status: result.verdict,
    passedTests: result.passed,
    totalTests: result.total,
    runtimeMs: result.runtimeMs,
    memoryKb: result.memoryKb,
  };
  // details (message, failing hidden test) go only to the player who submitted
  namespace.to(userRoom(submission.userId)).emit('submission:result', {
    ...summary,
    message: result.message,
    failedTest: firstFail === -1 ? undefined : toDisplayResults(question.signature, question.hidden, result.outcomes)[firstFail],
  });
  namespace.to(submission.matchId).except(userRoom(submission.userId)).emit('submission:result', summary);
  tellSpectators(namespace, submission.matchId, submission.userId, {
    status: 'submitted',
    verdict: result.verdict,
    hiddenPassed: result.passed,
    hiddenTotal: result.total,
  });

  await handleJudgedSubmission(submission.matchId, submission.userId, result.verdict === 'ACCEPTED', namespace);
}

/**
 * When judging itself breaks (runner down), the submission is withdrawn so the
 * player can submit again instead of being scored on our failure.
 */
async function withdrawSubmission(namespace: BattleNamespace, data: SubmissionJobData, error: Error): Promise<void> {
  console.error(`[submission ${data.submissionId}] judging failed`, error);
  const submission = await prisma.submission.findUnique({ where: { id: data.submissionId }, include: { match: { select: { status: true } } } });
  if (!submission || submission.status !== 'PENDING') return;
  if (submission.match.status !== 'ACTIVE') {
    // the match was already scored without it; keep the record but don't pretend it was judged
    await prisma.submission.update({ where: { id: submission.id }, data: { status: 'RUNTIME_ERROR', message: 'Judging failed after the battle ended.' } });
    return;
  }
  await prisma.submission.delete({ where: { id: submission.id } });
  namespace.to(userRoom(submission.userId)).emit('error', {
    code: 'JUDGE_UNAVAILABLE',
    message: 'The judge is unavailable right now, so your submission was not counted. Please submit again.',
  });
}

class BullSubmissionQueue implements SubmissionQueue {
  private readonly queue: Bull.Queue<SubmissionJobData>;

  constructor(redisUrl: string) {
    this.queue = new Bull<SubmissionJobData>('submission-queue', redisUrl, {
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 },
    });
  }

  add(data: SubmissionJobData): Promise<unknown> {
    return this.queue.add(data, { jobId: data.submissionId });
  }

  start(namespace: BattleNamespace): void {
    const concurrency = Number(process.env.JUDGE_CONCURRENCY ?? 4);
    void this.queue.process(concurrency, job => processSubmission(namespace, job.data));
    this.queue.on('failed', (job, err) => {
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) void withdrawSubmission(namespace, job.data, err).catch(console.error);
    });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

/** In-process queue used when REDIS_URL=memory (no Redis available). */
class InMemorySubmissionQueue implements SubmissionQueue {
  private namespace: BattleNamespace | null = null;
  private running = 0;
  private readonly waiting: SubmissionJobData[] = [];
  private readonly concurrency = Number(process.env.JUDGE_CONCURRENCY ?? 2);

  async add(data: SubmissionJobData): Promise<void> {
    this.waiting.push(data);
    this.pump();
  }

  start(namespace: BattleNamespace): void {
    this.namespace = namespace;
    this.pump();
  }

  async close(): Promise<void> {
    this.waiting.length = 0;
  }

  private pump(): void {
    const namespace = this.namespace;
    if (!namespace) return;
    while (this.running < this.concurrency && this.waiting.length) {
      const job = this.waiting.shift()!;
      this.running++;
      void this.run(namespace, job).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private async run(namespace: BattleNamespace, data: SubmissionJobData): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await processSubmission(namespace, data);
        return;
      } catch (error) {
        if (attempt >= 3) {
          await withdrawSubmission(namespace, data, error as Error).catch(console.error);
          return;
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

export const submissionQueue: SubmissionQueue = useMemoryRedis
  ? new InMemorySubmissionQueue()
  : new BullSubmissionQueue(process.env.REDIS_URL ?? 'redis://localhost:6379');

export function startSubmissionWorker(namespace: BattleNamespace): void {
  submissionQueue.start(namespace);
}

/** Re-queues submissions left PENDING by a restart. */
export async function requeuePendingSubmissions(): Promise<void> {
  const pending = await prisma.submission.findMany({ where: { status: 'PENDING', match: { status: 'ACTIVE' } }, select: { id: true } });
  for (const s of pending) await submissionQueue.add({ submissionId: s.id });
  if (pending.length) console.log(`[submission] re-queued ${pending.length} pending submission(s)`);
}
