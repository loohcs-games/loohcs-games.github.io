(() => {
  'use strict';
  const O = OOKAMI, Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
  const KEY = 'ookami-oboegaki', SETTINGS_KEY = 'ookami-display';
  const preview = Q.has('test') || Q.has('auto') || Q.has('route') || Q.has('skip');
  const onSite = /\/games\/[^/]+\/(index\.html)?$/.test(location.pathname);
  const mobile = matchMedia('(max-width: 860px)');
  let S = O.newPersist(), soundOn = false;
  try {
    if (!Q.has('fresh') && !preview) S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}'));
    soundOn = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').sound === true;
  } catch (_) {}
  if (Q.has('stage')) S.catStage = Math.max(0, Math.min(3, parseInt(Q.get('stage'), 10) || 0));  // 猫の段階を指定して始める（確認用）
  const save = () => { if (!preview) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} } };
  let g = null, view = null, sel = 0, ui = 'title', keyboardNav = false, notesOpen = false;
  let previousSound = null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const SKY = ['#101a2a','#101929','#0e1727','#0c1424','#0a1220','#09101d','#080e1a','#080d17','#070b14','#070b14','#070b14','#080c15','#0a0f18','#0b101a','#0c111b','#0e1420','#141e2a','#25313e','#35434e','#52616b'];
  function sky(T) { document.documentElement.style.setProperty('--sky1', SKY[Math.max(0, Math.min(19,T-1))]); }
  function show(name) {
    ui = name;
    for (const id of ['title','howto','play','gallery']) $(id).hidden = id !== name;
    $('back').hidden = !(onSite && name === 'title');
    setNotes(false);
    if (name === 'title') {
      sky(1);
      $('go3').hidden = !(S.seen || []).length;
      const d = (S.deathKinds || []).length;
      $('found').textContent = S.ends.length || d ? '見つけた結末 ' + S.ends.length + ' / 5　　死 ' + d + ' / ' + O.deathCount() : '';
      if (keyboardNav) $('go1').focus({preventScroll:true});
    }
    if (name === 'howto' && keyboardNav) $('how-heading').focus({preventScroll:true});
    if (name === 'gallery' && keyboardNav) $('gallery-heading').focus({preventScroll:true});
    syncNotes();
  }
  function notesAvailable() { return !!g && (S.deaths > 0 || S.ends.length > 0 || preview); }
  function syncNotes() {
    const available = ui === 'play' && notesAvailable();
    $('board').hidden = !available;
    $('notes-toggle').hidden = !available;
    const opened = available && mobile.matches && notesOpen;
    document.body.classList.toggle('notes-open', opened);
    $('notes-toggle').setAttribute('aria-expanded', String(opened));
    $('notes-toggle').textContent = opened ? '物語へ戻る' : 'おぼえがき';
    $('panel').inert = opened;
    if (!mobile.matches) $('panel').inert = false;
  }
  function setNotes(opened) {
    notesOpen = opened;
    syncNotes();
    if (opened && mobile.matches && keyboardNav) $('board-heading').focus({preventScroll:true});
  }
  mobile.addEventListener('change', () => { setNotes(false); });
  function buildGrid() {
    $('grid').innerHTML = '<thead><tr><th class="t" scope="col">時刻</th>' + O.P.map(p => '<th scope="col">' + O.NAME[p] + '</th>').join('') + '</tr></thead><tbody>' +
      Array.from({length:20}, (_,i) => {
        const T=i+1;
        return '<tr data-t="' + T + '"><td class="t">' + O.TIME(T) + '</td>' + O.P.map(p => '<td data-t="' + T + '" data-p="' + p + '"><span class="m"></span></td>').join('') + '</tr>';
      }).join('') + '</tbody>';
    function activate(td) {
      if (!td || !view) return;
      const T=+td.dataset.t, p=td.dataset.p;
      if (view.kind === 'scene') {
        const i=view.choices.findIndex(c => c.move === p && T === g.T+1);
        if (i >= 0) { setNotes(false); choose(i); return; }
      }
    }
    $('grid').addEventListener('click', e => activate(e.target.closest('td[data-p]')));
    $('grid').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); activate(e.target.closest('td[data-p]')); }
    });
  }
  function drawGrid() {
    if (!g) return;
    const pathSet=new Set(g.path.map(([T,p]) => T+':'+p));
    const pick=view.kind === 'scene' && view.choices[sel] && view.choices[sel].move;
    for (const td of $('grid').querySelectorAll('td[data-p]')) {
      const T=+td.dataset.t,p=td.dataset.p,k=T+':'+p,m=S.marks[k] || [];
      td.className=m.join(' ');
      if (pathSet.has(k)) td.classList.add('path');
      const here=T===g.T && p===g.pos;
      if (here) td.classList.add('here');
      if (here && g.alive) td.classList.remove('x', 'wolf');  // 生きて立っているマスは、前の夜の死の印より ★ を優先する
      const can=view.kind==='scene' && T===g.T+1 && view.choices.some(c=>c.move===p);
      if (can) td.classList.add('can');
      if (pick && T===g.T+1 && p===pick) td.classList.add('pick');
      td.querySelector('.m').textContent=m.includes('cat') ? (m.includes('vamp') ? '猫彼' : '猫') : (m.includes('vamp') ? '彼' : '');
      const details=m.map(x=>({me:'通った場所',x:'死',wolf:'狼',cat:'猫',vamp:'彼',near:'気配'})[x]).filter(Boolean);
      td.setAttribute('aria-label',O.TIME(T)+' '+O.NAME[p]+(here?' 現在地':'')+(details.length?' '+details.join('、'):'')+(can?' ここへ進む':''));
      if (can) { td.tabIndex=0; td.setAttribute('role','button'); } else { td.removeAttribute('tabindex'); td.removeAttribute('role'); }
    }
    for (const tr of $('grid').querySelectorAll('tr[data-t]')) {
      tr.classList.toggle('now',+tr.dataset.t===g.T);
      tr.classList.toggle('dim',+tr.dataset.t<g.T);
    }
    $('hints').innerHTML=S.hints.map(h=>'<li>'+esc(h)+'</li>').join('');
    $('seen').textContent=(S.seen || []).length ? '見たもの　'+S.seen.length+' / '+O.SEEN.length : '';
    $('board-time').textContent=O.TIME(Math.min(g.T,21));
  }

  // Artwork stays optional. Strings work as before; a scene may also be
  // { src: 'img/example.png', figure: true } when it needs a separate figure.
  // A complete scene suppresses the extra figure by default.
  const ART=window.OOKAMI_ART || {girl:{},cat:{},man:{},sleep:{},wolf:{},bg:{},scene:{},gallery:{},scale:3};
  const artFor=(who,mood)=>(ART[who] && (ART[who][mood] || ART[who].neutral)) || null;
  const artSource=art=>typeof art==='string'?art:art?.src;
  const hasText=id=>view.id===id || (view.tids || []).includes(id);
  function currentAppearance() {
    // engine の who は猫／少女を同じ存在として扱う。描く姿は直近の本文に合わせる。
    const logicalWho=view.who!==undefined?view.who:(g.who || '');
    const ids=[view.id,...(view.tids || [])];
    for(const id of ids.reverse()){
      if(id==='cat-corpse')return {who:'cat',mood:'corpse'};
      if(/^flee-(17|18|19|20)$/.test(id))return {who:'cat',mood:'neutral'};
      if(id==='flee-16' || /^climax-after(?:-again)?$/.test(id))return {who:'girl',mood:'carried'};
      if(id==='climax-burst')return {who:'girl',mood:'power'};
      if(id==='climax-offer-2')return {who:'girl',mood:'sad'};
      if(/^contract-/.test(id))return {who:'girl',mood:'smile'};
      if(/^cat-offer(?:-|$)/.test(id))return {who:'girl',mood:'smile'};
      if(/^cat-(ask|yakata|tell-name|wait)(?:-|$)/.test(id))return {who:'girl',mood:'close'};
      if(id==='vamp-sleeps')return {who:'sleep',mood:'neutral'};
      if(id==='cat-leave-15')return logicalWho && logicalWho!=='cat'?{who:logicalWho}:{who:'cat',mood:'run'};
    }
    return {who:logicalWho};
  }
  const currentActor=()=>currentAppearance().who;
  const phaseOf=T=>T<=7?'evening':T<=13?'midnight':T<=17?'late':'dawn';
  const seatedGirl=(who,mood)=>who==='girl' && mood!=='carried' && g.pos==='kyokai' &&
    (g.T===9 || hasText('girl-walk-kyokai') || hasText('girl-stay-kyokai'));
  function sceneArt() {
    if (ART.scene[view.id]) return ART.scene[view.id];
    // Prefer the most specific text contributing to the current scene.
    // Never call O.tx() here: it mutates the engine's text-audit state.
    for (const id of [...(view.tids || [])].reverse()) if (ART.scene[id]) return ART.scene[id];
    return null;
  }
  function sceneImage() {
    const art=sceneArt();
    if (art) return {src:typeof art==='string'?art:art.src,figure:typeof art==='object' && art.figure===true};
    // An unfinished time band keeps the placeholder; do not show a night painting at dawn.
    const bg=ART.bg[g.pos];
    const appearance=currentAppearance();
    if(seatedGirl(appearance.who,appearance.mood)){
      const seated=bg?.seated?.[g.T>=12?'late':'midnight'];
      if(seated)return {src:artSource(seated),figure:false,exposure:seated.exposure ?? 1};
    }
    let entry=typeof bg==='string'?bg:bg && bg[phaseOf(g.T)];
    if(g.pos==='heya' && g.T>=16 && g.T<18)entry=bg?.unlit || entry;
    if(g.pos==='kyokai' && g.T>=12 && g.T<18)entry=bg?.late || entry;
    if(g.pos==='mori' && g.T===13)entry=bg?.fallen || entry;
    if (!entry) return null;
    return typeof entry==='string' ? {src:entry,figure:true,exposure:1} :
      {src:entry.src,figure:true,exposure:Math.max(0,Math.min(1,entry.exposure ?? 1))};
  }
  // Quiet, code-native placeholders. No state-dependent clues are painted in:
  // inscriptions, flowers, bottles and changing scratches belong to final art.
  const PLACE = {
    heya:'<path fill="#10151d" d="M0 0h400v160H0z"/><path fill="#2a3647" d="M262 20h68v76h-68z"/><path stroke="#10151d" stroke-width="6" d="M296 20v76m-34-38h68"/><path fill="#080b11" d="M31 25h55v117H31z"/><path fill="#1a2029" d="M106 119h119v26H106z"/><path fill="#242b33" d="M109 112h109l13 12H103z"/><path stroke="#343a42" d="M106 145v15m120-15v15M0 144h400"/><path fill="#20252d" d="M242 136h30v21h-30z"/><path fill="none" stroke="#323842" d="M250 137v-5h14v5"/>',
    hiroba:'<path fill="#111822" d="M0 77l50-31 47 31v83H0zm97 15 54-38 53 38v68H97zm186-8 57-40 60 40v76H283z"/><path fill="#090e16" d="M28 99h28v61H28zm93 10h28v51h-28zm206-12h28v63h-28z"/><path stroke="#1c2532" d="M0 138h400m-390 12h160m120 2h100"/><ellipse fill="#202a36" cx="235" cy="133" rx="40" ry="10"/><path fill="#1a2330" d="M195 132v20q40 17 80 0v-20z"/><ellipse fill="#090e15" cx="235" cy="131" rx="31" ry="6"/><path stroke="#303744" d="M235 78v51"/><path fill="#18212e" d="M192 76l43-24 43 24z"/>',
    kyokai:'<path fill="#101722" d="M0 0h400v160H0z"/><path fill="#1d2a3c" d="M197 17q20-28 40 0v60h-40z"/><path stroke="#101722" stroke-width="5" d="M217 0v77m-20-43h40"/><path fill="#18202c" d="M171 96h93v18h-93z"/><path fill="#242b35" d="M164 90h108v7H164z"/><path fill="#060b12" d="M30 0h41v160H30zm306 0h41v160h-41z"/><g fill="#19212c"><path d="M91 103h63v7H91zm-9 15h72v8H82zm-10 17h82v9H72zm-14 19h96v6H58zM279 103h38v7h-38zm0 15h49v8h-49zm0 17h63v9h-63zm0 19h78v6h-78z"/></g><path fill="#1e2734" d="M154 160l31-46h65l29 46z"/><path stroke="#333541" d="M320 10v104"/>',
    bochi:'<path fill="#111b26" d="M0 111q140-27 250 0t150-9v58H0z"/><g fill="#232d38"><path d="M65 94q13-20 26 0v53H65zM117 106h20v46h-20zM164 95h31v62h-31zM286 72q22-30 44 0v70h-44zM345 112h24v44h-24z"/></g><path fill="#0b111a" d="M0 151q120-14 220 3t180-8v14H0z"/><g stroke="#111a23" stroke-width="3"><path d="M28 143V49m0 39L9 65m19 10 18-28M253 133V29m0 49-23-27m23 12 20-35"/></g>',
    yakata:'<path fill="#101620" d="M0 0h400v160H0z"/><g fill="#202b3b"><path d="M26 18h24v76H26zm42 0h24v76H68zm42 0h24v76h-24zm42 0h24v76h-24zm42 0h24v76h-24zm42 0h24v76h-24zm42 0h24v76h-24z"/></g><path fill="#251e25" d="M55 160l82-52h137l72 52z"/><path fill="#070c12" d="M333 62h38v84h-38z"/><path fill="#20212c" d="M166 115h87v22h-87z"/><path stroke="#34303b" stroke-width="3" d="M161 109v31m97-31v31"/><path stroke="#252a33" d="M0 131h72v-15h21v-15h19"/><path fill="#18202a" d="M308 26h24v30h-24z"/>',
    mori:'<path fill="#111e2a" d="M0 109q80-24 169 2t231-10v59H0z"/><g fill="#0a121d"><path d="M12 0h10v160H12zm57 0h9v160h-9zm79 0h12v160h-12zm104 0h8v160h-8zm71 0h13v160h-13zm62 0h15v160h-15z"/><path d="M-18 42 16 4l40 56-26-9 24 38H-5l22-30zm50 15L72 9l49 65-34-15 28 47H32l33-48zm77-10 42-43 47 63-32-12 30 46h-92l40-51zm106 13L256 6l43 64-26-13 22 42h-79l33-42zm72-15 43-42 53 64-37-13 25 48h-89l42-48z"/></g><path fill="#17212b" d="M172 160q18-24 18-46 11 21 32 46z"/>',
    kawa:'<path fill="#121e2c" d="M0 105h400v55H0z"/><path fill="#080f19" d="M0 113q70-22 133-12t78 20l-46 39H0z"/><path fill="#141c28" d="M283 58h97v79h-97z"/><path fill="#0b121d" d="M271 59l61-38 60 38z"/><path fill="#080d15" d="M343 89h21v48h-21z"/><circle cx="283" cy="112" r="29" fill="#101823" stroke="#2c3440" stroke-width="5"/><g stroke="#28323e" stroke-width="3"><path d="M254 112h58m-29-29v58m-21-50 42 42m-42 0 42-42"/></g><path fill="#2b3440" d="M96 130l17-9h26l15 10-8 8h-43z"/><g stroke="#253345"><path d="M211 146h44m60 5h33m-148-15h29m117 3h35"/></g>',
    mon:'<path fill="#111925" d="M0 0h68v160H0zm264 0h136v160H264z"/><path fill="#070d16" d="M72 36h188v124H72z"/><path fill="#1b2633" d="M76 39h86v121H76zm92 0h87v121h-87z"/><path stroke="#101722" stroke-width="2" d="M95 39v121m20-121v121m20-121v121m51-121v121m20-121v121m20-121v121"/><path fill="#2b3036" d="M65 28h204v12H65zM82 105h167v10H82z"/><path fill="#1d2733" d="M278 47h90v9h-90zM288 56h7v104h-7zm65 0h7v104h-7z"/><path stroke="#2a3340" stroke-width="3" d="M313 73v87m20-87v87m-20-68h20m-20 18h20m-20 18h20m-20 18h20"/>'
  };
  const SHAPE={
    cat:'<path fill="#cfcfc6" d="M-10 0q-5-7 0-14l6-3q-1-7 3-9l2-5 4 4 4-2 3 5q5 5 0 10l-4 1 2 13z"/><path fill="none" stroke="#cfcfc6" stroke-width="3" d="M-10-2q-16 1-11-10"/>',
    girl:'<path fill="#b9bfcb" d="M-11-62q-2-18 12-18 15 1 13 20l-3 20h-19z"/><path fill="#ded9cf" d="M-7-64q0-9 8-9 8 0 8 9l-2 9H-4z"/><path fill="#b8bfca" d="M-9-59-6-48h14l5-13z"/><path fill="#cccfcf" d="M-8-49h17l7 39q-16 6-31 0z"/><path stroke="#ded9cf" stroke-width="3" d="M-5-9v9m13-9v9"/><path fill="#9ba5b8" d="M-8-45-9-22h-5zm17 0 6 24h-4z"/><path fill="#a2acbe" d="M-8-73-3-84l4 8m5 0 6-7 2 13"/>',
    man:'<path fill="#a8a5ab" d="M-6-79q0-10 8-10 8 1 7 12l-3 9H-2z"/><path fill="#252534" d="M-9-79q-3-16 10-16 14 0 11 18l-6-6-15 1z"/><path fill="#343341" d="M-10-67 1-70l13 6 6 55-17-4-20 4z"/><path fill="#252534" d="M-8-11h8v11h-10zm12 0h9l2 11H5z"/><path stroke="#56505d" d="M-8-64 1-51l9-13M1-51v35"/><path fill="#2a2937" d="M-10-62-9-29h-10l3-28z"/>',
    sleep:'<path fill="#343341" d="M-42-10h79l13 10h-95z"/><ellipse fill="#aaa8af" cx="-43" cy="-10" rx="8" ry="7"/>',
    wolf:'<path fill="#1b202b" stroke="#424654" stroke-width=".8" d="M-66-11-62-35-47-47-17-51 15-43 34-50 44-66 51-51 61-61 63-42 79-33 74-18 50-15 38 0H25l3-21-32 2-16 20h-14l7-26-22 5-5 21h-12l-1-22z"/><path fill="#ae8d79" d="M60-37h3v2h-3z"/>'
  };
  let renderedMood='neutral';
  function moodFor(who) {
    const appearance=currentAppearance();
    if (appearance.who===who && appearance.mood) return appearance.mood;
    if (who==='wolf' && view.kind==='death') return 'attack';
    if (who==='cat' && S.catStage===0) return 'aloof';
    if (view.mood) return view.mood;
    if (who==='girl') {
      if (/^contract-|^end-1$/.test(view.id)) return 'smile';
      if (view.id==='death-home' || /^girl-apology(?:-again)?$/.test(view.id) || /^cat-kyokai-09(?:-again)?$/.test(view.id) || (g.T===9 && view.id==='kyokai-09')) return 'sad';
      if (/^cat-(ask|offer|yakata|tell-name|wait)/.test(view.id) || (g.T>=15 && g.T<=19 && g.cat.state==='free' && g.pos==='yakata')) return 'close';
    }
    if (who==='man') {
      if (view.kind==='death' || view.id==='vamp-provoke' || g.vamp.angry) return 'angry';
      if (/^vamp-talk|^vamp-hiroba/.test(view.id) || (g.T===8 && g.pos==='hiroba')) return 'talk';
    }
    return 'neutral';
  }
  function figure(who,mood) {
    if (who==='cat' && /^cat-cold-[12]$/.test(view.id)) return '';
    // 腕の中の少女と主人公の身体は描かず、重さや息は本文で伝える。
    if (who==='girl' && mood==='carried') return '';
    const seated=seatedGirl(who,mood);
    const art=artFor(who,seated?'seated':mood);
    const onWell=who==='cat' && g.pos==='hiroba' && (view.id==='hiroba-02' || view.id==='cat-cold-hiroba' || view.id==='cat-hiroba-02');
    const onBeam=who==='cat' && g.pos==='mon' && S.catStage<2 && !hasText('cat-cold-0');
    const onShoulder=who==='cat' && ['flee-17','flee-18','flee-19','flee-20'].some(hasText);
    const corpse=who==='cat' && mood==='corpse';
    const x=corpse?331:onShoulder?336:seated?154:who==='man'?(g.pos==='hiroba' && g.T===8?180:292):who==='wolf'?231:who==='sleep'?241:onWell?110:onBeam?263:who==='cat' && g.pos==='kawa'?65:who==='cat' && mood==='aloof'?173:110;
    const floor=corpse?82:onShoulder?182:seated?155:who==='sleep'?103:onWell?108:onBeam?44:who==='cat' && g.pos==='kawa'?132:149;
    if (art) {
      const w=corpse?30:onShoulder?64:onWell?20:onBeam?24:who==='wolf'?280:who==='sleep'?116:who==='cat'?42:64;
      const h=corpse?13:onShoulder?64:seated?70:onWell?19:onBeam?23:who==='wolf'?128:who==='sleep'?39:who==='cat'?40:who==='girl'?84:104;
      return '<image data-character="'+esc(who)+'" data-mood="'+esc(mood)+'" href="'+esc(artSource(art))+'" x="'+(x-w/2)+'" y="'+(floor-h)+'" width="'+w+'" height="'+h+'" preserveAspectRatio="xMidYMax meet" style="image-rendering:pixelated"/>';
    }
    return SHAPE[who] ? '<g transform="translate('+x+' '+floor+')">'+SHAPE[who]+'</g>' : '';
  }
  function sceneDetails() {
    if(g.pos==='bochi' && g.T>=6){
      // 奥の墓石の前。白いものを石塀の上に置かず、花の横の土に置く。
      const blue=g.T>=18?'#667d98':'#343c50';
      return '<g data-detail="grave-flower" shape-rendering="crispEdges"><path stroke="#756c62" stroke-width=".45" d="M352 78l-3-5m3 5l1-4m-1 4l-4-2"/><path fill="'+blue+'" d="M348 72h2v1h1v1h-3zM352 73h2v2h-2zM347 75h2v2h-2z"/></g>';
    }
    if(g.pos!=='mon')return '';
    // 数が手がかりになる鋲は、絵の生成任せにせず正確に描く。
    const rows=[17,30,76,89,102,115,128];
    let out='<g data-detail="gate-studs">';
    for(let row=0;row<7;row++)for(let col=0;col<12;col++){
      const x=95+col*18,y=rows[row];
      if(row===0 && col===9){out+='<circle data-stud-hole cx="'+x+'" cy="'+y+'" r="1.15" fill="#030508" stroke="#44392e" stroke-width=".3"/>';continue;}
      out+='<path data-stud fill="#171d27" stroke="#444b55" stroke-width=".25" d="M'+x+' '+(y-1.35)+'l1.35 1.35-1.35 1.35-1.35-1.35z"/>';
    }
    const cuts=g.T>=12?8:7;
    for(let i=0;i<cuts;i++)out+='<path data-claw fill="none" stroke="'+(i===7?'#9a8975':'#574739')+'" stroke-width=".45" d="M'+(176+i*2.5)+' 47l-1.6 7"/>';
    return out+'</g>';
  }
  function sceneFigures(who,mood) {
    const sleeping=g.pos==='yakata' && g.vamp.state==='asleep' && who!=='sleep' && view.kind!=='end';
    return (sleeping?figure('sleep','neutral'):'')+figure(who,mood);
  }
  function drawStage(who,T) {
    const img=sceneImage(),mood=moodFor(who); renderedMood=mood;
    if (img) {
      $('stage').innerHTML='<image href="'+esc(img.src)+'" x="0" y="0" width="400" height="160" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated;filter:brightness('+(img.exposure ?? 1)+')"/>'+(img.figure?sceneDetails()+sceneFigures(who,mood):'');
      return;
    }
    const dawn=T>=18?(T-17)/4:0;
    const stars=Array.from({length:15},(_,i)=>'<circle cx="'+((i*97+17)%400)+'" cy="'+((i*29)%80+8)+'" r=".55" fill="#c9c9bd" opacity=".35"/>').join('');
    let art='<defs><linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="'+SKY[Math.max(0,Math.min(19,T-1))]+'"/><stop offset="1" stop-color="#0b111b"/></linearGradient></defs><path fill="url(#scene-sky)" d="M0 0h400v160H0z"/>';
    if (!['heya','kyokai','yakata'].includes(g.pos)) {
      art+='<g opacity="'+(1-dawn)+'">'+stars+'<path fill="#bcbeb3" opacity=".8" d="M301 23a12 12 0 1 0 13 18 12 12 0 0 1-13-18z"/></g>';
    }
    art+=(PLACE[g.pos] || '')+figure(who,mood);
    if (dawn>0) art+='<path fill="#a4b6ba" opacity="'+(dawn*.13)+'" d="M0 0h400v160H0z"/>';
    $('stage').innerHTML=art;
  }
  // One quiet master channel. Rendering and selection never start audio.
  const SND=(()=>{
    let ac=null,master=null,wind=null; const voices=new Set();
    function ctx() {
      if (!soundOn) return null;
      if (!ac) {
        try { ac=new(window.AudioContext || window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=.4; master.connect(ac.destination); }
        catch (_) { return null; }
      }
      if (ac.state==='suspended') ac.resume().catch(()=>{});
      return ac;
    }
    function voice(node) { voices.add(node); node.onended=()=>voices.delete(node); return node; }
    function tone(freq,t,dur,vol,type='sine') {
      if (!ac || !soundOn) return;
      const o=voice(ac.createOscillator()),gain=ac.createGain();o.type=type;o.frequency.value=freq;gain.gain.setValueAtTime(vol,t);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(gain);gain.connect(master);o.start(t);o.stop(t+dur);
    }
    function start() {
      const a=ctx(); if (!a || wind) return;
      const buf=a.createBuffer(1,a.sampleRate*4,a.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      const src=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();
      src.buffer=buf;src.loop=true;filter.type='bandpass';filter.frequency.value=300;filter.Q.value=.6;gain.gain.value=.018;
      src.connect(filter);filter.connect(gain);gain.connect(master);src.start();wind=src;
    }
    return {
      start,
      sync(){ if (soundOn) { if(master)master.gain.value=.4;start(); } else if(ac) { master.gain.value=0;for(const v of voices){try{v.stop();}catch(_){}}voices.clear();ac.suspend().catch(()=>{}); } },
      bell(n){const a=ctx();if(a)for(let i=0;i<n;i++){const t=a.currentTime+i*1.6;tone(440,t,3,.12);tone(880,t,1.6,.05);tone(1320,t,.8,.03);}},
      cat(){const a=ctx();if(!a)return;const o=voice(a.createOscillator()),gain=a.createGain(),t=a.currentTime;o.frequency.setValueAtTime(620,t);o.frequency.linearRampToValueAtTime(900,t+.12);o.frequency.linearRampToValueAtTime(700,t+.3);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.04,t+.05);gain.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(gain);gain.connect(master);o.start(t);o.stop(t+.35);},
      wolf(){const a=ctx();if(!a)return;const t=a.currentTime;[0,.5,1].forEach(d=>tone(55,t+d,.35,.25));},
      get state(){return {enabled:soundOn,context:ac?ac.state:'none',voices:voices.size};}
    };
  })();
  function syncSoundButton() {
    $('sound-toggle').textContent=soundOn?'音あり':'音なし';
    $('sound-toggle').setAttribute('aria-pressed',String(soundOn));
    $('sound-toggle').setAttribute('aria-label',soundOn?'音を消す':'音を有効にする');
  }
  function soundForScene(who) {
    const old=previousSound;
    if (old && old.view===view) return;
    if (view.kind==='end' && (view.n===1 || view.n===3)) SND.bell(6);
    else if (view.kind==='scene' && g.T===9 && (!old || old.T!==9)) SND.bell(1);
    if (view.kind==='death' && who==='wolf') SND.wolf();
    else if (who==='cat' && !['cat-corpse','flee-17','flee-18','flee-19','flee-20'].some(hasText) && (!old || old.who!=='cat' || old.T!==g.T)) SND.cat();
    previousSound={view,T:g.T,who};
  }
  function render({sameScene=false}={}) {
    if(!view)return;
    const who=currentActor();
    const T=view.kind==='end' && view.n!==2 && view.n!==5?20:g.T;
    drawStage(who,T);sky(T);
    $('when').textContent=view.kind==='end'?(view.n===2?O.TIME(g.T)+'　館':view.n===5?'4:00　館':'6:00　朝'):O.TIME(g.T)+'　'+O.NAME[g.pos];
    $('night-progress').innerHTML=Array.from({length:20},(_,i)=>'<i class="'+(i+1<g.T?'past':i+1===g.T?'now':'')+'"></i>').join('');
    $('text').innerHTML=view.paras.map(p=>'<p class="'+esc(p.cls)+'">'+esc(p.t)+'</p>').join('');
    $('choices').innerHTML=view.kind==='scene'?view.choices.map((c,i)=>'<button type="button" data-i="'+i+'" class="'+(i===sel?'sel':'')+(c.disabled?' gray':'')+'"'+(c.disabled?' aria-disabled="true"':'')+'>'+esc(c.label)+'</button>').join(''):'';
    $('read-length').hidden=!view.alt;
    $('read-length').textContent=view.showLong?'短く読む':'全文を読む';
    $('read-length').setAttribute('aria-label',view.showLong?'短い文に切り替える':'全文を読む');
    $('continue').hidden=view.kind==='scene';
    $('record-open').hidden=view.kind==='scene';
    $('continue').textContent=view.kind==='death'?'もう一度、同じ夜を':'はじめに戻る';
    $('shiori').hidden=!(view.kind==='scene' && O.canShiori(g));
    $('shiori-note').textContent=O.hasShiori(S)?'しおり　'+O.TIME(S.shiori.T)+'　'+O.NAME[S.shiori.pos]:'';
    $('shiori-back').hidden=!(view.kind==='death' && O.hasShiori(S));
    $('next').textContent=view.kind==='death' || view.kind==='end'?'Enter でも進めます':'';
    drawGrid();syncNotes();
    if (!sameScene) {
      soundForScene(who);if(view.kind==='death' || view.kind==='end')save();$('panel').scrollTop=0;
      if (keyboardNav) $('when').focus({preventScroll:true});
    }
  }
  function select(i,scroll=false) {
    sel=i;
    for(const [j,b] of [...$('choices').children].entries()) b.classList.toggle('sel',j===sel);
    drawGrid();
    if (scroll) $('choices').children[sel]?.scrollIntoView({block:'nearest'});
  }
  function choose(i) {
    if(!view || view.kind!=='scene' || !view.choices[i] || view.choices[i].disabled)return;  // 灰色の選択肢は押せない（第14節c）
    SND.start();view=O.choose(g,view,i);sel=0;render();
  }
  function begin() {
    SND.start();({g,view}=O.start(S));sel=0;previousSound=null;show('play');render();
  }
  function continueNight() {
    if(!view || view.kind==='scene')return;
    if(view.kind==='end')show('title');else begin();
  }
  function toggleLength() {if(view && ui==='play' && O.toggleLong(view))render({sameScene:true});}
  function gallery() {
    const seen=S.seen || [];
    $('gcount').textContent=seen.length+' / '+O.SEEN.length;
    $('cards').innerHTML=O.SEEN.map(([key,name,line])=>{
      const ok=seen.includes(key),art=ART.gallery[key];
      const pic=ok?(art?galleryPicture(art):'—'):'？';
      const image=ok && art?'<button class="pic" type="button" data-art="'+esc(key)+'" aria-label="'+esc(name)+'の絵を見る" aria-haspopup="dialog">'+pic+'</button>':'<div class="pic" aria-hidden="true">'+pic+'</div>';
      return '<div class="gcard '+(ok?'':'no')+'">'+image+'<b>'+(ok?esc(name):'まだ見ていない')+'</b><small>'+(ok?esc(line):'　')+'</small></div>';
    }).join('');
    show('gallery');
  }
  function galleryPicture(art) {
    if (art.detail==='knifeMarks') {
      let cuts='';
      for(let i=0;i<8;i++){
        const y=46+i*15,len=112-(i%3)*7,x=40+(i%2)*5;
        const d='M'+x+' '+y+'h'+Math.round(len*.3)+'v-1h'+Math.round(len*.35)+'v-1h'+Math.round(len*.35);
        cuts+='<path data-knife-cut d="'+d+'" fill="none" stroke="'+(i===7?'#817263':'#171719')+'" stroke-width="'+(i===7?1:3)+'"/>';
        if(i<7)cuts+='<path d="'+d+'" transform="translate(0 1.7)" fill="none" stroke="#8c7660" stroke-width=".65"/>';
      }
      return '<svg viewBox="0 0 200 200" aria-hidden="true"><image href="'+esc(art.src)+'" width="200" height="200"/>'+cuts+'</svg>';
    }
    if (!art.sheet) return '<img src="'+esc(artSource(art))+'" alt="">';
    const {col,row,cols=3,rows=2}=art.sheet;
    // 内側の正方形で切り取る。外側が横長でも隣の絵を見せない。
    return '<svg viewBox="0 0 1 1" aria-hidden="true"><svg x="0" y="0" width="1" height="1" viewBox="'+col+' '+row+' 1 1" overflow="hidden"><image href="'+esc(art.src)+'" width="'+cols+'" height="'+rows+'" preserveAspectRatio="none"/></svg></svg>';
  }
  function showArtwork(title,picture,description='') {
    $('art-heading').textContent=title;
    $('art-description').textContent=description;
    $('art-description').hidden=!description;
    $('art-display').innerHTML=picture;
    $('art-dialog').showModal();
  }
  $('art-open').onclick=()=>{
    const names={girl:'白の少女',cat:'白い猫',man:'長身の男',wolf:'狼',sleep:'眠る彼'};
    const figures=[...$('stage').querySelectorAll('image[data-character]')];
    const portraits=figures.map(img=>{
      const name=img.dataset.mood==='corpse'?'白いもの':names[img.dataset.character] || '';
      return '<figure class="art-portrait"><img src="'+esc(img.getAttribute('href'))+'" alt="'+esc(name)+'"><figcaption>'+esc(name)+'</figcaption></figure>';
    }).join('');
    const scene='<svg class="art-landscape" viewBox="0 0 400 160" aria-hidden="true">'+$('stage').innerHTML+'</svg>';
    showArtwork($('when').textContent,'<div class="art-composition'+(figures.length?' has-portrait':'')+'">'+scene+(figures.length?'<div class="art-portraits">'+portraits+'</div>':'')+'</div>');
  };
  $('cards').addEventListener('click',e=>{
    const button=e.target.closest('button[data-art]');if(!button)return;
    const entry=O.SEEN.find(([key])=>key===button.dataset.art);
    if(!entry || !(S.seen || []).includes(entry[0]))return;
    showArtwork(entry[1],'<div class="art-memory">'+galleryPicture(ART.gallery[entry[0]])+'</div>',entry[2]);
  });
  document.addEventListener('pointerdown',()=>{keyboardNav=false;});
  window.addEventListener('keydown',e=>{
    keyboardNav=true;
    if(e.altKey || e.ctrlKey || e.metaKey || $('help-dialog').open || $('art-dialog').open)return;
    const k=e.key;
    if(k==='Escape' && notesOpen){e.preventDefault();setNotes(false);$('notes-toggle').focus();return;}
    if(k==='n' && ui==='play' && notesAvailable() && mobile.matches){e.preventDefault();setNotes(!notesOpen);return;}
    if(e.target.closest('button,a,input,select,textarea,[role="button"]')) {
      if (ui==='play' && e.target.matches('#choices button') && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k)) {
        e.preventDefault();select((sel+(['ArrowLeft','ArrowUp'].includes(k)?-1:1)+view.choices.length)%view.choices.length,true);$('choices').children[sel].focus({preventScroll:true});
      }
      return;
    }
    if(notesOpen && mobile.matches)return;
    if(ui==='title'){if(k==='Enter' || k===' '){e.preventDefault();SND.start();show('howto');}else if(k==='g' && (S.seen || []).length)gallery();return;}
    if(ui==='gallery'){if(['Enter','Escape',' '].includes(k)){e.preventDefault();show('title');}return;}
    if(ui==='howto'){if(k==='Enter' || k===' '){e.preventDefault();begin();}return;}
    if(!view)return;
    if(view.kind!=='scene'){if(k==='Enter' || k==='r'){e.preventDefault();continueNight();}return;}
    if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(k)){
      e.preventDefault();select((sel+(['ArrowLeft','ArrowUp'].includes(k)?-1:1)+view.choices.length)%view.choices.length,true);
    } else if(k==='Enter'){e.preventDefault();choose(sel);}
    else if(k===' '){e.preventDefault();toggleLength();}
  });
  $('choices').addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(b)choose(+b.dataset.i);});
  $('choices').addEventListener('mouseover',e=>{const b=e.target.closest('button[data-i]');if(b && +b.dataset.i!==sel)select(+b.dataset.i);});
  $('choices').addEventListener('focusin',e=>{const b=e.target.closest('button[data-i]');if(b)select(+b.dataset.i);});
  $('continue').onclick=continueNight;
  $('shiori').onclick=()=>{if(O.placeShiori(g)){save();render({sameScene:true});}};
  $('shiori-back').onclick=()=>{const r=O.resume(S);if(!r)return;({g,view}=r);sel=0;previousSound=null;show('play');render();};
  $('record-open').onclick=()=>{if(mobile.matches)setNotes(true);else $('board').scrollTo({top:0});};
  $('read-length').onclick=toggleLength;
  $('notes-toggle').onclick=()=>setNotes(!notesOpen);
  $('board-close').onclick=()=>{setNotes(false);$('notes-toggle').focus({preventScroll:true});};
  $('help-open').onclick=()=>$('help-dialog').showModal();
  $('sound-toggle').onclick=()=>{
    soundOn=!soundOn;syncSoundButton();SND.sync();
    if(!preview){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({sound:soundOn}));}catch(_){}}
  };
  $('go1').onclick=()=>{SND.start();show('howto');};
  $('go2').onclick=begin;$('go3').onclick=gallery;$('go4').onclick=()=>show('title');
  buildGrid();syncSoundButton();
  window.ookami={get g(){return g;},get view(){return view;},get S(){return S;},choose,begin,O,ART,get mood(){return renderedMood;},get audio(){return SND.state;}};
  if(Q.has('test')){
    const out=O.selfTest(),pass=out.filter(o=>o.ok).length;
    $('test').textContent='自己テスト '+pass+'/'+out.length+'\n'+out.map(o=>o.text).join('\n');
    $('test').hidden=false;document.title='狼のいる夜 テスト '+pass+'/'+out.length;show('title');
  }else if(Q.has('auto') || Q.has('route') || Q.has('skip')){
    S=O.newPersist();if(O.PRE[Q.get('auto')])O.PRE[Q.get('auto')](S);
    if(Q.has('stage'))S.catStage=Math.max(0,Math.min(3,parseInt(Q.get('stage'),10)||0));
    ({g,view}=O.start(S));
    let labels=Q.has('auto')?O.R[Q.get('auto')] || []:(Q.get('route') || '').split(',').filter(Boolean);
    if(Q.has('skip')){
      const T=parseInt(Q.get('skip'),10)||1;labels=[];const previewS=O.newPersist();
      if(Q.has('stage'))previewS.catStage=S.catStage;
      const r=O.start(previewS);let v=r.view;
      for(const l of O.R[3]){if(r.g.T>=T)break;labels.push(l);v=O.play(r.g,v,[l]);}
    }
    view=O.play(g,view,labels);if(view.err)console.error(view.err);show('play');render();
  }else show('title');
})();
