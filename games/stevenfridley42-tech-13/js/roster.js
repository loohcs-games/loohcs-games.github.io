'use strict';
// ロスター文字列 → 選手オブジェクト（能力値を生成）
const ROSTER_ORDER = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE1', 'LT', 'LG', 'C', 'RG', 'RT',
  'DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'CB3', 'S1', 'S2', 'K', 'P'];
const POS_OF = s => s.replace(/\d+$/, '');
const POS_JP = { QB: 'クォーターバック', RB: 'ランニングバック', FB: 'フルバック', WR: 'ワイドレシーバー', TE: 'タイトエンド',
  LT: 'レフトタックル', LG: 'レフトガード', C: 'センター', RG: 'ライトガード', RT: 'ライトタックル',
  DE: 'ディフェンシブエンド', DT: 'ディフェンシブタックル', LB: 'ラインバッカー', CB: 'コーナーバック', S: 'セーフティ', K: 'キッカー', P: 'パンター' };

// 能力値テンプレート（総合80のときの値）: spd acc agi str cat thp tha tak blk cov prs awr kpw kac car elu
const ATTR_KEYS = ['spd', 'acc', 'agi', 'str', 'cat', 'thp', 'tha', 'tak', 'blk', 'cov', 'prs', 'awr', 'kpw', 'kac', 'car', 'elu'];
const TEMPL = {
  QB: [72, 76, 72, 58, 40, 88, 84, 28, 20, 20, 20, 82, 30, 30, 72, 62],
  RB: [89, 90, 88, 72, 70, 30, 25, 40, 52, 30, 25, 74, 20, 20, 86, 86],
  FB: [78, 80, 70, 80, 64, 25, 20, 55, 76, 30, 30, 72, 20, 20, 80, 60],
  WR: [92, 90, 88, 56, 86, 30, 25, 35, 46, 30, 20, 76, 20, 20, 76, 80],
  TE: [82, 82, 74, 76, 80, 30, 25, 45, 72, 30, 30, 76, 20, 20, 76, 64],
  OL: [55, 66, 55, 90, 22, 20, 20, 40, 85, 20, 30, 78, 20, 20, 40, 30],
  DE: [80, 84, 72, 82, 30, 20, 20, 80, 30, 42, 85, 76, 20, 20, 40, 40],
  DT: [66, 78, 62, 92, 25, 20, 20, 80, 30, 30, 80, 76, 20, 20, 40, 30],
  LB: [82, 84, 76, 76, 55, 20, 20, 86, 35, 70, 66, 80, 20, 20, 50, 50],
  CB: [92, 92, 90, 56, 66, 20, 20, 66, 30, 86, 35, 78, 20, 20, 60, 70],
  S:  [88, 88, 84, 68, 62, 20, 20, 82, 34, 80, 45, 80, 20, 20, 60, 64],
  K:  [55, 60, 55, 50, 30, 50, 30, 25, 20, 20, 20, 70, 92, 88, 40, 30],
  P:  [58, 60, 55, 52, 40, 55, 30, 25, 20, 20, 20, 70, 88, 82, 40, 30],
};
const tmplFor = pos => TEMPL[['LT', 'LG', 'C', 'RG', 'RT'].includes(pos) ? 'OL' : pos] || TEMPL.WR;
// その位置で重要な能力（総合力で大きく変動）
const KEYATTR = { QB: ['thp', 'tha', 'awr'], RB: ['spd', 'agi', 'elu', 'car'], FB: ['blk', 'str'], WR: ['spd', 'cat', 'agi'], TE: ['cat', 'blk'],
  OL: ['blk', 'str'], DE: ['prs', 'tak', 'spd'], DT: ['prs', 'str', 'tak'], LB: ['tak', 'cov', 'spd'], CB: ['cov', 'spd'], S: ['cov', 'tak'],
  K: ['kpw', 'kac'], P: ['kpw', 'kac'] };

function makeAttrs(pos, ovr, spd, noNoise) {
  const base = tmplFor(pos), g = ['LT', 'LG', 'C', 'RG', 'RT'].includes(pos) ? 'OL' : pos, keys = KEYATTR[g] || [];
  const a = {};
  ATTR_KEYS.forEach((k, i) => {
    const w = keys.includes(k) ? 1.0 : 0.45;
    a[k] = Math.round(U.clamp(base[i] + (ovr - 80) * w + (noNoise ? 0 : U.rnd(-3, 3)), 20, 99));
  });
  if (spd) a.spd = spd;
  return a;
}

let _seed = 1;
function mkPlayer(team, slot, num, name, ovr, spd, generic) {
  const pos = POS_OF(slot);
  return { key: team.id + ':' + slot, team: team.id, slot, pos, num: +num, name, ovr: +ovr, generic: !!generic,
    a: makeAttrs(pos === 'LT' || pos === 'LG' || pos === 'C' || pos === 'RG' || pos === 'RT' ? pos : pos, +ovr, spd ? +spd : 0), uid: _seed++ };
}

function buildTeam(d) {
  const t = { id: d.id, city: d.city, name: d.name, jp: d.jp, conf: d.conf, div: d.div, c1: d.c1, c2: d.c2, hel: d.hel, players: [] };
  const rows = d.roster.split(';');
  ROSTER_ORDER.forEach((slot, i) => {
    const r = (rows[i] || '').split('|');
    t.players.push(mkPlayer(t, slot, r[0] || 0, r[1] || ('控え ' + slot), r[2] || 70, r[3], !rows[i]));
  });
  // 控え（フォーメーションで使う追加要員）
  const avg = slot => (t.players.find(p => p.slot === slot) || { ovr: 72 }).ovr;
  const extra = [['TE2', 81, 'TE', avg('TE1') - 10], ['FB', 44, 'FB', 70], ['RB2', 35, 'RB', avg('RB') - 8], ['WR4', 83, 'WR', avg('WR3') - 6],
    ['LB4', 59, 'LB', 68], ['S3', 39, 'S', 68], ['CB4', 38, 'CB', 68]];
  extra.forEach(([slot, num, pos, ovr]) => {
    const p = mkPlayer(t, slot, num, '控え' + pos + ' #' + num, Math.round(ovr), 0, true);
    t.players.push(p);
  });
  t.by = {}; t.players.forEach(p => t.by[p.slot] = p);
  const offS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE1', 'LT', 'LG', 'C', 'RG', 'RT'], defS = ['DE1', 'DT1', 'DT2', 'DE2', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'CB3', 'S1', 'S2'];
  const m = arr => Math.round(arr.reduce((s, k) => s + t.by[k].ovr, 0) / arr.length);
  t.off = m(offS); t.def = m(defS); t.st = m(['K', 'P']);
  t.ovr = Math.round(t.off * 0.46 + t.def * 0.44 + t.st * 0.1 + (t.by.QB.ovr - 80) * 0.25);
  return t;
}

const TEAMS = TEAM_DATA.map(buildTeam);
const TEAM_BY_ID = {}; TEAMS.forEach(t => TEAM_BY_ID[t.id] = t);
