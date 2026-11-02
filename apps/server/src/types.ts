import type { Namespace } from 'socket.io';
import type { BattleClientToServerEvents, BattleServerToClientEvents } from '@codebattle/shared';

export type BattleNamespace = Namespace<BattleClientToServerEvents, BattleServerToClientEvents>;
