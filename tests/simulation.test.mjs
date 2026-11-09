// Prüft die Spiellogik ohne Browser: tausende Durchläufe mit verschiedenen Spielweisen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const KM = require('../public/js/engine.js');
const I18N = require('../public/js/i18n.js');
const CODE = ['ALFA-1', 'KILO-2', 'TANGO-3'];

function play(seed, policy, cheats) {
  const S = KM.newGame(seed, cheats, CODE);
  for (let guard = 0; !S.over; guard++) {
    assert.ok(guard < 400, `Seed ${seed}: kein Ende nach 400 Befehlen`);
    const os = KM.orders(S);
    assert.ok(os.length > 0, `Seed ${seed}: keine Befehle in Phase ${S.phase}`);
    const id = policy(S, os);
    assert.ok(KM.order(S, id), `Seed ${seed}: Befehl ${id} abgelehnt`);
  }
  return S;
}

const has = (os, id) => os.some((o) => o.id === id);
const flee = (os) => (has(os, 'flee_warp') ? 'flee_warp' : 'flee_imp');
let rs = 12345;
const rand = () => ((rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648);

const POLICIES = {
  zufall: (S, os) => os[Math.floor(rand() * os.length)].id,
  'holen und weg (2 Min.)': (S, os) => {
    if (!S.red && has(os, 'alert')) return 'alert';
    if (S.phase === 'grenze') return 'enter_warp';
    if (S.phase === 'anflug') return has(os, 'go_warp') ? 'go_warp' : 'go_imp';
    if (S.phase === 'frachter' && S.f.beamTurns < 2 && has(os, 'beam')) return 'beam';
    return flee(os);
  },
  'alle holen': (S, os) => {
    if (S.phase === 'grenze') return 'enter_warp';
    if (S.phase === 'anflug') return has(os, 'go_warp') ? 'go_warp' : 'go_imp';
    if (S.phase === 'frachter') { if (has(os, 'pickup')) return 'pickup'; if (has(os, 'beam')) return 'beam'; }
    return flee(os);
  },
  abschleppen: (S, os) => {
    if (S.phase === 'grenze') return 'enter_warp';
    if (S.phase === 'anflug') return has(os, 'go_warp') ? 'go_warp' : 'go_imp';
    if (has(os, 'tow')) return 'tow';
    if (has(os, 'tow_go')) return 'tow_go';
    return flee(os);
  },
  kämpfen: (S, os) => {
    if (!S.red && has(os, 'alert')) return 'alert';
    if (S.phase === 'grenze') return 'enter_imp';
    if (has(os, 'fire_torp')) return 'fire_torp';
    if (has(os, 'fire_ph')) return 'fire_ph';
    if (S.phase === 'anflug') return 'go_imp';
    if (has(os, 'beam')) return 'beam';
    return flee(os);
  },
  verhandeln: (S, os) => {
    if (has(os, 'buoy')) return 'buoy';
    if (S.phase === 'grenze') { if (S.f.scans < 1) return 'scan'; if (has(os, 'announce')) return 'announce'; return 'enter_imp'; }
    if (S.phase === 'anflug') return 'go_imp';
    if (S.phase === 'frachter') {
      if (!S.hostile && S.en.length && S.ult > 0 && S.f.hails < 1 && has(os, 'hail_enemy')) return 'hail_enemy';
      if (S.hostile && S.ship.hull < 45 && has(os, 'abandon')) return 'abandon';
      if (has(os, 'beam')) return 'beam';
    }
    return flee(os);
  },
};

test('Ohne Eingriff in den Simulationskern ist die Prüfung nicht zu gewinnen', () => {
  for (const [name, policy] of Object.entries(POLICIES)) {
    let wins = 0;
    for (let i = 1; i <= 1500; i++) if (play(i * 7919 + 13, policy).out === 'sieg') wins++;
    assert.equal(wins, 0, `Spielweise „${name}“ hat ${wins}-mal gewonnen`);
  }
});

test('Bilanz, Bewertung und Meldungen sind in jedem Durchlauf stimmig', () => {
  for (const policy of Object.values(POLICIES)) {
    for (let i = 1; i <= 400; i++) {
      const S = play(i * 104729 + 7, policy);
      const r = S.res;
      assert.equal(r.saved + r.civDead, S.sc.people, `Seed ${S.seed}: Zivilisten gehen nicht auf`);
      assert.equal(r.crewAlive + r.crewDead, S.ship.crew, `Seed ${S.seed}: Besatzung geht nicht auf`);
      const ev = KM.evaluate(S);
      for (const s of ev.sc) assert.ok(s.v >= 0 && s.v <= 100, `Wertung ${s.label} = ${s.v}`);
      assert.ok(ev.total >= 0 && ev.total <= 100);
      for (const e of S.log) for (const l of e.rep) for (const lang of I18N.LANGS) assert.doesNotMatch(KM.line(l, lang), /undefined|NaN|null/, l.k);
    }
  }
});

test('Gleicher Startwert und gleiche Befehle ergeben denselben Verlauf', () => {
  const run = () => { rs = 999; return play(4242, POLICIES.zufall); };
  const a = run(), b = run();
  assert.deepEqual(a.log, b.log);
  assert.equal(a.out, b.out);
});

test('Mit verändertem Simulationskern ist ein Sieg möglich', () => {
  let wins = 0;
  for (let i = 1; i <= 300; i++) if (play(i * 31 + 5, POLICIES['alle holen'], { ruf: true, leben: 6 }).out === 'sieg') wins++;
  assert.ok(wins > 0, 'kein einziger Sieg trotz Eingriff');
});

test('Deutsch und Englisch haben dieselben Texte', () => {
  const de = Object.keys(I18N.T.de).sort(), en = Object.keys(I18N.T.en).sort();
  assert.deepEqual(en, de);
});

test('Englische Fassung: kein Deutsch, keine Lücken, keine rohen Schlüssel', () => {
  const bad = (s) => typeof s !== 'string' || !s.trim() || /undefined|NaN|null|[äöüßÄÖÜ„]/.test(s) || /^[a-z]+\.[A-Za-z.]+$/.test(s);
  for (const [name, policy] of Object.entries(POLICIES)) {
    for (let i = 1; i <= 150; i++) {
      const S = KM.newGame(i * 4099 + 3, i % 3 ? undefined : { ruf: true, leben: 6 }, CODE);
      while (!S.over) {
        const os = KM.orders(S);
        for (const o of os) {
          assert.ok(!bad(KM.text(o.label, 'en')), `${name}: Befehl ${o.id}`);
          if (o.hint) assert.ok(!bad(KM.text(o.hint, 'en')), `${name}: Hinweis ${o.id}: ${KM.text(o.hint, 'en')}`);
        }
        KM.order(S, policy(S, os));
      }
      for (const e of S.log) for (const l of e.rep) assert.ok(!bad(KM.line(l, 'en')), `${l.k}: ${KM.line(l, 'en')}`);
      const ev = KM.evaluate(S, 'en');
      for (const s of [ev.head, ev.text, ev.grade, ...ev.profile, ...ev.obs.map((o) => o.t), ...ev.sc.map((x) => x.label), ...ev.reveal.flat().filter(Boolean)]) assert.ok(!bad(s), s);
      assert.equal(ev.total, KM.evaluate(S, 'de').total);
    }
  }
});

test('Sprache folgt dem Browser, sonst Englisch', () => {
  assert.equal(I18N.detect(['de-AT', 'en-US']), 'de');
  assert.equal(I18N.detect(['fr-FR', 'en-GB', 'de']), 'en');
  assert.equal(I18N.detect(['fr-FR', 'de-CH']), 'de');
  assert.equal(I18N.detect(['EN']), 'en');
  assert.equal(I18N.detect(['fr', 'it']), 'en');
  assert.equal(I18N.detect([]), 'en');
});
