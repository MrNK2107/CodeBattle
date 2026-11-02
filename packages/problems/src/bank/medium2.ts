import { randomInts, toTree, type TreeNode } from '../helpers';
import type { QuestionDef, Rng } from '../types';

// ---------------------------------------------------------------- local helpers

/** Random tree with exactly `n` nodes (n ≥ 1), as a level-order array with nulls. */
function randomTreeArray(rng: Rng, n: number, min: number, max: number, p = 0.8): (number | null)[] {
  const out: (number | null)[] = [rng.int(min, max)];
  let pending = 1;
  let made = 1;
  while (pending > 0 && made < n) {
    pending--;
    for (let side = 0; side < 2; side++) {
      const force = side === 0 && pending === 0; // never let the frontier die out early
      if (made < n && (force || rng.next() < p)) {
        out.push(rng.int(min, max));
        made++;
        pending++;
      } else {
        out.push(null);
      }
    }
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** Complete binary tree of `n` nodes whose in-order traversal is strictly increasing. */
function completeBstArray(rng: Rng, n: number): number[] {
  const vals = new Array<number>(n);
  let next = -1_000_000_000;
  const stack: number[] = [];
  let i = 0;
  while (stack.length || i < n) {
    while (i < n) {
      stack.push(i);
      i = 2 * i + 1;
    }
    i = stack.pop()!;
    vals[i] = next;
    next += rng.int(1, 20);
    i = 2 * i + 2;
  }
  return vals;
}

/** Brute force: every string of 2n brackets that is balanced (independent of the reference). */
function allBalanced(n: number): string[] {
  const out: string[] = [];
  for (let mask = 0; mask < 1 << (2 * n); mask++) {
    let depth = 0;
    let s = '';
    let ok = true;
    for (let b = 2 * n - 1; b >= 0; b--) {
      const open = ((mask >> b) & 1) === 1;
      depth += open ? 1 : -1;
      s += open ? '(' : ')';
      if (depth < 0) {
        ok = false;
        break;
      }
    }
    if (ok && depth === 0) out.push(s);
  }
  return out;
}

export const medium2: QuestionDef[] = [
  // ------------------------------------------------------------ subsets
  {
    slug: 'subsets',
    title: 'Subsets',
    difficulty: 'MEDIUM',
    tags: ['array', 'backtracking', 'bit-manipulation'],
    description:
      'You are given an array `nums` of **distinct** integers. Produce its power set: every possible subset, including the empty one and `nums` itself.\n\n' +
      'Each subset must appear exactly once. The subsets may be listed in any order, and the numbers inside a subset may also be in any order.',
    constraints: ['1 ≤ nums.length ≤ 10', '-10 ≤ nums[i] ≤ 10', 'All values in `nums` are distinct'],
    signature: {
      functionName: 'subsets',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int[][]',
      compare: 'unordered-nested',
      javaReturns: 'List<List<Integer>>',
    },
    optimal: { time: 'O(n · 2ⁿ)', space: 'O(n)' },
    examples: [
      {
        args: [[1, 2, 3]],
        expected: [[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]],
        explanation: 'Three distinct values give 2³ = 8 subsets.',
      },
      { args: [[0]], expected: [[], [0]] },
      { args: [[5, -1]], expected: [[], [5], [-1], [5, -1]] },
    ],
    tests: [
      { args: [[7]], expected: [[], [7]] },
      { args: [[-3, 3]], expected: [[], [-3], [3], [-3, 3]] },
      {
        args: [[1, 2, 3, 4]],
        expected: [
          [], [1], [2], [3], [4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
          [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4], [1, 2, 3, 4],
        ],
      },
      { args: [[10, -10, 0]], expected: [[], [10], [-10], [0], [10, -10], [10, 0], [-10, 0], [10, -10, 0]] },
      { args: [[-1, -2]], expected: [[], [-1], [-2], [-1, -2]] },
      { args: [[9, 2]], expected: [[], [2], [9], [2, 9]] },
    ],
    reference: (nums: number[]) => {
      const out: number[][] = [];
      for (let mask = 0; mask < 1 << nums.length; mask++) {
        out.push(nums.filter((_, i) => (mask >> i) & 1));
      }
      return out;
    },
  },

  // ------------------------------------------------------------ permutations
  {
    slug: 'permutations',
    title: 'Permutations',
    difficulty: 'MEDIUM',
    tags: ['array', 'backtracking'],
    description:
      'Given an array `nums` of **distinct** integers, return every possible ordering of its elements.\n\n' +
      'The list of orderings may be returned in any order, but each inner list is an ordering, so the position of every number inside it matters. Each ordering must appear exactly once.',
    constraints: ['1 ≤ nums.length ≤ 7', '-10 ≤ nums[i] ≤ 10', 'All values in `nums` are distinct'],
    signature: {
      functionName: 'permute',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int[][]',
      compare: 'unordered',
      javaReturns: 'List<List<Integer>>',
    },
    optimal: { time: 'O(n · n!)', space: 'O(n)' },
    examples: [
      {
        args: [[1, 2, 3]],
        expected: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]],
        explanation: 'Three distinct values can be arranged in 3! = 6 ways.',
      },
      { args: [[0, 1]], expected: [[0, 1], [1, 0]] },
      { args: [[1]], expected: [[1]] },
    ],
    tests: [
      { args: [[5]], expected: [[5]] },
      { args: [[-1, 1]], expected: [[-1, 1], [1, -1]] },
      { args: [[3, 2, 1]], expected: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] },
      {
        args: [[1, 2, 3, 4]],
        expected: [
          [1, 2, 3, 4], [1, 2, 4, 3], [1, 3, 2, 4], [1, 3, 4, 2], [1, 4, 2, 3], [1, 4, 3, 2],
          [2, 1, 3, 4], [2, 1, 4, 3], [2, 3, 1, 4], [2, 3, 4, 1], [2, 4, 1, 3], [2, 4, 3, 1],
          [3, 1, 2, 4], [3, 1, 4, 2], [3, 2, 1, 4], [3, 2, 4, 1], [3, 4, 1, 2], [3, 4, 2, 1],
          [4, 1, 2, 3], [4, 1, 3, 2], [4, 2, 1, 3], [4, 2, 3, 1], [4, 3, 1, 2], [4, 3, 2, 1],
        ],
      },
      { args: [[0, -5]], expected: [[0, -5], [-5, 0]] },
      { args: [[10, 9, 8]], expected: [[8, 9, 10], [8, 10, 9], [9, 8, 10], [9, 10, 8], [10, 8, 9], [10, 9, 8]] },
    ],
    reference: (nums: number[]) => {
      const out: number[][] = [];
      const cur: number[] = [];
      const used = new Array<boolean>(nums.length).fill(false);
      const go = () => {
        if (cur.length === nums.length) {
          out.push([...cur]);
          return;
        }
        for (let i = 0; i < nums.length; i++) {
          if (used[i]) continue;
          used[i] = true;
          cur.push(nums[i]);
          go();
          cur.pop();
          used[i] = false;
        }
      };
      go();
      return out;
    },
  },

  // ------------------------------------------------------------ merge-intervals
  {
    slug: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'MEDIUM',
    tags: ['array', 'sorting', 'intervals'],
    description:
      'Each element of `intervals` is a closed range `[start, end]` with `start ≤ end`; the ranges arrive in no particular order.\n\n' +
      'Combine every group of ranges that overlap into a single range, where two ranges overlap if they share at least one point (so `[1,4]` and `[4,5]` merge into `[1,5]`). ' +
      'Return the resulting non-overlapping ranges **sorted by start**.',
    constraints: ['1 ≤ intervals.length ≤ 10⁵', '0 ≤ start ≤ end ≤ 10⁶'],
    signature: {
      functionName: 'merge',
      params: [{ name: 'intervals', type: 'int[][]' }],
      returns: 'int[][]',
    },
    optimal: { time: 'O(n log n)', space: 'O(n)' },
    examples: [
      {
        args: [[[1, 4], [2, 6], [9, 12], [15, 18]]],
        expected: [[1, 6], [9, 12], [15, 18]],
        explanation: '[1,4] and [2,6] overlap on [2,4], so they become [1,6]; the others stay separate.',
      },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[5, 7], [1, 2]]], expected: [[1, 2], [5, 7]] },
    ],
    tests: [
      { args: [[[3, 3]]], expected: [[3, 3]] },
      { args: [[[1, 10], [2, 3], [4, 5]]], expected: [[1, 10]] },
      { args: [[[6, 8], [1, 9], [2, 4], [4, 7]]], expected: [[1, 9]] },
      { args: [[[1, 2], [3, 4], [5, 6]]], expected: [[1, 2], [3, 4], [5, 6]] },
      { args: [[[0, 0], [0, 0]]], expected: [[0, 0]] },
      { args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], expected: [[1, 10]] },
      { args: [[[1, 4], [0, 0]]], expected: [[0, 0], [1, 4]] },
    ],
    stress: [
      {
        label: '50k short random intervals',
        generate: rng => {
          const intervals: number[][] = [];
          for (let i = 0; i < 50_000; i++) {
            const s = rng.int(0, 999_970);
            intervals.push([s, s + rng.int(0, 30)]);
          }
          return [intervals];
        },
      },
    ],
    reference: (intervals: number[][]) => {
      const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
      const out: number[][] = [];
      for (const [s, e] of sorted) {
        const last = out[out.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else out.push([s, e]);
      }
      return out;
    },
  },

  // ------------------------------------------------------------ insert-interval
  {
    slug: 'insert-interval',
    title: 'Insert Interval',
    difficulty: 'MEDIUM',
    tags: ['array', 'intervals'],
    description:
      '`intervals` is a list of closed ranges `[start, end]`, already sorted by `start`, with no two ranges sharing a point. You are also given one more range, `newInterval`.\n\n' +
      'Add `newInterval` to the list, merging it with every range it touches or overlaps (ranges that share an endpoint count as overlapping). ' +
      'Return the updated list, still sorted by start and free of overlaps.',
    constraints: ['0 ≤ intervals.length ≤ 10⁵', '0 ≤ start ≤ end ≤ 10⁶', '`intervals` is sorted by start and non-overlapping', 'newInterval.length = 2'],
    signature: {
      functionName: 'insert',
      params: [
        { name: 'intervals', type: 'int[][]' },
        { name: 'newInterval', type: 'int[]' },
      ],
      returns: 'int[][]',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      {
        args: [[[1, 3], [6, 9]], [2, 5]],
        expected: [[1, 5], [6, 9]],
        explanation: '[2,5] overlaps [1,3], producing [1,5]; [6,9] is untouched.',
      },
      { args: [[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], expected: [[1, 2], [3, 10], [12, 16]] },
      { args: [[], [5, 7]], expected: [[5, 7]] },
    ],
    tests: [
      { args: [[[1, 5]], [2, 3]], expected: [[1, 5]] },
      { args: [[[1, 5]], [6, 8]], expected: [[1, 5], [6, 8]] },
      { args: [[[3, 5]], [0, 1]], expected: [[0, 1], [3, 5]] },
      { args: [[[1, 2], [5, 6]], [3, 4]], expected: [[1, 2], [3, 4], [5, 6]] },
      { args: [[[1, 2], [5, 6]], [2, 5]], expected: [[1, 6]] },
      { args: [[[1, 5]], [0, 10]], expected: [[0, 10]] },
      { args: [[[1, 5], [7, 9]], [5, 7]], expected: [[1, 9]] },
    ],
    stress: [
      {
        label: '50k intervals, new one spans the middle',
        generate: rng => {
          const intervals: number[][] = [];
          let cur = 0;
          for (let i = 0; i < 50_000; i++) {
            const s = cur + rng.int(1, 9);
            const e = s + rng.int(0, 9);
            intervals.push([s, e]);
            cur = e;
          }
          return [intervals, [intervals[10_000][0] + 1, intervals[40_000][1]]];
        },
      },
    ],
    reference: (intervals: number[][], newInterval: number[]) => {
      const out: number[][] = [];
      let [s, e] = newInterval;
      let i = 0;
      while (i < intervals.length && intervals[i][1] < s) out.push(intervals[i++]);
      while (i < intervals.length && intervals[i][0] <= e) {
        s = Math.min(s, intervals[i][0]);
        e = Math.max(e, intervals[i][1]);
        i++;
      }
      out.push([s, e]);
      while (i < intervals.length) out.push(intervals[i++]);
      return out;
    },
  },

  // ------------------------------------------------------------ three-sum
  {
    slug: 'three-sum',
    title: '3Sum',
    difficulty: 'MEDIUM',
    tags: ['array', 'two-pointers', 'sorting'],
    description:
      'Find every distinct triple of values `[a, b, c]` taken from three **different positions** of `nums` such that `a + b + c = 0`.\n\n' +
      'Two triples count as the same if they contain the same multiset of values, and each such triple must be reported only once. ' +
      'The triples may be returned in any order, and the values inside each triple may be in any order. Return an empty list if none exist.',
    constraints: ['3 ≤ nums.length ≤ 3000', '-10⁵ ≤ nums[i] ≤ 10⁵'],
    signature: {
      functionName: 'threeSum',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int[][]',
      compare: 'unordered-nested',
      javaReturns: 'List<List<Integer>>',
    },
    optimal: { time: 'O(n²)', space: 'O(1) extra (besides sorting and output)' },
    examples: [
      {
        args: [[-1, 0, 1, 2, -1, -4]],
        expected: [[-1, -1, 2], [-1, 0, 1]],
        explanation: 'Two -1s plus 2 make zero, and -1 + 0 + 1 makes zero; the second -1 would only repeat [-1,0,1].',
      },
      { args: [[0, 1, 1]], expected: [] },
      { args: [[0, 0, 0]], expected: [[0, 0, 0]] },
    ],
    tests: [
      { args: [[0, 0, 0, 0]], expected: [[0, 0, 0]] },
      { args: [[1, 2, -2, -1]], expected: [] },
      { args: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]] },
      { args: [[3, -3, 0]], expected: [[-3, 0, 3]] },
      { args: [[-1, 0, 1, 0]], expected: [[-1, 0, 1]] },
      { args: [[-5, 1, 4, -3, 2, 3]], expected: [[-5, 1, 4], [-5, 2, 3], [-3, 1, 2]] },
      { args: [[100000, -100000, 0, 100000]], expected: [[-100000, 0, 100000]] },
    ],
    stress: [
      { label: '3000 random values in ±10⁵', generate: rng => [randomInts(rng, 3000, -100_000, 100_000)] },
      { label: '3000 values with heavy duplication', generate: rng => [randomInts(rng, 3000, -60, 60)] },
    ],
    reference: (input: number[]) => {
      const nums = [...input].sort((a, b) => a - b);
      const out: number[][] = [];
      for (let i = 0; i < nums.length - 2; i++) {
        if (nums[i] > 0) break;
        if (i > 0 && nums[i] === nums[i - 1]) continue;
        let lo = i + 1;
        let hi = nums.length - 1;
        while (lo < hi) {
          const sum = nums[i] + nums[lo] + nums[hi];
          if (sum < 0) lo++;
          else if (sum > 0) hi--;
          else {
            out.push([nums[i], nums[lo], nums[hi]]);
            lo++;
            hi--;
            while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
            while (lo < hi && nums[hi] === nums[hi + 1]) hi--;
          }
        }
      }
      return out;
    },
  },

  // ------------------------------------------------------------ container-with-most-water
  {
    slug: 'container-with-most-water',
    title: 'Container With Most Water',
    difficulty: 'MEDIUM',
    tags: ['array', 'two-pointers', 'greedy'],
    description:
      '`height[i]` is the height of a vertical wall standing at position `i` on a flat floor. Choose any two walls; together with the floor they form a tank.\n\n' +
      'The tank holds `min(height[i], height[j]) × (j - i)` units of water. Return the largest amount any pair of walls can hold.',
    constraints: ['2 ≤ height.length ≤ 10⁵', '0 ≤ height[i] ≤ 10⁴'],
    signature: {
      functionName: 'maxArea',
      params: [{ name: 'height', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      {
        args: [[2, 7, 3, 5, 9, 1, 6]],
        expected: 30,
        explanation: 'Walls at positions 1 (height 7) and 6 (height 6): min 6 × width 5 = 30.',
      },
      { args: [[1, 1]], expected: 1 },
      { args: [[4, 3, 2, 1, 4]], expected: 16 },
    ],
    tests: [
      { args: [[1, 2, 1]], expected: 2 },
      { args: [[0, 0]], expected: 0 },
      { args: [[5, 5, 5, 5]], expected: 15 },
      { args: [[1, 2, 3, 4, 5]], expected: 6 },
      { args: [[10, 1, 1, 1, 10]], expected: 40 },
      { args: [[0, 10000, 0, 10000]], expected: 20000 },
    ],
    stress: [
      { label: '100k random heights', generate: rng => [randomInts(rng, 100_000, 0, 10_000)] },
      {
        label: '100k heights rising to a peak and falling',
        generate: rng => {
          const n = 100_000;
          return [Array.from({ length: n }, (_, i) => Math.min(10_000, Math.floor(Math.min(i, n - 1 - i) / 5) + rng.int(0, 3)))];
        },
      },
    ],
    reference: (height: number[]) => {
      let lo = 0;
      let hi = height.length - 1;
      let best = 0;
      while (lo < hi) {
        best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
        if (height[lo] < height[hi]) lo++;
        else hi--;
      }
      return best;
    },
  },

  // ------------------------------------------------------------ house-robber
  {
    slug: 'house-robber',
    title: 'House Robber',
    difficulty: 'MEDIUM',
    tags: ['array', 'dynamic-programming'],
    description:
      'A row of houses holds `nums[i]` coins in house `i`. You may collect the coins from any set of houses, as long as you never take from two houses that are next to each other.\n\n' +
      'Return the largest total number of coins you can collect.',
    constraints: ['1 ≤ nums.length ≤ 10⁵', '0 ≤ nums[i] ≤ 400'],
    signature: {
      functionName: 'rob',
      params: [{ name: 'nums', type: 'int[]' }],
      returns: 'int',
    },
    optimal: { time: 'O(n)', space: 'O(1)' },
    examples: [
      { args: [[3, 10, 4, 2, 8]], expected: 18, explanation: 'Take houses 1 and 4: 10 + 8 = 18.' },
      { args: [[1, 2, 3, 1]], expected: 4 },
      { args: [[5]], expected: 5 },
    ],
    tests: [
      { args: [[0]], expected: 0 },
      { args: [[2, 1]], expected: 2 },
      { args: [[1, 3, 1]], expected: 3 },
      { args: [[2, 1, 1, 2]], expected: 4 },
      { args: [[0, 0, 0]], expected: 0 },
      { args: [[400, 0, 0, 400]], expected: 800 },
      { args: [[6, 7, 1, 30, 8, 2, 4]], expected: 41 },
    ],
    stress: [{ label: '100k random houses', generate: rng => [randomInts(rng, 100_000, 0, 400)] }],
    reference: (nums: number[]) => {
      let take = 0;
      let skip = 0;
      for (const v of nums) {
        const t = skip + v;
        skip = Math.max(skip, take);
        take = t;
      }
      return Math.max(take, skip);
    },
  },

  // ------------------------------------------------------------ binary-tree-level-order-traversal
  {
    slug: 'binary-tree-level-order-traversal',
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'MEDIUM',
    tags: ['tree', 'binary-tree', 'breadth-first-search'],
    description:
      'Given the `root` of a binary tree, group its node values by depth.\n\n' +
      'Return a list whose `k`-th entry holds the values of all nodes at depth `k` (the root is depth 0), each read from left to right. An empty tree yields an empty list.',
    constraints: ['0 ≤ number of nodes ≤ 10⁵', '-1000 ≤ Node.val ≤ 1000'],
    signature: {
      functionName: 'levelOrder',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'int[][]',
      javaReturns: 'List<List<Integer>>',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      {
        args: [[1, 2, 3, 4, null, null, 5]],
        expected: [[1], [2, 3], [4, 5]],
        explanation: '4 is the left child of 2 and 5 is the right child of 3, so both sit on depth 2.',
      },
      { args: [[]], expected: [] },
      { args: [[8]], expected: [[8]] },
    ],
    tests: [
      { args: [[1, 2, null, 3, null, 4]], expected: [[1], [2], [3], [4]] },
      { args: [[1, 2, 3, 4, 5, 6, 7]], expected: [[1], [2, 3], [4, 5, 6, 7]] },
      { args: [[0, -1, 1]], expected: [[0], [-1, 1]] },
      { args: [[5, null, 6, null, 7]], expected: [[5], [6], [7]] },
      { args: [[1, 2, 3, null, 4, 5]], expected: [[1], [2, 3], [4, 5]] },
      { args: [[-1000, 1000]], expected: [[-1000], [1000]] },
    ],
    stress: [
      { label: '100k-node random tree', generate: rng => [randomTreeArray(rng, 100_000, -1000, 1000)] },
      { label: '65k-node complete tree', generate: rng => [randomInts(rng, 65_535, -1000, 1000)] },
    ],
    reference: (rootValues: (number | null)[]) => {
      const root = toTree(rootValues);
      const out: number[][] = [];
      let level: TreeNode[] = root ? [root] : [];
      while (level.length) {
        out.push(level.map(n => n.val));
        const next: TreeNode[] = [];
        for (const n of level) {
          if (n.left) next.push(n.left);
          if (n.right) next.push(n.right);
        }
        level = next;
      }
      return out;
    },
  },

  // ------------------------------------------------------------ validate-binary-search-tree
  {
    slug: 'validate-binary-search-tree',
    title: 'Validate Binary Search Tree',
    difficulty: 'MEDIUM',
    tags: ['tree', 'binary-tree', 'binary-search-tree', 'depth-first-search'],
    description:
      'Decide whether the binary tree rooted at `root` is a valid binary search tree.\n\n' +
      'A tree qualifies when, for **every** node, all values in its left subtree are strictly smaller than the node\'s value and all values in its right subtree are strictly larger. ' +
      'Equal values anywhere make the tree invalid. Return `true` or `false`.',
    constraints: ['1 ≤ number of nodes ≤ 10⁵', '-2³¹ ≤ Node.val ≤ 2³¹ - 1'],
    signature: {
      functionName: 'isValidBST',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'bool',
    },
    optimal: { time: 'O(n)', space: 'O(h)' },
    examples: [
      { args: [[2, 1, 3]], expected: true, explanation: '1 < 2 < 3, and the leaves have no children.' },
      { args: [[10, 5, 15, null, null, 6, 20]], expected: false },
      { args: [[7]], expected: true },
    ],
    tests: [
      { args: [[2, 2, 3]], expected: false },
      { args: [[2, 1, 2]], expected: false },
      { args: [[5, 3, 8, 1, 4, 7, 9]], expected: true },
      { args: [[5, 3, 8, 1, 6, 7, 9]], expected: false },
      { args: [[2147483647]], expected: true },
      { args: [[-2147483648, null, 2147483647]], expected: true },
      { args: [[1, null, 1]], expected: false },
      { args: [[3, 1, 5, 0, 2, 4, 6, null, null, null, 3]], expected: false },
    ],
    stress: [
      { label: '100k-node valid BST', generate: rng => [completeBstArray(rng, 100_000)] },
      {
        label: '100k-node BST broken only against a distant ancestor',
        generate: rng => {
          const vals = completeBstArray(rng, 100_000);
          // rightmost node of the root's left subtree: larger than its parent, but set equal to the root
          let i = 1;
          while (2 * i + 2 < vals.length) i = 2 * i + 2;
          vals[i] = vals[0];
          return [vals];
        },
      },
    ],
    reference: (rootValues: (number | null)[]) => {
      const stack: TreeNode[] = [];
      let node = toTree(rootValues);
      let prev = -Infinity;
      while (stack.length || node) {
        while (node) {
          stack.push(node);
          node = node.left;
        }
        node = stack.pop()!;
        if (node.val <= prev) return false;
        prev = node.val;
        node = node.right;
      }
      return true;
    },
  },

  // ------------------------------------------------------------ daily-temperatures
  {
    slug: 'daily-temperatures',
    title: 'Daily Temperatures',
    difficulty: 'MEDIUM',
    tags: ['array', 'stack', 'monotonic-stack'],
    description:
      '`temperatures[i]` is the reading taken on day `i`. For each day, work out how many days you have to wait until a **strictly** warmer reading appears.\n\n' +
      'Return an array `answer` of the same length where `answer[i]` is that wait, or `0` if no later day is warmer.',
    constraints: ['1 ≤ temperatures.length ≤ 10⁵', '30 ≤ temperatures[i] ≤ 100'],
    signature: {
      functionName: 'dailyTemperatures',
      params: [{ name: 'temperatures', type: 'int[]' }],
      returns: 'int[]',
    },
    optimal: { time: 'O(n)', space: 'O(n)' },
    examples: [
      {
        args: [[60, 62, 58, 59, 65, 61]],
        expected: [1, 3, 1, 1, 0, 0],
        explanation: 'After day 1 (62) the first warmer day is day 4 (65), three days later.',
      },
      { args: [[30, 40, 50, 60]], expected: [1, 1, 1, 0] },
      { args: [[90, 80, 70]], expected: [0, 0, 0] },
    ],
    tests: [
      { args: [[50]], expected: [0] },
      { args: [[50, 50, 50]], expected: [0, 0, 0] },
      { args: [[30, 100]], expected: [1, 0] },
      { args: [[70, 60, 80, 60, 90]], expected: [2, 1, 2, 1, 0] },
      { args: [[55, 54, 53, 56]], expected: [3, 2, 1, 0] },
      { args: [[40, 35, 45, 35, 40, 50]], expected: [2, 1, 3, 1, 1, 0] },
    ],
    stress: [
      { label: '100k random readings', generate: rng => [randomInts(rng, 100_000, 30, 100)] },
      {
        label: '100k non-increasing readings, then a hot day',
        generate: rng => {
          const temps = randomInts(rng, 99_999, 30, 99).sort((a, b) => b - a);
          temps.push(100);
          return [temps];
        },
      },
    ],
    reference: (temperatures: number[]) => {
      const answer = new Array<number>(temperatures.length).fill(0);
      const stack: number[] = [];
      for (let i = 0; i < temperatures.length; i++) {
        while (stack.length && temperatures[stack[stack.length - 1]] < temperatures[i]) {
          const j = stack.pop()!;
          answer[j] = i - j;
        }
        stack.push(i);
      }
      return answer;
    },
  },

  // ------------------------------------------------------------ word-break
  {
    slug: 'word-break',
    title: 'Word Break',
    difficulty: 'MEDIUM',
    tags: ['string', 'dynamic-programming', 'hash-set'],
    description:
      'You are given a string `s` and a list of dictionary words `wordDict`. Decide whether `s` can be cut into one or more pieces so that every piece is a word from `wordDict`.\n\n' +
      'A dictionary word may be used any number of times, and not every word has to be used. Return `true` if such a cut exists, otherwise `false`.',
    constraints: [
      '1 ≤ s.length ≤ 2000',
      '1 ≤ wordDict.length ≤ 1000',
      '1 ≤ wordDict[i].length ≤ 20',
      '`s` and every word contain only lowercase English letters',
      'Words in `wordDict` are distinct',
    ],
    signature: {
      functionName: 'wordBreak',
      params: [
        { name: 's', type: 'string' },
        { name: 'wordDict', type: 'string[]' },
      ],
      returns: 'bool',
    },
    optimal: { time: 'O(n · L)', space: 'O(n)' },
    examples: [
      { args: ['redredblue', ['red', 'blue']], expected: true, explanation: '"redredblue" = "red" + "red" + "blue"; words may repeat.' },
      { args: ['penapple', ['pen', 'apple']], expected: true },
      { args: ['sunflowers', ['sun', 'flower', 'flow']], expected: false },
    ],
    tests: [
      { args: ['a', ['b']], expected: false },
      { args: ['abab', ['ab', 'ba']], expected: true },
      { args: ['bandanas', ['band', 'an', 'as', 'ban', 'dana']], expected: true },
      { args: ['aaaaaaa', ['aaaa', 'aaa']], expected: true },
      { args: ['aaaaaaab', ['a', 'aa']], expected: false },
      { args: ['xyz', ['xyz', 'x']], expected: true },
      { args: ['goalgo', ['go', 'al', 'goal']], expected: true },
      { args: ['abc', ['ab', 'bc']], expected: false },
    ],
    stress: [
      {
        label: '"aaa…ab" against a dictionary of a-runs',
        generate: () => ['a'.repeat(1999) + 'b', Array.from({ length: 20 }, (_, i) => 'a'.repeat(i + 1))],
      },
      {
        label: '2000 chars built from 300 random a/b words',
        generate: rng => {
          const dict = new Set<string>();
          while (dict.size < 300) {
            let w = '';
            const len = rng.int(1, 12);
            for (let i = 0; i < len; i++) w += rng.pick(['a', 'b']);
            dict.add(w);
          }
          const words = [...dict];
          let s = '';
          while (s.length < 1990) s += rng.pick(words);
          return [s.slice(0, 2000), words];
        },
      },
    ],
    reference: (s: string, wordDict: string[]) => {
      const dict = new Set(wordDict);
      const maxLen = Math.max(...wordDict.map(w => w.length));
      const ok = new Array<boolean>(s.length + 1).fill(false);
      ok[0] = true;
      for (let end = 1; end <= s.length; end++) {
        for (let start = Math.max(0, end - maxLen); start < end; start++) {
          if (ok[start] && dict.has(s.slice(start, end))) {
            ok[end] = true;
            break;
          }
        }
      }
      return ok[s.length];
    },
  },

  // ------------------------------------------------------------ generate-parentheses
  {
    slug: 'generate-parentheses',
    title: 'Generate Parentheses',
    difficulty: 'MEDIUM',
    tags: ['string', 'backtracking', 'recursion'],
    description:
      'Given `n`, list every string made of exactly `n` opening brackets `(` and `n` closing brackets `)` that is **balanced**: reading left to right, the number of `)` seen never exceeds the number of `(` seen.\n\n' +
      'Each string must appear exactly once; the list may be in any order.',
    constraints: ['1 ≤ n ≤ 8'],
    signature: {
      functionName: 'generateParenthesis',
      params: [{ name: 'n', type: 'int' }],
      returns: 'string[]',
      compare: 'unordered',
      javaReturns: 'List<String>',
    },
    optimal: { time: 'O(4ⁿ / √n)', space: 'O(n)' },
    examples: [
      {
        args: [3],
        expected: ['((()))', '(()())', '(())()', '()(())', '()()()'],
        explanation: 'There are 5 balanced arrangements of three bracket pairs.',
      },
      { args: [1], expected: ['()'] },
      { args: [2], expected: ['(())', '()()'] },
    ],
    tests: [
      {
        args: [4],
        expected: [
          '(((())))', '((()()))', '((())())', '((()))()', '(()(()))', '(()()())', '(()())()',
          '(())(())', '(())()()', '()((()))', '()(()())', '()(())()', '()()(())', '()()()()',
        ],
      },
      { args: [1], expected: ['()'] },
      { args: [5], expected: allBalanced(5) },
      { args: [6], expected: allBalanced(6) },
      { args: [7], expected: allBalanced(7) },
      { args: [8], expected: allBalanced(8) },
    ],
    reference: (n: number) => {
      const out: string[] = [];
      const go = (cur: string, open: number, close: number) => {
        if (cur.length === 2 * n) {
          out.push(cur);
          return;
        }
        if (open < n) go(cur + '(', open + 1, close);
        if (close < open) go(cur + ')', open, close + 1);
      };
      go('', 0, 0);
      return out;
    },
  },
];
