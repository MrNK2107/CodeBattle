"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatClock, VERDICT_LABEL } from '@/lib/format';
import { ghostStateAt, raceOutcome, type Ghost } from '@/lib/ghost';

interface GhostRaceProps {
  slug: string;
  ghost: Ghost;
  others: Ghost[];
  /** Date.now() when the race started, null before Start */
  startedAt: number | null;
  /** ms after the start when you got Accepted, null until then */
  solvedAtMs: number | null;
  onStart: () => void;
  onReset: () => void;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const margin = (ms: number) => formatClock(Math.round(ms / 1000));

/** The race bar shown above the editor in practice: you against a recorded battle. */
export function GhostRace({ slug, ghost, others, startedAt, solvedAtMs, onStart, onReset }: GhostRaceProps): JSX.Element {
  const running = startedAt !== null && solvedAtMs === null;
  const now = useNow(running);
  const elapsed = startedAt === null ? 0 : solvedAtMs ?? Math.max(0, now - startedAt);
  const state = ghostStateAt(ghost, elapsed);
  const outcome = startedAt === null ? ({ kind: 'pending' } as const) : raceOutcome(ghost, elapsed, solvedAtMs);
  const over = outcome.kind !== 'pending' && (solvedAtMs !== null || outcome.kind === 'lost');
  const [peek, setPeek] = useState(false);

  const verdict = ghost.verdict ? VERDICT_LABEL[ghost.verdict as keyof typeof VERDICT_LABEL] ?? ghost.verdict : 'No submission';
  const ghostStatus =
    startedAt === null
      ? `${verdict}${ghost.submitAtMs !== null ? ` at ${margin(ghost.submitAtMs)}` : ''}`
      : state.phase === 'waiting'
        ? 'Reading the problem'
        : state.phase === 'typing'
          ? `Typing, ${state.lines} ${state.lines === 1 ? 'line' : 'lines'}`
          : `${verdict}, ${ghost.passed}/${ghost.total} hidden tests`;

  return (
    <section aria-label="Ghost race" className="panel relative overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        <div className="relative flex min-w-0 flex-col justify-center gap-1 px-4 py-3">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-you" />
          <p className="kicker">You</p>
          <p className="text-sm text-muted">
            {solvedAtMs !== null ? <span className="font-semibold text-pass">Accepted at {margin(solvedAtMs)}</span> : startedAt === null ? 'Ready when you are' : 'Racing'}
          </p>
        </div>
        <div className="flex min-w-[7.5rem] flex-col items-center justify-center border-x border-line bg-well px-3 py-2">
          {startedAt === null ? (
            <button type="button" className="btn-primary px-5" onClick={onStart}>
              Start race
            </button>
          ) : (
            <>
              <p className="stat-num text-3xl" role="timer" aria-label={`${Math.floor(elapsed / 1000)} seconds elapsed`}>
                {formatClock(elapsed / 1000)}
              </p>
              <button type="button" className="mt-1 text-[11px] text-muted hover:text-text" onClick={onReset}>
                Restart
              </button>
            </>
          )}
        </div>
        <div className="relative flex min-w-0 flex-col items-end justify-center gap-1 px-4 py-3 text-right">
          <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-rival/70" />
          <p className="kicker flex items-center gap-1.5">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full bg-rival ${running ? 'animate-ghost-blink' : ''}`} />
            Ghost: <span className="normal-case tracking-normal text-text">{ghost.username}</span>
            {ghost.rating ? <span className="tabular-nums text-rival">{ghost.rating}</span> : null}
          </p>
          <p className="truncate text-sm text-muted">{ghostStatus}</p>
          <div className="h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-raised" aria-hidden>
            <div className="h-full rounded-full bg-rival/80 transition-[width] duration-500" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
        </div>
      </div>

      {over ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-sm ${
            outcome.kind === 'lost' ? 'bg-fail/10' : 'bg-pass/10'
          }`}
        >
          <p className="font-display font-semibold">
            {outcome.kind === 'won'
              ? `You beat ${ghost.username}'s ghost by ${margin(outcome.marginMs)}.`
              : outcome.kind === 'ghost-failed'
                ? `Solved. ${ghost.username} never got this one accepted in their battle.`
                : `${ghost.username}'s ghost solved it first. Keep going, the clock is still yours.`}
          </p>
          <button type="button" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline" onClick={() => setPeek(p => !p)}>
            {peek ? 'Hide ghost code' : 'Show ghost code'}
          </button>
        </div>
      ) : null}
      {over && peek ? (
        <pre className="max-h-72 overflow-auto border-t border-line bg-well px-4 py-3 font-mono text-[12.5px] leading-relaxed text-muted">
          {state.code || ghost.frames[ghost.frames.length - 1]?.code}
        </pre>
      ) : null}

      {others.length > 1 && startedAt === null ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2 text-xs text-muted">
          <span>Other ghosts:</span>
          {others
            .filter(g => g.id !== ghost.id)
            .map(g => (
              <Link key={g.id} href={`/practice/${slug}?ghost=${g.id}`} className="chip hover:border-muted hover:text-text">
                {g.username}
                {g.submitAtMs !== null && g.verdict === 'ACCEPTED' ? <span className="tabular-nums text-faint">{margin(g.submitAtMs)}</span> : null}
              </Link>
            ))}
        </div>
      ) : null}
    </section>
  );
}

/** Shown when no ghost is selected: the offer to race one. */
export function GhostOffer({ slug, ghosts }: { slug: string; ghosts: Ghost[] }): JSX.Element | null {
  if (!ghosts.length) return null;
  const best = ghosts[0];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-rival/40 bg-rival/5 px-4 py-2.5 text-sm">
      <p className="text-muted">
        <span className="font-semibold text-text">Race a ghost.</span> {ghosts.length} recorded {ghosts.length === 1 ? 'battle' : 'battles'} on this problem. Fastest:{' '}
        {best.username}
        {best.submitAtMs !== null && best.verdict === 'ACCEPTED' ? `, accepted at ${margin(best.submitAtMs)}` : ''}.
      </p>
      <Link href={`/practice/${slug}?ghost=${best.id}`} className="btn-quiet px-3 py-1.5 text-xs">
        Race {best.username}
      </Link>
    </div>
  );
}
