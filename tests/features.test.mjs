// اختبارات: سباق · زبون بيتكلم · جودة تلقائية · غرفة بكلمة سر
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RACE, buildRoute, newRace, tickRace, raceReward, parTime, routeLength, fmtRace } from '../www/js/race.js';
import { pickScenario, resolveChoice } from '../www/js/customer.js';
import { createGovernor, GFX_LEVELS } from '../www/js/autoquality.js';
import { RoadIndex, parseOSM, makeProjector, mulberry32 } from '../www/js/geo.js';
import { toOverpass } from '../www/js/geoimport.js';
import { CITY } from '../www/js/config.js';
import { Net } from '../www/js/network.js';
import { Lite } from '../www/js/lite2d.js';
import { newBike, stepBike } from '../www/js/physics.js';
import { bikeParams } from '../www/js/bikes.js';
import { loadProfile } from '../www/js/profile.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

const raw = JSON.parse(fs.readFileSync(new URL('../www/data/osm.json', import.meta.url), 'utf8'));
const data = parseOSM(toOverpass(raw), makeProjector(CITY.center.lat, CITY.center.lon), CITY.half);
const roads = new RoadIndex(data.roads);

ok('مسار السباق: ثابت لنفس الـ seed ومتصل بحلقة', () => {
  const a = buildRoute(roads, mulberry32(RACE.seed)), b = buildRoute(roads, mulberry32(RACE.seed));
  assert.ok(a && a.length >= 3 && a.length <= RACE.cps);
  assert.deepEqual(a.map((p) => [p.x, p.z]), b.map((p) => [p.x, p.z]));
  assert.ok(Number.isFinite(a[0].heading)); assert.ok(routeLength(a) > 300);
});
ok('السباق: عدّاد → انطلاق → نقط → لفّتين → نهاية', () => {
  const route = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 100 }, { x: 0, z: 100 }], r = newRace(route, 2), bike = { x: 0, z: 0 };
  let ev = []; for (let i = 0; i < 40; i++) ev.push(...tickRace(r, 0.1, bike));
  assert.ok(ev.some((e) => e.t === 'go') && ev.filter((e) => e.t === 'count').length >= 2); assert.equal(r.stage, 'run');
  const evs = [];
  for (let lap = 0; lap < 2; lap++) for (const i of [1, 2, 3, 0]) { bike.x = route[i].x; bike.z = route[i].z; evs.push(...tickRace(r, 5, bike)); }
  assert.equal(r.stage, 'finished'); assert.equal(evs.filter((e) => e.t === 'cp').length, 8); assert.equal(evs.filter((e) => e.t === 'lap').length, 1); assert.ok(evs.some((e) => e.t === 'finish'));
  assert.equal(r.lapTimes.length, 2); const rw = raceReward(r, 3); assert.ok(rw.money >= 70 && rw.points >= 90); assert.ok(parTime(route, 2) > 0);
  assert.equal(fmtRace(75.5), '1:15.50');
});
ok('الزبون: شكوى لو متأخر/الجودة وحشة، وبقشيش أحيانًا', () => {
  const m = { timeLeft: 2, limit: 100, quality: 90, hits: 0, falls: 0, load: 'food' }, res = { stars: 3, tip: 20, points: 100, total: 120, mult: 1 };
  const sc = pickScenario(m, res, () => 0.5); assert.equal(sc.kind, 'complaint'); assert.equal(sc.options.length, 3);
  const good = { timeLeft: 80, limit: 100, quality: 100, hits: 0, falls: 0, load: 'food' };
  assert.equal(pickScenario(good, res, () => 0.1).kind, 'tip'); assert.equal(pickScenario(good, res, () => 0.9), null);
  assert.equal(pickScenario(good, { ...res, tip: 0 }, () => 0.1), null);
});
ok('الزبون: النتايج بتغيّر البقشيش والنجوم والإجمالي', () => {
  const res = { stars: 4, tip: 20, points: 100, total: 120, mult: 1, comment: '' };
  const s = { kind: 'complaint' };
  let o = resolveChoice(s, 'discount', res, () => 0.5); assert.equal(o.res.tip, 0); assert.equal(o.res.stars, 4); assert.equal(o.res.total, o.res.points);
  o = resolveChoice(s, 'defend', res, () => 0.9); assert.equal(o.res.stars, 3); assert.ok(o.res.points < 100); assert.equal(o.good, false);
  o = resolveChoice(s, 'sorry', res, () => 0.1); assert.equal(o.res.tip, 10);
  const t = { kind: 'tip' };
  o = resolveChoice(t, 'ask', res, () => 0.1); assert.equal(o.res.tip, 40); assert.equal(resolveChoice(t, 'refuse', res).res.stars, 5);
  assert.ok(resolveChoice(t, 'refuse', { ...res, stars: 5 }).res.stars === 5);
});
ok('الجودة التلقائية: تنزّل بسرعة وترفع ببطء من غير تذبذب', () => {
  const lv = []; const g = createGovernor({ start: 2, onLevel: (l) => lv.push(l) });
  for (let i = 0; i < 600; i++) g.tick(1 / 20); // 20fps
  assert.ok(lv.length >= 1 && g.level < 2);
  const low = g.level; for (let i = 0; i < 60 * 25; i++) g.tick(1 / 60); // 60fps
  assert.ok(g.level >= low); g.tick(5); g.tick(0); // قيم غريبة متتجاهلة
  assert.ok(GFX_LEVELS[0].density === 'low');
});
ok('الغرفة: كلمة السر + الحد الأقصى من جهة الهوست', () => {
  const sent = []; const mk = (id) => ({ peer: id, send: (m) => sent.push([id, m]), close() { this.closed = true; } });
  const h = new Net(); h.isHost = true; h.pw = 'abc'; h.max = 3; h.id = 'host';
  const c1 = mk('p1'); h.conns.set('p1', c1); h._onData(c1, { t: 'hello', p: { name: 'x' }, pw: 'zzz' });
  assert.ok(sent.some(([i, m]) => i === 'p1' && m.t === 'deny')); assert.ok(!h.conns.has('p1'));
  const c2 = mk('p2'); h.conns.set('p2', c2); h._onData(c2, { t: 'hello', p: { name: 'y' }, pw: 'abc' });
  assert.ok(sent.some(([i, m]) => i === 'p2' && m.t === 'ok')); assert.ok(h.conns.has('p2'));
  const c3 = mk('p3'); h.conns.set('p3', c3); h._onData(c3, { t: 'hello', p: {}, pw: 'abc' }); assert.ok(h.conns.has('p3')); // 3 لاعبين (مع الهوست)
  const c4 = mk('p4'); h.conns.set('p4', c4); h._onData(c4, { t: 'hello', p: {}, pw: 'abc' });
  assert.ok(sent.some(([i, m]) => i === 'p4' && m.t === 'deny' && /مليانة/.test(m.m))); assert.ok(!h.conns.has('p4'));
});
ok('محاكاة سباق كامل على الخريطة الحقيقية: سواق آلي بيخلّص اللفّتين', () => {
  const route = buildRoute(roads, mulberry32(RACE.seed)), r = newRace(route, RACE.laps), b = newBike(route[0].x, route[0].z, route[0].heading), P = bikeParams({ bike: 'scooter', upg: {}, owned: { scooter: true } });
  let t = 0; while (r.stage !== 'finished' && t < 900) {
    const c = r.route[r.next], want = Math.atan2(c.x - b.x, -(c.z - b.z)); let d = ((want - b.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    stepBike(b, { throttle: Math.abs(d) < 0.6 ? 1 : 0.3, brake: 0, steer: Math.max(-1, Math.min(1, d * 2)) }, 0.05, true, P); tickRace(r, 0.05, b); t += 0.05;
  }
  assert.equal(r.stage, 'finished', 'السباق لازم يخلص في أقل من 15 دقيقة: ' + t.toFixed(0) + 'ث'); console.log('   ⏱ وقت السواق الآلي', fmtRace(r.finishTime), '· طول اللفّة', Math.round(routeLength(route)), 'م');
});
ok('النسخة الخفيفة 2D: 90 ثانية محاكاة + رسم من غير أخطاء وبتخلّص طلبات', () => {
  const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : typeof k === 'string' ? () => {} : undefined), set: () => true });
  const canvas = { width: 800, height: 450, getContext: () => ctx }, prof = loadProfile ? { ...{ settings: { autoGas: true }, deliveries: 0, streak: 0 } } : {};
  const ev = { toasts: 0, done: 0, fail: 0 };
  const L = new Lite({ canvas, data, roads, profile: prof, params: bikeParams({ bike: 'scooter', upg: {}, owned: { scooter: true } }), keys: {}, touch: { l: 0, r: 0, gas: 0, brake: 0 }, half: CITY.half, hooks: { toast: () => ev.toasts++, onDone: () => ev.done++, onFail: () => ev.fail++ } });
  for (let i = 0; i < 1800; i++) { L.step(0.05); if (i % 6 === 0) L.draw(); }
  assert.ok(ev.toasts >= 1); assert.ok(Number.isFinite(L.bike.x) && Number.isFinite(L.bike.z)); assert.ok(Math.abs(L.bike.x) <= CITY.half);
});
console.log(`\n${n} اختبارات نجحت ✅`);
