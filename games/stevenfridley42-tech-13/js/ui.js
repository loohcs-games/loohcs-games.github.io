'use strict';
// ===== メニュー画面 =====
const el = U.el;
const DIFF_JP = ['ルーキー', 'プロ', 'オールプロ'];
const UI = {
  root: null, keyOff: null,
  init() { this.root = document.getElementById('ui'); },
  clear() { this.root.innerHTML = ''; if (this.keyOff) { this.keyOff(); this.keyOff = null; } },
  show(node) { this.clear(); this.root.append(node); return node; },
  // 矢印キーでボタン移動できるメニュー
  navMenu(buttons, onBack) {
    let i = 0; const sel = () => buttons.forEach((b, j) => b.classList.toggle('sel', j === i)); sel();
    buttons.forEach((b, j) => b.addEventListener('mouseenter', () => { i = j; sel(); }));
    this.keyOff = Input.onKey(c => {
      if (c === 'ArrowDown' || c === 'KeyS') { i = (i + 1) % buttons.length; sel(); SFX.click(); }
      if (c === 'ArrowUp' || c === 'KeyW') { i = (i + buttons.length - 1) % buttons.length; sel(); SFX.click(); }
      if (c === 'Enter' || c === 'Space') buttons[i].click();
      if (c === 'Escape' && onBack) onBack();
    });
  },
  logo(t) { return el('div', { class: 'tlogo', style: `background:${t.c1};border-color:${t.c2};color:#fff` }, t.id); },

  title() {
    const b = (label, sub, fn) => el('button', { class: 'btn', onclick: () => { SFX.init(); SFX.select(); fn(); } }, el('div', null, label, el('small', null, sub)));
    const btns = [
      b('★ マイプレイヤー（キャリア）', 'オリジナル選手を作成し、ルーキーからスター・殿堂入りを目指すメインモード', () => CUI.slots()),
      b('エキシビション（チーム対戦）', 'NFL 32チームから選んでCPUと対戦。チーム全体を指揮', () => App.setupExhibition('team')),
      b('個人モード（1試合）', '好きなチームの実在選手1人になりきってCPUと対戦', () => App.setupExhibition('player')),
      b('オンライン対戦', 'ルームコードで友達と対戦（チーム対戦 / 個人モード）', () => App.gate(() => this.online())),
      b('ルールブック・操作方法', 'アメフトのルールとキーボード・マウス操作', () => this.show(MenuUI.rulebookNode(() => this.title()))),
      b('設定', '試合スピード・クォーター時間・難易度・アシストなど', () => this.show(MenuUI.settingsNode(() => this.title()))),
    ];
    this.show(el('div', { class: 'screen title' },
      el('div', { class: 'logo', html: FOOTBALL_SVG }), el('h1', null, 'GRIDIRON 26'), el('div', { class: 'sub' }, 'AMERICAN FOOTBALL SIMULATION'),
      el('div', { class: 'menu' }, btns),
      el('div', { class: 'foot' }, '↑↓ で選択 / Enter で決定 ・ 右上の ☰ でメニュー ・ 推奨: パソコン（キーボード＋マウス）')));
    this.navMenu(btns);
  },

  // ---- チーム選択 ----
  teamPicker(opts) {
    // opts: {title, pickCount: 1|2, onDone([ids]), onBack, labels}
    const picks = opts.initial ? opts.initial.slice() : []; let slot = 0;
    const scr = el('div', { class: 'screen' });
    const bar = el('div', { class: 'pickbar' }), grid = el('div', { class: 'teamgrid' });
    const go = el('button', { class: 'btn primary', style: 'min-width:260px', onclick: () => { if (picks.filter(Boolean).length >= opts.pickCount) { SFX.select(); opts.onDone(picks); } } }, opts.goLabel || '決定');
    const slots = [];
    const renderBar = () => {
      bar.innerHTML = '';
      for (let i = 0; i < opts.pickCount; i++) {
        const t = picks[i] && TEAM_BY_ID[picks[i]];
        const s = el('div', { class: 'pickslot' + (i === slot ? ' active' : ''), onclick: () => { slot = i; renderBar(); renderGrid(); } },
          t ? this.logo(t) : el('div', { class: 'tlogo', style: 'border-color:#333;color:#666' }, '?'),
          el('div', { class: 'tname' }, t ? `${t.city} ${t.name}` : '未選択', el('small', null, opts.labels[i] + (t ? `  総合 ${t.ovr}（攻${t.off}/守${t.def}）` : ''))));
        bar.append(s); if (i === 0 && opts.pickCount === 2) bar.append(el('div', { class: 'vs' }, 'VS'));
      }
      go.disabled = picks.filter(Boolean).length < opts.pickCount;
    };
    const renderGrid = () => {
      grid.innerHTML = '';
      for (const conf of ['AFC', 'NFC']) for (const div of ['East', 'North', 'South', 'West']) {
        grid.append(el('div', { class: 'divlabel' }, `${conf} ${div}`));
        TEAMS.filter(t => t.conf === conf && t.div === div).forEach(t => {
          const cls = 'tcard' + (picks[slot] === t.id ? ' sel' : picks.includes(t.id) ? ' sel2' : '');
          grid.append(el('div', { class: cls, style: `background:linear-gradient(90deg,${t.c1}33,var(--panel) 60%)`, onclick: () => {
            picks[slot] = t.id; SFX.click(); if (slot < opts.pickCount - 1 && !picks[slot + 1]) slot++; renderBar(); renderGrid();
          } }, this.logo(t), el('div', { class: 'tname' }, t.name, el('small', null, `${t.city}・${t.jp}`)), el('div', { class: 'tovr' }, t.ovr)));
        });
      }
    };
    renderBar(); renderGrid();
    scr.append(el('button', { class: 'btn small back', onclick: opts.onBack }, '← 戻る'), el('h2', null, opts.title), bar, el('div', { class: 'row', style: 'margin-bottom:14px' }, go), grid);
    this.show(scr);
    this.keyOff = Input.onKey(c => { if (c === 'Escape') opts.onBack(); if (c === 'Enter') go.click(); });
  },

  // ---- 選手選択（個人モード） ----
  playerPicker(teamId, onDone, onBack) {
    const t = TEAM_BY_ID[teamId]; let filter = 'ALL', chosen = null;
    const scr = el('div', { class: 'screen' }), tabs = el('div', { class: 'tabs' }), list = el('div', { class: 'plist' });
    const go = el('button', { class: 'btn primary', style: 'min-width:260px', disabled: '', onclick: () => chosen && onDone(chosen.key) }, 'この選手でプレー');
    const groups = { ALL: null, QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], OL: ['LT', 'LG', 'C', 'RG', 'RT'], DL: ['DE', 'DT'], LB: ['LB'], DB: ['CB', 'S'], K: ['K', 'P'] };
    const renderTabs = () => { tabs.innerHTML = ''; for (const g in groups) tabs.append(el('div', { class: 'tab' + (g === filter ? ' sel' : ''), onclick: () => { filter = g; renderTabs(); renderList(); } }, g === 'ALL' ? 'すべて' : g)); };
    const renderList = () => {
      list.innerHTML = '';
      t.players.filter(p => !p.generic && (!groups[filter] || groups[filter].includes(p.pos))).forEach(p => {
        list.append(el('div', { class: 'pcard' + (chosen === p ? ' sel' : ''), onclick: () => { chosen = p; go.disabled = false; SFX.click(); renderList(); } },
          el('div', { class: 'pnum', style: `color:${t.c2 === '#FFFFFF' ? t.c1 : '#fff'}` }, '#' + p.num),
          el('div', { style: 'flex:1' }, el('div', { style: 'font-weight:700;font-size:14px' }, p.name),
            el('div', { style: 'color:var(--muted);font-size:11px' }, `${POS_JP[p.pos]}・SPD ${p.a.spd}`)),
          el('span', { class: 'ppos' }, p.pos), el('div', { class: 'tovr', style: 'margin-left:8px' }, p.ovr)));
      });
    };
    renderTabs(); renderList();
    scr.append(el('button', { class: 'btn small back', onclick: onBack }, '← 戻る'),
      el('div', { class: 'row', style: 'margin-bottom:6px' }, this.logo(t), el('h2', { style: 'margin:0' }, `${t.city} ${t.name} — 選手を選択`)),
      el('div', { class: 'sub', style: 'margin:4px 0 14px;letter-spacing:1px' }, 'QBを選ぶとプレーコールも担当。他のポジションはAIのコールに従ってプレーします'),
      tabs, el('div', { class: 'row', style: 'margin-bottom:12px' }, go), list);
    this.show(scr);
    this.keyOff = Input.onKey(c => { if (c === 'Escape') onBack(); if (c === 'Enter' && chosen) onDone(chosen.key); });
  },

  // ---- 設定 ----
  settings(onBack) {
    const S = App.settings;
    const seg = (key, opts, fmt) => {
      const box = el('div', { class: 'seg' });
      const render = () => { box.innerHTML = ''; opts.forEach(v => box.append(el('button', { class: S[key] === v ? 'on' : '', onclick: () => { S[key] = v; App.saveSettings(); SFX.click(); render(); } }, fmt(v)))); };
      render(); return box;
    };
    const row = (label, sub, ctl) => el('div', { class: 'setrow' }, el('label', null, label, el('small', null, sub)), ctl);
    this.show(el('div', { class: 'screen' },
      el('button', { class: 'btn small back', onclick: onBack }, '← 戻る'), el('h2', null, '設定'),
      el('div', { class: 'settings' },
        row('クォーターの長さ', '試合時計（プレー間は自動で時間が進みます）', seg('qlen', [3, 5, 8, 15], v => v + '分')),
        row('難易度', 'CPUの能力・判断の強さ', seg('diff', [0, 1, 2], v => DIFF_JP[v])),
        row('操作アシスト', 'キーを押していない間はAIが自動で動かします', seg('assist', [true, false], v => v ? 'オン' : 'オフ')),
        row('反則の頻度', 'ホールディング・オフサイド等', seg('pen', [0, 0.6, 1, 1.5], v => ({ 0: 'なし', 0.6: '少', 1: '標準', 1.5: '多' })[v])),
        row('サウンド', '効果音と観客の歓声', seg('vol', [0, 0.4, 0.7, 1], v => v ? Math.round(v * 100) + '%' : 'オフ')),
      )));
    this.keyOff = Input.onKey(c => { if (c === 'Escape') onBack(); });
  },

  // ---- 操作方法 ----
  controls(onBack, overlay) {
    const tbl = rows => el('table', null, rows.map(([k, v]) => el('tr', null, el('td', { html: k }), el('td', null, v))));
    const K = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join('');
    const scr = el('div', { class: 'screen' + (overlay ? ' overlay' : '') },
      el('button', { class: 'btn small back', onclick: onBack }, '← 戻る'), el('h2', null, '操作方法'),
      el('div', { class: 'controls' },
        el('div', { class: 'cbox' }, el('h4', null, '共通'), tbl([[K('W A S D') + ' / 矢印', '移動'], [K('Shift'), 'ダッシュ'], [K('Esc'), 'ポーズ'], [K('T'), 'タイムアウト（プレー選択・スナップ前）'], [K('Enter') + '長押し', '早送り（自分が関わらない場面）']])),
        el('div', { class: 'cbox' }, el('h4', null, 'プレー選択'), tbl([[K('←→↑↓'), 'プレーを選ぶ'], [K('Q E'), 'フォーメーション切替'], [K('Enter') + ' / ' + K('Space'), '決定'], [K('F'), 'プレーを左右反転'], [K('H'), 'ノーハドル（時間を節約）']])),
        el('div', { class: 'cbox' }, el('h4', null, 'オフェンス（QB）'), tbl([[K('Space'), 'スナップ'], [K('1 2 3 4 5'), 'レシーバーへパス（頭上の番号）'], [K('Q') + '+数字', 'ふんわりロブパス'], [K('E') + '+数字', '弾丸パス'], [K('R'), '投げ捨て'], [K('C'), '（個人モード）ボールを要求']])),
        el('div', { class: 'cbox' }, el('h4', null, 'ボールキャリア'), tbl([[K('J'), 'ジューク（横に切る）'], [K('K'), 'スピン'], [K('L'), 'トラック / スティフアーム'], [K('Space'), 'ダイブ（QBはスライド）'], [K('F'), 'フェアキャッチ / エンドゾーンでニーダウン']])),
        el('div', { class: 'cbox' }, el('h4', null, 'ディフェンス'), tbl([[K('Tab') + ' / ' + K('Space'), 'ボールに一番近い選手に切替'], [K('J'), 'ダイブタックル'], [K('K'), 'ジャンプ / パスカット'], ['', 'キーを離すとAIが担当（アシスト時）']])),
        el('div', { class: 'cbox' }, el('h4', null, 'キック（FG・パント・キックオフ）'), tbl([[K('W S'), '方向'], [K('Space') + ' 1回目', 'パワーメーター開始'], [K('Space') + ' 2回目', 'パワー決定'], [K('Space') + ' 3回目', '精度（中央ほど正確）']])),
      ),
      el('div', { class: 'cbox', style: 'width:min(980px,100%);margin-top:14px' }, el('h4', null, '主なルール（NFL準拠）'),
        el('div', { style: 'font-size:13px;line-height:1.8;color:#cdd6ea' },
          '4回の攻撃（ダウン）で10ヤード進めばファーストダウン。タッチダウン6点＋PAT(1点キック)または2ポイントコンバージョン、FG 3点、セーフティ2点。',
          el('br'), '時計: パス失敗・アウトオブバウンズ（前半残り2分/後半残り5分）・得点・攻守交代・タイムアウトで停止。2ミニッツ・ウォーニングあり。各チーム前後半3回のタイムアウト。',
          el('br'), 'キックオフは2025年ルール（ダイナミックキックオフ）: エンドゾーンへのタッチバックは35ヤード、ランディングゾーン手前は40ヤード。パントのタッチバックは20ヤード。',
          el('br'), '延長戦: 10分、両チームに攻撃機会（2025年ルール）、その後サドンデス。反則: ホールディング、オフサイド、フォルススタート、ディレイ・オブ・ゲーム、パスインターフェア、フェイスマスク。')));
    this.root.append(scr);
    if (!overlay) { this.root.innerHTML = ''; this.root.append(scr); }
    const off = Input.onKey(c => { if (c === 'Escape') { off(); onBack(); } });
    return scr;
  },

  // ---- オンライン ----
  online() {
    if (!Net.available()) { alert('オンライン機能の読み込みに失敗しました（インターネット接続を確認してください）'); return; }
    const status = el('div', { class: 'status' });
    Net.status = s => status.textContent = s;
    const b = (label, sub, fn) => el('button', { class: 'btn', onclick: fn }, el('div', null, label, el('small', null, sub)));
    const btns = [
      b('ルームを作る（ホスト）', 'チーム対戦 / 個人モードを選んでコードを発行', () => this.onlineHost()),
      b('ルームに参加する', '相手から聞いたコードを入力', () => this.onlineJoin()),
    ];
    this.show(el('div', { class: 'screen' }, el('button', { class: 'btn small back', onclick: () => { Net.close(); this.title(); } }, '← 戻る'),
      el('h2', null, 'オンライン対戦'), el('div', { class: 'lobby' }, ...btns, status,
        el('div', { class: 'foot' }, 'P2P通信で直接つながります。ホストのPCで試合が計算されます。'))));
    this.navMenu(btns, () => { Net.close(); this.title(); });
  },
  onlineHost() {
    const mode = { v: 'team' };
    const seg = el('div', { class: 'seg' });
    const renderSeg = () => { seg.innerHTML = ''; [['team', 'チーム対戦'], ['player', '個人モード']].forEach(([v, l]) => seg.append(el('button', { class: mode.v === v ? 'on' : '', onclick: () => { mode.v = v; renderSeg(); } }, l))); };
    renderSeg();
    this.show(el('div', { class: 'screen' }, el('button', { class: 'btn small back', onclick: () => this.online() }, '← 戻る'),
      el('h2', null, 'ルーム作成'), el('div', { class: 'lobby' }, el('div', { class: 'setrow' }, el('label', null, '対戦モード', el('small', null, '個人モードはお互いに選手1人を操作')), seg),
        el('button', { class: 'btn primary', onclick: () => this.teamPicker({ title: 'あなたのチーム（ホーム）', pickCount: 1, labels: ['ホーム'], onBack: () => this.onlineHost(), onDone: ([tid]) => {
          const after = key => App.hostOnline(mode.v, tid, key);
          if (mode.v === 'player') this.playerPicker(tid, after, () => this.onlineHost()); else after(null);
        } }) }, 'チームを選ぶ →'))));
  },
  onlineWait(code) {
    const status = el('div', { class: 'status' }, '相手の参加を待っています…'); Net.status = s => status.textContent = s;
    this.show(el('div', { class: 'screen' }, el('button', { class: 'btn small back', onclick: () => { Net.close(); this.online(); } }, '← キャンセル'),
      el('h2', null, 'ルームコード'), el('div', { class: 'lobby' }, el('div', { class: 'code' }, code || '……'),
        el('button', { class: 'btn small', style: 'justify-content:center', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(code); status.textContent = 'コピーしました'; } }, 'コードをコピー'), status)));
  },
  onlineJoin() {
    const inp = el('input', { class: 'txt', maxlength: '5', placeholder: 'XXXXX' });
    const status = el('div', { class: 'status' }); Net.status = s => status.textContent = s;
    const go = el('button', { class: 'btn primary', onclick: () => { if (inp.value.trim().length === 5) App.joinOnline(inp.value); } }, '参加する');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    this.show(el('div', { class: 'screen' }, el('button', { class: 'btn small back', onclick: () => { Net.close(); this.online(); } }, '← 戻る'),
      el('h2', null, 'ルームに参加'), el('div', { class: 'lobby' }, inp, go, status)));
    setTimeout(() => inp.focus(), 50);
  },
  message(title, text, btnLabel, fn) {
    this.show(el('div', { class: 'screen overlay' }, el('h2', null, title), el('div', { class: 'status', style: 'font-size:15px;margin-bottom:16px' }, text),
      el('button', { class: 'btn primary', style: 'min-width:240px', onclick: fn }, btnLabel)));
  },
};
