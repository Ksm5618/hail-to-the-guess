// Answer matching: forgiving about typos, punctuation, middle initials and
// nicknames, but strict about which president you meant (John Adams ≠ John Quincy Adams).

const presidents = require('../data/presidents');

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,'’"`\-_/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(president|pres|potus|mr)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const tolerance = (alias) => (alias.length <= 4 ? 0 : alias.length <= 7 ? 1 : 2);

// Last names shared by two presidents can't be used alone.
const lastNameCount = {};
for (const p of presidents) {
  const last = normalize(p.name).split(' ').pop();
  lastNameCount[last] = (lastNameCount[last] || 0) + 1;
}
const AMBIGUOUS = new Set(Object.keys(lastNameCount).filter((k) => lastNameCount[k] > 1));

// Build alias table: [{ alias, id }]
const table = [];
const byId = new Map();
for (const p of presidents) {
  byId.set(p.id, p);
  const full = normalize(p.name);
  const tokens = full.split(' ');
  const last = tokens[tokens.length - 1];
  const set = new Set([full, ...p.aliases.map(normalize)]);
  set.add(tokens.filter((t, i) => i === 0 || i === tokens.length - 1 || t.length > 1).join(' ')); // keep real middle names
  set.add(`${tokens[0]} ${last}`); // drop middle initials/names
  if (!AMBIGUOUS.has(last)) set.add(last);
  for (const alias of set) if (alias) table.push({ alias, id: p.id });
}

/**
 * @returns {{ correct: boolean, almost: boolean, matchedId: string|null }}
 */
function check(guess, targetId) {
  const g = normalize(guess);
  if (!g) return { correct: false, almost: false, matchedId: null };

  let best = Infinity;
  let bestIds = new Set();
  for (const { alias, id } of table) {
    const d = levenshtein(g, alias);
    if (d > tolerance(alias)) continue;
    if (d < best) {
      best = d;
      bestIds = new Set([id]);
    } else if (d === best) bestIds.add(id);
  }

  const target = byId.get(targetId);
  const targetLast = normalize(target.name).split(' ').pop();
  if (bestIds.size === 1 && bestIds.has(targetId)) return { correct: true, almost: false, matchedId: targetId };

  const almost = AMBIGUOUS.has(targetLast) && levenshtein(g, targetLast) <= 1;
  const matchedId = bestIds.size === 1 ? [...bestIds][0] : null;
  return { correct: false, almost, matchedId };
}

module.exports = { check, normalize };
