// الأقسام والموظفين: المدير (كلمة سر الإدارة) بيضيف موظفين متخصصين لكل قسم؛ تعديلات الموظف بتروح «طلبات مراجعة» ومش بتظهر للاعبين غير بعد اعتماد المدير.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const IMG = ['.png', '.jpg', '.jpeg', '.webp'], AUDIO = ['.mp3', '.ogg', '.oga', '.wav', '.m4a', '.aac', '.opus'];
// الأقسام: الأقسام دي هي «مفاتيح» المحتوى اللي كل قسم مسموح يعدّلها، وأنواع الملفات اللي مسموح يرفعها
export const DEPTS = {
  ads: { name: '📢 الإعلانات', keys: ['ads', 'adSlots', 'adContact', 'adEndpoint'], uploads: IMG },
  places: { name: '📍 المعالم والشوارع', keys: ['landmarks', 'streetNames'], uploads: IMG },
  look: { name: '🎨 الخامات والمحلات', keys: ['textures', 'shops'], uploads: IMG },
  models: { name: '🧍 المجسمات (Model 3 / Bike Ninja)', keys: ['models', 'bikeModels'], uploads: ['.glb', '.gltf'] },
  music: { name: '🎵 الموسيقى', keys: ['music'], uploads: AUDIO },
  messages: { name: '💬 الرسائل والصوت', keys: ['messages'], uploads: [] },
  contact: { name: '📞 التواصل (واتساب)', keys: ['contact'], uploads: [] },
};
export const DEPT_IDS = Object.keys(DEPTS);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in (o || {})).map((k) => [k, o[k]]));

export function createStaff({ DATA, hashPw }) {
  const F = { staff: path.join(DATA, 'staff.json'), props: path.join(DATA, 'proposals.json'), audit: path.join(DATA, 'audit.json') };
  const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const wr = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 1)); fs.renameSync(f + '.tmp', f); };
  let staff = rd(F.staff, []), props = rd(F.props, []), audit = rd(F.audit, []);
  const log = (who, action, target = '') => { audit.push({ at: new Date().toISOString(), who, action, target }); if (audit.length > 500) audit = audit.slice(-500); wr(F.audit, audit); };
  const pub = (u) => ({ id: u.id, name: u.name, username: u.username, depts: u.depts, active: u.active !== false, createdAt: u.createdAt });
  const okUser = (v) => /^[a-z0-9_.-]{3,24}$/i.test(String(v || ''));
  const cleanDepts = (d) => [...new Set((Array.isArray(d) ? d : []).filter((x) => DEPT_IDS.includes(x)))];
  const err = (m) => { throw Object.assign(new Error(m), { user: true }); };
  const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  return {
    DEPTS, list: () => staff.map(pub),
    save(inp, by) { // إنشاء/تعديل موظف
      const username = String(inp.username || '').trim().toLowerCase(); if (!okUser(username)) err('اسم المستخدم 3–24 حرف إنجليزي/رقم (a-z 0-9 _ . -)');
      const depts = cleanDepts(inp.depts); if (!depts.length) err('اختار قسم واحد على الأقل');
      let u = inp.id ? staff.find((x) => x.id === inp.id) : null;
      if (staff.some((x) => x.username === username && (!u || x.id !== u.id))) err('اسم المستخدم مستخدم قبل كده');
      const name = String(inp.name || '').trim().slice(0, 40) || username;
      if (!u) { if (String(inp.password || '').length < 6) err('كلمة السر 6 حروف على الأقل'); u = { id: crypto.randomUUID(), createdAt: new Date().toISOString() }; staff.push(u); }
      Object.assign(u, { name, username, depts, active: inp.active !== false });
      if (inp.password) { if (String(inp.password).length < 6) err('كلمة السر 6 حروف على الأقل'); u.salt = crypto.randomBytes(8).toString('hex'); u.hash = hashPw(String(inp.password), u.salt); }
      wr(F.staff, staff); log(by, inp.id ? 'تعديل موظف' : 'إضافة موظف', username); return pub(u);
    },
    remove(id, by) { const u = staff.find((x) => x.id === id); if (!u) err('الموظف مش موجود'); staff = staff.filter((x) => x.id !== id); props.forEach((p) => { if (p.byId === id && p.status === 'pending') { p.status = 'rejected'; p.note = 'اتحذف الموظف'; } }); wr(F.staff, staff); wr(F.props, props); log(by, 'حذف موظف', u.username); },
    login(username, pw) { const u = staff.find((x) => x.username === String(username || '').trim().toLowerCase() && x.active !== false); if (!u) { hashPw(String(pw || ''), 'x'.repeat(16)); return null; } return eq(hashPw(String(pw || ''), u.salt), u.hash) ? { id: u.id, name: u.name, username: u.username, depts: u.depts } : null; },
    changePassword(id, oldPw, newPw) { const u = staff.find((x) => x.id === id); if (!u || !eq(hashPw(String(oldPw || ''), u.salt), u.hash)) err('كلمة السر الحالية غلط'); if (String(newPw || '').length < 6) err('كلمة السر 6 حروف على الأقل'); u.salt = crypto.randomBytes(8).toString('hex'); u.hash = hashPw(String(newPw), u.salt); wr(F.staff, staff); log(u.username, 'تغيير كلمة السر'); },
    // صلاحيات الجلسة: manager = كل حاجة · staff = أقسامه بس
    canDept: (sess, dept) => !!sess && (sess.role === 'manager' || (sess.depts || []).includes(dept)),
    canUpload: (sess, ext) => !!sess && (sess.role === 'manager' || (sess.depts || []).some((d) => DEPTS[d] && DEPTS[d].uploads.includes(ext))),
    keysOf: (sess) => (sess.role === 'manager' ? DEPT_IDS : sess.depts || []).flatMap((d) => DEPTS[d].keys),
    // طلب مراجعة من موظف: changes = القيم الجديدة لمفاتيح القسم (بتتنقّى بالـsanitize من السيرفر قبل التخزين)
    propose(sess, dept, changes, note, clean) {
      if (!DEPTS[dept]) err('قسم غير معروف'); if (!this.canDept(sess, dept)) err('مش من صلاحياتك القسم ده');
      if (props.filter((p) => p.byId === sess.id && p.status === 'pending').length >= 30) err('عندك 30 طلب مستني مراجعة — استنى المدير');
      const keys = DEPTS[dept].keys, ch = clean(pick(changes, keys), keys); if (!Object.keys(ch).length) err('مفيش تغييرات للقسم ده');
      const p = { id: crypto.randomUUID(), dept, byId: sess.id, byName: sess.name || sess.username, at: new Date().toISOString(), note: String(note || '').slice(0, 300), changes: ch, status: 'pending' };
      props.push(p); if (props.length > 400) props = props.filter((x) => x.status === 'pending').concat(props.filter((x) => x.status !== 'pending').slice(-200)); wr(F.props, props); log(p.byName, 'طلب مراجعة', dept); return { id: p.id };
    },
    proposals(sess, status) { const l = props.filter((p) => (sess.role === 'manager' || p.byId === sess.id) && (!status || p.status === status)); return l.slice().reverse().map((p) => ({ id: p.id, dept: p.dept, deptName: DEPTS[p.dept] && DEPTS[p.dept].name, byName: p.byName, at: p.at, note: p.note, status: p.status, reviewedBy: p.reviewedBy, reviewNote: p.reviewNote, keys: Object.keys(p.changes), summary: summarize(p.changes), changes: sess.role === 'manager' ? p.changes : undefined })); },
    pendingCount: () => props.filter((p) => p.status === 'pending').length,
    // المدير: اعتماد (يتطبّق على المحتوى بالـapply) / رفض / اعتماد بعد تعديله
    resolve(id, status, by, note, apply) {
      const p = props.find((x) => x.id === id); if (!p) err('الطلب مش موجود'); if (p.status !== 'pending') err('الطلب اتراجع قبل كده');
      if (status === 'approved') apply(p.dept, p.changes);
      p.status = status; p.reviewedBy = by; p.reviewNote = String(note || '').slice(0, 300); p.reviewedAt = new Date().toISOString(); wr(F.props, props); log(by, status === 'approved' ? 'اعتماد طلب' : status === 'edited' ? 'اعتماد بعد تعديل' : 'رفض طلب', p.dept + ' · ' + p.byName); return { ok: true };
    },
    auditLog: () => audit.slice().reverse().slice(0, 200), log,
  };
}
// ملخص بشري للتغيير (عدد العناصر لكل مفتاح)
export function summarize(ch) { return Object.entries(ch).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.length + ' عنصر' : v && typeof v === 'object' ? Object.keys(v).length + ' بند' : String(v).slice(0, 30))).join(' · '); }
