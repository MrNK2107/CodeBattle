import Bull from 'bull';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BullMatchTimers,
  InProcessMatchTimers,
  timerJobId,
  type DelayedJobQueue,
  type MatchTimerJob,
} from '../queues/matchTimers';
import { deadlineReached } from '../services/matchLogic';

/**
 * Stands in for Redis + Bull: jobs live in a store that outlives any one
 * queue object, so closing a queue and opening another on the same store is a
 * server restart. Delayed jobs are deduplicated by id, like Bull.
 */
class FakeStore {
  readonly jobs = new Map<string, { data: MatchTimerJob; runAt: number }>();
}

class FakeQueue implements DelayedJobQueue {
  private poll: NodeJS.Timeout | null = null;
  constructor(private readonly store: FakeStore) {}

  async add(data: MatchTimerJob, options: Bull.JobOptions): Promise<unknown> {
    const id = String(options.jobId);
    if (!this.store.jobs.has(id)) this.store.jobs.set(id, { data, runAt: Date.now() + (options.delay ?? 0) });
    return { id };
  }

  async process(handler: (job: { data: MatchTimerJob }) => Promise<void>): Promise<void> {
    this.poll = setInterval(() => {
      for (const [id, job] of this.store.jobs) {
        if (job.runAt > Date.now()) continue;
        this.store.jobs.delete(id);
        void handler({ data: job.data });
      }
    }, 5);
  }

  async getJob(id: string) {
    const store = this.store;
    return store.jobs.has(id) ? { remove: async () => void store.jobs.delete(id) } : null;
  }

  async close(): Promise<void> {
    if (this.poll) clearInterval(this.poll);
  }
}

const waitFor = async (check: () => boolean, ms = 2000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await new Promise(r => setTimeout(r, 5));
  }
};

describe('deadlineReached', () => {
  it('ignores jobs for a deadline that is still ahead', () => {
    const now = 1_000_000;
    expect(deadlineReached(new Date(now - 1), now)).toBe(true);
    expect(deadlineReached(new Date(now + 500), now)).toBe(true); // within clock-skew tolerance
    expect(deadlineReached(new Date(now + 60_000), now)).toBe(false);
    expect(deadlineReached(null, now)).toBe(true);
  });
});

describe('timerJobId', () => {
  it('is stable for the same deadline and distinct for retries and other deadlines', () => {
    const job: MatchTimerJob = { kind: 'deadline', matchId: 'm1', at: 123 };
    expect(timerJobId(job)).toBe(timerJobId({ ...job }));
    expect(timerJobId(job)).not.toBe(timerJobId({ ...job, at: 124 }));
    expect(timerJobId(job)).not.toBe(timerJobId({ ...job, forcedAt: 100 }));
    expect(timerJobId(job)).not.toBe(timerJobId({ ...job, kind: 'ready' }));
  });
});

describe('InProcessMatchTimers', () => {
  afterEach(() => vi.useRealTimers());

  it('fires at the scheduled time, replaces a timer of the same kind and honours cancel', async () => {
    vi.useFakeTimers();
    const timers = new InProcessMatchTimers();
    const fired: MatchTimerJob[] = [];
    timers.start(async job => void fired.push(job));
    const now = Date.now();

    await timers.schedule({ kind: 'deadline', matchId: 'a', at: now + 1000 });
    await timers.schedule({ kind: 'deadline', matchId: 'a', at: now + 500 }); // moved earlier
    await timers.schedule({ kind: 'ready', matchId: 'b', at: now + 200 });
    await timers.schedule({ kind: 'deadline', matchId: 'c', at: now + 300 });
    await timers.cancel('c');

    await vi.advanceTimersByTimeAsync(2000);
    expect(fired.map(j => `${j.kind}:${j.matchId}:${j.at - now}`)).toEqual(['ready:b:200', 'deadline:a:500']);
  });

  it('delivers timers that fired before the handler was attached', async () => {
    vi.useFakeTimers();
    const timers = new InProcessMatchTimers();
    await timers.schedule({ kind: 'ready', matchId: 'x', at: Date.now() });
    await vi.advanceTimersByTimeAsync(10);
    const fired: string[] = [];
    timers.start(async job => void fired.push(job.matchId));
    expect(fired).toEqual(['x']);
  });
});

describe('BullMatchTimers', () => {
  it('a deadline scheduled before a restart fires in the restarted process', async () => {
    const store = new FakeStore();
    const before = new BullMatchTimers(new FakeQueue(store));
    before.start(async () => {
      throw new Error('the old process must not run it');
    });
    const at = Date.now() + 80;
    await before.schedule({ kind: 'deadline', matchId: 'm1', at });
    await before.close(); // server goes down before the deadline

    const after = new BullMatchTimers(new FakeQueue(store));
    // the restart re-arms timers from the database: same id, so no duplicate job
    await after.schedule({ kind: 'deadline', matchId: 'm1', at });
    expect(store.jobs.size).toBe(1);

    const fired: MatchTimerJob[] = [];
    after.start(async job => void fired.push(job));
    await waitFor(() => fired.length === 1);
    expect(fired[0]).toEqual({ kind: 'deadline', matchId: 'm1', at });
    expect(Date.now()).toBeGreaterThanOrEqual(at);
    await after.close();
  });

  it('cancel removes the jobs it scheduled', async () => {
    const store = new FakeStore();
    const timers = new BullMatchTimers(new FakeQueue(store));
    await timers.schedule({ kind: 'ready', matchId: 'm2', at: Date.now() + 60_000 });
    await timers.schedule({ kind: 'deadline', matchId: 'm2', at: Date.now() + 120_000 });
    await timers.schedule({ kind: 'deadline', matchId: 'other', at: Date.now() + 120_000 });
    await timers.cancel('m2');
    expect([...store.jobs.values()].map(j => j.data.matchId)).toEqual(['other']);
    await timers.close();
  });
});

// Against a real Redis when one is provided, e.g. REDIS_TEST_URL=redis://localhost:6379
const redisUrl = process.env.REDIS_TEST_URL;

describe.skipIf(!redisUrl)('BullMatchTimers on Redis', () => {
  it('a delayed job survives the queue that created it being closed', async () => {
    const name = `match-timers-test-${process.pid}-${Date.now()}`;
    const first = new Bull<MatchTimerJob>(name, redisUrl!);
    const at = Date.now() + 500;
    await new BullMatchTimers(first as unknown as DelayedJobQueue).schedule({ kind: 'deadline', matchId: 'r1', at });
    await first.close();

    const second = new Bull<MatchTimerJob>(name, redisUrl!);
    const fired: MatchTimerJob[] = [];
    new BullMatchTimers(second as unknown as DelayedJobQueue).start(async job => void fired.push(job));
    await waitFor(() => fired.length === 1, 10_000);
    expect(fired[0].matchId).toBe('r1');
    await second.obliterate({ force: true });
    await second.close();
  }, 20_000);
});
