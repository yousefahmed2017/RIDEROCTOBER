// إضافات الجولة 3 (وحدة مستقلة): تقييد الطلبات داخل الحدود، عرض الطلبات على الخريطة المصغرة،
// لوحة تحكم سريعة، تحكم الويلي، إخفاء الصندوق، ومشغّل الموسيقى.
import { serverBase } from './content.js';
import { makeFloating, anchorPanel } from './float.js';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────── 1) الطلبات جوه الحدود بس ─────────
export function confineWorld(data, roads, half, margin = 130) {
  const lim = half - margin, inside = (x, z) => Math.abs(x) < lim && Math.abs(z) < lim;
  if (data && Array.isArray(data.pois)) data.pois = data.pois.filter((p) => inside(p.x, p.z));
  if (roads && !roads.__confined) {
    const rp = roads.randomPoint.bind(roads); roads.__confined = true;
    roads.randomPoint = (...a) => { let q = rp(...a); for (let i = 0; i < 40 && q && !inside(q.x, q.z); i++) q = rp(...a); return q; };
  }
}

// ───────── 2) الطلبات على الخريطة المصغرة ─────────
export function createOrdersOverlay() {
  const wrap = $('#mapwrap') || document.querySelector('.mapwrap'); if (!wrap) return () => {};
  const c = document.createElement('canvas'); c.width = c.height = 320; c.id = 'mm-orders'; c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:50%'; wrap.appendChild(c);
  const g = c.getContext('2d'), W = 320, R = 160, view = 230, k = R / view;
  return function draw(S) {
    g.clearRect(0, 0, W, W); if (S.state !== 'playing' || S.mode !== 'delivery') return;
    const b = S.bike, h = b.heading, ch = Math.cos(h), sh = Math.sin(h), t = performance.now() / 1000;
    const pin = (p, col, glyph, label, dim) => {
      const dx = p.x - b.x, dz = p.z - b.z; let sx = k * (dx * ch + dz * sh), sy = k * (-dx * sh + dz * ch); const d = Math.hypot(sx, sy), lim = R - 17, out = d > lim, dist = Math.round(Math.hypot(dx, dz));
      if (out) { sx *= lim / d; sy *= lim / d; } const X = R + sx, Y = R + sy;
      g.save(); g.globalAlpha = dim ? 0.65 : 1; g.translate(X, Y);
      if (out) { g.save(); g.rotate(Math.atan2(sy, sx) + Math.PI / 2); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -17); g.lineTo(9, -6); g.lineTo(-9, -6); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      const pulse = dim ? 0 : 1.5 * Math.sin(t * 4); g.beginPath(); g.arc(0, 0, 11 + pulse, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; if (dim) g.setLineDash([4, 3]); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff'; g.font = '700 13px Cairo, Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, 0, 1);
      if (label) { g.font = '800 12px Cairo, Tahoma, Arial'; g.lineWidth = 4; g.strokeStyle = 'rgba(8,16,30,.95)'; const ly = Y < R ? 22 : -22; g.strokeText(label, 0, ly); g.fillStyle = '#fff'; g.fillText(label, 0, ly); }
      g.restore();
    };
    const m = S.mission, o = S.offer;
    if (m) { // الطلب الشغّال: المرحلة الحالية بقوة، والتانية خافتة
      if (m.stage === 'dropoff') pin(m.dropoff, '#19c2a0', '🏁', 'تسليم', false); else { pin(m.pickup, '#ff7a1a', '📦', 'استلام', false); pin(m.dropoff, '#19c2a0', '🏁', '', true); }
    } else {
      for (const q of S.offers || []) if (q !== o) pin(q.pickup, '#ff7a1a', '📦', '', true);
      if (o) { pin(o.pickup, '#ff7a1a', '📦', 'طلب', false); pin(o.dropoff, '#19c2a0', '🏁', '', true); }
    }
  };
}

// ───────── 3) الويلي في كل الأوضاع: لو طوّلت بتفقد الاتزان ─────────
export function stuntTick(S, dt, throttle, onFall) {
  const b = S.bike, on = S.wheelie && b.speed > 12 && throttle && S.mode !== 'endless';
  S.wTime = on ? (S.wTime || 0) + dt : Math.max(0, (S.wTime || 0) - dt * 2);
  if (S.wTime > 7) { S.wTime = 0; S.wheelie = false; b.speed *= 0.45; onFall && onFall(); }
}

// ───────── 4) إخفاء/إظهار الصندوق ─────────
export function setCargo(bike, visible) { if (!bike) return; if (bike.setBoxVisible) return bike.setBoxVisible(visible); const c = bike.group && bike.group.getObjectByName('cargo'); if (c && c.visible !== visible) c.visible = visible; }

// ───────── 5) لوحة تحكم سريعة ─────────
export function createQuickPanel({ get, toggleGas, cycleAssist, toggleBox, toggleStunts, toggleFx, labels }) {
  const btn = document.createElement('button'); btn.id = 'qc-btn'; btn.className = 'round'; btn.title = 'تحكم سريع (اسحبه لأي مكان)'; btn.textContent = '🎛️';
  const pan = document.createElement('div'); pan.id = 'qc'; pan.className = 'hidden';
  document.body.appendChild(btn); document.body.appendChild(pan);
  const place = anchorPanel(pan, btn);
  makeFloating(btn, 'qc', { def: { x: 0.99, y: 0.42 }, onTap: () => { pan.classList.toggle('hidden'); draw(); place(); } }); // أيقونة عائمة: اسحبها لمكان بعيد عن الشاشة
  const draw = () => { const s = get(); pan.innerHTML = `<b>🎛️ تحكم سريع</b>
    <button data-a="gas">⛽ البنزين: <u>${s.autoGas ? 'تلقائي' : 'يدوي'}</u></button>
    <button data-a="as">🧭 مساعد القيادة: <u>${labels[s.assist] || s.assist}</u></button>
    <button data-a="box">📦 الصندوق: <u>${s.hideBox ? 'مخفي' : 'ظاهر'}</u></button>
    <button data-a="st">🏍️ زر الويلي: <u>${s.stunts ? 'ظاهر' : 'مخفي'}</u></button>
    <button data-a="fx">✨ المؤثرات: <u>${s.fx === 'low' ? 'خفيفة (موبايل ضعيف)' : 'كاملة'}</u></button><small>ويلي: اضغط مطوّلًا على 🏍️↑ أو Q / Shift بسرعة +12. أكتر من 7 ثواني بتفقد الاتزان.</small>`; };
  pan.onclick = (e) => { const a = e.target.closest('button')?.dataset.a; if (!a) return; ({ gas: toggleGas, as: cycleAssist, box: toggleBox, st: toggleStunts, fx: toggleFx })[a](); draw(); place(); };
  return { show: (v) => { btn.classList.toggle('hidden', !v); if (!v) pan.classList.add('hidden'); } };
}

// ───────── 6) مشغّل الموسيقى ─────────
const AUD = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm|weba)$/i;
export function createMusic({ getPhase, isAdmin = () => false, onAdminFiles = null }) {
  const bar = document.createElement('div'); bar.id = 'musicbar';
  bar.innerHTML = '<button id="mu-mute" title="كتم / تشغيل">🔊</button><span id="mu-title">🎵 —</span><button id="mu-next" title="الأغنية التالية">⏭</button><button id="mu-pick" title="اختار ملفات موسيقى من جهازك">📂</button><button id="mu-up" title="للإدارة: ارفع أغاني بتشتغل عند كل اللاعبين" hidden>📤</button><input id="mu-files" type="file" accept="audio/*" multiple hidden><input id="mu-adm" type="file" accept="audio/*,.mp3,.ogg,.m4a,.wav" multiple hidden>';
  document.body.appendChild(bar);
  const au = new Audio(); au.preload = 'auto'; au.volume = 0.45;
  const lists = { menu: [], game: [] }, fileL = { menu: [], game: [] }, cfgL = { menu: [], game: [] }; const merge = () => { lists.menu = cfgL.menu.concat(fileL.menu); lists.game = cfgL.game.concat(fileL.game); };
   let phase = '', last = '', muted = false, started = false, local = null;
  try { muted = localStorage.getItem('orider-music-muted') === '1'; } catch (e) { /* ignore */ }
  const nice = (u) => decodeURIComponent(u.split('/').pop().replace(AUD, '')).replace(/[_-]+/g, ' ');
  const pool = () => { const L = local && local.length ? local : (lists[phase] && lists[phase].length ? lists[phase] : lists.game); return L || []; };
  function next(force) {
    const L = pool(); if (!L.length) { $('#mu-title').textContent = '🎵 ضيف أغاني (📂 أو فولدر music)'; return; }
    let t = L[Math.floor(Math.random() * L.length)]; for (let i = 0; i < 5 && L.length > 1 && t.url === last; i++) t = L[Math.floor(Math.random() * L.length)];
    last = t.url; au.src = t.url; $('#mu-title').textContent = '🎵 ' + t.name; if (!muted || force) au.play().catch(() => {});
  }
  au.addEventListener('ended', () => next()); au.addEventListener('error', () => setTimeout(() => next(), 300));
  const kick = () => { if (started) return; started = true; if (!muted) next(); }; // المتصفح بيمنع التشغيل قبل أول لمسة
  addEventListener('pointerdown', kick, { once: true }); addEventListener('keydown', kick, { once: true });
  $('#mu-mute').onclick = () => { muted = !muted; try { localStorage.setItem('orider-music-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ } if (muted) au.pause(); else if (au.src) au.play().catch(() => {}); else next(); sync(); };
  $('#mu-next').onclick = () => { started = true; next(true); if (muted) { muted = false; sync(); } };
  $('#mu-pick').onclick = () => $('#mu-files').click();
  $('#mu-files').onchange = (e) => { const fs = [...e.target.files].filter((f) => f.type.startsWith('audio/') || AUD.test(f.name)); if (!fs.length) return; local = fs.map((f) => ({ url: URL.createObjectURL(f), name: nice(f.name) })); started = true; muted = false; sync(); next(true); };
  $('#mu-up').onclick = () => $('#mu-adm').click();
  $('#mu-adm').onchange = (e) => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length && onAdminFiles) onAdminFiles(fs); };
  const sync = () => { $('#mu-mute').textContent = muted ? '🔇' : '🔊'; };
  sync();
  // قايمة التراكات: music/playlist.json (من السيرفر أو من npm run music)
  (async () => {
    try {
      const base = serverBase(); const r = await fetch(base + '/music/playlist.json', { cache: 'no-cache' }).catch(() => fetch('music/playlist.json', { cache: 'no-cache' })); if (!r.ok) throw 0;
      const j = await r.json(), mk = (a) => (a || []).filter((u) => AUD.test(u)).map((u) => ({ url: /^https?:|^blob:|^data:/.test(u) ? u : (base || '') + '/' + u.replace(/^\//, ''), name: nice(u) }));
      fileL.menu = mk(j.menu); fileL.game = mk(j.game); merge(); if (started && !au.src && !muted) next();
    } catch (e) { /* مفيش فولدر موسيقى — الزر 📂 متاح */ }
  })();
  return { // أغاني الإدارة (للكل) + معاينة
    setTracks(m, base = '') { const L = (m && Array.isArray(m.tracks) ? m.tracks : []).filter((t) => t && t.url).map((t) => ({ url: /^https?:|^blob:|^data:/.test(t.url) ? t.url : (base || serverBase() || '') + t.url, name: t.name || nice(t.url), where: t.where })); cfgL.menu = L.filter((t) => t.where !== 'game'); cfgL.game = L.filter((t) => t.where !== 'menu'); merge(); if (started && !au.src && !muted) next(); },
    preview(t) { started = true; au.src = /^https?:|^blob:|^data:/.test(t.url) ? t.url : (serverBase() || '') + t.url; $('#mu-title').textContent = '🎵 ' + t.name; au.play().catch(() => {}); },
    setVolume(v) { au.volume = Math.max(0, Math.min(1, 0.45 * v)); }, tick() { const up = $('#mu-up'); if (up) up.hidden = !isAdmin(); const p = getPhase(); if (p !== phase) { phase = p; if (started && !local && !muted && (lists[p] || []).length) next(); } } };
}

// ───────── 8) تحسين شكل البانرات واللوحات (إطار + قص الصورة بدل التمطيط + إلغاء الضباب) ─────────
let portrait = null;
function portraitAd(i) {
  const pal = [['#ff7a1a', '#ffb347'], ['#19c2a0', '#0b6e8a'], ['#5aa9ff', '#3a4bd6'], ['#ff4d6d', '#b0182d']][i % 4], c = document.createElement('canvas'); c.width = 256; c.height = 672; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 672); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, 256, 672);
  g.fillStyle = 'rgba(255,255,255,.14)'; for (let k = 0; k < 6; k++) g.fillRect(0, k * 130 - 30, 256, 44);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 64px Cairo, Tahoma, Arial'; g.fillText('أعلن', 128, 250); g.fillText('هنا', 128, 330); g.font = '700 28px Cairo, Tahoma, Arial'; g.fillText('مساحة إعلانية', 128, 440); g.fillText('في أكتوبر', 128, 482);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6; g.strokeRect(14, 14, 228, 644);
  return c;
}
export function polishSigns(THREE, group) {
  let n = 0;
  group.traverse((o) => {
    if (!o.isMesh || o.userData.polished || !o.geometry || o.geometry.type !== 'PlaneGeometry' || !o.material || !o.material.isMeshBasicMaterial || !o.material.map) return;
    const gp = o.geometry.parameters, w = gp.width, h = gp.height, mat = o.material, map = mat.map, img = map.image;
    if (!img || (!img.width && !img.naturalWidth)) return; // لسه بيتحمّل
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight; o.userData.polished = true; n++;
    mat.fog = false; mat.needsUpdate = true; map.anisotropy = 8;
    if (h / w > 1.6 && iw > ih && img instanceof HTMLCanvasElement) { portrait = portraitAd(Math.floor(o.parent.position.x + o.parent.position.z)); const t = map.constructor === THREE.CanvasTexture ? new THREE.CanvasTexture(portrait) : map; t.colorSpace = THREE.SRGBColorSpace; mat.map = t; return frame(o, w, h); } // بانر رأسي بصورة أفقية → نبدّلها بتصميم رأسي
    if (!(img instanceof HTMLCanvasElement) || iw / ih !== w / h) { // قص بدل تمطيط (cover)
      const ia = iw / ih, fa = w / h; map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; if (!map.userData.fit) { map.userData.fit = 1; if (ia > fa) { map.repeat.set(fa / ia, 1); map.offset.set((1 - fa / ia) / 2, 0); } else { map.repeat.set(1, ia / fa); map.offset.set(0, (1 - ia / fa) / 2); } map.needsUpdate = true; }
    }
    frame(o, w, h);
  });
  function frame(o, w, h) {
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.55, metalness: 0.5 }), t = 0.09;
    for (const [bw, bh, x, y] of [[w + t * 2, t, 0, h / 2 + t / 2], [w + t * 2, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.1), dark); m.position.set(x, y, -0.02); o.add(m); }
    if (o.material.side !== THREE.DoubleSide) o.material.side = THREE.FrontSide;
  }
  return n;
}
