import { describe, expect, it } from 'vitest';

import { countLines, ghostFramesForViewer, ghostStateAt, parseFrames, raceOutcome, rankGhosts } from './ghost';

const frames = parseFrames([
  { t: 20_000, code: 'def two_sum(nums, target):\n    seen = {}\n', language: 'python' },
  { t: 5_000, code: 'def two_sum(nums, target):\n', language: 'python' },
  { t: 60_000, code: 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        pass\n', language: 'python', submitted: true },
]);
const ghost = { frames, submitAtMs: 61_000, verdict: 'ACCEPTED' };

describe('parseFrames', () => {
  it('sorts frames and drops malformed entries', () => {
    expect(frames.map(f => f.t)).toEqual([5_000, 20_000, 60_000]);
    expect(parseFrames([{ t: 'x', code: '' }, null, { t: 1, code: 3 }, { t: Infinity, code: '' }])).toEqual([]);
    expect(parseFrames('nope')).toEqual([]);
    expect(parseFrames([{ t: -5, code: 'a' }])[0]).toMatchObject({ t: 0, language: 'unknown', submitted: false });
  });
});

describe('ghostStateAt', () => {
  it('waits before the first snapshot', () => {
    const s = ghostStateAt(ghost, 1_000);
    expect(s.phase).toBe('waiting');
    expect(s.code).toBe('');
    expect(s.progress).toBe(0);
    expect(s.submitsInMs).toBe(60_000);
  });

  it('shows the latest snapshot while typing, with growing progress', () => {
    const early = ghostStateAt(ghost, 6_000);
    const later = ghostStateAt(ghost, 30_000);
    expect(early.phase).toBe('typing');
    expect(early.lines).toBe(1);
    expect(later.lines).toBe(2);
    expect(later.progress).toBeGreaterThan(early.progress);
    expect(later.progress).toBeLessThan(1);
  });

  it('is submitted from the submit time on', () => {
    const s = ghostStateAt(ghost, 61_000);
    expect(s.phase).toBe('submitted');
    expect(s.progress).toBe(1);
    expect(s.lines).toBe(4);
    expect(s.submitsInMs).toBeNull();
  });

  it('never submits when the ghost had no submission', () => {
    const s = ghostStateAt({ frames, submitAtMs: null }, 10 * 60_000);
    expect(s.phase).toBe('typing');
    expect(s.submitsInMs).toBeNull();
  });

  it('shows the final code when the submission landed before any snapshot', () => {
    const s = ghostStateAt({ frames: parseFrames([{ t: 9_000, code: 'x = 1' }]), submitAtMs: 2_000 }, 3_000);
    expect(s.phase).toBe('submitted');
    expect(s.code).toBe('x = 1');
  });
});

describe('raceOutcome', () => {
  it('is pending while nobody has solved it', () => {
    expect(raceOutcome(ghost, 30_000, null)).toEqual({ kind: 'pending' });
  });

  it('you win by solving before the ghost', () => {
    expect(raceOutcome(ghost, 40_000, 40_000)).toEqual({ kind: 'won', marginMs: 21_000 });
  });

  it('the ghost wins once its accepted answer lands first', () => {
    expect(raceOutcome(ghost, 70_000, null)).toEqual({ kind: 'lost', marginMs: 9_000 });
    expect(raceOutcome(ghost, 90_000, 90_000)).toEqual({ kind: 'lost', marginMs: 29_000 });
  });

  it('a ghost that never solved it cannot win', () => {
    const failed = { submitAtMs: 30_000, verdict: 'WRONG_ANSWER' };
    expect(raceOutcome(failed, 100_000, null)).toEqual({ kind: 'pending' });
    expect(raceOutcome(failed, 100_000, 100_000)).toEqual({ kind: 'ghost-failed' });
  });
});

describe('rankGhosts', () => {
  it('suggests the fastest accepted ghost first and skips empty recordings', () => {
    const list = rankGhosts([
      { id: 'slow', frames, submitAtMs: 90_000, verdict: 'ACCEPTED' },
      { id: 'wrong', frames, submitAtMs: 10_000, verdict: 'WRONG_ANSWER' },
      { id: 'fast', frames, submitAtMs: 50_000, verdict: 'ACCEPTED' },
      { id: 'empty', frames: [], submitAtMs: 1_000, verdict: 'ACCEPTED' },
      { id: 'none', frames, submitAtMs: null, verdict: null },
    ]);
    expect(list.map(g => g.id)).toEqual(['fast', 'slow', 'wrong', 'none']);
  });

  it('counts non-blank lines', () => {
    expect(countLines('a\n\n  \nb\n')).toBe(2);
  });
});

describe('ghostFramesForViewer', () => {
  const raw = [
    { t: 5_000, code: 'def two_sum(nums, target):\n', language: 'python' },
    { t: 60_000, code: 'def two_sum(nums, target):\n    seen = {}\n    return []\n', language: 'python', submitted: true },
  ];

  it('sends only the timeline, never code, until the viewer has solved the problem', () => {
    const locked = ghostFramesForViewer(raw, false);
    expect(locked).toHaveLength(2);
    for (const f of locked) expect(f).not.toHaveProperty('code');
    expect(JSON.stringify(locked)).not.toContain('two_sum');
    expect(locked[1]).toMatchObject({ t: 60_000, lines: 3, language: 'python', submitted: true });
  });

  it('includes the code once the viewer has an accepted attempt', () => {
    const open = ghostFramesForViewer(raw, true);
    expect(open[1].code).toContain('return []');
  });

  it('a code-free timeline races exactly like the full recording', () => {
    const full = { frames: ghostFramesForViewer(raw, true), submitAtMs: 61_000 };
    const bare = { frames: ghostFramesForViewer(raw, false), submitAtMs: 61_000 };
    for (const t of [0, 6_000, 30_000, 60_500, 61_000]) {
      const a = ghostStateAt(full, t);
      const b = ghostStateAt(bare, t);
      expect(b).toEqual({ ...a, code: '' });
    }
  });
});
