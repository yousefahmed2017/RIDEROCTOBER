// حمولة الموتوسيكل ثلاثية الأبعاد حسب نوع الطلب: علبة دواء · شنطة أكل حرارية · طرد كرتون · راكب (أو اتنين) ورا السواق.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTex } from './textures.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const std = (c, rough = 0.5, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const box = (mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const ell = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
function limb(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10), mat); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}

// ───── خامات الوشوش (بتتولد بالكود) ─────
function medTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f7f9f7'; g.fillRect(0, 0, w, h); g.fillStyle = '#17a35a'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#17a35a'; g.fillRect(w / 2 - 26, h / 2 - 76, 52, 152); g.fillRect(w / 2 - 76, h / 2 - 26, 152, 52);
    g.fillStyle = '#fff'; g.fillRect(w / 2 - 14, h / 2 - 64, 28, 128); g.fillRect(w / 2 - 64, h / 2 - 14, 128, 28);
    g.fillStyle = '#17a35a'; g.textAlign = 'center'; g.font = '800 26px Cairo, Tahoma, Arial'; g.fillText('صيدلية', w / 2, h - 38);
  }, false);
}
function foodTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8452b'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, 0, w, 20); g.fillRect(0, h - 20, w, 20);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, 100, 56, 0, 7); g.fill();
    g.font = '700 64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍔', w / 2, 104);
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.font = '800 28px Cairo, Tahoma, Arial'; g.fillText('أكل سخن', w / 2, 200); g.font = '700 18px Cairo, Tahoma, Arial'; g.fillText('كوكب الجحود أكتوبر', w / 2, 230);
  }, false);
}
function parcelTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b98a54'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 40; i++) g.fillRect(0, i * 6.5, w, 2);
    g.fillStyle = '#d9c39a'; g.fillRect(w / 2 - 22, 0, 44, h); g.fillStyle = '#fff'; g.fillRect(24, 150, 110, 70); g.fillStyle = '#222'; g.fillRect(32, 162, 60, 6); g.fillRect(32, 176, 90, 5); g.fillRect(32, 190, 78, 5);
    g.font = '700 30px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.fillText('📦', 170, 80);
  }, false);
}

// ───── الراكب ─────
const SKIN = [0xf0c8a0, 0xe0ac7c, 0xc99a74, 0xa87850];
const SHIRT = [0x2d6cdf, 0x2f8f4e, 0xd6a02b, 0x7a4fa3, 0xe58b3a, 0xd96a8a, 0x8aa5b8, 0xf2f2f2];
const PANT = [0x1b1f2a, 0x2c3e66, 0x4a4a4a, 0x6b5a45];
const HIJAB = [0x1f2a44, 0x7a2a3a, 0xe8dcc4, 0x2f6b5a, 0xb08ab8];

export function buildPassenger(kit, v = 0) {
  const { seatY, seatZ, wr } = kit, g = new THREE.Group(); g.name = 'pax' + v;
  const woman = v % 2 === 1, skin = lam(SKIN[(v * 2 + 1) % SKIN.length]), shirt = lam(SHIRT[(v * 3 + 2) % SHIRT.length]), pants = lam(PANT[(v + 1) % PANT.length]), shoe = lam(0x1c1d20);
  const z0 = seatZ + 0.4 + v * 0.26, s = v ? 0.94 : 1, y0 = seatY + 0.07;
  const body = new THREE.Group(); body.position.set(0, 0, z0); g.add(body); body.scale.setScalar(s);
  const torso = ell(shirt, 0.18, 0.26, 0.12, 0, y0 + 0.3, -0.02); torso.rotation.x = -0.28; body.add(torso);
  body.add(ell(skin, 0.05, 0.06, 0.05, 0, y0 + 0.56, -0.07)); // رقبة
  const head = new THREE.Group(); head.position.set(0, y0 + 0.69, -0.1); body.add(head); head.name = 'head';
  head.add(ell(skin, 0.098, 0.115, 0.1, 0, 0, 0));
  if (woman) { head.add(ell(lam(HIJAB[(v + 2) % HIJAB.length]), 0.125, 0.14, 0.125, 0, 0.012, 0.014)); head.add(ell(skin, 0.075, 0.09, 0.04, 0, -0.005, -0.075)); }
  else { const hel = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), std([0xff7a1a, 0x19c2a0, 0x4aa8ff, 0xffc83d][(v + 1) % 4], 0.25, 0.3)); hel.position.set(0, 0.012, 0.005); head.add(hel); }
  for (const sx of [-1, 1]) { // دراعين ماسكين في السواق من الوسط
    const sh = [sx * 0.19, y0 + 0.46, -0.04], hand = [sx * 0.15, y0 + 0.28, -0.3], el = [sx * 0.27, y0 + 0.32, -0.13];
    body.add(limb(sh, el, 0.042, shirt)); body.add(limb(el, hand, 0.038, shirt)); body.add(ell(skin, 0.04, 0.04, 0.04, hand[0], hand[1], hand[2]));
    const hip = [sx * 0.12, y0 + 0.04, 0.0], knee = [sx * 0.24, y0 + 0.06, -0.22], foot = [sx * 0.2, wr - 0.1, -0.1];
    body.add(limb(hip, knee, 0.058, pants)); body.add(limb(knee, foot, 0.048, pants)); body.add(box(shoe, 0.085, 0.07, 0.18, foot[0], foot[1] - 0.02, foot[2] - 0.04));
  }
  if (!woman) body.add(box(lam(0x2a2e36), 0.2, 0.22, 0.09, 0, y0 + 0.3, 0.12)); // شنطة ضهر
  g.userData.body = body; g.userData.head = head; g.visible = false; return g;
}

// kit: { bw, seatY, seatZ, rear0, wr }
export function buildLoads(kit) {
  const { bw, seatY, rear0 } = kit, root = new THREE.Group(); root.name = 'loads';
  const holder = (name, y = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(0, seatY + 0.2 + bw / 2 + 0.02 + y, rear0 + 0.15); g.visible = false; root.add(g); return g; };
  // دواء: علبة بيضا بصليب أخضر وغطا أخضر
  const med = holder('med'); { const tex = medTex(), side = std(0xffffff, 0.45); side.map = tex; const top = std(0x17a35a, 0.4);
    const b = new THREE.Mesh(new RoundedBoxGeometry(bw * 0.98, bw * 0.78, bw * 0.86, 3, 0.03), [side, side, top, side, side, side]); b.position.y = -bw * 0.08; med.add(b);
    med.add(box(std(0x17a35a, 0.4), bw * 0.99, 0.04, bw * 0.87, 0, bw * 0.31, 0)); const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 14, Math.PI), std(0x333a40, 0.4, 0.6)); h.position.set(0, bw * 0.36, 0); med.add(h); }
  // أكل: شنطة حرارية حمرا ببطانة وسوست وحزام
  const food = holder('food'); { const tex = foodTex(), sideM = std(0xffffff, 0.6), bag = std(0xe8452b, 0.65); sideM.map = tex;
    const b = new THREE.Mesh(new RoundedBoxGeometry(bw * 1.08, bw * 1.0, bw * 1.0, 4, 0.08), [sideM, sideM, bag, bag, bag, sideM]); b.position.y = 0.0; food.add(b);
    food.add(box(std(0x2b2f36, 0.5), bw * 1.1, 0.03, bw * 1.02, 0, bw * 0.38, 0)); food.add(box(std(0x2b2f36, 0.5), bw * 1.1, 0.025, 0.05, 0, -bw * 0.1, bw * 0.5));
    const steam = new THREE.Group(); steam.name = 'steam'; food.add(steam); }
  // طرد: كرتونة بشريط لاصق وبوليصة
  const parcel = holder('parcel', -0.02); { const tex = parcelTex(), face = std(0xffffff, 0.8), plain = std(0xb98a54, 0.85); face.map = tex;
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.88, bw * 0.72, bw * 0.88), [face, face, plain, plain, face, face]); b.position.y = -bw * 0.05; parcel.add(b); parcel.add(box(std(0xd9c39a, 0.8), 0.06, 0.012, bw * 0.89, 0, bw * 0.31, 0)); }
  const pax1 = buildPassenger(kit, 0), pax2 = buildPassenger(kit, 1); root.add(pax1, pax2);
  const parts = { med, food, parcel, pax1, pax2 };
  function show(kind, pax = 1) {
    for (const k of Object.keys(parts)) parts[k].visible = false;
    if (!kind) return;
    if (kind === 'person') { parts.pax1.visible = true; parts.pax2.visible = pax >= 2; } else if (parts[kind]) parts[kind].visible = true;
  }
  return { group: root, show, parts };
}
