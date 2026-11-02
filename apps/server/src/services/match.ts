import type { Prisma } from '@prisma/client';
import { isLanguage, type FinalScore, type Language } from '@codebattle/shared';
import { prisma } from '../prisma';
import { createMatchTimers, type MatchTimerJob, type MatchTimerScheduler } from '../queues/matchTimers';
import { useMemoryRedis } from '../redis';
import { forgetMatch } from '../socket/context';
import { broadcastToMatch, tellSpectators } from '../socket/spectate';
import type { BattleNamespace } from '../types';
import {
  READY_TIMEOUT_MS,
  computeRatingChanges,
  deadlineAfterSolve,
  deadlineReached,
  determineWinner,
  matchDurationSeconds,
  type RatingChange,
} from './matchLogic';
import { computeMatchScores, type PlayerPerformance } from './scoring';
import { clearMatchTelemetry, computeTypingMetrics, readSnapshots, readTyping } from './typing';

/*
 * Match lifecycle:
 *   WAITING --both ready--> ACTIVE --both judged / deadline--> COMPLETED
 *   WAITING --ready timeout / cancel--> ABANDONED
 *   ACTIVE  --forfeit--> COMPLETED
 * Every transition is a conditional update on the current status, so racing
 * events (two judgements, a forfeit during finalize, a timer firing) apply once.
 */

// Bull delayed jobs with Redis (durable across restarts and shared between instances), timers without
let timers: MatchTimerScheduler | null = null;

function matchTimers(): MatchTimerScheduler {
  if (!timers) timers = createMatchTimers(useMemoryRedis);
  return timers;
}

/** Tests swap in their own scheduler. */
export function setMatchTimers(scheduler: MatchTimerScheduler | null): void {
  timers = scheduler;
}

function schedule(job: MatchTimerJob): void {
  matchTimers()
    .schedule(job)
    .catch(err => console.error(`[match ${job.matchId}] could not schedule ${job.kind} timer`, err));
}

function clearTimers(matchId: string): void {
  forgetMatch(matchId);
  void matchTimers().cancel(matchId).catch(() => undefined);
}

/** Runs a fired match timer. Safe to call at any time: it re-checks the match first. */
export async function handleMatchTimer(job: MatchTimerJob, namespace: BattleNamespace): Promise<void> {
  if (job.kind === 'ready') {
    await cancelMatch(job.matchId, namespace, 'not-ready');
    return;
  }
  const match = await prisma.match.findUnique({ where: { id: job.matchId }, select: { status: true, endsAt: true } });
  if (!match || match.status !== 'ACTIVE' || !deadlineReached(match.endsAt)) return;
  await finalizeMatchIfReady(job.matchId, namespace, { force: true, forcedAt: job.forcedAt });
}

export function startMatchTimers(namespace: BattleNamespace): void {
  matchTimers().start(job => handleMatchTimer(job, namespace));
}

export async function closeMatchTimers(): Promise<void> {
  await timers?.close();
}

export function scheduleReadyTimeout(matchId: string, createdAt: Date, _namespace?: BattleNamespace): void {
  schedule({ kind: 'ready', matchId, at: createdAt.getTime() + READY_TIMEOUT_MS });
}

export function scheduleDeadline(matchId: string, endsAt: Date, _namespace?: BattleNamespace): void {
  schedule({ kind: 'deadline', matchId, at: endsAt.getTime() });
}

/** WAITING -> ACTIVE once every player has loaded the battle. */
export async function startMatchIfReady(matchId: string, namespace: BattleNamespace): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { players: true, question: { select: { difficulty: true } } },
  });
  if (!match || match.status !== 'WAITING' || !match.players.every(p => p.isReady)) return;

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + matchDurationSeconds(match.question.difficulty) * 1000);
  const claimed = await prisma.match.updateMany({
    where: { id: matchId, status: 'WAITING' },
    data: { status: 'ACTIVE', startedAt, endsAt },
  });
  if (claimed.count === 0) return;

  // a leftover ready timer finds the match ACTIVE and does nothing
  scheduleDeadline(matchId, endsAt, namespace);
  broadcastToMatch(namespace, matchId, 'match:started', { matchId, startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString() });
}

/** WAITING -> ABANDONED (nobody's rating changes). */
export async function cancelMatch(matchId: string, namespace: BattleNamespace, reason: 'not-ready' | 'cancelled'): Promise<boolean> {
  const claimed = await prisma.match.updateMany({
    where: { id: matchId, status: 'WAITING' },
    data: { status: 'ABANDONED', endedAt: new Date(), endReason: reason },
  });
  if (claimed.count === 0) return false;
  clearTimers(matchId);
  broadcastToMatch(namespace, matchId, 'match:cancelled', { matchId, reason });
  return true;
}

/**
 * Called after a submission is judged. A full solve puts the opponent on a
 * short clock (sudden death); then the match is finalized if both are done.
 */
export async function handleJudgedSubmission(matchId: string, userId: string, accepted: boolean, namespace: BattleNamespace): Promise<void> {
  if (accepted) {
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { submissions: { select: { userId: true } } } });
    const opponentSubmitted = match?.submissions.some(s => s.userId !== userId);
    if (match && match.status === 'ACTIVE' && match.endsAt && !opponentSubmitted) {
      const endsAt = deadlineAfterSolve(match.endsAt);
      if (endsAt.getTime() < match.endsAt.getTime()) {
        const moved = await prisma.match.updateMany({ where: { id: matchId, status: 'ACTIVE' }, data: { endsAt } });
        if (moved.count === 0) return;
        scheduleDeadline(matchId, endsAt, namespace);
        broadcastToMatch(namespace, matchId, 'match:deadline', { matchId, endsAt: endsAt.toISOString(), reason: 'opponent-solved' });
      }
    }
  }
  await finalizeMatchIfReady(matchId, namespace);
}

const FORCE_RETRY_MS = 3000;
const FORCE_MAX_WAIT_MS = 60_000;

/**
 * Scores and closes a match once every player has a judged submission. With
 * `force` (time ran out) players without a submission score 0; a submission
 * still being judged is waited for (up to a minute).
 */
export async function finalizeMatchIfReady(
  matchId: string,
  namespace: BattleNamespace,
  options: { force?: boolean; forcedAt?: number } = {}
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      question: { select: { difficulty: true } },
      players: { include: { user: { select: { id: true, rating: true } } } },
      submissions: true,
    },
  });
  if (!match || match.status !== 'ACTIVE') return;

  const submissionOf = (userId: string) => match.submissions.find(s => s.userId === userId);
  const judging = match.players.some(p => submissionOf(p.userId)?.status === 'PENDING');
  const missing = match.players.some(p => !submissionOf(p.userId));

  if (!options.force && (judging || missing)) return;
  if (options.force && judging) {
    const forcedAt = options.forcedAt ?? Date.now();
    if (Date.now() - forcedAt < FORCE_MAX_WAIT_MS) {
      schedule({ kind: 'deadline', matchId, at: Date.now() + FORCE_RETRY_MS, forcedAt });
      return;
    }
  }

  const startedAt = match.startedAt ?? match.createdAt;
  const endedAt = new Date();

  const performances: PlayerPerformance[] = [];
  const telemetry = new Map<string, { metrics: ReturnType<typeof computeTypingMetrics>; events: unknown[] }>();
  for (const player of match.players) {
    const submission = submissionOf(player.userId);
    const judged = submission && submission.status !== 'PENDING' ? submission : undefined;
    const { events, pastedChars } = await readTyping(match.id, player.userId);
    const metrics = computeTypingMetrics(events);
    telemetry.set(player.userId, { metrics, events });
    const codeLength = Math.max(judged?.code.length ?? 0, 1);
    performances.push({
      userId: player.userId,
      submission: judged
        ? {
            passed: judged.passedTests,
            total: judged.totalTests,
            secondsFromStart: Math.max((judged.submittedAt.getTime() - startedAt.getTime()) / 1000, 0),
            runtimeMs: judged.runtimeMs ?? 0,
            language: (isLanguage(judged.language) ? judged.language : 'javascript') as Language,
            quality: judged.qualityScore ?? 100,
          }
        : undefined,
      typing: {
        wpm: metrics.wpm,
        variation: metrics.variation,
        backspaceRate: metrics.backspaceRate,
        pastedRatio: Math.min(pastedChars / codeLength, 1),
      },
    });
  }

  const scores = computeMatchScores(performances, matchDurationSeconds(match.question.difficulty));
  const winnerId = determineWinner(scores);
  const replays = await collectReplays(match.id, match.players, match.submissions, startedAt);

  const finalized = await prisma.$transaction(async tx => {
    const claimed = await tx.match.updateMany({
      where: { id: match.id, status: 'ACTIVE' },
      data: { status: 'COMPLETED', winnerId: winnerId ?? null, endedAt, endReason: options.force ? 'timeout' : 'completed' },
    });
    if (claimed.count === 0) return null;

    const ratings = await lockRatings(tx, match.players.map(p => p.userId));
    const ratingOf = (userId: string) => ratings.get(userId) ?? match.players.find(p => p.userId === userId)!.user.rating;
    const changes = rankedChanges(match.mode, match.players.map(p => ({ userId: p.userId, rating: ratingOf(p.userId) })), winnerId);
    for (const score of scores) {
      const change = changes.find(c => c.userId === score.userId);
      const rating = ratingOf(score.userId);
      await tx.matchPlayer.update({
        where: { matchId_userId: { matchId: match.id, userId: score.userId } },
        data: {
          finalScore: score.total,
          scoreBreakdown: score.breakdown as unknown as Prisma.InputJsonObject,
          ratingBefore: rating,
          ratingAfter: change?.newRating ?? rating,
          replay: (replays.get(score.userId) ?? []) as Prisma.InputJsonArray,
        },
      });
    }
    await saveTypingProfiles(tx, match.id, telemetry);
    await applyRatings(tx, changes);
    return changes;
  });
  if (!finalized) return;
  const ratingChanges = finalized;

  clearTimers(match.id);
  await Promise.all(match.players.map(p => clearMatchTelemetry(match.id, p.userId).catch(() => undefined)));

  const payloadScores: FinalScore[] = scores.map(s => {
    const change = ratingChanges.find(c => c.userId === s.userId);
    return { matchId: match.id, ...s, ratingBefore: change?.oldRating, ratingAfter: change?.newRating };
  });
  broadcastToMatch(namespace, match.id, 'match:ended', {
    matchId: match.id,
    winnerId,
    scores: payloadScores,
    reason: options.force ? 'timeout' : 'completed',
  });
}

/** The forfeiting player loses immediately; before the start it just cancels the match. */
export async function forfeitMatch(matchId: string, userId: string, namespace: BattleNamespace): Promise<'forfeited' | 'cancelled' | 'over'> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      players: { include: { user: { select: { rating: true } } } },
      submissions: { select: { userId: true, code: true, language: true, submittedAt: true } },
    },
  });
  if (!match || match.status === 'COMPLETED' || match.status === 'ABANDONED') return 'over';
  if (match.status === 'WAITING') return (await cancelMatch(matchId, namespace, 'cancelled')) ? 'cancelled' : 'over';

  const opponent = match.players.find(p => p.userId !== userId);
  const winnerId = opponent?.userId;
  const self = match.players.find(p => p.userId === userId);

  // keep the replay and typing profiles, exactly as a finished battle does
  const startedAt = match.startedAt ?? match.createdAt;
  const replays = await collectReplays(matchId, match.players, match.submissions, startedAt);
  const telemetry = await collectTelemetry(matchId, match.players);

  const ratingChanges = await prisma.$transaction(async tx => {
    const claimed = await tx.match.updateMany({
      where: { id: matchId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', winnerId: winnerId ?? null, endedAt: new Date(), endReason: 'forfeit' },
    });
    if (claimed.count === 0) return null;
    const ratings = await lockRatings(tx, match.players.map(p => p.userId));
    const ratingOf = (p: { userId: string; user: { rating: number } }) => ratings.get(p.userId) ?? p.user.rating;
    const changes =
      self && opponent
        ? rankedChanges(match.mode, [{ userId: self.userId, rating: ratingOf(self) }, { userId: opponent.userId, rating: ratingOf(opponent) }], winnerId)
        : [];
    for (const player of match.players) {
      const change = changes.find(c => c.userId === player.userId);
      await tx.matchPlayer.update({
        where: { id: player.id },
        data: {
          ratingBefore: ratingOf(player),
          ratingAfter: change?.newRating ?? ratingOf(player),
          replay: (replays.get(player.userId) ?? []) as Prisma.InputJsonArray,
        },
      });
    }
    await saveTypingProfiles(tx, matchId, telemetry);
    await applyRatings(tx, changes);
    return changes;
  });
  if (!ratingChanges) return 'over';

  clearTimers(matchId);
  await Promise.all(match.players.map(p => clearMatchTelemetry(matchId, p.userId).catch(() => undefined)));
  namespace.to(matchId).emit('opponent:status', { matchId, status: 'forfeited' });
  tellSpectators(namespace, matchId, userId, { status: 'forfeited' });
  broadcastToMatch(namespace, matchId, 'match:ended', {
    matchId,
    winnerId,
    // every player, so casual (unrated) forfeits report scores too
    scores: match.players.map(p => {
      const change = ratingChanges.find(c => c.userId === p.userId);
      return {
        matchId,
        userId: p.userId,
        total: 0,
        breakdown: { correctness: 0, speed: 0, efficiency: 0, typing: 0, quality: 0 },
        ratingBefore: change?.oldRating,
        ratingAfter: change?.newRating,
      };
    }),
    reason: 'forfeit',
  });
  return 'forfeited';
}

type Telemetry = Map<string, { metrics: ReturnType<typeof computeTypingMetrics>; events: unknown[] }>;

/** Each player's recorded snapshots plus their final submission, for MatchPlayer.replay. */
async function collectReplays(
  matchId: string,
  players: ReadonlyArray<{ userId: string }>,
  submissions: ReadonlyArray<{ userId: string; code: string; language: string; submittedAt: Date }>,
  startedAt: Date,
): Promise<Map<string, unknown[]>> {
  const replays = new Map<string, unknown[]>();
  for (const player of players) {
    const frames: unknown[] = await readSnapshots(matchId, player.userId);
    const submission = submissions.find(s => s.userId === player.userId);
    if (submission) {
      frames.push({ t: submission.submittedAt.getTime() - startedAt.getTime(), code: submission.code, language: submission.language, submitted: true });
    }
    replays.set(player.userId, frames);
  }
  return replays;
}

async function collectTelemetry(matchId: string, players: ReadonlyArray<{ userId: string }>): Promise<Telemetry> {
  const telemetry: Telemetry = new Map();
  for (const player of players) {
    const { events } = await readTyping(matchId, player.userId);
    telemetry.set(player.userId, { metrics: computeTypingMetrics(events), events });
  }
  return telemetry;
}

async function saveTypingProfiles(tx: Prisma.TransactionClient, matchId: string, telemetry: Telemetry): Promise<void> {
  for (const [userId, t] of telemetry) {
    if (!t.events.length) continue;
    const profile = {
      avgWpm: t.metrics.wpm,
      wpmVariance: t.metrics.variation,
      backspaceRate: t.metrics.backspaceRate,
      avgPauseMs: t.metrics.avgPauseMs,
      burstCount: t.metrics.burstCount,
      keystrokeEvents: t.events as Prisma.InputJsonArray,
    };
    await tx.typingProfile.upsert({
      where: { userId_matchId: { userId, matchId } },
      update: profile,
      create: { userId, matchId, ...profile },
    });
  }
}

/**
 * Current ratings, row-locked until the transaction ends. Two battles finishing
 * at once for the same player then rate one after the other, each from the
 * rating the other left, instead of both from a stale copy read earlier.
 */
async function lockRatings(tx: Prisma.TransactionClient, userIds: string[]): Promise<Map<string, number>> {
  if (!userIds.length) return new Map();
  const rows = await tx.$queryRaw<Array<{ id: string; rating: number }>>`
    SELECT "id", "rating" FROM "User" WHERE "id" = ANY(${userIds}::text[]) FOR UPDATE`;
  return new Map(rows.map(r => [r.id, Number(r.rating)]));
}

function rankedChanges(mode: string, players: Array<{ userId: string; rating: number }>, winnerId: string | null | undefined): RatingChange[] {
  if (mode !== 'RANKED' || players.length !== 2) return [];
  return computeRatingChanges(players[0], players[1], winnerId ?? undefined);
}

async function applyRatings(tx: Prisma.TransactionClient, changes: RatingChange[]): Promise<void> {
  for (const change of changes) {
    await tx.user.update({
      where: { id: change.userId },
      data: {
        // relative, so results of two battles finishing at once can't overwrite each other
        rating: { increment: change.delta },
        totalMatches: { increment: 1 },
        wins: { increment: change.win ? 1 : 0 },
        losses: { increment: change.loss ? 1 : 0 },
      },
    });
  }
}

/**
 * Re-arms timers after a restart. In-process timers are lost with the process; Bull jobs survive,
 * and re-adding them is a no-op because job ids are derived from the match and the deadline.
 */
export async function restoreMatchTimers(namespace: BattleNamespace): Promise<void> {
  const open = await prisma.match.findMany({
    where: { status: { in: ['WAITING', 'ACTIVE'] } },
    include: { question: { select: { difficulty: true } } },
  });
  for (const match of open) {
    if (match.status === 'WAITING') {
      scheduleReadyTimeout(match.id, match.createdAt, namespace);
    } else {
      const endsAt =
        match.endsAt ??
        new Date((match.startedAt ?? match.createdAt).getTime() + matchDurationSeconds(match.question.difficulty) * 1000);
      scheduleDeadline(match.id, endsAt, namespace);
    }
  }
  if (open.length) console.log(`[match] restored timers for ${open.length} open match(es)`);
}

export function readyDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + READY_TIMEOUT_MS);
}
