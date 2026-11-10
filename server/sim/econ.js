// The real-numbers layer of the Oval Office sim: GDP, growth, unemployment, inflation,
// the Dow, gas prices, the deficit and the national debt. Starting values are close
// to the mid-2020s U.S. economy. Every decision has a price tag in billions.

const crypto = require('crypto');

const noise = (amp) => ((crypto.randomInt(0, 1_000_001) / 1_000_000) * 2 - 1) * amp;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

const START = { gdp: 28.3, g: 2.4, u: 4.1, i: 3.1, debt: 35.4, def: 1.8, dow: 39500, gas: 3.45, conf: 100, spent: 0, revenue: 0 };

// Shocks hit the moment a crisis lands on your desk — before you decide anything.
// dow is a fraction (-0.14 = -14%); g/u/i are percentage points; gas is $/gallon.
const SHOCKS = {
  pandemic: { dow: -0.14, u: 2.4, g: -2.2, text: 'Markets plunge as the virus spreads' },
  pandemic_wave: { dow: -0.07, u: 1.5, g: -1.2, text: 'Second wave rattles markets' },
  bank_run: { dow: -0.09, g: -0.6, text: 'Bank stocks in freefall' },
  contagion: { dow: -0.1, u: 0.8, g: -1.0, text: 'Credit freeze spreads' },
  inflation: { i: 5.6, gas: 0.6, text: 'Prices spiking everywhere' },
  trade_war: { dow: -0.05, g: -0.3, text: 'Tariff fears hit stocks' },
  rail_strike: { g: -0.5, dow: -0.03, text: 'Supply chains seize up' },
  oil_shock: { gas: 2.9, i: 1.6, dow: -0.06, text: 'Gas spikes toward $7' },
  crypto: { dow: -0.03, text: 'Crypto crash spooks investors' },
  chips: { i: 0.6, g: -0.3, text: 'Chip shortage stalls factories' },
  hurricane: { g: -0.4, gas: 0.4, text: 'Gulf refineries knocked offline' },
  earthquake: { g: -0.5, dow: -0.03, text: 'Damage estimates top $300B' },
  ally_invaded: { gas: 0.7, dow: -0.05, text: 'War sends oil higher' },
  coup: { gas: 0.5, text: 'Oil supply jitters' },
  missile_test: { dow: -0.02, text: 'Markets on edge' },
  cyber: { dow: -0.04, g: -0.2, text: 'Blackout halts business in 4 states' },
  terror_plot: { dow: -0.02, text: 'Markets jittery on terror alert' },
  debt_crisis: { dow: -0.08, text: 'Default fears slam markets' },
  drought: { i: 0.4, text: 'Food prices climb' },
  wildfires: { g: -0.2, text: 'Fires disrupt Western economy' },
  // new cards
  black_monday: { dow: -0.22, g: -1.0, u: 0.6, text: 'Dow suffers worst day since 1987' },
  strait_standoff: { dow: -0.07, i: 0.5, text: 'Chip supply at risk' },
  grid_freeze: { g: -0.3, gas: 0.3, text: 'Millions without heat' },
  ai_layoffs: { u: 1.2, dow: 0.04, text: '2 million jobs automated' },
  grocery_revolt: { i: 1.4, text: 'Food prices up 18%' },
  hospital_ransomware: { dow: -0.01, text: 'Hospitals offline' },
  shutdown: { g: -0.3, dow: -0.02, text: 'Shutdown fears' },
};

// Explicit price tags (billions; negative = money raised/saved) and economic side effects
// for specific options, keyed "cardId:optionIndex". Anything not listed gets a price tag
// derived from its treasury impact.
const OPT = {
  'pandemic:0': { usd: 450, u: 2.6, g: -2.0, dow: -0.05 },
  'pandemic:1': { usd: 220, u: 0.6 },
  'pandemic:2': { usd: 0, u: 0.4, dow: 0.03 },
  'pandemic_wave:0': { usd: 2000, u: -1.8, g: 2.2, dow: 0.08, i: 1.2 },
  'pandemic_wave:1': { usd: 180, dow: 0.05 },
  'pandemic_wave:2': { usd: 0, u: 0.8 },
  'insulin:0': { usd: 0 },
  'insulin:1': { usd: 85 },
  'fentanyl:0': { usd: 120 },
  'fentanyl:1': { usd: 25 },
  'bank_run:0': { usd: 450, dow: 0.07 },
  'bank_run:1': { usd: 160, dow: 0.03 },
  'bank_run:2': { usd: 0, dow: -0.12, u: 0.7 },
  'contagion:0': { usd: 600, dow: 0.09, i: 0.6 },
  'contagion:1': { usd: 300, u: -0.6 },
  'contagion:2': { usd: 0, u: 1.6, g: -1.4, dow: -0.08 },
  'inflation:0': { usd: -320, i: -1.2, u: 0.5, g: -0.4 },
  'inflation:1': { usd: 0, i: -1.0, g: -0.3 },
  'inflation:2': { usd: 0, i: -2.4, u: 0.9, g: -0.7, dow: -0.06 },
  'soft_landing:0': { usd: 0 },
  'soft_landing:1': { usd: 140, u: -0.3 },
  'trade_war:0': { usd: 0, i: 0.8, dow: -0.04 },
  'trade_war:1': { usd: 0, dow: 0.02 },
  'trade_war:2': { usd: 30 },
  'rail_strike:0': { usd: 0, g: 0.4 },
  'rail_strike:1': { usd: 0, i: 0.1 },
  'rail_strike:2': { usd: 0, g: -0.6, i: 0.3 },
  'oil_shock:0': { usd: 95, gas: -0.9 },
  'oil_shock:1': { usd: -40, gas: -0.5, dow: 0.02 },
  'oil_shock:2': { usd: 370, gas: -0.2 },
  'green_boom:0': { usd: 150, u: -0.3 },
  'green_boom:1': { usd: 60, u: -0.2 },
  'taxes:0': { usd: 1900, g: 0.5, dow: 0.04, i: 0.3 },
  'taxes:1': { usd: -1400, dow: -0.03 },
  'taxes:2': { usd: 60, g: 0.2 },
  'big_tech:0': { usd: 2, dow: -0.06 },
  'big_tech:2': { usd: 0, dow: 0.04 },
  'housing:0': { usd: 420, u: -0.3 },
  'housing:1': { usd: 0, i: -0.2 },
  'housing:2': { usd: 15 },
  'crypto:2': { usd: 0, dow: 0.02 },
  'chips:0': { usd: 52 },
  'chips:2': { usd: 0, i: 0.4 },
  'chip_boom:0': { usd: 5, u: -0.2, dow: 0.03 },
  'chip_boom:1': { usd: 75, u: -0.3, dow: 0.03 },
  'infrastructure:0': { usd: 1200, u: -0.4, g: 0.4 },
  'infrastructure:1': { usd: 90 },
  'infrastructure:2': { usd: 40 },
  'student_debt:0': { usd: 1700 },
  'student_debt:1': { usd: 400 },
  'student_debt:2': { usd: -50 },
  'hostages:2': { usd: 400 },
  'cyber:2': { usd: 65 },
  'border:0': { usd: 45 },
  'border:1': { usd: 80 },
  'border:2': { usd: 35, g: 0.2 },
  'ally_invaded:0': { usd: 110, gas: 0.2 },
  'ally_invaded:1': { usd: 280, gas: 0.4, dow: -0.03 },
  'ally_invaded:2': { usd: 0, gas: 0.5 },
  'coup:0': { usd: 0, gas: -0.4 },
  'coup:1': { usd: 0, gas: 0.3 },
  'hurricane:0': { usd: 140 },
  'hurricane:1': { usd: 45 },
  'hurricane:2': { usd: 20 },
  'wildfires:1': { usd: 35 },
  'climate_summit:0': { usd: 90, dow: -0.02 },
  'climate_summit:2': { usd: 0, dow: 0.01 },
  'earthquake:0': { usd: 320 },
  'earthquake:1': { usd: 240 },
  'earthquake:2': { usd: 60 },
  'drought:1': { usd: 110 },
  'healthcare:0': { usd: 1600 },
  'healthcare:1': { usd: 350 },
  'moonbase:0': { usd: 95 },
  'moonbase:1': { usd: 40 },
  'moonbase:2': { usd: -25 },
  'veterans:0': { usd: 55 },
  'veterans:1': { usd: 90 },
  'shooting:1': { usd: 65 },
  'debt_crisis:0': { usd: -900, g: -0.5, dow: 0.08 },
  'debt_crisis:1': { usd: -800, g: -0.3, dow: 0.06 },
  'legacy_project:0': { usd: 380 },
  'legacy_project:1': { usd: -600 },
  'scotus:0': { usd: 0 },
};

function newEcon() {
  return { ...START, hist: [], log: [] };
}

// Price tag for an option (billions). Positive = spending, negative = revenue/savings.
function priceOf(cardId, idx, opt) {
  const x = OPT[`${cardId}:${idx}`];
  if (x && typeof x.usd === 'number') return x.usd;
  const tre = (opt && opt.fx && opt.fx.tre) || 0;
  return tre < 0 ? -tre * 28 : tre > 0 ? -tre * 28 : 0;
}

function shockText(cardId) {
  return SHOCKS[cardId] ? SHOCKS[cardId].text : null;
}

// Apply a crisis shock when the card is drawn. Returns a list of what moved.
function applyShock(e, cardId) {
  const sh = SHOCKS[cardId];
  if (!sh) return null;
  const moved = moveEcon(e, sh);
  return { text: sh.text, moved };
}

function moveEcon(e, d) {
  const moved = {};
  if (d.dow) { const before = e.dow; e.dow = Math.max(5000, e.dow * (1 + d.dow)); moved.dow = (e.dow / before - 1) * 100; }
  if (d.u) { const b = e.u; e.u = clamp(e.u + d.u, 2.6, 18); moved.u = e.u - b; }
  if (d.g) { const b = e.g; e.g = clamp(e.g + d.g, -9, 8); moved.g = e.g - b; }
  if (d.i) { const b = e.i; e.i = clamp(e.i + d.i, -1, 16); moved.i = e.i - b; }
  if (d.gas) { const b = e.gas; e.gas = clamp(e.gas + d.gas, 1.9, 9); moved.gas = e.gas - b; }
  return moved;
}

// Economic consequences of a decision.
function applyChoice(e, cardId, idx, opt, { blocked, ok, deltas }) {
  if (blocked || idx < 0) return { usd: 0, moved: {} };
  const usd = priceOf(cardId, idx, opt);
  const x = OPT[`${cardId}:${idx}`] || {};
  e.debt += usd / 1000;
  if (usd > 0) e.spent += usd;
  else e.revenue += -usd;
  if (Math.abs(usd) >= 1) {
    e.log.push([cardId, idx, Math.round(usd)]);
    if (e.log.length > 40) e.log.shift();
  }
  // Meter swings ripple into the real economy.
  const eco = (deltas && deltas.eco) || 0;
  const d = {
    dow: (x.dow || 0) + eco * 0.004 + (ok === false ? -0.01 : ok ? 0.008 : 0) + noise(0.008),
    g: (x.g || 0) + eco * 0.05,
    u: (x.u || 0) - eco * 0.035,
    i: (x.i || 0) + (usd > 300 ? usd / 3000 : 0),
    gas: x.gas || 0,
  };
  const moved = moveEcon(e, d);
  return { usd, moved };
}

// One quarter passes.
function tick(e, m) {
  const tg = 1.9 + (m.eco - 50) * 0.08 - Math.max(0, e.i - 4) * 0.22;
  e.g = clamp(e.g + (tg - e.g) * 0.35 + noise(0.3), -9, 8);
  e.gdp = e.gdp * (1 + e.g / 400);
  const tu = 4.5 - (e.g - 2) * 0.45;
  e.u = clamp(e.u + (tu - e.u) * 0.3 + noise(0.1), 2.6, 18);
  e.i = clamp(e.i + (2.6 - e.i) * 0.2 + Math.max(0, e.g - 3) * 0.12 + (e.gas - 3.5) * 0.08 + noise(0.15), -1, 16);
  e.def = clamp(1.5 + (55 - m.tre) * 0.035 - (e.g - 2) * 0.09 + (e.u - 4) * 0.08, -0.6, 7);
  e.debt += e.def / 4;
  e.dow = Math.max(5000, e.dow * (1 + (1.6 + (e.g - 2) * 0.8 + (m.eco - 50) * 0.07 - Math.max(0, e.i - 3.5) * 0.7) / 100 + noise(0.025)));
  e.gas = clamp(e.gas + (3.4 + (e.i - 2.6) * 0.05 - e.gas) * 0.25 + noise(0.08), 1.9, 9);
  e.conf = clamp(100 + (m.eco - 50) * 1.1 - (e.u - 4) * 6 - (e.i - 3) * 4 - (e.gas - 3.5) * 5, 25, 150);
  e.hist.push([r1(e.g), r1(e.u), r1(e.i), Math.round(e.dow), r2(e.gas), r1(e.debt)]);
  if (e.hist.length > 33) e.hist.shift();
}

const misery = (e) => e.u + e.i;

function view(e) {
  return {
    gdp: r1(e.gdp),
    g: r1(e.g),
    u: r1(e.u),
    i: r1(e.i),
    dow: Math.round(e.dow),
    gas: r2(e.gas),
    debt: r1(e.debt),
    def: r2(e.def),
    debtGdp: Math.round((e.debt / e.gdp) * 100),
    conf: Math.round(e.conf),
    spent: Math.round(e.spent),
    revenue: Math.round(e.revenue),
    misery: r1(misery(e)),
    hist: e.hist,
    start: { dow: START.dow, debt: START.debt, u: START.u, gdp: START.gdp },
  };
}

// End-of-presidency economic report card.
function report(e, quarters) {
  const years = Math.max(0.25, quarters / 4);
  const jobs = Math.round((START.u - e.u) * 1.7 * 10) / 10; // millions (≈1.7M per point)
  return {
    gdpGrowth: r1(((e.gdp / START.gdp) ** (1 / years) - 1) * 100),
    jobs,
    debtAdded: r1(e.debt - START.debt),
    dowChange: Math.round((e.dow / START.dow - 1) * 100),
    spent: Math.round(e.spent),
    revenue: Math.round(e.revenue),
    finalU: r1(e.u),
    finalI: r1(e.i),
    finalGas: r2(e.gas),
  };
}

module.exports = { newEcon, priceOf, applyShock, applyChoice, tick, view, report, misery, shockText, START };
