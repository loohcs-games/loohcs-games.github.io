(function (K) {
  'use strict';
  const T = window.THREE, P = K.presentation;
  class Effects {
    constructor(scene) {
      this.scene = scene; this.particles = Array.from({ length: 640 }, () => ({ life: 0 })); this.cursor = 0;
      this.traces = Array.from({ length: 96 }, () => ({ life: 0 })); this.traceCursor = 0;
      this.positions = new Float32Array(640 * 3); this.colors = new Float32Array(640 * 3);
      this.geometry = new T.BufferGeometry(); this.geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3)); this.geometry.setAttribute('color', new T.BufferAttribute(this.colors, 3));
      const spark = P.canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff'); g.addColorStop(.2, '#fff'); g.addColorStop(1, '#ffffff00'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 32, 32);
      this.points = new T.Points(this.geometry, new T.PointsMaterial({ map: spark, size: .12, transparent: true, vertexColors: true, depthWrite: false, blending: T.AdditiveBlending })); this.points.frustumCulled = false; scene.add(this.points);
      this.linesGeometry = new T.BufferGeometry(); this.linePositions = new Float32Array(96 * 6); this.linesGeometry.setAttribute('position', new T.BufferAttribute(this.linePositions, 3)); this.lines = new T.LineSegments(this.linesGeometry, new T.LineBasicMaterial({ color: 0xffce8d, transparent: true, opacity: .6, depthWrite: false })); this.lines.frustumCulled = false; scene.add(this.lines);
      this.marks = []; this.markCursor = 0;
      const markGeometry = new T.PlaneGeometry(.12, .12), markMaterial = new T.MeshBasicMaterial({ map: P.canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * .48); g.addColorStop(0, '#111820ee'); g.addColorStop(.4, '#292824cc'); g.addColorStop(1, '#151d2000'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, 32, 32), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (let i = 0; i < 72; i++) { const mesh = new T.Mesh(markGeometry, markMaterial); mesh.visible = false; scene.add(mesh); this.marks.push(mesh); }
      this.smokes = Array.from({ length: 64 }, () => { const mesh = new T.Mesh(new T.SphereGeometry(1, 10, 8), new T.MeshLambertMaterial({ color: 0x9da5a8, transparent: true, opacity: .8, depthWrite: false, side: T.DoubleSide })); mesh.visible = false; scene.add(mesh); return mesh; });
      this.smokeBirth = new WeakMap(); this.dummy = new T.Object3D();
      this.cases = Array.from({ length: 48 }, () => ({ life: 0 })); this.caseCursor = 0; this.caseMesh = new T.InstancedMesh(new T.BoxGeometry(.028, .026, .07), new T.MeshLambertMaterial({ color: 0xbd9d59 }), 48); this.caseMesh.frustumCulled = false; scene.add(this.caseMesh);
      this.projectiles = new T.InstancedMesh(new T.SphereGeometry(.105, 8, 6), new T.MeshLambertMaterial({ color: 0xa7b8a9 }), 32); this.projectiles.frustumCulled = false; scene.add(this.projectiles);
      this.flashes = Array.from({ length: 10 }, () => { const mesh = new T.Mesh(new T.SphereGeometry(.11, 8, 6), new T.MeshBasicMaterial({ color: 0xffcf8a })); mesh.visible = false; scene.add(mesh); return { mesh, life: 0 }; });
      this.lights = Array.from({ length: 2 }, () => { const light = new T.PointLight(0xffc383, 0, 6); scene.add(light); return { light, life: 0 }; });
      this.shake = 0; this.insideSmoke = 0; 
      this.dropMaterial = new T.MeshLambertMaterial({ color: 0x647c83 });
      this.drops = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), this.dropMaterial, 96); this.drops.frustumCulled = false; scene.add(this.drops);
    }
    burst(x, y, z, count, color, speed) {
      for (let i = 0; i < count; i++) { const p = this.particles[this.cursor++ % this.particles.length], v = speed || 4; Object.assign(p, { x, y, z, vx: (Math.random() - .5) * v, vy: Math.random() * v * .8, vz: (Math.random() - .5) * v, life: .25 + Math.random() * .55, color }); }
    }
    pulse(at, intensity, duration, color) { const f = this.lights.reduce((a, b) => a.life < b.life ? a : b); f.life = duration; f.initial = duration; f.power = intensity; f.light.position.set(at.x, at.y || 1, at.z); f.light.color.setHex(color || 0xffbe79); }
    event(e, m, watched) {
      if (e.type === 'round') { this.clear(); return; }
      const p = e.actor != null ? m.players[e.actor] : null;
      if (e.type === 'shot' && e.from && e.to) {
        if ((K.weapons[e.weapon] || {}).slot === 3) return;
        const t = this.traces[this.traceCursor++ % this.traces.length]; Object.assign(t, { from: e.from, to: e.to, life: .05 });
        if (e.impact) { const box = !e.material && !e.impactKind && e.impact === 'wall' ? K.map.boxes.find(b => Math.abs(e.to.x - b.x) <= b.w / 2 + .025 && Math.abs(e.to.z - b.z) <= b.d / 2 + .025 && e.to.y >= (b.y || 0) - .025 && e.to.y <= (b.y || 0) + b.h + .025) : null; const material = e.material || e.impactKind || box && box.kind, wood = material === 'wood' || material === 'panel'; this.burst(e.to.x, e.to.y, e.to.z, wood ? 6 : 9, wood ? [.55, .3, .09] : e.impact === 'robot' ? [.25, .8, 1] : [1, .65, .18], wood ? 2 : 4); }
        if (e.impact === 'wall' && e.normal) {
          const n = e.normal, mark = this.marks[this.markCursor++ % this.marks.length];
          if (Math.hypot(n.x, n.y, n.z) > .5) { mark.visible = true; mark.position.set(e.to.x + n.x * .012, e.to.y + n.y * .012, e.to.z + n.z * .012); mark.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(n.x, n.y, n.z)); }
        }
        if (!e.pellet && p) {
          const s = Math.sin(p.yaw), c = Math.cos(p.yaw), casing = this.cases[this.caseCursor++ % this.cases.length]; Object.assign(casing, { x: p.x + c * .22, y: e.from.y - .15, z: p.z + s * .22, vx: c * 2 + s * .5, vy: 2.1, vz: s * 2 - c * .5, life: 1.5, angle: Math.random() * 6 });
          const f = this.flashes[p.id % this.flashes.length]; f.life = .05; f.mesh.position.set(p.x + s * .7 + c * .2, e.from.y - .25, p.z - c * .7 + s * .2); f.mesh.visible = p.id !== watched;
          this.pulse(f.mesh.position, 1.1, .055);
        }
      } else if (e.type === 'hit') { this.burst(e.x, e.y, e.z, e.part === 'head' ? 16 : 7, [.25, .78, 1]); if(e.target===watched)this.shake=Math.max(this.shake,.018); }
      else if (e.type === 'blastHit') { const a = m.players[e.target]; if (a) this.burst(a.x, a.y + 1, a.z, 45, [.4, .85, 1], 7); }
      else if (e.type === 'kill') { const a = m.players[e.target]; if (a) this.burst(a.x, a.y + 1.1, a.z, 32, [.4, .8, 1], 5); }
      else if (e.type === 'step' && p && p.id !== watched) this.burst(p.x, p.y + .04, p.z, 2, [.12, .12, .1], .5);
      else if (e.type === 'grenade' && e.kind !== 'smoke') { this.burst(e.x, e.y, e.z, e.kind === 'flash' ? 45 : 90, e.kind === 'flash' ? [1, 1, 1] : [1, .48, .13], 9); this.pulse(e, 5, .3, e.kind === 'flash' ? 0xffffff : 0xffa343); const listener = m.players[watched]; if (listener) this.shake = Math.max(this.shake, .12 / (1 + K.dist(listener, e) * .12)); }
      else if (e.type === 'explode') { this.burst(e.x, 1, e.z, 240, [.3, .8, 1], 20); this.pulse(e, 12, .8, 0x80e1ff); this.shake = .3; }
    }
    clear() { this.particles.forEach(p => { p.life = 0; }); this.traces.forEach(p => { p.life = 0; }); this.cases.forEach(p => { p.life = 0; }); this.marks.forEach(p => { p.visible = false; }); this.smokeBirth = new WeakMap(); this.shake = 0; this.insideSmoke=0;this.smokes.forEach(s=>s.visible=false);this.projectiles.count=this.drops.count=this.caseMesh.count=0;this.geometry.setDrawRange(0,0);this.linesGeometry.setDrawRange(0,0); this.lights.forEach(f => { f.life = 0; f.light.intensity = 0; }); this.flashes.forEach(f => { f.life = 0; f.mesh.visible = false; }); }
    render(m, p, dt) {
      let count = 0;
      for (const a of this.particles) if (a.life > 0) {
        a.life -= dt; a.vy -= dt * 8; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
        if (a.y < .03) { a.y = .03; a.vy = Math.abs(a.vy) * .25; a.vx *= .9; a.vz *= .9; }
        const at = count * 3; this.positions[at] = a.x; this.positions[at + 1] = a.y; this.positions[at + 2] = a.z; const fade = Math.max(0, Math.min(1, a.life * 4)); this.colors[at] = a.color[0] * fade; this.colors[at + 1] = a.color[1] * fade; this.colors[at + 2] = a.color[2] * fade; count++;
      }
      this.geometry.setDrawRange(0, count); this.geometry.attributes.position.needsUpdate = this.geometry.attributes.color.needsUpdate = true;
      count = 0;
      for (const t of this.traces) if (t.life > 0) { t.life -= dt; this.linePositions.set([t.from.x, t.from.y, t.from.z, t.to.x, t.to.y, t.to.z], count++ * 6); }
      this.linesGeometry.setDrawRange(0, count * 2); this.linesGeometry.attributes.position.needsUpdate = true;
      count = 0;
      for (const a of this.cases) if (a.life > 0) { a.life -= dt; a.vy -= dt * 9; a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; if (a.y < .035) { a.y = .035; a.vy *= -.25; a.vx *= .8; a.vz *= .8; } else a.angle += dt * 15; this.dummy.position.set(a.x, a.y, a.z); this.dummy.rotation.set(a.angle, a.angle * .7, 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.caseMesh.setMatrixAt(count++, this.dummy.matrix); }
      this.caseMesh.count = count; this.caseMesh.instanceMatrix.needsUpdate = true;
      for (const f of this.flashes) { f.life -= dt; if (f.life <= 0) f.mesh.visible = false; }
      for (const f of this.lights) { f.life = Math.max(0, f.life - dt); f.light.intensity = f.life > 0 ? f.power * f.life / f.initial : 0; }
      this.shake *= Math.exp(-dt * 5); this.insideSmoke = 0;
      const smokes = m ? m.smokes || [] : [];
      for (const s of smokes) if (!this.smokeBirth.has(s)) this.smokeBirth.set(s, m.time);
      const lobes = Math.max(1, Math.min(8, Math.floor(this.smokes.length / Math.max(1, smokes.length))));
      for (let i = 0; i < this.smokes.length; i++) {
        const cloud = smokes[Math.floor(i / lobes)], mesh = this.smokes[i]; mesh.visible = !!cloud; if (!cloud) continue;
        const age = Number.isFinite(cloud.age) ? cloud.age : m.time - this.smokeBirth.get(cloud), grow = Number.isFinite(cloud.age) ? 1 : Math.min(1, .16 + age / 1.3), fade = K.clamp(cloud.life / 2, 0, 1), radius = Number.isFinite(cloud.r)?cloud.r:4.2, j = i % lobes, angle = j * 2.399;
        mesh.position.set(cloud.x + Math.sin(angle) * radius * .38 * grow, (Number.isFinite(cloud.y) ? cloud.y : 1.5) + Math.sin(j * 1.3) * radius * .06, cloud.z + Math.cos(angle) * radius * .38 * grow);
        mesh.scale.set(radius * .62 * grow, radius / .7 * grow, radius * .62 * grow); mesh.rotation.y = age * .035 + j; mesh.material.opacity = .86 * fade;
        const eyeDistance = p ? Math.hypot(p.x - cloud.x, p.z - cloud.z, ((p.y || 0) + (p.crouch ? 1.04 : 1.58) - (Number.isFinite(cloud.y) ? cloud.y : 1.5)) * .7) : Infinity;
        if (eyeDistance < radius * grow) this.insideSmoke = Math.max(this.insideSmoke, fade * K.clamp((radius * grow - eyeDistance) / .8, 0, 1));
      }
      const grenades = m ? m.grenades || [] : []; this.projectiles.count = Math.min(32, grenades.length);
      for (let i = 0; i < this.projectiles.count; i++) { const g = grenades[i]; this.dummy.position.set(g.x, g.y, g.z); this.dummy.rotation.set(m.time * 9, i, 0); this.dummy.scale.setScalar(1); this.dummy.updateMatrix(); this.projectiles.setMatrixAt(i, this.dummy.matrix); } this.projectiles.instanceMatrix.needsUpdate = true;
      count = 0;
      for (const d of (m ? m.drops || [] : []).slice(0, 24)) { const w = K.weapons[d.gear && d.gear.id] || {}, len = w.slot === 2 ? .36 : .72;
        for (const part of [[0, .1, 0, len, .1, .13], [len * .5, .1, 0, .25, .04, .04], [-.12, .1, .1, .1, .07, .18]]) { this.dummy.position.set(d.x + part[0], (d.y || 0) + part[1], d.z + part[2]); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(part[3], part[4], part[5]); this.dummy.updateMatrix(); this.drops.setMatrixAt(count++, this.dummy.matrix); }
      }
      this.drops.count = count; this.drops.instanceMatrix.needsUpdate = true;
    }
  }
  K.Effects = Effects;
})(window.KJ);
