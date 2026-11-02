// Demo data for local screenshots and walkthroughs: players across the ladder, four
// colleges, and finished battles with recorded replays (so ghosts and replays have
// something to show). Never run this against a real database.
//
//   npm run db:local:demo        (after npm run db:local:setup)
//
// Idempotent: demo users are upserted by their @demo.codebattle.local email, and
// their old demo battles are deleted and recreated.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DOMAIN = 'demo.codebattle.local';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
  console.error('seed-demo refuses to run with NODE_ENV=production');
  process.exit(1);
}

const PLAYERS: Array<[username: string, rating: number, college: string | null, wins: number, losses: number]> = [
  ['meera', 2034, 'IIT Madras', 41, 9],
  ['arjun_k', 1812, 'IIT Madras', 30, 12],
  ['kavya', 1688, 'Anna University', 27, 14],
  ['rohan-dev', 1604, 'PSG Tech', 22, 15],
  ['sana', 1561, 'IIT Madras', 19, 13],
  ['vikram', 1488, 'Anna University', 18, 16],
  ['divya_r', 1452, 'PSG Tech', 15, 12],
  ['ada', 1342, 'Anna University', 12, 9],
  ['linus', 1318, 'SSN Coding Club', 10, 9],
  ['farah', 1296, 'PSG Tech', 9, 8],
  ['nikhil', 1264, 'SSN Coding Club', 8, 8],
  ['priya', 1231, 'Anna University', 6, 5],
  ['tom_j', 1188, null, 5, 6],
  ['harini', 1142, 'SSN Coding Club', 4, 6],
  ['zubair', 1083, 'PSG Tech', 3, 6],
  ['leo', 1012, null, 2, 7],
  ['ishaan', 968, 'IIT Madras', 1, 5],
];

const TWO_SUM_STEPS = [
  'class Solution:\n    def twoSum(self, nums, target):\n        ',
  'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n',
  'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n',
  'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n',
  'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n        return []\n',
];

const TWO_SUM_BRUTE = [
  'function twoSum(nums, target) {\n}\n',
  'function twoSum(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n  }\n}\n',
  'function twoSum(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = i + 1; j < nums.length; j++) {\n    }\n  }\n}\n',
  'function twoSum(nums, target) {\n  for (let i = 0; i < nums.length; i++) {\n    for (let j = i + 1; j < nums.length; j++) {\n      if (nums[i] + nums[j] === target) return [i, j];\n    }\n  }\n  return [];\n}\n',
];

const PARENS_STEPS = [
  'class Solution:\n    def isValid(self, s):\n        stack = []\n',
  'class Solution:\n    def isValid(self, s):\n        stack = []\n        pairs = {")": "(", "]": "[", "}": "{"}\n        for c in s:\n',
  'class Solution:\n    def isValid(self, s):\n        stack = []\n        pairs = {")": "(", "]": "[", "}": "{"}\n        for c in s:\n            if c in pairs:\n                if not stack or stack.pop() != pairs[c]:\n                    return False\n            else:\n                stack.append(c)\n        return not stack\n',
];

const PARENS_JS = [
  'function isValid(s) {\n  const stack = [];\n}\n',
  'function isValid(s) {\n  const stack = [];\n  for (const c of s) {\n    if (c === "(") stack.push(")");\n    else if (stack.pop() !== c) return false;\n  }\n}\n',
  'function isValid(s) {\n  const stack = [];\n  for (const c of s) {\n    if (c === "(") stack.push(")");\n    else if (c === "[") stack.push("]");\n    else if (c === "{") stack.push("}");\n    else if (stack.pop() !== c) return false;\n  }\n  return stack.length === 0;\n}\n',
];

interface Side {
  username: string;
  language: string;
  steps: string[];
  /** seconds after the start of each snapshot */
  at: number[];
  submitAt: number;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT';
  passed: number;
  breakdown: { correctness: number; speed: number; efficiency: number; typing: number; quality: number };
  ratingBefore: number;
  ratingAfter: number;
}

interface Battle {
  slug: string;
  daysAgo: number;
  durationSec: number;
  sides: [Side, Side];
}

const total = (b: Side['breakdown']) =>
  Math.round((0.35 * b.correctness + 0.25 * b.speed + 0.2 * b.efficiency + 0.12 * b.typing + 0.08 * b.quality) * 10) / 10;

const BATTLES: Battle[] = [
  {
    slug: 'two-sum',
    daysAgo: 1,
    durationSec: 900,
    sides: [
      { username: 'ada', language: 'python', steps: TWO_SUM_STEPS, at: [8, 40, 75, 130, 170], submitAt: 178, status: 'ACCEPTED', passed: 14, breakdown: { correctness: 100, speed: 80, efficiency: 100, typing: 74, quality: 100 }, ratingBefore: 1328, ratingAfter: 1342 },
      { username: 'linus', language: 'javascript', steps: TWO_SUM_BRUTE, at: [12, 50, 95, 160], submitAt: 236, status: 'TIME_LIMIT', passed: 11, breakdown: { correctness: 79, speed: 58, efficiency: 40, typing: 66, quality: 92 }, ratingBefore: 1332, ratingAfter: 1318 },
    ],
  },
  {
    slug: 'two-sum',
    daysAgo: 3,
    durationSec: 900,
    sides: [
      { username: 'meera', language: 'python', steps: TWO_SUM_STEPS, at: [5, 22, 41, 70, 88], submitAt: 95, status: 'ACCEPTED', passed: 14, breakdown: { correctness: 100, speed: 89, efficiency: 100, typing: 88, quality: 100 }, ratingBefore: 2027, ratingAfter: 2034 },
      { username: 'arjun_k', language: 'python', steps: TWO_SUM_STEPS, at: [9, 35, 60, 104, 131], submitAt: 140, status: 'ACCEPTED', passed: 14, breakdown: { correctness: 100, speed: 84, efficiency: 96, typing: 79, quality: 100 }, ratingBefore: 1819, ratingAfter: 1812 },
    ],
  },
  {
    slug: 'valid-parentheses',
    daysAgo: 2,
    durationSec: 900,
    sides: [
      { username: 'kavya', language: 'python', steps: PARENS_STEPS, at: [15, 80, 190], submitAt: 205, status: 'ACCEPTED', passed: 16, breakdown: { correctness: 100, speed: 77, efficiency: 100, typing: 81, quality: 100 }, ratingBefore: 1676, ratingAfter: 1688 },
      { username: 'rohan-dev', language: 'javascript', steps: PARENS_JS, at: [20, 110, 240], submitAt: 251, status: 'WRONG_ANSWER', passed: 13, breakdown: { correctness: 81, speed: 59, efficiency: 81, typing: 70, quality: 96 }, ratingBefore: 1616, ratingAfter: 1604 },
    ],
  },
  {
    slug: 'valid-parentheses',
    daysAgo: 5,
    durationSec: 900,
    sides: [
      { username: 'priya', language: 'javascript', steps: PARENS_JS, at: [18, 95, 210], submitAt: 222, status: 'ACCEPTED', passed: 16, breakdown: { correctness: 100, speed: 75, efficiency: 100, typing: 70, quality: 100 }, ratingBefore: 1217, ratingAfter: 1231 },
      { username: 'nikhil', language: 'python', steps: PARENS_STEPS, at: [30, 150, 300], submitAt: 320, status: 'ACCEPTED', passed: 16, breakdown: { correctness: 100, speed: 64, efficiency: 92, typing: 68, quality: 100 }, ratingBefore: 1278, ratingAfter: 1264 },
    ],
  },
];

async function main(): Promise<void> {
  const users = new Map<string, string>();
  for (const [username, rating, college, wins, losses] of PLAYERS) {
    const slug = college ? college.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null;
    const data = { username, name: username, rating, college, collegeSlug: slug, wins, losses, totalMatches: wins + losses };
    const user = await prisma.user.upsert({
      where: { email: `${username}@${DOMAIN}` },
      update: data,
      create: { email: `${username}@${DOMAIN}`, ...data },
      select: { id: true },
    });
    users.set(username, user.id);
  }

  const demoIds = [...users.values()];
  const old = await prisma.match.findMany({ where: { players: { some: { userId: { in: demoIds } } } }, select: { id: true } });
  const oldIds = old.map(m => m.id);
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { matchId: { in: oldIds } } }),
    prisma.typingProfile.deleteMany({ where: { matchId: { in: oldIds } } }),
    prisma.matchPlayer.deleteMany({ where: { matchId: { in: oldIds } } }),
    prisma.match.deleteMany({ where: { id: { in: oldIds } } }),
  ]);

  for (const battle of BATTLES) {
    const question = await prisma.question.findUnique({ where: { slug: battle.slug }, select: { id: true } });
    if (!question) {
      console.warn(`[seed-demo] skipping ${battle.slug}: run db:local:setup first`);
      continue;
    }
    const startedAt = new Date(Date.now() - battle.daysAgo * 86_400_000);
    const lastSubmit = Math.max(...battle.sides.map(s => s.submitAt));
    const endedAt = new Date(startedAt.getTime() + lastSubmit * 1000 + 2000);
    const [a, b] = battle.sides;
    const winner = total(a.breakdown) >= total(b.breakdown) ? a : b;

    await prisma.match.create({
      data: {
        questionId: question.id,
        status: 'COMPLETED',
        mode: 'RANKED',
        startedAt,
        endsAt: new Date(startedAt.getTime() + battle.durationSec * 1000),
        endedAt,
        endReason: 'submitted',
        winnerId: users.get(winner.username)!,
        createdAt: startedAt,
        players: {
          create: battle.sides.map(s => ({
            userId: users.get(s.username)!,
            isReady: true,
            finalScore: total(s.breakdown),
            scoreBreakdown: s.breakdown,
            ratingBefore: s.ratingBefore,
            ratingAfter: s.ratingAfter,
            replay: s.steps.map((code, i) => ({
              t: s.at[i] * 1000,
              code,
              language: s.language,
              submitted: i === s.steps.length - 1 ? true : undefined,
            })),
          })),
        },
        submissions: {
          create: battle.sides.map(s => ({
            userId: users.get(s.username)!,
            code: s.steps[s.steps.length - 1],
            language: s.language,
            status: s.status,
            passedTests: s.passed,
            totalTests: battle.slug === 'two-sum' ? 14 : 16,
            runtimeMs: s.status === 'ACCEPTED' ? 3.2 : 41,
            submittedAt: new Date(startedAt.getTime() + s.submitAt * 1000),
            qualityScore: s.breakdown.quality,
          })),
        },
      },
    });
  }
  console.log(`[seed-demo] ${PLAYERS.length} players, ${BATTLES.length} battles`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
