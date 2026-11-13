'use strict';
// AIコーチ: 状況に応じたプレーコール
const Coach = {
  maxFG(team) { return Math.round(44 + (team.by.K.a.kpw - 75) * 0.65); },
  isLate(g) { return (g.quarter === 2 || g.quarter >= 4) && g.clock <= 150; },
  offense(g, side) {
    const t = g.teams[side], diff = g.score[side] - g.score[1 - side], q = g.quarter, clk = g.clock;
    const late4 = q >= 4 && clk <= 300, endHalf = (q === 2 || q >= 4) && clk <= 130;
    const oppTO = g.timeouts[1 - side];
    // ニーダウン（逃げ切り）
    if (q >= 4 && diff > 0 && clk <= (5 - g.down - oppTO) * 40 + 2 && g.down <= 4) return PLAY_BY_ID.kneel;
    if (q === 2 && clk <= 30 && g.ballOn < 50 && g.down < 4 && diff >= 0) return PLAY_BY_ID.kneel;
    // 4th down
    if (g.down === 4) {
      const fgDist = 100 - g.ballOn + 17, maxFG = this.maxFG(t);
      const needTD = late4 && diff < -3, desperate = late4 && diff < 0 && clk < 150;
      if (!needTD && fgDist <= maxFG && !(late4 && diff <= -9)) {
        if (!(g.toGo <= 1 && g.ballOn >= 95 && U.chance(0.3))) return PLAY_BY_ID.fg;
      }
      const goFor = needTD || desperate || (g.toGo <= 1 && g.ballOn >= 40 && U.chance(0.55)) || (g.toGo <= 3 && g.ballOn >= 62 && U.chance(0.45));
      if (!goFor) return fgDist <= maxFG + 3 && g.ballOn > 55 ? PLAY_BY_ID.fg : PLAY_BY_ID.punt;
    }
    // ヘイルメリー
    if (endHalf && clk <= 7 && g.ballOn >= 40 && g.ballOn < 75 && (q === 2 || diff <= 0)) return PLAY_BY_ID.e_hail;
    // スパイク（時計を止める）
    if (endHalf && g.clockRunning && g.timeouts[side] === 0 && clk < 40 && clk > 4 && g.down < 4 && diff <= 0 && U.chance(0.6)) return PLAY_BY_ID.spike;
    return this.pickScrimmage(g, side, diff, endHalf, late4);
  },
  pickScrimmage(g, side, diff, endHalf, late4) {
    const gl = g.ballOn >= 97, d = g.toGo;
    let runP = d <= 2 ? 0.6 : d <= 5 ? 0.45 : d <= 9 ? 0.35 : 0.15;
    if (g.down === 3 && d >= 4) runP = 0.08;
    if (endHalf && diff <= 0) runP *= 0.25;
    if (late4 && diff > 0) runP = Math.max(runP, 0.7);
    if (g.down === 1 && !endHalf) runP = Math.max(runP, 0.48);
    const isRun = U.chance(runP);
    let pool = OFF_PLAYS.filter(p => !p.sp && !p.hail);
    if (gl) pool = pool.filter(p => ['goalline', 'shotgun', 'iform', 'gun_trips'].includes(p.f) && p.t !== 'screen' && p.id !== 'g_4v');
    else pool = pool.filter(p => p.f !== 'goalline' || d <= 1);
    let cand = pool.filter(p => isRun ? p.t === 'run' : (p.t === 'pass' || p.t === 'pa' || p.t === 'screen'));
    if (!isRun && g.down >= 3 && d >= 6) cand = cand.filter(p => p.t === 'pass');
    if (d <= 1 && isRun && U.chance(0.35)) cand = pool.filter(p => p.id === 'gl_sneak' || p.id === 'i_dive');
    return U.pick(cand.length ? cand : pool);
  },
  defense(g, side) {
    const off = 1 - side, d = g.toGo, diff = g.score[side] - g.score[off], q = g.quarter, clk = g.clock;
    if (g.offPlayHint === 'punt') return PR_PLAYS[0];
    if (g.offPlayHint === 'fg') return FGD_PLAYS[0];
    if (g.ballOn >= 97) return U.pick(DEF_PLAYS.filter(p => p.f === 'goalline'));
    if ((q === 2 || q >= 4) && clk <= 120 && diff > 0 && diff <= 16 && g.ballOn < 70) return U.chance(0.6) ? PLAY_BY_ID.dd_prev : PLAY_BY_ID.dn_c4;
    let f;
    if (d >= 10 || (g.down === 3 && d >= 7)) f = U.chance(0.35) ? 'dime' : 'nickel';
    else if (d <= 3) f = U.chance(0.7) ? '43' : 'nickel';
    else f = U.chance(0.55) ? 'nickel' : '43';
    const pool = DEF_PLAYS.filter(p => p.f === f);
    const blitz = U.chance(g.down === 3 ? 0.3 : 0.17);
    const c = pool.filter(p => blitz ? p.blitz : !p.blitz);
    if (d <= 2 && f === '43' && U.chance(0.4)) return PLAY_BY_ID.d43_box;
    return U.pick(c.length ? c : pool);
  },
  tryChoice(g, side) {
    const diff = g.score[side] - g.score[1 - side]; // TD後の差
    if (g.quarter >= 4 && [-2, -5, -10, 1, 5, -9].includes(diff) && g.clock < 900) return U.pick(TRY_PLAYS.slice(1));
    return TRY_PLAYS[0];
  },
  kick(g, side) {
    const diff = g.score[side] - g.score[1 - side];
    return (g.quarter >= 4 && diff < 0 && diff >= -16 && g.clock < 150) ? KICK_PLAYS[1] : KICK_PLAYS[0];
  },
  wantTimeout(g, side) {
    if (g.timeouts[side] <= 0 || !g.clockRunning) return false;
    const diff = g.score[side] - g.score[1 - side], half2 = g.quarter >= 4, half1 = g.quarter === 2;
    if (!(half1 || half2) || g.clock > 125) return false;
    if (g.poss === side) return (half1 || diff <= 0 || diff <= 3 && g.ballOn > 55) && g.clock < 70;
    return half2 && diff <= 8 && diff > -16 && g.clock > 8;
  },
};
