"use client";

import type { MatchEndedPayload, SpectateStatePayload, SpectateUpdatePayload } from '@codebattle/shared';
import Link from 'next/link';
import { useEffect, useReducer, useState } from 'react';

import { getBattleSocket } from '@/lib/socket';
import { initialWatchState, playerStateLabel, watchReducer } from '@/lib/spectate';

import { VersusBar } from './VersusBar';

/** Watch a live battle: both corners' progress, verdicts and a play-by-play. No code is ever sent here. */
export function SpectatorView({ matchId }: { matchId: string }): JSX.Element {
  const [state, dispatch] = useReducer(watchReducer, initialWatchState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false; // the effect can be cleaned up before the socket promise resolves
    getBattleSocket()
      .then(({ socket }) => {
        if (cancelled) return;
        const onState = (p: SpectateStatePayload) => p.matchId === matchId && dispatch({ type: 'state', payload: p });
        const onUpdate = (p: SpectateUpdatePayload) => p.matchId === matchId && dispatch({ type: 'update', payload: p });
        const onStarted = (p: { matchId: string; startedAt: string; endsAt: string }) =>
          p.matchId === matchId && dispatch({ type: 'started', startedAt: p.startedAt, endsAt: p.endsAt, at: Date.now() });
        const onDeadline = (p: { matchId: string; endsAt: string }) => p.matchId === matchId && dispatch({ type: 'deadline', endsAt: p.endsAt, at: Date.now() });
        const onEnded = (p: MatchEndedPayload) => p.matchId === matchId && dispatch({ type: 'ended', payload: p, at: Date.now() });
        const onCancelled = (p: { matchId: string }) => p.matchId === matchId && dispatch({ type: 'cancelled', at: Date.now() });
        const onError = (e: { code: string; message: string }) => setError(e.code === 'NOT_FOUND' ? 'This battle does not exist.' : e.message);
        // re-join the spectator room after a reconnect
        const watch = () => socket.emit('battle:spectate', { matchId });

        socket.on('spectate:state', onState);
        socket.on('spectate:update', onUpdate);
        socket.on('match:started', onStarted);
        socket.on('match:deadline', onDeadline);
        socket.on('match:ended', onEnded);
        socket.on('match:cancelled', onCancelled);
        socket.on('error', onError);
        socket.on('connect', watch);
        if (socket.connected) watch();
        off = () => {
          socket.off('spectate:state', onState);
          socket.off('spectate:update', onUpdate);
          socket.off('match:started', onStarted);
          socket.off('match:deadline', onDeadline);
          socket.off('match:ended', onEnded);
          socket.off('match:cancelled', onCancelled);
          socket.off('error', onError);
          socket.off('connect', watch);
        };
      })
      .catch(() => setError('Sign in to watch battles.'));
    return () => {
      cancelled = true;
      off?.();
    };
  }, [matchId]);

  const [a, b] = state.players;
  const over = state.status === 'COMPLETED' || state.status === 'ABANDONED';
  const winner = state.players.find(p => p.userId === state.winnerId);

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-md border border-fail/40 bg-fail/10 px-4 py-2 text-sm text-fail">
          {error}
        </p>
      ) : null}

      {a && b ? (
        <VersusBar
          you={{ name: a.username, rating: a.rating, state: playerStateLabel(a), progress: a.total ? { passed: a.passed ?? 0, total: a.total } : null, online: a.connected }}
          rival={{ name: b.username, rating: b.rating, state: playerStateLabel(b), progress: b.total ? { passed: b.passed ?? 0, total: b.total } : null, online: b.connected }}
          endsAt={over ? null : state.endsAt}
          readyDeadline={null}
          suddenDeath={state.suddenDeath}
        />
      ) : (
        <div className="panel grid h-24 place-items-center text-sm text-muted">{error ? 'Nothing to watch.' : 'Connecting to the arena…'}</div>
      )}

      {over ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-display text-2xl font-bold uppercase">
            {state.status === 'ABANDONED' ? 'Cancelled' : winner ? `${winner.username} wins` : 'Draw'}
          </p>
          {state.status === 'COMPLETED' ? (
            <div className="flex gap-2">
              <Link className="btn-primary" href={`/battle/${matchId}/results`}>
                See the scorecard
              </Link>
              <Link className="btn-quiet" href={`/battle/${matchId}/replay`}>
                Watch the replay
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="panel space-y-4 p-5" aria-label="Scorecard so far">
          <p className="kicker">Tale of the tape</p>
          {[a, b].map((p, i) =>
            p ? (
              <div key={p.userId} className="space-y-1.5">
                <p className={`font-display font-semibold ${i === 0 ? 'text-you' : 'text-rival'}`}>{p.username}</p>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-faint">Examples</dt>
                    <dd className="tabular-nums">{p.total ? `${p.passed ?? 0}/${p.total}` : '–'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-faint">Final answer</dt>
                    <dd>{p.verdict ? playerStateLabel({ ...p, connected: true }) : '–'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-faint">Hidden tests</dt>
                    <dd className="tabular-nums">{p.hiddenPassed != null && p.hiddenTotal ? `${p.hiddenPassed}/${p.hiddenTotal}` : '–'}</dd>
                  </div>
                </dl>
              </div>
            ) : null,
          )}
          <p className="border-t border-line pt-3 text-xs text-faint">
            Spectators see progress and verdicts only. Code appears in the replay once the battle is over.
            {state.watchers > 1 ? ` ${state.watchers} watching.` : ''}
          </p>
        </section>

        <section className="panel p-5" aria-label="Play-by-play" aria-live="polite">
          <p className="kicker mb-3">Play-by-play</p>
          {state.feed.length ? (
            <ol className="space-y-2 text-sm">
              {state.feed.map(item => (
                <li key={item.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.side === 0 ? 'bg-you' : item.side === 1 ? 'bg-rival' : 'bg-muted'}`}
                  />
                  <span className={item.tone === 'good' ? 'text-pass' : item.tone === 'bad' ? 'text-fail' : 'text-text'}>{item.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">{state.loaded ? 'Waiting for the next move…' : 'Connecting…'}</p>
          )}
        </section>
      </div>
    </div>
  );
}
