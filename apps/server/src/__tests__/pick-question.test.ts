import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * pickQuestion avoids questions either player has already met: ones they
 * battled on, and ones they solved in practice (which unlocks the recorded
 * ghost code for that question, so they may have read someone's solution).
 */

const questions = ['q1', 'q2', 'q3'].map(id => ({ id, title: id, slug: id, difficulty: 'EASY', tags: [], isActive: true }));
const state = { battled: [] as string[], practised: [] as string[] };

const notIn = (where: { id?: { notIn: string[] } }) => questions.filter(q => !where.id || !where.id.notIn.includes(q.id));

vi.mock('../prisma', () => ({
  prisma: {
    match: { findMany: async () => state.battled.map(questionId => ({ questionId })) },
    practiceAttempt: { findMany: async () => state.practised.map(questionId => ({ questionId })) },
    question: {
      count: async ({ where }: { where: { id?: { notIn: string[] } } }) => notIn(where).length,
      findFirstOrThrow: async ({ where, skip }: { where: { id?: { notIn: string[] } }; skip: number }) => notIn(where)[skip],
    },
  },
}));
vi.mock('../services/match', () => ({ scheduleReadyTimeout: vi.fn() }));

const { pickQuestion } = await import('../socket/matchmaking');

beforeEach(() => {
  state.battled = [];
  state.practised = [];
});

describe('pickQuestion', () => {
  it('skips questions battled on and questions solved in practice', async () => {
    state.battled = ['q1'];
    state.practised = ['q2'];
    for (let i = 0; i < 10; i++) expect((await pickQuestion(['a', 'b'], 'EASY')).id).toBe('q3');
  });

  it('allows repeats once every question has been seen', async () => {
    state.battled = ['q1', 'q2'];
    state.practised = ['q3'];
    expect(['q1', 'q2', 'q3']).toContain((await pickQuestion(['a', 'b'], 'EASY')).id);
  });
});
