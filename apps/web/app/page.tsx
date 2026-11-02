import Link from 'next/link';

import { DemoBattle } from '@/components/landing/DemoBattle';
import { TierEmblem } from '@/components/ladder/TierBadge';
import { auth } from '@/lib/auth';
import { rankColleges } from '@/lib/colleges';
import { STEPS as LADDER_STEPS, TIERS, standingFor } from '@/lib/ladder';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ROUNDS = [
  { title: 'Match', body: 'Pick a difficulty. You are paired with someone within about 100 rating points, or send a friend a challenge link.' },
  { title: 'Fight', body: 'Same problem, same clock. Python, JavaScript, Java or C++. Run the examples as often as you like, then submit once.' },
  { title: 'Judge', body: 'Hidden tests, including large generated inputs, decide correctness. Speed, efficiency, typing and code quality decide the rest.' },
];

const WEIGHTS = [
  { label: 'Correctness', value: 35, hint: 'Hidden tests passed' },
  { label: 'Speed', value: 25, hint: 'How early you submit' },
  { label: 'Efficiency', value: 20, hint: 'Runtime against your opponent' },
  { label: 'Typing', value: 12, hint: 'Steady typing; pasted code earns nothing' },
  { label: 'Quality', value: 8, hint: 'Shallow nesting, no leftover prints' },
];

export default async function Home(): Promise<JSX.Element> {
  const session = await auth().catch(() => null);
  const signedIn = Boolean(session?.user?.id);
  const [problems, battles, members] = await Promise.all([
    prisma.question.count({ where: { isActive: true } }).catch(() => 0),
    prisma.match.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
    prisma.user
      .findMany({
        where: { totalMatches: { gt: 0 }, collegeSlug: { not: null } },
        select: { username: true, rating: true, wins: true, totalMatches: true, college: true, collegeSlug: true },
        take: 2000,
      })
      .catch(() => []),
  ]);
  const colleges = rankColleges(members)
    .filter(c => c.ranked)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl space-y-28 pt-4">
      <section className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-7 animate-rise-in">
          <p className="kicker flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-you" />
            Blue corner
            <span className="text-faint">vs</span>
            <span className="h-2 w-2 rounded-full bg-rival" />
            Orange corner
          </p>
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Same problem.
            <br />
            Same clock.
            <br />
            <span className="text-you">Better code</span> <span className="text-rival">wins.</span>
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-muted">
            Live 1v1 coding battles for placement season. Get paired with someone at your level, solve the same problem against the same clock,
            and climb a ranked ladder for yourself and your college.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary px-6 py-3 text-base" href={signedIn ? '/app' : '/register'}>
              {signedIn ? 'Start a battle' : 'Step into the ring'}
            </Link>
            <Link className="btn-quiet px-6 py-3 text-base" href={signedIn ? '/practice' : '/login'}>
              {signedIn ? 'Race a ghost first' : 'Sign in'}
            </Link>
          </div>
          <dl className="flex flex-wrap gap-8 border-t border-line pt-5">
            <Fact label="Problems" value={String(problems)} />
            <Fact label="Battles fought" value={String(battles)} />
            <Fact label="Languages" value="4" />
          </dl>
        </div>
        <div className="relative">
          <span aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-you/10 via-transparent to-rival/10 blur-2xl" />
          <DemoBattle />
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <p className="kicker">Three rounds</p>
          <h2 className="text-3xl font-semibold sm:text-4xl">How a battle works</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {ROUNDS.map((step, i) => (
            <li key={step.title} className="panel relative space-y-2 overflow-hidden p-6">
              <span aria-hidden className="absolute -right-2 -top-6 font-display text-[7rem] font-bold leading-none text-raised">
                {i + 1}
              </span>
              <p className="kicker relative text-you">Round {i + 1}</p>
              <h3 className="relative text-2xl font-semibold">{step.title}</h3>
              <p className="relative text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="space-y-3">
          <p className="kicker">Ranked ladder</p>
          <h2 className="text-3xl font-semibold sm:text-4xl">Climb from Bronze to Grandmaster</h2>
          <p className="text-muted">
            Every ranked battle moves your Elo rating. Ratings map to seven tiers and three divisions each, so there is always a next rung in reach.
            Everyone starts at 1200: Silver I, one good win from Gold.
          </p>
        </div>
        <ol className="grid grid-cols-4 gap-3 sm:grid-cols-7" aria-label="Tiers">
          {TIERS.map(tier => {
            const s = standingFor(tier.floor);
            const steps = LADDER_STEPS.filter(st => st.tier.id === tier.id).length;
            return (
              <li key={tier.id} className="panel flex flex-col items-center gap-2 px-2 py-4 text-center">
                <TierEmblem standing={s} size={36} />
                <p className="font-display text-sm font-semibold" style={{ color: tier.color }}>
                  {tier.name}
                </p>
                <p className="text-[11px] tabular-nums text-faint">
                  {tier.floor ? `${tier.floor}+` : 'start'}
                  {steps > 1 ? ' · III–I' : ''}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel relative space-y-3 overflow-hidden p-6">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-you" />
          <p className="kicker">For clubs and campuses</p>
          <h2 className="text-2xl font-semibold">Put your college on the board</h2>
          <p className="text-muted">
            Set your college or club and your ranked battles count for it. Teams are ranked by the average rating of their best five players, so
            bringing beginners never hurts.
          </p>
          {colleges.length ? (
            <ol className="divide-y divide-line rounded-md border border-line bg-well text-sm">
              {colleges.map((c, i) => (
                <li key={c.slug} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    <span className="mr-2 font-display font-semibold text-rival">{i + 1}</span>
                    {c.name}
                  </span>
                  <span className="font-display font-semibold tabular-nums">{c.score}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <Link className="link text-sm" href="/leaderboard?view=colleges">
            College leaderboard &rarr;
          </Link>
        </div>
        <div className="panel relative space-y-3 overflow-hidden p-6">
          <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-rival" />
          <p className="kicker">Practice that pushes back</p>
          <h2 className="text-2xl font-semibold">Race a ghost</h2>
          <p className="text-muted">
            Every battle is recorded. In practice, race the timeline of a past battle on the same problem: watch the ghost&rsquo;s code grow, see
            when it submitted, and try to get accepted first. Afterwards, replay any battle with each change highlighted.
          </p>
          <div className="space-y-2 rounded-md border border-line bg-well p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="kicker">Ghost: ada 1342</span>
              <span className="text-xs text-muted">Typing, 5 lines</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-raised">
              <div className="h-full w-3/5 rounded-full bg-rival/80" />
            </div>
            <p className="text-xs text-pass">You beat ada&rsquo;s ghost by 0:41.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <p className="kicker">Scorecard</p>
          <h2 className="text-3xl font-semibold sm:text-4xl">Judged on more than passing tests</h2>
          <p className="text-muted">
            Correctness gates everything else. A fast answer that fails the hidden tests scores nothing for speed, so a careful solution beats a
            rushed one.
          </p>
        </div>
        <dl className="space-y-4">
          {WEIGHTS.map(w => (
            <div key={w.label} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-4">
              <dt>
                <span className="block font-semibold">{w.label}</span>
                <span className="block text-xs text-faint">{w.hint}</span>
              </dt>
              <div className="h-2 rounded-full bg-raised">
                <div className="h-2 rounded-full bg-gradient-to-r from-you to-you/60" style={{ width: `${(w.value / 35) * 100}%` }} />
              </div>
              <dd className="text-right font-display font-semibold tabular-nums">{w.value}%</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel relative flex flex-wrap items-center justify-between gap-6 overflow-hidden p-8">
        <span aria-hidden className="vs-slash" />
        <div className="relative">
          <h2 className="text-3xl font-semibold">Your next interview is timed. Train like it.</h2>
          <p className="text-muted">Free, and every problem is open for untimed practice too.</p>
        </div>
        <Link className="btn-primary relative px-6 py-3 text-base" href={signedIn ? '/app' : '/register'}>
          {signedIn ? 'Find a battle' : 'Create a free account'}
        </Link>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="stat-num mt-1 text-3xl">{value}</dd>
    </div>
  );
}
