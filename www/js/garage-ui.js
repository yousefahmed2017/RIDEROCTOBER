// واجهة الجراج والمعرض: عرض ثلاثي الأبعاد للموتوسيكل، شراء/ركوب، تطويرات، ألوان، فلوس.
import * as THREE from 'three';
import { makeBike, setBikeColor, makeEnv } from './bikemodel.js';
import { BIKES, BIKE_ORDER, UPGRADES, UPGRADE_ORDER, canBuy, buyBike, selectBike, upgradePrice, buyUpgrade, tankSize, rangeKm, FUEL_PRICE } from './bikes.js';
import { COLORS, saveProfile } from './profile.js';

const $ = (s) => document.querySelector(s);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const bar = (v, max) => `<i style="width:${Math.max(6, Math.min(100, (v / max) * 100))}%"></i>`;
let active = null;

export function openGarage(profile, { onChange = () => {}, onClose = () => {}, toast = () => {}, sfx = null } = {}) {
  if (active) return active;
  const root = $('#garage'); root.classList.remove('hidden');
  let view = profile.bike, model = null, raf = 0, alive = true, rend = null, scene = null, cam = null;

  // ── المعاينة ثلاثية الأبعاد (renderer خاص بتتقفل لما الجراج يتقفل) ──
  const old = $('#g-view'), canvas = old.cloneNode(false); old.replaceWith(canvas); // كانفاس جديد كل مرة (الكونتكست القديم بيتقفل)
  try {
    rend = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); rend.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene(); scene.environment = makeEnv(rend); cam = new THREE.PerspectiveCamera(34, 2, 0.1, 50); cam.position.set(2.7, 1.35, -3.2); cam.lookAt(0, 0.85, 0);
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x3a3f4a, 1.0)); const d = new THREE.DirectionalLight(0xfff2d8, 1.6); d.position.set(3, 5, 4); scene.add(d);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshBasicMaterial({ color: 0x1b2a41 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.62, 1.7, 48), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  } catch (e) { rend = null; }
  function showModel() {
    if (!scene) return; if (model) { scene.remove(model.group); model.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    model = makeBike(profile.color, view); scene.add(model.group); model.group.scale.setScalar(1.15);
  }
  function loop(t) {
    if (!alive || !rend) return; raf = requestAnimationFrame(loop);
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * rend.getPixelRatio())) { rend.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (model) { model.group.rotation.y = t / 2600; model.front.rotation.x = model.rear.rotation.x = t / 900; model.fork.rotation.y = Math.sin(t / 1200) * 0.18; }
    rend.render(scene, cam);
  }

  function render() {
    const b = BIKES[view], owned = !!profile.owned[view], sel = profile.bike === view;
    $('#g-money').textContent = Math.round(profile.money) + ' جنيه';
    $('#g-tabs').innerHTML = BIKE_ORDER.map((id) => `<button class="tab ${id === view ? 'on' : ''}" data-id="${id}">${BIKES[id].name}${profile.owned[id] ? (profile.bike === id ? ' ✔' : '') : ' 🔒'}</button>`).join('');
    $('#g-name').textContent = b.name; $('#g-blurb').textContent = b.blurb;
    $('#g-stats').innerHTML = [
      ['السرعة القصوى', Math.round(b.maxSpeed * 3.6) + ' كم/س', bar(b.maxSpeed, 45)], ['التسارع', b.accel.toFixed(1), bar(b.accel, 15)], ['الفرامل', b.brake, bar(b.brake, 24)],
      ['التانك', b.tank + ' لتر', bar(b.tank, 20)], ['اقتصاد البنزين (واقعي)', Math.round(1 / b.burn) + ' كم/لتر', bar(1 / b.burn, 45)], ['المدى بالتانك (في اللعبة)', '~' + Math.round(rangeKm(b.tank, b.burn)) + ' كم', bar(rangeKm(b.tank, b.burn), 80)],
    ].map(([n, v, bb]) => `<div class="stat"><span>${n}</span><b>${v}</b><div class="meter">${bb}</div></div>`).join('');
    const act = $('#g-action');
    if (sel) { act.textContent = '✔ بتركبها دلوقتي'; act.disabled = true; act.className = 'btn'; }
    else if (owned) { act.textContent = 'اركبها'; act.disabled = false; act.className = 'btn primary'; }
    else { const ok = canBuy(profile, view); act.textContent = ok ? `اشتريها بـ ${b.price} جنيه` : `${b.price} جنيه — فلوسك مش كفاية`; act.disabled = !ok; act.className = ok ? 'btn primary' : 'btn'; }
    act.onclick = () => {
      if (!owned) { if (buyBike(profile, view)) { selectBike(profile, view); sfx && sfx.win(); toast('مبروك! اشتريت ' + b.name, 'good'); } }
      else selectBike(profile, view);
      saveProfile(profile); onChange(); render();
    };
    $('#g-fuel').textContent = `التانك الحالي: ${tankSize(profile).toFixed(1)} لتر · البنزين ${FUEL_PRICE} جنيه/لتر · البنزين دلوقتي ${profile.fuel.toFixed(1)} لتر`;
    $('#g-upg').innerHTML = UPGRADE_ORDER.map((k) => {
      const U = UPGRADES[k], lv = (profile.upg && profile.upg[k]) || 0, price = upgradePrice(profile, k), can = price != null && profile.money >= price;
      const dots = U.price.map((_, i) => `<span class="dot ${i < lv ? 'on' : ''}"></span>`).join('');
      return `<div class="upg"><div><b>${U.icon} ${U.name}</b><small>${U.blurb}</small><div class="dots">${dots}</div></div>
        <button class="btn ${can ? 'primary' : ''}" data-up="${k}" ${can ? '' : 'disabled'}>${price == null ? 'أقصى مستوى' : price + ' جنيه'}</button></div>`;
    }).join('');
    $('#g-colors').innerHTML = COLORS.map((c) => `<div class="sw ${c === profile.color ? 'on' : ''}" data-c="${c}" style="background:${hex(c)}"></div>`).join('');
  }
  root.onclick = (e) => {
    const t = e.target.closest('[data-id],[data-up],[data-c]'); if (!t) return;
    if (t.dataset.id) { view = t.dataset.id; showModel(); render(); }
    else if (t.dataset.up) { if (buyUpgrade(profile, t.dataset.up)) { sfx && sfx.ding(); saveProfile(profile); onChange(); render(); } }
    else if (t.dataset.c) { profile.color = +t.dataset.c; if (model) setBikeColor(model, profile.color); saveProfile(profile); onChange(); render(); }
  };
  $('#g-close').onclick = () => close();

  function close() {
    if (!alive) return; alive = false; cancelAnimationFrame(raf); root.classList.add('hidden'); root.onclick = null; active = null;
    if (rend) { rend.dispose(); try { rend.forceContextLoss(); } catch (e) { /* ignore */ } }
    saveProfile(profile); onClose();
  }
  showModel(); render(); if (rend) raf = requestAnimationFrame(loop);
  active = { close }; return active;
}
export const garageOpen = () => !!active;
