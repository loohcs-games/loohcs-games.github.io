'use strict';

// 部屋主のブラウザと友達のブラウザをつなぐ部分。
// 公開の MQTT 中継サーバー（WebSocket）を通して送る。学校などで直接接続（WebRTC）が
// できないネットワークでも、ふつうのWebページと同じ通信なのでつながりやすい。
// 中継サーバーはだれでも読めるので、中身は1人ずつ別の鍵で暗号化する（ECDH + AES-GCM）。
window.PokerP2P = (() => {
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  const PREFIX = 'loohcs-poker/v1/';
  const HEARTBEAT_MS = 5000;
  const DEAD_MS = 20000;
  const HELLO_TIMEOUT_MS = 8000;

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  // ---------- 小さな MQTT 3.1.1 クライアント（QoS 0 のみ） ----------
  function varint(n) {
    const out = [];
    do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0);
    return out;
  }
  const str = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const packet = (head, body) => new Uint8Array([head, ...varint(body.length), ...body]);

  function connectBroker(url, onPublish, onClose) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url, 'mqtt'); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      let buf = new Uint8Array(0);
      let ready = false;
      let pid = 1;
      let ping = null;
      const timer = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);

      const client = {
        subscribe(topic) { const id = pid++ & 0xffff || 1; ws.send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0])); },
        publish(topic, text) { if (ws.readyState === 1) ws.send(packet(0x30, [...str(topic), ...enc.encode(text)])); },
        close() { clearInterval(ping); try { ws.send(new Uint8Array([0xe0, 0])); } catch { /* 無視 */ } ws.close(); },
      };

      ws.onopen = () => {
        const id = `lpk${hex(8)}`;
        ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 60, ...str(id)]));
      };
      ws.onmessage = (e) => {
        const chunk = new Uint8Array(e.data);
        const merged = new Uint8Array(buf.length + chunk.length);
        merged.set(buf); merged.set(chunk, buf.length);
        buf = merged;
        // 届いたぶんから、まとまったパケットを順に取り出す
        for (;;) {
          if (buf.length < 2) break;
          let len = 0; let mul = 1; let i = 1; let b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
          if (buf.length < i + len) break;
          const type = buf[0] >> 4;
          const body = buf.subarray(i, i + len);
          buf = buf.slice(i + len);
          if (type === 2) { // CONNACK
            clearTimeout(timer);
            if (body[1] !== 0) { ws.close(); reject(new Error('refused')); return; }
            ready = true;
            ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); }, 30000);
            resolve(client);
          } else if (type === 3) { // PUBLISH（QoS 0）
            const tl = (body[0] << 8) | body[1];
            const topic = dec.decode(body.subarray(2, 2 + tl));
            onPublish(topic, dec.decode(body.subarray(2 + tl)));
          }
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        clearTimeout(timer);
        if (ready) onClose(); else reject(new Error('closed'));
      };
      ws.onerror = () => {};
    });
  }

  // 1つ目の中継サーバーがだめなら次を試す
  async function connectAny(onPublish, onClose) {
    let last;
    for (const url of BROKERS) {
      try { return await connectBroker(url, onPublish, onClose); } catch (e) { last = e; }
    }
    throw last || new Error('no broker');
  }

  // ---------- 暗号化 ----------
  const newKeyPair = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const exportPub = async (kp) => b64(await crypto.subtle.exportKey('raw', kp.publicKey));
  async function deriveKey(kp, pub) {
    const peer = await crypto.subtle.importKey('raw', unb64(pub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    return crypto.subtle.deriveKey({ name: 'ECDH', public: peer }, kp.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function unseal(key, msg) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(msg.iv) }, key, unb64(msg.ct));
    return JSON.parse(dec.decode(pt));
  }

  // 暗号化した通信路（順番を守って送る・受ける）。n で古いものの再送をはじく
  function channel(key, publish) {
    let outQ = Promise.resolve();
    let inQ = Promise.resolve();
    let nOut = 0;
    let nIn = 0;
    return {
      send(kind, data) {
        const n = ++nOut;
        outQ = outQ.then(() => seal(key, { n, k: kind, d: data })).then(publish).catch(() => {});
      },
      receive(msg, handler) {
        inQ = inQ.then(() => unseal(key, msg)).then((m) => {
          if (typeof m.n !== 'number' || m.n <= nIn) return;
          nIn = m.n;
          handler(m.k, m.d);
        }).catch(() => {});
      },
    };
  }
  const parse = (text) => { try { const m = JSON.parse(text); return m && typeof m === 'object' ? m : null; } catch { return null; } };

  // ---------- 部屋主 ----------
  function host(hub, { onOnline, onError }) {
    let mqtt = null;
    let stopped = false;
    let kp = null;
    let pub = '';
    const sessions = new Map(); // cid -> { ch, link, lastSeen }
    const room = () => hub.roomId;
    const guestTopic = (cid) => `${PREFIX}${room()}/g/${cid}`;

    const drop = (cid, sayBye, closed = false) => {
      const s = sessions.get(cid);
      if (!s) return;
      sessions.delete(cid);
      if (sayBye && mqtt) mqtt.publish(guestTopic(cid), JSON.stringify({ t: 'bye', closed }));
      if (s.link) s.link.close();
    };

    const onPublish = async (topic, text) => {
      if (topic !== `${PREFIX}${room()}/h`) return;
      const m = parse(text);
      if (!m || typeof m.cid !== 'string' || !/^[a-f0-9]{16}$/.test(m.cid)) return;
      if (m.t === 'hi' && typeof m.pub === 'string') {
        let key;
        try { key = await deriveKey(kp, m.pub); } catch { return; }
        drop(m.cid, false);
        const cid = m.cid;
        const s = { lastSeen: Date.now(), link: null };
        s.ch = channel(key, (env) => { if (mqtt) mqtt.publish(guestTopic(cid), JSON.stringify({ t: 'm', ...env })); });
        sessions.set(cid, s);
        mqtt.publish(guestTopic(cid), JSON.stringify({ t: 'ok', pub }));
        s.link = hub.attach({
          send: (msg) => s.ch.send('d', msg),
          close: () => drop(cid, true),
        });
      } else if (m.t === 'm') {
        const s = sessions.get(m.cid);
        if (!s) return;
        s.ch.receive(m, (kind, data) => {
          s.lastSeen = Date.now();
          if (kind === 'd' && s.link) s.link.receive(data);
        });
      } else if (m.t === 'bye') {
        drop(m.cid, false);
      }
    };

    // 友達ごとの生存確認
    const beat = setInterval(() => {
      const now = Date.now();
      for (const [cid, s] of sessions) {
        if (now - s.lastSeen > DEAD_MS) drop(cid, false);
        else s.ch.send('ping');
      }
    }, HEARTBEAT_MS);

    let first = true;
    const start = async () => {
      try {
        mqtt = await connectAny(onPublish, () => {
          mqtt = null;
          if (!stopped) setTimeout(start, 2000); // 中継サーバーが切れたらつなぎ直す
        });
        if (stopped) { mqtt.close(); return; }
        mqtt.subscribe(`${PREFIX}${room()}/h`);
        if (first) { first = false; onOnline(room()); }
      } catch (e) {
        if (stopped) return;
        if (first) { first = false; onError(e); }
        setTimeout(start, 5000);
      }
    };
    newKeyPair().then(async (k) => { kp = k; pub = await exportPub(k); start(); }).catch(onError);

    return {
      stop() {
        stopped = true;
        clearInterval(beat);
        for (const cid of [...sessions.keys()]) drop(cid, true, true); // 部屋が終わったことを知らせる
        if (mqtt) setTimeout(() => mqtt && mqtt.close(), 300);
      },
    };
  }

  // ---------- 友達 ----------
  function join(room, { onOpen, onData, onClose, onNotFound, onError, onRoomClosed }) {
    const cid = hex(8);
    const myTopic = `${PREFIX}${room}/g/${cid}`;
    const hostTopic = `${PREFIX}${room}/h`;
    let mqtt = null;
    let finished = false;
    let opened = false;
    let ch = null;
    let lastSeen = Date.now();
    let helloTimer = null;
    let beat = null;

    const end = (fn, arg) => {
      if (finished) return;
      finished = true;
      clearTimeout(helloTimer);
      clearInterval(beat);
      if (mqtt) {
        mqtt.publish(hostTopic, JSON.stringify({ t: 'bye', cid }));
        const m = mqtt;
        setTimeout(() => m.close(), 300);
      }
      if (fn) fn(arg);
    };

    (async () => {
      const kp = await newKeyPair();
      const pub = await exportPub(kp);
      mqtt = await connectAny(async (topic, text) => {
        if (topic !== myTopic || finished) return;
        const m = parse(text);
        if (!m) return;
        if (m.t === 'ok' && !ch && typeof m.pub === 'string') {
          const key = await deriveKey(kp, m.pub);
          ch = channel(key, (env) => { if (mqtt) mqtt.publish(hostTopic, JSON.stringify({ t: 'm', cid, ...env })); });
          clearTimeout(helloTimer);
          opened = true;
          lastSeen = Date.now();
          beat = setInterval(() => {
            if (Date.now() - lastSeen > DEAD_MS) end(onClose);
            else ch.send('ping');
          }, HEARTBEAT_MS);
          onOpen({ send: (msg) => ch.send('d', msg), close: () => end(null) });
        } else if (m.t === 'm' && ch) {
          ch.receive(m, (kind, data) => {
            lastSeen = Date.now();
            if (kind === 'd') onData(data);
          });
        } else if (m.t === 'bye') {
          end(m.closed ? onRoomClosed : opened ? onClose : onNotFound);
        }
      }, () => { mqtt = null; end(opened ? onClose : onError, new Error('disconnected')); });
      if (finished) { mqtt.close(); return; }
      mqtt.subscribe(myTopic);
      // 購読が通るのを少し待ってから、部屋主にあいさつする
      setTimeout(() => { if (!finished && mqtt) mqtt.publish(hostTopic, JSON.stringify({ t: 'hi', cid, pub })); }, 300);
      helloTimer = setTimeout(() => end(onNotFound), HELLO_TIMEOUT_MS);
    })().catch((e) => end(onError, e));

    return { cancel() { end(null); } };
  }

  return { host, join };
})();
