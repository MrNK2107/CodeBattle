import { describe, expect, it } from 'vitest';

import {
  collegeRowsFromAggregates,
  collegeSchema,
  collegeSlug,
  normalizeCollege,
  parseCollegeSlug,
  rankColleges,
  type CollegeAggregate,
  type CollegeMember,
} from './colleges';

const member = (username: string, rating: number, college: string | null, totalMatches = 4, wins = 2): CollegeMember => ({
  username,
  rating,
  wins,
  totalMatches,
  college,
  collegeSlug: collegeSlug(college),
});

describe('college names', () => {
  it('normalizes whitespace and treats blanks as no college', () => {
    expect(normalizeCollege('  IIT   Madras ')).toBe('IIT Madras');
    expect(normalizeCollege('   ')).toBeNull();
    expect(normalizeCollege(undefined)).toBeNull();
  });

  it('groups spelling variants under one slug', () => {
    expect(collegeSlug('IIT Madras')).toBe('iit-madras');
    expect(collegeSlug(' iit  madras')).toBe('iit-madras');
    expect(collegeSlug('IIT (Madras)')).toBe('iit-madras');
    expect(collegeSlug('PSG Tech & Arts')).toBe('psg-tech-and-arts');
    expect(collegeSlug('Université Paris')).toBe('universite-paris');
    expect(collegeSlug('---')).toBeNull();
  });

  it('validates the input field', () => {
    expect(collegeSchema.safeParse('SRM Institute (KTR)').success).toBe(true);
    expect(collegeSchema.safeParse('').success).toBe(true);
    expect(collegeSchema.safeParse(undefined).success).toBe(true);
    expect(collegeSchema.safeParse('<script>').success).toBe(false);
    expect(collegeSchema.safeParse('x'.repeat(61)).success).toBe(false);
  });
});

describe('homoglyph college names', () => {
  // "IIT Mаdras" with a Cyrillic а (U+0430) looks identical to the real one
  const cyrillic = 'IIT Mаdras';
  const allCyrillic = 'МИТ'; // МИТ

  it('rejects a name that mixes Cyrillic into Latin', () => {
    expect(collegeSchema.safeParse(cyrillic).success).toBe(false);
    expect(collegeSchema.safeParse(allCyrillic).success).toBe(false);
    expect(collegeSchema.safeParse('IIT Μadras').success).toBe(false); // Greek capital Mu
  });

  it('never gives a homoglyph name the real college slug, or any slug', () => {
    expect(collegeSlug(cyrillic)).toBeNull();
    expect(collegeSlug(allCyrillic)).toBeNull();
  });

  it('still accepts accented Latin and folds compatibility forms to ASCII slugs', () => {
    expect(collegeSchema.safeParse('Université Paris').success).toBe(true);
    expect(collegeSlug('ＩＩＴ Madras')).toBe('iit-madras'); // fullwidth IIT
    expect(collegeSlug('Université Paris')).toBe('universite-paris');
  });

  it('slugs are ASCII only', () => {
    for (const name of ['IIT Madras', 'PSG Tech & Arts', 'Université Paris', "St. Joseph's (Autonomous)"]) {
      expect(collegeSlug(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('rankColleges drops members whose stored name is not Latin', () => {
    const rows = rankColleges([member('a', 1500, 'IIT Madras'), { ...member('b', 2500, cyrillic), collegeSlug: null }], { minPlayers: 1 });
    expect(rows.map(r => r.slug)).toEqual(['iit-madras']);
    expect(rows[0].players).toBe(1);
  });
});

describe('rankColleges', () => {
  it('scores a college by the average of its top five ranked players', () => {
    const rows = rankColleges([
      member('a', 1500, 'Anna University'),
      member('b', 1400, 'Anna University'),
      member('c', 1300, 'anna university'),
      member('d', 1200, 'Anna University'),
      member('e', 1100, 'Anna University'),
      member('f', 400, 'Anna University'), // sixth player doesn't drag the average down
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slug: 'anna-university', name: 'Anna University', players: 6, score: 1300, ranked: true });
    expect(rows[0].top).toEqual({ username: 'a', rating: 1500 });
  });

  it('ignores players without battles or without a college', () => {
    const rows = rankColleges([member('a', 1500, 'NIT Trichy', 0), member('b', 1500, null), member('c', 1200, 'NIT Trichy')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].players).toBe(1);
  });

  it('lists small colleges as forming, below every ranked one', () => {
    const rows = rankColleges([
      member('solo', 2000, 'Solo Club'),
      member('x1', 1250, 'VIT'),
      member('x2', 1250, 'VIT'),
      member('x3', 1250, 'VIT'),
    ]);
    expect(rows.map(r => [r.slug, r.ranked])).toEqual([
      ['vit', true],
      ['solo-club', false],
    ]);
  });

  it('breaks score ties by player count, then name', () => {
    const rows = rankColleges(
      [member('a', 1300, 'Beta'), member('b', 1300, 'Alpha'), member('c', 1300, 'Gamma'), member('d', 1300, 'Gamma')],
      { minPlayers: 1 },
    );
    expect(rows.map(r => r.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('sums wins and battles across members', () => {
    const [row] = rankColleges([member('a', 1300, 'CEG', 10, 7), member('b', 1250, 'CEG', 5, 1)], { minPlayers: 1 });
    expect(row.wins).toBe(8);
    expect(row.battles).toBe(15);
  });
});

describe('collegeRowsFromAggregates', () => {
  const agg = (slug: string, players: number, score: number, over: Partial<CollegeAggregate> = {}): CollegeAggregate => ({
    slug,
    name: slug.toUpperCase(),
    players,
    score,
    wins: 3,
    battles: 9,
    topUsername: `${slug}-top`,
    topRating: score + 100,
    ...over,
  });

  it('builds the same ordering as rankColleges: ranked first, then score, players, name', () => {
    const rows = collegeRowsFromAggregates([agg('solo', 1, 2000), agg('vit', 3, 1250), agg('ceg', 4, 1250), agg('anna', 3, 1300)]);
    expect(rows.map(r => [r.slug, r.ranked])).toEqual([
      ['anna', true],
      ['ceg', true],
      ['vit', true],
      ['solo', false],
    ]);
    expect(rows[0]).toMatchObject({ name: 'ANNA', score: 1300, top: { username: 'anna-top', rating: 1400 } });
  });

  it('agrees with rankColleges on the same members', () => {
    const members = [member('a', 1500, 'CEG', 10, 7), member('b', 1250, 'CEG', 5, 1), member('c', 1100, 'CEG')];
    const [expected] = rankColleges(members);
    const [row] = collegeRowsFromAggregates([
      { slug: 'ceg', name: 'CEG', players: 3, score: Math.round((1500 + 1250 + 1100) / 3), wins: 10, battles: 19, topUsername: 'a', topRating: 1500 },
    ]);
    expect(row).toEqual(expected);
  });

  it('drops rows whose slug is not a clean ASCII slug', () => {
    expect(collegeRowsFromAggregates([agg('iit-m\u0430dras', 5, 1500)])).toEqual([]);
  });
});

describe('parseCollegeSlug', () => {
  it('normalises ?college= through collegeSlug', () => {
    expect(parseCollegeSlug('iit-madras')).toBe('iit-madras');
    expect(parseCollegeSlug('IIT Madras')).toBe('iit-madras');
    expect(parseCollegeSlug('IIT-Madras')).toBe('iit-madras');
    expect(parseCollegeSlug('iit-m\u0430dras')).toBeNull();
    expect(parseCollegeSlug('')).toBeNull();
    expect(parseCollegeSlug(undefined)).toBeNull();
  });
});
