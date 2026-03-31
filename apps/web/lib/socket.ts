"use client";

import { io, Socket } from 'socket.io-client';
import { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export const socket: Socket<BattleServerToClientEvents, BattleClientToServerEvents> = io(`${socketUrl}/battle`, {
  autoConnect: true,
  transports: ['websocket']
});
