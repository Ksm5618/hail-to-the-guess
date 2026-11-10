/* Hail to the Guess — client */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    for (const k of kids) n.append(k);
    return n;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  // ------------------------------------------------------------------ API
  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
    return data;
  }

  // ------------------------------------------------------------------ Sound (synthesized, no files)
  const Sound = (() => {
    let ctx = null;
    let muted = store.get('muted', false);
    const btn = $('#mute');
    const paint = () => { btn.textContent = muted ? '🔇' : '🔊'; };
    paint();
    function ac() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, { at = 0, dur = 0.15, type = 'sine', vol = 0.18, slide = 0 } = {}) {
      if (muted) return;
      const c = ac();
      const t = c.currentTime + at;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    return {
      toggle() { muted = !muted; store.set('muted', muted); paint(); if (!muted) this.click(); },
      click: () => tone(660, { dur: 0.06, type: 'triangle', vol: 0.12 }),
      tick: (urgent) => tone(urgent ? 1100 : 880, { dur: 0.05, type: 'square', vol: 0.05 }),
      correct: (streak) => {
        const base = 523.25 * Math.pow(2, Math.min(streak - 1, 6) / 12);
        [0, 4, 7, 12].forEach((s, i) => tone(base * Math.pow(2, s / 12), { at: i * 0.07, dur: 0.22, type: 'triangle', vol: 0.16 }));
      },
      wrong: () => { tone(220, { dur: 0.35, type: 'sawtooth', vol: 0.09, slide: -120 }); tone(165, { at: 0.12, dur: 0.4, type: 'sawtooth', vol: 0.08, slide: -80 }); },
      start: () => [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.18, type: 'square', vol: 0.06 })),
      fanfare: (good) => {
        const notes = good ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] : [392, 349.23, 329.63, 261.63];
        notes.forEach((f, i) => tone(f, { at: i * 0.13, dur: 0.28, type: 'triangle', vol: 0.15 }));
      },
    };
  })();
  $('#mute').addEventListener('click', () => Sound.toggle());

  // ------------------------------------------------------------------ Starfield background
  (function stars() {
    const c = $('#stars');
    const x = c.getContext('2d');
    let w, h, dpr, pts = [], shooting = null;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.width = innerWidth * dpr;
      h = c.height = innerHeight * dpr;
      const n = Math.round((innerWidth * innerHeight) / 5000);
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.4 + 0.3) * dpr, p: Math.random() * Math.PI * 2, s: Math.random() * 0.15 + 0.03 }));
    }
    resize();
    addEventListener('resize', resize);
    function frame(t) {
      x.clearRect(0, 0, w, h);
      for (const s of pts) {
        s.y -= s.s * dpr;
        if (s.y < 0) { s.y = h; s.x = Math.random() * w; }
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + s.p));
        x.fillStyle = `rgba(220,228,255,${a})`;
        x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill();
      }
      if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.4, l: 0 };
      if (shooting) {
        shooting.l += 0.02;
        const len = 160 * dpr;
        const sx = shooting.x + shooting.l * w * 0.5, sy = shooting.y + shooting.l * h * 0.3;
        const g = x.createLinearGradient(sx, sy, sx - len, sy - len * 0.6);
        g.addColorStop(0, `rgba(255,255,255,${1 - shooting.l})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.strokeStyle = g; x.lineWidth = 2 * dpr;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx - len, sy - len * 0.6); x.stroke();
        if (shooting.l >= 1) shooting = null;
      }
      if (!reduceMotion) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ------------------------------------------------------------------ Confetti
  const Confetti = (() => {
    const c = $('#confetti');
    const x = c.getContext('2d');
    let parts = [], running = false, dpr = 1;
    const colors = ['#ff3d5a', '#ffffff', '#3d7bff', '#ffcc4d', '#2fe39a'];
    function size() { dpr = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    size(); addEventListener('resize', size);
    function burst({ x: ox = 0.5, y: oy = 0.45, count = 90, spread = 1, power = 1 } = {}) {
      if (reduceMotion) return;
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
        const v = (6 + Math.random() * 10) * power * dpr;
        parts.push({
          x: ox * c.width, y: oy * c.height, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 10) * dpr,
          r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
          c: colors[(Math.random() * colors.length) | 0], life: 1, star: Math.random() < 0.18,
        });
      }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }
    function star(cx, cy, r) {
      x.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fill();
    }
    function loop() {
      x.clearRect(0, 0, c.width, c.height);
      parts = parts.filter((p) => p.life > 0 && p.y < c.height + 40);
      for (const p of parts) {
        p.vy += 0.32 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.006;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.min(1, p.life * 2); x.fillStyle = p.c;
        if (p.star) star(0, 0, p.w); else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        x.restore();
      }
      if (parts.length) requestAnimationFrame(loop); else { running = false; x.clearRect(0, 0, c.width, c.height); }
    }
    return { burst };
  })();

  // ------------------------------------------------------------------ Toast
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ------------------------------------------------------------------ Screens
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
    scrollTo({ top: 0 });
  }

  // ------------------------------------------------------------------ Home
  const MODE_INFO = {
    classic: { emoji: '🇺🇸', blurb: 'Every president, Washington to today.' },
    modern: { emoji: '📺', blurb: 'Teddy Roosevelt onward. TV-era faces.' },
    oldschool: { emoji: '🎩', blurb: 'The first 25. Wigs, beards & mutton chops.' },
  };
  let meta = null;
  let mode = store.get('mode', 'classic');
  let lbMode = mode;

  async function loadHome() {
    try {
      meta = await api('/api/meta');
    } catch {
      toast('Could not reach the server.');
      return;
    }
    if (!meta.modes.some((m) => m.key === mode)) mode = 'classic';
    renderModes();
    renderTabs();
    loadLeaderboard(lbMode, $('#home-lb'));
    const s = meta.stats;
    $('#gstats').replaceChildren(
      ...[[s.roundsPlayed.toLocaleString(), 'Rounds played'], [s.guesses.toLocaleString(), 'Faces guessed'], [s.accuracy === null ? '—' : `${s.accuracy}%`, 'Nation accuracy']]
        .map(([v, l]) => el('div', {}, el('b', { textContent: v }), el('span', { textContent: l }))),
    );
    api('/api/hall-of-shame').then(({ hardest }) => {
      if (!hardest.length) return;
      $('#shame').replaceChildren(...hardest.map((h) => el('li', {}, el('span', { textContent: h.name }), el('b', { textContent: `${h.rate}% recognized` }))));
    }).catch(() => {});
  }

  function renderModes() {
    $('#modes').replaceChildren(...meta.modes.map((m) => {
      const b = el('button', { className: 'mode', type: 'button' },
        el('div', { className: 'emoji', textContent: MODE_INFO[m.key].emoji }),
        el('h3', { textContent: m.label }),
        el('p', { textContent: `${MODE_INFO[m.key].blurb} (${m.pool} faces)` }));
      b.setAttribute('aria-pressed', String(m.key === mode));
      b.addEventListener('click', () => {
        mode = m.key; store.set('mode', mode); Sound.click(); renderModes();
        lbMode = mode; renderTabs(); loadLeaderboard(lbMode, $('#home-lb'));
      });
      return b;
    }));
  }

  function renderTabs() {
    $('#lb-tabs').replaceChildren(...meta.modes.map((m) => {
      const t = el('button', { className: 'tab', type: 'button', textContent: m.label });
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(m.key === lbMode));
      t.addEventListener('click', () => { lbMode = m.key; renderTabs(); loadLeaderboard(lbMode, $('#home-lb')); });
      return t;
    }));
  }

  const fmtTime = (ms) => `${(ms / 1000).toFixed(1)}s`;

  function renderLeaderboard(list, entries, meId) {
    if (!entries.length) {
      list.replaceChildren(el('li', { className: 'lb-empty', textContent: 'No scores yet — be the first legend.' }));
      return;
    }
    list.replaceChildren(...entries.map((e) => {
      const medal = ['🥇', '🥈', '🥉'][e.rank - 1];
      const li = el('li', {},
        el('span', { className: 'r', textContent: medal || e.rank }),
        el('span', { className: 'n', textContent: e.name }),
        el('span', { className: 's', textContent: `${e.score}/${e.total}` }),
        el('span', { className: 't', textContent: fmtTime(e.totalMs) }));
      if (e.id === meId) li.classList.add('me');
      return li;
    }));
  }

  async function loadLeaderboard(m, list, meId) {
    try {
      const { entries } = await api(`/api/leaderboard?mode=${encodeURIComponent(m)}`);
      renderLeaderboard(list, entries, meId);
    } catch {
      list.replaceChildren(el('li', { className: 'lb-empty', textContent: 'Leaderboard unavailable.' }));
    }
  }

  $('#play').addEventListener('click', startRound);

  // ------------------------------------------------------------------ Game
  const game = {
    round: null,
    phase: 'idle', // idle | loading | guessing | submitting | revealed | done
    q: null,
    deadline: 0,
    timerRaf: 0,
    lastTickSec: null,
    blobs: [], // portrait object URLs, kept for the recap
    results: [],
    score: 0,
  };

  const card = $('#card');
  const cardWrap = $('#card-wrap');
  const portrait = $('#portrait');
  const guessInput = $('#guess');
  const ring = $('#ring');

  function resetGame() {
    for (const u of game.blobs) URL.revokeObjectURL(u);
    Object.assign(game, { round: null, phase: 'idle', q: null, blobs: [], results: [], score: 0 });
    cancelAnimationFrame(game.timerRaf);
    $('#score').textContent = '0';
    setStreak(0);
    $('#pips').replaceChildren(...Array.from({ length: 10 }, () => el('div', { className: 'pip' })));
  }

  async function startRound() {
    if (game.phase === 'loading') return;
    Sound.start();
    resetGame();
    game.phase = 'loading';
    try {
      game.round = await api('/api/rounds', { mode });
    } catch (e) {
      game.phase = 'idle';
      toast(e.message);
      return;
    }
    $('#pips').replaceChildren(...Array.from({ length: game.round.total }, () => el('div', { className: 'pip' })));
    show('game');
    loadQuestion();
  }

  async function loadQuestion() {
    game.phase = 'loading';
    $('#next').classList.add('hidden');
    $('#hint').textContent = '';
    portrait.classList.remove('in');
    if (card.classList.contains('flipped')) {
      card.classList.remove('flipped');
      await sleep(reduceMotion ? 0 : 450);
    }
    $('#loader').style.display = '';
    guessInput.value = '';
    guessInput.disabled = true;
    $('#submit').disabled = true;
    $('#skip').disabled = true;
    setRing(1);
    $('#timer').textContent = game.round.secondsPerQuestion;
    $('#timer-chip').classList.remove('low');

    let q, blobUrl;
    try {
      q = await api(`/api/rounds/${game.round.roundId}/next`, {});
      if (q.done) return finishRound();
      const deadline = performance.now() + q.secondsLeft * 1000;
      const img = await fetch(q.image);
      if (!img.ok) throw new Error('Portrait failed to load');
      blobUrl = URL.createObjectURL(await img.blob());
      game.deadline = deadline;
    } catch (e) {
      toast(e.message || 'Network hiccup — retrying…');
      await sleep(1200);
      return loadQuestion();
    }
    game.q = q;
    game.blobs[q.index] = blobUrl;
    portrait.src = blobUrl;
    await portrait.decode().catch(() => {});
    $('#loader').style.display = 'none';
    portrait.classList.add('in');

    $('#q-label').textContent = `Question ${q.index + 1} of ${q.total}`;
    [...$('#pips').children].forEach((p, i) => p.classList.toggle('current', i === q.index));
    guessInput.disabled = false;
    $('#submit').disabled = false;
    $('#skip').disabled = false;
    guessInput.focus();
    game.phase = 'guessing';
    game.lastTickSec = null;
    runTimer();
  }

  function setRing(frac) {
    ring.style.strokeDashoffset = String(100 - frac * 100);
    ring.classList.toggle('mid', frac <= 0.5 && frac > 0.25);
    ring.classList.toggle('low', frac <= 0.25);
  }

  function runTimer() {
    cancelAnimationFrame(game.timerRaf);
    const total = game.round.secondsPerQuestion * 1000;
    const step = () => {
      if (game.phase !== 'guessing') return;
      const left = Math.max(0, game.deadline - performance.now());
      setRing(left / total);
      const sec = Math.ceil(left / 1000);
      $('#timer').textContent = sec;
      $('#timer-chip').classList.toggle('low', sec <= 5);
      if (sec <= 5 && sec > 0 && sec !== game.lastTickSec) { Sound.tick(sec <= 3); game.lastTickSec = sec; }
      if (left <= 0) return submitGuess(guessInput.value, true);
      game.timerRaf = requestAnimationFrame(step);
    };
    game.timerRaf = requestAnimationFrame(step);
  }

  async function submitGuess(guess, fromTimer = false) {
    if (game.phase !== 'guessing') return;
    game.phase = 'submitting';
    cancelAnimationFrame(game.timerRaf);
    guessInput.disabled = true;
    $('#submit').disabled = true;
    $('#skip').disabled = true;

    let r;
    try {
      r = await api(`/api/rounds/${game.round.roundId}/answer`, { index: game.q.index, guess });
    } catch (e) {
      toast(e.message);
      game.phase = 'guessing';
      guessInput.disabled = false;
      $('#submit').disabled = false;
      $('#skip').disabled = false;
      runTimer();
      return;
    }
    game.results[game.q.index] = { ...r.president, correct: r.correct, guess, ms: r.ms, img: game.blobs[game.q.index] };
    reveal(r, guess, fromTimer);
  }

  function reveal(r, guess, fromTimer) {
    const p = r.president;
    const back = $('#back');
    back.classList.toggle('good', r.correct);
    back.classList.toggle('bad', !r.correct);

    const lines = ['Nailed it!', 'Correct!', 'Presidential!', 'Boom!', 'Yes sir!', 'Spot on!'];
    const misses = ['Nope!', 'Not quite!', 'Veto!', 'Swing & a miss!', 'Denied!'];
    let verdict = r.correct ? lines[(Math.random() * lines.length) | 0] : misses[(Math.random() * misses.length) | 0];
    if (r.correct && r.streak >= 5) verdict = 'Unstoppable!';
    else if (r.correct && r.streak >= 3) verdict = 'On fire!';
    if (!r.correct && (r.timedOut || (fromTimer && !guess.trim()))) verdict = "Time's up!";
    else if (!r.correct && !guess.trim()) verdict = 'Passed';
    $('#verdict').textContent = verdict;

    $('#reveal-num').textContent = p.numbers.map((n) => `#${n}`).join(' & ');
    $('#reveal-name').textContent = p.name;
    $('#reveal-years').textContent = p.years;
    $('#reveal-party').textContent = p.party;
    $('#reveal-fact').textContent = p.fact;

    const your = $('#reveal-your');
    your.replaceChildren();
    if (!r.correct && guess.trim()) {
      your.append('You said ', el('s', { textContent: guess.trim() }));
      if (r.guessedAs) your.append(` (that's ${r.guessedAs})`);
      else if (r.almost) your.append(' — so close! Need the first name.');
    }
    $('#reveal-global').replaceChildren(r.globalCorrectRate === null ? '' : el('span', {}, el('b', { textContent: `${r.globalCorrectRate}%` }), ' of players get this one'));

    card.classList.add('flipped');

    const pip = $('#pips').children[game.q.index];
    pip.classList.remove('current');
    pip.classList.add(r.correct ? 'good' : 'bad');

    if (r.correct) {
      Sound.correct(r.streak);
      game.score = r.score;
      const s = $('#score');
      s.textContent = r.score;
      s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
      const fp = $('#float-pts');
      fp.textContent = r.streak >= 3 ? `+1 🔥${r.streak}` : '+1';
      fp.classList.remove('go'); void fp.offsetWidth; fp.classList.add('go');
      const rect = cardWrap.getBoundingClientRect();
      Confetti.burst({
        x: (rect.left + rect.width / 2) / innerWidth,
        y: (rect.top + rect.height * 0.35) / innerHeight,
        count: 50 + Math.min(r.streak, 6) * 25,
        spread: 0.9,
        power: 0.9 + Math.min(r.streak, 5) * 0.08,
      });
    } else {
      Sound.wrong();
      cardWrap.classList.remove('shake'); void cardWrap.offsetWidth; cardWrap.classList.add('shake');
    }
    setStreak(r.streak);

    game.phase = r.done ? 'done' : 'revealed';
    const next = $('#next');
    next.firstChild.textContent = r.done ? 'See results ' : 'Next ';
    next.classList.remove('hidden');
    next.focus({ preventScroll: true });
  }

  function setStreak(n) {
    $('#streak-n').textContent = n;
    const s = $('#streak');
    s.classList.toggle('lit', n >= 2);
    s.classList.toggle('inferno', n >= 5);
  }

  $('#answer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const g = guessInput.value.trim();
    if (!g) { $('#hint').textContent = 'Type a name — or Pass with Esc.'; guessInput.focus(); return; }
    submitGuess(g);
  });
  $('#skip').addEventListener('click', () => submitGuess(''));
  $('#next').addEventListener('click', advance);
  $('#quit').addEventListener('click', () => {
    if (game.phase === 'guessing' && !confirm('Quit this round? Your progress will be lost.')) return;
    cancelAnimationFrame(game.timerRaf);
    resetGame();
    card.classList.remove('flipped');
    show('home');
    loadHome();
  });

  function advance() {
    Sound.click();
    if (game.phase === 'revealed') loadQuestion();
    else if (game.phase === 'done') finishRound();
  }

  // Subtle 3D tilt on the portrait card
  cardWrap.addEventListener('pointermove', (e) => {
    if (reduceMotion || card.classList.contains('flipped') || e.pointerType !== 'mouse') return;
    const r = cardWrap.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${dx * 14}deg) rotateX(${-dy * 14}deg)`;
  });
  cardWrap.addEventListener('pointerleave', () => { card.style.transform = ''; });
  new MutationObserver(() => { card.style.transform = ''; }).observe(card, { attributes: true, attributeFilter: ['class'] });

  // ------------------------------------------------------------------ Results
  const RANKS = [
    [10, '🦅', 'Founding Legend'],
    [9, '🏛️', 'Commander in Chief'],
    [8, '🎖️', 'Vice President'],
    [7, '💼', 'Secretary of State'],
    [6, '⚖️', 'Senator'],
    [5, '📜', 'Congressman'],
    [4, '🗳️', 'Campaign Volunteer'],
    [2, '🎒', 'White House Intern'],
    [0, '🧳', 'Tourist'],
  ];
  let summary = null;

  async function finishRound() {
    game.phase = 'idle';
    try {
      summary = await api(`/api/rounds/${game.round.roundId}/summary`);
    } catch (e) {
      toast(e.message);
      return;
    }
    const frac = summary.score / summary.total;
    const [, emoji, title] = RANKS.find(([min]) => Math.round(frac * 10) >= min);
    $('#badge').textContent = emoji;
    $('#res-rank').textContent = title;
    $('#res-total').textContent = summary.total;
    $('#res-streak').textContent = summary.bestStreak;
    $('#res-time').textContent = fmtTime(summary.totalMs / summary.total);
    $('#res-mode').textContent = summary.modeLabel;

    const starsOn = Math.round(frac * 5);
    $('#stars-row').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
      const s = el('span', { textContent: '★' });
      if (i < starsOn) { s.classList.add('on'); s.style.animationDelay = `${0.6 + i * 0.15}s`; s.style.color = 'var(--gold)'; }
      return s;
    }));

    $('#recap').replaceChildren(...summary.results.map((r, i) => {
      const item = el('div', { className: `recap-item ${r.correct ? 'good' : 'bad'}`, title: r.correct ? r.name : `${r.name} — you said "${r.guess || '(pass)'}"` },
        el('img', { src: game.blobs[i] || '', alt: r.name }),
        el('span', { className: 'mark', textContent: r.correct ? '✓' : '✕' }),
        el('div', { className: 'cap', textContent: r.name }));
      item.style.animationDelay = `${0.3 + i * 0.06}s`;
      return item;
    }));

    $('#save-form').classList.remove('hidden');
    $('#saved').classList.add('hidden');
    $('#save-btn').disabled = false;
    $('#player').value = store.get('player', '');

    show('results');
    loadLeaderboard(summary.mode, $('#res-lb'));

    // count-up
    const scoreEl = $('#res-score');
    scoreEl.textContent = '0';
    const good = frac >= 0.7;
    Sound.fanfare(frac >= 0.5);
    for (let i = 1; i <= summary.score; i++) {
      await sleep(reduceMotion ? 0 : 110);
      scoreEl.textContent = i;
    }
    if (good) {
      Confetti.burst({ x: 0.2, y: 0.6, count: 120, spread: 0.7, power: 1.2 });
      Confetti.burst({ x: 0.8, y: 0.6, count: 120, spread: 0.7, power: 1.2 });
      if (summary.score === summary.total) setTimeout(() => Confetti.burst({ x: 0.5, y: 0.3, count: 220, spread: 2, power: 1.1 }), 500);
    }
  }

  $('#save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#player').value.trim();
    if (!name) { $('#player').focus(); toast('Enter a name first!'); return; }
    $('#save-btn').disabled = true;
    store.set('player', name);
    try {
      const r = await api(`/api/rounds/${game.round.roundId}/submit`, { name });
      $('#save-form').classList.add('hidden');
      const saved = $('#saved');
      saved.textContent = r.rank && r.rank <= 20
        ? `🎉 You're #${r.rank} on the ${summary.modeLabel} leaderboard!`
        : r.rank ? `Saved! You're #${r.rank} — keep climbing.` : 'Saved! Not on the board yet — go again.';
      saved.classList.remove('hidden');
      renderLeaderboard($('#res-lb'), r.entries, r.you);
      if (r.rank && r.rank <= 3) Confetti.burst({ x: 0.5, y: 0.5, count: 160, spread: 2 });
      Sound.correct(3);
    } catch (err) {
      $('#save-btn').disabled = false;
      toast(err.message);
    }
  });

  $('#again').addEventListener('click', startRound);
  $('#home-btn').addEventListener('click', () => { resetGame(); show('home'); loadHome(); });
  $('#share').addEventListener('click', async () => {
    if (!summary) return;
    const grid = summary.results.map((r) => (r.correct ? '🟩' : '🟥')).join('');
    const text = `Hail to the Guess 🇺🇸 ${summary.score}/${summary.total} — ${$('#res-rank').textContent}\n${summary.modeLabel} • best streak ${summary.bestStreak}🔥\n${grid}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied! Go brag. 📋');
    } catch {
      toast('Clipboard blocked — select & copy manually.');
    }
  });

  // ------------------------------------------------------------------ Keyboard
  addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement;
    const screen = document.querySelector('.screen.active').id;
    if (e.key.toLowerCase() === 'm' && !typing && !e.metaKey && !e.ctrlKey) { Sound.toggle(); return; }
    if (screen === 'home' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); startRound(); }
    if (screen === 'game') {
      if (e.key === 'Escape' && game.phase === 'guessing') { e.preventDefault(); submitGuess(''); }
      if (e.key === 'Enter' && (game.phase === 'revealed' || game.phase === 'done') && !typing) { e.preventDefault(); advance(); }
    }
    if (screen === 'results' && e.key === 'Enter' && !typing && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); startRound(); }
  });

  loadHome();
})();
