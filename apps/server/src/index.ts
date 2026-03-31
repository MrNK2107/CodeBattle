import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server, Namespace } from 'socket.io';
import { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';
import { registerBattleHandlers } from './socket/battle';
import { registerMatchmakingHandlers } from './socket/matchmaking';
import { registerWebRtcHandlers } from './socket/webrtc';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
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
