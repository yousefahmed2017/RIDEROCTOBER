// مؤثرات ومتحركات: جزيئات (شرارات/كونفتي/دخان) · عملات ذهبية · موجات على الأرض · نصوص طايرة (DOM) ·
// شخصيات (موظف/عميل/راكب) بتمشي وبتلوّح · أغراض بتطير من إيد لإيد. quality: 'low' (موبايل ضعيف) | 'high'.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dotTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); return t; }; })();

// ───────── الشخصيات ─────────
const SKIN = [0xf0c8a0, 0xe0ac7c, 0xc99a74, 0xa87850];
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const cap = (r, h, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 3, 8), mat); m.position.set(x, y, z); return m; };

export function itemMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'med') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.26), lam(0xffffff)); g.add(b); const gr = lam(0x17a35a); g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.225, 0.2), gr), {})); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.225, 0.06), gr)); }
  else if (kind === 'food') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.3), lam(0xe8452b)); g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.03, 0.31), lam(0x2b2f36)); s.position.y = 0.12; g.add(s); }
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.3), lam(0xb98a54)); g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.265, 0.31), lam(0xd9c39a)); g.add(t); }
  return g;
}

// look: { woman, shirt, pants, skin, hair, coat (ملابس صيدلي/عامل)، hat }
export function makeActor(look = {}) {
  const g = new THREE.Group(), o = { woman: !!look.woman, shirt: look.shirt ?? 0x2d6cdf, pants: look.pants ?? 0x1b1f2a, skin: look.skin ?? SKIN[(Math.random() * SKIN.length) | 0], hair: look.hair ?? 0x1c1410 };
  const shirt = lam(o.shirt), pants = lam(o.pants), skin = lam(o.skin), hair = lam(o.woman && look.hijab ? look.hijab : o.hair);
  const body = new THREE.Group(); g.add(body);
  const torso = cap(0.19, 0.4, shirt, 0, 1.18, 0); torso.scale.set(1.1, 1, 0.75); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); head.position.y = 1.62; body.add(head);
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.133, 12, 10, 0, Math.PI * 2, 0, Math.PI * (o.woman && look.hijab ? 0.82 : 0.58)), hair); hr.position.set(0, 1.635, 0.012); body.add(hr);
  if (look.coat) { const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.74, 12), lam(look.coat)); coat.position.y = 0.98; body.add(coat); }
  const mkLeg = (x) => { const p = new THREE.Group(); p.position.set(x, 0.88, 0); const l = cap(0.075, 0.62, pants, 0, -0.42, 0); p.add(l); const f = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), lam(0x1c1d20)); f.position.set(0, -0.84, -0.04); p.add(f); body.add(p); return p; };
  const mkArm = (x) => { const p = new THREE.Group(); p.position.set(x, 1.44, 0); const a = cap(0.05, 0.4, look.coat ? lam(look.coat) : shirt, 0, -0.26, 0); p.add(a); const h = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin); h.position.y = -0.52; p.add(h); body.add(p); return p; };
  const legL = mkLeg(-0.1), legR = mkLeg(0.1), armL = mkArm(-0.26), armR = mkArm(0.26);
  g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  const A = { group: g, body, head, legL, legR, armL, armR, mode: 'idle', phase: Math.random() * 6, tx: 0, tz: 0, speed: 2.6, cb: null, yaw: 0, wave: 0, held: null, dead: false, life: 0, fade: 0, hop: 0, look: o, say: null, vis: 1 };
  A.setPos = (x, z) => { g.position.set(x, 0, z); };
  A.face = (x, z) => { const dx = x - g.position.x, dz = z - g.position.z; if (Math.hypot(dx, dz) > 0.01) A.yaw = Math.atan2(-dx, -dz); };
  A.walkTo = (x, z, speed = 2.6, cb = null) => { A.tx = x; A.tz = z; A.speed = speed; A.mode = 'walk'; A.cb = cb; };
  A.waveFor = (sec) => { A.wave = sec; };
  A.hold = (kind) => { if (A.held) { armR.remove(A.held); A.held = null; } if (kind) { const it = itemMesh(kind); it.position.set(0, -0.56, -0.16); armR.add(it); A.held = it; } };
  A.takeItem = () => { const it = A.held; if (it) { armR.remove(it); A.held = null; } return it; };
  A.update = (dt, t) => {
    A.life += dt; let moving = false;
    if (A.mode === 'walk') {
      const dx = A.tx - g.position.x, dz = A.tz - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { A.mode = 'idle'; const cb = A.cb; A.cb = null; cb && cb(A); }
      else { const st = Math.min(d, A.speed * dt); g.position.x += (dx / d) * st; g.position.z += (dz / d) * st; A.yaw = Math.atan2(-dx, -dz); moving = true; }
    }
    let dy = A.yaw - g.rotation.y; dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; g.rotation.y += dy * Math.min(1, dt * 10);
    if (moving) { A.phase += dt * 9; const s = Math.sin(A.phase); legL.rotation.x = s * 0.7; legR.rotation.x = -s * 0.7; armL.rotation.x = -s * 0.55; if (!A.held) armR.rotation.x = s * 0.55; else armR.rotation.x = -1.1; body.position.y = Math.abs(Math.sin(A.phase)) * 0.035; }
    else {
      legL.rotation.x *= 0.8; legR.rotation.x *= 0.8; armL.rotation.x *= 0.85; body.position.y = Math.sin(t * 2 + A.phase) * 0.008;
      if (A.wave > 0) { A.wave -= dt; armR.rotation.x = -2.6; armR.rotation.z = -0.35 + Math.sin(t * 14) * 0.45; }
      else { armR.rotation.z *= 0.8; armR.rotation.x = A.held ? -1.1 : armR.rotation.x * 0.85; }
    }
    if (A.hop > 0) { A.hop -= dt; body.position.y = Math.abs(Math.sin((1 - A.hop / 0.5) * Math.PI * 2)) * 0.22; }
    if (A.fade > 0) { A.fade -= dt; const k = clamp(A.fade / 0.5, 0, 1); g.scale.setScalar(Math.max(0.01, k)); if (A.fade <= 0) A.dead = true; }
  };
  return A;
}

// ───────── المؤثرات ─────────
export function createFX(scene, camera) {
  const cfg = { q: 'high' }, root = new THREE.Group(); scene.add(root);
  // — جزيئات —
  const N = 300; let nAct = N;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), alp = new Float32Array(N), life = new Float32Array(N), maxl = new Float32Array(N), grav = new Float32Array(N), grow = new Float32Array(N), s0 = new Float32Array(N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { map: { value: dotTex() }, scale: { value: 300 } },
    vertexShader: 'attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20; root.add(pts);
  for (let i = 0; i < N; i++) { life[i] = 0; pos[i * 3 + 1] = -999; }
  let cursor = 0; const C = new THREE.Color();
  function emit(x, y, z, vx, vy, vz, color, size, ttl, g = 0, gr = 0) {
    for (let k = 0; k < nAct; k++) { const i = (cursor + k) % nAct; if (life[i] <= 0) { cursor = (i + 1) % nAct; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; C.set(color); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; s0[i] = size; siz[i] = size; life[i] = maxl[i] = ttl; grav[i] = g; grow[i] = gr; alp[i] = 1; return; } }
  }
  const cnt = (n) => Math.round(n * (cfg.q === 'low' ? 0.4 : 1));
  const api = {
    setQuality(q) { cfg.q = q === 'low' ? 'low' : 'high'; nAct = cfg.q === 'low' ? 110 : N; },
    // شرارات في كل الاتجاهات (استلام/تسليم)
    sparkle(x, y, z, color = 0xffc83d, n = 26) { for (let i = 0; i < cnt(n); i++) { const a = Math.random() * 6.283, s = rand(1.5, 4.5); emit(x, y, z, Math.cos(a) * s, rand(2, 6), Math.sin(a) * s, color, rand(0.12, 0.26), rand(0.6, 1.1), -9); } },
    // كونفتي ملون بيهبط
    confetti(x, y, z, n = 34) { const cols = [0xff7a1a, 0x19c2a0, 0xffc83d, 0xff4d6d, 0x4aa8ff]; for (let i = 0; i < cnt(n); i++) { const a = Math.random() * 6.283, s = rand(1, 3.8); emit(x, y, z, Math.cos(a) * s, rand(4, 8), Math.sin(a) * s, cols[i % cols.length], rand(0.14, 0.24), rand(1.2, 1.9), -8); } },
    // سحابة بخار/دخان خفيفة
    puff(x, y, z, n = 10, color = 0xdddddd) { for (let i = 0; i < cnt(n); i++) emit(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(0.4, 1.4), rand(-0.6, 0.6), color, rand(0.35, 0.6), rand(0.7, 1.2), 0, 0.5); },
    // عملات ذهب بتنط
    coins(x, y, z, n = 14) { for (let i = 0; i < Math.min(coinN, cnt(n)); i++) spawnCoin(x, y, z); },
    // موجة على الأرض
    wave(x, z, color = 0xffc83d, r = 7) { const w = waves.find((q) => q.t >= 1) || null; if (!w) return; w.t = 0; w.r = r; w.mesh.material.color.set(color); w.mesh.position.set(x, 0.2, z); w.mesh.visible = true; },
    // نص بيطلع من نقطة في العالم (HTML)
    popup(x, y, z, html, cls = '') { const el = document.createElement('div'); el.className = 'fxpop ' + cls; el.innerHTML = html; layer.appendChild(el); pops.push({ el, x, y, z, t: 0, ttl: 1.9 }); while (pops.length > 12) { const p = pops.shift(); p.el.remove(); } },
    // غرض بيطير من مكان لمكان (قوس)
    fly(kind, from, to, sec = 0.55, done = null) { const m = itemMesh(kind); m.position.copy(from); root.add(m); flies.push({ m, a: from.clone(), b: to.clone(), t: 0, d: sec, done }); },
    actors: [],
    spawnActor(look, x, z) { const a = makeActor(look); a.setPos(x, z); root.add(a.group); api.actors.push(a); return a; },
    removeActor(a, fade = true) { if (fade) a.fade = 0.5; else a.dead = true; },
    clearActors() { for (const a of api.actors) a.dead = true; },
    clearAll() { api.clearActors(); for (const f of flies.splice(0)) root.remove(f.m); for (const p of pops.splice(0)) p.el.remove(); for (let i = 0; i < N; i++) life[i] = 0; for (let i = 0; i < coinN; i++) coin[i].life = 0; },
    update(dt, t) {
      dt = Math.min(dt, 0.05);
      // جزيئات
      let any = false;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { if (alp[i] !== 0) { alp[i] = 0; pos[i * 3 + 1] = -999; any = true; } continue; } any = true;
        life[i] -= dt; const k = 1 - life[i] / maxl[i]; vel[i * 3 + 1] += grav[i] * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05 && grav[i] < 0) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.3; vel[i * 3] *= 0.7; vel[i * 3 + 2] *= 0.7; }
        alp[i] = Math.max(0, 1 - k * k); siz[i] = s0[i] * (1 + grow[i] * k);
      }
      if (any) { geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = geo.attributes.aColor.needsUpdate = true; mat.uniforms.scale.value = (window.innerHeight || 600) * 0.5 / Math.tan((camera.fov * Math.PI) / 360); }
      // عملات
      let coinOn = false;
      for (let i = 0; i < coinN; i++) {
        const c = coin[i]; if (c.life <= 0) { if (c.vis) { c.vis = false; dummy.position.set(0, -999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix); coinOn = true; } continue; } coinOn = true;
        c.life -= dt; c.vy -= 16 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.r += c.spin * dt;
        if (c.y < 0.2) { c.y = 0.2; c.vy *= -0.45; c.vx *= 0.7; c.vz *= 0.7; if (Math.abs(c.vy) < 1) c.vy = 0; }
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.r, c.r * 0.6, Math.PI / 2); dummy.scale.setScalar(Math.min(1, c.life * 2.5)); dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix);
      }
      if (coinOn) coinMesh.instanceMatrix.needsUpdate = true;
      // موجات
      for (const w of waves) { if (w.t >= 1) { w.mesh.visible = false; continue; } w.t += dt / 0.8; const k = Math.min(1, w.t); w.mesh.scale.setScalar(1 + k * w.r); w.mesh.material.opacity = 0.7 * (1 - k) * (1 - k); }
      // أغراض طايرة
      for (let i = flies.length - 1; i >= 0; i--) { const f = flies[i]; f.t += dt; const k = clamp(f.t / f.d, 0, 1); f.m.position.lerpVectors(f.a, f.b, k); f.m.position.y += Math.sin(k * Math.PI) * 0.9; f.m.rotation.y += dt * 6; if (k >= 1) { root.remove(f.m); flies.splice(i, 1); f.done && f.done(); } }
      // شخصيات
      for (let i = api.actors.length - 1; i >= 0; i--) { const a = api.actors[i]; a.update(dt, t); if (a.dead) { root.remove(a.group); api.actors.splice(i, 1); } }
      // نصوص طايرة
      const W = window.innerWidth, H = window.innerHeight;
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.t += dt; if (p.t > p.ttl) { p.el.remove(); pops.splice(i, 1); continue; }
        V.set(p.x, p.y + p.t * 1.3, p.z).project(camera);
        if (V.z > 1 || V.z < -1) { p.el.style.display = 'none'; continue; } p.el.style.display = '';
        const k = p.t / p.ttl; p.el.style.transform = `translate(${((V.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-V.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -50%) scale(${(0.7 + Math.min(1, p.t * 5) * 0.3).toFixed(2)})`; p.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      }
    },
  };
  // — عملات —
  const coinN = 40, dummy = new THREE.Object3D(), V = new THREE.Vector3();
  const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.045, 16), new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.28, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), coinN); coinMesh.frustumCulled = false; root.add(coinMesh);
  const coin = Array.from({ length: coinN }, () => ({ life: 0, vis: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, spin: 0 }));
  for (let i = 0; i < coinN; i++) { dummy.position.set(0, -999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix); }
  function spawnCoin(x, y, z) { const c = coin.find((q) => q.life <= 0); if (!c) return; const a = Math.random() * 6.283, s = rand(1.2, 3.4); Object.assign(c, { life: rand(1.6, 2.3), vis: true, x, y, z, vx: Math.cos(a) * s, vy: rand(5, 9), vz: Math.sin(a) * s, r: Math.random() * 6, spin: rand(8, 18) }); }
  // — موجات الأرض —
  const waves = Array.from({ length: 4 }, () => { const mesh = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })); mesh.rotation.x = -Math.PI / 2; mesh.visible = false; root.add(mesh); return { mesh, t: 1, r: 6 }; });
  const flies = [], pops = [];
  const layer = (() => { let el = document.getElementById('fxlayer'); if (!el) { el = document.createElement('div'); el.id = 'fxlayer'; document.body.appendChild(el); } return el; })();
  return api;
}
