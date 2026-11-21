(function (K) {
  'use strict';
  const T = window.THREE, P = K.presentation;
  const node = (parent, x, y, z) => { const n = new T.Group(); n.position.set(x, y, z); parent.add(n); return n; };
  class Robots {
    constructor(scene) {
      this.scene = scene; this.units = []; this.parts = []; this.lights = []; this.joints = [];
      this.body = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial(), 360);
      this.glow = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), 110);
      this.joint = new T.InstancedMesh(new T.CylinderGeometry(.5, .5, 1, 8), new T.MeshLambertMaterial({ color: 0x202d37 }), 100);
      this.shadow = new T.InstancedMesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: P.canvasTexture((c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false }), 10);
      for (const mesh of [this.body, this.glow, this.joint, this.shadow]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(mesh); }
      for(const mesh of [this.body,this.glow,this.joint]){
        const alpha=new T.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count || (mesh===this.body?360:mesh===this.glow?110:100)).fill(1),1);
        mesh.geometry.setAttribute('nearOpacity',alpha);
        mesh.material.onBeforeCompile=shader=>{
          shader.vertexShader='attribute float nearOpacity; varying float vNearOpacity;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNearOpacity = nearOpacity;');
          shader.fragmentShader='varying float vNearOpacity;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat screenDoor = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))); if (screenDoor >= vNearOpacity) discard;');
        };
        mesh.material.customProgramCacheKey=()=> 'near-ally-v1';
      }
      this.dummy = new T.Object3D(); this.color = new T.Color();
      for (let id = 0; id < 10; id++) this.create(id);
    }
    part(parent, x, y, z, w, h, d, type, color) {
      const obj = node(parent, x, y, z); obj.scale.set(w, h, d); const entry = { obj, owner: this.owner, color: color || 'armor' };
      (type === 'glow' ? this.lights : type === 'joint' ? this.joints : this.parts).push(entry); return obj;
    }
    create(id) {
      this.owner = id;
      const root = new T.Group(), hips = node(root, 0, .86, 0), torso = node(hips, 0, 0, 0), head = node(torso, 0, .64, 0);
      this.part(torso, 0, .2, 0, .47, .49, .28, 'body'); this.part(torso, 0, .23, -.16, .32, .29, .055, 'body', 'dark');
      this.part(torso, 0, .32, -.194, .29, .028, .015, 'glow'); this.part(torso, 0, .13, -.194, .09, .065, .015, 'glow');
      this.part(torso, 0, -.1, 0, .34, .15, .24, 'body', 'dark');
      this.part(head, 0, 0, 0, .31, .29, .29, 'body', 'dark'); this.part(head, 0, .04, -.151, .29, .085, .018, 'glow');
      this.part(head, 0, .155, -.02, .24, .035, .23, 'body'); this.part(head, .17, .015, 0, .04, .16, .16, 'body');
      const legs = [], arms = [];
      for (const side of [-1, 1]) {
        const leg = node(hips, side * .145, -.08, 0), knee = node(leg, 0, -.33, 0);
        this.part(leg, 0, -.16, 0, .17, .32, .19, 'body'); this.part(knee, 0, 0, 0, .17, .14, .18, 'joint', 'dark');
        this.part(knee, 0, -.19, 0, .145, .31, .16, 'body', 'dark'); this.part(knee, 0, -.13, -.09, .095, .18, .035, 'body');
        this.part(knee, 0, -.33, -.055, .19, .11, .31, 'body', 'dark'); this.part(knee, 0, -.16, -.115, .035, .11, .015, 'glow'); legs.push({ leg, knee });
        const arm = node(torso, side * .3, .4, 0), elbow = node(arm, 0, -.28, 0);
        this.part(arm, 0, -.04, 0, .2, .22, .24, 'body'); this.part(arm, side * .105, -.04, 0, .018, .06, .18, 'glow');
        this.part(arm, 0, -.19, 0, .13, .22, .15, 'body', 'dark'); this.part(elbow, 0, 0, 0, .145, .13, .15, 'joint');
        this.part(elbow, 0, -.16, 0, .14, .28, .16, 'body'); this.part(elbow, 0, -.3, 0, .14, .1, .15, 'body', 'dark'); arms.push({ arm, elbow });
      }
      const weapon = node(torso, .2, .18, -.4);
      this.part(weapon, 0, 0, -.04, .12, .14, .42, 'body', 'dark'); this.part(weapon, 0, .02, -.36, .035, .04, .3, 'body', 'dark'); this.part(weapon, 0, -.14, -.05, .08, .19, .12, 'body', 'dark');
      this.part(weapon, 0, .08, -.1, .04, .02, .23, 'glow');
      const pack = node(torso, 0, .15, .24); this.part(pack, 0, 0, 0, .36, .4, .19, 'body', 'dark'); this.part(pack, 0, .04, .105, .26, .05, .025, 'glow', 'device');
      const u = { root, hips, torso, head, legs, arms, weapon, pack, stride: 0 }; this.units[id] = u;
    }
    update(m, watched, dt) {
      const listener=m&&m.players.find(p=>p.id===watched);this.shadow.count=m?10:0;
      for (let i = 0; i < this.units.length; i++) {
        const u = this.units[i], a = m && m.players[i];
        if (!a) { u.root.scale.setScalar(0); u.root.updateMatrixWorld(true); continue; }
        const distance=listener?K.dist(a,listener):99;u.opacity=listener&&a.team===listener.team?K.clamp((distance-.5)/1.4,.08,1):1;
        const visible = a.id !== watched, fall = a.alive ? 0 : K.clamp((m.time - (a.deathTime || m.time)) / .65, 0, 1);
        u.root.position.set(a.x, (a.y || 0) + fall * .18, a.z); u.root.rotation.set(fall * Math.PI / 2, -a.yaw, fall * .18); u.root.scale.setScalar(visible ? 1 : 0);
        u.hips.position.y = (a.crouch ? .57 : .86) * (1 - fall) + .18 * fall;
        u.stride += dt * (a.moving && a.alive ? a.walk ? 7 : 11 : 0);
        const stride = a.moving && a.alive ? Math.sin(u.stride) * (a.walk ? .22 : .52) : 0;
        u.torso.rotation.x = (a.crouch ? .18 : 0) - (a.pitch || 0) * .35;
        u.torso.rotation.z = a.moving ? Math.sin(u.stride) * .035 : 0;
        u.head.rotation.x = -(a.pitch || 0) * .65;
        u.legs.forEach((l, j) => { l.leg.rotation.x = stride * (j ? -1 : 1) - (a.crouch ? .5 : 0); l.knee.rotation.x = a.crouch ? 1.05 : Math.max(0, stride * (j ? 1 : -1)) * .7; });
        const shot = Math.max(0, 1 - (m.time - a.lastShot) / .13), reloading = a.reloadEnd > m.time, progress = reloading ? 1 - (a.reloadEnd - m.time) / (K.weapons[a.weapon].reload || 2) : 0;
        u.arms.forEach((arm, j) => { arm.arm.rotation.x = -.75 - shot * .12 + (j === 0 && reloading ? Math.sin(progress * Math.PI) * .6 : 0); arm.arm.rotation.z = j ? -.15 : -.12; arm.elbow.rotation.x = -1.05 + (j === 0 && reloading ? Math.sin(progress * Math.PI) : 0); });
        const w = K.weapons[a.weapon] || {}, c = P.category(w);
        u.weapon.scale.set(c === 'pistol' ? .85 : 1, 1, c === 'pistol' ? .55 : c === 'sniper' ? 1.3 : 1);
        u.weapon.rotation.x = -(a.pitch || 0) * .6 - shot * .18; u.weapon.position.z = -.4 + shot * .04;
        u.pack.scale.setScalar(m.device.carrier === a.id ? 1 : 0); u.root.updateMatrixWorld(true);
        this.dummy.position.set(a.x, (a.y || 0) + .02, a.z); this.dummy.rotation.set(-Math.PI / 2, 0, 0); this.dummy.scale.setScalar(visible ? 1 : 0); this.dummy.updateMatrix(); this.shadow.setMatrixAt(i, this.dummy.matrix);
      }
      for (const [items, mesh, glow] of [[this.parts, this.body, false], [this.lights, this.glow, true], [this.joints, this.joint, false]]) {
        mesh.count = items.length;
        items.forEach((e, index) => {
          mesh.setMatrixAt(index, e.obj.matrixWorld); mesh.geometry.attributes.nearOpacity.array[index]=this.units[e.owner].opacity==null?1:this.units[e.owner].opacity;
          if (mesh === this.joint) return;
          const p = m && m.players[e.owner];
          const side = p && p.side === 'attack'; this.color.setHex(e.color === 'device' ? 0xffce6b : e.color === 'dark' ? 0x25313d : glow ? side ? 0xffb24e : 0x62e1ff : side ? 0xb67843 : 0x4b829c);
          if (p && !p.alive) this.color.multiplyScalar(.45); mesh.setColorAt(index, this.color);
        });
        mesh.geometry.attributes.nearOpacity.needsUpdate=true; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      this.shadow.instanceMatrix.needsUpdate = true;
    }
  }
  class HeldModel {
    constructor() {
      this.scene = new T.Scene(); this.camera = new T.PerspectiveCamera(58, 1, .01, 8); this.root = new T.Group(); this.scene.add(this.root);
      this.scene.add(new T.HemisphereLight(0xd3e1f6, 0x32303a, .95)); const light = new T.DirectionalLight(0xffc78c, .85); light.position.set(-2, 4, 1); this.scene.add(light);
      this.flashLight = new T.PointLight(0xffb76b, 0, 2); this.flashLight.position.set(.2, -.15, -.9); this.scene.add(this.flashLight);
      this.materials = { body: new T.MeshLambertMaterial({ color: 0x34424b }), dark: new T.MeshLambertMaterial({ color: 0x17222b }), metal: new T.MeshLambertMaterial({ color: 0x7d8987 }), grip: new T.MeshLambertMaterial({ color: 0x665f50 }), stripe: new T.MeshBasicMaterial({ color: 0x80d2df }), glass: new T.MeshBasicMaterial({ color: 0x589dac }), arm: new T.MeshLambertMaterial({ color: 0x3e5a6c }), flash: new T.MeshBasicMaterial({ color: 0xffd494, transparent: true, opacity: .9, depthWrite: false }) };
      this.models = {}; for(const [id,w]of Object.entries(K.weapons))this.models[id]=this.build(P.category(w),id);for(const cat of ['grenade','device'])this.models[cat]=this.build(cat,cat);
      this.arms = node(this.root, 0, 0, 0);
      // 前腕の端はカメラへ伸ばさず、手首と短い袖だけを見せる。
      this.cylinder(this.arms,.025,-.15,.09,.041,.16,'arm');
      this.cylinder(this.arms,.025,-.145,.005,.045,.035,'dark');
      this.box(this.arms,0,-.09,-.01,.075,.08,.075,'dark');
      this.leftArm=node(this.arms,-.08,-.14,-.2);
      this.cylinder(this.leftArm,0,0,.04,.034,.14,'arm');
      this.box(this.leftArm,.025,.035,-.02,.065,.058,.075,'dark');
      this.recoil = 0; this.shotAge = 10; this.swap = 1; this.lastKey = ''; this.swayX = 0; this.swayY = 0; this.yaw = 0; this.pitch = 0;
    }
    box(parent, x, y, z, w, h, d, material) { const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), this.materials[material]); mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
    cylinder(parent, x, y, z, r, length, material) { const mesh = new T.Mesh(new T.CylinderGeometry(r, r, length, 10), this.materials[material]); mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
    build(category,id) {
      const g = node(this.root, 0, 0, 0); g.visible = false;
      if (category === 'melee') { const baton = this.cylinder(g, .025, .08, -.12, .028, .6, 'dark'); baton.rotation.x = .3; this.box(g, .025, .26, -.18, .026, .22, .026, 'stripe'); this.cylinder(g, .025, -.08, -.07, .05, .04, 'metal'); return g; }
      if (category === 'grenade') { const sphere = new T.Mesh(new T.SphereGeometry(.085, 12, 8), this.materials.body); sphere.position.set(0, -.02, -.04); g.add(sphere); this.box(g, 0, .07, -.04, .04, .035, .05, 'metal'); this.box(g, .04, .02, -.04, .015, .12, .025, 'stripe'); return g; }
      if (category === 'device') { this.box(g, -.09, -.04, -.15, .3, .1, .22, 'body'); this.box(g, -.09, .015, -.17, .13, .01, .08, 'glass'); for (let i = 0; i < 4; i++) this.box(g, -.19 + i * .06, .017, -.08, .023, .012, .025, 'stripe'); return g; }
      const pistol = category === 'pistol', sniper = category === 'sniper', smg = category === 'smg', shotgun = category === 'shotgun', length = ({pebble:.2,ripple:.25,comet:.32,swift:.31,reed:.4,hail:.49,ember:.48,tide:.53,beacon:.65})[id] || .46;
      // 薄い上部、機関部、細い銃身を分けて輪郭と陰影を作る。
      this.box(g,0,-.015,-.1,pistol?.064:.084,pistol?.038:.072,length*.84,'body');
      g.userData.slide=this.box(g,0,.025,-.12,pistol?.068:.073,pistol?.038:.04,length,id==='comet'?'metal':'body');
      this.box(g,0,.048,-.12,.044,.012,length*.9,'body');
      if(pistol){for(let i=0;i<4;i++)this.box(g,.035,.026,-.045-i*.013,.003,.025,.005,'dark');
        this.box(g,0,-.062,-.1,.049,.008,.075,'metal');this.box(g,0,-.045,-.14,.049,.04,.008,'metal');}
      if(smg){this.cylinder(g,0,.006,-.32,.033,.15,'body');this.box(g,.043,.01,-.16,.006,.014,.1,'stripe');}
      if(category==='rifle'){this.box(g,0,-.012,-.34,.08,.07,.18,'grip');}
      const grip = this.box(g, 0, -.105, pistol ? -.04 : .015, .063, .16, .085, 'grip'); grip.rotation.x = -.22;
      if (!pistol) {
        // 細い肩当て。手前に大きな直方体を置かない。
        for(const side of [-1,1])this.box(g,side*.024,-.025,.13,.012,.018,smg?.12:.19,'metal');
        this.box(g,0,-.055,smg?.19:.23,.046,.1,.025,'dark');
      }
      const barrelEnd = -.12 - length / 2 - (sniper ? .25 : shotgun ? .2 : .09);
      this.cylinder(g, 0, .005, barrelEnd + .055, pistol ? .013 : .019, sniper ? .32 : shotgun ? .24 : .16, 'dark');
      this.cylinder(g, 0, .005, barrelEnd - .02, .025, .045, 'metal');
      this.box(g, 0, .06, -.12, .034, .018, length * .85, 'dark'); this.box(g, 0, .073, -.12 - length * .35, .012, .03, .025, 'metal');
      this.box(g, .048, .005, -.12, .012, .025, .09, 'metal'); this.box(g, -.048, .01, -.04, .01, .018, .06, 'stripe');
      const mag = this.box(g, 0, -.13, pistol ? -.04 : -.14, .055, pistol ? .1 : .2, .085, 'dark'); if (!pistol) mag.rotation.x = .12; g.userData.magazine = mag; g.userData.magY = mag.position.y;
      if (shotgun) { this.cylinder(g, 0, -.045, -.38, .018, .28, 'metal'); g.userData.pump=this.cylinder(g,0,-.025,-.34,.046,.18,'grip'); }
      if (!pistol) for (let i = 0; i < 5; i++) { this.box(g, .048, .025, -.21 - i * .031, .008, .018, .018, 'dark'); this.box(g, -.048, .025, -.21 - i * .031, .008, .018, .018, 'dark'); }
      if (sniper) { this.cylinder(g, 0, .12, -.15, .035, .23, 'dark'); this.cylinder(g, 0, .12, -.28, .047, .06, 'metal'); this.cylinder(g, 0, .12, -.312, .039, .005, 'glass'); this.box(g, 0, .075, -.1, .035, .08, .08, 'metal'); }
      else if (!pistol && !shotgun) { this.box(g, 0, .095, .01, .065, .07, .04, 'dark'); this.box(g, 0, .103, -.013, .039, .04, .005, 'glass'); }
      const flash = new T.Mesh(new T.ConeGeometry(.055, .18, 5), this.materials.flash); flash.rotation.x = -Math.PI / 2; flash.position.set(0, .005, barrelEnd - .12); g.add(flash); g.userData.flash = flash;
      return g;
    }
    reset() { this.recoil=0;this.shotAge=10;this.swap=1;this.lastKey='';this.swayX=this.swayY=0;this.yaw=this.pitch=0;this.root.visible=false;this.flashLight.intensity=0; }
    shot(w) { this.recoil = Math.min(.15, this.recoil + (w.kick || .015) * 1.6); this.shotAge = 0; }
    update(p, m, dt, slot, menu, camera) {
      this.root.visible = !!p && p.alive && !p.scope && !menu; if (!p) return;
      const w = K.weapons[p.weapon] || {}, cat = p.interact>0 ? 'device' : slot === 4 ? 'grenade' : slot === 5 ? 'device' : P.category(w), key = p.weapon + ':' + cat;
      if (this.lastKey !== key) { this.swap = 1; this.lastKey = key; }
      this.swap = Math.max(0, this.swap - dt * 5); this.recoil *= Math.exp(-dt * 19); this.shotAge += dt;
      const bob = p.moving && p.grounded ? Math.sin(m.time * (p.walk ? 8 : 12)) * .008 : Math.sin(m.time * 1.9) * .0018;
      const targetX = K.clamp(K.angle(p.yaw - this.yaw) * 1.3, -.035, .035), targetY = K.clamp((p.pitch - this.pitch) * .7, -.025, .025); this.yaw = p.yaw; this.pitch = p.pitch;
      this.swayX += (targetX - this.swayX) * Math.min(1, dt * 12); this.swayY += (targetY - this.swayY) * Math.min(1, dt * 12);
      const reload = p.reloadEnd > m.time ? K.clamp(1 - (p.reloadEnd - m.time) / (w.reload || 2), 0, 1) : 0, wave = Math.sin(reload * Math.PI);
      this.root.position.set(.29 + bob * .5 - this.swayX, -.235 + bob - wave * .065 - this.swap * .24 + (p.grenadePrimed?.045:0), -.74 + this.recoil * .3);
      this.root.rotation.set(-wave * .34 + this.recoil + this.swayY, wave * .22, wave * -.42 + bob * .7);
      this.root.scale.setScalar(.9); this.leftArm.visible=cat!=='pistol'&&cat!=='melee'&&cat!=='grenade'; this.leftArm.position.y = -.14 - wave * .09; this.leftArm.rotation.x = wave * .55;
      this.materials.arm.color.setHex(p.side === 'attack' ? 0x886343 : 0x3e5a6c); this.materials.stripe.color.setHex(p.side === 'attack' ? 0xffbc6c : 0x80d2df);
      for (const [c, model] of Object.entries(this.models)) { model.visible = c === (cat==='grenade'?'grenade':cat==='device'?'device':p.weapon); const data = model.userData; if(data.slide)data.slide.position.z=-.12+(cat==='pistol'?Math.max(0,1-this.shotAge/.13)*.035:0);if(data.pump)data.pump.position.z=-.34+Math.max(0,Math.sin(Math.min(1,this.shotAge/.5)*Math.PI))*.065; if (data.flash) { data.flash.visible = this.shotAge < .045 && !reload; data.flash.rotation.z = m.time * 50; } if (data.magazine) { data.magazine.position.y = data.magY - Math.sin(reload * Math.PI) * .2; data.magazine.rotation.z = wave * -.3; } }
      this.flashLight.intensity = this.shotAge < .045 && this.root.visible ? 1.8 : 0;
      this.camera.aspect = camera.aspect; this.camera.updateProjectionMatrix();
    }
  }
  K.Robots = Robots; K.HeldModel = HeldModel;
})(window.KJ);
