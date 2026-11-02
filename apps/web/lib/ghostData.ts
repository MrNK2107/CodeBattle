import { ghostFramesForViewer, rankGhosts, type Ghost } from '@/lib/ghost';
import { prisma } from '@/lib/prisma';

/** True once the viewer has an accepted practice attempt on the question. */
export async function hasSolvedInPractice(questionId: string, viewerId: string): Promise<boolean> {
  const n = await prisma.practiceAttempt.count({ where: { userId: viewerId, questionId, status: 'ACCEPTED' } });
  return n > 0;
}

/**
 * Recorded battle sides on this problem that can be raced in practice.
 *
 * Questions stay in the ranked pool, so a recorded solution is a copy-ready
 * answer to someone's future battle. The race itself only needs the timeline
 * (line counts, progress, submit time); the code in each snapshot is included
 * only for viewers who have already solved the problem in practice, and the
 * check is made here on the server so the browser never receives it otherwise.
 * No ghosts at all are offered while the viewer is battling on the same problem.
 */
export async function loadGhosts(questionId: string, viewerId: string, limit = 6): Promise<Ghost[]> {
  const [battling, codeUnlocked] = await Promise.all([
    prisma.match.count({
      where: { questionId, status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId: viewerId } } },
    }),
    hasSolvedInPractice(questionId, viewerId),
  ]);
  if (battling) return [];

  const sides = await prisma.matchPlayer.findMany({
    where: { match: { questionId, status: 'COMPLETED', startedAt: { not: null } } },
    orderBy: { match: { endedAt: 'desc' } },
    take: 40,
    include: {
      user: { select: { username: true } },
      match: {
        select: {
          startedAt: true,
          endedAt: true,
          submissions: { select: { userId: true, status: true, submittedAt: true, passedTests: true, totalTests: true, language: true } },
        },
      },
    },
  });

  const ghosts: Ghost[] = sides.map(side => {
    const start = side.match.startedAt!.getTime();
    const sub = side.match.submissions.find(s => s.userId === side.userId) ?? null;
    const frames = ghostFramesForViewer(side.replay, codeUnlocked);
    return {
      id: side.id,
      username: side.user.username,
      rating: side.ratingBefore,
      frames,
      submitAtMs: sub && sub.status !== 'PENDING' ? Math.max(0, sub.submittedAt.getTime() - start) : null,
      verdict: sub && sub.status !== 'PENDING' ? sub.status : null,
      passed: sub?.passedTests ?? 0,
      total: sub?.totalTests ?? 0,
      language: sub?.language ?? frames[frames.length - 1]?.language ?? null,
      recordedAt: (side.match.endedAt ?? side.match.startedAt!).toISOString(),
      codeUnlocked,
    };
  });
  return rankGhosts(ghosts).slice(0, limit);
}
