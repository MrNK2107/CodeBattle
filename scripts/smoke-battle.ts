/**
 * End-to-end battle smoke test against a running server (no browser needed).
 *
 *   npm run db:local            # terminal 1
 *   npm run dev:server:local    # terminal 2
 *   npm run smoke:battle        # terminal 3
 *
 * Two bots (alice, bob) queue, get matched, ready up, run and submit. Alice's
 * function answers from a lookup table of the question's small tests (so she
 * passes everything except the generated stress tests); Bob submits the
 * starter code. Expect: Alice wins and her rating goes up. Also checks
 * practice runs, the replay data and one-submission-per-player.
 *
 * SMOKE_BOB_IDLE=1 (with a server started with a short MATCH_DURATION_SECONDS
 * and SUDDEN_DEATH_SECONDS) checks that the clock ends the match on its own.
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { io, type Socket } from 'socket.io-client';
import { functionNameFor, starterCode, type ProblemSignature } from '@codebattle/shared';

const SERVER = process.env.SMOKE_SERVER_URL ?? 'http://localhost:4000';
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) throw new Error('NEXTAUTH_SECRET must be set (run via scripts/with-local-env.mjs)');

const prisma = new PrismaClient();

async function token(userId: string): Promise<string> {
  return new SignJWT({ userId, role: 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
}

async function ensureUser(username: string) {
  return prisma.user.upsert({
    where: { email: `${username}@codebattle.local` },
    // reset so repeated runs stay inside the matchmaking window
    update: { rating: 1200 },
    create: { email: `${username}@codebattle.local`, username, name: username },
  });
}

function connect(tok: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${SERVER}/battle`, { path: '/battle/socket.io', transports: ['websocket'], auth: { token: tok } });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function once<T>(socket: Socket, event: string, timeoutMs = 30_000, filter: (p: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!filter(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function check(condition: unknown, message: string): void {
  if (!condition) throw new Error(`check failed: ${message}`);
  console.log(`  ok  ${message}`);
}

/** A JS solution that answers every non-stress test from a table keyed by its arguments. */
function lookupSolution(signature: ProblemSignature, tests: { input: string; expected: string }[]): string {
  const table: Record<string, unknown> = {};
  for (const t of tests) {
    const expected = JSON.parse(t.expected) as unknown;
    const answer = expected && typeof expected === 'object' && '$oneOf' in expected ? (expected as { $oneOf: unknown[] }).$oneOf[0] : expected;
    table[JSON.stringify(JSON.parse(t.input))] = answer;
  }
  return `const TABLE = ${JSON.stringify(table)};
function norm(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(norm);
  if ('left' in v && 'right' in v) {
    const out = []; const q = [v];
    for (let i = 0; i < q.length; i++) { const n = q[i]; if (!n) { out.push(null); continue; } out.push(n.val); q.push(n.left, n.right); }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }
  if ('next' in v) { const out = []; for (let n = v; n; n = n.next) out.push(n.val); return out; }
  return v;
}
function ${functionNameFor(signature, 'javascript')}(...args) {
  const key = JSON.stringify(args.map(a => (a === null ? [] : norm(a))));
  return key in TABLE ? TABLE[key] : null;
}
`;
}

async function main(): Promise<void> {
  const [alice, bob] = await Promise.all([ensureUser('smoke-alice'), ensureUser('smoke-bob')]);
  console.log(`alice=${alice.rating} bob=${bob.rating}`);
  // leftovers from an interrupted run would block the queue
  await prisma.match.updateMany({
    where: { status: { in: ['WAITING', 'ACTIVE'] }, players: { some: { userId: { in: [alice.id, bob.id] } } } },
    data: { status: 'ABANDONED', endReason: 'cancelled', endedAt: new Date() },
  });

  const [sa, sb] = await Promise.all([connect(await token(alice.id)), connect(await token(bob.id))]);
  const errors: string[] = [];
  for (const [name, s] of [['alice', sa], ['bob', sb]] as const) {
    s.on('error', (e: { code: string; message: string }) => {
      errors.push(`${name}:${e.code}`);
      console.log(`  [${name}] error ${e.code}: ${e.message}`);
    });
  }

  console.log('matchmaking');
  const foundA = once<{ matchId: string; question: { slug: string; title: string }; mode: string }>(sa, 'match:found');
  const foundB = once<{ matchId: string }>(sb, 'match:found');
  sa.emit('queue:join', { difficulty: 'EASY' });
  if (process.env.SMOKE_JOIN_DELAY_MS) await new Promise(r => setTimeout(r, Number(process.env.SMOKE_JOIN_DELAY_MS)));
  sb.emit('queue:join', { difficulty: 'EASY' });
  const found = await foundA;
  check((await foundB).matchId === found.matchId, `both matched into ${found.matchId} (${found.question.title})`);
  check(found.mode === 'RANKED', 'queue matches are ranked');

  console.log('ready');
  const startedA = once<{ endsAt: string }>(sa, 'match:started');
  const stateA = once<{ status: string }>(sa, 'battle:state');
  sa.emit('battle:ready', { matchId: found.matchId });
  check((await stateA).status === 'WAITING', 'first player sees WAITING state');
  sb.emit('battle:ready', { matchId: found.matchId });
  const started = await startedA;
  check(new Date(started.endsAt).getTime() > Date.now(), 'match started with a deadline');

  const question = await prisma.question.findUniqueOrThrow({
    where: { slug: found.question.slug },
    include: { testCases: { orderBy: { position: 'asc' } } },
  });
  const signature = question.signature as unknown as ProblemSignature;
  const small = question.testCases.filter(tc => !tc.label);
  const stress = question.testCases.length - small.length;
  const aliceCode = lookupSolution(signature, small);
  const bobCode = starterCode(signature, 'javascript');

  console.log('run examples');
  const progressB = once<{ passed: number; total: number }>(sb, 'opponent:progress');
  const runResult = once<{ verdict: string; passed: number; total: number }>(sa, 'run:result');
  sa.emit('battle:run', { matchId: found.matchId, code: aliceCode, language: 'javascript' });
  const run = await runResult;
  check(run.verdict === 'ACCEPTED' && run.passed === run.total, `alice passes ${run.passed}/${run.total} examples`);
  const progress = await progressB;
  check(progress.passed === run.passed, 'bob sees alice’s example progress');

  console.log('practice');
  const locked = once<{ code: string }>(sb, 'error', 10_000, e => e.code === 'PRACTICE_LOCKED');
  sb.emit('practice:submit', { slug: found.question.slug, code: bobCode, language: 'javascript' });
  await locked;
  check(true, 'practice is locked for the problem being battled (hidden tests stay hidden)');
  const other = await prisma.question.findFirstOrThrow({ where: { isActive: true, slug: { not: found.question.slug } } });
  const practice = once<{ verdict: string }>(sb, 'practice:result');
  sb.emit('practice:run', { slug: other.slug, code: starterCode(other.signature as unknown as ProblemSignature, 'javascript'), language: 'javascript' });
  check((await practice).verdict !== 'ACCEPTED', `practice on another problem works (${other.slug})`);

  console.log('submit');
  const ended = once<{ winnerId?: string; reason: string; scores: Array<{ userId: string; total: number; ratingAfter?: number }> }>(
    sa,
    'match:ended',
    180_000
  );
  const aliceJudged = once<{ status: string; passedTests: number; totalTests: number }>(sa, 'submission:result', 120_000, p => p.status !== 'PENDING');
  sa.emit('battle:submit', { matchId: found.matchId, code: aliceCode, language: 'javascript' });
  const aliceVerdict = await aliceJudged;
  check(
    aliceVerdict.passedTests >= aliceVerdict.totalTests - stress,
    `alice ${aliceVerdict.status}: ${aliceVerdict.passedTests}/${aliceVerdict.totalTests} hidden (${stress} stress tests not in her table)`
  );

  const dup = once<{ code: string }>(sa, 'error', 10_000, e => e.code === 'ALREADY_SUBMITTED');
  sa.emit('battle:submit', { matchId: found.matchId, code: aliceCode, language: 'javascript' });
  await dup;
  check(true, 'a second submission is refused');

  if (process.env.SMOKE_BOB_IDLE === '1') {
    console.log('  bob stays idle; waiting for the server clock to end the match');
  } else {
    sb.emit('battle:submit', { matchId: found.matchId, code: bobCode, language: 'javascript' });
  }
  const result = await ended;
  check(result.winnerId === alice.id, `alice wins (${result.reason})`);
  if (process.env.SMOKE_BOB_IDLE === '1') check(result.reason === 'timeout', 'the match ended on the clock');

  const [a2, b2, players] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: alice.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: bob.id } }),
    prisma.matchPlayer.findMany({ where: { matchId: found.matchId } }),
  ]);
  for (const s of result.scores) console.log(`  score ${s.userId === alice.id ? 'alice' : 'bob'}: ${s.total.toFixed(1)}`);
  check(a2.rating > alice.rating && b2.rating < bob.rating, `ratings: alice ${alice.rating} -> ${a2.rating}, bob ${bob.rating} -> ${b2.rating}`);
  check(players.every(p => p.ratingBefore !== null && p.ratingAfter !== null), 'rating history recorded');
  const aliceReplay = players.find(p => p.userId === alice.id)?.replay as unknown[] | null;
  check(Array.isArray(aliceReplay) && aliceReplay.length > 0, 'replay frames stored');

  sa.close();
  sb.close();
  check(!errors.some(e => !e.endsWith('ALREADY_SUBMITTED') && !e.endsWith('PRACTICE_LOCKED')), 'no unexpected socket errors');
  console.log('SMOKE OK');
}

main()
  .catch(err => {
    console.error('SMOKE FAILED', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
