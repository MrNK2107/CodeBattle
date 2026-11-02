import { randomInt } from 'crypto';
import {
  queueJoinSchema,
  roomCreateSchema,
  roomJoinSchema,
  type MatchMode,
  type QueueDifficulty,
  type UserSummary,
} from '@codebattle/shared';
import { prisma } from '../prisma';
import { scheduleReadyTimeout } from '../services/match';
import { currentRange, pickClosestCandidate, resolveDifficulty, type Difficulty } from '../services/matchLogic';
import type { BattleNamespace } from '../types';
import { isOnline, markConnected, markDisconnected, parsePayload, safe, userRoom, type BattleSocket } from './context';

/*
 * The server runs as a single instance (socket rooms and match timers are
 * in-process), so the queue lives in memory and every pairing decision runs
 * inside one serialized tick: two players can never be matched twice.
 */

interface QueueEntry {
  userId: string;
  rating: number;
  joinedAt: number;
  difficulty: QueueDifficulty;
}

const queue = new Map<string, QueueEntry>();
const TICK_MS = 2000;

let tickRunning: Promise<void> = Promise.resolve();
function runExclusive(fn: () => Promise<void>): Promise<void> {
  tickRunning = tickRunning.then(fn, fn).catch(err => console.error('[queue] tick failed', err));
  return tickRunning;
}

export function registerMatchmakingHandlers(namespace: BattleNamespace): void {
  setInterval(() => void runExclusive(() => tick(namespace)), TICK_MS).unref();

  namespace.on('connection', socket => {
    const userId = socket.data.userId!;
    markConnected(userId);
    void socket.join(userRoom(userId));

    socket.on('queue:join', safe(socket, 'queue:join', p => handleJoin(namespace, socket, userId, p)));
    socket.on('queue:leave', () => {
      queue.delete(userId);
    });
    socket.on('room:create', safe(socket, 'room:create', p => handleRoomCreate(socket, userId, p)));
    socket.on('room:join', safe(socket, 'room:join', p => handleRoomJoin(namespace, socket, userId, p)));
    socket.on('room:cancel', () => cancelRoomsOf(userId));

    socket.on('disconnect', () => {
      if (markDisconnected(userId)) {
        queue.delete(userId);
        cancelRoomsOf(userId);
      }
    });
  });
}

async function handleJoin(namespace: BattleNamespace, socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, queueJoinSchema, payload);
  if (!data) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rating: true } });
  if (!user) {
    socket.emit('error', { code: 'NOT_FOUND', message: 'User not found' });
    return;
  }
  const active = await prisma.match.findFirst({
    where: { status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId } } },
    select: { id: true },
  });
  if (active) {
    socket.emit('error', { code: 'IN_MATCH', message: `You are already in a battle (${active.id}). Finish or forfeit it first.` });
    return;
  }
  queue.set(userId, { userId, rating: user.rating, joinedAt: Date.now(), difficulty: data.difficulty });
  await runExclusive(() => tick(namespace));
}

/** Pairs waiting players (oldest first), times out stale entries and reports status. */
async function tick(namespace: BattleNamespace): Promise<void> {
  const now = Date.now();
  const entries = [...queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  const matched = new Set<string>();

  for (const entry of entries) {
    if (matched.has(entry.userId) || !queue.has(entry.userId)) continue;
    if (!isOnline(entry.userId)) {
      queue.delete(entry.userId);
      continue;
    }
    if (currentRange(entry.joinedAt, now) === null) {
      queue.delete(entry.userId);
      namespace.to(userRoom(entry.userId)).emit('queue:timeout');
      continue;
    }
    const candidates = entries.filter(c => !matched.has(c.userId) && queue.has(c.userId) && c.userId !== entry.userId);
    const opponent = pickClosestCandidate(entry, candidates, now);
    if (!opponent) continue;

    queue.delete(entry.userId);
    queue.delete(opponent.userId);
    matched.add(entry.userId).add(opponent.userId);
    // a second tab may have queued someone who is already in a battle
    const busy = await usersInOpenMatches([entry.userId, opponent.userId]);
    if (busy.size) {
      for (const id of [entry.userId, opponent.userId]) {
        if (busy.has(id)) continue;
        queue.set(id, id === entry.userId ? entry : opponent);
        matched.delete(id);
      }
      continue;
    }
    try {
      await createMatch(namespace, [entry.userId, opponent.userId], resolveDifficulty(entry.difficulty, opponent.difficulty), 'RANKED');
    } catch (error) {
      console.error('[queue] match creation failed', error);
      for (const id of [entry.userId, opponent.userId]) {
        namespace.to(userRoom(id)).emit('error', { code: 'SERVER_ERROR', message: 'Could not start the match. Please search again.' });
      }
    }
  }

  for (const entry of queue.values()) {
    const range = currentRange(entry.joinedAt, now);
    if (range === null) continue;
    namespace.to(userRoom(entry.userId)).emit('queue:status', {
      difficulty: entry.difficulty,
      range: Number.isFinite(range) ? range : -1,
      searching: queue.size,
    });
  }
}

async function usersInOpenMatches(userIds: string[]): Promise<Set<string>> {
  const players = await prisma.matchPlayer.findMany({
    where: { userId: { in: userIds }, match: { status: { in: ['WAITING', 'ACTIVE'] } } },
    select: { userId: true },
  });
  return new Set(players.map(p => p.userId));
}

/**
 * A random active question neither player has met: not one they battled on, and
 * not one they solved in practice (solving unlocks the recorded ghost code, so
 * they may have read another player's solution).
 */
export async function pickQuestion(userIds: string[], difficulty: Difficulty) {
  const [battled, practised] = await Promise.all([
    prisma.match.findMany({
      where: { players: { some: { userId: { in: userIds } } } },
      select: { questionId: true },
    }),
    prisma.practiceAttempt.findMany({
      where: { userId: { in: userIds }, status: 'ACCEPTED' },
      select: { questionId: true },
      distinct: ['questionId'],
    }),
  ]);
  const seenIds = [...new Set([...battled, ...practised].map(s => s.questionId))];
  let where: { difficulty: Difficulty; isActive: boolean; id?: { notIn: string[] } } = { difficulty, isActive: true, id: { notIn: seenIds } };
  let available = await prisma.question.count({ where });
  if (available === 0) {
    // both players have seen every question of this difficulty: allow repeats
    where = { difficulty, isActive: true };
    available = await prisma.question.count({ where });
  }
  if (available === 0) throw new Error(`No active ${difficulty} questions`);
  return prisma.question.findFirstOrThrow({
    where,
    select: { id: true, title: true, slug: true, difficulty: true, tags: true },
    skip: randomInt(available),
    orderBy: { id: 'asc' },
  });
}

async function createMatch(namespace: BattleNamespace, userIds: [string, string], difficulty: Difficulty, mode: MatchMode): Promise<string> {
  const question = await pickQuestion(userIds, difficulty);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, rating: true, avatarUrl: true, image: true },
  });
  const match = await prisma.match.create({
    data: { questionId: question.id, status: 'WAITING', mode, players: { create: userIds.map(userId => ({ userId })) } },
  });
  scheduleReadyTimeout(match.id, match.createdAt, namespace);

  const summary = (id: string): UserSummary => {
    const u = users.find(x => x.id === id)!;
    return { id: u.id, username: u.username, rating: u.rating, avatarUrl: u.avatarUrl ?? u.image ?? undefined };
  };
  for (const id of userIds) {
    const opponentId = userIds.find(x => x !== id)!;
    namespace.to(userRoom(id)).emit('match:found', { matchId: match.id, question, opponent: summary(opponentId), mode });
  }
  console.log(`[match] ${match.id} ${mode} ${difficulty} ${question.slug}: ${userIds.join(' vs ')}`);
  return match.id;
}

// ---------------------------------------------------------------- friendly rooms

interface Room {
  code: string;
  hostId: string;
  difficulty: QueueDifficulty;
  expiresAt: number;
}

const rooms = new Map<string, Room>();
const ROOM_TTL_MS = 30 * 60 * 1000;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function cancelRoomsOf(userId: string): void {
  for (const [code, room] of rooms) if (room.hostId === userId) rooms.delete(code);
}

async function handleRoomCreate(socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, roomCreateSchema, payload);
  if (!data) return;
  cancelRoomsOf(userId);
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  rooms.set(code, { code, hostId: userId, difficulty: data.difficulty, expiresAt: Date.now() + ROOM_TTL_MS });
  socket.emit('room:created', { code });
}

async function handleRoomJoin(namespace: BattleNamespace, socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, roomJoinSchema, payload);
  if (!data) return;
  const code = data.code.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.expiresAt < Date.now()) {
    rooms.delete(code);
    socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'This challenge link has expired or was cancelled.' });
    return;
  }
  if (room.hostId === userId) {
    socket.emit('error', { code: 'ROOM_OWN', message: 'Share this link with a friend; you cannot accept your own challenge.' });
    return;
  }
  if (!isOnline(room.hostId)) {
    socket.emit('error', { code: 'ROOM_HOST_OFFLINE', message: 'The player who sent this challenge is offline.' });
    return;
  }
  const busy = await usersInOpenMatches([room.hostId, userId]);
  if (busy.size) {
    socket.emit('error', {
      code: 'ROOM_BUSY',
      message: busy.has(userId) ? 'Finish or forfeit your current battle first.' : 'Your friend is in another battle right now. Try again when it ends.',
    });
    return;
  }
  rooms.delete(code);
  queue.delete(userId);
  queue.delete(room.hostId);
  await createMatch(namespace, [room.hostId, userId], resolveDifficulty(room.difficulty, 'ANY'), 'FRIENDLY');
}
