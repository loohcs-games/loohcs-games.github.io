(function (K) {
  'use strict';
  const $ = id => document.getElementById(id);
  const seconds = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  function icon(id) {
    const w = K.weapons[id], type = w ? K.presentation.category(w) : id;
    const paths = {
      pistol: 'M12 10h40v9H36l-5 18H20l3-18H12z M49 12h11v5H49',
      smg: 'M5 12h46v11H5z M50 14h18v5H50 M20 22h10v16H20 M8 22l-3 11h9l4-11 M5 13H0v12h5',
      rifle: 'M15 12h38v11H15z M51 15h24v5H51 M27 23h10l-2 15h-9 M16 22l-4 12h9l4-12 M15 15H3v14h7l5-8 M29 8h19v4H29',
      shotgun: 'M12 14h61v6H12 M20 21h50v4H20 M23 11h24v15H23 M14 19l-3 16H1l4-20',
      sniper: 'M15 17h40v9H15 M53 19h24v4H53 M21 10h31v6H21 M15 20H2v14h9l4-9 M26 26h9v11h-9',
      melee: 'M30 2h9v27h-9z M25 29h19v4H25 M31 33h7v10h-7',
      burst: 'M24 12h27l6 9-4 15H22l-4-15z M32 5h12v7H32',
      flash: 'M28 10h20v29H28z M33 4h10v6H33 M29 18h18v4H29',
      smoke: 'M25 13h25v24H25z M29 5h17v8H29 M25 19h25v5H25',
      kit: 'M18 14h41v22H18z M28 8h21v6H28 M35 18h7v14h-7 M31 22h15v6H31',
      vest: 'M22 5h10l5 8 5-8h10l5 31H17z',
      helmet: 'M18 21a19 19 0 0 1 38 0v9H18z M20 30h34v7H20',
      device: 'M13 12h48v24H13z M20 17h20v10H20 M45 18h8v4h-8 M45 26h8v4h-8'
    };
    return '<svg viewBox="0 0 80 44" aria-hidden="true"><path d="' + (paths[type] || paths.rifle) + '" fill="currentColor"/></svg>';
  }
  K.weaponIcon = icon;
  class UI {
    constructor(app) { this.app = app; this.category = 1; this.shopIds = []; this.bannerUntil = 0; this.notice = ''; this.noticeUntil = 0; this.nextDraw = 0; this.heard = []; }
    reset() { this.category=1;this.shopIds=[];this.bannerUntil=-1;this.notice='';this.noticeUntil=0;this.nextDraw=0;this.heard=[];this.lastAlive=5;this.warnedRound=0;$('error').hidden=true;$('error').textContent='';
      for(const id of ['context','killlog','radio','result-body','round-history','buy-message'])$(id).textContent='';
      for(const id of ['banner','hitmarker','scope','scoreboard','map-overlay'])$(id).hidden=true;
      for(const id of ['hurt','damage-vignette','flash','smoke-overlay'])$(id).style.opacity=0;
    }
    screens(mode) {
      for (const id of ['title', 'howto', 'shop', 'pause', 'result']) $(id).hidden = id !== mode;
      $('back').hidden = !['title', 'howto', 'pause', 'result'].includes(mode);
      $('hud').hidden = ['title', 'howto', 'result'].includes(mode);
      if (mode !== 'play') { $('scoreboard').hidden = true; $('map-overlay').hidden = true; }
      $('flash').style.opacity = 0; $('smoke-overlay').style.opacity = 0; if (mode !== 'play') $('debug').hidden = true;
    }
    notify(text, time) { this.notice = text; this.noticeUntil = (this.app.match ? this.app.match.time : 0) + (time || 3); }
    event(e) {
      if (e.type === 'round') {
        this.noticeUntil = 0; this.nextDraw = 0; this.heard = [];this.lastAlive=5;
        this.bannerUntil = e.time + 4;
        $('banner').querySelector('h2').textContent = e.half ? '攻守を交替' : e.overtime ? '延長・この１本で決着' : '第 ' + e.number + ' ラウンド';
        $('banner').querySelector('p').textContent = e.half ? '装備と資金をリセット。新しい役割で進もう。' : e.overtime ? '資金５０００。仲間と最後まで。' : '１２秒で準備しよう。B で装備を購入。';
      }
      if (e.type === 'devicePass' || e.type === 'deviceDrop') { if (e.actor === 0 || e.target === 0) this.notify(e.type === 'devicePass' ? e.target === 0 ? '装置を受け取りました。A か B へ向かおう。' : '装置を仲間に渡しました。' : '装置を置きました。仲間が回収できます。'); }
      if(e.type==='kill'&&e.actor===0&&!this.app.watch)this.notify((e.part==='head'?'頭部に命中 ・ ':'')+this.app.match.players[e.target].name+' を停止',2);
      if (e.type === 'plant') this.notify('装置が設置された。残り４０秒。', 4);
      if (e.type === 'roundEnd') {
        this.bannerUntil = e.time + 4.5;
        $('banner').querySelector('h2').textContent = K.sideName(e.side) + ' の勝ち';
        $('banner').querySelector('p').textContent = ({ '全滅': '相手チームが全機停止', '解除': '訓練用の装置を解除した', '起爆': '訓練用の装置が作動した', '時間切れ': '時間内の設置を防いだ' })[e.reason] || e.reason || 'ラウンド終了';
        const star = this.app.match && this.app.match.players.find(p => p.id === e.mvp);
        if (star) $('banner').querySelector('p').textContent += ' ／ 最優秀隊員 ' + star.name;
      }
    }
    shop() {
      const m = this.app.match, p = m.players[0];
      const all = this.category === 0 ? Object.keys(K.weapons).filter(id => K.weapons[id].slot === 2 && K.weapons[id].price) : this.category === 1 ? Object.keys(K.weapons).filter(id => K.weapons[id].slot === 1) : Object.keys(K.items);
      this.shopIds = all.filter(id => !(K.weapons[id] || K.items[id]).side || (K.weapons[id] || K.items[id]).side === p.side);
      $('shop-money').textContent = p.money.toLocaleString() + ' 円';
      $('shop-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.category) === this.category));
      $('shop-items').replaceChildren();
      this.shopIds.forEach((id, index) => {
        const w = K.weapons[id] || K.items[id], b = document.createElement('button');
        let detail = '';
        if (K.weapons[id]) detail = '威力 ' + w.damage + (w.pellets > 1 ? ' × ' + w.pellets : '') + ' ・ ' + w.mag + ' 発<br>こめ直し ' + w.reload + ' 秒 ・ 撃破報酬 ' + w.reward + (w.role ? '<br>' + escape(w.role) : '');
        else detail = ({ vest: '胴へのダメージを軽減。防具１００。', helmet: '頭も守れる装備。防具１００。', kit: '解除が７秒から４秒になります。', burst: '近くの相手にダメージ。壁で遮られます。', flash: '見ていた相手の視界を短く奪います。', smoke: '約１７秒、視線を遮る煙を出します。' })[id];
        const grenadeFull = Object.values(p.grenades).reduce((a, b) => a + b, 0) >= 4 && Object.prototype.hasOwnProperty.call(p.grenades, id);
        const owned = !!p.gear[id] || id === 'kit' && p.kit || id === 'vest' && p.armor === 100 || id === 'helmet' && p.armor === 100 && p.helmet || p.grenades[id] >= (id === 'flash' ? 2 : 1);
        const bars = K.weapons[id] ? '<div class="performance"><span>威力</span><i><em style="width:' + Math.min(100, w.damage / 110 * 100) + '%"></em></i><span>連射</span><i><em style="width:' + Math.min(100, .075 / w.interval * 100) + '%"></em></i><span>精度</span><i><em style="width:' + Math.max(8, 100 - w.spread * 1300) + '%"></em></i><span>機動</span><i><em style="width:' + Math.min(100, w.speed / 1.08 * 100) + '%"></em></i></div>' : '';
        b.innerHTML = '<span class="price">' + w.price.toLocaleString() + '</span><kbd>' + (index + 1) + '</kbd> ' + escape(w.name) + '<span class="shop-icon">' + icon(id) + '</span><small>' + detail + (owned ? '<br>装備済み' : grenadeFull ? '<br>投げ物は４個まで' : '') + '</small>' + bars;
        b.disabled = owned || grenadeFull || p.money < w.price || m.phase !== 'buy'; b.onclick = () => this.buy(index); $('shop-items').appendChild(b);
      });
      $('team-wallets').innerHTML = '<span>味方の所持金</span>' + m.players.filter(a => a.team === p.team).map(a => '<span>' + escape(a.name) + '<b>' + a.money.toLocaleString() + '</b></span>').join('');
    }
    buy(index) { const id = this.shopIds[index]; if (!id) return; const m = this.app.match; const ok = K.combat.buy(m, m.players[0], id); if (ok && K.weapons[id]) { this.app.previousSlot = this.app.slot; this.app.slot = K.weapons[id].slot; } $('buy-message').textContent = ok ? (K.weapons[id] || K.items[id]).name + ' を購入しました。' : '今は購入できません。所持金と残り時間を確認してください。'; this.app.audio.ui(!ok); this.shop(); }
    radar(canvas, m, p, big) {
      const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, b = K.presentation.bounds();
      const mapW = b.maxX - b.minX, mapH = b.maxZ - b.minZ, scale = big ? Math.min((w - 70) / mapW, (h - 100) / mapH) : w / 48;
      const centerX = big ? (b.minX + b.maxX) / 2 : p.x, centerZ = big ? (b.minZ + b.maxZ) / 2 : p.z, angle = big ? 0 : -p.yaw, cos = Math.cos(angle), sin = Math.sin(angle);
      const pos = a => { const x = (a.x - centerX) * scale, y = (a.z - centerZ) * scale; return [w / 2 + x * cos - y * sin, h / 2 + x * sin + y * cos]; };
      const polygon = (x, z, width, depth) => { const pts = [[x - width / 2, z - depth / 2], [x + width / 2, z - depth / 2], [x + width / 2, z + depth / 2], [x - width / 2, z + depth / 2]]; ctx.beginPath(); pts.forEach((a, i) => { const pt = pos({ x: a[0], z: a[1] }); if (!i) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); }); ctx.closePath(); };
      ctx.clearRect(0, 0, w, h); ctx.save();
      if (!big) { ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); ctx.clip(); }
      ctx.fillStyle = '#0c202a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8bb5c315'; ctx.lineWidth = 1;
      for (let x = b.minX; x < b.maxX; x += 4) { const a = pos({x, z:b.minZ}), c = pos({x, z:b.maxZ}); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke(); }
      for (let z = b.minZ; z < b.maxZ; z += 4) { const a = pos({x:b.minX,z}), c = pos({x:b.maxX,z}); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke(); }
      for (const box of K.map.boxes) { if (box.radar === false) continue; ctx.fillStyle = box.thin || box.kind === 'wood' ? '#8a7b62' : box.h < 1 ? '#344a52' : '#4b6069'; polygon(box.x, box.z, box.w, box.d); ctx.fill(); ctx.strokeStyle = '#90abb330'; ctx.stroke(); }
      for (const s of K.map.sites) { const pt = pos(s); ctx.fillStyle = s.id === 'A' ? '#efb66c28' : '#86dacc28'; polygon(s.x, s.z, s.r * 2, s.r * 2); ctx.fill(); ctx.strokeStyle = s.id === 'A' ? '#efb66c' : '#86dacc'; ctx.stroke(); ctx.font = 'bold ' + (big ? 25 : 22) + 'px sans-serif'; ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = 'center'; ctx.fillText(s.id, pt[0], pt[1] + 8); }
      for (const smoke of m.smokes || []) { const [x, y] = pos(smoke); ctx.beginPath(); ctx.arc(x, y, smoke.r * scale, 0, Math.PI * 2); ctx.fillStyle = '#c3d7da33'; ctx.fill(); }
      // 銃声は聞こえた地点のみ短く表示。現在位置や未視認の移動は追跡しない。
      for (const n of m.noises || []) if (n.kind === 'shot' && n.team !== p.team && m.time - n.time < 1.1 && K.dist(n, p) < (n.radius || 35)) {
        const [x,y] = pos(n); ctx.beginPath(); ctx.arc(x,y,6 + (m.time - n.time) * 7,0,Math.PI * 2); ctx.strokeStyle = '#ffad75'; ctx.lineWidth = 2; ctx.stroke();
      }
      for (const enemy of Object.values(m.spotted && m.spotted[p.team] || {})) if (m.time - enemy.time < 2) { const [x,y] = pos(enemy); ctx.globalAlpha = Math.max(.2, 1 - (m.time - enemy.time) / 2); ctx.fillStyle = '#ff8174'; ctx.fillRect(x - 4, y - 4, 8, 8); } ctx.globalAlpha = 1;
      for (const a of m.players) if (a.alive && a.team === p.team) {
        const [x,y] = pos(a); ctx.save(); ctx.translate(x,y); ctx.rotate(a.yaw + angle); ctx.fillStyle = a.id === p.id ? '#ffffff' : a.side === 'attack' ? '#efb66c' : '#80d5ed'; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(5,5); ctx.lineTo(0,2); ctx.lineTo(-5,5); ctx.closePath(); ctx.fill(); ctx.restore();
        if (big) { ctx.textAlign = 'center'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#dae7e9'; ctx.fillText(a.name, x, y + 20); }
      }
      const d = m.device, carrier = m.players.find(a => a.id === d.carrier), known = d.planted || p.side === 'attack' || !carrier || carrier.team === p.team;
      if (known) { const [x,y] = pos(carrier || d); ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#ffe7a4'; ctx.fillStyle = d.planted && Math.sin(m.time * 9) > 0 ? '#ffcc72' : '#142b3b'; ctx.lineWidth = 2; ctx.fillRect(-5,-5,10,10); ctx.strokeRect(-5,-5,10,10); ctx.restore(); }
      if (big) { ctx.fillStyle = '#d6e3e8'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(K.map.name || '訓練場', 24, 30); ctx.font = '13px sans-serif'; ctx.fillStyle = '#9bb9c9'; ctx.fillText('▲ 味方　■ 視認　○ 銃声　◇ 装置　／ M を離して閉じる', 24, h - 22); }
      else { ctx.strokeStyle = '#b1cbd329'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .28, 0, Math.PI * 2); ctx.stroke(); ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#bacdd3'; const nx = -Math.sin(p.yaw) * (w / 2 - 19), ny = -Math.cos(p.yaw) * (w / 2 - 19); ctx.fillText('北', w / 2 + nx, h / 2 + ny + 6); }
      ctx.restore();
    }
    scoreboard(m) {
      const own = m.players[0].team;
      $('score-body').innerHTML = m.players.map(p => '<tr class="' + (p.team === own ? 'ally' : 'foe') + (p.alive ? '' : ' dead') + '"><td>' + escape(p.name) + ' / ' + K.sideName(p.side) + '</td><td>' + p.kills + '</td><td>' + p.deaths + '</td><td>' + (p.team === own ? p.money.toLocaleString() : '―') + '</td><td>' + (m.device.carrier === p.id && p.team === own ? '所持' : p.kit ? (p.team === own ? 'キット' : '―') : '―') + '</td></tr>').join('');
    }
    result(m) {
      const p = m.players[0], winner = m.result.winner, mvp = m.players.find(a => a.id === m.mvp) || m.players.slice().sort((a, b) => (b.kills * 2 + b.defuses * 3 + b.plants * 2) - (a.kills * 2 + a.defuses * 3 + a.plants * 2))[0];
      $('result-title').textContent = winner === p.team ? 'あなたのチームの勝ち' : '次の訓練で、もう一度。';
      $('final-score').textContent = m.scores[0] + ' : ' + m.scores[1];
      $('result-summary').textContent = p.name + '　撃破 ' + p.kills + ' / 被撃破 ' + p.deaths + ' / 設置 ' + p.plants + ' / 解除 ' + p.defuses + (p.assists != null ? ' / 援護 ' + p.assists + ' / 頭部撃破 ' + (p.headshots || 0) : '');
      $('round-history').innerHTML = (m.history || []).map((r, i) => '<span class="' + (r.winner === p.team ? '' : 'lost') + '" title="' + escape(r.reason) + '">' + (i + 1) + '</span>').join('');
      $('result-body').innerHTML = m.players.slice().sort((a, b) => a.team - b.team || b.kills - a.kills).map(a => '<tr class="' + (a.team === p.team ? 'ally' : 'foe') + '"><td>' + escape(a.name) + '</td><td>' + a.kills + '</td><td>' + a.deaths + '</td><td>' + a.plants + '</td><td>' + a.defuses + '</td></tr>').join('');
      $('mvp').textContent = '最優秀隊員　' + mvp.name + '　（撃破 ' + mvp.kills + '・設置 ' + mvp.plants + '・解除 ' + mvp.defuses + '）';
    }
    update(m, p, now) {
      const app = this.app, own = m.players[0], alive = side => m.players.filter(a => a.alive && a.side === side).length;
      const survivors=m.players.filter(a=>a.alive&&a.team===own.team).length;
      if(m.phase==='live'&&survivors===1&&this.lastAlive>1&&own.alive&&!app.watch)this.notify('最後の１体です。落ち着いて、目的を優先しよう。',4);
      this.lastAlive=survivors;
      if(m.phase==='live'&&!m.device.planted&&m.phaseTime<=10&&this.warnedRound!==m.round){this.warnedRound=m.round;this.notify('残り１０秒。'+(own.side==='attack'?'設置を急ごう。':'設置を防ごう。'),3);app.audio.ui(true);}
      $('flash').style.opacity = app.mode === 'play' ? K.clamp(p.flash / 2, 0, .97) : 0;
      $('smoke-overlay').style.opacity = app.mode === 'play' ? app.view.fx.insideSmoke * .93 : 0;
      $('crosshair').dataset.shape = (app.settings || {}).crosshair || 'cross';
      $('crosshair').style.setProperty('--cross-color', (app.settings || {}).color || '#c4ffdf');
      $('scope-range').textContent = p.scope === 2 ? '４ 倍' : '２ 倍';
      $('crosshair').style.setProperty('--gap', (5 + (p.moving ? 8 : 0) + p.recoil * 80 + (p.grounded ? 0 : 16)) + 'px');
      $('crosshair').hidden = !!p.scope || !p.alive || (!app.watch && own.alive && app.slot === 5); $('scope').hidden = !p.scope || !p.alive; $('hitmarker').hidden = app.view.hitUntil < m.time; $('hitmarker').classList.toggle('head', !!app.view.hitHead);
      const hurt = Math.max(0, 1 - (m.time - p.hurtAt) / .65); $('hurt').style.opacity = hurt; $('damage-vignette').style.opacity = Math.max(hurt * .85, p.hp < 25 && p.alive ? .14 : 0);
      if (hurt && p.hurtFrom) $('hurt').style.transform = 'rotate(' + K.angle(Math.atan2(p.hurtFrom.x - p.x, -(p.hurtFrom.z - p.z)) - p.yaw) + 'rad)';
      $('banner').hidden = m.time > this.bannerUntil;
      if (now < this.nextDraw) return; this.nextDraw = now + .08;
      const defenseTeam = m.players.find(a => a.side === 'defend').team, attackTeam = 1 - defenseTeam;
      $('left-team').innerHTML = '<span>解除班</span><b>' + m.scores[defenseTeam] + '</b><small>稼働 ' + alive('defend') + ' / 5</small>';
      $('right-team').innerHTML = '<span>設置班</span><b>' + m.scores[attackTeam] + '</b><small>稼働 ' + alive('attack') + ' / 5</small>';
      $('clock').innerHTML = '<strong>' + seconds(m.device.planted && m.phase === 'live' ? m.device.time : m.phaseTime) + '</strong><small>' + (m.phase === 'buy' ? '購入時間' : m.device.planted ? '装置作動まで' : m.phase === 'result' ? '次の訓練へ' : '第 ' + m.round + ' ラウンド') + '</small>';
      $('clock').classList.toggle('urgent', m.device.planted || m.phaseTime < 15);
      const carrier = m.players.find(a => a.id === m.device.carrier);
      $('device-status').textContent = m.device.planted ? '◇ ' + (m.device.site || '') + ' 装置作動中' : carrier && carrier.team === p.team ? '◇ 装置：' + carrier.name + (carrier.id === own.id ? '（あなた・5→Gで渡す）' : '') : m.device.carrier == null ? '◇ 装置が落ちています' : '◇ 相手が装置を所持';
      $('location').textContent = K.map.location(p); $('hp').textContent = Math.ceil(p.hp); $('armor').textContent = Math.ceil(p.armor) + (p.helmet ? ' ◇' : ''); $('healthbar').style.width = p.hp * .75 + 'px'; $('money').textContent = own.money.toLocaleString();
      const w = K.weapons[p.weapon] || { name: '訓練装備', slot: 2 }, gear = p.gear[p.weapon] || { ammo: 0, reserve: 0 }, extraSlot = !app.watch && own.alive ? app.slot : w.slot;
      $('weapon-icon').innerHTML = icon(extraSlot === 4 ? p.selectedGrenade : extraSlot === 5 ? 'device' : p.weapon);
      $('weapon-name').textContent = extraSlot === 4 ? (K.items[p.selectedGrenade] || { name: '投げ物' }).name : extraSlot === 5 ? '訓練用の装置' : w.name + (p.reloadEnd ? ' / こめ直し中' : '');
      $('ammo').textContent = extraSlot === 4 ? p.grenades[p.selectedGrenade] : extraSlot === 5 ? (m.device.carrier === p.id && p.team === own ? '所持' : '―') : p.weapon === 'baton' ? '―' : gear.ammo;
      $('reserve').textContent = extraSlot > 3 || p.weapon === 'baton' ? '' : '/ ' + gear.reserve;
      $('slots').textContent = extraSlot === 4 ? (p.grenadePrimed?'構え中 ・ 左クリックを離して投げる':'4 種類変更 ・ 左クリック長押しで構える') : '1 主武器　2 拳銃　3 近接　4 投げ物　5 装置';
      $('killlog').innerHTML = (m.killLog || []).filter(e => m.time - e.time < 8).map(e => { const killer = m.players.find(p => p.id === e.actor), target = m.players.find(p => p.id === e.target); return '<div class="' + (e.actor === own.id ? 'mine' : '') + '"><span>' + escape(killer && killer.name || '訓練装置') + '</span><span class="weapon-glyph" title="' + escape((K.weapons[e.weapon] || K.items[e.weapon] || {}).name || '装置') + '">' + icon(e.weapon) + '</span><span>' + escape(target && target.name || '隊員') + '</span>' + (e.part === 'head' ? '<b class="headshot" title="頭部命中">◇</b>' : '') + '</div>'; }).join('');
      $('radio').innerHTML = (m.radioLog || []).filter(e => e.team === own.team && m.time - e.time < 9).slice(-3).map(e => '<div><b>' + escape(e.name) + '</b>　' + escape(e.message) + '</div>').join('');
      let context = '', progress = 0;
      if (m.phase === 'buy') context = '開始地点で準備中　B で装備を購入';
      else if (m.device.carrier === own.id && !m.device.planted) context = K.map.siteAt(own) ? '止まって E 長押しで装置を設置' : '装置を持っています。A か B へ向かおう';
      else if (m.device.planted && own.side === 'defend') context = K.dist(own, m.device) < 2.2 ? '装置を見て、止まって E 長押しで解除' + (own.kit ? '（キット：４秒）' : '（７秒）') : m.device.site + ' に設置された。装置を解除しよう';
      else if (m.device.carrier === null && !m.device.planted && own.side === 'attack') context = '装置が落ちています。レーダーの ◇ へ';
      else if (m.drops.some(g => K.dist(g, own) < 1.5)) context = 'E で落ちている武器を拾う';
      if (!own.alive) context = '次のラウンドで復帰します。クリックで味方の視点を切り替え。';
      const actor = app.watch || !own.alive ? p : own;
      if (actor.interact > 0) { const duration = actor.side === 'attack' ? K.rules.plant : actor.kit ? K.rules.kit : K.rules.defuse; progress = actor.interact / duration; context = (actor.side === 'attack' ? '設置' : '解除') + 'しています… ' + Math.max(0, duration - actor.interact).toFixed(1) + ' 秒' + (actor === own && !app.watch ? ' ／ E を押したまま' : ''); }
      if (this.noticeUntil > m.time) context = this.notice;
      $('context').innerHTML = escape(context) + (progress ? '<div id="interaction"><i style="width:' + K.clamp(progress * 100, 0, 100) + '%"></i></div>' : '');
      $('watch-note').textContent = app.watch || !own.alive ? '観戦：' + (app.watched===-1?'装置を見守る':p.name) + ' / クリックで切替' + (app.watch ? ' / 音はクリックで開始' : '') : (own.kit ? '解除キットあり　' : '') + 'Tab 戦績　M 地図　Esc 休憩';
      this.radar($('radar'), m, p, false);
      if (!$('map-overlay').hidden) this.radar($('large-map'), m, p, true);
      if (!$('scoreboard').hidden) this.scoreboard(m);
      if (app.mode === 'shop') { $('team-wallets').innerHTML = '<span>味方の所持金</span>' + m.players.filter(a => a.team === own.team).map(a => '<span>' + escape(a.name) + '<b>' + a.money.toLocaleString() + '</b></span>').join(''); $('shop-time').textContent = m.phase === 'buy' ? '購入の残り ' + Math.ceil(m.phaseTime) + ' 秒' : '購入時間は終了しました。訓練にもどろう。'; }
      if (app.debug) { $('debug').hidden = !!app.hideDebug || app.mode !== 'play' || !$('scoreboard').hidden || !$('map-overlay').hidden;  $('debug').textContent = Math.round(app.fps) + ' フレーム/秒\n描画 ' + app.view.frameCalls + ' 回　F3 表示切替'+(app.noLock?'\nロックなし検証':'')+'\n' + m.players.map(a => a.name + ': ' + (a.alive ? a.state : '停止')).join('\n'); }
    }
  }
  K.UI = UI; K.$ = $;
})(window.KJ);
