(function(H){
'use strict';
H.Audio=class{
 constructor(muted=false){this.muted=muted;this.volume=.35;this.context=null;this.master=null;this.lastEvent=0;this.nextMusic=0;this.musicStep=0;this.suspended=false;}
 unlock(){if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;try{this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=this.muted?0:this.volume;this.master.connect(this.context.destination);}catch(_){return;}}if(this.context.state==='suspended')this.context.resume().catch(()=>{});}
 setVolume(value){this.volume=H.clamp(value,0,1);this.muted=this.volume===0;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.context.currentTime,.08);}
 setMuted(value){this.muted=!!value;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:this.volume,this.context.currentTime,.08);}
 suspend(){this.suspended=true;if(this.context)this.context.suspend().catch(()=>{});}
 resume(){this.suspended=false;if(this.context)this.context.resume().catch(()=>{});}
 tone(frequency,duration=.2,type='sine',gain=.1,delay=0,endFrequency){const c=this.context;if(!c||this.muted||this.suspended)return;const t=c.currentTime+delay,o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);if(endFrequency)o.frequency.exponentialRampToValueAtTime(Math.max(10,endFrequency),t+duration);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.012);v.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+duration+.03);o.onended=()=>{o.disconnect();v.disconnect();};}
 noise(duration=.15,gain=.08,filter=1400){const c=this.context;if(!c||this.muted||this.suspended)return;const length=Math.ceil(c.sampleRate*duration),buffer=c.createBuffer(1,length,c.sampleRate),data=buffer.getChannelData(0);let state=731;for(let i=0;i<length;i++){state=(Math.imul(state,1664525)+1013904223)|0;data[i]=((state>>>0)/4294967296*2-1)*(1-i/length);}const source=c.createBufferSource(),f=c.createBiquadFilter(),v=c.createGain();source.buffer=buffer;f.type='lowpass';f.frequency.value=filter;v.gain.value=gain;source.connect(f);f.connect(v);v.connect(this.master);source.start();source.onended=()=>{source.disconnect();f.disconnect();v.disconnect();};}
 update(g,followId){if(!this.context||this.suspended)return;const follow=g.byId[followId];for(const e of g.events){if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;const source=g.byId[e.source],p=e.x!==undefined?e:source,audible=e.type==='giant'||e.type==='victory'||p&&follow&&H.dist(p,follow)<48;if(!audible)continue;if(e.type==='attack'&&e.source===followId){this.tone(150+(source.hero||0)*32,.1,'triangle',.05,0,90);}
  else if(e.type==='cast'){const root=[220,392,262,110,330,440,82,196][e.hero],n=e.index;if(n===3){for(let i=0;i<5;i++)this.tone(root*[1,1.5,2,2.5,3][i],.7,'triangle',.055,i*.07);this.noise(.45,.065,850);}else{this.tone(root*(1+n*.33),.16+n*.08,e.hero===6?'sawtooth':'triangle',.065,0,root*(1.7+n*.2));this.tone(root*2,.32,'sine',.025,.07);}}
  else if(e.type==='death'&&e.kind==='tower'){this.noise(.8,.14,500);this.tone(65,.8,'triangle',.08,0,25);}
  else if(e.type==='death'&&e.kind==='hero'){[392,330,262].forEach((v,i)=>this.tone(v,.35,'sine',.055,i*.08));}
  else if(e.type==='giant'){this.noise(1.8,.2,280);[55,82.4,110,164.8].forEach((v,i)=>this.tone(v,2.1,'triangle',.085,i*.16));}
  else if(e.type==='victory'){[196,247,294,392,494,588].forEach((v,i)=>this.tone(v,1.1,'triangle',.07,i*.16));}
  else if(e.type==='level'&&e.target===followId){[440,554,659].forEach((v,i)=>this.tone(v,.25,'sine',.05,i*.07));}
  else if(e.type==='buy'&&e.source===followId){this.tone(880,.12,'sine',.04);this.tone(1320,.2,'sine',.03,.08);}}
  // Quiet original five-note accompaniment, synthesized rather than sampled.
  if(g.time>=this.nextMusic&&!this.muted){this.nextMusic=g.time+2.4;const scale=[146.83,196,220,261.63,293.66,220,196,164.81],f=scale[this.musicStep++%scale.length];this.tone(f,.95,'sine',.012);this.tone(f/2,1.8,'triangle',.009);if(this.musicStep%4===0)this.tone(f*1.5,1.5,'sine',.008,.3);}
 }
 reset(){this.lastEvent=0;this.nextMusic=0;this.musicStep=0;}
};
})(globalThis.HONJIN);
