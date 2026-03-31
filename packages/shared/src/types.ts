export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QueueDifficulty = Difficulty | 'ANY';

export type MatchStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type SubmissionStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR';

export interface UserSummary {
  id: string;
  username: string;
  rating: number;
  avatarUrl?: string;
}

export interface QuestionSummary {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
}

export interface TestCaseResult {
  input: string;
  expected: string;
  output: string;
  passed: boolean;
  runtimeMs?: number;
  memoryKb?: number;
}

export interface SubmissionResult {
  matchId: string;
  userId: string;
  status: SubmissionStatus;
  passedTests: number;
  totalTests: number;
  runtimeMs?: number;
  memoryKb?: number;
}

export interface ScoreBreakdown {
  correctness: number;
  speed: number;
  efficiency: number;
  typing: number;
  quality: number;
}

export interface FinalScore {
  matchId: string;
  userId: string;
  total: number;
  breakdown: ScoreBreakdown;
}

export interface TypingProfileMetrics {
  avgWpm: number;
  wpmVariance: number;
  backspaceRate: number;
  avgPauseMs: number;
  burstCount: number;
}
