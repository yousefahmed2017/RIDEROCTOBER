// اختبارات الأرصفة والمباني والجراجات والمحطات (نقي)
import assert from 'node:assert/strict';
import { proceduralCity, RoadIndex, BuildingIndex, SIDEWALK_W, KERB_H, roadMeshArrays, mulberry32 } from '../www/js/geo.js';
import { sidewalkMeshArrays, infillBuildings, placeSites, garageFor, makeStations, hash32, dropBuildingsOnRoads, overlapsRoad } from '../www/js/city.js';
import { makeOffer, retimeOffer } from '../www/js/missions.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const city = proceduralCity(1000, 7), ri = new RoadIndex(city.roads), bIdx = new BuildingIndex(city.buildings);

ok('roads: كل مثلثات الأسفلت بتبص لفوق', () => {
  const m = roadMeshArrays(city.roads); let bad = 0;
  for (const g of [m.wide, m.narrow]) for (let i = 0; i < g.idx.length; i += 3) {
    const [a, b, c] = [g.idx[i], g.idx[i + 1], g.idx[i + 2]], p = g.pos;
    const ux = p[b * 3] - p[a * 3], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vz = p[c * 3 + 2] - p[a * 3 + 2];
    if (uz * vx - ux * vz <= 0) bad++;
  }
  assert.equal(bad, 0, 'مثلثات مقلوبة: ' + bad);
});
ok('surface: أسفلت / رصيف / بعد الرصيف', () => {
  const r = city.roads.find((x) => x.type === 'trunk'), hw = r.w / 2, z0 = r.pts[0].z;
  assert.equal(ri.surface(40, z0, SIDEWALK_W).s, 0);
  assert.equal(ri.surface(40, z0 + hw + 1, SIDEWALK_W).s, 1);
  assert.equal(ri.surface(40, z0 + hw + SIDEWALK_W + 3, SIDEWALK_W).s, 2);
});
ok('sidewalk: أرصفة مرتفعة وبتبص لفوق وحجر الرصيف ناحية الشارع', () => {
  const sw = sidewalkMeshArrays(city.roads, ri);
  assert.ok(sw.top.idx.length > 600 && sw.curb.idx.length > 600);
  assert.ok(Math.abs(Math.max(...sw.top.pos.filter((_, i) => i % 3 === 1)) - KERB_H) < 1e-6);
  let bad = 0; const p = sw.top.pos;
  for (let i = 0; i < sw.top.idx.length; i += 3) { const [a, b, c] = [sw.top.idx[i], sw.top.idx[i + 1], sw.top.idx[i + 2]]; const ux = p[b * 3] - p[a * 3], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vz = p[c * 3 + 2] - p[a * 3 + 2]; if (uz * vx - ux * vz <= 0) bad++; }
  assert.equal(bad, 0);
  assert.ok(![...sw.top.pos, ...sw.curb.pos, ...sw.curb.nor].some(Number.isNaN));
});
ok('sidewalk: مفيش رصيف جوه التقاطعات', () => {
  const sw = sidewalkMeshArrays(city.roads, ri); let inside = 0;
  for (let i = 0; i < sw.top.pos.length; i += 12) { const x = (sw.top.pos[i] + sw.top.pos[i + 9]) / 2, z = (sw.top.pos[i + 2] + sw.top.pos[i + 11]) / 2; if (ri.surface(x, z).s === 0) inside++; }
  assert.ok(inside <= 3, 'رصيف جوه أسفلت: ' + inside);
});
ok('infill: مباني بعد الرصيف ومن غير تداخل', () => {
  const inf = infillBuildings(city.roads, ri, bIdx, mulberry32(3), { max: 400 });
  assert.ok(inf.length > 20, 'عدد=' + inf.length);
  for (const b of inf.slice(0, 80)) { assert.equal(b.pts.length, 4); for (const p of b.pts) assert.ok(ri.surface(p.x, p.z).s === 2, 'جوه رصيف/أسفلت'); }
  const again = infillBuildings(city.roads, ri, bIdx, mulberry32(3), { max: 400 });
  assert.equal(inf.length, again.length, 'ثابتة بنفس البذرة');
});
ok('garage: نفس id = نفس الجراج، وids مختلفة بتتوزع', () => {
  const slots = placeSites(city.roads, ri, bIdx, { spacing: 120, minRank: 1 });
  assert.ok(slots.length >= 8, 'slots=' + slots.length);
  assert.deepEqual(garageFor(slots, 'abc123').index, garageFor(slots, 'abc123').index);
  const idxs = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => garageFor(slots, id).index)); assert.ok(idxs.size >= 4);
  const g = slots[0]; assert.equal(ri.surface(g.bx, g.bz).s, 2);
  assert.notEqual(hash32('x'), hash32('y'));
});
ok('stations: لحد 18 محطة وأقرب محطة بتتلاقي', () => {
  const st = makeStations(city.pois, city.roads, ri, bIdx, 12);
  assert.ok(st.length >= 3 && st.length <= 18, 'stations=' + st.length);
  const real = makeStations([{ x: 30, z: 40, name: 'محطة وطنية', kind: 'fuel' }], city.roads, ri, bIdx, 2);
  assert.ok(real[0].real && real[0].name === 'محطة وطنية');
});
ok('stations: عدد كبير موزع على الخريطة (حتى 100) ومفيش اتنين فوق بعض', () => {
  const st = makeStations(city.pois, city.roads, ri, bIdx, 100);
  assert.ok(st.length > 40 && st.length <= 100, 'stations=' + st.length);
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) assert.ok(Math.hypot(st[i].x - st[j].x, st[i].z - st[j].z) > 30, 'محطتين قريبين قوي');
  assert.deepEqual(makeStations(city.pois, city.roads, ri, bIdx, 100).map((s) => [s.x, s.z]), st.map((s) => [s.x, s.z]), 'لازم نفس النتيجة عند كل اللاعبين');
});
ok('buildings: مبنى فوق الأسفلت بيتشال والمبنى البعيد بيفضل', () => {
  const r = city.roads.find((x) => x.type === 'trunk'), p = r.pts[0], hw = r.w / 2;
  const onRoad = { pts: [{ x: p.x + 20, z: p.z - 4 }, { x: p.x + 30, z: p.z - 4 }, { x: p.x + 30, z: p.z + 4 }, { x: p.x + 20, z: p.z + 4 }], h: 10 };
  const far = { pts: [{ x: p.x + 20, z: p.z + hw + 40 }, { x: p.x + 30, z: p.z + hw + 40 }, { x: p.x + 30, z: p.z + hw + 50 }, { x: p.x + 20, z: p.z + hw + 50 }], h: 10 };
  assert.ok(overlapsRoad(onRoad, ri) && !overlapsRoad(far, ri));
  const res = dropBuildingsOnRoads([onRoad, far], ri); assert.equal(res.dropped, 1); assert.equal(res.keep[0], far);
});
ok('offers: retimeOffer بيحسب الوقت من مكان الموتوسيكل وقت القبول', () => {
  const o = makeOffer({ completed: 5, pos: { x: 0, z: 0 }, pois: city.pois, roads: ri, rnd: mulberry32(3) });
  const near = retimeOffer({ ...o }, o.pickup), far = retimeOffer({ ...o }, { x: o.pickup.x + 600, z: o.pickup.z });
  assert.ok(far.limit > near.limit && far.timeLeft === far.limit && near.limit >= 35);
});
console.log(`\n${n} اختبار نجح ✅`);
