// اختبارات: شاشة التحميل (الدوال النقية) + مساحات الإعلانات خارج اللعب
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pcpSimulated, pcpMorph, pcpEase, pcpHex, pcpIgnite, pcpRig, pcpView, OCTOBER_PALETTE } from '../www/js/preloader.js';
import { createAdSlots, SLOT_NAMES } from '../www/js/adslots.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('التقدم المحاكى: بيبدأ من 0 وينتهي عند 1 ومن غير رجوع لورا', () => {
  assert.equal(pcpSimulated(0), 0); assert.equal(pcpSimulated(1), 1); let prev = 0;
  for (let i = 0; i <= 100; i++) { const v = pcpSimulated(i / 100); assert.ok(v >= prev - 1e-9); prev = v; }
});
ok('المورف: من 0 لـ4 وبيتقدم مع التحميل', () => { assert.equal(pcpMorph(0), 0); assert.equal(pcpMorph(1), 4); assert.ok(pcpMorph(0.5) > pcpMorph(0.3)); assert.equal(pcpEase(0), 0); assert.equal(pcpEase(1), 1); });
ok('الإشعال: النجمة توصل نص الشاشة والبوابة بتتفتح', () => {
  const a = pcpView(16 / 9).h, end = pcpIgnite(1, 16 / 9); assert.ok(Math.abs(end.x) < 1e-9); assert.ok(end.y > 0 && end.y < a / 2); assert.ok(end.mode > 0.99); assert.ok(end.comet < 0.01);
  const rig = pcpRig(4, 9 / 16); assert.ok(rig.zoom > 1 && Number.isFinite(rig.kv) && Number.isFinite(rig.beta)); // بورتريه (موبايل)
});
ok('الألوان: hex صحيح بيتحول وغلط بيرجّع null', () => { assert.deepEqual(pcpHex('#fff'), [1, 1, 1]); assert.equal(pcpHex('zzz'), null); for (const v of Object.values(OCTOBER_PALETTE)) assert.ok(pcpHex(v)); });

const img = 'data:image/svg+xml;utf8,%3Csvg%2F%3E';
const mk = (ads, extra = {}) => createAdSlots(() => ({ ads, ...extra }), () => '');
ok('الإعلانات: بتظهر لنوع «screen» بس، ولا تظهر إعلانات العالم (billboard)', () => {
  const s = mk([{ id: 'w', type: 'billboard', image: img }, { id: 's', type: 'screen', image: img, title: 'برجر' }]);
  const h = s.html('loading'); assert.match(h, /data-ad="s"/); assert.doesNotMatch(h, /data-ad="w"/);
});
ok('الإعلانات: فلتر المساحة والوقت والإيقاف', () => {
  const past = new Date(Date.now() - 864e5).toISOString(), future = new Date(Date.now() + 864e5).toISOString();
  const s = mk([{ id: 'm', type: 'screen', image: img, slots: ['menu'] }, { id: 'e', type: 'screen', image: img, endsAt: past }, { id: 'f', type: 'screen', image: img, startsAt: future }, { id: 'o', type: 'screen', image: img, active: false }], { adSlots: { house: false } });
  assert.match(s.html('menu'), /data-ad="m"/); assert.equal(s.html('end'), ''); assert.equal(s.html('loading'), '');
});
ok('الإعلانات: مساحة فاضية بتعرض «مساحة إعلانية» + نص التواصل، وبتتقفل من الإعدادات', () => {
  let h = mk([], { adContact: 'واتساب 0100' }).html('menu'); assert.match(h, /مساحة إعلانية/); assert.match(h, /0100/);
  assert.equal(mk([], { adSlots: { house: false } }).html('menu'), ''); assert.equal(mk([{ type: 'screen', image: img }], { adSlots: { on: false } }).html('menu'), '');
  assert.equal(mk([{ type: 'screen', image: img }], { adSlots: { slots: { pause: { on: false } } } }).html('pause'), ''); assert.ok(Object.keys(SLOT_NAMES).length === 4);
});
ok('الإعلانات: الروابط والصور الخطيرة بتتشال (XSS)', () => {
  const s = mk([{ id: 'x', type: 'screen', image: img, link: 'javascript:alert(1)', title: '"><script>x</script>' }]); const h = s.html('menu');
  assert.doesNotMatch(h, /javascript:/); assert.doesNotMatch(h, /<script>/); assert.doesNotMatch(h, /<a /);
  assert.equal(mk([{ id: 'y', type: 'screen', image: 'javascript:alert(1)' }], { adSlots: { house: false } }).html('menu'), '');
  assert.match(mk([{ id: 'z', type: 'screen', image: img, link: 'https://example.com/a?b=1&c=2' }]).html('menu'), /<a class="adbox" href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener sponsored"/);
});
ok('انحدار: تقدم التحميل عمره ما يبقى سالب حتى لو توقيت الإطار أقدم', () => {
  const src = fs.readFileSync(new URL('../www/js/preloader.js', import.meta.url), 'utf8');
  assert.match(src, /Math\.max\(0, now - baseAt\)/); assert.match(src, /shown = clamp01\(shown\)/); assert.doesNotMatch(src, /const tick = \(now\)/);
});
console.log(`\n${n} اختبارات نجحت ✅`);
