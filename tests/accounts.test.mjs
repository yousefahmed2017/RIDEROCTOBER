// اختبار الحسابات: تسجيل برقم هاتف، دخول، حفظ التقدم، كلمة سر غلط، إعادة ضبط من الإدارة، معلومات الواتساب.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orider-acc-'));
process.env.DATA_DIR = dir; process.env.ADMIN_PASSWORD = 'test-pass-1'; process.env.PORT = '0';
const { server } = await import('../server/server.mjs');
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
const base = 'http://127.0.0.1:' + server.address().port;
const j = async (p, o = {}) => { const r = await fetch(base + p, { ...o, body: o.body && typeof o.body !== 'string' && !Buffer.isBuffer(o.body) ? JSON.stringify(o.body) : o.body }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const post = (p, b, h = {}) => j(p, { method: 'POST', headers: h, body: b });
const { normPhone } = await import('../server/accounts.mjs');
assert.equal(normPhone('01012345678'), '+201012345678'); assert.equal(normPhone('٠١٠١٢٣٤٥٦٧٨'), '+201012345678'); assert.equal(normPhone('12'), ''); console.log('✓ توحيد رقم الهاتف');

let r = await post('/api/auth/register', { phone: '01012345678', password: '123', name: 'سيد' }); assert.equal(r.s, 400); console.log('✓ كلمة سر قصيرة مرفوضة');
r = await post('/api/auth/register', { phone: '01012345678', password: 'secret1', name: 'سيد', progress: { points: 500, deliveries: 3, money: 900, evil: 'x', bike: 'scooter' } });
assert.equal(r.s, 200); assert.ok(r.j.token); assert.equal(r.j.progress.points, 500); assert.equal(r.j.progress.evil, undefined); console.log('✓ تسجيل + رفع تقدم الضيف');
const tok = r.j.token, H = { Authorization: 'Bearer ' + tok };
assert.equal((await post('/api/auth/register', { phone: '+201012345678', password: 'secret1' })).s, 409); console.log('✓ الرقم المكرر مرفوض');
assert.equal((await post('/api/auth/login', { phone: '01012345678', password: 'wrong!!' })).s, 401); console.log('✓ كلمة سر غلط بتترفض');
r = await post('/api/auth/login', { phone: '01012345678', password: 'secret1' }); assert.equal(r.s, 200); assert.equal(r.j.progress.deliveries, 3); console.log('✓ دخول وإرجاع التقدم');
assert.equal((await j('/api/progress')).s, 401); console.log('✓ التقدم مقفول بدون توكن');
assert.equal((await j('/api/progress', { method: 'PUT', headers: { Authorization: 'Bearer x.y' }, body: { points: 1 } })).s, 401); console.log('✓ توكن مزيف مرفوض');
r = await j('/api/progress', { method: 'PUT', headers: H, body: { progress: { points: 1200, deliveries: 9, name: 'سيد الأسطى', owned: { scooter: true, cb: true } } } }); assert.equal(r.s, 200);
r = await j('/api/auth/me', { headers: H }); assert.equal(r.j.progress.points, 1200); assert.equal(r.j.progress.owned.cb, true); assert.equal(r.j.player.name, 'سيد الأسطى'); console.log('✓ حفظ التقدم وقراءته');
assert.equal((await post('/api/auth/password', { oldPassword: 'x', newPassword: 'newpass1' }, H)).s, 401);
assert.equal((await post('/api/auth/password', { oldPassword: 'secret1', newPassword: 'newpass1' }, H)).s, 200);
assert.equal((await post('/api/auth/login', { phone: '01012345678', password: 'newpass1' })).s, 200); console.log('✓ تغيير كلمة السر');

// الإدارة
assert.equal((await j('/api/admin/players')).s, 401);
const { j: { token: at } } = await post('/api/login', { password: 'test-pass-1' }); const AH = { Authorization: 'Bearer ' + at };
const list = await j('/api/admin/players', { headers: AH }); assert.equal(list.j.length, 1); assert.equal(list.j[0].points, 1200); console.log('✓ قائمة اللاعبين للإدارة');
const rp = await post('/api/admin/players/' + list.j[0].id + '/reset-password', { password: 'Reset123' }, AH); assert.equal(rp.j.password, 'Reset123');
assert.equal((await post('/api/auth/login', { phone: '01012345678', password: 'Reset123' })).s, 200); assert.equal((await post('/api/auth/login', { phone: '01012345678', password: 'newpass1' })).s, 401); console.log('✓ إعادة ضبط كلمة السر من الإدارة');
const inf = await j('/api/admin/info', { method: 'PUT', headers: AH, body: { gameName: 'لعبتنا', developer: 'م. يوسف', whatsapp: '+20 100 000 0000', operators: [{ name: 'أحمد', role: 'مشغّل', whatsapp: '01000000001' }], googleClientId: 'abc.apps.googleusercontent.com' } });
assert.equal(inf.j.whatsapp, '201000000000'); const pi = await j('/api/info'); assert.equal(pi.j.developer, 'م. يوسف'); assert.equal(pi.j.operators.length, 1); assert.equal(pi.j.googleClientId, 'abc.apps.googleusercontent.com'); console.log('✓ بيانات اللعبة والمطور والمشغّلين (واتساب)');
assert.equal((await post('/api/auth/google', { credential: 'fake' })).s, 400); console.log('✓ توكن جوجل مزيف مرفوض');
const lb = await j('/api/leaderboard'); assert.equal(lb.j[0].points, 1200); console.log('✓ لوحة الصدارة');
// يعيش بعد إعادة التحميل؟ التوكن موقّع بمفتاح محفوظ
assert.ok(fs.existsSync(path.join(dir, 'secret.key')) && fs.existsSync(path.join(dir, 'players.json')));
assert.equal((await j('/api/admin/players/' + list.j[0].id, { method: 'DELETE', headers: AH })).s, 200); assert.equal((await j('/api/admin/players', { headers: AH })).j.length, 0); console.log('✓ حذف لاعب');
console.log('\n14 اختبار حسابات نجحوا ✅'); server.close(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);
