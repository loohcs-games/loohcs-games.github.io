// ai.js — CPU の思考。人と同じ入力（ボタンの並び）を返す。乱数は試合の種つき乱数だけを使う。
(function (root) {
  'use strict';
  const F = root.FIGHT, B = F.BIT, FW = 512, BK = 1024;
  const SKILL = [0.28, 0.58, 0.9], GAP = [15, 8, 3];

  function make(lvl) { return { lvl, plan: [], cd: 20, hold: 0, holdT: 0 }; }
  function reach(m) { let r = 0; for (const h of m.hits) r = Math.max(r, h.box[0] + h.box[2]); return r || 120; }

  function think(g, i) {
    const f = g.f[i], o = g.f[1 - i], a = f.ai, r = g.rnd;
    if (g.phase !== 'fight') { a.plan.length = 0; return 0; }
    const toR = o.x >= f.x, fw = toR ? B.R : B.L, bk = toR ? B.L : B.R;
    const res = b => (b & ~(FW | BK)) | (b & FW ? fw : 0) | (b & BK ? bk : 0);
    const busy = f.st === 'hit' || f.st === 'airhit' || f.st === 'down' || f.st === 'getup' || f.st === 'block';
    if (busy) { a.plan.length = 0; }
    if (a.plan.length) { const s = a.plan[0], out = res(s.b); if (--s.n <= 0) a.plan.shift(); return out; }
    if (a.holdT > 0) { a.holdT--; if (a.cd > 0) a.cd--; if (a.cd > 0 || a.holdT > 6) return res(a.hold); }
    if (a.cd > 0) { a.cd--; return res(a.hold); }
    a.cd = GAP[a.lvl] + Math.floor(r() * 4);
    const P = SKILL[a.lvl], d = Math.abs(o.x - f.x), girl = f.key === 'girl', air = f.y > 0;
    const plan = (...s) => { a.plan = s.map(q => ({ b: q[0], n: q[1] })); const t = a.plan[0], out = res(t.b); if (--t.n <= 0) a.plan.shift(); return out; };
    const hold = (b, n) => { a.hold = b; a.holdT = n; return res(b); };

    // 1. 身を守る
    let threat = o.st === 'atk' && o.mv && o.t < o.mv.total - 6 && d < reach(o.mv) + 70 && o.mv.type !== 'special' || (o.st === 'atk' && o.mv && o.mv.hits.length && d < reach(o.mv) + 90);
    let low = o.st === 'atk' && o.mv && o.mv.hits[0] && o.mv.hits[0].guard === 'low';
    for (const e of g.ents) {
      if (e.owner === i || !e.hit) continue;
      const ed = Math.abs(e.x - f.x);
      if (ed < 150 + Math.abs(e.vx) * 12 && e.t < e.delay + e.active) { threat = true; low = false; if (e.kind !== 'maw' && !air && r() < P * 0.6 && e.t < e.delay - 10) return plan([B.A | B.B | (r() < 0.5 ? BK : 0), 2], [0, 8]); }
    }
    const canDef = f.st === 'idle' || f.st === 'walk' || f.st === 'crouch' || f.st === 'air' || f.st === 'block';
    if (threat && canDef) {
      if (r() < P) {
        if (a.lvl >= 2 && r() < 0.14 && !air) return plan([B.S, 10], [girl ? B.B : B.A, 2], [0, 2], [B.C, 2]);
        return hold(BK | (low && !(o.y > 0) ? B.D : 0), 12);
      }
    }
    // 2. 当たっている最中：つなぐ
    if (f.st === 'atk' && f.contact && f.mv.type === 'normal') {
      if (r() > P + 0.08) return 0;
      const n = f.mv.name, hitOK = f.hitOK;
      if (f.y > 0) { if (n === 'jA') return plan([B.B, 2]); if (n === 'jB') return plan([B.C, 2]); if (hitOK && r() < 0.5) return plan([B.X, 2]); return 0; }
      if (hitOK && f.gauge >= 200 && (n === '5C' || n === '2C' || o.hp < 2600) && r() < 0.8) return plan([B.D, 1], [B.D | B.X, 2]);
      if (n === '5A' || n === '2A') return plan([r() < 0.4 ? B.D | B.B : B.B, 2]);
      if (n === '5B') return plan([r() < 0.35 ? B.D | B.B : B.C, 2]);
      if (n === '2B') return plan([B.C, 2]);
      if (n === '5C') {
        if (!hitOK) return r() < 0.4 ? plan([girl ? BK | B.X : B.X, 2]) : 0;
        if (!f.used['2C'] && r() < 0.55) return plan([B.D | B.C, 2]);
        return plan([girl ? (r() < 0.5 ? B.X : FW | B.X) : (d < 130 ? FW | B.X : B.X), 2]);
      }
      if (n === '2C' && hitOK) return r() < 0.6 ? plan([B.U | FW, 5], [0, 6], [B.B, 2], [0, 7], [B.C, 2], [0, 9], [B.X, 2]) : plan([FW | B.X, 2]);
      return 0;
    }
    if (f.st === 'atk' || f.st === 'prejump' || f.st === 'land' || f.st === 'dash' && r() < 0.5) return 0;
    if (air) {
      if (f.st === 'air' && d < 200 && f.vy < 3 && f.y < 150 && r() < P + 0.2) return plan([r() < 0.6 ? B.C : B.B, 2]);
      if (f.st === 'air' && d > 260 && f.y > 70 && r() < 0.06) return plan([B.A | B.B, 2], [0, 8]);
      return 0;
    }
    // 3. 立ち回り
    const oAir = o.y > 40 && (o.st === 'air' || o.st === 'airdash' || o.st === 'atk');
    if (oAir && d < 240 && r() < P * 0.8) {
      if (d < 150 && r() < 0.55) return plan([FW | B.X, 2]);
      if (r() < 0.6) return plan([B.D | B.C, 2]);
      return hold(BK, 14);
    }
    if (f.gauge >= 200 && a.lvl >= 1 && r() < 0.012 && d < (girl ? 420 : 900)) return plan([B.D, 1], [B.D | B.X, 2]);
    const x = r();
    if (o.st === 'down' || o.st === 'getup') {
      if (d > 150) return x < 0.5 ? hold(FW, 12) : plan([B.A | B.B, 2], [FW, 6]);
      if (girl && x < 0.4) return plan([BK | B.X, 2]);
      return x < 0.6 ? plan([B.D, 6], [B.D | B.A, 2]) : hold(BK, 10);
    }
    if (d > 430) {
      if (x < 0.30) return hold(FW, 16);
      if (x < 0.52) return plan([B.A | B.B, 2], [FW, 9]);
      if (x < 0.76) return girl ? plan([BK | B.X, 2]) : plan([B.X, 2]);
      if (x < 0.90) return plan([B.U | FW, 5], [FW, 14]);
      if (!girl && x < 0.96) return plan([BK | B.X, 2]);
      return hold(0, 10);
    }
    if (d > 175) {
      if (x < 0.20) return plan([B.A | B.B, 2], [FW, 7], [r() < 0.5 ? B.D | B.B : B.B, 2]);
      if (x < 0.38) return plan([B.U | FW, 5], [FW, 17], [B.C, 2]);
      if (x < 0.50) return girl ? (d < 340 ? plan([B.X, 2]) : hold(FW, 10)) : (d < 230 ? plan([B.C, 2]) : plan([B.X, 2]));
      if (x < 0.60) return girl ? plan([BK | B.X, 2]) : (d < 215 ? plan([B.D | B.B, 2]) : hold(FW, 10));
      if (x < 0.80) return hold(FW, 10);
      if (x < 0.90) return hold(BK, 12);
      return hold(BK | B.D, 10);
    }
    if (x < 0.22) return plan([B.D | B.A, 2]);
    if (x < 0.40) return plan([B.A, 2]);
    if (x < 0.56) return plan([B.B, 2]);
    if (x < 0.68) return plan([B.D | B.B, 2]);
    if (x < 0.76) return plan([B.U | FW, 5], [0, 14], [B.B, 2]);
    if (x < 0.84) return plan([B.A | B.B | BK, 2], [BK, 6]);
    if (x < 0.90 && d > 110) return plan([B.C, 2]);
    return hold(BK | (r() < 0.5 ? B.D : 0), 14);
  }

  root.FIGHT_AI = { make, think };
})(typeof window !== 'undefined' ? window : globalThis);
