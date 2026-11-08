// الأحياء + بلوكات الجلب (File Loading Blocks): كل حي/معلم = بلوك بيانات OSM مستقل بيتحمّل لوحده.
// لازم يتحمّل بدري (بعد mapsize.js): بيضبط مركز الخريطة والجراج على الحي المختار قبل ما باقي الملفات تقراه.
// مراسي الأحياء من بيانات OSM نفسها (مدارس/مكاتب بريد/مواقف بأسماء الأحياء)؛ «هايبر وان» تقريبي لأنه مش موجود بالاسم في الملف — عدّل إحداثياته من القائمة.
import { CITY, HOME } from './config.js';

export const DEFAULT_DISTRICT = 'south';
export const BLOCK_RADIUS = 4200; // نص ضلع البلوك بالمتر (يغطي أكبر حجم خريطة)
// kind: district = حي (بيتقسم بيه الخريطة بأقرب مرساة) · landmark = معلم رئيسي
export const DISTRICTS = [
  { id: 'south', name: 'الأحياء الجنوبية', kind: 'district', lat: 29.924063, lon: 30.926437, src: 'الجراج الرئيسي — شارع 103 (الافتراضي)' },
  { id: 'd6', name: 'الحي السادس', kind: 'district', lat: 29.9453, lon: 30.9156, src: 'OSM: مكتب بريد الحي السادس' },
  { id: 'd10', name: 'الحي العاشر', kind: 'district', lat: 29.9668, lon: 30.9167, src: 'OSM: مدرسة وموقف الحي العاشر' },
  { id: 'd11', name: 'الحي الحادي عشر', kind: 'district', lat: 29.9625, lon: 30.9012, src: 'OSM: الحي الحادي عشر (٦ أكتوبر)' },
  { id: 'd2', name: 'الحي الثاني', kind: 'district', lat: 29.9605, lon: 30.9492, src: 'OSM: مدرسة الحي الثاني' },
  { id: 'hosary', name: 'مسجد الحصري والمنطقة المحيطة', kind: 'landmark', lat: 29.9748, lon: 30.9418, src: 'OSM: محطة/موقف الحصري', poi: 'مسجد الحصري' },
  { id: 'hyperone', name: 'هايبر وان — الشيخ زايد', kind: 'landmark', lat: 30.018, lon: 30.972, approx: true, src: 'إحداثيات تقريبية (مش في الملف بالاسم) — عدّلها', poi: 'هايبر وان' },
];
const KEY = 'orider-district', CKEY = 'orider-district-custom';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
const customs = () => { try { return JSON.parse(ls.get(CKEY)) || {}; } catch (e) { return {}; } };
// إحداثيات معدّلة من اللاعب بتغلّب الافتراضي
export const districtOf = (id) => { const d = DISTRICTS.find((x) => x.id === id) || DISTRICTS[0], c = customs()[d.id]; return c && Number.isFinite(c.lat) && Number.isFinite(c.lon) ? { ...d, lat: c.lat, lon: c.lon, approx: false, edited: true } : d; };
export const currentDistrictId = () => { const k = ls.get(KEY); return DISTRICTS.some((d) => d.id === k) ? k : DEFAULT_DISTRICT; };
export const currentDistrict = () => districtOf(currentDistrictId());
export function setDistrict(id) { ls.set(KEY, DISTRICTS.some((d) => d.id === id) ? id : DEFAULT_DISTRICT); location.reload(); }
export function setDistrictCoords(id, lat, lon) { const c = customs(); if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { c[id] = { lat, lon }; ls.set(CKEY, JSON.stringify(c)); return true; } return false; }
export function resetDistrictCoords(id) { const c = customs(); delete c[id]; ls.set(CKEY, JSON.stringify(c)); }

// ───── بيضبط الإعدادات العامة على الحي المختار (بيتنفّذ مرة عند التحميل) ─────
export function applyDistrict(d = currentDistrict()) {
  if (d.id === DEFAULT_DISTRICT && !d.edited) return d;
  CITY.center = { lat: d.lat, lon: d.lon }; CITY.cacheVer = CITY.cacheVer + '-d' + d.id + (d.edited ? 'e' + d.lat.toFixed(4) + d.lon.toFixed(4) : '');
  Object.assign(HOME, { lat: d.lat, lon: d.lon, plus: '', street: d.name, no: '', district: d.name, name: 'الجراج — ' + d.name, landmark: { id: 'home-' + d.id, name: d.name, mode: 'both' } });
  return d;
}
applyDistrict();

// ───── بلوكات الجلب: ملف أصغر لكل حي (data/blocks/<id>.json) بدل الملف الكبير ─────
const rad = (v) => (v * Math.PI) / 180;
export function bboxOf(lat, lon, r) { const dLat = r / 110540, dLon = r / (111320 * Math.cos(rad(lat))); return { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon }; }
const anyIn = (c, bb) => { if (typeof c[0] === 'number') return c[1] >= bb.s && c[1] <= bb.n && c[0] >= bb.w && c[0] <= bb.e; for (const x of c) if (anyIn(x, bb)) return true; return false; };
// بيقص GeoJSON (الملف الكبير) على مربع حوالين المركز
export function sliceFeatures(fc, lat, lon, r) { const bb = bboxOf(lat, lon, r); return { type: 'FeatureCollection', features: (fc.features || []).filter((f) => f.geometry && anyIn(f.geometry.coordinates, bb)) }; }
// تصنيف خدمات الحي من خصائص OSM
const SERVICE = { fuel: ['⛽', 'محطات بنزين'], hospital: ['🏥', 'مستشفيات'], pharmacy: ['💊', 'صيدليات'], school: ['🎓', 'مدارس'], mosque: ['🕌', 'مساجد'], mall: ['🛍️', 'مولات'], food: ['🍔', 'مطاعم وكافيهات'] };
export const SERVICE_LABELS = SERVICE;
export function serviceKey(p) {
  if (p.amenity === 'fuel') return 'fuel'; if (p.amenity === 'hospital' || p.amenity === 'clinic') return 'hospital'; if (p.amenity === 'pharmacy' || p.shop === 'pharmacy') return 'pharmacy';
  if (p.amenity === 'school' || p.amenity === 'university' || p.amenity === 'college') return 'school'; if (p.amenity === 'place_of_worship' || p.building === 'mosque') return 'mosque';
  if (p.shop === 'mall' || p.shop === 'supermarket') return 'mall'; if (p.amenity === 'restaurant' || p.amenity === 'cafe' || p.amenity === 'fast_food') return 'food'; return null;
}
const fcenter = (c) => { const pts = []; (function w(x) { if (typeof x[0] === 'number') pts.push(x); else for (const y of x) w(y); })(c); let la = 0, lo = 0; for (const p of pts) { la += p[1]; lo += p[0]; } return [la / pts.length, lo / pts.length]; };
// عدّاد الخدمات جوه نص قطر r حوالين المركز
export function servicesOf(fc, lat, lon, r = 1500) {
  const out = {}, bb = bboxOf(lat, lon, r);
  for (const f of fc.features || []) { const p = f.properties || {}, k = serviceKey(p); if (!k || !f.geometry) continue; const [la, lo] = fcenter(f.geometry.coordinates); if (la >= bb.s && la <= bb.n && lo >= bb.w && lo <= bb.e) out[k] = (out[k] || 0) + 1; }
  return out;
}
export const servicesText = (s) => Object.entries(SERVICE).filter(([k]) => s && s[k]).map(([k, [ic]]) => ic + ' ' + s[k]).join(' · ');
// أقرب مرساة لنقطة (قسمة الخريطة لأحياء): بترجّع الحي
export function nearestDistrict(lat, lon, list = DISTRICTS.filter((d) => d.kind === 'district')) {
  let best = null, bd = 1e18; for (const d of list) { const dx = (d.lon - lon) * 111320 * Math.cos(rad(lat)), dz = (d.lat - lat) * 110540, q = dx * dx + dz * dz; if (q < bd) { bd = q; best = d; } } return best;
}
