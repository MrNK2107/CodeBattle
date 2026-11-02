/**
 * Pure (I/O free) match rules. Kept separate from the socket / prisma layers so
 * they can be unit tested directly.
 */
import { updateElo } from './elo';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QueueDifficultyChoice = Difficulty | 'ANY';

/** Matchmaking gives up after this long without an opponent. */
export const QUEUE_TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_SECONDS ?? 90) * 1000;
/** Rating window starts at ±100 and widens by 100 every 15 s; after 45 s anyone is a match. */
export const OPEN_RANGE_AFTER_MS = 45_000;
/** Both players must load the battle within this window or the match is cancelled. */
export const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_SECONDS ?? 60) * 1000;
/** Once a player solves the problem, the opponent has at most this long left. */
export const SUDDEN_DEATH_MS = Number(process.env.SUDDEN_DEATH_SECONDS ?? 5 * 60) * 1000;

const DEFAULT_DURATION_SECONDS: Record<Difficulty, number> = { EASY: 15 * 60, MEDIUM: 25 * 60, HARD: 40 * 60 };

/** Battle length; speed is scored against it and the server force-ends matches after it. */
export function matchDurationSeconds(difficulty: Difficulty, env: NodeJS.ProcessEnv = process.env): number {
  const override = Number(env.MATCH_DURATION_SECONDS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_DURATION_SECONDS[difficulty];
}

/**
 * Whether a deadline job should end the match now. Jobs can outlive the
 * deadline they were scheduled for (it moved earlier after a solve, or the
 * job ran early on a host with a skewed clock); those must not end it.
 */
export function deadlineReached(endsAt: Date | null, now: number = Date.now(), toleranceMs: number = 1000): boolean {
  return endsAt === null || endsAt.getTime() <= now + toleranceMs;
}

/** Allowed rating gap after waiting `now - joinedAt`, or null once the queue timed out. */
export function currentRange(joinedAt: number, now: number = Date.now()): number | null {
  const elapsed = Math.max(now - joinedAt, 0);
  if (elapsed >= QUEUE_TIMEOUT_MS) return null;
  if (elapsed >= OPEN_RANGE_AFTER_MS) return Number.POSITIVE_INFINITY;
  return 100 + Math.floor(elapsed / 15_000) * 100;
}

/** Two choices are compatible when they're equal or either is ANY. */
export function difficultiesCompatible(a: QueueDifficultyChoice, b: QueueDifficultyChoice): boolean {
  return a === 'ANY' || b === 'ANY' || a === b;
}

export function resolveDifficulty(
  a: QueueDifficultyChoice,
  b: QueueDifficultyChoice,
  random: () => number = Math.random
): Difficulty {
  if (a !== 'ANY') return a;
  if (b !== 'ANY') return b;
  const choices: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
  return choices[Math.min(Math.floor(random() * choices.length), choices.length - 1)];
}

/**
 * Closest-rated compatible candidate. Both sides' windows must allow the gap,
 * so a newcomer can't pull in someone who only accepts close ratings.
 */
export function pickClosestCandidate<T extends { userId: string; rating: number; joinedAt: number; difficulty: QueueDifficultyChoice }>(
  self: T,
  candidates: T[],
  now: number = Date.now()
): T | null {
  const myRange = currentRange(self.joinedAt, now);
  if (myRange === null) return null;
  let chosen: T | null = null;
  let smallestDiff = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.userId === self.userId) continue;
    if (!difficultiesCompatible(self.difficulty, candidate.difficulty)) continue;
    const theirRange = currentRange(candidate.joinedAt, now);
    if (theirRange === null) continue;
    const diff = Math.abs(candidate.rating - self.rating);
    if (diff > myRange || diff > theirRange) continue;
    if (diff < smallestDiff || (diff === smallestDiff && chosen && candidate.joinedAt < chosen.joinedAt)) {
      smallestDiff = diff;
      chosen = candidate;
    }
  }
  return chosen;
}

/** Highest total wins; an exact tie (within 1e-4) is a draw (undefined). */
export function determineWinner(scores: Array<{ userId: string; total: number }>): string | undefined {
  if (scores.length === 0) return undefined;
  const sorted = [...scores].sort((a, b) => b.total - a.total);
  if (sorted.length === 1) return sorted[0].userId;
  if (Math.abs(sorted[0].total - sorted[1].total) < 0.0001) return undefined;
  return sorted[0].userId;
}

/** When a player solves the problem the opponent's clock shrinks to at most SUDDEN_DEATH_MS. */
export function deadlineAfterSolve(currentEndsAt: Date, now: Date = new Date(), suddenDeathMs: number = SUDDEN_DEATH_MS): Date {
  const capped = now.getTime() + suddenDeathMs;
  return capped < currentEndsAt.getTime() ? new Date(capped) : currentEndsAt;
}

export interface RatingChange {
  userId: string;
  oldRating: number;
  newRating: number;
  delta: number;
  win: boolean;
  loss: boolean;
}

/** Elo + win/loss bookkeeping for a 1v1 given the winner (undefined = draw). */
export function computeRatingChanges(
  playerA: { userId: string; rating: number },
  playerB: { userId: string; rating: number },
  winnerId: string | undefined
): [RatingChange, RatingChange] {
  const outcomeA: 0 | 0.5 | 1 = winnerId === undefined ? 0.5 : winnerId === playerA.userId ? 1 : 0;
  const { newRatingA, newRatingB } = updateElo(playerA.rating, playerB.rating, outcomeA);
  return [
    {
      userId: playerA.userId,
      oldRating: playerA.rating,
      newRating: newRatingA,
      delta: newRatingA - playerA.rating,
      win: outcomeA === 1,
      loss: outcomeA === 0,
    },
    {
      userId: playerB.userId,
      oldRating: playerB.rating,
      newRating: newRatingB,
      delta: newRatingB - playerB.rating,
      win: outcomeA === 0,
      loss: outcomeA === 1,
    },
  ];
}
