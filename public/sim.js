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
      Object.assign(g, { token: r.token, state: r.state, card: r.card, prevEcon: null });
      feed.length = 0;
      $('#compose-text').textContent = 'What\'s happening, Mr. President?';
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
    renderEcon();
    renderPolls();
    renderBudget();
    renderCompose();
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
    const shock = $('#shock');
    if (c.shock) {
      shock.replaceChildren(el('b', { textContent: `📉 ${c.shock.text}` }), ...movedChips(c.shock.moved));
      shock.classList.remove('hidden');
    } else shock.classList.add('hidden');
    breakingPost(c);
    $('#decisions').replaceChildren(...c.options.map((o, i) => {
      const tags = el('div', { className: 'tags' });
      if (o.usd > 0) tags.append(el('span', { className: 'tag usd', textContent: `💸 ${fmtB(o.usd)}`, title: 'Cost to taxpayers' }));
      else if (o.usd < 0) tags.append(el('span', { className: 'tag usd save', textContent: `💰 +${fmtB(-o.usd)}`, title: 'Raises or saves money' }));
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
    renderCompose();
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
    for (const b of document.querySelectorAll('#tone-row button')) b.disabled = true;
    Sound.click();
    g.skip = false;
    openPaperShell(choice >= 0 ? g.card.options[choice].label : 'Indecision');

    let r;
    try {
      r = await api('/api/sim/choose', { token: g.token, choice });
    } catch (e) {
      toast(e.message);
      const wrap = $('#paper');
      wrap.classList.remove('open');
      wrap.classList.add('hidden');
      g.busy = false;
      buttons.forEach((b, i) => { b.disabled = !g.card.options[i].affordable; b.classList.remove('picked'); });
      renderCompose();
      startTimer();
      return;
    }
    g.token = r.token;
    g.pending = r;
    await showPaper(r.outcome);
  }

  // Show the newspaper immediately so every click gets instant feedback.
  function openPaperShell(choiceLabel) {
    const wrap = $('#paper');
    const s = g.state;
    $('#paper-date').textContent = `Year ${s.year}, Quarter ${s.quarter} · ${g.card.title}`;
    $('#paper-head').textContent = '';
    $('#paper-choice').textContent = choiceLabel === 'Indecision' ? '⏰ You ran out of time.' : `Your call: ${choiceLabel}`;
    $('#paper-deltas').replaceChildren();
    $('#paper-money').replaceChildren();
    $('#paper-next').classList.add('hidden');
    const roller = $('#roller');
    roller.className = 'roller show';
    roller.replaceChildren(el('span', { className: 'spin', textContent: '📞' }), el('span', { textContent: 'Making the call…' }));
    wrap.classList.remove('hidden');
    void wrap.offsetWidth;
    wrap.classList.add('open');
  }

  // A pause that ends early when the player taps to skip.
  function pause(ms) {
    if (reduceMotion || g.skip) return Promise.resolve();
    return new Promise((resolve) => {
      const t0 = performance.now();
      const check = () => (g.skip || performance.now() - t0 >= ms ? resolve() : setTimeout(check, 30));
      check();
    });
  }
  $('#paper').addEventListener('pointerdown', (e) => { if (!e.target.closest('#paper-next')) g.skip = true; });

  async function showPaper(out) {
    const wrap = $('#paper');
    const s = g.state;
    $('#paper-date').textContent = `Year ${s.year}, Quarter ${s.quarter} · ${out.title}`;
    const roller = $('#roller');
    roller.replaceChildren();
    roller.className = 'roller';
    if (wrap.classList.contains('hidden')) {
      wrap.classList.remove('hidden');
      void wrap.offsetWidth;
      wrap.classList.add('open');
    }

    // Dramatic beat for votes and gambles.
    if (out.bill) {
      roller.className = 'roller show';
      roller.replaceChildren(el('span', { className: 'spin', textContent: '🏛️' }), el('span', { textContent: `Congress is voting… (${out.bill.odds}% odds)` }));
      await pause(600);
      roller.replaceChildren(el('span', { className: `stamp ${out.bill.passed ? 'ok' : 'bad'}`, textContent: out.bill.passed ? 'Passed' : 'Blocked' }));
      out.bill.passed ? Sound.correct(2) : Sound.wrong();
      await pause(out.rolled ? 350 : 150);
    }
    if (out.rolled) {
      roller.className = 'roller show';
      roller.replaceChildren(el('span', { className: 'spin dice', textContent: '🎲' }), el('span', { textContent: `Rolling the dice… (${out.rolled.odds}% odds)` }));
      await pause(650);
      roller.replaceChildren(el('span', { className: `stamp ${out.rolled.ok ? 'ok' : 'bad'}`, textContent: out.rolled.ok ? 'Success' : 'Failure' }));
      if (out.rolled.ok) { Sound.correct(3); flash('good'); } else { Sound.wrong(); flash('bad'); shakeScreen(); }
      await pause(150);
    }

    // Headline types out.
    const head = $('#paper-head');
    const text = out.news || '';
    for (let i = 1; i <= text.length && !g.skip && !reduceMotion; i += 4) { head.textContent = text.slice(0, i); await sleep(12); }
    head.textContent = text;

    const entries = Object.entries(out.deltas).filter(([, v]) => v);
    entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    $('#paper-deltas').replaceChildren(...entries.map(([k, v], i) => {
      const chip = el('span', { className: `delta ${v > 0 ? 'up' : 'down'}`, textContent: `${ICON[k] || ''} ${LABEL[k] || k} ${v > 0 ? '+' : ''}${v}` });
      chip.style.animationDelay = `${i * 0.06}s`;
      return chip;
    }));
    if (!entries.length) $('#paper-deltas').append(el('span', { className: 'delta', textContent: 'No measurable change' }));
    const money = [];
    if (out.usd > 0) money.push(el('span', { className: 'money cost', textContent: `💸 Price tag: ${fmtB(out.usd, true)}` }));
    else if (out.usd < 0) money.push(el('span', { className: 'money save', textContent: `💰 Raises ${fmtB(-out.usd, true)}` }));
    money.push(...movedChips(out.econMoved || {}, true));
    $('#paper-money').replaceChildren(...money);
    reactions(out);
    const net = entries.reduce((a, [k, v]) => a + (k === 'app' ? v * 1.5 : v), 0);
    if (!out.rolled && !out.bill) (net >= 0 ? Sound.correct(1) : Sound.wrong());

    $('#paper-next').classList.remove('hidden');
    $('#paper-next').focus({ preventScroll: true });
  }


  async function closePaper() {
    if (!g.pending) return;
    const r = g.pending;
    g.pending = null;
    const wrap = $('#paper');
    wrap.classList.remove('open');
    await sleep(reduceMotion ? 0 : 140);
    wrap.classList.add('hidden');
    g.prevEcon = g.state.econ;
    g.state = r.state;
    renderState(r.outcome.deltas);
    if (r.outcome.deltas.app >= 5) Confetti.burst({ x: 0.15, y: 0.15, count: 50, spread: 0.8 });

    if (r.outcome.event) {
      await sleep(reduceMotion ? 0 : 300);
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
      const skipBtn = el('button', { className: 'btn btn-ghost en-skip', type: 'button', textContent: 'Skip to results ⏭' });
      g.skip = false;
      skipBtn.addEventListener('click', () => { g.skip = true; skipBtn.remove(); });
      body.replaceChildren(el('div', { className: 'event election' },
        el('div', { className: 'event-kicker', textContent: 'Election night' }),
        el('div', { className: 'ev-race' },
          el('div', { className: 'ev-side you-side' }, el('small', { textContent: `${s.name} (${s.partyLabel})` }), yourEv),
          el('div', { className: 'ev-target', textContent: '270 to win' }),
          el('div', { className: 'ev-side opp-side' }, el('small', { textContent: 'The Challenger' }), oppEv)),
        el('div', { className: 'ev-bar' }, yourBar, el('span', { className: 'ev-270' }), oppBar),
        map,
        status,
        skipBtn,
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
          await pause(650);
        }
        const t = tiles.get(st.abbr);
        t.classList.remove('pending');
        t.classList.add(st.won ? 'won' : 'lost', 'flip');
        if (st.won) y += st.ev; else o += st.ev;
        yourEv.textContent = y;
        oppEv.textContent = o;
        yourBar.style.width = `${(y / 538) * 100}%`;
        oppBar.style.width = `${(o / 538) * 100}%`;
        if (!g.skip) {
          if (close) { status.textContent = `${st.name} goes to ${st.won ? 'you' : 'the challenger'}!`; st.won ? Sound.correct(2) : Sound.tick(true); }
          else Sound.tick(false);
        }
        setTimeout(step, reduceMotion || g.skip ? 0 : close ? 300 : 70);
      };
      const finale = async () => {
        skipBtn.remove();
        await sleep(reduceMotion ? 0 : 400);
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
      setTimeout(step, reduceMotion ? 0 : 600);
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
      reportCard(e.report),
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

  // ------------------------------------------------------------------ money & markets
  function fmtB(b, long) {
    const a = Math.abs(b);
    if (a >= 1000) return `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)} ${long ? 'trillion' : 'T'}`.replace(' T', 'T');
    return long ? `$${Math.round(a)} billion` : `$${Math.round(a)}B`;
  }
  const fmtPct = (v) => `${v > 0 ? '+' : ''}${(Math.round(v * 10) / 10).toFixed(1)}`;

  // Small chips describing how the economy moved ("Dow −14.0%", "Jobless +2.4 pts").
  function movedChips(m, light) {
    const out = [];
    const chip = (text, good) => el('span', { className: `mchip ${good ? 'good' : 'bad'} ${light ? 'light' : ''}`, textContent: text });
    if (m.dow && Math.abs(m.dow) >= 0.5) out.push(chip(`${m.dow > 0 ? '📈' : '📉'} Dow ${fmtPct(m.dow)}%`, m.dow > 0));
    if (m.u && Math.abs(m.u) >= 0.1) out.push(chip(`👷 Jobless ${fmtPct(m.u)} pts`, m.u < 0));
    if (m.i && Math.abs(m.i) >= 0.1) out.push(chip(`🛒 Inflation ${fmtPct(m.i)} pts`, m.i < 0));
    if (m.g && Math.abs(m.g) >= 0.1) out.push(chip(`🏭 Growth ${fmtPct(m.g)} pts`, m.g > 0));
    if (m.gas && Math.abs(m.gas) >= 0.05) out.push(chip(`⛽ Gas ${m.gas > 0 ? '+' : '−'}$${Math.abs(m.gas).toFixed(2)}`, m.gas < 0));
    return out;
  }

  const INDICATORS = [
    ['g', '🏭', 'GDP growth', (v) => `${v.toFixed(1)}%`, 1, 0],
    ['u', '👷', 'Unemployment', (v) => `${v.toFixed(1)}%`, -1, 1],
    ['i', '🛒', 'Inflation', (v) => `${v.toFixed(1)}%`, -1, 2],
    ['dow', '📈', 'Dow Jones', (v) => Math.round(v).toLocaleString('en-US'), 1, 3],
    ['gas', '⛽', 'Gas', (v) => `$${v.toFixed(2)}`, -1, 4],
    ['debt', '🏦', 'National debt', (v) => `$${v.toFixed(1)}T`, -1, 5],
  ];

  function spark(hist, idx, good) {
    const pts = hist.map((h) => h[idx]);
    if (pts.length < 2) return el('span', { className: 'spark-empty', textContent: 'trend after Q1' });
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    const span = hi - lo || 1;
    const d = pts.map((v, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(28 - ((v - lo) / span) * 26).toFixed(1)}`).join(' ');
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 30');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', `spark ${good ? 'good' : 'bad'}`);
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', d);
    svg.append(line);
    return svg;
  }

  function renderEcon() {
    const e = g.state.econ;
    const prev = g.prevEcon;
    $('#econ-strip').replaceChildren(...INDICATORS.map(([k, icon, label, fmt, dir]) => {
      const v = e[k];
      const delta = prev ? v - prev[k] : 0;
      const moved = Math.abs(delta) > (k === 'dow' ? 20 : k === 'gas' ? 0.01 : 0.05);
      const good = delta * dir > 0;
      const t = el('div', { className: `ind ${moved ? (good ? 'good' : 'bad') : ''}` },
        el('small', { textContent: `${icon} ${label}` }),
        el('b', { textContent: fmt(v) }),
        el('i', { textContent: moved ? `${delta > 0 ? '▲' : '▼'}` : '' }));
      if (moved) { t.classList.add('pulse'); }
      return t;
    }));

    const extra = [
      ['💵', 'GDP', `$${e.gdp.toFixed(1)}T`, null],
      ['📉', 'Deficit / yr', `$${e.def.toFixed(2)}T`, e.def > 2.5 ? 'bad' : ''],
      ['⚖️', 'Debt-to-GDP', `${e.debtGdp}%`, e.debtGdp > 140 ? 'bad' : ''],
      ['😊', 'Consumer confidence', `${e.conf}`, e.conf < 85 ? 'bad' : e.conf > 110 ? 'good' : ''],
      ['😣', 'Misery index', `${e.misery}`, e.misery > 9 ? 'bad' : e.misery < 7 ? 'good' : '', 'Unemployment + inflation'],
    ];
    $('#econ-grid').replaceChildren(
      ...INDICATORS.map(([k, icon, label, fmt, dir, idx]) => {
        const first = e.hist.length ? e.hist[0][idx] : e[k];
        const good = (e[k] - first) * dir >= 0;
        return el('div', { className: 'ecard' }, el('small', { textContent: `${icon} ${label}` }), el('b', { textContent: fmt(e[k]) }), spark(e.hist, idx, good));
      }),
      ...extra.map(([icon, label, val, cls, title]) => el('div', { className: `ecard mini ${cls || ''}`, title: title || '' }, el('small', { textContent: `${icon} ${label}` }), el('b', { textContent: val }))),
    );
  }

  function renderPolls() {
    const s = g.state;
    $('#polls').replaceChildren(
      el('div', { className: 'poll-head' }, el('b', { textContent: `${s.m.app}%` }), el('span', { textContent: ' national approval' })),
      ...s.polls.map((p) => el('div', { className: `poll ${p.pct >= 55 ? 'good' : p.pct < 35 ? 'bad' : ''}` },
        el('span', { className: 'p-label', textContent: `${p.emoji} ${p.label}` }),
        el('span', { className: 'p-bar' }, Object.assign(el('i'), { style: `width:${p.pct}%` })),
        el('b', { textContent: `${p.pct}%` }))),
      el('p', { className: 'poll-note', textContent: 'Approval by group. Swing groups decide elections: watch Independents and the working class.' }),
    );
  }

  function renderBudget() {
    const s = g.state;
    const e = s.econ;
    const rows = [
      ['💸 Spent on your decisions', fmtB(e.spent, true)],
      ['💰 Raised or saved', fmtB(e.revenue, true)],
      ['📉 Annual deficit', `$${e.def.toFixed(2)} trillion`],
      ['🏦 National debt', `$${e.debt.toFixed(1)} trillion`],
      ['➕ Debt added on your watch', `$${(e.debt - e.start.debt).toFixed(1)} trillion`],
      ['⚖️ Debt-to-GDP', `${e.debtGdp}%`],
    ];
    const items = s.budget.slice().sort((a, b) => Math.abs(b.usd) - Math.abs(a.usd)).slice(0, 12);
    $('#budget').replaceChildren(
      el('div', { className: 'b-rows' }, ...rows.map(([k, v]) => el('div', { className: 'b-row' }, el('span', { textContent: k }), el('b', { textContent: v })))),
      el('h4', { textContent: 'Biggest line items' }),
      items.length
        ? el('ol', { className: 'b-items' }, ...items.map((it) => el('li', { className: it.usd < 0 ? 'save' : '' },
          el('span', {}, el('b', { textContent: it.choice }), el('small', { textContent: it.title })),
          el('em', { textContent: `${it.usd < 0 ? '+' : '−'}${fmtB(Math.abs(it.usd))}` }))))
        : el('p', { className: 'poll-note', textContent: 'No spending decisions yet.' }),
    );
  }

  function reportCard(r) {
    if (!r) return el('span');
    const items = [
      ['🏭', 'Avg GDP growth', `${r.gdpGrowth}%/yr`, r.gdpGrowth >= 2],
      ['👷', r.jobs >= 0 ? 'Jobs created' : 'Jobs lost', `${Math.abs(r.jobs)}M`, r.jobs >= 0],
      ['📈', 'Dow Jones', `${r.dowChange > 0 ? '+' : ''}${r.dowChange}%`, r.dowChange >= 0],
      ['🏦', 'Debt added', `$${r.debtAdded}T`, r.debtAdded < 12],
      ['💸', 'Spent on decisions', fmtB(r.spent), r.spent < 3000],
      ['💰', 'Raised / saved', fmtB(r.revenue), true],
      ['🛒', 'Final inflation', `${r.finalI}%`, r.finalI <= 3.5],
      ['⛽', 'Final gas price', `$${r.finalGas.toFixed(2)}`, r.finalGas <= 3.8],
    ];
    return el('section', { className: 'report' },
      el('h3', { className: 'sub', textContent: '📊 Your economic record' }),
      el('div', { className: 'report-grid' }, ...items.map(([icon, label, val, good]) =>
        el('div', { className: `rc ${good ? 'good' : 'bad'}` }, el('span', { textContent: icon }), el('small', { textContent: label }), el('b', { textContent: val })))));
  }

  // ------------------------------------------------------------------ Chirp (social media)
  const feed = [];
  const PERSONAS = {
    opp: { name: 'Sen. Dana Whitfield', handle: '@OppositionLeader', av: '🥊', verified: true },
    press: { name: 'White House Press Office', handle: '@PressSec', av: '🎙️', verified: true },
    news: { name: 'Breaking News Now', handle: '@BreakingNow', av: '🚨', verified: true },
    wall: { name: 'Wall St Watcher', handle: '@WallStWatcher', av: '📈', keys: ['eco'] },
    mom: { name: 'Jess from Ohio', handle: '@MainStreetMom', av: '🛒', keys: ['app', 'tre'] },
    union: { name: 'Union Strong', handle: '@UnionStrong', av: '🧰', keys: ['uni', 'eco'] },
    green: { name: 'Green Future Now', handle: '@GreenFutureNow', av: '🌍', keys: ['env'] },
    vets: { name: 'Veterans First', handle: '@VetsFirst', av: '🎖️', keys: ['sec'] },
    world: { name: 'Global Desk', handle: '@GlobalDesk', av: '🌐', keys: ['dip'] },
    base: { name: 'Proud Supporter', handle: '@HeartlandPatriot', av: '🦅', keys: ['base'] },
    genz: { name: 'gen z politics', handle: '@genzpolitics', av: '💅', keys: ['env', 'app'] },
    hawk: { name: 'Deficit Hawk', handle: '@DeficitHawk', av: '🧮', keys: ['tre'] },
    unity: { name: 'Purple America', handle: '@PurpleAmerica', av: '🤝', keys: ['uni'] },
    facts: { name: 'Fiona | Fact Check', handle: '@FactCheckFiona', av: '🔎', verified: true },
  };
  const T = {
    wall: { pos: ['Markets LOVE this. Buying the dip. 🚀', 'Bullish on {choice}. Futures already up.', 'Finally some adults in the room. Stocks ripping.'], neg: ['Sold everything. {choice}?? Seriously?', 'Markets hate uncertainty and this is pure uncertainty. 📉', 'My 401k just sent me a sympathy card.'] },
    mom: { pos: ['Okay this actually helps families like mine. Thank you. 🙏', 'Three kids, two jobs. {choice} = a little breathing room.', 'Didn\'t vote for them but credit where it\'s due.'], neg: ['Who is paying for this? Oh right, US. 🙄', 'Groceries are still insane and THIS is the plan?', '{choice}. Cool. Still can\'t afford eggs.'] },
    union: { pos: ['Working people WIN today. ✊', 'Solidarity! {choice} is a big deal for workers.', 'This is what standing with labor looks like.'], neg: ['Workers get crumbs again.', 'Hey Mr. President, remember who knocked on doors for you?', '{choice}? Corporate America says thanks.'] },
    green: { pos: ['A real climate win!! 🌱🌱', 'Future generations will remember {choice}.', 'This is the energy we need. Literally.'], neg: ['The planet is literally on fire and we\'re doing THIS? 🔥', 'Climate betrayal. Plain and simple.', '{choice} = more emissions. We see you.'] },
    vets: { pos: ['Strong move. America stands tall. 🇺🇸', 'Respect, Commander-in-Chief.', 'This keeps our troops and our country safer.'], neg: ['Weakness invites aggression.', 'Our adversaries are laughing right now.', 'Served 20 years. This is NOT how you keep America safe.'] },
    world: { pos: ['Allies are welcoming the U.S. move, diplomats tell me.', 'Rare moment of global praise for Washington.', 'Foreign ministers calling it "a return to leadership."'], neg: ['Allies are quietly furious, sources say.', 'This will cost the U.S. credibility abroad.', 'Rivals are celebrating this decision. Not a good sign.'] },
    base: { pos: ['THIS is why we voted for you!!! 🦅🦅', 'Best president in my lifetime. Not even close.', 'Promises made, promises kept. 🇺🇸'], neg: ['Very disappointed. Not what we signed up for.', 'Starting to feel like you forgot who got you here.', 'Unfollowing. Unbelievable.'] },
    genz: { pos: ['ok this is actually kinda iconic 💅', 'president understood the assignment fr', 'not me agreeing with a politician for once'], neg: ['this is giving out of touch 💀', 'we\'re cooked', 'ratio + you\'re losing the youth vote'] },
    hawk: { pos: ['A rare act of fiscal sanity. 👏', 'Finally, someone looking at the bill.', 'Debt matters. Glad someone remembered.'], neg: ['Another {usd} on the national credit card. 💳', 'The debt clock just sped up. Again.', '{usd}. Our grandkids will be paying for {choice}.'] },
    unity: { pos: ['Both sides are actually praising this. Wild.', 'This is how you bring people together. 🤝', 'Rare bipartisan moment.'], neg: ['This is going to divide the country even more.', 'My family group chat is on fire after {choice}.', 'More fuel for the culture war.'] },
  };
  const OPP_LINES = ['A reckless decision from a failing White House.', 'The American people deserve better than {choice}.', 'Another mess we\'ll have to clean up.', 'This administration is in over its head.', 'Wrong call. The country will pay for this.'];
  const PRESS_LINES = ['Bold, decisive leadership. {choice}. 🇺🇸', 'The President acted to protect American families today.', 'Promises kept. {choice}.', 'Results, not rhetoric.', 'Leadership means making the hard calls.'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fill = (t, out) => t.replace(/\{choice\}/g, out.choice || '').replace(/\{usd\}/g, out.usd ? fmtB(Math.abs(out.usd)) : 'Billions');
  const fmtK = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`);
  const hashtag = (t) => `#${String(t).replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;

  function addPost(p) {
    feed.unshift(p);
    if (feed.length > 60) feed.pop();
  }

  function breakingPost(c) {
    addPost({ who: PERSONAS.news, text: `BREAKING: ${c.title}. ${c.shock ? c.shock.text + '.' : 'The White House is expected to respond shortly.'}`, likes: 20000 + Math.floor(Math.random() * 90000), tag: hashtag(c.title), news: true });
    renderFeed(true);
  }

  // How the country reacts on Chirp after a decision.
  function reactions(out) {
    const d = out.deltas || {};
    const indecisive = out.choice === 'Indecision';
    const posts = [];
    const scale = (v) => Math.round((5000 + Math.random() * 40000) * (1 + Math.abs(v || 1) / 3));
    posts.push({ who: PERSONAS.opp, text: indecisive ? 'While the country waited, the President dithered. Leadership vacuum.' : fill(pick(OPP_LINES), out), likes: scale(6) });
    if (!indecisive) posts.push({ who: PERSONAS.press, text: fill(pick(PRESS_LINES), out), likes: scale(3) });
    // Groups that felt this decision the most.
    const scored = Object.entries(T).map(([k]) => {
      const keys = PERSONAS[k].keys;
      const v = keys.reduce((a, key) => a + (d[key] || 0), 0);
      return [k, v];
    }).filter(([, v]) => Math.abs(v) >= 2).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4);
    if (!scored.length) scored.push(['mom', d.app || -1]);
    for (const [k, v] of scored) posts.push({ who: PERSONAS[k], text: fill(pick(T[k][v > 0 ? 'pos' : 'neg']), out), likes: scale(v), mood: v > 0 ? 'pos' : 'neg' });
    if (out.usd && Math.abs(out.usd) >= 50) {
      const e = g.state.econ;
      posts.push({ who: PERSONAS.facts, text: out.usd > 0 ? `FACT CHECK: ${out.choice} costs ${fmtB(out.usd, true)}. That's about $${Math.round((out.usd * 1e9) / 131e6).toLocaleString('en-US')} per household. National debt: $${e.debt.toFixed(1)}T.` : `FACT CHECK: ${out.choice} brings in ${fmtB(-out.usd, true)}, roughly $${Math.round((-out.usd * 1e9) / 131e6).toLocaleString('en-US')} per household.`, likes: scale(2) });
    }
    const tag = hashtag(indecisive ? 'President Missing' : out.choice);
    posts.reverse().forEach((p) => addPost({ ...p, tag }));
    renderFeed(true);
  }

  function renderFeed(fresh) {
    const list = $('#feed');
    list.replaceChildren(...feed.slice(0, 30).map((p, i) => {
      const li = el('li', { className: `post ${p.mine ? 'mine' : ''} ${p.news ? 'news' : ''} ${p.mood || ''}` },
        el('span', { className: 'avatar', textContent: p.who.av }),
        el('div', { className: 'post-body' },
          el('div', { className: 'post-head' }, el('b', { textContent: p.who.name }), p.who.verified ? el('i', { className: 'verified', textContent: '✔' }) : '', el('small', { textContent: p.who.handle })),
          el('p', { textContent: p.text }),
          el('div', { className: 'post-meta' },
            el('span', { textContent: `💬 ${fmtK(Math.round(p.likes / 9))}` }),
            el('span', { textContent: `🔁 ${fmtK(Math.round(p.likes / 4))}` }),
            el('span', { textContent: `❤️ ${fmtK(p.likes)}` }),
            p.views ? el('span', { textContent: `👁 ${fmtK(p.views)}` }) : '',
            p.tag ? el('em', { textContent: p.tag }) : '')));
      if (fresh && i < 8) li.style.animationDelay = `${i * 0.07}s`;
      else li.style.animation = 'none';
      return li;
    }));
    // Trending: most recent distinct hashtags.
    const tags = [...new Set(feed.map((p) => p.tag).filter(Boolean))].slice(0, 5);
    $('#trending').replaceChildren(el('b', { textContent: 'Trending' }), ...tags.map((t, i) => el('span', { textContent: `${i + 1}. ${t}` })));
    if (fresh && activeTab !== 'chirp') $('#chirp-dot').classList.remove('hidden');
  }

  const TONE_TEXT = {
    presidential: (c) => `Today I made a tough call on ${c ? c.title.toLowerCase() : 'the issues facing our country'}. We don't always agree, but we are one nation. 🇺🇸`,
    rally: () => 'PROMISES MADE, PROMISES KEPT! The best is yet to come. 🔥🔥🔥 #FourMoreYears',
    attack: () => 'The opposition had YEARS to fix this. They did NOTHING. Now we\'re getting it done. 💪',
    meme: (c) => `me walking into the Situation Room to handle ${c ? c.title.toLowerCase() : 'literally everything'} 😎🕶️ [meme.jpg]`,
  };

  function renderCompose() {
    const s = g.state;
    $('#compose-name').textContent = `President ${s.name}`;
    $('#compose-handle').textContent = '@POTUS';
    const can = s.canPost && !g.busy && !g.pending;
    for (const b of document.querySelectorAll('#tone-row button')) b.disabled = !can;
    $('#compose-status').textContent = s.canPost ? '1 post available' : 'Posted this quarter';
    $('#compose-status').className = `compose-status ${s.canPost ? 'ready' : ''}`;
  }

  async function postChirp(tone) {
    if (g.busy || g.pending || !g.state || !g.state.canPost) return;
    g.busy = true;
    for (const b of document.querySelectorAll('#tone-row button')) b.disabled = true;
    const text = TONE_TEXT[tone](g.card);
    $('#compose-text').textContent = text;
    try {
      const r = await api('/api/sim/post', { token: g.token, tone });
      g.token = r.token;
      g.state = r.state;
      const p = r.post;
      addPost({ who: { name: `President ${g.state.name}`, handle: '@POTUS', av: '🇺🇸', verified: true }, text, likes: p.viral.likes, views: p.viral.views, mine: true, tag: tone === 'rally' ? '#FourMoreYears' : hashtag(`President ${tone}`) });
      // Replies
      const ok = p.ok !== false;
      const replies = ok
        ? [[PERSONAS.base, pick(T.base.pos)], [PERSONAS.genz, pick(T.genz.pos)]]
        : [[PERSONAS.genz, 'ratio. 💀'], [PERSONAS.opp, 'Unpresidential. Embarrassing.'], [PERSONAS.unity, 'Please log off, Mr. President.']];
      if (tone === 'attack' || tone === 'rally') replies.push([PERSONAS.unity, pick(T.unity.neg)]);
      if (tone === 'presidential') replies.push([PERSONAS.unity, pick(T.unity.pos)]);
      for (const [who, txt] of replies) addPost({ who, text: txt, likes: Math.round(p.viral.likes / (6 + Math.random() * 10)), mood: ok ? 'pos' : 'neg' });
      feed.splice(0, replies.length + 1, ...feed.slice(0, replies.length + 1).reverse());
      renderFeed(true);
      renderState(p.deltas);
      const dl = Object.entries(p.deltas).filter(([, v]) => v).map(([k, v]) => `${LABEL[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ');
      if (p.ok === false) { Sound.wrong(); toast(`Ratioed! ${fmtK(p.viral.views)} views. ${dl}`); }
      else if (p.ok === true) { Sound.correct(3); toast(`🔥 Went viral! ${fmtK(p.viral.views)} views. ${dl}`); Confetti.burst({ x: 0.85, y: 0.3, count: 60, spread: 0.8 }); }
      else { Sound.correct(1); toast(`Posted. ${fmtK(p.viral.views)} views. ${dl}`); }
    } catch (err) {
      toast(err.message);
    } finally {
      g.busy = false;
      renderCompose();
    }
  }
  for (const b of document.querySelectorAll('#tone-row button')) b.addEventListener('click', () => postChirp(b.dataset.tone));

  // Side tabs
  let activeTab = 'chirp';
  for (const b of document.querySelectorAll('.side-tabs button')) {
    b.addEventListener('click', () => {
      activeTab = b.dataset.tab;
      Sound.click();
      for (const x of document.querySelectorAll('.side-tabs button')) x.setAttribute('aria-selected', String(x === b));
      for (const pane of document.querySelectorAll('.side-pane')) pane.classList.toggle('hidden', pane.dataset.pane !== activeTab);
      if (activeTab === 'chirp') $('#chirp-dot').classList.add('hidden');
    });
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
      if (!$('#paper').classList.contains('hidden') && $('#paper-next').classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.skip = true; }
      else if (g.pending && e.key === 'Enter' && !$('#paper-next').classList.contains('hidden') && document.activeElement !== $('#paper-next')) { e.preventDefault(); closePaper(); }
      else if (!g.busy && /^[1-3]$/.test(e.key) && !typing) {
        const i = Number(e.key) - 1;
        if (g.card && g.card.options[i]) { e.preventDefault(); decide(i); }
      }
    }
  });
})();
