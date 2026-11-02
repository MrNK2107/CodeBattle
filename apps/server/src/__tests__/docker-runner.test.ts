import { describe, expect, it } from 'vitest';
import type { ProblemSignature } from '@codebattle/shared';
import { judge } from '../services/judge';
import { DockerRunner } from '../services/runners';

/*
 * Opt-in (needs a Docker daemon and the runner images):
 *   DOCKER_TESTS=1 npx vitest run src/__tests__/docker-runner.test.ts
 */
const enabled = process.env.DOCKER_TESTS === '1';
const runner = new DockerRunner();

const twoSum: ProblemSignature = {
  functionName: 'twoSum',
  params: [
    { name: 'nums', type: 'int[]' },
    { name: 'target', type: 'int' },
  ],
  returns: 'int[]',
};
const tests = [
  { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
  { args: [[3, 2, 4], 6], expected: [1, 2] },
];

describe.skipIf(!enabled)('DockerRunner', () => {
  it('judges python, javascript and java in containers', async () => {
    const py = 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n';
    const js = 'function twoSum(nums, target) {\n  const m = new Map();\n  for (let i = 0; i < nums.length; i++) { if (m.has(target - nums[i])) return [m.get(target - nums[i]), i]; m.set(nums[i], i); }\n}\n';
    const java =
      'import java.util.*;\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> m = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) { if (m.containsKey(target - nums[i])) return new int[] { m.get(target - nums[i]), i }; m.put(nums[i], i); }\n        return new int[0];\n    }\n}\n';
    for (const [language, code] of [['python', py], ['javascript', js], ['java', java]] as const) {
      const result = await judge(twoSum, language, code, tests, runner);
      expect(result.verdict, `${language}: ${result.message ?? JSON.stringify(result.outcomes)}`).toBe('ACCEPTED');
    }
  }, 180_000);

  it('has no network access', async () => {
    const code = `function twoSum() {
  require('child_process').execSync('getent hosts example.com', { stdio: 'pipe' });
  return [0, 1];
}`;
    const result = await judge(twoSum, 'javascript', code, tests.slice(0, 1), runner);
    expect(result.verdict).toBe('RUNTIME_ERROR');
  }, 60_000);

  it('cannot write outside /tmp', async () => {
    const code = "def two_sum(nums, target):\n    open('/usr/hack.txt', 'w').write('x')\n    return [0, 1]\n";
    const result = await judge(twoSum, 'python', code, tests.slice(0, 1), runner);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.outcomes[0].error).toMatch(/Read-only|Permission/i);
  }, 60_000);

  it('carries a maximum-size submission', async () => {
    const padding = `// ${'x'.repeat(200)}\n`.repeat(300); // ~61 KB, just under MAX_CODE_LENGTH
    const code = `${padding}class Solution {\n    public int[] twoSum(int[] nums, int target) { return new int[] { 0, 1 }; }\n}\n`;
    expect(code.length).toBeLessThan(64_000);
    const result = await judge(twoSum, 'java', code, tests.slice(0, 1), runner);
    expect(result.verdict, result.message).toBe('ACCEPTED');
  }, 120_000);

  it('a program exiting 125 is a runtime error, not a judge outage', async () => {
    for (const [language, code] of [
      ['python', 'import sys\ndef two_sum(nums, target):\n    sys.stderr.write("Cannot connect to the Docker daemon\\n")\n    sys.exit(125)\n'],
      ['java', 'class Solution {\n    public int[] twoSum(int[] nums, int target) { System.exit(125); return null; }\n}\n'],
    ] as const) {
      const result = await judge(twoSum, language, code, tests.slice(0, 1), runner);
      expect(result.verdict, language).toBe('RUNTIME_ERROR');
    }
  }, 120_000);

  it('gives C++ the raised stack (1e6-deep recursion) and explains a segfault', async () => {
    const chainSum: ProblemSignature = { functionName: 'chainSum', params: [{ name: 'n', type: 'int' }], returns: 'long' };
    const deep = `class Solution {
    long long go(vector<vector<int>>& g, int u) { long long s = u; for (int v : g[u]) s += go(g, v); return s; }
public:
    long long chainSum(int n) { vector<vector<int>> g(n); for (int i = 0; i + 1 < n; i++) g[i].push_back(i + 1); return go(g, 0); }
};`;
    const ok = await judge(chainSum, 'cpp', deep, [{ args: [1_000_000], expected: 499_999_500_000 }], runner);
    expect(ok.verdict, ok.message ?? JSON.stringify(ok.outcomes)).toBe('ACCEPTED');
    const crash = 'class Solution {\npublic:\n    long long chainSum(int n) { int* volatile p = nullptr; return *p + n; }\n};\n';
    const bad = await judge(chainSum, 'cpp', crash, [{ args: [1], expected: 1 }], runner);
    expect(bad.verdict).toBe('RUNTIME_ERROR');
    expect(bad.outcomes[0].error).toMatch(/SIGSEGV/);
  }, 180_000);

  it('kills runaway programs', async () => {
    const result = await judge(twoSum, 'javascript', 'function twoSum() { for (;;) {} }', tests, runner);
    expect(result.verdict).toBe('TIME_LIMIT');
  }, 60_000);

  it('contains fork bombs with the pids limit', async () => {
    const code = "import os\ndef two_sum(nums, target):\n    for _ in range(1000):\n        os.fork()\n    return [0, 1]\n";
    const result = await judge(twoSum, 'python', code, tests.slice(0, 1), runner);
    expect(result.verdict).not.toBe('ACCEPTED');
  }, 60_000);
});
