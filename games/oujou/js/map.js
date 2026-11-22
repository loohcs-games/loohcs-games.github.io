(function (H) {
  'use strict';
  const M = H.map = { size: 200, bases: [{x:16,y:184},{x:184,y:16}],
    fountains: [{x:8,y:192},{x:192,y:8}],
    lanes: [ [{x:16,y:184},{x:16,y:34},{x:34,y:16},{x:184,y:16}], [{x:16,y:184},{x:184,y:16}], [{x:16,y:184},{x:166,y:184},{x:184,y:166},{x:184,y:16}] ],
    obstacles: [], bushes: [{x:30,y:86,r:8},{x:114,y:170,r:8},{x:66,y:112,r:8},{x:88,y:134,r:8}],
    camps: [{x:44,y:143,name:'スライム',type:'slime'},{x:57,y:156,name:'ゴブリン',type:'goblin'},{x:40,y:113,name:'魔狼',type:'wolf'},{x:87,y:160,name:'グリフォン',type:'griffin'}],
    bosses: [{x:65,y:65,name:'水竜',type:'water',spawn:180},{x:135,y:135,name:'古竜',type:'ancient',spawn:420}]
  };
  M.bushes.push(...M.bushes.map(p=>({x:200-p.x,y:200-p.y,r:p.r})));
  M.camps.push(...M.camps.map(p=>({...p,x:p.y,y:p.x})));
  M.bushes.push(...M.bushes.map(p=>({x:p.y,y:p.x,r:p.r})).filter(p=>!M.bushes.some(b=>b.x===p.x&&b.y===p.y)));
  const seeds = [[38,70,6],[48,83,5],[61,91,6],[78,134,6],[100,151,5],[123,160,6],[53,130,4],[80,168,4],[32,153,4],[45,47,6],[145,164,5]];
  for(const [x,y,r] of seeds) { M.obstacles.push({x,y,r,type:(x%2?'rock':'tree')},{x:200-x,y:200-y,r,type:(x%2?'rock':'tree')}); }
  M.obstacles.push(...M.obstacles.map(o=>({...o,x:o.y,y:o.x})).filter(p=>!M.obstacles.some(o=>o.x===p.x&&o.y===p.y)));
  H.segmentDistance = (p,a,b) => {const dx=b.x-a.x,dy=b.y-a.y,t=H.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1); return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  H.lanePoint = (lane, t) => { const ps=M.lanes[lane],lens=ps.slice(1).map((p,i)=>H.dist(p,ps[i])),total=lens.reduce((a,b)=>a+b,0); let n=H.clamp(t,0,1)*total; for(let i=0;i<lens.length;i++) {if(n<=lens[i]) return {x:ps[i].x+(ps[i+1].x-ps[i].x)*n/lens[i],y:ps[i].y+(ps[i+1].y-ps[i].y)*n/lens[i]}; n-=lens[i];} return {...ps[ps.length-1]}; };
  H.laneProgress = (p,lane) => {const ps=M.lanes[lane]; let best=1e9,at=0,sofar=0,total=0; for(let i=1;i<ps.length;i++) total+=H.dist(ps[i],ps[i-1]); for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],len=H.dist(a,b),t=H.clamp(((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(len*len),0,1),d=H.dist(p,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}); if(d<best){best=d;at=(sofar+len*t)/total;}sofar+=len;} return at;};
  H.bushAt = p => M.bushes.findIndex(b=>H.dist(p,b)<b.r);
  H.inRiver = p => Math.abs(p.x-p.y)<5;
  H.inBase = h => H.dist(h,M.fountains[h.team]) < 11;
  H.walkable = (g,x,y,r=1) => x>3&&x<197&&y>3&&y<197&&!M.obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<o.r+r)&&!g.walls.some(w=>w.until>g.time&&H.segmentDistance({x,y},w.a,w.b)<r+1);
  H.move = (g,e,dx,dy,speed,dt=H.DT) => {const l=Math.hypot(dx,dy); if(l<.001)return;dx/=l;dy/=l; const amount=speed*dt*(H.inRiver(e)?.76:1)*(e.slowUntil>g.time?.55:1); let x=e.x+dx*amount,y=e.y+dy*amount; if(H.walkable(g,x,y,e.radius||1)){e.x=x;e.y=y;} else {const xFirst=Math.abs(dx)>Math.abs(dy)||Math.abs(dx)===Math.abs(dy)&&(e.team===0||e.team<0&&e.x<e.y);if(xFirst){if(H.walkable(g,x,e.y,e.radius||1))e.x=x;else if(H.walkable(g,e.x,y,e.radius||1))e.y=y;}else{if(H.walkable(g,e.x,y,e.radius||1))e.y=y;else if(H.walkable(g,x,e.y,e.radius||1))e.x=x;}} e.fx=dx;e.fy=dy; };
  // Navigation edges, not just their endpoints, must clear the round rocks and trees.
  H.clearPath = (g,a,b,r=1.2) => {
    if(M.obstacles.some(o=>H.segmentDistance(o,a,b)<o.r+r))return false;
    const cross=(p,q,v)=>(q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x);
    return !g.walls.some(w=>w.until>g.time&&((Math.max(a.x,b.x)>=Math.min(w.a.x,w.b.x)&&Math.max(w.a.x,w.b.x)>=Math.min(a.x,b.x)&&Math.max(a.y,b.y)>=Math.min(w.a.y,w.b.y)&&Math.max(w.a.y,w.b.y)>=Math.min(a.y,b.y)&&cross(a,b,w.a)*cross(a,b,w.b)<=0&&cross(w.a,w.b,a)*cross(w.a,w.b,b)<=0)||Math.min(H.segmentDistance(a,w.a,w.b),H.segmentDistance(b,w.a,w.b),H.segmentDistance(w.a,a,b),H.segmentDistance(w.b,a,b))<r+1));
  };
  const cell=5,N=40,cache=new Map(),nodes=[],edges=[];
  const staticWorld={walls:[],time:0};
  for(let i=0;i<N*N;i++){const p={x:(i%N+.5)*cell,y:(Math.floor(i/N)+.5)*cell};nodes[i]=H.walkable(staticWorld,p.x,p.y,1.6)?p:null;}
  for(let i=0;i<nodes.length;i++){
    edges[i]=[];if(!nodes[i])continue;const x=i%N,y=Math.floor(i/N);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy,j=nx+ny*N;
      if((!dx&&!dy)||nx<0||ny<0||nx>=N||ny>=N||!nodes[j])continue;
      if(H.clearPath(staticWorld,nodes[i],nodes[j],1.25))edges[i].push([j,Math.hypot(dx,dy)]);
    }
  }
  H.navigate = (g,from,to) => {
    if(H.clearPath(g,from,to,1.8))return to;
    let key=H.clamp(Math.floor(to.x/cell),0,N-1)+H.clamp(Math.floor(to.y/cell),0,N-1)*N;
    if(!nodes[key]){let best=Infinity;for(let i=0;i<nodes.length;i++)if(nodes[i]){const d=H.dist(nodes[i],to);if(d<best&&H.clearPath(staticWorld,nodes[i],to,1)){key=i;best=d;}}}
    let field=cache.get(key);
    if(!field){field=new Float64Array(N*N).fill(Infinity);field[key]=0;const q=[key];for(let i=0;i<q.length;i++){const k=q[i];for(const [j,cost] of edges[k]||[]){const d=field[k]+cost;if(d<field[j]-1e-9){field[j]=d;q.push(j);}}}cache.set(key,field);}
    const sx=Math.floor(from.x/cell),sy=Math.floor(from.y/cell);let best=Infinity,p=to;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const x=sx+dx,y=sy+dy,j=x+y*N,n=nodes[j];if(x<0||y<0||x>=N||y>=N||!n||!Number.isFinite(field[j])||H.dist(from,n)<1||!H.clearPath(g,from,n,1.15))continue;
      const cross=((to.x-from.x)*(n.y-from.y)-(to.y-from.y)*(n.x-from.x))/(H.dist(from,to)||1);
      const v=field[j]+H.dist(from,n)*.025+cross*.00001*(from.team===1?-1:1);
      if(v<best){best=v;p=n;}
    }
    return p;
  };
})(globalThis.HONJIN);
