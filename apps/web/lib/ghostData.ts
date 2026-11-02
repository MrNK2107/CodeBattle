import { parseFrames, rankGhosts, type Ghost } from '@/lib/ghost';
import { prisma } from '@/lib/prisma';

/**
 * Recorded battle sides on this problem that can be raced in practice. Ghosts show
 * another player's code, so none are offered while the viewer is battling on the
 * same problem.
 */
export async function loadGhosts(questionId: string, viewerId: string, limit = 6): Promise<Ghost[]> {
  const battling = await prisma.match.count({
    where: { questionId, status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId: viewerId } } },
  });
  if (battling) return [];

  const sides = await prisma.matchPlayer.findMany({
    where: { match: { questionId, status: 'COMPLETED', startedAt: { not: null } } },
    orderBy: { match: { endedAt: 'desc' } },
    take: 40,
    include: {
      user: { select: { username: true } },
      match: { select: { startedAt: true, endedAt: true, submissions: true } },
    },
  });

  const ghosts: Ghost[] = sides.map(side => {
    const start = side.match.startedAt!.getTime();
    const sub = side.match.submissions.find(s => s.userId === side.userId) ?? null;
    const frames = parseFrames(side.replay);
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
    };
  });
  return rankGhosts(ghosts).slice(0, limit);
}
