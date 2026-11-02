// load env before any module reads process.env at import time
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { completeStarterCode, formatArgs, formatValue, type BattleClientToServerEvents, type BattleServerToClientEvents, type ProblemSignature } from '@codebattle/shared';
import { verifySocketToken } from './auth';
import { prisma } from './prisma';
import { requeuePendingSubmissions, startSubmissionWorker, submissionQueue } from './queues/submission';
import { redis } from './redis';
import { closeMatchTimers, restoreMatchTimers, startMatchTimers } from './services/match';
import { getRunner, resolveRunnerKind } from './services/runners';
import { registerBattleHandlers } from './socket/battle';
import { registerMatchmakingHandlers } from './socket/matchmaking';
import { registerPracticeHandlers } from './socket/practice';
import type { BattleNamespace } from './types';

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    role?: string;
  }
}

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.NEXTAUTH_SECRET) {
  console.error('NEXTAUTH_SECRET must be set in production.');
  process.exit(1);
}
// fail fast on an unsafe or misconfigured runner instead of on the first submission
const runner = getRunner();

/** Comma-separated list of web origins allowed to call the API / open sockets. */
const allowedOrigins = (process.env.WEB_ORIGIN ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const corsOrigin = production ? allowedOrigins : true;

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', runner: runner.name, runnerKind: resolveRunnerKind() });
  } catch {
    res.status(503).json({ status: 'degraded', runner: runner.name, database: 'unreachable' });
  }
});

type Wrapped = (req: express.Request, res: express.Response) => Promise<void>;
const route = (fn: Wrapped) => (req: express.Request, res: express.Response) => {
  fn(req, res).catch(error => {
    console.error(`${req.method} ${req.path} failed`, error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
  });
};

/** Visible tests for display: formatted inputs, expected values and explanations. */
function examplesFor(signature: ProblemSignature, tests: { input: string; expected: string; explanation: string | null }[]) {
  return tests.map(tc => ({
    input: formatArgs(signature.params, JSON.parse(tc.input) as unknown[]),
    expected: formatValue(JSON.parse(tc.expected)),
    explanation: tc.explanation ?? undefined,
  }));
}

function publicQuestion(q: {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  description: string;
  tags: string[];
  constraints: string[];
  optimalBigO: string;
  optimalSpace: string;
  starterCode: unknown;
  signature: unknown;
  testCases: { input: string; expected: string; explanation: string | null }[];
}) {
  const signature = q.signature as ProblemSignature;
  return {
    id: q.id,
    title: q.title,
    slug: q.slug,
    difficulty: q.difficulty,
    description: q.description,
    tags: q.tags,
    constraints: q.constraints,
    optimalBigO: q.optimalBigO,
    optimalSpace: q.optimalSpace,
    starterCode: completeStarterCode(q.starterCode, signature),
    signature,
    examples: examplesFor(signature, q.testCases),
  };
}

const visibleTests = { where: { isHidden: false }, orderBy: { position: 'asc' as const } };

app.get(
  '/questions',
  route(async (req, res) => {
    const difficulty = String(req.query.difficulty ?? '').toUpperCase();
    const questions = await prisma.question.findMany({
      where: { isActive: true, ...(['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? { difficulty: difficulty as 'EASY' } : {}) },
      select: { id: true, title: true, slug: true, difficulty: true, tags: true, optimalBigO: true, optimalSpace: true },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });
    res.json(questions);
  })
);

app.get(
  '/questions/:slug',
  route(async (req, res) => {
    const question = await prisma.question.findFirst({
      where: { slug: req.params.slug, isActive: true },
      include: { testCases: visibleTests },
    });
    if (!question || !question.signature) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json(publicQuestion(question));
  })
);

app.get(
  '/matches/:id',
  route(async (req, res) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        question: { include: { testCases: visibleTests } },
        players: { include: { user: { select: { id: true, username: true, name: true, rating: true, avatarUrl: true, image: true } } } },
      },
    });
    if (!match || !match.question.signature) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }
    res.json({
      id: match.id,
      status: match.status,
      mode: match.mode,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      endsAt: match.endsAt,
      endedAt: match.endedAt,
      winnerId: match.winnerId,
      question: publicQuestion(match.question),
      players: match.players.map(p => ({
        userId: p.userId,
        isReady: p.isReady,
        user: { ...p.user, avatarUrl: p.user.avatarUrl ?? p.user.image ?? null, image: undefined },
      })),
    });
  })
);

const server = http.createServer(app);

const io = new Server<BattleClientToServerEvents, BattleServerToClientEvents>(server, {
  cors: { origin: corsOrigin },
  path: '/battle/socket.io',
  maxHttpBufferSize: 256 * 1024,
});

const battleNamespace: BattleNamespace = io.of('/battle');

battleNamespace.use(async (socket, next) => {
  try {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      socket.handshake.headers['authorization']?.toString().replace('Bearer ', '');
    const { userId, role } = await verifySocketToken(token);
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new Error('UNKNOWN_USER');
    socket.data.userId = userId;
    socket.data.role = role;
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
});

registerMatchmakingHandlers(battleNamespace);
registerBattleHandlers(battleNamespace);
registerPracticeHandlers(battleNamespace);
startSubmissionWorker(battleNamespace);
startMatchTimers(battleNamespace);

const PORT = Number(process.env.PORT ?? 4000);

async function main(): Promise<void> {
  await restoreMatchTimers(battleNamespace);
  await requeuePendingSubmissions();
  server.listen(PORT, () => {
    console.log(`[server] listening on :${PORT} (runner: ${runner.name})`);
  });
}

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down`);
  io.close();
  server.close();
  await submissionQueue.close().catch(() => undefined);
  await closeMatchTimers().catch(() => undefined);
  await redis.quit().catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(error => {
  console.error('[server] failed to start', error);
  process.exit(1);
});
