/* Hail to the Guess — "Be the President" (Oval Office) client */
(() => {
  'use strict';
  const H = window.HTG;
  if (!H) return;
  const { api, Sound, Confetti, toast, show, el, sleep, flash, slam, shakeScreen, store, reduceMotion } = H;
  const $ = (s) => document.querySelector(s);

  const DECISION_SECONDS = 45;
  const METERS = [
    ['eco', '💰', 'Economy'],
    ['sec', '🛡️', 'Security'],
    ['dip', '🌐', 'Diplomacy'],
    ['env', '🌱', 'Environment'],
    ['uni', '🤝', 'Unity'],
    ['tre', '🏦', 'Treasury'],
    ['base', '🔥', 'Your Base'],
  ];
  const LABEL = Object.fromEntries([...METERS.map(([k, , l]) => [k, l]), ['app', 'Approval']]);
  const ICON = Object.fromEntries([...METERS.map(([k, i]) => [k, i]), ['app', '👍']]);
  const CAT_COLOR = {
    Economy: '#2fe39a', Security: '#ff4d6d', Foreign: '#3d7bff', Health: '#ff8fd0', Disaster: '#ff9b3d',
    Environment: '#7be36b', Domestic: '#c69bff', Tech: '#3de0ff', Scandal: '#ffcc4d', Campaign: '#ff3d5a', Legacy: '#ffd36b',
  };

  let meta = null;
  const g = { token: null, state: null, card: null, busy: false, timerRaf: 0, deadline: 0, lastTick: null, pending: null, party: 'liberty', bg: 'governor' };

  // ------------------------------------------------------------------ home switch
  function setGame(which) {
    document.body.dataset.game = which;
    store.set('game', which);
    for (const b of document.querySelectorAll('.game-switch button')) b.setAttribute('aria-selected', String(b.dataset.game === which));
    $('#quiz-home').classList.toggle('hidden', which !== 'quiz');
    $('#sim-home').classList.toggle('hidden', which !== 'sim');
    if (which === 'sim') loadSimBoard();
  }
  for (const b of document.querySelectorAll('.game-switch button')) {
    b.addEventListener('click', () => { Sound.click(); setGame(b.dataset.game); });
  }
  setGame(store.get('game', 'quiz') === 'sim' ? 'sim' : 'quiz');

  const OUTCOME_LABEL = { completed: '2 terms', defeated: '1 term', removed: 'Removed', resigned: 'Resigned', collapse: 'Collapsed' };
  async function loadSimBoard(list = $('#sim-lb'), meId) {
    try {
      const { entries } = await api('/api/sim/leaderboard');
      if (!entries.length) {
        list.replaceChildren(el('li', { className: 'lb-empty', textContent: 'No presidents yet. Be the first in the history books.' }));
        return;
      }
      list.replaceChildren(...entries.map((e) => {
        const li = el('li', {},
          el('span', { className: 'r', textContent: ['🥇', '🥈', '🥉'][e.rank - 1] || e.rank }),
          el('span', { className: 'n', textContent: `${e.emoji || ''} ${e.name}` }),
          el('span', { className: 's', textContent: e.score }),
          el('span', { className: 't', textContent: OUTCOME_LABEL[e.outcome] || '' }));
        if (e.id === meId) li.classList.add('me');
        return li;
      }));
    } catch {
      list.replaceChildren(el('li', { className: 'lb-empty', textContent: 'Hall of Legacies unavailable.' }));
    }
  }

  // ------------------------------------------------------------------ setup
  async function openSetup() {
    Sound.click();
    if (!meta) {
      try { meta = await api('/api/sim/meta'); } catch (e) { toast(e.message); return; }
    }
    g.party = store.get('simParty', 'liberty');
    g.bg = store.get('simBg', 'governor');
    $('#sim-name').value = store.get('simName', store.get('player', ''));
    renderPicks();
    show('sim-setup');
    setTimeout(() => $('#sim-name').focus(), 300);
  }

  function renderPicks() {
    $('#sim-parties').replaceChildren(...meta.parties.map((p) => {
      const b = el('button', { type: 'button', className: 'pick' },
        el('span', { className: 'pick-dot' }),
        el('b', { textContent: p.label }),
        el('small', { textContent: p.blurb }));
      b.style.setProperty('--pc', p.color);
      b.setAttribute('aria-pressed', String(p.key === g.party));
      b.addEventListener('click', () => { g.party = p.key; store.set('simParty', p.key); Sound.click(); renderPicks(); });
      return b;
    }));
    $('#sim-bgs').replaceChildren(...meta.backgrounds.map((bg) => {
      const b = el('button', { type: 'button', className: 'pick' },
        el('span', { className: 'pick-emoji', textContent: bg.emoji }),
        el('b', { textContent: bg.label }),
        el('small', { textContent: bg.blurb }),
        el('em', { textContent: bg.perk }));
      b.setAttribute('aria-pressed', String(bg.key === g.bg));
      b.addEventListener('click', () => { g.bg = bg.key; store.set('simBg', bg.key); Sound.click(); renderPicks(); });
      return b;
    }));
  }

  async function takeOath() {
    if (g.busy) return;
    const name = $('#sim-name').value.trim();
    if (!name) { toast('Every president needs a name.'); $('#sim-name').focus(); return; }
    store.set('simName', name);
    g.busy = true;
    try {
      const r = await api('/api/sim/start', { name, party: g.party, background: g.bg });
      Object.assign(g, { token: r.token, state: r.state, card: r.card });
    } catch (e) {
      toast(e.message);
      g.busy = false;
      return;
    }
    show('sim');
    $('#paper').classList.add('hidden');
    buildDash();
    renderState(null);
    Sound.fanfare(true);
    slam('Sworn in! 🇺🇸');
    Confetti.burst({ x: 0.5, y: 0.35, count: 160, spread: 1.6 });
    await sleep(reduceMotion ? 0 : 900);
    g.busy = false;
    renderCard();
  }

  // ------------------------------------------------------------------ dashboard
  function buildDash() {
    $('#meters').replaceChildren(...METERS.map(([k, icon, label]) => {
      const m = el('div', { className: 'meter', title: label },
        el('span', { className: 'm-icon', textContent: icon }),
        el('span', { className: 'm-label', textContent: label }),
        el('span', { className: 'm-val', textContent: '50' }),
        el('div', { className: 'm-bar' }, el('i')),
        el('span', { className: 'm-delta' }));
      m.dataset.k = k;
      return m;
    }));
    const track = $('#term-track');
    track.replaceChildren(...Array.from({ length: 32 }, (_, i) => {
      const seg = el('i');
      if (i === 7 || i === 23) seg.dataset.mark = 'Midterms';
      if (i === 15) seg.dataset.mark = 'Election';
      if (i === 31) seg.dataset.mark = 'Legacy';
      return seg;
    }));
  }

  function meterClass(v) {
    return v < 20 ? 'crit' : v < 40 ? 'low' : v < 65 ? 'mid' : 'high';
  }

  function renderState(deltas) {
    const s = g.state;
    $('#sim-who-name').textContent = `President ${s.name}`;
    $('#sim-who-sub').textContent = `${s.partyLabel} · ${s.bgLabel}`;
    $('#sim-who-sub').style.color = s.partyColor;
    $('#sim-date').textContent = `Year ${s.year} · Q${s.quarter}`;
    $('#sim-term').textContent = s.term === 2 ? 'Second term' : 'First term';

    for (const node of document.querySelectorAll('#meters .meter')) {
      const k = node.dataset.k;
      const v = s.m[k];
      node.querySelector('.m-val').textContent = v;
      const bar = node.querySelector('.m-bar i');
      bar.style.width = `${v}%`;
      node.className = `meter ${meterClass(v)}`;
      const d = deltas && deltas[k];
      if (d) {
        const dn = node.querySelector('.m-delta');
        dn.textContent = d > 0 ? `+${d}` : `${d}`;
        dn.className = `m-delta ${d > 0 ? 'up' : 'down'}`;
        void dn.offsetWidth;
        dn.classList.add('go');
      }
    }

    const ap = s.m.app;
    $('#ap-val').textContent = ap;
    const ring = $('#ap-ring');
    ring.style.strokeDashoffset = String(100 - ap);
    ring.setAttribute('class', `ap-fg ${meterClass(ap)}`);
    if (deltas && deltas.app) {
      const a = $('#approval');
      a.classList.remove('up', 'down');
      void a.offsetWidth;
      a.classList.add(deltas.app > 0 ? 'up' : 'down');
    }

    const pc = $('#chip-pc');
    pc.replaceChildren('⚡ ', el('b', { textContent: s.pc }), ' capital');
    const cg = $('#chip-congress');
    cg.replaceChildren('🏛️ ', el('b', { textContent: s.congress ? 'Congress: yours' : 'Divided Congress' }));
    cg.className = `chip ${s.congress ? 'good' : 'bad'}`;

    [...$('#term-track').children].forEach((seg, i) => {
      seg.className = i < s.q ? 'done' : i === s.q ? 'now' : '';
    });
  }

  // ------------------------------------------------------------------ crisis card
  function renderCard() {
    const c = g.card;
    if (!c) return;
    const crisis = $('#crisis');
    crisis.classList.remove('in');
    void crisis.offsetWidth;
    crisis.classList.add('in');
    crisis.style.setProperty('--cat', CAT_COLOR[c.cat] || '#3d7bff');
    $('#crisis-cat').textContent = c.cat;
    $('#crisis-title').textContent = c.title;
    $('#crisis-text').textContent = c.text;
    $('#advisors').replaceChildren(...c.adv.map(([who, says]) => el('div', { className: 'adv' }, el('b', { textContent: who }), el('span', { textContent: `“${says}”` }))));
    $('#decisions').replaceChildren(...c.options.map((o, i) => {
      const tags = el('div', { className: 'tags' });
      if (o.pc) tags.append(el('span', { className: `tag pc ${o.affordable ? '' : 'no'}`, textContent: `⚡ ${o.pc}` }));
      if (o.bill !== null) tags.append(el('span', { className: `tag bill ${o.bill < 50 ? 'risky' : ''}`, textContent: `🏛️ Needs Congress · ${o.bill}%` }));
      if (o.odds !== null) tags.append(el('span', { className: `tag odds ${o.odds < 50 ? 'risky' : ''}`, textContent: `🎲 ${o.odds}% odds` }));
      for (const h of o.hint) {
        tags.append(el('span', { className: `tag fx ${h.dir > 0 ? 'up' : 'down'}`, textContent: `${ICON[h.k] || ''} ${h.dir > 0 ? '▲' : '▼'}${h.big ? (h.dir > 0 ? '▲' : '▼') : ''}` , title: `${h.label} ${h.dir > 0 ? 'up' : 'down'}` }));
      }
      const b = el('button', { type: 'button', className: 'decision', disabled: !o.affordable },
        el('span', { className: 'd-key', textContent: i + 1 }),
        el('span', { className: 'd-body' }, el('b', { textContent: o.label }), el('small', { textContent: o.affordable ? o.desc : `Not enough political capital (need ⚡${o.pc})` }), tags));
      b.addEventListener('click', () => decide(i));
      return b;
    }));
    Sound.whoosh();
    startTimer();
  }

  // ------------------------------------------------------------------ timer
  function startTimer() {
    cancelAnimationFrame(g.timerRaf);
    g.deadline = performance.now() + DECISION_SECONDS * 1000;
    g.lastTick = null;
    const bar = $('#sim-timer-bar');
    const label = $('#sim-timer');
    const step = () => {
      if (g.busy || document.querySelector('.screen.active').id !== 'sim') return;
      const left = Math.max(0, g.deadline - performance.now());
      const sec = Math.ceil(left / 1000);
      bar.style.width = `${(left / (DECISION_SECONDS * 1000)) * 100}%`;
      label.textContent = sec;
      label.classList.toggle('low', sec <= 10);
      bar.classList.toggle('low', sec <= 10);
      if (sec <= 10 && sec > 0 && sec !== g.lastTick) { Sound.tick(sec <= 5); g.lastTick = sec; }
      if (left <= 0) { decide(-1); return; }
      g.timerRaf = requestAnimationFrame(step);
    };
    g.timerRaf = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ deciding
  async function decide(choice) {
    if (g.busy || !g.card) return;
    const opt = choice >= 0 ? g.card.options[choice] : null;
    if (opt && !opt.affordable) { toast('Not enough political capital.'); return; }
    g.busy = true;
    cancelAnimationFrame(g.timerRaf);
    const buttons = [...document.querySelectorAll('#decisions .decision')];
    buttons.forEach((b, i) => { b.disabled = true; b.classList.toggle('picked', i === choice); });
    Sound.click();

    let r;
    try {
      r = await api('/api/sim/choose', { token: g.token, choice });
    } catch (e) {
      toast(e.message);
      g.busy = false;
      buttons.forEach((b, i) => { b.disabled = !g.card.options[i].affordable; b.classList.remove('picked'); });
      startTimer();
      return;
    }
    g.token = r.token;
    g.pending = r;
    await showPaper(r.outcome);
  }

  async function showPaper(out) {
    const wrap = $('#paper');
    const s = g.state;
    $('#paper-date').textContent = `Year ${s.year}, Quarter ${s.quarter} · ${out.title}`;
    $('#paper-head').textContent = '';
    $('#paper-choice').textContent = out.choice === 'Indecision' ? '⏰ You ran out of time.' : `Your call: ${out.choice}`;
    $('#paper-deltas').replaceChildren();
    $('#paper-next').classList.add('hidden');
    const roller = $('#roller');
    roller.replaceChildren();
    roller.className = 'roller';
    wrap.classList.remove('hidden');
    void wrap.offsetWidth;
    wrap.classList.add('open');

    // Dramatic beat for votes and gambles.
    if (out.bill) {
      roller.className = 'roller show';
      roller.replaceChildren(el('span', { className: 'spin', textContent: '🏛️' }), el('span', { textContent: `Congress is voting… (${out.bill.odds}% odds)` }));
      await suspense();
      roller.replaceChildren(el('span', { className: `stamp ${out.bill.passed ? 'ok' : 'bad'}`, textContent: out.bill.passed ? 'Passed' : 'Blocked' }));
      out.bill.passed ? Sound.correct(2) : Sound.wrong();
      await sleep(reduceMotion ? 0 : 500);
    }
    if (out.rolled) {
      roller.className = 'roller show';
      roller.replaceChildren(el('span', { className: 'spin dice', textContent: '🎲' }), el('span', { textContent: `Rolling the dice… (${out.rolled.odds}% odds)` }));
      await suspense();
      roller.replaceChildren(el('span', { className: `stamp ${out.rolled.ok ? 'ok' : 'bad'}`, textContent: out.rolled.ok ? 'Success' : 'Failure' }));
      if (out.rolled.ok) { Sound.correct(3); flash('good'); } else { Sound.wrong(); flash('bad'); shakeScreen(); }
      await sleep(reduceMotion ? 0 : 500);
    }

    // Headline types out.
    const head = $('#paper-head');
    const text = out.news || '';
    if (reduceMotion) head.textContent = text;
    else for (let i = 1; i <= text.length; i += 2) { head.textContent = text.slice(0, i); await sleep(14); }
    head.textContent = text;

    const entries = Object.entries(out.deltas).filter(([, v]) => v);
    entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    $('#paper-deltas').replaceChildren(...entries.map(([k, v], i) => {
      const chip = el('span', { className: `delta ${v > 0 ? 'up' : 'down'}`, textContent: `${ICON[k] || ''} ${LABEL[k] || k} ${v > 0 ? '+' : ''}${v}` });
      chip.style.animationDelay = `${i * 0.06}s`;
      return chip;
    }));
    if (!entries.length) $('#paper-deltas').append(el('span', { className: 'delta', textContent: 'No measurable change' }));
    const net = entries.reduce((a, [k, v]) => a + (k === 'app' ? v * 1.5 : v), 0);
    if (!out.rolled && !out.bill) (net >= 0 ? Sound.correct(1) : Sound.wrong());

    $('#paper-next').classList.remove('hidden');
    $('#paper-next').focus({ preventScroll: true });
  }

  const suspense = () => sleep(reduceMotion ? 200 : 1300);

  async function closePaper() {
    if (!g.pending) return;
    const r = g.pending;
    g.pending = null;
    const wrap = $('#paper');
    wrap.classList.remove('open');
    await sleep(reduceMotion ? 0 : 250);
    wrap.classList.add('hidden');
    g.state = r.state;
    renderState(r.outcome.deltas);
    if (r.outcome.deltas.app >= 5) Confetti.burst({ x: 0.15, y: 0.15, count: 50, spread: 0.8 });

    if (r.outcome.event) {
      await sleep(reduceMotion ? 0 : 600);
      await (r.outcome.event.type === 'election' ? electionNight(r.outcome.event) : midterms(r.outcome.event));
    }
    if (r.outcome.ending) {
      await sleep(reduceMotion ? 0 : 300);
      return ending(r.outcome.ending);
    }
    g.card = r.card;
    g.busy = false;
    show('sim');
    renderCard();
  }
  $('#paper-next').addEventListener('click', () => { Sound.click(); closePaper(); });

  // ------------------------------------------------------------------ midterms
  function midterms(ev) {
    return new Promise((resolve) => {
      const body = $('#event-body');
      const pct = (n) => `${(n / 435) * 100}%`;
      const bar = el('div', { className: 'house-bar' }, el('i', { className: 'yours' }), el('b', { className: 'majority' }));
      const verdict = ev.lost ? 'You lost the House.' : ev.gained ? 'You flipped the House!' : ev.congress ? 'You held the House.' : 'Congress stays divided.';
      const sub = ev.congress
        ? 'Your bills have a strong chance of passing.'
        : 'Gridlock: anything that needs Congress is now a long shot.';
      const btn = el('button', { className: 'btn btn-mega', type: 'button' }, el('span', { textContent: 'Back to work' }));
      body.replaceChildren(el('div', { className: 'event midterm' },
        el('div', { className: 'event-kicker', textContent: 'Midterm elections' }),
        el('h1', { className: 'event-title', textContent: verdict }),
        el('p', { className: 'event-sub', textContent: sub }),
        el('div', { className: 'seat-count' }, el('b', { textContent: '0' }), el('span', { textContent: ' / 435 seats · 218 for a majority' })),
        bar,
        btn));
      show('sim-event');
      const fill = bar.querySelector('.yours');
      bar.querySelector('.majority').style.left = pct(218);
      requestAnimationFrame(() => { fill.style.width = pct(ev.seats); });
      const counter = body.querySelector('.seat-count b');
      const t0 = performance.now();
      const tick = () => {
        const f = Math.min(1, (performance.now() - t0) / 1600);
        counter.textContent = Math.round(ev.seats * f);
        if (f < 1) requestAnimationFrame(tick);
        else {
          if (ev.congress) { Sound.fanfare(true); Confetti.burst({ x: 0.5, y: 0.4, count: 120 }); } else { Sound.wrong(); shakeScreen(); }
        }
      };
      requestAnimationFrame(tick);
      btn.addEventListener('click', () => { Sound.click(); resolve(); });
      g.eventResolve = resolve;
    });
  }

  // ------------------------------------------------------------------ election night
  function electionNight(ev) {
    return new Promise((resolve) => {
      const s = g.state;
      const you = s.partyColor;
      const body = $('#event-body');
      const yourEv = el('b', { textContent: '0' });
      const oppEv = el('b', { textContent: '0' });
      const yourBar = el('i', { className: 'you' });
      const oppBar = el('i', { className: 'opp' });
      const map = el('div', { className: 'tile-map' });
      const states = ev.states.slice();
      const tiles = new Map();
      for (const st of states) {
        const t = el('div', { className: 'tile', title: `${st.name} · ${st.ev} EV` }, el('b', { textContent: st.abbr }), el('small', { textContent: st.ev }));
        t.style.gridColumn = st.col + 1;
        t.style.gridRow = st.row + 1;
        map.append(t);
        tiles.set(st.abbr, t);
      }
      const status = el('div', { className: 'en-status', textContent: 'Polls are closing…' });
      const done = el('button', { className: 'btn btn-mega hidden', type: 'button' }, el('span', { textContent: 'Continue' }));
      body.replaceChildren(el('div', { className: 'event election' },
        el('div', { className: 'event-kicker', textContent: 'Election night' }),
        el('div', { className: 'ev-race' },
          el('div', { className: 'ev-side you-side' }, el('small', { textContent: `${s.name} (${s.partyLabel})` }), yourEv),
          el('div', { className: 'ev-target', textContent: '270 to win' }),
          el('div', { className: 'ev-side opp-side' }, el('small', { textContent: 'The Challenger' }), oppEv)),
        el('div', { className: 'ev-bar' }, yourBar, el('span', { className: 'ev-270' }), oppBar),
        map,
        status,
        done));
      body.querySelector('.election').style.setProperty('--you', you);
      show('sim-event');

      // Safe states first, the closest races last for maximum drama.
      states.sort((a, b) => Math.abs(b.margin) - Math.abs(a.margin));
      let y = 0;
      let o = 0;
      let i = 0;
      const step = async () => {
        if (i >= states.length) return finale();
        const st = states[i++];
        const close = Math.abs(st.margin) < 4;
        if (close) {
          status.textContent = `Too close to call: ${st.name}…`;
          tiles.get(st.abbr).classList.add('pending');
          await sleep(reduceMotion ? 50 : 700);
        }
        const t = tiles.get(st.abbr);
        t.classList.remove('pending');
        t.classList.add(st.won ? 'won' : 'lost', 'flip');
        if (st.won) y += st.ev; else o += st.ev;
        yourEv.textContent = y;
        oppEv.textContent = o;
        yourBar.style.width = `${(y / 538) * 100}%`;
        oppBar.style.width = `${(o / 538) * 100}%`;
        if (close) { status.textContent = `${st.name} goes to ${st.won ? 'you' : 'the challenger'}!`; st.won ? Sound.correct(2) : Sound.tick(true); }
        else Sound.tick(false);
        setTimeout(step, reduceMotion ? 0 : close ? 350 : 90);
      };
      const finale = async () => {
        await sleep(reduceMotion ? 0 : 600);
        if (ev.won) {
          status.textContent = `You win ${ev.ev}–${ev.oppEv} with ${ev.popular}% of the popular vote. Four more years!`;
          slam('Re-elected!');
          Sound.fanfare(true);
          Confetti.burst({ x: 0.2, y: 0.5, count: 160, power: 1.2 });
          Confetti.burst({ x: 0.8, y: 0.5, count: 160, power: 1.2 });
        } else {
          status.textContent = `You lose ${ev.ev}–${ev.oppEv}. The challenger takes ${Math.round((100 - ev.popular) * 10) / 10}% of the vote.`;
          slam('Defeated', 'bad');
          Sound.fanfare(false);
          shakeScreen();
        }
        done.classList.remove('hidden');
        done.focus({ preventScroll: true });
      };
      done.addEventListener('click', () => { Sound.click(); resolve(); });
      g.eventResolve = resolve;
      setTimeout(step, reduceMotion ? 0 : 900);
    });
  }

  // ------------------------------------------------------------------ ending
  function ending(e) {
    g.busy = true;
    g.card = null;
    const L = e.legacy;
    const s = g.state;
    const meters = el('div', { className: 'end-meters' }, ...[['app', '👍', 'Approval'], ...METERS].map(([k, icon, label]) =>
      el('div', { className: `em ${meterClass(s.m[k])}` }, el('span', { textContent: icon }), el('small', { textContent: label }), el('b', { textContent: s.m[k] }))));
    const ach = e.achievements.length
      ? el('div', { className: 'achievements' }, ...e.achievements.map((a, i) => {
        const b = el('span', { className: 'ach', textContent: `${a.emoji} ${a.label}` });
        b.style.animationDelay = `${1 + i * 0.12}s`;
        return b;
      }))
      : el('p', { className: 'event-sub', textContent: 'No achievements unlocked this time.' });
    const timeline = el('ol', { className: 'timeline' }, ...e.timeline.map((t) =>
      el('li', { className: t.ok === 1 ? 'ok' : t.ok === 0 ? 'bad' : '' }, el('b', { textContent: t.title }), el('span', { textContent: t.choice }))));
    const nameIn = el('input', { maxLength: 20, value: s.name, placeholder: 'Name for the history books', 'aria-label': 'Name' });
    const saveBtn = el('button', { className: 'btn btn-go', type: 'submit', textContent: 'Enter the Hall of Legacies' });
    const saved = el('div', { className: 'saved hidden' });
    const form = el('form', { className: 'save' }, nameIn, saveBtn);
    const board = el('ol', { className: 'lb lb-sim' });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      saveBtn.disabled = true;
      try {
        const r = await api('/api/sim/submit', { token: g.token, name: nameIn.value.trim() || s.name });
        form.classList.add('hidden');
        saved.textContent = r.rank ? `🏛️ You're #${r.rank} in the Hall of Legacies!` : 'Saved to the history books.';
        saved.classList.remove('hidden');
        loadSimBoard(board, r.you);
        Sound.correct(3);
        if (r.rank && r.rank <= 3) Confetti.burst({ x: 0.5, y: 0.5, count: 160, spread: 2 });
      } catch (err) {
        saveBtn.disabled = false;
        toast(err.message);
      }
    });
    const again = el('button', { className: 'btn btn-mega', type: 'button' }, el('span', { textContent: 'Run again' }));
    again.addEventListener('click', openSetup);
    const home = el('button', { className: 'btn btn-ghost', type: 'button', textContent: 'Home' });
    home.addEventListener('click', goHome);

    const scoreB = el('b', { textContent: '0' });
    $('#end-body').replaceChildren(el('div', { className: `event ending ${['removed', 'resigned', 'collapse'].includes(e.type) ? 'dark' : ''}` },
      el('div', { className: 'badge end-badge', textContent: L.emoji }),
      el('div', { className: 'event-kicker', textContent: e.title }),
      el('h1', { className: 'event-title', textContent: `${L.tier} President` }),
      el('p', { className: 'event-sub', textContent: e.text }),
      el('div', { className: 'legacy-row' },
        el('div', { className: 'legacy-score' }, scoreB, el('small', { textContent: 'Legacy score' })),
        el('div', { className: 'legacy-rank' }, el('b', { textContent: `#${L.rank}` }), el('small', { textContent: 'of 47 presidents' }))),
      meters,
      el('h3', { className: 'sub', textContent: 'Achievements' }),
      ach,
      form,
      saved,
      el('div', { className: 'res-actions' }, again, home),
      el('div', { className: 'home-grid' },
        el('section', { className: 'panel' }, el('header', { className: 'panel-head' }, el('h2', { textContent: '📜 Your presidency' })), timeline),
        el('section', { className: 'panel' }, el('header', { className: 'panel-head' }, el('h2', { textContent: '🏛️ Hall of Legacies' })), board))));
    show('sim-end');
    loadSimBoard(board);

    const good = L.score >= 60;
    Sound.fanfare(good);
    if (good) {
      Confetti.burst({ x: 0.2, y: 0.6, count: 140, spread: 0.7, power: 1.2 });
      Confetti.burst({ x: 0.8, y: 0.6, count: 140, spread: 0.7, power: 1.2 });
    }
    const t0 = performance.now();
    const count = () => {
      const f = Math.min(1, (performance.now() - t0) / 1400);
      scoreB.textContent = Math.round(L.score * (1 - Math.pow(1 - f, 3)));
      if (f < 1) requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  }

  // ------------------------------------------------------------------ navigation
  function goHome() {
    cancelAnimationFrame(g.timerRaf);
    g.busy = false;
    g.pending = null;
    Sound.click();
    show('home');
    setGame('sim');
    H.loadHome();
  }

  $('#sim-play').addEventListener('click', openSetup);
  $('#sim-oath').addEventListener('click', takeOath);
  document.querySelector('[data-sim-home]').addEventListener('click', goHome);
  $('#sim-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); takeOath(); } });
  $('#sim-quit').addEventListener('click', () => {
    if (!g.state || g.state.ended || confirm('Abandon your presidency? This run will be lost.')) goHome();
  });

  addEventListener('keydown', (e) => {
    const screen = document.querySelector('.screen.active').id;
    const typing = e.target instanceof HTMLInputElement;
    if (screen === 'home' && document.body.dataset.game === 'sim' && e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); openSetup(); }
    if (screen === 'sim') {
      if (g.pending && e.key === 'Enter' && !$('#paper-next').classList.contains('hidden') && document.activeElement !== $('#paper-next')) { e.preventDefault(); closePaper(); }
      else if (!g.busy && /^[1-3]$/.test(e.key) && !typing) {
        const i = Number(e.key) - 1;
        if (g.card && g.card.options[i]) { e.preventDefault(); decide(i); }
      }
    }
  });
})();
