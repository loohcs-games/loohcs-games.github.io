(function (root) {
  'use strict';
  const K = root.KJ || require('./data.js');
  if (!K.map && typeof require !== 'undefined') require('./map.js');
  function fresh(id) { const w = K.weapons[id]; return { id, ammo: w.mag, reserve: w.mag * 4 }; }
  function equip(p, id) { if (!p.gear[id]) return false; p.previous = p.weapon; p.weapon = id; p.reloadEnd = 0; p.scope = 0; p.recoil = 0; p.recoilYaw = 0; p.chain = 0; p.switchEnd = p.clock + .24; return true; }
  function resetGear(p) {
    p.gear = { baton: fresh('baton') }; const id = p.side === 'attack' ? 'pebble' : 'ripple';
    p.gear[id] = fresh(id); p.weapon = id; p.previous = 'baton'; p.armor = 0; p.helmet = false; p.kit = false; p.grenades = { burst: 0, flash: 0, smoke: 0 }; p.selectedGrenade = 'flash';
  }
  function buy(m, p, id) {
    const item = K.weapons[id] || K.items[id];
    if (!item || !item.price || m.phase !== 'buy' || !p.alive || K.dist(p, K.map.spawns[p.side]) > 9 || p.money < item.price || (item.side && item.side !== p.side)) return false;
    if (K.weapons[id]) {
      if (p.gear[id]) return false;
      for (const key of Object.keys(p.gear)) if (K.weapons[key].slot === item.slot) {
        m.drops.push({x:p.x,y:p.y || 0,z:p.z,gear:{...p.gear[key]},time:m.time}); delete p.gear[key];
      }
      p.gear[id] = fresh(id); equip(p, id);
    } else if (id === 'vest' || id === 'helmet') {
      if (p.armor === 100 && (id === 'vest' || p.helmet)) return false;
      p.armor = 100; if (id === 'helmet') p.helmet = true;
    } else if (id === 'kit') { if (p.kit) return false; p.kit = true; }
    else { if (p.grenades[id] >= (id === 'flash' ? 2 : 1) || Object.values(p.grenades).reduce((a, b) => a + b, 0) >= 4) return false; p.grenades[id]++; }
    p.money -= item.price; m.emit('buy', { actor: p.id, item: id }); return true;
  }
  function botBuy(m, p) {
    const plan = m.economy && m.economy[p.team] || 'full';
    let main = Object.keys(p.gear).find(k => K.weapons[k].slot === 1);
    if (!main && plan !== 'eco') {
      const rifle = p.side === 'attack' ? 'ember' : 'tide';
      if (p.money >= 5300 && p.id % 5 === 3 && m.plan.site === 1) buy(m,p,'beacon');
      else if (p.money >= K.weapons[rifle].price + 650) buy(m,p,rifle);
      else if (p.money >= 2200) buy(m,p,p.id % 5 === 1 ? 'reed' : p.id % 5 === 2 && m.plan.site === 0 ? 'hail' : 'swift');
      else if (plan === 'force' && p.money >= 1350) buy(m,p,'comet');
    }
    if (plan !== 'eco' || m.round === 1 || m.round === 7) {
      if (p.money >= 1300) buy(m,p,'helmet'); else if (p.money >= 650) buy(m,p,'vest');
      if (p.side === 'defend' && p.money >= 400 && p.id % 5 % 2 === 0) buy(m,p,'kit');
      if (p.money >= 300) buy(m,p,p.id % 5 % 2 === 0?'smoke':'flash');
      if (p.money >= 800) buy(m,p,'burst');
      if (p.money >= 700) buy(m,p,'flash');
    }
    main = Object.keys(p.gear).find(k => K.weapons[k].slot === 1); if (main) equip(p,main);
  }
  function reload(m, p) {
    const a = p.gear[p.weapon], w = K.weapons[p.weapon];
    if (!a || p.weapon === 'baton' || p.reloadEnd || a.ammo >= w.mag || a.reserve <= 0) return;
    if (m.phase !== 'live' && m.phase !== 'buy') return;
    p.reloadEnd = m.time + w.reload; p.scope = 0; m.emit('reload', { actor: p.id, weapon:p.weapon, x: p.x, z: p.z });
  }
  function update(m, p, dt) {
    p.clock = m.time; p.cooldown = Math.max(-dt, p.cooldown - dt); p.flash = Math.max(0, p.flash - dt);
    p.recoil = Math.max(0, p.recoil - dt * .11); p.recoilYaw = (p.recoilYaw || 0) * Math.exp(-dt * 7);
    if (m.time - p.lastShot > K.weapons[p.weapon].recovery) p.chain = Math.max(0, p.chain - dt * 14);
    if (p.reloadEnd && m.time >= p.reloadEnd) { const a = p.gear[p.weapon]; if (a) { const n = Math.min(K.weapons[p.weapon].mag - a.ammo, a.reserve); a.ammo += n; a.reserve -= n; } p.reloadEnd = 0; m.emit('reloadComplete', { actor:p.id }); }
  }
  function damage(m, target, amount, source, part, weapon) {
    if (!target.alive || target.team === source.team) return;
    const w = K.weapons[weapon] || { pen: .55, reward: 300 };
    let dmg = amount * (part === 'head' ? 3.7 : part === 'legs' ? .72 : 1);
    if (target.armor > 0 && part !== 'legs' && (part !== 'head' || target.helmet)) {
      const absorb = Math.min(target.armor, dmg * (1 - w.pen)); target.armor -= absorb; dmg -= absorb;
      if (part === 'head' && target.helmet) dmg *= .8;
    }
    dmg = Math.min(target.hp, dmg); target.hp -= dmg; source.damageDealt = (source.damageDealt || 0) + dmg; source.roundDamage = (source.roundDamage || 0) + dmg;
    target.contributors = target.contributors || {}; target.contributors[source.id] = {damage: ((target.contributors[source.id] || {}).damage || 0) + dmg, time:m.time};
    target.hp = Math.max(0,target.hp); target.hurtAt = m.time; target.hurtFrom = { x: source.x, z: source.z }; target.interact = 0;
    // 被弾は位置の手がかり。壁の向こうの現在位置を共有しない。
    target.memory = { x: source.x, z: source.z, time: m.time, heard: true, kind:'hit' };
    m.emit('hit', { actor: source.id, target: target.id, part, x: target.x, y: target.y + 1, z: target.z, damage: dmg });
    if (target.hp <= 0) {
      target.hp = 0; target.alive = false; target.scope=0;target.grenadePrimed=false; target.deaths++; source.kills++; source.roundKills = (source.roundKills || 0) + 1; if(part==='head') source.headshots=(source.headshots || 0)+1;
      for (const id of Object.keys(target.contributors)) if(Number(id)!==source.id && target.contributors[id].damage>=35 && m.time-target.contributors[id].time<10) m.players[id].assists=(m.players[id].assists || 0)+1; source.money = Math.min(K.rules.cap, source.money + w.reward); target.deathTime = m.time;
      if (m.device.carrier === target.id) { m.device.carrier = null; m.device.retriever=null; m.device.x = target.x; m.device.z = target.z; m.device.y = target.y; m.radio(target, '装置を落とした'); }
      const main = Object.values(target.gear).find(g => K.weapons[g.id].slot === 1);
      if (main) m.drops.push({ x: target.x, y: target.y, z: target.z, gear: { ...main }, time: m.time });
      m.emit('kill', { actor: source.id, target: target.id, weapon, part });
    }
  }
  function shoot(m, p) {
    const w = K.weapons[p.weapon], a = p.gear[p.weapon];
    if (!p.alive || m.phase !== 'live' || !w || !a || p.cooldown > 0 || p.reloadEnd || m.time < p.switchEnd || p.interact > 0) return false;
    if (!a.ammo) { if(a.reserve) reload(m,p); else if(m.time>(p.dryAt || 0)){m.emit('dryfire',{actor:p.id});p.dryAt=m.time+.4;} return false; }
    if (p.weapon !== 'baton') a.ammo--;
    p.cooldown += w.interval; p.lastShot = m.time; p.chain++; p.shots=(p.shots || 0)+1;
    const moving = (p.moving ? K.clamp((p.speed || 4) / 5.3,0,1) : 0) * w.moveSpread, airborne = p.grounded ? 0 : .095;
    const spread = (w.spread + moving + airborne + Math.max(0, p.chain - 3) * .0025 + (w.scope && !p.scope ? .055 : 0)) * (p.crouch ? .65 : 1);
    const origin = { x: p.x, y: p.y + (p.crouch ? 1.04 : 1.58), z: p.z };
    m.sound(p, 'shot', p.weapon === 'baton' ? 6 : 35);
    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const yaw = p.yaw + (p.recoilYaw || 0) + (m.random() - .5) * spread * 2;
      const pitch = p.pitch + p.recoil + (m.random() - .5) * spread * 2;
      const d = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
      const hits = K.map.ray(origin, d, w.range);
      if (d.y < 0 && -origin.y / d.y < w.range) hits.push({ t: -origin.y / d.y, box: { thin: false }, normal: { x: 0, y: 1, z: 0 } });
      for (const t of m.players) if (t.alive && t.id !== p.id) {
        const h = t.crouch ? 1.22 : 1.8;
        for (const [part, y, height, width] of [['legs', 0, h * .4, .48], ['body', h * .4, h * .39, .6], ['head', h * .79, h * .21, .38]]) {
          const hit = K.map.rayBox(origin, d, { x: t.x, z: t.z, y: t.y + y, h: height, w: width, d: width }, w.range);
          if (hit) hits.push({ t: hit.t, target: t, part });
        }
      }
      hits.sort((a, b) => a.t - b.t);
      let power = 1, distance = w.range, impact = null;
      for (const h of hits) {
        distance = h.t;
        if (h.target) { damage(m, h.target, w.damage * Math.max(.22, 1 - h.t * w.falloff) * power, p, h.part, p.weapon); impact = 'robot'; break; }
        impact = h;
        if (!h.box.thin || p.weapon==='baton' || power < .3 || h.exit - h.t > w.penetration) break;
        power *= K.clamp(.72 - (h.exit-h.t)*.17,.3,.68); distance = w.range; impact = null;
      }
      m.emit('shot', { actor: p.id, weapon: p.weapon, pellet, from: origin, to: { x: origin.x + d.x * distance, y: origin.y + d.y * distance, z: origin.z + d.z * distance }, impact: impact === 'robot' ? 'robot' : impact ? 'wall' : null, normal: impact && impact.normal, material: impact === 'robot' ? 'metal' : K.map.material(impact && impact.box) });
    }
    const pattern=w.pattern[Math.min(w.pattern.length-1,Math.max(0,Math.floor(p.chain)-1))];
    p.recoil = Math.min(.25, p.recoil + w.kick * pattern[1] * (p.crouch ? .7 : 1)); p.recoilYaw = w.kick * pattern[0]; if(w.scope)p.scope=0; return true;
  }
  function throwGrenade(m, p, type) {
    if (m.phase !== 'live' || !p.alive || !p.grenades[type] || p.cooldown > 0 || p.interact > 0 || p.reloadEnd) return false;
    p.grenades[type]--; p.cooldown = .8;
    m.grenades.push({ type, owner: p.id, x: p.x, y: p.y + (p.crouch ? .96 : 1.4), z: p.z, vx: Math.sin(p.yaw) * 11, vz: -Math.cos(p.yaw) * 11, vy: 4 + Math.sin(p.pitch) * 6, life: type === 'smoke' ? 1.6 : 1.35 });
    m.emit('throw', { actor: p.id, x: p.x, z: p.z }); return true;
  }
  function projectiles(m, dt) {
    for (const g of m.grenades) {
      g.life -= dt;
      const steps=Math.max(1,Math.ceil(dt/.015)),h=dt/steps;
      for(let step=0;step<steps;step++) {
        g.vy-=10*h;
        const delta={x:g.vx*h,y:g.vy*h,z:g.vz*h},len=Math.hypot(delta.x,delta.y,delta.z);
        if(len<.00001)continue;
        const d={x:delta.x/len,y:delta.y/len,z:delta.z/len};let hit=null;
        for(const b of K.map.boxes) { if(b.solid===false)continue;const r=K.map.rayBox(g,d,{x:b.x,z:b.z,w:b.w+.22,d:b.d+.22,y:b.y-.11,h:b.h+.22},len);if(r&&(!hit||r.t<hit.t))hit=r; }
        if(d.y<0) {const t=(.12-g.y)/d.y;if(t>=0&&t<len&&(!hit||t<hit.t))hit={t,normal:{x:0,y:1,z:0}};}
        if(hit) {
          const t=Math.max(0,hit.t-.003);g.x+=d.x*t;g.y+=d.y*t;g.z+=d.z*t;
          const n=hit.normal,dot=g.vx*n.x+g.vy*n.y+g.vz*n.z;
          if(dot<0) {g.vx=(g.vx-1.46*dot*n.x)*.82;g.vy=(g.vy-1.46*dot*n.y)*.82;g.vz=(g.vz-1.46*dot*n.z)*.82;}
          if(len>.035 && m.time>(g.bounceAt || 0)) {m.emit('bounce',{kind:g.type,x:g.x,y:g.y,z:g.z});g.bounceAt=m.time+.15;}
        } else {g.x+=delta.x;g.y+=delta.y;g.z+=delta.z;}
        g.y=Math.max(.12,g.y);
      }
      if (g.life > 0) continue;
      const owner = m.players[g.owner];
      if (g.type === 'smoke') m.smokes.push({ x:g.x,y:g.y+1.5,z:g.z,r:.67,maxRadius:4.2,age:0,duration:17,life:17,owner:g.owner });
      for (const p of m.players) if (p.alive) {
        const eye={x:p.x,y:p.y+(p.crouch?1.04:1.58),z:p.z};
        if(!K.map.segment(g,eye,[]))continue;
        const d=Math.hypot(p.x-g.x,eye.y-g.y,p.z-g.z);
        if(g.type==='burst' && d<7)damage(m,p,100*(1-d/7),owner,'body','burst');
        if(g.type==='flash' && d<22) {
          const diff=Math.abs(K.angle(Math.atan2(g.x-p.x,-(g.z-p.z))-p.yaw));
          const elevation=Math.abs(Math.atan2(g.y-eye.y,Math.max(.1,K.dist(p,g)))-p.pitch);
          const exposure=diff<1.2&&elevation<1.1?3.8:diff<2?1.4:.35;
          p.flash=Math.max(p.flash,exposure*(1-d/26));
        }
      }
      m.emit('grenade',{kind:g.type,x:g.x,y:g.y,z:g.z});m.sound(owner,'grenade',28,g);
    }
    m.grenades=m.grenades.filter(g=>g.life>0);
    for(const s of m.smokes){s.life-=dt;s.duration=s.duration || 17;s.age=(s.age || 0)+dt;s.maxRadius=s.maxRadius || s.r;s.r=s.maxRadius*Math.min(1,.16+s.age/1.3)*K.clamp(s.life/2,0,1);}
    m.smokes=m.smokes.filter(s=>s.life>0);
  }
  function drop(m, p) {
    if (!p.alive || !['live','buy'].includes(m.phase) || K.weapons[p.weapon].slot === 3) return;
    m.drops.push({ x: p.x, y:p.y, z: p.z, gear: { ...p.gear[p.weapon] }, time: m.time }); delete p.gear[p.weapon]; equip(p, Object.keys(p.gear).find(k => k !== 'baton') || 'baton');
  }
  K.combat = { fresh, equip, resetGear, buy, botBuy, reload, update, shoot, damage, throwGrenade, projectiles, drop };
  if (typeof module !== 'undefined') module.exports = K.combat;
})(typeof globalThis !== 'undefined' ? globalThis : window);
