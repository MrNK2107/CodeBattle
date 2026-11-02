"use client";

import { useEffect, useState } from 'react';

import { TierBadge } from '@/components/ladder/TierBadge';
import { formatClock } from '@/lib/format';

export interface Side {
  name: string;
  rating: number;
  /** short live state, e.g. "Typing", "Running examples", "Submitted" */
  state: string;
  /** visible examples passed in the latest run */
  progress: { passed: number; total: number } | null;
  online: boolean;
}

interface VersusBarProps {
  you: Side;
  rival: Side;
  endsAt: string | null;
  /** before the start: when the match is cancelled if someone doesn't show */
  readyDeadline: string | null;
  suddenDeath: boolean;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function VersusBar({ you, rival, endsAt, readyDeadline, suddenDeath }: VersusBarProps): JSX.Element {
  const now = useNow();
  const left = endsAt ? Math.max(0, (new Date(endsAt).getTime() - now) / 1000) : null;
  const urgent = left !== null && left <= 60;

  return (
    <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch overflow-hidden rounded-lg border border-line bg-panel shadow-[0_20px_60px_-30px_rgba(56,214,245,0.35)]">
      <span aria-hidden className="vs-slash opacity-40" />
      <PlayerSide side={you} align="left" />
      <div className="flex min-w-[7.5rem] flex-col items-center justify-center border-x border-line bg-well px-3 py-2 sm:min-w-[10rem]">
        {left !== null ? (
          <>
            <p
              className={`font-display text-3xl font-bold tabular-nums leading-none sm:text-4xl ${
                urgent ? 'animate-clock-pulse text-fail' : suddenDeath ? 'text-rival' : 'text-text'
              }`}
              role="timer"
              aria-label={`${Math.ceil(left)} seconds left`}
            >
              {formatClock(left)}
            </p>
            <p className="mt-1 text-[11px] text-muted">{suddenDeath ? 'Sudden death' : 'Time left'}</p>
          </>
        ) : (
          <>
            <p className="font-display text-xl font-semibold text-muted">Get ready</p>
            {readyDeadline ? (
              <p className="mt-1 text-[11px] text-muted">
                Waiting for both players ({formatClock(Math.max(0, (new Date(readyDeadline).getTime() - now) / 1000))})
              </p>
            ) : null}
          </>
        )}
      </div>
      <PlayerSide side={rival} align="right" />
    </div>
  );
}

function PlayerSide({ side, align }: { side: Side; align: 'left' | 'right' }): JSX.Element {
  const isYou = align === 'left';
  const color = isYou ? 'bg-you' : 'bg-rival';
  const text = isYou ? 'text-you' : 'text-rival';
  return (
    <div className={`relative flex min-w-0 flex-col justify-center gap-1.5 px-4 py-3 ${isYou ? 'items-start' : 'items-end text-right'}`}>
      <span aria-hidden className={`absolute inset-y-0 ${isYou ? 'left-0' : 'right-0'} w-1 ${color}`} />
      <div className={`flex min-w-0 items-baseline gap-2 ${isYou ? '' : 'flex-row-reverse'}`}>
        <p className="truncate font-display text-lg font-semibold">{side.name}</p>
        <p className={`font-display text-sm font-semibold ${text}`}>{side.rating}</p>
        <TierBadge rating={side.rating} className="hidden text-[11px] md:inline-flex" />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${side.online ? 'bg-pass' : 'bg-faint'}`} />
        {side.online ? side.state : 'Disconnected'}
      </p>
      <Progress progress={side.progress} color={color} reverse={!isYou} />
    </div>
  );
}

function Progress({ progress, color, reverse }: { progress: Side['progress']; color: string; reverse: boolean }): JSX.Element {
  const total = progress?.total ?? 3;
  const passed = progress?.passed ?? 0;
  return (
    <div
      className={`flex gap-1 ${reverse ? 'flex-row-reverse' : ''}`}
      role="img"
      aria-label={progress ? `${passed} of ${total} examples passing` : 'No examples run yet'}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 w-6 rounded-full sm:w-8 ${progress && i < passed ? color : 'bg-raised'}`} />
      ))}
    </div>
  );
}
