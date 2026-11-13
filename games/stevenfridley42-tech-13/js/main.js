'use strict';
// ===== アプリ本体（ゲームループ・モード管理） =====
const App = {
  settings: { qlen: 5, diff: 1, assist: true, pen: 1, vol: 0.7, pace: 0.85, autoSwitch: true, showRules: true },
  DEFAULTS: { qlen: 5, diff: 1, assist: true, pen: 1, vol: 0.7, pace: 0.85, autoSwitch: true, showRules: true },
  mode: null, game: null, gv: null, localIdx: 0, guestCfg: null, guestTeams: null, paused: false, last: 0, acc: 0, sendT: 0,
  lastMatch: null, finalShown: false, prevPh: null,

  init() {
    Render.init(document.getElementById('game')); Input.init(); UI.init(); HUD.init(); Drawer.init();
    Input.onKey(c => this.globalKey(c));
    MenuUI.login();
    requestAnimationFrame(t => this.frame(t));
  },
  settingsKey() { return Account.cur && !Account.cur.guest ? Account.prefix() + '_settings' : 'gridiron26'; },
  loadSettings() {
    this.settings = Object.assign({}, this.DEFAULTS);
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(this.settingsKey()) || '{}')); } catch (e) {}
    SFX.setVol(this.settings.vol);
  },
  afterLogin() {
    this.loadSettings(); SFX.init(); SFX.select();
    document.getElementById('userBadge').textContent = Account.cur ? '👤 ' + Account.cur.name + (Account.cur.guest ? '（ゲスト）' : '') : '';
    UI.title();
  },
  saveSettings() {
    try { localStorage.setItem(this.settingsKey(), JSON.stringify(this.settings)); } catch (e) {}
    SFX.setVol(this.settings.vol);
    if (this.game) for (const k of ['assist', 'pen', 'pace', 'autoSwitch']) this.game.settings[k] = this.settings[k];
  },
  // 試合前のルールブック
  gate(fn) {
    if (this.settings.showRules === false) return fn();
    UI.show(MenuUI.rulebookNode(null, () => fn()));
  },
  // ☰メニュー
  menu() {
    const inGame = !!this.mode && !this.finalShown && (!!this.game || this.mode === 'guest');
    if (inGame && this.mode === 'local') this.paused = true;
    PlayCall.hide(); PlayCall.seq = -1;
    const items = [];
    const sub = (node) => Drawer.show(node);
    items.push(inGame ? { icon: '▶', l: '試合に戻る', primary: true, f: () => Drawer.close() } : null);
    items.push({ icon: '⚙', l: '設定', sub: '試合スピード・アシスト・オート切替・音量など', f: () => sub(MenuUI.settingsNode(() => this.menu())) });
    items.push({ icon: '📖', l: 'ルールブック・操作方法', f: () => sub(MenuUI.rulebookNode(() => this.menu())) });
    if (inGame) {
      if (this.canTimeout()) items.push({ icon: '⏱', l: 'タイムアウトを取る', f: () => { this.timeout(); Drawer.close(); } });
      items.push({ sep: '試合をやめる' });
      if (this.careerG) {
        items.push({ icon: '⏩', l: '中断して残りをシミュレート', sub: '試合結果はシミュレーションで決まります', f: () => { Drawer.close(); this.endCareerGame('sim'); } });
        items.push({ icon: '🏳', l: '棄権する', sub: '0-2の不戦敗（NFLの没収試合）', danger: true, f: () => { if (confirm('この試合を棄権しますか？（0-2で敗戦）')) { Drawer.close(); this.endCareerGame('forfeit'); } } });
      } else if (this.online()) items.push({ icon: '🚪', l: '対戦から退出', sub: '相手との接続を切ります', danger: true, f: () => { if (confirm('対戦から退出しますか？')) { Drawer.close(); this.quit(); } } });
      else items.push({ icon: '🚪', l: '試合をやめてタイトルへ', sub: 'この試合の結果は残りません', danger: true, f: () => { if (confirm('試合をやめますか？')) { Drawer.close(); this.quit(); } } });
    } else {
      if (Account.cur) {
        items.push({ sep: 'アカウント：' + Account.cur.name + (Account.cur.guest ? '（ゲスト）' : '') });
        items.push({ icon: '💾', l: 'セーブデータを書き出す', sub: 'ファイルに保存（別のPCへの引っ越し用）', f: () => Account.exportData() });
        items.push({ icon: '📂', l: 'セーブデータを読み込む', f: () => { const i = U.el('input', { type: 'file', accept: '.json' }); i.onchange = () => i.files[0] && Account.importData(i.files[0], e => { alert(e || '読み込みました'); if (!e) { this.loadSettings(); Drawer.close(); UI.title(); } }); i.click(); } });
        items.push({ icon: '↩', l: 'ログアウト', f: () => { Drawer.close(); if (this.mode) this.quit(); Account.logout(); App.career = false; document.getElementById('userBadge').textContent = ''; MenuUI.login(); } });
      }
      items.push({ icon: '🏠', l: 'タイトルへ', f: () => { Drawer.close(); App.career = false; if (Account.cur) UI.title(); else MenuUI.login(); } });
    }
    Drawer.show(MenuUI.build(items, inGame ? 'PAUSE' : 'MENU'), () => { this.paused = false; });
  },
  teams() { return this.mode === 'guest' ? this.guestTeams : this.game ? this.game.teams : [TEAMS[0], TEAMS[1]]; },
  online() { return this.mode === 'host' || this.mode === 'guest'; },
  localCtrl() { return this.mode === 'guest' ? this.guestCfg : this.game ? this.game.ctrls[this.localIdx] : null; },

  // ---------- CPU戦 ----------
  setupExhibition(kind) {
    UI.teamPicker({ title: kind === 'team' ? 'チームを選択' : 'あなたのチームと対戦相手', pickCount: 2, labels: ['あなたのチーム（ホーム）', '対戦相手（CPU）'], initial: this.lastMatch ? [this.lastMatch.my, this.lastMatch.opp] : ['KC', 'PHI'],
      onBack: () => UI.title(),
      onDone: ([my, opp]) => {
        if (my === opp) { alert('別のチームを選んでください'); return; }
        if (kind === 'player') UI.playerPicker(my, key => this.startLocal(my, opp, kind, key), () => this.setupExhibition(kind));
        else this.startLocal(my, opp, kind, null);
      } });
  },
  startLocal(my, opp, kind, key) {
    this.lastMatch = { my, opp, kind, key };
    if (!this._gated) { return this.gate(() => { this._gated = true; this.startLocal(my, opp, kind, key); this._gated = false; }); }
    this.mode = 'local'; this.localIdx = 0;
    this.game = new Game({ home: my, away: opp, settings: this.settings, humanSide: 0, ctrls: [{ side: 0, kind, key, source: 'local' }] });
    this.begin();
  },
  // ---------- キャリアの試合 ----------
  startCareerGame(car, g) {
    if (!this._gated) { return this.gate(() => { this._gated = true; this.startCareerGame(car, g); this._gated = false; }); }
    const side = g.h === car.team ? 0 : 1, me = Career.me(car, true);
    this.mode = 'local'; this.localIdx = 0; this.careerG = g;
    this.game = new Game({ teamObjs: [Career.team(car, g.h, true), Career.team(car, g.a, true)], settings: this.settings, humanSide: side,
      ctrls: [{ side, kind: 'player', key: me.key, source: 'local' }] });
    this.begin();
  },
  endCareerGame(mode) {
    const played = mode === true || mode === 'played';
    const g = this.careerG, game = this.game, car = Career.car;
    this.careerG = null; this.mode = null; this.game = null; PlayCall.hide(); HUD.show(false); SFX.crowdLevel(0);
    const res = played ? Career.importPlayed(car, game, g) : mode === 'forfeit' ? Career.forfeit(car) : Career.simMine(car);
    CUI.afterGame(res);
  },
  begin() {
    UI.clear(); HUD.show(true); this.paused = false; this.finalShown = false; this.prevPh = null;
    Render.smooth = this.mode === 'guest'; Render.disp = []; Render.dispBall = null;
    SFX.init(); SFX.crowdLevel(0.35);
  },
  quit() {
    if (this.careerG) return this.endCareerGame('sim');
    if (this.mode === 'host' || this.mode === 'guest') Net.close();
    this.mode = null; this.game = null; this.gv = null; PlayCall.hide(); HUD.show(false); SFX.crowdLevel(0); UI.title();
  },

  // ---------- オンライン（ホスト） ----------
  hostOnline(kind, teamId, key) {
    UI.onlineWait('');
    Net.on('open', () => {});
    Net.on('hello', () => Net.send({ t: 'lobby', kind, hostTeam: teamId, settings: this.settings }));
    Net.on('pick', d => {
      if (d.team === teamId || !TEAM_BY_ID[d.team]) return;
      this.mode = 'host'; this.localIdx = 0;
      this.game = new Game({ home: teamId, away: d.team, settings: this.settings, online: true,
        ctrls: [{ side: 0, kind, key, source: 'local' }, { side: 1, kind, key: d.key, source: 'remote' }] });
      Net.send({ t: 'start', home: teamId, away: d.team, cfg: { side: 1, kind, key: d.key, idx: 1 } });
      this.begin();
    });
    Net.on('in', d => {
      const c = this.game && this.game.ctrls[1]; if (!c) return;
      c.inp.ax = d.ax; c.inp.ay = d.ay; c.inp.sprint = d.sp; c.inp.held = d.h || {};
      c.inp.mAct = d.ma; c.inp.mx = d.mx; c.inp.my = d.my; c.inp.wheel = (c.inp.wheel || 0) + (d.wh || 0);
      (d.pr || []).forEach(k => c.inp.pressed.add(k));
    });
    Net.on('call', d => this.game && this.game.submitCall(1, d.id, d.opts || {}));
    Net.on('to', () => this.game && this.game.callTimeout(1));
    Net.on('close', () => { if (this.mode === 'host') UI.message('切断', '相手との接続が切れました', 'タイトルへ', () => this.quit()); });
    Net.host(code => UI.onlineWait(code));
  },
  // ---------- オンライン（ゲスト） ----------
  joinOnline(code) {
    Net.on('lobby', d => {
      const host = TEAM_BY_ID[d.hostTeam];
      UI.teamPicker({ title: `あなたのチームを選択（相手: ${host.name}）`, pickCount: 1, labels: ['アウェイ'], onBack: () => { Net.close(); UI.online(); },
        onDone: ([tid]) => {
          if (tid === d.hostTeam) { alert('相手と別のチームを選んでください'); return; }
          const send = key => { Net.send({ t: 'pick', team: tid, key }); UI.message('準備完了', 'ホストの開始を待っています…', 'キャンセル', () => this.quit()); };
          if (d.kind === 'player') UI.playerPicker(tid, send, () => { Net.close(); UI.online(); }); else send(null);
        } });
    });
    Net.on('start', d => {
      this.mode = 'guest'; this.guestTeams = [TEAM_BY_ID[d.home], TEAM_BY_ID[d.away]];
      this.guestCfg = d.cfg; this.localIdx = d.cfg.idx; this.gv = null; this.begin();
    });
    Net.on('v', d => { this.gv = d.v; });
    Net.on('ev', d => d.list.forEach(e => this.handleEvent(e)));
    Net.on('final', d => { this.guestStats = d.stats; });
    Net.on('close', () => { if (this.mode === 'guest') UI.message('切断', 'ホストとの接続が切れました', 'タイトルへ', () => this.quit()); });
    Net.join(code, () => Net.send({ t: 'hello' }));
  },

  // ---------- イベント ----------
  handleEvent(e) {
    if (e.t === 'banner') {
      HUD.banner(e.text, e.sub, e.dur);
      if (/TOUCHDOWN|SAFETY|INTERCEPTION|BLOCKED|FIELD GOAL|FINAL/.test(e.text)) Render.excite = 1;
      else if (/FIRST DOWN|SACK|TURNOVER|GOOD/.test(e.text)) Render.excite = Math.max(Render.excite, 0.75);
    }
    if (e.t === 'final') setTimeout(() => this.showFinal(), 3800);
  },
  showFinal() {
    if (this.finalShown || !this.mode) return; this.finalShown = true;
    if (this.careerG) return this.endCareerGame('played');
    const gv = this.mode === 'guest' ? this.gv : this.game.view(), stats = this.mode === 'guest' ? (this.guestStats || {}) : this.game.stats;
    PlayCall.hide();
    GameMenus.result(gv, stats, [], () => {
      if (this.mode === 'local') { const m = this.lastMatch; this.startLocal(m.my, m.opp, m.kind, m.key); } else this.quit();
    }, () => this.quit());
  },
  globalKey(c) {
    if (!this.mode) return;
    if (c === 'Escape' && !this.finalShown && !Drawer.isOpen()) { this.menu(); return; }
    if (c === 'KeyT') { const gv = this.currentView(); if (gv && gv.ph === 'pre') this.timeout(); }
  },
  canTimeout() { const g = this.game; return g && (g.phase === 'call' || g.phase === 'pre') && g.ctx && g.ctx.type === 'scrim' && g.timeouts[this.localCtrl().side] > 0; },
  timeout() {
    if (this.mode === 'guest') Net.send({ t: 'to' });
    else if (this.game) { const side = this.localCtrl().side; if (this.game.phase === 'pre') { this.game.sim.state = 'pre'; } if (this.game.callTimeout(side) && this.game.phase === 'pre') this.game.startCall('scrim'); }
  },
  currentView() { return this.mode === 'guest' ? this.gv : this.game ? this.lastView : null; },

  // ---------- ループ ----------
  frame(ts) {
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000); this.last = ts;
    try { this.tick(dt); } catch (e) { console.error(e); }
    requestAnimationFrame(t => this.frame(t));
  },
  tick(dt) {
    const local = new Set([this.localIdx]);
    if (this.mode === 'local' || this.mode === 'host') {
      const g = this.game;
      if (!this.paused) {
        const inp = Input.snapshot(), c = g.ctrls[this.localIdx];
        c.inp.ax = inp.ax; c.inp.ay = inp.ay; c.inp.sprint = inp.sprint; c.inp.held = inp.held; inp.pressed.forEach(k => c.inp.pressed.add(k));
        c.inp.mAct = inp.mAct; c.inp.mx = inp.mx; c.inp.my = inp.my; c.inp.wheel = (c.inp.wheel || 0) + inp.wheel;
        this.acc += dt; let n = 0;
        while (this.acc >= 1 / 60 && n < 4) {
          g.update(1 / 60); this.acc -= 1 / 60; n++;
          g.ctrls.forEach(c => { c.inp.pressed.clear(); c.inp.wheel = 0; });
        }
        if (n >= 4) this.acc = 0;
      } else Input.snapshot();
      const evs = g.events.splice(0);
      evs.forEach(e => this.handleEvent(e));
      const gv = g.view(); this.lastView = gv;
      if (this.mode === 'host') {
        this.sendT -= dt;
        if (this.sendT <= 0) { this.sendT = 1 / 20; Net.send({ t: 'v', v: gv }); }
        if (evs.length) Net.send({ t: 'ev', list: evs });
        if (evs.some(e => e.t === 'final')) Net.send({ t: 'final', stats: g.stats });
      }
      this.drawGame(gv, local, dt);
      if (!this.paused && !this.finalShown) PlayCall.update(gv, g.ctrls[this.localIdx], { call: (id, o) => g.submitCall(this.localCtrl().side, id, o), timeout: () => this.timeout() });
    } else if (this.mode === 'guest') {
      const inp = Input.snapshot();
      this.pend = this.pend || new Set(); inp.pressed.forEach(k => this.pend.add(k)); this.pendW = (this.pendW || 0) + inp.wheel;
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 1 / 30; Net.send({ t: 'in', ax: inp.ax, ay: inp.ay, sp: inp.sprint, h: inp.held, pr: [...this.pend], ma: inp.mAct, mx: inp.mx, my: inp.my, wh: this.pendW }); this.pend.clear(); this.pendW = 0; }
      const gv = this.gv;
      if (gv) {
        // ゲスト側の効果音
        if (this.prevPh !== gv.ph) { if (gv.ph === 'live') SFX.snap(); if (gv.ph === 'post' && this.prevPh === 'live') SFX.whistle(); this.prevPh = gv.ph; }
        this.drawGame(gv, local, dt);
        if (!this.finalShown) PlayCall.update(gv, this.guestCfg, { call: (id, o) => Net.send({ t: 'call', id, opts: o }), timeout: () => Net.send({ t: 'to' }) });
      } else Render.draw(null, this.teams(), local, dt);
    } else {
      document.getElementById('userBadge').style.display = ''; const bl = document.getElementById('backLink'); if (bl) bl.style.display = '';
      Render.draw(null, [TEAM_BY_ID.KC, TEAM_BY_ID.PHI], local, dt);
      Render.cam.x = 60 + Math.sin(performance.now() / 6000) * 30;
    }
  },
  drawGame(gv, local, dt) {
    document.getElementById('userBadge').style.display = 'none'; const bl = document.getElementById('backLink'); if (bl) bl.style.display = 'none';
    Render.draw(gv, this.teams(), local, dt);
    HUD.update(gv, local);
  },
};
addEventListener('load', () => App.init());
