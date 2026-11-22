(function(H){
  'use strict';
  const toward=(g,h,p)=>{
    h.brain.goal={x:p.x,y:p.y};
    const n=H.navigate(g,h,p),dx=n.x-h.x,dy=n.y-h.y,d=Math.hypot(dx,dy);if(d<=1)return {x:0,y:0};
    const angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4),want={x:Math.round(Math.cos(angle)),y:Math.round(Math.sin(angle))};
    const react=H.difficulties[h.team===0?1:g.difficulty].react,step=H.stats(g,h).speed*(react+.1);
    const clear=v=>{const l=Math.hypot(v.x,v.y),q={x:h.x+v.x/l*step,y:h.y+v.y/l*step};return H.walkable(g,q.x,q.y,h.radius)&&H.clearPath(g,h,q,h.radius);};
    if(clear(want))return want;
    let best=-Infinity,choice={x:0,y:0};
    for(const v of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}]){
      if(!clear(v))continue;const l=Math.hypot(v.x,v.y),cross=(dx*v.y-dy*v.x)/d,score=(dx*v.x+dy*v.y)/(d*l)+cross*.00001*(h.team===1?-1:1);if(score>best){best=score;choice=v;}
    }
    return choice;
  };
  // This controller returns only public movement/attack/skill/shop inputs. It never deals damage or teleports.
  H.decideInput=(g,h)=>{
    const b=h.brain,level=h.team===0?1:g.difficulty,d=H.difficulties[level];
    if(g.time<b.next){const old=b.input||H.emptyInput();return {...old,skills:[false,false,false,false],recall:false,rally:false,buy:undefined};}
    b.next=g.time+d.react;const input=H.emptyInput(),s=H.stats(g,h),base=H.map.bases[h.team],enemyBase=H.map.bases[1-h.team];
    const visible=H.near(g,h,34).filter(e=>e.team!==h.team&&H.visible(g,h.team,e)&&H.vulnerable(g,e)),enemies=visible.filter(e=>e.team===1-h.team),allies=H.near(g,h,26).filter(e=>e.team===h.team&&e.kind==='hero'),hostiles=enemies.filter(e=>e.kind==='hero');
    if(H.inBase(h)){const item=H.recommend(h);if(item!==undefined&&h.gold>=H.items[item].price)input.buy=item;if(h.hp<h.maxHp*.94||h.mana<h.maxMana*.7){b.input=input;return input;}b.mode='lane';}
    if(h.hp/h.maxHp<d.retreat||h.mana<20&&h.hp<h.maxHp*.6)b.mode='retreat';
    if(b.mode==='retreat'){
      if(!hostiles.length&&g.time-(h.lastDamageAt||-100)>2&&!H.inBase(h)){if(!h.recall)input.recall=true;}else Object.assign(input,toward(g,h,H.map.fountains[h.team]));b.input=input;return input;
    }
    // Dodge only after the difficulty's reaction delay. All decisions use currently visible hazards.
    const danger=g.effects.find(e=>!e.done&&e.team!==h.team&&e.shape!=='shot'&&e.at-g.time>d.react*.3&&g.time-e.start>d.react&&H.inEffect(e,h,2)&&H.visible(g,h.team,g.byId[e.source]||e));
    if(danger&&g.random()<d.dodge){
      let dx=h.x-danger.x,dy=h.y-danger.y;
      const home=H.map.fountains[h.team];
      if(danger.shape==='line'){
        dx=-danger.dy;dy=danger.dx;let side=dx*(h.x-danger.ox)+dy*(h.y-danger.oy);
        if(Math.abs(side)<1e-7)side=dx*(home.x-h.x)+dy*(home.y-h.y);
        if(Math.abs(side)<1e-7)side=h.team===0?1:-1;
        if(side<0){dx=-dx;dy=-dy;}
      }else if(Math.hypot(dx,dy)<1){
        const caster=g.byId[danger.source];dx=caster?h.x-caster.x:0;dy=caster?h.y-caster.y:0;
        if(Math.hypot(dx,dy)<1){dx=home.x-h.x;dy=home.y-h.y;}
        if(Math.hypot(dx,dy)<1){dx=h.team===0?-1:1;dy=-dx;}
      }
      const length=Math.hypot(dx,dy)||1;Object.assign(input,toward(g,h,{x:h.x+dx/length*12,y:h.y+dy/length*12}));b.input=input;return input;
    }
    let goal=null;const ownCastle=g.castles[h.team],underSiege=ownCastle.giant||g.heroes.some(a=>a.team!==h.team&&a.alive&&H.visible(g,h.team,a)&&H.dist(a,base)<38);
    if(underSiege&&H.near(g,base,42).some(e=>e.team===1-h.team))goal={x:base.x+(h.team?-16:16),y:base.y+(h.team?16:-16)};
    // A nearby available bot covers a tower under visible hero pressure; the others keep their lane jobs.
    const rallyPlayer=g.byId[g.playerId],called=!g.watch&&h.team===0&&h.id!==g.playerId&&g.rallyUntil>g.time&&rallyPlayer?.alive&&H.dist(h,rallyPlayer)<65&&h.hp>h.maxHp*.4;
    if(!goal&&level>0&&!called){
      const threatened=g.towers.filter(t=>t.alive&&t.team===h.team&&g.time-(t.lastDamageAt??-100)<3&&H.near(g,t,t.range+3).some(e=>e.kind==='hero'&&e.team===1-h.team&&H.visible(g,h.team,e))).sort((a,b)=>H.dist(h,a)-H.dist(h,b)||a.id-b.id);
      for(const t of threatened){
        const defender=g.heroes.filter(a=>a.team===h.team&&a.alive&&a.bot&&(g.watch||a.id!==g.playerId)&&a.hp>a.maxHp*.5&&!a.recall&&a.brain.mode!=='retreat'&&H.dist(a,t)<60).sort((a,b)=>H.dist(a,t)-H.dist(b,t)||a.id-b.id)[0];
        if(defender===h){goal={x:t.x,y:t.y};break;}
      }
    }
    if(!goal&&!g.watch&&h.team===0&&h.id!==g.playerId){
      const p=g.byId[g.playerId];
      if(p&&p.alive){
        const fighting=p.input.attack||(p.input.skills||[]).some(Boolean)||g.time-(p.lastDamageAt??-100)<2;
        const nearby=H.near(g,p,25),outnumbered=nearby.filter(e=>e.team!==p.team&&e.kind==='hero'&&H.visible(g,h.team,e)).length>nearby.filter(e=>e.team===p.team&&e.kind==='hero').length;
        const towerDanger=g.towers.some(t=>t.alive&&t.team!==p.team&&H.dist(t,p)<t.range+2);
        const rally=g.rallyUntil>g.time;
        const helper=g.heroes.filter(a=>a.team===p.team&&a.id!==p.id&&a.alive&&a.hp>a.maxHp*.4&&!a.recall&&a.brain.mode!=='retreat'&&H.dist(p,a)<48).sort((a,b)=>H.dist(p,a)-H.dist(p,b)||a.id-b.id)[0];
        const help=fighting&&(towerDanger||outnumbered)&&helper===h;
        if((rally||help)&&H.dist(p,h)<(rally?65:48)&&h.hp>h.maxHp*.4){goal={x:p.x+(h.roleIndex-2)*2,y:p.y+2};h.supportUntil=g.time+1;}
      }
    }
    const boss=g.camps.find(e=>e.kind==='boss'&&e.alive&&(e.type==='ancient'||g.time<550));
    if(!goal&&boss&&(g.time%110<40||boss.hp<boss.maxHp*.9)&&h.hp>h.maxHp*.6&&level!==0){const friends=g.heroes.filter(a=>a.team===h.team&&a.alive&&H.dist(a,boss)<55);if(friends.length>=2||h.lane===-1)goal=boss;}
    if(!goal&&h.lane===-1&&g.time<420){const offset=h.team*4,camp=g.camps[offset+b.camp%4];if(camp.alive)goal=camp;else{b.camp=(b.camp+1)%4;goal=g.camps[offset+b.camp];}if(g.time%90>65)goal=null;}
    let lane=h.lane<0?1:h.lane;if(g.time>(level===2?270:450)&&level!==0){const lanes=[0,1,2].map(l=>({l,hp:g.towers.filter(t=>t.team!==h.team&&t.lane===l&&t.alive).reduce((n,t)=>n+t.hp,0)})).sort((a,b)=>a.hp-b.hp||a.l-b.l);lane=lanes[0].l;}
    if(!goal){const ts=g.towers.filter(t=>t.team!==h.team&&t.lane===lane&&t.alive).sort((a,b)=>Number(a.inner)-Number(b.inner)),objective=ts[0]||g.castles[1-h.team];let progress=H.laneProgress(h,lane),op=H.laneProgress(objective,lane);const desired=H.lanePoint(lane,H.clamp(progress+(h.team?-1:1)*.07,Math.min(op,progress),Math.max(op,progress)));goal=objective.kind==='castle'||H.dist(h,objective)<35?objective:desired;}
    let targets=enemies.filter(e=>H.dist(h,e)<s.range+10);
    if(goal&&(goal.kind==='camp'||goal.kind==='boss')&&H.dist(h,goal)<27)targets.push(goal);
    targets.sort((a,b)=>{const score=e=>(e.kind==='hero'?(level===2?(e.hp/e.maxHp<.7?-12:-3):3):0)+(e.kind==='tower'||e.kind==='castle'?8:0)+H.dist(h,e)*.4+(e.kind==='minion'&&e.hp<s.attack*(level===0?.6:level===2?1.5:1.1)?-16:0);return score(a)-score(b);});
    let target=targets[0];
    const tower=enemies.find(e=>e.kind==='tower'&&H.dist(e,h)<e.range+4),cover=tower&&H.near(g,tower,tower.range).some(e=>e.team===h.team&&e.kind==='minion');
    if(tower&&!cover&&h.hp<h.maxHp*.8){const dx=h.x-tower.x,dy=h.y-tower.y;goal={x:h.x+dx,y:h.y+dy};target=null;}
    if(hostiles.length>allies.length+1&&level>0&&h.hp<h.maxHp*.7){goal=base;target=null;}
    if(target){const dx=target.x-h.x,dy=target.y-h.y,dist=Math.hypot(dx,dy)||1;
      // Face through movement. Q is used to cycle the same ranked target list as a human.
      if(dist>s.range+target.radius-.4)Object.assign(input,toward(g,h,target));else if(s.range>10&&target.kind==='hero'&&dist<s.range*.6)Object.assign(input,toward(g,h,{x:h.x-dx,y:h.y-dy}));else if((dx*h.fx+dy*h.fy)/dist<.8){input.x=dx/dist;input.y=dy/dist;}
      input.attack=true;if(h.target!==target.id&&!h.prevInput.cycle)input.cycle=true;
      for(let i=0;i<4;i++){const sk=H.heroes[h.hero].skills[i];if(!H.skillRanks(h.level)[i]||h.skills[i]>.01||h.mana<sk.cost)continue;let useful=dist<sk.range+sk.radius+2||sk.range===0&&dist<sk.radius+2;if(sk.shape==='heal')useful=g.heroes.some(a=>a.team===h.team&&a.alive&&H.dist(a,h)<18&&a.hp<a.maxHp*.72);if(sk.guard)useful=hostiles.length>0;if(sk.stealth)useful=h.hp<h.maxHp*.55;if(sk.dash<0)useful=dist<9;if(sk.shield||sk.haste)useful=hostiles.length>0;if(sk.siege)useful=dist>10&&dist<s.range+7;if(i===3&&target.kind==='minion')useful=targets.length>=4;if(useful&&g.random()<d.skills){input.skills[i]=true;break;}}
    }else Object.assign(input,toward(g,h,goal||enemyBase));
    // Opportunistic shopping when carrying enough gold; recall still channels for eight seconds.
    if(!target&&!hostiles.length&&h.gold>1000&&g.time>70&&g.time%65<8&&H.recommend(h)!==undefined){input.x=0;input.y=0;input.recall=!h.recall;}
    b.mode='lane';b.input=input;return input;
  };
  H.botInput=(g,h)=>{const raw=H.decideInput(g,h);return {...H.inputFromKeys(H.keysFromInput(raw)),buy:raw.buy};};
  // A deliberately literal first-time player: one assigned lane, held J, no teamfight or objective planning.
  H.noviceInput=(g,h)=>{
    const b=h.brain,input=H.emptyInput(),s=H.stats(g,h),home=H.map.fountains[h.team];
    if(g.time<(b.noviceNext||0)){const old=b.noviceInput||input;return {...old,skills:[false,false,false,false],recall:false,buy:undefined};}
    b.noviceNext=g.time+.55;
    const finish=()=>{b.noviceInput=input;return {...H.inputFromKeys(H.keysFromInput(input)),buy:input.buy};};
    if(!h.alive)return finish();
    const item=H.recommend(h),canBuy=item!==undefined&&h.inventory.length<6&&h.gold>=H.items[item].price;
    if(H.inBase(h)){
      b.noviceReturn=false;if(canBuy)input.buy=item;
      if(h.hp<h.maxHp*.95||h.mana<h.maxMana*.85||canBuy)return finish();
    }else if(h.hp<h.maxHp*.3||canBuy&&g.time>45)b.noviceReturn=true;
    if(b.noviceReturn){
      const close=H.near(g,h,20).some(e=>e.team!==h.team&&e.team>=0&&H.visible(g,h.team,e));
      if(close||g.time-(h.lastDamageAt??-100)<2)Object.assign(input,toward(g,h,home));
      else input.recall=!h.recall;
      return finish();
    }
    const danger=g.effects.find(e=>!e.done&&e.team!==h.team&&e.shape!=='shot'&&e.at>g.time&&g.time-e.start>.55&&H.inEffect(e,h,2)&&H.visible(g,h.team,g.byId[e.source]||e));
    if(danger){
      if(b.noviceDanger!==danger){b.noviceDanger=danger;b.noviceDodge=g.random()<.5;}
      if(b.noviceDodge){
        let dx=h.x-danger.x,dy=h.y-danger.y;
        if(danger.shape==='line'){dx=-danger.dy;dy=danger.dx;if(dx*(home.x-h.x)+dy*(home.y-h.y)<0){dx=-dx;dy=-dy;}}
        if(Math.hypot(dx,dy)<1){dx=home.x-h.x;dy=home.y-h.y;}
        const len=Math.hypot(dx,dy)||1;Object.assign(input,toward(g,h,{x:h.x+dx/len*10,y:h.y+dy/len*10}));input.attack=true;return finish();
      }
    }
    input.attack=true;
    // Read the same reticle a keyboard player sees. No Q optimization or last-hit timing.
    const target=H.selectTarget(g,h,input),lane=h.lane<0?1:h.lane;
    const ts=g.towers.filter(t=>t.team!==h.team&&t.lane===lane&&t.alive).sort((a,b)=>Number(a.inner)-Number(b.inner));
    const objective=ts[0]||g.castles[1-h.team],progress=H.laneProgress(h,lane),op=H.laneProgress(objective,lane);
    const goal=objective.kind==='castle'||H.dist(h,objective)<30?objective:H.lanePoint(lane,H.clamp(progress+(h.team?-1:1)*.05,Math.min(op,progress),Math.max(op,progress)));
    if(!target||H.dist(h,target)>s.range+target.radius+1.5)Object.assign(input,toward(g,h,goal));
    if(target)for(let i=0;i<4;i++){
      const sk=H.heroes[h.hero].skills[i];if(H.skillRanks(h.level)[i]&&h.skills[i]<=.01&&h.mana>=sk.cost&&!h.prevInput.skills?.[i])input.skills[i]=true;
    }
    return finish();
  };
  H.proxyInput=(g,h)=>H.botInput(g,h); // Public controller, normal reactions; usable through the key adapter below.
  H.keysFromInput=i=>{const k={};if(i.x>.3826)k.KeyD=true;if(i.x<-.3826)k.KeyA=true;if(i.y>.3826)k.KeyS=true;if(i.y<-.3826)k.KeyW=true;if(i.attack)k.KeyJ=true;(i.skills||[]).forEach((v,n)=>{if(v)k[['KeyU','KeyI','KeyO','Space'][n]]=true;});if(i.cycle)k.KeyQ=true;if(i.heroesOnly)k.ShiftLeft=true;if(i.recall)k.KeyB=true;if(i.rally)k.KeyG=true;return k;};
})(globalThis.HONJIN);
