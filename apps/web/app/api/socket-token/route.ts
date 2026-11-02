import { SignJWT } from "jose";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Mints a short-lived HS256 JWT for the Socket.io server. The NextAuth session
 * cookie is encrypted (JWE) so the server can't read it directly; both sides
 * share NEXTAUTH_SECRET instead.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  const secret = process.env.NEXTAUTH_SECRET;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!secret) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET is not configured" }, { status: 500 });
  }

  const token = await new SignJWT({ userId, role: session.user?.role ?? "USER" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, userId, name: session.user?.name ?? null });
}
