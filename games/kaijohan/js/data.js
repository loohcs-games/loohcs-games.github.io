/* 解除班 — 共通データ。描画環境を必要としない。 */
(function (root) {
  'use strict';
  const K = root.KJ = root.KJ || {};
  K.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  K.dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  K.angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  K.rng = seed => { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  K.rules = { buy: 12, round: 105, fuse: 40, plant: 3, defuse: 7, kit: 4, cap: 16000, radius: .32, height: 1.8, speed: 5.3, step: .305, gravity: 18, jump: 6 };
  // damage, interval, magazine, reload, range decay, armor penetration, speed, reward
  const weapon = (name, slot, price, damage, interval, mag, reload, falloff, pen, speed, reward, extra) => Object.assign({ name, slot, price, damage, interval, mag, reload, falloff, pen, speed, reward, spread: .004, kick: .012, range: 90, pellets: 1 }, extra);
  K.weapons = {
    baton: weapon('灯火バトン', 3, 0, 48, .65, 1, 0, 0, 1, 1.08, 900, { range: 2.1, kick: .025 }),
    pebble: weapon('小石', 2, 0, 26, .23, 16, 1.65, .008, .48, 1, 300, { side: 'attack' }),
    ripple: weapon('波紋', 2, 0, 28, .29, 12, 1.7, .006, .55, 1, 300, { side: 'defend' }),
    comet: weapon('彗星', 2, 700, 52, .48, 7, 2.1, .004, .78, .96, 300, { kick: .036 }),
    swift: weapon('疾風', 1, 1250, 22, .078, 30, 2.15, .016, .5, 1.02, 600, { kick: .01 }),
    reed: weapon('葦笛', 1, 1550, 25, .095, 26, 2.05, .012, .6, 1, 600, { kick: .012 }),
    hail: weapon('霰', 1, 1650, 15, .85, 7, 2.7, .027, .52, .93, 900, { pellets: 8, spread: .052, kick: .05 }),
    ember: weapon('熾火', 1, 2700, 42, .105, 24, 2.7, .004, .85, .96, 300, { side: 'attack', kick: .015 }),
    tide: weapon('汐音', 1, 2900, 31, .092, 30, 2.3, .003, .8, .94, 300, { side: 'defend', kick: .014 }),
    beacon: weapon('遠灯', 1, 4300, 105, 1.35, 5, 3.1, .002, .9, .8, 100, { kick: .07, scope: true, spread: .001 })
  };
  // 各銃の役割と固定反動。最初の3発は縦、その後左右に振れる。
  const patterns = {
    pebble: [[0,1],[.1,1.1],[-.1,1.2]], ripple: [[0,.8],[0,1],[-.1,1.1]],
    comet: [[0,1],[.15,1.5],[-.2,1.8]], swift: [[0,.7],[0,.8],[.1,1],[.4,1.2],[.7,1.4],[.4,1.6],[-.4,1.8],[-.7,2]],
    reed: [[0,.6],[0,.8],[0,1],[-.3,1.2],[-.5,1.3],[.3,1.4],[.5,1.6]],
    ember: [[0,.7],[0,1],[.05,1.5],[.4,2],[.9,2.4],[1.3,2.8],[.8,3.1],[-.4,3.4],[-1,3.5]],
    tide: [[0,.6],[0,.85],[0,1.1],[-.3,1.5],[-.6,1.9],[-.9,2.2],[-.3,2.5],[.4,2.7],[.7,2.9]],
    hail: [[0,1]], beacon: [[0,1]], baton: [[0,1]]
  };
  const roles = { baton:'接近時の最後の手段・最速移動',pebble:'近距離で素早く一発ずつ',ripple:'止まって正確に狙う初期銃',comet:'少弾数の精密射撃',swift:'走りながら近距離を制圧',reed:'扱いやすい中近距離',hail:'室内・角の守り',ember:'高威力・反動を抑えて短く撃つ',tide:'安定した中距離バースト',beacon:'遠距離・二段階スコープ' };
  for (const id of Object.keys(K.weapons)) {
    const w=K.weapons[id]; w.pattern=patterns[id]; w.role=roles[id];
    w.category=w.slot===3?'melee':w.slot===2?'pistol':w.scope?'sniper':w.pellets>1?'shotgun':['swift','reed'].includes(id)?'smg':'rifle';
    w.automatic=['swift','reed','ember','tide'].includes(id);
    w.moveSpread=w.slot===2?.018:id==='swift'?.012:id==='reed'?.015:.027;
    w.recovery=w.slot===2?.20:w.scope?.65:.26;
    w.penetration=w.scope?2.2:id==='ember'?1.6:w.slot===1?1.2:.65;
  }
  K.items = {
    vest: { name: 'ベスト', price: 650 }, helmet: { name: 'ベスト＋ヘルメット', price: 1000 },
    kit: { name: '解除キット', price: 400, side: 'defend' },
    burst: { name: '破裂球', price: 300 }, flash: { name: '閃光球', price: 200 }, smoke: { name: '煙球', price: 300 }
  };
  K.levels = {
    easy: { reaction: .62, error: .065, turn: 3.2, burst: 3, pause: .60, tracking: .23, head: .02, memory: 5, aggression: .6 },
    normal: { reaction: .40, error: .042, turn: 4.2, burst: 4, pause: .42, tracking: .16, head: .08, memory: 7, aggression: .8 },
    hard: { reaction: .34, error: .035, turn: 4.6, burst: 4, pause: .38, tracking: .14, head: .09, memory: 9, aggression: 1 }
  };
  K.sideName = s => s === 'attack' ? '設置班' : '解除班';
  if (typeof module !== 'undefined') module.exports = K;
})(typeof globalThis !== 'undefined' ? globalThis : window);
