// مجسّم الكباري والمنحدرات: أسفلت مرتفع + بلاطة خرسانة + حواجز جانبية + أعمدة (ركائز) كل 28م.
// بياخد الطرق اللي عليها r.deck و r.elev (من elevation.js) — الطرق دي بتتخطّى في رسم الأرض والأرصفة والأشجار.
import * as THREE from 'three';
import { SLAB } from './elevation.js';
import { makeRoadTex } from './textures.js';

const RAIL_H = 1.0, RAIL_T = 0.5, PIER_EVERY = 28;
const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

function builder() {
  const pos = [], nor = [], uv = [], col = [];
  const tri = (a, b, c, n, ua, ub, uc, cc) => { for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); uv.push(u[0], u[1]); col.push(cc[0], cc[1], cc[2]); } };
  // مضلع رباعي a→b→c→d؛ n اختياري (وإلا بيتحسب)
  const quad = (a, b, c, d, cc = [1, 1, 1], n = null, uvs = null) => {
    if (!n) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; n = [nx / l, ny / l, nz / l]; }
    const u = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    tri(a, b, c, n, u[0], u[1], u[2], cc); tri(a, c, d, n, u[0], u[2], u[3], cc);
  };
  const geo = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3)); return g; };
  return { quad, geo, get count() { return pos.length / 3; } };
}

export function buildDecks(scene, roads, ri = null) {
  const g = new THREE.Group(); scene.add(g);
  const deckRoads = roads.filter((r) => r.deck && r.elev && r.pts.length >= 2), deckSet = new Set(deckRoads);
  const asphW = builder(), asphN = builder(), conc = builder(), piers = [];
  const CON = [0.74, 0.72, 0.68], CONd = [0.42, 0.41, 0.39], CAP = [0.84, 0.82, 0.78];
  for (const r of deckRoads) {
    const pts = r.pts, hw = r.w / 2, A = r.w >= 8 ? asphW : asphN; let dist = 0, since = PIER_EVERY * 0.5;
    const L = [], R = [], T = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; let dx, dz;
      if (i === 0) { dx = pts[1].x - p.x; dz = pts[1].z - p.z; } else if (i === pts.length - 1) { dx = p.x - pts[i - 1].x; dz = p.z - pts[i - 1].z; } else { dx = pts[i + 1].x - pts[i - 1].x; dz = pts[i + 1].z - pts[i - 1].z; }
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; T.push([dx, dz]);
      L.push([p.x - dz * hw, p.z + dx * hw]); R.push([p.x + dz * hw, p.z - dx * hw]);
    }
    const at = (side, i, y, off = 0) => { const [dx, dz] = T[i], p = pts[i], k = (hw - off) * side; return [p.x - dz * k, y, p.z + dx * k]; };
    for (let i = 0; i < pts.length - 1; i++) {
      const h0 = r.elev[i], h1 = r.elev[i + 1], d0 = dist, d1 = dist + Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z); dist = d1;
      const y0 = h0 + 0.05, y1 = h1 + 0.05;
      // الأسفلت (الوش لفوق): ترتيب بيطلّع الوش لفوق زي الطرق العادية
      A.quad([L[i][0], y0, L[i][1]], [L[i + 1][0], y1, L[i + 1][1]], [R[i + 1][0], y1, R[i + 1][1]], [R[i][0], y0, R[i][1]], [1, 1, 1], [0, 1, 0], [[0, d0 / 12], [0, d1 / 12], [1, d1 / 12], [1, d0 / 12]]);
      const tone = 0.94 + ((i * 29) % 7) * 0.012, c1 = CON.map((v) => v * tone), c2 = CAP.map((v) => v * tone);
      const b0 = Math.max(0, h0 - SLAB), b1 = Math.max(0, h1 - SLAB); // البلاطة ما تنزلش تحت الأرض
      const rh0 = RAIL_H * sm(h0 / 1.5), rh1 = RAIL_H * sm(h1 / 1.5); // الحاجز بيبدأ يظهر مع الارتفاع
      for (const side of [1, -1]) {
        // جدار خارجي: من تحت البلاطة لفوق الحاجز
        conc.quad(at(side, i, b0), at(side, i + 1, b1), at(side, i + 1, h1 + rh1), at(side, i, h0 + rh0), c1);
        if (rh0 + rh1 > 0.05) { // الحاجز: جدار داخلي + سطح علوي
          conc.quad(at(side, i, y0, RAIL_T), at(side, i + 1, y1, RAIL_T), at(side, i + 1, h1 + rh1, RAIL_T), at(side, i, h0 + rh0, RAIL_T), c1);
          conc.quad(at(side, i, h0 + rh0, RAIL_T), at(side, i + 1, h1 + rh1, RAIL_T), at(side, i + 1, h1 + rh1, 0), at(side, i, h0 + rh0, 0), c2, [0, 1, 0]);
        }
      }
      if (h0 > SLAB * 0.9 || h1 > SLAB * 0.9) conc.quad([L[i][0], b0, L[i][1]], [R[i][0], b0, R[i][1]], [R[i + 1][0], b1, R[i + 1][1]], [L[i + 1][0], b1, L[i + 1][1]], CONd, [0, -1, 0]); // وش البلاطة من تحت
      // ركائز
      since += d1 - d0;
      if (since >= PIER_EVERY && h1 > 2.2) {
        since = 0; const p = pts[i + 1], [dx, dz] = T[i + 1];
        let ok = true; if (ri) { const n = ri.nearest(p.x, p.z, 20, deckSet); if (n && n.d <= n.road.w / 2 + 1) ok = false; } // مش فوق أسفلت أرضي
        if (ok) piers.push({ x: p.x, z: p.z, h: h1 - SLAB, rot: Math.atan2(-dx, -dz), w: Math.min(r.w * 0.8, 12) });
      }
    }
  }
  const mkMesh = (b, mat) => { if (!b.count) return null; const m = new THREE.Mesh(b.geo(), mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m; };
  const mats = { w: new THREE.MeshLambertMaterial({ map: makeRoadTex(true), side: THREE.DoubleSide }), n: new THREE.MeshLambertMaterial({ map: makeRoadTex(false), side: THREE.DoubleSide }), c: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) };
  mkMesh(asphW, mats.w); mkMesh(asphN, mats.n); mkMesh(conc, mats.c);
  if (piers.length) {
    const colG = new THREE.CylinderGeometry(0.85, 1.05, 1, 10).translate(0, 0.5, 0), capG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const pm = new THREE.MeshLambertMaterial({ color: 0xb5b1a8 }), col = new THREE.InstancedMesh(colG, pm, piers.length), cap = new THREE.InstancedMesh(capG, pm, piers.length), o = new THREE.Object3D();
    piers.forEach((p, i) => {
      o.position.set(p.x, 0, p.z); o.rotation.set(0, p.rot, 0); o.scale.set(1, Math.max(0.5, p.h - 0.9), 1); o.updateMatrix(); col.setMatrixAt(i, o.matrix);
      o.position.set(p.x, Math.max(0.5, p.h - 0.9), p.z); o.scale.set(p.w, 0.9, 1.9); o.updateMatrix(); cap.setMatrixAt(i, o.matrix);
    });
    for (const m of [col, cap]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(m); }
  }
  return { group: g, decks: deckRoads.length, piers: piers.length };
}
