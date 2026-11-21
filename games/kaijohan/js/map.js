/* 灯環ふ頭 — 地形、カプセル移動、視線、経路。描画に依存しない。 */
(function (root) {
  'use strict';
  const K = root.KJ || require('./data.js');
  const boxes = [], ramps = [];
  const areas = [
    { id: 'south', name: '南出発広場', x: 0, z: 27, w: 48, d: 10, color: 0xb9a77c },
    { id: 'west', name: '西荷さばき', x: -17, z: 13, w: 14, d: 18, color: 0xb99870 },
    { id: 'west-bend', name: '西の曲がり角', x: -17, z: 1, w: 14, d: 6, color: 0xb99870 },
    { id: 'a-entry', name: 'A 搬入口', x: -17, z: -5, w: 14, d: 6, color: 0xd6a367 },
    { id: 'a', name: 'A 荷役室', x: -17, z: -16, w: 14, d: 16, color: 0xd6a367, indoor: true },
    { id: 'mid-south', name: '中央検査口', x: 0, z: 15, w: 20, d: 14, color: 0x8ea6b2 },
    { id: 'mid', name: '中央通り', x: 0, z: 0, w: 20, d: 16, color: 0x8ea6b2 },
    { id: 'mid-north', name: '中央管理室', x: 0, z: -16, w: 20, d: 16, color: 0x8ea6b2, indoor: true },
    { id: 'east', name: '東配管路', x: 17, z: 13, w: 14, d: 18, color: 0x6faeac },
    { id: 'east-bend', name: '東資材置き場', x: 17, z: 1, w: 14, d: 6, color: 0x6faeac },
    { id: 'b-entry', name: 'B 南ゲート', x: 17, z: -5, w: 14, d: 6, color: 0x7dc5bd },
    { id: 'b', name: 'B 揚重庭', x: 17, z: -16, w: 14, d: 16, color: 0x7dc5bd },
    { id: 'north', name: '北連絡路', x: 0, z: -28, w: 48, d: 8, color: 0x839aac }
  ];
  function areaAt(p) { return areas.find(a => Math.abs(p.x - a.x) <= a.w / 2 && Math.abs(p.z - a.z) <= a.d / 2) || areas[p.z < 0 ? 12 : 0]; }
  function box(x, z, w, d, h, kind, y, extra) {
    const a = areaAt({ x, z });
    const b = Object.assign({ id: boxes.length, x, z, w, d, h, y: y || 0, kind: kind || 'wall', thin: kind === 'wood' || kind === 'panel', area: a.id, color: a.color, solid: true }, extra);
    boxes.push(b); return b;
  }
  // 外周。既存レーダーと互換の48×64m。
  box(-24.5, 0, 1, 65, 6); box(24.5, 0, 1, 65, 6); box(0, -32.5, 50, 1, 6); box(0, 32.5, 50, 1, 6);
  // レーン境界。南広場、中央横道、北連絡路で相互に行き来できる。
  for (const x of [-9, 9]) {
    box(x, 15, 1.2, 14, 4.5); box(x, -1, 1.2, 10, 4.5);
    box(x, -18, 1.2, 12, 4.5);
  }
  // 西は二つの曲がり角と荷役室。南・中央・北の三つの入口。
  box(-20, 10, 8, 2, 3.2, 'container');
  box(-12.5, 1, 5.8, 2, 3.5, 'wall');
  box(-19, -4, 10, 1.2, 3.2, 'container');
  box(-21, -8, 6, 1.2, 4.5); box(-11, -8, 4, 1.2, 4.5);
  box(-21, -24, 6, 1.2, 4.5); box(-11, -24, 4, 1.2, 4.5);
  box(-16.5, -16.5, 3.4, 2.8, 1.35, 'wood');
  box(-22, -18, 2.1, 3.4, 2.6, 'container');
  // 窓：腰壁とまぐさの間を弾と視線が通る。
  box(-12, -18, .35, 4, .95, 'panel'); box(-12, -18, .35, 4, 1.8, 'wall', 2.2);
  box(-12, -20, .5, .5, 3.8); box(-12, -16, .5, .5, 3.8);
  box(-17, -16, 14, 16, .25, 'roof', 4.5, { radar: false });
  // 東は屋外。南ゲートと中央連絡口、北の広い出入り口。
  box(13.5, -3, 9, 1.2, 3.2, 'container');
  box(12, 11, 5, 3, 3.1, 'container'); box(21, 2, 6, 2, 2.8, 'container');
  box(11.5, -7, 4, 1.4, 3.1, 'container'); box(22, -7, 4, 1.4, 3.1, 'container');
  box(17, -18, 3, 3.4, 1.45, 'container');
  box(21.5, -13, 2, 2, 1.25, 'wood'); box(11.8, -20, 2.4, 2.4, 1.1, 'wood');
  // 中央検査口のずれた壁が出発地点同士の射線を切る。
  box(-3, 17, 6, 1.2, 2.8); box(4, 9, 6, 1.2, 2.8);
  box(-3, -2, 4, 3, 2.4, 'container');
  box(0, -10, 3.6, 2, 3.2, 'container');
  box(4, -15, 4, 6, 2.8, 'container');
  box(-3.5, -21, 3, .4, 1.35, 'panel');
  // しゃがみ遮蔽、薄い板、隙間のあるフェンス。
  box(-19, 18, 3, .3, 1.4, 'panel'); box(18, 18, 2.6, 2, 1.05, 'wood');
  box(-20, -3, 2.5, .25, 1.35, 'panel'); box(3.5, 1, 2, .25, 1.35, 'panel');
  for (let z = -23; z <= -19; z += .6) box(22.8, z, .1, .1, 2, 'fence');
  // 三段の階段と小さな観測台。
  for (let i = 0; i < 3; i++) box(-22.5, -10 - i, 2, 1, .28 * (i + 1), 'step');
  box(-22.5, -14, 2, 3, .84, 'platform');
  // スロープは実形状の高さ場。既存描画も一致するよう10cmの細かい段で表現。
  const ramp = { id: 'b-ramp', x: 21.5, z: -22, w: 3, d: 4.8, h: 1.2, axis: 'z', direction: -1, y: 0 };
  ramps.push(ramp);
  for (let i = 0; i < 12; i++) box(ramp.x, -19.8 - i * .4, 3, .4, (i + 1) * .1, 'step', 0, { rampId: ramp.id });
  box(21.5, -25.5, 3, 2.4, 1.2, 'platform');
  // 装飾もデータとして渡す。通行を塞ぐものには必ず実際の衝突を持たせる。
  for (const [x, z] of [[-22, 21], [22, 12], [6.8, -22], [-6.8, 27]]) box(x, z, .8, .8, 1.15, 'drum');
  for (const [x, z] of [[-23, 25], [23, 25], [23, -28], [-23, -28]]) box(x, z, .18, .18, 5.7, 'lamp');
  const decorations = [
    { kind: 'crane', x: 29, z: -20, y: 0, area: 'b' },
    { kind: 'sign', x: -9.7, z: -9, y: 3, text: '荷役室 A', area: 'a' },
    { kind: 'sign', x: 9.7, z: -9, y: 3, text: '揚重庭 B', area: 'b' }
  ];
  const sites = [
    { id: 'A', name: 'A 荷役室', x: -17, z: -14, r: 3.6, indoor: true, area: 'a', color: 0xd6a367 },
    { id: 'B', name: 'B 揚重庭', x: 16, z: -14, r: 3.7, indoor: false, area: 'b', color: 0x7dc5bd }
  ];
  const spawns = { attack: { x: 0, z: 28 }, defend: { x: 0, z: -28 } };
  const entrances = [
    { id: 'a-south', site: 'A', x: -16, z: -8, name: 'A 搬入口', tag: '入口' },
    { id: 'a-mid', site: 'A', x: -9, z: -9.5, name: 'A 連絡扉', tag: '入口' },
    { id: 'a-north', site: 'A', x: -16, z: -24, name: 'A 北扉', tag: '入口' },
    { id: 'b-south', site: 'B', x: 16, z: -7, name: 'B 南ゲート', tag: '入口' },
    { id: 'b-mid', site: 'B', x: 9, z: -9.5, name: 'B 連絡口', tag: '入口' },
    { id: 'b-north', site: 'B', x: 16, z: -24, name: 'B 北通路', tag: '入口' }
  ];
  const tactical = [
    [-20,-12,'A','隠れ'],[-14,-14,'A','見張り'],[-20,-21,'A','見張り'],[-14,-22,'A','隠れ'],[-12,-11,'A','見張り'],
    [14,-16,'B','隠れ'],[19,-20,'B','隠れ'],[20,-11,'B','見張り'],[12,-15,'B','見張り'],[16,-24,'B','見張り'],
    [-5,-12,'mid','見張り'],[1,-20,'mid','隠れ'],[-5,5,'mid','入口'],[5,-8,'mid','入口'],
    [-16,5,'A','集合'],[17,6,'B','集合'],[-17,-11,'A','設置'],[16,-15,'B','設置']
  ].map((p,i) => ({ id: 't' + i, x:p[0], z:p[1], site:p[2], tag:p[3] }));
  function overlaps(x, z, r, b) {
    const dx = x - K.clamp(x, b.x - b.w / 2, b.x + b.w / 2), dz = z - K.clamp(z, b.z - b.d / 2, b.z + b.d / 2);
    return dx * dx + dz * dz < r * r - 1e-9;
  }
  function free(x, z, y, r, height) {
    return !boxes.some(b => b.solid !== false && y < b.y + b.h - .0001 && y + height > b.y + .0001 && overlaps(x, z, r, b));
  }
  function floor(x, z, maxY, radius) {
    let y = 0; const r = radius == null ? K.rules.radius : radius;
    for (const b of boxes) if (b.solid !== false && b.y + b.h <= maxY + .001 && overlaps(x, z, Math.max(.01, r + .0001), b)) y = Math.max(y, b.y + b.h);
    return y;
  }
  function stance(p, crouch) {
    p.crouch = !!crouch || !free(p.x, p.z, p.y, K.rules.radius, K.rules.height);
    p.height = p.crouch ? 1.22 : K.rules.height;
  }
  // 円柱の水平断面を使い、最大12cmの小刻み移動で薄い板のすり抜けを防ぐ。
  // 二軸とも衝突した角では最近点法線に沿って接線方向へ滑らせる。
  function move(p, dx, dz, dt) {
    if (dt > 0) p.verticalDone = true;
    const r = K.rules.radius, h = p.crouch ? 1.22 : K.rules.height;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
    for (let i = 0; i < n; i++) {
      let mx = dx / n, mz = dz / n;
      const tryMove = (sx, sz) => {
        const x = p.x + sx, z = p.z + sz;
        const step = p.grounded ? floor(x, z, p.y + .305) : p.y;
        const y = Math.max(p.y, step);
        if (!free(x, z, y, r, h)) return false;
        if (y > p.y && !free(p.x, p.z, y, r, h)) return false;
        p.x = x; p.z = z; p.y = y; return true;
      };
      if (tryMove(mx, mz)) continue;
      for (const b of boxes) {
        if (p.y >= b.y + b.h - .001 || p.y + h <= b.y || !overlaps(p.x + mx, p.z + mz, r, b)) continue;
        const qx = K.clamp(p.x, b.x - b.w / 2, b.x + b.w / 2), qz = K.clamp(p.z, b.z - b.d / 2, b.z + b.d / 2);
        const len = Math.hypot(p.x - qx, p.z - qz);
        if (len > .00001) { const nx = (p.x - qx) / len, nz = (p.z - qz) / len, into = mx * nx + mz * nz; if (into < 0) { mx -= into * nx; mz -= into * nz; } }
      }
      if (!tryMove(mx, mz)) { tryMove(dx / n, 0); tryMove(0, dz / n); }
    }
    if (dt <= 0) return;
    const steps = Math.max(1, Math.ceil(dt / .0167)), delta = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.vy = (p.vy || 0) - 18 * delta;
      let next = p.y + p.vy * delta;
      if (p.vy > 0 && !free(p.x, p.z, next, r, h)) {
        let ceiling = Infinity;
        for (const b of boxes) if (overlaps(p.x,p.z,r,b) && b.y >= p.y + h - .001) ceiling = Math.min(ceiling, b.y - h);
        next = Math.min(next, ceiling); p.vy = 0;
      }
      const ground = floor(p.x, p.z, p.y + .005);
      if (next <= ground) { p.y = ground; p.vy = 0; p.grounded = true; }
      else { p.y = next; p.grounded = false; }
    }
  }
  function drive(p, dx, dz, speed, dt) {
    const len = Math.hypot(dx, dz); if (len > 1) { dx /= len; dz /= len; }
    const accel = p.grounded ? (len > .01 ? 13 : 18) : 3;
    const t = 1 - Math.exp(-accel * dt);
    p.vx = (p.vx || 0) + (dx * speed - (p.vx || 0)) * t;
    p.vz = (p.vz || 0) + (dz * speed - (p.vz || 0)) * t;
    if (len < .01 && Math.hypot(p.vx, p.vz) < .035) p.vx = p.vz = 0;
    const x = p.x, z = p.z;
    move(p, p.vx * dt, p.vz * dt, dt);
    p.speed = Math.hypot(p.x - x, p.z - z) / dt; p.moving = p.speed > .12;
  }
  function rayBox(o, d, b, max) {
    let near = 0, far = max, normal = { x: 0, y: 0, z: 0 };
    for (const a of ['x', 'y', 'z']) {
      const lo = a === 'y' ? b.y : b[a] - (a === 'x' ? b.w : b.d) / 2, hi = a === 'y' ? b.y + b.h : b[a] + (a === 'x' ? b.w : b.d) / 2;
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) return null; continue; }
      let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a]; const sign = t1 < t2 ? -1 : 1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 >= near) { near = t1; normal = { x: 0, y: 0, z: 0 }; normal[a] = sign; }
      far = Math.min(far, t2); if (near > far) return null;
    }
    return far >= 0 && near <= max ? { t: Math.max(0, near), exit: far, normal, box: b } : null;
  }
  function ray(o, d, max) { return boxes.filter(b => b.solid !== false).map(b => rayBox(o, d, b, max)).filter(Boolean).sort((a,b) => a.t-b.t); }
  function segment(a, b, smokes) {
    const len = Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z); if (len < .001) return true;
    const d = { x:(b.x-a.x)/len,y:(b.y-a.y)/len,z:(b.z-a.z)/len };
    if (boxes.some(w => w.solid !== false && rayBox(a,d,w,len-.001))) return false;
    for (const s of smokes || []) {
      const t = K.clamp((s.x-a.x)*d.x+((s.y || 1.7)-a.y)*d.y+(s.z-a.z)*d.z,0,len);
      if (Math.hypot(a.x+d.x*t-s.x,(a.y+d.y*t-(s.y || 1.7))*.7,a.z+d.z*t-s.z) < s.r) return false;
    }
    return true;
  }
  function sight(a,b,smokes) { return segment({x:a.x,y:(a.y || 0)+(a.crouch?1.04:1.58),z:a.z},{x:b.x,y:(b.y || 0)+(b.crouch?.83:1.1),z:b.z},smokes); }
  function walkLine(a,b,radius) {
    const n = Math.max(1,Math.ceil(K.dist(a,b)/.24)); let y = a.y || 0;
    for(let i=0;i<=n;i++) { const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n; y=floor(x,z,y+.305,radius || .38); if(!free(x,z,y,radius || .38,1.8)) return false; }
    return true;
  }
  const nodes=[], grid=new Map(), spacing=2;
  for(let z=-30;z<=30;z+=spacing) for(let x=-22;x<=22;x+=spacing) {
    const elevated=boxes.some(b=>(b.kind==='step'||b.kind==='platform')&&overlaps(x,z,.42,b)); const y=elevated?floor(x,z,1.25,.42):0; if(!free(x,z,y,.43,1.8)) continue;
    const near=tactical.concat(entrances).slice().sort((a,b)=>K.dist({x,z},a)-K.dist({x,z},b))[0];
    const n={id:nodes.length,x,y,z,links:[],area:areaAt({x,z}).id,tag:K.dist({x,z},near)<3?near.tag:'通路'}; nodes.push(n);grid.set(x+','+z,n);
  }
  for(const n of nodes) for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]]) {
    const q=grid.get((n.x+dx)+','+(n.z+dz)); if(q && walkLine(n,q,.43) && Math.abs(q.y-n.y)<.61) n.links.push(q.id);
  }
  function nearest(p,connected) {
    let best=null, score=Infinity;
    for(const n of nodes) { const d=K.dist(p,n)+Math.abs((p.y || 0)-n.y)*.5; if(d<score && (!connected || walkLine(p,n,.34))) {score=d;best=n;} }
    return best || nearest(p,false);
  }
  const cache=new Map();
  function path(a,b) {
    const start=nearest(a,true),end=nearest(b,true),key=start.id+':'+end.id;
    if(cache.has(key)) return cache.get(key).map(i=>nodes[i]);
    const open=[start.id],from=new Map(),g=new Map([[start.id,0]]),f=new Map([[start.id,K.dist(start,end)]]),closed=new Set();
    while(open.length) {
      let bi=0;for(let i=1;i<open.length;i++)if(f.get(open[i])<f.get(open[bi]))bi=i;
      const cur=open.splice(bi,1)[0];
      if(cur===end.id) {const route=[cur];let c=cur;while(from.has(c)){c=from.get(c);route.unshift(c);}if(cache.size>6000)cache.clear();cache.set(key,route);return route.map(i=>nodes[i]);}
      closed.add(cur);
      for(const id of nodes[cur].links) {if(closed.has(id))continue;const cost=g.get(cur)+K.dist(nodes[cur],nodes[id]);if(cost<(g.get(id)??Infinity)){from.set(id,cur);g.set(id,cost);f.set(id,cost+K.dist(nodes[id],end));if(!open.includes(id))open.push(id);}}
    }
    return [start];
  }
  function routeLength(a,b) {const r=path(a,b);let d=K.dist(a,r[0]);for(let i=1;i<r.length;i++)d+=K.dist(r[i-1],r[i]);return d+K.dist(r[r.length-1],b);}
  function cover(p, threat, maxDistance) {
    let best=null,score=Infinity;
    for(const n of nodes) {const d=K.dist(p,n);if(d<1.2||d>(maxDistance || 8)||sight(threat,n,[]))continue;const v=d+(n.tag==='隠れ'?-1:0);if(v<score && walkLine(p,n)){score=v;best=n;}}
    return best;
  }
  function material(box) { return !box?'concrete':['wood','panel'].includes(box.kind)?'wood':['container','fence','drum','lamp'].includes(box.kind)?'metal':'concrete'; }
  function materialAt(p) { const b=boxes.find(b=>Math.abs(p.x-b.x)<b.w/2&&Math.abs(p.z-b.z)<b.d/2&&Math.abs((p.y || 0)-(b.y+b.h))<.05);return material(b); }
  K.map={material,materialAt,name:'灯環ふ頭',bounds:{minX:-24,maxX:24,minZ:-32,maxZ:32},boxes,ramps,areas,decorations,entrances,tactical,sites,spawns,nodes,free,floor,move,drive,stance,ray,rayBox,sight,segment,path,nearest,walkLine,routeLength,cover,areaAt,
    siteAt:p=>sites.find(s=>K.dist(p,s)<s.r && (p.y || 0)<1.6), location:p=>areaAt(p).name};
  if(typeof module!=='undefined')module.exports=K.map;
})(typeof globalThis!=='undefined'?globalThis:window);
