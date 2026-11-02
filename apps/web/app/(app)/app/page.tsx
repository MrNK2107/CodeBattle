import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChallengeFriend } from '@/components/battle/ChallengeFriend';
import { FindMatch } from '@/components/battle/FindMatch';
import { LadderProgress } from '@/components/ladder/TierBadge';
import { MatchHistory } from '@/components/profile/MatchHistory';
import { auth } from '@/lib/auth';
import { DIFFICULTY_LABEL, DIFFICULTY_TEXT } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Play' };

export default async function LobbyPage(): Promise<JSX.Element> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login?callbackUrl=/app');

  const [user, live, recent, solved, totalQuestions, liveNow] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true, rating: true, wins: true, losses: true, totalMatches: true, college: true, collegeSlug: true } }),
    prisma.match.findFirst({
      where: { status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId } } },
      include: { players: { include: { user: { select: { username: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.matchPlayer.findMany({
      where: { userId, match: { status: { in: ['COMPLETED', 'ABANDONED'] } } },
      orderBy: { match: { createdAt: 'desc' } },
      take: 8,
      include: {
        match: {
          include: {
            question: { select: { title: true, difficulty: true } },
            players: { include: { user: { select: { username: true } } } },
          },
        },
      },
    }),
    prisma.practiceAttempt.findMany({ where: { userId, status: 'ACCEPTED' }, distinct: ['questionId'], select: { questionId: true } }),
    prisma.question.count({ where: { isActive: true } }),
    prisma.match.findMany({
      where: { status: 'ACTIVE', endsAt: { gt: new Date() }, players: { none: { userId } } },
      orderBy: { startedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        mode: true,
        endsAt: true,
        question: { select: { title: true, difficulty: true } },
        players: { select: { user: { select: { username: true, rating: true } } } },
      },
    }),
  ]);
  if (!user) redirect('/login');

  const draws = user.totalMatches - user.wins - user.losses;
  const winRate = user.totalMatches ? Math.round((user.wins / user.totalMatches) * 100) : null;
  const liveOpponent = live?.players.find(p => p.userId !== userId)?.user.username;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="panel relative overflow-hidden p-6">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-you" />
          <p className="kicker">Blue corner</p>
          <h1 className="mt-1 text-4xl font-bold">Ready, {user.username}?</h1>
          <p className="mt-1 text-muted">
            {user.college && user.collegeSlug ? (
              <>
                Fighting for{' '}
                <Link className="text-text hover:underline" href={`/leaderboard?college=${user.collegeSlug}`}>
                  {user.college}
                </Link>
                .{' '}
              </>
            ) : (
              <>
                <Link className="link" href={`/profile/${user.username}`}>
                  Add your college or club
                </Link>{' '}
                to put it on the leaderboard.{' '}
              </>
            )}
            Pick a battle, or warm up against a ghost first.
          </p>
          <dl className="mt-6 flex flex-wrap gap-8">
            <Stat label="Rating" value={String(user.rating)} accent />
            <Stat label="Record" value={`${user.wins}–${user.losses}${draws > 0 ? `–${draws}` : ''}`} />
            <Stat label="Win rate" value={winRate === null ? '–' : `${winRate}%`} />
          </dl>
        </div>
        <div className="panel flex flex-col justify-between gap-4 p-6">
          <p className="kicker">Ranked ladder</p>
          <LadderProgress rating={user.rating} />
          <Link className="text-sm text-muted hover:text-text" href="/leaderboard">
            See the ladder &rarr;
          </Link>
        </div>
      </section>

      {live ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-you/50 bg-you/10 px-5 py-4">
          <p>
            Your battle against <span className="font-semibold">{liveOpponent}</span> is still {live.status === 'ACTIVE' ? 'running' : 'waiting for you'}.
          </p>
          <Link className="btn-primary" href={`/battle/${live.id}`}>
            Rejoin battle
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <FindMatch />
        <ChallengeFriend />
      </div>

      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-semibold">Practice and ghost races</h2>
          <p className="text-sm text-muted">
            You have solved {solved.length} of {totalQuestions} problems. Race the recorded timeline of a past battle on any problem. Practice never
            affects your rating.
          </p>
        </div>
        <Link className="btn-quiet" href="/practice">
          Browse problems
        </Link>
      </section>

      {liveNow.length ? (
        <section className="space-y-3" aria-label="Live battles">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <span aria-hidden className="h-2 w-2 animate-clock-pulse rounded-full bg-fail" /> Live now
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {liveNow.map(m => (
              <li key={m.id}>
                <Link href={`/battle/${m.id}/watch`} className="panel block space-y-1 p-4 transition-colors hover:border-muted">
                  <p className="font-display font-semibold">
                    <span className="text-you">{m.players[0]?.user.username}</span> <span className="text-faint">vs</span>{' '}
                    <span className="text-rival">{m.players[1]?.user.username}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {m.question.title} · <span className={DIFFICULTY_TEXT[m.question.difficulty]}>{DIFFICULTY_LABEL[m.question.difficulty]}</span>
                    {m.mode === 'FRIENDLY' ? ' · friendly' : ''}
                  </p>
                  <p className="text-xs text-you">Watch &rarr;</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent battles</h2>
        <MatchHistory
          userId={userId}
          entries={recent}
          empty="No battles yet. Find one above, or open a second browser profile and battle yourself to try it out."
        />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className={`stat-num mt-1 text-3xl ${accent ? 'text-you' : ''}`}>{value}</dd>
    </div>
  );
}
