// أنواع الحمولة وربطها بمكان الطلب (نقي، بدون DOM): صيدلية → دواء · مطعم → أكل · محل → طرد · عميل → راكب (أو اتنين).
const PHARM = /صيدل|pharm|دواء|مستشفى|عيادة/i, FOODISH = /مطعم|كشري|فطير|بيتزا|شاورما|مشويات|برجر|كافيه|كافي|حلويات|مخبز|فول|طعمية|كبدة|سوبر ماركت.*مطعم|restaurant|cafe|burger|pizza|bakery/i;

export const LOADS = {
  med: { id: 'med', glyph: '💊', icon: '💊', offer: 'طلب دواء من الصيدلية', pick: 'استلام الدواء', drop: 'تسليم الدواء', hint: 'الدواء حساس — سوق بهدوء', code: 1 },
  food: { id: 'food', glyph: '🍔', icon: '🍔', offer: 'طلب أكل جديد', pick: 'استلام الأكل', drop: 'تسليم الأكل', hint: 'الأكل بيبرد — اسرع من غير تهور', code: 2 },
  parcel: { id: 'parcel', glyph: '📦', icon: '📦', offer: 'طرد من محل', pick: 'استلام الطرد', drop: 'تسليم الطرد', hint: 'خد بالك على الطرد', code: 3 },
  person: { id: 'person', glyph: '🧍', icon: '🧍', offer: 'راكب مستني', pick: 'ركّب الراكب', drop: 'نزّل الراكب', hint: 'الراكب مرتاح مع السواقة الهادية', code: 4 },
};
export const LOAD_CODES = { 0: null, 1: 'med', 2: 'food', 3: 'parcel', 4: 'person', 5: 'person' };

// نوع الحمولة من مكان الاستلام (POI): { kind:'food'|'shop'|'place'..., sub?:'pharmacy', name }
export function classifyLoad(poi, type = 'delivery') {
  if (type === 'passenger') return 'person';
  if (!poi) return 'parcel';
  if (poi.sub === 'pharmacy' || PHARM.test(poi.name || '')) return 'med';
  if (poi.kind === 'food' || FOODISH.test(poi.name || '')) return 'food';
  return 'parcel';
}

// كود الحمولة اللي بتتبعت للاعبين التانيين: 0 مفيش · 1 دواء · 2 أكل · 3 طرد · 4 راكب · 5 راكبين
export function loadCode(load, pax = 1) { if (!load) return 0; if (load === 'person') return pax >= 2 ? 5 : 4; return LOADS[load] ? LOADS[load].code : 0; }
export function loadFromCode(code) { const l = LOAD_CODES[code | 0] || null; return { load: l, pax: code === 5 ? 2 : 1 }; }

// ألوان الدليل (العمود/الدائرة/الأيقونة) حسب الطلب والمرحلة
export const BEACON_COLORS = { pickup: 0xff7a1a, dropoff: 0x19c2a0, rider: 0x4aa8ff, patrol: 0xff4d6d, fuel: 0xffc83d };
export function beaconStyle(m) {
  if (!m) return null;
  if (m.stage === 'dropoff') return { color: BEACON_COLORS.dropoff, glyph: m.load === 'person' ? '📍' : '🏁' };
  const L = LOADS[m.load] || LOADS.parcel;
  return { color: m.load === 'person' ? BEACON_COLORS.rider : BEACON_COLORS.pickup, glyph: L.glyph };
}
