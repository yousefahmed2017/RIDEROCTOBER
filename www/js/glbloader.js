// تحميل مجسمات GLB: بيدعم الضغط (Draco / Meshopt / KTX2) + رسائل خطأ واضحة بدل ما الفشل يتبلع بصمت.
// فك ضغط Draco/KTX2 بيتحمّل من CDN وقت الحاجة بس (محتاج إنترنت أول مرة)؛ Meshopt مدمج في الملف.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const LIBS = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/';
let draco = null, ktx2 = null, onError = null;
export const glbStatus = {}; // slot → { ok, msg }  (بتتقرا في لوحة الإدارة)
export const setGLBErrorHandler = (fn) => { onError = fn; };
export function setGLBRenderer(renderer) { try { ktx2 = new KTX2Loader().setTranscoderPath(LIBS + 'basis/').detectSupport(renderer); } catch (e) { ktx2 = null; } }

// بيحوّل خطأ تحميل لسبب مفهوم بالعربي
export function explainGLB(e) {
  const m = String((e && (e.message || e.target && e.target.statusText)) || e || '');
  if (/draco/i.test(m)) return 'الموديل مضغوط بـ Draco وفك الضغط ما اشتغلش — اتأكد من النت أول مرة، أو اضغطه تاني بدون Draco';
  if (/meshopt/i.test(m)) return 'الموديل مضغوط بـ Meshopt وفك الضغط فشل';
  if (/ktx2|basisu|basis/i.test(m)) return 'الخامات بصيغة KTX2 ومش مدعومة على الجهاز ده — صدّر الموديل بخامات PNG/JPG';
  if (/Unexpected token|JSON|<!DOCTYPE|not valid/i.test(m)) return 'اللينك مش بيرجّع ملف GLB (جاي صفحة/خطأ بدله) — اتأكد من الرابط أو رفع الملف';
  if (/404|Not Found|Failed to fetch|NetworkError|Load failed/i.test(m)) return 'الملف مش موجود أو الرابط غلط (404) / مفيش اتصال';
  if (/magic|header|invalid glb|Unsupported glTF|version/i.test(m)) return 'الملف مش GLB سليم أو تالف — صدّره تاني بصيغة glb (glTF Binary)';
  if (/صفر|فاضي/.test(m)) return m;
  return 'سبب غير معروف: ' + m.slice(0, 110);
}
export function reportGLB(slot, e, ok = false) {
  if (ok) { glbStatus[slot] = { ok: true, msg: 'متحمّل ✔' }; return; }
  const msg = explainGLB(e); glbStatus[slot] = { ok: false, msg }; console.error('[GLB]', slot, e);
  try { onError && onError(slot, msg); } catch (er) { /* ignore */ }
}
export function makeGLTFLoader() {
  const l = new GLTFLoader();
  if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath(LIBS + 'draco/gltf/'); }
  l.setDRACOLoader(draco); l.setMeshoptDecoder(MeshoptDecoder); if (ktx2) l.setKTX2Loader(ktx2);
  return l;
}
