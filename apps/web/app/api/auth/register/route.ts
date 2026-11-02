import { registerSchema } from '@codebattle/shared';
import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';

import { collegeSchema, collegeSlug, normalizeCollege } from '@/lib/colleges';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rateLimit';

export async function POST(request: Request): Promise<NextResponse> {
  if (!rateLimit(`register:${clientIp(request.headers)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many sign-ups from this network. Try again later.' }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const collegeInput = collegeSchema.safeParse((body as { college?: unknown }).college ?? '');
  if (!collegeInput.success) {
    return NextResponse.json({ error: collegeInput.error.issues[0]?.message ?? 'Invalid college name' }, { status: 400 });
  }
  const slug = collegeSlug(collegeInput.data);
  const college = slug ? normalizeCollege(collegeInput.data) : null;
  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username;

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { id: true } }),
  ]);
  if (emailTaken) return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 });
  if (usernameTaken) return NextResponse.json({ error: 'That username is taken. Try another.' }, { status: 409 });

  try {
    const user = await prisma.user.create({
      data: { email, username, name: username, passwordHash: await hash(parsed.data.password, 12), college, collegeSlug: slug },
      select: { id: true, username: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // unique constraint raced another signup
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'That username or email was just taken. Try another.' }, { status: 409 });
    }
    console.error('register failed', error);
    return NextResponse.json({ error: 'Could not create the account. Try again.' }, { status: 500 });
  }
}
