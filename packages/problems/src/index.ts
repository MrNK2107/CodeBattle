import { allStarterCode, type Language, type ProblemSignature } from '@codebattle/shared';
import { easy } from './bank/easy';
import { hard } from './bank/hard';
import { medium } from './bank/medium';
import { medium2 } from './bank/medium2';
import { createRng, seedFor, type QuestionDef } from './types';

export * from './types';

export const questionBank: QuestionDef[] = [...easy, ...medium, ...medium2, ...hard];

export interface MaterializedTest {
  args: unknown[];
  expected: unknown;
  hidden: boolean;
  explanation?: string;
  label?: string;
}

export interface MaterializedQuestion {
  slug: string;
  title: string;
  difficulty: QuestionDef['difficulty'];
  tags: string[];
  description: string;
  constraints: string[];
  signature: ProblemSignature;
  optimal: QuestionDef['optimal'];
  starterCode: Record<Language, string>;
  tests: MaterializedTest[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Expands stress generators (deterministically) and computes their expected values. */
export function materialize(question: QuestionDef): MaterializedQuestion {
  const stress: MaterializedTest[] = (question.stress ?? []).map((s, i) => {
    const args = s.generate(createRng(seedFor(`${question.slug}:${i}`)));
    return { args, expected: question.reference(...clone(args)), hidden: true, label: s.label };
  });
  return {
    slug: question.slug,
    title: question.title,
    difficulty: question.difficulty,
    tags: question.tags,
    description: question.description,
    constraints: question.constraints,
    signature: question.signature,
    optimal: question.optimal,
    starterCode: allStarterCode(question.signature),
    tests: [
      ...question.examples.map(e => ({ args: e.args, expected: e.expected, hidden: false, explanation: e.explanation })),
      ...question.tests.map(t => ({ args: t.args, expected: t.expected, hidden: true })),
      ...stress,
    ],
  };
}
