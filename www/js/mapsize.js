// حجم الخريطة: بيتحدد قبل ما اللعبة تبدأ (يتحفظ على الجهاز) — لازم يتحمّل أول module في game.js.
import { CITY } from './config.js';
export const MAP_SIZES = { s: { half: 1000, label: 'صغيرة 2 كم' }, m: { half: 1750, label: 'متوسطة 3.5 كم' }, l: { half: 2500, label: 'كبيرة 5 كم' }, xl: { half: 3500, label: 'ضخمة 7 كم' }, xxl: { half: 6000, label: 'كل أكتوبر والشيخ زايد 12 كم (تقيلة)' } };
const KEY = 'orider-mapsize';
export function currentMapSize() { try { const k = localStorage.getItem(KEY); return MAP_SIZES[k] ? k : 's'; } catch (e) { return 's'; } }
const k0 = currentMapSize();
if (k0 !== 's') { CITY.half = MAP_SIZES[k0].half; CITY.cacheVer = CITY.cacheVer + '-h' + CITY.half; }
export function setMapSize(k) { try { localStorage.setItem(KEY, MAP_SIZES[k] ? k : 's'); } catch (e) { /* ignore */ } location.reload(); }
