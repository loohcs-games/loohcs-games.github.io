'use strict';
// =====================================================================
//  maps.js — 日本と唐の街・住人
// =====================================================================
function pick(r, a) { return a[(r() * a.length) | 0]; }

const PRE = {
  farmer: r => ({ hair: 'top', robe: pick(r, ['#8a9a6a', '#a08060', '#7a8aa0', '#9a8a6a']), leg: '#5a4a3a', belt: '#5a3a20', happy: r() < .5 }),
  farmerW: r => ({ hair: 'bun', robe: pick(r, ['#c08080', '#8aa0b8', '#b89a6a', '#9ab08a']), belt: '#e8d8b0', happy: r() < .5 }),
  child: r => ({ hair: pick(r, ['child', 'mizura']), robe: pick(r, ['#e0a040', '#60a0d0', '#e07070', '#80c060']), happy: true }),
  noble: r => ({ hair: 'eboshi', robe: pick(r, ['#4a5a9a', '#7a3a5a', '#3a6a5a', '#9a6a3a', '#5a4a7a']), fan: r() < .5 }),
  lady: r => ({ hair: 'long', robe: pick(r, ['#d04060', '#e08098', '#a050a0', '#e0a040', '#5a7ad0']), layer: pick(r, ['#f0d060', '#80c0a0', '#e0e0f0', '#f08060']), happy: r() < .4 }),
  official: r => ({ hair: 'kanmuri', robe: pick(r, ['#3a3a6a', '#8a2a3a', '#2a5a4a', '#6a3a7a']) }),
  monk: r => ({ hair: 'bald', robe: pick(r, ['#3a3a48', '#4a4a5a', '#5a4a3a']), kesa: pick(r, ['#c07030', '#a85a2a', '#8a6a3a']) }),
  ascetic: r => ({ hair: 'tokin', robe: '#e8e0d0', kesa: '#5a7a4a', staff: r() < .6 }),
  merchant: r => ({ hair: 'top', robe: pick(r, ['#6a5a8a', '#5a7a6a', '#8a6a4a']), belt: '#e8d8b0', happy: true }),
  fisher: r => ({ hair: pick(r, ['top', 'kasa']), robe: pick(r, ['#5a7a9a', '#7a8a9a', '#9a9a8a']), leg: '#c8946a', skin: '#ecb88a', belt: '#3a3a3a', happy: r() < .5 }),
  tang: r => ({ hair: 'tang', robe: pick(r, ['#b84a3a', '#3a6a8a', '#7a6a3a', '#5a8a5a', '#8a5a9a']), belt: '#2a2a2a' }),
  tangW: r => ({ hair: pick(r, ['bun', 'long']), robe: pick(r, ['#e05a5a', '#f0b040', '#60a0c0', '#c070c0']), layer: pick(r, ['#f0e0a0', '#a0e0c0', '#ffffff']), happy: r() < .5 }),
  hu: r => ({ hair: 'turban', tc: pick(r, ['#f0ece0', '#e0c060', '#a0c0e0']), robe: pick(r, ['#7a4a8a', '#3a7a6a', '#9a5a2a']), beard: '#6a3a1a', skin: '#e8c098' }),
  tangmonk: r => ({ hair: 'bald', robe: '#8a6a3a', kesa: '#c03a2a' }),
  pilgrim: r => ({ hair: pick(r, ['kasa', 'top', 'bun']), robe: pick(r, ['#ece8dc', '#ddd5c4']), staff: true, happy: true }),
  soldier: r => ({ hair: 'eboshi', robe: '#6a5a4a', belt: '#2a2a2a' })
};
function preset(name, seed) { const r = Rng(seed * 7919 + 13); return PRE[name](r); }

const POOLS = {
  sanuki: { who: ['farmer', 'farmer', 'farmerW', 'child', 'fisher', 'farmerW'], lines: [
    '讃岐は雨が少なくてねえ。ため池がないと田んぼがすぐ干上がっちまう。', '佐伯さまの坊ちゃんは神童だって評判だよ。', '屏風浦の海はきれいだろう？　山が屏風みたいに囲んでるからそう呼ぶのさ。',
    '満濃池の堤がまた切れたらしい。国司さまも手を焼いているよ。', '今年の稲はよく実った。お日さまのおかげだ。', '都では新しい都づくりで人手を集めているらしいぞ。'] },
  miyako: { who: ['noble', 'lady', 'farmer', 'farmerW', 'merchant', 'child', 'official', 'monk'], lines: [
    '大学寮に入れるのは、ふつう五位以上の貴族の子だけさ。', '東西の市には諸国の品が集まるのよ。', '内裏の造営で人足に駆り出されて、くたくただ…',
    '唐の文物はなんでも高く売れる。紙も筆も唐物が一番さ。', '僧侶にも官の許しがいる。勝手に出家した者は「私度僧」と呼ばれるんだ。', '牛車は貴族の乗り物だよ。ゆっくりだけど、雅だろう？', '漢詩が書けなきゃ、朝廷では出世できんよ。'] },
  nara: { who: ['monk', 'monk', 'farmer', 'farmerW', 'merchant', 'child', 'lady'], lines: [
    '大仏さまは聖武天皇が国の安らぎを願って造られたのよ。', '鹿は春日の神さまのお使い。いじめちゃだめだよ。', '都が平安京に移っても、南都の大寺の力はまだまだ強い。',
    '東大寺の戒壇で戒を授かって、はじめて正式な僧になれるんだ。', '南都六宗の学僧たちは議論が好きでね。'] },
  shikoku: { who: ['ascetic', 'ascetic', 'farmer', 'fisher'], lines: [
    'この山は猿が多い。握り飯を取られぬよう気をつけな。', '山にこもる修行者は、木の実と水だけで何日も過ごすそうだ。', '阿波の大瀧嶽は霊山さ。滝に打たれて心を澄ますといい。',
    '真言を百万遍唱えると、一度見聞きしたことを決して忘れなくなるという。'] },
  muroto: { who: ['fisher', 'fisher', 'farmerW', 'child'], lines: [
    '室戸の岬は波が荒い。昔から船の難所さ。', 'あの岩屋の中から外を見ると、空と海しか見えねえんだ。', '鯨が見えることもあるぞ！', '夜明け前、東の空に明けの明星がひときわ輝くんだ。'] },
  naniwa: { who: ['fisher', 'merchant', 'official', 'farmer', 'soldier'], lines: [
    '遣唐使船は四隻で海を渡る。でも無事に戻れるのは半分って話さ…', '唐へ行くなら、二十年は帰れない覚悟がいるよ。', '難波津は西国への玄関口だ。', '船乗りは嵐を一番恐れる。祈るしかないのさ。'] },
  sekigan: { who: ['tang', 'tang', 'tangW', 'fisher'], lines: [
    '（唐の言葉）どこの国の船だ？　ここは福州の赤岸鎮だよ。', '（唐の言葉）役人は疑い深い。海賊かもしれんと言っておる。', '（唐の言葉）この辺りでは茶がよく育つ。', '（唐の言葉）長安までは陸路で二千里以上あるぞ。'] },
  choan: { who: ['tang', 'tang', 'tangW', 'hu', 'tangmonk', 'tangW', 'hu'], lines: [
    '長安は人口百万の天下第一の都だ！', '西市には波斯（ペルシャ）やソグドの商人が集まる。葡萄酒もあるよ。', '青龍寺の恵果和尚は、不空三蔵から密教を受け継いだお方だ。',
    'あんた日本の僧かい？　ずいぶん遠くから来たもんだ。', '詩を作れぬ者は都の宴に呼ばれないよ。', '大雁塔は玄奘三蔵が天竺から持ち帰った経典を納めるために建てられたんだ。', '般若三蔵は天竺（インド）のお方で、梵語に通じておられる。'] },
  dazaifu: { who: ['official', 'farmer', 'farmerW', 'monk', 'merchant'], lines: [
    'ここ大宰府は「遠の朝廷」と呼ばれる九州の都さ。', '唐や新羅の船もここへ来る。', '二十年の留学を二年で帰ってくるとは…朝廷はお怒りかもしれんぞ。'] },
  koya: { who: ['monk', 'monk', 'ascetic', 'farmer'], lines: [
    '高野山は四方を八つの峰に囲まれ、まるで蓮の花のようです。', '冬は雪が深く、修行は厳しいですが心が澄みます。', 'お山には狩場明神さまの使いの犬が導いてくださったと聞きました。'] },
  toji: { who: ['monk', 'noble', 'farmer', 'farmerW', 'child'], lines: [
    '東寺は都の守りとして羅城門の東に建てられた寺です。', '国家を護る寺を任されるとは、さすが大師さま。', '講堂に仏さまを立体で並べ、曼荼羅を表すそうですよ。'] }
};

// ---------------- Map builder ----------------
function newMap(def) {
  const w = def.w, h = def.h;
  const m = { id: def.id, def, w, h, seed: def.seed, tiles: new Array(w * h).fill(def.ground || 'G'), objs: [], npcs: [], spots: {}, occ: new Uint8Array(w * h), res: new Uint8Array(w * h) };
  m.t = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : m.tiles[y * w + x];
  return m;
}
function Builder(m) {
  const B = {
    m,
    set(x, y, t) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.tiles[y * m.w + x] = t; },
    fill(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) B.set(i, j, t); },
    hroad(x1, x2, y, wid = 2, t = 'D') { B.fill(x1, y, x2 - x1 + 1, wid, t); },
    vroad(x, y1, y2, wid = 2, t = 'D') { B.fill(x, y1, wid, y2 - y1 + 1, t); },
    mark(o) { for (let j = o.ty; j < o.ty + o.h; j++) for (let i = o.tx; i < o.tx + o.w; i++) if (i >= 0 && j >= 0 && i < m.w && j < m.h) m.occ[j * m.w + i] = 1; },
    reserve(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < m.w && j < m.h) m.res[j * m.w + i] = 1; },
    bld(type, x, y, w, h, opt = {}) {
      const o = Object.assign({ kind: 'bld', type, tx: x, ty: y, w, h, solid: true }, opt);
      if (type === 'gate' || type === 'redgate' || type === 'tanggate') o.edgeOnly = true;
      m.objs.push(o); B.mark(o); B.reserve(x - 1, y - 1, w + 2, h + 2); return o;
    },
    o(type, x, y, opt = {}) {
      const o = Object.assign({ kind: 'obj', type, tx: x, ty: y, w: 1, h: 1, solid: true }, opt);
      m.objs.push(o); B.mark(o); if (o.role) B.reserve(x - 1, y - 1, o.w + 2, o.h + 2); return o;
    },
    free(x, y) { const t = m.t(x, y); return (t === 'G' || t === 'M') && !m.occ[y * m.w + x] && !m.res[y * m.w + x]; },
    scatter(x, y, w, h, n, types, seed) {
      const r = Rng(seed || m.seed * 3 + n);
      for (let k = 0; k < n * 4 && n > 0; k++) {
        const i = x + ((r() * w) | 0), j = y + ((r() * h) | 0);
        if (!B.free(i, j)) continue;
        B.o(pick(r, types), i, j); n--;
      }
    },
    wallRect(x, y, w, h, gaps = {}, kind = 'wall') {
      const H = kind + 'H', V = kind + 'V', gb = gaps.b || [], gt = gaps.t || [], gl = gaps.l || [], gr = gaps.r || [];
      for (let i = x; i < x + w; i++) { if (!gt.includes(i)) B.o(H, i, y, { solid: true }); if (!gb.includes(i)) B.o(H, i, y + h - 1); }
      for (let j = y + 1; j < y + h - 1; j++) { if (!gl.includes(j)) B.o(V, x, j); if (!gr.includes(j)) B.o(V, x + w - 1, j); }
    },
    npc(n) { m.npcs.push(n); },
    crowd(n, area, pool, seed) {
      const r = Rng(seed || m.seed * 11);
      for (let k = 0; k < n * 6 && n > 0; k++) {
        const x = area[0] + ((r() * area[2]) | 0), y = area[1] + ((r() * area[3]) | 0);
        const t = m.t(x, y); if (!t || t === 'W' || t === 'X' || m.occ[y * m.w + x]) continue;
        const pz = POOLS[pool]; const p = pick(r, pz.who);
        m.npcs.push({ generic: true, pool, preset: p, seed: (r() * 1e6) | 0, x, y, wander: 4 }); n--;
      }
    },
    animals(n, area, type, seed) {
      const r = Rng(seed || m.seed * 5 + n);
      for (let k = 0; k < n * 6 && n > 0; k++) {
        const x = area[0] + ((r() * area[2]) | 0), y = area[1] + ((r() * area[3]) | 0);
        const t = m.t(x, y); if (!t || t === 'W' || t === 'X' || m.occ[y * m.w + x]) continue;
        m.npcs.push({ animal: type, x, y, wander: 3, seed: k }); n--;
      }
    }
  };
  return B;
}

// ---------------- 各地のマップ ----------------
const MAPDEF = {};
const ERA_NAME = () => (S && S.year < 794 ? '長岡京' : '平安京');

MAPDEF.sanuki = {
  id: 'sanuki', name: () => '讃岐国・屏風浦', sub: '空海（真魚）の故郷', w: 44, h: 32, seed: 11, region: 'jp', pool: 'sanuki', pos: [27, 63],
  build(B) {
    const m = B.m;
    B.fill(0, 26, 44, 6, 'X'); B.fill(0, 24, 44, 2, 'B');
    for (let x = 0; x < 44; x++) { if (h2(x, 1, 3) < .45) B.set(x, 23, 'B'); if (h2(x, 2, 3) < .5) B.set(x, 26, 'B'); }
    B.hroad(0, 43, 13); B.vroad(20, 2, 25);
    B.fill(22, 25, 2, 6, 'K');
    // 佐伯家
    B.fill(4, 4, 14, 8, 'S'); B.wallRect(3, 3, 16, 10, { b: [10, 11] });
    B.bld('yashiki', 5, 4, 7, 4, { name: '佐伯家の屋敷', role: 'home', id: 'saeki' });
    B.bld('kura', 14, 4, 3, 3, { name: '佐伯家の蔵', role: 'flavor', text: '米俵や巻物がしまわれている。' });
    B.o('lantern', 6, 10); B.o('lantern', 15, 10); B.o('pine', 4, 10); B.o('sakura', 17, 10); B.o('well', 13, 9, { role: 'flavor', text: '冷たい井戸水だ。' });
    // 田と農家
    B.fill(27, 2, 6, 9, 'F'); B.fill(35, 2, 7, 9, 'F'); B.fill(9, 17, 6, 4, 'C');
    B.bld('house', 22, 3, 4, 3, { name: '農家', role: 'house' }); B.bld('house', 22, 8, 4, 3, { name: '農家', role: 'house' });
    B.o('hay', 34, 6); B.o('hay', 33, 9); B.o('rack', 26, 11, { w: 2 });
    // 南の村
    B.bld('temple', 2, 16, 6, 4, { name: '佐伯氏の氏寺', role: 'temple', id: 'ujidera' });
    B.bld('shop', 15, 16, 4, 3, { name: 'よろず屋', role: 'shop', id: 'yorozu' });
    B.bld('house', 23, 16, 4, 3, { name: '漁師の家', role: 'house' });
    B.bld('house', 28, 17, 4, 3, { name: '農家', role: 'house' });
    B.bld('shop', 23, 21, 4, 2, { name: '湊の番屋', role: 'port', id: 'sanuki_port' });
    B.fill(33, 15, 9, 6, 'W'); B.fill(34, 14, 7, 1, 'W'); B.fill(35, 21, 5, 1, 'W');
    B.o('pondsign', 32, 21, { name: '満濃池', role: 'manno', id: 'manno' });
    B.o('boat', 24, 28, { w: 2 }); B.o('boat', 30, 29, { w: 2 }); B.o('boat', 8, 28, { w: 2 });
    B.o('sign', 19, 15, { name: '道標', role: 'sign', id: 'sign' });
    B.o('umbrella', 13, 15, { solid: true });
    B.o('torii', 3, 21, { w: 3, solid: false });
    m.spots.sign = [18, 16]; m.spots.start = [10, 14]; m.spots.port = [24, 24]; m.spots.home = [8, 9];
    for (let x = 1; x < 43; x += 3) if (B.free(x, 23) || m.t(x, 23) === 'B') { if (!m.occ[23 * m.w + x] && x !== 20 && x !== 21 && x !== 22 && x !== 23) B.o('pine', x, 23); }
    B.scatter(0, 0, 44, 23, 38, ['tree', 'tree', 'pine', 'bush', 'bamboo', 'sakura', 'azalea']);
        B.npc({ id: 'father', name: '父・佐伯田公', spec: { hair: 'eboshi', robe: '#5a5a7a', beard: '#3a2a20' }, x: 12, y: 10, wander: 1, lines: ['真魚よ、学問を積めば佐伯の家も安泰じゃ。', '体を大事にするのだぞ。'] });
        B.npc({ id: 'osana', name: '幼なじみの小次郎', spec: { hair: 'child', robe: '#e0a040', happy: true }, x: 12, y: 22, wander: 1, lines: ['真魚兄ちゃん、都でえらくなってね！'] });
        B.npc({ id: 'kokushi', name: '讃岐の国司', spec: { hair: 'kanmuri', robe: '#6a3a7a' }, x: 30, y: 22, wander: 1, when: () => S.flags.ch21, lines: ['満濃池の修築、なにとぞお力を…'] });
    B.crowd(9, [0, 0, 44, 24], 'sanuki');
    B.animals(4, [21, 2, 6, 10], 'chicken'); B.animals(2, [27, 11, 10, 3], 'cow'); B.animals(1, [10, 14, 10, 6], 'cat'); B.animals(1, [5, 21, 10, 3], 'dog');
  }
};

MAPDEF.miyako = {
  id: 'miyako', name: () => ERA_NAME(), sub: '日本の都', w: 52, h: 40, seed: 23, region: 'jp', pool: 'miyako', pos: [55, 44],
  build(B) {
    const m = B.m;
    B.vroad(24, 9, 39, 4); B.hroad(0, 51, 13); B.hroad(0, 51, 23); B.hroad(0, 51, 32); B.vroad(10, 11, 39); B.vroad(40, 11, 39);
    B.fill(15, 2, 22, 8, 'S'); B.wallRect(14, 1, 24, 10, { b: [24, 25, 26, 27] });
    B.bld('palace', 21, 3, 10, 4, { name: '朝堂院（朝廷）', role: 'court', id: 'chodo' });
    B.bld('office', 15, 3, 5, 3, { name: '太政官', role: 'flavor', text: '国の政を司る役所。役人たちが忙しく行き交っている。' });
    B.bld('office', 32, 3, 5, 3, { name: '中務省', role: 'flavor', text: '詔書の起草などを担う役所だ。' });
    B.o('lantern', 22, 8); B.o('lantern', 29, 8); B.o('sakura', 16, 8); B.o('sakura', 35, 8);
    B.bld('school', 13, 15, 6, 3, { name: '大学寮', role: 'school', id: 'daigaku' });
    B.bld('yashiki', 2, 15, 7, 4, { name: '阿刀大足の屋敷', role: 'home2', id: 'atohouse' });
    B.fill(14, 25, 7, 5, 'W'); B.fill(15, 24, 5, 1, 'W');
    B.o('pondsign', 21, 29, { name: '神泉苑', role: 'shinsen', id: 'shinsen' });
    B.o('willow', 13, 26); B.o('willow', 13, 29); B.o('willow', 21, 25);
    for (const [x, y] of [[2, 25], [5, 25], [2, 28], [5, 28]]) B.o(x % 2 ? 'stall' : 'stall2', x, y, { w: 2, role: 'shop', name: '西市の露店' });
    B.bld('ink', 1, 34, 4, 3, { name: '筆墨屋', role: 'shop' }); B.bld('teahouse', 5, 34, 4, 3, { name: '茶屋', role: 'teahouse' });
    for (const [x, y] of [[42, 25], [45, 25], [42, 28], [45, 28], [48, 25]]) B.o(x % 2 ? 'stall2' : 'stall', x, y, { w: 2, role: 'shop', name: '東市の露店' });
    B.bld('shop', 43, 34, 4, 3, { name: '東市の店', role: 'shop' });
    B.bld('inn', 30, 25, 5, 3, { name: '宿', role: 'inn' });
    B.bld('yashiki', 30, 15, 6, 4, { name: '貴族の屋敷', role: 'salon' }); B.bld('yashiki', 43, 15, 6, 4, { name: '貴族の屋敷', role: 'salon' });
    B.bld('temple', 42, 2, 7, 4, { name: '高雄山寺', role: 'takao', id: 'takao' });
    B.bld('house', 2, 2, 4, 3, { name: '民家', role: 'house' }); B.bld('house', 7, 2, 4, 3, { name: '民家', role: 'house' }); B.bld('house', 2, 7, 4, 3, { name: '民家', role: 'house' });
    B.bld('house', 40, 8, 4, 3, { name: '民家', role: 'house' }); B.bld('house', 34, 34, 4, 3, { name: '民家', role: 'house' });
    B.bld('temple', 13, 34, 6, 3, { name: '西寺', role: 'temple' });
    B.bld('redgate', 30, 35, 4, 2, { name: '東寺の門', role: 'toji_gate', id: 'tojigate' });
    B.bld('gate', 23, 37, 6, 2, { name: '羅城門', role: 'flavor', text: '都の正門・羅城門。ここから朱雀大路がまっすぐ内裏へと延びている。' });
    B.o('sign', 29, 33, { name: '道標', role: 'sign', id: 'sign' });
    B.o('cart', 32, 21, { w: 2 }); B.o('umbrella', 9, 37); B.o('well', 37, 27);
    for (const x of [44, 47, 49]) B.o('maple', x, 6); B.o('maple', 41, 3); B.o('maple', 50, 3);
    for (let y = 11; y < 37; y += 3) { if (B.free(23, y)) B.o('willow', 23, y); if (B.free(28, y)) B.o('willow', 28, y); }
    m.spots.sign = [28, 34]; m.spots.start = [26, 34]; m.spots.takao = [45, 7];
    B.scatter(0, 0, 52, 40, 40, ['tree', 'pine', 'sakura', 'bush', 'azalea', 'tree']);
        B.npc({ id: 'shamon', name: '一人の沙門', spec: { hair: 'bald', robe: '#6a5a4a', kesa: '#8a6a3a', staff: true }, x: 46, y: 31, wander: 1, when: () => stepIs('shamon') });
        B.npc({ id: 'hayanari', name: '橘逸勢', spec: { hair: 'eboshi', robe: '#3a6a5a', fan: true }, x: 34, y: 20, wander: 2, when: () => S.year >= 809, lines: ['唐で学んだ書の腕、まだまだ空海殿には及びませぬ。', '嵯峨帝、空海殿、そして私。世の人は「三筆」などと呼ぶそうですな。'] });
    B.npc({ id: 'saicho', name: '最澄', spec: { hair: 'bald', robe: '#4a4a5a', kesa: '#7a8a9a' }, x: 46, y: 8, wander: 1, when: () => stepIs('saicho') || stepIs('rishu'), lines: ['空海殿、密教についてさらに教えを請いたい。'] });
    B.npc({ id: 'shubin', name: '守敏（西寺の僧）', spec: { hair: 'bald', robe: '#5a3a5a', kesa: '#a83a3a' }, x: 20, y: 31, wander: 1, when: () => stepIs('amagoi'), lines: ['雨乞いならこの守敏にお任せあれ。ふふふ。'] });
    B.crowd(20, [0, 9, 52, 31], 'miyako');
    B.animals(2, [26, 14, 10, 8], 'horse'); B.animals(2, [0, 20, 20, 10], 'cat'); B.animals(1, [30, 30, 20, 8], 'dog');
  }
};

MAPDEF.nara = {
  id: 'nara', name: () => '奈良（南都）', sub: '東大寺の都', w: 40, h: 30, seed: 37, region: 'jp', pool: 'nara', pos: [59, 47],
  build(B) {
    const m = B.m;
    B.fill(10, 3, 20, 15, 'S'); B.wallRect(9, 2, 22, 17, { b: [18, 19, 20, 21] });
    B.bld('daibutsu', 14, 4, 12, 5, { name: '東大寺 大仏殿', role: 'temple', id: 'todaiji' });
    B.bld('pagoda', 11, 11, 3, 3, { name: '東塔（七重塔）', role: 'flavor', text: '高さ百メートル近い七重塔。天にそびえている。' });
    B.bld('pagoda', 26, 11, 3, 3, { name: '西塔（七重塔）', role: 'flavor', text: '高さ百メートル近い七重塔だ。' });
    B.bld('gate', 18, 17, 4, 2, { name: '南大門', role: 'flavor', text: '東大寺の南大門。' });
    B.o('lantern', 19, 11); B.o('lantern', 21, 11); B.o('bell', 15, 14, { name: '鐘楼', role: 'flavor', text: 'ゴーン……と鐘の音が響いた。' });
    B.bld('temple', 2, 4, 5, 3, { name: '戒壇院', role: 'kaidan', id: 'kaidan' });
    B.vroad(19, 19, 29); B.hroad(0, 39, 23);
    B.bld('inn', 2, 25, 5, 3, { name: '宿', role: 'inn' }); B.bld('house', 8, 25, 4, 3, { name: '民家', role: 'house' }); B.bld('house', 13, 25, 4, 3, { name: '民家', role: 'house' });
    B.o('stall', 24, 25, { w: 2, role: 'shop', name: '露店' }); B.o('stall2', 27, 25, { w: 2, role: 'shop', name: '露店' });
    B.bld('shop', 31, 25, 4, 3, { name: '墨屋', role: 'shop' });
    B.bld('temple', 32, 4, 6, 3, { name: '興福寺', role: 'temple' });
    B.o('sign', 21, 27, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [20, 28]; m.spots.start = [20, 27];
    B.scatter(0, 0, 40, 30, 46, ['sakura', 'pine', 'maple', 'tree', 'bush', 'azalea']);
    B.crowd(10, [0, 3, 40, 27], 'nara');
    B.animals(9, [0, 0, 40, 30], 'deer');
  }
};

MAPDEF.shikoku = {
  id: 'shikoku', name: () => '阿波国・大瀧嶽', sub: '山岳修行の地', w: 36, h: 28, seed: 41, region: 'jp', pool: 'shikoku', pos: [33, 66], ground: 'M',
  build(B) {
    const m = B.m;
    for (let y = 0; y < 28; y++) for (let x = 0; x < 36; x++) if (h2(x >> 1, y >> 1, 9) < .22) B.set(x, y, 'R');
    B.fill(12, 0, 12, 6, 'R');
    B.vroad(17, 6, 27); B.hroad(6, 30, 14); B.vroad(7, 14, 18); B.vroad(28, 9, 14);
    B.o('waterfall', 17, 3, { w: 2, h: 3, name: '大瀧', role: 'fall', id: 'fall', anim: 'fall' });
    B.fill(14, 4, 3, 4, 'W'); B.fill(19, 4, 3, 4, 'W'); B.fill(17, 6, 2, 2, 'R');
    B.bld('hut', 5, 15, 4, 3, { name: '修行者の草庵', role: 'hut', id: 'hut1' });
    B.o('bigrock', 27, 8, { w: 2, name: '座禅石', role: 'meditate' });
    B.o('stele', 20, 11, { name: '石の祠', role: 'flavor', text: '山の神を祀る小さな祠。手を合わせた。' });
    B.o('sign', 19, 25, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [18, 26]; m.spots.start = [18, 26];
    B.scatter(0, 0, 36, 28, 120, ['cedar', 'cedar', 'cedar', 'maple', 'bamboo', 'rock', 'bush', 'pine']);
    B.npc({ id: 'hermit', name: '山の修行者', spec: { hair: 'tokin', robe: '#e8e0d0', kesa: '#5a7a4a', staff: true, beard: '#d0d0d0' }, x: 10, y: 19, wander: 1, lines: ['滝に打たれ、岩屋に籠り、真言を唱えるのじゃ。', '体力が尽きれば修行もできぬ。草庵で休むがよい。', '法力は読経・瞑想・断食で高まる。断食は効くが、体には毒じゃぞ。'] });
    B.crowd(4, [4, 8, 28, 18], 'shikoku');
    B.animals(4, [0, 0, 36, 28], 'monkey'); B.animals(1, [0, 0, 36, 28], 'deer');
  }
};

MAPDEF.muroto = {
  id: 'muroto', name: () => '土佐国・室戸岬', sub: '空と海の岬', w: 36, h: 28, seed: 53, region: 'jp', pool: 'muroto', pos: [38, 73], ground: 'X',
  build(B) {
    const m = B.m;
    for (let y = 0; y < 26; y++) { const lo = Math.round(y * .52 + h2(y, 0, 4) * 2), hi = 35 - Math.round(y * .52 + h2(y, 1, 4) * 2); B.fill(lo, y, hi - lo + 1, 1, 'G'); B.set(lo, y, 'B'); B.set(hi, y, 'B'); if (y > 15) { B.set(lo + 1, y, 'R'); B.set(hi - 1, y, 'R'); } }
    B.fill(11, 17, 14, 6, 'R');
    B.hroad(2, 33, 7); B.vroad(17, 7, 21);
    B.o('cave', 16, 19, { w: 3, h: 2, name: '御厨人窟（みくろど）', role: 'cave', id: 'mikurodo' });
    B.bld('house', 3, 2, 4, 3, { name: '漁師の家', role: 'house' }); B.bld('house', 9, 2, 4, 3, { name: '漁師の家', role: 'house' });
    B.bld('house', 23, 2, 4, 3, { name: '漁師の家', role: 'house' }); B.bld('teahouse', 28, 2, 4, 3, { name: '浜の茶屋', role: 'teahouse' });
    B.o('rack', 15, 3, { w: 2 }); B.o('rack', 19, 3, { w: 2 }); B.o('pot', 14, 5); B.o('pot', 21, 5);
    B.o('sign', 19, 8, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [18, 9]; m.spots.start = [18, 9];
    B.o('boat', 0, 4, { w: 2 }); B.o('boat', 33, 6, { w: 2 });
    B.scatter(0, 9, 36, 12, 26, ['pine', 'pine', 'bush', 'rock', 'tree']);
    B.crowd(6, [2, 0, 32, 12], 'muroto');
    B.animals(2, [2, 0, 30, 8], 'cat');
  }
};

MAPDEF.naniwa = {
  id: 'naniwa', name: () => '難波津', sub: '遣唐使船の港', w: 36, h: 26, seed: 61, region: 'jp', pool: 'naniwa', pos: [52, 49],
  build(B) {
    const m = B.m;
    B.fill(0, 17, 36, 9, 'X'); B.fill(0, 15, 36, 2, 'B');
    B.hroad(0, 35, 8); B.vroad(10, 8, 16); B.fill(10, 15, 2, 7, 'K'); B.fill(26, 15, 2, 5, 'K');
    B.o('ship', 12, 18, { w: 6, h: 3, name: '遣唐使船（第一船）', role: 'kentoshi', id: 'ship' });
    B.o('ship', 20, 19, { w: 6, h: 3, name: '遣唐使船（第二船）', role: 'flavor', text: '最澄が乗る第二船。のちに肥前から出航する。' });
    B.o('boat', 29, 18, { w: 2 }); B.o('boat', 3, 20, { w: 2 });
    B.bld('office', 14, 2, 7, 4, { name: '難波津の役所', role: 'flavor', text: '遣唐使の荷を検める役人たちが働いている。' });
    B.bld('kura', 2, 3, 3, 3, { name: '蔵', role: 'flavor', text: '朝廷から唐への贈り物が納められている。' }); B.bld('kura', 6, 3, 3, 3, { name: '蔵', role: 'flavor', text: '絹や銀が積まれている。' });
    B.bld('inn', 23, 2, 5, 3, { name: '湊の宿', role: 'inn' }); B.bld('shop', 30, 3, 4, 3, { name: '船具屋', role: 'shop' });
    B.o('stall', 14, 11, { w: 2, role: 'shop', name: '露店' }); B.o('stall2', 18, 11, { w: 2, role: 'shop', name: '露店' }); B.o('stall', 22, 11, { w: 2, role: 'shop', name: '露店' });
    B.o('nobori', 13, 14); B.o('nobori', 8, 14); B.o('pot', 6, 13); B.o('pot', 7, 12); B.o('hay', 31, 11);
    B.o('sign', 12, 12, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [11, 12]; m.spots.start = [11, 12];
    B.scatter(0, 0, 36, 15, 16, ['pine', 'tree', 'bush', 'willow']);
    B.npc({ id: 'kadonomaro', name: '遣唐大使・藤原葛野麻呂', spec: { hair: 'kanmuri', robe: '#2a3a6a' }, x: 9, y: 16, wander: 0, when: () => S.year >= 804, lines: ['海はいつ荒れるかわからぬ。覚悟はよいか。'] });
    B.npc({ id: 'hayanari2', name: '橘逸勢', spec: { hair: 'eboshi', robe: '#3a6a5a', fan: true }, x: 6, y: 11, wander: 1, when: () => S.year >= 804, lines: ['私も留学生として唐へ渡ります。書を学ぶのが楽しみです。'] });
    B.crowd(9, [0, 0, 36, 16], 'naniwa');
    B.animals(2, [0, 6, 30, 8], 'cat');
  }
};

MAPDEF.sekigan = {
  id: 'sekigan', name: () => '唐・福州 赤岸鎮', sub: '漂着した海辺の村', w: 34, h: 24, seed: 71, region: 'cn', pool: 'sekigan', pos: [0, 0],
  build(B) {
    const m = B.m;
    B.fill(0, 0, 8, 24, 'X'); for (let y = 0; y < 24; y++) { B.set(8, y, 'B'); B.set(9, y, h2(y, 3, 2) < .5 ? 'B' : 'G'); B.set(7, y, h2(y, 4, 2) < .3 ? 'B' : 'X'); }
    B.hroad(8, 33, 10); B.vroad(17, 0, 23);
    B.o('ship', 1, 9, { w: 6, h: 3, name: '漂着した遣唐使船', role: 'flavor', text: '34日の漂流で、船はぼろぼろだ……。' });
    B.bld('tang', 20, 3, 8, 4, { name: '赤岸鎮の役所', role: 'yamen', id: 'yamen' });
    B.bld('tanghouse', 10, 3, 5, 3, { name: '村の家', role: 'house' }); B.bld('tanghouse', 10, 14, 5, 3, { name: '村の家', role: 'house' });
    B.bld('tangshop', 20, 14, 5, 3, { name: '茶舗', role: 'teahouse' }); B.bld('tanghouse', 27, 14, 5, 3, { name: '村の家', role: 'house' });
    B.o('nobori', 19, 8); B.o('nobori', 28, 8); B.o('pot', 15, 8); B.o('rack', 12, 19, { w: 2 });
    B.o('sign', 19, 12, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [18, 12]; m.spots.start = [11, 11];
    B.scatter(9, 0, 25, 24, 28, ['bamboo', 'tree', 'bamboo', 'bush', 'plum']);
    B.npc({ id: 'kadonomaro', name: '遣唐大使・藤原葛野麻呂', spec: { hair: 'kanmuri', robe: '#2a3a6a' }, x: 13, y: 11, wander: 0, lines: ['役人が上陸を許さぬのだ……。'] });
        B.crowd(7, [9, 0, 25, 24], 'sekigan');
    B.animals(3, [9, 0, 25, 24], 'chicken');
  }
};

MAPDEF.choan = {
  id: 'choan', name: () => '唐・長安', sub: '人口百万の世界都市', w: 56, h: 42, seed: 83, region: 'cn', pool: 'choan', pos: [0, 0],
  build(B) {
    const m = B.m;
    B.vroad(26, 10, 41, 5, 'P'); B.hroad(0, 55, 12, 3, 'P'); B.hroad(0, 55, 26, 3, 'P'); B.vroad(10, 15, 41); B.vroad(41, 15, 41);
    B.fill(18, 1, 20, 8, 'S'); B.wallRect(17, 0, 22, 10, { b: [26, 27, 28, 29, 30] }, 'tangwall');
    B.bld('tang', 22, 2, 12, 4, { name: '皇城（唐の朝廷）', role: 'flavor', text: '唐の皇帝がおわす皇城。威容に圧倒される……。' });
    B.bld('tanggate', 26, 8, 5, 2, { name: '朱雀門', role: 'flavor', text: '皇城の正門・朱雀門だ。' });
    B.bld('tangtemple', 2, 16, 7, 4, { name: '西明寺', role: 'saimyoji', id: 'saimyoji' });
    B.bld('tangtemple', 14, 16, 7, 4, { name: '醴泉寺', role: 'library', id: 'reisen' });
    for (const [x, y] of [[1, 30], [4, 30], [7, 30], [1, 34], [4, 34], [7, 34]]) B.o((x + y) % 2 ? 'stall' : 'stall2', x, y, { w: 2, role: 'shop', name: '西市の露店' });
    B.bld('tavern', 13, 30, 6, 4, { name: '酒楼', role: 'tavern', id: 'tavern' });
    B.bld('tangshop', 2, 37, 5, 3, { name: '胡商の店', role: 'shop' }); B.bld('tangshop', 14, 37, 5, 3, { name: '紙と筆の店', role: 'shop' });
    B.bld('tangtemple', 44, 29, 9, 4, { name: '青龍寺', role: 'seiryuji', id: 'seiryuji' });
    B.bld('pagoda', 44, 35, 3, 3, { name: '青龍寺の塔', role: 'flavor', text: '恵果和尚の寺の塔。' });
    for (const [x, y] of [[44, 16], [47, 16], [50, 16], [44, 20], [47, 20]]) B.o((x + y) % 2 ? 'stall' : 'stall2', x, y, { w: 2, role: 'shop', name: '東市の露店' });
    B.bld('tangshop', 33, 15, 5, 3, { name: '東市の店', role: 'shop' }); B.bld('tangshop', 33, 20, 5, 3, { name: '旅籠', role: 'inn' });
    B.bld('tangpagoda', 51, 2, 3, 3, { name: '大雁塔（大慈恩寺）', role: 'flavor', text: '玄奘三蔵が天竺から持ち帰った経典を納めた大雁塔。' });
    B.bld('tangtemple', 43, 2, 6, 3, { name: '大慈恩寺', role: 'temple' });
    B.bld('tanghouse', 2, 2, 5, 3, { name: '民家', role: 'house' }); B.bld('tanghouse', 9, 2, 5, 3, { name: '民家', role: 'house' });
    B.bld('tanghouse', 33, 30, 5, 3, { name: '民家', role: 'house' }); B.bld('tanghouse', 33, 36, 5, 3, { name: '民家', role: 'house' }); B.bld('tanghouse', 21, 36, 4, 3, { name: '民家', role: 'house' });
    B.o('sign', 32, 39, { name: '道標', role: 'sign', id: 'sign' });
    B.o('nobori', 12, 29); B.o('nobori', 19, 29); B.o('well', 22, 22); B.o('well', 38, 13);
    for (let y = 14; y < 41; y += 3) { if (B.free(25, y)) B.o('willow', 25, y); if (B.free(31, y)) B.o('willow', 31, y); }
    m.spots.sign = [31, 39]; m.spots.start = [28, 39];
    B.scatter(0, 0, 56, 42, 40, ['plum', 'tree', 'willow', 'bamboo', 'bush', 'tree']);
                    B.crowd(26, [0, 10, 56, 32], 'choan');
    B.animals(2, [24, 12, 10, 10], 'horse'); B.animals(2, [0, 26, 20, 14], 'chicken'); B.animals(2, [30, 26, 24, 14], 'dog');
  }
};

MAPDEF.dazaifu = {
  id: 'dazaifu', name: () => '筑前国・大宰府', sub: '遠の朝廷', w: 36, h: 26, seed: 97, region: 'jp', pool: 'dazaifu', pos: [8, 62],
  build(B) {
    const m = B.m;
    B.vroad(17, 7, 25, 2); B.hroad(0, 35, 10);
    B.fill(12, 1, 13, 6, 'S');
    B.bld('office', 13, 2, 10, 4, { name: '大宰府政庁', role: 'flavor', text: '九州を治める大宰府の政庁だ。' });
    B.bld('temple', 3, 13, 7, 4, { name: '観世音寺', role: 'kanzeon', id: 'kanzeonji' });
    B.bld('pagoda', 11, 14, 3, 3, { name: '観世音寺の塔', role: 'flavor', text: '' });
    B.bld('inn', 22, 13, 5, 3, { name: '宿', role: 'inn' }); B.bld('shop', 28, 13, 4, 3, { name: '店', role: 'shop' });
    B.bld('house', 22, 20, 4, 3, { name: '民家', role: 'house' }); B.bld('house', 28, 20, 4, 3, { name: '民家', role: 'house' });
    B.o('sign', 19, 23, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [18, 23]; m.spots.start = [18, 23];
    B.scatter(0, 0, 36, 26, 36, ['plum', 'plum', 'pine', 'tree', 'bush', 'sakura']);
    B.crowd(9, [0, 0, 36, 26], 'dazaifu');
  }
};

MAPDEF.koya = {
  id: 'koya', name: () => '紀伊国・高野山', sub: '真言密教の根本道場', w: 46, h: 34, seed: 101, region: 'jp', pool: 'koya', pos: [55, 54], ground: 'M',
  zone: { x: 10, y: 6, w: 26, h: 15 },
  build(B) {
    const m = B.m;
    B.fill(9, 5, 28, 19, 'S'); B.vroad(2, 0, 33, 2, 'W');
    B.vroad(22, 24, 33); B.hroad(36, 42, 8); B.vroad(41, 6, 9);
    B.bld('hut', 21, 21, 4, 2, { name: '草庵（本坊）', role: 'base', id: 'koya_base', site: 'koya' });
    B.o('okunoin', 39, 3, { w: 3, h: 2, name: '奥之院', role: 'okunoin', id: 'okunoin' });
    for (const [x, y] of [[38, 7], [43, 7], [37, 10], [44, 10]]) B.o('gorin', x, y);
    for (let x = 36; x < 43; x += 2) B.o('lantern', x, 10);
    B.o('sign', 24, 30, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [23, 30]; m.spots.start = [23, 30];
    B.reserve(9, 5, 28, 19);
    B.scatter(0, 0, 46, 34, 150, ['cedar', 'cedar', 'cedar', 'cedar', 'maple', 'sakura', 'rock']);
    B.npc({ id: 'jichie', name: '弟子・実恵', spec: { hair: 'bald', robe: '#3a3a48', kesa: '#c07030' }, x: 20, y: 24, wander: 2, when: () => S.flags.koya, lines: ['師よ、伽藍の建立は順調です。', '信徒が増えれば、お布施も増えます。宿坊や茶屋があれば参拝者も喜びましょう。'] });
    B.npc({ id: 'shinzei', name: '弟子・真済', spec: { hair: 'bald', robe: '#4a4a5a', kesa: '#a85a2a', happy: true }, x: 26, y: 24, wander: 2, when: () => S.flags.koya, lines: ['師の詩文を集めて、いつか一冊にまとめたいのです。（のちの『性霊集』）'] });
    B.npc({ id: 'taihan', name: '弟子・泰範', spec: { hair: 'bald', robe: '#5a4a3a', kesa: '#8a6a3a' }, x: 15, y: 22, wander: 2, when: () => S.flags.koya, lines: ['最澄さまのもとを離れ、師のもとで学ぶと決めました。'] });
    B.animals(2, [10, 24, 26, 8], 'dog'); B.animals(2, [0, 0, 46, 34], 'monkey');
  }
};

MAPDEF.toji = {
  id: 'toji', name: () => '東寺（教王護国寺）', sub: '都の真言道場', w: 36, h: 28, seed: 113, region: 'jp', pool: 'toji', pos: [55, 45],
  zone: { x: 6, y: 9, w: 24, h: 11 },
  build(B) {
    const m = B.m;
    B.fill(5, 3, 26, 20, 'S'); B.wallRect(4, 2, 28, 22, { b: [16, 17, 18, 19] });
    B.bld('kondo', 13, 3, 10, 4, { name: '金堂', role: 'temple' });
    B.bld('sobo', 5, 3, 6, 3, { name: '東寺 政所', role: 'base', id: 'toji_base', site: 'toji' });
    B.bld('redgate', 16, 22, 4, 2, { name: '南大門', role: 'flavor', text: '東寺の南大門。' });
    B.hroad(0, 35, 25); B.vroad(17, 24, 27);
    B.o('sign', 21, 26, { name: '道標', role: 'sign', id: 'sign' });
    m.spots.sign = [20, 26]; m.spots.start = [18, 25];
    B.reserve(5, 3, 26, 20);
    B.scatter(0, 0, 36, 28, 30, ['sakura', 'pine', 'tree', 'willow', 'bush']);
    B.crowd(5, [0, 24, 36, 4], 'toji');
  }
};

// 旅の行き先（距離計算用の位置）
const JP_MAPS = ['sanuki', 'shikoku', 'muroto', 'miyako', 'nara', 'naniwa', 'dazaifu', 'koya', 'toji'];

// 伽藍の建物カタログ
const BCAT = [
  { type: 'kondo', name: '金堂', w: 8, h: 4, cost: 800, faith: 30, alms: 70, desc: '本尊を祀る中心のお堂' },
  { type: 'kodo', name: '講堂', w: 7, h: 3, cost: 600, faith: 20, alms: 30, toku: 1, desc: '教えを説く場所。毎月 徳+1' },
  { type: 'daito', name: '根本大塔', w: 4, h: 4, cost: 1500, faith: 55, alms: 90, desc: '密教の宇宙を表す大塔' },
  { type: 'pagoda', name: '五重塔', w: 3, h: 3, cost: 1200, faith: 45, alms: 70, desc: '仏舎利を納める塔' },
  { type: 'sobo', name: '僧坊', w: 5, h: 3, cost: 300, faith: 6, alms: 10, monks: 3, desc: '弟子が住む。修行の効果アップ' },
  { type: 'mieido', name: '御影堂', w: 4, h: 3, cost: 500, faith: 18, alms: 40, desc: '祖師を祀るお堂' },
  { type: 'inn', name: '宿坊', w: 5, h: 3, cost: 400, faith: 12, alms: 55, desc: '参拝者が泊まれる。お布施が増える' },
  { type: 'teahouse', name: '茶屋', w: 4, h: 3, cost: 200, faith: 4, alms: 35, desc: '参拝者がひと休み' },
  { type: 'ink', name: '写経所', w: 4, h: 3, cost: 300, faith: 8, alms: 40, bun: 1, desc: '写経で収入。毎月 文才+1' },
  { type: 'gakuin', name: '綜芸種智院', w: 6, h: 3, cost: 1000, faith: 40, alms: 20, toku: 3, desc: '身分を問わず学べる学校（東寺のみ）', only: 'toji' },
  { type: 'bell', name: '鐘楼', w: 1, h: 1, cost: 150, faith: 5, alms: 5, obj: 1, desc: '鐘の音が人を呼ぶ' },
  { type: 'lantern', name: '灯籠', w: 1, h: 1, cost: 30, faith: 1, alms: 0, obj: 1, deco: 1, desc: '景観+（近くのお堂の信仰アップ）' },
  { type: 'cedar', name: '杉', w: 1, h: 1, cost: 15, faith: 0, alms: 0, obj: 1, deco: 1, desc: '景観+' },
  { type: 'sakura', name: '桜', w: 1, h: 1, cost: 25, faith: 1, alms: 0, obj: 1, deco: 1, desc: '景観+' },
  { type: 'maple', name: '紅葉', w: 1, h: 1, cost: 25, faith: 1, alms: 0, obj: 1, deco: 1, desc: '景観+' },
  { type: 'gorin', name: '五輪塔', w: 1, h: 1, cost: 40, faith: 2, alms: 2, obj: 1, deco: 1, desc: '供養の塔' }
];
