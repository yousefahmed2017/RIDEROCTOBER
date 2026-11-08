// اختبار دخان لبناء العالم بـ Three.js الحقيقي (من غير متصفح) — بيستخدم كانفاس وهمي.
// تشغيل: npm i --no-save three@0.160.0 && node tests/world.smoke.mjs
import assert from 'node:assert/strict';

const noop = () => {};
const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => ctx), set: () => true });
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  createElementNS: () => ({ addEventListener: noop, removeEventListener: noop, style: {} }),
};
globalThis.window = globalThis;

const THREE = await import('three');
const { makeSkyDome } = await import('../www/js/textures.js');
const { buildWorld, makeBike, makeVehicle, makeLabel, makeBeacon, makeStars, skyFor, makeGarage, makeStation, makeRamp, buildHighway } = await import('../www/js/world.js');
const { proceduralCity, BuildingIndex } = await import('../www/js/geo.js');

const data = proceduralCity(1000, 7); data.half = 1000;
const scene = new THREE.Scene();
const w = buildWorld(scene, data, new BuildingIndex(data.buildings));
w.setNight(1);
const meshes = []; scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes.push(o); });
const tris = meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
console.log(`الميشات: ${meshes.length} · المثلثات: ${Math.round(tris)}`);
assert.ok(meshes.length >= 6 && tris > 3000);
for (const m of meshes) for (const a of Object.values(m.geometry.attributes)) assert.ok(![...a.array.slice(0, 3000)].some(Number.isNaN), 'NaN في ' + m.type);

const bike = makeBike(0x19c2a0); assert.ok(bike.group && bike.lean && bike.front && bike.rear);
let tinted = 0; bike.group.traverse((o) => { if (o.userData.tint) tinted++; }); assert.ok(tinted >= 3, "tinted=" + tinted);
for (const k of ['car', 'tuktuk', 'bus']) assert.ok(makeVehicle(k, 2).children.length >= 4, k);
assert.ok(makeLabel('كابتن 123', 0xff7a1a).isSprite);
const beacon = makeBeacon(0xff7a1a); beacon.userData.tick(1.2); assert.equal(beacon.visible, false);
assert.ok(makeStars().isPoints);
assert.ok(makeSkyDome().material.uniforms.top.value.isColor);
for (const h of [0, 5.5, 7, 12, 17.9, 19.5, 23]) { const s = skyFor(h); assert.ok(s.night >= 0 && s.night <= 1 && s.sky.isColor && s.sunDir.length() > 0.99); }
for (const st of ['ninja', 'scooter', 'standard', 'sport', 'cruiser']) { const b = makeBike(0xff7a1a, st); assert.ok(b.fork && b.pitch && b.front && b.rear, st); let n = 0; b.group.traverse((o) => { if (o.isMesh) n++; }); assert.ok(n > 60, st + ' meshes=' + n); }
assert.ok(makeGarage('كابتن', 0xff7a1a, true).children.length > 5); assert.ok(makeStation('محطة', 12).children.length > 10);
assert.ok(makeRamp({ x: 0, z: 0, nx: 1, nz: 0 }, 5).children.length === 1);
const hw = buildHighway(scene); hw.setNight(1); assert.ok(hw.group.children.length > 6);
console.log('✅ العالم اتبنى بنجاح (طرق، مباني، نخيل، إنارة، موتوسيكل، عربيات، سماء)');
