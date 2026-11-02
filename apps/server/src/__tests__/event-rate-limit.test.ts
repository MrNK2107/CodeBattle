import { describe, expect, it } from 'vitest';
import { BATTLE_EVENT_CLASSES, DEFAULT_EVENT_LIMITS, EventRateLimiter, eventLimitConfigFromEnv, type EventLimitConfig } from '../socket/rateLimit';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

const small: EventLimitConfig = {
  enabled: true,
  socket: { telemetry: { burst: 4, perSec: 2 }, action: { burst: 2, perSec: 0.5 }, control: { burst: 3, perSec: 1 } },
  user: { telemetry: { burst: 6, perSec: 3 }, action: { burst: 3, perSec: 1 }, control: { burst: 5, perSec: 2 } },
  maxViolations: 1000,
  violationWindowMs: 60_000,
};

describe('EventRateLimiter (token bucket per socket and per user)', () => {
  it('allows a burst, then rejects until tokens refill', () => {
    const c = clock();
    const limiter = new EventRateLimiter(small, c.now);
    expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
    expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    c.advance(1_999);
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    c.advance(1);
    expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
  });

  it('never refills above the burst size', () => {
    const c = clock();
    const limiter = new EventRateLimiter(small, c.now);
    c.advance(3_600_000);
    const results = Array.from({ length: 5 }, () => limiter.check('s1', 'u1', 'control'));
    expect(results).toEqual(['ok', 'ok', 'ok', 'limited', 'limited']);
  });

  it('keeps separate buckets per event class', () => {
    const limiter = new EventRateLimiter(small, clock().now);
    limiter.check('s1', 'u1', 'action');
    limiter.check('s1', 'u1', 'action');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'telemetry')).toBe('ok');
    expect(limiter.check('s1', 'u1', 'control')).toBe('ok');
  });

  it('shares a per-user bucket across that user\'s sockets (tabs)', () => {
    const limiter = new EventRateLimiter(small, clock().now);
    // user action burst is 3, socket burst 2: two tabs get 3 in total, not 4
    const results = [
      limiter.check('tab1', 'u1', 'action'),
      limiter.check('tab1', 'u1', 'action'),
      limiter.check('tab2', 'u1', 'action'),
      limiter.check('tab2', 'u1', 'action'),
    ];
    expect(results).toEqual(['ok', 'ok', 'ok', 'limited']);
    // another user is unaffected
    expect(limiter.check('tab3', 'u2', 'action')).toBe('ok');
  });

  it('a rejection by one bucket does not drain the other', () => {
    const c = clock();
    const limiter = new EventRateLimiter(small, c.now);
    limiter.check('tab1', 'u1', 'action');
    limiter.check('tab1', 'u1', 'action');
    // tab1 is empty; these rejections must not consume the user's last token
    for (let i = 0; i < 5; i++) expect(limiter.check('tab1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('tab2', 'u1', 'action')).toBe('ok');
  });

  it('is a no-op when disabled', () => {
    const limiter = new EventRateLimiter({ ...small, enabled: false }, clock().now);
    for (let i = 0; i < 100; i++) expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
  });

  it('forgetSocket drops the socket bucket', () => {
    const limiter = new EventRateLimiter(small, clock().now);
    limiter.check('s1', 'u1', 'control');
    limiter.check('s1', 'u1', 'control');
    limiter.check('s1', 'u1', 'control');
    expect(limiter.check('s1', 'u1', 'control')).toBe('limited');
    limiter.forgetSocket('s1');
    // user bucket (burst 5) still has 2 left
    expect(limiter.check('s1', 'u1', 'control')).toBe('ok');
  });
});

describe('repeat offenders', () => {
  const strict = { ...small, maxViolations: 3, violationWindowMs: 10_000 };

  it('asks to disconnect a socket after N rejected events within the window', () => {
    const limiter = new EventRateLimiter(strict, clock().now);
    limiter.check('s1', 'u1', 'action');
    limiter.check('s1', 'u1', 'action');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('disconnect');
  });

  it('violations outside the window are forgotten', () => {
    const c = clock();
    const limiter = new EventRateLimiter({ ...strict, socket: { ...small.socket, action: { burst: 1, perSec: 0.01 } } }, c.now);
    limiter.check('s1', 'u1', 'action');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    c.advance(10_001);
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('disconnect');
  });

  it('counts violations per socket, across event classes', () => {
    const limiter = new EventRateLimiter({ ...strict, maxViolations: 4 }, clock().now);
    for (let i = 0; i < 2; i++) limiter.check('s1', 'u1', 'action');
    for (let i = 0; i < 3; i++) limiter.check('s1', 'u1', 'control');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'control')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
    expect(limiter.check('s1', 'u1', 'control')).toBe('disconnect');
    // a different socket of another user starts clean
    expect(limiter.check('s2', 'u2', 'action')).toBe('ok');
  });

  it('forgetSocket clears the violation count', () => {
    const limiter = new EventRateLimiter(strict, clock().now);
    for (let i = 0; i < 4; i++) limiter.check('s1', 'u1', 'action');
    limiter.forgetSocket('s1');
    expect(limiter.check('s1', 'u1', 'telemetry')).toBe('ok');
    limiter.check('s1', 'u1', 'action'); // user bucket has 1 left
    expect(limiter.check('s1', 'u1', 'action')).toBe('limited');
  });
});

describe('default limits do not affect normal play', () => {
  it('a 30-minute battle at the web client cadence is never limited', () => {
    // client: typing batch every 2 s, snapshot every 5 s, a run every 10 s, one ready and one submit
    const c = clock();
    const limiter = new EventRateLimiter(DEFAULT_EVENT_LIMITS, c.now);
    expect(limiter.check('s1', 'u1', 'control')).toBe('ok');
    for (let ms = 0; ms <= 30 * 60_000; ms += 1_000) {
      if (ms % 2_000 === 0) expect(limiter.check('s1', 'u1', 'telemetry')).toBe('ok');
      if (ms % 5_000 === 0) expect(limiter.check('s1', 'u1', 'telemetry')).toBe('ok');
      if (ms % 10_000 === 0) expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
      c.advance(1_000);
    }
    expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
  });

  it('a few quick re-runs and a reconnect burst are fine', () => {
    const limiter = new EventRateLimiter(DEFAULT_EVENT_LIMITS, clock().now);
    for (let i = 0; i < 3; i++) expect(limiter.check('s1', 'u1', 'action')).toBe('ok');
    for (let i = 0; i < 5; i++) expect(limiter.check('s1', 'u1', 'control')).toBe('ok');
    for (let i = 0; i < 10; i++) expect(limiter.check('s1', 'u1', 'telemetry')).toBe('ok');
  });

  it('telemetry is limited more loosely than run/submit', () => {
    const d = DEFAULT_EVENT_LIMITS;
    expect(d.socket.telemetry.burst).toBeGreaterThan(d.socket.action.burst);
    expect(d.socket.telemetry.perSec).toBeGreaterThan(d.socket.action.perSec);
    expect(BATTLE_EVENT_CLASSES['battle:typing']).toBe('telemetry');
    expect(BATTLE_EVENT_CLASSES['battle:snapshot']).toBe('telemetry');
    expect(BATTLE_EVENT_CLASSES['battle:run']).toBe('action');
    expect(BATTLE_EVENT_CLASSES['battle:submit']).toBe('action');
    expect(BATTLE_EVENT_CLASSES['battle:ready']).toBe('control');
    expect(BATTLE_EVENT_CLASSES['battle:forfeit']).toBe('control');
  });
});

describe('eventLimitConfigFromEnv', () => {
  it('uses the defaults when nothing is set', () => {
    expect(eventLimitConfigFromEnv({})).toEqual(DEFAULT_EVENT_LIMITS);
  });

  it('reads per-class overrides and the user factor', () => {
    const cfg = eventLimitConfigFromEnv({
      SOCKET_ACTION_BURST: '8',
      SOCKET_ACTION_PER_SEC: '2',
      SOCKET_TELEMETRY_PER_SEC: '1',
      SOCKET_USER_LIMIT_FACTOR: '3',
      SOCKET_MAX_VIOLATIONS: '7',
      SOCKET_VIOLATION_WINDOW_MS: '5000',
    });
    expect(cfg.socket.action).toEqual({ burst: 8, perSec: 2 });
    expect(cfg.user.action).toEqual({ burst: 24, perSec: 6 });
    expect(cfg.socket.telemetry.perSec).toBe(1);
    expect(cfg.user.telemetry.perSec).toBe(3);
    expect(cfg.maxViolations).toBe(7);
    expect(cfg.violationWindowMs).toBe(5000);
  });

  it('ignores invalid numbers and can be turned off', () => {
    const cfg = eventLimitConfigFromEnv({ SOCKET_ACTION_BURST: 'abc', SOCKET_CONTROL_PER_SEC: '-1', SOCKET_RATE_LIMIT: 'off' });
    expect(cfg.socket.action.burst).toBe(DEFAULT_EVENT_LIMITS.socket.action.burst);
    expect(cfg.socket.control.perSec).toBe(DEFAULT_EVENT_LIMITS.socket.control.perSec);
    expect(cfg.enabled).toBe(false);
  });
});
