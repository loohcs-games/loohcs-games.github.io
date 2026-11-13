'use strict';
// ===== キーボード入力 =====
const Input = {
  held: {}, pressed: new Set(), listeners: [], mouse: { sx: null, sy: null, t: -1e9, wheel: 0 },
  init() {
    addEventListener('keydown', e => {
      const c = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c) && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
      if (e.target && e.target.tagName === 'INPUT') return;
      if (!this.held[c]) { this.pressed.add(c); this.listeners.forEach(f => f(c, e)); }
      this.held[c] = true;
      SFX.init();
    });
    addEventListener('keyup', e => { this.held[e.code] = false; });
    // マウス（フィールド上でのみ）
    const cv = document.getElementById('game');
    addEventListener('mousemove', e => { this.mouse.sx = e.clientX; this.mouse.sy = e.clientY; if (e.target === cv) this.mouse.t = performance.now(); });
    cv.addEventListener('mousedown', e => { if (e.button === 0) { this.pressed.add('Mouse0'); this.mouse.t = performance.now(); } });
    cv.addEventListener('wheel', e => { this.mouse.wheel += e.deltaY < 0 ? 1 : -1; e.preventDefault(); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.held = {}; });
    addEventListener('mousedown', () => SFX.init());
  },
  onKey(f) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter(x => x !== f); }; },
  // 現在の入力状態を取り出す（pressedはクリアされる）
  snapshot() {
    const h = this.held;
    const ax = (h.KeyD || h.ArrowRight ? 1 : 0) - (h.KeyA || h.ArrowLeft ? 1 : 0);
    const ay = (h.KeyS || h.ArrowDown ? 1 : 0) - (h.KeyW || h.ArrowUp ? 1 : 0);
    const held = { KeyQ: !!h.KeyQ, KeyE: !!h.KeyE, Enter: !!h.Enter, Digit1: !!h.Digit1, Digit2: !!h.Digit2, Digit3: !!h.Digit3, Digit4: !!h.Digit4, Digit5: !!h.Digit5 };
    const m = this.mouse, mAct = performance.now() - m.t < 2500 && m.sx != null;
    let mx = null, my = null;
    if (mAct && typeof Render !== 'undefined') { const w = Render.toWorld(m.sx, m.sy); mx = Math.round(w.x * 100) / 100; my = Math.round(w.y * 100) / 100; }
    const s = { ax, ay, sprint: !!(h.ShiftLeft || h.ShiftRight), held, pressed: this.pressed, mAct, mx, my, wheel: m.wheel };
    this.pressed = new Set(); m.wheel = 0;
    return s;
  },
};
