// "Oval Office" simulation engine. Pure functions over a plain state object, so the
// state can travel inside an encrypted token (no server memory needed).

const crypto = require('crypto');
const CARDS = [...require('./cards'), ...require('./cards_more')];
const econ = require('./econ');

const byId = new Map(CARDS.map((c) => [c.id, c]));
const METERS = ['eco', 'sec', 'dip', 'env', 'uni', 'tre', 'app', 'base'];
const QUARTERS_PER_TERM = 16;
const CAMPAIGN_Q = 14; // quarter index (0-based) of the campaign card in term 1
const DEBATE_Q = 15;

const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

// ---------------------------------------------------------------- setup
const PARTIES = {
  liberty: { label: 'Liberty Party', short: 'Liberty', color: '#ff3d5a', sign: 1, blurb: 'Lower taxes, strong defense, small government.' },
  union: { label: 'Union Party', short: 'Union', color: '#3d7bff', sign: -1, blurb: 'Workers, safety nets, climate action.' },
  independent: { label: 'Independent', short: 'Indie', color: '#ffcc4d', sign: 0, blurb: 'No party machine. No party loyalty.' },
};

const BACKGROUNDS = {
  economist: { label: 'Economist', emoji: '📈', blurb: 'Markets trust you.', fx: { eco: 8, tre: 6 }, perk: 'Economy rolls +10%' },
  general: { label: 'General', emoji: '🎖️', blurb: 'Commanded armies.', fx: { sec: 10, dip: -3 }, perk: 'Security rolls +10%' },
  governor: { label: 'Governor', emoji: '🏛️', blurb: 'You know how to deal.', fx: { uni: 5 }, pc: 15, perk: '+15 political capital' },
  diplomat: { label: 'Diplomat', emoji: '🌐', blurb: 'Every leader\'s number.', fx: { dip: 12 }, perk: 'Diplomacy rolls +10%' },
  outsider: { label: 'Celebrity Outsider', emoji: '⭐', blurb: 'Famous. Untested.', fx: { app: 8, base: 10, uni: -4 }, pc: -10, perk: 'Huge fan base' },
};
const PERK_STAT = { economist: 'eco', general: 'sec', diplomat: 'dip' };

function newGame({ name, party, background }) {
  party = PARTIES[party] ? party : 'liberty';
  background = BACKGROUNDS[background] ? background : 'governor';
  const m = { eco: 55, sec: 55, dip: 55, env: 50, uni: 50, tre: 55, app: 58, base: 65 };
  const bg = BACKGROUNDS[background];
  for (const [k, v] of Object.entries(bg.fx)) m[k] = clamp(m[k] + v);
  if (party === 'independent') m.uni = clamp(m.uni + 6);
  const s = {
    v: 1,
    id: crypto.randomBytes(9).toString('base64url'),
    name: String(name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) || 'Anonymous',
    party,
    bg: background,
    q: 0,
    term: 1,
    m,
    pc: 50 + (bg.pc || 0),
    congress: party !== 'independent', // independents start with divided government
    seats: party !== 'independent' ? 228 : 200,
    flags: [],
    used: [],
    sched: [],
    hist: [],
    card: null,
    ended: null,
    at: Date.now(),
    peak: m.app,
    low: m.app,
    e: econ.newEcon(),
    posted: -1,
  };
  drawCard(s);
  return s;
}

// ---------------------------------------------------------------- card selection
function drawCard(s) {
  s.card = pickCard(s);
  s.shock = econ.applyShock(s.e, s.card);
}

function pickCard(s) {
  const qInTerm = s.q % QUARTERS_PER_TERM;

  // Forced cards: triggered emergencies, scheduled follow-ups, campaign, debate.
  if (s.m.tre <= 12 && !recently(s, 'debt_crisis')) return 'debt_crisis';
  if (s.m.uni <= 12 && !recently(s, 'unrest')) return 'unrest';
  if (s.flags.includes('impeach_risk') && !s.congress && s.m.app < 40 && !s.used.includes('impeachment')) return 'impeachment';

  if (s.term === 1 && qInTerm === CAMPAIGN_Q) return 'campaign';
  if (s.term === 1 && qInTerm === DEBATE_Q) return 'debate';
  const due = s.sched.findIndex(([, q]) => q <= s.q);
  if (due >= 0) {
    const [id] = s.sched.splice(due, 1)[0];
    return id;
  }

  const pool = CARDS.filter((c) => !c.only && !s.used.includes(c.id) && (!c.term || c.term === s.term) && (!c.needs || c.needs(s)));
  // Second-term legacy cards get priority near the end.
  const legacy = pool.filter((c) => c.term === 2);
  if (s.term === 2 && qInTerm >= 10 && legacy.length && rand() < 0.5) return legacy[crypto.randomInt(legacy.length)].id;
  const general = pool.filter((c) => !c.term);
  const list = general.length ? general : pool;
  if (!list.length) return CARDS.find((c) => !c.only).id; // out of content: recycle
  // Avoid two cards of the same category in a row when possible.
  const lastCat = s.hist.length ? byId.get(s.hist[s.hist.length - 1][0]).cat : null;
  const fresh = list.filter((c) => c.cat !== lastCat);
  const from = fresh.length ? fresh : list;
  return from[crypto.randomInt(from.length)].id;
}

const recently = (s, id) => s.hist.slice(-4).some(([c]) => c === id);

// ---------------------------------------------------------------- odds
function billOdds(s) {
  return s.congress ? 0.85 : 0.4;
}

function rollOdds(s, opt) {
  if (!opt.roll) return null;
  let p = opt.roll.p;
  const stat = opt.roll.stat;
  if (stat) p += (s.m[stat] - 50) / 250;
  if (stat && PERK_STAT[s.bg] === stat) p += 0.1;
  return Math.max(0.05, Math.min(0.95, p));
}

// What the client sees for the current card (odds, costs, availability).
function cardView(s) {
  const c = byId.get(s.card);
  if (!c) return null;
  return {
    id: c.id,
    cat: c.cat,
    title: c.title,
    text: c.text,
    adv: c.adv || [],
    shock: s.shock || null,
    options: c.options.map((o, i) => {
      const odds = rollOdds(s, o);
      const bill = o.bill ? billOdds(s) : null;
      return {
        label: o.label,
        desc: o.desc,
        pc: o.pc || 0,
        affordable: (o.pc || 0) <= s.pc,
        odds: odds === null ? null : Math.round(odds * 100),
        bill: bill === null ? null : Math.round(bill * 100),
        hint: hintFor(o),
        usd: econ.priceOf(c.id, i, o),
      };
    }),
  };
}

// Vague direction hints ("Economy ↓↓ · Approval ↑"), not exact numbers.
const LABEL = { eco: 'Economy', sec: 'Security', dip: 'Diplomacy', env: 'Environment', uni: 'Unity', tre: 'Treasury', app: 'Approval', base: 'Base' };
function hintFor(o) {
  const fx = o.fx || {};
  return Object.entries(fx)
    .filter(([, v]) => Math.abs(v) >= 4)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([k, v]) => ({ k, label: LABEL[k], dir: v > 0 ? 1 : -1, big: Math.abs(v) >= 9 }));
}

// ---------------------------------------------------------------- applying a decision
function applyFx(s, fx, deltas) {
  for (const [k, v] of Object.entries(fx || {})) {
    if (!METERS.includes(k)) continue;
    const before = s.m[k];
    s.m[k] = clamp(before + v);
    deltas[k] = (deltas[k] || 0) + (s.m[k] - before);
  }
}

function schedule(s, list) {
  for (const [id, inQ] of list || []) if (!s.sched.some(([x]) => x === id) && !s.used.includes(id)) s.sched.push([id, s.q + inQ]);
}

function choose(s, choiceIdx) {
  if (s.ended) return { error: 'Your presidency is over.' };
  const card = byId.get(s.card);
  const deltas = {};
  const out = { card: card.id, title: card.title, deltas, ok: null, rolled: null, bill: null, news: '', choice: null };

  let opt;
  if (choiceIdx === -1) {
    // Indecision: the clock ran out. The worst of all worlds.
    opt = { fx: { app: -6, uni: -2 }, news: `PRESIDENT DITHERS AS "${card.title.toUpperCase()}" CRISIS DEEPENS` };
    s.pc = Math.max(0, s.pc - 5);
    out.choice = 'Indecision';
  } else {
    opt = card.options[choiceIdx];
    if (!opt) return { error: 'Invalid choice.' };
    if ((opt.pc || 0) > s.pc) return { error: 'Not enough political capital.' };
    s.pc -= opt.pc || 0;
    out.choice = opt.label;
  }

  let fx = { ...(opt.fx || {}) };
  let news = opt.news;
  let flags = [...(opt.flags || [])];
  let sched = [...(opt.sched || [])];

  // Legislation needs Congress.
  if (opt.bill) {
    const p = billOdds(s);
    const passed = rand() < p;
    out.bill = { odds: Math.round(p * 100), passed };
    if (!passed) {
      fx = { app: -3, base: -2 };
      news = `CONGRESS BLOCKS PRESIDENT'S PLAN — "${opt.label.toUpperCase()}" DEAD`;
      flags = [];
      sched = [];
    }
  }

  applyFx(s, fx, deltas);
  const blocked = !!(out.bill && !out.bill.passed);

  if (opt.roll && !blocked) {
    const p = rollOdds(s, opt);
    const ok = rand() < p;
    const r = ok ? opt.roll.ok : opt.roll.bad;
    out.rolled = { odds: Math.round(p * 100), ok };
    out.ok = ok;
    applyFx(s, r.fx, deltas);
    news = r.news || news;
    flags.push(...(r.flags || []));
    sched.push(...(r.sched || []));
  }

  for (const f of flags) if (!s.flags.includes(f)) s.flags.push(f);
  schedule(s, sched);

  // The real-money side: price tag, market reaction, jobs, prices.
  const ec = econ.applyChoice(s.e, card.id, choiceIdx, opt, { blocked, ok: out.ok, deltas });
  out.usd = ec.usd;
  out.econMoved = ec.moved;
  if (!s.used.includes(card.id)) s.used.push(card.id);
  s.hist.push([card.id, choiceIdx, out.ok === null ? (out.bill ? (out.bill.passed ? 1 : 0) : 2) : out.ok ? 1 : 0]);
  out.news = news;

  // Immediate endings from the card itself.
  if (s.flags.includes('removed')) return finish(s, out, 'removed');
  if (s.flags.includes('resigned')) return finish(s, out, 'resigned');

  endOfQuarter(s, deltas);
  s.q += 1;

  // Milestones.
  const qInTerm = s.q % QUARTERS_PER_TERM;
  if (qInTerm === 8) out.event = midterms(s);
  if (s.q === QUARTERS_PER_TERM) {
    const e = election(s);
    out.event = e;
    if (!e.won) return finish(s, out, 'defeated');
    s.term = 2;
    s.pc = Math.min(100, s.pc + 25); // mandate
    s.m.app = clamp(s.m.app + 4); // second honeymoon
    s.flags = s.flags.filter((f) => !f.startsWith('camp_') && f !== 'debate_win');
  }
  if (s.q >= QUARTERS_PER_TERM * 2) return finish(s, out, 'completed');

  // Collapse conditions.
  if (s.m.app <= 8) return finish(s, out, 'collapse');

  drawCard(s);
  return out;
}

// Approval drifts toward what the fundamentals justify; political capital regenerates.
function endOfQuarter(s, deltas) {
  const m = s.m;
  econ.tick(s.e, m);
  // Voters feel the "misery index" (unemployment + inflation) and the price of gas.
  const pain = (econ.misery(s.e) - 7.5) * 1.1 + Math.max(0, s.e.gas - 4) * 2.5;
  const fundamentals = m.eco * 0.4 + m.uni * 0.2 + m.sec * 0.2 + m.dip * 0.08 + m.env * 0.06 + m.tre * 0.06 - pain;
  const honeymoon = s.q < 2 ? 4 : 0;
  const before = m.app;
  m.app = clamp(m.app + (fundamentals + honeymoon - m.app) * 0.18);
  deltas.app = (deltas.app || 0) + (m.app - before);
  // Base cools off toward approval + loyalty.
  const b0 = m.base;
  m.base = clamp(m.base + (Math.min(100, m.app + 15) - m.base) * 0.08);
  deltas.base = (deltas.base || 0) + (m.base - b0);
  // Treasury slowly erodes (interest + mandatory spending), economy feeds revenue.
  const t0 = m.tre;
  m.tre = clamp(m.tre - 0.4 + (m.eco - 50) / 25);
  deltas.tre = (deltas.tre || 0) + (m.tre - t0);
  // Heavy debt drags on the economy (interest payments, investor jitters).
  if (m.tre < 30) {
    const e0 = m.eco;
    m.eco = clamp(m.eco - (30 - m.tre) / 8);
    deltas.eco = (deltas.eco || 0) + (m.eco - e0);
  }
  // Fatigue: every administration wears out its welcome a little.
  if (s.q >= 4) {
    const a0 = m.app;
    m.app = clamp(m.app - 0.6);
    deltas.app = (deltas.app || 0) + (m.app - a0);
  }
  s.pc = Math.min(100, s.pc + 6 + (m.app >= 60 ? 3 : 0) + (s.congress ? 1 : 0));
  s.peak = Math.max(s.peak || 0, m.app);
  s.low = Math.min(s.low ?? 100, m.app);
}

// ---------------------------------------------------------------- elections
function midterms(s) {
  const m = s.m;
  // The president's party almost always loses seats in midterms.
  const swing = (m.app - 50) * 2.2 + (m.eco - 50) * 0.8 + (m.base - 60) * 0.4 - 14 + (rand() * 16 - 8);
  const prev = s.seats;
  s.seats = Math.max(150, Math.min(300, Math.round((s.party === 'independent' ? 200 : 228) + swing)));
  const had = s.congress;
  s.congress = s.party !== 'independent' && s.seats >= 218;
  return { type: 'midterms', seats: s.seats, prev, congress: s.congress, lost: had && !s.congress, gained: !had && s.congress };
}

// [abbr, name, electoral votes, lean (+ = leans Liberty), col, row] — tile-grid map.
const STATES = [
  ['AK', 'Alaska', 3, 8, 0, 0], ['ME', 'Maine', 4, -2, 11, 0],
  ['WI', 'Wisconsin', 10, 1, 6, 1], ['VT', 'Vermont', 3, -16, 10, 1], ['NH', 'New Hampshire', 4, -1, 11, 1],
  ['WA', 'Washington', 12, -8, 1, 2], ['ID', 'Idaho', 4, 18, 2, 2], ['MT', 'Montana', 4, 11, 3, 2], ['ND', 'North Dakota', 3, 20, 4, 2], ['MN', 'Minnesota', 10, -1, 5, 2], ['IL', 'Illinois', 19, -7, 6, 2], ['MI', 'Michigan', 15, 0, 7, 2], ['NY', 'New York', 28, -10, 9, 2], ['MA', 'Massachusetts', 11, -15, 10, 2],
  ['OR', 'Oregon', 8, -6, 1, 3], ['NV', 'Nevada', 6, 1, 2, 3], ['WY', 'Wyoming', 3, 25, 3, 3], ['SD', 'South Dakota', 3, 16, 4, 3], ['IA', 'Iowa', 6, 6, 5, 3], ['IN', 'Indiana', 11, 11, 6, 3], ['OH', 'Ohio', 17, 6, 7, 3], ['PA', 'Pennsylvania', 19, 1, 8, 3], ['NJ', 'New Jersey', 14, -4, 9, 3], ['CT', 'Connecticut', 7, -7, 10, 3], ['RI', 'Rhode Island', 4, -8, 11, 3],
  ['CA', 'California', 54, -14, 1, 4], ['UT', 'Utah', 6, 13, 2, 4], ['CO', 'Colorado', 10, -4, 3, 4], ['NE', 'Nebraska', 5, 13, 4, 4], ['MO', 'Missouri', 10, 10, 5, 4], ['KY', 'Kentucky', 8, 16, 6, 4], ['WV', 'West Virginia', 4, 22, 7, 4], ['VA', 'Virginia', 13, -3, 8, 4], ['MD', 'Maryland', 10, -14, 9, 4], ['DE', 'Delaware', 3, -7, 10, 4],
  ['AZ', 'Arizona', 11, 2, 2, 5], ['NM', 'New Mexico', 5, -3, 3, 5], ['KS', 'Kansas', 6, 10, 4, 5], ['AR', 'Arkansas', 6, 16, 5, 5], ['TN', 'Tennessee', 11, 14, 6, 5], ['NC', 'North Carolina', 16, 3, 7, 5], ['SC', 'South Carolina', 9, 8, 8, 5], ['DC', 'D.C.', 3, -40, 9, 5],
  ['OK', 'Oklahoma', 7, 17, 4, 6], ['LA', 'Louisiana', 8, 12, 5, 6], ['MS', 'Mississippi', 6, 11, 6, 6], ['AL', 'Alabama', 9, 15, 7, 6], ['GA', 'Georgia', 16, 2, 8, 6],
  ['HI', 'Hawaii', 4, -14, 0, 7], ['TX', 'Texas', 40, 5, 4, 7], ['FL', 'Florida', 30, 6, 9, 7],
];

function election(s) {
  const m = s.m;
  const f = s.flags;
  let national =
    (m.app - 59) * 0.9 + (m.eco - 53) * 0.3 + (m.uni - 52) * 0.12 + (m.base - 72) * 0.1 + (m.sec - 58) * 0.05 +
    (f.includes('camp_base') ? 1.5 : 0) + (f.includes('camp_middle') ? 2 : 0) + (f.includes('camp_negative') ? 2.5 : 0) +
    (f.includes('debate_win') ? 2.5 : 0) + (rand() * 8 - 4);
  national -= (econ.misery(s.e) - 7.5) * 0.5;
  national += Math.max(-3, Math.min(3, (s.e.dow / econ.START.dow - 1) * 8));
  if (s.party === 'independent') national -= 4; // no party machine
  const sign = PARTIES[s.party].sign;
  let ev = 0;
  const states = STATES.map(([abbr, name, votes, lean, col, row]) => {
    const margin = national + sign * lean + (rand() * 6 - 3);
    const won = margin > 0;
    if (won) ev += votes;
    return { abbr, name, ev: votes, col, row, margin: Math.round(margin * 10) / 10, won };
  });
  const popular = Math.max(20, Math.min(80, 50 + national / 2));
  return { type: 'election', won: ev >= 270, ev, oppEv: 538 - ev, popular: Math.round(popular * 10) / 10, states };
}

// ---------------------------------------------------------------- endings & legacy
const ACHIEVEMENTS = [
  ['two_terms', '🏆', 'Two-Termer', (s) => s.ended === 'completed'],
  ['bull', '🐂', 'Bull Market', (s) => s.m.eco >= 75],
  ['fortress', '🛡️', 'Fortress America', (s) => s.m.sec >= 75],
  ['peacemaker', '🕊️', 'Peacemaker', (s) => s.m.dip >= 75],
  ['green', '🌱', 'Green Giant', (s) => s.m.env >= 75],
  ['uniter', '🤝', 'The Uniter', (s) => s.m.uni >= 70],
  ['balanced', '🏦', 'Balanced the Books', (s) => s.m.tre >= 70],
  ['beloved', '❤️', 'Beloved', (s) => (s.peak || 0) >= 80],
  ['survivor', '🧯', 'Survived Impeachment', (s) => s.used.includes('impeachment') && !['removed', 'resigned'].includes(s.ended)],
  ['comeback', '📈', 'Comeback Kid', (s) => (s.low ?? 100) <= 30 && s.m.app >= 55],
  ['landslide', '🗳️', 'Landslide', (s) => (s.ev || 0) >= 400],
];

const ENDINGS = {
  completed: { title: 'Two Full Terms', text: 'You served eight years and handed over power peacefully. History will judge the rest.' },
  defeated: { title: 'One-Term President', text: 'The voters have spoken. You concede, pack up the Oval Office, and start writing your memoir.' },
  removed: { title: 'Removed from Office', text: 'The Senate convicted you. You are the first president ever removed by impeachment.' },
  resigned: { title: 'Resigned in Disgrace', text: 'You resigned before the Senate could remove you. The helicopter lifts off from the South Lawn.' },
  collapse: { title: 'Total Collapse', text: 'With single-digit approval, your cabinet invoked the 25th Amendment. Your presidency is over.' },
};

function legacyOf(s) {
  const m = s.m;
  const policy = (m.eco + m.sec + m.dip + m.env + m.uni + m.tre) / 6;
  let score = policy * 0.65 + m.app * 0.35;
  if (s.ended === 'completed') score += 4;
  if (s.ended === 'defeated') score -= 4;
  if (['removed', 'resigned', 'collapse'].includes(s.ended)) score -= 25;
  if (s.flags.includes('obstruction')) score -= 5;
  score += Math.min(10, (s.ach || []).length * 2);
  score = Math.max(0, Math.min(100, Math.round(score)));
  // Rank among 47 presidencies (you + 46 others).
  const rank = Math.max(1, Math.min(47, Math.round(47 - (46 * (score - 25)) / 65)));
  const tier =
    score >= 82 ? ['Mount Rushmore', '🗿'] : score >= 71 ? ['Great', '🌟'] : score >= 60 ? ['Above Average', '👍'] : score >= 47 ? ['Average', '😐'] : score >= 35 ? ['Below Average', '📉'] : score >= 22 ? ['Failed', '🥀'] : ['Disgraced', '💀'];
  return { score, rank, tier: tier[0], emoji: tier[1] };
}

function finish(s, out, how) {
  s.ended = how;
  if (out.event && out.event.type === 'election') s.ev = out.event.ev;
  s.ach = ACHIEVEMENTS.filter(([, , , test]) => test(s)).map(([id]) => id);
  out.ending = endingView(s);
  return out;
}

function endingView(s) {
  return {
    type: s.ended,
    ...ENDINGS[s.ended],
    legacy: legacyOf(s),
    achievements: ACHIEVEMENTS.filter(([id]) => (s.ach || []).includes(id)).map(([id, emoji, label]) => ({ id, emoji, label })),
    quarters: s.q,
    report: econ.report(s.e, s.q),
    timeline: s.hist.map(([cid, choice, ok]) => {
      const c = byId.get(cid);
      return { title: c.title, cat: c.cat, choice: choice === -1 ? 'Indecision' : c.options[choice].label, ok };
    }),
  };
}

// Public view of the state for the HUD.
function view(s) {
  const qInTerm = s.q % QUARTERS_PER_TERM;
  return {
    name: s.name,
    party: s.party,
    partyLabel: PARTIES[s.party].label,
    partyColor: PARTIES[s.party].color,
    bg: s.bg,
    bgLabel: BACKGROUNDS[s.bg].label,
    m: s.m,
    pc: s.pc,
    congress: s.congress,
    seats: s.seats,
    term: s.term,
    year: Math.floor(qInTerm / 4) + 1 + (s.term - 1) * 4,
    quarter: (qInTerm % 4) + 1,
    q: s.q,
    totalQ: QUARTERS_PER_TERM * 2,
    ended: s.ended,
    econ: econ.view(s.e),
    budget: s.e.log
      .map(([cid, idx, usd]) => {
        const c = byId.get(cid);
        return c && c.options[idx] ? { title: c.title, choice: c.options[idx].label, usd } : null;
      })
      .filter(Boolean),
    polls: polls(s),
    canPost: !s.ended && s.posted !== s.q,
  };
}

// Approval by voter group, derived from the meters and the real economy.
function polls(s) {
  const m = s.m;
  const e = s.e;
  const c = (v) => Math.max(3, Math.min(97, Math.round(v)));
  const indie = s.party === 'independent';
  return [
    ['Your party', '🎗️', c(indie ? m.base - 5 : m.base + 8)],
    ['Independents', '⚖️', c(m.app - 3 + (m.uni - 50) * 0.2)],
    ['Opposition', '🥊', c(m.app - (indie ? 22 : 36) + (m.uni - 50) * 0.35)],
    ['Under 30', '🎧', c(m.app - 2 + (m.env - 50) * 0.3 - (e.u - 4) * 1.5)],
    ['Seniors', '👴', c(m.app + 2 + (m.sec - 50) * 0.2 + (m.tre - 50) * 0.12)],
    ['Working class', '🧰', c(m.app - (e.i - 3) * 2.2 - (e.u - 4) * 2 - Math.max(0, e.gas - 3.5) * 4)],
    ['Business', '💼', c(m.app + (m.eco - 50) * 0.5 + (e.dow / econ.START.dow - 1) * 30)],
    ['Suburban moms', '🏡', c(m.app + (m.uni - 50) * 0.25 - (e.i - 3) * 1.5)],
  ].map(([label, emoji, pct]) => ({ label, emoji, pct }));
}

// ---------------------------------------------------------------- the president posts
const TONES = {
  presidential: { label: 'Presidential', fx: { uni: 2, app: 1, base: -1 } },
  rally: { label: 'Fire up the base', fx: { base: 5, uni: -3 }, roll: { p: 0.75, bad: { app: -3 } } },
  attack: { label: 'Attack the opposition', fx: { base: 3, uni: -4 }, roll: { p: 0.5, ok: { app: 2 }, bad: { app: -3 } } },
  meme: { label: 'Post a meme', fx: {}, roll: { p: 0.55, ok: { app: 3, base: 2 }, bad: { app: -4 } } },
};

function post(s, tone) {
  if (s.ended) return { error: 'Your presidency is over.' };
  if (s.posted === s.q) return { error: 'You already posted this quarter.' };
  const t = TONES[tone];
  if (!t) return { error: 'Invalid post.' };
  s.posted = s.q;
  const deltas = {};
  applyFx(s, t.fx, deltas);
  let ok = null;
  if (t.roll) {
    ok = rand() < t.roll.p;
    applyFx(s, ok ? t.roll.ok : t.roll.bad, deltas);
  }
  const reach = 0.5 + rand() + (ok === true ? 1.5 : ok === false ? 1.2 : 0) + (tone === 'meme' ? 0.8 : 0);
  const views = Math.round((2 + reach * 9) * 1_000_000 * (0.6 + s.m.app / 100));
  return {
    tone,
    ok,
    deltas,
    viral: { views, likes: Math.round(views * (ok === false ? 0.012 : 0.045) * (0.7 + rand() * 0.6)), reposts: Math.round(views * 0.006 * (0.6 + rand())), ratio: ok === false },
  };
}

module.exports = { newGame, choose, post, cardView, view, endingView, legacyOf, PARTIES, BACKGROUNDS, STATES, LABEL };
