// أجزاء لوحة الإدارة الجديدة: التواصل (واتساب) · مساحات الإعلانات خارج اللعب · مراجعة تعديلات الموظفين · الموظفين والأقسام.
import { normalizeWhatsApp, waLink, DEFAULT_WA_MSG } from './contact.js';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SLOT_LABELS = [['loading', 'شاشة التحميل'], ['menu', 'القائمة الرئيسية'], ['pause', 'قائمة الإيقاف'], ['end', 'شاشات النهاية']];
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'دلوقتي' : m < 60 ? 'من ' + m + ' د' : m < 1440 ? 'من ' + Math.round(m / 60) + ' س' : 'من ' + Math.round(m / 1440) + ' يوم'; };

// ───── التواصل: رقم واتساب المطوّر (بيتغيّر من هنا في أي وقت) ─────
export function contactView(cfg) {
  const c = cfg.contact || { whatsapp: '', message: '' }, n = normalizeWhatsApp(c.whatsapp), link = waLink(c); // العرض ما بيعدّلش cfg (عشان ما يتحسبش تعديل)
  return `<div class="ad-tools ct-box"><h3>📞 تواصل واتساب بالمطوّر</h3>
    <p class="muted">الرقم ده بيظهر للاعبين في القائمة وفي مساحة «اعلن معانا». تقدر تغيّره في أي وقت من هنا من غير ما تعدّل الكود.</p>
    <label class="fld">رقم واتساب (أي صيغة: 01012345678 أو +201012345678)<input data-ct="whatsapp" dir="ltr" inputmode="tel" value="${esc(c.whatsapp)}" placeholder="مثال: 01012345678"></label>
    <div class="ct-state">${c.whatsapp ? (n ? `✅ هيتحفظ كـ <b dir="ltr">+${n}</b>` : '⚠️ الرقم مش صالح (لازم 8–15 رقم)') : 'مفيش رقم — زر واتساب مخفي عند اللاعبين'}</div>
    <label class="fld">الرسالة الجاهزة (اختياري)<input data-ct="message" maxlength="200" value="${esc(c.message)}" placeholder="${esc(DEFAULT_WA_MSG)}"></label>
    ${link ? `<a class="btn mini" href="${esc(link)}" target="_blank" rel="noopener">🔗 جرّب الرابط</a>` : ''}
    <button class="btn primary" data-ct-save="1">💾 حفظ</button></div>`;
}
// ───── مساحات الإعلانات خارج اللعب (إعدادات عامة) ─────
export function adSlotsView(cfg) {
  const s = { on: true, house: true, rotateMs: 7000, ...(cfg.adSlots || {}) }; s.slots = s.slots || {}; // نسخة للعرض بس
  const sw = (k, label, on) => `<label class="msg-sw"><input type="checkbox" data-asl="${k}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
  return `<details class="adv asl"><summary>📺 مساحات الإعلانات خارج اللعب (تحميل · قائمة · إيقاف · نهاية)</summary>
    <p class="muted">ضيف إعلان بنوع «📺 خارج اللعب» (نسبة 3.2:1). المساحات دي ما بتظهرش أبدًا أثناء القيادة.</p>
    <div class="row">${sw('on', 'تشغيل كل المساحات', s.on !== false)}${sw('house', 'اعرض «مساحة إعلانية» لو مفيش إعلان', s.house !== false)}</div>
    <div class="row">${SLOT_LABELS.map(([k, l]) => sw('slot:' + k, l, !(s.slots[k] && s.slots[k].on === false))).join('')}</div>
    <div class="row"><label class="grow">سرعة تبديل الإعلانات (ثانية)<input data-asl="rotate" type="number" min="3" max="60" value="${Math.round((s.rotateMs || 7000) / 1000)}"></label><label class="grow">نص التواصل في المساحة الفاضية<input data-asl="contact" maxlength="120" value="${esc(cfg.adContact || '')}" placeholder="للإعلان في اللعبة تواصل مع الإدارة"></label></div>
    <label class="fld">رابط تتبع الظهور/الضغط (اختياري، https)<input data-asl="endpoint" dir="ltr" value="${esc(cfg.adEndpoint || '')}" placeholder="https://…"></label></details>`;
}
export function extraInput(e, cfg) {
  const el = e.target, d = el.dataset || {};
  if (d.ct) { // التحديث في مكانه من غير إعادة رسم (إعادة الرسم كانت بتضيّع ضغطة زر الحفظ)
    const c = (cfg.contact ||= {}); c[d.ct] = el.value; const box = el.closest('.ct-box'), st = box && box.querySelector('.ct-state'), n = normalizeWhatsApp(c.whatsapp);
    if (st) st.innerHTML = c.whatsapp ? (n ? `✅ هيتحفظ كـ <b dir="ltr">+${n}</b>` : '⚠️ الرقم مش صالح (لازم 8–15 رقم)') : 'مفيش رقم — زر واتساب مخفي عند اللاعبين';
    const a = box && box.querySelector('a.btn'); if (a) { const l = waLink(c); if (l) a.href = l; }
    return true;
  }
  if (d.asl) {
    const s = (cfg.adSlots ||= { on: true, house: true, rotateMs: 7000, slots: {} }); s.slots ||= {};
    if (d.asl === 'on' || d.asl === 'house') s[d.asl] = el.checked; else if (d.asl.startsWith('slot:')) { const k = d.asl.slice(5); if (el.checked) delete s.slots[k]; else s.slots[k] = { on: false }; }
    else if (d.asl === 'rotate') s.rotateMs = Math.max(3, Math.min(60, +el.value || 7)) * 1000; else if (d.asl === 'contact') cfg.adContact = el.value; else if (d.asl === 'endpoint') cfg.adEndpoint = el.value.trim();
    return true;
  }
  return false;
}
// ───── مراجعة تعديلات الموظفين (المدير) ─────
export function reviewView(st) {
  const f = st.filter || 'pending', tabs = [['pending', '⏳ مستنية'], ['approved', '✅ معتمدة'], ['edited', '✏️ معدّلة'], ['rejected', '❌ مرفوضة']];
  const cards = st.list.map((p) => `<div class="rv-card ${p.status}"><div class="rv-h"><b>${esc(p.deptName || p.dept)}</b><span class="muted">${esc(p.byName)} · ${ago(p.at)}</span></div>
    ${p.note ? `<div class="rv-note">“${esc(p.note)}”</div>` : ''}<div class="muted rv-sum">${esc(p.summary)}</div>
    ${p.status === 'pending' ? `<div class="rv-act"><button class="btn mini primary" data-rv="approve" data-id="${p.id}">✅ اعتماد ونشر</button><button class="btn mini" data-rv="edit" data-id="${p.id}">✏️ عدّل قبل النشر</button><button class="btn mini danger" data-rv="reject" data-id="${p.id}">❌ رفض</button></div>` : `<div class="muted">${p.status === 'approved' ? '✅ اتعتمد' : p.status === 'edited' ? '✏️ اتعدّل واتنشر' : '❌ اترفض'} بواسطة ${esc(p.reviewedBy || '')}${p.reviewNote ? ' — ' + esc(p.reviewNote) : ''}</div>`}</div>`).join('');
  return `<div class="ad-tools"><div class="ad-flt">${tabs.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-rv="filter" data-id="${k}">${l}</button>`).join('')}</div>
    <p class="muted">تعديلات الموظفين مش بتظهر للاعبين غير بعد اعتمادك. «عدّل قبل النشر» بيحمّل تعديلاتهم في اللوحة وإنت بتعدّل وتحفظ بنفسك.</p>${cards || '<div class="empty">مفيش طلبات هنا</div>'}</div>`;
}
// ───── الموظفين والأقسام (المدير) ─────
export function staffView(st) {
  const e = st.edit, dn = st.depts || {};
  const form = e ? `<div class="sf-form"><h4>${e.id ? 'تعديل موظف' : 'موظف جديد'}</h4>
    <div class="row"><label class="grow">الاسم<input data-sfi="name" maxlength="40" value="${esc(e.name || '')}"></label><label class="grow">اسم المستخدم (إنجليزي)<input data-sfi="username" dir="ltr" maxlength="24" value="${esc(e.username || '')}"></label></div>
    <label class="fld">${e.id ? 'كلمة سر جديدة (سيبها فاضية لو مش هتغيّرها)' : 'كلمة السر (6 حروف على الأقل)'}<input data-sfi="password" type="text" dir="ltr" autocomplete="off" value="${esc(e.password || '')}"></label>
    <div class="sf-depts">${Object.entries(dn).map(([k, l]) => `<label class="msg-sw"><input type="checkbox" data-sfd="${k}" ${(e.depts || []).includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
    <label class="msg-sw"><input type="checkbox" data-sfi="active" ${e.active !== false ? 'checked' : ''}><span>الحساب شغال</span></label>
    <div class="row"><button class="btn primary" data-sf="save">💾 حفظ الموظف</button><button class="btn" data-sf="cancel">إلغاء</button></div></div>` : '';
  const rows = st.list.map((u) => `<div class="sf-row ${u.active ? '' : 'off'}"><div><b>${esc(u.name)}</b> <span class="muted" dir="ltr">@${esc(u.username)}</span>${u.active ? '' : ' <span class="tag off">موقوف</span>'}<div class="muted">${u.depts.map((d) => esc(dn[d] || d)).join(' · ')}</div></div><div class="rv-act"><button class="btn mini" data-sf="edit" data-id="${u.id}">✏️</button><button class="btn mini danger" data-sf="del" data-id="${u.id}">🗑️</button></div></div>`).join('');
  const audit = (st.audit || []).slice(0, 30).map((a) => `<li><span class="muted">${ago(a.at)}</span> ${esc(a.who)} — ${esc(a.action)} ${esc(a.target || '')}</li>`).join('');
  return `<div class="ad-tools"><button class="btn primary" data-sf="new">＋ موظف جديد</button>${form}${rows || '<div class="empty">مفيش موظفين — ضيف موظف متخصص لكل قسم</div>'}
    <details class="adv"><summary>🧾 سجل العمليات (آخر 30)</summary><ul class="audit">${audit || '<li class="muted">فاضي</li>'}</ul></details></div>`;
}
