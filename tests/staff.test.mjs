// اختبار الأقسام والموظفين: صلاحيات، طلبات مراجعة، اعتماد/رفض، رفع الملفات حسب القسم، واتساب
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orider-staff-'));
process.env.DATA_DIR = dir; process.env.ADMIN_PASSWORD = 'manager-pass-1'; process.env.PORT = '0';
const { server } = await import('../server/server.mjs');
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
const base = 'http://127.0.0.1:' + server.address().port;
const j = async (p, o = {}, tok) => { const r = await fetch(base + p, { ...o, headers: { ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(o.headers || {}) } }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const post = (p, b, t) => j(p, { method: 'POST', body: JSON.stringify(b) }, t);
let n = 0; const ok = (m) => { n++; console.log('✓', m); };

const M = (await post('/api/login', { password: 'manager-pass-1' })).j; assert.equal(M.role, 'manager'); const mt = M.token;
const me = (await j('/api/admin/me', {}, mt)).j; assert.equal(me.role, 'manager'); assert.ok(me.depts.includes('ads') && me.depts.includes('models') && me.depts.includes('contact')); ok('المدير: دخول وكل الأقسام');

assert.equal((await post('/api/admin/staff', { username: 'a b', password: 'secret1', depts: ['ads'] }, mt)).s, 400);
assert.equal((await post('/api/admin/staff', { username: 'ali', password: '123', depts: ['ads'] }, mt)).s, 400);
assert.equal((await post('/api/admin/staff', { username: 'ali', password: 'secret1', depts: ['zzz'] }, mt)).s, 400);
const ali = await post('/api/admin/staff', { name: 'علي', username: 'Ali', password: 'secret1', depts: ['ads', 'contact'] }, mt); assert.equal(ali.s, 200); assert.equal(ali.j.username, 'ali'); assert.ok(!('hash' in ali.j) && !('salt' in ali.j));
assert.equal((await post('/api/admin/staff', { username: 'ali', password: 'secret1', depts: ['ads'] }, mt)).s, 400, 'اسم مكرر');
const sam = await post('/api/admin/staff', { name: 'سامي', username: 'sami', password: 'secret2', depts: ['models'] }, mt); assert.equal(sam.s, 200);
ok('المدير: إضافة موظفين بتحقق (اسم/كلمة سر/قسم/تكرار) ومن غير تسريب الهاش');

assert.equal((await post('/api/login', { username: 'ali', password: 'غلط' })).s, 401); assert.equal((await post('/api/login', { username: 'nobody', password: 'x' })).s, 401);
const A = (await post('/api/login', { username: 'ali', password: 'secret1' })).j; assert.equal(A.role, 'staff'); const at = A.token; assert.deepEqual(A.depts.sort(), ['ads', 'contact']);
assert.equal((await j('/api/admin/me', {}, at)).j.role, 'staff'); ok('الموظف: دخول باسم مستخدم + كلمة سر');

assert.equal((await j('/api/admin/config', { method: 'PUT', body: JSON.stringify({ ads: [] }) }, at)).s, 403);
assert.equal((await j('/api/admin/staff', {}, at)).s, 403); assert.equal((await post('/api/admin/password', { password: 'hacked-pass' }, at)).s, 403); assert.equal((await j('/api/admin/audit', {}, at)).s, 403);
assert.equal((await post('/api/admin/proposals/x/approve', {}, at)).s, 403); assert.equal((await j('/api/admin/config', {}, at)).s, 200); ok('الموظف: ممنوع النشر المباشر والإدارة (403)، مسموح القراءة');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const up = await j('/api/admin/upload?name=a.png', { method: 'POST', body: png }, at); assert.equal(up.s, 200);
assert.equal((await j('/api/admin/upload?name=m.glb', { method: 'POST', body: Buffer.concat([Buffer.from('glTF'), Buffer.alloc(20)]) }, at)).s, 403, 'ali مش في قسم المجسمات');
assert.equal((await j('/api/admin/upload?name=m.glb', { method: 'POST', body: Buffer.concat([Buffer.from('glTF'), Buffer.alloc(20)]) }, sam.j && (await post('/api/login', { username: 'sami', password: 'secret2' })).j.token)).s, 200); ok('رفع الملفات حسب القسم (صور للإعلانات، GLB للمجسمات بس)');

const pr = await post('/api/admin/propose', { dept: 'ads', note: 'إعلان برجر', changes: { ads: [{ title: 'برجر', type: 'screen', image: up.j.url, link: 'https://example.com', slots: ['menu', 'bogus'] }], models: { ninja: { url: '/uploads/x.glb' } } } }, at);
assert.equal(pr.s, 200); const pending = (await j('/api/config')).j; assert.equal(pending.ads.length, 0, 'مش بيظهر للاعبين قبل الاعتماد'); ok('طلب المراجعة: مش بيتنشر قبل اعتماد المدير');
assert.equal((await post('/api/admin/propose', { dept: 'models', changes: { models: {} } }, at)).s, 400, 'قسم مش بتاعه');
assert.equal((await post('/api/admin/propose', { dept: 'ads', changes: { models: { ninja: { url: '/uploads/x.glb' } } } }, at)).s, 400, 'مفاتيح من قسم تاني بتتتجاهل');
const list = (await j('/api/admin/proposals?status=pending', {}, mt)).j; assert.equal(list.list.length, 1); const P = list.list[0]; assert.equal(P.byName, 'علي'); assert.deepEqual(P.keys, ['ads']); assert.equal(P.changes.ads[0].type, 'screen'); assert.deepEqual(P.changes.ads[0].slots, ['menu']); assert.equal(P.changes.models, undefined); ok('المدير: بيشوف الطلب منقّى (slots/أقسام بس)');
assert.equal((await j('/api/admin/proposals', {}, at)).j.list[0].changes, undefined, 'الموظف مايشوفش المحتوى الكامل');

const ap = await post(`/api/admin/proposals/${P.id}/approve`, { note: 'تمام' }, mt); assert.equal(ap.s, 200); const live = (await j('/api/config')).j; assert.equal(live.ads.length, 1); assert.equal(live.ads[0].type, 'screen'); assert.deepEqual(live.ads[0].slots, ['menu']); assert.equal(live.models.ninja, undefined);
assert.equal((await post(`/api/admin/proposals/${P.id}/approve`, {}, mt)).s, 400, 'مرتين'); ok('الاعتماد: بيتنشر للاعبين، ومش بيتطبق مرتين');

await post('/api/admin/propose', { dept: 'ads', changes: { ads: [] } }, at); const P2 = (await j('/api/admin/proposals?status=pending', {}, mt)).j.list[0];
assert.equal((await post(`/api/admin/proposals/${P2.id}/reject`, { note: 'لسه محتاجين الإعلان' }, mt)).s, 200); assert.equal((await j('/api/config')).j.ads.length, 1, 'الرفض ما بيغيّرش');
const mine = (await j('/api/admin/proposals', {}, at)).j.list; assert.equal(mine.find((x) => x.id === P2.id).status, 'rejected'); assert.equal(mine.find((x) => x.id === P2.id).reviewNote, 'لسه محتاجين الإعلان'); ok('الرفض: ما بيغيّرش المحتوى، والموظف بيشوف السبب');

const c1 = await post('/api/admin/propose', { dept: 'contact', changes: { contact: { whatsapp: '٠١٠٠ ١٢٣ ٤٥٦٧', message: 'اهلا' } } }, at); assert.equal(c1.s, 200);
const P3 = (await j('/api/admin/proposals?status=pending', {}, mt)).j.list[0]; assert.equal(P3.changes.contact.whatsapp, '201001234567'); await post(`/api/admin/proposals/${P3.id}/approve`, {}, mt); assert.equal((await j('/api/config')).j.contact.whatsapp, '201001234567');
// «اعتماد بعد تعديل المدير»: المدير بينشر نسخته المعدّلة بالحفظ المباشر ثم بيقفل الطلب بحالة edited (من غير ما يتطبق الأصل)
await post('/api/admin/propose', { dept: 'contact', changes: { contact: { whatsapp: '01111111111' } } }, at); const P4 = (await j('/api/admin/proposals?status=pending', {}, mt)).j.list[0]; await j('/api/admin/config', { method: 'PUT', body: JSON.stringify({ ...(await j('/api/admin/config', {}, mt)).j, contact: { whatsapp: '01222222222' } }) }, mt);
assert.equal((await post(`/api/admin/proposals/${P4.id}/edited`, { note: 'غيّرت الرقم' }, mt)).s, 200); assert.equal((await j('/api/config')).j.contact.whatsapp, '201222222222'); assert.equal((await j('/api/admin/proposals?status=edited', {}, mt)).j.list.length, 1);
assert.equal((await j('/api/admin/config', { method: 'PUT', body: JSON.stringify({ contact: { whatsapp: 'abc' } }) }, mt)).j.contact.whatsapp, ''); ok('واتساب: تنضيف الرقم (عربي/محلي/دولي) ورقم غلط بيتفضّى');

const lst = (await j('/api/admin/staff', {}, mt)).j.list; const aid = lst.find((x) => x.username === 'ali').id;
await post('/api/admin/propose', { dept: 'ads', changes: { ads: [] } }, at);
assert.equal((await j('/api/admin/staff/' + aid, { method: 'DELETE' }, mt)).s, 200); assert.equal((await post('/api/login', { username: 'ali', password: 'secret1' })).s, 401);
assert.equal((await j('/api/admin/proposals?status=pending', {}, mt)).j.list.length, 0); ok('حذف موظف: بيقفل دخوله ويلغي طلباته المستنية');
const aud = (await j('/api/admin/audit', {}, mt)).j.list; assert.ok(aud.length >= 6 && aud.some((x) => x.action === 'اعتماد طلب') && aud.some((x) => x.action === 'إضافة موظف')); ok('سجل العمليات بيتسجّل');
// صلاحية الحقول الجديدة في الحفظ المباشر
const put = await j('/api/admin/config', { method: 'PUT', body: JSON.stringify({ adSlots: { on: true, house: false, rotateMs: 100, slots: { menu: { on: false }, zzz: { on: false } } }, adContact: 'واتساب 0100', adEndpoint: 'http://insecure' }) }, mt); assert.equal(put.j.adSlots.house, false); assert.equal(put.j.adSlots.rotateMs, 3000); assert.deepEqual(put.j.adSlots.slots, { menu: { on: false } }); assert.equal(put.j.adEndpoint, ''); ok('إعدادات مساحات الإعلانات: تنقية');
console.log(`\n${n} اختبارات موظفين نجحت ✅`); server.close(); setTimeout(() => process.exit(0), 50);
