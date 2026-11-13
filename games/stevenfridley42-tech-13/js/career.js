'use strict';
// ===== キャリアモード本体 =====
const Career = {
  car: null, NSLOT: 3,
  get KEY() { return Account.prefix() + '_career_'; },
  // ---------- セーブ / ロード ----------
  summary(slot) { try { const c = JSON.parse(localStorage.getItem(this.KEY + slot)); return c ? { name: c.p.first + ' ' + c.p.last, pos: c.p.pos, team: c.team, year: c.year, ovr: this.ovr(c.p), phase: c.phase } : null; } catch (e) { return null; } },
  load(slot) { try { this.car = JSON.parse(localStorage.getItem(this.KEY + slot)); return this.car; } catch (e) { return null; } },
  save() { try { localStorage.setItem(this.KEY + this.car.slot, JSON.stringify(this.car)); } catch (e) { console.warn('save failed', e); } },
  remove(slot) { try { localStorage.removeItem(this.KEY + slot); } catch (e) {} },

  // ---------- 能力値 ----------
  engPos(p) { return p.pos === 'OL' ? p.olSlot : p.pos; },
  baseAttrs(spec) {
    const a = makeAttrs(this.engPos(spec), 58, 0, true);
    const arch = (ARCH[spec.pos] || [])[spec.arch || 0];
    if (arch) for (const k in arch[1]) a[k] += arch[1][k];
    // 体格の影響
    const [hr, wr] = BODY[spec.pos], dh = (spec.h - hr[1]) / 10, dw = (spec.w - wr[1]) / 10, dwing = (spec.wing - spec.h - 4) / 10;
    const d = { spd: -dw * 2.4 - dh * 0.6, acc: -dw * 2.0, agi: -dw * 1.2 - dh * 1.6, str: dw * 3.6 + dh * 0.8, blk: dw * 2 + dwing * 2, tak: dw * 1 + dwing * 2,
      cat: dh * 1.6 + dwing * 2, cov: dwing * 1.5 + dh * 0.4, prs: dwing * 1.6 + dw * 1.2, thp: dh * 0.8, awr: 0 };
    for (const k in d) if (a[k] != null) a[k] += d[k];
    for (const k in a) a[k] = Math.round(U.clamp(a[k], 25, 95));
    return a;
  },
  attrs(spec) { const a = this.baseAttrs(spec); for (const k in spec.alloc || {}) a[k] = Math.min(99, a[k] + spec.alloc[k]); for (const k in spec.gain || {}) a[k] = U.clamp(a[k] + spec.gain[k], 25, 99); return a; },
  _cal: {},
  ovr(p, a) {
    a = a || this.attrs(p); const g = p.pos, W = OVR_W[g];
    const raw = x => Object.entries(W).reduce((s, [k, w]) => s + (x[k] || 50) * w, 0);
    if (!this._cal[g + p.olSlot]) { const e = this.engPos(p); this._cal[g + p.olSlot] = [raw(makeAttrs(e, 60, 0, true)), raw(makeAttrs(e, 80, 0, true))]; }
    const [r60, r80] = this._cal[g + p.olSlot];
    return Math.round(U.clamp(60 + (raw(a) - r60) * 20 / (r80 - r60), 35, 99));
  },
  upCost(v) { return 1 + Math.floor(Math.max(0, v - 65) / 10); },
  xpNeed(lv) { return 500 + lv * 130; },

  // ---------- 新規キャリア ----------
  create(slot, spec) {
    const car = { v: 1, slot, p: Object.assign({ age: 22, xp: 0, lv: 1, sp: 0, skills: spec.skills || [], gain: {}, tr: {} }, spec),
      year: CAREER_START_YEAR, yearsPro: 1, phase: 'draft', team: null, history: [], awards: [], news: [], earnings: 0, peakOvr: 0 };
    this.car = car; return car;
  },
  combine(car) {
    const a = this.attrs(car.p), b = car.p;
    return [['40ヤード走', (4.22 + (99 - a.spd) * 0.0125 + (b.w - 90) * 0.0012).toFixed(2) + ' 秒'],
      ['ベンチプレス（225lb）', Math.round(8 + (a.str - 40) * 0.42) + ' 回'],
      ['垂直跳び', (28 + (a.agi - 60) * 0.25 + (a.acc - 60) * 0.12).toFixed(1) + ' インチ'],
      ['3コーンドリル', (7.5 - (a.agi - 60) * 0.018).toFixed(2) + ' 秒'],
      ['ワンダーリック', Math.round(14 + (a.awr - 40) * 0.45) + ' 点']];
  },
  draft(car, fav) {
    const o = this.ovr(car.p);
    let round = o >= 74 ? 1 : o >= 71 ? 2 : o >= 68 ? 3 : o >= 65 ? 4 : o >= 62 ? 5 : o >= 59 ? 6 : o >= 56 ? 7 : 8;
    round = U.clamp(round + (U.chance(0.25) ? -1 : U.chance(0.25) ? 1 : 0), 1, 8);
    const order = TEAMS.slice().sort((a, b) => a.ovr - b.ovr + U.rnd(-3, 3));
    const pick = U.rint(1, 32);
    let team = order[pick - 1].id;
    if (fav && U.chance(0.3)) team = fav;
    const overall = round <= 7 ? (round - 1) * 32 + pick : null;
    car.team = team; car.draft = { round, pick, overall, team, year: car.year };
    const sal = round === 1 ? 10 - pick * 0.22 : round === 2 ? 2.2 : round <= 4 ? 1.3 : 1.0;
    car.contract = { years: round === 1 ? 5 : 4, left: round === 1 ? 5 : 4, salary: Math.round(sal * 10) / 10 };
    return car.draft;
  },
  // ---------- チームに自分を組み込む ----------
  slotCands(p) { return { QB: ['QB'], RB: ['RB'], WR: ['WR1', 'WR2', 'WR3'], TE: ['TE1'], OL: [p.olSlot], DE: ['DE1', 'DE2'], DT: ['DT1', 'DT2'], LB: ['LB1', 'LB2', 'LB3'], CB: ['CB1', 'CB2', 'CB3'], S: ['S1', 'S2'], K: ['K'], P: ['P'] }[p.pos]; },
  role(car) {
    const t = TEAM_BY_ID[car.team], o = this.ovr(car.p);
    const c = this.slotCands(car.p).slice().sort((a, b) => t.by[b].ovr - t.by[a].ovr);
    const slot = c.find(s => t.by[s].ovr <= o) || c[c.length - 1];
    const d = o - t.by[slot].ovr;
    let [share, label] = d >= 0 ? [1, 'スターター'] : d >= -5 ? [0.6, 'ローテーション'] : d >= -10 ? [0.35, '控え（パッケージ起用）'] : [0.15, '控え'];
    if (['QB', 'K', 'P', 'OL'].includes(car.p.pos) && d < 0) { share = car.p.pos === 'QB' ? 0.04 : 0.1; label = '控え'; }
    return { slot, share, label, rival: t.by[slot] };
  },
  me(car, forEngine) {
    const p = car.p, r = this.role(car), a = this.attrs(p);
    return { key: car.team + ':' + r.slot, team: car.team, slot: r.slot, pos: this.engPos(p), num: p.num, name: p.first + ' ' + p.last, ovr: this.ovr(p, a), a,
      body: { h: p.h, w: p.w, wing: p.wing }, skills: p.skills.slice(), look: p.look, me: true, share: forEngine ? 1 : r.share, orig: r.rival };
  },
  team(car, id, forEngine) {
    const base = TEAM_BY_ID[id];
    const swaps = {};
    (car.rookies || []).forEach(r => { if (r.team === id) swaps[r.slot] = Object.assign({}, r, { orig: base.by[r.slot] }); });
    if (id === car.team) { const m = this.me(car, forEngine); swaps[m.slot] = m; }
    if (!Object.keys(swaps).length) return base;
    const t = Object.assign({}, base, { players: base.players.map(p => swaps[p.slot] || p), by: Object.assign({}, base.by, swaps) });
    League.rate(t); t.ovr = Math.round(t.off * 0.5 + t.def * 0.5);
    return t;
  },

  // ---------- シーズン ----------
  startSeason(car) {
    car.sched = League.schedule(); car.week = 1; car.phase = 'reg'; car.ls = {}; car.ps = {}; car.po = null; car.honors = null; car.weekly = [];
    League.makeRookies(car);
    this.news(car, `${car.year}年シーズン開幕！ ${TEAM_BY_ID[car.team].city} ${TEAM_BY_ID[car.team].name} での${car.yearsPro}年目`);
  },
  myGame(car) {
    if (car.phase === 'reg') return car.sched.find(g => g.w === car.week && (g.h === car.team || g.a === car.team)) || null;
    if (car.phase === 'po' && car.po) return car.po.games.find(g => g.h === car.team || g.a === car.team) || null;
    return null;
  },
  news(car, s) { car.news.unshift({ y: car.year, w: car.phase === 'reg' ? car.week : null, s }); car.news = car.news.slice(0, 40); },
  // 自分の試合以外を進める
  simOthers(car, list, store) { for (const g of list) if (g.hs == null) League.simGame(car, g, store, g.conf === 'SB'); },
  // 自分の試合をシミュレート
  simMine(car) {
    const g = this.myGame(car); if (!g || g.hs != null) return null;
    const store = car.phase === 'po' ? car.ps : car.ls;
    const lines = League.simGame(car, g, store, g.conf === 'SB');
    if (g.conf === 'SB') car.sbLines = lines;
    const mine = Object.values(lines).find(l => l._p && l._p.me) || emptyLine();
    return this.afterMyGame(car, g, mine, lines);
  },
  // 実際にプレーした試合の結果を取り込む
  importPlayed(car, game, g) {
    const homeSide = game.teams[0].id === g.h ? 0 : 1;
    g.hs = game.score[homeSide]; g.as = game.score[1 - homeSide];
    const f = U.clamp(15 / game.settings.qlen, 1, 3);
    const sr = v => { const x = v * f; return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0); };
    const lines = {};
    game.teams.forEach(t => ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE1', 'LT', 'LG', 'C', 'RG', 'RT', 'DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'CB3', 'S1', 'S2', 'K', 'P']
      .forEach(s => { const p = t.by[s]; if (p) lines[p.key] = Object.assign(emptyLine(), { _p: p, gp: 1 }); }));
    for (const key in game.stats) {
      const s = game.stats[key], t = game.teams[s.team], p = t.players.find(x => x.key === key) || t.by[key.split(':')[1]];
      if (!p) continue;
      const l = lines[key] || (lines[key] = Object.assign(emptyLine(), { _p: p, gp: 1 }));
      STAT_KEYS.forEach(k => { if (k !== 'gp' && s[k]) l[k] += sr(s[k]); });
    }
    League.addLines(car, car.phase === 'po' ? car.ps : car.ls, lines);
    if (g.conf === 'SB') car.sbLines = lines;
    const mine = Object.values(lines).find(l => l._p && l._p.me) || emptyLine();
    return this.afterMyGame(car, g, mine, lines, true);
  },
  forfeit(car) {
    const g = this.myGame(car); if (!g) return null;
    const home = g.h === car.team; g.hs = home ? 0 : 2; g.as = home ? 2 : 0;
    // 相手チームの選手には出場記録だけ残さない（没収試合）
    const res = this.afterMyGame(car, g, emptyLine(), {}, false, true);
    this.news(car, '棄権により0-2の不戦敗'); return res;
  },
  afterMyGame(car, g, line, lines, played, noxp) {
    const home = g.h === car.team, my = home ? g.hs : g.as, op = home ? g.as : g.hs, win = my > op, opp = home ? g.a : g.h;
    const P = car.p, pos = P.pos;
    let xp = 120 + (win ? 60 : 0) + (played ? 60 : 0);
    xp += line.py / 5 + line.ptd * 40 - line.pint * 30 + (line.ry + line.rey) / 2 + (line.rtd + line.retd) * 50 + line.rec * 6;
    xp += line.tk * 10 + line.sk * 60 + line.int * 80 + line.ff * 50 + line.pd * 20 + line.fgm * 30 + line.xpm * 5 + line.puy / 12;
    if (pos === 'OL') xp += win ? 120 : 60;
    if (car.phase === 'po') xp *= 1.5;
    xp = noxp ? 0 : Math.round(xp);
    const lv0 = P.lv; this.gainXP(car, xp);
    const res = { g, my, op, win, opp, line, xp, lvUp: P.lv - lv0, played, pow: null, po: car.phase === 'po', lines };
    car.lastGame = { w: g.w, opp, my, op, win, home, po: car.phase === 'po' ? League.ROUND_JP[car.po.round] : null };
    (car.games || (car.games = [])).push({ y: car.year, w: g.w || 0, po: res.po ? car.po.round : null, opp, home, my, op, line: this.strip(line) });
    this.news(car, `${res.po ? League.ROUND_JP[car.po.round] : 'Week ' + g.w}: ${win ? '勝利' : my === op ? '引き分け' : '敗戦'} ${my}-${op} vs ${opp}　${this.lineText(line, pos)}`);
    return res;
  },
  strip(l) { const o = {}; STAT_KEYS.forEach(k => { if (l[k]) o[k] = l[k]; }); return o; },
  gainXP(car, xp) {
    const P = car.p; P.xp += xp;
    while (P.xp >= this.xpNeed(P.lv)) { P.xp -= this.xpNeed(P.lv); P.lv++; P.sp += 6; this.news(car, `レベルアップ！ Lv.${P.lv}（スキルポイント +6）`); }
  },
  // 週の残り試合と週間MVP
  finishWeek(car) {
    const games = car.sched.filter(g => g.w === car.week);
    const wl = {}; // 今週分の成績
    for (const g of games) if (g.hs == null) { const l = League.simGame(car, g, car.ls); Object.assign(wl, l); }
    // 週間MVP（自分の成績が所属カンファレンス最高なら受賞）
    const mg = car.lastGame && car.lastGame.w === car.week ? car.games[car.games.length - 1] : null;
    let pow = null;
    if (mg) {
      const conf = TEAM_BY_ID[car.team].conf, mine = Object.assign(emptyLine(), mg.line, { pos: car.p.pos });
      const isOff = ['QB', 'RB', 'WR', 'TE'].includes(car.p.pos), isDef = ['DE', 'DT', 'LB', 'CB', 'S'].includes(car.p.pos);
      const sf = s => isOff ? League.offScore(s) : isDef ? League.defScore(s) : (s.fgm || 0) * 0.8;
      const my = sf(mine);
      const rivals = Object.values(wl).filter(l => l._p && !l._p.me && TEAM_BY_ID[l._p.team] && TEAM_BY_ID[l._p.team].conf === conf)
        .map(l => sf(Object.assign({}, l, { pos: posGroup(l._p.pos) })));
      const best = Math.max(0, ...rivals) * U.rnd(0.85, 1.05);
      if ((isOff || isDef || car.p.pos === 'K') && my > best && my > (isOff ? 3 : 2.5)) {
        const kind = isOff ? '攻撃' : isDef ? '守備' : 'スペシャルチーム';
        pow = `${conf} 週間最優秀${kind}選手（Week ${car.week}）`;
        car.awards.push({ id: 'POW', y: car.year, n: pow }); this.news(car, '🏅 ' + pow + ' に選出！'); car.p.sp += AWARDS.POW.sp;
      }
    }
    car.week++;
    if (car.week > 18) { car.phase = 'po'; League.startPlayoffs(car); const inPO = this.inPlayoffs(car); this.news(car, inPO ? `プレーオフ進出！ 第${car.po.seeds[TEAM_BY_ID[car.team].conf].indexOf(car.team) + 1}シード` : 'プレーオフ進出ならず…'); }
    return pow;
  },
  inPlayoffs(car) { const c = TEAM_BY_ID[car.team].conf; return car.po && car.po.alive[c].includes(car.team); },
  // プレーオフ1ラウンド進行
  finishRound(car) {
    for (const g of car.po.games) if (g.hs == null) { const l = League.simGame(car, g, car.ps, g.conf === 'SB'); if (g.conf === 'SB') car.sbLines = l; }
    const r = car.po.round, my = car.po.games.find(g => g.h === car.team || g.a === car.team);
    const done = League.advance(car);
    if (my) { const won = (my.h === car.team ? my.hs > my.as : my.as > my.hs); this.news(car, `${League.ROUND_JP[r]} ${won ? '勝利！' : '敗退…'}`); }
    if (done) { car.phase = 'honors'; this.news(car, `スーパーボウル優勝: ${TEAM_BY_ID[car.po.champ].city} ${TEAM_BY_ID[car.po.champ].name}`); }
    return done;
  },
  // ---------- NFL Honors（表彰） ----------
  honors(car) {
    if (car.honors) return car.honors;
    const A = League.awards(car), mine = [];
    const give = (id, extra) => { car.awards.push(Object.assign({ id, y: car.year }, extra || {})); car.p.sp += (AWARDS[id] || {}).sp || 0; mine.push(Object.assign({ id }, extra || {})); };
    A.res.forEach(r => { if (r.votes[0] && r.votes[0].key === 'ME') give(r.id); });
    if (A.ap.first.some(s => s.key === 'ME')) give('AP1'); else if (A.ap.second.some(s => s.key === 'ME')) give('AP2');
    if (A.pb.AFC.concat(A.pb.NFC).some(s => s.key === 'ME')) give('PB');
    A.leaders.forEach(l => { if (l.s && l.s.key === 'ME' && l.s[l.k] > 0) give('LEAD', { n: l.n }); });
    // スーパーボウル
    let sbmvp = null;
    if (car.po && car.po.champ) {
      if (car.po.champ === car.team) give('SB');
      const lines = car.sbLines || {};
      const cands = Object.values(lines).filter(l => l._p && l._p.team === car.po.champ);
      const sc = l => { const s = Object.assign({}, l, { pos: posGroup(l._p.pos) }); return Math.max(League.offScore(s) * (s.pos === 'QB' ? 1.15 : 1), League.defScore(s) * 1.3); };
      cands.sort((a, b) => sc(b) - sc(a));
      if (cands[0]) { sbmvp = { name: cands[0]._p.name, team: cands[0]._p.team, me: !!cands[0]._p.me }; if (sbmvp.me) give('SBMVP'); }
    }
    car.honors = { res: A.res.map(r => ({ id: r.id, how: r.how, votes: r.votes.map(v => ({ key: v.key, n: v.n, t: v.t, pos: v.pos, pts: v.pts, first: v.first, me: v.key === 'ME', ln: this.lineText(v, v.pos) + (v.pos === 'QB' || v.pos === 'RB' ? '' : '') })) })),
      ap1: A.ap.first.map(s => ({ pos: s.pos, n: s.n, t: s.t, me: s.key === 'ME' })), ap2: A.ap.second.map(s => ({ pos: s.pos, n: s.n, t: s.t, me: s.key === 'ME' })),
      pb: { AFC: A.pb.AFC.map(s => ({ pos: s.pos, n: s.n, t: s.t, me: s.key === 'ME' })), NFC: A.pb.NFC.map(s => ({ pos: s.pos, n: s.n, t: s.t, me: s.key === 'ME' })) },
      leaders: A.leaders.map(l => ({ n: l.n, k: l.k, v: l.s ? l.s[l.k] : 0, who: l.s ? l.s.n : '-', t: l.s ? l.s.t : '', me: l.s && l.s.key === 'ME' })),
      sbmvp, champ: car.po && car.po.champ, mine };
    car.sbLines = null;
    mine.forEach(m => this.news(car, `🏆 ${m.n || AWARDS[m.id].n} を受賞！`));
    this.save();
    return car.honors;
  },
  // ---------- オフシーズン ----------
  endSeason(car) {
    const st = League.standings(car), rec = st[car.team];
    const ovr = this.ovr(car.p);
    car.peakOvr = Math.max(car.peakOvr || 0, ovr);
    car.history.push({ y: car.year, t: car.team, age: car.p.age, ovr, rec: `${rec.w}-${rec.l}${rec.t ? '-' + rec.t : ''}`, line: this.strip(car.ls.ME || emptyLine()),
      aw: car.awards.filter(a => a.y === car.year && a.id !== 'POW').map(a => a.n || AWARDS[a.id].short) });
    car.earnings = Math.round(((car.earnings || 0) + car.contract.salary) * 10) / 10;
    // 加齢と成長・衰え
    const P = car.p; P.age++;
    const keys = POS_ATTRS[P.pos], ch = {};
    const kick = P.pos === 'K' || P.pos === 'P';
    const bump = (k, v) => { P.gain[k] = (P.gain[k] || 0) + v; ch[k] = (ch[k] || 0) + v; };
    if (P.age <= 25) keys.forEach(k => { if (U.chance(0.5)) bump(k, U.rint(1, 3)); });
    else if (P.age <= 29) keys.forEach(k => { if (U.chance(0.25)) bump(k, U.rint(-1, 1)); });
    else if (P.age <= (kick ? 36 : 32)) { ['spd', 'acc', 'agi'].forEach(k => bump(k, -U.rint(1, 2))); if (kick) bump('kpw', -U.rint(0, 1)); }
    else { ['spd', 'acc', 'agi', 'str'].forEach(k => bump(k, -U.rint(2, 4))); keys.forEach(k => { if (U.chance(0.4)) bump(k, -U.rint(1, 2)); }); if (kick) { bump('kpw', -U.rint(1, 3)); } }
    car.contract.left--;
    car.offseason = { changes: ch, ovrBefore: ovr, ovrAfter: this.ovr(P), offers: car.contract.left <= 0 ? this.offers(car) : null };
    car.phase = 'off';
    this.save();
  },
  offers(car) {
    const o = this.ovr(car.p), age = car.p.age, list = [];
    const sal = Math.max(1, Math.round((Math.pow(Math.max(0, o - 60), 2) * 0.045 + (car.p.pos === 'QB' ? (o - 60) * 0.9 : 0)) * (age > 31 ? 0.75 : 1) * 10) / 10);
    const yrs = age >= 33 ? 1 : age >= 30 ? U.rint(1, 3) : U.rint(3, 5);
    if (o >= 58) list.push({ team: car.team, salary: sal, years: yrs, note: '現所属チーム' });
    const others = TEAMS.filter(t => t.id !== car.team).sort(() => Math.random() - 0.5).slice(0, o >= 75 ? 4 : o >= 62 ? 3 : 1);
    others.forEach(t => list.push({ team: t.id, salary: Math.round(sal * U.rnd(0.9, 1.25) * 10) / 10, years: U.clamp(yrs + U.rint(-1, 1), 1, 5), note: t.ovr >= 82 ? '優勝候補' : t.ovr <= 76 ? '再建中' : '' }));
    return list;
  },
  sign(car, off) { car.team = off.team; car.contract = { years: off.years, left: off.years, salary: off.salary }; this.news(car, `${TEAM_BY_ID[off.team].name} と${off.years}年 総額${(off.salary * off.years).toFixed(1)}M$で契約`); },
  nextSeason(car) { car.year++; car.yearsPro++; car.offseason = null; this.startSeason(car); this.save(); },
  forcedRetire(car) { const o = this.ovr(car.p); return car.p.age >= ((car.p.pos === 'K' || car.p.pos === 'P') ? 44 : 40) || (o < 56 && car.p.age > 28); },
  retire(car) {
    car.phase = 'retired'; car.retiredYear = car.year;
    car.hof = League.hofVote(car);
    if (car.hof.elected) car.awards.push({ id: 'HOF', y: car.hof.years[car.hof.years.length - 1].year });
    this.save();
  },
  careerTotals(car) {
    const t = emptyLine(); (car.history || []).forEach(h => STAT_KEYS.forEach(k => t[k] += h.line[k] || 0));
    if (car.phase !== 'retired' && car.ls && car.ls.ME) STAT_KEYS.forEach(k => t[k] += car.ls.ME[k] || 0);
    return t;
  },
  lineText(l, pos) {
    l = l || {}; const v = k => l[k] || 0;
    if (pos === 'QB') return `${v('pc')}/${v('pa')} ${v('py')}yd ${v('ptd')}TD ${v('pint')}INT` + (v('ry') ? ` / ラン${v('ry')}yd` : '');
    if (pos === 'RB') return `ラン${v('ra')}回${v('ry')}yd ${v('rtd')}TD / 捕球${v('rec')} ${v('rey')}yd`;
    if (pos === 'WR' || pos === 'TE') return `${v('rec')}捕球 ${v('rey')}yd ${v('retd')}TD`;
    if (pos === 'K') return `FG ${v('fgm')}/${v('fga')} PAT ${v('xpm')}/${v('xpa')}`;
    if (pos === 'P') return `パント${v('pun')}回 平均${v('pun') ? (v('puy') / v('pun')).toFixed(1) : 0}yd`;
    if (pos === 'OL') return `出場${v('gp')}試合`;
    return `タックル${v('tk')} サック${v('sk')} INT${v('int')} PD${v('pd')} FF${v('ff')}`;
  },
  // 週ごとの練習
  DRILLS: [['スピード', ['spd', 'acc']], ['パワー', ['str', 'blk']], ['テクニック', null], ['フィルム研究', ['awr']]],
  train(car, i) {
    const P = car.p;
    const list = (this.DRILLS[i][1] || Object.keys(OVR_W[P.pos]).slice(0, 2)).filter(k => POS_ATTRS[P.pos].includes(k));
    const k = list.length ? U.pick(list) : U.pick(POS_ATTRS[P.pos]);
    P.tr[k] = (P.tr[k] || 0) + 0.34;
    let msg = `${ATTR_JP[k]}の練習 +XP50`;
    if (P.tr[k] >= 1) { P.tr[k] -= 1; P.gain[k] = (P.gain[k] || 0) + 1; msg += `（${ATTR_JP[k]} +1！）`; }
    this.gainXP(car, 50); car.trainedWeek = car.year * 100 + (car.week || 0) + (car.phase === 'po' ? 50 + car.po.round : 0);
    return msg;
  },
};
