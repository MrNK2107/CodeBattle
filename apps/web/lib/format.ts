import type { SubmissionStatus } from '@codebattle/shared';

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export const VERDICT_LABEL: Record<SubmissionStatus, string> = {
  PENDING: 'Judging',
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  TIME_LIMIT: 'Time limit exceeded',
  RUNTIME_ERROR: 'Runtime error',
  COMPILE_ERROR: 'Compile error',
};

export const DIFFICULTY_LABEL = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' } as const;

export const DIFFICULTY_TEXT = { EASY: 'text-easy', MEDIUM: 'text-medium', HARD: 'text-hard' } as const;

export function formatMs(ms?: number | null): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)} d ago`;
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric' });
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
