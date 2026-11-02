import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleNamespace } from '../types';

/* Spectator mode (socket/spectate.ts) against an in-memory match. */

const db = {
  match: null as null | {
    id: string;
    status: string;
    mode: string;
    startedAt: Date | null;
    endsAt: Date | null;
    question: { title: string; slug: string; difficulty: string };
    players: { userId: string; ratingBefore: number | null; user: { id: string; username: string; rating: number } }[];
    submissions: { userId: string; status: string; passedTests: number; totalTests: number }[];
  },
};

vi.mock('../prisma', () => ({
  prisma: {
    match: {
      findUnique: async ({ where }: { where: { id: string } }) => (db.match && db.match.id === where.id ? structuredClone(db.match) : null),
    },
  },
}));
vi.mock('../socket/context', async () => {
  const { z } = await import('zod');
  return {
    isOnline: (userId: string) => userId === 'alice',
    parsePayload: (socket: { emit: (e: string, p: unknown) => void }, schema: z.ZodTypeAny, payload: unknown) => {
      const r = schema.safeParse(payload);
      if (!r.success) socket.emit('error', { code: 'BAD_REQUEST', message: 'bad' });
      return r.success ? r.data : null;
    },
  };
});

const { handleSpectate, tellSpectators, broadcastToMatch, liveStateOf, forgetLiveState, spectatorRoom } = await import('../socket/spectate');

type Emitted = { event: string; payload: any; room?: string };

function spectator(watchers = 1) {
  const emitted: Emitted[] = [];
  const rooms = new Set<string>();
  const socket = {
    emit: (event: string, payload: unknown) => void emitted.push({ event, payload }),
    join: async (room: string) => void rooms.add(room),
    nsp: { adapter: { rooms: new Map([[spectatorRoom('m1'), { size: watchers }]]) } },
  };
  return { socket: socket as never, emitted, rooms };
}

function roomSink() {
  const emitted: Emitted[] = [];
  return { emitted, nsp: { to: (room: string) => ({ emit: (event: string, payload: unknown) => void emitted.push({ event, payload, room }) }) } };
}

beforeEach(() => {
  forgetLiveState('m1');
  db.match = {
    id: 'm1',
    status: 'ACTIVE',
    mode: 'RANKED',
    startedAt: new Date('2026-11-02T10:00:00Z'),
    endsAt: new Date('2026-11-02T10:15:00Z'),
    question: { title: 'Two Sum', slug: 'two-sum', difficulty: 'EASY' },
    players: [
      { userId: 'alice', ratingBefore: 1342, user: { id: 'alice', username: 'ada', rating: 1342 } },
      { userId: 'bob', ratingBefore: null, user: { id: 'bob', username: 'linus', rating: 1318 } },
    ],
    submissions: [],
  };
});

describe('handleSpectate', () => {
  it('reports an unknown match and joins nothing', async () => {
    const s = spectator();
    await handleSpectate(s.socket, { matchId: 'nope' });
    expect(s.emitted).toEqual([{ event: 'error', payload: { code: 'NOT_FOUND', message: 'Match not found' } }]);
    expect(s.rooms.size).toBe(0);
  });

  it('rejects a malformed payload', async () => {
    const s = spectator();
    await handleSpectate(s.socket, { matchId: '' });
    expect(s.emitted[0].payload.code).toBe('BAD_REQUEST');
  });

  it('joins the spectator room (not the match room) and sends the live state without code', async () => {
    const sink = roomSink();
    tellSpectators(sink.nsp, 'm1', 'alice', { status: 'typing', passed: 2, total: 3 });
    db.match!.submissions = [{ userId: 'bob', status: 'WRONG_ANSWER', passedTests: 9, totalTests: 14 }];

    const s = spectator(3);
    await handleSpectate(s.socket, { matchId: 'm1' });
    expect([...s.rooms]).toEqual(['watch:m1']);
    const [state] = s.emitted;
    expect(state.event).toBe('spectate:state');
    expect(state.payload).toMatchObject({ matchId: 'm1', status: 'ACTIVE', mode: 'RANKED', watchers: 3, question: { slug: 'two-sum' } });
    expect(state.payload.players).toEqual([
      { userId: 'alice', username: 'ada', rating: 1342, connected: true, status: 'typing', passed: 2, total: 3, verdict: null, hiddenPassed: null, hiddenTotal: null },
      { userId: 'bob', username: 'linus', rating: 1318, connected: false, status: 'submitted', passed: null, total: null, verdict: 'WRONG_ANSWER', hiddenPassed: 9, hiddenTotal: 14 },
    ]);
    expect(JSON.stringify(state.payload)).not.toMatch(/code|tests"/);
  });

  it('hides the hidden-test count while a submission is still being judged', async () => {
    db.match!.submissions = [{ userId: 'alice', status: 'PENDING', passedTests: 0, totalTests: 14 }];
    const s = spectator();
    await handleSpectate(s.socket, { matchId: 'm1' });
    expect(s.emitted[0].payload.players[0]).toMatchObject({ verdict: 'PENDING', hiddenPassed: null, hiddenTotal: 14 });
  });

  it('a finished match sends its final state but joins no room', async () => {
    db.match!.status = 'COMPLETED';
    const s = spectator();
    await handleSpectate(s.socket, { matchId: 'm1' });
    expect(s.rooms.size).toBe(0);
    expect(s.emitted[0].payload).toMatchObject({ status: 'COMPLETED', watchers: 0 });
  });
});

describe('tellSpectators', () => {
  it('sends only to the spectator room and merges live state', () => {
    const sink = roomSink();
    tellSpectators(sink.nsp, 'm1', 'alice', { status: 'running' }, 1000);
    tellSpectators(sink.nsp, 'm1', 'alice', { passed: 1, total: 3 }, 2000);
    tellSpectators(sink.nsp, 'm1', 'alice', { connected: false }, 3000);
    expect(sink.emitted.map(e => e.room)).toEqual(['watch:m1', 'watch:m1', 'watch:m1']);
    expect(sink.emitted[1].payload).toEqual({ matchId: 'm1', userId: 'alice', passed: 1, total: 3, at: 2000 });
    expect(liveStateOf('m1', 'alice')).toEqual({ status: 'running', passed: 1, total: 3 });
  });
});

describe('broadcastToMatch', () => {
  it('sends lifecycle events to players and spectators, and forgets live state when the match ends', () => {
    const sink = roomSink();
    tellSpectators(sink.nsp, 'm1', 'alice', { status: 'typing' });
    sink.emitted.length = 0;
    const namespace = sink.nsp as unknown as BattleNamespace;
    broadcastToMatch(namespace, 'm1', 'match:started', { matchId: 'm1', startedAt: 'a', endsAt: 'b' });
    expect(liveStateOf('m1', 'alice')).toBeDefined();
    broadcastToMatch(namespace, 'm1', 'match:ended', { matchId: 'm1', scores: [], reason: 'completed' });
    expect(sink.emitted.map(e => `${e.event}@${e.room}`)).toEqual([
      'match:started@m1',
      'match:started@watch:m1',
      'match:ended@m1',
      'match:ended@watch:m1',
    ]);
    expect(liveStateOf('m1', 'alice')).toBeUndefined();
  });
});
