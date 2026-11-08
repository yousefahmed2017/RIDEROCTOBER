// شخصيات GLB متحركة (السواق النازل + المشاة): بتتحمّل من إعدادات الإدارة models.walker / models.ped.
// الحركات بتتوصل بالاسم (idle/walk/run/wave/dance/salute/thumbs/sit/cheer). لو الملف فيه حركة مشي بس، الباقي بيتعوّض بحركة جسم بسيطة.
import * as THREE from 'three';
import { makeGLTFLoader, reportGLB } from './glbloader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { detectRig, createRigPose, solveRide, solveWalk, poseFor } from './rider.js';
export const CHAR_KINDS = ['walker', 'ped', 'model3']; // model3 = شخصية اللاعب (بتركب وبتمشي)
const loader = makeGLTFLoader(), T = {};
export const hasChar = (k) => !!T[k];
export function loadCharModels(slots, base = '') {
  return Promise.all(CHAR_KINDS.map((kind) => new Promise((res) => {
    const s = slots && slots[kind]; delete T[kind]; if (!s || !s.url) return res();
    const url = /^https?:|^data:/.test(s.url) ? s.url : base + s.url;
    loader.load(url, (gltf) => { try { T[kind] = buildTemplate(gltf, s); reportGLB(kind, null, true); } catch (e) { reportGLB(kind, e); } res(); }, undefined, (e) => { reportGLB(kind, e); res(); });
  })));
}
// القياس لازم يتم بعد تحديث مصفوفات العالم والهيكل العظمي؛ وإلا الشخصيات اللي الـ Armature بتاعها متكبّر (زي Quaternius) بتطلع بحجم غلط (كانت بتظهر 5 سم)
export function buildTemplate(gltf, s) {
  const root = gltf.scene; root.updateMatrixWorld(true); root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const box = new THREE.Box3().setFromObject(root, true), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  if (!(size.y > 1e-6)) throw new Error('الموديل فاضي أو حجمه صفر');
  return { root, clips: gltf.animations || [], len: s.length || 1.75, k: (s.length || 1.75) / size.y, cx: c.x, cz: c.z, minY: box.min.y, rotY: s.rotY || 0, y: s.y || 0 };
}
const RX = { idle: /idle|stand|breath|rest/i, walk: /walk/i, run: /run|jog|sprint/i, wave: /wave|hello|greet|hi\b/i, dance: /danc|samba|hip.?hop|twerk|swing|rumba/i, salute: /salut/i, thumbs: /thumb|like|ok\b/i, sit: /sit|crouch|squat/i, cheer: /cheer|victory|celebr|jump|clap/i };
// ───── Model 3: شخصية اللاعب (بتركب النينجا وبتمشي) — الحركات متولّدة من الهيكل العظمي، مش محتاجة أنيميشن جاهز ─────
function buildModel3() {
  const t = T.model3; if (!t) return null;
  const inst = SkeletonUtils.clone(t.root), wrap = new THREE.Group(), holder = new THREE.Group(), mount = new THREE.Group();
  inst.position.set(-t.cx, -t.minY, -t.cz); wrap.add(inst); wrap.scale.setScalar(t.k); wrap.position.y = t.y; holder.add(wrap); holder.rotation.y = Math.PI + t.rotY; mount.add(holder);
  inst.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); mount.updateMatrixWorld(true);
  const rig = detectRig(inst), P = rig ? createRigPose(inst, rig, mount) : null;
  return { inst, wrap, holder, mount, rig, P, t };
}
export const model3Info = () => { const m = buildModel3(); return m ? { rig: !!m.rig, bones: m.rig ? Object.keys(m.rig).filter((k) => m.rig[k]).length : 0 } : null; };
// الراكب: group بيتحط جوه rig الموتوسيكل. update بياخد حالة القيادة
export function makeRiderModel() {
  const m = buildModel3(); if (!m) return null; const state = { lean: 40 };
  return {
    group: m.mount, rigOk: !!m.P,
    // قياسات للاختبار: مواضع العظام في فراغ الـrig (م) مقابل نقاط التثبيت
    debug(bike) {
      if (!m.rig) return null; const r = m.rig, f = (o) => bike.rig.worldToLocal(o.getWorldPosition(new THREE.Vector3())).toArray().map((x) => +x.toFixed(3)), A = bike.anchors();
      return { hips: f(r.hips), head: f(r.head), L: { elbow: f(r.L.fore), hand: f(r.L.hand), knee: f(r.L.shin), foot: f(r.L.foot) }, R: { elbow: f(r.R.fore), hand: f(r.R.hand), knee: f(r.R.shin), foot: f(r.R.foot) }, A };
    },
    update(dt, bike, st) {
      m.mount.updateWorldMatrix(true, true);
      if (m.P) solveRide(m.P, m.mount, bike.rig, { ...st, dt, anchors: bike.anchors() }, state);
      else { const A = bike.anchors(); m.mount.position.set(A.seat[0], A.seat[1] - 0.53 * m.t.len, A.seat[2] + 0.05); m.holder.rotation.x = -0.35 - Math.min(1, Math.abs(st.speed) / 40) * 0.3; } // من غير هيكل بشري: قعدة ثابتة مايلة بدل الحل بالعظام
    },
  };
}
function makeModel3Walker() {
  const m = buildModel3(); if (!m) return null; let t = 0, ph = 0, cur = 'idle';
  const outer = new THREE.Group(); outer.add(m.mount);
  function update(dt, speed = 0, emote = null) {
    t += dt; ph += dt * (4 + speed * 1.6); const pose = poseFor(t, ph, speed, emote); outer.updateWorldMatrix(true, true);
    if (m.P) solveWalk(m.P, m.mount, m.mount, pose);
    m.wrap.position.y += ((m.t.y - (pose.drop || 0)) - m.wrap.position.y) * Math.min(1, dt * 12);
    cur = emote || (speed > 0.2 ? (speed > 3.4 ? 'run' : 'walk') : 'idle'); return cur;
  }
  return { group: outer, update, get anim() { return cur; }, rigOk: !!m.P };
}
export function makeGlbCharacter(kind) {
  if (kind === 'model3') return makeModel3Walker();
  const t = T[kind]; if (!t) return null;
  const inst = SkeletonUtils.clone(t.root), wrap = new THREE.Group(), holder = new THREE.Group(), outer = new THREE.Group();
  inst.position.set(-t.cx, -t.minY, -t.cz); wrap.add(inst); wrap.scale.setScalar(t.k); wrap.position.y = t.y; holder.add(wrap); holder.rotation.y = Math.PI + t.rotY; outer.add(holder); // +Z في glTF = الأمام → إحنا الأمام = -Z
  const mixer = new THREE.AnimationMixer(inst), acts = {};
  for (const c of t.clips) for (const [k, rx] of Object.entries(RX)) if (!acts[k] && rx.test(c.name)) acts[k] = mixer.clipAction(c);
  if (!acts.walk && t.clips.length) acts.walk = mixer.clipAction(t.clips[0]); if (!acts.idle && acts.walk) acts.idle = acts.walk;
  let cur = null, curKey = 'idle', tt = 0;
  function update(dt, speed = 0, emote = null) {
    tt += dt; const key = emote || (speed > 3.4 ? 'run' : speed > 0.2 ? 'walk' : 'idle');
    const have = acts[key], act = have || (key === 'run' ? acts.walk : null) || acts.idle || acts.walk, still = !have && (key === 'idle' || emote) && act === acts.walk;
    if (act && act !== cur) { act.reset().fadeIn(0.25).play(); if (cur) cur.fadeOut(0.25); cur = act; }
    if (cur) cur.timeScale = still && !emote ? 0 : (key === 'walk' || key === 'run') && cur === acts[key] ? Math.max(0.5, Math.min(2.2, speed / 1.4)) : 1;
    mixer.update(dt); curKey = key;
    // تعويض حركة الجسم لو مفيش حركة مخصوصة في الملف
    const lack = emote && !have; wrap.rotation.y += ((lack && emote === 'dance' ? Math.sin(tt * 6) * 0.6 : 0) - wrap.rotation.y) * Math.min(1, dt * 10);
    wrap.position.y += ((t.y + (lack && emote === 'cheer' ? Math.abs(Math.sin(tt * 5)) * 0.25 : 0) + (lack && emote === 'sit' ? -0.35 : 0)) - wrap.position.y) * Math.min(1, dt * 10);
    return curKey;
  }
  return { group: outer, update, get anim() { return curKey; } };
}
