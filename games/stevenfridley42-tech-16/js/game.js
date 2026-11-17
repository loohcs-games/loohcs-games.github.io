'use strict';
// =====================================================================
//  game.js — エンジン本体（移動・描画・UI・時刻・室内・経営・旅）
// =====================================================================
const VW = 480, VH = 300;
const view = document.getElementById('view'), VG = view.getContext('2d'); VG.imageSmoothingEnabled = false;
const $ = id => document.getElementById(id);
let S = null;
const G = { M: null, p: { x: 0, y: 0, dir: 0, f: 0, anim: 0, moving: false }, npcs: [], cam: { x: 0, y: 0 }, frame: 0, keys: {}, lock: 0, build: null, target: null, mapCache: {}, started: false, last: 0 };
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]];
const TIME_RATE = 3;          // 歩いている間：現実1秒 = 3分
const DAY_START = 6 * 60, LATE = 22 * 60, LIMIT = 26 * 60;

// ---------------- 状態 ----------------
function defaultState() {
  return {
    name: '真魚', year: 788, month: 4, day: 1, min: 7 * 60, totalDays: 0, hp: 100, maxhp: 100, horiki: 3, memory: 8, bun: 6, toku: 0, money: 100, followers: 0, fame: 0,
    items: { food: 0, ink: 0, incense: 0 }, step: 0, flags: {}, rel: { saicho: 0 }, cnt: {}, daily: {}, unlocked: ['sanuki'], built: { koya: [], toji: [] },
    quests: {}, takuhatsu: {}, map: 'sanuki', px: 0, py: 0, dir: 0, phaseStart: 0, hints: {}
  };
}
function eraStr(y) { const E = [[834, '承和'], [824, '天長'], [810, '弘仁'], [806, '大同'], [782, '延暦']]; for (const [s, n] of E) if (y >= s) { const k = y - s + 1; return n + (k === 1 ? '元' : k) + '年'; } return ''; }
function age() { return S.year - 774 + 1; }
function gain(k, v) { S[k] = Math.max(0, Math.round((S[k] || 0) + v)); const N = { horiki: '法力', memory: '記憶力', bun: '文才', toku: '徳', fame: '名声', followers: '信徒', money: '銭' }; if (N[k] && v) toast(N[k] + (v > 0 ? ' +' : ' ') + v); updateHUD(); checkSkills(); }
function setYear(y, m) { if (y > S.year || (y === S.year && m > S.month)) { S.year = y; S.month = m || S.month; S.day = 1; } updateHUD(); }
function unlock(id) { if (!S.unlocked.includes(id)) S.unlocked.push(id); }
function hasBuilt(site, type) { return (S.built[site] || []).some(b => b.type === type); }
function inc(k, v = 1) { S.cnt[k] = (S.cnt[k] || 0) + v; }
function onceToday(k) { if (S.daily[k] === S.totalDays) return false; S.daily[k] = S.totalDays; return true; }
function doneToday(k) { return S.daily[k] === S.totalDays; }

// ---------------- 時刻 ----------------
const KOKU = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
function clockStr(min = S.min) {
  const m = ((min % 1440) + 1440) % 1440, h = Math.floor(m / 60), k = KOKU[Math.floor(((h + 1) % 24) / 2)];
  const part = h < 5 ? '深夜' : h < 7 ? '明け方' : h < 11 ? '朝' : h < 14 ? '昼' : h < 17 ? '午後' : h < 19 ? '夕方' : h < 23 ? '夜' : '深夜';
  return k + 'の刻（' + part + ' ' + h + '時' + String(m % 60 | 0).padStart(2, '0') + '分）';
}
function lightLevel(min = S.min) {
  const h = (min / 60) % 24;
  let D = 0; if (h >= 17 && h < 20) D = (h - 17) / 3 * .44; else if (h >= 20 || h < 4.5) D = .44; else if (h >= 4.5 && h < 6.5) D = .44 * (1 - (h - 4.5) / 2);
  let W = 0; if (h >= 5 && h < 7.5) W = .14 * (1 - Math.abs(h - 6) / 1.5); if (h >= 15.5 && h < 19) W = .18 * (1 - Math.abs(h - 17.5) / 2);
  return { D: Math.max(0, D), W: Math.max(0, W) };
}
// 行動に時間を使う（夜遅くは不可）
async function useTime(hours, what) {
  if (S.min + hours * 60 > LIMIT) { await say([[NARR, 'もう夜も更けた。' + (what || 'それ') + 'は明日にして、今日は休もう。']]); return false; }
  S.min += hours * 60; updateHUD(); return true;
}
function dayInc() {
  S.day++; S.totalDays++; dailyQuests();
  if (S.day > 30) { S.day = 1; S.month++; if (S.month > 12) { S.month = 1; S.year++; } monthTick(); }
}
function advanceDays(n) { for (let i = 0; i < n; i++) dayInc(); S.min = 8 * 60; updateHUD(); }
// 眠って翌朝へ（演出つき）
function sleepFx(lines) {
  return new Promise(res => {
    const el = $('sleepfx'); el.className = 'night'; el.classList.remove('hidden');
    $('sfxtext').textContent = lines || '―― 夜が更けていく ――'; $('sfxdate').textContent = '';
    setTimeout(() => {
      el.classList.add('show');
      setTimeout(() => {
        dayInc(); S.min = DAY_START; S.hp = S.maxhp;
        el.className = 'morning show'; $('sfxtext').textContent = '朝';
        $('sfxdate').textContent = eraStr(S.year) + '（' + S.year + '年）' + S.month + '月' + S.day + '日';
        updateHUD();
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.className = 'hidden'; res(); }, 900); }, 1700);
      }, 1500);
    }, 30);
  });
}
async function goSleep(cost, place) {
  if (cost > S.money) { await say([[NARR, '銭が足りない。（' + cost + '銭）']]); return; }
  if (S.min < 16 * 60) {
    const c = await choose('まだ日が高い。どうする？', ['昼寝をする（2時間・体力+30）', 'やめる']);
    if (c !== 0) return; if (!(await useTime(2))) return; S.hp = Math.min(S.maxhp, S.hp + 30); toast('体力 +30'); return;
  }
  const c = await choose(place + 'で眠りますか？' + (cost ? '（' + cost + '銭）' : ''), ['眠る（翌朝まで・体力全快）', 'まだ起きている']);
  if (c !== 0) return;
  S.money -= cost;
  await sleepFx();
  save(true);
  await afterWake();
}
async function afterWake() {
  await morningGift();
  const st = STORY[S.step];
  if (st && st.target === 'phase' && phaseDone(st)) { await runStep(st); return; }
  if (st && st.target === 'phase') { const g = st.goal(); toast('【' + st.short + '】' + g.map(x => x[0] + ' ' + Math.min(x[1], x[2]) + '/' + x[2]).join('　')); }
}
function phaseDone(st) { return st.goal().every(x => x[1] >= x[2]); }
async function forcedSleep() {
  G.lock++;
  await say([[NARR, '眠気に勝てず、' + S.name + 'はその場で眠り込んでしまった……。']]);
  await sleepFx('―― 眠り込んでしまった ――');
  S.hp = Math.round(S.maxhp * .6);
  if (G.M.m.interior) { /* そのまま */ } else { /* 外で寝た */ toast('外で眠ったので疲れが残っている（体力60%）'); }
  G.lock--; await afterWake();
}

// ---------------- 経営・月ごと ----------------
function siteStats(site) {
  const list = S.built[site] || []; let faith = 0, alms = 0, toku = 0, bun = 0, monks = 0, deco = 0;
  for (const b of list) { const c = BCAT.find(x => x.type === b.type); if (!c) continue; faith += c.faith; alms += c.alms; toku += c.toku || 0; bun += c.bun || 0; monks += c.monks || 0; if (c.deco) deco++; }
  const mult = 1 + Math.min(.6, deco * .025);
  return { faith: faith * mult, alms: alms * mult, toku, bun, monks, deco, mult, count: list.length };
}
function monthTick() {
  let faith = 0, alms = 0, tk = 0, bn = 0;
  for (const s of ['koya', 'toji']) { const st = siteStats(s); faith += st.faith; alms += st.alms; tk += st.toku; bn += st.bun; }
  const fg = Math.round((faith + S.fame * .06) * (1 + S.toku / 200));
  const mg = Math.round(alms + S.followers * .2);
  S.followers += fg; S.money += mg; S.toku += tk; S.bun += bn;
  if (fg || mg) toast(S.month + '月：お布施 +' + mg + '銭　信徒 +' + fg + '人');
  S.takuhatsu = {};
}
function dailyQuests() { for (const id of S.unlocked) { if (!S.quests[id] && Math.random() < .12) S.quests[id] = newQuest(); } }

// ---------------- 依頼 ----------------
function newQuest() { const t = ['sick', 'letter', 'repair', 'teach'][(Math.random() * 4) | 0]; return { type: t, npc: (Math.random() * 1000) | 0 }; }
async function runQuest(n) {
  const mid = mapRoot(); const q = S.quests[mid]; if (!q) return;
  const done = () => { delete S.quests[mid]; n.quest = false; };
  if (q.type === 'sick') {
    await say([[n.name, '家の者が熱病で寝込んでいるのです……どうかお祈りを！']]);
    if (!S.flags.upasaka) { await say([[n.name, '……あ、修行者さまではありませんでしたか。']]); return; }
    const c = await choose('病平癒の祈祷を行いますか？（2時間）', ['祈祷する', 'やめておく']); if (c) return;
    if (!(await useTime(2, '祈祷'))) return;
    const r = await mgRitual({ title: '病平癒の祈祷', enemy: 'plague', hp: 50 + Math.min(80, (S.year - 790) * 3), atk: 7, winText: '熱が引いた！' });
    if (r.win) { await say([[n.name, 'ああ、熱が下がりました！　なんとお礼を申せば……']]); gain('toku', 3); gain('followers', 15); gain('money', 30); gain('horiki', 1); done(); }
    else await say([[n.name, 'まだ苦しそうです……また来てください。']]);
  } else if (q.type === 'letter') {
    await say([[n.name, '遠くの家族へ手紙を書きたいのですが、字が書けないのです。代筆をお願いできませんか？']]);
    const c = await choose('代筆しますか？（1時間）', ['書いてあげる', 'やめておく']); if (c) return;
    if (!(await useTime(1, '代筆'))) return;
    const keys = Object.keys(STROKES).filter(k => STROKES[k].length <= 4); const ch = [keys[(Math.random() * keys.length) | 0], keys[(Math.random() * keys.length) | 0]];
    const sc = await mgCalligraphy({ title: '手紙の代筆', doc: '手紙', chars: ch });
    await say([[n.name, sc > .6 ? 'なんと美しい字！　家族も喜びます。' : 'ありがとうございます！']]);
    gain('money', 30 + Math.round(sc * 70)); gain('bun', 2); gain('followers', 6); done();
  } else if (q.type === 'repair') {
    const what = ['橋', '井戸', '道', 'ため池の堤'][n.seed % 4];
    await say([[n.name, '村の' + what + 'が壊れてしまって……直すための寄進を集めているのです。']]);
    const c = await choose('100銭を寄進して工事を手伝いますか？（4時間・所持 ' + S.money + '銭）', ['寄進して手伝う', 'やめておく']); if (c) return;
    if (S.money < 100) { await say([[NARR, '銭が足りない。']]); return; }
    if (!(await useTime(4, '工事'))) return;
    S.money -= 100; await say([[NARR, S.name + 'は村人たちと共に汗を流し、' + what + 'を直した。'], [n.name, 'ありがとうございます！　みんな、あなたのことを忘れません。']]);
    gain('toku', 4); gain('followers', 22); done();
  } else {
    await say([[n.name, '子どもたちに字を教えてやってくれませんか？']]);
    const c = await choose('字を教えますか？（2時間）', ['教える', 'やめておく']); if (c) return;
    if (!(await useTime(2, '手習い'))) return;
    const sc = await mgMemory({ title: '手習いの先生', set: 'kanji', n: 3, rounds: 2 });
    await say([[n.name, '子どもたちが楽しそうに字を覚えています！']]); gain('toku', 2); gain('followers', 10 + Math.round(sc * 8)); gain('memory', 1); done();
  }
}

// ---------------- マップ ----------------
function getMapData(id) {
  if (G.mapCache[id]) return G.mapCache[id];
  const def = MAPDEF[id]; const m = newMap(def); def.build(Builder(m)); m.ground = drawGround(m); G.mapCache[id] = m; return m;
}
function mapRoot() { return G.M ? (G.M.m.parent || G.M.id) : null; }
function buildRuntime(id) {
  const m = getMapData(id);
  const objs = m.objs.slice();
  if (!m.interior) for (const b of (S.built[id] || [])) {
    const c = BCAT.find(x => x.type === b.type); if (!c) continue;
    objs.push(c.obj ? { kind: 'obj', type: b.type, tx: b.tx, ty: b.ty, w: 1, h: 1, solid: true, built: 1 } : { kind: 'bld', type: b.type, tx: b.tx, ty: b.ty, w: c.w, h: c.h, solid: true, name: c.name, role: 'built', built: 1 });
  }
  const solid = new Uint8Array(m.w * m.h), objAt = new Int32Array(m.w * m.h).fill(-1);
  for (let i = 0; i < m.w * m.h; i++) { const t = m.tiles[i]; if (t === 'W' || t === 'X' || t === 'Y') solid[i] = 1; }
  objs.forEach((o, k) => {
    for (let j = o.ty; j < o.ty + o.h; j++) for (let i = o.tx; i < o.tx + o.w; i++) {
      if (i < 0 || j < 0 || i >= m.w || j >= m.h) continue; const idx = j * m.w + i;
      if (o.role || objAt[idx] < 0) objAt[idx] = k;
      if (!o.solid) continue;
      if ((o.edgeOnly || o.type === 'torii') && i !== o.tx && i !== o.tx + o.w - 1) continue;
      solid[idx] = 1;
    }
    if (o.type === 'torii') o.solid = false;
  });
  for (let i = 0; i < m.w * m.h; i++) if (m.tiles[i] === 'K' && objAt[i] < 0) solid[i] = 0;
  return { id, m, def: m.def, ground: m.ground, objs, solid, objAt, w: m.w, h: m.h };
}
const NPC_NAMES = { farmer: '農夫', farmerW: '村の女', child: '子ども', noble: '貴族', lady: '女房', official: '役人', monk: '僧', ascetic: '修行者', merchant: '商人', fisher: '漁師', tang: '唐の人', tangW: '唐の女', hu: '胡商（ソグド人）', tangmonk: '唐の僧', pilgrim: '参拝者', soldier: '兵士' };
function spawnNPCs() {
  const M = G.M, list = [], gen = [];
  const night = !M.m.interior && (S.min >= 20 * 60 || S.min < 5 * 60);
  for (const n of M.m.npcs) {
    if (n.when && !n.when()) continue;
    if (night && n.generic && (n.seed % 3)) continue;   // 夜は人通りが減る
    const r = Rng(n.seed || (n.x * 97 + n.y));
    const spec = n.animal ? { animal: n.animal } : n.spec || preset(n.preset, n.seed);
    const name = n.name || (n.animal ? '' : NPC_NAMES[n.preset] || '村人');
    const e = { def: n, id: n.id, name, spec, x: n.x * TS + 8, y: n.y * TS + 12, hx: n.x, hy: n.y, dir: n.dir || 0, f: 0, anim: 0, wait: (r() * 120) | 0, tx: null, ty: null, wander: n.wander ?? 3, lines: n.lines, act: n.act, generic: n.generic, pool: n.pool, seed: n.seed || 0 };
    list.push(e); if (n.generic) gen.push(e);
  }
  if ((M.id === 'koya' || M.id === 'toji') && !night) {
    const z = M.def.zone, cnt = Math.min(26, Math.floor(S.followers / 40)), r = Rng(S.followers + 3);
    for (let k = 0, c = 0; k < cnt * 8 && c < cnt; k++) {
      const x = z.x + ((r() * z.w) | 0), y = z.y + ((r() * (z.h + 3)) | 0); if (M.solid[y * M.w + x]) continue;
      list.push({ id: null, name: '参拝者', spec: preset('pilgrim', k + 5), x: x * TS + 8, y: y * TS + 12, hx: x, hy: y, dir: 0, f: 0, anim: 0, wait: (r() * 100) | 0, wander: 5, pilgrim: true, seed: k }); c++;
    }
  }
  const q = S.quests[M.id];
  if (q && gen.length) gen[q.npc % gen.length].quest = true;
  return list;
}
function refreshNPCs() { if (G.M) G.npcs = spawnNPCs(); }
function refreshPlayer() { updateHUD(); }
function showLoc(name, sub) {
  const L = $('loc'); L.innerHTML = name + '<small>' + (sub || '') + '</small>'; L.classList.remove('hidden'); L.style.opacity = 1;
  clearTimeout(L._t); L._t = setTimeout(() => { L.style.opacity = 0; setTimeout(() => L.classList.add('hidden'), 800); }, 1800);
}
async function warp(id, spot, dir = 0) {
  if (!id.startsWith('in:')) { S.map = id; setTimeout(() => kenbun('map:' + id, MAPDEF[id].name()), 2500); }
  G.M = buildRuntime(id);
  const sp = Array.isArray(spot) ? spot : (G.M.m.spots[spot] || G.M.m.spots.start);
  G.p.x = sp[0] * TS + (G.M.m.interior ? 16 : 8); G.p.y = sp[1] * TS + 12; G.p.dir = dir; G.target = null;
  G.npcs = spawnNPCs(); camFollow(true);
  showLoc(G.M.def.name(), G.M.m.interior ? G.M.def.sub : G.M.def.sub);
  updateHUD();
}
function rebuildCurrent() { const px = G.p.x, py = G.p.y; G.M = buildRuntime(G.M.id); G.p.x = px; G.p.y = py; }

// ---------------- 建物に入る・出る ----------------
async function enterBuilding(o) {
  if (o.role === 'court' && S.year < 809) { await say([['門番', 'ここは朝廷の政を行う場所だ。無位の者は入れぬ。']]); return false; }
  if (o.role === 'salon' && !S.flags.upasaka && S.year < 791) { /* 誰でも入れる */ }
  const m = buildInteriorMap(o, G.M.id);
  G.outside = { map: G.M.id, x: o.tx + (o.w >> 1), y: o.ty + o.h, o };
  SFX.step(); await fadeQuick();
  await warp(m.id, 'start', 1);
  if (!S.hints.inside) { S.hints.inside = 1; await say([[NARR, '【建物の中】家具や人の前で Space を押すと、その場所でできることが選べます。\n出口（下の敷居）から外へ出られます。']]); }
  return true;
}
async function exitBuilding() {
  const o = G.outside; if (!o) return;
  await fadeQuick();
  await warp(o.map, [o.x, o.y], 0);
  G.outside = null;
}
function fadeQuick() { return new Promise(r => { const f = $('fade'); f.style.opacity = 1; setTimeout(() => { r(); setTimeout(() => f.style.opacity = 0, 60); }, 220); }); }

// ---------------- 当たり判定 ----------------
function blocked(x, y, M = G.M) {
  for (const [ox, oy] of [[-4, -3], [4, -3], [-4, 0], [4, 0]]) {
    const tx = Math.floor((x + ox) / TS), ty = Math.floor((y + oy) / TS);
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return true;
    if (M.solid[ty * M.w + tx]) return true;
  }
  return false;
}

// ---------------- 入力 ----------------
const ACT = k => k === ' ' || k === 'Enter' || k === 'z' || k === 'Z';
const CANCEL = k => k === 'Escape' || k === 'x' || k === 'X';
window.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (MG.active) { if (!e.repeat) MG.onKey && MG.onKey(k, true); return; }
  if (SCN.active) { if (!e.repeat) scnKey(k); return; }
  if (DLG.st) { if (!e.repeat) dlgKey(k); return; }
  if (MENU.st) { if (!e.repeat) menuKey(k); return; }
  if (!G.started) return;
  if (G.build) { buildKey(k); return; }
  G.keys[k.length === 1 ? k.toLowerCase() : k] = true;
  if (e.repeat) return;
  if (ACT(k)) interact();
  if (k === 'c' || k === 'C') statusMenu();
});
window.addEventListener('keyup', e => { const k = e.key; if (MG.active) { MG.onKey && MG.onKey(k, false); } G.keys[k.length === 1 ? k.toLowerCase() : k] = false; });
window.addEventListener('blur', () => { G.keys = {}; });
(function () {
  const cv = $('mgc');
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * MGW, (e.clientY - r.top) / r.height * MGH]; };
  cv.addEventListener('pointerdown', e => { if (!MG.active) return; cv.setPointerCapture(e.pointerId); MG.onPointer && MG.onPointer('down', ...pos(e)); });
  cv.addEventListener('pointermove', e => { if (MG.active && MG.onPointer) MG.onPointer('move', ...pos(e)); });
  cv.addEventListener('pointerup', e => { if (MG.active && MG.onPointer) MG.onPointer('up', ...pos(e)); });
})();
function viewPos(e) { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW + G.cam.x, (e.clientY - r.top) / r.height * VH + G.cam.y]; }
view.addEventListener('mousemove', e => { if (G.build) { const [x, y] = viewPos(e); G.build.cx = Math.floor(x / TS); G.build.cy = Math.floor(y / TS); } });
view.addEventListener('click', e => {
  if (!G.started || busy()) return;
  const [x, y] = viewPos(e);
  if (G.build) { G.build.cx = Math.floor(x / TS); G.build.cy = Math.floor(y / TS); placeBuild(); return; }
  let ent = null;
  for (const n of G.npcs) if (Math.abs(n.x - x) < 9 && y > n.y - 24 && y < n.y + 3) ent = { npc: n };
  if (!ent) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (tx >= 0 && ty >= 0 && tx < G.M.w && ty < G.M.h) { const oi = G.M.objAt[ty * G.M.w + tx]; if (oi >= 0 && G.M.objs[oi].role) ent = { obj: G.M.objs[oi] }; } }
  if (ent && ent.obj) { const o = ent.obj; G.target = { x: (o.tx + o.w / 2) * TS, y: (o.ty + o.h) * TS + 10, ent }; }
  else G.target = { x, y, ent };
});

// ---------------- 更新 ----------------
function busy() { return G.lock > 0 || !!DLG.st || !!MENU.st || MG.active || SCN.active || !$('sleepfx').classList.contains('hidden'); }
function update() {
  G.frame++;
  if (!G.started || !G.M) return;
  const p = G.p, now = performance.now(), dt = Math.min(100, now - (G.last || now)); G.last = now;
  if (!busy() && !G.build) {
    // 時の流れ
    const before = S.min; S.min += dt / 1000 * TIME_RATE;
    if (before < LATE && S.min >= LATE) toast('夜も更けてきた。家や宿の布団で休もう。');
    if (before < 20 * 60 && S.min >= 20 * 60 && !G.M.m.interior) refreshNPCs();
    if (S.min >= LIMIT) { guard(forcedSleep); return; }
    let dx = 0, dy = 0; const K2 = G.keys;
    if (K2.ArrowLeft || K2.a) dx = -1; else if (K2.ArrowRight || K2.d) dx = 1;
    if (K2.ArrowUp || K2.w) dy = -1; else if (K2.ArrowDown || K2.s) dy = 1;
    if (dx || dy) G.target = null;
    else if (G.target) {
      const t = G.target, ex = t.x - p.x, ey = t.y - p.y;
      if (t.ent) {
        const e = t.ent, ox = e.npc ? e.npc.x : t.x, oy = e.npc ? e.npc.y : t.y;
        if (Math.hypot(ox - p.x, oy - p.y) < (e.npc ? 16 : 12)) { G.target = null; faceTo(ox, oy - (e.npc ? 0 : 12)); if (e.npc) talkNPC(e.npc); else interactObj(e.obj); return; }
      }
      if (Math.abs(ex) < 2 && Math.abs(ey) < 2) G.target = null;
      else { if (Math.abs(ex) > 1.5) dx = Math.sign(ex); if (Math.abs(ey) > 1.5) dy = Math.sign(ey); }
    }
    const sp = .82;
    let moved = false;
    if (dx) { const nx = p.x + dx * sp; if (!blocked(nx, p.y)) { p.x = nx; moved = true; } }
    if (dy) { const ny = p.y + dy * sp; if (!blocked(p.x, ny)) { p.y = ny; moved = true; } }
    if (dx || dy) { if (dy && !dx) p.dir = dy > 0 ? 0 : 1; else if (dx && !dy) p.dir = dx > 0 ? 3 : 2; else { if (p.dir === 0 || p.dir === 1) p.dir = dy > 0 ? 0 : 1; else p.dir = dx > 0 ? 3 : 2; } }
    if (G.target && !moved) { G.target.stuck = (G.target.stuck || 0) + 1; if (G.target.stuck > 20) G.target = null; }
    p.moving = moved; if (moved) { p.anim++; p.f = ((p.anim / 12) | 0) % 4; } else p.f = 0;
    // 出口
    if (G.M.m.interior && dy > 0) { const tx = Math.floor(p.x / TS), ty = Math.floor((p.y + 2) / TS); if (G.M.m.t(tx, ty) === 'E' || ty >= G.M.h - 1) { guard(exitBuilding); return; } }
  }
  for (const n of G.npcs) {
    if (n.talking || n.wander === 0) { n.f = 0; continue; }
    if (n.wait > 0) { n.wait--; n.f = 0; continue; }
    if (n.tx == null) { const tx = n.hx + Math.round((Math.random() * 2 - 1) * n.wander), ty = n.hy + Math.round((Math.random() * 2 - 1) * n.wander); n.tx = tx * TS + 8; n.ty = ty * TS + 12; }
    const ex = n.tx - n.x, ey = n.ty - n.y, spd = n.spec.animal ? .32 : .36;
    let mdx = Math.abs(ex) > 1 ? Math.sign(ex) : 0, mdy = mdx ? 0 : (Math.abs(ey) > 1 ? Math.sign(ey) : 0);
    if (!mdx && !mdy) { n.tx = null; n.wait = 60 + ((Math.random() * 220) | 0); continue; }
    const nx = n.x + mdx * spd, ny = n.y + mdy * spd;
    if (blocked(nx, ny)) { n.tx = null; n.wait = 30 + ((Math.random() * 60) | 0); continue; }
    n.x = nx; n.y = ny; n.dir = mdx ? (mdx > 0 ? 3 : 2) : (mdy > 0 ? 0 : 1); n.anim++; n.f = ((n.anim / 14) | 0) % 4;
  }
  camFollow();
  if (!busy() && !G.build && G.frame % 6 === 0) {
    const fi = frontInfo(), H = $('hint');
    if (fi) { H.textContent = 'Space：' + (fi.npc ? '話す（' + (fi.npc.name || '動物') + '）' : (INTERIOR_OF[fi.obj.role] && fi.obj.kind === 'bld' ? '入る（' : '調べる（') + (fi.obj.name || '…') + '）'); H.classList.remove('hidden'); }
    else H.classList.add('hidden');
  }
  if (G.frame % 20 === 0) updateHUD();
  if (G.frame % 8 === 0) drawMini();
  if (G.frame % 60 === 0 && !G.build) {
    checkAuto();
    const st = STORY[S.step];
    if (st && st.target === 'phase' && !S.flags['pn' + st.id] && phaseDone(st) && !busy()) { S.flags['pn' + st.id] = 1; guard(() => say([[NARR, '【目標達成】「' + st.short + '」の目標をすべて満たした。\n布団で眠ると物語が進みます。\nそれまでは自由に街で過ごしてもかまいません（技能を使った仕事や問答、書物集め、見聞録など）。']])); }
  }
}
function camFollow(snap) {
  const M = G.M, mw = M.w * TS, mh = M.h * TS; let tx, ty;
  if (G.build) { tx = G.build.cx * TS + 8 - VW / 2; ty = G.build.cy * TS + 8 - VH / 2; }
  else { tx = G.p.x - VW / 2; ty = G.p.y - 10 - VH / 2; }
  tx = mw <= VW ? -(VW - mw) / 2 : Math.max(0, Math.min(mw - VW, tx));
  ty = mh <= VH ? -(VH - mh) / 2 : Math.max(0, Math.min(mh - VH, ty));
  if (snap || M.m.interior) { G.cam.x = tx; G.cam.y = ty; } else { G.cam.x += (tx - G.cam.x) * .2; G.cam.y += (ty - G.cam.y) * .2; }
}
function faceTo(x, y) { const dx = x - G.p.x, dy = y - G.p.y; G.p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1); }
function frontInfo() {
  const p = G.p, M = G.M, [dx, dy] = DIRV[p.dir];
  const fx = p.x + dx * 11, fy = p.y - 3 + dy * 11;
  let best = null, bd = 13;
  for (const n of G.npcs) { const d = Math.hypot(n.x - fx, n.y - 4 - fy); if (d < bd) { bd = d; best = n; } }
  if (best) return { npc: best };
  for (const k of [1, 1.6, 2.2]) {
    const tx = Math.floor((p.x + dx * 11 * k) / TS), ty = Math.floor((p.y - 3 + dy * 11 * k) / TS);
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) continue;
    const oi = M.objAt[ty * M.w + tx]; if (oi >= 0 && M.objs[oi].role) return { obj: M.objs[oi] };
    if (M.m.interior && k > 1) { // 机の向こうの人にも話しかけられる
      for (const n of G.npcs) if (Math.hypot(n.x - (p.x + dx * 11 * k), n.y - 4 - (p.y - 3 + dy * 11 * k)) < 12) return { npc: n };
    }
  }
  return null;
}

// ---------------- 描画 ----------------
function objSpr(o) {
  if (o.kind === 'bld') return bldSprite(o.type, o.w, o.h);
  if (o.anim === 'fall') return fallFrame(((G.frame / 12) | 0) % 2);
  return objSprite(o.type);
}
const LIGHT_OBJ = { lantern: 1, andon: 1, brazier: 1, lanternR: 1, altar: 1, hibachi: .5, irori: .7 };
function render() {
  const g = VG; g.imageSmoothingEnabled = false;
  if (!G.M) { g.fillStyle = '#000'; g.fillRect(0, 0, VW, VH); return; }
  const M = G.M, cx = Math.round(G.cam.x), cy = Math.round(G.cam.y), inside = !!M.m.interior;
  if (inside) {
    g.fillStyle = g.createPattern(seigaiha(), 'repeat'); g.fillRect(0, 0, VW, VH);
    g.fillStyle = '#2a1a0c'; g.fillRect(-cx - 5, -cy - 5, M.w * TS + 10, M.h * TS + 10); g.fillStyle = '#c89a48'; g.fillRect(-cx - 3, -cy - 3, M.w * TS + 6, M.h * TS + 6);
  }
  g.drawImage(M.ground, -cx, -cy);
  if (!inside) {
    const tx0 = Math.max(0, (cx / TS) | 0), ty0 = Math.max(0, (cy / TS) | 0), ft = (G.frame / 20) | 0;
    for (let ty = ty0; ty < ty0 + 20; ty++) for (let tx = tx0; tx < tx0 + 31; tx++) { const t = M.m.t(tx, ty); if ((t === 'W' || t === 'X') && h2(tx, ty, ft) < .06) { const sx = tx * TS - cx + ((h2(tx, ty, ft + 1) * 12) | 0), sy = ty * TS - cy + ((h2(tx, ty, ft + 2) * 12) | 0); g.fillStyle = '#ffffff'; g.fillRect(sx, sy, 3, 1); g.fillRect(sx + 1, sy - 1, 1, 3); } }
  }
  if (G.build) drawZone(g, cx, cy);
  const list = [], lights = [];
  for (const o of M.objs) {
    const s = objSpr(o); const dx = o.tx * TS + ((o.w * TS - s.width) >> 1) - cx, dy = (o.ty + o.h) * TS - s.height - cy;
    if (dx > VW || dy > VH || dx + s.width < 0 || dy + s.height < 0) continue;
    list.push({ y: (o.ty + o.h) * TS - (o.kind === 'bld' ? 1 : 2), s, dx, dy });
    if (LIGHT_OBJ[o.type]) lights.push([dx + s.width / 2, dy + (o.type === 'andon' ? 8 : o.type === 'altar' ? 18 : 6), LIGHT_OBJ[o.type]]);
    else if (o.kind === 'bld' && !inside) lights.push([dx + s.width / 2, dy + s.height - 12, .6]);
  }
  for (const n of G.npcs) { const s = charSprite(n.spec, n.dir, n.f); const a = !!n.spec.animal; list.push({ y: n.y, s, dx: Math.round(n.x - (a ? 10 : 8)) - cx, dy: Math.round(n.y - (a ? 18 : 24)) - cy }); }
  const ps = charSprite(kukaiSpec(), G.p.dir, G.p.f); list.push({ y: G.p.y + .5, s: ps, dx: Math.round(G.p.x - 8) - cx, dy: Math.round(G.p.y - 24) - cy });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) g.drawImage(it.s, it.dx, it.dy);
  // 昼夜
  const { D, W } = lightLevel(); const d = inside ? D * .35 : D;
  if (W > 0 && !inside) { g.fillStyle = 'rgba(255,150,70,' + W + ')'; g.fillRect(0, 0, VW, VH); }
  if (d > 0) { g.fillStyle = 'rgba(14,22,62,' + d + ')'; g.fillRect(0, 0, VW, VH); }
  const la = inside ? .45 + D : D * 1.8;
  if (la > .05) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, la); const gl = lampGlowSpr(); for (const [x, y, s] of lights) { const r = 40 * s * (inside ? 1.2 : 1); g.drawImage(gl, x - r / 2, y - r / 2, r, r); } g.restore(); }
  // マーカー
  const bob = Math.round(Math.sin(G.frame / 8) * 2);
  for (const n of G.npcs) if (n.quest) g.drawImage(markSprite('!'), Math.round(n.x - 4) - cx, Math.round(n.y - 38) - cy + bob);
  const tg = storyTargetPos();
  if (tg) g.drawImage(markSprite('v'), Math.round(tg[0] - 4) - cx, Math.round(tg[1]) - cy + bob);
  if (G.build) drawGhost(g, cx, cy);
}
function npcHome(id, mapId) {   // id の住人がいる建物（このマップ内）
  for (const o of G.M.objs) if (o.id && INT_NPCS[o.id] && INT_NPCS[o.id].some(n => n.id === id && (!n.when || n.when()))) return o;
  return null;
}
function storyTargetPos() {
  const st = STORY[S.step]; if (!st || !st.target || st.target === 'auto' || st.target === 'phase') return null;
  if (st.map !== mapRoot()) return null;
  const [k, id] = st.target.split(':');
  if (k === 'npc') {
    const n = G.npcs.find(x => x.id === id); if (n) return [n.x, n.y - 40];
    if (G.M.m.interior) return null;
    const b = npcHome(id); if (b) { const s = objSpr(b); return [(b.tx + b.w / 2) * TS, (b.ty + b.h) * TS - s.height - 14]; }
    return null;
  }
  if (G.M.m.interior) return null;
  const o = G.M.objs.find(x => x.id === id); if (!o) return null;
  const s = objSpr(o); return [(o.tx + o.w / 2) * TS, (o.ty + o.h) * TS - s.height - 14];
}

// ---------------- ミニマップ ----------------
const MINI_OBJ = { pine: '#2f6a3a', tree: '#3f8a3a', cedar: '#244a30', sakura: '#e8a0c0', maple: '#d86a3a', willow: '#6aa040', bamboo: '#5a9a40', plum: '#d86080', wallH: '#5a6a72', wallV: '#5a6a72', tangwallH: '#8a7a62', tangwallV: '#8a7a62' };
function miniBase(M) {
  const key = M.id + ':' + M.objs.length;
  if (G.miniKey === key) return G.miniImg;
  const [c, g] = mk(M.w * 2, M.h * 2);
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) { const t = M.m.tiles[y * M.w + x]; g.fillStyle = (GC[t] || GC.G)[0]; g.fillRect(x * 2, y * 2, 2, 2); }
  for (const o of M.objs) {
    if (o.kind === 'bld') { g.fillStyle = '#3b2718'; g.fillRect(o.tx * 2 - 1, o.ty * 2 - 1, o.w * 2 + 2, o.h * 2 + 2); g.fillStyle = BSTY[o.type] ? BSTY[o.type].roof : '#7a5a4a'; g.fillRect(o.tx * 2, o.ty * 2, o.w * 2, o.h * 2); }
    else if (MINI_OBJ[o.type]) { g.fillStyle = MINI_OBJ[o.type]; g.fillRect(o.tx * 2, o.ty * 2, 2, 2); }
    else if (o.role === 'sign') { g.fillStyle = '#ffffff'; g.fillRect(o.tx * 2, o.ty * 2, 2, 2); }
  }
  G.miniKey = key; G.miniImg = c; return c;
}
function drawMini() {
  const box = $('minibox'); if (!G.M || G.M.m.interior) { box.style.display = 'none'; return; }
  box.style.display = '';
  const M = G.M, cv = $('mini'), base = miniBase(M);
  if (cv.width !== base.width * 2) { cv.width = base.width * 2; cv.height = base.height * 2; }
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0, cv.width, cv.height);
  // 視界の枠
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.strokeRect(G.cam.x / TS * 4 + .5, G.cam.y / TS * 4 + .5, VW / TS * 4, VH / TS * 4);
  const tg = storyTargetPos();
  if (tg && (G.frame >> 4) % 2) { g.fillStyle = '#ffd030'; g.strokeStyle = '#3b2718'; g.beginPath(); const x = tg[0] / TS * 4, y = (tg[1] + 30) / TS * 4; g.moveTo(x - 5, y - 7); g.lineTo(x + 5, y - 7); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke(); }
  const px = G.p.x / TS * 4, py = G.p.y / TS * 4;
  g.fillStyle = '#ffffff'; g.fillRect(px - 4, py - 4, 8, 8); g.fillStyle = '#d0302a'; g.fillRect(px - 3, py - 3, 6, 6);
  $('mininame').textContent = M.def.name();
}

// ---------------- HUD ----------------
function updateHUD() {
  if (!S) return;
  const hpw = Math.max(0, S.hp) / S.maxhp * 100;
  $('stat').innerHTML = '<span class="nm">' + S.name + '</span>（' + age() + '歳）　' + eraStr(S.year) + '（' + S.year + '）' + S.month + '月' + S.day + '日' + (S.flags.china ? '　<b style="color:#b8392b">唐に滞在中</b>' : '') +
    '<br><span class="clock">' + clockStr() + '</span>' +
    '<br>体力 <span class="bar"><i style="width:' + hpw + '%"></i></span> ' + Math.round(S.hp) + '/' + S.maxhp + '　銭 ' + S.money +
    '<div class="grid"><span>法力 ' + S.horiki + '</span><span>記憶力 ' + S.memory + '</span><span>文才 ' + S.bun + '</span><span>徳 ' + S.toku + '</span><span>信徒 ' + S.followers + '</span><span>名声 ' + S.fame + '</span></div>';
  const st = STORY[S.step];
  let where = '', prog = '';
  if (st && st.map && G.M && st.map !== mapRoot() && st.target !== 'phase') where = '<br><small>（行き先：' + MAPDEF[st.map].name() + '）</small>';
  if (st && st.target === 'phase') prog = '<div class="goal">' + st.goal().map(x => { const r = Math.min(1, x[1] / x[2]); return '<div><span>' + x[0] + '</span><span class="gb"><i style="width:' + (r * 100) + '%"></i></span><span>' + Math.min(x[1], x[2]) + '/' + x[2] + '</span></div>'; }).join('') + '<small>目標を達成して眠ると、物語が進む</small></div>';
  $('obj').innerHTML = '<b>目的</b><br>' + (st ? st.obj : '') + where + prog;
  // 持ち物
  for (const k of ['food', 'ink', 'incense']) { const el = $('slot-' + k); if (el) el.querySelector('span').textContent = S.items[k] || 0; }
}
function buildSlots() {
  const box = $('items'); box.innerHTML = '';
  for (const k of ['food', 'ink', 'incense']) {
    const d = document.createElement('div'); d.className = 'slot'; d.id = 'slot-' + k; d.title = ITEM_NAME[k];
    const c = itemIcon(k), cv = document.createElement('canvas'); cv.width = 12; cv.height = 12; cv.getContext('2d').drawImage(c, 0, 0);
    d.appendChild(cv); const s = document.createElement('span'); s.textContent = '0'; d.appendChild(s); box.appendChild(d);
  }
}
function toast(msg) { const d = document.createElement('div'); d.className = 'panel'; d.textContent = msg; $('toast').appendChild(d); setTimeout(() => d.remove(), 4000); while ($('toast').children.length > 6) $('toast').firstChild.remove(); }
function flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity 1.4s'; f.style.opacity = 0; }); SFX.bell(); }
// 買った・手に入れた演出（控えめに：アイコンがふわっと出て持ち物欄へ吸い込まれる）
function itemFx(k, n = 1, verb = '手に入れた') {
  const game = $('game'), gr = game.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'itemfx panel';
  const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12; cv.getContext('2d').drawImage(itemIcon(k), 0, 0);
  el.appendChild(cv); const t = document.createElement('span'); t.textContent = (ITEM_NAME[k] || k) + (n > 0 ? ' ×' + n : '') + ' を' + verb; el.appendChild(t);
  game.appendChild(el);
  beep(784, .09, 'triangle', .07); beep(1046, .14, 'triangle', .05, .07);
  const slot = $('slot-' + k);
  setTimeout(() => el.classList.add('up'), 20);
  setTimeout(() => {
    if (slot) { const sr = slot.getBoundingClientRect(), er = el.getBoundingClientRect(); el.style.transform = 'translate(' + (sr.left + sr.width / 2 - (er.left + er.width / 2)) + 'px,' + (sr.top + sr.height / 2 - (er.top + er.height / 2)) + 'px) scale(.3)'; el.style.opacity = 0; }
    else el.style.opacity = 0;
  }, 1100);
  setTimeout(() => { el.remove(); if (slot) { slot.classList.remove('bump'); void slot.offsetWidth; slot.classList.add('bump'); } updateHUD(); }, 1700);
}

// ---------------- 会話 ----------------
const DLG = { st: null };
function portraitFor(name) {
  if (!name) return null;
  if (name === S.name || name === '空海' || name === '真魚') return kukaiSpec();
  const n = G.npcs.find(x => x.name === name); if (n && !n.spec.animal) return n.spec;
  for (const k in INT_NPCS) { const d = INT_NPCS[k].find(x => x.name === name); if (d) return d.spec; }
  return null;
}
async function dlgFree() { while (DLG.st) await new Promise(r => setTimeout(r, 50)); }
async function say(lines) {
  await dlgFree();
  return new Promise(res => {
    const q = lines.map(l => typeof l === 'string' ? { n: '', t: l } : { n: l[0], t: l[1] });
    DLG.st = { q, i: 0, res, shown: 0, full: false, timer: 0 };
    $('dialog').classList.remove('hidden'); $('hint').classList.add('hidden');
    showLine();
  });
}
function showLine() {
  const st = DLG.st, l = st.q[st.i];
  $('dname').textContent = l.n ? '§ ' + l.n + ' §' : ''; $('dname').style.display = l.n ? '' : 'none';
  $('dchoices').innerHTML = ''; $('dnext').style.display = 'none';
  const pc = $('portrait'), sp = portraitFor(l.n);
  if (sp) { const g = pc.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 16, 16); g.drawImage(faceCanvas(sp), 0, 0); $('pframe').style.display = ''; $('dialog').classList.add('hasface'); }
  else { $('pframe').style.display = 'none'; $('dialog').classList.remove('hasface'); }
  st.shown = 0; st.full = false; clearInterval(st.timer);
  st.timer = setInterval(() => { st.shown += 2; $('dtext').textContent = l.t.slice(0, st.shown); if (st.shown >= l.t.length) finishLine(); }, 22);
}
function finishLine() { const st = DLG.st; clearInterval(st.timer); st.full = true; $('dtext').textContent = st.q[st.i].t; if (st.choice) renderChoices(); else $('dnext').style.display = ''; }
function dlgAdvance() {
  const st = DLG.st; if (!st) return;
  if (!st.full) { finishLine(); return; }
  if (st.choice) { st.choice.pick(st.choice.sel); return; }
  st.i++;
  if (st.i >= st.q.length) { const r = st.res; DLG.st = null; $('dialog').classList.add('hidden'); r(); }
  else showLine();
}
function dlgKey(k) {
  const st = DLG.st;
  if (st.choice && st.full) {
    if (k === 'ArrowUp' || k === 'w') { st.choice.sel = (st.choice.sel + st.choice.opts.length - 1) % st.choice.opts.length; renderChoices(); return; }
    if (k === 'ArrowDown' || k === 's') { st.choice.sel = (st.choice.sel + 1) % st.choice.opts.length; renderChoices(); return; }
    const n = parseInt(k); if (n >= 1 && n <= st.choice.opts.length) { st.choice.pick(n - 1); return; }
  }
  if (ACT(k)) dlgAdvance();
}
$('dialog').addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') dlgAdvance(); });
function renderChoices() {
  const c = DLG.st.choice, box = $('dchoices'); box.innerHTML = '';
  c.opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + o; if (i === c.sel) b.className = 'sel'; b.onclick = ev => { ev.stopPropagation(); c.pick(i); }; box.appendChild(b); });
  $('dnext').style.display = 'none';
}
async function choose(prompt, opts, who) {
  await dlgFree();
  return new Promise(res => {
    DLG.st = { q: [{ n: who || '', t: prompt }], i: 0, shown: 0, full: false, timer: 0 };
    DLG.st.choice = { opts, sel: 0, pick: i => { clearInterval(DLG.st.timer); DLG.st = null; $('dialog').classList.add('hidden'); res(i); } };
    $('dialog').classList.remove('hidden'); showLine();
  });
}

// ---------------- メニュー ----------------
const MENU = { st: null };
function menu(title, desc, items) {
  return new Promise(res => {
    const el = $('menu'); el.classList.remove('hidden'); $('hint').classList.add('hidden');
    MENU.st = { items, sel: Math.max(0, items.findIndex(i => !i.disabled)), res };
    const draw = () => {
      el.innerHTML = '<h2>' + title + '</h2>' + (desc ? '<p class="desc">' + desc + '</p>' : '') + '<div class="items"></div>';
      const box = el.querySelector('.items');
      items.concat([{ label: '閉じる', sub: 'Esc' }]).forEach((it, i) => {
        const b = document.createElement('button'); b.className = 'it' + (i === MENU.st.sel ? ' sel' : ''); b.disabled = !!it.disabled;
        b.innerHTML = '<span>' + (it.icon ? '<img class="mi" src="' + itemIcon(it.icon).toDataURL() + '">' : '') + it.label + '</span><small>' + (it.sub || '') + '</small>';
        b.onclick = () => close(i < items.length ? i : -1); box.appendChild(b);
      });
    };
    const close = i => { MENU.st = null; el.classList.add('hidden'); res(i); };
    MENU.st.draw = draw; MENU.st.close = close; draw();
  });
}
function menuKey(k) {
  const st = MENU.st, n = st.items.length + 1;
  if (CANCEL(k)) { st.close(-1); return; }
  const mv = d => { let s = st.sel; for (let i = 0; i < n; i++) { s = (s + d + n) % n; if (s === n - 1 || !st.items[s].disabled) break; } st.sel = s; st.draw(); };
  if (k === 'ArrowUp' || k === 'w') mv(-1); else if (k === 'ArrowDown' || k === 's') mv(1);
  else if (ACT(k)) st.close(st.sel < st.items.length ? st.sel : -1);
}

// ---------------- インタラクション ----------------
async function guard(fn) { G.lock++; G.keys = {}; try { await fn(); } catch (e) { console.error(e); } finally { G.lock--; } if (S.hp <= 0) await faint(); updateHUD(); }
async function faint() { G.lock++; await say([[NARR, S.name + 'は力尽きて倒れてしまった……。']]); await sleepFx('―― 力尽きて倒れた ――'); advanceDays(2); S.hp = 60; G.lock--; }
function interact() {
  if (busy()) return;
  const fi = frontInfo(); if (!fi) return;
  if (fi.npc) talkNPC(fi.npc); else interactObj(fi.obj);
}
function storyMatch(kind, id) { const st = STORY[S.step]; return st && st.map === mapRoot() && st.target === kind + ':' + id ? st : null; }
async function runStep(st) {
  if (st.need && !st.need()) { await say([[NARR, st.needText]]); return; }
  const r = await st.run();
  if (r === false) return;
  if (STORY[S.step] === st) S.step++;
  const nx = STORY[S.step]; if (nx && nx.target === 'phase') { S.phaseStart = S.totalDays; nx.onStart && nx.onStart(); }
  refreshNPCs(); updateHUD(); save(true);
  checkAuto();
}
function checkAuto() {
  const st = STORY[S.step]; if (!st || st.target !== 'auto' || !G.M || busy()) return;
  if (st.check()) guard(() => runStep(st));
}
function talkNPC(n) {
  guard(async () => {
    n.talking = true; const pdx = G.p.x - n.x, pdy = G.p.y - n.y; if (!n.spec.seat) n.dir = Math.abs(pdx) > Math.abs(pdy) ? (pdx > 0 ? 3 : 2) : (pdy > 0 ? 0 : 1); faceTo(n.x, n.y);
    try {
      const st = n.id && storyMatch('npc', n.id);
      if (st) { await runStep(st); return; }
      if (n.spec.animal) { const T = { deer: '鹿が「キュッ」と鳴いた。', cow: '牛が「モォ〜」と鳴いた。', horse: '馬が鼻を鳴らした。', chicken: '鶏が「コケッ」と鳴いた。', cat: '猫が足にすり寄ってきた。', rabbit: '兎がぴょんと跳ねた。', monkey: '猿がこちらをじっと見ている……握り飯を狙っているようだ。', dog: '犬が尻尾を振っている。' }; await say([[NARR, T[n.spec.animal] || '……']]); return; }
      if (n.act && NACT[n.act]) { await NACT[n.act](n); return; }
      if (n.quest) { await runQuest(n); refreshNPCs(); return; }
      if (n.pilgrim) { const L = ['ありがたや、ありがたや……', '遠い国から歩いてまいりました。', '大師さまのお山は、空気まで清らかです。', '伽藍が増えるたびに、参拝者も増えていますね。', 'お布施を納めてまいりました。']; await say([[n.name, L[n.seed % L.length]]]); return; }
      if (hasSkill('mondo') && MONDO_WHO.includes(n.name)) { const c = await choose('どうする？', ['話を聞く', '問答を挑む（技能：問答）'], n.name); if (c === 1) { await mondo(n); return; } }
      if (n.lines && n.lines.length) { await say([[n.name, n.lines[(Math.random() * n.lines.length) | 0]]]); return; }
      const pool = POOLS[n.pool || G.M.def.pool]; const L = pool.lines;
      const nightL = ['こんな夜更けにどうしたんだい？　早く帰って休みな。', '夜道は暗い。足元に気をつけてな。'];
      await say([[n.name, (S.min >= 20 * 60 ? nightL[n.seed % 2] : L[(n.seed + G.frame) % L.length])]]);
    } finally { n.talking = false; }
  });
}
function interactObj(o) {
  guard(async () => {
    const st = o.id ? storyMatch('obj', o.id) : null;
    if (st && st.outside) { await runStep(st); return; }
    if (o.kind === 'bld' && INTERIOR_OF[o.role]) {
      const ok = await enterBuilding(o); if (!ok) return;
      if (st) await runStep(st);
      return;
    }
    if (st) { await runStep(st); return; }
    if (o.role && o.role.startsWith('i:')) { const f = IACT[o.role.slice(2)]; if (f) await f(o); return; }
    const fn = ROLES[o.role]; if (fn) await fn(o);
  });
}

// ---- 修行・行動 ----
// 能力が高いほど上がりにくい（55で約半分）
function tg(k, base) { const f = Math.max(.35, 55 / (55 + (S[k] || 0))); return Math.max(1, Math.round(base * f)); }
const snap = () => ({ horiki: S.horiki, memory: S.memory, bun: S.bun, toku: S.toku, money: S.money });
async function trainScene(id, text, before) {
  const N = { horiki: '法力', memory: '記憶力', bun: '文才', toku: '徳', money: '銭' }, d = [];
  for (const k in N) { const v = S[k] - before[k]; if (v > 0) d.push(N[k] + ' +' + v); }
  await scene(id, [text + (d.length ? '\n\n―― ' + d.join('　') + ' ――' : '')], { date: eraStr(S.year) + ' ' + S.month + '月' + S.day + '日　' + clockStr().replace(/（.*）/, '') });
}
function needHP(n) { if (S.hp < n) { say([[NARR, '体力が足りない（体力' + n + '以上必要）。休むか握り飯を食べよう。']]); return false; } return true; }
function monkBonus() { const m = siteStats('koya').monks + siteStats('toji').monks; return 1 + Math.min(.5, m * .03); }
async function trainSutra() {
  if (!needHP(15) || !(await useTime(3, '読経'))) return;
  const b = snap();
  const sc = await mgSutra({ title: '読経修行', mantra: S.flags.kanjo ? MANTRA.komyo : S.flags.upasaka ? MANTRA.kokuzo : MANTRA.shingyo });
  S.hp -= 15; gain('horiki', tg('horiki', (2 + sc * 6) * monkBonus())); gain('memory', tg('memory', 1 + sc * 2)); inc('sutra');
  await trainScene('dokyo', sc > .7 ? '仏前に香を焚き、経を唱えること三刻。\n声は堂に満ち、心は一点に澄んでいった。' : '仏前に香を焚き、経を唱えること三刻。\nところどころ声は乱れたが、最後まで唱えきった。', b);
}
async function trainMed(diff = 1, title = '瞑想', cost = 8, mul = 1) {
  if (!needHP(cost + 5) || !(await useTime(2, title))) return;
  const b = snap();
  const sc = await mgMeditate({ title, diff });
  S.hp -= cost + 2; gain('horiki', tg('horiki', (1 + sc * 5) * mul * monkBonus())); inc('med');
  if (title === '滝行') await trainScene('takigyo', '轟音とともに降りそそぐ冷水。\n身を切るような冷たさの中、ただ真言を唱え続けた。' + (sc > .7 ? '\nやがて冷たさも消え、滝と一つになった。' : ''), b);
  else if (G.M.m.interior) await trainScene('meiso', '灯明の揺らぎのなか、静かに座る。\n雑念が浮かんでは、消えていく。' + (sc > .7 ? '\n――心が、水面のように静まった。' : ''), b);
  else await trainScene('zazen', '岩の上に結跏趺坐し、風の音、鳥の声、\nただ自らの呼吸だけを見つめる。' + (sc > .7 ? '\n――山と自分の境が、消えていく。' : ''), b);
}
async function trainFast() {
  if (!needHP(50)) return;
  const c = await choose('七日間の断食行を行いますか？（体力 -40・7日）', ['行う', 'やめる']); if (c) return;
  const b = snap();
  const sc = await mgFast({ rounds: 7 });
  S.hp -= 40; gain('horiki', tg('horiki', (4 + sc * 12) * monkBonus())); gain('memory', tg('memory', sc * 3));
  await trainScene('danjiki', '七日のあいだ、水のほかは口にせず座り続けた。\n体は痩せ衰えたが、心は研ぎ澄まされていく。', b);
  await sleepFx('―― 七日間の断食行 ――'); advanceDays(6); S.hp = Math.max(20, S.maxhp - 40); updateHUD();
}
async function study(set, title, hours = 3) {
  if (!needHP(10) || !(await useTime(hours, '学問'))) return 0;
  const b = snap();
  const sc = await mgMemory({ title, set }); S.hp -= 9; gain('memory', tg('memory', 1 + sc * 5 + (hasSkill('sodoku') ? 1 : 0) + (hasSkill('zosho') ? 1 : 0))); inc('study');
  await trainScene('gakumon', '灯火のもと、書物の一字一字を胸に刻む。' + (sc > .7 ? '\n読むほどに、文字が生きて語りかけてくる。' : ''), b); return sc;
}
async function practiceCalli(title = '書の稽古') {
  if (!needHP(10) || !(await useTime(2, '書'))) return 0;
  const keys = Object.keys(STROKES); const ch = []; while (ch.length < 2) { const k = keys[(Math.random() * keys.length) | 0]; if (!ch.includes(k)) ch.push(k); }
  const b = snap();
  const sc = await mgCalligraphy({ title, doc: '手本', chars: ch }); S.hp -= 8; gain('bun', tg('bun', 1 + sc * 5)); inc('calli');
  await trainScene('shodo', '墨をすり、筆に心を込める。\n一画一画に、自らの心が映る。', b); return sc;
}
async function poemParty(title, host, hours = 3) {
  if (!(await useTime(hours, '詩会'))) return 0;
  const sc = await mgPoem({ title, host }); const k = hasSkill('sosho') ? 2 : 1; gain('bun', tg('bun', (2 + sc * 4) * k)); gain('fame', Math.round(sc * 6) * k); inc('poem'); return sc * k;
}
async function shopMenu(o) {
  const items = [
    { k: 'food', label: '握り飯', p: 15, d: '体力+30（「状態」から食べる・旅で自動）' },
    { k: 'ink', label: '上質な墨', p: 40, d: '次の書が書きやすくなる' },
    { k: 'incense', label: '香', p: 60, d: '儀式で法力全回復・印+1' }
  ];
  if (G.M && mapRoot() === 'choan' && !S.flags.brush) items.push({ k: 'brush', label: '唐の名筆', p: 300, d: '文才 +10（一度だけ）' });
  for (; ;) {
    const i = await menu(o.name || '店', '所持金 ' + S.money + ' 銭', items.map(it => ({ icon: it.k, label: it.label + '　' + it.p + '銭', sub: it.d + '（所持 ' + (S.items[it.k] || 0) + '）', disabled: S.money < it.p })));
    if (i < 0) return;
    const it = items[i]; S.money -= it.p;
    if (it.k === 'brush') { S.flags.brush = true; gain('bun', 10); items.splice(i, 1); itemFx('brush', 1, '買った'); }
    else { S.items[it.k]++; itemFx(it.k, 1, '買った'); }
    updateHUD();
    await new Promise(r => setTimeout(r, 450));
  }
}
async function takuhatsu(o) {
  const key = mapRoot() + o.tx + '_' + o.ty;
  if (!S.flags.upasaka) { await say([[NARR, (o.name || '家') + 'だ。中から楽しげな声が聞こえる。']]); return; }
  if (S.min >= 19 * 60) { await say([[NARR, 'もう日が暮れた。托鉢は明日にしよう。']]); return; }
  if (S.takuhatsu[key]) { await say([[NARR, 'この家では今月すでに托鉢をした。']]); return; }
  const c = await choose((o.name || '家') + 'の前で托鉢（たくはつ）をしますか？（1時間）', ['経を唱えて托鉢する', 'やめる']); if (c) return;
  if (!(await useTime(1))) return;
  S.takuhatsu[key] = 1;
  const m = Math.round((5 + ((Math.random() * 20) | 0) + Math.round(S.fame / 10)) * (hasSkill('dokyo') ? 1.5 : 1));
  await say([['家の人', ['ご苦労さまです。どうぞ。', 'ありがたいお経をありがとうございます。', 'お坊さま、少しですが……'][(Math.random() * 3) | 0]]]);
  itemFx('money', m, '受け取った'); S.money += m; gain('toku', 1); if (Math.random() < .4) gain('followers', 1);
}
async function travelMenu(o, bySea) {
  const here = mapRoot();
  let dests;
  if (S.flags.china) dests = S.flags.sekiganOK ? ['sekigan', 'choan'] : [];
  else dests = JP_MAPS.filter(id => S.unlocked.includes(id));
  dests = dests.filter(id => id !== here);
  if (!dests.length) { await say([[NARR, S.flags.china ? '今はここを離れるわけにはいかない。' : 'まだ行ける場所がない。']]); return; }
  const dist = id => { if (S.flags.china) return 40; const a = MAPDEF[here].pos, b = MAPDEF[id].pos; return Math.max(1, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / 3)); };
  const i = await menu(bySea ? '船で旅立つ' : '旅に出る', '行き先を選ぶ。旅には日数がかかり、体力も減る（握り飯があれば自動で食べる）。\n到着は朝になる。', dests.map(id => ({ label: MAPDEF[id].name(), sub: '約' + dist(id) + '日　' + (MAPDEF[id].sub || '') })));
  if (i < 0) return;
  const id = dests[i], d = dist(id);
  let cost = Math.min(40, d * 2) * (hasSkill('kenbun') ? .5 : 1) | 0, ate = false; if (S.items.food > 0) { S.items.food--; cost = Math.max(0, cost - 30); ate = true; }
  const ISL = ['sanuki', 'shikoku', 'muroto'], sea = bySea || S.flags.china || (ISL.includes(here) !== ISL.includes(id)) || here === 'dazaifu' || id === 'dazaifu';
  const from = MAPDEF[here].name(), to = MAPDEF[id].name();
  S.hp = Math.max(1, S.hp - cost); advanceDays(d);
  await scene(sea ? 'travel_sea' : 'travel_land', [from + ' から ' + to + ' へ。\n' + (sea ? '船に揺られて' : '山を越え、川を渡り') + '、およそ ' + d + ' 日の旅路――' + (ate ? '\n（握り飯を食べて体力を保った）' : '\n（体力が ' + cost + ' 減った）')], { date: eraStr(S.year) + '（' + S.year + '年）' + S.month + '月' + S.day + '日' });
  await warp(id, 'sign');
}
async function statusMenu() {
  if (busy()) return;
  guard(async () => {
    const st = siteStats('koya'), st2 = siteStats('toji');
    const desc = S.name + '（' + age() + '歳）　' + eraStr(S.year) + '（' + S.year + '年）' + S.month + '月' + S.day + '日　' + clockStr() + '\n' +
      '体力 ' + Math.round(S.hp) + '/' + S.maxhp + '　銭 ' + S.money + '　法力 ' + S.horiki + '　記憶力 ' + S.memory + '　文才 ' + S.bun + '\n' +
      '徳 ' + S.toku + '　名声 ' + S.fame + '　信徒 ' + S.followers + '人\n' +
      (S.flags.koya ? '高野山の伽藍：' + st.count + '棟（景観×' + st.mult.toFixed(2) + '）\n' : '') + (S.flags.toji ? '東寺の伽藍：' + st2.count + '棟\n' : '') +
      '\n【能力について】能力は高くなるほど上がりにくくなる。眠ると体力は全快する。\n【暮らし方】建物に入り、家具や人の前で行動する。行動には時間がかかり、夜は布団で眠ると翌朝になる。\n寺：仏前で読経・座布団で瞑想・机で写経の仕事　屋敷：本棚で学問・文机で書\n民家の前で托鉢、「!」の人は頼みごと。';
    const i = await menu('状態', desc, [{ icon: 'food', label: '握り飯を食べる', sub: '体力 +30（所持 ' + S.items.food + '）', disabled: S.items.food < 1 || S.hp >= S.maxhp }, { label: '保存する', sub: '' }, { icon: 'book', label: '技能帳・蔵書・見聞録', sub: '修得した技能 ' + Object.keys(S.skills || {}).length + ' / ' + SKILLS.length }]);
    if (i === 2) await skillBook();
    if (i === 0) { S.items.food--; S.hp = Math.min(S.maxhp, S.hp + 30); itemFx('food', 1, '食べた'); toast('体力 +30'); }
    if (i === 1) save();
  });
}

// 室内の家具でできること
const own = () => { const r = mapRoot(), o = G.M.m.from || {}; return o.id === 'saeki' || o.id === 'atohouse' || o.role === 'base' || o.role === 'hut' || (o.id === 'takao' && S.flags.takao) || o.id === 'saimyoji' || o.id === 'kanzeonji'; };
const IACT = {
  sleep: async o => { const tpl = G.M.m.tpl; if (tpl === 'home' && !own()) { await say([[NARR, 'よそのお屋敷の布団で眠るわけにはいかない。']]); return; } const cost = own() ? 0 : tpl === 'inn' ? 30 : 10; await goSleep(cost, o.name); },
  study: async o => { if (Object.values(S.books || {}).includes(1)) { const c0 = await choose(o.name + '。どうする？', ['備え付けの書物を読む', '自分の蔵書を読む（読破で能力アップ）', 'やめる']); if (c0 === 1) { await readBooks(); return; } if (c0 === 2) return; } const set = mapRoot() === 'sanuki' ? 'rongo' : G.M.m.tpl === 'base' || G.M.m.tpl === 'temple' ? 'sutra' : 'kyo'; const c = await choose(o.name + 'の書物を読みますか？（3時間・記憶力↑）', ['読む', 'やめる']); if (c) return; await study(set, o.name); },
  calli: async o => { if (Object.values(S.books || {}).includes(1)) { const c0 = await choose(o.name + '。どうする？', ['書の稽古をする', '自分の蔵書を読む', 'やめる']); if (c0 === 1) { await readBooks(); return; } if (c0 === 2) return; else { await practiceCalli(); return; } } const c = await choose(o.name + 'で書の稽古をしますか？（2時間・文才↑）', ['稽古する', 'やめる']); if (c) return; await practiceCalli(); },
  sutra: async o => { const c = await choose(o.name + 'に向かい、経を唱えますか？（3時間・法力↑）', ['読経する', 'やめる']); if (c) return; await trainSutra(); },
  med: async o => { const c = await choose('座布団に座り、瞑想しますか？（2時間・法力↑）', ['瞑想する', 'やめる']); if (c) return; await trainMed(); },
  donate: async o => { const c = await choose('50銭を寄進しますか？（徳+2）', ['寄進する', 'やめる']); if (c || S.money < 50) return; S.money -= 50; itemFx('money', 50, '寄進した'); gain('toku', 2); },
  shakyo: async o => { if (!needHP(10)) return; const c = await choose('写経の仕事をしますか？（3時間・出来に応じて銭がもらえる）', ['写経する', 'やめる']); if (c || !(await useTime(3, '写経'))) return; const keys = Object.keys(STROKES); const ch = [keys[(Math.random() * keys.length) | 0], keys[(Math.random() * keys.length) | 0]]; const sc = await mgCalligraphy({ title: '写経の仕事', doc: '経典', chars: ch }); const m = 20 + Math.round(sc * 50); S.hp -= 8; itemFx('money', m, '受け取った'); S.money += m; gain('bun', 1); inc('shakyo'); },
  shop: async o => { await shopMenu({ name: G.M.def.name() }); },
  tea: async o => { const c = await choose('茶と団子でひと休みしますか？（10銭・1時間・体力+40）', ['一服する', 'やめる']); if (c) return; if (S.money < 10) { await say([[NARR, '銭が足りない。']]); return; } if (!(await useTime(1))) return; S.money -= 10; S.hp = Math.min(S.maxhp, S.hp + 40); toast('体力 +40'); },
  poem: async o => { const c = await choose('詩会の卓に加わりますか？（3時間・文才・名声↑）', ['加わる', 'やめる']); if (c) return; const sc = await poemParty('長安の詩会', '長安の文人たち'); gain('money', Math.round(sc * 40)); },
  bonji: async o => { const c = await choose('梵本を読み、梵字を学びますか？（3時間・記憶力↑）', ['学ぶ', 'やめる']); if (c) return; await study('bonji', '梵字の学習'); },
  build: async o => { const site = G.M.m.from.site; await exitBuilding(); startBuild(site); },
  wait: async o => { const c = await choose('ひと月のあいだ寺務に励み、お布施を待ちますか？', ['ひと月過ごす', 'やめる']); if (c) return; await sleepFx('―― ひと月が過ぎた ――'); advanceDays(29); refreshNPCs(); },
  fast: async o => { await trainFast(); }
};
// 人と話してできること
const NACT = {
  shop: async n => {
    const books = ['miyako', 'nara', 'choan', 'dazaifu', 'naniwa'].includes(mapRoot());
    const opts = ['品物を買う'].concat(books ? ['書物を買う'] : []).concat(hasSkill('gyosho') ? ['扁額の揮毫を請け負う（技能：行書）'] : []).concat(['やめる']);
    const c = await choose('いらっしゃい！　何にしましょう。', opts, n.name); const o = opts[c];
    if (o === '品物を買う') await shopMenu({ name: G.M.def.name() }); else if (o === '書物を買う') await bookShop(); else if (o && o.startsWith('扁額')) await hengaku(n);
  },
  inn: async n => { await say([[n.name, 'お泊まりですか？　奥の布団をお使いください。一晩30銭です。']]); },
  tea: async n => { await IACT.tea(); },
  lesson: async n => {
    if (!onceToday('lesson')) { await say([[n.name, '今日の講義は終わりじゃ。本棚の経書を読むか、文机で書写をしておれ。']]); return; }
    const c = await choose('叔父の講義を受けますか？（3時間）', ['論語・孝経の講義（記憶力↑↑）', '文章の添削（文才↑↑）', 'またにする'], n.name);
    if (c === 2) { S.daily.lesson = -1; return; }
    if (!(await useTime(3, '講義'))) { S.daily.lesson = -1; return; }
    S.hp -= 8; if (c === 0) { const sc = await mgMemory({ title: '大足の講義', set: S.cnt.lesson % 2 ? 'kyo' : 'rongo' }); gain('memory', tg('memory', 3 + sc * 6)); }
    else { const keys = Object.keys(STROKES); const sc = await mgCalligraphy({ title: '文章の添削', doc: '文選', chars: [keys[(Math.random() * keys.length) | 0], keys[(Math.random() * keys.length) | 0]] }); gain('bun', tg('bun', 3 + sc * 6)); }
    inc('lesson'); await say([[n.name, ['うむ、今日はここまで。', 'よく励んだ。', '明日もまた来るのじゃ。'][S.cnt.lesson % 3]]]);
  },
  lecture: async n => {
    if (!S.flags.enrolled) { await say([[n.name, 'そなたはまだ学生ではないな。']]); return; }
    if (!onceToday('lecture')) { await say([[n.name, '今日の講義は終わった。書庫で復習しておくがよい。']]); return; }
    if (!(await useTime(3, '講義'))) { S.daily.lecture = -1; return; }
    S.hp -= 8; const sc = await mgMemory({ title: '明経道の講義', set: 'kyo' }); gain('memory', tg('memory', 3 + sc * 6)); inc('lecture');
    await say([[n.name, sc > .7 ? '見事じゃ。周易も毛詩も、そなたはすぐに覚えてしまうな。' : '経書は一字一句、正確に覚えるのだ。']]);
  },
  court: async n => {
    if (!onceToday('court')) { await say([[n.name, '今日はもう下がってよいぞ。']]); return; }
    const c = await choose('帝の詩宴に加わりますか？（3時間・名声↑）', ['加わる', 'またにする'], n.name); if (c) { S.daily.court = -1; return; }
    const sc = await poemParty('宮中の詩宴', '嵯峨天皇の御前'); gain('fame', Math.round(sc * 6));
  },
  salon: async n => {
    if (hasSkill('tsugyo')) { const c0 = await choose('ようこそ。今日はいかがなさる？', ['詩会に加わる', '若君の家庭教師をする（技能：経書通暁）', 'やめる'], n.name); if (c0 === 1) { await kateikyoshi(n); return; } if (c0 === 2) return; }
    if (!onceToday('salon:' + mapRoot())) { await say([[n.name, '今宵の会はもうお開きじゃ。']]); return; }
    const c = await choose('貴族の屋敷で開かれる詩会に加わりますか？（3時間・文才・名声↑・謝礼）', ['加わる', 'またにする'], n.name); if (c) { delete S.daily['salon:' + mapRoot()]; return; }
    const sc = await poemParty('貴族の詩会', n.name + 'の屋敷'); const m = 10 + Math.round(sc * 40); itemFx('money', m, '謝礼として受け取った'); S.money += m;
  }
};

const ROLES = {
  flavor: async o => { await say([[NARR, o.text || (o.name + 'だ。')]]); kenbun(mapRoot() + ':' + (o.name || o.type) + o.tx, o.name || '名所'); },
  shop: async o => { if (!hasSkill('kaisho')) return shopMenu(o); const c = await choose(o.name + '。どうする？', ['買い物をする', '代筆屋を開く（技能：楷書）', 'やめる']); if (c === 0) await shopMenu(o); if (c === 1) await daihitsu(o); },
  house: async o => { if (!hasSkill('kaji') || !S.flags.upasaka) return takuhatsu(o); const c = await choose((o.name || '家') + 'の前。どうする？', ['托鉢をする', '加持祈祷を申し出る（技能：加持）', 'やめる']); if (c === 0) await takuhatsu(o); if (c === 1) await kajiKito(o); },
  cave: async o => { const i = await menu(o.name, '海に面した岩屋。波の音だけが響く。', [{ label: '瞑想', sub: '法力↑↑ 体力-10 2時間' }, { label: '断食行', sub: '法力↑↑↑ 体力-40 7日' }, { label: '読経修行', sub: '法力↑ 3時間' }, { label: '岩屋で眠る', sub: '翌朝まで' }]); if (i === 0) await trainMed(1.15, '岩屋での瞑想', 10, 1.4); if (i === 1) await trainFast(); if (i === 2) await trainSutra(); if (i === 3) await goSleep(0, '岩屋'); },
  fall: async o => { const i = await menu(o.name, '轟々と流れ落ちる滝。', [{ label: '滝行', sub: '法力↑↑ 体力-15 2時間' }]); if (i === 0) await trainMed(1.3, '滝行', 15, 1.6); },
  meditate: async o => { const i = await menu(o.name, '平らな大岩。座禅にちょうどよい。', [{ label: '瞑想', sub: '法力↑ 体力-8 2時間' }]); if (i === 0) await trainMed(1, '座禅'); },
  sign: o => travelMenu(o, false),
  port: o => travelMenu(o, true),
  kentoshi: async o => { await say([[NARR, S.year >= 804 ? '大きな遣唐使船だ。藤原葛野麻呂さまが近くにいるはずだ。' : '唐へ渡る大船だ。いつか自分も……。']]); },
  manno: async o => { await say([[NARR, S.flags.mannoDone ? '修築された満濃池。水が満々とたたえられ、田を潤している。' : '満濃池。讃岐最大のため池だが、堤がたびたび決壊している……。']]); },
  shinsen: async o => { await say([[NARR, '神泉苑。天皇の遊ぶ池の庭園。清らかな泉が湧いている。']]); },
  okunoin: async o => { await say([[NARR, S.flags.ended ? '大師はここで、今も人々の幸せを祈り続けている――。' : '杉木立の奥、静かな霊域だ。']]); },
  toji_gate: async o => { if (S.flags.toji) await warp('toji', 'start'); else await say([[NARR, '東寺。国家鎮護のために建てられた官寺だ。まだ空海とは縁がない。']]); },
  built: async o => { const c = BCAT.find(x => x.type === o.type); await say([[NARR, (c ? c.name + '。' + c.desc : '') + '。参拝者が手を合わせている。']]); }
};

// ---------------- 伽藍の建立（経営） ----------------
function startBuild(site) {
  const z = MAPDEF[site].zone;
  G.build = { site, sel: null, cx: z.x + (z.w >> 1), cy: z.y + (z.h >> 1) };
  $('hint').classList.add('hidden'); renderBuildBar();
}
function renderBuildBar() {
  const b = $('buildbar'); b.classList.remove('hidden'); b.innerHTML = '';
  const head = document.createElement('span'); head.innerHTML = '<b>伽藍の建立</b>　所持 ' + S.money + '銭　｜ 選んでからクリック/Enterで配置・矢印で移動・Escで終了｜'; b.appendChild(head);
  BCAT.filter(c => !c.only || c.only === G.build.site).forEach(c => {
    const e = document.createElement('button'); e.textContent = c.name + ' ' + c.cost; e.title = c.desc + '（信徒+' + c.faith + '/月　お布施+' + c.alms + '/月）';
    e.disabled = S.money < c.cost; if (G.build.sel === c) e.className = 'sel';
    e.onclick = () => { G.build.sel = c; renderBuildBar(); }; b.appendChild(e);
  });
  const x = document.createElement('button'); x.textContent = '終了'; x.onclick = endBuild; b.appendChild(x);
  if (G.build.sel) { const d = document.createElement('span'); d.textContent = '　' + G.build.sel.name + '：' + G.build.sel.desc; b.appendChild(d); }
}
function endBuild() { G.build = null; $('buildbar').classList.add('hidden'); refreshNPCs(); checkAuto(); }
function buildKey(k) {
  const b = G.build;
  if (CANCEL(k)) { if (b.sel) { b.sel = null; renderBuildBar(); } else endBuild(); return; }
  if (k === 'ArrowLeft' || k === 'a') b.cx--; if (k === 'ArrowRight' || k === 'd') b.cx++; if (k === 'ArrowUp' || k === 'w') b.cy--; if (k === 'ArrowDown' || k === 's') b.cy++;
  if (ACT(k)) placeBuild();
}
function canPlace() {
  const b = G.build, c = b.sel; if (!c) return false;
  const z = MAPDEF[b.site].zone, M = G.M;
  const x0 = b.cx - (c.w >> 1), y0 = b.cy - c.h + 1;
  if (x0 < z.x || y0 < z.y || x0 + c.w > z.x + z.w || y0 + c.h > z.y + z.h) return false;
  for (let j = y0; j < y0 + c.h; j++) for (let i = x0; i < x0 + c.w; i++) { const idx = j * M.w + i; if (M.solid[idx] || M.objAt[idx] >= 0) return false; }
  if (!c.obj) for (let i = x0; i < x0 + c.w; i++) { const idx = (y0 + c.h) * M.w + i; if (M.solid[idx]) return false; }
  const px = Math.floor(G.p.x / TS), py = Math.floor(G.p.y / TS); if (px >= x0 && px < x0 + c.w && py >= y0 && py < y0 + c.h) return false;
  return S.money >= c.cost;
}
function placeBuild() {
  const b = G.build, c = b.sel; if (!c) { toast('建てる建物を選んでください'); return; }
  if (!canPlace()) { SFX.miss(); toast('ここには建てられない'); return; }
  S.money -= c.cost; S.built[b.site].push({ type: c.type, tx: b.cx - (c.w >> 1), ty: b.cy - c.h + 1 });
  rebuildCurrent(); SFX.bell(); toast(c.name + ' を建立した！'); updateHUD(); renderBuildBar();
  if (S.money < c.cost) { b.sel = null; renderBuildBar(); }
  const st = STORY[S.step]; if (st && st.target === 'auto' && st.check()) endBuild();
}
function drawZone(g, cx, cy) {
  const z = MAPDEF[G.build.site].zone; g.strokeStyle = 'rgba(255,230,120,.8)'; g.setLineDash([4, 3]); g.lineWidth = 1;
  g.strokeRect(z.x * TS - cx + .5, z.y * TS - cy + .5, z.w * TS - 1, z.h * TS - 1); g.setLineDash([]);
}
function drawGhost(g, cx, cy) {
  const b = G.build, c = b.sel;
  if (!c) { g.strokeStyle = '#fff'; g.strokeRect(b.cx * TS - cx + .5, b.cy * TS - cy + .5, 15, 15); return; }
  const x0 = b.cx - (c.w >> 1), y0 = b.cy - c.h + 1, ok = canPlace();
  g.fillStyle = ok ? 'rgba(120,255,120,.35)' : 'rgba(255,80,80,.4)'; g.fillRect(x0 * TS - cx, y0 * TS - cy, c.w * TS, c.h * TS);
  const s = c.obj ? objSprite(c.type) : bldSprite(c.type, c.w, c.h);
  g.globalAlpha = .7; g.drawImage(s, x0 * TS + ((c.w * TS - s.width) >> 1) - cx, (y0 + c.h) * TS - s.height - cy); g.globalAlpha = 1;
}

// ---------------- 保存 ----------------
function save(silent) {
  if (G.M.m.interior && G.outside) { S.map = G.outside.map; S.px = G.outside.x * TS + 8; S.py = G.outside.y * TS + 12; S.dir = 0; }
  else { S.px = G.p.x; S.py = G.p.y; S.dir = G.p.dir; S.map = G.M.id; }
  try { localStorage.setItem('kukai_save', JSON.stringify(S)); if (!silent) toast('保存しました'); } catch (e) { if (!silent) toast('保存できませんでした'); }
}
function loadSave() { try { const s = localStorage.getItem('kukai_save'); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ---------------- エンディング ----------------
async function ending() {
  const st = siteStats('koya'), st2 = siteStats('toji');
  await say([
    [NARR, '―― 遍照の道 ・ 完 ――'],
    [NARR, '【あなたの空海】\n法力 ' + S.horiki + '　記憶力 ' + S.memory + '　文才 ' + S.bun + '　徳 ' + S.toku + '\n信徒 ' + S.followers + '人　名声 ' + S.fame + '　伽藍 ' + (st.count + st2.count) + '棟'],
    [NARR, '遊んでくれてありがとう。\nこのあとも自由に日本各地を巡り、伽藍を育て、人々を救い続けることができます。']
  ]);
}

// ---------------- 序章 ----------------
async function prologue() {
  $('loc').classList.add('hidden');
  await scene('birth', [
    '讃岐国多度郡、屏風浦。\n瀬戸内の海にのぞむこの里で、\n郡司・佐伯直田公の家に一人の男の子が生まれた。',
    '母・玉依御前は、天竺の聖僧が\n胎内に入る夢を見て身ごもったという。',
    '幼名は「真魚（まお）」。\nのちに「弘法大師」と呼ばれる、空海の物語である。'
  ], { date: '宝亀5年（774年）6月15日' });
  await scene('dorobotoke', [
    '幼い真魚は、ほかの子どもと遊ぶよりも\n泥をこねて仏の像を作り、\n草の庵に並べて拝むのを好んだという。',
    '夢の中では、八葉の蓮華の上に座り、\n諸仏と語り合っていたとも伝えられる。'
  ], { date: '幼少のころ' });
  await scene('shashin', [
    '七歳のとき。真魚は郷里の山・我拝師山の断崖に立ち、こう誓った。',
    '「わたしは仏の道に入り、多くの人を救いたい。\nこの願いが叶うならば、命を救いたまえ。\n叶わぬならば、この身を仏に捧げよう」',
    '身を投げた真魚を、天女が舞い降りて抱きとめたという。\n――「捨身誓願」の伝説である。'
  ], { date: '宝亀11年（780年）' });
  await scene('village', [
    'それから八年。\n真魚は十五歳になり、一族の期待を一身に背負っていた。',
    '佐伯の家は地方の豪族。\n一族の誉れとなるには、都で学問を修め、\n朝廷の官人となる道しかない。',
    'そしてついに、都にいる叔父のもとで\n学ぶことが決まった――。'
  ], { date: '延暦7年（788年）春' });
  await say([
    [NARR, '【はじめに】ここからはあなたが真魚を動かします。\n矢印キー（またはWASD）で歩き、Space（またはEnter）で人と話したり、家具を調べたりできます。'],
    [NARR, '時は刻々と流れ、夜になれば暗くなります。夜は布団で眠ると、翌朝になります。\n画面右上の「目的」が、次にやるべきこと。目的地の上には ▼ の印が出ます。'],
    [NARR, 'まずは、目の前の母・玉依御前に話しかけよう。']
  ]);
}

// ---------------- タイトル ----------------
function titleAnim() {
  const c = $('tcv'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; let t = 0;
  const loop = () => {
    if (G.started) return; t++;
    const gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, '#1a1030'); gr.addColorStop(.6, '#6a3a5a'); gr.addColorStop(1, '#e8905a'); g.fillStyle = gr; g.fillRect(0, 0, 240, 150);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + (.3 + .4 * Math.abs(Math.sin(t / 40 + i))) + ')'; g.fillRect(h2(i, 1, 1) * 240, h2(i, 2, 1) * 70, 1, 1); }
    g.fillStyle = '#fff8d0'; g.fillRect(190, 30, 3, 3); g.fillStyle = 'rgba(255,248,200,.3)'; g.fillRect(188, 28, 7, 7);
    g.fillStyle = '#3a2840'; g.beginPath(); g.moveTo(0, 110); for (let x = 0; x <= 240; x += 20) g.lineTo(x, 95 + Math.sin(x / 30) * 12); g.lineTo(240, 150); g.lineTo(0, 150); g.fill();
    g.fillStyle = '#2a6aa8'; g.fillRect(0, 128, 240, 22); g.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 8; i++) g.fillRect((i * 37 + t / 3) % 260 - 10, 132 + (i % 3) * 5, 8, 1);
    g.drawImage(bldSprite('pagoda', 3, 3), 150, 0);
    const px = ((t / 2) % 300) - 30; g.drawImage(charSprite({ hair: 'bald', robe: '#3a3a4a', kesa: '#b86a2a', staff: true }, 3, ((t / 8) | 0) % 4), px, 104);
    requestAnimationFrame(loop);
  };
  loop();
}
async function enterById(mapId, bid) { const o = G.M.objs.find(x => x.id === bid); if (o) { const m = buildInteriorMap(o, mapId); G.outside = { map: mapId, x: o.tx + (o.w >> 1), y: o.ty + o.h, o }; await warp(m.id, 'start', 1); } }
function startGame(st) {
  S = Object.assign(defaultState(), st || {});
  for (const k of ['cnt', 'daily', 'hints']) S[k] = S[k] || {};
  if (S.min == null) S.min = 8 * 60;
  $('title').classList.add('hidden'); ['hud', 'btns'].forEach(id => $(id).classList.remove('hidden'));
  buildSlots(); G.started = true; G.last = performance.now();
  if (st) { warp(S.map, [Math.floor(S.px / TS), Math.floor(S.py / TS)]).then(() => { G.p.x = S.px; G.p.y = S.py; G.p.dir = S.dir || 0; camFollow(true); }); }
  else {
    warp('sanuki', 'start').then(async () => { await enterById('sanuki', 'saeki'); G.p.x = 9 * TS + 8; G.p.y = 8 * TS + 12; G.p.dir = 1; camFollow(true); guard(prologue); });
  }
}
$('tNew').onclick = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } startGame(null); };
$('tLoad').onclick = () => { const s = loadSave(); if (s) startGame(s); };
if (!loadSave()) $('tLoad').disabled = true, $('tLoad').style.opacity = .4;
$('bStatus').onclick = () => statusMenu();
$('bSave').onclick = () => { if (!busy()) save(); };

function frame() { update(); render(); requestAnimationFrame(frame); }
titleAnim(); frame();
