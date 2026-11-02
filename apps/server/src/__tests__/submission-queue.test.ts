import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CodeRunner, ExecutionResult } from '../services/runners';
import type { BattleNamespace } from '../types';

/*
 * Judging a battle submission end to end (queues/submission.ts) with a scripted
 * runner and an in-memory stand-in for Prisma: what is stored, who is told what,
 * and what happens when the judge itself is down.
 */

interface SubmissionRow {
  id: string;
  matchId: string;
  userId: string;
  language: string;
  code: string;
  status: string;
  passedTests?: number;
  message?: string | null;
}

const db = {
  submissions: new Map<string, SubmissionRow>(),
  matchStatus: 'ACTIVE',
};

const fakePrisma = {
  question: {
    async findUnique() {
      return {
        id: 'q1',
        slug: 'double',
        title: 'Double',
        difficulty: 'EASY',
        isActive: true,
        signature: { functionName: 'double', params: [{ name: 'n', type: 'int' }], returns: 'int' },
        testCases: [
          { input: '[1]', expected: '2', isHidden: true, label: null },
          { input: '[2]', expected: '4', isHidden: true, label: null },
        ],
      };
    },
  },
  submission: {
    async findUnique({ where }: { where: { id: string } }) {
      const s = db.submissions.get(where.id);
      return s ? { ...s, match: { questionId: 'q1', status: db.matchStatus } } : null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<SubmissionRow> }) {
      const s = db.submissions.get(where.id)!;
      Object.assign(s, data);
      return s;
    },
    async delete({ where }: { where: { id: string } }) {
      db.submissions.delete(where.id);
    },
  },
};

vi.mock('../prisma', () => ({ prisma: fakePrisma }));
const handleJudgedSubmission = vi.fn(async () => undefined);
vi.mock('../services/match', () => ({ handleJudgedSubmission }));

const { processSubmission, submissionQueue } = await import('../queues/submission');
const { setRunner } = await import('../services/runners');
const { liveStateOf, forgetLiveState } = await import('../socket/spectate');

const emitted: Array<{ room: string; except?: string; event: string; payload: any }> = [];
const namespace = {
  to: (room: string) => ({
    emit: (event: string, payload: unknown) => void emitted.push({ room, event, payload }),
    except: (except: string) => ({ emit: (event: string, payload: unknown) => void emitted.push({ room, except, event, payload }) }),
  }),
} as unknown as BattleNamespace;

/** A runner that answers each test with `answers[i]` (undefined: no line), or fails outright. */
function scriptedRunner(answers: Array<number | undefined>, result: Partial<ExecutionResult> = {}): CodeRunner & { calls: number } {
  const runner = {
    name: 'scripted',
    calls: 0,
    async execute(request: { stdin: string }) {
      runner.calls++;
      const { nonce } = JSON.parse(request.stdin) as { nonce: string };
      const stdout = answers
        .map((value, i) => (value === undefined ? '' : `${nonce}${JSON.stringify({ i, ok: true, value, ms: 0.1, stdout: '' })}`))
        .join('\n');
      return { status: 'ok' as const, stdout, stderr: '', wallMs: 3, ...result };
    },
  };
  return runner;
}

function pending(id = 's1', userId = 'alice') {
  db.submissions.set(id, { id, matchId: 'm1', userId, language: 'cpp', code: 'class Solution {};', status: 'PENDING' });
}

beforeEach(() => {
  db.submissions.clear();
  db.matchStatus = 'ACTIVE';
  emitted.length = 0;
  handleJudgedSubmission.mockClear();
});

describe('processSubmission', () => {
  it('stores the verdict and moves the match on', async () => {
    pending();
    setRunner(scriptedRunner([2, 4]));
    await processSubmission(namespace, { submissionId: 's1' });
    expect(db.submissions.get('s1')).toMatchObject({ status: 'ACCEPTED', passedTests: 2 });
    expect(handleJudgedSubmission).toHaveBeenCalledWith('m1', 'alice', true, namespace);
  });

  it('a result for a match that already ended does not re-create spectator live state', async () => {
    forgetLiveState('m1');
    db.matchStatus = 'COMPLETED';
    pending();
    setRunner(scriptedRunner([2, 4]));
    await processSubmission(namespace, { submissionId: 's1' });
    expect(liveStateOf('m1', 'alice')).toBeUndefined();
  });

  it('a result for an active match is remembered for late spectators', async () => {
    forgetLiveState('m1');
    pending();
    setRunner(scriptedRunner([2, 4]));
    await processSubmission(namespace, { submissionId: 's1' });
    expect(liveStateOf('m1', 'alice')).toMatchObject({ status: 'submitted' });
    forgetLiveState('m1');
  });

  it('shows the failing hidden test only to the player who submitted', async () => {
    pending();
    setRunner(scriptedRunner([2, 5]));
    await processSubmission(namespace, { submissionId: 's1' });
    const mine = emitted.find(e => e.room === 'user:alice')!;
    const theirs = emitted.find(e => e.room === 'm1')!;
    expect(mine.payload).toMatchObject({ status: 'WRONG_ANSWER', passedTests: 1, totalTests: 2 });
    expect(mine.payload.failedTest).toMatchObject({ index: 1 });
    expect(theirs.except).toBe('user:alice');
    expect(theirs.payload).not.toHaveProperty('failedTest');
    expect(theirs.payload).not.toHaveProperty('message');
    expect(handleJudgedSubmission).toHaveBeenCalledWith('m1', 'alice', false, namespace);
  });

  it('a crash reaches the player with its explanation', async () => {
    pending();
    setRunner(scriptedRunner([2, undefined], { status: 'runtime_error', stderr: 'Segmentation fault (SIGSEGV): stack overflow' }));
    await processSubmission(namespace, { submissionId: 's1' });
    expect(db.submissions.get('s1')!.status).toBe('RUNTIME_ERROR');
    expect(emitted.find(e => e.room === 'user:alice')!.payload.failedTest).toMatchObject({ index: 1 });
  });

  it('skips submissions that were already judged', async () => {
    pending();
    db.submissions.get('s1')!.status = 'ACCEPTED';
    const runner = scriptedRunner([2, 4]);
    setRunner(runner);
    await processSubmission(namespace, { submissionId: 's1' });
    expect(runner.calls).toBe(0);
    expect(emitted).toHaveLength(0);
  });
});

describe('judge outages', () => {
  it('retry three times, then withdraw the submission and ask the player to resubmit', async () => {
    pending();
    const down = scriptedRunner([], { status: 'internal_error', stderr: 'Judge0 request failed: 503' });
    setRunner(down);
    submissionQueue.start(namespace);
    await submissionQueue.add({ submissionId: 's1' });
    await vi.waitFor(() => expect(db.submissions.has('s1')).toBe(false), { timeout: 8000, interval: 50 });
    expect(down.calls).toBe(3);
    expect(emitted).toEqual([expect.objectContaining({ room: 'user:alice', event: 'error', payload: expect.objectContaining({ code: 'JUDGE_UNAVAILABLE' }) })]);
    expect(handleJudgedSubmission).not.toHaveBeenCalled();
  }, 15_000);

  it('after the battle ended, the record is kept but marked as not judged', async () => {
    pending('s2');
    db.matchStatus = 'COMPLETED';
    setRunner(scriptedRunner([], { status: 'internal_error', stderr: 'down' }));
    submissionQueue.start(namespace);
    await submissionQueue.add({ submissionId: 's2' });
    await vi.waitFor(() => expect(db.submissions.get('s2')!.status).toBe('RUNTIME_ERROR'), { timeout: 8000, interval: 50 });
    expect(db.submissions.get('s2')!.message).toBe('Judging failed after the battle ended.');
    expect(emitted.filter(e => e.event === 'error')).toHaveLength(0);
  }, 15_000);
});
