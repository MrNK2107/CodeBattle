import { matchRefSchema, type SpectatePlayer, type SpectateUpdatePayload } from '@codebattle/shared';
import { prisma } from '../prisma';
import type { BattleNamespace } from '../types';
import { isOnline, parsePayload, type BattleSocket } from './context';

/*
 * Spectator mode. Anyone signed in can watch a live battle: both players' live
 * state (typing, running, submitted), how many visible examples their latest run
 * passed, and the final verdicts. Spectators never receive code, test data or a
 * player's run output, and they can't send anything into the match.
 *
 * Spectators sit in their own room (`watch:<matchId>`), separate from the match
 * room, so nothing the players' clients receive leaks to them by accident; every
 * spectator event is sent on purpose through `tellSpectators`.
 */

export const spectatorRoom = (matchId: string): string => `watch:${matchId}`;
export const isSpectatorRoom = (room: string): boolean => room.startsWith('watch:');

type Live = Pick<SpectatePlayer, 'status' | 'passed' | 'total'>;

/** Live state per match and player, so a spectator who joins late sees the latest run. In-process, like the rest of the battle server. */
const live = new Map<string, Map<string, Live>>();
const MAX_TRACKED_MATCHES = 10_000;

export function liveStateOf(matchId: string, userId: string): Live | undefined {
  return live.get(matchId)?.get(userId);
}

export function forgetLiveState(matchId: string): void {
  live.delete(matchId);
}

function remember(matchId: string, userId: string, patch: Omit<SpectateUpdatePayload, 'matchId' | 'userId' | 'at'>): void {
  if (patch.status === undefined && patch.passed === undefined) return;
  let players = live.get(matchId);
  if (!players) {
    if (live.size >= MAX_TRACKED_MATCHES) {
      // drop the oldest match; Map iteration order is insertion order
      const oldest = live.keys().next().value;
      if (oldest !== undefined) live.delete(oldest);
    }
    players = new Map();
    live.set(matchId, players);
  }
  const prev = players.get(userId) ?? { status: null, passed: null, total: null };
  players.set(userId, {
    status: patch.status ?? prev.status,
    passed: patch.passed ?? prev.passed,
    total: patch.total ?? prev.total,
  });
}

interface RoomTarget {
  to(room: string): { emit(event: 'spectate:update', payload: SpectateUpdatePayload): unknown };
}

/**
 * Records a player's live state and sends it to the match's spectators. Pass
 * `remember: false` when the match is no longer ACTIVE, so a late judge result
 * doesn't re-create live state that broadcastToMatch already forgot.
 */
export function tellSpectators(
  nsp: RoomTarget,
  matchId: string,
  userId: string,
  patch: Omit<SpectateUpdatePayload, 'matchId' | 'userId' | 'at'>,
  now: number = Date.now(),
  opts: { remember?: boolean } = {},
): void {
  if (opts.remember !== false) remember(matchId, userId, patch);
  nsp.to(spectatorRoom(matchId)).emit('spectate:update', { matchId, userId, ...patch, at: now });
}

export async function handleSpectate(socket: BattleSocket, payload: unknown): Promise<void> {
  const data = parsePayload(socket, matchRefSchema, payload);
  if (!data) return;
  const match = await prisma.match.findUnique({
    where: { id: data.matchId },
    include: {
      question: { select: { title: true, slug: true, difficulty: true } },
      players: { include: { user: { select: { id: true, username: true, rating: true } } } },
      submissions: { select: { userId: true, status: true, passedTests: true, totalTests: true } },
    },
  });
  if (!match) {
    socket.emit('error', { code: 'NOT_FOUND', message: 'Match not found' });
    return;
  }
  // Friendly battles are private, and a battle still waiting for its players
  // has nothing to watch yet: only the participants may open either.
  const participant = match.players.some(p => p.userId === socket.data.userId);
  if (!participant && (match.mode === 'FRIENDLY' || match.status === 'WAITING')) {
    socket.emit('error', { code: 'FORBIDDEN', message: 'This battle is not open to spectators.' });
    return;
  }

  const live = match.status === 'WAITING' || match.status === 'ACTIVE';
  if (live) await socket.join(spectatorRoom(match.id));
  else forgetLiveState(match.id);

  const players: SpectatePlayer[] = match.players.map(p => {
    const sub = match.submissions.find(s => s.userId === p.userId);
    const state = liveStateOf(match.id, p.userId);
    return {
      userId: p.userId,
      username: p.user.username,
      rating: p.ratingBefore ?? p.user.rating,
      connected: isOnline(p.userId),
      status: sub ? 'submitted' : (state?.status ?? null),
      passed: state?.passed ?? null,
      total: state?.total ?? null,
      verdict: sub?.status ?? null,
      hiddenPassed: sub && sub.status !== 'PENDING' ? sub.passedTests : null,
      hiddenTotal: sub ? sub.totalTests : null,
    };
  });

  socket.emit('spectate:state', {
    matchId: match.id,
    status: match.status,
    mode: match.mode,
    question: match.question,
    startedAt: match.startedAt?.toISOString(),
    endsAt: match.endsAt?.toISOString(),
    players,
    watchers: live ? (socket.nsp.adapter.rooms.get(spectatorRoom(match.id))?.size ?? 1) : 0,
  });
}

/** Stops watching: the client sends battle:unspectate when the spectator view unmounts. */
export async function handleUnspectate(socket: BattleSocket, payload: unknown): Promise<void> {
  const data = parsePayload(socket, matchRefSchema, payload);
  if (!data) return;
  await socket.leave(spectatorRoom(data.matchId));
}

type LifecycleEvent = 'match:started' | 'match:cancelled' | 'match:deadline' | 'match:ended';

/** Match lifecycle events go to the players' room and, separately, to its spectators. */
export function broadcastToMatch<E extends LifecycleEvent>(
  namespace: BattleNamespace,
  matchId: string,
  event: E,
  payload: Parameters<import('@codebattle/shared').BattleServerToClientEvents[E]>[0],
): void {
  const emit = (room: string) => (namespace.to(room).emit as (e: string, p: unknown) => void)(event, payload);
  emit(matchId);
  emit(spectatorRoom(matchId));
  if (event === 'match:ended' || event === 'match:cancelled') {
    forgetLiveState(matchId);
    // nothing more will be sent to this match's spectators; drop the room
    namespace.in(spectatorRoom(matchId)).socketsLeave(spectatorRoom(matchId));
  }
}
