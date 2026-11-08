import assert from 'node:assert/strict';
import { toOverpass } from '../www/js/geoimport.js';
const gj = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { highway: 'primary', name: 'محور' }, geometry: { type: 'LineString', coordinates: [[30.9, 29.9], [30.91, 29.9]] } },
  { type: 'Feature', properties: { building: 'yes' }, geometry: { type: 'Polygon', coordinates: [[[30.9, 29.9], [30.901, 29.9], [30.901, 29.901], [30.9, 29.9]]] } },
  { type: 'Feature', properties: { name: 'صيدلية', amenity: 'pharmacy' }, geometry: { type: 'Point', coordinates: [30.9, 29.9] } }] };
const o = toOverpass(gj); assert.equal(o.elements.length, 3); assert.equal(o.elements[0].geometry[0].lat, 29.9); assert.equal(o.elements[2].type, 'node');
assert.deepEqual(toOverpass({ elements: [1] }), { elements: [1] });
console.log('✓ استيراد GeoJSON\n\n1 اختبار استيراد نجح ✅');
