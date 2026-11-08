// سيرفر October Rider: بيقدّم اللعبة + لوحة الإدارة + API للإعلانات وصور المعالم وموديلات المركبات (GLB).
// بدون أي مكتبات خارجية. تشغيل: npm run server   (أو: ADMIN_PASSWORD=سر PORT=8080 node server/server.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAccounts } from './accounts.mjs';
import { musicPlaylist, AUDIO_MIME } from './music.mjs';
import { normalizeMessages } from '../www/js/messages.js';
import { sanitizeContact } from '../www/js/contact.js';
import { createStaff } from './staff.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WWW = path.join(ROOT, 'www'), ADMIN = path.join(ROOT, 'server/admin'), DATA = process.env.DATA_DIR || path.join(ROOT, 'server/data'), UP = path.join(DATA, 'uploads');
const PORT = process.env.PORT !== undefined ? +process.env.PORT : 8080;
fs.mkdirSync(UP, { recursive: true });

// ───────── كلمة السر ─────────
const AUTH = path.join(DATA, 'admin.json');
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
let auth;
try { auth = JSON.parse(fs.readFileSync(AUTH, 'utf8')); } catch (e) { auth = null; }
if (process.env.ADMIN_PASSWORD) { const salt = crypto.randomBytes(8).toString('hex'); auth = { salt, hash: hashPw(process.env.ADMIN_PASSWORD, salt) }; fs.writeFileSync(AUTH, JSON.stringify(auth)); }
if (!auth) {
  const pw = crypto.randomBytes(5).toString('hex'), salt = crypto.randomBytes(8).toString('hex'); auth = { salt, hash: hashPw(pw, salt) }; fs.writeFileSync(AUTH, JSON.stringify(auth));
  console.log('\n🔑 كلمة سر الإدارة (اتولدت أول مرة): ' + pw + '\n   غيّرها بتشغيل السيرفر بـ ADMIN_PASSWORD=كلمتك\n');
}
const sessions = new Map(); // token → { exp, role:'manager'|'staff', id, name, username, depts }
const newToken = (info = { role: 'manager', name: 'المدير' }) => { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, { exp: Date.now() + 12 * 3600e3, ...info }); return t; };
const sess = (req) => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); const e = sessions.get(t); if (!e) return null; if (e.exp < Date.now()) { sessions.delete(t); return null; } return e; };
const authed = (req) => { const e = sess(req); return !!e && e.role === 'manager'; }; // المدير بس (الحسابات وكلمة السر وغيرها)
let failures = new Map();

// ───────── المحتوى ─────────
const CFG = path.join(DATA, 'config.json');
const EMPTY = { version: 1, ads: [], landmarks: [], models: {}, bikeModels: {}, updatedAt: null };
const load = () => { try { return { ...EMPTY, ...JSON.parse(fs.readFileSync(CFG, 'utf8')) }; } catch (e) { return { ...EMPTY }; } };
let config = load();
const save = () => { config.version = (config.version || 0) + 1; config.updatedAt = new Date().toISOString(); fs.writeFileSync(CFG + '.tmp', JSON.stringify(config, null, 1)); fs.renameSync(CFG + '.tmp', CFG); };
const VKINDS = ['sedan', 'hatch', 'suv', 'pickup', 'taxi', 'microbus', 'bus', 'tuktuk', 'moto', 'scooter', 'car', 'walker', 'ped', 'myscooter', 'mymoto', 'ninja', 'model3'];
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const num = (v) => (v === '' || v == null || Number.isNaN(+v) ? undefined : +v);
const cropOf = (c) => { if (!c || typeof c !== 'object') return undefined; const z = +c.zoom, x = +c.cx, y = +c.cy; if (![z, x, y].every(Number.isFinite)) return undefined; const cl = (v, a, b) => Math.max(a, Math.min(b, v)); return { cx: cl(x, 0, 1), cy: cl(y, 0, 1), zoom: cl(z, 1, 4) }; };
function sanitize(inp) {
  const out = { ads: [], landmarks: [], models: {}, bikeModels: {}, messages: normalizeMessages(inp.messages) };
  for (const a of (inp.ads || []).slice(0, 300)) out.ads.push({ id: str(a.id, 40) || crypto.randomUUID(), title: str(a.title), type: ['billboard', 'banner', 'poster', 'screen'].includes(a.type) ? a.type : 'billboard', slots: Array.isArray(a.slots) ? a.slots.filter((x) => ['loading', 'menu', 'pause', 'end'].includes(x)) : undefined, image: str(a.image, 300), link: str(a.link, 300), lat: num(a.lat), lon: num(a.lon), width: num(a.width), height: num(a.height), crop: cropOf(a.crop), startsAt: str(a.startsAt, 40) || undefined, endsAt: str(a.endsAt, 40) || undefined, active: a.active !== false });
  for (const l of (inp.landmarks || []).slice(0, 300)) out.landmarks.push({ id: str(l.id, 40) || crypto.randomUUID(), name: str(l.name, 80), lat: num(l.lat), lon: num(l.lon), image: str(l.image, 300), crop: cropOf(l.crop), mode: ['facade', 'poster', 'both'].includes(l.mode) ? l.mode : 'both', note: str(l.note, 300), active: l.active !== false });
  for (const [k, m] of Object.entries(inp.models || {})) if (VKINDS.includes(k) && m && m.url) out.models[k] = { url: str(m.url, 300), length: num(m.length) || 4.4, rotY: num(m.rotY) || 0, y: Math.max(-1, Math.min(1, num(m.y) || 0)) };
  { // مساحات الإعلانات خارج اللعب + التواصل
    const sl = inp.adSlots && typeof inp.adSlots === 'object' ? inp.adSlots : {}; out.adSlots = { on: sl.on !== false, house: sl.house !== false, rotateMs: Math.max(3000, Math.min(60000, num(sl.rotateMs) || 7000)), slots: {} };
    for (const k of ['loading', 'menu', 'pause', 'end']) if (sl.slots && sl.slots[k] && sl.slots[k].on === false) out.adSlots.slots[k] = { on: false };
    out.adContact = str(inp.adContact, 120); out.adEndpoint = /^https:\/\/[^\s"'<>]+$/.test(String(inp.adEndpoint || '')) ? str(inp.adEndpoint, 300) : ''; out.contact = sanitizeContact(inp.contact);
  }
  out.streetNames = {}; for (const [k, v] of Object.entries(inp.streetNames || {}).slice(0, 5000)) if (/^way\/\d{1,15}$/.test(k) && typeof v === 'string' && v.trim()) out.streetNames[k] = str(v.trim(), 60);
  out.textures = {}; for (const k of ['ground', 'facade', 'road']) { const t = (inp.textures || {})[k]; if (t && t.image) out.textures[k] = { image: str(t.image, 300), crop: cropOf(t.crop), scale: Math.max(0.25, Math.min(8, num(t.scale) || 1)) }; }
  { // موسيقى المشغّل: ملفات مرفوعة من الإدارة (/uploads/...) أو روابط https — بتشتغل عند كل اللاعبين
    const mu = inp.music && typeof inp.music === 'object' ? inp.music : {}; out.music = { tracks: [] };
    for (const t of (Array.isArray(mu.tracks) ? mu.tracks : []).slice(0, 80)) { const url = t && String(t.url || ''); if (!url || !(/^\/uploads\/[\w.-]+$/.test(url) || /^https:\/\/[^\s"'<>]+$/.test(url))) continue; out.music.tracks.push({ url: str(url, 300), name: str(t.name, 80) || 'أغنية', where: ['menu', 'game', 'both'].includes(t.where) ? t.where : 'both' }); }
  }
  { // المحلات (الشرايح تحت العمارات): تنقية صارمة — ids بالشكل رقم-رقم-رقم فقط
    const sh = inp.shops && typeof inp.shops === 'object' ? inp.shops : {}, au = sh.auto && typeof sh.auto === 'object' ? sh.auto : {};
    const item = (v) => { if (!v || typeof v !== 'object') return null; const o = {}; if (v.hidden) o.hidden = true; if (v.image) o.image = str(v.image, 300); if (v.label) o.label = str(v.label, 40); if (/^#[0-9a-f]{6}$/i.test(String(v.color || ''))) o.color = v.color; const c = cropOf(v.crop); if (c) o.crop = c; if (v.street) o.street = str(v.street, 80); return o.hidden || o.image || o.label ? o : null; };
    out.shops = { hideAll: !!sh.hideAll, auto: { on: !!au.on, pct: Math.max(0, Math.min(100, Math.round(+au.pct || 0))) }, slots: {}, streets: {} };
    for (const [k, v] of Object.entries(sh.slots || {}).slice(0, 4000)) { const it = /^\d{1,6}-\d{1,3}-\d{1,3}$/.test(k) ? item(v) : null; if (it) out.shops.slots[k] = it; }
    for (const [k, v] of Object.entries(sh.streets || {}).slice(0, 600)) { const it = k && k.length <= 80 ? item(v) : null; if (it) out.shops.streets[str(k, 80)] = it; }
  }
  return out;
}

// ───────── أدوات HTTP ─────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
Object.assign(MIME, AUDIO_MIME);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS }); res.end(JSON.stringify(obj)); };
function body(req, limit) { return new Promise((resolve, reject) => { const ch = []; let n = 0; req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('too-large')); req.destroy(); } else ch.push(c); }); req.on('end', () => resolve(Buffer.concat(ch))); req.on('error', reject); }); }
function sendFile(res, file, extra = {}, req = null) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('مش موجود'); }
    const rg = req && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''); // Range: لازم للأغاني عشان Safari/iOS والتقديم
    if (rg && (rg[1] || rg[2])) { let a = rg[1] ? +rg[1] : Math.max(0, st.size - +rg[2]), b = rg[1] && rg[2] ? Math.min(+rg[2], st.size - 1) : st.size - 1; if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); } res.writeHead(206, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, ...CORS, ...extra }); return fs.createReadStream(file, { start: a, end: b }).pipe(res); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Accept-Ranges': 'bytes', ...CORS, ...extra }); fs.createReadStream(file).pipe(res);
  });
}
const inside = (base, rel) => { const f = path.normalize(path.join(base, rel)); return f.startsWith(base + path.sep) || f === base ? f : null; };
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.glb', '.gltf', '.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.opus']);

const staffSvc = createStaff({ DATA, hashPw });
const cleanKeys = (partial, keys) => { const full = sanitize({ ...config, ...partial }); return Object.fromEntries(keys.filter((k) => k in partial).map((k) => [k, full[k]])); };
const applyDept = (dept, changes) => { const keys = staffSvc.DEPTS[dept].keys, full = sanitize({ ...config, ...changes }); for (const k of keys) if (k in changes) config[k] = full[k]; save(); };
const accounts = createAccounts({ DATA, json, body, authed });
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (await accounts.handle(req, res, p, u)) return; // حسابات اللاعبين (accounts.mjs)
    if (p === '/music/playlist.json') return json(res, 200, musicPlaylist(WWW)); // موسيقى القائمة واللعب (music.mjs)

    // ── API عام ──
    if (p === '/api/config' && req.method === 'GET') return json(res, 200, { ...config, adminHash: undefined });
    if (p === '/api/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress, f = failures.get(ip) || { n: 0, t: 0 };
      if (f.n >= 6 && Date.now() - f.t < 60000) return json(res, 429, { error: 'محاولات كتير، استنى دقيقة' });
      let pw = '', un = ''; try { const b = JSON.parse((await body(req, 2000)).toString()); pw = b.password || ''; un = String(b.username || '').trim(); } catch (e) { /* ignore */ }
      if (un) { // دخول موظف: اسم مستخدم + كلمة سر
        const u = staffSvc.login(un, pw); if (!u) { failures.set(ip, { n: f.n + 1, t: Date.now() }); return json(res, 401, { error: 'اسم المستخدم أو كلمة السر غلط' }); }
        failures.delete(ip); staffSvc.log(u.name, 'دخول'); return json(res, 200, { token: newToken({ role: 'staff', ...u }), role: 'staff', name: u.name, depts: u.depts });
      }
      const ok = crypto.timingSafeEqual(Buffer.from(hashPw(String(pw), auth.salt), 'hex'), Buffer.from(auth.hash, 'hex'));
      if (!ok) { failures.set(ip, { n: f.n + 1, t: Date.now() }); return json(res, 401, { error: 'كلمة السر غلط' }); }
      failures.delete(ip); return json(res, 200, { token: newToken(), role: 'manager', name: 'المدير', depts: Object.keys(staffSvc.DEPTS) });
    }

    // ── API الإدارة ──
    if (p.startsWith('/api/admin/')) {
      const S = sess(req); if (!S) return json(res, 401, { error: 'سجّل دخول الأول' });
      const mgr = S.role === 'manager', no = () => json(res, 403, { error: 'ده من صلاحيات المدير بس' }), bad = (e) => (e && e.user ? json(res, 400, { error: e.message }) : Promise.reject(e));
      if (p === '/api/admin/me') return json(res, 200, { role: S.role, name: S.name, depts: mgr ? Object.keys(staffSvc.DEPTS) : S.depts, deptNames: Object.fromEntries(Object.entries(staffSvc.DEPTS).map(([k, v]) => [k, v.name])), keys: Object.fromEntries(Object.entries(staffSvc.DEPTS).map(([k, v]) => [k, v.keys])), pending: mgr ? staffSvc.pendingCount() : undefined });
      if (p === '/api/admin/config' && req.method === 'GET') return json(res, 200, config);
      if (p === '/api/admin/propose' && req.method === 'POST') { // موظف: بيبعت تعديلات قسمه للمراجعة
        try { const b = JSON.parse((await body(req, 3e6)).toString()); return json(res, 200, staffSvc.propose(S, String(b.dept || ''), b.changes || {}, b.note, cleanKeys)); } catch (e) { return bad(e); }
      }
      if (p === '/api/admin/proposals' && req.method === 'GET') return json(res, 200, { list: staffSvc.proposals(S, u.searchParams.get('status') || undefined), pending: staffSvc.pendingCount() });
      { const m = /^\/api\/admin\/proposals\/([\w-]+)\/(approve|reject|edited)$/.exec(p); if (m && req.method === 'POST') { if (!mgr) return no(); try { const b = JSON.parse((await body(req, 3e6)).toString() || '{}'); return json(res, 200, staffSvc.resolve(m[1], { approve: 'approved', reject: 'rejected', edited: 'edited' }[m[2]], S.name, b.note, applyDept)); } catch (e) { return bad(e); } } }
      if (p === '/api/admin/staff') { if (!mgr) return no(); try { if (req.method === 'GET') return json(res, 200, { list: staffSvc.list(), depts: Object.fromEntries(Object.entries(staffSvc.DEPTS).map(([k, v]) => [k, v.name])) }); if (req.method === 'POST') return json(res, 200, staffSvc.save(JSON.parse((await body(req, 4000)).toString()), S.name)); } catch (e) { return bad(e); } }
      { const m = /^\/api\/admin\/staff\/([\w-]+)$/.exec(p); if (m && req.method === 'DELETE') { if (!mgr) return no(); try { staffSvc.remove(m[1], S.name); return json(res, 200, { ok: true }); } catch (e) { return bad(e); } } }
      if (p === '/api/admin/audit' && req.method === 'GET') return mgr ? json(res, 200, { list: staffSvc.auditLog() }) : no();
      if (p === '/api/admin/me/password' && req.method === 'POST') { if (mgr) return json(res, 400, { error: 'المدير يغيّر كلمة السر من إعدادات الإدارة' }); try { const b = JSON.parse((await body(req, 1000)).toString()); staffSvc.changePassword(S.id, b.old, b.password); return json(res, 200, { ok: true }); } catch (e) { return bad(e); } }
      if (p === '/api/admin/config' && req.method === 'PUT') { if (!mgr) return json(res, 403, { error: 'الموظف بيبعت تعديلاته للمراجعة (مش نشر مباشر)' }); const inp = JSON.parse((await body(req, 3e6)).toString()); Object.assign(config, sanitize(inp)); save(); return json(res, 200, config); }
      if (p === '/api/admin/password' && req.method === 'POST') { if (!mgr) return no(); const pw = String(JSON.parse((await body(req, 1000)).toString()).password || ''); if (pw.length < 6) return json(res, 400, { error: 'كلمة السر أقصر من 6 حروف' }); const salt = crypto.randomBytes(8).toString('hex'); auth = { salt, hash: hashPw(pw, salt) }; fs.writeFileSync(AUTH, JSON.stringify(auth)); return json(res, 200, { ok: true }); }
      if (p === '/api/admin/upload' && req.method === 'POST') {
        const ext = path.extname(u.searchParams.get('name') || '').toLowerCase(); if (!ALLOWED.has(ext)) return json(res, 400, { error: 'نوع الملف غير مسموح (png/jpg/webp/glb/mp3/ogg/wav/m4a)' }); if (!staffSvc.canUpload(S, ext)) return json(res, 403, { error: 'نوع الملف ده مش من أقسامك' });
        const buf = await body(req, 25e6); if (!buf.length) return json(res, 400, { error: 'ملف فاضي' });
        if (ext === '.glb' && buf.slice(0, 4).toString() !== 'glTF') return json(res, 400, { error: 'الملف مش GLB سليم' });
        const name = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + ext; fs.writeFileSync(path.join(UP, name), buf); return json(res, 200, { url: '/uploads/' + name, size: buf.length });
      }
      if (p.startsWith('/api/admin/upload/') && req.method === 'DELETE' && !mgr) return no();
      if (p === '/api/admin/uploads' && req.method === 'GET') return json(res, 200, fs.readdirSync(UP).map((n) => ({ url: '/uploads/' + n, size: fs.statSync(path.join(UP, n)).size })));
      if (p.startsWith('/api/admin/upload/') && req.method === 'DELETE') { const f = inside(UP, path.basename(p)); if (f && fs.existsSync(f)) fs.unlinkSync(f); return json(res, 200, { ok: true }); }
      return json(res, 404, { error: 'مش موجود' });
    }

    // ── ملفات ──
    if (p.startsWith('/uploads/')) { const f = inside(UP, p.slice(9)); return f ? sendFile(res, f, { 'Cache-Control': 'public, max-age=86400' }, req) : json(res, 400, {}); }
    if (p === '/admin' || p === '/admin/') return sendFile(res, path.join(ADMIN, 'index.html'), { 'Cache-Control': 'no-store' });
    if (p.startsWith('/admin/')) { const f = inside(ADMIN, p.slice(7)); return f ? sendFile(res, f) : json(res, 400, {}); }
    if (p === '/content.json') return json(res, 200, config);
    const rel = p === '/' ? 'index.html' : p.slice(1), f = inside(WWW, rel);
    if (f) return sendFile(res, f, { 'Cache-Control': 'no-cache' });
    json(res, 400, {});
  } catch (e) { if (!res.headersSent) json(res, e.message === 'too-large' ? 413 : 500, { error: e.message === 'too-large' ? 'الملف كبير جدًا' : 'خطأ في السيرفر' }); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`🏍️  October Rider شغال على  http://localhost:${PORT}\n    لوحة الإدارة:  http://localhost:${PORT}/admin/`));
export { server, sanitize };
