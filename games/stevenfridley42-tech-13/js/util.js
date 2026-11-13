'use strict';
// フィールド寸法（ヤード）: x=0..120（0-10と110-120がエンドゾーン）, y=0..53.33
const FIELD = { LEN: 120, WID: 160 / 3, HASH1: 23.583, HASH2: 29.75, GRAV: 10.7 };

const U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  rnd: (a, b) => a + Math.random() * (b - a),
  rint: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  chance: p => Math.random() < p,
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
  len: (x, y) => Math.hypot(x, y),
  norm(x, y) { const l = Math.hypot(x, y); return l > 1e-6 ? { x: x / l, y: y / l, l } : { x: 0, y: 0, l: 0 }; },
  gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  weighted(items, wf) {
    let tot = 0; const ws = items.map(i => { const w = Math.max(0, wf(i)); tot += w; return w; });
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  },
  fmtClock(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  ord(n) { return ['', '1st', '2nd', '3rd', '4th'][n] || n + 'th'; },
  qName(q) { return q <= 4 ? U.ord(q) : 'OT'; },
  // オフェンスの自陣ゴールからの距離(0-100) → ワールドx
  xFromBallOn(ballOn, dir) { return dir === 1 ? 10 + ballOn : 110 - ballOn; },
  ballOnFromX(x, dir) { return dir === 1 ? x - 10 : 110 - x; },
  // "OWN 25" / "OPP 30" 表記
  spotText(ballOn, abbrOwn, abbrOpp) {
    const b = Math.round(ballOn);
    if (b === 50) return '50';
    return b < 50 ? abbrOwn + ' ' + b : abbrOpp + ' ' + (100 - b);
  },
  el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  },
};
