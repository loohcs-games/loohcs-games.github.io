'use strict';
// ===== 攻撃フォーメーション =====
// 座標: [ox, l]  ox=LOSからの前後（負=バックフィールド）, l=横（正=オフェンスから見て左）
const OL_SET = { LT: [-0.9, 2.7], LG: [-0.8, 1.35], C: [-0.6, 0], RG: [-0.8, -1.35], RT: [-0.9, -2.7] };
const OFF_FORMS = {
  shotgun:   { name: 'ショットガン', s: { QB: [-5, 0], RB: [-5, -1.6], WR1: [-0.8, 19], WR2: [-0.8, -19], WR3: [-1.5, 10], TE1: [-0.9, -3.9] } },
  gun_trips: { name: 'ショットガン トリップス', s: { QB: [-5, 0], RB: [-5, 1.6], WR1: [-0.8, -19], WR2: [-1.5, -13.5], WR3: [-1.5, -8], TE1: [-0.9, 3.9] } },
  gun_empty: { name: 'ショットガン エンプティ', s: { QB: [-5, 0], WR1: [-0.8, 19], WR2: [-0.8, -19], WR3: [-1.5, 11], TE1: [-1.5, -11], RB: [-1.5, 6] } },
  singleback:{ name: 'シングルバック', s: { QB: [-1.2, 0], RB: [-7, 0], WR1: [-0.8, 18], WR2: [-0.8, -18], WR3: [-1.5, 10], TE1: [-0.9, -3.9] } },
  iform:     { name: 'I フォーメーション', s: { QB: [-1.2, 0], FB: [-4.3, 0], RB: [-7.3, 0], WR1: [-0.8, 18], WR2: [-0.8, -18], TE1: [-0.9, -3.9] } },
  pistol:    { name: 'ピストル', s: { QB: [-4, 0], RB: [-7, 0], WR1: [-0.8, 18], WR2: [-0.8, -18], WR3: [-1.5, 10], TE1: [-0.9, -3.9] } },
  goalline:  { name: 'ゴールライン', s: { QB: [-1.2, 0], FB: [-4, 0], RB: [-6.8, 0], TE1: [-0.9, -3.9], TE2: [-0.9, 3.9], WR1: [-0.8, 12] } },
  victory:   { name: 'ビクトリー', s: { QB: [-1.2, 0], RB: [-8, 0], FB: [-3, 1.5], TE1: [-0.9, -3.9], TE2: [-0.9, 3.9], WR1: [-0.8, 12] } },
  punt:      { name: 'パント', s: { P: [-15, 0], RB: [-7, 0.8], WR1: [-0.8, 22], WR2: [-0.8, -22], TE1: [-1.6, -4.4], TE2: [-1.6, 4.4] } },
  fg:        { name: 'フィールドゴール', s: { QB: [-7, 0], K: [-9.2, 1.6], TE1: [-0.9, -3.9], TE2: [-0.9, 3.9], RB: [-1.6, -5], WR3: [-1.6, 5] } },
};
for (const f in OFF_FORMS) Object.assign(OFF_FORMS[f].s, OL_SET);

// ===== ルート =====  pts: [前進, 内側方向] の連続点。cont=最後の方向に走り続ける
const ROUTES = {
  go: { pts: [[38, 0]], cont: 1 }, fade: { pts: [[30, -3]], cont: 1 }, seam: { pts: [[30, 1.5]], cont: 1 },
  slant: { pts: [[1.5, 0], [8, 5]], cont: 1 }, quick_out: { pts: [[5, 0], [5.5, -6]], cont: 1 },
  out: { pts: [[10, 0], [10, -8]], cont: 1 }, dig: { pts: [[12, 0], [12, 12]], cont: 1 },
  post: { pts: [[12, 0], [32, 9]], cont: 1 }, corner: { pts: [[12, 0], [25, -9]], cont: 1 },
  curl: { pts: [[12, 0], [10.5, 1.5]], cont: 0 }, comeback: { pts: [[15, 0], [12.5, -3]], cont: 0 },
  hitch: { pts: [[6, 0], [5, 0.3]], cont: 0 }, stick: { pts: [[6, 0], [6, 2]], cont: 0 },
  drag: { pts: [[2, 0], [4, 18]], cont: 1 }, cross: { pts: [[8, 0], [13, 20]], cont: 1 },
  flat: { pts: [[1, -1], [3, -8]], cont: 1 }, wheel: { pts: [[1, -4], [5, -7], [30, -7]], cont: 1 },
  angle: { pts: [[2, -3], [5, 2], [6, 6]], cont: 0 }, swing: { pts: [[-1, -4], [1, -9]], cont: 1 },
  screen: { pts: [[-2.5, -4]], cont: 0, screen: 1 }, bubble: { pts: [[-1.5, -2], [-1, -4]], cont: 0, screen: 1 },
  check: { pts: [[1, -1], [3, -8]], cont: 1, delay: 1.3 }, deep_out: { pts: [[16, 0], [16, -8]], cont: 1 },
};
const ROUTE_JP = { go: 'ゴー', fade: 'フェード', seam: 'シーム', slant: 'スラント', quick_out: 'クイックアウト', out: 'アウト', dig: 'ディグ', post: 'ポスト',
  corner: 'コーナー', curl: 'カール', comeback: 'カムバック', hitch: 'ヒッチ', stick: 'スティック', drag: 'ドラッグ', cross: 'クロス', flat: 'フラット',
  wheel: 'ホイール', angle: 'アングル', swing: 'スイング', screen: 'スクリーン', bubble: 'バブル', check: 'チェック&リリース', deep_out: 'ディープアウト', block: 'ブロック' };

// ===== ラン =====  path: [ox, l]（フォーメーション座標）、hand: ハンドオフ時刻
const RUNS = {
  inside_zone: { path: [[-4.6, -0.6], [1, -1.6], [9, -2]], hand: 0.55 },
  outside_zone: { path: [[-4.4, -2.4], [-1.2, -6], [3, -9], [12, -10]], hand: 0.6 },
  power: { path: [[-4.5, 0.4], [1, -2.6], [10, -3]], hand: 0.6 },
  counter: { path: [[-5.2, 1.6], [-4.2, -0.8], [1, -3.6], [10, -4]], hand: 0.75 },
  draw: { path: [[-5.2, 0], [2, 0], [10, 0.5]], hand: 1.25 },
  toss: { path: [[-6, -4], [-2.2, -8.5], [3, -10], [12, -10.5]], hand: 0.35, toss: 1 },
  dive: { path: [[-2.5, 0.3], [2, 0.6], [6, 0.6]], hand: 0.45 },
  gun_zone: { path: [[-4.6, 0.6], [1, -1.2], [9, -1.6]], hand: 0.5 },
  gun_stretch: { path: [[-4.2, -3], [-0.5, -7.5], [4, -10], [12, -10]], hand: 0.5 },
  qb_sneak: { path: [[0.5, 0], [3, 0]], hand: 0, qb: 1 },
  qb_draw: { path: [[-5.4, 0], [-4.8, 0], [2, 0.4], [10, 0]], hand: 0, qb: 1, delay: 0.9 },
  kneel: { path: [[-2.2, 0]], hand: 0, qb: 1, kneel: 1 },
};

// ===== 攻撃プレー =====
// type: run / pass / pa(プレーアクション) / screen / punt / fg / kneel / spike
const OFF_PLAYS = [
  // ショットガン
  { id: 'g_4v', n: 'フォー・バーティカル', f: 'shotgun', t: 'pass', r: { WR1: 'go', WR2: 'go', WR3: 'seam', TE1: 'seam', RB: 'check' } },
  { id: 'g_mesh', n: 'メッシュ', f: 'shotgun', t: 'pass', r: { WR1: 'post', WR2: 'curl', WR3: 'drag', TE1: 'drag', RB: 'flat' } },
  { id: 'g_slfl', n: 'スラント・フラット', f: 'shotgun', t: 'pass', r: { WR1: 'slant', WR2: 'slant', WR3: 'quick_out', TE1: 'block', RB: 'check' } },
  { id: 'g_smash', n: 'スマッシュ', f: 'shotgun', t: 'pass', r: { WR1: 'hitch', WR2: 'post', WR3: 'corner', TE1: 'stick', RB: 'block' } },
  { id: 'g_cufl', n: 'カール・フラット', f: 'shotgun', t: 'pass', r: { WR1: 'curl', WR2: 'curl', WR3: 'flat', TE1: 'dig', RB: 'block' } },
  { id: 'g_dagger', n: 'ダガー', f: 'shotgun', t: 'pass', r: { WR1: 'dig', WR2: 'comeback', WR3: 'seam', TE1: 'block', RB: 'check' } },
  { id: 'g_hbscr', n: 'HBスクリーン', f: 'shotgun', t: 'screen', r: { WR1: 'go', WR2: 'go', WR3: 'go', TE1: 'block', RB: 'screen' } },
  { id: 'g_iz', n: 'ガン・インサイドゾーン', f: 'shotgun', t: 'run', run: 'gun_zone', c: 'RB' },
  { id: 'g_str', n: 'ガン・ストレッチ', f: 'shotgun', t: 'run', run: 'gun_stretch', c: 'RB' },
  { id: 'g_qbd', n: 'QBドロー', f: 'shotgun', t: 'run', run: 'qb_draw', c: 'QB' },
  // トリップス
  { id: 't_flood', n: 'トリップス・フラッド', f: 'gun_trips', t: 'pass', r: { WR1: 'go', WR2: 'deep_out', WR3: 'flat', TE1: 'drag', RB: 'check' } },
  { id: 't_ycross', n: 'Yクロス', f: 'gun_trips', t: 'pass', r: { WR1: 'go', WR2: 'post', WR3: 'curl', TE1: 'cross', RB: 'flat' } },
  { id: 't_bubble', n: 'バブルスクリーン', f: 'gun_trips', t: 'screen', r: { WR1: 'block', WR2: 'block', WR3: 'bubble', TE1: 'block', RB: 'block' } },
  { id: 't_spot', n: 'スナッグ', f: 'gun_trips', t: 'pass', r: { WR1: 'corner', WR2: 'stick', WR3: 'flat', TE1: 'seam', RB: 'block' } },
  // エンプティ
  { id: 'e_quick', n: 'エンプティ・クイック', f: 'gun_empty', t: 'pass', r: { WR1: 'slant', WR2: 'hitch', WR3: 'stick', TE1: 'quick_out', RB: 'hitch' } },
  { id: 'e_deep', n: 'エンプティ・ディープ', f: 'gun_empty', t: 'pass', r: { WR1: 'post', WR2: 'corner', WR3: 'dig', TE1: 'seam', RB: 'wheel' } },
  { id: 'e_hail', n: 'ヘイルメリー', f: 'gun_empty', t: 'pass', r: { WR1: 'go', WR2: 'go', WR3: 'seam', TE1: 'seam', RB: 'go' }, hail: 1 },
  // シングルバック
  { id: 's_iz', n: 'インサイドゾーン', f: 'singleback', t: 'run', run: 'inside_zone', c: 'RB' },
  { id: 's_oz', n: 'アウトサイドゾーン', f: 'singleback', t: 'run', run: 'outside_zone', c: 'RB' },
  { id: 's_ctr', n: 'カウンター', f: 'singleback', t: 'run', run: 'counter', c: 'RB' },
  { id: 's_draw', n: 'HBドロー', f: 'singleback', t: 'run', run: 'draw', c: 'RB' },
  { id: 's_pa', n: 'PAディープショット', f: 'singleback', t: 'pa', run: 'inside_zone', r: { WR1: 'go', WR2: 'post', WR3: 'cross', TE1: 'flat', RB: 'block' } },
  { id: 's_digp', n: 'ディグ・ポスト', f: 'singleback', t: 'pass', r: { WR1: 'dig', WR2: 'post', WR3: 'hitch', TE1: 'seam', RB: 'check' } },
  { id: 's_outs', n: 'ダブルアウト', f: 'singleback', t: 'pass', r: { WR1: 'out', WR2: 'out', WR3: 'slant', TE1: 'curl', RB: 'flat' } },
  // I フォーメーション
  { id: 'i_power', n: 'パワーO', f: 'iform', t: 'run', run: 'power', c: 'RB' },
  { id: 'i_dive', n: 'HBダイブ', f: 'iform', t: 'run', run: 'dive', c: 'RB' },
  { id: 'i_toss', n: 'トス・スイープ', f: 'iform', t: 'run', run: 'toss', c: 'RB' },
  { id: 'i_iz', n: 'I・ゾーン', f: 'iform', t: 'run', run: 'inside_zone', c: 'RB' },
  { id: 'i_pa', n: 'PAクロス', f: 'iform', t: 'pa', run: 'power', r: { WR1: 'cross', WR2: 'post', TE1: 'corner', FB: 'flat', RB: 'block' } },
  { id: 'i_pab', n: 'PAブーツ', f: 'iform', t: 'pa', run: 'outside_zone', r: { WR1: 'go', WR2: 'dig', TE1: 'flat', FB: 'block', RB: 'block' } },
  // ピストル
  { id: 'p_zone', n: 'ピストル・ゾーン', f: 'pistol', t: 'run', run: 'inside_zone', c: 'RB' },
  { id: 'p_oz', n: 'ピストル・スイープ', f: 'pistol', t: 'run', run: 'outside_zone', c: 'RB' },
  { id: 'p_pa', n: 'ピストルPAポスト', f: 'pistol', t: 'pa', run: 'inside_zone', r: { WR1: 'post', WR2: 'curl', WR3: 'corner', TE1: 'drag', RB: 'block' } },
  { id: 'p_sl', n: 'ピストル・スラント', f: 'pistol', t: 'pass', r: { WR1: 'slant', WR2: 'slant', WR3: 'hitch', TE1: 'flat', RB: 'block' } },
  // ゴールライン
  { id: 'gl_sneak', n: 'QBスニーク', f: 'goalline', t: 'run', run: 'qb_sneak', c: 'QB' },
  { id: 'gl_dive', n: 'GL・ダイブ', f: 'goalline', t: 'run', run: 'dive', c: 'RB' },
  { id: 'gl_power', n: 'GL・パワー', f: 'goalline', t: 'run', run: 'power', c: 'RB' },
  { id: 'gl_pa', n: 'GL・PA TEフラット', f: 'goalline', t: 'pa', run: 'dive', r: { TE1: 'flat', TE2: 'corner', WR1: 'fade', FB: 'flat', RB: 'block' } },
  // スペシャル
  { id: 'punt', n: 'パント', f: 'punt', t: 'punt', sp: 1 },
  { id: 'fg', n: 'フィールドゴール', f: 'fg', t: 'fg', sp: 1 },
  { id: 'kneel', n: 'ニーダウン', f: 'victory', t: 'kneel', run: 'kneel', c: 'QB', sp: 1 },
  { id: 'spike', n: 'スパイク', f: 'singleback', t: 'spike', sp: 1 },
];
const OFF_GROUPS = [
  { id: 'shotgun', n: 'ショットガン', forms: ['shotgun', 'gun_trips', 'gun_empty'] },
  { id: 'under', n: 'シングルバック', forms: ['singleback'] },
  { id: 'iform', n: 'I / ピストル', forms: ['iform', 'pistol'] },
  { id: 'gl', n: 'ゴールライン', forms: ['goalline'] },
  { id: 'sp', n: 'スペシャル', forms: ['punt', 'fg', 'victory', 'spike'] },
];

// ===== 守備 =====  [深さ, l]
const DEF_FORMS = {
  '43': { name: '4-3', s: { DE1: [1, 4.3], DT1: [1, 1.0], DT2: [1, -1.2], DE2: [1, -4.4], LB1: [5, 4.4], LB2: [5.5, 0], LB3: [5, -4.4], CB1: 'W+', CB2: 'W-', S1: [12, 9], S2: [12, -9] } },
  nickel: { name: 'ニッケル', s: { DE1: [1, 4.3], DT1: [1, 1.0], DT2: [1, -1.2], DE2: [1, -4.4], LB1: [5, 2.6], LB2: [5, -2.6], CB1: 'W+', CB2: 'W-', CB3: 'SL', S1: [12, 9], S2: [12, -9] } },
  dime: { name: 'ダイム', s: { DE1: [1, 4.3], DT1: [1, 1.0], DT2: [1, -1.2], DE2: [1, -4.4], LB2: [6, 0], CB1: 'W+', CB2: 'W-', CB3: 'SL', CB4: 'SL', S1: [13, 9], S2: [13, -9] } },
  goalline: { name: 'ゴールライン', s: { DE1: [0.8, 4.6], DT1: [0.8, 1.4], DT2: [0.8, -1.4], DE2: [0.8, -4.6], LB1: [3, 3.6], LB2: [3, 0], LB3: [3, -3.6], LB4: [3, 7], CB1: 'W+', CB2: 'W-', S1: [5, -7] } },
};
const COV_JP = { c0: 'カバー0 マン', c1: 'カバー1 マン', c2: 'カバー2 ゾーン', c2m: '2マン・アンダー', c3: 'カバー3 ゾーン', c4: 'カバー4 クォーターズ', gl: 'ゴールライン マン' };
const DEF_PLAYS = [
  { id: 'd43_c2', n: '4-3 カバー2', f: '43', cov: 'c2' },
  { id: 'd43_c3', n: '4-3 カバー3', f: '43', cov: 'c3' },
  { id: 'd43_c1', n: '4-3 カバー1', f: '43', cov: 'c1', press: 1 },
  { id: 'd43_c4', n: '4-3 カバー4', f: '43', cov: 'c4' },
  { id: 'd43_mb', n: 'ミドルブリッツ', f: '43', cov: 'c1', blitz: ['LB2'] },
  { id: 'd43_c0', n: 'カバー0 オールアウト', f: '43', cov: 'c0', blitz: ['LB1', 'LB3', 'S2'], press: 1 },
  { id: 'd43_box', n: '8人ボックス（ラン止め）', f: '43', cov: 'c3', box: 1, blitz: ['LB3'] },
  { id: 'dn_c2', n: 'ニッケル カバー2', f: 'nickel', cov: 'c2' },
  { id: 'dn_c3', n: 'ニッケル カバー3', f: 'nickel', cov: 'c3' },
  { id: 'dn_c1', n: 'ニッケル カバー1', f: 'nickel', cov: 'c1', press: 1 },
  { id: 'dn_c2m', n: 'ニッケル 2マン', f: 'nickel', cov: 'c2m', press: 1 },
  { id: 'dn_sb', n: 'スロットブリッツ', f: 'nickel', cov: 'c3', blitz: ['CB3'] },
  { id: 'dn_c4', n: 'ニッケル カバー4', f: 'nickel', cov: 'c4' },
  { id: 'dd_prev', n: 'ダイム プリベント', f: 'dime', cov: 'c4', deep: 1 },
  { id: 'dd_c1', n: 'ダイム カバー1', f: 'dime', cov: 'c1' },
  { id: 'dd_blz', n: 'ダイム ゼロブリッツ', f: 'dime', cov: 'c0', blitz: ['LB2', 'S2'], press: 1 },
  { id: 'dg_man', n: 'GL マン', f: 'goalline', cov: 'gl' },
  { id: 'dg_blz', n: 'GL オールブリッツ', f: 'goalline', cov: 'gl', blitz: ['LB1', 'LB2', 'LB3'] },
];
const DEF_GROUPS = [
  { id: '43', n: '4-3', forms: ['43'] }, { id: 'nickel', n: 'ニッケル', forms: ['nickel'] },
  { id: 'dime', n: 'ダイム', forms: ['dime'] }, { id: 'gl', n: 'ゴールライン', forms: ['goalline'] },
];
// キックオフ時の選択肢
const KICK_PLAYS = [
  { id: 'ko_norm', n: '通常キックオフ', t: 'kickoff' },
  { id: 'ko_side', n: 'オンサイドキック', t: 'onside' },
];
const RET_PLAYS = [{ id: 'kr_norm', n: 'キックリターン', t: 'kr' }];
const PR_PLAYS = [{ id: 'pr_ret', n: 'パントリターン', t: 'pr' }, { id: 'pr_blk', n: 'パントブロック', t: 'prb' }];
const FGD_PLAYS = [{ id: 'fg_blk', n: 'FGブロック', t: 'fgb' }];
const TRY_PLAYS = [
  { id: 'pat', n: 'PAT（1点キック）', f: 'fg', t: 'fg', sp: 1, pat: 1 },
  ...['gl_power', 'gl_pa', 'g_slfl', 'g_mesh', 't_spot', 'g_qbd'].map(id => Object.assign({}, OFF_PLAYS.find(p => p.id === id), { two: 1 })),
];
const PLAY_BY_ID = {}; [...OFF_PLAYS, ...DEF_PLAYS, ...KICK_PLAYS, ...RET_PLAYS, ...PR_PLAYS, ...FGD_PLAYS, ...TRY_PLAYS.slice(0, 1)].forEach(p => PLAY_BY_ID[p.id] = p);
const playType = p => p.t === 'pa' ? 'プレーアクション' : p.t === 'run' ? 'ラン' : p.t === 'pass' ? 'パス' : p.t === 'screen' ? 'スクリーン' : p.cov ? COV_JP[p.cov] : 'スペシャル';
