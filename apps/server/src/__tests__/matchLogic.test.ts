import { describe, expect, it } from 'vitest';
import {
  QUEUE_TIMEOUT_MS,
  computeRatingChanges,
  currentRange,
  deadlineAfterSolve,
  determineWinner,
  matchDurationSeconds,
  pickClosestCandidate,
  resolveDifficulty,
} from '../services/matchLogic';

type Choice = 'EASY' | 'MEDIUM' | 'HARD' | 'ANY';
const entry = (userId: string, rating: number, joinedAt = 0, difficulty: Choice = 'ANY') => ({ userId, rating, joinedAt, difficulty });

describe('matchmaking window', () => {
  it('starts at 100, widens every 15s, opens fully after 45s and times out', () => {
    expect(currentRange(0, 0)).toBe(100);
    expect(currentRange(0, 15_000)).toBe(200);
    expect(currentRange(0, 44_999)).toBe(300);
    expect(currentRange(0, 45_000)).toBe(Number.POSITIVE_INFINITY);
    expect(currentRange(0, QUEUE_TIMEOUT_MS)).toBeNull();
  });

  it('picks the closest compatible candidate that both windows allow', () => {
    const me = entry('me', 1200);
    expect(pickClosestCandidate(me, [entry('far', 1290), entry('near', 1230), entry('me', 1200)], 0)?.userId).toBe('near');
    expect(pickClosestCandidate(me, [entry('out', 1400)], 0)).toBeNull();
    // a newcomer's narrow window also limits the pairing
    expect(pickClosestCandidate(entry('me', 1200, -60_000), [entry('new', 1500, 0)], 0)).toBeNull();
  });

  it('respects difficulty choices', () => {
    expect(pickClosestCandidate(entry('a', 1200, 0, 'EASY'), [entry('b', 1200, 0, 'HARD')], 0)).toBeNull();
    expect(pickClosestCandidate(entry('a', 1200, 0, 'EASY'), [entry('b', 1200, 0, 'ANY')], 0)?.userId).toBe('b');
  });

  it('resolves ANY against a concrete choice', () => {
    expect(resolveDifficulty('EASY', 'ANY')).toBe('EASY');
    expect(resolveDifficulty('ANY', 'HARD')).toBe('HARD');
    expect(resolveDifficulty('ANY', 'ANY', () => 0.99)).toBe('HARD');
  });
});

describe('match rules', () => {
  it('durations depend on difficulty unless overridden', () => {
    expect(matchDurationSeconds('EASY', {})).toBe(900);
    expect(matchDurationSeconds('HARD', {})).toBe(2400);
    expect(matchDurationSeconds('HARD', { MATCH_DURATION_SECONDS: '30' })).toBe(30);
  });

  it('sudden death only ever moves the deadline earlier', () => {
    const now = new Date(1_000_000);
    expect(deadlineAfterSolve(new Date(10_000_000), now, 300_000).getTime()).toBe(1_300_000);
    expect(deadlineAfterSolve(new Date(1_100_000), now, 300_000).getTime()).toBe(1_100_000);
  });

  it('highest total wins; exact ties draw', () => {
    expect(determineWinner([{ userId: 'a', total: 50 }, { userId: 'b', total: 60 }])).toBe('b');
    expect(determineWinner([{ userId: 'a', total: 50 }, { userId: 'b', total: 50 }])).toBeUndefined();
    expect(determineWinner([])).toBeUndefined();
  });

  it('rating changes are symmetric with win/loss flags', () => {
    const [a, b] = computeRatingChanges({ userId: 'a', rating: 1200 }, { userId: 'b', rating: 1200 }, 'a');
    expect(a).toMatchObject({ oldRating: 1200, newRating: 1216, delta: 16, win: true, loss: false });
    expect(b).toMatchObject({ newRating: 1184, delta: -16, win: false, loss: true });
    const [c, d] = computeRatingChanges({ userId: 'a', rating: 1200 }, { userId: 'b', rating: 1200 }, undefined);
    expect(c.delta).toBe(0);
    expect(d.win || d.loss).toBe(false);
  });
});
