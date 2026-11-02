"use client";

import { useEffect, useMemo, useState } from 'react';

import { formatClock } from '@/lib/format';
import type { GhostFrame } from '@/lib/ghost';
import { changeCount, markChangedLines } from '@/lib/lineDiff';

/** A snapshot; `code` is absent for viewers who did not play the battle. */
export type ReplayFrame = GhostFrame;

interface ReplayTrack {
  name: string;
  frames: ReplayFrame[];
  /** final verdict label, e.g. "Accepted, 12/12" */
  verdict?: string | null;
  /** ms after the start when the final answer was submitted */
  submitAt?: number | null;
  accepted?: boolean;
}

const SPEEDS = [1, 5, 20, 60];

function frameIndexAt(frames: ReplayFrame[], t: number): number {
  let found = -1;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t <= t) found = i;
    else break;
  }
  return found;
}

export function ReplayViewer({
  tracks,
  durationMs,
  codeVisible = true,
}: {
  tracks: [ReplayTrack, ReplayTrack];
  durationMs: number;
  /** false for viewers who did not play: the frames carry no code, show the timeline only */
  codeVisible?: boolean;
}): JSX.Element {
  const sorted = useMemo(() => tracks.map(tr => ({ ...tr, frames: [...tr.frames].sort((a, b) => a.t - b.t) })), [tracks]);
  const end = Math.max(durationMs, ...sorted.flatMap(tr => tr.frames.map(f => f.t)), 1000);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(20);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      setT(prev => {
        const next = prev + dt * speed;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, end]);

  const marks = sorted.flatMap((tr, i) => tr.frames.filter(f => f.submitted).map(f => ({ at: f.t, side: i })));

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary min-w-[5.5rem]"
            onClick={() => {
              if (t >= end) setT(0);
              setPlaying(p => !p);
            }}
          >
            {playing ? 'Pause' : t >= end ? 'Replay' : 'Play'}
          </button>
          <p className="font-display text-lg font-semibold tabular-nums">
            {formatClock(t / 1000)} <span className="text-sm font-normal text-muted">of {formatClock(end / 1000)}</span>
          </p>
          <div className="segmented ml-auto" role="radiogroup" aria-label="Playback speed">
            {SPEEDS.map(s => (
              <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <input
            type="range"
            min={0}
            max={end}
            step={250}
            value={t}
            onChange={e => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            className="w-full accent-[#38D6F5]"
            aria-label="Replay position"
          />
          {marks.map(m => (
            <span
              key={`${m.side}-${m.at}`}
              title={`${sorted[m.side].name} submitted`}
              className={`pointer-events-none absolute -top-1 h-2 w-2 rounded-full ${m.side === 0 ? 'bg-you' : 'bg-rival'}`}
              style={{ left: `calc(${(m.at / end) * 100}% - 4px)` }}
            />
          ))}
        </div>
      </div>

      <section className="panel space-y-2 p-4" aria-label="Verdict timeline">
        <p className="kicker">Timeline</p>
        {sorted.map((tr, i) => (
          <div key={tr.name} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-xs">
            <p className={`truncate font-display font-semibold ${i === 0 ? 'text-you' : 'text-rival'}`}>{tr.name}</p>
            <div className="relative h-6 rounded bg-well">
              <div className={`absolute inset-y-0 left-0 rounded ${i === 0 ? 'bg-you/10' : 'bg-rival/10'}`} style={{ width: `${(Math.min(t, end) / end) * 100}%` }} />
              {tr.frames.map(f => (
                <span
                  key={f.t}
                  aria-hidden
                  className={`absolute top-1.5 h-3 w-px ${i === 0 ? 'bg-you/60' : 'bg-rival/60'}`}
                  style={{ left: `${(f.t / end) * 100}%` }}
                />
              ))}
              {tr.submitAt != null ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setT(tr.submitAt!);
                  }}
                  className={`absolute top-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-semibold ${
                    tr.accepted ? 'bg-pass text-ink' : 'bg-fail text-ink'
                  }`}
                  style={{ left: `${Math.min(92, Math.max(8, (tr.submitAt / end) * 100))}%` }}
                  title={`Jump to ${tr.name}'s submission`}
                >
                  {tr.verdict ?? 'Submitted'} · {formatClock(tr.submitAt / 1000)}
                </button>
              ) : (
                <span className="absolute right-2 top-1 text-faint">no submission</span>
              )}
            </div>
          </div>
        ))}
      </section>

      {codeVisible ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((tr, i) => (
            <TrackPane key={tr.name} track={tr} t={t} side={i === 0 ? 'you' : 'rival'} />
          ))}
        </div>
      ) : (
        <section className="panel space-y-2 p-4 text-sm text-muted" aria-label="Progress">
          <p>The code in this battle is shown only to the two players, because the question is still in the ranked pool.</p>
          <ul className="space-y-1">
            {sorted.map(tr => {
              const index = frameIndexAt(tr.frames, t);
              const frame = index >= 0 ? tr.frames[index] : null;
              return (
                <li key={tr.name} className="tabular-nums">
                  <span className="font-semibold text-text">{tr.name}</span>:{' '}
                  {frame ? `${frame.lines} ${frame.lines === 1 ? 'line' : 'lines'} of ${frame.language}${frame.submitted ? ', submitted' : ''}` : 'not started yet'}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function TrackPane({ track, t, side }: { track: ReplayTrack; t: number; side: 'you' | 'rival' }): JSX.Element {
  const index = frameIndexAt(track.frames, t);
  const frame = index >= 0 ? track.frames[index] : null;
  const prev = index > 0 ? (track.frames[index - 1].code ?? '') : '';
  const marks = useMemo(() => (frame ? markChangedLines(prev, frame.code ?? '') : []), [prev, frame]);
  const changed = changeCount(marks);
  const lines = frame ? (frame.code ?? '').split('\n') : [];
  const tint = side === 'you' ? 'bg-you/10 border-l-you' : 'bg-rival/10 border-l-rival';

  return (
    <section className="panel overflow-hidden" aria-label={`${track.name}'s code`}>
      <div className={`flex items-baseline justify-between gap-3 border-b border-l-4 border-line px-4 py-2 ${side === 'you' ? 'border-l-you' : 'border-l-rival'}`}>
        <p className="font-display font-semibold">{track.name}</p>
        <p className="text-xs text-muted">
          {frame ? (
            <>
              {frame.language}
              {frame.submitted ? ', submitted' : ''}
              {changed ? <span className={side === 'you' ? 'text-you' : 'text-rival'}>{`, ${changed} ${changed === 1 ? 'line' : 'lines'} changed`}</span> : null}
              {` · snapshot ${index + 1} of ${track.frames.length}`}
            </>
          ) : (
            'Not started yet'
          )}
        </p>
      </div>
      <pre className="h-[60vh] overflow-auto bg-well py-3 font-mono text-[13px] leading-relaxed">
        {lines.map((line, k) => (
          <div key={k} className={`flex border-l-2 pr-4 ${marks[k] === 'added' ? tint : 'border-l-transparent'}`}>
            <span aria-hidden className="w-10 shrink-0 select-none pr-3 text-right text-faint">
              {k + 1}
            </span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        ))}
      </pre>
    </section>
  );
}
