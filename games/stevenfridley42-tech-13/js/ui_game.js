'use strict';
// ===== 試合中のUI: プレーコール / スコアボード / ポーズ / 結果 =====
const PlayCall = {
  node: null, seq: -1, st: null, keyOff: null,
  hide() { if (this.node) { this.node.remove(); this.node = null; } if (this.keyOff) { this.keyOff(); this.keyOff = null; } },
  role(gv, side) { const c = gv.ctx; if (!c) return null; if (c.type === 'kickoff') return side === c.kicker ? 'kick' : 'ret'; return side === gv.poss ? 'off' : 'def'; },
  isCaller(ctrl, role) { return ctrl.kind === 'team' || (role === 'off' && ctrl.key && ctrl.key.endsWith(':QB')); },
  groups(gv, role) {
    const t = gv.ctx.type;
    if (t === 'kickoff') return role === 'kick' ? [{ n: 'キックオフ', plays: KICK_PLAYS }] : null;
    if (t === 'try') return role === 'off' ? [{ n: 'トライ（TD後）', plays: TRY_PLAYS }] : [{ n: 'ゴールライン', plays: [PLAY_BY_ID.dg_man, PLAY_BY_ID.dg_blz, PLAY_BY_ID.fg_blk] }];
    if (role === 'off') return OFF_GROUPS.map(g => ({ n: g.n, plays: OFF_PLAYS.filter(p => g.forms.includes(p.f) && !(p.t === 'spike' && g.id !== 'sp')) }));
    return DEF_GROUPS.map(g => ({ n: g.n, plays: DEF_PLAYS.filter(p => g.forms.includes(p.f)) }));
  },
  // 毎フレーム呼ばれる
  update(gv, ctrl, act) {
    const side = ctrl.side;
    if (!gv || gv.ph !== 'call') { this.hide(); return; }
    const role = this.role(gv, side);
    if (!this.isCaller(ctrl, role)) { this.hide(); return; }
    if (gv.ctx.type === 'kickoff' && role === 'ret') { if (!gv.calls[side] && this.seq !== gv.cs) { this.seq = gv.cs; act.call('kr_norm', {}); } this.hide(); return; }
    if (this.seq !== gv.cs || !this.node) { this.seq = gv.cs; this.build(gv, ctrl, role, act); }
    const st = this.st;
    if (gv.calls[side] && !st.done) { st.done = true; this.renderBody(); }
    const pc = this.node.querySelector('.pc-clock'); pc.textContent = Math.max(0, Math.ceil(gv.pc)); pc.classList.toggle('warn', gv.pc < 10);
  },
  build(gv, ctrl, role, act) {
    this.hide();
    const groups = this.groups(gv, role); if (!groups) return;
    const sugg = gv.sugg && gv.sugg[ctrl.side];
    let gi = 0, idx = 0;
    groups.forEach((g, i) => { const j = g.plays.findIndex(p => p && p.id === sugg); if (j >= 0) { gi = i; idx = j; } });
    this.st = { gv, ctrl, role, act, groups, gi, idx, flip: false, hurry: false, done: !!gv.calls[ctrl.side], sugg };
    this.node = U.el('div', { id: 'playcall' }); document.getElementById('ui').append(this.node);
    this.node.style.pointerEvents = 'auto';
    this.renderBody();
    this.keyOff = Input.onKey(c => this.key(c));
  },
  sit(gv) {
    const t = App.teams(), off = gv.poss;
    if (gv.ctx.type === 'kickoff') return `${t[gv.ctx.kicker].name} のキックオフ`;
    if (gv.ctx.type === 'try') return `${t[off].name} のトライ（PAT / 2ポイント）`;
    const goal = gv.bo + gv.tg >= 100;
    return `${U.ord(gv.down)} & ${goal ? 'Goal' : Math.max(1, Math.round(gv.tg))}　${U.spotText(gv.bo, t[off].id, t[1 - off].id)}　${U.qName(gv.q)} ${U.fmtClock(gv.clk)}　TO 残り ${gv.to[this.st.ctrl.side]}`;
  },
  renderBody() {
    const s = this.st, n = this.node; n.innerHTML = '';
    const title = { off: 'オフェンス プレーコール', def: 'ディフェンス プレーコール', kick: 'キックオフ', ret: 'リターン' }[s.role];
    n.append(U.el('div', { class: 'pc-head' }, U.el('div', { class: 'pc-title' }, title), U.el('div', { class: 'pc-sit' }, this.sit(s.gv)), U.el('div', { class: 'pc-clock' }, '40')));
    if (s.done) { n.append(U.el('div', { class: 'pc-wait' }, '相手のプレー選択を待っています…')); return; }
    const tabs = U.el('div', { class: 'tabs', style: 'justify-content:flex-start;margin-bottom:8px' });
    s.groups.forEach((g, i) => tabs.append(U.el('div', { class: 'tab' + (i === s.gi ? ' sel' : ''), onclick: () => { s.gi = i; s.idx = 0; this.renderBody(); } }, g.n)));
    n.append(tabs);
    const cards = U.el('div', { class: 'pc-cards' });
    s.groups[s.gi].plays.forEach((p, i) => {
      if (!p) return;
      const cv = U.el('canvas', { width: 356, height: 184 });
      const card = U.el('div', { class: 'pcc' + (i === s.idx ? ' sel' : ''), onclick: () => { s.idx = i; this.submit(); }, onmouseenter: () => { s.idx = i; cards.querySelectorAll('.pcc').forEach((c, j) => c.classList.toggle('sel', j === i)); } },
        cv, U.el('div', { class: 'nm' }, p.n), U.el('div', { class: 'ty' }, playType(p)), p.id === s.sugg ? U.el('div', { class: 'rec' }, 'コーチ推奨') : null);
      cards.append(card); this.diagram(cv, p, s.role, s.flip);
    });
    n.append(cards);
    const keys = ['←→↑↓ 選択', 'Q/E フォーメーション', 'Enter 決定'];
    if (s.role === 'off' && s.gv.ctx.type === 'scrim') keys.push(`F 反転${s.flip ? '（ON）' : ''}`, `H ノーハドル${s.hurry ? '（ON）' : ''}`);
    if (s.gv.ctx.type === 'scrim') keys.push('T タイムアウト');
    n.append(U.el('div', { class: 'pc-keys' }, keys.map(k => U.el('span', null, k))));
  },
  key(c) {
    const s = this.st; if (!s || s.done) return;
    const plays = s.groups[s.gi].plays, cols = Math.max(1, Math.floor((this.node.clientWidth - 36) / 168));
    const mv = d => { s.idx = U.clamp(s.idx + d, 0, plays.length - 1); this.renderBody(); SFX.click(); };
    if (c === 'ArrowRight' || c === 'KeyD') mv(1);
    else if (c === 'ArrowLeft' || c === 'KeyA') mv(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') mv(cols);
    else if (c === 'ArrowUp' || c === 'KeyW') mv(-cols);
    else if (c === 'KeyE' || c === 'PageDown') { s.gi = (s.gi + 1) % s.groups.length; s.idx = 0; this.renderBody(); SFX.click(); }
    else if (c === 'KeyQ' || c === 'PageUp') { s.gi = (s.gi + s.groups.length - 1) % s.groups.length; s.idx = 0; this.renderBody(); SFX.click(); }
    else if (c === 'Enter' || c === 'Space') this.submit();
    else if (c === 'KeyF' && s.role === 'off') { s.flip = !s.flip; this.renderBody(); }
    else if (c === 'KeyH' && s.role === 'off') { s.hurry = !s.hurry; this.renderBody(); }
    else if (c === 'KeyT') s.act.timeout();
  },
  submit() {
    const s = this.st, p = s.groups[s.gi].plays[s.idx]; if (!p || s.done) return;
    s.act.call(p.id, { flip: s.flip, hurry: s.hurry }); s.done = true; this.renderBody();
  },
  // プレー図
  diagram(cv, p, role, flip) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, k = 6.2, cx = W / 2, los = H * 0.62;
    ctx.fillStyle = '#1f5d2b'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (let y = los % (k * 5); y < H; y += k * 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,150,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, los); ctx.lineTo(W, los); ctx.stroke();
    const m = flip ? -1 : 1;
    const X = l => cx - l * k * m, Y = ox => los - ox * k;
    const arrow = (pts, col, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.setLineDash(dash ? [5, 4] : []);
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.setLineDash([]);
      const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1], a = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8 * Math.cos(a - 0.4), y2 - 8 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 8 * Math.cos(a + 0.4), y2 - 8 * Math.sin(a + 0.4)); ctx.fill();
    };
    if (p.t === 'kickoff' || p.t === 'onside' || p.t === 'kr') {
      ctx.fillStyle = '#fff'; ctx.font = '700 22px Oswald'; ctx.textAlign = 'center'; ctx.fillText(p.t === 'onside' ? 'ONSIDE' : 'KICKOFF', cx, H / 2);
      arrow([[cx, H - 20], [cx + (p.t === 'onside' ? 30 : 0), p.t === 'onside' ? H * 0.55 : 18]], '#ffd400'); return;
    }
    if (p.cov || p.t === 'fgb') {
      // ディフェンス
      const form = DEF_FORMS[p.f] || DEF_FORMS.goalline, blitz = new Set(p.blitz || []);
      const zoneCol = { deep: 'rgba(80,150,255,.45)', under: 'rgba(255,214,0,.4)' };
      // オフェンスのシルエット
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      [[0, 0], [1.35, 0], [-1.35, 0], [2.7, 0], [-2.7, 0], [18, 0], [-18, 0], [10, -1]].forEach(([l, o]) => { ctx.beginPath(); ctx.arc(X(l), Y(o - 0.8), 4, 0, 7); ctx.fill(); });
      for (const slot in form.s) {
        let pos = form.s[slot], l, d;
        if (pos === 'W+') { l = 18; d = p.press ? 1.5 : 6; } else if (pos === 'W-') { l = -18; d = p.press ? 1.5 : 6; } else if (pos === 'SL') { l = slot === 'CB4' ? -10 : 10; d = 5; } else [d, l] = pos;
        const x = X(l), y = Y(d);
        if (/^D[ET]/.test(slot) || blitz.has(slot) || p.t === 'fgb') arrow([[x, y], [X(l * 0.4), Y(-3)]], '#ff4d4d');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
      }
      const deep = { c2: [[11, 19], [-11, 19]], c3: [[16, 17], [0, 19], [-16, 17]], c4: [[18, 16], [6, 17], [-6, 17], [-18, 16]], c1: [[0, 17]], c2m: [[11, 18], [-11, 18]] }[p.cov] || [];
      deep.forEach(([l, d]) => { ctx.fillStyle = zoneCol.deep; ctx.beginPath(); ctx.ellipse(X(l), Y(d + (p.deep ? 4 : 0)), 26, 9, 0, 0, 7); ctx.fill(); });
      if (['c2', 'c3', 'c4'].includes(p.cov)) [[13, 6], [5, 9], [-5, 9], [-13, 6]].forEach(([l, d]) => { ctx.fillStyle = zoneCol.under; ctx.beginPath(); ctx.ellipse(X(l), Y(d), 18, 6, 0, 0, 7); ctx.fill(); });
      if (['c0', 'c1', 'c2m', 'gl'].includes(p.cov)) { ctx.fillStyle = '#fff'; ctx.font = '700 15px Oswald'; ctx.textAlign = 'left'; ctx.fillText('MAN', 8, 20); }
      return;
    }
    const form = OFF_FORMS[p.f]; if (!form) return;
    // ブロック
    for (const slot in form.s) {
      const [ox, l] = form.s[slot], x = X(l), y = Y(ox);
      const rt = p.r && p.r[slot];
      const run = p.run && RUNS[p.run], carrier = (p.c || 'RB') === slot && (p.t === 'run' || p.t === 'kneel');
      if (rt && rt !== 'block' && ROUTES[rt]) {
        const ins = l > 0.3 ? -1 : l < -0.3 ? 1 : -1;
        const pts = [[x, y], ...ROUTES[rt].pts.map(([dx, din]) => [X(l + din * ins), Y(ox + dx)])];
        arrow(pts, ROUTES[rt].screen ? '#7fdcff' : '#ffd400');
      } else if (carrier && run) {
        arrow([[x, y], ...run.path.map(([o2, l2]) => [X(l2), Y(o2)])], '#ff5b4f');
      } else if (p.t !== 'kneel' && p.t !== 'spike' && slot !== 'QB' && slot !== 'K' && slot !== 'P') {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 7); ctx.moveTo(x - 4, y - 7); ctx.lineTo(x + 4, y - 7); ctx.stroke();
      }
      if (p.t === 'pa' && slot === 'RB' && run) arrow([[x, y], [X(run.path[0][1]), Y(run.path[0][0])]], 'rgba(255,91,79,.6)', true);
      ctx.fillStyle = slot === 'QB' ? '#ffd400' : '#fff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
    }
    if (p.t === 'punt' || p.t === 'fg') { ctx.fillStyle = '#fff'; ctx.font = '700 18px Oswald'; ctx.textAlign = 'center'; ctx.fillText(p.t === 'punt' ? 'PUNT' : p.pat ? 'PAT' : 'FIELD GOAL', cx, 24); }
  },
};

// ===== スコアボード =====
const HUD = {
  root: null, bTimer: 0,
  init() { this.root = document.getElementById('hud'); },
  show(v) { this.root.classList.toggle('hidden', !v); },
  update(gv, local) {
    if (!gv) return;
    const t = App.teams();
    const setTeam = (id, i) => {
      const n = document.getElementById(id), tm = t[i];
      n.style.background = `linear-gradient(90deg, ${tm.c1}, ${tm.c1}cc)`;
      n.querySelector('.sb-abbr').textContent = tm.id; n.querySelector('.sb-score').textContent = gv.sc[i];
      n.querySelector('.sb-to').textContent = '▮'.repeat(Math.max(0, gv.to[i]));
      n.classList.toggle('poss', gv.poss === i && gv.ph !== 'intro' && gv.ph !== 'final');
    };
    setTeam('sb-away', 1); setTeam('sb-home', 0);
    document.getElementById('sb-qtr').textContent = U.qName(gv.q);
    document.getElementById('sb-time').textContent = U.fmtClock(gv.clk);
    document.getElementById('sb-pc').textContent = (gv.ph === 'call' || gv.ph === 'pre') && gv.ctx && gv.ctx.type === 'scrim' ? Math.max(0, Math.ceil(gv.pc)) : '';
    let dd = '';
    if (gv.ctx) {
      if (gv.ctx.type === 'kickoff') dd = 'KICKOFF';
      else if (gv.ctx.type === 'try') dd = 'PAT / 2PT';
      else dd = `${U.ord(gv.down)} & ${gv.bo + gv.tg >= 100 ? 'Goal' : Math.max(1, Math.round(gv.tg))}`;
    }
    if (gv.ph === 'final') dd = 'FINAL';
    document.getElementById('sb-down').textContent = dd;
    const tk = document.getElementById('ticker'); if (tk.textContent !== gv.tick) tk.textContent = gv.tick || '';
    document.getElementById('hint').textContent = this.hint(gv, local);
    // プレー結果カード
    const pc = document.getElementById('playcard');
    if (gv.ph === 'post' && gv.card && gv.pt > 0.5) {
      if (pc.classList.contains('hidden') || pc.dataset.k !== gv.card.d) {
        pc.dataset.k = gv.card.d; pc.classList.remove('hidden');
        pc.querySelector('.pc-t').textContent = gv.card.t || '';
        pc.querySelector('.pc-t').style.display = gv.card.t ? '' : 'none';
        pc.querySelector('.pc-d').textContent = gv.card.d || '';
        pc.querySelector('.pc-n').textContent = gv.card.n || '';
      }
      pc.querySelector('.pc-k').style.visibility = gv.pt > 0.9 && !App.online() ? 'visible' : 'hidden';
    } else pc.classList.add('hidden');
  },
  hint(gv, local) {
    const sv = gv.sim; if (!sv) return '';
    const me = sv.p.find(p => local.has(p[6]));
    if (sv.meter && local.has(sv.meter.who) && sv.meter.ph !== 'done') return 'キックメーター: W/Sで方向 → Spaceを3回';
    if (gv.ph === 'pre') {
      if (!sv.rd) return 'ハドルを解いてセット中…';
      if (gv.humanSnap && App.localCtrl() && App.localCtrl().side === gv.poss && sv.k === 'scrim') return 'Space: スナップ　T: タイムアウト　(QB) 頭上の番号キーでパス';
      if (sv.k === 'scrim' && App.localCtrl() && App.localCtrl().side !== gv.poss) return 'Tab: 操作する選手を切替（黄色い輪）';
      if (App.localCtrl() && App.localCtrl().kind === 'player') return me ? (sv.routes && sv.routes.length ? '点線が自分のルート。C: ボールを要求' : 'スナップを待っています') : 'Enter長押し: 早送り（あなたの選手はこのプレーに出場していません）';
      return '';
    }
    if (gv.ph !== 'live' || !me) return App.localCtrl() && App.localCtrl().kind === 'player' && gv.ph === 'live' ? 'Enter長押し: 早送り' : '';
    const b = sv.b, carrying = b[3] === 'held' && U.dist(me[0], me[1], b[0], b[1]) < 0.6;
    const qbHold = carrying && me[10] === 'QB' && sv.p.some(p => p[11]);
    if (qbHold) return '1〜5: タップでパス／長押し+W/Sで狙う　マウス: 狙ってクリック　Q/E・ホイール: 高さ　R: 投げ捨て';
    if (carrying) return 'J: ジューク　K: スピン　L: トラック　Space: ダイブ　Shift: ダッシュ';
    if (b[3] === 'air' && me[2] !== sv.off) return 'K: ジャンプしてパスカット　J: ダイブ';
    if (b[3] === 'air') return 'K: 競り合ってキャッチ';
    if (me[2] !== sv.off || (sv.k !== 'scrim')) return 'Tab/クリック: 選手切替（青い輪）　J: ダイブタックル　K: パスカット　Shift: ダッシュ';
    return 'Shift: ダッシュ　（キーを離すとAIが動かします）';
  },
  banner(text, sub, dur) {
    const b = document.getElementById('banner');
    b.innerHTML = ''; b.append(text, sub ? U.el('small', null, sub) : '');
    b.classList.add('show'); clearTimeout(this.bTimer); this.bTimer = setTimeout(() => b.classList.remove('show'), (dur || 2) * 1000);
  },
};

// ===== ポーズ・結果 =====
const GameMenus = {
  pause(onResume, onQuit, canTimeout, onTimeout) {
    const btns = [
      U.el('button', { class: 'btn', onclick: onResume }, '試合に戻る'),
      canTimeout ? U.el('button', { class: 'btn', onclick: onTimeout }, 'タイムアウトを取る') : null,
      U.el('button', { class: 'btn', onclick: () => UI.controls(() => GameMenus.pause(onResume, onQuit, canTimeout, onTimeout), true) }, '操作方法'),
      U.el('button', { class: 'btn', onclick: onQuit }, App.careerG ? '試合を中断（結果はシミュレート）' : '試合をやめてタイトルへ'),
    ].filter(Boolean);
    UI.show(U.el('div', { class: 'screen overlay' }, U.el('h2', null, 'PAUSE'), U.el('div', { class: 'menu' }, btns)));
    UI.navMenu(btns, onResume);
  },
  result(gv, stats, log, onAgain, onTitle) {
    const t = App.teams(), w = gv.winner;
    const leaders = (team) => {
      const arr = Object.values(stats).filter(s => s.team === team);
      const rows = [];
      const pas = arr.filter(s => s.pa).sort((a, b) => b.py - a.py)[0]; if (pas) rows.push(['パス', `${pas.name}`, `${pas.pc}/${pas.pa}  ${pas.py}yd  TD${pas.ptd}  INT${pas.pint}`]);
      arr.filter(s => s.ra).sort((a, b) => b.ry - a.ry).slice(0, 2).forEach(s => rows.push(['ラン', s.name, `${s.ra}回 ${s.ry}yd TD${s.rtd}`]));
      arr.filter(s => s.rec).sort((a, b) => b.rey - a.rey).slice(0, 3).forEach(s => rows.push(['レシーブ', s.name, `${s.rec}回 ${s.rey}yd TD${s.retd}`]));
      arr.filter(s => s.tk || s.sk || s.int).sort((a, b) => (b.tk + b.sk * 2 + b.int * 3) - (a.tk + a.sk * 2 + a.int * 3)).slice(0, 3).forEach(s => rows.push(['守備', s.name, `タックル${s.tk} サック${s.sk} INT${s.int}`]));
      arr.filter(s => s.fga || s.xpa).forEach(s => rows.push(['キック', s.name, `FG ${s.fgm}/${s.fga}  PAT ${s.xpm}/${s.xpa}`]));
      return U.el('div', { class: 'box' }, U.el('h3', { style: 'margin-top:0;color:#fff' }, `${t[team].city} ${t[team].name}`),
        U.el('table', null, U.el('tr', null, U.el('th', null, ''), U.el('th', null, '選手'), U.el('th', null, '成績')), rows.map(r => U.el('tr', null, r.map(x => U.el('td', null, x))))));
    };
    const tcol = i => U.el('div', { class: 't' }, UI.logo(t[i]), t[i].name);
    const btns = [U.el('button', { class: 'btn primary', onclick: onAgain }, 'もう一度プレー'), U.el('button', { class: 'btn', onclick: onTitle }, 'タイトルへ')];
    UI.show(U.el('div', { class: 'screen overlay', style: 'justify-content:flex-start' },
      U.el('h2', null, 'FINAL'), U.el('div', { class: 'final' }, tcol(1), U.el('div', null, `${gv.sc[1]} - ${gv.sc[0]}`), tcol(0)),
      U.el('div', { class: 'status', style: 'font-size:16px;margin-bottom:14px;color:#fff' }, w < 0 ? '引き分け' : `${t[w].city} ${t[w].name} の勝利！`),
      U.el('div', { class: 'cols', style: 'width:min(1000px,100%)' }, leaders(1), leaders(0)),
      U.el('div', { class: 'row', style: 'margin-top:18px' }, btns)));
  },
};
