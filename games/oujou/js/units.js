(function(H){
  'use strict';
  H.spawnWave=g=>{
    g.wave++;let count=g.entities.filter(e=>e.kind==='minion'&&e.alive).length;const growth=1+g.time/700+Math.pow(Math.max(0,Math.floor((g.time-1200)/60)+1),1.6)*1.5;
    for(let k=0;k<8;k++)for(let offset=0;offset<3;offset++)for(let teamOrder=0;teamOrder<2;teamOrder++){
      const lane=(offset+g.wave)%3,team=(teamOrder+g.wave)%2;
      const heavy=g.towers.some(t=>t.team!==team&&t.lane===lane&&t.inner&&!t.alive);if(k===6&&g.wave%3!==0||k===7&&!heavy||count>=80)continue;
      const p=H.lanePoint(lane,team?.98:.02),type=k<3?'sword':k<6?'bow':k===6?'siege':'heavy';
      H.add(g,{kind:'minion',team,lane,type,x:p.x+(team?(k%2-.5)*1.8:(k%3-1)*1.5),y:p.y+(team?(k%3-1)*1.5:(k%2-.5)*1.8),hp:(type==='heavy'?650:type==='siege'?500:type==='sword'?265:175)*growth,attack:(type==='heavy'?38:type==='siege'?52:type==='sword'?21:18)*growth,range:type==='bow'?13:type==='siege'?19:3,interval:type==='siege'?2:1.3,speed:(type==='heavy'?8.5:9)*(1+Math.min(1,Math.max(0,Math.floor((g.time-1200)/60)+1)*.12)),spawned:g.time,radius:type==='siege'?1.5: .8});count++;
    }g.metrics.maxMinions=Math.max(g.metrics.maxMinions,count);
  };
  H.unitShot=(g,u,t,damage)=>{H.event(g,'bolt',{source:u.id,target:t.id,x:u.x,y:u.y,tx:t.x,ty:t.y,team:u.team});H.hurt(g,u,t,damage);};
  H.telegraph=(g,u,shape,x,y,dx,dy,range,radius,damage,delay,data={})=>{g.effects.push({id:++g.nextId,kind:'boss',source:u.id,team:u.team,shape,x,y,ox:x,oy:y,dx,dy,range,radius,damage,start:g.time,at:g.time+delay,end:g.time+delay+.55,data,done:false});};
  H.updateUnits=(g,dt)=>{
    const units=g.tick%2?g.entities:g.entities.slice().reverse();
    for(const u of units){if(!u.alive){if((u.kind==='camp'||u.kind==='boss')&&g.time>=u.spawnAt){u.alive=true;u.hp=u.maxHp;u.x=u.homeX;u.y=u.homeY;u.nextSkill=g.time+3;if(u.kind==='boss')H.event(g,'notice',{text:u.name+'が川に現れた'});}continue;}
      if(u.kind==='hero')continue;
      if(u.kind==='minion'){
        if(u.stunUntil>g.time)continue;
        const enemies=H.near(g,u,23).filter(e=>e.team===1-u.team&&H.vulnerable(g,e)&&H.visible(g,u.team,e));enemies.sort((a,b)=>(g.time>=1200?(['tower','castle'].includes(a.kind)?-30:0)-(['tower','castle'].includes(b.kind)?-30:0):0)+H.dist(u,a)-H.dist(u,b));const target=enemies[0];
        const attacking=target&&H.dist(u,target)<=u.range+target.radius;
        if(attacking){if(u.cooldown<=0){let damage=u.attack;if(target.kind==='tower'||target.kind==='castle')damage*=(u.type==='siege'?2.1:1.1)*(1+Math.max(0,Math.floor((g.time-1200)/60)+1)*2.5);if(g.teams[u.team].ancientUntil>g.time&&['tower','castle'].includes(target.kind))damage*=1.8;H.unitShot(g,u,target,damage);u.cooldown=u.interval;}}
        // At night the army fires while marching: unit duels cannot pin entire waves forever.
        if(!attacking||g.time>=1200&&!['tower','castle'].includes(target.kind)){const progress=H.laneProgress(u,u.lane),waypoint=H.lanePoint(u.lane,progress+(u.team?-1:1)*.035),p=g.time>=1200?waypoint:target||waypoint;H.move(g,u,p.x-u.x,p.y-u.y,u.speed,dt);}
        if(g.time-u.spawned>115){u.alive=false;u.diedAt=g.time;} // Keeps old stragglers from filling the finite army budget.
      }else if(u.kind==='tower'){
        let target=g.byId[u.focus];if(!target||!target.alive||H.dist(u,target)>u.range||!H.visible(g,u.team,target)){target=null;u.focus=null;u.stack=0;u.charge=0;}
        if(!target||!(u.aggroUntil>g.time)&&target.kind!=='minion'){const choices=H.near(g,u,u.range).filter(e=>e.team===1-u.team&&['hero','minion'].includes(e.kind)&&H.visible(g,u.team,e));choices.sort((a,b)=>(a.kind==='minion'?0:1)-(b.kind==='minion'?0:1)||H.dist(u,a)-H.dist(u,b));if(choices[0]&&choices[0].id!==u.focus){target=choices[0];u.focus=target.id;u.stack=0;u.charge=0;}}
        if(target&&u.cooldown<=0){if(!u.charge){u.charge=g.time+.7;H.event(g,'towerAim',{source:u.id,target:target.id});}else if(g.time>=u.charge){H.unitShot(g,u,target,target.kind==='hero'?130*(1+Math.min(5,u.stack)*.28):145);u.stack=target.kind==='hero'?u.stack+1:0;u.cooldown=1.1;u.charge=0;}}
      }else if(u.kind==='castle'){
        for(const e of H.near(g,H.map.fountains[u.team],8).sort((a,b)=>H.dist(a,H.map.fountains[u.team])-H.dist(b,H.map.fountains[u.team])))if(e.team===1-u.team&&e.alive&&u.cooldown<=0){H.unitShot(g,u,e,350);u.cooldown=.5;}
        if(!u.giant)continue;
        if(g.time>=u.nextSkill){const targets=H.near(g,u,38).filter(e=>e.team===1-u.team&&e.alive).sort((a,b)=>H.dist(u,a)-H.dist(u,b)||a.id-b.id);if(targets.length){const target=targets.find(e=>e.kind==='hero')||targets[0],d=H.dist(u,target)||1,dx=(target.x-u.x)/d,dy=(target.y-u.y)/d;
          if(u.phase%3===0){for(const t of targets.slice(0,6))H.telegraph(g,u,'circle',t.x,t.y,0,1,0,5.5,210,1.5);}
          else if(u.phase%3===1)H.telegraph(g,u,'cone',u.x,u.y,dx,dy,28,1,240,1.4);
          else H.telegraph(g,u,'circle',u.x,u.y,0,1,0,18,180,1.2,{knock:10});u.phase++;u.nextSkill=g.time+5;
        }}
      }else if(u.kind==='camp'||u.kind==='boss'){
        let target=g.byId[u.lastSource];if(!target||!target.alive||H.dist(u,target)>32)target=null;
        if(!target||H.dist(u,{x:u.homeX,y:u.homeY})>24){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.12*dt);H.move(g,u,u.homeX-u.x,u.homeY-u.y,7,dt);if(H.dist(u,{x:u.homeX,y:u.homeY})<2)u.lastSource=null;continue;}
        if(H.dist(u,target)>u.range+target.radius)H.move(g,u,target.x-u.x,target.y-u.y,6,dt);else if(u.cooldown<=0){H.unitShot(g,u,target,u.kind==='boss'?100:45);u.cooldown=1.4;}
        if(u.kind==='boss'&&g.time>=u.nextSkill){const d=H.dist(u,target)||1,dx=(target.x-u.x)/d,dy=(target.y-u.y)/d;if(u.phase%3===0)H.telegraph(g,u,'cone',u.x,u.y,dx,dy,23,.65,185,1.4);else if(u.phase%3===1)H.telegraph(g,u,'cone',u.x,u.y,-dx,-dy,16,2,135,1.1,{knock:6});else H.telegraph(g,u,'circle',target.x,target.y,dx,dy,0,9,205,1.6,{leap:true});u.phase++;u.nextSkill=g.time+4.5;}
      }
    }
  };
})(globalThis.HONJIN);
