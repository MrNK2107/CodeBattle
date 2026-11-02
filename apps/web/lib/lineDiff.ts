// Line-level change marks for the replay: which lines of the current snapshot are
// new or edited since the previous one. LCS over lines, which is plenty for
// solutions of a few hundred lines (snapshots are capped at 64 kB).

export type LineMark = 'same' | 'added';

const MAX_CELLS = 400_000;

/** For each line of `next`, whether it also appears (in order) in `prev`. */
export function markChangedLines(prev: string, next: string): LineMark[] {
  const a = prev ? prev.split('\n') : [];
  const b = next.split('\n');
  if (!a.length) return b.map(line => (line.trim() ? 'added' : 'same'));
  if (a.length * b.length > MAX_CELLS) {
    // too big for a table: fall back to a set comparison
    const seen = new Set(a);
    return b.map(line => (seen.has(line) || !line.trim() ? 'same' : 'added'));
  }
  const rows = a.length + 1;
  const cols = b.length + 1;
  const lcs = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * cols + j] = a[i] === b[j] ? lcs[(i + 1) * cols + j + 1] + 1 : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + j + 1]);
    }
  }
  const marks: LineMark[] = b.map(() => 'added');
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      marks[j] = 'same';
      i++;
      j++;
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + j + 1]) i++;
    else j++;
  }
  // blank lines aren't worth highlighting
  return marks.map((m, k) => (b[k].trim() ? m : 'same'));
}

/** Summary for the replay header: "+3 lines". */
export function changeCount(marks: LineMark[]): number {
  return marks.filter(m => m === 'added').length;
}
