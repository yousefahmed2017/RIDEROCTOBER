// اختبارات الكباري والمنحدرات (نقي): ارتفاع، ربط الوصلات، مستويات الارتفاع، توافق مع الفهارس
import assert from 'node:assert/strict';
import { RoadIndex } from '../www/js/geo.js';
import { applyElevation, elevAtS, densify, DECK_H } from '../www/js/elevation.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const line = (x0, z0, x1, z1, k = 2) => Array.from({ length: k }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (k - 1), z: z0 + ((z1 - z0) * i) / (k - 1) }));
const mk = (pts, o = {}) => ({ pts, w: 12, rank: 4, type: 'trunk', name: '', bridge: false, layer: 0, ...o });
const build = () => { // أرضي - كوبري 400م - أرضي، ووصلة بتنزل من نص الكوبري، وطريق أرضي بيقطع تحت الكوبري
  const g1 = mk(line(-300, 0, 0, 0)), br = mk(line(0, 0, 400, 0), { bridge: true }), g2 = mk(line(400, 0, 700, 0));
  const ramp = mk(line(400, 0, 400, 300), { type: 'trunk_link' }); // وصلة بتبدأ من نهاية الكوبري التانية
  const under = mk(line(200, -200, 200, 200));
  return [g1, br, g2, ramp, under];
};
ok('densify: نقط أقرب من step وبتحافظ على الأطراف', () => { const p = densify(line(0, 0, 100, 0), 8); assert.ok(p.length >= 13); assert.equal(p[0].x, 0); assert.equal(p.at(-1).x, 100); for (let i = 0; i < p.length - 1; i++) assert.ok(Math.hypot(p[i + 1].x - p[i].x, p[i + 1].z - p[i].z) <= 8.01); });
ok('كوبري: النهايات الأرضية = 0 والنص = ارتفاع السطح', () => {
  const roads = build(); const res = applyElevation(roads); assert.equal(res.bridges, 1);
  const br = roads[1]; assert.ok(br.deck); assert.ok(br.elev[0] < 0.05); assert.ok(br.elev.at(-1) < 0.05);
  assert.ok(Math.abs(Math.max(...br.elev) - DECK_H) < 0.01, 'max=' + Math.max(...br.elev));
  assert.ok(br.elev.every((v) => v >= 0 && v <= DECK_H + 1e-6));
});
ok('منحدر ناعم: مفيش قفزة بين نقطتين أكتر من ميل 12%', () => {
  const roads = build(); applyElevation(roads); const br = roads[1];
  for (let i = 0; i < br.pts.length - 1; i++) { const d = Math.hypot(br.pts[i + 1].x - br.pts[i].x, br.pts[i + 1].z - br.pts[i].z); assert.ok(Math.abs(br.elev[i + 1] - br.elev[i]) / d < 0.12, 'ميل شديد عند ' + i); }
});
ok('الطرق الأرضية العادية متتعدّلش', () => { const roads = build(); applyElevation(roads); assert.ok(!roads[0].deck && !roads[2].deck && !roads[4].deck); assert.equal(roads[0].pts.length, 2); });
ok('وصلة من نهاية كوبري عند الأرض بتفضل عند 0 (متصلة من غير قفزة)', () => {
  const roads = build(); applyElevation(roads); assert.ok(!roads[3].deck, 'النهاية على الأرض');
});
ok('وصلة بتبدأ من نقطة مرتفعة بتنزل لحد الأرض', () => {
  const roads = [mk(line(0, 0, 100, 0)), mk(line(100, 0, 500, 0), { bridge: true }), mk(line(500, 0, 900, 0)), mk(line(300, 0, 300, 400), { type: 'trunk_link' })];
  // نقطة 300 على الكوبري هتبقى مرتفعة؛ لكن النهاية لازم تتطابق مع نقطة حقيقية في الكوبري
  roads[1].pts = [{ x: 100, z: 0 }, { x: 300, z: 0 }, { x: 500, z: 0 }]; applyElevation(roads);
  const link = roads[3]; assert.ok(link.deck, 'الوصلة لازم تتحول لمنحدر'); assert.ok(link.elev[0] > 5, 'بتبدأ من فوق: ' + link.elev[0]); assert.ok(link.elev.at(-1) < 0.05, 'وتنزل للأرض'); for (let i = 0; i < link.elev.length - 1; i++) assert.ok(link.elev[i] + 1e-6 >= link.elev[i + 1], 'نزول بس');
});
ok('نهاية برّه الخريطة: الكوبري بيكمّل مرتفع', () => {
  const roads = [mk(line(0, 0, 400, 0), { bridge: true })]; applyElevation(roads, { outside: (p) => p.x > 399 });
  assert.ok(roads[0].elev[0] < 0.05); assert.ok(roads[0].elev.at(-1) > DECK_H - 0.01, 'آخره: ' + roads[0].elev.at(-1));
});
ok('heightAt: مستوى الكوبري فوق، والأرضي تحته، حسب yRef', () => {
  const roads = build(); applyElevation(roads); const ri = new RoadIndex(roads);
  const top = ri.heightAt(200, 0, 6.5), under = ri.heightAt(200, 0, 0);
  assert.ok(top && Math.abs(top.y - DECK_H) < 0.05, 'فوق: ' + (top && top.y)); assert.ok(under && Math.abs(under.y) < 0.05 && !under.road.deck, 'تحت: ' + (under && under.y));
  assert.equal(ri.heightAt(100, 40, 6.5, -0.3), null, 'برّه الحافة ما فيهوش مستوى'); assert.equal(ri.heightAt(100, 5.9, 3, -0.3), null, 'جوه الحاجز (جنب الحافة) مفيش');
});
ok('nearestAt: تحت الكوبري بيتجاهل الكوبري', () => {
  const roads = build(); applyElevation(roads); const ri = new RoadIndex(roads);
  const q0 = ri.nearestAt(200, 0, 30, 0), q1 = ri.nearestAt(200, 0, 30, 6.5);
  assert.ok(q0 && !q0.road.deck, 'تحت = الطريق الأرضي'); assert.ok(q1 && q1.road.deck, 'فوق = الكوبري');
});
ok('randomPoint: افتراضيًا مفيش نقط على كباري (طلبات/مشاة)، والمرور يقدر', () => {
  const roads = build(); applyElevation(roads); const ri = new RoadIndex(roads); let r = 1; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  let deckHits = 0, allowHits = 0; for (let i = 0; i < 400; i++) { if (ri.randomPoint(rnd, 1).road.deck) deckHits++; if (ri.randomPoint(rnd, 1, true).road.deck) allowHits++; }
  assert.equal(deckHits, 0); assert.ok(allowHits > 20, 'مرور على الكوبري: ' + allowHits);
});
ok('elevAtS: بيطابق r.elev على النقط ويتدرّج بينها', () => {
  const roads = build(); applyElevation(roads); const ri = new RoadIndex(roads); const br = roads[1];
  assert.ok(Math.abs(elevAtS(br, br._len / 2) - DECK_H) < 0.05); assert.ok(elevAtS(br, 0) < 0.05); assert.equal(elevAtS(roads[0], 10), 0);
});
console.log(`\n${n} اختبار كباري نجحوا ✅`);
