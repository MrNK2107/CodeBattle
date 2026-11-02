import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { SpectatorView } from '@/components/battle/SpectatorView';
import { auth } from '@/lib/auth';
import { DIFFICULTY_LABEL, DIFFICULTY_TEXT } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Watch' };

export default async function WatchPage({ params }: { params: { matchId: string } }): Promise<JSX.Element> {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect(`/login?callbackUrl=/battle/${params.matchId}/watch`);

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    select: {
      id: true,
      status: true,
      mode: true,
      question: { select: { title: true, slug: true, difficulty: true } },
      players: { select: { userId: true, user: { select: { username: true } } } },
    },
  });
  if (!match) notFound();
  // players belong in the battle room, finished battles on the scorecard
  if (match.players.some(p => p.userId === viewerId) && (match.status === 'WAITING' || match.status === 'ACTIVE')) redirect(`/battle/${match.id}`);
  if (match.status === 'COMPLETED') redirect(`/battle/${match.id}/results`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="kicker flex items-center gap-2">
            <span className="h-2 w-2 animate-clock-pulse rounded-full bg-fail" /> Live
            {match.mode === 'FRIENDLY' ? <span className="text-faint">friendly</span> : null}
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{match.players.map(p => p.user.username).join(' vs ')}</h1>
          <p className="text-muted">
            {match.question.title} <span className={DIFFICULTY_TEXT[match.question.difficulty]}>{DIFFICULTY_LABEL[match.question.difficulty]}</span>
          </p>
        </div>
        <Link className="btn-quiet" href="/app">
          Back to the lobby
        </Link>
      </header>
      <SpectatorView matchId={match.id} />
    </div>
  );
}
