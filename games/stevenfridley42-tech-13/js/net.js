'use strict';
// ===== オンライン対戦（PeerJS / WebRTC P2P） =====
// ホストが試合をシミュレートし、ゲストは入力を送って映像（状態）を受け取る
const Net = {
  peer: null, conn: null, role: null, code: '', handlers: {}, status: () => {},
  PREFIX: 'gridiron26-jp-', bc: null,
  // ?net=local で同じPCのタブ同士をつなぐ（動作確認用）
  local: new URLSearchParams(location.search).get('net') === 'local',
  ICE: { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } },
  available() { return this.local || typeof Peer !== 'undefined'; },
  localOpen(code) {
    this.bc = new BroadcastChannel('gridiron26-' + code); let opened = false;
    this.bc.onmessage = e => {
      const d = e.data; if (!d || d._from === this.role) return;
      if (!opened) { opened = true; this.handlers.open && this.handlers.open(); }
      const h = this.handlers[d.t]; if (h) h(d);
    };
  },
  on(type, f) { this.handlers[type] = f; },
  genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; },
  host(onReady) {
    this.close(); this.role = 'host'; this.code = this.genCode();
    if (this.local) { this.localOpen(this.code); this.status('（ローカル接続モード）コードを相手に伝えてください。'); onReady && onReady(this.code); return; }
    this.peer = new Peer(this.PREFIX + this.code, this.ICE);
    this.peer.on('open', () => { this.status('ルームを作成しました。コードを相手に伝えてください。'); onReady && onReady(this.code); });
    this.peer.on('connection', c => {
      if (this.conn && this.conn.open) { c.close(); return; }
      this.conn = c; this.wire(c);
    });
    this.peer.on('error', e => {
      if (e.type === 'unavailable-id') { this.status('コードが重複しました。再作成します…'); setTimeout(() => this.host(onReady), 300); return; }
      this.status('接続エラー: ' + (e.type || e.message));
    });
  },
  join(code, onOpen) {
    this.close(); this.role = 'guest'; this.code = code.toUpperCase().trim();
    if (this.local) { this.localOpen(this.code); this.status('接続しました！'); onOpen && onOpen(); return; }
    this.peer = new Peer(this.ICE);
    this.peer.on('open', () => {
      this.status('ホストに接続中…');
      const c = this.peer.connect(this.PREFIX + this.code, { reliable: true });
      this.conn = c; this.wire(c, onOpen);
    });
    this.peer.on('error', e => this.status(e.type === 'peer-unavailable' ? 'そのコードのルームが見つかりません' : '接続エラー: ' + (e.type || e.message)));
  },
  wire(c, onOpen) {
    c.on('open', () => { this.status('接続しました！'); this.handlers.open && this.handlers.open(); onOpen && onOpen(); });
    c.on('data', d => { const h = this.handlers[d && d.t]; if (h) h(d); });
    c.on('close', () => { this.status('相手との接続が切れました'); this.handlers.close && this.handlers.close(); });
  },
  send(o) { if (this.bc) { this.bc.postMessage(Object.assign({ _from: this.role }, o)); return; } if (this.conn && this.conn.open) this.conn.send(o); },
  connected() { return !!this.bc || !!(this.conn && this.conn.open); },
  close() {
    try { this.bc && this.bc.close(); } catch (e) {} this.bc = null;
    try { this.conn && this.conn.close(); } catch (e) {}
    try { this.peer && this.peer.destroy(); } catch (e) {}
    this.conn = null; this.peer = null; this.role = null;
  },
};
