import { PrismaClient } from "@prisma/client";
import { buildQuestionCreateData } from "./seed-helpers";
import { seedQuestions } from "./seed-questions";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const question of seedQuestions) {
    const created = await prisma.question.upsert({
      where: { slug: question.slug },
      update: {},
      create: buildQuestionCreateData(question),
    });
    console.log(`Seeded question ${created.slug}`);
  }

  const total = await prisma.question.count();
  console.log(`Total questions in database: ${total}`);
}

main()
  .catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
