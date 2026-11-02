import type {
  Difficulty,
  FinalScore,
  MatchMode,
  SubmissionStatus,
  QuestionSummary,
  QueueDifficulty,
  RunResult,
  SubmissionResult,
  UserSummary,
} from './types';

// The server identifies the player from the socket's auth token, so payloads never carry a userId.

export interface QueueJoinPayload {
  difficulty: QueueDifficulty;
}

export interface MatchRef {
  matchId: string;
}

export interface CodePayload {
  code: string;
  language: string;
}

export type RunPayload = MatchRef & CodePayload;
export type SubmitPayload = RunPayload;

export interface TypingEvent {
  /** ms since epoch on the client */
  t: number;
  k: 'char' | 'backspace' | 'other';
}

export interface TypingBatchPayload extends MatchRef {
  events: TypingEvent[];
  /** characters inserted by paste since the previous batch */
  pastedChars: number;
}

export type SnapshotPayload = MatchRef & CodePayload;

export interface PracticePayload extends CodePayload {
  slug: string;
}

export interface RoomCreatePayload {
  difficulty: QueueDifficulty;
}

export interface RoomJoinPayload {
  code: string;
}

export interface MatchFoundPayload {
  matchId: string;
  question: QuestionSummary;
  opponent: UserSummary;
  mode: MatchMode;
}

export interface MatchStartedPayload {
  matchId: string;
  startedAt: string;
  endsAt: string;
}

export interface MatchDeadlinePayload {
  matchId: string;
  endsAt: string;
  reason: 'opponent-solved';
}

export type MatchEndReason = 'completed' | 'forfeit' | 'timeout';

export interface MatchEndedPayload {
  matchId: string;
  winnerId?: string;
  scores: FinalScore[];
  reason: MatchEndReason;
}

export interface MatchCancelledPayload {
  matchId: string;
  reason: 'not-ready' | 'cancelled';
}

export type OpponentState = 'typing' | 'running' | 'submitted' | 'forfeited' | 'connected' | 'disconnected';

export interface OpponentStatusPayload {
  matchId: string;
  status: OpponentState;
}

export interface OpponentProgressPayload {
  matchId: string;
  passed: number;
  total: number;
}

export interface RunResultPayload extends RunResult {
  matchId: string;
}

export interface PracticeResultPayload extends RunResult {
  slug: string;
  kind: 'run' | 'submit';
}

/** Sent to a socket when it (re)joins a match so a refreshed page can catch up. */
export interface BattleStatePayload {
  matchId: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  startedAt?: string;
  endsAt?: string;
  readyDeadline?: string;
  submission?: SubmissionResult;
  opponentSubmitted: boolean;
  opponentConnected: boolean;
}

/** One player as a spectator sees them: progress and verdicts, never code. */
export interface SpectatePlayer {
  userId: string;
  username: string;
  rating: number;
  connected: boolean;
  /** latest live state, null before anything happened */
  status: OpponentState | null;
  /** visible examples passed in the latest run */
  passed: number | null;
  total: number | null;
  /** final submission verdict; PENDING while judging, null before submitting */
  verdict: SubmissionStatus | null;
  hiddenPassed: number | null;
  hiddenTotal: number | null;
}

export interface SpectateStatePayload {
  matchId: string;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  mode: MatchMode;
  question: { title: string; slug: string; difficulty: Difficulty };
  startedAt?: string;
  endsAt?: string;
  players: SpectatePlayer[];
  /** spectators currently watching, including you */
  watchers: number;
}

export interface SpectateUpdatePayload {
  matchId: string;
  userId: string;
  status?: OpponentState;
  connected?: boolean;
  passed?: number;
  total?: number;
  verdict?: SubmissionStatus;
  hiddenPassed?: number;
  hiddenTotal?: number;
  /** server time of the event, ms since epoch */
  at: number;
}

export interface RoomCreatedPayload {
  code: string;
}

export interface QueueStatusPayload {
  difficulty: QueueDifficulty;
  /** how far from your rating an opponent can currently be */
  range: number;
  searching: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface BattleServerToClientEvents {
  'queue:status': (payload: QueueStatusPayload) => void;
  'queue:timeout': () => void;
  'match:found': (payload: MatchFoundPayload) => void;
  'battle:state': (payload: BattleStatePayload) => void;
  'match:started': (payload: MatchStartedPayload) => void;
  'match:deadline': (payload: MatchDeadlinePayload) => void;
  'match:ended': (payload: MatchEndedPayload) => void;
  'match:cancelled': (payload: MatchCancelledPayload) => void;
  'opponent:status': (payload: OpponentStatusPayload) => void;
  'opponent:progress': (payload: OpponentProgressPayload) => void;
  'run:result': (payload: RunResultPayload) => void;
  'submission:result': (payload: SubmissionResult) => void;
  'practice:result': (payload: PracticeResultPayload) => void;
  'spectate:state': (payload: SpectateStatePayload) => void;
  'spectate:update': (payload: SpectateUpdatePayload) => void;
  'room:created': (payload: RoomCreatedPayload) => void;
  error: (payload: ErrorPayload) => void;
}

export interface BattleClientToServerEvents {
  'queue:join': (payload: QueueJoinPayload) => void;
  'queue:leave': () => void;
  'battle:ready': (payload: MatchRef) => void;
  'battle:run': (payload: RunPayload) => void;
  'battle:submit': (payload: SubmitPayload) => void;
  'battle:forfeit': (payload: MatchRef) => void;
  'battle:typing': (payload: TypingBatchPayload) => void;
  'battle:snapshot': (payload: SnapshotPayload) => void;
  /** watch a live battle: progress and verdicts only, no code */
  'battle:spectate': (payload: MatchRef) => void;
  'practice:run': (payload: PracticePayload) => void;
  'practice:submit': (payload: PracticePayload) => void;
  'room:create': (payload: RoomCreatePayload) => void;
  'room:join': (payload: RoomJoinPayload) => void;
  'room:cancel': () => void;
}
