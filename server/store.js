// Persistence for leaderboards and global stats.
//
// - If Upstash / Vercel KV Redis env vars are present (KV_REST_API_URL + KV_REST_API_TOKEN,
//   or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), data lives in Redis and
//   survives restarts and is shared across serverless instances.
// - Otherwise it's a JSON file (data/db/store.json; /tmp on serverless hosts), written
//   with debounced atomic writes. On serverless that file is per-instance and temporary.

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 100;
const rank = (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.at - b.at;
const empty = () => ({ leaderboards: {}, answers: {}, roundsPlayed: 0 });

// ---------------------------------------------------------------- Redis backend
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...cmd) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const pairsToObj = (arr) => {
  const o = {};
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
};

const redisStore = {
  async addScore(board, entry) {
    const key = `hail:lb:${board}`;
    const fresh = await redis('HSETNX', 'hail:submitted', entry.id, '1');
    if (!fresh) return { duplicate: true };
    // Higher score first, then faster total time.
    const member = JSON.stringify(entry);
    await redis('ZADD', key, entry.score * 1e9 - entry.totalMs, member);
    const pos = await redis('ZREVRANK', key, member);
    await redis('ZREMRANGEBYRANK', key, 0, -(MAX_ENTRIES + 1));
    return { rank: pos === null || pos >= MAX_ENTRIES ? null : pos + 1 };
  },
  async leaderboard(board, limit) {
    const rows = await redis('ZREVRANGE', `hail:lb:${board}`, 0, limit - 1);
    return rows.map((r, i) => ({ rank: i + 1, ...JSON.parse(r) }));
  },
  async recordAnswer(id, correct) {
    const seen = await redis('HINCRBY', 'hail:seen', id, 1);
    const ok = correct ? await redis('HINCRBY', 'hail:correct', id, 1) : Number((await redis('HGET', 'hail:correct', id)) || 0);
    return { seen, correct: ok };
  },
  async answerStat(id) {
    const [seen, ok] = await Promise.all([redis('HGET', 'hail:seen', id), redis('HGET', 'hail:correct', id)]);
    return { seen: Number(seen || 0), correct: Number(ok || 0) };
  },
  async recordRound() {
    await redis('INCR', 'hail:rounds');
  },
  async globalStats() {
    const [rounds, seenAll, okAll] = await Promise.all([redis('GET', 'hail:rounds'), redis('HVALS', 'hail:seen'), redis('HVALS', 'hail:correct')]);
    const seen = seenAll.reduce((a, b) => a + Number(b), 0);
    const correct = okAll.reduce((a, b) => a + Number(b), 0);
    return { roundsPlayed: Number(rounds || 0), guesses: seen, accuracy: seen ? Math.round((correct / seen) * 100) : null };
  },
  async hardest(n) {
    const [seenRaw, okRaw] = await Promise.all([redis('HGETALL', 'hail:seen'), redis('HGETALL', 'hail:correct')]);
    const seen = pairsToObj(seenRaw);
    const ok = pairsToObj(okRaw);
    return Object.entries(seen)
      .map(([id, s]) => ({ id, seen: Number(s), rate: Math.round((Number(ok[id] || 0) / Number(s)) * 100) }))
      .filter((x) => x.seen >= 3)
      .sort((a, b) => a.rate - b.rate || b.seen - a.seen)
      .slice(0, n);
  },
  flush() {},
};

// ---------------------------------------------------------------- File backend
const serverless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DIR = process.env.DATA_DIR || (serverless ? '/tmp/hail-to-the-guess' : path.join(__dirname, '..', 'data', 'db'));
const FILE = path.join(DIR, 'store.json');

let db = empty();
try {
  db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch {
  /* first run */
}

let timer = null;
function flush() {
  clearTimeout(timer);
  timer = null;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('Could not save scores:', err.message); // keep serving; retry on next change
  }
}
function save() {
  if (serverless) return flush(); // the instance may freeze before a timer fires
  if (!timer) timer = setTimeout(flush, 500);
}

const fileStore = {
  async addScore(board, entry) {
    const list = (db.leaderboards[board] ||= []);
    if (list.some((e) => e.id === entry.id)) return { duplicate: true };
    list.push(entry);
    list.sort(rank);
    const position = list.findIndex((e) => e.id === entry.id) + 1;
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    save();
    return { rank: position <= MAX_ENTRIES ? position : null };
  },
  async leaderboard(board, limit) {
    return (db.leaderboards[board] || []).slice(0, limit).map((e, i) => ({ rank: i + 1, ...e }));
  },
  async recordAnswer(id, correct) {
    const s = (db.answers[id] ||= { seen: 0, correct: 0 });
    s.seen += 1;
    if (correct) s.correct += 1;
    save();
    return { ...s };
  },
  async answerStat(id) {
    return { ...(db.answers[id] || { seen: 0, correct: 0 }) };
  },
  async recordRound() {
    db.roundsPlayed += 1;
    save();
  },
  async globalStats() {
    let seen = 0;
    let correct = 0;
    for (const s of Object.values(db.answers)) {
      seen += s.seen;
      correct += s.correct;
    }
    return { roundsPlayed: db.roundsPlayed, guesses: seen, accuracy: seen ? Math.round((correct / seen) * 100) : null };
  },
  async hardest(n) {
    return Object.entries(db.answers)
      .filter(([, s]) => s.seen >= 3)
      .map(([id, s]) => ({ id, seen: s.seen, rate: Math.round((s.correct / s.seen) * 100) }))
      .sort((a, b) => a.rate - b.rate || b.seen - a.seen)
      .slice(0, n);
  },
  flush,
};

const useRedis = !!(REDIS_URL && REDIS_TOKEN);
module.exports = { ...(useRedis ? redisStore : fileStore), kind: useRedis ? 'redis' : 'file' };
