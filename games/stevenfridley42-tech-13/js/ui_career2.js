'use strict';
// ===== キャリアモード画面（2）: 育成 / 成績 / 順位 / 表彰式 / オフシーズン / 殿堂 =====
const CUI2 = {
  page(title, ...kids) {
    UI.show(U.el('div', { class: 'screen', style: 'justify-content:flex-start' }, U.el('button', { class: 'btn small back', onclick: () => CUI.hub() }, '← ハブへ'), U.el('h2', null, title), ...kids));
    UI.keyOff = Input.onKey(c => { if (c === 'Escape') CUI.hub(); });
  },
  table(head, rows, meIdx) {
    return U.el('table', { class: 'tbl' }, U.el('tr', null, head.map(h => U.el('th', null, h))), rows.map((r, i) => U.el('tr', { class: r._me ? 'me' : '' }, r.map(c => U.el('td', null, c)))));
  },
  // ---------- 育成 ----------
  upgrade() {
    const car = Career.car, P = car.p;
    const render = () => {
      const a = Career.attrs(P), o = Career.ovr(P, a);
      const box = U.el('div', { class: 'cgrid' });
      const L = U.el('div', { class: 'cpanel' }, U.el('div', { class: 'pts' }, 'スキルポイント: ', U.el('b', null, P.sp), `　Lv.${P.lv}　OVR ${o}`));
      POS_ATTRS[P.pos].forEach(k => {
        const v = a[k], c = Career.upCost(v);
        L.append(U.el('div', { class: 'uprow' }, U.el('span', { class: 'al' }, ATTR_JP[k]), CUI.bar('', v), U.el('span', { class: 'muted' }, `${c}SP`),
          U.el('button', { class: 'btn small', disabled: P.sp < c || v >= 99 ? '' : null, onclick: () => { P.sp -= c; P.gain[k] = (P.gain[k] || 0) + 1; SFX.click(); Career.save(); render(); } }, '+1')));
      });
      L.append(U.el('div', { class: 'muted', style: 'font-size:12px;margin-top:6px' }, '高い能力ほど必要SPが増えます。SPはレベルアップ・受賞で獲得。週ごとの練習や若手時代の成長でも能力が伸びます。'));
      const R = U.el('div', { class: 'cpanel' }, U.el('h3', null, '特殊スキル（試合中に効果あり）'));
      SKILLS.filter(s => !s.pos || s.pos.includes(P.pos)).forEach(s => {
        const has = P.skills.includes(s.id), lock = P.lv < s.lv;
        R.append(U.el('div', { class: 'skill' + (has ? ' sel' : '') }, U.el('b', null, s.n), U.el('small', null, s.d),
          has ? U.el('span', { class: 'chip' }, '習得済み') : U.el('button', { class: 'btn small', disabled: lock || P.sp < s.cost ? '' : null, onclick: () => { P.sp -= s.cost; P.skills.push(s.id); SFX.select(); Career.save(); render(); } }, lock ? `Lv.${s.lv}で解放` : `${s.cost}SPで習得`)));
      });
      box.append(L, R);
      this.page('育成・スキル', box);
    };
    render();
  },
  // ---------- スタッツ ----------
  stats() {
    const car = Career.car, pos = car.p.pos;
    const cols = pos === 'QB' ? [['pc', '成功'], ['pa', '試投'], ['py', 'ヤード'], ['ptd', 'TD'], ['pint', 'INT'], ['ry', 'ラン']] : pos === 'RB' ? [['ra', 'ラン回'], ['ry', 'ランyd'], ['rtd', 'ランTD'], ['rec', '捕球'], ['rey', '捕球yd'], ['retd', '捕球TD']]
      : pos === 'WR' || pos === 'TE' ? [['rec', '捕球'], ['rey', 'ヤード'], ['retd', 'TD']] : pos === 'K' ? [['fgm', 'FG成功'], ['fga', 'FG試投'], ['xpm', 'PAT']] : pos === 'P' ? [['pun', 'パント'], ['puy', 'ヤード']] : pos === 'OL' ? [['gp', '出場']] : [['tk', 'タックル'], ['sk', 'サック'], ['int', 'INT'], ['pd', 'PD'], ['ff', 'FF']];
    const rows = car.history.map(h => [h.y, h.t, h.age, h.ovr, h.rec, h.line.gp || 0, ...cols.map(([k]) => h.line[k] || 0), h.aw.join(', ')]);
    if (car.ls && car.ls.ME && car.phase !== 'off') rows.push(Object.assign([car.year + '（今季）', car.team, car.p.age, Career.ovr(car.p), '-', car.ls.ME.gp, ...cols.map(([k]) => car.ls.ME[k] || 0), ''], { _me: 1 }));
    const tot = Career.careerTotals(car);
    rows.push(Object.assign(['通算', '', '', '', '', tot.gp, ...cols.map(([k]) => tot[k]), ''], { _me: 1 }));
    const games = (car.games || []).filter(g => g.y === car.year).map(g => [g.po != null ? League.ROUND_JP[g.po] : 'W' + g.w, (g.home ? 'vs ' : '@ ') + g.opp, `${g.my}-${g.op}`, Career.lineText(g.line, pos)]);
    this.page('スタッツ', U.el('div', { class: 'box' }, U.el('h3', null, 'キャリア成績'), this.table(['年', 'チーム', '年齢', 'OVR', '成績', '試合', ...cols.map(c => c[1]), '受賞'], rows)),
      U.el('div', { class: 'box', style: 'margin-top:12px' }, U.el('h3', null, `${car.year}年 試合ログ`), this.table(['週', '相手', 'スコア', '成績'], games.reverse())));
  },
  leaders() {
    const car = Career.car, ls = car.ls || {};
    const cats = [['py', 'パスヤード'], ['ptd', 'パスTD'], ['ry', 'ランヤード'], ['rey', 'レシーブヤード'], ['rec', 'レセプション'], ['sk', 'サック'], ['int', 'インターセプト'], ['tk', 'タックル'], ['fgm', 'FG成功']];
    const grid = U.el('div', { class: 'leadgrid' });
    cats.forEach(([k, n]) => {
      const top = Object.entries(ls).map(([key, s]) => ({ key, ...s })).sort((a, b) => b[k] - a[k]).slice(0, 10);
      grid.append(U.el('div', { class: 'box' }, U.el('h3', null, n), this.table(['#', '選手', 'TM', n], top.map((s, i) => Object.assign([i + 1, s.n + (s.rk ? ' (R)' : ''), s.t, s[k]], { _me: s.key === 'ME' })))));
    });
    this.page(`${car.year}年 リーグリーダー`, grid);
  },
  standings() {
    const car = Career.car, st = League.standings(car), grid = U.el('div', { class: 'leadgrid' });
    DIVS.forEach(d => grid.append(U.el('div', { class: 'box' }, U.el('h3', null, `${d.c} ${d.d}`),
      this.table(['チーム', '勝', '敗', '分', '得点', '失点'], League.sortTeams(d.teams, st).map(id => Object.assign([`${TEAM_BY_ID[id].city} ${TEAM_BY_ID[id].name}`, st[id].w, st[id].l, st[id].t, st[id].pf, st[id].pa], { _me: id === car.team }))))));
    this.page(`${car.year}年 順位表`, grid);
  },
  schedule() {
    const car = Career.car;
    const rows = [];
    for (let w = 1; w <= 18; w++) {
      const g = car.sched.find(x => x.w === w && (x.h === car.team || x.a === car.team));
      if (!g) { rows.push([w, 'BYE', '', '']); continue; }
      const home = g.h === car.team, opp = home ? g.a : g.h, my = home ? g.hs : g.as, op = home ? g.as : g.hs;
      rows.push(Object.assign([w, (home ? 'vs ' : '@ ') + TEAM_BY_ID[opp].city + ' ' + TEAM_BY_ID[opp].name, g.hs == null ? '' : `${my}-${op}`, g.hs == null ? (w === car.week ? '次の試合' : '') : my > op ? '勝' : my < op ? '敗' : '分'], { _me: w === car.week }));
    }
    this.page(`${car.year}年 日程`, U.el('div', { class: 'box', style: 'width:min(700px,100%)' }, this.table(['週', '対戦', 'スコア', '結果'], rows)));
  },
  trophies() {
    const car = Career.car, lg = League.legacy(car);
    const groups = {};
    car.awards.forEach(a => { const n = a.n || AWARDS[a.id].n; (groups[n] || (groups[n] = [])).push(a.y); });
    const order = Object.keys(groups).sort((a, b) => (b.includes('殿堂') - a.includes('殿堂')) || groups[b].length - groups[a].length);
    const cards = order.map(n => U.el('div', { class: 'trophy' }, U.el('div', { class: 'ti' }, n.includes('殿堂') ? '🏛️' : n.includes('MVP') ? '🏆' : n.includes('スーパーボウル') ? '💍' : n.includes('オールプロ') ? '⭐' : n.includes('週間') ? '🏅' : '🎖️'),
      U.el('b', null, n), U.el('div', { class: 'muted' }, `${groups[n].length}回（${groups[n].slice(0, 8).join(', ')}${groups[n].length > 8 ? '…' : ''}）`)));
    this.page('トロフィールーム',
      U.el('div', { class: 'box', style: 'width:min(900px,100%)' }, U.el('h3', null, 'レガシー'), U.el('div', { class: 'xpb big' }, U.el('div', { style: `width:${Math.round(lg.prob * 100)}%;background:linear-gradient(90deg,#c9a227,#ffe08a)` })),
        U.el('div', { class: 'muted' }, `レガシースコア ${lg.score}（受賞・通算成績・在籍年数から算出）／ 殿堂入り確率 ${Math.round(lg.prob * 100)}%　・通算年俸 ${car.earnings || 0}M$`)),
      U.el('div', { class: 'trophies' }, cards.length ? cards : U.el('div', { class: 'muted' }, 'まだ受賞はありません。活躍して賞を勝ち取ろう！')));
  },
  // ---------- NFL Honors（表彰式・審査結果） ----------
  honors() {
    const car = Career.car, H = Career.honors(car);
    let i = 0;
    const show = () => {
      const scr = U.el('div', { class: 'screen overlay', style: 'justify-content:flex-start' });
      scr.append(U.el('h2', null, `${car.year}年 NFL Honors`));
      if (i < H.res.length) {
        const r = H.res[i], win = r.votes[0];
        scr.append(U.el('div', { class: 'box', style: 'width:min(760px,100%)' },
          U.el('div', { class: 'awn' }, AWARDS[r.id].n), U.el('div', { class: 'muted' }, `審査: AP記者50名の投票（1位10点・2位5点・3位3点・4位2点・5位1点）／ 評価基準: ${r.how}`),
          this.table(['順位', '最終候補', 'TM', 'POS', 'シーズン成績', '得票点', '1位票'], r.votes.map((v, j) => Object.assign([j + 1, v.n, v.t, v.pos, U.el('small', null, v.ln || ''), v.pts, v.first], { _me: v.me }))),
          win ? U.el('div', { class: 'winner' + (win.me ? ' mine' : '') }, `受賞: ${win.n}（${win.t}）`) : ''));
        if (win && win.me) { SFX.cheer(true); SFX.horn(); }
        scr.append(U.el('button', { class: 'btn primary', onclick: () => { i++; show(); } }, '次の賞へ →'));
      } else {
        const conf = TEAM_BY_ID[car.team].conf, li = l => this.table(['POS', '選手', 'TM'], l.map(s => Object.assign([s.pos, s.n, s.t], { _me: s.me })));
        scr.append(U.el('div', { class: 'cols', style: 'width:min(1000px,100%)' },
          U.el('div', { class: 'box' }, U.el('h3', null, 'AP オールプロ 1stチーム'), li(H.ap1)), U.el('div', { class: 'box' }, U.el('h3', null, 'AP オールプロ 2ndチーム'), li(H.ap2)),
          U.el('div', { class: 'box' }, U.el('h3', null, `プロボウル（${conf}）`), li(H.pb[conf])),
          U.el('div', { class: 'box' }, U.el('h3', null, 'タイトル（リーグリーダー）'), this.table(['部門', '選手', 'TM', '記録'], H.leaders.map(l => Object.assign([l.n, l.who, l.t, l.v], { _me: l.me })))),
          U.el('div', { class: 'box' }, U.el('h3', null, 'スーパーボウル'), U.el('div', null, `優勝: ${H.champ ? TEAM_BY_ID[H.champ].city + ' ' + TEAM_BY_ID[H.champ].name : '-'}`), U.el('div', null, `SB MVP: ${H.sbmvp ? H.sbmvp.name + '（' + H.sbmvp.team + '）' : '-'}`))));
        scr.append(U.el('div', { class: 'box', style: 'width:min(1000px,100%);margin-top:12px' }, U.el('h3', null, 'あなたの受賞'),
          H.mine.length ? U.el('div', { class: 'skl' }, H.mine.map(m => U.el('span', { class: 'chip gold' }, m.n || AWARDS[m.id].n))) : U.el('div', { class: 'muted' }, '今季の受賞はありませんでした。来季こそ！')));
        scr.append(U.el('button', { class: 'btn primary', style: 'margin-top:14px', onclick: () => { Career.endSeason(car); CUI.hub(); } }, 'オフシーズンへ →'));
      }
      UI.show(scr);
    };
    show();
  },
  // ---------- オフシーズン ----------
  offseasonCard(C, car) {
    const off = car.offseason || {};
    C.append(U.el('h3', null, 'オフシーズン'));
    const ch = Object.entries(off.changes || {}).filter(([, v]) => v);
    C.append(U.el('div', null, `年齢 ${car.p.age}歳・OVR ${off.ovrBefore} → `, U.el('b', null, off.ovrAfter)),
      U.el('div', { class: 'muted', style: 'margin:4px 0 10px' }, ch.length ? ch.map(([k, v]) => `${ATTR_JP[k]} ${v > 0 ? '+' : ''}${v}`).join('、') : '能力の変化なし'));
    if (Career.forcedRetire(car)) {
      C.append(U.el('div', { class: 'award' }, '体力の衰え・オファーなし。現役引退の時が来ました。'), U.el('button', { class: 'btn primary', onclick: () => { Career.retire(car); CUI2.hof(); } }, '引退会見へ'));
      return;
    }
    if (off.offers && !off.signed) {
      C.append(U.el('div', { class: 'big2' }, '契約満了 — フリーエージェント'), U.el('div', { class: 'muted' }, '契約オファーを選んでください'));
      off.offers.forEach(o => { const t = TEAM_BY_ID[o.team]; C.append(U.el('button', { class: 'btn', style: 'margin-top:6px', onclick: () => { Career.sign(car, o); off.signed = true; Career.save(); CUI.hub(`${t.name} と契約しました`); } },
        UI.logo(t), U.el('div', null, `${t.city} ${t.name}`, U.el('small', null, `${o.years}年・年俸 ${o.salary}M$ ${o.note}`)))); });
      if (!off.offers.length) C.append(U.el('div', { class: 'muted' }, 'オファーがありません。'));
    } else {
      C.append(U.el('div', { class: 'muted' }, `契約: 残り${car.contract.left}年・年俸 ${car.contract.salary}M$`));
      const role = Career.role(car);
      if (role.share < 1 && !off.traded) C.append(U.el('button', { class: 'btn', style: 'margin-top:8px', onclick: () => {
        const o = Career.ovr(car.p), cands = TEAMS.filter(t => t.id !== car.team && Career.slotCands(car.p).some(s => t.by[s].ovr <= o));
        if (!cands.length || U.chance(0.35)) { off.traded = true; Career.save(); return CUI.hub('トレード要求は受け入れられませんでした'); }
        const t = U.pick(cands); car.team = t.id; off.traded = true; Career.news(car, `トレードで ${t.city} ${t.name} へ移籍！`); Career.save(); CUI.hub(`${t.name} へトレード成立！`);
      } }, 'トレードを要求する（先発の座を求めて）'));
      C.append(U.el('button', { class: 'btn primary', style: 'margin-top:10px', onclick: () => { Career.nextSeason(car); CUI.hub(); } }, `${car.year + 1}年シーズンへ →`));
    }
    C.append(U.el('button', { class: 'btn small', style: 'margin-top:14px', onclick: () => { if (confirm('現役を引退しますか？（元に戻せません）')) { Career.retire(car); CUI2.hof(); } } }, '現役引退する'));
  },
  // ---------- 殿堂入り ----------
  hof() {
    const car = Career.car, H = car.hof, lg = League.legacy(car), tot = Career.careerTotals(car);
    const scr = U.el('div', { class: 'screen overlay', style: 'justify-content:flex-start' });
    scr.append(U.el('h2', null, 'プロフットボール殿堂 — 投票'),
      U.el('div', { class: 'box', style: 'width:min(760px,100%)' }, U.el('h3', null, `${car.p.first} ${car.p.last}（${car.p.pos}）キャリア総括`),
        U.el('div', null, `${car.history.length}シーズン・通算 ${Career.lineText(tot, car.p.pos)}`),
        U.el('div', { class: 'skl', style: 'margin-top:6px' }, Object.entries(lg.cnt).filter(([k]) => k !== 'POW' && k !== 'HOF').map(([k, v]) => U.el('span', { class: 'chip gold' }, `${AWARDS[k].short} ×${v}`))),
        U.el('div', { class: 'muted', style: 'margin-top:6px' }, `審査: 引退から5年後に資格。選考委員の投票で80%以上の得票が必要（準決勝候補→最終候補→殿堂入り）。レガシースコア ${H.score}`)));
    const tb = U.el('div', { class: 'box', style: 'width:min(760px,100%);margin-top:12px' }, U.el('h3', null, '年ごとの投票結果'));
    const list = U.el('div'); tb.append(list); scr.append(tb);
    const result = U.el('div', { style: 'margin-top:14px;text-align:center' }); scr.append(result);
    UI.show(scr);
    let i = 0;
    const tick = () => {
      if (i >= H.years.length) {
        result.append(H.elected ? U.el('div', { class: 'winner mine', style: 'font-size:28px' }, '🏛️ 殿堂入り！ ゴールドジャケットが授与されました') : U.el('div', { class: 'winner' }, '殿堂入りはなりませんでした'),
          U.el('button', { class: 'btn primary', style: 'margin-top:12px', onclick: () => CUI.hub() }, 'ハブへ'), U.el('button', { class: 'btn', style: 'margin-top:8px', onclick: () => { App.career = false; UI.title(); } }, 'タイトルへ'));
        if (H.elected) { SFX.horn(); SFX.cheer(true); }
        return;
      }
      const y = H.years[i++];
      list.append(U.el('div', { class: 'uprow' }, U.el('span', { class: 'al' }, `${y.year}年`), U.el('div', { class: 'at', style: 'flex:1' }, U.el('div', { style: `width:${y.pct}%;background:${y.pct >= 80 ? '#3ddc84' : '#ffc629'}` })), U.el('b', null, y.pct + '%'), U.el('span', { class: 'muted' }, y.stage)));
      setTimeout(tick, i < 4 ? 600 : 180);
    };
    tick();
  },
};
