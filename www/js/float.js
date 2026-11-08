// أيقونات عائمة قابلة للسحب: بتتحرك لأي مكان، بتفتكر مكانها، وبتخفّ لما محدش بيستخدمها.
// الموضع بيتخزن كنسبة من المساحة الحرة (0..1) فيفضل صح مع تدوير الشاشة وتغيير الحجم.
const KEY = 'orider-float-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

// نقي (للاختبار): نسبة → بكسل داخل الشاشة مع هامش
export function toPixels(f, size, view, margin = 6) {
  const free = (n, s) => Math.max(0, n - s - margin * 2);
  return { left: margin + clamp01(f.x) * free(view.w, size.w), top: margin + clamp01(f.y) * free(view.h, size.h) };
}
// نقي: بكسل → نسبة
export function toFraction(px, size, view, margin = 6) {
  const free = (n, s) => Math.max(1, n - s - margin * 2);
  return { x: clamp01((px.left - margin) / free(view.w, size.w)), y: clamp01((px.top - margin) / free(view.h, size.h)) };
}
// نقي: مكان اللوحة المفتوحة جنب الأيقونة (تحت لو فيه مكان وإلا فوق، وأفقيًا في حدود الشاشة)
export function placePanelBox(btn, panel, view, gap = 8, margin = 6) {
  const below = view.h - (btn.top + btn.h) - gap - margin >= panel.h, above = btn.top - gap - margin >= panel.h;
  let top = below || !above ? btn.top + btn.h + gap : btn.top - gap - panel.h;
  top = Math.max(margin, Math.min(view.h - panel.h - margin, top));
  let left = btn.left + btn.w / 2 - panel.w / 2; left = Math.max(margin, Math.min(view.w - panel.w - margin, left));
  return { left, top };
}

export function makeFloating(el, key, opts = {}) {
  const { def = { x: 0.02, y: 0.5 }, onTap = null, idleMs = 3500 } = opts;
  el.classList.add('floaty'); el.style.position = 'fixed'; el.style.right = 'auto'; el.style.bottom = 'auto';
  let f = (load()[key]) || def, drag = null, idleT = 0;
  const view = () => ({ w: window.innerWidth, h: window.innerHeight });
  const size = () => { const r = el.getBoundingClientRect(); return { w: r.width || 46, h: r.height || 46 }; };
  const apply = () => { const p = toPixels(f, size(), view()); el.style.left = p.left + 'px'; el.style.top = p.top + 'px'; };
  const wake = () => { el.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => el.classList.add('idle'), idleMs); };
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button > 0) return;
    const r = el.getBoundingClientRect(); drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }; wake();
    try { el.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return; drag.moved = true; el.classList.add('dragging');
    f = toFraction({ left: drag.ox + dx, top: drag.oy + dy }, size(), view()); apply(); el.dispatchEvent(new CustomEvent('floatmove'));
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return; const moved = drag.moved; drag = null; el.classList.remove('dragging'); wake();
    if (moved) { const s = load(); s[key] = f; save(s); } else if (e && e.type === 'pointerup' && onTap) onTap(e);
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { apply(); el.dispatchEvent(new CustomEvent('floatmove')); });
  apply(); wake();
  return { apply, wake, reset() { f = def; const s = load(); delete s[key]; save(s); apply(); } };
}

// بيحط لوحة (panel) جنب أيقونة عائمة ويفضّلها ماشية معاها لو اتسحبت
export function anchorPanel(panel, btn) {
  const go = () => {
    if (panel.classList.contains('hidden')) return;
    const b = btn.getBoundingClientRect(), p = panel.getBoundingClientRect();
    const pos = placePanelBox({ left: b.left, top: b.top, w: b.width, h: b.height }, { w: p.width, h: p.height }, { w: window.innerWidth, h: window.innerHeight });
    panel.style.left = pos.left + 'px'; panel.style.top = pos.top + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
  };
  btn.addEventListener('floatmove', go); window.addEventListener('resize', go); return go;
}
