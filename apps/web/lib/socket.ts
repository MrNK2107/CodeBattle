"use client";

import { io, Socket } from 'socket.io-client';
import type { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export type BattleSocket = Socket<BattleServerToClientEvents, BattleClientToServerEvents>;

let socketPromise: Promise<{ socket: BattleSocket; userId: string }> | null = null;

async function fetchToken(): Promise<{ token: string; userId: string }> {
  const res = await fetch('/api/socket-token', { cache: 'no-store' });
  if (!res.ok) throw new Error('Not signed in');
  return (await res.json()) as { token: string; userId: string };
}

/**
 * The server ends a socket for good (`socket.disconnect(true)`, e.g. after repeated rate-limit
 * violations) and socket.io never reconnects on its own after that. The connection is shared by
 * every page in the tab, so open it again when a page asks for it instead of handing out a dead one.
 * Returns true when it reconnected.
 */
export function reviveIfDropped(socket: Pick<BattleSocket, 'active' | 'connect'>): boolean {
  if (socket.active) return false;
  socket.connect();
  return true;
}

/**
 * One shared connection to the battle namespace per tab. The auth callback
 * runs on every (re)connect, so an expired token is replaced transparently.
 */
export function getBattleSocket(): Promise<{ socket: BattleSocket; userId: string }> {
  if (!socketPromise) {
    socketPromise = (async () => {
      const { userId } = await fetchToken();
      const socket: BattleSocket = io(`${SOCKET_URL}/battle`, {
        path: '/battle/socket.io',
        transports: ['websocket'],
        auth: cb => {
          fetchToken()
            .then(({ token }) => cb({ token }))
            .catch(() => cb({}));
        },
      });
      return { socket, userId };
    })().catch(error => {
      socketPromise = null;
      throw error;
    });
  }
  return socketPromise.then(shared => {
    reviveIfDropped(shared.socket);
    return shared;
  });
}
