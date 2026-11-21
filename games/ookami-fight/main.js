// main.js — 画面。題、選択、あそびかた、対戦の描画、入力、音の橋渡し。
(function () {
  'use strict';
  const F = window.FIGHT, FX = window.FIGHT_FX, AI = window.FIGHT_AI, CH = window.FIGHT_CHARS, B = F.BIT, SND = window.SND;
  const W = F.W, H = F.H, FLOOR = F.FLOOR;
  const Q = new URLSearchParams(location.search);
  const cv = document.getElementById('c'), c = cv.getContext('2d');
  const MIN = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
  const GOTH = '"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif';
  const TITLE = '狼のいる夜', SUBTITLE = '夜 戦';

  // ---------------------------------------------------------------- 絵
  const IMG = {}; let pending = 0;
  function load(k, src) { const im = new Image(); pending++; im.onload = () => { pending--; im.ok = true; }; im.onerror = () => { pending--; }; im.src = src; IMG[k] = im; return im; }
  const ATLAS = window.FIGHT_ATLAS || {};
  for (const k in ATLAS) load('atlas_' + k, ATLAS[k].img);
  const STAGES = [
    { key: 'manor', name: '館・三時', src: 'art/stage-manor.webp' },
    { key: 'square', name: '広場・二十三時半', src: 'art/stage-square.webp' },
    { key: 'church', name: '教会・真夜中', src: 'art/stage-church.webp' },
  ];
  STAGES.forEach(s => load('st_' + s.key, s.src));
  load('cut_girl', 'art/cut-girl.webp'); load('cut_man', 'art/cut-man.webp');

  const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
  function frameOf(key, anim, idx) {
    const a = ATLAS[key]; if (!a || !IMG['atlas_' + key].ok) return null;
    const fr = a.frames[anim];
    if (fr && fr.length) return fr[Math.min(idx, fr.length - 1)];
    return a.frames.idle ? a.frames.idle[0] : null;
  }
  // 人物を一枚描く。x は足元の中心、y は床の線（画面の座標）
  function sprite(ctx, key, anim, idx, x, y, face, o) {
    o = o || {};
    const fr = frameOf(key, anim, idx);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1); if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.glow) { ctx.shadowBlur = o.blur || 16; ctx.shadowColor = o.glow; }
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (!fr) {
      const ch = CH[key]; ctx.fillStyle = o.tint || (key === 'girl' ? '#d8d2c4' : '#2a2238');
      const hh = anim === 'crouch' || anim[0] === '2' ? ch.ch : anim === 'down' ? 40 : ch.h, ww = anim === 'down' ? ch.h * 0.8 : ch.w * 2;
      ctx.fillRect(-ww / 2, -hh, ww, hh); ctx.fillStyle = '#fff'; ctx.fillRect(ch.w - 8, -hh + 16, 8, 8);
      ctx.font = '11px monospace'; ctx.fillStyle = '#ff8'; ctx.fillText(anim + idx, -20, -hh - 4);
      ctx.restore(); return;
    }
    const [sx, sy, sw, sh, ax, ay] = fr, im = IMG['atlas_' + key];
    if (o.tint) {
      tmp.width = sw; tmp.height = sh; tc.clearRect(0, 0, sw, sh); tc.globalCompositeOperation = 'source-over';
      tc.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh); tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = o.tint; tc.fillRect(0, 0, sw, sh);
      if (o.add) ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(tmp, -ax, -ay);
    } else {
      if (o.alt && 'filter' in ctx) ctx.filter = 'hue-rotate(150deg) saturate(1.5) brightness(0.92)';
      ctx.drawImage(im, sx, sy, sw, sh, -ax, -ay, sw, sh);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 入力
  const keys = {}, pressedQ = [];
  addEventListener('keydown', e => {
    if (e.repeat) { if (!e.metaKey && !e.ctrlKey) e.preventDefault(); return; }
    keys[e.code] = true; pressedQ.push(e.code); SND.init();
    if (!e.metaKey && !e.ctrlKey && e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const any = (...ks) => ks.some(k => keys[k]);
  const MAP = {
    solo: { U: ['ArrowUp', 'KeyW'], D: ['ArrowDown', 'KeyS'], L: ['ArrowLeft', 'KeyA'], R: ['ArrowRight', 'KeyD'], A: ['KeyZ', 'KeyJ'], B: ['KeyX', 'KeyK'], C: ['KeyC', 'KeyL'], S: ['KeyV', 'KeyI'], X: ['Space', 'KeyU'] },
    p1: { U: ['KeyW'], D: ['KeyS'], L: ['KeyA'], R: ['KeyD'], A: ['KeyC'], B: ['KeyV'], C: ['KeyB'], S: ['KeyF'], X: ['KeyG'] },
    p2: { U: ['ArrowUp'], D: ['ArrowDown'], L: ['ArrowLeft'], R: ['ArrowRight'], A: ['KeyJ'], B: ['KeyK'], C: ['KeyL'], S: ['KeyI'], X: ['KeyO'] },
  };
  function bits(m) { let b = 0; for (const k in m) if (any(...m[k])) b |= B[k]; if ((b & B.L) && (b & B.R)) b &= ~(B.L | B.R); if ((b & B.U) && (b & B.D)) b &= ~B.U; return b; }
  const UI = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], ok: ['Enter', 'KeyZ', 'KeyJ', 'Space'], back: ['Escape', 'KeyX', 'KeyK', 'Backspace'] };
  let pressed = {};
  const hit = n => UI[n].some(k => pressed[k]);

  // ---------------------------------------------------------------- 場面
  let scene = 'title', st = { t: 0, sel: 0 }, g = null, cfg = { mode: 'solo', p1: 'girl', p2: 'man', lvl: 1, stage: 0 }, seenHowto = false, paused = false;
  let hud = { hp: [1, 1], lag: [1, 1], gz: [0, 0] }, cut = null, banner = null, trail = [], koZoom = 0;
  function go(s, o) { scene = s; st = Object.assign({ t: 0, sel: 0 }, o || {}); }

  function startMatch() {
    const seed = Q.get('seed') ? +Q.get('seed') : (Date.now() % 100000) + 1;
    g = F.newGame({ p1: cfg.p1, p2: cfg.p2, seed });
    if (cfg.mode === 'solo') g.f[1].ai = AI.make(cfg.lvl);
    if (cfg.mode === 'watch') { g.f[0].ai = AI.make(2); g.f[1].ai = AI.make(2); }
    FX.reset(); hud = { hp: [1, 1], lag: [1, 1], gz: [0, 0] }; cut = null; banner = null; trail = []; paused = false;
    go('fight'); SND.music('battle'); onEvents();
  }

  // 試合の出来事を、音と画面の飾りに渡す
  function onEvents() {
    FX.handle(g);
    for (const e of g.events) {
      const pan = e.x != null ? F.clamp((e.x - g.camX - W / 2) / (W / 2), -1, 1) * 0.7 : 0;
      switch (e.k) {
        case 'round': banner = { s: g.round >= 3 ? '最後の夜' : ['', '第一夜', '第二夜'][g.round] || '第' + g.round + '夜', t: 0, life: 66 }; SND.play('bell', { vol: 0.5 }); break;
        case 'fight': banner = { s: '始め', t: 0, life: 40, big: 1 }; SND.play('roundStart'); break;
        case 'move': if (e.snd) SND.play(e.snd, { pan }); break;
        case 'hit': SND.play(['hitL', 'hitM', 'hitH'][e.lvl], { pan, pitch: 0.94 + Math.random() * 0.12 }); if (e.fx === 'bite') SND.play('maw', { pan, vol: 0.6 }); break;
        case 'guard': SND.play('guard', { pan }); break;
        case 'shield': SND.play('shield', { pan }); break;
        case 'shieldHit': SND.play('shieldHit', { pan }); break;
        case 'jump': SND.play('jump', { pan, vol: 0.6 }); break;
        case 'land': SND.play('land', { pan, vol: 0.5 }); break;
        case 'dash': SND.play('dash', { pan, vol: 0.7 }); break;
        case 'down': SND.play('land', { pan, pitch: 0.6 }); break;
        case 'gmax': SND.play('gaugeMax', { vol: 0.6 }); break;
        case 'super': cut = { i: e.i, t: 0, name: e.name, sub: g.f[e.i].ch.moves.super.sub }; break;
        case 'entOn': if (e.e.kind === 'dreamRing') SND.play('blast', { pan, vol: 0.6, pitch: 1.4 }); if (e.e.kind === 'kingdom') { SND.play('maw', { pan }); SND.play('blast', { pan, pitch: 0.7 }); } break;
        case 'fx': if (e.fx === 'dreamBlast') SND.play('blast'); if (e.fx === 'pillar' || e.fx === 'rise') SND.play('whiffH', { pan, pitch: 0.6 }); break;
        case 'spawn': if (e.e.kind !== 'maw') SND.play('circle', { pan, vol: 0.7 }); break;
        case 'ko': SND.play('ko'); banner = { s: '決着', t: 0, life: 150, big: 1, delay: 50 }; koZoom = 1; break;
        case 'timeup': banner = { s: '夜明け', t: 0, life: 150, big: 1 }; SND.play('bell'); break;
        case 'roundEnd': if (e.w < 0) banner = { s: '相打ち', t: 0, life: 110 }; break;
        case 'matchEnd': break;
      }
    }
  }

  function stepFight() {
    if (pressed.Escape || pressed.KeyP) { paused = !paused; SND.play('select'); }
    FX.live = !paused;
    if (paused) { if (pressed.KeyQ) { FX.live = true; SND.music('title'); go('title'); } return; }
    const in0 = g.f[0].ai ? AI.think(g, 0) : bits(cfg.mode === 'two' ? MAP.p1 : MAP.solo);
    const in1 = g.f[1].ai ? AI.think(g, 1) : bits(MAP.p2);
    F.step(g, in0, in1);
    for (const f of g.f) if (f.stop > 0 && f.flash > 0) f.flash--;
    onEvents(); FX.tick();
    if (cut) { cut.t++; if (g.freeze <= 0) { cut = null; FX.darkTo = 0.45; } }
    else if (g.phase === 'fight' && !g.f.some(f => f.st === 'atk' && f.mv && f.mv.type === 'super') && !g.ents.some(e => e.kind === 'kingdom')) FX.darkTo = 0;
    if (banner && ++banner.t > banner.life + (banner.delay || 0)) banner = null;
    // 残像
    for (const f of g.f) if (f.afterimg > 0) { f.afterimg--; if (g.frame % 2 === 0) { const p = F.pose(f); trail.push({ key: f.key, a: p[0], i: p[1], x: f.x, y: f.y, face: f.face, t: 0, idx: f.idx }); } }
    trail.forEach(t => t.t++); trail = trail.filter(t => t.t < 14);
    for (let i = 0; i < 2; i++) {
      const f = g.f[i], r = Math.max(0, f.hp) / f.ch.hp;
      hud.hp[i] = r; if (hud.lag[i] < r) hud.lag[i] = r; else if (f.st !== 'hit' && f.st !== 'airhit') hud.lag[i] += (r - hud.lag[i]) * 0.08;
      hud.gz[i] += (f.gauge - hud.gz[i]) * 0.25;
    }
    if (koZoom > 0) koZoom = g.phase === 'ko' && g.pt < 100 ? Math.min(1, koZoom) : Math.max(0, koZoom - 0.04);
    if (g.phase === 'over' && g.pt > 30) { SND.music('result'); go('result', { w: g.winner }); }
  }

  // ---------------------------------------------------------------- 描く：対戦
  function drawStage(camX) {
    const s = STAGES[cfg.stage], im = IMG['st_' + s.key];
    c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
    if (im && im.ok) {
      const sc = Math.max(H / im.height, (W + 300) / im.width), dw = im.width * sc, dh = im.height * sc;
      const maxCam = F.STAGE - W, px = (dw - W) * (maxCam ? camX / maxCam : 0.5);
      c.imageSmoothingEnabled = false;
      c.drawImage(im, Math.round(-px), H - dh, dw, dh);
    } else {
      const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a0d24'); gr.addColorStop(0.7, '#141833'); gr.addColorStop(1, '#07070c');
      c.fillStyle = gr; c.fillRect(0, 0, W, H); c.fillStyle = '#0c0d18'; c.fillRect(0, FLOOR, W, H - FLOOR);
    }
    // 月明かりの中の塵
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const t = FX.time * (0.12 + (i % 5) * 0.05), x = ((i * 137.5 - camX * (0.5 + (i % 3) * 0.25) + Math.sin(t * 0.05 + i) * 30) % (W + 40) + W + 40) % (W + 40) - 20, y = ((i * 71.3 + t) % 470), a = 0.10 + 0.22 * Math.abs(Math.sin(t * 0.03 + i * 1.7));
      c.fillStyle = 'rgba(190,210,255,' + a + ')'; c.fillRect(Math.round(x), Math.round(y), i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
    }
    c.restore();
    // 上と下を沈めて、人物を浮かせる
    let gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(4,5,14,0.55)'); gr.addColorStop(0.3, 'rgba(4,5,14,0.12)'); gr.addColorStop(0.8, 'rgba(4,5,14,0.18)'); gr.addColorStop(1, 'rgba(4,5,14,0.7)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }

  function drawFighter(f, other) {
    const p = F.pose(f), x = f.x, y = FLOOR - f.y;
    const sh = f.stop > 0 && f.shake > 0 && (f.st === 'hit' || f.st === 'airhit') ? (g.frame % 2 ? 3 : -3) : 0;
    const alt = f.idx === 1 && other.key === f.key;
    sprite(c, f.key, p[0], p[1], x + sh, y, f.face, { alt });
    if (f.flash > 0) sprite(c, f.key, p[0], p[1], x + sh, y, f.face, { tint: 'rgba(255,255,255,' + Math.min(0.45, f.flash / 10) + ')', add: 1 });
    if (f.gauge >= F.GMAX && g.frame % 24 < 4) sprite(c, f.key, p[0], p[1], x, y, f.face, { tint: FX.rgba(FX.PAL[f.key].glow, 0.14), add: 1 });
    // 盾の陣
    if (f.st === 'shield' && f.shieldT >= 0) {
      const k = Math.min(1, f.shieldT / 4);
      FX.circle(c, f.key, x + f.face * 46, y - (f.in & B.D && f.y <= 0 ? f.ch.ch : f.ch.h) * 0.55, 88 * k, g.frame * 0.09, 0.9, false, 0.4);
    }
  }
  function shadow(f) {
    const k = Math.max(0.35, 1 - f.y / 320), w = (f.st === 'down' || (f.st === 'ko' && f.y <= 0) ? f.ch.h * 0.5 : f.ch.pw * 1.9) * k;
    c.fillStyle = 'rgba(2,2,8,' + 0.55 * k + ')'; c.beginPath(); c.ellipse(f.x, FLOOR + 3, w, 7 * k, 0, 0, 7); c.fill();
  }

  function drawFight() {
    const zoom = 1 + 0.16 * koZoom * (g.phase === 'ko' ? Math.min(1, g.pt / 10) : koZoom);
    const shx = FX.shake ? (Math.random() - 0.5) * 2 * FX.shake : 0, shy = FX.shake ? (Math.random() - 0.5) * 2 * FX.shake * 0.7 : 0;
    c.save();
    if (zoom > 1.001) {
      const loser = g.roundWinner >= 0 ? g.f[1 - g.roundWinner] : g.f[0];
      const fx = F.clamp(loser.x - g.camX, 200, W - 200), fy = FLOOR - 110;
      c.translate(fx, fy); c.scale(zoom, zoom); c.translate(-fx, -fy);
    }
    c.translate(Math.round(shx), Math.round(shy));
    drawStage(g.camX);
    if (FX.dark > 0.01) { c.fillStyle = 'rgba(3,2,10,' + FX.dark + ')'; c.fillRect(-40, -40, W + 80, H + 80); }
    c.save(); c.translate(-Math.round(g.camX), 0);
    g.f.forEach(shadow);
    FX.ents(c, g, 'back'); FX.draw(c, 'back');
    for (const t of trail) sprite(c, t.key, t.a, t.i, t.x, FLOOR - t.y, t.face, { tint: FX.rgba(FX.PAL[t.key].glow, 0.9), alpha: 0.5 * (1 - t.t / 14), add: 1 });
    // 攻めている側を手前に
    const order = g.f[0].st === 'atk' && g.f[1].st !== 'atk' ? [1, 0] : [0, 1];
    for (const i of order) drawFighter(g.f[i], g.f[1 - i]);
    FX.ents(c, g, 'front'); FX.draw(c, 'front');
    if (Q.has('boxes')) drawBoxes();
    c.restore();
    c.restore();
    if (FX.flash > 0.01) { c.fillStyle = 'rgba(255,255,255,' + Math.min(1, FX.flash) + ')'; c.fillRect(0, 0, W, H); }
    if (cut) drawCut();
    drawHud();
    if (banner) drawBanner();
    if (paused) { c.fillStyle = 'rgba(3,3,10,0.7)'; c.fillRect(0, 0, W, H); text('一時停止', W / 2, 240, 44, '#f1ead8', 'center'); text('Esc でもどる　／　Q で題へ', W / 2, 300, 18, '#a9a7c0', 'center', GOTH); }
  }
  function drawBoxes() {
    for (const f of g.f) {
      const h = F.hurt(f); if (h) { c.strokeStyle = '#4f8'; c.strokeRect(h.x, FLOOR - h.y - h.h, h.w, h.h); }
      if (f.st === 'atk') for (const q of f.mv.hits) { if (q.s && q.s.indexOf(f.str) < 0) continue; if (f.t - 1 >= q.f[0] && f.t - 1 <= q.f[1]) { const r = F.boxOf(f, q.box); c.strokeStyle = '#f44'; c.strokeRect(r.x, FLOOR - r.y - r.h, r.w, r.h); } }
    }
    for (const e of g.ents) { c.strokeStyle = e.t >= e.delay && e.t < e.delay + e.active ? '#f44' : '#844'; c.strokeRect(e.x - e.w / 2, FLOOR - e.y - e.h, e.w, e.h); }
  }

  function text(s, x, y, size, col, align, font, stroke) {
    c.font = (font === GOTH ? '600 ' : '700 ') + size + 'px ' + (font || MIN); c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    if (stroke !== 0) { c.lineWidth = Math.max(3, size / 7); c.strokeStyle = 'rgba(5,4,14,0.9)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }

  function drawHud() {
    const bw = 370, bh = 16, y = 30;
    for (let i = 0; i < 2; i++) {
      const f = g.f[i], pal = FX.PAL[f.key], left = i === 0, x0 = left ? 44 : W - 44 - bw;
      // 体力
      c.fillStyle = 'rgba(5,5,14,0.8)'; c.fillRect(x0 - 3, y - 3, bw + 6, bh + 6);
      c.strokeStyle = 'rgba(214,205,180,0.8)'; c.lineWidth = 1; c.strokeRect(x0 - 2.5, y - 2.5, bw + 5, bh + 5);
      const fill = (r, col) => { const w = Math.round(bw * F.clamp(r, 0, 1)); c.fillStyle = col; c.fillRect(left ? x0 + bw - w : x0, y, w, bh); };
      fill(hud.lag[i], '#b3243c');
      const gr = c.createLinearGradient(0, y, 0, y + bh);
      if (hud.hp[i] > 0.25) { gr.addColorStop(0, '#fbf6e4'); gr.addColorStop(0.5, f.key === 'girl' ? '#d9d2bd' : '#b9a8ee'); gr.addColorStop(1, f.key === 'girl' ? '#8f9bb5' : '#5a4496'); }
      else { gr.addColorStop(0, '#ffd3c4'); gr.addColorStop(1, g.frame % 20 < 10 ? '#c8344c' : '#8d2236'); }
      fill(hud.hp[i], gr);
      text(f.ch.name, left ? x0 : x0 + bw, y + 40, 20, '#f1ead8', left ? 'left' : 'right');
      text(f.ch.sub, left ? x0 + 46 + (f.ch.name.length - 1) * 20 : x0 + bw - 46 - (f.ch.name.length - 1) * 20, y + 39, 12, '#9c9ab8', left ? 'left' : 'right', GOTH);
      // 勝ち星（月）
      for (let k = 0; k < g.opt.need; k++) {
        const mx = left ? x0 + bw - 12 - k * 22 : x0 + 12 + k * 22, my = y + 34, on = k < f.wins;
        c.beginPath(); c.arc(mx, my, 7, 0, 7); c.fillStyle = on ? '#f6e7a8' : 'rgba(20,20,40,0.8)'; c.fill(); c.strokeStyle = 'rgba(214,205,180,0.7)'; c.stroke();
        if (on) { c.beginPath(); c.arc(mx + 3.5, my - 1.5, 5.5, 0, 7); c.fillStyle = '#0b0c1c'; c.fill(); }
      }
      // 夜のゲージ（三本）
      const gw = 250, gy = H - 30, gx = left ? 44 : W - 44 - gw, gz = hud.gz[i];
      for (let k = 0; k < 3; k++) {
        const sx = left ? gx + k * (gw / 3) : gx + gw - (k + 1) * (gw / 3), w = gw / 3 - 4, r = F.clamp((gz - k * 100) / 100, 0, 1);
        c.fillStyle = 'rgba(5,5,14,0.8)'; c.fillRect(sx, gy, w, 10); c.strokeStyle = 'rgba(214,205,180,0.6)'; c.strokeRect(sx - 0.5, gy - 0.5, w + 1, 11);
        const full = r >= 1, ww = Math.round(w * r);
        c.fillStyle = full ? (g.frame % 16 < 8 ? FX.rgba(pal.acc, 1) : '#fff') : FX.rgba(pal.glow, 0.85);
        c.fillRect(left ? sx : sx + w - ww, gy, ww, 10);
      }
      text(Math.floor(gz) + '%', left ? gx + gw + 10 : gx - 10, gy + 10, 14, gz >= 200 ? '#f6e7a8' : '#c9c6dd', left ? 'left' : 'right', GOTH);
      if (gz >= 200) text('奥義', left ? gx + gw + 56 : gx - 56, gy + 10, 14, g.frame % 30 < 15 ? '#fff' : '#f6e7a8', left ? 'left' : 'right');
      // 連続
      const cv2 = g.comboView[i];
      if (cv2 && cv2.n >= 2 && g.frame - cv2.t < 70) {
        const a = Math.min(1, (70 - (g.frame - cv2.t)) / 20), pop = Math.max(0, 6 - (g.frame - cv2.t)) * 1.5;
        c.globalAlpha = a;
        text(String(cv2.n), left ? 60 : W - 60, 150, 54 + pop, '#f6e7a8', left ? 'left' : 'right');
        text('連', left ? 60 + String(cv2.n).length * 32 + 6 : W - 60 - String(cv2.n).length * 32 - 6, 148, 24, '#f1ead8', left ? 'left' : 'right');
        text(cv2.dmg + '', left ? 62 : W - 62, 174, 15, '#c9c6dd', left ? 'left' : 'right', GOTH);
        c.globalAlpha = 1;
      }
    }
    // 時
    const sec = Math.max(0, Math.ceil(g.timer / 60));
    c.fillStyle = 'rgba(5,5,14,0.85)'; c.beginPath(); c.arc(W / 2, 40, 31, 0, 7); c.fill(); c.strokeStyle = 'rgba(214,205,180,0.8)'; c.lineWidth = 1.5; c.stroke();
    text(String(sec), W / 2, 53, 34, sec <= 10 ? '#ff7a8a' : '#f1ead8', 'center');
  }

  function drawBanner() {
    const b = banner, t = b.t - (b.delay || 0); if (t < 0) return;
    const inn = Math.min(1, t / 8), out = Math.min(1, (b.life - t) / 12), a = Math.min(inn, out);
    c.save(); c.globalAlpha = a;
    const y = 250, size = b.big ? 96 : 64, sc = 1 + (1 - inn) * 0.8;
    c.fillStyle = 'rgba(4,3,12,0.55)'; c.fillRect(0, y - size * 0.75, W, size * 1.1);
    c.fillStyle = 'rgba(214,205,180,0.6)'; c.fillRect(0, y - size * 0.75, W, 1); c.fillRect(0, y + size * 0.35, W, 1);
    c.translate(W / 2, y); c.scale(sc, sc);
    c.shadowBlur = 24; c.shadowColor = b.s === '決着' ? '#ff4a6a' : '#8fb4ff';
    text(b.s.split('').join(b.big ? ' ' : ''), 0, 0, size, '#fbf6e4', 'center');
    c.restore();
  }

  // 奥義の割り込み
  function drawCut() {
    const f = g.f[cut.i], key = f.key, pal = FX.PAL[key], t = cut.t, left = f.face > 0;
    const inn = Math.min(1, t / 9), e = 1 - Math.pow(1 - inn, 3), out = Math.min(1, Math.max(0, g.freeze) / 8);
    c.save(); c.globalAlpha = out;
    c.fillStyle = 'rgba(3,2,10,0.45)'; c.fillRect(0, 0, W, H);
    // 斜めの帯
    c.save(); c.translate(W / 2, H / 2 - 10); c.rotate(left ? -0.09 : 0.09);
    const bh = 250 * e;
    const gr = c.createLinearGradient(0, -bh / 2, 0, bh / 2); gr.addColorStop(0, FX.rgba(pal.glow, 0.0)); gr.addColorStop(0.12, 'rgba(6,5,18,0.96)'); gr.addColorStop(0.88, 'rgba(6,5,18,0.96)'); gr.addColorStop(1, FX.rgba(pal.glow, 0));
    c.fillStyle = gr; c.fillRect(-W, -bh / 2, W * 2, bh);
    c.fillStyle = FX.rgba(pal.acc, 0.9); c.fillRect(-W, -bh / 2 + bh * 0.12, W * 2, 2); c.fillRect(-W, bh / 2 - bh * 0.12 - 2, W * 2, 2);
    c.beginPath(); c.rect(-W, -bh / 2 + bh * 0.12, W * 2, bh * 0.76); c.clip();
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = FX.rgba(pal.glow, 0.5); c.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const yy = -120 + (i * 37 % 240), xx = ((i * 211 + t * (left ? -70 : 70)) % (W * 2) + W * 2) % (W * 2) - W; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + 180, yy); c.stroke(); }
    FX.circle(c, key, left ? 230 : -230, 0, 210, t * 0.04, 0.55, false, 1);
    c.globalCompositeOperation = 'source-over';
    const im = IMG['cut_' + key];
    if (im && im.ok) {
      const sw = im.width, sh = im.height * 0.5, dw = 560, dh = dw * sh / sw, px = (left ? -330 : 330) + (left ? -1 : 1) * (1 - e) * 500 + (left ? 1 : -1) * t * 0.5;
      c.save(); c.translate(px, key === 'man' ? 100 : 40); if (!left) c.scale(-1, 1); c.rotate(0.09); c.imageSmoothingEnabled = false;
      c.drawImage(im, 0, im.height * 0.02, sw, sh, -dw / 2, -dh / 2, dw, dh); c.restore();
    }
    c.restore();
    // 技の名
    const tx = left ? W - 250 : 250, a2 = Math.min(1, Math.max(0, (t - 6) / 8));
    c.globalAlpha = out * a2; c.shadowBlur = 26; c.shadowColor = FX.rgba(pal.glow, 1);
    text(cut.name, tx + (1 - a2) * (left ? 60 : -60), 268, 68, '#fbf6e4', 'center');
    c.shadowBlur = 0; text(cut.sub, tx, 312, 19, FX.rgba(pal.acc, 1), 'center');
    c.restore();
  }

  // ---------------------------------------------------------------- 描く：題と選択
  function backdrop(t) {
    const im = IMG['st_manor'];
    c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H);
    if (im && im.ok) { const sc = H / im.height, dw = im.width * sc; c.imageSmoothingEnabled = false; c.globalAlpha = 0.6; c.drawImage(im, Math.round(-((dw - W) / 2) + Math.sin(t / 400) * 120), 0, dw, H); c.globalAlpha = 1; }
    const gr = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 560); gr.addColorStop(0, 'rgba(5,6,16,0.25)'); gr.addColorStop(1, 'rgba(3,3,10,0.92)');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }
  function menu(items, x, y, sel, gap) {
    items.forEach((s, i) => {
      const on = i === sel, yy = y + i * (gap || 44);
      if (on) { c.fillStyle = 'rgba(214,205,180,0.2)'; c.fillRect(x - 180, yy - 28, 360, 38); c.fillStyle = '#f6e7a8'; c.fillRect(x - 180, yy - 28, 4, 38); c.fillRect(x + 176, yy - 28, 4, 38); }
      text(s, x, yy, 24, on ? '#fff6d0' : '#6f6d88', 'center');
    });
  }
  function nav(n, cols) {
    if (hit('up')) { st.sel = (st.sel + n - 1) % n; SND.play('select'); }
    if (hit('down')) { st.sel = (st.sel + 1) % n; SND.play('select'); }
  }

  const SCN = {
    title: {
      step() {
        nav(4);
        if (hit('ok')) {
          SND.play('confirm');
          if (st.sel === 3) return go('howto', { from: 'title' });
          cfg.mode = ['solo', 'two', 'watch'][st.sel]; go('select', { side: 0, pick: [cfg.p1 === 'man' ? 1 : 0, cfg.p2 === 'man' ? 1 : 0] });
        }
      },
      draw() {
        backdrop(st.t);
        FX.circle(c, 'man', W / 2, 190, 250 + Math.sin(st.t / 50) * 6, st.t * 0.004, 0.22, false, 1);
        FX.circle(c, 'girl', W / 2, 190, 170, -st.t * 0.007, 0.28, false, 1);
        sprite(c, 'girl', 'idle', Math.floor(st.t / 9) % 4, 250, 500, 1);
        sprite(c, 'man', 'idle', Math.floor(st.t / 9) % 4, W - 250, 500, -1);
        c.shadowBlur = 30; c.shadowColor = '#7c9cff';
        text(TITLE, W / 2, 170, 76, '#fbf6e4', 'center'); c.shadowBlur = 0;
        text(SUBTITLE, W / 2, 222, 30, '#f6e7a8', 'center');
        menu(['ひとりで（CPU と闘う）', 'ふたりで', '見る（CPU 同士）', 'あそびかた'], W / 2, 318, st.sel);
        text('↑↓ でえらぶ　Z か Enter できめる', W / 2, 516, 14, '#8f8da8', 'center', GOTH);
      },
    },
    select: {
      step() {
        const two = cfg.mode === 'two', s = st.side;
        if (hit('left') || hit('right')) { st.pick[s] = 1 - st.pick[s]; SND.play('select'); }
        if (hit('back')) { SND.play('cancel'); if (s > 0) st.side--; else go('title'); return; }
        if (hit('ok')) {
          SND.play('confirm');
          if (s === 0) { st.side = 1; if (!st.touched) st.pick[1] = 1 - st.pick[0]; return; }
          cfg.p1 = st.pick[0] ? 'man' : 'girl'; cfg.p2 = st.pick[1] ? 'man' : 'girl';
          go(cfg.mode === 'solo' ? 'level' : 'stage', { sel: cfg.mode === 'solo' ? cfg.lvl : cfg.stage });
        }
      },
      draw() {
        backdrop(st.t);
        text(st.side === 0 ? (cfg.mode === 'two' ? '1P　闘う者をえらぶ' : 'あなたが使う者をえらぶ') : (cfg.mode === 'two' ? '2P　闘う者をえらぶ' : '相手をえらぶ'), W / 2, 60, 28, '#fbf6e4', 'center');
        ['girl', 'man'].forEach((k, i) => {
          const x = i ? W / 2 + 200 : W / 2 - 200, ch = CH[k], on0 = st.pick[0] === i, on1 = st.side === 1 && st.pick[1] === i, cur = st.pick[st.side] === i;
          FX.circle(c, k, x, 300, cur ? 170 : 130, st.t * 0.01 * (i ? -1 : 1), cur ? 0.5 : 0.15, false, 1);
          sprite(c, k, 'idle', cur ? Math.floor(st.t / 9) % 4 : 0, x, 440, i ? -1 : 1, cur ? {} : { alpha: 0.55 });
          text(ch.name, x, 482, 30, cur ? '#fbf6e4' : '#8f8da8', 'center'); text(ch.sub, x, 506, 14, '#9c9ab8', 'center', GOTH);
          if (on0) text(cfg.mode === 'two' ? '1P' : 'あなた', x - 70, 120, 18, '#9fd0ff', 'center', GOTH);
          if (on1) text(cfg.mode === 'two' ? '2P' : cfg.mode === 'watch' ? 'CPU' : '相手', x + 70, 120, 18, '#ff9fb0', 'center', GOTH);
        });
        text('←→ でえらぶ　Z できめる　X でもどる', W / 2, 530, 14, '#8f8da8', 'center', GOTH);
      },
    },
    level: {
      step() { nav(3); if (hit('back')) { SND.play('cancel'); return go('select', { side: 1, pick: [cfg.p1 === 'man' ? 1 : 0, cfg.p2 === 'man' ? 1 : 0] }); } if (hit('ok')) { SND.play('confirm'); cfg.lvl = st.sel; go('stage', { sel: cfg.stage }); } },
      draw() { backdrop(st.t); text('相手の強さ', W / 2, 150, 34, '#fbf6e4', 'center'); menu(['やさしい', 'ふつう', 'つよい'], W / 2, 250, st.sel, 54); text(['はじめての人へ。相手はあまり守らない', '守り、つなぎ、ときどき奥義を使う', '隙を見逃さない'][st.sel], W / 2, 440, 16, '#9c9ab8', 'center', GOTH); },
    },
    stage: {
      step() { nav(STAGES.length); if (hit('back')) { SND.play('cancel'); return go('title'); } if (hit('ok')) { SND.play('confirm'); cfg.stage = st.sel; if (!seenHowto && cfg.mode !== 'watch') go('howto', { from: 'pre' }); else startMatch(); } },
      draw() { const keep = cfg.stage; cfg.stage = st.sel; drawStage((F.STAGE - W) / 2 + Math.sin(st.t / 120) * 200); cfg.stage = keep; c.fillStyle = 'rgba(3,3,10,0.45)'; c.fillRect(0, 0, W, H); text('場所', W / 2, 110, 34, '#fbf6e4', 'center'); menu(STAGES.map(s => s.name), W / 2, 240, st.sel, 54); },
    },
    howto: {
      step() {
        if (hit('left') && st.sel > 0) { st.sel--; SND.play('select'); }
        if (hit('right') || hit('ok')) {
          if (st.sel < 2) { st.sel++; SND.play('select'); }
          else if (hit('ok')) { SND.play('confirm'); seenHowto = true; if (st.from === 'pre') startMatch(); else go('title'); }
        }
        if (pressed.Escape) { if (st.from === 'pre') { seenHowto = true; startMatch(); } else go('title'); }
      },
      draw() { backdrop(st.t); drawHowto(); },
    },
    fight: { step: stepFight, draw: drawFight },
    result: {
      step() {
        if (st.t < 40) return; nav(3);
        if (hit('ok')) { SND.play('confirm'); if (st.sel === 0) startMatch(); else if (st.sel === 1) { SND.music('title'); go('select', { side: 0, pick: [cfg.p1 === 'man' ? 1 : 0, cfg.p2 === 'man' ? 1 : 0] }); } else { SND.music('title'); go('title'); } }
      },
      draw() {
        drawFight();
        const a = Math.min(1, st.t / 30); c.fillStyle = 'rgba(3,3,10,' + 0.78 * a + ')'; c.fillRect(0, 0, W, H);
        c.globalAlpha = a;
        const w = st.w, f = w >= 0 ? g.f[w] : null;
        if (f) {
          const im = IMG['cut_' + f.key];
          FX.circle(c, f.key, 250, 270, 230, st.t * 0.006, 0.35, false, 1);
          if (im && im.ok) { const dh = 500, dw = dh * im.width / im.height; c.imageSmoothingEnabled = false; c.drawImage(im, 250 - dw / 2, 30, dw, dh); }
          text(f.ch.name + ' の勝ち', 640, 150, 44, '#fbf6e4', 'center');
          text(f.key === 'girl' ? '「……おやすみ」' : '「もう終わった」', 640, 205, 24, '#f6e7a8', 'center');
          if (cfg.mode === 'solo') text(w === 0 ? 'あなたの勝ち' : 'あなたの負け', 640, 250, 16, '#9c9ab8', 'center', GOTH);
        } else text('相打ち', 640, 170, 44, '#fbf6e4', 'center');
        if (st.t >= 40) menu(['もう一度', '闘う者をえらびなおす', '題へもどる'], 640, 340, st.sel);
        c.globalAlpha = 1;
      },
    },
  };

  function keycap(s, x, y, w) {
    w = w || 34; c.fillStyle = '#191b30'; c.strokeStyle = '#d6cdb4'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x - w / 2, y - 16, w, 32, 5); c.fill(); c.stroke();
    text(s, x, y + 6, 16, '#fbf6e4', 'center', GOTH, 0);
  }
  function drawHowto() {
    const two = cfg.mode === 'two', pg = st.sel;
    text('あそびかた　' + (pg + 1) + ' / 3', W / 2, 52, 30, '#fbf6e4', 'center');
    const L = (s, x, y, col, sz) => text(s, x, y, sz || 17, col || '#d9d6ea', 'left', GOTH);
    if (pg === 0) {
      text('相手の体力をなくせば勝ち。先に二本とったほうが勝ち。', W / 2, 96, 18, '#f6e7a8', 'center', GOTH);
      if (!two) {
        keycap('←', 150, 190); keycap('→', 230, 190); keycap('↑', 190, 152); keycap('↓', 190, 190);
        L('うごく（W A S D でも）', 280, 162); L('↑ 跳ぶ（空中でもう一度跳べる）　↓ しゃがむ', 280, 190); L('相手と反対へ入れていると、守る', 280, 218, '#9fd0ff');
        keycap('Z', 150, 290); keycap('X', 190, 290); keycap('C', 230, 290);
        L('弱・中・強の攻め（J K L でも）', 280, 282); L('弱 → 中 → 強 と順に押すと、つながる', 280, 310, '#9fd0ff');
        keycap('スペース', 190, 370, 114); L('技（U でも）。押すだけで必殺の技が出る', 280, 362); L('→ と一緒で対空、← と一緒で別の技', 280, 390, '#9fd0ff');
        keycap('V', 190, 450); L('盾（I でも）。攻めを受けとめると、すぐやり返せる', 280, 456);
      } else {
        text('1P', 250, 140, 22, '#9fd0ff', 'center'); text('2P', 710, 140, 22, '#ff9fb0', 'center');
        const row = (y, a, b, s) => { a.forEach((k, i) => keycap(k, 250 - (a.length - 1) * 20 + i * 40, y)); b.forEach((k, i) => keycap(k, 710 - (b.length - 1) * 20 + i * 40, y)); text(s, 480, y + 6, 17, '#d9d6ea', 'center', GOTH); };
        row(190, ['W', 'A', 'S', 'D'], ['↑', '←', '↓', '→'], 'うごく・跳ぶ・しゃがむ');
        row(250, ['C', 'V', 'B'], ['J', 'K', 'L'], '弱・中・強');
        row(310, ['G'], ['O'], '技（押すだけ）');
        row(370, ['F'], ['I'], '盾');
        text('相手と反対へ入れていると守る。弱 → 中 → 強 はつながる。', W / 2, 440, 17, '#9fd0ff', 'center', GOTH);
      }
    } else if (pg === 1) {
      text('夜のゲージ（画面の下）', W / 2, 96, 20, '#f6e7a8', 'center');
      L('攻めたり受けたりすると溜まる。三本まで。', 150, 150);
      L('一本あれば　つないでいる途中の「技」が、強い技に変わる', 150, 200); L('（強ボタンで技を出しても同じ）', 190, 226, '#9c9ab8', 15);
      L('二本あれば　↓ と「技」で、奥義', 150, 280); L('（← ↓ → と入れて強、でも出る）', 190, 306, '#9c9ab8', 15);
      L('走る　　　→ をすばやく二度。または弱と中を同時に', 150, 360); L('空中でも一度だけ走れる。← 二度で跳び退く', 190, 386, '#9c9ab8', 15);
      L('技の入れ方に慣れた人へ　↓↘→＋攻め　→↓↘＋攻め　↓↙←＋攻め', 150, 440, '#9fd0ff');
    } else {
      const col = [[W / 2 - 220, 'girl'], [W / 2 + 220, 'man']];
      for (const [x, k] of col) {
        const ch = CH[k]; sprite(c, k, 'idle', Math.floor(st.t / 9) % 4, x - 150, 330, 1);
        text(ch.name, x - 60, 120, 26, '#fbf6e4', 'left');
        const T = k === 'girl'
          ? [['技', '白い爪', '猫になって駆け抜ける'], ['→ 技', '月弧', '跳ね上がる爪。跳んでくる相手に'], ['← 技', '夢の輪', '離れた床に陣を置く'], ['↓ 技', '名もなき夢', '奥義。広間ごと吹き飛ばす']]
          : [['技', '影の口', '床を這う口を放つ'], ['→ 技', '影柱', '足元から影が立つ'], ['← 技', '影渡り', '影に沈み、相手の後ろに立つ'], ['↓ 技', '千年の眠り', '奥義。相手の足元が口を開く']];
        T.forEach((r, i) => { L(r[0], x - 60, 160 + i * 56, '#9fd0ff', 15); text(r[1], x, 160 + i * 56, 20, '#f6e7a8', 'left'); L(r[2], x - 60, 182 + i * 56, '#b9b6cf', 14); });
      }
      text('軽くて速い。空から、床から。', W / 2 - 220, 420, 15, '#9c9ab8', 'center', GOTH); text('遅いが、遠くまで届く。', W / 2 + 220, 420, 15, '#9c9ab8', 'center', GOTH);
    }
    text(pg < 2 ? '→ つぎへ' : 'Z か Enter ではじめる', W / 2, 512, 18, st.t % 60 < 40 ? '#fbf6e4' : '#8f8da8', 'center', GOTH);
  }

  // ---------------------------------------------------------------- まわす
  function fit() {
    const dpr = window.devicePixelRatio || 1, aw = innerWidth * dpr, ah = innerHeight * dpr;
    let k = Math.min(aw / W, ah / H); if (k >= 1) k = Math.floor(k * 2) / 2 >= 1 && Number.isInteger(Math.floor(k)) ? Math.max(1, Math.floor(k)) : k;
    cv.style.width = (W * k / dpr) + 'px'; cv.style.height = (H * k / dpr) + 'px';
  }
  addEventListener('resize', fit); fit();

  let last = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (pending > 0 && now < 6000) { c.fillStyle = '#05060d'; c.fillRect(0, 0, W, H); return; }
    if (!last) last = now;
    acc += Math.min(100, now - last); last = now;
    let n = 0;
    while (acc >= 1000 / 60 && n < 4) { acc -= 1000 / 60; n++; tick(); }
    if (n) { SCN[scene].draw(); }
  }
  function tick() {
    pressed = {}; for (const k of pressedQ) pressed[k] = true; pressedQ.length = 0;
    st.t++; if (scene !== 'fight') FX.tick();
    if (pressed.KeyM) SND.setMute(!SND.muted);
    SCN[scene].step();
  }

  // 確認用：?auto（CPU 同士ですぐ始める）?p1= ?p2= ?lvl= ?stage= ?skip=コマ数（そこまで進めて止める）
  window.FIGHT_UI = { onEvents, get g() { return g; }, cfg, startMatch, tick, draw: () => SCN[scene].draw(), go, get scene() { return scene; }, sprite, frameOf, c };
  FX.init();
  FX.has = a => !!(ATLAS.fx && IMG.atlas_fx && IMG.atlas_fx.ok && ATLAS.fx.frames[a] && ATLAS.fx.frames[a].length);
  FX.spr = (ctx, a, i, x, y, face, o) => sprite(ctx, 'fx', a, i, x, y, face, o);
  if (Q.get('p1')) cfg.p1 = Q.get('p1'); if (Q.get('p2')) cfg.p2 = Q.get('p2'); if (Q.get('lvl')) cfg.lvl = +Q.get('lvl'); if (Q.get('stage')) cfg.stage = +Q.get('stage');
  if (Q.has('test')) { window.FIGHT_TEST && window.FIGHT_TEST.show(); return; }
  if (Q.has('auto') || Q.has('skip')) {
    cfg.mode = Q.get('mode') || 'watch'; seenHowto = true;
    const run = () => { startMatch(); const n = +(Q.get('skip') || 0); for (let i = 0; i < n; i++) tick(); SCN[scene].draw(); if (!Q.has('skip')) requestAnimationFrame(frame); window.FIGHT_READY = true; };
    const wait = () => (pending > 0 ? setTimeout(wait, 50) : run()); wait();
    return;
  }
  SND.music('title');
  requestAnimationFrame(frame);
})();
