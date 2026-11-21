/* 音源はすべて WebAudio で合成。AudioContext はクリック後だけ生成。 */
(function (K) {
  'use strict';
  class Sound {
    constructor() { this.ctx = null; this.volume = .45; this.beepAt = 0; this.active = 0; this.ambientAt = 0; this.enabled = false; this.sources = new Set(); }
    unlock() {
      try {
        if (!this.ctx) {
          const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
          const c = this.ctx = new Audio(); this.master = c.createGain(); this.master.gain.value = this.volume;
          this.compressor = c.createDynamicsCompressor(); this.compressor.threshold.value = -12; this.compressor.ratio.value = 4; this.master.connect(this.compressor); this.compressor.connect(c.destination);
          this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const data = this.noise.getChannelData(0); const random = K.rng(8741); for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
          const impulse = c.createBuffer(2, Math.floor(c.sampleRate * .65), c.sampleRate);
          for (let ch = 0; ch < 2; ch++) { const d = impulse.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (random() * 2 - 1) * Math.pow(1 - i / d.length, 4) * .22; }
          this.impulse=impulse;this.reverb = c.createConvolver(); this.reverb.buffer = impulse; this.reverbGain = c.createGain(); this.reverbGain.gain.value = .15; this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
          const wind = this.wind = c.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
          const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350; this.windGain = c.createGain(); this.windGain.gain.value = 0; wind.connect(filter); filter.connect(this.windGain); this.windGain.connect(this.master); wind.start();
        }
        if (this.ctx.state === 'suspended') { const promise = this.ctx.resume(); if (promise && promise.catch) promise.catch(() => {}); }
      } catch (_) { /* 音声が使えない環境でも訓練は続けられる。 */ }
    }
    reset() { this.setActive(false);for(const source of Array.from(this.sources)){try{source.stop();}catch(_){}if(source.onended)source.onended();}this.beepAt=0;this.ambientAt=0;this.reloadTag=null;if(this.ctx&&this.reverb){this.reverb.disconnect();this.reverb=this.ctx.createConvolver();this.reverb.buffer=this.impulse;this.reverb.connect(this.reverbGain);} }
    setVolume(v) { this.volume = K.clamp(Number(v) || 0, 0, 1); if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .02); }
    setActive(active) {
      if (this.enabled === active) return; this.enabled = active;
      if (this.windGain) this.windGain.gain.setValueAtTime(active ? .025 : 0, this.ctx.currentTime);
      if (this.reverbGain) this.reverbGain.gain.setValueAtTime(active ? .15 : 0, this.ctx.currentTime);
      if (!active) for (const source of this.sources) { try { source.stop(); } catch (_) {} }
    }
    tone(frequency, length, gain, pan, noise, cutoff, slide, delay, room, wave) {
      if (!this.ctx || this.ctx.state !== 'running' || this.active >= 56 || gain < .001) return;
      const c = this.ctx, time = c.currentTime + (delay || 0), source = noise ? c.createBufferSource() : c.createOscillator();
      if (noise) { source.buffer = this.noise; source.playbackRate.value = frequency > 0 ? K.clamp(frequency / 160, .4, 2) : 1; }
      else { source.type = wave || 'triangle'; source.frequency.setValueAtTime(Math.max(20, frequency), time); source.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * (slide || .7)), time + length); }
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = Math.max(90, cutoff || 5000);
      const amp = c.createGain(); amp.gain.setValueAtTime(.0001, time); amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), time + .004); amp.gain.exponentialRampToValueAtTime(.0001, time + length);
      source.connect(filter); filter.connect(amp); let stereo;
      if (c.createStereoPanner) { stereo = c.createStereoPanner(); stereo.pan.value = K.clamp(pan || 0, -1, 1); amp.connect(stereo); stereo.connect(this.master); } else amp.connect(this.master);
      let send; if (room) { send = c.createGain(); send.gain.value = room; amp.connect(send); send.connect(this.reverb); }
      this.active++; this.sources.add(source);source.reloadTag=this.reloadTag;let disposed=false;
      source.onended = () => { if(disposed)return;disposed=true;source.disconnect(); filter.disconnect(); amp.disconnect(); if (stereo) stereo.disconnect(); if (send) send.disconnect(); this.active--; this.sources.delete(source); };
      source.start(time); source.stop(time + length + .025);
    }
    ui(negative) { this.tone(negative ? 180 : 680, .065, .06, 0, false, 2400, negative ? .7 : 1.2); }
    event(e, m, listener) {
      if (!listener || !this.enabled) return;
      const p = e.actor != null ? m.players[e.actor] : null, at = e.from || (e.x != null ? e : p), distance = at ? Math.hypot(at.x - listener.x, at.z - listener.z) : 0;
      const pan = at ? Math.sin(Math.atan2(at.x - listener.x, -(at.z - listener.z)) - listener.yaw) * Math.min(1, distance / 2) : 0;
      const blocked = at && distance > 3 && K.map.sight ? !K.map.sight(listener, { x: at.x, y: at.y || 0, z: at.z }, []) : false;
      const volume = 1 / (1 + distance * .13) * (blocked ? .6 : 1), cutoff = 7500 / (1 + distance * .12) * (blocked ? .45 : 1);
      const area = K.presentation.area(at || listener), room = area.indoor || /倉庫|機材庫|屋内/.test(area.name || '') ? .7 : .14;
      if (e.type === 'shot' && !e.pellet) {
        const w = K.weapons[e.weapon] || {}, cat = K.presentation.category(w);
        const profile = { pistol: [190, .12, .23], smg: [145, .1, .19], rifle: [110, .17, .28], shotgun: [72, .3, .36], sniper: [52, .42, .4], melee: [350, .1, .09] }[cat];
        this.tone(profile[0], profile[1], profile[2] * volume, pan, false, cutoff, .25, 0, room);
        this.tone(0, profile[1] * .75, profile[2] * .8 * volume, pan, true, cutoff, 1, 0, room);
        if (cat !== 'melee') this.tone(1800, .025, .05 * volume, pan, true, cutoff, 1, .035);
        if (e.impact && distance < 30) this.tone(1400, .05, .035 * volume, pan, true, e.material === 'wood' ? 650 : 3300, 1, .035);
      } else if (e.type === 'step' && distance < 20 && !(p && (p.walk || p.crouch))) {
        const material = e.material || K.presentation.materialAt(p || e), metal = /metal|container|step/.test(material), wood = material === 'wood';
        this.tone(0, .075, .08 * volume, pan, true, metal ? 1700 : wood ? 750 : 450, 1, 0, room);
        this.tone(metal ? 290 : wood ? 125 : 75, .09, .04 * volume, pan, false, 1800, .5);
      } else if (e.type === 'reload') {
        const w = K.weapons[e.weapon || p && p.weapon] || {}, length = w.reload || 2; this.reloadTag={actor:e.actor,end:p&&p.reloadEnd};
        this.tone(0, .1, .1 * volume, pan, true, 2400, 1, 0, room); this.tone(220, .07, .05 * volume, pan, false, 1700, .6, length * .55);
        this.tone(0, .11, .13 * volume, pan, true, 3100, 1, length * .88, room);this.reloadTag=null;
      } else if (e.type === 'hit' && e.actor === listener.id) { this.tone(e.part === 'head' ? 1800 : 1200, .045, .075, 0, false, 4500, .65); }
      else if (e.type === 'hit' && e.target === listener.id) { this.tone(65, .16, .2, pan, false, 500, .5); this.tone(0, .11, .12, pan, true, 1500); }
      else if (e.type === 'kill' && e.actor === listener.id) { this.tone(950, .1, .07, 0, false, 3500, 1.25); }
      else if (e.type === 'buy' && e.actor === listener.id) { this.tone(700, .1, .08, 0, false, 2400, 1.4); this.tone(1050, .1, .05, 0, false, 2600, 1, .07); }
      else if (e.type === 'dryfire' && e.actor === listener.id) this.tone(1800, .035, .06, 0, true, 2000);
      else if (e.type === 'bounce') this.tone(340, .065, .08 * volume, pan, false, 2000, .5);
      else if (e.type === 'deviceDrop' || e.type === 'devicePass') this.tone(430, .06, .06 * volume, pan);
      else if (e.type === 'throw') this.tone(0, .12, .1 * volume, pan, true, 1800);
      else if (e.type === 'grenade') {
        if (e.kind === 'smoke') this.tone(0, 1.2, .17 * volume, pan, true, 900);
        else { this.tone(e.kind === 'flash' ? 250 : 52, .55, .4 * volume, pan, false, cutoff, .3, 0, room); this.tone(0, .4, .36 * volume, pan, true, e.kind === 'flash' ? 7000 : 1600, 1, 0, room); }
      } else if (e.type === 'work') { this.tone(520, .06, .09 * volume, pan); this.tone(690, .05, .06 * volume, pan, false, 2500, 1, .1); }
      else if (e.type === 'plant') { [880, 660, 1100].forEach((n, i) => this.tone(n, .13, .1, 0, false, 3000, 1, i * .17)); }
      else if (e.type === 'explode') { this.tone(38, 1.8, .4 * volume, pan, false, 900, .55, 0, .8); this.tone(0, 1.2, .3 * volume, pan, true, 1800, 1, 0, .8); }
      else if (['start', 'roundEnd', 'defuse'].includes(e.type)) {
        const notes = e.type === 'start' ? [330, 440, 660] : e.type === 'defuse' || e.winner === listener.team ? [440, 554, 659, 880] : [440, 370, 294];
        notes.forEach((n, i) => this.tone(n, .26, .065, 0, false, 2800, 1, i * .14));
      } else if (e.type === 'radio' && e.team === listener.team) this.tone(0, .035, .025, -.3, true, 1700);
    }
    tick(m, p) {
      if (!this.enabled || !m || !p) return;
      for(const source of this.sources)if(source.reloadTag){const actor=m.players[source.reloadTag.actor];if(!actor||!actor.alive||actor.reloadEnd!==source.reloadTag.end){try{source.stop();}catch(_){}if(source.onended)source.onended();}}
      if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(.022 + Math.sin(m.time * .2) * .006, this.ctx.currentTime, .3);
      if (m.time > this.ambientAt) { this.ambientAt = m.time + 18 + Math.random() * 15; this.tone(78, 2.4, .018, -.7, false, 280, 1.02); this.tone(117, 2, .009, -.5, false, 380, .99, .1); }
      if (!m.device.planted || m.phase !== 'live' || m.time < this.beepAt) return;
      const d = m.device, distance = K.dist(d, p), volume = .17 / (1 + distance * .09), pan = Math.sin(Math.atan2(d.x - p.x, -(d.z - p.z)) - p.yaw);
      this.tone(d.time < 10 ? 1250 : 880, .07, volume, pan, false, 3500, 1);
      this.beepAt = m.time + (d.time < 5 ? .16 : d.time < 12 ? .32 : .8);
    }
  }
  K.Sound = Sound;
})(window.KJ);
