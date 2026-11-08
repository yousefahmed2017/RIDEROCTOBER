// واجهة القص: إطار بنسبة المكان الحقيقي، اسحب الصورة جواه وكبّر/صغّر، وشارة جودة (أصفر = تحذير بس الحفظ مسموح).
import { TARGETS, aspectOf, cropRect, normCrop, checkQuality, MAX_ZOOM, cleanCrop } from './imgfit.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// host: عنصر الحاوية · opts: { kind, src, crop, size?, onChange(crop, quality) } → { get(), setKind(k), destroy() }
export function mountCropper(host, opts) {
  let { kind, src, crop } = opts, iw = 0, ih = 0, dragging = null;
  host.innerHTML = `<div class="crp"><div class="crp-info"></div><div class="crp-frame"><img alt="" draggable="false"></div>
    <div class="crp-ctl"><span>🔍</span><input type="range" class="crp-zoom" min="1" max="${MAX_ZOOM}" step="0.01" value="1"><button type="button" class="btn mini crp-reset">إعادة ضبط</button></div>
    <div class="crp-q"></div></div>`;
  const frame = host.querySelector('.crp-frame'), img = frame.querySelector('img'), zoom = host.querySelector('.crp-zoom'), info = host.querySelector('.crp-info'), q = host.querySelector('.crp-q');
  const aspect = () => aspectOf(kind, opts.size);
  const layout = () => {
    if (!iw) return; const a = aspect(), fw = Math.min(host.clientWidth || 320, 420, a < 1 ? 220 : 420), fh = fw / a; frame.style.width = fw + 'px'; frame.style.height = fh + 'px';
    const r = cropRect(iw, ih, a, crop), s = fw / r.w; crop = r.crop;
    img.style.width = iw * s + 'px'; img.style.height = ih * s + 'px'; img.style.transform = `translate(${-r.x * s}px, ${-r.y * s}px)`; frame._s = s; zoom.value = crop.zoom;
    const t = TARGETS[kind] || TARGETS.poster, ql = checkQuality(iw, ih, kind, crop, opts.size);
    info.innerHTML = `المطلوب: <b>${esc(t.label)}</b> · نسبة <b dir="ltr">${a >= 1 ? a.toFixed(2) + ':1' : '1:' + (1 / a).toFixed(2)}</b> · مثالي <b dir="ltr">${t.rec[0]}×${t.rec[1]}</b> بكسل · صورتك <b dir="ltr">${iw}×${ih}</b>`;
    q.className = 'crp-q ' + ql.level; q.innerHTML = ql.level === 'good' ? '✔ الجودة كويسة — الجزء الظاهر في اللعبة هو اللي جوه الإطار' : '⚠️ ' + ql.reasons.map(esc).join('<br>⚠️ ') + '<br><small>ممكن تحفظ برضه.</small>';
    opts.onChange && opts.onChange(cleanCrop(crop), ql);
  };
  img.onload = () => { iw = img.naturalWidth; ih = img.naturalHeight; crop = normCrop(crop, iw, ih, aspect()); layout(); };
  img.src = src;
  zoom.oninput = () => { crop = { ...crop, zoom: +zoom.value }; crop = normCrop(crop, iw, ih, aspect()); layout(); };
  host.querySelector('.crp-reset').onclick = () => { crop = { cx: 0.5, cy: 0.5, zoom: 1 }; layout(); };
  frame.onwheel = (e) => { e.preventDefault(); crop = normCrop({ ...crop, zoom: crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93) }, iw, ih, aspect()); layout(); };
  frame.onpointerdown = (e) => { dragging = { x: e.clientX, y: e.clientY, c: { ...crop } }; frame.setPointerCapture(e.pointerId); frame.classList.add('drag'); };
  frame.onpointermove = (e) => { if (!dragging) return; const s = frame._s; crop = normCrop({ cx: dragging.c.cx - (e.clientX - dragging.x) / s / iw, cy: dragging.c.cy - (e.clientY - dragging.y) / s / ih, zoom: dragging.c.zoom }, iw, ih, aspect()); layout(); };
  frame.onpointerup = frame.onpointercancel = () => { dragging = null; frame.classList.remove('drag'); };
  return { get: () => cleanCrop(crop), setKind(k, size) { kind = k; opts.size = size; if (iw) { crop = normCrop(crop, iw, ih, aspect()); layout(); } }, destroy() { host.innerHTML = ''; } };
}
