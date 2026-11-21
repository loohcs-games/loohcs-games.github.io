/* 訓練隊員の知覚・経路・戦術。見えていない敵の座標は判断に使わない。 */
(function (root) {
  'use strict';
  const K = root.KJ || require('./data.js');
  const look = (p, at, dt, rate) => { p.yaw = K.angle(p.yaw + K.angle(Math.atan2(at.x-p.x,-(at.z-p.z))-p.yaw)*Math.min(1,dt*(rate || 6))); };
  const aliveTeam = (m,p) => m.players.filter(a=>a.alive&&a.team===p.team);
  function stop(p) { p.moving=false;p.speed=0;p.vx=0;p.vz=0;p.goal=null; }
  function navigate(m,p,goal,dt,speed,aim) {
    // 不正な目標を近傍の歩行可能点に直す。装置には別途LOS付き接近点を使う。
    let safe=goal;
    if(!K.map.free(goal.x,goal.z,goal.y || 0,.36,1.8))safe=K.map.nearest(goal);
    speed*=K.weapons[p.weapon].speed*(p.crouch?.48:p.walk?.64:1)*(p.flash>1?.65:1);
    p.goal={x:safe.x,z:safe.z};
    if(!p.route||!p.routeGoal||K.dist(safe,p.routeGoal)>1.6||m.time>p.routeTime) {
      p.route=K.map.path(p,safe).slice();p.routeGoal={x:safe.x,z:safe.z};p.routeTime=m.time+3;
    }
    while(p.route.length&&K.dist(p,p.route[0])<.45)p.route.shift();
    // 最大二点までショートカット。箱の隅を切らず、実カプセル幅で検査。
    for(let i=Math.min(2,p.route.length-1);i>0;i--)if(K.map.walkLine(p,p.route[i],.38)){p.route.splice(0,i);break;}
    let target=p.route[0] || safe;
    if(K.dist(p,safe)<2.8&&K.map.walkLine(p,safe,.36))target=safe;
    const d=K.dist(p,target);
    if(d<.23){stop(p);return;}
    const dx=(target.x-p.x)/d,dz=(target.z-p.z)/d;
    if(!aim)look(p,target,dt,7);
    let multiplier=1;
    const next=p.route[1];
    if(next&&d<1.6) {
      const bend=Math.abs(K.angle(Math.atan2(next.x-target.x,-(next.z-target.z))-Math.atan2(dx,-dz)));
      if(bend>.7){multiplier=.62;p.clearing=true;if(!aim)look(p,next,dt,3);}
    }
    // 一人幅では後続が待ち、先頭は進む。真横にいる味方は分離処理へ。
    for(const a of m.players)if(a.alive&&a.id!==p.id) {
      const ax=a.x-p.x,az=a.z-p.z,along=ax*dx+az*dz,lateral=Math.abs(ax*dz-az*dx);
      if(along>.1&&along<.95&&lateral<.48&&a.id<p.id)multiplier=Math.min(multiplier,.35);
    }
    const x=p.x,z=p.z;
    K.map.drive(p,dx,dz,Math.min(speed*multiplier,d/Math.max(.035,dt)),dt);
    p.stuckFor=K.dist(p,{x,z})<.008?(p.stuckFor || 0)+dt:0;
    if(p.stuckFor>.65){p.route=null;p.routeTime=0;}
    if(p.stuckFor>1.6) {
      const side=p.id%2?1:-1;K.map.move(p,-dz*.7*dt*side,dx*.7*dt*side,0);
      p.stuckFor=1;
    }
  }
  function perceive(m,p) {
    let best=null,priority=Infinity;
    for(const e of m.players)if(e.alive&&e.team!==p.team) {
      const d=K.dist(p,e),angle=Math.abs(K.angle(Math.atan2(e.x-p.x,-(e.z-p.z))-p.yaw));
      if(d>40||angle>(d<2.3?Math.PI:1.08)||p.flash>.75||!K.map.sight(p,e,m.smokes))continue;
      const score=d*(e.interact>0?.55:1)*(p.target===e.id?.8:1);
      if(score<priority){best=e;priority=score;}
    }
    if(best) {
      const old=p.memory;
      p.memory={x:best.x,y:best.y,z:best.z,time:m.time,heard:false,id:best.id};
      m.spotted[p.team][best.id]={x:best.x,z:best.z,time:m.time};
      if(p.target!==best.id) {
        p.readyAt=m.time+Math.max(.28,p.skill.reaction*(.9+m.random()*.25));p.openingShot=true;p.target=best.id;p.burstLeft=p.skill.burst;
        p.engageUntil=m.time+1.4+m.random()*2.3;p.aimAt=0;
      }
      if(m.time-p.radioAt>8&&(!old||old.id!==best.id||m.time-old.time>2)) {m.radio(p,K.map.location(best)+' に敵、援護を');p.radioAt=m.time;}
    } else p.target=null;
    for(let i=m.noises.length-1;i>=0;i--) {
      const s=m.noises[i];if(s.team===p.team||s.time<=p.heardAt)continue;
      const distance=K.dist(p,s),occluded=!K.map.sight(p,s,[]),radius=s.radius*(occluded?.68:1);
      if(distance>radius)continue;
      if(s.kind==='device'){if(!p.defuseHeard||m.time-p.defuseHeard.time>2)p.heardReady=m.time+p.skill.reaction;p.defuseHeard={x:s.x,z:s.z,time:s.time};}
      if(!best) {
        // 音から得るのは発生時の概略位置。壁越しの追尾はしない。
        const error=s.kind==='device'?0:Math.min(2,distance*.06);
        p.memory={x:s.x+(m.random()-.5)*error,z:s.z+(m.random()-.5)*error,time:s.time,heard:true,kind:s.kind};
      }
      p.heardAt=s.time;break;
    }
    return best;
  }
  function clearShot(m,p,e) {
    const yaw=Math.atan2(e.x-p.x,-(e.z-p.z)),d=K.dist(p,e);
    return !m.players.some(a=> {
      if(!a.alive||a.id===p.id||a.team!==p.team)return false;
      const dx=a.x-p.x,dz=a.z-p.z,along=dx*Math.sin(yaw)-dz*Math.cos(yaw);
      return along>.1&&along<d&&Math.abs(dx*Math.cos(yaw)+dz*Math.sin(yaw))<.43;
    });
  }
  function utility(m,p,at,purpose) {
    if(m.time<p.grenadeAt||p.reloadEnd||p.interact>0)return false;
    const d=K.dist(p,at);if(d<5||d>24)return false;
    const allies=aliveTeam(m,p);
    let type=purpose==='screen'&&p.grenades.smoke?'smoke':purpose==='clear'&&p.grenades.flash?'flash':p.grenades.burst?'burst':null;
    if(!type)return false;
    if(type==='flash'&&allies.some(a=>a.id!==p.id&&K.dist(a,at)<7&&K.map.sight(a,at,[])))return false;
    const yaw=p.yaw,pitch=p.pitch;p.yaw=Math.atan2(at.x-p.x,-(at.z-p.z));p.pitch=K.clamp((d-11)*.03,-.25,.45);
    const ok=K.combat.throwGrenade(m,p,type);p.yaw=yaw;p.pitch=pitch;
    if(ok){p.grenadeAt=m.time+12+m.random()*7;m.radio(p,type==='smoke'?'煙で射線を切る':type==='flash'?'閃光、顔をそらして':'破裂球を投げる');}
    return ok;
  }
  function retreat(m,p,threat) {
    const cover=K.map.cover(p,threat,7);
    if(!cover)return false;
    p.retreat=cover;p.retreatUntil=m.time+1.2+m.random()*1.8;p.coverThreat={x:threat.x,z:threat.z};
    p.route=null;return true;
  }
  function fight(m,p,e,dt) {
    p.state='交戦';p.interact=0;p.goal=null;p.walk=false;
    const d=K.dist(p,e),w=K.weapons[p.weapon],a=p.gear[p.weapon];
    // 射撃原点と照準計算で同じ姿勢を使う。先に姿勢を決める。
    K.map.stance(p,d>13&&p.hp>35);
    if(w.scope)p.scope=d>24?2:d>7?1:0;
    if(m.time>=p.aimAt) {
      // 敵の位置は視認した瞬間だけ採取。更新間隔と追従速度は難易度で変える。
      p.aimPoint={x:e.x,y:e.y+(e.crouch?.82:1.13),z:e.z};
      if(m.random()<p.skill.head&&d<20&&!p.openingShot)p.aimPoint.y=e.y+(e.crouch?1.10:1.60);
      p.aimError=(m.random()-.5)*p.skill.error*2; if(p.openingShot)p.aimError+=(p.id%2?1:-1)*.018;p.aimVertical=(m.random()-.5)*p.skill.error;
      p.aimAt=m.time+p.skill.tracking;
    }
    const aim=p.aimPoint || e,yaw=Math.atan2(aim.x-p.x,-(aim.z-p.z));
    const pitch=Math.atan2((aim.y || 1.1)-(p.y+(p.crouch?1.04:1.58)),Math.max(.1,d));
    p.yaw=K.angle(p.yaw+K.angle(yaw+p.aimError-(p.recoilYaw || 0)*.8-p.yaw)*Math.min(1,dt*p.skill.turn));
    p.pitch+=(pitch+p.aimVertical-p.recoil*.9-p.pitch)*Math.min(1,dt*p.skill.turn);
    if(!a.ammo && !a.reserve) {
      const spare=Object.keys(p.gear).find(id=>id!==p.weapon&&id!=='baton'&&p.gear[id].ammo>0);
      if(spare){K.combat.equip(p,spare);return;}
      K.combat.equip(p,'baton');return;
    }
    if(!a.ammo || a.ammo<w.mag*.16&&d>15)K.combat.reload(m,p);
    // 露出し続けず短い交戦ごとに遮蔽へ。見えない敵数を退避判断に使わない。
    const pressure=m.time-p.hurtAt<.65,post=m.device.planted&&p.side==='attack';
    if((p.reloadEnd||pressure&&p.hp<48||m.time>p.engageUntil&&(post||d>11))&&m.time>(p.nextRetreat || 0)) {
      p.nextRetreat=m.time+3;
      if(retreat(m,p,e)){K.map.stance(p,false);p.state='遮蔽へ';navigate(m,p,p.retreat,dt,4.4,true);return;}
      p.engageUntil=m.time+2;
    }
    if(!clearShot(m,p,e)) {
      p.state='射線をあける';K.map.stance(p,false);
      const side=p.id%2?1:-1;K.map.drive(p,Math.cos(yaw)*side,Math.sin(yaw)*side,2.4,dt);return;
    }
    if(p.weapon==='baton'&&d>1.7){navigate(m,p,e,dt,5.5,true);return;}
    if(d<7&&m.time>p.burstAt){K.map.stance(p,false);const side=Math.sin(m.time*1.5+p.id)>0?1:-1;K.map.drive(p,Math.cos(yaw)*side,Math.sin(yaw)*side,1.4,dt);}
    else {stop(p);K.map.stance(p,d>13&&p.hp>35);}
    if(m.time>=p.readyAt&&m.time>=p.burstAt&&p.flash<.75&&Math.abs(K.angle(yaw-p.yaw))<.16) {
      if(K.combat.shoot(m,p)) {
        p.openingShot=false; p.burstLeft--;
        if(p.burstLeft<=0) {p.burstLeft=d>23?2:d>9?p.skill.burst:9;p.burstAt=m.time+(d>23?p.skill.pause*1.4:p.skill.pause);}
      }
    }
    if(d>10&&p.hp>30)utility(m,p,e,p.reloadEnd?'screen':'clear');
  }
  function hold(m,p,goal,aim,dt,state) {
    p.state=state;
    if(K.dist(p,goal)>.6)navigate(m,p,goal,dt,3.8);
    else {stop(p);const recent=p.memory&&m.time-p.memory.time<3?p.memory:null;look(p,recent || aim || {x:p.x,z:p.z+(p.side==='defend'?12:-12)},dt,recent?6:3);p.yaw=K.angle(p.yaw+Math.sin(m.time*.7+p.id)*dt*.17);}
  }
  function plantPoint(m,p) {
    const site=K.map.sites[m.plan.site];
    // 入口から最も近い安全な設置位置。箱の内側へ経路を引かない。
    if(p.plantGoal&&p.plantSite===site.id)return p.plantGoal;
    const candidates=K.map.nodes.filter(n=>K.dist(n,site)<site.r-.5&&n.y<.4);
    let best=candidates[0] || K.map.nearest(site),score=Infinity;
    for(const n of candidates) {
      const exposed=K.map.entrances.filter(e=>e.site===site.id&&K.map.sight(e,n,[])).length;
      const value=K.dist(p,n)+exposed*2;
      if(value<score){score=value;best=n;}
    }
    p.plantGoal=best;p.plantSite=site.id;return best;
  }
  function approachDevice(p,d) {
    if(K.map.free(d.x,d.z,d.y || 0,.36,1.8))return d;
    return K.map.nodes.filter(n=>K.dist(n,d)<2.1&&K.map.sight(n,{x:d.x,y:(d.y || 0)-.85,z:d.z},[])).sort((a,b)=>K.dist(p,a)-K.dist(p,b))[0] || K.map.nearest(d);
  }
  function postPosition(m,p) {
    if(p.postPlant)return p.postPlant;
    const d=m.device,positions=K.map.nodes.filter(n=>K.dist(n,d)>4&&K.dist(n,d)<10&&K.map.sight(n,{x:d.x,y:(d.y || 0)-.6,z:d.z},[]));
    const reserved=aliveTeam(m,p).filter(a=>a.id!==p.id&&a.postPlant).map(a=>a.postPlant);
    let best=null,score=Infinity;
    for(const n of positions) {
      const busy=reserved.some(a=>K.dist(a,n)<2.5),cover=K.map.boxes.some(b=>b.h>1&&b.y<1&&Math.hypot(b.x-n.x,b.z-n.z)<3);
      const value=K.dist(p,n)+(busy?12:0)+(cover?0:3)+(n.z<d.z?2:0);
      if(value<score){score=value;best=n;}
    }
    p.postPlant=best || K.map.nearest({x:d.x+(p.id%2?4:-4),z:d.z+5});return p.postPlant;
  }
  function defend(m,p,dt) {
    const d=m.device,allies=aliveTeam(m,p),slot=p.id%5;
    if(d.planted) {
      if(p.saving){p.state='装備を守る';navigate(m,p,K.map.spawns.defend,dt,4.7);return;}
      const need=p.kit?K.rules.kit:K.rules.defuse;
      // ルートの実距離と解除時間から間に合うか判断。逃げる時も装置の存在は公開情報。
      if(m.time>(p.feasibilityAt || 0)) {p.travelToDevice=K.map.routeLength(p,d)/4.3;p.feasibilityAt=m.time+1.5;}
      const enemyCount=m.players.filter(a=>a.alive&&a.team!==p.team).length;
      if((d.time<need+(p.travelToDevice || 0)-1.3 || allies.length===1&&enemyCount>=3&&K.dist(p,d)>11) && p.interact===0) {
        if(!p.saving){m.radio(p,'間に合わない、装備を持ち帰る');p.saving=true;}
        p.state='装備を守る';navigate(m,p,K.map.spawns.defend,dt,4.7);return;
      }
      if(d.defuser!=null&&m.players[d.defuser].alive&&m.players[d.defuser].interact>0)d.assigned=d.defuser;
      if(d.assigned==null||!m.players[d.assigned].alive||m.players[d.assigned].saving||!m.players[d.assigned].bot&&m.players[d.assigned].interact===0) {
        const candidates=allies.filter(a=>!a.saving&&(a.bot||a.interact>0)).sort((a,b)=>(K.map.routeLength(a,d)/4.2+(a.kit?4:7))-(K.map.routeLength(b,d)/4.2+(b.kit?4:7)));
        d.assigned=candidates.length?candidates[0].id:null;
      }
      if(d.assigned===p.id) {
        if(K.dist(p,d)<2.15&&K.map.sight(p,{x:d.x,z:d.z,y:(d.y || 0)-.85},[])&&m.time-p.hurtAt>.65) {
          stop(p);p.state='解除';p.interacting=true;
          p.yaw=Math.atan2(d.x-p.x,-(d.z-p.z));
          p.pitch=Math.atan2((d.y || 0)+.25-p.y-(p.crouch?1.04:1.58),Math.max(.001,K.dist(p,d)));
          if(!p.interact&&m.time>(p.workRadioAt || 0)){m.radio(p,'解除する、援護を');p.workRadioAt=m.time+5;}
          return;
        }
        p.state='解除へ';navigate(m,p,approachDevice(p,d),dt,4.5);
        if(K.dist(p,d)<14)utility(m,p,d,'screen');
      } else {
        const entry=K.map.entrances.filter(e=>e.site===d.site)[slot%3];
        const at=K.map.nearest({x:d.x+(slot%2?3:-3),z:d.z+(slot%3-1)*4});
        hold(m,p,at,entry,dt,'取り返しの援護');
      }
      return;
    }
    const assigned=(slot+m.defense.rotation)%5;
    const site=assigned===4?'mid':assigned%2?'B':'A';
    const positions=K.map.tactical.filter(t=>t.site===site&&['見張り','隠れ'].includes(t.tag));
    const home=positions[(Math.floor(assigned/2)+m.defense.depth)%positions.length];
    const reports=Object.values(m.spotted[p.team]).filter(s=>m.time-s.time<5);
    let goal=home,aim=K.map.entrances.find(e=>e.site===site&&e.id.endsWith('south')) || {x:0,z:5},state='見張り';
    // 中央の一人と近隣の一人が報告へ寄る。両サイトを無人にしない。
    if(reports.length&&(assigned===4||allies.length<3)) {
      const report=reports[reports.length-1];
      goal=K.map.nearest({x:report.x,z:report.z-5});aim=report;state='報告へ寄る';
    } else if(p.memory&&m.time-p.memory.time<p.skill.memory) {
      aim=p.memory;
      if(assigned===4&&m.elapsed>15){goal=K.map.nearest({x:p.memory.x,z:p.memory.z-3});state='音を確認';}
    }
    hold(m,p,goal,aim,dt,state);
  }
  function attack(m,p,dt) {
    const d=m.device,allies=aliveTeam(m,p),slot=p.id%5;
    if(d.planted) {
      if(d.time<3.5 && (!p.defuseHeard || m.time-p.defuseHeard.time>1.4)) {
        p.state='起爆から退避';
        if(K.dist(p,d)>12.5 || !K.map.sight(p,{x:d.x,y:d.y || 0,z:d.z},[])){stop(p);return;}
        if(!p.escapeGoal) {
          const exits=K.map.nodes.filter(n=>K.dist(n,d)>13&&K.dist(n,p)<14);
          const shortlist=exits.sort((a,b)=>K.dist(p,a)-K.dist(p,b)).slice(0,6).map(n=>({n,length:K.map.routeLength(p,n)})).sort((a,b)=>a.length-b.length);
          p.escapeGoal=shortlist.length?shortlist[0].n:K.map.spawns.attack;
        }
        navigate(m,p,p.escapeGoal,dt,5.1);return;
      }
      const goal=postPosition(m,p);
      if(p.defuseHeard&&m.time-p.defuseHeard.time<2.5) {
        p.state='解除を阻止';
        const heard=p.defuseHeard;
        if(!K.map.sight(p,{x:heard.x,z:heard.z,y:d.y || 0},[]))navigate(m,p,goal,dt,4.2);
        else {
          stop(p);look(p,heard,dt,p.skill.turn);
          const pitch=Math.atan2((d.y || 0)+1.0-(p.y+(p.crouch?1.04:1.58)),Math.max(.1,K.dist(p,heard)));
          p.pitch+=(pitch-p.recoil*.85-p.pitch)*Math.min(1,dt*p.skill.turn);
          // 解除音の発生点へ短く牽制。煙の向こうのロボット座標は参照しない。
          const yaw=Math.atan2(heard.x-p.x,-(heard.z-p.z));
          if(m.time>(p.heardReady || 0)&&m.time>p.burstAt&&Math.abs(K.angle(yaw-p.yaw))<.12&&clearShot(m,p,heard)) {
            if(K.combat.shoot(m,p)&&--p.burstLeft<=0){p.burstLeft=3;p.burstAt=m.time+.55;}
          }
        }
      } else hold(m,p,goal,d,dt,'装置を守る');
      return;
    }
    if(d.carrier===null) {
      // 壁の向こうへの直線距離で毎フレーム選ぶと、二人が担当を譲り合って往復してしまう。
      // 実際の経路長で一人を選び、回収か停止まで担当を保つ。
      if(d.retriever==null||!m.players[d.retriever].alive||m.players[d.retriever].side!=='attack'){
        const candidates=allies.filter(a=>a.bot).map(a=>({a,length:K.map.routeLength(a,approachDevice(a,d))})).sort((a,b)=>a.length-b.length||a.a.id-b.a.id);
        d.retriever=candidates.length?candidates[0].a.id:null;
      }
      if(d.retriever===p.id){p.state='装置を回収';navigate(m,p,approachDevice(p,d),dt,4.7);return;}
    }
    const carrier=d.carrier===null?null:m.players[d.carrier];
    if(carrier&&!carrier.bot&&p.id!==carrier.id) {
      const at=K.map.nearest({x:carrier.x+(slot%2?1.8:-1.8),z:carrier.z+1.8});hold(m,p,at,{x:carrier.x,z:carrier.z-8},dt,'装置を護衛');return;
    }
    if(p.order&&m.time<p.order.until&&d.carrier!==p.id) {
      const leader=m.players[0];
      if(p.order.kind==='hold'||leader.alive) {
        const at=p.order.kind==='follow'?K.map.nearest({x:leader.x+(slot%2?1.8:-1.8),z:leader.z+2}):K.map.nearest(p.order);
        hold(m,p,at,{x:leader.x+Math.sin(leader.yaw)*8,z:leader.z-Math.cos(leader.yaw)*8},dt,p.order.kind==='follow'?'同行':'指示の場所を守る');return;
      }
    }
    const fake=m.plan.kind==='feint'&&m.elapsed<m.plan.execute-7;
    const split=m.plan.split&&slot===1&&m.elapsed<m.plan.execute+9;
    const siteIndex=fake||split?1-m.plan.site:m.plan.site,site=K.map.sites[siteIndex];
    if(m.elapsed<m.plan.execute) {
      const staging=K.map.nearest({x:site.x+(slot%3-1)*2.2,z:3+Math.floor(slot/3)*2.5});
      p.walk=K.dist(p,staging)<5;
      hold(m,p,staging,{x:site.x,z:-8},dt,fake?'陽動':'入口を確認');
      if(m.elapsed>m.plan.execute-3&&slot===2)utility(m,p,{x:site.x,z:-8},'screen');
      if(m.elapsed>m.plan.execute-2&&slot===3)utility(m,p,{x:site.x,z:-8},'clear');
      return;
    }
    if(m.plan.middle&&p.z>-9&&!p.passedMiddle) {
      const goal={x:siteIndex?5:-6,z:-10};p.state='中央から進む';navigate(m,p,goal,dt,4.3);if(K.dist(p,goal)<2)p.passedMiddle=true;return;
    }
    if(d.carrier===p.id) {
      const at=plantPoint(m,p);
      if(K.dist(p,at)<.8&&K.map.siteAt(p)&&!p.reloadEnd) {stop(p);p.interacting=true;p.state='設置';return;}
      p.state='設置場所へ';navigate(m,p,at,dt,4.4);return;
    }
    const offset=slot%2?2.5:-2.5;
    const goal=K.map.nearest({x:site.x+offset,z:site.z+(slot%3===0?-5:3)});
    // 合流を先に選び、同じフレームに逆向きの二経路を進ませない。
    // 12mの境界で援護と合流を切り替え続けず、運搬役が拠点に着くまで同行する。
    if(carrier&&allies.length<3&&K.dist(p,carrier)>12)p.regroupCarrier=carrier.id;
    if(!carrier||allies.length>=3||K.dist(carrier,goal)<10)p.regroupCarrier=null;
    if(carrier&&p.regroupCarrier===carrier.id){
      p.state='仲間と合流';
      if(K.dist(p,carrier)>3)navigate(m,p,carrier,dt,4.5);else{stop(p);look(p,goal,dt,5);}
      return;
    }
    hold(m,p,goal,{x:site.x,z:-25},dt,split?'別口から進む':'設置を援護');
  }
  function tick(m,p,dt) {
    if(!p.alive)return;
    p.interacting=false;p.clearing=false;p.walk=false;K.map.stance(p,false);
    const human=m.players.find(a=>!a.bot&&a.alive&&a.team===p.team);
    if(human&&!p.interact&&K.dist(p,human)<2.5&&K.map.sight(p,human,[])){
      const dx=p.x-human.x,dz=p.z-human.z,along=dx*Math.sin(human.yaw)-dz*Math.cos(human.yaw),cross=dx*Math.cos(human.yaw)+dz*Math.sin(human.yaw);
      if(along>0&&along<2.2&&Math.abs(cross)<.65&&(human.moving||m.time-human.lastShot<.5)){
        const side=cross<0?-1:1, sx=Math.cos(human.yaw),sz=Math.sin(human.yaw);
        const direction=K.map.walkLine(p,{x:p.x+sx*side*.8,z:p.z+sz*side*.8,y:p.y},.33)?side:-side;
        p.state='道を譲る';K.map.drive(p,sx*direction,sz*direction,3.4,dt);return;
      }
    }
    if(m.time>=p.scanAt) {p.visible=perceive(m,p);p.scanAt=m.time+.12;}
    let enemy=p.visible;
    if(enemy&&(!enemy.alive||p.flash>.75||!K.map.sight(p,enemy,m.smokes))){enemy=null;p.visible=null;}
    // 退避は射線が切れた後にも短く続けて、毎フレーム飛び出す振動を防ぐ。
    if(p.retreat&&m.time<p.retreatUntil) {
      p.state='遮蔽へ';navigate(m,p,p.retreat,dt,4.5,true);look(p,p.coverThreat,dt,5);
      if(K.dist(p,p.retreat)<.7) {stop(p);p.state='遮蔽で待つ';if(p.gear[p.weapon].ammo<K.weapons[p.weapon].mag*.6)K.combat.reload(m,p);}
      return;
    }
    p.retreat=null;
    const device=m.device;
    const escorted=aliveTeam(m,p).some(a=>a.id!==p.id&&K.dist(a,p)<9);
    if(enemy&&device.carrier===p.id&&K.map.siteAt(p)&&K.dist(p,enemy)>6&&escorted&&m.time-p.hurtAt>.7)enemy=null;
    // 残り僅かな解除は続行するが、被弾は必ず中断（interactはdamageでリセット）。
    if(enemy&&!(p.side==='defend'&&device.planted&&p.interact>(p.kit?3.2:6.2)&&m.time-p.hurtAt>.65)) {
      fight(m,p,enemy,dt);return;
    }
    p.moving=false;p.goal=null;p.pitch*=Math.max(0,1-dt*5);p.scope=0;
    if(p.gear[p.weapon].ammo<K.weapons[p.weapon].mag*.4&&(!device.planted||p.side==='attack'||K.dist(p,device)>9))K.combat.reload(m,p);
    if(p.order&&m.time<p.order.until&&p.side==='defend'&&!device.planted) {
      const leader=m.players[0],at=p.order.kind==='follow'&&leader.alive?K.map.nearest({x:leader.x+(p.id%2?2:-2),z:leader.z+2}):K.map.nearest(p.order);
      hold(m,p,at,p.memory,dt,p.order.kind==='follow'?'同行':'指示の場所を守る');return;
    }
    if(p.side==='attack')attack(m,p,dt);else defend(m,p,dt);
    if(p.flash>1){p.state='閃光を避ける';p.walk=true;}
    // 無駄な自動追跡はしない。記憶の場所を確認したら失効する。
    if(p.memory&&m.time-p.memory.time>p.skill.memory)p.memory=null;
    if(p.memory&&m.time-p.memory.time<2.5&&!p.interacting)look(p,p.memory,dt,5);
  }
  K.bots={tick,navigate,perceive,fight,utility,plantPoint,postPosition};
  if(typeof module!=='undefined')module.exports=K.bots;
})(typeof globalThis!=='undefined'?globalThis:window);
