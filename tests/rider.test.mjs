// اختبارات حل الوضعية: تصنيف أسماء العظام + ركوب النينجا (دقة اليد/الرجل) + المشي من غير أنيميشن جاهز
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classify, detectRig, createRigPose, solveRide, solveWalk, poseFor } from '../www/js/rider.js';
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('تصنيف الأسماء: Mixamo / Rigify / Quaternius / أسماء بسيطة', () => {
  const c = (s) => JSON.stringify(classify(s));
  assert.equal(c('mixamorig:LeftUpLeg'), c('thigh.L').replace('thigh', 'upleg')); // نفس الجانب
  assert.deepEqual(classify('mixamorig:LeftUpLeg'), { side: 'L', key: 'upleg' }); assert.deepEqual(classify('mixamorigRightForeArm'), { side: 'R', key: 'forearm' });
  assert.deepEqual(classify('thigh.L'), { side: 'L', key: 'thigh' }); assert.deepEqual(classify('upper_arm.R'), { side: 'R', key: 'upperarm' }); assert.deepEqual(classify('forearm_L'), { side: 'L', key: 'forearm' });
  assert.deepEqual(classify('UpperLeg.L'), { side: 'L', key: 'upperleg' }); assert.deepEqual(classify('LowerArm.R'), { side: 'R', key: 'lowerarm' }); assert.deepEqual(classify('Hips'), { side: null, key: 'hips' }); assert.deepEqual(classify('mixamorig:Head'), { side: null, key: 'head' });
});

// شخصية تجريبية T-pose 1.75م بأسماء Mixamo
function makeRig(prefix = 'mixamorig:', sx = { Left: 1, Right: -1 }) {
  const root = new THREE.Group(), mk = (name, x, y, z, parent) => { const b = new THREE.Object3D(); b.name = prefix + name; b.position.set(x, y, z); parent.add(b); return b; };
  const hips = mk('Hips', 0, 0.93, 0, root), sp = mk('Spine', 0, 0.1, 0, hips), sp1 = mk('Spine1', 0, 0.13, 0, sp), sp2 = mk('Spine2', 0, 0.14, 0, sp1), neck = mk('Neck', 0, 0.2, 0, sp2); mk('Head', 0, 0.1, 0, neck);
  for (const [s, k] of Object.entries(sx)) { const sh = mk(s + 'Shoulder', k * 0.05, 0.14, 0, sp2), arm = mk(s + 'Arm', k * 0.12, 0, 0, sh), fo = mk(s + 'ForeArm', k * 0.29, 0, 0, arm); mk(s + 'Hand', k * 0.26, 0, 0, fo); const up = mk(s + 'UpLeg', k * 0.09, -0.04, 0, hips), lg = mk(s + 'Leg', 0, -0.44, 0, up), ft = mk(s + 'Foot', 0, -0.42, 0, lg); mk(s + 'ToeBase', 0, -0.07, 0.13, ft); }
  return root;
}
const bikeAnchors = { seat: [0, 0.86, 0.32], handL: [-0.33, 0.96, -0.47], handR: [0.33, 0.96, -0.47], pegL: [-0.22, 0.43, 0.14], pegR: [0.22, 0.43, 0.14] };
function setup(prefix) {
  const scene = new THREE.Scene(), rigObj = new THREE.Group(), mount = new THREE.Group(), holder = new THREE.Group(), inst = makeRig(prefix);
  scene.add(rigObj); rigObj.add(mount); holder.rotation.y = Math.PI; holder.add(inst); mount.add(holder); scene.updateMatrixWorld(true);
  const rig = detectRig(inst); assert.ok(rig, 'rig'); return { scene, rigObj, mount, inst, rig, P: createRigPose(inst, rig, mount) };
}
const dist = (o, a, frame) => { const p = frame.worldToLocal(o.getWorldPosition(new THREE.Vector3())); return Math.hypot(p.x - a[0], p.y - a[1], p.z - a[2]); };

ok('detectRig: بيلاقي كل العظام + عمود الفقار، وبيرجّع null لو ناقص', () => {
  const { rig } = setup(); assert.equal(rig.spine.length, 3); assert.ok(rig.L.foot && rig.R.hand && rig.neck);
  const root = makeRig(); root.getObjectByName('mixamorig:LeftLeg').removeFromParent(); assert.equal(detectRig(root), null);
  assert.ok(detectRig(makeRig('')), 'من غير بادئة mixamorig');
});
ok('ركوب النينجا: الكرسي والإيدين والرجلين على نقط التثبيت بدقة أقل من 2 سم', () => {
  const { scene, rigObj, mount, P } = setup(), st = { lean: 0, steer: 0, speed: 0, throttle: 0, brake: 0, wheelie: false, dt: 0.016, anchors: bikeAnchors }, state = { lean: 44 };
  for (const speed of [0, 20, 40]) { st.speed = speed; solveRide(P, mount, rigObj, st, state); scene.updateMatrixWorld(true);
    assert.ok(dist(P.rig.hips, bikeAnchors.seat, rigObj) < 0.02, 'seat'); assert.ok(dist(P.rig.L.hand, bikeAnchors.handL, rigObj) < 0.02, 'handL ' + dist(P.rig.L.hand, bikeAnchors.handL, rigObj)); assert.ok(dist(P.rig.R.hand, bikeAnchors.handR, rigObj) < 0.02, 'handR');
    assert.ok(dist(P.rig.L.foot, [-0.22, 0.505, 0.14], rigObj) < 0.02, 'footL'); assert.ok(dist(P.rig.R.foot, [0.22, 0.505, 0.14], rigObj) < 0.02, 'footR');
    const head = rigObj.worldToLocal(P.rig.head.getWorldPosition(new THREE.Vector3())), hips = rigObj.worldToLocal(P.rig.hips.getWorldPosition(new THREE.Vector3())), lean = Math.atan2(hips.z - head.z, head.y - hips.y) * 180 / Math.PI;
    assert.ok(lean > 35 && lean < 80, 'lean ' + lean); assert.ok(head.z < hips.z, 'الراس قدام الحوض'); }
});
ok('ركوب: الميل بيزيد مع السرعة، وبيرجع ورا مع الويلي، ومن غير نقط انهيار (NaN)', () => {
  const run = (o) => { const { scene, rigObj, mount, P } = setup(); const state = { lean: 44 }; for (let i = 0; i < 90; i++) solveRide(P, mount, rigObj, { lean: 0, steer: 0, speed: 0, throttle: 0, brake: 0, wheelie: false, dt: 0.016, anchors: bikeAnchors, ...o }, state); scene.updateMatrixWorld(true); const h = rigObj.worldToLocal(P.rig.head.getWorldPosition(new THREE.Vector3())); assert.ok(Number.isFinite(h.x + h.y + h.z)); return state.lean; };
  assert.ok(run({ speed: 40 }) > run({ speed: 0 }) + 5); assert.ok(run({ wheelie: true }) < run({}) - 10);
});
ok('نفس النتيجة من غير بادئة mixamorig وبأسماء Rigify المبسّطة', () => {
  const { scene, rigObj, mount, P } = setup(''); solveRide(P, mount, rigObj, { lean: 0, steer: 0, speed: 10, throttle: 0, brake: 0, dt: 0.016, anchors: bikeAnchors }, { lean: 44 }); scene.updateMatrixWorld(true); assert.ok(dist(P.rig.L.hand, bikeAnchors.handL, rigObj) < 0.02);
});
ok('المشي/الوقوف: الدراعات لتحت (مش مرفوعة T-pose) والرجلين بتتحرك، والإيموجي بيرفع الإيد', () => {
  const { scene, mount, P } = setup(); const sy = (o) => mount.worldToLocal(o.getWorldPosition(new THREE.Vector3())).y, sz = (o) => mount.worldToLocal(o.getWorldPosition(new THREE.Vector3())).z;
  solveWalk(P, mount, mount, poseFor(0, 0, 0, null)); scene.updateMatrixWorld(true); assert.ok(sy(P.rig.L.hand) < sy(P.rig.L.up) - 0.4, 'idle arms down'); assert.ok(sy(P.rig.R.hand) < sy(P.rig.R.up) - 0.4);
  let zs = []; for (let i = 0; i < 40; i++) { solveWalk(P, mount, mount, poseFor(i * 0.05, i * 0.4, 2, null)); scene.updateMatrixWorld(true); zs.push(sz(P.rig.L.foot)); } assert.ok(Math.max(...zs) - Math.min(...zs) > 0.2, 'stride');
  solveWalk(P, mount, mount, poseFor(0.3, 0, 0, 'wave')); scene.updateMatrixWorld(true); assert.ok(sy(P.rig.R.hand) > sy(P.rig.R.up) + 0.2, 'wave raises hand');
  assert.ok(Number.isFinite(sy(P.rig.R.hand)));
});
console.log(`\n${n} اختبارات راكب نجحت ✅`);
