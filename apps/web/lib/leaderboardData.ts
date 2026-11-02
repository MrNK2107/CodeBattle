import { unstable_cache } from 'next/cache';

import { COLLEGE_MIN_PLAYERS, COLLEGE_TOP_N, collegeRowsFromAggregates, type CollegeAggregate, type CollegeRow } from '@/lib/colleges';
import { distributionFromCounts, tierRanges, type TierDef } from '@/lib/ladder';
import { prisma } from '@/lib/prisma';

// Leaderboard reads. Nothing here loads every user: tier counts are one indexed
// COUNT per tier, college scores are aggregated in Postgres with a window
// function over the (collegeSlug, rating) index, and the player list is capped.
// Each result is cached for a minute; ratings only move when a battle ends.

const REVALIDATE_S = 60;
export const PLAYER_LIMIT = 100;
const COLLEGE_LIMIT = 500;

export interface TierCounts {
  total: number;
  distribution: Array<{ tier: TierDef; count: number; share: number }>;
}

export const loadTierCounts = unstable_cache(
  async (): Promise<TierCounts> => {
    const counts = await Promise.all(
      tierRanges().map(r =>
        prisma.user.count({
          where: {
            totalMatches: { gt: 0 },
            rating: { ...(r.gte !== undefined ? { gte: r.gte } : {}), ...(r.lt !== undefined ? { lt: r.lt } : {}) },
          },
        }),
      ),
    );
    return { total: counts.reduce((a, b) => a + b, 0), distribution: distributionFromCounts(counts) };
  },
  ['leaderboard-tier-counts'],
  { revalidate: REVALIDATE_S },
);

interface CollegeSqlRow {
  slug: string;
  name: string | null;
  players: number;
  score: number;
  wins: number;
  battles: number;
  topUsername: string;
  topRating: number;
}

export const loadCollegeRows = unstable_cache(
  async (): Promise<CollegeRow[]> => {
    // Only clean ASCII slugs are grouped (legacy rows from before the Latin-only
    // rule fall out). Ranked colleges sort first, as in collegeRowsFromAggregates.
    const rows = await prisma.$queryRaw<CollegeSqlRow[]>`
      WITH ranked AS (
        SELECT "collegeSlug", "college", "username", "rating", "wins", "totalMatches",
               ROW_NUMBER() OVER (PARTITION BY "collegeSlug" ORDER BY "rating" DESC, "username" ASC) AS rn
        FROM "User"
        WHERE "totalMatches" > 0
          AND "collegeSlug" IS NOT NULL
          AND "collegeSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      )
      SELECT "collegeSlug" AS slug,
             MODE() WITHIN GROUP (ORDER BY "college") AS name,
             COUNT(*)::int AS players,
             ROUND(AVG("rating") FILTER (WHERE rn <= ${COLLEGE_TOP_N}))::int AS score,
             SUM("wins")::int AS wins,
             SUM("totalMatches")::int AS battles,
             MAX("username") FILTER (WHERE rn = 1) AS "topUsername",
             MAX("rating") FILTER (WHERE rn = 1)::int AS "topRating"
      FROM ranked
      GROUP BY "collegeSlug"
      ORDER BY (COUNT(*) >= ${COLLEGE_MIN_PLAYERS}) DESC, score DESC, players DESC
      LIMIT ${COLLEGE_LIMIT}
    `;
    const aggs: CollegeAggregate[] = rows.map(r => ({ ...r, name: r.name ?? r.slug }));
    return collegeRowsFromAggregates(aggs);
  },
  ['leaderboard-colleges'],
  { revalidate: REVALIDATE_S },
);

export interface LeaderboardPlayer {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  totalMatches: number;
  college: string | null;
  collegeSlug: string | null;
}

export const loadTopPlayers = unstable_cache(
  async (collegeSlug: string | null): Promise<LeaderboardPlayer[]> =>
    prisma.user.findMany({
      where: { totalMatches: { gt: 0 }, ...(collegeSlug ? { collegeSlug } : {}) },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { createdAt: 'asc' }],
      take: PLAYER_LIMIT,
      select: { id: true, username: true, rating: true, wins: true, losses: true, totalMatches: true, college: true, collegeSlug: true },
    }),
  ['leaderboard-players'],
  { revalidate: REVALIDATE_S },
);
