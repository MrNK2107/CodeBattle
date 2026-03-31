import { Socket } from 'socket.io';
import { queueJoinSchema, queueLeaveSchema } from '@codebattle/shared';
import { BattleClientToServerEvents, BattleServerToClientEvents, QueueDifficulty } from '@codebattle/shared';
import { BattleNamespace } from '../index';

const queues: Record<QueueDifficulty, Set<string>> = {
  EASY: new Set(),
  MEDIUM: new Set(),
  HARD: new Set(),
  ANY: new Set()
};

export function registerMatchmakingHandlers(namespace: BattleNamespace): void {
  namespace.on('connection', socket => {
    socket.on('queue:join', payload => handleJoin(namespace, socket, payload));
    socket.on('queue:leave', payload => handleLeave(socket, payload));
  });
}

function handleJoin(
  namespace: BattleNamespace,
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = queueJoinSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid queue join payload' });
    return;
  }

  const { userId, difficulty } = parsed.data;
  queues[difficulty].add(userId);
  const opponentId = findOpponent(difficulty, userId);

  if (opponentId) {
    const matchId = `match_${Date.now()}`;
    namespace.to([socket.id]).emit('match:found', {
      matchId,
      question: {
        id: 'placeholder',
        title: 'Pending question',
        slug: 'pending',
        difficulty: difficulty === 'ANY' ? 'EASY' : difficulty,
        tags: []
      },
      opponent: { id: opponentId, username: 'opponent', rating: 1200 }
    });
  }
}

function handleLeave(
  socket: Socket<BattleClientToServerEvents, BattleServerToClientEvents>,
  payload: unknown
): void {
  const parsed = queueLeaveSchema.safeParse(payload);
  if (!parsed.success) {
    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Invalid queue leave payload' });
    return;
  }

  const { userId } = parsed.data;
  Object.values(queues).forEach(set => set.delete(userId));
}

function findOpponent(difficulty: QueueDifficulty, userId: string): string | undefined {
  const pool = queues[difficulty];
  for (const id of pool) {
    if (id !== userId) {
      pool.delete(id);
      pool.delete(userId);
      return id;
    }
  }
  return undefined;
}
