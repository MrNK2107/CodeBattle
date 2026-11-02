import { randomInts, randomString, toTree, type TreeNode } from '../helpers';
import type { QuestionDef } from '../types';

// All N-Queens boards for n = 5..8, listed literally (10, 4, 40 and 92 boards).
const QUEENS_5: string[][] = [
  ['Q....','..Q..','....Q','.Q...','...Q.'],
  ['Q....','...Q.','.Q...','....Q','..Q..'],
  ['.Q...','...Q.','Q....','..Q..','....Q'],
  ['.Q...','....Q','..Q..','Q....','...Q.'],
  ['..Q..','Q....','...Q.','.Q...','....Q'],
  ['..Q..','....Q','.Q...','...Q.','Q....'],
  ['...Q.','Q....','..Q..','....Q','.Q...'],
  ['...Q.','.Q...','....Q','..Q..','Q....'],
  ['....Q','.Q...','...Q.','Q....','..Q..'],
  ['....Q','..Q..','Q....','...Q.','.Q...'],
];
const QUEENS_6: string[][] = [
  ['.Q....','...Q..','.....Q','Q.....','..Q...','....Q.'],
  ['..Q...','.....Q','.Q....','....Q.','Q.....','...Q..'],
  ['...Q..','Q.....','....Q.','.Q....','.....Q','..Q...'],
  ['....Q.','..Q...','Q.....','.....Q','...Q..','.Q....'],
];
const QUEENS_7: string[][] = [
  ['Q......','..Q....','....Q..','......Q','.Q.....','...Q...','.....Q.'],
  ['Q......','...Q...','......Q','..Q....','.....Q.','.Q.....','....Q..'],
  ['Q......','....Q..','.Q.....','.....Q.','..Q....','......Q','...Q...'],
  ['Q......','.....Q.','...Q...','.Q.....','......Q','....Q..','..Q....'],
  ['.Q.....','...Q...','Q......','......Q','....Q..','..Q....','.....Q.'],
  ['.Q.....','...Q...','.....Q.','Q......','..Q....','....Q..','......Q'],
  ['.Q.....','....Q..','Q......','...Q...','......Q','..Q....','.....Q.'],
  ['.Q.....','....Q..','..Q....','Q......','......Q','...Q...','.....Q.'],
  ['.Q.....','....Q..','......Q','...Q...','Q......','..Q....','.....Q.'],
  ['.Q.....','.....Q.','..Q....','......Q','...Q...','Q......','....Q..'],
  ['.Q.....','......Q','....Q..','..Q....','Q......','.....Q.','...Q...'],
  ['..Q....','Q......','.....Q.','.Q.....','....Q..','......Q','...Q...'],
  ['..Q....','Q......','.....Q.','...Q...','.Q.....','......Q','....Q..'],
  ['..Q....','....Q..','......Q','.Q.....','...Q...','.....Q.','Q......'],
  ['..Q....','.....Q.','.Q.....','....Q..','Q......','...Q...','......Q'],
  ['..Q....','......Q','.Q.....','...Q...','.....Q.','Q......','....Q..'],
  ['..Q....','......Q','...Q...','Q......','....Q..','.Q.....','.....Q.'],
  ['...Q...','Q......','..Q....','.....Q.','.Q.....','......Q','....Q..'],
  ['...Q...','Q......','....Q..','.Q.....','.....Q.','..Q....','......Q'],
  ['...Q...','.Q.....','......Q','....Q..','..Q....','Q......','.....Q.'],
  ['...Q...','.....Q.','Q......','..Q....','....Q..','......Q','.Q.....'],
  ['...Q...','......Q','..Q....','.....Q.','.Q.....','....Q..','Q......'],
  ['...Q...','......Q','....Q..','.Q.....','.....Q.','Q......','..Q....'],
  ['....Q..','Q......','...Q...','......Q','..Q....','.....Q.','.Q.....'],
  ['....Q..','Q......','.....Q.','...Q...','.Q.....','......Q','..Q....'],
  ['....Q..','.Q.....','.....Q.','..Q....','......Q','...Q...','Q......'],
  ['....Q..','..Q....','Q......','.....Q.','...Q...','.Q.....','......Q'],
  ['....Q..','......Q','.Q.....','...Q...','.....Q.','Q......','..Q....'],
  ['....Q..','......Q','.Q.....','.....Q.','..Q....','Q......','...Q...'],
  ['.....Q.','Q......','..Q....','....Q..','......Q','.Q.....','...Q...'],
  ['.....Q.','.Q.....','....Q..','Q......','...Q...','......Q','..Q....'],
  ['.....Q.','..Q....','Q......','...Q...','......Q','....Q..','.Q.....'],
  ['.....Q.','..Q....','....Q..','......Q','Q......','...Q...','.Q.....'],
  ['.....Q.','..Q....','......Q','...Q...','Q......','....Q..','.Q.....'],
  ['.....Q.','...Q...','.Q.....','......Q','....Q..','..Q....','Q......'],
  ['.....Q.','...Q...','......Q','Q......','..Q....','....Q..','.Q.....'],
  ['......Q','.Q.....','...Q...','.....Q.','Q......','..Q....','....Q..'],
  ['......Q','..Q....','.....Q.','.Q.....','....Q..','Q......','...Q...'],
  ['......Q','...Q...','Q......','....Q..','.Q.....','.....Q.','..Q....'],
  ['......Q','....Q..','..Q....','Q......','.....Q.','...Q...','.Q.....'],
];
const QUEENS_8: string[][] = [
  ['Q.......','....Q...','.......Q','.....Q..','..Q.....','......Q.','.Q......','...Q....'],
  ['Q.......','.....Q..','.......Q','..Q.....','......Q.','...Q....','.Q......','....Q...'],
  ['Q.......','......Q.','...Q....','.....Q..','.......Q','.Q......','....Q...','..Q.....'],
  ['Q.......','......Q.','....Q...','.......Q','.Q......','...Q....','.....Q..','..Q.....'],
  ['.Q......','...Q....','.....Q..','.......Q','..Q.....','Q.......','......Q.','....Q...'],
  ['.Q......','....Q...','......Q.','Q.......','..Q.....','.......Q','.....Q..','...Q....'],
  ['.Q......','....Q...','......Q.','...Q....','Q.......','.......Q','.....Q..','..Q.....'],
  ['.Q......','.....Q..','Q.......','......Q.','...Q....','.......Q','..Q.....','....Q...'],
  ['.Q......','.....Q..','.......Q','..Q.....','Q.......','...Q....','......Q.','....Q...'],
  ['.Q......','......Q.','..Q.....','.....Q..','.......Q','....Q...','Q.......','...Q....'],
  ['.Q......','......Q.','....Q...','.......Q','Q.......','...Q....','.....Q..','..Q.....'],
  ['.Q......','.......Q','.....Q..','Q.......','..Q.....','....Q...','......Q.','...Q....'],
  ['..Q.....','Q.......','......Q.','....Q...','.......Q','.Q......','...Q....','.....Q..'],
  ['..Q.....','....Q...','.Q......','.......Q','Q.......','......Q.','...Q....','.....Q..'],
  ['..Q.....','....Q...','.Q......','.......Q','.....Q..','...Q....','......Q.','Q.......'],
  ['..Q.....','....Q...','......Q.','Q.......','...Q....','.Q......','.......Q','.....Q..'],
  ['..Q.....','....Q...','.......Q','...Q....','Q.......','......Q.','.Q......','.....Q..'],
  ['..Q.....','.....Q..','.Q......','....Q...','.......Q','Q.......','......Q.','...Q....'],
  ['..Q.....','.....Q..','.Q......','......Q.','Q.......','...Q....','.......Q','....Q...'],
  ['..Q.....','.....Q..','.Q......','......Q.','....Q...','Q.......','.......Q','...Q....'],
  ['..Q.....','.....Q..','...Q....','Q.......','.......Q','....Q...','......Q.','.Q......'],
  ['..Q.....','.....Q..','...Q....','.Q......','.......Q','....Q...','......Q.','Q.......'],
  ['..Q.....','.....Q..','.......Q','Q.......','...Q....','......Q.','....Q...','.Q......'],
  ['..Q.....','.....Q..','.......Q','Q.......','....Q...','......Q.','.Q......','...Q....'],
  ['..Q.....','.....Q..','.......Q','.Q......','...Q....','Q.......','......Q.','....Q...'],
  ['..Q.....','......Q.','.Q......','.......Q','....Q...','Q.......','...Q....','.....Q..'],
  ['..Q.....','......Q.','.Q......','.......Q','.....Q..','...Q....','Q.......','....Q...'],
  ['..Q.....','.......Q','...Q....','......Q.','Q.......','.....Q..','.Q......','....Q...'],
  ['...Q....','Q.......','....Q...','.......Q','.Q......','......Q.','..Q.....','.....Q..'],
  ['...Q....','Q.......','....Q...','.......Q','.....Q..','..Q.....','......Q.','.Q......'],
  ['...Q....','.Q......','....Q...','.......Q','.....Q..','Q.......','..Q.....','......Q.'],
  ['...Q....','.Q......','......Q.','..Q.....','.....Q..','.......Q','Q.......','....Q...'],
  ['...Q....','.Q......','......Q.','..Q.....','.....Q..','.......Q','....Q...','Q.......'],
  ['...Q....','.Q......','......Q.','....Q...','Q.......','.......Q','.....Q..','..Q.....'],
  ['...Q....','.Q......','.......Q','....Q...','......Q.','Q.......','..Q.....','.....Q..'],
  ['...Q....','.Q......','.......Q','.....Q..','Q.......','..Q.....','....Q...','......Q.'],
  ['...Q....','.....Q..','Q.......','....Q...','.Q......','.......Q','..Q.....','......Q.'],
  ['...Q....','.....Q..','.......Q','.Q......','......Q.','Q.......','..Q.....','....Q...'],
  ['...Q....','.....Q..','.......Q','..Q.....','Q.......','......Q.','....Q...','.Q......'],
  ['...Q....','......Q.','Q.......','.......Q','....Q...','.Q......','.....Q..','..Q.....'],
  ['...Q....','......Q.','..Q.....','.......Q','.Q......','....Q...','Q.......','.....Q..'],
  ['...Q....','......Q.','....Q...','.Q......','.....Q..','Q.......','..Q.....','.......Q'],
  ['...Q....','......Q.','....Q...','..Q.....','Q.......','.....Q..','.......Q','.Q......'],
  ['...Q....','.......Q','Q.......','..Q.....','.....Q..','.Q......','......Q.','....Q...'],
  ['...Q....','.......Q','Q.......','....Q...','......Q.','.Q......','.....Q..','..Q.....'],
  ['...Q....','.......Q','....Q...','..Q.....','Q.......','......Q.','.Q......','.....Q..'],
  ['....Q...','Q.......','...Q....','.....Q..','.......Q','.Q......','......Q.','..Q.....'],
  ['....Q...','Q.......','.......Q','...Q....','.Q......','......Q.','..Q.....','.....Q..'],
  ['....Q...','Q.......','.......Q','.....Q..','..Q.....','......Q.','.Q......','...Q....'],
  ['....Q...','.Q......','...Q....','.....Q..','.......Q','..Q.....','Q.......','......Q.'],
  ['....Q...','.Q......','...Q....','......Q.','..Q.....','.......Q','.....Q..','Q.......'],
  ['....Q...','.Q......','.....Q..','Q.......','......Q.','...Q....','.......Q','..Q.....'],
  ['....Q...','.Q......','.......Q','Q.......','...Q....','......Q.','..Q.....','.....Q..'],
  ['....Q...','..Q.....','Q.......','.....Q..','.......Q','.Q......','...Q....','......Q.'],
  ['....Q...','..Q.....','Q.......','......Q.','.Q......','.......Q','.....Q..','...Q....'],
  ['....Q...','..Q.....','.......Q','...Q....','......Q.','Q.......','.....Q..','.Q......'],
  ['....Q...','......Q.','Q.......','..Q.....','.......Q','.....Q..','...Q....','.Q......'],
  ['....Q...','......Q.','Q.......','...Q....','.Q......','.......Q','.....Q..','..Q.....'],
  ['....Q...','......Q.','.Q......','...Q....','.......Q','Q.......','..Q.....','.....Q..'],
  ['....Q...','......Q.','.Q......','.....Q..','..Q.....','Q.......','...Q....','.......Q'],
  ['....Q...','......Q.','.Q......','.....Q..','..Q.....','Q.......','.......Q','...Q....'],
  ['....Q...','......Q.','...Q....','Q.......','..Q.....','.......Q','.....Q..','.Q......'],
  ['....Q...','.......Q','...Q....','Q.......','..Q.....','.....Q..','.Q......','......Q.'],
  ['....Q...','.......Q','...Q....','Q.......','......Q.','.Q......','.....Q..','..Q.....'],
  ['.....Q..','Q.......','....Q...','.Q......','.......Q','..Q.....','......Q.','...Q....'],
  ['.....Q..','.Q......','......Q.','Q.......','..Q.....','....Q...','.......Q','...Q....'],
  ['.....Q..','.Q......','......Q.','Q.......','...Q....','.......Q','....Q...','..Q.....'],
  ['.....Q..','..Q.....','Q.......','......Q.','....Q...','.......Q','.Q......','...Q....'],
  ['.....Q..','..Q.....','Q.......','.......Q','...Q....','.Q......','......Q.','....Q...'],
  ['.....Q..','..Q.....','Q.......','.......Q','....Q...','.Q......','...Q....','......Q.'],
  ['.....Q..','..Q.....','....Q...','......Q.','Q.......','...Q....','.Q......','.......Q'],
  ['.....Q..','..Q.....','....Q...','.......Q','Q.......','...Q....','.Q......','......Q.'],
  ['.....Q..','..Q.....','......Q.','.Q......','...Q....','.......Q','Q.......','....Q...'],
  ['.....Q..','..Q.....','......Q.','.Q......','.......Q','....Q...','Q.......','...Q....'],
  ['.....Q..','..Q.....','......Q.','...Q....','Q.......','.......Q','.Q......','....Q...'],
  ['.....Q..','...Q....','Q.......','....Q...','.......Q','.Q......','......Q.','..Q.....'],
  ['.....Q..','...Q....','.Q......','.......Q','....Q...','......Q.','Q.......','..Q.....'],
  ['.....Q..','...Q....','......Q.','Q.......','..Q.....','....Q...','.Q......','.......Q'],
  ['.....Q..','...Q....','......Q.','Q.......','.......Q','.Q......','....Q...','..Q.....'],
  ['.....Q..','.......Q','.Q......','...Q....','Q.......','......Q.','....Q...','..Q.....'],
  ['......Q.','Q.......','..Q.....','.......Q','.....Q..','...Q....','.Q......','....Q...'],
  ['......Q.','.Q......','...Q....','Q.......','.......Q','....Q...','..Q.....','.....Q..'],
  ['......Q.','.Q......','.....Q..','..Q.....','Q.......','...Q....','.......Q','....Q...'],
  ['......Q.','..Q.....','Q.......','.....Q..','.......Q','....Q...','.Q......','...Q....'],
  ['......Q.','..Q.....','.......Q','.Q......','....Q...','Q.......','.....Q..','...Q....'],
  ['......Q.','...Q....','.Q......','....Q...','.......Q','Q.......','..Q.....','.....Q..'],
  ['......Q.','...Q....','.Q......','.......Q','.....Q..','Q.......','..Q.....','....Q...'],
  ['......Q.','....Q...','..Q.....','Q.......','.....Q..','.......Q','.Q......','...Q....'],
  ['.......Q','.Q......','...Q....','Q.......','......Q.','....Q...','..Q.....','.....Q..'],
  ['.......Q','.Q......','....Q...','..Q.....','Q.......','......Q.','...Q....','.....Q..'],
  ['.......Q','..Q.....','Q.......','.....Q..','.Q......','....Q...','......Q.','...Q....'],
  ['.......Q','...Q....','Q.......','..Q.....','.....Q..','.Q......','......Q.','....Q...'],
];

function nQueens(n: number): string[][] {
  const out: string[][] = [];
  const cols: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const d1 = new Array<boolean>(2 * n).fill(false);
  const d2 = new Array<boolean>(2 * n).fill(false);
  const place = (row: number) => {
    if (row === n) {
      out.push(cols.map(c => '.'.repeat(c) + 'Q' + '.'.repeat(n - c - 1)));
      return;
    }
    for (let c = 0; c < n; c++) {
      if (used[c] || d1[row + c] || d2[row - c + n]) continue;
      used[c] = d1[row + c] = d2[row - c + n] = true;
      cols.push(c);
      place(row + 1);
      cols.pop();
      used[c] = d1[row + c] = d2[row - c + n] = false;
    }
  };
  place(0);
  return out;
}

export const hard: QuestionDef[] = [
  {
    slug: 'sliding-window-maximum',
    title: 'Sliding Window Maximum',
    difficulty: 'HARD',
    tags: ['array', 'sliding-window', 'monotonic-queue'],
    description:
      'A window of width `k` starts over the first `k` elements of `nums` and slides right one position at a time until it covers the last `k` elements.\n\n' +
      'Return an array holding the largest value inside the window at each of its `nums.length - k + 1` positions, in order.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴', '1 ≤ k ≤ nums.length'],
    signature: {
      functionName: 'maxSlidingWindow',
      params: [
        { name: 'nums', type: 'int[]' },
        { name: 'k', type: 'int' },
      ],
      returns: 'int[]',
    },
    optimal: { time: 'O(n)', space: 'O(k)' },
    examples: [
      {
        args: [[1, 3, -1, -3, 5, 3, 6, 7], 3],
        expected: [3, 3, 5, 5, 6, 7],
        explanation: 'The windows are [1,3,-1], [3,-1,-3], [-1,-3,5], [-3,5,3], [5,3,6], [3,6,7].',
      },
      { args: [[1], 1], expected: [1] },
      { args: [[9, 11], 2], expected: [11] },
    ],
    tests: [
      { args: [[4, -2], 2], expected: [4] },
      { args: [[1, -1], 1], expected: [1, -1] },
      { args: [[7, 2, 4], 2], expected: [7, 4] },
      { args: [[1, 3, 1, 2, 0, 5], 3], expected: [3, 3, 2, 5] },
      { args: [[5, 4, 3, 2, 1], 5], expected: [5] },
      { args: [[-7, -8, 7, 5, 7, 1, 6, 0], 4], expected: [7, 7, 7, 7, 7] },
      { args: [[2, 2, 2], 2], expected: [2, 2] },
      { args: [[-5, -4, -3, -2, -1], 2], expected: [-4, -3, -2, -1] },
    ],
    stress: [
      { label: '100k random values, k = 50000', generate: rng => [randomInts(rng, 100_000, -10_000, 10_000), 50_000] },
      {
        label: '100k strictly decreasing values, k = 30000',
        generate: () => [Array.from({ length: 100_000 }, (_, i) => 10_000 - Math.floor(i / 5)), 30_000],
      },
    ],
    reference: (nums: number[], k: number) => {
      const out: number[] = [];
      const dq = new Int32Array(nums.length);
      let head = 0;
      let tail = 0;
      for (let i = 0; i < nums.length; i++) {
        while (tail > head && nums[dq[tail - 1]] <= nums[i]) tail--;
        dq[tail++] = i;
        if (dq[head] <= i - k) head++;
        if (i >= k - 1) out.push(nums[dq[head]]);
      }
      return out;
    },
  },
  {
    slug: 'minimum-window-substring',
    title: 'Minimum Window Substring',
    difficulty: 'HARD',
    tags: ['string', 'sliding-window', 'hash-map'],
    description:
      'Find the shortest contiguous piece of `s` that contains every character of `t`, counting repeats: if `t` has a letter twice, the piece must contain it at least twice.\n\n' +
      'If several shortest pieces exist, return the one that starts furthest to the left. If no piece works, return the empty string `""`. Letters are case-sensitive.',
    constraints: ['1 ≤ s.length, t.length ≤ 10⁵', '`s` and `t` contain only English letters (upper and lower case)'],
    signature: {
      functionName: 'minWindow',
      params: [
        { name: 's', type: 'string' },
        { name: 't', type: 'string' },
      ],
      returns: 'string',
    },
    optimal: { time: 'O(|s| + |t|)', space: 'O(1)' },
    examples: [
      {
        args: ['ADOBECODEBANC', 'ABC'],
        expected: 'BANC',
        explanation: '"BANC" holds one A, one B and one C, and no shorter piece of s does.',
      },
      { args: ['a', 'a'], expected: 'a' },
      { args: ['a', 'aa'], expected: '' },
    ],
    tests: [
      { args: ['ab', 'b'], expected: 'b' },
      { args: ['abc', 'cba'], expected: 'abc' },
      { args: ['aa', 'aa'], expected: 'aa' },
      { args: ['bba', 'ab'], expected: 'ba' },
      { args: ['cabwefgewcwaefgcf', 'cae'], expected: 'cwae' },
      { args: ['acbbaca', 'aba'], expected: 'baca' },
      { args: ['xaybxa', 'ab'], expected: 'ayb' },
      { args: ['abc', 'd'], expected: '' },
      { args: ['aA', 'A'], expected: 'A' },
    ],
    stress: [
      {
        label: '100k chars over 10 letters, 60-char target',
        generate: rng => [randomString(rng, 100_000, 'abcdefghij'), randomString(rng, 60, 'abcdefghij')],
      },
      {
        label: '100k chars, rare letters at both ends',
        generate: rng => ['X' + randomString(rng, 99_998, 'abcdefg') + 'Y', 'XY' + randomString(rng, 5, 'abc')],
      },
    ],
    reference: (s: string, t: string) => {
      const need = new Map<string, number>();
      for (const ch of t) need.set(ch, (need.get(ch) ?? 0) + 1);
      let missing = t.length;
      let bestLen = Infinity;
      let bestStart = 0;
      let left = 0;
      for (let right = 0; right < s.length; right++) {
        const c = s[right];
        if (need.has(c)) {
          if (need.get(c)! > 0) missing--;
          need.set(c, need.get(c)! - 1);
        }
        while (missing === 0) {
          if (right - left + 1 < bestLen) {
            bestLen = right - left + 1;
            bestStart = left;
          }
          const l = s[left++];
          if (need.has(l)) {
            need.set(l, need.get(l)! + 1);
            if (need.get(l)! > 0) missing++;
          }
        }
      }
      return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
    },
  },
  {
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'HARD',
    tags: ['array', 'two-pointers', 'monotonic-stack'],
    description:
      'Each entry of `height` is a column of unit-width blocks standing side by side. After a heavy rain, water settles in the dips between columns; nothing is held beyond the first or last column.\n\n' +
      'Return the total number of unit cells of water that stay trapped.',
    constraints: ['1 ≤ height.length ≤ 10⁵', '0 ≤ height[i] ≤ 10⁴'],
    signature: {
      functionName: 'trap',
      params: [{ name: 'height', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      {
        args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]],
        expected: 6,
        explanation: 'Water fills 1 cell at index 2, 4 cells across indices 4–6 and 1 cell at index 9.',
      },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9 },
      { args: [[1, 2, 3]], expected: 0 },
    ],
    tests: [
      { args: [[5]], expected: 0 },
      { args: [[3, 0, 3]], expected: 3 },
      { args: [[5, 4, 1, 2]], expected: 1 },
      { args: [[2, 0, 2, 0, 2]], expected: 4 },
      { args: [[0, 0, 0]], expected: 0 },
      { args: [[5, 2, 1, 2, 1, 5]], expected: 14 },
      { args: [[3, 2, 1]], expected: 0 },
      { args: [[0, 10000, 0, 10000, 0]], expected: 10000 },
    ],
    stress: [
      { label: '100k random heights', generate: rng => [randomInts(rng, 100_000, 0, 10_000)] },
      {
        label: '100k-wide valley',
        generate: rng => {
          const h = randomInts(rng, 100_000, 0, 50);
          h[0] = 10_000;
          h[99_999] = 9_999;
          return [h];
        },
      },
    ],
    reference: (height: number[]) => {
      let l = 0;
      let r = height.length - 1;
      let leftMax = 0;
      let rightMax = 0;
      let total = 0;
      while (l < r) {
        if (height[l] < height[r]) {
          leftMax = Math.max(leftMax, height[l]);
          total += leftMax - height[l++];
        } else {
          rightMax = Math.max(rightMax, height[r]);
          total += rightMax - height[r--];
        }
      }
      return total;
    },
  },
  {
    slug: 'median-of-two-sorted-arrays',
    title: 'Median of Two Sorted Arrays',
    difficulty: 'HARD',
    tags: ['array', 'binary-search', 'divide-and-conquer'],
    description:
      'Two arrays `nums1` and `nums2` are each sorted in non-decreasing order. Imagine merging them into one sorted array and return its median as a floating-point number.\n\n' +
      'When the merged length is odd the median is the middle element; when it is even it is the average of the two middle elements. Aim for logarithmic time rather than merging.',
    constraints: [
      '0 ≤ nums1.length, nums2.length ≤ 10⁵',
      '1 ≤ nums1.length + nums2.length',
      '-10⁶ ≤ nums1[i], nums2[i] ≤ 10⁶',
      'Answers within 10⁻⁶ are accepted',
    ],
    signature: {
      functionName: 'findMedianSortedArrays',
      params: [
        { name: 'nums1', type: 'int[]' },
        { name: 'nums2', type: 'int[]' },
      ],
      returns: 'double',
    },
    optimal: { time: 'O(log(min(m, n)))', space: 'O(1)' },
    examples: [
      { args: [[1, 3], [2]], expected: 2, explanation: 'The merged array is [1,2,3]; its middle element is 2.' },
      { args: [[1, 2], [3, 4]], expected: 2.5 },
      { args: [[], [1]], expected: 1 },
    ],
    tests: [
      { args: [[0, 0], [0, 0]], expected: 0 },
      { args: [[2], []], expected: 2 },
      { args: [[1, 2, 3], [4, 5, 6]], expected: 3.5 },
      { args: [[-5, 3, 6, 12, 15], [-12, -10, -6, -3, 4, 10]], expected: 3 },
      { args: [[1, 1, 1], [1, 1, 1]], expected: 1 },
      { args: [[1, 4], [2, 3]], expected: 2.5 },
      { args: [[-1000000], [1000000, 1000000]], expected: 1000000 },
      { args: [[], [1, 2]], expected: 1.5 },
    ],
    stress: [
      {
        label: 'two sorted arrays of 100k each',
        generate: rng => [
          randomInts(rng, 100_000, -200_000, 200_000).sort((a, b) => a - b),
          randomInts(rng, 100_000, -200_000, 200_000).sort((a, b) => a - b),
        ],
      },
      {
        label: '100k vs 3 values',
        generate: rng => [
          randomInts(rng, 100_000, -1_000_000, 1_000_000).sort((a, b) => a - b),
          randomInts(rng, 3, -1_000_000, 1_000_000).sort((a, b) => a - b),
        ],
      },
    ],
    reference: (nums1: number[], nums2: number[]) => {
      let a = nums1;
      let b = nums2;
      if (a.length > b.length) [a, b] = [b, a];
      const m = a.length;
      const n = b.length;
      const half = (m + n + 1) >> 1;
      let lo = 0;
      let hi = m;
      while (lo <= hi) {
        const i = (lo + hi) >> 1;
        const j = half - i;
        const aLeft = i > 0 ? a[i - 1] : -Infinity;
        const aRight = i < m ? a[i] : Infinity;
        const bLeft = j > 0 ? b[j - 1] : -Infinity;
        const bRight = j < n ? b[j] : Infinity;
        if (aLeft > bRight) hi = i - 1;
        else if (bLeft > aRight) lo = i + 1;
        else {
          const leftMax = Math.max(aLeft, bLeft);
          if ((m + n) % 2 === 1) return leftMax;
          return (leftMax + Math.min(aRight, bRight)) / 2;
        }
      }
      return 0;
    },
  },
  {
    slug: 'edit-distance',
    title: 'Edit Distance',
    difficulty: 'HARD',
    tags: ['string', 'dynamic-programming'],
    description:
      'You may change `word1` one character at a time using three kinds of edit: insert a character anywhere, delete a character, or overwrite a character with a different one.\n\n' +
      'Return the smallest number of edits that turns `word1` into exactly `word2`.',
    constraints: ['0 ≤ word1.length, word2.length ≤ 2000', 'Both words contain only lowercase English letters'],
    signature: {
      functionName: 'minDistance',
      params: [
        { name: 'word1', type: 'string' },
        { name: 'word2', type: 'string' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(m·n)', space: 'O(min(m, n))' },
    examples: [
      {
        args: ['horse', 'ros'],
        expected: 3,
        explanation: 'Overwrite h with r (rorse), delete the middle r (rose), delete e (ros).',
      },
      { args: ['intention', 'execution'], expected: 5 },
      { args: ['', ''], expected: 0 },
    ],
    tests: [
      { args: ['', 'abc'], expected: 3 },
      { args: ['abc', ''], expected: 3 },
      { args: ['abc', 'abc'], expected: 0 },
      { args: ['a', 'b'], expected: 1 },
      { args: ['kitten', 'sitting'], expected: 3 },
      { args: ['sunday', 'saturday'], expected: 3 },
      { args: ['ab', 'ba'], expected: 2 },
      { args: ['zoologicoarchaeologist', 'zoogeologist'], expected: 10 },
    ],
    stress: [
      {
        label: 'two random 2000-letter words',
        generate: rng => [randomString(rng, 2000, 'abcd'), randomString(rng, 2000, 'abcd')],
      },
      {
        label: '2000-letter word vs a lightly edited copy',
        generate: rng => {
          const w = randomString(rng, 2000, 'abcdefgh').split('');
          const v = [...w];
          for (let e = 0; e < 60; e++) {
            const at = rng.int(0, v.length - 1);
            const kind = rng.int(0, 2);
            if (kind === 0) v[at] = randomString(rng, 1, 'abcdefgh');
            else if (kind === 1) v.splice(at, 1);
            else v.splice(at, 0, randomString(rng, 1, 'abcdefgh'));
          }
          return [w.join(''), v.slice(0, 2000).join('')];
        },
      },
    ],
    reference: (word1: string, word2: string) => {
      const m = word1.length;
      const n = word2.length;
      let prev = new Int32Array(n + 1);
      let cur = new Int32Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        cur[0] = i;
        const c = word1.charCodeAt(i - 1);
        for (let j = 1; j <= n; j++) {
          if (c === word2.charCodeAt(j - 1)) cur[j] = prev[j - 1];
          else cur[j] = 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        }
        [prev, cur] = [cur, prev];
      }
      return prev[n];
    },
  },
  {
    slug: 'longest-valid-parentheses',
    title: 'Longest Valid Parentheses',
    difficulty: 'HARD',
    tags: ['string', 'stack', 'dynamic-programming'],
    description:
      'The string `s` is made only of `(` and `)`. A substring is *well-formed* when every opening bracket in it is closed later in that substring and no closing bracket appears without a matching earlier opener.\n\n' +
      'Return the length of the longest well-formed contiguous substring of `s` (0 if there is none).',
    constraints: ['0 ≤ s.length ≤ 10⁵', "`s[i]` is '(' or ')'"],
    signature: {
      functionName: 'longestValidParentheses',
      params: [{ name: 's', type: 'string' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: ['(()'], expected: 2, explanation: 'The best well-formed piece is "()", of length 2.' },
      { args: [')()())'], expected: 4 },
      { args: [''], expected: 0 },
    ],
    tests: [
      { args: ['()(()'], expected: 2 },
      { args: ['()(())'], expected: 6 },
      { args: ['((((('], expected: 0 },
      { args: ['))))())()()(()'], expected: 4 },
      { args: [')('], expected: 0 },
      { args: ['(()())'], expected: 6 },
      { args: ['()()'], expected: 4 },
      { args: ['(()))())('], expected: 4 },
    ],
    stress: [
      {
        label: '100k random brackets',
        generate: rng => [randomString(rng, 100_000, '((()))()')],
      },
      {
        label: '100k chars: deep nesting with a stray opener in front',
        generate: () => ['(' + '('.repeat(49_999) + ')'.repeat(49_999) + '()'],
      },
    ],
    reference: (s: string) => {
      const stack: number[] = [-1];
      let best = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') stack.push(i);
        else {
          stack.pop();
          if (stack.length === 0) stack.push(i);
          else best = Math.max(best, i - stack[stack.length - 1]);
        }
      }
      return best;
    },
  },
  {
    slug: 'n-queens',
    title: 'N-Queens',
    difficulty: 'HARD',
    tags: ['backtracking'],
    description:
      'Place `n` chess queens on an `n × n` board so that no two share a row, a column or a diagonal. Return every distinct placement.\n\n' +
      "Describe each placement as a list of `n` strings, one per row from top to bottom, where `'Q'` marks a queen and `'.'` an empty square. The placements may be returned in any order.",
    constraints: ['1 ≤ n ≤ 9'],
    signature: {
      functionName: 'solveNQueens',
      params: [{ name: 'n', type: 'int' }],
      returns: 'string[][]',
      compare: 'unordered',
      javaReturns: 'List<List<String>>',
    },
    optimal: { time: 'O(n!)', space: 'O(n)' },
    examples: [
      {
        args: [4],
        expected: [
          ['.Q..', '...Q', 'Q...', '..Q.'],
          ['..Q.', 'Q...', '...Q', '.Q..'],
        ],
        explanation: 'A 4×4 board admits exactly two non-attacking arrangements, mirror images of each other.',
      },
      { args: [1], expected: [['Q']] },
      { args: [3], expected: [] },
    ],
    tests: [
      { args: [2], expected: [] },
      { args: [5], expected: QUEENS_5 },
      { args: [6], expected: QUEENS_6 },
      { args: [7], expected: QUEENS_7 },
      { args: [8], expected: QUEENS_8 },
      { args: [1], expected: [['Q']] },
    ],
    reference: (n: number) => nQueens(n),
  },
  {
    slug: 'largest-rectangle-in-histogram',
    title: 'Largest Rectangle in Histogram',
    difficulty: 'HARD',
    tags: ['array', 'monotonic-stack'],
    description:
      'A histogram has bars of width 1 whose heights are given by `heights`, placed next to each other with no gaps.\n\n' +
      'Return the area of the largest axis-aligned rectangle that fits entirely inside the histogram.',
    constraints: ['1 ≤ heights.length ≤ 10⁵', '0 ≤ heights[i] ≤ 10⁴'],
    signature: {
      functionName: 'largestRectangleArea',
      params: [{ name: 'heights', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      { args: [[2, 1, 5, 6, 2, 3]], expected: 10, explanation: 'The bars of height 5 and 6 support a 5 × 2 rectangle.' },
      { args: [[2, 4]], expected: 4 },
      { args: [[1]], expected: 1 },
    ],
    tests: [
      { args: [[0]], expected: 0 },
      { args: [[2, 2, 2, 2]], expected: 8 },
      { args: [[6, 2, 5, 4, 5, 1, 6]], expected: 12 },
      { args: [[1, 2, 3, 4, 5]], expected: 9 },
      { args: [[5, 4, 3, 2, 1]], expected: 9 },
      { args: [[0, 0, 1, 0]], expected: 1 },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 6 },
      { args: [[10000]], expected: 10000 },
    ],
    stress: [
      { label: '100k random heights', generate: rng => [randomInts(rng, 100_000, 0, 10_000)] },
      {
        label: '100k slowly rising heights',
        generate: () => [Array.from({ length: 100_000 }, (_, i) => Math.floor(i / 10))],
      },
    ],
    reference: (heights: number[]) => {
      const stack: number[] = [];
      let best = 0;
      for (let i = 0; i <= heights.length; i++) {
        const h = i === heights.length ? 0 : heights[i];
        while (stack.length && heights[stack[stack.length - 1]] >= h) {
          const top = heights[stack.pop()!];
          const left = stack.length ? stack[stack.length - 1] + 1 : 0;
          best = Math.max(best, top * (i - left));
        }
        stack.push(i);
      }
      return best;
    },
  },
  {
    slug: 'first-missing-positive',
    title: 'First Missing Positive',
    difficulty: 'HARD',
    tags: ['array', 'in-place'],
    description:
      'Given an unsorted integer array `nums`, return the smallest positive integer (1, 2, 3, ...) that does not occur in it.\n\n' +
      'Try to do it in linear time using only constant extra memory (you may rearrange `nums`).',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '-2³¹ ≤ nums[i] ≤ 2³¹ - 1'],
    signature: {
      functionName: 'firstMissingPositive',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[1, 2, 0]], expected: 3, explanation: '1 and 2 are present, so 3 is the first gap.' },
      { args: [[3, 4, -1, 1]], expected: 2 },
      { args: [[7, 8, 9, 11, 12]], expected: 1 },
    ],
    tests: [
      { args: [[1]], expected: 2 },
      { args: [[2]], expected: 1 },
      { args: [[1, 1]], expected: 2 },
      { args: [[-1, -2]], expected: 1 },
      { args: [[1, 2, 3, 4, 5]], expected: 6 },
      { args: [[2, 3, 4, 5, 1, 7]], expected: 6 },
      { args: [[0, 2, 2, 1, 1]], expected: 3 },
      { args: [[2147483647, -2147483648, 1]], expected: 2 },
    ],
    stress: [
      {
        label: 'shuffled 1..100000 with one value knocked out',
        generate: rng => {
          const nums = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i + 1));
          nums[rng.int(0, nums.length - 1)] = -7;
          return [nums];
        },
      },
      {
        label: 'shuffled 1..100000 (answer is n + 1)',
        generate: rng => [rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i + 1))],
      },
    ],
    reference: (nums: number[]) => {
      const n = nums.length;
      for (let i = 0; i < n; i++) {
        while (nums[i] >= 1 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
          const j = nums[i] - 1;
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }
      }
      for (let i = 0; i < n; i++) if (nums[i] !== i + 1) return i + 1;
      return n + 1;
    },
  },
  {
    slug: 'regular-expression-matching',
    title: 'Regular Expression Matching',
    difficulty: 'HARD',
    tags: ['string', 'dynamic-programming', 'recursion'],
    description:
      'Implement a tiny pattern matcher. In the pattern `p`, a lowercase letter matches itself, `.` matches any single character, and `*` lets the element directly before it appear zero or more times.\n\n' +
      'Return `true` only if the pattern matches the **entire** string `s`, not just part of it. Every `*` in `p` is guaranteed to follow a letter or `.`.',
    constraints: [
      '0 ≤ s.length ≤ 3000',
      '0 ≤ p.length ≤ 3000',
      '`s` contains only lowercase English letters',
      "`p` contains only lowercase English letters, '.' and '*'",
    ],
    signature: {
      functionName: 'isMatch',
      params: [
        { name: 's', type: 'string' },
        { name: 'p', type: 'string' },
      ],
      returns: 'bool',
    },
    optimal: { time: 'O(m·n)', space: 'O(n)' },
    examples: [
      { args: ['aa', 'a'], expected: false, explanation: 'The pattern covers only one "a", not the whole string.' },
      { args: ['aa', 'a*'], expected: true },
      { args: ['ab', '.*'], expected: true },
    ],
    tests: [
      { args: ['aab', 'c*a*b'], expected: true },
      { args: ['mississippi', 'mis*is*p*.'], expected: false },
      { args: ['', 'a*b*'], expected: true },
      { args: ['', ''], expected: true },
      { args: ['a', ''], expected: false },
      { args: ['ab', '.*c'], expected: false },
      { args: ['aaa', 'a*a'], expected: true },
      { args: ['aaa', 'ab*a*c*a'], expected: true },
      { args: ['a', '.*..a*'], expected: false },
      { args: ['', '.'], expected: false },
    ],
    stress: [
      {
        label: "3000 a's against a*a*...a*b (no match)",
        generate: () => ['a'.repeat(3000), 'a*'.repeat(20) + 'b'],
      },
      {
        label: '2000-char string against a long wildcard pattern',
        generate: rng => {
          const s = randomString(rng, 2000, 'ab');
          return [s, '.*a*b*'.repeat(150) + s.slice(-3) + 'c*'];
        },
      },
    ],
    reference: (s: string, p: string) => {
      const m = s.length;
      const n = p.length;
      // next[j] = does s[i+1..] match p[j..]; cur[j] = does s[i..] match p[j..]
      let next = new Uint8Array(n + 2);
      let cur = new Uint8Array(n + 2);
      for (let i = m; i >= 0; i--) {
        cur.fill(0);
        cur[n] = i === m ? 1 : 0;
        for (let j = n - 1; j >= 0; j--) {
          const first = i < m && (p[j] === '.' || p[j] === s[i]);
          if (j + 1 < n && p[j + 1] === '*') cur[j] = cur[j + 2] || (first && next[j]) ? 1 : 0;
          else cur[j] = first && next[j + 1] ? 1 : 0;
        }
        [next, cur] = [cur, next];
      }
      return next[0] === 1;
    },
  },
  {
    slug: 'word-ladder',
    title: 'Word Ladder',
    difficulty: 'HARD',
    tags: ['graph', 'bfs', 'string', 'hash-set'],
    description:
      'Starting from `beginWord`, you may repeatedly change exactly one letter, but every intermediate and final word must appear in `wordList` (`beginWord` itself need not). All words have the same length.\n\n' +
      'Return the number of words in the shortest such chain from `beginWord` to `endWord`, counting both ends. Return `0` if `endWord` cannot be reached.',
    constraints: [
      '1 ≤ beginWord.length ≤ 10',
      '`endWord` and every word in `wordList` have the same length as `beginWord`',
      '1 ≤ wordList.length ≤ 5000',
      'All words are lowercase English letters; `wordList` has no duplicates',
      '`beginWord` ≠ `endWord`',
    ],
    signature: {
      functionName: 'ladderLength',
      params: [
        { name: 'beginWord', type: 'string' },
        { name: 'endWord', type: 'string' },
        { name: 'wordList', type: 'string[]' },
      ],
      returns: 'int',
    },
    optimal: { time: 'O(N·L·26)', space: 'O(N·L)' },
    examples: [
      {
        args: ['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']],
        expected: 5,
        explanation: 'hit → hot → dot → dog → cog uses five words.',
      },
      { args: ['hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log']], expected: 0 },
      { args: ['a', 'c', ['a', 'b', 'c']], expected: 2 },
    ],
    tests: [
      { args: ['hot', 'dog', ['hot', 'dog']], expected: 0 },
      { args: ['hot', 'dog', ['hot', 'dog', 'dot']], expected: 3 },
      { args: ['lost', 'cost', ['most', 'fist', 'lost', 'cost', 'fish']], expected: 2 },
      { args: ['red', 'tax', ['ted', 'tex', 'red', 'tax', 'tad', 'den', 'rex', 'pee']], expected: 4 },
      { args: ['ab', 'cd', ['ad', 'cd']], expected: 3 },
      { args: ['hit', 'cog', ['cog']], expected: 0 },
      { args: ['abc', 'xyz', ['xbc', 'xyc', 'xyz', 'abz']], expected: 4 },
    ],
    stress: [
      {
        label: '5000 dense six-letter words, path guaranteed',
        generate: rng => {
          const words = new Set<string>();
          // chain aaaaaa -> ... -> eeeeee, one letter at a time
          const w = 'aaaaaa'.split('');
          for (const target of ['b', 'c', 'd', 'e']) {
            for (let k = 0; k < 6; k++) {
              w[k] = target;
              words.add(w.join(''));
            }
          }
          while (words.size < 5000) words.add(randomString(rng, 6, 'abcde'));
          words.delete('aaaaaa');
          return ['aaaaaa', 'eeeeee', rng.shuffle([...words])];
        },
      },
      {
        label: '5000 words, target unreachable',
        generate: rng => {
          const words = new Set<string>();
          while (words.size < 4999) words.add(randomString(rng, 6, 'abcde'));
          words.delete('aaaaaa');
          return ['aaaaaa', 'zzzzzz', rng.shuffle([...words, 'zzzzzz'])];
        },
      },
    ],
    reference: (beginWord: string, endWord: string, wordList: string[]) => {
      const dict = new Set(wordList);
      if (!dict.has(endWord)) return 0;
      const seen = new Set<string>([beginWord]);
      let frontier = [beginWord];
      let steps = 1;
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      while (frontier.length) {
        const nextFrontier: string[] = [];
        for (const word of frontier) {
          if (word === endWord) return steps;
          for (let i = 0; i < word.length; i++) {
            for (const ch of letters) {
              if (ch === word[i]) continue;
              const cand = word.slice(0, i) + ch + word.slice(i + 1);
              if (dict.has(cand) && !seen.has(cand)) {
                seen.add(cand);
                nextFrontier.push(cand);
              }
            }
          }
        }
        frontier = nextFrontier;
        steps++;
      }
      return 0;
    },
  },
  {
    slug: 'binary-tree-maximum-path-sum',
    title: 'Binary Tree Maximum Path Sum',
    difficulty: 'HARD',
    tags: ['tree', 'dfs', 'dynamic-programming'],
    description:
      'A *path* in a binary tree is a sequence of distinct nodes where each consecutive pair is joined by an edge; it may go up through a parent and back down, but never visits a node twice. A path contains at least one node and need not include the root.\n\n' +
      'Given the `root` of a non-empty binary tree, return the largest sum of node values over all paths.',
    constraints: ['1 ≤ number of nodes ≤ 10⁵', '-1000 ≤ Node.val ≤ 1000'],
    signature: {
      functionName: 'maxPathSum',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(h)' },
    examples: [
      { args: [[1, 2, 3]], expected: 6, explanation: 'The path 2 → 1 → 3 sums to 6.' },
      { args: [[-10, 9, 20, null, null, 15, 7]], expected: 42 },
      { args: [[-3]], expected: -3 },
    ],
    tests: [
      { args: [[2, -1]], expected: 2 },
      { args: [[-2, -1]], expected: -1 },
      { args: [[1, -2, 3]], expected: 4 },
      { args: [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]], expected: 48 },
      { args: [[1, 2, null, 3, null, 4]], expected: 10 },
      { args: [[-1, -2, -3]], expected: -1 },
      { args: [[9, 6, -3, null, null, -6, 2, null, null, 2, null, -6, -6, -6]], expected: 16 },
      { args: [[-1000, 1000, 1000]], expected: 1000 },
    ],
    stress: [
      { label: 'complete tree of 100k nodes', generate: rng => [randomInts(rng, 100_000, -1000, 1000)] },
      {
        label: 'random-shaped tree of ~30k nodes',
        generate: rng => {
          const vals: (number | null)[] = [rng.int(-1000, 1000)];
          let open = 1;
          while (open > 0 && vals.length < 40_000) {
            open--;
            for (let c = 0; c < 2; c++) {
              if (rng.next() < 0.75) {
                vals.push(rng.int(-1000, 1000));
                open++;
              } else vals.push(null);
            }
          }
          while (vals.length && vals[vals.length - 1] === null) vals.pop();
          return [vals];
        },
      },
    ],
    reference: (values: (number | null)[]) => {
      const root = toTree(values);
      if (!root) return 0;
      const order: TreeNode[] = [root];
      for (let i = 0; i < order.length; i++) {
        const node = order[i];
        if (node.left) order.push(node.left);
        if (node.right) order.push(node.right);
      }
      const gain = new Map<TreeNode, number>();
      let best = -Infinity;
      for (let i = order.length - 1; i >= 0; i--) {
        const node = order[i];
        const l = node.left ? Math.max(0, gain.get(node.left)!) : 0;
        const r = node.right ? Math.max(0, gain.get(node.right)!) : 0;
        best = Math.max(best, node.val + l + r);
        gain.set(node, node.val + Math.max(l, r));
      }
      return best;
    },
  },
];
