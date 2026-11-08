// شبكة P2P (Mesh) فوق WebRTC بمكتبة PeerJS.
// الهوست بيعمل غرفة بكود قصير، اللاعبين بيدخلوا بالكود، وكل لاعب بيتوصل بباقي اللاعبين مباشرة.
// سيرفر PeerJS السحابي المجاني بيستخدم للتعارف (signaling) بس — البيانات نفسها بتمشي بين الأجهزة.
import { NET } from './config.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export class Net {
  constructor() {
    this.peer = null; this.conns = new Map(); this.h = {}; this.profile = null;
    this.code = null; this.isHost = false; this.id = null; this.lastSend = 0; this.pw = ''; this.max = 10; this._joinWait = null;
  }
  on(evt, fn) { (this.h[evt] ||= []).push(fn); return this; }
  emit(evt, ...a) { (this.h[evt] || []).forEach((f) => f(...a)); }
  get ready() { return !!this.peer && !this.peer.destroyed; }
  get count() { return this.conns.size; }

  _newPeer(id) {
    if (!window.Peer) throw new Error('مكتبة PeerJS مش متحمّلة (محتاج نت)');
    return new Promise((resolve, reject) => {
      const p = new window.Peer(id, { config: { iceServers: NET.iceServers }, debug: 1 });
      const t = setTimeout(() => reject(new Error('timeout')), 12000);
      p.on('open', (pid) => { clearTimeout(t); resolve({ p, pid }); });
      p.on('error', (e) => { clearTimeout(t); reject(e); });
    });
  }

  async host(profile, opts = {}) { // opts: { pw: كلمة سر اختيارية، max: أقصى عدد لاعبين 2..10 }
    this.profile = profile; this.isHost = true; this.pw = String(opts.pw || '').trim().slice(0, 12); this.max = Math.max(2, Math.min(10, opts.max | 0 || 10));
    for (let k = 0; k < 6; k++) {
      const code = genCode();
      try {
        const { p, pid } = await this._newPeer(NET.prefix + code);
        this.peer = p; this.id = pid; this.code = code; this._wire(); return code;
      } catch (e) { if (e && e.type !== 'unavailable-id') throw e; }
    }
    throw new Error('مقدرتش أعمل غرفة، جرب تاني');
  }

  async join(code, profile, pw = '') {
    this.profile = profile; this.isHost = false; this.pw = String(pw || '').trim().slice(0, 12); this.code = code.toUpperCase().trim();
    const { p, pid } = await this._newPeer(undefined);
    this.peer = p; this.id = pid; this._wire();
    await new Promise((resolve, reject) => {
      const conn = p.connect(NET.prefix + this.code, { reliable: true });
      const t = setTimeout(() => reject(new Error('الغرفة مش بترد')), 10000);
      p.once('error', (e) => { clearTimeout(t); reject(e.type === 'peer-unavailable' ? new Error('الكود ده مش موجود') : e); });
      this._joinWait = { resolve: () => { clearTimeout(t); resolve(); }, reject: (e) => { clearTimeout(t); reject(e); } }; // بنستنى موافقة الهوست (ok) مش بس فتح الاتصال
      this._setupConn(conn);
    });
    return this.code;
  }

  _wire() {
    this.peer.on('connection', (c) => this._setupConn(c));
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* ignore */ } });
    this.peer.on('error', (e) => this.emit('error', e));
  }

  _setupConn(conn) {
    conn.on('open', () => {
      if (this.conns.has(conn.peer)) { conn.close(); return; }
      this.conns.set(conn.peer, conn);
      conn.send({ t: 'hello', p: this.profile, pw: !this.isHost && conn.peer === NET.prefix + this.code ? this.pw : undefined }); // الباسورد بيتبعت للهوست بس
    });
    conn.on('data', (d) => this._onData(conn, d));
    conn.on('close', () => this._drop(conn.peer));
    conn.on('error', () => this._drop(conn.peer));
  }

  _deny(conn, m) { try { conn.send({ t: 'deny', m }); } catch (e) { /* ignore */ } this.conns.delete(conn.peer); setTimeout(() => { try { conn.close(); } catch (e) { /* ignore */ } }, 400); }
  _drop(id) { if (this.conns.delete(id)) this.emit('leave', id); }

  _onData(conn, d) {
    if (!d || !d.t) return;
    switch (d.t) {
      case 'hello':
        if (this.isHost && !conn._chk) { // الهوست بيراجع الباسورد والحد الأقصى قبل ما يقبل اللاعب
          conn._chk = 1;
          if (this.pw && d.pw !== this.pw) return this._deny(conn, 'كلمة سر الغرفة غلط');
          if (this.conns.size > this.max - 1) return this._deny(conn, 'الغرفة مليانة (' + this.max + ' لاعبين)');
          conn.send({ t: 'ok' });
        }
        this.emit('join', conn.peer, d.p);
        if (this.isHost) conn.send({ t: 'peers', ids: [...this.conns.keys()].filter((i) => i !== conn.peer) });
        break;
      case 'peers': // الهوست بيقولي مين تاني في الغرفة → أتوصل بيهم (Mesh)
        for (const id of d.ids) if (id !== this.id && !this.conns.has(id)) this._setupConn(this.peer.connect(id, { reliable: true }));
        break;
      case 'ok': if (this._joinWait) { this._joinWait.resolve(); this._joinWait = null; } break;
      case 'deny': if (this._joinWait) { this._joinWait.reject(new Error(d.m || 'الغرفة رفضت دخولك')); this._joinWait = null; } break;
      case 's': this.emit('state', conn.peer, d); break;
      case 'race': this.emit('race', conn.peer, d); break;
      case 'p': this.emit('profile', conn.peer, d.p); break;
      case 'chat': this.emit('chat', conn.peer, d.m); break;
      case 'horn': this.emit('horn', conn.peer); break;
      default: break;
    }
  }

  send(obj) { for (const c of this.conns.values()) if (c.open) c.send(obj); }
  sendState(s, now) { // بيحدّ المعدل
    if (now - this.lastSend < 1000 / NET.sendHz) return;
    this.lastSend = now; this.send({ t: 's', ...s });
  }
  updateProfile(p) { this.profile = p; this.send({ t: 'p', p }); }

  close() {
    try { for (const c of this.conns.values()) c.close(); this.peer && this.peer.destroy(); } catch (e) { /* ignore */ }
    this.conns.clear(); this.peer = null; this.code = null; this.isHost = false; this.pw = ''; this._joinWait = null;
  }
}
