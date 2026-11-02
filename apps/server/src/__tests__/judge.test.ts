import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import type { ProblemSignature } from '@codebattle/shared';
import { judge } from '../services/judge';
import { parseDriverOutput, remapLineNumbers } from '../services/harness';
import { LocalProcessRunner } from '../services/runners';

const has = (cmd: string) => {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const hasPython = has(`${process.platform === 'win32' ? 'python' : 'python3'} --version`);
const hasJava = has('javac -version') && has('java -version');

const runner = new LocalProcessRunner();

const twoSum: ProblemSignature = {
  functionName: 'twoSum',
  params: [
    { name: 'nums', type: 'int[]' },
    { name: 'target', type: 'int' },
  ],
  returns: 'int[]',
};
const twoSumTests = [
  { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
  { args: [[3, 2, 4], 6], expected: [1, 2] },
];

const reverseList: ProblemSignature = {
  functionName: 'reverseList',
  params: [{ name: 'head', type: 'ListNode' }],
  returns: 'ListNode',
};
const maxDepth: ProblemSignature = {
  functionName: 'maxDepth',
  params: [{ name: 'root', type: 'TreeNode' }],
  returns: 'int',
};
const invert: ProblemSignature = {
  functionName: 'invertTree',
  params: [{ name: 'root', type: 'TreeNode' }],
  returns: 'TreeNode',
};
const groupAnagrams: ProblemSignature = {
  functionName: 'groupAnagrams',
  params: [{ name: 'strs', type: 'string[]' }],
  returns: 'string[][]',
  compare: 'unordered-nested',
};

describe('judge: javascript', () => {
  it('accepts a correct solution and captures prints per test', async () => {
    const code = `function twoSum(nums, target) {
  const seen = new Map();
  console.log('checking', nums.length);
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
}`;
    const result = await judge(twoSum, 'javascript', code, twoSumTests, runner);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passed).toBe(2);
    expect(result.outcomes[0].stdout).toBe('checking 4\n');
    expect(result.outcomes[0].actual).toBe('[0,1]');
  });

  it('reports wrong answers with the actual value', async () => {
    const result = await judge(twoSum, 'javascript', 'function twoSum() { return [9, 9]; }', twoSumTests, runner);
    expect(result.verdict).toBe('WRONG_ANSWER');
    expect(result.outcomes[0]).toMatchObject({ status: 'wrong', actual: '[9,9]' });
  });

  it('reports runtime errors with the player line number', async () => {
    const code = 'function twoSum(nums) {\n  return nums.missing.length;\n}';
    const result = await judge(twoSum, 'javascript', code, twoSumTests, runner);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.outcomes[0].error).toMatch(/TypeError.*\(line 2\)/);
  });

  it('reports syntax errors as compile errors', async () => {
    const result = await judge(twoSum, 'javascript', 'function twoSum( {', twoSumTests, runner);
    expect(result.verdict).not.toBe('ACCEPTED');
    expect(result.outcomes[0].error ?? result.message).toMatch(/SyntaxError/);
  });

  it('flags a missing function', async () => {
    const result = await judge(twoSum, 'javascript', 'function other() {}', twoSumTests, runner);
    expect(result.verdict).toBe('COMPILE_ERROR');
    expect(result.message).toMatch(/twoSum was not found/);
  });

  it('supports LeetCode-style var assignments and a user-defined ListNode', async () => {
    const code = `class ListNode { constructor(val, next) { this.val = val; this.next = next ?? null; } }
var reverseList = function(head) {
  let prev = null;
  while (head) { const next = head.next; head.next = prev; prev = head; head = next; }
  return prev;
};`;
    const result = await judge(reverseList, 'javascript', code, [{ args: [[1, 2, 3]], expected: [3, 2, 1] }, { args: [[]], expected: [] }], runner);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('times out infinite loops', async () => {
    const result = await judge(twoSum, 'javascript', 'function twoSum() { while (true) {} }', twoSumTests, runner);
    expect(result.verdict).toBe('TIME_LIMIT');
    expect(result.outcomes[0].status).toBe('timeout');
    expect(result.outcomes[1].status).toBe('not_run');
  }, 20_000);

  it('compares unordered-nested results', async () => {
    const code = `function groupAnagrams(strs) {
  const m = new Map();
  for (const s of strs) { const k = [...s].sort().join(''); m.set(k, [...(m.get(k) ?? []), s]); }
  return [...m.values()].reverse();
}`;
    const result = await judge(groupAnagrams, 'javascript', code, [
      { args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] },
    ], runner);
    expect(result.verdict).toBe('ACCEPTED');
  });
});

describe.skipIf(!hasPython)('judge: python', () => {
  it('accepts snake_case functions with type hints', async () => {
    const code = `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}
    print("hi")
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []
`;
    const result = await judge(twoSum, 'python', code, twoSumTests, runner);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.outcomes[1].stdout).toBe('hi\n');
  });

  it('accepts a LeetCode-style Solution class', async () => {
    const code = `class Solution:
    def twoSum(self, nums, target):
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return (i, j)
`;
    const result = await judge(twoSum, 'python', code, twoSumTests, runner);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('builds trees and serializes them back', async () => {
    const code = `def invert_tree(root):
    if root:
        root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root
`;
    const result = await judge(invert, 'python', code, [{ args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] }, { args: [[]], expected: [] }], runner);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('handles deep recursion', async () => {
    const code = `def max_depth(root):
    return 0 if root is None else 1 + max(max_depth(root.left), max_depth(root.right))
`;
    const chain: (number | null)[] = [1];
    for (let i = 2; i <= 3000; i++) chain.push(null, i);
    const result = await judge(maxDepth, 'python', code, [{ args: [chain], expected: 3000 }], runner);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it('reports exceptions with the player line number and keeps judging', async () => {
    const code = `def two_sum(nums, target):
    if target == 9:
        raise ValueError("boom")
    return [1, 2]
`;
    const result = await judge(twoSum, 'python', code, twoSumTests, runner);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.outcomes[0].error).toBe('ValueError: boom (line 3)');
    expect(result.outcomes[1].status).toBe('passed');
  });

  it('remaps syntax error lines', async () => {
    const result = await judge(twoSum, 'python', 'def two_sum(nums, target)\n    return []\n', twoSumTests, runner);
    expect(result.verdict).not.toBe('ACCEPTED');
    expect(result.outcomes[0].error).toMatch(/line 1/);
  });
});

describe.skipIf(!hasJava)('judge: java', () => {
  it('accepts a Solution class (public is allowed)', async () => {
    const code = `import java.util.*;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        System.out.println("hi");
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) return new int[] { seen.get(target - nums[i]), i };
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
`;
    const result = await judge(twoSum, 'java', code, twoSumTests, runner);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.outcomes[0].stdout?.trim()).toBe('hi');
  }, 60_000);

  it('reports compile errors with player line numbers', async () => {
    const code = 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return nope;\n    }\n}\n';
    const result = await judge(twoSum, 'java', code, twoSumTests, runner);
    expect(result.verdict).toBe('COMPILE_ERROR');
    expect(result.message).toMatch(/line 3/);
  }, 60_000);

  it('handles lists, trees and nested string lists', async () => {
    const list = `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null;
        while (head != null) { ListNode n = head.next; head.next = prev; prev = head; head = n; }
        return prev;
    }
}`;
    expect((await judge(reverseList, 'java', list, [{ args: [[1, 2, 3]], expected: [3, 2, 1] }], runner)).verdict).toBe('ACCEPTED');

    const groups = `import java.util.*;
class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> m = new HashMap<>();
        for (String s : strs) { char[] c = s.toCharArray(); Arrays.sort(c); m.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(s); }
        return new ArrayList<>(m.values());
    }
}`;
    const res = await judge(groupAnagrams, 'java', groups, [{ args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] }], runner);
    expect(res.verdict).toBe('ACCEPTED');
  }, 60_000);

  it('reports exceptions per test', async () => {
    const code = 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[] { nums[10] };\n    }\n}\n';
    const result = await judge(twoSum, 'java', code, twoSumTests, runner);
    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.outcomes[0].error).toMatch(/ArrayIndexOutOfBoundsException.*\(line 3\)/);
  }, 60_000);
});

describe('tamper resistance', () => {
  const busy = (ms: number) => `const until = Date.now() + ${ms}; while (Date.now() < until) {}`;

  it('javascript: patching the clock after load does not fake runtimes', async () => {
    const code = `process.hrtime.bigint = () => 0n;
function twoSum(nums, target) { ${busy(60)} return [0, 1]; }`;
    const result = await judge(twoSum, 'javascript', code, twoSumTests.slice(0, 1), runner);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.outcomes[0].ms ?? 0).toBeGreaterThan(40);
  });

  it('javascript: toJSON tricks cannot inject fields into result lines', async () => {
    const code = `function twoSum() { const r = [0, 1]; r.toJSON = () => '","ms":-5,"x":"'; return r; }`;
    const result = await judge(twoSum, 'javascript', code, twoSumTests.slice(0, 1), runner);
    // the serializer rebuilds the array, so the injected toJSON never runs
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.outcomes[0].actual).toBe('[0,1]');
    expect(result.runtimeMs).toBeGreaterThanOrEqual(0);
  });

  it('javascript: stdin is consumed before player code runs', async () => {
    const code = `let leaked = ''; try { leaked = require('fs').readFileSync(0, 'utf8'); } catch {}
function twoSum() { return leaked.length > 0 ? [9, 9] : [0, 1]; }`;
    const result = await judge(twoSum, 'javascript', code, twoSumTests.slice(0, 1), runner);
    expect(result.verdict).toBe('ACCEPTED');
  });

  it.skipIf(!hasPython)('python: patching time.perf_counter does not fake runtimes', async () => {
    const code = `import time
time.perf_counter = lambda: 0.0
def two_sum(nums, target):
    end = time.time() + 0.06
    while time.time() < end:
        pass
    return [0, 1]
`;
    const result = await judge(twoSum, 'python', code, twoSumTests.slice(0, 1), runner);
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.outcomes[0].ms ?? 0).toBeGreaterThan(40);
  });

  it('rejects duplicated or impossible result lines', () => {
    const nonce = '__N__';
    const line = (i: number, ms: number) => `${nonce}{"i":${i},"ok":true,"ms":${ms},"value":1,"stdout":""}`;
    expect(parseDriverOutput([line(0, 1), line(1, 2)].join('\n'), nonce, 2).tampered).toBe(false);
    expect(parseDriverOutput([line(0, 1), line(0, 1)].join('\n'), nonce, 2).tampered).toBe(true);
    expect(parseDriverOutput(line(0, -3), nonce, 2).tampered).toBe(true);
    expect(parseDriverOutput(line(5, 1), nonce, 2).tampered).toBe(true);
  });
});

describe('remapLineNumbers', () => {
  it('shifts interpreter references back to player lines', () => {
    expect(remapLineNumbers('python', 'File "/tmp/x/main.py", line 20', 15)).toBe('line 5');
    expect(remapLineNumbers('javascript', '/tmp/x/main.js:9\nfoo(', 4)).toBe('line 5\nfoo(');
    expect(remapLineNumbers('java', 'Main.java:7: error: cannot find symbol', 4)).toBe('line 3: error: cannot find symbol');
  });
});
