// حسابات اللاعبين: رقم هاتف + كلمة سر (من غير تحقق SMS)، أو جوجل. التقدم بيتحفظ على السيرفر.
// وحدة مستقلة — السيرفر الأساسي بيناديها بس. بدون مكتبات خارجية.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
export const normPhone = (s) => { let d = String(s || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d+]/g, ''); if (d.startsWith('00')) d = '+' + d.slice(2); if (d.startsWith('+')) return /^\+\d{8,15}$/.test(d) ? d : ''; if (/^01\d{9}$/.test(d)) return '+2' + d; /* مصري محلي */ return /^\d{8,15}$/.test(d) ? '+' + d : ''; };

// الحقول المسموحة في التقدم + حدودها (لمنع الحشو، مش حماية من الغش)
const NUM = ['points', 'deliveries', 'failed', 'streak', 'bestStreak', 'totalTime', 'starsSum', 'rated', 'distance', 'money', 'fuel', 'patrols', 'endlessRuns', 'bestEndless', 'fines', 'color', 'totalEarned', 'bestShift', 'bestRace', 'races'];
export function sanitizeProgress(inp) {
  const o = {}; if (!inp || typeof inp !== 'object') return o;
  for (const k of NUM) { const v = +inp[k]; if (Number.isFinite(v) && v >= 0 && v < 1e12) o[k] = v; }
  if (inp.name) o.name = str(inp.name, 14);
  if (inp.bike) o.bike = str(inp.bike, 30);
  for (const k of ['owned', 'upg', 'settings']) if (inp[k] && typeof inp[k] === 'object' && JSON.stringify(inp[k]).length < 4000) o[k] = JSON.parse(JSON.stringify(inp[k]));
  if (inp.outfit && typeof inp.outfit === 'object') { const s = JSON.stringify(inp.outfit); if (s.length < 1.6e6) o.outfit = JSON.parse(s); } else if (inp.outfit === null) o.outfit = null;
  return o;
}

export function createAccounts({ DATA, json, body, authed }) {
  const FILE = path.join(DATA, 'players.json'), SECRET = path.join(DATA, 'secret.key'), INFO = path.join(DATA, 'info.json');
  let secret; try { secret = fs.readFileSync(SECRET, 'utf8'); } catch (e) { secret = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET, secret); }
  let players = []; try { players = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { players = []; }
  const persist = () => { fs.writeFileSync(FILE + '.tmp', JSON.stringify(players)); fs.renameSync(FILE + '.tmp', FILE); };
  const INFO_DEFAULT = { gameName: 'كوكب الجحود أكتوبر', developer: '', whatsapp: '', operators: [], note: '', googleClientId: '' };
  const loadInfo = () => { try { return { ...INFO_DEFAULT, ...JSON.parse(fs.readFileSync(INFO, 'utf8')) }; } catch (e) { return { ...INFO_DEFAULT }; } };
  const cleanWa = (s) => String(s || '').replace(/[^\d]/g, '').slice(0, 16);
  function sanitizeInfo(inp) {
    const o = { gameName: str(inp.gameName, 80), developer: str(inp.developer, 80), whatsapp: cleanWa(inp.whatsapp), note: str(inp.note, 400), googleClientId: str(inp.googleClientId, 200).trim(), operators: [] };
    for (const x of Array.isArray(inp.operators) ? inp.operators.slice(0, 20) : []) o.operators.push({ name: str(x.name, 60), role: str(x.role, 60), whatsapp: cleanWa(x.whatsapp) });
    return o;
  }
  const clientId = () => process.env.GOOGLE_CLIENT_ID || loadInfo().googleClientId || '';
  const publicInfo = () => { const i = loadInfo(); return { ...i, googleClientId: clientId() }; };

  // توكن موقّع (يعيش 60 يوم، ينجو من إعادة تشغيل السيرفر)
  const sign = (id) => { const exp = Date.now() + 60 * 864e5, b = Buffer.from(JSON.stringify({ id, exp })).toString('base64url'); return b + '.' + crypto.createHmac('sha256', secret).update(b).digest('base64url'); };
  function who(req) {
    const t = (req.headers.authorization || '').replace(/^Bearer /, ''), [b, s] = t.split('.'); if (!b || !s) return null;
    const ok = crypto.createHmac('sha256', secret).update(b).digest('base64url'); if (s.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(ok))) return null;
    try { const j = JSON.parse(Buffer.from(b, 'base64url').toString()); if (j.exp < Date.now()) return null; return players.find((p) => p.id === j.id) || null; } catch (e) { return null; }
  }
  const pub = (p) => ({ id: p.id, name: p.name, phone: p.phone ? p.phone.slice(0, 4) + '•••••' + p.phone.slice(-3) : '', hasGoogle: !!p.googleSub, email: p.email || '' });
  const failures = new Map();
  const throttle = (req) => { const ip = req.socket.remoteAddress, f = failures.get(ip) || { n: 0, t: 0 }; if (Date.now() - f.t > 60000) { f.n = 0; } return f.n >= 8 ? 'محاولات كتير، استنى دقيقة' : ''; };
  const fail = (req) => { const ip = req.socket.remoteAddress, f = failures.get(ip) || { n: 0, t: 0 }; f.n++; f.t = Date.now(); failures.set(ip, f); };
  const readJSON = async (req, lim = 4000) => { try { return JSON.parse((await body(req, lim)).toString() || '{}'); } catch (e) { if (e.message === 'too-large') throw e; return {}; } };
  const mkPlayer = (o) => ({ id: 'p' + crypto.randomBytes(5).toString('hex'), name: 'كابتن ' + Math.floor(100 + Math.random() * 900), phone: '', salt: '', hash: '', googleSub: '', email: '', progress: null, createdAt: new Date().toISOString(), updatedAt: null, ...o });
  const setPw = (p, pw) => { p.salt = crypto.randomBytes(8).toString('hex'); p.hash = hashPw(pw, p.salt); };
  const pwOk = (p, pw) => p.hash && crypto.timingSafeEqual(Buffer.from(hashPw(String(pw), p.salt), 'hex'), Buffer.from(p.hash, 'hex'));

  async function googleVerify(cred) {
    const cid = clientId(); if (!cid) throw new Error('جوجل مش مفعّل على السيرفر');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred)); if (!r.ok) throw new Error('توكن جوجل مرفوض');
    const j = await r.json(); if (j.aud !== cid) throw new Error('توكن جوجل لتطبيق تاني'); if (!(j.email_verified === true || j.email_verified === 'true')) throw new Error('إيميل جوجل غير مؤكد');
    return { sub: String(j.sub), email: str(j.email, 120), name: str(j.given_name || j.name, 14) };
  }

  // يرجّع true لو الطلب اتعامل معاه
  async function handle(req, res, p, u) {
    if (p === '/api/info' && req.method === 'GET') { json(res, 200, publicInfo()); return true; }
    if (p === '/api/leaderboard' && req.method === 'GET') {
      json(res, 200, players.filter((x) => x.progress).map((x) => ({ name: x.progress.name || x.name, points: x.progress.points || 0, deliveries: x.progress.deliveries || 0 })).sort((a, b) => b.points - a.points).slice(0, 20)); return true;
    }
    if (p.startsWith('/api/auth/') || p === '/api/progress') {
      if (p === '/api/auth/register' && req.method === 'POST') {
        const t = throttle(req); if (t) { json(res, 429, { error: t }); return true; }
        const b = await readJSON(req), phone = normPhone(b.phone), pw = str(b.password, 100);
        if (!phone) { json(res, 400, { error: 'رقم الهاتف غير صحيح' }); return true; } if (pw.length < 6) { json(res, 400, { error: 'كلمة السر أقصر من 6 حروف' }); return true; }
        if (players.some((x) => x.phone === phone)) { fail(req); json(res, 409, { error: 'الرقم ده مسجّل قبل كده — سجّل دخول' }); return true; }
        const pl = mkPlayer({ phone, name: str(b.name, 14).trim() || undefined }); setPw(pl, pw); if (b.progress) pl.progress = sanitizeProgress(b.progress); players.push(pl); persist();
        json(res, 200, { token: sign(pl.id), player: pub(pl), progress: pl.progress }); return true;
      }
      if (p === '/api/auth/login' && req.method === 'POST') {
        const t = throttle(req); if (t) { json(res, 429, { error: t }); return true; }
        const b = await readJSON(req), phone = normPhone(b.phone), pl = players.find((x) => x.phone === phone);
        if (!pl || !pwOk(pl, b.password)) { fail(req); json(res, 401, { error: 'الرقم أو كلمة السر غلط' }); return true; }
        json(res, 200, { token: sign(pl.id), player: pub(pl), progress: pl.progress }); return true;
      }
      if (p === '/api/auth/google' && req.method === 'POST') {
        const t = throttle(req); if (t) { json(res, 429, { error: t }); return true; }
        const b = await readJSON(req, 8000); let g; try { g = await googleVerify(str(b.credential, 4000)); } catch (e) { fail(req); json(res, 400, { error: e.message }); return true; }
        let pl = players.find((x) => x.googleSub === g.sub);
        if (!pl) { pl = mkPlayer({ googleSub: g.sub, email: g.email, name: g.name || undefined }); if (b.progress) pl.progress = sanitizeProgress(b.progress); players.push(pl); persist(); }
        json(res, 200, { token: sign(pl.id), player: pub(pl), progress: pl.progress }); return true;
      }
      const me = who(req); if (!me) { json(res, 401, { error: 'سجّل دخول الأول' }); return true; }
      if (p === '/api/auth/me' && req.method === 'GET') { json(res, 200, { player: pub(me), progress: me.progress }); return true; }
      if (p === '/api/auth/password' && req.method === 'POST') {
        const b = await readJSON(req), nw = str(b.newPassword, 100); if (nw.length < 6) { json(res, 400, { error: 'كلمة السر الجديدة أقصر من 6 حروف' }); return true; }
        if (me.hash && !pwOk(me, b.oldPassword)) { fail(req); json(res, 401, { error: 'كلمة السر الحالية غلط' }); return true; }
        setPw(me, nw); persist(); json(res, 200, { ok: true }); return true;
      }
      if (p === '/api/auth/phone' && req.method === 'POST') { // ربط رقم هاتف بحساب جوجل
        const b = await readJSON(req), phone = normPhone(b.phone); if (!phone) { json(res, 400, { error: 'رقم الهاتف غير صحيح' }); return true; }
        if (players.some((x) => x.phone === phone && x.id !== me.id)) { json(res, 409, { error: 'الرقم مستخدم في حساب تاني' }); return true; }
        me.phone = phone; if (!me.hash && str(b.password, 100).length >= 6) setPw(me, str(b.password, 100)); persist(); json(res, 200, { player: pub(me) }); return true;
      }
      if (p === '/api/progress' && req.method === 'GET') { json(res, 200, { progress: me.progress }); return true; }
      if (p === '/api/progress' && req.method === 'PUT') {
        const b = await readJSON(req, 2e6); me.progress = sanitizeProgress(b.progress || b); if (me.progress.name) me.name = me.progress.name; me.updatedAt = new Date().toISOString(); persist(); json(res, 200, { ok: true, at: me.updatedAt }); return true;
      }
      json(res, 404, { error: 'مش موجود' }); return true;
    }
    // ── إدارة اللاعبين والمعلومات ──
    if (p.startsWith('/api/admin/players') || p === '/api/admin/info') {
      if (!authed(req)) { json(res, 401, { error: 'سجّل دخول الأول' }); return true; }
      if (p === '/api/admin/info' && req.method === 'GET') { json(res, 200, loadInfo()); return true; }
      if (p === '/api/admin/info' && req.method === 'PUT') { const i = sanitizeInfo(await readJSON(req, 20000)); fs.writeFileSync(INFO, JSON.stringify(i, null, 1)); json(res, 200, i); return true; }
      if (p === '/api/admin/players' && req.method === 'GET') {
        json(res, 200, players.map((x) => ({ id: x.id, name: x.name, phone: x.phone, email: x.email, google: !!x.googleSub, createdAt: x.createdAt, updatedAt: x.updatedAt, points: x.progress?.points || 0, deliveries: x.progress?.deliveries || 0, money: x.progress?.money || 0 }))); return true;
      }
      const m = p.match(/^\/api\/admin\/players\/([\w-]+)(\/reset-password)?$/), pl = m && players.find((x) => x.id === m[1]);
      if (m && !pl) { json(res, 404, { error: 'لاعب مش موجود' }); return true; }
      if (m && m[2] && req.method === 'POST') { // إعادة ضبط كلمة السر من الإدارة — بيتم التواصل مع اللاعب واتساب
        const b = await readJSON(req); let pw = str(b.password, 100); if (pw.length < 6) pw = crypto.randomBytes(4).toString('hex'); setPw(pl, pw); persist(); json(res, 200, { password: pw }); return true;
      }
      if (m && req.method === 'DELETE') { players = players.filter((x) => x !== pl); persist(); json(res, 200, { ok: true }); return true; }
    }
    return false;
  }
  return { handle, count: () => players.length };
}
