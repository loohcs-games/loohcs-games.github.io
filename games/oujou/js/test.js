/* ブラウザと Node 共通の自己テスト。テスト専用状態だけを変更する。 */
(function(H){
  'use strict';
  H.tests=function(){
    const results=[];
    const assert=(condition,note='期待した条件を満たさない')=>{if(!condition)throw new Error(note);};
    const equal=(a,b,note)=>assert(JSON.stringify(a)===JSON.stringify(b),note||`${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    const close=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<eps,`${a} / ${b}`);
    const test=(name,fn)=>{try{fn();results.push({name,ok:true,note:''});}catch(e){results.push({name,ok:false,note:e.message});}};
    const arena=(hero=0)=>{
      const g=H.create({seed:79,hero}),h=g.heroes[0],enemy=g.heroes[5];
      for(const e of g.entities){e.alive=false;if(e.kind==='hero'){e.bot=false;e.respawn=Infinity;}if(e.kind==='camp'||e.kind==='boss')e.spawnAt=Infinity;}
      for(const e of [h,enemy]){e.alive=true;e.x=e===h?100:108;e.y=80;e.px=e.x;e.py=e.y;e.fx=e===h?1:-1;e.fy=0;e.bot=false;e.hp=e.maxHp;}
      g.nextWave=Infinity;g.time=10;g.tick=300;H.reindex(g);H.updateFog(g);return {g,h,enemy};
    };
    const minion=(g,team,x,y,hp=100)=>H.add(g,{kind:'minion',team,type:'sword',lane:1,x,y,hp,attack:20,range:3,interval:1.3,speed:9,spawned:g.time,radius:.8});
    const refresh=g=>{H.reindex(g);H.updateFog(g);};
    const resolve=(g,at)=>{g.time=at;g.tick=Math.round(at*30);H.updateEffects(g);};
    const fingerprint=g=>JSON.stringify({time:g.time,winner:g.winner,entities:g.entities.map(e=>[e.id,e.alive,e.x,e.y,e.hp,e.gold,e.level,e.target,e.inventory]),effects:g.effects,teams:g.teams});

    test('同じ種・同じ入力で状態が一致する',()=>{const a=H.create({seed:91}),b=H.create({seed:91});for(let i=0;i<300;i++){const input={1:H.inputFromKeys({KeyD:i<130,KeyW:i>=130,KeyJ:i%2===0,KeyU:i===180})};H.step(a,input);H.step(b,input);}equal(fingerprint(a),fingerprint(b));});
    test('異なる種の乱数列は異なる',()=>{const a=H.rng(7),b=H.rng(8);assert(Array.from({length:8},()=>a()).some((v)=>v!==b()));});
    test('固定刻みは30分の1秒',()=>{const {g}=arena();const start=g.time;H.step(g);close(g.time-start,1/30);});
    test('同軍に英雄が重複しない',()=>{for(let seed=1;seed<=24;seed++){const g=H.create({seed,watch:true});for(let team=0;team<2;team++)assert(new Set(g.heroes.filter(h=>h.team===team).map(h=>h.hero)).size===5);}});
    test('全8英雄を名前で選べる',()=>{for(let i=0;i<8;i++)equal(H.create({hero:H.heroes[i].name}).heroes[0].hero,i);});
    test('難易度で英雄の基礎能力を水増ししない',()=>{const a=H.create({seed:44,diff:0,watch:true}),b=H.create({seed:44,diff:2,watch:true});equal(a.heroes.map(h=>[h.hero,H.stats(a,h)]),b.heroes.map(h=>[h.hero,H.stats(b,h)]));});
    test('上中下の道の端は両王城に一致',()=>{for(let lane=0;lane<3;lane++){close(H.dist(H.lanePoint(lane,0),H.map.bases[0]),0);close(H.dist(H.lanePoint(lane,1),H.map.bases[1]),0);}});
    test('森の障害物は点対称',()=>{for(const o of H.map.obstacles)assert(H.map.obstacles.some(p=>p.x===200-o.x&&p.y===200-o.y&&p.r===o.r));});
    test('WASD と矢印の移動入力が同じ',()=>equal(H.inputFromKeys({KeyW:true,KeyD:true}),H.inputFromKeys({ArrowUp:true,ArrowRight:true})));
    test('J と Z の攻撃入力が同じ',()=>equal(H.inputFromKeys({KeyJ:true}),H.inputFromKeys({KeyZ:true})));
    test('UIO と XCV の技入力が同じ',()=>equal(H.inputFromKeys({KeyU:true,KeyI:true,KeyO:true}),H.inputFromKeys({KeyX:true,KeyC:true,KeyV:true})));
    test('P・F・Space は同じ奥義',()=>{equal(H.inputFromKeys({KeyP:true}),H.inputFromKeys({KeyF:true}));equal(H.inputFromKeys({KeyP:true}),H.inputFromKeys({Space:true}));});
    test('Tab は狙い切替に使わない',()=>assert(!H.inputFromKeys({Tab:true}).cycle));
    test('上移動は地図 y を減らす',()=>{const {g,h}=arena();const y=h.y;H.control(g,h,H.inputFromKeys({KeyW:true}));assert(h.y<y);});
    test('斜め移動の速度は横移動と同じ',()=>{const a=arena(),b=arena();H.control(a.g,a.h,{...H.emptyInput(),x:1});H.control(b.g,b.h,{...H.emptyInput(),x:1,y:1});close(H.dist(a.h,{x:100,y:80}),H.dist(b.h,{x:100,y:80}));});
    test('川では歩く速さが落ちる',()=>{const a=arena(),b=arena();b.h.x=b.h.y=100;H.move(a.g,a.h,1,0,10);H.move(b.g,b.h,1,0,10);assert(b.h.x-100<a.h.x-100);});
    test('森の木の中心には歩けない',()=>{const {g}=arena(),p=H.map.obstacles[0];assert(!H.walkable(g,p.x,p.y));});
    test('地図の外には歩けない',()=>{const {g}=arena();assert(!H.walkable(g,-1,80));assert(!H.walkable(g,201,80));});
    test('向いている方向の敵を優先する',()=>{const {g,h,enemy}=arena();enemy.x=110;minion(g,1,90,80,enemy.hp);refresh(g);assert(H.selectTarget(g,h,H.emptyInput()).id===enemy.id);});
    test('同じ方向なら近い敵を優先する',()=>{const {g,h,enemy}=arena();enemy.x=119;const m=minion(g,1,107,80);refresh(g);assert(H.selectTarget(g,h,H.emptyInput()).id===m.id);});
    test('距離が同じなら体力の少ない敵を優先する',()=>{const {g,h,enemy}=arena();enemy.alive=false;const a=minion(g,1,110,79,100),b=minion(g,1,110,81,100);b.hp=2;refresh(g);assert(H.selectTarget(g,h,H.emptyInput()).id===b.id);assert(a.hp===100);});
    test('Shift 中は英雄だけを狙う',()=>{const {g,h,enemy}=arena();minion(g,1,103,80,1);refresh(g);assert(H.selectTarget(g,h,{...H.emptyInput(),heroesOnly:true}).id===enemy.id);});
    test('Q 一押しで次の候補になる',()=>{const {g,h}=arena();minion(g,1,111,80);refresh(g);H.selectTarget(g,h,H.emptyInput());const first=h.target;H.selectTarget(g,h,{...H.emptyInput(),cycle:true});assert(h.target!==first);});
    test('Q を押し続けても毎コマ巡回しない',()=>{const {g,h}=arena();minion(g,1,111,80);refresh(g);H.control(g,h,{...H.emptyInput(),cycle:true});const first=h.target;H.control(g,h,{...H.emptyInput(),cycle:true});equal(h.target,first);});
    test('射程の少し外の狙いに攻撃キーで一歩寄る',()=>{const {g,h,enemy}=arena();enemy.x=107;refresh(g);const x=h.x;H.control(g,h,{...H.emptyInput(),attack:true});assert(h.x>x);});
    test('歩行入力は自動接近より優先する',()=>{const {g,h,enemy}=arena();enemy.x=110;refresh(g);const x=h.x;H.control(g,h,{...H.emptyInput(),x:-1,attack:true});assert(h.x<x);});
    test('方向技は移動する狙いを先読みする',()=>{const {g,h,enemy}=arena(1);enemy.vy=6;const a=H.aim(g,h,H.heroes[1].skills[0],enemy);assert(a.dy>0);});
    test('狙いがない技は向いている方向へ出る',()=>{const {g,h}=arena(1);h.fx=0;h.fy=-1;const a=H.aim(g,h,H.heroes[1].skills[0],null);equal([a.dx,a.dy],[0,-1]);assert(a.y<h.y);});
    test('視界の外の敵は狙えない',()=>{const {g,h,enemy}=arena();enemy.x=180;enemy.y=30;refresh(g);assert(!H.visible(g,0,enemy));assert(!H.selectTarget(g,h,H.emptyInput()));});
    test('草むらの外から中の敵は見えない',()=>{const {g,h,enemy}=arena(),b=H.map.bushes[0];h.x=b.x+14;h.y=b.y;enemy.x=b.x;enemy.y=b.y;refresh(g);assert(!H.visible(g,0,enemy));});
    test('同じ草むらに入れば敵が見える',()=>{const {g,h,enemy}=arena(),b=H.map.bushes[0];h.x=b.x+2;h.y=b.y;enemy.x=b.x;enemy.y=b.y;refresh(g);assert(H.visible(g,0,enemy));});
    test('味方の兵士が草むらに入っても敵が見える',()=>{const {g,h,enemy}=arena(),b=H.map.bushes[0];h.x=b.x+14;h.y=b.y;enemy.x=b.x;enemy.y=b.y;minion(g,0,b.x+2,b.y);refresh(g);assert(H.visible(g,0,enemy),'同じ草むらの味方兵士の視界が効かない');});
    test('外塔が立つ間は同じ道の内塔を傷つけられない',()=>{const g=H.create(),h=g.heroes[0],t=g.towers.find(t=>t.team===1&&t.inner);const hp=t.hp;H.hurt(g,h,t,10000);equal(t.hp,hp);});
    test('外塔を折ると同じ道の内塔だけが開く',()=>{const g=H.create(),h=g.heroes[0],outer=g.towers.find(t=>t.team===1&&!t.inner),inner=g.towers.find(t=>t.team===1&&t.inner&&t.lane===outer.lane);H.hurt(g,h,outer,100000);assert(H.vulnerable(g,inner));assert(!H.vulnerable(g,g.towers.find(t=>t.team===1&&t.inner&&t.lane!==outer.lane)));});
    test('内塔を一本折ると王城を攻められる',()=>{const g=H.create(),c=g.castles[1];assert(!H.vulnerable(g,c));g.towers.find(t=>t.team===1&&t.inner).alive=false;assert(H.vulnerable(g,c));});
    test('塔は英雄より兵士を優先して予告する',()=>{const {g,h,enemy}=arena();enemy.alive=false;const t=g.towers[0];t.alive=true;t.x=100;t.y=80;h.team=1;h.x=105;const m=minion(g,1,112,80);refresh(g);H.updateUnits(g,.1);equal(t.focus,m.id);assert(t.charge>g.time);});
    test('塔の下で英雄を攻撃すると塔が撃った英雄を狙う',()=>{const {g,h,enemy}=arena();const t=g.towers.find(t=>t.team===1);t.alive=true;t.x=104;t.y=80;refresh(g);H.hurt(g,h,enemy,20);equal(t.focus,h.id);assert(t.aggroUntil>g.time);});
    test('同じ英雄への塔の連続攻撃が強くなる',()=>{const {g,h,enemy}=arena();enemy.alive=false;const t=g.towers.find(t=>t.team===1);t.alive=true;t.x=110;t.y=80;t.focus=h.id;t.aggroUntil=100;t.charge=g.time-.1;h.hp=h.maxHp=10000;refresh(g);const hp=h.hp;H.updateUnits(g,.1);const first=hp-h.hp;t.cooldown=0;t.charge=g.time-.1;const hp2=h.hp;H.updateUnits(g,.1);assert(hp2-h.hp>first);});
    test('泉の回復は野外より速い',()=>{const a=arena(),b=arena();a.h.hp=b.h.hp=100;a.h.x=H.map.fountains[0].x;a.h.y=H.map.fountains[0].y;H.step(a.g);H.step(b.g);assert(a.h.hp>b.h.hp);});
    test('帰還は8秒を要し王城へ戻る',()=>{const {g,h}=arena();H.control(g,h,{...H.emptyInput(),recall:true});close(h.recall,g.time+8);g.time+=7.9;H.control(g,h,H.emptyInput());assert(!H.inBase(h));g.time+=.1;H.control(g,h,H.emptyInput());assert(H.inBase(h));});
    test('帰還は歩くと中断する',()=>{const {g,h}=arena();H.control(g,h,{...H.emptyInput(),recall:true});H.control(g,h,{...H.emptyInput(),x:1});equal(h.recall,0);});
    test('帰還は被弾で中断する',()=>{const {g,h,enemy}=arena();h.recall=g.time+8;H.hurt(g,enemy,h,1);equal(h.recall,0);});
    test('生存中の店は泉にいる間だけ買える',()=>{const {g,h}=arena();h.gold=10000;assert(!H.buy(g,h,0));h.x=H.map.fountains[0].x;h.y=H.map.fountains[0].y;assert(H.buy(g,h,0));});
    test('金が足りなければ商品を買えない',()=>{const g=H.create(),h=g.heroes[0];h.gold=0;assert(!H.buy(g,h,0));equal(h.inventory.length,0);});
    test('持ち物は6枠まで',()=>{const g=H.create(),h=g.heroes[0];h.gold=10000;for(let i=0;i<6;i++)assert(H.buy(g,h,i));assert(!H.buy(g,h,6));equal(h.inventory.length,6);});
    test('購入品の効果が能力に反映される',()=>{const g=H.create(),h=g.heroes[0],before=H.stats(g,h).attack;H.buy(g,h,0);close(H.stats(g,h).attack-before,H.items[0].attack);});
    test('売却すると品が減り金が戻る',()=>{const g=H.create(),h=g.heroes[0];H.buy(g,h,0);const gold=h.gold;assert(H.sell(g,h,0));equal(h.inventory.length,0);assert(h.gold>gold);});
    test('おすすめ購入は同じ入力経路を通る',()=>{const g=H.create(),h=g.heroes[0],i=H.recommend(h);H.control(g,h,{...H.emptyInput(),buy:i});equal(h.inventory,[i]);});
    test('経験値は近くの英雄で等分される',()=>{const {g,h,enemy}=arena();enemy.alive=false;const ally=g.heroes[1];ally.alive=true;ally.x=101;ally.y=80;const m=minion(g,1,104,80,1),a=h.xp,b=ally.xp;refresh(g);H.hurt(g,h,m,10);close(h.xp-a,ally.xp-b);assert(h.xp>a);});
    test('とどめで満額・近くにいるだけなら約4割の金',()=>{const {g,h,enemy}=arena();enemy.alive=false;const ally=g.heroes[1];ally.alive=true;ally.x=101;ally.y=80;const m=minion(g,1,104,80,1),a=h.gold,b=ally.gold;refresh(g);H.hurt(g,h,m,10);close(h.gold-a,18);assert(Math.abs((ally.gold-b)/18-.4)<.03);equal(h.lastHits,1);});
    test('レベルの上限は12',()=>{const {g,h}=arena();H.experience(g,h,1000000);equal(h.level,12);});
    test('奥義は4・8・12で伸びる',()=>{for(const level of [1,3,4,7,8,11,12])equal(H.skillRanks(level)[3],Math.floor(level/4));});
    test('技は気力が足りなければ出せない',()=>{const {g,h,enemy}=arena();h.mana=0;assert(!H.cast(g,h,0,enemy));equal(g.effects.length,0);});
    test('技の待ち時間中は再使用できない',()=>{const {g,h,enemy}=arena();assert(H.cast(g,h,0,enemy));assert(!H.cast(g,h,0,enemy));});
    test('英雄は退くと8〜40秒後に復帰する',()=>{const {g,h,enemy}=arena();H.hurt(g,enemy,h,100000);assert(!h.alive);assert(h.respawn-g.time>=8&&h.respawn-g.time<=40);g.tick=Math.ceil(h.respawn*30)-1;H.step(g);assert(h.alive&&H.inBase(h));});
    test('討ち取りと手伝いが別に記録される',()=>{const {g,h,enemy}=arena();const ally=g.heroes[1];ally.alive=true;ally.x=101;ally.y=80;H.hurt(g,ally,enemy,10);H.hurt(g,h,enemy,100000);equal(h.kills,1);equal(ally.assists,1);equal(enemy.deaths,1);});
    test('連続討ち取り中の英雄を止めると報奨が増す',()=>{const a=arena(),b=arena();b.enemy.streak=3;const ga=a.h.gold,gb=b.h.gold;H.hurt(a.g,a.h,a.enemy,100000);H.hurt(b.g,b.h,b.enemy,100000);assert(b.h.gold-gb>a.h.gold-ga);});
    test('帰り火の宝珠は一度だけその場で復帰',()=>{const {g,h,enemy}=arena();h.inventory=[13];const x=h.x;H.hurt(g,enemy,h,100000);assert(h.alive&&h.reviveUsed);equal(h.x,x);g.time+=3;H.hurt(g,enemy,h,100000);assert(!h.alive);});
    test('初回の兵士は各軍・各道に剣3弓3',()=>{const g=H.create();H.spawnWave(g);for(let team=0;team<2;team++)for(let lane=0;lane<3;lane++){const units=g.entities.filter(e=>e.kind==='minion'&&e.team===team&&e.lane===lane);equal(units.filter(e=>e.type==='sword').length,3);equal(units.filter(e=>e.type==='bow').length,3);}});
    test('3組目には投石機が加わる',()=>{const g=H.create();g.wave=2;H.spawnWave(g);equal(g.entities.filter(e=>e.kind==='minion'&&e.type==='siege').length,6);});
    test('内塔を折った道には重装兵が加わる',()=>{const g=H.create();g.towers.find(t=>t.team===1&&t.lane===0&&t.inner).alive=false;H.spawnWave(g);assert(g.entities.some(e=>e.kind==='minion'&&e.team===0&&e.lane===0&&e.type==='heavy'));assert(!g.entities.some(e=>e.kind==='minion'&&e.team===1&&e.type==='heavy'));});
    test('兵士は同時に80体以下',()=>{const g=H.create();for(let i=0;i<10;i++)H.spawnWave(g);assert(g.entities.filter(e=>e.kind==='minion'&&e.alive).length<=80);});
    test('20分以降は兵士が毎分さらに強くなる',()=>{const a=H.create(),b=H.create();a.time=1200;b.time=1260;H.spawnWave(a);H.spawnWave(b);assert(b.entities.find(e=>e.kind==='minion').attack>a.entities.find(e=>e.kind==='minion').attack);});
    test('魔狼を倒すと90秒の攻撃強化',()=>{const {g,h}=arena(),c=g.camps.find(c=>c.type==='wolf');c.alive=true;c.x=h.x+2;c.y=h.y;H.hurt(g,h,c,100000);close(h.wolfUntil-g.time,90);});
    test('グリフォンを倒すと90秒の技回転強化',()=>{const {g,h}=arena(),c=g.camps.find(c=>c.type==='griffin');c.alive=true;c.x=h.x+2;c.y=h.y;H.hurt(g,h,c,100000);close(h.griffinUntil-g.time,90);});
    test('巣は倒してしばらく後に再出現する',()=>{const {g,h}=arena(),c=g.camps[0];c.alive=true;H.hurt(g,h,c,100000);assert(c.spawnAt>g.time);g.time=c.spawnAt-.1;H.updateUnits(g,.1);assert(!c.alive);g.time=c.spawnAt;H.updateUnits(g,.1);assert(c.alive&&c.hp===c.maxHp);});
    test('水竜は3分から古竜は7分から現れる',()=>{const g=H.create(),water=g.camps.find(c=>c.type==='water'),ancient=g.camps.find(c=>c.type==='ancient');g.time=179.9;H.updateUnits(g,.1);assert(!water.alive&&!ancient.alive);g.time=180;H.updateUnits(g,.1);assert(water.alive&&!ancient.alive);g.time=420;H.updateUnits(g,.1);assert(ancient.alive);});
    test('水竜の強化は全軍に積み重なり4分後に再出現',()=>{const {g,h}=arena(),c=g.camps.find(c=>c.type==='water');c.alive=true;H.hurt(g,h,c,100000);equal(g.teams[0].dragons,1);close(c.spawnAt-g.time,240);c.alive=true;c.hp=c.maxHp;H.hurt(g,h,c,100000);equal(g.teams[0].dragons,2);});
    test('古竜の強化は3分間続く',()=>{const {g,h}=arena(),c=g.camps.find(c=>c.type==='ancient');c.alive=true;H.hurt(g,h,c,100000);close(g.teams[0].ancientUntil-g.time,180);});
    test('主は離れると体力が戻る',()=>{const {g}=arena(),c=g.camps.find(c=>c.type==='ancient');c.alive=true;c.hp=100;c.lastSource=null;H.updateUnits(g,.1);assert(c.hp>100);});
    test('主の攻撃には着弾前の予告時間がある',()=>{const {g,h}=arena(),c=g.camps.find(c=>c.type==='ancient');c.alive=true;c.x=c.homeX=h.x+5;c.y=c.homeY=h.y;c.lastSource=h.id;c.nextSkill=0;refresh(g);H.updateUnits(g,.1);const effect=g.effects.find(e=>e.source===c.id);assert(effect&&effect.at>effect.start&&effect.at>g.time);});
    test('王城の体力が半分で守護巨人になる',()=>{const {g,h}=arena(),c=g.castles[1];c.alive=true;H.hurt(g,h,c,c.maxHp);assert(c.giant&&c.alive);equal(g.metrics.giants.length,1);});
    test('守護巨人化は一度だけ・守る英雄が復帰する',()=>{const {g}=arena(),c=g.castles[1];c.alive=true;H.awaken(g,c);H.awaken(g,c);equal(g.metrics.giants.length,1);for(const h of g.heroes.filter(h=>h.team===1)){assert(h.alive);close(h.empowerUntil-g.time,30);}});
    test('守護巨人の円・扇・踏みつけに予告がある',()=>{const {g,h}=arena(),c=g.castles[1];c.alive=true;c.x=h.x+12;c.y=h.y;H.awaken(g,c);refresh(g);for(let phase=0;phase<3;phase++){g.time+=6;c.nextSkill=0;H.updateUnits(g,.1);}const effects=g.effects.filter(e=>e.source===c.id);assert(effects.some(e=>e.shape==='cone'));assert(effects.some(e=>e.data.knock));assert(effects.every(e=>e.at>e.start));});
    test('巨人を倒すと相手軍の勝利',()=>{const {g,h}=arena(),c=g.castles[1];c.alive=true;H.awaken(g,c);g.time+=5;H.hurt(g,h,c,100000);equal(g.winner,0);});
    test('決着後は試合時間が進まない',()=>{const {g}=arena();g.winner=0;const time=g.time;H.step(g);equal(g.time,time);});
    test('集合の合図は同じキーで解除できる',()=>{const {g,h}=arena();H.control(g,h,{...H.emptyInput(),rally:true});assert(g.rallyUntil>g.time);H.control(g,h,H.emptyInput());H.control(g,h,{...H.emptyInput(),rally:true});equal(g.rallyUntil,0);});
    test('bot の出力は人に公開した入力だけ',()=>{const g=H.create({watch:true});const allowed=new Set(['x','y','attack','skills','cycle','heroesOnly','recall','rally','buy','sell']);for(const h of g.heroes){const input=H.botInput(g,h);assert(Object.keys(input).every(k=>allowed.has(k)));assert([-1,0,1].includes(input.x)&&[-1,0,1].includes(input.y));}});
    test('bot は入力生成だけでは位置や体力を変えない',()=>{const g=H.create({watch:true}),h=g.heroes[0],snapshot=[h.x,h.y,h.hp,h.gold,h.inventory.slice()];H.botInput(g,h);equal([h.x,h.y,h.hp,h.gold,h.inventory.slice()],snapshot);});
    test('bot は全員が最初の60秒以内に王城を離れる',()=>{const g=H.create({seed:5,watch:true}),moved=new Set();for(let i=0;i<1800;i++){H.step(g);for(const h of g.heroes)if(H.dist(h,H.map.bases[h.team])>20)moved.add(h.id);}equal(moved.size,10);});
    test('代理操作のキー変換は攻撃・技・帰還を保持',()=>{const raw={x:1,y:-1,attack:true,skills:[true,false,true,true],cycle:true,heroesOnly:true,recall:true,rally:true};equal(H.inputFromKeys(H.keysFromInput(raw)),raw);});

    for(let hero=0;hero<8;hero++)for(let index=0;index<4;index++)test(`${H.heroes[hero].name}「${H.heroes[hero].skills[index].name}」に気力・待ち時間・技の絵の情報がある`,()=>{const {g,h,enemy}=arena(hero);h.level=12;h.mana=999;h._statsTick=-1;const before=h.mana;assert(H.cast(g,h,index,enemy));assert(h.skills[index]>0&&h.mana<before);const e=g.effects.find(e=>e.source===h.id&&e.index===index);assert(e&&e.name&&e.shape&&e.at>=e.start&&Number.isFinite(e.x)&&Number.isFinite(e.y));resolve(g,e.at);assert(Number.isFinite(h.hp)&&Number.isFinite(enemy.hp));});
    test('聖剣の扇は自分から狙いの方向へ当たる',()=>{const {g,h,enemy}=arena(0);h.level=4;enemy.x=112;enemy.y=80;h.mana=200;const hp=enemy.hp;H.cast(g,h,3,enemy);resolve(g,g.time+1.2);assert(enemy.hp<hp,'目の前の敵に扇が当たらない');});
    test('氷の壁が進路をふさぐ',()=>{const {g,h,enemy}=arena(2);h.level=3;H.cast(g,h,2,enemy);resolve(g,g.time+1);assert(g.walls.length===1);const w=g.walls[0];assert(!H.walkable(g,(w.a.x+w.b.x)/2,(w.a.y+w.b.y)/2));});
    test('氷の壁の被害範囲は置かれる壁と一致する',()=>{const {g,h,enemy}=arena(2);h.level=3;enemy.x=112;const before=minion(g,1,102,80),atWall=minion(g,1,112,86);refresh(g);H.cast(g,h,2,enemy);const e=g.effects.find(e=>e.shape==='wall');assert(H.inEffect(e,atWall),'壁の端にいる相手が被害範囲外');assert(!H.inEffect(e,before),'壁より手前の発射経路まで被害範囲になる');});
    test('僧侶の祈りは味方を回復し短時間倒れなくする',()=>{const {g,h,enemy}=arena(5);h.level=4;h.hp=100;H.cast(g,h,3,enemy);resolve(g,g.time+1);assert(h.hp>100);assert(h.prayerUntil>g.time);H.hurt(g,enemy,h,100000);assert(h.alive&&h.hp===1);});
    test('盗賊の背後攻撃は正面より強い',()=>{const a=arena(4),b=arena(4);a.enemy.fx=1;b.enemy.fx=-1;H.attack(a.g,a.h,a.enemy);H.attack(b.g,b.h,b.enemy);assert(a.g.effects[0].damage>b.g.effects[0].damage);});
    test('砲手の三連砲は時間差で三発出る',()=>{const {g,h,enemy}=arena(6);h.level=4;H.cast(g,h,3,enemy);const e=g.effects.filter(e=>e.source===h.id);equal(e.length,3);assert(e[0].at<e[1].at&&e[1].at<e[2].at);});
    test('森の生物からの被弾でも帰還は中断する',()=>{const {g,h}=arena();h.recall=g.time+8;H.hurt(g,g.camps[0],h,10);equal(h.recall,0);});
    test('両軍の兵士の初期位置は同じ道を保つ鏡映',()=>{const g=H.create();H.spawnWave(g);const a=g.entities.filter(e=>e.kind==='minion'&&e.team===0),b=g.entities.filter(e=>e.kind==='minion'&&e.team===1);for(const u of a)assert(b.some(v=>v.lane===u.lane&&v.type===u.type&&Math.abs(u.x-v.y)<1e-7&&Math.abs(u.y-v.x)<1e-7),'反転先の道に対応する兵士がいない');});
    test('森の壁は同じ道を保つ鏡映でも一致する',()=>{for(const o of H.map.obstacles)assert(H.map.obstacles.some(p=>p.x===o.y&&p.y===o.x&&p.r===o.r));});
    test('両軍の同じ種類の巣から各道までの距離が等しい',()=>{for(let i=0;i<4;i++){const a=H.map.camps[i],b=H.map.camps[i+4];equal(a.type,b.type);close(a.x,b.y);close(a.y,b.x);}});
    test('守護巨人の魔弾は近い敵を優先する',()=>{const {g,h}=arena(),c=g.castles[0];c.alive=true;c.x=100;c.y=80;H.awaken(g,c);for(const e of g.heroes)e.alive=false;const near=minion(g,1,104,80,100);for(let i=0;i<8;i++)minion(g,1,90+i,50+i*.1,100);g.time+=5;c.nextSkill=0;refresh(g);H.updateUnits(g,.1);assert(g.effects.some(e=>e.source===c.id&&e.x===near.x&&e.y===near.y),'近い敵が魔弾から漏れた');});
    test('離れた同一直線上の氷壁は経路を塞がない',()=>{const g=H.create();g.walls=[{a:{x:100,y:80},b:{x:110,y:80},until:10}];assert(H.clearPath(g,{x:80,y:80},{x:90,y:80},1));assert(!H.clearPath(g,{x:90,y:80},{x:115,y:80},1));});
    test('bot は障害物の物理境界付近から無入力停止せず離脱できる',()=>{
      // (38,70), radius 6 の木の右側。物理半径1なら合法だが、1.08の余白では
      // 開始地点自体を不通と誤認して全8方向が棄却されていた。赤も転置位置で検査。
      for(const team of [0,1]){const {g,h,enemy}=arena();enemy.alive=false;h.team=team;h.bot=true;h.x=h.px=team?70:45.04;h.y=h.py=team?45.04:70;g.time=600;g.tick=18000;g.castles[1-team].alive=true;refresh(g);const start={x:h.x,y:h.y};assert(H.walkable(g,h.x,h.y,h.radius),'再現地点が物理的に歩けない');for(let i=0;i<300;i++)H.step(g);assert(h.alive&&H.dist(start,h)>2,`${team===0?'青':'赤'}のbotが10秒間境界付近で停止した`);}
    });
    const dodgeMirror=kind=>{
      const moves=[];
      for(const team of [0,1]){
        const {g,h,enemy}=arena();h.team=team;enemy.team=1-team;
        let direction={x:-1,y:0};
        if(kind==='circle-overlap'){enemy.x=h.x;enemy.y=h.y;}
        if(kind==='line-home-parallel'){
          const home=H.map.fountains[0],length=H.dist(home,h);direction={x:(home.x-h.x)/length,y:(home.y-h.y)/length};enemy.x=h.x-direction.x*8;enemy.y=h.y-direction.y*8;
        }
        if(team===1){for(const e of [h,enemy]){const x=e.x;e.x=e.y;e.y=x;e.px=e.x;e.py=e.y;const fx=e.fx;e.fx=e.fy;e.fy=fx;}direction={x:direction.y,y:direction.x};}
        const line=kind.startsWith('line'),center=line?enemy:h;
        H.telegraph(g,enemy,line?'line':'circle',center.x,center.y,direction.x,direction.y,line?20:0,line?2:6,100,1.5);
        g.effects[0].start=g.time-1;g.random=()=>0;refresh(g);
        const start={x:h.x,y:h.y},input=H.botInput(g,h);assert((input.x||input.y)&&!input.attack,'予告の中心で回避入力が出ない');H.control(g,h,input);
        const home=H.map.fountains[team],reference=kind==='circle' ? {x:start.x-enemy.x,y:start.y-enemy.y}:{x:home.x-start.x,y:home.y-start.y};
        if(kind!=='line-home-parallel')assert(input.x*reference.x+input.y*reference.y>0,'攻撃元から離れる側、または自陣側を選ばない');
        moves.push({x:input.x,y:input.y,dx:h.x-start.x,dy:h.y-start.y});
      }
      equal([moves[0].x,moves[0].y],[moves[1].y,moves[1].x],'青赤の回避入力が転置対応しない');close(moves[0].dx,moves[1].dy);close(moves[0].dy,moves[1].dx);
    };
    test('円の中心からの回避は攻撃元から離れ青赤で転置対応する',()=>dodgeMirror('circle'));
    test('円の中心と攻撃元が重なる回避は自陣側へ青赤で転置対応する',()=>dodgeMirror('circle-overlap'));
    test('線の中心線上からの回避は自陣側へ青赤で転置対応する',()=>dodgeMirror('line'));
    test('線の中心線と自陣方向が平行でも回避は青赤で転置対応する',()=>dodgeMirror('line-home-parallel'));
    test('攻撃を20秒保持して逃げる敵を追っても押し始めから3以内',()=>{
      const {g,h,enemy}=arena(),start={x:h.x,y:h.y};
      for(let i=0;i<600;i++){enemy.x=h.x+7;refresh(g);H.control(g,h,H.inputFromKeys({KeyJ:true}));g.tick++;g.time=g.tick/30;}
      const distance=H.dist(start,h);assert(distance>2&&distance<=3,`自動接近 ${distance}`);
    });
    test('障害物で片軸だけ滑っても自動接近の実移動は起点から3を超えない',()=>{
      const {g,h,enemy}=arena(),anchor={x:96.3821069344,y:58.9650269924};h.x=97.9932853603;h.y=61.4837973431;h.approachAnchor=anchor;h.prevInput=H.inputFromKeys({KeyJ:true});
      const direction={x:-1,y:.4},length=Math.hypot(direction.x,direction.y),step=H.stats(g,h).speed*H.DT;
      const planned={x:h.x+direction.x/length*step,y:h.y+direction.y/length*step},raw={...h};H.move(g,raw,direction.x,direction.y,H.stats(g,h).speed);
      assert(H.dist(planned,anchor)<3&&H.dist(raw,anchor)>3,'障害物の片軸移動による超過場面を再現できない');
      enemy.x=h.x+direction.x/length*7;enemy.y=h.y+direction.y/length*7;refresh(g);H.control(g,h,H.inputFromKeys({KeyJ:true}));
      equal(h.target,enemy.id,'接近の標的が選ばれていない');assert(H.dist(h,anchor)<=3,`接近実位置が ${H.dist(h,anchor)} まで起点を離れた`);
    });
    test('川の自動接近でも射程直外に止まらず実際に通常攻撃が当たる',()=>{
      const {g,h,enemy}=arena();enemy.alive=false;h.x=h.y=100;const m=minion(g,1,107,100,10000);m.speed=0;m.range=0;m.attack=0;m.cooldown=1000;refresh(g);
      for(let i=0;i<75;i++)H.step(g,{[h.id]:H.inputFromKeys({KeyJ:true})});
      assert(m.hp<m.maxHp,`川の射程直外で停止: 距離 ${H.dist(h,m)}`);assert(H.dist(h,{x:100,y:100})<=3);
    });
    test('自分で歩いて止まった場所が新しい接近の起点になる',()=>{
      const {g,h,enemy}=arena();
      for(let i=0;i<25;i++){enemy.x=h.x+7;refresh(g);H.control(g,h,H.inputFromKeys({KeyD:true,KeyJ:true}));g.tick++;g.time=g.tick/30;}
      const stopped={x:h.x,y:h.y};
      for(let i=0;i<100;i++){enemy.x=h.x+7;refresh(g);H.control(g,h,H.inputFromKeys({KeyJ:true}));g.tick++;g.time=g.tick/30;}
      assert(H.dist(stopped,h)>2&&H.dist(stopped,h)<=3);close(H.dist(stopped,h.approachAnchor),0);
    });
    test('遠い敵には攻撃キーだけで歩き出さない',()=>{const {g,h,enemy}=arena();enemy.x=110;refresh(g);const start={x:h.x,y:h.y};H.control(g,h,H.inputFromKeys({KeyJ:true}));close(H.dist(start,h),0);});
    test('味方兵士がいなければ攻撃保持で敵の塔の射程に入らない',()=>{
      const {g,h,enemy}=arena(),t=g.towers.find(t=>t.team===1&&!t.inner);t.alive=true;t.x=123;t.y=80;
      for(let i=0;i<100;i++){enemy.x=h.x+7;refresh(g);H.control(g,h,H.inputFromKeys({KeyJ:true}));g.tick++;g.time=g.tick/30;}
      assert(H.dist(h,t)>t.range,`塔まで ${H.dist(h,t)}`);assert(h.x>100,'塔から離れた安全な一歩まで止めた');
    });
    test('塔の近くに兵士がいるだけでは自動接近を許可しない',()=>{const {g,h}=arena(),t=g.towers.find(t=>t.team===1);t.alive=true;t.x=120;t.y=80;minion(g,0,115,80);assert(!H.autoApproachSafe(g,h,{x:101,y:80}));t.focus=h.id;assert(!H.autoApproachSafe(g,h,{x:101,y:80}));});
    test('塔が既に生きた味方兵士を狙う場合のみ自動接近できる',()=>{const {g,h}=arena(),t=g.towers.find(t=>t.team===1);t.alive=true;t.x=120;t.y=80;const m=minion(g,0,115,80);t.focus=m.id;assert(H.autoApproachSafe(g,h,{x:101,y:80}));m.alive=false;assert(!H.autoApproachSafe(g,h,{x:101,y:80}));m.alive=true;m.x=90;assert(!H.autoApproachSafe(g,h,{x:101,y:80}));});
    test('塔の警告は自分が生きて射程内で狙われる間だけ',()=>{const {g,h}=arena(),t=g.towers.find(t=>t.team===1);t.alive=true;t.x=110;t.y=80;t.focus=h.id;assert(H.towerThreat(g,h));t.focus=null;assert(!H.towerThreat(g,h));t.focus=h.id;t.x=150;assert(!H.towerThreat(g,h));t.x=110;h.alive=false;assert(!H.towerThreat(g,h));});
    test('退いている間も共通入力で買い物と売却ができる',()=>{const {g,h}=arena();h.alive=false;h.hp=0;h.respawn=g.time+10;h.gold=1000;const time=g.time;H.step(g,{[h.id]:{...H.emptyInput(),buy:4}});equal(h.inventory,[4]);equal(h.gold,700);assert(!h.alive&&g.time>time);H.step(g,{[h.id]:{...H.emptyInput(),sell:0}});equal(h.inventory,[]);equal(h.gold,880);assert(!h.alive);});
    test('castle 確認は5人全員Lv8・持ち物3つ・満タンで城前に置く',()=>{
      const g=H.create({hero:0});H.castleScene(g);const allies=g.heroes.filter(h=>h.team===0),c=g.castles[1];equal(allies.length,5);assert(c.giant&&H.vulnerable(g,c));
      for(const h of allies){assert(h.alive&&h.level===8&&h.inventory.length===3);close(h.hp,h.maxHp);close(h.mana,h.maxMana);assert(H.dist(h,c)>25&&H.dist(h,c)<50);assert(H.dist(h,allies[0])<13);assert(H.walkable(g,h.x,h.y,h.radius));assert(!H.inBase(h));}
    });
    test('案内矢印は担当道への到着で消え帰っても再表示しない',()=>{const g=H.create({hero:0}),h=g.heroes[0];H.updateGuidance(g);assert(!g.guidance.arrived);Object.assign(h,H.guideGoal(g,h));H.updateGuidance(g);assert(g.guidance.arrived);Object.assign(h,H.map.fountains[0]);H.updateGuidance(g);assert(g.guidance.arrived);});
    test('手引きは敵兵と出会うまでは兵士の説明を出さず一度だけ',()=>{const {g,h}=arena();H.updateGuidance(g);assert(!g.guidance.seen.soldiers);minion(g,1,h.x+10,h.y);refresh(g);H.updateGuidance(g);assert(g.guidance.seen.soldiers);g.time+=10;H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide'&&e.key==='soldiers').length,1);});
    test('帰還手引きは野外で体力45%以下になったとき一度だけ',()=>{const {g,h}=arena();h.hp=h.maxHp*.46;H.updateGuidance(g);assert(!g.guidance.seen.recall);h.hp=h.maxHp*.3;H.updateGuidance(g);assert(g.guidance.seen.recall);g.time+=10;H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide'&&e.key==='recall').length,1);});
    test('店の手引きは開始45秒後におすすめを買える金が貯まったとき',()=>{const {g,h}=arena();h.gold=0;g.time=60;H.updateGuidance(g);assert(!g.guidance.seen.shop);h.gold=H.items[H.recommend(h)].price;H.updateGuidance(g);assert(g.guidance.seen.shop);g.time+=10;H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide'&&e.key==='shop').length,1);});
    test('手引きは無効設定・観戦・退いている間に表示しない',()=>{for(const mode of ['disabled','watch','dead']){const {g,h}=arena();h.hp=h.maxHp*.2;if(mode==='disabled')g.guidance.enabled=false;if(mode==='watch')g.watch=true;if(mode==='dead')h.alive=false;H.updateGuidance(g);assert(!g.events.some(e=>e.type==='guide'),mode);}});
    test('帰還と兵士の手引きが同時に該当しても一行ずつ出す',()=>{const {g,h}=arena();h.hp=h.maxHp*.2;minion(g,1,h.x+10,h.y);refresh(g);H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide').map(e=>e.key),['recall']);g.time+=1;H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide').length,1);g.time+=5;H.updateGuidance(g);equal(g.events.filter(e=>e.type==='guide').map(e=>e.key),['recall','soldiers']);});
    test('初心者は体力3割を切ると攻撃と技をやめ、敵と被弾が途切れてから帰還する',()=>{
      const {g,h,enemy}=arena();h.hp=h.maxHp*.29;
      const retreat=H.noviceInput(g,h);assert(!retreat.recall&&!retreat.attack&&!retreat.skills.some(Boolean)&&(retreat.x||retreat.y),'敵の近くで攻撃や帰還を続けた');
      H.control(g,h,retreat);H.hurt(g,enemy,h,20);enemy.alive=false;g.time+=.6;refresh(g);const stillRetreating=H.noviceInput(g,h);
      assert(!stillRetreating.recall&&!stillRetreating.attack&&!stillRetreating.skills.some(Boolean)&&(stillRetreating.x||stillRetreating.y),'被弾直後に帰還を始めた');H.control(g,h,stillRetreating);
      g.time+=1.8;const recall=H.noviceInput(g,h);assert(recall.recall&&!recall.attack&&!recall.skills.some(Boolean)&&!recall.x&&!recall.y,'安全になっても帰還入力を出さない');
      H.control(g,h,recall);close(h.recall,g.time+8);assert(!H.inBase(h),'入力生成だけで泉へ飛んだ');
    });
    test('初心者のおすすめ購入は泉で共通入力を適用して初めて成立する',()=>{
      const g=H.create(),h=g.heroes[0],item=H.recommend(h),gold=h.gold,input=H.noviceInput(g,h);
      equal(input.buy,item);equal(h.inventory,[]);equal(h.gold,gold);H.control(g,h,input);
      equal(h.inventory,[item]);close(h.gold,gold-H.items[item].price);assert(!input.attack);
    });
    test('初心者の回避は50%境界で分かれ同じ予告中に抽選し直さない',()=>{
      for(const roll of [.49,.51]){const {g,h,enemy}=arena();H.telegraph(g,enemy,'circle',h.x,h.y,0,1,0,10,100,4);g.effects[0].start=g.time-.6;let draws=0;g.random=()=>{draws++;return roll;};
        for(let i=0;i<5;i++){const input=H.noviceInput(g,h);if(roll<.5)assert((input.x||input.y)&&!input.skills.some(Boolean),'回避を選んだのに技を撃った');else assert(input.skills[0],'回避を見送ったのに通常の技入力まで失った');g.time+=.6;}
        equal(draws,1,'同じ予告に何度も回避抽選を行った');
      }
    });
    test('近い味方は塔圏または人数不利で戦う自分へ共通移動入力で寄る',()=>{
      for(const danger of ['tower','outnumbered']){const {g,h,enemy}=arena(),ally=g.heroes[1];ally.alive=true;ally.x=100;ally.y=110;ally.brain.next=0;h.input=H.inputFromKeys({KeyJ:true});enemy.alive=danger==='outnumbered';
        if(danger==='tower'){const tower=g.towers.find(t=>t.team===1);tower.alive=true;tower.x=118;tower.y=80;}else{const second=g.heroes[6];second.alive=true;second.x=110;second.y=80;}
        refresh(g);const before=H.dist(ally,h),position={x:ally.x,y:ally.y},input=H.botInput(g,ally);
        assert(ally.supportUntil>g.time&&(input.x||input.y),`${danger}: 援護の移動入力がない`);assert(H.dist(ally,position)===0,'判断だけで味方の位置を書き換えた');
        H.control(g,ally,input);assert(H.dist(ally,h)<before,`${danger}: 援護の入力が味方から遠ざかった`);
      }
    });
    test('自動援護は帰還中の仲間を除く最寄り1人、G集合なら複数人が寄る',()=>{
      const {g,h,enemy}=arena();enemy.alive=false;h.input=H.inputFromKeys({KeyJ:true});const tower=g.towers.find(t=>t.team===1);tower.alive=true;tower.x=118;tower.y=80;
      const [recalling,nearest,farther]=g.heroes.slice(1,4),friends=[recalling,nearest,farther];friends.forEach((a,i)=>{a.alive=true;a.x=100;a.y=[108,110,115][i];a.brain.next=0;a.supportUntil=0;});recalling.recall=g.time+8;refresh(g);
      for(const a of friends)H.botInput(g,a);equal(friends.filter(a=>a.supportUntil>g.time).map(a=>a.id),[nearest.id],'自動援護が最寄りの行動可能な1人に絞られていない');
      H.control(g,h,H.inputFromKeys({KeyG:true,KeyJ:true}));assert(g.rallyUntil>g.time);friends.forEach(a=>{a.brain.next=0;a.supportUntil=0;});
      for(const a of [nearest,farther]){const input=H.botInput(g,a);assert(a.supportUntil>g.time&&(input.x||input.y),'G集合に近くの複数人が応じない');}
    });
    test('初心者の入力生成は位置・能力・金・戦績・攻撃結果を水増ししない',()=>{
      for(let hero=0;hero<8;hero++){const {g,h}=arena(hero),record=()=>JSON.stringify({heroes:g.heroes.map(a=>({x:a.x,y:a.y,hp:a.hp,mana:a.mana,level:a.level,xp:a.xp,gold:a.gold,totalGold:a.totalGold,kills:a.kills,deaths:a.deaths,lastHits:a.lastHits,inventory:a.inventory,stats:H.stats(g,a)})),effects:g.effects,teams:g.teams});
        const before=record(),input=H.noviceInput(g,h);equal(record(),before,`英雄${hero}の入力生成が戦闘結果を書き換えた`);assert(input.attack,'通常場面で攻撃キーを保持しない');
      }
    });
    const marchingArena=(time,kind)=>{
      const {g,h,enemy}=arena();h.alive=false;enemy.alive=false;g.time=time;g.tick=Math.round(time*30);const soldier=minion(g,0,100,100,10000);let target;
      if(kind==='minion'){target=minion(g,1,102,100,10000);target.stunUntil=time+10;}
      else if(kind==='hero'){target=enemy;target.alive=true;target.x=102;target.y=100;}
      else{target=kind==='castle'?g.castles[1]:g.towers.find(t=>t.team===1&&!t.inner);target.alive=true;target.x=102;target.y=100;}
      refresh(g);return {g,soldier,target};
    };
    test('20分前の兵士は敵兵や英雄を攻撃する間は足を止める',()=>{
      for(const kind of ['minion','hero']){const {g,soldier,target}=marchingArena(1199.9,kind),start={x:soldier.x,y:soldier.y},hp=target.hp;H.updateUnits(g,.1);assert(target.hp<hp,kind+'に攻撃しない');close(H.dist(soldier,start),0);}
    });
    test('20分以降の兵士は敵兵や英雄を攻撃しながら担当道を前進する',()=>{
      for(const kind of ['minion','hero']){const {g,soldier,target}=marchingArena(1200,kind),progress=H.laneProgress(soldier,soldier.lane),hp=target.hp;H.updateUnits(g,.1);assert(target.hp<hp,kind+'に攻撃しない');assert(H.laneProgress(soldier,soldier.lane)>progress,kind+'との戦闘で進軍が止まった');}
    });
    test('20分以降でも兵士は塔や城を攻撃中なら足を止める',()=>{
      for(const kind of ['tower','castle']){const {g,soldier,target}=marchingArena(1200,kind),start={x:soldier.x,y:soldier.y},hp=target.hp;H.updateUnits(g,.1);assert(target.hp<hp,kind+'に攻撃しない');close(H.dist(soldier,start),0);}
    });
    const towerDefenseArena=(team=0,diff=1)=>{
      const {g,h}=arena();g.difficulty=diff;for(const e of g.entities)e.alive=false;
      const defender=g.heroes[team?6:1],backup=g.heroes[team?7:2],attacker=team?h:g.heroes[5],tower=g.towers.find(t=>t.team===team&&!t.inner);
      Object.assign(h,{alive:true,x:100,y:80});Object.assign(defender,{alive:true,bot:true,x:100,y:110});Object.assign(backup,{alive:true,bot:true,x:100,y:90});Object.assign(attacker,{alive:true,x:125,y:110});Object.assign(tower,{alive:true,x:120,y:110});
      H.hurt(g,attacker,tower,20);refresh(g);return {g,h,defender,backup,attacker,tower};
    };
    test('ふつう以上の敵botは被弾中の味方塔へ寄り、やさしいでは守備割当をしない',()=>{
      for(const diff of [0,1,2]){const {g,defender,tower}=towerDefenseArena(1,diff),before=H.dist(defender,tower),input=H.botInput(g,defender),defending=H.dist(defender.brain.goal,tower)<.001;
        equal(defending,diff>0,`難易度${diff}の塔防衛割当`);if(diff>0){assert(input.x||input.y);H.control(g,defender,input);assert(H.dist(defender,tower)<before,'塔への守備移動が成立しない');}
      }
    });
    test('塔防衛は直近の被弾と可視の敵英雄がそろう時だけ行う',()=>{
      for(const absent of ['damage','recent','visible','hero']){const {g,defender,attacker,tower}=towerDefenseArena();
        if(absent==='damage')delete tower.lastDamageAt;if(absent==='recent')g.time+=3.1;if(absent==='visible')attacker.stealthUntil=g.time+10;if(absent==='hero'){attacker.alive=false;minion(g,1,125,110);}
        refresh(g);H.botInput(g,defender);assert(H.dist(defender.brain.goal,tower)>.001,absent+'を欠いても塔へ割り当てた');
      }
    });
    test('塔防衛は代理操作役を除いた最寄りbot1人に割り当てる',()=>{
      const {g,h,defender,backup,tower}=towerDefenseArena();g.proxy=true;h.bot=true;h.x=120;h.y=109;refresh(g);
      H.botInput(g,defender);H.botInput(g,backup);assert(H.dist(defender.brain.goal,tower)<.001,'最寄りの手操作/代理役を除外できない');assert(H.dist(backup.brain.goal,tower)>.001,'遠い仲間まで同じ塔へ割り当てた');
    });
    test('有効なG集合は塔防衛より優先し、味方は塔でなく自分へ寄る',()=>{
      const {g,h,defender,tower}=towerDefenseArena();H.control(g,h,H.inputFromKeys({KeyG:true}));const before=H.dist(defender,h),input=H.botInput(g,defender);
      assert(defender.supportUntil>g.time,'塔防衛に阻まれてG集合へ応じない');assert(H.dist(defender.brain.goal,tower)>1&&H.dist(defender.brain.goal,h)<5);H.control(g,defender,input);assert(H.dist(defender,h)<before,'G集合の公開移動入力が自分から離れた');
    });
    return results;
  };
})(globalThis.HONJIN);
