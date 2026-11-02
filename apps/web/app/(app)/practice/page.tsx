import { redirect } from 'next/navigation';

import { ProblemList, type ProblemRow } from '@/components/problem/ProblemList';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Practice' };

export default async function PracticePage(): Promise<JSX.Element> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login?callbackUrl=/practice');

  const [questions, attempts] = await Promise.all([
    prisma.question.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, title: true, difficulty: true, tags: true },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    }),
    prisma.practiceAttempt.findMany({ where: { userId }, select: { questionId: true, status: true } }),
  ]);
  const solved = new Set(attempts.filter(a => a.status === 'ACCEPTED').map(a => a.questionId));
  const tried = new Set(attempts.map(a => a.questionId));
  const order = { EASY: 0, MEDIUM: 1, HARD: 2 } as const;

  const rows: ProblemRow[] = questions
    .sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title))
    .map(q => ({ ...q, state: solved.has(q.id) ? 'solved' : tried.has(q.id) ? 'tried' : 'new' }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Practice</h1>
        <p className="text-muted">
          Every battle problem, unranked and untimed. Solved {solved.size} of {questions.length}.
        </p>
      </div>
      <ProblemList rows={rows} />
    </div>
  );
}
