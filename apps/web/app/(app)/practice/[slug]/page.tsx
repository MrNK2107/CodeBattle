import { notFound, redirect } from 'next/navigation';

import { PracticeRoom } from '@/components/problem/PracticeRoom';
import { auth } from '@/lib/auth';
import { hasSolvedInPractice, loadGhosts } from '@/lib/ghostData';
import { prisma } from '@/lib/prisma';
import { toPublicQuestion, visibleTestsQuery } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const q = await prisma.question.findUnique({ where: { slug: params.slug }, select: { title: true } });
  return { title: q?.title ?? 'Practice' };
}

export default async function PracticeProblemPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { ghost?: string };
}): Promise<JSX.Element> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?callbackUrl=/practice/${params.slug}`);

  const question = await prisma.question.findFirst({
    where: { slug: params.slug, isActive: true },
    include: { testCases: visibleTestsQuery },
  });
  if (!question || !question.signature) notFound();

  // loadGhosts strips ghost code unless the viewer has solved the problem
  const [solved, ghosts] = await Promise.all([hasSolvedInPractice(question.id, userId), loadGhosts(question.id, userId)]);
  const ghost = typeof searchParams.ghost === 'string' ? (ghosts.find(g => g.id === searchParams.ghost) ?? null) : null;
  return <PracticeRoom key={ghost?.id ?? 'solo'} question={toPublicQuestion(question)} solvedBefore={solved} ghosts={ghosts} ghost={ghost} />;
}
