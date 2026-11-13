'use strict';
// ===== キャリアモード画面（1）: スロット / 作成 / ドラフト / ハブ / 試合後 =====
const cmToFt = cm => { const inch = Math.round(cm / 2.54); return `${Math.floor(inch / 12)}'${inch % 12}"`; };
const kgToLb = kg => Math.round(kg * 2.2046) + 'lb';
const CUI = {
  // ---------- 選手の立ち絵 ----------
  portrait(cv, p, teamId) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, t = TEAM_BY_ID[teamId] || { c1: '#3a4a6a', c2: '#cfd8e8', hel: '#2a3550' };
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, W * 0.7); g.addColorStop(0, t.c1 + '66'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const [hr, wr] = BODY[p.pos], hs = 0.82 + (p.h - hr[0]) / (hr[2] - hr[0] + 1) * 0.3, ws = 0.8 + (p.w - wr[0]) / (wr[2] - wr[0] + 1) * 0.45;
    const L = p.look || {}, skin = L.skin || '#b07a52', col = t.c1, trim = t.c2, sleeve = L.sleeve === 'team' ? trim : L.sleeve || skin;
    const cx = W / 2, base = H - 18, bodyH = H * 0.62 * hs, sw = W * 0.26 * ws, arm = (p.wing - p.h) / 40;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, base, sw * 1.1, 10, 0, 0, 7); ctx.fill();
    const hip = base - bodyH * 0.45, sh = base - bodyH * 0.92;
    // 脚
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(cx - sw * 0.42, hip, sw * 0.36, bodyH * 0.3); ctx.fillRect(cx + sw * 0.06, hip, sw * 0.36, bodyH * 0.3);
    ctx.fillStyle = col; ctx.fillRect(cx - sw * 0.42, hip + bodyH * 0.3, sw * 0.36, bodyH * 0.1); ctx.fillRect(cx + sw * 0.06, hip + bodyH * 0.3, sw * 0.36, bodyH * 0.1);
    ctx.fillStyle = L.cleat === 'team' ? col : L.cleat || '#111'; ctx.fillRect(cx - sw * 0.46, base - 10, sw * 0.42, 10); ctx.fillRect(cx + sw * 0.04, base - 10, sw * 0.42, 10);
    // 腕（ウィングスパン）
    ctx.strokeStyle = sleeve; ctx.lineWidth = sw * 0.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - sw * 0.5, sh + 14); ctx.lineTo(cx - sw * (0.75 + arm * 0.25), hip + bodyH * (0.05 + arm * 0.05)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + sw * 0.5, sh + 14); ctx.lineTo(cx + sw * (0.75 + arm * 0.25), hip + bodyH * (0.05 + arm * 0.05)); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx - sw * (0.75 + arm * 0.25), hip + bodyH * (0.08 + arm * 0.05), sw * 0.11, 0, 7); ctx.arc(cx + sw * (0.75 + arm * 0.25), hip + bodyH * (0.08 + arm * 0.05), sw * 0.11, 0, 7); ctx.fill();
    // 胴体
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(cx - sw * 0.62, sh, sw * 1.24, hip - sh + 6, 18); ctx.fill();
    ctx.fillStyle = trim; ctx.fillRect(cx - sw * 0.62, sh + 16, sw * 1.24, 7);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${sw * 0.62}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.num || '', cx, sh + (hip - sh) * 0.58);
    // 首・ヘルメット
    ctx.fillStyle = skin; ctx.fillRect(cx - 9, sh - 14, 18, 16);
    const hy = sh - 36, hr2 = Math.max(24, sw * 0.36);
    ctx.fillStyle = t.hel; ctx.beginPath(); ctx.arc(cx, hy, hr2, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(cx - hr2 * 0.3, hy - hr2 * 0.35, hr2 * 0.35, 0, 7); ctx.fill();
    ctx.fillStyle = skin; ctx.fillRect(cx - hr2 * 0.55, hy - hr2 * 0.05, hr2 * 1.1, hr2 * 0.6);
    if (L.visor) { ctx.fillStyle = L.visor; ctx.fillRect(cx - hr2 * 0.6, hy - hr2 * 0.1, hr2 * 1.2, hr2 * 0.32); }
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - hr2 * 0.6, hy + hr2 * (0.25 + i * 0.16)); ctx.lineTo(cx + hr2 * 0.6, hy + hr2 * (0.25 + i * 0.16)); ctx.stroke(); }
  },
  bar(label, v, extra) {
    const c = v >= 85 ? '#3ddc84' : v >= 75 ? '#ffc629' : v >= 60 ? '#f39c12' : '#e74c3c';
    return U.el('div', { class: 'abar' }, U.el('span', { class: 'al' }, label), U.el('div', { class: 'at' }, U.el('div', { style: `width:${v}%;background:${c}` })), U.el('span', { class: 'av' }, v), extra || '');
  },
  ovrBadge(o) { return U.el('div', { class: 'ovr' }, U.el('small', null, 'OVR'), o); },

  // ---------- スロット ----------
  slots() {
    const rows = [];
    for (let i = 0; i < Career.NSLOT; i++) {
      const s = Career.summary(i);
      rows.push(U.el('div', { class: 'slot' }, U.el('div', { class: 'sn' }, 'SLOT ' + (i + 1)),
        s ? U.el('div', { style: 'flex:1' }, U.el('b', null, s.name), U.el('div', { class: 'muted' }, `${s.pos}・${s.team || 'ドラフト前'}・${s.year}年・OVR ${s.ovr}${s.phase === 'retired' ? '・引退' : ''}`)) : U.el('div', { style: 'flex:1', class: 'muted' }, '空きスロット'),
        s ? U.el('button', { class: 'btn small', onclick: () => { Career.load(i); this.resume(); } }, '続ける') : null,
        U.el('button', { class: 'btn small', onclick: () => { if (!s || confirm('このスロットのデータを消して新しく作りますか？')) this.create(i); } }, s ? '新規作成' : '新しい選手を作る'),
        s ? U.el('button', { class: 'btn small', onclick: () => { if (confirm('削除しますか？')) { Career.remove(i); this.slots(); } } }, '削除') : null));
    }
    UI.show(U.el('div', { class: 'screen' }, U.el('button', { class: 'btn small back', onclick: () => UI.title() }, '← 戻る'),
      U.el('h2', null, 'マイプレイヤー — キャリアモード'),
      U.el('div', { class: 'sub', style: 'letter-spacing:1px;margin-top:0' }, 'オリジナル選手を作り、ルーキーからNFLのスター、そして殿堂入りを目指せ'),
      U.el('div', { class: 'lobby', style: 'width:min(760px,100%)' }, rows)));
    UI.keyOff = Input.onKey(c => { if (c === 'Escape') UI.title(); });
  },
  resume() {
    const car = Career.car;
    if (car.phase === 'draft') return this.draft();
    this.hub();
  },

  // ---------- 選手作成 ----------
  create(slot) {
    const st = { step: 0, p: { first: '', last: '', num: 12, pos: 'WR', olSlot: 'LT', arch: 0, college: COLLEGES[0], fav: '', h: 185, w: 91, wing: 191, alloc: {}, skills: [], look: { skin: LOOK.skin[2][0], visor: null, sleeve: null, cleat: '#111111' } } };
    const POINTS = 45, MAXP = 12;
    const used = () => Object.values(st.p.alloc).reduce((a, b) => a + b, 0);
    const scr = U.el('div', { class: 'screen' }), body = U.el('div', { class: 'cgrid' }), left = U.el('div', { class: 'cpanel' }), right = U.el('div', { class: 'cpanel cprev' });
    const cv = U.el('canvas', { width: 260, height: 330, class: 'portrait' });
    const setPos = pos => { const [h, w] = BODY[pos]; Object.assign(st.p, { pos, arch: 0, h: h[1], w: w[1], wing: h[1] + 6, alloc: {}, skills: [] }); };
    const renderPrev = () => {
      right.innerHTML = '';
      const a = Career.attrs(st.p), o = Career.ovr(st.p, a);
      right.append(cv, U.el('div', { class: 'row', style: 'gap:10px;margin:6px 0' }, this.ovrBadge(o), U.el('div', null, U.el('b', null, (st.p.first || '名') + ' ' + (st.p.last || '姓')), U.el('div', { class: 'muted' }, `#${st.p.num} ${st.p.pos}・${ARCH[st.p.pos][st.p.arch][0]}`), U.el('div', { class: 'muted' }, `${st.p.h}cm (${cmToFt(st.p.h)}) / ${st.p.w}kg (${kgToLb(st.p.w)}) / 翼長 ${st.p.wing}cm`))));
      POS_ATTRS[st.p.pos].forEach(k => right.append(this.bar(ATTR_JP[k], a[k])));
      this.portrait(cv, st.p, st.p.fav || 'KC');
    };
    const steps = ['基本情報', '体格', '外見', '能力・スキル'];
    const renderLeft = () => {
      left.innerHTML = '';
      left.append(U.el('div', { class: 'tabs', style: 'justify-content:flex-start' }, steps.map((s, i) => U.el('div', { class: 'tab' + (i === st.step ? ' sel' : ''), onclick: () => { st.step = i; renderLeft(); } }, (i + 1) + '. ' + s))));
      const P = st.p, row = (label, ctl, sub) => U.el('div', { class: 'setrow' }, U.el('label', null, label, sub ? U.el('small', null, sub) : ''), ctl);
      const seg = (opts, cur, on) => U.el('div', { class: 'seg', style: 'flex-wrap:wrap' }, opts.map(([v, l]) => U.el('button', { class: v === cur ? 'on' : '', onclick: () => { on(v); renderLeft(); renderPrev(); } }, l)));
      if (st.step === 0) {
        const fn = U.el('input', { class: 'tin', value: P.first, placeholder: '名（例: Taro）', maxlength: 14 }), ln = U.el('input', { class: 'tin', value: P.last, placeholder: '姓（例: Yamada）', maxlength: 16 });
        fn.oninput = () => { P.first = fn.value; renderPrev(); }; ln.oninput = () => { P.last = ln.value; renderPrev(); };
        const num = U.el('input', { class: 'tin', type: 'number', min: 0, max: 99, value: P.num, style: 'width:90px' }); num.oninput = () => { P.num = U.clamp(+num.value || 0, 0, 99); renderPrev(); };
        left.append(row('名前', U.el('div', { class: 'row', style: 'gap:6px' }, fn, ln), '英字推奨（実況・成績表に表示）'), row('背番号', num));
        left.append(U.el('h3', null, 'ポジション'), U.el('div', { class: 'posgrid' }, CAREER_POS.map(([id, jp]) => U.el('div', { class: 'tab' + (P.pos === id ? ' sel' : ''), onclick: () => { setPos(id); renderLeft(); renderPrev(); } }, id, U.el('small', null, jp)))));
        if (P.pos === 'OL') left.append(row('OLのポジション', seg(OL_SLOTS.map(([v, l]) => [v, v]), P.olSlot, v => { P.olSlot = v; })));
        left.append(row('タイプ（アーキタイプ）', seg(ARCH[P.pos].map((a, i) => [i, a[0]]), P.arch, v => P.arch = v)));
        const col = U.el('select', { class: 'tin' }, COLLEGES.map(c => U.el('option', c === P.college ? { selected: '' } : null, c))); col.onchange = () => P.college = col.value;
        const fav = U.el('select', { class: 'tin' }, U.el('option', { value: '' }, 'こだわらない'), TEAMS.map(t => U.el('option', Object.assign({ value: t.id }, t.id === P.fav ? { selected: '' } : {}), `${t.city} ${t.name}`)));
        fav.onchange = () => { P.fav = fav.value; renderPrev(); };
        left.append(row('出身大学', col), row('希望チーム', fav, 'ドラフトで指名される可能性が少し上がります'));
      } else if (st.step === 1) {
        const [hr, wr] = BODY[P.pos];
        const slider = (label, key, min, max, fmt, sub) => {
          const inp = U.el('input', { type: 'range', min, max, value: P[key], class: 'rng' }), val = U.el('b', { class: 'rv' }, fmt(P[key]));
          inp.oninput = () => { P[key] = +inp.value; if (key === 'h') { P.wing = U.clamp(P.wing, P.h - 6, P.h + 16); } val.textContent = fmt(P[key]); renderPrev(); };
          return row(label, U.el('div', { class: 'row', style: 'gap:10px;flex-wrap:nowrap' }, inp, val), sub);
        };
        left.append(slider('身長', 'h', hr[0], hr[2], v => `${v}cm（${cmToFt(v)}）`, '高いほどキャッチ範囲・パスカット↑、敏捷性↓'));
        left.append(slider('体重', 'w', wr[0], wr[2], v => `${v}kg（${kgToLb(v)}）`, '重いほどパワー・ブロック↑、スピード・加速↓'));
        left.append(slider('翼長（ウィングスパン）', 'wing', P.h - 6, P.h + 16, v => `${v}cm（身長比 ${v - P.h >= 0 ? '+' : ''}${v - P.h}）`, '長いほどタックル範囲・キャッチ・ブロック・パスラッシュ↑'));
        left.append(U.el('div', { class: 'muted', style: 'margin-top:8px;font-size:12px' }, '体格は試合中の当たり判定（キャッチ範囲・タックル範囲）にも反映されます。'));
      } else if (st.step === 2) {
        const sw = (label, list, key) => row(label, U.el('div', { class: 'seg', style: 'flex-wrap:wrap' }, list.map(([v, l]) => U.el('button', { class: P.look[key] === v ? 'on' : '', onclick: () => { P.look[key] = v; renderLeft(); renderPrev(); } },
          v && v !== 'team' ? U.el('span', { class: 'sw', style: `background:${v}` }) : '', l))));
        left.append(sw('肌の色', LOOK.skin, 'skin'), sw('バイザー', LOOK.visor, 'visor'), sw('アームスリーブ', LOOK.sleeve, 'sleeve'), sw('スパイク', LOOK.cleat, 'cleat'));
      } else {
        const a = Career.attrs(P), base = Career.baseAttrs(P), left2 = POINTS - used();
        left.append(U.el('div', { class: 'pts' }, `残り能力ポイント: `, U.el('b', null, left2), ` / ${POINTS}（1能力あたり最大 +${MAXP}）`));
        POS_ATTRS[P.pos].forEach(k => {
          const add = P.alloc[k] || 0;
          left.append(U.el('div', { class: 'uprow' }, U.el('span', { class: 'al' }, ATTR_JP[k]), U.el('b', null, a[k]), U.el('span', { class: 'muted' }, add ? `(+${add})` : ''),
            U.el('button', { class: 'btn small', disabled: add <= 0 ? '' : null, onclick: () => { P.alloc[k] = add - 1; renderLeft(); renderPrev(); } }, '−'),
            U.el('button', { class: 'btn small', disabled: add >= MAXP || left2 <= 0 || base[k] + add >= 95 ? '' : null, onclick: () => { P.alloc[k] = add + 1; renderLeft(); renderPrev(); } }, '+')));
        });
        left.append(U.el('h3', null, '初期スキル（1つ無料）'));
        const avail = SKILLS.filter(s => s.lv === 1 && (!s.pos || s.pos.includes(P.pos)));
        left.append(U.el('div', { class: 'skillgrid' }, avail.map(s => U.el('div', { class: 'skill' + (P.skills[0] === s.id ? ' sel' : ''), onclick: () => { P.skills = [s.id]; renderLeft(); } }, U.el('b', null, s.n), U.el('small', null, s.d)))));
      }
      const nav = U.el('div', { class: 'row', style: 'margin-top:14px;justify-content:space-between' },
        U.el('button', { class: 'btn small', onclick: () => { if (st.step > 0) { st.step--; renderLeft(); } else this.slots(); } }, st.step ? '← 戻る' : 'キャンセル'),
        st.step < 3 ? U.el('button', { class: 'btn primary small', onclick: () => { st.step++; renderLeft(); } }, '次へ →')
          : U.el('button', { class: 'btn primary', onclick: () => {
            if (!P.first.trim() || !P.last.trim()) { alert('名前を入力してください'); st.step = 0; renderLeft(); return; }
            Career.create(slot, JSON.parse(JSON.stringify(P))); Career.car.fav = P.fav; Career.save(); this.draft();
          } }, 'コンバイン & ドラフトへ →'));
      left.append(nav);
    };
    body.append(left, right); scr.append(U.el('h2', null, 'マイプレイヤー作成'), body);
    UI.show(scr); renderLeft(); renderPrev();
  },

  // ---------- コンバイン & ドラフト ----------
  draft() {
    const car = Career.car, cb = Career.combine(car);
    const box = U.el('div', { class: 'lobby', style: 'width:min(680px,100%)' });
    box.append(U.el('h3', null, `NFLスカウティング・コンバイン（${car.year}年）`),
      U.el('table', { class: 'tbl' }, cb.map(([k, v]) => U.el('tr', null, U.el('td', null, k), U.el('td', null, U.el('b', null, v))))));
    const res = U.el('div', { class: 'draftres' }, U.el('div', { class: 'muted' }, 'ドラフト当日…'));
    const go = U.el('button', { class: 'btn primary', onclick: () => {
      go.remove(); res.innerHTML = '<div class="muted">指名を待っています…</div>';
      setTimeout(() => {
        const d = Career.draft(car, car.fav), t = TEAM_BY_ID[d.team];
        res.innerHTML = '';
        if (d.round <= 7) res.append(U.el('div', { class: 'big' }, `第${d.round}巡目 全体${d.overall}位`), UI.logo(t), U.el('div', { class: 'big2' }, `${t.city} ${t.name} が指名！`),
          U.el('div', { class: 'muted' }, `ルーキー契約: ${car.contract.years}年 / 年俸 ${car.contract.salary}M$`));
        else {
          res.append(U.el('div', { class: 'big' }, 'ドラフト外…'), U.el('div', { class: 'muted' }, 'ドラフト外フリーエージェント（UDFA）として契約するチームを選ぼう'));
          TEAMS.slice().sort(() => Math.random() - 0.5).slice(0, 3).forEach(tt => res.append(U.el('button', { class: 'btn', onclick: () => { car.team = tt.id; car.draft.team = tt.id; car.contract = { years: 3, left: 3, salary: 0.9 }; start(); } }, UI.logo(tt), `${tt.city} ${tt.name}`)));
          return;
        }
        res.append(U.el('button', { class: 'btn primary', style: 'margin-top:12px', onclick: start }, 'ルーキーシーズン開始 →'));
        SFX.cheer(true);
      }, 1400);
    } }, 'ドラフトを待つ');
    const start = () => { Career.startSeason(car); Career.news(car, `${car.draft.round <= 7 ? `ドラフト${car.draft.round}巡目で指名` : 'UDFAとして契約'}。背番号${car.p.num}`); Career.save(); this.hub(); };
    box.append(res, go);
    UI.show(U.el('div', { class: 'screen' }, U.el('h2', null, 'NFLドラフト'), box));
  },

  // ---------- ハブ ----------
  hub(msg) {
    const car = Career.car; if (!car) return UI.title();
    App.career = true;
    const P = car.p, t = TEAM_BY_ID[car.team], a = Career.attrs(P), o = Career.ovr(P, a), st = car.sched ? League.standings(car) : null, rec = st ? st[car.team] : null;
    const role = car.phase === 'retired' ? null : Career.role(car);
    const scr = U.el('div', { class: 'screen', style: 'justify-content:flex-start' });
    // ヘッダー
    const xpPct = Math.round(P.xp / Career.xpNeed(P.lv) * 100);
    scr.append(U.el('div', { class: 'hubhead' }, UI.logo(t), U.el('div', null, U.el('div', { class: 'hn' }, `${P.first} ${P.last}`), U.el('div', { class: 'muted' }, `#${P.num} ${P.pos === 'OL' ? P.olSlot : P.pos}・${t.city} ${t.name}・${P.age}歳・${car.yearsPro}年目`)),
      this.ovrBadge(o), U.el('div', { class: 'lvbox' }, U.el('div', null, `Lv.${P.lv}`, U.el('span', { class: 'muted' }, `  SP ${P.sp}`)), U.el('div', { class: 'xpb' }, U.el('div', { style: `width:${xpPct}%` }))),
      U.el('div', { class: 'yr' }, `${car.year}年`, U.el('small', null, car.phase === 'reg' ? `Week ${car.week}` : { po: 'プレーオフ', honors: 'NFL Honors', off: 'オフシーズン', retired: '引退' }[car.phase] || ''), rec ? U.el('small', null, `${rec.w}勝${rec.l}敗${rec.t ? rec.t + '分' : ''}`) : '')));
    if (msg) scr.append(U.el('div', { class: 'toast' }, msg));
    const grid = U.el('div', { class: 'hubgrid' });
    // 左: 選手
    const cv = U.el('canvas', { width: 220, height: 280, class: 'portrait' });
    const L = U.el('div', { class: 'cpanel' }, cv);
    if (role) L.append(U.el('div', { class: 'role' }, U.el('b', null, role.label), U.el('div', { class: 'muted' }, role.share >= 1 ? `${role.slot} の先発` : `${role.slot} を ${role.rival.name}（OVR ${role.rival.ovr}）と争う`)));
    POS_ATTRS[P.pos].forEach(k => L.append(this.bar(ATTR_JP[k], a[k])));
    if (P.skills.length) L.append(U.el('div', { class: 'skl' }, P.skills.map(s => U.el('span', { class: 'chip' }, SKILL_BY[s].n))));
    // 中央: 次のイベント
    const C = U.el('div', { class: 'cpanel' }); this.nextCard(C, car);
    // 右: ニュース・今季成績
    const R = U.el('div', { class: 'cpanel' });
    if (car.ls) R.append(U.el('h3', null, `${car.year}年 シーズン成績`), U.el('div', { class: 'statline' }, Career.lineText(car.ls.ME, P.pos)));
    const lg = League.legacy(car);
    R.append(U.el('h3', null, 'レガシー（殿堂入り見込み）'), U.el('div', { class: 'xpb big' }, U.el('div', { style: `width:${Math.round(lg.prob * 100)}%;background:linear-gradient(90deg,#c9a227,#ffe08a)` })), U.el('div', { class: 'muted' }, `スコア ${lg.score}・殿堂入り確率 ${Math.round(lg.prob * 100)}%`));
    R.append(U.el('h3', null, 'ニュース'), U.el('div', { class: 'news' }, car.news.slice(0, 12).map(n => U.el('div', null, U.el('span', { class: 'muted' }, `${n.y}${n.w ? ' W' + n.w : ''} `), n.s))));
    grid.append(L, C, R); scr.append(grid);
    // ナビ
    const nav = [['育成・スキル', () => CUI2.upgrade()], ['スタッツ', () => CUI2.stats()], ['リーグリーダー', () => CUI2.leaders()], ['順位表', () => CUI2.standings()], ['日程', () => CUI2.schedule()], ['トロフィールーム', () => CUI2.trophies()], ['セーブして終了', () => { Career.save(); App.career = false; UI.title(); }]];
    if (car.phase === 'retired') nav.splice(0, 1);
    scr.append(U.el('div', { class: 'hubnav' }, nav.map(([l, f]) => U.el('button', { class: 'btn small', onclick: f }, l))));
    UI.show(scr); this.portrait(cv, P, car.team);
    Career.save();
  },
  nextCard(C, car) {
    const P = car.p;
    if (car.phase === 'reg' || car.phase === 'po') {
      const g = Career.myGame(car);
      const label = car.phase === 'reg' ? `Week ${car.week}` : League.ROUND_JP[car.po.round];
      C.append(U.el('h3', null, label));
      if (g) {
        const home = g.h === car.team, opp = TEAM_BY_ID[home ? g.a : g.h], st = League.standings(car), r = st[opp.id];
        C.append(U.el('div', { class: 'matchup' }, UI.logo(TEAM_BY_ID[car.team]), U.el('div', { class: 'vs' }, g.conf === 'SB' ? 'SB' : home ? 'vs' : '@'), UI.logo(opp)),
          U.el('div', { style: 'text-align:center;margin-bottom:10px' }, U.el('b', null, `${opp.city} ${opp.name}`), U.el('div', { class: 'muted' }, `${r.w}-${r.l}${r.t ? '-' + r.t : ''}・総合 ${opp.ovr}`)));
        C.append(U.el('button', { class: 'btn primary', onclick: () => App.startCareerGame(car, g) }, '▶ 試合をプレー（自分の選手を操作）'));
        C.append(U.el('button', { class: 'btn', style: 'margin-top:8px', onclick: () => this.simNext() }, '⏩ この試合をシミュレート'));
        // 練習
        const key = car.year * 100 + (car.week || 0) + (car.phase === 'po' ? 50 + car.po.round : 0);
        if (car.trainedWeek !== key) {
          C.append(U.el('h3', null, '今週の練習（1回）'), U.el('div', { class: 'row', style: 'gap:6px;justify-content:flex-start' },
            Career.DRILLS.map((d, i) => U.el('button', { class: 'btn small', onclick: () => { const m = Career.train(car, i); Career.save(); this.hub(m); } }, d[0]))));
        }
        if (car.phase === 'reg') C.append(U.el('button', { class: 'btn small', style: 'margin-top:14px', onclick: () => this.simRest() }, 'レギュラーシーズン残りを全てシミュレート'));
      } else if (car.phase === 'reg') {
        C.append(U.el('div', { class: 'big2' }, 'バイウィーク'), U.el('div', { class: 'muted' }, '今週は試合がありません。体を休めよう。'),
          U.el('button', { class: 'btn primary', style: 'margin-top:10px', onclick: () => { Career.gainXP(car, 80); Career.finishWeek(car); Career.save(); this.hub('バイウィーク：休養（+XP80）'); } }, '週を進める'));
      } else {
        C.append(U.el('div', { class: 'big2' }, Career.inPlayoffs(car) ? '待機中' : 'シーズン終了'), U.el('div', { class: 'muted' }, Career.inPlayoffs(car) ? '' : 'チームはプレーオフで敗退／出場を逃しました。'),
          U.el('button', { class: 'btn primary', style: 'margin-top:10px', onclick: () => { while (car.phase === 'po' && !Career.myGame(car)) Career.finishRound(car); Career.save(); this.hub(); } }, 'プレーオフを進める'));
      }
    } else if (car.phase === 'honors') {
      C.append(U.el('h3', null, 'シーズン終了'), U.el('div', { class: 'big2' }, 'NFL Honors'), U.el('div', { class: 'muted' }, 'MVPや新人王、オールプロ、プロボウルの選考結果が発表されます。'),
        U.el('button', { class: 'btn primary', style: 'margin-top:10px', onclick: () => CUI2.honors() }, '表彰式へ →'));
    } else if (car.phase === 'off') CUI2.offseasonCard(C, car);
    else if (car.phase === 'retired') {
      C.append(U.el('h3', null, '引退'), U.el('div', { class: 'big2' }, `${car.retiredYear}年に現役引退`), U.el('button', { class: 'btn primary', style: 'margin-top:10px', onclick: () => CUI2.hof() }, 'プロフットボール殿堂 投票結果'));
    }
  },
  simNext() {
    const car = Career.car, res = Career.simMine(car);
    this.afterGame(res);
  },
  simRest() {
    const car = Career.car;
    while (car.phase === 'reg') { Career.simMine(car); Career.finishWeek(car); }
    Career.save(); this.hub('レギュラーシーズン終了');
  },
  // 試合後（プレー/シム共通）
  afterGame(res) {
    const car = Career.car;
    let pow = null;
    if (car.phase === 'reg') pow = Career.finishWeek(car); else if (car.phase === 'po') Career.finishRound(car);
    Career.save();
    const g = res.g, opp = TEAM_BY_ID[res.opp], me = TEAM_BY_ID[car.team];
    const box = U.el('div', { class: 'lobby', style: 'width:min(640px,100%)' },
      U.el('div', { class: 'final' }, U.el('div', { class: 't' }, UI.logo(me), me.name), U.el('div', null, `${res.my} - ${res.op}`), U.el('div', { class: 't' }, UI.logo(opp), opp.name)),
      U.el('div', { class: 'big2', style: 'text-align:center' }, res.win ? '勝利！' : res.my === res.op ? '引き分け' : '敗戦'),
      U.el('h3', null, 'あなたの成績' + (res.played && App.settings.qlen < 15 ? `（${App.settings.qlen}分クォーターを15分換算）` : '')), U.el('div', { class: 'statline' }, Career.lineText(res.line, car.p.pos)),
      U.el('div', { class: 'xpgain' }, `+${res.xp} XP`, res.lvUp ? U.el('b', null, `  レベルアップ！ Lv.${car.p.lv}`) : ''),
      pow ? U.el('div', { class: 'award' }, '🏅 ' + pow) : '',
      U.el('button', { class: 'btn primary', style: 'margin-top:14px', onclick: () => this.hub() }, '続ける →'));
    UI.show(U.el('div', { class: 'screen overlay' }, U.el('h2', null, res.po ? 'プレーオフ 試合結果' : `Week ${g.w} 試合結果`), box));
    if (res.win) SFX.cheer(false);
  },
};
