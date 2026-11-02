"use client";

import { useEffect, useState } from 'react';

const LEFT = `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i`;

const RIGHT = `function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target)
        return [i, j];
}`;

const TOTAL_TICKS = 220;

/** A scripted battle: both sides type, run, and the clock counts down. Static when motion is reduced. */
export function DemoBattle(): JSX.Element {
  const [tick, setTick] = useState(TOTAL_TICKS);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setTick(0);
    const t = setInterval(() => setTick(n => (n >= TOTAL_TICKS + 40 ? 0 : n + 1)), 55);
    return () => clearInterval(t);
  }, []);

  const left = LEFT.slice(0, Math.min(LEFT.length, Math.floor(tick * 1.2)));
  const right = RIGHT.slice(0, Math.min(RIGHT.length, Math.floor(tick * 0.95)));
  const leftDone = left.length === LEFT.length;
  const rightDone = right.length === RIGHT.length;
  const seconds = Math.max(0, 15 * 60 - 312 - Math.floor(tick / 2));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_30px_80px_-30px_rgba(56,214,245,0.3)]" aria-hidden>
      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-line">
        <Side name="ada" rating={1342} state={leftDone ? 'Accepted' : 'Typing'} done={leftDone ? 3 : tick > 60 ? 1 : 0} side="you" />
        <div className="flex flex-col items-center justify-center border-x border-line bg-well px-4">
          <p className="font-display text-3xl font-bold tabular-nums">{clock}</p>
          <p className="text-[11px] text-muted">Two Sum</p>
        </div>
        <Side name="linus" rating={1318} state={rightDone ? 'Running examples' : 'Typing'} done={rightDone ? 3 : tick > 120 ? 2 : 0} side="rival" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-line">
        <pre className="h-44 overflow-hidden bg-well p-3 font-mono text-[11.5px] leading-[1.6] text-text/90 sm:text-xs">
          {left}
          <span className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-you" />
        </pre>
        <pre className="h-44 overflow-hidden bg-well p-3 font-mono text-[11.5px] leading-[1.6] text-text/90 sm:text-xs">
          {right}
          <span className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-rival" />
        </pre>
      </div>
    </div>
  );
}

function Side({ name, rating, state, done, side }: { name: string; rating: number; state: string; done: number; side: 'you' | 'rival' }): JSX.Element {
  const left = side === 'you';
  const color = left ? 'bg-you' : 'bg-rival';
  return (
    <div className={`relative space-y-1 px-4 py-3 ${left ? '' : 'text-right'}`}>
      <span className={`absolute inset-y-0 ${left ? 'left-0' : 'right-0'} w-1 ${color}`} />
      <p className="font-display font-semibold">
        {name} <span className={`text-sm ${left ? 'text-you' : 'text-rival'}`}>{rating}</span>
      </p>
      <p className="text-xs text-muted">{state}</p>
      <div className={`flex gap-1 ${left ? '' : 'justify-end'}`}>
        {[0, 1, 2].map(i => (
          <span key={i} className={`h-1.5 w-6 rounded-full ${i < done ? color : 'bg-raised'}`} />
        ))}
      </div>
    </div>
  );
}
