// Ghost races: practice a problem against the recorded timeline of a past battle.
//
// A ghost is one player's side of a finished battle on the same problem: the code
// snapshots the battle recorded (about every 10 s while they typed) and when their
// final submission landed. The practice clock starts when you press Start, and the
// ghost "plays" its recording against that clock.

export interface GhostFrame {
  /** ms since the battle started */
  t: number;
  language: string;
  submitted?: boolean;
  /** non-blank lines in the snapshot */
  lines: number;
  /** trimmed length of the snapshot, drives the progress bar */
  size: number;
  /**
   * The snapshot itself. Only present when the viewer may read it (they have an
   * accepted practice attempt on the problem); otherwise the server strips it so
   * a live ranked question's solution never reaches the browser.
   */
  code?: string;
}

export interface Ghost {
  /** MatchPlayer id, used in ?ghost= */
  id: string;
  username: string;
  rating: number | null;
  frames: GhostFrame[];
  /** ms after the start when the ghost's final answer was submitted; null if it never submitted */
  submitAtMs: number | null;
  verdict: string | null;
  passed: number;
  total: number;
  language: string | null;
  recordedAt: string;
  /** true when the frames carry code (the viewer has solved this problem) */
  codeUnlocked: boolean;
}

export type GhostPhase = 'waiting' | 'typing' | 'submitted';

export interface GhostState {
  phase: GhostPhase;
  /** latest snapshot at this moment, '' before the first one or when the code is locked */
  code: string;
  lines: number;
  /** 0..1, the ghost's code size now against its final size */
  progress: number;
  /** ms until the ghost submits, null when it never does or already has */
  submitsInMs: number | null;
}

/** Non-blank lines, so whitespace edits don't move the bar. */
export function countLines(code: string): number {
  return code.split('\n').filter(l => l.trim()).length;
}

const finiteCount = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/**
 * Normalizes stored replay JSON into sorted frames, dropping malformed entries.
 * Accepts full snapshots ({ t, code }) and code-free timeline frames ({ t, lines, size }).
 */
export function parseFrames(raw: unknown): GhostFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: GhostFrame[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const r = f as Record<string, unknown>;
    if (typeof r.t !== 'number' || !Number.isFinite(r.t)) continue;
    const base = { t: Math.max(0, r.t), language: typeof r.language === 'string' ? r.language : 'unknown', submitted: r.submitted === true };
    if (typeof r.code === 'string') {
      out.push({ ...base, code: r.code, lines: countLines(r.code), size: r.code.trim().length });
    } else {
      const lines = finiteCount(r.lines);
      const size = finiteCount(r.size);
      if (lines !== null && size !== null) out.push({ ...base, lines, size });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * The frames a viewer is allowed to receive. Without `includeCode` every
 * snapshot is reduced to its timeline (time, line count, size, language), so
 * the payload carries nothing that could be pasted into a battle.
 */
export function ghostFramesForViewer(raw: unknown, includeCode: boolean): GhostFrame[] {
  const frames = parseFrames(raw);
  if (includeCode) return frames;
  return frames.map(({ code: _code, ...timeline }) => timeline);
}

/** Where the ghost is `elapsedMs` into the race. */
export function ghostStateAt(ghost: Pick<Ghost, 'frames' | 'submitAtMs'>, elapsedMs: number): GhostState {
  const frames = ghost.frames;
  let current: GhostFrame | null = null;
  for (const f of frames) {
    if (f.t <= elapsedMs) current = f;
    else break;
  }
  const last = frames.length ? frames[frames.length - 1] : null;
  const finalSize = Math.max(1, last?.size ?? 0);
  const submitted = ghost.submitAtMs !== null && elapsedMs >= ghost.submitAtMs;
  const phase: GhostPhase = submitted ? 'submitted' : current ? 'typing' : 'waiting';
  // A submission that landed before any snapshot shows the final recording.
  const shown = submitted && !current ? last : current;
  return {
    phase,
    code: shown?.code ?? '',
    lines: shown?.lines ?? 0,
    progress: submitted ? 1 : Math.min(1, (current?.size ?? 0) / finalSize),
    submitsInMs: ghost.submitAtMs !== null && !submitted ? ghost.submitAtMs - elapsedMs : null,
  };
}

export type RaceOutcome =
  | { kind: 'pending' }
  | { kind: 'won'; marginMs: number }
  | { kind: 'lost'; marginMs: number }
  | { kind: 'ghost-failed' };

/**
 * Who won the race. You win with an accepted solution before the ghost's accepted
 * one (or at any time if the ghost never solved it). A rejected submission doesn't
 * end your race; the ghost wins once its accepted answer lands first.
 */
export function raceOutcome(
  ghost: Pick<Ghost, 'submitAtMs' | 'verdict'>,
  elapsedMs: number,
  solvedAtMs: number | null,
): RaceOutcome {
  const ghostSolvedAt = ghost.verdict === 'ACCEPTED' ? ghost.submitAtMs : null;
  if (solvedAtMs !== null) {
    if (ghostSolvedAt === null || solvedAtMs < ghostSolvedAt) {
      return ghostSolvedAt === null ? { kind: 'ghost-failed' } : { kind: 'won', marginMs: ghostSolvedAt - solvedAtMs };
    }
    return { kind: 'lost', marginMs: solvedAtMs - ghostSolvedAt };
  }
  if (ghostSolvedAt !== null && elapsedMs >= ghostSolvedAt) return { kind: 'lost', marginMs: elapsedMs - ghostSolvedAt };
  return { kind: 'pending' };
}

/** Picks the ghost to suggest first: fastest accepted, then any accepted, then the rest. */
export function rankGhosts<T extends Pick<Ghost, 'submitAtMs' | 'verdict' | 'frames'>>(ghosts: T[]): T[] {
  const key = (g: T) => [g.verdict === 'ACCEPTED' ? 0 : 1, g.submitAtMs ?? Number.MAX_SAFE_INTEGER] as const;
  return ghosts
    .filter(g => g.frames.length > 0)
    .sort((a, b) => {
      const [a1, a2] = key(a);
      const [b1, b2] = key(b);
      return a1 - b1 || a2 - b2;
    });
}
