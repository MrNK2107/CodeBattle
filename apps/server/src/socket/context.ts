import type { Socket } from 'socket.io';
import type { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';
import type { ZodSchema } from 'zod';

export type BattleSocket = Socket<BattleClientToServerEvents, BattleServerToClientEvents>;

export const userRoom = (userId: string) => `user:${userId}`;

// ---------------------------------------------------------------- presence

const connections = new Map<string, number>();

export function markConnected(userId: string): void {
  connections.set(userId, (connections.get(userId) ?? 0) + 1);
}

/** Returns true when this was the user's last open socket. */
export function markDisconnected(userId: string): boolean {
  const left = (connections.get(userId) ?? 1) - 1;
  if (left <= 0) {
    connections.delete(userId);
    return true;
  }
  connections.set(userId, left);
  return false;
}

export function isOnline(userId: string): boolean {
  return (connections.get(userId) ?? 0) > 0;
}

// ---------------------------------------------------------------- rate limiting

/** One judge job per user at a time, and at most `perMinute` per minute. */
export class JudgeLimiter {
  private readonly busy = new Set<string>();
  private readonly history = new Map<string, number[]>();

  constructor(private readonly perMinute: number) {}

  /** Returns an error message, or a release function when allowed. */
  acquire(userId: string, now: number = Date.now()): string | (() => void) {
    if (this.busy.has(userId)) return 'Your previous run is still being judged.';
    const recent = (this.history.get(userId) ?? []).filter(t => now - t < 60_000);
    if (recent.length >= this.perMinute) return 'Too many runs. Wait a few seconds and try again.';
    recent.push(now);
    this.history.set(userId, recent);
    this.busy.add(userId);
    return () => this.busy.delete(userId);
  }
}

export const judgeLimiter = new JudgeLimiter(Number(process.env.RUNS_PER_MINUTE ?? 20));

// ---------------------------------------------------------------- validation

/** Parses a payload or reports a VALIDATION_ERROR to the socket. */
export function parsePayload<T>(socket: BattleSocket, schema: ZodSchema<T>, payload: unknown): T | null {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return null;
  }
  return parsed.data;
}

/** Wraps an async handler so failures are logged and reported instead of crashing. */
export function safe<A extends unknown[]>(socket: BattleSocket, name: string, fn: (...args: A) => Promise<void>) {
  return (...args: A) => {
    fn(...args).catch(error => {
      console.error(`${name} failed`, error);
      socket.emit('error', { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
    });
  };
}

// ---------------------------------------------------------------- participant cache

/** matchId:userId -> cached at, for the high-frequency telemetry events */
const participants = new Map<string, number>();
export const PARTICIPANT_CACHE_MS = 30_000;

export function cachedParticipant(matchId: string, userId: string): boolean {
  const at = participants.get(`${matchId}:${userId}`);
  return at !== undefined && Date.now() - at < PARTICIPANT_CACHE_MS;
}

export function rememberParticipant(matchId: string, userId: string): void {
  if (participants.size > 10_000) participants.clear();
  participants.set(`${matchId}:${userId}`, Date.now());
}

/** Called when a match ends so late telemetry is rejected immediately. */
export function forgetMatch(matchId: string): void {
  for (const key of participants.keys()) if (key.startsWith(`${matchId}:`)) participants.delete(key);
}
