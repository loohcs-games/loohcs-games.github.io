'use strict';
// ===== 描画（斜め見下ろしの疑似3D、テレビ中継風） =====
const TILT = 0.66;
const Render = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, cam: { x: 60, y: 26.6, s: 20 }, disp: [], dispBall: null, smooth: false, t: 0,
  init(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.resize(); addEventListener('resize', () => this.resize()); },
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1); this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
  },
  P(x, y, z = 0) { const c = this.cam; return [this.W / 2 + (x - c.x) * c.s, this.H / 2 + (y - c.y) * c.s * TILT - z * c.s * 0.92]; },

  // gv: game view, teams: [home, away], local: Set(ctrl index)
  draw(gv, teams, local, dt) {
    const ctx = this.ctx; this.t += dt;
    if (!this.W || !this.H) { this.resize(); if (!this.W || !this.H) return; }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sv = gv && gv.sim;
    // カメラ
    let tx = 60, ty = FIELD.WID / 2, ts = Math.min(this.W / 58, this.H / 33);
    if (sv) {
      const b = sv.b;
      if (sv.st === 'pre') { tx = sv.los - sv.dir * 6; ty = U.clamp(b[1], 18, 35); }
      else { tx = b[3] === 'air' && b[4] != null ? (b[0] * 0.6 + b[4] * 0.4) : b[0]; ty = b[1]; if (b[3] === 'air') ts *= 0.88; }
      if (sv.aim && local.has(sv.aim[0])) { tx = sv.aim[1] * 0.5 + sv.aim[3] * 0.5; ty = sv.aim[2] * 0.5 + sv.aim[4] * 0.5; ts = Math.min(ts, this.W / (Math.abs(sv.aim[3] - sv.aim[1]) + 16)); }
      if (sv.k === 'kickoff' && sv.st === 'pre') { tx = sv.los + sv.dir * 18; ts *= 0.85; }
    } else if (gv && gv.losX != null) { tx = gv.losX; ty = gv.ballY; }
    const c = this.cam, k = Math.min(1, dt * 3.2);
    if (!gv) { ty = 4; ts *= 0.85; }
    c.x += (tx - c.x) * k; c.y += ((gv ? U.clamp(ty, 14, FIELD.WID - 14) : ty) - c.y) * k * 0.8; c.s += (ts - c.s) * Math.min(1, dt * 2);
    this.drawStadium(teams);
    this.drawField(teams, gv);
    this.drawBenches(teams);
    if (sv) {
      this.drawLines(sv.los, sv.fd);
      this.drawRoutes(sv, local);
      this.drawPlayers(sv, teams, local, dt);
      this.drawAim(sv, local);
      this.drawBall(sv, local);
      this.drawMeter(sv, local);
    } else if (gv && gv.losX != null && gv.ph !== 'intro') this.drawLines(gv.losX, gv.ctx && gv.ctx.type === 'scrim' ? gv.fdX : null);
  },
  toWorld(sx, sy) { const c = this.cam; return { x: c.x + (sx - this.W / 2) / c.s, y: c.y + (sy - this.H / 2) / (c.s * TILT) }; },
  excite: 0.3, teamsForCrowd: null,
  drawStadium(teams) {
    const ctx = this.ctx, g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#070b14'); g.addColorStop(1, '#10161f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    const [, top] = this.P(0, -3);
    // スタンド（奥）
    const sg = ctx.createLinearGradient(0, 0, 0, Math.max(1, top));
    sg.addColorStop(0, '#0b1018'); sg.addColorStop(1, '#232b3a');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, this.W, Math.max(0, top));
    // 照明の光
    for (let i = 0; i < 4 && this.W > 10; i++) {
      const lx = ((i * 0.33 + 0.1) * this.W - (this.cam.x * 2) % (this.W * 0.33)); if (!isFinite(lx)) break; const rg = ctx.createRadialGradient(lx, 0, 0, lx, 0, this.W * 0.25);
      rg.addColorStop(0, 'rgba(255,250,220,0.18)'); rg.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = rg; ctx.fillRect(lx - this.W * 0.25, 0, this.W * 0.5, this.W * 0.25);
    }
    this.drawCrowd(teams);
  },
  // 動く観客（奥のスタンド）
  drawCrowd(teams) {
    if (!teams) return;
    const ctx = this.ctx, c = this.cam, s = c.s, t = this.t;
    this.excite += (0.3 - this.excite) * 0.01;
    const E = this.excite, cols = [teams[0].c1, teams[0].c1, teams[0].c2, '#e8e8e8', teams[1].c1, '#555c66', teams[0].c1];
    const x0 = Math.floor(c.x - this.W / 2 / s) - 2, x1 = Math.ceil(c.x + this.W / 2 / s) + 2;
    for (let r = 11; r >= 0; r--) {
      const y = -6.5 - r * 1.5, z = 1.2 + r * 1.05;
      // 段
      const [ax, ay] = this.P(x0, y + 0.6, z - 0.55), [bx] = this.P(x1, y + 0.6, z - 0.55);
      ctx.fillStyle = r % 2 ? '#2a3242' : '#252c3b'; ctx.fillRect(ax, ay, bx - ax, s * 1.1);
      for (let xi = x0 * 1.2 | 0; xi < x1 * 1.2; xi++) {
        const x = xi / 1.2, h = Math.sin(xi * 12.9898 + r * 78.233) * 43758.5453, rnd = h - Math.floor(h);
        if (rnd < 0.08) continue; // 空席
        const ph = rnd * 6.28, wave = Math.max(0, Math.sin(x * 0.15 - t * 2.2)) * (E > 0.6 ? 1 : 0);
        const jump = (Math.abs(Math.sin(t * (3 + rnd * 3) + ph)) * (0.06 + E * 0.35) + wave * 0.5);
        const [px, py] = this.P(x, y, z + jump);
        if (px < -10 || px > this.W + 10) continue;
        const col = cols[(rnd * 97 | 0) % cols.length], hr = s * 0.2;
        ctx.fillStyle = col; ctx.fillRect(px - hr, py - hr * 0.6, hr * 2, hr * 2.2);
        ctx.fillStyle = ['#f1d0b5', '#d9a77f', '#b07a52', '#7d4f32', '#4a2e1e'][(rnd * 53 | 0) % 5];
        ctx.beginPath(); ctx.arc(px, py - hr * 1.2, hr * 0.75, 0, 7); ctx.fill();
        if (E > 0.55 || wave > 0.3) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, hr * 0.45); ctx.beginPath(); ctx.moveTo(px - hr, py - hr * 0.4); ctx.lineTo(px - hr * 1.6, py - hr * 2.6); ctx.moveTo(px + hr, py - hr * 0.4); ctx.lineTo(px + hr * 1.6, py - hr * 2.6); ctx.stroke(); }
      }
    }
  },
  // チームエリア（ベンチの選手・コーチ）
  drawBenches(teams) {
    if (!teams) return;
    const ctx = this.ctx, s = this.cam.s, t = this.t, E = this.excite;
    for (const [side, xa, xb] of [[0, 38, 58], [1, 62, 82]]) {
      const col = this.colors(teams[side], side);
      for (let x = xa; x < xb; x += 1.15) {
        const h = Math.sin(x * 91.7 + side * 7) * 9999, rnd = h - Math.floor(h);
        const y = -2.6 - rnd * 1.6, [px, py] = this.P(x, y, Math.abs(Math.sin(t * 2 + rnd * 6)) * 0.05 * (1 + E * 3));
        if (px < -10 || px > this.W + 10) continue;
        const hs = s * 0.75;
        ctx.fillStyle = rnd < 0.12 ? '#222' : col.jersey; ctx.fillRect(px - hs * 0.32, py - hs * 1.3, hs * 0.64, hs * 0.75);
        ctx.fillStyle = col.pants; ctx.fillRect(px - hs * 0.28, py - hs * 0.55, hs * 0.56, hs * 0.55);
        ctx.fillStyle = rnd < 0.12 ? '#d9a77f' : col.hel; ctx.beginPath(); ctx.arc(px, py - hs * 1.5, hs * 0.24, 0, 7); ctx.fill();
      }
    }
  },
  drawAim(sv, local) {
    const a = sv.aim; if (!a || !local.has(a[0]) || sv.st !== 'live') return;
    const [, x0, y0, x1, y1, T, vz, z0, ok, loft] = a, ctx = this.ctx, s = this.cam.s;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const k = i / 24, tt = T * k; pts.push(this.P(U.lerp(x0, x1, k), U.lerp(y0, y1, k), Math.max(0, z0 + vz * tt - 0.5 * FIELD.GRAV * tt * tt))); }
    const col = ok ? '#4dff9a' : '#ffffff';
    ctx.save(); ctx.lineWidth = Math.max(2, s * 0.12); ctx.strokeStyle = col; ctx.setLineDash([s * 0.5, s * 0.3]); ctx.globalAlpha = 0.9;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.setLineDash([]);
    const [ex, ey] = pts[pts.length - 1], [px, py] = pts[pts.length - 3], an = Math.atan2(ey - py, ex - px);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - s * 0.7 * Math.cos(an - 0.45), ey - s * 0.7 * Math.sin(an - 0.45)); ctx.lineTo(ex - s * 0.7 * Math.cos(an + 0.45), ey - s * 0.7 * Math.sin(an + 0.45)); ctx.fill();
    const [lx, ly] = this.P(x1, y1); ctx.translate(lx, ly); ctx.scale(1, TILT); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, 7); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(8,12,20,0.85)'; ctx.fillRect(lx - 42, ly + s * 0.9, 84, 20); ctx.fillStyle = col; ctx.font = '700 12px Oswald'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(loft > 66 ? 'ロブ（高い）' : loft > 33 ? 'タッチ' : '弾丸（低い）', lx, ly + s * 0.9 + 10);
  },
  drawField(teams, gv) {
    const ctx = this.ctx, home = teams[0];
    // 外周（サイドライン外の芝）
    this.quad(-6, -4, 126, FIELD.WID + 4, '#245c27');
    // 5ヤードごとの縞
    for (let x = 10; x < 110; x += 5) this.quad(x, 0, x + 5, FIELD.WID, ((x - 10) / 5) % 2 ? '#2e7a31' : '#33843a');
    // エンドゾーン
    this.quad(0, 0, 10, FIELD.WID, home.c1); this.quad(110, 0, 120, FIELD.WID, home.c1);
    this.ezText(5, home.name.toUpperCase(), -1); this.ezText(115, home.name.toUpperCase(), 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(1, this.cam.s * 0.1);
    // ヤードライン
    for (let x = 10; x <= 110; x += 5) { this.line(x, 0, x, FIELD.WID, x === 10 || x === 110 ? 2 : 1); }
    // 外枠
    this.line(0, 0, 120, 0, 2.5); this.line(0, FIELD.WID, 120, FIELD.WID, 2.5); this.line(0, 0, 0, FIELD.WID, 2.5); this.line(120, 0, 120, FIELD.WID, 2.5);
    // ハッシュマーク
    ctx.lineWidth = Math.max(1, this.cam.s * 0.06);
    for (let x = 11; x < 110; x++) {
      if (x % 5 === 0) continue;
      for (const y of [0.4, FIELD.HASH1, FIELD.HASH2, FIELD.WID - 0.4]) this.line(x, y - 0.35, x, y + 0.35, 1);
    }
    // 数字
    for (let n = 10; n <= 90; n += 10) {
      const x = 10 + n, lab = String(n <= 50 ? n : 100 - n);
      this.fieldText(x, 12, lab, false); this.fieldText(x, FIELD.WID - 12, lab, true);
    }
    // センターロゴ
    const [cx, cy] = this.P(60, FIELD.WID / 2), r = this.cam.s * 4;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, TILT);
    ctx.fillStyle = home.c1; ctx.strokeStyle = home.c2; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${r * 0.8}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(home.id, 0, 2);
    ctx.restore();
    // ゴールポスト
    for (const gx of [0, 120]) this.goalPost(gx);
  },
  quad(x1, y1, x2, y2, col) {
    const [a, b] = this.P(x1, y1), [c, d] = this.P(x2, y2);
    if (c < -50 || a > this.W + 50) return;
    this.ctx.fillStyle = col; this.ctx.fillRect(a, b, c - a, d - b);
  },
  line(x1, y1, x2, y2, w) {
    const [a, b] = this.P(x1, y1), [c, d] = this.P(x2, y2);
    if (Math.max(a, c) < -20 || Math.min(a, c) > this.W + 20) return;
    const ctx = this.ctx, lw = ctx.lineWidth; ctx.lineWidth = lw * w;
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.lineWidth = lw;
  },
  fieldText(x, y, txt, flip) {
    const [a, b] = this.P(x, y); if (a < -80 || a > this.W + 80) return;
    const ctx = this.ctx; ctx.save(); ctx.translate(a, b); ctx.scale(1, TILT); if (flip) ctx.rotate(Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = `700 ${this.cam.s * 1.9}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0); ctx.restore();
  },
  ezText(x, txt, rot) {
    const [a, b] = this.P(x, FIELD.WID / 2); if (a < -200 || a > this.W + 200) return;
    const ctx = this.ctx; ctx.save(); ctx.translate(a, b); ctx.scale(1, TILT); ctx.rotate(rot * Math.PI / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `700 ${this.cam.s * 5}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 0); ctx.restore();
  },
  goalPost(x) {
    const ctx = this.ctx, m = FIELD.WID / 2, cb = 3.33, w = 3.08;
    const [bx, by] = this.P(x, m, 0); if (bx < -100 || bx > this.W + 100) return;
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = Math.max(2, this.cam.s * 0.22); ctx.lineCap = 'round';
    const seg = (a, b) => { const p = this.P(...a), q = this.P(...b); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; seg([x + 0.3, m - w, 0], [x + 0.3, m + w, 0]);
    ctx.strokeStyle = '#ffd400';
    seg([x, m, 0], [x, m, cb]); seg([x, m - w, cb], [x, m + w, cb]); seg([x, m - w, cb], [x, m - w, cb + 10]); seg([x, m + w, cb], [x, m + w, cb + 10]);
  },
  drawLines(los, fd) {
    const ctx = this.ctx; ctx.lineWidth = Math.max(2, this.cam.s * 0.16);
    ctx.strokeStyle = 'rgba(70,140,255,0.95)'; this.line(los, 0, los, FIELD.WID, 1);
    if (fd != null && fd > 10 && fd < 110) { ctx.strokeStyle = 'rgba(255,214,0,0.95)'; this.line(fd, 0, fd, FIELD.WID, 1); }
  },
  drawRoutes(sv, local) {
    const ctx = this.ctx;
    for (const [hi, pts] of sv.routes || []) {
      if (!local.has(hi)) continue;
      ctx.strokeStyle = 'rgba(255,214,0,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = this.P(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); ctx.setLineDash([]);
    }
  },
  colors(team, side) {
    return side === 0 ? { jersey: team.c1, num: '#fff', pants: '#e8e8e8', hel: team.hel, trim: team.c2 }
      : { jersey: '#f4f4f4', num: team.c1, pants: team.c2 === '#FFFFFF' ? '#ddd' : '#cfcfcf', hel: team.hel, trim: team.c1 };
  },
  drawPlayers(sv, teams, local, dt) {
    const ctx = this.ctx, s0 = this.cam.s;
    // 補間（オンライン用）
    if (this.disp.length !== sv.p.length) this.disp = sv.p.map(p => [p[0], p[1]]);
    const k = this.smooth ? Math.min(1, dt * 14) : 1;
    sv.p.forEach((p, i) => { this.disp[i][0] += (p[0] - this.disp[i][0]) * k; this.disp[i][1] += (p[1] - this.disp[i][1]) * k; });
    const order = sv.p.map((p, i) => i).sort((a, b) => this.disp[a][1] - this.disp[b][1]);
    const tagged = [];
    for (const i of order) {
      const p = sv.p[i], [x, y] = this.disp[i];
      const [sx, sy] = this.P(x, y);
      if (sx < -60 || sx > this.W + 60) continue;
      const [, side, num, face, spd, hum, down, anim, eng, pos, icon, look] = p.slice(1);
      const s = s0 * (p[13] || 1);
      const col = this.colors(teams[side], side);
      // 操作中マーカー
      if (hum >= 0) {
        ctx.save(); ctx.translate(sx, sy); ctx.scale(1, TILT);
        ctx.strokeStyle = local.has(hum) ? '#ffd400' : '#ff4d4d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, 7); ctx.stroke(); ctx.restore();
        if (local.has(hum)) tagged.push([sx, sy, num]);
      }
      // 影（倒れると長くなる）
      const fx = Math.cos(face), dirX = fx >= 0 ? 1 : -1, fv = down || 0, fl = Math.max(0, fv);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx + s * 0.15 + dirX * s * 0.9 * fl, sy, s * (0.5 + 0.75 * fl), s * 0.22, 0, 0, 7); ctx.fill();
      // 倒れる：足元を支点に体を回転
      ctx.save();
      if (fv) { ctx.translate(sx, sy); ctx.rotate((fv > 0 ? Math.sin(fv * Math.PI / 2) * 1.5 : -fv) * dirX); ctx.translate(-sx, -sy); }
      if (fl > 0.85) { ctx.fillStyle = 'rgba(210,190,150,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy - s * 0.2, s * 0.9, s * 0.25, 0, 0, 7); ctx.fill(); }
      const bob = Math.abs(Math.sin(anim)) * s * 0.06 * Math.min(1, spd / 3) * (1 - fl);
      const swing = Math.sin(anim) * s * 0.28 * Math.min(1, spd / 4) * (1 - fl);
      const hip = sy - s * 0.85 - bob;
      // 脚
      ctx.strokeStyle = col.pants; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx - s * 0.12, hip); ctx.lineTo(sx - s * 0.12 + swing, sy - s * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + s * 0.12, hip); ctx.lineTo(sx + s * 0.12 - swing, sy - s * 0.05); ctx.stroke();
      ctx.strokeStyle = look && look.cleat ? (look.cleat === 'team' ? col.trim : look.cleat) : '#111'; ctx.lineWidth = s * 0.14;
      ctx.beginPath(); ctx.moveTo(sx - s * 0.12 + swing, sy - s * 0.08); ctx.lineTo(sx - s * 0.12 + swing + dirX * s * 0.12, sy - s * 0.04); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + s * 0.12 - swing, sy - s * 0.08); ctx.lineTo(sx + s * 0.12 - swing + dirX * s * 0.12, sy - s * 0.04); ctx.stroke();
      // 胴体（ショルダーパッド）
      const lean = eng ? dirX * s * 0.18 : dirX * Math.min(1, spd / 9) * s * 0.12;
      const bw = s * (['LT', 'LG', 'C', 'RG', 'RT', 'DT'].includes(pos) ? 0.95 : 0.8), bh = s * 0.82, top = hip - bh;
      ctx.fillStyle = col.jersey; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx - bw / 2 + lean, top, bw, bh, s * 0.18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col.trim; ctx.fillRect(sx - bw / 2 + lean, top + bh * 0.08, bw, bh * 0.1);
      // 腕（スリーブ・肌）
      const armCol = look && look.sleeve ? (look.sleeve === 'team' ? col.trim : look.sleeve) : (look ? look.skin : col.jersey);
      ctx.strokeStyle = armCol; ctx.lineWidth = s * 0.17;
      const arm = eng ? dirX * s * 0.5 : -swing * 0.7;
      const a1 = [sx - bw / 2 + lean + arm * 0.5 - s * 0.05, top + bh * 0.8], a2 = [sx + bw / 2 + lean - arm * 0.5 + s * 0.05, top + bh * 0.8];
      ctx.beginPath(); ctx.moveTo(sx - bw / 2 + lean, top + bh * 0.25); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + bw / 2 + lean, top + bh * 0.25); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
      if (look) { ctx.fillStyle = look.skin; for (const a of [a1, a2]) { ctx.beginPath(); ctx.arc(a[0], a[1], s * 0.1, 0, 7); ctx.fill(); } ctx.fillRect(sx + lean * 1.2 - s * 0.1, top - s * 0.06, s * 0.2, s * 0.1); }
      // 背番号
      if (s > 9) { ctx.fillStyle = col.num; ctx.font = `700 ${s * 0.48}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(num, sx + lean, top + bh * 0.58); }
      // ヘルメット
      const hx = sx + lean * 1.4, hy = top - s * 0.22;
      ctx.fillStyle = col.hel; ctx.beginPath(); ctx.arc(hx, hy, s * 0.3, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.arc(hx, hy, s * 0.3, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(hx + dirX * s * 0.18, hy - s * 0.04); ctx.lineTo(hx + dirX * s * 0.36, hy + s * 0.06); ctx.lineTo(hx + dirX * s * 0.2, hy + s * 0.2); ctx.stroke();
      if (look && look.visor) { ctx.strokeStyle = look.visor; ctx.lineWidth = s * 0.11; ctx.beginPath(); ctx.moveTo(hx + dirX * s * 0.12, hy - s * 0.06); ctx.lineTo(hx + dirX * s * 0.3, hy - s * 0.02); ctx.stroke(); }
      // レシーバーアイコン（パス先）
      if (icon) {
        ctx.fillStyle = ['#2ecc71', '#e74c3c', '#3498db', '#f1c40f', '#9b59b6'][icon - 1];
        ctx.beginPath(); ctx.arc(hx, hy - s * 0.85, s * 0.42, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.55}px Oswald`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, hx, hy - s * 0.83);
      }
      ctx.restore();
    }
    // 切替候補（Tab / クリックで切替）
    for (const [ci, pi] of sv.sw || []) {
      if (!local.has(ci) || !sv.p[pi]) continue;
      const [qx, qy] = this.P(this.disp[pi][0], this.disp[pi][1]);
      ctx.save(); ctx.translate(qx, qy); ctx.scale(1, TILT); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(120,200,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, s0 * 0.85, 0, 7); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(10,20,40,0.8)'; ctx.font = `700 ${Math.max(10, s0 * 0.45)}px Oswald`; ctx.textAlign = 'center';
      const tw = ctx.measureText('TAB').width + 8; ctx.fillRect(qx - tw / 2, qy + s0 * 0.35, tw, s0 * 0.6);
      ctx.fillStyle = '#9fd8ff'; ctx.textBaseline = 'middle'; ctx.fillText('TAB', qx, qy + s0 * 0.66);
    }
    const s = s0;
    for (const [sx, sy] of tagged) {
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(sx, sy - s * 2.6); ctx.lineTo(sx - s * 0.3, sy - s * 3.1); ctx.lineTo(sx + s * 0.3, sy - s * 3.1); ctx.fill();
    }
  },
  drawBall(sv, local) {
    const ctx = this.ctx, s = this.cam.s, b = sv.b;
    if (!this.dispBall) this.dispBall = [b[0], b[1], b[2]];
    const k = this.smooth ? 0.5 : 1; for (let i = 0; i < 3; i++) this.dispBall[i] += (b[i] - this.dispBall[i]) * k;
    const [x, y, z] = this.dispBall;
    // 落下地点
    if (b[3] === 'air' && b[4] != null) {
      const [lx, ly] = this.P(b[4], b[5]); ctx.save(); ctx.translate(lx, ly); ctx.scale(1, TILT);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, s * 0.9, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
    const [gx, gy] = this.P(x, y, 0), [bx, by] = this.P(x, y, z);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(gx, gy, s * 0.25, s * 0.1, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(bx, by); ctx.rotate(b[3] === 'air' ? this.t * 14 % 6.28 * 0.15 - 0.4 : -0.3);
    ctx.fillStyle = '#7a3d17'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.18, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.1, 0); ctx.stroke();
    ctx.restore();
  },
  drawMeter(sv, local) {
    const m = sv.meter; if (!m || !local.has(m.who) || m.ph === 'done' || sv.st === 'done') return;
    const ctx = this.ctx, W = 360, H = 22, x0 = this.W / 2 - W / 2, y0 = this.H - 170;
    ctx.fillStyle = 'rgba(8,12,20,0.85)'; ctx.beginPath(); ctx.roundRect(x0 - 16, y0 - 54, W + 32, 108, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 14px "Noto Sans JP"'; ctx.textAlign = 'center';
    const lab = { aim: 'W/S で方向 → Space でパワー開始', power: 'Space でパワー決定', acc: 'Space で精度（中央が正確）' }[m.ph];
    ctx.fillText(lab, this.W / 2, y0 - 32);
    // パワー
    const g = ctx.createLinearGradient(x0, 0, x0 + W, 0); g.addColorStop(0, '#2ecc71'); g.addColorStop(0.75, '#f1c40f'); g.addColorStop(1, '#e74c3c');
    ctx.fillStyle = '#222b3d'; ctx.fillRect(x0, y0 - 14, W, H); ctx.fillStyle = g; ctx.fillRect(x0, y0 - 14, W * m.pw, H);
    // 精度
    ctx.fillStyle = '#222b3d'; ctx.fillRect(x0, y0 + 16, W, 14);
    ctx.fillStyle = 'rgba(46,204,113,0.6)'; ctx.fillRect(x0 + W / 2 - W * 0.06, y0 + 16, W * 0.12, 14);
    if (m.ph === 'acc' || m.ph === 'done') { ctx.fillStyle = '#fff'; ctx.fillRect(x0 + W / 2 + m.ac * W / 2 - 2, y0 + 12, 4, 22); }
    // 方向
    ctx.fillStyle = '#ffd400'; ctx.font = '700 13px Oswald';
    ctx.fillText(`AIM ${m.aim > 0.05 ? '▼' : m.aim < -0.05 ? '▲' : '●'} ${Math.round(Math.abs(m.aim) * 100)}`, this.W / 2, y0 + 48);
    // 方向矢印をフィールド上に
    const b = sv.b, [bx, by] = this.P(b[0], b[1]), [tx, ty] = this.P(b[0] + sv.dir * 12, b[1] + m.aim * 12);
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  },
};
