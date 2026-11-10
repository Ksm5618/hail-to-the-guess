# 🇺🇸 Hail to the Guess

Name the U.S. president from the portrait. 10 faces per round, 1 point each, 20 seconds per face.

## Play

```bash
npm start
```

Then open **http://localhost:3000**. No `npm install` needed — zero dependencies, just Node 18+.

## Features

- **3 modes** — All-Time (all 45), Modern Era (T. Roosevelt →), Powdered Wigs (first 25)
- **Forgiving answers** — typos, missing middle initials, last names and nicknames (JFK, FDR, Ike, Dubya, Teddy…) all count, but it won't accept an ambiguous "Adams" or "Bush"
- **Gamified** — countdown ring, streak flames, confetti, synthesized sound effects, card-flip reveals with a fun fact, rank titles from *Tourist* to *Founding Legend*, shareable 🟩🟥 result
- **Leaderboards** per mode (score, then speed), plus global stats and a "Hall of Shame" of the least-recognized presidents
- **Keyboard** — `Enter` to play / continue, `Esc` to pass, `M` to mute

## How the backend works

`server/index.js` is a plain Node HTTP server that owns all game state, so the browser can't cheat:

- Answers never reach the browser before you guess. Portraits are served from opaque one-time URLs (`/api/portrait/<token>`), not by filename.
- Guesses are checked on the server (`server/match.js`), and the 20-second timer is enforced there too.
- Questions must be answered in order, and only finished rounds can be posted to the leaderboard, once.
- Per-IP rate limiting, request size limits, and security headers (CSP etc.) are built in.
- Scores and stats are saved to `data/db/store.json`. Writes are batched and atomic.

| Endpoint | Purpose |
|---|---|
| `GET /api/meta` | modes, global stats |
| `POST /api/rounds` `{mode}` | start a round |
| `POST /api/rounds/:id/next` | get the next question (image token + timer) |
| `POST /api/rounds/:id/answer` `{index, guess}` | check your guess, get the reveal |
| `GET /api/rounds/:id/summary` | results of a finished round |
| `POST /api/rounds/:id/submit` `{name}` | put a finished round on the leaderboard |
| `GET /api/leaderboard?mode=` | top 20 |
| `GET /api/hall-of-shame` | the least-recognized presidents |

## Other commands

```bash
npm test              # answer-matching tests
npm run dev           # auto-restart on file changes
npm run portraits     # re-download portraits from Wikipedia (add -- --force to overwrite)
PORT=8080 npm start   # different port
```

## Deploying

It's one Node process with no build step, so any Node host works: Render, Railway, Fly.io, or a VPS. Set the start command to `npm start`. The host provides `PORT`. To keep leaderboards across deploys, point `DATA_DIR` at a persistent disk.

Portraits come from Wikipedia / Wikimedia Commons. Most are public-domain official portraits.
