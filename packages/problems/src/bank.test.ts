import { LANGUAGES, starterCode, valuesMatch, type ValueType } from '@codebattle/shared';
import { describe, expect, it } from 'vitest';
import { materialize, questionBank } from './index';

const VALUE_TYPES: ValueType[] = [
  'int', 'long', 'double', 'bool', 'string', 'int[]', 'double[]', 'bool[]', 'string[]',
  'int[][]', 'string[][]', 'char[][]', 'ListNode', 'TreeNode',
];
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('question bank', () => {
  it('has at least 50 questions with unique slugs and titles', () => {
    expect(questionBank.length).toBeGreaterThanOrEqual(50);
    expect(new Set(questionBank.map(q => q.slug)).size).toBe(questionBank.length);
    expect(new Set(questionBank.map(q => q.title)).size).toBe(questionBank.length);
  });

  it('covers every difficulty', () => {
    for (const d of ['EASY', 'MEDIUM', 'HARD'] as const) {
      expect(questionBank.filter(q => q.difficulty === d).length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe.each(questionBank.map(q => [q.slug, q] as const))('%s', (_slug, q) => {
  it('is well formed', () => {
    expect(q.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(q.title.length).toBeGreaterThan(2);
    expect(q.description.length).toBeGreaterThan(40);
    expect(q.constraints.length).toBeGreaterThan(0);
    expect(q.tags.length).toBeGreaterThan(0);
    expect(q.signature.functionName).toMatch(/^[a-z][a-zA-Z0-9]*$/);
    expect(VALUE_TYPES).toContain(q.signature.returns);
    for (const p of q.signature.params) {
      expect(p.name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(VALUE_TYPES).toContain(p.type);
    }
    expect(q.examples.length).toBeGreaterThanOrEqual(3);
    expect(q.tests.length).toBeGreaterThanOrEqual(5);
    for (const t of [...q.examples, ...q.tests]) expect(t.args.length).toBe(q.signature.params.length);
    for (const lang of LANGUAGES) expect(starterCode(q.signature, lang).length).toBeGreaterThan(10);
  });

  it('reference solution agrees with every expected value', () => {
    for (const t of [...q.examples, ...q.tests]) {
      const actual = q.reference(...clone(t.args));
      expect(
        valuesMatch(t.expected, JSON.parse(JSON.stringify(actual ?? null)), q.signature.compare),
        `${JSON.stringify(t.args).slice(0, 200)} -> expected ${JSON.stringify(t.expected)}, reference gave ${JSON.stringify(actual)}`
      ).toBe(true);
    }
  });

  it('stress tests are deterministic and fast for the reference', () => {
    const started = Date.now();
    const a = materialize(q);
    const b = materialize(q);
    expect(JSON.stringify(a.tests)).toBe(JSON.stringify(b.tests));
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(a.tests.filter(t => !t.hidden).length).toBe(q.examples.length);
  });
});
