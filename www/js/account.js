// حساب اللاعب: تسجيل برقم هاتف + كلمة سر أو جوجل، وحفظ التقدم على السيرفر (مزامنة تلقائية).
// وحدة مستقلة: اللعبة بتناديها من game.js بـ initAccount(...) و openAccount(). اللعب كضيف شغّال زي الأول.
import { serverBase, setServerBase } from './content.js';
import { normalizeBike } from './bikes.js';

const TK = 'orider-token-v1', AK = 'orider-account-v1';
const SYNC_KEYS = ['points', 'deliveries', 'failed', 'streak', 'bestStreak', 'totalTime', 'starsSum', 'rated', 'distance', 'money', 'fuel', 'patrols', 'endlessRuns', 'bestEndless', 'fines', 'color', 'totalEarned', 'bestShift', 'bestRace', 'races', 'name', 'bike', 'owned', 'upg', 'settings', 'outfit'];
let ctx = null, token = '', acct = null, info = null, last = '', timer = 0, busy = false, root = null;
const $ = (s, r = document) => r.querySelector(s);
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ignore */ } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const accountLoggedIn = () => !!token;
export const accountInfo = () => acct;

async function api(path, { method = 'GET', body, auth = true, keepalive = false } = {}) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(serverBase() + path, { method, keepalive, signal: ctl.signal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'خطأ ' + r.status); e.status = r.status; throw e; } return j;
  } catch (e) { if (e.name === 'AbortError') throw new Error('السيرفر مش بيرد'); if (e instanceof TypeError) throw new Error('مش قادر أوصل للسيرفر — تأكد من عنوانه وإنه شغّال'); throw e; } finally { clearTimeout(to); }
}
const snapshot = () => { const o = {}; for (const k of SYNC_KEYS) o[k] = ctx.profile[k]; return o; };

function applyProgress(pr, player) {
  const p = ctx.profile;
  if (pr && typeof pr === 'object') {
    const serverPts = +pr.points || 0, localPts = +p.points || 0;
    // لو اللاعب لعب أوفلاين وعنده أكتر من السيرفر، نحتفظ بتقدمه ونرفعه
    if (serverPts >= localPts) { for (const k of SYNC_KEYS) if (pr[k] !== undefined) p[k] = k === 'settings' ? { ...p.settings, ...pr.settings } : pr[k]; }
  }
  if (player && player.id) p.id = player.id;
  normalizeBike(p); // مركبة اللاعب الوحيدة نينجا (حتى لو الحساب القديم فيه سكوتر)
  ctx.saveProfile(p); if (ctx.onApplied) ctx.onApplied();
}
async function push(keep = false) {
  if (!token || busy) return; const s = JSON.stringify(snapshot()); if (s === last) return; busy = true;
  try { await api('/api/progress', { method: 'PUT', body: { progress: JSON.parse(s) }, keepalive: keep && s.length < 60000 }); last = s; refreshStatus(); } catch (e) { if (e.status === 401) { token = ''; lsSet(TK, ''); refreshStatus(); } } finally { busy = false; }
}
function startSync() { clearInterval(timer); timer = setInterval(() => push(), 8000); }
function setSession(r) { token = r.token; acct = r.player; lsSet(TK, token); lsSet(AK, JSON.stringify(acct)); applyProgress(r.progress, r.player); last = ''; push(); startSync(); refreshStatus(); }

export function initAccount(c) {
  ctx = c; token = lsGet(TK); try { acct = JSON.parse(lsGet(AK)) || null; } catch (e) { acct = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(true); }); addEventListener('pagehide', () => push(true));
  refreshStatus();
  if (token) {
    api('/api/auth/me').then((r) => { acct = r.player; lsSet(AK, JSON.stringify(acct)); applyProgress(r.progress, r.player); last = JSON.stringify(snapshot()); startSync(); refreshStatus(); })
      .catch((e) => { if (e.status === 401) { token = ''; lsSet(TK, ''); refreshStatus(); } else startSync(); });
  }
}
function refreshStatus() {
  const b = $('#btn-account'), s = $('#acct-status'); if (!b) return;
  b.textContent = token ? '👤 حسابي — ' + (acct && acct.name || '') : '👤 تسجيل الدخول / حساب جديد';
  if (s) { s.textContent = token ? '✔ تقدمك محفوظ على حسابك' : 'بتلعب كضيف — التقدم على الجهاز ده بس'; s.style.color = token ? 'var(--teal)' : ''; }
}

// ───────── الواجهة ─────────
function shell() {
  if (!root) { root = document.createElement('div'); root.id = 'account'; root.className = 'modal hidden'; document.body.appendChild(root); root.addEventListener('click', (e) => { if (e.target === root) close(); }); }
  return root;
}
const close = () => { if (root) root.classList.add('hidden'); if (ctx && ctx.setPaused) ctx.setPaused(false); };
async function loadInfo() { if (info) return info; try { info = await api('/api/info', { auth: false }); } catch (e) { info = { gameName: 'كوكب الجحود أكتوبر', operators: [] }; } return info; }
const waLink = (num, text) => num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : '';

export async function openAccount() {
  shell(); if (ctx && ctx.setPaused) ctx.setPaused(true); root.classList.remove('hidden'); root.innerHTML = '<div class="sheet"><p>⏳ جاري التحميل…</p></div>';
  await loadInfo(); if (token) return drawIn(); drawOut('login');
}
function infoBlock() {
  const i = info || {}; const ops = (i.operators || []).filter((o) => o.name);
  if (!i.developer && !i.whatsapp && !ops.length && !i.note) return '';
  return `<div class="acc-info"><b>${esc(i.gameName || 'بيانات اللعبة')}</b>${i.developer ? `<div>المطوّر: ${esc(i.developer)}</div>` : ''}${ops.length ? `<div>المشغّلون: ${ops.map((o) => `${esc(o.name)}${o.role ? ' (' + esc(o.role) + ')' : ''}${o.whatsapp ? ` <a href="${waLink(o.whatsapp, 'مرحبًا، بخصوص لعبة ' + (i.gameName || ''))}" target="_blank" rel="noopener">واتساب</a>` : ''}`).join(' · ')}</div>` : ''}${i.note ? `<small>${esc(i.note)}</small>` : ''}</div>`;
}
function drawOut(tab) {
  const i = info || {}, reg = tab === 'reg', needSrv = !/^https?:/.test(location.protocol) && !serverBase();
  const wa = waLink(i.whatsapp, `السلام عليكم، نسيت كلمة السر في ${i.gameName || 'اللعبة'}. رقمي المسجّل: `);
  root.innerHTML = `<div class="sheet acc"><button class="x" id="ac-x">✕</button><h2>👤 ${reg ? 'حساب جديد' : 'تسجيل الدخول'}</h2>
  <div class="seg"><button data-t="login" class="${reg ? '' : 'on'}">دخول</button><button data-t="reg" class="${reg ? 'on' : ''}">حساب جديد</button></div>
  ${needSrv || tab === 'srv' ? `<label class="fld">عنوان السيرفر<input id="ac-srv" dir="ltr" placeholder="https://your-server.com" value="${esc(serverBase())}"></label>` : ''}
  ${reg ? '<label class="fld">اسمك في اللعبة<input id="ac-name" maxlength="14"></label>' : ''}
  <label class="fld">رقم الهاتف<input id="ac-phone" type="tel" dir="ltr" inputmode="tel" placeholder="01XXXXXXXXX" autocomplete="username"></label>
  <label class="fld">كلمة السر${reg ? ' (6 حروف أو أكتر)' : ''}<input id="ac-pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
  <p id="ac-err" class="acc-err"></p>
  <div class="btns"><button id="ac-go" class="btn primary">${reg ? 'إنشاء الحساب' : 'دخول'}</button><button id="ac-guest" class="btn">العب كضيف</button></div>
  ${i.googleClientId ? '<div class="acc-or">— أو —</div><div id="ac-g" style="display:flex;justify-content:center;min-height:44px"></div>' : ''}
  ${!reg ? `<p class="acc-forgot">نسيت كلمة السر؟ ${wa ? `<a href="${wa}" target="_blank" rel="noopener">كلّم الإدارة على واتساب</a> وهيعيدوا ضبطها` : 'كلّم الإدارة لإعادة ضبطها.'}</p>` : ''}
  ${infoBlock()}<p class="acc-note">${reg ? 'تقدّمك الحالي (نقاط وفلوس ومركبات) هيترفع على الحساب الجديد.' : ''}</p></div>`;
  $('#ac-x').onclick = close; $('#ac-guest').onclick = close;
  root.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => drawOut(b.dataset.t); });
  const err = (m) => { $('#ac-err').textContent = m || ''; };
  $('#ac-go').onclick = async () => {
    const srv = $('#ac-srv'); if (srv) setServerBase(srv.value); info = null; err(''); const btn = $('#ac-go'); btn.disabled = true;
    try {
      const phone = $('#ac-phone').value.trim(), password = $('#ac-pw').value;
      if (!phone || !password) throw new Error('اكتب رقم الهاتف وكلمة السر');
      if (reg) { const nm = $('#ac-name').value.trim().slice(0, 14); if (nm) { ctx.profile.name = nm; const ni = document.getElementById('name'); if (ni) ni.value = nm; } }
      const r = await api(reg ? '/api/auth/register' : '/api/auth/login', { method: 'POST', auth: false, body: reg ? { phone, password, name: $('#ac-name').value.trim(), progress: snapshot() } : { phone, password } });
      setSession(r); if (ctx.toast) ctx.toast('أهلاً ' + (r.player.name || '') + ' — تقدمك محفوظ ✔', 'good'); close();
    } catch (e) { err(e.message); btn.disabled = false; if (/السيرفر/.test(e.message) && !$('#ac-srv')) drawOut('srv'); }
  };
  if (i.googleClientId) setupGoogle(i.googleClientId, err);
}
function setupGoogle(cid, err) {
  const go = () => {
    const g = window.google && window.google.accounts && window.google.accounts.id; const box = $('#ac-g'); if (!g || !box) return;
    g.initialize({ client_id: cid, callback: async (resp) => { try { const r = await api('/api/auth/google', { method: 'POST', auth: false, body: { credential: resp.credential, progress: snapshot() } }); setSession(r); if (ctx.toast) ctx.toast('أهلاً ' + (r.player.name || '') + ' ✔', 'good'); close(); } catch (e) { err(e.message); } } });
    g.renderButton(box, { theme: 'filled_black', size: 'large', text: 'continue_with', locale: 'ar', shape: 'pill' });
  };
  if (window.google && window.google.accounts) return go();
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = go; s.onerror = () => err('مش قادر أحمّل تسجيل جوجل (محتاج إنترنت)'); document.head.appendChild(s);
}
async function drawIn() {
  const p = ctx.profile; let lb = []; try { lb = await api('/api/leaderboard', { auth: false }); } catch (e) { /* ignore */ }
  root.innerHTML = `<div class="sheet acc"><button class="x" id="ac-x">✕</button><h2>👤 ${esc(acct && acct.name || p.name)}</h2>
  <div class="acc-stats"><div><b>${p.points}</b><small>نقاط</small></div><div><b>${p.deliveries}</b><small>توصيلات</small></div><div><b>${p.money}</b><small>جنيه</small></div></div>
  <p class="acc-note">${acct && acct.phone ? 'الهاتف: <span dir="ltr">' + esc(acct.phone) + '</span> · ' : ''}${acct && acct.email ? esc(acct.email) + ' · ' : ''}✔ التقدم بيتحفظ تلقائي</p>
  ${lb.length ? `<div class="acc-lb"><b>🏆 الأوائل</b>${lb.slice(0, 10).map((x, k) => `<div><span>${k + 1}. ${esc(x.name)}</span><span>${x.points}</span></div>`).join('')}</div>` : ''}
  <details class="acc-pw"><summary>تغيير كلمة السر</summary><label class="fld">الحالية<input id="ac-old" type="password"></label><label class="fld">الجديدة<input id="ac-new" type="password"></label><button id="ac-chg" class="btn mini">حفظ</button></details>
  <p id="ac-err" class="acc-err"></p>
  <div class="btns"><button id="ac-sync" class="btn">🔄 حفظ دلوقتي</button><button id="ac-out" class="btn danger">خروج من الحساب</button></div>${infoBlock()}</div>`;
  $('#ac-x').onclick = close; const err = (m, ok) => { const e = $('#ac-err'); e.textContent = m || ''; e.style.color = ok ? 'var(--teal)' : ''; };
  $('#ac-sync').onclick = async () => { last = ''; await push(); err('اتحفظ ✔', true); };
  $('#ac-out').onclick = async () => { await push(); token = ''; acct = null; lsSet(TK, ''); lsSet(AK, ''); clearInterval(timer); refreshStatus(); close(); if (ctx.toast) ctx.toast('خرجت من الحساب — بتلعب كضيف'); };
  $('#ac-chg').onclick = async () => { try { await api('/api/auth/password', { method: 'POST', body: { oldPassword: $('#ac-old').value, newPassword: $('#ac-new').value } }); err('اتغيّرت كلمة السر ✔', true); } catch (e) { err(e.message); } };
}
