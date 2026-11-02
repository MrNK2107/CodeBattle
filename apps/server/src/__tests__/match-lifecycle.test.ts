import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchTimerJob, MatchTimerScheduler } from '../queues/matchTimers';
import type { BattleNamespace } from '../types';

/*
 * The match service (services/match.ts) against an in-memory stand-in for the
 * few Prisma calls it makes. Covers the lifecycle transitions, the forced
 * finalize at the deadline, sudden death and the "applies exactly once" races.
 */

type Status = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
interface MatchRow {
  id: string;
  status: Status;
  mode: 'RANKED' | 'CASUAL';
  createdAt: Date;
  startedAt: Date | null;
  endsAt: Date | null;
  endedAt: Date | null;
  endReason: string | null;
  winnerId: string | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}
interface PlayerRow {
  id: string;
  matchId: string;
  userId: string;
  isReady: boolean;
  finalScore?: number;
  ratingBefore?: number;
  ratingAfter?: number;
  replay?: unknown;
}
interface UserRow {
  id: string;
  rating: number;
  totalMatches: number;
  wins: number;
  losses: number;
}
interface SubmissionRow {
  matchId: string;
  userId: string;
  status: 'PENDING' | 'ACCEPTED' | 'WRONG_ANSWER';
  code: string;
  language: string;
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  qualityScore: number | null;
  submittedAt: Date;
}

const db = {
  matches: new Map<string, MatchRow>(),
  players: [] as PlayerRow[],
  users: new Map<string, UserRow>(),
  submissions: [] as SubmissionRow[],
};

const matches = (where: { id: string; status?: Status }) => {
  const m = db.matches.get(where.id);
  return m && (where.status === undefined || m.status === where.status) ? m : undefined;
};

const fakePrisma = {
  match: {
    async findUnique({ where }: { where: { id: string } }) {
      const m = db.matches.get(where.id);
      if (!m) return null;
      return {
        ...m,
        question: { difficulty: m.difficulty },
        players: db.players.filter(p => p.matchId === m.id).map(p => ({ ...p, user: { ...db.users.get(p.userId)! } })),
        submissions: db.submissions.filter(s => s.matchId === m.id).map(s => ({ ...s })),
      };
    },
    async updateMany({ where, data }: { where: { id: string; status?: Status }; data: Partial<MatchRow> }) {
      const m = matches(where);
      if (!m) return { count: 0 };
      Object.assign(m, data);
      return { count: 1 };
    },
  },
  matchPlayer: {
    async update({ where, data }: { where: { id?: string; matchId_userId?: { matchId: string; userId: string } }; data: Partial<PlayerRow> }) {
      const p = db.players.find(row =>
        where.id ? row.id === where.id : row.matchId === where.matchId_userId!.matchId && row.userId === where.matchId_userId!.userId
      );
      if (!p) throw new Error('player not found');
      Object.assign(p, data);
      return p;
    },
  },
  typingProfile: { upsert: async () => ({}) },
  user: {
    async update({ where, data }: { where: { id: string }; data: Record<string, { increment: number }> }) {
      const u = db.users.get(where.id)!;
      for (const [key, value] of Object.entries(data)) (u as unknown as Record<string, number>)[key] += value.increment;
      return u;
    },
  },
  async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn(fakePrisma);
  },
};

vi.mock('../prisma', () => ({ prisma: fakePrisma }));

const match = await import('../services/match');

const scheduled: MatchTimerJob[] = [];
const cancelled: string[] = [];
const scheduler: MatchTimerScheduler = {
  name: 'recording',
  schedule: async job => void scheduled.push(job),
  cancel: async id => void cancelled.push(id),
  start: () => undefined,
  close: async () => undefined,
};

const emitted: Array<{ room: string; event: string; payload: any }> = [];
const namespace = { to: (room: string) => ({ emit: (event: string, payload: unknown) => void emitted.push({ room, event, payload }) }) } as unknown as BattleNamespace;
// the players' room; spectators get their own copy in watch:<matchId>
const events = (name: string) => emitted.filter(e => e.event === name && !e.room.startsWith('watch:'));
const watched = (name: string) => emitted.filter(e => e.event === name && e.room.startsWith('watch:'));

const MIN = 60_000;

function seed(status: Status, options: { mode?: 'RANKED' | 'CASUAL'; startedMinutesAgo?: number; endsInMinutes?: number } = {}) {
  db.matches.clear();
  db.players.length = 0;
  db.users.clear();
  db.submissions.length = 0;
  const now = Date.now();
  const startedAt = status === 'WAITING' ? null : new Date(now - (options.startedMinutesAgo ?? 5) * MIN);
  db.matches.set('m1', {
    id: 'm1',
    status,
    mode: options.mode ?? 'RANKED',
    createdAt: new Date(now - 6 * MIN),
    startedAt,
    endsAt: startedAt ? new Date(now + (options.endsInMinutes ?? 10) * MIN) : null,
    endedAt: null,
    endReason: null,
    winnerId: null,
    difficulty: 'EASY',
  });
  for (const id of ['alice', 'bob']) {
    db.users.set(id, { id, rating: 1200, totalMatches: 0, wins: 0, losses: 0 });
    db.players.push({ id: `p-${id}`, matchId: 'm1', userId: id, isReady: status !== 'WAITING' });
  }
}

function submit(userId: string, status: SubmissionRow['status'], minutesIn = 2, passed = 3) {
  const startedAt = db.matches.get('m1')!.startedAt!;
  db.submissions.push({
    matchId: 'm1',
    userId,
    status,
    code: 'class Solution {}',
    language: 'cpp',
    passedTests: status === 'PENDING' ? 0 : passed,
    totalTests: 3,
    runtimeMs: status === 'PENDING' ? null : 1,
    qualityScore: 100,
    submittedAt: new Date(startedAt.getTime() + minutesIn * MIN),
  });
}

beforeEach(() => {
  match.setMatchTimers(scheduler);
  scheduled.length = 0;
  cancelled.length = 0;
  emitted.length = 0;
});

describe('match start and cancel', () => {
  it('starts once every player is ready and arms the deadline', async () => {
    seed('WAITING');
    db.players[0].isReady = true;
    await match.startMatchIfReady('m1', namespace);
    expect(db.matches.get('m1')!.status).toBe('WAITING');

    db.players[1].isReady = true;
    await Promise.all([match.startMatchIfReady('m1', namespace), match.startMatchIfReady('m1', namespace)]);
    const m = db.matches.get('m1')!;
    expect(m.status).toBe('ACTIVE');
    expect(m.endsAt!.getTime() - m.startedAt!.getTime()).toBe(15 * MIN); // EASY
    expect(events('match:started')).toHaveLength(1);
    expect(watched('match:started')).toEqual([{ ...events('match:started')[0], room: `watch:${events('match:started')[0].room}` }]);
    expect(scheduled).toEqual([{ kind: 'deadline', matchId: 'm1', at: m.endsAt!.getTime() }]);
  });

  it('a ready timeout abandons a waiting match, but not a started one', async () => {
    seed('WAITING');
    await match.handleMatchTimer({ kind: 'ready', matchId: 'm1', at: Date.now() }, namespace);
    expect(db.matches.get('m1')).toMatchObject({ status: 'ABANDONED', endReason: 'not-ready' });
    expect(events('match:cancelled')[0].payload).toEqual({ matchId: 'm1', reason: 'not-ready' });
    expect(cancelled).toEqual(['m1']);

    seed('ACTIVE');
    await match.handleMatchTimer({ kind: 'ready', matchId: 'm1', at: Date.now() }, namespace);
    expect(db.matches.get('m1')!.status).toBe('ACTIVE');
  });
});

describe('finalize', () => {
  it('waits for both players, then scores, rates and announces once', async () => {
    seed('ACTIVE');
    submit('alice', 'ACCEPTED', 2);
    await match.finalizeMatchIfReady('m1', namespace);
    expect(db.matches.get('m1')!.status).toBe('ACTIVE');

    submit('bob', 'WRONG_ANSWER', 4, 1);
    await Promise.all([match.finalizeMatchIfReady('m1', namespace), match.finalizeMatchIfReady('m1', namespace)]);
    expect(db.matches.get('m1')).toMatchObject({ status: 'COMPLETED', winnerId: 'alice', endReason: 'completed' });
    expect(events('match:ended')).toHaveLength(1);
    expect(watched('match:ended')).toHaveLength(1);
    const alice = db.users.get('alice')!;
    const bob = db.users.get('bob')!;
    expect(alice.rating).toBeGreaterThan(1200);
    expect(alice.rating - 1200).toBe(1200 - bob.rating);
    expect([alice.wins, alice.losses, bob.wins, bob.losses, alice.totalMatches]).toEqual([1, 0, 0, 1, 1]);
    const alicePlayer = db.players.find(p => p.userId === 'alice')!;
    expect(alicePlayer).toMatchObject({ ratingBefore: 1200, ratingAfter: alice.rating });
    expect(alicePlayer.finalScore).toBeGreaterThan(db.players.find(p => p.userId === 'bob')!.finalScore!);
    // the submitted code is the last replay frame
    expect((alicePlayer.replay as Array<{ submitted?: boolean }>).at(-1)).toMatchObject({ submitted: true, language: 'cpp' });
    expect(cancelled).toContain('m1');
  });

  it('casual matches score but leave ratings alone', async () => {
    seed('ACTIVE', { mode: 'CASUAL' });
    submit('alice', 'ACCEPTED');
    submit('bob', 'ACCEPTED', 3);
    await match.finalizeMatchIfReady('m1', namespace);
    expect(db.matches.get('m1')!.status).toBe('COMPLETED');
    expect(db.users.get('alice')).toMatchObject({ rating: 1200, totalMatches: 0 });
  });

  it('at the deadline a player without a submission scores 0 and loses', async () => {
    seed('ACTIVE', { startedMinutesAgo: 15, endsInMinutes: 0 });
    submit('alice', 'WRONG_ANSWER', 3, 1);
    await match.handleMatchTimer({ kind: 'deadline', matchId: 'm1', at: Date.now() }, namespace);
    expect(db.matches.get('m1')).toMatchObject({ status: 'COMPLETED', winnerId: 'alice', endReason: 'timeout' });
    expect(db.players.find(p => p.userId === 'bob')!.finalScore).toBe(0);
    expect(events('match:ended')[0].payload.reason).toBe('timeout');
  });

  it('a stale deadline job (deadline still ahead) is a no-op', async () => {
    seed('ACTIVE', { endsInMinutes: 5 });
    await match.handleMatchTimer({ kind: 'deadline', matchId: 'm1', at: Date.now() }, namespace);
    expect(db.matches.get('m1')!.status).toBe('ACTIVE');
  });

  it('at the deadline a submission still being judged is waited for, up to a minute', async () => {
    seed('ACTIVE', { startedMinutesAgo: 15, endsInMinutes: 0 });
    submit('alice', 'ACCEPTED');
    submit('bob', 'PENDING');
    const firedAt = Date.now();
    await match.handleMatchTimer({ kind: 'deadline', matchId: 'm1', at: firedAt }, namespace);
    expect(db.matches.get('m1')!.status).toBe('ACTIVE');
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({ kind: 'deadline', matchId: 'm1' });
    expect(scheduled[0].forcedAt).toBeGreaterThanOrEqual(firedAt);
    expect(scheduled[0].at).toBeGreaterThan(Date.now());

    // still judging a minute after the deadline: finalize anyway, the pending submission counts as none
    await match.handleMatchTimer({ kind: 'deadline', matchId: 'm1', at: Date.now(), forcedAt: Date.now() - 61_000 }, namespace);
    expect(db.matches.get('m1')).toMatchObject({ status: 'COMPLETED', winnerId: 'alice' });
    expect(db.players.find(p => p.userId === 'bob')!.finalScore).toBe(0);
  });
});

describe('sudden death', () => {
  it('a full solve cuts the opponent\'s clock to SUDDEN_DEATH_SECONDS', async () => {
    seed('ACTIVE', { endsInMinutes: 30 });
    submit('alice', 'ACCEPTED');
    const before = Date.now();
    await match.handleJudgedSubmission('m1', 'alice', true, namespace);
    const endsAt = db.matches.get('m1')!.endsAt!.getTime();
    expect(endsAt).toBeGreaterThanOrEqual(before + 5 * MIN);
    expect(endsAt).toBeLessThanOrEqual(Date.now() + 5 * MIN);
    expect(events('match:deadline')[0].payload).toMatchObject({ reason: 'opponent-solved' });
    expect(scheduled.at(-1)).toEqual({ kind: 'deadline', matchId: 'm1', at: endsAt });
    expect(db.matches.get('m1')!.status).toBe('ACTIVE'); // bob still playing
  });

  it('never extends a clock that is already shorter', async () => {
    seed('ACTIVE', { endsInMinutes: 2 });
    const endsAt = db.matches.get('m1')!.endsAt!.getTime();
    submit('alice', 'ACCEPTED');
    await match.handleJudgedSubmission('m1', 'alice', true, namespace);
    expect(db.matches.get('m1')!.endsAt!.getTime()).toBe(endsAt);
    expect(events('match:deadline')).toHaveLength(0);
  });

  it('does not apply when the opponent already submitted; the match just ends', async () => {
    seed('ACTIVE', { endsInMinutes: 30 });
    submit('bob', 'WRONG_ANSWER', 1, 0);
    submit('alice', 'ACCEPTED');
    await match.handleJudgedSubmission('m1', 'alice', true, namespace);
    expect(events('match:deadline')).toHaveLength(0);
    expect(db.matches.get('m1')).toMatchObject({ status: 'COMPLETED', winnerId: 'alice' });
  });
});

describe('forfeit', () => {
  it('the forfeiting player loses and is rated once', async () => {
    seed('ACTIVE');
    const results = await Promise.all([match.forfeitMatch('m1', 'bob', namespace), match.forfeitMatch('m1', 'bob', namespace)]);
    expect(results.sort()).toEqual(['forfeited', 'over']);
    expect(db.matches.get('m1')).toMatchObject({ status: 'COMPLETED', winnerId: 'alice', endReason: 'forfeit' });
    expect(db.users.get('bob')).toMatchObject({ losses: 1, totalMatches: 1 });
    expect(db.users.get('bob')!.rating).toBeLessThan(1200);
    expect(events('match:ended')).toHaveLength(1);
    expect(events('opponent:status')[0].payload).toEqual({ matchId: 'm1', status: 'forfeited' });
  });

  it('a casual forfeit leaves ratings alone but still reports both players', async () => {
    seed('ACTIVE', { mode: 'CASUAL' });
    expect(await match.forfeitMatch('m1', 'bob', namespace)).toBe('forfeited');
    expect(db.users.get('bob')).toMatchObject({ rating: 1200, totalMatches: 0 });
    const ended = events('match:ended')[0].payload;
    expect(ended.winnerId).toBe('alice');
    expect(ended.scores.map((s: { userId: string }) => s.userId).sort()).toEqual(['alice', 'bob']);
    expect(ended.scores[0].ratingAfter).toBeUndefined();
  });

  it('before the start it cancels instead, and after the end it does nothing', async () => {
    seed('WAITING');
    expect(await match.forfeitMatch('m1', 'bob', namespace)).toBe('cancelled');
    expect(db.matches.get('m1')!.status).toBe('ABANDONED');
    expect(db.users.get('bob')!.rating).toBe(1200);
    expect(await match.forfeitMatch('m1', 'bob', namespace)).toBe('over');
  });

  it('a forfeit racing the final judgement applies only one of them', async () => {
    seed('ACTIVE');
    submit('alice', 'ACCEPTED');
    submit('bob', 'ACCEPTED', 3);
    await Promise.all([match.finalizeMatchIfReady('m1', namespace), match.forfeitMatch('m1', 'alice', namespace)]);
    expect(events('match:ended')).toHaveLength(1);
    const total = [...db.users.values()].reduce((n, u) => n + u.totalMatches, 0);
    expect(total).toBe(2);
  });
});
