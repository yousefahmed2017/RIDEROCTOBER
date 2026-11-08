// اختبارات المتجر والبنزين وأوضاع اللعب (نقي)
import assert from 'node:assert/strict';
import { BIKES, BIKE_ORDER, bikeParams, buyBike, selectBike, resolveBikeId, normalizeBike, currentBike, buyUpgrade, upgradePrice, tankSize, burnFuel, refuelStep, pumpWant, rangeKm, towFine, nearestStation, FUEL_PRICE, TOW_FINE, BURN_MULT, canBuy } from '../www/js/bikes.js';
import { newPatrol, tickPatrol, patrolReward, newEndless, stepEndless, endlessReward, HW } from '../www/js/modes.js';
import { newBike, stepBike } from '../www/js/physics.js';
import { mulberry32 } from '../www/js/geo.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const P = () => ({ money: 300, owned: { ninja: true }, bike: 'ninja', upg: {}, fuel: 14 });

ok('shop: نينجا هي المركبة الوحيدة — باقي الموتوسيكلات متعطّلة (حتى لو معاك فلوس أو حفظ قديم)', () => {
  const p = P(); p.money = 9999;
  for (const id of ['scooter', 'standard', 'sport', 'cruiser']) { assert.equal(canBuy(p, id), false, id); assert.equal(buyBike(p, id), false, id); assert.equal(selectBike(p, id), false, id); }
  assert.equal(p.money, 9999); assert.deepEqual(BIKE_ORDER, ['ninja']); assert.equal(resolveBikeId('scooter'), 'ninja'); assert.equal(resolveBikeId(undefined), 'ninja'); assert.equal(resolveBikeId('ninja'), 'ninja');
  const old = { bike: 'scooter', owned: { scooter: true }, upg: {}, fuel: 6 }; normalizeBike(old); assert.equal(old.bike, 'ninja'); assert.ok(old.owned.ninja && old.owned.scooter); assert.equal(currentBike({ bike: 'sport' }).id, 'ninja');
  assert.ok(selectBike(p, 'ninja')); assert.equal(p.bike, 'ninja');
});
ok('bikes: كل موتوسيكل أقوى/أغلى بترتيب منطقي + الباراميترات بتتأثر بالتطوير', () => {
  const prices = BIKE_ORDER.map((k) => BIKES[k].price); assert.deepEqual([...prices].sort((a, b) => a - b), prices);
  const p = P(); const base = bikeParams(p); p.money = 5000; assert.ok(buyUpgrade(p, 'engine')); assert.ok(buyUpgrade(p, 'brakes'));
  const up = bikeParams(p); assert.ok(up.maxSpeed > base.maxSpeed && up.accel > base.accel && up.brake > base.brake);
  assert.ok(buyUpgrade(p, 'tank')); assert.ok(tankSize(p) > BIKES.ninja.tank);
  for (let i = 0; i < 5; i++) buyUpgrade(p, 'engine'); assert.equal(upgradePrice(p, 'engine'), null);
});
ok('physics: النينجا سريعة (فوق 150 كم/س) وبتتأثر بالتطوير', () => {
  const top = (p) => { const b = newBike(); const params = bikeParams(p); for (let i = 0; i < 60 * 25; i++) stepBike(b, { throttle: 1, brake: 0, steer: 0 }, 1 / 60, true, params); return b.speed; };
  const t0 = top(P()); assert.ok(t0 * 3.6 > 150, 'kmh=' + t0 * 3.6); const up = { ...P(), upg: { engine: 2 } }; assert.ok(top(up) > t0 + 3);
});
ok('fuel: بيقل مع المسافة وبيزيد في المحطة بالفلوس وبيوقف عند الفلوس الناقصة', () => {
  let f = 6; for (let i = 0; i < 60 * 60; i++) f = burnFuel(f, 22, 1, 1 / 60, 0.025); assert.ok(f < 5.9 && f > 5.5, 'fuel=' + f);
  const p = P(); p.fuel = 1; p.money = 100; const r = refuelStep(p, 1); assert.ok(r.liters > 1.9 && Math.abs(r.cost - r.liters * FUEL_PRICE) < 1e-9);
  p.fuel = 13.9; const full = refuelStep(p, 5); assert.ok(p.fuel <= 14.0001); p.money = 0; p.fuel = 1; assert.ok(refuelStep(p, 1).broke);
  assert.equal(towFine(120), 120); assert.equal(towFine(9999), TOW_FINE);
  assert.equal(nearestStation([{ x: 100, z: 0 }, { x: 10, z: 10 }], 0, 0).s.x, 10);
});
ok('fuel: تانك واقعي + مدى بالتانك الكامل 35–75 كم لكل الموتوسيكلات + السرعة المستمرة بتوصّل', () => {
  for (const id of BIKE_ORDER) { const b = BIKES[id]; assert.ok(b.tank >= 6 && b.tank <= 18, id + ' tank'); const r = rangeKm(b.tank, b.burn); assert.ok(r > 35 && r < 75, id + ' range=' + r); }
  // سواق بغاز كامل 100% من الوقت بسرعة قصوى: المدى الفعلي لسه كافي لطلب 5 كم + الرجوع
  const sc = BIKES.ninja; let f = sc.tank, km = 0; while (f > 0.001 && km < 500) { f = burnFuel(f, 20, 1, 1, sc.burn); km += 0.02; } assert.ok(km > 28, 'km=' + km);
  assert.ok(BURN_MULT >= 4 && BURN_MULT <= 8);
});
ok('pump: اختيار كمية (لترات/مبلغ/ممتلئ) بيوقف عند الهدف وبيحترم الفلوس والتانك', () => {
  const p = P(); p.fuel = 1; p.money = 1000;
  assert.ok(Math.abs(pumpWant(p, { kind: 'full' }) - (tankSize(p) - 1)) < 1e-9);
  assert.ok(Math.abs(pumpWant(p, { kind: 'liters', v: 3 }, 1) - 2) < 1e-9);
  assert.ok(Math.abs(pumpWant(p, { kind: 'money', v: 60 }, 0, 12) - 4) < 1e-9);
  let filled = 0; for (let i = 0; i < 600 && pumpWant(p, { kind: 'liters', v: 3 }, filled) > 1e-6; i++) { const r = refuelStep(p, 1 / 60, 2.6, pumpWant(p, { kind: 'liters', v: 3 }, filled)); filled += r.liters; }
  assert.ok(Math.abs(filled - 3) < 1e-6 && Math.abs(p.fuel - 4) < 1e-6 && Math.abs(p.money - (1000 - 3 * FUEL_PRICE)) < 1e-6);
  p.fuel = tankSize(p) - 0.5; assert.ok(Math.abs(pumpWant(p, { kind: 'liters', v: 10 }) - 0.5) < 1e-9, 'مفيش أكتر من اللي التانك يسعه');
  p.money = 6; p.fuel = 0; const r = refuelStep(p, 10, 2.6, 5); assert.ok(Math.abs(r.liters - 0.5) < 1e-9);
});
ok('patrol: مطاردة → وقف → فحص → قبض', () => {
  const p = newPatrol(); let ev = null;
  for (let i = 0; i < 100 && ev !== 'pulledover'; i++) ev = tickPatrol(p, 0.1, 6, 10); assert.equal(ev, 'pulledover');
  for (let i = 0; i < 100 && ev !== 'caught'; i++) ev = tickPatrol(p, 0.1, 5, 0.5); assert.equal(ev, 'caught'); assert.ok(patrolReward(3, 20).money > 100);
});
ok('patrol: الهروب بالبعد أو بانتهاء الوقت', () => {
  const a = newPatrol(); assert.equal(tickPatrol(a, 0.1, 500, 20), 'escaped');
  const b = newPatrol(); let ev = null; for (let i = 0; i < 800 && !ev; i++) ev = tickPatrol(b, 0.1, 100, 20); assert.equal(ev, 'escaped');
});
ok('endless: عربيات بتظهر قدام وبتتحرك، والاصطدام بيحسب، والقرب الشديد بيدي بونص', () => {
  const st = newEndless(mulberry32(8)), bike = { x: 2, z: 0, speed: 25 }; let near = 0, crash = 0, evs = [];
  for (let i = 0; i < 60 * 60; i++) { bike.z -= bike.speed / 60; bike.x = 2 + Math.sin(i / 25) * 4; evs = stepEndless(st, bike, 1 / 60, {}); for (const e of evs) { if (e.t === 'near') near++; if (e.t === 'crash') crash++; } if (st.over) break; }
  assert.ok(st.dist > 100, 'dist=' + st.dist); assert.ok(near + crash > 0, `near=${near} crash=${crash}`); assert.ok(st.cars.every((c) => HW.lanes.includes(c.x)));
});
ok('endless: 3 اصطدامات = خلاص، الويلي بيجيب نقط وبيقع لو طوّل', () => {
  const st = newEndless(mulberry32(1)), bike = { x: 0, z: 0, speed: 20 };
  for (let i = 0; i < 3; i++) { st.cars.push({ lane: 2, x: 0, z: bike.z, v: 5, kind: 'car', color: 0, minLat: 0, passed: false, hit: false }); stepEndless(st, bike, 0.016, {}); }
  assert.ok(st.over && st.crashes === 3);
  const w = newEndless(mulberry32(2)), b2 = { x: 0, z: 0, speed: 20 }; let fell = false, stunt = false;
  for (let i = 0; i < 60; i++) { b2.z -= 0.3; for (const e of stepEndless(w, b2, 1 / 30, { wheelie: i < 50 })) { if (e.t === 'stunt') stunt = true; } }
  assert.ok(stunt && w.stunts === 1 && w.score > 20);
  const w2 = newEndless(mulberry32(3)), b3 = { x: 0, z: 0, speed: 20 };
  for (let i = 0; i < 400 && !fell; i++) { b3.z -= 0.3; for (const e of stepEndless(w2, b3, 1 / 30, { wheelie: true })) if (e.t === 'wheelieFall') fell = true; }
  assert.ok(fell); assert.ok(endlessReward(w).money >= 0);
});
console.log(`\n${n} اختبار نجح ✅`);
