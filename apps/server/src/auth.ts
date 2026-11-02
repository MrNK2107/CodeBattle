import { jwtVerify } from "jose";

const secret = process.env.NEXTAUTH_SECRET;

if (!secret) {
  console.warn("NEXTAUTH_SECRET is not set. Socket authentication will fail until it is configured.");
}

export async function verifySocketToken(token?: string): Promise<{ userId: string; role?: string }> {
  if (!token || !secret) {
    throw new Error("UNAUTHORIZED");
  }

  const encoder = new TextEncoder();
  const { payload } = await jwtVerify(token, encoder.encode(secret));

  const userId = (payload as { userId?: string; sub?: string }).userId || (payload.sub ? String(payload.sub) : undefined);
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const role = (payload as { role?: string }).role;
  return { userId, role };
}
