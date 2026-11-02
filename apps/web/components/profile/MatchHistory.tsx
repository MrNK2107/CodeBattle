import Link from 'next/link';

import { DIFFICULTY_LABEL, DIFFICULTY_TEXT, relativeTime, signed } from '@/lib/format';

export interface HistoryEntry {
  id: string;
  ratingBefore: number | null;
  ratingAfter: number | null;
  match: {
    id: string;
    status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
    mode: 'RANKED' | 'FRIENDLY';
    winnerId: string | null;
    createdAt: Date;
    question: { title: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD' };
    players: { userId: string; user: { username: string } }[];
  };
}

export function MatchHistory({ userId, entries, empty }: { userId: string; entries: HistoryEntry[]; empty: string }): JSX.Element {
  if (!entries.length) {
    return <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="panel divide-y divide-line">
      {entries.map(entry => {
        const m = entry.match;
        const opponent = m.players.find(p => p.userId !== userId)?.user.username ?? 'Unknown';
        const outcome = m.status === 'ABANDONED' ? 'Cancelled' : !m.winnerId ? 'Draw' : m.winnerId === userId ? 'Win' : 'Loss';
        const tone = outcome === 'Win' ? 'text-pass' : outcome === 'Loss' ? 'text-fail' : 'text-muted';
        const delta = entry.ratingBefore !== null && entry.ratingAfter !== null && m.mode === 'RANKED' ? entry.ratingAfter - entry.ratingBefore : null;
        return (
          <li key={entry.id}>
            <Link
              href={m.status === 'COMPLETED' ? `/battle/${m.id}/results` : `/battle/${m.id}`}
              className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-raised/60"
            >
              <span className={`font-display font-semibold ${tone}`}>{outcome}</span>
              <span className="min-w-0">
                <span className="block truncate text-text">
                  {m.question.title} <span className={`text-xs ${DIFFICULTY_TEXT[m.question.difficulty]}`}>{DIFFICULTY_LABEL[m.question.difficulty]}</span>
                </span>
                <span className="block truncate text-xs text-muted">
                  against {opponent}, {relativeTime(m.createdAt)}
                  {m.mode === 'FRIENDLY' ? ', friendly' : ''}
                </span>
              </span>
              <span className={`font-display text-sm font-semibold tabular-nums ${delta && delta > 0 ? 'text-pass' : delta && delta < 0 ? 'text-fail' : 'text-faint'}`}>
                {delta === null ? '' : signed(delta)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
