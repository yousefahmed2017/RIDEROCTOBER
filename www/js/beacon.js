// دليل الهدف (استلام/تسليم/مخالف): عمود ضوئي نحيف بتدرج شفاف (من غير حافة مقطوعة) + دايرة نابضة على الأرض بحجم منطقة الاستلام الحقيقية
// + أيقونة عايمة بتكبر وتصغر مع المسافة. العمود بيختفي تدريجيًا لما تقرب منه عشان ما يغطيش الشاشة.
import * as THREE from 'three';

export const BEACON_R = 12; // نفس نصف قطر منطقة الاستلام/التسليم في missions.js

function iconTexture(color, glyph) {
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), col = '#' + new THREE.Color(color).getHexString();
  const grad = g.createRadialGradient(80, 76, 8, 80, 76, 72); grad.addColorStop(0, col); grad.addColorStop(1, 'rgba(0,0,0,0.0)');
  g.globalAlpha = 0.45; g.fillStyle = grad; g.beginPath(); g.arc(80, 76, 74, 0, 7); g.fill(); g.globalAlpha = 1;
  g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(80, 70, 48, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(62, 108); g.lineTo(98, 108); g.lineTo(80, 140); g.closePath(); g.fill(); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(80, 70, 44, 0, 7); g.fill();
  g.font = '700 54px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, 80, 74);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const beamVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const beamFrag = `uniform vec3 uCol; uniform float uA, uT, uNear, uCore; varying vec2 vUv;
void main(){
  float h = clamp(vUv.y, 0.0, 1.0);
  float fade = pow(1.0 - h, 1.6) * smoothstep(0.0, 0.04, h + 0.04);
  float flow = 0.86 + 0.14 * sin((h * 8.0 - uT * 1.4) * 6.2831);
  float side = mix(1.0, 0.72 + 0.28 * abs(sin(vUv.x * 6.2831 * 2.0)), 1.0 - uCore);
  gl_FragColor = vec4(mix(uCol, vec3(1.0), uCore * 0.55), uA * fade * flow * side * uNear);
}`;
const beamMat = (color, a, core) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uCol: { value: new THREE.Color(color) }, uA: { value: a }, uT: { value: 0 }, uNear: { value: 1 }, uCore: { value: core } },
  vertexShader: beamVert, fragmentShader: beamFrag,
});

export function makeBeacon(color = 0xff7a1a, glyph = '📦') {
  const g = new THREE.Group(), H = 46;
  // العمود: أعرض عند الأرض وبيدق لفوق، وجوّاه قلب أنحف وأفتح
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.7, H, 28, 1, true), beamMat(color, 0.5, 0)); beam.position.y = H / 2; beam.renderOrder = 4; g.add(beam);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, H, 16, 1, true), beamMat(color, 0.85, 1)); core.position.y = H / 2; core.renderOrder = 5; g.add(core);
  // الأرض: حلقة بحجم المنطقة + قرص خفيف + موجة بتتوسع
  const gmat = (o, d = 0) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 - d, polygonOffsetUnits: -4 - d });
  const ring = new THREE.Mesh(new THREE.RingGeometry(BEACON_R - 0.55, BEACON_R, 64), gmat(0.9)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; g.add(ring);
  const inner = new THREE.Mesh(new THREE.RingGeometry(BEACON_R * 0.36, BEACON_R * 0.4, 48), gmat(0.55, 1)); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.165; g.add(inner);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(BEACON_R, 64), gmat(0.14, 2)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.15; g.add(disc);
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), gmat(0.6, 3)); wave.rotation.x = -Math.PI / 2; wave.position.y = 0.17; g.add(wave);
  // الأيقونة العايمة
  const tex = { cur: iconTexture(color, glyph) }, spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.cur, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  spr.renderOrder = 998; spr.center.set(0.5, 0.1); g.add(spr);
  const col = new THREE.Color(color);
  function setStyle(c, gl) {
    col.setHex(c); for (const m of [beam.material, core.material]) m.uniforms.uCol.value.copy(col);
    for (const m of [ring.material, inner.material, disc.material, wave.material]) m.color.copy(col);
    if (tex.cur) tex.cur.dispose(); tex.cur = iconTexture(c, gl); spr.material.map = tex.cur; spr.material.needsUpdate = true; g.userData.glyph = gl; g.userData.color = c;
  }
  const _v = new THREE.Vector3();
  // t بالثواني، cam موضع الكاميرا (اختياري) لضبط حجم الأيقونة واختفاء العمود قرب الكاميرا
  g.userData.tick = (t, cam) => {
    let d = 60; if (cam) { g.getWorldPosition(_v); d = Math.hypot(_v.x - cam.x, _v.z - cam.z); }
    const near = Math.max(0, Math.min(1, (d - 5) / 22)); // من 5م لـ 27م العمود يظهر تدريجيًا
    beam.material.uniforms.uT.value = core.material.uniforms.uT.value = t; beam.material.uniforms.uNear.value = near; core.material.uniforms.uNear.value = 0.35 + 0.65 * near;
    const p = 1 + Math.sin(t * 3) * 0.04; ring.scale.set(p, p, 1); inner.rotation.z = t * 0.6;
    const w = (t * 0.55) % 1; wave.scale.setScalar(1 + w * (BEACON_R - 1)); wave.material.opacity = 0.55 * (1 - w) * (1 - w);
    const k = Math.max(1.5, Math.min(11, d * 0.034)); spr.scale.set(k, k, 1); spr.position.y = 6.5 + k * 0.15 + Math.sin(t * 2.4) * 0.35 * Math.min(1.5, k * 0.3);
  };
  g.userData.setStyle = setStyle; g.userData.glyph = glyph; g.userData.color = color;
  g.visible = false; return g;
}
