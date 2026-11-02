import type { Difficulty, ProblemSignature } from '@codebattle/shared';

export interface Example {
  /** positional arguments, JSON values (lists as arrays, trees as level-order arrays with nulls) */
  args: unknown[];
  expected: unknown;
  explanation?: string;
}

export interface HiddenTest {
  args: unknown[];
  expected: unknown;
}

/** Large generated inputs. Expected values come from the reference solution at seed time. */
export interface StressTest {
  /** human label used in test names, e.g. "100k increasing values" */
  label: string;
  generate: (rng: Rng) => unknown[];
}

export interface QuestionDef {
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  /** Markdown. Original wording; do not paste statements from other sites. */
  description: string;
  constraints: string[];
  signature: ProblemSignature;
  optimal: { time: string; space: string };
  /** visible tests, shown to the player as examples (at least 3) */
  examples: Example[];
  /** hidden tests: edge cases (at least 5) */
  tests: HiddenTest[];
  stress?: StressTest[];
  /**
   * Reference solution over plain JSON values (same shapes as `args`); its
   * return value is compared to every expected value with the signature's mode.
   */
  reference: (...args: any[]) => unknown;
}

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: items => items[int(0, items.length - 1)],
    shuffle: items => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(0, i);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
}

export function seedFor(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
