export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QueueDifficulty = Difficulty | 'ANY';

export type MatchStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type MatchMode = 'RANKED' | 'FRIENDLY';
export type SubmissionStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR';

export type TestOutcomeStatus = 'passed' | 'wrong' | 'error' | 'timeout' | 'not_run';

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

/** One test as shown to a player: inputs and values are pre-formatted for display. */
export interface TestCaseResult {
  index: number;
  input: string;
  expected: string;
  actual?: string;
  status: TestOutcomeStatus;
  passed: boolean;
  stdout?: string;
  error?: string;
  runtimeMs?: number;
}

export interface RunResult {
  verdict: Exclude<SubmissionStatus, 'PENDING'>;
  passed: number;
  total: number;
  results: TestCaseResult[];
  /** compile error / missing function */
  message?: string;
}

export interface SubmissionResult {
  matchId: string;
  userId: string;
  status: SubmissionStatus;
  passedTests: number;
  totalTests: number;
  runtimeMs?: number;
  memoryKb?: number;
  message?: string;
  /** first failing hidden test; only sent to the player who submitted */
  failedTest?: TestCaseResult;
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
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface TypingProfileMetrics {
  avgWpm: number;
  wpmVariance: number;
  backspaceRate: number;
  avgPauseMs: number;
  burstCount: number;
}
