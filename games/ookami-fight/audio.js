/* audio.js - self-contained WebAudio SFX + BGM synth. No external files.
   API: SND.init() / play(name,opts) / music(name|null) / setMute(b) / muted / setVolume(sfx,music) */
(function () {
'use strict';
var G = (typeof window !== 'undefined' ? window : globalThis);
var AC = G.AudioContext || G.webkitAudioContext;
var ctx = null, master, comp, sfxBus, musBus, sfxRev, musRev, noiseBuf;
var sfxVol = 1, musVol = 0.3, muted = false;
var voices = [], MAXV = 24;
var want = null, sess = null;
var DEBUG = !!G.__SND_DEBUG;

function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function dc(n) { try { n.disconnect(); } catch (e) {} }

/* ---------- graph ---------- */
function mkReverb(dest, sec, wet) {
  var inp = ctx.createGain(), hp = ctx.createBiquadFilter(), cv = ctx.createConvolver(),
      lp = ctx.createBiquadFilter(), w = ctx.createGain();
  var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (var c = 0; c < 2; c++) {
    var d = b.getChannelData(c);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  cv.buffer = b;
  hp.type = 'highpass'; hp.frequency.value = 250;
  lp.type = 'lowpass'; lp.frequency.value = 5500;
  w.gain.value = wet;
  inp.connect(hp); hp.connect(cv); cv.connect(lp); lp.connect(w); w.connect(dest);
  return inp;
}

function init() {
  if (ctx) {
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    return true;
  }
  if (!AC) return false;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    var fin = ctx.createGain(); fin.gain.value = 0.9;
    master.connect(comp); comp.connect(fin); fin.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = musVol; musBus.connect(master);
    sfxRev = mkReverb(sfxBus, 2.4, 0.7);
    musRev = mkReverb(musBus, 2.8, 0.8);
    var n = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    if (want) startMusic(want);
    return true;
  } catch (e) { ctx = null; return false; }
}

/* ---------- SFX voice machinery ---------- */
function vend(v) {
  if (v.dead) return;
  v.dead = true;
  for (var i = 0; i < v.nodes.length; i++) dc(v.nodes[i]);
}
function kill(v) {
  if (v.dead) return;
  try { v.out.gain.cancelScheduledValues(ctx.currentTime); v.out.gain.setTargetAtTime(0, ctx.currentTime, 0.01); } catch (e) {}
  var t = ctx.currentTime + 0.05;
  for (var i = 0; i < v.srcs.length; i++) { try { v.srcs[i].stop(t); } catch (e) {} }
  setTimeout(function () { vend(v); }, 120);
}
function mkVoice(o) {
  o = o || {};
  var v = { t0: ctx.currentTime + 0.01, n: 0, dead: false, srcs: [], nodes: [],
            p: o.pitch > 0 ? o.pitch : 1 };
  v.out = ctx.createGain();
  v.out.gain.value = o.vol == null ? 1 : clamp(+o.vol || 0, 0, 1);
  v.nodes.push(v.out);
  v.last = v.out;
  if (ctx.createStereoPanner) {
    var pn = ctx.createStereoPanner();
    pn.pan.value = clamp(+o.pan || 0, -1, 1);
    v.out.connect(pn); v.last = pn; v.nodes.push(pn);
  }
  v.last.connect(sfxBus);
  return v;
}
function rev(v, lvl) {
  var g = ctx.createGain(); g.gain.value = lvl;
  v.last.connect(g); g.connect(sfxRev); v.nodes.push(g);
}
// attach filter+envelope+start/stop to a source
function wire(v, src, o, ex) {
  var t = v.t0 + (o.t || 0), d = o.d, att = o.a == null ? 0.003 : o.a, p = v.p, last = src;
  var nodes = ex || [];
  if (att > d * 0.9) att = d * 0.9;
  if (o.fl) {
    var f = ctx.createBiquadFilter();
    f.type = o.fl[0];
    f.frequency.setValueAtTime(o.fl[1] * p, t);
    if (o.fl[2]) f.frequency.exponentialRampToValueAtTime(o.fl[2] * p, t + d);
    f.Q.value = o.fl[3] || 1;
    last.connect(f); last = f; nodes.push(f);
  }
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.g == null ? 1 : o.g, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  last.connect(g); g.connect(v.out);
  nodes.push(g, src);
  if (src.buffer) src.start(t, Math.random() * 1.5); else src.start(t);
  src.stop(t + d + 0.05);
  v.n++; v.srcs.push(src);
  src.onended = function () {
    for (var i = 0; i < nodes.length; i++) dc(nodes[i]);
    if (--v.n <= 0) vend(v);
  };
}
function tone(v, o) {
  var t = v.t0 + (o.t || 0), p = v.p, os = ctx.createOscillator(), f = o.f, ex = [];
  os.type = o.type || 'sine';
  if (typeof f === 'number') os.frequency.setValueAtTime(f * p, t);
  else if (typeof f[0] === 'number') {
    os.frequency.setValueAtTime(f[0] * p, t);
    os.frequency.exponentialRampToValueAtTime(f[1] * p, t + (o.fd || o.d));
  } else {
    os.frequency.setValueAtTime(f[0][1] * p, t + f[0][0]);
    for (var i = 1; i < f.length; i++) os.frequency.exponentialRampToValueAtTime(f[i][1] * p, t + f[i][0]);
  }
  if (o.det) os.detune.value = o.det;
  if (o.vib) {
    var l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1] * p;
    l.connect(lg); lg.connect(os.frequency);
    l.start(t); l.stop(t + o.d + 0.05);
    ex.push(l, lg);
  }
  wire(v, os, o, ex);
}
function nz(v, o) {
  var s = ctx.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  wire(v, s, o, []);
}
var BR = [[0.5, 0.5, 1], [1, 1, 1], [1.19, 0.4, 0.8], [1.56, 0.35, 0.6], [2, 0.5, 0.7],
          [2.51, 0.25, 0.5], [3.0, 0.2, 0.4], [4.07, 0.15, 0.3]];
function bell(v, f, t, d, g) {
  for (var i = 0; i < BR.length; i++) {
    var r = BR[i];
    tone(v, { f: f * r[0], t: t, d: d * r[2], g: g * r[1], a: 0.002 });
  }
}

/* ---------- SFX definitions ---------- */
var S = {
  hitL: function (v) {
    nz(v, { d: 0.09, g: 0.7, a: 0.001, fl: ['bandpass', 3500, 1200, 1.2] });
    tone(v, { f: [260, 100], d: 0.11, g: 0.8 });
    tone(v, { type: 'triangle', f: [900, 300], d: 0.04, g: 0.3 });
  },
  hitM: function (v) {
    nz(v, { d: 0.15, g: 0.9, a: 0.001, fl: ['bandpass', 2800, 500, 1] });
    nz(v, { d: 0.05, g: 0.4, a: 0.001, fl: ['highpass', 4000] });
    tone(v, { f: [200, 60], d: 0.2, g: 1 });
    tone(v, { type: 'square', f: [400, 120], d: 0.08, g: 0.25, fl: ['lowpass', 2000] });
    rev(v, 0.06);
  },
  hitH: function (v) {
    nz(v, { d: 0.35, g: 1, a: 0.001, fl: ['lowpass', 6000, 300, 0.8] });
    nz(v, { d: 0.12, g: 0.7, a: 0.001, fl: ['bandpass', 1500, 400, 2] });
    nz(v, { t: 0.05, d: 0.1, g: 0.5, a: 0.001, fl: ['bandpass', 900, 500, 3] });
    tone(v, { f: [120, 32], d: 0.55, g: 1.4 });
    tone(v, { type: 'sawtooth', f: [180, 50], d: 0.3, g: 0.5, fl: ['lowpass', 1200, 200, 1] });
    rev(v, 0.12);
  },
  guard: function (v) {
    tone(v, { type: 'triangle', f: 1480, d: 0.07, g: 0.4 });
    tone(v, { f: 2310, d: 0.05, g: 0.25 });
    tone(v, { type: 'square', f: 3100, d: 0.03, g: 0.08 });
    nz(v, { d: 0.02, g: 0.3, a: 0.001, fl: ['highpass', 6000] });
    tone(v, { f: [140, 80], d: 0.07, g: 0.6 });
  },
  whiffL: function (v) {
    nz(v, { d: 0.14, a: 0.05, g: 0.35, fl: ['bandpass', 1200, 3200, 1.4] });
  },
  whiffM: function (v) {
    nz(v, { d: 0.2, a: 0.07, g: 0.5, fl: ['bandpass', 700, 2400, 1.2] });
  },
  whiffH: function (v) {
    nz(v, { d: 0.32, a: 0.12, g: 0.65, fl: ['bandpass', 400, 2000, 1] });
    tone(v, { f: [120, 70], d: 0.3, a: 0.1, g: 0.2 });
  },
  jump: function (v) {
    tone(v, { type: 'triangle', f: [240, 560], d: 0.16, g: 0.3 });
    nz(v, { d: 0.08, g: 0.15, fl: ['highpass', 3000] });
  },
  land: function (v) {
    nz(v, { d: 0.12, g: 0.6, a: 0.001, fl: ['lowpass', 900, 200, 0.8] });
    tone(v, { f: [110, 48], d: 0.15, g: 0.8 });
  },
  dash: function (v) {
    nz(v, { d: 0.22, a: 0.04, g: 0.5, fl: ['bandpass', 900, 3800, 1.2] });
    tone(v, { f: [300, 150], d: 0.15, g: 0.15 });
  },
  step: function (v) {
    nz(v, { d: 0.05, g: 0.4, a: 0.001, fl: ['lowpass', 700, 300, 0.8] });
    tone(v, { f: [130, 70], d: 0.06, g: 0.4 });
  },
  shield: function (v) {
    [600, 900, 1350, 1800, 2700].forEach(function (f, i) {
      tone(v, { f: [f, f * 1.6], d: 0.5, a: 0.2, g: 0.2 / (i * 0.5 + 1) });
    });
    nz(v, { d: 0.35, a: 0.2, g: 0.1, fl: ['highpass', 5000] });
    rev(v, 0.4);
  },
  shieldHit: function (v) {
    [1, 2.4, 3.9, 5.8].forEach(function (r, i) {
      tone(v, { f: 1568 * r, d: 0.9 / (1 + i * 0.5), g: 0.35 / (1 + i * 0.3), a: 0.001 });
    });
    nz(v, { d: 0.04, g: 0.4, a: 0.001, fl: ['highpass', 7000] });
    rev(v, 0.4);
  },
  circle: function (v) {
    tone(v, { type: 'sawtooth', f: [110, 330], d: 0.65, a: 0.4, g: 0.18, fl: ['bandpass', 300, 1800, 8] });
    [440, 660, 880, 1320, 1760].forEach(function (f, i) {
      tone(v, { f: [f, f * 1.25], d: 0.65, a: 0.3, g: 0.12 / (1 + i * 0.2), vib: [7, 6] });
    });
    nz(v, { d: 0.6, a: 0.4, g: 0.08, fl: ['bandpass', 2000, 6000, 3] });
    rev(v, 0.55);
  },
  blast: function (v) {
    tone(v, { f: [80, 30], d: 1.2, g: 1.2 });
    tone(v, { type: 'sawtooth', f: [60, 25], d: 0.9, g: 0.4, fl: ['lowpass', 300, 80, 1] });
    nz(v, { d: 1.2, a: 0.01, g: 0.8, fl: ['lowpass', 6000, 200, 0.8] });
    nz(v, { d: 0.9, a: 0.02, g: 0.35, fl: ['highpass', 6000, 1500, 1] });
    tone(v, { type: 'triangle', f: [1200, 200], d: 0.6, g: 0.15 });
    rev(v, 0.3);
  },
  maw: function (v) {
    tone(v, { type: 'sawtooth', f: [75, 50], d: 0.55, a: 0.08, g: 0.5, vib: [28, 12], fl: ['lowpass', 450, 250, 1] });
    tone(v, { type: 'square', f: [110, 70], d: 0.5, a: 0.1, g: 0.2, vib: [31, 15], fl: ['lowpass', 500, 300, 1] });
    nz(v, { d: 0.5, a: 0.1, g: 0.35, fl: ['bandpass', 300, 200, 2] });
    nz(v, { t: 0.46, d: 0.06, g: 1, a: 0.001, fl: ['highpass', 2000] });
    tone(v, { type: 'square', f: [320, 100], t: 0.46, d: 0.09, g: 0.4 });
    tone(v, { f: [90, 40], t: 0.46, d: 0.2, g: 0.8 });
    rev(v, 0.15);
  },
  teleport: function (v) {
    tone(v, { f: [1500, 120], d: 0.3, g: 0.3, vib: [18, 60] });
    tone(v, { f: [120, 1800], t: 0.28, d: 0.32, a: 0.05, g: 0.3, vib: [14, 50] });
    tone(v, { type: 'sawtooth', f: [800, 100], d: 0.3, g: 0.08, det: 15, fl: ['lowpass', 2000, 300, 1] });
    nz(v, { d: 0.3, g: 0.4, a: 0.02, fl: ['bandpass', 3500, 300, 2] });
    nz(v, { t: 0.28, d: 0.35, a: 0.1, g: 0.4, fl: ['bandpass', 250, 4500, 2] });
    rev(v, 0.2);
  },
  catDash: function (v) {
    nz(v, { d: 0.18, a: 0.03, g: 0.3, fl: ['bandpass', 2000, 5000, 1.2] });
    tone(v, { f: 2093, t: 0.02, d: 0.35, g: 0.1 });
    tone(v, { f: 3136, t: 0.04, d: 0.3, g: 0.07 });
    rev(v, 0.3);
  },
  superFlash: function (v) {
    nz(v, { d: 0.6, a: 0.55, g: 0.5, fl: ['bandpass', 200, 7000, 1.5] });
    tone(v, { type: 'sawtooth', f: [100, 400], d: 0.6, a: 0.55, g: 0.15, fl: ['lowpass', 300, 3000, 1] });
    tone(v, { f: [200, 1600], d: 0.6, a: 0.55, g: 0.15 });
    tone(v, { f: [100, 40], t: 0.55, d: 0.5, g: 1 });
    nz(v, { t: 0.55, d: 0.15, g: 0.6, a: 0.001, fl: ['bandpass', 3000, 800, 1] });
    [293.66, 349.23, 440, 587.33].forEach(function (f) {
      tone(v, { type: 'sawtooth', f: f, t: 0.55, d: 0.55, a: 0.03, g: 0.08, fl: ['bandpass', 900, 900, 3] });
      tone(v, { f: f * 2, t: 0.55, d: 0.5, a: 0.01, g: 0.1 });
      bell(v, f * 2, 0.55, 0.5, 0.05);
    });
    rev(v, 0.6);
  },
  ko: function (v) {
    tone(v, { f: [90, 25], d: 1.6, g: 1.4 });
    tone(v, { type: 'sawtooth', f: [55, 28], d: 1.0, g: 0.4, fl: ['lowpass', 300, 80, 1] });
    nz(v, { d: 1.4, a: 0.001, g: 1, fl: ['lowpass', 5000, 100, 0.8] });
    nz(v, { d: 1.2, a: 0.005, g: 0.5, fl: ['highpass', 4000, 1500, 1] });
    nz(v, { d: 0.12, a: 0.001, g: 0.8, fl: ['bandpass', 1500, 500, 2] });
    [1, 2.76, 5.4].forEach(function (r, i) {
      tone(v, { f: 220 * r, d: 1.6 / (1 + i * 0.4), g: 0.25 / (1 + i * 0.4), a: 0.002 });
    });
    rev(v, 0.5);
  },
  roundStart: function (v) {
    bell(v, 392, 0, 1.3, 0.5);
    nz(v, { d: 0.03, g: 0.2, a: 0.001, fl: ['bandpass', 3000, 2000, 2] });
    rev(v, 0.4);
  },
  select: function (v) {
    tone(v, { f: 760, d: 0.08, g: 0.4 });
    tone(v, { type: 'triangle', f: 1520, d: 0.05, g: 0.15 });
    nz(v, { d: 0.02, g: 0.3, a: 0.001, fl: ['bandpass', 2000, 1500, 3] });
  },
  confirm: function (v) {
    [660, 990].forEach(function (f, i) {
      tone(v, { f: f, t: i * 0.07, d: 0.25, g: 0.35 });
      tone(v, { type: 'triangle', f: f * 2, t: i * 0.07, d: 0.1, g: 0.1 });
    });
    rev(v, 0.2);
  },
  cancel: function (v) {
    [520, 390].forEach(function (f, i) {
      tone(v, { f: f, t: i * 0.06, d: 0.18, g: 0.35 });
      tone(v, { type: 'triangle', f: f * 2, t: i * 0.06, d: 0.07, g: 0.08 });
    });
    rev(v, 0.15);
  },
  gaugeMax: function (v) {
    [784, 988, 1175, 1568, 1976, 2349, 3136].forEach(function (f, i) {
      tone(v, { type: 'triangle', f: f, t: i * 0.055, d: 0.35, g: 0.25 });
      tone(v, { f: f * 2, t: i * 0.055, d: 0.25, g: 0.1 });
    });
    nz(v, { d: 0.5, a: 0.3, g: 0.06, fl: ['highpass', 6000] });
    rev(v, 0.4);
  },
  wolf: function (v) {
    var c = [[0, 300], [0.5, 520], [1.1, 480], [2.0, 300]];
    tone(v, { type: 'sawtooth', f: c, d: 2.0, a: 0.4, g: 0.3, vib: [5.5, 8], fl: ['bandpass', 700, 700, 5] });
    tone(v, { type: 'sawtooth', f: c, d: 2.0, a: 0.4, g: 0.2, vib: [5.5, 8], fl: ['bandpass', 1150, 1150, 5] });
    tone(v, { f: c, d: 2.0, a: 0.4, g: 0.3, vib: [5.5, 8] });
    nz(v, { d: 2.0, a: 0.5, g: 0.04, fl: ['bandpass', 1200, 1200, 2] });
    rev(v, 0.7);
  },
  bell: function (v) {
    bell(v, 130.8, 0, 3, 0.6);
    nz(v, { d: 0.05, g: 0.3, a: 0.001, fl: ['lowpass', 1500, 500, 1] });
    rev(v, 0.6);
  }
};

function play(name, opts) {
  if (!ctx) return;
  var fn = S[name];
  if (!fn) return;
  try {
    voices = voices.filter(function (v) { return !v.dead; });
    while (voices.length >= MAXV) kill(voices.shift());
    var v = mkVoice(opts);
    voices.push(v);
    fn(v);
    if (v.n === 0) vend(v);
  } catch (e) { if (DEBUG) throw e; }
}

/* ---------- music ---------- */
var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nm(s) {
  var m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function bar(str) {
  var out = [], st = 0;
  str.split(' ').forEach(function (tk) {
    var a = tk.split(':'), l = +a[1];
    if (a[0] !== '-') out.push([st, nm(a[0]), l]);
    st += l;
  });
  return out;
}
function bars(arr) { return arr.map(bar); }
function chord(root, q) { return { r: nm(root), i: q === 'm' ? [0, 3, 7] : [0, 4, 7] }; }

// music note: o = {type, m(midi) , t, d, g, a, rel, sus, lp:[f0,f1], det:[cents], rev}
function mn(s, o) {
  var t = o.t, d = o.d, f = hz(o.m), dets = o.det || [0], att = o.a == null ? 0.004 : o.a;
  var g = ctx.createGain(), last = g, nodes = [g], gv = o.g / Math.sqrt(dets.length);
  var rl = o.sus ? (o.rel || 0.08) : 0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gv, t + att);
  if (o.sus) { g.gain.setValueAtTime(gv, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + rl); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  var head = g;
  if (o.lp) {
    var fl = ctx.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp[0], t);
    if (o.lp[1]) fl.frequency.exponentialRampToValueAtTime(o.lp[1], t + d);
    fl.Q.value = 0.7;
    fl.connect(g); head = fl; nodes.push(fl);
  }
  g.connect(s.out);
  if (o.rev) { var rg = ctx.createGain(); rg.gain.value = o.rev; g.connect(rg); rg.connect(musRev); nodes.push(rg); }
  var end = t + d + rl + 0.03, first = null;
  for (var i = 0; i < dets.length; i++) {
    var os = ctx.createOscillator();
    os.type = o.type || 'sine'; os.frequency.value = f; os.detune.value = dets[i];
    os.connect(head); os.start(t); os.stop(end); nodes.push(os);
    if (!first) first = os;
  }
  first.onended = function () { for (var k = 0; k < nodes.length; k++) dc(nodes[k]); };
}
function mnz(s, o) { // noise hit: {t,d,g,type,f,q,f1}
  var b = ctx.createBufferSource(); b.buffer = noiseBuf; b.loop = true;
  var fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = o.type; fl.frequency.setValueAtTime(o.f, o.t);
  if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.d);
  fl.Q.value = o.q || 0.7;
  g.gain.setValueAtTime(o.g, o.t); g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.d);
  b.connect(fl); fl.connect(g); g.connect(s.out);
  b.start(o.t, Math.random() * 1.5); b.stop(o.t + o.d + 0.03);
  b.onended = function () { dc(b); dc(fl); dc(g); };
}
function kick(s, t, g) {
  var o = ctx.createOscillator(), e = ctx.createGain();
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  o.connect(e); e.connect(s.out); o.start(t); o.stop(t + 0.28);
  o.onended = function () { dc(o); dc(e); };
  mnz(s, { t: t, d: 0.015, g: g * 0.3, type: 'highpass', f: 3000 });
}
function snare(s, t, g) {
  mnz(s, { t: t, d: 0.17, g: g, type: 'bandpass', f: 2200, q: 0.8 });
  var o = ctx.createOscillator(), e = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
  e.gain.setValueAtTime(g * 0.6, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(e); e.connect(s.out); o.start(t); o.stop(t + 0.12);
  o.onended = function () { dc(o); dc(e); };
}
function hat(s, t, g, open) { mnz(s, { t: t, d: open ? 0.18 : 0.04, g: g, type: 'highpass', f: 7000 }); }

/* --- battle (D minor, 150 BPM, 32 bars) --- */
var Dm = chord('D2', 'm'), Bb = chord('Bb1', 'M'), A_ = chord('A1', 'M'), Gm = chord('G1', 'm');
var CA = [Dm, Dm, Bb, A_, Dm, Gm, Bb, A_], CB = [Gm, Bb, Dm, A_, Gm, Bb, A_, A_];
var LA = ['D5:3 F5:1 A5:4 G5:2 F5:2 E5:2 -:2', 'D5:3 F5:1 A5:4 C6:2 Bb5:2 A5:4',
          'Bb5:3 A5:1 G5:4 F5:2 G5:2 A5:4', 'A5:6 G5:2 F5:2 E5:2 C#5:2 E5:2',
          'D5:3 F5:1 A5:4 G5:2 F5:2 E5:2 -:2', 'G5:3 Bb5:1 D6:4 C6:2 Bb5:2 A5:4',
          'Bb5:4 A5:2 G5:2 F5:4 D5:4', 'E5:2 F5:2 E5:2 C#5:2 E5:4 A4:4'];
var LA2 = LA.slice(0, 6).concat(['Bb5:4 C6:2 D6:2 F6:4 D6:4', 'C#6:4 A5:4 E5:4 A5:4']);
var LB = ['G5:2 Bb5:2 D6:4 Bb5:2 G5:2 A5:4', 'Bb5:2 D6:2 F6:4 D6:2 Bb5:2 C6:4',
          'D6:4 C6:2 Bb5:2 A5:4 F5:4', 'E5:2 A5:2 C#6:4 E6:4 D6:2 C#6:2',
          'D6:3 C6:1 Bb5:4 G5:4 Bb5:4', 'D6:3 C6:1 Bb5:4 F5:4 Bb5:4',
          'C#6:4 E6:4 A5:4 G5:2 E5:2', 'F5:4 E5:4 D5:4 C#5:4'];
var LB2 = LB.slice(0, 6).concat(['C#6:2 E6:2 A6:4 G6:2 E6:2 C#6:4', 'E6:4 C#6:4 A5:4 E5:4']);
var PAT = [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2];
var battleLead = null;

function battleStep(s, br, st, t, sd) {
  if (!battleLead) battleLead = bars([].concat(LA, LB, LA2, LB2)).map(function (b) {
    var m = {}; b.forEach(function (n) { m[n[0]] = n; }); return m; });
  var sec = br >> 3, b8 = br & 7, ch = (sec & 1) ? CB[b8] : CA[b8], i;
  // bass
  if (sec === 3 || st % 2 === 0) {
    var k = st >> 1, oct = (sec === 3 ? st % 4 === 3 : (k === 3 || k === 6)) ? 12 : 0;
    mn(s, { type: 'sawtooth', m: ch.r + oct, t: t, d: sd * (sec === 3 ? 0.9 : 1.7), g: (st % 4 === 0 ? 0.26 : 0.19),
            lp: [900, 250], det: [-5, 5] });
  }
  // arpeggio (harpsichord-ish pluck)
  var ai = PAT[st], an = ai === 3 ? ch.i[0] + 12 : ch.i[ai];
  mn(s, { type: (sec & 1) ? 'square' : 'sawtooth', m: ch.r + 24 + an, t: t, d: sd * 1.5, g: 0.07,
          lp: [3200, 900], det: [-8, 8], rev: 0.1 });
  // organ pad
  if (st === 0) for (i = 0; i < 3; i++)
    mn(s, { type: 'sawtooth', m: ch.r + 12 + ch.i[i] + (i === 2 ? 12 : 0), t: t, d: sd * 15, a: 0.05, rel: 0.15, sus: true,
            g: 0.035, lp: [700, 700], det: [-6, 6] });
  // lead
  var L = battleLead[br][st];
  if (L) {
    var d = L[2] * sd * 0.95;
    mn(s, { type: 'sawtooth', m: L[1], t: t, d: d, g: 0.1, a: 0.01, sus: true, rel: 0.12, lp: [4000, 2200], det: [-7, 7], rev: 0.3 });
    mn(s, { type: 'square', m: L[1] - 12, t: t, d: d, g: 0.03, a: 0.01, sus: true, lp: [1500, 1500] });
    if (sec >= 2) mn(s, { type: 'square', m: L[1] + 12, t: t, d: d, g: 0.035, a: 0.01, sus: true, lp: [3000, 3000], rev: 0.3 });
  }
  // drums
  var kk = (sec & 1) ? (st === 0 || st === 6 || st === 8 || st === 10) : (st === 0 || st === 6 || st === 8);
  if (sec === 3 && st === 14) kk = true;
  if (kk) kick(s, t, 0.9);
  var sn = st === 4 || st === 12;
  if (b8 === 3 && st === 15) sn = true;
  if (b8 === 7 && (st === 14 || st === 15)) sn = true;
  if (br === 31 && st >= 8 && st % 2 === 0) sn = true;
  if (sn) snare(s, t, 0.55 + (st >= 14 ? 0.15 : 0));
  if (sec & 1 || sec === 2) { if (st % 2 === 0) hat(s, t, 0.1, false); else hat(s, t, 0.05, false); }
  else if (st % 2 === 0) hat(s, t, 0.11, false);
  if (sec >= 2 && (st === 6 || st === 14)) hat(s, t, 0.1, true);
  if (b8 === 0 && st === 0) mnz(s, { t: t, d: 1.2, g: 0.18, type: 'highpass', f: 5000 });
}

/* --- title (A minor, 72 BPM, 16 bars) --- */
var TC = [chord('A2', 'm'), chord('F2', 'M'), chord('C3', 'M'), chord('G2', 'M'),
          chord('A2', 'm'), chord('F2', 'M'), chord('D3', 'm'), chord('E3', 'M')];
var TM = ['E5:6 -:2 A5:4 C6:4', 'A5:6 -:2 F5:4 A5:4', 'G5:6 -:2 E5:4 G5:4', 'D5:8 B4:4 -:4',
          'E5:4 A5:4 C6:4 E6:4', 'D6:6 C6:2 A5:8', 'F5:6 A5:2 D6:4 C6:4', 'B5:4 G#5:4 E5:8'];
var titleLead = null;
function titleStep(s, br, st, t, sd) {
  if (!titleLead) titleLead = bars(TM).map(function (b) { var m = {}; b.forEach(function (n) { m[n[0]] = n; }); return m; });
  var ch = TC[br & 7], i, second = br >= 8;
  if (st === 0) {
    for (i = 0; i < 3; i++)
      mn(s, { type: 'triangle', m: ch.r + 12 + ch.i[i] + (i ? 12 : 0), t: t, d: sd * 14, a: 0.7, rel: 0.9, sus: true,
              g: 0.06, lp: [1100, 1100], det: [-5, 5], rev: 0.5 });
    mn(s, { m: ch.r, t: t, d: sd * 7, g: 0.16, a: 0.03 });
  }
  if (st === 8) mn(s, { m: ch.r, t: t, d: sd * 6, g: 0.1, a: 0.03 });
  var L = titleLead[br & 7][st];
  if (L) {
    mn(s, { m: L[1], t: t, d: 1.5, g: 0.13, rev: 0.6 });
    mn(s, { m: L[1] + 24, t: t, d: 0.5, g: 0.035, rev: 0.6 });
    if (second) mn(s, { m: L[1] + 12, t: t + sd * 3, d: 1.0, g: 0.045, rev: 0.7 });
  }
  if (second && st % 4 === 2) mn(s, { m: ch.r + 36 + ch.i[(st >> 2) % 3], t: t, d: 0.9, g: 0.04, rev: 0.6 });
}

/* --- result (F major-ish, 76 BPM, 8 bars) --- */
var RC = [chord('F2', 'M'), chord('C2', 'M'), chord('D2', 'm'), chord('Bb1', 'M'),
          chord('F2', 'M'), chord('C2', 'M'), chord('Bb1', 'M'), chord('C2', 'M')];
var RM = ['A5:4 C6:4 A5:4 G5:4', 'G5:4 E5:4 G5:8', 'F5:4 A5:4 D6:8', 'D6:4 C6:4 Bb5:8',
          'A5:4 C6:4 F6:8', 'E6:4 D6:4 C6:8', 'D6:4 C6:4 A5:4 Bb5:4', 'G5:12 -:4'];
var resLead = null;
function resultStep(s, br, st, t, sd) {
  if (!resLead) resLead = bars(RM).map(function (b) { var m = {}; b.forEach(function (n) { m[n[0]] = n; }); return m; });
  var ch = RC[br], i;
  if (st === 0) {
    for (i = 0; i < 3; i++)
      mn(s, { type: 'triangle', m: ch.r + 24 + ch.i[i], t: t, d: sd * 15, a: 0.5, rel: 0.7, sus: true,
              g: 0.05, lp: [1300, 1300], det: [-5, 5], rev: 0.5 });
    mn(s, { m: ch.r + 12, t: t, d: sd * 8, g: 0.14, a: 0.03 });
  }
  if (st === 8) mn(s, { m: ch.r + 12, t: t, d: sd * 6, g: 0.08, a: 0.03 });
  if (st % 2 === 0) mn(s, { type: 'triangle', m: ch.r + 36 + ch.i[(st >> 1) % 4 === 3 ? 1 : (st >> 1) % 4 % 3], t: t, d: 0.5, g: 0.05, rev: 0.3 });
  var L = resLead[br][st];
  if (L) {
    mn(s, { type: 'triangle', m: L[1], t: t, d: Math.min(1.4, L[2] * sd * 1.1), g: 0.11, a: 0.01, rev: 0.5 });
    mn(s, { m: L[1] + 12, t: t, d: 0.5, g: 0.03, rev: 0.5 });
  }
}

var TR = {
  title:  { bpm: 72,  bars: 16, step: titleStep },
  battle: { bpm: 150, bars: 32, step: battleStep },
  result: { bpm: 76,  bars: 8,  step: resultStep }
};

function tick(s) {
  if (!ctx || s.dead) return;
  try {
    var now = ctx.currentTime, sd = s.sd;
    if (s.next < now - 0.05) { // tab was throttled: skip missed steps instead of bursting
      var miss = Math.ceil((now - s.next) / sd);
      s.idx += miss; s.next += miss * sd;
    }
    while (s.next < now + 0.25) {
      var i = s.idx % s.total;
      s.tr.step(s, Math.floor(i / 16), i % 16, s.next, sd);
      s.idx++; s.next += sd;
    }
  } catch (e) { if (DEBUG) throw e; }
}
function stopSess(s, fade) {
  if (!s) return;
  var t = ctx.currentTime;
  try { s.out.gain.cancelScheduledValues(t); s.out.gain.setValueAtTime(s.out.gain.value, t);
        s.out.gain.linearRampToValueAtTime(0, t + fade); } catch (e) {}
  setTimeout(function () { s.dead = true; clearInterval(s.timer); }, fade * 1000 + 100);
  setTimeout(function () { dc(s.out); }, fade * 1000 + 1500);
}
function startMusic(name) {
  var old = sess; sess = null;
  stopSess(old, 0.6);
  var tr = TR[name];
  if (!tr) return;
  var s = { tr: tr, sd: 60 / tr.bpm / 4, total: tr.bars * 16, idx: 0, dead: false };
  s.out = ctx.createGain();
  s.out.gain.setValueAtTime(0, ctx.currentTime);
  s.out.gain.linearRampToValueAtTime(1, ctx.currentTime + (old ? 0.6 : 0.05));
  s.out.connect(musBus);
  s.next = ctx.currentTime + 0.08;
  s.timer = setInterval(function () { tick(s); }, 50);
  sess = s;
  tick(s);
}
function music(name) {
  name = name || null;
  if (name === want) return;
  want = name;
  if (!ctx) return;
  try { startMusic(name); } catch (e) { if (DEBUG) throw e; }
}

function setMute(b) {
  muted = !!b; SND.muted = muted;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
}
function setVolume(sv, mv) {
  if (sv != null) sfxVol = clamp(+sv || 0, 0, 1);
  if (mv != null) musVol = clamp(+mv || 0, 0, 1);
  if (ctx) {
    sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.02);
    musBus.gain.setTargetAtTime(musVol, ctx.currentTime, 0.02);
  }
}

var SND = { init: init, play: play, music: music, setMute: setMute, setVolume: setVolume, muted: false };
G.SND = SND;

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && ctx) {
      if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
      if (sess) tick(sess);
    }
  });
}
})();
