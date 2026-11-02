import { z } from 'zod';

// Colleges and clubs. Players type the name themselves; the slug groups spelling
// variants ("IIT  Madras", "iit madras") into one team on the leaderboard.

/** A college counts toward its average from this many ranked players. */
export const COLLEGE_TOP_N = 5;
/** Colleges with fewer ranked players than this are listed as "forming", not ranked. */
export const COLLEGE_MIN_PLAYERS = 3;

export const collegeSchema = z
  .string()
  .trim()
  .max(60, 'Keep the college or club name under 60 characters')
  .regex(/^[\p{L}\p{N} .,&()'-]*$/u, 'Use letters, numbers, spaces and . , & ( ) \' - only')
  .optional()
  .or(z.literal(''));

/** Collapses whitespace; returns null for an empty name. */
export function normalizeCollege(raw: string | null | undefined): string | null {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 60) : null;
}

/** URL-safe grouping key: "IIT (Madras)" and "iit madras" both become "iit-madras". */
export function collegeSlug(raw: string | null | undefined): string | null {
  const name = normalizeCollege(raw);
  if (!name) return null;
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

export interface CollegeMember {
  username: string;
  rating: number;
  wins: number;
  totalMatches: number;
  college: string | null;
  collegeSlug: string | null;
}

export interface CollegeRow {
  slug: string;
  /** the most common spelling among members */
  name: string;
  /** ranked players (at least one finished battle) */
  players: number;
  /** average rating of the top COLLEGE_TOP_N ranked players, rounded */
  score: number;
  wins: number;
  battles: number;
  top: { username: string; rating: number };
  /** false while the college has fewer than COLLEGE_MIN_PLAYERS ranked players */
  ranked: boolean;
}

/**
 * Ranks colleges by the average rating of their best COLLEGE_TOP_N ranked players.
 * Using the top few (not everyone) means a club isn't punished for bringing beginners,
 * and one star can't carry a college alone. Ties go to more players, then name.
 */
export function rankColleges(members: CollegeMember[], opts: { topN?: number; minPlayers?: number } = {}): CollegeRow[] {
  const topN = opts.topN ?? COLLEGE_TOP_N;
  const minPlayers = opts.minPlayers ?? COLLEGE_MIN_PLAYERS;
  const groups = new Map<string, CollegeMember[]>();
  for (const m of members) {
    const slug = m.collegeSlug ?? collegeSlug(m.college);
    if (!slug || m.totalMatches <= 0) continue;
    const list = groups.get(slug) ?? [];
    list.push(m);
    groups.set(slug, list);
  }

  const rows: CollegeRow[] = [];
  for (const [slug, list] of groups) {
    const sorted = [...list].sort((a, b) => b.rating - a.rating || a.username.localeCompare(b.username));
    const best = sorted.slice(0, topN);
    const spellings = new Map<string, number>();
    for (const m of list) {
      const name = normalizeCollege(m.college);
      if (name) spellings.set(name, (spellings.get(name) ?? 0) + 1);
    }
    const name = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? slug;
    rows.push({
      slug,
      name,
      players: list.length,
      score: Math.round(best.reduce((sum, m) => sum + m.rating, 0) / best.length),
      wins: list.reduce((sum, m) => sum + m.wins, 0),
      battles: list.reduce((sum, m) => sum + m.totalMatches, 0),
      top: { username: sorted[0].username, rating: sorted[0].rating },
      ranked: list.length >= minPlayers,
    });
  }

  return rows.sort(
    (a, b) => Number(b.ranked) - Number(a.ranked) || b.score - a.score || b.players - a.players || a.name.localeCompare(b.name),
  );
}
