import type { TypingEvent } from '@codebattle/shared';
import { redis } from '../redis';

/** [t, kind] where t is ms on the server clock and kind 0=char 1=backspace 2=other */
export type StoredTypingEvent = [number, 0 | 1 | 2];

const eventsKey = (matchId: string, userId: string) => `typing:${matchId}:${userId}`;
const pasteKey = (matchId: string, userId: string) => `paste:${matchId}:${userId}`;
const snapshotKey = (matchId: string, userId: string) => `snap:${matchId}:${userId}`;

const KIND = { char: 0, backspace: 1, other: 2 } as const;
const MAX_EVENTS_PER_MATCH = 40_000;
const MAX_SNAPSHOTS = 400;
const TTL_SECONDS = 6 * 60 * 60;

/**
 * Client clocks can't be trusted, so a batch is re-anchored to the server's
 * receive time: the last event is placed at `receivedAt` and the others keep
 * their relative spacing. Bursts faster than a human can type are dropped.
 */
export function normalizeBatch(events: TypingEvent[], receivedAt: number): StoredTypingEvent[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const offset = receivedAt - sorted[sorted.length - 1].t;
  const out: StoredTypingEvent[] = [];
  let lastT = -Infinity;
  for (const e of sorted) {
    const t = Math.round(e.t + offset);
    // > 30 keys per second is not typing
    if (t - lastT < 33) continue;
    out.push([t, KIND[e.k]]);
    lastT = t;
  }
  return out;
}

export async function recordTypingBatch(
  matchId: string,
  userId: string,
  events: TypingEvent[],
  pastedChars: number,
  receivedAt: number = Date.now()
): Promise<void> {
  const normalized = normalizeBatch(events, receivedAt);
  const key = eventsKey(matchId, userId);
  if (normalized.length) {
    const length = await redis.llen(key);
    if (length < MAX_EVENTS_PER_MATCH) {
      await redis.rpush(key, ...normalized.map(e => JSON.stringify(e)));
      await redis.expire(key, TTL_SECONDS);
    }
  }
  if (pastedChars > 0) {
    await redis.incrby(pasteKey(matchId, userId), pastedChars);
    await redis.expire(pasteKey(matchId, userId), TTL_SECONDS);
  }
}

export async function readTyping(matchId: string, userId: string): Promise<{ events: StoredTypingEvent[]; pastedChars: number }> {
  const [raw, pasted] = await Promise.all([redis.lrange(eventsKey(matchId, userId), 0, -1), redis.get(pasteKey(matchId, userId))]);
  const events: StoredTypingEvent[] = [];
  for (const entry of raw) {
    try {
      const parsed = JSON.parse(entry) as StoredTypingEvent;
      if (Array.isArray(parsed) && typeof parsed[0] === 'number') events.push(parsed);
    } catch {
      // ignore malformed entries
    }
  }
  events.sort((a, b) => a[0] - b[0]);
  return { events, pastedChars: Number(pasted ?? 0) };
}

export interface TypingMetrics {
  wpm: number;
  /** coefficient of variation of per-minute speed */
  variation: number;
  backspaceRate: number;
  avgPauseMs: number;
  burstCount: number;
  activeMinutes: number;
}

const PAUSE_MS = 5000;

/**
 * Speed is measured over *active* time (gaps longer than 5 s are thinking, not
 * typing), so time spent reading the problem doesn't count against anyone.
 */
export function computeTypingMetrics(events: StoredTypingEvent[]): TypingMetrics {
  const keys = events.filter(e => e[1] !== 2);
  if (keys.length < 2) return { wpm: 0, variation: 0, backspaceRate: 0, avgPauseMs: 0, burstCount: keys.length ? 1 : 0, activeMinutes: 0 };

  let activeMs = 0;
  let pauseTotal = 0;
  let pauses = 0;
  let bursts = 1;
  for (let i = 1; i < keys.length; i++) {
    const gap = keys[i][0] - keys[i - 1][0];
    if (gap > PAUSE_MS) {
      bursts++;
      pauses++;
      pauseTotal += gap;
    } else {
      activeMs += gap;
    }
  }
  const activeMinutes = Math.max(activeMs / 60_000, 1 / 60);
  const chars = keys.filter(e => e[1] === 0).length;
  const backspaces = keys.length - chars;
  const wpm = chars / 5 / activeMinutes;

  // per-minute speed over minutes with activity
  const buckets = new Map<number, number>();
  const start = keys[0][0];
  for (const e of keys) {
    if (e[1] !== 0) continue;
    const minute = Math.floor((e[0] - start) / 60_000);
    buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
  }
  const perMinute = [...buckets.values()].map(n => n / 5);
  const mean = perMinute.reduce((a, b) => a + b, 0) / perMinute.length;
  const sd = Math.sqrt(perMinute.reduce((a, b) => a + (b - mean) ** 2, 0) / perMinute.length);
  const variation = perMinute.length < 2 || mean === 0 ? 0 : sd / mean;

  return {
    wpm,
    variation,
    backspaceRate: backspaces / keys.length,
    avgPauseMs: pauses ? pauseTotal / pauses : 0,
    burstCount: bursts,
    activeMinutes,
  };
}

export interface CodeSnapshot {
  /** ms since the match started */
  t: number;
  code: string;
  language: string;
}

export async function recordSnapshot(matchId: string, userId: string, snapshot: CodeSnapshot): Promise<void> {
  const key = snapshotKey(matchId, userId);
  const last = await redis.lindex(key, -1);
  if (last) {
    try {
      const prev = JSON.parse(last) as CodeSnapshot;
      if (prev.code === snapshot.code && prev.language === snapshot.language) return;
    } catch {
      // overwrite garbage
    }
  }
  await redis.rpush(key, JSON.stringify(snapshot));
  await redis.ltrim(key, -MAX_SNAPSHOTS, -1);
  await redis.expire(key, TTL_SECONDS);
}

export async function readSnapshots(matchId: string, userId: string): Promise<CodeSnapshot[]> {
  const raw = await redis.lrange(snapshotKey(matchId, userId), 0, -1);
  return raw.flatMap(entry => {
    try {
      return [JSON.parse(entry) as CodeSnapshot];
    } catch {
      return [];
    }
  });
}

export async function clearMatchTelemetry(matchId: string, userId: string): Promise<void> {
  await redis.del(eventsKey(matchId, userId), pasteKey(matchId, userId), snapshotKey(matchId, userId));
}
