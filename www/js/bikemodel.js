// موديل الموتوسيكل والسواق (Three.js): كاوتش بجنوط وأسلاك، شوكة بتلف، موتور بزعانف، شكمان، فنارات، نمرة،
// سواق بجاكيت وخوذة وفيزور وأيادي على الدركسيون، وصندوق دليفري بلوجو. 4 أشكال: سكوتر/عادي/سبورت/كروزر.
import * as THREE from 'three';
import { canvasTex } from './textures.js';
import { buildLoads } from './cargo3d.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// بيئة انعكاسات (للطلاء اللامع والكروم): بتتعمل مرة وتتحط في scene.environment
export function makeEnv(renderer) { const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return t; }

const STYLES = {
  scooter:  { wb: 1.18, wr: 0.27, tw: 0.065, seatY: 0.80, seatZ: 0.22, barY: 1.0,  tank: null, scooter: true, fairing: false, box: 0.46, bodyS: 1.0 },
  standard: { wb: 1.36, wr: 0.34, tw: 0.075, seatY: 0.90, seatZ: 0.22, barY: 1.12, tank: [0.19, 0.14, 0.34], fairing: false, box: 0.52, bodyS: 1.0 },
  sport:    { wb: 1.42, wr: 0.34, tw: 0.095, seatY: 0.92, seatZ: 0.26, barY: 1.04, tank: [0.2, 0.15, 0.36],  fairing: true,  box: 0.5,  bodyS: 1.05, lowBars: true },
  ninja:    { wb: 1.42, wr: 0.33, tw: 0.1, seatY: 0.80, seatZ: 0.30, barY: 0.98, tank: [0.2, 0.15, 0.36], fairing: true, box: 0.46, bodyS: 1.05, lowBars: true, ninja: true },
  cruiser:  { wb: 1.62, wr: 0.36, tw: 0.095, seatY: 0.80, seatZ: 0.30, barY: 1.12, tank: [0.23, 0.17, 0.4],  fairing: false, box: 0.55, bodyS: 1.1, chromeBars: true },
};
export const bikeStyles = Object.keys(STYLES);

// خامات PBR (معدن/خشونة) بدل Phong — شكل أحسن بكتير مع بيئة الانعكاسات
const phong = (c, o = {}) => { const sh = o.shininess === undefined ? 40 : o.shininess; const m = new THREE.MeshStandardMaterial({ color: c, roughness: o.roughness !== undefined ? o.roughness : Math.max(0.06, 1 - sh / 160), metalness: o.metalness || 0, transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity }); return m; };
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const MAT = () => ({
  tyre: phong(0x151515, { roughness: 0.92 }), chrome: phong(0xeef2f6, { roughness: 0.12, metalness: 1 }), steel: phong(0x8a9098, { roughness: 0.38, metalness: 0.85 }),
  dark: phong(0x1c1d20, { roughness: 0.55, metalness: 0.2 }), engine: phong(0x4a4f57, { roughness: 0.42, metalness: 0.75 }), rubber: lam(0x0b0b0c), glass: phong(0x14212c, { roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.85 }), spring: phong(0xd7263d, { roughness: 0.35, metalness: 0.4 }), amber: new THREE.MeshBasicMaterial({ color: 0xffa21a }),
  lampOn: new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), tailOn: new THREE.MeshBasicMaterial({ color: 0xff2a2a }), white: phong(0xf2f2f2, { roughness: 0.4 }), pants: lam(0x24324a), skin: lam(0xc99a74),
});

// عمود بين نقطتين
function limb(a, b, r, mat, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 12), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
const ell = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 18), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
const box = (mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

function logoTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#0e1a2b'; g.beginPath(); g.arc(w / 2, 86, 46, 0, 7); g.fill(); g.fillStyle = '#ffc83d'; g.beginPath(); g.moveTo(w / 2 - 10, 58); g.lineTo(w / 2 + 28, 86); g.lineTo(w / 2 - 10, 114); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 30px Cairo, Tahoma, Arial'; g.fillText('كوكب الجحود', w / 2, 172); g.font = '700 26px Cairo, Tahoma, Arial'; g.fillText('أكتوبر', w / 2, 212);
  }, false);
}
function plateTex() {
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#f4efe0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#1a3d8f'; g.fillRect(6, 6, w - 12, 16); g.fillStyle = '#fff'; g.font = '700 13px Cairo, Tahoma, Arial'; g.textAlign = 'center'; g.fillText('مصر', w / 2, 19);
    g.fillStyle = '#111'; g.font = '800 26px Cairo, Tahoma, Arial'; g.fillText('٦٢١ أ ك', w / 2, 51);
  }, false);
}

// ───── طاقم اللاعب (outfit): ألوان + أنواع قطع + رسومات شفافة بتتلصق كـ decal على الجاكيت/الخوذة/الصندوق ─────
export const OUTFIT_DEFAULT = { top: null, pants: 0x24324a, shoes: 0x1c1d20, helmet: null, skin: 0xc99a74, helmetType: 'full', topType: 'jacket', art: { jacket: null, helmet: null, box: null } };
const artCache = new Map();
function artTexture(url, onReady) { // dataURL → خامة (بتتحمل مرة لكل صورة)
  let t = artCache.get(url); if (t) return t;
  t = new THREE.Texture(); t.colorSpace = THREE.SRGBColorSpace; artCache.set(url, t);
  const img = new Image(); img.onload = () => { t.image = img; t.needsUpdate = true; if (onReady) onReady(); }; img.src = url; return t;
}
function vestTex() { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c6ff2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e9edf0'; g.fillRect(0, 34, w, 14); g.fillRect(0, 80, w, 14); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(w / 2 - 3, 0, 6, h); }, false); }
// قطعة كرة (patch) متمركزة ناحية +z عشان الرسمة تتفرد على ضهر الجاكيت/الخوذة بدل ما تلف 360°
function patch(r, sx, sy, sz, phiLen, thLo, thLen, mat, x, y, z, rotX = 0) {
  const g = new THREE.SphereGeometry(r, 28, 18, Math.PI / 2 - phiLen / 2 - 0 * 0, phiLen, Math.PI * thLo, Math.PI * thLen); const m = new THREE.Mesh(g, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.x = rotX; return m;
}
const patchOnHelmet = (tex) => { const m = patch(1, 0.139, 0.139, 0.139, Math.PI * 0.95, 0.12, 0.62, decalMat(tex), 0, 0, 0, 0); m.renderOrder = 3; return m; };
const decalMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });

export function makeBike(color = 0xff7a1a, style = 'scooter', outfit = null) {
  const O = outfit ? { ...OUTFIT_DEFAULT, ...outfit, art: { ...OUTFIT_DEFAULT.art, ...(outfit.art || {}) } } : null;
  const S = STYLES[style] || STYLES.scooter, M = MAT(), paint = phong(color, { roughness: 0.26, metalness: 0.55 });
  const group = new THREE.Group(), lean = new THREE.Group(); group.add(lean);
  const pitch = new THREE.Group(); pitch.position.set(0, S.wr, S.wb / 2); lean.add(pitch); // محور الويلي = العجلة الورانية
  const rig = new THREE.Group(); rig.position.set(0, -S.wr, -S.wb / 2); pitch.add(rig);
  const tint = (m) => { m.userData.tint = true; return m; };
  const add = (o, parent = rig) => { parent.add(o); return o; };
  const front0 = -S.wb / 2, rear0 = S.wb / 2, wr = S.wr;

  // عجلة بكاوتش وجنط وأسلاك وهَب وديسك
  const wheel = () => {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(wr - S.tw, S.tw, 14, 44), M.tyre); tyre.rotation.y = Math.PI / 2; w.add(tyre);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(wr - S.tw * 1.5, 0.018, 8, 40), M.chrome); rim.rotation.y = Math.PI / 2; w.add(rim);
    for (let i = 0; i < 6; i++) { const sp = box(M.chrome, 0.011, (wr - S.tw * 1.5) * 2, 0.011, 0, 0, 0); sp.rotation.x = (i * Math.PI) / 6; w.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), M.steel); hub.rotation.z = Math.PI / 2; w.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.38, wr * 0.38, 0.012, 14), M.steel); disc.rotation.z = Math.PI / 2; disc.position.x = 0.05; w.add(disc);
    return w;
  };
  const fender = (len) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(wr + 0.05, wr + 0.05, 0.13, 18, 1, true, 0, Math.PI * len), paint.clone()); f.rotation.z = Math.PI / 2; f.material.side = THREE.DoubleSide; tint(f); return f; };

  // ── الجزء الأمامي (بيلف): شوكة + عجلة + دركسيون + فنار + مرايات ──
  const Py = S.barY - 0.18, Pz = front0 + 0.2, fork = new THREE.Group(); fork.position.set(0, Py, Pz); rig.add(fork);
  const front = wheel(); front.position.set(0, wr - Py, front0 - Pz); fork.add(front);
  for (const sx of [-0.085, 0.085]) {
    fork.add(limb([sx, wr - Py + 0.02, front0 - Pz], [sx, 0.02, 0.0], 0.022, M.chrome)); // سيقان الشوكة
    fork.add(limb([sx, wr - Py + 0.3, front0 - Pz + 0.02], [sx, wr - Py + 0.04, front0 - Pz], 0.034, M.steel)); // الخراطيم (المساعدين)
  }
  const ff = fender(1); ff.position.set(0, wr - Py + 0.06, front0 - Pz); fork.add(ff);
  const bars = new THREE.Group(); bars.position.set(0, 0.18, 0.02); fork.add(bars);
  const barY = S.lowBars ? -0.02 : 0;
  bars.add(limb([-0.31, barY, 0.04], [0.31, barY, 0.04], 0.016, M.chrome));
  for (const sx of [-1, 1]) {
    bars.add(limb([sx * 0.31, barY, 0.04], [sx * 0.36, barY - (S.lowBars ? 0.0 : 0.02), -0.0], 0.018, M.chrome));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 8), M.rubber); grip.rotation.z = Math.PI / 2; grip.position.set(sx * 0.34, barY, 0.04); bars.add(grip);
    bars.add(limb([sx * 0.2, barY + 0.01, 0.0], [sx * 0.3, barY + 0.2, 0.0], 0.008, M.dark)); // عمود المراية
    bars.add(ell(M.dark, 0.05, 0.035, 0.012, sx * 0.31, barY + 0.22, 0.0));
    bars.add(box(M.dark, 0.012, 0.06, 0.06, sx * 0.25, barY + 0.0, 0.03)); // ذراع الفرامل
  }
  const lampMesh = ell(M.lampOn, 0.1, 0.095, 0.08, 0, 0.0, -0.14); fork.add(lampMesh); // الفنار الأمامي
  const lampRim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 16), M.chrome); lampRim.position.set(0, 0.0, -0.17); fork.add(lampRim);
  const gauge = ell(M.dark, 0.075, 0.05, 0.04, 0, 0.12, 0.06); fork.add(gauge);
  if (S.fairing) { fork.add(tint(ell(paint.clone(), 0.2, 0.17, 0.22, 0, 0.06, -0.05))); const ws = box(M.glass, 0.26, 0.17, 0.012, 0, 0.26, -0.03); ws.rotation.x = -0.5; fork.add(ws); }
  if (S.scooter) { const apron = ell(paint.clone(), 0.27, 0.36, 0.1, 0, -0.18, -0.02); tint(apron); fork.add(apron); }

  // ── العجلة الورانية + الدراع + الرفرف ──
  const rear = wheel(); rear.position.set(0, wr, rear0); rig.add(rear);
  const rf = fender(0.85); rf.position.set(0, wr + 0.02, rear0 + 0.04); rf.rotation.y = Math.PI; rig.add(rf);
  for (const sx of [-0.1, 0.1]) rig.add(limb([sx, wr, rear0], [sx * 1.1, wr + 0.04, rear0 - S.wb * 0.38], 0.022, M.steel));
  for (const sx of [-0.1, 0.1]) rig.add(limb([sx, wr + 0.3, rear0 - 0.14], [sx, wr + 0.03, rear0], 0.03, M.chrome)); // مساعدين ورا

  // ── الموتور + الزعانف + الشكمان ──
  const ex = S.wb * 0.04, ey = wr + 0.02;
  if (!S.scooter) {
    rig.add(box(M.engine, 0.3, 0.28, 0.36, 0, ey + 0.1, ex - 0.02));
    const cyl = box(M.engine, 0.2, 0.2, 0.2, 0, ey + 0.3, ex - 0.1); cyl.rotation.x = 0.35; rig.add(cyl);
    for (let i = 0; i < 6; i++) { const fin = box(M.steel, 0.25, 0.012, 0.23, 0, ey + 0.2 + i * 0.026, ex - 0.1 - i * 0.003); fin.rotation.x = 0.35; rig.add(fin); }
    rig.add(box(M.steel, 0.1, 0.1, 0.12, 0.2, ey + 0.08, ex + 0.1)); // غطاء السلسلة
    const pipe = limb([0.14, ey + 0.1, ex - 0.15], [0.18, ey - 0.07, ex + 0.1], 0.028, M.chrome); rig.add(pipe);
    const exh = limb([0.18, ey - 0.07, ex + 0.1], [0.22, ey - 0.0, rear0 + 0.2], 0.04, M.chrome); rig.add(exh);
    const muff = limb([0.2, ey - 0.04, ex + 0.45], [0.22, ey + 0.0, rear0 + 0.26], 0.062, M.chrome); rig.add(muff);
    rig.add(limb([0.0, ey + 0.38, front0 + 0.3], [0.0, ey + 0.08, rear0 - 0.2], 0.03, M.dark)); // الشاسيه
  } else { rig.add(box(M.engine, 0.2, 0.2, 0.34, 0.12, ey + 0.05, rear0 - 0.2)); rig.add(limb([0.2, ey + 0.0, rear0 - 0.3], [0.2, ey + 0.05, rear0 + 0.22], 0.05, M.chrome)); }
  for (const sx of [-0.19, 0.19]) { rig.add(limb([sx, ey + 0.08, ex + 0.25], [sx * 1.25, ey + 0.08, ex + 0.25], 0.012, M.steel)); rig.add(box(M.dark, 0.08, 0.02, 0.1, sx * 1.35, ey + 0.08, ex + 0.25)); } // الفوت ريست

  // ── الهيكل والتانك والكرسي والذيل ──
  const seatY = S.seatY, seatZ = S.seatZ;
  if (S.tank) { rig.add(tint(ell(paint.clone(), S.tank[0], S.tank[1], S.tank[2], 0, seatY + 0.12, seatZ - 0.52))); }
  if (S.scooter) {
    rig.add(tint(box(paint.clone(), 0.32, 0.05, 0.6, 0, wr + 0.1, -0.05))); // أرضية السكوتر
    rig.add(tint(ell(paint.clone(), 0.23, 0.22, 0.4, 0, seatY - 0.15, seatZ + 0.28))); // الجسم الخلفي
    rig.add(tint(ell(paint.clone(), 0.2, 0.3, 0.07, 0, seatY - 0.14, seatZ - 0.22))); // عمود التوجيه
  }
  const seat = ell(M.dark, 0.16, 0.055, S.scooter ? 0.38 : 0.34, 0, seatY, seatZ + 0.05); seat.userData.tint = false; rig.add(seat);
  if (S.fairing || style === 'standard') rig.add(tint(ell(paint.clone(), 0.12, 0.08, 0.3, 0, seatY + 0.02, rear0 - 0.04))); // الذيل
  const rack = box(M.dark, 0.5, 0.025, 0.5, 0, seatY + 0.2, rear0 + 0.15); rig.add(rack);
  rig.add(limb([-0.22, wr + 0.2, rear0 - 0.1], [-0.22, seatY + 0.2, rear0 + 0.1], 0.012, M.chrome)); rig.add(limb([0.22, wr + 0.2, rear0 - 0.1], [0.22, seatY + 0.2, rear0 + 0.1], 0.012, M.chrome));
  const tail = box(M.tailOn, 0.14, 0.05, 0.03, 0, seatY + 0.02, rear0 + 0.52); rig.add(tail);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: plateTex(), side: THREE.DoubleSide })); plate.position.set(0, wr + 0.28, rear0 + 0.36); plate.rotation.set(0.15, 0, 0); rig.add(plate);

  // ── صندوق الدليفري بلوجو ──
  const bw = S.box, boxG = new THREE.Group(); boxG.position.set(0, seatY + 0.2 + bw / 2 + 0.02, rear0 + 0.15); rig.add(boxG); boxG.name = 'cargo';
  const logo = logoTex(), lm = new THREE.MeshPhongMaterial({ color: 0xffffff, map: logo, shininess: 20 }), plain = phong(0xff7a1a, { shininess: 30 });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(bw, bw * 0.95, bw), [lm, lm, plain, plain, plain, lm]); boxG.add(cube);
  boxG.add(box(phong(0xffc83d), bw + 0.02, 0.05, bw + 0.02, 0, bw * 0.475, 0)); // الغطا
  if (O && O.art.box) { const dm = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.86, bw * 0.8), decalMat(artTexture(O.art.box))); dm.position.set(0, -0.01, bw / 2 + 0.004); dm.renderOrder = 3; boxG.add(dm); }

  // ── حمولة حسب نوع الطلب (دواء/أكل/طرد/راكب) — بتتحكم فيها setLoad ──
  const LD = buildLoads({ bw, seatY, seatZ, rear0, wr }); rig.add(LD.group);
  let loadKind = null, loadPax = 1, userBox = true, pop = 0;

  // ── السواق ──
  const rider = new THREE.Group(); rig.add(rider);
  const jacket = phong(O && O.top != null ? O.top : color, { shininess: 30 }); if (!O || O.top == null) tint(jacket); const jm = (g) => { if (!O || O.top == null) g.userData.tint = true; return g; };
  const pantsM = O ? lam(O.pants) : M.pants, shoeM = O ? lam(O.shoes) : M.dark, skinM = O ? lam(O.skin) : M.skin;
  const hip = [0, seatY + 0.07, seatZ + 0.08], sh = [0, seatY + 0.52, seatZ - 0.14];
  const torso = ell(jacket, 0.19, 0.27, 0.13, 0, 0, 0); torso.position.set(0, seatY + 0.34, seatZ - 0.05); torso.rotation.x = -0.45; jm(torso); rider.add(torso);
  if (O && O.topType === 'vest') rider.add(patch(1, 0.196, 0.276, 0.136, Math.PI * 1.6, 0.12, 0.76, new THREE.MeshLambertMaterial({ map: vestTex(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, seatY + 0.34, seatZ - 0.05, -0.45));
  if (O && O.art.jacket) { const d = patch(1, 0.2, 0.28, 0.14, Math.PI * 0.95, 0.2, 0.6, decalMat(artTexture(O.art.jacket)), 0, seatY + 0.34, seatZ - 0.05, -0.45); d.renderOrder = 3; rider.add(d); }
  const pack = box(M.white, 0.26, 0.28, 0.1, 0, seatY + 0.37, seatZ + 0.1); pack.rotation.x = -0.45; rider.add(pack); // شنطة ضهر
  const head = new THREE.Group(); head.position.set(0, seatY + 0.74, seatZ - 0.26); rider.add(head);
  const hType = O ? O.helmetType : 'full', helColor = O && O.helmet != null ? O.helmet : color;
  const hel = new THREE.Mesh(new THREE.SphereGeometry(0.135, 28, 20, 0, Math.PI * 2, 0, hType === 'cap' ? Math.PI * 0.46 : Math.PI), phong(helColor, { roughness: 0.14, metalness: 0.35 })); hel.material.userData = {}; if (!O || O.helmet == null) hel.userData.tint = true; head.add(hel);
  if (hType === 'cap') { head.add(ell(skinM, 0.11, 0.12, 0.11, 0, -0.02, 0)); head.add(ell(lam(0x15110d), 0.128, 0.09, 0.128, 0, 0.03, 0.01)); const br = box(hel.material, 0.2, 0.012, 0.11, 0, 0.012, -0.15); br.rotation.x = 0.1; head.add(br); }
  else if (hType === 'open') { head.add(ell(skinM, 0.1, 0.12, 0.1, 0, -0.04, -0.045)); const gl = box(M.glass, 0.17, 0.05, 0.02, 0, 0.0, -0.13); head.add(gl); }
  else { const visor = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, (3 * Math.PI) / 2 - Math.PI / 2.6, Math.PI / 1.3, Math.PI * 0.33, Math.PI * 0.26), M.glass); head.add(visor); head.add(box(M.white, 0.04, 0.03, 0.14, 0, 0.08, 0.0)); }
  if (O && O.topType === 'hoodie') { const hood = ell(jacket, 0.15, 0.13, 0.12, 0, -0.1, 0.1); head.add(hood); }
  const refresh = () => { /* الخامات بتتحدث لوحدها بعد التحميل */ };
  if (O && O.art.helmet) head.add(patchOnHelmet(artTexture(O.art.helmet, refresh)));
  const up = 0.2, kneeZ = seatZ - 0.45, pegZ = seatZ - 0.05;
  for (const sx of [-1, 1]) {
    const shoulder = [sx * 0.2, sh[1] - 0.03, sh[2]], hand = [sx * 0.34, S.barY + 0.0 + (S.lowBars ? -0.02 : 0.0), Pz + 0.06 + 0.0], elbow = [sx * 0.33, (shoulder[1] + hand[1]) / 2 - 0.04, (shoulder[2] + hand[2]) / 2 + 0.05];
    rider.add(limb(shoulder, elbow, 0.05, jacket)); rider.add(limb(elbow, hand, 0.043, jacket));
    const glove = ell(M.dark, 0.05, 0.05, 0.055, hand[0], hand[1], hand[2]); rider.add(glove);
    const hipP = [sx * 0.14, hip[1], hip[2]], knee = [sx * 0.2, seatY + 0.1 + up * 0.2, kneeZ + 0.0], foot = [sx * 0.19, ey + 0.1, pegZ + 0.1];
    rider.add(limb(hipP, knee, 0.065, pantsM)); rider.add(limb(knee, foot, 0.052, pantsM));
    rider.add(box(shoeM, 0.09, 0.07, 0.2, foot[0], foot[1] - 0.02, foot[2] - 0.05)); // الجزمة
  }

  // ── تفاصيل إضافية: مساعدين بسوست، كاليبر فرامل، إشارات، غطاء جانبي، سلسلة، كيك ستاند ──
  for (const sx of [-0.12, 0.12]) { for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 6, 14), M.spring); c.rotation.x = Math.PI / 2 - 0.25; const t = k / 6; c.position.set(sx, wr + 0.06 + t * 0.2, rear0 - 0.02 - t * 0.12); rig.add(c); } }
  for (const sx of [-0.08, 0.08]) fork.add(limb([sx * 1.05, wr - Py + 0.2, front0 - Pz + 0.0], [sx * 1.05, wr - Py + 0.12, front0 - Pz + 0.0], 0.026, M.dark)); // جلد الشوكة
  fork.add(box(M.dark, 0.05, 0.1, 0.07, 0.075, wr - Py + 0.1, front0 - Pz + 0.0)); // كاليبر الفرامل الأمامي
  for (const sx of [-1, 1]) { const sig = ell(M.amber, 0.03, 0.03, 0.03, sx * 0.14, 0.04, -0.05); fork.add(sig); const sigR = ell(M.amber, 0.03, 0.03, 0.03, sx * 0.17, seatY + 0.06, rear0 + 0.5); rig.add(sigR); }
  if (!S.scooter) { for (const sx of [-1, 1]) { const panel = ell(paint.clone(), 0.02, 0.1, 0.16, sx * 0.15, seatY - 0.12, seatZ + 0.04); panel.userData.tint = true; rig.add(panel); } rig.add(limb([0.21, ey + 0.08, ex + 0.2], [0.21, wr + 0.0, rear0], 0.008, M.steel)); } // غطاء جانبي + سلسلة
  rig.add(limb([-0.03, 0.03, rear0 - 0.5], [-0.12, 0.0, rear0 - 0.4], 0.012, M.steel)); // كيك ستاند
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.renderOrder = 1; blob.rotation.x = -Math.PI / 2; blob.position.y = 0.07; blob.scale.set(0.6, 1.5, 1); group.add(blob);
  group.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.tint) o.userData.tint = true; });
  // ── نينجا: فيرنج جانبي + بطن + ذيل + فنارين LED + عدّاد سرعة حي (بيتحدّث من setDash) ──
  let dash = null;
  if (S.ninja) {
    const dk = new THREE.Color(0x0b0d12);
    for (const sx of [-1, 1]) {
      const side = ell(paint.clone(), 0.045, 0.15, 0.4, sx * 0.19, seatY - 0.2, seatZ - 0.42); side.rotation.x = 0.12; tint(side); rig.add(side); // الفيرنج الجانبي
      const fin = ell(paint.clone(), 0.02, 0.07, 0.17, sx * 0.17, ey + 0.34, front0 + 0.3); fin.rotation.z = sx * -0.35; tint(fin); rig.add(fin); // زعنفة الفيرنج الأمامية
      const led = box(M.lampOn, 0.1, 0.022, 0.03, sx * 0.075, 0.075, -0.17); led.rotation.z = sx * 0.2; fork.add(led); // فنار LED
    }
    rig.add(tint(ell(paint.clone(), 0.2, 0.06, 0.44, 0, ey + 0.1, ex - 0.02))); // بطن الموتور
    const cowl = tint(ell(paint.clone(), 0.13, 0.085, 0.4, 0, seatY + 0.06, rear0 - 0.03)); cowl.rotation.x = -0.12; rig.add(cowl); // ذيل أطول مرتفع
    const stripe = box(M.white, 0.012, 0.0125, 0.55, 0, seatY + 0.2, seatZ - 0.5); stripe.userData.tint = false; rig.add(stripe);
    // عدّاد السرعة: لوحة كانفس بتتحدّث
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: tex })); pane.position.set(0, 0.145, 0.034); pane.rotation.x = -0.9; fork.add(pane);
    let lk = -1, lf = -1;
    dash = { draw(kmh, fuel = 1) {
      const k = Math.round(kmh), f = Math.round(fuel * 20); if (k === lk && f === lf) return; lk = k; lf = f;
      g.fillStyle = '#05070b'; g.fillRect(0, 0, 256, 128);
      g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = '#1b2231'; g.beginPath(); g.arc(128, 112, 88, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      const t = Math.min(1, kmh / 200); g.strokeStyle = t > 0.8 ? '#ff4d6d' : '#19c2a0'; g.beginPath(); g.arc(128, 112, 88, Math.PI * 1.1, Math.PI * (1.1 + 0.8 * t)); g.stroke();
      g.fillStyle = '#f7f1e3'; g.font = '800 54px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(k), 128, 86); g.fillStyle = '#8fa0bd'; g.font = '700 16px Arial, sans-serif'; g.fillText('km/h', 128, 106);
      g.fillStyle = '#1b2231'; g.fillRect(70, 118, 116, 6); g.fillStyle = fuel < 0.2 ? '#ff4d6d' : '#ffc83d'; g.fillRect(70, 118, 116 * Math.max(0, Math.min(1, fuel)), 6);
      tex.needsUpdate = true;
    } }; dash.draw(0, 1);
  }
  // نقاط تثبيت السواق (فراغ الـrig): الكرسي والأيادي (بتتحرك مع الدركسيون) والرجلين على الفوت ريست
  const anchors = () => {
    const a = fork.rotation.y, c = Math.cos(a), sn = Math.sin(a), out = { seat: [0, seatY + 0.06, seatZ + 0.02], pegL: [-0.22, ey + 0.1, seatZ - 0.16], pegR: [0.22, ey + 0.1, seatZ - 0.16], head: [0, seatY + 0.56, seatZ - 0.42], dash: [0, S.barY + 0.2, Pz + 0.05] };
    for (const [k, sx] of [['handL', -1], ['handR', 1]]) { const lx = sx * 0.33, lz = 0.04, ly = 0.18 + barY; out[k] = [fork.position.x + lx * c + lz * sn, fork.position.y + ly, fork.position.z - lx * sn + lz * c]; }
    return out;
  };
  const bike = { keep: [rider, boxG, LD.group], anchors, setDash(kmh, fuel) { if (dash) dash.draw(kmh, fuel); }, hasDash: !!dash, rider, group, lean, pitch, rig, fork, front, rear, head: lampMesh, tail, style, riderHead: head, loadKind: null,
    setBoxVisible(v) { userBox = !!v; boxG.visible = userBox && !loadKind; },
    setLoad(kind, pax = 1) { kind = kind || null; if (kind === loadKind && pax === loadPax) return; const had = loadKind; loadKind = kind; loadPax = pax; bike.loadKind = kind; LD.show(kind, pax); boxG.visible = userBox && !kind; if (kind && kind !== had) pop = 1; },
    tickLoad(dt) { if (pop > 0) { pop = Math.max(0, pop - dt * 2.4); LD.group.position.y = Math.sin(pop * Math.PI) * 0.09; } } };
  return bike;
}

export function setBikeColor(b, color) {
  b.group.traverse((o) => { if (o.userData.tint && o.material && o.material.color) o.material.color.setHex(color); });
}
