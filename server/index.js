// Hail to the Guess — game server. Zero dependencies: `node server/index.js`.
//
// The server owns all game state, so answers never reach the browser before you
// guess: portraits are served through one-time opaque tokens, answers are checked
// here, the per-question timer is enforced here, and only finished rounds can be
// posted to the leaderboard.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const presidents = require('../data/presidents');
const { check } = require('./match');
const store = require('./store');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORTRAITS = path.join(ROOT, 'portraits');

const ROUND_SIZE = 10;
const QUESTION_SECONDS = 20;
const GRACE_MS = 2500; // network / animation slack
const ROUND_TTL_MS = 60 * 60 * 1000;
const MAX_ROUNDS = 5000;

const STYLES = {
  choice: 'Multiple Choice',
  type: 'Type It',
};
const CHOICES = 4;

const MODES = {
  classic: { label: 'All-Time', filter: () => true },
  modern: { label: 'Modern Era', filter: (p) => p.numbers[0] >= 26 },
  oldschool: { label: 'Powdered Wigs', filter: (p) => p.numbers[0] <= 25 },
};

const byId = new Map(presidents.map((p) => [p.id, p]));
const rounds = new Map(); // roundId -> round

// Decorative face wall for the home screen. Opaque ids (fresh every boot) so the
// URLs never reveal who's who.
const faceIds = new Map(presidents.map((p) => [crypto.randomBytes(9).toString('base64url'), p.id]));
const imageTokens = new Map(); // token -> { presidentId, expires }

// ---------- helpers ----------
const id = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(data);
}

const fail = (res, status, error) => send(res, status, { error });

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 4096) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// Simple per-IP rate limiter (token bucket).
const buckets = new Map();
function allow(ip, cost = 1, capacity = 60, refillPerSec = 2) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  if (b.tokens < cost) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= cost;
  buckets.set(ip, b);
  return true;
}

function publicPresident(p) {
  return { name: p.name, numbers: p.numbers, years: p.years, party: p.party, fact: p.fact };
}

function cleanName(raw) {
  const name = String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name || 'Anonymous';
}

// Sweep expired rounds & image tokens.
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rounds) if (now - r.createdAt > ROUND_TTL_MS) rounds.delete(k);
  for (const [k, t] of imageTokens) if (now > t.expires) imageTokens.delete(k);
  for (const [k, b] of buckets) if (now - b.at > 10 * 60 * 1000) buckets.delete(k);
}, 60 * 1000).unref();

// ---------- game handlers ----------
function createRound(body) {
  const mode = MODES[body.mode] ? body.mode : 'classic';
  const style = STYLES[body.style] ? body.style : 'choice';
  if (rounds.size >= MAX_ROUNDS) {
    const oldest = rounds.keys().next().value;
    rounds.delete(oldest);
  }
  const pool = presidents.filter(MODES[mode].filter);
  const picks = shuffle(pool).slice(0, ROUND_SIZE).map((p) => p.id);
  const round = {
    id: id(),
    mode,
    style,
    pool: pool.map((p) => p.id),
    options: [],
    picks,
    current: -1, // index of the question currently being shown
    shownAt: 0,
    results: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
    totalMs: 0,
    createdAt: Date.now(),
    submitted: false,
  };
  rounds.set(round.id, round);
  return { roundId: round.id, mode, style, modeLabel: MODES[mode].label, styleLabel: STYLES[style], total: picks.length, secondsPerQuestion: QUESTION_SECONDS };
}

function nextQuestion(round) {
  if (round.current >= 0 && round.results.length <= round.current) {
    // Already showing an unanswered question: hand back the same one (e.g. page hiccup).
    return questionPayload(round);
  }
  const index = round.results.length;
  if (index >= round.picks.length) return { done: true };
  round.current = index;
  round.shownAt = Date.now();
  round.imageToken = id(18);
  imageTokens.set(round.imageToken, { presidentId: round.picks[index], expires: Date.now() + 10 * 60 * 1000 });
  if (round.style === 'choice') round.options[index] = makeOptions(round, round.picks[index]);
  return questionPayload(round);
}

// Distractors come from the same mode pool and, where possible, the same era,
// so the options are plausible (no Washington vs. Obama giveaways).
function makeOptions(round, targetId) {
  const target = byId.get(targetId);
  const others = round.pool.filter((pid) => pid !== targetId).map((pid) => byId.get(pid));
  const near = shuffle(others.filter((p) => Math.abs(p.numbers[0] - target.numbers[0]) <= 8));
  const far = shuffle(others.filter((p) => Math.abs(p.numbers[0] - target.numbers[0]) > 8));
  const picks = [...near, ...far].slice(0, CHOICES - 1);
  return shuffle([target, ...picks]).map((p) => p.name);
}

function questionPayload(round) {
  const elapsed = Date.now() - round.shownAt;
  return {
    index: round.current,
    total: round.picks.length,
    image: `/api/portrait/${round.imageToken}`,
    secondsLeft: Math.max(0, QUESTION_SECONDS - Math.floor(elapsed / 1000)),
    secondsPerQuestion: QUESTION_SECONDS,
    options: round.style === 'choice' ? round.options[round.current] : null,
  };
}

function answer(round, body) {
  const index = Number(body.index);
  if (round.current < 0 || index !== round.current || round.results.length !== index) {
    return { error: 'That question is not active.', status: 409 };
  }
  const p = byId.get(round.picks[index]);
  const elapsed = Date.now() - round.shownAt;
  const timedOut = elapsed > QUESTION_SECONDS * 1000 + GRACE_MS;
  const guess = String(body.guess || '').slice(0, 60);
  let verdict;
  if (timedOut) verdict = { correct: false, almost: false, matchedId: null };
  else if (round.style === 'choice') {
    const picked = presidents.find((x) => x.name === guess && round.options[index].includes(x.name));
    verdict = { correct: picked ? picked.id === p.id : false, almost: false, matchedId: picked ? picked.id : null };
  } else verdict = check(guess, p.id);

  if (verdict.correct) {
    round.score += 1;
    round.streak += 1;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
  } else round.streak = 0;

  const ms = Math.min(elapsed, QUESTION_SECONDS * 1000);
  round.totalMs += ms;
  round.results.push({ id: p.id, guess, correct: verdict.correct, ms });

  // Retire the image token so it can't be reused to look anything up.
  imageTokens.delete(round.imageToken);

  // "Recognition" stats only count typed answers — multiple choice would inflate them.
  const stat = round.style === 'type' ? store.recordAnswer(p.id, verdict.correct) : store.answerStat(p.id);
  const done = round.results.length >= round.picks.length;
  if (done) store.recordRound();

  return {
    correct: verdict.correct,
    almost: verdict.almost,
    timedOut,
    guessedAs: !verdict.correct && verdict.matchedId ? byId.get(verdict.matchedId).name : null,
    president: publicPresident(p),
    globalCorrectRate: stat.seen ? Math.round((stat.correct / stat.seen) * 100) : null,
    ms,
    score: round.score,
    streak: round.streak,
    bestStreak: round.bestStreak,
    answered: round.results.length,
    total: round.picks.length,
    done,
  };
}

function summary(round) {
  return {
    score: round.score,
    total: round.picks.length,
    bestStreak: round.bestStreak,
    totalMs: round.totalMs,
    mode: round.mode,
    modeLabel: MODES[round.mode].label,
    style: round.style,
    styleLabel: STYLES[round.style],
    results: round.results.map((r) => ({ ...publicPresident(byId.get(r.id)), guess: r.guess, correct: r.correct, ms: r.ms })),
  };
}

// ---------- static files ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return fail(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return fail(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- router ----------
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'",
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = req.socket.remoteAddress || 'unknown';

  try {
    if (!p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed');
      return serveStatic(req, res, p);
    }

    if (!p.startsWith('/api/face/') && !allow(ip)) return fail(res, 429, 'Slow down a little!');

    // GET /api/portrait/:token — opaque, one-shot portrait URL
    let m = p.match(/^\/api\/portrait\/([\w-]+)$/);
    if (m && req.method === 'GET') {
      const t = imageTokens.get(m[1]);
      if (!t) return fail(res, 404, 'Gone');
      const file = path.join(PORTRAITS, `${t.presidentId}.jpg`);
      return fs.readFile(file, (err, buf) => {
        if (err) return fail(res, 404, 'Portrait missing — run `npm run portraits`');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': buf.length });
        res.end(buf);
      });
    }

    if (p === '/api/faces' && req.method === 'GET') {
      return send(res, 200, { faces: shuffle([...faceIds.keys()]).map((k) => `/api/face/${k}`) });
    }

    m = p.match(/^\/api\/face\/([\w-]+)$/);
    if (m && req.method === 'GET') {
      const pid = faceIds.get(m[1]);
      if (!pid) return fail(res, 404, 'Not found');
      return fs.readFile(path.join(PORTRAITS, `${pid}.jpg`), (err, buf) => {
        if (err) return fail(res, 404, 'Not found');
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Content-Length': buf.length });
        res.end(buf);
      });
    }

    if (p === '/api/meta' && req.method === 'GET') {
      return send(res, 200, {
        styles: Object.entries(STYLES).map(([key, label]) => ({ key, label })),
        modes: Object.entries(MODES).map(([key, v]) => ({ key, label: v.label, pool: presidents.filter(v.filter).length })),
        roundSize: ROUND_SIZE,
        secondsPerQuestion: QUESTION_SECONDS,
        stats: store.globalStats(),
      });
    }

    if (p === '/api/leaderboard' && req.method === 'GET') {
      const mode = MODES[url.searchParams.get('mode')] ? url.searchParams.get('mode') : 'classic';
      const style = STYLES[url.searchParams.get('style')] ? url.searchParams.get('style') : 'choice';
      return send(res, 200, { mode, style, entries: store.leaderboard(`${mode}:${style}`, 20) });
    }

    if (p === '/api/hall-of-shame' && req.method === 'GET') {
      return send(res, 200, { hardest: store.hardest(5).map((h) => ({ name: byId.get(h.id).name, rate: h.rate, seen: h.seen })) });
    }

    if (p === '/api/rounds' && req.method === 'POST') {
      if (!allow(ip + ':round', 1, 20, 0.2)) return fail(res, 429, 'Too many new rounds — take a breath.');
      return send(res, 201, createRound(await readJson(req)));
    }

    m = p.match(/^\/api\/rounds\/([\w-]+)\/(next|answer|summary|submit)$/);
    if (m) {
      const round = rounds.get(m[1]);
      if (!round) return fail(res, 404, 'Round not found or expired.');
      const action = m[2];

      if (action === 'next' && req.method === 'POST') return send(res, 200, nextQuestion(round));

      if (action === 'answer' && req.method === 'POST') {
        const r = answer(round, await readJson(req));
        return r.error ? fail(res, r.status, r.error) : send(res, 200, r);
      }

      if (action === 'summary' && req.method === 'GET') {
        if (round.results.length < round.picks.length) return fail(res, 409, 'Round still in progress.');
        return send(res, 200, summary(round));
      }

      if (action === 'submit' && req.method === 'POST') {
        if (round.results.length < round.picks.length) return fail(res, 409, 'Finish the round first.');
        if (round.submitted) return fail(res, 409, 'Already on the board.');
        const body = await readJson(req);
        round.submitted = true;
        const entry = {
          id: round.id,
          name: cleanName(body.name),
          score: round.score,
          total: round.picks.length,
          bestStreak: round.bestStreak,
          totalMs: round.totalMs,
          at: Date.now(),
        };
        const board = `${round.mode}:${round.style}`;
        const rank = store.addScore(board, entry);
        return send(res, 201, { rank, entries: store.leaderboard(board, 20), you: round.id });
      }
    }

    fail(res, 404, 'Unknown endpoint');
  } catch (err) {
    if (!res.headersSent) fail(res, err.status || 500, err.status ? err.message : 'Server error');
    if (!err.status) console.error(err);
  }
});

// Warn early if portraits haven't been downloaded.
const missing = presidents.filter((pr) => !fs.existsSync(path.join(PORTRAITS, `${pr.id}.jpg`)));
if (missing.length) console.warn(`⚠  ${missing.length} portraits missing. Run: npm run portraits`);

server.listen(PORT, () => {
  console.log(`\n  🇺🇸  Hail to the Guess is live →  http://localhost:${PORT}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    store.flush();
    process.exit(0);
  });
}
