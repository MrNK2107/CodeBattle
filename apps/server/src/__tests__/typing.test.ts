import { describe, expect, it } from 'vitest';
import { computeTypingMetrics, normalizeBatch, type StoredTypingEvent } from '../services/typing';

describe('normalizeBatch', () => {
  it('re-anchors client timestamps to the server clock and drops impossible bursts', () => {
    const events = [
      { t: 100, k: 'char' as const },
      { t: 300, k: 'backspace' as const },
      { t: 310, k: 'char' as const }, // 10ms after the previous key: dropped
      { t: 500, k: 'other' as const },
    ];
    expect(normalizeBatch(events, 10_000)).toEqual([
      [9600, 0],
      [9800, 1],
      [10_000, 2],
    ]);
    expect(normalizeBatch([], 5)).toEqual([]);
  });
});

describe('computeTypingMetrics', () => {
  it('needs at least two keys', () => {
    expect(computeTypingMetrics([]).wpm).toBe(0);
    expect(computeTypingMetrics([[0, 0]]).wpm).toBe(0);
  });

  it('measures speed over active time only', () => {
    // 300 chars at 200ms spacing = ~60s active -> ~60 wpm, a long pause, then 300 more
    const events: StoredTypingEvent[] = [];
    let t = 0;
    for (let i = 0; i < 300; i++) events.push([(t += 200), 0]);
    t += 120_000;
    for (let i = 0; i < 300; i++) events.push([(t += 200), 0]);
    const m = computeTypingMetrics(events);
    expect(m.wpm).toBeGreaterThan(59);
    expect(m.wpm).toBeLessThan(61);
    expect(m.burstCount).toBe(2);
    expect(m.avgPauseMs).toBeGreaterThan(100_000);
    expect(m.backspaceRate).toBe(0);
  });

  it('counts backspaces against accuracy and ignores navigation keys', () => {
    const events: StoredTypingEvent[] = [[0, 0], [200, 1], [400, 0], [600, 2], [800, 1]];
    expect(computeTypingMetrics(events).backspaceRate).toBe(0.5);
  });
});
