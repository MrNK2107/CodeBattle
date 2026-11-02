/**
 * Fixed-window limiter kept in memory. The web app runs as one process per
 * deployment here; behind several replicas each gets its own budget, which is
 * still a useful brake on password guessing and signup spam.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 50_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
