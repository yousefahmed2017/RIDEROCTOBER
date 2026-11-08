// إدارة موسيقى المشغّل: الأغاني اللي بترفعها بتشتغل عند كل اللاعبين (محتاج السيرفر). cfg.music = { tracks:[{url,name,where:'both'|'menu'|'game'}] }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const AUDIO_RX = /\.(mp3|ogg|oga|wav|m4a|aac|opus)$/i;
const WHERE = { both: 'القايمة + اللعب', menu: 'القايمة بس', game: 'اللعب بس' };
const niceName = (n) => n.replace(AUDIO_RX, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || 'أغنية';
export function musicView(cfg, mode) {
  const L = (cfg.music ||= { tracks: [] }).tracks;
  return `<div class="tx-wrap mus"><small class="muted">ارفع أغاني (mp3 / ogg / wav / m4a — الملف لحد 25MB). الأغاني بتظهر فورًا في مشغّل كل اللاعبين. خليها مضغوطة (mp3 128kbps) عشان النت.${mode === 'server' ? '' : '<br><b>⚠ إنت في الوضع المحلي: رفع الأغاني محتاج السيرفر.</b>'}</small>
  <div class="row"><label class="btn primary filebtn">⬆️ ارفع أغاني<input type="file" accept="audio/*,.mp3,.ogg,.m4a,.wav,.opus" multiple data-mus="files" hidden></label></div>
  <div class="tx-slot"><h4>🎵 الأغاني (${L.length})</h4>${L.map((t, i) => `<div class="row mus-row"><button class="ib" data-mus="play" data-i="${i}" title="جرّب">▶</button><input class="grow" data-mf="name" data-i="${i}" value="${esc(t.name)}" maxlength="80" aria-label="اسم الأغنية"><select data-mf="where" data-i="${i}" aria-label="تشتغل فين">${Object.entries(WHERE).map(([v, l]) => `<option value="${v}" ${t.where === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="ib danger" data-mus="del" data-i="${i}" title="شيل">🗑️</button></div>`).join('') || '<div class="empty">مفيش أغاني — ارفع ملفاتك من الزر فوق</div>'}</div>
  <button class="btn primary" data-mus="save">💾 حفظ ونشر</button></div>`;
}
export function musicInput(e, cfg) { const el = e.target, f = el.dataset && el.dataset.mf; if (!f || el.dataset.i == null) return; const t = (cfg.music ||= { tracks: [] }).tracks[+el.dataset.i]; if (t) t[f] = el.value; }
// رفع ملفات (من تبويب الإدارة أو من زر المشغّل): h = { mode, toast, uploadAudio, cfg, persist, redraw }
export async function addMusicFiles(files, h) {
  const fs = [...files].filter((f) => f.type.startsWith('audio/') || AUDIO_RX.test(f.name)); if (!fs.length) return h.toast('اختار ملفات صوت (mp3 / ogg / wav / m4a)', 'bad');
  if (h.mode !== 'server') return h.toast('رفع الأغاني محتاج السيرفر', 'bad');
  const L = ((h.cfg.music ||= { tracks: [] }).tracks); let ok = 0;
  for (const f of fs) { try { if (f.size > 25e6) throw new Error(f.name + ' أكبر من 25MB'); h.toast('بيرفع ' + niceName(f.name) + '… (' + (f.size / 1e6).toFixed(1) + ' MB)'); const url = await h.uploadAudio(f); L.push({ url, name: niceName(f.name), where: 'both' }); ok++; } catch (er) { h.toast(er.message, 'bad'); } }
  if (ok) { await h.persist(ok + ' أغنية اتضافت لكل اللاعبين 🎵'); if (h.redraw) h.redraw(); }
}
export async function musicClick(d, h) {
  const L = (h.cfg.music ||= { tracks: [] }).tracks;
  if (d.mus === 'del') { L.splice(+d.i, 1); await h.persist('اتشالت'); h.redraw(); }
  else if (d.mus === 'save') { await h.persist('اتحفظ — الأغاني بقت عند كل اللاعبين ✔'); h.redraw(); }
  else if (d.mus === 'play') { const t = L[+d.i]; if (t && h.preview) h.preview(t); }
}
