import type { SpectatePlayer, SpectateStatePayload } from '@codebattle/shared';
import { describe, expect, it } from 'vitest';

import { FEED_LIMIT, initialWatchState, playerStateLabel, watchReducer, type WatchState } from './spectate';

const player = (userId: string, username: string, over: Partial<SpectatePlayer> = {}): SpectatePlayer => ({
  userId,
  username,
  rating: 1300,
  connected: true,
  status: null,
  passed: null,
  total: null,
  verdict: null,
  hiddenPassed: null,
  hiddenTotal: null,
  ...over,
});

const snapshot: SpectateStatePayload = {
  matchId: 'm1',
  status: 'ACTIVE',
  mode: 'RANKED',
  question: { title: 'Two Sum', slug: 'two-sum', difficulty: 'EASY' },
  startedAt: '2026-11-02T10:00:00.000Z',
  endsAt: '2026-11-02T10:15:00.000Z',
  players: [player('a', 'ada'), player('b', 'linus')],
  watchers: 2,
};

const loaded = (): WatchState => watchReducer(initialWatchState, { type: 'state', payload: snapshot });
const update = (state: WatchState, payload: Record<string, unknown>) =>
  watchReducer(state, { type: 'update', payload: { matchId: 'm1', at: 1, ...payload } as never });

describe('watchReducer', () => {
  it('loads the server snapshot', () => {
    const s = loaded();
    expect(s).toMatchObject({ loaded: true, status: 'ACTIVE', mode: 'RANKED', watchers: 2, endsAt: snapshot.endsAt });
    expect(s.players.map(p => p.username)).toEqual(['ada', 'linus']);
    expect(s.feed).toEqual([]);
  });

  it('turns a run into example progress and a feed line on the right side', () => {
    let s = update(loaded(), { userId: 'b', status: 'running' });
    s = update(s, { userId: 'b', status: 'typing', passed: 2, total: 3 });
    expect(s.players[1]).toMatchObject({ status: 'typing', passed: 2, total: 3 });
    expect(s.feed.map(f => [f.side, f.text])).toEqual([
      [1, 'linus passes 2/3 examples'],
      [1, 'linus is running the examples'],
    ]);
  });

  it('reports submissions and verdicts with hidden-test counts', () => {
    let s = update(loaded(), { userId: 'a', status: 'submitted', verdict: 'PENDING', hiddenTotal: 14 });
    expect(s.feed[0]).toMatchObject({ side: 0, text: 'ada submitted. Judging on the hidden tests…', tone: 'neutral' });
    s = update(s, { userId: 'a', status: 'submitted', verdict: 'ACCEPTED', hiddenPassed: 14, hiddenTotal: 14 });
    expect(s.feed[0]).toMatchObject({ text: 'ada: Accepted, 14/14 hidden tests', tone: 'good' });
    expect(playerStateLabel(s.players[0])).toBe('Accepted');
  });

  it('only notes the first keystroke, not every typing batch', () => {
    let s = update(loaded(), { userId: 'a', status: 'typing' });
    s = update(s, { userId: 'a', status: 'typing' });
    s = update(s, { userId: 'a', status: 'typing' });
    expect(s.feed.map(f => f.text)).toEqual(['ada started typing']);
  });

  it('tracks disconnects and reconnects', () => {
    let s = update(loaded(), { userId: 'b', connected: false });
    expect(playerStateLabel(s.players[1])).toBe('Disconnected');
    s = update(s, { userId: 'b', connected: true });
    expect(s.feed.map(f => f.text)).toEqual(['linus is in the arena', 'linus disconnected']);
  });

  it('ignores updates for someone not in the match', () => {
    const s = loaded();
    expect(update(s, { userId: 'eve', status: 'typing' })).toBe(s);
  });

  it('handles sudden death, the end and cancellation', () => {
    let s = watchReducer(loaded(), { type: 'deadline', endsAt: '2026-11-02T10:08:00.000Z', at: 5 });
    expect(s).toMatchObject({ suddenDeath: true, endsAt: '2026-11-02T10:08:00.000Z' });
    s = watchReducer(s, { type: 'ended', payload: { matchId: 'm1', winnerId: 'a', scores: [], reason: 'completed' }, at: 6 });
    expect(s).toMatchObject({ status: 'COMPLETED', winnerId: 'a', endReason: 'completed' });
    expect(s.feed[0].text).toBe('Battle over. ada wins.');
    const draw = watchReducer(loaded(), { type: 'ended', payload: { matchId: 'm1', scores: [], reason: 'timeout' }, at: 6 });
    expect(draw.feed[0].text).toBe('Battle over. It is a draw.');
    expect(watchReducer(loaded(), { type: 'cancelled', at: 1 }).status).toBe('ABANDONED');
  });

  it('keeps the feed bounded, newest first', () => {
    let s = loaded();
    for (let i = 0; i < FEED_LIMIT + 10; i++) s = update(s, { userId: 'a', passed: i % 3, total: 3 });
    expect(s.feed).toHaveLength(FEED_LIMIT);
    expect(s.feed[0].id).toBeGreaterThan(s.feed[1].id);
  });

  it('labels each live state', () => {
    expect(playerStateLabel(player('a', 'ada'))).toBe('Reading the problem');
    expect(playerStateLabel(player('a', 'ada', { status: 'running' }))).toBe('Running examples');
    expect(playerStateLabel(player('a', 'ada', { status: 'submitted', verdict: 'PENDING' }))).toBe('Judging');
    expect(playerStateLabel(player('a', 'ada', { status: 'forfeited' }))).toBe('Forfeited');
  });
});
