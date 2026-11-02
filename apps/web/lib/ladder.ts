// The ranked ladder: Elo ratings mapped to tiers and divisions.
//
// Everyone starts at 1200, which is Silver I: one good win away from Gold, so the
// first promotion comes early. Tiers below Master are split into three divisions
// (III is the lowest). Master and Grandmaster are single tiers.

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';

export interface TierDef {
  id: TierId;
  name: string;
  /** lowest rating in the tier */
  floor: number;
  /** hex colour for badges and charts */
  color: string;
  divisions: boolean;
}

export const TIERS: readonly TierDef[] = [
  { id: 'bronze', name: 'Bronze', floor: 0, color: '#C98A5B', divisions: true },
  { id: 'silver', name: 'Silver', floor: 1050, color: '#B8C2D6', divisions: true },
  { id: 'gold', name: 'Gold', floor: 1250, color: '#F5C542', divisions: true },
  { id: 'platinum', name: 'Platinum', floor: 1400, color: '#4FE3C1', divisions: true },
  { id: 'diamond', name: 'Diamond', floor: 1550, color: '#7DA8FF', divisions: true },
  { id: 'master', name: 'Master', floor: 1750, color: '#C77DFF', divisions: false },
  { id: 'grandmaster', name: 'Grandmaster', floor: 2000, color: '#FF5D73', divisions: false },
] as const;

const ROMAN = ['III', 'II', 'I'] as const;

export interface Standing {
  tier: TierDef;
  /** 'III' | 'II' | 'I' for tiers with divisions, null for Master and Grandmaster */
  division: (typeof ROMAN)[number] | null;
  /** e.g. "Gold II" */
  label: string;
  /** rating range of the current step (division, or tier without divisions) */
  stepFloor: number;
  /** first rating of the next step, null at the top */
  nextAt: number | null;
  /** label of the next step, null at the top */
  nextLabel: string | null;
  /** 0..1 through the current step (1 at the top) */
  progress: number;
  /** points still needed for the next step, 0 at the top */
  toNext: number;
}

interface Step {
  tier: TierDef;
  division: Standing['division'];
  floor: number;
}

/** Every rung of the ladder, lowest first. */
export const STEPS: readonly Step[] = (() => {
  const steps: Step[] = [];
  TIERS.forEach((tier, i) => {
    if (!tier.divisions) {
      steps.push({ tier, division: null, floor: tier.floor });
      return;
    }
    // Bronze has no lower bound, so its divisions are anchored 150 below Silver
    const ceil = TIERS[i + 1].floor;
    const start = tier.id === 'bronze' ? ceil - 150 : tier.floor;
    const width = (ceil - start) / 3;
    ROMAN.forEach((division, d) => {
      steps.push({ tier, division, floor: d === 0 ? tier.floor : Math.round(start + width * d) });
    });
  });
  return steps;
})();

function stepLabel(step: Step): string {
  return step.division ? `${step.tier.name} ${step.division}` : step.tier.name;
}

export function standingFor(rawRating: number): Standing {
  const rating = Number.isFinite(rawRating) ? Math.round(rawRating) : 0;
  let index = 0;
  for (let i = 0; i < STEPS.length; i++) if (rating >= STEPS[i].floor) index = i;
  const step = STEPS[index];
  const next = STEPS[index + 1] ?? null;
  // the bottom rung is open-ended; measure its progress over the 50 points below its ceiling
  const from = index === 0 && next ? next.floor - 50 : step.floor;
  const progress = next ? Math.min(1, Math.max(0, (rating - from) / (next.floor - from))) : 1;
  return {
    tier: step.tier,
    division: step.division,
    label: stepLabel(step),
    stepFloor: step.floor,
    nextAt: next ? next.floor : null,
    nextLabel: next ? stepLabel(next) : null,
    progress,
    toNext: next ? Math.max(0, next.floor - rating) : 0,
  };
}

export type LadderMove = 'promoted' | 'demoted' | 'tier-up' | 'tier-down' | 'same';

function stepIndex(rating: number): number {
  const s = standingFor(rating);
  return STEPS.findIndex(step => step.tier.id === s.tier.id && step.division === s.division);
}

/**
 * How a rating change moved a player on the ladder. `tier-up` / `tier-down` mean
 * a new tier (Silver to Gold); `promoted` / `demoted` a new division in the same tier.
 */
export function ladderMove(before: number, after: number): LadderMove {
  const a = stepIndex(before);
  const b = stepIndex(after);
  if (a === b) return 'same';
  const tierChanged = STEPS[a].tier.id !== STEPS[b].tier.id;
  if (b > a) return tierChanged ? 'tier-up' : 'promoted';
  return tierChanged ? 'tier-down' : 'demoted';
}

/** Players per tier, in ladder order, for the distribution bar. */
export function tierDistribution(ratings: number[]): Array<{ tier: TierDef; count: number; share: number }> {
  const counts = new Map<TierId, number>(TIERS.map(t => [t.id, 0]));
  for (const r of ratings) {
    const id = standingFor(r).tier.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = ratings.length || 1;
  return TIERS.map(tier => ({ tier, count: counts.get(tier.id) ?? 0, share: (counts.get(tier.id) ?? 0) / total }));
}
