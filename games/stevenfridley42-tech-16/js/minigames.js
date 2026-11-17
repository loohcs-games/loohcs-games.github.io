'use strict';
// =====================================================================
//  minigames.js — 読経・瞑想・断食・記憶・書・儀式・漢詩
// =====================================================================
const FONT = '"DotGothic16","Hiragino Kaku Gothic ProN",sans-serif';
const MG = { active: false, onKey: null, onPointer: null, raf: 0 };
const MGW = 900, MGH = 600;

// ---------- 効果音 ----------
let AC = null;
function beep(freq, dur = .12, type = 'sine', vol = .14, delay = 0) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) { }
}
const SFX = {
  mok: () => beep(330, .07, 'square', .07), good: () => { beep(880, .12, 'triangle', .1); }, perfect: () => { beep(988, .1, 'triangle', .1); beep(1318, .2, 'sine', .07, .05); },
  miss: () => beep(150, .15, 'square', .05), bell: () => { beep(523, 1.4, 'sine', .12); beep(1046, 1, 'sine', .04); }, ok: () => beep(660, .08, 'triangle', .08),
  hit: () => { beep(220, .2, 'sawtooth', .07); beep(110, .3, 'square', .05, .05); }, magic: () => { for (let i = 0; i < 5; i++) beep(523 * Math.pow(1.25, i), .18, 'sine', .07, i * .06); },
  step: () => beep(200, .03, 'square', .02)
};

function mgStart(title) {
  document.getElementById('mg').classList.remove('hidden');
  MG.cv = document.getElementById('mgc'); MG.g = MG.cv.getContext('2d'); MG.g.imageSmoothingEnabled = false;
  MG.ui = document.getElementById('mgui'); MG.ui.innerHTML = '';
  MG.active = true; MG.title = title; MG.onKey = null; MG.onPointer = null;
}
function mgEnd() { cancelAnimationFrame(MG.raf); MG.active = false; MG.onKey = null; MG.onPointer = null; MG.ui.innerHTML = ''; document.getElementById('mg').classList.add('hidden'); }
function mgLoop(fn) { let last = performance.now(); const f = t => { if (!MG.active) return; const dt = Math.min(50, t - last); last = t; if (fn(dt, t) !== false) MG.raf = requestAnimationFrame(f); }; MG.raf = requestAnimationFrame(f); }
function txt(g, s, x, y, size, color, align = 'left', stroke) {
  g.font = size + 'px ' + FONT; g.textAlign = align; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = Math.max(3, size / 7); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
function drawSpr(g, c, x, y, sc) { g.imageSmoothingEnabled = false; g.drawImage(c, x | 0, y | 0, c.width * sc, c.height * sc); }
function mgHeader(g, title, sub) {
  g.fillStyle = 'rgba(30,20,10,.55)'; g.fillRect(0, 0, MGW, 50);
  txt(g, title, 20, 26, 26, '#ffe9a8', 'left', '#2b1d12'); if (sub) txt(g, sub, MGW - 20, 26, 17, '#fbf3dc', 'right');
}
function mgButtons(list) {
  MG.ui.innerHTML = '';
  return list.map(b => { const e = document.createElement('button'); e.textContent = b.label; e.disabled = !!b.disabled; e.onclick = ev => { ev.stopPropagation(); b.fn(); }; MG.ui.appendChild(e); return e; });
}
// 結果表示
function mgFinish(drawBg, lines, color = '#ffe9a8') {
  return new Promise(res => {
    const g = MG.g; let t = 0, ready = false;
    mgButtons([]);
    const done = () => { if (!ready) return; mgEnd(); res(); };
    MG.onKey = (k, down) => { if (down && (k === ' ' || k === 'Enter' || k === 'z' || k === 'Escape')) done(); };
    MG.onPointer = (type) => { if (type === 'down') done(); };
    mgLoop(dt => {
      t += dt; if (t > 500) ready = true;
      drawBg && drawBg(dt);
      g.fillStyle = 'rgba(15,10,5,.6)'; g.fillRect(0, 0, MGW, MGH);
      lines.forEach((l, i) => txt(g, l, MGW / 2, 220 + i * 52 - (lines.length - 1) * 10, i === 0 ? 46 : 26, i === 0 ? color : '#fbf3dc', 'center', '#2b1d12'));
      if (ready && (t / 500 | 0) % 2) txt(g, '— クリック / Space で戻る —', MGW / 2, 520, 18, '#d8c8a8', 'center');
    });
  });
}
function paperBg(g) {
  g.fillStyle = '#efe2c2'; g.fillRect(0, 0, MGW, MGH);
  for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? 'rgba(160,120,60,.06)' : 'rgba(255,255,255,.12)'; g.fillRect(h2(i, 1, 2) * MGW, h2(i, 2, 2) * MGH, 3 + h2(i, 3, 2) * 30, 2); }
}
function templeBg(g, t) {
  const gr = g.createLinearGradient(0, 0, 0, MGH); gr.addColorStop(0, '#2a1a12'); gr.addColorStop(1, '#4a2e1a'); g.fillStyle = gr; g.fillRect(0, 0, MGW, MGH);
  for (let x = 40; x < MGW; x += 140) { g.fillStyle = '#5a2a1a'; g.fillRect(x, 60, 22, 420); g.fillStyle = '#7a3a24'; g.fillRect(x + 3, 60, 5, 420); }
  g.fillStyle = '#6a4a2a'; g.fillRect(0, 470, MGW, 130); g.fillStyle = '#7e5a34'; for (let x = 0; x < MGW; x += 60) g.fillRect(x, 470, 2, 130);
  for (const cx of [120, 780]) { g.fillStyle = '#c8a040'; g.fillRect(cx - 6, 380, 12, 90); const fl = Math.sin(t / 90 + cx) * 2; g.fillStyle = '#ffcf50'; g.beginPath(); g.ellipse(cx, 368 + fl, 7, 14, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,200,80,.12)'; g.beginPath(); g.arc(cx, 368, 60, 0, 7); g.fill(); }
}
function playerSpr(dir = 0, f = 0) { return charSprite(kukaiSpec(), dir, f); }

// =====================================================================
// 1) 読経 — リズムゲーム
// =====================================================================
const MANTRA = {
  kokuzo: ['ノウ', 'ボウ', 'ア', 'キャ', 'シャ', 'ギャ', 'ラ', 'バ', 'ヤ', 'オン', 'アリ', 'キャ', 'マリ', 'ボリ', 'ソワカ'],
  komyo: ['オン', 'ア', 'ボ', 'キャ', 'ベイ', 'ロ', 'シャ', 'ノウ', 'マカ', 'ボ', 'ダラ', 'マニ', 'ハン', 'ドマ', 'ジン', 'バラ', 'ハラ', 'バリ', 'タヤ', 'ウン'],
  shingyo: ['ギャ', 'テイ', 'ギャ', 'テイ', 'ハ', 'ラ', 'ギャ', 'テイ', 'ハラ', 'ソウ', 'ギャ', 'テイ', 'ボ', 'ジ', 'ソワ', 'カ']
};
function mgSutra(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '読経');
    const g = MG.g, syl = o.mantra || MANTRA.kokuzo, beat = o.beat || 480;
    const pat = [1, 1, .5, .5, 1, 1, 1, .5, .5, 1];
    const notes = []; let tt = 2200;
    const n = o.count || Math.min(24, syl.length + 8);
    for (let i = 0; i < n; i++) { notes.push({ t: tt, s: syl[i % syl.length], hit: null }); tt += beat * pat[i % pat.length]; }
    const win = 115 + Math.min(55, (S.memory || 0) * .4), HITX = 210, SPD = .32;
    let time = 0, combo = 0, maxc = 0, pops = [], ended = false, pressT = -999;
    const judge = () => {
      pressT = time;
      const nn = notes.find(x => !x.hit && Math.abs(time - x.t) < win * 1.7); if (!nn) { SFX.mok(); return; }
      const d = Math.abs(time - nn.t);
      if (d < win * .5) { nn.hit = 'p'; combo++; SFX.perfect(); pops.push({ s: '良', c: '#ffd84a', t: 0 }); }
      else if (d < win) { nn.hit = 'g'; combo++; SFX.good(); pops.push({ s: '可', c: '#a8e0ff', t: 0 }); }
      else { nn.hit = 'm'; combo = 0; SFX.miss(); pops.push({ s: '乱', c: '#ff8a7a', t: 0 }); }
      maxc = Math.max(maxc, combo);
    };
    MG.onKey = (k, down) => { if (down && (k === ' ' || k === 'Enter' || k === 'z')) judge(); };
    MG.onPointer = type => { if (type === 'down') judge(); };
    mgButtons([{ label: '唱える（Space / クリック）', fn: judge }]);
    const draw = () => {
      templeBg(g, time);
      mgHeader(g, o.title || '読経', '流れてくる真言が円に重なったら Space / クリック');
      g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(0, 250, MGW, 110);
      g.strokeStyle = '#ffd84a'; g.lineWidth = 5; g.beginPath(); g.arc(HITX, 305, 46, 0, 7); g.stroke();
      if (time - pressT < 120) { g.fillStyle = 'rgba(255,220,100,.35)'; g.beginPath(); g.arc(HITX, 305, 50, 0, 7); g.fill(); }
      for (const nn of notes) {
        const x = HITX + (nn.t - time) * SPD; if (x < -60 || x > MGW + 60) continue; if (nn.hit && nn.hit !== 'x') continue;
        g.fillStyle = nn.hit === 'x' ? '#7a6a5a' : '#f6ecd2'; g.beginPath(); g.arc(x, 305, 38, 0, 7); g.fill();
        g.strokeStyle = '#2b1d12'; g.lineWidth = 4; g.stroke();
        txt(g, nn.s, x, 306, nn.s.length > 2 ? 22 : 28, '#2b1d12', 'center');
      }
      drawSpr(g, playerSpr(0, 0), 60, 380, 5);
      pops = pops.filter(p => (p.t += 16) < 600);
      pops.forEach(p => txt(g, p.s, HITX, 220 - p.t / 15, 48, p.c, 'center', '#2b1d12'));
      txt(g, combo + ' 連', 360, 430, 32, '#ffe9a8', 'left', '#2b1d12');
      const done = notes.filter(x => x.hit).length; g.fillStyle = '#3a2a1a'; g.fillRect(360, 470, 480, 14); g.fillStyle = '#e8b040'; g.fillRect(360, 470, 480 * done / notes.length, 14);
      // 煙
      for (let i = 0; i < 6; i++) { const yy = (time / 20 + i * 60) % 300; g.fillStyle = 'rgba(255,255,255,' + (.12 - yy / 3000) + ')'; g.beginPath(); g.arc(450 + Math.sin((time / 400) + i) * 30, 460 - yy, 10 + yy / 12, 0, 7); g.fill(); }
    };
    mgLoop(dt => {
      time += dt;
      for (const nn of notes) if (!nn.hit && time - nn.t > win * 1.2) { nn.hit = 'x'; combo = 0; pops.push({ s: '落', c: '#ff8a7a', t: 0 }); }
      draw();
      if (!ended && time > notes[notes.length - 1].t + 900) {
        ended = true;
        const sc = notes.reduce((a, x) => a + (x.hit === 'p' ? 1 : x.hit === 'g' ? .6 : 0), 0) / notes.length;
        mgFinish(() => draw(), [sc > .85 ? '心身一如！' : sc > .6 ? '良い読経' : sc > .35 ? 'まずまず' : '雑念が多い…', '出来栄え ' + Math.round(sc * 100) + '点　最大 ' + maxc + ' 連']).then(() => res(sc));
        return false;
      }
    });
  });
}

// =====================================================================
// 2) 瞑想 — 心の玉を蓮の枠に保つ
// =====================================================================
function mgMeditate(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '瞑想');
    const g = MG.g, diff = o.diff || 1, LIM = o.time || 22000;
    let m = .5, v = 0, hold = false, time = 0, prog = 0, ended = false;
    const zh = .11 + Math.min(.06, (S.horiki || 0) / 1500) - (diff - 1) * .015;
    const thoughts = ['空腹', '眠気', '寒さ', '名声', '故郷', '不安', '欲', '怒り', '迷い'];
    const bubbles = [];
    MG.onKey = (k, down) => { if (k === ' ' || k === 'Enter' || k === 'z') hold = down; };
    MG.onPointer = type => { if (type === 'down') hold = true; if (type === 'up') hold = false; };
    mgButtons([]);
    const zoneC = t => .5 + .28 * Math.sin(t * .0007 * diff) + .12 * Math.sin(t * .0019 * diff + 1);
    const draw = () => {
      const gr = g.createLinearGradient(0, 0, 0, MGH); gr.addColorStop(0, '#0e1430'); gr.addColorStop(1, '#3a2a4a'); g.fillStyle = gr; g.fillRect(0, 0, MGW, MGH);
      for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,' + (.3 + .5 * Math.abs(Math.sin(time / 700 + i))) + ')'; g.fillRect(h2(i, 9, 1) * MGW, h2(i, 8, 1) * 380, 2, 2); }
      const sx = 760, sy = 110 + prog * 0; g.fillStyle = 'rgba(255,250,220,' + (.3 + prog * .7) + ')'; g.beginPath(); g.arc(sx, sy, 6 + prog * 10, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,240,180,' + prog * .25 + ')'; g.beginPath(); g.arc(sx, sy, 50 * prog + 10, 0, 7); g.fill();
      g.fillStyle = '#1a1424'; g.fillRect(0, 470, MGW, 130);
      g.fillStyle = 'rgba(255,220,120,' + (.08 + prog * .3) + ')'; g.beginPath(); g.arc(330, 400, 90 + prog * 60 + Math.sin(time / 300) * 5, 0, 7); g.fill();
      drawSpr(g, playerSpr(0, 0), 330 - 48, 400 - 100, 6);
      for (const b of bubbles) { g.fillStyle = 'rgba(200,180,255,' + b.a + ')'; g.beginPath(); g.arc(b.x, b.y, 32, 0, 7); g.fill(); txt(g, b.s, b.x, b.y, 20, 'rgba(40,20,60,' + b.a + ')', 'center'); }
      const GX = 640, GY = 80, GH = 440;
      g.fillStyle = '#2a2040'; g.fillRect(GX - 4, GY - 4, 68, GH + 8); g.fillStyle = '#4a3a6a'; g.fillRect(GX, GY, 60, GH);
      const zc = zoneC(time);
      g.fillStyle = '#f4a8c8'; g.fillRect(GX, GY + (zc - zh) * GH, 60, zh * 2 * GH); txt(g, '蓮', GX + 30, GY + zc * GH, 22, '#7a2a4a', 'center');
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(GX + 30, GY + m * GH, 13, 0, 7); g.fill(); g.strokeStyle = '#2b1d12'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#2a2040'; g.fillRect(740, 80, 28, 440); g.fillStyle = '#ffd84a'; g.fillRect(744, 80 + 440 * (1 - prog), 20, 440 * prog);
      txt(g, '悟', 754, 60, 22, '#ffe9a8', 'center');
      mgHeader(g, o.title || '瞑想', 'Space / マウスを押し続けると心の玉が浮く。蓮の枠に保て');
      txt(g, '残り ' + Math.max(0, Math.ceil((LIM - time) / 1000)) + ' 秒', 30, 80, 20, '#d8c8f0');
    };
    mgLoop(dt => {
      time += dt;
      v += (hold ? -0.0000055 : 0.0000032) * dt * (1 + diff * .15); v = Math.max(-.0011, Math.min(.0011, v)); m += v * dt;
      if (m < 0) { m = 0; v = 0; } if (m > 1) { m = 1; v = 0; }
      const zc = zoneC(time), inz = Math.abs(m - zc) < zh;
      prog = Math.max(0, Math.min(1, prog + (inz ? dt / 9000 : -dt / 32000)));
      if (Math.random() < dt / 900) bubbles.push({ x: 120 + Math.random() * 420, y: 480, s: thoughts[(Math.random() * thoughts.length) | 0], a: .7 });
      for (const b of bubbles) { b.y -= dt * .05; b.a -= dt / 7000; }
      while (bubbles.length && bubbles[0].a <= 0) bubbles.shift();
      draw();
      if (!ended && (prog >= 1 || time > LIM)) {
        ended = true; const sc = prog >= 1 ? 1 : prog;
        if (sc >= 1) SFX.bell();
        mgFinish(draw, [sc >= 1 ? '心、澄みわたる' : sc > .6 ? '静かな心' : '雑念に乱された', '到達 ' + Math.round(sc * 100) + '%']).then(() => res(sc));
        return false;
      }
    });
  });
}

// =====================================================================
// 3) 断食 — 誘惑に耐える
// =====================================================================
function mgFast(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '断食行');
    const g = MG.g, rounds = o.rounds || 7;
    const temps = ['炊きたての飯の香りがする…', '眠気が襲ってくる…', '里祭りの太鼓が聞こえる…', '冷たい雨が降り始めた…', '空腹で目が回る…', '母の顔が浮かぶ…', '甘い干し柿を思い出す…', '体が凍えるようだ…', '「もうやめよ」と心がささやく…'];
    const ARR = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], SYM = ['↑', '→', '↓', '←'];
    let r = 0, seq = [], pos = 0, lim = 0, t = 0, ok = 0, phase = 'show', msg = '', time = 0, ended = false, flash = 0;
    const next = () => { if (r >= rounds) return finish(); seq = []; const n = 3 + Math.min(3, r >> 1); for (let i = 0; i < n; i++) seq.push((Math.random() * 4) | 0); pos = 0; lim = Math.max(2600, 4400 - r * 200); t = 0; phase = 'in'; msg = temps[(Math.random() * temps.length) | 0]; };
    const input = d => {
      if (phase !== 'in') return;
      if (d === seq[pos]) { pos++; SFX.ok(); if (pos >= seq.length) { ok++; r++; phase = 'res'; msg = '耐えた！'; flash = 1; t = 0; SFX.good(); } }
      else { r++; phase = 'res'; msg = '心が揺らいだ…'; t = 0; SFX.miss(); }
    };
    const finish = () => {
      ended = true; const sc = ok / rounds;
      mgFinish(draw, [sc > .8 ? '断食満行' : sc > .5 ? 'なんとか耐えた' : '誘惑に負けた…', rounds + '日のうち ' + ok + '日を耐え抜いた']).then(() => res(sc));
    };
    MG.onKey = (k, down) => { if (!down) return; const i = ARR.indexOf(k); if (i >= 0) input(i); const j = ['w', 'd', 's', 'a'].indexOf(k); if (j >= 0) input(j); };
    mgButtons(SYM.map((s, i) => ({ label: s, fn: () => input(i) })));
    const draw = () => {
      const gr = g.createLinearGradient(0, 0, 0, MGH); gr.addColorStop(0, '#2a2a34'); gr.addColorStop(1, '#16141a'); g.fillStyle = gr; g.fillRect(0, 0, MGW, MGH);
      g.fillStyle = '#3a342e'; g.beginPath(); g.ellipse(450, 640, 560, 260, 0, 0, 7); g.fill();
      drawSpr(g, playerSpr(0, 0), 450 - 40, 330, 5);
      mgHeader(g, o.title || '断食行', '表示された矢印を順に入力して誘惑に耐えよ（矢印キー / WASD / ボタン）');
      txt(g, (Math.min(r + 1, rounds)) + ' 日目 / ' + rounds + ' 日', 30, 80, 22, '#fbf3dc');
      txt(g, msg, 450, 150, 30, phase === 'res' ? (msg === '耐えた！' ? '#ffe070' : '#ff9a8a') : '#e8d8ff', 'center', '#000');
      if (phase === 'in') {
        seq.forEach((d, i) => { const x = 450 + (i - (seq.length - 1) / 2) * 70; g.fillStyle = i < pos ? '#ffd84a' : '#f6ecd2'; g.fillRect(x - 28, 200, 56, 56); g.strokeStyle = '#2b1d12'; g.lineWidth = 4; g.strokeRect(x - 28, 200, 56, 56); txt(g, SYM[d], x, 230, 36, '#2b1d12', 'center'); });
        g.fillStyle = '#4a3a3a'; g.fillRect(250, 280, 400, 12); g.fillStyle = '#e86a4a'; g.fillRect(250, 280, 400 * (1 - t / lim), 12);
      }
      if (flash > 0) { g.fillStyle = 'rgba(255,240,180,' + flash * .3 + ')'; g.fillRect(0, 0, MGW, MGH); }
    };
    next();
    mgLoop(dt => {
      time += dt; t += dt; flash = Math.max(0, flash - dt / 400);
      if (phase === 'in' && t > lim) { r++; phase = 'res'; msg = '心が揺らいだ…'; t = 0; SFX.miss(); }
      if (phase === 'res' && t > 900) { if (r >= rounds) { if (!ended) finish(); } else next(); }
      if (!ended) draw();
      return !ended;
    });
  });
}

// =====================================================================
// 4) 記憶 — 経典・梵字の暗記
// =====================================================================
const MEMSETS = {
  rongo: ['学而', '仁', '義', '礼', '智', '信', '孝', '悌', '忠', '恕', '君子', '中庸'],
  kyo: ['尚書', '周易', '毛詩', '礼記', '春秋', '孝経', '論語', '文選', '史記', '漢書', '老子', '荘子'],
  sutra: ['般若', '華厳', '法華', '涅槃', '大日', '金剛頂', '理趣', '維摩', '阿含', '倶舎', '唯識', '戒律'],
  bonji: ['ア', 'バン', 'ウン', 'タラーク', 'キリーク', 'アク', 'カン', 'マン', 'サ', 'ボロン', 'ユ', 'バク'],
  kanji: ['山', '川', '日', '月', '天', '人', '大', '心', '水', '金', '王', '口']
};
function mgMemory(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '暗記');
    const g = MG.g, set = MEMSETS[o.set || 'kyo'], rounds = o.rounds || 2;
    const n0 = o.n || (3 + Math.min(2, ((S.memory || 0) / 40) | 0));
    let round = 0, phase = 'show', seq = [], grid = [], idx = 0, t = 0, correct = 0, total = 0, msg = '', ended = false, picked = [];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
    const start = () => { const n = n0 + round; seq = shuffle(set.slice()).slice(0, n); grid = shuffle(shuffle(set.slice()).filter(x => !seq.includes(x)).slice(0, 9 - n).concat(seq)); idx = 0; t = 0; phase = 'show'; picked = []; total += n; };
    const cell = i => ({ x: 270 + (i % 3) * 130, y: 170 + ((i / 3) | 0) * 110 });
    const choose = i => {
      if (phase !== 'pick' || picked.includes(i)) return;
      if (grid[i] === seq[idx]) { picked.push(i); idx++; correct++; SFX.ok(); if (idx >= seq.length) { phase = 'res'; msg = '見事に覚えた！'; t = 0; SFX.good(); } }
      else { phase = 'res'; msg = '違う…正しくは「' + seq.slice(idx).join('・') + '」'; t = 0; SFX.miss(); }
    };
    MG.onKey = (k, down) => { if (!down) return; const n = parseInt(k); if (n >= 1 && n <= 9) choose(n - 1); };
    MG.onPointer = (type, x, y) => { if (type !== 'down') return; grid.forEach((_, i) => { const c = cell(i); if (Math.abs(x - c.x - 55) < 58 && Math.abs(y - c.y - 45) < 48) choose(i); }); };
    mgButtons([]);
    const draw = () => {
      paperBg(g); mgHeader(g, o.title || '暗記', '表示される順番を覚え、同じ順にクリック（または1〜9キー）');
      txt(g, '第' + (round + 1) + '問 / ' + rounds, 30, 80, 20, '#5a4030');
      drawSpr(g, playerSpr(0, 0), 60, 380, 5);
      if (phase === 'show') {
        const per = 1000, i = Math.min(seq.length - 1, (t / per) | 0);
        txt(g, (i + 1) + ' / ' + seq.length, 450, 140, 22, '#7a5a3a', 'center');
        g.fillStyle = '#fffaf0'; g.fillRect(330, 190, 240, 220); g.strokeStyle = '#2b1d12'; g.lineWidth = 5; g.strokeRect(330, 190, 240, 220);
        if ((t % per) < per - 150) txt(g, seq[i], 450, 300, seq[i].length > 2 ? 54 : 86, '#2b1d12', 'center');
      } else {
        grid.forEach((w, i) => { const c = cell(i), p = picked.indexOf(i); g.fillStyle = p >= 0 ? '#ffd978' : '#fffaf0'; g.fillRect(c.x, c.y, 110, 90); g.strokeStyle = '#2b1d12'; g.lineWidth = 4; g.strokeRect(c.x, c.y, 110, 90); txt(g, w, c.x + 55, c.y + 47, w.length > 2 ? 26 : 38, '#2b1d12', 'center'); txt(g, String(i + 1), c.x + 10, c.y + 12, 14, '#9a7a5a'); if (p >= 0) txt(g, String(p + 1), c.x + 98, c.y + 14, 16, '#b8392b', 'center'); });
        if (phase === 'res') txt(g, msg, 450, 530, 24, '#b8392b', 'center');
      }
    };
    start();
    mgLoop(dt => {
      t += dt;
      if (phase === 'show' && t > seq.length * 1000) { phase = 'pick'; t = 0; }
      if (phase === 'res' && t > 1600) { round++; if (round >= rounds) { ended = true; const sc = correct / total; mgFinish(draw, [sc > .85 ? '一字一句、忘れず' : sc > .5 ? 'よく覚えた' : 'まだまだ…', '正答 ' + correct + ' / ' + total]).then(() => res(sc)); return false; } start(); }
      draw();
    });
  });
}

// =====================================================================
// 5) 書 — なぞり書き
// =====================================================================
const STROKES = {
  '一': [[[12, 52], [50, 49], [88, 52]]],
  '二': [[[28, 34], [72, 33]], [[12, 70], [50, 68], [88, 70]]],
  '三': [[[24, 22], [76, 21]], [[30, 50], [70, 49]], [[12, 80], [50, 78], [88, 80]]],
  '十': [[[12, 45], [88, 45]], [[50, 10], [50, 92]]],
  '人': [[[52, 10], [48, 45], [32, 72], [12, 90]], [[48, 48], [66, 72], [90, 90]]],
  '大': [[[12, 38], [88, 38]], [[50, 8], [48, 45], [32, 72], [12, 90]], [[50, 48], [68, 72], [90, 90]]],
  '天': [[[22, 22], [78, 22]], [[12, 48], [88, 48]], [[50, 8], [48, 52], [30, 76], [12, 92]], [[52, 54], [70, 76], [90, 92]]],
  '山': [[[50, 10], [50, 82]], [[18, 36], [18, 84], [82, 84]], [[82, 36], [82, 84]]],
  '川': [[[22, 12], [22, 50], [12, 90]], [[50, 20], [50, 80]], [[80, 10], [80, 92]]],
  '口': [[[20, 22], [20, 84]], [[20, 22], [80, 22], [80, 84]], [[20, 82], [80, 82]]],
  '日': [[[24, 12], [24, 90]], [[24, 12], [76, 12], [76, 90]], [[24, 50], [76, 50]], [[24, 88], [76, 88]]],
  '月': [[[28, 10], [28, 60], [14, 92]], [[28, 10], [74, 10], [74, 90], [64, 84]], [[28, 36], [74, 36]], [[28, 60], [74, 60]]],
  '心': [[[18, 52], [12, 72]], [[34, 38], [36, 80], [50, 88], [78, 86], [80, 74]], [[54, 28], [64, 46]], [[80, 40], [90, 58]]],
  '王': [[[20, 16], [80, 16]], [[24, 50], [76, 50]], [[50, 16], [50, 86]], [[12, 86], [88, 86]]],
  '水': [[[50, 6], [50, 90], [42, 84]], [[14, 34], [38, 34], [16, 72]], [[80, 22], [56, 44]], [[54, 44], [88, 88]]],
  '空': [[[50, 6], [53, 14]], [[18, 20], [16, 32]], [[18, 20], [82, 20], [78, 32]], [[42, 34], [30, 48]], [[58, 34], [72, 48]], [[28, 60], [72, 60]], [[50, 60], [50, 86]], [[14, 88], [86, 88]]],
  '言': [[[46, 6], [54, 14]], [[14, 24], [86, 24]], [[28, 40], [72, 40]], [[28, 54], [72, 54]], [[26, 68], [26, 92]], [[26, 68], [74, 68], [74, 92]], [[26, 90], [74, 90]]],
  '金': [[[50, 6], [10, 44]], [[50, 6], [90, 44]], [[30, 42], [70, 42]], [[24, 58], [76, 58]], [[50, 42], [50, 86]], [[32, 70], [38, 80]], [[68, 70], [62, 80]], [[12, 88], [88, 88]]],
  '法': [[[12, 14], [22, 22]], [[8, 40], [20, 48]], [[8, 86], [24, 66]], [[34, 28], [88, 28]], [[60, 10], [60, 52]], [[30, 52], [90, 52]], [[56, 56], [38, 86], [82, 82]], [[74, 70], [88, 88]]],
  '仏': [[[34, 8], [12, 50]], [[24, 34], [24, 92]], [[56, 14], [40, 68], [84, 64]], [[74, 48], [88, 72]]],
  '雨': [[[18, 12], [82, 12]], [[18, 30], [18, 90]], [[18, 30], [82, 30], [82, 90], [72, 86]], [[50, 12], [50, 82]], [[30, 46], [38, 54]], [[30, 66], [38, 74]], [[62, 46], [70, 54]], [[62, 66], [70, 74]]]
};
function resample(pts, n) {
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1, out = [];
  for (let k = 0; k < n; k++) { const tgt = L * k / (n - 1); let i = 1; while (i < d.length - 1 && d[i] < tgt) i++; const seg = (d[i] - d[i - 1]) || 1, u = Math.max(0, Math.min(1, (tgt - d[i - 1]) / seg)); out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]); }
  return out;
}
function mgCalligraphy(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '書');
    const g = MG.g, chars = o.chars || ['山'], PX = 300, PY = 100, PS = 420;
    const useInk = S.items.ink > 0; if (useInk) S.items.ink--;
    const tol = 42 + Math.min(30, (S.bun || 0) * .3) + (useInk ? 12 : 0);
    let ci = 0, si = 0, cur = null, scores = [], charScores = [], time = 0, phase = 'draw', t = 0, ended = false;
    const [inkC, ink] = mk(PS, PS); ink.lineCap = 'round'; ink.lineJoin = 'round';
    const toP = p => [PX + p[0] / 100 * PS, PY + p[1] / 100 * PS];
    const strokes = () => STROKES[chars[ci]];
    const resetChar = () => { ink.clearRect(0, 0, PS, PS); si = 0; scores = []; phase = 'draw'; };
    MG.onPointer = (type, x, y) => {
      if (phase !== 'draw') return;
      if (type === 'down') { cur = [[x, y, performance.now()]]; }
      else if (type === 'move' && cur) {
        const l = cur[cur.length - 1], d = Math.hypot(x - l[0], y - l[1]); if (d < 2) return;
        const now = performance.now(), sp = d / Math.max(1, now - l[2]);
        const w = Math.max(7, Math.min(30, 30 - sp * 9));
        ink.strokeStyle = 'rgba(20,14,10,.92)'; ink.lineWidth = w; ink.beginPath(); ink.moveTo(l[0] - PX, l[1] - PY); ink.lineTo(x - PX, y - PY); ink.stroke();
        cur.push([x, y, now]);
      } else if (type === 'up' && cur) {
        const pts = cur.map(p => [p[0], p[1]]); cur = null;
        let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (len < 12) return;
        const gpts = resample(strokes()[si].map(toP), 24), upts = resample(pts, 24);
        let md = 0; for (let i = 0; i < 24; i++) md += Math.hypot(gpts[i][0] - upts[i][0], gpts[i][1] - upts[i][1]); md /= 24;
        const sc = Math.max(0, Math.min(1, 1 - (md - 10) / tol));
        scores.push(sc); sc > .7 ? SFX.good() : sc > .4 ? SFX.ok() : SFX.miss();
        si++;
        if (si >= strokes().length) { const cs = scores.reduce((a, b) => a + b, 0) / scores.length; charScores.push(cs); phase = 'char'; t = 0; }
      }
    };
    MG.onKey = (k, down) => { if (down && (k === 'r' || k === 'R')) resetChar(); };
    mgButtons([{ label: 'この字を書き直す (R)', fn: () => { if (phase === 'draw') resetChar(); } }]);
    const grade = s => s >= .88 ? '神品' : s >= .74 ? '妙品' : s >= .55 ? '能品' : '凡品';
    const draw = () => {
      paperBg(g);
      mgHeader(g, o.title || '書', '赤い点から、筆順どおりになぞって書く（マウス / タッチ）');
      g.fillStyle = '#3a2a1a'; g.fillRect(PX - 14, PY - 14, PS + 28, PS + 28);
      g.fillStyle = '#fbf6ea'; g.fillRect(PX, PY, PS, PS);
      g.strokeStyle = 'rgba(200,80,60,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(PX + PS / 2, PY); g.lineTo(PX + PS / 2, PY + PS); g.moveTo(PX, PY + PS / 2); g.lineTo(PX + PS, PY + PS / 2); g.stroke();
      if (phase === 'draw') {
        g.lineCap = 'round'; g.lineJoin = 'round';
        strokes().forEach((st, i) => { if (i < si) return; const p = st.map(toP); g.strokeStyle = i === si ? 'rgba(90,80,70,.38)' : 'rgba(160,150,140,.16)'; g.lineWidth = 26; g.beginPath(); g.moveTo(p[0][0], p[0][1]); p.slice(1).forEach(q => g.lineTo(q[0], q[1])); g.stroke(); });
        const p = strokes()[si].map(toP); g.fillStyle = '#d0402c'; g.beginPath(); g.arc(p[0][0], p[0][1], 9 + Math.sin(time / 150) * 2, 0, 7); g.fill();
        const a = p[p.length - 1], b = p[p.length - 2]; const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
        g.fillStyle = 'rgba(208,64,44,.7)'; g.beginPath(); g.moveTo(a[0] + Math.cos(ang) * 14, a[1] + Math.sin(ang) * 14); g.lineTo(a[0] + Math.cos(ang + 2.5) * 12, a[1] + Math.sin(ang + 2.5) * 12); g.lineTo(a[0] + Math.cos(ang - 2.5) * 12, a[1] + Math.sin(ang - 2.5) * 12); g.fill();
        txt(g, (si + 1) + ' 画目 / ' + strokes().length, PX + PS + 30, PY + 20, 20, '#5a4030');
      }
      g.drawImage(inkC, PX, PY);
      if (phase === 'char') { txt(g, grade(charScores[charScores.length - 1]), PX + PS / 2, PY + PS / 2, 80, 'rgba(200,50,40,.85)', 'center', '#fff'); }
      // 左パネル
      txt(g, o.doc || '', 40, 90, 22, '#b8392b');
      chars.forEach((c, i) => { const y = 140 + i * 70; g.fillStyle = i === ci ? '#ffd978' : '#fffaf0'; g.fillRect(40, y, 60, 60); g.strokeStyle = '#2b1d12'; g.lineWidth = 3; g.strokeRect(40, y, 60, 60); txt(g, c, 70, y + 32, 38, '#2b1d12', 'center'); if (charScores[i] != null) txt(g, grade(charScores[i]), 160, y + 30, 22, '#b8392b', 'center'); });
      txt(g, '文才 ' + (S.bun | 0) + (useInk ? '　上質な墨 使用中' : ''), PX + PS + 30, PY + 60, 17, '#5a4030');
      drawSpr(g, playerSpr(0, 0), PX + PS + 60, 400, 5);
    };
    mgLoop(dt => {
      time += dt; t += dt;
      if (phase === 'char' && t > 1100) {
        ci++;
        if (ci >= chars.length) {
          ended = true; const sc = charScores.reduce((a, b) => a + b, 0) / charScores.length;
          mgFinish(draw, [grade(sc), '書の出来栄え ' + Math.round(sc * 100) + '点'], sc >= .74 ? '#ffd84a' : '#fbf3dc').then(() => res(sc));
          return false;
        }
        resetChar();
      }
      draw();
    });
  });
}

// =====================================================================
// 6) 儀式 — 印と真言のコマンドバトル
// =====================================================================
const MUDRA = [{ n: '智拳印', k: '↑' }, { n: '施無畏印', k: '→' }, { n: '法界定印', k: '↓' }, { n: '与願印', k: '←' }];
const ENEMIES = {
  drought: { name: '旱魃の龍気', bg: ['#e8a040', '#f6d080'], ground: '#c89a5a' },
  storm: { name: '大嵐', bg: ['#1a2030', '#3a4a5a'], ground: '#2a4a6a' },
  plague: { name: '疫鬼', bg: ['#2a2038', '#4a3a52'], ground: '#3a3040' },
  onryo: { name: '国難の怨念', bg: ['#101828', '#2a2a48'], ground: '#1a1a2a' },
  bonno: { name: '煩悩の闇', bg: ['#1a0e20', '#3a1e40'], ground: '#2a1a2a' }
};
function drawEnemy(g, type, t, hurt) {
  const cx = 450, cy = 255, sh2 = hurt > 0 ? (Math.random() - .5) * 14 : 0;
  g.save(); g.translate(sh2, 0);
  if (type === 'drought') {
    for (let i = 14; i >= 0; i--) { const x = cx - 200 + i * 28, y = cy + Math.sin(t / 300 + i * .6) * 40; g.fillStyle = i % 2 ? '#d84a2a' : '#e86a3a'; g.beginPath(); g.arc(x, y, 34 - i * 1.4, 0, 7); g.fill(); g.fillStyle = '#f8c050'; g.beginPath(); g.arc(x, y + 14, 12 - i * .5, 0, 7); g.fill(); }
    const hx2 = cx - 210, hy = cy + Math.sin(t / 300) * 40; g.fillStyle = '#c83a20'; g.beginPath(); g.ellipse(hx2, hy, 58, 42, 0, 0, 7); g.fill();
    g.fillStyle = '#f8e070'; g.beginPath(); g.moveTo(hx2 - 10, hy - 36); g.lineTo(hx2 - 40, hy - 90); g.lineTo(hx2 - 2, hy - 40); g.fill(); g.beginPath(); g.moveTo(hx2 + 20, hy - 36); g.lineTo(hx2 + 40, hy - 90); g.lineTo(hx2 + 30, hy - 34); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx2 - 18, hy - 8, 11, 0, 7); g.arc(hx2 + 16, hy - 8, 11, 0, 7); g.fill(); g.fillStyle = '#c00'; g.beginPath(); g.arc(hx2 - 18, hy - 8, 5, 0, 7); g.arc(hx2 + 16, hy - 8, 5, 0, 7); g.fill();
    g.strokeStyle = '#f8e070'; g.lineWidth = 4; g.beginPath(); g.moveTo(hx2 - 50, hy + 10); g.quadraticCurveTo(hx2 - 110, hy + 30 + Math.sin(t / 200) * 20, hx2 - 140, hy - 10); g.stroke();
  } else if (type === 'storm') {
    for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#3a4458' : '#4a5468'; g.beginPath(); g.arc(cx - 220 + i * 75, cy - 20 + Math.sin(t / 500 + i) * 15, 70, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 60, cy - 10, 16, 0, 7); g.arc(cx + 60, cy - 10, 16, 0, 7); g.fill(); g.fillStyle = '#ff3'; g.beginPath(); g.arc(cx - 60, cy - 10, 7, 0, 7); g.arc(cx + 60, cy - 10, 7, 0, 7); g.fill();
    if ((t / 120 | 0) % 9 === 0) { g.strokeStyle = '#fff8a0'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx + 120, cy + 40); g.lineTo(cx + 90, cy + 120); g.lineTo(cx + 130, cy + 120); g.lineTo(cx + 80, cy + 230); g.stroke(); }
  } else if (type === 'plague') {
    g.fillStyle = '#6a3a8a'; g.beginPath(); g.ellipse(cx, cy + 20 + Math.sin(t / 250) * 8, 120, 110, 0, 0, 7); g.fill();
    g.fillStyle = '#e8e0b0'; g.beginPath(); g.moveTo(cx - 50, cy - 70); g.lineTo(cx - 70, cy - 140); g.lineTo(cx - 25, cy - 80); g.fill(); g.beginPath(); g.moveTo(cx + 50, cy - 70); g.lineTo(cx + 70, cy - 140); g.lineTo(cx + 25, cy - 80); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 40, cy, 22, 0, 7); g.arc(cx + 40, cy, 22, 0, 7); g.fill(); g.fillStyle = '#3a0'; g.beginPath(); g.arc(cx - 40, cy + 4, 9, 0, 7); g.arc(cx + 40, cy + 4, 9, 0, 7); g.fill();
    g.fillStyle = '#2a0a2a'; g.fillRect(cx - 50, cy + 50, 100, 22); g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(cx - 48 + i * 20, cy + 50); g.lineTo(cx - 38 + i * 20, cy + 64); g.lineTo(cx - 28 + i * 20, cy + 50); g.fill(); }
  } else {
    const n = type === 'bonno' ? 9 : 6;
    for (let i = 0; i < n; i++) { const a = t / 900 + i * Math.PI * 2 / n, r = 120 + Math.sin(t / 400 + i) * 20; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .6; g.fillStyle = type === 'bonno' ? 'rgba(160,60,200,.75)' : 'rgba(80,160,255,.75)'; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 20, y); g.quadraticCurveTo(x, y - 70, x + 4, y - 50); g.quadraticCurveTo(x + 20, y - 20, x + 20, y); g.fill(); g.fillStyle = '#fff'; g.fillRect(x - 10, y - 4, 6, 8); g.fillRect(x + 4, y - 4, 6, 8); }
    g.fillStyle = type === 'bonno' ? '#2a0a30' : '#0a1a3a'; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill(); g.fillStyle = '#f33'; g.beginPath(); g.arc(cx - 22, cy - 6, 9, 0, 7); g.arc(cx + 22, cy - 6, 9, 0, 7); g.fill();
  }
  if (hurt > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,200,' + hurt * .5 + ')'; g.beginPath(); g.arc(cx, cy, 200, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; }
  g.restore();
}
function mgRitual(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '修法');
    const g = MG.g, E = ENEMIES[o.enemy || 'plague'];
    const emax = o.hp || 120, atk = o.atk || 12, maxMp = 40 + Math.round((S.horiki || 0) * .6);
    let ehp = emax, hope = 100, mp = maxMp, seal = 0, guard = 0, turn = 0, phase = 'cmd', log = E.name + 'が現れた！ ' + (o.intro || ''), t = 0, time = 0, hurt = 0, phurt = 0, glyphs = [], ended = false;
    let mseq = [], mpos = 0, mlim = 0; const SLOW = 1.15;
    const SYM = ['↑', '→', '↓', '←'];
    const btns = () => {
      if (phase !== 'cmd') { mgButtons([]); return; }
      mgButtons([
        { label: '印を結ぶ', fn: () => { phase = 'mudra'; mseq = []; for (let i = 0; i < 3 + seal; i++) mseq.push((Math.random() * 4) | 0); mpos = 0; mlim = (4200 - seal * 300) * SLOW; t = 0; btns(); } },
        { label: '真言を唱える（法力12）', disabled: mp < 12, fn: () => act('mantra') },
        { label: '護摩を焚く（法力10）', disabled: mp < 10, fn: () => act('goma') },
        { label: '瞑想（法力回復）', fn: () => act('med') },
        { label: '香を焚く（残' + (S.items.incense || 0) + '）', disabled: !(S.items.incense > 0), fn: () => act('incense') }
      ]);
      // 押し下げ中のボタンの文言はDOM上で
    };
    const mantraTxt = (o.mantra || MANTRA.komyo);
    const act = a => {
      if (a === 'mantra') {
        mp -= 12; const dmg = Math.round((14 + (S.horiki || 0) * .5) * (1 + seal * .7) * (.9 + Math.random() * .2));
        ehp = Math.max(0, ehp - dmg); hurt = 1; SFX.magic(); log = '真言を唱えた！　' + (seal ? '（印 ×' + seal + '）' : '') + E.name + 'に ' + dmg + ' の功徳！'; seal = 0;
        for (let i = 0; i < 8; i++) glyphs.push({ s: mantraTxt[(Math.random() * mantraTxt.length) | 0], x: 200 + Math.random() * 500, y: 520, v: .15 + Math.random() * .15, a: 1 });
      } else if (a === 'goma') { mp -= 10; hope = Math.min(100, hope + 22); guard = 2; SFX.good(); log = '護摩の炎が人々を励ます。民の希望が回復し、守りが固まった。'; }
      else if (a === 'med') { const r = 18 + Math.round((S.horiki || 0) * .15); mp = Math.min(maxMp, mp + r); SFX.bell(); log = '静かに瞑想し、法力が ' + r + ' 回復した。'; }
      else if (a === 'incense') { S.items.incense--; mp = maxMp; seal = Math.min(4, seal + 1); SFX.magic(); log = '香を焚いた。法力が満ち、印が一段深まった。'; }
      phase = 'wait'; t = 0; btns();
    };
    const mudraIn = d => {
      if (phase !== 'mudra') return;
      if (d === mseq[mpos]) { mpos++; SFX.ok(); if (mpos >= mseq.length) { seal = Math.min(4, seal + 1); log = MUDRA[mseq[mseq.length - 1]].n + 'を結んだ！　印の力 ×' + seal + '（次の真言が強まる）'; SFX.perfect(); phase = 'wait'; t = 0; } }
      else { log = '印が乱れた…'; SFX.miss(); phase = 'wait'; t = 0; }
    };
    MG.onKey = (k, down) => { if (!down) return; const i = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(k); const j = ['w', 'd', 's', 'a'].indexOf(k); if (i >= 0) mudraIn(i); else if (j >= 0) mudraIn(j); };
    MG.onPointer = (type, x, y) => { if (type !== 'down' || phase !== 'mudra') return; for (let i = 0; i < 4; i++) { const bx = 270 + i * 100; if (x > bx && x < bx + 80 && y > 420 && y < 500) mudraIn(i); } };
    const enemyTurn = () => {
      turn++;
      let dmg = Math.round(atk * (.8 + Math.random() * .4)); let special = turn % 3 === 0;
      if (special) { dmg = Math.round(dmg * 1.5); seal = Math.max(0, seal - 1); }
      if (guard > 0) { dmg = Math.round(dmg / 2); guard--; }
      hope = Math.max(0, hope - dmg); phurt = 1; SFX.hit();
      log = (special ? E.name + 'の猛威！　印が乱される！ ' : E.name + 'が人々を苦しめる。') + '民の希望 -' + dmg;
    };
    const draw = () => {
      const gr = g.createLinearGradient(0, 0, 0, MGH); gr.addColorStop(0, E.bg[0]); gr.addColorStop(1, E.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, MGW, MGH);
      g.fillStyle = E.ground; g.fillRect(0, 400, MGW, 200);
      if (o.enemy === 'drought') { g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = 2; for (let i = 0; i < 18; i++) { g.beginPath(); const x = h2(i, 1, 4) * MGW, y = 420 + h2(i, 2, 4) * 170; g.moveTo(x, y); g.lineTo(x + 30, y + 10); g.lineTo(x + 40, y - 8); g.stroke(); } }
      drawEnemy(g, o.enemy, time, hurt);
      // 祭壇と空海
      g.fillStyle = '#7a3a24'; g.fillRect(600, 430, 180, 34); g.fillStyle = '#e8a030'; g.fillRect(670, 402, 40, 28);
      const fl = 1 + Math.sin(time / 80) * .15; g.fillStyle = 'rgba(255,140,40,.9)'; g.beginPath(); g.ellipse(690, 392, 18 * fl, 30 * fl, 0, 0, 7); g.fill(); g.fillStyle = '#ffe070'; g.beginPath(); g.ellipse(690, 400, 9, 16, 0, 0, 7); g.fill();
      drawSpr(g, playerSpr(1, 0), 560 - (phurt > 0 ? (Math.random() * 8) : 0), 380, 4);
      for (const gl of glyphs) { txt(g, gl.s, gl.x, gl.y, 30, 'rgba(255,230,120,' + gl.a + ')', 'center', 'rgba(80,40,0,' + gl.a + ')'); }
      mgHeader(g, o.title || '修法', '印を結んで力を溜め、真言で' + E.name + 'を鎮めよ');
      // バー
      const bar = (x, y, w, v, c, label) => { g.fillStyle = '#1a1208'; g.fillRect(x - 3, y - 3, w + 6, 22); g.fillStyle = '#4a3a2a'; g.fillRect(x, y, w, 16); g.fillStyle = c; g.fillRect(x, y, w * v, 16); txt(g, label, x, y - 14, 16, '#fbf3dc', 'left', '#000'); };
      bar(250, 80, 400, ehp / emax, '#c84a6a', E.name + '  ' + ehp + ' / ' + emax);
      bar(30, 320, 220, hope / 100, '#6ac86a', '民の希望 ' + hope);
      bar(30, 370, 220, mp / maxMp, '#5a9ae8', '法力 ' + mp + ' / ' + maxMp);
      txt(g, '印の力 ' + '◆'.repeat(seal) + '◇'.repeat(Math.max(0, 4 - seal)), 30, 412, 18, '#ffd84a', 'left', '#000');
      if (guard > 0) txt(g, '護摩の守り ' + guard, 30, 436, 16, '#ffb070', 'left', '#000');
      g.fillStyle = 'rgba(250,240,215,.94)'; g.fillRect(130, 108, 640, 40); g.strokeStyle = '#2b1d12'; g.lineWidth = 3; g.strokeRect(130, 108, 640, 40);
      txt(g, log, 142, 128, 17, '#2b1d12');
      if (phase === 'mudra') {
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(230, 270, 470, 240);
        txt(g, '印を結べ！（矢印キー / ボタン）', 465, 296, 20, '#ffe9a8', 'center');
        mseq.forEach((d, i) => { const x = 465 + (i - (mseq.length - 1) / 2) * 76; g.fillStyle = i < mpos ? '#ffd84a' : '#f6ecd2'; g.fillRect(x - 32, 320, 64, 64); txt(g, SYM[d], x, 344, 30, '#2b1d12', 'center'); txt(g, MUDRA[d].n, x, 374, 12, '#5a4030', 'center'); });
        for (let i = 0; i < 4; i++) { const bx = 270 + i * 100; g.fillStyle = '#e8d8b0'; g.fillRect(bx, 420, 80, 80); g.strokeStyle = '#2b1d12'; g.strokeRect(bx, 420, 80, 80); txt(g, SYM[i], bx + 40, 452, 32, '#2b1d12', 'center'); txt(g, MUDRA[i].n, bx + 40, 486, 13, '#5a4030', 'center'); }
        g.fillStyle = '#e86a4a'; g.fillRect(250, 398, 430 * Math.max(0, 1 - t / mlim), 8);
      }
    };
    btns();
    mgLoop(dt => {
      time += dt; t += dt; hurt = Math.max(0, hurt - dt / 400); phurt = Math.max(0, phurt - dt / 400);
      for (const gl of glyphs) { gl.y -= gl.v * dt; gl.a -= dt / 1600; } glyphs = glyphs.filter(x => x.a > 0);
      if (phase === 'mudra' && t > mlim) { log = '時間切れ…印が結べなかった。'; SFX.miss(); phase = 'wait'; t = 0; }
      if (phase === 'wait' && t > 800) {
        if (ehp <= 0) { phase = 'end'; }
        else { enemyTurn(); phase = 'ewait'; t = 0; }
      }
      if (phase === 'ewait' && t > 900) { if (hope <= 0) phase = 'end'; else { phase = 'cmd'; btns(); } }
      draw();
      if (phase === 'end' && !ended) {
        ended = true; const win = ehp <= 0;
        if (win) SFX.bell();
        mgFinish(draw, win ? [o.winText || '鎮まった！', '民の希望 ' + hope + ' を守り抜いた'] : ['力及ばず…', '法力を高めて再び挑もう'], win ? '#ffd84a' : '#ff9a8a').then(() => res({ win, score: hope / 100 }));
        return false;
      }
    });
  });
}

// =====================================================================
// 7) 漢詩 — 韻と主題をそろえる
// =====================================================================
const POEM = [
  [{ t: '独坐青松下', k: '独り青松の下に坐す', th: '山' }, { t: '朝辞故郷浦', k: '朝に故郷の浦を辞す', th: '旅' }, { t: '明星落海中', k: '明星 海中に落つ', th: '海' }],
  [{ t: '白雲去又還', k: '白雲 去りて又還る', th: '山', r: 'an' }, { t: '孤舟渡碧天', k: '孤舟 碧天を渡る', th: '海', r: 'en' }, { t: '万里向長安', k: '万里 長安に向かう', th: '旅', r: 'an' }],
  [{ t: '鐘声随風遠', k: '鐘声 風に随いて遠く', th: '山' }, { t: '波濤連万里', k: '波濤 万里に連なる', th: '海' }, { t: '回首望東国', k: '首を回らして東国を望む', th: '旅' }],
  [{ t: '一念満空山', k: '一念 空山に満つ', th: '山', r: 'an' }, { t: '心月照海辺', k: '心月 海辺を照らす', th: '海', r: 'en' }, { t: '帰夢度重関', k: '帰夢 重関を度る', th: '旅', r: 'an' }]
];
function mgPoem(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '詩作');
    const g = MG.g, sel = [], opts = POEM.map(l => l.slice().sort(() => Math.random() - .5));
    let line = 0, time = 0, ended = false, result = null;
    const evalP = () => {
      const rh = sel[1].r === sel[3].r ? 45 : 0;
      const cnt = {}; sel.forEach(x => cnt[x.th] = (cnt[x.th] || 0) + 1); const mx = Math.max(...Object.values(cnt));
      const th = (mx - 1) * 15, b = sel[0].th === sel[3].th ? 10 : 0;
      return { sc: (rh + th + b) / 100, rh: !!rh, mx };
    };
    const setBtns = () => {
      if (line >= 4) {
        result = evalP();
        mgButtons([{ label: 'この詩を披露する', fn: () => { ended = true; const r = result; mgFinish(draw, [r.sc >= .9 ? '満座、感嘆す！' : r.sc >= .6 ? '見事な詩だ' : '……ぎこちない詩だ', (r.rh ? '押韻○' : '押韻×') + '　主題の統一 ' + r.mx + '/4　' + Math.round(r.sc * 100) + '点']).then(() => res(r.sc)); } }, { label: '作り直す', fn: () => { sel.length = 0; line = 0; setBtns(); } }]);
        return;
      }
      mgButtons(opts[line].map(op => ({ label: op.t + '（' + op.k + '）', fn: () => { sel.push(op); line++; SFX.ok(); setBtns(); } })));
    };
    const draw = () => {
      paperBg(g); mgHeader(g, o.title || '詩作', '五言絶句：第二句と第四句の韻をそろえ、主題を統一せよ');
      txt(g, ['起句', '承句', '転句', '結句'][Math.min(3, line)] + 'を選ぶ', 40, 90, 22, '#b8392b');
      txt(g, '韻のヒント：還・安・山・関＝「アン」の響き／天・辺＝「エン」の響き', 40, 125, 16, '#5a4030');
      g.fillStyle = '#fffaf0'; g.fillRect(470, 140, 360, 360); g.strokeStyle = '#8a2a1a'; g.lineWidth = 3; g.strokeRect(470, 140, 360, 360);
      for (let i = 0; i < 4; i++) { const x = 790 - i * 80; g.strokeStyle = 'rgba(180,80,60,.3)'; g.strokeRect(x - 30, 150, 60, 340); const l = sel[i]; if (l) [...l.t].forEach((c, j) => txt(g, c, x, 185 + j * 64, 46, '#1a1208', 'center')); }
      drawSpr(g, playerSpr(0, 0), 140, 260, 6);
      if (o.host) txt(g, o.host, 40, 470, 18, '#5a4030');
    };
    setBtns();
    mgLoop(dt => { time += dt; if (!ended) draw(); return !ended; });
  });
}

// =====================================================================
// 8) 剃髪 — 自らの手で髪を剃る
// =====================================================================
function mgShave(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '剃髪');
    const g = MG.g, K = 14, OX = 450 - 10 * K, OY = 110, LIM = 40000;
    const inHead = (cx, cy) => { const dx = (cx + .5 - 10) / 10, dy = (cy + .5 - 10.5) / 10.5; return dx * dx + dy * dy <= 1; };
    const cells = [];
    for (let y = 0; y < 21; y++) for (let x = -3; x < 23; x++) {
      const head = inHead(x, y), top = head && y < 7 + Math.abs(x - 10) * .18, loop = (x < 0 || x > 19) && y >= 8 && y <= 13 && (x >= -3 && x <= 22) && !(x === -3 && (y === 8 || y === 13)) && !(x === 22 && (y === 8 || y === 13));
      if (top || loop) cells.push({ x, y, alive: true, v: h2(x, y, 4) });
    }
    const total = cells.length; let left = total, nicks = [], parts = [], time = 0, down = false, last = null, lastNick = -999, ended = false, lastSnd = 0;
    const cut = (px, py, sp) => {
      for (const c of cells) {
        if (!c.alive) continue; const cx = OX + c.x * K + K / 2, cy = OY + c.y * K + K / 2;
        if (Math.hypot(cx - px, cy - py) < 20) { c.alive = false; left--; for (let k = 0; k < 2; k++) parts.push({ x: cx, y: cy, vx: (Math.random() - .5) * .1, vy: .05 + Math.random() * .1, a: 1 }); if (time - lastSnd > 60) { beep(1800 + Math.random() * 600, .025, 'sawtooth', .015); lastSnd = time; } }
      }
      const hx = (px - OX) / K, hy = (py - OY) / K;
      if (sp > 2.4 && inHead(hx, hy) && time - lastNick > 800) { nicks.push({ x: px, y: py }); lastNick = time; SFX.miss(); }
    };
    MG.onPointer = (type, x, y) => {
      if (type === 'down') { down = true; last = { x, y, t: performance.now() }; }
      else if (type === 'up') down = false;
      else if (type === 'move') { const now = performance.now(); if (down && last) { const d = Math.hypot(x - last.x, y - last.y), sp = d / Math.max(1, now - last.t); const n = Math.ceil(d / 8); for (let i = 1; i <= n; i++) cut(last.x + (x - last.x) * i / n, last.y + (y - last.y) * i / n, sp); } MG.mx = x; MG.my = y; last = { x, y, t: now }; }
    };
    mgButtons([]);
    const skin = '#f2cba6', hairC = ['#1e1a1e', '#2a2428', '#36303a'];
    const draw = () => {
      const gr = g.createLinearGradient(0, 0, 0, MGH); gr.addColorStop(0, '#5a7a8a'); gr.addColorStop(1, '#2a3a4a'); g.fillStyle = gr; g.fillRect(0, 0, MGW, MGH);
      for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; const y = 60 + i * 40 + Math.sin(time / 900 + i) * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(300, y + 8, 600, y - 8, MGW, y); g.stroke(); }
      // 首と衣
      g.fillStyle = '#d8b090'; g.fillRect(OX + 7 * K, OY + 20 * K, 6 * K, 3 * K);
      g.fillStyle = '#ece6d6'; g.beginPath(); g.moveTo(OX - 2 * K, MGH); g.lineTo(OX + 4 * K, OY + 22 * K); g.lineTo(OX + 16 * K, OY + 22 * K); g.lineTo(OX + 22 * K, MGH); g.fill();
      // 頭
      for (let y = 0; y < 21; y++) for (let x = 0; x < 20; x++) if (inHead(x, y)) { g.fillStyle = y < 8 ? '#e8c4a8' : skin; g.fillRect(OX + x * K, OY + y * K, K, K); }
      g.fillStyle = 'rgba(120,130,160,.18)'; for (const c of cells) if (!c.alive && c.x >= 0 && c.x < 20) g.fillRect(OX + c.x * K, OY + c.y * K, K, K);
      // 顔（目を閉じて）
      g.fillStyle = '#2a1a14'; for (const ex of [6, 13]) g.fillRect(OX + ex * K, OY + 12 * K, K * 1.5, K * .4);
      g.fillStyle = '#f0a0a0'; g.fillRect(OX + 4 * K, OY + 14 * K, K * 2, K * .6); g.fillRect(OX + 14 * K, OY + 14 * K, K * 2, K * .6);
      g.fillStyle = '#b0605a'; g.fillRect(OX + 9 * K, OY + 16.5 * K, K * 2, K * .4);
      for (const c of cells) if (c.alive) { g.fillStyle = hairC[(c.v * 3) | 0]; g.fillRect(OX + c.x * K, OY + c.y * K, K, K); if (c.v > .8) { g.fillStyle = '#4a4450'; g.fillRect(OX + c.x * K + 3, OY + c.y * K + 3, 4, 2); } }
      for (const n of nicks) { g.fillStyle = '#c8302a'; g.fillRect(n.x - 4, n.y - 1, 8, 3); }
      for (const p of parts) { g.strokeStyle = 'rgba(30,26,30,' + p.a + ')'; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 3, p.y + 7); g.stroke(); }
      // 剃刀
      if (MG.mx != null) { g.save(); g.translate(MG.mx, MG.my); g.rotate(-.6); g.fillStyle = '#e8eef4'; g.fillRect(-4, -26, 22, 26); g.fillStyle = '#9aa8b4'; g.fillRect(-4, -26, 3, 26); g.fillStyle = '#7a4a2a'; g.fillRect(16, -22, 34, 9); g.restore(); }
      mgHeader(g, o.title || '剃髪', 'マウスを押したまま、ゆっくり丁寧に髪を剃る。急ぐと肌を傷つける');
      const r = 1 - left / total;
      g.fillStyle = '#1a1208'; g.fillRect(30, 540, 300, 18); g.fillStyle = '#e8d8a8'; g.fillRect(32, 542, 296 * r, 14); txt(g, '剃り終え ' + Math.round(r * 100) + '%', 30, 526, 18, '#fbf3dc', 'left', '#000');
      txt(g, '傷 ' + nicks.length, 360, 549, 18, nicks.length ? '#ffb0a0' : '#fbf3dc', 'left', '#000');
      txt(g, '残り ' + Math.max(0, Math.ceil((LIM - time) / 1000)) + ' 秒', MGW - 30, 549, 18, '#fbf3dc', 'right', '#000');
      txt(g, '水面に映る自分の姿', MGW - 30, 80, 16, 'rgba(255,255,255,.6)', 'right');
    };
    mgLoop(dt => {
      time += dt; for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .0004 * dt; p.a -= dt / 1400; } parts = parts.filter(p => p.a > 0);
      draw();
      if (!ended && (left <= total * .03 || time > LIM)) {
        ended = true; for (const c of cells) c.alive = false; left = 0;
        const sc = Math.max(0, (1 - (cells.filter(c => c.alive).length) / total)) * Math.max(.3, 1 - nicks.length * .1) * (time > LIM ? .7 : 1);
        SFX.bell();
        mgFinish(draw, [sc > .8 ? '剃髪の儀、成る' : '髪を落とした', nicks.length ? '傷 ' + nicks.length + ' か所……心の乱れが手に出た' : '一つの傷もなく、静かに剃り終えた']).then(() => res(sc));
        return false;
      }
    });
  });
}
