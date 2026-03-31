import { FinalScore, QuestionSummary, QueueDifficulty, SubmissionResult, TestCaseResult, UserSummary } from './types';

export interface QueueJoinPayload {
  userId: string;
  difficulty: QueueDifficulty;
}

export interface QueueLeavePayload {
  userId: string;
}

export interface RunPayload {
  matchId: string;
  userId: string;
  code: string;
  language: string;
}

export interface SubmitPayload extends RunPayload {}

export interface ForfeitPayload {
  matchId: string;
  userId: string;
}

export interface ReadyPayload {
  matchId: string;
  userId: string;
}

export interface KeystrokeEventPayload {
  matchId: string;
  userId: string;
  key: string;
  timestamp: number;
  type: 'keydown' | 'keyup';
}

export interface WebRtcSignalPayload {
  matchId: string;
  to: string;
  sdp?: string;
  candidate?: unknown;
}

export interface MatchFoundPayload {
  matchId: string;
  question: QuestionSummary;
  opponent: UserSummary;
}

export interface MatchEndedPayload {
  matchId: string;
  winnerId?: string;
  scores: FinalScore[];
}

export interface OpponentStatusPayload {
  status: 'typing' | 'running' | 'submitted' | 'forfeited';
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface BattleServerToClientEvents {
  'match:found': (payload: MatchFoundPayload) => void;
  'match:started': (payload: { matchId: string; startedAt: string }) => void;
  'match:ended': (payload: MatchEndedPayload) => void;
  'opponent:status': (payload: OpponentStatusPayload) => void;
  'submission:result': (payload: SubmissionResult) => void;
  'run:result': (payload: { results: TestCaseResult[] }) => void;
  error: (payload: ErrorPayload) => void;
}

export interface BattleClientToServerEvents {
  'queue:join': (payload: QueueJoinPayload) => void;
  'queue:leave': (payload: QueueLeavePayload) => void;
  'battle:ready': (payload: ReadyPayload) => void;
  'battle:submit': (payload: SubmitPayload) => void;
  'battle:run': (payload: RunPayload) => void;
  'battle:forfeit': (payload: ForfeitPayload) => void;
  'keystroke:event': (payload: KeystrokeEventPayload) => void;
  'webrtc:offer': (payload: WebRtcSignalPayload) => void;
  'webrtc:answer': (payload: WebRtcSignalPayload) => void;
  'webrtc:ice': (payload: WebRtcSignalPayload) => void;
}
