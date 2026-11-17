'use strict';
// =====================================================================
//  art.js — すべてのドット絵をコードで生成する
// =====================================================================
const TS = 16;
const OL = '#3b2718';

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function R(g, x, y, w, h, c) { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
function P(g, x, y, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); }
function OR(g, x, y, w, h, c, o) { R(g, x - 1, y - 1, w + 2, h + 2, o || OL); R(g, x, y, w, h, c); }
function shape(g, rects, c, o) { for (const r of rects) R(g, r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2, o || OL); for (const r of rects) R(g, r[0], r[1], r[2], r[3], c); }
function hx(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
function sh(c, a) { const v = hx(c); const f = x => Math.max(0, Math.min(255, Math.round(a < 0 ? x * (1 + a) : x + (255 - x) * a))); return '#' + v.map(f).map(x => x.toString(16).padStart(2, '0')).join(''); }
function h2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function Rng(seed) { let s = (seed >>> 0) || 123456789; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const SPR = {};
function spr(key, w, h, fn) { if (!SPR[key]) { const [c, g] = mk(w, h); fn(g, w, h); SPR[key] = c; } return SPR[key]; }
function flipC(src) { const [c, g] = mk(src.width, src.height); g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; }
function blob(g, x, y, w, h, c, l, d) {
  R(g, x + 1, y - 1, w - 2, h + 2, OL); R(g, x - 1, y + 1, w + 2, h - 2, OL); R(g, x, y, w, h, OL);
  R(g, x + 1, y, w - 2, h, c); R(g, x, y + 1, w, h - 2, c);
  if (d) { R(g, x + 1, y + h - 2, w - 2, 2, d); R(g, x, y + h - 3, w, 1, d); }
  if (l) { R(g, x + 2, y + 1, Math.max(1, w - 7), 1, l); R(g, x + 1, y + 2, 2, Math.max(1, h - 7), l); }
}
function circ(g, cx, cy, r, c) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); R(g, cx - w, cy + y, w * 2 + 1, 1, c); } }

// ===================== 地面タイル =====================
// G草 D土道 S砂(境内) W水 X海 F田 R岩 B浜 M苔(森) P石畳 K桟橋 C畑
const GC = {
  G: ['#86c955', '#73b647', '#9cd968'], D: ['#e7cd9b', '#d6b984', '#f2dfb3'], S: ['#f1e3c3', '#e2cfa8', '#fbf2db'],
  W: ['#55a8e2', '#428fcf', '#9ad6f6'], X: ['#3484c8', '#286fb0', '#62aee8'], F: ['#a3cf5c', '#7fac45', '#bfe07f'],
  R: ['#aa9c88', '#8f816d', '#c7bba7'], B: ['#f1e0b2', '#dcc794', '#fff3cf'], M: ['#5f9d49', '#4c8a3b', '#77b45c'],
  P: ['#cbc5b8', '#aea797', '#e0dbd0'], K: ['#b4864f', '#8c6236', '#cc9d63'], C: ['#9a7650', '#7d5d3c', '#b38f68'],
  // 室内：V板の間 J畳 Q石床 Y壁 E出入口 O土間 U上段（高座）
  V: ['#a8743e', '#8a5c30', '#bc8a52'], J: ['#cfc78e', '#aaa268', '#e0d8a4'], Q: ['#b4ac9c', '#968e7e', '#c8c0b0'],
  Y: ['#efe4c8', '#5a3a20', '#f8f0dc'], E: ['#7a5a3a', '#5a3e24', '#9a7a58'], O: ['#b89a72', '#9a7c56', '#cab088'], U: ['#d8c070', '#b09040', '#ecd890']
};
const INDOOR = { V: 1, J: 1, Q: 1, Y: 1, E: 1, O: 1, U: 1 };
function drawTile(g, m, x, y) {
  const t = m.t(x, y), [b, d, l] = GC[t], X = x * TS, Y = y * TS, s = m.seed;
  R(g, X, Y, TS, TS, b);
  if (INDOOR[t]) { drawIndoor(g, m, x, y, t, b, d, l); return; }
  for (let i = 0; i < 12; i++) { const px = (h2(x * 31 + i, y, s) * 16) | 0, py = (h2(x, y * 17 + i, s + 1) * 16) | 0; P(g, X + px, Y + py, i % 2 ? d : l); }
  if (t === 'G' || t === 'M') {
    if (h2(x, y, s + 5) < .55) { const tx = X + 2 + ((h2(x, y, s + 7) * 11) | 0), ty = Y + 3 + ((h2(x, y, s + 8) * 10) | 0); P(g, tx, ty, d); P(g, tx + 2, ty, d); P(g, tx + 1, ty + 1, d); }
    if (h2(x, y, s + 15) < .4) { const tx = X + 2 + ((h2(x, y, s + 17) * 11) | 0), ty = Y + 3 + ((h2(x, y, s + 18) * 10) | 0); P(g, tx, ty, d); P(g, tx + 2, ty, d); P(g, tx + 1, ty + 1, d); }
    if (t === 'G' && h2(x, y, s + 6) < .07) {
      const fc = ['#ffffff', '#ffd84a', '#ff9ec0', '#c8a0ff'][(h2(x, y, s + 9) * 4) | 0];
      const fx = X + 4 + ((h2(x, y, s + 10) * 8) | 0), fy = Y + 4 + ((h2(x, y, s + 11) * 8) | 0);
      P(g, fx, fy - 1, fc); P(g, fx - 1, fy, fc); P(g, fx + 1, fy, fc); P(g, fx, fy + 1, fc); P(g, fx, fy, '#f0b020');
    }
  } else if (t === 'W' || t === 'X') {
    for (let k = 0; k < 2; k++) R(g, X + ((h2(x, y + k, s + 3) * 10) | 0), Y + 3 + ((h2(x + k, y, s + 4) * 10) | 0), 4, 1, l);
  } else if (t === 'F') {
    R(g, X, Y, TS, TS, '#8fb6a0');
    for (let r = 1; r < 16; r += 4) for (let c = 1; c < 16; c += 3) { P(g, X + c, Y + r, d); P(g, X + c, Y + r + 1, d); P(g, X + c + 1, Y + r, b); P(g, X + c - 1, Y + r, l); }
  } else if (t === 'C') {
    for (let r = 2; r < 16; r += 5) { R(g, X, Y + r, 16, 2, d); for (let c = 1; c < 16; c += 4) { P(g, X + c, Y + r - 1, '#5aa040'); P(g, X + c + 1, Y + r - 2, '#78c050'); } }
  } else if (t === 'R') {
    if (h2(x, y, s + 3) < .5) { const cx = X + 3 + ((h2(x, y, s + 4) * 9) | 0), cy = Y + 3 + ((h2(x, y, s + 5) * 9) | 0); R(g, cx, cy, 3, 1, d); R(g, cx + 2, cy + 1, 1, 2, d); }
  } else if (t === 'K') {
    for (const r of [0, 5, 10, 15]) R(g, X, Y + r, 16, 1, d);
    P(g, X + 3, Y + 2, d); P(g, X + 12, Y + 7, d); P(g, X + 6, Y + 12, d);
  } else if (t === 'P') {
    R(g, X, Y + 7, 16, 1, d); R(g, X, Y + 15, 16, 1, d); R(g, X + (y % 2 ? 4 : 11), Y, 1, 7, d); R(g, X + (y % 2 ? 11 : 4), Y + 8, 1, 7, d);
  }
}
const SOFT = { D: 1, S: 1, P: 1, B: 1, R: 1, F: 1, C: 1, K: 0 };
function edgeLine(g, x, y, k, c, depth, s) {
  const X = x * TS, Y = y * TS;
  for (let i = 0; i < TS; i++) {
    const d = 1 + ((h2(x * 16 + i, y * 16 + k, s) * depth) | 0);
    if (k === 0) R(g, X + i, Y, 1, d, c); else if (k === 2) R(g, X + i, Y + TS - d, 1, d, c);
    else if (k === 3) R(g, X, Y + i, d, 1, c); else R(g, X + TS - d, Y + i, d, 1, c);
  }
}
function drawIndoor(g, m, x, y, t, b, d, l) {
  const X = x * TS, Y = y * TS, up = m.t(x, y - 1), dn = m.t(x, y + 1);
  if (t === 'V') { for (let r = 0; r < 16; r += 4) { R(g, X, Y + r, 16, 1, d); const j = ((x * 7 + y * 3 + r) % 3) * 5 + 2; R(g, X + j, Y + r, 1, 4, d); } for (let i = 0; i < 6; i++) P(g, X + ((h2(x, y + i, 3) * 16) | 0), Y + ((h2(x + i, y, 4) * 16) | 0), l); }
  else if (t === 'J' || t === 'U') { for (let r = 1; r < 16; r += 2) R(g, X, Y + r, 16, 1, sh(b, -.06)); const v = (x + y) % 2; if (v) R(g, X, Y, 1, 16, t === 'U' ? '#7a2a1a' : '#4a5a3a'); else R(g, X, Y, 16, 1, t === 'U' ? '#7a2a1a' : '#4a5a3a'); if (t === 'U' && dn !== 'U') { R(g, X, Y + 13, 16, 3, '#3a1a10'); R(g, X, Y + 13, 16, 1, '#c8402a'); } }
  else if (t === 'Q') { R(g, X, Y, 16, 1, d); R(g, X, Y, 1, 16, d); R(g, X + 8, Y + 8, 8, 1, d); }
  else if (t === 'O') { for (let i = 0; i < 10; i++) P(g, X + ((h2(x * 9 + i, y, 5) * 16) | 0), Y + ((h2(x, y * 9 + i, 6) * 16) | 0), i % 2 ? d : l); }
  else if (t === 'E') { R(g, X, Y, 16, 16, '#2a1a10'); R(g, X + 1, Y + 2, 14, 12, '#6a4a2a'); R(g, X + 1, Y + 2, 14, 2, '#8a6a42'); }
  else if (t === 'Y') {
    if (up !== 'Y') { R(g, X, Y, 16, 6, '#3e2614'); R(g, X, Y + 5, 16, 1, '#6a4428'); R(g, X, Y + 6, 16, 10, '#efe4c8'); }
    else { R(g, X, Y, 16, 16, '#efe4c8'); }
    if (dn !== 'Y') { R(g, X, Y + 11, 16, 5, '#6a4428'); R(g, X, Y + 11, 16, 1, '#8a6040'); R(g, X, Y + 15, 16, 1, '#2a1a0a'); }
    if (x % 5 === 0) { R(g, X + 6, Y, 4, 16, '#7a4e2c'); R(g, X + 6, Y, 1, 16, '#9a6a40'); }
    if (up === 'Y' && dn === 'Y') R(g, X, Y + 7, 16, 2, '#7a4e2c');
  }
}
function drawEdges(g, m, x, y) {
  const t = m.t(x, y), s = m.seed, nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  if (INDOOR[t]) return;
  const isW = t === 'W' || t === 'X';
  for (let k = 0; k < 4; k++) {
    const n = m.t(x + nb[k][0], y + nb[k][1]); if (!n || n === t) continue;
    const nW = n === 'W' || n === 'X';
    if (isW && !nW && n !== 'K') { edgeLine(g, x, y, k, '#e2f6ff', 2, s); edgeLine(g, x, y, k, '#ffffff', 1, s + 2); }
    else if (isW && nW && t === 'X') { edgeLine(g, x, y, k, GC.W[0], 2, s); }
    else if (!isW && (n === 'G' || n === 'M') && SOFT[t]) { edgeLine(g, x, y, k, GC[n][0], 2, s); edgeLine(g, x, y, k, GC[n][1], 1, s + 3); }
    else if (!isW && nW && t !== 'K') { edgeLine(g, x, y, k, sh(GC[t][0], -.18), 1, s); }
    else if (t === 'G' && n === 'M') { edgeLine(g, x, y, k, GC.M[2], 1, s); }
  }
}
function drawGround(m) {
  const [c, g] = mk(m.w * TS, m.h * TS);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawTile(g, m, x, y);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawEdges(g, m, x, y);
  return c;
}

// ===================== 屋根・建物 =====================
function roof(g, x, y, w, h, inset, o) {
  const c = o.roof, d = sh(c, -.28), l = sh(c, .22);
  for (let r = 0; r < h; r++) {
    const t = h > 1 ? r / (h - 1) : 1, ins = Math.round(inset * (1 - t)), lx = x + ins, rx = x + w - ins;
    R(g, lx, y + r, rx - lx, 1, c);
    if (o.thatch) { for (let xx = lx; xx < rx; xx++) { const v = h2(xx, r + y, 7); if (v < .22) P(g, xx, y + r, d); else if (v > .86) P(g, xx, y + r, l); } if (r % 4 === 3) R(g, lx, y + r, rx - lx, 1, sh(c, -.12)); }
    else { if (r % 3 === 2) R(g, lx, y + r, rx - lx, 1, d); else for (let xx = lx + 1 + (r % 2); xx < rx - 1; xx += 3) P(g, xx, y + r, l); }
    P(g, lx - 1, y + r, OL); P(g, rx, y + r, OL);
  }
  R(g, x - 1, y + h, w + 2, 1, OL); R(g, x, y + h - 1, w, 1, sh(c, -.4));
  if (o.curl) { R(g, x - 2, y + h - 3, 1, 3, OL); R(g, x + w + 1, y + h - 3, 1, 3, OL); R(g, x - 1, y + h - 2, 1, 2, c); R(g, x + w, y + h - 2, 1, 2, c); }
  const ins = inset;
  R(g, x + ins - 1, y - 2, w - 2 * ins + 2, 3, OL); R(g, x + ins, y - 1, w - 2 * ins, 1, o.ridge || d);
  if (o.shibi) { R(g, x + ins - 2, y - 6, 3, 6, OL); R(g, x + ins - 1, y - 5, 1, 4, '#ecc444'); R(g, x + w - ins - 1, y - 6, 3, 6, OL); R(g, x + w - ins, y - 5, 1, 4, '#ecc444'); }
  else { R(g, x + ins - 2, y - 4, 2, 4, OL); R(g, x + w - ins, y - 4, 2, 4, OL); }
}
function hall(g, W, H, o) {
  const baseH = o.baseH ?? 4, by = H - baseH - 1, base = o.base || '#d6cdb9', wall = o.wall || '#f3ecdc', pil = o.pillar || '#d24a2e';
  if (baseH > 0) {
    OR(g, 2, by, W - 4, baseH, base); R(g, 2, by, W - 4, 1, sh(base, .35));
    const sw = Math.min(14, (W / 3) | 0); R(g, (W - sw) >> 1, by, sw, baseH, sh(base, .2)); for (let i = 1; i < baseH; i += 2) R(g, (W - sw) >> 1, by + i, sw, 1, sh(base, -.15));
  }
  const wallH = o.wallH || Math.round((H - baseH) * (o.wallFrac || .34));
  const wy = by - wallH, wx = 4, ww = W - 8;
  OR(g, wx, wy, ww, wallH, wall);
  R(g, wx, wy + wallH - 3, ww, 3, o.panel || sh(wall, -.13));
  const ps = o.ps || 10, cols = [];
  for (let x = wx; x <= wx + ww - 2; x += ps) cols.push(x);
  if (cols[cols.length - 1] !== wx + ww - 2) cols.push(wx + ww - 2);
  const dw = o.doorW || 12, dx = (W - dw) >> 1;
  if (o.win !== false) for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i] + 2, b = cols[i + 1], mid = (a + b) / 2;
    if (Math.abs(mid - W / 2) < dw) continue;
    const wwid = b - a - 2, wh = Math.max(3, wallH - 9); if (wwid < 3) continue;
    R(g, a + 1, wy + 4, wwid, wh, o.winC || '#5a4030');
    for (let xx = a + 2; xx < a + 1 + wwid; xx += 2) R(g, xx, wy + 4, 1, wh, o.lat || '#d2b07c');
    R(g, a + 1, wy + 4 + (wh >> 1), wwid, 1, o.lat || '#d2b07c');
  }
  for (const x of cols) R(g, x, wy, 2, wallH, pil);
  R(g, wx, wy, ww, 2, pil); R(g, wx, wy + 2, ww, 1, sh(pil, -.35));
  R(g, dx - 1, wy + 3, dw + 2, wallH - 3, OL); R(g, dx, wy + 4, dw, wallH - 4, o.door || '#8a5230');
  if (o.noren) { R(g, dx, wy + 4, dw, 6, o.noren); for (let xx = dx + 3; xx < dx + dw; xx += 4) R(g, xx, wy + 4, 1, 6, sh(o.noren, -.35)); P(g, dx + (dw >> 1), wy + 6, '#fff'); P(g, dx + (dw >> 1) - 1, wy + 7, '#fff'); }
  else { R(g, dx + (dw >> 1), wy + 4, 1, wallH - 4, OL); P(g, dx + (dw >> 1) - 2, wy + 4 + ((wallH - 4) >> 1), '#ecc444'); P(g, dx + (dw >> 1) + 2, wy + 4 + ((wallH - 4) >> 1), '#ecc444'); }
  if (o.lanterns) { for (const lx of [wx + 4, wx + ww - 8]) { R(g, lx + 1, wy + 2, 1, 2, OL); OR(g, lx, wy + 4, 3, 5, '#e2402c'); P(g, lx + 1, wy + 5, '#ffb080'); } }
  if (o.sign) { OR(g, (W >> 1) - 6, wy - 1, 12, 5, '#3a2a20'); R(g, (W >> 1) - 4, wy + 1, 8, 1, '#ecc444'); }
  const top = o.top ?? 7, rb = wy + 2;
  if (o.tier2) {
    const mid = top + Math.round((rb - top) * .5);
    const uw = Math.round(W * .64), ux = (W - uw) >> 1;
    OR(g, ux, mid - 7, uw, 8, wall); for (let x = ux; x < ux + uw; x += 6) R(g, x, mid - 7, 2, 8, pil);
    roof(g, 0, mid, W, rb - mid, Math.round(W * .07), o);
    roof(g, ux - 7, top, uw + 14, mid - 5 - top, Math.round(uw * .22), o);
  } else roof(g, 1, top, W - 2, rb - top, Math.round(W * (o.inset ?? .16)), o);
  if (o.goods) { for (let i = 0; i < 3; i++) { const gx = 6 + i * 6; OR(g, gx, by - 3, 4, 3, ['#d89a40', '#7ab050', '#c05050'][i]); } }
}
const BSTY = {
  temple: { roof: '#4f8f88', curl: 1 },
  kondo: { roof: '#4f8f88', curl: 1, tier2: 1, shibi: 1 },
  daibutsu: { roof: '#5d6872', pillar: '#c84a2e', tier2: 1, shibi: 1, curl: 1, ps: 12 },
  palace: { roof: '#3f8a7e', pillar: '#d84a2e', tier2: 1, curl: 1, shibi: 1, base: '#e2dccd' },
  yashiki: { roof: '#8f6a52', thatch: 1, pillar: '#6c4428', wall: '#efe6d0', base: '#cfc5ae', inset: .12 },
  house: { roof: '#bf9a5c', thatch: 1, pillar: '#6a4428', wall: '#dcc8a0', baseH: 2, top: 5, inset: .2, ps: 9 },
  shop: { roof: '#6c7680', pillar: '#7a4a2a', wall: '#e2d0a8', noren: '#34488a', baseH: 2, goods: 1, sign: 1 },
  ink: { roof: '#6c7680', pillar: '#4a3a2a', wall: '#e8dcc0', noren: '#2a2a2a', baseH: 2, goods: 1, sign: 1 },
  inn: { roof: '#6c7680', pillar: '#7a4a2a', wall: '#ecdcb4', noren: '#a83a3a', tier2: 1, baseH: 2, lanterns: 1 },
  school: { roof: '#5a6672', pillar: '#8a5a32', wall: '#f3ecdc', sign: 1 },
  kura: { roof: '#3e4448', pillar: '#e8e2d4', wall: '#f6f2e8', win: false, doorW: 8, door: '#3a3030', panel: '#565656', baseH: 2 },
  hut: { roof: '#ab8c52', thatch: 1, pillar: '#6a4428', wall: '#c9b08a', baseH: 1, win: false, top: 4, inset: .24, doorW: 10, door: '#3a2a20' },
  office: { roof: '#5f6a72', pillar: '#c84a2e', sign: 1 },
  tang: { roof: '#55686a', pillar: '#b8302a', wall: '#c94634', curl: 1, shibi: 1, lanterns: 1, winC: '#3a1a10', lat: '#e8b040', ridge: '#e0b040', tier2: 1 },
  tangtemple: { roof: '#5b6e64', pillar: '#b8302a', wall: '#f0e6d2', curl: 1, shibi: 1, ridge: '#e0b040', lanterns: 1 },
  tanghouse: { roof: '#686f74', pillar: '#8a3a2a', wall: '#ece4d4', curl: 1, lanterns: 1, baseH: 2 },
  tangshop: { roof: '#686f74', pillar: '#8a3a2a', wall: '#e4d4b4', curl: 1, noren: '#c8302a', baseH: 2, goods: 1, lanterns: 1 },
  tavern: { roof: '#55686a', pillar: '#b8302a', wall: '#f0dcb8', curl: 1, tier2: 1, lanterns: 1, noren: '#c8302a', baseH: 2 },
  teahouse: { roof: '#bf9a5c', thatch: 1, pillar: '#6a4428', wall: '#e2cea2', noren: '#c83a30', baseH: 1 },
  sobo: { roof: '#6a7078', pillar: '#7a4a2a', wall: '#f0e8d6', baseH: 2 },
  kodo: { roof: '#4f8f88', curl: 1, shibi: 1 },
  mieido: { roof: '#9a7a5a', thatch: 1, pillar: '#7a4a2a', wall: '#f3ecdc' },
  gakuin: { roof: '#5a6672', pillar: '#8a5a32', wall: '#f3ecdc', sign: 1, tier2: 1 }
};
const BEXTRA = { kondo: 26, daibutsu: 30, palace: 26, inn: 22, tang: 26, tavern: 24, pagoda: 82, daito: 52, gate: 30, tangpagoda: 96, gakuin: 22 };

function pagoda(g, W, H, o) {
  const tiers = o.tiers || 5, cx = W >> 1; let y = H - 5;
  OR(g, 4, y, W - 8, 4, '#d6cdb9');
  let w = W - 6;
  for (let i = 0; i < tiers; i++) {
    const bw = Math.max(10, w - 16), bx = cx - (bw >> 1), wh = i === 0 ? 9 : 5;
    OR(g, bx, y - wh, bw, wh, '#f3ecdc'); R(g, bx, y - wh, 2, wh, '#d24a2e'); R(g, bx + bw - 2, y - wh, 2, wh, '#d24a2e'); R(g, cx - 2, y - wh + 1, 4, wh - 1, '#8a5230');
    y -= wh; const rh = 8; roof(g, cx - (w >> 1), y - rh + 2, w, rh, Math.round(w * .24), { roof: o.roof || '#4f8f88', curl: 1 });
    y -= rh - 1; w -= 6;
  }
  R(g, cx - 1, y - 26, 3, 27, OL); R(g, cx, y - 25, 1, 25, '#ecc444');
  for (let k = 0; k < 6; k++) R(g, cx - 2, y - 22 + k * 3, 5, 1, '#c89a20');
  OR(g, cx - 1, y - 29, 3, 3, '#ffe080');
}
function daito(g, W, H, o) {
  const cx = W >> 1, rf = o.roof || '#4f8f88';
  OR(g, 4, H - 6, W - 8, 5, '#d6cdb9');
  OR(g, 8, H - 26, W - 16, 20, '#f3ecdc'); for (let x = 8; x < W - 8; x += 9) R(g, x, H - 26, 2, 20, '#d24a2e'); R(g, cx - 6, H - 22, 12, 16, '#8a5230');
  // 亀腹と上層
  const dy = H - 58; OR(g, cx - 14, dy + 8, 28, 10, '#fbf8f0'); R(g, cx - 13, dy + 8, 26, 2, '#ffffff');
  OR(g, cx - 10, dy - 4, 20, 12, '#d24a2e'); for (let x = cx - 10; x < cx + 10; x += 5) R(g, x, dy - 4, 1, 12, '#a83020');
  roof(g, 0, H - 42, W, 17, 12, { roof: rf, curl: 1 });
  roof(g, cx - 22, dy - 20, 44, 16, 13, { roof: rf, curl: 1 });
  R(g, cx - 1, dy - 46, 3, 27, OL); R(g, cx, dy - 45, 1, 25, '#ecc444'); for (let k = 0; k < 7; k++) R(g, cx - 2, dy - 42 + k * 3, 5, 1, '#c89a20');
  OR(g, cx - 1, dy - 49, 3, 3, '#ffe080');
}
function gate(g, W, H, o) {
  const pil = o.pillar || '#d24a2e', rf = o.roof || '#4f8f88';
  for (const x of [6, W * .3 | 0, W * .7 - 3 | 0, W - 9]) { OR(g, x, H - 30, 3, 28, pil); OR(g, x - 1, H - 3, 5, 2, '#cfc6b4'); }
  OR(g, 4, H - 34, W - 8, 5, pil); R(g, 4, H - 31, W - 8, 1, sh(pil, -.3));
  OR(g, 8, H - 44, W - 16, 9, o.wall || '#f3ecdc'); for (let x = 8; x < W - 8; x += 7) R(g, x, H - 44, 2, 9, pil);
  roof(g, 0, H - 42, W, 9, 5, { roof: rf, curl: 1 });
  roof(g, 2, H - 60, W - 4, 15, Math.round(W * .2), { roof: rf, curl: 1, shibi: o.shibi });
}
function tangpagoda(g, W, H) {
  const cx = W >> 1; let y = H - 4; OR(g, 3, y, W - 6, 3, '#c8b898');
  for (let i = 0; i < 7; i++) {
    const bw = 38 - i * 4, th = i === 0 ? 16 : 11 - (i >> 1);
    OR(g, cx - (bw >> 1), y - th, bw, th, '#dcbc8c'); for (let r = y - th + 3; r < y; r += 3) R(g, cx - (bw >> 1), r, bw, 1, '#c8a676');
    OR(g, cx - 2, y - th + 3, 4, 5, '#3a2a20'); R(g, cx - 2, y - th + 3, 4, 1, '#5a4a3a');
    y -= th; OR(g, cx - (bw >> 1) - 3, y - 2, bw + 6, 2, '#9a7a56'); y -= 2;
  }
  OR(g, cx - 2, y - 8, 5, 8, '#c8a676'); OR(g, cx - 1, y - 12, 3, 4, '#ecc444');
}

function drawBuilding(type, w, h) {
  const W = w * TS, H = h * TS + (BEXTRA[type] ?? 16);
  const [c, g] = mk(W, H);
  if (type === 'pagoda') pagoda(g, W, H, {});
  else if (type === 'daito') daito(g, W, H, {});
  else if (type === 'gate') gate(g, W, H, {});
  else if (type === 'redgate') gate(g, W, H, { roof: '#5d6872', shibi: 1 });
  else if (type === 'tanggate') gate(g, W, H, { roof: '#55686a', wall: '#c94634', shibi: 1 });
  else if (type === 'tangpagoda') tangpagoda(g, W, H);
  else hall(g, W, H, BSTY[type] || BSTY.temple);
  return c;
}
function bldSprite(type, w, h) { const k = 'b:' + type + w + 'x' + h; if (!SPR[k]) SPR[k] = drawBuilding(type, w, h); return SPR[k]; }

// ===================== 小物・樹木 =====================
const OBJ = {
  pine: [26, 34, g => { R(g, 11, 20, 4, 13, OL); R(g, 12, 20, 2, 12, '#8a5530'); P(g, 12, 25, '#5e3518'); blob(g, 1, 15, 24, 8, '#2f7040', '#4c9a50', '#1f5030'); blob(g, 4, 8, 18, 8, '#317444', '#50a054', '#22553a'); blob(g, 8, 2, 11, 7, '#3a7c48', '#5aaa5a', '#26583a'); }],
  tree: [24, 28, g => { R(g, 10, 18, 4, 9, OL); R(g, 11, 18, 2, 8, '#8a5530'); blob(g, 2, 5, 20, 15, '#4ea040', '#7ccb60', '#3a8034'); blob(g, 5, 1, 13, 8, '#56aa46', '#86d468', null); P(g, 8, 10, '#3a8034'); P(g, 15, 12, '#3a8034'); P(g, 12, 7, '#3a8034'); }],
  sakura: [24, 28, g => { R(g, 10, 18, 4, 9, OL); R(g, 11, 18, 2, 8, '#7a4a3a'); blob(g, 2, 5, 20, 15, '#f4a6c6', '#ffd8e8', '#e07ea8'); blob(g, 5, 1, 13, 8, '#f7b4d0', '#ffe4ef', null); for (let i = 0; i < 9; i++) P(g, 4 + ((h2(i, 1, 3) * 16) | 0), 4 + ((h2(i, 2, 3) * 13) | 0), '#ffffff'); }],
  maple: [24, 28, g => { R(g, 10, 18, 4, 9, OL); R(g, 11, 18, 2, 8, '#7a4a3a'); blob(g, 2, 5, 20, 15, '#e5683a', '#ffa868', '#bc4428'); blob(g, 5, 1, 13, 8, '#ee7a42', '#ffb878', null); }],
  plum: [22, 26, g => { R(g, 9, 14, 4, 11, OL); R(g, 10, 14, 2, 10, '#5a3a2a'); R(g, 5, 10, 12, 2, '#5a3a2a'); for (let i = 0; i < 16; i++) { const x = 2 + ((h2(i, 4, 5) * 18) | 0), y = 2 + ((h2(i, 5, 5) * 13) | 0); R(g, x, y, 2, 2, i % 3 ? '#f05a7a' : '#fff0f4'); } }],
  cedar: [18, 42, g => { R(g, 7, 33, 4, 8, OL); R(g, 8, 33, 2, 7, '#6a3a20'); const L = [[2, 6, 4], [9, 9, 8], [17, 12, 11], [25, 10, 14]]; for (const [y, hh, hw] of L) { for (let r = 0; r < hh; r++) { const w = Math.max(1, Math.round((r + 1) / hh * hw)); R(g, 9 - w - 1, y + r, w * 2 + 2, 1, OL); R(g, 9 - w, y + r, w * 2, 1, r % 3 === 0 ? '#3a7a4a' : '#2a5e3a'); P(g, 9 - w, y + r, '#4a8a58'); } R(g, 9 - hw - 1, y + hh, hw * 2 + 2, 1, OL); } R(g, 8, 1, 2, 2, OL); }],
  willow: [24, 30, g => { R(g, 11, 12, 3, 17, OL); R(g, 12, 12, 1, 16, '#6a4a2a'); blob(g, 4, 2, 16, 8, '#86c450', '#a8e070', null); for (let x = 3; x < 22; x += 2) { const len = 9 + ((h2(x, 3, 9) * 9) | 0); R(g, x, 8, 1, len, x % 4 ? '#7cc050' : '#5a9a38'); P(g, x, 8 + len, '#4a8a2a'); } }],
  bamboo: [18, 32, g => { for (const [x, t] of [[3, 4], [8, 1], [13, 6]]) { R(g, x - 1, t, 4, 31 - t, OL); R(g, x, t, 2, 31 - t, '#7cbc52'); P(g, x, t + 2, '#a8e078'); for (let y = t + 5; y < 31; y += 6) R(g, x, y, 2, 1, '#4a8a34'); } for (let i = 0; i < 10; i++) { const x = 1 + ((h2(i, 7, 1) * 15) | 0), y = 1 + ((h2(i, 8, 1) * 12) | 0); R(g, x, y, 3, 1, '#5aa840'); } }],
  bush: [16, 12, g => blob(g, 1, 2, 14, 9, '#4f9a3c', '#72bc58', '#3a7a2e')],
  azalea: [16, 12, g => { blob(g, 1, 2, 14, 9, '#4f9a3c', '#72bc58', '#3a7a2e'); for (let i = 0; i < 6; i++) P(g, 3 + ((h2(i, 1, 8) * 10) | 0), 3 + ((h2(i, 2, 8) * 6) | 0), '#ff6a9a'); }],
  rock: [16, 12, g => blob(g, 1, 2, 14, 9, '#a8a294', '#cac4b6', '#86807a')],
  bigrock: [32, 24, g => { blob(g, 1, 6, 30, 17, '#9a9284', '#bcb4a6', '#7a7266'); blob(g, 6, 1, 16, 10, '#a49c8e', '#c8c0b2', null); }],
  lantern: [10, 18, g => { OR(g, 3, 14, 4, 3, '#b8b0a2'); OR(g, 4, 9, 2, 5, '#b8b0a2'); OR(g, 1, 6, 8, 4, '#b8b0a2'); R(g, 3, 7, 4, 2, '#ffe080'); OR(g, 0, 3, 10, 3, '#a8a092'); OR(g, 4, 1, 2, 2, '#a8a092'); }],
  well: [16, 18, g => { OR(g, 1, 10, 14, 7, '#a8a294'); R(g, 3, 11, 10, 3, '#2a4a6a'); R(g, 1, 13, 14, 1, '#8a8478'); OR(g, 2, 2, 2, 9, '#7a4a2a'); OR(g, 12, 2, 2, 9, '#7a4a2a'); OR(g, 0, 1, 16, 2, '#5a4a3a'); OR(g, 7, 4, 3, 3, '#a87848'); }],
  sign: [14, 20, g => { OR(g, 6, 8, 2, 11, '#8a5a32'); OR(g, 1, 3, 12, 6, '#ecd5a4'); R(g, 3, 5, 8, 1, '#5a3a20'); R(g, 3, 7, 5, 1, '#5a3a20'); P(g, 12, 6, OL); }],
  cart: [30, 24, g => { OR(g, 5, 6, 18, 11, '#2a2026'); R(g, 5, 6, 18, 1, '#e0b040'); R(g, 5, 16, 18, 1, '#e0b040'); R(g, 8, 8, 12, 7, '#c8a868'); for (let x = 9; x < 20; x += 2) R(g, x, 8, 1, 7, '#a88848'); OR(g, 3, 3, 22, 3, '#3a3036'); R(g, 3, 3, 22, 1, '#5a5058'); circ(g, 14, 18, 5, OL); circ(g, 14, 18, 4, '#5a3a2a'); circ(g, 14, 18, 2, '#2a1a10'); R(g, 23, 12, 7, 1, '#3a2a20'); }],
  umbrella: [24, 28, g => { R(g, 11, 8, 2, 14, OL); for (let r = 0; r < 8; r++) { const w = 3 + r * 1.5 | 0; R(g, 12 - w - 1, 1 + r, w * 2 + 2, 1, OL); R(g, 12 - w, 1 + r, w * 2, 1, r % 2 ? '#d83a30' : '#e8483a'); } for (let x = 2; x < 22; x += 4) R(g, x, 8, 1, 1, '#ffd0a0'); OR(g, 2, 21, 20, 3, '#c8382e'); R(g, 3, 24, 1, 3, OL); R(g, 20, 24, 1, 3, OL); }],
  stall: [32, 26, g => { R(g, 2, 8, 2, 16, OL); R(g, 28, 8, 2, 16, OL); for (let x = 1; x < 31; x++) R(g, x, 3, 1, 6, ((x >> 2) % 2) ? '#f0e6d0' : '#c84a3a'); R(g, 0, 2, 32, 1, OL); R(g, 0, 9, 32, 1, OL); OR(g, 2, 16, 28, 6, '#a87848'); const gc = ['#e85a3a', '#f0c040', '#6ab04a', '#8a5ac0', '#e8e0d0', '#c08040']; for (let i = 0; i < 7; i++) OR(g, 4 + i * 4, 13, 3, 3, gc[(i * 5 + 1) % 6]); }],
  stall2: [32, 26, g => { R(g, 2, 8, 2, 16, OL); R(g, 28, 8, 2, 16, OL); for (let x = 1; x < 31; x++) R(g, x, 3, 1, 6, ((x >> 2) % 2) ? '#e8e0c8' : '#3a6a9a'); R(g, 0, 2, 32, 1, OL); R(g, 0, 9, 32, 1, OL); OR(g, 2, 16, 28, 6, '#a87848'); for (let i = 0; i < 5; i++) OR(g, 4 + i * 5, 12, 4, 4, ['#e8d8a8', '#c8a060', '#a07040', '#e0e0e0', '#d0b080'][i]); }],
  torii: [48, 30, g => { OR(g, 8, 8, 4, 21, '#d8402c'); OR(g, 36, 8, 4, 21, '#d8402c'); OR(g, 5, 10, 38, 3, '#d8402c'); OR(g, 1, 3, 46, 4, '#2a2224'); R(g, 1, 3, 46, 1, '#4a4044'); OR(g, 22, 7, 4, 3, '#d8402c'); }],
  wallH: [16, 20, g => { R(g, 0, 4, 16, 1, OL); R(g, 0, 5, 16, 3, '#5a6a72'); R(g, 0, 5, 16, 1, '#7a8a92'); for (let x = 1; x < 16; x += 3) P(g, x, 7, '#46545a'); R(g, 0, 8, 16, 1, OL); R(g, 0, 9, 16, 7, '#f2ead6'); R(g, 0, 11, 16, 1, '#e0d4b8'); R(g, 0, 13, 16, 1, '#e0d4b8'); R(g, 0, 16, 16, 3, '#b8a888'); R(g, 0, 19, 16, 1, OL); }],
  wallV: [16, 20, g => { R(g, 4, 0, 1, 20, OL); R(g, 11, 0, 1, 20, OL); R(g, 5, 0, 6, 16, '#5e6e78'); R(g, 7, 0, 2, 16, '#7a8a92'); R(g, 5, 16, 6, 3, '#f2ead6'); R(g, 4, 19, 8, 1, OL); }],
  fenceH: [16, 14, g => { OR(g, 1, 3, 2, 10, '#8a5a32'); OR(g, 13, 3, 2, 10, '#8a5a32'); R(g, 0, 5, 16, 2, OL); R(g, 0, 5, 16, 1, '#a87848'); R(g, 0, 9, 16, 2, OL); R(g, 0, 9, 16, 1, '#a87848'); }],
  fenceV: [16, 16, g => { OR(g, 7, 0, 2, 15, '#8a5a32'); P(g, 7, 4, '#a87848'); P(g, 7, 10, '#a87848'); }],
  tangwallH: [16, 22, g => { R(g, 0, 4, 16, 1, OL); R(g, 0, 5, 16, 3, '#56606a'); R(g, 0, 5, 16, 1, '#76808a'); R(g, 0, 8, 16, 1, OL); R(g, 0, 9, 16, 10, '#c8a882'); for (let y = 11; y < 19; y += 3) R(g, 0, y, 16, 1, '#b09070'); R(g, 0, 19, 16, 2, '#9a8060'); R(g, 0, 21, 16, 1, OL); }],
  tangwallV: [16, 22, g => { R(g, 3, 0, 1, 22, OL); R(g, 12, 0, 1, 22, OL); R(g, 4, 0, 8, 17, '#5a646e'); R(g, 7, 0, 2, 17, '#7a848e'); R(g, 4, 17, 8, 4, '#c8a882'); R(g, 3, 21, 10, 1, OL); }],
  boat: [34, 16, g => { for (let r = 0; r < 7; r++) { const ins = r; R(g, 1 + ins, 6 + r, 32 - ins * 2, 1, OL); R(g, 2 + ins, 6 + r, 30 - ins * 2, 1, r < 2 ? '#a87040' : '#8a5a32'); } R(g, 1, 5, 32, 1, OL); R(g, 4, 7, 26, 2, '#5a3a20'); OR(g, 25, 1, 1, 5, '#6a4a2a'); }],
  ship: [100, 76, g => {
    for (let r = 0; r < 18; r++) { const ins = Math.round(r * r / 22); R(g, 4 + ins, 48 + r, 92 - ins * 2, 1, OL); R(g, 5 + ins, 48 + r, 90 - ins * 2, 1, r < 3 ? '#9a6438' : r % 4 === 0 ? '#6a3e22' : '#7e4c2a'); }
    R(g, 2, 46, 96, 3, OL); R(g, 3, 47, 94, 1, '#b07a48'); R(g, 0, 40, 6, 8, OL); R(g, 94, 38, 6, 10, OL); R(g, 1, 41, 4, 6, '#9a6438'); R(g, 95, 39, 4, 8, '#9a6438');
    OR(g, 32, 34, 36, 12, '#d8b078'); for (let x = 34; x < 66; x += 5) R(g, x, 36, 2, 8, '#6a4a2a'); OR(g, 30, 30, 40, 4, '#4a3a30');
    R(g, 23, 4, 3, 44, OL); R(g, 24, 4, 1, 43, '#8a5a32'); R(g, 70, 0, 3, 48, OL); R(g, 71, 0, 1, 47, '#8a5a32');
    for (const [sx, sy, sw, shh] of [[10, 7, 30, 26], [56, 3, 32, 30]]) { OR(g, sx, sy, sw, shh, '#eadbb0'); for (let y = sy + 4; y < sy + shh; y += 5) R(g, sx, y, sw, 1, '#c8b488'); for (let x = sx + 6; x < sx + sw; x += 7) R(g, x, sy, 1, shh, '#d8c898'); }
    OR(g, 72, 0, 8, 4, '#d8402c'); OR(g, 26, 2, 7, 3, '#d8402c');
    for (let x = 6; x < 94; x += 6) R(g, x, 66, 4, 2, '#e8f6ff');
  }],
  waterfall: [32, 58, g => { blob(g, 0, 2, 11, 52, '#8e8678', '#aaa294', '#706a5e'); blob(g, 21, 2, 11, 52, '#8e8678', '#aaa294', '#706a5e'); R(g, 10, 0, 12, 52, '#a8dcf6'); for (let x = 10; x < 22; x += 2) R(g, x, (x * 7) % 9, 1, 44, '#e8f8ff'); blob(g, 4, 48, 24, 9, '#e8f8ff', '#ffffff', '#c8ecff'); }],
  cave: [52, 46, g => { blob(g, 0, 12, 52, 33, '#8e8476', '#aaa090', '#6e6458'); blob(g, 7, 2, 38, 18, '#968c7e', '#b4aa98', null); blob(g, 30, 8, 16, 10, '#8a8072', null, null); for (let r = 0; r < 22; r++) { const w = r < 5 ? 5 + r * 1.6 | 0 : 13; R(g, 26 - w, 23 + r, w * 2, 1, r < 1 ? OL : '#1a120e'); P(g, 26 - w - 1, 23 + r, OL); P(g, 26 + w, 23 + r, OL); } R(g, 12, 21, 28, 2, '#d8c080'); R(g, 12, 21, 28, 1, '#a88a50'); for (const x of [15, 22, 29, 36]) { P(g, x, 23, '#fff'); P(g, x + 1, 24, '#fff'); P(g, x, 25, '#fff'); } }],
  gorin: [10, 22, g => { OR(g, 1, 16, 8, 5, '#a8a294'); OR(g, 2, 11, 6, 5, '#b4ae a0'.replace(' ', '')); OR(g, 1, 8, 8, 3, '#a8a294'); OR(g, 3, 5, 4, 3, '#b4aea0'); OR(g, 4, 2, 2, 3, '#a8a294'); }],
  brazier: [10, 20, g => { R(g, 2, 10, 1, 9, OL); R(g, 7, 10, 1, 9, OL); OR(g, 1, 8, 8, 3, '#3a3a3a'); R(g, 2, 4, 6, 4, '#ff8a2a'); R(g, 3, 2, 4, 3, '#ffd040'); P(g, 4, 0, '#ffe080'); }],
  rack: [26, 20, g => { R(g, 2, 2, 2, 17, OL); R(g, 22, 2, 2, 17, OL); R(g, 1, 3, 24, 2, OL); for (let x = 4; x < 22; x += 2) R(g, x, 5, 1, 9, x % 4 ? '#c8a860' : '#a88840'); }],
  pot: [10, 10, g => { blob(g, 1, 2, 8, 7, '#8a5a3a', '#aa7a5a', '#6a3a22'); R(g, 3, 1, 4, 1, OL); }],
  hay: [16, 14, g => { blob(g, 1, 3, 14, 10, '#d8b860', '#f0d888', '#b89840'); R(g, 3, 6, 10, 1, '#a88838'); }],
  nobori: [8, 28, g => { R(g, 1, 0, 1, 27, OL); OR(g, 3, 2, 4, 18, '#d8402c'); R(g, 4, 5, 2, 1, '#fff'); R(g, 4, 9, 2, 1, '#fff'); R(g, 4, 13, 2, 1, '#fff'); }],
  stele: [12, 18, g => { OR(g, 2, 3, 8, 13, '#9a9a96'); R(g, 4, 5, 1, 9, '#6a6a66'); R(g, 7, 5, 1, 7, '#6a6a66'); OR(g, 1, 15, 10, 2, '#8a8a86'); }],
  okunoin: [48, 40, g => { roof(g, 4, 12, 40, 12, 8, { roof: '#6a5a4a', thatch: 1 }); OR(g, 8, 25, 32, 13, '#3a2a20'); for (let x = 10; x < 40; x += 4) R(g, x, 26, 1, 11, '#ffd070'); R(g, 4, 38, 40, 2, OL); }],
  desk: [16, 12, g => { OR(g, 1, 4, 14, 3, '#7a4a2a'); R(g, 2, 7, 1, 4, OL); R(g, 13, 7, 1, 4, OL); OR(g, 4, 2, 7, 2, '#f8f0e0'); }],
  pondsign: [14, 20, g => { OR(g, 6, 8, 2, 11, '#8a5a32'); OR(g, 1, 3, 12, 6, '#f0e0b0'); R(g, 3, 5, 8, 1, '#2a4a8a'); R(g, 3, 7, 6, 1, '#2a4a8a'); }],
  scaffold: [32, 30, g => { for (const x of [2, 14, 27]) R(g, x, 2, 2, 27, '#a87848'); for (const y of [6, 16, 26]) R(g, 0, y, 32, 2, '#c89a62'); }],
  ruins: [32, 20, g => { blob(g, 2, 10, 12, 8, '#a8a294', null, '#86807a'); blob(g, 16, 12, 14, 6, '#b8b0a0', null, '#86807a'); R(g, 6, 4, 3, 8, '#8a6a4a'); R(g, 22, 6, 3, 7, '#8a6a4a'); }],
  bell: [24, 30, g => { roof(g, 0, 4, 24, 8, 6, { roof: '#4f8f88', curl: 1 }); R(g, 3, 12, 2, 17, '#d24a2e'); R(g, 19, 12, 2, 17, '#d24a2e'); OR(g, 8, 14, 8, 10, '#5a6a5a'); R(g, 9, 15, 2, 8, '#7a8a7a'); OR(g, 1, 28, 22, 2, '#cfc6b4'); }],
  flagpole: [10, 30, g => { R(g, 1, 0, 1, 29, OL); OR(g, 3, 1, 6, 4, '#ecc444'); OR(g, 3, 6, 6, 4, '#d8402c'); OR(g, 3, 11, 6, 4, '#3a6a9a'); }]
};
function objSprite(type) { const d = OBJ[type]; return spr('o:' + type, d[0], d[1], d[2]); }
// 滝の2コマ目
function fallFrame(f) { return spr('fall' + f, 32, 58, g => { g.drawImage(objSprite('waterfall'), 0, 0); for (let x = 10; x < 22; x += 2) R(g, x, ((x * 7 + f * 5) % 9), 1, 44, f ? '#d0f0ff' : '#e8f8ff'); blob(g, 4, 48, 24, 9, '#e8f8ff', '#ffffff', '#c8ecff'); }); }

// ===================== 人物 =====================
function hairDraw(g, s, dir, hc, sk) {
  const hs = s.hair || 'top';
  const base = () => {
    if (dir === 0) { R(g, 3, 5, 10, 3, hc); R(g, 2, 6, 12, 2, hc); R(g, 2, 8, 1, 3, hc); R(g, 13, 8, 1, 3, hc); P(g, 5, 8, hc); P(g, 9, 8, hc); P(g, 10, 8, hc); }
    else if (dir === 1) { R(g, 3, 5, 10, 8, hc); R(g, 2, 6, 12, 6, hc); }
    else { R(g, 3, 5, 10, 3, hc); R(g, 2, 6, 12, 2, hc); R(g, 8, 8, 6, 4, hc); P(g, 9, 10, sk); }
  };
  if (hs === 'bald') { if (dir === 1) R(g, 4, 6, 8, 3, sh(sk, -.07)); else { P(g, 5, 6, sh(sk, .45)); P(g, 6, 6, sh(sk, .45)); P(g, 5, 7, sh(sk, .3)); } if (s.white) { if (dir === 0) R(g, 4, 12, 8, 2, '#f0f0f0'); } return; }
  if (hs === 'hood') { const c = '#f4f0e8'; if (dir === 1) shape(g, [[2, 4, 12, 12]], c); else shape(g, [[2, 4, 12, 4], [1, 6, 2, 9], [13, 6, 2, 9]], c); return; }
  base();
  switch (hs) {
    case 'mizura': if (dir === 2) shape(g, [[8, 9, 2, 4]], hc); else { shape(g, [[0, 8, 2, 4]], hc); shape(g, [[14, 8, 2, 4]], hc); P(g, 0, 8, '#e04040'); P(g, 15, 8, '#e04040'); } if (dir === 0) P(g, 8, 5, sk); break;
    case 'top': shape(g, [[7, 2, 2, 3]], hc); break;
    case 'eboshi': shape(g, [[4, 0, 8, 6]], '#1e1a20'); P(g, 9, 1, '#3c3640'); P(g, 6, 3, '#3c3640'); break;
    case 'kanmuri': shape(g, [[4, 2, 8, 4]], '#1e1a20'); shape(g, [[6, 0, 4, 3]], '#1e1a20'); if (dir === 1) shape(g, [[7, 6, 2, 9]], '#1e1a20'); if (dir === 2) shape(g, [[12, 2, 2, 8]], '#1e1a20'); break;
    case 'long': if (dir === 1) shape(g, [[3, 6, 10, 16]], hc); else if (dir === 2) shape(g, [[9, 7, 4, 14]], hc); else { shape(g, [[1, 7, 2, 13]], hc); shape(g, [[13, 7, 2, 13]], hc); } break;
    case 'bun': shape(g, [[6, 2, 4, 3]], hc); P(g, 9, 2, '#e0b040'); break;
    case 'child': shape(g, [[7, 3, 2, 2]], hc); break;
    case 'tang': shape(g, [[3, 2, 10, 5]], '#1e1a20'); shape(g, [[6, 0, 4, 3]], '#1e1a20'); if (dir !== 0) shape(g, [[dir === 2 ? 12 : 1, 5, 3, 1]], '#1e1a20'); break;
    case 'turban': shape(g, [[2, 2, 12, 5]], s.tc || '#f0ece0'); R(g, 2, 4, 12, 1, '#c04040'); break;
    case 'kasa': shape(g, [[4, 1, 8, 3], [0, 4, 16, 2]], '#d8b46a'); R(g, 1, 4, 14, 1, '#f0d08a'); break;
    case 'tokin': shape(g, [[6, 3, 4, 2]], '#1e1a20'); break;
    case 'crown': shape(g, [[4, 2, 8, 4]], '#1e1a20'); shape(g, [[6, 0, 4, 3]], '#1e1a20'); R(g, 4, 4, 8, 1, '#ecc444'); break;
  }
}
function drawChar(g, s, dir, f) {
  const sk = s.skin || '#f9d6b2', rb = s.robe || '#6a7a9a', rd = sh(rb, -.24), hc = s.hc || '#2b2328';
  const step = f === 1 ? 1 : f === 3 ? -1 : 0;
  g.fillStyle = 'rgba(40,25,10,.28)'; g.fillRect(4, 24, 8, 2); g.fillRect(3, 24, 1, 1); g.fillRect(12, 24, 1, 1);
  const lc = s.leg || '#4a3a30';
  if (s.seat) {
    g.translate(0, 3); g.clearRect(0, 20, 16, 9);
    g.fillStyle = 'rgba(40,25,10,.3)'; g.fillRect(1, 21, 14, 2);
    shape(g, [[1, 17, 14, 4]], sh(rb, -.1)); R(g, 1, 20, 14, 1, sh(rb, -.3));
  } else if (dir === 2) { shape(g, [[6 + step, 21, 2, 3]], lc); shape(g, [[8 - step, 21, 2, 3]], lc); }
  else { shape(g, [[5, 21, 2, step === 1 ? 2 : 3]], lc); shape(g, [[9, 21, 2, step === -1 ? 2 : 3]], lc); }
  shape(g, [[4, 14, 8, 5], [3, 18, 10, s.seat ? 2 : 3]], rb);
  R(g, 3, 20, 10, 1, rd);
  if (s.layer) { R(g, 3, 19, 10, 1, s.layer); R(g, 3, 20, 10, 1, sh(s.layer, .35)); }
  if (dir === 0) { const cl = s.collar || '#fffaf0'; P(g, 6, 14, cl); P(g, 7, 15, cl); P(g, 9, 14, cl); P(g, 8, 15, cl); R(g, 8, 16, 1, 3, rd); }
  if (s.kesa) { const k = s.kesa; if (dir === 0) for (let i = 0; i < 7; i++) R(g, 4 + i, 14 + i, 2, 1, k); else if (dir === 1) for (let i = 0; i < 7; i++) R(g, 10 - i, 14 + i, 2, 1, k); else R(g, 7, 14, 2, 7, k); }
  if (s.belt) R(g, 4, 18, 8, 1, s.belt);
  if (dir === 2) { shape(g, [[7 - step, 15, 3, 5]], rd); R(g, 7 - step, 19, 3, 1, sk); }
  else { shape(g, [[2, 15, 2, 5]], rb); shape(g, [[12, 15, 2, 5]], rb); if (dir === 0) { R(g, 2, 19, 2, 1, sk); R(g, 12, 19, 2, 1, sk); } }
  shape(g, [[3, 5, 10, 9], [2, 6, 12, 7]], sk);
  hairDraw(g, s, dir, hc, sk);
  const e = '#2a1a14';
  if (dir === 0) {
    if (s.happy) { P(g, 4, 10, e); P(g, 5, 9, e); P(g, 6, 10, e); P(g, 9, 10, e); P(g, 10, 9, e); P(g, 11, 10, e); }
    else { R(g, 5, 9, 1, 2, e); R(g, 10, 9, 1, 2, e); }
    R(g, 4, 11, 2, 1, '#f5a2a0'); R(g, 10, 11, 2, 1, '#f5a2a0');
    if (s.beard) { R(g, 5, 12, 6, 2, s.beard); P(g, 4, 12, s.beard); P(g, 11, 12, s.beard); }
  } else if (dir === 2) {
    R(g, 4, 9, 1, 2, e); R(g, 3, 11, 2, 1, '#f5a2a0');
    if (s.beard) R(g, 2, 12, 5, 2, s.beard);
  }
  if (s.staff) { const x = dir === 2 ? 3 : 14; R(g, x, 4, 1, 20, '#6a4a2a'); OR(g, x - 1, 1, 3, 3, '#e0b040'); }
  if (s.fan && dir !== 1) { OR(g, 0, 14, 4, 3, '#f0d060'); P(g, 1, 14, '#e05040'); }
}
function specKey(s) { return s._k || (s._k = JSON.stringify(s)); }
function charSprite(s, dir, f) {
  if (s.animal) return animalSprite(s.animal, dir, f);
  const key = 'c:' + specKey(s) + dir + f;
  if (SPR[key]) return SPR[key];
  if (dir === 3) return SPR[key] = flipC(charSprite(s, 2, f));
  const [c, g] = mk(16, 26); drawChar(g, s, dir, f); return SPR[key] = c;
}

// ===================== 動物 =====================
const ANI = {
  deer: (g, f) => { const c = '#b4783e', l = f % 2; shape(g, [[6 + l, 15, 1, 4], [14 - l, 15, 1, 4], [8 - l, 15, 1, 4], [12 + l, 15, 1, 4]], '#7a4a28'); shape(g, [[5, 9, 11, 6]], c); for (const [x, y] of [[8, 10], [11, 11], [13, 10], [9, 12]]) P(g, x, y, '#fff4e0'); shape(g, [[4, 5, 3, 6]], c); shape(g, [[1, 4, 5, 3]], c); P(g, 2, 5, OL); R(g, 4, 1, 1, 3, '#e8d8b0'); R(g, 6, 1, 1, 3, '#e8d8b0'); P(g, 3, 1, '#e8d8b0'); P(g, 7, 1, '#e8d8b0'); R(g, 16, 9, 1, 2, '#fff'); },
  cow: (g, f) => { const c = '#4a3a34', l = f % 2; shape(g, [[5 + l, 15, 2, 4], [15 - l, 15, 2, 4]], '#2a2020'); shape(g, [[4, 8, 14, 7]], c); R(g, 9, 9, 4, 3, '#6a5a52'); shape(g, [[0, 7, 5, 6]], c); R(g, 1, 11, 3, 2, '#c8a090'); P(g, 1, 9, '#fff'); R(g, 0, 5, 1, 2, '#e8e0d0'); R(g, 4, 5, 1, 2, '#e8e0d0'); R(g, 18, 9, 1, 5, OL); },
  horse: (g, f) => { const c = '#8a5a32', l = f % 2; shape(g, [[5 + l, 14, 1, 5], [8 - l, 14, 1, 5], [13 + l, 14, 1, 5], [16 - l, 14, 1, 5]], '#5a3a20'); shape(g, [[5, 8, 13, 6]], c); shape(g, [[3, 3, 3, 7]], c); shape(g, [[0, 3, 5, 3]], c); P(g, 2, 4, OL); R(g, 5, 3, 1, 6, '#3a2010'); R(g, 18, 9, 2, 6, '#3a2010'); },
  chicken: (g, f) => { shape(g, [[7, 9, 7, 5]], '#f8f4ec'); shape(g, [[5, 6, 4, 4]], '#f8f4ec'); R(g, 6, 4, 2, 2, '#e03030'); P(g, 4, 8, '#f0b030'); P(g, 6, 7, OL); R(g, 14, 8, 2, 3, '#e8e0d0'); R(g, 9, 14, 1, 2 + (f % 2), '#e0a030'); R(g, 11, 14, 1, 3 - (f % 2), '#e0a030'); },
  cat: (g, f) => { const c = '#e8a050'; shape(g, [[6, 11, 9, 4]], c); shape(g, [[3, 8, 5, 5]], c); P(g, 3, 7, OL); P(g, 7, 7, OL); P(g, 4, 10, OL); R(g, 15, 8 + (f % 2), 1, 4, c); R(g, 7, 15, 1, 2, c); R(g, 13, 15, 1, 2, c); R(g, 9, 12, 3, 1, '#c87830'); },
  rabbit: (g, f) => { const c = '#fafaf4'; shape(g, [[6, 11 - (f % 2), 8, 5]], c); shape(g, [[4, 8 - (f % 2), 5, 5]], c); shape(g, [[5, 3 - (f % 2), 1, 5], [7, 3 - (f % 2), 1, 5]], c); P(g, 5, 10 - (f % 2), '#e04060'); },
  monkey: (g, f) => { const c = '#9a7a5a'; shape(g, [[6, 10, 8, 6]], c); shape(g, [[4, 5, 7, 6]], c); R(g, 5, 7, 5, 3, '#f0a090'); P(g, 6, 7, OL); P(g, 9, 7, OL); R(g, 14, 9 + (f % 2), 2, 1, c); R(g, 7, 16, 2, 1, c); R(g, 11, 16, 2, 1, c); },
  dog: (g, f) => { const c = '#d8a060', l = f % 2; shape(g, [[6 + l, 14, 1, 3], [13 - l, 14, 1, 3]], c); shape(g, [[5, 9, 10, 5]], c); shape(g, [[2, 6, 5, 5]], c); R(g, 2, 9, 3, 2, '#fff4e0'); P(g, 3, 7, OL); P(g, 3, 5, OL); P(g, 6, 5, OL); shape(g, [[15, 6, 2, 3]], c); }
};
function animalSprite(type, dir, f) {
  const left = dir === 2 || dir === 0, k = 'a:' + type + (left ? 'L' : 'R') + (f % 2);
  if (SPR[k]) return SPR[k];
  if (!left) return SPR[k] = flipC(animalSprite(type, 2, f));
  const [c, g] = mk(20, 20); g.fillStyle = 'rgba(40,25,10,.25)'; g.fillRect(4, 18, 12, 2); ANI[type](g, f % 2); return SPR[k] = c;
}

// ===================== マーカー =====================
function markSprite(kind) {
  return spr('m:' + kind, 9, 12, g => {
    if (kind === '!') { shape(g, [[3, 0, 3, 7], [3, 9, 3, 3]], '#ffd84a'); }
    else if (kind === 'v') { for (let r = 0; r < 6; r++) { R(g, r, r, 9 - 2 * r, 1, OL); R(g, r + 1, r, Math.max(0, 7 - 2 * r), 1, '#ff5a3a'); } R(g, 2, 0, 5, 1, '#ff9a6a'); }
    else if (kind === '?') { shape(g, [[2, 0, 5, 2], [5, 2, 2, 3], [3, 5, 3, 2], [3, 9, 3, 3]], '#9ad0ff'); }
  });
}

// ===================== 室内の家具 =====================
function lampGlowSpr() { return spr('lampglow', 40, 40, g => { const gr = g.createRadialGradient(20, 20, 0, 20, 20, 20); gr.addColorStop(0, 'rgba(255,210,130,.55)'); gr.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 40, 40); }); }
Object.assign(OBJ, {
  altar: [64, 44, g => {
    OR(g, 2, 30, 60, 12, '#3a1e14'); R(g, 2, 30, 60, 2, '#c8402a'); R(g, 4, 34, 56, 1, '#5a2e1e');
    OR(g, 8, 24, 48, 7, '#7a2a1a'); R(g, 8, 24, 48, 1, '#e0b040');
    circ(g, 32, 12, 11, '#e8c050'); circ(g, 32, 12, 9, '#f8e090');
    shape(g, [[24, 14, 16, 10]], '#d8a830'); shape(g, [[27, 6, 10, 9]], '#e8c050'); R(g, 29, 9, 2, 1, '#8a6010'); R(g, 33, 9, 2, 1, '#8a6010'); shape(g, [[29, 3, 6, 3]], '#3a3a5a');
    for (const x of [12, 50]) { R(g, x, 16, 2, 8, '#f4f0e0'); P(g, x, 14, '#ffd040'); P(g, x, 15, '#ff8a2a'); OR(g, x - 2, 22, 6, 2, '#c8a040'); }
    for (const x of [4, 56]) { OR(g, x, 18, 4, 6, '#8a5a3a'); R(g, x - 1, 15, 2, 3, '#e04060'); R(g, x + 2, 14, 2, 3, '#f0f0f0'); R(g, x + 1, 16, 2, 2, '#5aa040'); }
  }],
  cushion: [14, 10, g => { OR(g, 1, 3, 12, 6, '#7a3a7a'); R(g, 2, 3, 10, 1, '#a060a0'); P(g, 6, 5, '#e0c060'); }],
  futon: [16, 30, g => { OR(g, 1, 2, 14, 27, '#f2eee4'); OR(g, 2, 9, 12, 19, '#4a6aa8'); for (let y = 11; y < 27; y += 4) R(g, 2, y, 12, 1, '#6a8ac8'); OR(g, 4, 3, 8, 4, '#e8d8b0'); }],
  shelf: [32, 30, g => { OR(g, 1, 1, 30, 28, '#5a3a20'); for (const y of [3, 11, 19]) { R(g, 2, y, 28, 7, '#3a2414'); for (let x = 3; x < 29; x += 3) R(g, x, y + 1 + (x % 2), 2, 6 - (x % 2), ['#e8d8a8', '#c8a060', '#a84a3a', '#5a6a8a', '#f0ece0'][(x + y) % 5]); } R(g, 2, 27, 28, 1, '#3a2414'); }],
  andon: [10, 28, g => { R(g, 4, 14, 2, 13, '#3a2414'); OR(g, 1, 25, 8, 2, '#3a2414'); OR(g, 1, 3, 8, 11, '#f8ecc8'); R(g, 2, 4, 6, 9, '#ffe8a0'); R(g, 1, 8, 8, 1, '#5a3a20'); R(g, 4, 0, 2, 3, '#3a2414'); }],
  byobu: [34, 26, g => { for (let i = 0; i < 4; i++) { OR(g, 1 + i * 8, 2, 8, 22, i % 2 ? '#e8c860' : '#f0d470'); } R(g, 6, 12, 20, 2, '#3a5a3a'); R(g, 10, 8, 10, 4, '#2a6a4a'); R(g, 14, 5, 6, 3, '#3a7a5a'); R(g, 14, 14, 2, 8, '#5a3a2a'); }],
  tansu: [16, 22, g => { OR(g, 1, 2, 14, 19, '#7a4a28'); for (const y of [7, 12, 17]) R(g, 1, y, 14, 1, '#4a2a14'); for (const y of [4, 9, 14, 19]) P(g, 8, y, '#e0b040'); }],
  hibachi: [16, 14, g => { OR(g, 2, 4, 12, 9, '#6a4a3a'); R(g, 3, 5, 10, 3, '#c8c0b0'); P(g, 6, 6, '#ff6a2a'); P(g, 9, 6, '#ff9a3a'); P(g, 8, 5, '#ffd040'); }],
  kakejiku: [14, 30, g => { R(g, 2, 2, 10, 1, '#5a3a20'); OR(g, 3, 3, 8, 22, '#f4ecd8'); R(g, 3, 3, 8, 3, '#7a6a5a'); R(g, 6, 9, 2, 10, '#1a1a1a'); P(g, 5, 12, '#1a1a1a'); P(g, 8, 15, '#1a1a1a'); R(g, 2, 25, 10, 2, '#5a3a20'); }],
  shojiW: [32, 26, g => { OR(g, 1, 3, 30, 20, '#fffbe8'); for (let x = 1; x < 31; x += 6) R(g, x, 3, 1, 20, '#6a4428'); for (let y = 3; y < 23; y += 5) R(g, 1, y, 30, 1, '#6a4428'); }],
  counter: [48, 24, g => { OR(g, 1, 10, 46, 13, '#7a4a28'); R(g, 1, 10, 46, 2, '#a87848'); const gc = ['#f8f4ec', '#e85a3a', '#f0c040', '#6ab04a', '#c08040', '#2a2a2a']; for (let i = 0; i < 9; i++) OR(g, 3 + i * 5, 6, 3, 4, gc[i % 6]); }],
  goods: [32, 30, g => { OR(g, 1, 1, 30, 28, '#6a4428'); for (const y of [3, 12]) { R(g, 2, y, 28, 8, '#4a2c18'); for (let x = 3; x < 28; x += 6) OR(g, x + 1, y + 3, 4, 5, ['#8a5a3a', '#c8b080', '#5a6a5a', '#a88050'][(x + y) % 4]); } OR(g, 3, 21, 11, 7, '#e8d8a8'); OR(g, 17, 21, 11, 7, '#e8d8a8'); R(g, 3, 23, 11, 1, '#a89060'); R(g, 17, 23, 11, 1, '#a89060'); }],
  barrel: [12, 14, g => { OR(g, 1, 2, 10, 11, '#9a6a3a'); R(g, 1, 4, 10, 1, '#4a3a2a'); R(g, 1, 10, 10, 1, '#4a3a2a'); R(g, 2, 2, 8, 1, '#e8e0d0'); }],
  mapdesk: [32, 18, g => { OR(g, 1, 6, 30, 6, '#6a3a20'); R(g, 3, 12, 2, 5, OL); R(g, 27, 12, 2, 5, OL); OR(g, 4, 2, 24, 6, '#efe2b8'); R(g, 8, 4, 6, 2, '#5a9a5a'); R(g, 16, 3, 8, 3, '#5a9a5a'); P(g, 12, 5, '#c8402a'); P(g, 20, 4, '#c8402a'); }],
  deskI: [32, 16, g => { OR(g, 1, 5, 30, 4, '#5a3220'); R(g, 3, 9, 2, 6, OL); R(g, 27, 9, 2, 6, OL); OR(g, 5, 2, 12, 3, '#fbf6ea'); R(g, 7, 3, 6, 1, '#1a1a1a'); OR(g, 21, 3, 4, 2, '#2a2a2a'); R(g, 26, 1, 1, 4, '#8a6a42'); }],
  tableI: [32, 18, g => { OR(g, 1, 6, 30, 5, '#7a2a1a'); R(g, 1, 6, 30, 1, '#a8402a'); R(g, 3, 11, 2, 6, OL); R(g, 27, 11, 2, 6, OL); OR(g, 6, 3, 3, 3, '#f0ece0'); OR(g, 14, 2, 4, 4, '#c8a050'); OR(g, 23, 3, 3, 3, '#f0ece0'); }],
  bench: [32, 12, g => { OR(g, 1, 3, 30, 4, '#c8382e'); R(g, 1, 3, 30, 1, '#e85848'); R(g, 3, 7, 1, 4, OL); R(g, 28, 7, 1, 4, OL); OR(g, 10, 1, 3, 2, '#f0ece0'); }],
  pillarI: [12, 44, g => { OR(g, 2, 2, 8, 41, '#7a4a28'); R(g, 3, 2, 2, 41, '#9a6a40'); OR(g, 1, 40, 10, 3, '#c8c0b0'); }],
  pillarR: [12, 44, g => { OR(g, 2, 2, 8, 41, '#b8302a'); R(g, 3, 2, 2, 41, '#d85040'); OR(g, 1, 40, 10, 3, '#c8c0b0'); }],
  strawmat: [16, 12, g => { OR(g, 1, 3, 14, 8, '#c8b070'); for (let x = 2; x < 15; x += 2) R(g, x, 3, 1, 8, '#a89050'); }],
  irori: [18, 16, g => { OR(g, 1, 4, 16, 10, '#4a3a2a'); R(g, 3, 6, 12, 6, '#8a8078'); P(g, 8, 8, '#ff6a2a'); P(g, 10, 9, '#ffd040'); R(g, 8, 0, 1, 8, OL); OR(g, 6, 5, 5, 3, '#2a2a2a'); }],
  saisen: [24, 16, g => { OR(g, 1, 4, 22, 11, '#6a3a1e'); for (let x = 3; x < 22; x += 3) R(g, x, 4, 1, 4, '#3a1e0e'); R(g, 1, 9, 22, 1, '#e0b040'); }],
  censer: [12, 14, g => { OR(g, 2, 6, 8, 6, '#6a6a5a'); R(g, 3, 6, 6, 1, '#9a9a8a'); R(g, 5, 1, 1, 5, 'rgba(240,240,240,.7)'); R(g, 6, 0, 1, 3, 'rgba(240,240,240,.5)'); }],
  misu: [64, 22, g => { R(g, 0, 0, 64, 3, '#5a3a20'); for (let x = 0; x < 64; x += 2) R(g, x, 3, 1, 16, x % 4 ? '#c8a860' : '#a88840'); R(g, 0, 18, 64, 2, '#a8402a'); for (const x of [10, 54]) { R(g, x, 8, 1, 12, '#c8402a'); OR(g, x - 1, 19, 3, 3, '#e0b040'); } }],
  lanternR: [10, 16, g => { R(g, 4, 0, 2, 3, OL); OR(g, 1, 3, 8, 10, '#e2402c'); R(g, 1, 6, 8, 1, '#b02a1a'); R(g, 1, 10, 8, 1, '#b02a1a'); R(g, 3, 4, 2, 7, '#ff8a6a'); }]
});

// ===================== アイテムのアイコン =====================
const ICON = {
  food: g => { for (let r = 0; r < 9; r++) { const w = 2 + r; R(g, 6 - (w >> 1) - 1, 2 + r, w + 2, 1, OL); R(g, 6 - (w >> 1), 2 + r, w, 1, '#fbfaf4'); } R(g, 3, 8, 7, 3, '#1e2a1e'); R(g, 3, 8, 7, 1, '#3a4a3a'); },
  ink: g => { OR(g, 4, 1, 4, 10, '#1a1a1e'); R(g, 4, 4, 4, 3, '#d8b040'); P(g, 5, 2, '#4a4a5a'); },
  incense: g => { for (const x of [4, 6, 8]) R(g, x, 4, 1, 7, '#6a8a4a'); OR(g, 3, 8, 7, 2, '#c84a3a'); R(g, 6, 1, 1, 2, 'rgba(220,220,220,.9)'); P(g, 7, 0, 'rgba(220,220,220,.7)'); },
  brush: g => { R(g, 5, 1, 2, 8, '#a87a4a'); OR(g, 4, 8, 4, 3, '#2a2a2a'); P(g, 5, 11, '#1a1a1a'); },
  book: g => { OR(g, 1, 3, 10, 7, '#e8dcb0'); R(g, 1, 3, 2, 7, '#8a5a2a'); R(g, 9, 3, 2, 7, '#8a5a2a'); R(g, 4, 5, 4, 1, '#3a2a1a'); R(g, 4, 7, 3, 1, '#3a2a1a'); },
  money: g => { circ(g, 6, 6, 4, OL); circ(g, 6, 6, 3, '#d8a830'); R(g, 5, 5, 2, 2, '#5a3a10'); }
};
const ITEM_NAME = { food: '握り飯', ink: '上質な墨', incense: '香', brush: '唐の名筆', money: '銭' };
function itemIcon(k) { return spr('i:' + k, 12, 12, ICON[k] || ICON.money); }

// 青海波（室内の外側の背景）
function seigaiha() {
  return spr('seigaiha', 32, 16, g => {
    R(g, 0, 0, 32, 16, '#1c2858');
    const arc = (cx, cy) => { for (const [r, c] of [[8, '#3a4c8c'], [6, '#1c2858'], [5, '#30427e'], [3, '#1c2858'], [2, '#2a3a72']]) { for (let a = Math.PI; a <= Math.PI * 2; a += .05) P(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); } };
    for (const [cx, cy] of [[0, 8], [16, 8], [32, 8], [8, 16], [24, 16], [8, 0], [24, 0], [0, 24], [16, 24]]) arc(cx, cy);
  });
}
// 会話用の顔（スプライトの頭部を切り出す）
function faceCanvas(spec) {
  const k = 'face:' + specKey(spec); if (SPR[k]) return SPR[k];
  const s = Object.assign({}, spec, { seat: false }); s._k = null;
  const src = charSprite(s, 0, 0); const [c, g] = mk(16, 16); g.fillStyle = '#e8dcb8'; g.fillRect(0, 0, 16, 16); g.drawImage(src, 0, 0, 16, 16, 0, 0, 16, 16);
  return SPR[k] = c;
}
