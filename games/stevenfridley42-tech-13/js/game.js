'use strict';
// ===== 試合進行（NFLルール） =====
// ctrls: [{side, kind:'team'|'player', key, source:'local'|'remote', inp}]
class Game {
  constructor(o) {
    this.teams = o.teamObjs || [TEAM_BY_ID[o.home], TEAM_BY_ID[o.away]];
    this.settings = Object.assign({ qlen: 5, diff: 1, assist: true, pen: 1, pace: 0.85, autoSwitch: true }, o.settings || {});
    this.ctrls = o.ctrls.map(c => Object.assign({ inp: { ax: 0, ay: 0, sprint: false, held: {}, pressed: new Set() }, sel: -1, cur: null, touched: false }, c));
    this.humanSide = o.humanSide != null ? o.humanSide : -1;
    this.online = !!o.online;
    this.score = [0, 0]; this.quarter = 1; this.qSec = this.settings.qlen * 60; this.clock = this.qSec;
    this.timeouts = [3, 3]; this.poss = 0; this.down = 1; this.toGo = 10; this.ballOn = 25; this.ballY = FIELD.WID / 2;
    this.clockRunning = false; this.playClock = 40; this.phase = 'intro'; this.phaseT = 0;
    this.wind = { x: U.rnd(-5, 5), y: U.rnd(-3, 3) };
    this.sim = new Sim(this); this.stats = {}; this.log = []; this.events = []; this.ticker = '';
    this.calls = [null, null]; this.ctx = null; this.twoMinDone = {}; this.hurry = false;
    this.drive = { start: 25, plays: 0 }; this.ot = null; this.winner = null;
    this.speed = 1; this.lastRunoff = 0;
    // コイントス
    const tossWin = U.rint(0, 1); this.openRecv = 1 - tossWin; // 勝者は後半に選択を持ち越し（ディファー）
    this.banner('KICKOFF', `${this.teams[1].name} @ ${this.teams[0].name}`, 2.4);
    this.say(`コイントス: ${this.teams[tossWin].name} が勝ち、後半に選択権を持ち越し`);
  }
  dirOf(side) { return ((this.quarter % 2 === 1) ? 1 : -1) * (side === 0 ? 1 : -1); }
  ratingMul(side) {
    if (this.humanSide < 0) return 1;
    const d = this.settings.diff;
    return side === this.humanSide ? [1.06, 1, 0.98][d] : [0.9, 1, 1.06][d];
  }
  banner(text, sub, dur = 2) { this.events.push({ t: 'banner', text, sub, dur }); }
  say(s) { this.ticker = s; this.log.push(`[${U.qName(this.quarter)} ${U.fmtClock(this.clock)}] ${s}`); }
  name(p) { return p ? p.info.name : ''; }
  short(p) { if (!p) return ''; if (p.info.generic) return p.info.name; const n = p.info.name.split(' '); return n.length > 1 ? n[0][0] + '.' + n.slice(1).join(' ') : n[0]; }
  st(p) { const k = p.info.key; return this.stats[k] || (this.stats[k] = { name: p.info.name, team: p.side, pos: p.info.pos, num: p.num, pa: 0, pc: 0, py: 0, ptd: 0, pint: 0, ra: 0, ry: 0, rtd: 0, rec: 0, rey: 0, retd: 0, tk: 0, sk: 0, int: 0, fgm: 0, fga: 0, xpm: 0, xpa: 0 }); }

  // ---------- コントローラ ----------
  ctrlFor(side) { return this.ctrls.filter(c => c.side === side); }
  callerHuman(side, role) {
    // role: 'off' | 'def' | 'kick' | 'ret'
    for (const c of this.ctrls) {
      if (c.side !== side) continue;
      if (c.kind === 'team') return c;
      if (c.kind === 'player' && role === 'off' && c.key && c.key.endsWith(':QB')) return c;
    }
    return null;
  }

  // ---------- フェーズ ----------
  update(dt) {
    this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'intro') { if (this.phaseT > 2.6) this.startKickoff(1 - this.openRecv); return; }
    if (ph === 'call') return this.updateCall(dt);
    if (ph === 'pre') return this.updatePre(dt);
    if (ph === 'live') return this.updateLive(dt);
    if (ph === 'post') {
      this.sim.step(dt, this.ctrls);
      if (this.phaseT > 0.9 && this.ctrls.some(c => c.inp.pressed && c.inp.pressed.has('Enter'))) this.phaseT = 99;
      if (this.phaseT > this.postDur * 1.35 + 0.4) this.next();
      return;
    }
    if (ph === 'break') { if (this.phaseT > 2.6) this.afterBreak(); return; }
  }
  setPhase(p) {
    this.phase = p; this.phaseT = 0;
    if (p === 'post') this.card = { t: this.bigText || '', d: this.ticker, n: this.nextHint || this.nextText() };
    this.nextHint = null; if (p !== 'post') this.bigText = '';
  }
  // 次のプレーの状況（結果カード用）
  nextText() {
    const T = this.teams[this.poss], O = this.teams[1 - this.poss];
    if (this.ctx && this.ctx.type === 'try') return 'キックオフへ';
    if (this.phase === 'final') return '';
    const goal = this.ballOn + this.toGo >= 100;
    return `次: ${T.id} の攻撃 ${U.ord(this.down)} & ${goal ? 'Goal' : Math.max(1, Math.round(this.toGo))}（${U.spotText(this.ballOn, T.id, O.id)}）`;
  }

  // プレーコール開始
  startCall(type, extra) {
    this.ctx = Object.assign({ type, off: this.poss }, extra || {});
    this.callSeq = (this.callSeq || 0) + 1;
    this.calls = [null, null]; this.flip = false; this.hurry = false;
    this.offPlayHint = null;
    this.setPhase('call');
    if (type !== 'try' && type !== 'kickoff') {
      // ランオフ（前のプレーから時計が動いている）
      this.lastRunoff = 0;
      if (this.clockRunning) {
        let r = this.runoff();
        if ((this.quarter === 2 || this.quarter === 4) && !this.twoMinDone[this.quarter] && this.clock > 120 && this.clock - r <= 120) {
          r = this.clock - 120; this.twoMinDone[this.quarter] = true; this.clockRunning = false;
          this.banner('2ミニッツ・ウォーニング', '', 1.8); SFX.whistle();
        }
        this.clock -= r; this.lastRunoff = r;
        if (this.clock <= 0) { this.clock = 0; return this.endQuarter(); }
      }
      if ((this.quarter === 2 || this.quarter === 4) && !this.twoMinDone[this.quarter] && this.clock <= 120 && this.clock > 0) {
        this.twoMinDone[this.quarter] = true; this.clockRunning = false; this.banner('2ミニッツ・ウォーニング', '', 1.8);
      }
    }
    this.playClock = type === 'kickoff' || type === 'try' ? 25 : 40;
    // AIのタイムアウト
    for (const s of [0, 1]) if (!this.callerHuman(s, 'def') && type === 'scrim' && Coach.wantTimeout(this, s)) this.callTimeout(s);
    this.aiCallT = [U.rnd(0.4, 1.0), U.rnd(0.5, 1.2)];
    this.sugg = [this.aiPick(0, true), this.aiPick(1, true)];
  }
  runoff() {
    const base = Math.round(this.settings.qlen / 15 * 26) + 6; // 15分:32秒, 5分:15秒
    return this.hurryPrev ? Math.round(base * 0.45) : base;
  }
  role(side) {
    const t = this.ctx.type;
    if (t === 'kickoff') return side === this.ctx.kicker ? 'kick' : 'ret';
    return side === this.poss ? 'off' : 'def';
  }
  aiPick(side, quiet) {
    const r = this.role(side), t = this.ctx.type;
    if (t === 'kickoff') return r === 'kick' ? Coach.kick(this, side) : RET_PLAYS[0];
    if (t === 'try') return r === 'off' ? Coach.tryChoice(this, side) : (this.calls[this.poss] && this.calls[this.poss].pat ? FGD_PLAYS[0] : PLAY_BY_ID.dg_man);
    if (r === 'off') return Coach.offense(this, side);
    this.offPlayHint = this.calls[this.poss] ? this.calls[this.poss].t : null;
    return Coach.defense(this, side);
  }
  submitCall(side, id, opts = {}) {
    if (this.phase !== 'call' || this.calls[side]) return;
    const r = this.role(side), t = this.ctx.type;
    let play = null;
    if (t === 'try' && r === 'off') play = TRY_PLAYS.find(p => p.id === id) || null;
    else play = PLAY_BY_ID[id];
    if (!play) return;
    this.calls[side] = play;
    if (r === 'off') { this.flip = !!opts.flip; this.hurry = !!opts.hurry; }
    SFX.select();
  }
  updateCall(dt) {
    this.playClock -= dt;
    for (const s of [0, 1]) {
      if (this.calls[s]) continue;
      const human = this.callerHuman(s, this.role(s));
      if (!human) { this.aiCallT[s] -= dt; if (this.aiCallT[s] <= 0 && (this.role(s) === 'off' || this.role(s) === 'kick' || this.calls[1 - s] || this.aiCallT[s] < -0.6)) { this.calls[s] = this.aiPick(s); if (this.role(s) === 'off') this.flip = U.chance(0.5); } }
      else if (this.playClock <= 0 && (this.role(s) !== 'off' || this.ctx.type !== 'scrim')) this.calls[s] = this.aiPick(s);
    }
    if (this.playClock <= 0 && !this.calls[this.poss] && this.ctx.type === 'scrim') return this.delayOfGame();
    if (this.calls[0] && this.calls[1]) this.setupPlay();
  }
  setupPlay() {
    const t = this.ctx.type, sim = this.sim, off = this.poss;
    let oc = this.calls[off], dc = this.calls[1 - off];
    this.hurryPrev = this.hurry;
    if (t === 'kickoff') { const k = this.ctx.kicker; sim.setupKickoff(k, this.calls[k].t === 'onside', this.ctx.from); }
    else if (oc.t === 'punt') sim.setupPunt(off, dc.t === 'pr' || dc.t === 'prb' ? dc : PR_PLAYS[0]);
    else if (oc.t === 'fg') sim.setupFG(off, !!oc.pat);
    else {
      if (!dc.f) dc = PLAY_BY_ID.d43_c2;
      if (this.ballOn >= 96 && dc.f !== 'goalline' && false) dc = PLAY_BY_ID.dg_man;
      sim.setupScrimmage(off, oc, dc, { flip: this.flip });
    }
    sim.msg = [];
    // キッカーが人間ならメーター
    const kk = sim.kicker;
    this.ctrls.forEach((c, i) => {
      if (!kk || c.side !== kk.side) return;
      if ((c.kind === 'team') || (c.kind === 'player' && c.key === kk.info.key)) sim.initMeter(i, c.side);
    });
    sim.assignControl && (sim.ctrls = this.ctrls, sim.assignControl());
    this.autoSnapT = sim.meter ? 99 : (this.hurry ? U.rnd(0.5, 0.8) : U.rnd(1.4, 2.2));
    const hc = this.ctrls.find(c => c.side === off && (c.kind === 'team' || (c.key && c.key.endsWith(':QB'))));
    this.humanSnap = sim.kind === 'scrim' && !!hc;
    if (this.humanSnap) this.autoSnapT = 99;
    if (sim.kind === 'scrim') this.drive.plays++;
    this.setPhase('pre');
  }
  updatePre(dt) {
    this.playClock -= dt;
    this.sim.step(dt, this.ctrls);
    if (this.sim.state === 'pre') {
      if (!this.sim.ready) return; // 選手がセットするまで待つ
      this.autoSnapT -= dt;
      if (this.ctx.type === 'scrim' && this.playClock <= 0) return this.delayOfGame();
      if (this.autoSnapT <= 0) {
        // プレスナップ反則（AI）
        if (this.ctx.type === 'scrim' && this.sim.kind === 'scrim') {
          const pen = this.settings.pen;
          if (!this.callerHuman(this.poss, 'off') && U.chance(0.011 * pen)) return this.preSnapFoul(this.poss, 'フォルススタート');
          if (!this.callerHuman(1 - this.poss, 'def') && U.chance(0.009 * pen)) return this.preSnapFoul(1 - this.poss, 'オフサイド');
        }
        this.sim.snap();
      }
    }
    if (this.sim.state === 'live') { this.setPhase('live'); if (this.sim.kind !== 'kickoff') this.clockRunning = true; SFX.crowdLevel(0.7); }
  }
  updateLive(dt) {
    const sim = this.sim;
    // 個人モードで自分が関与しないとき早送り
    let steps = 1;
    if (this.ctrls.some(c => c.source === 'local' && c.inp.held.Enter) && !this.online) steps = 3;
    const pdt = dt * (this.settings.pace || 1);
    for (let i = 0; i < steps; i++) {
      sim.step(pdt, this.ctrls);
      if (sim.kind === 'kickoff' && sim.liveAt < 999 && sim.t >= sim.liveAt) this.clockRunning = true;
      if (sim.kind === 'punt' && sim.liveAt < 999 && sim.t >= sim.liveAt) this.clockRunning = true;
      if (this.clockRunning && this.ctx.type !== 'try') { this.clock -= pdt; if (this.clock < 0) this.clock = 0; }
      if (sim.state === 'done') break;
    }
    while (sim.msg.length) this.say(sim.msg.shift());
    if (sim.state === 'done') { this.applyResult(sim.result); }
  }
  preSnapFoul(side, name) {
    this.banner('FLAG', `${name} — ${this.teams[side].name}  5ヤード`, 1.8); SFX.whistle();
    this.enforceSimple(side, 5, false);
    this.clockRunning = false; this.say(`反則: ${name} (${this.teams[side].id}) 5ヤード`);
    this.postDur = 1.8; this.nextAction = () => this.startCall('scrim'); this.setPhase('post');
  }
  delayOfGame() {
    this.banner('FLAG', `ディレイ・オブ・ゲーム — ${this.teams[this.poss].name}  5ヤード`, 1.8); SFX.whistle();
    this.enforceSimple(this.poss, 5, false); this.clockRunning = false;
    this.say(`反則: ディレイ・オブ・ゲーム 5ヤード`);
    this.postDur = 1.6; this.nextAction = () => this.startCall('scrim'); this.setPhase('post');
  }
  // 簡易罰退（LOS基準、ハーフ・ザ・ディスタンス）
  enforceSimple(side, yds, autoFirst) {
    if (side === this.poss) {
      const y = Math.min(yds, Math.floor(this.ballOn / 2) || 0); this.ballOn -= y; this.toGo += y;
    } else {
      const y = Math.min(yds, Math.floor((100 - this.ballOn) / 2)); this.ballOn += y; this.toGo -= y;
      if (autoFirst || this.toGo <= 0) { this.down = 1; this.toGo = Math.min(10, 100 - this.ballOn); }
    }
  }
  callTimeout(side) {
    if (this.timeouts[side] <= 0 || !(this.phase === 'call' || this.phase === 'pre') || this.ctx.type !== 'scrim') return false;
    if (!this.clockRunning && !this.lastRunoff) { /* 時計が止まっていても取れる */ }
    this.timeouts[side]--; this.clock += this.lastRunoff || 0; this.lastRunoff = 0; this.clockRunning = false; this.playClock = 40;
    this.banner('TIMEOUT', `${this.teams[side].name}（残り${this.timeouts[side]}）`, 1.6); SFX.whistle();
    this.say(`タイムアウト: ${this.teams[side].name}`);
    return true;
  }

  // ---------- キックオフ ----------
  startKickoff(kicker, from = 35) {
    this.poss = kicker; this.ctx = { type: 'kickoff', kicker, from, off: kicker };
    this.ballOn = from; this.ballY = FIELD.WID / 2;
    this.startCall('kickoff', { kicker, from });
  }

  // ---------- 結果処理 ----------
  applyResult(R) {
    const off = this.poss, def = 1 - off, k = R.kind, prevBallOn = this.ballOn;
    let msg = '', big = null, stop = false, next = 'scrim';
    this.postDur = 2.2;
    const P = this.sim;
    if (k === 'kickoff') {
      const rec = 1 - this.ctx.kicker;
      if (R.ty === 'td') { return this.score6(R.scoreSide, R, 'キックオフリターンTD！'); }
      if (R.ty === 'onside') { this.newPossession(R.newPoss, U.ballOnFromX(R.x, this.dirOf(R.newPoss))); msg = R.newPoss === this.ctx.kicker ? 'オンサイドキック成功！' : 'オンサイドキックはレシーブ側が確保'; stop = true; }
      else if (R.ty === 'safety') return this.safety(R.scoreSide, R);
      else if (R.setBallOn != null) { this.newPossession(rec, R.setBallOn); msg = R.ty === 'touchback' ? `タッチバック（${R.setBallOn}ヤードから）` : R.ty === 'ko_short' ? 'キックがランディングゾーンに届かず → 40ヤードから' : 'キックがアウトオブバウンズ → 40ヤードから'; stop = true; }
      else {
        const np = R.newPoss, bo = U.ballOnFromX(R.x, this.dirOf(np));
        this.newPossession(np, bo);
        msg = `${this.short(R.car)} のリターン、${U.spotText(bo, this.teams[np].id, this.teams[1 - np].id)} まで`;
        stop = R.ty === 'oob';
        if (R.recovered && R.recovered.turn) { msg = 'リターナーがファンブル！ キック側がリカバー！'; stop = true; }
      }
      this.clockRunning = !stop && this.clockRunning;
      return this.finish(msg, next, big);
    }
    if (k === 'punt') {
      if (R.ty === 'td') return this.score6(R.scoreSide, R, 'パントリターンTD！');
      if (R.ty === 'safety') return this.safety(R.scoreSide, R);
      if (R.ty === 'blocked') { this.newPossession(def, U.ballOnFromX(R.x, this.dirOf(def))); msg = 'パントブロック！'; big = 'BLOCKED!'; }
      else if (R.setBallOn != null) { this.newPossession(R.newPoss, R.setBallOn); msg = 'パントはタッチバック'; }
      else {
        const np = R.newPoss, bo = U.ballOnFromX(R.x, this.dirOf(np));
        const dist = Math.round(Math.abs(R.x - P.losX));
        if (P.kicker) { const ps = this.st(P.kicker); ps.pun = (ps.pun || 0) + 1; ps.puy = (ps.puy || 0) + dist; }
        this.newPossession(np, U.clamp(bo, 1, 99));
        msg = R.ty === 'fair' ? `${dist}ヤードのパント、フェアキャッチ` : R.ty === 'downed' ? `${dist}ヤードのパント、ダウン` : `パントリターン、${U.spotText(this.ballOn, this.teams[np].id, this.teams[1 - np].id)} まで`;
        if (R.recovered && R.recovered.turn) msg = 'リターナーのファンブル！ キック側がリカバー！';
      }
      this.clockRunning = false;
      return this.finish(msg, next, big);
    }
    if (k === 'fg' || k === 'pat') {
      const K = P.kicker, s = this.st(K), dist = Math.round(100 - prevBallOn + 17);
      if (k === 'pat') {
        s.xpa++; if (R.good) { s.xpm++; this.score[off] += 1; }
        msg = R.good ? 'エクストラポイント成功' : (R.blocked ? 'PATブロック！' : 'エクストラポイント失敗');
        this.clockRunning = false;
        return this.finish(msg, 'kickoff:' + off, R.good ? 'GOOD' : 'NO GOOD');
      }
      s.fga++;
      if (R.good) { s.fgm++; this.score[off] += 3; SFX.cheer(true); this.clockRunning = false; this.otScore(off, 3); return this.finish(`${dist}ヤード フィールドゴール成功！`, 'kickoff:' + off, 'FIELD GOAL'); }
      // 失敗：キック地点（またはD側20yd）から相手ボール
      const kickSpot = 100 - (prevBallOn - 7);
      this.newPossession(def, Math.max(20, Math.min(99, kickSpot)));
      this.clockRunning = false;
      return this.finish(`${dist}ヤード フィールドゴール失敗${R.blocked ? '（ブロック）' : R.short ? '（ショート）' : ''}`, next, 'NO GOOD');
    }
    // ===== スクリメージ =====
    const two = this.ctx.type === 'try';
    const dir = this.dirOf(off);
    const A = this.outcome(R);
    // 反則
    let flag = (R.flags || [])[0];
    if (flag && !two) {
      const B = this.penaltyOutcome(flag, R);
      const offended = 1 - flag.side, offFouled = flag.side === off;
      const vA = this.val(A, off), vB = this.val(B, off);
      const accept = offFouled ? vB <= vA : vB >= vA;
      this.banner('FLAG', `${flag.name} — ${this.teams[flag.side].name}  ${accept ? '受諾' : '辞退'}`, 1.8);
      this.say(`反則: ${flag.name}（${this.teams[flag.side].id}）${accept ? '受諾' : '辞退'}`);
      if (accept) {
        const offF = flag.side === off, y = Math.round(Math.abs(B.ballOn - this.ballOn));
        const txt = `反則: ${flag.name}（${this.teams[flag.side].id}）` + (offF ? `${y}ヤード罰退、ダウンやり直し` : `${y}ヤード前進` + (B.down === 1 ? '、オートマチック・ファーストダウン' : ''));
        return this.commit(B, txt, true);
      }
    }
    this.stats_(R, false);
    if (two) {
      if (A.td && A.side === off) { this.score[off] += 2; return this.finish('2ポイントコンバージョン成功！', 'kickoff:' + off, '2PT GOOD'); }
      if (A.td && A.side === def) { this.score[def] += 2; return this.finish('ディフェンスが2点を返した！', 'kickoff:' + off, 'DEFENSE 2'); }
      return this.finish('2ポイントコンバージョン失敗', 'kickoff:' + off, 'NO GOOD');
    }
    return this.commit(A, '', false);
  }
  // プレー結果 → 次の状態候補
  outcome(R) {
    const off = this.poss, def = 1 - off, dirO = this.dirOf(off);
    const o = { down: this.down, toGo: this.toGo, ballOn: this.ballOn, poss: off, stop: false, desc: '', yds: 0 };
    if (R.ty === 'td') return Object.assign(o, { td: true, side: R.scoreSide, stop: true });
    if (R.ty === 'safety') return Object.assign(o, { safety: true, side: R.scoreSide, stop: true });
    if (R.ty === 'inc') { o.down++; o.stop = true; o.inc = true; }
    else if (R.ty === 'touchback') { o.poss = R.newPoss; o.ballOn = R.setBallOn; o.down = 1; o.toGo = 10; o.stop = true; o.turn = R.newPoss !== off; }
    else if (R.newPoss !== off) { o.poss = R.newPoss; o.ballOn = U.clamp(U.ballOnFromX(R.x, this.dirOf(R.newPoss)), 1, 99); o.down = 1; o.toGo = Math.min(10, 100 - o.ballOn); o.turn = true; o.stop = true; }
    else {
      const bo = U.clamp(U.ballOnFromX(R.x, dirO), 0.5, 99.5);
      o.yds = bo - this.ballOn; o.ballOn = bo;
      if (o.yds >= this.toGo - 0.05) { o.down = 1; o.toGo = Math.min(10, 100 - bo); o.first = true; }
      else { o.down++; o.toGo = this.toGo - o.yds; }
      o.stop = R.ty === 'oob' && ((this.quarter === 2 && this.clock <= 120) || (this.quarter >= 4 && this.clock <= 300));
      if (R.ty === 'oob' && !o.stop) o.restart = true;
    }
    if (o.down > 4 && o.poss === off) { o.poss = def; o.ballOn = 100 - o.ballOn; o.down = 1; o.toGo = Math.min(10, 100 - o.ballOn); o.turn = true; o.downs = true; o.stop = true; }
    return o;
  }
  penaltyOutcome(f, R) {
    const off = this.poss, o = { down: this.down, toGo: this.toGo, ballOn: this.ballOn, poss: off, stop: true, pen: f };
    if (f.side === off) { const y = Math.min(f.yds, Math.floor(this.ballOn / 2)); o.ballOn -= y; o.toGo += y; }
    else {
      let target = this.ballOn + (f.yds || 0);
      if (f.spotX != null) target = Math.max(this.ballOn + 1, U.ballOnFromX(f.spotX, this.dirOf(off)));
      if (f.post && R.newPoss === off && R.ty !== 'td') target = Math.max(target, U.ballOnFromX(R.x, this.dirOf(off)) + f.yds);
      const maxB = this.ballOn + Math.floor((100 - this.ballOn) / 2);
      if (f.spotX == null && target > maxB && !f.post) target = maxB;
      target = Math.min(99, target);
      o.toGo -= (target - this.ballOn); o.ballOn = target;
      if (f.first || o.toGo <= 0) { o.down = 1; o.toGo = Math.min(10, 100 - o.ballOn); }
    }
    return o;
  }
  val(o, off) {
    let v = o.poss === off ? o.ballOn : -(100 - o.ballOn) - 20;
    if (o.td) v += o.side === off ? 200 : -200;
    if (o.safety) v -= 60;
    if (o.down === 1 && o.poss === off) v += 8; else v -= o.down * 2 + o.toGo * 0.3;
    return v;
  }
  commit(o, pre, pen) {
    const off = this.poss, R = this.sim.result;
    if (o.td) return this.score6(o.side, R, null);
    if (o.safety) return this.safety(o.side, R);
    const msg = pen ? pre : this.describe(R, o);
    const was = this.poss;
    this.poss = o.poss; this.down = o.down; this.toGo = o.toGo; this.ballOn = o.ballOn;
    this.ballY = U.clamp(this.sim.result && this.sim.result.y != null ? this.sim.result.y : this.ballY, FIELD.HASH1, FIELD.HASH2);
    if (o.inc || o.pen) this.ballY = this.ballY;
    let big = null;
    if (o.turn) { this.drive = { start: this.ballOn, plays: 0 }; big = o.downs ? 'TURNOVER ON DOWNS' : (R.intBy ? 'INTERCEPTION' : 'TURNOVER'); this.otPossEnd(was); }
    else if (o.first && !pen) big = 'FIRST DOWN';
    this.clockRunning = !(o.stop || pen || R.spike);
    if (R.sack) big = 'SACK!';
    return this.finish(msg, 'scrim', big);
  }
  describe(R, o) {
    const y = Math.round(o.yds || 0), ys = (y >= 0 ? y : y) + 'ヤード';
    if (R.offPlay && R.offPlay.t === 'kneel') return 'ニーダウン';
    if (R.spike) return 'スパイクで時計を止める';
    if (R.intBy) return `${this.short(R.passer)} のパスを ${this.short(R.intBy)} がインターセプト！`;
    if (R.recovered && R.recovered.turn) return `ファンブル！ ${this.short(R.recovered.by)} がリカバー`;
    if (R.sack) return `${this.short(R.passer || R.car)} がサック！ ${ys}`;
    if (R.ty === 'inc') return R.thrownAway ? `${this.short(R.passer)} 投げ捨て` : `${this.short(R.passer)} → ${this.short(R.target)} パス失敗`;
    if (R.completed) return `${this.short(R.passer)} → ${this.short(R.completed)} ${ys}のパス成功` + (o.first ? '、ファーストダウン' : '');
    const car = R.car ? this.short(R.car) : R.runner ? this.short(R.runner) : '';
    return `${car} のラン ${ys}` + (o.first ? '、ファーストダウン' : '') + (o.downs ? ' — フォースダウン失敗' : '');
  }
  newPossession(side, ballOn) {
    const was = this.poss;
    this.poss = side; this.ballOn = U.clamp(ballOn, 1, 99); this.down = 1; this.toGo = Math.min(10, 100 - this.ballOn); this.ballY = FIELD.WID / 2;
    this.drive = { start: this.ballOn, plays: 0 };
    if (this.ot && was !== side && this.ctx.type !== 'kickoff') this.otPossEnd(was);
  }
  score6(side, R, txt) {
    this.score[side] += 6; SFX.cheer(true); SFX.horn();
    const car = R && R.car;
    if (R && R.kind === 'scrim') this.stats_(R, false, true);
    this.say(txt || `${this.short(car)} のタッチダウン！`);
    this.poss = side; this.ballOn = 85; this.ballY = FIELD.WID / 2; this.down = 1; this.toGo = 15; this.clockRunning = false;
    // 延長：先攻TDでも後攻は攻撃できる（2025ルール）
    if (this.ot) { if (this.otScore(side, 6)) { this.postDur = 3; this.nextAction = () => this.endGame(); this.banner('TOUCHDOWN', this.teams[side].name + ' 勝利！', 3); return this.setPhase('post'); } }
    this.banner('TOUCHDOWN', this.teams[side].city + ' ' + this.teams[side].name, 2.6);
    this.bigText = 'TOUCHDOWN'; this.nextHint = '次: トライ（PATキック or 2ポイント）';
    this.postDur = 2.8; this.nextAction = () => { this.poss = side; this.ballOn = 85; this.ballY = FIELD.WID / 2; this.startCall('try'); };
    this.setPhase('post');
  }
  safety(side, R) {
    this.score[side] += 2; SFX.cheer(true);
    this.banner('SAFETY', this.teams[side].name + ' +2', 2.4); this.say('セーフティ！');
    this.bigText = 'SAFETY'; this.nextHint = '次: 自陣20ヤードからフリーキック';
    this.clockRunning = false;
    if (this.ot && this.otScore(side, 2)) { this.postDur = 3; this.nextAction = () => this.endGame(); return this.setPhase('post'); }
    this.postDur = 2.6; this.nextAction = () => this.startKickoff(1 - side, 20); this.setPhase('post');
  }
  finish(msg, next, big) {
    if (msg) this.say(msg);
    this.bigText = big || '';
    if (next.startsWith('kickoff')) this.nextHint = '次: キックオフ';
    if (big) this.banner(big, '', 1.6);
    if (big === 'FIRST DOWN' || big === 'INTERCEPTION') SFX.cheer(false);
    SFX.crowdLevel(0.35);
    this.nextAction = () => {
      if (next.startsWith('kickoff:')) {
        const scorer = +next.split(':')[1];
        if (this.ot && this.otDone()) return this.endGame();
        if (this.clock <= 0 && this.quarter !== 2 && this.quarter !== 4 && this.quarter < 5) return this.endQuarter(() => this.startKickoff(scorer));
        if (this.clock <= 0) return this.endQuarter();
        return this.startKickoff(scorer);
      }
      if (this.ot && this.otDone()) return this.endGame();
      if (this.clock <= 0) return this.endQuarter();
      this.startCall('scrim');
    };
    this.setPhase('post');
  }
  next() { const f = this.nextAction; this.nextAction = null; if (f) f(); }

  // ---------- 統計 ----------
  stats_(R, nullified, scored) {
    if (nullified || !R || R.kind !== 'scrim' || R._done) return; R._done = true;
    const off = this.poss, dir = this.dirOf(off);
    const yds = R.newPoss === off ? Math.round(U.ballOnFromX(U.clamp(R.x, 10, 110), dir) - this.ballOn) : 0;
    const td = R.ty === 'td';
    if (R.passer && !R.sack) {
      const s = this.st(R.passer); s.pa++;
      if (R.completed) { s.pc++; s.py += yds; const r = this.st(R.completed); r.rec++; r.rey += yds; if (td) { s.ptd++; r.retd++; } }
      if (R.intBy) { s.pint++; this.st(R.intBy).int++; }
    } else if (R.sack) { if (R.tackler) this.st(R.tackler).sk++; }
    else if (R.offPlay && R.offPlay.t !== 'kneel' && R.offPlay.t !== 'spike') {
      const c = R.car || R.runner; if (c && c.side === off) { const s = this.st(c); s.ra++; s.ry += yds; if (td) s.rtd++; }
    }
    if (R.tackler && !R.sack) this.st(R.tackler).tk++;
  }

  // ---------- 時間・クォーター ----------
  endQuarter(then) {
    const q = this.quarter;
    this.clockRunning = false;
    if (q === 4 || q >= 5) {
      if (this.score[0] !== this.score[1] || q >= 5) return this.endGame();
      return this.startOT();
    }
    this.banner(q === 2 ? 'HALFTIME' : `END OF ${U.ord(q).toUpperCase()} QUARTER`, `${this.teams[1].id} ${this.score[1]} - ${this.score[0]} ${this.teams[0].id}`, 2.6);
    SFX.horn(); this.breakThen = then; this.setPhase('break');
  }
  afterBreak() {
    const q = this.quarter;
    this.quarter++; this.clock = this.qSec;
    if (q === 2) { this.timeouts = [3, 3]; if (this.events) this.events.push({ t: 'half' }); return this.startKickoff(1 - this.openRecv); }
    if (this.breakThen) { const f = this.breakThen; this.breakThen = null; return f(); }
    // 次のクォーター：同じ位置関係で続行（攻撃方向は自動的に反転）
    this.startCall('scrim');
  }
  startOT() {
    this.quarter = 5; this.clock = Math.round(this.qSec * 10 / 15); this.timeouts = [2, 2];
    const recv = U.rint(0, 1);
    this.ot = { first: recv, had: [false, false], sudden: false, pts: [0, 0] };
    this.banner('OVERTIME', `${this.teams[recv].name} がレシーブ`, 2.6);
    this.say('延長戦突入（両チームに攻撃機会あり）');
    this.breakThen = null;
    this.postDur = 2.6; this.nextAction = () => this.startKickoff(1 - recv); this.setPhase('post');
  }
  otPossEnd(side) { if (!this.ot) return; this.ot.had[side] = true; if (this.ot.had[0] && this.ot.had[1]) this.ot.sudden = true; }
  otScore(side, pts) {
    if (!this.ot) return false;
    if (pts === 2 && !this.ot.had[0] && !this.ot.had[1]) return true; // 最初の攻撃でセーフティ
    if (this.ot.sudden) return true;
    this.ot.had[this.poss] = true;
    if (this.ot.had[0] && this.ot.had[1]) { this.ot.sudden = true; return pts === 6 ? this.score[side] > this.score[1 - side] : this.score[0] !== this.score[1]; }
    return false;
  }
  otDone() { return this.ot && this.ot.had[0] && this.ot.had[1] && this.score[0] !== this.score[1]; }
  endGame() {
    this.setPhase('final');
    this.winner = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    this.banner('FINAL', this.winner < 0 ? '引き分け' : `${this.teams[this.winner].city} ${this.teams[this.winner].name} の勝利！`, 4);
    SFX.horn(); SFX.cheer(true);
    this.events.push({ t: 'final' });
  }

  // ---------- 表示用 ----------
  view() {
    const s = this.sim;
    return {
      ph: this.phase, card: this.phase === 'post' ? this.card : null, pt: this.phaseT, cs: this.callSeq, sc: this.score, q: this.quarter, clk: this.clock, pc: this.playClock, to: this.timeouts, poss: this.poss,
      down: this.down, tg: this.toGo, bo: this.ballOn, ctx: this.ctx, calls: [!!this.calls[0], !!this.calls[1]], sugg: this.sugg ? this.sugg.map(p => p && p.id) : null,
      tick: this.ticker, sim: (this.phase === 'pre' || this.phase === 'live' || this.phase === 'post') ? s.view() : null,
      lastSim: s.losX != null ? { los: s.losX, dir: s.dir } : null, humanSnap: this.humanSnap, kind: s.kind, wind: this.wind,
      dirs: [this.dirOf(0), this.dirOf(1)], fdX: U.xFromBallOn(Math.min(100, this.ballOn + this.toGo), this.dirOf(this.poss)), losX: U.xFromBallOn(this.ballOn, this.dirOf(this.poss)),
      ballY: this.ballY, cr: this.clockRunning, winner: this.winner,
    };
  }
}
