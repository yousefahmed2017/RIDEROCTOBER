// اختبار رسائل اللعب: الافتراضي، التعديل من الإدارة، الإيقاف، المتغيرات، التنقية، وحفظها على السيرفر.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { MSGS, resolveMessage, normalizeMessages, DEFAULTS } from '../www/js/messages.js';

const core = (r) => ({ text: r.text, cls: r.cls, ms: r.ms });
assert.deepEqual(core(resolveMessage(undefined, 'hitCar')), { text: 'اتخبطت في عربية!', cls: 'bad', ms: DEFAULTS.ms }); console.log('✓ الافتراضي لما مفيش إعدادات');
assert.equal(resolveMessage({}, 'nope'), null);
const cfg = { on: true, ms: 4000, items: { hitCar: { text: 'تصادم يا بطل!', cls: 'good', ms: 6000 }, fall: { on: false }, towed: { text: 'غرامة {n} ج' } } };
assert.deepEqual(core(resolveMessage(cfg, 'hitCar')), { text: 'تصادم يا بطل!', cls: 'good', ms: 6000 });
assert.equal(resolveMessage(cfg, 'fall'), null);
assert.equal(resolveMessage(cfg, 'towed', { n: 250 }).text, 'غرامة 250 ج');
assert.equal(resolveMessage(cfg, 'hitPed').ms, 4000); console.log('✓ تعديل النص/النوع/المدة وإيقاف رسالة');
assert.equal(resolveMessage({ on: false }, 'hitCar'), null); console.log('✓ إيقاف كل الرسائل');
const n = normalizeMessages({ ms: 99999, max: 50, pos: 'xx', items: { hitCar: { text: 'x'.repeat(500), cls: 'evil' }, bogus: { on: false }, fall: { text: MSGS.fall.text } } });
assert.equal(n.ms, 15000); assert.equal(n.max, 8); assert.equal(n.pos, 'under'); assert.equal(n.items.hitCar.text.length, 140); assert.ok(!('cls' in n.items.hitCar)); assert.ok(!n.items.bogus && !n.items.fall); console.log('✓ التنقية');
for (const [k, m] of Object.entries(MSGS)) for (const v of (m.text.match(/\{(\w+)\}/g) || [])) assert.ok(m.vars.includes(v.slice(1, -1)), k + ' متغير غير معلن ' + v);
console.log('✓ كل متغيرات النصوص معلنة');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orider-msg-'));
process.env.DATA_DIR = dir; process.env.ADMIN_PASSWORD = 'test-pass-1'; process.env.PORT = '0';
const { server } = await import('../server/server.mjs');
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
const base = 'http://127.0.0.1:' + server.address().port;
const { token } = await (await fetch(base + '/api/login', { method: 'POST', body: JSON.stringify({ password: 'test-pass-1' }) })).json();
const put = await fetch(base + '/api/admin/config', { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ messages: { ms: 5000, items: { hitCar: { text: 'تصادم!' }, fall: { on: false } } } }) });
assert.equal(put.status, 200);
const pub = await (await fetch(base + '/api/config')).json();
assert.equal(pub.messages.ms, 5000); assert.equal(pub.messages.items.hitCar.text, 'تصادم!'); assert.equal(pub.messages.items.fall.on, false); console.log('✓ الرسائل بتتحفظ على السيرفر واللاعبين بيقروها');
console.log('\n8 اختبار رسائل نجحوا ✅'); server.close(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);

const sp = resolveMessage(undefined, 'hitCar'); assert.equal(sp.speak, 'اتخبطت في عربية!'); assert.equal(resolveMessage(undefined, 'join').speak, ''); assert.equal(resolveMessage({ speech: { on: false } }, 'hitCar').speak, ''); assert.equal(resolveMessage({ items: { join: { speak: true } } }, 'join').speak.length > 0, true); console.log('✓ النطق: افتراضي/تعطيل/تفعيل رسالة');
