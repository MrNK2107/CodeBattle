import { randomBytes } from 'crypto';
import {
  formatValue,
  valuesMatch,
  type Language,
  type ProblemSignature,
  type SubmissionStatus,
  type TestOutcomeStatus,
} from '@codebattle/shared';
import { buildProgram, buildStdin, parseDriverOutput, remapLineNumbers } from './harness';
import { getRunner, type CodeRunner } from './runners';

export type SubmissionVerdict = Exclude<SubmissionStatus, 'PENDING'>;

export interface JudgeTest {
  args: unknown[];
  expected: unknown;
}

export interface TestOutcome {
  status: TestOutcomeStatus;
  /** JSON of what the function returned */
  actual?: string;
  stdout?: string;
  error?: string;
  ms?: number;
}

export interface JudgeResult {
  verdict: SubmissionVerdict;
  outcomes: TestOutcome[];
  passed: number;
  total: number;
  /** total time spent inside the player's function across all tests */
  runtimeMs: number;
  memoryKb?: number;
  /** compile error, missing function or a crash outside any test */
  message?: string;
}

/** Per-test budget; programs get this per test plus a startup allowance. */
export const PER_TEST_LIMIT_MS: Record<Language, number> = { python: 3000, javascript: 2000, java: 2000, cpp: 1000 };
const STARTUP_MS: Record<Language, number> = { python: 1500, javascript: 1000, java: 2000, cpp: 500 };
const MAX_PROGRAM_MS = 20_000;

export function programTimeLimit(language: Language, tests: number): number {
  return Math.min(STARTUP_MS[language] + PER_TEST_LIMIT_MS[language] * Math.max(tests, 1), MAX_PROGRAM_MS);
}

export async function judge(
  signature: ProblemSignature,
  language: Language,
  code: string,
  tests: JudgeTest[],
  runner: CodeRunner = getRunner()
): Promise<JudgeResult> {
  const nonce = `__CB_${randomBytes(8).toString('hex')}__`;
  const program = buildProgram(language, signature, code);
  const execution = await runner.execute({
    language,
    source: program.source,
    stdin: buildStdin(nonce, tests.map(t => t.args)),
    timeLimitMs: programTimeLimit(language, tests.length),
  });

  const total = tests.length;
  const notRun = (): TestOutcome[] => tests.map(() => ({ status: 'not_run' as const }));

  if (execution.status === 'compile_error') {
    return {
      verdict: 'COMPILE_ERROR',
      outcomes: notRun(),
      passed: 0,
      total,
      runtimeMs: 0,
      message: trimMessage(remapLineNumbers(language, execution.compileOutput ?? execution.stderr, program.prefixLines)),
    };
  }
  if (execution.status === 'internal_error') {
    throw new Error(`Code runner failed: ${execution.stderr.slice(0, 500)}`);
  }

  const parsed = parseDriverOutput(execution.stdout, nonce, tests.length);
  if (parsed.tampered) {
    return {
      verdict: 'RUNTIME_ERROR',
      outcomes: notRun(),
      passed: 0,
      total,
      runtimeMs: 0,
      message: 'The judge received results it did not produce (duplicate or malformed test output). Don’t write to the judge’s output channel.',
    };
  }
  if (parsed.fatal) {
    return { verdict: 'COMPILE_ERROR', outcomes: notRun(), passed: 0, total, runtimeMs: 0, message: parsed.fatal };
  }

  const byIndex = new Map(parsed.lines.map(line => [line.i, line]));
  const outcomes: TestOutcome[] = [];
  let firstMissing = true;
  for (let i = 0; i < tests.length; i++) {
    const line = byIndex.get(i);
    if (!line) {
      // the program stopped before this test: blame the first missing one on the crash / timeout
      if (firstMissing) {
        firstMissing = false;
        const crashed = execution.status === 'runtime_error' || (execution.status === 'ok' && parsed.lines.length === 0);
        outcomes.push({
          status: execution.status === 'time_limit' ? 'timeout' : crashed ? 'error' : 'not_run',
          error:
            execution.status === 'time_limit'
              ? 'Time limit exceeded'
              : trimMessage(remapLineNumbers(language, execution.stderr, program.prefixLines)) || 'Program exited unexpectedly',
        });
      } else {
        outcomes.push({ status: 'not_run' });
      }
      continue;
    }
    const stdout = line.stdout || undefined;
    if (!line.ok) {
      outcomes.push({ status: 'error', error: line.error, stdout });
      continue;
    }
    const ms = typeof line.ms === 'number' ? Math.round(line.ms * 1000) / 1000 : undefined;
    if (ms !== undefined && ms > PER_TEST_LIMIT_MS[language]) {
      outcomes.push({ status: 'timeout', error: 'Time limit exceeded', ms, stdout });
      continue;
    }
    // an empty list / tree comes back as null; the canonical form is []
    const value = line.value === null && (signature.returns === 'ListNode' || signature.returns === 'TreeNode') ? [] : line.value;
    const passed = valuesMatch(tests[i].expected, value, signature.compare);
    outcomes.push({ status: passed ? 'passed' : 'wrong', actual: formatValue(value), ms, stdout });
  }

  const passed = outcomes.filter(o => o.status === 'passed').length;
  const runtimeMs = outcomes.reduce((sum, o) => sum + (o.ms ?? 0), 0);
  const firstFailure = outcomes.find(o => o.status !== 'passed');
  const verdict: SubmissionVerdict = !firstFailure
    ? 'ACCEPTED'
    : firstFailure.status === 'timeout'
      ? 'TIME_LIMIT'
      : firstFailure.status === 'error'
        ? 'RUNTIME_ERROR'
        : firstFailure.status === 'not_run'
          ? 'RUNTIME_ERROR'
          : 'WRONG_ANSWER';

  return { verdict, outcomes, passed, total, runtimeMs: Math.round(runtimeMs * 1000) / 1000, memoryKb: execution.memoryKb };
}

function trimMessage(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 3000 ? `${trimmed.slice(0, 3000)}\n…` : trimmed;
}
