import {
  matchRefSchema,
  runSchema,
  snapshotSchema,
  submitSchema,
  typingBatchSchema,
  type SubmissionResult,
} from '@codebattle/shared';
import { prisma } from '../prisma';
import { submissionQueue } from '../queues/submission';
import { judge } from '../services/judge';
import { forfeitMatch, readyDeadline, startMatchIfReady } from '../services/match';
import { analyzeQuality } from '../services/quality';
import { loadQuestion, toDisplayResults } from '../services/questions';
import { recordSnapshot, recordTypingBatch } from '../services/typing';
import type { BattleNamespace } from '../types';
import { BATTLE_EVENT_CLASSES, battleEventLimiter, type EventClass, type EventRateLimiter } from './rateLimit';
import { handleSpectate, handleUnspectate, isSpectatorRoom, tellSpectators } from './spectate';
import { cachedParticipant, isOnline, judgeLimiter, parsePayload, rememberParticipant, safe, userRoom, type BattleSocket } from './context';

export function registerBattleHandlers(namespace: BattleNamespace, limiter: EventRateLimiter = battleEventLimiter): void {
  namespace.on('connection', socket => {
    const userId = socket.data.userId!;
    const limited = rateLimited(socket, userId, limiter);
    socket.on('battle:ready', limited('battle:ready', safe(socket, 'battle:ready', p => handleReady(namespace, socket, userId, p))));
    socket.on('battle:run', limited('battle:run', safe(socket, 'battle:run', p => handleRun(socket, userId, p))));
    socket.on('battle:submit', limited('battle:submit', safe(socket, 'battle:submit', p => handleSubmit(socket, userId, p))));
    socket.on('battle:forfeit', limited('battle:forfeit', safe(socket, 'battle:forfeit', p => handleForfeit(namespace, socket, userId, p))));
    socket.on('battle:typing', limited('battle:typing', safe(socket, 'battle:typing', p => handleTyping(socket, userId, p))));
    socket.on('battle:snapshot', limited('battle:snapshot', safe(socket, 'battle:snapshot', p => handleSnapshot(socket, userId, p))));
    socket.on('battle:spectate', limited('battle:spectate', safe(socket, 'battle:spectate', p => handleSpectate(socket, p))));
    socket.on('battle:unspectate', limited('battle:unspectate', safe(socket, 'battle:unspectate', p => handleUnspectate(socket, p))));
    socket.on('disconnect', () => limiter.forgetSocket(socket.id));

    // tell opponents in live matches that this player dropped
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room === socket.id || room.startsWith('user:') || isSpectatorRoom(room)) continue;
        if (!isOnlineElsewhere(socket, userId)) {
          socket.to(room).emit('opponent:status', { matchId: room, status: 'disconnected' });
          tellSpectators(socket.nsp, room, userId, { connected: false });
        }
      }
    });
  });
}

/**
 * Rejected events report RATE_LIMITED, at most once per second per event class, and cost no DB read.
 * A socket that keeps exceeding the limit (SOCKET_MAX_VIOLATIONS) is disconnected.
 */
function rateLimited(socket: BattleSocket, userId: string, limiter: EventRateLimiter) {
  const lastNotice = new Map<EventClass, number>();
  let cut = false;
  return <A extends unknown[]>(event: string, handler: (...args: A) => void) =>
    (...args: A): void => {
      if (cut) return;
      const cls = BATTLE_EVENT_CLASSES[event] ?? 'action';
      const result = limiter.check(socket.id, userId, cls);
      if (result === 'ok') {
        handler(...args);
        return;
      }
      if (result === 'disconnect') {
        cut = true;
        console.warn(`rate limit: disconnecting socket ${socket.id} (user ${userId}) after repeated violations`);
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Disconnected for sending too many requests. Reload the page to reconnect.' });
        socket.disconnect(true);
        return;
      }
      const now = Date.now();
      if (now - (lastNotice.get(cls) ?? -Infinity) >= 1_000) {
        lastNotice.set(cls, now);
        socket.emit('error', { code: 'RATE_LIMITED', message: 'You are sending too fast. Slow down for a moment.' });
      }
    };
}

function isOnlineElsewhere(socket: BattleSocket, userId: string): boolean {
  // presence is decremented after 'disconnecting', so >1 connection means another tab is open
  return isOnline(userId) && (socket.nsp.adapter.rooms.get(userRoom(userId))?.size ?? 0) > 1;
}

/** Loads the match if the user plays in it, otherwise reports NOT_FOUND. */
async function participantMatch(socket: BattleSocket, matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true, submissions: true },
  });
  if (!match || !match.players.some(p => p.userId === userId)) {
    socket.emit('error', { code: 'NOT_FOUND', message: 'Match not found' });
    return null;
  }
  return match;
}

async function handleReady(namespace: BattleNamespace, socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, matchRefSchema, payload);
  if (!data) return;
  const match = await participantMatch(socket, data.matchId, userId);
  if (!match) return;

  await socket.join(match.id);
  socket.to(match.id).emit('opponent:status', { matchId: match.id, status: 'connected' });
  tellSpectators(socket.nsp, match.id, userId, { connected: true });

  if (match.status === 'WAITING') {
    await prisma.matchPlayer.update({ where: { matchId_userId: { matchId: match.id, userId } }, data: { isReady: true } });
    await startMatchIfReady(match.id, namespace);
  }
  // read again after the start attempt so the snapshot is never older than a match:started already sent
  const current = await prisma.match.findUnique({ where: { id: match.id }, include: { players: true, submissions: true } });
  if (current) await emitBattleState(socket, current, userId);
}

async function emitBattleState(
  socket: BattleSocket,
  match: NonNullable<Awaited<ReturnType<typeof participantMatch>>>,
  userId: string
): Promise<void> {
  const own = match.submissions.find(s => s.userId === userId);
  const opponentId = match.players.find(p => p.userId !== userId)?.userId;
  const submission: SubmissionResult | undefined = own && {
    matchId: match.id,
    userId,
    status: own.status,
    passedTests: own.passedTests,
    totalTests: own.totalTests,
    runtimeMs: own.runtimeMs ?? undefined,
    message: own.message ?? undefined,
  };
  socket.emit('battle:state', {
    matchId: match.id,
    status: match.status,
    startedAt: match.startedAt?.toISOString(),
    endsAt: match.endsAt?.toISOString(),
    readyDeadline: match.status === 'WAITING' ? readyDeadline(match.createdAt).toISOString() : undefined,
    submission,
    opponentSubmitted: match.submissions.some(s => s.userId !== userId),
    opponentConnected: opponentId ? isOnline(opponentId) : false,
  });
}

async function handleRun(socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, runSchema, payload);
  if (!data) return;
  const match = await participantMatch(socket, data.matchId, userId);
  if (!match) return;
  // endsAt too: the status stays ACTIVE until the deadline job finalizes the match
  if (match.status !== 'ACTIVE' || (match.endsAt && match.endsAt.getTime() < Date.now())) {
    socket.emit('error', { code: 'MATCH_NOT_ACTIVE', message: match.status === 'WAITING' ? 'The match has not started yet.' : 'The match is over.' });
    return;
  }
  const question = await loadQuestion({ id: match.questionId });
  if (!question) throw new Error(`question ${match.questionId} missing`);

  const release = judgeLimiter.acquire(userId);
  if (typeof release === 'string') {
    socket.emit('error', { code: 'RATE_LIMITED', message: release });
    return;
  }
  try {
    socket.to(match.id).emit('opponent:status', { matchId: match.id, status: 'running' });
    tellSpectators(socket.nsp, match.id, userId, { status: 'running' });
    let result;
    try {
      result = await judge(question.signature, data.language, data.code, question.visible);
    } catch (error) {
      console.error('run failed', error);
      socket.emit('error', { code: 'JUDGE_UNAVAILABLE', message: 'The judge is unavailable right now. Please try again.' });
      return;
    }
    socket.emit('run:result', {
      matchId: match.id,
      verdict: result.verdict,
      passed: result.passed,
      total: result.total,
      message: result.message,
      results: toDisplayResults(question.signature, question.visible, result.outcomes),
    });
    socket.to(match.id).emit('opponent:progress', { matchId: match.id, passed: result.passed, total: result.total });
    tellSpectators(socket.nsp, match.id, userId, { status: 'typing', passed: result.passed, total: result.total });
  } finally {
    release();
  }
}

async function handleSubmit(socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, submitSchema, payload);
  if (!data) return;
  const match = await participantMatch(socket, data.matchId, userId);
  if (!match) return;
  if (match.status !== 'ACTIVE' || (match.endsAt && match.endsAt.getTime() < Date.now())) {
    socket.emit('error', { code: 'MATCH_NOT_ACTIVE', message: match.status === 'WAITING' ? 'The match has not started yet.' : 'The match is over.' });
    return;
  }
  if (match.submissions.some(s => s.userId === userId)) {
    socket.emit('error', { code: 'ALREADY_SUBMITTED', message: 'You have already submitted. Submissions are final.' });
    return;
  }
  const question = await loadQuestion({ id: match.questionId });
  if (!question) throw new Error(`question ${match.questionId} missing`);

  let submissionId: string;
  try {
    const submission = await prisma.submission.create({
      data: {
        matchId: match.id,
        userId,
        code: data.code,
        language: data.language,
        status: 'PENDING',
        totalTests: question.hidden.length,
        qualityScore: analyzeQuality(data.language, data.code).score,
      },
    });
    submissionId = submission.id;
  } catch (error) {
    // unique (matchId, userId): a double click raced the check above
    if ((error as { code?: string }).code === 'P2002') {
      socket.emit('error', { code: 'ALREADY_SUBMITTED', message: 'You have already submitted. Submissions are final.' });
      return;
    }
    throw error;
  }

  socket.nsp.to(userRoom(userId)).emit('submission:result', {
    matchId: match.id,
    userId,
    status: 'PENDING',
    passedTests: 0,
    totalTests: question.hidden.length,
  });
  socket.to(match.id).emit('opponent:status', { matchId: match.id, status: 'submitted' });
  tellSpectators(socket.nsp, match.id, userId, { status: 'submitted', verdict: 'PENDING', hiddenTotal: question.hidden.length });
  await submissionQueue.add({ submissionId });
}

async function handleForfeit(namespace: BattleNamespace, socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, matchRefSchema, payload);
  if (!data) return;
  const match = await participantMatch(socket, data.matchId, userId);
  if (!match) return;
  await socket.join(match.id);
  const outcome = await forfeitMatch(match.id, userId, namespace);
  if (outcome === 'over') socket.emit('error', { code: 'MATCH_OVER', message: 'Match already finished' });
}

/** Cheap participation check for the high-frequency telemetry events. */
async function isActiveParticipant(matchId: string, userId: string): Promise<boolean> {
  if (cachedParticipant(matchId, userId)) return true;
  const player = await prisma.matchPlayer.findUnique({
    where: { matchId_userId: { matchId, userId } },
    include: { match: { select: { status: true } } },
  });
  if (!player || player.match.status !== 'ACTIVE') return false;
  rememberParticipant(matchId, userId);
  return true;
}

async function handleTyping(socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, typingBatchSchema, payload);
  if (!data || !(await isActiveParticipant(data.matchId, userId))) return;
  await recordTypingBatch(data.matchId, userId, data.events, data.pastedChars);
  if (data.events.length) {
    socket.to(data.matchId).emit('opponent:status', { matchId: data.matchId, status: 'typing' });
    tellSpectators(socket.nsp, data.matchId, userId, { status: 'typing' });
  }
}

async function handleSnapshot(socket: BattleSocket, userId: string, payload: unknown): Promise<void> {
  const data = parsePayload(socket, snapshotSchema, payload);
  if (!data || !(await isActiveParticipant(data.matchId, userId))) return;
  const match = await prisma.match.findUnique({ where: { id: data.matchId }, select: { startedAt: true } });
  if (!match?.startedAt) return;
  await recordSnapshot(data.matchId, userId, { t: Date.now() - match.startedAt.getTime(), code: data.code, language: data.language });
}
