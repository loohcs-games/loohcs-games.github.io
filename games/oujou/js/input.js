(function (H) {
  'use strict';
  H.inputFromKeys = keys => ({ x:((keys.KeyD||keys.ArrowRight)?1:0)-((keys.KeyA||keys.ArrowLeft)?1:0),y:((keys.KeyS||keys.ArrowDown)?1:0)-((keys.KeyW||keys.ArrowUp)?1:0), attack:!!(keys.KeyJ||keys.KeyZ), skills:[!!(keys.KeyU||keys.KeyX),!!(keys.KeyI||keys.KeyC),!!(keys.KeyO||keys.KeyV),!!(keys.KeyP||keys.KeyF||keys.Space)], cycle:!!keys.KeyQ, heroesOnly:!!(keys.ShiftLeft||keys.ShiftRight),recall:!!keys.KeyB,rally:!!keys.KeyG });
  H.emptyInput = () => ({x:0,y:0,attack:false,skills:[false,false,false,false]});
  H.selectTarget = (g,h,input) => {
    const s=H.stats(g,h),reach=s.range+7,candidates=H.near(g,h,reach).filter(e=>e.team!==h.team&&e.alive&&(!input.heroesOnly||e.kind==='hero')&&H.visible(g,h.team,e)&&H.vulnerable(g,e));
    const score=e=>{const d=H.dist(h,e),dot=((e.x-h.x)*h.fx+(e.y-h.y)*h.fy)/(d||1);return (1-dot)*8+d*.55+(e.hp/e.maxHp)*4+(e.kind==='camp'?3:0);};
    candidates.sort((a,b)=>score(a)-score(b)||a.id-b.id);
    if(input.cycle&&!h.prevInput.cycle&&candidates.length){const i=candidates.findIndex(e=>e.id===h.target);h.target=candidates[(i+1)%candidates.length].id;h.targetLock=g.time+3;}
    else if(!(h.targetLock>g.time&&candidates.some(e=>e.id===h.target)))h.target=candidates.length?candidates[0].id:null;
    return g.byId[h.target]||null;
  };
  H.aim = (g,h,skill,target) => {let dx=h.fx,dy=h.fy,x=h.x+dx*skill.range*.72,y=h.y+dy*skill.range*.72;if(target){const lead=Math.min(skill.delay,.65);x=target.x+(target.vx||0)*lead;y=target.y+(target.vy||0)*lead;dx=x-h.x;dy=y-h.y;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;if(d>skill.range){x=h.x+dx*skill.range;y=h.y+dy*skill.range;}}return {x,y,dx,dy};};
})(globalThis.HONJIN);
