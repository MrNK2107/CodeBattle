import { formatArgs, formatValue, type ProblemSignature, type TestCaseResult } from '@codebattle/shared';
import { prisma } from '../prisma';
import type { JudgeTest, TestOutcome } from './judge';

export interface LoadedTest extends JudgeTest {
  hidden: boolean;
  label?: string | null;
}

export interface LoadedQuestion {
  id: string;
  slug: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isActive: boolean;
  signature: ProblemSignature;
  visible: LoadedTest[];
  hidden: LoadedTest[];
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: Promise<LoadedQuestion | null> }>();

/** Question + parsed tests, cached briefly (tests are large and never change mid-match). */
export function loadQuestion(where: { id: string } | { slug: string }): Promise<LoadedQuestion | null> {
  const key = 'id' in where ? `id:${where.id}` : `slug:${where.slug}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = fetchQuestion(where).catch(err => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchQuestion(where: { id: string } | { slug: string }): Promise<LoadedQuestion | null> {
  const question = await prisma.question.findUnique({
    where,
    include: { testCases: { orderBy: { position: 'asc' } } },
  });
  if (!question || !question.signature) return null;
  const tests: LoadedTest[] = question.testCases.map(tc => ({
    args: JSON.parse(tc.input) as unknown[],
    expected: JSON.parse(tc.expected) as unknown,
    hidden: tc.isHidden,
    label: tc.label,
  }));
  return {
    id: question.id,
    slug: question.slug,
    title: question.title,
    difficulty: question.difficulty,
    isActive: question.isActive,
    signature: question.signature as unknown as ProblemSignature,
    visible: tests.filter(t => !t.hidden),
    hidden: tests.filter(t => t.hidden),
  };
}

const MAX_DISPLAY = 400;

function clip(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.length > MAX_DISPLAY ? `${text.slice(0, MAX_DISPLAY)}… (${text.length} chars)` : text;
}

/** Turns judge outcomes into what the player sees (inputs formatted, long values clipped). */
export function toDisplayResults(signature: ProblemSignature, tests: LoadedTest[], outcomes: TestOutcome[]): TestCaseResult[] {
  return outcomes.map((o, index) => {
    const test = tests[index];
    return {
      index,
      input: test.label ? `${test.label}` : clip(formatArgs(signature.params, test.args))!,
      expected: clip(formatValue(test.expected))!,
      actual: clip(o.actual),
      status: o.status,
      passed: o.status === 'passed',
      stdout: o.stdout,
      error: o.error,
      runtimeMs: o.ms,
    };
  });
}
