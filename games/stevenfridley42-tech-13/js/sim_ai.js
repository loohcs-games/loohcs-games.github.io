'use strict';
// ===== フィールド上のAI（各選手の目標速度を決める） =====
const QUICK = new Set(['slant', 'hitch', 'quick_out', 'flat', 'stick', 'bubble', 'screen', 'swing']);
const DEEP = new Set(['go', 'post', 'corner', 'seam', 'fade', 'wheel', 'deep_out']);
const isBlockJob = j => j === 'pblock' || j === 'rblock' || j === 'lead' || j === 'jam' || j === 'kblock' || j === 'wall';

Object.assign(Sim.prototype, {
  goTo(p, x, y, frac = 1, arrive = 0.6) {
    const n = U.norm(x - p.x, y - p.y);
    let s = p.top * frac; if (n.l < arrive * 3) s *= U.clamp(n.l / (arrive * 3), 0, 1);
    p.dvx = n.x * s; p.dvy = n.y * s;
  },
  stop(p) { p.dvx = 0; p.dvy = 0; },
  carrier() { return this.ball.car; },
  // 追跡：迎撃点を狙う
  pursue(p, tgt, frac = 1) {
    // 迎撃点：|C + V*T - P| = speed*T を解く
    const rx = tgt.x - p.x, ry = tgt.y - p.y, vx = tgt.vx || 0, vy = tgt.vy || 0, sp = p.top * 0.97;
    const a = vx * vx + vy * vy - sp * sp, b = 2 * (rx * vx + ry * vy), c = rx * rx + ry * ry;
    let T;
    if (Math.abs(a) < 1e-6) T = b < 0 ? -c / b : 1;
    else { const disc = b * b - 4 * a * c; if (disc < 0) T = 1; else { const t1 = (-b - Math.sqrt(disc)) / (2 * a), t2 = (-b + Math.sqrt(disc)) / (2 * a); T = Math.min(...[t1, t2].filter(t => t > 0), 99); if (T === 99) T = 1; } }
    T = U.clamp(T, 0, 2.5);
    let tx = tgt.x + vx * T, ty = tgt.y + vy * T;
    // サイドライン・エンドゾーンでクリップ
    ty = U.clamp(ty, 0, FIELD.WID);
    this.goTo(p, tx, ty, frac, 0.05);
  },
  readDelay(p) { return 0.18 + (100 - p.a.awr) * 0.008 + (this.paRun && !this.passThrown ? 0.45 : 0); },
  nearestOpp(p, filter, maxD = 99) {
    let best = null, bd = maxD;
    for (const q of this.P) if (q.side !== p.side && (!filter || filter(q))) { const d = U.dist(p.x, p.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
    return best;
  },

  think(p, dt) {
    if (p.stun > 0 || p.down) { this.stop(p); return; }
    if (p.eng || (p.engBy && p.engBy.length)) return; // ブロック中は別処理
    const b = this.ball, car = b.car;
    // ボールキャリア
    if (car === p && p.job === 'handoff') return this.thinkHandoffQB(p);
    if (car === p) { if (!(p.job === 'qb' && !this.qbFree())) { this.thinkCarrier(p, dt); return; } }
    // ルーズボール
    if (b.st === 'loose') { this.goTo(p, b.x, b.y, 1, 0.1); return; }
    // キャリアの味方 → ブロック、敵 → 追跡（パス前のQBは除く）
    const live = car && !(car === this.qb && this.kind === 'scrim' && !this.qbFree());
    if (live && car !== p) {
      if (p.side === car.side) {
        if (['QB', 'K', 'P'].includes(p.pos) && p.job !== 'qb') { const dd = this.g.dirOf(p.side); return this.goTo(p, car.x - dd * 6, car.y, 0.45, 1); }
        if (p.job !== 'qb' || this.handed || this.passThrown) { this.thinkLead(p, car); return; }
      }
      else {
        const since = this.t - (this.liveAt || 0);
        if (since > (p.react != null ? p.react : this.readDelay(p)) || U.dist(p.x, p.y, car.x, car.y) < 4) { this.pursue(p, car); return; }
      }
    }
    switch (p.job) {
      case 'qb': return this.thinkQB(p, dt);
      case 'handoff': return this.thinkHandoffQB(p);
      case 'runner': case 'qbrun': return this.thinkRunner(p);
      case 'fake': return this.thinkFake(p);
      case 'route': return this.thinkRoute(p);
      case 'pblock': return this.thinkPassBlock(p);
      case 'rblock': return this.thinkRunBlock(p);
      case 'lead': return this.thinkLead(p, car || this.qb);
      case 'rush': return this.thinkRush(p);
      case 'man': return this.thinkMan(p);
      case 'zone': return this.thinkZone(p);
      case 'spy': return this.thinkSpy(p);
      case 'qbdone': { const w = this.toW(-4, (this.holeL || 0) > 0 ? -6 : 6); return this.goTo(p, w.x, w.y, 0.5); }
      default: return this.thinkSpecial(p, dt);
    }
  },
  qbFree() { // QBがランナーになったか（スクランブルでLOS越え）
    return this.qb && (this.fwd(this.qb.x, this.off) > 0 || this.qbScramble);
  },

  // ---- オフェンス ----
  thinkQB(p, dt) {
    const pa = this.paRun, gun = this.offPlay.f.startsWith('gun') || this.offPlay.f === 'shotgun' || this.offPlay.f === 'pistol';
    if (this.offPlay.t === 'spike' || this.offPlay.t === 'kneel') return this.stop(p);
    if (this.passThrown) { this.goTo(p, p.x, p.y, 0); return; }
    if (pa && this.t < 0.75) { const w = this.toW(gun ? -4.6 : -3, 0.6 * this.mirror); return this.goTo(p, w.x, w.y, 0.55); }
    const drop = this.offPlay.t === 'screen' ? -8 : pa ? -8 : gun ? -6.5 : -7.2;
    if (!p.dropped) {
      const w = this.toW(drop, 0);
      if (U.dist(p.x, p.y, w.x, w.y) < 0.4) p.dropped = true;
      return this.goTo(p, w.x, w.y, 0.8, 0.3);
    }
    // ポケット内：プレッシャーから逃げる
    const r = this.nearestOpp(p, q => !q.eng && !(q.engBy && q.engBy.length) && q.job === 'rush', 4);
    if (r) {
      const n = U.norm(p.x - r.x, p.y - r.y);
      p.dvx = n.x * p.top * 0.6; p.dvy = n.y * p.top * 0.6;
      if (p.human < 0 && p.a.spd > 80 && this.t > 2.2 && U.chance(dt * 1.2)) this.qbScramble = true;
    } else {
      // 少しずつステップアップ
      const w = this.toW(drop + Math.min(2, (this.t - 1.5) * 0.8), 0); this.goTo(p, w.x, w.y, 0.25, 0.3);
    }
    if (p.human < 0 && !this.passThrown) this.aiThrow(p, dt, !!r);
  },
  aiThrow(p, dt, pressured) {
    p.readT = (p.readT || 0) - dt; if (p.readT > 0) return; p.readT = 0.1;
    const best = this.bestTarget(p);
    const t = this.t, hard = this.g.settings.diff;
    const thr = pressured ? 1.0 : 2.6 - hard * 0.15 - Math.min(1.0, Math.max(0, t - 2.8) * 0.5);
    if (best && best.val >= thr && t >= best.ready) return this.throwBall(p, best.r, best.lob ? 'lob' : 'auto');
    if (t > 4.6 || (pressured && t > 3.2)) {
      if (best && best.val > 0.4) return this.throwBall(p, best.r, 'auto');
      // 投げ捨て
      if (U.chance(0.5)) this.throwAway(p); else if (p.a.spd > 78) this.qbScramble = true;
    }
  },
  bestTarget(qb) {
    let best = null;
    for (const r of this.receivers) {
      if (r.job !== 'route' || r.down || r.stun > 0) continue;
      const rt = r.route.name, delay = r.route.delay || 0;
      const ready = (QUICK.has(rt) ? 0.75 : DEEP.has(rt) ? 2.0 : 1.5) + delay;
      const d = U.dist(qb.x, qb.y, r.x, r.y), T = d / 19;
      const rx = r.x + r.vx * T, ry = r.y + r.vy * T;
      if (ry < 1 || ry > FIELD.WID - 1) continue;
      let sep = 9;
      for (const q of this.P) {
        if (q.side === r.side || q.job === 'rush') continue;
        const qx = q.x + q.vx * T * 0.6, qy = q.y + q.vy * T * 0.6;
        sep = Math.min(sep, U.dist(qx, qy, rx, ry) - (q.eng ? 2 : 0));
        // パスコース上の守備
        const seg = this.segDist(qb.x, qb.y, rx, ry, q.x, q.y);
        if (seg.d < 1.3 && seg.t > 0.25 && seg.t < 0.9) sep -= 1.2;
      }
      const gain = this.fwd(rx, this.off);
      let val = sep + U.clamp(gain, -3, 25) * 0.05 + (gain >= this.g.toGo ? 0.6 : 0);
      if (this.screenTarget === r) val += this.t > 1.2 ? 2 : -9;
      if (this.callFor === r) val += 1.2;
      if (this.offPlay.hail) val = 3 + Math.random();
      if (!best || val > best.val) best = { r, val, ready, lob: DEEP.has(rt) && gain > 18 };
    }
    return best;
  },
  segDist(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = U.clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1);
    return { d: U.dist(px, py, ax + dx * t, ay + dy * t), t };
  },
  thinkHandoffQB(p) {
    const r = this.runner; if (!r || this.handed) { p.job = 'qbdone'; return; }
    const m = r.path[0], w = { x: p.sx + (m.x - p.sx) * 0.45, y: p.sy + (m.y - p.sy) * 0.6 };
    this.goTo(p, w.x, w.y, 0.6, 0.2);
  },
  thinkRunner(p) {
    if (this.t < (p.runDelay || 0)) return this.stop(p);
    const rp = this.runPlay, pts = p.path;
    if (p.pathI >= pts.length) { this.thinkCarrier(p, 0); return; }
    const w = pts[p.pathI];
    // ハンドオフ前はタイミングを合わせる
    let frac = 1;
    if (!this.handed && rp && rp.hand && p.pathI === 0) { const dleft = U.dist(p.x, p.y, w.x, w.y), tl = Math.max(0.05, rp.hand - this.t); frac = U.clamp(dleft / tl / p.top, 0.25, 1); }
    this.goTo(p, w.x, w.y, frac, 0.1);
    if (U.dist(p.x, p.y, w.x, w.y) < 1.0) p.pathI++;
  },
  thinkFake(p) {
    if (this.t < 0.9 && p.path) { const w = p.path[Math.min(1, p.path.length - 1)]; return this.goTo(p, w.x, w.y, 0.7); }
    p.job = 'pblock'; this.thinkPassBlock(p);
  },
  thinkRoute(p) {
    const b = this.ball;
    if (b.st === 'air' && b.kind === 'pass') {
      if (b.tgt === p) { const tl = Math.max(0.05, b.tArr - this.t), d = U.dist(p.x, p.y, b.lx, b.ly); this.goTo(p, b.lx, b.ly, U.clamp(d / tl / p.top + 0.15, 0.3, 1), 0.05); return; }
      return this.goTo(p, b.lx, b.ly, 0.5, 3);
    }
    const R = p.route;
    if (this.t < R.delay) { if (this.t < R.delay - 0.2) return this.thinkPassBlock(p); }
    if (R.i < R.pts.length) {
      const w = R.pts[R.i];
      let frac = R.screen ? 0.55 : 1;
      // カットの手前で減速（ルートランニング）
      if (R.i < R.pts.length - 1 && U.dist(p.x, p.y, w.x, w.y) < 2.2) {
        const nx = R.pts[R.i + 1], a1 = Math.atan2(w.y - p.y, w.x - p.x), a2 = Math.atan2(nx.y - w.y, nx.x - w.x);
        let da = Math.abs(a1 - a2); if (da > Math.PI) da = 2 * Math.PI - da;
        if (da > 0.6) frac = Math.min(frac, 1 - da * 0.18 * (1.2 - p.a.agi / 100));
      }
      this.goTo(p, w.x, w.y, frac, 0.05);
      if (U.dist(p.x, p.y, w.x, w.y) < 1.0) { R.i++; if (R.i >= R.pts.length) { R.ex = p.vx; R.ey = p.vy; R.endT = this.t; } }
      return;
    }
    if (R.cont && this.t - R.endT < 4) {
      const n = U.norm(R.ex, R.ey); let tx = p.x + n.x * 5, ty = p.y + n.y * 5;
      if (ty < 2 || ty > FIELD.WID - 2) { ty = U.clamp(ty, 2, FIELD.WID - 2); }
      if (tx < 1 || tx > 119) tx = U.clamp(tx, 1, 119);
      return this.goTo(p, tx, ty, 0.95, 0.1);
    }
    // 空いているスペースへ微調整（ゾーンの穴に座る）
    const q = this.nearestOpp(p, null, 5);
    if (q) { const n = U.norm(p.x - q.x, p.y - q.y); return this.goTo(p, p.x + n.x * 2, p.y + n.y * 2, 0.35, 0.1); }
    this.stop(p);
  },
  // パスプロテクション：ラッシャーに1対1で割り当て、余りはダブルチーム
  assignProtection() {
    const qb = this.qb || this.holder || this.kicker; if (!qb) return;
    const blockers = this.P.filter(p => p.side === this.off && p.job === 'pblock' && !p.down);
    const rushers = this.P.filter(p => p.side === this.def && p.job === 'rush' && !p.down && p.stun <= 0);
    const cnt = new Map(); blockers.forEach(b => b.newT = null);
    blockers.forEach(b => { if (b.eng && b.eng.job === 'rush') { b.newT = b.eng; cnt.set(b.eng, (cnt.get(b.eng) || 0) + 1); } });
    const pairs = [];
    for (const b of blockers) if (!b.newT) for (const r of rushers) {
      if (b.imm[r.id] > this.t) continue;
      const behind = this.fwd(r.x, this.off) < this.fwd(b.x, this.off) - 1.5 ? 4 : 0; // 既に抜かれた相手は不利
      pairs.push([U.dist(b.x, b.y, r.x, r.y) + Math.abs(r.y - b.y) * 0.6 + behind, b, r]);
    }
    pairs.sort((a, c) => a[0] - c[0]);
    for (const [c, b, r] of pairs) { if (b.newT || (cnt.get(r) || 0) >= 1 || c > 14) continue; b.newT = r; cnt.set(r, 1); }
    for (const [c, b, r] of pairs) { if (b.newT || (cnt.get(r) || 0) >= 2 || c > 7) continue; b.newT = r; cnt.set(r, (cnt.get(r) || 0) + 1); }
    blockers.forEach(b => b.blkT = b.newT);
  },
  thinkPassBlock(p) {
    if (p.screenRel && this.t > p.screenRel && this.screenTarget) { p.job = 'lead'; return; }
    const qb = this.qb || this.holder || this.kicker;
    const q = p.blkT;
    if (!q || q.down || q.stun > 0) { const w = this.toW(-2.2, p.l || 0); return this.goTo(p, w.x, w.y, 0.4, 0.3); }
    // キックスライド：ラッシャーとQBの間、少し先読み
    const fx = q.x + q.vx * 0.3, fy = q.y + q.vy * 0.3, n = U.norm(qb.x - fx, qb.y - fy);
    let tx = fx + n.x * 1.0, ty = fy + n.y * 1.0;
    if (this.fwd(tx, this.off) > -0.4) tx = this.losX - this.dir * 0.4;
    this.goTo(p, tx, ty, 1, 0.05);
    this.tryEngage(p, q);
  },
  thinkRunBlock(p) {
    if (!p.blkT || p.blkT.down || p.blkT.stun > 0 || p.blkT.engBy.length >= 2) {
      let best = null, bs = 1e9;
      for (const q of this.P) {
        if (q.side === p.side || q.down || p.imm[q.id] > this.t) continue;
        const ahead = this.fwd(q.x, this.off) - this.fwd(p.x, this.off);
        if (ahead < -1.5) continue;
        const s = U.dist(p.x, p.y, q.x, q.y) + Math.abs(q.y - p.y) * 0.6 + q.engBy.length * 5;
        if (s < bs) { bs = s; best = q; }
      }
      p.blkT = bs < 12 ? best : null;
    }
    const q = p.blkT;
    if (!q) { const w = this.toW(this.fwd(p.x, this.off) + 3, (p.l || 0)); return this.goTo(p, w.x, w.y, 0.6); }
    this.goTo(p, q.x, q.y, 0.95, 0.05);
    this.tryEngage(p, q);
  },
  // キャリアの前の敵をブロック
  thinkLead(p, car) {
    if (!car) return this.stop(p);
    const dir = this.g.dirOf(car.side);
    if (!p.blkT || p.blkT.down || p.blkT.stun > 0 || p.blkT.engBy.length >= 1 || p.blkT.side === p.side || U.dist(p.blkT.x, p.blkT.y, car.x, car.y) > 12) {
      let best = null, bs = 1e9;
      for (const q of this.P) {
        if (q.side === p.side || q.down || q.stun > 0 || p.imm[q.id] > this.t || q.engBy.length >= 1) continue;
        const dc = U.dist(q.x, q.y, car.x, car.y); if (dc > 11) continue;
        const between = (q.x - car.x) * dir > -2 ? 0 : 6;
        const s = dc + U.dist(p.x, p.y, q.x, q.y) * 0.8 + between;
        if (s < bs) { bs = s; best = q; }
      }
      p.blkT = best;
    }
    const q = p.blkT;
    if (!q) { return this.goTo(p, car.x + dir * 4, car.y + (p.y > car.y ? 2 : -2), 0.8); }
    const n = U.norm(car.x - q.x, car.y - q.y);
    this.goTo(p, q.x + n.x * 0.8, q.y + n.y * 0.8, 1, 0.05);
    this.tryEngage(p, q);
  },

  // ---- ディフェンス ----
  thinkRush(p) {
    const b = this.ball;
    if (b.st === 'air') { return this.goTo(p, b.lx, b.ly, 0.45, 2); }
    let tgt = this.kind === 'scrim' ? this.qb : this.kicker;
    if (this.kind === 'fg' || this.kind === 'pat') tgt = { x: this.losX - this.dir * 7, y: this.ballY, vx: 0, vy: 0 };
    if (this.kind === 'punt') tgt = { x: this.losX - this.dir * 13, y: this.ballY, vx: 0, vy: 0 };
    if (this.runner && this.handed) tgt = b.car || tgt;
    if (!tgt) return this.stop(p);
    // スナップ直後は少し横へ（エッジラッシュ）
    const edge = (p.slot === 'DE1' || p.slot === 'DE2') && this.t < 0.9;
    if (edge) { const w = { x: p.x - this.dir * 2.5, y: p.y + (p.y < this.ballY ? -1.2 : 1.2) }; return this.goTo(p, w.x, w.y, 1, 0.1); }
    this.pursue(p, tgt, 1);
  },
  thinkMan(p) {
    const r = p.man, b = this.ball;
    if (!r) return this.thinkZone(p);
    if (b.st === 'air' && b.kind === 'pass') return this.playBall(p);
    // ブロックに残ったら QB へ
    if (r.job === 'pblock' || r.job === 'rblock') { if (this.t > 1.2 && p.slot.startsWith('LB')) { return this.thinkRush(p); } return this.goTo(p, p.x, p.y, 0); }
    const lag = (p.sk.has('lockdown') ? 0.6 : 1) * (0.1 + (100 - p.a.cov) * 0.006) + (this.g.settings.diff < 1 && p.side !== this.g.humanSide ? 0.06 : 0);
    const h = this.hist(r, lag);
    const dir = this.dir, cushion = this.t < 0.8 && this.defPlay && !this.defPlay.press ? 3.5 : 1.0;
    const tx = r.x + dir * cushion + h.vx * 0.25, ty = r.y + (r.y < this.ballY ? 0.5 : -0.5) * 0.6;
    const ex = tx - p.x, ey = ty - p.y;
    p.dvx = h.vx + ex * 2.2; p.dvy = h.vy + ey * 2.2;
    const s = U.len(p.dvx, p.dvy); if (s > p.top) { p.dvx *= p.top / s; p.dvy *= p.top / s; }
    // プレス: 最初にジャム
    if (this.defPlay && this.defPlay.press && this.t < 0.8 && U.dist(p.x, p.y, r.x, r.y) < 1.4 && !r.jammed) { r.jammed = true; r.stun = 0.18 + (p.a.str - r.a.str) * 0.003; }
  },
  hist(r, lag) { // lag秒前の速度
    const h = r.hist, n = Math.round(lag / (1 / 60));
    const e = h[Math.max(0, h.length - 1 - n)]; return e || { vx: r.vx, vy: r.vy };
  },
  thinkZone(p) {
    const b = this.ball;
    if (b.st === 'air' && b.kind === 'pass') return this.playBall(p);
    if (!p.zone) return this.thinkSpy(p);
    const z = p.zone, R = z.deep ? 11 : 7;
    // 浅いゾーンはスナップ直後にランを読む（リードステップ）
    if (!z.deep && this.t < 0.6) { const w = this.toW(Math.max(3, z.d * 0.45), z.l * 0.6); return this.goTo(p, w.x, w.y, 0.3, 0.5); }
    let threat = null, ts = -1e9;
    for (const r of this.receivers || []) {
      if (r.job !== 'route') continue;
      const dz = U.dist(r.x, r.y, p.zx, p.zy); if (dz > R + 3) continue;
      const depth = this.fwd(r.x, this.off);
      const s = (z.deep ? depth * 1.5 : -dz) - dz * 0.5;
      if (s > ts) { ts = s; threat = r; }
    }
    if (!threat || this.t < 0.4) return this.goTo(p, p.zx, p.zy, z.deep ? 0.9 : 0.8, 0.5);
    if (z.deep) { // 深いゾーン：一番深い相手より常に深く（クッション）、内側レバレッジ
      const tvx = threat.vx * this.dir;
      const tx = Math.max(this.fwd(threat.x, this.off) + 6 + Math.max(0, tvx) * 0.45, z.d - 3);
      const w = this.toW(tx, -(threat.y - this.ballY) * this.dir * 0.75 + z.l * 0.25);
      return this.goTo(p, w.x, w.y, 1, 0.2);
    }
    // 浅いゾーン：ゾーン中心とレシーバーの間
    const k = 0.6, tx = p.zx + (threat.x - p.zx) * k, ty = p.zy + (threat.y - p.zy) * k;
    this.goTo(p, tx, ty, 0.95, 0.3);
  },
  playBall(p) {
    const b = this.ball, tl = b.tArr - this.t;
    const react = 0.15 + (100 - p.a.awr) * 0.006;
    if (this.t - b.tThrow < react) return;
    // 捕球点の少し手前（QB側）を狙う
    const n = U.norm(b.x - b.lx, b.y - b.ly);
    this.goTo(p, b.lx + n.x * 0.4, b.ly + n.y * 0.4, 1, 0.02);
  },
  thinkSpy(p) {
    const qb = this.qb || this.kicker; if (!qb) return this.stop(p);
    const w = this.toW(Math.max(5, this.fwd(qb.x, this.off) + 6), -(qb.y - this.ballY) * this.dir);
    this.goTo(p, w.x, w.y, 0.7, 0.3);
  },

  // ---- ボールキャリア ----
  thinkCarrier(p, dt) {
    const dir = this.g.dirOf(p.side);
    if (p.runDelay && this.t < p.runDelay && p === this.qb) return this.stop(p);
    // 予定のランコースが残っていればそれに従う（序盤）
    if (p.path && p.pathI < p.path.length && this.handed && p === this.runner && this.t < 3.5) {
      const w = p.path[p.pathI];
      const danger = this.nearestOpp(p, q => !q.eng && !(q.engBy && q.engBy.length) && !q.down, 1.8);
      if (!danger) { this.goTo(p, w.x, w.y, 1, 0.05); if (U.dist(p.x, p.y, w.x, w.y) < 1.2) p.pathI++; return; }
      p.pathI = p.path.length;
    }
    // 方向候補をスコアリング
    let best = null, bs = -1e9;
    for (let k = -6; k <= 6; k++) {
      const ang = k * 0.24, cx = Math.cos(ang) * dir, cy = Math.sin(ang);
      const look = 4.5, px = p.x + cx * look, py = p.y + cy * look;
      let danger = 0;
      for (const q of this.P) {
        if (q.side === p.side || q.down || q.stun > 0) continue;
        const eng = q.engBy && q.engBy.length ? 0.35 : 1;
        const d1 = U.dist(px, py, q.x + q.vx * 0.3, q.y + q.vy * 0.3), d2 = U.dist(p.x + cx * 1.8, p.y + cy * 1.8, q.x, q.y);
        danger += eng * (Math.exp(-d1 / 2.2) * 2.4 + Math.exp(-d2 / 1.2) * 2.0);
      }
      const side = py < 1.5 || py > FIELD.WID - 1.5 ? 3 : 0;
      const s = Math.cos(ang) * 1.6 - danger - side + (this.isOwnEZ(p, px) ? -3 : 0);
      if (s > bs) { bs = s; best = { x: cx, y: cy }; }
    }
    const f = 0.94 * this.carryFat(p);
    p.dvx = best.x * p.top * f; p.dvy = best.y * p.top * f;
    // AIの特殊ムーブ
    if (p.human < 0 && p.moveT <= 0 && U.chance(dt * 1.6)) {
      const q = this.nearestOpp(p, x => !x.down && !x.eng, 2.2);
      if (q) this.doMove(p, U.weighted(['juke', 'spin', 'truck'], m => m === 'truck' ? p.a.str - 50 : m === 'juke' ? p.a.agi - 50 : p.a.elu - 55), q);
    }
  },
  isOwnEZ(p, x) { const d = this.g.dirOf(p.side); return d === 1 ? x < 10 : x > 110; },

  // ---- スペシャルチーム ----
  thinkSpecial(p, dt) {
    const b = this.ball;
    switch (p.job) {
      case 'kicker': {
        if (this.kickState === 'run') { this.goTo(p, b.x, b.y, 0.8, 0.05); return; }
        if (b.st !== 'tee' && b.st !== 'pre') { this.goTo(p, this.losX + this.dir * 20, FIELD.WID / 2, 0.6, 1); return; }
        return this.stop(p);
      }
      case 'kcover': case 'gunner': {
        if (!this.released && p.job === 'kcover') return this.stop(p);
        const tgt = b.car ? b.car : (b.st === 'air' || b.st === 'loose') ? { x: b.lx != null ? b.lx : b.x, y: b.ly != null ? b.ly : b.y, vx: 0, vy: 0, side: p.side } : null;
        if (!tgt) { const w = this.toW(30, (p.l || 0)); return this.goTo(p, w.x, w.y); }
        if (b.car) return this.pursue(p, b.car);
        return this.goTo(p, tgt.x - this.dir * 5, tgt.y + (p.y < tgt.y ? -2 : 2), 1, 0.5);
      }
      case 'kblock': case 'prhold': {
        if (p.job === 'kblock' && !this.released) return this.stop(p);
        if (p.job === 'prhold' && this.t < 1.2) return this.stop(p);
        // リターナーの前に壁を作る
        const ret = this.returner, w = { x: ret.x + this.dir * 4 * (1 + (p.id % 3)), y: ret.y + ((p.id % 5) - 2) * 3.5 };
        if (b.car) { p.job = 'lead'; return; }
        return this.goTo(p, (b.lx != null ? b.lx : ret.x) + (w.x - ret.x), w.y, 0.8, 1);
      }
      case 'jam': { const r = p.man; if (!r) return this.stop(p); this.goTo(p, r.x + this.dir * 0.9, r.y, 1, 0.05); this.tryEngage(p, r); return; }
      case 'returner': case 'returner2': {
        if (b.st === 'air' && b.lx != null) {
          const mine = p.job === 'returner';
          if (mine) return this.goTo(p, b.lx, b.ly, 1, 0.05);
          return this.goTo(p, b.lx + this.dir * 3, b.ly + 3, 0.7, 0.5);
        }
        if (b.car) { p.job = 'lead'; return; }
        return this.stop(p);
      }
      case 'punter': case 'holder': case 'fgkicker': return this.stop(p);
    }
    this.stop(p);
  },
});
