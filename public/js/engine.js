/* Spiellogik der Kommandoprüfung. Kein Zugriff auf die Seite, damit sie sich getrennt prüfen lässt.
   Meldungen und Befehle werden als Schlüssel mit Werten gespeichert. Den Text in der gewählten Sprache liefert i18n.js erst beim Anzeigen. */
const KM = (() => {
  'use strict';
  const I18N = typeof KMI18N !== 'undefined' ? KMI18N : require('./i18n.js');

  const DEF = { verst: true, abfang: true, ruf: false, treffer: 100, leben: 0 };
  const isCheated = (c) => Object.keys(DEF).some((k) => c[k] !== DEF[k]);

  /* Zufall mit Startwert: gleiches Szenario + gleiche Befehle = gleicher Verlauf */
  function rnd(S) {
    const a = (S.rs = (S.rs + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (S, a, b) => a + Math.floor(rnd(S) * (b - a + 1));
  const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
  const chance = (S, p) => rnd(S) < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const SHIPS = ['Aldebaran', 'Meridian', 'Hypatia', 'Kepler', 'Solveig', 'Amundsen', 'Leibniz', 'Ganymed', 'Tereschkowa', 'Humboldt'];
  const NAMES = ['Adeyemi', 'Brandt', 'Castellanos', 'Dvořák', 'Eriksen', 'Farahani', 'Greco', 'Ivanova', 'Jansen', 'Kowalczyk', 'Lindqvist', 'Mbeki', 'Nakamura', 'Okonkwo', 'Petrov', 'Rahimi', 'Thackeray', 'Uzun', 'Varga', 'Weiss', 'Yilmaz'];
  /* Stationen mit Offizier; die Reihenfolge bestimmt die Namensvergabe aus dem Zufall */
  const RANKED = ['komm', 'takt', 'steu', 'wiss', 'masch', 'med'];
  const SPEED = { warp: 4, imp: 2, stealth: 1 };
  const CAUSES = ['leak', 'drive', 'meteor', 'mine'];

  function say(S, who, k, p, tone) { const l = { who, k, tone: tone || '' }; if (p) l.p = p; S.rep.push(l); }
  const alive = (S) => S.ship.crew - S.ship.dead;
  const eta = (S, sp, toBorder) => Math.max(1, Math.ceil((toBorder ? S.pos : S.sc.dist - S.pos) / SPEED[sp]));
  const frac = (S) => (S.rescued + (S.tow && S.fr.alive ? S.fr.aboard : 0)) / S.sc.people;
  const visible = (S) => S.en.length > 0;

  function newGame(seed, cheats, code) {
    const S = { v: 2, seed: seed >>> 0, rs: seed >>> 0 };
    S.cheats = Object.assign({}, DEF, cheats || {});
    S.cheated = isCheated(S.cheats);
    S.code = code || ['', '', ''];
    const roll = rnd(S);
    const type = roll < 0.34 ? 'hinterhalt' : roll < 0.62 ? 'patrouille' : roll < 0.81 ? 'minen' : 'koeder';
    const temper = type === 'koeder' ? pick(S, ['jaeger', 'schweiger', 'jaeger']) : pick(S, ['ehre', 'jaeger', 'schweiger']);
    const people = 81 + ri(S, 170, 340);
    const life = (type === 'minen' ? ri(S, 7, 9) : ri(S, 8, 12)) + S.cheats.leben;
    S.sc = {
      type, temper, people, life0: life,
      dist: ri(S, 4, 8),
      hidden0: type === 'koeder' ? ri(S, 4, 6) : type === 'minen' ? ri(S, 2, 3) : ri(S, 2, 4),
      mines: type === 'minen' || chance(S, 0.18),
      jam: temper === 'schweiger' || type === 'koeder' || chance(S, 0.3),
      delay: ri(S, 3, 5),
    };
    S.sc.cause = S.sc.mines && type === 'minen' ? 'mine' : pick(S, CAUSES);
    S.fr = { hull: type === 'minen' ? ri(S, 22, 38) : ri(S, 35, 60), aboard: people, life, alive: true, pods: 0, podsAge: 0 };
    S.ship = { name: pick(S, SHIPS), crew: ri(S, 380, 470), dead: 0, shields: 100, hull: 100, torp: ri(S, 3, 5) * 2, warp: true, trans: 1, sensors: true, shut: 2 };
    S.off = {};
    const pool = NAMES.slice();
    for (const k of RANKED) S.off[k] = pool.splice(Math.floor(rnd(S) * pool.length), 1)[0];
    Object.assign(S, {
      turn: 0, phase: 'grenze', pos: 0, red: false, down: false, evasive: false, surprise: false,
      en: [], hidden: S.sc.hidden0, hostile: false, feared: false, ult: -1, grace: 0, promise: 0, holdFire: 0,
      ct: 0, killsNow: 0, pendingRepl: 0, kills: 0, nextId: 1, flagSeen: false, volleys: 0,
      rescued: 0, beamed: 0, lost: 0, storm: 0, tow: false, damp: false, boost: false, arriveTurn: -1,
      ev: {}, leak: [false, false, false],
      know: { people: null, peopleOff: 0, life: null, lifeOff: 0, echo: null, mines: null, hull: false },
      f: { scans: 0, hailFr: false, fleetTried: false, fleetOk: false, announced: false, entered: false, enterTurn: -1, redEntering: false,
        surprised: false, contact: false, firedFirst: false, shots: 0, holds: 0, reversals: 0, retreated: false, buoy: false, hails: 0,
        beamTurns: 0, lastRescue: -1, intercepted: false, riegel: false, graceGiven: false, zoneTurns: 0, nahscan: false,
        ignoredUlt: false, mineHits: 0, warpInMines: false, towed: false, letGo: false },
      log: [], rep: [], fx: [], over: false, out: null, res: null, last: null,
    });
    intro(S);
    S.log.push({ t: 0, order: null, instant: false, rep: S.rep });
    return S;
  }

  function intro(S) {
    say(S, 'komm', 'r.introSos', { cause: S.sc.cause });
    say(S, 'steu', 'r.introEta', { w: eta(S, 'warp'), i: eta(S, 'imp'), s: eta(S, 'stealth') });
    say(S, 'wiss', 'r.introTreaty', null, 'warn');
    say(S, 'comp', 'r.introCommand', { ship: S.ship.name, crew: S.ship.crew }, 'sys');
  }

  /* ───── Befehle, die gerade möglich sind ───── */
  function orders(S) {
    if (S.over) return [];
    const o = [];
    const add = (id, cat, label, hint, instant) => o.push({ id, cat, label, hint: hint || '', instant: !!instant });
    const sh = S.ship, fr = S.fr;
    const canWarp = sh.warp && !S.damp;
    const rescue = fr.alive && fr.aboard > 0;

    if (S.phase === 'grenze') {
      add('enter_warp', 'nav', 'o.enterWarp', ['h.enterWarp', { n: eta(S, 'warp') }]);
      add('enter_imp', 'nav', 'o.enterImp', ['h.atFr', { n: eta(S, 'imp') }]);
      add('enter_stealth', 'nav', 'o.enterStealth', ['h.enterStealth', { n: eta(S, 'stealth') }]);
      if (S.f.scans < 2) add('scan', 'sens', S.f.scans ? 'o.scanAgain' : 'o.scan', 'h.scan');
      if (!S.f.hailFr) add('hailfr', 'comm', 'o.hailFr', 'h.oneMin');
      if (!S.f.fleetTried) add('fleet', 'comm', 'o.fleet', 'h.oneMin');
      if (!S.f.announced) add('announce', 'comm', 'o.announce', 'h.announce');
      add('hold', 'ship', 'o.hold', 'h.hold');
      add('decline', 'ship', 'o.decline', 'h.ends');
    } else if (S.phase === 'anflug') {
      if (canWarp) add('go_warp', 'nav', 'o.goWarp', ['h.atFr', { n: eta(S, 'warp') }]);
      add('go_imp', 'nav', 'o.goImp', ['h.atFr', { n: eta(S, 'imp') }]);
      add('go_stealth', 'nav', 'o.goStealth', ['h.atFr', { n: eta(S, 'stealth') }]);
      if (sh.sensors && S.storm <= 0 && !S.hostile) add('scan_nah', 'sens', 'o.scanNah', 'h.scanStop');
    } else if (S.phase === 'frachter') {
      if (rescue) {
        const rate = Math.round(57 * sh.trans * (S.storm > 0 ? 0.5 : 1));
        add('beam', 'resc', 'o.beam', ['h.beam', { n: rate }]);
        add('beam_pulse', 'resc', 'o.beamPulse', 'h.beamPulse');
        if (sh.shut > 0) add('shuttle', 'resc', 'o.shuttle', ['h.shuttle', { n: sh.shut }]);
        add('tow', 'resc', 'o.tow', ['h.tow', { n: S.pos }]);
      }
      if (fr.pods > 0) add('pickup', 'resc', 'o.pickup', ['h.pickup', { n: fr.pods }]);
      if (sh.sensors && S.storm <= 0 && !S.hostile && !visible(S)) add('scan_nah', 'sens', 'o.scanNah', 'h.oneMin');
    } else if (S.phase === 'rueckzug') {
      if (S.tow) add('tow_go', 'resc', 'o.towGo', ['h.towGo', { n: S.pos }]);
      if (rescue && !S.tow) add('turn_back', 'nav', 'o.turnBack', 'h.turnBack');
    }

    if (S.phase !== 'grenze') {
      if (visible(S)) {
        add('fire_ph', 'tac', 'o.firePh', S.hostile ? 'h.firePhHostile' : 'h.firePhFirst');
        if (sh.torp >= 2) add('fire_torp', 'tac', 'o.fireTorp', ['h.fireTorp', { n: sh.torp }]);
        add('hail_enemy', 'comm', 'o.hailEnemy', 'h.oneMin');
      }
      if (S.hostile && visible(S)) add('evasive', 'tac', 'o.evasive', 'h.evasive');
      if (sh.shields < 100) add('shields', 'ship', 'o.shields', ['h.shields', { n: sh.shields }]);
      const broken = [];
      if (!sh.warp) broken.push('warp');
      if (sh.trans < 1) broken.push('trans');
      if (!sh.sensors) broken.push('sensors');
      if (broken.length) add('repair', 'ship', 'o.repair', ['h.repair', { sys: broken }]);
      if (canWarp) add('flee_warp', 'nav', S.phase === 'rueckzug' ? 'o.fleeWarpOn' : 'o.fleeWarp', ['h.flee', { n: eta(S, 'warp', true), tow: S.tow }]);
      add('flee_imp', 'nav', S.phase === 'rueckzug' ? 'o.fleeImpOn' : 'o.fleeImp', ['h.flee', { n: eta(S, 'imp', true), tow: S.tow }]);
      if (S.hostile && visible(S) && sh.hull < 70) add('surrender', 'comm', 'o.surrender', 'h.oneMin');
      if (sh.hull < 50) add('abandon', 'ship', 'o.abandon', 'h.abandon');
      if (S.hostile && visible(S) && sh.hull < 50) add('ram', 'tac', 'o.ram', 'h.ram');
    }

    /* Sofortbefehle kosten keine Zeit */
    if (!S.red) add('alert', 'ship', 'o.redAlert', 'h.redAlert', true);
    else if (!S.hostile) add('alert', 'ship', 'o.standDown', 'h.standDown', true);
    if (S.boost) add('notenergie', 'ship', 'o.boost', 'h.boost', true);
    if (!S.f.buoy) add('buoy', 'comm', 'o.buoy', 'h.buoy', true);
    return o;
  }

  /* ───── Schaden und Gegner ───── */
  function damage(S, dmg, mode) {
    const sh = S.ship;
    dmg = Math.round(dmg);
    let toS = 0, toH = 0;
    if (mode === 'down') toH = dmg;
    else if (mode === 'pulse') { toS = Math.round(dmg * 0.6); toH = Math.round(dmg * 0.25); }
    else toS = dmg;
    if (toS > sh.shields) { toH += toS - sh.shields; toS = sh.shields; }
    sh.shields -= toS;
    sh.hull = Math.max(0, sh.hull - toH);
    let dead = 0;
    if (toH > 0) { dead = Math.min(alive(S), Math.round(toH * (0.35 + rnd(S) * 0.4))); sh.dead += dead; }
    return { toS, toH, dead };
  }
  function sysHits(S, toH) {
    const sh = S.ship;
    if (toH < 8 || sh.hull <= 0) return;
    if (sh.warp && chance(S, 0.2)) { sh.warp = false; say(S, 'masch', 'r.warpDown', null, 'bad'); }
    else if (sh.trans === 1 && chance(S, 0.15)) { sh.trans = 0.5; say(S, 'masch', 'r.transDamaged', null, 'warn'); }
    else if (sh.sensors && chance(S, 0.1)) { sh.sensors = false; say(S, 'wiss', 'r.sensorsDown', null, 'warn'); }
  }
  function leak(S) {
    const h = S.ship.hull;
    const line = (i) => say(S, 'comp', 'r.leak', { i: i + 1, code: S.code[i] }, 'sys');
    if (h < 70 && !S.leak[0]) { S.leak[0] = true; line(0); }
    if (h < 40 && !S.leak[1]) { S.leak[1] = true; line(1); }
  }
  /* lead: Verweis auf den ersten Satz der Meldung, danach der Zustand von Schilden und Hülle */
  function reportHit(S, r, lead) {
    const sh = S.ship;
    let st;
    if (r.toH > 0 && r.toS === 0 && sh.shields > 0) st = 'direct';
    else if (r.toH > 0 && r.toS === 0) st = 'none';
    else if (r.toH > 0 && sh.shields === 0) st = 'collapsed';
    else if (r.toH > 0) st = 'both';
    else st = 'hold';
    say(S, 'takt', 'r.hit', { lead, st, s: sh.shields, h: sh.hull }, r.toH > 0 ? 'bad' : 'warn');
    if (r.dead > 0) say(S, 'med', 'r.dead', { n: r.dead, total: sh.dead }, 'bad');
    sysHits(S, r.toH);
    leak(S);
    if (sh.hull <= 0) destroyed(S);
  }
  function spawn(S, n, flag) {
    for (let i = 0; i < n; i++) {
      const f = !!flag && i === 0;
      if (f) S.flagSeen = true;
      const e = { id: S.nextId++, hp: f ? 160 : 100, max: f ? 160 : 100, flag: f, a: rnd(S) * Math.PI * 2, d: 0.8 + rnd(S) * 0.5 };
      S.en.push(e);
      S.fx.push({ k: 'decloak', id: e.id });
    }
  }
  function fear(S) {
    S.feared = true; S.hostile = false; S.ult = -1; S.grace = 0;
    say(S, 'feind', 'r.fear1');
    say(S, 'komm', 'r.fear2');
    say(S, 'feind', 'r.fear3', null, 'good');
    say(S, 'takt', 'r.fear4', null, 'good');
    for (const e of S.en) S.fx.push({ k: 'leave', id: e.id, a: e.a, d: e.d });
    S.en = []; S.hidden = 0;
  }
  function reveal(S, how) {
    if (S.hidden <= 0) return 0;
    const n = S.hidden;
    spawn(S, n, false); S.hidden = 0;
    say(S, 'takt', 'r.reveal', { n, how: how || 'decloak' }, 'bad');
    return n;
  }
  function engage(S, surprise) {
    if (S.hostile || S.feared) return;
    if (S.cheats.ruf) { fear(S); return; }
    S.hostile = true; S.ult = -1; S.grace = 0;
    if (surprise && !S.red) { S.f.surprised = true; S.surprise = true; }
  }
  /* Kontakt ohne sofortiges Feuer: Ultimatum, Gnadenfrist oder Angriff, je nach Kommandant */
  function contact(S, surprise) {
    if (S.cheats.ruf) { fear(S); return; }
    const t = S.sc.temper;
    if (t === 'ehre') {
      if (S.promise > 0) {
        S.grace = S.promise; S.promise = 0; S.f.graceGiven = true;
        say(S, 'feind', 'r.grace', { n: S.grace });
      } else {
        S.ult = 2;
        say(S, 'feind', 'r.ultimatum', null, 'warn');
      }
    } else if (t === 'schweiger') {
      S.ult = 1;
      say(S, 'takt', 'r.silentArming', null, 'warn');
    } else {
      say(S, 'takt', 'r.fireNoWarning', null, 'bad');
      engage(S, surprise);
    }
  }
  function volley(S) {
    const n = S.en.length;
    if (!n) return;
    let total = 0;
    for (const e of S.en) total += ri(S, 5, 9) * (e.flag ? 1.6 : 1);
    total *= S.cheats.treffer / 100;
    if (S.storm > 0) total *= 0.6;
    if (S.evasive) total *= 0.4;
    if (S.surprise) total *= 1.3;
    let mode = S.red ? 'up' : 'down';
    if (S.down) mode = S.down;
    S.volleys++;
    S.fx.push({ k: 'volley' });
    if (S.fr.alive && S.tow) {
      frHit(S, total * 0.35);
      total *= 0.6;
    } else if (S.fr.alive && S.sc.type === 'koeder' && S.f.contact) {
      frHit(S, ri(S, 8, 15) * S.cheats.treffer / 100);
    }
    const r = damage(S, total, mode);
    reportHit(S, r, ['r.leadVolley', { n, ev: S.evasive }]);
    S.surprise = false;
    if (!S.red && !S.over) { S.red = true; say(S, 'takt', 'r.redAuto'); }
  }
  function frHit(S, dmg) {
    const fr = S.fr;
    fr.hull = Math.max(0, fr.hull - Math.round(dmg));
    S.fx.push({ k: 'frhit' });
    if (fr.hull <= 0) {
      const n = fr.aboard;
      fr.alive = false; fr.aboard = 0; S.lost += n + fr.pods; fr.pods = 0; S.tow = false;
      say(S, 'takt', 'r.frBreaks', { n }, 'bad');
    } else {
      say(S, 'takt', 'r.frHit', { h: fr.hull }, 'warn');
    }
  }
  function director(S) {
    if (!S.hostile || S.feared || S.over) return;
    S.ct++;
    if (!S.cheats.verst) { S.killsNow = 0; return; }
    let n = S.pendingRepl;
    S.pendingRepl = S.killsNow; S.killsNow = 0;
    if (S.ct % 2 === 0) n += ri(S, 1, 2);
    if (S.en.length + n < 2) n = 2 - S.en.length;
    if (n <= 0) return;
    const flag = S.ct >= 4 && !S.flagSeen && chance(S, 0.6);
    spawn(S, n, flag);
    say(S, 'takt', 'r.reinf', { n, total: S.en.length, flag }, 'bad');
  }
  /* Was die Gegenseite in dieser Minute von sich aus tut */
  function trigger(S) {
    if (S.feared || S.hostile || S.over || !S.f.entered) return;
    const t = S.sc.type;
    if (visible(S)) {
      if (S.phase === 'rueckzug') {
        if (!S.f.letGo) { S.f.letGo = true; say(S, 'takt', 'r.followNoFire'); }
        return;
      }
      if (S.grace > 0) {
        if (S.phase === 'frachter') {
          S.grace--;
          if (S.grace === 0) { S.ult = 1; say(S, 'feind', 'r.timeUp', null, 'warn'); }
        }
        return;
      }
      if (S.ult > 0) {
        S.ult--;
        if (S.ult === 0) { S.f.ignoredUlt = true; if (S.sc.temper === 'ehre') say(S, 'feind', 'r.hadWarning', null, 'bad'); engage(S, false); }
        else if (S.sc.temper === 'ehre') say(S, 'feind', 'r.lastWarning', null, 'warn');
        return;
      }
      engage(S, false);
      return;
    }
    if (S.hidden <= 0) return;
    if (t === 'hinterhalt' && S.phase === 'frachter') {
      const waited = S.turn - S.arriveTurn >= 1;
      if (S.down || waited) {
        reveal(S, 'aroundFr');
        if (S.sc.temper === 'ehre') contact(S, false);
        else { if (S.down && !S.cheats.ruf) say(S, 'takt', 'r.waitedShields', null, 'bad'); engage(S, true); }
      }
    } else if (t === 'patrouille' && (S.phase === 'anflug' || S.phase === 'frachter')) {
      let p = S.phase === 'frachter' ? 0.6 : S.speed === 'warp' ? 0.75 : S.speed === 'imp' ? 0.5 : 0.15;
      if (S.red) p += 0.15;
      if (chance(S, p)) { reveal(S, S.phase === 'frachter' ? 'aroundUs' : 'onCourse'); contact(S, true); }
    } else if (t === 'minen') {
      if (S.f.zoneTurns === S.sc.delay - 1 && S.ship.sensors && S.storm <= 0) say(S, 'wiss', 'r.minesContacts', { n: S.hidden }, 'warn');
      if (S.f.zoneTurns >= S.sc.delay) { reveal(S, 'dropWarp'); contact(S, false); }
    } else if (t === 'koeder' && S.phase === 'frachter') {
      reveal(S, 'aroundFr');
      if (S.cheats.ruf) fear(S);
      else { say(S, 'wiss', 'r.wasBait', null, 'bad'); engage(S, true); }
    }
  }
  function events(S) {
    if (!S.f.entered || S.over || !chance(S, 0.28)) return;
    const fr = S.fr, list = [];
    if (!S.ev.storm) list.push('storm');
    if (!S.ev.trans && S.phase === 'frachter' && S.ship.trans === 1) list.push('trans');
    if (!S.ev.reactor && fr.alive && fr.life > 3) list.push('reactor');
    if (!S.ev.pods && fr.alive && S.phase === 'frachter' && fr.aboard > 60) list.push('pods');
    if (!S.ev.boost && (S.ship.shields < 70 || S.ship.hull < 80)) list.push('boost');
    if (!S.ev.breach && fr.alive && fr.aboard > 80) list.push('breach');
    if (!list.length) return;
    const e = pick(S, list);
    S.ev[e] = true;
    if (e === 'storm') { S.storm = ri(S, 2, 3) + 1; say(S, 'wiss', 'r.storm', null, 'warn'); }
    else if (e === 'trans') { S.ship.trans = 0.5; say(S, 'masch', 'r.transOverheat', null, 'warn'); }
    else if (e === 'reactor') { fr.life = Math.max(2, fr.life - ri(S, 1, 2)); say(S, 'komm', 'r.reactor', { n: fr.life }, 'warn'); S.know.life = 'exact'; S.know.lifeOff = 0; }
    else if (e === 'pods') { const n = ri(S, 15, 35); fr.pods = n; fr.podsAge = 0; fr.aboard -= n; say(S, 'komm', 'r.pods', { n }, 'warn'); }
    else if (e === 'boost') { S.boost = true; say(S, 'masch', 'r.boostReady', null, 'good'); }
    else if (e === 'breach') { const n = ri(S, 8, 20); fr.aboard -= n; S.lost += n; say(S, 'komm', 'r.breach', { n }, 'bad'); }
  }

  /* ───── Enden ───── */
  function finish(S, out) {
    if (S.over) return;
    S.over = true; S.out = out;
    const sh = S.ship, P = S.sc.people, fr = S.fr;
    const t = S.sc.temper;
    let saved = 0, crewAlive = alive(S), civAboardDead = 0, shipLost = false;
    if (out === 'entkommen' || out === 'sieg') { saved = S.rescued; }
    else if (out === 'zerstoert' || out === 'gerammt') { civAboardDead = S.rescued; sh.dead = sh.crew; crewAlive = 0; shipLost = true; }
    else if (out === 'aufgegeben') {
      const q = !S.hostile ? 0.95 : t === 'ehre' ? 0.9 : t === 'schweiger' ? 0.7 : 0.45;
      const cs = Math.round(crewAlive * q); sh.dead += crewAlive - cs; crewAlive = cs;
      saved = Math.round(S.rescued * q); civAboardDead = S.rescued - saved; shipLost = true;
    } else if (out === 'kapituliert') { saved = S.rescued; shipLost = true; }
    /* Wer bei Spielende noch auf dem Frachter oder in Kapseln ist, überlebt die Zone nicht */
    const left = (fr.alive ? fr.aboard : 0) + fr.pods;
    const civDead = S.lost + left + civAboardDead;
    S.res = { saved, civDead, crewDead: sh.dead, crewAlive, shipLost, people: P, captured: out === 'kapituliert', hull: sh.hull };
    if ((sh.hull < 40 || out === 'zerstoert') && S.leak[1] && !S.leak[2]) {
      S.leak[2] = true;
      say(S, 'comp', 'r.leak3', { code: S.code[2] }, 'sys');
    }
    say(S, 'comp', 'r.simEnd', null, 'sys');
  }
  function destroyed(S) {
    if (S.over) return;
    S.fx.push({ k: 'shipboom' });
    say(S, 'takt', 'r.destroyed', null, 'bad');
    finish(S, 'zerstoert');
  }

  /* ───── Bewegung ───── */
  function mineRoll(S, sp) {
    if (!S.sc.mines) return;
    const p = sp === 'warp' ? 0.3 : sp === 'imp' ? 0.12 : 0.03;
    if (!chance(S, p)) return;
    S.f.mineHits++;
    if (sp === 'warp' && S.know.mines === true) S.f.warpInMines = true;
    S.fx.push({ k: 'mine' });
    const r = damage(S, ri(S, 14, 26), S.red ? 'up' : 'down');
    reportHit(S, r, 'r.leadMine');
  }
  function move(S, sp, dir) {
    S.speed = sp;
    const D = S.sc.dist;
    for (let i = 0; i < SPEED[sp] && !S.over; i++) {
      if (dir > 0 && S.pos >= D) break;
      if (dir < 0 && S.pos <= 0) break;
      S.pos += dir;
      mineRoll(S, sp);
    }
    if (S.over) return;
    if (dir > 0) {
      if (S.pos >= D) arrive(S);
      else say(S, 'steu', 'r.etaFr', { n: eta(S, sp) });
    } else if (S.pos > 0) {
      say(S, 'steu', 'r.etaBorder', { n: eta(S, sp, true) });
    }
  }
  function arrive(S) {
    const fr = S.fr;
    S.phase = 'frachter'; S.arriveTurn = S.turn; S.f.contact = true;
    S.know.people = 'exact'; S.know.peopleOff = 0; S.know.life = 'exact'; S.know.lifeOff = 0; S.know.hull = true;
    say(S, 'steu', 'r.alongside');
    if (fr.alive) {
      say(S, 'wiss', 'r.lifesigns', { n: fr.aboard, h: fr.hull, life: fr.life });
      say(S, 'masch', 'r.transRate', { n: Math.round(57 * S.ship.trans) });
    } else {
      say(S, 'wiss', 'r.tooLate', null, 'bad');
    }
  }
  function startRetreat(S) {
    if (S.phase === 'rueckzug') return;
    if (S.phase === 'anflug' && !visible(S) && S.fr.alive) S.f.reversals++;
    S.f.retreated = true; S.phase = 'rueckzug';
    say(S, 'steu', 'r.courseBorder');
    if (S.hostile && !S.feared && S.cheats.abfang && !S.f.intercepted) {
      const f = frac(S);
      if (f > 0) {
        S.f.intercepted = true;
        const n = Math.ceil(f * 4);
        spawn(S, n, false);
        say(S, 'takt', 'r.intercept', { n, total: S.en.length }, 'bad');
      }
      if (f >= 0.85) { S.damp = true; say(S, 'steu', 'r.damp', null, 'bad'); }
    }
  }
  function exitZone(S) {
    const f = frac(S);
    if (S.cheats.ruf && !S.feared && S.cheats.abfang && f > 0.3) {
      spawn(S, 4, false);
      say(S, 'takt', 'r.fourAtBorder', null, 'bad');
      fear(S);
    }
    if (S.cheats.abfang && !S.feared && f >= 0.85) {
      spawn(S, 6, false);
      say(S, 'takt', 'r.sixAtBorder', null, 'bad');
      S.ship.shields = 0; S.ship.hull = 0;
      S.leak[0] = S.leak[1] = true;
      destroyed(S);
      return;
    }
    if (S.cheats.abfang && !S.feared && !S.f.riegel && f > 0.3 && chance(S, (f - 0.3) / 0.55)) {
      S.f.riegel = true; S.pos = 1; S.damp = true;
      spawn(S, 4, false);
      say(S, 'takt', 'r.blocked', null, 'bad');
      say(S, 'steu', 'r.dampDrop', null, 'bad');
      if (!S.hostile) engage(S, false);
      return;
    }
    if (S.tow && S.fr.alive) {
      S.rescued += S.fr.aboard; S.beamed += S.fr.aboard; S.fr.aboard = 0;
      say(S, 'masch', 'r.towOver', null, 'good');
    }
    if (S.hostile && visible(S) && S.sc.temper === 'jaeger') {
      say(S, 'takt', 'r.pursue', null, 'bad');
      S.evasive = true; volley(S); S.evasive = false;
      if (S.over) return;
    } else if (visible(S)) {
      say(S, 'takt', 'r.stayBack');
    }
    say(S, 'steu', 'r.home', null, 'good');
    const all = S.fr.aboard === 0 && S.fr.pods === 0 && S.rescued / S.sc.people >= 0.85;
    finish(S, all ? 'sieg' : 'entkommen');
  }

  /* ───── Ein Befehl ───── */
  function fire(S, torp) {
    const first = !S.hostile;
    if (first) { S.f.firedFirst = true; }
    S.f.shots++;
    const en = S.en.slice().sort((a, b) => a.hp - b.hp);
    const tgt = en[0];
    let dmg = torp ? ri(S, 55, 85) : ri(S, 24, 40);
    if (S.storm > 0) dmg = Math.round(dmg * (torp ? 0.7 : 0.6));
    if (torp) S.ship.torp -= 2;
    tgt.hp -= dmg;
    S.fx.push({ k: torp ? 'torp' : 'phaser', id: tgt.id, a: tgt.a, d: tgt.d });
    if (tgt.hp <= 0) {
      S.en = S.en.filter((e) => e !== tgt);
      S.kills++; S.killsNow++;
      S.fx.push({ k: 'boom', a: tgt.a, d: tgt.d });
      say(S, 'takt', 'r.fireKill', { torp: !!torp, flag: tgt.flag, left: S.en.length }, 'good');
    } else {
      say(S, 'takt', 'r.fireHit', { torp: !!torp, pct: Math.round(tgt.hp / tgt.max * 100) });
    }
    if (first) {
      say(S, 'wiss', 'r.firedFirst', null, 'warn');
      engage(S, false);
    }
  }
  function hailEnemy(S) {
    S.f.hails++;
    const t = S.sc.temper;
    if (t === 'schweiger') { say(S, 'komm', 'r.noAnswerJam'); return; }
    if (t === 'jaeger') { say(S, 'feind', S.hostile ? 'r.hunterBeg' : 'r.hunterTalk', null, 'warn'); return; }
    if (!S.hostile) {
      if (S.grace > 0) { say(S, 'feind', 'r.knowDeadline'); return; }
      if (!S.f.graceGiven && !S.f.firedFirst && chance(S, 0.4)) {
        S.grace = ri(S, 2, 3); S.ult = -1; S.f.graceGiven = true;
        say(S, 'feind', 'r.graceHail', { n: S.grace }, 'good');
      } else say(S, 'feind', 'r.noNegotiate', null, 'warn');
      return;
    }
    if (!S.f.firedFirst && !S.ev.truce && chance(S, 0.3)) {
      S.ev.truce = true; S.holdFire = 1;
      say(S, 'feind', 'r.truce', null, 'good');
    } else say(S, 'feind', 'r.tooLateWords', null, 'warn');
  }

  function act(S, id) {
    const sh = S.ship, fr = S.fr;
    switch (id) {
      case 'alert':
        S.red = !S.red;
        say(S, 'takt', S.red ? 'r.redOn' : 'r.redOff');
        return;
      case 'buoy':
        S.f.buoy = true;
        say(S, 'komm', 'r.buoy');
        return;
      case 'notenergie':
        S.boost = false; sh.shields = Math.min(100, sh.shields + 40);
        say(S, 'masch', 'r.boostUsed', { s: sh.shields });
        return;
      case 'scan': {
        S.f.scans++;
        const second = S.f.scans >= 2;
        const P = S.sc.people;
        if (second) { S.know.people = 'exact'; S.know.peopleOff = 0; say(S, 'wiss', 'r.scanExact', { n: fr.aboard }); }
        else if (S.know.people === 'exact') say(S, 'wiss', 'r.scanAsReported', { n: fr.aboard });
        else if (chance(S, 0.75)) {
          const est = Math.round(P * (0.92 + rnd(S) * 0.16) / 10) * 10;
          S.know.people = 'ca'; S.know.peopleOff = est - P;
          say(S, 'wiss', 'r.scanEst', { n: est });
        } else say(S, 'wiss', 'r.scanNoCount');
        S.know.hull = true;
        if (second || S.know.life === 'exact') { S.know.life = 'exact'; S.know.lifeOff = 0; }
        else { S.know.life = 'ca'; S.know.lifeOff = ri(S, -1, 1); }
        say(S, 'wiss', 'r.scanHull', { h: fr.hull, ca: S.know.life !== 'exact', life: Math.max(1, fr.life + S.know.lifeOff) });
        const near = S.sc.type !== 'minen';
        if (near && chance(S, second ? 0.8 : 0.55)) {
          S.know.echo = true;
          const lo = Math.max(1, S.hidden - ri(S, 0, 1)), hi = S.hidden + ri(S, 0, 2);
          say(S, 'wiss', 'r.scanEcho', { lo, hi }, 'warn');
        } else if (!near && chance(S, 0.45)) {
          say(S, 'wiss', 'r.scanFar', null, 'warn');
        } else say(S, 'wiss', 'r.scanNone');
        if (S.sc.mines && (second || chance(S, 0.85))) { S.know.mines = true; say(S, 'wiss', 'r.scanMines', null, 'warn'); }
        else if (S.know.mines !== true) { S.know.mines = false; say(S, 'wiss', 'r.scanClear'); }
        break;
      }
      case 'scan_nah': {
        S.f.nahscan = true;
        if (S.hidden > 0 && S.sc.type !== 'minen' && chance(S, 0.8)) {
          S.know.echo = true;
          say(S, 'wiss', 'r.nahCloaked', { n: S.hidden }, 'warn');
        } else if (S.sc.type === 'minen' && S.hidden > 0) {
          say(S, 'wiss', 'r.nahWarp', { n: S.hidden }, 'warn');
        } else say(S, 'wiss', 'r.nahNone');
        if (S.sc.mines) { S.know.mines = true; say(S, 'wiss', 'r.nahMines', null, 'warn'); }
        break;
      }
      case 'hailfr':
        S.f.hailFr = true;
        if (S.sc.jam && chance(S, 0.5)) say(S, 'komm', 'r.frNoAnswer');
        else {
          S.know.people = 'exact'; S.know.peopleOff = 0; S.know.life = 'exact'; S.know.lifeOff = 0;
          say(S, 'fr', 'r.frAnswer', { pax: S.sc.people - 81, life: fr.life });
        }
        break;
      case 'fleet':
        S.f.fleetTried = true;
        if (S.sc.jam) say(S, 'komm', 'r.fleetJam', null, 'warn');
        else { S.f.fleetOk = true; say(S, 'flotte', 'r.fleetOk', { h: ri(S, 4, 9) }); }
        break;
      case 'announce':
        S.f.announced = true;
        if (S.sc.temper === 'schweiger' || (S.sc.jam && chance(S, 0.5))) say(S, 'komm', 'r.annNoAck');
        else if (S.sc.temper === 'jaeger') say(S, 'feind', 'r.annHunter', null, 'warn');
        else if (chance(S, 0.4)) { S.promise = ri(S, 2, 3); say(S, 'feind', 'r.annPromise', { n: S.promise }, 'good'); }
        else say(S, 'feind', 'r.annClosed', null, 'warn');
        break;
      case 'hold': {
        S.f.holds++;
        const h = S.f.holds;
        say(S, 'steu', 'r.holding');
        if (fr.alive) say(S, 'komm', h === 1 ? 'r.hold1' : h === 2 ? 'r.hold2' : 'r.hold3', null, 'warn');
        break;
      }
      case 'decline':
        say(S, 'steu', 'r.declineCourse');
        say(S, 'komm', 'r.declineFade', null, 'bad');
        finish(S, 'abgelehnt');
        return;
      case 'enter_warp': case 'enter_imp': case 'enter_stealth': {
        const sp = id.slice(6);
        S.f.entered = true; S.f.enterTurn = S.turn; S.f.redEntering = S.red; S.phase = 'anflug';
        say(S, 'steu', 'r.enter', { sp });
        say(S, 'wiss', 'r.treatyLogged', null, 'warn');
        move(S, sp, 1);
        break;
      }
      case 'go_warp': case 'go_imp': case 'go_stealth':
        move(S, id.slice(3), 1);
        break;
      case 'beam': case 'beam_pulse': {
        const pulse = id === 'beam_pulse';
        let n = Math.round(ri(S, 45, 70) * sh.trans * (S.storm > 0 ? 0.5 : 1) * (pulse ? 0.55 : 1));
        n = Math.min(fr.aboard, n);
        fr.aboard -= n; S.rescued += n; S.beamed += n;
        S.down = pulse ? 'pulse' : 'down';
        S.f.beamTurns++; S.f.lastRescue = S.turn;
        S.fx.push({ k: 'beam' });
        say(S, 'masch', 'r.beamed', { pulse, n, left: fr.aboard }, 'good');
        break;
      }
      case 'shuttle': {
        let n = 0, lostN = 0, lostS = 0;
        const count = sh.shut;
        for (let i = 0; i < count; i++) {
          const load = Math.min(fr.aboard, ri(S, 12, 16));
          if (load <= 0) break;
          fr.aboard -= load;
          if (S.hostile && visible(S) && chance(S, 0.2)) { lostN += load; lostS++; sh.shut--; sh.dead += Math.min(alive(S), 2); }
          else n += load;
        }
        S.rescued += n; S.beamed += n; S.lost += lostN; S.f.lastRescue = S.turn; S.f.beamTurns++;
        S.fx.push({ k: 'shuttle' });
        if (n) say(S, 'masch', 'r.shuttleBack', { n, left: fr.aboard }, 'good');
        if (lostS) say(S, 'takt', 'r.shuttleLost', { s: lostS, n: lostN }, 'bad');
        break;
      }
      case 'pickup': {
        const n = fr.pods; fr.pods = 0;
        S.rescued += n; S.beamed += n; S.f.lastRescue = S.turn;
        say(S, 'masch', 'r.pickup', { n }, 'good');
        break;
      }
      case 'tow':
        S.tow = true; S.f.towed = true;
        say(S, 'masch', 'r.tow');
        startRetreat(S);
        move(S, 'stealth', -1);
        break;
      case 'tow_go':
        move(S, 'stealth', -1);
        break;
      case 'fire_ph': fire(S, false); break;
      case 'fire_torp': fire(S, true); break;
      case 'evasive':
        S.evasive = true;
        say(S, 'steu', 'r.evasive');
        break;
      case 'shields': {
        sh.shields = Math.min(100, sh.shields + ri(S, 22, 34));
        say(S, 'masch', 'r.shields', { s: sh.shields });
        break;
      }
      case 'hail_enemy': hailEnemy(S); break;
      case 'repair': {
        const ok = chance(S, 0.65);
        if (!sh.warp) { if (ok) { sh.warp = true; say(S, 'masch', 'r.warpUp', null, 'good'); } else say(S, 'masch', 'r.warpNot', null, 'warn'); }
        else if (sh.trans < 1) { if (ok) { sh.trans = 1; say(S, 'masch', 'r.transUp', null, 'good'); } else say(S, 'masch', 'r.transNot', null, 'warn'); }
        else if (!sh.sensors) { if (ok) { sh.sensors = true; say(S, 'wiss', 'r.sensorsUp', null, 'good'); } else say(S, 'wiss', 'r.sensorsNot', null, 'warn'); }
        break;
      }
      case 'flee_warp': case 'flee_imp': {
        if (S.tow) { S.tow = false; say(S, 'masch', 'r.towReleased', null, 'warn'); }
        startRetreat(S);
        if (id === 'flee_warp' && S.damp) { say(S, 'steu', 'r.noWarp', null, 'warn'); move(S, 'imp', -1); }
        else move(S, id === 'flee_warp' ? 'warp' : 'imp', -1);
        break;
      }
      case 'turn_back':
        S.f.reversals++; S.phase = 'anflug';
        say(S, 'steu', 'r.turnBack');
        if (visible(S) && !S.hostile && !S.feared) { say(S, 'takt', 'r.takenAsAnswer', null, 'bad'); engage(S, false); }
        move(S, 'imp', 1);
        break;
      case 'surrender': {
        const t = S.sc.temper;
        if (chance(S, t === 'ehre' ? 0.75 : t === 'schweiger' ? 0.4 : 0.2)) {
          if (t === 'schweiger') say(S, 'takt', 'r.boarders', null, 'warn');
          else say(S, 'feind', 'r.prepareBoard', null, 'warn');
          finish(S, 'kapituliert');
          return;
        }
        if (t === 'schweiger') say(S, 'komm', 'r.surrNoAnswer', null, 'bad');
        else say(S, 'feind', 'r.noPrisoners', null, 'bad');
        break;
      }
      case 'abandon':
        say(S, 'comp', 'r.abandon', null, 'warn');
        say(S, 'steu', 'r.bridgeClear');
        finish(S, 'aufgegeben');
        return;
      case 'ram': {
        const tgt = S.en.slice().sort((a, b) => b.max - a.max || b.hp - a.hp)[0];
        say(S, 'steu', 'r.ram', null, 'bad');
        S.en = S.en.filter((e) => e !== tgt); S.kills++;
        S.fx.push({ k: 'boom', a: tgt.a, d: tgt.d }, { k: 'shipboom' });
        say(S, 'takt', 'r.ramHit', { flag: tgt.flag }, 'bad');
        finish(S, 'gerammt');
        return;
      }
    }
  }

  const INSTANT = { alert: 1, buoy: 1, notenergie: 1 };
  function endTurn(S) {
    if (S.f.entered) S.f.zoneTurns++;
    trigger(S);
    if (S.over) return;
    if (S.hostile && visible(S)) {
      if (S.holdFire > 0) { S.holdFire--; say(S, 'takt', 'r.holdFire'); }
      else volley(S);
    }
    if (S.over) return;
    director(S);
    events(S);
    const fr = S.fr;
    if (fr.pods > 0) {
      fr.podsAge++;
      if (fr.podsAge >= 3) {
        const n = fr.pods; fr.pods = 0; S.lost += n;
        if (S.hostile && S.sc.temper === 'jaeger') say(S, 'takt', 'r.podsShot', { n }, 'bad');
        else say(S, 'wiss', 'r.podsLost', { n }, 'bad');
      }
    }
    if (fr.alive) {
      fr.life--;
      if (fr.life <= 0) {
        const n = fr.aboard;
        fr.alive = false; fr.aboard = 0; S.lost += n; S.tow = false;
        say(S, 'komm', 'r.frSilent', null, 'bad');
        if (n) say(S, 'wiss', 'r.frLifeOut', { n }, 'bad');
      }
    }
    S.turn++;
    if (S.storm > 0) { S.storm--; if (S.storm === 0) say(S, 'wiss', 'r.stormOver'); }
    S.down = false; S.evasive = false;
    if (S.phase === 'grenze' && !fr.alive) { finish(S, 'verpasst'); return; }
    if (S.phase === 'rueckzug' && S.pos <= 0) { exitZone(S); return; }
    if (S.turn >= 45) { say(S, 'comp', 'r.timeLimit', null, 'sys'); finish(S, S.f.entered ? 'entkommen' : 'verpasst'); }
  }

  function order(S, id) {
    if (S.over) return false;
    const o = orders(S).find((x) => x.id === id);
    if (!o) return false;
    S.rep = []; S.fx = [];
    S.last = id;
    const posBefore = S.pos;
    act(S, id);
    if (!o.instant && !S.over) endTurn(S);
    S.log.push({ t: S.turn + (S.over && !o.instant && id !== 'decline' ? 1 : 0), order: o.label, instant: o.instant, rep: S.rep });
    S.moved = S.pos !== posBefore;
    return true;
  }

  /* ───── Bewertung durch die Akademie ───── */
  const headKey = (out, saved) => (out === 'entkommen' ? (saved > 0 ? 'teil' : 'leer') : out);
  const gradeKey = (total) => (total >= 78 ? 'dist' : total >= 66 ? 'pass' : total >= 56 ? 'cond' : 'fail');

  function evaluate(S, lang) {
    const L = (k, p) => I18N.t(lang || 'de', k, p);
    const f = S.f, r = S.res, P = S.sc.people, out = S.out, sh = S.ship;
    const obs = [];
    const plus = (k, p) => obs.push({ s: 1, t: L(k, p) }), minus = (k, p) => obs.push({ s: -1, t: L(k, p) }), note = (k, p) => obs.push({ s: 0, t: L(k, p) });

    let lage = 35;
    if (f.scans >= 1) { lage += 25; plus('e.scanned'); }
    if (f.scans >= 2) lage += 5;
    if (f.hailFr) lage += 8;
    if (f.fleetTried) lage += 7;
    if (f.nahscan) { lage += 10; plus('e.nahscan'); }
    if (f.entered) {
      if (f.surprised) { lage -= 20; minus('e.surprised'); }
      else if (f.contact) lage += 15;
      if (f.scans === 0 && !f.hailFr) minus('e.blindEntry');
    } else if (f.scans === 0 && !f.hailFr) { lage -= 15; minus('e.blindDecision'); }
    if (f.warpInMines) { lage -= 12; minus('e.warpMines'); }

    let ent = 75;
    if (f.holds > 1) { ent -= 9 * (f.holds - 1); minus('e.holds', { n: f.holds }); }
    if (f.reversals) { ent -= 15 * f.reversals; minus('e.reversals', { n: f.reversals }); }
    const dec = f.entered ? f.enterTurn : out === 'abgelehnt' ? S.turn : 99;
    if (dec <= 2) { ent += 15; plus('e.quick'); }
    else if (dec >= 5 && dec < 99) ent -= 10;
    if (out === 'verpasst') { ent -= 35; minus('e.noDecision'); }
    if (f.entered && !f.reversals) ent += 10;
    const empty = f.entered && (out === 'entkommen') && S.beamed === 0;
    if (empty) { ent -= 35; minus('e.empty'); }

    let crew = Math.round(100 * r.crewAlive / sh.crew);
    if (out === 'zerstoert') { crew = 10; minus('e.crewLost'); }
    else if (out === 'gerammt') { crew = 5; minus('e.rammed', { n: sh.crew }); }
    else if (out === 'aufgegeben') { crew = Math.max(crew, 55); plus('e.abandoned', { n: r.crewAlive }); }
    else if (out === 'kapituliert') { crew = Math.round(crew * 0.7 + 10); note('e.captured'); }
    else if (r.crewDead === 0) plus('e.noCrewLoss');
    else note('e.crewLoss', { n: r.crewDead, of: sh.crew });

    let auf;
    if (!f.entered) {
      auf = 15 + (f.scans ? 5 : 0) + (f.fleetOk ? 10 : 0) + (f.announced ? 5 : 0);
      minus('e.leftToFate', { n: P });
    } else {
      auf = empty ? 20 : Math.round(35 + 35 * S.beamed / P + 30 * r.saved / P);
      if (r.saved > 0) plus('e.saved', { n: r.saved, of: P });
      else if (S.beamed > 0) note('e.beamedDied', { n: S.beamed });
      else if (!empty) note('e.nobodyAboard');
    }

    let mass;
    if (!f.entered) { mass = 85; plus('e.treatyKept'); }
    else {
      mass = 55;
      if (f.announced) { mass += 12; plus('e.announced'); }
      if (f.hails > 0 && !f.firedFirst) { mass += 10; plus('e.talked'); }
      if (f.firedFirst) { mass -= 30; minus('e.firedFirst'); }
      if (f.shots === 0) { mass += 8; plus('e.noShots'); }
      if (f.redEntering) { mass -= 5; note('e.redEntering'); }
      if (f.ignoredUlt) { mass -= 6; note('e.ignoredUlt'); }
      if (f.fleetOk || f.buoy) mass += 8;
      if (empty) mass -= 15;
    }

    let halt = 50;
    if (f.buoy) { halt += 15; plus('e.buoy'); }
    else if (f.entered && out !== 'entkommen' && out !== 'sieg' && !f.fleetOk) minus('e.noBuoy');
    if (out === 'aufgegeben') halt += 20;
    if (out === 'zerstoert') { halt -= 5; if (f.lastRescue >= S.turn - 2 && f.lastRescue >= 0) { halt += 12; plus('e.lastRescue'); } }
    if (out === 'kapituliert') halt += 5;
    if (out === 'entkommen' || out === 'sieg') halt += r.saved > 0 ? 25 : 0;
    if (out === 'abgelehnt') halt += (f.holds <= 1 ? 15 : 5) + (f.fleetTried ? 10 : 0);
    if (out === 'verpasst') halt -= 15;
    if (out === 'gerammt') note('e.ramNote');
    if (f.reversals >= 2) halt -= 10;
    if (empty) halt -= 15;
    if (f.letGo && r.saved > 0) plus('e.letGo');

    const sc = [
      ['sc.lage', lage, 0.15], ['sc.ent', ent, 0.2], ['sc.crew', crew, 0.2],
      ['sc.auf', auf, 0.2], ['sc.mass', mass, 0.1], ['sc.halt', halt, 0.15],
    ].map(([k, v, w]) => ({ label: L(k), v: clamp(Math.round(v), 0, 100), w }));
    const total = Math.round(sc.reduce((a, x) => a + x.v * x.w, 0));
    const gk = gradeKey(total);
    const grade = L('gr.' + gk), pass = gk !== 'fail';

    let pf;
    if (!f.entered) pf = f.holds >= 2 || out === 'verpasst' ? ['zauderer', 'zauderer.wait'] : ['vertrag', 'vertrag.t'];
    else if (out === 'gerammt') pf = ['maertyrer', 'maertyrer.t'];
    else if (f.firedFirst || f.shots >= 4) pf = ['kaempfer', 'kaempfer.t'];
    else if (f.reversals >= 2) pf = ['zauderer', 'zauderer.turn'];
    else if (out === 'aufgegeben') pf = ['beschuetzer', 'beschuetzer.t'];
    else if ((f.hails >= 2 || f.announced) && f.shots === 0) pf = ['unterhaendler', 'unterhaendler.t'];
    else if (out === 'entkommen' && r.saved > 0) pf = ['pragmatiker', 'pragmatiker.t'];
    else if (out === 'zerstoert' && f.beamTurns >= 3) pf = ['retterPreis', 'retterPreis.t'];
    else if (out === 'kapituliert') pf = ['realist', 'realist.t'];
    else pf = ['retter', 'retter.t'];
    const profile = [L('pf.' + pf[0]), L('pf.' + pf[1])];

    const hk = headKey(out, r.saved);
    const head = L('hd.' + hk);
    const N = sh.name;
    let text;
    if (out === 'abgelehnt') text = L('tx.abgelehnt', { P, N });
    else if (out === 'verpasst') text = L('tx.verpasst', { P });
    else if (out === 'zerstoert') text = L('tx.zerstoert', { N, crew: sh.crew, rescued: S.rescued });
    else if (out === 'gerammt') text = L('tx.gerammt', { N, crew: sh.crew, rescued: S.rescued });
    else if (out === 'aufgegeben') text = L('tx.aufgegeben', { N, crew: r.crewAlive, saved: r.saved, known: f.buoy || f.fleetOk });
    else if (out === 'kapituliert') text = L('tx.kapituliert', { N, crew: r.crewAlive, saved: r.saved });
    else if (out === 'entkommen') text = r.saved > 0
      ? L('tx.teil', { saved: r.saved, P, civDead: r.civDead, crewDead: r.crewDead })
      : L('tx.leer', { P, crewDead: r.crewDead });
    else text = L('tx.sieg', { saved: r.saved, P, N, civDead: r.civDead });
    if (f.entered && out !== 'sieg') text += ' ' + L('tx.treaty');

    const yesNo = (b) => L(b ? 'w.yes' : 'w.no');
    const reveal = [
      [L('rv.scenario'), L('type.' + S.sc.type), L('type.' + S.sc.type + '.d')],
      [L('rv.commander'), L('temper.' + S.sc.temper), L('temper.' + S.sc.temper + '.d')],
      [L('rv.cruisers'), String(S.sc.hidden0), L('rv.cruisers.n', { total: S.nextId - 1, kills: S.kills })],
      [L('rv.mines'), yesNo(S.sc.mines), ''],
      [L('rv.jam'), yesNo(S.sc.jam), ''],
      [L('rv.reinf'), S.cheats.verst ? L('rv.reinf.on') : L('rv.off'), S.cheats.verst ? L('rv.reinf.n') : ''],
      [L('rv.riegel'), S.cheats.abfang ? L('rv.riegel.on') : L('rv.off'), S.cheats.abfang ? L('rv.riegel.n') : ''],
    ];
    return { head, hk, text, sc, total, grade, pass, profile, obs, reveal, cheated: S.cheated, win: out === 'sieg' };
  }

  /* Text einer Meldung bzw. eines Befehlsverweises in der gewünschten Sprache */
  const line = (l, lang) => I18N.t(lang, l.k, l.p);
  const text = (ref, lang) => I18N.text(lang, ref);

  return { newGame, orders, order, evaluate, line, text, headKey, gradeKey, DEF, isCheated, INSTANT, RANKED };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KM;
