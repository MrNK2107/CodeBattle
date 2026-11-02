import Link from 'next/link';

import { TierBadge } from '@/components/ladder/TierBadge';
import { auth } from '@/lib/auth';
import { COLLEGE_MIN_PLAYERS, COLLEGE_TOP_N, rankColleges } from '@/lib/colleges';
import { tierDistribution } from '@/lib/ladder';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leaderboard' };

type View = 'players' | 'colleges';

export default async function LeaderboardPage({ searchParams }: { searchParams: { view?: string; college?: string } }): Promise<JSX.Element> {
  const session = await auth().catch(() => null);
  const viewerId = session?.user?.id;
  const view: View = searchParams.view === 'colleges' ? 'colleges' : 'players';
  const collegeFilter = typeof searchParams.college === 'string' && searchParams.college ? searchParams.college.slice(0, 80) : null;

  const ranked = await prisma.user.findMany({
    where: { totalMatches: { gt: 0 } },
    select: { rating: true, college: true, collegeSlug: true, username: true, wins: true, totalMatches: true },
  });
  const distribution = tierDistribution(ranked.map(u => u.rating));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="kicker">Ranked ladder</p>
          <h1 className="text-4xl font-bold">Leaderboard</h1>
          <p className="text-muted">
            {ranked.length} ranked {ranked.length === 1 ? 'player' : 'players'}. One ranked battle puts you on the ladder.
          </p>
        </div>
        <nav className="segmented" aria-label="Leaderboard view">
          <Link role="tab" aria-selected={view === 'players'} href="/leaderboard" className={tabClass(view === 'players')}>
            Players
          </Link>
          <Link role="tab" aria-selected={view === 'colleges'} href="/leaderboard?view=colleges" className={tabClass(view === 'colleges')}>
            Colleges &amp; clubs
          </Link>
        </nav>
      </header>

      {ranked.length ? (
        <section aria-label="Players per tier" className="space-y-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-raised">
            {distribution
              .filter(d => d.count)
              .map(d => (
                <div key={d.tier.id} style={{ width: `${d.share * 100}%`, background: d.tier.color }} title={`${d.tier.name}: ${d.count}`} />
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            {distribution.map(d => (
              <li key={d.tier.id} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: d.tier.color }} />
                {d.tier.name} <span className="tabular-nums text-text">{d.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === 'colleges' ? <Colleges members={ranked} /> : <Players viewerId={viewerId} collegeFilter={collegeFilter} />}
    </div>
  );
}

function tabClass(active: boolean): string {
  return `rounded px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-raised text-text' : 'text-muted hover:text-text'}`;
}

async function Players({ viewerId, collegeFilter }: { viewerId?: string; collegeFilter: string | null }): Promise<JSX.Element> {
  const top = await prisma.user.findMany({
    where: { totalMatches: { gt: 0 }, ...(collegeFilter ? { collegeSlug: collegeFilter } : {}) },
    orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { createdAt: 'asc' }],
    take: 100,
    select: { id: true, username: true, rating: true, wins: true, losses: true, totalMatches: true, college: true, collegeSlug: true },
  });
  const collegeName = collegeFilter ? (top[0]?.college ?? collegeFilter) : null;

  if (top.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-6 text-muted">
        {collegeFilter ? 'Nobody from this college has finished a ranked battle yet.' : 'Nobody has finished a ranked battle yet.'}{' '}
        <Link className="link" href="/app">
          Be the first.
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {collegeName ? (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          Showing players from <span className="font-semibold text-text">{collegeName}</span>
          <Link className="link" href="/leaderboard">
            Show everyone
          </Link>
        </p>
      ) : null}
      {top.length >= 3 && !collegeFilter ? <Podium players={top.slice(0, 3)} /> : null}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Players ranked by rating</caption>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="w-14 px-4 py-3 font-medium">
                #
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Player
              </th>
              <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
                Tier
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Rating
              </th>
              <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                W–L
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Win rate
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((u, i) => (
              <tr key={u.id} className={`border-b border-line/60 last:border-0 ${u.id === viewerId ? 'bg-you/10' : 'hover:bg-raised/40'}`}>
                <td className={`px-4 py-2.5 font-display font-semibold tabular-nums ${i < 3 ? 'text-rival' : 'text-muted'}`}>{i + 1}</td>
                <td className="px-4 py-2.5">
                  <Link className="font-semibold hover:underline" href={`/profile/${u.username}`}>
                    {u.username}
                  </Link>
                  {u.id === viewerId ? <span className="ml-2 text-xs text-you">you</span> : null}
                  {u.college && u.collegeSlug ? (
                    <Link href={`/leaderboard?college=${u.collegeSlug}`} className="block truncate text-xs text-faint hover:text-muted">
                      {u.college}
                    </Link>
                  ) : null}
                </td>
                <td className="hidden px-4 py-2.5 md:table-cell">
                  <TierBadge rating={u.rating} />
                </td>
                <td className="px-4 py-2.5 text-right font-display font-semibold tabular-nums">{u.rating}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted sm:table-cell">
                  {u.wins}–{u.losses}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{Math.round((u.wins / u.totalMatches) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Podium({ players }: { players: Array<{ id: string; username: string; rating: number; college: string | null }> }): JSX.Element {
  // second, first, third: the champion stands in the middle
  const order = [players[1], players[0], players[2]];
  const heights = ['h-20', 'h-28', 'h-14'];
  const places = [2, 1, 3];
  return (
    <ol className="grid grid-cols-3 items-end gap-3" aria-label="Top three">
      {order.map((p, i) => (
        <li key={p.id} className="flex min-w-0 flex-col items-center gap-2 text-center">
          <Link href={`/profile/${p.username}`} className="min-w-0 max-w-full hover:underline">
            <p className="truncate font-display text-lg font-semibold">{p.username}</p>
          </Link>
          <TierBadge rating={p.rating} showRating />
          <div
            className={`${heights[i]} flex w-full items-start justify-center rounded-t-lg border border-b-0 border-line pt-2 font-display text-3xl font-bold ${
              places[i] === 1 ? 'bg-rival/15 text-rival' : 'bg-raised/60 text-muted'
            }`}
          >
            {places[i]}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Colleges({
  members,
}: {
  members: Array<{ rating: number; college: string | null; collegeSlug: string | null; username: string; wins: number; totalMatches: number }>;
}): JSX.Element {
  const rows = rankColleges(members);
  const rankedRows = rows.filter(r => r.ranked);
  const forming = rows.filter(r => !r.ranked);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted">
        A college or club scores the average rating of its best {COLLEGE_TOP_N} ranked players, so bringing beginners never hurts and one star
        can&rsquo;t carry a team alone. Teams with at least {COLLEGE_MIN_PLAYERS} ranked players are ranked. Set yours on your profile.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-muted">
          No college has a ranked player yet. Add your college on your profile and play a ranked battle to put it on the board.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Colleges and clubs ranked by the average rating of their top players</caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="w-14 px-4 py-3 font-medium">
                  #
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  College or club
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Score
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                  Players
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                  Battles won
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
                  Top player
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rankedRows, ...forming].map((r, i) => (
                <tr key={r.slug} className={`border-b border-line/60 last:border-0 hover:bg-raised/40 ${r.ranked ? '' : 'text-muted'}`}>
                  <td className={`px-4 py-2.5 font-display font-semibold tabular-nums ${r.ranked && i < 3 ? 'text-rival' : 'text-muted'}`}>
                    {r.ranked ? i + 1 : '–'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link className="font-semibold hover:underline" href={`/leaderboard?college=${r.slug}`}>
                      {r.name}
                    </Link>
                    {r.ranked ? null : <span className="ml-2 chip">forming</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-display font-semibold tabular-nums">{r.score}</span>
                    <TierBadge rating={r.score} className="ml-2 hidden lg:inline-flex" />
                  </td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{r.players}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular-nums sm:table-cell">{r.wins}</td>
                  <td className="hidden px-4 py-2.5 md:table-cell">
                    <Link className="hover:underline" href={`/profile/${r.top.username}`}>
                      {r.top.username}
                    </Link>{' '}
                    <span className="tabular-nums text-faint">{r.top.rating}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
