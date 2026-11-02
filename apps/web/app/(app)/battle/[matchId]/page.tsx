import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BattleRoom } from '@/components/battle/BattleRoom';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toPublicQuestion, visibleTestsQuery } from '@/lib/questions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Battle' };

export default async function BattlePage({ params }: { params: { matchId: string } }): Promise<JSX.Element> {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect(`/login?callbackUrl=/battle/${params.matchId}`);

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: {
      question: { include: { testCases: visibleTestsQuery } },
      players: { include: { user: { select: { id: true, username: true, rating: true } } } },
    },
  });
  if (!match || !match.question.signature) notFound();
  if (match.status === 'COMPLETED') redirect(`/battle/${match.id}/results`);

  const you = match.players.find(p => p.userId === viewerId);
  const rival = match.players.find(p => p.userId !== viewerId);

  if (!you || !rival) {
    return (
      <div className="mx-auto max-w-lg space-y-3 pt-10 text-center">
        <h1 className="text-2xl font-semibold">This battle is between other players</h1>
        <p className="text-muted">
          {match.players.map(p => p.user.username).join(' and ')} are playing. Watch it live, or see the results and the replay once it ends.
        </p>
        <div className="flex justify-center gap-2">
          {match.status === 'ACTIVE' || match.status === 'WAITING' ? (
            <Link className="btn-primary" href={`/battle/${match.id}/watch`}>
              Watch live
            </Link>
          ) : null}
          <Link className="btn-quiet" href="/app">
            Back to the lobby
          </Link>
        </div>
      </div>
    );
  }

  if (match.status === 'ABANDONED') {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-10 text-center">
        <h1 className="text-2xl font-semibold">Battle cancelled</h1>
        <p className="text-muted">This battle never started, so nobody’s rating changed.</p>
        <Link className="btn-primary" href="/app">
          Find another battle
        </Link>
      </div>
    );
  }

  return (
    <BattleRoom
      matchId={match.id}
      mode={match.mode}
      question={toPublicQuestion(match.question)}
      you={{ userId: you.userId, username: you.user.username, rating: you.user.rating }}
      rival={{ userId: rival.userId, username: rival.user.username, rating: rival.user.rating }}
    />
  );
}
