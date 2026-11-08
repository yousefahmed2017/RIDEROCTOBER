// لوحة الإدارة داخل اللعبة: دخول بكلمة سر، إضافة بانرات/بيلبوردات/لوحات وربط صور بمعالم حقيقية، وتحديد المكان من موقعك الحالي في اللعبة.
// وضعين: (1) سيرفر: لو فيه سيرفر شغّال (npm run server) بتتحفظ على السيرفر وكل اللاعبين يشوفوها. (2) محلي: من غير سيرفر بتتحفظ على الجهاز + تصدير/استيراد JSON.
import { DIRECTORY, insideMap, fmtDist, parsePlace } from './lm-directory.js';
import { CITY } from './config.js';
import { modelsView, modelsInput, modelsFile, modelsClick } from './models-ui.js';
import { musicView, musicInput, musicClick, addMusicFiles } from './music-ui.js';
import { shopsView, shopsInput, shopsClick, shopsFile } from './shops-ui.js';
import { serverBase, LOCAL_KEY, saveLocalContent, loadLocalContent } from './content.js';
import { mountCropper } from './cropper.js';
import { MSGS, GROUPS, POSITIONS, CLASSES, DEFAULTS, normalizeMessages, resolveMessage , speakDefault, LANGS, spokenFrom } from './messages.js';

const $ = (s) => document.querySelector(s);
import { adSlotsView, contactView, reviewView, staffView, extraInput } from './admin-extra.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AT = { billboard: 'بيلبورد كبير', banner: 'بانر رأسي', poster: 'لوحة صغيرة', screen: '📺 خارج اللعب' };
const AD_SLOTS = [['loading', 'شاشة التحميل'], ['menu', 'القائمة'], ['pause', 'قائمة الإيقاف'], ['end', 'شاشات النهاية']];
const MODE = { both: 'واجهة + لوحة', facade: 'على واجهة المبنى', poster: 'لوحة قدام المعلم' };
const AUTH_KEY = 'orider-local-admin-v1';
const SESS_KEY = 'orider-admin-sess-v1'; // الجلسة بتفضل بعد إعادة تحميل الصفحة (في نفس التبويب بس)
const readSession = () => { try { const j = JSON.parse(sessionStorage.getItem(SESS_KEY)); return j && (j.mode === 'local' || (j.mode === 'server' && j.token)) ? j : null; } catch (e) { return null; } };
let ctx = null, session = readSession(), root = null; // session: { mode:'server'|'local', token?, role:'manager'|'staff', name, depts }
const isMgr = () => !!session && (session.mode === 'local' || session.role !== 'staff');
const can = (dept) => isMgr() || (session.depts || []).includes(dept);
const TABS = [['ads', '📢 الإعلانات', 'ads'], ['lm', '📍 المعالم', 'places'], ['st', '🛣️ الشوارع', 'places'], ['tx', '🎨 الخامات', 'look'], ['shops', '🏪 المحلات', 'look'], ['mdl', '🧍 المجسمات', 'models'], ['mus', '🎵 الموسيقى', 'music'], ['msgs', '💬 الرسائل', 'messages'], ['contact', '📞 التواصل', 'contact'], ['rev', '📥 المراجعة', '@mgr-server'], ['staff', '👥 الموظفين', '@mgr-server'], ['tools', '⚙️ أدوات', '@all']];
const tabOk = (t) => { const d = (TABS.find((x) => x[0] === t) || [])[2]; return d === '@all' ? true : d === '@mgr-server' ? isMgr() && session.mode === 'server' : !!d && can(d); };
let baseCfg = null, revState = { list: [], filter: 'pending' }, staffState = { list: [], depts: {}, audit: [], edit: null }, pendingEdited = null, pendingCount = 0;
const keepSession = () => { try { if (session) sessionStorage.setItem(SESS_KEY, JSON.stringify(session)); else sessionStorage.removeItem(SESS_KEY); } catch (e) { /* ignore */ } };

async function sha(str) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 'x' + (h >>> 0).toString(16); }
}
async function serverAlive() {
  const base = serverBase(); if (!base && !/^https?:/.test(location.protocol)) return false;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 2500);
  try { const r = await fetch(base + '/api/config', { signal: ctl.signal, cache: 'no-store' }); return r.ok && /json/.test(r.headers.get('content-type') || ''); } catch (e) { return false; } finally { clearTimeout(to); }
}
const api = async (path, opt = {}) => {
  const r = await fetch(serverBase() + path, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + session.token } });
  const j = await r.json().catch(() => ({})); if (r.status === 401) { session = null; keepSession(); throw new Error('انتهت الجلسة — ادخل تاني'); } if (!r.ok) throw new Error(j.error || 'خطأ'); return j;
};
const toDataURL = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
// بنرفع الصورة الأصلية زي ما هي (من غير ضغط أو قص) — القص بيتحفظ كإحداثيات جنب الصورة
async function uploadImage(file) {
  if (!/^image\//.test(file.type)) throw new Error('الملف مش صورة');
  if (session.mode === 'local') { if (file.size > 1.5e6) ctx.toast('الصورة كبيرة (' + (file.size / 1e6).toFixed(1) + ' MB) — في الوضع المحلي ممكن مساحة الجهاز تخلص. استخدم السيرفر للصور الكبيرة.', 'bad'); return toDataURL(file); }
  const ext = ({ 'image/png': '.png', 'image/webp': '.webp' })[file.type] || '.jpg';
  const r = await api('/api/admin/upload?name=img' + ext, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } }); return r.url;
}
async function uploadModel(file) {
  if (session.mode === 'local') throw new Error('رفع المجسمات محتاج السيرفر');
  return (await api('/api/admin/upload?name=model.glb', { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } })).url;
}
async function uploadAudio(file) {
  if (session.mode === 'local') throw new Error('رفع الأغاني محتاج السيرفر');
  const ext = (/\.(mp3|ogg|oga|wav|m4a|aac|opus)$/i.exec(file.name) || ['.mp3'])[0].toLowerCase().replace(/^(?!\.)/, '.');
  return (await api('/api/admin/upload?name=track' + ext, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } })).url;
}
let curCfg = null;
const musicH = () => ({ mode: session.mode, toast: ctx.toast, uploadAudio, cfg, persist, redraw: draw, preview: (t) => ctx.previewTrack && ctx.previewTrack(t) });
// من زر المشغّل: الأدمن يرفع أغاني مباشرة (بتتضاف لكل اللاعبين)
export async function adminAddMusicFromPlayer(files) {
  if (!session) return; const c = await loadCfg(); await addMusicFiles(files, { mode: session.mode, toast: ctx.toast, uploadAudio, cfg: c, persist: async (msg) => { await saveCfg(c); ctx.toast(msg, 'good'); } });
}
async function loadCfg() {
  if (session.mode === 'server') return api('/api/admin/config');
  return loadLocalContent() || { ads: [], landmarks: [], models: {}, bikeModels: {}, version: 0 };
}
const DEPT_KEYS = { ads: ['ads', 'adSlots', 'adContact', 'adEndpoint'], places: ['landmarks', 'streetNames'], look: ['textures', 'shops'], models: ['models', 'bikeModels'], music: ['music'], messages: ['messages'], contact: ['contact'] };
async function saveCfg(cfg) {
  if (session.mode === 'server' && !isMgr()) { // موظف: التعديلات بتروح للمدير للمراجعة (مش نشر مباشر)
    const base = baseCfg || {}; let sent = 0; const note = typeof prompt === 'function' ? prompt('ملاحظة للمدير عن التعديل (اختياري):', '') || '' : '';
    for (const d of session.depts || []) { const keys = (DEPT_KEYS[d] || []).filter((k) => JSON.stringify(cfg[k]) !== JSON.stringify(base[k])); if (!keys.length) continue; await api('/api/admin/propose', { method: 'POST', body: JSON.stringify({ dept: d, note, changes: Object.fromEntries(keys.map((k) => [k, cfg[k]])) }) }); sent++; }
    if (!sent) throw new Error('مفيش تعديلات جديدة تتبعت'); baseCfg = JSON.parse(JSON.stringify(cfg)); ctx.onChange(cfg); cfg._sent = sent; return cfg;
  }
  if (session.mode === 'server') cfg = await api('/api/admin/config', { method: 'PUT', body: JSON.stringify(cfg) });
  else { cfg.version = (cfg.version || 0) + 1; saveLocalContent(cfg); }
  ctx.onChange(cfg); baseCfg = JSON.parse(JSON.stringify(cfg)); return cfg;
}

export function adminLoggedIn() { return !!session; }
export const adminCan = (dept) => !!session && can(dept); // صلاحية القسم للجلسة الحالية
export const adminIsStaff = () => !!session && session.mode === 'server' && session.role === 'staff';
export function initAdmin(c) { ctx = c; root = $('#adminp'); }

// ───────── الدخول ─────────
export async function openAdminLogin() {
  const box = $('#adminlogin'); box.classList.remove('hidden');
  const alive = await serverAlive(), hasLocal = !!localStorage.getItem(AUTH_KEY);
  const mode = alive ? 'server' : 'local';
  $('#al-mode').innerHTML = alive ? '🟢 متصل بالسيرفر — التعديلات هتظهر لكل اللاعبين' : '🟠 مفيش سيرفر — وضع محلي (التعديلات على جهازك + تصدير)';
  $('#al-srv-row').hidden = alive; $('#al-srv').value = serverBase(); const ur = $('#al-user-row'); if (ur) { ur.hidden = !alive; $('#al-user').value = ''; }
  $('#al-pw2-row').hidden = alive || hasLocal; $('#al-title').textContent = alive || hasLocal ? 'دخول الإدارة' : 'إنشاء كلمة سر الإدارة (أول مرة)';
  $('#al-err').textContent = ''; $('#al-pw').value = ''; $('#al-pw2').value = ''; setTimeout(() => $('#al-pw').focus(), 50);
  const go = async () => {
    const pw = $('#al-pw').value; $('#al-err').textContent = '';
    try {
      if (mode === 'server') { const r = await fetch(serverBase() + '/api/login', { method: 'POST', body: JSON.stringify({ password: pw, username: ($('#al-user') && $('#al-user').value || '').trim() }) }), j = await r.json(); if (!r.ok) throw new Error(j.error || 'كلمة السر غلط'); session = { mode: 'server', token: j.token, role: j.role || 'manager', name: j.name, depts: j.depts }; }
      else {
        if (pw.length < 4) throw new Error('كلمة السر لازم 4 حروف على الأقل');
        const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
        if (!saved) { if (pw !== $('#al-pw2').value) throw new Error('كلمتين السر مش متطابقين'); const salt = Math.random().toString(36).slice(2); localStorage.setItem(AUTH_KEY, JSON.stringify({ salt, hash: await sha(salt + pw) })); }
        else if ((await sha(saved.salt + pw)) !== saved.hash) throw new Error('كلمة السر غلط');
        session = { mode: 'local' };
      }
      keepSession(); box.classList.add('hidden'); ctx.onLogin(); openAdminPanel();
    } catch (e) { $('#al-err').textContent = e.message; }
  };
  $('#al-go').onclick = go; $('#al-pw').onkeydown = $('#al-pw2').onkeydown = (e) => { if (e.key === 'Enter') go(); }; if ($('#al-user')) $('#al-user').onkeydown = (e) => { if (e.key === 'Enter') $('#al-pw').focus(); }; $('#al-cancel').onclick = () => box.classList.add('hidden');
  $('#al-srv').onchange = () => { import('./content.js').then((m) => { m.setServerBase($('#al-srv').value); openAdminLogin(); }); };
}
export function adminLogout() { session = null; keepSession(); ctx.onLogout(); $('#adminp').classList.add('hidden'); }

// ───────── اللوحة ─────────
let tab = 'ads', cfg = null, editing = null, q = '', flt = 'all';
const TX = { ground: 'أرض / رصيف', facade: 'واجهات المباني', road: 'أسفلت الطريق' };
export async function openAdminPanel(startTab, preset) {
  if (!session) return openAdminLogin();
  root.classList.remove('hidden'); root.classList.add('page'); ctx.setPaused(true);
  try { cfg = await loadCfg(); } catch (e) { ctx.toast(e.message, 'bad'); return; }
  cfg.ads ||= []; cfg.landmarks ||= []; baseCfg = JSON.parse(JSON.stringify(cfg)); if (startTab && tabOk(startTab)) tab = startTab; if (!tabOk(tab)) tab = (TABS.find((t) => tabOk(t[0])) || ['tools'])[0]; refreshPending(); editing = preset ? { kind: preset.kind, item: preset.item, isNew: true } : null; draw();
}
function close() { root.classList.add('hidden'); root.classList.remove('page'); ctx.setPaused(false); }
const DEPT_TAB = { ads: 'ads', places: 'lm', look: 'tx', models: 'mdl', music: 'mus', messages: 'msgs', contact: 'contact' };
async function loadReview() { try { const j = await api('/api/admin/proposals?status=' + revState.filter); revState.list = j.list; pendingCount = j.pending; draw(); } catch (e) { ctx.toast(e.message, 'bad'); } }
async function loadStaff() { try { const [a, b] = await Promise.all([api('/api/admin/staff'), api('/api/admin/audit')]); staffState.list = a.list; staffState.depts = a.depts; staffState.audit = b.list; draw(); } catch (e) { ctx.toast(e.message, 'bad'); } }
async function reviewClick(d) {
  try {
    if (d.rv === 'filter') { revState.filter = d.id; return loadReview(); }
    const p = revState.list.find((x) => x.id === d.id);
    if (d.rv === 'approve') { if (!confirm('اعتماد التعديلات دي ونشرها لكل اللاعبين؟')) return; await api(`/api/admin/proposals/${d.id}/approve`, { method: 'POST', body: '{}' }); cfg = await loadCfg(); ctx.onChange(cfg); baseCfg = JSON.parse(JSON.stringify(cfg)); ctx.toast('اتعتمد واتنشر ✔', 'good'); return loadReview(); }
    if (d.rv === 'reject') { const note = prompt('سبب الرفض (هيشوفه الموظف):', '') ; if (note === null) return; await api(`/api/admin/proposals/${d.id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }); ctx.toast('اترفض', 'good'); return loadReview(); }
    if (d.rv === 'edit' && p && p.changes) { Object.assign(cfg, p.changes); pendingEdited = d.id; tab = DEPT_TAB[p.dept] || 'ads'; ctx.toast('اتحمّلت تعديلات ' + p.byName + ' — عدّل واضغط حفظ وهيتنشر ويتقفل الطلب', 'good'); draw(); }
  } catch (e) { ctx.toast(e.message, 'bad'); }
}
function staffInput(e) {
  const el = e.target, d = el.dataset, ed = staffState.edit; if (!ed) return;
  if (d.sfd) { ed.depts = ed.depts || []; const k = d.sfd; ed.depts = el.checked ? [...new Set([...ed.depts, k])] : ed.depts.filter((x) => x !== k); return; }
  if (d.sfi === 'active') ed.active = el.checked; else ed[d.sfi] = el.value;
}
async function staffClick(d) {
  try {
    if (d.sf === 'new') { staffState.edit = { depts: [], active: true }; return draw(); }
    if (d.sf === 'cancel') { staffState.edit = null; return draw(); }
    if (d.sf === 'edit') { const u = staffState.list.find((x) => x.id === d.id); staffState.edit = { ...u, depts: [...u.depts], password: '' }; return draw(); }
    if (d.sf === 'save') { const ed = staffState.edit; await api('/api/admin/staff', { method: 'POST', body: JSON.stringify(ed) }); staffState.edit = null; ctx.toast('اتحفظ الموظف ✔', 'good'); return loadStaff(); }
    if (d.sf === 'del') { const u = staffState.list.find((x) => x.id === d.id); if (!confirm('حذف الموظف «' + (u && u.name) + '»؟ طلباته المستنية هتتلغي.')) return; await api('/api/admin/staff/' + d.id, { method: 'DELETE' }); ctx.toast('اتحذف', 'good'); return loadStaff(); }
  } catch (e) { ctx.toast(e.message, 'bad'); }
}
async function refreshPending() { if (session && session.mode === 'server' && isMgr()) { try { pendingCount = (await api('/api/admin/proposals?status=pending')).pending || 0; if (tab) { const b = root.querySelector('[data-tab=rev] .bdg'); if (b) b.textContent = pendingCount || ''; } } catch (e) { /* ignore */ } } }
async function persist(msg) { try { const was = isMgr(); cfg = await saveCfg(cfg); if (!was && cfg._sent) { delete cfg._sent; ctx.toast('اتبعتت للمدير للمراجعة ✔ (مش هتظهر للاعبين غير بعد اعتماده)', 'good'); } else { ctx.toast(msg || 'اتحفظ ✔', 'good'); if (pendingEdited && isMgr()) { const id = pendingEdited; pendingEdited = null; try { await api(`/api/admin/proposals/${id}/edited`, { method: 'POST', body: JSON.stringify({ note: 'اتعدّل واتنشر' }) }); refreshPending(); } catch (e) { /* ignore */ } } } } catch (e) { ctx.toast(e.message.includes('Quota') || /quota/i.test(e.message) ? 'مساحة الجهاز خلصت — احذف إعلانات قديمة أو استخدم السيرفر' : e.message, 'bad'); } }

function draw() {
  const list = tab === 'ads' ? cfg.ads : cfg.landmarks;
  if (editing) return drawForm();
  const nav = TABS.filter((t) => tabOk(t[0])).map(([id, label]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${label}${id === 'ads' ? ' (' + cfg.ads.length + ')' : id === 'lm' ? ' (' + cfg.landmarks.length + ')' : ''}${id === 'rev' ? `<span class="bdg">${pendingCount || ''}</span>` : ''}</button>`).join('');
  const who = session.mode === 'local' ? 'محلي' : isMgr() ? 'المدير' : 'موظف: ' + esc(session.name || '');
  root.innerHTML = `<div class="adminpage"><header class="ap-head"><h2>🛠️ لوحة الإدارة <small class="muted">${session.mode === 'server' ? '· سيرفر' : '· محلي'}</small></h2><span class="ap-who">👤 ${who}</span>${!isMgr() && session.mode === 'server' ? '<span class="ap-hint">تعديلاتك بتتبعت للمدير للمراجعة قبل ما تظهر للاعبين</span>' : ''}<button id="ad-x" class="btn">✕ رجوع للّعبة</button></header><div class="ap-body"><nav class="ap-nav">${nav}</nav><main class="ap-main">
  ${tab === 'contact' ? contactView(cfg) : tab === 'rev' ? reviewView(revState) : tab === 'staff' ? staffView(staffState) : tab === 'tools' ? tools() : tab === 'shops' ? shopsView(cfg, ctx) : tab === 'mdl' ? modelsView(cfg, ctx, session.mode) : tab === 'mus' ? musicView(cfg, session.mode) : tab === 'st' ? streetsView() : tab === 'msgs' ? msgsView() : tab === 'tx' ? texView() : `${tab === 'ads' ? adSlotsView(cfg) : ''}${tab === 'lm' ? dirView() : ''}<div class="ad-bar"><button class="btn primary" data-new="${tab}">＋ ${tab === 'ads' ? 'إعلان / بانر' : 'معلم'} (موقعي)</button><input id="ad-q" class="ad-q" type="search" placeholder="🔍 بحث…" value="${esc(q)}"><div class="ad-flt">${[['all', 'الكل'], ['on', 'شغال'], ['off', 'موقوف']].map(([k, l]) => `<button class="chip ${flt === k ? 'on' : ''}" data-flt="${k}">${l}</button>`).join('')}</div></div>
  <div class="ad-list">${(() => { const v = list.map((a, i) => [a, i]).filter(([a]) => (flt === 'all' || (flt === 'on') === (a.active !== false)) && (!q || ((a.title || '') + (a.name || '') + (a.type || '')).toLowerCase().includes(q.toLowerCase()))); return v.map(([a, i]) => card(a, i)).join('') || '<div class="empty">مفيش نتائج — ادوس ＋ فوق</div>'; })()}</div>`}</main></div></div>`;
  if (tab === 'tx') wireTex();
  { const qi = $('#ad-q'); if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#ad-q'); n.focus(); n.setSelectionRange(pos, pos); }; }
  $('#ad-x').onclick = close;
  const h0 = tab === 'msgs' ? msgsInput : tab === 'mus' ? (e) => { if (e.type === 'change' && e.target.dataset.mus === 'files') { addMusicFiles(e.target.files, musicH()); return; } musicInput(e, cfg); } : tab === 'mdl' ? (e) => { if (e.type === 'change') { modelsFile(e, { mode: session.mode, toast: ctx.toast, uploadModel, cfg, redraw: draw }); } modelsInput(e, cfg); } : tab === 'shops' ? (e) => { if (e.type === 'change' && shopsFile(e, { toast: ctx.toast, uploadImage, redraw: draw })) { /* رفع */ } shopsInput(e); } : null;
  root.oninput = root.onchange = (e) => { const r = extraInput(e, cfg); if (r === 'redraw') return draw(); if (r) return; const ds = e.target.dataset || {}; if (ds.sfi || ds.sfd) return staffInput(e); if (h0) h0(e); };
  root.onclick = async (e) => {
    const t = e.target.closest('[data-tab],[data-flt],[data-new],[data-e],[data-t],[data-d],[data-go],[data-act],[data-mp],[data-mr],[data-msave],[data-mreset],[data-sact],[data-shp],[data-dir],[data-mdl],[data-mus],[data-rv],[data-sf],[data-ct-save]'); if (!t) return; const d = t.dataset;
    if (d.ctSave) { await persist(); return draw(); }
    if (d.rv) return reviewClick(d);
    if (d.sf) return staffClick(d);
    if (d.mus && d.mus !== 'files') return musicClick(d, musicH());
    if (d.mdl) return modelsClick(d, { cfg, persist, redraw: draw });
    if (d.dir) return dirClick(d);
    if (d.shp) return shopsClick(d, { ctx, toast: ctx.toast, persist, redraw: draw, uploadImage });
    if (d.sact) return streetsClick(d);
    if (d.mp || d.mr || d.msave != null || d.mreset != null) return msgsClick(d);
    if (d.tab) { tab = d.tab; draw(); if (tab === 'rev') loadReview(); else if (tab === 'staff') loadStaff(); }
    else if (d.flt) { flt = d.flt; draw(); }
    else if (d.new) { const p = ctx.getPos(); editing = { kind: d.new, isNew: true, item: d.new === 'ads' ? { id: uid(), type: 'billboard', active: true, lat: p.lat, lon: p.lon } : { id: uid(), mode: 'both', active: true, lat: p.lat, lon: p.lon } }; draw(); }
    else if (d.e != null) { editing = { kind: tab, isNew: false, item: { ...list[d.e] }, idx: +d.e }; draw(); }
    else if (d.t != null) { list[d.t].active = !list[d.t].active; await persist(); draw(); }
    else if (d.d != null) { if (confirm('تأكيد الحذف؟')) { const [x] = list.splice(d.d, 1); if (x && x.id === 'home-elgehainy') cfg.noHomeLandmark = true; await persist('اتحذف'); draw(); } }
    else if (d.go != null) { const a = list[d.go]; ctx.teleport(a.lat, a.lon); close(); }
    else if (d.act) tool(d.act);
  };
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
function card(a, i) {
  const isAd = tab === 'ads', has = typeof a.lat === 'number', on = a.active !== false;
  return `<div class="ad-card ${on ? '' : 'dim'}"><div class="ad-thumb" style="background-image:url('${esc(a.image)}')">${a.image ? '' : '🖼️'}</div>
  <div class="ad-info"><b>${esc(isAd ? a.title || 'بدون عنوان' : a.name)}</b>
  <div class="tags"><span class="tag">${isAd ? AT[a.type] : MODE[a.mode]}</span><span class="tag ${on ? 'ok' : 'off'}">${on ? 'شغال' : 'موقوف'}</span><span class="tag">${has ? '📍' : '🔀'}</span></div></div>
  <div class="ad-act"><button class="ib" data-e="${i}" title="تعديل">✏️</button><button class="ib" data-t="${i}" title="${on ? 'إيقاف' : 'تشغيل'}">${on ? '⏸️' : '▶️'}</button>${has ? `<button class="ib" data-go="${i}" title="روح له">🚀</button>` : ''}<button class="ib danger" data-d="${i}" title="حذف">🗑️</button></div></div>`;
}
// ───────── تبويب الخامات (أرض/واجهات/طريق): صورة تحل محل الخامة المتولدة لكل اللاعبين ─────────
function texView() {
  cfg.textures ||= {};
  return `<div class="tx-wrap"><small class="muted">الصورة بتتكرر على السطح (خامة مربعة 1:1، يفضل 1024×1024 أو أكبر وتتكرر بسلاسة). سيبها فاضية لاستخدام الخامة الافتراضية.</small>${Object.entries(TX).map(([k, l]) => { const t = cfg.textures[k]; return `<div class="tx-slot" data-k="${k}"><h4>${l}</h4><div class="row"><label class="btn mini filebtn">⬆️ اختار صورة<input type="file" accept="image/*" data-txf="${k}" hidden></label>${t ? `<button class="btn mini danger" data-txd="${k}">إزالة</button>` : ''}</div>${t ? `<label>حجم التكرار (أكبر = أكبر)<input type="number" min="0.25" max="8" step="0.25" value="${t.scale || 1}" data-txs="${k}"></label><div class="tx-crop" id="txc-${k}"></div>` : ''}</div>`; }).join('')}<div class="row" style="margin-top:10px"><button class="btn primary grow" id="tx-save">💾 حفظ ونشر</button></div></div>`;
}
function wireTex() {
  for (const k of Object.keys(TX)) { const t = cfg.textures && cfg.textures[k]; if (t) mountCropper($('#txc-' + k), { kind: 'texture', src: t.image, crop: t.crop, onChange: (c) => { t.crop = c; } }); }
  root.querySelectorAll('[data-txf]').forEach((inp) => { inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { ctx.toast('بيرفع الصورة الأصلية…'); const url = await uploadImage(f); (cfg.textures ||= {})[inp.dataset.txf] = { image: url, scale: 1 }; draw(); ctx.toast('اتحطت — اضبط القص واحفظ', 'good'); } catch (er) { ctx.toast(er.message, 'bad'); } }; });
  root.querySelectorAll('[data-txd]').forEach((b) => { b.onclick = () => { delete cfg.textures[b.dataset.txd]; draw(); }; });
  root.querySelectorAll('[data-txs]').forEach((inp) => { inp.oninput = () => { const t = cfg.textures[inp.dataset.txs]; if (t) t.scale = Math.max(0.25, Math.min(8, +inp.value || 1)); }; });
  $('#tx-save').onclick = async () => { await persist('اتحفظ — الخامات هتتطبق عند إعادة تحميل اللعبة ✔'); draw(); };
}
function drawForm() {
  const { kind, item: o, isNew } = editing, ad = kind === 'ads';
  const ro = (id, label, val, ph = '') => `<label>${label}<input id="${id}" value="${esc(val)}" placeholder="${ph}"></label>`;
  root.innerHTML = `<div class="sheet garage admin"><div class="g-head"><h2>${isNew ? 'جديد' : 'تعديل'} — ${ad ? 'إعلان' : 'معلم'}</h2><button id="ad-x" class="round">✕</button></div>
  ${ad ? ro('f-title', 'العنوان (للتنظيم)', o.title) : ro('f-name', 'اسم المعلم', o.name, 'مثال: مول مصر')}
  ${ad ? `<label>النوع<select id="f-type">${Object.entries(AT).map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`
        : `<label>طريقة العرض<select id="f-mode">${Object.entries(MODE).map(([k, v]) => `<option value="${k}" ${o.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`}
  <label>الصورة (من الجهاز)<input type="file" id="f-file" accept="image/*"></label><div id="f-crop"></div>
  <div class="row"><label class="grow">خط العرض lat<input id="f-lat" type="number" step="any" value="${o.lat ?? ''}"></label><label class="grow">خط الطول lon<input id="f-lon" type="number" step="any" value="${o.lon ?? ''}"></label></div>
  <div class="row"><button class="btn mini" id="f-here">📍 استخدم موقعي الحالي في اللعبة</button>${ad ? '<button class="btn mini" id="f-auto">🔀 توزيع تلقائي (بدون مكان)</button>' : ''}</div>
  <small class="muted">${ad ? 'اوقف الموتوسيكل في المكان اللي عايز البانر فيه وادوس «موقعي الحالي» — هيتحط على حافة الرصيف قدام الشارع.' : 'اللعبة هتلصق الصورة على واجهة أقرب مبنى و/أو لوحة قدام المعلم.'}</small>
  ${ad ? `<div class="row"><label class="grow">🔗 رابط عند الضغط (اختياري)<input id="f-link" value="${esc(o.link || '')}" placeholder="https://…" dir="ltr"></label></div><div class="row slotsel">${AD_SLOTS.map(([k, l]) => `<label class="msg-sw"><input type="checkbox" data-slot="${k}" ${!o.slots || o.slots.includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div><small class="muted">نوع «📺 خارج اللعب» بيظهر في الأماكن المعلّمة دي بس (شاشات متوقفة) — مش في العالم، فمش محتاج lat/lon.</small>` : ''}
  ${ad ? `<div class="row"><label class="grow">يبدأ<input id="f-st" type="datetime-local" value="${(o.startsAt || '').slice(0, 16)}"></label><label class="grow">ينتهي<input id="f-en" type="datetime-local" value="${(o.endsAt || '').slice(0, 16)}"></label></div>` : ''}
  <div class="row" style="margin-top:12px"><button class="btn primary grow" id="f-ok">حفظ</button><button class="btn" id="f-no">رجوع</button></div></div>`;
  $('#ad-x').onclick = () => { editing = null; close(); }; $('#f-no').onclick = () => { editing = null; draw(); };
  $('#f-here').onclick = () => { const p = ctx.getPos(); $('#f-lat').value = p.lat.toFixed(6); $('#f-lon').value = p.lon.toFixed(6); };
  if (ad) $('#f-auto').onclick = () => { $('#f-lat').value = ''; $('#f-lon').value = ''; };
  const curKind = () => (ad ? $('#f-type').value : 'facade'); let cr = null;
  const mountCrop = () => { if (!o.image) return; cr = mountCropper($('#f-crop'), { kind: curKind(), src: o.image, crop: o.crop, size: ad && o.width && o.height ? { w: o.width, h: o.height } : null, onChange: (c) => { o.crop = c; } }); };
  mountCrop(); if (ad) $('#f-type').onchange = () => { if (cr) cr.setKind($('#f-type').value, null); else mountCrop(); };
  $('#f-file').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { ctx.toast('بيرفع الصورة الأصلية…'); o.image = await uploadImage(f); o.crop = undefined; mountCrop(); ctx.toast('الصورة جاهزة ✔ — اسحب وكبّر عشان تحدد الجزء الظاهر', 'good'); } catch (er) { ctx.toast(er.message, 'bad'); } };
  $('#f-ok').onclick = async () => {
    const la = $('#f-lat').value, lo = $('#f-lon').value;
    if (!o.image) return ctx.toast('اختار صورة الأول', 'bad');
    if (ad) { if ((la === '') !== (lo === '')) return ctx.toast('حدد lat و lon مع بعض', 'bad'); Object.assign(o, { crop: cr ? cr.get() : o.crop, title: $('#f-title').value.trim(), type: $('#f-type').value, link: $('#f-link').value.trim() || undefined, slots: (() => { const s = [...root.querySelectorAll('[data-slot]:checked')].map((x) => x.dataset.slot); return s.length === AD_SLOTS.length ? undefined : s; })(), lat: la === '' || $('#f-type').value === 'screen' ? undefined : +la, lon: lo === '' || $('#f-type').value === 'screen' ? undefined : +lo, startsAt: $('#f-st').value ? new Date($('#f-st').value).toISOString() : undefined, endsAt: $('#f-en').value ? new Date($('#f-en').value).toISOString() : undefined }); }
    else { if (!$('#f-name').value.trim() || la === '' || lo === '') return ctx.toast('الاسم والمكان مطلوبين', 'bad'); Object.assign(o, { crop: cr ? cr.get() : o.crop, name: $('#f-name').value.trim(), mode: $('#f-mode').value, lat: +la, lon: +lo }); }
    const list = ad ? cfg.ads : cfg.landmarks; if (isNew) list.push(o); else list[editing.idx] = o;
    editing = null; await persist('اتحفظ — الظهور في العالم دلوقتي…'); draw();
  };
}
// ───────── تبويب الرسائل: التحكم في رسائل اللعب (messages.js) ─────────
const SAMPLE = { n: 120, name: 'أحمد', bonus: 50, combo: 3, secs: '2.4', type: 'timeout', code: 'AB12C' };
const secs = (ms) => (ms == null ? '' : +(ms / 1000).toFixed(1));
function msgsView() {
  const c = normalizeMessages(cfg.messages), groups = {};
  for (const [k, m] of Object.entries(MSGS)) (groups[m.group] ||= []).push([k, m]);
  const row = ([k, m]) => { const it = c.items[k] || {}, on = it.on !== false, text = it.text != null ? it.text : m.text, cls = it.cls != null ? it.cls : m.cls;
    return `<div class="msg-row ${on ? '' : 'off'}" data-key="${k}"><label class="msg-sw"><input type="checkbox" data-f="on" ${on ? 'checked' : ''}><span>${esc(m.label)}</span></label>
    <input data-f="text" value="${esc(text)}" maxlength="140">
    <div class="row"><label class="msg-sw"><input type="checkbox" data-f="speak" ${(it.speak != null ? it.speak : speakDefault(k)) ? 'checked' : ''}><span>🗣️ انطقها بصوت</span></label><input class="grow" data-f="say" value="${esc(it.say || '')}" maxlength="140" placeholder="نص النطق (اختياري — سيبه فاضي لنطق نفس النص)"></div>${m.vars.length ? `<small class="muted">متغيرات: ${m.vars.map((v) => '{' + v + '}').join(' ')}</small>` : ''}
    <div class="msg-opts"><select data-f="cls">${Object.entries(CLASSES).map(([v, l]) => `<option value="${v}" ${cls === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input data-f="ms" type="number" min="1" max="15" step="0.5" placeholder="المدة (ث)" value="${secs(it.ms)}">
    <button class="btn mini" data-mp="${k}" title="معاينة + نطق">👁</button><button class="btn mini" data-mr="${k}" title="رجّع الافتراضي">↺</button></div></div>`; };
  return `<div class="msgs"><div id="msg-prev-wrap"><div id="msg-prev" class="toast">اضغط 👁 لمعاينة رسالة</div></div>
  <div class="msg-global"><label class="msg-sw"><input type="checkbox" data-g="on" ${c.on ? 'checked' : ''}><span>تشغيل رسائل اللعب (إيقافها يخفي كل الرسائل)</span></label>
  <div class="row"><label class="grow">مدة الظهور (ثانية)<input data-g="ms" type="number" min="1" max="15" step="0.5" value="${secs(c.ms)}"></label>
  <label class="grow">أقصى عدد رسائل في نفس الوقت<input data-g="max" type="number" min="1" max="8" value="${c.max}"></label></div>
  <h4>🗣️ النطق الصوتي للتحذيرات والرسائل</h4><label class="msg-sw"><input type="checkbox" data-sp="on" ${c.speech.on ? 'checked' : ''}><span>تشغيل النطق (الصوت بيطلع من جهاز اللاعب)</span></label>
  <div class="row"><label class="grow">اللهجة/الصوت<select data-sp="lang">${Object.entries(LANGS).map(([v, l]) => `<option value="${v}" ${c.speech.lang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="grow">السرعة ${c.speech.rate}<input data-sp="rate" type="range" min="0.5" max="1.6" step="0.1" value="${c.speech.rate}"></label>
  <label class="grow">النبرة ${c.speech.pitch}<input data-sp="pitch" type="range" min="0.5" max="1.6" step="0.1" value="${c.speech.pitch}"></label>
  <label class="grow">الارتفاع ${Math.round(c.speech.vol * 100)}%<input data-sp="vol" type="range" min="0" max="1" step="0.05" value="${c.speech.vol}"></label></div>
  <label>مكان الظهور<select data-g="pos">${Object.entries(POSITIONS).map(([v, l]) => `<option value="${v}" ${c.pos === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  ${Object.entries(GROUPS).map(([g, name]) => groups[g] ? `<h4>${name}</h4>${groups[g].map(row).join('')}` : '').join('')}
  <div class="row" style="margin-top:12px"><button class="btn primary grow" data-msave>💾 حفظ ونشر</button><button class="btn danger" data-mreset>رجّع الكل للافتراضي</button></div>
  <small class="muted">التغيير بيظهر في اللعب بعد «حفظ ونشر»${session.mode === 'server' ? ' ولكل اللاعبين' : ' (على جهازك — اتصل بالسيرفر عشان تظهر للكل)'}. اترك المدة فاضية لاستخدام المدة العامة.</small></div>`;
}
function msgState() { cfg.messages = normalizeMessages(cfg.messages); return cfg.messages; }
function msgsInput(e) {
  const t = e.target, f = t.dataset.f, g = t.dataset.g, sp = t.dataset.sp; if (!f && !g && !sp) return; const m = msgState();
  if (sp) { m.speech ||= {}; m.speech[sp] = sp === 'on' ? t.checked : sp === 'lang' ? t.value : Number(t.value); if (t.type === 'range' && t.parentElement) t.parentElement.firstChild.textContent = t.parentElement.firstChild.textContent.replace(/[\d.]+%?\s*$/, sp === 'vol' ? Math.round(t.value * 100) + '%' : t.value); return; }
  if (g) { m[g] = g === 'on' ? t.checked : g === 'pos' ? t.value : g === 'ms' ? (Number(t.value) || DEFAULTS.ms / 1000) * 1000 : Number(t.value) || DEFAULTS.max; if (g === 'on') root.querySelector('.msgs').classList.toggle('alloff', !t.checked); return; }
  const rowEl = t.closest('.msg-row'), k = rowEl.dataset.key, it = (m.items[k] ||= {});
  if (f === 'on') { it.on = t.checked; rowEl.classList.toggle('off', !t.checked); }
  else if (f === 'text') it.text = t.value;
  else if (f === 'cls') it.cls = t.value;
  else if (f === 'speak') it.speak = t.checked;
  else if (f === 'say') it.say = t.value;
  else if (f === 'ms') { if (t.value === '') delete it.ms; else it.ms = Number(t.value) * 1000; }
}
async function msgsClick(d) {
  const m = msgState();
  if (d.mp) { const r = resolveMessage(m, d.mp, SAMPLE), el = $('#msg-prev'); el.className = 'toast ' + (r ? r.cls : ''); el.textContent = r ? r.text : '(الرسالة موقوفة — مش هتظهر)'; if (r) ctx.speakPreview && ctx.speakPreview(r.speak || spokenFrom(r.text), r.speech); return; }
  if (d.mr) { delete m.items[d.mr]; return draw(); }
  if (d.mreset != null) { if (confirm('ترجيع كل الرسائل للنصوص والإعدادات الافتراضية؟')) { cfg.messages = normalizeMessages(null); await persist('الرسائل رجعت للافتراضي ✔'); draw(); } return; }
  if (d.msave != null) { cfg.messages = normalizeMessages(m); await persist('اتحفظ — الرسائل اتحدّثت ✔'); draw(); }
}
// ───────── تعديل أسماء الشوارع (الشارع الأقرب للاعب) ─────────
function streetsView() {
  cfg.streetNames ||= {}; const cur = ctx.getStreet ? ctx.getStreet() : null, ent = Object.entries(cfg.streetNames);
  return `<div class="ad-tools"><p class="muted">اقف بالموتوسيكل على الشارع اللي عايز تسميه، وافتح لوحة الإدارة من هنا. بيتحفظ باسم الشارع في OpenStreetMap (المعرّف) ويظهر لكل اللاعبين.</p>
  ${cur ? `<div class="ad-card"><b>الشارع الحالي:</b> ${esc(cur.name || 'شارع بدون اسم')} <span class="muted" dir="ltr">(${esc(cur.id)})</span>
  <input id="st-name" class="ad-q" type="text" maxlength="60" placeholder="الاسم الجديد، مثال: شارع النصر" value="${esc(cfg.streetNames[cur.id] || cur.name || '')}">
  ${cur.chain.length > 1 ? `<label class="muted"><input type="checkbox" id="st-chain" checked> طبّق على الامتداد المتصل بدون اسم (${cur.chain.length} جزء)</label>` : ''}
  <button class="btn primary" data-sact="save">💾 حفظ الاسم</button></div>` : '<div class="empty">مفيش شارع قريب — ادخل اللعبة وقف على شارع الأول</div>'}
  <h4>الأسماء المعدّلة (${ent.length})</h4>
  ${ent.map(([k, v]) => `<div class="ad-card"><b>${esc(v)}</b> <span class="muted" dir="ltr">${esc(k)}</span> <button class="btn danger" data-sact="del" data-k="${esc(k)}">حذف</button></div>`).join('') || '<div class="empty">لسه مفيش أسماء معدّلة</div>'}</div>`;
}
async function streetsClick(d) {
  cfg.streetNames ||= {};
  if (d.sact === 'save') {
    const cur = ctx.getStreet ? ctx.getStreet() : null, name = ($('#st-name').value || '').trim().slice(0, 60); if (!cur) return ctx.toast('مفيش شارع قريب', 'bad'); if (!name) return ctx.toast('اكتب الاسم الأول', 'bad');
    const chain = $('#st-chain'); for (const id of chain && chain.checked ? cur.chain : [cur.id]) cfg.streetNames[id] = name;
    await persist('اتحفظ — الاسم اتطبّق ✔'); draw();
  } else if (d.sact === 'del') { delete cfg.streetNames[d.k]; await persist('اتحذف الاسم المعدّل'); draw(); }
}
function tools() {
  return `<div class="ad-tools"><p class="muted">${session.mode === 'server' ? 'متصل بالسيرفر: أي حفظ بيتنشر لكل اللاعبين. لوحة الويب الكاملة بالخريطة على: <b dir="ltr">' + esc((serverBase() || location.origin) + '/admin/') + '</b>' : 'وضع محلي: التعديلات محفوظة على جهازك. لنشرها لكل اللاعبين شغّل السيرفر (npm run server) وادخل بكلمة سره.'}</p>
  <button class="btn" data-act="export">⬇️ تصدير المحتوى (JSON)</button>
  <label class="btn filebtn">⬆️ استيراد محتوى<input type="file" id="imp" accept=".json,application/json" hidden></label>
  ${session.mode === 'local' ? '<button class="btn" data-act="pw">🔑 تغيير كلمة السر</button>' : ''}
  <button class="btn danger" data-act="logout">🚪 خروج من الإدارة</button></div>`;
}
async function tool(act) {
  if (act === 'logout') return adminLogout();
  if (act === 'export') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 1)], { type: 'application/json' })); a.download = 'october-rider-content.json'; a.click(); return; }
  if (act === 'pw') { const pw = prompt('كلمة السر الجديدة (4 حروف على الأقل)'); if (pw && pw.length >= 4) { const salt = Math.random().toString(36).slice(2); localStorage.setItem(AUTH_KEY, JSON.stringify({ salt, hash: await sha(salt + pw) })); ctx.toast('اتغيرت ✔', 'good'); } }
}
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'imp' || !session) return; const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); cfg.ads = Array.isArray(j.ads) ? j.ads : cfg.ads; cfg.landmarks = Array.isArray(j.landmarks) ? j.landmarks : cfg.landmarks; cfg.models = j.models || cfg.models; await persist('اتستورد ✔'); draw(); } catch (er) { ctx.toast('ملف غلط', 'bad'); }
});

// ───────── دليل معالم أكتوبر وزايد ─────────
let dirOpen = false;
function dirView() {
  const have = new Set((cfg.landmarks || []).map((l) => l.id)), C = CITY.center;
  const row = (e) => { const ok = typeof e.lat === 'number', inn = ok && insideMap(C, CITY.half, e.lat, e.lon), added = have.has(e.id);
    return `<div class="dir-row"><b>${esc(e.name)}</b><small class="muted">${esc(e.area)}${e.note ? ' — ' + esc(e.note) : ''}</small>
    <div class="tags">${ok ? `<span class="tag ok">✅ إحداثيات مؤكدة</span><span class="tag">${fmtDist(C, e.lat, e.lon)} من مركز الخريطة</span><span class="tag ${inn ? 'ok' : 'off'}">${inn ? 'جوه الخريطة' : 'برة حدود الخريطة'}</span>` : '<span class="tag off">⚠ محتاج كود موقع</span>'}</div>
    <div class="row">${ok ? `<button class="btn mini ${added ? '' : 'primary'}" data-dir="add" data-id="${e.id}" ${added ? 'disabled' : ''}>${added ? 'متضاف' : '➕ ضيفه كمعلم'}</button>` : `<input class="ad-q grow" data-dirin="${e.id}" placeholder="الصق كود الموقع (XWFV+2H) أو lat, lon"><button class="btn mini primary" data-dir="addp" data-id="${e.id}">➕ ضيف</button>`}</div></div>`; };
  return `<div class="tx-slot"><div class="row"><h4 class="grow">📚 دليل معالم 6 أكتوبر والشيخ زايد (${DIRECTORY.length})</h4><button class="btn mini" data-dir="tog">${dirOpen ? 'إخفاء' : 'عرض'}</button></div>
  ${dirOpen ? `<small class="muted">الخريطة الحالية 2كم × 2كم حوالين الأحياء الجنوبية، فأغلب المعالم الشهيرة برة حدودها. هتظهر بالاسم لما الخريطة تتوسّع أو تتغير منطقتها. الإحداثيات المؤكدة بس هي اللي بتتضاف بضغطة؛ الباقي الصق له كود الموقع من خرائط جوجل (اضغط مطوّلًا على المكان ← انسخ الكود).</small>
  <div class="row"><input id="dir-free" class="ad-q grow" placeholder="معلم جديد: الصق كود موقع أو lat, lon"><input id="dir-name" class="ad-q grow" placeholder="اسمه"><button class="btn mini primary" data-dir="free">➕</button></div>${DIRECTORY.map(row).join('')}` : ''}</div>`;
}
async function dirClick(d) {
  if (d.dir === 'tog') { dirOpen = !dirOpen; return draw(); }
  const mk = (id, name, p) => ({ id, name, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), mode: 'both', active: true });
  let item = null;
  if (d.dir === 'add') { const e = DIRECTORY.find((x) => x.id === d.id); if (e) item = mk(e.id, e.name, e); }
  else if (d.dir === 'addp') { const e = DIRECTORY.find((x) => x.id === d.id), v = root.querySelector(`[data-dirin="${d.id}"]`).value, p = parsePlace(v, CITY.center); if (!p) return ctx.toast('الكود مش مفهوم — الصق كود زي XWFV+2H أو lat, lon', 'bad'); item = mk(e.id, e.name, p); }
  else if (d.dir === 'free') { const v = $('#dir-free').value, nm = $('#dir-name').value.trim(), p = parsePlace(v, CITY.center); if (!p || !nm) return ctx.toast('اكتب الاسم والصق كود الموقع أو lat, lon', 'bad'); item = mk(uid(), nm, p); }
  if (!item) return; (cfg.landmarks ||= []).push(item); editing = { kind: 'lm', isNew: false, item: { ...item }, idx: cfg.landmarks.length - 1 }; tab = 'lm'; ctx.toast('اتضاف — ضيف صورة واتحفظ', 'good'); draw();
}
