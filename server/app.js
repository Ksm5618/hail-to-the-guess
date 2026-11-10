// Hail to the Guess — API request handler. Zero dependencies.
//
// Stateless by design so it runs on serverless hosts (Vercel) as well as a plain
// Node server: each round's state lives in an AES-256-GCM encrypted token that the
// browser holds but can't read or alter. The answers never reach the browser before
// you guess, portraits are served through opaque encrypted URLs, guesses and the
// 20-second timer are checked here, and only finished rounds reach the leaderboard.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const presidents = require('../data/presidents');
const { check } = require('./match');
const store = require('./store');
const sim = require('./sim/engine');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORTRAITS = path.join(ROOT, 'portraits');

const ROUND_SIZE = 10;
const QUESTION_SECONDS = 20;
const GRACE_MS = 2500; // network / animation slack
const ROUND_TTL_MS = 60 * 60 * 1000;
const CHOICES = 4;

const STYLES = { choice: 'Multiple Choice', type: 'Type It' };
const MODES = {
  classic: { label: 'All-Time', filter: () => true },
  modern: { label: 'Modern Era', filter: (p) => p.numbers[0] >= 26 },
  oldschool: { label: 'Powdered Wigs', filter: (p) => p.numbers[0] <= 25 },
};

// ---------- crypto ----------
// Key must be identical on every server instance. Set GAME_SECRET in production;
// otherwise fall back to host-provided ids (not in the repo), else a per-boot random key.
const KEY = crypto
  .createHash('sha256')
  .update(
    process.env.GAME_SECRET ||
      [process.env.VERCEL_PROJECT_ID, process.env.RENDER_SERVICE_ID].filter(Boolean).join(':') ||
      crypto.randomBytes(32).toString('hex'),
  )
  .digest();

function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}

function open(token) {
  try {
    const buf = Buffer.from(String(token || ''), 'base64url');
    if (buf.length < 29) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

// ---------- helpers ----------
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}
const fail = (res, status, error) => send(res, status, { error });

function readJson(req) {
  if (req.body !== undefined) {
    // Some hosts (Vercel) pre-parse the body.
    if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
      return Promise.resolve(raw ? JSON.parse(raw) : {});
    } catch {
      return Promise.reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
    }
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 16384) {
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

// Per-IP rate limiter (token bucket, per instance — best effort on serverless).
const buckets = new Map();
function allow(ip, cost = 1, capacity = 60, refillPerSec = 2) {
  const now = Date.now();
  const b = buckets.get(ip) || { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  buckets.set(ip, b);
  if (b.tokens < cost) return false;
  b.tokens -= cost;
  if (buckets.size > 10000) buckets.clear();
  return true;
}

// Each round token is spent once it's been used to move forward, so an old token
// can't be replayed to retry a question (best effort: per instance on serverless).
const spent = new Map();
function spend(nonce) {
  if (spent.has(nonce)) return false;
  spent.set(nonce, Date.now());
  if (spent.size > 50000) {
    const cutoff = Date.now() - ROUND_TTL_MS;
    for (const [k, t] of spent) if (t < cutoff) spent.delete(k);
  }
  return true;
}

const publicPresident = (p) => ({ name: p.name, numbers: p.numbers, years: p.years, party: p.party, fact: p.fact });

function cleanName(raw) {
  const name = String(raw || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name || 'Anonymous';
}

// ---------- round state ----------
// Compact state: presidents referenced by array index.
// { id, n (nonce), m mode, s style, k picks[], o options[][], c current, t shownAt,
//   r results [[idx, correct, ms, guess]], sc score, st streak, bs bestStreak, ms totalMs, at createdAt }
const P = presidents;
const nameIdx = new Map(P.map((p, i) => [p.name, i]));

function issue(st) {
  st.n = crypto.randomBytes(9).toString('base64url');
  return seal(st);
}

function loadRound(token) {
  const st = open(token);
  if (!st || !st.k) return { error: 'Round not found or expired.', status: 404 };
  if (Date.now() - st.at > ROUND_TTL_MS) return { error: 'Round expired — start a new one.', status: 410 };
  return { st };
}

function createRound(body) {
  const mode = MODES[body.mode] ? body.mode : 'classic';
  const style = STYLES[body.style] ? body.style : 'choice';
  const pool = P.map((p, i) => i).filter((i) => MODES[mode].filter(P[i]));
  const st = {
    id: crypto.randomBytes(9).toString('base64url'),
    m: mode,
    s: style,
    k: shuffle(pool).slice(0, ROUND_SIZE),
    o: [],
    c: -1,
    t: 0,
    r: [],
    sc: 0,
    st: 0,
    bs: 0,
    ms: 0,
    at: Date.now(),
  };
  return {
    token: issue(st),
    roundId: st.id,
    mode,
    style,
    modeLabel: MODES[mode].label,
    styleLabel: STYLES[style],
    total: st.k.length,
    secondsPerQuestion: QUESTION_SECONDS,
  };
}

// Distractors come from the same mode pool and, where possible, the same era,
// so the options are plausible (no Washington vs. Obama giveaways).
function makeOptions(mode, target) {
  const others = P.map((p, i) => i).filter((i) => i !== target && MODES[mode].filter(P[i]));
  const num = (i) => P[i].numbers[0];
  const near = shuffle(others.filter((i) => Math.abs(num(i) - num(target)) <= 8));
  const far = shuffle(others.filter((i) => Math.abs(num(i) - num(target)) > 8));
  return shuffle([target, ...[...near, ...far].slice(0, CHOICES - 1)]);
}

function questionPayload(st, token) {
  const elapsed = Date.now() - st.t;
  return {
    token,
    index: st.c,
    total: st.k.length,
    image: `/api/portrait/${seal({ p: st.k[st.c], e: st.t + ROUND_TTL_MS })}`,
    secondsLeft: Math.max(0, QUESTION_SECONDS - Math.floor(elapsed / 1000)),
    secondsPerQuestion: QUESTION_SECONDS,
    options: st.s === 'choice' ? st.o[st.c].map((i) => P[i].name) : null,
  };
}

function nextQuestion(st, token) {
  // Already showing an unanswered question (e.g. page hiccup): hand back the same one.
  if (st.c >= 0 && st.r.length <= st.c) return questionPayload(st, token);
  const index = st.r.length;
  if (index >= st.k.length) return { done: true, token };
  st.c = index;
  st.t = Date.now();
  if (st.s === 'choice') st.o[index] = makeOptions(st.m, st.k[index]);
  return questionPayload(st, issue(st));
}

async function answer(st, body) {
  const index = Number(body.index);
  if (st.c < 0 || index !== st.c || st.r.length !== index) return { error: 'That question is not active.', status: 409 };
  if (!spend(st.n)) return { error: 'That answer was already locked in.', status: 409 };

  const target = st.k[index];
  const p = P[target];
  const elapsed = Date.now() - st.t;
  const timedOut = elapsed > QUESTION_SECONDS * 1000 + GRACE_MS;
  const guess = String(body.guess || '').slice(0, 60);

  let verdict;
  if (timedOut) verdict = { correct: false, almost: false, matchedIdx: null };
  else if (st.s === 'choice') {
    const picked = nameIdx.has(guess) && st.o[index].includes(nameIdx.get(guess)) ? nameIdx.get(guess) : null;
    verdict = { correct: picked === target, almost: false, matchedIdx: picked };
  } else {
    const v = check(guess, p.id);
    verdict = { correct: v.correct, almost: v.almost, matchedIdx: v.matchedId ? P.findIndex((x) => x.id === v.matchedId) : null };
  }

  if (verdict.correct) {
    st.sc += 1;
    st.st += 1;
    st.bs = Math.max(st.bs, st.st);
  } else st.st = 0;

  const ms = Math.min(elapsed, QUESTION_SECONDS * 1000);
  st.ms += ms;
  st.r.push([target, verdict.correct ? 1 : 0, ms, guess]);

  // "Recognition" stats only count typed answers — multiple choice would inflate them.
  const stat = st.s === 'type' ? await store.recordAnswer(p.id, verdict.correct) : await store.answerStat(p.id);
  const done = st.r.length >= st.k.length;
  if (done) await store.recordRound();

  return {
    token: issue(st),
    correct: verdict.correct,
    almost: verdict.almost,
    timedOut,
    guessedAs: !verdict.correct && verdict.matchedIdx !== null && verdict.matchedIdx >= 0 ? P[verdict.matchedIdx].name : null,
    president: publicPresident(p),
    globalCorrectRate: stat.seen ? Math.round((stat.correct / stat.seen) * 100) : null,
    ms,
    score: st.sc,
    streak: st.st,
    bestStreak: st.bs,
    answered: st.r.length,
    total: st.k.length,
    done,
  };
}

function summary(st) {
  return {
    score: st.sc,
    total: st.k.length,
    bestStreak: st.bs,
    totalMs: st.ms,
    mode: st.m,
    modeLabel: MODES[st.m].label,
    style: st.s,
    styleLabel: STYLES[st.s],
    results: st.r.map(([i, ok, ms, guess]) => ({ ...publicPresident(P[i]), guess, correct: !!ok, ms })),
  };
}

// ---------- static files (local server only; Vercel serves /public itself) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function serveStatic(res, pathname) {
  let rel;
  try {
    rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return fail(res, 400, 'Bad path');
  }
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return fail(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return fail(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

function sendPortrait(res, idx, cache) {
  const p = P[idx];
  if (!p) return fail(res, 404, 'Not found');
  fs.readFile(path.join(PORTRAITS, `${p.id}.jpg`), (err, buf) => {
    if (err) return fail(res, 404, 'Portrait missing — run `npm run portraits`');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': cache, 'Content-Length': buf.length });
    res.end(buf);
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

async function handle(req, res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

  try {
    if (!p.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed');
      return serveStatic(res, p);
    }

    if (!p.startsWith('/api/face/') && !allow(ip)) return fail(res, 429, 'Slow down a little!');

    // Portrait for the current question — encrypted, so the URL says nothing.
    let m = p.match(/^\/api\/portrait\/([\w-]+)$/);
    if (m && req.method === 'GET') {
      const t = open(m[1]);
      if (!t || Date.now() > t.e) return fail(res, 404, 'Gone');
      return sendPortrait(res, t.p, 'private, max-age=600');
    }

    // Decorative face wall for the home screen.
    if (p === '/api/faces' && req.method === 'GET') {
      return send(res, 200, { faces: shuffle(P.map((_, i) => i)).map((i) => `/api/face/${seal({ f: i })}`) });
    }
    m = p.match(/^\/api\/face\/([\w-]+)$/);
    if (m && req.method === 'GET') {
      const t = open(m[1]);
      if (!t || typeof t.f !== 'number') return fail(res, 404, 'Not found');
      return sendPortrait(res, t.f, 'public, max-age=86400, immutable');
    }

    if (p === '/api/meta' && req.method === 'GET') {
      return send(res, 200, {
        styles: Object.entries(STYLES).map(([key, label]) => ({ key, label })),
        modes: Object.entries(MODES).map(([key, v]) => ({ key, label: v.label, pool: P.filter(v.filter).length })),
        roundSize: ROUND_SIZE,
        secondsPerQuestion: QUESTION_SECONDS,
        stats: await store.globalStats(),
      });
    }

    if (p === '/api/leaderboard' && req.method === 'GET') {
      const mode = MODES[url.searchParams.get('mode')] ? url.searchParams.get('mode') : 'classic';
      const style = STYLES[url.searchParams.get('style')] ? url.searchParams.get('style') : 'choice';
      return send(res, 200, { mode, style, entries: await store.leaderboard(`${mode}:${style}`, 20) });
    }

    if (p === '/api/hall-of-shame' && req.method === 'GET') {
      const hardest = await store.hardest(5);
      return send(res, 200, { hardest: hardest.map((h) => ({ name: P.find((x) => x.id === h.id).name, rate: h.rate, seen: h.seen })) });
    }

    if (p === '/api/rounds' && req.method === 'POST') {
      if (!allow(ip + ':round', 1, 20, 0.2)) return fail(res, 429, 'Too many new rounds — take a breath.');
      return send(res, 201, createRound(await readJson(req)));
    }

    m = p.match(/^\/api\/round\/(next|answer|summary|submit)$/);
    if (m && req.method === 'POST') {
      const body = await readJson(req);
      const { st, error, status } = loadRound(body.token);
      if (error) return fail(res, status, error);
      const action = m[1];

      if (action === 'next') return send(res, 200, nextQuestion(st, body.token));

      if (action === 'answer') {
        const r = await answer(st, body);
        return r.error ? fail(res, r.status, r.error) : send(res, 200, r);
      }

      if (st.r.length < st.k.length) return fail(res, 409, 'Finish the round first.');

      if (action === 'summary') return send(res, 200, summary(st));

      if (action === 'submit') {
        if (!spend(`submit:${st.id}`)) return fail(res, 409, 'Already on the board.');
        const entry = { id: st.id, name: cleanName(body.name), score: st.sc, total: st.k.length, bestStreak: st.bs, totalMs: st.ms, at: Date.now() };
        const board = `${st.m}:${st.s}`;
        const result = await store.addScore(board, entry);
        if (result.duplicate) return fail(res, 409, 'Already on the board.');
        return send(res, 201, { rank: result.rank, entries: await store.leaderboard(board, 20), you: st.id });
      }
    }

    // ---------------- Oval Office (be the president) ----------------
    if (p === '/api/sim/meta' && req.method === 'GET') {
      return send(res, 200, {
        parties: Object.entries(sim.PARTIES).map(([key, v]) => ({ key, ...v })),
        backgrounds: Object.entries(sim.BACKGROUNDS).map(([key, v]) => ({ key, label: v.label, emoji: v.emoji, blurb: v.blurb, perk: v.perk })),
        states: sim.STATES.map(([abbr, name, ev, , col, row]) => ({ abbr, name, ev, col, row })),
      });
    }

    if (p === '/api/sim/leaderboard' && req.method === 'GET') {
      return send(res, 200, { entries: await store.leaderboard('sim', 20) });
    }

    if (p === '/api/sim/start' && req.method === 'POST') {
      if (!allow(ip + ':sim', 1, 20, 0.2)) return fail(res, 429, 'Too many new games — take a breath.');
      const body = await readJson(req);
      const s = sim.newGame(body);
      return send(res, 201, { token: issue(s), state: sim.view(s), card: sim.cardView(s) });
    }

    if (p === '/api/sim/choose' && req.method === 'POST') {
      const body = await readJson(req);
      const s = open(body.token);
      if (!s || !s.m) return fail(res, 404, 'Game not found — start a new term.');
      if (s.ended) return fail(res, 409, 'Your presidency is over.');
      const choice = Number(body.choice);
      if (!Number.isInteger(choice) || choice < -1 || choice > 3) return fail(res, 400, 'Invalid choice.');
      if (spent.has(s.n)) return fail(res, 409, 'That decision was already made.');
      const out = sim.choose(s, choice);
      if (out.error) return fail(res, 409, out.error); // failed attempts don't burn the token
      spend(s.n);
      return send(res, 200, { token: issue(s), outcome: out, state: sim.view(s), card: s.ended ? null : sim.cardView(s) });
    }

    if (p === '/api/sim/post' && req.method === 'POST') {
      const body = await readJson(req);
      const s = open(body.token);
      if (!s || !s.m) return fail(res, 404, 'Game not found — start a new term.');
      if (spent.has(s.n)) return fail(res, 409, 'That action was already taken.');
      const out = sim.post(s, String(body.tone || ''));
      if (out.error) return fail(res, 409, out.error);
      spend(s.n);
      return send(res, 200, { token: issue(s), post: out, state: sim.view(s), card: s.ended ? null : sim.cardView(s) });
    }

    if (p === '/api/sim/submit' && req.method === 'POST') {
      const body = await readJson(req);
      const s = open(body.token);
      if (!s || !s.m) return fail(res, 404, 'Game not found.');
      if (!s.ended) return fail(res, 409, 'Finish your presidency first.');
      if (!spend(`simsubmit:${s.id}`)) return fail(res, 409, 'Already in the Hall of Legacies.');
      const legacy = sim.legacyOf(s);
      const entry = { id: s.id, name: cleanName(body.name || s.name), score: legacy.score, total: 100, totalMs: 0, tier: legacy.tier, emoji: legacy.emoji, outcome: s.ended, party: s.party, at: Date.now() };
      const result = await store.addScore('sim', entry);
      if (result.duplicate) return fail(res, 409, 'Already in the Hall of Legacies.');
      return send(res, 201, { rank: result.rank, entries: await store.leaderboard('sim', 20), you: s.id });
    }

    fail(res, 404, 'Unknown endpoint');
  } catch (err) {
    if (!res.headersSent) fail(res, err.status || 500, err.status ? err.message : 'Server error');
    if (!err.status) console.error(err);
  }
}

module.exports = { handle, PORTRAITS };
