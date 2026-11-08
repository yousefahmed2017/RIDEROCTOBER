// حياة الشارع: مشاة بيمشوا على الأرصفة (ملابس وأطوال وألوان بشرة متنوعة، جلابية وحجاب وأطفال)،
// بيتحركوا بخطوة حقيقية (رجلين وإيدين)، بيبعدوا لما الموتوسيكل يقرّب، ولو اتخبطوا بيقعوا. InstancedMesh = أداء كويس.
import * as THREE from 'three';
import { SIDEWALK_W, mulberry32 } from './geo.js';

const MAX = 170, DENS = { low: 28, mid: 80, high: 160 };
const SHIRTS = [0xf2f2f2, 0x2d6cdf, 0x2f8f4e, 0xaa3a3a, 0x444a55, 0xd6a02b, 0x7a4fa3, 0xe58b3a, 0x1f2a44, 0xc9c1ae, 0x8aa5b8, 0xd96a8a];
const PANTS = [0x1b1f2a, 0x2c3e66, 0x4a4a4a, 0x6b5a45, 0x111111, 0x3d4d3a, 0x7c7468];
const SKIN = [0xf0c8a0, 0xe0ac7c, 0xc99a74, 0xa87850, 0x8a5e3c];
const HAIR = [0x111111, 0x1c1410, 0x3a2a1c, 0x1b1b1b];
const HIJAB = [0x1f2a44, 0x7a2a3a, 0xe8dcc4, 0xf4f4f4, 0x555b66, 0x2f6b5a, 0xb08ab8];
const ROBE = [0xf0eee6, 0xcdb998, 0x7d8895, 0x4a4f58, 0xb9c6d4];

export function makeLife(scene, ri, { avoid = () => false, seed = 303, density = 'mid' } = {}) {
  const rnd = mulberry32(seed), g = new THREE.Group(); scene.add(g);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mk = (geo) => { const m = new THREE.InstancedMesh(geo, mat, MAX); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); m.frustumCulled = false; m.castShadow = false; g.add(m); return m; };
  const torso = mk(new THREE.CapsuleGeometry(0.17, 0.42, 3, 8).scale(1.1, 1, 0.72).translate(0, 1.12, 0));
  const head = mk(new THREE.SphereGeometry(0.115, 10, 8).translate(0, 1.58, 0));
  const hair = mk(new THREE.SphereGeometry(0.128, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, 1.595, -0.005));
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.68, 2, 6).translate(0, -0.42, 0), armGeo = new THREE.CapsuleGeometry(0.05, 0.42, 2, 6).translate(0, -0.27, 0);
  const legL = mk(legGeo), legR = mk(legGeo), armL = mk(armGeo), armR = mk(armGeo);
  const robe = mk(new THREE.CylinderGeometry(0.19, 0.3, 1.1, 10).translate(0, 0.78, 0));
  const parts = [torso, head, hair, legL, legR, armL, armR, robe];
  const col = new THREE.Color(), pick = (a) => a[Math.floor(rnd() * a.length)];
  const I = new THREE.Matrix4(), T = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SV = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
  const BASE = new THREE.Matrix4(), peds = [];
  for (let i = 0; i < MAX; i++) peds.push({ i, on: false, x: 0, z: 0, h: 0, road: null, s: 0, ci: 0, dir: 1, side: 1, off: 0, speed: 1.3, phase: rnd() * 6, sc: 1, idle: 0, flee: 0, fallen: 0, robe: false, wait: 0 });

  function paintPed(p) {
    const kid = rnd() < 0.1, woman = !kid && rnd() < 0.42; p.sc = kid ? 0.62 + rnd() * 0.12 : 0.92 + rnd() * 0.17; p.robe = !kid && !woman && rnd() < 0.14; p.speed = (kid ? 1.5 : 1.15 + rnd() * 0.5);
    const shirt = pick(SHIRTS), robeC = pick(ROBE), skin = pick(SKIN), hairC = woman && rnd() < 0.62 ? pick(HIJAB) : pick(HAIR), pants = pick(PANTS);
    parts.forEach((m, k) => {
      col.setHex([shirt, skin, hairC, pants, pants, shirt, shirt, robeC][k]); if (k === 0 && p.robe) col.setHex(robeC); if (k >= 5 && k <= 6 && p.robe) col.setHex(robeC); m.setColorAt(p.i, col);
    });
    if (woman && hairC !== 0 && HIJAB.includes(hairC)) { /* حجاب: الغطا بلون الحجاب + الرقبة */ }
    p.armSwing = woman ? 0.45 : 0.6; p.stride = kid ? 0.9 : 0.7;
    parts.forEach((m) => { m.instanceColor.needsUpdate = true; });
  }
  peds.forEach(paintPed);

  const dens = { v: DENS[density] || DENS.mid };
  function place(p, bike, near = 25, far = 150) {
    for (let t = 0; t < 14; t++) {
      const q = ri.randomPoint(rnd, 1); if (q.road.rank < 1) continue; const d = Math.hypot(q.x - bike.x, q.z - bike.z); if (d < near || d > far) continue;
      const side = rnd() < 0.5 ? 1 : -1, off = q.road.w / 2 + SIDEWALK_W * (0.2 + rnd() * 0.6);
      p.road = q.road; p.s = q.s; p.dir = rnd() < 0.5 ? 1 : -1; p.side = side; p.off = off; p.ci = Math.min(q.i || 0, q.road.pts.length - 2); p.flee = 0; p.fallen = 0; p.idle = rnd() < 0.22 ? 3 + rnd() * 12 : 0; p.wait = 0; p.on = true;
      pose(p); if (ri.surface(p.x, p.z, SIDEWALK_W).s !== 1 || avoid(p.x, p.z)) { p.on = false; continue; } return true;
    }
    p.on = false; return false;
  }
  function pose(p) {
    const r = p.road, cum = r._cum, pts = r.pts; let i = Math.min(p.ci, pts.length - 2);
    while (i < cum.length - 2 && p.s > cum[i + 1]) i++; while (i > 0 && p.s < cum[i]) i--; p.ci = i;
    const a = pts[i], b = pts[i + 1], L = cum[i + 1] - cum[i] || 1, t = (p.s - cum[i]) / L, dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
    p.x = a.x + (b.x - a.x) * t - dz * p.off * p.side; p.z = a.z + (b.z - a.z) * t + dx * p.off * p.side; p.tx = dx; p.tz = dz;
    p.h = Math.atan2(dx * p.dir, -dz * p.dir); // الاتجاه الأمامي
  }

  const hitCb = { fn: null }, glbSet = new Set(), pool = [];
  function update(dt, bike, clock) {
    const n = Math.min(MAX, dens.v); let nearHit = 0;
    for (const p of peds) {
      if (p.i >= n) { if (p.on) { p.on = false; } continue; }
      if (!p.on) { if (!place(p, bike, 30, 150)) continue; }
      const dx = p.x - bike.x, dz = p.z - bike.z, d2 = dx * dx + dz * dz;
      if (d2 > 190 * 190) { p.on = false; place(p, bike, 60, 150); }
      if (p.fallen > 0) { p.fallen -= dt; if (p.fallen <= 0) { p.on = false; place(p, bike, 60, 150); } continue; }
      const sp = (bike.lvl || 0) > 2 ? 0 : Math.abs(bike.speed); // فوق كوبري: مفيش خبط/هروب مشاة تحت
      if (d2 < 0.8 * 0.8 && sp > 2.5) { p.fallen = 2.6; nearHit++; if (hitCb.fn) hitCb.fn(p, sp); continue; }
      let v = 0;
      if (d2 < 7 * 7 && sp > 3) { // بيجري بعيد عن الموتوسيكل
        const away = (dx * p.tx + dz * p.tz) * p.dir; p.dir = away >= 0 ? p.dir : -p.dir; p.flee = 1.4;
      }
      if (p.flee > 0) { p.flee -= dt; v = 3.4; p.idle = 0; } else if (p.idle > 0) { p.idle -= dt; v = 0; } else { v = p.speed; if (rnd() < dt * 0.01) p.idle = 2 + rnd() * 6; }
      p.s += p.dir * v * dt; p.phase += v * dt * 3.2;
      if (p.s < 0.5 || p.s > p.road._len - 0.5) { p.dir = -p.dir; p.s = Math.max(0.5, Math.min(p.road._len - 0.5, p.s)); }
      pose(p);
    }
    // مصفوفات النسخ
    // أقرب مشاة لـ GLB متحرك (بدل المجسم المتكرر) — عدد محدود للأداء
    glbSet.clear(); if (pool.length) { const c = []; for (const p of peds) if (p.on && p.i < n && p.fallen <= 0) { const dx = p.x - bike.x, dz = p.z - bike.z, d2 = dx * dx + dz * dz; if (d2 < 45 * 45) c.push([d2, p]); } c.sort((a, b) => a[0] - b[0]); c.slice(0, pool.length).forEach(([, p], j) => { glbSet.add(p.i); const ch = pool[j]; ch.group.visible = true; ch.group.position.set(p.x, 0, p.z); ch.group.rotation.y = -p.h; ch.group.scale.setScalar(p.sc); ch.update(dt, p.idle > 0 ? 0 : p.flee > 0 ? 3.6 : p.speed, null); }); for (let j = c.length; j < pool.length; j++) pool[j].group.visible = false; }
    for (const p of peds) {
      const vis = p.on && p.i < n && !glbSet.has(p.i); const sc = vis ? p.sc : 0;
      if (!vis) { for (const m of parts) { I.compose(V.set(0, -50, 0), Q.identity(), SV.copy(ZERO)); m.setMatrixAt(p.i, I); } continue; }
      const ly = p.fallen > 0 ? Math.min(1, (2.6 - p.fallen) * 6) * 1.45 : 0; // وقوع
      E.set(-ly, -p.h, 0, 'YXZ'); Q.setFromEuler(E); const base = BASE.compose(V.set(p.x, ly * 0.12, p.z), Q, SV.set(sc, sc, sc));
      const moving = p.fallen <= 0 && p.idle <= 0, sw = moving ? Math.sin(p.phase) : 0, bob = moving ? Math.abs(Math.sin(p.phase)) * 0.025 : 0;
      for (let k = 0; k < parts.length; k++) {
        const m = parts[k]; T.identity();
        if (k === 3 || k === 4) { if (p.robe) { I.compose(V.set(0, -50, 0), Q.identity(), SV.copy(ZERO)); m.setMatrixAt(p.i, I); continue; } const s = k === 3 ? 1 : -1; T.makeRotationX(sw * p.stride * s); T.setPosition(k === 3 ? -0.1 : 0.1, 0.78, 0); }
        else if (k === 5 || k === 6) { const s = k === 5 ? 1 : -1; T.makeRotationX(-sw * p.armSwing * s); T.setPosition(k === 5 ? -0.24 : 0.24, 1.38, 0); }
        else if (k === 7) { if (!p.robe) { I.compose(V.set(0, -50, 0), Q.identity(), SV.copy(ZERO)); m.setMatrixAt(p.i, I); continue; } T.makeScale(1, 1, 0.75); }
        else T.makeTranslation(0, bob, 0);
        I.multiplyMatrices(base, T); m.setMatrixAt(p.i, I);
      }
    }
    for (const m of parts) m.instanceMatrix.needsUpdate = true;
    return nearHit;
  }
  return { group: g, update, setGLB(factory, K = 12) { for (const c of pool) g.remove(c.group); pool.length = 0; if (!factory) return; for (let i = 0; i < K; i++) { const c = factory(); if (!c) { pool.length = 0; return; } c.group.visible = false; g.add(c.group); pool.push(c); } }, setDensity(d) { dens.v = DENS[d] || DENS.mid; }, onHit(fn) { hitCb.fn = fn; }, peds };
}
