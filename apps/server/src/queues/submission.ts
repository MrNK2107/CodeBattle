import Bull from 'bull';
import { submitToJudge0 } from '../services/judge0';

interface SubmissionJobData {
  code: string;
  languageId: number;
  testCases: { input: string; expected: string }[];
}

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const submissionQueue = new Bull<SubmissionJobData>('submission-queue', redisUrl);

submissionQueue.process(async job => {
  const { code, languageId, testCases } = job.data;
  const results = [];

  for (const testCase of testCases) {
    const response = await submitToJudge0({
      source_code: code,
      language_id: languageId,
      stdin: testCase.input,
      expected_output: testCase.expected,
      cpu_time_limit: 2,
      memory_limit: 256000
    });
    results.push(response);
  }

  return results;
});
