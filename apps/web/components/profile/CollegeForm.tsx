"use client";

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

/** "Represent your college or club" field on your own profile. */
export function CollegeForm({ initial }: { initial: string | null }): JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setState('saving');
    setError(null);
    const res = await fetch('/api/me/college', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college: value }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const payload = (await res?.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Could not save. Check your connection and try again.');
      setState('idle');
      return;
    }
    const saved = (await res.json()) as { college: string | null };
    setValue(saved.college ?? '');
    setState('saved');
    router.refresh();
  };

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] flex-1 space-y-1.5">
        <label htmlFor="college" className="kicker block">
          College or club
        </label>
        <input
          id="college"
          className="input"
          value={value}
          maxLength={60}
          placeholder="e.g. Anna University, CEG Coding Club"
          onChange={e => {
            setValue(e.target.value);
            setState('idle');
          }}
          disabled={state === 'saving'}
        />
      </div>
      <button type="submit" className="btn-quiet" disabled={state === 'saving' || value.trim() === (initial ?? '')}>
        {state === 'saving' ? 'Saving…' : 'Save'}
      </button>
      <p className="w-full text-xs text-faint" role={error ? 'alert' : 'status'}>
        {error ? <span className="text-fail">{error}</span> : state === 'saved' ? 'Saved. Your ranked battles now count for this team.' : 'Shown on the college leaderboard. Leave empty to play independently.'}
      </p>
    </form>
  );
}
