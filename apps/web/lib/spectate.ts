import type {
  MatchEndedPayload,
  SpectatePlayer,
  SpectateStatePayload,
  SpectateUpdatePayload,
  SubmissionStatus,
} from '@codebattle/shared';

import { VERDICT_LABEL } from './format';

// Spectator view state: the server's snapshot plus every live update, folded into
// two player cards and a short play-by-play feed.

export interface FeedItem {
  id: number;
  at: number;
  /** 0 or 1: which corner the event belongs to, null for match events */
  side: 0 | 1 | null;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
}

export interface WatchState {
  loaded: boolean;
  status: SpectateStatePayload['status'];
  mode: SpectateStatePayload['mode'] | null;
  startedAt: string | null;
  endsAt: string | null;
  suddenDeath: boolean;
  players: SpectatePlayer[];
  watchers: number;
  feed: FeedItem[];
  winnerId: string | null;
  endReason: MatchEndedPayload['reason'] | 'cancelled' | null;
}

export type WatchEvent =
  | { type: 'state'; payload: SpectateStatePayload }
  | { type: 'update'; payload: SpectateUpdatePayload }
  | { type: 'started'; startedAt: string; endsAt: string; at: number }
  | { type: 'deadline'; endsAt: string; at: number }
  | { type: 'ended'; payload: MatchEndedPayload; at: number }
  | { type: 'cancelled'; at: number };

export const FEED_LIMIT = 30;

export const initialWatchState: WatchState = {
  loaded: false,
  status: 'WAITING',
  mode: null,
  startedAt: null,
  endsAt: null,
  suddenDeath: false,
  players: [],
  watchers: 0,
  feed: [],
  winnerId: null,
  endReason: null,
};

let feedSeq = 0;

function push(state: WatchState, item: Omit<FeedItem, 'id'>): FeedItem[] {
  return [{ ...item, id: ++feedSeq }, ...state.feed].slice(0, FEED_LIMIT);
}

function verdictText(name: string, verdict: SubmissionStatus, passed?: number | null, total?: number | null): string {
  if (verdict === 'PENDING') return `${name} submitted. Judging on the hidden tests…`;
  const counts = passed != null && total != null ? `, ${passed}/${total} hidden tests` : '';
  return `${name}: ${VERDICT_LABEL[verdict]}${counts}`;
}

export function watchReducer(state: WatchState, event: WatchEvent): WatchState {
  switch (event.type) {
    case 'state': {
      const p = event.payload;
      return {
        ...state,
        loaded: true,
        status: p.status,
        mode: p.mode,
        startedAt: p.startedAt ?? null,
        endsAt: p.endsAt ?? null,
        players: p.players,
        watchers: p.watchers,
      };
    }
    case 'update': {
      const u = event.payload;
      const index = state.players.findIndex(p => p.userId === u.userId);
      if (index === -1) return state;
      const before = state.players[index];
      const after: SpectatePlayer = {
        ...before,
        connected: u.connected ?? (u.status ? true : before.connected),
        status: u.status ?? before.status,
        passed: u.passed ?? before.passed,
        total: u.total ?? before.total,
        verdict: u.verdict ?? before.verdict,
        hiddenPassed: u.hiddenPassed ?? before.hiddenPassed,
        hiddenTotal: u.hiddenTotal ?? before.hiddenTotal,
      };
      const players = state.players.map((p, i) => (i === index ? after : p));
      const side = index === 0 ? 0 : 1;
      const name = before.username;
      let feed = state.feed;
      if (u.verdict) {
        feed = push(state, {
          at: u.at,
          side,
          text: verdictText(name, u.verdict, u.hiddenPassed, u.hiddenTotal),
          tone: u.verdict === 'PENDING' ? 'neutral' : u.verdict === 'ACCEPTED' ? 'good' : 'bad',
        });
      } else if (u.passed != null && u.total != null) {
        feed = push(state, { at: u.at, side, text: `${name} passes ${u.passed}/${u.total} examples`, tone: u.passed === u.total ? 'good' : 'neutral' });
      } else if (u.status === 'running' && before.status !== 'running') {
        feed = push(state, { at: u.at, side, text: `${name} is running the examples`, tone: 'neutral' });
      } else if (u.status === 'forfeited') {
        feed = push(state, { at: u.at, side, text: `${name} forfeited`, tone: 'bad' });
      } else if (u.connected === false && before.connected) {
        feed = push(state, { at: u.at, side, text: `${name} disconnected`, tone: 'bad' });
      } else if (u.connected === true && !before.connected) {
        feed = push(state, { at: u.at, side, text: `${name} is in the arena`, tone: 'neutral' });
      } else if (u.status === 'typing' && before.status === null) {
        feed = push(state, { at: u.at, side, text: `${name} started typing`, tone: 'neutral' });
      }
      return { ...state, players, feed };
    }
    case 'started':
      return {
        ...state,
        status: 'ACTIVE',
        startedAt: event.startedAt,
        endsAt: event.endsAt,
        feed: push(state, { at: event.at, side: null, text: 'Both players are in. The clock is running.', tone: 'neutral' }),
      };
    case 'deadline':
      return {
        ...state,
        endsAt: event.endsAt,
        suddenDeath: true,
        feed: push(state, { at: event.at, side: null, text: 'Sudden death: the problem is solved, at most 5 minutes left.', tone: 'neutral' }),
      };
    case 'ended': {
      const winner = state.players.find(p => p.userId === event.payload.winnerId);
      return {
        ...state,
        status: 'COMPLETED',
        winnerId: event.payload.winnerId ?? null,
        endReason: event.payload.reason,
        feed: push(state, { at: event.at, side: null, text: winner ? `Battle over. ${winner.username} wins.` : 'Battle over. It is a draw.', tone: 'good' }),
      };
    }
    case 'cancelled':
      return {
        ...state,
        status: 'ABANDONED',
        endReason: 'cancelled',
        feed: push(state, { at: event.at, side: null, text: 'Cancelled: a player never showed up.', tone: 'bad' }),
      };
  }
}

/** Short live state for a player card. */
export function playerStateLabel(p: SpectatePlayer): string {
  if (!p.connected && p.status !== 'submitted') return 'Disconnected';
  if (p.verdict && p.verdict !== 'PENDING') return VERDICT_LABEL[p.verdict];
  if (p.verdict === 'PENDING') return 'Judging';
  switch (p.status) {
    case 'running':
      return 'Running examples';
    case 'typing':
      return 'Coding';
    case 'submitted':
      return 'Submitted';
    case 'forfeited':
      return 'Forfeited';
    default:
      return 'Reading the problem';
  }
}
