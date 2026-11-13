'use strict';
// WebAudioで効果音を合成（外部ファイル不要）
const SFX = {
  ctx: null, master: null, crowd: null, crowdGain: null, vol: 0.7,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
      // 観客ノイズ（ループ）
      const len = this.ctx.sampleRate * 3, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0;
      src.connect(f); f.connect(this.crowdGain); this.crowdGain.connect(this.master); src.start();
    } catch (e) { this.ctx = null; }
  },
  setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
  crowdLevel(v, t = 0.6) { if (!this.ctx) return; this.crowdGain.gain.setTargetAtTime(v * 0.35, this.ctx.currentTime, t); },
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq, vol = 0.4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  whistle() { this.tone(2900, 0.35, 'square', 0.06); setTimeout(() => this.tone(2750, 0.25, 'square', 0.05), 60); },
  hit() { this.noise(0.18, 500, 0.55); this.tone(90, 0.15, 'sine', 0.35, -40); },
  kick() { this.noise(0.08, 1200, 0.5); this.tone(160, 0.1, 'triangle', 0.3, -60); },
  snap() { this.tone(420, 0.05, 'square', 0.05); },
  catchBall() { this.noise(0.06, 2000, 0.25); },
  click() { this.tone(880, 0.04, 'triangle', 0.08); },
  select() { this.tone(660, 0.07, 'triangle', 0.1); setTimeout(() => this.tone(990, 0.08, 'triangle', 0.1), 60); },
  horn() { this.tone(220, 0.9, 'sawtooth', 0.12); this.tone(277, 0.9, 'sawtooth', 0.08); },
  cheer(big) { if (!this.ctx) return; this.crowdLevel(big ? 1.6 : 1.0, 0.1); setTimeout(() => this.crowdLevel(0.35, 1.2), big ? 2500 : 900); },
};
