/* Hintergrundmusik: wird im Browser erzeugt (Web Audio), eigene Komposition aus Akkordfolgen,
   Mustern und Zufall. Jede Stimmung hat Tempo, Akkordfolge und Ebenen; Wechsel auf den nächsten Schlag. */
const MusicEngine = (ctx, dest) => {
  'use strict';
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = Math.random;

  /* Akkorde: Basston, Flächenstimmen, Töne für Arpeggio und Melodie (MIDI-Nummern) */
  const C = {
    Dm9: { b: 38, p: [50, 57, 64, 65], a: [62, 64, 65, 69, 72, 74] },
    Dm: { b: 38, p: [50, 57, 62, 65], a: [62, 65, 69, 72, 74, 77] },
    DmC: { b: 36, p: [48, 57, 62, 65], a: [60, 62, 65, 69, 72, 74] },
    Bb: { b: 34, p: [46, 53, 57, 62], a: [58, 62, 65, 69, 70, 74] },
    Gm: { b: 43, p: [50, 55, 58, 62], a: [55, 58, 62, 65, 67, 70] },
    Asus: { b: 45, p: [52, 57, 62, 64], a: [57, 62, 64, 69, 74, 76] },
    A: { b: 45, p: [52, 57, 61, 64], a: [57, 61, 64, 69, 73, 76] },
    Eb: { b: 39, p: [51, 55, 58, 63], a: [63, 67, 70, 75, 79, 82] },
    C: { b: 36, p: [48, 55, 60, 64], a: [60, 64, 67, 72, 76, 79] },
    Cs: { b: 37, p: [49, 52, 55, 58], a: [61, 64, 67, 70, 73, 76] },
    F: { b: 41, p: [53, 57, 60, 65], a: [65, 69, 72, 77, 81, 84] },
    D: { b: 38, p: [50, 54, 57, 62], a: [62, 66, 69, 74, 78, 81] },
    G: { b: 43, p: [50, 55, 59, 62], a: [62, 67, 71, 74, 79, 83] },
    Bm: { b: 47, p: [50, 54, 59, 62], a: [59, 62, 66, 71, 74, 78] },
  };
  /* 16 Schritte pro Takt: x = Schlag, X = betont, . = Pause */
  const P = (s) => s.split('').map((c) => (c === 'X' ? 2 : c === 'x' ? 1 : 0));
  const MOODS = {
    notruf: { bpm: 66, bars: 2, prog: ['Dm9', 'Bb', 'Gm', 'Asus'], cut: 900, drone: 38, vol: 0.9,
      g: { drone: 0.8, pad: 0.6, arp: 0.32, tick: 0.2 },
      arp: { s: P('x...x...x...x...'), prob: 0.5, mode: 'rand' }, tick: P('X...x...x...x...') },
    spannung: { bpm: 96, bars: 1, prog: ['Dm', 'DmC', 'Bb', 'A'], cut: 1100, drone: 38, vol: 1,
      g: { drone: 0.5, pad: 0.45, bass: 0.55, arp: 0.3, kick: 0.35, tick: 0.16 },
      bass: P('x.x.x.x.x.x.x.x.'), bassLen: 1.6,
      arp: { s: P('x.x.x.x.x.x.x.x.'), prob: 0.9, mode: 'up' }, kick: P('x.......x.......'), tick: P('x.x.x.x.x.x.x.x.') },
    drohung: { bpm: 104, bars: 1, prog: ['Dm', 'Eb', 'Dm', 'Eb'], cut: 800, drone: 38, vol: 0.9,
      g: { drone: 0.9, pad: 0.5, bass: 0.5, arp: 0.15, kick: 0.6, trem: 0.3 },
      bass: P('X.......X.......'), bassLen: 7,
      arp: { s: P('x...x...x...x...'), prob: 0.35, mode: 'rand' }, kick: P('x..x............'), heart: true, trem: true },
    gefecht: { bpm: 132, bars: 1, prog: ['Dm', 'Bb', 'C', 'A'], cut: 1500, drone: 38, vol: 0.85,
      g: { drone: 0.35, pad: 0.45, bass: 0.75, arp: 0.28, kick: 0.85, snare: 0.4, tick: 0.14 },
      bass: P('X.xxx.xxX.xxx.xx'), bassLen: 0.9, oct: true,
      arp: { s: P('xxxxxxxxxxxxxxxx'), prob: 1, mode: 'updown' }, kick: P('X..x..x.X.x.x...'), snare: P('....x.......x...'), tick: P('x.x.x.x.x.x.x.x.') },
    kritisch: { bpm: 144, bars: 1, prog: ['Dm', 'Eb', 'Dm', 'Cs'], cut: 1700, drone: 38, vol: 0.78,
      g: { drone: 0.5, pad: 0.5, bass: 0.85, arp: 0.28, kick: 0.95, snare: 0.5, tick: 0.18, trem: 0.45 },
      bass: P('XxxxXxxxXxxxXxxx'), bassLen: 0.9, oct: true,
      arp: { s: P('xxxxxxxxxxxxxxxx'), prob: 1, mode: 'up' }, kick: P('X.x.X.x.X.x.X.xx'), snare: P('....x.......x..x'), tick: P('xxxxxxxxxxxxxxxx'), trem: true },
    trauer: { bpm: 56, bars: 2, prog: ['Dm', 'Gm', 'Bb', 'A'], cut: 800, drone: 38, vol: 0.8,
      g: { drone: 0.5, pad: 0.6, arp: 0.12, mel: 0.55 },
      arp: { s: P('x...x...x...x...'), prob: 0.35, mode: 'rand' }, mel: true },
    verlust: { bpm: 50, bars: 2, prog: ['Dm', 'Bb', 'Gm', 'A'], cut: 650, drone: 38, vol: 0.8,
      g: { drone: 0.75, pad: 0.55, mel: 0.38, kick: 0.3 },
      kick: P('x...............'), heart: true, mel: true },
    erleichterung: { bpm: 72, bars: 2, prog: ['F', 'C', 'Dm', 'Bb'], cut: 1200, drone: 41, vol: 1.1,
      g: { drone: 0.25, pad: 0.6, arp: 0.28, mel: 0.45 },
      arp: { s: P('x.x.x.x.x.x.x.x.'), prob: 0.8, mode: 'up' }, mel: true },
    triumph: { bpm: 92, bars: 1, prog: ['D', 'G', 'Bm', 'A'], cut: 1800, drone: 38, vol: 0.95,
      g: { drone: 0.3, pad: 0.6, bass: 0.45, arp: 0.38, kick: 0.35, snare: 0.2, mel: 0.5 },
      bass: P('x.......x.......'), bassLen: 6,
      arp: { s: P('x.x.x.x.x.x.x.x.'), prob: 1, mode: 'up' }, kick: P('x.......x.......'), snare: P('....x.......x...'), mel: true },
  };

  /* ── Signalweg: Ebenen → Bus → Kompressor → Lautstärke ── */
  const out = ctx.createGain(); out.gain.value = 0; out.connect(dest);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
  comp.connect(out);
  const bus = ctx.createGain(); bus.gain.value = 0.4; bus.connect(comp);

  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return buf;
  }
  const rev = ctx.createConvolver(); rev.buffer = impulse(2.8);
  const revOut = ctx.createGain(); revOut.gain.value = 0.3; rev.connect(revOut); revOut.connect(bus);
  const dly = ctx.createDelay(2), fb = ctx.createGain(), dOut = ctx.createGain();
  fb.gain.value = 0.3; dOut.gain.value = 0.2;
  dly.connect(fb); fb.connect(dly); dly.connect(dOut); dOut.connect(bus);

  const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return b; })();

  const LAYERS = ['drone', 'pad', 'bass', 'arp', 'kick', 'snare', 'tick', 'trem', 'mel'];
  const L = {};
  for (const k of LAYERS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(bus); L[k] = g; }
  for (const [k, amt] of [['pad', 0.5], ['mel', 0.7], ['trem', 0.6], ['arp', 0.35], ['kick', 0.15]]) { const s = ctx.createGain(); s.gain.value = amt; L[k].connect(s); s.connect(rev); }
  L.arp.connect(dly);

  /* Liegender Grundton mit langsam atmendem Filter */
  const dF = ctx.createBiquadFilter(); dF.type = 'lowpass'; dF.frequency.value = 320; dF.Q.value = 0.8; dF.connect(L.drone);
  const d1 = ctx.createOscillator(), d2 = ctx.createOscillator(), d1g = ctx.createGain(), d2g = ctx.createGain();
  d1.type = 'triangle'; d2.type = 'sawtooth'; d1g.gain.value = 0.16; d2g.gain.value = 0.035;
  d1.frequency.value = mtof(38); d2.frequency.value = mtof(50); d2.detune.value = 5;
  d1.connect(d1g); d2.connect(d2g); d1g.connect(dF); d2g.connect(dF);
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(dF.frequency);
  d1.start(); d2.start(); lfo.start();

  /* ── Instrumente ── */
  function osc(type, f, t, end) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end); return o; }
  let padNow = [];
  function pad(ch, t, dur, cut) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(cut * 0.55, t); f.frequency.linearRampToValueAtTime(cut, t + Math.min(dur, 4) * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + Math.min(1.2, dur * 0.5));
    g.gain.setValueAtTime(1, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
    f.connect(g); g.connect(L.pad);
    for (const m of ch.p) for (const det of [-8, 7]) {
      const o = osc('sawtooth', mtof(m), t, t + dur + 1.7); o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.032; o.connect(og); og.connect(f);
    }
    padNow.push({ g, end: t + dur + 1.7 });
  }
  function trem(ch, t, dur) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.6); e.gain.setValueAtTime(1, t + dur); e.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    f.connect(am); am.connect(e); e.connect(L.trem);
    const l = osc('square', 11, t, t + dur + 0.9), lg = ctx.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain);
    for (const m of ch.p.slice(-2)) { const o = osc('sawtooth', mtof(m + 12), t, t + dur + 0.9), og = ctx.createGain(); og.gain.value = 0.02; o.connect(og); og.connect(f); }
    padNow.push({ g: e, end: t + dur + 0.9 });
  }
  function bass(m, t, len, acc, cut) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(cut * (acc ? 0.5 : 0.35), t); f.frequency.exponentialRampToValueAtTime(90, t + Math.min(len, 1.2));
    const g = ctx.createGain(), v = acc ? 0.26 : 0.18;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    f.connect(g); g.connect(L.bass);
    const o = osc('sawtooth', mtof(m), t, t + len + 0.05); o.connect(f);
    const s = osc('sine', mtof(m - 12), t, t + len + 0.05), sg = ctx.createGain(); sg.gain.value = 0.7; s.connect(sg); sg.connect(g);
  }
  function arp(m, t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.085, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    g.connect(L.arp);
    const o = osc('triangle', mtof(m), t, t + 0.42); o.connect(g);
  }
  function kick(t, amp, heart) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9 * amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + (heart ? 0.35 : 0.55));
    g.connect(L.kick);
    const o = osc('sine', heart ? 95 : 150, t, t + 0.6); o.frequency.exponentialRampToValueAtTime(heart ? 38 : 44, t + 0.25); o.connect(g);
    const n = ctx.createBufferSource(); n.buffer = noise;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = heart ? 300 : 900;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.3 * amp, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(nf); nf.connect(ng); ng.connect(L.kick); n.start(t); n.stop(t + 0.12);
  }
  function snare(t, amp) {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.9;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(L.snare); n.start(t, rnd() * 0.5); n.stop(t + 0.2);
    const o = osc('triangle', 190, t, t + 0.1), og = ctx.createGain(); og.gain.setValueAtTime(0.25 * amp, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(og); og.connect(L.snare);
  }
  function tick(t, amp) {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35 * amp, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    n.connect(f); f.connect(g); g.connect(L.tick); n.start(t, rnd() * 0.5); n.stop(t + 0.05);
  }
  function mel(m, t, len) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.12);
    g.gain.setValueAtTime(0.09, t + Math.max(0.13, len - 0.1)); g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.7);
    g.connect(L.mel);
    const o = osc('sine', mtof(m), t, t + len + 0.75), o2 = osc('triangle', mtof(m), t, t + len + 0.75);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g); o.connect(g);
    const v = osc('sine', 5.2, t, t + len + 0.75), vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(mtof(m) * 0.006, t + 0.5);
    v.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
  }

  /* ── Ablauf ── */
  let cur = null, pending = null, s = 0, bar = 0, ci = -1, nextT = 0, arpI = 0, arpDir = 1, melI = 2, level = 0;
  const stepLen = () => 60 / MOODS[cur].bpm / 4;
  function apply(t) {
    cur = pending; pending = null;
    const M = MOODS[cur];
    s = 0; bar = 0; ci = -1; arpI = 0; arpDir = 1;
    for (const k of LAYERS) { L[k].gain.cancelScheduledValues(t); L[k].gain.setTargetAtTime((M.g[k] || 0), t, 0.5); }
    for (const p of padNow) if (p.end > t) { p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(0, t, 0.35); }
    padNow = [];
    d1.frequency.setTargetAtTime(mtof(M.drone), t, 0.6); d2.frequency.setTargetAtTime(mtof(M.drone + 12), t, 0.6);
    dly.delayTime.setTargetAtTime(3 * 60 / M.bpm / 4, t, 0.1);
    out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(level * M.vol, t, 0.5);
  }
  function pickArp(ch, mode) {
    const a = ch.a;
    if (mode === 'rand') return a[Math.floor(rnd() * a.length)];
    if (mode === 'up') { const m = a[arpI % a.length]; arpI++; return m; }
    arpI += arpDir; if (arpI >= a.length - 1 || arpI <= 0) arpDir = -arpDir; return a[Math.max(0, Math.min(a.length - 1, arpI))];
  }
  const MEL = [[[0, 8], [8, 8]], [[0, 12], [12, 4]], [[0, 6], [6, 2], [8, 8]], [[0, 16]], [[4, 12]]];
  function step(t) {
    const M = MOODS[cur], sl = stepLen();
    if (s === 0) {
      if (bar % M.bars === 0) {
        ci = (ci + 1) % M.prog.length;
        const ch = C[M.prog[ci]], dur = M.bars * 16 * sl;
        pad(ch, t, dur, M.cut);
        if (M.trem) trem(ch, t, dur);
      }
      if (M.mel) {
        const ch = C[M.prog[ci]], tpl = MEL[Math.floor(rnd() * MEL.length)];
        for (const [st, ln] of tpl) {
          melI = Math.max(0, Math.min(ch.a.length - 1, melI + Math.floor(rnd() * 3) - 1));
          mel(ch.a[melI], t + st * sl, ln * sl * 0.95);
        }
      }
      bar++;
    }
    const ch = C[M.prog[ci]];
    if (M.bass && M.bass[s]) bass(ch.b + (M.oct && M.bass[s] === 2 && rnd() < 0.5 ? 12 : 0), t, sl * M.bassLen, M.bass[s] === 2, M.cut * 2);
    if (M.arp && M.arp.s[s] && rnd() < M.arp.prob) arp(pickArp(ch, M.arp.mode), t);
    if (M.kick && M.kick[s]) kick(t, M.kick[s] === 2 ? 1 : 0.7, M.heart);
    if (M.snare && M.snare[s]) snare(t, 0.8);
    if (M.tick && M.tick[s]) tick(t, M.tick[s] === 2 ? 1 : 0.6);
  }
  function scheduleUntil(tEnd) {
    if (!cur && !pending) return;
    if (nextT < ctx.currentTime) { nextT = ctx.currentTime + 0.05; if (cur) s = 0; }
    if (!cur) apply(nextT);
    while (nextT < tEnd) {
      if (pending && s % 4 === 0) apply(nextT);
      step(nextT);
      nextT += stepLen();
      s = (s + 1) % 16;
    }
  }
  return {
    MOODS,
    setMood(m) { if (!MOODS[m] || m === (pending || cur)) return; pending = m; },
    get mood() { return pending || cur; },
    resync() { nextT = ctx.currentTime + 0.08; s = 0; },
    scheduleUntil,
    fade(v, tc) { level = v; const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(v * (cur ? MOODS[cur].vol : 1), t, tc || 0.4); },
  };
};
