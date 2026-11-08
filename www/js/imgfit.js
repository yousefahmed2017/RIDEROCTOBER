// ملاءمة الصور: الأبعاد المطلوبة لكل نوع، منطقة القص (سحب + تكبير)، فحص الجودة، وتحويل القص لإعدادات خامة. (نقي — بدون DOM)
// crop = { cx, cy, zoom }: مركز المنطقة الظاهرة (0..1 من أبعاد الصورة) · zoom ≥ 1 (1 = أكبر مستطيل بنفس نسبة الوجه داخل الصورة).

// w:h = نسبة الوجه الحقيقية في اللعبة · rec = الأبعاد المثالية بالبكسل · min = أقل بُعد مقبول قبل التحذير
export const TARGETS = {
  billboard: { label: 'بيلبورد كبير', w: 12, h: 4, rec: [1800, 600], min: [1200, 400] },
  banner: { label: 'بانر رأسي', w: 1.3, h: 3.4, rec: [800, 2090], min: [520, 1360] },
  screen: { label: 'مساحة خارج اللعب (تحميل/قائمة/نهاية)', w: 3.2, h: 1, rec: [1280, 400], min: [640, 200] },
  poster: { label: 'لوحة صغيرة', w: 6, h: 4, rec: [1500, 1000], min: [900, 600] },
  facade: { label: 'واجهة معلم', w: 4, h: 3, rec: [1600, 1200], min: [960, 720] },
  landposter: { label: 'لوحة قدام المعلم', w: 6, h: 4, rec: [1500, 1000], min: [900, 600] },
  texture: { label: 'خامة (أرض/واجهة/طريق)', w: 1, h: 1, rec: [1024, 1024], min: [512, 512] },
};
export const aspectOf = (kind, size) => { const t = TARGETS[kind] || TARGETS.poster; return size && size.w && size.h ? size.w / size.h : t.w / t.h; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const MAX_ZOOM = 4;

// حد أقصى للمنطقة (بالبكسل) بنسبة aspect داخل صورة iw×ih
export function baseRect(iw, ih, aspect) {
  const ia = iw / ih; return ia >= aspect ? { w: ih * aspect, h: ih } : { w: iw, h: iw / aspect };
}
// منظّف: يرجّع crop صالح (المركز بحيث المنطقة كلها جوه الصورة)
export function normCrop(crop, iw, ih, aspect) {
  const zoom = clamp(+(crop && crop.zoom) || 1, 1, MAX_ZOOM), b = baseRect(iw, ih, aspect), w = b.w / zoom, h = b.h / zoom;
  const hx = w / 2 / iw, hy = h / 2 / ih;
  return { cx: clamp(crop && Number.isFinite(+crop.cx) ? +crop.cx : 0.5, hx, 1 - hx), cy: clamp(crop && Number.isFinite(+crop.cy) ? +crop.cy : 0.5, hy, 1 - hy), zoom };
}
// المستطيل الظاهر بالبكسل
export function cropRect(iw, ih, aspect, crop) {
  const c = normCrop(crop, iw, ih, aspect), b = baseRect(iw, ih, aspect), w = b.w / c.zoom, h = b.h / c.zoom;
  return { x: c.cx * iw - w / 2, y: c.cy * ih - h / 2, w, h, crop: c };
}
// فحص الجودة: أصفر (تحذير) لو الصورة صغيرة أو نسبتها بعيدة عن نسبة الوجه — لكن الحفظ مسموح دايمًا
export function checkQuality(iw, ih, kind, crop, size) {
  const t = TARGETS[kind] || TARGETS.poster, aspect = aspectOf(kind, size), r = cropRect(iw, ih, aspect, crop), reasons = [];
  const k = t.w >= t.h ? [t.min[0], t.min[1]] : [t.min[0], t.min[1]];
  if (r.w < k[0] * 0.999 || r.h < k[1] * 0.999) reasons.push(`الجزء الظاهر ${Math.round(r.w)}×${Math.round(r.h)} بكسل — أقل من المطلوب (${k[0]}×${k[1]}) وممكن يطلع مش واضح`);
  const ia = iw / ih, far = Math.max(ia / aspect, aspect / ia);
  if (far > 1.35) reasons.push(`نسبة الصورة (${ia.toFixed(2)}:1) بعيدة عن نسبة المكان (${aspect.toFixed(2)}:1) — هيتقص جزء كبير منها`);
  return { level: reasons.length ? 'warn' : 'good', reasons, px: { w: Math.round(r.w), h: Math.round(r.h) }, kept: Math.min(1, (r.w * r.h) / (iw * ih)) };
}
// تحويل القص لإعدادات خامة three (offset.y من تحت)
export function texTransform(iw, ih, aspect, crop) {
  const r = cropRect(iw, ih, aspect, crop); return { repeat: [r.w / iw, r.h / ih], offset: [r.x / iw, 1 - (r.y + r.h) / ih] };
}
export const isDefaultCrop = (c) => !c || (Math.abs((c.zoom || 1) - 1) < 1e-3 && Math.abs((c.cx ?? 0.5) - 0.5) < 1e-3 && Math.abs((c.cy ?? 0.5) - 0.5) < 1e-3);
// تنقية القيم قبل الحفظ (سيرفر + محلي)
export function cleanCrop(c) {
  if (!c || typeof c !== 'object') return undefined; const z = +c.zoom, x = +c.cx, y = +c.cy; if (![z, x, y].every(Number.isFinite)) return undefined;
  return { cx: +clamp(x, 0, 1).toFixed(4), cy: +clamp(y, 0, 1).toFixed(4), zoom: +clamp(z, 1, MAX_ZOOM).toFixed(3) };
}
// تركيب القص على خامة (بيعمل نسخة عشان نفس الصورة ممكن تتستخدم في أكتر من وش بنسب مختلفة). من غير crop = تغطية الوش من المنتصف (من غير تمطيط)
export function fitTexture(tex, aspect, crop) {
  if (!tex || !tex.image || !tex.image.width) return tex;
  const t = tex.clone(); t.needsUpdate = true; const x = texTransform(tex.image.width, tex.image.height, aspect, crop);
  t.repeat.set(x.repeat[0], x.repeat[1]); t.offset.set(x.offset[0], x.offset[1]); return t;
}
