'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無視 */ } },
};
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const STACKS = [100, 250, 500, 1000, 1500, 2000];
const BLIND_PRESETS = [[1, 2], [2, 4], [5, 10], [10, 20], [25, 50], [50, 100], [100, 200]];

let ws = null;
let me = { id: null, name: store.get('poker-name') || '' };
let table = null;
let turnKey = '';
let localDeadline = 0;
let pendingRoom = new URLSearchParams(location.search).get('room');

// サーバーなしで、部屋主のブラウザが部屋を動かす版（GitHub Pages など）。engine.js があれば有効
const P2P = typeof window.PokerHub !== 'undefined';
// P2P版はタブごとに別の人として扱う（同じPCの2つのタブで遊べるように）。リロードしても同じ人のまま
const tokenStore = P2P ? {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 無視 */ } },
} : store;
let hub = null;      // 自分が部屋主のときの部屋
let hostNet = null;  // 部屋主としての待ち受け
let link = null;     // 部屋との通信路 { send, close }
let joining = null;  // 接続中の参加処理
let roomOnline = false;

// ---------- 効果音 ----------
let audio = null;
let soundOn = store.get('poker-sound') !== '0';
document.addEventListener('pointerdown', () => {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* 効果音なし */ }
}, { passive: true });
function sfx(kind) {
  if (!soundOn || !audio || audio.state !== 'running') return;
  const now = audio.currentTime;
  if (kind === 'card') {
    // カードがフェルトをすべる音
    const len = Math.floor(audio.sampleRate * 0.09);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = audio.createBufferSource();
    src.buffer = buf;
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 0.7;
    const g = audio.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(audio.destination);
    src.start(now);
  } else {
    // チップが当たるカチャッという音
    [0, 0.045, 0.085].forEach((t, k) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = 3200 + k * 600 + Math.random() * 300;
      g.gain.setValueAtTime(0.12, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.05);
      o.connect(g).connect(audio.destination);
      o.start(now + t);
      o.stop(now + t + 0.06);
    });
  }
}
function renderSoundBtn() { $('#soundBtn').textContent = soundOn ? '🔊' : '🔇'; }
$('#soundBtn').onclick = () => { soundOn = !soundOn; store.set('poker-sound', soundOn ? '1' : '0'); renderSoundBtn(); };
renderSoundBtn();

// ---------- 通信 ----------
function connect() {
  if (P2P) { initP2P(); return; }
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => {
    setStatus('');
    send({ type: 'hello', token: tokenStore.get('poker-token'), name: me.name });
  };
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = (e) => {
    if (e.code === 4000) { setStatus('別のタブで接続されました'); return; }
    setStatus('接続が切れました。再接続中…');
    setTimeout(connect, 1500);
  };
}
function send(msg) {
  if (P2P) { if (link) link.send(msg); return; }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function onMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      me.id = msg.id;
      me.name = msg.name;
      if (msg.token) tokenStore.set('poker-token', msg.token);
      store.set('poker-name', me.name);
      $('#nameInput').value = me.name;
      break;
    case 'lobby':
      renderLobby(msg.tables);
      if (pendingRoom) {
        send({ type: 'joinTable', tableId: pendingRoom });
        pendingRoom = null;
        history.replaceState(null, '', location.pathname);
      }
      break;
    case 'state': {
      const prev = table;
      const fresh = !prev || prev.id !== msg.table.id;
      table = msg.table;
      if (fresh) { $('#logBox').innerHTML = ''; showView('game'); closeModals(); }
      const anims = fresh ? null : planAnimations(prev, table);
      renderTable();
      if (anims) requestAnimationFrame(() => runAnimations(anims));
      break;
    }
    case 'left':
      table = null;
      showView('lobby');
      break;
    case 'closed':
      backToLobby('部屋主が部屋を閉じました');
      break;
    case 'log': {
      const t = msg.text;
      addLog(t.startsWith('---') ? 'hand-start' : /^(AI)?ディーラー:/.test(t) ? 'dealer' : 'sys', esc(t));
      break;
    }
    case 'chat':
      addLog('chat', `<b>${esc(msg.name)}</b>: ${esc(msg.text)}`);
      break;
    case 'error':
      flash(msg.message);
      if (table && (table.legal || table.drawTurn)) renderActionBar(true);
      break;
  }
}

// ---------- 共通UI ----------
function showView(name) {
  $('#lobby').classList.toggle('hidden', name !== 'lobby');
  $('#game').classList.toggle('hidden', name !== 'game');
}
function setStatus(text) {
  $('#status').textContent = text;
  $('#status').classList.toggle('hidden', !text);
}
let flashTimer = null;
function flash(text) {
  setStatus(text);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => setStatus(''), 2600);
}
function addLog(cls, html) {
  const box = $('#logBox');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  const div = document.createElement('div');
  div.className = cls;
  div.innerHTML = html;
  box.appendChild(div);
  while (box.children.length > 300) box.firstChild.remove();
  if (atBottom) box.scrollTop = box.scrollHeight;
}

// ---------- カード・チップ・手の絵 ----------
const hiddenKeys = new Set();
function cardHtml(c, size = '', key = '', extra = '') {
  const cls = ['card', size, extra];
  const k = key ? ` data-key="${key}"` : '';
  if (key && hiddenKeys.has(key)) cls.push('pending');
  if (c === 'XX') return `<div class="${cls.join(' ')} back"${k}></div>`;
  const r = c[0] === 'T' ? '10' : c[0];
  const s = SUIT[c[1]];
  if (c[1] === 'h' || c[1] === 'd') cls.push('red');
  const center = 'JQK'.includes(c[0]) ? `<div class="face"><b>${r}</b><i>${s}</i></div>` : `<div class="pip">${s}</div>`;
  return `<div class="${cls.join(' ')}"${k}><div class="ix tl">${r}<i>${s}</i></div>${center}<div class="ix br">${r}<i>${s}</i></div></div>`;
}

const DENOMS = [1000, 500, 100, 25, 5, 1];
function chipsHtml(amount, max = 6) {
  const chips = [];
  let left = amount;
  for (const d of DENOMS) {
    while (left >= d && chips.length < max) { chips.push(d); left -= d; }
  }
  return `<span class="chips">${chips.map((d) => `<span class="chip c${d}"></span>`).join('')}</span>`;
}

// ディーラーの右手（指先が上）。hold = 'card' | 'chips' | ''
function handSvg(hold = '', cls = '') {
  const held = hold === 'card'
    ? `<g class="held"><rect x="25" y="-28" width="50" height="70" rx="4" fill="#fff" stroke="#bbb"/>
        <rect x="29" y="-24" width="42" height="62" rx="2" fill="url(#hs-back)"/></g>`
    : hold === 'chips'
      ? `<g class="held">${[0, 1, 2, 3].map((k) => `<ellipse cx="50" cy="${20 - k * 6}" rx="21" ry="9" fill="${['#d3172f', '#13893f', '#1b1b1b', '#d3172f'][k]}" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 5"/>`).join('')}</g>`
      : '';
  const finger = (x, y, w, h, rot, cx) => `
    <g transform="rotate(${rot} ${cx} 76)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="url(#hs-finger)"/>
      <rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="11" rx="4" fill="url(#hs-nail)" stroke="rgba(150,80,50,.35)" stroke-width=".6"/>
      <path d="M${x + 2.5} ${y + 19} q${w / 2 - 2.5} 3 ${w - 5} 0 M${x + 2.5} ${y + 33} q${w / 2 - 2.5} 3 ${w - 5} 0" stroke="rgba(140,70,40,.35)" stroke-width="1" fill="none"/>
    </g>`;
  return `<svg class="hand-svg ${cls}" viewBox="0 -30 100 220" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hs-skin" x1="0" x2="1"><stop offset="0" stop-color="#c98a5e"/><stop offset=".35" stop-color="#f1c4a0"/><stop offset=".7" stop-color="#e8b28a"/><stop offset="1" stop-color="#b9774d"/></linearGradient>
      <linearGradient id="hs-finger" x1="0" x2="1"><stop offset="0" stop-color="#c4845a"/><stop offset=".5" stop-color="#f3caa6"/><stop offset="1" stop-color="#c07e55"/></linearGradient>
      <linearGradient id="hs-nail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9df"/><stop offset="1" stop-color="#eec3ad"/></linearGradient>
      <pattern id="hs-back" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#c8102e"/><rect width="1.2" height="6" fill="#ff8a98"/></pattern>
    </defs>
    ${held}
    ${finger(68, 36, 10, 40, 6, 73)}
    ${finger(55.5, 22, 12, 54, 2, 61)}
    ${finger(29, 26, 12, 50, -4, 35)}
    ${finger(42, 18, 12.5, 58, 0, 48)}
    <path d="M28 104 C18 98 11 86 12 74 C13 66 20 63 24 69 C28 77 31 86 37 92 Z" fill="url(#hs-finger)"/>
    <rect x="13" y="66" width="9" height="9" rx="4" transform="rotate(-25 17 70)" fill="url(#hs-nail)" stroke="rgba(150,80,50,.35)" stroke-width=".6"/>
    <path d="M30 140 C28 120 24 104 25 86 C26 74 30 68 36 66 L70 64 C76 66 79 74 78 86 C77 104 72 122 70 140 Z" fill="url(#hs-skin)"/>
    <g fill="rgba(255,255,255,.22)"><ellipse cx="35" cy="72" rx="5" ry="3"/><ellipse cx="48" cy="68" rx="5" ry="3"/><ellipse cx="61" cy="70" rx="5" ry="3"/><ellipse cx="73" cy="74" rx="4" ry="2.6"/></g>
    <path d="M40 80 L44 118 M52 78 L52 120 M63 80 L60 118" stroke="rgba(150,80,50,.18)" stroke-width="2" fill="none"/>
    <rect x="24" y="134" width="52" height="18" rx="3" fill="#fbfbfb" stroke="#d8d8d8"/>
    <circle cx="68" cy="143" r="3.2" fill="#f5c542" stroke="#9c7012"/>
    <path d="M20 190 L23 150 L77 150 L80 190 Z" fill="#161616"/>
    <path d="M23 150 L77 150 L76 156 L24 156 Z" fill="#2c2c2c"/>
  </svg>`;
}

// ---------- ロビー ----------
function renderLobby(tables) {
  const list = $('#tableList');
  if (!tables.length) { list.innerHTML = '<p class="sub">公開中の部屋はありません。「部屋を作る」から作ってみましょう！</p>'; return; }
  list.innerHTML = tables.map((t) => `
    <div class="table-item">
      <div class="info">
        <div class="name">${esc(t.name)}</div>
        <div class="meta">部屋番号 ${esc(t.id)} ・ 着席 ${t.players}/${t.maxSeats}人 ・ 見ている人 ${t.watchers}人</div>
        <div class="tags">
          <span class="game">${esc(t.variantName)}</span>
          <span class="dealer">${t.dealerMode === 'ai' ? '🤖 AIディーラー' : '🙋 交代でディーラー'}</span>
          ${t.bots ? `<span class="ai">AIプレイヤー ${t.bots}人</span>` : ''}
          <span>持ち金 ${t.startingStack}</span>
          <span>参加料 ${t.sb}/${t.bb}</span>
          <span>${t.blindUpMinutes ? `${t.blindUpMinutes}分ごとに参加料アップ` : '参加料ずっと同じ'}</span>
          <span>${t.allowRebuy ? 'リバイあり' : 'リバイなし'}</span>
        </div>
      </div>
      <button class="btn primary" data-join="${esc(t.id)}">参加</button>
    </div>`).join('');
}
$('#tableList').addEventListener('click', (e) => {
  const id = e.target.closest('[data-join]')?.dataset.join;
  if (id) send({ type: 'joinTable', tableId: id });
});
$('#nameSave').onclick = () => {
  if (P2P) {
    me.name = $('#nameInput').value.trim().slice(0, 16);
    store.set('poker-name', me.name);
    if (!link) { flash('名前を保存しました'); return; }
  }
  send({ type: 'setName', name: $('#nameInput').value });
  flash('名前を保存しました');
};
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nameSave').click(); });

// モーダル
function openModal(id) { closeModals(); $(id).classList.remove('hidden'); }
function closeModals() { $$('.modal').forEach((m) => m.classList.add('hidden')); }
$$('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.classList.add('hidden'); });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModals(); $('#rulebook').classList.add('hidden'); }
});

// 部屋を探す
$('#openFind').onclick = () => { openModal('#findModal'); $('#findInput').value = ''; $('#findInput').focus(); };
$('#findInput').oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); };
$('#findForm').onsubmit = (e) => {
  e.preventDefault();
  const id = $('#findInput').value;
  if (id.length !== 6) { flash('6桁の部屋番号を入れてください'); return; }
  if (P2P) { closeModals(); joinRoom(id); return; }
  send({ type: 'joinTable', tableId: id });
};

// 部屋を作る
let blindsTouched = false;
const selectedVariant = () => $('input[name=variant]:checked').value;
const selectedStack = () => Number($('input[name=stack]:checked').value);
$('#stackChoices').innerHTML = STACKS.map((v) => `
  <label><input type="radio" name="stack" value="${v}" ${v === 500 ? 'checked' : ''}><span>${chipsHtml(v, 1)}${v}</span></label>`).join('');

function currentBlinds() {
  const v = $('#newBlinds').value;
  return v === 'custom' ? [Number($('#newSb').value), Number($('#newBb').value)] : v.split('/').map(Number);
}
function refreshCreateForm() {
  const stack = selectedStack();
  const blinds = BLIND_PRESETS.filter(([, bb]) => bb <= stack / 5);
  const prev = $('#newBlinds').value;
  const best = [...blinds].reverse().find(([, bb]) => bb <= stack / 50) || blinds[0];
  $('#newBlinds').innerHTML = blinds.map(([sb, bb]) => `<option value="${sb}/${bb}">小 ${sb} / 大 ${bb}</option>`).join('')
    + '<option value="custom">自分で決める…</option>';
  const keep = blindsTouched && (blinds.some(([sb, bb]) => `${sb}/${bb}` === prev) || prev === 'custom');
  $('#newBlinds').value = keep ? prev : `${best[0]}/${best[1]}`;
  $$('.custom-blind').forEach((el) => el.classList.toggle('hidden', $('#newBlinds').value !== 'custom'));

  const max = selectedVariant() === 'draw' ? 6 : 9;
  const seatsPrev = Number($('#newSeats').value) || max;
  const opts = selectedVariant() === 'draw' ? [2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 7, 8, 9];
  $('#newSeats').innerHTML = opts.map((n) => `<option value="${n}">${n}人${n === 2 ? '（1対1）' : ''}</option>`).join('');
  $('#newSeats').value = Math.min(seatsPrev, max);

  const seats = Number($('#newSeats').value);
  const botsPrev = Number($('#newBots').value) || 0;
  $('#newBots').innerHTML = Array.from({ length: seats }, (_, n) => `<option value="${n}">${n === 0 ? 'なし' : `${n}人`}</option>`).join('');
  $('#newBots').value = Math.min(botsPrev, seats - 1);

  const [, bb] = currentBlinds();
  $('#blindHint').textContent = bb > 0
    ? `持ち金 ${stack} は、参加料（大）${bb} の ${Math.floor(stack / bb)} 回分です。50〜100回分くらいがおすすめ。`
    : '';
}
$('#openCreate').onclick = () => { openModal('#createModal'); blindsTouched = false; refreshCreateForm(); };
$('#stackChoices').onchange = refreshCreateForm;
$('#newBlinds').onchange = () => { blindsTouched = true; refreshCreateForm(); };
$('#newSb').oninput = refreshCreateForm;
$('#newSeats').onchange = refreshCreateForm;
$('#newBb').oninput = refreshCreateForm;
$$('input[name=variant]').forEach((r) => r.addEventListener('change', () => {
  refreshCreateForm();
  openRules(selectedVariant()); // 選んだゲームのルールを自動で表示
}));
$('#variantRules').onclick = () => openRules(selectedVariant());
$('#createForm').onsubmit = (e) => {
  e.preventDefault();
  const [sb, bb] = currentBlinds();
  createRoom({
    type: 'createTable',
    name: $('#newName').value,
    variant: selectedVariant(),
    dealerMode: $('input[name=dealerMode]:checked').value,
    startingStack: selectedStack(),
    sb, bb,
    maxSeats: Number($('#newSeats').value),
    actionTime: Number($('#newTime').value),
    blindUpMinutes: Number($('#newBlindUp').value),
    allowRebuy: $('#newRebuy').value === '1',
    isPublic: $('#newPublic').value === '1',
    botCount: Number($('#newBots').value),
    botLevel: $('#newBotLevel').value,
    autoSit: Number($('#newBots').value) > 0,
  });
};

// ---------- AIと対戦（かんたん設定） ----------
function bestBlinds(stack) {
  const blinds = BLIND_PRESETS.filter(([, bb]) => bb <= stack / 5);
  return [...blinds].reverse().find(([, bb]) => bb <= stack / 50) || blinds[0];
}
function refreshAiForm() {
  const max = $('input[name=aiVariant]:checked').value === 'draw' ? 5 : 8;
  const prev = Number(($('input[name=aiCount]:checked') || {}).value) || 3;
  $('#aiCountChoices').innerHTML = Array.from({ length: max }, (_, k) => k + 1).map((n) => `
    <label><input type="radio" name="aiCount" value="${n}" ${n === Math.min(prev, max) ? 'checked' : ''}><span>🤖 ${n}人</span></label>`).join('');
}
$('#aiStackChoices').innerHTML = STACKS.map((v) => `
  <label><input type="radio" name="aiStack" value="${v}" ${v === 500 ? 'checked' : ''}><span>${chipsHtml(v, 1)}${v}</span></label>`).join('');
$('#openAi').onclick = () => { openModal('#aiModal'); refreshAiForm(); };
$$('input[name=aiVariant]').forEach((r) => r.addEventListener('change', refreshAiForm));
$('#aiForm').onsubmit = (e) => {
  e.preventDefault();
  const variant = $('input[name=aiVariant]:checked').value;
  const stack = Number($('input[name=aiStack]:checked').value);
  const [sb, bb] = bestBlinds(stack);
  createRoom({
    type: 'createTable',
    name: `${me.name || 'あなた'} vs AI`,
    variant,
    dealerMode: 'ai',
    startingStack: stack,
    sb, bb,
    maxSeats: variant === 'draw' ? 6 : 9,
    actionTime: 30,
    blindUpMinutes: 0,
    allowRebuy: true,
    isPublic: false,
    botCount: Number($('input[name=aiCount]:checked').value),
    botLevel: $('input[name=aiLevel]:checked').value,
    autoSit: true,
  });
};

// ---------- ルールブック ----------
let rbTab = 'holdem';
function renderRulebook() {
  $('#rbTabs').innerHTML = RULEBOOK.map((r) => `<button data-tab="${r.id}" class="${r.id === rbTab ? 'on' : ''}">${r.title}</button>`).join('');
  const page = RULEBOOK.find((r) => r.id === rbTab);
  $('#rbBody').innerHTML = page.html.replace(/\[\[([^\]]+)\]\]/g, (_, cards) =>
    `<span class="mini-cards">${cards.trim().split(/\s+/).map((c) => cardHtml(c, 'tiny')).join('')}</span>`);
  $('#rbBody').scrollTop = 0;
}
function openRules(tab) {
  rbTab = tab || rbTab;
  renderRulebook();
  $('#rulebook').classList.remove('hidden');
}
$('#rbTabs').onclick = (e) => { const tab = e.target.dataset.tab; if (tab) { rbTab = tab; renderRulebook(); } };
$('#rbClose').onclick = () => $('#rulebook').classList.add('hidden');
$('#openRules').onclick = () => openRules('holdem');
$('#gameRules').onclick = () => openRules(table ? table.variant : 'holdem');

// ---------- テーブル ----------
$('#aiMenuBtn').onclick = (e) => { e.stopPropagation(); $('#aiMenu').classList.toggle('hidden'); };
$('#aiMenu').onclick = (e) => {
  const level = e.target.closest('[data-addbot]')?.dataset.addbot;
  if (!level) return;
  send({ type: 'addBot', level });
  $('#aiMenu').classList.add('hidden');
};
document.addEventListener('click', (e) => { if (!e.target.closest('.ai-menu-wrap')) $('#aiMenu').classList.add('hidden'); });
$('#leaveBtn').onclick = () => { if (P2P) leaveRoom(); else send({ type: 'leaveTable' }); };
$('#chatForm').onsubmit = (e) => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (text) send({ type: 'chat', text });
  $('#chatInput').value = '';
};
$('#roomNo').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${table.id}`;
  try { await navigator.clipboard.writeText(url); flash(`招待リンクをコピーしました（部屋番号 ${table.id}）`); }
  catch { flash(`部屋番号は ${table.id} です`); }
};

// 席の位置：上はディーラー用に空け、自分は一番下
const TOP_GAP = (70 * Math.PI) / 180;
function seatAngle(i) {
  const n = table.maxSeats;
  const mine = table.mySeat >= 0 ? table.mySeat : 0;
  const m = Math.floor(n / 2);
  const slot = (m + i - mine + n * 2) % n;
  const step = (2 * Math.PI - TOP_GAP) / n;
  return Math.PI / 2 + (slot - (n - 1) / 2) * step;
}
function seatPos(i, rx, ry, da = 0) {
  const a = seatAngle(i) + da;
  return { x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
}
const SEAT_R = [50, 55];
const BET_R = [33, 30];

function renderTable() {
  const t = table;
  $('#tableName').textContent = t.name;
  const roomLabel = hub && !roomOnline ? '部屋番号（友達はまだ入れません）' : '部屋番号';
  $('#roomNo').innerHTML = `<small>${roomLabel}</small>${esc(t.id)}`;
  $('#printRule').textContent = `${t.variantName} ・ 参加料 ${t.sb} / ${t.bb}`;
  renderTableInfo();
  renderDealerStation();

  // ボード・ポット
  $('#board').innerHTML = t.board.map((c, k) => cardHtml(c, '', `b${k}`)).join('');
  $('#pot').innerHTML = t.pot > 0 ? `${chipsHtml(t.pot, 5)}<span>ポット ${t.pot}</span>` : '';
  $('#message').textContent = centerMessage();

  // 席
  const winners = new Set(t.result ? t.result.winners.map((w) => w.seat) : []);
  const html = [];
  t.seats.forEach((s, i) => {
    const p = seatPos(i, ...SEAT_R);
    if (!s) {
      const inner = t.mySeat < 0 ? `<button class="btn primary small sit-btn" data-sit="${i}">ここに座る</button>` : '空席';
      html.push(`<div class="seat empty" style="left:${p.x}%;top:${p.y}%"><div class="plate">${inner}</div></div>`);
      return;
    }
    const cls = ['seat'];
    if (i === t.mySeat) cls.push('me');
    if (i === t.toAct) cls.push('acting');
    if (s.folded || s.sittingOut) cls.push('folded');
    if (winners.has(i)) cls.push('winner');
    if (s.isBot) cls.push('bot');
    const size = i === t.mySeat ? '' : 'small';
    const status = !s.connected ? '<div class="off">オフライン</div>' : s.leaving ? '<div class="off">退席します</div>' : s.sittingOut ? '<div class="off">休憩中</div>' : '';
    const tag = s.handName ? `<div class="tag hand">${esc(s.handName)}</div>`
      : s.lastAction ? `<div class="tag">${esc(s.lastAction)}</div>` : '';
    html.push(`
      <div class="${cls.join(' ')}" style="left:${p.x}%;top:${p.y}%">
        <div class="cards">${s.cards.map((c, k) => cardHtml(c, size, `s${i}-${k}`)).join('')}</div>
        <div class="plate" data-plate="${i}">
          ${s.isBot ? `<button class="rm-bot" data-rmbot="${i}" title="このAIを外す">×</button>` : ''}
          <div class="nm">${esc(s.name)}</div>
          ${s.isBot ? `<div class="ai-tag">AI・${esc(s.level)}</div>` : ''}
          <div class="st">${s.allIn && t.phase !== 'showdown' ? 'オールイン' : `<span class="chip c25"></span>${s.stack}`}</div>
          ${status}
          ${i === t.toAct ? '<div class="tm" data-timer></div>' : ''}
        </div>
        ${tag}
      </div>`);
    if (s.bet > 0) {
      const b = seatPos(i, ...BET_R);
      html.push(`<div class="bet" style="left:${b.x}%;top:${b.y}%">${chipsHtml(s.bet, 4)}<span>${s.bet}</span></div>`);
    }
  });
  if (t.button >= 0 && t.seats[t.button] && t.phase !== 'waiting') {
    const d = seatPos(t.button, 38, 37, 0.22);
    html.push(`<div class="dealer-btn" title="ディーラー" style="left:${d.x}%;top:${d.y}%">D</div>`);
  }
  $('#seats').innerHTML = html.join('');
  $('#aiMenuBtn').disabled = t.seats.every(Boolean);

  renderSeatControls();
  renderActionBar();
}

function centerMessage() {
  const t = table;
  if (t.phase === 'waiting') {
    const mine = t.mySeat >= 0 ? t.seats[t.mySeat] : null;
    if (mine && mine.stack === 0) return t.allowRebuy ? 'チップがなくなりました。上の「チップをもらう」で再開できます' : 'チップがなくなりました';
    if (mine && mine.sittingOut) return '休憩中です。上の「復帰する」で再開できます';
    const ready = t.seats.filter((s) => s && s.stack > 0 && !s.sittingOut);
    if (ready.length < 2) return 'あと1人以上座ると始まります';
    if (!ready.some((s) => !s.isBot)) return '人間のプレイヤーが座ると始まります';
    return 'まもなく始まります…';
  }
  if (t.result) {
    const text = t.result.winners.map((w) => `${w.name} が ${w.amount} 獲得${w.handName ? `（${w.handName}）` : ''}`).join(' / ');
    return t.result.paid ? text : `${text} — チップを渡しています`;
  }
  if (t.dealerStep && t.dealerMode === 'player' && !t.dealerStep.mine) {
    const d = t.seats[t.button];
    return `ディーラーの ${d ? d.name : ''} さんが「${t.dealerStep.label}」を待っています`;
  }
  if (t.phase === 'draw' && t.toAct >= 0 && t.toAct !== t.mySeat) {
    return `${t.seats[t.toAct].name} さんが交換するカードを選んでいます`;
  }
  return '';
}

function renderDealerStation() {
  const t = table;
  const tray = '<div class="tray">' + ['c-gold', 'c-purple', 'c-black', 'c-black', 'c-green', 'c-green', 'c-red', 'c-red', 'c-red', '', '', '']
    .map((c) => `<i class="${c}"></i>`).join('') + '</div>';
  const name = t.dealerMode === 'ai'
    ? '🤖 AI DEALER'
    : `ディーラー: ${t.button >= 0 && t.seats[t.button] ? esc(t.seats[t.button].name) : '—'}`;
  const hands = t.dealerMode === 'ai' ? `<div class="dealer-hands">${handSvg('', 'l')}${handSvg('', 'r')}</div>` : '';
  const speech = t.dealerMsg && t.phase !== 'waiting' ? `<div class="speech">${esc(t.dealerMsg)}</div>` : '';
  $('#dealerStation').innerHTML = `${tray}<div class="dealer-plate" id="dealerOrigin">${name}</div>${hands}${speech}`;
}

$('#seats').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rmbot]')?.dataset.rmbot;
  if (rm !== undefined) { send({ type: 'removeBot', seat: Number(rm) }); return; }
  const seat = e.target.closest('[data-sit]')?.dataset.sit;
  if (seat !== undefined) send({ type: 'sit', seat: Number(seat) });
});

function renderSeatControls() {
  const t = table;
  const box = $('#seatControls');
  if (t.mySeat < 0) { box.innerHTML = '<span class="sub" style="color:#ffd98a">観戦中 — 空いている席の「ここに座る」で参加</span>'; return; }
  const s = t.seats[t.mySeat];
  const parts = [];
  const inHand = s.inHand && t.phase !== 'waiting' && t.phase !== 'showdown';
  if (s.stack === 0 && !inHand) {
    parts.push(t.allowRebuy
      ? `<button class="btn primary small" data-ctl="rebuy">チップをもらう（${t.startingStack}）</button>`
      : '<span class="sub" style="color:#ffd98a">チップがなくなりました</span>');
  }
  parts.push(`<button class="btn small" data-ctl="sitout">${s.sittingOut ? '復帰する' : '休憩する'}</button>`);
  parts.push('<button class="btn small" data-ctl="stand">席を立つ</button>');
  box.innerHTML = parts.join('');
}
$('#seatControls').addEventListener('click', (e) => {
  const ctl = e.target.closest('[data-ctl]')?.dataset.ctl;
  const t = table;
  if (!ctl || !t || t.mySeat < 0) return;
  const s = t.seats[t.mySeat];
  if (ctl === 'stand') send({ type: 'stand' });
  if (ctl === 'sitout') send({ type: 'sitOut', value: !s.sittingOut });
  if (ctl === 'rebuy') send({ type: 'rebuy' });
});

// ---------- 操作バー ----------
let drawPicks = new Set();
let dealerKey = '';
let dealerDeadline = 0;
let dealerTotal = 1;

function renderActionBar(force = false) {
  const t = table;
  const L = t.legal;
  $('#myHand').textContent = t.myHand ? `今のあなたの役: ${t.myHand}` : '';

  // ディーラー役
  const ds = t.dealerStep && t.dealerStep.mine ? t.dealerStep : null;
  $('#dealerBar').classList.toggle('hidden', !ds);
  if (ds) {
    const key = `${t.handNo}:${ds.kind}`;
    if (key !== dealerKey) { dealerKey = key; dealerTotal = Math.max(1, ds.timeLeft); }
    dealerDeadline = Date.now() + ds.timeLeft;
    $('#dealerBtn').innerHTML = `<b>${esc(ds.label)}</b><small>押さないと自動で進みます</small>`;
  }

  // カード交換
  $('#drawBar').classList.toggle('hidden', !t.drawTurn);
  if (t.drawTurn) {
    localDeadline = Date.now() + t.timeLeft;
    const key = `draw:${t.handNo}:${t.turnId}`;
    if (key !== turnKey || force) { turnKey = key; if (!force) drawPicks = new Set(); }
    renderDrawCards();
  }

  if (!L) { $('#actionBar').classList.add('hidden'); if (!t.drawTurn) turnKey = ''; return; }

  localDeadline = Date.now() + t.timeLeft;
  const key = `${t.handNo}:${t.turnId}`;
  $('#actionBar').classList.remove('hidden');
  if (key === turnKey && !force) return; // 同じ手番なら入力中の値を保持
  turnKey = key;

  const s = t.seats[t.mySeat];
  $('#callBtn').innerHTML = L.canCheck
    ? '<b>様子見</b><small>チェック</small>'
    : L.toCall >= s.stack
      ? `<b>全部出す ${L.toCall}</b><small>コール（オールイン）</small>`
      : `<b>同額を出す ${L.toCall}</b><small>コール</small>`;
  $('#raiseBox').classList.toggle('hidden', !L.canRaise);
  if (L.canRaise) {
    const r = $('#raiseRange');
    const inp = $('#raiseInput');
    r.min = inp.min = L.minTo;
    r.max = inp.max = L.maxTo;
    r.step = 1;
    setRaise(L.minTo);
  }
}

function raiseLabel(v) {
  const L = table.legal;
  if (v >= L.maxTo) return `<b>全部賭ける ${L.maxTo}</b><small>オールイン</small>`;
  return L.isBet ? `<b>${v} 賭ける</b><small>ベット</small>` : `<b>${v} に上乗せ</b><small>レイズ</small>`;
}
function setRaise(v) {
  const L = table.legal;
  v = Math.max(L.minTo, Math.min(L.maxTo, Math.floor(Number(v) || 0)));
  $('#raiseRange').value = v;
  $('#raiseInput').value = v;
  $('#raiseBtn').innerHTML = raiseLabel(v);
}
$('#raiseRange').oninput = (e) => setRaise(e.target.value);
$('#raiseInput').oninput = (e) => {
  const v = Math.floor(Number(e.target.value) || 0);
  $('#raiseRange').value = v;
  $('#raiseBtn').innerHTML = raiseLabel(v);
};
$('#raiseInput').onchange = (e) => setRaise(e.target.value);
document.querySelector('.presets').addEventListener('click', (e) => {
  const preset = e.target.dataset.preset;
  if (!preset || !table.legal) return;
  const L = table.legal;
  const potAfterCall = table.totalPot + L.toCall;
  const base = table.currentBet;
  const map = {
    min: L.minTo,
    half: base + potAfterCall / 2,
    three: base + (potAfterCall * 3) / 4,
    pot: base + potAfterCall,
    all: L.maxTo,
  };
  setRaise(map[preset]);
});

function act(action, amount) {
  send({ type: 'action', action, amount });
  $('#actionBar').classList.add('hidden');
}
$('#foldBtn').onclick = () => act('fold');
$('#callBtn').onclick = () => act(table.legal.canCheck ? 'check' : 'call');
$('#raiseBtn').onclick = () => act('raise', Number($('#raiseInput').value));

function renderDrawCards() {
  const cards = table.seats[table.mySeat].cards;
  $('#drawCards').innerHTML = cards.map((c, k) => cardHtml(c, '', '', drawPicks.has(k) ? 'pick' : '').replace('<div class="card', `<div data-pick="${k}" class="card`)).join('');
  const n = drawPicks.size;
  $('#drawBtn').disabled = n === 0;
  $('#drawBtn').innerHTML = `<b>${n}枚 交換する</b><small>選んだカードを捨てて引く</small>`;
}
$('#drawCards').onclick = (e) => {
  const k = e.target.closest('[data-pick]')?.dataset.pick;
  if (k === undefined) return;
  const n = Number(k);
  if (drawPicks.has(n)) drawPicks.delete(n); else drawPicks.add(n);
  sfx('card');
  renderDrawCards();
};
$('#standPat').onclick = () => { send({ type: 'draw', discards: [] }); $('#drawBar').classList.add('hidden'); };
$('#drawBtn').onclick = () => { send({ type: 'draw', discards: [...drawPicks] }); $('#drawBar').classList.add('hidden'); };
$('#dealerBtn').onclick = () => { send({ type: 'dealer', step: table.dealerStep && table.dealerStep.kind }); $('#dealerBar').classList.add('hidden'); };

// ---------- 情報表示・タイマー ----------
let blindDeadline = 0;
function renderTableInfo() {
  const t = table;
  blindDeadline = t.nextBlindIn != null ? Date.now() + t.nextBlindIn : 0;
  updateTableInfo();
}
function updateTableInfo() {
  const t = table;
  if (!t) return;
  let text = `${t.variantName} ・ 参加料 小${t.sb} / 大${t.bb} ・ 第${t.handNo}ゲーム ・ ${t.dealerMode === 'ai' ? 'AIディーラー' : '交代でディーラー'}`;
  if (t.blindUpMinutes) {
    text += ` ・ レベル${t.blindLevel}`;
    if (blindDeadline) {
      const sec = Math.max(0, Math.ceil((blindDeadline - Date.now()) / 1000));
      text += `（次の参加料アップまで ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}）`;
    }
  }
  $('#tableInfo').textContent = text;
}
setInterval(updateTableInfo, 1000);

setInterval(() => {
  if (!table) return;
  if (table.toAct >= 0) {
    const left = Math.max(0, (localDeadline || Date.now() + table.timeLeft) - Date.now());
    const pct = Math.min(100, (left / table.actionTime) * 100);
    $$('[data-timer]').forEach((el) => { el.style.width = `${pct}%`; });
    $('#timerFill').style.width = `${pct}%`;
    $('#drawTimerFill').style.width = `${pct}%`;
  }
  if (dealerDeadline) {
    const left = Math.max(0, dealerDeadline - Date.now());
    $('#dealerTimerFill').style.width = `${Math.min(100, (left / dealerTotal) * 100)}%`;
  }
}, 100);

// ---------- アニメーション（ディーラーの手） ----------
let animGen = 0;

function layerPoint(el) {
  const lr = $('#animLayer').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top };
}
function pctPoint(p) {
  const lr = $('#animLayer').getBoundingClientRect();
  const fr = $('#felt').getBoundingClientRect();
  return { x: fr.left - lr.left + (fr.width * p.x) / 100, y: fr.top - lr.top + (fr.height * p.y) / 100 };
}
function dealOrigin() {
  const t = table;
  if (t.dealerMode === 'player' && t.button >= 0) {
    const plate = document.querySelector(`[data-plate="${t.button}"]`);
    if (plate) return layerPoint(plate);
  }
  const o = $('#dealerOrigin');
  return o ? layerPoint(o) : pctPoint({ x: 50, y: 0 });
}
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function flyHand(from, to, hold, onArrive) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'anim-hand';
    el.innerHTML = handSvg(hold);
    $('#animLayer').appendChild(el);
    const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 90;
    const T = (p, s = 1) => `translate(${p.x}px, ${p.y}px) rotate(${ang}deg) scale(${s})`;
    el.animate([
      { transform: T(from, 0.85), opacity: 0 },
      { transform: T(lerp(from, to, 0.15), 0.92), opacity: 1, offset: 0.15 },
      { transform: T(to), opacity: 1 },
    ], { duration: 440, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'forwards' }).onfinish = () => {
      if (onArrive) onArrive();
      const held = el.querySelector('.held');
      if (held) held.style.display = 'none';
      el.animate([
        { transform: T(to), opacity: 1 },
        { transform: T(lerp(to, from, 0.4), 0.92), opacity: 0 },
      ], { duration: 300, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { el.remove(); resolve(); };
    };
  });
}

function flyChips(from, to, amount) {
  const el = document.createElement('div');
  el.className = 'anim-chip';
  el.innerHTML = chipsHtml(amount, 4);
  $('#animLayer').appendChild(el);
  el.animate([
    { transform: `translate(${from.x}px, ${from.y}px)` },
    { transform: `translate(${to.x}px, ${to.y}px)` },
  ], { duration: 380, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' }).onfinish = () => el.remove();
  sfx('chip');
}

function reveal(key) {
  hiddenKeys.delete(key);
  const el = document.querySelector(`[data-key="${key}"]`);
  if (el) el.classList.remove('pending');
}

// 前回との差分から、配る・賭ける・渡すアニメーションを決める
function planAnimations(prev, t) {
  const sameHand = prev.handNo === t.handNo;
  if (!sameHand) { hiddenKeys.clear(); animGen++; }
  if (document.hidden) return null;
  const plan = { deals: [], bets: [], collect: [], payouts: [] };

  // 配られたカード（ディーラーの左から1枚ずつ）
  const order = [];
  for (let k = 1; k <= t.maxSeats; k++) order.push((t.button + k + t.maxSeats) % t.maxSeats);
  const perSeat = {};
  let rounds = 0;
  for (const i of order) {
    const s = t.seats[i];
    if (!s || !s.cards.length) continue;
    const ps = sameHand ? prev.seats[i] : null;
    const n = s.dealt - (ps ? ps.dealt : 0);
    if (n <= 0) continue;
    let idx;
    if (ps && ps.cards.length === s.cards.length && i === t.mySeat) {
      idx = s.cards.map((c, k) => (c !== ps.cards[k] ? k : -1)).filter((k) => k >= 0);
    } else {
      idx = [];
      for (let k = Math.max(0, s.cards.length - n); k < s.cards.length; k++) idx.push(k);
    }
    perSeat[i] = idx;
    rounds = Math.max(rounds, idx.length);
  }
  for (let r = 0; r < rounds; r++) {
    for (const i of order) if (perSeat[i] && perSeat[i][r] !== undefined) plan.deals.push(`s${i}-${perSeat[i][r]}`);
  }
  for (let k = sameHand ? prev.board.length : 0; k < t.board.length; k++) plan.deals.push(`b${k}`);
  plan.deals.forEach((k) => hiddenKeys.add(k));

  if (sameHand) {
    t.seats.forEach((s, i) => {
      const ps = prev.seats[i];
      if (s && ps && s.bet > ps.bet) plan.bets.push({ seat: i, amount: s.bet - ps.bet });
    });
    const prevBets = prev.seats.reduce((a, s) => a + (s ? s.bet : 0), 0);
    const nowBets = t.seats.reduce((a, s) => a + (s ? s.bet : 0), 0);
    if (prevBets > 0 && nowBets === 0) {
      prev.seats.forEach((s, i) => { if (s && s.bet > 0) plan.collect.push({ seat: i, amount: s.bet }); });
    }
    if (t.result && t.result.paid && prev.result && !prev.result.paid) plan.payouts = t.result.winners;
  }
  return plan;
}

function runAnimations(plan) {
  const gen = animGen;
  const origin = dealOrigin();
  const potPt = layerPoint($('#pot').innerHTML ? $('#pot') : $('#board'));

  plan.collect.forEach(({ seat, amount }) => flyChips(pctPoint(seatPos(seat, ...BET_R)), potPt, amount));
  plan.bets.forEach(({ seat, amount }) => flyChips(pctPoint(seatPos(seat, ...SEAT_R)), pctPoint(seatPos(seat, ...BET_R)), amount));

  plan.deals.forEach((key, n) => {
    setTimeout(() => {
      if (gen !== animGen) return;
      const target = document.querySelector(`[data-key="${key}"]`);
      if (!target) { reveal(key); return; }
      sfx('card');
      flyHand(origin, layerPoint(target), 'card', () => reveal(key));
    }, n * 150);
  });

  plan.payouts.forEach((w, n) => {
    setTimeout(() => {
      const plate = document.querySelector(`[data-plate="${w.seat}"]`);
      if (!plate) return;
      sfx('chip');
      flyHand(potPt, layerPoint(plate), 'chips');
    }, n * 300);
  });
}

// ---------- 部屋主のブラウザで動かす（P2P版） ----------
function createRoom(msg) {
  if (P2P) hostRoom(msg); else send(msg);
}

function deliver(msg) { queueMicrotask(() => onMessage(msg)); }
const copy = (m) => JSON.parse(JSON.stringify(m));

function dropLink() {
  if (joining) { joining.cancel(); joining = null; }
  if (link) { const l = link; link = null; l.close(); }
  if (hostNet) { hostNet.stop(); hostNet = null; }
  if (hub) { hub.destroy(); hub = null; }
  roomOnline = false;
}

function backToLobby(text) {
  tokenStore.set('poker-room', '');
  dropLink();
  table = null;
  showView('lobby');
  if (text) flash(text);
}

// 自分が部屋主になる。部屋は自分のブラウザの中で動き、友達はそこへ直接つながる
function hostRoom(msg) {
  let settings;
  try { settings = PokerHub.validateSettings({ ...msg, name: msg.name || `${me.name || 'あなた'}の部屋` }); }
  catch (e) { flash(e.message); return; }
  dropLink();
  closeModals();
  const myHub = new PokerHub.Hub(PokerHub.newRoomId(), settings);
  hub = myHub;
  const local = hub.attach({ send: (m) => deliver(copy(m)), close() {} }, { isHost: true });
  link = { send: (m) => local.receive(copy(m)), close: () => local.close() };
  link.send({ type: 'hello', token: tokenStore.get('poker-token'), name: me.name });

  if (typeof PokerP2P === 'undefined') {
    flash('オンライン接続の部品を読み込めませんでした。AIとだけ遊べます');
    return;
  }
  hostNet = PokerP2P.host(hub, {
    onOnline: () => { if (hub === myHub) { roomOnline = true; if (table) renderTable(); } },
    onRoomId: (id) => { if (hub === myHub) myHub.setRoomId(id); },
    onError: () => {
      if (hub !== myHub) return;
      roomOnline = false;
      if (table) renderTable();
      flash('友達とつなぐ準備に失敗しました。AIとは遊べます');
    },
  });
}

// 友達の部屋に入る
let retries = 0;
function joinRoom(id, isRetry = false) {
  if (typeof PokerP2P === 'undefined') { flash('オンライン接続の部品を読み込めませんでした'); return; }
  if (!isRetry) { dropLink(); retries = 0; }
  setStatus(isRetry ? '接続が切れました。つなぎ直しています…' : `部屋 ${id} に接続しています…`);
  const retryOr = (text) => {
    joining = null;
    if (isRetry && retries++ < 5) setTimeout(() => { if (!link && !joining && table) joinRoom(id, true); }, 1500);
    else if (table) backToLobby(text);
    else flash(text);
  };
  joining = PokerP2P.join(id, {
    onOpen: (l) => {
      joining = null;
      retries = 0;
      setStatus('');
      tokenStore.set('poker-room', id); // 再読み込みしたら同じ部屋に戻れるように
      link = l;
      link.send({ type: 'hello', token: tokenStore.get('poker-token'), name: me.name });
    },
    onData: (m) => { if (m && typeof m === 'object' && typeof m.type === 'string') onMessage(m); },
    onClose: () => {
      link = null;
      if (!table) return;
      retries = 0;
      joinRoom(id, true);
    },
    onRoomClosed: () => backToLobby('部屋主が部屋を閉じました'),
    onNotFound: () => retryOr(isRetry ? '部屋が見つかりません。部屋主が部屋を閉じたようです' : `部屋番号 ${id} は見つかりませんでした`),
    onError: () => retryOr('部屋に接続できませんでした。少し待つか、別のネットワークで試してください'),
  });
}

function leaveRoom() {
  if (hub && hub.guestCount() > 0
    && !confirm('あなたは部屋主です。退出すると部屋が終わり、友達も遊べなくなります。退出しますか？')) return;
  if (link && !hub) {
    // 退出を伝えてから接続を切る
    link.send({ type: 'leaveTable' });
    const l = link;
    link = null;
    setTimeout(() => l.close(), 400);
  }
  backToLobby('');
}

function initP2P() {
  $('#publicPanel').classList.add('hidden');
  $('#p2pHelp').classList.remove('hidden');
  $('#publicField').classList.add('hidden');
  window.addEventListener('beforeunload', (e) => {
    if (hub && hub.guestCount() > 0) { e.preventDefault(); e.returnValue = ''; }
  });
  if (!pendingRoom) pendingRoom = tokenStore.get('poker-room');
  if (pendingRoom) {
    const id = pendingRoom.replace(/\D/g, '').slice(0, 6);
    pendingRoom = null;
    history.replaceState(null, '', location.pathname);
    if (id.length === 6) joinRoom(id);
  }
}

$('#nameInput').value = me.name;
connect();
