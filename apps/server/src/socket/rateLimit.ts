/*
 * Per-socket and per-user event rate limiting for the battle namespace.
 *
 * Each event belongs to a class with its own token bucket:
 *   telemetry  battle:typing, battle:snapshot   (loose: the client sends ~0.7/s)
 *   action     battle:run, battle:submit        (strict: each one can mean judge work)
 *   control    battle:ready, battle:forfeit, battle:spectate, battle:unspectate
 * An event needs a token from both its socket's bucket and its user's bucket
 * (shared across tabs), so the check runs before any DB read or judge work.
 */

export type EventClass = 'telemetry' | 'action' | 'control';

export interface BucketLimit {
  /** tokens available at once */
  burst: number;
  /** tokens refilled per second */
  perSec: number;
}

export interface EventLimitConfig {
  enabled: boolean;
  socket: Record<EventClass, BucketLimit>;
  user: Record<EventClass, BucketLimit>;
  /** rejected events within `violationWindowMs` before the socket is disconnected */
  maxViolations: number;
  violationWindowMs: number;
}

export type LimitResult = 'ok' | 'limited' | 'disconnect';

export const BATTLE_EVENT_CLASSES: Record<string, EventClass> = {
  'battle:typing': 'telemetry',
  'battle:snapshot': 'telemetry',
  'battle:run': 'action',
  'battle:submit': 'action',
  'battle:ready': 'control',
  'battle:forfeit': 'control',
  'battle:spectate': 'control',
  'battle:unspectate': 'control',
};

const DEFAULT_SOCKET_LIMITS: Record<EventClass, BucketLimit> = {
  telemetry: { burst: 20, perSec: 5 },
  action: { burst: 5, perSec: 0.5 },
  control: { burst: 10, perSec: 1 },
};
const DEFAULT_USER_FACTOR = 2;

const scale = (limits: Record<EventClass, BucketLimit>, factor: number): Record<EventClass, BucketLimit> => ({
  telemetry: { burst: limits.telemetry.burst * factor, perSec: limits.telemetry.perSec * factor },
  action: { burst: limits.action.burst * factor, perSec: limits.action.perSec * factor },
  control: { burst: limits.control.burst * factor, perSec: limits.control.perSec * factor },
});

export const DEFAULT_EVENT_LIMITS: EventLimitConfig = {
  enabled: true,
  socket: DEFAULT_SOCKET_LIMITS,
  user: scale(DEFAULT_SOCKET_LIMITS, DEFAULT_USER_FACTOR),
  maxViolations: 20,
  violationWindowMs: 60_000,
};

function positive(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * SOCKET_{TELEMETRY,ACTION,CONTROL}_{BURST,PER_SEC} set the per-socket buckets;
 * per-user buckets are those times SOCKET_USER_LIMIT_FACTOR.
 */
export function eventLimitConfigFromEnv(env: Record<string, string | undefined> = process.env): EventLimitConfig {
  const classes: EventClass[] = ['telemetry', 'action', 'control'];
  const socket = {} as Record<EventClass, BucketLimit>;
  for (const cls of classes) {
    const key = `SOCKET_${cls.toUpperCase()}`;
    socket[cls] = {
      burst: positive(env[`${key}_BURST`], DEFAULT_SOCKET_LIMITS[cls].burst),
      perSec: positive(env[`${key}_PER_SEC`], DEFAULT_SOCKET_LIMITS[cls].perSec),
    };
  }
  const flag = (env.SOCKET_RATE_LIMIT ?? '').trim().toLowerCase();
  return {
    enabled: !['off', '0', 'false', 'no'].includes(flag),
    socket,
    user: scale(socket, positive(env.SOCKET_USER_LIMIT_FACTOR, DEFAULT_USER_FACTOR)),
    maxViolations: Math.floor(positive(env.SOCKET_MAX_VIOLATIONS, DEFAULT_EVENT_LIMITS.maxViolations)),
    violationWindowMs: positive(env.SOCKET_VIOLATION_WINDOW_MS, DEFAULT_EVENT_LIMITS.violationWindowMs),
  };
}

interface Bucket {
  tokens: number;
  at: number;
}

function refill(bucket: Bucket, limit: BucketLimit, now: number): void {
  bucket.tokens = Math.min(limit.burst, bucket.tokens + ((now - bucket.at) / 1000) * limit.perSec);
  bucket.at = now;
}

export class EventRateLimiter {
  private readonly sockets = new Map<string, Bucket>();
  private readonly users = new Map<string, Bucket>();
  /** socketId -> times of recent rejected events */
  private readonly violations = new Map<string, number[]>();

  constructor(
    readonly config: EventLimitConfig,
    private readonly now: () => number = Date.now
  ) {}

  check(socketId: string, userId: string, cls: EventClass): LimitResult {
    if (!this.config.enabled) return 'ok';
    const now = this.now();
    const s = this.bucket(this.sockets, `${socketId}:${cls}`, this.config.socket[cls], now);
    const u = this.bucket(this.users, `${userId}:${cls}`, this.config.user[cls], now);
    if (s.tokens < 1 || u.tokens < 1) return this.violation(socketId, now);
    s.tokens -= 1;
    u.tokens -= 1;
    return 'ok';
  }

  forgetSocket(socketId: string): void {
    this.violations.delete(socketId);
    for (const key of this.sockets.keys()) if (key.startsWith(`${socketId}:`)) this.sockets.delete(key);
  }

  private violation(socketId: string, now: number): LimitResult {
    const recent = (this.violations.get(socketId) ?? []).filter(t => now - t < this.config.violationWindowMs);
    recent.push(now);
    this.violations.set(socketId, recent);
    return recent.length >= this.config.maxViolations ? 'disconnect' : 'limited';
  }

  private bucket(map: Map<string, Bucket>, key: string, limit: BucketLimit, now: number): Bucket {
    let bucket = map.get(key);
    if (!bucket) {
      if (map.size > 50_000) this.prune(map, now);
      bucket = { tokens: limit.burst, at: now };
      map.set(key, bucket);
    } else {
      refill(bucket, limit, now);
    }
    return bucket;
  }

  /** Drops buckets idle long enough to be full again (they'd be recreated identical). */
  private prune(map: Map<string, Bucket>, now: number): void {
    for (const [key, bucket] of map) if (now - bucket.at > 10 * 60_000) map.delete(key);
  }
}

export const battleEventLimiter = new EventRateLimiter(eventLimitConfigFromEnv());
