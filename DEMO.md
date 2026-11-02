# CodeBattle demo script (about 5 minutes)

Runs entirely on one laptop: no Docker, Redis or Judge0. Postgres comes from `embedded-postgres`, Redis is an in-memory mock, and code runs as local processes (dev only, not a sandbox).

## Setup (once, about 3 minutes)

```bash
npm install
npm run build -w @codebattle/shared
npm run db:local          # terminal 1: Postgres on :54329, leave running (first run generates .local-db/credentials.json)
npm run db:local:setup    # migrate + seed the 56 problems
npm run db:local:demo     # 17 demo players in 4 colleges, 4 recorded battles
npm run dev:server:local  # terminal 2: battle server on :4000
npm run dev:web:local     # terminal 3: web on :3000
```

No passwords or secrets to set: the local scripts generate a random database password and `NEXTAUTH_SECRET` on first run and keep them in the gitignored `.local-db/credentials.json`.

Open http://localhost:3000 in two browser profiles (or one normal and one private window).

## 1. The pitch (30 s), landing page

"Placement season means timed online assessments. Practicing alone has no pressure, and big contests are anonymous. CodeBattle is fight night for code: one opponent near your rating, same problem, same clock. Blue corner is always you, orange is your rival."

Scroll once: the three rounds, the ladder from Bronze to Grandmaster, colleges, ghost races, and the scorecard weights.

## 2. The ladder and colleges (45 s)

- Open **Leaderboard**: the tier distribution bar, the podium (meera, Grandmaster), tiers next to every player.
- Switch to **Colleges & clubs**: IIT Madras leads on the average of its top five. "A club can bring beginners without being punished, and one star can't carry it."
- Click **PSG Tech**: the player list filters to its members.

## 3. A live battle (2 min)

- Window A: **Sign in**, then **Local dev login** as `ada-demo`. Window B: `linus-demo`.
- In window A, open your profile and set the college to `Anna University`. Back in the lobby: "Silver I, 50 points to Gold III", and "Fighting for Anna University".
- Both pick **Easy**, press **Find a battle**. They land in the same battle within a few seconds.
- Point at the versus bar: names, ratings, tiers, the clock. Run examples in A: B's bar shows A's progress, never A's code.
- Optional third window (`carol-demo`): the lobby lists the battle under **Live now**. Open it and the spectator view fills its play-by-play as A runs and submits. "A club can put its final on a projector."
- Submit in A (one final answer, judged on hidden tests incl. large inputs). Then submit in B.
- Results: VICTORY / DEFEAT, rating change, the new tier, the radar and the score table. "Correctness gates everything: a fast wrong answer scores nothing for speed."

## 4. Replay (30 s)

Press **Watch the replay**, or for a richer one open the demo battle *Two Sum: ada against linus* from ada's profile (`/profile/ada`). Drag the slider: changed lines light up in each player's colour. The timeline shows each snapshot and the verdicts; click linus's red "Time limit exceeded" to jump to it. "His nested loop passed the examples and timed out on the large hidden input."

## 5. Ghost race (1 min)

- Window A: **Practice**, open **Two Sum**. The banner offers the fastest recorded battle: "Race meera".
- Press **Race meera**, then **Start race**. The ghost's bar fills as her recorded code grows; her status says "Typing, 3 lines".
- Write (or paste) a hash-map solution and press **Submit**. "You beat meera's ghost by 1:2x." Then **Show ghost code** to compare.
- "Solo practice becomes a race, without needing anyone else online."

## Close (15 s)

"Built for the people who need it: students in placement season and the clubs that train them. Next up: seasons, club-run tournaments and verified college emails." Product brief: `docs/PRODUCT.md`.

## If something goes wrong

- **No ghosts offered:** run `npm run db:local:demo` (needs `db:local:setup` first).
- **Port in use:** `LOCAL_PG_PORT=54339 PORT=4100 ...`; see "Run it locally without Docker" in the README.
- **Java or C++ submissions fail locally:** they need a JDK / `g++` on your PATH. Use Python or JavaScript for the demo.
