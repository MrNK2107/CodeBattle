// Who may read the code of a finished battle.
//
// Battle questions stay in the ranked pool, so a recorded solution is a
// copy-ready answer to someone else's future match. Replays and results show
// the code only to the two people who played; every other signed-in viewer gets
// the verdict timeline (snapshot times, line counts, submit marks) without it.
import { ghostFramesForViewer, type GhostFrame } from './ghost';

export function canSeeBattleCode(players: ReadonlyArray<{ userId: string }>, viewerId: string | null | undefined): boolean {
  return !!viewerId && players.some(p => p.userId === viewerId);
}

/** Replay snapshots for a viewer; code is stripped unless `includeCode`. */
export function replayFramesFor(raw: unknown, includeCode: boolean): GhostFrame[] {
  return ghostFramesForViewer(raw, includeCode);
}
