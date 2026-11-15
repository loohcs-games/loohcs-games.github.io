'use strict';
/*
  狼のいる夜。20:00 から 6:00 までの 20 コマを、狼に見つからずに生き延びる選択肢ゲーム。
  仕様は ookami-spec.md。
  ?test         自己テスト
  ?auto=1〜5    結末①〜⑤へ至る既定の道筋を自動で歩く（確認用）
  ?route=a,b,c  選択肢の文字列を , で区切って渡し、順に選ぶ（確認用）
  ?skip=T       ③の道筋で T コマ目まで進めたところから（確認用）
  ?fresh        おぼえがきを消して始める
  ?stage=0〜3   猫の段階を指定して始める（確認用。第12節）
*/
const OOKAMI = (() => {
  const P = ['heya', 'hiroba', 'kyokai', 'bochi', 'yakata', 'mori', 'kawa', 'mon'];
  const NAME = { heya: '部屋', hiroba: '広場', kyokai: '教会', bochi: '墓地', yakata: '館', mori: '森', kawa: '川辺', mon: '門' };
  const ADJ = { heya: ['hiroba'], hiroba: ['heya', 'kyokai', 'mon'], kyokai: ['hiroba', 'bochi'], bochi: ['kyokai', 'yakata'], yakata: ['bochi', 'mori'], mori: ['yakata', 'kawa'], kawa: ['mori', 'mon'], mon: ['kawa', 'hiroba'] };
  // 時刻表。添字は T（1〜20）。
  const WOLF = [null, 'mori', 'heya', 'hiroba', 'kyokai', 'bochi', 'yakata', 'yakata', 'mori', 'kawa', 'mon', 'hiroba', 'heya', 'hiroba', 'mon', 'kawa', 'mori', 'yakata', 'bochi', 'kyokai', 'hiroba'];
  const CAT = [null, null, 'hiroba', 'mon', 'kawa', 'kawa', 'mori', 'mori', 'kyokai', 'kyokai', 'bochi', 'bochi', 'kyokai', 'kawa', 'mori', 'yakata', 'yakata', 'mori', 'kawa', 'mon', 'mon'];
  const VAMP = [null, 'yakata', 'yakata', 'yakata', 'yakata', 'yakata', 'bochi', 'kyokai', 'hiroba', 'mon', 'kawa', 'mori', 'yakata', 'yakata', 'yakata', 'yakata', 'yakata', 'bochi', 'kyokai', 'hiroba', 'yakata'];
  const JTIME = T => { const K = ['二十時', '二十時半', '二十一時', '二十一時半', '二十二時', '二十二時半', '二十三時', '二十三時半']; return K[T - 1] || TIME(T); };
  const TIME = T => { const m = 20 * 60 + (T - 1) * 30, h = Math.floor(m / 60) % 24; return `${h}:${String(m % 60).padStart(2, '0')}`; };
  const tid = (pos, T) => `${pos}-${String(T).padStart(2, '0')}`;
  const adj = (a, b) => !!a && !!b && ADJ[a].includes(b);
  // 対話の正解（館で名を呼んだあと）。各問いの選択肢の添字
  const TALK_OK = [1, 2, 0];
  const HINT_3JI = '三時、猫は館へ戻る'; // 前の夜にこれを聞いた人だけが、23:30 に本当のことを言える

  // 見たもの。文（id）を読むと、黙って記録される。題名の画面の「見たもの」で並ぶ
  const SEEN = [
    ['candle', '獣脂の蝋燭', '芯が二度結んである。宿の主人の癖だろう', ['heya-03']],
    ['bag', '前の客の鞄', '留め金に、北の三文字。真ん中が削れている', ['heya-03', 'heya-07']],
    ['seven', '寝台の脚の「七」', '数なのか、名なのか、分からない', ['heya-04']],
    ['well', '井戸の縁の文字', '「水は下へ、匂いは上へ」', ['hiroba-04', 'hiroba-05']],
    ['bottles', '酔った男の瓶', '数が、合わない', ['hiroba-04']],
    ['shoes', '小さな濡れた靴', '戸の前に、揃えてある', ['hiroba-18']],
    ['notice', '教会の貼り紙', '「狼の夜、鐘を鳴らすな」', ['kyokai-03']],
    ['oria', '聖オリアの絵', '片方の手が、描かれていない', ['kyokai-11']],
    ['rope', '鐘楼の綱', '握る部分だけが、黒く光っている', ['kyokai-06']],
    ['pew', '四列目の長椅子', '端が、背の高い者の形に、減っている', ['kyokai-05', 'kyokai-06']],
    ['stone', '魔術師の墓石の裏', '三文字と、日付と、「眠れ」', ['cat-bochi-mage', 'cat-bochi-him', 'bochi-12', 'bochi-19']],
    ['flower', '墓の花', '一時間でしおれる。朝には、青い', ['bochi-07']],
    ['lords', '領主の家の三つの石', '今年の名は、二文字目で止まっている', ['bochi-04']],
    ['portrait', '広間の絵', '病んだ男が、笑っている。足元に、白い猫', ['yakata-hall', 'yakata-11']],
    ['cookbook', '料理の本', '羊の脚の頁。この村に、羊はいない', ['yakata-09', 'yakata-14', 'cat-bochi-book']],
    ['diary', '魔術師の日記', '最後の頁に、署名', ['yakata-study']],
    ['marks', '松の刃物の跡', '七本。八本目は、浅い', ['mori-05']],
    ['lime', '森の下の石灰の道', '倒れた松の根元から、門の外へ', ['mori-13', 'mori-18']],
    ['cloth', '水車の白い布', '誰かの袖だ。乾いている', ['kawa-06', 'kawa-07']],
    ['level', '水車小屋の水位線', '十二年前。七年前。今年は、まだ', ['kawa-08']],
    ['claw', '閂の爪跡', '七筋。夜のうちに、八筋になる', ['mon-05', 'mon-06']],
    ['stud', '鋲の穴', '八十四のうち、一つ', ['mon-04']],
    ['names', '見張り台の紙の裏', '「開けた者の名」。六つ。七つ目は、空いている', ['mon-08', 'mon-17']],
    ['cat', '白い猫', '片方の耳の先が、欠けている', ['cat-hiroba-02', 'cat-cold-hiroba']],
    ['corpse', '白いもの', '奥の墓石の前。花の横に。もう、動かない', ['cat-corpse']],
    ['girl', '白の少女', '裸足だ。耳の先が、欠けている', ['cat-kyokai-09', 'cat-kyokai-09-again', 'girl-first', 'girl-apology', 'girl-apology-again']],
    ['man', '長身の男', '黒い服。帽子はない。古い言い方をする', ['vamp-hiroba-8', 'vamp-home', 'vamp-meet-bochi', 'vamp-meet-kyokai', 'vamp-meet-mon', 'vamp-meet-kawa', 'vamp-meet-mori']],
    ['wolf', '狼', '大きい。思っていたより、ずっと', ['death-wolf-heya', 'death-wolf-hiroba', 'death-wolf-kyokai', 'death-wolf-bochi', 'death-wolf-yakata', 'death-wolf-mori', 'death-wolf-kawa', 'death-wolf-mon', 'end-5']],
  ];
  const SEEN_BY_ID = {}; SEEN.forEach(([key, , , ids]) => ids.forEach(id => { (SEEN_BY_ID[id] = SEEN_BY_ID[id] || []).push(key); }));
  function see(S, id) { const ks = SEEN_BY_ID[id]; if (!ks) return; S.seen = S.seen || []; ks.forEach(k => { if (!S.seen.includes(k)) S.seen.push(k); }); }

  let TEXT = {};
  const used = new Set(), missing = new Set();
  function setText(t) { TEXT = t; }
  function tx(id) {
    used.add(id);
    const e = TEXT[id];
    if (!e) { missing.add(id); return { t: [`【${id}】`], c: null, h: null }; }
    const o = typeof e === 'string' ? { t: e } : e;
    return { t: String(o.t).trim().split(/\n\s*\n/), l: o.l ? String(o.l).trim().split(/\n\s*\n/) : null, c: o.c || null, h: o.h || null };
  }
  function ch(id, n) { const c = tx(id).c; return (c && c[n]) || `【${id} ${n}】`; }

  // 周回をまたいで残るもの
  function newPersist() { return { marks: {}, hints: [], ends: [], runs: 0, deaths: 0, girlNights: 0, apologies: 0, deathKinds: [], seen: [], catStage: 0, lure: 0, catNamed: false, tales: 0 }; }
  function mark(S, T, pos, kind) {
    if (!pos || T < 1 || T > 20) return;
    const k = `${T}:${pos}`; const m = (S.marks[k] = S.marks[k] || []);
    if (!m.includes(kind)) m.push(kind);
  }
  function addHint(S, h) { if (h && !S.hints.includes(h)) S.hints.push(h); }
  // 夜をまたぐ猫の段階（第12節）。夜の終わりに一段だけ動く
  const stage = g => g.S.catStage || 0;
  function settleNight(g) {
    // 夜の結果を預ける。次の夜を始めるときに一段動く（しおりから戻れば動かない）
    // 彼への負の好感度（第14節b）：関わった夜は +1。関わらなかった夜、狩らせた夜、眠らせた夜は −1
    const cooled = g.vamp.state === 'dead' || (g.vamp.state === 'asleep' && g.ending !== 2);
    g.S.pending = { hurt: g.cat.hurt > 0, lure: cooled ? -1 : (g.flags.lureUp ? 1 : -1) };
  }
  function applyPending(S) {
    const p = S.pending; if (!p) return; S.pending = null;
    S.catStage = p.hurt ? Math.max(0, (S.catStage || 0) - 1) : Math.min(3, (S.catStage || 0) + 1);
    S.lure = Math.max(0, Math.min(3, (S.lure || 0) + (p.lure || 0)));
  }
  const lure = g => g.S.lure || 0;
  const touched = g => { g.flags.lureUp = true; };  // 彼と関わった
  const knowsCat = g => !!(g.flags.named || g.S.catNamed);  // 少女の名を知っている

  function newRun(S) {
    return {
      S, T: 1, pos: 'heya', prev: null, stays: 0, trust: 0, path: [[1, 'heya']],
      flags: { spared: false, alliance: false, knowName: false, nameFrom: '', knowHim: false, told15: false, named: false, lureUp: false, metGirl: false, sawDrunk: false, did: {} },
      vamp: { state: 'sched', chase: null, lieAt: null, angry: false },
      // state: free（時刻表どおり）/ follow（ついてくる。far は離れてついてくる）/ bound（契約）/ taken（彼に喰われた）/ gone（追い払われて去った）
      // form: 段階3の 0:00 から 2:30 までは少女の姿で隣を歩く。safe: 3:00 に彼が館にいなかった。spent: 3:00 の館で力を使い切った
      cat: { state: 'free', form: 'cat', safe: false, spent: false, takenT: 0, far: false, shoo: 0, meet: 0, hurt: 0, doom: false },
      alive: true, ending: 0, lines: [], labels: [], quiet: false,
    };
  }
  function vampPos(g, T) {
    const v = g.vamp;
    if (v.state === 'dead') return null;
    if (v.state === 'asleep') return 'yakata';
    if (v.chase) return v.chase.pos;
    if (v.lieAt && (T === 13 || T === 14)) return v.lieAt;
    return VAMP[T];
  }
  function catPos(g, T) {
    const c = g.cat;
    if (c.state === 'taken') return null;
    if (c.state === 'bound' || c.state === 'follow') return g.pos;
    if (c.state === 'gone' || c.state === 'hide') return null;
    return CAT[T];
  }

  // ---- 場面の組み立て ----
  // 戻り値 view = { kind:'scene'|'death'|'end', paras:[{t, cls}], choices:[{label, go}], id }
  const para = (t, cls) => ({ t, cls: cls || '' });
  function pushText(g, out, id) {
    (out.tids = out.tids || []).push(id);
    const e = tx(id); e.t.forEach(t => out.paras.push(para(t))); if (e.h) { addHint(g.S, e.h); } see(g.S, id);
    return e;
  }
  // 初めて踏んだマスは長い文（l）、二度目からは短い文（t）。両方を view に持ち、画面側で切り替えられる
  function pushLong(g, out, id, first) {
    (out.tids = out.tids || []).push(id);
    const e = tx(id);
    if (e.h) addHint(g.S, e.h); see(g.S, id);
    if (e.l) { out.alt = { long: e.l.map(t => para(t)), short: e.t.map(t => para(t)), at: out.paras.length }; (first ? e.l : e.t).forEach(t => out.paras.push(para(t))); out.showLong = first; }
    else e.t.forEach(t => out.paras.push(para(t)));
  }
  function die(g, id) {
    const out = { kind: 'death', paras: [], choices: [], id };
    g.alive = false; g.S.deaths++; settleNight(g);
    g.S.deathKinds = g.S.deathKinds || []; if (!g.S.deathKinds.includes(id)) g.S.deathKinds.push(id);
    mark(g.S, g.T, g.pos, 'x');
    if (/^death-(wolf|stay|catnear|follownear|shooed|futon|mado|ido|haka|kane)/.test(id)) { out.who = 'wolf'; out.mood = 'attack'; }
    else if (id === 'death-home' || id === 'death-name-bochi') { out.who = 'girl'; out.mood = 'sad'; }
    else if (/^death-(intruder|hide|ritual|hunt|chase|angry|talk|refuse|useless|told)/.test(id)) { out.who = 'man'; out.mood = /told|refuse/.test(id) ? 'talk' : 'angry'; touched(g); }
    if (g.lead && g.lead.length) { out.paras.push(...g.lead); g.lead = null; }  // 着いた瞬間の知らせ（猫が去った、など）は死の文の前に残す
    (out.tids = out.tids || []).push(id);
    const e = tx(id); e.t.forEach(t => out.paras.push(para(t))); see(g.S, id);
    if (e.h) { const h = e.h.replace('{時刻}', TIME(g.T)); addHint(g.S, h); out.paras.push(para('――' + h, 'hint')); }
    return out;
  }
  function ending(g, n) {
    const out = { kind: 'end', paras: [], choices: [], id: `end-${n}`, n };
    g.alive = false; g.ending = n; settleNight(g);
    if (!g.S.ends.includes(n)) g.S.ends.push(n);
    let id = `end-${n}`;
    if (n === 3) id = g.cat.state === 'taken' ? 'end-3-taken' : (g.cat.safe ? 'end-3-free' : 'end-3');
    out.id = id; pushText(g, out, id);
    out.who = n === 5 ? 'wolf' : (n === 1 ? 'girl' : (n === 2 ? 'sleep' : ''));
    out.mood = n === 1 ? 'smile' : '';
    return out;
  }

  function arrive(g) {
    const T = g.T, pos = g.pos;
    const out = { kind: 'scene', paras: [], choices: [], id: tid(pos, T) };
    g.who = '';
    const first = !((g.S.marks[`${T}:${pos}`] || []).includes('me')); g.first = first;
    mark(g.S, T, pos, 'me');
    // 掟
    if (g.stays >= 2 && !(pos === 'yakata' && g.vamp.state === 'asleep')) return die(g, `death-stay-${pos}`);
    if (WOLF[T] === pos) {
      if (pos === 'yakata' && g.vamp.state === 'asleep') return ending(g, 5);
      mark(g.S, T, pos, 'wolf'); return die(g, `death-wolf-${pos}`);
    }
    const withCat = g.cat.state === 'bound' || (g.cat.state === 'follow' && !g.cat.far);
    if (withCat && adj(WOLF[T], pos)) { mark(g.S, T, WOLF[T], 'wolf'); return die(g, pos === 'heya' && T === 20 ? 'death-home' : (g.cat.state === 'bound' ? 'death-catnear' : 'death-follownear')); }
    if (g.cat.doom) { mark(g.S, T, pos, 'wolf'); return die(g, 'death-shooed'); }  // 猫が引いていた狼は、猫がいなくなれば君に来る
    tickCat(g, T);
    if (g.cat.state === 'hide' && vampPos(g, T) !== pos) { g.cat.state = 'follow'; g.lines.push(g.cat.form === 'girl' ? 'girl-return' : 'cat-return'); }
    if (g.cat.state === 'follow') { mark(g.S, T, pos, 'cat'); g.cat.meet++; g.flags.lastCat = { T, pos }; }
    // 前のコマで起きたことの知らせ
    for (const l of g.lines) pushText(g, out, l); g.lines = [];
    g.lead = out.paras.slice();
    const r = arriveScene(g, T, pos, out); g.lead = null; return r;
  }
  function arriveScene(g, T, pos, out) {
    const first = g.first;
    const vp = vampPos(g, T);
    if (vp === pos && g.vamp.state !== 'dead') { mark(g.S, T, pos, 'vamp'); out.who = g.who = g.vamp.state === 'asleep' ? 'sleep' : 'man'; return vampScene(g, T, pos, out); }
    const cp = catPos(g, T);
    if (cp === pos && g.cat.state === 'free') { mark(g.S, T, pos, 'cat'); return catScene(g, T, pos, out); }
    if (g.cat.state === 'follow' && !g.cat.far) { const ev = followEvent(g, T, pos, out); if (ev) return ev; }
    if (pos === 'yakata' && T >= 8 && T <= 11) return studyScene(g, T, out);
    let id = tid(pos, T);
    const alt = VARIANT[id]; if (alt) id = alt(g) || id;
    out.id = id;
    pushLong(g, out, id, first);
    if (id === 'hiroba-04') g.flags.sawDrunk = true;
    if (g.cat.state === 'bound') {
      if (id === 'heya-19-cat') out.who = g.who = 'girl';
      else if (g.cat.spent) { out.who = g.who = T === 16 ? 'girl' : 'cat'; pushText(g, out, `flee-${T}`); }  // 3:00 の館で力を使い切った少女を連れて（第14節e の C）
      else { out.who = g.who = 'cat'; pushText(g, out, T >= 20 ? 'with-cat-3' : (T >= 18 ? 'with-cat-2' : 'with-cat-1')); }
    }
    else if (g.cat.state === 'follow') return walkScene(g, T, pos, out);
    return finishScene(g, out);
  }
  function finishScene(g, out) {
    const T = g.T, pos = g.pos;
    if (out.who === undefined) out.who = g.who || '';
    const withCat = g.cat.state === 'bound' || (g.cat.state === 'follow' && !g.cat.far);
    if (adj(WOLF[T], pos) && !withCat && !out.noNear) { out.paras.push(para(tx('near').t[0], 'near')); mark(g.S, T, pos, 'near'); }
    out.choices = moveChoices(g);
    if (g.cat.state === 'follow' && g.alive) {
      // ついてくる猫は、次に狼の来る場所のほうを見て鳴く。離れてついてくるときは何も教えない
      if (!g.cat.far && T < 20) out.paras.push(para(tx(g.cat.form === 'girl' ? 'girl-warn' : 'cat-warn').t[0].replace('{場所}', NAME[WOLF[T + 1]]), 'near'));
      out.choices.push({ label: ch('cat-shoo', 0), go: () => shoo(g) });
    }
    return out;
  }
  function tickCat(g, T) {
    const c = g.cat;
    if (c.state !== 'free' || (T !== 15 && T !== 16)) return;
    const vp = vampPos(g, T), awakeThere = vp === 'yakata' && g.vamp.state === 'sched';
    if (awakeThere) { if (g.pos !== 'yakata') { c.state = 'taken'; c.takenT = T; } }
    else if (T === 15) c.safe = true;
  }

  // 旗で変わる、何も起きないマスの文
  const light = g => g.cat.state === 'taken' && g.cat.takenT === 15;
  const VARIANT = {
    'hiroba-05': g => g.flags.sawDrunk ? 'hiroba-05-drunk' : null,
    'hiroba-09': g => g.flags.sawDrunk ? 'hiroba-09-drunk' : null,
    'bochi-13': g => g.vamp.lieAt === 'kyokai' && g.vamp.state === 'sched' ? 'bochi-13-wait' : null,
    'heya-15': g => light(g) ? 'heya-15-light' : null,
    'kyokai-15': g => light(g) ? 'kyokai-15-light' : null,
    'bochi-15': g => light(g) ? 'bochi-15-light' : null,
    'mori-15': g => light(g) ? 'mori-15-light' : null,
    'mon-15': g => light(g) ? 'mon-15-light' : null,
    'heya-19': g => g.cat.state === 'bound' ? 'heya-19-cat' : null,
    'bochi-17': g => g.cat.state === 'taken' ? 'cat-corpse' : null,
    'bochi-19': g => g.cat.state === 'taken' ? 'cat-corpse' : null,
    'bochi-20': g => g.cat.state === 'taken' ? 'cat-corpse' : null,
  };
  // 移動の選択肢と、余計なこと
  const EXTRA = { hiroba: 'ido', kyokai: 'kane', bochi: 'haka', kawa: 'kawa', mon: 'soto' };
  function moveChoices(g) {
    const T = g.T, pos = g.pos, list = [];
    if (T === 1) {
      list.push({ label: ch('heya-01', 0), go: () => die(g, 'death-futon-heya') });
      list.push({ label: ch('heya-01', 1), go: () => die(g, 'death-mado-heya') });
      list.push({ label: ch('heya-01', 2), move: 'hiroba', go: () => move(g, 'hiroba') });
      return list;
    }
    for (const n of ADJ[pos]) list.push({ label: `${NAME[n]}へ`, move: n, go: () => move(g, n) });
    list.push({ label: '留まる', move: pos, go: () => move(g, pos) });
    if (EXTRA[pos] && g.alive) { const id = `death-${EXTRA[pos]}-${pos}`; list.push({ label: ch(`extra-${pos}`, 0), go: () => extraDeath(g, id) }); }
    return list;
  }
  function extraDeath(g, id) {
    // 余計なことは、その場で死ぬ。狼の位置は分からないので印は × だけ
    return die(g, id);
  }
  function move(g, next) {
    const stayed = next === g.pos;
    g.stays = stayed ? g.stays + 1 : 0;
    g.prev = g.pos; g.pos = next; g.T++;
    if (g.T > 20) return ending(g, g.cat.state === 'bound' ? 1 : 3);
    g.path.push([g.T, next]);
    const v = g.vamp;
    if (v.chase && v.state === 'sched') {
      const c = v.chase; c.pos = g.prev; c.n++;
      mark(g.S, g.T, c.pos, 'vamp');
      if (WOLF[g.T] === c.pos) { v.state = 'dead'; v.diedT = g.T; v.chase = null; g.lines.push('vamp-hunted'); }
      else if (!c.forever && c.n > 5) { v.chase = null; g.lines.push('vamp-gaveup'); }
    }
    if (v.lieAt && v.state === 'sched' && g.T === 14 && WOLF[14] === v.lieAt) { v.state = 'dead'; v.diedT = 14; g.lines.push('vamp-hunted-far'); }
    if (v.lieAt && v.state === 'sched' && g.T === 15) { v.angry = true; }
    if (v.state === 'asleep' && g.T === 17 && g.pos !== 'yakata') { v.state = 'dead'; v.diedT = 17; g.lines.push('vamp-taken-far'); }
    const c = g.cat;
    if ((c.state === 'follow' || c.state === 'hide') && g.T === 15) { c.state = 'free'; c.far = false; c.ran = true; g.lines.push(c.form === 'girl' ? 'girl-leave-15' : 'cat-leave-15'); c.form = 'cat'; }
    else if (c.state === 'follow' && vampPos(g, g.T) === g.pos && v.state !== 'dead') { c.state = 'hide'; g.lines.push(c.form === 'girl' ? 'girl-hide' : 'cat-hide'); }  // 彼の前には出ない
    return arrive(g);
  }

  // ---- 吸血鬼 ----
  function vampScene(g, T, pos, out) {
    const v = g.vamp, f = g.flags;
    if (v.chase && v.chase.pos === pos) return die(g, 'death-chase');
    if (v.state === 'asleep') return asleepScene(g, T, out);
    out.mood = T === 8 && pos === 'hiroba' ? 'talk' : (v.angry ? 'angry' : '');
    if (pos === 'yakata') {
      if (T === 15 && g.cat.state === 'free') return climaxScene(g, out);
      if (T >= 15) {
        if (g.cat.state === 'taken') return lateScene(g, pos, out);
        if (T === 15 || T === 16) return die(g, 'death-ritual-yakata');  // 猫がいない 3:00。彼は君だけを見る
        if (v.angry) return die(g, 'death-angry');
        if (!f.spared) return die(g, 'death-hunt-yakata');
        pushText(g, out, 'vamp-pass-yakata');
        out.choices.push({ label: ch('vamp-pass', 0), go: () => finishScene(g, { kind: 'scene', paras: [], choices: [], id: out.id }) });
        out.choices.push({ label: ch('vamp-pass', 1), go: () => provoke(g) });
        return out;
      }
      if (f.alliance) { pushText(g, out, `yakata-${T}-ally`); return finishScene(g, out); }  // T12〜T14
      // 在宅。名を知っていれば対話。黙って下がれば生きる
      pushText(g, out, 'vamp-home');
      if (f.knowName) out.choices.push({ label: ch('vamp-home', 0), go: () => talkScene(g, 0) });
      out.choices.push({ label: ch('vamp-home', 1), go: () => after(g, 'vamp-home-leave') });
      if (lure(g) >= 1) out.choices.push({ label: ch('vamp-home', 4), go: () => taleScene(g, 'yakata') });  // 機嫌がいい。昔の話を聞かせる
      out.choices.push({ label: ch('vamp-home', 2), go: () => die(g, 'death-intruder-yakata') });
      out.choices.push({ label: ch('vamp-home', 3), go: () => die(g, 'death-hide-yakata') });
      return out;
    }
    if (v.lieAt && (T === 13 || T === 14) && pos === v.lieAt) { pushText(g, out, 'vamp-wait'); return finishScene(g, out); }
    if (T === 8 && pos === 'hiroba') return squareScene(g, out);
    if (v.angry) return die(g, 'death-angry');
    const late = T >= 17;
    if (late && g.cat.state === 'taken') return lateScene(g, pos, out);
    if (!f.spared) return T <= 7 ? meetScene(g, pos, out) : die(g, `death-hunt-${pos}`);  // 真夜中を過ぎた彼に、礼儀はない
    pushText(g, out, `vamp-pass-${pos}`);
    out.choices.push({ label: ch('vamp-pass', 0), go: () => finishScene(g, { kind: 'scene', paras: [], choices: [], id: out.id }) });
    out.choices.push({ label: ch('vamp-pass', 1), go: () => provoke(g) });
    return out;
  }
  function meetScene(g, pos, out) {
    // 23:30 より前、または黙っていなかった夜の出会い。去れば生きる
    pushText(g, out, `vamp-meet-${pos}`);
    out.choices.push({ label: ch('vamp-meet', 0), go: () => after(g, 'vamp-meet-leave') });
    out.choices.push({ label: ch('vamp-meet', 1), go: () => die(g, `death-hunt-${pos}`) });
    return out;
  }
  function provoke(g) {
    const out = { kind: 'scene', paras: [], choices: [], id: 'vamp-provoke' };
    g.vamp.chase = { pos: g.pos, n: 0, forever: false }; touched(g);
    pushText(g, out, 'vamp-provoke');
    out.noNear = false;
    return finishScene(g, out);
  }
  function squareScene(g, out) {
    pushText(g, out, 'vamp-hiroba-8');
    const f = g.flags, v = g.vamp;
    const tellChoices = o => {
      if (g.S.hints.includes(HINT_3JI)) {
        pushText(g, o, 'vamp-hiroba-8-know');
        o.choices.push({ label: ch('vamp-hiroba-8-tell', 0), go: () => { f.spared = true; f.alliance = true; touched(g); return after(g, 'vamp-hiroba-8-truth'); } });
      }
      if (f.lastCat) o.choices.push({ label: `${JTIME(f.lastCat.T)}に${NAME[f.lastCat.pos]}で見た、と言う`, go: () => { f.spared = true; touched(g); return after(g, 'vamp-hiroba-8-honest'); } });
      [['mon', 1], ['kyokai', 2], ['kawa', 3]].forEach(([p, i]) => o.choices.push({ label: ch('vamp-hiroba-8-tell', i), go: () => { f.spared = true; v.lieAt = p; touched(g); return after(g, 'vamp-hiroba-8-lie'); } }));
      o.choices.push({ label: ch('vamp-hiroba-8-tell', 4), go: () => die(g, 'death-useless-hiroba') });
    };
    if (g.S.runs >= 2) {
      // 二夜目から、彼は黙ることを許さない
      pushText(g, out, 'vamp-hiroba-8-again');
      tellChoices(out);
      out.choices.push({ label: ch('vamp-hiroba-8', 2), go: () => provoke(g) });
      return out;
    }
    out.choices.push({ label: ch('vamp-hiroba-8', 0), go: () => { f.spared = true; return after(g, 'vamp-hiroba-8-silent'); } });
    out.choices.push({ label: ch('vamp-hiroba-8', 1), go: () => {
      const o2 = { kind: 'scene', paras: [], choices: [], id: 'vamp-hiroba-8-tell' };
      pushText(g, o2, 'vamp-hiroba-8-tell');
      tellChoices(o2);
      return o2;
    } });
    out.choices.push({ label: ch('vamp-hiroba-8', 2), go: () => provoke(g) });
    return out;
  }
  function after(g, id) { const o = { kind: 'scene', paras: [], choices: [], id, who: g.who || '' }; pushText(g, o, id); return finishScene(g, o); }
  function talkScene(g, q) {
    const id = `vamp-talk-${q + 1}`;
    const out = { kind: 'scene', paras: [], choices: [], id, mood: 'talk' };
    if (q === 0) { touched(g); pushText(g, out, g.flags.nameFrom === 'diary' ? 'vamp-talk-1-diary' : 'vamp-talk-1-grave'); }
    pushText(g, out, id);
    for (let i = 0; i < 3; i++) {
      out.choices.push({ label: ch(id, i), go: () => {
        if (i !== TALK_OK[q]) return die(g, 'death-talk-yakata');
        if (q < 2) return talkScene(g, q + 1);
        g.vamp.state = 'asleep'; g.vamp.chase = null;
        return after(g, 'vamp-sleeps');
      } });
    }
    return out;
  }
  function asleepScene(g, T, out) {
    // 眠る彼のいる館。猫が来る時刻なら猫の場面へ
    if (catPos(g, T) === 'yakata' && g.cat.state === 'free') { mark(g.S, T, 'yakata', 'cat'); return catScene(g, T, 'yakata', out); }
    pushLong(g, out, `yakata-asleep-${T}`, g.first);
    return finishScene(g, out);
  }
  // 猫を喰ったあとの彼。機嫌がいい。昔の話を聞かせ、聞き終えた者を殺す（第14節b）
  function lateScene(g, pos, out) {
    pushText(g, out, `vamp-late-${pos}`);
    const r = finishScene(g, out);
    r.choices.push({ label: ch('vamp-late', 0), go: () => taleScene(g, pos) });
    return r;
  }
  // 語り。四つの話を順に。二箱のあとで「知りすぎたな」
  function taleScene(g, pos) {
    touched(g);
    const n = (g.S.tales || 0) % 4 + 1; if (!g.quiet) g.S.tales = (g.S.tales || 0) + 1;
    const o = { kind: 'scene', paras: [], choices: [], id: `tale-${n}`, who: 'man', mood: 'talk' };
    pushText(g, o, `tale-${n}`); pushText(g, o, 'tale-more');
    o.choices.push({ label: ch('tale-more', 0), go: () => { const o2 = { kind: 'scene', paras: [], choices: [], id: `tale-${n}b`, who: 'man', mood: 'talk' }; pushText(g, o2, `tale-${n}b`); o2.choices.push({ label: ch('tale-end', 0), go: () => die(g, 'death-told') }); return o2; } });
    o.choices.push({ label: ch('tale-more', 1), go: () => die(g, 'death-told-early') });
    return o;
  }
  // 3:00 の館。彼が猫を喰いかけている。名を知る者だけに選択肢がある（第14節c）
  function climaxScene(g, out) {
    touched(g);
    const f = g.flags, c = g.cat;
    if (!knowsCat(g)) return die(g, 'death-ritual-yakata');
    out.who = g.who = 'man'; out.id = 'climax-1';
    pushText(g, out, 'climax-1');
    if (f.alliance) pushText(g, out, 'climax-1-ally');
    const gray = lure(g) >= 3;
    if (gray) pushText(g, out, 'climax-gray');
    out.choices.push({ label: ch('climax-1', 0), disabled: gray, go: () => gray ? out : climaxCall(g) });
    out.choices.push({ label: ch('climax-1', 1), go: () => climaxWatch(g) });
    if (f.alliance || gray) out.choices.push({ label: ch('climax-1', 2), go: () => climaxOffer(g, 1) });
    return out;
  }
  function climaxCall(g) {
    const o = { kind: 'scene', paras: [], choices: [], id: 'climax-call', who: 'girl', mood: 'close' };
    pushText(g, o, 'climax-call');
    for (let i = 0; i < 2; i++) o.choices.push({ label: ch('climax-call', i), go: () => {
      const o2 = { kind: 'scene', paras: [], choices: [], id: 'climax-burst', who: 'girl', mood: 'power' };
      pushText(g, o2, `climax-call-${i}`); pushText(g, o2, 'climax-burst');
      o2.choices.push({ label: ch('climax-burst', 0), go: () => {
        const c = g.cat; c.state = 'bound'; c.spent = true; c.form = 'girl'; c.far = false;
        g.vamp.chase = { pos: null, n: 0, forever: true };  // 吹き飛ばされた彼は、朝まで君を追う
        const o3 = after(g, g.S.ends.includes(1) ? 'climax-after-again' : 'climax-after'); o3.who = 'girl'; o3.mood = 'smile'; o3.noNear = true; return o3;
      } });
      return o2;
    } });
    return o;
  }
  function climaxWatch(g) {
    const o = { kind: 'scene', paras: [], choices: [], id: 'climax-watch', who: 'man', mood: 'angry' };
    pushText(g, o, 'climax-watch');
    o.choices.push({ label: ch('climax-watch', 0), go: () => { g.cat.state = 'taken'; g.cat.takenT = 15; return die(g, 'death-ritual-watch'); } });
    return o;
  }
  // 彼の申し出（結末②）。名で縛り、彼女の力で彼を眠らせ、夜に残る。断れば死ぬ
  function climaxOffer(g, n) {
    const id = `climax-offer-${n}`, o = { kind: 'scene', paras: [], choices: [], id, who: n === 2 ? 'girl' : 'man', mood: n === 2 ? 'sad' : 'talk' };
    pushText(g, o, id);
    o.choices.push({ label: ch(id, 0), go: () => n < 3 ? climaxOffer(g, n + 1) : (g.cat.state = 'bound', g.vamp.state = 'asleep', ending(g, 2)) });
    o.choices.push({ label: ch(id, 1), go: () => die(g, 'death-refuse-yakata') });
    return o;
  }

  // ---- 白猫 ----
  function gain(g, key, n) { if (g.flags.did[key]) return; g.flags.did[key] = true; g.trust += n; }
  // 少女の姿で会う場面の前置き。初めてなら正体に気づく一節（0:00 の謝罪は本文がそれを担う）
  function meetGirl(g, out, apology) {
    const f = g.flags; out.who = g.who = 'girl';
    if (f.metGirl) return;
    f.metGirl = true;
    const before = g.S.girlNights || 0; if (!g.quiet) g.S.girlNights = before + 1;
    if (!apology) {
      pushText(g, out, 'girl-first');
      if (before >= 4) pushText(g, out, 'girl-many'); else if (before >= 1) pushText(g, out, 'girl-again');
    }
  }
  function catScene(g, T, pos, out) {
    const f = g.flags, d = f.did, st = stage(g);
    f.lastCat = { T, pos };
    out.who = g.who = 'cat';
    if (st === 0) return coldScene(g, T, pos, out);
    if (st >= 2) return attach(g, T, pos, out);
    // 段階1：逃げない。黙ってそばにいる（初版の場面）
    const pick = (id, opts, base) => {
      pushText(g, out, id);
      opts.forEach((o, i) => out.choices.push({ label: ch(id, i), go: () => { if (o.key) gain(g, o.key, o.n); if (o.hurt) g.cat.hurt++; else g.cat.meet++; if (o.set) o.set(); return after(g, `${base || id}-${i}`); } }));
      return out;
    };
    if (pos === 'hiroba' && T === 2) return pick('cat-hiroba-02', [{ key: 'hiroba', n: 0, hurt: true }, { key: 'hiroba', n: 1 }, { key: 'hiroba', n: 1 }]);
    if (pos === 'kawa' && (T === 4 || T === 5)) {
      if (T === 5 && d.kawa && g.prev === 'kawa') { gain(g, 'kawaStay', 1); g.cat.meet++; pushText(g, out, 'cat-kawa-05-stay'); return finishScene(g, out); }
      return pick(T === 4 ? 'cat-kawa-04' : 'cat-kawa-05', [{ key: 'kawa', n: -1, hurt: true }, { key: 'kawa', n: 1 }, { key: 'kawa', n: 0 }]);
    }
    if (pos === 'mori' && (T === 6 || T === 7)) {
      if (d.mori) { g.cat.meet++; pushText(g, out, 'cat-mori-07-stay'); return finishScene(g, out); }
      return pick(`cat-mori-0${T}`, [{ key: 'mori', n: 1 }, { key: 'mori', n: 0 }]);
    }
    g.cat.meet++;
    if (pos === 'kyokai' && T === 9) { pushText(g, out, 'cat-kyokai-09-roof'); return finishScene(g, out); }
    if (pos === 'bochi' && (T === 10 || T === 11)) {
      // 少女が一度だけ出る。「来ないで」
      meetGirl(g, out, false);
      const id = d.bochiSeen ? 'cat-bochi-cold-again' : 'cat-bochi-cold'; d.bochiSeen = true;
      pushText(g, out, id);
      if (id === 'cat-bochi-cold') for (let i = 0; i < 3; i++) out.choices.push({ label: ch('cat-bochi-cold', i), go: () => after(g, `cat-bochi-cold-${i}`) });
      else return finishScene(g, out);
      return out;
    }
    if (pos === 'yakata' && (T === 15 || T === 16)) return yakataScene(g, T, out);
    pushText(g, out, presenceId(g, T, pos));
    return finishScene(g, out);
  }
  // その時刻・場所に猫がいる、という文の id
  function presenceId(g, T, pos) {
    if (pos === 'kyokai' && T === 9) return 'cat-kyokai-09-roof';
    if (pos === 'bochi' && (T === 10 || T === 11)) return 'cat-bochi-cold';
    if ((pos === 'kyokai' && T === 12) || (pos === 'kawa' && T === 13) || (pos === 'mori' && T === 14)) return `cat-again-${pos}`;
    if (pos === 'yakata' && (T === 15 || T === 16)) return yakataId(g, T);
    if (pos === 'mori' && T === 7) return 'cat-mori-06';
    return `cat-${tid(pos, T)}`;
  }
  // 段階0：猫は君を見ると去る
  function coldScene(g, T, pos, out) {
    // 同じ場所に続けていて、前のコマも猫がいたなら、二度目は一文だけ
    if (g.prev === pos && CAT[T - 1] === pos) { pushText(g, out, 'cat-cold-again'); return finishScene(g, out); }
    pushText(g, out, `cat-cold-${pos}`);
    if (pos === 'yakata' && g.vamp.state === 'asleep') pushText(g, out, 'cat-cold-yakata-asleep');  // 眠る彼を、猫は長く見る
    if (adj(WOLF[T], pos)) { pushText(g, out, 'cat-cold-near'); out.noNear = true; }
    const go = i => () => { if (i === 0) g.cat.meet++; if (i === 2) g.cat.hurt++; return after(g, `cat-cold-${i}`); };
    for (let i = 0; i < 3; i++) out.choices.push({ label: ch('cat-cold', i), go: go(i) });
    return out;
  }
  // 段階2以上：猫は君から離れなくなる
  function attach(g, T, pos, out) {
    const st = stage(g), c = g.cat;
    if (st >= 3 && pos === 'yakata' && (T === 15 || T === 16)) return yakataScene(g, T, out);
    if (st >= 3 && T >= 17 && T <= 19 && c.safe) return offerScene(g, T, pos, out, `cat-wait-${pos}`);
    const id = presenceId(g, T, pos);
    if (T === 20) { pushText(g, out, id); return finishScene(g, out); }
    if (T === 2) { pushText(g, out, id); pushText(g, out, 'cat-lead-02'); c.meet++; return finishScene(g, out); }  // 20:30 の広場からは逃げ場がないので、猫は先に門へ行く
    const girl = /^cat-bochi-cold$|^cat-yakata-/.test(id);
    if (girl) meetGirl(g, out, false);
    pushText(g, out, id);
    c.state = 'follow'; c.far = false; c.meet++;
    pushText(g, out, girl ? 'girl-follow-start' : 'cat-follow-start');
    out.who = g.who = 'cat';
    mark(g.S, T, pos, 'cat');
    return followEvent(g, T, pos, out) || finishScene(g, out);
  }
  // ついてくる猫と起きること。段階3だけ少女になる。該当がなければ null
  function followEvent(g, T, pos, out) {
    const f = g.flags, d = f.did;
    if (stage(g) < 3) return null;
    if (T === 9 && !d.apology) { d.apology = true; return apologyScene(g, pos, out); }
    if (pos === 'bochi' && T >= 10 && T <= 14) return bochiScene(g, T, out);
    if (T === 14 && !f.told15) return tellScene(g, out);
    return null;
  }
  function apologyScene(g, pos, out) {
    meetGirl(g, out, true);
    const n = g.S.apologies || 0; if (!g.quiet) g.S.apologies = n + 1;
    const church = pos === 'kyokai';
    const id = church ? (n >= 1 ? 'cat-kyokai-09-again' : 'cat-kyokai-09') : (n >= 1 ? 'girl-apology-again' : 'girl-apology');
    out.mood = 'sad';
    pushText(g, out, id);
    g.cat.form = 'girl';  // ここから 2:30 まで、少女の姿で隣を歩く
    const then = i => { const id2 = `${church ? 'cat-kyokai-09b' : 'girl-apology-b'}-${i}`, o = { kind: 'scene', paras: [], choices: [], id: id2, who: 'girl' }; pushText(g, o, id2); if (g.S.ends.includes(1) && !g.flags.did.remember) { g.flags.did.remember = true; pushText(g, o, 'girl-remember'); } return finishScene(g, o); };
    [1, 0].forEach((pt, i) => out.choices.push({ label: ch(id, i), go: () => { gain(g, 'kyokai9', pt); return chain(g, [`cat-kyokai-09-${i}`], church ? 'cat-kyokai-09b' : 'girl-apology-b', 3, then); } }));
    return out;
  }
  function bochiScene(g, T, out) {
    const f = g.flags, d = f.did;
    meetGirl(g, out, false);
    const id = d.bochiSeen ? 'cat-bochi-again' : `cat-bochi-${String(Math.min(T, 11)).padStart(2, '0')}`; d.bochiSeen = true;
    pushText(g, out, id);
    const q = [['her', () => gain(g, 'bochi', 1)], ['mage', () => { f.knowName = true; f.nameFrom = f.nameFrom || 'grave'; }], ['him', () => { f.knowName = true; f.nameFrom = f.nameFrom || 'grave'; f.knowHim = true; }], ['book', () => {}]];
    q.forEach(([k, fn], i) => { if (d['ask_' + k]) return; if (k === 'book' && !d.ask_mage) return; out.choices.push({ label: ch('cat-bochi-q', i), go: () => { d['ask_' + k] = true; fn(); return after(g, `cat-bochi-${k}`); } }); });
    if (f.knowName && f.nameFrom === 'diary' && !d.ask_mage) out.choices.push({ label: ch('cat-bochi-q', 5), go: () => die(g, 'death-name-bochi') });
    out.choices.push({ label: ch('cat-bochi-q', 4), go: () => after(g, 'cat-bochi-leave') });
    return out;
  }
  function tellScene(g, out) {
    const f = g.flags;
    meetGirl(g, out, false);
    f.told15 = true;
    pushText(g, out, 'cat-tell');
    // 結果の文のあと、信頼があれば少女は名を告げる。名は文に出ない
    const end = ids => { const o = { kind: 'scene', paras: [], choices: [], id: ids[ids.length - 1], who: 'girl', mood: 'close' }; ids.forEach(id => pushText(g, o, id)); if (g.trust >= 3) { f.named = true; g.S.catNamed = true; pushText(g, o, g.S.ends.includes(1) ? 'cat-tell-name-again' : 'cat-tell-name'); } return finishScene(g, o); };
    out.choices.push({ label: ch('cat-tell', 0), go: () => { gain(g, 'tell', 1); return chain(g, ['cat-tell-0'], 'cat-tell-fear', 3, i => end([`cat-tell-fear-${i}`])); } });
    out.choices.push({ label: ch('cat-tell', 1), go: () => end(['cat-tell-1']) });
    out.choices.push({ label: ch('cat-tell', 2), go: () => end(['cat-tell-2']) });
    return out;
  }
  function shoo(g) {
    const c = g.cat; c.hurt++; c.shoo++;
    if (c.shoo === 1) { c.far = true; return after(g, 'cat-shoo-1'); }
    c.state = 'gone'; c.doom = true;
    return after(g, 'cat-shoo-2');
  }
  // 結果の文のあとに、もう一往復の問いを置く
  function chain(g, textIds, qid, n, then) {
    const o = { kind: 'scene', paras: [], choices: [], id: qid, who: g.who || '' };
    textIds.forEach(id => pushText(g, o, id));
    pushText(g, o, qid);
    for (let i = 0; i < n; i++) o.choices.push({ label: ch(qid, i), go: () => then ? then(i) : after(g, `${qid}-${i}`) });
    return o;
  }
  // 3:00 の館の少女の文。猫が走って行ったあとに君が追いついた夜は、その版
  const yakataId = (g, T) => `cat-yakata-${T}${g.vamp.state === 'asleep' ? '-asleep' : ''}${T === 15 && g.cat.ran ? '-follow' : ''}`;
  function yakataScene(g, T, out) {
    return offerScene(g, T, 'yakata', out, yakataId(g, T));
  }
  // ついてくる少女／猫と、何も起きないマス（第14節e）。少女の姿なら場所ごとの一言と答え方
  function walkScene(g, T, pos, out) {
    const c = g.cat, d = g.flags.did, stayed = g.prev === pos;
    if (c.form !== 'girl') {
      out.who = g.who = 'cat';
      pushText(g, out, c.far ? 'cat-follow-far' : (stayed ? 'cat-stay-lap' : 'cat-follow'));
      return finishScene(g, out);
    }
    out.who = g.who = 'girl';
    if (c.far) { pushText(g, out, 'girl-follow-far'); return finishScene(g, out); }
    if (stayed) { pushText(g, out, TEXT[`girl-stay-${pos}`] ? `girl-stay-${pos}` : 'girl-stay'); return finishScene(g, out); }
    const id = `girl-walk-${pos}`, firstHere = !d['walk_' + pos] && !!TEXT[id];
    pushText(g, out, firstHere ? id : 'girl-walk-again'); d['walk_' + pos] = true;
    if (lure(g) >= 2 && !d.smell) { d.smell = true; pushText(g, out, 'girl-smell'); }
    const r = finishScene(g, out);
    if (firstHere) { const q = tx(id).c || []; q.forEach((lab, i) => r.choices.push({ label: lab, go: () => { const o = after(g, `${id}-${i}`); o.who = 'girl'; return o; } })); }
    return r;
  }
  function offerScene(g, T, pos, out, id) {
    if (id) pushText(g, out, id);
    if (g.flags.declined) return finishScene(g, out);
    if (stage(g) < 3 || g.trust < 3) { pushText(g, out, 'cat-offer-none'); return finishScene(g, out); }
    if (!g.flags.did.asked) {
      g.flags.did.asked = true;
      pushText(g, out, 'cat-ask');
      for (let i = 0; i < 3; i++) out.choices.push({ label: ch('cat-ask', i), go: () => { const o = { kind: 'scene', paras: [], choices: [], id: `cat-ask-${i}`, who: g.who || '', mood: 'close' }; pushText(g, o, `cat-ask-${i}`); return offerScene(g, T, pos, o, null); } });
      return out;
    }
    pushText(g, out, 'cat-offer');
    out.choices.push({ label: ch('cat-offer', 0), go: () => {
      g.cat.state = 'bound';
      if (g.vamp.state === 'sched') g.vamp.chase = { pos: null, n: 0, forever: true };
      const o = after(g, g.S.ends.includes(1) ? 'contract-again' : `contract-${pos}`); o.mood = 'smile'; return o;
    } });
    out.choices.push({ label: ch('cat-offer', 1), go: () => { g.flags.declined = true; return after(g, `cat-offer-no-${pos}`); } });
    return out;
  }

  // ---- 館の探索（空き家） ----
  function studyScene(g, T, out) {
    pushLong(g, out, tid('yakata', T), g.first);
    const f = g.flags;
    if (!f.did.study) out.choices.push({ label: ch('yakata-empty', 0), go: () => { f.did.study = true; f.knowName = true; f.nameFrom = f.nameFrom || 'diary'; return after(g, 'yakata-study'); } });
    if (!f.did.hall) out.choices.push({ label: ch('yakata-empty', 1), go: () => { f.did.hall = true; return after(g, 'yakata-hall'); } });
    out.choices.push({ label: ch('yakata-empty', 2), go: () => finishScene(g, { kind: 'scene', paras: [], choices: [], id: out.id }) });
    return out;
  }

  // ---- 自動で歩く道筋（確認用） ----
  const R = {
    1: ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '猫のことを', '門に来る', '教会へ', '何も責めない', '何も聞かない', '墓地へ', '彼女自身', '留まる', '吸血鬼のこと', '館へ', '黙って下がる', '森へ', '留まる', '一緒に', '怖い', '館へ', '覚えている', '契約する', '墓地へ', '教会へ', '広場へ', '門へ', '川辺へ', '門へ'],
    2: ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '猫のことを', '三時に館', '門へ', '黙って去る', '川辺へ', '黙って去る', '留まる', '門へ', '川辺へ', '森へ', '黙って聞く', '館へ', '申し出を聞く', '名を呼ぶ', '眠らせる', '夜に残る'],
    3: ['階段', '捕まえ', '門へ', '捕まえ', '川辺へ', '捕まえ', '門へ', '川辺へ', '門へ', '川辺へ', '森へ', '留まる', '川辺へ', '門へ', '川辺へ', '捕まえ', '森へ', '捕まえ', '留まる', '川辺へ', '門へ', '川辺へ', '門へ', '川辺へ', '門へ'],
    4: ['布団'],
    5: ['階段', '動かずに', '門へ', '動かずに', '留まる', '川辺へ', '動かずに', '留まる', '門へ', '川辺へ', '森へ', '留まる', '館へ', '書斎', '留まる', '名を呼ぶ', 'ans1', 'ans2', 'ans3', '留まる', '留まる', '留まる', '動かずに', '留まる', '留まる'],
    6: ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '門へ', '黙って去る', '川辺へ', '黙って去る', '森へ', '挑発', '川辺へ', '門へ', '川辺へ'],
  };

  // その道筋に入る前に、前の夜から持ち越しているもの（ヒント、猫の段階）
  const PRE = { 1: S => { S.catStage = 3; }, 2: S => { S.catStage = 3; S.catNamed = true; addHint(S, HINT_3JI); } };
  function play(g, view, labels) {
    // labels の各要素を含む選択肢を順に選ぶ。ans1.. は対話の正解
    for (const l of labels) {
      if (!view || view.kind !== 'scene') return view;
      let c;
      const m = /^ans(\d)$/.exec(l);
      if (m) c = view.choices[TALK_OK[+m[1] - 1]];
      else c = view.choices.find(x => x.label.includes(l));
      if (c && c.disabled) { view.err = `灰色の選択肢: ${l} @T${g.T} ${g.pos}`; return view; }
      if (!c) { view.err = `選択肢がない: ${l} @T${g.T} ${g.pos} [${view.choices.map(x => x.label).join('/')}]`; return view; }
      g.labels.push(c.label); view = c.go();
    }
    return view;
  }
  function start(S) { applyPending(S); const g = newRun(S); S.runs++; return { g, view: arrive(g) }; }
  // 選択肢を選ぶ。選んだ文字を覚えておく（しおりのため）
  function choose(g, view, i) { const c = view && view.choices[i]; if (!c || c.disabled) return view; g.labels.push(c.label); return c.go(); }
  // しおり。一夜に一度だけ挟める。死んだあと、同じ選択で黙って進み直して、その場面に戻る
  const canShiori = g => !!g && g.alive && !(g.S.shiori && g.S.shiori.night === g.S.runs);
  const hasShiori = S => !!(S.shiori && S.shiori.night === S.runs);
  function placeShiori(g) {
    if (!canShiori(g)) return false;
    g.S.shiori = { night: g.S.runs, labels: g.labels.slice(), T: g.T, pos: g.pos }; return true;
  }
  function resume(S) {
    const sh = S.shiori; if (!hasShiori(S)) return null;
    S.pending = null;
    const g = newRun(S); g.quiet = true; let view = arrive(g);
    for (const l of sh.labels) {
      if (view.kind !== 'scene') break;
      const c = view.choices.find(x => x.label === l); if (!c) break;
      g.labels.push(l); view = c.go();
    }
    g.quiet = false;
    return { g, view };
  }
  // ---- 自己テスト ----
  function selfTest() {
    const out = [];
    const check = (name, fn) => { let r; try { r = fn(); } catch (e) { r = '例外 ' + e.message + ' ' + (e.stack || '').split('\n')[1]; } out.push({ ok: r === true, text: (r === true ? 'o ' : 'x ') + name + (r === true ? '' : ' … ' + r) }); };
    check('時刻表：狼は基本の時刻表で猫・吸血鬼と同じマスに来ない', () => {
      const bad = []; for (let T = 1; T <= 20; T++) { if (WOLF[T] === CAT[T]) bad.push(`T${T} 猫`); if (WOLF[T] === VAMP[T]) bad.push(`T${T} 吸血鬼`); }
      return bad.length === 0 || bad.join(', ');
    });
    check('時刻表：猫と吸血鬼が同じマスになるのは T15・T16 の館だけ', () => {
      const bad = []; for (let T = 1; T <= 20; T++) if (CAT[T] && CAT[T] === VAMP[T] && !(T >= 15 && T <= 16 && CAT[T] === 'yakata')) bad.push(`T${T}`);
      return bad.length === 0 || bad.join(', ');
    });
    check('隣接は対称', () => { for (const a of P) for (const b of ADJ[a]) if (!ADJ[b].includes(a)) return `${a}-${b}`; return true; });
    check('どのコマ・どのマスからも、次に狼のいないマスへ動ける', () => {
      const bad = [];
      for (let T = 1; T < 20; T++) for (const p of P) { if (WOLF[T] === p) continue; if (!ADJ[p].concat([p]).some(n => WOLF[T + 1] !== n)) bad.push(`T${T} ${p}`); }
      return bad.length === 0 || bad.join(', ');
    });
    check('契約後（狼の隣も死ぬ）でも、T15 の館からの道が朝まで一本はある', () => {
      let cells = new Set(['yakata']);
      for (let T = 16; T <= 20; T++) { const nx = new Set(); for (const p of cells) for (const n of ADJ[p].concat([p])) if (WOLF[T] !== n && !adj(WOLF[T], n)) nx.add(n); cells = nx; if (!cells.size) return `T${T} で詰む`; }
      return true;
    });
    check('猫を連れて（狼の隣も死ぬ）、21:00 の門から 3:00 の館まで届く道がある', () => {
      let cells = new Set(['mon']);
      for (let T = 4; T <= 15; T++) { const nx = new Set(); for (const p of cells) for (const n of ADJ[p].concat([p])) if (WOLF[T] !== n && !adj(WOLF[T], n)) nx.add(n); cells = nx; if (!cells.size) return `T${T} で詰む`; }
      return cells.has('yakata') || `T15 に館へ入れない: ${[...cells].join(',')}`;
    });
    const run = n => { const S = newPersist(); if (PRE[n]) PRE[n](S); const { g, view } = start(S); const v = play(g, view, R[n]); return { g, v, S }; };
    const go = (S, labels) => { const r = start(S); return { g: r.g, v: play(r.g, r.view, labels), S }; };
    const stage3 = () => { const S = newPersist(); S.catStage = 3; return S; };
    const has = (v, re) => v.paras.some(p => re.test(p.t));
    const COLD = ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '門へ', '川辺へ', '門へ', '広場へ'];  // 段階0で 23:30 の広場へ
    check('①：契約して朝を迎える（段階3）', () => { const { g, v } = run(1); return (v.kind === 'end' && g.ending === 1 && g.cat.state === 'bound' && g.vamp.state === 'dead') || `${v.kind} ${v.id} ${v.err || ''} 猫=${g.cat.state} 彼=${g.vamp.state} 信頼=${g.trust} T${g.T}`; });
    check('②：同盟して夜に残る', () => { const { g, v } = run(2); return (v.kind === 'end' && g.ending === 2 && v.id === 'end-2') || `${v.kind} ${v.id} ${v.err || ''}`; });
    check('③：何もせず朝を迎える（猫は取り込まれている）', () => { const { g, v } = run(3); return (v.kind === 'end' && g.ending === 3 && g.cat.state === 'taken' && v.id === 'end-3-taken') || `${v.kind} ${v.id} ${v.err || ''} 猫=${g.cat.state}`; });
    check('④：布団にもぐって死ぬ', () => { const { g, v } = run(4); return (v.kind === 'death' && v.id === 'death-futon-heya') || `${v.kind} ${v.id}`; });
    check('⑤：彼を眠らせ、館に留まり、狼に見送られる', () => { const { g, v } = run(5); return (v.kind === 'end' && g.ending === 5 && g.T === 17) || `${v.kind} ${v.id} ${v.err || ''} T${g.T}`; });
    check('追跡：挑発して狼に当てると、彼は狩られる', () => { const { g, v } = run(6); return (g.vamp.state === 'dead' && g.vamp.diedT === 14 && v.kind === 'scene') || `${v.kind} ${v.id} ${v.err || ''} 彼=${g.vamp.state} T${g.T}`; });
    check('嘘（教会）：彼は生き残り、3時に戻って猫を取り込み、以後は会えば死ぬ', () => {
      const { g, v } = go(newPersist(), COLD.concat(['猫のことを', '教会に来る', '教会へ', '動かずに', '墓地へ', '動かずに', '教会へ', '留まる', '動かずに', '墓地へ', '教会へ', '墓地へ', '教会へ', '墓地へ']));
      return (v.kind === 'death' && v.id === 'death-angry' && g.T === 17 && g.cat.state === 'taken' && g.vamp.state === 'sched') || `${v.kind} ${v.id} ${v.err || ''} T${g.T} 彼=${g.vamp.state} 猫=${g.cat.state}`;
    });
    check('掟：2度続けて留まると死ぬ', () => {
      const { v } = go(newPersist(), ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '留まる', '留まる']);
      return (v.kind === 'death' && v.id === 'death-stay-kawa') || `${v.kind} ${v.id} ${v.err || ''}`;
    });
    check('掟：契約後に狼の隣へ行くと死ぬ', () => {
      const { v } = go(stage3(), R[1].slice(0, R[1].indexOf('契約する') + 2).concat(['留まる']));
      return (v.kind === 'death' && v.id === 'death-catnear') || `${v.kind} ${v.id} ${v.err || ''}`;
    });
    check('館：名を知らずに入ると死ぬ', () => {
      const { g, v } = go(newPersist(), ['階段', '動かずに', '教会へ', '墓地へ', '館へ', '名乗る']);
      return (v.kind === 'death' && v.id === 'death-intruder-yakata' && g.T === 5) || `${v.kind} ${v.id} ${v.err || ''}`;
    });
    check('館：名を知らなくても、黙って下がれば生きる', () => {
      const { g, v } = go(newPersist(), ['階段', '動かずに', '教会へ', '墓地へ', '館へ', '黙って下がる']);
      return (v.kind === 'scene' && g.T === 5 && g.alive && v.choices.some(c => c.move)) || `${v.kind} ${v.id} ${v.err || ''}`;
    });
    check('彼：23:30 より前に会っても、黙って去れば生きる。声をかけると死ぬ', () => {
      const { g, v: v1 } = go(newPersist(), ['階段', '動かずに', '教会へ', '広場へ', '教会へ', '墓地へ', '黙って去る']);
      if (!(v1.kind === 'scene' && g.T === 6 && g.alive)) return `去る: ${v1.kind} ${v1.id} ${v1.err || ''} T${g.T}`;
      const v = play(g, v1, ['教会へ', '声をかける']);
      return (v.kind === 'death' && v.id === 'death-hunt-kyokai' && g.T === 7) || `声: ${v.kind} ${v.id} ${v.err || ''}`;
    });
    check('23:30：二夜目から、彼は黙ることを許さない', () => {
      const S = newPersist(); go(S, ['階段', '留まる']);
      const { v } = go(S, COLD);
      const lab = v.choices.map(c => c.label);
      return (!lab.includes('黙っている') && lab.includes('二十一時半に川辺で見た、と言う') && lab.includes('挑発する') && (v.tids || []).includes('vamp-hiroba-8-again')) || `${lab.join('/')} ${v.err || ''}`;
    });
    check('23:30：三時の話は、前の夜に猫から聞いた人だけが言える', () => {
      const a = go(newPersist(), COLD.concat(['猫のことを'])).v; const S2 = newPersist(); addHint(S2, HINT_3JI); const b = go(S2, COLD.concat(['猫のことを'])).v;
      const hasIt = v => v.choices.some(c => c.label.includes('三時'));
      return (!hasIt(a) && hasIt(b) && has(b, /前の夜/)) || `なし=${hasIt(a)} あり=${hasIt(b)} ${a.err || b.err || ''}`;
    });
    check('少女：0:00 の謝罪を通らずに会うと、正体に気づく一節が先に出る。通っていれば出ない', () => {
      const a = go(stage3(), ['階段', '教会へ', '墓地へ', '教会へ', '墓地へ', '黙って去る', '教会へ', '黙って去る', '墓地へ', '館へ', '何もしない', '墓地へ']);
      const b = go(stage3(), R[1].slice(0, R[1].indexOf('墓地へ') + 1));
      return (has(a.v, /思ってから/) && !has(b.v, /思ってから/) && a.g.T === 10 && b.g.T === 10 && a.g.cat.state === 'follow') || `初=${has(a.v, /思ってから/)} 既=${has(b.v, /思ってから/)} ${a.v.err || ''} ${b.v.err || ''} T${a.g.T}/${b.g.T}`;
    });
    check('酔った男：21:30 の広場を見た夜だけ、あとの広場の文が変わる', () => {
      const { g, v: v1 } = go(newPersist(), ['階段', '動かずに', '門へ', '動かずに', '広場へ', '留まる']);
      if (v1.id !== 'hiroba-05-drunk') return `T5: ${v1.id} ${v1.err || ''}`;
      const v = play(g, v1, ['門へ', '広場へ', '門へ', '広場へ']);
      if (v.id !== 'hiroba-09-drunk') return `T9: ${v.id} ${v.err || ''}`;
      const v2 = go(newPersist(), ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '門へ', '広場へ', '門へ', '広場へ', '黙っている', '留まる']).v;
      return v2.id === 'hiroba-09' || `見ていない: ${v2.id} ${v2.err || ''}`;
    });
    check('部屋と広場の往復は 5:00 まで安全で、5:30 に詰む（意図した性質）', () => {
      const S = newPersist(); const { g, view } = start(S);
      let v = play(g, view, ['階段', '動かずに']);
      for (let T = 3; T <= 20 && v.kind === 'scene'; T++) { if (g.T === 8 && g.pos === 'hiroba' && v.choices.some(c => c.label === '黙っている')) v = play(g, v, ['黙っている']); v = play(g, v, [g.pos === 'heya' ? '広場へ' : '部屋へ']); }
      return (v.kind === 'death' && v.id === 'death-wolf-hiroba' && g.T === 20) || `${v.kind} ${v.id} ${v.err || ''} T${g.T}`;
    });
    check('周回の記憶：二夜目以降に少女に会うと、彼女がそれに触れる', () => {
      const toBochi = ['階段', '教会へ', '墓地へ', '教会へ', '墓地へ', '黙って去る', '教会へ', '黙って去る', '墓地へ', '館へ', '何もしない', '墓地へ'];
      const S = stage3(); const a = go(S, toBochi).v; const b = go(S, toBochi).v;
      const S5 = stage3(); S5.girlNights = 4; const c = go(S5, toBochi).v;
      if (has(a, /前にも/) || !has(b, /前にも/) || !has(c, /何度も/)) return `初=${has(a, /前にも/)} 二=${has(b, /前にも/)} 多=${has(c, /何度も/)} ${a.err || b.err || c.err || ''}`;
      const toChurch = R[1].slice(0, R[1].indexOf('教会へ') + 1);
      const S2 = stage3(); const d = go(S2, toChurch).v; const e = go(S2, toChurch.filter(l => l !== '猫のことを')).v;  // 二夜目は「猫のことを」の段がない
      if (has(d, /前にも言った/) || !has(e, /前にも言った/)) return `謝罪 初=${has(d, /前にも言った/)} 二=${has(e, /前にも言った/)} ${d.err || e.err || ''}`;
      const S3 = stage3(); S3.ends.push(1); const f = go(S3, R[1].slice(0, R[1].indexOf('契約する') + 1)).v;
      return f.id === 'contract-again' || `契約 ${f.id} ${f.err || ''}`;
    });
    check('連れ帰り：契約した少女と 5:00 に部屋へ戻り、留まると専用の死', () => {
      const { g, v: v1 } = go(stage3(), R[1].slice(0, R[1].indexOf('契約する') + 4).concat(['部屋へ']));
      if (v1.id !== 'heya-19-cat' || g.T !== 19) return `19: ${v1.kind} ${v1.id} ${v1.err || ''} T${g.T}`;
      const v = play(g, v1, ['留まる']);
      return (v.kind === 'death' && v.id === 'death-home') || `20: ${v.kind} ${v.id}`;
    });
    check('初見は長い文、再訪は短い文。切り替えもできる', () => {
      const S = newPersist(); let v = go(S, ['階段', '動かずに', '部屋へ']).v;
      if (!(v.id === 'heya-03' && v.alt && v.showLong)) return `初 ${v.id} alt=${!!v.alt} long=${v.showLong} ${v.err || ''}`;
      const n1 = v.paras.length; toggleLong(v); const n2 = v.paras.length; toggleLong(v);
      if (!(n2 < n1 && v.paras.length === n1)) return `切替 ${n1} ${n2}`;
      v = go(S, ['階段', '動かずに', '部屋へ']).v;
      return (v.id === 'heya-03' && v.alt && !v.showLong) || `再 ${v.id} long=${v.showLong}`;
    });
    check('少女：追加の問い（名前、何者、怖いか、覚えているか、料理の本）が全部通る', () => {
      const g3 = labels => go(stage3(), labels);
      const church = R[1].slice(0, R[1].indexOf('何も責めない') + 1);
      let r = g3(church.concat(['名前を聞く'])); if (r.v.id !== 'cat-kyokai-09b-0') return `名前 ${r.v.id} ${r.v.err || ''}`;
      r = g3(church.concat(['何者'])); if (r.v.id !== 'cat-kyokai-09b-1') return `何者 ${r.v.id}`;
      const tell = R[1].slice(0, R[1].indexOf('墓地へ') + 1).concat(['魔術師', '留まる', '料理の本']);
      r = g3(tell); if (r.v.id !== 'cat-bochi-book') return `本 ${r.v.id} ${r.v.err || ''}`;
      const toTell = R[1].slice(0, R[1].indexOf('一緒に') + 1);
      r = g3(toTell.concat(['怖くない'])); if (r.v.id !== 'cat-tell-fear-1') return `怖くない ${r.v.id} ${r.v.err || ''}`;
      r = g3(toTell.concat(['答えない'])); if (r.v.id !== 'cat-tell-fear-2') return `答えない ${r.v.id}`;
      const toAsk = R[1].slice(0, R[1].indexOf('覚えている'));
      r = g3(toAsk.concat(['忘れる', '契約する'])); return (r.v.id === 'contract-yakata' && r.g.cat.state === 'bound') || `忘れる ${r.v.id} ${r.v.err || ''}`;
    });
    check('見たもの：対象の文の id が全部あり、①の道筋で記録される', () => {
      const bad = SEEN.flatMap(([, , , ids]) => ids).filter(id => !TEXT[id]);
      if (bad.length) return `id がない: ${bad.join(' ')}`;
      const { S } = run(1);
      return (S.seen.includes('cat') && S.seen.includes('girl') && S.seen.includes('stone') && S.seen.length >= 8) || `記録 ${S.seen.join(',')}`;
    });
    check('彼：真夜中を過ぎると、黙っていなかった夜は会った瞬間に死ぬ', () => {
      const { g, v } = go(newPersist(), ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '門へ', '川辺へ', '留まる', '門へ', '留まる']);
      return (v.kind === 'death' && v.id === 'death-hunt-mon' && g.T === 9) || `${v.kind} ${v.id} ${v.err || ''} T${g.T}`;
    });
    check('23:30：今夜猫を見ていれば、その時刻と場所を正直に言える。「分からない」は死ぬ', () => {
      const { g, v: v1 } = go(newPersist(), COLD.concat(['猫のことを']));
      const lab = v1.choices.map(c => c.label);
      if (!lab.includes('二十一時半に川辺で見た、と言う')) return `正直の選択肢がない: ${lab.join('/')} ${v1.err || ''}`;
      const v = play(g, v1, ['二十一時半に川辺で見た']);
      if (!(v.kind === 'scene' && g.flags.spared && g.S.hints.some(h => /匂いの濃い/.test(h)))) return `正直: ${v.kind} ${v.id}`;
      const d = go(newPersist(), COLD.concat(['猫のことを', '分からない'])).v;
      return (d.kind === 'death' && d.id === 'death-useless-hiroba') || `分からない: ${d.kind} ${d.id} ${d.err || ''}`;
    });
    check('場面の絵のために、各 view が出した文の id（tids）を持つ', () => {
      const { g, v } = go(stage3(), R[1].slice(0, R[1].indexOf('教会へ') + 1));
      const ok1 = v.id === 'kyokai-09' && (v.tids || []).includes('cat-kyokai-09');
      const d = play(g, v, ['何も責めない', '何も聞かない', '墓地へ', 'もう行く', '館へ', '何もしない', '留まる', '名乗る']);
      return (ok1 && d.kind === 'death' && (d.tids || []).includes('death-intruder-yakata')) || `${v.id} ${JSON.stringify(v.tids)} / ${d.kind} ${d.id} ${d.err || ''} ${JSON.stringify(d.tids)}`;
    });
    check('館：23:30〜1:00 は空き家で、書斎から名が分かる', () => {
      const { g, v } = go(newPersist(), ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '森へ', '川辺へ', '森へ', '動かずに', '館へ', '書斎']);
      return (v.kind === 'scene' && g.T === 8 && g.flags.knowName && g.flags.nameFrom === 'diary') || `${v.kind} ${v.id} ${v.err || ''} T${g.T}`;
    });
    check('猫（段階1）：川辺で留まり、森で2コマ一緒にいると、信頼が3になる', () => {
      const S = newPersist(); S.catStage = 1;
      const { g, v } = go(S, ['階段', '少し離れて見', '門へ', '川辺へ', '声をかける', '留まる', '森へ', '黙ってそばにいる', '留まる']);
      return (v.kind === 'scene' && v.id === 'mori-07' && g.trust === 3 && g.T === 7) || `${v.kind} ${v.id} ${v.err || ''} 信頼=${g.trust}`;
    });
    check('おぼえがき：死んだマスに × と狼の印が残る', () => {
      const S = newPersist(); go(S, ['階段', '動かずに', '留まる']);
      const m = S.marks['3:hiroba'] || [];
      return (m.includes('x') && m.includes('wolf') && S.deaths === 1) || m.join(',');
    });
    // ---- 第五版：猫 ----
    check('猫（段階0）：一夜目の猫は去る。少女は出ない。夜ごとに段階が上がり、傷つけた夜は上がらない', () => {
      const S = newPersist(); const { g, v } = go(S, ['階段', '動かずに', '門へ', '動かずに', '川辺へ', '動かずに', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', '動かずに', '墓地へ']);
      if (!(v.kind === 'scene' && v.id === 'bochi-10' && (v.tids || []).includes('cat-cold-bochi') && !g.flags.metGirl)) return `${v.kind} ${v.id} ${v.err || ''} ${JSON.stringify(v.tids)}`;
      play(g, v, ['捕まえ', '留まる']); start(S);  // 傷つけた夜は上がらない（段階は次の夜の初めに動く）
      if (S.catStage !== 0 || g.cat.hurt !== 1) return `傷 段階=${S.catStage} hurt=${g.cat.hurt}`;
      const S2 = newPersist(); const r2 = go(S2, ['階段', '近づく', '留まる']); start(S2);
      if (!(r2.v.kind === 'death' && S2.catStage === 1)) return `上がる 段階=${S2.catStage} ${r2.v.id}`;
      go(S2, ['布団']); go(S2, ['布団']); go(S2, ['布団']); start(S2);
      return S2.catStage === 3 || `上限 段階=${S2.catStage}`;
    });
    check('猫（段階1）：そばにいる。墓地の少女は「来ないで」。名を求めない', () => {
      const S = newPersist(); S.catStage = 1;
      const { g, v } = go(S, ['階段', '少し離れて見', '門へ', '川辺へ', '少し離れて座る', '留まる', '門へ', '留まる', '広場へ', '黙っている', '教会へ', '墓地へ']);
      if (!(v.id === 'bochi-10' && (v.tids || []).includes('cat-bochi-cold') && g.flags.metGirl && v.choices.some(c => c.label === 'なぜ、と聞く'))) return `${v.kind} ${v.id} ${v.err || ''} ${JSON.stringify(v.tids)}`;
      const S1 = newPersist(); S1.catStage = 1;
      const r = go(S1, ['階段', '少し離れて見', '門へ', '川辺へ', '少し離れて座る', '門へ', '川辺へ', '門へ', '広場へ', '猫のことを', '門に来る', '教会へ', '墓地へ', '去る', '教会へ', '墓地へ', '教会へ', '墓地へ', '館へ', '留まる']);
      return (r.v.id === 'yakata-16' && (r.v.tids || []).includes('cat-offer-none') && r.g.cat.safe && r.g.vamp.state === 'dead') || `${r.v.kind} ${r.v.id} ${r.v.err || ''} 生=${r.g.cat.safe} ${JSON.stringify(r.v.tids)}`;
    });
    check('猫（段階2）：ついてくる。狼の来る場所を鳴いて知らせ、隣に行けば死ぬ。3:00 に館へ戻り、取り込まれれば墓地に亡骸', () => {
      const S = newPersist(); S.catStage = 2;
      const { g, v } = go(S, ['階段', '門へ']);
      if (!(g.cat.state === 'follow' && v.id === 'mon-03' && has(v, /教会のほうを見て/) && v.choices.some(c => c.label === '猫を追い払う'))) return `付く ${v.id} 猫=${g.cat.state} ${v.err || ''} ${v.paras.map(p => p.t).join('|').slice(0, 80)}`;
      const d = play(g, v, ['広場へ']);
      if (!(d.kind === 'death' && d.id === 'death-follownear')) return `隣 ${d.kind} ${d.id}`;
      const S2 = newPersist(); S2.catStage = 2;
      const r = go(S2, ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', '墓地へ', '留まる', '教会へ', '墓地へ', '教会へ', '墓地へ', '教会へ', '墓地へ', '教会へ', '墓地へ']);
      return (r.v.id === 'cat-corpse' && r.g.T === 19 && r.g.cat.state === 'taken' && S2.hints.includes(HINT_3JI) && !r.g.flags.metGirl) || `亡骸 ${r.v.kind} ${r.v.id} ${r.v.err || ''} T${r.g.T} 猫=${r.g.cat.state} 三時=${S2.hints.includes(HINT_3JI)}`;
    });
    check('猫（段階2）：彼の前では隠れ、去ると戻る', () => {
      const S = newPersist(); S.catStage = 2;
      const { g, v } = go(S, ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ']);
      if (!(g.cat.state === 'hide' && (v.tids || []).includes('cat-hide') && (v.tids || []).includes('vamp-hiroba-8'))) return `隠れる 猫=${g.cat.state} ${v.id} ${v.err || ''}`;
      const v2 = play(g, v, ['黙っている', '教会へ']);
      return (g.cat.state === 'follow' && (v2.tids || []).includes('cat-return')) || `戻る 猫=${g.cat.state} ${v2.id} ${v2.err || ''}`;
    });
    check('猫（段階2）：二度追い払うと、次のコマで狼が来る。追い払った夜は段階が下がる', () => {
      const S = newPersist(); S.catStage = 2;
      const { g, v } = go(S, ['階段', '門へ', '猫を追い払う']);
      if (!(g.cat.far && v.id === 'cat-shoo-1' && !has(v, /のほうを見て/))) return `一度 ${v.id} far=${g.cat.far}`;
      const v2 = play(g, v, ['川辺へ']);
      if (!(v2.kind === 'scene' && (v2.tids || []).includes('cat-follow-far'))) return `離れて ${v2.kind} ${v2.id} ${JSON.stringify(v2.tids)}`;
      const d = play(g, v2, ['猫を追い払う', '門へ']); start(S);
      return (d.kind === 'death' && d.id === 'death-shooed' && S.catStage === 1) || `${d.kind} ${d.id} 段階=${S.catStage}`;
    });
    check('猫（段階3）：鐘で少女になり謝る（教会でなくても）。墓地で日記の名を口にすると死ぬ', () => {
      const a = go(stage3(), ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '部屋へ']);
      if (!(a.v.id === 'heya-09' && (a.v.tids || []).includes('girl-apology') && a.v.choices.some(c => c.label === '何も責めない'))) return `謝罪 ${a.v.id} ${a.v.err || ''} ${JSON.stringify(a.v.tids)}`;
      const b = play(a.g, a.v, ['何も責めない', '何も聞かない']);
      if (b.id !== 'girl-apology-b-2' || a.g.trust !== 1) return `問い ${b.id} 信頼=${a.g.trust}`;
      const b0 = go(stage3(), ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '部屋へ', '何も責めない', '名前を聞く']).v; const b1 = go(stage3(), ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '部屋へ', '何も責めない', '何者']).v;
      if (b0.id !== 'girl-apology-b-0' || b1.id !== 'girl-apology-b-1') return `問い ${b0.id} ${b1.id}`;
      const c = go(stage3(), ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', '何も責めない', '何も聞かない', '墓地へ', 'もう行く', '館へ', '書斎', '留まる', '黙って下がる', '墓地へ', '主人の名を']);
      return (c.v.kind === 'death' && c.v.id === 'death-name-bochi') || `名 ${c.v.kind} ${c.v.id} ${c.v.err || ''} T${c.g.T}`;
    });
    // ---- 第六版：名 ----
    const TO15 = ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', '何も責めない', '何も聞かない', '墓地へ', '彼女自身', '留まる', '吸血鬼のこと', '館へ', '黙って下がる', '森へ', '留まる', '一緒に', '怖い', '館へ'];
    const TO15_COLD = ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', 'なぜ私', '何も聞かない', '墓地へ', 'もう行く', '留まる', 'もう行く', '館へ', '黙って下がる', '森へ', '留まる', '黙って聞く', '館へ'];  // 信頼が足りない夜  // 段階3、一夜目。2:30 に名を告げられ、3:00 の館で彼と猫に会う
    check('名：2:30 に少女が名を告げる（信頼3以上）。名を知って 3:00 の館に入ると山場。名を呼ぶと契約①、朝まで追われて逃げ切る', () => {
      const { g, v } = go(stage3(), TO15);
      if (!(g.flags.named && g.S.catNamed && v.id === 'climax-1' && v.choices.map(c => c.label).join('/') === '名を呼ぶ/見ている')) return `山場 ${v.kind} ${v.id} ${v.err || ''} 名=${g.flags.named} [${v.choices.map(c => c.label).join('/')}] T${g.T}`;
      const a = play(g, v, ['名を呼ぶ', '手を伸ばす', '抱える']);
      if (!(a.id === 'climax-after' && g.cat.state === 'bound' && g.cat.spent && g.vamp.chase && g.vamp.chase.forever)) return `契約 ${a.kind} ${a.id} ${a.err || ''} 猫=${g.cat.state}`;
      const e = play(g, a, ['墓地へ', '教会へ', '広場へ', '門へ', '川辺へ', '門へ']);
      return (e.kind === 'end' && e.id === 'end-1' && g.ending === 1) || `朝 ${e.kind} ${e.id} ${e.err || ''} T${g.T}`;
    });
    check('名：信頼が足りない夜は告げられない。名を知らずに 3:00 の館に入ると死ぬ', () => {
      const { g, v } = go(stage3(), TO15_COLD);
      return (v.kind === 'death' && v.id === 'death-ritual-yakata' && !g.flags.named && g.T === 15) || `${v.kind} ${v.id} ${v.err || ''} 名=${g.flags.named} 信頼=${g.trust} T${g.T}`;
    });
    check('名：見ているだけなら死ぬ。前の夜に告げられた名は残り、負の好感度3なら「名を呼ぶ」が灰色で申し出だけ', () => {
      const a = go(stage3(), TO15.concat(['見ている', '……']));
      if (!(a.v.kind === 'death' && a.v.id === 'death-ritual-watch' && a.g.cat.state === 'taken')) return `見る ${a.v.kind} ${a.v.id} ${a.v.err || ''}`;
      const S = stage3(); S.catNamed = true; S.lure = 3;
      const b = go(S, TO15_COLD);
      const call = b.v.choices.find(c => c.label === '名を呼ぶ');
      if (!(b.v.id === 'climax-1' && call && call.disabled && b.v.choices.some(c => c.label === '彼の申し出を聞く') && (b.v.tids || []).includes('climax-gray'))) return `灰色 ${b.v.kind} ${b.v.id} ${b.v.err || ''} [${b.v.choices.map(c => c.label + (c.disabled ? '×' : '')).join('/')}]`;
      const c = play(b.g, b.v, ['名を呼ぶ']);
      return (c.err && /灰色/.test(c.err)) || `押せた ${c.id}`;
    });
    check('負の好感度：関わった夜は +1、関わらない夜は −1、狩らせた夜は −1。上限3', () => {
      const HURT = ['階段', '捕まえ', '門へ', '捕まえ', '川辺へ', '捕まえ', '門へ', '川辺へ', '門へ', '広場へ'];  // 猫を傷つけて段階を0に留め、23:30 の広場へ
      const S = newPersist(); go(S, HURT.concat(['猫のことを', '二十一時半に川辺で見た', '留まる', '留まる'])); start(S);
      if (S.lure !== 1) return `話した夜 ${S.lure}`;
      go(S, ['階段', '捕まえ', '留まる']); start(S);  // 彼に関わらない夜（猫は傷つけて段階を留める）
      if (S.lure !== 0) return `関わらない夜 ${S.lure}`;
      go(S, HURT.concat(['門に来る', '留まる', '留まる'])); start(S); go(S, HURT.concat(['門に来る', '留まる', '留まる'])); start(S);  // 二夜目からは「猫のことを」の段がない
      if (S.lure !== 2) return `二夜 ${S.lure}`;
      const r = go(S, HURT.concat(['門に来る', '門へ', '黙って去る', '川辺へ', '黙って去る', '森へ', '黙って去る', '川辺へ', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '川辺へ', '動かずに', '門へ', '動かずに', '川辺へ', '門へ'])); start(S);
      return (r.g.vamp.state === 'dead' && S.lure === 1) || `狩らせた夜 ${S.lure} 彼=${r.g.vamp.state} ${r.v.err || ''}`;
    });
    check('語り：猫を喰ったあとの彼は話を聞かせ、聞き終えると死ぬ。話は四つ巡り、一行が残る', () => {
      const S = newPersist(); S.catStage = 2;
      const toLate = ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '黙っている', '教会へ', '墓地へ', '留まる', '教会へ', '墓地へ', '教会へ', '墓地へ', '教会へ', '墓地へ'];
      const a = go(S, toLate.concat(['話を聞く']));
      if (!(a.v.id === 'tale-1' && a.g.T === 17 && a.g.cat.state === 'taken')) return `聞く ${a.v.kind} ${a.v.id} ${a.v.err || ''} T${a.g.T} 猫=${a.g.cat.state}`;
      const d = play(a.g, a.v, ['聞く', 'うなずく']);
      if (!(d.kind === 'death' && d.id === 'death-told' && S.hints.some(h => /城は七つ/.test(h)))) return `死 ${d.kind} ${d.id}`;
      S.pending = null; S.catStage = 2;
      const b = go(S, toLate.map(l => l === '黙っている' ? '二十三時に門で見た' : l).concat(['話を聞く']));  // 二夜目は黙れない。正直に答える
      if (b.v.id !== 'tale-2') return `二つ目 ${b.v.id} ${b.v.err || ''}`;
      const e = play(b.g, b.v, ['もう行く']);
      return (e.kind === 'death' && e.id === 'death-told-early' && S.tales === 2) || `途中 ${e.kind} ${e.id} 話=${S.tales}`;
    });
    check('少女との時間：謝罪のあとは少女の姿で歩き、場所ごとの一言と答え方がある。留まれば二人の文。3:00 に猫になって走る', () => {
      const { g, v } = go(stage3(), ['階段', '門へ', '川辺へ', '門へ', '広場へ', '留まる']);
      if (!(v.id === 'hiroba-07' && (v.tids || []).includes('cat-stay-lap'))) return `膝 ${v.id} ${v.err || ''} ${JSON.stringify(v.tids)}`;
      const a = play(g, v, ['教会へ', '墓地へ', '何も責めない', '何も聞かない', '館へ', '何もしない', '留まる', '何もしない', '森へ']);
      if (!(g.cat.form === 'girl' && a.id === 'mori-12' && (a.tids || []).includes('girl-walk-mori') && a.choices.some(c => c.label === '手を出す') && has(a, /来るよ/))) return `歩く ${a.id} ${a.err || ''} 姿=${g.cat.form} ${JSON.stringify(a.tids)}`;
      const b = play(g, a, ['手を出す', '川辺へ']);
      if (!(b.id === 'kawa-13' && (b.tids || []).includes('girl-walk-kawa'))) return `川辺 ${b.id} ${b.err || ''} ${JSON.stringify(b.tids)}`;
      const c = play(g, b, ['黙って水を見る', '森へ', '一緒に', '怖い', '留まる']);
      return (/^mori-15/.test(c.id) && g.cat.form === 'cat' && g.cat.state === 'taken' && (c.tids || []).includes('girl-leave-15') && !g.flags.named && g.trust === 2) || `三時 ${c.kind} ${c.id} ${c.err || ''} 姿=${g.cat.form} 猫=${g.cat.state} 名=${g.flags.named} 信頼=${g.trust} T${g.T}`;
    });
    check('少女との時間：彼が不在の 3:00 以降、少女は会った場所で名を求める。①を見た人には体が覚えている一言', () => {
      const S = stage3(); S.ends.push(1);
      const { g, v } = go(S, ['階段', '門へ', '川辺へ', '門へ', '川辺へ', '門へ', '広場へ', '猫のことを', '門に来る', '教会へ', '何も責めない', '何も聞かない']);
      if (!(v.id === 'cat-kyokai-09b-2' && (v.tids || []).includes('girl-remember'))) return `覚え ${v.id} ${v.err || ''} ${JSON.stringify(v.tids)}`;
      const a = play(g, v, ['墓地へ', '彼女自身', '留まる', '吸血鬼のこと', '教会へ', '隣に座る', '墓地へ', 'もう行く', '教会へ', '一緒に', '怖い', '広場へ', '門へ', '川辺へ', '留まる']);
      return ((a.tids || []).includes('cat-wait-kawa') && g.T === 18 && g.vamp.state === 'dead' && g.flags.named && a.choices.some(c => c.label.includes('覚えている'))) || `川辺 ${a.kind} ${a.id} ${a.err || ''} T${g.T} 彼=${g.vamp.state} 名=${g.flags.named} [${a.choices.map(c => c.label).join('/')}]`;
    });
    check('しおり：一夜に一度だけ挟め、死んだあと同じ場面に戻る。段階も夜の数も動かない', () => {
      const S = newPersist(); const r = start(S); let v = r.view;
      for (const l of ['階段', '動かずに', '門へ', '動かずに', '川辺へ']) v = choose(r.g, v, v.choices.findIndex(c => c.label.includes(l)));
      if (!(canShiori(r.g) && placeShiori(r.g) && !canShiori(r.g) && !placeShiori(r.g))) return '一度だけ';
      v = play(r.g, v, ['動かずに', '留まる', '留まる']);
      if (!(v.kind === 'death' && hasShiori(S) && S.pending)) return `死 ${v.kind} ${v.id}`;
      const b = resume(S);
      if (!(b && b.g.T === 4 && b.g.pos === 'kawa' && b.view.kind === 'scene' && S.runs === 1 && S.pending === null && S.catStage === 0 && S.girlNights === 0)) return `戻る T${b && b.g.T} ${b && b.g.pos} 夜=${S.runs} 段階=${S.catStage}`;
      if (canShiori(b.g)) return '戻ったあとも一度だけ';
      const v2 = play(b.g, b.view, ['動かずに', '留まる', '留まる']); start(S);
      return (v2.kind === 'death' && S.deaths === 2 && S.runs === 2 && !hasShiori(S) && S.catStage === 1) || `二度目 ${v2.kind} 死=${S.deaths} 夜=${S.runs} 段階=${S.catStage}`;
    });
    // 文章の欠けと余り：到達できる (T, 場所) を総当たりし、使った id を集める
    check('文章：参照した id がすべてある（欠けなし）', () => {
      for (const n of Object.keys(R)) run(+n);
      // 到達できる全マスを、死なない前提で巡る（旗なし）
      const reach = [new Set(['heya'])];
      for (let T = 2; T <= 20; T++) { const s = new Set(); for (const p of reach[T - 2]) { if (WOLF[T - 1] === p) continue; ADJ[p].concat([p]).forEach(n => s.add(n)); } reach.push(s); }
      // 彼が死んでいるのは早くて T10（追跡で狩る）、猫が取り込まれるのは T15 から。猫の段階と、ついてくる状態も
      const girl = g => { g.S.catStage = 3; g.cat.state = 'follow'; g.cat.form = 'girl'; g.trust = 3; };
      const states = [[1, g => {}], [10, g => { g.vamp.state = 'dead'; }], [15, g => { g.vamp.state = 'dead'; g.cat.state = 'taken'; }],
        [1, g => { g.S.catStage = 1; }], [1, g => { g.S.catStage = 2; }], [1, g => { g.S.catStage = 3; }],
        [3, g => { g.S.catStage = 2; g.cat.state = 'follow'; }], [3, g => { g.S.catStage = 3; g.cat.state = 'follow'; }], [3, g => { g.S.catStage = 3; g.cat.state = 'follow'; g.cat.far = true; }],
        [8, g => { g.S.runs = 2; }], [16, g => { g.S.catStage = 2; g.vamp.state = 'dead'; g.cat.safe = true; }], [16, g => { g.S.catStage = 3; g.vamp.state = 'dead'; g.cat.safe = true; g.trust = 3; }],
        // 第六版：少女の姿で歩く（留まりも、彼の匂いも、①のあとも）、名を知って 3:00 の館、同盟、灰色、逃走、語り（四つ）、在宅の語り
        [9, girl], [10, g => { girl(g); g.prev = g.pos; }], [10, g => { girl(g); g.S.lure = 2; }], [9, g => { girl(g); g.S.ends.push(1); }], [10, g => { girl(g); g.cat.far = true; }],
        [15, g => { g.S.catStage = 3; g.S.catNamed = true; }], [15, g => { g.S.catStage = 3; g.S.catNamed = true; g.flags.alliance = true; }], [15, g => { g.S.catStage = 3; g.S.catNamed = true; g.S.lure = 3; }], [15, g => { g.S.catStage = 3; g.S.catNamed = true; g.S.ends.push(1); }],
        [16, g => { g.cat.state = 'bound'; g.cat.spent = true; g.cat.form = 'girl'; }],
        [16, g => { g.cat.state = 'taken'; }], [16, g => { g.cat.state = 'taken'; g.S.tales = 1; }], [16, g => { g.cat.state = 'taken'; g.S.tales = 2; }], [16, g => { g.cat.state = 'taken'; g.S.tales = 3; }],
        [1, g => { g.S.lure = 1; }]];
      // 動かない選択肢は三段まで追う。段ごとに g を作り直す
      const walk = (T, p, st, labels, depth) => {
        const S = newPersist(); const g = newRun(S); g.T = T; g.pos = p; st(g);
        let v = arrive(g); for (const l of labels) { const c = v.choices.find(x => x.label === l); if (!c) return; v = c.go(); }
        if (v.kind !== 'scene' || depth >= 3) return;
        for (const c of v.choices) if (!c.move && !c.disabled) walk(T, p, st, labels.concat([c.label]), depth + 1);
      };
      for (const [from, st] of states) for (let T = from; T <= 20; T++) for (const p of reach[T - 1]) walk(T, p, st, [], 0);
      return missing.size === 0 || `${missing.size} 本: ${[...missing].sort().join(' ')}`;
    });
    check('文章：使われない id がない（余りなし）', () => {
      const extra = Object.keys(TEXT).filter(k => !used.has(k) && !/^death-|^end-|^vamp-|^contract-|^cat-offer|^cat-again-|^with-cat|^yakata-1[2-4]-ally|^yakata-asleep|^cat-yakata|^cat-bochi-q$|^yakata-empty$|^extra-|^near$|^cat-cold$|^cat-shoo$|^girl-apology-again$|^cat-bochi-cold-again$|^cat-cold-again$|^cat-cold-yakata-asleep$|^tale-end$|^girl-warn$|^cat-warn$/.test(k));
      // 選択肢だけの箱（c のみ）は ch() で参照されるので used に入る
      return extra.length === 0 || `${extra.length} 本: ${extra.join(' ')}`;
    });
    return out;
  }

  const deathCount = () => Object.keys(TEXT).filter(k => /^death-/.test(k)).length;
  function toggleLong(view) {
    if (!view || !view.alt) return false;
    const a = view.alt, cur = view.showLong ? a.long : a.short, nxt = view.showLong ? a.short : a.long;
    view.paras.splice(a.at, cur.length, ...nxt); view.showLong = !view.showLong; return true;
  }
  const longCount = () => Object.keys(TEXT).filter(k => TEXT[k] && TEXT[k].l).length;
  return { P, NAME, ADJ, WOLF, CAT, VAMP, TIME, adj, newPersist, start, play, R, PRE, HINT_3JI, selfTest, setText, vampPos, catPos, tx, used, missing, deathCount, toggleLong, longCount, SEEN, choose, canShiori, hasShiori, placeShiori, resume };
})();
if (typeof module !== 'undefined') module.exports = OOKAMI;
