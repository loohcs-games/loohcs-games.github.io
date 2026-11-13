'use strict';
// ===== キャリアモード: リーグ運営（日程・試合シミュ・成績・順位・プレーオフ・表彰・殿堂） =====
const poisson = lam => { lam = Math.max(0, lam); let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L && k < 60); return k - 1; };
const DIVS = [];
['AFC', 'NFC'].forEach(c => ['East', 'North', 'South', 'West'].forEach(d => DIVS.push({ c, d, teams: TEAMS.filter(t => t.conf === c && t.div === d).map(t => t.id) })));
const divOf = id => DIVS.find(d => d.teams.includes(id));

const League = {
  // ---------- 日程（17試合・18週・バイ1回） ----------
  schedule() {
    for (let attempt = 0; attempt < 200; attempt++) {
      const ids = TEAMS.map(t => t.id), need = {}, cnt = {}, games = [];
      ids.forEach(a => { cnt[a] = 0; need[a] = {}; divOf(a).teams.forEach(b => { if (b !== a) need[a][b] = 2; }); });
      const pair = (a, b) => ((need[a][b] || 0) > 0 ? 3 : 0);
      const met = {};
      const byeW = {}; const sh = ids.slice().sort(() => Math.random() - 0.5); sh.forEach((id, i) => byeW[id] = 5 + Math.floor(i / 4));
      let ok = true;
      for (let w = 1; w <= 18 && ok; w++) {
        let pool = ids.filter(id => byeW[id] !== w).sort(() => Math.random() - 0.5);
        // 残り週数に対し地区戦が多いチームを優先
        pool.sort((a, b) => Object.values(need[b]).reduce((s, v) => s + v, 0) - Object.values(need[a]).reduce((s, v) => s + v, 0));
        while (pool.length) {
          const a = pool.shift();
          let best = -1, bs = -1e9;
          pool.forEach((b, j) => {
            const k = a < b ? a + b : b + a, m = met[k] || 0;
            if (m >= (need[a][b] != null ? 2 : 1) && !(need[a][b] > 0)) return;
            const s = pair(a, b) * 10 + (divOf(a).c === divOf(b).c ? 1 : 0) + Math.random() * 2 - m * 5;
            if (s > bs) { bs = s; best = j; }
          });
          if (best < 0) { ok = false; break; }
          const b = pool.splice(best, 1)[0], k = a < b ? a + b : b + a;
          met[k] = (met[k] || 0) + 1; if (need[a][b]) { need[a][b]--; need[b][a]--; }
          const home = need[a][b] === 0 && met[k] === 2 ? (games.find(g => (g.h === a && g.a === b) || (g.h === b && g.a === a)).h === a ? b : a) : (Math.random() < 0.5 ? a : b);
          games.push({ w, h: home, a: home === a ? b : a, hs: null, as: null });
        }
      }
      if (ok && Object.values(need).every(o => Object.values(o).every(v => v === 0))) return games;
    }
    // 予備：地区戦を保証できない場合でも試合数は揃える
    const ids = TEAMS.map(t => t.id), games = [];
    for (let w = 1; w <= 18; w++) { const p = ids.slice().sort(() => Math.random() - 0.5).filter((id, i) => !(w >= 5 && w <= 12 && i < 4)); for (let i = 0; i + 1 < p.length; i += 2) games.push({ w, h: p[i], a: p[i + 1], hs: null, as: null }); }
    return games;
  },

  // ---------- チーム評価 ----------
  rate(t) {
    const m = arr => arr.reduce((s, k) => s + (t.by[k] ? t.by[k].ovr : 70), 0) / arr.length;
    t.off = Math.round(m(['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE1', 'LT', 'LG', 'C', 'RG', 'RT']) * 0.75 + t.by.QB.ovr * 0.25);
    t.def = Math.round(m(['DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'CB3', 'S1', 'S2']));
    return t;
  },

  // ---------- 1試合シミュレーション ----------
  simGame(car, g, store, neutral) {
    const H = Career.team(car, g.h), A = Career.team(car, g.a);
    const exp = (T, O, home) => Math.max(6, (22 + (T.off - O.def) * 0.6 + (home && !neutral ? 1.3 : 0)) * Math.exp(U.gauss() * 0.16));
    const score = lam => { const td = poisson(lam * 0.105), fg = poisson(lam * 0.055 + 0.25); let pts = td * 7 + fg * 3; for (let i = 0; i < td; i++) if (U.chance(0.05)) pts -= 1; return { td, fg, pts }; };
    let sh = score(exp(H, A, true)), sa = score(exp(A, H, false));
    if (sh.pts === sa.pts && (g.po || U.chance(0.88))) { if (U.chance(0.5 + (H.ovr - A.ovr) * 0.02)) { sh.pts += 3; sh.fg++; } else { sa.pts += 3; sa.fg++; } }
    g.hs = sh.pts; g.as = sa.pts;
    const lines = {};
    this.genLines(car, H, A, sh, lines, g.hs - g.as); this.genLines(car, A, H, sa, lines, g.as - g.hs);
    if (store) this.addLines(car, store, lines);
    return lines;
  },
  pick(items, wf) { return U.weighted(items, wf); },
  genLines(car, T, O, sc, lines, margin) {
    const L = key => lines[key] || (lines[key] = Object.assign(emptyLine(), { _p: null }));
    const kf = p => p.me ? 'ME' : p.key;
    const pl = slot => T.by[slot], op = slot => O.by[slot];
    const add = (p, k, v) => { if (!p || !v) return; const l = L(kf(p)); l._p = p; l[k] += v; };
    const qb = pl('QB'), sk = (p, id) => p && p.skills && p.skills.includes(id);
    const all = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE1', 'LT', 'LG', 'C', 'RG', 'RT', 'K', 'P'];
    const dall = ['DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'CB3', 'S1', 'S2'];
    all.forEach(s => { const p = pl(s); if (p) { const l = L(kf(p)); l._p = p; l.gp = 1; } });
    dall.forEach(s => { const p = op(s); if (p) { const l = L(kf(p)); l._p = p; l.gp = 1; } });
    // パス
    const passTD = Array.from({ length: sc.td }, () => U.chance(0.6)).filter(Boolean).length, rushTD = sc.td - passTD;
    const trailBoost = margin < 0 ? Math.min(60, -margin * 3) : -Math.min(40, margin * 2);
    let py = Math.round(U.clamp(222 + (qb.ovr - 80) * 4 + (T.off - O.def) * 2 + trailBoost + U.gauss() * 55, 50, 520));
    const att = Math.max(12, Math.round(py / U.rnd(6.4, 8.2))), cmp = Math.round(att * U.clamp(0.64 + (qb.a.tha - 82) * 0.004 + (sk(qb, 'deadeye') ? 0.03 : 0) + U.gauss() * 0.05, 0.42, 0.82));
    const ints = poisson(Math.max(0.15, 0.78 + (80 - qb.a.tha) / 40 + (O.def - 80) / 45) * (sk(qb, 'deadeye') ? 0.75 : 1));
    add(qb, 'pa', att); add(qb, 'pc', cmp); add(qb, 'py', py); add(qb, 'ptd', passTD); add(qb, 'pint', ints);
    const rs = ['WR1', 'WR2', 'WR3', 'TE1', 'RB', 'TE2', 'WR4'].map(s => pl(s)).filter(Boolean);
    const base = { WR1: .27, WR2: .2, WR3: .12, TE1: .17, RB: .11, TE2: .05, WR4: .05 };
    const w = p => base[p.slot] * Math.pow(p.ovr / 80, 2) * (sk(p, 'hands') ? 1.12 : 1) * (sk(p, 'route') ? 1.1 : 1);
    const ws = rs.map(w), tw = ws.reduce((a, b) => a + b, 0);
    let yLeft = py; const ylds = rs.map((p, i) => py * ws[i] / tw * U.rnd(0.55, 1.45)); const ys = ylds.reduce((a, b) => a + b, 0);
    rs.forEach((p, i) => { const y = Math.round(ylds[i] / ys * py); add(p, 'rey', y); yLeft -= y; });
    add(rs[0], 'rey', yLeft);
    for (let i = 0; i < cmp; i++) add(this.pick(rs, p => w(p)), 'rec', 1);
    for (let i = 0; i < passTD; i++) add(this.pick(rs, p => w(p) * (p.slot === 'TE1' ? 1.3 : 1) * (sk(p, 'contested') ? 1.2 : 1)), 'retd', 1);
    // ラン
    const ry = Math.round(U.clamp(112 + (T.off - O.def) * 1.5 + (margin > 0 ? Math.min(40, margin * 2) : 0) + U.gauss() * 35, 15, 320));
    const runners = [['RB', .66], ['RB2', .14], ['QB', .11 * Math.pow(qb.a.spd / 75, 3)], ['WR1', .03]].map(([s, v]) => [pl(s), v]).filter(x => x[0]);
    const rt = runners.reduce((a, x) => a + x[1], 0);
    runners.forEach(([p, v]) => { const sh = v / rt * U.rnd(0.7, 1.3); add(p, 'ry', Math.round(ry * sh * (sk(p, 'speedster') ? 1.06 : 1))); add(p, 'ra', Math.max(0, Math.round(ry * sh / U.rnd(3.8, 4.9)))); });
    for (let i = 0; i < rushTD; i++) add(this.pick(runners.map(x => x[0]), p => p.slot === 'RB' ? 0.72 : p.slot === 'QB' ? 0.18 * qb.a.spd / 75 : 0.1), 'rtd', 1);
    // 相手の守備
    const dl = ['DE1', 'DE2', 'DT1', 'DT2'].map(op).filter(Boolean), ol = ['LT', 'LG', 'C', 'RG', 'RT'].map(pl).filter(Boolean);
    const prs = dl.reduce((a, p) => a + p.a.prs, 0) / dl.length, blk = ol.reduce((a, p) => a + p.a.blk * (sk(p, 'anchor') ? 1.06 : 1), 0) / ol.length;
    const sacks = poisson(2.3 * Math.pow(prs / blk, 3));
    const sw = { DE1: .26, DE2: .22, DT1: .14, DT2: .1, LB1: .08, LB2: .07, LB3: .06, CB1: .02, CB2: .02, CB3: .02, S1: .03, S2: .03 };
    const defs = dall.map(op).filter(Boolean);
    for (let i = 0; i < sacks; i++) add(this.pick(defs, p => sw[p.slot] * Math.pow(p.a.prs / 80, 2) * (sk(p, 'passrush') ? 1.45 : 1)), 'sk', 1);
    const iw = { CB1: .2, CB2: .18, CB3: .1, S1: .18, S2: .16, LB1: .08, LB2: .06, LB3: .04 };
    const dbs = defs.filter(p => iw[p.slot]);
    for (let i = 0; i < ints; i++) add(this.pick(dbs, p => iw[p.slot] * Math.pow(p.a.cov / 80, 2) * (sk(p, 'ballhawk') ? 1.5 : 1)), 'int', 1);
    const pds = poisson(4.5); for (let i = 0; i < pds; i++) add(this.pick(dbs, p => iw[p.slot] * Math.pow(p.a.cov / 80, 2) * (sk(p, 'lockdown') ? 1.3 : 1)), 'pd', 1);
    const tkw = { LB1: .15, LB2: .14, LB3: .09, S1: .11, S2: .1, CB1: .07, CB2: .07, CB3: .05, DE1: .055, DE2: .05, DT1: .05, DT2: .045 };
    const tks = Math.round(U.rnd(52, 68));
    for (let i = 0; i < tks; i++) add(this.pick(defs, p => tkw[p.slot] * (p.a.tak / 80) * (sk(p, 'hitstick') || sk(p, 'run_stop') ? 1.15 : 1)), 'tk', 1);
    const ffs = poisson(0.55); for (let i = 0; i < ffs; i++) add(this.pick(defs, p => tkw[p.slot] * (sk(p, 'hitstick') ? 2 : 1)), 'ff', 1);
    // キッカー・パンター
    const K = pl('K'), P = pl('P');
    add(K, 'fgm', sc.fg); add(K, 'fga', sc.fg + poisson(0.25 * (sk(K, 'iceveins') ? 0.6 : 1))); add(K, 'xpa', sc.td); add(K, 'xpm', sc.td - (sc.pts % 7 === 6 ? 1 : 0) * 0);
    const punts = Math.max(0, poisson(4.3 - (T.off - O.def) / 10)); add(P, 'pun', punts); add(P, 'puy', Math.round(punts * U.rnd(42, 50) * (sk(P, 'bigleg') ? 1.04 : 1)));
    // ローテーション（マイプレイヤーや架空ルーキーの出場比率）
    for (const key in lines) {
      const l = lines[key], p = l._p; if (!p || !p.share || p.share >= 1 || !p.orig) continue;
      const o = L(p.orig.key); o._p = p.orig; o.gp = 1;
      STAT_KEYS.forEach(k => { if (k === 'gp') return; const mine = Math.round(l[k] * p.share); o[k] += l[k] - mine; l[k] = mine; });
    }
  },
  // 統計の蓄積（store: car.ls など）
  addLines(car, store, lines) {
    for (const key in lines) {
      const l = lines[key], p = l._p; if (!p) continue;
      const k = p.me ? 'ME' : p.key;
      const s = store[k] || (store[k] = Object.assign(emptyLine(), { n: p.name, t: p.team, pos: posGroup(p.pos), ovr: p.ovr, rk: !!p.rookie, me: !!p.me }));
      STAT_KEYS.forEach(f => s[f] += l[f] || 0);
    }
  },

  // ---------- 順位 ----------
  standings(car) {
    const st = {}; TEAMS.forEach(t => st[t.id] = { id: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, cw: 0, cl: 0 });
    for (const g of car.sched) {
      if (g.hs == null) continue;
      const h = st[g.h], a = st[g.a], sameDiv = divOf(g.h) === divOf(g.a), sameConf = divOf(g.h).c === divOf(g.a).c;
      h.pf += g.hs; h.pa += g.as; a.pf += g.as; a.pa += g.hs;
      if (g.hs === g.as) { h.t++; a.t++; continue; }
      const [W, Lz] = g.hs > g.as ? [h, a] : [a, h]; W.w++; Lz.l++;
      if (sameDiv) { W.dw++; Lz.dl++; } if (sameConf) { W.cw++; Lz.cl++; }
    }
    Object.values(st).forEach(s => { const g = s.w + s.l + s.t; s.pct = g ? (s.w + s.t / 2) / g : 0; });
    return st;
  },
  sortTeams(ids, st) {
    return ids.slice().sort((a, b) => st[b].pct - st[a].pct || (st[b].dw - st[b].dl) - (st[a].dw - st[a].dl) || (st[b].cw - st[b].cl) - (st[a].cw - st[a].cl) || (st[b].pf - st[b].pa) - (st[a].pf - st[a].pa));
  },
  seeds(car, conf) {
    const st = this.standings(car);
    const winners = DIVS.filter(d => d.c === conf).map(d => this.sortTeams(d.teams, st)[0]);
    const div = this.sortTeams(winners, st);
    const rest = this.sortTeams(TEAMS.filter(t => t.conf === conf && !winners.includes(t.id)).map(t => t.id), st).slice(0, 3);
    return [...div, ...rest];
  },
  // ---------- プレーオフ ----------
  ROUND_JP: ['ワイルドカード', 'ディビジョナル', 'カンファレンス・チャンピオンシップ', 'スーパーボウル'],
  startPlayoffs(car) {
    const seeds = { AFC: this.seeds(car, 'AFC'), NFC: this.seeds(car, 'NFC') };
    car.po = { seeds, round: 0, alive: { AFC: seeds.AFC.slice(), NFC: seeds.NFC.slice() }, games: [], champ: null };
    this.makeRound(car);
  },
  makeRound(car) {
    const po = car.po, r = po.round, games = [];
    if (r === 3) {
      const a = po.alive.AFC[0], n = po.alive.NFC[0];
      games.push({ h: U.chance(0.5) ? a : n, a: null, conf: 'SB', po: 1 }); games[0].a = games[0].h === a ? n : a;
    } else for (const c of ['AFC', 'NFC']) {
      const s = po.alive[c], seedOf = id => po.seeds[c].indexOf(id);
      const list = s.slice().sort((x, y) => seedOf(x) - seedOf(y));
      if (r === 0) { [[1, 6], [2, 5], [3, 4]].forEach(([i, j]) => games.push({ h: list[i], a: list[j], conf: c, po: 1 })); }
      else { while (list.length) { const hi = list.shift(), lo = list.pop(); games.push({ h: hi, a: lo, conf: c, po: 1 }); } }
    }
    po.games = games;
  },
  advance(car) {
    const po = car.po;
    for (const g of po.games) { const loser = g.hs > g.as ? g.a : g.h; for (const c of ['AFC', 'NFC']) po.alive[c] = po.alive[c].filter(id => id !== loser); }
    if (po.round === 3) { const g = po.games[0]; po.champ = g.hs > g.as ? g.h : g.a; return true; }
    po.round++; this.makeRound(car); return false;
  },

  // ---------- 評価関数 ----------
  offScore(s) {
    if (s.pos === 'QB') return s.py / 230 + s.ptd * 1.1 - s.pint * 1.4 + s.ry / 45 + s.rtd + (s.pc - 0.63 * s.pa) * 0.1;
    if (s.pos === 'RB') return (s.ry + s.rey) / 95 + (s.rtd + s.retd) * 1.0;
    if (s.pos === 'WR' || s.pos === 'TE') return s.rey / 100 + s.retd * 1.0 + s.rec / 25 + (s.pos === 'TE' ? 1 : 0);
    return 0;
  },
  defScore(s) { return s.sk * 1.6 + s.int * 2.6 + s.tk * 0.09 + s.ff * 1.4 + s.pd * 0.35; },
  posScore(s, st) {
    const W = st && st[s.t] ? st[s.t].w : 8;
    if (['QB', 'RB', 'WR', 'TE'].includes(s.pos)) return this.offScore(s) + W * 0.12;
    if (s.pos === 'OL') return (s.ovr - 60) * 0.5 + W * 0.25 + U.rnd(0, 2);
    if (s.pos === 'K') return s.fgm * 0.35 + (s.fga ? s.fgm / s.fga : 0) * 8;
    if (s.pos === 'P') return (s.pun ? s.puy / s.pun : 40) - 40 + s.ovr * 0.05;
    return this.defScore(s) + W * 0.08;
  },
  // 記者50人の投票（10-5-3-2-1）
  vote(cands, scoreFn, voters = 50) {
    const tally = new Map(); cands.forEach(c => tally.set(c.key, { ...c, pts: 0, first: 0 }));
    const P = [10, 5, 3, 2, 1];
    for (let v = 0; v < voters; v++) {
      const ranked = cands.map(c => ({ c, s: scoreFn(c) * (1 + U.gauss() * 0.09) })).sort((a, b) => b.s - a.s).slice(0, 5);
      ranked.forEach((r, i) => { const t = tally.get(r.c.key); t.pts += P[i]; if (i === 0) t.first++; });
    }
    return [...tally.values()].sort((a, b) => b.pts - a.pts).filter(t => t.pts > 0).slice(0, 5);
  },
  // ---------- シーズン表彰（NFL Honors） ----------
  awards(car) {
    const st = this.standings(car), ls = car.ls;
    const list = Object.entries(ls).map(([key, s]) => ({ key, ...s })).filter(s => s.gp >= 8);
    const W = s => st[s.t] ? st[s.t].w : 8;
    const off = list.filter(s => ['QB', 'RB', 'WR', 'TE'].includes(s.pos)), def = list.filter(s => ['DE', 'DT', 'LB', 'CB', 'S'].includes(s.pos));
    const top = (arr, f, n = 14) => arr.map(s => ({ s, v: f(s) })).sort((a, b) => b.v - a.v).slice(0, n).map(x => x.s);
    const res = [];
    const mvpF = s => this.offScore(s) * (s.pos === 'QB' ? 1 : 0.7) + W(s) * 0.95;
    const opoyF = s => this.offScore(s) * (s.pos === 'QB' ? 0.82 : 1.12) + W(s) * 0.2;
    const dpoyF = s => this.defScore(s) + W(s) * 0.15;
    res.push({ id: 'MVP', how: '攻撃成績 × チーム勝利数（QB重視）', votes: this.vote(top(off, mvpF), mvpF) });
    res.push({ id: 'OPOY', how: '攻撃の個人成績（ヤード・TD）', votes: this.vote(top(off, opoyF), opoyF) });
    res.push({ id: 'DPOY', how: 'サック・INT・タックル・FF・パスディフェンス', votes: this.vote(top(def, dpoyF), dpoyF) });
    const rk = list.filter(s => s.rk || (s.me && car.yearsPro === 1));
    const ro = rk.filter(s => ['QB', 'RB', 'WR', 'TE', 'OL'].includes(s.pos)), rd = rk.filter(s => ['DE', 'DT', 'LB', 'CB', 'S'].includes(s.pos));
    const oroyF = s => s.pos === 'OL' ? (s.ovr - 55) * 0.35 : this.offScore(s) + W(s) * 0.1;
    if (ro.length) res.push({ id: 'OROY', how: '新人のみ・攻撃成績', votes: this.vote(top(ro, oroyF), oroyF) });
    if (rd.length) res.push({ id: 'DROY', how: '新人のみ・守備成績', votes: this.vote(top(rd, dpoyF), dpoyF) });
    // オールプロ
    const slots = [['QB', 1], ['RB', 1], ['WR', 3], ['TE', 1], ['OL', 5], ['DE', 2], ['DT', 2], ['LB', 3], ['CB', 2], ['S', 2], ['K', 1], ['P', 1]];
    const ap = { first: [], second: [] }, pb = { AFC: [], NFC: [] };
    for (const [pos, n] of slots) {
      const r = list.filter(s => s.pos === pos).map(s => ({ s, v: this.posScore(s, st) + s.ovr * 0.04 })).sort((a, b) => b.v - a.v);
      r.slice(0, n).forEach(x => ap.first.push({ pos, ...x.s })); r.slice(n, n * 2).forEach(x => ap.second.push({ pos, ...x.s }));
      for (const c of ['AFC', 'NFC']) {
        const pn = { QB: 3, RB: 3, WR: 4, TE: 2, OL: 7, DE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1, P: 1 }[pos];
        r.filter(x => TEAM_BY_ID[x.s.t] && TEAM_BY_ID[x.s.t].conf === c).map(x => ({ x, v: x.v + x.s.ovr * 0.08 })).sort((a, b) => b.v - a.v).slice(0, pn).forEach(y => pb[c].push({ pos, ...y.x.s }));
      }
    }
    // リーダー（タイトル）
    const leaders = [['py', 'パス獲得ヤード王'], ['ptd', 'パスTD王'], ['ry', 'ラッシングヤード王'], ['rey', 'レシービングヤード王'], ['rec', 'レセプション王'], ['sk', 'サック王'], ['int', 'インターセプト王'], ['tk', 'タックル王']]
      .map(([k, n]) => { const s = list.slice().sort((a, b) => b[k] - a[k])[0]; return { k, n, s }; });
    return { res, ap, pb, leaders, st };
  },
  // ---------- 殿堂入り ----------
  legacy(car) {
    let pts = 0; const cnt = {};
    (car.awards || []).forEach(a => { cnt[a.id] = (cnt[a.id] || 0) + 1; pts += (AWARDS[a.id] || { pts: 0 }).pts; });
    const c = Career.careerTotals(car), pos = car.p.pos, seasons = car.history.length;
    let st = 0;
    if (pos === 'QB') st = c.py / 1500 + c.ptd / 10 + c.ry / 1000 - c.pint / 25;
    else if (pos === 'RB') st = (c.ry + c.rey) / 400 + (c.rtd + c.retd) / 3;
    else if (pos === 'WR' || pos === 'TE') st = c.rey / 350 + c.retd / 3 + c.rec / 60 + (pos === 'TE' ? 8 : 0);
    else if (pos === 'DE' || pos === 'DT') st = c.sk / 3.5 + c.tk / 150 + c.ff / 3 + (pos === 'DT' ? 8 : 0);
    else if (pos === 'LB') st = c.tk / 40 + c.sk / 4 + c.int / 2 + c.ff / 3;
    else if (pos === 'CB' || pos === 'S') st = c.int / 1.2 + c.pd / 12 + c.tk / 100;
    else if (pos === 'K') st = c.fgm / 12;
    else if (pos === 'P') st = c.pun / 40;
    else st = Math.max(0, (car.peakOvr || 70) - 78) * 2.5 + seasons * 3;
    const score = Math.round(pts + st + seasons * 1.4 + Math.max(0, (car.peakOvr || 70) - 85) * 1.2);
    const prob = U.clamp(1 / (1 + Math.exp(-(score - 110) / 12)), 0.002, 0.99);
    return { score, prob, cnt };
  },
  // 引退5年後から投票（最大20回）
  hofVote(car) {
    const { score } = this.legacy(car), years = [];
    let elected = false;
    if (score < 40) return { elected, score, years: [{ year: car.retiredYear + 5, pct: 0, stage: '候補者リスト入りならず' }] };
    for (let i = 0; i < 20 && !elected; i++) {
      const stage = score < 70 ? '候補者' : score < 90 ? '準決勝候補（Semifinalist）' : '最終候補（Finalist）';
      let pct = U.clamp(15 + (score - 60) * 1.0 + i * 1.8 + U.gauss() * 5, 1, 99);
      if (score < 70) pct = Math.min(pct, 30 + i);
      elected = pct >= 80 && score >= 90;
      years.push({ year: car.retiredYear + 5 + i, pct: Math.round(pct), stage: elected ? '殿堂入り' : stage });
    }
    return { elected, years, score };
  },
  // ---------- 架空ルーキー（新人賞の競争相手） ----------
  makeRookies(car) {
    const plan = [['QB', 'QB'], ['RB', 'RB'], ['RB', 'RB'], ['WR', 'WR2'], ['WR', 'WR3'], ['WR', 'WR2'], ['TE', 'TE1'], ['DE', 'DE2'], ['DE', 'DE1'], ['DT', 'DT2'], ['LB', 'LB3'], ['LB', 'LB2'], ['CB', 'CB2'], ['CB', 'CB3'], ['S', 'S2']];
    car.rookies = plan.map(([pos, slot], i) => {
      let t; do { t = U.pick(TEAMS).id; } while (t === car.team && slot === car.slot);
      const ovr = U.rint(68, 84), base = TEAM_BY_ID[t].by[slot];
      return { key: 'R' + car.year + ':' + i, num: U.rint(2, 99), name: U.pick(FIRST_NAMES) + ' ' + U.pick(LAST_NAMES), pos, slot, team: t, ovr, rookie: true,
        share: U.clamp(0.6 + (ovr - base.ovr) * 0.05, 0.45, 1), a: makeAttrs(pos, ovr, 0, true), college: U.pick(COLLEGES) };
    });
  },
};
