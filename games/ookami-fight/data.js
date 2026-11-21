// data.js — 二人の性能と技の表、絵の帯の発注表。
// 箱は [前方へのずれ, 足元からの高さ, 幅, 高さ]。数は 960×540 の画面での画素。
(function (root) {
  'use strict';
  const F = root.FIGHT, sp = (g, o) => F.spawn(g, o);
  const fx = (g, o) => F.ev(g, Object.assign({ k: 'fx' }, o));

  // ================================================================ 少女
  const girl = {
    key: 'girl', name: '少女', sub: '白猫の使い魔',
    hp: 10000, h: 196, ch: 128, w: 24, pw: 26, drawH: 200,
    walkF: 4.4, walkB: 3.5, walkPer: 5, dashType: 'run', dashV: 9.5, dashPer: 4, backV: 9, backT: 18,
    preJump: 3, jumpV: 15.8, jumpVx: 4.6, grav: 0.86, airDashV: 11.5, airDashT: 13,
    anim: { idle: 4, walk: 6, dash: 4, win: 2 },
    color: [255, 244, 214], color2: [150, 200, 255],
    moves: {
      '5A': { type: 'normal', anim: '5A', su: 4, ac: 3, rc: 6, rapid: 1, snd: 'whiffL', hit: { box: [10, 96, 84, 44], dmg: 300, lvl: 0, fx: 'paw' } },
      '5B': { type: 'normal', anim: '5B', su: 7, ac: 4, rc: 11, jc: 1, snd: 'whiffM', vel: [[2, 8, 3.2]], hit: { box: [14, 70, 118, 78], dmg: 680, lvl: 1, fx: 'claw' } },
      '5C': { type: 'normal', anim: '5C', su: 11, ac: 5, rc: 17, jc: 1, snd: 'whiffH', vel: [[4, 11, 3.5]], hit: { box: [18, 56, 132, 96], dmg: 1040, lvl: 2, fx: 'burst', kb: 12 } },
      '2A': { type: 'normal', anim: '2A', su: 5, ac: 3, rc: 7, rapid: 1, low2: 1, snd: 'whiffL', hit: { box: [10, 4, 82, 42], dmg: 250, lvl: 0, guard: 'low', fx: 'paw' } },
      '2B': { type: 'normal', anim: '2B', su: 8, ac: 6, rc: 13, low2: 1, snd: 'whiffM', vel: [[3, 12, 5]], hit: { box: [14, 0, 120, 44], dmg: 620, lvl: 1, guard: 'low', fx: 'claw' } },
      '2C': { type: 'normal', anim: '2C', su: 9, ac: 5, rc: 20, jc: 1, snd: 'whiffH', hit: { box: [4, 50, 92, 190], dmg: 800, lvl: 2, launch: [2.4, 15.6], fx: 'clawUp' } },
      'jA': { type: 'normal', anim: 'jA', air: 1, su: 5, ac: 6, rc: 6, rapid: 1, snd: 'whiffL', hit: { box: [6, 40, 76, 60], dmg: 260, lvl: 0, guard: 'high', fx: 'paw' } },
      'jB': { type: 'normal', anim: 'jB', air: 1, su: 7, ac: 6, rc: 8, jc: 1, snd: 'whiffM', hit: { box: [10, 24, 104, 78], dmg: 520, lvl: 1, guard: 'high', fx: 'claw' } },
      'jC': { type: 'normal', anim: 'jC', air: 1, su: 9, ac: 8, rc: 10, jc: 1, snd: 'whiffH', hit: { box: [0, -30, 108, 110], dmg: 860, lvl: 2, guard: 'high', fx: 'clawDown', aup: 3 } },

      // 白い爪：猫の姿で駆け抜ける
      sp236: {
        type: 'special', anim: 'sp236', title: '白い爪', snd: 'catDash', pass: 1,
        seq: [[9, 0], [16, 0, 'cat'], [6, 1], [10, 2]], total: 41, landT: 25,
        vel: [[9, 24, 15, null, 'A'], [9, 24, 19, null, 'B'], [9, 24, 22, null, 'C']], after: [9, 26],
        hits: [
          { f: [9, 24], s: 'AB', box: [-10, 10, 96, 70], dmg: 880, lvl: 2, fx: 'claw', chip: 1, launch: [5, 9], untech: 30 },
          { f: [9, 24], s: 'C', rehit: 4, stop: -6, box: [-30, 6, 120, 84], dmg: 330, lvl: 1, fx: 'claw', chip: 1, launch: [1.2, 8.5], untech: 40, pr: 0.96, min: 0.4 },
        ],
        at: { 8: (f, g) => fx(g, { fx: 'catStreak', i: f.idx, x: f.x, y: f.y + 40, dir: f.face, ex: f.str === 'C' }) },
      },
      // 月弧：跳ね上がる爪
      sp623: {
        type: 'special', anim: 'sp623', title: '月弧', snd: 'whiffH', inv: [0, 9], invS: 'BC',
        seq: [[5, 0], [6, 1], [10, 2], [40, 3], [14, 4]], total: 75, landT: 61,
        vel: [[5, 6, 3.5, 15.5, 'A'], [5, 6, 4, 18, 'B'], [5, 6, 4.5, 19.5, 'C']],
        hits: [
          { f: [5, 16], s: 'AB', box: [0, 30, 96, 190], dmg: 1000, lvl: 2, fx: 'moon', launch: [3, 15], chip: 1 },
          { f: [5, 20], s: 'C', rehit: 5, stop: -6, box: [0, 20, 110, 210], dmg: 520, lvl: 2, fx: 'moon', launch: [2.2, 13.5], chip: 1, pr: 0.95, min: 0.4, untech: 44 },
        ],
        at: { 5: (f, g) => fx(g, { fx: 'moonArc', i: f.idx, x: f.x, y: f.y, dir: f.face, ex: f.str === 'C' }) },
      },
      // 夢の輪：離れた床に陣を置く。少し待って光が立つ
      sp214: {
        type: 'special', anim: 'sp214', title: '夢の輪', snd: 'circle',
        seq: [[10, 0], [10, 1], [18, 2]], total: 38,
        at: {
          12: (f, g, o) => {
            const ex = f.str === 'C';
            const x = ex ? o.x : f.x + f.face * (f.str === 'A' ? 190 : 360);
            sp(g, { kind: 'dreamRing', owner: f.idx, x: F.clamp(x, 40, F.STAGE - 40), y: 0, w: ex ? 150 : 104, h: 330, delay: ex ? 34 : 44, active: ex ? 18 : 10, life: ex ? 70 : 72, hits: ex ? 3 : 1, gap: 7, ex,
              hit: { dmg: ex ? 560 : 900, lvl: 2, launch: [0.6, ex ? 12.5 : 15], chip: 1, fx: 'light', untech: 46, pr: ex ? 0.96 : 0.9, min: 0.4 } });
          },
        },
      },
      // 空中：斜めに降る猫
      j236: {
        type: 'special', anim: 'sp236', title: '白い爪', air: 1, snd: 'catDash', pass: 1,
        seq: [[7, 0], [60, 0, 'cat'], [14, 2]], total: 81, landT: 67, noGrav: [0, 7],
        vel: [[0, 6, 0, 1.5], [7, 66, 12.5, -13]], after: [7, 66],
        hits: [{ f: [7, 66], box: [-10, -10, 96, 80], dmg: 820, lvl: 2, fx: 'claw', chip: 1, launch: [4, 10], guard: 'high' },
               { f: [7, 66], s: 'C', rehit: 5, stop: -6, box: [-20, -20, 116, 100], dmg: 300, lvl: 1, fx: 'claw', launch: [1, 9], pr: 0.96, min: 0.4 }],
        at: { 7: (f, g) => fx(g, { fx: 'catStreak', i: f.idx, x: f.x, y: f.y + 40, dir: f.face, down: 1, ex: f.str === 'C' }) },
      },
      // 奥義：広間ごと吹き飛ばす
      super: {
        type: 'super', anim: 'super', title: '名もなき夢', sub: '広間ごと、吹き飛ばす', snd: 'superFlash', inv: [0, 40],
        seq: [[8, 0], [10, 1], [44, 2], [26, 3]], total: 88,
        hits: [{ f: [20, 58], rehit: 4, stop: -6, box: [-60, 0, 640, 430], dmg: 420, lvl: 2, fx: 'light', launch: [3.2, 7.5], pr: 0.97, min: 0.62, chip: 1, untech: 60, kd: 1 }],
        at: {
          6: (f, g) => fx(g, { fx: 'bigCircle', i: f.idx, x: f.x - f.face * 20, y: f.y + 120, dir: f.face, life: 90 }),
          20: (f, g) => fx(g, { fx: 'dreamBlast', i: f.idx, x: f.x, y: f.y + 110, dir: f.face, life: 44 }),
        },
      },
    },
  };

  // ================================================================ 彼
  function maw(f, g, ex, air) {
    sp(g, { kind: 'maw', owner: f.idx, x: f.x + f.face * 60, y: air ? f.y + 20 : 0, vx: f.face * (ex ? 9 : f.str === 'A' ? 6 : 10), vy: air ? -9 : 0, dir: f.face,
      w: ex ? 110 : 76, h: ex ? 120 : 78, delay: 0, life: air ? 60 : 96, hits: ex ? 3 : 1, gap: 6, dieOnHit: 1, ex,
      step: e => { if (e.y < 0) { e.y = 0; e.vy = 0; } },
      hit: { dmg: ex ? 440 : 540, lvl: 1, chip: 1, fx: 'bite', kb: 7, pr: ex ? 0.95 : 0.9, min: 0.4, kd: ex ? 1 : 0 } });
  }
  const man = {
    key: 'man', name: '彼', sub: '長身の男',
    hp: 9600, h: 268, ch: 172, w: 27, pw: 30, drawH: 276,
    walkF: 3.1, walkB: 2.5, walkPer: 7, dashType: 'step', dashV: 11, dashT: 15, dashPer: 8, backV: 9.5, backT: 20,
    preJump: 4, jumpV: 16.6, jumpVx: 4.1, grav: 0.84, airDashV: 10, airDashT: 14,
    anim: { idle: 4, walk: 6, dash: 2, win: 2 },
    color: [150, 110, 255], color2: [255, 60, 90],
    moves: {
      '5A': { type: 'normal', anim: '5A', su: 6, ac: 3, rc: 8, rapid: 1, snd: 'whiffL', hit: { box: [14, 118, 100, 62], dmg: 300, lvl: 0, fx: 'paw' } },
      '5B': { type: 'normal', anim: '5B', su: 10, ac: 4, rc: 17, jc: 1, snd: 'whiffM', hit: { box: [20, 104, 140, 80], dmg: 580, lvl: 1, fx: 'kick' } },
      '5C': { type: 'normal', anim: '5C', su: 15, ac: 5, rc: 25, jc: 1, snd: 'whiffH', vel: [[6, 13, 2.6]], hit: { box: [14, 36, 180, 150], dmg: 880, lvl: 2, fx: 'shadowSlash', kb: 13 } },
      '2A': { type: 'normal', anim: '2A', su: 7, ac: 3, rc: 10, rapid: 1, low2: 1, snd: 'whiffL', hit: { box: [14, 0, 108, 44], dmg: 280, lvl: 0, guard: 'low', fx: 'kick' } },
      '2B': { type: 'normal', anim: '2B', su: 11, ac: 4, rc: 18, low2: 1, snd: 'whiffM', hit: { box: [50, 0, 140, 70], dmg: 540, lvl: 1, guard: 'low', fx: 'spike' },
        at: { 8: (f, g) => fx(g, { fx: 'spike', i: f.idx, x: f.x + f.face * 125, y: 0, dir: f.face }) } },
      '2C': { type: 'normal', anim: '2C', su: 11, ac: 5, rc: 22, jc: 1, snd: 'whiffH', hit: { box: [4, 80, 116, 250], dmg: 860, lvl: 2, launch: [2, 16.4], fx: 'shadowUp' } },
      'jA': { type: 'normal', anim: 'jA', air: 1, su: 6, ac: 6, rc: 6, rapid: 1, snd: 'whiffL', hit: { box: [6, 60, 92, 64], dmg: 280, lvl: 0, guard: 'high', fx: 'kick' } },
      'jB': { type: 'normal', anim: 'jB', air: 1, su: 8, ac: 6, rc: 9, jc: 1, snd: 'whiffM', hit: { box: [10, 40, 136, 76], dmg: 560, lvl: 1, guard: 'high', fx: 'kick' } },
      'jC': { type: 'normal', anim: 'jC', air: 1, su: 10, ac: 8, rc: 11, jc: 1, snd: 'whiffH', hit: { box: [-6, -36, 124, 126], dmg: 780, lvl: 2, guard: 'high', fx: 'shadowSlash', aup: 3 } },

      // 影の口：床を這う
      sp236: {
        type: 'special', anim: 'sp236', title: '影の口', snd: 'maw',
        seq: [[8, 0], [8, 1], [26, 2]], total: 42,
        at: { 15: (f, g) => maw(f, g, f.str === 'C', false) },
      },
      // 影柱：足元の陣から立つ
      sp623: {
        type: 'special', anim: 'sp623', title: '影柱', snd: 'circle', inv: [0, 10], invS: 'BC',
        seq: [[7, 0], [12, 1], [28, 2]], total: 47,
        hits: [
          { f: [7, 16], s: 'AB', box: [0, 0, 124, 350], dmg: 960, lvl: 2, fx: 'shadowUp', launch: [1.6, 17], chip: 1 },
          { f: [7, 20], s: 'C', rehit: 5, stop: -6, box: [-10, 0, 150, 380], dmg: 560, lvl: 2, fx: 'shadowUp', launch: [0.8, 14], chip: 1, pr: 0.95, min: 0.4, untech: 46 },
        ],
        at: { 3: (f, g) => fx(g, { fx: 'pillar', i: f.idx, x: f.x + f.face * 62, y: 0, dir: f.face, ex: f.str === 'C' }) },
      },
      // 影渡り：影に沈み、別の場所に立つ
      sp214: {
        type: 'special', anim: 'sp214', title: '影渡り', snd: 'teleport', inv: [6, 26], pass: 1,
        seq: [[6, 0], [18, 1], [6, 0], [8, 2]], total: 38,
        hits: [{ f: [26, 31], s: 'C', box: [-90, 0, 180, 200], dmg: 700, lvl: 2, fx: 'shadowUp', launch: [1, 14], untech: 44 }],
        at: {
          6: (f, g) => fx(g, { fx: 'sink', i: f.idx, x: f.x, y: 0 }),
          22: (f, g, o) => {
            const side = o.x >= f.x ? 1 : -1;
            f.x = F.clamp(f.str === 'A' ? f.x + f.face * 300 : o.x + side * 96, 40, F.STAGE - 40);
            f.face = o.x >= f.x ? 1 : -1; f.vx = 0;
            fx(g, { fx: 'rise', i: f.idx, x: f.x, y: 0, ex: f.str === 'C' });
          },
        },
      },
      j236: {
        type: 'special', anim: 'sp236', title: '影の口', air: 1, snd: 'maw', noGrav: [0, 20],
        seq: [[8, 0], [8, 1], [70, 2]], total: 86, landT: 76, vel: [[0, 18, 0, 0.4]],
        at: { 13: (f, g) => maw(f, g, f.str === 'C', true) },
      },
      // 奥義：相手の足元に陣を敷き、影の口が閉じる
      super: {
        type: 'super', anim: 'super', title: '千年の眠り', sub: '見てはいけないものを見たな', snd: 'superFlash', inv: [0, 30],
        seq: [[10, 0], [12, 1], [50, 2], [22, 3]], total: 94,
        at: {
          8: (f, g, o) => {
            sp(g, { kind: 'kingdom', owner: f.idx, x: o.x, y: 0, w: 250, h: 440, delay: 26, active: 44, life: 96, hits: 11, gap: 4,
              hit: { dmg: 400, lvl: 2, fx: 'bite', launch: [0, 5.2], pr: 0.97, min: 0.62, chip: 1, untech: 60, kd: 1 } });
          },
        },
      },
    },
  };

  root.FIGHT_CHARS = { girl: F.prep(girl), man: F.prep(man) };

  // ================================================================ 絵の帯の発注表
  // どの帯も、画像の 1 ポーズ目は「構え」（縮尺の基準。切り出しのあと捨てる）。idle だけは 4 枚とも使う。
  const N3 = ['予備動作', '当たる瞬間（最大に伸びた形）', '振り抜いたあと'];
  root.FIGHT_SHEETS = {
    girl: {
      ref: ['ref/girlneutral.png', 'ref/girlpoweraligned.png', 'art/pilot/girl_attack.png'], bg: '#FF00FF',
      who: '少女。銀のボブ、灰青の目、象牙色の立ち襟・長袖・膝丈のワンピース、裸足、左耳の先の小さな欠け。猫のように軽く、指を軽く曲げた構え（art/pilot/girl_attack.png の 1 ポーズ目と同じ構え）',
      sheets: {
        idle: { anchor: false, poses: ['構え（基準）', '構え・息を吸う（わずかに体が上がる）', '構え・一番上', '構え・息を吐く'] },
        walk: { poses: ['前へ歩く 1（右足が前へ出はじめる）', '歩く 2（右足が着く）', '歩く 3（体が右足に乗る）', '歩く 4（左足が前へ出はじめる）', '歩く 5（左足が着く）', '歩く 6（体が左足に乗る）'], note: '構えたまま、すり足で前へ。上体はあまり揺れない' },
        crouch: { poses: ['しゃがみかけ（膝が曲がりはじめ）', 'しゃがみ（低く、猫のように手を前について構える）'] },
        jump: { poses: ['跳び上がり（膝を引きつけて上昇）', '頂点（体を丸める。裾と髪が浮く）', '落下（足を下へ伸ばす。髪と裾が上へ流れる）', '空中で前へ突進（体を前へ倒し、両手を後ろへ流す）'], note: '床は描かない。全員が宙にいる。ただし 1 ポーズ目の構えは地面に立つ' },
        dash: { split: { dash: 4, backdash: 2 }, poses: ['走る 1（前傾、右足で蹴る）', '走る 2（両足が宙に浮く）', '走る 3（左足で蹴る）', '走る 4（両足が宙に浮く）', '後ろへ跳び退く 1（床を蹴って後ろへ。体は前を向いたまま）', '後ろへ跳び退く 2（着地の寸前、膝を曲げる）'], note: '低い前傾。腕は後ろへ流す' },
        guard: { poses: ['立ち防御（両腕を顔の前で交差）', 'しゃがみ防御（低くしゃがみ、両腕で前を守る）', '空中防御（宙で膝を引きつけ、両腕で前を守る）'] },
        hit: { poses: ['やられ・上（顔に受けて頭がのけぞる）', 'やられ・下（腹に受けて体が「く」の字）', 'しゃがみやられ（しゃがんだまま後ろへのけぞる）', '吹き飛び（宙で背中から後ろへ飛ぶ。手足が前に残る）', '落下（頭を下にして落ちる）'] },
        down: { split: { down: 2, win: 2 }, poses: ['倒れ（床に仰向けに横たわる。頭が左、足が右）', '起き上がり（片膝をつき、片手を床について体を起こす）', '勝ち 1（構えを解いて、横目でこちらを見る）', '勝ち 2（興味を失ったように目を閉じ、そっぽを向く）'] },
        '5A': { poses: ['右手を軽く引く', '右手の掌で前を軽く叩く（猫の前足のように。腕は肩の高さ）', '手を引き戻す'] },
        '5B': { poses: ['右手を肩の後ろへ引く', '右手で前を大きく引っかく（腕が最大に伸びた瞬間、踏み込む）', '振り抜いて体がねじれる'] },
        '5C': { poses: ['両手を腰に引いて深く踏み込む', '両の掌を前へ突き出す（体重を乗せて最大に伸びる）', '突き出したまま反動で髪と裾が前へ流れる'] },
        '2A': { poses: ['しゃがんで右手を引く', 'しゃがんだまま右手で足元を軽く払う', '手を戻す'], note: '3 ポーズとも低くしゃがんだまま' },
        '2B': { poses: ['しゃがんで片脚を引く', '床すれすれに片脚を前へ伸ばして滑り込む（足払い。脚が最大に伸びる）', '脚を引き戻す'], note: '3 ポーズとも低い姿勢' },
        '2C': { poses: ['深くしゃがんで右手を下に構える', '伸び上がりながら右手を真上へ振り上げる（爪で下から上へ裂く。つま先立ちで最大に伸びる）', '振り上げきって腕が頭上、体が反る'] },
        jA: { poses: ['宙で右手を引く', '宙で右手を前へ伸ばして叩く', '手を戻す'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        jB: { poses: ['宙で片脚を引く', '宙で片脚を前へまっすぐ蹴り出す（裾が翻る）', '脚を戻す'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        jC: { poses: ['宙で両手を頭上に振りかぶる', '両手の爪を斜め下へ振り下ろす（体を丸めて最大に伸びる）', '振り下ろしたあと'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        sp236: { poses: ['四つ足で獣のように低く身を沈め、前へ跳びかかる寸前', '駆け抜けたあと、片手を床について滑って止まる（体は右向き、低い姿勢）', '立ち上がりながら振り返る'] },
        cat: { anchor: false, poses: ['白猫・全力疾走 1（体が伸びきる）', '白猫・疾走 2（四肢が体の下に集まる）', '白猫・疾走 3（前足が着く）', '白猫・疾走 4（後ろ足で蹴る）'], ref: ['ref/catrun.png', 'ref/catneutral.png'], note: '少女ではなく、ほっそりした白猫（左耳の先に小さな欠け）。右向き、真横から。4 匹を同じ縮尺で横一列に。この帯だけ構えのポーズは不要' },
        sp623: { poses: ['深く沈んで右手を床近くに構える', '床を蹴って右手を振り上げながら跳び上がる（体が斜め上へ伸びる）', '宙で腕を振り上げきった頂点（体が反り、裾が大きく翻る）', '宙で体を丸めて落ちる', '着地（片膝をつく）'], note: '2〜4 ポーズ目は宙にいる' },
        sp214: { poses: ['目を伏せ、片手を胸の前に上げる', '片手を前の床へ向けて差し出す（指先を下に向け、静かに指し示す）', '手を下ろしかける'] },
        super: { poses: ['目を閉じ、両手を胸の前で重ねる', '目を開き、両腕を左右に広げはじめる（髪と裾が風で持ち上がる）', '両腕を大きく広げ、顔を上げて力を放つ（髪と裾が激しく後ろへ流れる）', '力を使い切って腕が下がり、うつむく'] },
      },
    },
    man: {
      ref: ['ref/mantalk.png', 'ref/manangry.png', 'art/pilot/man_attack.png'], bg: '#00FF00',
      who: '彼。長身で細身の男。後ろへ流した黒髪、青白い肌、黒い立ち襟のロングコート、黒いズボンと靴。片手をコートのポケットに入れたまま半身で立つ構え（art/pilot/man_attack.png の 1 ポーズ目と同じ構え）。礼儀正しく、急がない',
      sheets: {
        idle: { anchor: false, poses: ['構え（基準）', '構え・コートの裾がわずかに揺れる', '構え・肩がわずかに上がる', '構え・裾が戻る'] },
        walk: { poses: ['前へ歩く 1（右足が前へ出はじめる）', '歩く 2（右足が着く）', '歩く 3（体が右足に乗る）', '歩く 4（左足が前へ出はじめる）', '歩く 5（左足が着く）', '歩く 6（体が左足に乗る）'], note: '片手はポケットのまま、ゆっくりと大股で。背筋は伸びている' },
        crouch: { poses: ['しゃがみかけ（膝が曲がりはじめ）', 'しゃがみ（片膝を立てて低く身をかがめる。コートが床に広がる）'] },
        jump: { poses: ['跳び上がり（片膝を引き上げて上昇。コートが下へなびく）', '頂点（コートが広がる）', '落下（足を下へ伸ばす。コートが上へ翻る）', '空中で前へ滑る（体を前へ倒し、コートが後ろへ一直線に流れる）'], note: '床は描かない。全員が宙にいる。ただし 1 ポーズ目の構えは地面に立つ' },
        dash: { split: { dash: 2, backdash: 2 }, poses: ['前へ滑るように踏み込む 1（体を前へ倒し、コートが後ろへ流れる）', '踏み込み 2（さらに低く、片足が前へ伸びる）', '後ろへ退く 1（床を蹴って後ろへ。体は前を向いたまま、コートが前へ残る）', '後ろへ退く 2（着地の寸前）'] },
        guard: { poses: ['立ち防御（片腕を顔の前に立てて受ける。もう片手はポケット）', 'しゃがみ防御（片膝をつき、片腕で前を守る）', '空中防御（宙で片腕を前に立てる。コートが広がる）'] },
        hit: { poses: ['やられ・上（顔に受けて頭がのけぞる。ポケットから手が出る）', 'やられ・下（腹に受けて体が「く」の字）', 'しゃがみやられ（片膝をついたまま後ろへのけぞる）', '吹き飛び（宙で背中から後ろへ飛ぶ。コートと手足が前に残る）', '落下（頭を下にして落ちる）'] },
        down: { split: { down: 2, win: 2 }, poses: ['倒れ（床に仰向けに横たわる。頭が左、足が右。コートが広がる）', '起き上がり（片膝をつき、片手を床について体を起こす）', '勝ち 1（襟を片手で直す）', '勝ち 2（背を向けかけ、肩越しに見下ろす）'] },
        '5A': { poses: ['ポケットでないほうの手を胸の前に引く', '手の甲で前を払う（腕は胸の高さ、最大に伸びる）', '手を戻す'] },
        '5B': { poses: ['前の脚の膝を高く引き上げる', '長い脚を前へまっすぐ高く蹴り出す（最大に伸びた瞬間、コートが翻る）', '膝をたたんで脚を引く'], note: 'art/pilot/man_attack.png の 2〜4 ポーズ目と同じ動き' },
        '5C': { poses: ['ポケットから手を抜き、腕を体の後ろへ大きく引く（コートがねじれる）', '腕を前へ水平に大きく薙ぐ（踏み込み、コートの裾が刃のように前へ広がる。最大に伸びる）', '薙ぎきって体が前へ流れる'] },
        '2A': { poses: ['しゃがんで前の足を引く', 'しゃがんだまま前の足で足元を蹴る（つま先が最大に伸びる）', '足を戻す'], note: '3 ポーズとも低くしゃがんだまま' },
        '2B': { poses: ['しゃがんで片手を床の上にかざす', 'しゃがんだまま片手の掌を床に押しつける', '手を床から離す'], note: '3 ポーズとも低い姿勢。影や棘は描かない（エンジンで足す）' },
        '2C': { poses: ['低く沈んで片腕を下に構える', '伸び上がりながら片腕を真上へ振り上げる（最大に伸びる。コートが上へ引かれる）', '振り上げきって腕が頭上'] },
        jA: { poses: ['宙で片手を引く', '宙で手の甲を前へ払う', '手を戻す'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        jB: { poses: ['宙で前の膝を引き上げる', '宙で長い脚を前へまっすぐ蹴り出す', '脚を戻す'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        jC: { poses: ['宙で片脚を高く振り上げる', 'かかとを斜め下へ振り下ろす（脚が最大に伸びる。コートが上へ流れる）', '振り下ろしたあと'], note: '全員が宙にいる（構えの 1 ポーズ目を除く）' },
        sp236: { poses: ['片手を胸の前に上げ、指を鳴らす寸前', '片手を前の床へ向けて振り下ろし、指し示す（影に命じる）', '手を下ろし、冷たく見ている'], note: '影や使い魔は描かない（エンジンで足す）' },
        sp623: { poses: ['片足で床を軽く踏む寸前、片手を下に向ける', '片手を下から上へ鋭く振り上げる（掌を上に。コートが上へ煽られる）', '手を上げたまま、見下ろす'] },
        sp214: { poses: ['コートの襟を立て、体を回しはじめる（コートが体に巻きつく）', '膝をついて低く沈み、コートに全身が包まれる（黒い塊に近い形）', '立ち上がり、コートを片手で払って開く'] },
        super: { poses: ['ポケットから両手を出し、片手を顔の前に上げる（指の間から片目が覗く）', '両腕を左右に広げはじめる（コートが大きく開く）', '片手を前へ突き出し、掌を握りこむ（命じる。コートが激しくはためく）', '腕を下ろし、目を閉じる'] },
      },
    },
  };
  // 演出の絵（影の口）。人物ではないので構えは無く、size（画面での高さ）で縮尺を決める
  root.FIGHT_SHEETS.fx = {
    bg: '#00FF00', sheets: {
      maw: { anchor: false, size: 104, poses: ['閉じる', '半開き', '全開', '噛む'] },
      kingdom: { anchor: false, size: 430, center: true, poses: ['牙の先', '半分', '全開', '閉じかけ', '閉じた'] },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
