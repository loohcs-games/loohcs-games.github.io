'use strict';
// =====================================================================
//  skills.js — 技能（スキル）・街の仕事・問答・書物・見聞録
//  能力が伸びると技能を修得し、街でできることが増えていく
// =====================================================================

const SKILLS = [
  { id: 'sodoku', name: '素読', need: () => S.memory >= 20, cond: '記憶力20', desc: '本棚や講義での学問で、記憶力がさらに +1。' },
  { id: 'mondo', name: '問答', need: () => S.memory >= 25, cond: '記憶力25', desc: '学生・学僧・文人に「問答」を挑める（一日一度・場所ごと）。名声と記憶力が上がる。' },
  { id: 'kaisho', name: '楷書', need: () => S.bun >= 15, cond: '文才15', desc: '市の露店で「代筆屋」を開ける。字の書けない人の手紙を書いて銭を稼ぐ。' },
  { id: 'tsugyo', name: '経書通暁', need: () => S.memory >= 35, cond: '記憶力35', desc: '貴族の屋敷で、若君の「家庭教師」を務められる（謝礼と徳）。' },
  { id: 'gyosho', name: '行書', need: () => S.bun >= 30, cond: '文才30', desc: '店の主人から「扁額（看板）の揮毫」を請け負える（月に一度・店ごと。大きな謝礼と名声）。' },
  { id: 'dokyo', name: '読経の声', need: () => S.horiki >= 15, cond: '法力15', desc: '托鉢でいただくお布施が 1.5 倍になる。' },
  { id: 'kaji', name: '加持', need: () => S.horiki >= 30, cond: '法力30', desc: '民家で「加持祈祷」を行い、病に苦しむ人を救える。儀式で真言の力も増す。' },
  { id: 'hakuran', name: '博覧強記', need: () => S.memory >= 50, cond: '記憶力50', desc: '問答で難問に挑めるようになり、報酬が増える。' },
  { id: 'sosho', name: '草書', need: () => S.bun >= 45, cond: '文才45', desc: '詩会で得る文才・名声・謝礼が倍になる。' },
  { id: 'jinbo', name: '人望', need: () => S.toku >= 10, cond: '徳10', desc: '朝、近所の人が握り飯を差し入れてくれることがある。' },
  { id: 'hyoban', name: '都の評判', need: () => S.fame >= 25, cond: '名声25', desc: '代筆・揮毫・家庭教師の謝礼が 1.3 倍になる。' },
  { id: 'zosho', name: '蔵書家', need: () => booksRead() >= 5, cond: '書物を5冊読破', desc: '学問で記憶力がさらに +1。読書の効果も上がる。' },
  { id: 'kenbun', name: '見聞家', need: () => kenbunCount() >= 12, cond: '見聞録12件', desc: '旅慣れて、旅で減る体力が半分になる。' }
];
const hasSkill = id => !!(S && S.skills && S.skills[id]);
let skillChecking = false;
function checkSkills() {
  if (!S || skillChecking) return; skillChecking = true;
  S.skills = S.skills || {};
  for (const sk of SKILLS) if (!S.skills[sk.id] && sk.need()) { S.skills[sk.id] = true; skillFx(sk); }
  skillChecking = false;
}
const FX_QUEUE = [];
function skillFx(sk) {
  FX_QUEUE.push(sk); if (FX_QUEUE.length > 1) return;
  const next = () => {
    const s = FX_QUEUE[0]; if (!s) return;
    const el = document.createElement('div'); el.className = 'skillfx panel';
    el.innerHTML = '<div class="sk1">技能を修得</div><div class="sk2">「' + s.name + '」</div><div class="sk3">' + s.desc + '</div>';
    $('game').appendChild(el);
    beep(523, .15, 'triangle', .07); beep(659, .15, 'triangle', .07, .12); beep(784, .3, 'triangle', .07, .24);
    setTimeout(() => el.classList.add('show'), 20);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); FX_QUEUE.shift(); next(); }, 500); }, 3600);
  };
  next();
}

// ---------------- 見聞録 ----------------
function kenbunCount() { return Object.keys((S && S.kenbun) || {}).length; }
function kenbun(key, label) {
  S.kenbun = S.kenbun || {};
  if (S.kenbun[key]) return;
  S.kenbun[key] = label;
  const n = kenbunCount();
  toast('見聞録に記した：' + label + '（' + n + '件）');
  if (n % 2) gain('memory', 1); else gain('bun', 1);
  if (n === 20) { gain('bun', 5); toast('見聞録20件！ 文才 +5'); }
  checkSkills();
}

// ---------------- 書物 ----------------
const BOOKS = [
  { id: 'senjimon', name: '千字文', p: 30, eff: { memory: 2, bun: 1 }, set: 'kanji', where: 'jp', desc: '千の漢字で編まれた手習いの書' },
  { id: 'kokyo', name: '孝経', p: 60, eff: { memory: 3 }, set: 'rongo', where: 'jp', desc: '親への孝を説く儒教の経典' },
  { id: 'rongo', name: '論語', p: 80, eff: { memory: 4, toku: 1 }, set: 'rongo', where: 'jp', desc: '孔子と弟子たちの言行録' },
  { id: 'moshi', name: '毛詩', p: 100, eff: { bun: 4 }, set: 'kyo', where: 'jp', desc: '古代中国の詩を集めた詩経' },
  { id: 'monzen', name: '文選', p: 150, eff: { bun: 6 }, set: 'kyo', where: 'jp', desc: '名文・名詩の選集。文章を学ぶ者の必読書' },
  { id: 'shiki', name: '史記', p: 150, eff: { memory: 5 }, set: 'kyo', where: 'jp', desc: '司馬遷の歴史書' },
  { id: 'roshi', name: '老子', p: 80, eff: { memory: 2, bun: 2 }, set: 'kyo', where: 'jp', desc: '無為自然を説く道家の書' },
  { id: 'soshi', name: '荘子', p: 100, eff: { bun: 3, memory: 2 }, set: 'kyo', where: 'jp', desc: '胡蝶の夢で知られる道家の書' },
  { id: 'shingyo', name: '般若心経', p: 40, eff: { horiki: 2 }, set: 'sutra', where: 'jp', desc: '空の教えを凝縮した短い経典' },
  { id: 'hokke', name: '法華経', p: 120, eff: { horiki: 4, toku: 1 }, set: 'sutra', where: 'jp', desc: 'すべての人が仏になれると説く経典' },
  { id: 'gishi', name: '王羲之の法帖', p: 220, eff: { bun: 8 }, set: 'kanji', where: 'any', desc: '書聖・王羲之の書の手本' },
  { id: 'bonpon', name: '梵本の経典', p: 200, eff: { memory: 6, horiki: 2 }, set: 'bonji', where: 'cn', desc: 'インドの言葉で書かれた経典' },
  { id: 'kyorei', name: '詩論の書', p: 160, eff: { bun: 7 }, set: 'kyo', where: 'cn', desc: '唐の詩の作法を論じた書（のちの『文鏡秘府論』の素材）' }
];
function booksRead() { return Object.values((S && S.books) || {}).filter(v => v === 2).length; }
function bookShopItems() {
  const cn = S.flags.china;
  return BOOKS.filter(b => !(S.books || {})[b.id] && (b.where === 'any' || (b.where === 'cn') === !!cn));
}
async function bookShop(o) {
  S.books = S.books || {};
  for (; ;) {
    const list = bookShopItems();
    if (!list.length) { await say([[NARR, 'ここで手に入る書物は、すべて揃えた。']]); return; }
    const i = await menu('書物を買う', '所持金 ' + S.money + ' 銭　（買った書物は、屋敷や寺の本棚・机で読める）', list.map(b => ({ label: '『' + b.name + '』　' + b.p + '銭', sub: b.desc, disabled: S.money < b.p })));
    if (i < 0) return;
    const b = list[i]; S.money -= b.p; S.books[b.id] = 1; bookFx(b); updateHUD();
    await new Promise(r => setTimeout(r, 450));
  }
}
function bookFx(b) {
  const el = document.createElement('div'); el.className = 'itemfx panel'; const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12; cv.getContext('2d').drawImage(itemIcon('book'), 0, 0); el.appendChild(cv); const sp = document.createElement('span'); sp.textContent = '『' + b.name + '』を手に入れた'; el.appendChild(sp);
  $('game').appendChild(el); beep(784, .09, 'triangle', .07); beep(1046, .14, 'triangle', .05, .07);
  setTimeout(() => el.classList.add('up'), 20); setTimeout(() => { el.style.opacity = 0; }, 1300); setTimeout(() => el.remove(), 1800);
}
async function readBooks() {
  S.books = S.books || {};
  const list = BOOKS.filter(b => S.books[b.id] === 1);
  if (!list.length) { await say([[NARR, '読んでいない書物がない。都の筆墨屋や店で書物を買えば、ここで読める。']]); return; }
  const i = await menu('蔵書を読む', '3時間かけて一冊を読み通す。読破すると、その書の力が身につく。', list.map(b => ({ label: '『' + b.name + '』', sub: Object.entries(b.eff).map(([k, v]) => ({ memory: '記憶力', bun: '文才', horiki: '法力', toku: '徳' }[k]) + '+' + v).join(' ') })));
  if (i < 0) return;
  const b = list[i];
  if (!needHP(10) || !(await useTime(3, '読書'))) return;
  const sc = await mgMemory({ title: '『' + b.name + '』を読む', set: b.set, rounds: 1 });
  S.hp -= 5; S.books[b.id] = 2;
  const mul = (sc >= .5 ? 1 : .6) * (hasSkill('zosho') ? 1.3 : 1);
  for (const [k, v] of Object.entries(b.eff)) gain(k, Math.max(1, Math.round(v * mul)));
  await say([[NARR, '『' + b.name + '』を読破した。（読破 ' + booksRead() + ' 冊）']]);
}

// ---------------- 問答（クイズ） ----------------
const QUIZ = [
  // [問い, 正解, 誤り…, 難易度 1/2]
  ['「学びて時に之を習う、亦た説ばしからずや」で始まる書は？', '論語', '孝経', '老子', '史記', 1],
  ['儒教の「五経」に含まれないものは？', '論語', '易経', '詩経', '礼記', 1],
  ['孔子の弟子で「一を聞いて十を知る」と称えられたのは？', '顔回', '子路', '子貢', '曾子', 1],
  ['儒教で、親を敬い大切にする徳を何という？', '孝', '忠', '信', '恕', 1],
  ['東大寺の大仏を造らせた天皇は？', '聖武天皇', '桓武天皇', '天武天皇', '推古天皇', 1],
  ['仏教が日本に公に伝えられたのは、どの国からか？', '百済', '新羅', '高句麗', '唐', 1],
  ['十七条の憲法を定めたと伝えられる人物は？', '厩戸皇子（聖徳太子）', '中大兄皇子', '藤原鎌足', '蘇我馬子', 1],
  ['唐の都はどこか？', '長安', '洛陽', '揚州', '建康', 1],
  ['唐から戒律を伝えるため、苦難の末に来日した僧は？', '鑑真', '玄奘', '道昭', '菩提僊那', 1],
  ['天竺へ経典を求めて旅し、多くの経を漢訳した唐の僧は？', '玄奘', '鑑真', '不空', '義浄', 1],
  ['民衆に教えを広め、橋や池を造って「菩薩」と慕われた僧は？', '行基', '道鏡', '良弁', '玄昉', 1],
  ['『老子』が説く、作為を捨て自然に従う生き方を何という？', '無為自然', '仁義礼智', '兼愛', '法治', 1],
  ['「書聖」と称えられる東晋の書家は？', '王羲之', '顔真卿', '欧陽詢', '虞世南', 1],
  ['大学寮で、儒教の経典を学ぶ学科は？', '明経道', '明法道', '算道', '音道', 1],
  ['孔子は「吾十有五にして学に志す」と言った。では「三十にして」？', '立つ', '惑わず', '天命を知る', '耳順う', 2],
  ['孔子の言葉「四十にして」？', '惑わず', '立つ', '天命を知る', '心の欲する所に従う', 2],
  ['『般若心経』の「色即是□」。□に入る字は？', '空', '無', '心', '法', 2],
  ['『古事記』を筆録して献上したのは？', '太安万侶', '稗田阿礼', '柿本人麻呂', '山上憶良', 2],
  ['『日本書紀』編纂の中心となった皇子は？', '舎人親王', '草壁皇子', '大津皇子', '長屋王', 2],
  ['「春眠暁を覚えず」の詩を作った唐の詩人は？', '孟浩然', '李白', '杜甫', '王維', 2],
  ['東大寺が根本道場とする、華厳の教えの中心の仏は？', '盧舎那仏', '阿弥陀仏', '薬師如来', '弥勒菩薩', 2],
  ['『荘子』で、夢の中で蝶になった話を何という？', '胡蝶の夢', '朝三暮四', '井の中の蛙', '守株', 2],
  ['「虚空蔵求聞持法」で唱えるのは、どの菩薩の真言か？', '虚空蔵菩薩', '観音菩薩', '地蔵菩薩', '文殊菩薩', 2],
  ['『史記』を著した漢の歴史家は？', '司馬遷', '班固', '孔子', '韓非', 2],
  ['正倉院に納められた宝物の多くは、どの天皇の遺愛の品か？', '聖武天皇', '持統天皇', '元明天皇', '光仁天皇', 2]
];
function mgQuiz(o = {}) {
  return new Promise(res => {
    mgStart(o.title || '問答');
    const g = MG.g, hard = !!o.hard, N = o.n || (hard ? 5 : 3);
    const pool = QUIZ.filter(q => hard ? true : q[5] === 1).sort(() => Math.random() - .5).slice(0, N);
    let qi = 0, ok = 0, phase = 'ask', msg = '', t = 0, ended = false, opts = [];
    const setQ = () => { const q = pool[qi]; opts = [q[1], q[2], q[3], q[4]].sort(() => Math.random() - .5); phase = 'ask'; msg = ''; mgButtons(opts.map((a, i) => ({ label: (i + 1) + '. ' + a, fn: () => answer(i) }))); };
    const answer = i => {
      if (phase !== 'ask') return; const q = pool[qi];
      if (opts[i] === q[1]) { ok++; msg = '正解！'; SFX.good(); } else { msg = '残念……正しくは「' + q[1] + '」'; SFX.miss(); }
      phase = 'res'; t = 0; mgButtons([]);
    };
    MG.onKey = (k, down) => { if (!down) return; const n = parseInt(k); if (n >= 1 && n <= 4) answer(n - 1); };
    const draw = () => {
      paperBg(g); mgHeader(g, o.title || '問答', (o.who || '相手') + 'との問答　' + (qi + 1) + ' / ' + N);
      drawSpr(g, playerSpr(0, 0), 60, 330, 5);
      if (o.spec) drawSpr(g, charSprite(Object.assign({}, o.spec, { seat: false, _k: null }), 0, 0), 760, 330, 5);
      g.fillStyle = '#fffaf0'; g.fillRect(170, 110, 560, 170); g.strokeStyle = '#2b1d12'; g.lineWidth = 4; g.strokeRect(170, 110, 560, 170);
      const q = pool[Math.min(qi, N - 1)][0];
      const lines = []; for (let i = 0; i < q.length; i += 22) lines.push(q.slice(i, i + 22));
      lines.forEach((l, i) => txt(g, l, 450, 170 + i * 36 - (lines.length - 1) * 12, 26, '#2b1d12', 'center'));
      if (phase === 'res') txt(g, msg, 450, 330, 30, msg === '正解！' ? '#2a7a3a' : '#b8392b', 'center', '#fff');
      txt(g, '正解 ' + ok, 450, 400, 22, '#5a4030', 'center');
    };
    setQ();
    mgLoop(dt => {
      t += dt;
      if (phase === 'res' && t > 1300) { qi++; if (qi >= N) { ended = true; const sc = ok / N; mgFinish(draw, [sc === 1 ? '見事な問答！' : sc >= .6 ? 'よく答えた' : '修行が足りぬ……', N + '問中 ' + ok + '問 正解']).then(() => res(sc)); return false; } setQ(); }
      if (!ended) draw();
    });
  });
}
const MONDO_WHO = ['学生', '東大寺の学僧', '寺の僧', '長安の文人', '詩人', '若い官人', '僧', '修行者', '唐の僧', '貴族', '役人', '観世音寺の僧', '高雄山寺の僧', '戒師', '公卿', '訳経僧', '唐の人', '山の修行者', '書生'];
async function mondo(n) {
  const key = 'mondo:' + mapRoot() + ':' + (G.M.m.interior ? G.M.id : n.name);
  if (doneToday(key)) { await say([[n.name, '今日の問答はもう十分です。また明日。']]); return; }
  const hard = hasSkill('hakuran');
  const c = await choose(n.name + 'に問答を挑みますか？（1時間）', [hard ? '難問に挑む（5問）' : '問答を挑む（3問）', 'やめる']); if (c) return;
  if (!(await useTime(1, '問答'))) return;
  onceToday(key);
  const sc = await mgQuiz({ title: '問答', who: n.name, spec: n.spec, hard });
  gain('memory', Math.round(sc * (hard ? 3 : 2))); gain('fame', Math.round(sc * (hard ? 5 : 3)));
  await say([[n.name, sc >= .8 ? 'まいりました……！　なんという博識。' : sc >= .5 ? 'なかなかのものですな。' : 'まだまだ学ぶことが多いようですな。']]);
  inc('mondo');
}

// ---------------- 街の仕事 ----------------
const payMul = () => hasSkill('hyoban') ? 1.3 : 1;
function rndChars(n) { const keys = Object.keys(STROKES); const out = []; while (out.length < n) { const k = keys[(Math.random() * keys.length) | 0]; if (!out.includes(k)) out.push(k); } return out; }
async function daihitsu(o) {
  const key = 'daihitsu:' + mapRoot();
  if (doneToday(key)) { await say([[NARR, '今日の代筆屋はもう店じまいだ。']]); return; }
  if (S.min >= 18 * 60) { await say([[NARR, '日が暮れて、市の人通りも減った。代筆屋は明日にしよう。']]); return; }
  const c = await choose('市の片隅に「代筆いたします」の札を立てますか？（2時間）', ['代筆屋を開く', 'やめる']); if (c) return;
  if (!(await useTime(2, '代筆'))) return; onceToday(key);
  const who = ['母に便りを出したい漁師', '恋文を頼みたい若者', '借金の証文を書いてほしい商人', '国元へ知らせを出したい役人の従者'][(Math.random() * 4) | 0];
  await say([[NARR, '客がやって来た。――' + who + 'だ。']]);
  const sc = await mgCalligraphy({ title: '代筆屋', doc: '手紙', chars: rndChars(2) });
  const m = Math.round((25 + sc * 60) * payMul()); itemFx('money', m, '代筆の礼に受け取った'); S.money += m; gain('bun', 1); if (sc > .7) gain('fame', 1); inc('daihitsu');
}
async function hengaku(n) {
  const key = 'hengaku:' + mapRoot() + ':' + G.M.id;
  S.monthly = S.monthly || {};
  const mk = S.year * 12 + S.month;
  if (S.monthly[key] === mk) { await say([[n.name, '看板はおかげさまで評判です。また来月にでも。']]); return; }
  const c = await choose(n.name + '「あなたの書は評判ですな。うちの店の扁額（看板）を書いてくださらんか」（3時間）', ['引き受ける', '断る']); if (c) return;
  if (!(await useTime(3, '揮毫'))) return;
  S.monthly[key] = mk;
  const sc = await mgCalligraphy({ title: '扁額の揮毫', doc: '扁額', chars: rndChars(3) });
  const m = Math.round((70 + sc * 160) * payMul()); itemFx('money', m, '揮毫の謝礼に受け取った'); S.money += m; gain('fame', 2 + Math.round(sc * 4)); gain('bun', 1); inc('hengaku');
  await say([[n.name, sc > .74 ? 'これは見事！　店の宝にいたします。' : 'ありがたい。さっそく掲げましょう。']]);
}
async function kateikyoshi(n) {
  const key = 'katei:' + G.M.id;
  if (doneToday(key)) { await say([[n.name, '若君の講義は、また明日お願いいたします。']]); return; }
  const c = await choose(n.name + '「若君に経書の手ほどきをしてくださらんか」（3時間）', ['講義する', 'またにする']); if (c) return;
  if (!(await useTime(3, '講義'))) return; onceToday(key);
  const sc = await mgMemory({ title: '若君への講義', set: Math.random() < .5 ? 'rongo' : 'kyo', n: 4, rounds: 2 });
  const m = Math.round((30 + sc * 60) * payMul()); itemFx('money', m, '謝礼として受け取った'); S.money += m; gain('toku', 1); gain('memory', 1); inc('katei');
}
async function kajiKito(o) {
  const key = 'kaji:' + mapRoot() + o.tx + '_' + o.ty;
  if (S.takuhatsu['k' + key]) { await say([[NARR, 'この家の人はもうすっかり元気だ。']]); return; }
  await say([['家の人', 'お坊さま……年老いた父が、ずっと病で伏せっているのです。']]);
  const c = await choose('加持祈祷を行いますか？（2時間）', ['祈祷する', 'やめる']); if (c) return;
  if (!(await useTime(2, '祈祷'))) return;
  const r = await mgRitual({ title: '加持祈祷', enemy: 'plague', hp: 60 + Math.min(80, (S.year - 790) * 3), atk: 7, winText: '病が癒えた！' });
  if (!r.win) { await say([['家の人', 'まだ苦しそうです……。']]); return; }
  S.takuhatsu['k' + key] = 1;
  await say([['家の人', '父が起き上がりました！　なんとありがたい……。']]); gain('toku', 3); gain('followers', 8); const m = 20 + ((Math.random() * 30) | 0); itemFx('money', m, '布施として受け取った'); S.money += m; inc('kaji');
}
async function morningGift() {
  if (!hasSkill('jinbo') || Math.random() > .35) return;
  S.items.food++; itemFx('food', 1, '差し入れにもらった');
}
// 技能帳
async function skillBook() {
  checkSkills();
  const sk = SKILLS.map(s => (hasSkill(s.id) ? '◆ ' + s.name + '　' + s.desc : '◇ ？？？（' + s.cond + 'で修得）')).join('\n');
  const books = BOOKS.filter(b => (S.books || {})[b.id]).map(b => '『' + b.name + '』' + (S.books[b.id] === 2 ? '（読破）' : '（未読）')).join('　') || 'まだない';
  const kb = Object.values(S.kenbun || {}).join('・') || 'まだない';
  await menu('技能帳', '【技能】\n' + sk + '\n\n【蔵書】' + books + '\n\n【見聞録 ' + kenbunCount() + '件】' + kb, []);
}
