// engine.js — 対戦の仕組み。DOM に触れない。60fps 固定、種つき乱数で決定的に進む。
// 座標：x は舞台の左から、y は床からの高さ（上が正）。向き face は +1 が右。
(function (root) {
  'use strict';
  const W = 960, H = 540, FLOOR = 478, STAGE = 1400, MAXGAP = 800, WALL = 34;
  const BIT = { U: 1, D: 2, L: 4, R: 8, A: 16, B: 32, C: 64, S: 128, X: 256 };
  const LV = [
    { hs: 14, bs: 10, stop: 6, push: 6 },
    { hs: 18, bs: 14, stop: 9, push: 7.5 },
    { hs: 22, bs: 18, stop: 12, push: 9.5 },
  ];
  const GMAX = 300;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sign = v => v < 0 ? -1 : 1;

  // ---------------------------------------------------------------- 技の表を整える
  // 通常技は su（発生まで）/ac（持続）/rc（硬直）から、絵の番号の並び seq を作る。
  // 絵の帯は 0:予備動作 1:当たる瞬間 2:振り抜き 3:戻り（A 技は 0,1,2 の三枚）。
  function prep(ch) {
    for (const k in ch.moves) {
      const m = ch.moves[k];
      m.name = k;
      if (m.su != null && !m.seq) {
        const n = m.poses || 3, su = m.su - 1, ac = m.ac, rc = m.rc;
        m.seq = n === 3
          ? [[su, 0], [ac, 1], [rc, 2]]
          : [[su, 0], [ac, 1], [Math.ceil(rc * 0.45), 2], [rc - Math.ceil(rc * 0.45), 3]];
        if (m.hit) { m.hits = [Object.assign({ f: [m.su - 1, m.su - 1 + m.ac - 1] }, m.hit)]; }
      }
      m.hits = m.hits || [];
      m.total = m.total || m.seq.reduce((s, q) => s + q[0], 0);
      m.at = m.at || {};
    }
    return ch;
  }

  // ---------------------------------------------------------------- 闘う者
  function newFighter(idx, key, x) {
    const ch = root.FIGHT_CHARS[key];
    return {
      idx, key, ch, x, y: 0, vx: 0, vy: 0, face: idx ? -1 : 1,
      st: 'idle', t: 0, mv: null, str: '', hp: ch.hp, gauge: 0, stop: 0, stun: 0,
      used: {}, rapid: 0, contact: false, hitOK: false, hitDone: [], rehit: [],
      airJumps: 1, airDashes: 1, inv: 0, combo: 0, comboDmg: 0, prorate: 1, juggle: 0, untech: 0, kd: false,
      in: 0, prev: 0, dir: 5, dirs: [], pb: {}, dashReq: 0, dashDir: 0, tapT: [-99, -99], tapOK: [false, false], upEdge: false,
      wins: 0, shieldOK: 0, shieldT: 0, crouch: false, jumpDir: 0, flash: 0, afterimg: 0, ai: null, animT: 0, shake: 0,
    };
  }

  function feed(g, f, bits) {
    f.prev = f.in; f.in = bits;
    const press = bits & ~f.prev;
    const dx = ((bits & BIT.R ? 1 : 0) - (bits & BIT.L ? 1 : 0)) * f.face;
    const dy = (bits & BIT.U ? 1 : 0) - (bits & BIT.D ? 1 : 0);
    const dir = 5 + dx + dy * 3, was = f.dir;
    f.upEdge = dy > 0 && !(was >= 7);
    f.dir = dir; f.dirs.push(dir); if (f.dirs.length > 48) f.dirs.shift();
    for (const k of [BIT.A, BIT.B, BIT.C, BIT.S, BIT.X]) {
      if (press & k) f.pb[k] = 8; else if (f.pb[k] > 0 && !(g.freeze > 0)) f.pb[k]--;
    }
    // 二度押しの走り
    if (f.dashReq > 0) f.dashReq--;
    for (let s = 0; s < 2; s++) {
      const d = s ? 4 : 6;
      if (dir === d && was !== d) {
        if (g.frame - f.tapT[s] <= 13 && f.tapOK[s]) { f.dashReq = 6; f.dashDir = s ? -1 : 1; f.tapT[s] = -99; }
        else f.tapT[s] = g.frame;
        f.tapOK[s] = false;
      }
      if (dir === 5) f.tapOK[s] = true;
    }
  }
  const take = (f, k) => f.pb[k] > 0 ? (f.pb[k] = 0, true) : false;
  const has = (f, k) => f.pb[k] > 0;

  // 方向の入力の並びを、新しいほうから探す
  function motion(f, seq, win) {
    const d = f.dirs; let i = d.length - 1, k = seq.length - 1;
    const end = Math.max(0, d.length - win);
    let lastOK = false;
    for (let j = i; j >= Math.max(0, d.length - 7); j--) if (d[j] === seq[k]) { lastOK = true; i = j; break; }
    if (!lastOK) return false;
    k--;
    for (; i >= end && k >= 0; i--) if (d[i] === seq[k]) k--;
    return k < 0;
  }

  // いま出したい行動を一つ決める（押しためを消費する）
  function want(g, f, opp, air) {
    const mv = f.ch.moves;
    const superOK = f.gauge >= 200 && mv.super && !air;
    if (superOK && has(f, BIT.C) && motion(f, [4, 2, 6], 28)) { take(f, BIT.C); return { n: 'super', s: 'C' }; }
    if (has(f, BIT.X)) {
      const d = f.dir; take(f, BIT.X);
      const down = d <= 3, fwd = d === 6 || d === 9, back = d === 4 || d === 7 || d === 1;
      if (superOK && down) return { n: 'super', s: 'C' };
      const ex = f.gauge >= 100 && (opp.st === 'hit' || opp.st === 'airhit') ? 'C' : 'B';
      if (air) return mv.j236 ? { n: 'j236', s: ex } : null;
      if (fwd && mv.sp623) return { n: 'sp623', s: ex };
      if (back && mv.sp214) return { n: 'sp214', s: ex };
      return { n: 'sp236', s: ex };
    }
    for (const [k, s] of [[BIT.C, 'C'], [BIT.B, 'B'], [BIT.A, 'A']]) {
      if (!has(f, k)) continue;
      let n = null;
      if (air) { if (mv.j236 && (motion(f, [2, 6], 16) || motion(f, [2, 3], 16))) n = 'j236'; }
      else if (mv.sp623 && motion(f, [6, 2, 3], 18)) n = 'sp623';
      else if (motion(f, [2, 6], 16) || motion(f, [2, 3], 14)) n = 'sp236';
      else if (mv.sp214 && (motion(f, [2, 4], 16) || motion(f, [2, 1], 14))) n = 'sp214';
      if (n) { take(f, k); return { n, s: s === 'C' && f.gauge < 100 ? 'B' : s }; }
    }
    if (has(f, BIT.A) && has(f, BIT.B)) { take(f, BIT.A); take(f, BIT.B); return { n: '_dash', s: f.dir === 4 || f.dir === 1 || f.dir === 7 ? -1 : 1 }; }
    if (has(f, BIT.S)) { take(f, BIT.S); return { n: '_shield' }; }
    for (const [k, s] of [[BIT.C, 'C'], [BIT.B, 'B'], [BIT.A, 'A']]) {
      if (!has(f, k)) continue;
      // A と B の同時押しを待つため、A/B は 1 フレームだけ寝かせる
      if (k !== BIT.C && f.pb[k] === 8 && !air) continue;
      take(f, k);
      return { n: (air ? 'j' : f.dir <= 3 ? '2' : '5') + s, s };
    }
    return null;
  }

  function ev(g, o) { g.events.push(o); }
  function addGauge(f, v) { const b = f.gauge; f.gauge = clamp(f.gauge + v, 0, GMAX); return b < GMAX && f.gauge >= GMAX; }
  function comboEnd(f) { f.combo = 0; f.comboDmg = 0; f.prorate = 1; f.juggle = 0; f.kd = false; }
  function neutral(f) { f.st = f.y > 0 ? 'air' : 'idle'; f.t = 0; f.mv = null; f.used = {}; f.rapid = 0; f.contact = false; f.hitOK = false; }

  function startMove(g, f, opp, n, s, cancel) {
    const m = f.ch.moves[n]; if (!m) return false;
    if (!cancel && f.y <= 0) f.face = opp.x >= f.x ? 1 : -1;
    if (m.type === 'special' && s === 'C') { if (f.gauge < 100) s = 'B'; else { f.gauge -= 100; ev(g, { k: 'ex', i: f.idx, x: f.x, y: f.y + f.ch.h * 0.5 }); } }
    if (m.type === 'super') { f.gauge -= 200; g.freeze = 62; g.freezeBy = f.idx; ev(g, { k: 'super', i: f.idx, name: m.title, x: f.x, y: f.y }); }
    f.st = 'atk'; f.mv = m; f.str = s; f.t = 0; f.hitDone = []; f.rehit = []; f.contact = false; f.hitOK = false;
    f.used[n] = 1; f.shieldOK = 0; f.crouch = !!m.low2;
    if (m.type === 'normal' && m.rapid) f.rapid++;
    ev(g, { k: 'move', i: f.idx, n, s, x: f.x, y: f.y, snd: m.snd });
    return true;
  }

  function tryAct(g, f, opp, air, cancel) {
    const w = want(g, f, opp, air);
    if (!w) return false;
    if (w.n === '_dash') {
      if (cancel) return false;
      if (air) { if (f.airDashes > 0 && f.y > 36) { f.airDashes--; f.st = 'airdash'; f.t = 0; f.vx = f.ch.airDashV * f.face * w.s; f.vy = 0; f.dashDir = w.s; ev(g, { k: 'dash', i: f.idx, x: f.x, y: f.y, air: 1 }); return true; } return false; }
      startDash(g, f, w.s); return true;
    }
    if (w.n === '_shield') { if (cancel) return false; f.st = 'shield'; f.t = 0; f.shieldT = 0; f.vx = air ? f.vx : 0; f.mv = null; ev(g, { k: 'shield', i: f.idx, x: f.x, y: f.y }); return true; }
    return startMove(g, f, opp, w.n, w.s, cancel);
  }
  function startDash(g, f, d) {
    f.dashReq = 0;
    if (d > 0) { f.st = 'dash'; f.t = 0; ev(g, { k: 'dash', i: f.idx, x: f.x, y: f.y }); }
    else { f.st = 'backdash'; f.t = 0; f.inv = 7; f.vy = 0; ev(g, { k: 'dash', i: f.idx, x: f.x, y: f.y, back: 1 }); }
  }

  // 技の途中で次の技へつなぐ
  function tryCancel(g, f, opp) {
    const m = f.mv, air = f.y > 0 && !!m.air && m.type === 'normal';
    if (f.shieldOK > 0) return tryAct(g, f, opp, f.y > 0, true);
    if (!f.contact) {
      // 当たっていなくても、弱は連打できる
      if (m.rapid && f.rapid < 3 && f.t >= m.su + m.ac && has(f, BIT.A) && !has(f, BIT.B)) {
        take(f, BIT.A); const n = (air ? 'j' : f.dir <= 3 ? '2' : '5') + 'A';
        if (f.ch.moves[n].rapid) { const r = f.rapid; delete f.used[n]; startMove(g, f, opp, n, 'A', true); f.rapid = r + 1; return true; }
      }
      return false;
    }
    if (m.type === 'super') return false;
    // 跳びでつなぐ（当たったときだけ）
    if (f.hitOK && m.jc && f.dir >= 7) {
      if (f.y <= 0) { f.st = 'prejump'; f.t = 0; f.jumpDir = f.dir - 8; f.mv = null; f.used = {}; return true; }
      if (f.airJumps > 0) { f.airJumps--; f.vy = f.ch.jumpV * 0.92; f.vx = (f.dir - 8) * f.ch.jumpVx * f.face; f.st = 'air'; f.mv = null; f.used = {}; ev(g, { k: 'jump', i: f.idx, x: f.x, y: f.y, dbl: 1 }); return true; }
    }
    const w = peek(g, f, opp, f.y > 0);
    if (!w) return false;
    const nm = f.ch.moves[w.n]; if (!nm) return false;
    if (nm.type === 'super') { want(g, f, opp, f.y > 0); return startMove(g, f, opp, w.n, w.s, true); }
    if (m.type === 'special') return false;
    if (nm.type === 'normal' && (f.used[w.n] || !!nm.air !== (f.y > 0))) { return false; }
    if (nm.type === 'special' && m.noSp) return false;
    want(g, f, opp, f.y > 0);
    return startMove(g, f, opp, w.n, w.s, true);
  }
  // 押しためを消さずに見るだけ
  function peek(g, f, opp, air) {
    const save = Object.assign({}, f.pb); const w = want(g, f, opp, air);
    f.pb = save; return w && w.n[0] !== '_' ? w : null;
  }

  // ---------------------------------------------------------------- 箱
  function hurt(f) {
    const c = f.ch;
    if (f.st === 'down' || f.st === 'getup' || f.st === 'ko' || f.st === 'win') return null;
    if (f.inv > 0) return null;
    if (f.mv && f.mv.inv && f.t >= f.mv.inv[0] && f.t <= f.mv.inv[1] && (!f.mv.invS || f.mv.invS.indexOf(f.str) >= 0)) return null;
    let h = c.h, y = f.y;
    if (f.crouch || f.st === 'crouch') h = c.ch;
    else if (f.y > 0) { h = c.h * 0.82; }
    return { x: f.x - c.w, y, w: c.w * 2, h };
  }
  function boxOf(f, b) { return { x: f.face > 0 ? f.x + b[0] : f.x - b[0] - b[2], y: f.y + b[1], w: b[2], h: b[3] }; }
  const hitRect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function canGuard(def, h, srcX) {
    if (h.guard === 'no') return false;
    const st = def.st;
    const free = st === 'idle' || st === 'walk' || st === 'crouch' || st === 'block' || (st === 'air') || st === 'land';
    if (!free) return false;
    const back = (def.in & (srcX >= def.x ? BIT.L : BIT.R)) !== 0;
    if (!back) return false;
    if (def.y > 0) return true;
    const cr = (def.in & BIT.D) !== 0;
    if (h.guard === 'low' && !cr) return false;
    if (h.guard === 'high' && cr) return false;
    return true;
  }

  // 一撃を当てる。att は闘う者、src は飛び道具のとき実体
  function applyHit(g, att, def, h, src) {
    const srcX = src ? src.x : att.x;
    const L = LV[h.lvl == null ? 1 : h.lvl];
    const dirAway = def.x === srcX ? -att.face * -1 : sign(def.x - srcX);
    const dA = src && src.vx ? sign(src.vx) : (srcX === def.x ? att.face : dirAway);
    const cx = clamp((srcX + def.x) / 2, def.x - def.ch.w, def.x + def.ch.w);
    const hb = h._r, cy = hb ? clamp(hb.y + hb.h / 2, def.y + 20, def.y + def.ch.h - 10) : def.y + def.ch.h * 0.6;
    // 盾
    if (def.st === 'shield' && def.shieldT >= 0 && h.guard !== 'no') {
      def.stop = 14; if (!src) att.stop = 20; def.shieldOK = 26; def.flash = 10;
      addGauge(def, 20);
      ev(g, { k: 'shieldHit', i: def.idx, x: cx, y: cy });
      return 2;
    }
    if (canGuard(def, h, srcX)) {
      def.st = 'block'; def.t = 0; def.stun = L.bs + (h.bs || 0); def.crouch = (def.in & BIT.D) !== 0 && def.y <= 0; def.mv = null;
      const chip = h.chip ? Math.round(h.dmg * 0.12) : 0;
      def.hp = Math.max(1, def.hp - chip);
      pushBack(g, att, def, dA, L.push * 0.9, src);
      def.stop = L.stop - 2; if (!src) att.stop = L.stop - 2;
      if (!src) att.contact = true;
      addGauge(att, h.dmg * 0.006); addGauge(def, h.dmg * 0.004);
      ev(g, { k: 'guard', i: def.idx, x: cx, y: cy, lvl: h.lvl || 0, fx: h.fx });
      return 1;
    }
    const counter = def.st === 'atk';
    let dmg = Math.round(h.dmg * def.prorate * (counter ? 1.15 : 1));
    if (def.combo > 0 && h.min) dmg = Math.max(dmg, Math.round(h.dmg * h.min));
    def.hp -= dmg; def.combo++; def.comboDmg += dmg;
    def.prorate = Math.max(0.28, def.prorate * (h.pr || 0.9));
    const wasAir = def.y > 0 || def.st === 'airhit';
    const wasCrouch = def.crouch || def.st === 'crouch';
    def.mv = null; def.shieldOK = 0; def.t = 0; def.flash = 6; def.shake = L.stop; def.used = {}; def.rapid = 0; def.contact = false; def.hitOK = false;
    if (h.launch || wasAir || def.hp <= 0) {
      const l = h.launch || [h.akb || 4.5, h.aup == null ? 6.5 : h.aup];
      def.st = 'airhit'; def.vx = dA * l[0]; def.vy = l[1]; if (def.y <= 0) def.y = 1;
      if (def.hp <= 0 && !h.launch && !wasAir) { def.vx = dA * 7; def.vy = 9; }
      def.juggle++;
      def.untech = Math.max(14, (h.untech || 34) - def.juggle * 3);
      def.crouch = false;
    } else {
      def.st = 'hit'; def.stun = L.hs + (h.hs || 0) + (counter ? 4 : 0); def.crouch = wasCrouch;
      pushBack(g, att, def, dA, h.kb == null ? L.push : h.kb, src);
    }
    if (h.kd) def.kd = true;
    const stop = L.stop + (h.stop || 0) + (counter ? 3 : 0);
    def.stop = stop; if (!src) { att.stop = stop; att.contact = true; att.hitOK = true; }
    if (addGauge(att, dmg * 0.022)) ev(g, { k: 'gmax', i: att.idx });
    if (addGauge(def, dmg * 0.012)) ev(g, { k: 'gmax', i: def.idx });
    g.comboView[att.idx] = { n: def.combo, dmg: def.comboDmg, t: g.frame };
    ev(g, { k: 'hit', i: def.idx, by: att.idx, x: cx, y: cy, lvl: h.lvl == null ? 1 : h.lvl, dir: dA, fx: h.fx, counter, dmg, n: def.combo, launch: !!h.launch });
    return 0;
  }
  function pushBack(g, att, def, dA, p, src) {
    const atWall = def.x <= g.camX + WALL + 2 || def.x >= g.camX + W - WALL - 2 || def.x <= WALL + 2 || def.x >= STAGE - WALL - 2;
    if (atWall && !src && att.y <= 0) { att.pushV = -dA * p; def.vx = 0; } else def.vx = dA * p;
  }

  // ---------------------------------------------------------------- 一人ぶんの一コマ
  function stepFighter(g, f, opp) {
    const c = f.ch;
    f.animT++;
    if (f.inv > 0) f.inv--;
    if (f.flash > 0) f.flash--;
    if (f.shieldOK > 0) f.shieldOK--;
    const ground = f.y <= 0;
    switch (f.st) {
      case 'idle': case 'walk': case 'crouch': {
        f.face = opp.x >= f.x ? 1 : -1;
        if (f.combo) comboEnd(f);
        f.crouch = false;
        if (g.phase !== 'fight') { f.st = 'idle'; f.vx = 0; break; }
        if (tryAct(g, f, opp, false, false)) break;
        if (f.dashReq > 0) { startDash(g, f, f.dashDir); break; }
        const d = f.dir;
        if (d >= 7) { f.st = 'prejump'; f.t = 0; f.jumpDir = d - 8; f.vx = 0; break; }
        if (d <= 3) { if (f.st !== 'crouch') f.t = 0; f.st = 'crouch'; f.crouch = true; f.vx = 0; break; }
        if (d === 6) { if (f.st !== 'walk') f.t = 0; f.st = 'walk'; f.vx = c.walkF * f.face; f.walkDir = 1; break; }
        if (d === 4) { if (f.st !== 'walk') f.t = 0; f.st = 'walk'; f.vx = -c.walkB * f.face; f.walkDir = -1; break; }
        if (f.st !== 'idle') f.t = 0;
        f.st = 'idle'; f.vx = 0; break;
      }
      case 'prejump':
        if (f.t >= c.preJump) {
          f.st = 'air'; f.t = 0; f.vy = c.jumpV; f.vx = f.jumpDir * c.jumpVx * f.face; f.y = 0.01;
          f.airJumps = 1; f.airDashes = 1; f.used = {};
          ev(g, { k: 'jump', i: f.idx, x: f.x, y: 0 });
        }
        break;
      case 'air': {
        if (f.combo) comboEnd(f);
        if (g.phase === 'fight') {
          if (tryAct(g, f, opp, true, false)) break;
          if (f.dashReq > 0 && f.airDashes > 0 && f.y > 36) {
            f.airDashes--; f.dashReq = 0; f.st = 'airdash'; f.t = 0; f.vy = 0; f.vx = c.airDashV * f.face * f.dashDir;
            ev(g, { k: 'dash', i: f.idx, x: f.x, y: f.y, air: 1 }); break;
          }
          if (f.upEdge && f.airJumps > 0 && f.t > 4) {
            f.airJumps--; f.vy = c.jumpV * 0.9; f.vx = (f.dir - 8) * c.jumpVx * f.face; f.t = 0;
            f.face = opp.x >= f.x ? 1 : -1;
            ev(g, { k: 'jump', i: f.idx, x: f.x, y: f.y, dbl: 1 });
          }
        }
        break;
      }
      case 'airdash':
        f.vy = 0; f.afterimg = 3;
        if (f.t >= 5 && g.phase === 'fight' && tryAct(g, f, opp, true, false)) break;
        if (f.t >= c.airDashT) { f.st = 'air'; f.t = 5; f.vx *= 0.55; }
        break;
      case 'dash':
        f.afterimg = 3;
        if (c.dashType === 'run') {
          f.vx = c.dashV * f.face;
          if (f.t >= 3 && tryAct(g, f, opp, false, false)) break;
          if (f.t >= 4 && f.dir >= 7) { f.st = 'prejump'; f.t = 0; f.jumpDir = 1.25; break; }
          if (f.t >= 10 && f.dir !== 6 && f.dir !== 3) { f.st = 'idle'; f.t = 0; f.vx *= 0.4; }
        } else {
          f.vx = (f.t < c.dashT - 4 ? c.dashV : c.dashV * 0.3) * f.face;
          if (f.t >= 6 && tryAct(g, f, opp, false, false)) break;
          if (f.t >= 5 && f.dir >= 7) { f.st = 'prejump'; f.t = 0; f.jumpDir = 1.2; break; }
          if (f.t >= c.dashT) { f.st = 'idle'; f.t = 0; f.vx = 0; }
        }
        break;
      case 'backdash':
        f.vx = (f.t < c.backT - 6 ? -c.backV : -c.backV * 0.25) * f.face;
        if (f.t >= c.backT) { f.st = 'idle'; f.t = 0; f.vx = 0; }
        break;
      case 'atk': {
        const m = f.mv, t = f.t;
        if (m.at[t]) m.at[t](f, g, opp);
        if (f.st !== 'atk' || f.mv !== m) break;
        let moved = false;
        if (m.vel) for (const v of m.vel) if (t >= v[0] && t <= v[1] && (!v[4] || v[4].indexOf(f.str) >= 0)) { f.vx = v[2] * f.face; if (v[3] != null) { f.vy = v[3]; if (f.y <= 0 && v[3] > 0) f.y = 0.01; } moved = true; }
        if (!moved && f.y <= 0) f.vx *= 0.7;
        if (m.after && t >= m.after[0] && t <= m.after[1]) f.afterimg = 3;
        if (g.phase === 'fight' && tryCancel(g, f, opp)) break;
        if (t >= m.total - 1) { const y = f.y; neutral(f); if (y > 0) { f.st = 'air'; f.t = 9; } }
        break;
      }
      case 'hit':
        f.vx *= 0.84;
        if (--f.stun <= 0) { f.st = f.crouch ? 'crouch' : 'idle'; f.t = 0; f.vx = 0; comboEnd(f); }
        break;
      case 'block':
        f.vx *= 0.84;
        if (--f.stun <= 0) { f.st = f.y > 0 ? 'air' : (f.crouch ? 'crouch' : 'idle'); f.t = 0; if (f.y <= 0) f.vx = 0; }
        break;
      case 'airhit':
        f.untech--;
        if (f.untech <= 0 && f.y > 0 && !f.kd && f.hp > 0) {
          f.st = 'air'; f.t = 9; f.inv = 16; f.vy = Math.max(f.vy, 4); f.vx *= 0.5; comboEnd(f); f.airJumps = 0; f.airDashes = 0;
          ev(g, { k: 'tech', i: f.idx, x: f.x, y: f.y + c.h * 0.5 });
        }
        break;
      case 'down':
        f.vx *= 0.8;
        if (f.t >= 30) { f.st = 'getup'; f.t = 0; }
        break;
      case 'getup':
        if (f.t >= 14) { f.st = 'idle'; f.t = 0; f.inv = 3; }
        break;
      case 'land':
        f.vx *= 0.6;
        if (f.t >= (f.landT || 3)) { f.st = 'idle'; f.t = 0; }
        break;
      case 'shield': {
        const held = (f.in & BIT.S) !== 0;
        if (f.shieldOK > 0 && g.phase === 'fight' && tryAct(g, f, opp, f.y > 0, true)) break;
        if (f.shieldT >= 0) {
          f.shieldT++;
          if ((f.shieldT >= 9 && !held) || f.shieldT >= 34) f.shieldT = -1;
        } else {
          f.shieldT--;
          if (f.shieldT <= -(f.shieldOK > 0 ? 2 : 15)) { f.shieldT = 0; neutral(f); }
        }
        if (f.y <= 0) f.vx *= 0.7;
        break;
      }
      case 'ko':
        f.vx *= ground ? 0.85 : 1;
        break;
      case 'win': f.vx = 0; break;
    }
    f.t++;
    // 動き
    const inAir = f.y > 0;
    if (inAir && f.st !== 'airdash' && !(f.st === 'atk' && f.mv && f.mv.noGrav && f.t >= f.mv.noGrav[0] && f.t <= f.mv.noGrav[1])) {
      let gr = c.grav;
      if (f.st === 'airhit' || f.st === 'ko') gr *= 1 + Math.min(0.8, f.juggle * 0.07);
      f.vy -= gr;
    }
    if (f.pushV) { f.x += f.pushV; f.pushV *= 0.8; if (Math.abs(f.pushV) < 0.4) f.pushV = 0; }
    f.x += f.vx; f.y += f.vy;
    if (inAir && f.y <= 0) {
      f.y = 0; f.vy = 0;
      if (f.st === 'airhit' || f.st === 'ko') {
        if (f.hp <= 0) { f.st = 'ko'; ev(g, { k: 'down', i: f.idx, x: f.x, y: 0 }); }
        else if (f.untech > 0 || f.kd) { f.st = 'down'; f.t = 0; comboEnd(f); ev(g, { k: 'down', i: f.idx, x: f.x, y: 0 }); }
        else { f.st = 'idle'; f.t = 0; f.vx = 0; comboEnd(f); f.inv = 4; }
        f.vx *= 0.4;
      } else if (f.st === 'atk') {
        const m = f.mv;
        if (m.landT != null) { if (f.t < m.landT) f.t = m.landT; f.vx = 0; }
        else { f.st = 'land'; f.t = 0; f.landT = m.landRec || 4; f.mv = null; f.used = {}; f.rapid = 0; }
        ev(g, { k: 'land', i: f.idx, x: f.x, y: 0 });
      } else if (f.st === 'block' || f.st === 'shield') {
        f.vx = 0;
      } else {
        f.st = 'land'; f.t = 0; f.landT = 2; f.vx = 0; f.used = {}; f.rapid = 0;
        ev(g, { k: 'land', i: f.idx, x: f.x, y: 0 });
      }
    }
    if (f.y < 0) f.y = 0;
  }

  // ---------------------------------------------------------------- 実体（飛び道具・陣）
  function spawn(g, o) {
    const e = Object.assign({ t: 0, x: 0, y: 0, vx: 0, vy: 0, delay: 0, active: 9999, life: 120, hits: 1, cool: 0, gap: 6, dead: false, w: 60, h: 60 }, o);
    g.ents.push(e); ev(g, { k: 'spawn', e });
    return e;
  }
  function stepEnts(g) {
    for (const e of g.ents) {
      e.t++; e.x += e.vx; e.y += e.vy;
      if (e.step) e.step(e, g);
      if (e.cool > 0) e.cool--;
      const on = e.t >= e.delay && e.t < e.delay + e.active && e.hits > 0 && e.hit && g.phase === 'fight';
      if (e.t === e.delay && e.hit) ev(g, { k: 'entOn', e });
      if (on && e.cool <= 0) {
        const def = g.f[1 - e.owner], hb = hurt(def);
        const r = { x: e.x - e.w / 2, y: e.y, w: e.w, h: e.h };
        if (hb && hitRect(r, hb)) {
          e.hit._r = r;
          applyHit(g, g.f[e.owner], def, e.hit, e);
          e.hits--; e.cool = e.gap;
          if (e.hits <= 0 && e.dieOnHit) { e.life = Math.min(e.life, e.t + (e.fade || 8)); e.vx = 0; e.vy = 0; e.gone = e.t; }
        }
      }
      if (e.t >= e.life || e.x < -200 || e.x > STAGE + 200) e.dead = true;
    }
    g.ents = g.ents.filter(e => !e.dead);
  }

  // ---------------------------------------------------------------- 試合
  function newGame(opt) {
    opt = Object.assign({ p1: 'girl', p2: 'man', seed: 1, need: 2, time: 99, ai: [0, 0] }, opt || {});
    const g = { opt, rnd: rng(opt.seed), frame: 0, events: [], ents: [], f: [], round: 0, comboView: [null, null], freeze: 0, freezeBy: 0, camX: (STAGE - W) / 2, winner: -1 };
    g.f = [newFighter(0, opt.p1, STAGE / 2 - 190), newFighter(1, opt.p2, STAGE / 2 + 190)];
    startRound(g);
    return g;
  }
  function startRound(g) {
    g.round++; g.phase = 'intro'; g.pt = 0; g.timer = g.opt.time * 60; g.ents = []; g.freeze = 0; g.camX = (STAGE - W) / 2;
    g.f.forEach((f, i) => {
      const w = f.wins, gz = g.round === 1 ? 0 : f.gauge, ai = f.ai;
      const n = newFighter(i, f.key, STAGE / 2 + (i ? 190 : -190));
      n.wins = w; n.gauge = gz; n.ai = ai; g.f[i] = n;
    });
    g.roundWinner = -1;
    ev(g, { k: 'round', n: g.round });
  }

  function step(g, in0, in1) {
    g.events.length = 0;
    g.frame++;
    const F = g.f;
    const live = g.phase === 'fight';
    feed(g, F[0], live ? in0 : 0); feed(g, F[1], live ? in1 : 0);
    g.pt++;
    if (g.phase === 'intro') { if (g.pt === 70) ev(g, { k: 'fight' }); if (g.pt >= 96) { g.phase = 'fight'; g.pt = 0; } }
    if (g.freeze > 0) { g.freeze--; return g; }
    if (g.phase === 'ko' && g.pt < 66 && g.pt % 3) return g;   // とどめの遅回し
    for (let i = 0; i < 2; i++) {
      const f = F[i];
      if (f.stop > 0) { f.stop--; continue; }
      stepFighter(g, f, F[1 - i]);
    }
    stepEnts(g);
    // 押し合い
    const a = F[0], b = F[1];
    const tall = (p, q) => p.y < q.y + q.ch.h * 0.75 && q.y < p.y + p.ch.h * 0.75;
    if (tall(a, b) && a.st !== 'down' && b.st !== 'down' && a.st !== 'ko' && b.st !== 'ko' && !(a.mv && a.mv.pass && a.st === 'atk') && !(b.mv && b.mv.pass && b.st === 'atk')) {
      const min = a.ch.pw + b.ch.pw, d = b.x - a.x;
      if (Math.abs(d) < min) {
        const s = d === 0 ? (a.face > 0 ? 1 : -1) : sign(d), o = (min - Math.abs(d)) / 2;
        a.x -= s * o; b.x += s * o;
      }
    }
    // 壁と視野
    const mid = (a.x + b.x) / 2;
    const tx = clamp(mid - W / 2, 0, STAGE - W);
    g.camX += clamp(tx - g.camX, -9, 9);
    for (const f of F) {
      const lo = Math.max(WALL, g.camX + WALL), hi = Math.min(STAGE - WALL, g.camX + W - WALL);
      if (f.x < lo) f.x = lo; if (f.x > hi) f.x = hi;
    }
    if (Math.abs(a.x - b.x) < 1 && a.y <= 0 && b.y <= 0) { a.x -= 1; b.x += 1; }
    // 当たり
    if (g.phase === 'fight') {
      const res = [];
      for (let i = 0; i < 2; i++) {
        const f = F[i], o = F[1 - i];
        if (f.st !== 'atk' || f.stop > 0) continue;
        const m = f.mv, t = f.t - 1;
        for (let k = 0; k < m.hits.length; k++) {
          const h = m.hits[k];
          if (h.s && h.s.indexOf(f.str) < 0) continue;
          if (t < h.f[0] || t > h.f[1]) continue;
          if (h.rehit) { if (f.rehit[k] > t) continue; } else if (f.hitDone[k]) continue;
          const hb = hurt(o); if (!hb) continue;
          const r = boxOf(f, h.box);
          if (hitRect(r, hb)) { h._r = r; res.push([f, o, h, k]); }
        }
      }
      for (const [f, o, h, k] of res) {
        if (h.rehit) f.rehit[k] = f.t - 1 + h.rehit; else f.hitDone[k] = 1;
        applyHit(g, f, o, h, null);
      }
    }
    // 勝ち負け
    if (g.phase === 'fight') {
      g.timer--;
      const d0 = F[0].hp <= 0, d1 = F[1].hp <= 0;
      if (d0 || d1 || g.timer <= 0) {
        let w = -1;
        if (d0 && !d1) w = 1; else if (d1 && !d0) w = 0;
        else if (!d0 && !d1) { const r0 = F[0].hp / F[0].ch.hp, r1 = F[1].hp / F[1].ch.hp; w = r0 > r1 ? 0 : r1 > r0 ? 1 : -1; }
        g.roundWinner = w; g.phase = 'ko'; g.pt = 0;
        for (const f of F) if (f.hp <= 0) { f.hp = 0; if (f.st !== 'airhit') { f.st = 'airhit'; f.vy = 8; f.vx = -f.face * 6; f.y = Math.max(f.y, 1); } f.kd = true; }
        ev(g, { k: g.timer <= 0 && !d0 && !d1 ? 'timeup' : 'ko', w, x: w >= 0 ? F[1 - w].x : mid, y: w >= 0 ? F[1 - w].y + 100 : 100 });
      }
    } else if (g.phase === 'ko') {
      if (g.pt === 150) {
        const w = g.roundWinner;
        if (w >= 0) { F[w].wins++; if (F[w].y <= 0 && F[w].st !== 'atk') { F[w].st = 'win'; F[w].t = 0; F[w].mv = null; } }
        else { F[0].wins++; F[1].wins++; }
        ev(g, { k: 'roundEnd', w });
      }
      if (g.pt >= 290) {
        const n = g.opt.need;
        if (F[0].wins >= n || F[1].wins >= n) {
          g.phase = 'over'; g.pt = 0;
          g.winner = F[0].wins >= n && F[1].wins >= n ? -1 : F[0].wins >= n ? 0 : 1;
          ev(g, { k: 'matchEnd', w: g.winner });
        } else startRound(g);
      }
    }
    return g;
  }

  // 絵の番号を返す（描画用）。[帯の名前, 何枚目]
  function pose(f) {
    const t = f.t, c = f.ch, A = c.anim;
    const loop = (n, per, tt) => Math.floor((tt == null ? t : tt) / per) % n;
    switch (f.st) {
      case 'idle': return ['idle', loop(A.idle, 9, f.animT)];
      case 'walk': { const i = loop(A.walk, c.walkPer || 6); return ['walk', f.walkDir < 0 ? A.walk - 1 - i : i]; }
      case 'crouch': return ['crouch', t < 4 ? 0 : 1];
      case 'prejump': return ['crouch', 0];
      case 'land': return ['crouch', 0];
      case 'air': return ['jump', f.vy > 4 ? 0 : f.vy > -4 ? 1 : 2];
      case 'airdash': return ['jump', 3];
      case 'dash': return ['dash', loop(A.dash, c.dashPer || 4)];
      case 'backdash': return ['backdash', t < 6 ? 0 : 1];
      case 'block': return ['guard', f.y > 0 ? 2 : f.crouch ? 1 : 0];
      case 'shield': return ['guard', f.y > 0 ? 2 : (f.in & BIT.D) ? 1 : 0];
      case 'hit': return ['hit', f.crouch ? 2 : (f.stun > 8 ? 0 : 1)];
      case 'airhit': return ['hit', f.vy > -3 ? 3 : 4];
      case 'ko': return f.y > 0 ? ['hit', f.vy > -3 ? 3 : 4] : ['down', 0];
      case 'down': return ['down', 0];
      case 'getup': return ['down', 1];
      case 'win': return ['win', Math.min(A.win - 1, Math.floor(t / 12))];
      case 'atk': {
        const m = f.mv; let s = 0, tt = Math.max(0, t - 1);
        for (const q of m.seq) { s += q[0]; if (tt < s) return [q[2] || m.anim, q[1]]; }
        const q = m.seq[m.seq.length - 1]; return [q[2] || m.anim, q[1]];
      }
    }
    return ['idle', 0];
  }

  root.FIGHT = { W, H, FLOOR, STAGE, BIT, GMAX, LV, rng, prep, newGame, step, pose, spawn, ev, hurt, boxOf, startMove, addGauge, clamp, motion, feed };
})(typeof window !== 'undefined' ? window : globalThis);
