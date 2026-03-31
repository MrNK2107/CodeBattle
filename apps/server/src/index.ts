import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server, Namespace } from 'socket.io';
import { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';
import { registerBattleHandlers } from './socket/battle';
import { registerMatchmakingHandlers } from './socket/matchmaking';
import { registerWebRtcHandlers } from './socket/webrtc';
import { prisma } from './prisma';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.get('/questions', async (req, res) => {
  const { difficulty } = req.query;

  const questions = await prisma.question.findMany({
    where: difficulty ? { difficulty: String(difficulty).toUpperCase() as any } : undefined,
    select: {
      id: true,
      title: true,
      slug: true,
      difficulty: true,
      tags: true,
      optimalBigO: true,
      optimalSpace: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(questions);
});

app.get('/questions/:slug', async (req, res) => {
  const { slug } = req.params;

  const question = await prisma.question.findUnique({
    where: { slug },
    include: {
      testCases: {
        where: { isHidden: false },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  res.json(question);
});

const server = http.createServer(app);

export type BattleNamespace = Namespace<BattleClientToServerEvents, BattleServerToClientEvents>;

const io = new Server<BattleClientToServerEvents, BattleServerToClientEvents>(server, {
  cors: { origin: '*' },
  path: '/battle/socket.io'
});

const battleNamespace: BattleNamespace = io.of('/battle');

io.on('connection', socket => {
  console.log('client connected', socket.id);
});

registerMatchmakingHandlers(battleNamespace);
registerBattleHandlers(battleNamespace);
registerWebRtcHandlers(battleNamespace);

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
