import { completeStarterCode, formatArgs, formatValue, type Language, type ProblemSignature } from '@codebattle/shared';

export interface PublicExample {
  input: string;
  expected: string;
  explanation?: string;
}

export interface PublicQuestion {
  id: string;
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  tags: string[];
  constraints: string[];
  optimalBigO: string;
  optimalSpace: string;
  starterCode: Record<Language, string>;
  signature: ProblemSignature;
  examples: PublicExample[];
}

interface QuestionRow {
  id: string;
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  tags: string[];
  constraints: string[];
  optimalBigO: string;
  optimalSpace: string;
  starterCode: unknown;
  signature: unknown;
  testCases: { input: string; expected: string; explanation: string | null; isHidden: boolean }[];
}

/** What a player may see of a question: never hidden tests. */
export function toPublicQuestion(q: QuestionRow): PublicQuestion {
  const signature = q.signature as ProblemSignature;
  return {
    id: q.id,
    slug: q.slug,
    title: q.title,
    difficulty: q.difficulty,
    description: q.description,
    tags: q.tags,
    constraints: q.constraints,
    optimalBigO: q.optimalBigO,
    optimalSpace: q.optimalSpace,
    starterCode: completeStarterCode(q.starterCode, signature),
    signature,
    examples: q.testCases
      .filter(tc => !tc.isHidden)
      .map(tc => ({
        input: formatArgs(signature.params, JSON.parse(tc.input) as unknown[]),
        expected: formatValue(JSON.parse(tc.expected)),
        explanation: tc.explanation ?? undefined,
      })),
  };
}

export const visibleTestsQuery = { where: { isHidden: false }, orderBy: { position: 'asc' as const } };
