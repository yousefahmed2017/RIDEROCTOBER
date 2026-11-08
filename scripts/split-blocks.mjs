// بيقسّم data/osm.json (الملف الكبير) لبلوكات: data/blocks/<id>.json لكل حي/معلم + index.json (حجم + ملخص الخدمات).
// شغّله بعد أي تحديث للملف الكبير: node scripts/split-blocks.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
globalThis.localStorage = { getItem: () => null, setItem: () => {} }; globalThis.location = { reload() {} };
const { DISTRICTS, BLOCK_RADIUS, sliceFeatures, servicesOf } = await import('../www/js/districts.js');
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../www/data'), master = JSON.parse(fs.readFileSync(path.join(dir, 'osm.json'), 'utf8'));
fs.mkdirSync(path.join(dir, 'blocks'), { recursive: true }); const index = { radius: BLOCK_RADIUS, blocks: {} };
for (const d of DISTRICTS) {
  const fc = sliceFeatures(master, d.lat, d.lon, BLOCK_RADIUS), txt = JSON.stringify(fc), file = path.join(dir, 'blocks', d.id + '.json'); fs.writeFileSync(file, txt);
  index.blocks[d.id] = { name: d.name, kind: d.kind, lat: d.lat, lon: d.lon, approx: !!d.approx, bytes: Buffer.byteLength(txt), features: fc.features.length, services: servicesOf(master, d.lat, d.lon, 1500) };
  console.log(d.id.padEnd(9), String(fc.features.length).padStart(6), 'features', (Buffer.byteLength(txt) / 1e6).toFixed(2) + 'MB', JSON.stringify(index.blocks[d.id].services));
}
fs.writeFileSync(path.join(dir, 'blocks', 'index.json'), JSON.stringify(index));
console.log('✓ blocks →', path.join(dir, 'blocks'));
