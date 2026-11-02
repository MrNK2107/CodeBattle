import Bull from 'bull';

/*
 * Match clocks (ready timeout, match deadline, "still judging, try again").
 *
 * With Redis they are Bull delayed jobs, so a deadline set by one server
 * process fires even if that process restarts or another instance picks it up.
 * Without Redis (REDIS_URL=memory) they are plain in-process timers.
 *
 * Jobs may fire late, twice or after they stopped mattering (a deadline that
 * was moved earlier, a match that already ended); the handler re-checks the
 * match in the database, so every job is safe to run at any time.
 */

export type MatchTimerKind = 'ready' | 'deadline';

export interface MatchTimerJob {
  kind: MatchTimerKind;
  matchId: string;
  /** epoch ms when the job should run */
  at: number;
  /** set on "still judging" retries: when the deadline first fired */
  forcedAt?: number;
}

export type MatchTimerHandler = (job: MatchTimerJob) => Promise<void>;

export interface MatchTimerScheduler {
  readonly name: string;
  schedule(job: MatchTimerJob): Promise<void>;
  /** best effort: stale jobs are harmless, this only avoids pointless wake-ups */
  cancel(matchId: string): Promise<void>;
  start(handler: MatchTimerHandler): void;
  close(): Promise<void>;
}

/** Deterministic, so re-scheduling the same deadline after a restart doesn't add a second job. */
export function timerJobId(job: MatchTimerJob): string {
  return `${job.kind}-${job.matchId}-${job.at}${job.forcedAt !== undefined ? `-retry` : ''}`;
}

// ---------------------------------------------------------------- in-process

export class InProcessMatchTimers implements MatchTimerScheduler {
  readonly name = 'in-process';
  private handler: MatchTimerHandler | null = null;
  private readonly timers = new Map<string, Map<MatchTimerKind, NodeJS.Timeout>>();
  private readonly early: MatchTimerJob[] = [];

  async schedule(job: MatchTimerJob): Promise<void> {
    const forMatch = this.timers.get(job.matchId) ?? new Map<MatchTimerKind, NodeJS.Timeout>();
    this.timers.set(job.matchId, forMatch);
    const existing = forMatch.get(job.kind);
    if (existing) clearTimeout(existing);
    // setTimeout overflows above ~24.8 days; matches are far shorter
    const timer = setTimeout(() => {
      forMatch.delete(job.kind);
      if (forMatch.size === 0) this.timers.delete(job.matchId);
      this.fire(job);
    }, Math.max(job.at - Date.now(), 0));
    timer.unref?.();
    forMatch.set(job.kind, timer);
  }

  async cancel(matchId: string): Promise<void> {
    for (const timer of this.timers.get(matchId)?.values() ?? []) clearTimeout(timer);
    this.timers.delete(matchId);
  }

  start(handler: MatchTimerHandler): void {
    this.handler = handler;
    for (const job of this.early.splice(0)) this.fire(job);
  }

  async close(): Promise<void> {
    for (const id of [...this.timers.keys()]) await this.cancel(id);
  }

  private fire(job: MatchTimerJob): void {
    if (!this.handler) {
      this.early.push(job);
      return;
    }
    this.handler(job).catch(err => console.error(`[match ${job.matchId}] ${job.kind} timer failed`, err));
  }
}

// ---------------------------------------------------------------- bull

/** The slice of a Bull queue the scheduler uses (lets tests substitute a fake). */
export interface DelayedJobQueue {
  add(data: MatchTimerJob, options: Bull.JobOptions): Promise<unknown>;
  process(handler: (job: { data: MatchTimerJob }) => Promise<void>): Promise<void>;
  getJob(id: string): Promise<{ remove(): Promise<void> } | null>;
  close(): Promise<void>;
}

export class BullMatchTimers implements MatchTimerScheduler {
  readonly name = 'bull';
  /** job ids added by this process, so cancel can remove them */
  private readonly known = new Map<string, Set<string>>();

  constructor(private readonly queue: DelayedJobQueue) {}

  async schedule(job: MatchTimerJob): Promise<void> {
    const jobId = timerJobId(job);
    await this.queue.add(job, {
      jobId,
      delay: Math.max(job.at - Date.now(), 0),
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 500,
    });
    const ids = this.known.get(job.matchId) ?? new Set<string>();
    ids.add(jobId);
    this.known.set(job.matchId, ids);
  }

  async cancel(matchId: string): Promise<void> {
    const ids = this.known.get(matchId);
    this.known.delete(matchId);
    for (const id of ids ?? []) {
      // a job that is running right now can't be removed; it will find the match closed
      await this.queue
        .getJob(id)
        .then(job => job?.remove())
        .catch(() => undefined);
    }
  }

  start(handler: MatchTimerHandler): void {
    void this.queue.process(job => handler(job.data)).catch(err => console.error('[match timers] worker stopped', err));
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

export function createMatchTimers(useMemory: boolean, redisUrl: string = process.env.REDIS_URL ?? 'redis://localhost:6379'): MatchTimerScheduler {
  if (useMemory) return new InProcessMatchTimers();
  return new BullMatchTimers(new Bull<MatchTimerJob>('match-timers', redisUrl) as unknown as DelayedJobQueue);
}
