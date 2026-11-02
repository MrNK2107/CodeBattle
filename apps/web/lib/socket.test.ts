import { describe, expect, it, vi } from 'vitest';

import { reviveIfDropped } from './socket';

function fakeSocket(active: boolean) {
  return { active, connect: vi.fn() };
}

describe('reviveIfDropped', () => {
  it('reconnects a socket the server closed for good', () => {
    // after socket.disconnect(true) on the server, socket.io-client sets active = false and stops retrying
    const socket = fakeSocket(false);
    expect(reviveIfDropped(socket as never)).toBe(true);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it('leaves a connected or reconnecting socket alone', () => {
    // active stays true while connected and while socket.io retries a lost connection itself
    const socket = fakeSocket(true);
    expect(reviveIfDropped(socket as never)).toBe(false);
    expect(socket.connect).not.toHaveBeenCalled();
  });
});
