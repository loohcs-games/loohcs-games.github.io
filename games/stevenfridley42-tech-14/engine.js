// 自動生成ファイル（build-static.js）。直すときは poker/ の元のファイルを直してビルドし直す
(function () {
  const defs = {
    "crypto": function (module, exports, require) {

function rand32() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }
module.exports = {
  // 偏りのない整数 [min, max)
  randomInt(min, max) {
    if (max === undefined) { max = min; min = 0; }
    const range = max - min;
    const limit = Math.floor(0x100000000 / range) * range;
    let x;
    do { x = rand32(); } while (x >= limit);
    return min + (x % range);
  },
  randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return { toString: () => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('') };
  },
};
    },
    "./evaluator": function (module, exports, require) {
'use strict';

// カードは "As" "Td" "9c" のような2文字の文字列で表す
const RANK_CHARS = '23456789TJQKA';
const HAND_NAMES = [
  'ハイカード', 'ワンペア', 'ツーペア', 'スリーカード', 'ストレート',
  'フラッシュ', 'フルハウス', 'フォーカード', 'ストレートフラッシュ',
];

const rankOf = (c) => RANK_CHARS.indexOf(c[0]) + 2;

// 5枚の役を評価して、大きいほど強い数値スコアを返す
function evaluate5(cards) {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);

  let straightHigh = 0;
  if (new Set(ranks).size === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5; // A-2-3-4-5
  }

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const grouped = groups.map((g) => g[0]);

  let cat;
  let kickers;
  if (straightHigh && flush) { cat = 8; kickers = [straightHigh]; }
  else if (groups[0][1] === 4) { cat = 7; kickers = grouped; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; kickers = grouped; }
  else if (flush) { cat = 5; kickers = ranks; }
  else if (straightHigh) { cat = 4; kickers = [straightHigh]; }
  else if (groups[0][1] === 3) { cat = 3; kickers = grouped; }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; kickers = grouped; }
  else if (groups[0][1] === 2) { cat = 1; kickers = grouped; }
  else { cat = 0; kickers = ranks; }

  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (kickers[i] || 0);
  return { score, cat };
}

// 5〜7枚から最強の5枚を選ぶ
function evaluateBest(cards) {
  let best = null;
  const n = cards.length;
  const pick = [];
  const rec = (start) => {
    if (pick.length === 5) {
      const hand = pick.map((i) => cards[i]);
      const ev = evaluate5(hand);
      if (!best || ev.score > best.score) best = { ...ev, cards: hand };
      return;
    }
    for (let i = start; i <= n - (5 - pick.length); i++) {
      pick.push(i);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
  const isRoyal = best.cat === 8 && best.score % 15 ** 4 === 0 && Math.floor(best.score / 15 ** 4) % 15 === 14;
  best.name = isRoyal ? 'ロイヤルフラッシュ' : HAND_NAMES[best.cat];
  return best;
}

module.exports = { evaluate5, evaluateBest, HAND_NAMES };

    },
    "./bot": function (module, exports, require) {
'use strict';

// AIプレイヤーの考え方
// モンテカルロ法（ランダムに何百回も残りのカードを配ってみる）で勝率を見積もり、
// ポットオッズ（払う額に対してもらえる額）と比べて行動を決める。
const { evaluate5, evaluateBest } = require('./evaluator');

const FULL_DECK = [];
for (const r of '23456789TJQKA') for (const s of 'shdc') FULL_DECK.push(r + s);

const LEVELS = {
  easy: { label: 'やさしい', iters: 80, noise: 0.18, aggression: 0.5, bluff: 0.02, loose: 0.12, openOnly: false },
  normal: { label: 'ふつう', iters: 250, noise: 0.07, aggression: 1.0, bluff: 0.07, loose: 0.03, openOnly: false },
  hard: { label: 'つよい', iters: 500, noise: 0.02, aggression: 1.3, bluff: 0.12, loose: 0, openOnly: true },
};
const BOT_NAMES = ['ジョー', 'エミリー', 'マックス', 'サクラ', 'ケン', 'リリー', 'ボブ', 'ミア', 'ジャック', 'ソフィア', 'レオ', 'ハナ'];

const rankOf = (c) => '23456789TJQKA'.indexOf(c[0]) + 2;

// 山札から n 枚をランダムに取り出す（部分シャッフル）
function sample(deck, n) {
  const d = deck.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (d.length - i));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d.slice(0, n);
}

// 勝率（引き分けは0.5）を見積もる
function equity({ variant, hole, board = [], discards = [], opponents, iters }) {
  const known = new Set([...hole, ...board]);
  const deck = FULL_DECK.filter((c) => !known.has(c));
  const opps = Math.max(1, Math.min(opponents, 5));
  let score = 0;
  for (let it = 0; it < iters; it++) {
    let mine;
    let best = -1;
    if (variant === 'draw') {
      const kept = hole.filter((_, k) => !discards.includes(k));
      const cards = sample(deck, discards.length + opps * 5);
      mine = evaluate5([...kept, ...cards.slice(0, discards.length)]).score;
      for (let o = 0; o < opps; o++) {
        const start = discards.length + o * 5;
        best = Math.max(best, evaluate5(cards.slice(start, start + 5)).score);
      }
    } else {
      const fill = 5 - board.length;
      const cards = sample(deck, fill + opps * 2);
      const fullBoard = [...board, ...cards.slice(0, fill)];
      mine = evaluateBest([...hole, ...fullBoard]).score;
      for (let o = 0; o < opps; o++) {
        const start = fill + o * 2;
        best = Math.max(best, evaluateBest([...cards.slice(start, start + 2), ...fullBoard]).score);
      }
    }
    if (mine > best) score += 1;
    else if (mine === best) score += 0.5;
  }
  return score / iters;
}

// ファイブカードドロー: 捨てるカードの位置を選ぶ
function chooseDiscards(cards, level = 'normal') {
  const P = LEVELS[level] || LEVELS.normal;
  const ranks = cards.map(rankOf);
  const { cat } = evaluate5(cards);
  if (cat >= 4) return []; // ストレート以上はそのまま

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  if (cat >= 1) {
    // ペア・ツーペア・スリーカード: 組になっているカードを残す
    return ranks.map((r, k) => (counts.get(r) >= 2 ? -1 : k)).filter((k) => k >= 0);
  }

  // フラッシュまであと1枚
  for (const suit of 'shdc') {
    const same = cards.map((c, k) => (c[1] === suit ? k : -1)).filter((k) => k >= 0);
    if (same.length === 4) return [0, 1, 2, 3, 4].filter((k) => !same.includes(k));
  }
  // ストレートまであと1枚（つよいAIは両側が開いている時だけ狙う）
  for (let skip = 0; skip < 5; skip++) {
    const rest = ranks.filter((_, k) => k !== skip);
    const uniq = [...new Set(rest)];
    const span = Math.max(...uniq) - Math.min(...uniq);
    if (uniq.length === 4 && (span === 3 || (!P.openOnly && span === 4))) return [skip];
  }
  // 役なし: 一番大きいカードだけ残して4枚交換
  const hi = ranks.indexOf(Math.max(...ranks));
  return [0, 1, 2, 3, 4].filter((k) => k !== hi);
}

// 賭けの判断。{ action, amount } を返す
function decideBet(table, i, level = 'normal') {
  const P = LEVELS[level] || LEVELS.normal;
  const s = table.seats[i];
  const L = table.legal(i);
  const opponents = table.count((j) => j !== i && table.isLive(j));
  const iters = Math.max(20, Math.round(P.iters * (table.botIterScale || 1)));

  let e = equity({
    variant: table.variant,
    hole: s.cards,
    board: table.board,
    discards: table.phase === 'predraw' ? chooseDiscards(s.cards, level) : [],
    opponents,
    iters,
  });
  e = Math.min(1, Math.max(0, e + (Math.random() * 2 - 1) * P.noise));

  const pot = table.totalPot();
  const toCall = L.toCall;
  const potOdds = toCall / (pot + toCall || 1);
  const rel = e * (opponents + 1); // 1 = 平均的な強さ
  const rand = Math.random();

  const raiseTo = (frac) => {
    if (!L.canRaise) return null;
    const base = L.isBet ? pot * frac : table.currentBet + (pot + toCall) * frac;
    let to = Math.round(Math.max(L.minTo, Math.min(L.maxTo, base)));
    if (to >= L.maxTo * 0.85) to = L.maxTo; // ほぼ全額ならオールイン
    return to;
  };
  const bet = (frac) => {
    const to = raiseTo(frac);
    if (to === null) return toCall > 0 ? { action: 'call' } : { action: 'check' };
    return { action: 'raise', amount: to };
  };

  const strong = rel >= 1.8 || e >= 0.8;
  const good = rel >= 1.25;

  if (toCall === 0) {
    if (strong && rand < 0.6 * P.aggression + 0.2) return bet(0.55 + Math.random() * 0.45);
    if (good && rand < 0.35 * P.aggression) return bet(0.4 + Math.random() * 0.3);
    if (rand < P.bluff) return bet(0.5 + Math.random() * 0.3);
    return { action: 'check' };
  }

  // オールインのコールは少し慎重に
  const margin = toCall >= s.stack ? 0.06 : 0.02;
  if (strong && rand < 0.45 * P.aggression + 0.15) return bet(0.7 + Math.random() * 0.5);
  if (e >= potOdds + margin - P.loose) return { action: 'call' };
  if (rand < P.bluff * 0.5) return bet(0.7 + Math.random() * 0.3);
  return { action: 'fold' };
}

module.exports = { LEVELS, BOT_NAMES, equity, chooseDiscards, decideBet };

    },
    "./game": function (module, exports, require) {
'use strict';

const crypto = require('crypto');
const { evaluateBest } = require('./evaluator');
const bot = require('./bot');

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
// 参加料アップ時の倍率（レベル1 = 初期の参加料）
const BLIND_MULT = [1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 40, 50, 75, 100];

const VARIANTS = {
  holdem: { name: 'テキサスホールデム', holeCards: 2, maxSeats: 9, rounds: ['preflop', 'flop', 'turn', 'river'] },
  draw: { name: 'ファイブカードドロー', holeCards: 5, maxSeats: 6, rounds: ['predraw', 'postdraw'] },
};
const BETTING = new Set(['preflop', 'flop', 'turn', 'river', 'predraw', 'postdraw']);
const NEXT_STREET = { preflop: 'flop', flop: 'turn', turn: 'river' };
const STREET_NAMES = { flop: 'フロップ', turn: 'ターン', river: 'リバー' };
const DEALER_LABELS = {
  hole: 'シャッフルして配る',
  flop: 'フロップを開く（3枚）',
  turn: 'ターンを開く（1枚）',
  river: 'リバーを開く（1枚）',
  drawdeal: '交換カードを配る',
  payout: 'チップを勝った人へ渡す',
};
// AIディーラーが各作業にかける時間（ms）
const AI_DELAY = { hole: 600, flop: 1000, turn: 1000, river: 1000, drawdeal: 600, payout: 1800 };

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function newDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return shuffle(deck);
}

class Table {
  constructor(opts, hooks = {}) {
    this.id = opts.id;
    this.name = opts.name;
    this.variant = VARIANTS[opts.variant] ? opts.variant : 'holdem';
    this.rules = VARIANTS[this.variant];
    this.dealerMode = opts.dealerMode === 'player' ? 'player' : 'ai';
    this.isPublic = opts.isPublic !== false;
    this.baseSb = opts.smallBlind;
    this.baseBb = opts.bigBlind;
    this.sb = this.baseSb;
    this.bb = this.baseBb;
    this.maxSeats = Math.min(opts.maxSeats || this.rules.maxSeats, this.rules.maxSeats);
    this.actionTime = opts.actionTime || 30000;
    this.startingStack = opts.startingStack || 500;
    this.allowRebuy = opts.allowRebuy !== false;
    this.blindUpMs = (opts.blindUpMinutes || 0) * 60 * 1000;
    this.blindLevel = 0;
    this.blindStart = 0;
    this.persistent = !!opts.persistent;
    this.delays = {
      start: 2000, aiScale: 1, dealerTimeout: 20000, dealerAbsent: 2500,
      showdown: 5000, uncontested: 2500, botScale: 1, ...opts.delays,
    };
    // AIだけではゲームを始めない（人間が1人以上必要）
    this.requireHuman = opts.requireHuman !== false;
    this.botIterScale = opts.botIterScale || 1;
    this.botTimer = null;
    this.botKey = '';
    this.hooks = hooks;

    this.seats = Array(this.maxSeats).fill(null);
    this.phase = 'waiting'; // waiting | 各ベッティングラウンド | draw | showdown
    this.handNo = 0;
    this.turnId = 0;
    this.button = -1;
    this.sbIdx = -1;
    this.bbIdx = -1;
    this.board = [];
    this.deck = [];
    this.muck = [];
    this.toAct = -1;
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.deadline = 0;
    this.dealerStep = null;
    this.dealerDeadline = 0;
    this.dealerMsg = '';
    this.drawQueue = [];
    this.result = null;
    this.pendingWinnings = null;
    this.timer = null;
    this.pendingTimer = null;
    this.lastActivity = Date.now();
  }

  // ---------- 補助 ----------
  update() {
    this.lastActivity = Date.now();
    if (this.hooks.update) this.hooks.update(this);
    this.scheduleBots();
  }
  log(text) { this.hooks.log && this.hooks.log(this, text); }
  say(text, log = true) {
    this.dealerMsg = text;
    if (log) this.log(`${this.dealerMode === 'ai' ? 'AIディーラー' : 'ディーラー'}: ${text}`);
  }
  seatIndexOf(pid) { return this.seats.findIndex((s) => s && s.pid === pid); }
  get inBetting() { return BETTING.has(this.phase) && !this.dealerStep; }
  get handActive() { return this.phase !== 'waiting' && this.phase !== 'showdown'; }
  isLive(i) { const s = this.seats[i]; return !!s && s.inHand && !s.folded; }
  canAct(i) { return this.isLive(i) && !this.seats[i].allIn; }
  count(pred) { let n = 0; for (let i = 0; i < this.maxSeats; i++) if (pred(i)) n++; return n; }
  nextIdx(from, pred) {
    for (let k = 1; k <= this.maxSeats; k++) {
      const i = (((from + k) % this.maxSeats) + this.maxSeats) % this.maxSeats;
      if (pred(i)) return i;
    }
    return -1;
  }
  orderFromButton(pred) {
    const out = [];
    for (let k = 1; k <= this.maxSeats; k++) {
      const i = (this.button + k) % this.maxSeats;
      if (pred(i)) out.push(i);
    }
    return out;
  }
  eligible(s) { return !!s && !s.sittingOut && !s.leaving && s.connected && s.stack > 0; }
  seatedCount() { return this.seats.filter(Boolean).length; }
  humanCount() { return this.seats.filter((s) => s && !s.isBot && !s.leaving).length; }
  canStart() {
    const players = this.seats.filter((s) => this.eligible(s));
    return players.length >= 2 && (!this.requireHuman || players.some((s) => !s.isBot));
  }
  totalPot() { return this.seats.reduce((a, s) => a + (s && s.inHand ? s.total : 0), 0); }
  drawCard() {
    if (this.deck.length === 0) { this.deck = shuffle(this.muck); this.muck = []; }
    return this.deck.pop();
  }

  later(ms, fn) {
    clearTimeout(this.pendingTimer);
    const hand = this.handNo;
    this.pendingTimer = setTimeout(() => { this.pendingTimer = null; if (this.handNo === hand) fn(); }, ms);
  }
  cancelLater() { clearTimeout(this.pendingTimer); this.pendingTimer = null; }

  // ---------- 着席・離席 ----------
  sit(pid, name, idx, extra = {}) {
    const existing = this.seatIndexOf(pid);
    if (existing !== -1) {
      throw new Error(this.seats[existing].leaving ? 'ゲームが終わるまでお待ちください' : 'すでに着席しています');
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.maxSeats) throw new Error('無効な席です');
    if (this.seats[idx]) throw new Error('その席は埋まっています');
    const buyIn = this.startingStack;
    this.seats[idx] = {
      pid, name, stack: buyIn, connected: true, sittingOut: false, leaving: false,
      inHand: false, cards: [], bet: 0, total: 0, folded: false, allIn: false,
      acted: false, lastActBet: 0, lastAction: '', shown: false, handName: '',
      dealt: 0, drew: null, discards: null, isBot: false, level: '', ...extra,
    };
    this.log(extra.isBot
      ? `${name}（AI・${bot.LEVELS[extra.level].label}）が着席しました`
      : `${name} が ${buyIn} チップで着席しました`);
    this.maybeStart();
    this.update();
  }

  stand(pid) {
    const i = this.seatIndexOf(pid);
    if (i === -1) return;
    const s = this.seats[i];
    if (s.inHand && this.phase !== 'waiting') {
      // ゲーム中はフォールド扱いにして、ゲーム終了後に席を空ける
      s.leaving = true;
      if (this.handActive && !s.folded) this.foldOutOfTurn(i);
    } else {
      this.seats[i] = null;
    }
    if (this.seatedCount() === 0) this.resetBlinds();
    this.log(`${s.name} が席を立ちました`);
    this.update();
  }

  // ---------- AIプレイヤー ----------
  addBot(level = 'normal', idx) {
    if (!bot.LEVELS[level]) level = 'normal';
    if (idx === undefined) idx = this.spreadSeat();
    if (idx === -1) throw new Error('空いている席がありません');
    const used = new Set(this.seats.filter(Boolean).map((s) => s.name));
    const name = bot.BOT_NAMES.find((n) => !used.has(n)) || `AI${idx + 1}`;
    const pid = `bot:${crypto.randomBytes(4).toString('hex')}`;
    this.sit(pid, name, idx, { isBot: true, level });
    return idx;
  }

  // ほかの人からなるべく離れた空席を選ぶ（テーブルにまんべんなく座らせる）
  spreadSeat() {
    const n = this.maxSeats;
    const taken = this.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    let best = -1;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (this.seats[i]) continue;
      const dist = taken.length ? Math.min(...taken.map((j) => Math.min(Math.abs(i - j), n - Math.abs(i - j)))) : n;
      if (dist > bestDist) { best = i; bestDist = dist; }
    }
    return best;
  }

  removeBot(idx) {
    const s = this.seats[idx];
    if (!s || !s.isBot) throw new Error('その席にAIはいません');
    this.stand(s.pid);
  }

  // AIの手番なら、少し考える時間をおいてから行動させる
  scheduleBots() {
    if (this.destroyed) return;
    let actor = -1;
    let kind = '';
    if (this.dealerStep) {
      const d = this.seats[this.button];
      if (this.dealerMode === 'player' && d && d.isBot) { actor = this.button; kind = 'dealer'; }
    } else if (this.toAct >= 0 && this.seats[this.toAct] && this.seats[this.toAct].isBot) {
      if (this.inBetting) { actor = this.toAct; kind = 'bet'; }
      else if (this.phase === 'draw') { actor = this.toAct; kind = 'draw'; }
    }
    const key = actor < 0 ? '' : `${this.handNo}:${this.turnId}:${kind}:${this.dealerStep || ''}`;
    if (key === this.botKey) return;
    clearTimeout(this.botTimer);
    this.botKey = key;
    if (!key) return;
    const ms = (kind === 'dealer' ? 900 : 700 + Math.random() * 1300) * this.delays.botScale;
    this.botTimer = setTimeout(() => {
      if (this.botKey !== key) return;
      this.runBot(actor, kind);
    }, ms);
  }

  runBot(i, kind) {
    const s = this.seats[i];
    if (!s) return;
    try {
      if (kind === 'dealer') this.dealerAction(s.pid, this.dealerStep);
      else if (kind === 'draw') this.declareDraw(s.pid, bot.chooseDiscards(s.cards, s.level));
      else {
        const d = bot.decideBet(this, i, s.level);
        this.act(s.pid, d.action, d.amount);
      }
    } catch (e) {
      // 万一判断に失敗したら、安全な行動をとる
      if (kind === 'dealer') this.performDealer(this.dealerStep, false);
      else if (kind === 'draw') this.declareDraw(s.pid, []);
      else this.act(s.pid, s.bet >= this.currentBet ? 'check' : 'fold');
    }
  }

  setConnected(pid, connected) {
    const i = this.seatIndexOf(pid);
    if (i === -1) return;
    const s = this.seats[i];
    s.connected = connected;
    // 切断中のプレイヤーの手番は短い持ち時間で進める
    if (!connected && this.toAct === i) this.startTurn(i);
    if (connected) this.maybeStart();
    this.update();
  }

  setSittingOut(pid, value) {
    const i = this.seatIndexOf(pid);
    if (i === -1) return;
    this.seats[i].sittingOut = !!value;
    if (!value) this.maybeStart();
    this.update();
  }

  rebuy(pid) {
    const i = this.seatIndexOf(pid);
    if (i === -1) throw new Error('着席していません');
    const s = this.seats[i];
    if (!this.allowRebuy) throw new Error('このテーブルはリバイできません');
    if (s.stack > 0) throw new Error('チップが残っている間はリバイできません');
    if (this.handActive && s.inHand) throw new Error('ゲーム中はリバイできません');
    s.stack = this.startingStack;
    this.log(`${s.name} がリバイしました（${this.startingStack} チップ）`);
    this.maybeStart();
    this.update();
  }

  foldOutOfTurn(i) {
    const s = this.seats[i];
    s.folded = true;
    s.lastAction = 'フォールド';
    if (this.count((j) => this.isLive(j)) === 1) { this.finish(false); return; }
    if (this.toAct !== i) return;
    if (this.phase === 'draw') { clearTimeout(this.timer); this.toAct = -1; this.nextDrawer(); }
    else this.advance(i);
  }

  // ---------- 参加料（ブラインド） ----------
  resetBlinds() {
    this.blindStart = 0;
    this.blindLevel = 0;
    this.sb = this.baseSb;
    this.bb = this.baseBb;
  }

  updateBlinds() {
    if (!this.blindUpMs) return;
    if (!this.blindStart) this.blindStart = Date.now();
    const level = Math.min(BLIND_MULT.length - 1, Math.floor((Date.now() - this.blindStart) / this.blindUpMs));
    if (level === this.blindLevel) return;
    this.blindLevel = level;
    this.sb = this.baseSb * BLIND_MULT[level];
    this.bb = this.baseBb * BLIND_MULT[level];
    this.log(`参加料が ${this.sb} / ${this.bb} に上がりました（レベル ${level + 1}）`);
  }

  nextBlindIn() {
    if (!this.blindUpMs || !this.blindStart || this.blindLevel >= BLIND_MULT.length - 1) return null;
    return Math.max(0, this.blindStart + (this.blindLevel + 1) * this.blindUpMs - Date.now());
  }

  // ---------- ディーラーの作業 ----------
  requestDealer(kind) {
    clearTimeout(this.timer);
    this.toAct = -1;
    this.dealerStep = kind;
    let ms;
    if (this.dealerMode === 'ai') {
      ms = AI_DELAY[kind] * this.delays.aiScale;
    } else {
      const d = this.seats[this.button];
      const absent = !d || !d.connected || d.sittingOut || d.leaving;
      ms = absent ? this.delays.dealerAbsent : this.delays.dealerTimeout;
      this.say(`${d ? d.name : 'ディーラー'}さん、「${DEALER_LABELS[kind]}」を押してください`, false);
    }
    this.dealerDeadline = Date.now() + ms;
    this.update();
    this.later(ms, () => this.performDealer(kind, true));
  }

  dealerAction(pid, kind) {
    if (this.dealerMode !== 'player') throw new Error('この部屋はAIディーラーです');
    if (!this.dealerStep) throw new Error('今は配る場面ではありません');
    if (kind && kind !== this.dealerStep) throw new Error('今はその作業はできません');
    const i = this.seatIndexOf(pid);
    if (i === -1 || i !== this.button) throw new Error('ディーラー役の人だけが配れます');
    this.performDealer(this.dealerStep, false);
  }

  performDealer(kind, auto) {
    if (this.dealerStep !== kind) return;
    this.cancelLater();
    this.dealerStep = null;
    if (this.dealerMode === 'player') {
      this.dealerMsg = '';
      if (auto) this.log('時間切れのため、自動で進めました');
    }
    switch (kind) {
      case 'hole': this.dealHole(); break;
      case 'flop': case 'turn': case 'river': this.dealBoard(); break;
      case 'drawdeal': this.dealAllDraws(); this.afterDraw(); break;
      case 'payout': this.payout(); break;
      default: break;
    }
  }

  // ---------- ゲーム進行 ----------
  maybeStart() {
    if (this.phase !== 'waiting' || this.pendingTimer) return;
    if (!this.canStart()) return;
    this.later(this.delays.start, () => this.startHand());
  }

  startHand() {
    // チップがなくなったAIは、リバイできるならもらい直し、できなければ退席
    for (const s of this.seats) {
      if (!s || !s.isBot || s.stack > 0 || s.leaving) continue;
      if (this.allowRebuy) { s.stack = this.startingStack; this.log(`${s.name}（AI）がリバイしました`); }
      else { s.leaving = true; this.log(`${s.name}（AI）は脱落しました`); }
    }
    for (let i = 0; i < this.maxSeats; i++) if (this.seats[i] && this.seats[i].leaving) this.seats[i] = null;
    const players = this.seats.filter((s) => this.eligible(s));
    this.dealerStep = null;
    if (!this.canStart()) {
      this.phase = 'waiting';
      this.result = null;
      this.toAct = -1;
      this.dealerMsg = '';
      for (const s of this.seats) if (s) Object.assign(s, { inHand: false, cards: [], bet: 0, total: 0, dealt: 0, drew: null });
      this.board = [];
      this.update();
      return;
    }

    this.updateBlinds();
    this.handNo++;
    this.deck = newDeck();
    this.muck = [];
    this.board = [];
    this.result = null;
    this.pendingWinnings = null;
    for (const s of this.seats) {
      if (!s) continue;
      Object.assign(s, {
        inHand: this.eligible(s), cards: [], bet: 0, total: 0, folded: false, allIn: false,
        acted: false, lastActBet: 0, lastAction: '', shown: false, handName: '',
        dealt: 0, drew: null, discards: null,
      });
    }

    const inHand = (i) => !!this.seats[i] && this.seats[i].inHand;
    this.button = this.nextIdx(this.button, inHand);
    if (players.length === 2) {
      // 2人のとき: ディーラーが参加料（小）を払い、最初のラウンドは先に行動する
      this.sbIdx = this.button;
      this.bbIdx = this.nextIdx(this.button, inHand);
    } else {
      this.sbIdx = this.nextIdx(this.button, inHand);
      this.bbIdx = this.nextIdx(this.sbIdx, inHand);
    }
    this.pay(this.seats[this.sbIdx], this.sb);
    this.pay(this.seats[this.bbIdx], this.bb);
    this.seats[this.sbIdx].lastAction = `参加料(小) ${this.seats[this.sbIdx].bet}`;
    this.seats[this.bbIdx].lastAction = `参加料(大) ${this.seats[this.bbIdx].bet}`;

    this.phase = this.rules.rounds[0];
    this.currentBet = this.bb;
    this.minRaise = this.bb;
    this.log(`--- 第${this.handNo}ゲーム（${this.rules.name}）ディーラー: ${this.seats[this.button].name} ---`);
    if (this.dealerMode === 'ai') this.say(`参加料 ${this.sb} / ${this.bb}。カードを配ります`, false);
    this.requestDealer('hole');
  }

  dealHole() {
    const order = this.orderFromButton((i) => !!this.seats[i] && this.seats[i].inHand);
    for (let r = 0; r < this.rules.holeCards; r++) {
      for (const i of order) { this.seats[i].cards.push(this.drawCard()); this.seats[i].dealt++; }
    }
    if (this.dealerMode === 'ai') this.say(this.variant === 'draw' ? '5枚ずつ配りました。賭けをどうぞ' : '2枚ずつ配りました。賭けをどうぞ', false);
    // 配るアニメーションの分だけ持ち時間を延ばす
    this.beginBetting(order.length * this.rules.holeCards * 120 + 400);
  }

  dealBoard() {
    this.deck.pop(); // バーンカード（1枚捨てる）
    const n = this.phase === 'flop' ? 3 : 1;
    for (let k = 0; k < n; k++) this.board.push(this.drawCard());
    this.log(`${STREET_NAMES[this.phase]}: ${this.board.join(' ')}`);
    if (this.dealerMode === 'ai') this.say(`${STREET_NAMES[this.phase]}です`, false);
    if (this.count((i) => this.canAct(i)) <= 1) {
      // 全員オールイン: カードを公開して最後まで配る
      for (let i = 0; i < this.maxSeats; i++) if (this.isLive(i)) this.seats[i].shown = true;
      this.endStreet();
      return;
    }
    this.beginBetting(n * 150 + 300);
  }

  beginBetting(extraMs = 0) {
    const firstRound = this.phase === this.rules.rounds[0];
    const first = this.findNext(firstRound ? this.bbIdx : this.button);
    if (first === -1) { this.endStreet(); return; }
    this.startTurn(first, extraMs);
    this.update();
  }

  pay(s, amount) {
    const a = Math.min(amount, s.stack);
    s.stack -= a;
    s.bet += a;
    s.total += a;
    if (s.stack === 0) s.allIn = true;
    return a;
  }

  needsAction(i, canActCount) {
    if (!this.canAct(i)) return false;
    const s = this.seats[i];
    if (s.acted && s.bet >= this.currentBet) return false;
    // 他の全員がオールインなら、コールが必要な場合のみ行動する
    return canActCount > 1 || s.bet < this.currentBet;
  }

  findNext(from) {
    const n = this.count((i) => this.canAct(i));
    return this.nextIdx(from, (i) => this.needsAction(i, n));
  }

  startTurn(i, extraMs = 0) {
    clearTimeout(this.timer);
    this.toAct = i;
    const turn = ++this.turnId;
    const ms = (this.seats[i].connected ? this.actionTime : Math.min(this.actionTime, 5000)) + extraMs;
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => { if (this.turnId === turn) this.onTimeout(i); }, ms);
  }

  onTimeout(i) {
    const s = this.seats[i];
    if (!s || this.toAct !== i) return;
    s.sittingOut = true;
    this.log(`${s.name} は時間切れです（離席扱いになります）`);
    if (this.phase === 'draw') this.declareDraw(s.pid, []);
    else this.act(s.pid, s.bet >= this.currentBet ? 'check' : 'fold');
  }

  legal(i) {
    const s = this.seats[i];
    const toCall = Math.min(this.currentBet - s.bet, s.stack);
    const maxTo = s.bet + s.stack;
    const othersCanAct = this.count((j) => j !== i && this.canAct(j));
    const reopened = !s.acted || this.currentBet - s.lastActBet >= this.minRaise;
    const canRaise = reopened && othersCanAct > 0 && maxTo > this.currentBet;
    return {
      canCheck: s.bet >= this.currentBet,
      toCall,
      canRaise,
      minTo: Math.min(this.currentBet + this.minRaise, maxTo),
      maxTo,
      isBet: this.currentBet === 0,
    };
  }

  act(pid, action, amount) {
    if (!this.inBetting) throw new Error('現在はアクションできません');
    const i = this.seatIndexOf(pid);
    if (i === -1 || i !== this.toAct) throw new Error('あなたの番ではありません');
    const s = this.seats[i];
    const L = this.legal(i);

    if (action === 'allin') {
      if (L.canRaise) { action = 'raise'; amount = L.maxTo; } else action = 'call';
    }
    if (action === 'call' && L.toCall === 0) action = 'check';

    switch (action) {
      case 'fold':
        s.folded = true;
        s.lastAction = 'フォールド';
        break;
      case 'check':
        if (!L.canCheck) throw new Error('チェックできません');
        s.lastAction = 'チェック';
        break;
      case 'call':
        this.pay(s, L.toCall);
        s.lastAction = s.allIn ? 'コール（オールイン）' : `コール ${s.bet}`;
        break;
      case 'raise': {
        if (!L.canRaise) throw new Error('レイズできません');
        let to = Math.floor(Number(amount));
        if (!Number.isFinite(to)) throw new Error('金額が不正です');
        if (to >= L.maxTo) to = L.maxTo;
        if (to < L.minTo) throw new Error(`最小は ${L.minTo} です`);
        this.pay(s, to - s.bet);
        const raiseSize = to - this.currentBet;
        if (raiseSize >= this.minRaise) {
          // フルレイズ: アクションを再オープン
          this.minRaise = raiseSize;
          for (let j = 0; j < this.maxSeats; j++) if (j !== i && this.canAct(j)) this.seats[j].acted = false;
        }
        this.currentBet = to;
        s.lastAction = `${L.isBet ? 'ベット' : 'レイズ'} ${to}${s.allIn ? '（オールイン）' : ''}`;
        break;
      }
      default:
        throw new Error('不明なアクションです');
    }
    s.acted = true;
    s.lastActBet = this.currentBet;
    this.log(`${s.name}: ${s.lastAction}`);
    this.advance(i);
  }

  advance(from) {
    clearTimeout(this.timer);
    this.toAct = -1;
    if (this.count((i) => this.isLive(i)) === 1) { this.finish(false); return; }
    const next = this.findNext(from);
    if (next !== -1) { this.startTurn(next); this.update(); return; }
    this.endStreet();
  }

  endStreet() {
    this.toAct = -1;
    for (const s of this.seats) {
      if (!s || !s.inHand) continue;
      s.bet = 0;
      s.acted = false;
      s.lastActBet = 0;
      if (!s.folded && !s.allIn) s.lastAction = '';
    }
    this.currentBet = 0;
    this.minRaise = this.bb;

    const rounds = this.rules.rounds;
    if (this.phase === rounds[rounds.length - 1]) { this.finish(true); return; }
    if (this.variant === 'draw') { this.startDraw(); return; }
    this.phase = NEXT_STREET[this.phase];
    this.requestDealer(this.phase);
  }

  // ---------- ファイブカードドローの交換 ----------
  startDraw() {
    this.phase = 'draw';
    this.drawQueue = this.orderFromButton((i) => this.isLive(i));
    if (this.dealerMode === 'ai') this.say('交換したいカードを選んでください', false);
    this.nextDrawer();
  }

  nextDrawer() {
    while (this.drawQueue.length && !this.isLive(this.drawQueue[0])) this.drawQueue.shift();
    const i = this.drawQueue.shift();
    if (i === undefined) {
      const pending = this.seats.some((s) => s && s.discards && s.discards.length);
      if (this.dealerMode === 'player' && pending) this.requestDealer('drawdeal');
      else { this.dealAllDraws(); this.afterDraw(); }
      return;
    }
    this.startTurn(i);
    this.update();
  }

  declareDraw(pid, discards) {
    if (this.phase !== 'draw' || this.dealerStep) throw new Error('今はカード交換の場面ではありません');
    const i = this.seatIndexOf(pid);
    if (i === -1 || i !== this.toAct) throw new Error('あなたの番ではありません');
    if (!Array.isArray(discards)) throw new Error('不正な指定です');
    const idx = [...new Set(discards.map(Number))].sort((a, b) => a - b);
    if (idx.length > 5 || idx.some((n) => !Number.isInteger(n) || n < 0 || n > 4)) throw new Error('不正な指定です');
    const s = this.seats[i];
    s.discards = idx;
    s.drew = idx.length;
    s.lastAction = idx.length === 0 ? '交換なし' : `${idx.length}枚交換`;
    this.log(`${s.name}: ${s.lastAction}`);
    if (this.dealerMode === 'ai') this.dealDrawFor(i);
    clearTimeout(this.timer);
    this.toAct = -1;
    this.nextDrawer();
  }

  dealDrawFor(i) {
    const s = this.seats[i];
    if (!s.discards) return;
    for (const k of s.discards) {
      this.muck.push(s.cards[k]);
      s.cards[k] = this.drawCard();
      s.dealt++;
    }
    s.discards = null;
  }

  dealAllDraws() {
    for (const i of this.orderFromButton((j) => this.isLive(j))) this.dealDrawFor(i);
  }

  afterDraw() {
    this.phase = 'postdraw';
    if (this.count((i) => this.canAct(i)) <= 1) {
      for (let i = 0; i < this.maxSeats; i++) if (this.isLive(i)) this.seats[i].shown = true;
      this.finish(true);
      return;
    }
    if (this.dealerMode === 'ai') this.say('交換後の賭けです', false);
    this.beginBetting(600);
  }

  // ---------- 精算 ----------
  computePots() {
    const players = [];
    for (let i = 0; i < this.maxSeats; i++) {
      const s = this.seats[i];
      if (s && s.inHand && s.total > 0) players.push({ i, s });
    }
    const levels = [...new Set(players.map((p) => p.s.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const lvl of levels) {
      let amount = 0;
      for (const p of players) amount += Math.min(p.s.total, lvl) - Math.min(p.s.total, prev);
      const eligible = players.filter((p) => !p.s.folded && p.s.total >= lvl).map((p) => p.i);
      const last = pots[pots.length - 1];
      if (last && (eligible.length === 0 || last.eligible.join() === eligible.join())) last.amount += amount;
      else pots.push({ amount, eligible });
      prev = lvl;
    }
    return pots.filter((p) => p.amount > 0);
  }

  // 勝者を決めて、ディーラーがチップを渡すのを待つ
  finish(showdown) {
    clearTimeout(this.timer);
    this.cancelLater();
    this.toAct = -1;
    this.dealerStep = null;
    for (const s of this.seats) if (s && s.inHand) s.bet = 0;

    // コールされなかったベットを返却
    const contributors = this.seats.filter((s) => s && s.inHand).sort((a, b) => b.total - a.total);
    if (contributors.length > 1 && contributors[0].total > contributors[1].total) {
      const diff = contributors[0].total - contributors[1].total;
      contributors[0].total -= diff;
      contributors[0].stack += diff;
    }

    const pots = this.computePots();
    const winnings = new Map();
    const add = (i, amt) => winnings.set(i, (winnings.get(i) || 0) + amt);

    if (showdown) {
      const evals = new Map();
      for (let i = 0; i < this.maxSeats; i++) {
        if (!this.isLive(i)) continue;
        const s = this.seats[i];
        const ev = evaluateBest([...s.cards, ...this.board]);
        evals.set(i, ev);
        s.shown = true;
        s.handName = ev.name;
      }
      for (const pot of pots) {
        const best = Math.max(...pot.eligible.map((i) => evals.get(i).score));
        // 端数チップはディーラーの左から順に配る
        const winners = this.orderFromButton((i) => pot.eligible.includes(i) && evals.get(i).score === best);
        const share = Math.floor(pot.amount / winners.length);
        let rem = pot.amount - share * winners.length;
        for (const w of winners) add(w, share + (rem-- > 0 ? 1 : 0));
      }
    } else {
      const winner = this.seats.findIndex((s, i) => this.isLive(i));
      for (const pot of pots) add(winner, pot.amount);
    }

    this.pendingWinnings = [...winnings.entries()];
    const winners = this.pendingWinnings.map(([i, amount]) => ({
      seat: i, name: this.seats[i].name, amount, handName: showdown ? this.seats[i].handName : '',
    }));
    this.result = { winners, pots: pots.map((p) => p.amount), showdown, paid: false };
    this.phase = 'showdown';
    if (this.dealerMode === 'ai') {
      const names = winners.map((w) => `${w.name}さん`).join('と');
      this.say(`${names}の勝ちです！${showdown && winners[0] ? `（${winners[0].handName}）` : ''}`, false);
    }
    this.requestDealer('payout');
  }

  payout() {
    for (const [i, amt] of this.pendingWinnings || []) {
      const s = this.seats[i];
      s.stack += amt;
      this.log(`${s.name} が ${amt} チップを獲得${this.result.showdown ? `（${s.handName}）` : ''}`);
    }
    for (const s of this.seats) if (s && s.inHand) { s.total = 0; s.bet = 0; }
    this.pendingWinnings = null;
    this.result.paid = true;
    this.update();
    this.later(this.result.showdown ? this.delays.showdown : this.delays.uncontested, () => this.startHand());
  }

  // ---------- クライアント向けの表示データ ----------
  viewFor(pid) {
    const mySeat = this.seatIndexOf(pid);
    const pot = this.seats.reduce((a, s) => a + (s && s.inHand ? s.total - s.bet : 0), 0);
    const seats = this.seats.map((s, i) => {
      if (!s) return null;
      const visible = i === mySeat || (s.shown && !s.folded);
      return {
        name: s.name, stack: s.stack, bet: s.bet, folded: s.folded, allIn: s.allIn,
        inHand: s.inHand, sittingOut: s.sittingOut, connected: s.connected, leaving: s.leaving,
        isBot: s.isBot, level: s.isBot ? bot.LEVELS[s.level].label : '',
        lastAction: s.lastAction, handName: s.shown && !s.folded ? s.handName : '',
        dealt: s.dealt, drew: s.drew,
        cards: s.inHand && !(s.folded && i !== mySeat) ? (visible ? s.cards : s.cards.map(() => 'XX')) : [],
      };
    });
    const view = {
      id: this.id, name: this.name, variant: this.variant, variantName: this.rules.name,
      dealerMode: this.dealerMode, isPublic: this.isPublic, sb: this.sb, bb: this.bb, maxSeats: this.maxSeats,
      startingStack: this.startingStack, allowRebuy: this.allowRebuy, blindLevel: this.blindLevel + 1,
      blindUpMinutes: this.blindUpMs / 60000, nextBlindIn: this.nextBlindIn(), phase: this.phase, handNo: this.handNo,
      turnId: this.turnId, board: this.board, button: this.button, sbIdx: this.sbIdx, bbIdx: this.bbIdx,
      toAct: this.toAct, timeLeft: this.toAct >= 0 ? Math.max(0, this.deadline - Date.now()) : 0,
      actionTime: this.actionTime, currentBet: this.currentBet, pot, totalPot: this.totalPot(),
      dealerStep: this.dealerStep ? {
        kind: this.dealerStep, label: DEALER_LABELS[this.dealerStep],
        timeLeft: Math.max(0, this.dealerDeadline - Date.now()),
        mine: this.dealerMode === 'player' && mySeat !== -1 && mySeat === this.button,
      } : null,
      dealerMsg: this.dealerMsg,
      seats, mySeat, result: this.result, legal: null, drawTurn: false, myHand: '',
    };
    if (mySeat !== -1) {
      const me = this.seats[mySeat];
      if (this.inBetting && this.toAct === mySeat) view.legal = this.legal(mySeat);
      if (this.phase === 'draw' && !this.dealerStep && this.toAct === mySeat) view.drawTurn = true;
      const n = me.cards.length + this.board.length;
      if (me.inHand && !me.folded && n >= 5) view.myHand = evaluateBest([...me.cards, ...this.board]).name;
    }
    return view;
  }

  summary() {
    return {
      id: this.id, name: this.name, variant: this.variant, variantName: this.rules.name,
      dealerMode: this.dealerMode, sb: this.sb, bb: this.bb,
      startingStack: this.startingStack, actionTime: this.actionTime / 1000, allowRebuy: this.allowRebuy,
      blindUpMinutes: this.blindUpMs / 60000,
      players: this.seatedCount(), bots: this.seats.filter((s) => s && s.isBot).length,
      maxSeats: this.maxSeats, handNo: this.handNo,
    };
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.botTimer);
    clearTimeout(this.timer);
    clearTimeout(this.pendingTimer);
  }
}

module.exports = { Table, newDeck, VARIANTS };

    },
    "./hub": function (module, exports, require) {
'use strict';

// 部屋主のブラウザの中で動く「1部屋だけのサーバー」。
// server.js と同じメッセージをやりとりするので、画面側（app.js）はそのまま使える。
// 通信路は attach() に渡す { send(obj), close() } で、PeerJS でも手元の直結でもよい。
const crypto = require('crypto');
const { Table } = require('./game');

const STARTING_STACKS = [100, 250, 500, 1000, 1500, 2000];
const ACTION_TIMES = [10, 15, 20, 30, 45, 60];
const BLIND_UP_MINUTES = [0, 3, 5, 10, 15, 20, 30];
const RECONNECT_GRACE_MS = 2 * 60 * 1000;
const MAX_CONNECTIONS = 30;

function newRoomId() {
  return String(crypto.randomInt(100000, 1000000));
}

function cleanName(name) {
  const s = String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return s || `ゲスト${crypto.randomInt(1000, 10000)}`;
}

// 「部屋を作る」の入力を確かめて、Table の設定に直す（server.js の createTable と同じ条件）
function validateSettings(msg) {
  const variant = msg.variant === 'draw' ? 'draw' : 'holdem';
  const startingStack = Number(msg.startingStack);
  if (!STARTING_STACKS.includes(startingStack)) throw new Error('持ち金の設定が不正です');
  const sb = Math.floor(Number(msg.sb));
  const bb = Math.floor(Number(msg.bb));
  if (!(sb >= 1 && bb >= sb && bb <= startingStack / 5)) {
    throw new Error(`参加料は 小 ≥ 1、小 ≤ 大 ≤ ${startingStack / 5} にしてください`);
  }
  const maxSeats = Math.floor(Number(msg.maxSeats));
  const limit = variant === 'draw' ? 6 : 9;
  if (!(maxSeats >= 2 && maxSeats <= limit)) throw new Error(`人数は2〜${limit}人です`);
  const actionTime = Number(msg.actionTime);
  if (!ACTION_TIMES.includes(actionTime)) throw new Error('持ち時間が不正です');
  const blindUpMinutes = Number(msg.blindUpMinutes);
  if (!BLIND_UP_MINUTES.includes(blindUpMinutes)) throw new Error('参加料アップの設定が不正です');
  const botCount = Math.max(0, Math.min(Math.floor(Number(msg.botCount) || 0), maxSeats - 1));
  return {
    name: cleanName(msg.name || 'ポーカー部屋'),
    variant, dealerMode: msg.dealerMode === 'player' ? 'player' : 'ai',
    startingStack, sb, bb, maxSeats, actionTime, blindUpMinutes,
    allowRebuy: msg.allowRebuy !== false,
    botCount, botLevel: String(msg.botLevel || 'normal'), autoSit: !!msg.autoSit,
  };
}

class Hub {
  constructor(roomId, settings, tableOpts = {}) {
    this.players = new Map(); // token -> player
    this.connections = 0;
    this.closed = false;
    this.hostToken = null;
    this.settings = settings;
    this.table = new Table({
      id: roomId, name: settings.name, variant: settings.variant, dealerMode: settings.dealerMode,
      isPublic: false, startingStack: settings.startingStack,
      smallBlind: settings.sb, bigBlind: settings.bb, maxSeats: settings.maxSeats,
      actionTime: settings.actionTime * 1000, blindUpMinutes: settings.blindUpMinutes,
      allowRebuy: settings.allowRebuy, ...tableOpts,
    }, {
      update: (t) => { for (const p of this.inRoom()) this.send(p, { type: 'state', table: t.viewFor(p.id) }); },
      log: (t, text) => { for (const p of this.inRoom()) this.send(p, { type: 'log', text }); },
    });
    // AIプレイヤーを等間隔に座らせる（席0は部屋主用に空けておく）
    const n = this.table.maxSeats;
    for (let k = 0; k < settings.botCount; k++) {
      const level = settings.botLevel === 'mix' ? ['easy', 'normal', 'hard'][k % 3] : settings.botLevel;
      const even = Math.round(((k + 1) * n) / (settings.botCount + 1)) % n;
      this.table.addBot(level, even !== 0 && !this.table.seats[even] ? even : undefined);
    }
  }

  get roomId() { return this.table.id; }
  setRoomId(id) { this.table.id = id; this.table.update(); }
  inRoom() { return [...this.players.values()].filter((p) => p.inRoom); }
  send(p, msg) { if (p.conn) p.conn.send(msg); }

  // 部屋にいる人間（部屋主以外）が何人つながっているか
  guestCount() {
    return [...this.players.values()].filter((p) => p.conn && p.token !== this.hostToken).length;
  }

  // 新しい接続を受け入れる。返り値の receive / close を通信路から呼ぶ
  attach(conn, { isHost = false } = {}) {
    if (this.closed || this.connections >= MAX_CONNECTIONS) {
      conn.send({ type: 'error', message: '部屋が満員か、終了しています' });
      conn.close();
      return { receive() {}, close() {} };
    }
    this.connections++;
    let player = null;
    let bucket = 20;
    let open = true;
    const refill = setInterval(() => { bucket = Math.min(20, bucket + 10); }, 1000);

    const receive = (raw) => {
      if (!open || this.closed) return;
      if (--bucket < 0) return; // 送信しすぎは無視
      let msg = raw;
      if (typeof raw === 'string') { try { msg = JSON.parse(raw); } catch { return; } }
      if (!msg || typeof msg !== 'object') return;

      if (!player) {
        if (msg.type !== 'hello') return;
        player = this.hello(conn, msg, isHost);
        return;
      }
      try { this.handle(player, msg); }
      catch (e) { this.send(player, { type: 'error', message: e.message }); }
    };

    const close = () => {
      if (!open) return;
      open = false;
      this.connections--;
      clearInterval(refill);
      if (!player || player.conn !== conn) return;
      player.conn = null;
      if (player.inRoom) this.table.setConnected(player.id, false);
      const p = player;
      clearTimeout(p.disconnectTimer);
      p.disconnectTimer = setTimeout(() => {
        if (p.conn || this.closed) return;
        this.table.stand(p.id);
        this.players.delete(p.token);
      }, RECONNECT_GRACE_MS);
    };

    return { receive, close };
  }

  hello(conn, msg, isHost) {
    const token = typeof msg.token === 'string' && /^[a-f0-9]{32}$/.test(msg.token)
      ? msg.token : crypto.randomBytes(16).toString('hex');
    let player = this.players.get(token);
    if (player) {
      if (player.conn && player.conn !== conn) player.conn.close();
      clearTimeout(player.disconnectTimer);
    } else {
      player = { token, id: crypto.randomBytes(8).toString('hex'), name: cleanName(msg.name), conn: null, inRoom: false };
      this.players.set(token, player);
    }
    player.conn = conn;
    if (isHost) this.hostToken = token;
    this.send(player, { type: 'welcome', id: player.id, name: player.name, token });

    const first = !player.inRoom;
    player.inRoom = true;
    if (first && isHost && this.settings.autoSit) {
      const seat = this.table.seats[0] ? this.table.seats.findIndex((s) => !s) : 0;
      if (seat >= 0) this.table.sit(player.id, player.name, seat);
    }
    this.table.setConnected(player.id, true);
    this.send(player, { type: 'state', table: this.table.viewFor(player.id) });
    return player;
  }

  handle(player, msg) {
    const t = this.table;
    switch (msg.type) {
      case 'setName':
        player.name = cleanName(msg.name);
        this.send(player, { type: 'welcome', id: player.id, name: player.name });
        break;
      case 'joinTable':
        player.inRoom = true;
        this.send(player, { type: 'state', table: t.viewFor(player.id) });
        break;
      case 'leaveTable':
        t.stand(player.id);
        player.inRoom = false;
        this.send(player, { type: 'left' });
        break;
      case 'sit': t.sit(player.id, player.name, Number(msg.seat)); break;
      case 'stand': t.stand(player.id); break;
      case 'sitOut': t.setSittingOut(player.id, !!msg.value); break;
      case 'rebuy': t.rebuy(player.id); break;
      case 'action': t.act(player.id, String(msg.action), msg.amount); break;
      case 'dealer': t.dealerAction(player.id, msg.step ? String(msg.step) : null); break;
      case 'draw': t.declareDraw(player.id, msg.discards); break;
      case 'addBot': t.addBot(String(msg.level || 'normal')); break;
      case 'removeBot': t.removeBot(Number(msg.seat)); break;
      case 'chat': {
        const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
        if (!text) break;
        for (const p of this.inRoom()) this.send(p, { type: 'chat', name: player.name, text });
        break;
      }
      default:
        throw new Error('不明なメッセージです');
    }
  }

  // 部屋を閉じる（部屋主が退出したとき）
  destroy() {
    if (this.closed) return;
    for (const p of this.players.values()) {
      if (p.conn && p.token !== this.hostToken) this.send(p, { type: 'closed' });
      clearTimeout(p.disconnectTimer);
    }
    this.closed = true;
    this.table.destroy();
  }
}

module.exports = { Hub, validateSettings, newRoomId, cleanName };

    },
  };
  const cache = {};
  function require(name) {
    if (cache[name]) return cache[name].exports;
    if (!defs[name]) throw new Error('module not found: ' + name);
    const module = { exports: {} };
    cache[name] = module;
    defs[name](module, module.exports, require);
    return module.exports;
  }
  window.PokerHub = require('./hub');
})();
