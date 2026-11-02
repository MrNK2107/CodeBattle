import { describe, expect, it } from 'vitest';
import { updateElo } from '../services/elo';

describe('updateElo', () => {
  it('gives equal players a 50/50 expectation', () => {
    const r = updateElo(1200, 1200, 1);
    expect(r.expectedA).toBeCloseTo(0.5);
    expect(r.expectedB).toBeCloseTo(0.5);
  });

  it('moves equal players by k/2 on a decisive result', () => {
    expect(updateElo(1200, 1200, 1)).toMatchObject({ newRatingA: 1216, newRatingB: 1184 });
    expect(updateElo(1200, 1200, 0)).toMatchObject({ newRatingA: 1184, newRatingB: 1216 });
  });

  it('leaves equal players unchanged on a draw', () => {
    expect(updateElo(1500, 1500, 0.5)).toMatchObject({ newRatingA: 1500, newRatingB: 1500 });
  });

  it('is zero-sum (before rounding drift) for any outcome', () => {
    for (const outcome of [0, 0.5, 1] as const) {
      const r = updateElo(1350, 1180, outcome);
      expect(Math.abs(r.newRatingA + r.newRatingB - (1350 + 1180))).toBeLessThanOrEqual(1);
    }
  });

  it('rewards an upset more than an expected win', () => {
    const upset = updateElo(1000, 1400, 1);
    const expected = updateElo(1400, 1000, 1);
    expect(upset.newRatingA - 1000).toBeGreaterThan(expected.newRatingA - 1400);
    expect(upset.expectedA).toBeCloseTo(1 / (1 + 10), 5);
  });

  it('respects a custom k-factor', () => {
    expect(updateElo(1200, 1200, 1, 16).newRatingA).toBe(1208);
  });
});
