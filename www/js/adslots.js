// مساحات إعلانية «خارج اللعب»: شاشة التحميل · القائمة الرئيسية · قائمة الإيقاف · شاشات النهاية.
// ممنوع تظهر أثناء القيادة: العناصر دي موجودة بس في شاشات متوقفة. الإعلانات بتيجي من لوحة الإدارة (نوع «خارج اللعب»).
// content.adSlots = { on:true, house:true, rotateMs:7000, slots:{ loading:{on:true}, menu:{on:true}, pause:{on:true}, end:{on:true} } }
// content.adContact = نص بيظهر في المساحة الفاضية · content.adEndpoint = رابط اختياري بيستقبل أحداث الظهور/الضغط (POST JSON)
import { cropRect } from './imgfit.js';
import { waLink } from './contact.js';
export const SLOT_NAMES = { loading: 'شاشة التحميل', menu: 'القائمة الرئيسية', pause: 'قائمة الإيقاف', end: 'شاشات النهاية' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okImg = (u) => /^(https?:|data:image\/|blob:)|^[\w./-]+$/i.test(String(u || ''));
const okLink = (u) => /^https?:\/\//i.test(String(u || ''));
const live = (a) => { const now = Date.now(); return a && a.active !== false && a.image && (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() >= now); };

export function createAdSlots(getContent, base = () => '') {
  const cfg = () => { const c = (getContent() || {}).adSlots || {}; return { on: c.on !== false, house: c.house !== false, rotateMs: Math.max(3000, c.rotateMs || 7000), slots: c.slots || {} }; };
  const slotOn = (slot) => { const c = cfg(); return c.on && (c.slots[slot] ? c.slots[slot].on !== false : true); };
  const ads = (slot) => ((getContent() || {}).ads || []).filter((a) => a && a.type === 'screen' && live(a) && okImg(a.image) && (!Array.isArray(a.slots) || a.slots.includes(slot)));
  const idx = {}; // رقم الإعلان الحالي لكل مساحة
  const beacon = (ev, a, slot) => { try { const ep = (getContent() || {}).adEndpoint; if (ep && okLink(ep) && navigator.sendBeacon) navigator.sendBeacon(ep, JSON.stringify({ ev, id: a.id || '', slot, t: Date.now() })); } catch (e) { /* ignore */ } };
  const inner = (slot, i) => {
    const list = ads(slot), c = cfg();
    if (list.length) {
      const a = list[((i % list.length) + list.length) % list.length], u = /^(https?:|data:|blob:)/.test(a.image) ? a.image : base() + a.image, cr = a.crop ? cropRect(1000, 312, 3.2, a.crop) : null;
      const x = cr ? Math.round(clampNum(a.crop.cx, 0.5) * 100) : 50, y = cr ? Math.round(clampNum(a.crop.cy, 0.5) * 100) : 50, z = cr ? Math.max(1, +a.crop.zoom || 1) : 1;
      const img = `<img src="${esc(u)}" alt="${esc(a.title || 'إعلان')}" loading="lazy" draggable="false" style="object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%">`;
      return { html: okLink(a.link) ? `<a class="adbox" href="${esc(a.link)}" target="_blank" rel="noopener sponsored" data-ad="${esc(a.id || '')}">${img}<span class="adtag">إعلان</span></a>` : `<div class="adbox" data-ad="${esc(a.id || '')}">${img}<span class="adtag">إعلان</span></div>`, ad: a };
    }
    if (!c.house) return { html: '', ad: null };
    const contact = (getContent() || {}).adContact || 'للإعلان في اللعبة تواصل مع الإدارة';
    const wa = waLink((getContent() || {}).contact, 'مرحبًا، عايز أعلن في لعبة كوكب الجحود أكتوبر'); // رقم واتساب المطوّر من إعدادات الإدارة
    if (wa) return { html: `<a class="adbox house" href="${esc(wa)}" target="_blank" rel="noopener"><b>📢 مساحة إعلانية — اعلن معانا</b><small>${esc(contact)} · 💬 واتساب</small></a>`, ad: null };
    return { html: `<div class="adbox house"><b>📢 مساحة إعلانية</b><small>${esc(contact)}</small></div>`, ad: null };
  };
  const clampNum = (v, d) => (Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : d);
  return {
    slotOn,
    // HTML المساحة (بتتحط جوه أي شاشة متوقفة)
    html(slot) { if (!slotOn(slot)) return ''; const r = inner(slot, idx[slot] || 0); return r.html ? `<div class="adslot" data-slot="${slot}">${r.html}</div>` : ''; },
    // تدوير الإعلانات المعروضة حاليًا + تتبع الظهور والضغط
    scan(root = document) {
      root.querySelectorAll('.adslot[data-slot]').forEach((el) => {
        const slot = el.dataset.slot; if (el._ads) return; el._ads = true;
        const first = el.querySelector('[data-ad]'); if (first && first.dataset.ad) beacon('view', { id: first.dataset.ad }, slot);
        el.addEventListener('click', (e) => { const a = e.target.closest('a[data-ad]'); if (a) beacon('click', { id: a.dataset.ad }, slot); });
      });
    },
    rotate() {
      const c = cfg(); if (!c.on) return;
      document.querySelectorAll('.adslot[data-slot]').forEach((el) => {
        if (el.offsetParent === null) return; const slot = el.dataset.slot, list = ads(slot); if (list.length < 2) return;
        idx[slot] = (idx[slot] || 0) + 1; const r = inner(slot, idx[slot]); el.innerHTML = r.html; if (r.ad) beacon('view', r.ad, slot);
      });
    },
    start() { clearInterval(this._t); this._t = setInterval(() => this.rotate(), cfg().rotateMs); },
    stop() { clearInterval(this._t); },
  };
}
