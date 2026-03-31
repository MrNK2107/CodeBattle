import { Difficulty } from '@prisma/client';

export type SeedTestCase = { input: string; expected: string };

export type SeedQuestionInput = {
  title: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  tags: string[];
  starterCode: { python: string; javascript: string; java: string };
  visibleTests: SeedTestCase[];
  hiddenTests: SeedTestCase[];
  optimalBigO: string;
  optimalSpace: string;
};

export function buildQuestionCreateData(input: SeedQuestionInput) {
  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    difficulty: input.difficulty,
    tags: input.tags,
    starterCode: input.starterCode,
    optimalBigO: input.optimalBigO,
    optimalSpace: input.optimalSpace,
    testCases: {
      createMany: {
        data: input.visibleTests.map(tc => ({ input: tc.input, expected: tc.expected, isHidden: false }))
      }
    },
    hiddenTestCases: {
      createMany: {
        data: input.hiddenTests.map(tc => ({ input: tc.input, expected: tc.expected, isHidden: true }))
      }
    }
  };
}
