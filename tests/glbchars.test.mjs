// يبني GLB صغير بحركتين (Walk/Wave) ويتأكد إن تحميل الشخصية + اختيار الحركات شغال
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
globalThis.ProgressEvent ??= class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend && this.onloadend(); this.onload && this.onload({ target: this }); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:' + (b.type || 'application/octet-stream') + ';base64,' + Buffer.from(r).toString('base64'); this.onloadend && this.onloadend(); this.onload && this.onload({ target: this }); }); } };
const root = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.3), new THREE.MeshStandardMaterial()); body.name = 'body'; body.position.y = 0.9; root.add(body);
const walk = new THREE.AnimationClip('Armature|Walk', 1, [new THREE.VectorKeyframeTrack('body.position', [0, 0.5, 1], [0, 0.9, 0, 0, 1, 0, 0, 0.9, 0])]);
const wave = new THREE.AnimationClip('Wave_hello', 1, [new THREE.VectorKeyframeTrack('body.scale', [0, 1], [1, 1, 1, 1.1, 1, 1])]);
const glb = await new Promise((res, rej) => new GLTFExporter().parse(root, res, rej, { binary: true, animations: [walk, wave] }));
const url = 'data:model/gltf-binary;base64,' + Buffer.from(glb).toString('base64');
const { loadCharModels, makeGlbCharacter, hasChar } = await import('../www/js/glbchars.js');
await loadCharModels({ walker: { url, length: 1.7 } }, ''); assert(hasChar('walker')); assert(!hasChar('ped'));
const c = makeGlbCharacter('walker'); assert(c);
const box = new THREE.Box3().setFromObject(c.group), h = box.max.y - box.min.y; assert(Math.abs(h - 1.7) < 0.05, 'الطول ' + h);
for (let i = 0; i < 20; i++) c.update(0.016, 0, null); assert.equal(c.anim, 'idle');
for (let i = 0; i < 20; i++) c.update(0.016, 1.5, null); assert.equal(c.anim, 'walk');
for (let i = 0; i < 20; i++) c.update(0.016, 0, 'wave'); assert.equal(c.anim, 'wave');
for (let i = 0; i < 20; i++) c.update(0.016, 0, 'dance'); assert.equal(c.anim, 'dance'); // مفيش حركة رقص → تعويض بحركة جسم
console.log('✓ GLB: تحميل + تحجيم الطول + idle/walk/wave + تعويض الرقص');
// شخصية Skinned والـ Armature بتاعها مكبّر 100 (زي Quaternius) لازم تطلع بالطول المطلوب
{
  const { buildTemplate } = await import('../www/js/glbchars.js');
  const arm = new THREE.Group(); arm.name = 'CharacterArmature'; arm.scale.setScalar(100);
  const b0 = new THREE.Bone(), b1 = new THREE.Bone(); b0.position.y = 0; b1.position.y = 0.0092; b0.add(b1); arm.add(b0);
  const geo = new THREE.BoxGeometry(0.004, 0.0184, 0.003); geo.translate(0, 0.0092, 0);
  const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = geo.attributes.position.getY(i) > 0.0092 ? 1 : 0; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const sm = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial()); sm.add(b0); sm.bind(new THREE.Skeleton([b0, b1])); const sc = new THREE.Group(); sc.add(arm, sm);
  const tpl = buildTemplate({ scene: sc, animations: [] }, { length: 1.75 });
  assert(tpl.k > 0 && tpl.k < 200 && Number.isFinite(tpl.minY), 'k=' + tpl.k);
  const fin = new THREE.Group(), w = new THREE.Group(); w.scale.setScalar(tpl.k); w.add(sc); fin.add(w); fin.updateMatrixWorld(true); sc.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const hh = new THREE.Box3().setFromObject(fin, true).getSize(new THREE.Vector3()).y; assert(Math.abs(hh - 1.75) < 0.1, 'الطول النهائي ' + hh);
  console.log('✓ شخصية Skinned بـ Armature مكبّر: الطول النهائي ' + hh.toFixed(2) + ' م');
}
console.log('\nاختبار شخصيات GLB نجح ✅');
