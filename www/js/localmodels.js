// مجسمات GLB من جهاز اللاعب نفسه (من غير سيرفر): بتتخزن في IndexedDB وتتحمّل في كل مرة. بتتغلّب على موديلات السيرفر لنفس الخانة.
const DB = 'orider-models-v1', ST = 'glb', LS = 'orider-localmodels-v1';
const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => { db.close(); res(q && q.result); }; t.onerror = () => { db.close(); rej(t.error); }; }); };
const meta = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
const setMeta = (m) => { try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) { /* ignore */ } };
export const hasIDB = () => typeof indexedDB !== 'undefined';
export async function saveLocalModel(slot, file, def = {}) {
  if (!hasIDB()) throw new Error('المتصفح مش بيدعم التخزين المحلي للمجسمات');
  if (!/\.(glb)$/i.test(file.name)) throw new Error('الملف لازم يبقى .glb'); if (file.size > 60e6) throw new Error('الملف أكبر من 60MB');
  await tx('readwrite', (s) => s.put(file, slot)); const m = meta(); m[slot] = { name: file.name, size: file.size, length: def.length, rotY: 0, y: 0, ...(m[slot] && m[slot].keep ? m[slot] : {}) }; setMeta(m); return m[slot];
}
export async function removeLocalModel(slot) { if (!hasIDB()) return; await tx('readwrite', (s) => s.delete(slot)); const m = meta(); delete m[slot]; setMeta(m); }
export function updateLocalModel(slot, patch) { const m = meta(); if (m[slot]) { m[slot] = { ...m[slot], ...patch, keep: true }; setMeta(m); } }
export const listLocalModels = () => meta();
// → { slot: { url: blobURL, length, rotY, y, local:true } } جاهز يتدمج في content.models
export async function localModelSlots() {
  const out = {}; if (!hasIDB()) return out; const m = meta();
  for (const [slot, info] of Object.entries(m)) { try { const blob = await tx('readonly', (s) => s.get(slot)); if (blob) out[slot] = { url: URL.createObjectURL(blob), length: info.length, rotY: info.rotY || 0, y: info.y || 0, local: true, name: info.name }; } catch (e) { /* ignore */ } }
  return out;
}
