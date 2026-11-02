import type { Language, ScoreBreakdown } from '@codebattle/shared';

export const WEIGHTS: ScoreBreakdown = { correctness: 0.35, speed: 0.25, efficiency: 0.2, typing: 0.12, quality: 0.08 };

/** Rough interpreter speed relative to JavaScript, so runtimes in different languages can be compared. */
export const LANGUAGE_SPEED_FACTOR: Record<Language, number> = { javascript: 1, java: 1, python: 4, cpp: 0.5 };

export interface TypingStats {
  wpm: number;
  /** coefficient of variation of per-minute typing speed (0 = perfectly steady) */
  variation: number;
  backspaceRate: number;
  /** share of the final code that was pasted in (0..1) */
  pastedRatio: number;
}

export interface PlayerPerformance {
  userId: string;
  /** undefined when the player never had a judged submission */
  submission?: {
    passed: number;
    total: number;
    secondsFromStart: number;
    /** time spent inside the player's function over all hidden tests */
    runtimeMs: number;
    language: Language;
    quality: number;
  };
  typing: TypingStats;
}

export interface PlayerScore {
  userId: string;
  total: number;
  breakdown: ScoreBreakdown;
}

const ZERO: ScoreBreakdown = { correctness: 0, speed: 0, efficiency: 0, typing: 0, quality: 0 };

/**
 * Scores every player of a match. Everything except correctness is scaled by
 * the share of hidden tests passed, so nothing can make up for a wrong answer.
 * Efficiency is relative: among fully correct solutions the fastest (after a
 * per-language speed factor) gets 100.
 */
export function computeMatchScores(players: PlayerPerformance[], matchDurationSeconds: number): PlayerScore[] {
  const normalizedRuntimes = players
    .filter(p => p.submission && p.submission.total > 0 && p.submission.passed === p.submission.total)
    .map(p => normalizedRuntime(p.submission!.runtimeMs, p.submission!.language));
  const fastest = normalizedRuntimes.length ? Math.min(...normalizedRuntimes) : 0;

  return players.map(player => {
    const sub = player.submission;
    if (!sub) return { userId: player.userId, total: 0, breakdown: { ...ZERO } };

    const correctness = computeCorrectness(sub.passed, sub.total);
    const gate = correctness / 100;
    const fullyCorrect = sub.total > 0 && sub.passed === sub.total;
    const efficiency = fullyCorrect
      ? computeRelativeEfficiency(normalizedRuntime(sub.runtimeMs, sub.language), fastest)
      : 50 * gate;
    const breakdown: ScoreBreakdown = {
      correctness,
      speed: computeSpeed(sub.secondsFromStart, matchDurationSeconds) * gate,
      efficiency,
      typing: computeTyping(player.typing) * gate,
      quality: clamp(sub.quality, 0, 100) * gate,
    };
    return { userId: player.userId, total: weightedTotal(breakdown), breakdown };
  });
}

export function weightedTotal(b: ScoreBreakdown): number {
  const total =
    b.correctness * WEIGHTS.correctness +
    b.speed * WEIGHTS.speed +
    b.efficiency * WEIGHTS.efficiency +
    b.typing * WEIGHTS.typing +
    b.quality * WEIGHTS.quality;
  return Math.round(total * 100) / 100;
}

export function computeCorrectness(passed: number, total: number): number {
  if (total === 0) return 0;
  return clamp((passed / total) * 100, 0, 100);
}

/** Linear from 100 (instant) to 0 (at the end of the match). */
export function computeSpeed(secondsFromStart: number, matchDurationSeconds: number): number {
  if (matchDurationSeconds <= 0) return 0;
  return clamp(100 - (secondsFromStart / matchDurationSeconds) * 100, 0, 100);
}

function normalizedRuntime(runtimeMs: number, language: Language): number {
  // sub-millisecond differences are noise
  return Math.max(runtimeMs, 1) / LANGUAGE_SPEED_FACTOR[language];
}

/** 100 for the fastest; each doubling of runtime costs 25 points (floor 10). Within 25% counts as a tie. */
export function computeRelativeEfficiency(runtime: number, fastest: number): number {
  if (fastest <= 0 || runtime <= fastest * 1.25) return 100;
  return clamp(100 - Math.log2(runtime / fastest) * 25, 10, 100);
}

/**
 * Rewards steady, deliberate typing over pasting: ~60 wpm of code is full
 * marks for pace. The result is scaled down by how much of the code was pasted.
 */
export function computeTyping(stats: TypingStats): number {
  if (stats.wpm <= 0) return 0;
  const pace = clamp((stats.wpm / 60) * 100, 0, 100);
  const consistency = clamp(100 - stats.variation * 100, 0, 100);
  const accuracy = clamp(100 - stats.backspaceRate * 200, 0, 100);
  const raw = pace * 0.5 + consistency * 0.25 + accuracy * 0.25;
  return raw * (1 - clamp(stats.pastedRatio, 0, 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
