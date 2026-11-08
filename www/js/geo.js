// جغرافيا وبيانات الخريطة (نقي، بدون DOM): OSM → عالم محلي بالمتر + مدينة بديلة + فهارس تصادم.
export const ROAD_W = { motorway: 18, trunk: 16, primary: 14, secondary: 11, tertiary: 9, unclassified: 7, residential: 7, living_street: 5, service: 4 };
export const SIDEWALK_W = 2.8, KERB_H = 0.2;
export const ROAD_RANK = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, unclassified: 1, residential: 1, living_street: 0, service: 0 };

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeProjector(lat0, lon0) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), kz = 110540;
  return { toLocal: (lat, lon) => ({ x: (lon - lon0) * kx, z: -(lat - lat0) * kz }), toGeo: (x, z) => ({ lat: lat0 - z / kz, lon: lon0 + x / kx }) };
}

export function overpassQuery(c, half) {
  const dLat = half / 110540, dLon = half / (111320 * Math.cos((c.lat * Math.PI) / 180));
  const bb = [c.lat - dLat, c.lon - dLon, c.lat + dLat, c.lon + dLon].map((v) => v.toFixed(6)).join(',');
  const hw = '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$';
  const am = '^(restaurant|fast_food|cafe|pharmacy|hospital|university|college|school|place_of_worship|bank|clinic|fuel)$';
  return `[out:json][timeout:45];(way["highway"~"${hw}"](${bb});way["building"](${bb});node["name"]["amenity"~"${am}"](${bb});node["name"]["shop"~"^(mall|supermarket|bakery|pharmacy|convenience|clothes|mobile_phone)$"](${bb});node["place"~"^(suburb|neighbourhood|quarter|village|town|hamlet|locality)$"]["name"](${bb}););out geom;`;
}

export const centroid = (pts) => {
  let x = 0, z = 0; for (const p of pts) { x += p.x; z += p.z; }
  return { x: x / pts.length, z: z / pts.length };
};

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function classify(t) {
  const a = t.amenity, s = t.shop; if (a === 'fuel') return 'fuel';
  if (a === 'restaurant' || a === 'fast_food' || a === 'cafe' || s === 'bakery') return 'food';
  if (s || a === 'pharmacy' || a === 'bank') return 'shop';
  return 'place';
}

export function parseOSM(json, proj, half = 1000) {
  const roads = [], buildings = [], pois = [], places = [];
  const inside = (p) => Math.abs(p.x) < half && Math.abs(p.z) < half;
  const addPoi = (p, t) => { if (inside(p)) pois.push({ x: p.x, z: p.z, name: t['name:ar'] || t.name, kind: classify(t), ...(t.amenity === 'pharmacy' || t.shop === 'pharmacy' ? { sub: 'pharmacy' } : {}) }); };
  for (const el of json.elements || []) {
    const t = el.tags || {};
    if (el.type === 'node') {
      if (t.place && t.name && el.lat != null) { const q = proj.toLocal(el.lat, el.lon); places.push({ x: q.x, z: q.z, name: t['name:ar'] || t.name, kind: t.place }); continue; }
      if (t.name && el.lat != null) addPoi(proj.toLocal(el.lat, el.lon), t); continue;
    }
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    let pts = el.geometry.map((g) => proj.toLocal(g.lat, g.lon));
    if (t.highway) {
      const key = t.highway.replace('_link', '');
      if (!(key in ROAD_W)) continue;
      if (t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage') continue; // الأنفاق مش بتتعرض على السطح
      if (!pts.some((p) => Math.abs(p.x) < half + 80 && Math.abs(p.z) < half + 80)) continue; // خارج حدود الخريطة
      const oneway = t.oneway === 'yes' || t.oneway === '1' || t.junction === 'roundabout', lanes = parseInt(t.lanes, 10) || 0, wTag = parseFloat(String(t.width || '').replace(',', '.')) || 0;
      let w = ROAD_W[key] * (t.highway.endsWith('_link') ? 0.7 : 1);
      if (wTag >= 3) w = wTag; // العرض الحقيقي من OSM
      else if (lanes) w = lanes * 3.3 + (oneway ? 0.8 : 1.4); // حارات فعلية
      else if (oneway && key !== 'service' && key !== 'living_street') w *= 0.66; // اتجاه واحد = عرض أقل
      w = Math.max(3.6, Math.min(28, w));
      roads.push({ osm: t.i || (el.id != null ? 'way/' + el.id : ''), name: t['name:ar'] || t.name || '', ref: t.ref || '', pts, type: key, w, lanes, oneway, bridge: !!(t.bridge && t.bridge !== 'no'), layer: parseInt(t.layer, 10) || 0, rank: ROAD_RANK[key] });
    } else if (t.building && pts.length >= 4) {
      const f = pts[0], l = pts[pts.length - 1];
      if (Math.hypot(f.x - l.x, f.z - l.z) < 0.05) pts = pts.slice(0, -1);
      if (pts.length < 3) continue;
      const c = centroid(pts);
      if (!inside(c)) continue;
      const levels = parseInt(t['building:levels'], 10) || 0;
      const h = parseFloat(t.height) || (levels || 3 + (Math.abs(Math.floor(c.x * 7 + c.z * 13)) % 6)) * 3.2;
      buildings.push({ pts, h: Math.min(h, 90) });
      if (t.name) addPoi(c, t);
    }
  }
  return { roads, buildings, pois, places, source: 'osm' };
}

// مدينة بديلة (لو مفيش نت): شبكة شوارع بمحور مركزي واسع، بذرة ثابتة عشان كل اللاعبين يشوفوا نفس الشكل.
const FOOD = ['مطعم الشيف حسن', 'كشري التحرير', 'فطاطري أكتوبر', 'بيتزا الواحة', 'كافيه الحصري', 'شاورما الأمير', 'مشويات أبو السيد', 'برجر ستيشن'];
const SHOP = ['صيدلية العزبي', 'مول أكتوبر', 'سوبر ماركت المنصورية', 'بنك مصر'];
const PLACE = ['جامعة أكتوبر', 'مسجد الحصري', 'مدرسة النيل', 'مستشفى الشيخ زايد'];
export function proceduralCity(half = 1000, seed = 7) {
  const rnd = mulberry32(seed), roads = [], buildings = [], pois = [];
  const step = 160, xs = [], zs = [];
  const K = Math.floor(half / step);
  for (let k = -K; k <= K; k++) { xs.push(k * step); zs.push(k * step); }
  const typeOf = (k, centerLine) => (centerLine ? 'trunk' : k % 3 === 0 ? 'secondary' : 'residential');
  const STREETS = ['شارع الحصري', 'شارع النخيل', 'شارع الجامعة', 'شارع الأمل', 'شارع الواحات', 'شارع الصفا', 'شارع السلام', 'شارع الأشجار', 'شارع المنصورية', 'شارع الياسمين', 'شارع الورود', 'شارع النصر'];
  zs.forEach((g, i) => { const t = typeOf(i - K, i === K); roads.push({ name: i === K ? 'المحور المركزي' : STREETS[i % STREETS.length], pts: [{ x: -half, z: g }, { x: half, z: g }], type: t, w: ROAD_W[t], rank: ROAD_RANK[t] }); });
  xs.forEach((g, i) => { const t = typeOf(i - K, false); roads.push({ name: STREETS[(i + 5) % STREETS.length], pts: [{ x: g, z: -half }, { x: g, z: half }], type: t, w: ROAD_W[t], rank: ROAD_RANK[t] }); });
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i] + 16, x1 = xs[i + 1] - 16, z0 = zs[j] + 16, z1 = zs[j + 1] - 16;
    if (x1 - x0 < 30) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const [ax, bx] of [[x0, mx - 3], [mx + 3, x1]]) for (const [az, bz] of [[z0, mz - 3], [mz + 3, z1]]) {
      if (rnd() < 0.18) continue;
      const w = bx - ax, d = bz - az, fx = ax + w * (0.05 + rnd() * 0.1), fz = az + d * (0.05 + rnd() * 0.1);
      const ex = bx - w * rnd() * 0.1, ez = bz - d * rnd() * 0.1;
      const h = (3 + Math.floor(rnd() * 8)) * 3.2;
      buildings.push({ pts: [{ x: fx, z: fz }, { x: ex, z: fz }, { x: ex, z: ez }, { x: fx, z: ez }], h });
    }
    const r = rnd();
    if (r < 0.28) pois.push({ x: mx, z: z0 - 8, name: pick(FOOD), kind: 'food' });
    else if (r < 0.4) { const nm = pick(SHOP); pois.push({ x: mx, z: z1 + 8, name: nm, kind: 'shop', ...(/صيدل/.test(nm) ? { sub: 'pharmacy' } : {}) }); }
    else if (r < 0.46) pois.push({ x: x0 - 8, z: mz, name: pick(PLACE), kind: 'place' });
  }
  return { roads, buildings, pois, places: [{ x: 0, z: 0, name: 'الأحياء الجنوبية', kind: 'suburb' }], source: 'procedural' };
}

// ───── فهرس الشوارع (أقرب شارع، أماكن عشوائية) ─────
export class RoadIndex {
  constructor(roads, cell = 50) {
    this.cell = cell; this.map = new Map(); this.roads = roads; this.cum = [];
    let total = 0; this.weights = [];
    roads.forEach((r, ri) => {
      const cum = [0];
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        cum.push(cum[i] + Math.hypot(b.x - a.x, b.z - a.z));
        const x0 = Math.min(a.x, b.x) - r.w, x1 = Math.max(a.x, b.x) + r.w, z0 = Math.min(a.z, b.z) - r.w, z1 = Math.max(a.z, b.z) + r.w;
        for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cz = Math.floor(z0 / cell); cz <= Math.floor(z1 / cell); cz++) {
          const k = cx + ',' + cz; let l = this.map.get(k); if (!l) this.map.set(k, (l = []));
          l.push({ ri, i });
        }
      }
      r._cum = cum; r._len = cum[cum.length - 1];
      total += r._len; this.weights.push(total);
    });
    this.total = total;
  }
  nearest(x, z, maxD = 40, ex = null) {
    const c = this.cell, R = Math.ceil(maxD / c), cx0 = Math.floor(x / c), cz0 = Math.floor(z / c);
    let best = null;
    for (let cx = cx0 - R; cx <= cx0 + R; cx++) for (let cz = cz0 - R; cz <= cz0 + R; cz++) {
      const l = this.map.get(cx + ',' + cz); if (!l) continue;
      for (const s of l) {
        const r = this.roads[s.ri]; if (ex && (r === ex || (ex.has && ex.has(r)))) continue; const a = r.pts[s.i], b = r.pts[s.i + 1];
        const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
        const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) best = { d, x: px, z: pz, road: r, i: s.i, t, hx: dx, hz: dz };
      }
    }
    return best && best.d <= maxD ? best : null;
  }
  // سطح النقطة: 0 = أسفلت، 1 = رصيف مرتفع (بيصد)، 2 = بعد الرصيف. margin = أقرب مسافة من حافة أي أسفلت.
  surface(x, z, sw = SIDEWALK_W) {
    const c = this.cell, cx0 = Math.floor(x / c), cz0 = Math.floor(z / c); let mAll = 1e9, mSw = 1e9;
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
      const l = this.map.get(cx + ',' + cz); if (!l) continue;
      for (const s of l) {
        const r = this.roads[s.ri], a = r.pts[s.i], b = r.pts[s.i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)), d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)), m = d - r.w / 2;
        if (m < mAll) mAll = m; if (r.rank >= 1 && m < mSw) mSw = m;
      }
    }
    if (mAll <= 0.15) return { s: 0, m: mAll };
    return { s: mSw <= sw ? 1 : 2, m: mAll };
  }
  // ───── مستويات الكباري: أقرب مستوى طريق (أرضي أو كوبري) لارتفاع yRef. tol = هامش عن حافة الأسفلت (سالب = جوّه أكتر).
  heightAt(x, z, yRef = 0, tol = 0.4) {
    const c = this.cell, cx0 = Math.floor(x / c), cz0 = Math.floor(z / c); let best = null;
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
      const l = this.map.get(cx + ',' + cz); if (!l) continue;
      for (const s of l) {
        const r = this.roads[s.ri], a = r.pts[s.i], b = r.pts[s.i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)), d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
        if (d > r.w / 2 + tol) continue;
        const h = r.elev ? r.elev[s.i] + (r.elev[s.i + 1] - r.elev[s.i]) * t : 0, sc = Math.abs(h - yRef);
        if (!best || sc < best.score - 0.01 || (Math.abs(sc - best.score) <= 0.01 && d < best.d)) best = { y: h, d, road: r, score: sc };
      }
    }
    return best;
  }
  // زي nearest بس بيتجاهل الطرق اللي ارتفاعها عند النقطة بعيد عن yRef (عشان اللي تحت الكوبري ما يتلخبطش بالكوبري)
  nearestAt(x, z, maxD = 40, yRef = 0, ex = null) {
    const c = this.cell, R = Math.ceil(maxD / c), cx0 = Math.floor(x / c), cz0 = Math.floor(z / c);
    let best = null;
    for (let cx = cx0 - R; cx <= cx0 + R; cx++) for (let cz = cz0 - R; cz <= cz0 + R; cz++) {
      const l = this.map.get(cx + ',' + cz); if (!l) continue;
      for (const s of l) {
        const r = this.roads[s.ri]; if (ex && (r === ex || (ex.has && ex.has(r)))) continue; const a = r.pts[s.i], b = r.pts[s.i + 1];
        const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
        const h = r.elev ? r.elev[s.i] + (r.elev[s.i + 1] - r.elev[s.i]) * t : 0; if (Math.abs(h - yRef) > 2.6) continue;
        const px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) best = { d, x: px, z: pz, road: r, i: s.i, t, hx: dx, hz: dz, y: h };
      }
    }
    return best && best.d <= maxD ? best : null;
  }
  onRoad(x, z) { const n = this.nearest(x, z, 25); return !!n && n.d <= n.road.w / 2 + 1.2; }
  // نقطة عشوائية على شارع (موزونة بالطول)، تتجنب الخدمية لو minRank>0
  randomPoint(rnd, minRank = 0, allowDeck = false) { // allowDeck: المرور بس يسمح له بالكباري (الطلبات والمشاة لأ)
    for (let k = 0; k < 30; k++) {
      const v = rnd() * this.total;
      let lo = 0, hi = this.weights.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (this.weights[m] < v) lo = m + 1; else hi = m; }
      const r = this.roads[lo]; if (r.rank < minRank || r._len < 20 || (r.deck && !allowDeck)) continue;
      const s = rnd() * r._len; let i = 0; while (i < r._cum.length - 2 && r._cum[i + 1] < s) i++;
      const a = r.pts[i], b = r.pts[i + 1], t = (s - r._cum[i]) / (r._cum[i + 1] - r._cum[i] || 1);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, road: r, s, i };
    }
    const r = this.roads[0]; return { x: r.pts[0].x, z: r.pts[0].z, road: r, s: 0, i: 0 };
  }
}

// ───── فهرس المباني (تصادم) ─────
export class BuildingIndex {
  constructor(buildings, cell = 60) {
    this.cell = cell; this.map = new Map();
    buildings.forEach((b) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of b.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      b.bb = [x0, z0, x1, z1];
      for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cz = Math.floor(z0 / cell); cz <= Math.floor(z1 / cell); cz++) {
        const k = cx + ',' + cz; let l = this.map.get(k); if (!l) this.map.set(k, (l = []));
        l.push(b);
      }
    });
  }
  hit(x, z, r = 0.8) {
    const l = this.map.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell)); if (!l) return null;
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    for (const b of l) {
      const bb = b.bb; if (x < bb[0] - r || x > bb[2] + r || z < bb[1] - r || z > bb[3] + r) continue;
      for (const [ox, oz] of pts) if (pointInPoly(x + ox, z + oz, b.pts)) return b;
    }
    return null;
  }
}

// ───── تقسيم مثلثات (Ear clipping) للأسطح ─────
const crossZ = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function inTri(p, a, b, c) {
  const d1 = crossZ(a, b, p), d2 = crossZ(b, c, p), d3 = crossZ(c, a, p);
  return d1 >= 0 && d2 >= 0 && d3 >= 0;
}
export function triangulate(pts) {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.z - b.x * a.z; }
  const idx = [...Array(n).keys()]; if (area < 0) idx.reverse();
  const tris = []; let guard = 0;
  while (idx.length > 3 && guard++ < 4000) {
    let found = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (crossZ(pts[a], pts[b], pts[c]) <= 1e-9) continue;
      let bad = false;
      for (const j of idx) { if (j === a || j === b || j === c) continue; if (inTri(pts[j], pts[a], pts[b], pts[c])) { bad = true; break; } }
      if (bad) continue;
      tris.push([a, b, c]); idx.splice(i, 1); found = true; break;
    }
    if (!found) { for (let i = 1; i < idx.length - 1; i++) tris.push([idx[0], idx[i], idx[i + 1]]); return tris; }
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// ───── بيانات الميش (مصفوفات typed) ─────
const lin = (h) => { const c = [(h >> 16) & 255, (h >> 8) & 255, h & 255].map((v) => Math.pow(v / 255, 2.2)); return c; };
// ألوان واجهات أكتوبر الحقيقية: بيج/رملي (الغالب) · أبيض مكسور · أصفر باهت · سلموني/تراكوتا · رمادي أسمنت · أزرق رمادي (أبراج) · طوب أحمر على الطوب (مبانٍ لسه ما اتبيّضتش)
const WALLS = [
  { c: 0xe6d7b8, w: 22 }, { c: 0xd9c7a1, w: 14 }, { c: 0xcdb48a, w: 8 }, { c: 0xe9e1d0, w: 14 }, { c: 0xf1ece0, w: 8 },
  { c: 0xe8d8a0, w: 6 }, { c: 0xe2b99a, w: 7 }, { c: 0xc9805a, w: 4 }, { c: 0xb9b2a4, w: 7 }, { c: 0x9aa6b0, w: 4, tall: true }, { c: 0xb35a3c, w: 5, brick: true },
].map((o) => ({ ...o, lin: lin(o.c) }));
const pickWall = (rnd, h) => { let tot = 0; const ok = WALLS.filter((o) => (!o.tall || h > 22) && (!o.brick || h < 26)); for (const o of ok) tot += o.w; let r = rnd() * tot; for (const o of ok) { r -= o.w; if (r <= 0) return o; } return ok[0]; };
export const wallShade = (h, rnd) => pickWall(rnd, h);

// أنماط واجهات: 0 = متولدة عامة، 1 = رمادي/بني برشة خشنة (صور الحي السادس)، 2 = بيج بشبابيك مقوّسة. بتتوزع بالقرب من مركز اللعب أكتر.
export const FACADE_STYLES = 3;
const hash2 = (x, z) => (Math.imul(Math.floor(x * 13) ^ 0x9e37, 2654435761) ^ Math.imul(Math.floor(z * 7) ^ 0x85eb, 2246822519)) >>> 0;
export function assignFacadeStyles(buildings) {
  for (const b of buildings) {
    if (b.st !== undefined) continue;
    if (b.h < 9 || b.h > 32) { b.st = 0; continue; }
    const c = centroid(b.pts), r = hash2(c.x, c.z) / 4294967296, near = Math.hypot(c.x, c.z) < 2200, p = near ? 0.4 : 0.2;
    b.st = r < p ? 1 : r < 2 * p ? 2 : 0;
  }
}

export function buildingMeshArrays(buildings, rnd = Math.random) {
  assignFacadeStyles(buildings);
  const walls = Array.from({ length: FACADE_STYLES }, () => ({ wp: [], wu: [], wc: [] })), rp = [], rc = [];
  for (const b of buildings) {
    const st = b.st || 0, W = walls[st], wp = W.wp, wu = W.wu, wc = W.wc;
    const o = st ? { lin: [1, 1, 1], brick: false } : pickWall(rnd, b.h), base = o.lin, k = st ? 0.9 + rnd() * 0.18 : 0.88 + rnd() * 0.24, uvs = 0.85 + rnd() * 0.35, uoff = rnd() * 4, vs = o.brick ? 5.2 : 6.4;
    const col = [base[0] * k, base[1] * k, base[2] * k], dirt = [col[0] * 0.62, col[1] * 0.6, col[2] * 0.58], rcol = st ? [0.42 * k, 0.4 * k, 0.37 * k] : [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
    const n = b.pts.length; let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = b.pts[i], c = b.pts[(i + 1) % n], len = Math.hypot(c.x - a.x, c.z - a.z);
      if (len < 0.01) continue;
      const u0 = acc / (6 * uvs) + uoff, u1 = (acc + len) / (6 * uvs) + uoff, v1 = b.h / vs; acc += len;
      wp.push(a.x, 0, a.z, c.x, 0, c.z, c.x, b.h, c.z, a.x, 0, a.z, c.x, b.h, c.z, a.x, b.h, a.z);
      wu.push(u0, 0, u1, 0, u1, v1, u0, 0, u1, v1, u0, v1);
      const sh = 0.93 + ((i * 37) % 7) * 0.012; // كل حيطة درجة مختلفة شوية (إضاءة/طلاء)
      for (let q = 0; q < 6; q++) { const low = q === 0 || q === 1 || q === 3; const cc = low ? dirt : col; wc.push(cc[0] * sh, cc[1] * sh, cc[2] * sh); } // غبار/اتساخ عند الأرض
    }
    for (const t of triangulate(b.pts)) for (const id of t) { const p = b.pts[id]; rp.push(p.x, b.h + 0.02, p.z); rc.push(rcol[0], rcol[1], rcol[2]); }
  }
  const mk = (W) => ({ pos: new Float32Array(W.wp), uv: new Float32Array(W.wu), col: new Float32Array(W.wc) });
  const ws = walls.map(mk);
  return { wall: ws[0], walls: ws, roof: { pos: new Float32Array(rp), col: new Float32Array(rc) } };
}

// محلات الدور الأرضي: شرائح (4.5م) على حيطان المباني المطلة على شارع، كل شريحة خانة من أطلس المحلات (SHOP_CELLS خانات).
export const SHOP_CELLS = 8, SHOP_W = 4.5, SHOP_H = 3.7;
export function shopStripArrays(buildings, ri, rnd, { max = 16000, skip = null } = {}) {
  // كل شريحة ليها id ثابت (رقم المبنى-الضلع-الخانة) عشان الإدارة تتحكم فيها لوحدها. skip(id) → بيستبعد شريحة (لما الإدارة تغيّرها/تخفيها).
  const pos = [], uv = [], col = [], nor = [], slots = []; let count = 0;
  const put = (ax, az, bx, bz, nx, nz, cell, tint) => {
    const u0 = cell / SHOP_CELLS + 0.002, u1 = (cell + 1) / SHOP_CELLS - 0.002;
    pos.push(ax, 0.02, az, bx, 0.02, bz, bx, SHOP_H, bz, ax, 0.02, az, bx, SHOP_H, bz, ax, SHOP_H, az);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    for (let q = 0; q < 6; q++) { col.push(tint, tint, tint); nor.push(nx, 0, nz); } count++; // normals ضرورية: من غيرها الإضاءة بتطلع سودا
  };
  outer: for (let bi = 0; bi < buildings.length; bi++) {
    const b = buildings[bi];
    if (b.h < 8 || b.pts.length < 3) continue;
    const n = b.pts.length;
    for (let i = 0; i < n; i++) {
      const a = b.pts[i], c = b.pts[(i + 1) % n], len = Math.hypot(c.x - a.x, c.z - a.z); if (len < 5.2) continue;
      const dx = (c.x - a.x) / len, dz = (c.z - a.z) / len, mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2; let nx = dz, nz = -dx;
      if (pointInPoly(mx + nx * 0.4, mz + nz * 0.4, b.pts)) { nx = -nx; nz = -nz; }
      const q = ri ? ri.nearest(mx + nx * 5, mz + nz * 5, 24) : null; if (!q || q.d - q.road.w / 2 > 11) continue;
      if (rnd() < 0.22) continue; // مش كل حيطة فيها محلات
      const rx = nz, rz = -nx, pa = a.x * rx + a.z * rz, pc = c.x * rx + c.z * rz, s0 = pa < pc ? a : c, nseg = Math.floor(len / SHOP_W), used = nseg * SHOP_W, pad = (len - used) / 2;
      const sx = (pa < pc ? 1 : -1) * (c.x - a.x) / len, sz = (pa < pc ? 1 : -1) * (c.z - a.z) / len, off = 0.07;
      for (let k = 0; k < nseg; k++) {
        const t0 = pad + k * SHOP_W, t1 = t0 + SHOP_W, cell = Math.floor(rnd() * SHOP_CELLS), tint = 0.9 + rnd() * 0.1, id = bi + '-' + i + '-' + k;
        const A = [s0.x + sx * t0 + nx * off, s0.z + sz * t0 + nz * off], B = [s0.x + sx * t1 + nx * off, s0.z + sz * t1 + nz * off];
        slots.push({ id, ax: A[0], az: A[1], bx: B[0], bz: B[1], nx, nz, cell, street: (q.road && q.road.name) || '' });
        if (!(skip && skip(id))) put(A[0], A[1], B[0], B[1], nx, nz, cell, tint);
        if (slots.length >= max) break outer;
      }
    }
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), col: new Float32Array(col), nor: new Float32Array(nor), count, slots };
}

export function roadMeshArrays(roads) {
  const out = { wide: { pos: [], uv: [], idx: [] }, narrow: { pos: [], uv: [], idx: [] } };
  for (const r of roads) {
    const pts = r.pts.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.3);
    if (pts.length < 2) continue;
    const g = r.w >= 8 ? out.wide : out.narrow, hw = r.w / 2, y = 0.04 + (r.rank || 0) * 0.006;
    let dist = 0, vi = g.pos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; let dx, dz;
      if (i === 0) { dx = pts[1].x - p.x; dz = pts[1].z - p.z; }
      else if (i === pts.length - 1) { dx = p.x - pts[i - 1].x; dz = p.z - pts[i - 1].z; }
      else { dx = pts[i + 1].x - pts[i - 1].x; dz = pts[i + 1].z - pts[i - 1].z; }
      const l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i > 0) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      g.pos.push(p.x + nx * hw, y, p.z + nz * hw, p.x - nx * hw, y, p.z - nz * hw);
      g.uv.push(0, dist / 12, 1, dist / 12);
      if (i > 0) { const a = vi - 2, b = vi - 1, c = vi, d = vi + 1; g.idx.push(a, c, b, b, c, d); } // ترتيب يخلي الوش لفوق
      vi += 2;
    }
  }
  const f = (g) => ({ pos: new Float32Array(g.pos), uv: new Float32Array(g.uv), idx: new Uint32Array(g.idx) });
  return { wide: f(out.wide), narrow: f(out.narrow) };
}

// نقاط على جانبي الشوارع الكبيرة (نخيل وأعمدة إنارة)
export function scatterAlongRoads(roads, spacing, rnd, minRank = 3) {
  const out = [];
  for (const r of roads) {
    if (r.rank < minRank) continue;
    let carry = rnd() * spacing;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1) continue;
      const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
      for (let s = carry; s < L; s += spacing) {
        const off = r.w / 2 + 1.6;
        out.push({ x: a.x + dx * s - dz * off, z: a.z + dz * s + dx * off });
        out.push({ x: a.x + dx * s + dz * off, z: a.z + dz * s - dx * off });
      }
      carry = ((carry - L) % spacing + spacing) % spacing;
    }
  }
  return out;
}
