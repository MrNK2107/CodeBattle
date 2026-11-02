import type { ScoreBreakdown } from '@codebattle/shared';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { TierBadge } from '@/components/ladder/TierBadge';
import RadarChart from '@/components/scoring/RadarChart';
import { auth } from '@/lib/auth';
import { DIFFICULTY_LABEL, DIFFICULTY_TEXT, VERDICT_LABEL, formatMs, signed } from '@/lib/format';
import { ladderMove, standingFor } from '@/lib/ladder';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Battle results' };

const METRICS: Array<{ key: keyof ScoreBreakdown; label: string; weight: number; hint: string }> = [
  { key: 'correctness', label: 'Correctness', weight: 35, hint: 'Share of hidden tests passed' },
  { key: 'speed', label: 'Speed', weight: 25, hint: 'How early you submitted' },
  { key: 'efficiency', label: 'Efficiency', weight: 20, hint: 'Runtime compared with the faster correct solution' },
  { key: 'typing', label: 'Typing', weight: 12, hint: 'Pace, steadiness and accuracy; pasted code earns nothing' },
  { key: 'quality', label: 'Quality', weight: 8, hint: 'Nesting, leftover prints, long lines and similar checks' },
];

const ZERO: ScoreBreakdown = { correctness: 0, speed: 0, efficiency: 0, typing: 0, quality: 0 };

export default async function ResultsPage({ params }: { params: { matchId: string } }): Promise<JSX.Element> {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect(`/login?callbackUrl=/battle/${params.matchId}/results`);

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: {
      question: { select: { title: true, slug: true, difficulty: true } },
      players: { include: { user: { select: { id: true, username: true } } } },
      submissions: true,
    },
  });
  if (!match) notFound();
  if (match.status === 'WAITING' || match.status === 'ACTIVE') redirect(`/battle/${match.id}`);

  // the viewer (if playing) is always on the left, in their colour
  const players = [...match.players].sort((a, b) => (a.userId === viewerId ? -1 : b.userId === viewerId ? 1 : 0));
  const [left, right] = players;
  const viewerPlays = left?.userId === viewerId;
  const breakdown = (p: (typeof players)[number]) => (p.scoreBreakdown as unknown as ScoreBreakdown | null) ?? ZERO;
  const submissionOf = (userId: string) => match.submissions.find(s => s.userId === userId);
  const hasScores = players.some(p => p.finalScore !== null);

  const winner = players.find(p => p.userId === match.winnerId);
  const headline =
    match.status === 'ABANDONED'
      ? 'Cancelled'
      : !match.winnerId
        ? 'Draw'
        : viewerPlays
          ? match.winnerId === viewerId
            ? 'Victory'
            : 'Defeat'
          : `${winner?.user.username} wins`;
  const reason =
    match.endReason === 'forfeit'
      ? `${players.find(p => p.userId !== match.winnerId)?.user.username} forfeited.`
      : match.endReason === 'timeout'
        ? 'Time ran out before both players submitted.'
        : match.status === 'ABANDONED'
          ? 'The battle never started, so nobody’s rating changed.'
          : 'Both players submitted.';
  const delta = left && left.ratingBefore !== null && left.ratingAfter !== null ? left.ratingAfter - left.ratingBefore : null;
  const headlineTone = headline === 'Victory' ? 'text-pass' : headline === 'Defeat' ? 'text-fail' : 'text-text';
  const move = delta !== null && left.ratingBefore !== null && left.ratingAfter !== null ? ladderMove(left.ratingBefore, left.ratingAfter) : 'same';
  const moveText =
    move === 'tier-up'
      ? `New tier: ${standingFor(left.ratingAfter!).label}`
      : move === 'promoted'
        ? `Promoted to ${standingFor(left.ratingAfter!).label}`
        : move === 'demoted' || move === 'tier-down'
          ? `Dropped to ${standingFor(left.ratingAfter!).label}`
          : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="panel relative flex flex-wrap items-end justify-between gap-6 overflow-hidden p-6 sm:p-8">
        <span aria-hidden className="vs-slash opacity-60" />
        <div className="relative space-y-1">
          <p className="text-sm text-muted">
            <Link className="hover:text-text" href={`/practice/${match.question.slug}`}>
              {match.question.title}
            </Link>{' '}
            <span className={DIFFICULTY_TEXT[match.question.difficulty]}>{DIFFICULTY_LABEL[match.question.difficulty]}</span>
            {match.mode === 'FRIENDLY' ? <span className="ml-2 text-faint">Friendly</span> : null}
          </p>
          <h1 className={`font-display text-6xl font-bold uppercase tracking-tight sm:text-7xl ${headlineTone}`}>{headline}</h1>
          <p className="text-muted">{reason}</p>
        </div>
        {viewerPlays && delta !== null && match.mode === 'RANKED' ? (
          <div className="relative space-y-1 text-right">
            <p className={`stat-num text-5xl ${delta > 0 ? 'text-pass' : delta < 0 ? 'text-fail' : 'text-muted'}`}>{signed(delta)}</p>
            <p className="text-sm text-muted">
              Rating {left.ratingBefore} to {left.ratingAfter}
            </p>
            <p className="flex items-center justify-end gap-2 text-sm">
              <TierBadge rating={left.ratingAfter!} className="text-sm" />
            </p>
            {moveText ? (
              <p className={`font-display text-sm font-semibold uppercase tracking-wider ${move === 'tier-up' || move === 'promoted' ? 'text-pass' : 'text-fail'}`}>
                {moveText}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link className="btn-primary" href="/app">
          Play again
        </Link>
        {match.status === 'COMPLETED' ? (
          <Link className="btn-quiet" href={`/battle/${match.id}/replay`}>
            Watch the replay
          </Link>
        ) : null}
        <Link className="btn-quiet" href={`/practice/${match.question.slug}`}>
          Practice this problem
        </Link>
      </div>

      {left && right ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="panel p-4">
            {hasScores ? (
              <RadarChart a={{ name: left.user.username, breakdown: breakdown(left) }} b={{ name: right.user.username, breakdown: breakdown(right) }} />
            ) : (
              <p className="grid h-72 place-items-center text-sm text-muted">No scores: the battle ended without judging.</p>
            )}
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Score breakdown</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-4 py-3 font-medium text-muted">
                    Component
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-display font-semibold text-you">
                    {left.user.username}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-display font-semibold text-rival">
                    {right.user.username}
                  </th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(m => (
                  <tr key={m.key} className="border-b border-line/60">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="text-text">{m.label}</span> <span className="text-faint">({m.weight}%)</span>
                      <p className="text-xs text-faint">{m.hint}</p>
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(breakdown(left)[m.key])}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(breakdown(right)[m.key])}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="px-4 py-3 text-left font-display font-semibold">
                    Total
                  </th>
                  <td className="px-4 py-3 text-right font-display text-lg font-bold tabular-nums">{(left.finalScore ?? 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-display text-lg font-bold tabular-nums">{(right.finalScore ?? 0).toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {players.map((p, i) => {
          const sub = submissionOf(p.userId);
          return (
            <div key={p.id} className="panel overflow-hidden">
              <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 ${i === 0 ? 'border-l-4 border-l-you' : 'border-l-4 border-l-rival'}`}>
                <Link href={`/profile/${p.user.username}`} className="font-display font-semibold hover:underline">
                  {p.user.username}
                </Link>
                <p className="text-sm text-muted">
                  {sub
                    ? `${VERDICT_LABEL[sub.status]}: ${sub.passedTests}/${sub.totalTests} hidden tests${sub.runtimeMs ? `, ${formatMs(sub.runtimeMs)}` : ''}`
                    : 'No submission'}
                </p>
              </div>
              {sub ? (
                <details>
                  <summary className="cursor-pointer px-4 py-2 text-sm text-muted hover:text-text">Show code ({sub.language})</summary>
                  <pre className="max-h-96 overflow-auto bg-well px-4 py-3 font-mono text-[13px] leading-relaxed">{sub.code}</pre>
                </details>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
