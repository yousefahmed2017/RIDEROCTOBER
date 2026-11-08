// اختبارات: الأحياء وبلوكات الجلب
import assert from 'node:assert/strict';
import fs from 'node:fs';
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }; globalThis.location = { reload() { store.__reloaded = 1; } };
const { CITY, HOME } = await import('../www/js/config.js'); const home0 = { ...HOME }, ver0 = CITY.cacheVer, c0 = { ...CITY.center };
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };
const D = await import('../www/js/districts.js');

ok('القائمة: معرّفات فريدة، إحداثيات جوه منطقة 6 أكتوبر/الشيخ زايد، الافتراضي موجود', () => {
  const ids = D.DISTRICTS.map((d) => d.id); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.includes(D.DEFAULT_DISTRICT));
  for (const d of D.DISTRICTS) { assert.ok(d.lat > 29.85 && d.lat < 30.1 && d.lon > 30.8 && d.lon < 31.1, d.id); assert.ok(['district', 'landmark'].includes(d.kind)); assert.ok(d.name && d.src); }
  for (const id of ['d2', 'd6', 'd10', 'd11', 'hosary', 'hyperone']) assert.ok(ids.includes(id), id);
  assert.equal(D.DISTRICTS.find((d) => d.id === 'hyperone').approx, true);
});
ok('الافتراضي (الأحياء الجنوبية): الإعدادات ما بتتغيّرش', () => {
  assert.equal(D.currentDistrictId(), 'south'); assert.deepEqual(CITY.center, c0); assert.equal(CITY.cacheVer, ver0); assert.deepEqual({ ...HOME }, home0);
});
ok('اختيار حي: setDistrict بيحفظ ويعمل reload، وغلط بيرجع للافتراضي', () => {
  D.setDistrict('d11'); assert.equal(store['orider-district'], 'd11'); assert.equal(store.__reloaded, 1); assert.equal(D.currentDistrictId(), 'd11'); D.setDistrict('nonsense'); assert.equal(D.currentDistrictId(), 'south');
});
ok('applyDistrict: بيحرّك مركز الخريطة والجراج والكاش للحي', () => {
  const d = D.districtOf('d11'); D.applyDistrict(d);
  assert.deepEqual(CITY.center, { lat: d.lat, lon: d.lon }); assert.match(CITY.cacheVer, /-dd11$/); assert.equal(HOME.district, 'الحي الحادي عشر'); assert.ok(HOME.landmark && HOME.landmark.id === 'home-d11');
  Object.assign(HOME, home0); CITY.center = { ...c0 }; CITY.cacheVer = ver0;
});
ok('إحداثيات معدّلة: بتغلّب الافتراضي وبتتشال بالريسيت، وقيم غلط بتترفض', () => {
  assert.equal(D.setDistrictCoords('hyperone', 99, 31), false); assert.equal(D.setDistrictCoords('hyperone', 30.02, 30.99), true);
  const e = D.districtOf('hyperone'); assert.equal(e.lat, 30.02); assert.equal(e.edited, true); assert.equal(e.approx, false); D.resetDistrictCoords('hyperone'); assert.equal(D.districtOf('hyperone').approx, true);
});
const master = JSON.parse(fs.readFileSync(new URL('../www/data/osm.json', import.meta.url), 'utf8'));
ok('القص: بلوك الحي فيه شوارع ومباني، وكل عنصر جوه المربع، ومكان بعيد شبه فاضي', () => {
  const d = D.districtOf('d11'), fc = D.sliceFeatures(master, d.lat, d.lon, 2000), bb = D.bboxOf(d.lat, d.lon, 2000);
  assert.ok(fc.features.length > 2000); const inside = (c) => (typeof c[0] === 'number' ? c[1] >= bb.s && c[1] <= bb.n && c[0] >= bb.w && c[0] <= bb.e : c.some(inside)); assert.ok(fc.features.every((f) => inside(f.geometry.coordinates)));
  assert.ok(fc.features.some((f) => f.properties.highway) && fc.features.some((f) => f.properties.building)); assert.ok(D.sliceFeatures(master, 30.2, 31.3, 2000).features.length < 5);
});
ok('الخدمات: العدّ من خصائص OSM وبيطابق index.json المولّد', () => {
  const idx = JSON.parse(fs.readFileSync(new URL('../www/data/blocks/index.json', import.meta.url), 'utf8'));
  for (const d of D.DISTRICTS) { const s = D.servicesOf(master, d.lat, d.lon, 1500); assert.deepEqual(s, idx.blocks[d.id].services, d.id); }
  assert.ok(idx.blocks.d2.services.hospital >= 1 && idx.blocks.hosary.services.mosque >= 1); assert.match(D.servicesText({ fuel: 2, food: 5 }), /⛽ 2 · 🍔 5/); assert.equal(D.serviceKey({ amenity: 'cafe' }), 'food'); assert.equal(D.serviceKey({ highway: 'primary' }), null);
});
ok('بلوكات الجلب: ملف لكل حي موجود وصالح ومتّسق مع index.json', () => {
  const idx = JSON.parse(fs.readFileSync(new URL('../www/data/blocks/index.json', import.meta.url), 'utf8'));
  for (const d of D.DISTRICTS) { const f = new URL(`../www/data/blocks/${d.id}.json`, import.meta.url), j = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(j.type, 'FeatureCollection'); assert.equal(j.features.length, idx.blocks[d.id].features); assert.equal(fs.statSync(f).size, idx.blocks[d.id].bytes); }
  assert.ok(idx.blocks.hyperone.features < 400, 'هايبر وان برّه الملف المدمج: لازم يتسحب من النت');
});
ok('قسمة الخريطة: كل نقطة بتتنسب لأقرب مرساة حي', () => {
  for (const d of D.DISTRICTS.filter((x) => x.kind === 'district')) assert.equal(D.nearestDistrict(d.lat, d.lon).id, d.id);
  assert.equal(D.nearestDistrict(29.9669, 30.9150).id, 'd10'); assert.equal(D.nearestDistrict(29.9455, 30.9150).id, 'd6');
});
console.log(`\n${n} اختبارات أحياء نجحت ✅`);
