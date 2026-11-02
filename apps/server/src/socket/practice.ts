import { practiceSchema } from '@codebattle/shared';
import { prisma } from '../prisma';
import { judge } from '../services/judge';
import { loadQuestion, toDisplayResults } from '../services/questions';
import type { BattleNamespace } from '../types';
import { judgeLimiter, parsePayload, safe, type BattleSocket } from './context';

/**
 * Solo practice: unranked runs against any active question. A practice submit
 * judges every test and reveals the first failing hidden one, since there's
 * no opponent to protect.
 */
export function registerPracticeHandlers(namespace: BattleNamespace): void {
  namespace.on('connection', socket => {
    const userId = socket.data.userId!;
    socket.on('practice:run', safe(socket, 'practice:run', p => handlePractice(socket, userId, p, 'run')));
    socket.on('practice:submit', safe(socket, 'practice:submit', p => handlePractice(socket, userId, p, 'submit')));
  });
}

async function handlePractice(socket: BattleSocket, userId: string, payload: unknown, kind: 'run' | 'submit'): Promise<void> {
  const data = parsePayload(socket, practiceSchema, payload);
  if (!data) return;
  const question = await loadQuestion({ slug: data.slug });
  if (!question || !question.isActive) {
    socket.emit('error', { code: 'NOT_FOUND', message: 'Problem not found' });
    return;
  }
  // practice judges hidden tests, so it's closed for a problem you're battling on right now
  const live = await prisma.match.findFirst({
    where: { questionId: question.id, status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId } } },
    select: { id: true },
  });
  if (live) {
    socket.emit('error', { code: 'PRACTICE_LOCKED', message: 'You are in a battle on this problem. Practice opens again when it ends.' });
    return;
  }
  const release = judgeLimiter.acquire(userId);
  if (typeof release === 'string') {
    socket.emit('error', { code: 'RATE_LIMITED', message: release });
    return;
  }
  try {
    const tests = kind === 'run' ? question.visible : [...question.visible, ...question.hidden];
    let result;
    try {
      result = await judge(question.signature, data.language, data.code, tests);
    } catch (error) {
      console.error('practice judge failed', error);
      socket.emit('error', { code: 'JUDGE_UNAVAILABLE', message: 'The judge is unavailable right now. Please try again.' });
      return;
    }
    const display = toDisplayResults(question.signature, tests, result.outcomes);
    // for a submit, show the examples plus the first failing hidden test only
    const shown =
      kind === 'run'
        ? display
        : [...display.slice(0, question.visible.length), ...display.slice(question.visible.length).filter(r => !r.passed).slice(0, 1)];
    // Persist first: the practice page reloads ghost code once an accepted attempt exists.
    if (kind === 'submit') {
      await prisma.practiceAttempt.create({
        data: {
          userId,
          questionId: question.id,
          language: data.language,
          status: result.verdict,
          passedTests: result.passed,
          totalTests: result.total,
          runtimeMs: result.runtimeMs,
        },
      });
    }
    socket.emit('practice:result', {
      slug: question.slug,
      kind,
      verdict: result.verdict,
      passed: result.passed,
      total: result.total,
      message: result.message,
      results: shown,
    });
  } finally {
    release();
  }
}
