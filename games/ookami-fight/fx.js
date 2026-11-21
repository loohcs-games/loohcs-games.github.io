// fx.js — 演出。魔法陣、斬撃、火花、影の口、光の柱。試合の出来事（g.events）を受けて粒を生み、描く。
// 仕組み（engine.js）には触れない。乱数は見た目だけなので Math.random を使う。
(function (root) {
  'use strict';
  const F = root.FIGHT, TAU = Math.PI * 2;
  const R = Math.random, rr = (a, b) => a + R() * (b - a);
  const PAL = {
    girl: { core: '#ffffff', glow: [170, 215, 255], acc: [255, 240, 205] },
    man: { core: '#f2e8ff', glow: [150, 105, 255], acc: [255, 70, 100] },
  };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  let P = [], tex = {}, shake = 0, flash = 0, flashCol = '255,255,255', dark = 0, darkTo = 0, time = 0;

  // ---------------------------------------------------------------- 魔法陣を描いておく
  function mkCircle(kind, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'), r = size / 2, pal = PAL[kind];
    let s = kind === 'girl' ? 11 : 29;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    c.translate(r, r);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pass = (blur, col, lw) => {
      c.shadowBlur = blur; c.shadowColor = rgba(pal.glow, 1); c.strokeStyle = col; c.fillStyle = col;
      const ring = (q, w) => { c.lineWidth = w * lw; c.beginPath(); c.arc(0, 0, r * q, 0, TAU); c.stroke(); };
      ring(0.955, 3.2); ring(0.905, 1.2); ring(0.76, 1.6); ring(0.735, 0.8); ring(0.40, 1.4); ring(0.20, 1);
      // 文字のような刻み（外の帯）
      const n = kind === 'girl' ? 28 : 34;
      for (let i = 0; i < n; i++) {
        c.save(); c.rotate(i / n * TAU); c.translate(0, -r * 0.832); c.lineWidth = 1.5 * lw;
        const k = 2 + Math.floor(rnd() * 3), u = r * 0.03;
        c.beginPath();
        for (let j = 0; j < k; j++) {
          const x0 = (Math.floor(rnd() * 3) - 1) * u, y0 = (Math.floor(rnd() * 3) - 1) * u * 1.2, x1 = (Math.floor(rnd() * 3) - 1) * u, y1 = (Math.floor(rnd() * 3) - 1) * u * 1.2;
          c.moveTo(x0, y0); if (rnd() < 0.3) c.arc(x0, y0, u * 0.6, 0, Math.PI); else c.lineTo(x1, y1);
        }
        c.stroke(); c.restore();
      }
      // 星形
      const star = (m, step, q, w, rot) => {
        c.lineWidth = w * lw; c.beginPath();
        for (let i = 0; i <= m; i++) { const a = rot + (i * step) / m * TAU; const x = Math.cos(a) * r * q, y = Math.sin(a) * r * q; i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.closePath(); c.stroke();
      };
      if (kind === 'girl') {
        star(3, 1, 0.735, 1.5, -Math.PI / 2); star(3, 1, 0.735, 1.5, Math.PI / 2);
        star(6, 1, 0.40, 1, 0);
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i / 6 * TAU; c.lineWidth = 1.2 * lw; c.beginPath(); c.arc(Math.cos(a) * r * 0.735, Math.sin(a) * r * 0.735, r * 0.055, 0, TAU); c.stroke(); c.beginPath(); c.arc(Math.cos(a) * r * 0.735, Math.sin(a) * r * 0.735, r * 0.018, 0, TAU); c.fill(); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = 1 * lw; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.40, Math.sin(a) * r * 0.40); c.lineTo(Math.cos(a) * r * 0.20, Math.sin(a) * r * 0.20); c.stroke(); }
        // 中心の三日月
        c.beginPath(); c.arc(0, 0, r * 0.13, 0.6, TAU - 0.6); c.arc(r * 0.06, 0, r * 0.1, TAU - 0.9, 0.9, true); c.closePath(); c.fill();
      } else {
        star(7, 3, 0.735, 1.6, -Math.PI / 2); star(7, 2, 0.735, 0.9, Math.PI / 2);
        star(4, 1, 0.40, 1.2, 0); star(4, 1, 0.40, 1.2, Math.PI / 4);
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + i / 7 * TAU; c.save(); c.translate(Math.cos(a) * r * 0.57, Math.sin(a) * r * 0.57); c.rotate(a); c.lineWidth = 1.2 * lw; c.beginPath(); c.moveTo(-r * 0.05, 0); c.lineTo(0, -r * 0.03); c.lineTo(r * 0.05, 0); c.lineTo(0, r * 0.03); c.closePath(); c.stroke(); c.restore(); }
        for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, q0 = i % 2 ? 0.905 : 0.88; c.lineWidth = 1 * lw; c.beginPath(); c.moveTo(Math.cos(a) * r * q0, Math.sin(a) * r * q0); c.lineTo(Math.cos(a) * r * 0.955, Math.sin(a) * r * 0.955); c.stroke(); }
        // 中心の牙の輪
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a - 0.2) * r * 0.2, Math.sin(a - 0.2) * r * 0.2); c.lineTo(Math.cos(a) * r * 0.06, Math.sin(a) * r * 0.06); c.lineTo(Math.cos(a + 0.2) * r * 0.2, Math.sin(a + 0.2) * r * 0.2); c.closePath(); c.fill(); }
      }
    };
    pass(size / 22, rgba(pal.glow, 0.9), 1.5);
    pass(size / 80, 'rgba(255,255,255,0.95)', 0.8);
    return cv;
  }
  function init() {
    if (tex.girl) return;
    tex.girl = mkCircle('girl', 640); tex.man = mkCircle('man', 640);
  }
  // 陣を描く。flat=床に寝かせる、sx=縦に立てたときの横の潰し
  function circle(c, kind, x, y, rad, rot, alpha, flat, sx) {
    if (alpha <= 0 || rad <= 1) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, alpha);
    c.translate(x, y); if (flat) c.scale(1, 0.26); else if (sx) c.scale(sx, 1);
    c.rotate(rot); c.drawImage(tex[kind], -rad, -rad, rad * 2, rad * 2); c.restore();
  }

  // ---------------------------------------------------------------- 粒
  let live = true;
  const add = o => { o.t = 0; if (live && P.length < 1000) P.push(o); return o; };
  function sparks(x, y, n, col, sp, dir, life) {
    for (let i = 0; i < n; i++) {
      const a = dir == null ? R() * TAU : dir + rr(-0.9, 0.9), v = rr(0.4, 1) * sp;
      add({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (life || 14) + R() * 8, col, w: rr(1.5, 3.5) });
    }
  }
  function pixels(x, y, n, col, sp, up, life) {
    for (let i = 0; i < n; i++) add({ k: 'px', x: x + rr(-8, 8), y: y + rr(-8, 8), vx: rr(-1, 1) * sp, vy: rr(-1, 0.4) * sp - (up || 0), g: 0.25, life: (life || 26) + R() * 20, col, s: R() < 0.3 ? 4 : 2 });
  }
  const ring = (x, y, r0, r1, col, life, flat, lw) => add({ k: 'ring', x, y, r0, r1, col, life, flat, lw: lw || 3 });
  const slash = (x, y, ang, len, wid, col, life, core) => add({ k: 'slash', x, y, ang, len, wid, col, life: life || 11, core: core || '#fff' });
  const dust = (x, y, n, dir) => { for (let i = 0; i < n; i++) add({ k: 'dust', x: x + rr(-10, 10), y: y - rr(0, 6), vx: (dir || 0) * rr(0.5, 2.5) + rr(-0.8, 0.8), vy: -rr(0.2, 1.2), life: rr(14, 26), s: rr(5, 11) }); };

  function hitFx(e, g) {
    const kind = g.f[e.by].key, pal = PAL[kind], x = e.x, y = F.FLOOR - e.y, lvl = e.lvl, d = e.dir, fx = e.fx || 'kick';
    const col = pal.glow, ang = d > 0 ? 0 : Math.PI;
    shake = Math.max(shake, 3 + lvl * 4 + (e.counter ? 3 : 0));
    if (lvl >= 2) { flash = Math.max(flash, 0.22); }
    sparks(x, y, 5 + lvl * 5, pal.acc, 7 + lvl * 3, ang);
    ring(x, y, 6, 34 + lvl * 22, col, 10 + lvl * 2);
    const sl = (a, len, off) => slash(x + Math.cos(a + 1.57) * off, y + Math.sin(a + 1.57) * off, a, len, len * 0.16, col);
    const m = d > 0 ? 1 : -1;
    switch (fx) {
      case 'paw': add({ k: 'star', x, y, r: 26, col: pal.acc, life: 8 }); break;
      case 'claw': { const a = d > 0 ? 0.5 : Math.PI - 0.5; sl(a, 120, -22); sl(a, 140, 0); sl(a, 120, 22); break; }
      case 'clawUp': { const a = -Math.PI / 2 + m * 0.25; sl(a, 150, -24); sl(a, 180, 0); sl(a, 150, 24); pixels(x, y, 8, pal.acc, 3, 3); break; }
      case 'clawDown': { const a = Math.PI / 2 - m * 0.5; sl(a, 140, -24); sl(a, 170, 0); sl(a, 140, 24); break; }
      case 'kick': add({ k: 'star', x, y, r: 40 + lvl * 14, col: pal.core, life: 9 }); ring(x, y, 10, 60, pal.acc, 12); break;
      case 'burst': ring(x, y, 10, 110, pal.acc, 16, false, 5); add({ k: 'circ', kind, x, y, r0: 30, r1: 110, life: 18, sx: 0.4, rot: R() * 6 }); pixels(x, y, 14, pal.acc, 5); break;
      case 'shadowSlash': slash(x, y, d > 0 ? -0.25 : Math.PI + 0.25, 240, 46, col, 13, '#0a0412'); slash(x, y, d > 0 ? -0.25 : Math.PI + 0.25, 210, 14, pal.acc, 9); pixels(x, y, 12, col, 5); break;
      case 'shadowUp': slash(x, y, -Math.PI / 2 + m * 0.12, 260, 44, col, 13, '#0a0412'); pixels(x, y, 16, col, 3, 5); break;
      case 'spike': slash(x, y, -Math.PI / 2 + m * 0.5, 120, 22, col, 10, '#0a0412'); break;
      case 'bite': ring(x, y, 10, 90, pal.acc, 12, false, 4); if (!(API.has && API.has('maw'))) add({ k: 'jaw', x: x - d * 30, y, s: 62, life: 12, col, dir: d }); pixels(x, y, 10, pal.acc, 5); break;
      case 'light': add({ k: 'beam', x, y: F.FLOOR, w: 36, h: 420, col, life: 12 }); pixels(x, y, 10, pal.acc, 4, 3); break;
      case 'moon': slash(x, y, -Math.PI / 2 + m * 0.35, 230, 50, pal.acc, 13); pixels(x, y, 14, pal.acc, 4, 4); break;
    }
    if (e.counter) add({ k: 'text', x, y: y - 50, s: 'COUNTER', col: '#ff5a6e', life: 40 });
  }

  // 試合の出来事を受ける
  function handle(g) {
    for (const e of g.events) {
      const f = e.i != null ? g.f[e.i] : null, kind = f ? f.key : 'girl', pal = PAL[kind];
      const x = e.x, y = F.FLOOR - (e.y || 0);
      switch (e.k) {
        case 'hit': hitFx(e, g); break;
        case 'guard': sparks(x, y, 7, [190, 220, 255], 6); ring(x, y, 8, 44, [150, 190, 255], 9); shake = Math.max(shake, 2); break;
        case 'shield': break;
        case 'shieldHit': add({ k: 'circ', kind, x, y, r0: 40, r1: 150, life: 26, sx: 0.42, rot: R() * 6 }); ring(x, y, 20, 150, pal.acc, 18, false, 5); sparks(x, y, 18, pal.acc, 11); flash = Math.max(flash, 0.3); shake = 7; break;
        case 'jump': dust(x, F.FLOOR, e.dbl ? 0 : 5); if (e.dbl) ring(x, y, 8, 44, pal.glow, 12, true); break;
        case 'land': dust(x, F.FLOOR, 5); break;
        case 'dash': if (!e.air) dust(x, F.FLOOR, 8, -f.face); else ring(x, y - 60, 8, 50, pal.glow, 12); for (let i = 0; i < 6; i++) add({ k: 'streak', x: x - f.face * rr(0, 60), y: y - rr(20, f.ch.h), vx: -f.face * rr(8, 16), len: rr(40, 110), life: 10, col: pal.glow }); break;
        case 'down': dust(x, F.FLOOR, 12); ring(x, F.FLOOR, 10, 90, [200, 200, 220], 14, true); shake = Math.max(shake, 6); break;
        case 'tech': ring(x, y, 10, 60, [255, 255, 255], 12); break;
        case 'ex': ring(x, y, 20, 140, [255, 230, 140], 16, false, 5); sparks(x, y, 14, [255, 230, 140], 9); flash = Math.max(flash, 0.18); break;
        case 'gmax': if (f) { ring(f.x, F.FLOOR - f.y - f.ch.h / 2, 20, 160, pal.acc, 22, false, 4); pixels(f.x, F.FLOOR - f.y - f.ch.h / 2, 20, pal.acc, 4, 3); } break;
        case 'super': darkTo = 0.72; add({ k: 'circ', kind, x, y: y - f.ch.h * 0.5, r0: 60, r1: 260, life: 60, sx: 1, rot: 0, spin: 0.05, hold: 1 }); ring(x, y - f.ch.h * 0.5, 30, 500, pal.acc, 30, false, 6); break;
        case 'ko': if (e.w >= 0) { const wk = g.f[e.w].key; add({ k: 'circ', kind: wk, x, y: F.FLOOR - e.y, r0: 40, r1: 330, life: 110, sx: 1, rot: 0, spin: 0.03, hold: 1, grow: 16, a: 0.8 }); add({ k: 'circ', kind: wk, x, y: F.FLOOR, r0: 40, r1: 300, life: 110, flat: 1, rot: 0, spin: -0.05, hold: 1, grow: 12 }); }
          flash = 1; shake = 22; ring(x, F.FLOOR - e.y, 20, 700, [255, 255, 255], 40, false, 10); sparks(x, F.FLOOR - e.y, 50, [255, 240, 210], 18, null, 40); pixels(x, F.FLOOR - e.y, 50, [255, 255, 255], 9, 2, 60); darkTo = 0.5; break;
        case 'roundEnd': darkTo = 0; break;
        case 'round': P.length = 0; darkTo = 0; dark = 0; break;
        case 'entOn': entOn(e.e, g); break;
        case 'fx': custom(e, g, f, pal, kind); break;
      }
    }
  }
  function custom(e, g, f, pal, kind) {
    const x = e.x, y = F.FLOOR - e.y, d = e.dir || 1;
    switch (e.fx) {
      case 'catStreak':
        ring(x, y, 10, e.ex ? 120 : 80, pal.glow, 14);
        for (let i = 0; i < (e.ex ? 22 : 12); i++) add({ k: 'streak', x: x + rr(-30, 30), y: y + rr(-50, 40), vx: -d * rr(10, 22), vy: e.down ? -rr(6, 12) : 0, len: rr(60, 180), life: rr(10, 18), col: e.ex ? pal.acc : pal.glow });
        if (e.ex) add({ k: 'circ', kind, x, y, r0: 20, r1: 120, life: 20, sx: 0.4, rot: R() * 6 });
        break;
      case 'moonArc':
        add({ k: 'arc', x, y: F.FLOOR - e.y, d, life: e.ex ? 26 : 18, r: e.ex ? 230 : 180, col: pal.acc, f: e.i });
        add({ k: 'circ', kind, x, y: F.FLOOR, r0: 30, r1: e.ex ? 150 : 100, life: 22, flat: 1, rot: R() * 6, spin: 0.2 });
        pixels(x, F.FLOOR, 10, pal.acc, 3, 5);
        break;
      case 'bigCircle':
        add({ k: 'circ', kind, x, y, r0: 20, r1: 235, life: e.life, sx: 1, rot: 0, spin: 0.045, hold: 1, grow: 14 });
        add({ k: 'circ', kind, x, y, r0: 20, r1: 330, life: e.life, sx: 1, rot: 1, spin: -0.02, hold: 1, grow: 20, a: 0.45 });
        add({ k: 'circ', kind, x, y: F.FLOOR, r0: 40, r1: 300, life: e.life, flat: 1, rot: 0, spin: 0.06, hold: 1, grow: 12 });
        break;
      case 'dreamBlast':
        flash = 0.9; shake = 20;
        add({ k: 'blast', x, y, d, life: e.life, col: pal.glow, acc: pal.acc });
        for (let i = 0; i < 5; i++) ring(x + d * i * 120, y, 20, 240, pal.acc, 20 + i * 5, false, 6);
        break;
      case 'spike': add({ k: 'spikes', x, y: F.FLOOR, d, life: 18, col: pal.glow }); break;
      case 'pillar':
        add({ k: 'circ', kind, x, y: F.FLOOR, r0: 30, r1: e.ex ? 150 : 110, life: 34, flat: 1, rot: 0, spin: 0.2, hold: 1, grow: 6 });
        add({ k: 'column', x, y: F.FLOOR, w: e.ex ? 150 : 110, h: e.ex ? 390 : 350, life: e.ex ? 26 : 20, delay: 4, col: pal.glow, acc: pal.acc });
        break;
      case 'sink': add({ k: 'pool', x, y: F.FLOOR, life: 26, col: pal.glow }); pixels(x, F.FLOOR - 60, 14, pal.glow, 2, 2); break;
      case 'rise':
        add({ k: 'pool', x, y: F.FLOOR, life: 22, col: pal.glow, out: 1 }); add({ k: 'circ', kind, x, y: F.FLOOR, r0: 20, r1: 110, life: 22, flat: 1, rot: 0, spin: 0.2 });
        add({ k: 'column', x, y: F.FLOOR, w: e.ex ? 180 : 70, h: e.ex ? 220 : 290, life: 14, delay: 0, col: pal.glow, acc: pal.acc });
        break;
    }
  }
  function entOn(e, g) {
    const kind = g.f[e.owner].key, pal = PAL[kind];
    if (e.kind === 'dreamRing') { flash = Math.max(flash, e.ex ? 0.4 : 0.2); shake = Math.max(shake, e.ex ? 10 : 6); pixels(e.x, F.FLOOR - 40, 24, pal.acc, 5, 7, 40); ring(e.x, F.FLOOR, 20, e.w * 1.6, pal.acc, 18, true, 5); }
    if (e.kind === 'kingdom') { flash = Math.max(flash, 0.5); shake = 18; pixels(e.x, F.FLOOR - 80, 40, pal.glow, 7, 8, 50); }
  }

  // ---------------------------------------------------------------- 進める・描く
  function tick() {
    time++;
    if (shake > 0) shake *= 0.86; if (shake < 0.4) shake = 0;
    if (flash > 0) flash = Math.max(0, flash - 0.07);
    dark += (darkTo - dark) * 0.18;
    for (const p of P) {
      p.t++;
      if (p.vx) p.x += p.vx; if (p.vy) p.y += p.vy;
      if (p.k === 'px') { p.vy += p.g; p.vx *= 0.97; }
      if (p.k === 'spark') { p.vx *= 0.88; p.vy *= 0.88; }
      if (p.k === 'dust') { p.vx *= 0.9; }
    }
    P = P.filter(p => p.t < p.life);
    if (P.length > 900) P.splice(0, P.length - 900);
  }

  // 口だけの使い魔。黒い塊に、裂けた口と牙。open 0..1、ang は口の向き（0=右、-PI/2=上）
  function jawShape(c, x, y, s, open, col, flip, ang, acc) {
    acc = acc || [255, 70, 100];
    c.save(); c.translate(x, y); if (flip) c.scale(-1, 1); if (ang) c.rotate(ang);
    const a = 0.12 + open * 0.62;                       // 口の開き（半角）
    const body = (k) => {
      c.beginPath();
      const n = 56;
      for (let i = 0; i <= n; i++) {
        const t = a + (TAU - 2 * a) * i / n;
        const wob = 1 + 0.04 * Math.sin(i * 0.9 + time * 0.4) + 0.03 * Math.sin(i * 2.3 - time * 0.6) + (Math.abs(t - Math.PI) < 1.0 ? 0.2 * Math.abs(Math.sin(i * 0.8 + time * 0.25)) : 0);
        const r = s * k * wob;
        i ? c.lineTo(Math.cos(t) * r, Math.sin(t) * r) : c.moveTo(Math.cos(t) * r, Math.sin(t) * r);
      }
      c.lineTo(-s * 0.25, 0); c.closePath();
    };
    c.shadowBlur = s * 0.4; c.shadowColor = rgba(col, 1); c.fillStyle = rgba(col, 0.95); body(1.06); c.fill();
    c.shadowBlur = 0;
    // 口の中
    const gr = c.createRadialGradient(-s * 0.2, 0, s * 0.05, 0, 0, s);
    gr.addColorStop(0, rgba(acc, 0.95)); gr.addColorStop(1, 'rgba(60,5,25,0.9)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(-s * 0.25, 0); c.arc(0, 0, s * 0.98, -a, a); c.closePath(); c.fill();
    c.fillStyle = '#07030d'; body(1); c.fill();
    // 牙
    c.fillStyle = '#efe6ff';
    for (const up of [-1, 1]) {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const r0 = s * (0.3 + 0.7 * i / n), r1 = s * (0.3 + 0.7 * (i + 1) / n), rm = (r0 + r1) / 2, len = s * (0.16 + 0.1 * (i % 2)) * Math.min(1, 0.35 + open * 1.4);
        const ex = Math.cos(up * a), ey = Math.sin(up * a), nx = ey * up, ny = -ex * up;
        c.beginPath(); c.moveTo(ex * r0, ey * r0); c.lineTo(ex * r1, ey * r1); c.lineTo(ex * rm + nx * len, ey * rm + ny * len); c.closePath(); c.fill();
      }
    }
    c.restore();
  }

  function drawP(c, p, layer) {
    const q = p.t / p.life, inv = 1 - q;
    switch (p.k) {
      case 'spark': c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(p.col, inv); c.lineWidth = p.w; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); break;
      case 'px': c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(p.col, Math.min(1, inv * 2)); c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); break;
      case 'ring': {
        const r = p.r0 + (p.r1 - p.r0) * (1 - inv * inv);
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(p.col, inv); c.lineWidth = p.lw * inv + 0.5;
        c.beginPath(); c.ellipse(p.x, p.y, r, p.flat ? r * 0.26 : r, 0, 0, TAU); c.stroke(); break;
      }
      case 'star': {
        const r = p.r * (0.5 + q), w = r * 0.16 * inv;
        c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(typeof p.col === 'string' ? [255, 255, 255] : p.col, inv);
        c.beginPath(); c.moveTo(p.x - r, p.y); c.lineTo(p.x, p.y - w); c.lineTo(p.x + r, p.y); c.lineTo(p.x, p.y + w); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(p.x, p.y - r); c.lineTo(p.x + w, p.y); c.lineTo(p.x, p.y + r); c.lineTo(p.x - w, p.y); c.closePath(); c.fill(); break;
      }
      case 'slash': {
        // 三日月形の斬撃。伸びてから細る
        const grow = Math.min(1, p.t / 3), len = p.len * (0.5 + 0.5 * grow), w = p.wid * inv;
        c.save(); c.translate(p.x, p.y); c.rotate(p.ang);
        const shape = (ww) => { c.beginPath(); c.moveTo(-len / 2, 0); c.quadraticCurveTo(0, -ww * 2.2, len / 2, 0); c.quadraticCurveTo(0, -ww * 0.6, -len / 2, 0); c.closePath(); };
        if (p.core !== '#fff') { c.shadowBlur = 16; c.shadowColor = rgba(p.col, 1); c.fillStyle = rgba(p.col, inv); shape(w * 1.25); c.fill(); c.shadowBlur = 0; c.fillStyle = p.core; c.globalAlpha = Math.min(1, inv * 1.6); shape(w); c.fill(); }
        else { c.globalCompositeOperation = 'lighter'; c.shadowBlur = 14; c.shadowColor = rgba(p.col, 1); c.fillStyle = rgba(p.col, inv); shape(w * 1.5); c.fill(); c.fillStyle = 'rgba(255,255,255,' + inv + ')'; shape(w * 0.7); c.fill(); }
        c.restore(); break;
      }
      case 'circ': {
        const g0 = p.grow || 6, k = Math.min(1, p.t / g0), ease = 1 - (1 - k) * (1 - k);
        const r = p.r0 + (p.r1 - p.r0) * (p.hold ? ease : (1 - inv * inv));
        const a = (p.a || 1) * (p.hold ? Math.min(1, inv * 5) : inv);
        circle(c, p.kind, p.x, p.y, r, p.rot + p.t * (p.spin || 0.03), a, p.flat, p.sx); break;
      }
      case 'beam': {
        const w = p.w * (0.4 + inv);
        c.globalCompositeOperation = 'lighter';
        const gr = c.createLinearGradient(p.x - w, 0, p.x + w, 0); gr.addColorStop(0, rgba(p.col, 0)); gr.addColorStop(0.5, 'rgba(255,255,255,' + inv + ')'); gr.addColorStop(1, rgba(p.col, 0));
        c.fillStyle = gr; c.fillRect(p.x - w, p.y - p.h, w * 2, p.h); break;
      }
      case 'jaw': if (API.has && API.has('maw')) { API.spr(c, 'maw', q < 0.35 ? 2 : 3, p.x - (p.dir || 1) * 26, p.y + 40, p.dir || 1, { scale: 0.85, glow: rgba(p.col, 1), alpha: Math.min(1, inv * 2.5) }); break; }
        jawShape(c, p.x, p.y, p.s * (0.7 + 0.3 * q), Math.max(0, 1 - q * 2.2), p.col, p.dir < 0); break;
      case 'text': c.globalCompositeOperation = 'source-over'; c.font = 'italic 900 20px Georgia, serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(10,6,20,' + inv + ')'; c.fillStyle = p.col; c.globalAlpha = Math.min(1, inv * 2); c.strokeText(p.s, p.x, p.y - p.t * 0.5); c.fillText(p.s, p.x, p.y - p.t * 0.5); break;
      case 'dust': c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(190,190,215,' + inv * 0.35 + ')'; c.beginPath(); c.ellipse(p.x, p.y, p.s * (1 + q), p.s * 0.55 * (1 + q), 0, 0, TAU); c.fill(); break;
      case 'streak': c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(p.col, inv * 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.sign(p.vx) * p.len, p.y + (p.vy ? Math.sign(p.vy) * p.len * 0.7 : 0)); c.stroke(); break;
      case 'arc': {
        // 月弧：下から上へ大きな三日月
        const a0 = p.d > 0 ? Math.PI * 0.55 : Math.PI * 0.45, sw = Math.min(1, p.t / 7) * Math.PI * 1.05 * (p.d > 0 ? -1 : 1);
        c.save(); c.globalCompositeOperation = 'lighter'; c.translate(p.x + p.d * 10, p.y - p.r * 0.55);
        c.shadowBlur = 22; c.shadowColor = rgba(p.col, 1);
        for (const [w, al] of [[30, 0.5], [12, 1]]) {
          c.strokeStyle = w > 20 ? rgba(p.col, inv * al) : 'rgba(255,255,255,' + inv + ')'; c.lineWidth = w * inv; c.lineCap = 'round';
          c.beginPath(); c.arc(0, 0, p.r * 0.62, a0, a0 + sw, p.d > 0); c.stroke();
        }
        c.restore(); break;
      }
      case 'blast': {
        // 奥義の奔流
        const k = Math.min(1, p.t / 6), h = 330 * k * (0.35 + 0.65 * inv), L = 1300;
        c.save(); c.globalCompositeOperation = 'lighter';
        const x0 = p.d > 0 ? p.x - 40 : p.x + 40 - L;
        const gr = c.createLinearGradient(0, p.y - h, 0, p.y + h);
        gr.addColorStop(0, rgba(p.col, 0)); gr.addColorStop(0.3, rgba(p.col, 0.7 * inv + 0.15)); gr.addColorStop(0.5, 'rgba(255,255,255,' + Math.min(1, inv * 1.6) + ')'); gr.addColorStop(0.7, rgba(p.acc, 0.7 * inv + 0.15)); gr.addColorStop(1, rgba(p.col, 0));
        c.fillStyle = gr; c.fillRect(x0, p.y - h, L, h * 2);
        c.strokeStyle = 'rgba(255,255,255,' + inv * 0.8 + ')'; c.lineWidth = 2;
        for (let i = 0; i < 16; i++) { const yy = p.y + Math.sin(i * 7.3 + p.t) * h * 0.8, xx = x0 + ((i * 173 + p.t * 60) % L); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + p.d * 160, yy); c.stroke(); }
        c.restore();
        if (p.t % 2 === 0) pixels(p.x + p.d * rr(0, 600), p.y + rr(-120, 120), 3, p.acc, 6, 0, 20);
        break;
      }
      case 'spikes': {
        const up = Math.min(1, p.t / 4) * Math.min(1, inv * 3);
        for (let i = -1; i <= 1; i++) {
          const x = p.x + i * 44, h = (i ? 66 : 96) * up, w = 17;
          c.shadowBlur = 12; c.shadowColor = rgba(p.col, 1); c.fillStyle = rgba(p.col, 0.9);
          c.beginPath(); c.moveTo(x - w, p.y); c.lineTo(x + p.d * 10, p.y - h); c.lineTo(x + w, p.y); c.closePath(); c.fill();
          c.shadowBlur = 0; c.fillStyle = '#07030d';
          c.beginPath(); c.moveTo(x - w + 4, p.y); c.lineTo(x + p.d * 10, p.y - h + 7); c.lineTo(x + w - 4, p.y); c.closePath(); c.fill();
        }
        break;
      }
      case 'column': {
        if (p.t < p.delay) break;
        const tt = p.t - p.delay, up = Math.min(1, tt / 4), fade = Math.min(1, (p.life - p.t) / 8), W0 = p.w * (0.4 + 0.6 * fade), H0 = p.h * up;
        const spikes = [[-0.36, 0.55, 0.3], [0.34, 0.62, 0.3], [-0.16, 0.82, 0.34], [0.17, 0.88, 0.34], [0, 1, 0.4]];
        for (const pass of [0, 1]) for (const [ox, hh, ww] of spikes) {
          const x = p.x + ox * W0 + Math.sin(p.t * 0.7 + ox * 9) * 4, h = H0 * hh, w = W0 * ww * (pass ? 0.78 : 1), lean = Math.sin(p.t * 0.5 + ox * 5) * 10;
          if (pass) { c.shadowBlur = 0; c.fillStyle = 'rgba(7,3,13,' + fade + ')'; } else { c.shadowBlur = 24; c.shadowColor = rgba(p.col, 1); c.fillStyle = rgba(p.col, 0.9 * fade); }
          c.beginPath(); c.moveTo(x - w / 2, p.y); c.quadraticCurveTo(x - w * 0.42, p.y - h * 0.6, x + lean, p.y - h * (pass ? 0.96 : 1)); c.quadraticCurveTo(x + w * 0.42, p.y - h * 0.6, x + w / 2, p.y); c.closePath(); c.fill();
        }
        c.shadowBlur = 0; c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(p.acc, 0.75 * fade); c.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const xx = p.x + Math.sin(i * 2.1 + p.t * 0.9) * W0 * 0.3; c.beginPath(); c.moveTo(xx, p.y); c.lineTo(xx, p.y - H0 * (0.5 + 0.4 * Math.abs(Math.sin(i * 3 + p.t)))); c.stroke(); }
        break;
      }
      case 'pool': {
        const k = p.out ? inv : Math.min(1, p.t / 8) * Math.min(1, inv * 4), r = 80 * k;
        c.shadowBlur = 18; c.shadowColor = rgba(p.col, 1); c.fillStyle = '#07030d';
        c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.22, 0, 0, TAU); c.fill(); break;
      }
    }
  }
  const BACK = { circ: 1, pool: 1, dust: 1 };
  function draw(c, layer) {
    for (const p of P) {
      const back = BACK[p.k] && (p.k !== 'circ' || p.flat || p.hold);
      if ((layer === 'back') !== !!back) continue;
      c.save(); drawP(c, p, layer); c.restore();
    }
  }

  // 実体（飛び道具・陣）を描く
  function ents(c, g, layer) {
    for (const e of g.ents) {
      const kind = g.f[e.owner].key, pal = PAL[kind], y = F.FLOOR - e.y;
      c.save();
      if (e.kind === 'dreamRing') {
        const k = Math.min(1, e.t / e.delay), on = e.t >= e.delay, after = e.t - e.delay, out = Math.max(0, 1 - Math.max(0, e.t - e.delay - e.active) / 14);
        if (layer === 'back') {
          circle(c, 'girl', e.x, y, e.w * (0.5 + 0.5 * k) * (on ? 1.15 : 1), e.t * (0.03 + k * 0.12), (0.35 + 0.65 * k) * out, true);
          circle(c, 'girl', e.x, y, e.w * 0.62 * k, -e.t * 0.2, 0.7 * k * out, true);
        } else {
          if (!on && e.t % 3 === 0) add({ k: 'px', x: e.x + rr(-e.w, e.w) * 0.6, y: y - rr(0, 10), vx: 0, vy: -rr(1, 3) * (0.5 + k), g: -0.03, life: 22, col: pal.acc, s: 2 });
          if (on && out > 0) {
            const w = e.w * (after < 4 ? after / 4 : 1) * (0.25 + 0.75 * out), h = e.h + 120;
            c.globalCompositeOperation = 'lighter';
            const gr = c.createLinearGradient(e.x - w, 0, e.x + w, 0);
            gr.addColorStop(0, rgba(pal.glow, 0)); gr.addColorStop(0.25, rgba(pal.glow, 0.55 * out)); gr.addColorStop(0.5, 'rgba(255,255,255,' + out + ')'); gr.addColorStop(0.75, rgba(pal.acc, 0.55 * out)); gr.addColorStop(1, rgba(pal.glow, 0));
            c.fillStyle = gr; c.fillRect(e.x - w, y - h, w * 2, h);
            for (let i = 0; i < 3; i++) { const yy = y - ((e.t * 26 + i * 150) % h); c.strokeStyle = 'rgba(255,255,255,' + 0.7 * out + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(e.x, yy, w * 0.8, w * 0.2, 0, 0, TAU); c.stroke(); }
          }
        }
      } else if (e.kind === 'maw') {
        const s = e.ex ? 62 : 42, gone = e.gone ? Math.max(0, 1 - (e.t - e.gone) / 8) : 1;
        if (layer === 'back') { c.fillStyle = 'rgba(7,3,13,' + 0.85 * gone + ')'; c.shadowBlur = 14; c.shadowColor = rgba(pal.glow, 1); c.beginPath(); c.ellipse(e.x - e.dir * s * 0.8, F.FLOOR, s * 2.2, s * 0.3, 0, 0, TAU); c.fill(); }
        else {
          c.globalAlpha = gone;
          const open = e.gone ? 0 : 0.5 + 0.5 * Math.sin(e.t * 0.55);
          if (API.has && API.has('maw')) API.spr(c, 'maw', e.gone ? 3 : [0, 1, 2, 2, 1][Math.floor(e.t / 4) % 5], e.x + e.dir * 8, y, e.dir, { scale: e.ex ? 1.5 : 1, glow: rgba(pal.glow, 1), alpha: gone });
          else jawShape(c, e.x, y - s * 0.95, s, open, pal.glow, e.dir < 0, 0, pal.acc);
          if (e.t % 2 === 0) add({ k: 'px', x: e.x - e.dir * s, y: y - rr(0, s * 1.6), vx: -e.dir * rr(0, 2), vy: -rr(0, 1), g: -0.02, life: 16, col: pal.glow, s: 3 });
        }
      } else if (e.kind === 'kingdom') {
        const k = Math.min(1, e.t / e.delay), on = e.t >= e.delay, out = Math.max(0, 1 - Math.max(0, e.t - e.delay - e.active) / 18), after = e.t - e.delay;
        if (layer === 'back') {
          circle(c, 'man', e.x, y, 250 * (0.3 + 0.7 * k), e.t * 0.05, out, true);
          circle(c, 'man', e.x, y, 150 * k, -e.t * 0.11, 0.8 * out, true);
          c.fillStyle = 'rgba(7,3,13,' + 0.8 * k * out + ')'; c.beginPath(); c.ellipse(e.x, y, 150 * k, 34 * k, 0, 0, TAU); c.fill();
        } else {
          if (!on) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba(pal.acc, 0.6); c.lineWidth = 2; for (let i = 0; i < 7; i++) { const xx = e.x + Math.sin(i * 1.7 + e.t * 0.2) * 130, hh = ((e.t * 14 + i * 60) % 300) * k; c.beginPath(); c.moveTo(xx, y - hh); c.lineTo(xx, y - hh - 40); c.stroke(); } }
          else if (out > 0) {
            // 巨大な口が床から閉じる
            const cl = Math.min(1, after / 7), chew = after > 7 ? 0.16 + 0.16 * Math.sin(after * 0.9) : 1 - cl;
            c.globalAlpha = out;
            const rise = Math.min(1, after / 5);
            if (API.has && API.has('kingdom')) {
              const seq = after < 3 ? 0 : after < 6 ? 1 : after < 12 ? 2 : [3, 4, 4, 3, 2][Math.floor((after - 12) / 3) % 5], end = e.t >= e.delay + e.active;
              API.spr(c, 'kingdom', end ? 4 : seq, e.x, y + 4, 1, { glow: rgba(pal.glow, 1), blur: 26, alpha: out });
            } else jawShape(c, e.x, y - 40 - 150 * rise, 200, after < 9 ? 1 - after / 9 * 0.9 : 0.1 + 0.22 * Math.abs(Math.sin(after * 0.55)), pal.glow, false, -Math.PI / 2, pal.acc);
            if (e.t % 2 === 0) pixels(e.x + rr(-100, 100), y - rr(20, 360), 3, pal.acc, 4, 2, 24);
          }
        }
      }
      c.restore();
    }
  }

  const API = root.FIGHT_FX = {
    init, handle, tick, draw, ents, circle, PAL, rgba, sparks, pixels, ring, add,
    get shake() { return shake; }, set shake(v) { shake = v; }, get flash() { return flash; }, set flash(v) { flash = v; },
    get dark() { return dark; }, set darkTo(v) { darkTo = v; }, get time() { return time; },
    set live(v) { live = v; },
    reset() { live = true; P.length = 0; shake = flash = dark = darkTo = 0; }, count: () => P.length,
  };
})(typeof window !== 'undefined' ? window : globalThis);
