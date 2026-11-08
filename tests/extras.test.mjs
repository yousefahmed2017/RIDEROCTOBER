// اختبار إضافات الجولة 3: تقييد الطلبات داخل الحدود، الويلي الطويل، ومصفوفة أحجام الخريطة.
import assert from 'node:assert/strict';
const { confineWorld, stuntTick } = await import('../www/js/extras.js');
const half = 1000, data = { pois: [{ x: 0, z: 0 }, { x: 990, z: 0 }, { x: 0, z: -950 }, { x: 800, z: 800 }, { x: 5000, z: 0 }] };
let n = 0; const roads = { randomPoint() { n++; return n % 3 ? { x: 1200 + n, z: 0 } : { x: 10, z: 20 }; } };
confineWorld(data, roads, half); assert.deepEqual(data.pois.map((p) => p.x), [0, 800]); console.log('✓ المطاعم/النقاط خارج الحدود اتشالت');
for (let i = 0; i < 100; i++) { const q = roads.randomPoint(); assert.ok(Math.abs(q.x) < half - 130 || i < 0); } console.log('✓ نقاط الطرق العشوائية جوه الحدود (100 مرة)');
const S = { bike: { speed: 20 }, wheelie: true, mode: 'delivery', wTime: 0 }; let fell = 0; for (let t = 0; t < 8; t += 0.1) stuntTick(S, 0.1, true, () => fell++);
assert.equal(fell, 1); assert.equal(S.wheelie, false); assert.ok(S.bike.speed < 10); console.log('✓ ويلي أطول من 7 ثواني = فقدان اتزان');
const S2 = { bike: { speed: 20 }, wheelie: true, mode: 'endless', wTime: 0 }; for (let t = 0; t < 10; t += 0.1) stuntTick(S2, 0.1, true, () => assert.fail('مش المفروض')); console.log('✓ وضع الطريق المفتوح ليه قواعده الخاصة');
globalThis.localStorage = { getItem: () => 'm', setItem() {} }; globalThis.location = { reload() {} };
const { MAP_SIZES, currentMapSize } = await import('../www/js/mapsize.js'); const { CITY } = await import('../www/js/config.js');
assert.equal(currentMapSize(), 'm'); assert.equal(CITY.half, MAP_SIZES.m.half); assert.ok(CITY.cacheVer.includes('-h')); console.log('✓ حجم الخريطة بيتطبق على CITY قبل التحميل');
console.log('\n5 اختبار إضافات نجحوا ✅'); process.exit(0);
