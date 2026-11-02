import { describe, expect, it } from 'vitest';

import { changeCount, markChangedLines } from './lineDiff';

describe('markChangedLines', () => {
  it('marks every non-blank line of the first snapshot as added', () => {
    expect(markChangedLines('', 'a\n\nb')).toEqual(['added', 'same', 'added']);
  });

  it('marks inserted and edited lines only', () => {
    const prev = 'def f(x):\n    return x\n';
    const next = 'def f(x):\n    y = x * 2\n    return y\n';
    expect(markChangedLines(prev, next)).toEqual(['same', 'added', 'added', 'same']);
  });

  it('keeps unchanged lines unmarked when lines were deleted', () => {
    expect(markChangedLines('a\nb\nc\nd', 'a\nd')).toEqual(['same', 'same']);
  });

  it('handles reordered lines as changes', () => {
    expect(changeCount(markChangedLines('a\nb', 'b\na'))).toBe(1);
  });

  it('falls back to a set comparison for very large inputs', () => {
    const prev = Array.from({ length: 800 }, (_, i) => `line ${i}`).join('\n');
    const next = `${prev}\nnew line`;
    const marks = markChangedLines(prev, next);
    expect(changeCount(marks)).toBe(1);
    expect(marks[marks.length - 1]).toBe('added');
  });
});
