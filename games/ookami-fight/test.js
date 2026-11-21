// test.js — 自己テスト。index.html?test で画面に、node tools/selftest.js で端末に出す。
(function (root) {
  'use strict';
  function run() {
    const F = root.FIGHT, AI = root.FIGHT_AI, CH = root.FIGHT_CHARS, B = F.BIT, out = [];
    const ok = (name, cond, note) => out.push({ name, ok: !!cond, note: note || '' });
    const play = (g, seq) => { for (const [b0, b1, n] of seq) for (let i = 0; i < n; i++) F.step(g, b0, b1); };
    const fresh = (p1, p2) => { const g = F.newGame({ p1: p1 || 'girl', p2: p2 || 'man', seed: 5 }); play(g, [[0, 0, 100]]); return g; };
    // 技の表
    for (const k in CH) for (const n in CH[k].moves) {
      const m = CH[k].moves[n];
      ok(k + ' ' + n + ' の長さ', m.total > 0 && m.total === m.seq.reduce((s, q) => s + q[0], 0), m.total);
      for (const h of m.hits) ok(k + ' ' + n + ' の当たりが技の中', h.f[0] >= 0 && h.f[1] < m.total && h.dmg > 0);
    }
    // 基本の動き
    let g = fresh(); ok('始まりは闘いの相', g.phase === 'fight');
    play(g, [[B.R, 0, 20]]); ok('歩いて前へ', g.f[0].x > F.STAGE / 2 - 190 + 40);
    play(g, [[B.U, 0, 6]]); ok('跳ぶ', g.f[0].y > 0); play(g, [[0, 0, 60]]); ok('着地する', g.f[0].y === 0 && g.f[0].st === 'idle');
    // 通常技が当たり、つながる
    g = fresh(); g.f[0].x = g.f[1].x - 90; const hp = g.f[1].hp;
    play(g, [[B.A, 0, 2], [0, 0, 8]]); ok('弱が当たる', g.f[1].hp < hp);
    play(g, [[B.B, 0, 2], [0, 0, 14], [B.C, 0, 2], [0, 0, 20]]); ok('弱→中→強がつながる', g.comboView[0] && g.comboView[0].n >= 3, g.comboView[0] && g.comboView[0].n);
    // 守り
    g = fresh(); g.f[0].x = g.f[1].x - 90; const hp2 = g.f[1].hp;
    play(g, [[B.B, B.R, 2], [0, B.R, 16]]); ok('後ろで守れる', g.f[1].hp === hp2);
    g = fresh(); g.f[0].x = g.f[1].x - 90;
    play(g, [[B.D | B.B, B.R, 2], [B.D, B.R, 16]]); ok('下段は立って守れない', g.f[1].hp < hp2);
    g = fresh(); g.f[0].x = g.f[1].x - 90;
    play(g, [[B.D | B.B, B.R | B.D, 2], [B.D, B.R | B.D, 16]]); ok('下段はしゃがんで守れる', g.f[1].hp === hp2);
    // 盾
    g = fresh(); g.f[0].x = g.f[1].x - 90; let sh = false;
    for (let i = 0; i < 26; i++) { F.step(g, i < 2 ? B.B : 0, B.S); if (g.events.some(e => e.k === 'shieldHit')) sh = true; }
    ok('盾で受けとめる', sh && g.f[1].hp === hp2);
    // 入力の並び
    for (const k of ['girl', 'man']) {
      g = fresh(k, k === 'girl' ? 'man' : 'girl');
      play(g, [[B.D, 0, 3], [B.D | B.R, 0, 3], [B.R, 0, 2], [B.R | B.A, 0, 2]]); ok(k + ' ↓↘→＋弱', g.f[0].mv && g.f[0].mv.name === 'sp236', g.f[0].mv && g.f[0].mv.name);
      g = fresh(k, 'man'); play(g, [[B.R, 0, 3], [B.D, 0, 3], [B.D | B.R, 0, 2], [B.D | B.R | B.B, 0, 2]]); ok(k + ' →↓↘＋中', g.f[0].mv && g.f[0].mv.name === 'sp623', g.f[0].mv && g.f[0].mv.name);
      g = fresh(k, 'man'); play(g, [[B.D, 0, 3], [B.D | B.L, 0, 3], [B.L, 0, 2], [B.L | B.A, 0, 2]]); ok(k + ' ↓↙←＋弱', g.f[0].mv && g.f[0].mv.name === 'sp214', g.f[0].mv && g.f[0].mv.name);
      g = fresh(k, 'man'); play(g, [[B.X, 0, 2]]); ok(k + ' 技ボタン', g.f[0].mv && g.f[0].mv.name === 'sp236');
      g = fresh(k, 'man'); g.f[0].gauge = 300; play(g, [[B.D, 0, 2], [B.D | B.X, 0, 2]]); ok(k + ' 奥義', g.f[0].mv && g.f[0].mv.name === 'super' && g.f[0].gauge === 100 && g.freeze > 0);
      g = fresh(k, 'man'); g.f[0].gauge = 100; play(g, [[B.X, 0, 2]]); ok(k + ' 奥義はゲージ二本から', g.f[0].mv && g.f[0].mv.name === 'sp236');
      g = fresh(k, 'man'); play(g, [[B.R, 0, 2], [0, 0, 2], [B.R, 0, 3]]); ok(k + ' 二度押しで走る', g.f[0].st === 'dash', g.f[0].st);
      g = fresh(k, 'man'); play(g, [[B.A | B.B, 0, 3]]); ok(k + ' 弱＋中で走る', g.f[0].st === 'dash', g.f[0].st);
      // 奥義が当たる
      g = fresh(k, 'man'); g.f[0].gauge = 300; g.f[0].x = g.f[1].x - 200; const h0 = g.f[1].hp;
      play(g, [[B.D, 0, 2], [B.D | B.X, 0, 2], [0, 0, 260]]); ok(k + ' 奥義が当たって大きく削る', h0 - g.f[1].hp > 2400, h0 - g.f[1].hp);
      ok(k + ' 奥義のあと立ち直る', g.f[0].st === 'idle' && (g.f[1].st === 'idle' || g.f[1].st === 'down' || g.f[1].st === 'getup'), g.f[0].st + '/' + g.f[1].st);
    }
    // CPU 同士の試合が終わり、同じ種なら同じ結果
    const match = (p1, p2, seed, l1, l2) => {
      const g = F.newGame({ p1, p2, seed }); g.f[0].ai = AI.make(l1); g.f[1].ai = AI.make(l2); let bad = '', maxC = 0;
      while (g.phase !== 'over' && g.frame < 60 * 60 * 8) {
        F.step(g, AI.think(g, 0), AI.think(g, 1));
        for (const f of g.f) { if (!(f.x >= 0 && f.x <= F.STAGE && f.y >= 0) || isNaN(f.hp)) bad = 'x=' + f.x + ' y=' + f.y; const p = F.pose(f); if (!p || typeof p[0] !== 'string') bad = 'pose'; }
        for (const e of g.events) if (e.k === 'hit' && e.n > maxC) maxC = e.n;
      }
      return { over: g.phase === 'over', frame: g.frame, w: g.winner, hp: g.f.map(f => f.hp).join(','), bad, maxC };
    };
    let maxC = 0;
    for (const [a, b] of [['girl', 'man'], ['man', 'girl'], ['girl', 'girl'], ['man', 'man']]) for (let s = 1; s <= 3; s++) {
      const r = match(a, b, s * 11, s % 3, (s + 1) % 3); maxC = Math.max(maxC, r.maxC);
      ok(a + ' 対 ' + b + ' 種' + s * 11 + ' が終わる', r.over && !r.bad, r.frame + 'コマ ' + r.bad);
    }
    ok('連続は 30 を超えない', maxC <= 30, maxC);
    const r1 = match('girl', 'man', 77, 2, 2), r2 = match('girl', 'man', 77, 2, 2);
    ok('同じ種なら同じ結果', r1.frame === r2.frame && r1.hp === r2.hp);
    // 絵の欠け
    const AT = root.FIGHT_ATLAS;
    if (AT) for (const k in CH) {
      const need = { idle: 4, walk: 6, crouch: 2, jump: 4, dash: CH[k].anim.dash, backdash: 2, guard: 3, hit: 5, down: 2, win: 2 };
      for (const n in CH[k].moves) for (const q of CH[k].moves[n].seq) { const a = q[2] || CH[k].moves[n].anim; need[a] = Math.max(need[a] || 0, q[1] + 1); }
      const miss = []; for (const a in need) { const fr = AT[k] && AT[k].frames[a]; if (!fr || fr.length < need[a]) miss.push(a + '(' + (fr ? fr.length : 0) + '/' + need[a] + ')'); }
      ok(k + ' の絵が揃っている', !miss.length, miss.join(' '));
    }
    return out;
  }
  function show() {
    const r = run(), el = document.getElementById('test'), pass = r.filter(x => x.ok).length;
    el.style.display = 'block'; document.getElementById('c').style.display = 'none';
    el.textContent = '自己テスト ' + pass + '/' + r.length + '\n\n' + r.map(x => (x.ok ? '✓ ' : '✗ ') + x.name + (x.note !== '' ? '  [' + x.note + ']' : '')).join('\n');
    document.title = 'test ' + pass + '/' + r.length;
  }
  root.FIGHT_TEST = { run, show };
})(typeof window !== 'undefined' ? window : globalThis);
