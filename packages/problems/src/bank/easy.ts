import { fromList, fromTree, randomInts, randomString, toList, toTree, type TreeNode } from '../helpers';
import type { QuestionDef } from '../types';

export const easy: QuestionDef[] = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'EASY',
    tags: ['array', 'hash-map'],
    description:
      'You are given an array of integers `nums` and an integer `target`. Exactly one pair of different positions holds two numbers that add up to `target`.\n\n' +
      'Return the two indices `[i, j]` with `i < j`.',
    constraints: ['2 ≤ nums.length ≤ 10⁵', '-10⁹ ≤ nums[i], target ≤ 10⁹', 'Exactly one valid pair exists'],
    signature: {
      functionName: 'twoSum',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'target', type: 'int' },
      ],
      returns: 'int[]',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
    ],
    tests: [
      { args: [[1, 5, 5, 11], 10], expected: [1, 2] },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
      { args: [[9, 10, 11, 13], 22], expected: [0, 3] },
      { args: [[1, 2], 3], expected: [0, 1] },
      { args: [[1000000000, -999999993, 4], 7], expected: [0, 1] },
    ],
    stress: [
      {
        label: '100k values, pair at the end',
        generate: rng => {
          const nums = randomInts(rng, 100_000, 10, 1_000_000).map(n => n * 2);
          nums[99_998] = 3;
          nums[99_999] = 5;
          return [nums, 8];
        },
      },
    ],
    reference: (nums: number[], target: number) => {
      const seen = new Map<number, number>();
      for (let i = 0; i < nums.length; i++) {
        const j = seen.get(target - nums[i]);
        if (j !== undefined) return [j, i];
        if (!seen.has(nums[i])) seen.set(nums[i], i);
      }
      return [];
    },
  },
  {
    slug: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'EASY',
    tags: ['linked-list'],
    description: 'Given the `head` of a singly linked list, reverse the list and return the new head.',
    constraints: ['0 ≤ number of nodes ≤ 10⁵', '-5000 ≤ Node.val ≤ 5000'],
    signature: {
      functionName: 'reverseList',
      params: [{ name: 'head', type: 'ListNode' }],
      returns: 'ListNode',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1] },
      { args: [[1, 2]], expected: [2, 1] },
      { args: [[]], expected: [] },
    ],
    tests: [
      { args: [[7]], expected: [7] },
      { args: [[1, 1, 2, 2]], expected: [2, 2, 1, 1] },
      { args: [[-1, 0, 1]], expected: [1, 0, -1] },
      { args: [[5000, -5000]], expected: [-5000, 5000] },
      { args: [[3, 2, 1]], expected: [1, 2, 3] },
    ],
    stress: [{ label: '100k nodes', generate: rng => [randomInts(rng, 100_000, -5000, 5000)] }],
    reference: (head: number[]) => fromList(toList([...head].reverse())),
  },
  {
    slug: 'valid-anagram',
    title: 'Valid Anagram',
    difficulty: 'EASY',
    tags: ['string', 'hash-map', 'counting'],
    description:
      'Two strings `s` and `t` are anagrams when one can be turned into the other purely by rearranging its letters, using every letter exactly as many times as it appears.\n\n' +
      'Return `true` if `t` is an anagram of `s`, otherwise `false`.',
    constraints: ['1 ≤ s.length, t.length ≤ 5 × 10⁴', '`s` and `t` contain only lowercase English letters'],
    signature: {
      functionName: 'isAnagram',
      params: [
        { name: 's', type: 'string' },
        { name: 't', type: 'string' },
      ],
      returns: 'bool',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: ['anagram', 'nagaram'], expected: true, explanation: 'Both strings use a×3, n×1, g×1, r×1, m×1.' },
      { args: ['rat', 'car'], expected: false },
      { args: ['listen', 'silent'], expected: true },
    ],
    tests: [
      { args: ['a', 'a'], expected: true },
      { args: ['ab', 'a'], expected: false },
      { args: ['aacc', 'ccac'], expected: false },
      { args: ['abc', 'bca'], expected: true },
      { args: ['aa', 'bb'], expected: false },
      { args: ['abcd', 'dcbaa'], expected: false },
      { args: ['zzzy', 'yzzz'], expected: true },
    ],
    stress: [
      {
        label: '50k chars, true anagram',
        generate: rng => {
          const s = randomString(rng, 50_000);
          return [s, rng.shuffle(s.split('')).join('')];
        },
      },
      {
        label: '50k chars, one letter differs',
        generate: rng => {
          const s = randomString(rng, 50_000);
          const t = rng.shuffle(s.split(''));
          const i = rng.int(0, t.length - 1);
          t[i] = t[i] === 'a' ? 'b' : 'a';
          return [s, t.join('')];
        },
      },
    ],
    reference: (s: string, t: string) => {
      if (s.length !== t.length) return false;
      const counts = new Array(26).fill(0);
      for (let i = 0; i < s.length; i++) {
        counts[s.charCodeAt(i) - 97]++;
        counts[t.charCodeAt(i) - 97]--;
      }
      return counts.every(c => c === 0);
    },
  },
  {
    slug: 'palindrome-number',
    title: 'Palindrome Number',
    difficulty: 'EASY',
    tags: ['math'],
    description:
      'Given an integer `x`, decide whether its decimal representation reads the same from left to right as from right to left.\n\n' +
      'A minus sign counts as a character, so every negative number is **not** a palindrome. Return `true` or `false`.',
    constraints: ['-2³¹ ≤ x ≤ 2³¹ - 1'],
    signature: {
      functionName: 'isPalindrome',
      params: [{ name: 'x', type: 'int' }],
      returns: 'bool',
    },
    optimal: { time: 'O(log x)', space: 'O(1)' },
    examples: [
      { args: [121], expected: true, explanation: '121 reversed is still 121.' },
      { args: [-121], expected: false },
      { args: [10], expected: false },
    ],
    tests: [
      { args: [0], expected: true },
      { args: [7], expected: true },
      { args: [1221], expected: true },
      { args: [1000021], expected: false },
      { args: [2147447412], expected: true },
      { args: [2147483647], expected: false },
      { args: [-2147483648], expected: false },
      { args: [11], expected: true },
    ],
    reference: (x: number) => {
      if (x < 0) return false;
      const s = String(x);
      return s === s.split('').reverse().join('');
    },
  },
  {
    slug: 'roman-to-integer',
    title: 'Roman to Integer',
    difficulty: 'EASY',
    tags: ['string', 'math', 'hash-map'],
    description:
      'Roman numerals use the symbols `I`=1, `V`=5, `X`=10, `L`=50, `C`=100, `D`=500 and `M`=1000. Symbols are normally written from largest to smallest and added up.\n\n' +
      'The exceptions are the six subtractive pairs `IV`=4, `IX`=9, `XL`=40, `XC`=90, `CD`=400 and `CM`=900, where a smaller symbol placed before a larger one is subtracted.\n\n' +
      'Convert the numeral `s` to its integer value.',
    constraints: ['1 ≤ s.length ≤ 15', '`s` is a valid Roman numeral for a value in [1, 3999]'],
    signature: {
      functionName: 'romanToInt',
      params: [{ name: 's', type: 'string' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: ['III'], expected: 3, explanation: 'I + I + I = 3' },
      { args: ['LVIII'], expected: 58 },
      { args: ['MCMXCIV'], expected: 1994 },
    ],
    tests: [
      { args: ['I'], expected: 1 },
      { args: ['IV'], expected: 4 },
      { args: ['IX'], expected: 9 },
      { args: ['XL'], expected: 40 },
      { args: ['XC'], expected: 90 },
      { args: ['CD'], expected: 400 },
      { args: ['CM'], expected: 900 },
      { args: ['MMMCMXCIX'], expected: 3999 },
      { args: ['DCXXI'], expected: 621 },
      { args: ['XLIX'], expected: 49 },
    ],
    reference: (s: string) => {
      const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      let total = 0;
      for (let i = 0; i < s.length; i++) {
        const cur = v[s[i]];
        const next = i + 1 < s.length ? v[s[i + 1]] : 0;
        total += cur < next ? -cur : cur;
      }
      return total;
    },
  },
  {
    slug: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    difficulty: 'EASY',
    tags: ['string'],
    description:
      'You are given a list of words `strs`. Find the longest string that every word in the list starts with.\n\n' +
      'If the words share no common starting characters, return the empty string `""`.',
    constraints: ['1 ≤ strs.length ≤ 200', '0 ≤ strs[i].length ≤ 200', '`strs[i]` contains only lowercase English letters'],
    signature: {
      functionName: 'longestCommonPrefix',
      params: [{ name: 'strs', type: 'string[]' }],
      returns: 'string',
    },
    optimal: { time: 'O(S) where S is the total number of characters', space: 'O(1)' },
    examples: [
      { args: [['flower', 'flow', 'flight']], expected: 'fl', explanation: 'All three words begin with "fl"; the third character differs.' },
      { args: [['dog', 'racecar', 'car']], expected: '' },
      { args: [['interview', 'internet', 'interval']], expected: 'inter' },
    ],
    tests: [
      { args: [['alone']], expected: 'alone' },
      { args: [['', 'abc']], expected: '' },
      { args: [['abc', 'abc', 'abc']], expected: 'abc' },
      { args: [['ab', 'a']], expected: 'a' },
      { args: [['a', 'b']], expected: '' },
      { args: [['prefix', 'pre', 'prefixes']], expected: 'pre' },
      { args: [['']], expected: '' },
    ],
    reference: (strs: string[]) => {
      let prefix = strs[0];
      for (const w of strs) {
        let i = 0;
        while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++;
        prefix = prefix.slice(0, i);
      }
      return prefix;
    },
  },
  {
    slug: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'EASY',
    tags: ['linked-list', 'two-pointers'],
    description:
      'You are given the heads of two linked lists, `list1` and `list2`, each already sorted in non-decreasing order.\n\n' +
      'Combine them into a single list that is also sorted in non-decreasing order and return its head. Equal values from both lists must all be kept.',
    constraints: ['0 ≤ number of nodes in each list ≤ 5 × 10⁴', '-10⁴ ≤ Node.val ≤ 10⁴', 'Both lists are sorted in non-decreasing order'],
    signature: {
      functionName: 'mergeTwoLists',
      params: [
        { name: 'list1', type: 'ListNode' },
        { name: 'list2', type: 'ListNode' },
      ],
      returns: 'ListNode',
    },
    optimal: { time: 'O(n + m)', space: 'O(1)' },
    examples: [
      { args: [[1, 2, 4], [1, 3, 4]], expected: [1, 1, 2, 3, 4, 4], explanation: 'Walk both lists, always taking the smaller front node.' },
      { args: [[], []], expected: [] },
      { args: [[], [0]], expected: [0] },
    ],
    tests: [
      { args: [[5], [1, 2, 3]], expected: [1, 2, 3, 5] },
      { args: [[1, 2, 3], [4, 5, 6]], expected: [1, 2, 3, 4, 5, 6] },
      { args: [[-10, -3, 0], [-5, -5, 8]], expected: [-10, -5, -5, -3, 0, 8] },
      { args: [[2], []], expected: [2] },
      { args: [[1, 1, 1], [1, 1]], expected: [1, 1, 1, 1, 1] },
      { args: [[-10000, 10000], [0]], expected: [-10000, 0, 10000] },
    ],
    stress: [
      {
        label: 'two 50k-node lists',
        generate: rng => [
          randomInts(rng, 50_000, -10_000, 10_000).sort((a, b) => a - b),
          randomInts(rng, 50_000, -10_000, 10_000).sort((a, b) => a - b),
        ],
      },
    ],
    reference: (list1: number[], list2: number[]) => {
      let a = toList(list1);
      let b = toList(list2);
      const out: number[] = [];
      while (a && b) {
        if (a.val <= b.val) {
          out.push(a.val);
          a = a.next;
        } else {
          out.push(b.val);
          b = b.next;
        }
      }
      return out.concat(fromList(a ?? b));
    },
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    tags: ['string', 'stack'],
    description:
      'The string `s` consists only of the bracket characters `()[]{}`. It is balanced when every opening bracket is closed by a bracket of the same kind, and brackets close in the reverse order they were opened (properly nested).\n\n' +
      'Return `true` if `s` is balanced, otherwise `false`.',
    constraints: ['1 ≤ s.length ≤ 10⁵', '`s` contains only the characters `()[]{}`'],
    signature: {
      functionName: 'isValid',
      params: [{ name: 's', type: 'string' }],
      returns: 'bool',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: ['()'], expected: true, explanation: 'The single pair opens and closes correctly.' },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
    ],
    tests: [
      { args: ['([{}])'], expected: true },
      { args: ['([)]'], expected: false },
      { args: ['('], expected: false },
      { args: [')'], expected: false },
      { args: ['{[]}()'], expected: true },
      { args: ['(('], expected: false },
      { args: ['){'], expected: false },
      { args: ['[[[]]]{}'], expected: true },
    ],
    stress: [
      {
        label: '100k chars, 50k-deep nesting',
        generate: rng => {
          const open = randomString(rng, 50_000, '([{');
          const match: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
          return [open + open.split('').reverse().map(c => match[c]).join('')];
        },
      },
      {
        label: '100k chars, mismatch at the very end',
        generate: rng => {
          const open = randomString(rng, 50_000, '([{');
          const match: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
          const close = open.split('').reverse().map(c => match[c]);
          close[close.length - 1] = close[close.length - 1] === ')' ? ']' : ')';
          return [open + close.join('')];
        },
      },
    ],
    reference: (s: string) => {
      const match: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
      const stack: string[] = [];
      for (const c of s) {
        if (c in match) {
          if (stack.pop() !== match[c]) return false;
        } else stack.push(c);
      }
      return stack.length === 0;
    },
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'EASY',
    tags: ['dynamic-programming', 'math'],
    description:
      'A staircase has `n` steps. On each move you climb either 1 step or 2 steps.\n\n' +
      'Return the number of distinct sequences of moves that take you from the bottom exactly to the top. Two sequences differ if their moves differ at any position.',
    constraints: ['1 ≤ n ≤ 45'],
    signature: {
      functionName: 'climbStairs',
      params: [{ name: 'n', type: 'int' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [2], expected: 2, explanation: '1+1 or 2.' },
      { args: [3], expected: 3 },
      { args: [5], expected: 8 },
    ],
    tests: [
      { args: [1], expected: 1 },
      { args: [4], expected: 5 },
      { args: [10], expected: 89 },
      { args: [20], expected: 10946 },
      { args: [30], expected: 1346269 },
      { args: [45], expected: 1836311903 },
    ],
    reference: (n: number) => {
      let a = 1;
      let b = 1;
      for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
      return b;
    },
  },
  {
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'EASY',
    tags: ['array', 'greedy'],
    description:
      '`prices[i]` is the price of a stock on day `i`. You may buy one share on some day and sell it on a **strictly later** day.\n\n' +
      'Return the largest profit you can make from a single buy followed by a single sell. If no trade makes money, return `0`.',
    constraints: ['1 ≤ prices.length ≤ 10⁵', '0 ≤ prices[i] ≤ 10⁴'],
    signature: {
      functionName: 'maxProfit',
      params: [{ name: 'prices', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5, explanation: 'Buy on day 1 at price 1, sell on day 4 at price 6.' },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2 },
    ],
    tests: [
      { args: [[5]], expected: 0 },
      { args: [[1, 2]], expected: 1 },
      { args: [[3, 3, 3]], expected: 0 },
      { args: [[2, 1, 2, 1, 0, 1, 2]], expected: 2 },
      { args: [[1, 10000]], expected: 9999 },
      { args: [[3, 8, 1, 9]], expected: 8 },
      { args: [[9, 1, 9, 0, 5]], expected: 8 },
    ],
    stress: [
      { label: '100k random prices', generate: rng => [randomInts(rng, 100_000, 0, 10_000)] },
      {
        label: '100k decreasing prices',
        generate: () => [Array.from({ length: 100_000 }, (_, i) => Math.floor((100_000 - i) / 10))],
      },
    ],
    reference: (prices: number[]) => {
      let low = Infinity;
      let best = 0;
      for (const p of prices) {
        low = Math.min(low, p);
        best = Math.max(best, p - low);
      }
      return best;
    },
  },
  {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'EASY',
    tags: ['array', 'binary-search'],
    description:
      '`nums` is sorted in strictly increasing order (no duplicates). Return the index at which `target` appears, or `-1` if it is not present.\n\n' +
      'Aim for a solution that inspects only O(log n) elements.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i], target ≤ 10⁴', 'All values in `nums` are distinct and sorted ascending'],
    signature: {
      functionName: 'search',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'target', type: 'int' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(log n)', space: 'O(1)' },
    examples: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4, explanation: '9 sits at index 4.' },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { args: [[5], 5], expected: 0 },
    ],
    tests: [
      { args: [[5], -5], expected: -1 },
      { args: [[1, 3], 3], expected: 1 },
      { args: [[1, 3], 1], expected: 0 },
      { args: [[-10000, -5, 0, 7, 10000], 10000], expected: 4 },
      { args: [[-10000, -5, 0, 7, 10000], -10000], expected: 0 },
      { args: [[2, 4, 6, 8, 10, 12], 7], expected: -1 },
      { args: [[2, 4, 6, 8], 1], expected: -1 },
      { args: [[2, 4, 6, 8], 9], expected: -1 },
    ],
    stress: [
      {
        label: '20k sorted values',
        generate: rng => {
          const nums = Array.from({ length: 20_000 }, (_, i) => -10_000 + i);
          return [nums, rng.int(-10_000, 10_000)];
        },
      },
    ],
    reference: (nums: number[], target: number) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    },
  },
  {
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'EASY',
    tags: ['string', 'two-pointers'],
    description:
      'Given a string `s`, ignore every character that is not an English letter or a digit, and treat uppercase and lowercase letters as the same.\n\n' +
      'Return `true` if what remains reads identically forwards and backwards. A string with no letters or digits left counts as a palindrome.',
    constraints: ['1 ≤ s.length ≤ 2 × 10⁵', '`s` contains printable ASCII characters only'],
    signature: {
      functionName: 'validPalindrome',
      params: [{ name: 's', type: 'string' }],
      returns: 'bool',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: ['A man, a plan, a canal: Panama'], expected: true, explanation: 'Keeping only letters and digits in lowercase gives "amanaplanacanalpanama".' },
      { args: ['race a car'], expected: false },
      { args: [' '], expected: true },
    ],
    tests: [
      { args: ['.,'], expected: true },
      { args: ['0P'], expected: false },
      { args: ['ab_a'], expected: true },
      { args: ['Was it a car or a cat I saw?'], expected: true },
      { args: ["No 'x' in Nixon"], expected: true },
      { args: ['12321'], expected: true },
      { args: ['1a2'], expected: false },
      { args: ['Aa'], expected: true },
    ],
    stress: [
      {
        label: '~150k chars, palindrome with noise',
        generate: rng => {
          const core = randomString(rng, 50_000, 'abc123');
          const full = core + core.split('').reverse().join('');
          let s = '';
          for (const c of full) {
            s += rng.int(0, 1) ? c.toUpperCase() : c;
            if (rng.int(0, 3) === 0) s += rng.pick([' ', ',', '.', ':', '!']);
          }
          return [s];
        },
      },
    ],
    reference: (s: string) => {
      const t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (let i = 0, j = t.length - 1; i < j; i++, j--) if (t[i] !== t[j]) return false;
      return true;
    },
  },
  {
    slug: 'maximum-depth-of-binary-tree',
    title: 'Maximum Depth of Binary Tree',
    difficulty: 'EASY',
    tags: ['tree', 'depth-first-search', 'breadth-first-search'],
    description:
      'Given the `root` of a binary tree, return its depth: the number of nodes on the longest path from the root down to any leaf.\n\n' +
      'An empty tree has depth `0`, and a lone root has depth `1`.',
    constraints: ['0 ≤ number of nodes ≤ 10⁴', '-100 ≤ Node.val ≤ 100'],
    signature: {
      functionName: 'maxDepth',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(h)' },
    examples: [
      { args: [[3, 9, 20, null, null, 15, 7]], expected: 3, explanation: 'The path 3 → 20 → 15 has three nodes.' },
      { args: [[1, null, 2]], expected: 2 },
      { args: [[]], expected: 0 },
    ],
    tests: [
      { args: [[1]], expected: 1 },
      { args: [[1, 2, 3, 4, 5, 6, 7]], expected: 3 },
      { args: [[1, 2, null, 3, null, 4, null, 5]], expected: 5 },
      { args: [[1, null, 2, null, 3]], expected: 3 },
      { args: [[0, -1, 1, null, null, null, 2, null, 3]], expected: 4 },
      { args: [[-100, 100]], expected: 2 },
    ],
    reference: (root: (number | null)[]) => {
      const tree = toTree(root);
      if (!tree) return 0;
      let depth = 0;
      let level: TreeNode[] = [tree];
      while (level.length) {
        depth++;
        const next: TreeNode[] = [];
        for (const n of level) {
          if (n.left) next.push(n.left);
          if (n.right) next.push(n.right);
        }
        level = next;
      }
      return depth;
    },
  },
  {
    slug: 'invert-binary-tree',
    title: 'Invert Binary Tree',
    difficulty: 'EASY',
    tags: ['tree', 'depth-first-search', 'breadth-first-search'],
    description:
      'Given the `root` of a binary tree, produce its mirror image: at every node, swap the left and right subtrees.\n\n' +
      'Return the root of the mirrored tree.',
    constraints: ['0 ≤ number of nodes ≤ 100', '-100 ≤ Node.val ≤ 100'],
    signature: {
      functionName: 'invertTree',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'TreeNode',
    },
    optimal: { time: 'O(n)', space: 'O(h)' },
    examples: [
      { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1], explanation: 'Each level is read in reverse after mirroring.' },
      { args: [[2, 1, 3]], expected: [2, 3, 1] },
      { args: [[]], expected: [] },
    ],
    tests: [
      { args: [[1]], expected: [1] },
      { args: [[1, 2]], expected: [1, null, 2] },
      { args: [[1, null, 2]], expected: [1, 2] },
      { args: [[1, 2, 3, 4, 5, 6, 7]], expected: [1, 3, 2, 7, 6, 5, 4] },
      { args: [[1, 2, null, 3]], expected: [1, null, 2, null, 3] },
      { args: [[5, 3, 8, null, 4, 7]], expected: [5, 8, 3, null, 7, 4] },
      { args: [[-1, -2, -3]], expected: [-1, -3, -2] },
    ],
    reference: (root: (number | null)[]) => {
      const tree = toTree(root);
      const stack = tree ? [tree] : [];
      while (stack.length) {
        const n = stack.pop()!;
        [n.left, n.right] = [n.right, n.left];
        if (n.left) stack.push(n.left);
        if (n.right) stack.push(n.right);
      }
      return fromTree(tree);
    },
  },
  {
    slug: 'contains-duplicate',
    title: 'Contains Duplicate',
    difficulty: 'EASY',
    tags: ['array', 'hash-set'],
    description:
      'Given an integer array `nums`, return `true` if some value occurs at least twice anywhere in the array.\n\n' +
      'Return `false` if all values are distinct.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁹ ≤ nums[i] ≤ 10⁹'],
    signature: {
      functionName: 'containsDuplicate',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'bool',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: [[1, 2, 3, 1]], expected: true, explanation: 'The value 1 appears at indices 0 and 3.' },
      { args: [[1, 2, 3, 4]], expected: false },
      { args: [[1, 1, 1, 3, 3, 4, 3, 2, 4, 2]], expected: true },
    ],
    tests: [
      { args: [[5]], expected: false },
      { args: [[0, 0]], expected: true },
      { args: [[-1, 1]], expected: false },
      { args: [[-1000000000, 1000000000, -1000000000]], expected: true },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], expected: false },
      { args: [[3, 1]], expected: false },
    ],
    stress: [
      {
        label: '100k distinct values',
        generate: rng => [rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i * 20_000 - 1_000_000_000 + rng.int(0, 19_999)))],
      },
      {
        label: '100k values, one duplicate at the end',
        generate: rng => {
          const nums = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i * 20_000 - 1_000_000_000 + rng.int(0, 19_999)));
          nums[99_999] = nums[99_998];
          return [nums];
        },
      },
    ],
    reference: (nums: number[]) => new Set(nums).size !== nums.length,
  },
  {
    slug: 'single-number',
    title: 'Single Number',
    difficulty: 'EASY',
    tags: ['array', 'bit-manipulation'],
    description:
      'In the non-empty integer array `nums`, every value appears exactly twice except for one value that appears only once.\n\n' +
      'Return that lone value. Try to do it in linear time with constant extra memory.',
    constraints: ['1 ≤ nums.length ≤ 10⁵ (always odd)', '-10⁹ ≤ nums[i] ≤ 10⁹', 'Exactly one value appears once; all others appear exactly twice'],
    signature: {
      functionName: 'singleNumber',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[2, 2, 1]], expected: 1, explanation: '2 appears twice, 1 only once.' },
      { args: [[4, 1, 2, 1, 2]], expected: 4 },
      { args: [[1]], expected: 1 },
    ],
    tests: [
      { args: [[-1, -1, -2]], expected: -2 },
      { args: [[0, 5, 5]], expected: 0 },
      { args: [[7, 3, 7]], expected: 3 },
      { args: [[30000, -30000, -30000]], expected: 30000 },
      { args: [[1, 2, 3, 2, 1]], expected: 3 },
      { args: [[-4, 6, 6, 9, 9]], expected: -4 },
      { args: [[1000000000, -1000000000, 1000000000]], expected: -1000000000 },
    ],
    stress: [
      {
        label: '99,999 values (49,999 pairs + 1)',
        generate: rng => {
          const distinct = rng.shuffle(Array.from({ length: 50_000 }, (_, i) => i * 40_000 - 1_000_000_000 + rng.int(0, 39_999)));
          const nums = [...distinct.slice(1), ...distinct.slice(1), distinct[0]];
          return [rng.shuffle(nums)];
        },
      },
    ],
    reference: (nums: number[]) => {
      const counts = new Map<number, number>();
      for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
      for (const [n, c] of counts) if (c === 1) return n;
      return null;
    },
  },
  {
    slug: 'missing-number',
    title: 'Missing Number',
    difficulty: 'EASY',
    tags: ['array', 'math', 'bit-manipulation'],
    description:
      'The array `nums` has length `n` and holds `n` distinct integers taken from the range `0` to `n` inclusive, so exactly one number from that range is absent.\n\n' +
      'Return the absent number.',
    constraints: ['1 ≤ n ≤ 10⁵', '0 ≤ nums[i] ≤ n', 'All values in `nums` are distinct'],
    signature: {
      functionName: 'missingNumber',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[3, 0, 1]], expected: 2, explanation: 'n = 3, so the range is 0..3 and 2 is the one not present.' },
      { args: [[0, 1]], expected: 2 },
      { args: [[9, 6, 4, 2, 3, 5, 7, 0, 1]], expected: 8 },
    ],
    tests: [
      { args: [[0]], expected: 1 },
      { args: [[1]], expected: 0 },
      { args: [[1, 2]], expected: 0 },
      { args: [[0, 2]], expected: 1 },
      { args: [[2, 0, 1, 4]], expected: 3 },
      { args: [[5, 4, 3, 2, 1]], expected: 0 },
    ],
    stress: [
      {
        label: '100k values, one missing',
        generate: rng => {
          const n = 100_000;
          const gone = rng.int(0, n);
          const nums: number[] = [];
          for (let i = 0; i <= n; i++) if (i !== gone) nums.push(i);
          return [rng.shuffle(nums)];
        },
      },
    ],
    reference: (nums: number[]) => {
      const n = nums.length;
      let sum = (n * (n + 1)) / 2;
      for (const x of nums) sum -= x;
      return sum;
    },
  },
  {
    slug: 'flood-fill',
    title: 'Flood Fill',
    difficulty: 'EASY',
    tags: ['matrix', 'depth-first-search', 'breadth-first-search'],
    description:
      '`image` is a grid of integer pixel colours. Starting from pixel `(sr, sc)`, repaint that pixel and every pixel connected to it with `color`. Two pixels are connected when they share an edge (up, down, left, right — not diagonal) and both have the same original colour as the starting pixel.\n\n' +
      'Return the resulting grid. If the starting pixel already has `color`, the grid is returned unchanged.',
    constraints: ['1 ≤ rows, cols ≤ 50', '0 ≤ image[i][j], color < 2¹⁶', '0 ≤ sr < rows, 0 ≤ sc < cols'],
    signature: {
      functionName: 'floodFill',
      params: [
        { name: 'image', type: 'int[][]' },
        { name: 'sr', type: 'int' },
        { name: 'sc', type: 'int' },
        { name: 'color', type: 'int' },
      ],
      returns: 'int[][]',
    },
    optimal: { time: 'O(rows × cols)', space: 'O(rows × cols)' },
    examples: [
      {
        args: [[[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2],
        expected: [[2, 2, 2], [2, 2, 0], [2, 0, 1]],
        explanation: 'The bottom-right 1 touches the region only diagonally, so it stays 1.',
      },
      { args: [[[0, 0, 0], [0, 0, 0]], 0, 0, 0], expected: [[0, 0, 0], [0, 0, 0]] },
      { args: [[[0, 1], [1, 0]], 0, 0, 5], expected: [[5, 1], [1, 0]] },
    ],
    tests: [
      { args: [[[7]], 0, 0, 3], expected: [[3]] },
      { args: [[[1, 2, 1], [2, 1, 2]], 1, 1, 9], expected: [[1, 2, 1], [2, 9, 2]] },
      { args: [[[0, 0], [0, 0]], 1, 0, 4], expected: [[4, 4], [4, 4]] },
      { args: [[[1, 1, 0], [0, 1, 0], [0, 1, 1]], 2, 2, 3], expected: [[3, 3, 0], [0, 3, 0], [0, 3, 3]] },
      { args: [[[2, 2, 2], [2, 3, 2], [2, 2, 2]], 1, 1, 2], expected: [[2, 2, 2], [2, 2, 2], [2, 2, 2]] },
      { args: [[[1, 0, 1], [0, 0, 0], [1, 0, 1]], 1, 1, 1], expected: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
    ],
    reference: (image: number[][], sr: number, sc: number, color: number) => {
      const grid = image.map(row => [...row]);
      const orig = grid[sr][sc];
      if (orig === color) return grid;
      const stack: [number, number][] = [[sr, sc]];
      grid[sr][sc] = color;
      while (stack.length) {
        const [r, c] = stack.pop()!;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && grid[nr][nc] === orig) {
            grid[nr][nc] = color;
            stack.push([nr, nc]);
          }
        }
      }
      return grid;
    },
  },
  {
    slug: 'integer-square-root',
    title: 'Integer Square Root',
    difficulty: 'EASY',
    tags: ['math', 'binary-search'],
    description:
      'Given a non-negative integer `x`, return the largest integer `r` such that `r × r ≤ x` (the square root rounded down).\n\n' +
      'Do not call a built-in square-root or power function; compute it yourself.',
    constraints: ['0 ≤ x ≤ 2³¹ - 1'],
    signature: {
      functionName: 'mySqrt',
      params: [{ name: 'x', type: 'int' }],
      returns: 'int',
    },
    optimal: { time: 'O(log x)', space: 'O(1)' },
    examples: [
      { args: [4], expected: 2, explanation: '2 × 2 = 4 exactly.' },
      { args: [8], expected: 2 },
      { args: [0], expected: 0 },
    ],
    tests: [
      { args: [1], expected: 1 },
      { args: [2], expected: 1 },
      { args: [15], expected: 3 },
      { args: [16], expected: 4 },
      { args: [2147395599], expected: 46339 },
      { args: [2147395600], expected: 46340 },
      { args: [2147483647], expected: 46340 },
    ],
    reference: (x: number) => {
      let lo = 0;
      let hi = Math.min(x, 46_341);
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (mid * mid <= x) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    },
  },
  {
    slug: 'meeting-rooms',
    title: 'Meeting Rooms',
    difficulty: 'EASY',
    tags: ['array', 'sorting', 'intervals'],
    description:
      'Each entry `intervals[i] = [start, end]` is a meeting that occupies the half-open time range from `start` up to (but not including) `end`. The meetings are given in no particular order.\n\n' +
      'Return `true` if one person could attend all of them, i.e. no two meetings overlap. A meeting that ends exactly when another starts is **not** a conflict.',
    constraints: ['0 ≤ intervals.length ≤ 5 × 10⁴', '0 ≤ start < end ≤ 10⁷'],
    signature: {
      functionName: 'canAttendMeetings',
      params: [{ name: 'intervals', type: 'int[][]' }],
      returns: 'bool',
    },
    optimal: { time: 'O(n log n)', space: 'O(n)' },
    examples: [
      { args: [[[0, 30], [5, 10], [15, 20]]], expected: false, explanation: '[5, 10] happens during [0, 30].' },
      { args: [[[7, 10], [2, 4]]], expected: true },
      { args: [[[1, 5], [5, 8]]], expected: true },
    ],
    tests: [
      { args: [[]], expected: true },
      { args: [[[3, 4]]], expected: true },
      { args: [[[1, 10], [2, 3]]], expected: false },
      { args: [[[5, 8], [1, 5], [8, 9]]], expected: true },
      { args: [[[1, 4], [4, 6], [5, 7]]], expected: false },
      { args: [[[0, 1000000], [999999, 1000000]]], expected: false },
      { args: [[[9, 10], [1, 2], [5, 6], [3, 4]]], expected: true },
    ],
    stress: [
      {
        label: '50k disjoint meetings, shuffled',
        generate: rng => [rng.shuffle(Array.from({ length: 50_000 }, (_, i) => [i * 20, i * 20 + rng.int(1, 20)]))],
      },
      {
        label: '50k meetings, one overlap',
        generate: rng => {
          const iv = Array.from({ length: 50_000 }, (_, i) => [i * 20, i * 20 + rng.int(1, 20)]);
          iv[rng.int(0, 49_998)][1] += 25;
          return [rng.shuffle(iv)];
        },
      },
    ],
    reference: (intervals: number[][]) => {
      const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < sorted.length; i++) if (sorted[i][0] < sorted[i - 1][1]) return false;
      return true;
    },
  },
];
