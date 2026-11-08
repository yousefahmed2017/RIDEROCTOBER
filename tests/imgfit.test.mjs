// اختبارات القص وفحص الجودة (نقي)
import assert from 'node:assert/strict';
import { TARGETS, baseRect, normCrop, cropRect, checkQuality, texTransform, cleanCrop, isDefaultCrop } from '../www/js/imgfit.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

ok('أكبر مستطيل بنسبة الوجه جوه الصورة', () => {
  const b = baseRect(2000, 1000, 3); close(b.w, 2000); close(b.h, 666.6667, 1e-3);
  const c = baseRect(1000, 1000, 3); close(c.w, 1000); close(c.h, 333.3333, 1e-3);
  const d = baseRect(1000, 2000, 0.5); close(d.w, 1000); close(d.h, 2000);
});
ok('القص بيتثبّت جوه الصورة ومركزه بيتحدد', () => {
  const r = cropRect(2000, 1000, 1, { cx: 0, cy: 0, zoom: 2 }); close(r.w, 500); close(r.h, 500); close(r.x, 0); close(r.y, 0);
  const q = cropRect(2000, 1000, 1, { cx: 1, cy: 1, zoom: 4 }); close(q.x + q.w, 2000); close(q.y + q.h, 1000);
  const z = normCrop({ zoom: 99 }, 100, 100, 1); assert.equal(z.zoom, 4); assert.equal(normCrop(null, 100, 100, 1).cx, 0.5);
});
ok('الجودة: صورة كبيرة بنسبة مناسبة = good', () => {
  const q = checkQuality(1800, 600, 'billboard', null); assert.equal(q.level, 'good'); assert.equal(q.px.w, 1800);
});
ok('الجودة: صورة صغيرة = تحذير بس مش منع', () => {
  const q = checkQuality(400, 130, 'billboard', null); assert.equal(q.level, 'warn'); assert.ok(q.reasons[0].includes('أقل من المطلوب'));
});
ok('الجودة: نسبة بعيدة = تحذير', () => {
  const q = checkQuality(3000, 3000, 'billboard', null); assert.equal(q.level, 'warn'); assert.ok(q.reasons.some((r) => r.includes('بعيدة')));
});
ok('الجودة: التكبير بيصغّر البكسلات الفعلية', () => {
  assert.equal(checkQuality(1800, 600, 'billboard', null).level, 'good');
  assert.equal(checkQuality(1800, 600, 'billboard', { cx: 0.5, cy: 0.5, zoom: 3 }).level, 'warn');
});
ok('تحويل الخامة: repeat/offset', () => {
  const t = texTransform(2000, 1000, 1, { cx: 0.5, cy: 0.5, zoom: 1 }); close(t.repeat[0], 0.5); close(t.repeat[1], 1); close(t.offset[0], 0.25); close(t.offset[1], 0);
  const u = texTransform(2000, 1000, 1, { cx: 0, cy: 0, zoom: 2 }); close(u.repeat[0], 0.25); close(u.repeat[1], 0.5); close(u.offset[0], 0); close(u.offset[1], 0.5);
});
ok('تنقية القص + الافتراضي', () => {
  assert.equal(cleanCrop('x'), undefined); assert.deepEqual(cleanCrop({ cx: 2, cy: -1, zoom: 9 }), { cx: 1, cy: 0, zoom: 4 });
  assert.ok(isDefaultCrop(null)); assert.ok(isDefaultCrop({ cx: 0.5, cy: 0.5, zoom: 1 })); assert.ok(!isDefaultCrop({ cx: 0.5, cy: 0.5, zoom: 1.5 }));
  assert.ok(TARGETS.banner.h / TARGETS.banner.w > 2.5);
});
console.log(`\n${n} اختبار قص الصور نجحوا ✅`);
