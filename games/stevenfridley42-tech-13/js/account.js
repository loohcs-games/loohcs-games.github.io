'use strict';
// ===== アカウント（このブラウザ内のローカルアカウント） =====
// 本物のGoogle / メール認証にはサーバー（Firebase Authentication 等）が必要です。
// ここではブラウザ内にアカウントを作り、セーブデータをアカウントごとに分けます。
const Account = {
  KEY: 'gridiron26_accounts', cur: null,
  data() { try { return JSON.parse(localStorage.getItem(this.KEY)) || { users: {}, last: null }; } catch (e) { return { users: {}, last: null }; } },
  saveData(d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {} },
  async hash(pw, email) {
    const s = 'gridiron26:' + email.toLowerCase() + ':' + pw;
    try {
      if (window.crypto && crypto.subtle) {
        const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    let h1 = 5381, h2 = 52711; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 33) ^ c; }
    return 'x' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  },
  validEmail: e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  async register(name, email, pw) {
    email = email.trim().toLowerCase(); name = name.trim();
    if (!name) return '表示名を入力してください';
    if (!this.validEmail(email)) return 'メールアドレスの形式が正しくありません';
    if (pw.length < 6) return 'パスワードは6文字以上にしてください';
    const d = this.data();
    if (Object.values(d.users).some(u => u.email === email)) return 'このメールアドレスは登録済みです';
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    d.users[id] = { id, name, email, ph: await this.hash(pw, email), created: Date.now() };
    d.last = id; this.saveData(d);
    this.cur = { id, name, email };
    return null;
  },
  async login(email, pw) {
    email = email.trim().toLowerCase();
    const d = this.data(), u = Object.values(d.users).find(x => x.email === email);
    if (!u) return 'アカウントが見つかりません（このブラウザで作成したアカウントのみ使えます）';
    if (u.ph !== await this.hash(pw, email)) return 'パスワードが違います';
    d.last = u.id; this.saveData(d);
    this.cur = { id: u.id, name: u.name, email: u.email };
    return null;
  },
  lastUser() { const d = this.data(); return d.last && d.users[d.last] ? d.users[d.last] : null; },
  guest() { this.cur = { id: 'guest', name: 'ゲスト', guest: true }; },
  logout() { this.cur = null; },
  // セーブデータの名前空間（ゲストは従来のキーを使う）
  prefix() { return !this.cur || this.cur.guest ? 'gridiron26' : 'gridiron26_' + this.cur.id; },
  keys() { const p = this.prefix(), out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === p || k.startsWith(p + '_career_') || k === p + '_settings') out.push(k); } return out; },
  exportData() {
    const p = this.prefix(), data = {};
    this.keys().forEach(k => data[k.slice(p.length)] = localStorage.getItem(k));
    const blob = new Blob([JSON.stringify({ app: 'gridiron26', v: 1, name: this.cur ? this.cur.name : '', data })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gridiron26_${(this.cur && this.cur.name) || 'save'}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  importData(file, done) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result); if (j.app !== 'gridiron26') throw new Error('形式が違います');
        const p = this.prefix(); for (const k in j.data) localStorage.setItem(p + k, j.data[k]);
        done(null);
      } catch (e) { done('読み込みに失敗しました: ' + e.message); }
    };
    r.readAsText(file);
  },
};
