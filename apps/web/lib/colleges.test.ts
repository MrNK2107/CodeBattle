import { describe, expect, it } from 'vitest';

import { collegeSchema, collegeSlug, normalizeCollege, rankColleges, type CollegeMember } from './colleges';

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
