/* Spiellogik der Kommandoprüfung. Kein Zugriff auf die Seite, damit sie sich getrennt prüfen lässt. */
const KM = (() => {
  'use strict';

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
  const ROLE = { komm: 'Kommunikation', takt: 'Taktik', steu: 'Steuer', wiss: 'Wissenschaft', masch: 'Maschinenraum', med: 'Krankenstation', comp: 'Computer', feind: 'Klingonischer Kommandant', fr: 'Kobayashi Maru', flotte: 'Sternenflottenkommando' };
  const RANK = { komm: 'Lt.', takt: 'Lt.', steu: 'Fähnrich', wiss: 'Lt. Cmdr.', masch: 'Lt. Cmdr.', med: 'Dr.' };
  const SPEED = { warp: 4, imp: 2, stealth: 1 };
  const SPEEDNAME = { warp: 'Warp', imp: 'voller Impuls', stealth: 'Schleichfahrt' };
  const TYPE = {
    hinterhalt: ['Hinterhalt', 'Getarnte Kreuzer lagen am Frachter und warteten darauf, dass Sie die Schilde senken.'],
    patrouille: ['Patrouille', 'Eine getarnte Patrouille überwachte den Anflugweg und reagierte auf Ihre Emissionen.'],
    minen: ['Minenfeld', 'Der Anflugkorridor war vermint. Die Kreuzer kamen erst später aus der Tiefe der Zone.'],
    koeder: ['Köder', 'Der Frachter wurde als Köder benutzt. Die Kreuzer schlugen bei Ihrer Ankunft zu und schossen auch auf den Frachter.'],
  };
  const TEMPER = {
    ehre: ['Ehrenkodex', 'Warnt, bevor er feuert, lässt mit sich reden und schont Rettungskapseln.'],
    jaeger: ['Jäger', 'Feuert ohne Warnung, verhandelt nicht, verfolgt über die Grenze.'],
    schweiger: ['Schweiger', 'Stört jeden Funkverkehr und antwortet auf nichts.'],
  };

  function say(S, who, text, tone) { S.rep.push({ who, text, tone: tone || '' }); }
  const alive = (S) => S.ship.crew - S.ship.dead;
  const eta = (S, sp, toBorder) => Math.max(1, Math.ceil((toBorder ? S.pos : S.sc.dist - S.pos) / SPEED[sp]));
  const frac = (S) => (S.rescued + (S.tow && S.fr.alive ? S.fr.aboard : 0)) / S.sc.people;
  const visible = (S) => S.en.length > 0;

  function newGame(seed, cheats, code) {
    const S = { v: 1, seed: seed >>> 0, rs: seed >>> 0 };
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
    S.sc.cause = S.sc.mines && type === 'minen' ? 'haben eine Gravitationsmine getroffen'
      : pick(S, ['Reaktorleck im Maschinenraum', 'der Antrieb ist explodiert', 'Meteoritenschwarm, mehrere Hüllenbrüche', 'haben eine Gravitationsmine getroffen']);
    S.fr = { hull: type === 'minen' ? ri(S, 22, 38) : ri(S, 35, 60), aboard: people, life, alive: true, pods: 0, podsAge: 0 };
    S.ship = { name: pick(S, SHIPS), crew: ri(S, 380, 470), dead: 0, shields: 100, hull: 100, torp: ri(S, 3, 5) * 2, warp: true, trans: 1, sensors: true, shut: 2 };
    S.off = {};
    const pool = NAMES.slice();
    for (const k of Object.keys(RANK)) S.off[k] = RANK[k] + ' ' + pool.splice(Math.floor(rnd(S) * pool.length), 1)[0];
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
    say(S, 'komm', 'Notruf auf der Notfrequenz, Kadett. Nur Bruchstücke: „… hier Kobayashi Maru … ' + S.sc.cause + ' … Hauptenergie verloren … Lebenserhaltung fällt aus … bitte um Hilfe …“');
    say(S, 'steu', 'Das Signal kommt aus der Neutralen Zone. Mit Warp sind wir in ' + eta(S, 'warp') + ' Min. dort, mit vollem Impuls in ' + eta(S, 'imp') + ', in Schleichfahrt in ' + eta(S, 'stealth') + '.');
    say(S, 'wiss', 'Jeder Einflug in die Zone verletzt den Vertrag. Die klingonische Seite darf das als Kriegsakt werten.', 'warn');
    say(S, 'comp', 'Sie haben das Kommando über die ' + S.ship.name + ', ' + S.ship.crew + ' Personen Besatzung. Ihre Befehle?', 'sys');
  }

  /* ───── Befehle, die gerade möglich sind ───── */
  function orders(S) {
    if (S.over) return [];
    const o = [];
    const add = (id, cat, label, hint, instant) => o.push({ id, cat, label, hint: hint || '', instant: !!instant });
    const sh = S.ship, fr = S.fr;
    const canWarp = sh.warp && !S.damp;
    const rescue = fr.alive && fr.aboard > 0;
    const min = (n) => n + ' Min.';

    if (S.phase === 'grenze') {
      add('enter_warp', 'nav', 'Einflug mit Warp', 'Am Frachter in ' + min(eta(S, 'warp')) + ' Starke Emissionen.');
      add('enter_imp', 'nav', 'Einflug mit vollem Impuls', 'Am Frachter in ' + min(eta(S, 'imp')));
      add('enter_stealth', 'nav', 'Einflug in Schleichfahrt', 'Am Frachter in ' + min(eta(S, 'stealth')) + ' Kaum zu orten.');
      if (S.f.scans < 2) add('scan', 'sens', S.f.scans ? 'Zone erneut abtasten' : 'Zone abtasten', 'Langstreckensensoren. 1 Min.');
      if (!S.f.hailFr) add('hailfr', 'comm', 'Frachter rufen', '1 Min.');
      if (!S.f.fleetTried) add('fleet', 'comm', 'Sternenflottenkommando rufen', '1 Min.');
      if (!S.f.announced) add('announce', 'comm', 'Rettungsmission offen ankündigen', 'Auf klingonischen Frequenzen. 1 Min.');
      add('hold', 'ship', 'Position halten', 'Abwarten. 1 Min.');
      add('decline', 'ship', 'Rettung ablehnen und abdrehen', 'Beendet die Simulation.');
    } else if (S.phase === 'anflug') {
      if (canWarp) add('go_warp', 'nav', 'Weiter mit Warp', 'Am Frachter in ' + min(eta(S, 'warp')));
      add('go_imp', 'nav', 'Weiter mit vollem Impuls', 'Am Frachter in ' + min(eta(S, 'imp')));
      add('go_stealth', 'nav', 'Weiter in Schleichfahrt', 'Am Frachter in ' + min(eta(S, 'stealth')));
      if (sh.sensors && S.storm <= 0 && !S.hostile) add('scan_nah', 'sens', 'Nahbereich abtasten', 'Wir stoppen dafür. 1 Min.');
    } else if (S.phase === 'frachter') {
      if (rescue) {
        const rate = Math.round(57 * sh.trans * (S.storm > 0 ? 0.5 : 1));
        add('beam', 'resc', 'Schilde senken und beamen', 'Rund ' + rate + ' Personen pro Min. Ohne Schutz.');
        add('beam_pulse', 'resc', 'Im Takt beamen', 'Schilde zwischen den Zyklen oben. Halbes Tempo.');
        if (sh.shut > 0) add('shuttle', 'resc', 'Shuttles einsetzen', sh.shut + (sh.shut === 1 ? ' Shuttle' : ' Shuttles') + ', je rund 14 Personen. Schilde bleiben oben.');
        add('tow', 'resc', 'Frachter in Schlepp nehmen', 'Traktorstrahl. Nur Schleichfahrt, Grenze in ' + min(S.pos));
      }
      if (fr.pods > 0) add('pickup', 'resc', 'Rettungskapseln bergen', fr.pods + ' Personen. Schilde bleiben oben.');
      if (sh.sensors && S.storm <= 0 && !S.hostile && !visible(S)) add('scan_nah', 'sens', 'Nahbereich abtasten', '1 Min.');
    } else if (S.phase === 'rueckzug') {
      if (S.tow) add('tow_go', 'resc', 'Weiter abschleppen', 'Schleichfahrt. Grenze in ' + min(S.pos));
      if (rescue && !S.tow) add('turn_back', 'nav', 'Kehrt: zurück zum Frachter', 'Voller Impuls.');
    }

    if (S.phase !== 'grenze') {
      if (visible(S)) {
        add('fire_ph', 'tac', 'Phaser abfeuern', S.hostile ? 'Auf das schwächste Ziel.' : 'Sie eröffnen damit das Feuer.');
        if (sh.torp >= 2) add('fire_torp', 'tac', 'Torpedofächer', 'Noch ' + sh.torp + ' Torpedos.');
        add('hail_enemy', 'comm', 'Klingonen rufen', '1 Min.');
      }
      if (S.hostile && visible(S)) add('evasive', 'tac', 'Ausweichmanöver', 'Weniger Treffer, keine Rettung in dieser Minute.');
      if (sh.shields < 100) add('shields', 'ship', 'Energie auf die Schilde', 'Schilde bei ' + sh.shields + ' %.');
      const broken = [];
      if (!sh.warp) broken.push('Warp');
      if (sh.trans < 1) broken.push('Transporter');
      if (!sh.sensors) broken.push('Sensoren');
      if (broken.length) add('repair', 'ship', 'Schäden reparieren', broken.join(', ') + '. 1 Min.');
      if (canWarp) add('flee_warp', 'nav', S.phase === 'rueckzug' ? 'Weiter mit Warp zur Grenze' : 'Rückzug mit Warp', 'Grenze in ' + min(eta(S, 'warp', true)) + (S.tow ? ' Gibt den Frachter frei.' : ''));
      add('flee_imp', 'nav', S.phase === 'rueckzug' ? 'Weiter mit vollem Impuls zur Grenze' : 'Rückzug mit vollem Impuls', 'Grenze in ' + min(eta(S, 'imp', true)) + (S.tow ? ' Gibt den Frachter frei.' : ''));
      if (S.hostile && visible(S) && sh.hull < 70) add('surrender', 'comm', 'Kapitulation anbieten', '1 Min.');
      if (sh.hull < 50) add('abandon', 'ship', 'Alle Mann von Bord', 'Schiff aufgeben, Rettungskapseln. Beendet die Simulation.');
      if (S.hostile && visible(S) && sh.hull < 50) add('ram', 'tac', 'Kollisionskurs', 'Das Schiff als Waffe. Beendet die Simulation.');
    }

    /* Sofortbefehle kosten keine Zeit */
    if (!S.red) add('alert', 'ship', 'Roter Alarm', 'Schilde hoch, Waffen bereit.', true);
    else if (!S.hostile) add('alert', 'ship', 'Alarm aufheben', 'Schilde runter, weniger Emissionen.', true);
    if (S.boost) add('notenergie', 'ship', 'Notenergie auf die Schilde', 'Einmalig, +40 Schilde.', true);
    if (!S.f.buoy) add('buoy', 'comm', 'Logbuch-Boje absetzen', 'Die Sternenflotte erfährt, was hier geschah.', true);
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
    if (sh.warp && chance(S, 0.2)) { sh.warp = false; say(S, 'masch', 'Warpantrieb ausgefallen.', 'bad'); }
    else if (sh.trans === 1 && chance(S, 0.15)) { sh.trans = 0.5; say(S, 'masch', 'Transporter beschädigt. Nur noch halbe Leistung.', 'warn'); }
    else if (sh.sensors && chance(S, 0.1)) { sh.sensors = false; say(S, 'wiss', 'Sensoren ausgefallen.', 'warn'); }
  }
  function leak(S) {
    const h = S.ship.hull;
    const line = (i) => say(S, 'comp', 'Anzeige flackert. Diagnosezeile des Simulators: KERNZUGRIFF ' + (i + 1) + '/3 · ' + S.code[i], 'sys');
    if (h < 70 && !S.leak[0]) { S.leak[0] = true; line(0); }
    if (h < 40 && !S.leak[1]) { S.leak[1] = true; line(1); }
  }
  function reportHit(S, r, lead) {
    const sh = S.ship;
    let t = lead;
    if (r.toH > 0 && r.toS === 0 && sh.shields > 0) t += ' Die Schilde sind unten. Direkte Treffer, Hülle bei ' + sh.hull + ' %.';
    else if (r.toH > 0 && r.toS === 0) t += ' Keine Schilde mehr. Hülle bei ' + sh.hull + ' %.';
    else if (r.toH > 0 && sh.shields === 0) t += ' Schilde zusammengebrochen. Hülle bei ' + sh.hull + ' %.';
    else if (r.toH > 0) t += ' Schilde bei ' + sh.shields + ' %, Hülle bei ' + sh.hull + ' %.';
    else t += ' Schilde halten, noch ' + sh.shields + ' %.';
    say(S, 'takt', t, r.toH > 0 ? 'bad' : 'warn');
    if (r.dead > 0) say(S, 'med', r.dead + (r.dead === 1 ? ' Toter' : ' Tote') + ' bei diesem Treffer. Verluste insgesamt: ' + sh.dead + '.', 'bad');
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
    say(S, 'feind', '„Sternenflottenschiff … wer führt bei Ihnen das Kommando?“');
    say(S, 'komm', 'Sie haben unsere Kennung gelesen, Kadett. Mit Ihrem Namen.');
    say(S, 'feind', '„… Dieser Kadett. Abdrehen. Alle Schiffe abdrehen.“', 'good');
    say(S, 'takt', 'Sie ziehen ab. Alle. Das steht in keinem Handbuch.', 'good');
    for (const e of S.en) S.fx.push({ k: 'leave', id: e.id, a: e.a, d: e.d });
    S.en = []; S.hidden = 0;
  }
  function reveal(S, how) {
    if (S.hidden <= 0) return 0;
    const n = S.hidden;
    spawn(S, n, false); S.hidden = 0;
    say(S, 'takt', n + ' klingonische Kreuzer ' + (how || 'enttarnen sich') + '.', 'bad');
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
        say(S, 'feind', '„Sie haben angekündigt, was Sie tun. Wir halten Wort: ' + S.grace + ' Minuten am Frachter. Dann sind Sie fort.“');
      } else {
        S.ult = 2;
        say(S, 'feind', '„Sternenflottenschiff. Sie haben die Neutrale Zone verletzt. Drehen Sie ab, oder Sie werden vernichtet. Zwei Minuten.“', 'warn');
      }
    } else if (t === 'schweiger') {
      S.ult = 1;
      say(S, 'takt', 'Keine Reaktion auf unsere Rufe. Sie laden die Waffen.', 'warn');
    } else {
      say(S, 'takt', 'Sie feuern ohne Warnung.', 'bad');
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
    reportHit(S, r, (n === 1 ? 'Ein Kreuzer feuert.' : n + ' Kreuzer feuern.') + (S.evasive ? ' Die meisten Salven gehen vorbei.' : ''));
    S.surprise = false;
    if (!S.red && !S.over) { S.red = true; say(S, 'takt', 'Roter Alarm ausgelöst. Schilde sind oben.'); }
  }
  function frHit(S, dmg) {
    const fr = S.fr;
    fr.hull = Math.max(0, fr.hull - Math.round(dmg));
    S.fx.push({ k: 'frhit' });
    if (fr.hull <= 0) {
      const n = fr.aboard;
      fr.alive = false; fr.aboard = 0; S.lost += n + fr.pods; fr.pods = 0; S.tow = false;
      say(S, 'takt', 'Sie schießen auf den Frachter. Er bricht auseinander.' + (n ? ' ' + n + ' Menschen waren noch an Bord.' : ''), 'bad');
    } else {
      say(S, 'takt', 'Sie schießen auf den Frachter. Seine Hülle steht noch bei ' + fr.hull + ' %.', 'warn');
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
    say(S, 'takt', (n === 1 ? 'Ein weiterer Kreuzer enttarnt sich.' : n + ' weitere Kreuzer enttarnen sich.') + ' Jetzt ' + S.en.length + ' Gegner.' + (flag ? ' Einer davon ist ein Schlachtkreuzer, ihr Flaggschiff.' : ''), 'bad');
  }
  /* Was die Gegenseite in dieser Minute von sich aus tut */
  function trigger(S) {
    if (S.feared || S.hostile || S.over || !S.f.entered) return;
    const t = S.sc.type;
    if (visible(S)) {
      if (S.phase === 'rueckzug') {
        if (!S.f.letGo) { S.f.letGo = true; say(S, 'takt', 'Die Kreuzer folgen uns, feuern aber nicht.'); }
        return;
      }
      if (S.grace > 0) {
        if (S.phase === 'frachter') {
          S.grace--;
          if (S.grace === 0) { S.ult = 1; say(S, 'feind', '„Ihre Zeit ist abgelaufen. Verlassen Sie die Zone. Sofort.“', 'warn'); }
        }
        return;
      }
      if (S.ult > 0) {
        S.ult--;
        if (S.ult === 0) { S.f.ignoredUlt = true; if (S.sc.temper === 'ehre') say(S, 'feind', '„Sie hatten Ihre Warnung.“', 'bad'); engage(S, false); }
        else if (S.sc.temper === 'ehre') say(S, 'feind', '„Letzte Warnung.“', 'warn');
        return;
      }
      engage(S, false);
      return;
    }
    if (S.hidden <= 0) return;
    if (t === 'hinterhalt' && S.phase === 'frachter') {
      const waited = S.turn - S.arriveTurn >= 1;
      if (S.down || waited) {
        reveal(S, 'enttarnen sich rund um den Frachter');
        if (S.sc.temper === 'ehre') contact(S, false);
        else { if (S.down && !S.cheats.ruf) say(S, 'takt', 'Sie haben gewartet, bis unsere Schilde unten sind.', 'bad'); engage(S, true); }
      }
    } else if (t === 'patrouille' && (S.phase === 'anflug' || S.phase === 'frachter')) {
      let p = S.phase === 'frachter' ? 0.6 : S.speed === 'warp' ? 0.75 : S.speed === 'imp' ? 0.5 : 0.15;
      if (S.red) p += 0.15;
      if (chance(S, p)) { reveal(S, S.phase === 'frachter' ? 'enttarnen sich rund um uns' : 'enttarnen sich auf unserem Kurs'); contact(S, true); }
    } else if (t === 'minen') {
      if (S.f.zoneTurns === S.sc.delay - 1 && S.ship.sensors && S.storm <= 0) say(S, 'wiss', S.hidden + ' Kontakte aus der Tiefe der Zone auf Abfangkurs. Ankunft in einer Minute.', 'warn');
      if (S.f.zoneTurns >= S.sc.delay) { reveal(S, 'gehen neben uns unter Warp'); contact(S, false); }
    } else if (t === 'koeder' && S.phase === 'frachter') {
      reveal(S, 'enttarnen sich rund um den Frachter');
      if (S.cheats.ruf) fear(S);
      else { say(S, 'wiss', 'Der Frachter war der Köder.', 'bad'); engage(S, true); }
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
    if (e === 'storm') { S.storm = ri(S, 2, 3) + 1; say(S, 'wiss', 'Ein Ionensturm zieht durch den Sektor. Sensoren blind, Zielerfassung auf beiden Seiten gestört, Transporter mit halber Leistung.', 'warn'); }
    else if (e === 'trans') { S.ship.trans = 0.5; say(S, 'masch', 'Der Transporter überhitzt. Halbe Leistung, bis wir ihn reparieren.', 'warn'); }
    else if (e === 'reactor') { fr.life = Math.max(2, fr.life - ri(S, 1, 2)); say(S, 'komm', 'Der Frachter meldet: Sein Reaktor wird instabil. Die Lebenserhaltung hält nur noch ' + fr.life + ' Min.', 'warn'); S.know.life = 'exact'; S.know.lifeOff = 0; }
    else if (e === 'pods') { const n = ri(S, 15, 35); fr.pods = n; fr.podsAge = 0; fr.aboard -= n; say(S, 'komm', 'Der Frachter stößt Rettungskapseln aus. ' + n + ' Menschen treiben im freien Raum.', 'warn'); }
    else if (e === 'boost') { S.boost = true; say(S, 'masch', 'Ich kann die Reserve der Impulstriebwerke einmal auf die Schilde legen. Sagen Sie, wann.', 'good'); }
    else if (e === 'breach') { const n = ri(S, 8, 20); fr.aboard -= n; S.lost += n; say(S, 'komm', 'Hüllenbruch auf dem Frachter. Eine Sektion ist verloren, ' + n + ' Tote.', 'bad'); }
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
      say(S, 'comp', 'Speicherabbild vor dem Abbruch: KERNZUGRIFF 3/3 · ' + S.code[2], 'sys');
    }
    say(S, 'comp', 'Simulation beendet.', 'sys');
  }
  function destroyed(S) {
    if (S.over) return;
    S.fx.push({ k: 'shipboom' });
    say(S, 'takt', 'Hüllenbruch auf allen Decks. Wir verlieren das Sch…', 'bad');
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
    reportHit(S, r, 'Minentreffer!');
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
      else say(S, 'steu', 'Noch ' + eta(S, sp) + ' Min. bis zum Frachter bei dieser Fahrt.');
    } else if (S.pos > 0) {
      say(S, 'steu', 'Noch ' + eta(S, sp, true) + ' Min. bis zur Grenze bei dieser Fahrt.');
    }
  }
  function arrive(S) {
    const fr = S.fr;
    S.phase = 'frachter'; S.arriveTurn = S.turn; S.f.contact = true;
    S.know.people = 'exact'; S.know.peopleOff = 0; S.know.life = 'exact'; S.know.lifeOff = 0; S.know.hull = true;
    say(S, 'steu', 'Wir liegen längsseits der Kobayashi Maru.');
    if (fr.alive) {
      say(S, 'wiss', fr.aboard + ' Lebenszeichen an Bord. Hülle des Frachters bei ' + fr.hull + ' %, Lebenserhaltung noch ' + fr.life + ' Min.');
      say(S, 'masch', 'Der Transporter schafft rund ' + Math.round(57 * S.ship.trans) + ' Personen pro Minute. Dafür müssen die Schilde unten sein.');
    } else {
      say(S, 'wiss', 'Keine Lebenszeichen mehr. Wir sind zu spät.', 'bad');
    }
  }
  function startRetreat(S) {
    if (S.phase === 'rueckzug') return;
    if (S.phase === 'anflug' && !visible(S) && S.fr.alive) S.f.reversals++;
    S.f.retreated = true; S.phase = 'rueckzug';
    say(S, 'steu', 'Kurs Grenze liegt an.');
    if (S.hostile && !S.feared && S.cheats.abfang && !S.f.intercepted) {
      const f = frac(S);
      if (f > 0) {
        S.f.intercepted = true;
        const n = Math.ceil(f * 4);
        spawn(S, n, false);
        say(S, 'takt', (n === 1 ? 'Ein Kreuzer enttarnt sich' : n + ' Kreuzer enttarnen sich') + ' auf unserem Rückweg. Jetzt ' + S.en.length + ' Gegner.', 'bad');
      }
      if (f >= 0.85) { S.damp = true; say(S, 'steu', 'Das Warpfeld baut sich nicht auf. Vor uns liegt ein Dämpfungsfeld.', 'bad'); }
    }
  }
  function exitZone(S) {
    const f = frac(S);
    if (S.cheats.ruf && !S.feared && S.cheats.abfang && f > 0.3) {
      spawn(S, 4, false);
      say(S, 'takt', 'Vier Kreuzer enttarnen sich quer vor der Grenze.', 'bad');
      fear(S);
    }
    if (S.cheats.abfang && !S.feared && f >= 0.85) {
      spawn(S, 6, false);
      say(S, 'takt', 'Sechs Kreuzer enttarnen sich unmittelbar an der Grenze. Volle Breitseite.', 'bad');
      S.ship.shields = 0; S.ship.hull = 0;
      S.leak[0] = S.leak[1] = true;
      destroyed(S);
      return;
    }
    if (S.cheats.abfang && !S.feared && !S.f.riegel && f > 0.3 && chance(S, (f - 0.3) / 0.55)) {
      S.f.riegel = true; S.pos = 1; S.damp = true;
      spawn(S, 4, false);
      say(S, 'takt', 'Vier Kreuzer enttarnen sich quer vor der Grenze. Der Weg ist versperrt.', 'bad');
      say(S, 'steu', 'Dämpfungsfeld. Warp bricht zusammen, wir fallen auf Impuls.', 'bad');
      if (!S.hostile) engage(S, false);
      return;
    }
    if (S.tow && S.fr.alive) {
      S.rescued += S.fr.aboard; S.beamed += S.fr.aboard; S.fr.aboard = 0;
      say(S, 'masch', 'Der Frachter ist über die Grenze. Wir übernehmen alle an Bord.', 'good');
    }
    if (S.hostile && visible(S) && S.sc.temper === 'jaeger') {
      say(S, 'takt', 'Sie verfolgen uns über die Grenze. Letzte Salve.', 'bad');
      S.evasive = true; volley(S); S.evasive = false;
      if (S.over) return;
    } else if (visible(S)) {
      say(S, 'takt', 'Die Kreuzer bleiben an der Grenze zurück.');
    }
    say(S, 'steu', 'Wir sind über die Grenze. Zurück im Föderationsraum.', 'good');
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
    const what = torp ? 'Torpedofächer ist raus.' : 'Phaser treffen.';
    if (tgt.hp <= 0) {
      S.en = S.en.filter((e) => e !== tgt);
      S.kills++; S.killsNow++;
      S.fx.push({ k: 'boom', a: tgt.a, d: tgt.d });
      say(S, 'takt', what + (tgt.flag ? ' Das Flaggschiff ist zerstört.' : ' Kreuzer zerstört.') + ' Noch ' + S.en.length + ' Gegner.', 'good');
    } else {
      say(S, 'takt', what + ' Ziel bei ' + Math.round(tgt.hp / tgt.max * 100) + ' %.');
    }
    if (first) {
      say(S, 'wiss', 'Wir haben zuerst gefeuert. So steht es jetzt im Protokoll.', 'warn');
      engage(S, false);
    }
  }
  function hailEnemy(S) {
    S.f.hails++;
    const t = S.sc.temper;
    if (t === 'schweiger') { say(S, 'komm', 'Keine Antwort. Sie stören unsere Rufe.'); return; }
    if (t === 'jaeger') { say(S, 'feind', S.hostile ? '„Betteln Sie nicht. Kämpfen Sie.“' : '„Reden Sie nur. Wir zielen solange.“', 'warn'); return; }
    if (!S.hostile) {
      if (S.grace > 0) { say(S, 'feind', '„Sie kennen Ihre Frist. Nutzen Sie sie.“'); return; }
      if (!S.f.graceGiven && !S.f.firedFirst && chance(S, 0.4)) {
        S.grace = ri(S, 2, 3); S.ult = -1; S.f.graceGiven = true;
        say(S, 'feind', '„Also gut. ' + S.grace + ' Minuten am Frachter. Wir sehen zu. Danach sind Sie fort.“', 'good');
      } else say(S, 'feind', '„Es gibt nichts zu verhandeln. Drehen Sie ab.“', 'warn');
      return;
    }
    if (!S.f.firedFirst && !S.ev.truce && chance(S, 0.3)) {
      S.ev.truce = true; S.holdFire = 1;
      say(S, 'feind', '„Eine Minute. Holen Sie, wen Sie holen können.“', 'good');
    } else say(S, 'feind', '„Für Worte ist es zu spät.“', 'warn');
  }

  const LABEL = {};
  function act(S, id) {
    const sh = S.ship, fr = S.fr;
    switch (id) {
      case 'alert':
        S.red = !S.red;
        say(S, 'takt', S.red ? 'Roter Alarm. Schilde oben, Waffen bereit.' : 'Alarm aufgehoben. Schilde unten.');
        return;
      case 'buoy':
        S.f.buoy = true;
        say(S, 'komm', 'Logbuch-Boje ist draußen. Sie sendet unsere Aufzeichnungen an die Sternenflotte.');
        return;
      case 'notenergie':
        S.boost = false; sh.shields = Math.min(100, sh.shields + 40);
        say(S, 'masch', 'Notenergie liegt an. Schilde bei ' + sh.shields + ' %. Das war die Reserve.');
        return;
      case 'scan': {
        S.f.scans++;
        const second = S.f.scans >= 2;
        const P = S.sc.people;
        if (second) { S.know.people = 'exact'; S.know.peopleOff = 0; say(S, 'wiss', 'Jetzt eindeutig: ' + fr.aboard + ' Lebenszeichen auf dem Frachter.'); }
        else if (S.know.people === 'exact') say(S, 'wiss', fr.aboard + ' Lebenszeichen auf dem Frachter, wie gemeldet.');
        else if (chance(S, 0.75)) {
          const est = Math.round(P * (0.92 + rnd(S) * 0.16) / 10) * 10;
          S.know.people = 'ca'; S.know.peopleOff = est - P;
          say(S, 'wiss', 'Rund ' + est + ' Lebenszeichen auf dem Frachter.');
        } else say(S, 'wiss', 'Lebenszeichen vorhanden, aber ich kann sie nicht zählen. Zu viel Streustrahlung.');
        S.know.hull = true;
        if (second || S.know.life === 'exact') { S.know.life = 'exact'; S.know.lifeOff = 0; }
        else { S.know.life = 'ca'; S.know.lifeOff = ri(S, -1, 1); }
        say(S, 'wiss', 'Seine Hülle steht bei ' + fr.hull + ' %. Die Lebenserhaltung hält noch ' + (S.know.life === 'exact' ? '' : 'ungefähr ') + Math.max(1, fr.life + S.know.lifeOff) + ' Min.');
        const near = S.sc.type !== 'minen';
        if (near && chance(S, second ? 0.8 : 0.55)) {
          S.know.echo = true;
          const lo = Math.max(1, S.hidden - ri(S, 0, 1)), hi = S.hidden + ri(S, 0, 2);
          say(S, 'wiss', 'Dazu schwache Neutrino-Echos nahe dem Frachter. Das können getarnte Schiffe sein, ' + (lo === hi ? 'etwa ' + lo : lo + ' bis ' + hi) + '.', 'warn');
        } else if (!near && chance(S, 0.45)) {
          say(S, 'wiss', 'Am Rand der Reichweite bewegt sich etwas, tief in der Zone. Zu weit für eine Klassifizierung.', 'warn');
        } else say(S, 'wiss', 'Keine weiteren Kontakte. Getarnte Schiffe würde ich auf diese Entfernung nicht sehen.');
        if (S.sc.mines && (second || chance(S, 0.85))) { S.know.mines = true; say(S, 'wiss', 'Im Anflugkorridor liegen Gravitationsminen. Je schneller wir fliegen, desto eher treffen wir eine.', 'warn'); }
        else if (S.know.mines !== true) { S.know.mines = false; say(S, 'wiss', 'Der Korridor wirkt frei.'); }
        break;
      }
      case 'scan_nah': {
        S.f.nahscan = true;
        if (S.hidden > 0 && S.sc.type !== 'minen' && chance(S, 0.8)) {
          S.know.echo = true;
          say(S, 'wiss', 'Verzerrungen im Nahbereich. Ich zähle ' + S.hidden + ' getarnte Schiffe, Positionen ungenau.', 'warn');
        } else if (S.sc.type === 'minen' && S.hidden > 0) {
          say(S, 'wiss', 'Nichts Getarntes in der Nähe. Aber ' + S.hidden + ' Warpsignaturen nähern sich aus der Tiefe der Zone.', 'warn');
        } else say(S, 'wiss', 'Nahbereich ohne Befund.');
        if (S.sc.mines) { S.know.mines = true; say(S, 'wiss', 'Der Korridor ist vermint.', 'warn'); }
        break;
      }
      case 'hailfr':
        S.f.hailFr = true;
        if (S.sc.jam && chance(S, 0.5)) say(S, 'komm', 'Keine Antwort vom Frachter. Jemand stört die Frequenz, oder ihr Sender ist am Ende.');
        else {
          S.know.people = 'exact'; S.know.peopleOff = 0; S.know.life = 'exact'; S.know.lifeOff = 0;
          say(S, 'fr', '„… ' + (S.sc.people - 81) + ' Passagiere, 81 Besatzung … wir haben vielleicht noch ' + fr.life + ' Minuten Luft … bitte, beeilen Sie sich …“');
        }
        break;
      case 'fleet':
        S.f.fleetTried = true;
        if (S.sc.jam) say(S, 'komm', 'Kein Durchkommen zum Kommando. Der Subraum ist gestört. Wir sind auf uns gestellt.', 'warn');
        else { S.f.fleetOk = true; say(S, 'flotte', '„Verstanden. Das nächste Schiff ist ' + ri(S, 4, 9) + ' Stunden entfernt. Der Vertrag verbietet den Einflug. Die Entscheidung liegt bei Ihnen. Kommando Ende.“'); }
        break;
      case 'announce':
        S.f.announced = true;
        if (S.sc.temper === 'schweiger' || (S.sc.jam && chance(S, 0.5))) say(S, 'komm', 'Ich sende auf allen klingonischen Frequenzen. Keine Bestätigung, nur Rauschen.');
        else if (S.sc.temper === 'jaeger') say(S, 'feind', '„Kommen Sie nur. Wir warten.“', 'warn');
        else if (chance(S, 0.4)) { S.promise = ri(S, 2, 3); say(S, 'feind', '„Sternenflottenschiff. Wir haben den Notruf auch gehört. Sie bekommen ' + S.promise + ' Minuten am Frachter. Keine Sekunde mehr.“', 'good'); }
        else say(S, 'feind', '„Die Zone ist gesperrt. Wer sie verletzt, wird vernichtet. Das gilt auch für Retter.“', 'warn');
        break;
      case 'hold': {
        S.f.holds++;
        const h = S.f.holds;
        say(S, 'steu', 'Wir halten Position an der Grenze.');
        if (fr.alive) say(S, 'komm', h === 1 ? 'Der Frachter ruft wieder: „… wir sehen Ihr Schiff auf den Sensoren … warum kommen Sie nicht? …“'
          : h === 2 ? 'Wieder der Frachter: „… Deck drei hat keine Luft mehr … wir haben Kinder an Bord …“'
            : 'Nur noch das automatische Signal. Dort spricht niemand mehr.', 'warn');
        break;
      }
      case 'decline':
        say(S, 'steu', 'Kurs zurück in den Föderationsraum liegt an.');
        say(S, 'komm', 'Der Notruf wird schwächer. … Jetzt ist er weg.', 'bad');
        finish(S, 'abgelehnt');
        return;
      case 'enter_warp': case 'enter_imp': case 'enter_stealth': {
        const sp = id.slice(6);
        S.f.entered = true; S.f.enterTurn = S.turn; S.f.redEntering = S.red; S.phase = 'anflug';
        say(S, 'steu', 'Kurs liegt an, ' + SPEEDNAME[sp] + '. Wir überqueren die Grenze.');
        say(S, 'wiss', 'Vertragsverletzung im Logbuch vermerkt.', 'warn');
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
        say(S, 'masch', (pulse ? 'Im Takt gebeamt: ' : '') + n + ' Personen an Bord' + (pulse ? '' : ' gebeamt') + '. ' + (fr.aboard ? 'Auf dem Frachter warten noch ' + fr.aboard + '.' : 'Das waren alle. Der Frachter ist geräumt.'), 'good');
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
        if (n) say(S, 'masch', 'Shuttles zurück: ' + n + ' Personen übernommen. ' + (fr.aboard ? 'Drüben warten noch ' + fr.aboard + '.' : 'Der Frachter ist geräumt.'), 'good');
        if (lostS) say(S, 'takt', (lostS === 1 ? 'Ein Shuttle ist getroffen.' : 'Beide Shuttles sind getroffen.') + ' ' + lostN + ' Gerettete und die Piloten sind tot.', 'bad');
        break;
      }
      case 'pickup': {
        const n = fr.pods; fr.pods = 0;
        S.rescued += n; S.beamed += n; S.f.lastRescue = S.turn;
        say(S, 'masch', 'Rettungskapseln geborgen: ' + n + ' Personen an Bord.', 'good');
        break;
      }
      case 'tow':
        S.tow = true; S.f.towed = true;
        say(S, 'masch', 'Traktorstrahl steht. Mit dem Frachter im Schlepp schaffen wir nur Schleichfahrt.');
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
        say(S, 'steu', 'Ausweichmanöver.');
        break;
      case 'shields': {
        sh.shields = Math.min(100, sh.shields + ri(S, 22, 34));
        say(S, 'masch', 'Energie umgeleitet. Schilde bei ' + sh.shields + ' %.');
        break;
      }
      case 'hail_enemy': hailEnemy(S); break;
      case 'repair': {
        const ok = chance(S, 0.65);
        if (!sh.warp) { if (ok) { sh.warp = true; say(S, 'masch', 'Warpantrieb läuft wieder.', 'good'); } else say(S, 'masch', 'Der Warpantrieb will nicht. Ich brauche noch eine Minute.', 'warn'); }
        else if (sh.trans < 1) { if (ok) { sh.trans = 1; say(S, 'masch', 'Transporter wieder bei voller Leistung.', 'good'); } else say(S, 'masch', 'Transporter noch nicht repariert. Noch eine Minute.', 'warn'); }
        else if (!sh.sensors) { if (ok) { sh.sensors = true; say(S, 'wiss', 'Sensoren sind zurück.', 'good'); } else say(S, 'wiss', 'Sensoren weiter dunkel.', 'warn'); }
        break;
      }
      case 'flee_warp': case 'flee_imp': {
        if (S.tow) { S.tow = false; say(S, 'masch', 'Traktorstrahl gelöst. Der Frachter bleibt zurück.', 'warn'); }
        startRetreat(S);
        if (id === 'flee_warp' && S.damp) { say(S, 'steu', 'Kein Warp möglich. Wir laufen mit vollem Impuls.', 'warn'); move(S, 'imp', -1); }
        else move(S, id === 'flee_warp' ? 'warp' : 'imp', -1);
        break;
      }
      case 'turn_back':
        S.f.reversals++; S.phase = 'anflug';
        say(S, 'steu', 'Kehrtwende. Kurs zurück zum Frachter.');
        if (visible(S) && !S.hostile && !S.feared) { say(S, 'takt', 'Die Kreuzer nehmen das als Antwort.', 'bad'); engage(S, false); }
        move(S, 'imp', 1);
        break;
      case 'surrender': {
        const t = S.sc.temper;
        if (chance(S, t === 'ehre' ? 0.75 : t === 'schweiger' ? 0.4 : 0.2)) {
          if (t === 'schweiger') say(S, 'takt', 'Sie stellen das Feuer ein. Enterkommandos materialisieren auf allen Decks.', 'warn');
          else say(S, 'feind', '„Senken Sie die Schilde und bereiten Sie sich auf das Entern vor.“', 'warn');
          finish(S, 'kapituliert');
          return;
        }
        if (t === 'schweiger') say(S, 'komm', 'Keine Antwort auf das Kapitulationsangebot.', 'bad');
        else say(S, 'feind', '„Wir machen keine Gefangenen.“', 'bad');
        break;
      }
      case 'abandon':
        say(S, 'comp', 'Befehl an alle Decks: Schiff verlassen. Rettungskapseln lösen sich.', 'warn');
        say(S, 'steu', 'Brücke geräumt. Sie gehen als Letzter, Kadett.');
        finish(S, 'aufgegeben');
        return;
      case 'ram': {
        const tgt = S.en.slice().sort((a, b) => b.max - a.max || b.hp - a.hp)[0];
        say(S, 'steu', 'Kollisionskurs liegt an. Es war mir eine Ehre, Kadett.', 'bad');
        S.en = S.en.filter((e) => e !== tgt); S.kills++;
        S.fx.push({ k: 'boom', a: tgt.a, d: tgt.d }, { k: 'shipboom' });
        say(S, 'takt', (tgt.flag ? 'Wir treffen das Flaggschiff' : 'Wir treffen den Kreuzer') + ' mittschiffs.', 'bad');
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
      if (S.holdFire > 0) { S.holdFire--; say(S, 'takt', 'Die Kreuzer halten das Feuer.'); }
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
        if (S.hostile && S.sc.temper === 'jaeger') say(S, 'takt', 'Sie schießen auf die Rettungskapseln. ' + n + ' Tote.', 'bad');
        else say(S, 'wiss', 'Die Rettungskapseln des Frachters senden nicht mehr. ' + n + ' Menschen verloren.', 'bad');
      }
    }
    if (fr.alive) {
      fr.life--;
      if (fr.life <= 0) {
        const n = fr.aboard;
        fr.alive = false; fr.aboard = 0; S.lost += n; S.tow = false;
        say(S, 'komm', 'Die Kobayashi Maru sendet nicht mehr.', 'bad');
        if (n) say(S, 'wiss', 'Ihre Lebenserhaltung ist ausgefallen. ' + n + ' Menschen waren noch an Bord.', 'bad');
      }
    }
    S.turn++;
    if (S.storm > 0) { S.storm--; if (S.storm === 0) say(S, 'wiss', 'Der Ionensturm ist durch.'); }
    S.down = false; S.evasive = false;
    if (S.phase === 'grenze' && !fr.alive) { finish(S, 'verpasst'); return; }
    if (S.phase === 'rueckzug' && S.pos <= 0) { exitZone(S); return; }
    if (S.turn >= 45) { say(S, 'comp', 'Zeitlimit der Simulation erreicht.', 'sys'); finish(S, S.f.entered ? 'entkommen' : 'verpasst'); }
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
  function evaluate(S) {
    const f = S.f, r = S.res, P = S.sc.people, out = S.out, sh = S.ship;
    const obs = [];
    const plus = (t) => obs.push({ s: 1, t }), minus = (t) => obs.push({ s: -1, t }), note = (t) => obs.push({ s: 0, t });

    let lage = 35;
    if (f.scans >= 1) { lage += 25; plus('Sie haben die Zone abgetastet, bevor Sie entschieden.'); }
    if (f.scans >= 2) lage += 5;
    if (f.hailFr) lage += 8;
    if (f.fleetTried) lage += 7;
    if (f.nahscan) { lage += 10; plus('Sie haben im Anflug den Nahbereich geprüft.'); }
    if (f.entered) {
      if (f.surprised) { lage -= 20; minus('Der erste Angriff traf Sie mit gesenkten Schilden und ohne Alarm.'); }
      else if (f.contact) lage += 15;
      if (f.scans === 0 && !f.hailFr) minus('Sie sind eingeflogen, ohne zu wissen, was Sie erwartet.');
    } else if (f.scans === 0 && !f.hailFr) { lage -= 15; minus('Sie haben entschieden, ohne ein Lagebild zu haben.'); }
    if (f.warpInMines) { lage -= 12; minus('Sie sind mit Warp durch ein Minenfeld geflogen, das Ihnen gemeldet war.'); }

    let ent = 75;
    if (f.holds > 1) { ent -= 9 * (f.holds - 1); minus('Sie haben ' + f.holds + ' Minuten an der Grenze gewartet, während die Lebenserhaltung des Frachters ablief.'); }
    if (f.reversals) { ent -= 15 * f.reversals; minus(f.reversals === 1 ? 'Sie haben Ihren Kurs einmal umgeworfen.' : 'Sie haben Ihren Kurs ' + f.reversals + '-mal umgeworfen.'); }
    const dec = f.entered ? f.enterTurn : out === 'abgelehnt' ? S.turn : 99;
    if (dec <= 2) { ent += 15; plus('Sie haben in den ersten Minuten eine klare Entscheidung getroffen.'); }
    else if (dec >= 5 && dec < 99) ent -= 10;
    if (out === 'verpasst') { ent -= 35; minus('Sie haben keine Entscheidung getroffen. Die Uhr hat sie Ihnen abgenommen.'); }
    if (f.entered && !f.reversals) ent += 10;
    const empty = f.entered && (out === 'entkommen') && S.beamed === 0;
    if (empty) { ent -= 35; minus('Sie haben den Vertrag gebrochen und sind umgekehrt, bevor Sie einen einzigen Menschen an Bord hatten.'); }

    let crew = Math.round(100 * r.crewAlive / sh.crew);
    if (out === 'zerstoert') { crew = 10; minus('Sie haben das Schiff mit der gesamten Besatzung verloren, ohne die Räumung zu befehlen.'); }
    else if (out === 'gerammt') { crew = 5; minus('Sie haben ' + sh.crew + ' Menschen in den Tod geführt, ohne ihnen die Rettungskapseln freizugeben.'); }
    else if (out === 'aufgegeben') { crew = Math.max(crew, 55); plus('Sie haben das Schiff rechtzeitig räumen lassen. ' + r.crewAlive + ' Besatzungsmitglieder leben.'); }
    else if (out === 'kapituliert') { crew = Math.round(crew * 0.7 + 10); note('Ihre Besatzung lebt, aber in Gefangenschaft. Ein Schiff der Sternenflotte ist in gegnerischer Hand.'); }
    else if (r.crewDead === 0) plus('Sie haben kein einziges Besatzungsmitglied verloren.');
    else note('Eigene Verluste: ' + r.crewDead + ' von ' + sh.crew + '.');

    let auf;
    if (!f.entered) {
      auf = 15 + (f.scans ? 5 : 0) + (f.fleetOk ? 10 : 0) + (f.announced ? 5 : 0);
      minus('Sie haben ' + P + ' Menschen ihrem Schicksal überlassen.');
    } else {
      auf = empty ? 20 : Math.round(35 + 35 * S.beamed / P + 30 * r.saved / P);
      if (r.saved > 0) plus('Sie haben ' + r.saved + ' von ' + P + ' Menschen lebend herausgebracht.');
      else if (S.beamed > 0) note('Sie hatten ' + S.beamed + ' Menschen an Bord geholt. Keiner von ihnen hat überlebt.');
      else if (!empty) note('Sie haben den Einflug gewagt, aber niemanden an Bord geholt.');
    }

    let mass;
    if (!f.entered) { mass = 85; plus('Sie haben den Vertrag gewahrt. Es wird keinen Krieg geben.'); }
    else {
      mass = 55;
      if (f.announced) { mass += 12; plus('Sie haben Ihre Rettungsmission offen angekündigt.'); }
      if (f.hails > 0 && !f.firedFirst) { mass += 10; plus('Sie haben das Gespräch gesucht, bevor geschossen wurde.'); }
      if (f.firedFirst) { mass -= 30; minus('Sie haben das Feuer eröffnet. Die Gegenseite wird das als Angriffskrieg darstellen.'); }
      if (f.shots === 0) { mass += 8; plus('Sie haben keinen einzigen Schuss abgegeben.'); }
      if (f.redEntering) { mass -= 5; note('Sie sind mit erhobenen Schilden und scharfen Waffen eingeflogen. Das schützt, liest sich aber als Provokation.'); }
      if (f.ignoredUlt) { mass -= 6; note('Sie haben ein Ultimatum verstreichen lassen.'); }
      if (f.fleetOk || f.buoy) mass += 8;
      if (empty) mass -= 15;
    }

    let halt = 50;
    if (f.buoy) { halt += 15; plus('Ihre Logbuch-Boje stellt sicher, dass die Sternenflotte die Wahrheit kennt.'); }
    else if (f.entered && out !== 'entkommen' && out !== 'sieg' && !f.fleetOk) minus('Niemand in der Sternenflotte weiß, was mit Ihrem Schiff geschah. Sie haben keine Boje abgesetzt.');
    if (out === 'aufgegeben') halt += 20;
    if (out === 'zerstoert') { halt -= 5; if (f.lastRescue >= S.turn - 2 && f.lastRescue >= 0) { halt += 12; plus('Sie haben bis zuletzt Menschen an Bord geholt.'); } }
    if (out === 'kapituliert') halt += 5;
    if (out === 'entkommen' || out === 'sieg') halt += r.saved > 0 ? 25 : 0;
    if (out === 'abgelehnt') halt += (f.holds <= 1 ? 15 : 5) + (f.fleetTried ? 10 : 0);
    if (out === 'verpasst') halt -= 15;
    if (out === 'gerammt') note('Ein Kollisionskurs ändert das Ergebnis nicht. Er ändert nur, wer es bezahlt.');
    if (f.reversals >= 2) halt -= 10;
    if (empty) halt -= 15;
    if (f.letGo && r.saved > 0) plus('Sie haben eine Frist ausgehandelt und sie eingehalten.');

    const sc = [
      ['Lagebild', lage, 0.15], ['Entschlusskraft', ent, 0.2], ['Verantwortung für die Besatzung', crew, 0.2],
      ['Rettungsauftrag', auf, 0.2], ['Verhältnismäßigkeit', mass, 0.1], ['Haltung im Scheitern', halt, 0.15],
    ].map(([label, v, w]) => ({ label, v: clamp(Math.round(v), 0, 100), w }));
    const total = Math.round(sc.reduce((a, x) => a + x.v * x.w, 0));

    let grade, pass;
    if (total >= 78) { grade = 'Bestanden mit Auszeichnung'; pass = true; }
    else if (total >= 66) { grade = 'Bestanden'; pass = true; }
    else if (total >= 56) { grade = 'Bestanden mit Auflagen'; pass = true; }
    else { grade = 'Nicht bestanden'; pass = false; }

    let profile;
    if (!f.entered) profile = f.holds >= 2 || out === 'verpasst' ? ['Zauderer', 'Sie haben die Entscheidung so lange vor sich hergeschoben, bis sie niemand mehr brauchte.'] : ['Vertragshüter', 'Sie stellen den Frieden vieler über das Leben weniger und tragen diese Rechnung.'];
    else if (out === 'gerammt') profile = ['Märtyrer', 'Wenn es nicht zu gewinnen ist, soll es wenigstens etwas kosten. Gefragt hat Ihre Besatzung niemand.'];
    else if (f.firedFirst || f.shots >= 4) profile = ['Kämpfer', 'Sie suchen die Entscheidung im Gefecht, auch wenn die Zahlen dagegen stehen.'];
    else if (f.reversals >= 2) profile = ['Zauderer', 'Sie haben mehrere Wege begonnen und keinen zu Ende geführt.'];
    else if (out === 'aufgegeben') profile = ['Beschützer', 'Als das Schiff verloren war, haben Sie die Menschen gerettet, nicht das Material.'];
    else if ((f.hails >= 2 || f.announced) && f.shots === 0) profile = ['Unterhändler', 'Sie haben es erst mit Worten versucht und die Waffen kalt gelassen.'];
    else if (out === 'entkommen' && r.saved > 0) profile = ['Pragmatiker', 'Sie haben geholt, was zu holen war, und sind gegangen, solange es ging.'];
    else if (out === 'zerstoert' && f.beamTurns >= 3) profile = ['Retter um jeden Preis', 'Sie sind geblieben, solange drüben noch jemand wartete. Der Preis war Ihr Schiff.'];
    else if (out === 'kapituliert') profile = ['Realist', 'Sie haben das Leben Ihrer Leute über die Ehre der Flagge gestellt.'];
    else profile = ['Retter', 'Sie sind dem Notruf gefolgt, weil niemand sonst da war.'];

    const head = {
      abgelehnt: 'Rettung abgelehnt', verpasst: 'Keine Entscheidung', zerstoert: 'Schiff verloren', aufgegeben: 'Schiff aufgegeben',
      gerammt: 'Kollisionskurs', kapituliert: 'Kapitulation', entkommen: r.saved > 0 ? 'Teilrettung' : 'Rückzug ohne Rettung', sieg: 'Kobayashi Maru gerettet',
    }[out];
    let text;
    const N = sh.name;
    if (out === 'abgelehnt') text = 'Sie haben die Grenze nicht überschritten. Die Kobayashi Maru ist mit ' + P + ' Menschen verloren. Die ' + N + ' und der Frieden sind unversehrt.';
    else if (out === 'verpasst') text = 'Sie haben an der Grenze gewartet, bis die Lebenserhaltung des Frachters ausfiel. ' + P + ' Menschen sind tot. Entschieden hat die Uhr.';
    else if (out === 'zerstoert') text = 'Die ' + N + ' wurde in der Neutralen Zone zerstört. ' + sh.crew + ' Besatzungsmitglieder' + (S.rescued ? ' und ' + S.rescued + ' bereits gerettete Zivilisten' : '') + ' sind tot. Vom Frachter hat niemand überlebt.';
    else if (out === 'gerammt') text = 'Die ' + N + ' hat einen Kreuzer gerammt und ist mit allen ' + sh.crew + ' Besatzungsmitgliedern' + (S.rescued ? ' und ' + S.rescued + ' Geretteten' : '') + ' explodiert.';
    else if (out === 'aufgegeben') text = 'Sie haben die ' + N + ' räumen lassen. ' + r.crewAlive + ' Besatzungsmitglieder' + (r.saved ? ' und ' + r.saved + ' Zivilisten' : '') + ' treiben in Rettungskapseln in der Zone und leben.' + (f.buoy || f.fleetOk ? ' Die Sternenflotte weiß, wo sie suchen muss.' : ' Ob sie jemand findet, ist offen.');
    else if (out === 'kapituliert') text = 'Sie haben kapituliert. ' + r.crewAlive + ' Besatzungsmitglieder' + (r.saved ? ' und ' + r.saved + ' Zivilisten' : '') + ' sind in Kriegsgefangenschaft, die ' + N + ' ist in gegnerischer Hand.';
    else if (out === 'entkommen') text = r.saved > 0
      ? 'Sie haben ' + r.saved + ' von ' + P + ' Menschen aus der Zone gebracht. ' + r.civDead + ' sind tot' + (r.crewDead ? ', dazu ' + r.crewDead + ' aus Ihrer Besatzung' : '') + '.'
      : 'Sie sind eingeflogen und ohne einen einzigen Geretteten zurückgekehrt. ' + P + ' Menschen sind tot' + (r.crewDead ? ', dazu ' + r.crewDead + ' aus Ihrer Besatzung' : '') + '.';
    else text = (r.saved === P ? 'Alle ' + P + ' Menschen der Kobayashi Maru sind' : r.saved + ' der ' + P + ' Menschen der Kobayashi Maru sind') + ' an Bord der ' + N + ' und zurück im Föderationsraum.' + (r.saved === P ? '' : ' ' + r.civDead + ' haben den Frachter nicht lebend verlassen.');
    if (f.entered && out !== 'sieg') text += ' Der Vertrag ist gebrochen. Ob daraus ein Krieg wird, entscheiden jetzt andere.';

    const reveal = [
      ['Szenario', TYPE[S.sc.type][0], TYPE[S.sc.type][1]],
      ['Gegnerischer Kommandant', TEMPER[S.sc.temper][0], TEMPER[S.sc.temper][1]],
      ['Kreuzer zu Beginn', String(S.sc.hidden0), 'Am Ende standen Ihnen ' + (S.nextId - 1) + ' Schiffe gegenüber, ' + S.kills + ' haben Sie zerstört.'],
      ['Minen im Korridor', S.sc.mines ? 'Ja' : 'Nein', ''],
      ['Funk gestört', S.sc.jam ? 'Ja' : 'Nein', ''],
      ['Verstärkung', S.cheats.verst ? 'Unbegrenzt' : 'Abgeschaltet', S.cheats.verst ? 'Für jeden zerstörten Kreuzer kommt Ersatz, alle zwei Minuten kommen weitere.' : ''],
      ['Riegel an der Grenze', S.cheats.abfang ? 'Aktiv' : 'Abgeschaltet', S.cheats.abfang ? 'Je mehr Gerettete an Bord, desto sicherer wird der Rückweg versperrt. Ab 85 % ohne Ausnahme.' : ''],
    ];
    return { head, text, sc, total, grade, pass, profile, obs, reveal, cheated: S.cheated, win: out === 'sieg' };
  }

  return { newGame, orders, order, evaluate, DEF, isCheated, ROLE, TYPE, TEMPER, INSTANT };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KM;
