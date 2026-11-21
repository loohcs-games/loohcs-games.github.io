/* 描画専用。地形データを読むだけで、当たり判定や経路は変更しない。 */
(function (K) {
  'use strict';
  const T = window.THREE, P = K.presentation = {};
  P.palette = { amber: 0xf4b365, blue: 0x69d4ed, ink: 0x142534, steel: 0x344754, concrete: 0x8a8b87 };
  P.category = w => {
    const c = w.category || w.type;
    if (['pistol', 'smg', 'shotgun', 'rifle', 'sniper', 'melee'].includes(c)) return c;
    return w.slot === 3 ? 'melee' : w.slot === 2 ? 'pistol' : w.scope ? 'sniper' : w.pellets > 1 ? 'shotgun' : w.price < 2000 || w.damage < 27 ? 'smg' : 'rifle';
  };
  P.bounds = () => {
    const b = K.map.bounds;
    if (b && [b.minX, b.maxX, b.minZ, b.maxZ].every(Number.isFinite)) return b;
    const boxes = K.map.boxes;
    return { minX: Math.min(...boxes.map(b => b.x - b.w / 2)), maxX: Math.max(...boxes.map(b => b.x + b.w / 2)), minZ: Math.min(...boxes.map(b => b.z - b.d / 2)), maxZ: Math.max(...boxes.map(b => b.z + b.d / 2)) };
  };
  P.area = p => {
    if (typeof K.map.areaAt === 'function') { const a = K.map.areaAt(p); if (a) return typeof a === 'string' ? { name: a } : a; }
    const areas = Array.isArray(K.map.areas) ? K.map.areas : [];
    return areas.find(a => Math.abs(a.x - p.x) < a.w / 2 && Math.abs(a.z - p.z) < a.d / 2) || { name: K.map.location ? K.map.location(p) : '訓練場' };
  };
  P.accent = p => {
    const a = P.area(p), name = String(a.site || a.name || '');
    if (a.color != null) return a.color;
    const s = K.map.sites.find(s => name.indexOf(s.id) >= 0) || K.map.sites.find(s => K.dist(s, p) < (s.r || 3) + 6);
    return s ? s.id === 'A' ? P.palette.amber : P.palette.blue : 0xc9d9d9;
  };
  P.materialAt = p => {
    if(K.map.materialAt)return K.map.materialAt(p);
    const a = P.area(p); if (a.material) return a.material;
    const floor = K.map.boxes.find(b => Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2 && Math.abs((p.y || 0) - (b.y + b.h)) < .25);
    return floor ? floor.kind === 'wood' ? 'wood' : 'metal' : 'concrete';
  };
  P.canvasTexture = (draw, w, h) => {
    const c = document.createElement('canvas'); c.width = w || 256; c.height = h || 256; draw(c.getContext('2d'), c.width, c.height);
    const texture = new T.CanvasTexture(c); texture.encoding = T.sRGBEncoding; return texture;
  };
  P.label = (text, color, w, h, transparent) => {
    const texture = P.canvasTexture((c, W, H) => {
      if (!transparent) { c.fillStyle = '#142430'; c.fillRect(0, 0, W, H); }
      c.strokeStyle = color; c.lineWidth = 8; c.strokeRect(9, 9, W - 18, H - 18);
      c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 ' + (text.length < 3 ? 174 : 60) + 'px sans-serif'; c.fillText(text, W / 2, H / 2);
      if (text.length < 3) { c.font = '15px sans-serif'; c.fillText('訓練用装置 設置区画', W / 2, H - 30); }
    }, 512, 256);
    return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: texture, transparent: !!transparent, depthWrite: !transparent, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
  };
  class Scenery {
    constructor(scene) {
      this.scene = scene; this.batches = new Map(); this.random = K.rng(202611);
      this.materials = {}; this.makeMaterials(); this.build();
    }
    makeMaterials() {
      const texture = kind => P.canvasTexture((c, w, h) => {
        c.fillStyle = kind === 'floor' ? '#5b6263' : kind === 'wood' ? '#b49a6b' : kind === 'metal' ? '#a3acaa' : '#b9b8ac'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 1800; i++) { const n = this.random(); c.fillStyle = n < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)'; c.fillRect(this.random() * w, this.random() * h, 1 + this.random() * 3, 1); }
        if (kind === 'metal') {
          for (let x = 0; x < w; x += 24) { c.fillStyle = '#414e5340'; c.fillRect(x, 0, 6, h); c.fillStyle = '#f6f3dc44'; c.fillRect(x + 6, 0, 3, h); }
          c.fillStyle = '#3a4149'; for (let x = 12; x < w; x += 48) { c.fillRect(x, 8, 3, 3); c.fillRect(x, h - 10, 3, 3); }
        } else if (kind === 'wood') {
          for (let y = 0; y < h; y += 32) { c.fillStyle = '#332d2860'; c.fillRect(0, y, w, 2); for (let j = 0; j < 9; j++) { c.strokeStyle = '#50412c30'; c.beginPath(); c.moveTo(0, y + 4 + j * 3); c.bezierCurveTo(60, y + j * 3, 170, y + 12 + j * 2, w, y + j * 3); c.stroke(); } }
        } else {
          c.strokeStyle = '#172d3640'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
          for (let i = 0; i < 9; i++) { const x = this.random() * w, y = this.random() * h; const g = c.createRadialGradient(x, y, 1, x, y, 30); g.addColorStop(0, '#1b29322b'); g.addColorStop(1, '#1b293200'); c.fillStyle = g; c.fillRect(x - 30, y - 30, 60, 60); }
          c.strokeStyle = '#30383b40'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 84); c.lineTo(80, 100); c.lineTo(110, 84); c.stroke();
        }
      });
      for (const kind of ['floor', 'wood', 'metal', 'concrete']) {
        const map = texture(kind); map.wrapS = map.wrapT = T.RepeatWrapping; map.anisotropy = 4;
        this.materials[kind] = new T.MeshLambertMaterial({ map, color: kind === 'floor' ? 0x647582 : 0xffffff });
      }
      for (const [key, color] of Object.entries({ trim: 0x243442, edge: 0xadb6ad, amber: 0xe4aa68, blue: 0x71bccb, skyline: 0x1a293d, dark: 0x303e4b })) this.materials[key] = new T.MeshLambertMaterial({ color });
      this.materials.light = new T.MeshBasicMaterial({ color: 0xffdc9a });
      this.materials.hazard = new T.MeshLambertMaterial({ map: P.canvasTexture((c, w, h) => { c.fillStyle = '#dfae62'; c.fillRect(0, 0, w, h); c.fillStyle = '#243340'; for (let x = -h; x < w + h; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 28, 0); c.lineTo(x + h + 28, h); c.lineTo(x + h, h); c.fill(); } }) });
    }
    add(geo, x, y, z, key, rot, tint) {
      const material = this.materials[key] || this.materials.concrete, name = key + ':' + (tint || '');
      if (!this.batches.has(name)) { const mat = tint ? material.clone() : material; if (tint) mat.color.set(tint); this.batches.set(name, { material: mat, p: [], n: [], uv: [] }); }
      const batch = this.batches.get(name), g = geo.index ? geo.toNonIndexed() : geo.clone();
      const matrix = new T.Matrix4().makeRotationY(rot || 0); matrix.setPosition(x, y, z); g.applyMatrix4(matrix);
      const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv && g.attributes.uv.array;
      for (let i = 0; i < p.length; i += 3) { batch.p.push(p[i], p[i + 1], p[i + 2]); batch.n.push(n[i], n[i + 1], n[i + 2]);
        if (['floor', 'wood', 'metal', 'concrete'].includes(key)) batch.uv.push((Math.abs(n[i]) > .7 ? p[i + 2] : p[i]) / 3, (Math.abs(n[i + 1]) > .7 ? p[i + 2] : p[i + 1]) / 3);
        else batch.uv.push(uv ? uv[i / 3 * 2] : 0, uv ? uv[i / 3 * 2 + 1] : 0);
      }
      g.dispose(); geo.dispose();
    }
    box(x, y, z, w, h, d, key, tint) { this.add(new T.BoxGeometry(w, h, d), x, y, z, key, 0, tint); }
    build() {
      const scene = this.scene, b = this.bounds = P.bounds(), cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const sky = new T.Mesh(new T.SphereGeometry(230, 28, 18), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vWorld;void main(){float h=normalize(vWorld).y;vec3 low=vec3(.76,.40,.29);vec3 mid=vec3(.27,.29,.42);vec3 high=vec3(.035,.075,.17);vec3 c=mix(low,mid,smoothstep(-.04,.22,h));c=mix(c,high,smoothstep(.18,.9,h));gl_FragColor=vec4(c,1.);}' }));
      scene.add(sky);
      const sun = new T.Mesh(new T.SphereGeometry(5, 20, 12), new T.MeshBasicMaterial({ color: 0xffbd7a, fog: false })); sun.position.set(cx - 95, 14, cz - 120); scene.add(sun);
      const floor = new T.Mesh(new T.PlaneGeometry(b.maxX - b.minX + 55, b.maxZ - b.minZ + 55), this.materials.floor.clone());
      floor.material.map = this.materials.floor.map.clone(); floor.material.map.needsUpdate = true; floor.material.map.repeat.set((b.maxX - b.minX + 55) / 5, (b.maxZ - b.minZ + 55) / 5); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, -.025, cz); floor.receiveShadow = true; scene.add(floor);
      for (const box of K.map.boxes) {
        const x = box.x, z = box.z, y = box.y || 0, h = box.h, w = box.w, d = box.d, kind = box.kind;
        const key = kind === 'wood' || kind === 'crate' || kind === 'panel' ? 'wood' : ['container', 'metal', 'drum', 'barrel', 'fence'].includes(kind) ? 'metal' : 'concrete';
        const tint = key === 'metal' ? (box.color || P.accent(box)) : undefined;
        // 外形は必ずロジックの箱と一致。意匠は表面だけに足す。
        if (kind === 'drum' || kind === 'barrel') {
          this.add(new T.CylinderGeometry(w * .5, w * .5, h, 12), x, y + h / 2, z, 'metal', 0, tint);
          for (const level of [.15, .8]) this.add(new T.CylinderGeometry(w * .51, w * .51, .055, 12), x, y + h * level, z, 'trim');
          this.box(x, y + .035, z, w, .07, d, 'trim'); continue;
        }
        if (kind === 'lamp') {
          this.box(x, y + h / 2, z, w, h, d, 'trim'); this.box(x, y + h, z, 1.1, .12, .55, 'dark'); this.box(x, y + h - .075, z, .85, .025, .4, 'light'); continue;
        }
        this.box(x, y + h / 2, z, w, h, d, key, tint);
        if (h > .35 && kind !== 'fence') this.box(x, y + .12, z, w + .015, .22, d + .015, 'trim');
        if (kind === 'container') {
          this.box(x, y + h - .06, z, w + .035, .12, d + .035, 'edge');
          for (const xx of [-1, 1]) this.box(x + xx * (w / 2 - .08), y + h / 2, z, .13, h, d + .045, 'trim');
          if (w > 2) { const sign = P.label('灯環物流', '#e7dfbc', Math.min(w * .65, 2.4), .65); sign.position.set(x, y + h * .65, z + d / 2 + .025); scene.add(sign); }
        } else if (key === 'wood') {
          for (const yy of [.16, h - .16]) this.box(x, y + yy, z, w + .025, .15, d + .025, 'trim');
          for (const xx of [-.34, .34]) this.box(x + w * xx, y + h / 2, z, .085, h, d + .035, 'edge');
        } else if (h > 2 && key === 'concrete') {
          this.box(x, y + h - .12, z, w + .06, .24, d + .06, 'edge');
          this.box(x, y + .8, z, w + .025, .22, d + .025, 'edge', box.color || P.accent(box));
          if (Math.max(w, d) > 5) { const alongX = w > d; const xx = x + (alongX ? 0 : w / 2 + .08), zz = z + (alongX ? d / 2 + .08 : 0); this.box(xx, y + h - .55, zz, alongX ? 1.4 : .1, .075, alongX ? .1 : 1.4, 'light'); }
        }
      }
      for (const s of K.map.sites) {
        const warm = s.id === 'A', r = s.r || 3.3, color = warm ? '#ffc178' : '#83dce9';
        for (const sign of [-1, 1]) { this.box(s.x + r * sign, .012, s.z, .08, .02, r * 2, warm ? 'amber' : 'blue'); this.box(s.x, .012, s.z + r * sign, r * 2, .02, .08, warm ? 'amber' : 'blue'); }
        const label = P.label(s.id, color, r * 1.4, r * .8, true); label.rotation.set(-Math.PI / 2,0,0); label.userData.siteFloor=s.id; label.position.set(s.x, .025 + (s.y || 0), s.z); scene.add(label);
        // 設置場所から最も近い高い壁の内側面を選ぶ。
        const wall = K.map.boxes.filter(a => a.h > 2.5 && a.y===0 && Math.max(a.w,a.d)>3).slice().sort((a, b) => K.dist(a, s) - K.dist(b, s))[0];
        if (wall) {
          const dx = s.x - wall.x, dz = s.z - wall.z, xface = Math.abs(dx) / wall.w > Math.abs(dz) / wall.d;
          const sign = P.label(s.id, color, 1.9, 1.35); sign.position.set(xface ? wall.x + Math.sign(dx) * (wall.w / 2 + .035) : wall.x, (wall.y || 0) + Math.min(wall.h - .8, 2.8), xface ? wall.z : wall.z + Math.sign(dz) * (wall.d / 2 + .035)); sign.userData.siteWall=s.id; sign.rotation.y = xface ? Math.sign(dx) * Math.PI / 2 : dz > 0 ? 0 : Math.PI; scene.add(sign);
        }
        // 南の進入口にも床文字を置く。上辺は北、下辺は攻めの出発口へ向ける。
        const entrance=K.map.entrances.find(e=>e.site===s.id&&e.id.endsWith('south'));
        if(entrance){
          const approach=P.label(s.id,color,2.2,1.4,true);approach.rotation.set(-Math.PI/2,0,0);approach.position.set(entrance.x,.028,entrance.z-1.5);approach.userData.siteApproach=s.id;scene.add(approach);
          const gate=K.map.boxes.filter(b=>b.y===0&&b.h>2.5&&b.w>2&&Math.abs(b.z-entrance.z)<1).sort((a,b)=>K.dist(a,entrance)-K.dist(b,entrance))[0];
          if(gate){const sign=P.label(s.id+' 進入口',color,Math.min(2.5,gate.w-.3),.75);sign.position.set(gate.x,2.2,gate.z+gate.d/2+.04);sign.userData.siteEntrance=s.id;scene.add(sign);}
        }
        const lamp = new T.PointLight(warm ? 0xffa65a : 0x5bc3f2, 1.15, 18, 1.5); lamp.position.set(s.x, s.indoor ? 3.9 : 4.7, s.z); scene.add(lamp);
      }
      for (const area of Array.isArray(K.map.areas) ? K.map.areas : []) {
        if (![area.x, area.z, area.w, area.d].every(Number.isFinite)) continue;
        // 塗装線だけなので通路を塞がない。区画データの色をそのまま使う。
        for (let z = area.z - area.d / 2 + .8; z < area.z + area.d / 2 - .5; z += 3) {
          for (const side of [-1, 1]) this.box(area.x + side * (area.w / 2 - .65), .006, z, .07, .012, 1.1, 'edge', area.color || 0xabc5c6);
        }
        if (area.indoor) {
          const roof = K.map.boxes.find(b => b.kind === 'roof' && Math.abs(b.x - area.x) < area.w / 2 && Math.abs(b.z - area.z) < area.d / 2);
          if (roof) for (const side of [-1, 1]) { this.box(area.x + side * area.w * .27, roof.y - .13, area.z, .25, .08, 2.4, 'light'); this.box(area.x + side * area.w * .27, roof.y - .1, area.z, .36, .04, 2.6, 'trim'); }
        }
      }
      const middle = new T.PointLight(0xc8e7ef, .7, 23, 1.6); middle.position.set(cx, 6, cz); scene.add(middle);
      for (const [side, s] of Object.entries(K.map.spawns)) {
        const label = P.label(side === 'attack' ? '設置班 出発口' : '解除班 出発口', side === 'attack' ? '#f6be80' : '#92dbeb', 4.8, 1.3, true); label.rotation.set(-Math.PI/2,0,side==='defend'?Math.PI:0); label.position.set(s.x, .03, s.z); scene.add(label);
        for (const n of [-1, 1]) this.box(s.x + n * 4.8, .01, s.z, .12, .025, 4.5, 'hazard');
      }
      // 遠景はすべて外接矩形の外。新しいマップにも衝突しない。
      for (let i = 0; i < 16; i++) {
        const x = b.minX - 45 + i * 9, z = b.minZ - 24 - this.random() * 22, h = 5 + this.random() * 15;
        this.box(x, h / 2, z, 6 + this.random() * 5, h, 8, 'skyline');
        for (let j = 1; j < h - 1; j += 2.5) for (let k = -2; k <= 2; k += 2) if (this.random() > .45) this.box(x + k, j, z + 4.03, .6, .45, .04, 'light');
      }
      for (const side of [-1, 1]) {
        const x = side < 0 ? b.minX - 12 : b.maxX + 16, z = cz - 14;
        this.box(x, 10, z, .75, 20, .75, 'dark'); this.box(x + side * 6, 20, z, 19, .65, .8, 'amber'); this.box(x + side * 12, 13, z, .09, 14, .09, 'trim');
        for (let i = 0; i < 5; i++) this.box(x, i * 3.4 + 2, z, 3, .2, 2.2, 'dark');
        this.box(x + side * 8, 1.6, cz + 18, 9, 3, 26, 'skyline'); this.box(x + side * 8, 4, cz + 24, 6, 3, 5, 'edge');
      }
      // フェンスとドラム缶は外周の外側だけに配置。
      const fenceTexture = P.canvasTexture((c, w, h) => { c.strokeStyle = '#bcc9c2'; c.lineWidth = 2; for (let x = -h; x < w + h; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h, h); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); } }); fenceTexture.wrapS = fenceTexture.wrapT = T.RepeatWrapping; fenceTexture.repeat.set(2, 1);
      const fenceMat = this.materials.fence = new T.MeshLambertMaterial({ map: fenceTexture, transparent: true, alphaTest: .3, side: T.DoubleSide });
      for (const x of [b.minX - .4, b.maxX + .4]) for (let z = b.minZ; z < b.maxZ; z += 6) { this.box(x, 4.5, z, .065, 3, .065, 'edge'); this.add(new T.PlaneGeometry(6, 2), x, 5, z + 3, 'fence', Math.PI / 2); }
      for (let i = 0; i < 6; i++) { const x = b.maxX + 2 + i % 2 * 1.2, z = cz + i * 2; this.add(new T.CylinderGeometry(.48, .48, 1.15, 12), x, .58, z, 'metal', 0, i % 2 ? 0x507786 : 0xb88955); for (const y of [.2, .95]) this.add(new T.CylinderGeometry(.49, .49, .06, 12), x, y, z, 'trim'); }
      for (const data of this.batches.values()) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(data.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(data.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(data.uv, 2)); g.computeBoundingSphere(); const mesh = new T.Mesh(g, data.material); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); }
      this.batches.clear();
    }
  }
  K.Scenery = Scenery;
})(window.KJ);
