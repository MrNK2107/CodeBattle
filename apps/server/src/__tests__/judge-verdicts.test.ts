import { describe, expect, it } from 'vitest';
import type { ProblemSignature } from '@codebattle/shared';
import { judge, PER_TEST_LIMIT_MS, programTimeLimit } from '../services/judge';
import type { CodeRunner, ExecutionRequest, ExecutionResult } from '../services/runners';

/*
 * How judge() turns a runner's raw result into per-test outcomes and a verdict,
 * with a scripted runner (no compiler or interpreter involved).
 */

const sig: ProblemSignature = { functionName: 'double', params: [{ name: 'n', type: 'int' }], returns: 'int' };
const tests = [
  { args: [1], expected: 2 },
  { args: [2], expected: 4 },
  { args: [3], expected: 6 },
];

type Line = { i: number; ok: boolean; value?: unknown; ms?: number; error?: string; stdout?: string };

/** Answers with the given driver lines (signed with the request's nonce) and process result. */
function scripted(lines: Line[], result: Partial<ExecutionResult> = {}) {
  const requests: ExecutionRequest[] = [];
  const runner: CodeRunner = {
    name: 'scripted',
    async execute(request) {
      requests.push(request);
      const { nonce } = JSON.parse(request.stdin) as { nonce: string };
      const stdout = lines.map(l => `${nonce}${JSON.stringify(l)}`).join('\n');
      return { status: 'ok', stdout, stderr: '', wallMs: 5, ...result };
    },
  };
  return { runner, requests };
}

const ok = (i: number, value: unknown, ms = 0.5): Line => ({ i, ok: true, value, ms, stdout: '' });

describe('judge verdicts', () => {
  it('accepts when every test passes and sums in-function runtime', async () => {
    const { runner, requests } = scripted([ok(0, 2, 0.25), ok(1, 4, 0.5), ok(2, 6, 0.25)], { memoryKb: 1234 });
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res).toMatchObject({ verdict: 'ACCEPTED', passed: 3, total: 3, runtimeMs: 1, memoryKb: 1234 });
    expect(requests[0].timeLimitMs).toBe(programTimeLimit('cpp', 3));
    expect(requests[0].language).toBe('cpp');
  });

  it('a crash mid-run blames the first unanswered test and explains why', async () => {
    const crash = 'Segmentation fault (SIGSEGV): invalid memory access (null or dangling pointer, out-of-bounds index) or a stack overflow from too-deep recursion';
    const { runner } = scripted([ok(0, 2)], { status: 'runtime_error', stderr: crash });
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.verdict).toBe('RUNTIME_ERROR');
    expect(res.passed).toBe(1);
    expect(res.outcomes.map(o => o.status)).toEqual(['passed', 'error', 'not_run']);
    expect(res.outcomes[1].error).toBe(crash);
  });

  it('a crash with no stderr still says the program exited', async () => {
    const { runner } = scripted([], { status: 'runtime_error' });
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.outcomes[0]).toEqual({ status: 'error', error: 'Program exited unexpectedly' });
  });

  it('a clean exit that answered nothing is an error, not a pass', async () => {
    const { runner } = scripted([]);
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.verdict).toBe('RUNTIME_ERROR');
    expect(res.outcomes.map(o => o.status)).toEqual(['error', 'not_run', 'not_run']);
  });

  it('a program timeout marks the test it was stuck on', async () => {
    const { runner } = scripted([ok(0, 2)], { status: 'time_limit' });
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.verdict).toBe('TIME_LIMIT');
    expect(res.outcomes[1]).toEqual({ status: 'timeout', error: 'Time limit exceeded' });
  });

  it('a single test over its own budget is a time limit even if the answer is right', async () => {
    const { runner } = scripted([ok(0, 2), ok(1, 4, PER_TEST_LIMIT_MS.cpp + 1), ok(2, 6)]);
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.verdict).toBe('TIME_LIMIT');
    expect(res.outcomes[1].status).toBe('timeout');
    expect(res.outcomes[2].status).toBe('passed');
  });

  it('the first failure decides the verdict', async () => {
    const wrongFirst = scripted([ok(0, 3), { i: 1, ok: false, error: 'Exception: boom' }, ok(2, 6)]);
    expect((await judge(sig, 'cpp', 'code', tests, wrongFirst.runner)).verdict).toBe('WRONG_ANSWER');
    const errorFirst = scripted([{ i: 0, ok: false, error: 'Exception: boom' }, ok(1, 5), ok(2, 6)]);
    const res = await judge(sig, 'cpp', 'code', tests, errorFirst.runner);
    expect(res.verdict).toBe('RUNTIME_ERROR');
    expect(res.outcomes[1]).toMatchObject({ status: 'wrong', actual: '5' });
  });

  it('compile errors are reported once and no test runs', async () => {
    const { runner } = scripted([], { status: 'compile_error', compileOutput: 'error: expected ;' });
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.verdict).toBe('COMPILE_ERROR');
    expect(res.message).toContain('expected ;');
    expect(res.outcomes.every(o => o.status === 'not_run')).toBe(true);
  });

  it('a runner outage throws so the submission is withdrawn instead of judged', async () => {
    const { runner } = scripted([], { status: 'internal_error', stderr: 'Judge0 request failed: 503' });
    await expect(judge(sig, 'cpp', 'code', tests, runner)).rejects.toThrow('Code runner failed: Judge0 request failed: 503');
  });

  it('lines signed with another nonce are ignored', async () => {
    const runner: CodeRunner = {
      name: 'forger',
      async execute() {
        return { status: 'ok', stdout: `__CB_0000000000000000__${JSON.stringify(ok(0, 2))}`, stderr: '', wallMs: 1 };
      },
    };
    const res = await judge(sig, 'cpp', 'code', tests, runner);
    expect(res.passed).toBe(0);
    expect(res.verdict).toBe('RUNTIME_ERROR');
  });

  it('an empty list or tree may come back as null', async () => {
    const list: ProblemSignature = { functionName: 'f', params: [{ name: 'head', type: 'ListNode' }], returns: 'ListNode' };
    const { runner } = scripted([ok(0, null)]);
    const res = await judge(list, 'cpp', 'code', [{ args: [[]], expected: [] }], runner);
    expect(res.verdict).toBe('ACCEPTED');
  });
});

describe('programTimeLimit', () => {
  it('is startup plus a per-test budget, capped at 20 s', () => {
    expect(programTimeLimit('cpp', 3)).toBe(500 + 3 * PER_TEST_LIMIT_MS.cpp);
    expect(programTimeLimit('python', 0)).toBe(1500 + PER_TEST_LIMIT_MS.python);
    expect(programTimeLimit('java', 1000)).toBe(20_000);
  });
});
