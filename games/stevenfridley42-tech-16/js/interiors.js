'use strict';
// =====================================================================
//  interiors.js — 建物の中（室内マップ）
//  建物に入ると室内マップに切り替わり、家具や人に話しかけて行動する
// =====================================================================

// 外の役割 → 室内のつくり
const INTERIOR_OF = {
  home: 'home', home2: 'home', salon: 'home', temple: 'temple', kaidan: 'temple', kanzeon: 'temple', takao: 'temple', saimyoji: 'temple', seiryuji: 'temple',
  school: 'school', shop: 'shop', inn: 'inn', teahouse: 'teahouse', court: 'court', yamen: 'court', tavern: 'tavern', library: 'library', base: 'base', hut: 'hut'
};
const SEAT = (o) => Object.assign({ seat: true }, o);

// 建物ごとの住人（id は外の建物の id）
const INT_NPCS = {
  saeki: [
    { id: 'mother', name: '母・玉依御前', spec: SEAT({ hair: 'long', robe: '#b05a7a', layer: '#f0d890', happy: true }), x: 9, y: 6, lines: ['真魚や、体には気をつけるのですよ。', '布団はいつでも敷いてありますからね。', '父上は屋敷の外にいらっしゃいますよ。'] },
    { name: '妹', spec: SEAT({ hair: 'bun', robe: '#e07a8a', happy: true }), x: 12, y: 6, lines: ['兄さま、都のお土産、忘れないでね！'] }
  ],
  ujidera: [{ id: 'osho', name: '氏寺の和尚', spec: SEAT({ hair: 'bald', robe: '#4a4a5a', kesa: '#a85a2a', white: true }), x: 12, y: 6, lines: ['寺ではいつでも修行ができる。奥の布団で休んでもよいぞ。', '仏前で経を唱えれば法力が、座布団で瞑想すれば心が鍛えられる。'] }],
  yorozu: [{ id: 'tenshu', name: 'よろず屋の主人', spec: SEAT({ hair: 'top', robe: '#6a5a8a', belt: '#e8d8b0', happy: true }), x: 9, y: 4, act: 'shop', lines: [] }],
  atohouse: [
    { id: 'otari', name: '叔父・阿刀大足', spec: SEAT({ hair: 'kanmuri', robe: '#3a4a7a', beard: '#2a2a2a' }), x: 10, y: 4, act: 'lesson' },
    { name: '書生', spec: SEAT({ hair: 'eboshi', robe: '#6a7a5a' }), x: 4, y: 8, lines: ['大足先生の講義は一日に一度。朝のうちに受けるとよい。', '本棚の経書は自由に読んでよいそうだ。'] }
  ],
  daigaku: [
    { id: 'hakase', name: '明経博士', spec: SEAT({ hair: 'kanmuri', robe: '#5a2a3a', beard: '#3a2a2a' }), x: 12, y: 3, act: 'lecture' },
    ...[[4, 8], [9, 8], [15, 8], [20, 8], [4, 11], [15, 11], [20, 11]].map(([x, y], i) => ({ name: '学生', spec: SEAT({ hair: 'eboshi', robe: ['#4a5a9a', '#3a6a5a', '#7a3a5a', '#5a4a7a'][i % 4] }), x, y, dir: 1, lines: ['毛詩の暗誦が終わらぬ……', 'あの讃岐の者、もう周易を覚えたらしいぞ。', '大学を出ても、家柄がなければ出世は難しいのだ。'] }))
  ],
  chodo: [
    { id: 'saga', name: '嵯峨天皇', spec: SEAT({ hair: 'crown', robe: '#c8a040', fan: true }), x: 12, y: 3, when: () => S.year >= 809, act: 'court' },
    { name: '桓武天皇', spec: SEAT({ hair: 'crown', robe: '#a88030' }), x: 12, y: 3, when: () => S.year < 806, lines: ['……'] },
    ...[[5, 6], [5, 9], [19, 6], [19, 9]].map(([x, y], i) => ({ name: '公卿', spec: SEAT({ hair: 'kanmuri', robe: ['#3a3a6a', '#8a2a3a', '#2a5a4a', '#6a3a7a'][i] }), x, y, dir: x < 12 ? 3 : 2, lines: ['帝の御前であるぞ。', '唐の詩文に通じた者は重く用いられる。'] }))
  ],
  kaidan: [{ name: '戒師', spec: SEAT({ hair: 'bald', robe: '#5a3a2a', kesa: '#c89030', white: true }), x: 12, y: 6, lines: ['戒を守ってこその僧である。'] }],
  todaiji: [{ name: '東大寺の学僧', spec: SEAT({ hair: 'bald', robe: '#3a3a4a', kesa: '#a85a2a' }), x: 12, y: 6, lines: ['華厳の教えでは、一つの中にすべてがあり、すべての中に一つがあるという。'] }],
  saimyoji: [{ id: 'eichu', name: '永忠', spec: SEAT({ hair: 'bald', robe: '#3a3a48', kesa: '#a85a2a' }), x: 12, y: 6, when: () => stepBefore('keika'), lines: ['西明寺の部屋は自由に使うとよい。'] }],
  reisen: [{ id: 'hannya', name: '般若三蔵', spec: SEAT({ hair: 'bald', robe: '#c0703a', kesa: '#e0a040', skin: '#c8946a', beard: '#3a2a20' }), x: 11, y: 5, lines: ['梵字は、ひとつひとつが仏の働きを宿しているのです。'] }],
  seiryuji: [
    { id: 'keika', name: '恵果和尚', spec: SEAT({ hair: 'bald', robe: '#7a5a3a', kesa: '#c8402a', white: true }), x: 12, y: 5, when: () => !S.flags.keikaDead, lines: ['早く日本に帰り、教えを広めなさい。'] },
    { id: 'gimyo', name: '恵果の弟子・義明', spec: SEAT({ hair: 'bald', robe: '#8a6a3a', kesa: '#c03a2a' }), x: 16, y: 7, lines: ['師はあなたのことを、ずっと待っておられたのです。'] }
  ],
  yamen: [{ id: 'yakunin', name: '唐の役人', spec: SEAT({ hair: 'tang', robe: '#3a3a8a', beard: '#2a2a2a' }), x: 12, y: 3, lines: ['（唐の言葉）書状は確かに受け取った。'] }],
  tavern: [...[[4, 6], [8, 6], [11, 6], [17, 6], [5, 10], [11, 10]].map(([x, y], i) => ({ name: ['長安の文人', '詩人', '胡商', '若い官人'][i % 4], spec: SEAT(i % 4 === 2 ? { hair: 'turban', robe: '#7a4a8a', beard: '#6a3a1a', skin: '#e8c098' } : { hair: 'tang', robe: ['#b84a3a', '#3a6a8a', '#7a6a3a'][i % 3] }), x, y, lines: ['ここでは毎晩のように詩会が開かれる。卓に着けば誰でも加われるよ。', '日本の僧の詩、聞いてみたいものだ。', '詩の命は韻だ。二句目と四句目の響きをそろえるのだ。'] }))],
  kanzeonji: [{ name: '観世音寺の僧', spec: SEAT({ hair: 'bald', robe: '#4a4a5a', kesa: '#a85a2a' }), x: 12, y: 6, lines: ['ここ観世音寺は九州一の大寺。都の許しが下りるまで、ゆるりと過ごされよ。'] }],
  takao: [{ name: '高雄山寺の僧', spec: SEAT({ hair: 'bald', robe: '#3a3a48', kesa: '#a85a2a' }), x: 15, y: 6, lines: ['紅葉の季節は格別ですよ。'] }],
  koya_base: [{ name: '弟子・実恵', spec: SEAT({ hair: 'bald', robe: '#3a3a48', kesa: '#c07030' }), x: 14, y: 6, lines: ['地図の机で、伽藍の配置を考えましょう。'] }],
  toji_base: [{ name: '東寺の執事', spec: SEAT({ hair: 'bald', robe: '#4a4a5a', kesa: '#a85a2a' }), x: 14, y: 6, lines: ['東寺の伽藍の造営、いつでもお申し付けください。'] }]
};
// 既定の住人（id のない建物）
const DEFAULT_NPCS = {
  temple: [{ name: '寺の僧', spec: SEAT({ hair: 'bald', robe: '#3a3a48', kesa: '#a85a2a' }), x: 12, y: 6, lines: ['仏前で読経、座布団で瞑想ができますぞ。', '奥の布団は宿坊です。旅のお方もどうぞ。'] }],
  shop: [{ name: '店の主人', spec: SEAT({ hair: 'top', robe: '#6a5a8a', belt: '#e8d8b0', happy: true }), x: 9, y: 4, act: 'shop' }],
  inn: [{ name: '宿の主人', spec: SEAT({ hair: 'top', robe: '#7a5a3a', happy: true }), x: 10, y: 9, act: 'inn' }],
  teahouse: [{ name: '茶屋の娘', spec: { hair: 'bun', robe: '#e07a5a', happy: true }, x: 8, y: 3, wander: 2, act: 'tea' }],
  home: [{ name: '屋敷の主', spec: SEAT({ hair: 'eboshi', robe: '#5a4a7a', fan: true }), x: 10, y: 4, act: 'salon' }, { name: '女房', spec: SEAT({ hair: 'long', robe: '#d04060', layer: '#f0d060' }), x: 13, y: 5, lines: ['今宵も歌会がございますのよ。'] }],
  library: [{ name: '訳経僧', spec: SEAT({ hair: 'bald', robe: '#8a6a3a', kesa: '#c03a2a' }), x: 11, y: 5, lines: ['経典をインドの言葉から漢語へ訳しているのです。'] }],
  court: [], tavern: [], school: [], base: [], hut: []
};

function interiorNPCs(o) {
  const tpl = INTERIOR_OF[o.role];
  if (o.id && INT_NPCS[o.id]) return INT_NPCS[o.id];
  if (o.role === 'home2') return [];
  return DEFAULT_NPCS[tpl] || [];
}

// ----- 室内のつくり -----
function room(B, w, h, floor) {
  B.fill(0, 0, w, h, 'Y'); B.fill(1, 2, w - 2, h - 3, floor);
  const dx = (w >> 1) - 1; B.set(dx, h - 1, 'E'); B.set(dx + 1, h - 1, 'E'); B.set(dx, h - 2, floor); B.set(dx + 1, h - 2, floor);
  return dx;
}
const ITPL = {
  home(B, o) {
    const w = 20, h = 13; room(B, w, h, 'J'); B.fill(1, h - 3, w - 2, 2, 'O'); B.fill(9, h - 3, 2, 2, 'O');
    B.o('shojiW', 3, 1, { w: 2, solid: false }); B.o('shojiW', 15, 1, { w: 2, solid: false }); B.o('kakejiku', 9, 1, { solid: false });
    B.o('shelf', 1, 2, { w: 2, role: 'i:study', name: '本棚（経書）' });
    B.o('deskI', 4, 5, { w: 2, role: 'i:calli', name: '文机' });
    B.o('futon', 17, 3, { h: 2, role: 'i:sleep', name: '布団' });
    B.o('tansu', 15, 3); B.o('byobu', 12, 2, { w: 2 }); B.o('hibachi', 10, 8);
    B.o('andon', 2, 8); B.o('andon', 17, 8);
    return { w, h };
  },
  temple(B, o) {
    const w = 24, h = 15; room(B, w, h, o.tang ? 'Q' : 'V');
    B.fill(8, 2, 8, 3, 'U');
    B.o('altar', 10, 2, { w: 4, h: 2, role: 'i:sutra', name: '本尊（仏前）' });
    for (const [x, y] of [[5, 4], [18, 4], [5, 10], [18, 10]]) B.o(o.tang ? 'pillarR' : 'pillarI', x, y);
    B.o('andon', 8, 5); B.o('andon', 15, 5); B.o('censer', 12, 6, { solid: false });
    B.o('saisen', 11, 8, { w: 2, role: 'i:donate', name: '賽銭箱' });
    for (const x of [8, 10, 13, 15]) B.o('cushion', x, 10, { role: 'i:med', name: '座布団（瞑想）', solid: false });
    B.o('futon', 21, 3, { h: 2, role: 'i:sleep', name: '宿坊の布団' }); B.o('byobu', 19, 6, { w: 2 });
    B.o('deskI', 1, 11, { w: 2, role: 'i:shakyo', name: '写経の机' });
    B.o('kakejiku', 3, 1, { solid: false }); B.o('kakejiku', 20, 1, { solid: false });
    return { w, h };
  },
  school(B, o) {
    const w = 24, h = 15; room(B, w, h, 'V'); B.fill(8, 2, 8, 2, 'U');
    B.o('kakejiku', 11, 1, { solid: false }); B.o('kakejiku', 13, 1, { solid: false });
    B.o('shelf', 1, 2, { w: 2, role: 'i:study', name: '書庫' }); B.o('shelf', 21, 2, { w: 2, role: 'i:study', name: '書庫' });
    for (const y of [7, 10]) for (const x of [3, 8, 14, 19]) B.o('deskI', x, y, { w: 2, solid: true });
    B.o('andon', 7, 3); B.o('andon', 16, 3);
    return { w, h };
  },
  shop(B, o) {
    const w = 18, h = 12; room(B, w, h, 'V'); B.fill(1, 6, w - 2, h - 7, 'O');
    B.o('goods', 2, 2, { w: 2 }); B.o('goods', 13, 2, { w: 2 }); B.o('shelf', 5, 2, { w: 2 });
    B.o('counter', 6, 5, { w: 3, role: 'i:shop', name: '帳場' }); B.o('counter', 9, 5, { w: 3, role: 'i:shop', name: '帳場' });
    B.o('barrel', 2, 7); B.o('barrel', 3, 8); B.o('pot', 15, 7); B.o('pot', 14, 8); B.o('andon', 15, 5);
    return { w, h };
  },
  inn(B, o) {
    const w = 20, h = 13; room(B, w, h, 'J'); B.fill(1, h - 3, w - 2, 2, 'O');
    for (const x of [2, 5, 14, 17]) B.o('futon', x, 3, { h: 2, role: 'i:sleep', name: '客間の布団' });
    B.o('byobu', 8, 2, { w: 2 }); B.o('hibachi', 10, 6); B.o('andon', 8, 6); B.o('andon', 12, 6); B.o('shojiW', 9, 1, { w: 2, solid: false });
    return { w, h };
  },
  teahouse(B, o) {
    const w = 16, h = 11; room(B, w, h, 'O');
    for (const [x, y] of [[2, 4], [11, 4], [2, 7], [11, 7]]) B.o('bench', x, y, { w: 2, role: 'i:tea', name: '縁台' });
    B.o('pot', 6, 2); B.o('barrel', 9, 2); B.o('shojiW', 3, 1, { w: 2, solid: false }); B.o('shojiW', 11, 1, { w: 2, solid: false });
    return { w, h };
  },
  court(B, o) {
    const w = 24, h = 15; room(B, w, h, o.tang ? 'Q' : 'V'); B.fill(8, 2, 8, 3, 'U');
    B.o('misu', 10, 1, { w: 4, solid: false });
    for (const [x, y] of [[3, 4], [20, 4], [3, 10], [20, 10]]) B.o(o.tang ? 'pillarR' : 'pillarI', x, y);
    B.o('andon', 7, 3); B.o('andon', 16, 3); B.o('byobu', 1, 2, { w: 2 }); B.o('byobu', 21, 2, { w: 2 });
    return { w, h };
  },
  tavern(B, o) {
    const w = 22, h = 13; room(B, w, h, 'V');
    for (const [x, y] of [[5, 5], [10, 5], [16, 5], [5, 9], [10, 9], [16, 9]]) B.o('tableI', x, y, { w: 2, role: 'i:poem', name: '詩会の卓' });
    for (const x of [3, 9, 13, 19]) B.o('lanternR', x, 1, { solid: false });
    B.o('goods', 1, 2, { w: 2 }); B.o('barrel', 19, 3); B.o('barrel', 20, 4);
    return { w, h };
  },
  library(B, o) {
    const w = 22, h = 13; room(B, w, h, 'Q');
    for (const x of [1, 4, 7, 13, 16, 19]) B.o('shelf', x, 2, { w: 2, role: 'i:bonji', name: '梵本の書架' });
    B.o('deskI', 9, 6, { w: 2, role: 'i:calli', name: '翻訳の机' }); B.o('deskI', 12, 6, { w: 2 }); B.o('andon', 8, 9); B.o('andon', 14, 9);
    return { w, h };
  },
  base(B, o) {
    const w = 22, h = 13; room(B, w, h, 'J'); B.fill(9, 2, 4, 2, 'U');
    B.o('altar', 9, 2, { w: 4, h: 2, role: 'i:sutra', name: '持仏堂' });
    B.o('mapdesk', 3, 5, { w: 2, role: 'i:build', name: '伽藍の絵図（建立）' });
    B.o('futon', 19, 3, { h: 2, role: 'i:sleep', name: '布団' }); B.o('deskI', 3, 8, { w: 2, role: 'i:calli', name: '文机' });
    B.o('shelf', 16, 2, { w: 2, role: 'i:study', name: '経蔵' }); B.o('andon', 8, 7); B.o('andon', 14, 7); B.o('cushion', 10, 7, { role: 'i:wait', name: '座して時を待つ', solid: false });
    return { w, h };
  },
  hut(B, o) {
    const w = 14, h = 10; room(B, w, h, 'O');
    B.o('strawmat', 3, 3, { role: 'i:fast', name: '断食の座' }); B.o('strawmat', 10, 3, { role: 'i:sleep', name: '藁の寝床' });
    B.o('irori', 6, 5); B.o('pot', 2, 6); B.o('kakejiku', 6, 1, { solid: false });
    return { w, h };
  }
};

function interiorKey(o, parent) { return 'in:' + parent + ':' + (o.id || (o.tx + '_' + o.ty)); }
function buildInteriorMap(o, parent) {
  const key = interiorKey(o, parent);
  if (G.mapCache[key]) return G.mapCache[key];
  const tpl = INTERIOR_OF[o.role];
  const tang = MAPDEF[parent].region === 'cn';
  const def = { id: key, w: 26, h: 16, seed: (o.tx * 31 + o.ty * 7) | 0, ground: 'Y', region: MAPDEF[parent].region, pool: MAPDEF[parent].pool, name: () => o.name, sub: MAPDEF[parent].name() };
  const m = newMap(def);
  const B = Builder(m);
  const sz = ITPL[tpl](B, Object.assign({ tang }, o));
  // サイズに合わせて縮める
  const w = sz.w, h = sz.h, tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push(m.tiles[y * m.w + x]);
  m.w = w; m.h = h; m.tiles = tiles; def.w = w; def.h = h;
  m.t = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : m.tiles[y * w + x];
  m.npcs = interiorNPCs(o).map(n => Object.assign({ wander: 0 }, n));
  const dx = (w >> 1) - 1;
  m.spots.start = [dx, h - 2]; m.spots.door = [dx, h - 1];
  m.interior = true; m.parent = parent; m.from = o; m.tpl = tpl;
  m.ground = drawGround(m);
  G.mapCache[key] = m;
  return m;
}
