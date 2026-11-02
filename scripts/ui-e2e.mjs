// Headless two-player UI battle + screenshots (isolated Chromium via playwright-core).
//
// Prereqs: local DB, server (npm run dev:server:local) and web (npm run dev:web:local) running,
// and a Playwright Chromium in the default cache (npx playwright install chromium).
//
//   node scripts/with-local-env.mjs node scripts/ui-e2e.mjs      (WEB_URL defaults to :3000)
import { chromium } from 'playwright-core';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const OUT = path.resolve(process.env.SHOT_DIR ?? 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
const prisma = new PrismaClient();

async function player(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', e => console.log(`[${name}] pageerror`, e.message));
  await page.goto(`${WEB}/login?callbackUrl=/app`);
  await page.getByLabel('Username').fill(name);
  await page.getByRole('button', { name: 'Enter' }).click();
  await page.waitForURL(url => new URL(url).pathname === '/app'); // not /login?callbackUrl=/app
  return page;
}

/** Same bot as scripts/smoke-battle.ts: answers the small tests from a lookup table. */
function lookupSolution(functionName, tests) {
  const table = {};
  for (const t of tests) {
    const expected = JSON.parse(t.expected);
    table[JSON.stringify(JSON.parse(t.input))] = expected && typeof expected === 'object' && '$oneOf' in expected ? expected.$oneOf[0] : expected;
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
function ${functionName}(...args) {
  const key = JSON.stringify(args.map(a => (a === null ? [] : norm(a))));
  return key in TABLE ? TABLE[key] : null;
}
`;
}

const editorReady = page => page.waitForFunction(() => window.monaco?.editor?.getModels().length > 0, null, { timeout: 45_000 });
const setCode = (page, code) => page.evaluate(c => window.monaco.editor.getModels()[0].setValue(c), code);

try {
  const landing = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await landing.goto(WEB);
  await landing.waitForTimeout(6000); // let the demo battle type out
  await shot(landing, 'landing', false);
  const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await mobile.goto(WEB);
  await shot(mobile, 'landing-mobile');
  await mobile.goto(`${WEB}/login`);
  await mobile.getByLabel('Username').waitFor();
  await shot(mobile, 'login-mobile');

  const suffix = Date.now().toString(36).slice(-4);
  const alice = await player(`ada-${suffix}`);
  const bob = await player(`linus-${suffix}`);
  for (const p of [alice, bob]) await p.getByRole('radiogroup', { name: 'Difficulty', exact: true }).getByRole('radio', { name: 'Easy' }).click();
  await shot(alice, 'lobby');

  await alice.getByRole('button', { name: 'Find a battle' }).click();
  await alice.getByText(/Looking for an opponent|rating points/).waitFor({ timeout: 10_000 });
  await bob.getByRole('button', { name: 'Find a battle' }).click();
  await Promise.all([alice.waitForURL('**/battle/**', { timeout: 30_000 }), bob.waitForURL('**/battle/**', { timeout: 30_000 })]);
  const matchId = alice.url().split('/battle/')[1].split('/')[0];
  console.log('matched:', matchId);

  await alice.getByRole('timer').waitFor({ timeout: 30_000 });
  await Promise.all([editorReady(alice), editorReady(bob)]);

  // a third player watches live: progress and verdicts only, never code
  const carol = await player(`carol-${suffix}`);
  await carol.goto(`${WEB}/battle/${matchId}/watch`);
  await carol.getByText('Tale of the tape').waitFor({ timeout: 30_000 });
  await carol.getByRole('timer').waitFor({ timeout: 30_000 });

  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { question: { include: { testCases: { orderBy: { position: 'asc' } } } } },
  });
  const code = lookupSolution(match.question.signature.functionName, match.question.testCases.filter(tc => !tc.label));
  await alice.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'JavaScript' }).click();
  await alice.waitForFunction(() => window.monaco.editor.getModels()[0].getLanguageId() === 'javascript');
  await setCode(alice, code);
  await alice.getByRole('button', { name: 'Run examples' }).click();
  const examples = match.question.testCases.filter(tc => !tc.isHidden).length;
  await alice.getByText(`${examples} of ${examples} tests passed`).waitFor({ timeout: 30_000 });
  await bob.waitForTimeout(800);
  await shot(alice, 'battle', false);
  await shot(bob, 'battle-rival', false);
  await carol.getByText(/passes \d+\/\d+ examples/).waitFor({ timeout: 15_000 });
  if ((await carol.content()).includes('const TABLE')) throw new Error('spectator received code');
  await shot(carol, 'spectate', false);

  await alice.getByRole('button', { name: 'Submit final answer' }).click();
  await alice.getByRole('alertdialog').getByRole('button', { name: 'Submit' }).click();
  await alice.getByText(/hidden tests/).first().waitFor({ timeout: 60_000 });
  await shot(alice, 'battle-submitted', false);

  // Bob really types (keyboard events), which must reach the server as typing telemetry
  await bob.locator('.monaco-editor').first().click();
  await bob.keyboard.press('Control+End');
  await bob.keyboard.type('\n# trying a linear scan first\n', { delay: 90 });
  await bob.waitForTimeout(2500); // one telemetry batch interval
  await bob.getByRole('button', { name: 'Submit final answer' }).click();
  await bob.getByRole('alertdialog').getByRole('button', { name: 'Submit' }).click();

  await Promise.all([alice.waitForURL('**/results', { timeout: 90_000 }), bob.waitForURL('**/results', { timeout: 90_000 })]);
  await carol.getByText(/Battle over/).waitFor({ timeout: 30_000 });
  console.log('spectator saw the battle end');
  await alice.waitForTimeout(2000); // radar chart animation
  await shot(alice, 'results');
  const aliceHeadline = await alice.getByRole('heading', { level: 1 }).textContent();
  const bobHeadline = await bob.getByRole('heading', { level: 1 }).textContent();
  console.log('alice headline:', aliceHeadline, '| bob headline:', bobHeadline);
  if (aliceHeadline !== 'Victory' || bobHeadline !== 'Defeat') throw new Error('unexpected result headlines');

  const bobUser = await prisma.user.findFirstOrThrow({ where: { username: `linus-${suffix}` } });
  const typing = await prisma.typingProfile.findUnique({ where: { userId_matchId: { userId: bobUser.id, matchId } } });
  console.log('bob typing profile:', typing ? `${Math.round(typing.avgWpm)} wpm over ${typing.keystrokeEvents.length} keys` : 'missing');
  if (!typing || typing.avgWpm <= 0) throw new Error('typing telemetry was not recorded');

  await alice.getByRole('link', { name: 'Watch the replay' }).click();
  await alice.waitForURL('**/replay');
  await alice.getByRole('slider', { name: 'Replay position' }).press('End');
  await shot(alice, 'replay', false);

  await alice.goto(`${WEB}/practice`);
  await shot(alice, 'practice');
  await alice.goto(`${WEB}/practice/${match.question.slug}`);
  await editorReady(alice);
  await shot(alice, 'practice-problem', false);

  // college: set it on the profile, then it shows on the college leaderboard
  await alice.goto(`${WEB}/profile/ada-${suffix}`);
  await alice.getByLabel('College or club').fill('Anna University');
  await alice.getByRole('button', { name: 'Save' }).click();
  await alice.getByText('Saved.', { exact: false }).waitFor({ timeout: 15_000 });
  await alice.waitForTimeout(1200);
  await shot(alice, 'profile');
  await alice.goto(`${WEB}/leaderboard`);
  await shot(alice, 'leaderboard');
  await alice.goto(`${WEB}/leaderboard?view=colleges`);
  await alice.getByRole('link', { name: 'Anna University' }).first().waitFor({ timeout: 10_000 });
  await shot(alice, 'leaderboard-colleges');
  await alice.goto(`${WEB}/app`);
  await shot(alice, 'lobby-after');

  // demo data (npm run db:local:demo): a richer replay and a ghost race on Two Sum
  const demo = await prisma.match.findFirst({
    where: { status: 'COMPLETED', question: { slug: 'two-sum' }, players: { some: { user: { username: 'ada' } } } },
    select: { id: true },
  });
  if (demo) {
    await alice.goto(`${WEB}/battle/${demo.id}/replay`);
    const slider = alice.getByRole('slider', { name: 'Replay position' });
    await slider.focus();
    for (let i = 0; i < 520; i++) await slider.press('ArrowRight'); // 130 s in (250 ms steps)
    await shot(alice, 'replay', false);

    await alice.goto(`${WEB}/practice/two-sum`);
    await alice.getByRole('link', { name: /^Race / }).click();
    await alice.getByRole('button', { name: 'Start race' }).waitFor({ timeout: 30_000 });
    await editorReady(alice);
    await alice.getByRole('button', { name: 'Start race' }).click();
    await alice.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'JavaScript' }).click();
    await alice.waitForFunction(() => window.monaco.editor.getModels()[0].getLanguageId() === 'javascript');
    await setCode(
      alice,
      'function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n',
    );
    await alice.waitForTimeout(6000); // let the ghost type a little
    await alice.getByRole('button', { name: 'Submit', exact: true }).click();
    await alice.getByText(/beat .* ghost/).waitFor({ timeout: 60_000 });
    await shot(alice, 'ghost-race', false);
    console.log('ghost race won');
  } else {
    console.log('no demo battles: run npm run db:local:demo for the replay and ghost race screenshots');
  }

  const mobileBattle = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await mobileBattle.goto(`${WEB}/leaderboard`);
  await shot(mobileBattle, 'leaderboard-mobile');

  console.log(`UI E2E OK, screenshots in ${OUT}`);
} catch (error) {
  console.error('UI E2E FAILED', error);
  let i = 0;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      const file = path.join(os.tmpdir(), `codebattle-ui-fail-${i++}.png`);
      await p.screenshot({ path: file, fullPage: true }).catch(() => undefined);
      console.error(`  page ${p.url()} -> ${file}`);
    }
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await browser.close();
}
