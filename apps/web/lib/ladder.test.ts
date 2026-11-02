import { describe, expect, it } from 'vitest';

import { STEPS, TIERS, ladderMove, standingFor, tierDistribution } from './ladder';

describe('ladder', () => {
  it('a new player (1200) starts in Silver I, 50 points from Gold III', () => {
    const s = standingFor(1200);
    expect(s.label).toBe('Silver I');
    expect(s.nextLabel).toBe('Gold III');
    expect(s.toNext).toBe(50);
    expect(s.progress).toBeGreaterThan(0);
    expect(s.progress).toBeLessThan(1);
  });

  it('tier floors land in division III of that tier', () => {
    for (const tier of TIERS.slice(1)) {
      const s = standingFor(tier.floor);
      expect(s.tier.id).toBe(tier.id);
      expect(s.division).toBe(tier.divisions ? 'III' : null);
      expect(standingFor(tier.floor - 1).tier.id).not.toBe(tier.id);
    }
  });

  it('steps are strictly increasing and cover every tier', () => {
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i].floor).toBeGreaterThan(STEPS[i - 1].floor);
    expect(STEPS).toHaveLength(5 * 3 + 2);
    expect(new Set(STEPS.map(s => s.tier.id)).size).toBe(TIERS.length);
  });

  it('labels every division in order within a tier', () => {
    expect(standingFor(1250).label).toBe('Gold III');
    expect(standingFor(1300).label).toBe('Gold II');
    expect(standingFor(1399).label).toBe('Gold I');
    expect(standingFor(1400).label).toBe('Platinum III');
  });

  it('the top of the ladder has no next step and full progress', () => {
    const s = standingFor(2400);
    expect(s.label).toBe('Grandmaster');
    expect(s.nextAt).toBeNull();
    expect(s.progress).toBe(1);
    expect(s.toNext).toBe(0);
  });

  it('the open-ended bottom rung still shows sensible progress', () => {
    expect(standingFor(0).label).toBe('Bronze III');
    expect(standingFor(-50).progress).toBe(0);
    expect(standingFor(925).progress).toBeCloseTo(0.5);
    expect(standingFor(Number.NaN).label).toBe('Bronze III');
  });

  it('progress is monotonic inside a step', () => {
    expect(standingFor(1310).progress).toBeLessThan(standingFor(1340).progress);
  });

  it('classifies rating changes', () => {
    expect(ladderMove(1200, 1212)).toBe('same');
    expect(ladderMove(1240, 1262)).toBe('tier-up');
    expect(ladderMove(1290, 1305)).toBe('promoted');
    expect(ladderMove(1305, 1290)).toBe('demoted');
    expect(ladderMove(1255, 1240)).toBe('tier-down');
  });

  it('counts players per tier', () => {
    const dist = tierDistribution([1200, 1210, 1300, 2100]);
    expect(dist.map(d => d.count)).toEqual([0, 2, 1, 0, 0, 0, 1]);
    expect(dist[1].share).toBeCloseTo(0.5);
    expect(tierDistribution([]).every(d => d.count === 0 && d.share === 0)).toBe(true);
  });
});
