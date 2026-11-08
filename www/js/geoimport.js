// استيراد خريطة جاهزة: ملف GeoJSON (من QGIS/overpass-turbo/geojson.io) أو Overpass JSON → نفس صيغة parseOSM.
// الاستخدام: حط الملف في www/data/osm.json — اللعبة بتلقطه أوتوماتيك قبل ما تسحب من الإنترنت.
const isGJ = (j) => j && (j.type === 'FeatureCollection' || j.type === 'Feature' || j.type === 'GeometryCollection');
export function toOverpass(json) {
  if (!isGJ(json)) return json; // Overpass جاهز
  const els = [], feats = json.type === 'FeatureCollection' ? json.features : [json]; let id = 1;
  const way = (coords, tags) => { if (coords && coords.length >= 2) els.push({ type: 'way', id: id++, tags, geometry: coords.map(([lon, lat]) => ({ lat, lon })) }); };
  for (const f of feats) {
    const g = f && f.geometry; if (!g) continue; const tags = { ...(f.properties || {}) };
    if (g.type === 'Point') els.push({ type: 'node', id: id++, lat: g.coordinates[1], lon: g.coordinates[0], tags });
    else if (g.type === 'LineString') way(g.coordinates, tags);
    else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => way(c, tags));
    else if (g.type === 'Polygon') way(g.coordinates[0], tags);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => way(p[0], tags));
  }
  return { elements: els };
}
