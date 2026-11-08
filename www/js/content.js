// محتوى اللعبة القابل للتعديل من لوحة الإدارة: إعلانات، بانرات، صور معالم، موديلات GLB.
// بيتسحب من السيرفر (api/config) → لو مش متاح بيرجع لـ content.json المرفق → لو مش موجود بيرجع للكاش على الجهاز.
const CACHE = 'orider-content-v1';
export function serverBase() {
  try { const q = new URLSearchParams(location.search).get('server'); if (q) { localStorage.setItem('orider-server', q); return q.replace(/\/$/, ''); } } catch (e) { /* ignore */ }
  try { const s = localStorage.getItem('orider-server'); if (s) return s.replace(/\/$/, ''); } catch (e) { /* ignore */ }
  return '';
}
export function setServerBase(url) { try { if (url) localStorage.setItem('orider-server', url.trim().replace(/\/$/, '')); else localStorage.removeItem('orider-server'); } catch (e) { /* ignore */ } }
async function getJSON(url, ms = 4500) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(to); }
}
const EMPTY = { ads: [], landmarks: [], models: {}, bikeModels: {}, version: 0 };
export const LOCAL_KEY = 'orider-local-content-v1';
export function loadLocalContent() { try { const j = JSON.parse(localStorage.getItem(LOCAL_KEY)); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } }
export function saveLocalContent(cfg) { localStorage.setItem(LOCAL_KEY, JSON.stringify(cfg)); }
export async function loadContent() {
  const base = serverBase(); let content = null, from = '';
  if (/^https?:/.test(location.protocol) || base) { try { content = await getJSON(base + '/api/config'); from = 'server'; } catch (e) { content = null; } }
  if (!content) { const lc = loadLocalContent(); if (lc && ((lc.ads || []).length || (lc.landmarks || []).length || lc.noHomeLandmark || lc.messages || lc.shops || lc.music || (lc.contact && lc.contact.whatsapp) || lc.adSlots || lc.adContact || (lc.streetNames && Object.keys(lc.streetNames).length))) { content = lc; from = 'local'; } }
  if (!content) { try { content = await getJSON('content.json'); from = 'file'; } catch (e) { content = null; } }
  if (content && from === 'server') { try { localStorage.setItem(CACHE, JSON.stringify(content)); } catch (e) { /* ignore */ } }
  if (!content) { try { content = JSON.parse(localStorage.getItem(CACHE)); from = 'cache'; } catch (e) { content = null; } }
  const out = { ...EMPTY, ...(content || {}) };
  if (!content && typeof window !== 'undefined' && window.__DEFAULT_CONTENT__) { Object.assign(out, window.__DEFAULT_CONTENT__); from = 'builtin'; }
  // معلم الجراج الرئيسي (صورة الصيدلية) بيتضاف تلقائي لو الإدارة ما شالتوش
  try { const { HOME } = await import('./config.js'); out.landmarks = (out.landmarks || []).map((l) => (l.id === HOME.landmark.id && l.lat == null ? { ...HOME.landmark, ...l, lat: HOME.lat, lon: HOME.lon, active: l.active !== false } : l)); if (!out.noHomeLandmark && !out.landmarks.some((l) => l.id === HOME.landmark.id)) { const dflt = (typeof window !== 'undefined' && window.__DEFAULT_CONTENT__ && window.__DEFAULT_CONTENT__.landmarks || []).find((l) => l.id === HOME.landmark.id); out.landmarks.push({ ...HOME.landmark, ...(dflt || {}), lat: HOME.lat, lon: HOME.lon, active: true }); } } catch (e) { /* ignore */ }
  return { content: out, base, from: from || 'none' };
}
