import { Socket } from 'socket.io';
import {
  BattleClientToServerEvents,
  BattleServerToClientEvents,
  runSchema,
  submitSchema,
  readySchema,
  keystrokeSchema,
  forfeitSchema
} from '@codebattle/shared';
import { BattleNamespace } from '../index';

export function registerBattleHandlers(namespace: BattleNamespace): void {
  namespace.on('connection', socket => {
    socket.on('battle:ready', payload => handleReady(socket, payload));
    socket.on('battle:run', payload => handleRun(socket, payload));
    socket.on('battle:submit', payload => handleSubmit(namespace, socket, payload));
    socket.on('battle:forfeit', payload => handleForfeit(namespace, socket, payload));
    socket.on('keystroke:event', payload => handleKeystroke(socket, payload));
  });
}

function handleReady(
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = readySchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid ready payload' });
    return;
  }
  socket.emit('match:started', { matchId: parsed.data.matchId, startedAt: new Date().toISOString() });
}

function handleRun(
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = runSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid run payload' });
    return;
  }

  const results = [
    {
      input: '1 2',
      expected: '3',
      output: '3',
      passed: true,
      runtimeMs: 12,
      memoryKb: 1024
    }
  ];
  socket.emit('run:result', { results });
}

function handleSubmit(
  namespace: BattleNamespace,
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = submitSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid submit payload' });
    return;
  }

  const summary = {
    matchId: parsed.data.matchId,
    userId: parsed.data.userId,
    status: 'ACCEPTED' as const,
    passedTests: 8,
    totalTests: 8,
    runtimeMs: 120,
    memoryKb: 2048
  };

  socket.emit('submission:result', summary);
  socket.broadcast.emit('opponent:status', { status: 'submitted' });
  namespace.emit('match:ended', {
    matchId: parsed.data.matchId,
    winnerId: parsed.data.userId,
    scores: [
      {
        matchId: parsed.data.matchId,
        userId: parsed.data.userId,
        total: 90,
        breakdown: { correctness: 35, speed: 25, efficiency: 18, typing: 7, quality: 5 }
      }
    ]
  });
}

function handleForfeit(
  namespace: BattleNamespace,
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = forfeitSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid forfeit payload' });
    return;
  }
  socket.broadcast.emit('opponent:status', { status: 'forfeited' });
  namespace.emit('match:ended', {
    matchId: parsed.data.matchId,
    winnerId: undefined,
    scores: []
  });
}

function handleKeystroke(
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = keystrokeSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid keystroke payload' });
    return;
  }
  socket.broadcast.emit('opponent:status', { status: 'typing' });
}
