// تفاصيل المدينة (نقي بدون DOM): أرصفة مرتفعة، مباني تعبئة، جراجات اللاعبين، محطات البنزين.
// كل اللاعبين بيحسبوا نفس النتيجة من نفس بيانات الشوارع (عشان الجراجات والمحطات تتطابق في الملتي بلاير).
import { SIDEWALK_W, KERB_H, mulberry32, pointInPoly } from './geo.js';

export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// بيرتب المثلث بحيث وشه يبص ناحية الاتجاه المطلوب (نحل مشكلة الوش المقلوب والإضاءة الغلط)
function tri(idx, pos, a, b, c, nx, ny, nz) {
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  if (cx * nx + cy * ny + cz * nz >= 0) idx.push(a, b, c); else idx.push(a, c, b);
}

function resample(r, step) {
  const s = []; let dist = 0;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 0.01) continue;
    const n = Math.max(1, Math.round(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; s.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dist: dist + L * t }); }
    dist += L;
  }
  const e = r.pts[r.pts.length - 1]; s.push({ x: e.x, z: e.z, dist });
  for (let i = 0; i < s.length; i++) { // اتجاه كل نقطة = متوسط جيرانها (انحناء ناعم)
    const p = s[Math.max(0, i - 1)], q = s[Math.min(s.length - 1, i + 1)], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
    s[i].dx = dx / l; s[i].dz = dz / l;
  }
  return s;
}

// ───── أرصفة: سطح مرتفع + حجر الرصيف (الكيرب). بتتقطع عند التقاطعات. ─────
export function sidewalkMeshArrays(roads, ri, sw = SIDEWALK_W, h = KERB_H, step = 4) {
  const top = { pos: [], nor: [], uv: [], idx: [] }, curb = { pos: [], nor: [], uv: [], idx: [] };
  for (const r of roads) {
    if (r.rank < 1) continue;
    const hw = r.w / 2, S = resample(r, step);
    for (const side of [1, -1]) for (let i = 0; i < S.length - 1; i++) {
      const s0 = S[i], s1 = S[i + 1];
      const mx = (s0.x + s1.x) / 2 + (-(s0.dz + s1.dz) / 2) * side * (hw + sw / 2), mz = (s0.z + s1.z) / 2 + ((s0.dx + s1.dx) / 2) * side * (hw + sw / 2);
      const o = ri.nearest(mx, mz, 40, r); if (o && o.d <= o.road.w / 2 + 0.4) continue; // جوه أسفلت شارع تاني = تقاطع
      const P = (s, off, y) => [s.x + -s.dz * side * off, y, s.z + s.dx * side * off];
      const [i0, o0, i1, o1] = [P(s0, hw, h), P(s0, hw + sw, h), P(s1, hw, h), P(s1, hw + sw, h)];
      let b = top.pos.length / 3;
      top.pos.push(...i0, ...o0, ...i1, ...o1); for (let k = 0; k < 4; k++) top.nor.push(0, 1, 0);
      top.uv.push(0, s0.dist / 3, 1, s0.dist / 3, 0, s1.dist / 3, 1, s1.dist / 3);
      tri(top.idx, top.pos, b, b + 1, b + 2, 0, 1, 0); tri(top.idx, top.pos, b + 1, b + 3, b + 2, 0, 1, 0);
      const [c0, c0t, c1, c1t] = [P(s0, hw, 0.03), P(s0, hw, h), P(s1, hw, 0.03), P(s1, hw, h)];
      b = curb.pos.length / 3; const nx = s0.dz * side, nz = -s0.dx * side; // بيبص ناحية الشارع
      curb.pos.push(...c0, ...c0t, ...c1, ...c1t); for (let k = 0; k < 4; k++) curb.nor.push(nx, 0, nz);
      curb.uv.push(s0.dist / 1.5, 0, s0.dist / 1.5, 1, s1.dist / 1.5, 0, s1.dist / 1.5, 1);
      tri(curb.idx, curb.pos, b, b + 1, b + 2, nx, 0, nz); tri(curb.idx, curb.pos, b + 1, b + 3, b + 2, nx, 0, nz);
    }
  }
  const f = (g) => ({ pos: new Float32Array(g.pos), nor: new Float32Array(g.nor), uv: new Float32Array(g.uv), idx: new Uint32Array(g.idx) });
  return { top: f(top), curb: f(curb) };
}

// ───── مباني تعبئة على جانبي الشوارع (لو بيانات OSM ناقصة، المدينة تفضل مزدحمة) ─────
export function infillBuildings(roads, ri, bIdx, rnd, { max = 2500, sw = SIDEWALK_W, mask = null } = {}) {
  const out = [], occ = new Set();
  const free = (cx, cz, dx, dz, fw, fd) => {
    const nx = -dz, nz = dx, pts = [];
    for (const [u, v] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push([cx + dx * u * fw / 2 + nx * v * fd / 2, cz + dz * u * fw / 2 + nz * v * fd / 2]);
    for (const [x, z] of pts) { const s = ri.surface(x, z, sw); if (s.s !== 2 || s.m < sw + 1.2) return null; if (bIdx && bIdx.hit(x, z, 2.5)) return null; }
    const cells = []; const R = Math.hypot(fw, fd) / 2;
    for (let x = cx - R; x <= cx + R; x += 8) for (let z = cz - R; z <= cz + R; z += 8) { const k = Math.floor(x / 8) + ',' + Math.floor(z / 8); if (occ.has(k)) return null; cells.push(k); }
    return cells;
  };
  for (const r of roads) {
    if (r.rank < 1 || out.length >= max) continue;
    const hw = r.w / 2; let carry = rnd() * 8;
    for (let i = 0; i < r.pts.length - 1 && out.length < max; i++) {
      const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 14) { carry = Math.max(0, carry - L); continue; }
      const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L, nx = -dz, nz = dx;
      let s = carry;
      while (s < L - 14) {
        const lotW = 13 + rnd() * 10, depth = 11 + rnd() * 9;
        for (const side of [1, -1]) {
          if (rnd() < 0.1) continue;
          const off = hw + sw + 2.4 + depth / 2, cx = a.x + dx * (s + lotW / 2) + nx * side * off, cz = a.z + dz * (s + lotW / 2) + nz * side * off, fw = lotW - 2.4;
          if (mask && !mask(cx, cz)) continue; // مناطق مش مبنية (صحرا) فاضية
          const cells = free(cx, cz, dx, dz, fw, depth); if (!cells) continue;
          cells.forEach((k) => occ.add(k));
          const floors = (rnd() < 0.7 ? 4 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 5)) + (r.rank >= 4 ? 2 : 0), P = (u, v) => ({ x: cx + dx * u * fw / 2 + nx * v * depth / 2, z: cz + dz * u * fw / 2 + nz * v * depth / 2 });
          out.push({ pts: [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], h: floors * 3.2, infill: true });
          if (out.length >= max) break;
        }
        s += lotW;
      }
      carry = s - L;
    }
  }
  return out;
}


// ───── مباني جوه الأسفلت: بيشيل أي مبنى (OSM أو تعبئة) جزء منه فوق شارع ─────
// بياخد عينات جوه المضلع (رؤوس + نصف الأضلاع + شبكة) ويشوف لو أي نقطة جوه الأسفلت أو أقرب من `clear` متر من حافته.
export function overlapsRoad(b, ri, clear = 0.3, step = 3) {
  const pts = b.pts, n = pts.length;
  const hit = (x, z) => ri.surface(x, z).m < clear; // m = المسافة من حافة أقرب أسفلت (سالب = جوه الأسفلت)
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % n], L = Math.hypot(c.x - a.x, c.z - a.z), k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) { const t = j / k; if (hit(a.x + (c.x - a.x) * t, a.z + (c.z - a.z) * t)) return true; }
  }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const st = Math.max(step, Math.sqrt(((x1 - x0) * (z1 - z0)) / 400));
  for (let x = x0 + st / 2; x < x1; x += st) for (let z = z0 + st / 2; z < z1; z += st) if (pointInPoly(x, z, pts) && hit(x, z)) return true;
  return false;
}
export function dropBuildingsOnRoads(buildings, ri, clear = 0.3) {
  const keep = []; let dropped = 0;
  for (const b of buildings) { if (overlapsRoad(b, ri, clear)) dropped++; else keep.push(b); }
  return { keep, dropped };
}

// ───── مواقع ثابتة على جانب الشارع (جراجات / محطات) ─────
export function placeSites(roads, ri, bIdx, { spacing = 140, minRank = 1, off = 9, seed = 17, max = 200 } = {}) {
  const rnd = mulberry32(seed), sites = [];
  for (const r of roads) {
    if (r.rank < minRank) continue;
    const hw = r.w / 2, S = resample(r, 10); let next = rnd() * spacing * 0.6 + 30, side = rnd() < 0.5 ? 1 : -1;
    for (const p of S) {
      if (p.dist < next) continue; next = p.dist + spacing * (0.8 + rnd() * 0.4); side = -side;
      const nx = -p.dz * side, nz = p.dx * side, d = hw + SIDEWALK_W + off, bx = p.x + nx * d, bz = p.z + nz * d;
      let ok = true;
      for (const [u, v] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [5, 5], [-5, -5], [5, -5], [-5, 5]]) {
        const x = bx + p.dx * u + nx * v, z = bz + p.dz * u + nz * v, s = ri.surface(x, z, SIDEWALK_W);
        if (s.s !== 2 || s.m < SIDEWALK_W + 2 || (bIdx && bIdx.hit(x, z, 2))) { ok = false; break; }
      }
      if (!ok) continue;
      sites.push({ x: p.x, z: p.z, hx: p.dx, hz: p.dz, bx, bz, side, nx, nz, road: r });
      if (sites.length >= max) return sites;
    }
  }
  return sites;
}

// جراج كل لاعب: رقم ثابت من id اللاعب → نفس المكان عند كل اللاعبين
export function garageFor(slots, playerId) {
  if (!slots.length) return null;
  const k = hash32(playerId) % slots.length; return { ...slots[k], index: k };
}

// محطات بنزين: الحقيقية من OSM أولًا، وبعدها محطات موزعة على كل الخريطة (اختيار "أبعد نقطة" عشان التغطية تبقى متساوية — أقرب محطة تقريبًا في حدود 150–250 م).
// الاختيار حتمي (نفس seed) فكل اللاعبين بيشوفوا نفس المحطات في الملتي بلاير.
export function makeStations(pois, roads, ri, bIdx, want = 60) {
  const out = [];
  for (const p of pois) if (p.kind === 'fuel') {
    const n = ri.nearest(p.x, p.z, 120); if (!n) continue;
    const nx = p.x - n.x, nz = p.z - n.z, l = Math.hypot(nx, nz) || 1;
    out.push({ x: n.x, z: n.z, hx: n.hx / (Math.hypot(n.hx, n.hz) || 1), hz: n.hz / (Math.hypot(n.hx, n.hz) || 1), bx: p.x, bz: p.z, nx: nx / l, nz: nz / l, name: p.name || 'محطة بنزين', real: true });
  }
  if (out.length < want) {
    const minRank = 1;
    const cands = placeSites(roads, ri, bIdx, { spacing: 70, minRank, off: 12, seed: 29, max: 3000 });
    const fresh = [], gap = 90;
    let md = cands.map((c) => out.reduce((m, o) => Math.min(m, Math.hypot(c.x - o.x, c.z - o.z)), 1e9));
    while (out.length + fresh.length < want && cands.length) {
      let bi = -1, bd = gap; for (let i = 0; i < cands.length; i++) if (md[i] > bd) { bd = md[i]; bi = i; }
      if (bi < 0) break; const c = cands[bi]; fresh.push(c);
      for (let i = 0; i < cands.length; i++) md[i] = Math.min(md[i], Math.hypot(cands[i].x - c.x, cands[i].z - c.z));
    }
    const names = ['محطة وطنية', 'محطة مصر للبترول', 'محطة تو إن', 'محطة أكتوبر', 'محطة موبيل', 'محطة شل', 'محطة كولا'];
    fresh.forEach((s, i) => out.push({ ...s, name: names[i % names.length] + ' ' + (i + 1), real: false }));
  }
  return out.slice(0, Math.max(want, out.filter((s) => s.real).length));
}
