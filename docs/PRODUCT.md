# CodeBattle: product brief

Fight night for code. Two players, one problem, one clock. Better code wins.

## Who it is for

**Students preparing for campus placements.** Mostly second- to final-year engineering students in India. They have a placement season coming, a list of 150 to 300 "must-do" problems, and online assessments that give them 60 to 90 minutes for two or three problems. Most of them already have a LeetCode account. What they lack is practice under pressure, against a person, with someone keeping score.

**College coding clubs.** Clubs run weekly internal contests, selection rounds for ICPC teams, and freshers' events. Today that means a Codeforces gym or a HackerRank contest link, a spreadsheet for standings, and a lot of manual work. A club wants something its members come back to between events, and a way to see how its college compares with others.

Secondary users: working developers keeping interview skills sharp, and teachers who want a lab activity that students actually enjoy.

## The problem

- **Solo grinding is lonely.** Solving problem 147 alone at 1 a.m. has no stakes and no feedback beyond "Accepted". Motivation drops long before placement season ends.
- **Big contests are anonymous and slow.** A LeetCode weekly or a Codeforces round has tens of thousands of entrants, runs once or twice a week, and gives one rank number at the end. A beginner finishing 18,000th learns very little.
- **Interviews are timed and pressured.** Online assessments and live coding rounds punish freezing up, not just missing knowledge. Untimed practice does not train that.
- **Clubs have no shared home.** Standings live in spreadsheets, and there is no lasting record of who improved or how one college compares with another.

## What CodeBattle is

A real-time 1v1 coding battle. Matchmaking pairs you with someone near your rating. You both get the same problem and the same clock (15, 25 or 40 minutes by difficulty). You can run the visible examples as often as you like; you get one final submission, judged on hidden tests. When one player fully solves the problem, the other has at most five minutes left. Both ratings move.

A battle takes 15 to 40 minutes, so it fits between classes. You can play several in an evening and see your rating move each time.

## Positioning

| | LeetCode contests | Codeforces | CodinGame Clash | CodeBattle |
| --- | --- | --- | --- | --- |
| Format | Weekly/biweekly, thousands of entrants | Rounds several times a week, thousands of entrants | Short multiplayer clashes, up to 8 players | On-demand 1v1, any time |
| Opponent | The whole field | The whole field | Random lobby | One person near your rating |
| Problem style | Interview style, function signatures | Olympiad style, stdin/stdout | Puzzles, often "shortest code" or "reverse" modes | Interview style, function signatures |
| Scoring | Solved count plus time penalty | Points decay with time, penalties | Fastest or shortest correct | Correctness, then speed, efficiency, typing, quality |
| Feedback | Rank after the contest | Rank and rating after the round | Rank after a few minutes | Per-component score breakdown, side-by-side replay |
| Group features | None for colleges | Gyms, groups (manual) | Clans | College and club leaderboard |

Honest take:
- **LeetCode** has a much larger problem bank, editorial content and company tags. CodeBattle does not try to replace it. Its 56 problems are interview staples, and the goal is to make practicing them competitive.
- **Codeforces** is the right place for competitive programmers aiming at ICPC. Its problems are harder and more mathematical than placement interviews, and the rounds are long. CodeBattle is closer to what an online assessment feels like.
- **CodinGame Clash of Code** is the closest in spirit: short, social, real time. Its modes reward code golf and puzzle tricks rather than the data-structure problems placements test, and it does not grade efficiency or code quality.

CodeBattle's niche: interview-style problems, played head to head, with feedback rich enough to learn from.

## Brand

**Concept: fight night for code.** Every battle is a bout with two corners.
- **Blue corner** is always you; **orange corner** is always your rival. The colours are consistent on every screen: versus bar, radar chart, replay tracks, score table.
- **Tale of the tape.** Before and after a bout, the two players are compared side by side: rating, tier, record, language. The results page reads like a scorecard.
- **Type.** Chakra Petch for display (scoreboard numerals, headlines, the clock). IBM Plex Sans for body text. JetBrains Mono for code.
- **Palette.** A near-black arena background with lit panels, so the two corner colours and the green/red verdicts carry the meaning. Gold is reserved for top ranks.
- **Voice.** Short and direct, like a ring announcer reading results, never like a marketing page. "Victory. +16." not "Congratulations on your amazing win!"

## Differentiators

1. **Head to head, near your rating.** Matchmaking starts within ±100 rating and widens every 15 seconds. You always know exactly who you are playing.
2. **Scoring gated by correctness.** `0.35 correctness + 0.25 speed + 0.20 efficiency + 0.12 typing + 0.08 quality`. Every component except correctness is multiplied by the share of hidden tests passed, so a fast wrong answer earns nothing. This rewards the habits interviews reward: get it right, then get it fast.
3. **Hidden tests with stress inputs.** Each problem has generated large inputs, so an O(n²) solution that passes the examples loses to an O(n) one.
4. **Four languages, LeetCode-style signatures.** Python, JavaScript, Java and C++, with `class Solution` starter code, typed parameters, linked lists and trees. Code written here pastes straight into an interview editor.
5. **Replays.** Every finished battle can be scrubbed through, both players' code side by side. Changed lines are highlighted at each step, so you can see where the winner restructured and where you got stuck.
6. **Ranked ladder.** Ratings map to tiers: Bronze, Silver, Gold, Platinum, Diamond, Master and Grandmaster, with divisions III, II and I below Master. The lobby shows your tier, your division and how many points you need for the next one. A number like 1287 means little to a new player; "Silver I, 13 points from Gold" is a goal.
7. **College and club leaderboard.** Players set their college or club on their profile. Colleges are ranked by the average rating of their top five ranked players, so a large college cannot win on headcount and one star cannot carry a college alone. A college is ranked once it has three ranked players; smaller ones are listed as "forming". Clicking a college filters the player leaderboard to its members. Variants like "IIT  Madras" and "iit madras" group under one name. This gives clubs a reason to recruit and a standing to defend.
8. **Spectator mode.** Any signed-in player can watch a live battle: both corners' state, examples passing, verdicts and a play-by-play feed, never code. The lobby lists battles that are live now, so a club can put its final on a projector.
9. **Ghost races in practice.** In practice mode you can race the recorded timeline of a past battle on the same problem; the fastest accepted one is suggested first, and you can also race your own past self. The ghost's progress plays out on your clock: when it started typing, how its code grew, when it submitted. Its code stays hidden until the race is decided. Ghosts are not offered while you are battling on that problem. It turns solo practice into a race without needing a second person online.

## Metrics

**North star: battles completed per weekly active player.** It captures the core loop (come back, find a match, finish it) and drops if matchmaking is slow, battles are abandoned or players lose interest.

Supporting metrics:
- **Time to match** (median and p90 seconds in queue). Over 45 seconds and players leave.
- **Completion rate**: share of started battles that end by submission or clock rather than forfeit or no-show.
- **Day-7 return rate** of players who finished their first battle.
- **Practice to battle conversion**: share of practice-only players who play a ranked battle within a week.
- **Colleges with three or more ranked players**: the threshold for being ranked on the college leaderboard, and a proxy for club adoption.
- **Replay views per completed battle**: whether players use the feedback.

## Roadmap

Near term:
- **Event mode for spectating.** A delay option and a big-screen layout for club finals, plus private battles that can't be watched.
- **Seasons.** Quarterly soft rating resets toward the mean, with season-end tier badges kept on the profile.
- **Club-run tournaments.** A club admin creates a bracket from its members; each round is a normal battle; standings update automatically.
- **Verified college emails.** Confirm college membership through an institutional email domain, so the college leaderboard can't be gamed by anyone typing a college name.

Later:
- A larger problem bank with company-style problem sets.
- Team battles (2v2 on one problem set) for club events.
- Post-battle hints: which hidden test category failed (edge case, large input, wrong type).

## Honest limits

- **One battle-server instance.** Socket rooms, the matchmaking queue and in-memory timers live in one process. Judging scales with `JUDGE_CONCURRENCY` or a faster runner, but the battle server itself does not scale horizontally yet. That is fine for a college or a few thousand concurrent players, not for a global launch.
- **Typing telemetry comes from the browser.** Timestamps are re-anchored to the server clock and impossible bursts are dropped, but a modified client could still fake it. It is 12% of the score.
- **Python timing can be tampered with.** Runtimes are measured inside the player's process, and Python's introspection allows tampering with that measurement. It affects up to the 20% efficiency component. JavaScript and Java are hardened against it.
- **College names are self-declared** until verified college emails ship.
- **Ghost races replay recorded code snapshots, not keystrokes.** The ghost's code appears in steps as it was saved during the battle, not character by character.
- **Email addresses are not verified.** Usernames are what opponents see.
