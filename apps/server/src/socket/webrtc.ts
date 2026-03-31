import { Socket } from 'socket.io';
import { webrtcSignalSchema } from '@codebattle/shared';
import { BattleNamespace } from '../index';
import { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';

export function registerWebRtcHandlers(namespace: BattleNamespace): void {
  namespace.on('connection', socket => {
    socket.on('webrtc:offer', payload => relay(namespace, socket, 'webrtc:offer', payload));
    socket.on('webrtc:answer', payload => relay(namespace, socket, 'webrtc:answer', payload));
    socket.on('webrtc:ice', payload => relay(namespace, socket, 'webrtc:ice', payload));
  });
}

function relay(
  namespace: BattleNamespace,
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice',
  payload: unknown
): void {
  const parsed = webrtcSignalSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid signaling payload' });
    return;
  }

  const { to, ...rest } = parsed.data;
  namespace.to(to).emit(event, { ...rest, to });
}
