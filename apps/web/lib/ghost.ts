// Ghost races: practice a problem against the recorded timeline of a past battle.
//
// A ghost is one player's side of a finished battle on the same problem: the code
// snapshots the battle recorded (about every 10 s while they typed) and when their
// final submission landed. The practice clock starts when you press Start, and the
// ghost "plays" its recording against that clock.

export interface GhostFrame {
  /** ms since the battle started */
  t: number;
  code: string;
  language: string;
  submitted?: boolean;
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
}

export type GhostPhase = 'waiting' | 'typing' | 'submitted';

export interface GhostState {
  phase: GhostPhase;
  /** latest snapshot at this moment, '' before the first one */
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

/** Normalizes stored replay JSON into sorted frames, dropping malformed entries. */
export function parseFrames(raw: unknown): GhostFrame[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (f): f is GhostFrame =>
        !!f && typeof f === 'object' && typeof (f as GhostFrame).t === 'number' && Number.isFinite((f as GhostFrame).t) && typeof (f as GhostFrame).code === 'string',
    )
    .map(f => ({ t: Math.max(0, f.t), code: f.code, language: typeof f.language === 'string' ? f.language : 'unknown', submitted: f.submitted === true }))
    .sort((a, b) => a.t - b.t);
}

/** Where the ghost is `elapsedMs` into the race. */
export function ghostStateAt(ghost: Pick<Ghost, 'frames' | 'submitAtMs'>, elapsedMs: number): GhostState {
  const frames = ghost.frames;
  let current: GhostFrame | null = null;
  for (const f of frames) {
    if (f.t <= elapsedMs) current = f;
    else break;
  }
  const finalCode = frames.length ? frames[frames.length - 1].code : '';
  const finalSize = Math.max(1, finalCode.trim().length);
  const code = current?.code ?? '';
  const submitted = ghost.submitAtMs !== null && elapsedMs >= ghost.submitAtMs;
  const phase: GhostPhase = submitted ? 'submitted' : current ? 'typing' : 'waiting';
  return {
    phase,
    code: submitted && !code ? finalCode : code,
    lines: countLines(submitted && !code ? finalCode : code),
    progress: submitted ? 1 : Math.min(1, code.trim().length / finalSize),
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
