import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleNamespace } from '../types';

/*
 * Adversarial clients against the battle socket handlers (socket/battle.ts):
 * events for a match the user isn't in, events after the deadline, and a
 * flood of submissions. Prisma, the queue, the judge and the match service
 * are in-memory stand-ins; the handlers themselves are the real ones.
 */

interface MatchRow {
  id: string;
  status: string;
  questionId: string;
  createdAt: Date;
  startedAt: Date | null;
  endsAt: Date | null;
  players: { userId: string }[];
}
interface SubmissionRow {
  id: string;
  matchId: string;
  userId: string;
  status: string;
  passedTests: number;
  totalTests: number;
  runtimeMs: number | null;
  message: string | null;
}

const db = { match: null as MatchRow | null, submissions: [] as SubmissionRow[], reads: 0 };
const tick = () => new Promise(resolve => setImmediate(resolve));

const fakePrisma = {
  match: {
    async findUnique({ where }: { where: { id: string } }) {
      db.reads++;
      await tick();
      const m = db.match;
      if (!m || m.id !== where.id) return null;
      return { ...m, submissions: db.submissions.filter(s => s.matchId === m.id) };
    },
  },
  matchPlayer: {
    async findUnique({ where }: { where: { matchId_userId: { matchId: string; userId: string } } }) {
      db.reads++;
      await tick();
      const { matchId, userId } = where.matchId_userId;
      const m = db.match;
      if (!m || m.id !== matchId || !m.players.some(p => p.userId === userId)) return null;
      return { matchId, userId, match: { status: m.status } };
    },
    async update() {
      return {};
    },
  },
  submission: {
    async create({ data }: { data: { matchId: string; userId: string; totalTests: number } }) {
      await tick();
      if (db.submissions.some(s => s.matchId === data.matchId && s.userId === data.userId)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      const row: SubmissionRow = { id: `s${db.submissions.length + 1}`, status: 'PENDING', passedTests: 0, runtimeMs: null, message: null, ...data };
      db.submissions.push(row);
      return row;
    },
  },
};

const queued: { submissionId: string }[] = [];
const judgeCalls: unknown[] = [];
const typingCalls: unknown[] = [];

vi.mock('../prisma', () => ({ prisma: fakePrisma }));
vi.mock('../queues/submission', () => ({ submissionQueue: { add: async (job: { submissionId: string }) => void queued.push(job) } }));
vi.mock('../services/judge', () => ({
  judge: async (...args: unknown[]) => {
    judgeCalls.push(args);
    return { verdict: 'ACCEPTED', passed: 1, total: 1, outcomes: [] };
  },
}));
vi.mock('../services/questions', () => ({
  loadQuestion: async () => ({ signature: { functionName: 'f', params: [], returns: 'int' }, visible: [], hidden: [{}, {}] }),
  toDisplayResults: () => [],
}));
vi.mock('../services/match', () => ({
  forfeitMatch: vi.fn(async () => 'ended'),
  readyDeadline: (d: Date) => new Date(d.getTime() + 60_000),
  startMatchIfReady: vi.fn(async () => undefined),
}));
vi.mock('../services/typing', () => ({
  recordTypingBatch: async (...args: unknown[]) => void typingCalls.push(args),
  recordSnapshot: async (...args: unknown[]) => void typingCalls.push(args),
}));

const { registerBattleHandlers } = await import('../socket/battle');
const { forfeitMatch } = await import('../services/match');
const { forgetMatch } = await import('../socket/context');
const { EventRateLimiter, DEFAULT_EVENT_LIMITS } = await import('../socket/rateLimit');
type Limiter = InstanceType<typeof EventRateLimiter>;
const unlimited = () => new EventRateLimiter({ ...DEFAULT_EVENT_LIMITS, enabled: false });

type Emitted = { event: string; payload: any; room?: string };

function connect(userId: string, limiter: Limiter = unlimited(), socketId = 'sock-' + userId) {
  const handlers = new Map<string, (p: unknown) => void>();
  const emitted: Emitted[] = [];
  const rooms = new Set<string>([socketId]);
  let disconnected = false;
  const toRoom = (room: string) => ({ emit: (event: string, payload: unknown) => void emitted.push({ event, payload, room }) });
  const socket = {
    id: socketId,
    data: { userId },
    rooms,
    on: (event: string, fn: (p: unknown) => void) => void handlers.set(event, fn),
    emit: (event: string, payload: unknown) => void emitted.push({ event, payload }),
    to: toRoom,
    join: async (room: string) => void rooms.add(room),
    nsp: { to: toRoom, adapter: { rooms: new Map() } },
    disconnect: () => {
      disconnected = true;
      handlers.get('disconnect')?.(undefined);
    },
  };
  let onConnection: (s: unknown) => void = () => {};
  registerBattleHandlers({ on: (_: string, cb: (s: unknown) => void) => (onConnection = cb) } as unknown as BattleNamespace, limiter);
  onConnection(socket);
  return {
    rooms,
    emitted,
    disconnected: () => disconnected,
    send: (event: string, payload: unknown) => handlers.get(event)!(payload),
    errors: () => emitted.filter(e => e.event === 'error' && !e.room).map(e => e.payload.code),
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await tick();
}

const code = { code: 'int f() { return 1; }', language: 'cpp' };

beforeEach(() => {
  const now = Date.now();
  db.match = {
    id: 'm1',
    status: 'ACTIVE',
    questionId: 'q1',
    createdAt: new Date(now - 120_000),
    startedAt: new Date(now - 60_000),
    endsAt: new Date(now + 600_000),
    players: [{ userId: 'alice' }, { userId: 'bob' }],
  };
  db.submissions = [];
  db.reads = 0;
  queued.length = 0;
  judgeCalls.length = 0;
  typingCalls.length = 0;
  vi.mocked(forfeitMatch).mockClear();
  forgetMatch('m1');
});

describe('a client that is not in the match', () => {
  it('cannot submit, run, ready up or forfeit, and never joins the match room', async () => {
    const eve = connect('eve');
    eve.send('battle:submit', { matchId: 'm1', ...code });
    eve.send('battle:run', { matchId: 'm1', ...code });
    eve.send('battle:ready', { matchId: 'm1' });
    eve.send('battle:forfeit', { matchId: 'm1' });
    await settle();
    expect(eve.errors()).toEqual(['NOT_FOUND', 'NOT_FOUND', 'NOT_FOUND', 'NOT_FOUND']);
    expect(eve.rooms.has('m1')).toBe(false);
    expect(eve.emitted.filter(e => e.room === 'm1')).toEqual([]);
    expect(db.submissions).toEqual([]);
    expect(queued).toEqual([]);
    expect(judgeCalls).toEqual([]);
    expect(forfeitMatch).not.toHaveBeenCalled();
  });

  it('cannot inject typing telemetry or snapshots into the match', async () => {
    const eve = connect('eve');
    eve.send('battle:typing', { matchId: 'm1', events: [{ t: 1, k: 'char' }], pastedChars: 0 });
    eve.send('battle:snapshot', { matchId: 'm1', ...code });
    await settle();
    expect(typingCalls).toEqual([]);
    expect(eve.emitted).toEqual([]);
  });
});

describe('events after the deadline (match still ACTIVE until the deadline job runs)', () => {
  beforeEach(() => {
    db.match!.endsAt = new Date(Date.now() - 1_000);
  });

  it('rejects a submission', async () => {
    const alice = connect('alice');
    alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    expect(alice.errors()).toEqual(['MATCH_NOT_ACTIVE']);
    expect(db.submissions).toEqual([]);
    expect(queued).toEqual([]);
  });

  it('rejects a run (no judge work, no progress sent to the opponent)', async () => {
    const alice = connect('alice');
    alice.send('battle:run', { matchId: 'm1', ...code });
    await settle();
    expect(alice.errors()).toEqual(['MATCH_NOT_ACTIVE']);
    expect(judgeCalls).toEqual([]);
    expect(alice.emitted.filter(e => e.room === 'm1')).toEqual([]);
  });
});

describe('a flood of submissions', () => {
  it('stores and queues exactly one; every other attempt is ALREADY_SUBMITTED', async () => {
    const alice = connect('alice');
    for (let i = 0; i < 25; i++) alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    expect(db.submissions).toHaveLength(1);
    expect(queued).toEqual([{ submissionId: db.submissions[0].id }]);
    const errors = alice.errors();
    expect(errors).toHaveLength(24);
    expect(new Set(errors)).toEqual(new Set(['ALREADY_SUBMITTED']));
    expect(alice.emitted.filter(e => e.event === 'opponent:status' && e.payload.status === 'submitted')).toHaveLength(1);
  });

  it('a later submission after the first is final', async () => {
    const alice = connect('alice');
    alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    alice.send('battle:submit', { matchId: 'm1', code: 'int f() { return 2; }', language: 'cpp' });
    await settle();
    expect(db.submissions).toHaveLength(1);
    expect(alice.errors()).toEqual(['ALREADY_SUBMITTED']);
  });
});

describe('per-socket event rate limiting', () => {
  const tight = (maxViolations = DEFAULT_EVENT_LIMITS.maxViolations) =>
    new EventRateLimiter({
      ...DEFAULT_EVENT_LIMITS,
      maxViolations,
      socket: { telemetry: { burst: 3, perSec: 1 }, action: { burst: 2, perSec: 0.5 }, control: { burst: 2, perSec: 1 } },
      user: { telemetry: { burst: 5, perSec: 2 }, action: { burst: 3, perSec: 1 }, control: { burst: 3, perSec: 2 } },
    });

  it('rejects excess runs with RATE_LIMITED and no DB read or judge work', async () => {
    const alice = connect('alice', tight());
    for (let i = 0; i < 10; i++) alice.send('battle:run', { matchId: 'm1', ...code });
    await settle();
    const errors = alice.errors();
    expect(errors.filter(c => c === 'RATE_LIMITED').length).toBeGreaterThanOrEqual(1);
    // two runs got through the bucket: exactly two match reads
    expect(db.reads).toBe(2);
    expect(judgeCalls.length).toBeLessThanOrEqual(2);
  });

  it('rejected submits never reach the DB', async () => {
    const alice = connect('alice', tight());
    for (let i = 0; i < 10; i++) alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    expect(db.reads).toBe(2);
    expect(db.submissions).toHaveLength(1);
    expect(alice.errors()).toContain('RATE_LIMITED');
  });

  it('rejected telemetry is dropped before the participant lookup', async () => {
    const alice = connect('alice', tight());
    for (let i = 0; i < 10; i++) alice.send('battle:typing', { matchId: 'm1', events: [{ t: i, k: 'char' }], pastedChars: 0 });
    await settle();
    expect(typingCalls).toHaveLength(3);
    expect(alice.errors()).toContain('RATE_LIMITED');
  });

  it('telemetry and run/submit have separate buckets', async () => {
    const alice = connect('alice', tight());
    for (let i = 0; i < 3; i++) alice.send('battle:typing', { matchId: 'm1', events: [{ t: i, k: 'char' }], pastedChars: 0 });
    alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    expect(alice.errors()).toEqual([]);
    expect(db.submissions).toHaveLength(1);
  });

  it('a second tab shares the per-user budget', async () => {
    const limiter = tight();
    const tab1 = connect('alice', limiter, 'tab1');
    const tab2 = connect('alice', limiter, 'tab2');
    tab1.send('battle:run', { matchId: 'm1', ...code });
    tab1.send('battle:run', { matchId: 'm1', ...code });
    tab2.send('battle:run', { matchId: 'm1', ...code });
    tab2.send('battle:run', { matchId: 'm1', ...code });
    await settle();
    expect(db.reads).toBe(3);
    expect(tab2.errors()).toContain('RATE_LIMITED');
  });

  it('the RATE_LIMITED notice itself is throttled (no error flood back to the client)', async () => {
    const alice = connect('alice', tight(1000));
    for (let i = 0; i < 50; i++) alice.send('battle:typing', { matchId: 'm1', events: [{ t: i, k: 'char' }], pastedChars: 0 });
    await settle();
    expect(alice.errors().filter(c => c === 'RATE_LIMITED')).toHaveLength(1);
  });

  it('disconnects a socket that keeps exceeding the limit', async () => {
    const limiter = new EventRateLimiter({ ...DEFAULT_EVENT_LIMITS, socket: { ...DEFAULT_EVENT_LIMITS.socket, telemetry: { burst: 2, perSec: 1 } }, maxViolations: 5 });
    const alice = connect('alice', limiter);
    for (let i = 0; i < 6; i++) alice.send('battle:typing', { matchId: 'm1', events: [{ t: i, k: 'char' }], pastedChars: 0 });
    expect(alice.disconnected()).toBe(false);
    alice.send('battle:typing', { matchId: 'm1', events: [{ t: 9, k: 'char' }], pastedChars: 0 });
    await settle();
    expect(alice.disconnected()).toBe(true);
    // one throttled notice for the flood, one for the disconnect
    expect(alice.errors()).toEqual(['RATE_LIMITED', 'RATE_LIMITED']);
    expect(alice.emitted.filter(e => e.event === 'error').at(-1)!.payload.message).toMatch(/disconnected/i);
    expect(typingCalls).toHaveLength(2);
  });

  it('a reconnect after being cut off starts with a clean violation count', async () => {
    const limiter = new EventRateLimiter({ ...DEFAULT_EVENT_LIMITS, maxViolations: 2 });
    const first = connect('alice', limiter, 'tab1');
    for (let i = 0; i < 8; i++) first.send('battle:run', { matchId: 'm1', ...code });
    expect(first.disconnected()).toBe(true);
    const second = connect('alice', limiter, 'tab2');
    second.send('battle:ready', { matchId: 'm1' });
    await settle();
    expect(second.disconnected()).toBe(false);
    expect(second.errors()).toEqual([]);
  });

  it('normal play is not affected by the default limits', async () => {
    const alice = connect('alice', new EventRateLimiter(DEFAULT_EVENT_LIMITS));
    alice.send('battle:ready', { matchId: 'm1' });
    for (let i = 0; i < 5; i++) alice.send('battle:typing', { matchId: 'm1', events: [{ t: i, k: 'char' }], pastedChars: 0 });
    alice.send('battle:snapshot', { matchId: 'm1', ...code });
    alice.send('battle:run', { matchId: 'm1', ...code });
    await settle();
    alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    expect(alice.errors()).toEqual([]);
    expect(db.submissions).toHaveLength(1);
  });
});

describe('spectators', () => {
  it('get the example count of a run and the submit, never code or run output', async () => {
    const alice = connect('alice');
    alice.send('battle:run', { matchId: 'm1', ...code });
    await settle();
    alice.send('battle:submit', { matchId: 'm1', ...code });
    await settle();
    const watched = alice.emitted.filter(e => e.room === 'watch:m1');
    expect(watched.map(e => e.event)).toEqual(['spectate:update', 'spectate:update', 'spectate:update']);
    expect(watched.map(e => e.payload)).toMatchObject([
      { matchId: 'm1', userId: 'alice', status: 'running' },
      { matchId: 'm1', userId: 'alice', status: 'typing', passed: 1, total: 1 },
      { matchId: 'm1', userId: 'alice', status: 'submitted', verdict: 'PENDING', hiddenTotal: 2 },
    ]);
    expect(JSON.stringify(watched)).not.toContain(code.code);
    expect(alice.emitted.some(e => e.room === 'watch:m1' && (e.event === 'run:result' || e.event === 'submission:result'))).toBe(false);
  });

  it('typing from an outsider never reaches spectators', async () => {
    const eve = connect('eve');
    eve.send('battle:typing', { matchId: 'm1', events: [{ t: 1, k: 'char' }], pastedChars: 0 });
    await settle();
    expect(eve.emitted.filter(e => e.room === 'watch:m1')).toEqual([]);
  });

  it('battle:spectate is rate limited as a control event', async () => {
    const strict = new EventRateLimiter({ ...DEFAULT_EVENT_LIMITS, socket: { ...DEFAULT_EVENT_LIMITS.socket, control: { burst: 1, perSec: 0.001 } } });
    const watcher = connect('watcher', strict);
    watcher.send('battle:spectate', { matchId: 'other' });
    watcher.send('battle:spectate', { matchId: 'other' });
    await settle();
    expect(watcher.errors()).toEqual(['RATE_LIMITED', 'NOT_FOUND']);
  });
});
