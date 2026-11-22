(function(H){
  'use strict';
  H.hurt=(g,source,e,raw,skill=false)=>{
    if(!e.alive||!H.vulnerable(g,e)||e.immortalUntil>g.time)return 0;
    let armor=e.kind==='hero'?H.stats(g,e).armor:e.kind==='tower'?30:e.kind==='castle'?35:0;
    let n=raw*100/(100+armor);if(e.guardUntil>g.time)n*=.35;if(e.kind==='minion'&&g.teams[e.team].ancientUntil>g.time)n*=.65;
    if(e.shieldUntil>g.time&&e.shield>0){const absorbed=Math.min(n,e.shield);e.shield-=absorbed;n-=absorbed;}
    if(e.kind==='hero')e.recall=0;
    if(e.kind==='hero'&&source.team>=0){e.lastHit[source.id]=g.time;e.revealedUntil=g.time+1.5;if(source.kind==='hero')for(const t of g.towers)if(t.alive&&t.team===e.team&&H.dist(t,e)<t.range&&H.dist(t,source)<t.range){if(t.focus!==source.id)t.stack=0;t.focus=source.id;t.aggroUntil=g.time+3;}}
    if(source.kind==='hero'){source.damage+=Math.min(e.hp,n);if(!skill)source.hp=Math.min(source.maxHp,source.hp+n*H.stats(g,source).leech);if(skill&&source.hero===2)source.mana=Math.min(source.maxMana,source.mana+3);}
    e.hp-=n;e._statsTick=-1;e.lastDamageAt=g.time;e.lastSource=source.id;H.event(g,'damage',{source:source.id,target:e.id,x:e.x,y:e.y,amount:Math.round(n),skill});
    if(e.kind==='castle'&&!e.giant&&e.hp<=e.maxHp/2){e.hp=Math.max(e.hp,e.maxHp/2-1);H.awaken(g,e);}
    if(e.hp<=0){if(e.kind==='hero'&&e.prayerUntil>g.time){e.hp=1;return n;}H.die(g,e,source);}return n;
  };
  H.die=(g,e,source)=>{
    if(e.kind==='hero'&&!e.reviveUsed&&e.inventory.some(i=>H.items[i].revive)){e.reviveUsed=true;e.hp=e.maxHp*.38;e.immortalUntil=g.time+2;H.event(g,'revive',{target:e.id,x:e.x,y:e.y});return;}
    e.alive=false;e.hp=0;e.diedAt=g.time;H.event(g,'death',{target:e.id,source:source.id,kind:e.kind,x:e.x,y:e.y});
    const team=source.team>=0?source.team:1-e.team,near=g.heroes.filter(h=>h.team===team&&h.alive&&H.dist(h,e)<30),killer=source.kind==='hero'?source:null;
    const exp=e.kind==='hero'?190+e.level*18:e.kind==='minion'?55:e.kind==='tower'?200:e.kind==='boss'?450:170;
    for(const h of near)H.experience(g,h,exp/Math.max(1,near.length));
    if(e.kind==='hero'){g.teams[team].kills++;e.deaths++;e.respawn=g.time+H.clamp(8+(e.level-1)*2.7,8,40);if(killer){killer.kills++;killer.streak++;H.event(g,'achievement',{target:killer.id,text:killer.streak>1?`${killer.streak}連・道を切りひらいた！`:'敵英雄を退かせた！'});H.gold(g,killer,200+e.streak*55);}for(const h of g.heroes)if(h.team===team&&h!==killer&&e.lastHit[h.id]>g.time-8){h.assists++;H.event(g,'achievement',{target:h.id,text:'仲間とともに退かせた！'});H.gold(g,h,85);}e.streak=0;e.attackCount=0;H.event(g,'notice',{text:(killer?killer.name:'兵士・砦')+' が '+e.name+' を退かせた',team});}
    else if(e.kind==='tower'){if(killer)killer.towerKills++;H.event(g,'achievement',{team,text:'塔を折った！ 前へ進もう'});for(const h of g.heroes)if(h.team===team)H.gold(g,h,145);H.event(g,'notice',{text:(e.team?'赤':'青')+'の'+['上','中','下'][e.lane]+'の'+(e.inner?'内塔':'外塔')+'が折れた',team});}
    else if(e.kind==='castle'){if(g.winner===null)g.winner=team;H.event(g,'victory',{team,text:team===0?'青の王国の勝利':'赤の王国の勝利'});}
    else if(e.kind==='boss'){e.spawnAt=g.time+240;if(e.type==='water')g.teams[team].dragons++;else g.teams[team].ancientUntil=g.time+180;for(const h of g.heroes)if(h.team===team)H.gold(g,h,e.type==='ancient'?220:160);H.event(g,'notice',{team,text:(team?'赤':'青')+'の王国が'+e.name+'を鎮めた'});}
    else {const reward=e.kind==='minion'?(e.type==='siege'?52:e.type==='heavy'?38:18):90;for(const h of near)H.gold(g,h,h===killer?reward:Math.round(reward*.4));if(killer&&!near.includes(killer))H.gold(g,killer,reward);if(killer&&e.kind==='minion')killer.lastHits++;if(e.kind==='camp'){e.spawnAt=g.time+75;if(killer&&e.type==='wolf'){killer.wolfUntil=g.time+90;killer._statsTick=-1;}if(killer&&e.type==='griffin'){killer.griffinUntil=g.time+90;killer._statsTick=-1;}}}
  };
  H.attack=(g,h,target)=>{const s=H.stats(g,h);h.cooldown=s.interval;h.windupUntil=g.time+.17;h.attackCount++;h.revealedUntil=g.time+1;h.stealthUntil=0;let damage=s.attack;if(h.hero===4&&((target.x-h.x)*target.fx+(target.y-h.y)*target.fy)>0)damage*=1.25;if(h.hero===6&&['tower','castle'].includes(target.kind))damage*=1.2;if(h.hero===7&&h.flameUntil>g.time){damage+=35+h.level*4;h.flameUntil=0;}g.effects.push({id:++g.nextId,kind:'attack',shape:'shot',source:h.id,team:h.team,target:target.id,x:h.x,y:h.y,tx:target.x,ty:target.y,damage,at:g.time+.17,start:g.time,end:g.time+.4,done:false});H.event(g,'attack',{source:h.id,target:target.id,x:h.x,y:h.y});};
  H.cast=(g,h,index,target)=>{
    const d=H.heroes[h.hero].skills[index],rank=H.skillRanks(h.level)[index];if(!rank||h.skills[index]>0||h.mana<d.cost||h.stunUntil>g.time)return false;
    const s=H.stats(g,h),aim=H.aim(g,h,d,target);h.mana-=d.cost;h.skills[index]=d.cooldown*(1-s.haste);h.windupUntil=Math.max(h.windupUntil||0,g.time+Math.min(d.delay,.35));h.revealedUntil=g.time+1;h.stealthUntil=0;if(h.hero===7)h.flameUntil=g.time+5;
    let x=d.range&&d.shape!=='cone'?aim.x:h.x,y=d.range&&d.shape!=='cone'?aim.y:h.y;
    if(d.shape==='heal'){const ally=g.heroes.filter(a=>a.team===h.team&&a.alive&&H.dist(a,h)<=Math.max(d.range,1)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]||h;x=ally.x;y=ally.y;}
    if(d.dash)H.move(g,h,aim.dx*Math.sign(d.dash),aim.dy*Math.sign(d.dash),Math.abs(d.dash),1);
    if(d.blink&&target&&H.dist(h,target)<d.range+2){const tx=target.x-target.fx*2.5,ty=target.y-target.fy*2.5;if(H.walkable(g,tx,ty)){h.x=tx;h.y=ty;}}
    if(d.guard)h.guardUntil=g.time+d.guard;if(d.stealth){h.stealthUntil=g.time+d.stealth;h.revealedUntil=0;}if(d.siege)h.siegeUntil=g.time+d.siege;
    for(let repeat=0;repeat<(d.repeats||1);repeat++)g.effects.push({id:++g.nextId,kind:'skill',shape:d.shape,source:h.id,team:h.team,hero:h.hero,index,name:d.name,x,y,ox:h.px,oy:h.py,dx:aim.dx,dy:aim.dy,range:d.range,radius:d.radius,damage:d.damage*(1+(rank-1)*.22)+s.power*(d.damage? .65:0),at:g.time+d.delay+repeat*.4,start:g.time,end:g.time+d.delay+repeat*.4+.5,data:d,done:false});
    h._statsTick=-1;g.metrics.casts++;H.event(g,'cast',{source:h.id,hero:h.hero,index,name:d.name,x:h.x,y:h.y,ultimate:index===3,team:h.team});return true;
  };
  H.inEffect=(e,p,pad=0)=>{if(e.shape==='wall')return H.segmentDistance(p,{x:e.x-e.dy*e.radius,y:e.y+e.dx*e.radius},{x:e.x+e.dy*e.radius,y:e.y-e.dx*e.radius})<=2+pad;if(e.shape==='line')return H.segmentDistance(p,{x:e.ox,y:e.oy},{x:e.ox+e.dx*e.range,y:e.oy+e.dy*e.range})<=e.radius+pad;if(e.shape==='cone'){const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);return d<=e.range+pad&&(dx*e.dx+dy*e.dy)/(d||1)>Math.cos(e.radius);}return H.dist(e,p)<=e.radius+pad;};
  H.updateEffects=g=>{for(const e of g.effects){if(e.done||g.time<e.at)continue;e.done=true;const source=g.byId[e.source];if(!source)continue;
    if(e.kind==='attack'){const target=g.byId[e.target];if(target&&target.alive&&source.alive&&H.dist(source,target)<H.stats(g,source).range+target.radius+4)H.hurt(g,source,target,e.damage);continue;}
    const d=e.data||{};
    if(d.leap&&source.alive&&H.walkable(g,e.x,e.y)){source.x=e.x;source.y=e.y;}
    if(e.shape==='wall'){const a={x:e.x-e.dy*e.radius,y:e.y+e.dx*e.radius},b={x:e.x+e.dy*e.radius,y:e.y-e.dx*e.radius};g.walls.push({a,b,until:g.time+d.wall,team:e.team});}
    let hit=0;for(const t of g.entities){if(!t.alive)continue;const friendly=t.team===e.team;if(e.shape==='heal'||d.shield||d.haste){if(friendly&&t.kind==='hero'&&H.dist(e,t)<=e.radius){if(e.shape==='heal'){t.hp=Math.min(t.maxHp,t.hp+e.damage);if(d.immortal)t.prayerUntil=g.time+d.immortal;H.event(g,'heal',{target:t.id,x:t.x,y:t.y,amount:Math.round(e.damage)});}if(d.shield){t.shield=d.shield+source.level*12;t.shieldUntil=g.time+4;}if(d.haste){t.hasteUntil=g.time+d.haste;t._statsTick=-1;}}continue;}
      if(friendly||!H.inEffect(e,t,t.radius*.5)||e.damage<=0)continue;
      const n=e.damage*(d.execute?1+(1-t.hp/t.maxHp)*1.5:1)*(['tower','castle'].includes(t.kind)?.35:1);H.hurt(g,source,t,n,true);hit++;
      if(t.kind==='hero'||t.kind==='minion'){if(d.slow)t.slowUntil=g.time+d.slow;if(d.stun)t.stunUntil=g.time+d.stun;if(d.pull)H.move(g,t,source.x-t.x,source.y-t.y,d.pull,1);if(d.carry)H.move(g,t,e.dx,e.dy,d.carry,1);if(d.knock)H.move(g,t,t.x-e.x,t.y-e.y,d.knock,1);}
    }if(hit)g.metrics.hits++;H.event(g,'impact',{x:e.x,y:e.y,shape:e.shape,team:e.team,ultimate:e.index===3});
  }};
})(globalThis.HONJIN);
