import { describe, expect, it } from 'vitest';
import { completeStarterCode, starterCode, type ProblemSignature } from '@codebattle/shared';
import { buildProgram, remapLineNumbers } from '../services/harness';
import { judge } from '../services/judge';
import { analyzeQuality } from '../services/quality';
import { LocalProcessRunner } from '../services/runners';
import { cppRunner, WslCppRunner } from './support/cpp';

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
const reverseList: ProblemSignature = { functionName: 'reverseList', params: [{ name: 'head', type: 'ListNode' }], returns: 'ListNode' };
const invertTree: ProblemSignature = { functionName: 'invertTree', params: [{ name: 'root', type: 'TreeNode' }], returns: 'TreeNode' };
const groupAnagrams: ProblemSignature = {
  functionName: 'groupAnagrams',
  params: [{ name: 'strs', type: 'string[]' }],
  returns: 'string[][]',
  compare: 'unordered-nested',
};

const TWO_SUM_CPP = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        cout << "checking " << nums.size() << endl;
        for (int i = 0; i < (int) nums.size(); i++) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
`;

describe('C++ starter code', () => {
  it('declares a Solution method with LeetCode-style types', () => {
    const code = starterCode(twoSum, 'cpp');
    expect(code).toContain('class Solution {\npublic:');
    expect(code).toContain('vector<int> twoSum(vector<int>& nums, int target)');
    expect(starterCode(reverseList, 'cpp')).toContain('ListNode* reverseList(ListNode* head)');
    expect(starterCode(reverseList, 'cpp')).toContain('struct ListNode');
  });

  it('fills in languages missing from stored starter code', () => {
    const filled = completeStarterCode({ python: 'custom' }, twoSum);
    expect(filled.python).toBe('custom');
    expect(filled.cpp).toContain('twoSum');
    expect(completeStarterCode({ python: 'x' }, null)).toEqual({ python: 'x' });
  });
});

describe('C++ harness generation', () => {
  it('converts each argument into a local of the parameter type and calls the method', () => {
    const { source, prefixLines } = buildProgram('cpp', twoSum, TWO_SUM_CPP);
    expect(source).toContain('std::vector<int> a0{}; __cb::cv(args.at(0), a0);');
    expect(source).toContain('int a1{}; __cb::cv(args.at(1), a1);');
    expect(source).toContain('auto result = solution.twoSum(a0, a1);');
    expect(source).toContain('int main()');
    // the player's code starts right after the prefix
    expect(source.split('\n')[prefixLines]).toBe('#include <bits/stdc++.h>');
  });

  it('provides ListNode / TreeNode unless the player declares their own', () => {
    expect(buildProgram('cpp', reverseList, 'class Solution { public: ListNode* reverseList(ListNode* h) { return h; } };').source).toContain(
      'struct ListNode {'
    );
    const own = 'struct ListNode { int val; ListNode* next; ListNode(int x) : val(x), next(nullptr) {} };\nclass Solution { public: ListNode* reverseList(ListNode* h) { return h; } };';
    const { source } = buildProgram('cpp', reverseList, own);
    expect(source.match(/struct ListNode \{/g)).toHaveLength(1);
    // a commented-out declaration does not count
    const commented = buildProgram('cpp', reverseList, '// struct ListNode { int val; }\nclass Solution { public: ListNode* reverseList(ListNode* h) { return h; } };');
    expect(commented.source.match(/struct ListNode \{/g)).toHaveLength(2);
  });

  it('reports a missing method instead of failing to compile', () => {
    const { source } = buildProgram('cpp', twoSum, 'int add(int a, int b) { return a + b; }');
    expect(source).toContain('{\\"fatal\\":');
    expect(source).not.toContain('solution.twoSum');
  });

  it('maps g++ diagnostics back to the player\'s line numbers', () => {
    expect(remapLineNumbers('cpp', '/tmp/x/main.cpp:12:5: error: expected \';\'', 4)).toBe("line 8:5: error: expected ';'");
    expect(remapLineNumbers('cpp', "/tmp/x/main.cpp: In member function 'int f()':", 4)).toBe("In member function 'int f()':");
  });

  it('flags debug output and process spawning in quality checks', () => {
    expect(analyzeQuality('cpp', TWO_SUM_CPP).issues.map(i => i.message).join()).toMatch(/debug print/);
    expect(analyzeQuality('cpp', 'int f() { system("ls"); return 0; }').issues.map(i => i.message).join()).toMatch(/Dynamic code/);
  });
});

describe('C++ without a compiler', () => {
  it('is a runner outage (submission withdrawn), not a compile error for the player', async () => {
    const missing = new LocalProcessRunner(undefined, undefined, undefined, 'definitely-not-a-compiler-cb');
    await expect(judge(twoSum, 'cpp', TWO_SUM_CPP, twoSumTests, missing)).rejects.toThrow(/Code runner failed: compiler not available/);
  });
});

const runner = cppRunner();

describe.skipIf(!runner)('C++ harness execution', () => {
  const run = (sig: ProblemSignature, code: string, tests: { args: unknown[]; expected: unknown }[]) => judge(sig, 'cpp', code, tests, runner!);

  it('accepts a correct solution and captures prints per test', async () => {
    const result = await run(twoSum, TWO_SUM_CPP, twoSumTests);
    expect(result.message).toBeUndefined();
    expect(result.verdict).toBe('ACCEPTED');
    expect(result.passed).toBe(2);
    expect(result.outcomes[0].stdout).toBe('checking 4\n');
    expect(result.outcomes[0].actual).toBe('[0,1]');
  }, 120_000);

  it('reports wrong answers per test', async () => {
    const code = 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) { return {0, 1}; }\n};\n';
    const result = await run(twoSum, code, twoSumTests);
    expect(result.verdict).toBe('WRONG_ANSWER');
    expect(result.outcomes.map(o => o.status)).toEqual(['passed', 'wrong']);
  }, 120_000);

  it('handles linked lists and trees in both directions', async () => {
    const list = `class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        while (head) { ListNode* next = head->next; head->next = prev; prev = head; head = next; }
        return prev;
    }
};`;
    expect((await run(reverseList, list, [{ args: [[1, 2, 3]], expected: [3, 2, 1] }, { args: [[]], expected: [] }])).verdict).toBe('ACCEPTED');
    const tree = `class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (!root) return nullptr;
        swap(root->left, root->right);
        invertTree(root->left); invertTree(root->right);
        return root;
    }
};`;
    const res = await run(invertTree, tree, [{ args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] }, { args: [[2, null, 3]], expected: [2, 3] }]);
    expect(res.message).toBeUndefined();
    expect(res.verdict).toBe('ACCEPTED');
  }, 120_000);

  it('round-trips strings with escapes and unicode, nested vectors and unordered compare', async () => {
    const code = `class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        map<string, vector<string>> groups;
        for (auto& s : strs) { string k = s; sort(k.begin(), k.end()); groups[k].push_back(s); }
        vector<vector<string>> out;
        for (auto& [k, v] : groups) out.push_back(v);
        return out;
    }
};`;
    const res = await run(groupAnagrams, code, [
      { args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] },
      { args: [['a"b\\c\n', 'héllo ✓']], expected: [['a"b\\c\n'], ['héllo ✓']] },
    ]);
    expect(res.message).toBeUndefined();
    expect(res.verdict).toBe('ACCEPTED');
  }, 120_000);

  it('handles doubles, longs, bools and char grids', async () => {
    const sig: ProblemSignature = {
      functionName: 'summarize',
      params: [
        { name: 'grid', type: 'char[][]' },
        { name: 'big', type: 'long' },
        { name: 'ratio', type: 'double' },
      ],
      returns: 'bool[]',
    };
    const code = `class Solution {
public:
    vector<bool> summarize(vector<vector<char>>& grid, long long big, double ratio) {
        return {grid[0][0] == '1', big > 3000000000LL, ratio > 0.5};
    }
};`;
    const res = await run(sig, code, [{ args: [[['1', '0'], ['0', '1']], 4000000000, 0.75], expected: [true, true, true] }]);
    expect(res.message).toBeUndefined();
    expect(res.verdict).toBe('ACCEPTED');
  }, 120_000);

  it('turns exceptions into a runtime error on that test', async () => {
    const code = 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) { if (target == 6) throw out_of_range("boom"); return {0, 1}; }\n};\n';
    const res = await run(twoSum, code, twoSumTests);
    expect(res.verdict).toBe('RUNTIME_ERROR');
    expect(res.outcomes[0].status).toBe('passed');
    expect(res.outcomes[1].error).toContain('boom');
  }, 120_000);

  it('reports compile errors with the player\'s line numbers', async () => {
    const code = 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return undefinedThing;\n    }\n};\n';
    const res = await run(twoSum, code, twoSumTests);
    expect(res.verdict).toBe('COMPILE_ERROR');
    expect(res.message).toMatch(/line 4/);
    expect(res.message).not.toMatch(/main\.cpp/);
  }, 120_000);

  it('reports a missing method like the other languages', async () => {
    const res = await run(twoSum, 'int helper() { return 1; }\n', twoSumTests);
    expect(res.message).toMatch(/twoSum was not found/);
  }, 120_000);
  // A DFS down a 1e6-node path: ~64 MB of frames, far past the default 8 MB stack.
  const chainSum: ProblemSignature = { functionName: 'chainSum', params: [{ name: 'n', type: 'int' }], returns: 'long' };
  const DEEP_CPP = `class Solution {
    long long go(vector<vector<int>>& g, int u) {
        long long s = u;
        for (int v : g[u]) s += go(g, v);
        return s;
    }
public:
    long long chainSum(int n) {
        vector<vector<int>> g(n);
        for (int i = 0; i + 1 < n; i++) g[i].push_back(i + 1);
        return go(g, 0);
    }
};`;

  it('survives recursion 1e6 frames deep (raised stack limit)', async () => {
    const res = await run(chainSum, DEEP_CPP, [{ args: [1_000_000], expected: 499_999_500_000 }]);
    expect(res.message).toBeUndefined();
    expect(res.verdict).toBe('ACCEPTED');
  }, 120_000);

  it.skipIf(!(runner instanceof WslCppRunner))('the same recursion overflows a default 8 MB stack (control)', async () => {
    const res = await judge(chainSum, 'cpp', DEEP_CPP, [{ args: [1_000_000], expected: 499_999_500_000 }], new WslCppRunner(8192));
    expect(res.verdict).toBe('RUNTIME_ERROR');
    // the player is told why, not just that the program exited
    expect(res.outcomes[0].error).toMatch(/Segmentation fault \(SIGSEGV\).*stack overflow/);
  }, 120_000);
});
