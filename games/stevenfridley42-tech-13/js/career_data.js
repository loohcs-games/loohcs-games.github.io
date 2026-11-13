'use strict';
// ===== キャリアモード: 定数データ =====
const CAREER_START_YEAR = 2026;
// ポジション → 体格の目安 [身長min, 標準, max](cm), [体重min, 標準, max](kg)
const BODY = {
  QB: [[180, 191, 201], [93, 102, 113]], RB: [[168, 180, 191], [84, 97, 106]], WR: [[170, 185, 201], [78, 91, 102]],
  TE: [[188, 196, 203], [107, 113, 122]], OL: [[188, 196, 206], [134, 143, 159]], DE: [[188, 194, 203], [111, 121, 129]],
  DT: [[185, 191, 198], [134, 141, 159]], LB: [[183, 188, 196], [102, 109, 118]], CB: [[173, 183, 193], [81, 88, 95]],
  S: [[178, 185, 193], [86, 93, 100]], K: [[175, 185, 193], [80, 90, 100]], P: [[180, 188, 196], [86, 96, 104]],
};
const CAREER_POS = [
  ['QB', 'クォーターバック'], ['RB', 'ランニングバック'], ['WR', 'ワイドレシーバー'], ['TE', 'タイトエンド'], ['OL', 'オフェンシブライン'],
  ['DE', 'ディフェンシブエンド（エッジ）'], ['DT', 'ディフェンシブタックル'], ['LB', 'ラインバッカー'], ['CB', 'コーナーバック'], ['S', 'セーフティ'],
  ['K', 'キッカー'], ['P', 'パンター'],
];
const OL_SLOTS = [['LT', 'レフトタックル'], ['LG', 'レフトガード'], ['C', 'センター'], ['RG', 'ライトガード'], ['RT', 'ライトタックル']];
// アーキタイプ（能力値の差分）
const ARCH = {
  QB: [['ポケットパサー', { thp: 4, tha: 6, awr: 4, spd: -6, elu: -4 }], ['デュアルスレット', { spd: 8, acc: 5, elu: 6, tha: -4, awr: -2 }], ['キャノンアーム', { thp: 9, tha: -2, str: 2 }], ['フィールドジェネラル', { awr: 9, tha: 3, thp: -3 }]],
  RB: [['パワーバック', { str: 8, car: 4, spd: -4, agi: -3 }], ['エルーシブ', { agi: 6, elu: 7, str: -5 }], ['スピードバック', { spd: 7, acc: 5, str: -4, car: -2 }], ['レシービングバック', { cat: 9, agi: 2, str: -4 }]],
  WR: [['ディープスレット', { spd: 8, acc: 3, cat: -3, str: -3 }], ['ポゼッション', { cat: 7, awr: 4, spd: -4 }], ['スロット', { agi: 7, acc: 4, str: -4 }], ['レッドゾーン', { str: 6, cat: 4, spd: -4, agi: -3 }]],
  TE: [['ブロッキング', { blk: 9, str: 4, cat: -5, spd: -3 }], ['バーティカル', { spd: 6, cat: 4, blk: -6 }], ['ハイブリッド', { cat: 3, blk: 3 }]],
  OL: [['パスプロテクター', { blk: 6, agi: 4, str: -3 }], ['ロードグレーダー', { str: 8, blk: 3, agi: -4 }], ['アジャイル', { spd: 6, acc: 5, agi: 4, str: -5 }]],
  DE: [['スピードラッシャー', { spd: 6, acc: 6, prs: 4, str: -5 }], ['パワーラッシャー', { str: 8, prs: 3, spd: -4 }], ['ランストッパー', { tak: 7, str: 4, prs: -4 }]],
  DT: [['パワーラッシャー', { str: 7, prs: 4, spd: -3 }], ['ノーズタックル', { str: 9, tak: 4, prs: -4, spd: -4 }], ['3テクニック', { acc: 6, prs: 5, str: -4 }]],
  LB: [['フィールドジェネラル', { awr: 7, tak: 4, spd: -3 }], ['パスカバー', { cov: 8, spd: 3, str: -5 }], ['パスラッシュ', { prs: 9, str: 3, cov: -6 }], ['ランストッパー', { tak: 8, str: 4, cov: -5 }]],
  CB: [['マンカバー', { cov: 6, spd: 4, awr: -3 }], ['ゾーン', { awr: 7, cat: 4, spd: -3 }], ['スロット', { agi: 7, acc: 5, str: -4 }]],
  S: [['ゾーン', { cov: 6, awr: 5, tak: -3 }], ['ハードヒッター', { tak: 7, str: 5, cov: -5 }], ['ハイブリッド', { cov: 3, tak: 3 }]],
  K: [['パワー', { kpw: 7, kac: -4 }], ['アキュラシー', { kac: 7, kpw: -4 }]],
  P: [['パワー', { kpw: 7, kac: -4 }], ['アキュラシー', { kac: 7, kpw: -4 }]],
};
const ATTR_JP = { spd: 'スピード', acc: '加速', agi: '敏捷性', str: 'パワー', cat: 'キャッチ', thp: 'パス強さ', tha: 'パス精度', tak: 'タックル', blk: 'ブロック',
  cov: 'カバー', prs: 'パスラッシュ', awr: '判断力', kpw: 'キック力', kac: 'キック精度', car: 'ボール保持', elu: '回避力' };
// ポジションで上げられる能力（育成画面に出す）
const POS_ATTRS = {
  QB: ['thp', 'tha', 'awr', 'spd', 'acc', 'agi', 'elu', 'car'], RB: ['spd', 'acc', 'agi', 'elu', 'str', 'car', 'cat', 'blk', 'awr'],
  WR: ['spd', 'acc', 'agi', 'cat', 'elu', 'str', 'car', 'awr'], TE: ['cat', 'blk', 'str', 'spd', 'acc', 'agi', 'car', 'awr'],
  OL: ['blk', 'str', 'acc', 'agi', 'awr'], DE: ['prs', 'tak', 'str', 'spd', 'acc', 'agi', 'awr'], DT: ['prs', 'tak', 'str', 'acc', 'spd', 'awr'],
  LB: ['tak', 'cov', 'prs', 'spd', 'acc', 'str', 'agi', 'awr'], CB: ['cov', 'spd', 'acc', 'agi', 'cat', 'tak', 'awr'], S: ['cov', 'tak', 'spd', 'acc', 'agi', 'cat', 'str', 'awr'],
  K: ['kpw', 'kac'], P: ['kpw', 'kac'],
};
// 総合力の重み
const OVR_W = {
  QB: { thp: .25, tha: .35, awr: .2, spd: .08, agi: .06, elu: .06 }, RB: { spd: .22, acc: .12, agi: .18, elu: .18, car: .12, str: .1, cat: .08 },
  WR: { spd: .25, cat: .3, agi: .15, acc: .1, elu: .1, str: .05, awr: .05 }, TE: { cat: .28, blk: .25, spd: .15, str: .15, agi: .07, awr: .1 },
  OL: { blk: .45, str: .35, awr: .1, agi: .05, acc: .05 }, DE: { prs: .35, str: .15, spd: .15, tak: .2, acc: .1, awr: .05 },
  DT: { prs: .3, str: .3, tak: .25, acc: .1, awr: .05 }, LB: { tak: .3, cov: .2, spd: .15, awr: .15, prs: .1, str: .1 },
  CB: { cov: .4, spd: .25, agi: .15, cat: .08, awr: .07, tak: .05 }, S: { cov: .3, tak: .2, spd: .2, awr: .15, cat: .1, agi: .05 },
  K: { kpw: .5, kac: .5 }, P: { kpw: .55, kac: .45 },
};
// 特殊スキル（ゲーム内で効果あり）
const SKILLS = [
  { id: 'speedster', n: 'スピードスター', d: '最高速度+2.5%', pos: ['QB', 'RB', 'WR', 'TE', 'CB', 'S', 'LB', 'DE'], lv: 1, cost: 8 },
  { id: 'hands', n: '確実なハンズ', d: '捕球率が大きく上がる', pos: ['RB', 'WR', 'TE'], lv: 1, cost: 8 },
  { id: 'contested', n: '競り合いの鬼', d: '守備が近くても捕球率が落ちにくい', pos: ['WR', 'TE'], lv: 4, cost: 10 },
  { id: 'route', n: 'ルートの達人', d: 'カットが鋭くなり、守備を振り切る', pos: ['WR', 'TE', 'RB'], lv: 3, cost: 10 },
  { id: 'juke', n: 'ジュークマスター', d: 'ジュークでタックルを外しやすい', pos: ['RB', 'WR', 'QB'], lv: 2, cost: 9 },
  { id: 'truck', n: 'ブルドーザー', d: 'トラックでタックルを弾き飛ばす', pos: ['RB', 'TE', 'QB'], lv: 2, cost: 9 },
  { id: 'ballsec', n: 'ボールセキュリティ', d: 'ファンブル率が60%減', pos: ['QB', 'RB', 'WR', 'TE'], lv: 1, cost: 6 },
  { id: 'deadeye', n: 'デッドアイ', d: 'パスの精度が20%向上', pos: ['QB'], lv: 1, cost: 10 },
  { id: 'pocket', n: 'ポケットの魔術師', d: 'プレッシャー下でも正確に投げる', pos: ['QB'], lv: 3, cost: 10 },
  { id: 'anchor', n: 'アンカー', d: 'ラッシャーにブロックを外されにくい', pos: ['OL', 'TE'], lv: 1, cost: 9 },
  { id: 'passrush', n: 'パスラッシュの鬼', d: 'パスプロのブロックを外しやすい', pos: ['DE', 'DT', 'LB'], lv: 1, cost: 10 },
  { id: 'run_stop', n: 'ランストッパー', d: 'ランブロックを外しやすい', pos: ['DE', 'DT', 'LB', 'S'], lv: 1, cost: 8 },
  { id: 'lockdown', n: 'ロックダウン', d: 'マンカバーで相手に密着', pos: ['CB', 'S', 'LB'], lv: 2, cost: 10 },
  { id: 'ballhawk', n: 'ボールホーク', d: 'インターセプト率が1.5倍', pos: ['CB', 'S', 'LB'], lv: 3, cost: 10 },
  { id: 'hitstick', n: 'ハードヒッター', d: 'タックル成功率UP、ファンブルを誘う', pos: ['LB', 'S', 'DE', 'DT', 'CB'], lv: 2, cost: 9 },
  { id: 'clutch', n: 'クラッチ', d: '第4Q以降、主要能力+4', pos: null, lv: 5, cost: 12 },
  { id: 'bigleg', n: 'ビッグレッグ', d: 'キック力+6', pos: ['K', 'P'], lv: 1, cost: 8 },
  { id: 'iceveins', n: 'アイスベインズ', d: 'FGのブレが30%減', pos: ['K'], lv: 2, cost: 10 },
];
const SKILL_BY = {}; SKILLS.forEach(s => SKILL_BY[s.id] = s);
// 外見
const LOOK = {
  skin: [['#f1d0b5', 'ライト'], ['#d9a77f', 'ミディアム'], ['#b07a52', 'タン'], ['#7d4f32', 'ブラウン'], ['#4a2e1e', 'ダーク']],
  visor: [[null, 'なし'], ['rgba(220,240,255,0.7)', 'クリア'], ['#222', 'スモーク'], ['#d4a017', 'ゴールド'], ['#6fc3ff', 'ミラー']],
  sleeve: [[null, 'なし'], ['#ffffff', '白'], ['#111111', '黒'], ['team', 'チームカラー']],
  cleat: [['#111111', '黒'], ['#ffffff', '白'], ['team', 'チームカラー'], ['#d4a017', 'ゴールド']],
};
const COLLEGES = ['Alabama', 'Ohio State', 'Georgia', 'Michigan', 'LSU', 'Texas', 'USC', 'Clemson', 'Oregon', 'Notre Dame', 'Penn State', 'Florida',
  'Oklahoma', 'Miami (FL)', 'Florida State', 'Texas A&M', 'Washington', 'Stanford', 'Wisconsin', 'Iowa', 'Tennessee', 'Auburn', 'UCLA', 'Utah', 'Colorado', 'Ole Miss'];
// 架空ルーキー用の名前
const FIRST_NAMES = ['Jaylen', 'Marcus', 'Tyler', 'Brandon', 'Darius', 'Caleb', 'Isaiah', 'Jordan', 'Malik', 'Trey', 'Devin', 'Cameron', 'Xavier', 'Andre', 'Elijah',
  'Mason', 'Logan', 'Jalen', 'Kendrick', 'Zion', 'Tre', 'Bryce', 'Quentin', 'Hunter', 'Cole', 'Jamal', 'Derrick', 'Micah', 'Nate', 'Omar'];
const LAST_NAMES = ['Johnson', 'Williams', 'Brown', 'Jackson', 'Davis', 'Harris', 'Thomas', 'Robinson', 'Walker', 'Carter', 'Mitchell', 'Turner', 'Coleman', 'Brooks',
  'Simmons', 'Reed', 'Hayes', 'Price', 'Bennett', 'Foster', 'Gray', 'Ellis', 'Wallace', 'Hunt', 'Ford', 'Banks', 'Graham', 'Sanders', 'Payne', 'Barnes'];
// 賞
const AWARDS = {
  MVP: { n: 'AP 最優秀選手（MVP）', short: 'MVP', pts: 30, sp: 15 },
  OPOY: { n: 'AP 最優秀攻撃選手', short: 'OPOY', pts: 15, sp: 10 },
  DPOY: { n: 'AP 最優秀守備選手', short: 'DPOY', pts: 15, sp: 10 },
  OROY: { n: 'AP 最優秀新人攻撃選手', short: 'OROY', pts: 4, sp: 6 },
  DROY: { n: 'AP 最優秀新人守備選手', short: 'DROY', pts: 4, sp: 6 },
  AP1: { n: 'AP オールプロ 1stチーム', short: 'All-Pro 1st', pts: 10, sp: 6 },
  AP2: { n: 'AP オールプロ 2ndチーム', short: 'All-Pro 2nd', pts: 5, sp: 3 },
  PB: { n: 'プロボウル選出', short: 'Pro Bowl', pts: 3, sp: 2 },
  SB: { n: 'スーパーボウル優勝', short: 'SB Champion', pts: 6, sp: 5 },
  SBMVP: { n: 'スーパーボウルMVP', short: 'SB MVP', pts: 9, sp: 8 },
  POW: { n: '週間最優秀選手（Player of the Week）', short: 'POTW', pts: 0.3, sp: 1 },
  LEAD: { n: 'リーグリーダー（タイトル）', short: 'Title', pts: 2, sp: 2 },
  HOF: { n: 'プロフットボール殿堂入り', short: 'Hall of Fame', pts: 0, sp: 0 },
};
const STAT_KEYS = ['gp', 'pa', 'pc', 'py', 'ptd', 'pint', 'ra', 'ry', 'rtd', 'rec', 'rey', 'retd', 'tk', 'sk', 'int', 'pd', 'ff', 'fgm', 'fga', 'xpm', 'xpa', 'pun', 'puy'];
const emptyLine = () => { const o = {}; STAT_KEYS.forEach(k => o[k] = 0); return o; };
const posGroup = p => ['LT', 'LG', 'C', 'RG', 'RT'].includes(p) ? 'OL' : p;
