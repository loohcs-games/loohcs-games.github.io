'use strict';
// ===== シミュレーション本体: 物理・ボール・タックル・操作 =====
const G = FIELD.GRAV;
Object.assign(Sim.prototype, {
  // ---------- スナップ ----------
  snap() {
    if (this.state !== 'pre') return;
    if (!this.ready) { this.snapQueued = true; return; }
    this.state = 'live'; this.t = 0; this.liveAt = 9999; SFX.snap();
    const b = this.ball, k = this.kind;
    if (k === 'scrim') {
      const qb = this.qb, sg = this.fwd(qb.x, this.off) < -2;
      b.st = 'snap'; b.snapTo = qb; b.snapT = sg ? 0.32 : 0.06; b.sx = b.x; b.sy = b.y;
      if (this.runPlay) {
        if (this.runPlay.qb) { this.runner = qb; qb.job = 'qbrun'; }
        else qb.job = 'handoff';
      }
      // 反則（プレー中）をロール
      const pt = this.passType;
      if (U.chance(this.g.settings.pen * (pt ? 0.04 : 0.035))) this.flags.push({ side: this.off, name: 'ホールディング', yds: 10, at: U.rnd(0.8, 2.5) });
      if (pt && U.chance(this.g.settings.pen * 0.012)) this.flags.push({ side: this.def, name: 'ディフェンシブ・ホールディング', yds: 5, first: 1, at: U.rnd(0.5, 2) });
    } else if (k === 'punt') { b.st = 'snap'; b.snapTo = this.kicker; b.snapT = 0.75; b.sx = b.x; b.sy = b.y; }
    else if (k === 'fg' || k === 'pat') { b.st = 'snap'; b.snapTo = this.holder; b.snapT = 0.55; b.sx = b.x; b.sy = b.y; }
    else if (k === 'kickoff') { this.kickState = 'run'; }
  },

  // ---------- 1フレーム ----------
  step(dt, ctrls) {
    this.ctrls = ctrls || [];
    if (this.state === 'pre') { this.preStep(dt); return; }
    if (this.state === 'done') { this.postStep(dt); return; }
    if (this.state !== 'live') return;
    this.t += dt; this.aimView = null;
    for (const p of this.P) {
      p.hist.push({ vx: p.vx, vy: p.vy }); if (p.hist.length > 40) p.hist.shift(); p.stun -= dt; p.moveT -= dt; p.tkCD -= dt; p.diveT = (p.diveT || 0) - dt; p.swatT = (p.swatT || 0) - dt;
      p.sprawl = (p.sprawl || 0) - dt; p.stumble = (p.stumble || 0) - dt;
      if (p.down) p.fall = Math.min(1, (p.fall || 0) + dt * 2.6);
      if (this.ball.car === p) p.carryT = (p.carryT || 0) + dt;
    }
    this.assignControl();
    this.handleInputs(dt);
    this.specialStep(dt);
    if (this.state !== 'live') return;
    this.handoffStep();
    this.protT = (this.protT || 0) - dt;
    if (this.protT <= 0 && !this.passThrown) { this.protT = 0.2; this.assignProtection(); }
    for (const p of this.P) {
      const c = p.human >= 0 ? this.ctrls[p.human] : null;
      if (c && this.humanActive(p, c)) this.humanMove(p, c); else this.think(p, dt);
    }
    this.engageStep(dt);
    this.integrate(dt);
    this.ballStep(dt);
    if (this.state === 'live') this.contactStep(dt);
    if (this.state === 'live' && this.t > 25) this.endPlay({ ty: 'tackle', x: this.ball.x, y: this.ball.y, newPoss: this.ball.car ? this.ball.car.side : this.off });
  },
  preStep(dt) {
    this.t += dt;
    this.assignControl();
    this.meterTick(dt);
    // ハドルから各ポジションへジョグで移動
    let ready = true;
    for (const p of this.P) {
      if (p.tx == null) { p.vx = 0; p.vy = 0; p.anim += dt * 0.5; continue; }
      const d = U.dist(p.x, p.y, p.tx, p.ty);
      if (d > 0.08 && this.t < 3.2) {
        ready = false; const s = Math.min(d / dt, p.ws || 5), n = U.norm(p.tx - p.x, p.ty - p.y);
        p.vx = n.x * s; p.vy = n.y * s; p.x += p.vx * dt; p.y += p.vy * dt; p.face = Math.atan2(n.y, n.x); p.anim += dt * (1.5 + s * 1.1);
      } else { p.x = p.tx; p.y = p.ty; p.tx = null; p.vx = 0; p.vy = 0; p.face = this.g.dirOf(p.side) === 1 ? 0 : Math.PI; }
    }
    if (ready && !this.ready) { this.ready = true; this.readyAt = this.t; if (this.snapQueued) { this.snapQueued = false; this.snap(); return; } }
    this.handleInputs(dt, true);
  },
  huddle() {
    this.ready = false; this.snapQueued = false;
    for (const p of this.P) {
      const d = this.g.dirOf(p.side);
      p.tx = p.x; p.ty = p.y;
      const hx = this.kind === 'kickoff' ? p.x - d * 7 : this.losX - d * 8 + U.rnd(-1.3, 1.3);
      const hy = this.kind === 'kickoff' ? p.y + U.rnd(-1, 1) : U.clamp(this.ballY + U.rnd(-2.3, 2.3), 2, FIELD.WID - 2);
      p.x = hx; p.y = hy; p.ws = Math.max(4.5, U.dist(hx, hy, p.tx, p.ty) / 1.7);
    }
  },
  // 笛の後：倒れる・減速するアニメーション
  postStep(dt) {
    this.t += dt;
    for (const p of this.P) {
      if (p.down) { p.fall = Math.min(1, (p.fall || 0) + dt * 2.6); p.vx *= 0.9; p.vy *= 0.9; }
      else { p.vx *= 0.93; p.vy *= 0.93; }
      p.sprawl = (p.sprawl || 0) - dt; p.stumble = (p.stumble || 0) - dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.anim += dt * (0.5 + U.len(p.vx, p.vy) * 1.1);
    }
    const b = this.ball;
    if (b.car && b.st === 'held') { b.x = b.car.x + Math.cos(b.car.face) * 0.3; b.y = b.car.y; b.z = b.car.down ? 0.3 + (1 - (b.car.fall || 0)) * 0.8 : 1.1; }
    else if (b.st === 'air' || b.st === 'loose') { b.z = Math.max(0, b.z - dt * 6); b.vx *= 0.8; b.vy *= 0.8; b.x += b.vx * dt; b.y += b.vy * dt; }
  },

  // ---------- 操作の割り当て ----------
  assignControl() {
    for (const p of this.P) p.human = -1;
    const b = this.ball;
    this.ctrls.forEach((c, i) => {
      let cur = null;
      if (c.kind === 'player') cur = this.P.find(p => p.info.key === c.key) || null;
      else {
        const offSide = c.side === this.off;
        if (b.car && b.car.side === c.side && this.state === 'live') cur = b.car;
        else if (b.st === 'air' && b.kind === 'pass' && b.from && b.from.side === c.side && b.tgt) cur = b.tgt;
        else if (this.kind === 'scrim' && offSide) cur = this.handed && this.runner ? this.runner : this.qb;
        else if ((this.kind === 'kickoff' || this.kind === 'punt' || this.kind === 'fg' || this.kind === 'pat') && offSide) {
          const kicked = b.st !== 'pre' && b.st !== 'tee' && b.st !== 'snap' && !(b.car === this.kicker || b.car === this.holder);
          if (!kicked) cur = this.kicker;
          else { const own = this.P.filter(p => p.side === c.side && !p.down); own.sort((a, z) => U.dist(a.x, a.y, b.x, b.y) - U.dist(z.x, z.y, b.x, b.y)); cur = (c.cur && c.cur.side === c.side && c.cur !== this.kicker) ? c.cur : own[0]; }
        } else if ((this.kind === 'kickoff' || this.kind === 'punt') && !offSide && !b.car) cur = this.returner;
        else {
          cur = this.P.find(p => p.id === c.sel && p.side === c.side);
          if (!cur) {
            for (const s of ['LB2', 'LB1', 'S1', 'CB1', 'DE1']) { cur = this.P.find(p => p.slot === s && p.side === c.side); if (cur) break; }
            if (!cur) cur = this.P.find(p => p.side === c.side);
            if (cur) c.sel = cur.id;
          }
        }
      }
      // オート切替：パス・ハンドオフ・捕球の瞬間にボールに一番近い守備選手へ
      if (c.kind === 'team' && this.g.settings.autoSwitch !== false && this.state === 'live') {
        const ev = b.st === 'air' ? 'air' + (b.tThrow || 0) : b.car ? 'car' + b.car.id : '';
        if (ev !== c.lastEv) {
          c.lastEv = ev;
          const mineBall = (b.car && b.car.side === c.side) || (b.st === 'air' && b.from && b.from.side === c.side);
          const qbHold = b.car === this.qb && !this.passThrown && this.kind === 'scrim';
          if (ev && !mineBall && !qbHold && this.t - (c.lastMoveT || -9) > 0.35) {
            const cand = this.switchCand(c, true);
            if (cand && cand !== cur) { c.sel = cand.id; cur = cand; }
          }
        }
      }
      if (cur !== c.cur) { c.cur = cur; c.touched = false; }
      if (cur) cur.human = i;
    });
  },
  // 切替候補：ボール（または落下地点）に一番近い味方
  switchCand(c, includeCur) {
    const b = this.ball, bx = b.car ? b.car.x : b.lx != null && b.st === 'air' ? b.lx : b.x, by = b.car ? b.car.y : b.ly != null && b.st === 'air' ? b.ly : b.y;
    const cand = this.P.filter(p => p.side === c.side && !p.down && (includeCur || p !== c.cur) && p !== b.car);
    cand.sort((a, z) => U.dist(a.x, a.y, bx, by) - U.dist(z.x, z.y, bx, by));
    return cand[0] || null;
  },
  humanActive(p, c) {
    if (this.state !== 'live') return false;
    if (p === this.kicker && (this.kind !== 'kickoff' || this.ball.st === 'tee')) return false;
    if (!this.g.settings.assist && c.kind === 'team') return true;
    return c.touched;
  },
  humanMove(p, c) {
    const i = c.inp; let ax = i.ax, ay = i.ay;
    if (p.stun > 0 || p.down || p.eng || (p.engBy && p.engBy.length)) return;
    if (c.aim && c.aim.t > 0.2) { p.dvx = 0; p.dvy = 0; return; } // 狙っている間は足を止める
    const n = U.norm(ax, ay);
    const spd = p.top * (i.sprint ? 1 : 0.92) * (this.ball.car === p ? 0.95 * this.carryFat(p) : 1);
    p.dvx = n.x * spd; p.dvy = n.y * spd;
  },
  // ボタン入力
  handleInputs(dt, pre) {
    this.ctrls.forEach((c, ci) => {
      const i = c.inp, pr = i.pressed; if (!pr) return;
      if (Math.abs(i.ax) + Math.abs(i.ay) > 0.1 && !pre) { c.touched = true; c.lastMoveT = this.t; }
      const p = c.cur, b = this.ball;
      // キックメーター
      if (this.meter && this.meter.who === ci && this.meter.ph !== 'done') {
        const m = this.meter;
        if (m.ph === 'aim') m.aim = U.clamp(m.aim + i.ay * dt * 1.2, -1, 1);
        if (pr.has('Space')) {
          if (m.ph === 'aim') { m.ph = 'power'; m.t = 0; }
          else if (m.ph === 'power') { m.ph = 'acc'; m.t = 0; }
          else if (m.ph === 'acc') { m.ph = 'done'; this.meterDone(); }
          SFX.click();
        }
        return;
      }
      if (pre) {
        // スナップ
        if (pr.has('Space') && c.side === this.off && this.kind === 'scrim' && (c.kind === 'team' || (p && p === this.qb))) this.snap();
        if ((pr.has('Tab') || pr.has('Space')) && c.side !== this.off && c.kind === 'team') this.switchPlayer(c);
        if (pr.has('Mouse0') && c.kind === 'team' && c.side !== this.off && i.mx != null) {
          const q = this.P.filter(o => o.side === c.side).sort((a, z) => U.dist(a.tx != null ? a.tx : a.x, a.ty != null ? a.ty : a.y, i.mx, i.my) - U.dist(z.tx != null ? z.tx : z.x, z.ty != null ? z.ty : z.y, i.mx, i.my))[0];
          if (q) { c.sel = q.id; SFX.click(); }
        }
        if (pr.has('KeyC') && c.kind === 'player' && p && p.job === 'route') { this.callFor = p; this.msgOut('ボールを要求！'); }
        return;
      }
      if (!p) return;
      if (pr.has('KeyC') && c.kind === 'player' && p.job === 'route' && !this.passThrown) { this.callFor = p; this.msgOut('ボールを要求！'); }
      // QB：パス（数字キー長押し or マウスで狙う）
      if (b.car === p && p === this.qb && this.kind === 'scrim' && !this.passThrown && b.st === 'held' && this.fwd(p.x, this.off) <= 0.5 && this.offPlay.t !== 'kneel' && this.offPlay.t !== 'spike') {
        c.loftAdj = U.clamp((c.loftAdj || 0) + (i.wheel || 0) * 0.08 + (i.held.KeyQ ? dt * 0.9 : 0) - (i.held.KeyE ? dt * 0.9 : 0), -0.6, 0.6);
        for (let k = 1; k <= 5; k++) if (pr.has('Digit' + k) && this.receivers.some(r => r.icon === k)) c.aim = { k, t: 0, off: 0 };
        if (c.aim) {
          const r = this.receivers.find(r => r.icon === c.aim.k);
          if (!r) c.aim = null;
          else if (i.held['Digit' + c.aim.k]) {
            c.aim.t += dt;
            if (c.aim.t > 0.2) {
              c.aim.off = U.clamp(c.aim.off - i.ay * dt * 12, -8, 18);
              const L = this.aimPoint(p, r, c.aim.off); this.setAimView(ci, p, L, this.loftFor(p, L, c));
            }
          } else {
            if (c.aim.t <= 0.2) this.throwBall(p, r, i.held.KeyQ ? 'lob' : i.held.KeyE ? 'bullet' : 'auto');
            else { const L = this.aimPoint(p, r, c.aim.off); this.throwTo(p, L, this.loftFor(p, L, c), r); }
            c.aim = null; return;
          }
        } else if (i.mAct && i.mx != null) {
          const L = { x: i.mx, y: U.clamp(i.my, -2, FIELD.WID + 2) }, loft = this.loftFor(p, L, c);
          this.setAimView(ci, p, L, loft);
          if (pr.has('Mouse0')) { this.throwTo(p, L, loft, null); return; }
        }
        if (pr.has('KeyR')) { this.throwAway(p); return; }
      } else if (c.aim) c.aim = null;
      if (b.car === p) {
        if (pr.has('KeyJ')) this.doMove(p, 'juke');
        else if (pr.has('KeyK')) this.doMove(p, 'spin');
        else if (pr.has('KeyL')) this.doMove(p, 'truck');
        else if (pr.has('Space') && !(p === this.qb && !this.passThrown && this.fwd(p.x, this.off) < 0 && !this.handed && this.kind === 'scrim')) {
          // ダイブ / スライド
          const dir = this.g.dirOf(p.side), fwd = p === this.qb ? 0.3 : 1.4;
          if (this.isOwnEZ(p, p.x) && p.gotInEZ) return this.endPlay({ ty: 'touchback', newPoss: p.side, setBallOn: this.kind === 'kickoff' ? 35 : 20 });
          this.downAt(p, p.x + dir * fwd, p.y, 'down');
        }
        if (pr.has('KeyF') && p.gotInEZ && this.isOwnEZ(p, p.x)) this.endPlay({ ty: 'touchback', newPoss: p.side, setBallOn: this.kind === 'kickoff' ? 35 : 20 });
        return;
      }
      if (pr.has('KeyF') && p === this.returner && b.st === 'air') { this.fairCall = true; this.msgOut('フェアキャッチ'); }
      // 守備：切替・ダイブ・スワット
      if (b.car && b.car.side !== c.side || (b.st === 'air' && b.from && b.from.side !== c.side) || this.kind === 'scrim' && c.side === this.def) {
        if (pr.has('Tab') || pr.has('Space')) { if (c.kind === 'team' && !(b.car && b.car.side === c.side)) this.switchPlayer(c); }
      }
      if (pr.has('Mouse0') && c.kind === 'team' && i.mx != null && !(b.car && b.car.side === c.side)) {
        const q = this.P.filter(o => o.side === c.side && !o.down).sort((a, z) => U.dist(a.x, a.y, i.mx, i.my) - U.dist(z.x, z.y, i.mx, i.my))[0];
        if (q && U.dist(q.x, q.y, i.mx, i.my) < 3.5) { c.sel = q.id; SFX.click(); }
      }
      if (pr.has('KeyJ') && p.diveT <= 0 && p.stun <= 0) { p.diveT = 0.35; const n = U.norm(p.vx || Math.cos(p.face), p.vy || Math.sin(p.face)); p.vx += n.x * 3; p.vy += n.y * 3; p.diveMiss = true; }
      if (pr.has('KeyK')) p.swatT = 0.6;
    });
  },
  switchPlayer(c) {
    const q = this.switchCand(c, false);
    if (q) { c.sel = q.id; SFX.click(); }
  },
  // ---------- パスの狙い ----------
  autoLoft(d) { return U.clamp((d - 6) / 38, 0.08, 0.95); },
  loftFor(qb, L, c) { return U.clamp(this.autoLoft(U.dist(qb.x, qb.y, L.x, L.y)) + (c.loftAdj || 0), 0, 1); },
  throwParams(qb, L, loft) {
    const d0 = U.dist(qb.x, qb.y, L.x, L.y);
    const v = U.lerp(23 + (qb.a.thp - 70) * 0.12, 12.5, loft) + d0 * 0.05;
    const T = Math.max(0.15, d0 / v), z0 = 2.0, zc = 1.4;
    return { v, T, vz: (zc - z0 + 0.5 * G * T * T) / T, z0 };
  },
  aimPoint(qb, r, off) {
    let L = { x: r.x, y: r.y };
    for (let k = 0; k < 3; k++) { const d = U.dist(qb.x, qb.y, L.x, L.y); L = this.predict(r, d / 18 + 0.05); }
    let n = U.norm(r.vx, r.vy); if (n.l < 0.5) n = { x: this.dir, y: 0 };
    return { x: L.x + n.x * off, y: U.clamp(L.y + n.y * off, -2, FIELD.WID + 2) };
  },
  setAimView(ci, qb, L, loft) {
    const P = this.throwParams(qb, L, loft);
    const near = this.receivers.some(r => U.dist(r.x + r.vx * P.T, r.y + r.vy * P.T, L.x, L.y) < 2.5);
    this.aimView = [ci, qb.x, qb.y, L.x, L.y, P.T, P.vz, P.z0, near ? 1 : 0, Math.round(loft * 100)];
  },
  throwTo(qb, L, loft, tgt) {
    if (this.passThrown) return;
    if (!tgt) tgt = this.P.filter(p => p.side === qb.side && ['WR', 'TE', 'RB', 'FB'].includes(p.pos)).sort((a, z) => U.dist(a.x, a.y, L.x, L.y) - U.dist(z.x, z.y, L.x, L.y))[0] || null;
    const d0 = U.dist(qb.x, qb.y, L.x, L.y);
    const press = this.nearestOpp(qb, q => !q.eng && q.job === 'rush', 2.5) ? (qb.sk.has('pocket') ? 1.25 : 1.7) : 1;
    const moving = U.len(qb.vx, qb.vy) > 3 ? 1.45 : 1;
    const sig = (qb.sk.has('deadeye') ? 0.8 : 1) * (0.25 + d0 * 0.034) * (1.75 - qb.a.tha / 100) * press * moving;
    L = { x: L.x + U.gauss() * sig, y: L.y + U.gauss() * sig };
    const P = this.throwParams(qb, L, loft), b = this.ball;
    Object.assign(b, { st: 'air', kind: 'pass', car: null, from: qb, tgt, x: qb.x, y: qb.y, z: P.z0, vx: (L.x - qb.x) / P.T, vy: (L.y - qb.y) / P.T,
      vz: P.vz, lx: L.x, ly: L.y, tArr: this.t + P.T, tThrow: this.t, resolved: false });
    this.passThrown = true; this.qb.job = 'qbdone'; this.passer = qb; this.target = tgt;
    SFX.noise(0.05, 900, 0.15);
  },
  doMove(p, type) {
    if (p.moveT > -0.25) return;
    p.moveT = type === 'truck' ? 0.55 : 0.45; p.moveType = type;
    const sp = U.len(p.vx, p.vy), n = U.norm(p.vx, p.vy);
    if (type === 'juke') {
      let side = U.chance(0.5) ? 1 : -1; const c = p.human >= 0 ? this.ctrls[p.human] : null;
      if (c) { const cr = n.x * c.inp.ay - n.y * c.inp.ax; if (Math.abs(cr) > 0.2) side = cr > 0 ? 1 : -1; }
      const k = 2.5 + p.a.agi * 0.03; p.vx += -n.y * side * k; p.vy += n.x * side * k; p.vx *= 0.8; p.vy *= 0.8;
    } else if (type === 'spin') { p.vx *= 0.8; p.vy *= 0.8; }
    else if (type === 'truck') { p.vx = n.x * sp * 0.92; p.vy = n.y * sp * 0.92; }
  },
  msgOut(s) { this.msg.push(s); },
  carryFat(p) { return U.clamp(1 - Math.max(0, (p.carryT || 0) - 2) * 0.022, 0.85, 1); },

  // ---------- ハンドオフ ----------
  handoffStep() {
    const b = this.ball;
    if (b.st === 'snap') {
      const k = U.clamp(this.t / b.snapT, 0, 1), to = b.snapTo;
      b.x = U.lerp(b.sx, to.x, k); b.y = U.lerp(b.sy, to.y, k); b.z = 0.5 + Math.sin(k * Math.PI) * 0.6;
      if (k >= 1) {
        b.st = 'held'; b.car = to;
        if (this.runner === this.qb && this.runPlay) { this.handed = true; this.liveAt = this.t + (this.runPlay.delay || 0); }
              }
      return;
    }
    if (this.kind !== 'scrim') return;
    if (this.offPlay.t === 'spike' && this.t > 0.55 && b.car === this.qb) return this.endPlay({ ty: 'inc', spike: 1, x: this.losX, newPoss: this.off });
    if (this.offPlay.t === 'kneel' && this.t > 0.85 && b.car === this.qb) return this.downAt(this.qb, this.qb.x, this.qb.y, 'down');
    const rp = this.runPlay, r = this.runner;
    if (rp && r && !this.handed && b.car === this.qb && r !== this.qb) {
      const d = U.dist(this.qb.x, this.qb.y, r.x, r.y);
      if (rp.toss && this.t >= rp.hand) {
        this.handed = true; b.st = 'pitch'; b.sx = b.x; b.sy = b.y; b.pt = 0; b.car = null; b.pitchTo = r; this.qb.job = 'qbdone';
      } else if (this.t >= rp.hand && (d < 1.6 || this.t > rp.hand + 0.5)) {
        b.car = r; this.handed = true; this.liveAt = this.t; this.qb.job = 'qbdone';
      }
    }
    if (b.st === 'pitch') {
      b.pt += 1 / 60 / 0.4; const to = b.pitchTo;
      b.x = U.lerp(b.sx, to.x, b.pt); b.y = U.lerp(b.sy, to.y, b.pt); b.z = 1 + Math.sin(b.pt * Math.PI) * 0.8;
      if (b.pt >= 1) { b.st = 'held'; b.car = to; this.liveAt = this.t; }
    }
    // QBスクランブル
    if (this.qbScramble && b.car === this.qb && !this.passThrown && !this.scrambleLive) { this.scrambleLive = true; this.liveAt = this.t + 0.3; }
    if (b.car === this.qb && !this.passThrown && this.fwd(this.qb.x, this.off) > 0 && !this.crossed) { this.crossed = true; this.liveAt = Math.min(this.liveAt, this.t); }
  },

  // ---------- ブロック ----------
  tryEngage(b, d) {
    if (b.eng || d.down || d.stun > 0 || b.stun > 0 || d === this.ball.car) return;
    if (b.imm[d.id] > this.t) return;
    if (U.dist(b.x, b.y, d.x, d.y) < 1.15) { b.eng = d; d.engBy.push(b); b.engT = 0; SFX.hit && U.chance(0.3) && SFX.noise(0.05, 300, 0.12); }
  },
  release(b, imm) {
    const d = b.eng; if (!d) return;
    d.engBy = d.engBy.filter(x => x !== b); b.eng = null; if (imm) b.imm[d.id] = this.t + imm;
  },
  engageStep(dt) {
    const car = this.ball.car, diffK = this.g.settings.diff;
    for (const b of this.P) {
      const d = b.eng; if (!d) continue;
      if (d.down || d.stun > 0 || b.down || d === car || b.stun > 0 || U.dist(b.x, b.y, d.x, d.y) > 2.2) { this.release(b, 0.4); continue; }
      b.engT += dt;
      const n = d.engBy.length || 1;
      const passPro = b.job === 'pblock' && !this.handed && !this.passThrown;
      const defPow = d.job === 'rush' ? d.a.prs * 0.65 + d.a.str * 0.35 : d.a.tak * 0.3 + d.a.str * 0.45 + d.a.prs * 0.25;
      const blkPow = b.a.blk * 0.65 + b.a.str * 0.35;
      // 目標（QB or キャリア）
      let tgt = car && car.side !== d.side ? car : this.qb || this.kicker;
      if (this.ball.st === 'air') tgt = { x: this.ball.lx, y: this.ball.ly };
      if (!tgt) tgt = { x: d.x - this.dir * 5, y: d.y };
      const dc = U.dist(d.x, d.y, tgt.x, tgt.y);
      let rate = (passPro ? 0.24 : 0.3) * Math.pow(defPow / blkPow, 3) / Math.pow(n, 1.7);
      if (dc < 2.5) rate *= 2.4;
      if (b.sk.has('anchor')) rate *= 0.7;
      if (passPro && d.sk.has('passrush')) rate *= 1.4;
      if (!passPro && d.sk.has('run_stop')) rate *= 1.4;
      if (b.job === 'jam') rate = 0.9 * Math.pow(d.a.spd / Math.max(40, b.a.str), 1.5);
      if (b.job === 'lead' && !['LT', 'LG', 'C', 'RG', 'RT'].includes(b.pos)) rate = Math.max(rate, 1.1 * Math.pow(defPow / blkPow, 2) / n);
      if (U.chance(rate * dt)) { this.release(b, 1.0); d.burst = 0.4; continue; }
      const td = U.norm(tgt.x - d.x, tgt.y - d.y);
      const m = (defPow - blkPow * (0.85 + (n - 1) * 0.6)) / 55;
      let vx, vy;
      if (m > 0) { const s = Math.min(2.6, 0.5 + m * 2.4); vx = td.x * s; vy = td.y * s; }
      else { const s = Math.min(passPro ? 0.35 : 2.0, 0.2 - m * 2.0); vx = -td.x * s; vy = -td.y * s; }
      // ランブロック：穴の方向から押し出す
      if (!passPro && this.holeL != null && this.kind === 'scrim') { vy += (this.holeL > 0 ? 1 : -1) * this.dir * 0.6; }
      // 横スライド
      const lat = U.norm(-td.y, td.x), side = Math.sign((tgt.x - d.x) * lat.x + (tgt.y - d.y) * lat.y) || 0;
      vx += lat.x * side * 0.5; vy += lat.y * side * 0.5;
      d.vx = vx; d.vy = vy; d.engMoved = true;
      // ブロッカーは相手の前（目標側）に位置
      const want = { x: d.x + td.x * 0.85, y: d.y + td.y * 0.85 };
      b.vx = vx + (want.x - b.x) * 6; b.vy = vy + (want.y - b.y) * 6; b.engMoved = true;
    }
  },
  integrate(dt) {
    for (const p of this.P) {
      if (p.engMoved) { p.engMoved = false; }
      else if (p.down) { p.vx *= 0.85; p.vy *= 0.85; }
      else {
        let dvx = p.dvx || 0, dvy = p.dvy || 0;
        if (p.stun > 0) { dvx = 0; dvy = 0; }
        if (p.moveT > 0 && p.moveType === 'spin') { dvx *= 0.85; dvy *= 0.85; }
        let ax = dvx - p.vx, ay = dvy - p.vy; const al = U.len(ax, ay), vl = U.len(p.vx, p.vy);
        // 加速は加速力、減速・方向転換は敏捷性（カットは素早く）
        let am = p.acc;
        if (vl > 1 && al > 0.01) { const along = (ax * p.vx + ay * p.vy) / (vl * al); if (along < 0.5) am = p.acc * (1.25 + p.a.agi / 100); }
        if (p.moveT > 0 && p.moveType === 'juke') am *= 1.3;
        if (p.job === 'route' && p.sk.has('route')) am *= 1.2;
        if (p.human >= 0) am *= 1.25;
        if (p.stumble > 0) am *= 0.5;
        const amax = am * dt * (p.burst > 0 ? 1.3 : 1);
        if (al > amax) { ax *= amax / al; ay *= amax / al; }
        p.vx += ax; p.vy += ay;
        const sp = U.len(p.vx, p.vy), cap = p.top * (p.burst > 0 ? 1.05 : 1) * (p.diveT > 0 ? 1.3 : 1);
        if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; }
      }
      p.burst = (p.burst || 0) - dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp = U.len(p.vx, p.vy);
      if (sp > 0.6) p.face = Math.atan2(p.vy, p.vx);
      p.anim += dt * (1.5 + sp * 1.1);
    }
    // 衝突回避（重ならない）
    const P = this.P;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], c = P[j]; if (a.eng === c || c.eng === a) continue;
      const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.56 && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (0.75 - d) * 0.5, nx = dx / d, ny = dy / d;
        const wa = a === this.ball.car ? 0.3 : 1, wc = c === this.ball.car ? 0.3 : 1;
        a.x -= nx * push * wa; a.y -= ny * push * wa; c.x += nx * push * wc; c.y += ny * push * wc;
      }
    }
  },

  // ---------- パス ----------
  predict(r, T) {
    if (r.job === 'route' && r.route && r.route.i < r.route.pts.length && r.human < 0) {
      let x = r.x, y = r.y, left = T * r.top * 0.86, i = r.route.i, lx = r.vx, ly = r.vy;
      while (left > 0 && i < r.route.pts.length) {
        const w = r.route.pts[i], d = U.dist(x, y, w.x, w.y);
        if (d <= left) { lx = w.x - x; ly = w.y - y; x = w.x; y = w.y; left -= d; i++; } else { const n = U.norm(w.x - x, w.y - y); x += n.x * left; y += n.y * left; lx = n.x; ly = n.y; left = 0; }
      }
      if (left > 0 && r.route.cont) { const n = U.norm(lx, ly); x += n.x * left; y += n.y * left; }
      return { x, y };
    }
    return { x: r.x + r.vx * T, y: r.y + r.vy * T };
  },
  throwBall(qb, r, mode) {
    if (this.passThrown) return;
    const b = this.ball;
    let d0 = U.dist(qb.x, qb.y, r.x, r.y), L = { x: r.x, y: r.y }, v;
    const lob = mode === 'lob' || (mode === 'auto' && d0 > 24), bullet = mode === 'bullet';
    for (let k = 0; k < 4; k++) {
      d0 = U.dist(qb.x, qb.y, L.x, L.y);
      v = bullet ? 22 + (qb.a.thp - 70) * 0.15 : lob ? 14 + d0 * 0.11 : 17.5 + (qb.a.thp - 70) * 0.12 + d0 * 0.04;
      if (this.offPlay.hail) v = 14 + d0 * 0.1;
      L = this.predict(r, d0 / v + 0.05);
    }
    const press = this.nearestOpp(qb, q => !q.eng && q.job === 'rush', 2.5) ? (qb.sk.has('pocket') ? 1.25 : 1.7) : 1;
    const moving = U.len(qb.vx, qb.vy) > 3 ? 1.45 : 1;
    const sig = (qb.sk.has('deadeye') ? 0.8 : 1) * (0.3 + d0 * 0.038) * (1.75 - qb.a.tha / 100) * press * moving * (lob ? 1.1 : 1) * (bullet ? 1.08 : 1);
    L.x += U.gauss() * sig; L.y += U.gauss() * sig;
    const T = U.dist(qb.x, qb.y, L.x, L.y) / v;
    const z0 = 2.0, zc = 1.4;
    Object.assign(b, { st: 'air', kind: 'pass', car: null, from: qb, tgt: r, x: qb.x, y: qb.y, z: z0, vx: (L.x - qb.x) / T, vy: (L.y - qb.y) / T,
      vz: (zc - z0 + 0.5 * G * T * T) / T, lx: L.x, ly: L.y, tArr: this.t + T, tThrow: this.t, resolved: false, losAtThrow: this.losX });
    this.passThrown = true; this.qb.job = 'qbdone'; this.passer = qb; this.target = r;
    SFX.noise(0.05, 900, 0.15);
  },
  throwAway(qb) {
    const side = qb.y < FIELD.WID / 2 ? -3 : FIELD.WID + 3, L = { x: qb.x + this.dir * 8, y: side };
    const T = U.dist(qb.x, qb.y, L.x, L.y) / 18;
    Object.assign(this.ball, { st: 'air', kind: 'pass', car: null, from: qb, tgt: null, x: qb.x, y: qb.y, z: 2, vx: (L.x - qb.x) / T, vy: (L.y - qb.y) / T,
      vz: (2.2 - 2 + 0.5 * G * T * T) / T, lx: L.x, ly: L.y, tArr: this.t + T, tThrow: this.t, resolved: true });
    this.passThrown = true; this.qb.job = 'qbdone'; this.passer = qb; this.thrownAway = true;
  },
  resolveCatch() {
    const b = this.ball; b.resolved = true;
    let rec = null, dr = 9, dfd = null, dd = 9;
    for (const p of this.P) {
      if (p.down || p.stun > 0 || p === b.from) continue;
      const d = U.dist(p.x, p.y, b.x, b.y);
      if (p.side === b.from.side) { if (['WR', 'TE', 'RB', 'FB'].includes(p.pos) && d / p.catchR < dr) { dr = d / p.catchR; rec = p; } }
      else if (d / p.catchR < dd) { dd = d / p.catchR; dfd = p; }
    }
    const swat = dfd && dfd.swatT > 0 ? 1 : 0, grab = rec && rec.swatT > 0 ? 1 : 0;
    if (dfd && dd < 1.5) {
      const prox = 1 - dd / 1.5;
      const pInt = ((0.12 + dfd.a.cat / 100 * 0.35) * prox * (dd < dr ? 1.3 : 0.55) + swat * 0.08) * (dfd.sk.has('ballhawk') ? 1.5 : 1);
      const pDef = (0.2 + dfd.a.cov / 100 * 0.3) * prox + swat * 0.2;
      const r = Math.random();
      if (r < pInt) return this.caught(dfd, true);
      if (r < pInt + pDef) {
        if (rec && dr < 1.4 && U.chance(this.g.settings.pen * 0.12) && this.kind === 'scrim') this.flags.push({ side: dfd.side, name: 'パスインターフェア', spotX: b.x, first: 1, now: 1 });
        this.msgOut('パスカット！'); return this.incomplete(true);
      }
    }
    if (rec && dr < 1.7) {
      let p = (0.62 + rec.a.cat / 100 * 0.36) * (1 - dr / 1.7 * 0.45) + grab * 0.06 + (rec.sk.has('hands') ? 0.07 : 0);
      if (dfd && dd < 1.3) p -= (1.3 - dd) * 0.28 * (rec.sk.has('contested') ? 0.5 : 1);
      if (b.vz < -14) p -= 0.05;
      if (U.chance(U.clamp(p, 0.05, 0.98))) return this.caught(rec, false);
      this.msgOut('落球…');
    }
    // 誰も捕れない → そのまま落下
  },
  caught(p, isInt) {
    const b = this.ball;
    if (p.y < 0 || p.y > FIELD.WID || p.x < 0 || p.x > 120) return this.incomplete();
    b.st = 'held'; b.car = p; this.liveAt = this.t; this.catchX = p.x; SFX.catchBall();
    if (isInt) { this.intBy = p; this.msgOut('インターセプト！'); p.gotInEZ = this.isOwnEZ(p, p.x); }
    else { this.completed = p; p.job = 'carry'; }
    p.burst = 0.2;
  },
  incomplete(defl) { this.endPlay({ ty: 'inc', x: this.losX, newPoss: this.off, defl }); },

  // ---------- ボール ----------
  ballStep(dt) {
    const b = this.ball;
    if (b.st === 'held' && b.car) { b.x = b.car.x + Math.cos(b.car.face) * 0.3; b.y = b.car.y + Math.sin(b.car.face) * 0.3; b.z = 1.1; return; }
    if (b.st === 'air') {
      const w = this.g.wind; const kickish = b.kind !== 'pass';
      b.vx += (kickish ? w.x * 0.12 : 0) * dt; b.vy += (kickish ? w.y * 0.12 : 0) * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
      if (b.kind === 'pass') {
        if (!b.resolved && this.t >= b.tArr) this.resolveCatch();
        if (this.state === 'live' && b.st === 'air' && b.z <= 0.05) this.incomplete();
        return;
      }
      this.kickFlight(dt);
      return;
    }
    if (b.st === 'loose') {
      b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.97; b.vy *= 0.97; b.z = Math.abs(Math.sin(this.t * 7)) * 0.35 * Math.min(1, U.len(b.vx, b.vy) / 3);
      this.looseStep(dt);
    }
  },

  // ---------- タックル・境界 ----------
  contactStep(dt) {
    const b = this.ball, car = b.car;
    // 反則の発生（タイミング）
    if (b.st !== 'held' || !car) return;
    const dir = this.g.dirOf(car.side);
    // サイドライン・エンドライン
    if (car.y < 0 || car.y > FIELD.WID) return this.downAt(car, car.x, U.clamp(car.y, 0, FIELD.WID), 'oob');
    // タッチダウン
    if ((dir === 1 && car.x >= 110) || (dir === -1 && car.x <= 10)) return this.endPlay({ ty: 'td', scoreSide: car.side, x: car.x, newPoss: car.side, car });
    if (car.x < 0 || car.x > 120) return this.downAt(car, car.x, car.y, 'oob');
    if (car.gotInEZ && !this.isOwnEZ(car, car.x)) car.gotInEZ = false;
    // AIのダイブタックル（後ろや横から足元へ）
    for (const q of this.P) {
      if (q.side === car.side || q.human >= 0 || q.down || q.stun > 0 || q.tkCD > 0 || q.diveT > 0 || q.eng || q.engBy.length) continue;
      const d = U.dist(q.x, q.y, car.x, car.y);
      if (d > 1.05 && d < 2.1 && U.chance(dt * (2.0 + q.a.tak / 50))) {
        const n = U.norm(car.x + car.vx * 0.15 - q.x, car.y + car.vy * 0.15 - q.y);
        q.diveT = 0.35; q.diveMiss = true; q.vx = n.x * (q.top + 1.5); q.vy = n.y * (q.top + 1.5);
      }
    }
    for (const q of this.P) {
      if (q.side === car.side || q.down || q.stun > 0 || q.tkCD > 0) continue;
      const blocked = !!q.eng || q.engBy.length > 0;
      const reach = (q.diveT > 0 ? 1.75 : 1.05) * (blocked ? 0.75 : 1) * q.tackleR;
      const d = U.dist(q.x, q.y, car.x, car.y);
      if (d > reach) continue;
      q.tkCD = 0.45;
      const front = ((q.x - car.x) * dir) > 0;
      let p = 0.75 + (q.a.tak - 75) * 0.01 - (car.human >= 0 ? 0.1 : 0) - (car.a.elu - 75) * 0.006 - (car.a.str - q.a.str) * 0.004;
      const close = -((car.vx - q.vx) * (car.x - q.x) + (car.vy - q.vy) * (car.y - q.y)) / Math.max(0.3, d);
      p += U.clamp(close / 10, -0.1, 0.15);
      if (car.moveT > 0) {
        if (car.moveType === 'juke') p -= 0.24 + (car.a.agi - 70) * 0.006 + (car.sk.has('juke') ? 0.12 : 0);
        if (car.moveType === 'spin') p -= 0.2 + (car.a.elu - 70) * 0.005;
        if (car.moveType === 'truck' && front) p -= 0.18 + (car.a.str - q.a.str) * 0.008 + (car.sk.has('truck') ? 0.12 : 0);
      }
      let gang = 0; for (const o of this.P) if (o !== q && o.side === q.side && !o.down && U.dist(o.x, o.y, car.x, car.y) < 2) gang++;
      p += gang * 0.13;
      if (blocked) p *= 0.35;
      if (q.diveT > 0) p += 0.08;
      if (q.sk.has('hitstick')) p += 0.08;
      if (car === this.qb && !this.passThrown && this.kind === 'scrim' && this.fwd(car.x, this.off) < 0) p += 0.15;
      if (this.g.settings.diff !== 1) p += (q.side === this.g.humanSide ? 1 : -1) * (1 - this.g.settings.diff) * 0.06;
      if (U.chance(U.clamp(p, 0.12, 0.96))) {
        // ファンブル
        const fp = 0.008 * (115 - car.a.car) / 35 * (q.a.tak / 80) * (car.moveType === 'truck' && car.moveT > 0 ? 1.5 : 1) * (car.sk.has('ballsec') ? 0.4 : 1) * (q.sk.has('hitstick') ? 2 : 1);
        if (U.chance(fp) && car !== this.qb || (car === this.qb && U.chance(fp * 1.5))) return this.fumble(car, q);
        // 腕だけのタックルを踏ん張って耐える
        if (!(q.diveT > 0) && car.stumble <= 0 && U.chance(car.human >= 0 ? 0.16 * car.a.str / 85 + 0.06 : 0.05 * car.a.str / 85)) {
          car.stumble = 0.45; car.vx *= 0.6; car.vy *= 0.6; q.stun = 0.55; q.sprawl = 1; SFX.noise(0.08, 400, 0.2);
          continue;
        }
        this.tackler = q; SFX.hit();
        q.down = true; q.fall = 0.1; q.vx = car.vx * 0.5 + q.vx * 0.3; q.vy = car.vy * 0.5 + q.vy * 0.3; q.face = Math.atan2(car.y - q.y, car.x - q.x);
        if (U.chance(this.g.settings.pen * 0.006) && this.kind === 'scrim') this.flags.push({ side: q.side, name: 'フェイスマスク', yds: 15, first: 1, post: 1 });
        const fall = car === this.qb && !this.passThrown && this.fwd(car.x, this.off) < 0 ? 0 : 0.5;
        return this.downAt(car, car.x + dir * fall, car.y, 'tackle', q);
      } else {
        q.stun = q.diveT > 0 ? 0.9 : 0.45; if (q.diveT > 0) q.sprawl = 1; q.diveT = 0; car.vx *= 0.75; car.vy *= 0.75; car.stumble = 0.25;
        if (U.chance(0.3)) this.msgOut('タックルをかわした！');
      }
    }
    // ダイブ失敗
    for (const q of this.P) if (q.diveMiss && q.diveT <= 0) { q.diveMiss = false; if (q.tkCD <= 0) { q.stun = 0.8; q.sprawl = 1; } }
  },
  downAt(car, x, y, how, tackler) {
    const dir = this.g.dirOf(car.side);
    // 自陣エンドゾーンで倒れた
    const inOwn = dir === 1 ? x < 10 : x > 110;
    if (inOwn) {
      if (car.gotInEZ) return this.endPlay({ ty: 'touchback', newPoss: car.side, setBallOn: this.kind === 'kickoff' ? 35 : 20 });
      return this.endPlay({ ty: 'safety', scoreSide: 1 - car.side, x, newPoss: car.side, tackler, car });
    }
    if ((dir === 1 && x >= 110) || (dir === -1 && x <= 10)) return this.endPlay({ ty: 'td', scoreSide: car.side, x, newPoss: car.side, car });
    car.down = true; car.fall = 0.1; if (U.len(car.vx, car.vy) > 0.5) car.face = Math.atan2(car.vy, car.vx);
    this.endPlay({ ty: how === 'oob' ? 'oob' : 'tackle', x, y, newPoss: car.side, tackler, car, sack: car === this.qb && this.kind === 'scrim' && !this.passThrown && !this.handed && this.fwd(x, this.off) < 0 && !this.qbScramble && this.offPlay.t !== 'kneel' });
  },
  fumble(car, q) {
    const b = this.ball; this.msgOut('ファンブル！'); SFX.hit();
    b.st = 'loose'; b.car = null; b.vx = U.rnd(-3, 3); b.vy = U.rnd(-3, 3); b.fumbler = car; this.fumbleT = this.t;
    car.stun = 0.8; this.forcedBy = q;
  },
  looseStep() {
    const b = this.ball;
    if ((this.kind === 'kickoff' || this.kind === 'punt') && !b.fumbler) return this.kickLoose();
    if (b.y < 0 || b.y > FIELD.WID || b.x < 0 || b.x > 120) {
      const last = b.fumbler ? b.fumbler.side : this.off;
      return this.endPlay({ ty: 'oob', x: U.clamp(b.x, 0, 120), newPoss: last, car: null });
    }
    if (this.t - (this.fumbleT || 0) < 0.25) return;
    for (const p of this.P) {
      if (p.down || p.stun > 0) continue;
      if (U.dist(p.x, p.y, b.x, b.y) < 0.8 && U.chance(0.18)) {
        // リカバー → その場でデッド（NFLでは前進可能だが簡略化）
        const turn = p.side !== b.fumbler.side;
        this.msgOut(turn ? 'ターンオーバー！' : 'ファンブルしたが自軍がリカバー');
        b.car = p; b.st = 'held';
        this.recovered = { by: p, turn };
        return this.downAt(p, p.x, p.y, 'tackle');
      }
    }
  },

  // ---------- プレー終了 ----------
  endPlay(R) {
    if (this.state === 'done') return;
    this.state = 'done'; SFX.whistle();
    const b = this.ball;
    R.kind = this.kind; R.passer = this.passer; R.target = this.target; R.completed = this.completed; R.intBy = this.intBy;
    R.runner = this.runner && this.handed ? this.runner : null; R.tackler = R.tackler || this.tackler; R.recovered = this.recovered;
    R.forcedBy = this.forcedBy; R.thrownAway = this.thrownAway; R.offPlay = this.offPlay;
    if (R.x == null) R.x = b.x;
    // プレー中の反則
    R.flags = this.flags.filter(f => f.now || f.post || (f.at != null && f.at < this.t));
    this.result = R;
  },

  // 倒れ具合（0=立つ, 正=倒れる, 負=よろめき）
  fallVal(p) {
    if (p.down) return Math.round(Math.max(0.05, p.fall || 0) * 100) / 100;
    const s = p.sprawl || 0;
    if (s > 0) return Math.round((s > 0.75 ? (1 - s) / 0.25 * 0.95 : s > 0.35 ? 0.95 : s / 0.35 * 0.95) * 100) / 100;
    if ((p.stumble || 0) > 0) return -0.3;
    return 0;
  },
  // ---------- 描画用スナップショット ----------
  view(localSides) {
    const b = this.ball, P = this.P;
    const v = {
      p: P.map(p => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.side, p.num, Math.round(p.face * 100) / 100, Math.round(U.len(p.vx, p.vy) * 10) / 10,
        p.human, this.fallVal(p), Math.round(p.anim * 100) / 100, p.eng ? 1 : 0, p.pos, p.icon && this.state !== 'done' && b.car === this.qb && !this.passThrown && this.kind === 'scrim' ? p.icon : 0,
        p.look, Math.round(p.hgt * 100) / 100]),
      b: [Math.round(b.x * 100) / 100, Math.round(b.y * 100) / 100, Math.round(b.z * 100) / 100, b.st, b.st === 'air' ? Math.round(b.lx * 10) / 10 : null, b.st === 'air' ? Math.round(b.ly * 10) / 10 : null],
      los: this.losX, fd: this.kind === 'scrim' ? this.firstDownX : null, st: this.state, k: this.kind, t: this.t,
      meter: this.meter ? { ph: this.meter.ph, aim: this.meter.aim, pw: this.meterVal('power'), ac: this.meterVal('acc'), who: this.meter.who, side: this.meter.side, kind: this.kind } : null,
      dir: this.dir, off: this.off, rd: !!this.ready,
    };
    v.aim = this.aimView || null;
    v.sw = [];
    if (this.state === 'live') this.ctrls.forEach((c, ci) => { if (c.kind === 'team' && c.cur && !(this.ball.car && this.ball.car.side === c.side) && !(this.ball.st === 'air' && this.ball.from && this.ball.from.side === c.side) && (this.kind !== 'scrim' || c.side !== this.off)) { const q = this.switchCand(c, false); if (q) v.sw.push([ci, this.P.indexOf(q)]); } });
    // 個人モードのルート表示
    v.routes = [];
    for (const p of P) if (p.human >= 0 && p.route && this.state !== 'done' && !this.passThrown) v.routes.push([p.human, [[p.x, p.y], ...p.route.pts.slice(p.route.i).map(w => [w.x, w.y])]]);
    return v;
  },
});
