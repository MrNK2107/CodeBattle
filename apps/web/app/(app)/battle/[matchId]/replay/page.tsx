import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ReplayViewer, type ReplayFrame } from '@/components/replay/ReplayViewer';
import { auth } from '@/lib/auth';
import { VERDICT_LABEL } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Replay' };

interface ReplayTrackInput {
  name: string;
  frames: ReplayFrame[];
  verdict: string | null;
  submitAt: number | null;
  accepted: boolean;
}

export default async function ReplayPage({ params }: { params: { matchId: string } }): Promise<JSX.Element> {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect(`/login?callbackUrl=/battle/${params.matchId}/replay`);

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: {
      question: { select: { title: true } },
      players: { include: { user: { select: { username: true } } } },
      submissions: { select: { userId: true, status: true, passedTests: true, totalTests: true, submittedAt: true } },
    },
  });
  if (!match) notFound();
  // replays reveal both solutions, so only finished battles have one
  if (match.status !== 'COMPLETED') redirect(`/battle/${match.id}`);

  const players = [...match.players].sort((a, b) => (a.userId === viewerId ? -1 : b.userId === viewerId ? 1 : 0));
  const start = match.startedAt ?? match.createdAt;
  const durationMs = (match.endedAt ?? new Date()).getTime() - start.getTime();
  const tracks = players.slice(0, 2).map(p => {
    const sub = match.submissions.find(s => s.userId === p.userId);
    const judged = sub && sub.status !== 'PENDING';
    return {
      name: p.user.username,
      frames: (Array.isArray(p.replay) ? p.replay : []) as unknown as ReplayFrame[],
      verdict: judged ? `${VERDICT_LABEL[sub.status]} ${sub.passedTests}/${sub.totalTests}` : null,
      submitAt: judged ? Math.max(0, sub.submittedAt.getTime() - start.getTime()) : null,
      accepted: sub?.status === 'ACCEPTED',
    };
  }) as [ReplayTrackInput, ReplayTrackInput];
  const empty = tracks.every(t => t.frames.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Battle replay</p>
          <h1 className="text-3xl font-semibold">Replay</h1>
          <p className="text-muted">
            {match.question.title}: {tracks.map(t => t.name).join(' against ')}
          </p>
        </div>
        <Link className="btn-quiet" href={`/battle/${match.id}/results`}>
          Back to results
        </Link>
      </div>
      {empty || tracks.length < 2 ? (
        <p className="panel p-6 text-muted">No code was recorded for this battle.</p>
      ) : (
        <ReplayViewer tracks={tracks} durationMs={durationMs} />
      )}
    </div>
  );
}
