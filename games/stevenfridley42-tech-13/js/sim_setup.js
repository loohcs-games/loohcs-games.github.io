'use strict';
// ===== フィールド上のシミュレーション: セットアップ =====
const SPEED = a => 5.4 + a.spd * 0.052;          // 最高速(yd/s) 99→10.5
const ACCEL = a => 6 + a.acc * 0.07;             // 加速度(yd/s^2)

class Sim {
  constructor(game) {
    this.g = game; this.P = []; this.t = 0; this.state = 'pre';
    this.ball = { x: 60, y: 26.6, z: 0, vx: 0, vy: 0, vz: 0, st: 'dead' };
    this.flags = []; this.result = null; this.msg = [];
  }
  // プレーごとの状態をリセット
  reset() {
    this.P = []; this.t = 0; this.state = 'pre'; this.flags = []; this.result = null; this.msg = []; this.opts = {};
    for (const k of ['passer', 'target', 'completed', 'intBy', 'tackler', 'recovered', 'forcedBy', 'runner', 'faker', 'screenTarget', 'callFor', 'qbScramble', 'scrambleLive',
      'thrownAway', 'kickParams', 'meter', 'kickTime', 'released', 'returner', 'holeL', 'paRun', 'runPlay', 'fairCall', 'landT', 'kickState', 'kicker', 'holder', 'qb',
      'handed', 'passThrown', 'crossed', 'fumbleT', 'onside', 'offPlay', 'defPlay', 'rushers', 'receivers', 'puntFrom', 'aimView', 'ready', 'snapQueued']) this[k] = null;
    this.liveAt = 9999; this.mirror = 1; this.receivers = [];
  }
  // オフェンス視点の座標 → ワールド
  toW(ox, l) { return { x: this.losX + this.dir * ox, y: U.clamp(this.ballY - this.dir * l, 0.7, FIELD.WID - 0.7) }; }
  fwd(x, side) { return (x - this.losX) * this.g.dirOf(side); } // LOSからsideの攻撃方向への距離
  mk(side, info, slot, pos) {
    const a = Object.assign({}, info.a), m = this.g.ratingMul ? this.g.ratingMul(side) : 1;
    for (const k of ['spd', 'acc', 'agi', 'str', 'cat', 'tha', 'tak', 'blk', 'cov', 'prs', 'kac', 'elu']) a[k] = U.clamp(a[k] * (k === 'spd' ? (1 + (m - 1) * 0.4) : m), 20, 105);
    const p = { id: this.P.length, side, info, slot, pos: info.pos, num: info.num, a, x: pos.x, y: pos.y, vx: 0, vy: 0,
      face: this.g.dirOf(side) === 1 ? 0 : Math.PI, top: SPEED(a), acc: ACCEL(a), job: 'idle', eng: null, engBy: [], imm: {},
      stun: 0, tkCD: 0, human: -1, moveT: 0, moveType: '', hist: [], anim: Math.random() * 6, down: false, sx: pos.x, sy: pos.y };
    // 体格・スキル（マイプレイヤー）
    const b = info.body;
    p.catchR = b ? U.clamp(1 + (b.h - 188) / 100 * 0.6 + (b.wing - b.h - 4) / 100 * 1.0, 0.85, 1.2) : 1;
    p.tackleR = b ? U.clamp(1 + (b.wing - 195) / 100 * 0.8, 0.9, 1.15) : 1;
    p.sk = new Set(info.skills || []);
    if (p.sk.has('speedster')) p.top *= 1.025;
    if (p.sk.has('bigleg')) a.kpw = Math.min(105, a.kpw + 6);
    if (p.sk.has('clutch') && this.g.quarter >= 4) for (const k of ['spd', 'cat', 'tha', 'tak', 'cov', 'prs', 'blk', 'kac', 'elu']) a[k] = Math.min(105, a[k] + 4);
    p.look = info.look || null; p.hgt = b ? b.h / 188 : 1;
    this.P.push(p); return p;
  }
  opp(side) { return 1 - side; }
  teamOf(side) { return this.g.teams[side]; }
  pl(side, slot) { return this.teamOf(side).by[slot]; }

  // ===== スクリメージ =====
  setupScrimmage(off, offPlay, defPlay, opts = {}) {
    const g = this.g; this.reset(); this.kind = 'scrim'; this.off = off; this.def = 1 - off; this.dir = g.dirOf(off);
    this.losX = U.xFromBallOn(g.ballOn, this.dir); this.ballY = g.ballY; this.offPlay = offPlay; this.defPlay = defPlay;
    this.P = []; this.t = 0; this.state = 'pre'; this.flags = []; this.result = null; this.opts = opts;
    this.passThrown = false; this.handed = false; this.crossed = false; this.firstDownX = U.xFromBallOn(Math.min(100, g.ballOn + g.toGo), this.dir);
    const form = OFF_FORMS[offPlay.f], mirror = opts.flip ? -1 : 1;
    this.mirror = mirror;
    for (const slot in form.s) {
      const [ox, l] = form.s[slot];
      const p = this.mk(off, this.pl(off, slot), slot, this.toW(ox, l * mirror));
      p.ox = ox; p.l = l * mirror;
    }
    this.qb = this.P.find(p => p.slot === 'QB');
    this.assignOffense(offPlay);
    this.setupDefense(defPlay);
    this.ball = { x: this.losX, y: this.ballY, z: 0.2, vx: 0, vy: 0, vz: 0, st: 'pre', car: null };
    this.snapAt = null; this.huddle();
  }
  routeWorld(p, name) {
    const R = ROUTES[name]; if (!R) return null;
    const ins = p.l > 0.3 ? -1 : p.l < -0.3 ? 1 : -this.mirror;
    const pts = R.pts.map(([dx, din]) => this.toW(p.ox + dx, p.l + din * ins));
    return { name, pts, i: 0, cont: R.cont, delay: R.delay || 0, screen: R.screen };
  }
  pathWorld(path, mirror) { return path.map(([ox, l]) => this.toW(ox, l * mirror)); }
  assignOffense(play) {
    const t = play.t;
    this.passType = (t === 'pass' || t === 'pa' || t === 'screen');
    this.runPlay = (t === 'run' || t === 'kneel') ? RUNS[play.run] : null;
    this.paRun = t === 'pa' ? RUNS[play.run] : null;
    this.receivers = [];
    for (const p of this.P) {
      if (p.side !== this.off) continue;
      if (['LT', 'LG', 'C', 'RG', 'RT'].includes(p.slot)) { p.job = this.passType || t === 'spike' ? 'pblock' : 'rblock'; continue; }
      if (p.slot === 'QB') { p.job = 'qb'; continue; }
      const rt = play.r && play.r[p.slot];
      if (this.passType && rt && rt !== 'block') {
        p.route = this.routeWorld(p, rt); p.job = 'route'; this.receivers.push(p);
        if (ROUTES[rt].screen) { this.screenTarget = p; }
      } else p.job = this.passType ? 'pblock' : 'rblock';
    }
    if (t === 'screen') this.P.forEach(p => { if (['LT', 'LG', 'C', 'RG', 'RT'].includes(p.slot)) p.screenRel = 1.5; });
    // ラン：キャリア
    const rp = this.runPlay || this.paRun;
    if (rp) {
      const c = rp.qb ? this.qb : this.P.find(p => p.side === this.off && p.slot === (play.c || 'RB'));
      if (c) {
        c.path = this.pathWorld(rp.path, this.mirror); c.pathI = 0; c.runDelay = rp.delay || 0;
        if (this.runPlay) { c.job = rp.qb ? 'qbrun' : 'runner'; this.runner = c; }
        else { c.job = 'fake'; this.faker = c; }
      }
      // ブロックの押し方向（ホール側から遠ざける）
      const last = rp.path[rp.path.length - 1];
      this.holeL = last[1] * this.mirror;
    }
    // 4バーティカル等で全員の場合を考慮: 受け手の番号割り当て
    const ord = ['WR1', 'WR2', 'WR3', 'TE1', 'TE2', 'RB', 'FB'];
    this.receivers.sort((a, b) => ord.indexOf(a.slot) - ord.indexOf(b.slot));
    this.receivers.forEach((r, i) => r.icon = i + 1);
  }
  // 守備の配置と割り当て
  setupDefense(play) {
    const form = DEF_FORMS[play.f], d = this.def, offP = this.P.filter(p => p.side === this.off);
    const elig = offP.filter(p => ['WR', 'TE', 'RB', 'FB'].includes(p.pos));
    const byL = [...elig].sort((a, b) => b.l - a.l);
    const wideP = byL.filter(p => p.l > 0), wideM = [...byL].reverse().filter(p => p.l < 0);
    const used = new Set(); const defs = [];
    const press = play.press ? 1.4 : 6.5;
    for (const slot in form.s) {
      let pos = form.s[slot], w;
      if (pos === 'W+' || pos === 'W-') {
        const list = pos === 'W+' ? wideP : wideM; const r = list.find(x => !used.has(x) && x.pos === 'WR') || list.find(x => !used.has(x));
        if (r) { used.add(r); w = this.toW(press, r.l + (r.l > 0 ? 0.6 : -0.6)); }
        else w = this.toW(7, pos === 'W+' ? 12 : -12);
        const p = this.mk(d, this.pl(d, slot), slot, w); p.alignOn = r; defs.push(p); continue;
      }
      if (pos === 'SL') {
        const r = [...elig].filter(x => !used.has(x) && x.pos !== 'RB' && x.pos !== 'FB').sort((a, b) => Math.abs(b.l) - Math.abs(a.l))[0];
        if (r) { used.add(r); w = this.toW(play.press ? 1.6 : 5, r.l * 0.95); } else w = this.toW(6, 6);
        const p = this.mk(d, this.pl(d, slot), slot, w); p.alignOn = r; defs.push(p); continue;
      }
      let [dp, l] = pos;
      if (slot.startsWith('S')) {
        if (play.cov === 'c3' || play.cov === 'c1') { if (slot === 'S1') { dp = 14; l = 0; } else { dp = play.box ? 6.5 : 8; l = -5; } }
        if (play.cov === 'c0') { dp = 7; }
        if (play.deep) dp += 5;
      }
      const p = this.mk(d, this.pl(d, slot), slot, this.toW(dp, l)); defs.push(p);
    }
    defs.forEach(p => p.job = null);
    this.assignCoverage(play, defs, elig);
  }
  assignCoverage(play, defs, elig) {
    const cov = play.cov, blitz = new Set(play.blitz || []);
    const isDL = p => /^D[ET]/.test(p.slot);
    defs.forEach(p => { if (isDL(p) || blitz.has(p.slot)) p.job = 'rush'; });
    const avail = defs.filter(p => !p.job);
    const Z = (d, l, deep) => ({ d: d + (play.deep ? 5 : 0), l, deep });
    const zones = {
      c2: { CB1: Z(5, 15), CB2: Z(5, -15), S1: Z(19, 11, 1), S2: Z(19, -11, 1), rest: [Z(10, 6), Z(10, -6), Z(11, 0), Z(9, 11), Z(9, -11)] },
      c3: { CB1: Z(17, 16, 1), CB2: Z(17, -16, 1), S1: Z(19, 0, 1), S2: Z(6, -14), rest: [Z(10, 5), Z(10, -5), Z(6, 14), Z(12, 0)] },
      c4: { CB1: Z(16, 18, 1), CB2: Z(16, -18, 1), S1: Z(17, 6, 1), S2: Z(17, -6, 1), rest: [Z(6, 13), Z(6, -13), Z(9, 0), Z(9, 6)] },
      c1: { S1: Z(17, 0, 1), rest: [Z(9, 0)] }, c2m: { S1: Z(18, 11, 1), S2: Z(18, -11, 1), rest: [Z(9, 0)] }, c0: { rest: [] }, gl: { rest: [Z(3, 0)] },
    }[cov];
    const man = ['c0', 'c1', 'c2m', 'gl'].includes(cov);
    const setZone = (p, z) => { p.job = 'zone'; p.zone = z; };
    avail.forEach(p => { if (zones[p.slot]) setZone(p, zones[p.slot]); });
    let rest = avail.filter(p => !p.job);
    if (man) {
      const targets = [...elig].sort((a, b) => Math.abs(b.l) - Math.abs(a.l));
      const taken = new Set();
      const give = (p, r) => { p.job = 'man'; p.man = r; taken.add(r); };
      // コーナーは外側のレシーバー、残りは近い相手
      for (const p of rest.filter(x => x.slot.startsWith('CB'))) {
        const r = p.alignOn && !taken.has(p.alignOn) ? p.alignOn : targets.find(r => !taken.has(r) && r.pos === 'WR');
        if (r) give(p, r);
      }
      const order = rest.filter(x => !x.job).sort((a, b) => (a.slot.startsWith('S') ? 0 : 1) - (b.slot.startsWith('S') ? 0 : 1));
      for (const p of order) {
        const left = targets.filter(r => !taken.has(r));
        if (!left.length) break;
        left.sort((a, b) => U.dist(a.x, a.y, p.x, p.y) - U.dist(b.x, b.y, p.x, p.y));
        give(p, left[0]);
      }
      rest = rest.filter(x => !x.job);
    }
    const rz = zones.rest.slice();
    for (const p of rest) {
      if (rz.length) {
        // 横位置が近いゾーンを選ぶ
        const myL = -(p.y - this.ballY) * this.dir;
        rz.sort((a, b) => Math.abs(a.l - myL) - Math.abs(b.l - myL));
        setZone(p, rz.shift());
      } else p.job = cov === 'c0' || cov === 'gl' ? 'rush' : 'spy';
    }
    this.rushers = defs.filter(p => p.job === 'rush');
    defs.forEach(p => { if (p.zone) { const w = this.toW(p.zone.d, p.zone.l); p.zx = w.x; p.zy = w.y; } });
  }

  // ===== キックオフ =====
  setupKickoff(kick, onside, fromBallOn = 35) {
    const g = this.g; this.reset(); this.kind = 'kickoff'; this.off = kick; this.def = 1 - kick; this.dir = g.dirOf(kick);
    this.P = []; this.t = 0; this.state = 'pre'; this.flags = []; this.result = null; this.onside = onside; this.opts = {};
    this.losX = U.xFromBallOn(fromBallOn, this.dir); this.ballY = FIELD.WID / 2; this.kickFrom = fromBallOn;
    const K = this.mk(kick, this.pl(kick, 'K'), 'K', this.toW(-6, 0.5)); K.job = 'kicker'; this.kicker = K;
    const cov = ['LB1', 'LB2', 'LB3', 'LB4', 'S1', 'S2', 'S3', 'CB3', 'CB4', 'TE2'];
    const lineOx = onside ? -1 : (60 - fromBallOn) - 0.5; // 2025ルール: キック側は相手40ydに整列
    cov.forEach((s, i) => { const l = (i < 5 ? 1 : -1) * (5 + (i % 5) * 4.6); const p = this.mk(kick, this.pl(kick, s), s, this.toW(onside ? -1 : lineOx, l)); p.job = 'kcover'; });
    const r = this.def;
    const setup = ['TE1', 'TE2', 'FB', 'LB1', 'LB2', 'LB3', 'S1', 'S2', 'CB3'];
    const setupOx = onside ? 10.5 : (65.5 - fromBallOn);
    setup.forEach((s, i) => { const l = -20 + i * 5; const p = this.mk(r, this.pl(r, s), s, this.toW(setupOx + (onside ? 0 : (i % 2) * 1.5), l)); p.job = 'kblock'; });
    const ret = this.mk(r, this.pl(r, 'WR3'), 'WR3', this.toW(onside ? 18 : (96 - fromBallOn), 3)); ret.job = 'returner';
    const ret2 = this.mk(r, this.pl(r, 'RB2'), 'RB2', this.toW(onside ? 14 : (93 - fromBallOn), -4)); ret2.job = 'returner2';
    this.returner = ret;
    this.ball = { x: this.losX, y: this.ballY, z: 0.3, vx: 0, vy: 0, vz: 0, st: 'tee', car: null }; this.huddle();
  }
  // ===== パント =====
  setupPunt(off, retPlay) {
    const g = this.g; this.reset(); this.kind = 'punt'; this.off = off; this.def = 1 - off; this.dir = g.dirOf(off);
    this.losX = U.xFromBallOn(g.ballOn, this.dir); this.ballY = g.ballY; this.P = []; this.t = 0; this.state = 'pre'; this.flags = []; this.result = null; this.mirror = 1; this.opts = {};
    for (const slot in OFF_FORMS.punt.s) {
      const [ox, l] = OFF_FORMS.punt.s[slot]; const p = this.mk(off, this.pl(off, slot), slot, this.toW(ox, l)); p.ox = ox; p.l = l;
      p.job = slot === 'P' ? 'punter' : (slot === 'WR1' || slot === 'WR2') ? 'gunner' : 'pblock';
      if (slot === 'P') this.kicker = p;
    }
    const d = this.def, block = retPlay && retPlay.t === 'prb';
    const line = [['DE1', 4.3], ['DT1', 1.2], ['DT2', -1.2], ['DE2', -4.3], ['LB1', 2.5], ['LB3', -2.5]];
    line.forEach(([s, l]) => { const p = this.mk(d, this.pl(d, s), s, this.toW(1, l)); p.job = block ? 'rush' : 'prhold'; });
    const g1 = this.P.find(p => p.slot === 'WR1'), g2 = this.P.find(p => p.slot === 'WR2');
    const j1 = this.mk(d, this.pl(d, 'CB1'), 'CB1', this.toW(1.2, 21)); j1.job = 'jam'; j1.man = g1;
    const j2 = this.mk(d, this.pl(d, 'CB2'), 'CB2', this.toW(1.2, -21)); j2.job = 'jam'; j2.man = g2;
    const l2 = this.mk(d, this.pl(d, 'LB2'), 'LB2', this.toW(block ? 1 : 8, 0)); l2.job = block ? 'rush' : 'prhold';
    const s1 = this.mk(d, this.pl(d, 'S1'), 'S1', this.toW(block ? 1 : 15, block ? 6 : 0)); s1.job = block ? 'rush' : 'prhold';
    const ret = this.mk(d, this.pl(d, 'WR3'), 'WR3', this.toW(Math.min(42, 108 - g.ballOn - 1), 0)); ret.job = 'returner'; this.returner = ret;
    this.ball = { x: this.losX, y: this.ballY, z: 0.2, vx: 0, vy: 0, vz: 0, st: 'pre', car: null }; this.huddle();
  }
  // ===== FG / PAT =====
  setupFG(off, isPat) {
    const g = this.g; this.reset(); this.kind = isPat ? 'pat' : 'fg'; this.off = off; this.def = 1 - off; this.dir = g.dirOf(off);
    this.losX = U.xFromBallOn(g.ballOn, this.dir); this.ballY = g.ballY; this.P = []; this.t = 0; this.state = 'pre'; this.flags = []; this.result = null; this.mirror = 1; this.opts = {};
    for (const slot in OFF_FORMS.fg.s) {
      const [ox, l] = OFF_FORMS.fg.s[slot]; const p = this.mk(off, this.pl(off, slot), slot, this.toW(ox, l)); p.ox = ox; p.l = l;
      p.job = slot === 'QB' ? 'holder' : slot === 'K' ? 'fgkicker' : 'pblock';
      if (slot === 'K') this.kicker = p; if (slot === 'QB') this.holder = p;
    }
    const d = this.def;
    [['DE1', 5.4], ['DT1', 2.2], ['DT2', -0.7], ['DE2', -3.6], ['LB1', 6.8], ['LB3', -6.6], ['LB2', 0.8], ['LB4', -2.2], ['CB1', 8.6], ['CB2', -8.6]]
      .forEach(([s, l]) => { const p = this.mk(d, this.pl(d, s), s, this.toW(Math.abs(l) > 6 ? 1.6 : 1, l)); p.job = 'rush'; });
    const s1 = this.mk(d, this.pl(d, 'S1'), 'S1', this.toW(12, 0)); s1.job = 'spy';
    this.ball = { x: this.losX, y: this.ballY, z: 0.2, vx: 0, vy: 0, vz: 0, st: 'pre', car: null }; this.huddle();
  }
}
