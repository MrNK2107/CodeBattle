import { standingFor, type Standing } from '@/lib/ladder';

/** A small shield in the tier colour, with the division numeral. */
export function TierEmblem({ standing, size = 20 }: { standing: Standing; size?: number }): JSX.Element {
  const c = standing.tier.color;
  const pips = standing.division === 'I' ? 3 : standing.division === 'II' ? 2 : standing.division === 'III' ? 1 : 0;
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 20 20" className="shrink-0">
      <path d="M10 1.5l7 2.6v5.6c0 4.2-3 7.4-7 8.8-4-1.4-7-4.6-7-8.8V4.1z" fill={`${c}26`} stroke={c} strokeWidth="1.4" />
      {pips ? (
        Array.from({ length: pips }, (_, i) => <rect key={i} x={10 - pips * 2 + i * 4 + 0.5} y="8" width="3" height="5" rx="0.6" fill={c} />)
      ) : (
        <path d="M6 12.5l1.2-5 2.8 2.4 2.8-2.4 1.2 5z" fill={c} />
      )}
    </svg>
  );
}

export function TierBadge({ rating, showRating = false, className = '' }: { rating: number; showRating?: boolean; className?: string }): JSX.Element {
  const s = standingFor(rating);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-display text-xs font-semibold ${className}`}
      style={{ color: s.tier.color }}
      title={`${s.label}${s.nextLabel ? `, ${s.toNext} to ${s.nextLabel}` : ''}`}
    >
      <TierEmblem standing={s} size={16} />
      {s.label}
      {showRating ? <span className="tabular-nums text-text/80">{rating}</span> : null}
    </span>
  );
}

/** The lobby / profile card: current rung, progress bar, points to the next one. */
export function LadderProgress({ rating }: { rating: number }): JSX.Element {
  const s = standingFor(rating);
  const pct = Math.round(s.progress * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <TierEmblem standing={s} size={44} />
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-tight" style={{ color: s.tier.color }}>
            {s.label}
          </p>
          <p className="text-sm text-muted">
            {s.nextLabel ? (
              <>
                <span className="font-semibold tabular-nums text-text">{s.toNext}</span> points to {s.nextLabel}
              </>
            ) : (
              'Top of the ladder'
            )}
          </p>
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-label={s.nextLabel ? `Progress to ${s.nextLabel}` : 'Top of the ladder'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.tier.color }} />
      </div>
    </div>
  );
}
