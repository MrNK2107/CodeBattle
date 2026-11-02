"use client";

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DIFFICULTY_LABEL, DIFFICULTY_TEXT } from '@/lib/format';

export interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  state: 'solved' | 'tried' | 'new';
}

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
] as const;

export function ProblemList({ rows }: { rows: ProblemRow[] }): JSX.Element {
  const [difficulty, setDifficulty] = useState<(typeof FILTERS)[number]['value']>('ALL');
  const [query, setQuery] = useState('');
  const [hideSolved, setHideSolved] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      r =>
        (difficulty === 'ALL' || r.difficulty === difficulty) &&
        (!hideSolved || r.state !== 'solved') &&
        (!q || r.title.toLowerCase().includes(q) || r.tags.some(t => t.includes(q)))
    );
  }, [rows, difficulty, query, hideSolved]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" type="search" placeholder="Search by title or tag" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search problems" />
        <div className="segmented" role="radiogroup" aria-label="Difficulty filter">
          {FILTERS.map(f => (
            <button key={f.value} type="button" role="radio" aria-checked={difficulty === f.value} onClick={() => setDifficulty(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={hideSolved} onChange={e => setHideSolved(e.target.checked)} className="accent-[#38D6F5]" />
          Hide solved
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">No problems match these filters.</p>
      ) : (
        <ul className="panel divide-y divide-line">
          {visible.map(r => (
            <li key={r.id}>
              <Link href={`/practice/${r.slug}`} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-raised/60">
                <span aria-label={r.state === 'solved' ? 'Solved' : r.state === 'tried' ? 'Attempted' : 'Not attempted'}>
                  {r.state === 'solved' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                      <path d="M3 8.5l3.2 3L13 4.5" stroke="#6BD99A" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  ) : r.state === 'tried' ? (
                    <span className="block h-2 w-2 rounded-full bg-rival" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-text">{r.title}</span>
                  <span className="block truncate text-xs text-faint">{r.tags.join(', ')}</span>
                </span>
                <span className={`text-sm font-semibold ${DIFFICULTY_TEXT[r.difficulty]}`}>{DIFFICULTY_LABEL[r.difficulty]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
