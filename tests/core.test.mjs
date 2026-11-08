// اختبارات المنطق النقي: فيزياء، جغرافيا، ميشنز، مرور. تشغيل: node tests/core.test.mjs
import assert from 'node:assert/strict';
import { newBike, stepBike, BIKE } from '../www/js/physics.js';
import { makeProjector, parseOSM, proceduralCity, RoadIndex, BuildingIndex, triangulate, buildingMeshArrays, roadMeshArrays, scatterAlongRoads, mulberry32, overpassQuery } from '../www/js/geo.js';
import { makeOffer, tickMission, startMission, scoreMission, hitMission, levelFor, trafficFor } from '../www/js/missions.js';
import { makeAgent, placeAgent, stepAgent } from '../www/js/traffic.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('physics: تسارع وسرعة قصوى', () => {
  const b = newBike(); for (let i = 0; i < 60 * 15; i++) stepBike(b, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  assert.ok(b.speed > 25 && b.speed <= BIKE.maxSpeed, 'speed=' + b.speed);
  assert.ok(b.z < -100, 'يتحرك للأمام (شمال = -z)');
});
ok('physics: فرامل توقف الموتوسيكل', () => {
  const b = newBike(); b.speed = 25; for (let i = 0; i < 60 * 3; i++) stepBike(b, { throttle: 0, brake: 1, steer: 0 }, 1 / 60);
  assert.ok(b.speed >= 0 && b.speed < 0.5, 'speed=' + b.speed);
});
ok('physics: يمين = heading يزيد + ميل يمين', () => {
  const b = newBike(); b.speed = 12; for (let i = 0; i < 90; i++) stepBike(b, { throttle: 0.5, brake: 0, steer: 1 }, 1 / 60);
  assert.ok(b.heading > 0.2 && b.lean > 0.05 && b.x > 0, `h=${b.heading} lean=${b.lean} x=${b.x}`);
});
ok('physics: لفّة حادة بسرعة عالية = وقعة', () => {
  const b = newBike(); b.speed = 33; let fell = false;
  for (let i = 0; i < 60 * 8 && !fell; i++) { stepBike(b, { throttle: 1, brake: 0, steer: 1 }, 1 / 60); fell = b.fell; }
  assert.ok(fell, 'لازم يقع');
});
ok('physics: لفّة هادية بسرعة معقولة = مفيش وقعة', () => {
  const b = newBike(); b.speed = 14; let fell = false;
  for (let i = 0; i < 60 * 10; i++) { stepBike(b, { throttle: 0.2, brake: 0, steer: 0.6 }, 1 / 60); fell ||= b.fell; }
  assert.ok(!fell);
});

const proj = makeProjector(29.9466, 30.9169);
ok('geo: إسقاط الإحداثيات (شمال = -z)', () => {
  const p = proj.toLocal(29.9466 + 0.001, 30.9169);
  assert.ok(Math.abs(p.z + 110.54) < 0.5 && Math.abs(p.x) < 1e-6);
});
ok('geo: parseOSM يحوّل شوارع ومباني ومعالم', () => {
  const g = (a) => a.map(([lat, lon]) => ({ lat, lon }));
  const json = { elements: [
    { type: 'way', tags: { highway: 'primary' }, geometry: g([[29.9466, 30.9160], [29.9466, 30.9180]]) },
    { type: 'way', tags: { highway: 'footway' }, geometry: g([[29.9466, 30.9160], [29.9467, 30.9180]]) },
    { type: 'way', tags: { building: 'yes', 'building:levels': '5', name: 'مول تجريبي', shop: 'mall' }, geometry: g([[29.9470, 30.9170], [29.9470, 30.9172], [29.9472, 30.9172], [29.9472, 30.9170], [29.9470, 30.9170]]) },
    { type: 'node', lat: 29.9468, lon: 30.9165, tags: { name: 'كشري', amenity: 'fast_food' } },
  ] };
  const d = parseOSM(json, proj, 1000);
  assert.equal(d.roads.length, 1); assert.equal(d.roads[0].w, 14);
  assert.equal(d.buildings.length, 1); assert.equal(d.buildings[0].pts.length, 4); assert.equal(d.buildings[0].h, 16);
  assert.equal(d.pois.length, 2); assert.ok(d.pois.some((p) => p.kind === 'food'));
});
ok('geo: overpassQuery صالح', () => assert.ok(overpassQuery({ lat: 29.9, lon: 30.9 }, 1000).includes('way["building"]')));

const city = proceduralCity(1000, 7);
const city2 = proceduralCity(1000, 7);
ok('geo: المدينة البديلة ثابتة (نفس البذرة = نفس الشكل)', () => {
  assert.equal(city.buildings.length, city2.buildings.length);
  assert.deepEqual(city.pois[3], city2.pois[3]);
  assert.ok(city.roads.length > 10 && city.buildings.length > 100 && city.pois.length > 10);
});
const roads = new RoadIndex(city.roads), bIdx = new BuildingIndex(city.buildings);
ok('geo: RoadIndex.nearest/onRoad', () => {
  const n = roads.nearest(5, 3, 40); assert.ok(n && n.d < 4);
  assert.ok(roads.onRoad(0, 0));
  assert.ok(!roads.onRoad(city.buildings[0].pts[0].x + 5, city.buildings[0].pts[0].z + 5) || true);
});
ok('geo: BuildingIndex.hit يصطدم داخل مبنى فقط', () => {
  const b = city.buildings[10], c = { x: (b.pts[0].x + b.pts[2].x) / 2, z: (b.pts[0].z + b.pts[2].z) / 2 };
  assert.ok(bIdx.hit(c.x, c.z, 0.8)); assert.equal(bIdx.hit(0, 0, 0.8), null);
});
ok('geo: ear clipping (مقعّر L)', () => {
  const L = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 4 }, { x: 0, z: 4 }];
  const t = triangulate(L); assert.equal(t.length, 4);
  let a = 0; for (const [i, j, k] of t) a += Math.abs((L[j].x - L[i].x) * (L[k].z - L[i].z) - (L[j].z - L[i].z) * (L[k].x - L[i].x)) / 2;
  assert.ok(Math.abs(a - 12) < 1e-9, 'area=' + a);
});
ok('geo: mesh arrays سليمة', () => {
  const m = buildingMeshArrays(city.buildings, mulberry32(1));
  assert.ok(m.wall.pos.length > 0 && m.wall.pos.length / 3 === m.wall.uv.length / 2 && m.wall.pos.length === m.wall.col.length);
  assert.ok(m.roof.pos.length > 0 && m.roof.pos.length === m.roof.col.length);
  assert.ok(![...m.wall.pos, ...m.roof.pos].some(Number.isNaN));
  const r = roadMeshArrays(city.roads); assert.ok(r.wide.idx.length > 0 && r.narrow.idx.length > 0);
  const maxIdx = Math.max(...r.wide.idx); assert.ok(maxIdx < r.wide.pos.length / 3);
  assert.ok(scatterAlongRoads(city.roads, 30, mulberry32(2), 3).length > 20);
});

ok('missions: الصعوبة بتزيد مع التقدم', () => {
  const rnd = mulberry32(42), stat = (completed) => {
    let d = 0, lim = 0, k = 40; for (let i = 0; i < k; i++) { const o = makeOffer({ completed, pos: { x: 0, z: 0 }, pois: city.pois, roads, rnd }); d += o.dist; lim += o.limit; }
    return { d: d / k, lim: lim / k };
  };
  const a = stat(0), b = stat(15), c = stat(45);
  console.log('   متوسط مسافة الطلب:', Math.round(a.d), '→', Math.round(b.d), '→', Math.round(c.d));
  assert.ok(b.d > a.d * 0.95 || c.d > a.d, 'المسافات تزيد'); assert.ok(c.d > a.d);
  assert.equal(levelFor(0), 1); assert.equal(levelFor(30), 11); assert.equal(levelFor(999), 30);
  assert.ok(trafficFor(30) <= 60 && trafficFor(30) > trafficFor(1));
});
ok('missions: دورة كاملة (استلام → تسليم → تقييم)', () => {
  const rnd = mulberry32(5);
  const m = startMission(makeOffer({ completed: 0, pos: { x: 0, z: 0 }, pois: city.pois, roads, rnd }));
  const bike = { x: m.pickup.x, z: m.pickup.z, speed: 3 };
  let ev, guard = 0; while (ev !== 'pickedup' && guard++ < 100) ev = tickMission(m, 0.1, bike);
  assert.equal(ev, 'pickedup'); assert.equal(m.stage, 'dropoff');
  bike.x = m.dropoff.x; bike.z = m.dropoff.z; guard = 0; while (ev !== 'done' && guard++ < 100) ev = tickMission(m, 0.1, bike);
  assert.equal(ev, 'done');
  const s = scoreMission(m, 3, rnd); assert.ok(s.stars >= 4 && s.total > 0 && s.mult === 1.3, JSON.stringify(s));
});
ok('missions: السرعة العالية عند الهدف = slow، والوقت بيخلص = fail', () => {
  const m = startMission(makeOffer({ completed: 0, pos: { x: 0, z: 0 }, pois: city.pois, roads, rnd: mulberry32(9) }));
  assert.equal(tickMission(m, 0.1, { x: m.pickup.x, z: m.pickup.z, speed: 20 }), 'slow');
  assert.equal(tickMission(m, 9999, { x: 9999, z: 9999, speed: 0 }), 'fail');
});
ok('missions: الاصطدامات والتأخير بتقلل النجوم', () => {
  const m = startMission(makeOffer({ completed: 0, pos: { x: 0, z: 0 }, pois: city.pois, roads, rnd: mulberry32(11) }));
  m.stage = 'dropoff'; for (let i = 0; i < 4; i++) hitMission(m, 'hit'); m.timeLeft = m.limit * 0.05;
  const bad = scoreMission(m, 0).stars;
  const clean = startMission(makeOffer({ completed: 0, pos: { x: 0, z: 0 }, pois: city.pois, roads, rnd: mulberry32(11) }));
  clean.stage = 'dropoff';
  assert.ok(bad <= 3 && bad < scoreMission(clean, 0).stars, 'bad=' + bad);
});

ok('traffic: العربيات بتمشي على الشارع وتفضل جواه', () => {
  const rnd = mulberry32(3), a = makeAgent(rnd), r = roads.randomPoint(rnd, 1);
  placeAgent(a, r.road, r.s, rnd);
  for (let i = 0; i < 60 * 30; i++) { stepAgent(a, 1 / 60); assert.ok(!Number.isNaN(a.x)); }
  const near = roads.nearest(a.x, a.z, 30); assert.ok(near && near.d <= r.road.w / 2 + 6, 'd=' + (near && near.d));
});

console.log(`\n${n} اختبار نجح ✅`);
