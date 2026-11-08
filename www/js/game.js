// ═════ October Rider — اللعبة الرئيسية: ربط كل الأجزاء (عالم، فيزياء، ميشنز، شبكة، فويس، واجهة) ═════
import './mapsize.js';
import { currentDistrict, currentDistrictId, DEFAULT_DISTRICT, DISTRICTS, districtOf, setDistrict, setDistrictCoords, resetDistrictCoords, servicesText } from './districts.js'; // لازم يتحمّل بدري: بيضبط مركز الخريطة على الحي المختار // لازم أول استيراد: بيضبط حجم الخريطة قبل ما باقي الملفات تقراه
import * as THREE from 'three';
import { CITY, NET, HOME } from './config.js';
import { makeProjector, overpassQuery, parseOSM, proceduralCity, RoadIndex, BuildingIndex, mulberry32, SIDEWALK_W, KERB_H } from './geo.js';
import { newBike, stepBike } from './physics.js';
import { makeOffer, retimeOffer, startMission, tickMission, hitMission, scoreMission, levelFor, trafficFor } from './missions.js';
import { loadProfile, saveProfile, publicProfile, recordSuccess, recordFail, levelOf, avgTime, avgRating, successRate, COLORS } from './profile.js';
import { makeSkyDome, canvasTex } from './textures.js';
import { buildWorld, makeBike, setBikeColor, makeLabel, makeBeacon, makeVehicle, makeGarage, makeStation, makeRamp, buildHighway, HIGHWAY, skyFor, getCairoHour, makeStars } from './world.js';
import { makeAgent, placeAgent, stepAgent } from './traffic.js';
import { Net } from './network.js';
import { Voice } from './voice.js';
import { Sfx } from './audio.js';
import { BIKES, resolveBikeId, bikeParams, currentBike, tankSize, burnFuel, rangeKm, towFine, MIN_TOW_FUEL, FUEL_PRICE } from './bikes.js';
import { createPump } from './pump.js';
import { newPatrol, tickPatrol, patrolReward, PATROL_NAMES, newEndless, stepEndless, endlessReward, HW } from './modes.js';
import { infillBuildings, placeSites, garageFor, makeStations, dropBuildingsOnRoads } from './city.js';
import { openGarage, garageOpen } from './garage-ui.js';
import { openWardrobe } from './wardrobe-ui.js';
import { makeEnv } from './bikemodel.js';
import { buildProps } from './props.js';
import { makeLife } from './life.js';
import { setVehicleNight, loadVehicleModels, getGLBClone } from './vehicles.js';
import { loadContent, serverBase, setServerBase } from './content.js';
import { initAccount, openAccount } from './account.js';
import { MAP_SIZES, currentMapSize, setMapSize } from './mapsize.js';
import { confineWorld, createOrdersOverlay, stuntTick, setCargo, createQuickPanel, createMusic, polishSigns } from './extras.js';
import { resolveMessage, normalizeMessages } from './messages.js';
import { initAdmin, openAdminLogin, openAdminPanel, adminLogout, adminLoggedIn, adminAddMusicFromPlayer, adminCan } from './admin-ui.js';
import { waLink } from './contact.js';
import { createAdminFab } from './adminfab.js';
import { applyElevation, elevAtS } from './elevation.js';
import { buildDecks } from './bridges3d.js';
import { speak } from './speech.js';
import { RACE, buildRoute, newRace, tickRace, raceReward, fmtRace } from './race.js';
import { pickScenario, resolveChoice } from './customer.js';
import { createGovernor, GFX_LEVELS } from './autoquality.js';
import { Lite } from './lite2d.js';
import { INFO } from './info.js';
import { createPreloader } from './preloader.js';
import { createAdSlots } from './adslots.js';
import { loadCharModels, makeGlbCharacter, hasChar, makeRiderModel } from './glbchars.js';
import { setGLBErrorHandler, setGLBRenderer, glbStatus } from './glbloader.js';
import { localModelSlots } from './localmodels.js';
import { createWalker, EMOTES, EMOTE_KEYS } from './walker.js';
import { createMixer } from './mixer.js';
import { makeFloating } from './float.js';
import { beaconStyle, loadCode, loadFromCode, LOADS } from './loads.js';
import { createFX } from './fx.js';
import { toOverpass } from './geoimport.js';
import { HOLD_TIME } from './missions.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => ((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

const profile = loadProfile();
const sfx = new Sfx(), voice = new Voice(), net = new Net();
const S = {
  state: 'menu', data: null, roads: null, bIdx: null, world: null, bike: newBike(), mission: null, offer: null, offers: [], offerAt: 0,
  remotes: new Map(), agents: [], timeMode: 'real', online: false, keys: {}, touch: { l: 0, r: 0, gas: 0, brake: 0 }, steerS: 0, revHold: 0,
  mode: 'delivery', paused: false, engOn: false, engT: 0, tow: null, params: null, stations: [], garageSlots: [], garage: null, myGarage: null, garages: new Map(), drives: new Map(), solids: new Map(), curbCD: 0, bikeY: 0,
  patrol: null, violator: null, patrolNext: 0, endless: null, hw: null, ePool: { car: [], bus: [], tuktuk: [] }, wheelie: false, pitch: 0, saveT: 0, nearSt: null, lowWarned: false, refuelAcc: 0, refuelTick: 0, mMin: false, mTouched: false,
  shake: 0, propT: 0, locT: 0, clock: 0, hudT: 0, mmT: 0, skyT: 0, stuck: 0, camH: 0, camYaw: 0, camPit: 0, camIdle: 0, camDrag: false, fallSign: 1, lastLean: 1, lbOpen: false, slowAt: -9, agentT: 0, spawned: false, lastToast: '', lastToastAt: 0,
};

const pump = createPump({ getProfile: () => profile, sfx, onDone: ({ cost }) => { say('refueled', { n: Math.round(cost) }); saveProfile(profile); } });

// ───────── Three.js ─────────
const renderer = new THREE.WebGLRenderer({ canvas: $('#view'), antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd0ff); scene.fog = new THREE.Fog(0x8fd0ff, 90, 720);
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1800);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a5a, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d0, 1); scene.add(sun, sun.target);
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 600 }); sun.shadow.camera.updateProjectionMatrix();
const skyDome = makeSkyDome(); scene.add(skyDome);
try { scene.environment = makeEnv(renderer); scene.environmentIntensity = 0.9; } catch (e) { /* بدون انعكاسات */ }
// جودة الرسم: low (افتراضي للموبايل) / high (ظلال + دقة أعلى)
function pushDensity() { const d = (S.autoQ && GFX_LEVELS[S.autoQ.level].density) || S.density; if (S.life) S.life.setDensity(d); if (S.props) S.props.setDensity(d); }
function applyGfx(lv) { // مستوى جرافيك تلقائي (autoquality.js)
  const g = GFX_LEVELS[lv], was = renderer.shadowMap.enabled; renderer.shadowMap.enabled = g.shadows; sun.castShadow = g.shadows; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, g.pr)); resize();
  if (was !== g.shadows) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  pushDensity();
}
function applyQuality(q) {
  S.quality = q; const hi = q === 'high';
  if (q === 'auto') { S.autoQ = createGovernor({ start: (window.devicePixelRatio || 1) >= 2 ? 1 : 2, onLevel: (l) => applyGfx(l) }); applyGfx(S.autoQ.level); try { localStorage.setItem('orider-quality', q); } catch (e) { /* ignore */ } return; }
  S.autoQ = null; pushDensity();
  renderer.shadowMap.enabled = hi; sun.castShadow = hi; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.5)); resize();
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  try { localStorage.setItem('orider-quality', q); } catch (e) { /* ignore */ }
}
const stars = makeStars(); scene.add(stars);
let me = makeBike(profile.color, resolveBikeId(profile.bike), profile.outfit); scene.add(me.group);
const pickR = (a) => a[Math.floor(Math.random() * a.length)];
// موتوسيكل/اسكوتر GLB من الإدارة (models.myscooter / models.mymoto): بيحل محل الجسم، والسواق والصندوق يفضلوا زي ما هم
function useBikeGLB(b, style) {
  const h = getGLBClone(style === 'ninja' ? 'ninja' : style === 'scooter' ? 'myscooter' : 'mymoto'); if (!h || b.glbOn) return; b.glbOn = true;
  for (const c of b.rig.children) if (!b.keep.includes(c)) c.visible = false; b.rig.add(h);
}
// Model 3 = شخصية اللاعب الوحيدة: بتتركّب جوه rig الموتوسيكل (الراكب الافتراضي بيتخفي)
function attachRider(b) { if (b.glbRider || !hasChar('model3')) return; const r = makeRiderModel(); if (!r) return; b.glbRider = r; b.rig.add(r.group); b.keep.push(r.group); b.rider.visible = false; }
function setRiderVis(b, v) { b.rider.visible = !!v && !b.glbRider; if (b.glbRider) b.glbRider.group.visible = !!v; }
function decorateMe() { useBikeGLB(me, resolveBikeId(profile.bike)); attachRider(me); me.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); setBikeColor(me, profile.color); }
function setMyBike() { scene.remove(me.group); me = makeBike(profile.color, resolveBikeId(profile.bike), profile.outfit); scene.add(me.group); decorateMe(); S.params = bikeParams(profile); try { applyLoad(); } catch (e) { /* قبل التهيئة */ } }
S.params = bikeParams(profile);
// تفضيلات الواجهة (تصغير الكروت) محفوظة على الجهاز
const ui = (() => { try { return JSON.parse(localStorage.getItem('orider-ui-v1')) || {}; } catch (e) { return {}; } })();
const saveUI = () => { try { localStorage.setItem('orider-ui-v1', JSON.stringify(ui)); } catch (e) { /* ignore */ } };
S.mMin = !!ui.mMin;
const bPick = makeBeacon(0xff7a1a, '📦'), bDrop = makeBeacon(0x19c2a0, '🏁'), bPatrol = makeBeacon(0xff4d6d, '🚨'), bRace = makeBeacon(0xffc83d, '🏁'); scene.add(bPick, bDrop, bPatrol, bRace); bRace.visible = false;
const fx = createFX(scene, camera); fx.setQuality(profile.settings.fx);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// ───────── تحميل المدينة (OpenStreetMap → ألعاب) ─────────
const proj = makeProjector(CITY.center.lat, CITY.center.lon);
async function gunzipB64(b64) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
async function loadCityData(onStatus) {
  const key = 'orider-osm-' + CITY.cacheVer, D = currentDistrict(), isD = D.id !== DEFAULT_DISTRICT || D.edited; // isD: حي/معلم غير الافتراضي
  let json = null;
  // سحب مباشر من OpenStreetMap (مع كاش على الجهاز)
  const live = async () => {
    try { const c = localStorage.getItem(key); if (c) { const j = JSON.parse(c); if (j.elements && j.elements.length > 50) { onStatus('خريطة ' + D.name + ' متخزنة على جهازك ✔'); return j; } } } catch (e) { /* ignore */ }
    const body = 'data=' + encodeURIComponent(overpassQuery(CITY.center, CITY.half));
    for (const ep of CITY.overpass) {
      try {
        onStatus('بنسحب شوارع ومباني ' + (isD ? D.name : '6 أكتوبر') + ' الحقيقية من OpenStreetMap…');
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
        const r = await fetch(ep, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(to);
        if (!r.ok) continue;
        const j = await r.json();
        if (j.elements && j.elements.length > 50) { try { localStorage.setItem(key, JSON.stringify(j)); } catch (e) { /* الكاش اختياري */ } return j; }
      } catch (e) { /* جرّب السيرفر اللي بعده */ }
    }
    return null;
  };
  // 0) بلوك الحي: ملف أصغر (data/blocks/<id>.json) لما اللعبة متقدّمة من سيرفر
  if (isD && !D.edited && /^https?:/.test(location.protocol)) { try { const r = await fetch('data/blocks/' + D.id + '.json'); if (r.ok) { const j = toOverpass(await r.json()); if (j.elements && j.elements.length > 50) { json = j; onStatus('بلوك ' + D.name + ' ✔'); } } } catch (e) { /* مفيش بلوك: الملف الكبير */ } }
  if (!json && typeof window !== 'undefined' && window.__OSM_GZ__) { // الخريطة الحقيقية مدمجة في الملف (gzip + base64)
    try { onStatus('بنفتح خريطة أكتوبر والشيخ زايد المدمجة…'); json = toOverpass(await gunzipB64(window.__OSM_GZ__)); } catch (e) { console.error('osm-embedded', e); json = null; }
  }
  if (!json && /^https?:/.test(location.protocol)) { try { const r = await fetch('data/osm.json', { cache: 'no-cache' }); if (r.ok) { const j = toOverpass(await r.json()); if (j.elements && j.elements.length > 50) { json = j; onStatus('خريطة أكتوبر من ملف data/osm.json ✔'); } } } catch (e) { /* مفيش ملف */ } }
  if (!json) json = await live();
  let data = json ? parseOSM(json, proj, CITY.half) : null;
  // الحي برّه الملف المدمج (بيانات قليلة): نسحبه من النت
  if (isD && json && data.roads.length < 60) { onStatus('«' + D.name + '» مش مغطّى كفاية في الملف المدمج — بنسحبه من النت…'); const lj = await live(); if (lj) { const d2 = parseOSM(lj, proj, CITY.half); if (d2.roads.length >= 20) data = d2; } }
  if (!data || data.roads.length < 20) { onStatus('مفيش نت للخريطة الحقيقية — بنفتح مدينة بديلة'); data = proceduralCity(CITY.half); }
  data.half = CITY.half; addDistrictLabels(data); return data;
}
// تقسيم الخريطة لأحياء: كل مرساة حي (من OSM) بتبقى «مكان» عشان اسم الحي في الـHUD يتغيّر وإنت ماشي (أقرب مرساة)، والمعلم بيتضاف كوجهة
function addDistrictLabels(data) {
  const D = currentDistrict(); data.places = data.places || []; data.pois = data.pois || [];
  for (const d of DISTRICTS) { if (d.kind !== 'district') continue; const dd = districtOf(d.id), q = proj.toLocal(dd.lat, dd.lon); if (Math.abs(q.x) <= CITY.half * 1.8 && Math.abs(q.z) <= CITY.half * 1.8 && !data.places.some((p) => p.district === d.id)) data.places.push({ x: q.x, z: q.z, name: d.name, kind: 'suburb', district: d.id }); }
  if (D.id !== DEFAULT_DISTRICT && !data.places.some((p) => Math.hypot(p.x, p.z) < 800)) data.places.unshift({ x: 0, z: 0, name: D.name, kind: 'suburb', district: D.id }); // اسم المنطقة المختارة يظهر في الـHUD
  if (D.kind === 'landmark' && D.poi && !data.pois.some((p) => p.landmark)) data.pois.push({ x: 0, z: 0, name: D.poi, kind: 'place', landmark: true });
}

// ───────── أسماء الشوارع والأحياء ─────────
function roadTitle(r) { const n = r.name || ''; if (n && /^(شارع|طريق|محور|ميدان|كوبري|محور)/.test(n)) return n; if (n) return 'شارع ' + n; if (r.ref) return 'طريق ' + r.ref; return ''; }
function buildLabels(data) {
  const out = [], byName = new Map();
  for (const r of data.roads) { const t = roadTitle(r); if (!t || r.rank < 1) continue; (byName.get(t) || byName.set(t, []).get(t)).push(r); }
  for (const [t, list] of byName) for (const r of list) {
    const L = r._len || 0; if (L < 40) continue; const n = Math.max(1, Math.floor(L / 260));
    for (let k = 0; k < n; k++) {
      const s = L * ((k + 0.5) / n); let i = 0; while (i < r._cum.length - 2 && r._cum[i + 1] < s) i++;
      const a = r.pts[i], b = r.pts[i + 1], seg = r._cum[i + 1] - r._cum[i] || 1, u = (s - r._cum[i]) / seg; out.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, t, rank: r.rank });
    }
  }
  S.labels = out; S.places = (data.places || []).slice();
}
const districtAt = (x, z) => { let best = null, bd = 1e18; for (const p of S.places || []) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best ? best.name : HOME.district; };
function streetAt(x, z) { const q = S.roads.nearest(x, z, 24); return q ? roadTitle(q.road) || 'شارع بدون اسم' : ''; }
// ───────── أسماء الشوارع اللي الإدارة عدّلتها (content.streetNames: { 'way/123': 'اسم' }) ─────────
function applyStreetNames() {
  const map = (S.content && S.content.streetNames) || {}; let n = 0;
  for (const r of S.data.roads) {
    if (r._origName === undefined) r._origName = r.name;
    const o = r.osm && map[r.osm]; r.name = o ? o : r._origName; if (o) n++;
  }
  buildLabels(S.data); S.curStreet = null; return n;
}
// أقرب شارع للاعب (للوحة الإدارة): المعرّف + الاسم + عدد الأجزاء المتصلة اللي مالهاش اسم
function streetInfo() {
  if (S.state !== 'playing') return null; const q = S.roads.nearest(S.bike.x, S.bike.z, 40); if (!q || !q.road.osm) return null;
  const r = q.road, chain = connectedUnnamed(r); return { id: r.osm, name: roadTitle(r), type: r.type, chain: chain.map((x) => x.osm) };
}
function connectedUnnamed(r0) { // الأجزاء المتصلة بنفس النوع ومن غير اسم (بنفس نقطة النهاية) — لتسمية شارع كامل مرة واحدة
  if (r0.name || r0.ref) return [r0]; const key = (p) => Math.round(p.x * 2) + ',' + Math.round(p.z * 2), ends = new Map();
  for (const r of S.data.roads) { if (r.name || r.ref || r.type !== r0.type || !r.osm) continue; for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) { const k = key(p); (ends.get(k) || ends.set(k, []).get(k)).push(r); } }
  const seen = new Set([r0]), q = [r0];
  while (q.length && seen.size < 40) { const r = q.shift(); for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) for (const o of ends.get(key(p)) || []) if (!seen.has(o) && (ends.get(key(p)) || []).length === 2) { seen.add(o); q.push(o); } }
  return [...seen];
}
function locationTick(b) {
  const st = streetAt(b.x, b.z), ds = districtAt(b.x, b.z);
  if (st !== S.curStreet) { S.curStreet = st; $('#street').textContent = st || 'خارج الشارع'; }
  if (ds !== S.curDistrict) {
    const first = S.curDistrict === undefined; S.curDistrict = ds; $('#district').textContent = ds;
    if (!first) { const el = $('#dbanner'); el.innerHTML = `دخلت ${/^(حي|الحي|منطقة|الأحياء)/.test(ds) ? '' : 'حي '}${esc(ds)}<small>6th of October City</small>`; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; sfx.ding(); }
  }
}
const FMT_LABEL = (g, t, x, y, size) => { g.font = `800 ${size}px Cairo, Tahoma, Arial`; g.lineWidth = 4; g.strokeStyle = 'rgba(8,16,30,.92)'; g.strokeText(t, x, y); g.fillStyle = '#fff'; g.fillText(t, x, y); };
function drawBigMap() {
  const c = $('#bm'), g = c.getContext('2d'), N = c.width, k = N / (2 * CITY.half);
  g.fillStyle = '#0f1b2e'; g.fillRect(0, 0, N, N); if (mmOff) g.drawImage(mmOff, 0, 0, N, N);
  const P = (x, z) => [(x + CITY.half) * k, (z + CITY.half) * k]; g.textAlign = 'center'; g.textBaseline = 'middle';
  const seen = []; const clear = (x, y, w) => !seen.some(([sx, sy, sw]) => Math.abs(sx - x) < (sw + w) / 2 && Math.abs(sy - y) < 16); 
  for (const l of (S.labels || []).slice().sort((a, b) => b.rank - a.rank)) { if (l.rank < 2) continue; const [x, y] = P(l.x, l.z); g.font = '800 15px Cairo, Tahoma, Arial'; const w = g.measureText(l.t).width; if (!clear(x, y, w)) continue; seen.push([x, y, w]); FMT_LABEL(g, l.t, x, y, 15); }
  for (const p of S.places || []) { const [x, y] = P(p.x, p.z); g.fillStyle = 'rgba(255,200,61,.95)'; FMT_LABEL(g, p.name, x, y - 26, 22); }
  const dot = (x, z, col, r) => { const [px, py] = P(x, z); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke(); };
  if (S.garage) dot(S.garage.ex, S.garage.ez, '#ffc83d', 9); for (const st of S.stations) dot(st.px, st.pz, '#4aa8ff', 6); for (const r of S.remotes.values()) dot(r.x, r.z, hex(r.profile.color || 0xffffff), 8);
  const m = S.mode === 'delivery' ? (S.mission || S.offer) : null; if (m) { const t = S.mission && m.stage === 'dropoff' ? m.dropoff : m.pickup; dot(t.x, t.z, S.mission && m.stage === 'dropoff' ? '#19c2a0' : '#ff7a1a', 11); }
  const [bx, by] = P(S.bike.x, S.bike.z); g.save(); g.translate(bx, by); g.rotate(S.bike.heading); g.fillStyle = '#fff'; g.strokeStyle = '#ff7a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke(); g.restore();
}
let mmOff = null, mmS = 1;
function prerenderMinimap(data) {
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); mmS = N / (2 * CITY.half);
  g.fillStyle = '#0f1b2e'; g.fillRect(0, 0, N, N); g.save(); g.scale(mmS, mmS); g.translate(CITY.half, CITY.half);
  g.fillStyle = '#1d2d47'; for (const b of data.buildings) { g.beginPath(); b.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.closePath(); g.fill(); }
  g.lineCap = g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of data.roads) {
    if ((r.rank >= 3) !== (pass === 1)) continue;
    g.strokeStyle = pass ? '#dfe7f5' : '#5b6b86'; g.lineWidth = Math.max(2.5, r.w * 0.9);
    g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.stroke();
  }
  g.restore(); mmOff = c;
}
const mm = $('#minimap').getContext('2d');
function drawMinimap() {
  const W = 320, R = W / 2, view = 230, k = R / view, b = S.bike, h = b.heading, ch = Math.cos(h), sh = Math.sin(h);
  mm.clearRect(0, 0, W, W); mm.save(); mm.beginPath(); mm.arc(R, R, R, 0, 7); mm.clip();
  if (mmOff) { mm.save(); mm.translate(R, R); mm.rotate(-h); mm.scale(k / mmS, k / mmS); mm.drawImage(mmOff, -(b.x + CITY.half) * mmS, -(b.z + CITY.half) * mmS); mm.restore(); }
  const mark = (x, z, col, r, edge) => {
    const dx = x - b.x, dz = z - b.z; let sx = k * (dx * ch + dz * sh), sy = k * (-dx * sh + dz * ch); const d = Math.hypot(sx, sy), lim = R - 12;
    if (d > lim) { if (!edge) return; sx *= lim / d; sy *= lim / d; }
    mm.fillStyle = col; mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.beginPath(); mm.arc(R + sx, R + sy, r, 0, 7); mm.fill(); mm.stroke();
  };
  // أسماء الشوارع حواليك (نص أفقي دايمًا عشان يتقري)
  { mm.textAlign = 'center'; mm.textBaseline = 'middle'; const placed = [];
    for (const l of S.labels || []) {
      const dx = l.x - b.x, dz = l.z - b.z; if (Math.abs(dx) > view || Math.abs(dz) > view) continue;
      const sx = k * (dx * ch + dz * sh), sy = k * (-dx * sh + dz * ch); if (Math.hypot(sx, sy) > R - 26) continue;
      mm.font = '800 13px Cairo, Tahoma, Arial'; const w = mm.measureText(l.t).width; if (placed.some(([px, py, pw]) => Math.abs(px - sx) < (pw + w) / 2 && Math.abs(py - sy) < 14)) continue; placed.push([sx, sy, w]);
      mm.lineWidth = 4; mm.strokeStyle = 'rgba(8,16,30,.95)'; mm.strokeText(l.t, R + sx, R + sy); mm.fillStyle = l.rank >= 3 ? '#ffe9a8' : '#fff'; mm.fillText(l.t, R + sx, R + sy);
    } }
  for (const r of S.remotes.values()) mark(r.x, r.z, hex(r.profile.color || 0xffffff), 5, false);
  for (const st of S.stations) mark(st.px, st.pz, '#4aa8ff', 4.5, false);
  if (S.garage) mark(S.garage.ex, S.garage.ez, '#ffc83d', 6, true);
  if (S.mode === 'race' && S.race && S.race.stage !== 'finished') mark(S.race.route[S.race.next].x, S.race.route[S.race.next].z, '#ffc83d', 8, true);
  if (S.violator && S.patrol && S.patrol.stage !== 'caught') mark(S.violator.a.x, S.violator.a.z, '#ff4d6d', 8, true);
  const m = S.mode === 'delivery' ? (S.mission || S.offer) : null;
  if (m) { if (S.mission && m.stage === 'dropoff') mark(m.dropoff.x, m.dropoff.z, '#19c2a0', 8, true); else if (S.mission) mark(m.pickup.x, m.pickup.z, '#ff7a1a', 8, true); else mark(m.pickup.x, m.pickup.z, 'rgba(255,122,26,.6)', 6, true); }
  mm.fillStyle = '#fff'; mm.strokeStyle = '#ff7a1a'; mm.lineWidth = 3; mm.beginPath(); mm.moveTo(R, R - 11); mm.lineTo(R + 8, R + 9); mm.lineTo(R, R + 4); mm.lineTo(R - 8, R + 9); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
}

// ───────── بدء العالم ─────────
// قناع المناطق العمرانية: خلية 200م فيها (أو حواليها بمسافة خليتين) مبنى حقيقي واحد على الأقل. بنمنع تعبئة الصحرا.
function builtUpMask(buildings, pois, cell = 200) {
  const cnt = new Map(), add = (x, z) => { const k = Math.floor(x / cell) + ',' + Math.floor(z / cell); cnt.set(k, (cnt.get(k) || 0) + 1); };
  for (const b of buildings) { const c = b.pts[0]; add(c.x, c.z); } for (const p of pois || []) add(p.x, p.z);
  return (x, z) => { const cx = Math.floor(x / cell), cz = Math.floor(z / cell); for (let a = -2; a <= 2; a++) for (let d = -2; d <= 2; d++) if (cnt.has((cx + a) + ',' + (cz + d))) return true; return false; };
}
async function loadWorld() {
  const data = await loadCityData(setLoading);
  setLoading('بنبني المدينة… (' + data.buildings.length + ' مبنى · ' + data.roads.length + ' شارع)');
  await new Promise((r) => setTimeout(r, 30));
  try { applyElevation(data.roads, { outside: (p) => Math.abs(p.x) > CITY.half + 60 || Math.abs(p.z) > CITY.half + 60 }); } catch (e) { console.error('elevation', e); } // كباري ومنحدرات (لازم قبل فهرس الشوارع)
  const groundR = data.roads.filter((r) => !r.deck); S.hasElev = groundR.length !== data.roads.length;
  S.data = data; S.roads = new RoadIndex(data.roads); confineWorld(data, S.roads, CITY.half); buildLabels(data);
  data.buildings = dropBuildingsOnRoads(data.buildings, S.roads).keep; // شيل أي مبنى فوق الأسفلت أو لازق فيه
  const b0 = new BuildingIndex(data.buildings);
  const infill = infillBuildings(groundR, S.roads, b0, mulberry32(21), { max: 9000, mask: builtUpMask(data.buildings, data.pois) }); // مباني تعبئة تلقائي لو بيانات OSM ناقصة (بس جوه المناطق العمرانية)
  if (infill.length) data.buildings.push(...dropBuildingsOnRoads(infill, S.roads).keep);
  S.bIdx = new BuildingIndex(data.buildings);
  S.garageSlots = placeSites(groundR, S.roads, S.bIdx, { spacing: 130, minRank: 1, off: 13, seed: 17, max: 220 });
  S.stations = makeStations(data.pois, groundR, S.roads, S.bIdx, 100); // 100 محطة موزعة على الخريطة كلها
  S.world = buildWorld(scene, data, S.bIdx, 5, S.roads); try { S.decks = buildDecks(scene, data.roads, S.roads); } catch (e) { console.error('decks', e); } prerenderMinimap(data); buildStations(); buildBounds();
  setLoading('بنزرع الشجر ونعلّق اليافطات ونطلّع الناس في الشارع…'); await new Promise((r) => setTimeout(r, 30));
  const avoid = (x, z) => { if (driveAt(x, z)) return true; for (const s of S.garageSlots) if (Math.abs(s.x - x) < 9 && Math.abs(s.z - z) < 9) return true; for (const st of S.stations) if (Math.abs(st.x - x) < 10 && Math.abs(st.z - z) < 10) return true; return false; };
  try {
    const ct = await loadContent(); S.content = ct.content; S.contentBase = ct.base; S.contentFrom = ct.from;
    { const mdls = { ...(S.content.models || {}), ...(await localModelSlots()) }; if (Object.keys(mdls).length) { await loadVehicleModels(mdls, ct.base); await loadCharModels(mdls, ct.base); if (me) setMyBike(); } }
    try { S.world.applyTextures(S.content.textures, ct.base); } catch (e) { console.error(e); }
    try { S.world.shops.apply(S.content.shops, S.content.ads, ct.base); } catch (e) { console.error('shops', e); }
    try { music.setTracks(S.content.music, ct.base); } catch (e) { console.error('music', e); }
    try { applyStreetNames(); } catch (e) { console.error(e); }
    S.avoid = avoid; makeProps();
  } catch (e) { console.error('props', e); }
  try { S.life = makeLife(scene, S.roads, { avoid, density: S.density }); (hasChar('ped') && S.life.setGLB(() => makeGlbCharacter('ped'))); S.life.onHit((p, sp) => { sfx.bump(); S.shake = 0.6; S.bike.speed *= 0.5; hitMission(S.mission, 'hit'); say('hitPed'); }); } catch (e) { console.error('life', e); }
  const rnd = mulberry32(11);
  for (let i = 0; i < 90; i++) { const a = makeAgent(rnd), mesh = makeVehicle(a.kind, a.color); mesh.visible = false; scene.add(mesh); S.agents.push({ a, mesh, active: false }); }
  S.sourceNote = data.source === 'osm' ? 'خريطة أكتوبر الحقيقية (OpenStreetMap)' : 'مدينة بديلة (أوفلاين)';
}

// ───────── جدار حدود الخريطة ─────────
function buildBounds() {
  const H = CITY.half - 4, tex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let x = -h; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 24, h); g.lineTo(x + 24 + h, 0); g.lineTo(x + h, 0); g.fill(); } g.fillStyle = '#b3261e'; g.fillRect(0, 18, w, 28); g.fillStyle = '#fff'; g.font = '800 22px Cairo, Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('حدود الخريطة — ممنوع التجاوز', w / 2, 33); }, true);
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }), top = new THREE.MeshLambertMaterial({ color: 0x3a3f46 }), grp = new THREE.Group();
  for (const [x, z, w, d] of [[0, -H, 2 * H, 1], [0, H, 2 * H, 1], [-H, 0, 1, 2 * H], [H, 0, 1, 2 * H]]) {
    const geo = new THREE.BoxGeometry(w, 7, d), t = tex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(w, d) / 28, 1);
    const m = new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t }), top, top, new THREE.MeshLambertMaterial({ map: t }), new THREE.MeshLambertMaterial({ map: t })]); m.position.set(x, 3.5, z); grp.add(m);
  }
  scene.add(grp); S.bounds = grp;
}

function makeProps() {
  if (S.props) { scene.remove(S.props.group); S.props.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); S.props = null; }
  S.props = buildProps(scene, S.data, { rnd: mulberry32(77), ri: S.roads, bIdx: S.bIdx, proj, avoid: S.avoid, content: S.content, base: S.contentBase, density: S.density });
  S.props.update(S.bike.x, S.bike.z); S.skyT = 0; if (typeof polishLater === 'function') polishLater();
}
// ───────── الإدارة داخل اللعبة ─────────
initAdmin({
  getPos: () => proj.toGeo(S.state === 'playing' ? S.bike.x : 0, S.state === 'playing' ? S.bike.z : 0),
  teleport: (lat, lon) => { if (S.state !== 'playing') return; const p = proj.toLocal(lat, lon), n = S.roads.nearest(p.x, p.z, 200); if (n) { S.bike.x = n.x; S.bike.z = n.z; S.bike.speed = 0; S.bike.heading = Math.atan2(n.hx, -n.hz); S.camH = S.bike.heading; } },
  getStreet: () => streetInfo(),
  previewTrack: (t) => music.preview(t),
  speakPreview: (t, c) => speak(t, c || msgCfg().speech, { on: true, vol: mixer ? mixer.local().vol : 1 }),
  shopNearest: () => (S.world && S.world.shops ? S.world.shops.nearest(S.bike.x, S.bike.z, 70) : null),
  shopStreets: () => (S.world && S.world.shops ? S.world.shops.streets() : []),
  onChange: (cfg) => { S.content = { ...S.content, ...cfg }; try { refreshMenuAd(); } catch (e) { /* ignore */ } try { if (S.data) applyStreetNames(); } catch (e) { /* ignore */ } try { if (S.world && S.world.applyTextures) S.world.applyTextures(cfg.textures, S.contentBase); } catch (e) { /* ignore */ } try { if (S.world && S.world.shops) S.world.shops.apply(cfg.shops, cfg.ads, S.contentBase); } catch (e) { console.error(e); } try { music.setTracks(cfg.music, S.contentBase); } catch (e) { console.error(e); } if (S.world && S.data) { try { makeProps(); } catch (e) { console.error(e); } } },
  onLogin: () => { admFab.show(true); },
  onLogout: () => { admFab.show(false); },
  setPaused: (v) => { if (S.state === 'playing') { S.paused = v; if (v) sfx.engine(0, 0, false); } },
  toast,
});
$('#btn-admin').onclick = () => openAdminLogin();
// ───────── حساب اللاعب (account.js) ─────────
initAccount({
  profile, saveProfile, toast,
  setPaused: (v) => { if (S.state === 'playing') S.paused = v; },
  onApplied: () => { $('#name').value = profile.name; $('#drive').value = String(profile.settings.assist); $('#autogas').value = profile.settings.autoGas ? '1' : '0'; $('#density').value = profile.settings.density; try { applySettings(); } catch (e) { /* ignore */ } updateWallet(); pushProfile(); },
});
$('#btn-account').onclick = () => openAccount();
// ───────── إضافات الجولة 3: خريطة، طلبات، تحكم سريع، موسيقى (extras.js) ─────────
const drawOrders = createOrdersOverlay();
let signsT = 0; const polishLater = () => { signsT++; const id = signsT; [1200, 3500, 9000, 20000].forEach((ms) => setTimeout(() => { if (id === signsT && S.props) try { polishSigns(THREE, S.props.group); } catch (e) { /* ignore */ } }, ms)); };
const music = createMusic({ getPhase: () => (S.state === 'playing' ? 'game' : 'menu'), isAdmin: adminLoggedIn, onAdminFiles: (fs) => adminAddMusicFromPlayer(fs) });
var mixer0 = 0; mixer = createMixer({ sfx, voice, music, onSpeechTest: () => { const c = msgCfg().speech; speak('تمام، ده صوت التحذيرات', c, { ...mixer.local(), on: true }); } }); setInterval(() => mixer.show(S.state === 'playing'), 500);
const musicTick = () => { music.tick(); setCargo(me, !profile.settings.hideBox); }; setInterval(musicTick, 500);
// ───────── الأحياء: اختيار الحي/المعلم + ملخص الخدمات + تعديل الإحداثيات ─────────
let blocksIdx = null;
async function blocksIndex() { if (blocksIdx) return blocksIdx; try { if (window.__BLOCKS_INDEX__) return (blocksIdx = window.__BLOCKS_INDEX__); if (/^https?:/.test(location.protocol)) { const r = await fetch('data/blocks/index.json'); if (r.ok) return (blocksIdx = await r.json()); } } catch (e) { /* ignore */ } return (blocksIdx = { blocks: {} }); }
async function updateDistrictInfo() { try { await updateDistrictInfo2(); } catch (e) { console.error('district-info', e); } }
async function updateDistrictInfo2() {
  const D = currentDistrict(), box = $('#district-info'); if (!box) return; const ix = await blocksIndex(), b = ix.blocks && ix.blocks[D.id], sv = !D.edited && b ? servicesText(b.services) : '';
  $('#district-name').textContent = D.name; $('#d-lat').value = D.lat; $('#d-lon').value = D.lon;
  box.innerHTML = `<div>${esc(D.src || '')}</div>${D.approx ? '<div class="warn">⚠️ إحداثيات تقريبية — لو المكان غلط عدّلها تحت (من جوجل ماب: دوس مطوّل على المكان وانسخ الإحداثيات)</div>' : ''}${D.edited ? '<div class="warn">إحداثيات معدّلة بواسطتك</div>' : ''}${sv ? `<div>خدمات حوالين المركز: ${sv}</div>` : ''}${b && b.features < 400 ? '<div class="warn">المنطقة دي برّه الملف المدمج — محتاجة نت أول مرة (وبعدها بتتخزّن)</div>' : ''}`;
}
{ const sel = $('#district-sel'); if (sel) {
  const opt = (d) => `<option value="${d.id}">${esc(d.name)}${d.approx ? ' (تقريبي)' : ''}</option>`;
  sel.innerHTML = '<optgroup label="الأحياء">' + DISTRICTS.filter((d) => d.kind === 'district').map(opt).join('') + '</optgroup><optgroup label="معالم رئيسية">' + DISTRICTS.filter((d) => d.kind === 'landmark').map(opt).join('') + '</optgroup>';
  sel.value = currentDistrictId(); sel.onchange = () => { saveProfile(profile); setDistrict(sel.value); };
  $('#d-save').onclick = () => { const la = parseFloat($('#d-lat').value), lo = parseFloat($('#d-lon').value); if (setDistrictCoords(currentDistrictId(), la, lo)) { saveProfile(profile); location.reload(); } else setStatus('الإحداثيات مش صحيحة (خط عرض -90..90 وخط طول -180..180)'); };
  $('#d-reset').onclick = () => { resetDistrictCoords(currentDistrictId()); saveProfile(profile); location.reload(); };
  updateDistrictInfo();
} }
{ const sel = $('#mapsize'); if (sel) { sel.innerHTML = Object.entries(MAP_SIZES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); sel.value = currentMapSize(); sel.onchange = () => { saveProfile(profile); setMapSize(sel.value); }; } }
const quick = createQuickPanel({
  labels: { 0: 'عادية', 0.5: 'متوسطة', 1: 'سهلة' },
  get: () => ({ autoGas: profile.settings.autoGas, assist: profile.settings.assist, hideBox: !!profile.settings.hideBox, stunts: profile.settings.stunts !== false, fx: profile.settings.fx === 'low' ? 'low' : 'high' }),
  toggleGas: () => { profile.settings.autoGas = !profile.settings.autoGas; $('#autogas').value = profile.settings.autoGas ? '1' : '0'; saveProfile(profile); },
  cycleAssist: () => { const v = [1, 0.5, 0], i = v.indexOf(+profile.settings.assist); profile.settings.assist = v[(i + 1) % 3]; $('#drive').value = String(profile.settings.assist); saveProfile(profile); },
  toggleBox: () => { profile.settings.hideBox = !profile.settings.hideBox; setCargo(me, !profile.settings.hideBox); saveProfile(profile); },
  toggleStunts: () => { profile.settings.stunts = profile.settings.stunts === false; saveProfile(profile); },
  toggleFx: () => { profile.settings.fx = profile.settings.fx === 'low' ? 'high' : 'low'; fx.setQuality(profile.settings.fx); saveProfile(profile); },
});
setInterval(() => quick.show(S.state === 'playing'), 400);
// أيقونة الإدارة العائمة (للمدير فقط، في كل الأوضاع)
const admHere = () => S.state === 'playing' && S.mode !== 'endless';
function addHere(kind) {
  const p = proj.toGeo(S.bike.x, S.bike.z), id = 'n' + Date.now().toString(36);
  if (kind === 'banner') openAdminPanel('ads', { kind: 'ads', item: { id, type: 'banner', active: true, lat: p.lat, lon: p.lon } });
  else if (kind === 'bill') openAdminPanel('ads', { kind: 'ads', item: { id, type: 'billboard', active: true, lat: p.lat, lon: p.lon } });
  else if (kind === 'shop') openAdminPanel('shops');
  else if (kind === 'lm') openAdminPanel('lm', { kind: 'lm', item: { id, mode: 'both', active: true, lat: p.lat, lon: p.lon } });
}
var admFab = createAdminFab({ openPanel: () => openAdminPanel('ads'), addHere, logout: () => adminLogout(), canAddHere: admHere, can: adminCan });
setInterval(() => admFab.show(adminLoggedIn()), 400);

// ───────── محطات البنزين + الجراجات + المطالع + الموانع ─────────
function buildStations() {
  S.stations.forEach((st, i) => {
    const near = st.road ? { road: st.road } : S.roads.nearest(st.x, st.z, 40), hw = near ? near.road.w / 2 : 4; st.hw = hw;
    let cx = st.bx, cz = st.bz;
    if (Math.hypot(cx - st.x, cz - st.z) > hw + SIDEWALK_W + 24) { cx = st.x + st.nx * (hw + SIDEWALK_W + 10.5); cz = st.z + st.nz * (hw + SIDEWALK_W + 10.5); }
    st.cx = cx; st.cz = cz; st.px = cx - st.nx * 1.3; st.pz = cz - st.nz * 1.3;
    const mesh = makeStation(st.name, FUEL_PRICE); mesh.position.set(cx, 0, cz); mesh.rotation.y = Math.atan2(-st.nx, -st.nz); mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(mesh); st.mesh = mesh;
    st.ramp = makeRamp(st, hw, 6.4); scene.add(st.ramp);
    S.drives.set('st' + i, { x: st.x, z: st.z, nx: st.nx, nz: st.nz, hw, half: 3.2 });
    S.solids.set('st' + i, { x: cx + st.nx * 4.6, z: cz + st.nz * 4.6, tx: -st.nz, tz: st.nx, nx: st.nx, nz: st.nz, hw: 4.4, hd: 1.9 });
  });
}
function buildGarageAt(key, g, name, color, mine) {
  const hw = g.road.w / 2; g.hw = hw; const d = hw + SIDEWALK_W + 4.5;
  g.ex = g.x + g.nx * d; g.ez = g.z + g.nz * d; g.heading = Math.atan2(-g.nx, g.nz);
  const mesh = makeGarage(name, color, mine); mesh.position.set(g.bx, 0, g.bz); mesh.rotation.y = Math.atan2(-g.nx, -g.nz); mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const ramp = makeRamp(g, hw, 6.4), grp = new THREE.Group(); grp.add(mesh, ramp); scene.add(grp);
  S.drives.set('g:' + key, { x: g.x, z: g.z, nx: g.nx, nz: g.nz, hw, half: 3.2 });
  S.solids.set('g:' + key, { x: g.bx, z: g.bz, tx: -g.nz, tz: g.nx, nx: g.nx, nz: g.nz, hw: 3.5, hd: 3.2 });
  return { grp, g };
}
function removeGarage(key, rec) { if (!rec) return; scene.remove(rec.grp); S.drives.delete('g:' + key); S.solids.delete('g:' + key); }
function placeMyGarage() {
  if (!S.garageSlots.length) return; removeGarage('me', S.myGarage);
  // الجراج الرئيسي: أقرب موقع صالح لنقطة البداية (شارع 103 عمارة 72 — وسط الخريطة)
  let bi = 0, bd = 1e18; S.garageSlots.forEach((s, i) => { const d = Math.hypot(s.bx, s.bz); if (d < bd) { bd = d; bi = i; } });
  const g = { ...S.garageSlots[bi], index: bi }; S.myGarage = buildGarageAt('me', g, 'أكتوبر · ' + HOME.street, profile.color, true); S.garage = S.myGarage.g;
}
function addRemoteGarage(id, p) {
  if (!S.garageSlots.length || !S.garage || S.garages.has(id)) return;
  const g = garageFor(S.garageSlots, p.id || id); if (g.index === S.garage.index) return;
  S.garages.set(id, buildGarageAt(id, g, p.name || 'لاعب', p.color || 0x5aa9ff, false));
}
function hitSolid(x, z, r = 0.7) {
  for (const c of S.solids.values()) {
    const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz > 196) continue;
    const u = dx * c.tx + dz * c.tz, v = dx * c.nx + dz * c.nz; if (Math.abs(u) < c.hw + r && Math.abs(v) < c.hd + r) return true;
  }
  return false;
}
function driveAt(x, z) { // مطلع الرصيف (قدام الجراج/المحطة): مفيش صوبة هنا
  for (const d of S.drives.values()) {
    const dx = x - d.x, dz = z - d.z; if (dx * dx + dz * dz > 900) continue;
    const u = dx * d.nx + dz * d.nz, v = -dx * d.nz + dz * d.nx; if (Math.abs(v) < d.half && u > d.hw - 0.6 && u < d.hw + SIDEWALK_W + 0.6) return { u: u - d.hw };
  }
  return null;
}
const nearestPump = (x, z) => { let best = null; for (const st of S.stations) { const d = Math.hypot(st.px - x, st.pz - z); if (!best || d < best.d) best = { st, d }; } return best; };

function spawnPlayer() {
  if (S.garage) { // كل لاعب بيبدأ قدام جراجه الخاص
    const b = S.bike, g = S.garage; b.x = g.ex; b.z = g.ez; b.heading = g.heading; b.speed = 0; b.lean = 0; b.wobble = 0; b.fallTimer = 0; S.camH = b.heading;
    const f = { x: Math.sin(b.heading), z: -Math.cos(b.heading) }; camera.position.set(b.x - f.x * 6, 3, b.z - f.z * 6); S.spawned = true; return;
  }
  const b = S.bike, n = S.roads.nearest(0, 0, 600) || S.roads.randomPoint(Math.random, 2);
  const seg = n.hx !== undefined ? n : { hx: 0, hz: -1 };
  b.x = n.x; b.z = n.z; b.heading = Math.atan2(seg.hx, -seg.hz); b.speed = 0; b.lean = 0; b.wobble = 0; b.fallTimer = 0; S.camH = b.heading;
  const f = { x: Math.sin(b.heading), z: -Math.cos(b.heading) };
  camera.position.set(b.x - f.x * 8, 3.5, b.z - f.z * 8); S.spawned = true;
}
function unstick() {
  if (S.mode === 'endless') { const b = S.bike; b.x = HIGHWAY.x + 2; b.heading = 0; b.speed = 0; return; }
  const b = S.bike, n = S.roads.nearest(b.x, b.z, 400); if (!n) return spawnPlayer();
  b.x = n.x; b.z = n.z; b.speed = 0; b.heading = Math.atan2(n.hx, -n.hz); say('unstick');
}

// ───────── واجهة: مساعدات ─────────
function toast(msg, cls = '', ms) {
  if (!msg) return;
  const now = performance.now(); if (S.lastToast === msg && now - S.lastToastAt < 1500) return; S.lastToast = msg; S.lastToastAt = now;
  const mc = msgCfg(), life = ms || mc.ms;
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg; el.style.animationDuration = `.25s, .4s`; el.style.animationDelay = `0s, ${Math.max(0, life - 600) / 1000}s`; const box = $('#toasts'); box.dataset.pos = mc.pos; box.appendChild(el);
  while (box.children.length > mc.max) box.firstChild.remove(); setTimeout(() => el.remove(), life);
}
// رسائل اللعب: النص والنوع والمدة والتشغيل بيتحكم فيهم الإدارة (messages.js + تبويب «الرسائل»)
const msgCfg = () => normalizeMessages(S.content && S.content.messages);
function say(key, vars) { const r = resolveMessage(S.content && S.content.messages, key, vars); if (r) { toast(r.text, r.cls, r.ms); if (r.speak && mixer) speak(r.speak, r.speech, mixer.local()); } }
var mixer;
const TIPS = ['جديد: سباق الشارع · زبون بيتكلم · غرف بكلمة سر · نسخة 2D خفيفة', 'اضغط F عشان تنزل من الموتوسيكل وتمشي', 'GPS بيدلّك على أقرب محطة بنزين — ماتستناش لحد ما يخلص', 'في الغرفة فعّل المايك وكلّم صحابك لايف', 'سباق الشارع: نفس المسار لكل اللاعبين، والأسرع بياخد الترتيب', 'الويلي (Q) بيجيب نقط في تحدي الطريق — بس سيبه قبل 5 ثواني', 'لو موبايلك تقيل: اختار جودة «تلقائية» أو العب 2D الخفيف'];
// ───────── مساحات الإعلانات خارج اللعب + شاشة التحميل السينمائية ─────────
const ads = createAdSlots(() => S.content, () => S.contentBase || '');
let pre = null, preStep = 0;
const LOAD_STEPS = [[0.08, 0.22], [0.28, 0.45], [0.5, 0.72], [0.74, 0.92], [0.88, 0.97]]; // [تقدم أكيد, سقف التقدير] لكل رسالة تحميل
function setLoading(t) {
  const L = $('#loading'), first = L.classList.contains('hidden'); L.classList.remove('hidden'); $('#loading-text').textContent = t;
  if (!pre) {
    let seen = false; try { seen = !!localStorage.getItem('orider-intro'); } catch (e) { /* ignore */ }
    preStep = 0; pre = createPreloader(L, { fast: !!S.world || seen, tip: TIPS[(Math.random() * TIPS.length) | 0], adHTML: ads.html('loading') }); ads.scan(L);
  } else if (first) $('#loading-tip').textContent = '';
  const st = LOAD_STEPS[Math.min(preStep++, LOAD_STEPS.length - 1)]; pre.setProgress(st[0], st[1]); pre.setStatus(t);
}
function hideLoading() { if (pre) { pre.destroy(); pre = null; } $('#loading').classList.add('hidden'); }
// نجاح: التحميل بيوصل 100٪ → إشعال → بوابة بتفتح على اللعبة (واللعبة واقفة لحد ما تخلص)
async function endLoading() {
  if (!pre) { hideLoading(); return; }
  const p = pre; S.paused = true;
  try { await p.finish(); } finally { if (pre === p) hideLoading(); S.paused = false; try { localStorage.setItem('orider-intro', '1'); } catch (e) { /* ignore */ } }
}
const setStatus = (t) => { $('#menu-status').textContent = t || ''; };

// ───────── المرور ─────────
function respawnAgent(it, close) {
  const b = S.bike;
  for (let k = 0; k < 14; k++) {
    const p = S.roads.randomPoint(Math.random, 1, true), d = Math.hypot(p.x - b.x, p.z - b.z);
    if (d > (close ? 140 : 60) && d < 420) { placeAgent(it.a, p.road, p.s, Math.random); return true; }
  }
  return false;
}
function updateTraffic(dt) {
  const want = Math.min(S.agents.length, Math.round(trafficFor(levelFor(profile.deliveries)) * ({ low: 0.55, mid: 1, high: 1.5 }[S.density] || 1))), b = S.bike;
  S.agents.forEach((it, i) => {
    const on = i < want;
    if (on && !it.active) { it.active = respawnAgent(it, true); }
    if (!on) it.active = false;
    it.mesh.visible = it.active; if (!it.active) return;
    stepAgent(it.a, dt);
    const ay = S.hasElev ? elevAtS(it.a.road, it.a.s, it.a.i) : 0; it.mesh.position.set(it.a.x, ay, it.a.z); it.mesh.rotation.y = -it.a.h;
    const dx = it.a.x - b.x, dz = it.a.z - b.z, d2 = dx * dx + dz * dz;
    if (d2 > 520 * 520 && (S.clock + i * 0.37) % 1 < dt) respawnAgent(it, true);
    if (d2 < 9 && Math.abs(ay - S.bikeY) < 2.6 && it.a.stun <= 0 && S.state === 'playing' && b.fallTimer <= 0) { // خبطة
      it.a.stun = 1.6; const d = Math.sqrt(d2) || 1; b.x -= (dx / d) * 1.2; b.z -= (dz / d) * 1.2; b.speed *= 0.3; crash('hitCar');
    }
  });
}
function crash(key) { sfx.bump(); S.shake = 0.7; hitMission(S.mission, 'hit'); say(key); }

// ───────── الميشنز ─────────
const scheduleOffer = (d) => { S.offerAt = S.clock + d; };
const MAX_OFFERS = 5, OFFER_TTL = 90;
// قائمة طلبات متاحة (مش طلب واحد): اللاعب هو اللي بيختار
function maybeOffer() {
  if (S.mission || S.state !== 'playing') return;
  const n0 = S.offers.length; S.offers = S.offers.filter((o) => S.clock < o.expireAt); let changed = S.offers.length !== n0;
  if (S.offers.length < MAX_OFFERS && S.clock >= S.offerAt) {
    const o = makeOffer({ completed: profile.deliveries, pos: S.bike, pois: S.data.pois, roads: S.roads, rnd: Math.random });
    if (!S.offers.some((q) => q.pickup.name === o.pickup.name && q.dropoff.name === o.dropoff.name)) {
      o.expireAt = S.clock + OFFER_TTL + Math.random() * 40; S.offers.push(o); changed = true;
      if (S.offers.length === 1) sfx.ding(); S.offerFlash = S.clock + 2.5;
    }
    scheduleOffer(S.offers.length < 3 ? 1.2 : 4 + Math.random() * 4);
  }
  if (S.offer && !S.offers.includes(S.offer)) S.offer = null;
  if (changed) renderOffers();
}
const offerApproach = (o) => Math.round(Math.hypot(o.pickup.x - S.bike.x, o.pickup.z - S.bike.z));
function renderOffers() {
  const box = $('#o-list'); if (!box) return;
  S.offers.sort((a, b) => offerApproach(a) - offerApproach(b));
  box.innerHTML = S.offers.length ? S.offers.map((o) => {
    const L = LOADS[o.load] || LOADS.parcel;
    return `<div class="orow${o === S.offer ? ' sel' : ''}" data-id="${o.id}">
      <div class="or-top"><b>${L.glyph} ${L.offer}${o.pax > 1 ? ' (' + o.pax + ' ركّاب)' : ''}</b><span class="reward">+${o.reward}</span></div>
      <div class="or-ft"><span>${o.pickup.name}</span><i>⟶</i><span>${o.dropoff.name}</span></div>
      <div class="or-meta"><span>🧭 <u data-ap>${offerApproach(o)}</u> م</span><span>📍 ${o.dist} م</span><span>⏱ ${fmt(o.limit)}</span><span>مستوى ${o.level}</span><button class="btn primary mini o-acc" data-id="${o.id}">اقبل</button></div>
    </div>`;
  }).join('') : '<div class="or-empty">بندوّر على طلبات قريبة…</div>';
}
function refreshOffers() { S.offers = []; S.offer = null; S.offerAt = 0; renderOffers(); sfx.ding(); }
function updateOfferLive() {
  if (S.clock < (S.offerLiveT || 0)) return; S.offerLiveT = S.clock + 0.5;
  document.querySelectorAll('#o-list .orow').forEach((row) => { const o = S.offers.find((q) => String(q.id) === row.dataset.id), u = row.querySelector('[data-ap]'); if (o && u) u.textContent = offerApproach(o); });
}
function acceptOffer(id) {
  const o = S.offers.find((q) => q.id === +id); if (!o || S.mission) return;
  S.mission = startMission(retimeOffer(o, S.bike)); S.offers = []; S.offer = null; renderOffers(); sfx.ding();
  say(S.mission.type === 'delivery' ? 'acceptDelivery' : 'acceptRide'); syncBeacons();
  S.mTouched = false; S.mMin = !!ui.mMin; const mid = S.mission.id; setTimeout(() => { if (S.mission && S.mission.id === mid && !S.mTouched) S.mMin = true; }, 6000); // البانر بيصغر لوحده بعد 6 ثواني
}
function syncBeacons() {
  syncMissionFx();
  const m = S.mission; bPick.visible = bDrop.visible = false; if (!m) return;
  const st = beaconStyle(m);
  if (m.stage === 'pickup') { bPick.userData.setStyle(st.color, st.glyph); bPick.position.set(m.pickup.x, 0, m.pickup.z); bPick.visible = true; }
  if (m.stage === 'dropoff') { bDrop.userData.setStyle(st.color, st.glyph); bDrop.position.set(m.dropoff.x, 0, m.dropoff.z); bDrop.visible = true; }
}
// ───────── مؤثرات الميشن: حمولة · شخصيات · جزيئات · عملات ─────────
let fxKey = '', pickA = null, dropA = null, loadHold = false;
const vib = (p) => { try { if (profile.settings.vib !== false && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };
const NPC_LOOKS = [{ shirt: 0x2d6cdf }, { shirt: 0xd6a02b, pants: 0x2c3e66 }, { shirt: 0x7a4fa3 }, { shirt: 0xf2f2f2, pants: 0x4a4a4a }, { shirt: 0xd96a8a, woman: true, hijab: 0x1f2a44 }, { shirt: 0x2f8f4e, woman: true, hijab: 0xe8dcc4 }];
const pickLook = () => NPC_LOOKS[(Math.random() * NPC_LOOKS.length) | 0];
function spawnNpc(pt, load, atPickup) {
  const b = S.bike, hx = Math.cos(b.heading), hz = Math.sin(b.heading); // جنب ناحية يمين الموتوسيكل
  let look = pickLook(), hold = null;
  if (atPickup && load === 'med') { look = { coat: 0xffffff, shirt: 0xffffff, pants: 0x2c3e66 }; hold = 'med'; }
  else if (atPickup && load === 'food') { look = { shirt: 0xe8452b, pants: 0x1b1f2a }; hold = 'food'; }
  else if (atPickup && load === 'parcel') { look = { shirt: 0x2d6cdf, pants: 0x1b1f2a }; hold = 'parcel'; }
  const a = fx.spawnActor(look, pt.x + hx * 2.4, pt.z + hz * 2.4); a.hold(hold); a._near = 0; return a;
}
function applyLoad() {
  if (loadHold) return; const m = S.mission, on = m && m.stage === 'dropoff' && S.state === 'playing';
  me.setLoad(on ? m.load : null, on ? m.pax : 1);
}
function syncMissionFx() {
  const m = S.mission, key = m ? m.id + ':' + m.stage : '';
  if (key === fxKey) return; fxKey = key;
  for (const a of fx.actors) fx.removeActor(a); pickA = dropA = null; applyLoad();
  if (!m || S.state !== 'playing') return;
  if (m.stage === 'pickup') pickA = spawnNpc(m.pickup, m.load, true);
  else if (m.stage === 'dropoff' && m.load !== 'person') dropA = spawnNpc(m.dropoff, m.load, false);
}
function fxPickup(m, pa) {
  const b = S.bike, st = beaconStyle(Object.assign({}, m, { stage: 'pickup' })), L = LOADS[m.load];
  const from = new THREE.Vector3(pa ? pa.group.position.x : m.pickup.x, 1.2, pa ? pa.group.position.z : m.pickup.z), to = new THREE.Vector3(b.x, 1.15, b.z);
  sfx.chime(); vib(40); fx.sparkle(m.pickup.x, 1, m.pickup.z, st.color, 26); fx.wave(m.pickup.x, m.pickup.z, st.color, 9); fx.popup(m.pickup.x, 2.8, m.pickup.z, '✅ ' + L.pick, 'ok');
  if (m.load === 'person') { if (pa) pa.walkTo(b.x, b.z, 6); sfx.whoosh(); loadHold = true; setTimeout(() => { loadHold = false; if (S.mission && S.mission.id === m.id) { me.setLoad('person', m.pax); sfx.pop(); fx.sparkle(S.bike.x, 1.4, S.bike.z, 0x4aa8ff, 14); } }, 650); }
  else { if (pa) pa.waveFor(1.6); sfx.whoosh(); loadHold = true; fx.fly(m.load, from, to, 0.5, () => { loadHold = false; if (S.mission && S.mission.id === m.id) { me.setLoad(m.load, m.pax); sfx.pop(); fx.puff(S.bike.x, 1.2, S.bike.z, 8); } }); }
}
function fxDone(m, res, da) {
  const b = S.bike, st = beaconStyle(m), L = LOADS[m.load], at = m.dropoff;
  loadHold = false; me.setLoad(null, 1);
  if (m.load === 'person') { // الراكب بينزل ويمشي
    const a = fx.spawnActor(pickLook(), b.x + Math.cos(b.heading) * 1.0, b.z + Math.sin(b.heading) * 1.0); a.walkTo(b.x + Math.cos(b.heading) * 5, b.z + Math.sin(b.heading) * 5, 2.4, (q) => { q.waveFor(1.4); setTimeout(() => fx.removeActor(q), 1500); }); a.hop = 0.5;
  } else { if (da) { da.waveFor(1.8); da.hop = 0.5; } fx.fly(m.load, new THREE.Vector3(b.x, 1.15, b.z), new THREE.Vector3(at.x, 1.3, at.z), 0.45, () => fx.puff(at.x, 1.2, at.z, 6)); }
  fx.sparkle(at.x, 1.2, at.z, st.color, 30); fx.confetti(at.x, 1.5, at.z, 36); fx.coins(at.x, 1, at.z, Math.min(16, 6 + res.stars * 2)); fx.wave(at.x, at.z, 0xffc83d, 10);
  fx.popup(at.x, 2.8, at.z, '🎉 ' + L.drop + ' · +' + res.total, 'win'); fx.popup(at.x, 1.8, at.z, '★'.repeat(res.stars), 'star');
  sfx.coin(); setTimeout(() => sfx.coin(), 140); setTimeout(() => sfx.coin(), 260); vib([30, 40, 60]);
}
// حلقة التقدم أثناء الاستلام/التسليم
const holdRing = (() => { const el = document.createElement('div'); el.id = 'holdring'; el.className = 'hidden'; el.innerHTML = '<b></b><i></i>'; document.body.appendChild(el); return el; })();
let hsT = 0;
function missionFxTick(dt) {
  const m = S.mission, b = S.bike, t = performance.now() / 1000;
  if (m && S.state === 'playing' && m.hold > 0.02) {
    const k = Math.min(1, m.hold / HOLD_TIME), L = LOADS[m.load] || LOADS.parcel, st = beaconStyle(m);
    holdRing.classList.remove('hidden'); holdRing.style.setProperty('--k', (k * 360).toFixed(0) + 'deg'); holdRing.style.setProperty('--c', '#' + st.color.toString(16).padStart(6, '0')); holdRing.firstChild.textContent = m.stage === 'pickup' ? L.pick : L.drop; holdRing.lastChild.textContent = L.glyph;
    hsT -= dt; if (hsT <= 0) { hsT = 0.28; const tg = m.stage === 'pickup' ? m.pickup : m.dropoff; fx.sparkle(tg.x, 0.6, tg.z, st.color, 4); }
  } else holdRing.classList.add('hidden');
  for (const a of [pickA, dropA]) if (a && !a.dead) { const d = Math.hypot(a.group.position.x - b.x, a.group.position.z - b.z); if (a.mode === 'idle') a.face(b.x, b.z); a._near -= dt; if (d < 45 && a._near <= 0 && a.wave <= 0) { a._near = 6; a.waveFor(2.2); } }
  me.tickLoad(dt); for (const r of S.remotes.values()) r.bike.tickLoad(dt);
  fx.update(dt, t);
}
function onMissionEvent(ev) {
  const m = S.mission;
  if (ev === 'slow') S.slowAt = S.clock;
  else if (ev === 'pickedup') { sfx.ding(); say(m.type === 'delivery' ? 'pickedDelivery' : 'pickedRide'); const pa = pickA; syncBeacons(); fxPickup(m, pa); }
  else if (ev === 'done') {
    const res0 = scoreMission(m, profile.streak), sc = pickScenario(m, res0);
    const finish = (res) => { recordSuccess(profile, m, res); sfx.win(); showResult(m, res, true); const da = dropA; S.mission = null; syncBeacons(); fxDone(m, res, da); pushProfile(); scheduleOffer(5); };
    if (sc) askCustomer(sc, res0, finish); else finish(res0);
  } else if (ev === 'fail') {
    recordFail(profile); sfx.fail(); showResult(m, null, false); S.mission = null; loadHold = false; syncBeacons(); pushProfile(); scheduleOffer(4);
  }
}
// ───────── زبون بيتكلم: موقف عند التسليم + اختيار بيغيّر البقشيش والتقييم ─────────
function askCustomer(sc, res0, finish) {
  const box = $('#customer'); let done = false;
  const end = (res) => { if (done) return; done = true; clearTimeout(tm); box.classList.add('hidden'); box.innerHTML = ''; finish(res); };
  const tm = setTimeout(() => end(res0), 9000); // لو ماردّيتش: بيتحسب زي ما هو من غير تغيير
  box.innerHTML = `<div class="cust-card"><div class="cust-who">${sc.kind === 'complaint' ? '😠' : '🙂'} العميل</div><div class="cust-line">“${esc(sc.line)}”</div><div class="cust-opts">${sc.options.map((o) => `<button class="btn mini" data-id="${o.id}">${esc(o.label)}</button>`).join('')}</div></div>`;
  box.classList.remove('hidden'); sfx.ding();
  try { const c = msgCfg().speech; if (c && c.on !== false && mixer) speak(sc.line, c, mixer.local()); } catch (e) { /* ignore */ }
  box.onpointerdown = (e) => {
    const bt = e.target.closest('button[data-id]'); if (!bt) return; e.preventDefault();
    const r = resolveChoice(sc, bt.dataset.id, res0); say(r.good ? 'customerGood' : 'customerBad', { text: r.text }); end(r.res);
  };
}
function trackProgress() { // بيحسب وردية اللاعب (نقط من أول ما دخل) وإجمالي الفلوس المكسوبة للترتيب
  if (S.lastMoney == null) S.lastMoney = profile.money; if (profile.money > S.lastMoney) profile.totalEarned = (profile.totalEarned || 0) + (profile.money - S.lastMoney); S.lastMoney = profile.money;
  const sh = profile.points - (S.shiftStart || 0); if (sh > (profile.bestShift || 0)) profile.bestShift = sh;
}
function pushProfile() { trackProgress(); if (net.ready) net.updateProfile(publicProfile(profile)); renderLB(); }
let resultTimer = 0;
function showResult(m, res, ok) {
  const box = $('#result');
  box.innerHTML = ok
    ? `<div class="sheet"><h2>وصّلت الطلب ✔</h2><div class="stars">${'★'.repeat(res.stars)}${'☆'.repeat(5 - res.stars)}</div><div class="big">+${res.total}</div>
       <div class="quote">“${esc(res.comment)}”</div>
       <div class="grid"><div>النقط<b>${res.points}</b></div><div>بقشيش<b>${res.tip}</b></div><div>بونص السرعة<b>${res.timeBonus}</b></div><div>مضاعف السلسلة<b>×${res.mult.toFixed(1)}</b></div></div>
       <small>اضغط للمتابعة</small></div>`
    : `<div class="sheet"><h2>الوقت خلص ⏱</h2><div class="quote">العميل لغى الطلب.. جرّب الطلب الجاي وخلّي بالك من الوقت.</div><small>اضغط للمتابعة</small></div>`;
  box.classList.remove('hidden'); clearTimeout(resultTimer); resultTimer = setTimeout(() => box.classList.add('hidden'), 5000);
}
function showSheet(html, ms = 4500) { const box = $('#result'); box.innerHTML = html; box.classList.remove('hidden'); clearTimeout(resultTimer); if (ms) resultTimer = setTimeout(() => box.classList.add('hidden'), ms); }
$('#result').addEventListener('pointerdown', () => $('#result').classList.add('hidden'));
$('#o-list').addEventListener('pointerdown', (e) => {
  const acc = e.target.closest('.o-acc'); if (acc) { e.preventDefault(); return acceptOffer(acc.dataset.id); }
  const row = e.target.closest('.orow'); if (!row) return;
  const o = S.offers.find((q) => String(q.id) === row.dataset.id); S.offer = S.offer === o ? null : o; renderOffers(); // اختار طلب = يظهر على الخريطة
});
$('#o-refresh').onclick = refreshOffers;
$('#o-tog').onclick = () => { ui.oOpen = !ui.oOpen; saveUI(); };
$('#m-tog').onclick = () => { S.mMin = !S.mMin; S.mTouched = true; ui.mMin = S.mMin; saveUI(); };
$('#mc-tog').onclick = () => { ui.cMin = !ui.cMin; saveUI(); };
$('#m-cancel').onclick = () => { if (!S.mission) return; recordFail(profile); S.mission = null; syncBeacons(); pushProfile(); say('cancelled'); scheduleOffer(2); };

// ───────── اللاعبين الآخرين (P2P) ─────────
function addRemote(id, p) {
  const ex = S.remotes.get(id); if (ex) { ex.profile = p; return; }
  const bid = resolveBikeId(p.bike), b = makeBike(p.color || 0x5aa9ff, bid, p.outfit), label = makeLabel(p.name || 'لاعب', p.color || 0x5aa9ff); useBikeGLB(b, bid); attachRider(b); b.group.add(label); scene.add(b.group);
  S.remotes.set(id, { outfitJ: JSON.stringify(p.outfit || null), id, profile: p, bike: b, label, style: bid, x: 0, z: 0, h: 0, v: 0, l: 0, tx: 0, tz: 0, th: 0, tv: 0, tl: 0, init: false });
  addRemoteGarage(id, p);
}
function removeRemote(id) { const r = S.remotes.get(id); if (!r) return; scene.remove(r.bike.group); if (r.walker) scene.remove(r.walker.group); S.remotes.delete(id); removeGarage(id, S.garages.get(id)); S.garages.delete(id); }
function refreshRemoteBike(r) {
  const st = resolveBikeId(r.profile.bike), oj = JSON.stringify(r.profile.outfit || null); if (st === r.style && oj === r.outfitJ) return;
  r.outfitJ = oj; scene.remove(r.bike.group); const b = makeBike(r.profile.color || 0x5aa9ff, st, r.profile.outfit); useBikeGLB(b, st); attachRider(b); b.group.add(r.label); scene.add(b.group); r.bike = b; r.style = st; r.ldA = -1;
}
let netWired = false;
function wireNet() {
  if (netWired) return; netWired = true;
  net.on('race', (id, d) => { const r = S.remotes.get(id); say('racePeer', { name: r && r.profile.name ? r.profile.name : 'لاعب', time: fmtRace(+d.time || 0) }); });
  net.on('join', (id, p) => { addRemote(id, p || { name: 'لاعب' }); say('join', { name: p && p.name ? p.name : 'لاعب' }); sfx.ding(); renderLB(); });
  net.on('leave', (id) => { const r = S.remotes.get(id); if (r) say('leave', { name: r.profile.name }); removeRemote(id); renderLB(); });
  net.on('profile', (id, p) => { const r = S.remotes.get(id); if (r) { r.profile = p; refreshRemoteBike(r); renderLB(); } });
  net.on('state', (id, d) => {
    const r = S.remotes.get(id); if (!r) return;
    r.tx = d.x; r.tz = d.z; r.th = d.h; r.tv = d.v; r.tl = d.l; r.ld = d.ld | 0; r.f = Array.isArray(d.f) ? d.f : 0;
    if (!r.init) { r.x = d.x; r.z = d.z; r.h = d.h; r.init = true; }
  });
  net.on('horn', (id) => { const r = S.remotes.get(id); if (!r) return; const d = Math.hypot(r.x - S.bike.x, r.z - S.bike.z), v = clamp(1 - d / 160, 0, 1); if (v > 0.05) sfx.horn(v); });
  net.on('error', (e) => { if (e && e.type !== 'peer-unavailable') say('netError', { type: e.type || '' }); });
}
const tmpMap = new Map();
function updateRemotes(dt) {
  tmpMap.clear();
  for (const r of S.remotes.values()) {
    r.tx += Math.sin(r.th) * r.tv * dt; r.tz += -Math.cos(r.th) * r.tv * dt;
    const k = Math.min(1, dt * 8); r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; r.h += angDiff(r.th, r.h) * k; r.l += (r.tl - r.l) * k; r.v += (r.tv - r.v) * k;
    if (r.ldA !== r.ld) { r.ldA = r.ld; const L = loadFromCode(r.ld); r.bike.setLoad(L.load, L.pax); }
    if (r.f) { // لاعب نازل ماشي: الموتوسيكل واقف وراكبه بيتحرك لوحده
      if (!r.walker) { r.walker = (hasChar('model3') && makeGlbCharacter('model3')) || (hasChar('walker') && makeGlbCharacter('walker')) || createWalker(r.profile.outfit, r.profile.color || 0x5aa9ff); scene.add(r.walker.group); r.fx = r.f[0]; r.fz = r.f[1]; r.fh = r.f[2]; }
      r.fx += (r.f[0] - r.fx) * k; r.fz += (r.f[1] - r.fz) * k; r.fh += angDiff(r.f[2], r.fh) * k; r.walker.group.position.set(r.fx, 0, r.fz); r.walker.group.rotation.y = -r.fh;
      r.walker.update(dt, r.f[3] ? 2.3 : 0, r.f[4] ? EMOTE_KEYS[r.f[4] - 1] : null, 0);
    } else if (r.walker) { scene.remove(r.walker.group); r.walker = null; }
    setRiderVis(r.bike, !r.f); if (r.bike.glbRider && !r.f) r.bike.glbRider.update(dt, r.bike, { speed: r.v, steer: r.l * 0.6, lean: r.l, throttle: Math.abs(r.v) > 1 ? 1 : 0, brake: 0, wheelie: false });
    if (S.hasElev) { const lv = S.roads.heightAt(r.x, r.z, r.y || 0, 0.6); r.y = (r.y || 0) + ((lv && lv.y > 0.25 ? lv.y : 0) - (r.y || 0)) * Math.min(1, dt * 10); } r.bike.group.position.set(r.x, r.y || 0, r.z); r.bike.group.rotation.y = -r.h; r.bike.lean.rotation.z = -r.l;
    r.bike.front.rotation.x = r.bike.rear.rotation.x += (r.v * dt) / 0.36; r.bike.fork.rotation.y = -r.l * 0.6; tmpMap.set(r.id, r);
  }
  if (net.ready) { voice.update({ x: S.bike.x, z: S.bike.z, h: S.bike.heading }, tmpMap); }
}

// ───────── ترتيب اللاعبين ─────────
const LB_CATS = { points: ['⭐ النقط', (r) => r.points, 1, (v) => v + ' نقطة'], shift: ['🏅 أحسن وردية', (r) => r.shift, 1, (v) => v + ' نقطة'], money: ['💰 أكتر فلوس', (r) => r.earned, 1, (v) => Math.round(v) + ' ج'], race: ['🏎️ أسرع سباق', (r) => r.race, -1, (v) => (v > 0 ? fmtRace(v) : '—')] };
function renderLB() {
  trackProgress(); const cat = LB_CATS[S.lbCat] ? S.lbCat : 'points', [, get, dir, show] = LB_CATS[cat];
  const rows = [{ name: profile.name, points: profile.points, shift: profile.bestShift || 0, earned: profile.totalEarned || 0, race: profile.bestRace || 0, color: profile.color, me: true, talk: voice.localLevel > 0.04 }];
  for (const r of S.remotes.values()) { const p = r.profile; rows.push({ name: p.name || 'لاعب', points: p.points || 0, shift: p.shift || 0, earned: p.earned || 0, race: p.bestRace || 0, color: p.color || 0xffffff, talk: voice.speaking.has(r.id) }); }
  rows.sort((a, b) => { const x = get(a), y = get(b); if (dir < 0) return (x || 1e9) - (y || 1e9); return y - x; });
  $('#leaderboard').innerHTML = '<h4>🏆 ترتيب اللاعبين (لايف)</h4><div class="lb-tabs">' + Object.entries(LB_CATS).map(([k, c]) => `<button class="lb-tab ${k === cat ? 'on' : ''}" data-c="${k}">${c[0]}</button>`).join('') + '</div>' + rows.map((r, i) =>
    `<div class="lb-row ${r.me ? 'me' : ''}"><span>${i + 1}</span><span class="dot" style="background:${hex(r.color)}"></span><span class="nm">${esc(r.name)}</span><span class="talk">${r.talk ? '🔊' : ''}</span><span class="pt">${show(get(r))}</span></div>`).join('');
}
$('#leaderboard').addEventListener('pointerdown', (e) => { const t = e.target.closest('.lb-tab'); if (!t) return; e.preventDefault(); S.lbCat = t.dataset.c; try { localStorage.setItem('orider-lbcat', S.lbCat); } catch (err) { /* ignore */ } renderLB(); });
S.lbCat = (() => { try { return localStorage.getItem('orider-lbcat') || 'points'; } catch (e) { return 'points'; } })();
function renderStats() {
  const p = profile, lv = levelOf(p.points);
  $('#stats').innerHTML = `<div class="sheet"><h2>${esc(p.name)}</h2><div class="stars" style="color:var(--sun)">مستوى ${lv}</div><div class="big">${p.points}</div><small>نقطة</small>
    <div class="grid"><div>توصيلات ناجحة<b>${p.deliveries}</b></div><div>نسبة النجاح<b>${Math.round(successRate(p) * 100)}%</b></div><div>متوسط الوقت<b>${fmt(avgTime(p))}</b></div><div>متوسط التقييم<b>${avgRating(p).toFixed(1)} ★</b></div><div>أطول سلسلة<b>${p.bestStreak} 🔥</b></div><div>مسافة التوصيل<b>${(p.distance / 1000).toFixed(1)} كم</b></div></div>
    ${ads.html('pause')}<div class="btns"><button class="btn primary" id="st-close">كمّل لعب</button><button class="btn" id="st-leave">القائمة</button></div></div>`;
  ads.scan($('#stats')); $('#stats').classList.remove('hidden');
  $('#st-close').onclick = () => $('#stats').classList.add('hidden');
  $('#st-leave').onclick = () => { $('#stats').classList.add('hidden'); leaveToMenu(); };
}

// ───────── الموتور والبنزين والونش ─────────
function showEngine(text) { $('#engine').classList.remove('hidden'); $('#eng-text').textContent = text; }
function startEngine(text = 'بيدوّر الموتور…') { S.engOn = false; S.engT = 0; showEngine(text); sfx.init(); sfx.crank(1.7); }
function engineTick(dt) {
  if (S.engOn || S.tow) return; S.engT += dt;
  if (S.engT > 1.75) $('#eng-text').textContent = 'اشتغل 🏍️';
  if (S.engT > 2.1) { S.engOn = true; $('#engine').classList.add('hidden'); }
}
function fuelLogic(dt, b, throttle) {
  if (S.mode === 'endless' || S.mode === 'race') return; // السباق والتحدي من غير بنزين
  const bk = currentBike(profile);
  if (S.engOn) profile.fuel = burnFuel(profile.fuel, b.speed, throttle, dt, bk.burn);
  const tank = tankSize(profile), pct = profile.fuel / tank;
  if (pct < 0.2 && !S.lowWarned) { S.lowWarned = true; say('lowFuel'); sfx.siren(); }
  if (pct > 0.3) S.lowWarned = false;
  S.nearSt = nearestPump(b.x, b.z);
  if (S.clock >= (S.stVisT || 0)) { S.stVisT = S.clock + 0.6; for (const st of S.stations) { const v = Math.hypot(st.cx - b.x, st.cz - b.z) < 480; if (st.mesh && st.mesh.visible !== v) st.mesh.visible = st.ramp.visible = v; } } // محطات بعيدة مش بتترسم (أداء الموبايل)
  // تعبئة يدوية: قف جنب الطلمبة → تظهر لوحة التعبئة (اختار الكمية واضغط باستمرار) — pump.js
  const ns = S.nearSt, at = !!(ns && ns.d < 8 && Math.abs(b.speed) < 1.6 && !S.tow);
  pump.update(dt, { at, name: ns && ns.st.name, holdKey: !!S.keys.KeyF });
  $('#refuel').classList.add('hidden');
  // البنزين خلص → ونش سحب + غرامة
  if (profile.fuel <= 0.001 && S.engOn && !S.tow) { S.tow = { t: 0 }; S.engOn = false; showEngine('البنزين خلص ⛽ — الونش جاي يسحبك…'); sfx.fail(); }
}
function towLogic(dt, b) {
  if (!S.tow) return; S.tow.t += dt; b.speed *= Math.max(0, 1 - 4 * dt);
  if (S.tow.t < 3.2) return;
  const ns = nearestPump(b.x, b.z), fine = towFine(profile.money); profile.money -= fine; profile.fines += fine; profile.fuel = Math.min(MIN_TOW_FUEL, tankSize(profile));
  if (ns) { const st = ns.st; b.x = st.px + st.nx * 3; b.z = st.pz + st.nz * 3; b.heading = Math.atan2(-st.nx, st.nz); b.speed = 0; b.lean = 0; S.camH = b.heading; }
  S.tow = null; saveProfile(profile); say('towed', { n: fine }); startEngine('بيدوّر الموتور…'); S.refuelAcc = 0;
}

// ───────── وضع لجنة أكتوبر (دورية) ─────────
const patrolLevel = () => 1 + Math.floor(profile.patrols / 3);
function switchRoad(a) { // المخالف بيكمّل في شارع تاني لما شارعه يخلص
  const tried = new Set([a.road]), hx = Math.sin(a.h), hz = -Math.cos(a.h), cands = [];
  for (let k = 0; k < 4; k++) {
    const n = S.roads.nearest(a.x, a.z, 22, tried); if (!n) break; tried.add(n.road);
    const L = Math.hypot(n.hx, n.hz) || 1, dx = n.hx / L, dz = n.hz / L, dot = dx * hx + dz * hz;
    cands.push({ n, dir: dot >= 0 ? 1 : -1, score: Math.abs(dot) });
  }
  if (!cands.length) return false;
  const c = Math.random() < 0.65 ? cands.sort((x, y) => y.score - x.score)[0] : pickR(cands), r = c.n.road, seg = r._cum[c.n.i + 1] - r._cum[c.n.i];
  a.road = r; a.s = r._cum[c.n.i] + c.n.t * seg; a.dir = c.dir; a.i = c.n.i; return true;
}
function fleeStep(a, dt) {
  if (a.stun > 0) { a.stun -= dt; return; }
  const next = a.s + a.dir * a.speed * dt;
  if ((a.dir > 0 && next >= a.road._len - 0.5) || (a.dir < 0 && next <= 0.5)) switchRoad(a);
  stepAgent(a, dt);
}
function spawnViolator() {
  const b = S.bike; let p = null;
  for (let k = 0; k < 40; k++) { const q = S.roads.randomPoint(Math.random, 1), d = Math.hypot(q.x - b.x, q.z - b.z); if (d > 110 && d < 230) { p = q; break; } }
  if (!p) p = S.roads.randomPoint(Math.random, 1);
  const lv = patrolLevel(), a = makeAgent(Math.random), name = pickR(PATROL_NAMES); placeAgent(a, p.road, p.s, Math.random); a.speed = Math.min(21, 11 + lv * 0.7 + Math.random() * 2);
  const mesh = makeVehicle(a.kind, a.color), label = makeLabel(name, 0xff4d6d); label.position.y = 4.2; label.scale.set(6, 1.5, 1); mesh.add(label);
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(mesh);
  S.violator = { a, mesh }; S.patrol = newPatrol(name); S.patrol.timeLeft = Math.max(45, 85 - lv * 3); sfx.siren(); say('patrolStart', { name });
}
function clearViolator() { bPatrol.visible = false; if (S.violator) { scene.remove(S.violator.mesh); S.violator = null; } }
function updatePatrol(dt, b) {
  if (!S.violator) { if (S.clock >= S.patrolNext) spawnViolator(); return; }
  const v = S.violator, p = S.patrol; fleeStep(v.a, dt); v.mesh.position.set(v.a.x, S.hasElev ? elevAtS(v.a.road, v.a.s, v.a.i) : 0, v.a.z); v.mesh.rotation.y = -v.a.h; bPatrol.position.set(v.a.x, 0, v.a.z); bPatrol.visible = p.stage !== 'caught';
  const dist = Math.hypot(v.a.x - b.x, v.a.z - b.z), ev = tickPatrol(p, dt, dist, Math.abs(b.speed));
  if (ev === 'pulledover') { v.a.stun = 1e9; sfx.ding(); say('pulledOver'); }
  else if (ev === 'caught') {
    const lv = patrolLevel(), rw = patrolReward(lv, p.timeLeft); profile.money += rw.money; profile.points += rw.points; profile.patrols++; saveProfile(profile); pushProfile(); sfx.win();
    showSheet(`<div class="sheet"><h2>مسكت المخالف ✔</h2><div class="quote">“${esc(p.name)}” اتحرر له محضر.</div><div class="big">+${rw.money} جنيه</div><div class="grid"><div>نقط<b>+${rw.points}</b></div><div>محاضر محررة<b>${profile.patrols}</b></div></div><small>اضغط للمتابعة</small></div>`);
    clearViolator(); S.patrolNext = S.clock + 5;
  } else if (ev === 'escaped') { sfx.fail(); say('escaped'); clearViolator(); S.patrolNext = S.clock + 4; }
}

// ───────── وضع تحدي الطريق المفتوح ─────────
function startEndless() {
  if (!S.hw) S.hw = buildHighway(scene);
  const b = S.bike; b.x = HIGHWAY.x + 2; b.z = 0; b.heading = 0; b.speed = 0; b.lean = 0; b.wobble = 0; b.fallTimer = 0; S.camH = 0; S.endless = newEndless(Math.random);
  camera.position.set(b.x, 2.6, b.z + 6); S.spawned = false; updateSky(true);
}
function eMesh(c) {
  if (c.mesh) return c.mesh; const pool = S.ePool[c.kind]; c.mesh = pool.pop() || makeVehicle(c.kind, c.color); scene.add(c.mesh); return c.mesh;
}
function releaseCar(c) { if (!c.mesh) return; scene.remove(c.mesh); S.ePool[c.kind].push(c.mesh); c.mesh = null; }
function clearEndlessCars() { if (S.endless) S.endless.cars.forEach(releaseCar); }
function endlessCrash() { const b = S.bike; b.speed *= 0.45; S.shake = 0.9; sfx.bump(); say('endlessCrash', { n: Math.max(0, HW.maxCrashes - S.endless.crashes) }); }
function updateEndless(dt, b) {
  const st = S.endless; if (!st) return;
  const evs = stepEndless(st, { x: b.x - HIGHWAY.x, z: b.z, speed: b.speed }, dt, { wheelie: S.wheelie && b.speed > 12 });
  for (const e of evs) {
    if (e.t === 'crash') { endlessCrash(); e.car.v *= 0.7; }
    else if (e.t === 'near') { say('endlessNear', { bonus: e.bonus, combo: e.combo }); sfx.tick(); }
    else if (e.t === 'stunt') { say('endlessStunt', { secs: e.secs.toFixed(1), bonus: e.bonus }); sfx.ding(); }
    else if (e.t === 'wheelieFall') { endlessCrash(); b.fallTimer = 1.1; S.fallSign = S.lastLean; }
    else if (e.t === 'over') { endEndless(); }
  }
  const dx = b.x - HIGHWAY.x; if (Math.abs(dx) > HIGHWAY.half) { b.x = HIGHWAY.x + Math.sign(dx) * HIGHWAY.half; b.speed *= 0.97; b.heading -= b.heading * Math.min(1, dt * 4); S.shake = Math.max(S.shake, 0.25); }
  if (b.z < -3000) { b.z += HIGHWAY.loop; st.cars.forEach((c) => { c.z += HIGHWAY.loop; }); st.lastZ += HIGHWAY.loop; camera.position.z += HIGHWAY.loop; }
  const seen = new Set();
  for (const c of st.cars) { const m = eMesh(c); m.position.set(HIGHWAY.x + c.x, 0, c.z); m.rotation.y = c.v > 0 ? Math.PI : 0; m.visible = true; seen.add(c); }
}
// ───────── سباق الشارع ─────────
function showCount(txt) { const el = $('#countdown'); el.textContent = txt; el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); clearTimeout(showCount.t); showCount.t = setTimeout(() => el.classList.add('hidden'), 900); }
function startRace() {
  const rt = buildRoute(S.roads, mulberry32(RACE.seed));
  if (!rt) { S.mode = 'delivery'; S.race = null; toast('مفيش مسار سباق على الخريطة دي — رجعنا للتوصيل', 'bad'); scheduleOffer(2); return; }
  S.race = newRace(rt, RACE.laps); const b = S.bike, p = rt[0];
  b.x = p.x; b.z = p.z; b.heading = p.heading; b.speed = 0; b.lean = 0; b.wobble = 0; b.fallTimer = 0; S.camH = b.heading;
  const f = { x: Math.sin(b.heading), z: -Math.cos(b.heading) }; camera.position.set(b.x - f.x * 8, 3.5, b.z - f.z * 8);
  const c = rt[1]; bRace.position.set(c.x, 0, c.z); bRace.visible = true;
}
function updateRace(dt, b) {
  const r = S.race; if (!r || r.stage === 'finished') return;
  if (r.stage === 'countdown') b.speed = 0;
  const evs = tickRace(r, S.engOn ? dt : 0, b), n = r.route.length;
  for (const e of evs) {
    if (e.t === 'count') { say('raceCount', { n: e.n }); showCount(String(e.n)); sfx.tick(); }
    else if (e.t === 'go') { say('raceGo'); showCount('انطلق!'); sfx.ding(); }
    else if (e.t === 'cp') { if (r.stage === 'run') { say('raceCp', { i: e.i === 0 ? n : e.i, n }); sfx.tick(); } }
    else if (e.t === 'lap') { say('raceLap', { lap: e.lap, laps: r.laps }); sfx.ding(); }
    else if (e.t === 'finish') finishRace();
  }
  if (r.stage !== 'finished') { const c = r.route[r.next]; bRace.position.set(c.x, 0, c.z); bRace.visible = true; } else bRace.visible = false;
}
function finishRace() {
  const r = S.race, t = r.finishTime, rw = raceReward(r, levelOf(profile.points)), isBest = !profile.bestRace || t < profile.bestRace;
  profile.money += rw.money; profile.points += rw.points; profile.races = (profile.races || 0) + 1; if (isBest) profile.bestRace = t; saveProfile(profile); pushProfile();
  if (net.ready) net.send({ t: 'race', time: +t.toFixed(2) });
  S.state = 'over'; bRace.visible = false; sfx.win(); say(isBest ? 'raceBest' : 'raceFinish', { time: fmtRace(t) });
  $('#stats').innerHTML = `<div class="sheet"><h2>${isBest ? '🏆 رقم قياسي جديد!' : '🏁 خلّصت السباق'}</h2><div class="big">${fmtRace(t)}</div><small>الوقت الكلي</small>
    <div class="grid">${r.lapTimes.map((x, i) => `<div>لفّة ${i + 1}<b>${fmtRace(x)}</b></div>`).join('')}<div>أفضل وقت<b>${fmtRace(profile.bestRace)}</b></div><div>فلوس<b>+${rw.money} جنيه</b></div><div>نقط<b>+${rw.points}</b></div></div>
    ${ads.html('end')}<div class="btns"><button class="btn primary" id="r-again">سباق تاني</button><button class="btn" id="r-menu">القائمة</button></div></div>`;
  ads.scan($('#stats')); $('#stats').classList.remove('hidden');
  $('#r-again').onclick = () => { $('#stats').classList.add('hidden'); startRace(); S.state = 'playing'; startEngine(); };
  $('#r-menu').onclick = () => { $('#stats').classList.add('hidden'); leaveToMenu(); };
}
function raceHUD(b) {
  const r = S.race, c = r.route[r.next], n = r.route.length;
  $('#mc-title').textContent = '🏎️ سباق الشارع'; $('#mc-reward').textContent = 'لفّة ' + r.lap + '/' + r.laps;
  $('#mc-line').textContent = r.stage === 'countdown' ? 'استعد… الموتور بيشتغل' : 'الحق النقطة ' + (r.next === 0 ? n : r.next) + ' من ' + n;
  $('#mc-sub').textContent = r.stage === 'countdown' ? 'نفس المسار لكل اللاعبين' : 'عدّي كل النقط بالترتيب · المسافة ' + Math.round(r.dist) + ' م';
  $('#mc-a').textContent = '⏱ ' + fmtRace(r.t); $('#mc-b').textContent = profile.bestRace ? '🏆 ' + fmtRace(profile.bestRace) : ''; $('#mc-b').classList.remove('warn');
  $('#mc-bar').style.width = Math.round(clamp(1 - r.dist / 250, 0, 1) * 100) + '%'; $('#mc-arrow').style.visibility = 'visible'; aim($('#mc-arrow'), Math.atan2(c.x - b.x, -(c.z - b.z)) - b.heading);
}
function endEndless() {
  const st = S.endless; if (!st) return; S.state = 'over'; clearEndlessCars(); sfx.fail();
  const rw = endlessReward(st), best = Math.max(profile.bestEndless, Math.round(st.score)); const isBest = Math.round(st.score) > profile.bestEndless;
  profile.money += rw.money; profile.points += rw.points; profile.endlessRuns++; profile.bestEndless = best; saveProfile(profile); pushProfile(); S.wheelie = false;
  $('#stats').innerHTML = `<div class="sheet"><h2>${isBest ? '🏆 رقم قياسي جديد!' : 'خلصت المحاولة'}</h2><div class="big">${Math.round(st.score)}</div><small>نقطة التحدي</small>
    <div class="grid"><div>المسافة<b>${(st.dist / 1000).toFixed(2)} كم</b></div><div>قرب شديد<b>${st.near}</b></div><div>حركات ويلي<b>${st.stunts}</b></div><div>أفضل نتيجة<b>${best}</b></div><div>فلوس<b>+${rw.money} جنيه</b></div><div>نقط<b>+${rw.points}</b></div></div>
    ${ads.html('end')}<div class="btns"><button class="btn primary" id="e-again">العب تاني</button><button class="btn" id="e-menu">القائمة</button></div></div>`;
  ads.scan($('#stats')); $('#stats').classList.remove('hidden');
  $('#e-again').onclick = () => { $('#stats').classList.add('hidden'); startEndless(); S.state = 'playing'; startEngine(); };
  $('#e-menu').onclick = () => { $('#stats').classList.add('hidden'); leaveToMenu(); };
}

// ───────── تحكم ─────────
const keyMap = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brake', KeyS: 'brake', Space: 'brake' };
window.addEventListener('keydown', (e) => {
  if (e.target && /INPUT|SELECT/.test(e.target.tagName)) return;
  S.keys[e.code] = true; if (keyMap[e.code] || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (S.lite && /^(KeyF|KeyT|KeyG|Digit)/.test(e.code)) return;
  if (e.code === 'KeyC' && !S.lite) cycleCam(); else if (e.code === 'KeyF') toggleFoot(); else if (/^Digit[1-6]$/.test(e.code) && S.foot) footEmote(EMOTE_KEYS[+e.code.slice(5) - 1]); else if (e.code === 'KeyH') horn(); else if (e.code === 'KeyM') micClick(); else if (e.code === 'Tab') toggleLB(); else if (e.code === 'KeyT') unstick(); else if (e.code === 'KeyQ' || e.code === 'ShiftLeft') S.wheelie = true; else if (e.code === 'KeyG') openMyGarage();
});
window.addEventListener('keyup', (e) => { S.keys[e.code] = false; if (e.code === 'KeyQ' || e.code === 'ShiftLeft') S.wheelie = false; });
// دوران الكاميرا: اسحب من أي مكان فاضي في الشاشة (ماوس أو لمس). الأزرار والكروت ليها أولوية لأن الـ HUD فوق الكانفس.
(() => {
  const cv = $('#view'); let id = null, lx = 0, ly = 0;
  cv.addEventListener('pointerdown', (e) => { if (S.state !== 'playing' || id !== null) return; id = e.pointerId; lx = e.clientX; ly = e.clientY; S.camDrag = true; S.camIdle = 0; try { cv.setPointerCapture(id); } catch (err) { /* ignore */ } });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; S.camIdle = 0;
    S.camYaw += dx * 0.008; S.camYaw = ((S.camYaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; S.camPit = clamp(S.camPit + dy * 0.006, -0.12, 1.15);
  });
  const end = (e) => { if (e.pointerId !== id) return; id = null; S.camDrag = false; S.camIdle = 0; };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => cv.addEventListener(ev, end));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
})();
function bindHold(id, key) {
  const el = $(id), on = (e) => { e.preventDefault(); S.touch[key] = 1; el.classList.add('down'); el.setPointerCapture && el.setPointerCapture(e.pointerId); };
  const off = () => { S.touch[key] = 0; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, off));
}
function holdWheelie() { const el = $('#b-wheelie'); el.addEventListener('pointerdown', (e) => { e.preventDefault(); S.wheelie = true; el.classList.add('down'); el.setPointerCapture && el.setPointerCapture(e.pointerId); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, () => { S.wheelie = false; el.classList.remove('down'); })); }
holdWheelie();
function openMyGarage(force) {
  if (S.state !== 'playing' || S.mode === 'endless' || garageOpen()) return;
  const g = S.garage; if (!force && (!g || Math.hypot(S.bike.x - g.ex, S.bike.z - g.ez) > 18)) return say('garageFar');
  S.bike.speed = 0; S.paused = true; sfx.engine(0, 0, false);
  openGarage(profile, { sfx, toast, onChange: () => { S.params = bikeParams(profile); }, onClose: () => { S.paused = false; setMyBike(); pushProfile(); startEngine(); } });
}
$('#b-garage').addEventListener('pointerdown', (e) => { e.preventDefault(); openMyGarage(); });
bindHold('#b-left', 'l'); bindHold('#b-right', 'r'); bindHold('#b-gas', 'gas'); bindHold('#b-brake', 'brake');
function horn() { sfx.horn(); if (net.ready) net.send({ t: 'horn' }); }
$('#b-horn').addEventListener('pointerdown', (e) => { e.preventDefault(); horn(); });
function micUI() {
  const b = $('#b-mic'); b.classList.toggle('on', !!voice.stream && !voice.muted); b.classList.toggle('muted', !!voice.stream && voice.muted); b.textContent = voice.stream && voice.muted ? '🔇' : '🎙️';
}
async function micClick() {
  if (!net.ready) return say('voiceNoRoom');
  try {
    if (!voice.stream) { await voice.enableMic(); say('micOn'); }
    else { voice.setMuted(!voice.muted); say(voice.muted ? 'micMuted' : 'micUnmuted'); }
  } catch (e) { say('micFail'); }
  micUI();
}
$('#b-mic').addEventListener('pointerdown', (e) => { e.preventDefault(); micClick(); });
$('#b-vmode').addEventListener('pointerdown', (e) => { e.preventDefault(); const m = voice.toggleMode(); $('#b-vmode').textContent = m === 'prox' ? '📍' : '🌐'; say(m === 'prox' ? 'voiceProx' : 'voiceRoom'); });
function toggleLB() { S.lbOpen = !S.lbOpen; $('#leaderboard').classList.toggle('hidden', !S.lbOpen); renderLB(); }
$('#mapwrap').onclick = () => { drawBigMap(); $('#bigmap').classList.remove('hidden'); }; $('#bigmap').onclick = () => $('#bigmap').classList.add('hidden');
$('#btn-lb').onclick = toggleLB; $('#btn-profile').onclick = renderStats; $('#btn-menu').onclick = renderStats;
$('#btn-share').onclick = async () => {
  const text = `ادخل غرفتي في كوكب الجحود أكتوبر! الكود: ${net.code}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(net.code); say('codeCopied', { code: net.code }); } } catch (e) { /* ألغى */ }
};

// ───────── القائمة والدخول ─────────
$('#name').value = profile.name;
COLORS.forEach((c) => {
  const d = document.createElement('div'); d.className = 'sw' + (c === profile.color ? ' on' : ''); d.style.background = hex(c);
  d.onclick = () => { profile.color = c; document.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); d.classList.add('on'); };
  $('#swatches').appendChild(d);
});
$('#code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
const errMsg = (e) => ({ network: 'مفيش اتصال بالنت', 'server-error': 'سيرفر التعارف مش متاح دلوقتي', 'browser-incompatible': 'المتصفح مش بيدعم WebRTC' }[e && e.type] || (e && e.message) || 'حصلت مشكلة، جرب تاني');

function applySettings() {
  const st = profile.settings;
  st.assist = +$('#drive').value; st.autoGas = $('#autogas').value === '1'; st.density = $('#density').value;
  S.params = bikeParams(profile); S.density = st.density;
  if (S.life) S.life.setDensity(st.density); if (S.props) S.props.setDensity(st.density);
}
$('#drive').value = String(profile.settings.assist); $('#autogas').value = profile.settings.autoGas ? '1' : '0'; $('#density').value = profile.settings.density; S.density = profile.settings.density; $('#srv').value = serverBase();
async function enterGame(mode) {
  profile.name = $('#name').value.trim().slice(0, 14) || profile.name; applySettings(); setServerBase($('#srv').value); saveProfile(profile);
  S.timeMode = $('#timemode').value; applyQuality($('#quality').value); sfx.init(); voice.init(); setStatus('');
  try {
    if (mode !== 'solo') {
      setLoading('بنتواصل مع الشبكة…'); wireNet();
      if (mode === 'host') await net.host(publicProfile(profile), { pw: $('#room-pw').value, max: +$('#room-max').value });
      else { const code = $('#code').value.trim(); if (code.length < 4) throw new Error('اكتب كود الغرفة الأول'); await net.join(code, publicProfile(profile), $('#room-pw').value); }
      voice.bind(net);
    }
    if (!S.world) await loadWorld();
    startPlaying(mode); await endLoading();
  } catch (e) { console.error(e); hideLoading(); net.close(); for (const id of [...S.remotes.keys()]) removeRemote(id); setStatus(errMsg(e)); }
}
function startPlaying(mode) {
  $('#menu').classList.add('hidden'); $('#hud').classList.remove('hidden');
  S.online = mode !== 'solo'; $('#roomchip').classList.toggle('hidden', !S.online);
  if (S.online) { $('#roomcode').textContent = net.code; }
  S.mode = S.modeSel || 'delivery'; decorateMe(); placeMyGarage(); for (const r of S.remotes.values()) addRemoteGarage(r.id, r.profile);
  clearViolator(); S.patrol = null; S.tow = null; S.paused = false; S.wheelie = false;
  if (S.mode !== 'delivery') { S.mission = null; S.offer = null; S.offers = []; syncBeacons(); }
  if (S.mode === 'endless') startEndless(); else { if (S.endless) { clearEndlessCars(); S.endless = null; S.spawned = false; } if (!S.spawned) spawnPlayer(); }
  S.shiftStart = profile.points; S.lastMoney = profile.money; S.race = null; bRace.visible = false; $('#roomchip').classList.toggle('locked', !!(S.online && net.pw));
  S.state = 'playing'; if (S.mode === 'delivery') scheduleOffer(2); else if (S.mode === 'patrol') S.patrolNext = S.clock + 2; else if (S.mode === 'race') startRace();
  startEngine(); micUI(); renderLB(); updateSky(true);
  if (S.mode === 'endless') say('modeEndless'); else if (S.mode === 'patrol') say('modePatrol'); else if (S.mode === 'race' && S.race) say('modeRace'); else toast(S.sourceNote || '', 'good');
}
function leaveToMenu() {
  refreshMenuAd();
  if (S.lite) stopLite(); S.race = null; bRace.visible = false; $('#countdown').classList.add('hidden'); $('#customer').classList.add('hidden');
  sfx.engine(0, 0, false); voice.close(); net.close(); for (const id of [...S.remotes.keys()]) removeRemote(id);
  S.foot = null; S.footCam = null; resetWalker(); setRiderVis(me, true); S.state = 'menu'; S.mission = null; S.offer = null; S.offers = []; syncBeacons(); S.bike.speed = 0; micUI();
  clearViolator(); S.patrol = null; S.tow = null; S.paused = false; S.wheelie = false; S.pitch = 0; $('#engine').classList.add('hidden'); $('#refuel').classList.add('hidden'); $('#stats').classList.add('hidden');
  if (S.endless) { clearEndlessCars(); S.endless = null; S.spawned = false; } saveProfile(profile); updateWallet();
  $('#hud').classList.add('hidden'); $('#menu').classList.remove('hidden'); setStatus('');
}
function updateWallet() { $('#mn-money').textContent = '💰 ' + Math.round(profile.money) + ' جنيه'; $('#mn-bike').textContent = '🏍️ ' + currentBike(profile).name; }
S.modeSel = (() => { try { return localStorage.getItem('orider-mode') || 'delivery'; } catch (e) { return 'delivery'; } })();
document.querySelectorAll('.mode').forEach((el) => {
  el.classList.toggle('on', el.dataset.mode === S.modeSel);
  el.onclick = () => { S.modeSel = el.dataset.mode; try { localStorage.setItem('orider-mode', S.modeSel); } catch (e) { /* ignore */ } document.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x === el)); };
});
$('#btn-wardrobe').onclick = () => { sfx.init(); openWardrobe(profile, { onChange: () => { pushProfile(); }, toast: (m) => setStatus(m), onClose: () => { setMyBike(); } }); };
$('#btn-garage').onclick = () => { sfx.init(); openGarage(profile, { sfx, toast: (m) => setStatus(m), onChange: () => { S.params = bikeParams(profile); updateWallet(); }, onClose: () => { setMyBike(); updateWallet(); } }); };
updateWallet();
$('#btn-solo').onclick = () => enterGame('solo'); $('#btn-host').onclick = () => enterGame('host'); $('#btn-join').onclick = () => enterGame('join');

// ───────── النسخة الخفيفة 2D (للموبايلات الضعيفة): نفس الخريطة والطلبات من فوق من غير 3D ─────────
async function enterLite() {
  profile.name = $('#name').value.trim().slice(0, 14) || profile.name; applySettings(); setServerBase($('#srv').value); saveProfile(profile); sfx.init(); setStatus('');
  try {
    if (!S.world && !S.liteData) { setLoading('بنحمّل الخريطة…'); const data = await loadCityData(setLoading); S.liteData = { data, roads: new RoadIndex(data.roads) }; }
    hideLoading(); startLite();
  } catch (e) { console.error(e); hideLoading(); setStatus(errMsg(e)); }
}
function startLite() {
  const ld = S.world ? { data: S.data, roads: S.roads } : S.liteData; if (!ld) return;
  S.params = bikeParams(profile); S.online = false; S.mode = 'lite'; S.shiftStart = profile.points; S.lastMoney = profile.money; S.paused = false; S.engOn = true;
  S.lite = new Lite({ canvas: $('#lite'), data: ld.data, roads: ld.roads, profile, params: S.params, keys: S.keys, touch: S.touch, half: CITY.half, hooks: { toast, onDone: liteDone, onFail: liteFail } });
  S.lite.resize(); $('#lite').classList.remove('hidden'); $('#view').classList.add('hidden'); $('#menu').classList.add('hidden'); $('#hud').classList.remove('hidden'); $('#hud').classList.add('lite'); $('#roomchip').classList.add('hidden');
  S.state = 'playing'; micUI(); renderLB(); toast('النسخة الخفيفة 2D — من غير بنزين، وصّل الطلبات!', 'good');
}
function stopLite() { S.lite = null; S.mode = 'delivery'; $('#lite').classList.add('hidden'); $('#view').classList.remove('hidden'); $('#hud').classList.remove('lite'); }
function liteDone(m, res) { recordSuccess(profile, m, res); sfx.win(); showResult(m, res, true); vib(60); pushProfile(); }
function liteFail(m) { recordFail(profile); sfx.fail(); showResult(m, null, false); pushProfile(); }
function liteFrame(dt) {
  const L = S.lite; if (!L || S.state !== 'playing' || S.paused) return;
  L.step(dt); L.draw(); const b = L.bike; sfx.engine(b.speed, L.throttle, true);
  S.hudT += dt; S.saveT += dt; if (S.saveT > 6) { S.saveT = 0; saveProfile(profile); }
  if (S.hudT > 0.1) {
    S.hudT = 0; $('#speed').textContent = Math.round(Math.abs(b.speed) * 3.6); $('#speedo').style.setProperty('--p', clamp(Math.abs(b.speed) * 3.6 / 120, 0, 1).toFixed(3));
    const danger = clamp(Math.max(b.risk / 0.85, b.wobble), 0, 1), rk = $('#risk'); rk.style.width = Math.round(danger * 100) + '%'; rk.style.background = danger > 0.7 ? 'var(--rose)' : danger > 0.4 ? 'var(--gold)' : 'var(--teal)';
    $('#p-level').textContent = 'Lv ' + levelOf(profile.points); $('#p-points').textContent = profile.points; $('#p-streak').textContent = profile.streak > 1 ? '🔥' + profile.streak : ''; $('#p-money').textContent = '💰' + Math.round(profile.money);
    trackProgress(); if (S.lbOpen) renderLB();
  }
}
$('#btn-lite').onclick = enterLite;
window.addEventListener('resize', () => { if (S.lite) S.lite.resize(); });

// ───────── صفحات: عن اللعبة / الخصوصية / الشروط ─────────
function openInfo(k) {
  const d = INFO[k]; if (!d) return; const box = $('#info');
  box.innerHTML = `<div class="sheet info"><div class="g-head"><h2>${d.t}</h2><button class="round" id="info-x" aria-label="إغلاق">✕</button></div><div class="info-body">${d.h}</div></div>`;
  box.classList.remove('hidden'); $('#info-x').onclick = () => box.classList.add('hidden');
}
document.querySelectorAll('[data-info]').forEach((el) => { el.onclick = () => openInfo(el.dataset.info); });
$('#info').addEventListener('pointerdown', (e) => { if (e.target.id === 'info') $('#info').classList.add('hidden'); });

// ───────── النزول من الموتوسيكل والمشي + الحركات الخاصة (F نزول/ركوب · 1-6 حركات) ─────────
var walker = null;
function resetWalker() { if (walker) { scene.remove(walker.group); walker = null; } }
function dismount() {
  if (S.state !== 'playing' || S.foot || S.mode === 'endless' || S.tow || S.paused) return;
  const b = S.bike; if (Math.abs(b.speed) > 2.2) return say('mustStop');
  resetWalker(); try { walker = (hasChar('model3') && makeGlbCharacter('model3')) || (hasChar('walker') && makeGlbCharacter('walker')) || createWalker(profile.outfit, profile.color); } catch (e) { console.error('walker', e); walker = null; return; } // لو الشخصية فشلت مننزلش (من غير ما نخفي السواق)
  S.foot = { x: b.x + Math.cos(b.heading) * 0.95, z: b.z + Math.sin(b.heading) * 0.95, h: b.heading, speed: 0, emote: null, mount: 0.5, hold: 0 };
  S.footCam = { x: S.foot.x, z: S.foot.z, heading: S.foot.h, speed: 0 };
  S.engOn = false; $('#engine').classList.add('hidden'); setRiderVis(me, false); b.speed = 0; scene.add(walker.group); sfx.init(); sfx.pop(); say('dismount'); footUI();
}
function mountBike() {
  if (!S.foot) return; if (Math.hypot(S.foot.x - S.bike.x, S.foot.z - S.bike.z) > 3.4) return say('farFromBike');
  S.foot = null; S.footCam = null; resetWalker(); setRiderVis(me, true); sfx.pop(); startEngine(); say('mount'); footUI();
}
const toggleFoot = () => (S.foot ? mountBike() : dismount());
function footEmote(name) { if (!S.foot || !EMOTES[name]) return; S.foot.emote = S.foot.emote === name ? null : name; if (S.foot.emote) sfx.ding(); footUI(); }
function footStep(dt) {
  const f = S.foot, k = S.keys, t = S.touch;
  const turn = (k.ArrowRight || k.KeyD || t.r ? 1 : 0) - (k.ArrowLeft || k.KeyA || t.l ? 1 : 0), fw = k.ArrowUp || k.KeyW || t.gas ? 1 : 0, bk = k.ArrowDown || k.KeyS || t.brake ? 1 : 0;
  f.hold = fw && !bk ? f.hold + dt : 0; let sp = fw && !bk ? (f.hold > 1.1 || k.ShiftLeft || k.ShiftRight ? 5.2 : 2.3) : bk && !fw ? -1.4 : 0;
  f.h += turn * 2.3 * dt; if (sp) f.emote = null;
  const px = f.x, pz = f.z; f.x += Math.sin(f.h) * sp * dt; f.z -= Math.cos(f.h) * sp * dt;
  if (S.bIdx.hit(f.x, f.z, 0.35) || hitSolid(f.x, f.z) || Math.hypot(f.x - S.bike.x, f.z - S.bike.z) < 0.75) { f.x = px; f.z = pz; sp = 0; }
  if (S.hasElev && S.bikeY > 1.2) { const lv = S.roads.heightAt(f.x, f.z, S.bikeY, -0.3); if (!lv || lv.y < S.bikeY - 1.6) { f.x = px; f.z = pz; sp = 0; } } // فوق كوبري: ما تمشيش برّه الحافة
  const lim = CITY.half - 12; f.x = clamp(f.x, -lim, lim); f.z = clamp(f.z, -lim, lim); f.speed = Math.abs(sp); f.mount = Math.max(0, f.mount - dt);
  const c = S.footCam; c.x = f.x; c.z = f.z; c.heading = f.h; c.speed = f.speed;
}
function footVisuals(dt) {
  if (!walker || !S.foot) return; const f = S.foot, a = walker.update(dt, f.speed, f.emote, f.mount);
  walker.group.position.set(f.x, S.bikeY, f.z); walker.group.rotation.y = -f.h; f.anim = a;
}
let footEls = null;
function footUI() {
  if (!footEls) {
    const st = document.createElement('style'); st.textContent = '#b-foot{z-index:40;min-width:62px;min-height:52px;padding:6px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(14,26,43,.88);color:#fff;font:700 13px Cairo,Tahoma,Arial,sans-serif;touch-action:none}#b-foot.hidden,#emotes.hidden{display:none}#emotes{position:fixed;z-index:40;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 118px);transform:translateX(-50%);display:flex;gap:6px;padding:6px;border-radius:16px;background:rgba(14,26,43,.86);direction:rtl;max-width:96vw;overflow-x:auto}#emotes button{min-width:50px;min-height:50px;border-radius:12px;border:0;background:#263a56;color:#fff;font:600 11px Cairo,Tahoma,Arial,sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}#emotes button b{font-size:22px;font-weight:400}#emotes button.on{background:#19c2a0;color:#042}#emotes button:focus-visible,#b-foot:focus-visible{outline:2px solid #ffc83d;outline-offset:2px}';
    document.head.appendChild(st);
    const btn = document.createElement('button'); btn.id = 'b-foot'; btn.className = 'hidden'; btn.setAttribute('aria-label', 'نزول / ركوب الموتوسيكل (F)'); document.body.appendChild(btn);
    const em = document.createElement('div'); em.id = 'emotes'; em.className = 'hidden'; em.setAttribute('role', 'toolbar'); em.setAttribute('aria-label', 'حركات خاصة');
    em.innerHTML = EMOTE_KEYS.map((k, i) => `<button data-e="${k}" title="${EMOTES[k][1]} (${i + 1})"><b>${EMOTES[k][0]}</b>${EMOTES[k][1]}</button>`).join(''); document.body.appendChild(em);
    em.onclick = (e) => { const b = e.target.closest('button'); if (b) footEmote(b.dataset.e); };
    makeFloating(btn, 'foot', { def: { x: 0.98, y: 0.42 }, onTap: toggleFoot }); footEls = { btn, em };
  }
  const on = S.state === 'playing' && S.mode !== 'endless';
  footEls.btn.classList.toggle('hidden', !on); footEls.btn.textContent = S.foot ? '🏍️ ركوب (F)' : '🚶 نزول (F)'; footEls.em.classList.toggle('hidden', !(on && S.foot));
  for (const b of footEls.em.children) b.classList.toggle('on', !!S.foot && S.foot.emote === b.dataset.e);
}
setInterval(footUI, 600);

// ───────── اللوب الرئيسي ─────────
function updateSky(force) {
  if (!S.world || (!force && S.clock < S.skyT)) return; S.skyT = S.clock + 1;
  const h = S.timeMode === 'day' ? 13 : S.timeMode === 'sunset' ? 18.2 : S.timeMode === 'night' ? 22.5 : getCairoHour(), sk = skyFor(h);
  scene.background.copy(sk.sky); scene.fog.color.copy(sk.sky);
  const u = skyDome.material.uniforms; u.horizon.value.copy(sk.sky); u.top.value.copy(sk.sky).multiplyScalar(0.6 + 0.0 * sk.night); u.sunDir.value.copy(sk.sunDir); u.sunCol.value.copy(sk.sunColor); u.sunAmt.value = 1 - sk.night; scene.fog.far = 720 - sk.night * 260;
  hemi.intensity = sk.hemiI; sun.intensity = sk.sunI; sun.color.copy(sk.sunColor); sun.position.copy(S.bike ? new THREE.Vector3(S.bike.x, 0, S.bike.z).addScaledVector(sk.sunDir, 200) : sk.sunDir);
  sun.target.position.set(S.bike.x, 0, S.bike.z); stars.material.opacity = clamp(sk.night * 1.2 - 0.1, 0, 1); S.world.setNight(sk.night); if (S.props) S.props.setNight(sk.night); setVehicleNight(sk.night); if (S.hw) S.hw.setNight(sk.night);
}

function update(dt) {
  S.clock += dt; const b = S.bike, k = S.keys, t = S.touch, endless = S.mode === 'endless';
  const foot = !!S.foot, steerT = foot ? 0 : (k.ArrowRight || k.KeyD || t.r ? 1 : 0) - (k.ArrowLeft || k.KeyA || t.l ? 1 : 0);
  S.steerS += (steerT - S.steerS) * Math.min(1, dt * (steerT === 0 ? 22 : 16)); // رجوع للنص أسرع من الدخول
  const canDrive = S.engOn && !S.tow && (profile.fuel > 0.001 || S.mode === 'race');
  const brake = foot || k.ArrowDown || k.KeyS || k.Space || t.brake || !S.engOn ? 1 : 0, manualGas = !foot && !!(k.ArrowUp || k.KeyW || t.gas), autoGas = profile.settings.autoGas && !endless && !foot;
  const throttle = canDrive && (manualGas || (autoGas && !brake)) ? 1 : 0; S.inThr = throttle; S.inBrk = brake;
  S.revHold = brake && b.speed < 0.3 && S.engOn ? S.revHold + dt : 0;
  const px = b.x, pz = b.z; if (Math.abs(b.lean) > 0.05) S.lastLean = Math.sign(b.lean);
  const q = endless ? null : (S.hasElev ? S.roads.nearestAt(b.x, b.z, 30, S.bikeY) : S.roads.nearest(b.x, b.z, 30)), onRoad = endless || (!!q && q.d <= q.road.w / 2 + 1.2);
  const inp = { throttle, brake, steer: S.engOn ? S.steerS : 0, reverse: canDrive && (S.revHold > 0.45 || !!k.KeyR), roadHeading: q && q.hx !== undefined ? Math.atan2(q.hx, -q.hz) : undefined };
  stepBike(b, inp, dt, onRoad, S.params); b.lvl = S.bikeY;
  if (S.hasElev && !endless && S.bikeY > 1.2) { // فوق كوبري: الحاجز الجانبي بيمنع النزول من الحافة
    const lv = S.roads.heightAt(b.x, b.z, S.bikeY, -0.3);
    if (!lv || lv.y < S.bikeY - 1.6) { const imp = Math.abs(b.speed); b.x = px; b.z = pz; b.speed *= 0.4; b.lean *= 0.5; if (imp > 7) { S.shake = Math.max(S.shake, 0.35); sfx.bump(); } }
  }
  if (foot) { b.speed = 0; footStep(dt); }
  if (b.fell) {
    S.fallSign = S.lastLean; sfx.bump(); S.shake = 0.8; hitMission(S.mission, 'fall'); say('fall');
    if (endless && S.endless) { S.endless.crashes++; S.endless.combo = 0; endlessCrash(); if (S.endless.crashes >= HW.maxCrashes) endEndless(); }
  }
  if (!endless) {
    // الرصيف: بقى زي الرمل — بتمشي عليه عادي من غير تصادم أو وقوع (الموتوسيكل بس بيعلى شوية)
    if (S.bIdx.hit(b.x, b.z, 0.7) || hitSolid(b.x, b.z)) {
      const imp = Math.abs(b.speed); b.x = px; b.z = pz; b.speed = -b.speed * 0.2; S.stuck += dt;
      if (imp > 5) crash('hitBuilding'); else b.speed *= 0.5;
      if (S.stuck > 1.2) { unstick(); S.stuck = 0; }
    } else S.stuck = Math.max(0, S.stuck - dt);
    // حدود الخريطة: جدار فعلي — بيوقّفك وبيرجّعك لجوه من غير ما تعدّي، وتحذير على الشاشة قبله بـ 70م
    const lim = CITY.half - 12, ex = Math.max(Math.abs(b.x), Math.abs(b.z));
    if (ex > lim) {
      const nx = Math.abs(b.x) >= Math.abs(b.z) ? Math.sign(b.x) : 0, nz = nx ? 0 : Math.sign(b.z);
      b.x = clamp(b.x, -lim, lim); b.z = clamp(b.z, -lim, lim);
      const f = { x: Math.sin(b.heading), z: -Math.cos(b.heading) }, out = f.x * nx + f.z * nz;
      if (out * b.speed > 0 && Math.abs(b.speed) > 6) { sfx.bump(); S.shake = Math.max(S.shake, 0.5); }
      if (out * b.speed > 0) b.speed *= 0.25;
    }
    S.edge = clamp((ex - (CITY.half - 90)) / 78, 0, 1);
    if (!onRoad && Math.abs(b.speed) > 12) say('offroad');
  }

  engineTick(dt); fuelLogic(dt, b, throttle); towLogic(dt, b); if (S.clock >= S.locT) { S.locT = S.clock + 0.5; locationTick(b); }
  if (S.mode === 'delivery') { if (S.mission) { const ev = tickMission(S.mission, dt, b, b.risk); if (ev) onMissionEvent(ev); } maybeOffer(); }
  else if (S.mode === 'patrol') updatePatrol(dt, b);
  else if (S.mode === 'race') updateRace(dt, b);
  else if (endless) updateEndless(dt, b);
  if (!endless) { updateTraffic(dt); if (S.life) S.life.update(dt, b); if (S.props && S.clock >= S.propT) { S.propT = S.clock + 0.4; S.props.update(b.x, b.z); } } updateRemotes(dt);
  S.pitch += ((S.wheelie && b.speed > 12 && throttle ? 0.6 : 0) - S.pitch) * Math.min(1, dt * 6);
  stuntTick(S, dt, throttle, () => { say('wheelieFall'); S.shake = Math.max(S.shake, 0.6); });
  if (net.ready) net.sendState({ f: S.foot ? [+S.foot.x.toFixed(2), +S.foot.z.toFixed(2), +S.foot.h.toFixed(2), S.foot.speed > 0.2 ? 1 : 0, EMOTE_KEYS.indexOf(S.foot.emote) + 1] : 0, x: +b.x.toFixed(2), z: +b.z.toFixed(2), h: +b.heading.toFixed(3), v: +b.speed.toFixed(1), l: +b.lean.toFixed(3), ld: S.mission && S.mission.stage === 'dropoff' ? loadCode(S.mission.load, S.mission.pax) : 0 }, performance.now());
  sfx.engine(b.speed, throttle, S.state === 'playing' && S.engOn);
  S.saveT += dt; if (S.saveT > 6) { S.saveT = 0; saveProfile(profile); }
}

// ───────── 3 أوضاع كاميرا: مطاردة (3rd person) · من العدّاد (First-person) · درون من فوق ─────────
const CAM_MODES = ['chase', 'dash', 'drone'], CAM_NAMES = { chase: '🎥 كاميرا المطاردة (من ورا)', dash: '🏍️ من عدّاد السرعة (First-person)', drone: '🚁 درون من فوق' };
const _cv = new THREE.Vector3(), _cu = new THREE.Vector3(), _cf = new THREE.Vector3();
function setFov(v, k = 0.12) { if (Math.abs(camera.fov - v) > 0.05) { camera.fov += (v - camera.fov) * k; camera.updateProjectionMatrix(); } }
function camDash(dt, b) {
  if (camera.near !== 0.04) { camera.near = 0.04; camera.updateProjectionMatrix(); }
  const A = me.anchors(); me.rig.updateWorldMatrix(true, false);
  _cv.set(0, A.head[1] - 0.06, A.head[2] + 0.1); me.rig.localToWorld(_cv); camera.position.copy(_cv);
  _cf.set(0, -0.06, -1).transformDirection(me.rig.matrixWorld); // اتجاه الموتوسيكل (بيتبع الميل والويلي)
  _cu.set(0, 1, 0).lerp(_cf.clone().set(0, 1, 0).transformDirection(me.rig.matrixWorld), 0.45).normalize(); camera.up.copy(_cu); // نص الميل بس عشان ما تدوخش
  S.shake *= Math.exp(-dt * 6); if (S.shake > 0.01) { camera.position.x += (Math.random() - 0.5) * S.shake * 0.2; camera.position.y += (Math.random() - 0.5) * S.shake * 0.15; }
  camera.lookAt(_cv.add(_cf.multiplyScalar(12)).addScaledVector(_cu, -0.3)); camera.up.set(0, 1, 0);
  setFov(76 + Math.min(10, Math.abs(b.speed) * 0.25), 0.1);
}
function camDrone(dt, b, cb) {
  if (camera.near !== 0.5) { camera.near = 0.5; camera.updateProjectionMatrix(); }
  const t = performance.now() / 1000, yw = S.camH + S.camYaw + Math.sin(t * 0.17) * 0.18, f = { x: Math.sin(yw), z: -Math.cos(yw) };
  const H = 22 + Math.min(10, Math.abs(cb.speed) * 0.2), back = 8 + Math.min(5, Math.abs(cb.speed) * 0.1), a = 1 - Math.exp(-dt * 3.2);
  camera.position.x += (cb.x - f.x * back - camera.position.x) * a; camera.position.y += (S.bikeY + H - camera.position.y) * a; camera.position.z += (cb.z - f.z * back - camera.position.z) * a;
  camera.up.set(0, 1, 0); camera.lookAt(cb.x + f.x * (2 + Math.abs(cb.speed) * 0.1), S.bikeY, cb.z + f.z * (2 + Math.abs(cb.speed) * 0.1)); setFov(54, 0.08);
}
function cycleCam(to) {
  const i = CAM_MODES.indexOf(S.camMode); S.camMode = to || CAM_MODES[(i + 1) % CAM_MODES.length]; try { localStorage.setItem('orider-cam', S.camMode); } catch (e) { /* ignore */ }
  if (S.camMode !== 'dash') camera.up.set(0, 1, 0); toast(CAM_NAMES[S.camMode], 'good', 1800); const bt = $('#b-cam'); if (bt) bt.dataset.mode = S.camMode;
}
S.camMode = (() => { try { const v = localStorage.getItem('orider-cam'); return CAM_MODES.includes(v) ? v : 'chase'; } catch (e) { return 'chase'; } })();
function updateVisuals(dt) {
  const b = S.bike, cb = S.footCam || b; footVisuals(dt);
  let dr = S.mode === 'endless' ? null : driveAt(b.x, b.z), gy = S.mode === 'endless' ? 0 : S.roads.surface(b.x, b.z).s === 1 ? KERB_H : dr ? KERB_H * clamp(dr.u / (SIDEWALK_W * 0.5), 0, 1) : 0; 
  if (S.hasElev && S.mode !== 'endless') { const lv = S.roads.heightAt(b.x, b.z, S.bikeY, 0.6); if (lv && lv.y > 0.25) gy = lv.y; }
  S.bikeY += (gy - S.bikeY) * Math.min(1, dt * 14);
  me.group.position.set(b.x, S.bikeY, b.z); me.group.rotation.y = -b.heading; me.fork.rotation.y = -b.steerAngle * 1.1; me.pitch.rotation.x += (S.pitch - me.pitch.rotation.x) * Math.min(1, dt * 10);
  const fallTilt = b.fallTimer > 0 ? S.fallSign * -1.35 : -b.lean; me.lean.rotation.z += (fallTilt - me.lean.rotation.z) * Math.min(1, dt * 10);
  me.front.rotation.x = me.rear.rotation.x += (b.speed * dt) / 0.36;
  if (!S.foot) setRiderVis(me, S.camMode !== 'dash'); // من العدّاد: الراكب مخفي
  if (me.glbRider && !S.foot) me.glbRider.update(dt, me, { speed: b.speed, steer: -b.steerAngle * 1.9, lean: b.lean, throttle: S.inThr || 0, brake: S.inBrk || 0, wheelie: S.pitch > 0.15 });
  if (me.hasDash) me.setDash(Math.abs(b.speed) * 3.6, profile.fuel / Math.max(1, tankSize(profile)));
  S.camH += angDiff(cb.heading, S.camH) * (1 - Math.exp(-dt * 5)); const fh = { x: Math.sin(S.camH), z: -Math.cos(S.camH) };
  // كاميرا حرة 360°: سحب بالماوس/الصباع من أي مكان فاضي. بعد ما تسيب بـ 2.5 ثانية بترجع ورا الموتوسيكل لوحدها.
  if (!S.camDrag) { S.camIdle = (S.camIdle || 0) + dt; if (S.camIdle > 2.5) { const k = Math.exp(-dt * 3.5); S.camYaw *= k; S.camPit *= k; if (Math.abs(S.camYaw) < 0.002) S.camYaw = 0; if (Math.abs(S.camPit) < 0.002) S.camPit = 0; } }
  if (S.camHook) S.camHook(camera, me, b); else if (S.camMode === 'dash' && !S.footCam) camDash(dt, b); else if (S.camMode === 'drone' && !S.footCam) camDrone(dt, b, cb); else {
  if (camera.near !== 0.5) { camera.near = 0.5; camera.updateProjectionMatrix(); }
  const yw = S.camH + S.camYaw, f = { x: Math.sin(yw), z: -Math.cos(yw) }, cp = Math.cos(S.camPit), sp = Math.sin(S.camPit);
  const dist = (S.footCam ? 3.2 : 5.0 + Math.abs(cb.speed) * 0.07) * cp, tx = cb.x - f.x * dist, tz = cb.z - f.z * dist, ty = S.bikeY + (S.footCam ? 1.5 : 2.3) + Math.abs(cb.speed) * 0.02 + S.pitch + (5.0 + Math.abs(cb.speed) * 0.07) * sp, a = 1 - Math.exp(-dt * 8);
  camera.position.x += (tx - camera.position.x) * a; camera.position.y += (Math.max(0.5, ty) - camera.position.y) * a; camera.position.z += (tz - camera.position.z) * a;
  S.shake *= Math.exp(-dt * 6); if (S.shake > 0.01) { camera.position.x += (Math.random() - 0.5) * S.shake * 0.5; camera.position.y += (Math.random() - 0.5) * S.shake * 0.4; }
  { const ahead = 6 * Math.max(0, 1 - Math.abs(S.camYaw) / 0.9); camera.lookAt(cb.x + fh.x * ahead, S.bikeY + 1.1, cb.z + fh.z * ahead); }
  const fov = 62 + Math.min(18, Math.abs(cb.speed) * 0.5); if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
  }
  missionFxTick(dt); stars.position.copy(camera.position); skyDome.position.copy(camera.position); updateSky(false); updateNavArrow();
  const tt = performance.now() / 1000; bPick.userData.tick(tt, camera.position); bDrop.userData.tick(tt, camera.position); bPatrol.userData.tick(tt, camera.position); bRace.userData.tick(tt, camera.position);
}

// تدوير السهم بأقصر طريق: من غير ما يلف لفة كاملة لما الزاوية تعدّي ±180° (كان بيحصل مع الترانزيشن)
function aim(el, rel) {
  const full = Math.PI * 2, cur = el._rot || 0; let d = (((rel - cur) % full) + full) % full; if (d > Math.PI) d -= full;
  el._rot = cur + d; el.style.transform = `rotate(${el._rot}rad)`;
}
// وصف الاتجاه بالكلام: قدامك / يمينك / ارجع…
function dirText(rel, d) {
  const a = ((rel + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, ab = Math.abs(a), side = a > 0 ? 'يمينك' : 'يسارك';
  const t = ab < 0.3 ? '⬆️ كمّل قدامك' : ab < 0.9 ? (a > 0 ? '↗️ ' : '↖️ ') + 'ميّل شوية على ' + side : ab < 2.1 ? (a > 0 ? '➡️ ' : '⬅️ ') + 'لف ' + (a > 0 ? 'يمين' : 'يسار') : '↩️ ارجع ورا (دوّر)';
  return t + ' · ' + Math.round(d) + ' م';
}
// ── سهم 3D عايم فوق الموتوسيكل بيشاور على الهدف ──
const navArrow = (() => {
  const sh = new THREE.Shape(); [[-0.34, -1], [-0.34, 0.15], [-0.85, 0.15], [0, 1.25], [0.85, 0.15], [0.34, 0.15], [0.34, -1]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.95, depthTest: false }), m = new THREE.Mesh(geo, mat), grp = new THREE.Group();
  const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthTest: false, side: THREE.BackSide })); edge.scale.setScalar(1.12); edge.position.y = -0.02;
  grp.add(edge, m); m.renderOrder = edge.renderOrder = 998; grp.renderOrder = 998; grp.visible = false; grp.userData.mat = mat; scene.add(grp); return grp;
})();
const SHOW_3D_ARROW = false; // السهم الأرضي طلع مش واضح؛ بنعتمد على سهم بانل الطلب + عمود الهدف
function updateNavArrow() {
  const b = S.bike; let tgt = null, col = 0xff7a1a;
  if (S.state === 'playing' && S.mode === 'delivery' && S.mission) { const m = S.mission; tgt = m.stage === 'dropoff' ? m.dropoff : m.pickup; col = m.stage === 'dropoff' ? 0x19c2a0 : 0xff7a1a; }
  else if (S.state === 'playing' && S.mode === 'patrol' && S.violator && S.patrol && S.patrol.stage !== 'caught') { tgt = S.violator.a; col = 0xff4d6d; }
  else if (S.state === 'playing' && S.nearSt && profile.fuel / tankSize(profile) < 0.2 && S.mode !== 'endless') { tgt = { x: S.nearSt.st.px, z: S.nearSt.st.pz }; col = 0xffc83d; }
  navArrow.visible = !!tgt && !S.paused && SHOW_3D_ARROW; if (!tgt || !SHOW_3D_ARROW) return;
  const ang = Math.atan2(tgt.x - b.x, -(tgt.z - b.z)), d = Math.hypot(tgt.x - b.x, tgt.z - b.z), s = clamp(0.8 + Math.min(d, 60) / 120, 0.8, 1.3);
  navArrow.position.set(b.x + Math.sin(ang) * 4.6, 0.45 + Math.sin(S.clock * 4) * 0.08, b.z - Math.cos(ang) * 4.6); navArrow.rotation.y = -ang; navArrow.scale.setScalar(s * 0.95);
  navArrow.userData.mat.color.setHex(col);
}
function updateHUD() {
  const b = S.bike; $('#edge').classList.toggle('hidden', !(S.edge > 0.05 && S.mode !== 'endless')); $('#edge').style.opacity = String(0.35 + 0.65 * (S.edge || 0)); $('#speed').textContent = Math.round(Math.abs(b.speed) * 3.6); $('#speedo').style.setProperty('--p', clamp(Math.abs(b.speed) * 3.6 / 120, 0, 1).toFixed(3));
  const danger = clamp(Math.max(b.risk / 0.85, b.wobble), 0, 1); const rk = $('#risk'); rk.style.width = Math.round(danger * 100) + '%'; rk.style.background = danger > 0.7 ? 'var(--rose)' : danger > 0.4 ? 'var(--gold)' : 'var(--teal)';
  $('#p-level').textContent = 'Lv ' + levelOf(profile.points); $('#p-points').textContent = profile.points; $('#p-streak').textContent = profile.streak > 1 ? '🔥' + profile.streak : '';
  const dlv = S.mode === 'delivery', endl = S.mode === 'endless';
  $('#p-money').textContent = '💰' + Math.round(profile.money);
  const tank = tankSize(profile), pct = clamp(profile.fuel / tank, 0, 1); $('#fuel-bar').style.width = Math.round(pct * 100) + '%'; $('#fuel-bar').style.background = pct < 0.2 ? 'var(--rose)' : pct < 0.45 ? 'var(--gold)' : 'var(--teal)'; $('#fuel-l').textContent = profile.fuel.toFixed(1) + 'ل · ' + Math.round(rangeKm(profile.fuel, currentBike(profile).burn)) + 'كم';
  $('#fuelbox').classList.toggle('hidden', endl || S.mode === 'race'); $('#gps').classList.toggle('hidden', endl || S.mode === 'race' || !S.nearSt); $('#gps').classList.toggle('low', pct < 0.2);
  if (S.nearSt && !endl) { const st = S.nearSt.st; $('#gps-txt').textContent = 'أقرب محطة ' + Math.round(S.nearSt.d) + ' م'; aim($('#gps-arrow'), Math.atan2(st.px - b.x, -(st.pz - b.z)) - b.heading); }
  const gd = S.garage && !endl ? Math.hypot(b.x - S.garage.ex, b.z - S.garage.ez) : 1e9; $('#b-garage').classList.toggle('hidden', !(gd < 18 && Math.abs(b.speed) < 5));
  $('#b-wheelie').classList.toggle('hidden', !(endl || profile.settings.stunts !== false)); document.querySelector('.mapwrap').style.visibility = endl ? 'hidden' : 'visible';
  $('#offer').classList.toggle('min', !ui.oOpen); $('#offer').classList.toggle('flash', S.clock < (S.offerFlash || 0) && !ui.oOpen); $('#o-type').textContent = ui.oOpen ? '📋 الطلبات المتاحة (' + S.offers.length + ')' : '📋 ' + S.offers.length; updateOfferLive(); $('#mission').classList.toggle('min', !!S.mMin); $('#modecard').classList.toggle('min', !!ui.cMin);
  $('#o-tog').textContent = ui.oOpen ? '▴' : '▾'; for (const [id, on] of [['#m-tog', S.mMin], ['#mc-tog', ui.cMin]]) $(id).textContent = on ? '＋' : '—';
  $('#offer').classList.toggle('hidden', !dlv || !!S.mission || !S.offers.length); const m = dlv ? S.mission : null; $('#mission').classList.toggle('hidden', !m);
  const mcOn = (S.mode === 'patrol' && !!S.patrol && !!S.violator) || (endl && !!S.endless) || (S.mode === 'race' && !!S.race); $('#modecard').classList.toggle('hidden', !mcOn);
  if (S.mode === 'patrol' && S.patrol && S.violator) {
    const p = S.patrol, v = S.violator.a, rw = patrolReward(patrolLevel(), p.timeLeft);
    $('#mc-title').textContent = '👮 ' + p.name; $('#mc-reward').textContent = '+' + rw.money;
    $('#mc-line').textContent = p.stage === 'pullover' ? 'وقف جنبه وخليك ثابت 📋' : 'الحق المخالف!';
    $('#mc-sub').textContent = p.stage === 'pullover' ? 'فحص الأوراق… ماتتحركش' : 'قرّب منه (أقل من 9م) وخلّيه يوقف';
    $('#mc-a').textContent = '📍 ' + Math.round(p.dist) + ' م'; const tm = $('#mc-b'); tm.textContent = p.stage === 'pullover' ? '📋 ' + Math.min(3, p.check).toFixed(1) + '/3' : '⏱ ' + fmt(p.timeLeft); tm.classList.toggle('warn', p.stage === 'chase' && p.timeLeft < 15);
    $('#mc-bar').style.width = Math.round((p.stage === 'pullover' ? p.check / 3 : p.close / 2.2) * 100) + '%'; aim($('#mc-arrow'), Math.atan2(v.x - b.x, -(v.z - b.z)) - b.heading); $('#mc-arrow').style.visibility = 'visible';
  } else if (endl && S.endless) {
    const e = S.endless;
    $('#mc-title').textContent = '🏁 تحدي الطريق'; $('#mc-reward').textContent = e.combo > 1 ? '×' + e.combo : ''; $('#mc-line').textContent = 'النتيجة ' + Math.round(e.score) + ' · ' + '❤'.repeat(Math.max(0, HW.maxCrashes - e.crashes));
    $('#mc-sub').textContent = e.wheelie.on ? 'ويلي! ' + e.wheelie.t.toFixed(1) + 'ث — سيبه قبل 5 ثواني' : 'قرّب من العربيات بسرعة · ويلي (Q) بيجيب نقط'; $('#mc-a').textContent = '📍 ' + (e.dist / 1000).toFixed(2) + ' كم'; $('#mc-b').textContent = 'قرب ' + e.near; $('#mc-b').classList.remove('warn');
    $('#mc-bar').style.width = Math.round(clamp(e.wheelie.t / 5, 0, 1) * 100) + '%'; $('#mc-arrow').style.visibility = 'hidden';
  }
  if (S.mode === 'race' && S.race) raceHUD(b);
  if (m) {
    const pick = m.stage === 'pickup', tgt = pick ? m.pickup : m.dropoff;
    { const L = LOADS[m.load] || LOADS.parcel; $('#m-type').textContent = L.glyph + ' ' + (pick ? L.pick : L.drop); } $('#m-reward').textContent = '+' + m.reward;
    $('#m-target').textContent = tgt.name; $('#m-hint').textContent = S.clock - S.slowAt < 0.6 ? 'هدّي السرعة عشان تكمّل 🛑' : m.hold > 0.02 ? 'ثبّت لحظة… ' + Math.round((m.hold / HOLD_TIME) * 100) + '%' : (pick ? 'روح لنقطة الاستلام' : (LOADS[m.load] || LOADS.parcel).hint);
    $('#m-dist').textContent = '📍 ' + Math.round(m.distToTarget) + ' م'; const tm = $('#m-time'); tm.textContent = '⏱ ' + fmt(m.timeLeft); tm.classList.toggle('warn', m.timeLeft < 15);
    const q = Math.round(m.quality); $('#m-quality').style.width = q + '%'; $('#m-qlabel').textContent = ({ med: 'سلامة الدوا ', food: 'حرارة الأكل ', parcel: 'سلامة الطرد ', person: 'راحة الراكب ' }[m.load] || 'الجودة ') + q + '%';
    const rel = Math.atan2(tgt.x - b.x, -(tgt.z - b.z)) - b.heading; aim($('#m-arrow'), rel); $('#m-arrow').classList.toggle('drop', !pick); $('#m-dir').textContent = dirText(rel, m.distToTarget);
  }
  if (S.online) $('#peercount').textContent = '👥 ' + (net.count + 1);
  micUI(); if (S.lbOpen) renderLB();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  if (S.lite) { liteFrame(dt); return; }
  if (S.autoQ && S.state === 'playing' && !S.paused) S.autoQ.tick(raw);
  if (S.world) {
    if (S.state === 'playing' && !S.paused) { update(dt); S.hudT += dt; S.mmT += dt; if (S.hudT > 0.1) { S.hudT = 0; updateHUD(); } if (S.mmT > 0.05) { S.mmT = 0; drawMinimap(); drawOrders(S); } }
    updateVisuals(dt);
    renderer.render(scene, camera);
  } else renderer.render(scene, camera);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {}); // تثبيت على الشاشة الرئيسية + كاش
// ───────── المجسمات: رسائل خطأ واضحة + دعم KTX2 ─────────
setGLBRenderer(renderer); setGLBErrorHandler((slot, msg) => toast('⚠️ مجسّم «' + slot + '» ما اتحمّلش: ' + msg, 'bad', 9000));
$('#b-cam').addEventListener('pointerdown', (e) => { e.preventDefault(); cycleCam(); }); $('#b-cam').dataset.mode = S.camMode;
// ───────── إعلان القائمة الرئيسية (خارج اللعب) ─────────
function refreshContact() { const b = $('#btn-wa'); if (!b) return; const l = waLink(S.content && S.content.contact); b.classList.toggle('hidden', !l); if (l) b.href = l; }
function refreshMenuAd() { const el = $('#ad-menu'); if (el) { el.innerHTML = ads.html('menu'); ads.scan(el); } refreshContact(); }
refreshMenuAd();
loadContent().then((ct) => { if (!S.content || !(S.content.ads || []).length) { S.content = ct.content; S.contentBase = ct.base; S.contentFrom = ct.from; } refreshMenuAd(); }).catch(() => refreshMenuAd());
ads.start();
window.__orider = { getMe: () => me, reloadContent: () => loadContent(), S, profile, net, voice, scene, camera, applyQuality, openMyGarage, startEngine, hitSolid, driveAt }; // للتجارب من الكونسول
