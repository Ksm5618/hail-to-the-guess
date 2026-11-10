// Tiny JSON-file persistence for leaderboards and global stats.
// Writes are debounced and atomic (write temp file, then rename).

const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'db');
const FILE = path.join(DIR, 'store.json');
const MAX_ENTRIES = 100;

fs.mkdirSync(DIR, { recursive: true });

let db = { leaderboards: {}, answers: {}, roundsPlayed: 0 };
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
  if (!timer) timer = setTimeout(flush, 500);
}

const rank = (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.at - b.at;

function addScore(mode, entry) {
  const list = (db.leaderboards[mode] ||= []);
  list.push(entry);
  list.sort(rank);
  const position = list.findIndex((e) => e.id === entry.id) + 1;
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  save();
  return position <= MAX_ENTRIES ? position : null;
}

function leaderboard(mode, limit) {
  return (db.leaderboards[mode] || []).slice(0, limit).map((e, i) => ({ rank: i + 1, ...e }));
}

function recordAnswer(id, correct) {
  const s = (db.answers[id] ||= { seen: 0, correct: 0 });
  s.seen += 1;
  if (correct) s.correct += 1;
  save();
  return s;
}

function answerStat(id) {
  return db.answers[id] || { seen: 0, correct: 0 };
}

function recordRound() {
  db.roundsPlayed += 1;
  save();
}

function globalStats() {
  let seen = 0;
  let correct = 0;
  for (const s of Object.values(db.answers)) {
    seen += s.seen;
    correct += s.correct;
  }
  return { roundsPlayed: db.roundsPlayed, guesses: seen, accuracy: seen ? Math.round((correct / seen) * 100) : null };
}

function hardest(n) {
  return Object.entries(db.answers)
    .filter(([, s]) => s.seen >= 3)
    .map(([id, s]) => ({ id, seen: s.seen, rate: Math.round((s.correct / s.seen) * 100) }))
    .sort((a, b) => a.rate - b.rate || b.seen - a.seen)
    .slice(0, n);
}

module.exports = { addScore, leaderboard, recordAnswer, answerStat, recordRound, globalStats, hardest, flush };
