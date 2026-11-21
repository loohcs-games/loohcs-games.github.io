(function (K) {
  'use strict';
  const T = window.THREE, P = K.presentation;
  class View {
    constructor(canvas) {
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.renderer.outputEncoding = T.sRGBEncoding; this.renderer.setClearColor(0x554957);
      this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.scene = new T.Scene(); this.scene.fog = new T.Fog(0x65596b, 42, 145);
      this.camera = new T.PerspectiveCamera(78, 1, .12, 400); this.camera.rotation.order = 'YXZ';
      this.scene.add(new T.HemisphereLight(0x9cadde, 0x6e4937, .85));
      const sun = new T.DirectionalLight(0xffbd87, 1.15); sun.position.set(-50, 40, -60); sun.castShadow = true;
      const bounds = P.bounds(), span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * .72;
      sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 200 }); sun.shadow.bias = -.001; sun.shadow.normalBias = .035; this.scene.add(sun);
      this.scenery = new K.Scenery(this.scene); this.robots = new K.Robots(this.scene); this.fx = new K.Effects(this.scene); this.held = new K.HeldModel();
      this.device = new T.Group(); this.scene.add(this.device);
      const body = new T.Mesh(new T.BoxGeometry(.56, .22, .38), new T.MeshLambertMaterial({ color: 0x293c48 })); this.device.add(body);
      const band = new T.Mesh(new T.BoxGeometry(.42, .025, .25), new T.MeshBasicMaterial({ color: 0xffbb62 })); band.position.y = .12; this.device.add(band);
      const panel = new T.Mesh(new T.BoxGeometry(.2, .03, .16), new T.MeshBasicMaterial({ color: 0x193d43 })); panel.position.y = .14; this.device.add(panel);
      this.deviceLight = new T.PointLight(0xffae51, 0, 4); this.scene.add(this.deviceLight);
      this.hitUntil = -1; this.hitHead = false; this.lastWatched = null; this.eyeY = 1.58; this.fov = 78; this.time = 0; this.frameCalls = 0; this.shadowBaked = false; this.qualityAt = 8; this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5); this.resize();
    }
    reset() { this.fx.clear();this.hitUntil=-1;this.hitHead=false;this.lastWatched=null;this.eyeY=1.58;this.held.reset();this.robots.units.forEach(u=>{u.stride=0;}); }
    resize() { const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    event(e, m, watched) {
      this.fx.event(e, m, watched);
      if (e.type === 'shot' && e.actor === watched && !e.pellet) this.held.shot(K.weapons[e.weapon] || {});
      if (e.type === 'hit' && e.actor === watched) { this.hitUntil = m.time + .16; this.hitHead = e.part === 'head'; }
      if (e.type === 'round') { this.hitUntil = -1; this.held.swap = 1; this.lastWatched = null; }
    }
    render(m, watched, dt, menu, selectedSlot) {
      this.time += dt;
      if (m && !menu && this.time > this.qualityAt && K.app) {
        this.qualityAt = this.time + 8; const fps = K.app.fps;
        const ratio = fps < 48 ? Math.max(.85, this.pixelRatio - .2) : fps > 59 ? Math.min(window.devicePixelRatio || 1, 1.5, this.pixelRatio + .1) : this.pixelRatio;
        if (Math.abs(ratio - this.pixelRatio) > .01) { this.pixelRatio = ratio; this.renderer.setPixelRatio(ratio); this.resize(); }
      }
      const p = m && m.players.find(a => a.id === watched), settings = K.app && K.app.settings || {};
      this.fx.render(m, p, dt); this.robots.update(m, watched, dt);
      if (p) {
        const targetEye = p.y + (p.crouch ? 1.04 : 1.58);
        if (this.lastWatched !== p.id || Math.abs(targetEye - this.eyeY) > 2) this.eyeY = targetEye;
        this.lastWatched = p.id; this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 18);
        const bob = p.moving && p.grounded && !p.scope ? Math.sin(m.time * (p.walk ? 8 : 12)) * .016 : 0, shake = this.fx.shake;
        this.camera.position.set(p.x, this.eyeY + bob, p.z); this.camera.rotation.set(p.pitch + p.recoil + Math.sin(this.time * 71) * shake, -p.yaw - (p.recoilYaw || 0) + Math.sin(this.time * 91) * shake * .5, Math.sin(this.time * 57) * shake * .2, 'YXZ');
        const targetFov = p.scope === 2 ? 20 : p.scope === 1 ? 38 : Number(settings.fov) || 78; this.fov += (targetFov - this.fov) * Math.min(1, dt * 18); this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
        const fog = this.fx.insideSmoke; this.scene.fog.near = 42 * (1 - fog) + .1 * fog; this.scene.fog.far = 145 * (1 - fog) + 2.5 * fog; this.scene.fog.color.setHex(fog > .2 ? 0x9ca5aa : 0x65596b);
        const d = m.device, floor = typeof K.map.floor === 'function' ? K.map.floor(d.x, d.z, 1.5) : 0;
        this.device.visible = d.carrier == null; this.device.position.set(d.x, (Number.isFinite(d.y) ? d.y : floor) + .14, d.z);
        const pulse = d.planted ? Math.pow(Math.max(0, Math.sin(m.time * (d.time < 8 ? 18 : 7))), 5) : .2;
        this.device.children[1].material.color.setHex(pulse > .4 ? 0xff704b : 0xe4b36b); this.deviceLight.position.copy(this.device.position); this.deviceLight.position.y += .3; this.deviceLight.intensity = this.device.visible ? pulse * 1.5 : 0;
        const slot = p.id === 0 && !p.bot ? selectedSlot : (K.weapons[p.weapon] || {}).slot;
        this.held.update(p, m, dt, slot, menu, this.camera);
      } else {
        const b = this.scenery.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        if(m){const d=m.device;this.camera.position.set(d.x+7,11,d.z+9);this.camera.lookAt(d.x,d.y || 0,d.z);}
        else {this.camera.position.set(b.maxX * .72 + Math.sin(this.time * .04) * 2, 15, b.maxZ * .82); this.camera.lookAt(cx - 4, 1, cz - 9);} this.camera.fov = 67; this.camera.updateProjectionMatrix();
        this.scene.fog.near = 42; this.scene.fog.far = 145; this.scene.fog.color.setHex(0x65596b); this.device.visible = !!m && m.device.carrier==null; if(m)this.device.position.set(m.device.x,(m.device.y || 0)+.14,m.device.z); this.deviceLight.intensity = 0; this.held.root.visible = false;
      }
      this.renderer.autoClear = true; this.renderer.render(this.scene, this.camera); this.frameCalls = this.renderer.info.render.calls;
      // 静的地形の影だけを一度描く。ロボットの接地影はインスタンスで更新。
      if (!this.shadowBaked) { this.renderer.shadowMap.autoUpdate = false; this.shadowBaked = true; }
      if (this.held.root.visible) { this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.held.scene, this.held.camera); this.frameCalls += this.renderer.info.render.calls; }
    }
  }
  K.View = View;
})(window.KJ);
