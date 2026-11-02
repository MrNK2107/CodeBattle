import { describe, expect, it } from 'vitest';
import {
  computeCorrectness,
  computeMatchScores,
  computeRelativeEfficiency,
  computeSpeed,
  computeTyping,
  type PlayerPerformance,
} from '../services/scoring';
import { analyzeQuality } from '../services/quality';

const steadyTyping = { wpm: 60, variation: 0, backspaceRate: 0, pastedRatio: 0 };

function player(userId: string, sub?: Partial<NonNullable<PlayerPerformance['submission']>>, typing = steadyTyping): PlayerPerformance {
  return {
    userId,
    submission: sub && { passed: 10, total: 10, secondsFromStart: 300, runtimeMs: 10, language: 'javascript', quality: 100, ...sub },
    typing,
  };
}

describe('scoring components', () => {
  it('correctness is the hidden-test pass percentage', () => {
    expect(computeCorrectness(5, 5)).toBe(100);
    expect(computeCorrectness(2, 5)).toBe(40);
    expect(computeCorrectness(0, 0)).toBe(0);
  });

  it('speed is linear over the match duration', () => {
    expect(computeSpeed(0, 600)).toBe(100);
    expect(computeSpeed(300, 600)).toBe(50);
    expect(computeSpeed(900, 600)).toBe(0);
    expect(computeSpeed(10, 0)).toBe(0);
  });

  it('efficiency is relative to the fastest correct solution', () => {
    expect(computeRelativeEfficiency(10, 10)).toBe(100);
    expect(computeRelativeEfficiency(12, 10)).toBe(100);
    expect(computeRelativeEfficiency(20, 10)).toBe(75);
    expect(computeRelativeEfficiency(40, 10)).toBe(50);
    expect(computeRelativeEfficiency(1e9, 1)).toBe(10);
  });

  it('typing rewards pace, steadiness and accuracy, minus pasted code', () => {
    expect(computeTyping(steadyTyping)).toBe(100);
    expect(computeTyping({ ...steadyTyping, wpm: 0 })).toBe(0);
    expect(computeTyping({ ...steadyTyping, wpm: 30 })).toBe(75);
    expect(computeTyping({ ...steadyTyping, pastedRatio: 0.5 })).toBe(50);
    expect(computeTyping({ ...steadyTyping, pastedRatio: 1 })).toBe(0);
  });
});

describe('computeMatchScores', () => {
  it('scores a missing submission as zero', () => {
    const [a] = computeMatchScores([player('a')], 900);
    expect(a.total).toBe(0);
  });

  it('a fast wrong answer never beats a slow correct one', () => {
    const [fast, slow] = computeMatchScores(
      [player('fast', { passed: 0, secondsFromStart: 10 }), player('slow', { secondsFromStart: 880 })],
      900
    );
    expect(slow.total).toBeGreaterThan(fast.total);
    expect(fast.total).toBe(0);
  });

  it('typing and quality cannot rescue an incorrect solution', () => {
    const [noSolve, partial] = computeMatchScores(
      [player('a', { passed: 0 }), player('b', { passed: 1, quality: 0 }, { ...steadyTyping, wpm: 0 })],
      900
    );
    expect(noSolve.total).toBe(0);
    expect(partial.total).toBeGreaterThan(0);
  });

  it('the faster correct solution wins efficiency, language-normalized', () => {
    const [js, py] = computeMatchScores([player('js', { runtimeMs: 10 }), player('py', { runtimeMs: 40, language: 'python' })], 900);
    expect(js.breakdown.efficiency).toBe(100);
    expect(py.breakdown.efficiency).toBe(100);

    const [quick, slow] = computeMatchScores([player('q', { runtimeMs: 10 }), player('s', { runtimeMs: 80 })], 900);
    expect(quick.breakdown.efficiency).toBe(100);
    expect(slow.breakdown.efficiency).toBe(25);
  });

  it('partially correct solutions get half efficiency scaled by correctness', () => {
    const [p] = computeMatchScores([player('p', { passed: 5 })], 900);
    expect(p.breakdown.efficiency).toBe(25);
    expect(p.breakdown.correctness).toBe(50);
  });

  it('a perfect instant solve scores 100', () => {
    const [p] = computeMatchScores([player('p', { secondsFromStart: 0 })], 900);
    expect(p.total).toBe(100);
  });
});

describe('analyzeQuality', () => {
  it('gives clean code full marks', () => {
    const code = [
      'function twoSum(nums, target) {',
      '  const seen = new Map();',
      '  for (let i = 0; i < nums.length; i++) {',
      '    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];',
      '    seen.set(nums[i], i);',
      '  }',
      '  return [];',
      '}',
    ].join('\n');
    expect(analyzeQuality('javascript', code)).toEqual({ score: 100, issues: [] });
  });

  it('penalizes debug prints, deep nesting and swallowed errors', () => {
    const code = [
      'function f(a) {',
      '  console.log(a);',
      '  try { g(); } catch (e) {}',
      '  if (a) { if (a) { if (a) { if (a) { if (a) { return 1; } } } } }',
      '}',
    ].join('\n');
    const report = analyzeQuality('javascript', code);
    const text = report.issues.map(i => i.message).join(' ');
    expect(report.score).toBeLessThan(100);
    expect(text).toMatch(/debug print/);
    expect(text).toMatch(/Nesting depth 5/);
    expect(text).toMatch(/ignored/);
  });

  it('understands python indentation and Solution classes', () => {
    const flat = 'class Solution:\n    def f(self, x):\n        for i in x:\n            if i:\n                return i\n';
    expect(analyzeQuality('python', flat).score).toBe(100);
    const deep =
      'def f(x):\n    for a in x:\n        for b in x:\n            for c in x:\n                for d in x:\n                    if d:\n                        print(d)\n';
    const report = analyzeQuality('python', deep);
    expect(report.issues.some(i => /Nesting depth 5/.test(i.message))).toBe(true);
    expect(report.issues.some(i => /debug print/.test(i.message))).toBe(true);
  });

  it('ignores braces inside strings and comments (java)', () => {
    const code = 'class Solution {\n    public String f() {\n        // {{{{{{\n        return "{{{{{{";\n    }\n}\n';
    expect(analyzeQuality('java', code).score).toBe(100);
  });
});
