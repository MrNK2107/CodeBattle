import { describe, expect, it } from 'vitest';

import { canSeeBattleCode, replayFramesFor } from './battleAccess';

const players = [{ userId: 'alice' }, { userId: 'bob' }];
const raw = [
  { t: 1_000, code: 'def solve():', language: 'python' },
  { t: 9_000, code: 'def solve():\n    return 42', language: 'python', submitted: true },
];

describe('canSeeBattleCode', () => {
  it('only the two participants may read the code', () => {
    expect(canSeeBattleCode(players, 'alice')).toBe(true);
    expect(canSeeBattleCode(players, 'bob')).toBe(true);
    expect(canSeeBattleCode(players, 'mallory')).toBe(false);
    expect(canSeeBattleCode(players, undefined)).toBe(false);
  });
});

describe('replayFramesFor', () => {
  it('participants get the snapshots', () => {
    expect(replayFramesFor(raw, true)[1].code).toContain('return 42');
  });

  it('other viewers get the timeline only', () => {
    const frames = replayFramesFor(raw, false);
    expect(frames.map(f => f.t)).toEqual([1_000, 9_000]);
    expect(JSON.stringify(frames)).not.toContain('solve');
    expect(frames[1]).toMatchObject({ lines: 2, submitted: true });
  });
});
