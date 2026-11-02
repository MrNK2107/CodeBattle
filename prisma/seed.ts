import { PrismaClient } from '@prisma/client';
import { materialize, questionBank } from '../packages/problems/src';

const prisma = new PrismaClient();

/**
 * Idempotent: questions are upserted by slug and their tests replaced, so
 * re-running after editing the bank updates the database. Questions removed
 * from the bank are deactivated (old matches still reference them).
 */
async function main(): Promise<void> {
  for (const def of questionBank) {
    const q = materialize(def);
    const data = {
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      tags: q.tags,
      starterCode: q.starterCode,
      signature: q.signature as object,
      constraints: q.constraints,
      optimalBigO: q.optimal.time,
      optimalSpace: q.optimal.space,
      isActive: true,
    };
    const question = await prisma.question.upsert({
      where: { slug: q.slug },
      update: data,
      create: { slug: q.slug, ...data },
    });
    await prisma.$transaction([
      prisma.testCase.deleteMany({ where: { questionId: question.id } }),
      prisma.testCase.createMany({
        data: q.tests.map((t, position) => ({
          questionId: question.id,
          input: JSON.stringify(t.args),
          expected: JSON.stringify(t.expected),
          isHidden: t.hidden,
          position,
          explanation: t.explanation ?? null,
          label: t.label ?? null,
        })),
      }),
    ]);
    console.log(`seeded ${q.slug} (${q.tests.length} tests)`);
  }

  const retired = await prisma.question.updateMany({
    where: { slug: { notIn: questionBank.map(q => q.slug) }, isActive: true },
    data: { isActive: false },
  });
  if (retired.count) console.log(`deactivated ${retired.count} questions no longer in the bank`);

  const active = await prisma.question.count({ where: { isActive: true } });
  console.log(`active questions: ${active}`);
}

main()
  .catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
