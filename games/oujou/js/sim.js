(function(H){
  'use strict';
  H.event=(g,type,data={})=>{g.events.push({id:++g.eventId,time:g.time,type,...data});if(g.events.length>180)g.events.splice(0,g.events.length-180);};
  H.add=(g,e)=>{e.id=++g.nextId;e.alive=true;e.maxHp=e.hp;e.px=e.x;e.py=e.y;e.fx=e.team===1?-1:1;e.fy=-e.fx;e.cooldown=0;e.radius=e.radius||1;e.lastHit={};g.entities.push(e);g.byId[e.id]=e;return e;};
  H.create=options=>{
    const o=options||{},g={seed:(Number(o.seed)||1)>>>0,time:0,tick:0,nextId:0,eventId:0,entities:[],byId:{},heroes:[],towers:[],castles:[],camps:[],effects:[],walls:[],events:[],winner:null,difficulty:H.clamp(Number(o.diff??1),0,2),watch:!!o.watch,proxy:!!o.proxy,guidance:{enabled:o.guides!==false&&!o.watch,arrived:false,seen:{},text:'',until:0},playerId:1,rallyUntil:0,teams:[{kills:0,dragons:0,ancientUntil:0},{kills:0,dragons:0,ancientUntil:0}],wave:0,nextWave:5,metrics:{maxMinions:0,giants:[],gold:[],casts:0,hits:0},grid:new Map(),fog:[new Uint8Array(1600),new Uint8Array(1600)]};g.random=H.rng(g.seed);
    let selected=typeof o.hero==='number'?H.clamp(o.hero,0,7):H.heroes.findIndex(h=>h.name===o.hero);if(selected<0||selected===undefined)selected=0;
    const compose=first=>{const groups=[[0,3,7],[2],[1,6],[5],[4,7,0]],out=[];const slot=first==null?-1:groups.findIndex(v=>v.includes(first));for(let i=0;i<5;i++){const avail=groups[i].filter(n=>!out.some(x=>x.hero===n)&&n!==first);out.push({hero:i===slot?first:avail[Math.floor(g.random()*avail.length)],slot:i});}if(first!=null)out.sort((a,b)=>Number(b.hero===first)-Number(a.hero===first));return out;};
    const blue=compose(o.watch?null:selected),red=compose(null);
    for(let team=0;team<2;team++){const roster=team?red:blue;for(let i=0;i<5;i++){const hero=roster[i].hero,slot=roster[i].slot,d=H.heroes[hero],b=H.map.fountains[team],h=H.add(g,{kind:'hero',team,hero,name:d.name,x:b.x+(team?Math.floor(i/3)-.5:i%3-1)*2,y:b.y+(team?i%3-1:Math.floor(i/3)-.5)*2,hp:d.hp,mana:220,maxMana:220,level:1,xp:0,gold:340,totalGold:340,inventory:[],spent:0,skills:[0,0,0,0],target:null,prevInput:{},input:H.emptyInput(),bot:o.watch||o.proxy||team===1||i!==0,lane:[0,1,2,2,-1][slot],roleIndex:slot,respawn:0,recall:0,kills:0,deaths:0,assists:0,lastHits:0,damage:0,towerKills:0,streak:0,guardUntil:0,shield:0,shieldUntil:0,stealthUntil:0,hasteUntil:0,siegeUntil:0,empowerUntil:0,wolfUntil:0,griffinUntil:0,immortalUntil:0,stunUntil:0,slowUntil:0,reviveUsed:false,brain:{next:0,mode:'lane',camp:i%4},attackCount:0});g.heroes.push(h);}}
    for(let team=0;team<2;team++){for(let lane=0;lane<3;lane++)for(let inner=0;inner<2;inner++){const t=inner?.16:.33,p=H.lanePoint(lane,team?1-t:t);g.towers.push(H.add(g,{kind:'tower',team,lane,inner:!!inner,name:(team?'赤':'青')+(inner?'内塔':'外塔'),...p,hp:4000,range:21,radius:2.4,focus:null,charge:0,stack:0}));}const b=H.map.bases[team];g.castles.push(H.add(g,{kind:'castle',team,...b,hp:11500,radius:5,name:(team?'紅晶':'蒼晶')+'の王城',giant:false,giantAt:null,phase:0,nextSkill:0}));}
    H.map.camps.forEach((c,i)=>g.camps.push(H.add(g,{kind:'camp',team:-1,...c,campIndex:i,hp:[480,640,850,1100][i%4],homeX:c.x,homeY:c.y,spawnAt:0,range:4,radius:c.type==='griffin'?2.5:1.6})));
    H.map.bosses.forEach(c=>{const b=H.add(g,{kind:'boss',team:-1,...c,hp:c.type==='ancient'?6500:3300,homeX:c.x,homeY:c.y,spawnAt:c.spawn,range:7,radius:c.type==='ancient'?5:3,phase:0,nextSkill:0});b.alive=false;g.camps.push(b);});
    H.reindex(g);H.updateFog(g);return g;
  };
  H.reindex=g=>{g.grid.clear();for(const e of g.entities)if(e.alive){const k=Math.floor(e.x/20)+Math.floor(e.y/20)*10;let cell=g.grid.get(k);if(!cell)g.grid.set(k,cell=[]);cell.push(e);}};
  H.near=(g,p,r)=>{const out=[],x0=Math.max(0,Math.floor((p.x-r)/20)),x1=Math.min(9,Math.floor((p.x+r)/20)),y0=Math.max(0,Math.floor((p.y-r)/20)),y1=Math.min(9,Math.floor((p.y+r)/20));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const cell=g.grid.get(x+y*10);if(cell)for(const e of cell)if(e.alive&&(p.x-e.x)**2+(p.y-e.y)**2<=r*r)out.push(e);}return out;};
  H.updateFog=g=>{for(const f of g.fog)f.fill(0);for(const e of g.entities){if(!e.alive||e.team<0||!['hero','minion','tower','castle'].includes(e.kind))continue;const r=e.kind==='hero'?31:e.kind==='minion'?23:29,f=g.fog[e.team];for(let y=Math.max(0,Math.floor((e.y-r)/5));y<=Math.min(39,Math.floor((e.y+r)/5));y++)for(let x=Math.max(0,Math.floor((e.x-r)/5));x<=Math.min(39,Math.floor((e.x+r)/5));x++)if(((x+.5)*5-e.x)**2+((y+.5)*5-e.y)**2<=r*r)f[x+y*40]=1;}};
  H.visible=(g,team,e)=>{if(e.team===team)return true;if(!e.alive)return false;if(!g.fog[team][H.clamp(Math.floor(e.x/5),0,39)+H.clamp(Math.floor(e.y/5),0,39)*40])return false;const bush=H.bushAt(e);if(bush>=0&&!H.near(g,e,20).some(h=>h.team===team&&h.alive&&H.bushAt(h)===bush)&&!(e.revealedUntil>g.time))return false;if(e.stealthUntil>g.time&&!(e.revealedUntil>g.time)&&!g.heroes.some(h=>h.team===team&&h.alive&&H.dist(h,e)<4))return false;return true;};
  H.vulnerable=(g,e)=> e.kind==='tower'&&e.inner?!g.towers.some(t=>t.team===e.team&&t.lane===e.lane&&!t.inner&&t.alive):e.kind==='castle'?g.towers.some(t=>t.team===e.team&&t.inner&&!t.alive):true;
  H.stats=(g,h)=>{
    if(h._stats&&h._statsTick===g.tick)return h._stats;const d=H.heroes[h.hero],l=h.level-1,s={hp:d.hp+l*83,mana:220+l*24,attack:d.attack+l*4.8,range:d.range,speed:d.speed,armor:d.armor+l*2.8,interval:d.interval,power:l*5,attackSpeed:0,leech:0,haste:0};
    for(const i of h.inventory){const a=H.items[i];for(const k of ['hp','mana','attack','speed','armor','power','attackSpeed','leech','haste'])s[k]+=a[k]||0;}
    const boost=g.teams[h.team].dragons*.04+(h.empowerUntil>g.time?.18:0);s.attack*=1+boost;s.power*=1+boost;s.armor+=boost*70;if(h.wolfUntil>g.time)s.attack*=1.12;if(h.griffinUntil>g.time)s.haste+=.15;if(h.hasteUntil>g.time)s.speed*=1.35;if(h.siegeUntil>g.time){s.range+=7;s.speed*=.55;}if(h.hero===0&&h.hp<h.maxHp*.5)s.armor+=25;if(g.heroes.some(a=>a.team===h.team&&a.hero===3&&a.alive&&H.dist(a,h)<13))s.armor+=8;if(h.hero===1)s.attackSpeed+=Math.min(.16,h.attackCount*.04);s.interval/=1+s.attackSpeed;s.haste=Math.min(.5,s.haste);h._stats=s;h._statsTick=g.tick;return s;
  };
  H.recommend=h=>H.builds[h.hero].find(i=>!h.inventory.includes(i));
  H.buy=(g,h,index)=>{const item=H.items[index];if(h.alive&&!H.inBase(h)||!item||h.inventory.length>=6||h.gold<item.price)return false;h.gold-=item.price;h.spent+=item.price;h.inventory.push(index);h._statsTick=-1;h.maxHp=H.stats(g,h).hp;h.maxMana=H.stats(g,h).mana;H.event(g,'buy',{source:h.id,item:index});return true;};
  H.sell=(g,h,slot)=>{if(h.alive&&!H.inBase(h)||slot<0||slot>=h.inventory.length)return false;const i=h.inventory.splice(slot,1)[0];h.gold+=Math.floor(H.items[i].price*.6);h._statsTick=-1;h.maxHp=H.stats(g,h).hp;h.hp=Math.min(h.hp,h.maxHp);return true;};
  H.gold=(g,h,n)=>{h.gold+=n;h.totalGold+=n;H.event(g,'gold',{target:h.id,x:h.x,y:h.y,amount:Math.round(n)});};
  H.experience=(g,h,n)=>{h.xp+=n;while(h.level<12&&h.xp>=h.level*145){h.xp-=h.level*145;h.level++;h._statsTick=-1;h.maxHp=H.stats(g,h).hp;h.maxMana=H.stats(g,h).mana;h.hp=Math.min(h.maxHp,h.hp+100);h.mana=Math.min(h.maxMana,h.mana+45);H.event(g,'level',{target:h.id,level:h.level,x:h.x,y:h.y});}};
  H.revive=(g,h)=>{const b=H.map.fountains[h.team];h.alive=true;h.x=b.x+(h.team?0:(h.roleIndex%3-1)*2);h.y=b.y+(h.team?(h.roleIndex%3-1)*2:0);h.px=h.x;h.py=h.y;h.maxHp=H.stats(g,h).hp;h.hp=h.maxHp;h.mana=h.maxMana;h.respawn=0;h.recall=0;h.approachAnchor=null;h.stunUntil=0;h.brain.mode='lane';h.shield=0;H.event(g,'return',{target:h.id,x:h.x,y:h.y});};
  H.awaken=(g,c)=>{if(c.giant)return;c.giant=true;c.giantAt=g.time;c.nextSkill=g.time+4;c.immortalUntil=g.time+4;g.metrics.giants.push({team:c.team,time:g.time});for(const h of g.heroes)if(h.team===c.team){if(!h.alive)H.revive(g,h);h.hp=h.maxHp;h.mana=h.maxMana;h.empowerUntil=g.time+30;}H.event(g,'giant',{target:c.id,team:c.team,x:c.x,y:c.y,text:c.name+'が守護巨人に！'});};
  H.step=(g,inputs={})=>{
    if(g.winner!==null)return;g.tick++;g.time=g.tick/30;
    for(const e of g.entities){e.px=e.x;e.py=e.y;e.cooldown=Math.max(0,e.cooldown-H.DT);if(e.kind==='hero')for(let i=0;i<4;i++)e.skills[i]=Math.max(0,e.skills[i]-H.DT);}
    if(g.tick%6===1)H.reindex(g);if(g.tick%10===1)H.updateFog(g);
    if(g.time>=g.nextWave){H.spawnWave(g);g.nextWave+=30;}
    H.updateEffects(g);
    // Alternate initiative every frame, so neither kingdom owns update order.
    const order=g.tick%2?g.heroes:g.heroes.slice().reverse();
    for(const h of order){if(!h.alive){const shop=inputs[h.id];if(shop?.buy!=null)H.buy(g,h,shop.buy);if(shop?.sell!=null)H.sell(g,h,shop.sell);if(g.time>=h.respawn)H.revive(g,h);continue;}const s=H.stats(g,h);h.maxHp=s.hp;h.maxMana=s.mana;h.hp=Math.min(h.maxHp,h.hp+(H.inBase(h)?h.maxHp*.14:1.8)*H.DT);h.mana=Math.min(h.maxMana,h.mana+(H.inBase(h)?80:5)*H.DT);h.gold+=1.45*H.DT;h.totalGold+=1.45*H.DT;if(h.hero===5&&g.tick%30===0)for(const a of g.heroes)if(a.alive&&a.team===h.team&&H.dist(a,h)<13)a.hp=Math.min(a.maxHp,a.hp+12+h.level*1.5);
      const input=inputs[h.id]|| (h.bot?H.botInput(g,h):H.emptyInput());H.control(g,h,input);h.vx=(h.x-h.px)*30;h.vy=(h.y-h.py)*30;
    }
    if(g.tick%3===0)H.updateUnits(g,.1);
    if(g.tick%6===0)H.updateGuidance(g);
    g.effects=g.effects.filter(e=>e.end>g.time);g.walls=g.walls.filter(w=>w.until>g.time);
    if(g.tick%300===0){g.entities=g.entities.filter(e=>e.kind!=='minion'||e.alive||g.time-e.diedAt<2);const keep=new Set(g.entities.map(e=>e.id));for(const id in g.byId)if(!keep.has(+id))delete g.byId[id];}
    if(g.tick%1800===0&&g.time>=1200)H.event(g,'notice',{text:'夜が深まり、両軍の兵士が戦いながら城へ進軍する'});
    if(g.tick%1800===0)g.metrics.gold.push({time:g.time,heroes:g.heroes.map(h=>Math.round(h.totalGold))});
  };
  // Testable safety/teaching rules; the UI only reads these states.
  H.autoApproachSafe=(g,h,next)=>!g.towers.some(t=>{
    if(!t.alive||t.team===h.team||H.dist(next,t)>t.range+1)return false;
    const cover=g.byId[t.focus];
    return !(cover?.alive&&cover.team===h.team&&cover.kind==='minion'&&H.dist(cover,t)<=t.range);
  });
  H.towerThreat=(g,h)=>h.alive&&g.towers.some(t=>t.alive&&t.team!==h.team&&t.focus===h.id&&H.dist(t,h)<=t.range);
  H.guideGoal=(g,h)=>H.lanePoint(h.lane<0?1:h.lane,h.team?.58:.42);
  H.guideWaypoint=(g,h)=>{const lane=h.lane<0?1:h.lane,progress=H.laneProgress(h,lane);return H.navigate(g,h,H.lanePoint(lane,progress+(h.team?-.06:.06)));};
  H.updateGuidance=g=>{
    const guide=g.guidance,h=g.byId[g.playerId];if(!guide.enabled||g.watch||!h)return;
    const goal=H.guideGoal(g,h);
    if(H.dist(h,goal)<10||(h.team?H.laneProgress(h,h.lane<0?1:h.lane)<=.58:H.laneProgress(h,h.lane<0?1:h.lane)>=.42))guide.arrived=true;
    if(!h.alive||g.time<guide.until)return;
    const near=H.near(g,h,27),item=H.items[H.recommend(h)];
    const choices=[['recall',h.hp/h.maxHp<=.45&&!H.inBase(h),'体力が減ったら B で帰る'],
      ['soldiers',near.some(e=>e.team!==h.team&&e.team>=0&&e.kind==='minion'),'兵士のうしろで戦う'],
      ['shop',g.time>45&&item&&h.gold>=item.price&&h.inventory.length<6,'金が貯まったら店へ。B で帰って E']];
    const next=choices.find(([key,condition])=>condition&&!guide.seen[key]);
    if(next){guide.seen[next[0]]=true;guide.text=next[2];guide.until=g.time+5;H.event(g,'guide',{key:next[0],text:guide.text});}
  };
  H.castleScene=g=>{
    const c=g.castles[1];
    for(const t of g.towers)if(t.team===1){t.alive=false;t.hp=0;t.diedAt=g.time;}
    c.hp=c.maxHp/2-1;H.awaken(g,c);
    g.heroes.filter(h=>h.team===0).forEach((h,i)=>{
      h.level=8;h.xp=0;h.inventory=H.builds[h.hero].slice(0,3);h._statsTick=-1;H.revive(g,h);
      h.x=150+(i%3)*4;h.y=43+Math.floor(i/3)*4;h.px=h.x;h.py=h.y;h.fx=1;h.fy=-1;h.mana=h.maxMana=H.stats(g,h).mana;h.skills=[0,0,0,0];h.brain.next=0;h.approachAnchor=null;
    });
    g.guidance.arrived=true;H.reindex(g);H.updateFog(g);
  };
  H.control=(g,h,input)=>{
    const s=H.stats(g,h),moving=!!(input.x||input.y),target=H.selectTarget(g,h,input);
    if(!h.approachAnchor||input.attack&&!h.prevInput.attack||moving||h.prevInput.x||h.prevInput.y)h.approachAnchor={x:h.x,y:h.y};
    if(input.buy!=null)H.buy(g,h,input.buy);if(input.sell!=null)H.sell(g,h,input.sell);
    if(input.rally&&!h.prevInput.rally&&h.id===g.playerId){g.rallyUntil=g.rallyUntil>g.time?0:g.time+24;H.event(g,'rally',{source:h.id,text:g.rallyUntil?'集まれ！':'集合を解いた'});}
    if(input.recall&&!h.prevInput.recall)h.recall=g.time+8;
    if(moving||input.attack||(input.skills||[]).some(Boolean))h.recall=0;
    if(h.recall&&g.time>=h.recall){H.revive(g,h);h.recall=0;}
    if(!(h.stunUntil>g.time)&&!h.recall){
      if(moving&&!(h.windupUntil>g.time))H.move(g,h,input.x,input.y,s.speed);
      if(input.attack&&target){const d=H.dist(h,target);if(d<=s.range+target.radius){if(h.cooldown<=0&&!(h.windupUntil>g.time))H.attack(g,h,target);}else if(!moving&&d<s.range+target.radius+3&&!(h.windupUntil>g.time)){
        const step=Math.min(s.speed*H.DT,Math.max(0,d-s.range-target.radius+.05)),next={x:h.x+(target.x-h.x)/d*step,y:h.y+(target.y-h.y)/d*step};
        if(H.dist(next,h.approachAnchor)<=3&&H.autoApproachSafe(g,h,next)){const before={x:h.x,y:h.y};H.move(g,h,next.x-h.x,next.y-h.y,step/H.DT);if(H.dist(h,h.approachAnchor)>3||!H.autoApproachSafe(g,h,h)){h.x=before.x;h.y=before.y;}}
      }}
      for(let i=0;i<4;i++)if(input.skills&&input.skills[i]&&!h.prevInput.skills?.[i])H.cast(g,h,i,target);
    }
    h.prevInput={...input,skills:(input.skills||[]).slice()};h.input=input;
  };
})(globalThis.HONJIN);
