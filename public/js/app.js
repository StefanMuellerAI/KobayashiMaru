(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const app = $('#app');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const setText = (e, v) => { if (e.textContent !== v) e.textContent = v; };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Lokaler Speicher: nur Komfort, darf jederzeit leer sein ── */
  const local = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  /* ── Sprache: eigene Wahl, sonst die Browser-Einstellung. Gespeichert wird nur eine eigene Wahl. ── */
  const I = KMI18N;
  const chosen = local.get('km.lang', null);
  let lang = I.LANGS.includes(chosen) ? chosen : I.detect(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
  const T = (k, p) => I.t(lang, k, p);
  /* Feste Texte im HTML: data-i18n setzt den Text, data-i18n-attr Attribute ("attr:schlüssel;attr:schlüssel") */
  function applyStatic() {
    document.documentElement.lang = lang;
    for (const e of $$('[data-i18n]')) setText(e, T(e.dataset.i18n));
    for (const e of $$('[data-i18n-attr]')) {
      for (const pair of e.dataset.i18nAttr.split(';')) { const [a, k] = pair.split(':'); e.setAttribute(a, T(k)); }
    }
    const md = $('meta[name="description"]'); if (md) md.setAttribute('content', T('u.descr'));
    const ll = $('#langLbl'); ll.lang = T('u.langOtherCode');
  }
  applyStatic();

  /* ── Ton ── */
  let soundOn = local.get('km.ton', true) !== false;
  let actx = null, noiseBuf = null;
  function ctxGet() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = actx || new AC();
      if (actx.state === 'suspended' && !document.hidden) actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function audio() { return soundOn ? ctxGet() : null; }
  function tone(freq, at, dur, type, gain, freqEnd) {
    const a = audio(); if (!a) return;
    try {
      const t = a.currentTime + at;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      const v = gain || 0.06;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.012);
      g.gain.setValueAtTime(v, t + Math.max(0.013, dur - 0.04));
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  }
  function noise(at, dur, gain, cutoff) {
    const a = audio(); if (!a) return;
    try {
      if (!noiseBuf) {
        noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = a.currentTime + at;
      const src = a.createBufferSource(); src.buffer = noiseBuf;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff || 900, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
      const g = a.createGain(); g.gain.setValueAtTime(gain || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(a.destination);
      src.start(t); src.stop(t + dur + 0.02);
    } catch (e) {}
  }
  const sfx = {
    tap() { tone(1320, 0, .05); tone(1760, .05, .07); },
    ok() { tone(880, 0, .08); tone(1320, .08, .08); tone(1760, .16, .12); },
    deny() { tone(330, 0, .12, 'square', .035); tone(247, .13, .18, 'square', .035); },
    alarm() { for (let i = 0; i < 3; i++) tone(440, i * .7, .55, 'sawtooth', .04, 880); },
    caution() { tone(660, 0, .18, 'triangle', .07); tone(660, .28, .18, 'triangle', .07); },
    phaser() { tone(1500, 0, .32, 'sawtooth', .04, 420); },
    torp() { tone(240, 0, .3, 'sine', .09, 70); noise(.28, .35, .1, 700); },
    hit(at) { noise(at || 0, .4, .16, 1200); tone(90, at || 0, .3, 'sine', .1, 45); },
    boom(at) { noise(at || 0, .9, .2, 1600); tone(70, at || 0, .7, 'sine', .12, 30); },
    beam() { for (let i = 0; i < 6; i++) tone(900 + i * 220, i * .09, .22, 'sine', .028); },
    decloak() { tone(70, 0, .55, 'triangle', .09, 160); },
    end() { tone(440, 0, .3, 'triangle', .06); tone(330, .32, .3, 'triangle', .06); tone(220, .64, .6, 'triangle', .06); },
    win() { tone(523, 0, .14); tone(659, .14, .14); tone(784, .28, .14); tone(1047, .42, .4); },
  };
  const soundBtn = $('#soundBtn');
  function renderSound() { $('#soundLbl').textContent = T(soundOn ? 'u.sfxOn' : 'u.sfxOff'); soundBtn.setAttribute('aria-pressed', String(soundOn)); }
  soundBtn.addEventListener('click', () => { soundOn = !soundOn; local.set('km.ton', soundOn); renderSound(); if (soundOn) sfx.ok(); });
  renderSound();

  /* ── Musik: Stimmung folgt der Lage, Start erst nach dem ersten Tippen ── */
  const music = {
    on: local.get('km.musik', true) !== false, eng: null, timer: 0, mood: 'notruf', failed: false,
    start() {
      if (!this.on || this.timer || this.failed || document.hidden) return;
      const a = ctxGet();
      if (!a || typeof MusicEngine !== 'function') { this.failed = true; return; }
      try {
        if (!this.eng) this.eng = MusicEngine(a, a.destination);
        this.eng.setMood(this.mood);
        this.eng.resync();
        this.eng.scheduleUntil(a.currentTime + 0.3);
        this.eng.fade(1, 1.2);
        this.timer = setInterval(() => { try { this.eng.scheduleUntil(a.currentTime + 0.3); } catch (e) { this.stop(); this.failed = true; } }, 70);
      } catch (e) { this.failed = true; }
      this.render();
    },
    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = 0; }
      if (this.eng) try { this.eng.fade(0, 0.25); } catch (e) {}
      this.render();
    },
    set(m) {
      if (m === this.mood) return;
      this.mood = m;
      if (this.eng) this.eng.setMood(m);
      this.render();
    },
    render() {
      $('#musicLbl').textContent = T(this.on ? 'u.musicOn' : 'u.musicOff');
      $('#musicBtn').setAttribute('aria-pressed', String(this.on));
      setText($('#musicInfo'), this.on && this.timer ? T('mood.' + this.mood) : '');
    },
  };
  $('#musicBtn').addEventListener('click', () => {
    music.on = !music.on; local.set('km.musik', music.on);
    if (music.on) music.start(); else music.stop();
    music.render();
  });
  music.render();
  /* Browser erlauben Ton erst nach einer Berührung: Musik startet beim ersten Tippen */
  const wake = () => { if (!music.on) return; if (!music.timer) music.start(); else ctxGet(); };
  for (const ev of ['pointerup', 'click', 'keydown']) document.addEventListener(ev, wake, true);
  /* Verdeckter Tab: Ton anhalten, sonst stockt die Musik */
  document.addEventListener('visibilitychange', () => {
    if (!actx) return;
    if (document.hidden) { if (music.timer) { clearInterval(music.timer); music.timer = 0; music.paused = true; } try { actx.suspend(); } catch (e) {} }
    else { try { actx.resume(); } catch (e) {} if (music.paused) { music.paused = false; music.start(); } }
  });

  /* ── Zustand ── */
  const WORDS = ['ALFA', 'BRAVO', 'DELTA', 'ECHO', 'GOLF', 'HOTEL', 'INDIA', 'KILO', 'LIMA', 'NOVA', 'OSCAR', 'PAPA', 'ROMEO', 'SIERRA', 'TANGO', 'VICTOR', 'ZULU'];
  function makeCode() {
    const pool = WORDS.slice(), out = [];
    for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0] + '-' + (1 + Math.floor(Math.random() * 9)));
    return out;
  }
  let code = local.get('km.code', null);
  if (!Array.isArray(code) || code.length !== 3 || code.some((c) => typeof c !== 'string' || !c)) { code = makeCode(); local.set('km.code', code); }
  const cleanCheats = (c) => {
    const o = Object.assign({}, KM.DEF);
    if (c && typeof c === 'object') {
      if (typeof c.verst === 'boolean') o.verst = c.verst;
      if (typeof c.abfang === 'boolean') o.abfang = c.abfang;
      if (typeof c.ruf === 'boolean') o.ruf = c.ruf;
      if (c.treffer === 50 || c.treffer === 100) o.treffer = c.treffer;
      if (c.leben === 0 || c.leben === 6) o.leben = c.leben;
    }
    return o;
  };
  let kernOpen = local.get('km.kern', false) === true;
  let cheats = kernOpen ? cleanCheats(local.get('km.params', null)) : cleanCheats(null);
  let kernFails = 0;
  let akte = local.get('km.akte', []);
  if (!Array.isArray(akte)) akte = [];
  let attempt = Number(local.get('km.n', 0)) || 0;
  const newSeed = () => 1 + Math.floor(Math.random() * 65535);
  const scCode = (seed) => 'KM-' + seed.toString(16).toUpperCase().padStart(4, '0');

  let S = null, stage = 'brief', view = 'bruecke', recorded = false;

  function begin(seed, live) {
    S = KM.newGame(seed, cheats, code);
    recorded = false;
    stage = live ? 'sim' : 'brief';
    if (live) { attempt++; local.set('km.n', attempt); }
    shown = 0; fx.length = 0; anim.pos = 0;
    render();
    $('#view-bruecke').scrollTop = 0;
  }

  /* ── Anzeige: Kopf, Instrumente ── */
  const p2 = (n) => String(n).padStart(2, '0');
  function setDigits(elm, str) {
    if (elm.dataset.v === str) return;
    elm.dataset.v = str; elm.textContent = '';
    for (const ch of str) elm.append(el('span', /\d/.test(ch) ? 'd' : 's', ch));
  }
  function gauge(id, v, s, pct, crit) {
    const g = $('#' + id);
    setText($('.gv', g), v); setText($('.gs', g), s || '');
    const m = $('.meter b', g); if (m) m.style.width = Math.max(0, Math.min(100, pct)) + '%';
    g.classList.toggle('crit', !!crit);
  }
  function renderHead() {
    setDigits($('#clock'), 'T+' + p2(S.turn) + ':00');
    setText($('#scCode'), scCode(S.seed));
    setText($('#mPhase'), stage === 'brief' ? T('u.sReady') : S.over ? T('u.sEnded') : T('phase.' + S.phase));
    setText($('#mTry'), String(stage === 'brief' ? attempt + 1 : attempt));
    const alert = stage === 'brief' || S.over ? 'normal' : S.red ? 'rot' : S.f.entered ? 'gelb' : 'normal';
    if (app.dataset.alert !== alert) {
      app.dataset.alert = alert; colors = null;
      if (alert === 'rot') { app.classList.remove('flash'); void app.offsetWidth; app.classList.add('flash'); sfx.alarm(); }
      else if (alert === 'gelb') sfx.caution();
    }
    setText($('#navBr'), T(stage === 'debrief' ? 'u.sDebrief' : stage === 'brief' ? 'u.sReady' : S.over ? 'u.sOver' : S.red ? 'u.sAlert' : 'u.sRunning'));
    setText($('#navLog'), stage === 'brief' ? '' : T('u.min', { n: S.turn }));
    setText($('#navAkte'), akte.length ? String(akte.length) : '');
    setText($('#navKern'), T(kernOpen ? (KM.isCheated(cheats) ? 'u.modified' : 'u.open') : 'u.locked'));
    const running = stage === 'sim' && !S.over;
    setText($('#resetInfo'), T(running ? 'u.abort' : 'u.attempt'));
    setText($('#resetLbl'), T(armed ? 'u.sure' : 'u.navNew'));
  }
  function renderGauges() {
    const sh = S.ship, fr = S.fr, k = S.know;
    gauge('gSh', T('u.pct', { n: sh.shields }), T(S.red ? 'u.up' : 'u.down'), sh.shields, S.red && sh.shields < 30);
    gauge('gHu', T('u.pct', { n: sh.hull }), T(!sh.warp ? 'u.noWarp' : sh.trans < 1 ? 'u.transHalf' : !sh.sensors ? 'u.sensorsOff' : 'u.intact'), sh.hull, sh.hull < 40);
    gauge('gTo', String(sh.torp), T('u.shuttles', { n: sh.shut }));
    const n = S.en.length;
    gauge('gEn', n ? String(n) : (k.echo && S.hidden > 0 ? '?' : '0'), n ? (S.hostile ? T('u.firing') : S.grace > 0 ? T('u.graceMin', { n: S.grace }) : S.ult > 0 ? T('u.ultimatum') : T('u.holdingFire')) : T(k.echo && S.hidden > 0 ? 'u.echoes' : 'u.noContact'), 0, S.hostile && n > 0);
    const ca = k.people === 'ca';
    gauge('gFr', !fr.alive ? '0' : k.people ? (ca ? '≈ ' : '') + Math.max(0, fr.aboard + (ca ? k.peopleOff : 0)) : '?', !fr.alive ? T('u.lost') : fr.pods ? T('u.inPods', { n: fr.pods }) : k.hull ? T('u.hullPct', { n: fr.hull }) : T('u.aboard'), 0, !fr.alive);
    gauge('gRe', String(S.rescued), T(S.tow ? 'u.inTow' : 'u.aboard'));
    const life = fr.life + (k.life === 'ca' ? k.lifeOff : 0);
    gauge('gLi', !fr.alive ? '–' : k.life ? (k.life === 'ca' ? '≈ ' : '') + T('u.min', { n: Math.max(1, life) }) : '?', T(S.storm > 0 ? 'u.ionStorm' : 'u.untilFail'), 0, fr.alive && k.life && life <= 3);
    gauge('gCr', String(sh.dead), T('u.ofN', { n: sh.crew }), 0, sh.dead > 0);
  }

  /* ── Meldungen und Befehle ── */
  let shown = 0;
  function reportNode(l, fresh) {
    const p = el('p', 'rp' + (l.tone ? ' ' + l.tone : '') + (fresh && !reduced ? ' new' : ''));
    const who = el('span', 'who', T('role.' + l.who));
    if (S.off[l.who]) { who.append(' '); who.append(el('i', '', T('rank.' + l.who) + ' ' + S.off[l.who])); }
    p.append(who, el('span', 'tx', KM.line(l, lang)));
    return p;
  }
  const CAT = ['resc', 'nav', 'tac', 'sens', 'comm', 'ship'];
  let keyMap = [];
  function renderConsole() {
    const box = $('#reports');
    /* Seit dem letzten Zeit kostenden Befehl: Sofortbefehle hängen ihre Meldung an */
    let from = S.log.length - 1;
    while (from > 0 && S.log[from].instant) from--;
    const lines = [];
    for (let i = from; i < S.log.length; i++) for (const l of S.log[i].rep) lines.push(l);
    const fresh = S.log.length !== shown;
    const keep = fresh && S.log[S.log.length - 1].instant ? box.children.length : 0;
    box.textContent = '';
    lines.forEach((l, i) => box.append(reportNode(l, fresh && i >= keep)));
    shown = S.log.length;
    const head = $('#turnhead'); head.textContent = '';
    head.append(el('b', '', S.log[from].order ? T('u.minuteN', { n: S.log[from].t }) : T('u.initial')));
    if (S.log[from].order) head.append(el('span', '', T('u.yourOrder', { o: KM.text(S.log[from].order, lang) })));

    const os = KM.orders(S);
    const main = os.filter((o) => !o.instant).sort((a, b) => CAT.indexOf(a.cat) - CAT.indexOf(b.cat));
    const inst = os.filter((o) => o.instant);
    const ob = $('#orders'), ib = $('#instant');
    ob.textContent = ''; ib.textContent = ''; keyMap = [];
    main.forEach((o, i) => {
      const b = el('button', 'ord c-' + o.cat); b.type = 'button'; b.dataset.id = o.id;
      const txt = el('span');
      txt.append(el('span', 'ol', KM.text(o.label, lang)));
      if (o.hint) txt.append(el('span', 'oh', KM.text(o.hint, lang)));
      b.append(txt);
      if (i < 10) { const key = String((i + 1) % 10); keyMap.push([key, o.id]); const kk = el('span', 'ok', key); kk.setAttribute('aria-hidden', 'true'); b.append(kk); }
      ob.append(b);
    });
    inst.forEach((o) => {
      const b = el('button', 'chip'); b.type = 'button'; b.dataset.id = o.id;
      b.append(KM.text(o.label, lang), el('small', '', T('u.instant') + ' ' + KM.text(o.hint, lang)));
      ib.append(b);
    });
    $('#ask').hidden = S.over;
    ob.hidden = S.over; ib.hidden = S.over || !inst.length;
    $('#endRow').hidden = !S.over;
  }

  function doOrder(id) {
    if (!S || S.over || stage !== 'sim') return;
    const instant = !!KM.INSTANT[id];
    const from = { pos: S.pos };
    if (!KM.order(S, id)) return;
    playFx(S.fx, from);
    if (S.over) { record(); (S.out === 'sieg' ? sfx.win : sfx.end)(); }
    else if (instant) sfx.tap();
    const v = $('#view-bruecke'), h0 = v.scrollHeight, s0 = v.scrollTop;
    render();
    /* Zeit kostende Befehle: zurück nach oben zu Anzeige und Meldungen. Sofortbefehle: Liste bleibt unter dem Finger stehen. */
    v.scrollTop = instant ? Math.max(0, s0 + (v.scrollHeight - h0)) : 0;
  }
  $('#orders').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) doOrder(b.dataset.id); });
  $('#instant').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) doOrder(b.dataset.id); });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || view !== 'bruecke' || stage !== 'sim') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const hit = keyMap.find((k) => k[0] === e.key);
    if (hit) { e.preventDefault(); doOrder(hit[1]); }
  });

  /* ── Akte ── */
  /* Akte-Einträge speichern Schlüssel statt Text, damit sie in jeder Sprache lesbar sind.
     Ältere Einträge mit fertigem deutschen Text (typ, head, grade) werden weiter so angezeigt. */
  function record() {
    if (recorded) return;
    recorded = true;
    const ev = KM.evaluate(S, lang);
    akte.unshift({
      n: attempt, code: scCode(S.seed), ts: Date.now(), type: S.sc.type, hk: ev.hk,
      saved: S.res.saved, people: S.res.people, crewDead: S.res.crewDead, total: ev.total, cheated: ev.cheated, win: ev.win, min: S.turn,
    });
    if (akte.length > 60) akte.length = 60;
    local.set('km.akte', akte);
  }
  const DATE = {
    de: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    en: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  };
  function renderAkte() {
    const list = $('#akteList'); list.textContent = '';
    $('#akteEmpty').hidden = akte.length > 0;
    const valid = akte.filter((a) => !a.cheated);
    const best = valid.reduce((m, a) => Math.max(m, a.total), 0);
    const sum = $('#akteSum');
    sum.hidden = !akte.length;
    sum.textContent = akte.length ? T('u.recordSum', { n: akte.length, best: valid.length ? best : null }) : '';
    /* Alter Eintrag: deutschen Text über die deutschen Texte zurück auf den Schlüssel führen */
    const fromDe = (prefix, s) => { for (const k in I.T.de) if (k.startsWith(prefix) && k.split('.').length === 2 && I.T.de[k] === s) return T(k); return s || ''; };
    for (const a of akte) {
      const type = a.type ? T('type.' + a.type) : fromDe('type.', a.typ);
      const head = a.hk ? T('hd.' + a.hk) : fromDe('hd.', a.head);
      const grade = a.hk ? T('gr.' + KM.gradeKey(a.total)) : fromDe('gr.', a.grade);
      let when = '';
      try { when = T('u.time', { d: new Date(a.ts).toLocaleString(T('u.dateLocale'), DATE[lang] || DATE.de) }); } catch (e) {}
      const li = el('li');
      li.append(
        el('span', 'a1', T('u.recordHead', { n: a.n, code: a.code, type })),
        el('span', 'a2', a.cheated ? '–' : String(a.total)),
        el('span', 'a3', T('u.recordLine', { head, saved: a.saved, people: a.people, crewDead: a.crewDead, min: a.min })),
        el('span', 'a4', (a.cheated ? T(a.win ? 'u.recordCheatWin' : 'u.recordCheat') : grade) + ' ' + when)
      );
      list.append(li);
    }
  }

  /* ── Auswertung ── */
  function renderDebrief() {
    const box = $('#debrief'); box.textContent = '';
    const ev = KM.evaluate(S, lang);
    const r = S.res;
    box.append(el('p', 'db-eyebrow', T('u.debriefEyebrow', { code: scCode(S.seed), n: attempt })));
    box.append(el('h2', 'db-head', ev.head));
    box.append(el('p', 'db-text', ev.text));

    const v = el('div', 'verdict' + (ev.cheated ? ' off' : ev.pass ? '' : ' fail'));
    if (ev.cheated) {
      v.append(el('span', 'vg', T(ev.win ? 'u.suspended' : 'u.notScored')));
    } else {
      v.append(el('span', 'vg', ev.grade));
      const vt = el('span', 'vt', String(ev.total)); vt.append(el('small', '', T('u.of100'))); v.append(vt);
    }
    box.append(v);
    if (ev.cheated) box.append(el('p', 'closing', T(ev.win ? 'u.cheatWin' : 'u.cheatLoss')));
    const pr = el('p', 'profile'); pr.append(el('b', '', T('u.profile', { name: ev.profile[0] })), ' ' + ev.profile[1]); box.append(pr);

    const facts = el('dl', 'facts');
    const fact = (k, val) => { const d = el('div'); d.append(el('dt', '', T(k)), el('dd', '', val)); facts.append(d); };
    fact('u.fSaved', T('u.nOfM', { n: r.saved, m: r.people }));
    fact('u.fLosses', T('u.nOfM', { n: r.crewDead, m: S.ship.crew }));
    fact('u.fShip', r.captured ? T('u.enemyHands') : r.shipLost ? T('u.shipLost') : T('u.hullPct', { n: r.hull }));
    fact('u.fTreaty', T(S.f.entered ? 'u.broken' : 'u.kept'));
    fact('u.fKills', String(S.kills));
    fact('u.fDuration', T('u.min', { n: S.turn }));
    box.append(facts);

    box.append(el('h3', 'h', T('u.hBoard')));
    const scs = el('dl', 'scores');
    for (const x of ev.sc) {
      const d = el('div', 'sc'); const m = el('dd', 'meter'); const b = el('b'); b.style.width = x.v + '%'; m.append(b);
      d.append(el('dt', '', x.label), el('dd', 'v', String(x.v)), m); scs.append(d);
    }
    box.append(scs);

    box.append(el('h3', 'h', T('u.hObs')));
    const ul = el('ul', 'obs');
    for (const o of ev.obs) {
      const li = el('li', o.s > 0 ? 'plus' : o.s < 0 ? 'minus' : 'neutral');
      const m = el('span', 'm', o.s > 0 ? '+' : o.s < 0 ? '−' : '·'); m.setAttribute('aria-hidden', 'true');
      li.append(m, el('span', '', o.t));
      li.setAttribute('aria-label', T(o.s > 0 ? 'u.obsPlus' : o.s < 0 ? 'u.obsMinus' : 'u.obsNote') + o.t);
      ul.append(li);
    }
    box.append(ul);

    box.append(el('h3', 'h', T('u.hHidden')));
    const rv = el('dl', 'reveal');
    for (const [k, val, n] of ev.reveal) { const d = el('div'); d.append(el('dt', '', k), el('dd', 'rv', val)); if (n) d.append(el('dd', 'rn', n)); rv.append(d); }
    box.append(rv);

    box.append(el('p', 'closing', T(ev.win ? 'u.closeWin' : 'u.closeLoss')));
    const row = el('div', 'row');
    const b1 = el('button', 'pill', T('u.again')); b1.type = 'button'; b1.addEventListener('click', () => { sfx.ok(); begin(newSeed(), true); });
    const b2 = el('button', 'pill alt', T('u.same')); b2.type = 'button'; b2.addEventListener('click', () => { sfx.ok(); begin(S.seed, true); });
    const b3 = el('button', 'pill quiet', T('u.readLog')); b3.type = 'button'; b3.addEventListener('click', () => show('protokoll'));
    row.append(b1, b2, b3); box.append(row);
  }

  function renderProtokoll() {
    const box = $('#plog'); box.textContent = '';
    const live = stage !== 'brief';
    $('#plogEmpty').hidden = live;
    if (!live) return;
    for (const e of S.log) {
      const sec = el('section');
      const h = el('div', 'turnhead');
      h.append(el('b', '', e.order ? (e.instant ? T('u.instantOrder') : T('u.minuteN', { n: e.t })) : T('u.initial')));
      if (e.order) h.append(el('span', '', KM.text(e.order, lang)));
      sec.append(h);
      for (const l of e.rep) sec.append(reportNode(l, false));
      box.append(sec);
    }
  }

  /* ── Wartung: der Simulationskern ── */
  /* Parameter: Schlüssel und Auswahl. Name und Beschreibung stehen in i18n.js unter pa.<schlüssel> */
  const PARAMS = [
    ['verst', [[true, 'pa.verst.on'], [false, 'pa.off']]],
    ['abfang', [[true, 'pa.abfang.on'], [false, 'pa.off']]],
    ['treffer', [[100, ['u.pct', { n: 100 }]], [50, ['u.pct', { n: 50 }]]]],
    ['leben', [[0, 'pa.leben.std'], [6, 'pa.leben.plus']]],
    ['ruf', [[false, 'pa.ruf.off'], [true, 'pa.ruf.on']]],
  ];
  function renderKern() {
    $('#kernLocked').hidden = kernOpen; $('#kernOpen').hidden = !kernOpen;
    renderKernNote();
    if (!kernOpen) return;
    const n = PARAMS.filter((p) => cheats[p[0]] !== KM.DEF[p[0]]).length;
    $('#kernState').textContent = T('u.coreState', { n });
    const box = $('#params'); box.textContent = '';
    for (const [key, opts] of PARAMS) {
      const name = T('pa.' + key);
      const d = el('div', 'param');
      d.append(el('span', 'pn', name), el('span', 'pd', T('pa.' + key + '.d')));
      const seg = el('div', 'seg2'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', name);
      for (const [val, label] of opts) {
        const b = el('button', '', I.text(lang, label)); b.type = 'button';
        b.setAttribute('aria-pressed', String(cheats[key] === val));
        b.addEventListener('click', () => { cheats[key] = val; local.set('km.params', cheats); sfx.tap(); renderKern(); renderHead(); });
        seg.append(b);
      }
      d.append(seg); box.append(d);
    }
  }
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  /* Hinweis nach falschem Code: als Zustand gemerkt, damit er beim Sprachwechsel mitwechselt */
  let kernDenied = false;
  function renderKernNote() {
    const note = $('#kernNote');
    note.classList.toggle('bad', kernDenied);
    setText(note, kernDenied ? T('u.denied', { hint: kernFails >= 2 }) : '');
  }
  function tryLogin() {
    const inp = $('#kernCode');
    if (!norm(inp.value)) { inp.focus(); return; }
    if (norm(inp.value) === norm(code.join(''))) {
      kernOpen = true; local.set('km.kern', true); inp.value = ''; kernDenied = false;
      sfx.ok(); renderKern(); renderHead();
      return;
    }
    kernFails++;
    sfx.deny();
    kernDenied = true;
    renderKernNote();
  }
  $('#kernBtn').addEventListener('click', tryLogin);
  $('#kernCode').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); tryLogin(); } });
  $('#kernReset').addEventListener('click', () => { cheats = cleanCheats(null); local.set('km.params', cheats); sfx.ok(); renderKern(); renderHead(); });
  $('#kernOut').addEventListener('click', () => { kernOpen = false; cheats = cleanCheats(null); local.set('km.kern', false); local.set('km.params', cheats); sfx.tap(); renderKern(); renderHead(); });

  /* ── Taktische Anzeige ── */
  const cv = $('#tac'), ctx = cv.getContext('2d');
  let colors = null, cw = 0, ch = 0;
  const fx = [];
  const anim = { pos: 0 };
  let stars = [], starSeed = -1;
  function readColors() {
    const cs = getComputedStyle(app);
    const g = (n) => cs.getPropertyValue(n).trim() || '#fff';
    colors = { amber: g('--amber'), peach: g('--peach'), lilac: g('--lilac'), peri: g('--peri'), ice: g('--ice'), mars: g('--mars'), hot: g('--hot'), dim: g('--dim'), text: g('--text') };
  }
  function sizeCanvas() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (!r.width || !r.height) return false;
    if (cw !== r.width || ch !== r.height || cv.width !== Math.round(r.width * dpr)) {
      cw = r.width; ch = r.height;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    }
    ctx.setTransform(cv.width / cw, 0, 0, cv.height / ch, 0, 0);
    return true;
  }
  function geo() {
    const x0 = Math.max(30, cw * 0.1), xF = cw - Math.max(64, cw * 0.2), cy = ch * 0.58;
    const R = Math.min(ch * 0.34, cw * 0.17, 74);
    const sx = S.phase === 'grenze' && !S.over ? x0 - 12 : x0 + (xF - x0) * Math.min(1, anim.pos / S.sc.dist);
    const sy = cy;
    const tow = S.tow && S.fr.alive;
    const fxp = tow ? sx + 26 : xF + Math.min(34, cw * 0.09), fyp = tow ? sy - 22 : cy - Math.min(30, ch * 0.2);
    return { x0, xF, cy, R, sx, sy, fx: fxp, fy: fyp };
  }
  function enemyPos(G, a, d) {
    let x = G.sx + Math.cos(a) * G.R * d * 1.25, y = G.sy + Math.sin(a) * G.R * d * 0.9;
    return [Math.max(10, Math.min(cw - 10, x)), Math.max(12, Math.min(ch - 10, y))];
  }
  function playFx(list, from) {
    const now = performance.now();
    let hitAt = 0;
    for (const f of list) {
      const o = Object.assign({ t0: now, dur: 600 }, f);
      if (f.k === 'phaser') { o.dur = 420; sfx.phaser(); hitAt = .35; }
      else if (f.k === 'torp') { o.dur = 620; sfx.torp(); hitAt = .5; }
      else if (f.k === 'boom') { o.t0 = now + 350; o.dur = 700; sfx.boom(.35); }
      else if (f.k === 'volley') { o.t0 = now + hitAt * 1000 + 250; o.dur = 520; sfx.hit(hitAt + .25); }
      else if (f.k === 'beam') { o.dur = 1100; sfx.beam(); }
      else if (f.k === 'shuttle') { o.dur = 1200; }
      else if (f.k === 'mine') { o.dur = 500; sfx.hit(0); }
      else if (f.k === 'frhit') { o.t0 = now + 400; o.dur = 500; }
      else if (f.k === 'decloak') { o.dur = 700; if (!list._d) { list._d = 1; sfx.decloak(); } }
      else if (f.k === 'shipboom') { o.t0 = now + 500; o.dur = 1400; sfx.boom(.5); }
      else if (f.k === 'leave') { o.dur = 900; }
      fx.push(o);
    }
  }
  function diamond(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  function label(t, x, y, col, align, size) {
    ctx.font = '600 ' + (size || (cw >= 380 ? 13 : 11)) + 'px Antonio, "Arial Narrow", sans-serif';
    ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(t.toUpperCase(), x, y);
  }
  function draw(now) {
    if (!S || !sizeCanvas()) return;
    if (!colors) readColors();
    const C = colors;
    /* Fahrt weich nachziehen */
    if (reduced) anim.pos = S.pos; else anim.pos += (S.pos - anim.pos) * 0.12;
    if (Math.abs(S.pos - anim.pos) < 0.01) anim.pos = S.pos;
    const G = geo();
    ctx.clearRect(0, 0, cw, ch);
    if (starSeed !== S.seed) {
      starSeed = S.seed; stars = [];
      let a = S.seed * 2654435761 >>> 0;
      const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
      for (let i = 0; i < 46; i++) stars.push([r(), r(), 0.4 + r() * 0.9, r(), r()]);
    }
    ctx.fillStyle = C.text;
    for (const s of stars) { ctx.globalAlpha = 0.18 + s[3] * 0.3; ctx.fillRect(s[0] * cw, s[1] * ch, s[2], s[2]); }
    ctx.globalAlpha = 1;

    /* Neutrale Zone: schraffiert rechts der Grenze */
    ctx.save();
    ctx.beginPath(); ctx.rect(G.x0, 0, cw - G.x0, ch); ctx.clip();
    ctx.strokeStyle = C.peri; ctx.globalAlpha = 0.13; ctx.lineWidth = 1;
    for (let x = G.x0 - ch; x < cw; x += 14) { ctx.beginPath(); ctx.moveTo(x, ch); ctx.lineTo(x + ch, 0); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = C.peri; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(G.x0, 0); ctx.lineTo(G.x0, ch); ctx.stroke(); ctx.setLineDash([]);
    label(T('u.neutralZone'), G.x0 + 8, 12, C.peri);
    ctx.save(); ctx.translate(G.x0 - 8, ch - 8); ctx.rotate(-Math.PI / 2); label(T('u.border'), 0, 0, C.peri); ctx.restore();

    /* Kurslinie und Minen */
    ctx.strokeStyle = C.dim; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(G.x0, G.cy); ctx.lineTo(G.xF, G.cy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (S.know.mines === true) {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const s = stars[i + 10], x = G.x0 + 14 + s[0] * (G.xF - G.x0 - 28), y = G.cy + (s[4] - 0.5) * ch * 0.34;
        ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
      }
    }

    /* Frachter */
    const fr = S.fr, pulse = reduced ? 0.5 : (now % 1800) / 1800;
    if (fr.alive) {
      ctx.strokeStyle = C.lilac; ctx.lineWidth = 1.5;
      for (const ph of [pulse, (pulse + 0.5) % 1]) { ctx.globalAlpha = (1 - ph) * 0.7; ctx.beginPath(); ctx.arc(G.fx, G.fy, 8 + ph * 16, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = C.lilac;
      ctx.fillRect(G.fx - 6, G.fy - 5, 12, 10);
    } else {
      ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5; ctx.strokeRect(G.fx - 6, G.fy - 5, 12, 10);
      ctx.beginPath(); ctx.moveTo(G.fx - 8, G.fy - 7); ctx.lineTo(G.fx + 8, G.fy + 7); ctx.stroke();
    }
    label('Kobayashi Maru', Math.min(G.fx, cw - 6), Math.max(10, G.fy - 16), fr.alive ? C.lilac : C.dim, G.fx > cw - 60 ? 'right' : 'center');
    if (fr.pods > 0) { ctx.fillStyle = C.ice; for (let i = 0; i < 5; i++) ctx.fillRect(G.fx - 22 + i * 5, G.fy + 12 + (i % 2) * 4, 2.5, 2.5); }
    if (S.tow && fr.alive) { ctx.strokeStyle = C.ice; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(G.sx, G.sy); ctx.lineTo(G.fx, G.fy); ctx.stroke(); ctx.globalAlpha = 1; }

    /* Unsichere Echos getarnter Schiffe */
    if (S.know.echo && S.hidden > 0) {
      ctx.strokeStyle = C.mars; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      for (let i = 0; i < Math.min(3, S.hidden); i++) {
        const s = stars[i + 20], x = G.xF + (s[0] - 0.6) * 70, y = G.cy + (s[1] - 0.5) * ch * 0.6;
        ctx.globalAlpha = 0.35 + 0.3 * Math.abs(Math.sin(now / 700 + i));
        diamond(Math.max(G.x0 + 12, Math.min(cw - 10, x)), y, 6); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    /* Gegner */
    const shipGone = S.over && (S.out === 'zerstoert' || S.out === 'gerammt');
    for (const e of S.en) {
      const [x, y] = enemyPos(G, e.a, e.d);
      const f = fx.find((q) => q.k === 'decloak' && q.id === e.id);
      const appear = f ? Math.max(0, Math.min(1, (now - f.t0) / f.dur)) : 1;
      const r = e.flag ? 9 : 6;
      ctx.globalAlpha = appear;
      diamond(x, y, r);
      ctx.strokeStyle = C.mars; ctx.lineWidth = 1.5; ctx.stroke();
      if (S.hostile) { ctx.fillStyle = C.mars; ctx.globalAlpha = appear * (0.35 + 0.65 * e.hp / e.max); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    /* Eigenes Schiff */
    if (!shipGone || fx.some((q) => q.k === 'shipboom' && now < q.t0)) {
      const sh = S.ship;
      if (S.red && sh.shields > 0) {
        ctx.strokeStyle = C.ice; ctx.lineWidth = 2; ctx.globalAlpha = 0.3 + 0.7 * sh.shields / 100;
        ctx.beginPath(); ctx.arc(G.sx, G.sy, 13, 0, Math.PI * 2 * (sh.shields / 100)); ctx.stroke(); ctx.globalAlpha = 1;
      }
      const dir = S.phase === 'rueckzug' ? -1 : 1;
      ctx.fillStyle = C.hot;
      ctx.beginPath(); ctx.arc(G.sx, G.sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(G.sx + dir * 11, G.sy); ctx.lineTo(G.sx + dir * 5, G.sy - 3.5); ctx.lineTo(G.sx + dir * 5, G.sy + 3.5); ctx.closePath(); ctx.fill();
      const atBorder = S.phase === 'grenze' && !S.over;
      label(T('ship', { name: sh.name }), atBorder ? G.x0 + 8 : G.sx, atBorder ? G.sy - 18 : Math.min(ch - 8, G.sy + 24), C.hot, atBorder || G.sx < 50 ? 'left' : 'center');
    }

    /* Effekte */
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], t = (now - f.t0) / f.dur;
      if (t >= 1) { fx.splice(i, 1); continue; }
      if (t < 0) continue;
      const fade = 1 - t;
      if (f.k === 'phaser' || f.k === 'torp') {
        const [x, y] = enemyPos(G, f.a, f.d);
        if (f.k === 'phaser') { ctx.strokeStyle = C.amber; ctx.lineWidth = 2.5; ctx.globalAlpha = fade; ctx.beginPath(); ctx.moveTo(G.sx, G.sy); ctx.lineTo(x, y); ctx.stroke(); }
        else { ctx.fillStyle = C.hot; for (const o of [0, 0.12, 0.24]) { const u = Math.min(1, Math.max(0, t * 1.3 - o)); ctx.globalAlpha = u < 1 ? 1 : 0; ctx.beginPath(); ctx.arc(G.sx + (x - G.sx) * u, G.sy + (y - G.sy) * u, 2.5, 0, Math.PI * 2); ctx.fill(); } }
      } else if (f.k === 'boom') {
        const [x, y] = enemyPos(G, f.a, f.d);
        ctx.strokeStyle = C.hot; ctx.lineWidth = 2; ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(x, y, 4 + t * 22, 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'volley') {
        ctx.strokeStyle = C.mars; ctx.lineWidth = 1.5; ctx.globalAlpha = fade * 0.9;
        for (const e of S.en) { const [x, y] = enemyPos(G, e.a, e.d); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(G.sx, G.sy); ctx.stroke(); }
        ctx.strokeStyle = C.hot; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(G.sx, G.sy, 9 + t * 12, 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'beam' || f.k === 'shuttle') {
        ctx.strokeStyle = C.ice; ctx.lineWidth = f.k === 'beam' ? 3 : 1; ctx.globalAlpha = f.k === 'beam' ? 0.35 + 0.5 * Math.abs(Math.sin(t * 18)) : 0.5;
        ctx.setLineDash(f.k === 'beam' ? [3, 4] : [1, 5]); ctx.lineDashOffset = -t * 60;
        ctx.beginPath(); ctx.moveTo(G.fx, G.fy); ctx.lineTo(G.sx, G.sy); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        if (f.k === 'shuttle') { const u = t < 0.5 ? t * 2 : 2 - t * 2; ctx.globalAlpha = 1; ctx.fillStyle = C.ice; ctx.fillRect(G.sx + (G.fx - G.sx) * u - 2, G.sy + (G.fy - G.sy) * u - 2, 4, 4); }
      } else if (f.k === 'mine') {
        ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(G.sx + 6, G.sy - 4, 4 + t * 16, 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'frhit') {
        ctx.strokeStyle = C.mars; ctx.lineWidth = 2; ctx.globalAlpha = fade; ctx.beginPath(); ctx.arc(G.fx, G.fy, 6 + t * 14, 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'shipboom') {
        ctx.strokeStyle = C.hot; ctx.lineWidth = 3;
        for (const o of [0, 0.25, 0.5]) { const u = t - o; if (u > 0) { ctx.globalAlpha = Math.max(0, 1 - u * 1.6); ctx.beginPath(); ctx.arc(G.sx, G.sy, 4 + u * 70, 0, Math.PI * 2); ctx.stroke(); } }
      } else if (f.k === 'leave') {
        const [x, y] = enemyPos(G, f.a, f.d + t * 3);
        ctx.globalAlpha = fade; diamond(x, y, 6); ctx.strokeStyle = C.mars; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  let raf = 0;
  function loop(now) { raf = 0; if (view === 'bruecke' && stage !== 'debrief' && !document.hidden) { draw(now); raf = requestAnimationFrame(loop); } }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', kick);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);

  /* ── Bereiche ── */
  const VIEWS = ['bruecke', 'protokoll', 'akte', 'wartung'];
  function show(v) {
    if (!VIEWS.includes(v)) v = 'bruecke';
    view = v;
    for (const s of $$('.view')) s.hidden = s.dataset.view !== v;
    for (const b of $$('.nb[data-view]')) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    if (v === 'protokoll') { renderProtokoll(); const sec = $('#view-protokoll'); sec.scrollTop = sec.scrollHeight; }
    if (v === 'akte') renderAkte();
    if (v === 'wartung') renderKern();
    kick();
  }
  for (const b of $$('.nb[data-view]')) b.addEventListener('click', () => { sfx.tap(); show(b.dataset.view); });

  function moodOf() {
    if (!S || stage === 'brief') return 'notruf';
    if (S.over) {
      if (S.out === 'sieg') return 'triumph';
      if (S.out === 'zerstoert' || S.out === 'gerammt') return 'verlust';
      if (S.out === 'entkommen' && S.res && S.res.saved > 0) return 'erleichterung';
      return 'trauer';
    }
    const crit = S.ship.hull < 40 || (S.phase === 'frachter' && S.fr.alive && S.fr.aboard > 0 && S.fr.life <= 2);
    if (S.hostile && S.en.length) return crit ? 'kritisch' : 'gefecht';
    if (S.en.length) return 'drohung';
    if (S.phase === 'grenze') return 'notruf';
    return crit ? 'drohung' : 'spannung';
  }
  function render() {
    music.set(moodOf());
    renderHead(); renderGauges();
    $('#bridge').classList.toggle('live', stage !== 'debrief');
    $('#scope').hidden = stage === 'debrief';
    $('#brief').hidden = stage !== 'brief';
    $('#console').hidden = stage !== 'sim';
    $('#debrief').hidden = stage !== 'debrief';
    if (stage === 'brief') setText($('#briefNote'), T('u.scenario', { code: scCode(S.seed) }) + (KM.isCheated(cheats) ? ' · ' + T('u.coreModified') : ''));
    if (stage === 'sim') renderConsole();
    if (stage === 'debrief') renderDebrief();
    if (view === 'protokoll') renderProtokoll();
    if (view === 'akte') renderAkte();
    kick();
  }

  $('#startBtn').addEventListener('click', () => {
    sfx.caution();
    /* Der Kern kann seit dem Laden verändert worden sein: Szenario mit den aktuellen Werten aufsetzen */
    begin(S.seed, true);
  });
  $('#toDebrief').addEventListener('click', () => { sfx.tap(); stage = 'debrief'; render(); $('#view-bruecke').scrollTop = 0; });

  /* Neuer Versuch: mitten in der Simulation erst nach zweitem Tippen */
  let armed = false, armTimer = 0;
  $('#resetBtn').addEventListener('click', () => {
    const running = stage === 'sim' && !S.over;
    if (running && !armed) {
      armed = true; setText($('#resetLbl'), T('u.sure')); sfx.caution();
      armTimer = setTimeout(() => { armed = false; renderHead(); }, 3500);
      return;
    }
    clearTimeout(armTimer); armed = false;
    sfx.ok();
    begin(newSeed(), true);
    show('bruecke');
    $('#view-bruecke').scrollTop = 0;
  });

  /* ── Sprache umschalten: alles neu zeichnen, nichts geht verloren ── */
  $('#langBtn').addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    local.set('km.lang', lang);
    sfx.tap();
    applyStatic(); renderSound(); music.render();
    shown = S.log.length; /* keine Einblend-Animation für schon gezeigte Meldungen */
    if (view === 'wartung') renderKern();
    render();
  });

  /* ── Start ── */
  function start(saved) {
    let ok = false;
    try {
      if (saved && saved.S && saved.S.v === 2 && saved.S.ship && Array.isArray(saved.S.log)) {
        S = saved.S; stage = saved.stage === 'sim' || saved.stage === 'debrief' ? saved.stage : 'brief';
        recorded = !!saved.recorded; anim.pos = S.pos; shown = S.log.length; ok = true;
        render(); show(VIEWS.includes(saved.view) ? saved.view : 'bruecke');
      }
    } catch (e) { ok = false; }
    if (!ok) { begin(newSeed(), false); show('bruecke'); }
    setTimeout(() => app.classList.remove('boot'), 1200);
  }
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S, stage, view, recorded })); } catch (e) {} }
  if (hot && typeof hot.ready === 'function') hot.ready(start); else start((hot && hot.data) || {});
})();
