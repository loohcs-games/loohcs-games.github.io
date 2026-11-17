'use strict';
// =====================================================================
//  scenes.js — 一枚絵（イベントCG）＋語りの演出
//  すべての絵はコードで描く（絵画風：グラデーション・霞・紙の質感）
// =====================================================================
const SW = 960, SH = 600;
const SCN = { active: false };

// ---------- 基本の描画道具 ----------
function lg(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
function skyP(g, stops) { g.fillStyle = lg(g, 0, 0, 0, SH, stops); g.fillRect(0, 0, SW, SH); }
function glow(g, x, y, r, c, a = 1) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }
function ridge(g, base, amp, col, seed, freq = 1) {
  g.fillStyle = col; g.beginPath(); g.moveTo(0, SH);
  for (let x = 0; x <= SW; x += 6) { const y = base - amp * (.5 + .3 * Math.sin(x * .006 * freq + seed) + .2 * Math.sin(x * .017 * freq + seed * 2.3) + .08 * Math.sin(x * .05 + seed * 5)); g.lineTo(x, y); }
  g.lineTo(SW, SH); g.fill();
}
function mist(g, y, h, a = .6, c = '255,255,255') { const gr = g.createLinearGradient(0, y - h, 0, y + h); gr.addColorStop(0, 'rgba(' + c + ',0)'); gr.addColorStop(.5, 'rgba(' + c + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)'); g.fillStyle = gr; g.fillRect(0, y - h, SW, h * 2); }
function seaP(g, y, c1, c2, t, refl) {
  g.fillStyle = lg(g, 0, y, 0, SH, [c1, c2]); g.fillRect(0, y, SW, SH - y);
  if (refl) { const gr = g.createLinearGradient(0, y, 0, SH); gr.addColorStop(0, refl.c); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.globalAlpha = .5; g.beginPath(); g.moveTo(refl.x - 10, y); g.lineTo(refl.x + 10, y); g.lineTo(refl.x + 120, SH); g.lineTo(refl.x - 120, SH); g.fill(); g.globalAlpha = 1; }
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
  for (let i = 0; i < 46; i++) { const d = (i % 9) / 9, yy = y + 6 + Math.pow(d, 1.6) * (SH - y), x = ((h2(i, 3, 7) * SW + t * .02 * (1 + d)) % (SW + 100)) - 50, w = 10 + d * 50; g.globalAlpha = .25 + d * .4; g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + w / 2, yy - 3 - d * 4, x + w, yy); g.stroke(); }
  g.globalAlpha = 1;
}
function cloudP(g, x, y, w, c, a = .8) {
  g.globalAlpha = a; g.fillStyle = c; g.beginPath();
  for (let i = 0; i < 6; i++) { const cx = x + (i - 2.5) * w * .16, cy = y + Math.sin(i * 1.7) * w * .03, rx = w * .16, ry = w * .07 + (i % 2) * w * .03; g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
  g.fill(); g.globalAlpha = a * .35; g.fillStyle = 'rgba(120,130,160,1)'; g.beginPath(); g.ellipse(x, y + w * .07, w * .42, w * .03, 0, 0, 7); g.fill(); g.globalAlpha = 1;
}
function raysP(g, x, y, c, a = .18, n = 7, len = 900) { g.save(); g.globalAlpha = a; g.fillStyle = c; for (let i = 0; i < n; i++) { const an = Math.PI * (.15 + .7 * i / (n - 1)); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an - .04) * len, y + Math.sin(an - .04) * len); g.lineTo(x + Math.cos(an + .04) * len, y + Math.sin(an + .04) * len); g.fill(); } g.restore(); }
function particles(g, t, n, kind, seed = 1) {
  for (let i = 0; i < n; i++) {
    const r = h2(i, seed, 9), r2 = h2(i, seed, 10);
    if (kind === 'rain') { const x = (r * SW + t * .3) % SW, y = (r2 * SH + t * 1.1) % SH; g.strokeStyle = 'rgba(210,225,255,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 22); g.stroke(); }
    else if (kind === 'petal') { const x = (r * SW + t * .04 + Math.sin(t / 900 + i) * 30) % SW, y = (r2 * SH + t * .05) % SH; g.fillStyle = 'rgba(255,200,220,.85)'; g.beginPath(); g.ellipse(x, y, 4, 2.5, t / 600 + i, 0, 7); g.fill(); }
    else if (kind === 'snow') { const x = (r * SW + Math.sin(t / 1200 + i) * 20) % SW, y = (r2 * SH + t * .04) % SH; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x, y, 1.5 + r * 2, 0, 7); g.fill(); }
    else if (kind === 'star') { g.fillStyle = 'rgba(255,255,240,' + (.3 + .6 * Math.abs(Math.sin(t / 900 + i))) + ')'; g.fillRect(r * SW, r2 * SH * .55, 2, 2); }
    else if (kind === 'firefly' || kind === 'spark') { const x = r * SW + Math.sin(t / 700 + i) * 20, y = SH - ((r2 * SH + t * .03) % SH); glow(g, x, y, 8, kind === 'spark' ? 'rgba(255,220,120,.9)' : 'rgba(200,255,160,.8)'); }
    else if (kind === 'leaf') { const x = (r * SW + t * .05 + Math.sin(t / 700 + i) * 25) % SW, y = (r2 * SH + t * .06) % SH; g.fillStyle = i % 2 ? 'rgba(220,90,40,.9)' : 'rgba(240,160,40,.9)'; g.beginPath(); g.ellipse(x, y, 5, 3, t / 500 + i, 0, 7); g.fill(); }
  }
}
// 紙の質感と周辺減光
let NOISE = null;
function finish(g, warm = .12) {
  if (!NOISE) { const [c, x] = mk(256, 256); const id = x.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = 110 + Math.random() * 145; id.data[i] = v; id.data[i + 1] = v * .96; id.data[i + 2] = v * .88; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); NOISE = g.createPattern(c, 'repeat'); }
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .13; g.fillStyle = NOISE; g.fillRect(0, 0, SW, SH); g.restore();
  g.save(); g.globalAlpha = warm; g.fillStyle = '#c89a50'; g.globalCompositeOperation = 'soft-light'; g.fillRect(0, 0, SW, SH); g.restore();
  const v = g.createRadialGradient(SW / 2, SH / 2, SH * .35, SW / 2, SH / 2, SH * .95); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, SW, SH);
}

// ---------- 人物（絵画風） ----------
function figure(g, x, y, H, o = {}) {
  const robe = o.robe || '#3a3a4a', sk = o.skin || '#ecc9a4', hair = o.hairC || '#1c1418', pose = o.pose || 'stand', back = !!o.back, head = o.head || 'shaved';
  g.save(); g.translate(x, y); if (o.flip) g.scale(-1, 1); if (o.alpha != null) g.globalAlpha = o.alpha;
  g.lineJoin = 'round'; g.lineCap = 'round';
  const seated = pose === 'zazen' || pose === 'write' || pose === 'kneel' || pose === 'kgassho';
  const top = seated ? -H * .6 : -H * .78, hy = top - H * .095;
  const L = 'rgba(25,15,10,.55)';
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, 0, H * (seated ? .36 : .25), H * .035, 0, 0, 7); g.fill();
  if (head === 'long' || head === 'longback') { g.fillStyle = hair; g.beginPath(); g.moveTo(-H * .075, hy - H * .05); g.quadraticCurveTo(-H * .19, top + H * .25, -H * .13, top + H * (seated ? .45 : .62)); g.lineTo(H * .13, top + H * (seated ? .45 : .62)); g.quadraticCurveTo(H * .19, top + H * .25, H * .075, hy - H * .05); g.fill(); }
  // 体
  const rg = g.createLinearGradient(-H * .3, 0, H * .3, 0); rg.addColorStop(0, sh(robe, .22)); rg.addColorStop(.45, robe); rg.addColorStop(1, sh(robe, -.4));
  g.fillStyle = rg; g.strokeStyle = L; g.lineWidth = Math.max(1, H * .007);
  g.beginPath(); g.moveTo(-H * .15, top);
  if (seated) { g.quadraticCurveTo(-H * .25, top + H * .32, -H * .36, -H * .02); g.quadraticCurveTo(0, H * .045, H * .36, -H * .02); g.quadraticCurveTo(H * .25, top + H * .32, H * .15, top); }
  else { g.quadraticCurveTo(-H * .25, top + H * .42, -H * .235, 0); g.quadraticCurveTo(0, H * .02, H * .235, 0); g.quadraticCurveTo(H * .25, top + H * .42, H * .15, top); }
  g.quadraticCurveTo(0, top - H * .035, -H * .15, top); g.fill(); g.stroke();
  // 衣のしわ
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = Math.max(1, H * .006);
  for (const k of [-.12, -.04, .06, .14]) { g.beginPath(); g.moveTo(H * k * .7, top + H * .12); g.quadraticCurveTo(H * k * 1.3, top + H * .4, H * k * 1.5, seated ? -H * .04 : -H * .02); g.stroke(); }
  if (o.layer) { g.fillStyle = o.layer; g.beginPath(); g.moveTo(-H * .235, -H * .03); g.quadraticCurveTo(0, -H * .0, H * .235, -H * .03); g.lineTo(H * .235, 0); g.quadraticCurveTo(0, H * .02, -H * .235, 0); g.fill(); }
  if (o.kesa && !back) { g.strokeStyle = o.kesa; g.globalAlpha = (o.alpha ?? 1) * .93; g.lineWidth = H * .065; g.beginPath(); g.moveTo(-H * .13, top + H * .015); g.quadraticCurveTo(-H * .02, top + H * .22, H * .17, seated ? -H * .1 : top + H * .52); g.stroke(); g.globalAlpha = o.alpha ?? 1; g.strokeStyle = sh(o.kesa, -.35); g.lineWidth = Math.max(1, H * .006); for (let i = 1; i < 5; i++) { const u = i / 5; const px = -H * .13 + (H * .3) * u, py = top + H * .015 + (seated ? H * .45 : H * .5) * u; g.beginPath(); g.moveTo(px - H * .03, py + H * .02); g.lineTo(px + H * .03, py - H * .03); g.stroke(); } }
  if (!back) { g.strokeStyle = o.collar || '#f3ede2'; g.lineWidth = H * .022; g.beginPath(); g.moveTo(-H * .055, top - H * .01); g.lineTo(0, top + H * .13); g.lineTo(H * .055, top - H * .01); g.stroke(); }
  // 腕・手
  const sleeve = sh(robe, -.12);
  const arm = (pts, hand) => { g.fillStyle = sleeve; g.strokeStyle = L; g.lineWidth = Math.max(1, H * .007); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); g.stroke(); if (hand) { g.fillStyle = sk; g.beginPath(); g.ellipse(hand[0], hand[1], H * .028, H * .022, 0, 0, 7); g.fill(); } };
  if (!back) {
    if (pose === 'gassho' || pose === 'kgassho') {
      arm([[-H * .15, top + H * .02], [-H * .2, top + H * .2], [-H * .02, top + H * .3], [0, top + H * .2]]); arm([[H * .15, top + H * .02], [H * .2, top + H * .2], [H * .02, top + H * .3], [0, top + H * .2]]);
      g.fillStyle = sk; g.beginPath(); g.moveTo(-H * .02, top + H * .22); g.lineTo(0, top + H * .07); g.lineTo(H * .02, top + H * .22); g.fill();
    } else if (pose === 'wave') {
      arm([[-H * .15, top + H * .02], [-H * .21, top + H * .3], [-H * .04, top + H * .36], [-H * .02, top + H * .22]], [-H * .02, top + H * .36]);
      arm([[H * .12, top + H * .01], [H * .27, top - H * .2], [H * .33, top - H * .16], [H * .2, top + H * .12]], [H * .31, top - H * .23]);
    } else if (pose === 'write') {
      arm([[-H * .15, top + H * .02], [-H * .2, top + H * .3], [-H * .02, top + H * .38], [0, top + H * .26]]);
      arm([[H * .13, top + H * .02], [H * .34, top + H * .3], [H * .36, top + H * .38], [H * .16, top + H * .3]], [H * .37, top + H * .38]);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = H * .012; g.beginPath(); g.moveTo(H * .37, top + H * .3); g.lineTo(H * .4, top + H * .47); g.stroke();
    } else if (pose === 'zazen' || pose === 'kneel') {
      arm([[-H * .15, top + H * .02], [-H * .25, top + H * .36], [-H * .02, top + H * .5], [-H * .05, top + H * .3]]); arm([[H * .15, top + H * .02], [H * .25, top + H * .36], [H * .02, top + H * .5], [H * .05, top + H * .3]]);
      g.fillStyle = sk; g.beginPath(); g.ellipse(0, top + H * .49, H * .05, H * .025, 0, 0, 7); g.fill();
    } else if (pose === 'baby') {
      arm([[-H * .15, top + H * .02], [-H * .2, top + H * .25], [H * .05, top + H * .32], [0, top + H * .2]]); arm([[H * .15, top + H * .02], [H * .2, top + H * .25], [-H * .02, top + H * .34], [0, top + H * .24]]);
      g.fillStyle = '#f6f0e6'; g.beginPath(); g.ellipse(H * .02, top + H * .2, H * .09, H * .06, -.3, 0, 7); g.fill(); g.fillStyle = sk; g.beginPath(); g.arc(-H * .04, top + H * .17, H * .035, 0, 7); g.fill();
    } else {
      arm([[-H * .15, top + H * .02], [-H * .22, top + H * .34], [-H * .02, top + H * .42], [-H * .03, top + H * .28]]); arm([[H * .15, top + H * .02], [H * .22, top + H * .34], [H * .02, top + H * .42], [H * .03, top + H * .28]]);
      g.fillStyle = sk; g.beginPath(); g.ellipse(0, top + H * .41, H * .04, H * .025, 0, 0, 7); g.fill();
    }
  }
  if (o.staff) { const sx = H * .26; g.strokeStyle = '#5a3a1a'; g.lineWidth = H * .016; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, top - H * .32); g.stroke(); g.strokeStyle = '#d8b040'; g.lineWidth = H * .01; g.beginPath(); g.ellipse(sx, top - H * .36, H * .04, H * .055, 0, 0, 7); g.stroke(); }
  // 首と頭
  g.fillStyle = sh(sk, -.1); g.fillRect(-H * .025, hy + H * .05, H * .05, H * .06);
  g.fillStyle = sk; g.strokeStyle = L; g.lineWidth = Math.max(1, H * .006); g.beginPath(); g.ellipse(0, hy, H * .068, H * .084, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = 'rgba(160,90,60,.18)'; g.beginPath(); g.ellipse(H * .025, hy + H * .01, H * .045, H * .07, 0, 0, 7); g.fill();
  const cap = (c) => { g.fillStyle = c; g.beginPath(); g.ellipse(0, hy - H * .03, H * .071, H * .062, 0, Math.PI, 0); g.fill(); };
  switch (head) {
    case 'shaved': g.fillStyle = 'rgba(80,90,110,.22)'; g.beginPath(); g.ellipse(0, hy - H * .03, H * .066, H * .055, 0, Math.PI, 0); g.fill(); if (o.white) { g.fillStyle = '#eee'; g.fillRect(-H * .045, hy - H * .02, H * .03, H * .008); g.fillRect(H * .015, hy - H * .02, H * .03, H * .008); } break;
    case 'mizura': cap(hair); g.fillStyle = hair; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * H * .085, hy + H * .02, H * .025, H * .04, 0, 0, 7); g.fill(); } g.fillStyle = '#c84a3a'; g.fillRect(-H * .1, hy - H * .01, H * .025, H * .01); g.fillRect(H * .075, hy - H * .01, H * .025, H * .01); break;
    case 'eboshi': cap(hair); g.fillStyle = '#16121a'; g.beginPath(); g.moveTo(-H * .065, hy - H * .05); g.quadraticCurveTo(-H * .05, hy - H * .22, H * .02, hy - H * .25); g.quadraticCurveTo(H * .07, hy - H * .15, H * .065, hy - H * .05); g.fill(); break;
    case 'kanmuri': case 'crown': cap(hair); g.fillStyle = '#16121a'; g.beginPath(); g.ellipse(0, hy - H * .07, H * .06, H * .05, 0, Math.PI, 0); g.fill(); g.fillRect(-H * .02, hy - H * .17, H * .04, H * .1); if (head === 'crown') { g.fillStyle = '#e0b040'; g.fillRect(-H * .06, hy - H * .075, H * .12, H * .012); } break;
    case 'long': case 'longback': cap(hair); g.fillStyle = hair; g.fillRect(-H * .072, hy - H * .03, H * .02, H * .1); g.fillRect(H * .052, hy - H * .03, H * .02, H * .1); break;
    case 'hood': g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(0, hy - H * .01, H * .09, H * .1, 0, Math.PI * .95, Math.PI * .05); g.fill(); break;
    case 'tang': cap(hair); g.fillStyle = '#16121a'; g.beginPath(); g.ellipse(0, hy - H * .07, H * .065, H * .055, 0, Math.PI, 0); g.fill(); g.fillRect(-H * .16, hy - H * .085, H * .32, H * .012); break;
    case 'kasa': g.fillStyle = '#c8a058'; g.beginPath(); g.moveTo(-H * .16, hy - H * .02); g.lineTo(0, hy - H * .12); g.lineTo(H * .16, hy - H * .02); g.fill(); break;
    case 'bun': cap(hair); g.fillStyle = hair; g.beginPath(); g.arc(0, hy - H * .1, H * .035, 0, 7); g.fill(); break;
    case 'child': cap(hair); g.fillStyle = hair; g.beginPath(); g.arc(0, hy - H * .09, H * .02, 0, 7); g.fill(); break;
  }
  if (back) { if (head !== 'shaved' && head !== 'hood') { g.fillStyle = hair; g.beginPath(); g.ellipse(0, hy, H * .07, H * .086, 0, 0, 7); g.fill(); } }
  else {
    g.strokeStyle = '#2a1a12'; g.lineWidth = Math.max(1, H * .007);
    if (o.eyes === 'open') { g.fillStyle = '#1a100a'; g.beginPath(); g.ellipse(-H * .027, hy + H * .01, H * .008, H * .011, 0, 0, 7); g.ellipse(H * .027, hy + H * .01, H * .008, H * .011, 0, 0, 7); g.fill(); }
    else { for (const s of [-1, 1]) { g.beginPath(); g.arc(s * H * .027, hy + H * .005, H * .016, .2, Math.PI - .2); g.stroke(); } }
    g.beginPath(); g.moveTo(-H * .012, hy + H * .05); g.lineTo(H * .012, hy + H * .05); g.stroke();
    if (o.beard) { g.fillStyle = o.beard; g.beginPath(); g.ellipse(0, hy + H * .07, H * .04, H * .03, 0, 0, Math.PI); g.fill(); }
  }
  g.restore();
}
// ---------- 建物・自然 ----------
function roofP(g, x, y, w, h, c, curl = 1) {
  g.fillStyle = lg(g, 0, y, 0, y + h, [sh(c, .15), c, sh(c, -.35)]);
  g.beginPath(); g.moveTo(x + w * .2, y); g.lineTo(x + w * .8, y); g.quadraticCurveTo(x + w * .9, y + h * .7, x + w + w * .04 * curl, y + h - h * .25 * curl); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.lineTo(x - w * .04 * curl, y + h - h * .25 * curl); g.quadraticCurveTo(x + w * .1, y + h * .7, x + w * .2, y); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + w * .05, y + h * i / 5); g.lineTo(x + w * .95, y + h * i / 5); g.stroke(); }
  g.fillStyle = sh(c, -.5); g.fillRect(x + w * .18, y - 4, w * .64, 6);
}
function hallP(g, x, y, w, h, o = {}) {
  const roof = o.roof || '#46766e', wall = o.wall || '#efe6d2', pil = o.pillar || '#c24a30';
  g.fillStyle = '#c8bca4'; g.fillRect(x - w * .03, y - h * .08, w * 1.06, h * .08);
  const wy = y - h * .08 - h * .38; g.fillStyle = wall; g.fillRect(x, wy, w, h * .38);
  g.fillStyle = pil; for (let i = 0; i <= 6; i++) g.fillRect(x + w * i / 6 - w * .012, wy, w * .024, h * .38); g.fillRect(x, wy, w, h * .04);
  g.fillStyle = 'rgba(60,30,20,.75)'; g.fillRect(x + w * .42, wy + h * .08, w * .16, h * .3);
  if (o.light) { glow(g, x + w * .5, wy + h * .22, w * .25, o.light, .7); }
  if (o.tier2) { roofP(g, x - w * .08, wy - h * .2, w * 1.16, h * .22, roof); g.fillStyle = wall; g.fillRect(x + w * .2, wy - h * .34, w * .6, h * .15); roofP(g, x + w * .05, wy - h * .58, w * .9, h * .26, roof); }
  else roofP(g, x - w * .08, wy - h * .5, w * 1.16, h * .52, roof);
}
function pagodaP(g, x, y, s, roof = '#46766e') {
  let yy = y, w = 110 * s;
  for (let i = 0; i < 5; i++) { g.fillStyle = '#efe6d2'; g.fillRect(x - w * .3, yy - 26 * s, w * .6, 26 * s); g.fillStyle = '#c24a30'; g.fillRect(x - w * .3, yy - 26 * s, 4 * s, 26 * s); g.fillRect(x + w * .3 - 4 * s, yy - 26 * s, 4 * s, 26 * s); roofP(g, x - w / 2, yy - 46 * s, w, 22 * s, roof); yy -= 46 * s; w *= .86; }
  g.strokeStyle = '#d8b040'; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy - 70 * s); g.stroke(); for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(x - 7 * s, yy - 12 * s - k * 7 * s); g.lineTo(x + 7 * s, yy - 12 * s - k * 7 * s); g.stroke(); }
}
function houseP(g, x, y, w, h, light) { g.fillStyle = '#6a4a30'; g.fillRect(x, y - h * .45, w, h * .45); if (light) { g.fillStyle = light; g.fillRect(x + w * .35, y - h * .35, w * .25, h * .2); glow(g, x + w * .47, y - h * .25, w * .4, light, .5); } g.fillStyle = '#8a6a3a'; g.beginPath(); g.moveTo(x - w * .1, y - h * .42); g.lineTo(x + w * .5, y - h * 1.05); g.lineTo(x + w * 1.1, y - h * .42); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(x + w * .5, y - h * 1.05); g.lineTo(x + w * 1.1, y - h * .42); g.lineTo(x + w * .5, y - h * .42); g.fill(); }
function pineP(g, x, y, s, c = '#1f4030') { g.fillStyle = '#3a2618'; g.fillRect(x - 4 * s, y - 70 * s, 8 * s, 70 * s); g.fillStyle = c; for (const [dx, dy, w] of [[-30, -70, 60], [10, -95, 55], [-20, -120, 45], [0, -140, 30]]) { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, w * s, 13 * s, 0, 0, 7); g.fill(); } }
function cedarP(g, x, y, s, c = '#1c3a2a') { g.fillStyle = c; g.beginPath(); g.moveTo(x, y - 200 * s); g.lineTo(x + 34 * s, y); g.lineTo(x - 34 * s, y); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(x, y - 200 * s); g.lineTo(x + 34 * s, y); g.lineTo(x, y); g.fill(); }
function treeBlob(g, x, y, s, c) { g.fillStyle = '#3a2618'; g.fillRect(x - 3 * s, y - 50 * s, 6 * s, 50 * s); g.fillStyle = c; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + (i - 2) * 16 * s, y - 60 * s - (i % 2) * 18 * s, 26 * s, 0, 7); g.fill(); } }
function shipP(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y + Math.sin(t / 700) * 4 * s); g.rotate(Math.sin(t / 900) * .02 * (o.storm ? 5 : 1) + (o.tilt || 0));
  g.fillStyle = lg(g, 0, -40 * s, 0, 25 * s, ['#7a4a26', '#4a2a14']); g.beginPath(); g.moveTo(-160 * s, -50 * s); g.quadraticCurveTo(-120 * s, 22 * s, 0, 24 * s); g.quadraticCurveTo(120 * s, 22 * s, 150 * s, -56 * s); g.lineTo(130 * s, -30 * s); g.lineTo(-140 * s, -28 * s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2 * s; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-130 * s, -18 * s + i * 12 * s); g.quadraticCurveTo(0, 0 + i * 10 * s, 130 * s, -20 * s + i * 12 * s); g.stroke(); }
  g.fillStyle = '#b08850'; g.fillRect(-50 * s, -62 * s, 100 * s, 34 * s); g.fillStyle = '#3a2a20'; g.fillRect(-58 * s, -70 * s, 116 * s, 10 * s);
  g.strokeStyle = '#3a2614'; g.lineWidth = 5 * s; for (const mx of [-70, 55]) { g.beginPath(); g.moveTo(mx * s, -30 * s); g.lineTo(mx * s, -230 * s); g.stroke(); }
  for (const [mx, w, hh] of [[-70, 90, 140], [55, 100, 160]]) {
    const sx = mx * s - w * s / 2, sy = -220 * s, bulge = o.storm ? 18 : 10;
    g.fillStyle = o.torn ? '#b8a880' : '#e6d6a6'; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + w * s / 2, sy - 6 * s, sx + w * s, sy); g.quadraticCurveTo(sx + w * s + bulge * s, sy + hh * s / 2, sx + w * s, sy + hh * s); g.lineTo(sx, sy + hh * s); g.quadraticCurveTo(sx + bulge * s, sy + hh * s / 2, sx, sy); g.fill();
    g.strokeStyle = 'rgba(120,90,50,.5)'; g.lineWidth = 1.5 * s; for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(sx, sy + hh * s * k / 7); g.lineTo(sx + w * s, sy + hh * s * k / 7); g.stroke(); }
  }
  g.fillStyle = '#c83a28'; g.beginPath(); g.moveTo(55 * s, -230 * s); g.lineTo(55 * s + 40 * s, -222 * s + Math.sin(t / 200) * 4 * s); g.lineTo(55 * s, -212 * s); g.fill();
  if (o.crew) for (let i = 0; i < 4; i++) figure(g, (-30 + i * 20) * s, -62 * s, 26 * s, { robe: ['#3a3a4a', '#5a4a3a', '#2a3a5a', '#6a5a4a'][i], head: i === 0 ? 'shaved' : 'eboshi', pose: i === 0 ? 'gassho' : 'stand', kesa: i === 0 ? '#b86a2a' : null });
  g.restore();
}
function interiorP(g, light = '#fff4d0', night) {
  g.fillStyle = night ? '#1e140c' : '#b8925a'; g.fillRect(0, 0, SW, SH);
  g.fillStyle = night ? '#3a5070' : light; g.fillRect(120, 70, 360, 300); g.fillRect(560, 70, 260, 300);
  if (!night) glow(g, 300, 220, 420, 'rgba(255,250,220,.9)', .8);
  g.strokeStyle = night ? '#2a1a10' : '#8a6038'; g.lineWidth = 5; for (const [x0, w] of [[120, 360], [560, 260]]) { for (let x = x0; x <= x0 + w; x += 60) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 370); g.stroke(); } for (let y = 70; y <= 370; y += 60) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); } }
  g.fillStyle = night ? '#2a1a0e' : '#7a5230'; for (const x of [80, 500, 860]) g.fillRect(x, 0, 40, 420); g.fillRect(0, 40, SW, 30);
  g.fillStyle = night ? '#3a2c16' : '#cdb880'; g.fillRect(0, 400, SW, 200); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let y = 420; y < SH; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke(); }
}
function lampP(g, x, y, t) { g.fillStyle = '#5a3a1a'; g.fillRect(x - 3, y, 6, 70); g.fillStyle = '#e8d8b0'; g.fillRect(x - 16, y - 40, 32, 40); const f = 1 + Math.sin(t / 120) * .05; glow(g, x, y - 20, 220 * f, 'rgba(255,190,90,.75)'); glow(g, x, y - 20, 40, 'rgba(255,240,180,1)'); }
function deskP(g, x, y, w) { g.fillStyle = '#4a2c16'; g.fillRect(x, y, w, 14); g.fillRect(x + 8, y + 14, 8, 30); g.fillRect(x + w - 16, y + 14, 8, 30); g.fillStyle = '#f6efe0'; g.fillRect(x + 20, y - 4, w * .55, 6); g.fillStyle = '#1a1a1a'; for (let i = 0; i < 5; i++) g.fillRect(x + 30 + i * 18, y - 3, 6, 2); }

function willowP(g, x, y) { g.strokeStyle = '#3a2618'; g.lineWidth = 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y - 180); g.stroke(); for (let i = 0; i < 22; i++) { g.strokeStyle = i % 2 ? '#5a8a40' : '#7aa850'; g.lineWidth = 2; g.beginPath(); const sx = x - 70 + i * 7; g.moveTo(sx, y - 190); g.quadraticCurveTo(sx + 6, y - 120, sx - 4, y - 40 - (i % 5) * 12); g.stroke(); } }
// 今の空海（真魚）の姿
function KF() { const s = kukaiSpec(); return { robe: s.robe, head: s.hair === 'mizura' ? 'mizura' : 'shaved', kesa: s.kesa, staff: false }; }
// ---------- 場面の定義 ----------
const SCENES = {
  birth: (g, t) => {
    skyP(g, ['#1a2448', '#5a4a78', '#e8a070', '#f8d8a0']); particles(g, t, 40, 'star', 2);
    glow(g, 700, 330, 260, 'rgba(255,220,150,.9)'); ridge(g, 340, 120, '#4a4060', 1); ridge(g, 360, 70, '#3a3450', 4, 1.6);
    seaP(g, 350, '#d8a080', '#2a3a5a', t, { x: 700, c: 'rgba(255,220,160,.9)' }); mist(g, 345, 30, .4);
    g.fillStyle = '#2a2018'; g.beginPath(); g.moveTo(0, 470); g.quadraticCurveTo(300, 430, 520, 600); g.lineTo(0, 600); g.fill();
    houseP(g, 90, 470, 140, 110, 'rgba(255,190,100,.9)'); pineP(g, 330, 520, 1.1);
    figure(g, 150, 700, 430, { robe: '#9a4a5e', head: 'long', pose: 'baby', layer: '#e8c070' });
  },
  dorobotoke: (g, t) => {
    skyP(g, ['#9ac8e8', '#d8ecf4', '#f4f0dc']); cloudP(g, 220, 110, 300, '#fff', .8); cloudP(g, 720, 80, 240, '#fff', .7);
    ridge(g, 330, 140, '#7aa070', 2); ridge(g, 380, 90, '#5a8a50', 6, 1.4); mist(g, 330, 40, .4);
    g.fillStyle = lg(g, 0, 380, 0, 600, ['#8ab060', '#5a7a3a']); g.fillRect(0, 380, SW, 220);
    g.fillStyle = '#6aa0c8'; g.beginPath(); g.moveTo(0, 420); g.quadraticCurveTo(400, 400, 960, 450); g.lineTo(960, 480); g.quadraticCurveTo(400, 440, 0, 460); g.fill();
    g.fillStyle = '#b89a6a'; g.beginPath(); g.ellipse(560, 430, 280, 40, 0, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) { const x = 420 + i * 70, y = 432 - (i % 2) * 8; g.fillStyle = '#8a6a4a'; g.beginPath(); g.ellipse(x, y, 14, 8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y - 18, 10, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, y - 36, 7, 0, 7); g.fill(); glow(g, x, y - 30, 30, 'rgba(255,230,150,.4)'); }
    figure(g, 160, 640, 340, { robe: '#5a86c0', head: 'mizura', pose: 'kgassho' }); particles(g, t, 12, 'firefly', 3);
  },
  shashin: (g, t) => {
    skyP(g, ['#f4d890', '#f8e8c0', '#e8c0a0']); raysP(g, 640, 0, '#fff8e0', .22, 9);
    cloudP(g, 680, 260, 500, '#fff4e0', .8); cloudP(g, 300, 420, 600, '#fff0d8', .7); cloudP(g, 760, 480, 400, '#fff', .6);
    g.fillStyle = '#3a3028'; g.beginPath(); g.moveTo(0, 230); g.lineTo(280, 250); g.lineTo(330, 280); g.lineTo(300, 600); g.lineTo(0, 600); g.fill();
    figure(g, 270, 250, 110, { robe: '#5a86c0', head: 'mizura', pose: 'gassho' });
    for (let i = 0; i < 2; i++) { const x = 520 + i * 160, y = 300 + i * 60 + Math.sin(t / 800 + i) * 10; g.strokeStyle = ['rgba(240,140,170,.7)', 'rgba(140,200,240,.7)'][i]; g.lineWidth = 6; g.beginPath(); g.moveTo(x - 60, y - 80); g.bezierCurveTo(x - 140, y - 20, x + 60, y + 40, x + 120, y - 40); g.stroke(); figure(g, x, y, 150, { robe: ['#f0c0d0', '#c0e0f0'][i], head: 'long', pose: 'gassho', layer: '#f8e8a0', alpha: .92 }); }
    particles(g, t, 25, 'petal', 4);
  },
  village: (g, t) => {
    skyP(g, ['#8ab8e0', '#d8eaf2', '#f6eed8']); cloudP(g, 260, 110, 320, '#fff', .8); cloudP(g, 760, 70, 260, '#fff', .6);
    ridge(g, 290, 70, '#9ab0b8', 2, 1.4); mist(g, 290, 25, .5); seaP(g, 290, '#a0c8dc', '#4a88b0', t);
    for (const [x, w] of [[180, 120], [560, 90]]) { g.fillStyle = '#7a9a88'; g.beginPath(); g.ellipse(x, 300, w, 22, 0, Math.PI, 0); g.fill(); }
    g.fillStyle = lg(g, 0, 380, 0, 600, ['#9ac070', '#6a9050']); g.beginPath(); g.moveTo(0, 400); g.quadraticCurveTo(480, 350, 960, 420); g.lineTo(960, 600); g.lineTo(0, 600); g.fill();
    houseP(g, 620, 470, 120, 90); houseP(g, 770, 480, 110, 80); hallP(g, 60, 470, 200, 110, { roof: '#8f6a52' });
    treeBlob(g, 520, 470, 1.2, '#f4b0c8'); pineP(g, 900, 520, 1);
    figure(g, 170, 720, 380, { robe: '#4f86c6', head: 'mizura', back: true }); particles(g, t, 26, 'petal', 5);
  },
  nightbefore: (g, t) => {
    interiorP(g, null, true); g.fillStyle = 'rgba(160,190,240,.25)'; g.fillRect(120, 70, 360, 300); glow(g, 300, 160, 70, 'rgba(230,240,255,.9)');
    lampP(g, 480, 330, t); figure(g, 170, 640, 360, { robe: '#8a4a5e', head: 'long', pose: 'kneel', layer: '#d8b060' }); figure(g, 800, 640, 310, { robe: '#4f86c6', head: 'mizura', pose: 'kneel', flip: true });
    g.fillStyle = 'rgba(10,10,30,.25)'; g.fillRect(0, 0, SW, SH);
  },
  farewell: (g, t) => {
    skyP(g, ['#8ab8e0', '#cfe4f0', '#f6ecd4']); cloudP(g, 700, 120, 380, '#fff', .8); cloudP(g, 200, 90, 260, '#fff', .6);
    ridge(g, 300, 60, '#8aa0b0', 3, 1.3); mist(g, 300, 30, .5);
    seaP(g, 300, '#9ac0d8', '#3a7aa8', t); shipP(g, 640, 360, .55, t, { crew: true });
    g.fillStyle = lg(g, 0, 440, 0, 600, ['#e8d8a8', '#c8b080']); g.beginPath(); g.moveTo(0, 450); g.quadraticCurveTo(250, 430, 420, 600); g.lineTo(0, 600); g.fill();
    pineP(g, 80, 520, 1.3); figure(g, 150, 700, 420, { robe: '#9a4a5e', head: 'long', pose: 'wave', layer: '#e8c070' });
  },
  voyage: (g, t) => {
    skyP(g, ['#3a3a6a', '#c86a5a', '#f8c070']); glow(g, 300, 330, 300, 'rgba(255,200,120,.95)'); cloudP(g, 600, 150, 420, '#f4a080', .6);
    for (const [x, w, hh] of [[60, 200, 50], [420, 150, 35], [760, 260, 60]]) { g.fillStyle = '#4a3a5a'; g.beginPath(); g.ellipse(x + w / 2, 340, w / 2, hh, 0, Math.PI, 0); g.fill(); }
    seaP(g, 338, '#e8906a', '#2a2a4a', t, { x: 300, c: 'rgba(255,210,140,.95)' }); shipP(g, 560, 395, .72, t, { crew: true });
    for (let i = 0; i < 5; i++) { const x = (i * 140 + t * .03) % SW, y = 140 + i * 15; g.strokeStyle = '#2a2030'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x - 4, y - 5, x, y); g.quadraticCurveTo(x + 4, y - 5, x + 8, y); g.stroke(); }
  },
  capital: (g, t) => {
    skyP(g, ['#9ac8e8', '#e8f0f0', '#f4e8cc']); cloudP(g, 760, 110, 300, '#fff', .8);
    ridge(g, 280, 100, '#8aa8a0', 5); mist(g, 300, 50, .55);
    g.fillStyle = '#d8c8a0'; g.fillRect(0, 330, SW, 270);
    for (let i = 0; i < 6; i++) hallP(g, 40 + i * 160, 350 - (i % 2) * 6, 110, 70, { roof: '#5a6a72' });
    g.fillStyle = 'rgba(160,120,60,.8)'; for (const x of [620, 660, 700]) g.fillRect(x, 210, 5, 140); for (const y of [240, 280, 320]) g.fillRect(600, y, 120, 5);
    hallP(g, 300, 470, 360, 210, { roof: '#3f7a72', tier2: 1 });
    g.fillStyle = '#c8b488'; g.beginPath(); g.moveTo(400, 600); g.lineTo(450, 470); g.lineTo(510, 470); g.lineTo(560, 600); g.fill();
    for (let i = 0; i < 6; i++) figure(g, 60 + i * 170 + (i % 2) * 40, 440 + (i % 3) * 8, 60, { robe: ['#6a5a4a', '#4a5a7a', '#8a6a4a'][i % 3], head: i % 2 ? 'eboshi' : 'child', back: i % 2 === 0 });
    figure(g, 820, 740, 380, { robe: '#4f86c6', head: 'mizura', back: true });
  },
  study: (g, t) => {
    interiorP(g, null, true); g.fillStyle = 'rgba(80,100,150,.25)'; g.fillRect(120, 70, 360, 300);
    lampP(g, 640, 340, t); deskP(g, 300, 400, 240);
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#a8885a', '#c8a870', '#8a6a42', '#b89860'][i]; g.fillRect(720, 420 - i * 14, 110, 12); }
    figure(g, 230, 470, 270, { robe: '#4f86c6', head: 'mizura', pose: 'write', eyes: 'open' });
  },
  shamon: (g, t) => {
    skyP(g, ['#2a2a4a', '#8a5a6a', '#e8a070']); ridge(g, 300, 80, '#4a3a4a', 7);
    g.fillStyle = '#5a4030'; g.fillRect(0, 380, SW, 220);
    for (let i = 0; i < 5; i++) { const x = 40 + i * 190; g.fillStyle = ['#a83a2a', '#3a5a8a'][i % 2]; g.fillRect(x, 300, 140, 30); g.fillStyle = '#3a2618'; g.fillRect(x + 8, 330, 6, 70); g.fillRect(x + 126, 330, 6, 70); g.fillStyle = '#6a4a2a'; g.fillRect(x, 370, 140, 16); glow(g, x + 70, 320, 60, 'rgba(255,180,80,.7)'); }
    figure(g, 160, 700, 420, { robe: '#5a4a3a', head: 'shaved', kesa: '#8a6a3a', staff: true, pose: 'stand' });
    figure(g, 810, 700, 360, { robe: '#4f86c6', head: 'mizura', pose: 'gassho', eyes: 'open', flip: true });
  },
  mountain: (g, t) => {
    skyP(g, ['#c8d8d0', '#e8ece0', '#f4f0e0']); ridge(g, 250, 180, '#7a9a8a', 1.5, .8); mist(g, 260, 60, .6); ridge(g, 340, 160, '#4a7060', 3, 1.1); mist(g, 360, 50, .5); ridge(g, 460, 120, '#2a4a3a', 8, 1.6);
    g.fillStyle = 'rgba(230,245,255,.9)'; g.fillRect(700, 230, 14, 180); glow(g, 707, 410, 50, 'rgba(255,255,255,.8)');
    for (let i = 0; i < 9; i++) cedarP(g, 40 + i * 110 + (i % 2) * 30, 600, .9 + (i % 3) * .2, '#183020');
    g.strokeStyle = '#a89a78'; g.lineWidth = 16; g.beginPath(); g.moveTo(420, 600); g.quadraticCurveTo(520, 500, 470, 380); g.stroke();
    figure(g, 470, 420, 120, { robe: '#ece6d6', head: 'kasa', back: true, staff: true });
  },
  myojo: (g, t) => {
    skyP(g, ['#0a1030', '#3a3a6a', '#c88a8a', '#f0c8a0']); particles(g, t, 50, 'star', 6);
    seaP(g, 330, '#e0a890', '#1a2a4a', t);
    const p = (t % 6000) / 6000, sx = 760 - p * 300, sy = 90 + p * 300;
    g.strokeStyle = 'rgba(255,250,220,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx + 200, sy - 200); g.lineTo(sx, sy); g.stroke(); glow(g, sx, sy, 60, 'rgba(255,255,230,1)'); glow(g, sx, sy, 160, 'rgba(255,240,200,.5)');
    g.fillStyle = '#120c08'; g.beginPath(); g.moveTo(0, 0); g.lineTo(SW, 0); g.lineTo(SW, SH); g.lineTo(0, SH); g.closePath();
    g.moveTo(170, 600); g.quadraticCurveTo(150, 120, 480, 80); g.quadraticCurveTo(830, 120, 800, 600); g.closePath(); g.fill('evenodd');
    glow(g, 470, 400, 200, 'rgba(255,230,170,.35)');
    figure(g, 470, 470, 220, { robe: '#ece6d6', head: 'shaved', pose: 'zazen', back: true, alpha: 1 });
  },
  writing: (g, t) => {
    interiorP(g, '#fff8e0'); raysP(g, 300, 120, '#fffbe8', .2, 6);
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(90,110,70,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(160 + i * 50, 100); g.quadraticCurveTo(200 + i * 50, 200, 170 + i * 50, 360); g.stroke(); }
    deskP(g, 320, 410, 260); figure(g, 240, 480, 300, { robe: '#ece6d6', head: 'shaved', pose: 'write', kesa: '#8a7a5a' });
  },
  ordination: (g, t) => {
    skyP(g, ['#a8c8e0', '#e8eef0', '#f8f0d8']); raysP(g, 480, 0, '#fff', .12, 7);
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 380, SW, 220); hallP(g, 160, 400, 640, 300, { roof: '#5d6872', tier2: 1 });
    for (let i = 0; i < 8; i++) figure(g, 120 + i * 105, 430, 60, { robe: '#3a3a4a', kesa: '#a85a2a', head: 'shaved', back: true });
    figure(g, 820, 740, 380, { robe: '#3a3a4a', kesa: '#b86a2a', head: 'shaved', back: true }); particles(g, t, 14, 'petal', 7);
  },
  kentoshi: (g, t) => {
    skyP(g, ['#7ab0e0', '#d0e8f4', '#f0f0e0']); cloudP(g, 260, 100, 320, '#fff', .8);
    ridge(g, 300, 50, '#7a9aa8', 4, 1.2); seaP(g, 300, '#7ab0d0', '#2a5a8a', t);
    shipP(g, 160, 360, .42, t + 500); shipP(g, 400, 345, .48, t); shipP(g, 640, 380, .6, t + 900, { crew: true }); shipP(g, 860, 350, .4, t + 1300);
  },
  storm: (g, t) => {
    skyP(g, ['#0a0c14', '#2a3040', '#3a4a5a']); for (let i = 0; i < 6; i++) cloudP(g, i * 190, 80 + (i % 2) * 40, 400, '#1a1e28', .9);
    if ((t / 160 | 0) % 17 === 0) { g.fillStyle = 'rgba(220,230,255,.5)'; g.fillRect(0, 0, SW, SH); g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(720, 0); g.lineTo(690, 120); g.lineTo(730, 140); g.lineTo(680, 300); g.stroke(); }
    g.fillStyle = '#1a2a3a'; g.fillRect(0, 340, SW, 260);
    shipP(g, 480, 360 + Math.sin(t / 400) * 20, .85, t, { storm: true, torn: true, tilt: Math.sin(t / 500) * .15 });
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#203448', '#2a4058', '#16283a', '#304a62'][i]; g.beginPath(); g.moveTo(0, SH); for (let x = 0; x <= SW; x += 20) g.lineTo(x, 430 + i * 45 + Math.sin(x / 80 + t / (300 + i * 80) + i) * (35 - i * 5)); g.lineTo(SW, SH); g.fill(); }
    particles(g, t, 160, 'rain', 8);
  },
  drift: (g, t) => {
    skyP(g, ['#b8c0c8', '#e0e0d8', '#f0e8d8']); mist(g, 280, 80, .6); ridge(g, 300, 70, '#8a9a8a', 9);
    seaP(g, 330, '#b0c0c8', '#5a7a8a', t); shipP(g, 330, 385, .6, t, { torn: true, tilt: .08 });
    g.fillStyle = '#d8c8a0'; g.beginPath(); g.moveTo(560, 600); g.quadraticCurveTo(620, 420, 960, 380); g.lineTo(960, 600); g.fill();
    for (let i = 0; i < 5; i++) { const x = 680 + i * 60; g.strokeStyle = '#4a7a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, 470); g.lineTo(x + 8, 240); g.stroke(); g.fillStyle = '#5a8a40'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + 20, 260 + k * 30, 22, 6, .5, 0, 7); g.fill(); } }
    figure(g, 820, 520, 200, { robe: '#3a3a8a', head: 'tang', eyes: 'open', flip: true }); figure(g, 900, 540, 180, { robe: '#8a3a2a', head: 'tang', flip: true });
  },
  changan: (g, t) => {
    skyP(g, ['#e8a060', '#f8d8a0', '#f8ecd0']); glow(g, 200, 260, 260, 'rgba(255,220,150,.8)');
    ridge(g, 250, 60, '#b8a080', 2, .7); mist(g, 280, 40, .5);
    g.fillStyle = '#b0906a'; g.fillRect(0, 300, SW, 300);
    const cx = 760; let y = 330; for (let i = 0; i < 7; i++) { const w = 120 - i * 12, h = i ? 34 : 50; g.fillStyle = '#c8a070'; g.fillRect(cx - w / 2, y - h, w, h); g.fillStyle = '#8a6a48'; g.fillRect(cx - w / 2 - 8, y - h - 6, w + 16, 6); g.fillStyle = '#3a2a1a'; g.fillRect(cx - 6, y - h + 8, 12, 16); y -= h + 6; }
    for (let i = 0; i < 7; i++) hallP(g, 20 + i * 140, 400 - (i % 2) * 10, 110, 80, { roof: '#55686a', wall: '#c94634' });
    g.fillStyle = '#9a7a56'; g.fillRect(0, 430, SW, 50); g.fillStyle = '#7a5a3a'; for (let x = 0; x < SW; x += 30) g.fillRect(x, 420, 18, 12);
    hallP(g, 330, 560, 300, 150, { roof: '#55686a', wall: '#c94634', tier2: 1 });
    for (let i = 0; i < 9; i++) figure(g, 60 + i * 110, 580 + (i % 2) * 10, 80, { robe: ['#b84a3a', '#3a6a8a', '#7a6a3a', '#7a4a8a'][i % 4], head: i % 3 === 0 ? 'kasa' : 'tang', back: i % 2 === 0 });
  },
  keika: (g, t) => {
    interiorP(g, '#fff0d0'); g.fillStyle = 'rgba(120,40,20,.35)'; g.fillRect(0, 0, SW, SH);
    glow(g, 480, 200, 300, 'rgba(255,220,150,.6)'); g.fillStyle = '#8a2a1a'; g.fillRect(560, 420, 300, 40);
    figure(g, 720, 430, 270, { robe: '#7a5a3a', head: 'shaved', kesa: '#c8402a', pose: 'zazen', white: true, beard: '#ddd' });
    figure(g, 170, 660, 360, { robe: '#3a3a4a', head: 'shaved', kesa: '#b86a2a', pose: 'kgassho', eyes: 'open' }); particles(g, t, 10, 'spark', 2);
  },
  kanjo: (g, t) => {
    skyP(g, ['#0a0612', '#1a0e24', '#2a1430']);
    g.save(); g.translate(480, 330); g.rotate(t / 20000);
    for (let r = 260; r > 20; r -= 40) { g.strokeStyle = 'rgba(240,190,80,' + (.25 + (260 - r) / 600) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = 'rgba(230,120,140,.55)'; g.beginPath(); g.ellipse(0, -110, 26, 60, 0, 0, 7); g.fill(); figure(g, 0, -190, 40, { robe: '#d8a030', head: 'shaved', pose: 'zazen', alpha: .8 }); }
    g.restore(); glow(g, 480, 330, 120, 'rgba(255,240,180,.95)'); figure(g, 480, 360, 70, { robe: '#e0b040', head: 'crown', pose: 'zazen' });
    const p = Math.min(1, (t % 7000) / 4000), fy = 40 + p * 290; g.fillStyle = '#ff8aa8'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(480 + Math.cos(k * 1.26 + t / 300) * 9, fy + Math.sin(k * 1.26 + t / 300) * 9, 7, 4, k, 0, 7); g.fill(); }
    particles(g, t, 20, 'spark', 9);
  },
  keika_death: (g, t) => {
    skyP(g, ['#0c1020', '#22283a', '#3a3a4a']); particles(g, t, 70, 'snow', 3);
    g.fillStyle = '#2a2a30'; g.fillRect(0, 400, SW, 200); hallP(g, 250, 420, 460, 230, { roof: '#3a4648', wall: '#8a8478', light: 'rgba(255,190,100,.8)' });
    for (let i = 0; i < 9; i++) figure(g, 90 + i * 98, 470, 90, { robe: '#3a3030', head: 'shaved', back: true, alpha: .9 });
    for (const x of [140, 820]) { g.fillStyle = '#5a5048'; g.fillRect(x - 6, 470, 12, 60); glow(g, x, 465, 60, 'rgba(255,180,80,.8)'); }
  },
  returning: (g, t) => {
    skyP(g, ['#4a6aa0', '#e8b8a0', '#f8e0b0']); glow(g, 780, 330, 280, 'rgba(255,230,160,.95)'); cloudP(g, 400, 160, 400, '#f8d8c8', .6);
    seaP(g, 335, '#f0c8a0', '#2a4a7a', t, { x: 780, c: 'rgba(255,230,170,.95)' }); shipP(g, 430, 395, .78, t, { crew: true });
  },
  saga: (g, t) => {
    interiorP(g, '#fff2d8'); g.fillStyle = 'rgba(160,60,30,.18)'; g.fillRect(0, 0, SW, SH);
    g.fillStyle = '#6a4a2a'; g.fillRect(560, 330, 340, 90); g.fillStyle = '#c8402a'; g.fillRect(580, 300, 300, 30); for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(40,30,20,.5)'; g.fillRect(590 + i * 32, 120, 3, 180); }
    figure(g, 730, 400, 220, { robe: '#c8a040', head: 'crown', pose: 'zazen', eyes: 'open' });
    figure(g, 170, 680, 360, { robe: '#3a3048', head: 'shaved', kesa: '#d8a030', pose: 'kgassho' });
    for (let i = 0; i < 3; i++) figure(g, 330 + i * 70, 430, 80, { robe: ['#3a3a6a', '#8a2a3a', '#2a5a4a'][i], head: 'kanmuri', pose: 'kneel' });
  },
  saicho: (g, t) => {
    skyP(g, ['#e8c8a0', '#f4e4c8', '#f8f0dc']); ridge(g, 300, 120, '#a86a4a', 3); mist(g, 300, 40, .5);
    for (let i = 0; i < 7; i++) treeBlob(g, 40 + i * 150, 420, 1.3, ['#d85a30', '#e88a3a', '#c8402a'][i % 3]);
    g.fillStyle = '#c8b088'; g.fillRect(0, 420, SW, 180); hallP(g, 330, 430, 300, 150, { roof: '#46766e' });
    figure(g, 150, 710, 410, { robe: '#3a3048', head: 'shaved', kesa: '#d8a030', pose: 'gassho', eyes: 'open' });
    figure(g, 810, 710, 410, { robe: '#4a4a5a', head: 'shaved', kesa: '#7a8a9a', pose: 'gassho', flip: true }); particles(g, t, 30, 'leaf', 5);
  },
  koya: (g, t) => {
    skyP(g, ['#9ac0d8', '#e0ecec', '#f4f0e0']); cloudP(g, 700, 90, 360, '#fff', .7);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = 480 + Math.cos(a) * 380, y = 360 + Math.sin(a) * 110; g.fillStyle = Math.sin(a) > 0 ? '#2a4a38' : '#5a7a68'; g.beginPath(); g.moveTo(x - 140, y + 60); g.quadraticCurveTo(x, y - 160 - Math.sin(a) * 40, x + 140, y + 60); g.fill(); }
    mist(g, 330, 60, .7); g.fillStyle = '#6a8a5a'; g.beginPath(); g.ellipse(480, 380, 300, 60, 0, 0, 7); g.fill();
    for (let i = 0; i < 12; i++) cedarP(g, 20 + i * 85, 600, 1 + (i % 3) * .3, '#14281c');
    figure(g, 820, 730, 360, { robe: '#3a3048', head: 'shaved', kesa: '#d8a030', back: true, staff: true });
  },
  manno: (g, t) => {
    skyP(g, ['#8ac0e8', '#d8ecf4', '#f4f0e0']); ridge(g, 260, 90, '#6a9070', 2);
    g.fillStyle = lg(g, 0, 270, 0, 420, ['#4a90c8', '#2a6aa0']); g.beginPath(); g.ellipse(480, 320, 520, 120, 0, 0, 7); g.fill();
    g.fillStyle = '#a8885a'; g.beginPath(); g.moveTo(80, 440); g.quadraticCurveTo(480, 330, 880, 440); g.lineTo(880, 480); g.quadraticCurveTo(480, 380, 80, 480); g.fill();
    g.fillStyle = '#8ab060'; g.fillRect(0, 470, SW, 130);
    for (let i = 0; i < 14; i++) figure(g, 60 + i * 64, 445 + (i % 3) * 6 - Math.abs(i - 7) * 3, 50, { robe: ['#8a9a6a', '#a08060', '#7a8aa0'][i % 3], head: i % 2 ? 'child' : 'kasa', back: true });
    figure(g, 830, 720, 400, { robe: '#3a3048', head: 'shaved', kesa: '#d8a030', staff: true, pose: 'stand' });
  },
  rain: (g, t) => {
    skyP(g, ['#2a3040', '#4a5868', '#7a8a98']); for (let i = 0; i < 6; i++) cloudP(g, i * 190, 90, 400, '#3a4250', .9);
    g.fillStyle = '#4a7aa0'; g.beginPath(); g.ellipse(480, 470, 420, 90, 0, 0, 7); g.fill();
    const dx = 480 + Math.sin(t / 900) * 160, dy = 230 + Math.cos(t / 700) * 30;
    for (let i = 10; i >= 0; i--) { g.fillStyle = i % 2 ? '#e0b040' : '#f0d070'; g.beginPath(); g.arc(dx - i * 14, dy + Math.sin(t / 200 + i) * 10, 16 - i, 0, 7); g.fill(); }
    glow(g, dx, dy, 120, 'rgba(255,230,140,.6)');
    figure(g, 110, 700, 330, { robe: '#8a9a6a', head: 'kasa', pose: 'wave' }); figure(g, 860, 700, 330, { robe: '#4a5a9a', head: 'eboshi', pose: 'wave', flip: true });
    particles(g, t, 200, 'rain', 3);
  },
  school: (g, t) => {
    skyP(g, ['#9ac8e8', '#e4f0f4', '#f8f0dc']); g.fillStyle = '#e0d0a8'; g.fillRect(0, 400, SW, 200);
    hallP(g, 260, 420, 440, 220, { roof: '#5a6672', tier2: 1 }); treeBlob(g, 120, 440, 1.4, '#f4b0c8'); treeBlob(g, 840, 440, 1.3, '#f4b0c8');
    for (let i = 0; i < 8; i++) figure(g, 140 + i * 95, 445 + (i % 2) * 8, 70, { robe: ['#e0a040', '#60a0d0', '#e07070', '#80c060', '#6a5a4a', '#3a3a4a'][i % 6], head: ['child', 'mizura', 'bun', 'shaved', 'eboshi'][i % 5], pose: 'kneel' });
    particles(g, t, 30, 'petal', 2);
  },
  nyujo: (g, t) => {
    skyP(g, ['#05060e', '#10142a', '#1a1e30']); particles(g, t, 60, 'star', 4);
    for (let i = 0; i < 14; i++) cedarP(g, 10 + i * 72, 520 + (i % 2) * 30, 1.6 + (i % 3) * .3, '#0a140e');
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 500, SW, 100);
    for (let i = 0; i < 7; i++) { const x = 100 + i * 110, y = 520; g.fillStyle = '#4a4440'; g.fillRect(x - 5, y - 40, 10, 40); glow(g, x, y - 46, 40, 'rgba(255,190,90,.9)'); }
    glow(g, 480, 360, 220, 'rgba(255,230,170,.45)');
    figure(g, 480, 500, 240, { robe: '#5a2a3a', head: 'shaved', kesa: '#e0b040', pose: 'zazen', back: true }); particles(g, t, 20, 'firefly', 6);
  },

  // ---------- 修行・生活の一枚絵（今の姿で描く） ----------
  takigyo: (g, t) => {
    skyP(g, ['#9ab8b0', '#d0e0d8', '#e8eee4']); ridge(g, 200, 120, '#5a7a6a', 3, 1.2); mist(g, 220, 50, .5);
    g.fillStyle = '#4a4a44'; g.beginPath(); g.moveTo(0, 0); g.lineTo(380, 0); g.lineTo(400, 120); g.lineTo(360, 420); g.lineTo(0, 600); g.fill();
    g.beginPath(); g.moveTo(960, 0); g.lineTo(580, 0); g.lineTo(560, 140); g.lineTo(600, 420); g.lineTo(960, 600); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(360, 0, 30, 420); g.fillRect(560, 0, 30, 420);
    g.fillStyle = 'rgba(225,245,255,.92)'; g.fillRect(400, 0, 160, 430);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { const x = 405 + i * 9, y = ((t * .6 + i * 47) % 500) - 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 80); g.stroke(); }
    g.fillStyle = lg(g, 0, 400, 0, 600, ['#6aa0b8', '#2a5a78']); g.beginPath(); g.ellipse(480, 470, 380, 90, 0, 0, 7); g.fill();
    figure(g, 480, 440, 250, Object.assign(KF(), { pose: 'gassho' }));
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + t / 400, r = 60 + (t / 6 + i * 13) % 80; g.fillStyle = 'rgba(255,255,255,' + (.7 - r / 160) + ')'; g.beginPath(); g.arc(480 + Math.cos(a) * r * 1.6, 420 + Math.sin(a) * r * .3, 5, 0, 7); g.fill(); }
    mist(g, 420, 60, .55);
  },
  zazen: (g, t) => {
    skyP(g, ['#e8b890', '#f4dcc0', '#f8ecd8']); glow(g, 240, 260, 240, 'rgba(255,220,160,.8)');
    ridge(g, 280, 160, '#8a8aa0', 2, .8); mist(g, 290, 50, .6); ridge(g, 360, 120, '#5a6a70', 5, 1.2); mist(g, 380, 40, .5);
    for (let i = 0; i < 5; i++) { const x = (i * 170 + t * .02) % SW, y = 120 + i * 12; g.strokeStyle = '#3a3040'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 7, y); g.stroke(); }
    g.fillStyle = '#4a4440'; g.beginPath(); g.moveTo(560, 600); g.quadraticCurveTo(600, 400, 760, 390); g.quadraticCurveTo(920, 395, 960, 470); g.lineTo(960, 600); g.fill();
    g.fillStyle = '#5a544e'; g.fillRect(620, 392, 290, 12);
    pineP(g, 920, 400, 1.1, '#1a3020');
    figure(g, 760, 400, 230, Object.assign(KF(), { pose: 'zazen', back: true }));
    glow(g, 760, 320, 130, 'rgba(255,240,200,.25)');
  },
  meiso: (g, t) => {
    interiorP(g, null, true); g.fillStyle = 'rgba(120,140,190,.2)'; g.fillRect(120, 70, 360, 300);
    lampP(g, 200, 380, t); lampP(g, 760, 380, t);
    g.fillStyle = '#5a3a1e'; g.fillRect(380, 200, 200, 120); glow(g, 480, 250, 110, 'rgba(255,210,120,.6)'); g.fillStyle = '#e0b040'; g.beginPath(); g.ellipse(480, 250, 34, 44, 0, 0, 7); g.fill();
    figure(g, 480, 440, 230, Object.assign(KF(), { pose: 'zazen', back: true }));
    for (let i = 0; i < 4; i++) { const y = 380 - ((t / 30 + i * 70) % 260); g.fillStyle = 'rgba(255,255,255,' + (.15 - (380 - y) / 2500) + ')'; g.beginPath(); g.arc(560 + Math.sin(t / 700 + i) * 12, y, 10 + (380 - y) / 14, 0, 7); g.fill(); }
  },
  dokyo: (g, t) => {
    interiorP(g, '#fff0d0'); g.fillStyle = 'rgba(80,30,10,.35)'; g.fillRect(0, 0, SW, SH);
    g.fillStyle = '#3a1e10'; g.fillRect(330, 250, 300, 90); g.fillStyle = '#7a2a1a'; g.fillRect(350, 230, 260, 24);
    glow(g, 480, 150, 160, 'rgba(255,215,120,.85)'); g.fillStyle = '#e8c050'; g.beginPath(); g.ellipse(480, 160, 60, 70, 0, 0, 7); g.fill(); g.fillStyle = '#d8a830'; g.beginPath(); g.ellipse(480, 205, 70, 34, 0, 0, 7); g.fill(); g.beginPath(); g.arc(480, 130, 26, 0, 7); g.fill();
    for (const x of [360, 600]) { g.fillStyle = '#f4f0e0'; g.fillRect(x - 4, 180, 8, 50); glow(g, x, 175, 40, 'rgba(255,200,90,.9)'); }
    figure(g, 480, 450, 240, Object.assign(KF(), { pose: 'kgassho', back: true }));
    const M = (S && S.flags && S.flags.upasaka) ? MANTRA.kokuzo : MANTRA.shingyo;
    for (let i = 0; i < 8; i++) { const p = ((t / 2600 + i / 8) % 1), x = 340 + (i * 37) % 280, y = 380 - p * 300; g.globalAlpha = Math.sin(p * Math.PI) * .7; g.font = '26px ' + FONT; g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.fillText(M[i % M.length], x, y); }
    g.globalAlpha = 1;
  },
  danjiki: (g, t) => {
    g.fillStyle = '#2a2016'; g.fillRect(0, 0, SW, SH); g.fillStyle = '#4a3a26'; g.fillRect(0, 380, SW, 220);
    g.fillStyle = '#16203a'; g.fillRect(620, 90, 220, 170); glow(g, 760, 150, 50, 'rgba(240,240,255,.9)'); g.strokeStyle = '#2a1a10'; g.lineWidth = 6; g.strokeRect(620, 90, 220, 170); g.beginPath(); g.moveTo(730, 90); g.lineTo(730, 260); g.stroke();
    g.strokeStyle = 'rgba(230,220,200,.7)'; g.lineWidth = 4; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(140 + i * 18, 160); g.lineTo(140 + i * 18, 220); g.stroke(); }
    g.fillStyle = '#b89a5a'; g.fillRect(330, 420, 300, 30);
    figure(g, 480, 440, 230, Object.assign(KF(), { pose: 'zazen' }));
    g.fillStyle = 'rgba(160,190,255,.12)'; g.fillRect(0, 0, SW, SH);
  },
  gakumon: (g, t) => {
    interiorP(g, null, true); g.fillStyle = 'rgba(80,100,150,.25)'; g.fillRect(120, 70, 360, 300);
    lampP(g, 640, 340, t); deskP(g, 300, 400, 240);
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#a8885a', '#c8a870', '#8a6a42', '#b89860', '#e8d8a8'][i]; g.fillRect(720, 420 - i * 14, 110, 12); }
    figure(g, 230, 470, 270, Object.assign(KF(), { pose: 'write', eyes: 'open' }));
  },
  shodo: (g, t) => {
    interiorP(g, '#fff8e0'); raysP(g, 300, 120, '#fffbe8', .2, 6);
    deskP(g, 320, 410, 260); g.fillStyle = '#1a1a1a'; g.font = 'bold 54px "Shippori Mincho",serif'; g.fillStyle = 'rgba(20,14,10,.85)';
    figure(g, 240, 480, 300, Object.assign(KF(), { pose: 'write' }));
  },
  daigaku_enter: (g, t) => {
    skyP(g, ['#9ac8e8', '#e4f0f4', '#f8f0dc']); cloudP(g, 760, 100, 300, '#fff', .8);
    g.fillStyle = '#e0d0a8'; g.fillRect(0, 380, SW, 220);
    hallP(g, 250, 400, 460, 230, { roof: '#5a6672', pillar: '#8a5a32' });
    treeBlob(g, 110, 420, 1.4, '#f4b0c8'); treeBlob(g, 860, 420, 1.3, '#f4b0c8');
    for (let i = 0; i < 7; i++) figure(g, 260 + i * 70, 430 + (i % 2) * 6, 70, { robe: ['#4a5a9a', '#3a6a5a', '#7a3a5a', '#5a4a7a'][i % 4], head: 'eboshi', back: i % 3 !== 0 });
    figure(g, 820, 720, 360, { robe: '#4f86c6', head: 'mizura', back: true }); particles(g, t, 30, 'petal', 3);
  },
  lecture: (g, t) => {
    interiorP(g, '#fff4dc'); g.fillStyle = 'rgba(60,30,10,.2)'; g.fillRect(0, 0, SW, SH);
    g.fillStyle = '#7a2a1a'; g.fillRect(330, 300, 300, 40);
    figure(g, 480, 310, 190, { robe: '#5a2a3a', head: 'kanmuri', pose: 'zazen', beard: '#3a2a2a', eyes: 'open' });
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) figure(g, 120 + i * 145 + r * 60, 470 + r * 100, 150 + r * 30, { robe: i === 2 && r === 1 ? '#4f86c6' : ['#4a5a9a', '#3a6a5a', '#7a3a5a'][(i + r) % 3], head: i === 2 && r === 1 ? 'mizura' : 'eboshi', pose: 'kneel', back: true });
  },
  doubt: (g, t) => {
    interiorP(g, null, true); g.fillStyle = '#0e1626'; g.fillRect(120, 70, 360, 300);
    g.save(); g.beginPath(); g.rect(120, 70, 360, 300); g.clip(); particles(g, t, 90, 'rain', 5); g.restore();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 5; for (let x = 120; x <= 480; x += 60) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 370); g.stroke(); }
    lampP(g, 720, 380, t);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#a8885a', '#c8a870', '#8a6a42'][i % 3]; g.fillRect(560, 520 - i * 13, 100, 11); }
    figure(g, 170, 600, 300, { robe: '#4f86c6', head: 'mizura', pose: 'kneel', back: true });
    g.fillStyle = 'rgba(10,20,50,.3)'; g.fillRect(0, 0, SW, SH);
  },
  kokuhaku: (g, t) => {
    interiorP(g, null, true); lampP(g, 480, 340, t);
    figure(g, 760, 480, 300, { robe: '#3a4a7a', head: 'kanmuri', pose: 'zazen', beard: '#2a2a2a', eyes: 'open', flip: true });
    figure(g, 200, 560, 290, { robe: '#4f86c6', head: 'mizura', pose: 'kgassho' });
    g.fillStyle = 'rgba(20,10,30,.25)'; g.fillRect(0, 0, SW, SH);
  },
  teihatsu: (g, t) => {
    skyP(g, ['#2a3a5a', '#8a7a9a', '#f0c0a0', '#f8e0c0']); glow(g, 700, 300, 260, 'rgba(255,220,170,.8)');
    ridge(g, 300, 70, '#5a5a70', 3, 1.3); mist(g, 300, 30, .5);
    g.fillStyle = lg(g, 0, 300, 0, 600, ['#c8b0a8', '#4a5a7a']); g.fillRect(0, 300, SW, 300);
    for (let i = 0; i < 9; i++) { const y = 320 + i * 30; g.strokeStyle = 'rgba(255,255,255,' + (.25 - i * .02) + ')'; g.beginPath(); g.moveTo(80 + Math.sin(t / 900 + i) * 30, y); g.lineTo(880 + Math.sin(t / 800 + i) * 30, y); g.stroke(); }
    g.save(); g.globalAlpha = .35; g.translate(0, 600); g.scale(1, -1); figure(g, 260, 210, 230, { robe: '#4f86c6', head: 'mizura', pose: 'kneel' }); g.restore();
    g.fillStyle = '#3a3428'; g.beginPath(); g.moveTo(0, 380); g.quadraticCurveTo(260, 360, 420, 420); g.lineTo(420, 600); g.lineTo(0, 600); g.fill();
    figure(g, 230, 400, 230, { robe: '#ece6d6', head: 'mizura', pose: 'kneel' });
    g.strokeStyle = '#d8d8d8'; g.lineWidth = 4; g.beginPath(); g.moveTo(290, 240); g.lineTo(320, 225); g.stroke();
    for (let i = 0; i < 10; i++) { const p = ((t / 1800 + i / 10) % 1); g.strokeStyle = 'rgba(20,16,20,' + (1 - p) + ')'; g.lineWidth = 2; const x = 210 + (i * 13) % 60, y = 220 + p * 170; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y + 6, x + 2, y + 14); g.stroke(); }
    willowP(g, 860, 420);
  },
  travel_land: (g, t) => {
    skyP(g, ['#9ac8e8', '#e4eef0', '#f4ecd8']); cloudP(g, (t * .02) % 1200 - 200, 110, 300, '#fff', .8);
    ridge(g, 300, 120, '#8aa898', 2); mist(g, 300, 40, .5); ridge(g, 380, 70, '#6a9070', 5, 1.5);
    g.fillStyle = '#8ab060'; g.fillRect(0, 400, SW, 200); g.fillStyle = '#d8c090'; g.beginPath(); g.moveTo(0, 560); g.quadraticCurveTo(480, 420, 960, 470); g.lineTo(960, 500); g.quadraticCurveTo(480, 460, 0, 600); g.fill();
    pineP(g, 140, 470, .9); pineP(g, 820, 450, .8);
    g.fillStyle = '#d8c090'; g.fillRect(0, 430, SW, 18);
    const x = 100 + ((t * .05) % 760); figure(g, x, 440, 130, { ...TRAVEL_FIG(), flip: false });
  },
  travel_sea: (g, t) => {
    skyP(g, ['#7ab0e0', '#d0e8f4', '#f0f0e0']); cloudP(g, 300, 110, 360, '#fff', .8); ridge(g, 300, 40, '#8aa0b0', 7, 1.4);
    seaP(g, 300, '#8ab8d8', '#2a5a8a', t); shipP(g, 300 + ((t * .03) % 400), 385, .65, t, { crew: true });
  }
};
const TRAVEL_FIG = () => { const s = kukaiSpec(); return { robe: s.robe, head: s.hair === 'mizura' ? 'mizura' : 'shaved', kesa: s.kesa, staff: s.staff, back: true }; };

// ---------- 再生 ----------
function scene(id, pages, opts = {}) {
  return new Promise(res => {
    const el = $('scene'), cv = $('scv'), g = cv.getContext('2d');
    const draw = opts.drawFn || SCENES[id] || SCENES.travel_land;
    SCN.active = true; el.classList.remove('hidden'); $('hint').classList.add('hidden');
    requestAnimationFrame(() => el.classList.add('on'));
    let i = 0, shown = 0, full = false, t0 = performance.now(), timer = 0, done = false;
    const box = $('snarr'), head = $('sdate'), body = $('stext');
    const show = () => {
      const p = pages[i]; const hd = i === 0 ? (opts.date || '') : '';
      head.textContent = hd; head.style.display = hd ? '' : 'none';
      shown = 0; full = false; clearInterval(timer); box.classList.remove('done');
      timer = setInterval(() => { shown += 1; body.textContent = p.slice(0, shown); if (shown >= p.length) { clearInterval(timer); full = true; box.classList.add('done'); } }, 38);
    };
    const adv = () => {
      if (done) return;
      if (!full) { clearInterval(timer); body.textContent = pages[i]; full = true; box.classList.add('done'); return; }
      i++; if (i < pages.length) { show(); return; }
      done = true; el.classList.remove('on'); clearInterval(timer);
      setTimeout(() => { el.classList.add('hidden'); SCN.active = false; SCN.adv = null; res(); }, 600);
    };
    SCN.adv = adv;
    const loop = now => { if (!SCN.active || done && !el.classList.contains('on') && now - t0 > 99999) return; g.save(); draw(g, now - t0); g.restore(); finish(g, opts.warm ?? .12); if (SCN.active) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    show();
  });
}
function scnKey(k) { if (SCN.adv && (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z' || k === 'Escape')) SCN.adv(); }
document.getElementById('scene').addEventListener('click', () => SCN.adv && SCN.adv());

// ---------- 改名の演出 ----------
function nameScene(oldN, newN, pages, date) {
  const drawFn = (g, t) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 300; i++) { g.fillStyle = i % 2 ? 'rgba(150,110,60,.07)' : 'rgba(255,255,255,.15)'; g.fillRect(h2(i, 1, 3) * SW, h2(i, 2, 3) * SH, 3 + h2(i, 3, 3) * 40, 2); }
    g.fillStyle = 'rgba(120,40,30,.85)'; g.font = '22px "Shippori Mincho",serif'; g.textAlign = 'center'; g.fillText('― 改 名 ―', SW / 2, 54);
    // 旧名（右・薄く）
    g.font = '64px "Shippori Mincho",serif'; g.fillStyle = 'rgba(60,40,30,' + Math.max(.18, 1 - t / 1800) + ')';
    [...oldN].forEach((c, i) => g.fillText(c, 760, 150 + i * 76));
    if (t > 900) { g.strokeStyle = 'rgba(160,40,30,.8)'; g.lineWidth = 4; const p = Math.min(1, (t - 900) / 500); g.beginPath(); g.moveTo(760, 100); g.lineTo(760, 100 + p * (oldN.length * 76 + 20)); g.stroke(); }
    // 新名（中央・筆で書かれていく）
    const p2 = Math.max(0, Math.min(1, (t - 1400) / 2200));
    g.save(); g.beginPath(); g.rect(0, 0, SW, 90 + p2 * (newN.length * 150)); g.clip();
    g.font = 'bold 140px "Shippori Mincho",serif'; g.fillStyle = '#1a120c';
    [...newN].forEach((c, i) => { g.fillText(c, 470, 210 + i * 150); });
    g.restore();
    if (p2 >= 1) { g.fillStyle = '#c8302a'; g.fillRect(580, 250, 46, 46); g.fillStyle = '#f8e8d0'; g.font = '20px "Shippori Mincho",serif'; g.fillText('印', 603, 280); }
  };
  return scene('name', pages, { date, drawFn, warm: .05 });
}
