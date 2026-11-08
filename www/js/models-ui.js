// تبويب «🧍 المجسمات» في الإدارة: Model 3 (شخصية اللاعب) · Bike Ninja (المركبة الوحيدة) · المشاة. رفع على السيرفر أو من جهازك مباشرة (من غير سيرفر).
import { saveLocalModel, removeLocalModel, updateLocalModel, listLocalModels } from './localmodels.js';
import { glbStatus } from './glbloader.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SLOTS = [
  ['model3', '🧑 Model 3 — شخصية اللاعب', 'الطول بالمتر', 1.75, 'الشخصية الوحيدة للاعب: بتركب النينجا وبتمشي لما تنزل. الحركات بتتولّد من الهيكل العظمي (Mixamo / Rigify…) فمش محتاج أنيميشن جاهز. الأفضل T-pose أو A-pose بوش للقدام'],
  ['ninja', '🏍️ Bike Ninja — المركبة', 'الطول بالمتر', 1.95, 'بيحل محل جسم النينجا الافتراضي؛ الصندوق بيفضل. اتجاه الدراجة: مقدمتها ناحية الأمام (-Z) — لو بالعكس اضبط «الدوران»'],
  ['ped', '🚶 المشاة في الشارع', 'الطول بالمتر', 1.7, 'شخصية GLB خفيفة (حتى ~3 آلاف مثلث) فيها حركة مشي. اللعبة بتعرض أقرب 12 مشاة بيها'],
  // قديمة (متعطّلة من الواجهة، كودها موجود): walker / myscooter / mymoto
];
const OLD_DEFAULTS = { walker: 1.75, myscooter: 1.85, mymoto: 2.0 };
export function modelsView(cfg, ctx, mode) {
  cfg.models ||= {};
  const loc = listLocalModels();
  return `<div class="tx-wrap mdl"><small class="muted">ارفع ملف .glb (الأفضل أقل من 8MB). موديلات Draco / Meshopt المضغوطة مدعومة. بعد الرفع <b>اعمل ريفريش للّعبة</b> عشان المجسم يتحمّل. لو الموديل ظهر بالعرض أو بالمقلوب اضبط «الدوران». ${mode === 'server' ? '' : '<br><b>📱 من غير سيرفر:</b> استخدم «من جهازك» تحت — بيتخزّن في متصفحك وبيشتغل في كل مرة.'}</small>
  ${SLOTS.map(([k, label, lenLabel, def, hint]) => { const m = cfg.models[k] || null; return `<div class="tx-slot"><h4>${label}</h4><small class="muted">${esc(hint)}</small>
    <div class="row"><label class="btn mini filebtn">📱 من جهازك<input type="file" accept=".glb,model/gltf-binary" data-lfile="${k}" hidden></label>${loc[k] ? `<span class="tag ok">على جهازك: ${esc(loc[k].name)} (${(loc[k].size / 1e6).toFixed(1)}MB)</span><button class="btn mini danger" data-mdl="ldel" data-k="${k}">🗑️ شيله</button>` : ''}${glbStatus[k] ? `<span class="tag ${glbStatus[k].ok ? 'ok' : 'off'}" title="${esc(glbStatus[k].msg)}">${glbStatus[k].ok ? 'اتحمّل في اللعبة ✔' : '⚠ ' + esc(glbStatus[k].msg)}</span>` : ''}</div>
    ${loc[k] ? `<div class="row"><label>${lenLabel}<input type="number" step="0.05" min="0.3" max="8" data-mf="length" data-local="1" data-k="${k}" value="${loc[k].length || def}"></label><label>الدوران<select data-mf="rotY" data-local="1" data-k="${k}">${[[0, '0°'], [1.5708, '90°'], [3.1416, '180°'], [-1.5708, '270°']].map(([v, l]) => `<option value="${v}" ${Math.abs((loc[k].rotY || 0) - v) < 0.01 ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>رفع/خفض (م)<input type="number" step="0.05" min="-1" max="1" data-mf="y" data-local="1" data-k="${k}" value="${loc[k].y || 0}"></label></div>` : ''}
    <div class="row"><label class="btn mini filebtn">⬆️ ارفع على السيرفر<input type="file" accept=".glb,.gltf,model/gltf-binary" data-mfile="${k}" hidden></label>${m && m.url ? `<span class="tag ok">متحمّل ✔</span><button class="btn mini danger" data-mdl="del" data-k="${k}">🗑️ شيله</button>` : '<span class="tag off">مفيش (الشكل الافتراضي)</span>'}</div>
    ${m && m.url ? `<div class="row"><label>${lenLabel}<input type="number" step="0.05" min="0.3" max="8" data-mf="length" data-k="${k}" value="${m.length || def}"></label><label>الدوران<select data-mf="rotY" data-k="${k}">${[[0, '0°'], [1.5708, '90°'], [3.1416, '180°'], [-1.5708, '270°']].map(([v, l]) => `<option value="${v}" ${Math.abs((m.rotY || 0) - v) < 0.01 ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label>رفع/خفض (م)<input type="number" step="0.05" min="-1" max="1" data-mf="y" data-k="${k}" value="${m.y || 0}"></label></div>` : ''}</div>`; }).join('')}
  <button class="btn primary" data-mdl="save">💾 حفظ ونشر</button></div>`;
}
export function modelsInput(e, cfg) {
  const el = e.target, f = el.dataset && el.dataset.mf; if (!f) return;
  if (el.dataset.local) { updateLocalModel(el.dataset.k, { [f]: +el.value }); return; } // من الجهاز
  const m = (cfg.models ||= {})[el.dataset.k]; if (!m) return; m[f] = +el.value;
}
export async function modelsFile(e, h) {
  const el = e.target, lk = el.dataset && el.dataset.lfile;
  if (lk && el.files[0]) { // رفع محلي من الجهاز (من غير سيرفر)
    const f = el.files[0], def = (SLOTS.find((s) => s[0] === lk) || [0, 0, 0, 1.75])[3];
    try { h.toast('بيحفظ على جهازك… (' + (f.size / 1e6).toFixed(1) + ' MB)'); await saveLocalModel(lk, f, { length: def }); h.redraw(); h.toast('اتحفظ على جهازك — اعمل ريفريش للّعبة وهيتحمّل', 'good'); } catch (er) { h.toast(er.message, 'bad'); }
    return true;
  }
  const k = el.dataset && el.dataset.mfile; if (!k || !el.files[0]) return false; const f = el.files[0];
  try {
    if (h.mode !== 'server') throw new Error('رفع المجسمات محتاج السيرفر');
    if (!/\.(glb)$/i.test(f.name)) throw new Error('الملف لازم يبقى .glb'); if (f.size > 25e6) throw new Error('الملف أكبر من 25MB');
    h.toast('بيرفع المجسم… (' + (f.size / 1e6).toFixed(1) + ' MB)'); const url = await h.uploadModel(f), def = (SLOTS.find((s) => s[0] === k) || [0, 0, 0, OLD_DEFAULTS[k] || 1.75])[3];
    h.cfg.models[k] = { url, length: def, rotY: 0, y: 0 }; h.redraw(); h.toast('اترفع — اضغط «حفظ ونشر» وبعدها ريفريش', 'good');
  } catch (er) { h.toast(er.message, 'bad'); }
  return true;
}
export async function modelsClick(d, h) {
  if (d.mdl === 'ldel') { await removeLocalModel(d.k); h.redraw(); }
  else if (d.mdl === 'del') { delete h.cfg.models[d.k]; await h.persist('اتشال — اعمل ريفريش'); h.redraw(); }
  else if (d.mdl === 'save') { await h.persist('اتحفظ — اعمل ريفريش للّعبة عشان يتحمّل'); h.redraw(); }
}
