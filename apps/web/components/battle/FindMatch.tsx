"use client";

import type { MatchFoundPayload, QueueDifficulty, QueueStatusPayload } from '@codebattle/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatClock } from '@/lib/format';
import { getBattleSocket, type BattleSocket } from '@/lib/socket';

export const DIFFICULTY_CHOICES: Array<{ value: QueueDifficulty; label: string }> = [
  { value: 'ANY', label: 'Any' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

type Phase = 'connecting' | 'idle' | 'searching' | 'found' | 'offline';

/** Shared socket hookup for lobby widgets: navigates to the battle on match:found. */
export function useLobbySocket(): { socket: BattleSocket | null; error: string | null } {
  const router = useRouter();
  const [socket, setSocket] = useState<BattleSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false; // cleaned up before the socket promise resolved: don't attach listeners
    getBattleSocket()
      .then(({ socket: s }) => {
        if (cancelled) return;
        setSocket(s);
        const onFound = (p: MatchFoundPayload) => router.push(`/battle/${p.matchId}`);
        const onConnectError = () => setError('Can’t reach the battle server. Check your connection; it retries automatically.');
        const onConnect = () => setError(null);
        s.on('match:found', onFound);
        s.on('connect_error', onConnectError);
        s.on('connect', onConnect);
        off = () => {
          s.off('match:found', onFound);
          s.off('connect_error', onConnectError);
          s.off('connect', onConnect);
        };
      })
      .catch(() => setError('Your session expired. Sign in again to play.'));
    return () => {
      cancelled = true;
      off?.();
    };
  }, [router]);
  return { socket, error };
}

export function FindMatch(): JSX.Element {
  const { socket, error: connectionError } = useLobbySocket();
  const [difficulty, setDifficulty] = useState<QueueDifficulty>('ANY');
  const [phase, setPhase] = useState<Phase>('connecting');
  const [message, setMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [status, setStatus] = useState<QueueStatusPayload | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!socket) return;
    const sync = () => setPhase(p => (socket.connected ? (p === 'connecting' || p === 'offline' ? 'idle' : p) : 'offline'));
    sync();
    const onStatus = (p: QueueStatusPayload) => setStatus(p);
    const onTimeout = () => {
      setPhase('idle');
      setMessage('Nobody near your rating is searching right now. Try “Any” difficulty, challenge a friend, or practice while you wait.');
    };
    const onError = (e: { code: string; message: string }) => {
      if (['IN_MATCH', 'NOT_FOUND', 'SERVER_ERROR', 'VALIDATION_ERROR'].includes(e.code)) {
        setPhase('idle');
        setMessage(e.message);
      }
    };
    const onFound = () => setPhase('found');
    const onDisconnect = () => setPhase('offline');
    socket.on('connect', sync);
    socket.on('disconnect', onDisconnect);
    socket.on('queue:status', onStatus);
    socket.on('queue:timeout', onTimeout);
    socket.on('error', onError);
    socket.on('match:found', onFound);
    return () => {
      socket.off('connect', sync);
      socket.off('disconnect', onDisconnect);
      socket.off('queue:status', onStatus);
      socket.off('queue:timeout', onTimeout);
      socket.off('error', onError);
      socket.off('match:found', onFound);
    };
  }, [socket]);

  useEffect(() => {
    if (phase !== 'searching') return;
    const t = setInterval(() => tick(n => n + 1), 500);
    return () => clearInterval(t);
  }, [phase]);

  const join = () => {
    if (!socket) return;
    setMessage(null);
    setStatus(null);
    setStartedAt(Date.now());
    setPhase('searching');
    socket.emit('queue:join', { difficulty });
  };

  const leave = () => {
    socket?.emit('queue:leave');
    setPhase('idle');
  };

  const elapsed = phase === 'searching' ? (Date.now() - startedAt) / 1000 : 0;
  const rangeText = !status ? 'Looking for an opponent near your rating' : status.range < 0 ? 'Now open to any rating' : `Opponents within ${status.range} rating points`;

  return (
    <section className="panel space-y-4 p-5" aria-labelledby="find-title">
      <div>
        <h2 id="find-title" className="text-xl font-semibold">
          Ranked battle
        </h2>
        <p className="text-sm text-muted">Get paired with someone near your rating. Winning raises your rating, losing lowers it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTY_CHOICES.map(d => (
            <button key={d.value} type="button" role="radio" aria-checked={difficulty === d.value} disabled={phase === 'searching'} onClick={() => setDifficulty(d.value)}>
              {d.label}
            </button>
          ))}
        </div>
        {phase === 'searching' || phase === 'found' ? (
          <button type="button" className="btn-quiet" onClick={leave} disabled={phase === 'found'}>
            {phase === 'found' ? 'Opponent found' : 'Stop searching'}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={join} disabled={phase !== 'idle'}>
            {phase === 'connecting' ? 'Connecting…' : phase === 'offline' ? 'Reconnecting…' : 'Find a battle'}
          </button>
        )}
      </div>

      {phase === 'searching' ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="h-1 overflow-hidden rounded bg-raised">
            <div className="h-1 w-1/3 animate-sweep rounded bg-you" />
          </div>
          <p className="text-sm text-muted">
            <span className="font-display font-semibold text-text tabular-nums">{formatClock(elapsed)}</span> {rangeText}.
          </p>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {connectionError ? (
        <p className="text-sm text-fail" role="alert">
          {connectionError}
        </p>
      ) : null}
    </section>
  );
}
