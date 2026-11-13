'use strict';
// ===== ログイン / ☰メニュー / 設定 / ルールブック =====
const FOOTBALL_SVG = '<svg viewBox="0 0 64 40" class="fb"><ellipse cx="32" cy="20" rx="30" ry="17" fill="#7a3d17" stroke="#3d1d08" stroke-width="2"/><path d="M8 20h48" stroke="#fff" stroke-width="2"/><path d="M5 14c4 1 4 11 0 12M59 14c-4 1-4 11 0 12" stroke="#fff" stroke-width="2" fill="none"/><path d="M22 20h20" stroke="#fff" stroke-width="3"/><path d="M24 16v8M28 16v8M32 16v8M36 16v8M40 16v8" stroke="#fff" stroke-width="2"/></svg>';

// ---------- ドロワー（右上☰から開く。ゲーム画面の上に重ねる） ----------
const Drawer = {
  el: null, keyOff: null, onClose: null,
  init() { this.el = document.getElementById('drawer'); document.getElementById('menuBtn').addEventListener('click', () => this.isOpen() ? this.close() : App.menu()); },
  isOpen() { return !this.el.classList.contains('hidden'); },
  show(node, onClose) {
    if (this.keyOff) { this.keyOff(); this.keyOff = null; }
    if (onClose !== undefined) this.onClose = onClose;
    this.el.innerHTML = ''; this.el.append(node); this.el.classList.remove('hidden');
    this.keyOff = Input.onKey(c => { if (c === 'Escape') this.close(); });
  },
  close() {
    if (!this.isOpen()) return;
    this.el.classList.add('hidden'); this.el.innerHTML = '';
    if (this.keyOff) { this.keyOff(); this.keyOff = null; }
    const f = this.onClose; this.onClose = null; if (f) f();
  },
};

const MenuUI = {
  // ---------- ログイン画面 ----------
  login(msg) {
    const last = Account.lastUser();
    let mode = 'login';
    const scr = U.el('div', { class: 'screen title' });
    const card = U.el('div', { class: 'logincard' });
    const render = err => {
      card.innerHTML = '';
      card.append(U.el('div', { class: 'tabs' }, [['login', 'ログイン'], ['reg', '新規アカウント作成']].map(([m, l]) => U.el('div', { class: 'tab' + (mode === m ? ' sel' : ''), onclick: () => { mode = m; render(); } }, l))));
      const name = U.el('input', { class: 'tin', placeholder: '表示名（例: Taro）', maxlength: 20 });
      const email = U.el('input', { class: 'tin', type: 'email', placeholder: 'メールアドレス', value: mode === 'login' && last ? last.email : '' });
      const pw = U.el('input', { class: 'tin', type: 'password', placeholder: 'パスワード（6文字以上）' });
      const go = U.el('button', { class: 'btn primary' }, mode === 'login' ? 'ログイン' : 'アカウントを作成');
      const submit = async () => {
        go.disabled = true;
        const e = mode === 'login' ? await Account.login(email.value, pw.value) : await Account.register(name.value, email.value, pw.value);
        go.disabled = false;
        if (e) return render(e);
        App.afterLogin();
      };
      go.onclick = submit; [name, email, pw].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
      if (mode === 'reg') card.append(name);
      card.append(email, pw);
      if (err) card.append(U.el('div', { class: 'err' }, err));
      card.append(go);
      card.append(U.el('div', { class: 'or' }, U.el('span', null, 'または')));
      card.append(U.el('button', { class: 'btn gbtn', onclick: () => render('Googleログインはサーバー（Firebase等）との連携が必要なため、現在は使えません。メールアドレスでのアカウント作成かゲストをご利用ください。') },
        U.el('span', { class: 'g' }, 'G'), 'Googleでログイン', U.el('small', { class: 'soon' }, '要サーバー設定')));
      card.append(U.el('button', { class: 'btn', style: 'justify-content:center', onclick: () => { Account.guest(); App.afterLogin(); } }, 'ゲストとしてプレイ'));
      card.append(U.el('div', { class: 'muted', style: 'text-align:center;margin-top:6px' }, 'アカウントとセーブデータはこのPCのブラウザに保存されます（メニューから書き出し・読み込み可）'));
      if (mode === 'login' && !err) setTimeout(() => (email.value ? pw : email).focus(), 30);
    };
    render(msg);
    scr.append(U.el('div', { class: 'logo', html: FOOTBALL_SVG }), U.el('h1', null, 'GRIDIRON 26'), U.el('div', { class: 'sub' }, 'AMERICAN FOOTBALL SIMULATION'),
      last ? U.el('button', { class: 'btn primary', style: 'min-width:300px;margin-bottom:14px', onclick: () => { mode = 'login'; render(); } }, `${last.name} でログイン`) : '', card);
    UI.show(scr);
  },

  // ---------- ☰メニュー ----------
  build(items, title) {
    const panel = U.el('div', { class: 'drawerpanel' }, U.el('div', { class: 'dhead' }, U.el('b', null, title || 'MENU'), U.el('button', { class: 'btn small', onclick: () => Drawer.close() }, '✕')));
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { panel.append(U.el('div', { class: 'dsep' }, it.sep)); continue; }
      panel.append(U.el('button', { class: 'btn' + (it.danger ? ' danger' : '') + (it.primary ? ' primary' : ''), onclick: it.f }, it.icon ? U.el('span', { class: 'mi' }, it.icon) : '', U.el('div', null, it.l, it.sub ? U.el('small', null, it.sub) : '')));
    }
    return U.el('div', { class: 'drawerwrap', onclick: e => { if (e.target.classList.contains('drawerwrap')) Drawer.close(); } }, panel);
  },
  // 設定（タイトル・試合中どちらでも）
  settingsNode(onBack) {
    const S = App.settings;
    const seg = (key, opts, fmt) => {
      const box = U.el('div', { class: 'seg' });
      const render = () => { box.innerHTML = ''; opts.forEach(v => box.append(U.el('button', { class: S[key] === v ? 'on' : '', onclick: () => { S[key] = v; App.saveSettings(); SFX.click(); render(); } }, fmt(v)))); };
      render(); return box;
    };
    const row = (label, sub, ctl) => U.el('div', { class: 'setrow' }, U.el('label', null, label, U.el('small', null, sub)), ctl);
    return U.el('div', { class: 'screen overlay' },
      U.el('button', { class: 'btn small back', onclick: onBack }, '← 戻る'), U.el('h2', null, '設定'),
      U.el('div', { class: 'settings' },
        row('試合のスピード', 'プレー中の動きの速さ（ゆっくりほど状況を把握しやすい）', seg('pace', [0.7, 0.85, 1], v => ({ 0.7: 'ゆっくり', 0.85: '標準', 1: 'リアル' })[v])),
        row('クォーターの長さ', '試合時計（次の試合から反映）', seg('qlen', [3, 5, 8, 15], v => v + '分')),
        row('難易度', 'CPUの能力・判断の強さ（次の試合から反映）', seg('diff', [0, 1, 2], v => DIFF_JP[v])),
        row('操作アシスト', 'キーを押していない間はAIが自動で動かす', seg('assist', [true, false], v => v ? 'オン' : 'オフ')),
        row('守備のオート切替', 'パスやハンドオフの瞬間にボールに近い選手へ自動で切替', seg('autoSwitch', [true, false], v => v ? 'オン' : 'オフ')),
        row('反則の頻度', 'ホールディング・オフサイド等', seg('pen', [0, 0.6, 1, 1.5], v => ({ 0: 'なし', 0.6: '少', 1: '標準', 1.5: '多' })[v])),
        row('試合前のルールブック', '試合開始前に操作方法・ルールを表示', seg('showRules', [true, false], v => v ? '表示する' : '表示しない')),
        row('サウンド', '効果音と観客の歓声', seg('vol', [0, 0.4, 0.7, 1], v => v ? Math.round(v * 100) + '%' : 'オフ'))));
  },
  // ---------- ルールブック ----------
  rulebookNode(onBack, gate) {
    const K = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join('');
    const chapters = [
      ['はじめに', `<p>アメリカンフットボールは<b>11人対11人</b>で陣地を奪い合うスポーツ。ボールを持って相手の<b>エンドゾーン</b>に入ればタッチダウン（6点）です。</p>
        <svg viewBox="0 0 600 170" class="rbsvg"><rect x="0" y="0" width="600" height="170" fill="#2e7a31"/><rect x="0" y="0" width="50" height="170" fill="#c8102e"/><rect x="550" y="0" width="50" height="170" fill="#00338d"/>
        ${Array.from({ length: 11 }, (_, i) => `<line x1="${50 + i * 50}" y1="0" x2="${50 + i * 50}" y2="170" stroke="#fff" stroke-width="${i % 10 ? 1.5 : 3}"/>`).join('')}
        <line x1="250" y1="0" x2="250" y2="170" stroke="#4aa3ff" stroke-width="4"/><line x1="300" y1="0" x2="300" y2="170" stroke="#ffd400" stroke-width="4"/>
        <text x="25" y="90" fill="#fff" font-size="13" text-anchor="middle" transform="rotate(-90 25 90)">エンドゾーン</text><text x="575" y="90" fill="#fff" font-size="13" text-anchor="middle" transform="rotate(90 575 90)">エンドゾーン</text>
        <text x="252" y="160" fill="#9fd0ff" font-size="12">スクリメージライン（青）</text><text x="302" y="20" fill="#ffd400" font-size="12">ファーストダウンライン（黄）</text>
        <path d="M250 85 L330 85" stroke="#fff" stroke-width="3" marker-end="url(#ar)"/><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#fff"/></marker></defs></svg>
        <p>攻撃側は<b>4回の攻撃（ダウン）</b>のうちに<b>10ヤード</b>進めば、また新しく4回の攻撃権がもらえます（ファーストダウン）。進めなければ攻守交代。4回目はパントで陣地を下げるか、FGを狙うのが一般的です。</p>`],
      ['得点', `<table class="tbl"><tr><td>タッチダウン</td><td><b>6点</b>：ボールを持ってエンドゾーンに入る／エンドゾーンでパスを捕る</td></tr><tr><td>PAT（トライ）</td><td>TD後に <b>キックで1点</b>、または2ヤード地点からのプレーで<b>2点</b></td></tr><tr><td>フィールドゴール</td><td><b>3点</b>：ゴールポストの間をキックで通す</td></tr><tr><td>セーフティ</td><td><b>2点</b>：攻撃側が自陣エンドゾーンで倒される</td></tr></table>`],
      ['時計・タイムアウト', `<p>各クォーターの時計はプレー中に進み、<b>パス失敗・アウトオブバウンズ（終盤）・得点・攻守交代・タイムアウト</b>で止まります。前半・後半の残り2分で<b>2ミニッツ・ウォーニング</b>。各チーム前後半に<b>3回のタイムアウト</b>（${K('T')}）。プレー選択には40秒のプレークロックがあり、過ぎると反則（ディレイ・オブ・ゲーム）です。</p>`],
      ['キック', `<p><b>キックオフ</b>（2025年ルール）：エンドゾーンに蹴り込むと35ヤードからのタッチバック。ランディングゾーン（20ヤード線より奥）に届かないと40ヤードから。<br><b>パント</b>：4th downで陣地を下げる。リターナーは ${K('F')} でフェアキャッチ。<br><b>フィールドゴール</b>：距離＝ボール位置＋17ヤード。<br>キック操作は ${K('W S')} で方向 → ${K('Space')} 3回（パワー開始 → パワー決定 → 精度）。</p>`],
      ['主な反則', `<table class="tbl"><tr><td>フォルススタート</td><td>攻撃・5ヤード</td></tr><tr><td>オフサイド</td><td>守備・5ヤード</td></tr><tr><td>ディレイ・オブ・ゲーム</td><td>攻撃・5ヤード（プレークロック切れ）</td></tr><tr><td>ホールディング</td><td>攻撃10ヤード／守備5ヤード＋ファーストダウン</td></tr><tr><td>パスインターフェア</td><td>守備・反則地点から＋ファーストダウン</td></tr><tr><td>フェイスマスク</td><td>15ヤード</td></tr></table><p>反則の「受諾・辞退」は、反則された側に有利な方を自動で選びます。</p>`],
      ['操作：オフェンス', `<table class="tbl"><tr><td>${K('W A S D')} / 矢印</td><td>移動（${K('Shift')} でダッシュ）</td></tr><tr><td>${K('Space')}</td><td>スナップ（選手がセットしてから）</td></tr>
        <tr><td>${K('1')}〜${K('5')} タップ</td><td>その番号のレシーバーへ自動でパス</td></tr><tr><td>${K('1')}〜${K('5')} 長押し</td><td><b>カーブの矢印</b>が出る。押したまま ${K('W')}/${K('S')} で落下地点を<b>前後</b>に動かし（遠いほど高い弾道）、離すと投げる</td></tr>
        <tr><td>マウス</td><td>フィールド上にカーソルを置くと矢印が出る。<b>クリックでその地点へパス</b></td></tr><tr><td>${K('Q')} ${K('E')} / ホイール</td><td>弾道を高く（ロブ）／低く（弾丸）</td></tr><tr><td>${K('R')}</td><td>投げ捨て</td></tr>
        <tr><td>ボールを持ったら</td><td>${K('J')} ジューク ／ ${K('K')} スピン ／ ${K('L')} トラック ／ ${K('Space')} ダイブ</td></tr></table><p>矢印が<b style="color:#4dff9a">緑</b>なら味方レシーバーが届く位置です。</p>`],
      ['操作：ディフェンス', `<table class="tbl"><tr><td>${K('Tab')} / ${K('Space')}</td><td>選手切替（<b style="color:#9fd8ff">青い点線の輪「TAB」</b>の選手に切り替わる）</td></tr><tr><td>マウスクリック</td><td>クリックした味方選手に切替</td></tr><tr><td>オート切替</td><td>パス・ハンドオフの瞬間にボールに近い選手へ自動で切替（設定でオフ可）</td></tr><tr><td>${K('J')}</td><td>ダイブタックル</td></tr><tr><td>${K('K')}</td><td>ジャンプしてパスカット</td></tr></table><p>キーを離している間はAIが担当します（アシスト）。</p>`],
      ['メニュー・その他', `<p>右上の <b>☰</b>（または ${K('Esc')}）でいつでもメニュー：再開・設定・ルールブック・タイムアウト・試合をやめる（キャリアでは中断／棄権）。<br>プレー後は結果カードが出ます。${K('Enter')} で次へ進めます。<br>試合のスピードは設定の「試合のスピード」で変えられます。<br>個人モードで自分が出ていない場面は ${K('Enter')} 長押しで早送り。</p>`],
    ];
    let ci = 0;
    const body = U.el('div', { class: 'rbbody' }), tabs = U.el('div', { class: 'tabs' });
    const render = () => {
      tabs.innerHTML = ''; chapters.forEach(([t], i) => tabs.append(U.el('div', { class: 'tab' + (i === ci ? ' sel' : ''), onclick: () => { ci = i; render(); } }, t)));
      body.innerHTML = `<h3>${chapters[ci][0]}</h3>` + chapters[ci][1];
    };
    render();
    const foot = U.el('div', { class: 'row', style: 'margin-top:12px' });
    if (gate) {
      const cb = U.el('input', { type: 'checkbox', id: 'rbskip' });
      foot.append(U.el('label', { class: 'chk' }, cb, ' 次回から試合前に表示しない'),
        U.el('button', { class: 'btn primary', onclick: () => { if (cb.checked) { App.settings.showRules = false; App.saveSettings(); } gate(); } }, '試合を開始 →'));
    }
    foot.append(U.el('button', { class: 'btn small', onclick: () => { ci = Math.max(0, ci - 1); render(); } }, '← 前'), U.el('button', { class: 'btn small', onclick: () => { ci = Math.min(chapters.length - 1, ci + 1); render(); } }, '次 →'));
    return U.el('div', { class: 'screen overlay' },
      onBack ? U.el('button', { class: 'btn small back', onclick: onBack }, '← 戻る') : '',
      U.el('div', { class: 'rbtitle', html: FOOTBALL_SVG + '<span>ルールブック・操作方法</span>' }), tabs, U.el('div', { class: 'rbook' }, body), foot);
  },
};
