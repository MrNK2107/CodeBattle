import { ScoreBreakdown } from '@codebattle/shared';

export interface ScoringInput {
  passedHiddenTests: number;
  totalHiddenTests: number;
  submissionTimeSeconds: number;
  matchDurationSeconds: number;
  playerRuntimeMs?: number;
  optimalRuntimeMs?: number;
  playerMemoryKb?: number;
  optimalMemoryKb?: number;
  typing: {
    wpm: number;
    variance: number;
    backspaceRate: number;
  };
  qualityScore: number;
}

export function computeScore(input: ScoringInput): { total: number; breakdown: ScoreBreakdown } {
  const correctness = computeCorrectness(input.passedHiddenTests, input.totalHiddenTests);
  const speed = computeSpeed(input.submissionTimeSeconds, input.matchDurationSeconds);
  const efficiency = computeEfficiency(input.playerRuntimeMs, input.optimalRuntimeMs, input.playerMemoryKb, input.optimalMemoryKb);
  const typing = computeTyping(input.typing.wpm, input.typing.variance, input.typing.backspaceRate);
  const quality = clamp(input.qualityScore, 0, 100);

  const breakdown: ScoreBreakdown = { correctness, speed, efficiency, typing, quality };
  const total = correctness * 0.35 + speed * 0.25 + efficiency * 0.2 + typing * 0.12 + quality * 0.08;

  return { total, breakdown };
}

export function computeCorrectness(passed: number, total: number): number {
  if (total === 0) return 0;
  return clamp((passed / total) * 100, 0, 100);
}

export function computeSpeed(submissionTimeSeconds: number, matchDurationSeconds: number): number {
  if (matchDurationSeconds === 0) return 0;
  const score = 100 - (submissionTimeSeconds / matchDurationSeconds) * 100;
  return clamp(score, 0, 100);
}

export function computeEfficiency(
  playerRuntimeMs?: number,
  optimalRuntimeMs?: number,
  playerMemoryKb?: number,
  optimalMemoryKb?: number
): number {
  if (!playerRuntimeMs || !optimalRuntimeMs || !playerMemoryKb || !optimalMemoryKb) return 0;
  const runtimeScore = clamp(100 - ((playerRuntimeMs / optimalRuntimeMs - 1) * 50), 0, 100);
  const memoryScore = clamp(100 - ((playerMemoryKb / optimalMemoryKb - 1) * 50), 0, 100);
  return runtimeScore * 0.6 + memoryScore * 0.4;
}

export function computeTyping(wpm: number, variance: number, backspaceRate: number): number {
  const wpmScore = clamp((wpm / 150) * 100, 0, 100);
  const varianceScore = clamp(100 - variance, 0, 100);
  const backspaceScore = clamp(100 - backspaceRate * 200, 0, 100);
  return wpmScore * 0.4 + varianceScore * 0.3 + backspaceScore * 0.3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
