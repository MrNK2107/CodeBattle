import { PrismaClient, Difficulty } from '@prisma/client';

const prisma = new PrismaClient();

type StarterCode = {
  python: string;
  javascript: string;
  java: string;
};

type SeedQuestion = {
  title: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  tags: string[];
  starterCode: StarterCode;
  visibleTests: { input: string; expected: string }[];
  hiddenTests: { input: string; expected: string }[];
  optimalBigO: string;
  optimalSpace: string;
};

const sampleQuestions: SeedQuestion[] = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Return indices of the two numbers such that they add up to target.',
    difficulty: 'EASY',
    tags: ['arrays', 'hash-map'],
    starterCode: {
      python: 'def two_sum(nums, target):\n    pass',
      javascript: 'function twoSum(nums, target) {\n}\n',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[0];\n    }\n}\n'
    },
    visibleTests: [
      { input: 'nums=[2,7,11,15], target=9', expected: '[0,1]' },
      { input: 'nums=[3,2,4], target=6', expected: '[1,2]' },
      { input: 'nums=[3,3], target=6', expected: '[0,1]' }
    ],
    hiddenTests: [
      { input: 'nums=[1,5,5,11], target=10', expected: '[1,2]' }
    ],
    optimalBigO: 'O(n)',
    optimalSpace: 'O(n)'
  }
  // TODO: add full bank of 50+ questions covering required categories
];

async function main(): Promise<void> {
  for (const question of sampleQuestions) {
    const created = await prisma.question.upsert({
      where: { slug: question.slug },
      update: {},
      create: {
        title: question.title,
        slug: question.slug,
        description: question.description,
        difficulty: question.difficulty,
        tags: question.tags,
        starterCode: question.starterCode,
        optimalBigO: question.optimalBigO,
        optimalSpace: question.optimalSpace,
        testCases: {
          createMany: {
            data: question.visibleTests.map(tc => ({
              input: tc.input,
              expected: tc.expected,
              isHidden: false
            }))
          }
        },
        hiddenTestCases: {
          createMany: {
            data: question.hiddenTests.map(tc => ({
              input: tc.input,
              expected: tc.expected,
              isHidden: true
            }))
          }
        }
      }
    });
    console.log(`Seeded question ${created.slug}`);
  }
}

main()
  .catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
