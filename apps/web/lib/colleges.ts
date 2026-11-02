import { z } from 'zod';

// Colleges and clubs. Players type the name themselves; the slug groups spelling
// variants ("IIT  Madras", "iit madras") into one team on the leaderboard.

/** A college counts toward its average from this many ranked players. */
export const COLLEGE_TOP_N = 5;
/** Colleges with fewer ranked players than this are listed as "forming", not ranked. */
export const COLLEGE_MIN_PLAYERS = 3;

// Names are self-declared, so they are restricted to Latin script: after NFKD
// folding ("Université" -> "Universite", fullwidth "ＩＩＴ" -> "IIT") only ASCII
// letters, digits, spaces and . , & ( ) ' - may remain. That rules out
// homoglyph look-alikes such as "IIT Mаdras" with a Cyrillic "а".
const LATIN_NAME = /^[A-Za-z0-9 .,&()'-]*$/;
const ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** NFKD-folds a name and drops combining marks, leaving plain letters. */
function foldCollege(raw: string): string {
  return raw.normalize('NFKD').replace(/\p{M}/gu, '');
}

/** True when the name is Latin script only (accents allowed). */
export function isLatinCollegeName(raw: string): boolean {
  return LATIN_NAME.test(foldCollege(raw));
}

export const collegeSchema = z
  .string()
  .trim()
  .max(60, 'Keep the college or club name under 60 characters')
  .refine(isLatinCollegeName, "Use Latin letters, numbers, spaces and . , & ( ) ' - only")
  .optional()
  .or(z.literal(''));

/** Collapses whitespace; returns null for an empty name. */
export function normalizeCollege(raw: string | null | undefined): string | null {
  const name = (raw ?? '').replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, 60) : null;
}

/**
 * ASCII grouping key: "IIT (Madras)" and "iit madras" both become "iit-madras".
 * Null for an empty name or one that is not Latin script, so a look-alike can
 * never join (or impersonate) a real college.
 */
export function collegeSlug(raw: string | null | undefined): string | null {
  const name = normalizeCollege(raw);
  if (!name || !isLatinCollegeName(name)) return null;
  const slug = foldCollege(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/** Accepts only a well-formed ASCII slug (e.g. from ?college=), else null. */
export function parseCollegeSlug(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().slice(0, 80);
  if (ASCII_SLUG.test(v)) return v;
  return collegeSlug(v);
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
    // trust a stored slug only if it is a clean ASCII one; otherwise re-derive it (null for non-Latin names)
    const slug = m.collegeSlug && ASCII_SLUG.test(m.collegeSlug) && isLatinCollegeName(m.college ?? '') ? m.collegeSlug : collegeSlug(m.college);
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

/** One college as aggregated by the database (see lib/leaderboardData.ts). */
export interface CollegeAggregate {
  slug: string;
  /** most common spelling */
  name: string;
  players: number;
  /** average of the top COLLEGE_TOP_N ratings, rounded */
  score: number;
  wins: number;
  battles: number;
  topUsername: string;
  topRating: number;
}

/** Same ordering and shape as rankColleges, from pre-aggregated rows. */
export function collegeRowsFromAggregates(aggs: CollegeAggregate[], opts: { minPlayers?: number } = {}): CollegeRow[] {
  const minPlayers = opts.minPlayers ?? COLLEGE_MIN_PLAYERS;
  return aggs
    .filter(a => ASCII_SLUG.test(a.slug) && a.players > 0)
    .map(a => ({
      slug: a.slug,
      name: a.name,
      players: a.players,
      score: a.score,
      wins: a.wins,
      battles: a.battles,
      top: { username: a.topUsername, rating: a.topRating },
      ranked: a.players >= minPlayers,
    }))
    .sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.score - a.score || b.players - a.players || a.name.localeCompare(b.name));
}
