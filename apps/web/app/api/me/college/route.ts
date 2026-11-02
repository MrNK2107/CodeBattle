import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { collegeSchema, collegeSlug, normalizeCollege } from '@/lib/colleges';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Sets (or clears, with an empty name) the college or club the signed-in player represents. */
export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!rateLimit(`college:${userId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'You changed your college too often. Try again in an hour.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const raw = (body as { college?: unknown } | null)?.college;
  const parsed = collegeSchema.safeParse(typeof raw === 'string' ? raw : raw === null ? '' : raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid college name' }, { status: 400 });
  }
  const college = normalizeCollege(parsed.data);
  const slug = collegeSlug(college);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { college: slug ? college : null, collegeSlug: slug },
    select: { college: true, collegeSlug: true },
  });
  return NextResponse.json(user);
}
