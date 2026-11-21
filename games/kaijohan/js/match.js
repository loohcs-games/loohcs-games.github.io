(function (root) {
  'use strict';
  const K = root.KJ || require('./data.js');
  if (typeof require !== 'undefined') { if(!K.map)require('./map.js'); if(!K.combat)require('./combat.js'); if(!K.bots)require('./bots.js'); }
  class Match {
    constructor(options) {
      this.options = Object.assign({ seed: Date.now(), side: 'defend', difficulty: 'normal', watch: false }, options);
      this.random = K.rng(this.options.seed); this.time = 0; this.round = 0; this.scores = [0, 0]; this.losses = [0, 0]; this.events = []; this.history = []; this.noises = []; this.radioLog = []; this.killLog = []; this.spotted = [{}, {}]; this.players = [];
      for (let id = 0; id < 10; id++) {
        const team = id < 5 ? 0 : 1;
        this.players.push({ id, name: id === 0 && !this.options.watch ? 'あなた' : ['コハク', 'ナギ', 'スイ', 'ハル', 'セツ', 'トワ', 'アオ', 'リン', 'カナメ', 'ユイ'][id], team, bot: id !== 0 || this.options.watch, skill: K.levels[team === 0 ? 'normal' : this.options.difficulty] || K.levels.normal, money: 800, kills: 0, deaths: 0, plants: 0, defuses: 0, assists: 0, damageDealt: 0, headshots: 0, mvps: 0, shots: 0, alive: false, gear: {} });
      }
      this.mvp = null; this.economy = ['eco','eco']; this.startRound();
    }
    emit(type, data) { this.events.push(Object.assign({ type, time: this.time }, data)); if (this.events.length > 180) this.events.splice(0, this.events.length - 180); if (type === 'kill') { this.killLog.push({ ...data, time: this.time }); if (this.killLog.length > 5) this.killLog.shift(); } }
    sound(p, kind, radius, at) { this.noises.push({ x: (at || p).x, z: (at || p).z, team: p.team, kind, radius, time: this.time }); }
    radio(p, message) { const entry = { team: p.team, name: p.name, message, time: this.time }; this.radioLog.push(entry); if (this.radioLog.length > 8) this.radioLog.shift(); this.emit('radio', entry); }
    teamSide(team) { const initial = team === 0 ? this.options.side : this.options.side === 'attack' ? 'defend' : 'attack'; return this.round > 6 ? (initial === 'attack' ? 'defend' : 'attack') : initial; }
    startRound() {
      this.round++; this.phase = 'buy'; this.phaseTime = K.rules.buy; this.elapsed = 0; this.result = null; this.smokes = []; this.grenades = []; this.drops = []; this.noises = []; this.spotted = [{}, {}];
      const choice=this.random(),kind=choice<.18?'rush':choice<.38?'split':choice<.55?'middle':choice<.73?'feint':choice<.89?'standard':'slow';
      const execute=kind==='rush'?10+this.random()*5:kind==='slow'?87+this.random()*14:kind==='feint'?43+this.random()*10:25+this.random()*16;
      this.plan={site:this.random()<.5?0:1,kind,split:kind==='split',middle:kind==='middle',execute,delay:execute};
      this.defense={rotation:Math.floor(this.random()*5),depth:Math.floor(this.random()*2)};
      if(this.round===7||this.round===13)this.losses=[0,0];
      this.roundPlantTime=null;
      // 装備を配る前の全員の資金からチーム共通の購入方針を決める。
      for(let team=0;team<2;team++) {
        const roster=this.players.filter(p=>p.team===team),budget=roster.map(p=>this.round===7?800:this.round===13?5000:p.money).sort((a,b)=>a-b);
        this.economy[team]=this.round===1||this.round===7?'pistol':budget[2]>=3600?'full':this.scores[1-team]===6||this.round===6||this.round===12||budget[2]>=2200?'force':'eco';
      }
      for (const p of this.players) {
        const keep = p.alive && this.round !== 7 && this.round !== 13;
        p.side = this.teamSide(p.team); if (this.round === 7) p.money = 800; if (this.round === 13) p.money = 5000;
        if (!keep) K.combat.resetGear(p);
        for (const g of Object.values(p.gear)) { g.ammo = K.weapons[g.id].mag; g.reserve = K.weapons[g.id].mag * 4; }
        const spawn = K.map.spawns[p.side], i = p.id % 5;
        Object.assign(p, { x: spawn.x + (i - 2) * 2.05, z: spawn.z + (i % 2 ? 1.25 : -1.25), y: 0, vy: 0, vx: 0, vz: 0, speed: 0, grounded: true, hp: 100, alive: true, yaw: p.side === 'attack' ? 0 : Math.PI, pitch: 0, crouch: false, walk: false, moving: false, flash: 0, cooldown: 0, switchEnd: 0, reloadEnd: 0, recoil: 0, recoilYaw: 0, chain: 0, scope: 0, lastShot: -10, hurtAt: -10, interact: 0, interacting: false, memory: null, defuseHeard: null, visible: null, target: null, route: null, goal: null, postPlant: null, routeGoal: null, state: '購入', scanAt: this.time + this.random() * .2, aimAt: 0, aimError: 0, aimVertical: 0, readyAt: 0, burstAt: 0, burstLeft: 4, heardAt: this.time, radioAt: -10, grenadeAt: this.time + 17, clock: this.time, footstepAt: 0, stuckFor: 0, order: null, contributors: {}, roundKills: 0, roundDamage: 0, roundPlants: 0, roundDefuses: 0, saving: false, retreat: null, nextRetreat: 0, plantGoal: null, plantSite: null, passedMiddle: false, regroupCarrier: null, feasibilityAt: 0, aimPoint: null, actionSoundAt: 0, workRadioAt: 0, pickupLatch: false, escapeGoal: null, triggerHeld:false, grenadePrimed:false, dryAt:0 });
        if (p.bot) K.combat.botBuy(this, p);
      }
      const attackers = this.players.filter(p => p.side === 'attack');
      const carrier = attackers[Math.floor(this.random() * attackers.length)];
      this.device = { carrier: carrier.id, x: carrier.x, y: carrier.y, z: carrier.z, planted: false, time: K.rules.fuse, site: null, defuser: null };
      this.radio(carrier, (this.economy[carrier.team]==='eco'?'今回は節約。':'') + (this.plan.kind==='feint'?'別口で音を立ててから、':this.plan.kind==='slow'?'様子を見てから、':'') + K.map.sites[this.plan.site].id+' へ進む');
      this.emit('round', { number: this.round, half: this.round === 7, overtime: this.round === 13 });
    }
    finish(side, reason) {
      if (this.phase !== 'live') return;
      const winner = this.players.find(p => p.side === side).team; this.scores[winner]++;
      for (let t = 0; t < 2; t++) { if (t === winner) this.losses[t] = 0; else this.losses[t] = Math.min(5, this.losses[t] + 1); }
      for (const p of this.players) p.money = Math.min(K.rules.cap, p.money + (p.team === winner ? 3250 : 1400 + (this.losses[p.team] - 1) * 500));
      const candidates=this.players.filter(p=>p.team===winner).slice().sort((a,b)=>(b.roundDefuses*7+b.roundPlants*4+b.roundKills*3+b.roundDamage/120)-(a.roundDefuses*7+a.roundPlants*4+a.roundKills*3+a.roundDamage/120));
      const mvp=candidates[0];mvp.mvps++;
      this.mvp=this.players.slice().sort((a,b)=>(b.mvps*4+b.kills*2+b.assists+b.defuses*3+b.plants*2)-(a.mvps*4+a.kills*2+a.assists+a.defuses*3+a.plants*2))[0].id;
      this.result = { winner, side, reason, round: this.round, duration:this.elapsed, planted:this.device.planted, plantTime:this.roundPlantTime, mvp:mvp.id, economy:this.economy.slice(), strategy:this.plan.kind };
      this.emit('mvp',{actor:mvp.id}); this.history.push(this.result); this.phase = 'result'; this.phaseTime = 4.5; this.emit('roundEnd', this.result);
    }
    command(kind) {
      const leader = this.players[0];
      for (const p of this.players) if (p.team === leader.team && p.bot) p.order = { kind, x: leader.x + (p.id % 2 ? 2 : -2), z: leader.z, until: this.time + 15 };
      this.radio(leader, kind === 'follow' ? 'ついて来て' : 'ここを守って');
    }
    dropDevice(p, recipient) {
      if(!p || !p.alive || this.device.carrier!==p.id || this.device.planted || !['live','buy'].includes(this.phase))return false;
      if(recipient)return this.transferDevice(p,recipient);
      Object.assign(this.device,{carrier:null,retriever:null,x:p.x,y:p.y,z:p.z,pickupAfter:this.time+.7,lastCarrier:p.id});
      p.interact=0;this.emit('deviceDrop',{actor:p.id,x:p.x,y:p.y,z:p.z});this.radio(p,'装置を渡す、受け取って');return true;
    }
    transferDevice(from,to) {
      if(!['buy','live'].includes(this.phase)||!from||!to||from.id===to.id||!from.alive||!to.alive||from.side!=='attack'||to.team!==from.team||this.device.carrier!==from.id||this.device.planted||K.dist(from,to)>2.5||!K.map.sight(from,to,[]))return false;
      this.device.carrier=to.id;from.interact=0;this.emit('devicePass',{actor:from.id,target:to.id});return true;
    }
    playerInput(p, input, dt) {
      input=input || {};K.map.stance(p,!!input.crouch);p.walk=!!input.walk;
      if(Number.isFinite(input.yaw))p.yaw=K.angle(input.yaw);
      if(Number.isFinite(input.pitch))p.pitch=K.clamp(input.pitch,-1.45,1.45);
      if(input.reload)K.combat.reload(this,p);
      if(this.phase!=='live')return;
      if(input.dropDevice)this.dropDevice(p);
      if(input.jump&&p.grounded){p.vy=K.rules.jump;p.grounded=false;}
      const f=K.clamp(input.forward || 0,-1,1),r=K.clamp(input.right || 0,-1,1),l=Math.max(1,Math.hypot(f,r));
      const speed=K.rules.speed*K.weapons[p.weapon].speed*(p.crouch?.48:p.walk?.55:p.scope?.62:1);
      K.map.drive(p,(Math.sin(p.yaw)*f+Math.cos(p.yaw)*r)/l,(-Math.cos(p.yaw)*f+Math.sin(p.yaw)*r)/l,speed,dt);
      p.interacting=!!input.use;if(input.use)p.scope=0;
      const pressed=!!input.firePressed || !!input.fire&&!p.triggerHeld, weapon=K.weapons[p.weapon];
      if(input.slot===4&&!input.use){
        if(input.fire || input.firePressed)p.grenadePrimed=true;
        if((p.grenadePrimed&&!input.fire || input.throwRelease)&&K.combat.throwGrenade(this,p,p.selectedGrenade))p.grenadePrimed=false;
      } else {
        p.grenadePrimed=false;
        if(!input.use&&input.slot!==5&&(weapon.automatic?input.fire||pressed:pressed))K.combat.shoot(this,p);
        const gear=p.gear[p.weapon];
        if(!input.use&&input.slot!==5&&p.weapon!=='baton'&&!gear.ammo&&gear.reserve&&p.cooldown<=0)K.combat.reload(this,p);
      }
      p.triggerHeld=!!input.fire;
    }
    lookingAtDevice(p) {
      const d=this.device, dx=d.x-p.x, dz=d.z-p.z, dy=(d.y || 0)+.25-p.y-(p.crouch?1.04:1.58);
      const length=Math.hypot(dx,dy,dz), cp=Math.cos(p.pitch);
      return length<.01 || (dx*Math.sin(p.yaw)*cp+dy*Math.sin(p.pitch)-dz*Math.cos(p.yaw)*cp)/length>Math.cos(.8);
    }
    interactions(p, dt) {
      const d = this.device;
      if (!p.alive || this.phase!=='live') return;
      if(!p.interacting)p.pickupLatch=false;
      if (!d.planted && d.carrier === null && p.side === 'attack' && K.dist(p, d) < 1.4 && (d.lastCarrier!==p.id || this.time >= (d.pickupAfter || 0)) && Math.abs(p.y-(d.y || 0))<1.5 && K.map.sight(p,{x:d.x,z:d.z,y:(d.y || 0)-.85},[])) { d.carrier = p.id; d.retriever=null; this.radio(p, '装置を回収した'); }
      if (d.carrier === p.id) { d.x = p.x; d.y=p.y; d.z = p.z; }
      let valid = false;
      if (p.interacting && !p.moving && p.grounded && !p.reloadEnd && this.time-p.hurtAt>.65) {
        const site = K.map.siteAt(p);
        if (p.side === 'attack' && d.carrier === p.id && !d.planted && site) {
          valid = true; p.interact += dt;
          if (p.interact >= K.rules.plant) {
            d.planted = true; d.planter=p.id; d.carrier = null; d.x = p.x; d.y=p.y; d.z = p.z; d.site = site.id; d.time = K.rules.fuse; p.plants++; p.roundPlants++; this.roundPlantTime=this.elapsed; p.interact = 0;
            for (const a of this.players) if (a.side === 'attack') a.money = Math.min(K.rules.cap, a.money + 300);
            this.radio(p, '装置を設置した'); this.emit('plant', { actor: p.id, x: d.x, z: d.z }); this.sound(p, 'plant', 40);
          }
        } else if (p.side === 'defend' && d.planted && K.dist(p, d) < 2.2 && K.map.sight(p, { x: d.x, z: d.z, y: (d.y || 0)-.85 }, []) && this.lookingAtDevice(p) && (d.defuser === null || d.defuser === p.id)) {
          valid = true; d.defuser = p.id; p.interact += dt;
          if (p.interact >= (p.kit ? K.rules.kit : K.rules.defuse)) { p.defuses++; p.roundDefuses++; this.finish('defend', '解除'); this.emit('defuse', { actor: p.id }); }
        }
        if (!valid && !p.pickupLatch) {
          const index = this.drops.findIndex(g => K.dist(g,p)<1.5 && Math.abs((g.y || 0)-p.y)<1.5 && K.map.sight(p,{x:g.x,z:g.z,y:(g.y || 0)-.85},[]));
          if (index >= 0) { p.pickupLatch=true; const drop = this.drops.splice(index, 1)[0]; for (const id of Object.keys(p.gear)) if (K.weapons[id].slot === K.weapons[drop.gear.id].slot) {this.drops.push({x:p.x,y:p.y,z:p.z,gear:{...p.gear[id]},time:this.time});delete p.gear[id];} p.gear[drop.gear.id] = drop.gear; K.combat.equip(p, drop.gear.id); this.emit('pickup', { actor: p.id, weapon: drop.gear.id }); }
        }
      }
      if (!valid) { p.interact = 0; if (d.defuser === p.id) d.defuser = null; }
      if (valid && this.time > p.actionSoundAt) { this.sound(p, 'device', 14); this.emit('work', { actor: p.id, x: p.x, z: p.z }); p.actionSoundAt = this.time + .65; }
    }
    step(dt, input) {
      if (!Number.isFinite(dt) || dt <= 0 || dt > .2 || this.phase === 'ended') return;
      this.time += dt;
      if (this.phase === 'result') { this.phaseTime -= dt; if (this.phaseTime <= 0) { if (Math.max(...this.scores) >= 7 || this.round >= 13) { this.phase = 'ended'; this.emit('matchEnd', { winner: this.result.winner, mvp:this.mvp }); } else this.startRound(); } return; }
      if (this.phase === 'buy') { this.phaseTime -= dt; for (const p of this.players) K.combat.update(this, p, dt); if (this.phaseTime <= 0) { this.phase = 'live'; this.phaseTime = K.rules.round; this.emit('start', {}); } return; }
      this.elapsed += dt; this.phaseTime -= dt;
      if (this.device.defuser !== null && !this.players[this.device.defuser].alive) this.device.defuser = null;
      this.noises = this.noises.filter(s => this.time - s.time < 1.3);
      // 毎フレームの開始隊員を循環して更新順による陣営差を抑える。
      const offset=Math.floor(this.time*60)%10;const actors=this.players.slice(offset).concat(this.players.slice(0,offset));
      for (const p of actors) if (p.alive) {
        p.verticalDone = false; K.combat.update(this, p, dt); p.actionSoundAt = p.actionSoundAt || 0;
        if (p.bot) K.bots.tick(this, p, dt); else { this.playerInput(p, input, dt); if (this.time > p.scanAt) { K.bots.perceive(this, p); p.scanAt = this.time + .2; } }
        if (!p.verticalDone) K.map.move(p, 0, 0, dt);
        if (p.moving && !p.walk && !p.crouch && p.grounded && this.time > p.footstepAt) { this.sound(p, 'step', 13); this.emit('step', { actor: p.id, x: p.x, z: p.z, material:K.map.materialAt(p) }); p.footstepAt = this.time + .38; }
        this.interactions(p, dt);
        if(this.phase!=='live')return;
      }
      // 見張りや交戦中でも隊員を押し分ける。設置・解除中の隊員はその場を保つ。
      for (let pass = 0; pass < 4; pass++) for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i], b = this.players[j]; if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 1) continue;
        const distance = K.dist(a, b); if (distance >= .64) continue;
        const dx = distance > .001 ? (a.x - b.x) / distance : Math.cos(i + j), dz = distance > .001 ? (a.z - b.z) / distance : Math.sin(i + j);
        const push = (.642 - distance) * .52;
        // 同じチームの人が押したらbotが先に道を譲る。壁際なら残りを両者で解消する。
        if(a.team===b.team && a.bot!==b.bot && !a.interact && !b.interact){
          const human=a.bot?b:a, bot=a.bot?a:b, sign=a.bot?1:-1;
          if(human.moving){K.map.move(bot,dx*push*2*sign,dz*push*2*sign,0);if(K.dist(a,b)>=.63)continue;}
        }
        const moveA=a.interact===0,moveB=b.interact===0;
        if(moveA)K.map.move(a,dx*push*(moveB?1:2),dz*push*(moveB?1:2),0);
        if(moveB)K.map.move(b,-dx*push*(moveA?1:2),-dz*push*(moveA?1:2),0);
      }
      K.combat.projectiles(this, dt);
      if (this.phase !== 'live') return;
      if (this.device.planted) { this.device.time -= dt; if (this.device.time <= 0) { for(const p of this.players) if(p.alive && K.dist(p,this.device)<12 && K.map.sight(p,{x:this.device.x,z:this.device.z,y:this.device.y || 0},[])) {p.alive=false;p.hp=0;p.deaths++;p.deathTime=this.time;this.emit('blastHit',{target:p.id,x:p.x,y:p.y,z:p.z});} this.finish('attack', '起爆'); this.emit('explode', { x: this.device.x, z: this.device.z }); return; } }
      const attack = this.players.filter(p => p.alive && p.side === 'attack').length, defend = this.players.filter(p => p.alive && p.side === 'defend').length;
      if (!defend) this.finish('attack', '全滅');
      else if (!attack && !this.device.planted) this.finish('defend', '全滅');
      else if (this.phaseTime <= 0 && !this.device.planted) this.finish('defend', '時間切れ');
    }
  }
  K.Match = Match;
  if (typeof module !== 'undefined') module.exports = Match;
})(typeof globalThis !== 'undefined' ? globalThis : window);
