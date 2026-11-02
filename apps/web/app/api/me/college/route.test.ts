import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ userId: 'u1' as string | null, updates: [] as unknown[] }));

vi.mock('@/lib/auth', () => ({ auth: async () => (state.userId ? { user: { id: state.userId } } : null) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: async (args: { where: { id: string }; data: { college: string | null; collegeSlug: string | null } }) => {
        state.updates.push(args);
        return { college: args.data.college, collegeSlug: args.data.collegeSlug };
      },
    },
  },
}));

import { PUT } from './route';

const put = (body: unknown) =>
  PUT(new Request('http://localhost/api/me/college', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('PUT /api/me/college', () => {
  beforeEach(() => {
    state.userId = `u-${Math.random()}`; // fresh rate-limit bucket per test
    state.updates = [];
  });

  it('requires a session', async () => {
    state.userId = null;
    expect((await put({ college: 'CEG' })).status).toBe(401);
    expect(state.updates).toHaveLength(0);
  });

  it('stores the normalized name and its slug for the signed-in user only', async () => {
    const res = await put({ college: '  IIT   Madras ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ college: 'IIT Madras', collegeSlug: 'iit-madras' });
    expect(state.updates[0]).toMatchObject({ where: { id: state.userId }, data: { college: 'IIT Madras', collegeSlug: 'iit-madras' } });
  });

  it('clears the college with an empty name or null', async () => {
    for (const college of ['', '   ', null]) {
      const res = await put({ college });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ college: null, collegeSlug: null });
    }
  });

  it('rejects markup, overlong names, wrong types and bad JSON', async () => {
    expect((await put({ college: '<img src=x>' })).status).toBe(400);
    expect((await put({ college: 'a'.repeat(61) })).status).toBe(400);
    expect((await put({ college: 42 })).status).toBe(400);
    expect((await put('{not json')).status).toBe(400);
    expect(state.updates).toHaveLength(0);
  });

  it('a name with no letters or digits is stored as no college', async () => {
    const res = await put({ college: "'-'" });
    expect(await res.json()).toEqual({ college: null, collegeSlug: null });
  });

  it('rate limits repeated changes', async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await put({ college: `Club ${i}` })).status;
    expect(last).toBe(429);
  });
});
