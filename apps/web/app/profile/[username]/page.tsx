import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LadderProgress, TierBadge } from '@/components/ladder/TierBadge';
import { CollegeForm } from '@/components/profile/CollegeForm';
import { MatchHistory } from '@/components/profile/MatchHistory';
import { RatingChart } from '@/components/profile/RatingChart';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: decodeURIComponent(params.username) };
}

export default async function ProfilePage({ params }: { params: { username: string } }): Promise<JSX.Element> {
  const username = decodeURIComponent(params.username);
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, rating: true, wins: true, losses: true, totalMatches: true, createdAt: true, college: true, collegeSlug: true },
  });
  if (!user) notFound();
  const session = await auth().catch(() => null);
  const isOwner = session?.user?.id === user.id;

  const [history, ranked, rank, solved, typing] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: { userId: user.id, match: { status: { in: ['COMPLETED', 'ABANDONED'] } } },
      orderBy: { match: { createdAt: 'desc' } },
      take: 15,
      include: {
        match: {
          include: { question: { select: { title: true, difficulty: true } }, players: { include: { user: { select: { username: true } } } } },
        },
      },
    }),
    prisma.matchPlayer.findMany({
      where: { userId: user.id, ratingAfter: { not: null }, match: { status: 'COMPLETED', mode: 'RANKED' } },
      orderBy: { match: { endedAt: 'asc' } },
      take: 200,
      select: { ratingBefore: true, ratingAfter: true, match: { select: { endedAt: true } } },
    }),
    user.totalMatches > 0 ? prisma.user.count({ where: { totalMatches: { gt: 0 }, rating: { gt: user.rating } } }) : Promise.resolve(null),
    prisma.practiceAttempt.findMany({ where: { userId: user.id, status: 'ACCEPTED' }, distinct: ['questionId'], select: { questionId: true } }),
    prisma.typingProfile.aggregate({ where: { userId: user.id, avgWpm: { gt: 0 } }, _avg: { avgWpm: true, backspaceRate: true } }),
  ]);

  const points = ranked.length
    ? [
        { label: 'Start', rating: ranked[0].ratingBefore ?? 1200 },
        ...ranked.map(r => ({
          label: (r.match.endedAt ?? new Date()).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          rating: r.ratingAfter!,
        })),
      ]
    : [];
  const peak = points.length ? Math.max(...points.map(p => p.rating)) : user.rating;
  const draws = user.totalMatches - user.wins - user.losses;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="kicker">{rank !== null ? `Ranked #${rank + 1}` : 'Unranked'}</p>
          <h1 className="text-4xl font-bold sm:text-5xl">{user.username}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
            <TierBadge rating={user.rating} className="text-sm" />
            {user.college && user.collegeSlug ? (
              <Link className="hover:text-text" href={`/leaderboard?college=${user.collegeSlug}`}>
                {user.college}
              </Link>
            ) : null}
            <span>Playing since {user.createdAt.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        <dl className="flex flex-wrap gap-8">
          <Stat label="Rating" value={String(user.rating)} accent />
          <Stat label="Peak" value={String(peak)} />
          <Stat label="Record" value={`${user.wins}–${user.losses}${draws > 0 ? `–${draws}` : ''}`} />
          <Stat label="Practice solved" value={String(solved.length)} />
          <Stat label="Typing" value={typing._avg.avgWpm ? `${Math.round(typing._avg.avgWpm)} wpm` : '–'} />
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel space-y-2 p-5">
          <h2 className="text-lg font-semibold">Rating history</h2>
          <RatingChart points={points} />
        </section>
        <section className="panel flex flex-col justify-between gap-6 p-5">
          <div className="space-y-3">
            <h2 className="kicker">Ladder</h2>
            <LadderProgress rating={user.rating} />
          </div>
          {isOwner ? <CollegeForm initial={user.college} /> : null}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Battles</h2>
        <MatchHistory userId={user.id} entries={history} empty={`${user.username} hasn’t finished a battle yet.`} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className={`stat-num mt-1 text-2xl ${accent ? 'text-you' : ''}`}>{value}</dd>
    </div>
  );
}
