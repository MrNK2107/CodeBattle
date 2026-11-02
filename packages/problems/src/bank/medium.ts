import { randomInts, randomString } from '../helpers';
import type { QuestionDef } from '../types';

const PRINTABLE = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

const WORD_BOARD = [
  ['C', 'A', 'T', 'S'],
  ['O', 'R', 'E', 'D'],
  ['D', 'E', 'N', 'Y'],
];

export const medium: QuestionDef[] = [
  // ------------------------------------------------------------------ 1
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'MEDIUM',
    tags: ['array', 'dynamic-programming', 'greedy'],
    description:
      'You are given an integer array `nums`. Pick a contiguous, non-empty run of elements so that their total is as large as possible.\n\n' +
      'Return that largest total. The run must contain at least one element, so for an all-negative array the answer is its largest element.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
    signature: {
      functionName: 'maxSubArray',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6, explanation: 'The run [4, -1, 2, 1] adds up to 6.' },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
    ],
    tests: [
      { args: [[-3, -1, -2]], expected: -1 },
      { args: [[-5]], expected: -5 },
      { args: [[0, 0, 0]], expected: 0 },
      { args: [[2, -1, 2]], expected: 3 },
      { args: [[1, -10, 3, 4]], expected: 7 },
      { args: [[10000, -1, 10000]], expected: 19999 },
      { args: [[-1, 3, -1, 3, -10, 5]], expected: 5 },
    ],
    stress: [
      { label: '100k mixed values', generate: rng => [randomInts(rng, 100_000, -10_000, 10_000)] },
      {
        label: '100k mostly negative values',
        generate: rng => [randomInts(rng, 100_000, -10_000, 10_000).map(v => (v > 9_000 ? v : -Math.abs(v)))],
      },
    ],
    reference: (nums: number[]) => {
      let best = nums[0];
      let cur = 0;
      for (const n of nums) {
        cur = Math.max(n, cur + n);
        best = Math.max(best, cur);
      }
      return best;
    },
  },
  // ------------------------------------------------------------------ 2
  {
    slug: 'product-of-array-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'MEDIUM',
    tags: ['array', 'prefix-sum'],
    description:
      'Given an integer array `nums`, build an array `answer` of the same length where `answer[i]` is the product of every element of `nums` other than `nums[i]`.\n\n' +
      'You may **not** use division. Aim for a single linear pass or two, without nested loops.',
    constraints: [
      '2 ≤ nums.length ≤ 10⁵',
      '-30 ≤ nums[i] ≤ 30',
      'Every prefix and suffix product fits in a 32-bit signed integer',
    ],
    signature: {
      functionName: 'productExceptSelf',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int[]',
    },
    optimal: { time: 'O(n)', space: 'O(1) extra (output excluded)' },
    examples: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], explanation: 'answer[0] = 2·3·4 = 24, answer[1] = 1·3·4 = 12, and so on.' },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
      { args: [[2, 3]], expected: [3, 2] },
    ],
    tests: [
      { args: [[0, 0]], expected: [0, 0] },
      { args: [[0, 4, 5]], expected: [20, 0, 0] },
      { args: [[1, 1, 1, 1]], expected: [1, 1, 1, 1] },
      { args: [[-2, -3, 4]], expected: [-12, -8, 6] },
      { args: [[5, 0, 2, 0]], expected: [0, 0, 0, 0] },
      { args: [[7, -1]], expected: [-1, 7] },
      { args: [[2, 2, 2, 2, 2]], expected: [16, 16, 16, 16, 16] },
    ],
    stress: [
      {
        label: '100k values of ±1 with a few larger factors',
        generate: rng => {
          const nums: number[] = Array.from({ length: 100_000 }, () => (rng.int(0, 1) ? 1 : -1));
          for (let i = 0; i < 12; i++) nums[rng.int(0, nums.length - 1)] = rng.pick([2, -2, 3]);
          return [nums];
        },
      },
      {
        label: '100k values with a single zero',
        generate: rng => {
          const nums: number[] = Array.from({ length: 100_000 }, () => (rng.int(0, 1) ? 1 : -1));
          nums[rng.int(0, nums.length - 1)] = 0;
          return [nums];
        },
      },
    ],
    reference: (nums: number[]) => {
      const n = nums.length;
      const out = new Array<number>(n).fill(1);
      let left = 1;
      for (let i = 0; i < n; i++) {
        out[i] = left;
        left *= nums[i];
      }
      let right = 1;
      for (let i = n - 1; i >= 0; i--) {
        out[i] = out[i] * right + 0; // + 0 normalises -0
        right *= nums[i];
      }
      return out.map(v => (v === 0 ? 0 : v));
    },
  },
  // ------------------------------------------------------------------ 3
  {
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'MEDIUM',
    tags: ['string', 'sliding-window', 'hash-map'],
    description:
      'Given a string `s`, find the longest contiguous piece of it in which no character appears twice, and return its length.\n\n' +
      'Characters are compared exactly (case-sensitive), and spaces and symbols count as characters too. An empty string has answer `0`.',
    constraints: ['0 ≤ s.length ≤ 5·10⁴', '`s` contains printable ASCII characters (letters, digits, symbols, spaces)'],
    signature: {
      functionName: 'lengthOfLongestSubstring',
      params: [{ name: 's', type: 'string' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(min(n, alphabet))' },
    examples: [
      { args: ['abcabcbb'], expected: 3, explanation: '"abc" is the longest piece with all-distinct characters.' },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
    ],
    tests: [
      { args: [''], expected: 0 },
      { args: [' '], expected: 1 },
      { args: ['dvdf'], expected: 3 },
      { args: ['abba'], expected: 2 },
      { args: ['au'], expected: 2 },
      { args: ['tmmzuxt'], expected: 5 },
      { args: ['a1!a1!b'], expected: 4 },
      { args: ['aA'], expected: 2 },
    ],
    stress: [
      { label: '50k random printable characters', generate: rng => [randomString(rng, 50_000, PRINTABLE)] },
      {
        label: '50k characters cycling through the alphabet',
        generate: rng => {
          const offset = rng.int(0, PRINTABLE.length - 1);
          let s = '';
          for (let i = 0; i < 50_000; i++) s += PRINTABLE[(i + offset) % PRINTABLE.length];
          return [s];
        },
      },
    ],
    reference: (s: string) => {
      const last = new Map<string, number>();
      let start = 0;
      let best = 0;
      for (let i = 0; i < s.length; i++) {
        const prev = last.get(s[i]);
        if (prev !== undefined && prev >= start) start = prev + 1;
        last.set(s[i], i);
        best = Math.max(best, i - start + 1);
      }
      return best;
    },
  },
  // ------------------------------------------------------------------ 4
  {
    slug: 'group-anagrams',
    title: 'Group Anagrams',
    difficulty: 'MEDIUM',
    tags: ['string', 'hash-map', 'sorting'],
    description:
      'You are given a list of lowercase words `strs`. Two words belong together when one is a rearrangement of the letters of the other.\n\n' +
      'Partition the words into such groups and return the list of groups. Every input word (including repeats) must appear in exactly one group. ' +
      'The order of the groups, and of the words inside each group, does not matter.',
    constraints: ['1 ≤ strs.length ≤ 5·10⁴', '0 ≤ strs[i].length ≤ 100', '`strs[i]` consists of lowercase English letters'],
    signature: {
      functionName: 'groupAnagrams',
      params: [{ name: 'strs', type: 'string[]' }],
      returns: 'string[][]',
      compare: 'unordered-nested',
      javaReturns: 'List<List<String>>',
    },
    optimal: { time: 'O(n·k log k)', space: 'O(n·k)' },
    examples: [
      {
        args: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']],
        expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']],
        explanation: '"eat", "tea" and "ate" share the same letters; so do "tan" and "nat"; "bat" stands alone.',
      },
      { args: [['']], expected: [['']] },
      { args: [['a']], expected: [['a']] },
    ],
    tests: [
      { args: [['abc', 'bca', 'cab', 'xyz', 'zyx', 'q']], expected: [['abc', 'bca', 'cab'], ['xyz', 'zyx'], ['q']] },
      { args: [['', '']], expected: [['', '']] },
      { args: [['ab', 'ba', 'ab']], expected: [['ab', 'ba', 'ab']] },
      { args: [['abc', 'def']], expected: [['abc'], ['def']] },
      { args: [['aab', 'aba', 'abb']], expected: [['aab', 'aba'], ['abb']] },
      {
        args: [['listen', 'silent', 'enlist', 'google', 'gogole']],
        expected: [['listen', 'silent', 'enlist'], ['google', 'gogole']],
      },
      { args: [['a', 'b', 'a', '']], expected: [['a', 'a'], ['b'], ['']] },
    ],
    stress: [
      {
        label: '50k words drawn from 20k letter sets',
        generate: rng => {
          const bases = Array.from({ length: 20_000 }, () => randomString(rng, rng.int(5, 9)));
          const strs = Array.from({ length: 50_000 }, () => rng.shuffle(rng.pick(bases).split('')).join(''));
          return [strs];
        },
      },
    ],
    reference: (strs: string[]) => {
      const groups = new Map<string, string[]>();
      for (const s of strs) {
        const key = s.split('').sort().join('');
        const g = groups.get(key);
        if (g) g.push(s);
        else groups.set(key, [s]);
      }
      return [...groups.values()];
    },
  },
  // ------------------------------------------------------------------ 5
  {
    slug: 'top-k-frequent-elements',
    title: 'Top K Frequent Elements',
    difficulty: 'MEDIUM',
    tags: ['array', 'hash-map', 'bucket-sort', 'heap'],
    description:
      'Given an integer array `nums` and an integer `k`, return the `k` values that occur most often in `nums`.\n\n' +
      'The input guarantees that the answer is unique: the `k`-th highest frequency is strictly greater than every frequency outside the top `k`. ' +
      'You may return the values in any order. Try to beat `O(n log n)`.',
    constraints: [
      '1 ≤ nums.length ≤ 10⁵',
      '-10⁹ ≤ nums[i] ≤ 10⁹',
      '1 ≤ k ≤ number of distinct values in nums',
      'The set of the k most frequent values is unique',
    ],
    signature: {
      functionName: 'topKFrequent',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'k', type: 'int' },
      ],
      returns: 'int[]',
      compare: 'unordered',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2], explanation: '1 occurs three times and 2 twice; 3 only once.' },
      { args: [[1], 1], expected: [1] },
      { args: [[4, 4, 5, 5, 5, 6], 1], expected: [5] },
    ],
    tests: [
      { args: [[-1, -1, 2, 2, 2, 3], 2], expected: [2, -1] },
      { args: [[7, 7, 8, 9, 9, 9, 10, 10, 10, 10], 3], expected: [10, 9, 7] },
      { args: [[1, 2, 3], 3], expected: [1, 2, 3] },
      { args: [[5, 3, 5, 3, 5, 1], 2], expected: [5, 3] },
      { args: [[0, 0, 0, -5, -5, 8], 2], expected: [0, -5] },
      { args: [[100000, -100000, 100000], 1], expected: [100000] },
      { args: [[2, 2, 1, 1, 1, 3, 3, 3, 3], 3], expected: [1, 2, 3] },
    ],
    stress: [
      {
        label: '~95k values, 40k distinct, k = 10',
        generate: rng => {
          const used = new Set<number>();
          const fresh = () => {
            let v: number;
            do v = rng.int(-1_000_000, 1_000_000);
            while (used.has(v));
            used.add(v);
            return v;
          };
          const nums: number[] = [];
          for (let i = 0; i < 10; i++) {
            const v = fresh();
            for (let c = 0; c < 2000 - 100 * i; c++) nums.push(v);
          }
          for (let i = 0; i < 40_000; i++) {
            const v = fresh();
            nums.push(v, v);
          }
          return [rng.shuffle(nums), 10];
        },
      },
    ],
    reference: (nums: number[], k: number) => {
      const counts = new Map<number, number>();
      for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
      const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
      for (const [v, c] of counts) buckets[c].push(v);
      const out: number[] = [];
      for (let c = nums.length; c > 0 && out.length < k; c--) for (const v of buckets[c]) if (out.length < k) out.push(v);
      return out;
    },
  },
  // ------------------------------------------------------------------ 6
  {
    slug: 'kth-largest-element-in-an-array',
    title: 'Kth Largest Element in an Array',
    difficulty: 'MEDIUM',
    tags: ['array', 'heap', 'quickselect', 'sorting'],
    description:
      'Given an integer array `nums` and an integer `k`, return the value that would sit at position `k` (1-based) if the array were sorted from largest to smallest.\n\n' +
      'Duplicates count separately: in `[3, 3, 1]` the 1st and 2nd largest are both `3`.',
    constraints: ['1 ≤ k ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
    signature: {
      functionName: 'findKthLargest',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'k', type: 'int' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(n) average', space: 'O(1)' },
    examples: [
      { args: [[3, 2, 1, 5, 6, 4], 2], expected: 5, explanation: 'Sorted descending: 6, 5, 4, 3, 2, 1. The 2nd value is 5.' },
      { args: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], expected: 4 },
      { args: [[1], 1], expected: 1 },
    ],
    tests: [
      { args: [[2, 1], 2], expected: 1 },
      { args: [[-1, -1], 1], expected: -1 },
      { args: [[7, 7, 7, 7], 3], expected: 7 },
      { args: [[5, -3, 10, 0], 4], expected: -3 },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1], expected: 10 },
      { args: [[9, 8, 7, 6, 5], 5], expected: 5 },
      { args: [[3, 1, 2, 4], 2], expected: 3 },
    ],
    stress: [
      { label: '100k values, k = 50k', generate: rng => [randomInts(rng, 100_000, -10_000, 10_000), 50_000] },
      { label: '100k values with heavy duplicates, k = 70k', generate: rng => [randomInts(rng, 100_000, 0, 50), 70_000] },
    ],
    reference: (nums: number[], k: number) => {
      const sorted = Float64Array.from(nums).sort();
      return sorted[sorted.length - k];
    },
  },
  // ------------------------------------------------------------------ 7
  {
    slug: 'search-in-rotated-sorted-array',
    title: 'Search in Rotated Sorted Array',
    difficulty: 'MEDIUM',
    tags: ['array', 'binary-search'],
    description:
      'An array of **distinct** integers was sorted in increasing order and then possibly rotated: some prefix was moved, intact, to the end (for example `[0, 1, 2, 4, 5]` could become `[4, 5, 0, 1, 2]`).\n\n' +
      'Given that array `nums` and a value `target`, return the index of `target` in `nums`, or `-1` if it is absent. Your search should take `O(log n)` time.',
    constraints: [
      '1 ≤ nums.length ≤ 10⁵',
      '-10⁹ ≤ nums[i], target ≤ 10⁹',
      'All values in nums are distinct',
      'nums is an increasing array rotated by some amount (possibly zero)',
    ],
    signature: {
      functionName: 'searchRotated',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'target', type: 'int' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(log n)', space: 'O(1)' },
    examples: [
      { args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4, explanation: 'The value 0 sits at index 4.' },
      { args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1 },
      { args: [[1], 0], expected: -1 },
    ],
    tests: [
      { args: [[1], 1], expected: 0 },
      { args: [[3, 1], 1], expected: 1 },
      { args: [[1, 3], 3], expected: 1 },
      { args: [[5, 1, 3], 5], expected: 0 },
      { args: [[5, 1, 3], 3], expected: 2 },
      { args: [[6, 7, 1, 2, 3, 4, 5], 7], expected: 1 },
      { args: [[1, 2, 3, 4, 5], 4], expected: 3 },
      { args: [[2, 3, 4, 5, 1], 1], expected: 4 },
      { args: [[-10, -5, 0, 5, -20], -15], expected: -1 },
    ],
    stress: [
      {
        label: '100k rotated values, target present',
        generate: rng => {
          const nums = rotatedSorted(rng, 100_000);
          return [nums, nums[rng.int(0, nums.length - 1)]];
        },
      },
      {
        label: '100k rotated values, target missing',
        generate: rng => {
          const nums = rotatedSorted(rng, 100_000);
          return [nums, nums[rng.int(0, nums.length - 1)] + 1];
        },
      },
    ],
    reference: (nums: number[], target: number) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) return mid;
        if (nums[lo] <= nums[mid]) {
          if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
          else lo = mid + 1;
        } else if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
        else hi = mid - 1;
      }
      return -1;
    },
  },
  // ------------------------------------------------------------------ 8
  {
    slug: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'MEDIUM',
    tags: ['graph', 'depth-first-search', 'breadth-first-search', 'matrix'],
    description:
      'You are given a rectangular map `grid` where each cell is the string `"1"` (land) or `"0"` (water). ' +
      'Land cells that touch horizontally or vertically belong to the same island; diagonal contact does not connect them.\n\n' +
      'Return how many separate islands the map contains. Everything outside the grid is water.',
    constraints: ['1 ≤ rows, cols ≤ 500', 'grid[r][c] is "0" or "1"'],
    signature: {
      functionName: 'numIslands',
      params: [{ name: 'grid', type: 'char[][]' }],
      returns: 'int',
    },
    optimal: { time: 'O(rows·cols)', space: 'O(rows·cols)' },
    examples: [
      {
        args: [
          [
            ['1', '1', '0', '0', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '1', '0', '0'],
            ['0', '0', '0', '1', '1'],
          ],
        ],
        expected: 3,
        explanation: 'The 2×2 block in the top-left, the single cell in the middle and the pair in the bottom-right.',
      },
      {
        args: [
          [
            ['1', '1', '1'],
            ['0', '1', '0'],
            ['1', '1', '1'],
          ],
        ],
        expected: 1,
      },
      { args: [[['0']]], expected: 0 },
    ],
    tests: [
      { args: [[['1']]], expected: 1 },
      { args: [[['1', '0', '1', '0', '1']]], expected: 3 },
      { args: [[['1'], ['0'], ['1']]], expected: 2 },
      {
        args: [
          [
            ['1', '0'],
            ['0', '1'],
          ],
        ],
        expected: 2,
      },
      {
        args: [
          [
            ['1', '1', '1'],
            ['1', '1', '1'],
            ['1', '1', '1'],
          ],
        ],
        expected: 1,
      },
      {
        args: [
          [
            ['1', '0', '1'],
            ['0', '1', '0'],
            ['1', '0', '1'],
          ],
        ],
        expected: 5,
      },
      {
        args: [
          [
            ['1', '1', '1'],
            ['1', '0', '1'],
            ['1', '1', '1'],
          ],
        ],
        expected: 1,
      },
    ],
    stress: [
      {
        label: '500×500 random map',
        generate: rng => [
          Array.from({ length: 500 }, () => Array.from({ length: 500 }, () => (rng.next() < 0.45 ? '1' : '0'))),
        ],
      },
      {
        label: '500×500 single serpentine island (deep recursion)',
        generate: () => [
          Array.from({ length: 500 }, (_, r) =>
            Array.from({ length: 500 }, (_, c) => {
              if (r % 2 === 0) return '1';
              const open = r % 4 === 1 ? c === 499 : c === 0;
              return open ? '1' : '0';
            })
          ),
        ],
      },
    ],
    reference: (grid: string[][]) => {
      const rows = grid.length;
      const cols = grid[0].length;
      const seen = new Uint8Array(rows * cols);
      let count = 0;
      const stack: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] !== '1' || seen[r * cols + c]) continue;
          count++;
          seen[r * cols + c] = 1;
          stack.push(r * cols + c);
          while (stack.length) {
            const cell = stack.pop()!;
            const cr = Math.floor(cell / cols);
            const cc = cell % cols;
            for (const [dr, dc] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const nr = cr + dr;
              const nc = cc + dc;
              if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
              const id = nr * cols + nc;
              if (grid[nr][nc] === '1' && !seen[id]) {
                seen[id] = 1;
                stack.push(id);
              }
            }
          }
        }
      }
      return count;
    },
  },
  // ------------------------------------------------------------------ 9
  {
    slug: 'word-search',
    title: 'Word Search',
    difficulty: 'MEDIUM',
    tags: ['backtracking', 'depth-first-search', 'matrix'],
    description:
      'You are given a grid of letters `board` and a string `word`. Decide whether `word` can be spelled by walking through the grid, ' +
      'starting at any cell and stepping each time to a horizontally or vertically adjacent cell.\n\n' +
      'A single cell may be used at most once within one spelling. Letters are case-sensitive. Return `true` if such a path exists, otherwise `false`.',
    constraints: [
      '1 ≤ rows, cols ≤ 6',
      '1 ≤ word.length ≤ 15',
      'board and word contain only English letters (upper or lower case)',
    ],
    signature: {
      functionName: 'exist',
      params: [
        { name: 'board', type: 'char[][]' },
        { name: 'word', type: 'string' },
      ],
      returns: 'bool',
    },
    optimal: { time: 'O(rows·cols·3^L)', space: 'O(L)' },
    examples: [
      {
        args: [WORD_BOARD, 'CORE'],
        expected: true,
        explanation: 'C (0,0) → O (1,0) → R (1,1) → E (1,2).',
      },
      { args: [WORD_BOARD, 'TEND'], expected: false },
      { args: [[['a']], 'a'], expected: true },
    ],
    tests: [
      { args: [WORD_BOARD, 'DENY'], expected: true },
      { args: [WORD_BOARD, 'SDYN'], expected: true },
      { args: [WORD_BOARD, 'RETS'], expected: true },
      { args: [WORD_BOARD, 'SEED'], expected: false },
      { args: [WORD_BOARD, 'CATC'], expected: false },
      {
        args: [
          [
            ['a', 'b'],
            ['c', 'd'],
          ],
          'abcd',
        ],
        expected: false,
      },
      {
        args: [
          [
            ['a', 'b'],
            ['c', 'd'],
          ],
          'abdc',
        ],
        expected: true,
      },
      { args: [[['a', 'a']], 'aaa'], expected: false },
      {
        args: [
          [
            ['a', 'a', 'a'],
            ['a', 'a', 'a'],
          ],
          'aaaaaa',
        ],
        expected: true,
      },
      {
        args: [
          [
            ['a', 'a', 'a'],
            ['a', 'a', 'a'],
          ],
          'aaaaaaa',
        ],
        expected: false,
      },
      { args: [[['x']], 'X'], expected: false },
      {
        args: [
          [
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'B'],
          ],
          'AAAAAAAAAAAAAB',
        ],
        expected: true,
      },
      {
        args: [
          [
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'A'],
            ['A', 'A', 'A', 'A'],
          ],
          'AAAAAAAAAAAB',
        ],
        expected: false,
      },
    ],
    reference: (board: string[][], word: string) => {
      const rows = board.length;
      const cols = board[0].length;
      if (word.length > rows * cols) return false;
      const available = new Map<string, number>();
      for (const row of board) for (const ch of row) available.set(ch, (available.get(ch) ?? 0) + 1);
      const needed = new Map<string, number>();
      for (const ch of word) needed.set(ch, (needed.get(ch) ?? 0) + 1);
      for (const [ch, n] of needed) if ((available.get(ch) ?? 0) < n) return false;
      // search from the rarer end to cut the branching early
      const w = (available.get(word[0]) ?? 0) > (available.get(word[word.length - 1]) ?? 0) ? [...word].reverse().join('') : word;
      const used = board.map(row => row.map(() => false));
      const dfs = (r: number, c: number, i: number): boolean => {
        if (r < 0 || c < 0 || r >= rows || c >= cols || used[r][c] || board[r][c] !== w[i]) return false;
        if (i === w.length - 1) return true;
        used[r][c] = true;
        const found = dfs(r + 1, c, i + 1) || dfs(r - 1, c, i + 1) || dfs(r, c + 1, i + 1) || dfs(r, c - 1, i + 1);
        used[r][c] = false;
        return found;
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (dfs(r, c, 0)) return true;
      return false;
    },
  },
  // ------------------------------------------------------------------ 10
  {
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'MEDIUM',
    tags: ['dynamic-programming', 'breadth-first-search'],
    description:
      'You have an unlimited supply of coins of each denomination listed in `coins`. Find the smallest number of coins whose values add up to exactly `amount`.\n\n' +
      'Return that count, `0` when `amount` is `0`, or `-1` if no combination of coins reaches the amount exactly.',
    constraints: ['1 ≤ coins.length ≤ 12', '1 ≤ coins[i] ≤ 2³¹ - 1', '0 ≤ amount ≤ 10⁴'],
    signature: {
      functionName: 'coinChange',
      params: [
        { name: 'coins', type: 'int[]' },
        { name: 'amount', type: 'int' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(amount·coins)', space: 'O(amount)' },
    examples: [
      { args: [[1, 2, 5], 11], expected: 3, explanation: '11 = 5 + 5 + 1 uses three coins.' },
      { args: [[2], 3], expected: -1 },
      { args: [[1], 0], expected: 0 },
    ],
    tests: [
      { args: [[1], 1], expected: 1 },
      { args: [[2, 5, 10, 1], 27], expected: 4 },
      { args: [[3, 7], 5], expected: -1 },
      { args: [[3, 7], 14], expected: 2 },
      { args: [[5, 3], 11], expected: 3 },
      { args: [[4, 6], 13], expected: -1 },
      { args: [[2, 4], 0], expected: 0 },
      { args: [[9, 6, 5, 1], 11], expected: 2 },
      { args: [[1, 3, 4], 6], expected: 2 },
      { args: [[2147483647], 2], expected: -1 },
    ],
    stress: [
      {
        label: 'amount 10⁴ with 10 odd-sized coins',
        generate: rng => {
          const coins = new Set<number>();
          while (coins.size < 10) coins.add(rng.int(20, 400));
          return [[...coins], 10_000];
        },
      },
      {
        label: 'amount 9999 with only even coins (unreachable)',
        generate: rng => {
          const coins = new Set<number>();
          while (coins.size < 8) coins.add(2 * rng.int(1, 60));
          return [[...coins], 9_999];
        },
      },
    ],
    reference: (coins: number[], amount: number) => {
      const INF = Number.MAX_SAFE_INTEGER;
      const dp = new Array<number>(amount + 1).fill(INF);
      dp[0] = 0;
      for (let a = 1; a <= amount; a++) {
        for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
      }
      return dp[amount] === INF ? -1 : dp[amount];
    },
  },
  // ------------------------------------------------------------------ 11
  {
    slug: 'course-schedule',
    title: 'Course Schedule',
    difficulty: 'MEDIUM',
    tags: ['graph', 'topological-sort', 'depth-first-search'],
    description:
      'There are `numCourses` courses labelled `0` to `numCourses - 1`. Each entry `[a, b]` in `prerequisites` says course `b` must be completed before course `a` can be taken.\n\n' +
      'Return `true` if there is some order in which every course can be completed, or `false` if the requirements contain a circular dependency.',
    constraints: [
      '1 ≤ numCourses ≤ 10⁵',
      '0 ≤ prerequisites.length ≤ 10⁵',
      '0 ≤ a, b < numCourses and a ≠ b',
      'No pair appears twice',
    ],
    signature: {
      functionName: 'canFinish',
      params: [
        { name: 'numCourses', type: 'int' },
        { name: 'prerequisites', type: 'int[][]' },
      ],
      returns: 'bool',
    },
    optimal: { time: 'O(V + E)', space: 'O(V + E)' },
    examples: [
      { args: [2, [[1, 0]]], expected: true, explanation: 'Take course 0 first, then course 1.' },
      {
        args: [
          2,
          [
            [1, 0],
            [0, 1],
          ],
        ],
        expected: false,
      },
      { args: [3, []], expected: true },
    ],
    tests: [
      { args: [1, []], expected: true },
      {
        args: [
          3,
          [
            [0, 1],
            [1, 2],
            [2, 0],
          ],
        ],
        expected: false,
      },
      {
        args: [
          4,
          [
            [1, 0],
            [2, 1],
            [3, 2],
          ],
        ],
        expected: true,
      },
      {
        args: [
          5,
          [
            [1, 0],
            [2, 0],
            [3, 1],
            [3, 2],
            [4, 3],
          ],
        ],
        expected: true,
      },
      {
        args: [
          5,
          [
            [1, 0],
            [2, 1],
            [3, 2],
            [1, 3],
            [4, 0],
          ],
        ],
        expected: false,
      },
      {
        args: [
          6,
          [
            [1, 0],
            [3, 2],
            [5, 4],
            [4, 5],
          ],
        ],
        expected: false,
      },
      {
        args: [
          4,
          [
            [0, 1],
            [0, 2],
            [0, 3],
          ],
        ],
        expected: true,
      },
    ],
    stress: [
      { label: '20k courses, ~60k prerequisites, acyclic', generate: rng => [20_000, layeredPrereqs(rng, 20_000, false)] },
      { label: '20k courses, ~60k prerequisites, one long cycle', generate: rng => [20_000, layeredPrereqs(rng, 20_000, true)] },
    ],
    reference: (numCourses: number, prerequisites: number[][]) => {
      const indegree = new Int32Array(numCourses);
      const adj: number[][] = Array.from({ length: numCourses }, () => []);
      for (const [a, b] of prerequisites) {
        adj[b].push(a);
        indegree[a]++;
      }
      const queue: number[] = [];
      for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
      let done = 0;
      for (let q = 0; q < queue.length; q++) {
        done++;
        for (const next of adj[queue[q]]) if (--indegree[next] === 0) queue.push(next);
      }
      return done === numCourses;
    },
  },
  // ------------------------------------------------------------------ 12
  {
    slug: 'longest-palindromic-substring',
    title: 'Longest Palindromic Substring',
    difficulty: 'MEDIUM',
    tags: ['string', 'dynamic-programming', 'two-pointers'],
    description:
      'Given a string `s`, return its longest contiguous piece that reads the same forwards and backwards.\n\n' +
      'If several pieces share the maximum length, return the **leftmost** one (the one with the smallest starting index).',
    constraints: ['1 ≤ s.length ≤ 10⁴', '`s` consists of English letters and digits'],
    signature: {
      functionName: 'longestPalindrome',
      params: [{ name: 's', type: 'string' }],
      returns: 'string',
    },
    optimal: { time: 'O(n²) (O(n) with Manacher)', space: 'O(1)' },
    examples: [
      { args: ['babad'], expected: 'bab', explanation: '"bab" and "aba" both have length 3; "bab" starts further left.' },
      { args: ['cbbd'], expected: 'bb' },
      { args: ['a'], expected: 'a' },
    ],
    tests: [
      { args: ['ac'], expected: 'a' },
      { args: ['racecar'], expected: 'racecar' },
      { args: ['abacdfgdcaba'], expected: 'aba' },
      { args: ['forgeeksskeegfor'], expected: 'geeksskeeg' },
      { args: ['aaaa'], expected: 'aaaa' },
      { args: ['abcda'], expected: 'a' },
      { args: ['xyzzyabba'], expected: 'yzzy' },
      { args: ['noonracecar'], expected: 'racecar' },
      { args: ['Aa'], expected: 'A' },
      { args: ['12321abc'], expected: '12321' },
    ],
    stress: [
      { label: '10k random characters over {a, b}', generate: rng => [randomString(rng, 10_000, 'ab')] },
      {
        label: '10k mostly identical characters',
        generate: rng => {
          const chars = Array.from({ length: 10_000 }, () => 'a');
          for (let i = 0; i < 3; i++) chars[rng.int(0, chars.length - 1)] = 'b';
          return [chars.join('')];
        },
      },
    ],
    reference: (s: string) => {
      let bestStart = 0;
      let bestLen = 1;
      const expand = (l: number, r: number) => {
        while (l >= 0 && r < s.length && s[l] === s[r]) {
          l--;
          r++;
        }
        const len = r - l - 1;
        // strictly greater keeps the leftmost answer (same length implies same parity, so centres scan left to right)
        if (len > bestLen) {
          bestLen = len;
          bestStart = l + 1;
        }
      };
      for (let i = 0; i < s.length; i++) {
        expand(i, i);
        expand(i, i + 1);
      }
      return s.slice(bestStart, bestStart + bestLen);
    },
  },
];

/** Increasing distinct values, rotated at a random point. Gaps are ≥ 2 so `value + 1` is always absent. */
function rotatedSorted(rng: { int(min: number, max: number): number }, n: number): number[] {
  const sorted: number[] = [];
  let v = rng.int(-1_000_000_000, -999_000_000);
  for (let i = 0; i < n; i++) {
    sorted.push(v);
    v += rng.int(2, 15_000);
  }
  const k = rng.int(0, n - 1);
  return [...sorted.slice(k), ...sorted.slice(0, k)];
}

/**
 * Prerequisite pairs forming a DAG over a random ordering of the courses: a chain through every
 * course plus short forward jumps (exponentially many paths, which defeats DFS without memoisation).
 * With `cyclic`, one extra pair closes the chain into a cycle.
 */
function layeredPrereqs(rng: { int(min: number, max: number): number; shuffle<T>(items: T[]): T[] }, n: number, cyclic: boolean): number[][] {
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  const seen = new Set<number>();
  const pairs: number[][] = [];
  const link = (from: number, to: number) => {
    const key = from * n + to;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([order[to], order[from]]);
  };
  for (let i = 0; i + 1 < n; i++) link(i, i + 1);
  for (let e = 0; e < 40_000; e++) {
    const i = rng.int(0, n - 7);
    link(i, i + rng.int(2, 6));
  }
  if (cyclic) pairs.push([order[0], order[n - 1]]);
  return rng.shuffle(pairs);
}
