'use strict';
// ===== キック関連（キックオフ / パント / FG・PAT / キックメーター） =====
Object.assign(Sim.prototype, {
  initMeter(ci, side) { this.meter = { who: ci, side, ph: 'aim', aim: 0, t: 0, pw: 0, ac: 0 }; },
  meterTick(dt) { if (this.meter && this.meter.ph !== 'done') this.meter.t += dt; },
  meterVal(kind) {
    const m = this.meter; if (!m) return 0;
    if (kind === 'power') { if (m.ph === 'power') { const x = (m.t / 0.95) % 2; m.pw = x < 1 ? x : 2 - x; } return m.pw; }
    if (m.ph === 'acc') { const x = (m.t / 0.7) % 2; m.ac = (x < 1 ? x : 2 - x) * 2 - 1; } return m.ac;
  },
  meterDone() {
    const m = this.meter; this.kickParams = { pw: m.pw, ac: m.ac, aim: m.aim, human: 1 };
    this.snap();
  },
  aiKickParams() {
    const K = this.kicker.a;
    return { pw: U.clamp(0.82 + U.gauss() * 0.06 + (K.kpw - 80) * 0.004, 0.4, 1), ac: U.gauss() * (100 - K.kac) / 110, aim: 0, human: 0 };
  },
  specialStep(dt) {
    this.meterTick(dt);
    const b = this.ball, k = this.kind;
    const pr = () => this.kickParams || (this.kickParams = this.aiKickParams());
    if (k === 'kickoff' && this.kickState === 'run') {
      if (U.dist(this.kicker.x, this.kicker.y, b.x, b.y) < 0.8 || this.t > 1.6) this.doKickoff(pr());
    }
    if (k === 'punt' && b.car === this.kicker && b.st === 'held' && this.t >= 1.95) this.doPunt(pr());
    if ((k === 'fg' || k === 'pat') && b.car === this.holder && b.st === 'held' && this.t >= 1.25) this.doFG(pr());
    if ((k === 'kickoff' || k === 'punt') && !this.released && this.kickTime != null && this.t - this.kickTime > 3.6) this.released = true;
  },
  doKickoff(p) {
    const b = this.ball, dir = this.dir, K = this.kicker; this.kickState = 'done'; SFX.kick();
    let dist, hang, ly;
    if (this.onside) {
      dist = 11 + U.rnd(0, 3) + p.pw * 2; hang = 0.9; ly = this.ballY + p.aim * 10 + U.gauss() * 2;
      b.kind = 'onside';
    } else {
      const maxD = 63 + (K.a.kpw - 75) * 0.5;
      if (p.human) dist = maxD * (0.5 + 0.5 * p.pw) - Math.abs(p.ac) * 6;
      else { const tgt = U.chance(0.3) ? U.rnd(102, 108) : U.rnd(90, 99); dist = Math.min(maxD, tgt - this.kickFrom) + U.gauss() * 3; }
      hang = 3.6 + (dist - 55) * 0.03 + U.rnd(-0.2, 0.2);
      ly = this.ballY + p.aim * 16 + p.ac * 10 + U.gauss() * 2;
      b.kind = 'ko';
    }
    const lx = b.x + dir * dist;
    Object.assign(b, { st: 'air', car: null, z: 0.3, vx: (lx - b.x) / hang, vy: (ly - b.y) / hang, vz: (0.5 * G * hang * hang - 0.3) / hang, lx, ly, tArr: this.t + hang, tThrow: this.t, kx: b.x });
    this.kickTime = this.t;
  },
  doPunt(p) {
    const b = this.ball, P = this.kicker, dir = this.dir; SFX.kick();
    const rusher = this.nearestOpp(P, q => !q.eng && !q.down, 1.25);
    if (rusher && U.chance(0.45)) { this.msgOut('パントブロック！'); return this.endPlay({ ty: 'blocked', newPoss: this.def, x: P.x, setX: P.x }); }
    let dist = 40 + (P.a.kpw - 75) * 0.45 + U.gauss() * 4;
    if (p.human) dist = (32 + (P.a.kpw - 75) * 0.45) + p.pw * 18 - Math.abs(p.ac) * 8;
    const hang = U.clamp(3.7 + (P.a.kpw - 75) * 0.02 + (p.pw - 0.7) * 0.8 + U.rnd(-0.3, 0.3), 3.2, 5.0);
    const lx = P.x + dir * dist, ly = U.clamp(P.y + p.aim * 14 + p.ac * 9 + U.gauss() * 3, -4, FIELD.WID + 4);
    Object.assign(b, { st: 'air', kind: 'punt', car: null, z: 1.2, vx: (lx - P.x) / hang, vy: (ly - P.y) / hang, vz: (0.5 * G * hang * hang - 1.2) / hang, lx, ly, tArr: this.t + hang, tThrow: this.t, kx: P.x });
    this.kickTime = this.t; this.puntFrom = P.x;
    this.P.forEach(q => { if (q.side === this.off && q.job === 'pblock') q.job = 'gunner'; });
  },
  doFG(p) {
    const b = this.ball, K = this.kicker, H = this.holder, dir = this.dir; SFX.kick();
    const kx = H.x, ky = H.y;
    const rusher = this.nearestOpp(H, q => !q.eng && !q.down, 1.4);
    if (rusher && U.chance(0.35)) { this.msgOut('キックブロック！'); return this.endPlay({ ty: 'fg', good: false, blocked: 1, x: kx }); }
    const postX = dir === 1 ? 120 : 0;
    let R = 53 + (K.a.kpw - 75) * 0.65 + (p.human ? (p.pw - 0.8) * 22 : U.rnd(-3, 3));
    const th = 0.62, v = Math.sqrt(Math.max(10, R) * G / Math.sin(2 * th));
    const D = Math.abs(postX - kx);
    let eps = ((p.human ? p.ac * 0.085 : 0) + U.gauss() * ((100 - K.a.kac) * 0.0024 + D * 0.0006)) * (K.sk.has('iceveins') ? 0.7 : 1);
    const base = Math.atan2(FIELD.WID / 2 - ky, postX - kx) + eps + p.aim * 0.1;
    Object.assign(b, { st: 'air', kind: 'fg', car: null, x: kx, y: ky, z: 0.2, vx: Math.cos(base) * v * Math.cos(th), vy: Math.sin(base) * v * Math.cos(th), vz: v * Math.sin(th), tThrow: this.t, kx, postX, lx: postX, ly: FIELD.WID / 2, tArr: this.t + 3 });
    this.kickTime = this.t;
    K.vx = dir * 2;
  },
  kickFlight() {
    const b = this.ball, k = b.kind;
    if (k === 'fg') {
      if ((b.x - b.postX) * this.dir >= 0) {
        const good = Math.abs(b.y - FIELD.WID / 2) <= 3.08 && b.z >= 3.33;
        return this.endPlay({ ty: 'fg', good, x: b.kx, dist: Math.round(Math.abs(b.postX - b.kx) - 0) });
      }
      if (b.z <= 0) return this.endPlay({ ty: 'fg', good: false, short: 1, x: b.kx });
      return;
    }
    if (this.t < b.tArr) return;
    const rec = this.def, dirR = this.g.dirOf(rec);
    b.z = Math.max(0, b.z);
    if (k === 'onside') { b.st = 'loose'; b.vx = this.dir * U.rnd(1, 3); b.vy = U.rnd(-2, 2); this.landT = this.t; return; }
    // 捕球判定
    const near = this.P.filter(q => q.side === rec && !q.down && U.dist(q.x, q.y, b.x, b.y) < 1.8).sort((a, z) => U.dist(a.x, a.y, b.x, b.y) - U.dist(z.x, z.y, b.x, b.y))[0];
    const recBO = U.ballOnFromX(b.x, dirR);
    const oob = b.y < 0 || b.y > FIELD.WID;
    if (near && !oob && U.chance(0.94 + near.a.cat * 0.0005)) {
      if (k === 'punt') {
        const cov = this.nearestOpp(near, q => !q.down, 6);
        const fair = (near.human >= 0 && this.fairCall) || (near.human < 0 && cov && recBO > 3);
        if (recBO < 0) return this.endPlay({ ty: 'touchback', newPoss: rec, setBallOn: 20 });
        if (fair) { this.msgOut('フェアキャッチ'); return this.endPlay({ ty: 'fair', newPoss: rec, x: b.x }); }
      }
      b.st = 'held'; b.car = near; this.released = true; this.liveAt = this.t; SFX.catchBall();
      near.gotInEZ = recBO < 0; this.returner = near;
      if (near.gotInEZ && near.human < 0 && (recBO < -2 || k === 'punt')) return this.endPlay({ ty: 'touchback', newPoss: rec, setBallOn: k === 'ko' ? 35 : 20 });
      return;
    }
    // 地面に落ちた
    this.released = true; this.landT = this.t;
    if (k === 'ko') {
      if (oob) return this.endPlay({ ty: 'ko_oob', newPoss: rec, setBallOn: 40 });
      if (recBO > 20) return this.endPlay({ ty: 'ko_short', newPoss: rec, setBallOn: 40 });
      if (recBO < 0) return this.endPlay({ ty: 'touchback', newPoss: rec, setBallOn: 35 });
      b.st = 'loose'; b.vx = this.dir * U.rnd(2, 6); b.vy = U.rnd(-1.5, 1.5);
      return;
    }
    if (k === 'punt') {
      if (oob) return this.endPlay({ ty: 'downed', newPoss: rec, x: U.clamp(b.x, 10, 110) });
      if (recBO < 0) return this.endPlay({ ty: 'touchback', newPoss: rec, setBallOn: 20 });
      b.st = 'loose'; b.vx = this.dir * U.rnd(1, 7); b.vy = U.rnd(-2.5, 2.5);
    }
  },
  kickLoose() {
    const b = this.ball, rec = this.def, dirR = this.g.dirOf(rec), recBO = U.ballOnFromX(b.x, dirR), k = b.kind;
    const oob = b.y < 0 || b.y > FIELD.WID;
    if (k === 'onside') {
      if (oob) return this.endPlay({ ty: 'onside', newPoss: rec, x: U.clamp(b.x, 10, 110) });
      const went = Math.abs(b.x - b.kx) >= 10;
      for (const p of this.P) {
        if (p.down || p.stun > 0 || U.dist(p.x, p.y, b.x, b.y) > 0.9) continue;
        if (p.side === this.off && !went) continue;
        if (U.chance((p.side === this.off ? 0.06 : 0.12))) {
          this.msgOut(p.side === this.off ? 'オンサイド成功！' : 'レシーブ側が確保');
          return this.endPlay({ ty: 'onside', newPoss: p.side, x: b.x });
        }
      }
      return;
    }
    if (oob) return this.endPlay({ ty: k === 'ko' ? 'ko_oob' : 'downed', newPoss: rec, x: U.clamp(b.x, 10, 110), setBallOn: k === 'ko' ? 40 : undefined });
    if (recBO < 0) return this.endPlay({ ty: 'touchback', newPoss: rec, setBallOn: 20 });
    for (const p of this.P) {
      if (p.down || p.stun > 0 || U.dist(p.x, p.y, b.x, b.y) > 0.85) continue;
      if (p.side === rec) { b.st = 'held'; b.car = p; this.liveAt = this.t; this.returner = p; return; }
      if (k === 'punt') return this.endPlay({ ty: 'downed', newPoss: rec, x: b.x });
    }
    if (k === 'punt' && (U.len(b.vx, b.vy) < 0.4 || this.t - this.landT > 3)) return this.endPlay({ ty: 'downed', newPoss: rec, x: b.x });
  },
});
