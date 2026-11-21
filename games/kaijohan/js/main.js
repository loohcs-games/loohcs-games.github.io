(function (K) {
  'use strict';
  const $ = K.$, params = new URLSearchParams(location.search);
  const defaults = { sensitivity: 1, volume: .45, fov: 78, crosshair: 'cross', color: '#c4ffdf', side: 'defend', difficulty: 'normal' };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('kaijohan.settings.v2') || '{}') || {}; } catch (_) {}
  const settings = Object.assign({}, defaults, saved);
  for (const [key, min, max] of [['sensitivity', .3, 2.5], ['volume', 0, 1], ['fov', 65, 100]]) settings[key] = Number.isFinite(Number(settings[key])) ? K.clamp(Number(settings[key]), min, max) : defaults[key];
  if (!['cross', 'dot', 'ring'].includes(settings.crosshair)) settings.crosshair = 'cross';
  if (!['#c4ffdf', '#ffffff', '#ffd080', '#86d9ff', '#ff9fd9'].includes(settings.color)) settings.color = defaults.color;
  if (!['defend', 'attack'].includes(settings.side)) settings.side = defaults.side;
  if (!['easy', 'normal', 'hard'].includes(settings.difficulty)) settings.difficulty = defaults.difficulty;
  const save = () => { try { localStorage.setItem('kaijohan.settings.v2', JSON.stringify(settings)); } catch (_) {} };
  const app = K.app = { mode: 'title', settings, match: null, watch: false, debug: params.get('debug') === '1', watched: 0, slot: 2, previousSlot: 3, keys: {}, mouseDown: false, jump: false, sensitivity: settings.sensitivity, fps: 60, accumulator: 0 };
  app.noLock = app.debug && params.get('nolock') === '1'; app.injected = {}; app.firePressed = false; app.throwRelease = false; app.mousePosition = null;
  const showError = error => { $('loading').hidden = true; if (app.debug) { $('error').hidden = false; $('error').textContent = '訓練中にエラーが起きました。\n' + (error && error.message || error) + '\n\nこの枠をクリックすると、タイトルへ戻ります。'; } };
  window.addEventListener('error', e => showError(e.error || e.message)); window.addEventListener('unhandledrejection', e => showError(e.reason));
  if (!window.THREE) { $('loading').hidden = true; $('load-status').textContent = '描画ライブラリを読み込めませんでした。インターネット接続を確かめて、ページを開き直してください。'; return; }
  try { app.view = new K.View($('world')); } catch (error) { $('load-status').textContent = '３Ｄ画面を開けませんでした。ブラウザのハードウェア アクセラレーションを確認してください。'; showError(error); return; }
  app.audio = new K.Sound(); app.ui = new K.UI(app); $('loading').hidden = true; $('start').disabled = $('watch').disabled = false;
  function clearInput() {
    app.keys={}; app.mouseDown=false; app.jump=false; app.firePressed=false; app.throwRelease=false; app.injected={}; app.mousePosition=null;
    if(app.match){const p=app.match.players[0];p.triggerHeld=false;p.grenadePrimed=false;p.interacting=false;p.interact=0;}
  }
  function mode(value) { clearInput(); app.mode = value; app.audio.setActive(value === 'play' || value === 'shop'); app.ui.screens(value); app.keys = {}; app.mouseDown = false; app.jump = false; app.accumulator = 0; }
  function release() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }
  function requestLock() {
    if (app.watch || app.noLock) { mode('play'); return; }
    if (!$('world').requestPointerLock) { mode('pause'); $('pause-note').textContent = 'マウス固定に対応した PC 版 Chrome / Safari で開いてください。観戦はタイトルから利用できます。'; return; }
    mode('play');
    try { const promise = $('world').requestPointerLock(); if (promise && promise.catch) promise.catch(() => { if (app.mode === 'play') pause('マウスを固定できませんでした。「再開する」を押してください。'); }); }
    catch (_) { pause('マウスを固定できませんでした。「再開する」を押してください。'); }
  }
  function pause(message) { if (!app.match || ['title', 'howto', 'result'].includes(app.mode)) return; mode('pause'); $('pause-sensitivity').value = app.sensitivity; $('pause-note').textContent = message || '時間は止まっています。準備ができたら再開しよう。'; release(); }
  function start(watch) {
    app.audio.reset(); app.ui.reset(); app.view.reset();
    app.watch = watch; app.watched = 0; app.slot = 2; app.previousSlot = 3; app.audio.beepAt = 0; app.audio.ambientAt = 0; app.view.fx.clear(); app.view.lastWatched = null; settings.side = $('side').value; settings.difficulty = $('difficulty').value; save();
    app.match = new K.Match({ side: $('side').value, difficulty: $('difficulty').value, watch, seed: params.has('seed') ? Number(params.get('seed')) : Date.now() });
    if (app.debug) K.state = app.match;
    app.ui.nextDraw = 0; mode('play');
    if (!watch) { app.audio.unlock(); requestLock(); }
  }
  function quit() { app.audio.reset(); app.ui.reset(); app.view.reset(); mode('title'); release(); app.match = null; if (app.debug) K.state = null; $('debug').hidden = true; }
  function shop() {
    const m = app.match, p = m.players[0];
    if (app.watch || !p.alive) return;
    if (app.mode === 'shop') { requestLock(); return; }
    if (m.phase !== 'buy' || K.dist(p, K.map.spawns[p.side]) > 9) { app.ui.notify('購入できるのは、開始地点での購入時間だけです。'); return; }
    mode('shop'); release(); app.ui.shop();
  }
  function select(slot) {
    const m = app.match, p = m.players[0]; if (!p.alive || app.watch) return;
    if (slot === 4) {
      const available = Object.keys(p.grenades).filter(k => p.grenades[k]);
      if (!available.length) { app.ui.notify('投げ物がありません。購入時間に補給しよう。'); return; }
      const index = available.indexOf(p.selectedGrenade); if (app.slot === 4 || index < 0) p.selectedGrenade = available[(index + 1) % available.length];
    } else if (slot === 5) { if (m.device.carrier !== p.id) { app.ui.notify('装置は攻めの仲間が持っています。場所はレーダーの ◇。'); return; } }
    else {
      const id = Object.keys(p.gear).find(id => K.weapons[id].slot === slot); if (!id) { app.ui.notify('その枠の武器を持っていません。'); return; }
      if (p.weapon !== id) K.combat.equip(p, id);
    }
    if (slot >= 4) { p.scope = 0; p.reloadEnd = 0; }
    if (app.slot !== slot) { p.triggerHeld=false;p.grenadePrimed=false;app.firePressed=false;app.throwRelease=false;app.previousSlot = app.slot; app.mouseDown = false; app.audio.ui(); } app.slot = slot;
  }
  function spectate() {
    const m = app.match; if (!m || (!app.watch && m.players[0].alive)) return;
    const pool = m.players.filter(p => p.alive && (app.watch || p.team === m.players[0].team));
    if (pool.length) { const i = pool.findIndex(p => p.id === app.watched); app.watched = pool[(i + 1) % pool.length].id; } else app.watched = -1;
  }
  $('error').onclick=()=>quit();
  $('start').onclick = () => { app.audio.unlock(); app.audio.ui(); mode('howto'); }; $('how-back').onclick = quit; $('enter').onclick = () => start(false); $('watch').onclick = () => { app.audio.unlock(); start(true); };
  $('resume').onclick = () => { app.audio.unlock(); requestLock(); }; $('quit').onclick = quit; $('result-back').onclick = quit; $('again').onclick = () => start(app.watch);
  $('shop-close').onclick = () => { app.audio.unlock(); requestLock(); };
  $('shop-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { app.ui.category = Number(b.dataset.category); app.ui.shop(); });
  function sensitivity(value) { app.sensitivity = K.clamp(Number(value), .3, 2.5); settings.sensitivity = app.sensitivity; save(); $('sensitivity').value = value; $('pause-sensitivity').value = value; $('sensitivity-value').textContent = app.sensitivity.toFixed(2); }
  $('sensitivity').oninput = e => sensitivity(e.target.value); $('pause-sensitivity').oninput = e => sensitivity(e.target.value); $('volume').oninput = e => { settings.volume = Number(e.target.value); app.audio.setVolume(settings.volume); save(); };
  $('fov').oninput = e => { settings.fov = Number(e.target.value); $('fov-value').textContent = settings.fov + '°'; save(); };
  const preview = () => { $('setting-preview').textContent = settings.crosshair === 'dot' ? '•' : settings.crosshair === 'ring' ? '⊙' : '＋'; $('setting-preview').style.color = settings.color; };
  $('crosshair-shape').onchange = e => { settings.crosshair = e.target.value; preview(); save(); };
  $('crosshair-color').onchange = e => { settings.color = e.target.value; preview(); save(); };
  $('side').value = settings.side; $('difficulty').value = settings.difficulty;
  sensitivity(settings.sensitivity); $('volume').value = settings.volume; app.audio.setVolume(settings.volume);
  $('fov').value = settings.fov; $('fov-value').textContent = settings.fov + '°'; $('crosshair-shape').value = settings.crosshair; $('crosshair-color').value = settings.color; preview();
  $('side').onchange = e => { settings.side = e.target.value; save(); }; $('difficulty').onchange = e => { settings.difficulty = e.target.value; save(); };
  document.addEventListener('click', e => { if (e.target && e.target.tagName === 'BUTTON') { app.audio.unlock(); app.audio.ui(); } });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && app.mode === 'play' && !app.watch && !app.noLock) pause(); });
  document.addEventListener('pointerlockerror', () => { if (app.mode === 'play' && !app.watch && !app.noLock) pause('マウスを固定できませんでした。再開ボタンをもう一度押してください。'); });
  window.addEventListener('blur', () => { clearInput(); if (app.mode === 'play' || app.mode === 'shop') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.match && (app.mode === 'play' || app.mode === 'shop')) pause('別の画面を開いたため、一時停止しました。'); });
  document.addEventListener('mousemove', e => {
    if (app.mode !== 'play' || app.watch || (!app.noLock && document.pointerLockElement !== $('world')) || !app.match || !app.match.players[0].alive) { app.mousePosition=null; return; }
    const p = app.match.players[0], scale = .0021 * app.sensitivity * (p.scope === 2 ? .25 : p.scope === 1 ? .48 : 1);
    const last=app.mousePosition, dx=Number.isFinite(e.movementX)&&e.movementX!==0?e.movementX:last&&Number.isFinite(e.clientX)?e.clientX-last.x:0;
    const dy=Number.isFinite(e.movementY)&&e.movementY!==0?e.movementY:last&&Number.isFinite(e.clientY)?e.clientY-last.y:0;
    app.mousePosition=Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)?{x:e.clientX,y:e.clientY}:null;
    p.yaw = K.angle(p.yaw + K.clamp(dx,-250,250) * scale); p.pitch = K.clamp(p.pitch - K.clamp(dy,-250,250) * scale, -1.43, 1.43);
  });
  $('world').addEventListener('mousedown', e => {
    if (app.mode !== 'play' || !app.match) return; app.audio.unlock();
    if (app.watch || !app.match.players[0].alive) { if (e.button === 0) spectate(); return; }
    if (!app.noLock && document.pointerLockElement !== $('world')) { requestLock(); return; }
    if (e.button === 0) { app.mouseDown = true; app.firePressed = true; }
    if (e.button === 2) { const p = app.match.players[0]; if (K.weapons[p.weapon].scope && !p.reloadEnd && app.slot === 1) p.scope = (p.scope + 1) % 3; }
  });
  document.addEventListener('mouseup', e => { if (e.button === 0) { if(app.mode==='play'&&app.slot===4&&app.mouseDown)app.throwRelease=true; app.mouseDown = false; } });
  document.addEventListener('contextmenu', e => { if (app.mode === 'play') e.preventDefault(); });
  let wheelAt = 0;
  document.addEventListener('wheel', e => {
    if (app.mode !== 'play' || !app.match || app.watch || !e.deltaY) return; e.preventDefault();
    if (performance.now() < wheelAt) return; wheelAt = performance.now() + 110;
    const p = app.match.players[0], available = [1, 2, 3, 4, 5].filter(slot => slot === 4 ? Object.values(p.grenades).some(n => n > 0) : slot === 5 ? app.match.device.carrier === p.id : Object.keys(p.gear).some(id => K.weapons[id].slot === slot));
    const i = Math.max(0, available.indexOf(app.slot)); if (available.length) select(available[(i + (e.deltaY > 0 ? 1 : available.length - 1)) % available.length]);
  }, { passive: false });
  document.addEventListener('keydown', e => {
    if(!$('error').hidden&&['Enter','Space'].includes(e.code)){e.preventDefault();quit();return;}
    if (e.code === 'F3' && app.debug) { e.preventDefault(); if (!e.repeat) app.hideDebug = !app.hideDebug; return; }
    if (['play','shop'].includes(app.mode) && ['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    if (['play','shop'].includes(app.mode) && (e.ctrlKey || e.metaKey) && ['KeyW','KeyR','KeyS','KeyD','KeyQ'].includes(e.code)) e.preventDefault();
    if (e.repeat && app.mode === 'shop') return;
    if (app.mode === 'shop') { if (/^Digit[1-9]$/.test(e.code)) app.ui.buy(Number(e.code.slice(5)) - 1); if (e.code === 'KeyB' || e.code === 'Escape') { e.preventDefault(); requestLock(); } return; }
    if (app.mode !== 'play') return;
    if (['Space', 'Tab', 'ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyM', 'KeyR', 'KeyE', 'KeyB', 'KeyQ', 'KeyG', 'KeyZ', 'KeyX', 'KeyC', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) e.preventDefault();
    app.keys[e.code] = true; if (e.repeat) return;
    const m = app.match, p = m.players[0];
    if (e.code === 'Escape') { pause(); return; }
    if (e.code === 'Tab') { $('scoreboard').hidden = false; app.ui.scoreboard(m); }
    if (e.code === 'KeyM') $('map-overlay').hidden = false;
    if (e.code === 'KeyB') shop();
    if (e.code === 'Space') app.jump = true;
    if (/^Digit[1-5]$/.test(e.code)) select(Number(e.code.slice(5)));
    if (e.code === 'KeyQ') select(app.previousSlot);
    if (e.code === 'KeyR' && p.alive && !app.watch && app.slot < 3) K.combat.reload(m, p);
    if (e.code === 'KeyG' && p.alive && !app.watch && app.slot === 5 && typeof m.dropDevice === 'function') { if (m.dropDevice(p)) select(2); return; }
    if (e.code === 'KeyG' && p.alive && !app.watch && app.slot < 4) { K.combat.drop(m, p); app.slot = K.weapons[p.weapon].slot; }
    if (e.code === 'KeyZ' && p.alive && !app.watch) m.command('follow');
    if (e.code === 'KeyX' && p.alive && !app.watch) m.command('hold');
  });
  document.addEventListener('keyup', e => { app.keys[e.code] = false; if (e.code === 'Tab') $('scoreboard').hidden = true; if (e.code === 'KeyM') $('map-overlay').hidden = true; });
  window.addEventListener('resize', () => app.view.resize());
  let last = performance.now(), total = 0;
  function frame(now) {
    try {
      const dt = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now; total += dt; app.fps += ((1 / Math.max(.001, dt)) - app.fps) * .03;
      const m = app.match;
      if (m) {
        if (app.mode === 'play' || app.mode === 'shop' && m.phase === 'buy') {
          app.accumulator += dt;
          while (app.accumulator + 1e-9 >= 1 / 60) {
            const keys = app.keys, input = { forward: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), right: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), crouch: keys.KeyC || keys.ControlLeft || keys.ControlRight, walk: keys.ShiftLeft || keys.ShiftRight, use: keys.KeyE, jump: app.jump, fire: app.mouseDown, firePressed:app.firePressed, throwRelease:app.throwRelease, slot: app.slot };
            Object.assign(input,app.injected);
            m.step(1 / 60, app.mode === 'play' ? input : {}); app.jump = false; app.firePressed=false; app.throwRelease=false;
            for(const key of ['jump','firePressed','throwRelease','reload','dropDevice'])delete app.injected[key];
            app.accumulator = Math.max(0,app.accumulator - 1 / 60);
            if(app.mode==='shop'&&m.phase!=='buy')break;
          }
        }
        const own = m.players[0];
        if (!app.watch && own.alive && (app.slot === 5 && m.device.carrier !== own.id || app.slot === 4 && !Object.values(own.grenades).some(n => n > 0))) { app.slot = (K.weapons[own.weapon] || {}).slot || 2; app.mouseDown = false; }
        if (!app.watch && app.slot === 4 && !own.grenades[own.selectedGrenade]) own.selectedGrenade = Object.keys(own.grenades).find(k => own.grenades[k] > 0) || own.selectedGrenade;
        if (!app.watch && own.alive) app.watched = 0;
        else if (!m.players.find(a => a.id === app.watched && a.alive)) spectate();
        const watched = m.players.find(a => a.id === app.watched) || own;
        for (const e of m.events.splice(0)) { if(e.type==='round'){clearInput();app.audio.reset();app.audio.setActive(app.mode==='play'||app.mode==='shop');} if (!app.watch && (e.type === 'round' || e.type === 'pickup' && e.actor === 0)) app.slot = K.weapons[own.weapon].slot; app.view.event(e, m, app.watched); app.audio.event(e, m, watched); app.ui.event(e); }
        if (m.phase === 'ended' && app.mode !== 'result') { mode('result'); release(); app.ui.result(m); }
        if (app.mode === 'shop' && m.phase !== 'buy') { if(app.noLock||app.watch)mode('play');else pause('購入時間が終わりました。再開して仲間と出発しよう。'); }
        if (app.mode === 'play' || app.mode === 'shop') app.audio.tick(m, watched);
        app.view.render(m, app.watched, ['pause', 'result'].includes(app.mode) ? 0 : dt, app.mode !== 'play', app.slot);
        if (app.mode !== 'result') app.ui.update(m, watched, total);
      } else app.view.render(null, 0, dt, true);
    } catch (error) { showError(error); if (app.match) pause('訓練を停止しました。タイトルにもどって、もう一度はじめてください。'); }
    requestAnimationFrame(frame);
  }
  if(app.debug) K.debug = {
    setInput(value) { if(!value || typeof value!=='object')return false; const allowed=['forward','right','yaw','pitch','fire','firePressed','throwRelease','crouch','walk','use','jump','reload','dropDevice'];
      for(const key of allowed)if(Object.prototype.hasOwnProperty.call(value,key)&&(typeof value[key]==='boolean'||Number.isFinite(value[key])))app.injected[key]=value[key];
      if(Number.isInteger(value.slot)&&value.slot>=1&&value.slot<=5&&app.match)select(value.slot);return true; },
    teleport(x,z) { const p=app.match&&app.match.players[0];if(!p||![x,z].every(Number.isFinite)||Math.abs(x)>=24||Math.abs(z)>=32)return false;
      const y=K.map.floor(x,z,1.6);if(!K.map.free(x,z,y,K.rules.radius,p.crouch?1.22:1.8))return false;
      Object.assign(p,{x,z,y,vx:0,vz:0,vy:0,moving:false,speed:0,grounded:true,interact:0});return true; },
    give(id) { const p=app.match&&app.match.players[0],w=K.weapons[id];if(!p||!w)return false;
      for(const key of Object.keys(p.gear))if(K.weapons[key].slot===w.slot)delete p.gear[key];p.gear[id]=K.combat.fresh(id);K.combat.equip(p,id);app.slot=w.slot;return true; },
    money(n) { const p=app.match&&app.match.players[0];if(!p||!Number.isFinite(n))return false;p.money=Math.round(K.clamp(n,0,K.rules.cap));return p.money; },
    skipBuy() { const m=app.match;if(!m||m.phase!=='buy')return false;m.phaseTime=0;return true; },
    snapshot() { const m=app.match,p=m&&m.players[0];return JSON.parse(JSON.stringify({mode:app.mode,noLock:app.noLock,watched:app.watched,slot:app.slot,
      match:m&&{time:m.time,round:m.round,phase:m.phase,phaseTime:m.phaseTime,scores:m.scores,device:m.device,history:m.history,alive:m.players.filter(p=>p.alive).map(p=>p.id)},
      player:p&&{id:p.id,side:p.side,alive:p.alive,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,armor:p.armor,kit:p.kit,money:p.money,weapon:p.weapon,gear:p.gear,grenades:p.grenades,scope:p.scope,interact:p.interact,reloadEnd:p.reloadEnd,kills:p.kills,deaths:p.deaths},
      rendering:{calls:app.view.frameCalls,pixelRatio:app.view.pixelRatio,weaponFov:app.view.held.camera.fov},audio:{sources:app.audio.sources.size},events:m&&m.events.length})); }
  };
  requestAnimationFrame(frame);
  if (params.get('watch') === '1') start(true);
})(window.KJ);
