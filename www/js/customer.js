// زبون بيتكلم: موقف عند التسليم + اختيارات بتغيّر البقشيش والتقييم (نقي بدون DOM)
const pick = (a, r) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COMPLAIN = {
  food: ['الأكل برد يا كابتن! ده مش معقول.', 'ده الأكل وصل ساقع! اتأخرت ليه؟'],
  med: ['الدوا اتأخر وأنا كنت محتاجه بسرعة!', 'اتأخرت عليا قوي يا كابتن.'],
  parcel: ['الطرد شكله اتهز في الطريق!', 'إيه ده؟ الطرد مبهدل!'],
  person: ['السواقة كانت سريعة وأنا خايف!', 'هدّي شوية يا كابتن، قلبي وقع!'],
};
const TIPTALK = ['الخدمة تحفة! تحب تاخد بقشيش؟', 'شغلك نضيف يا كابتن، خد دي حلاوة.', 'تسلم! معايا فكة، تاخدها؟'];

export function pickScenario(m, res, rnd = Math.random) {
  const late = m.timeLeft / m.limit < 0.2, bad = m.quality < 75 || m.hits + m.falls >= 2;
  if (late || bad) {
    const load = COMPLAIN[m.load] ? m.load : 'parcel';
    return { kind: 'complaint', line: pick(COMPLAIN[load], rnd), options: [
      { id: 'sorry', label: 'اعتذر بأدب' }, { id: 'defend', label: 'دافع عن نفسك' }, { id: 'discount', label: 'سيب البقشيش' }] };
  }
  if (res.tip > 0 && rnd() < 0.35) {
    return { kind: 'tip', line: pick(TIPTALK, rnd), options: [
      { id: 'take', label: 'خد البقشيش' }, { id: 'ask', label: 'اطلب زيادة' }, { id: 'refuse', label: 'ارفض بأدب' }] };
  }
  return null;
}

// بيرجّع نسخة جديدة من res + رد الزبون ({text, good})
export function resolveChoice(sc, id, res, rnd = Math.random) {
  let tipMul = 1, dStars = 0, text = '', good = true;
  if (sc.kind === 'complaint') {
    if (id === 'sorry') { if (rnd() < 0.75) { tipMul = 0.5; text = 'ماشي، حصل خير. شكراً على ذوقك.'; } else { tipMul = 0; dStars = -1; text = 'الاعتذار مش هيرجّع اللي حصل!'; good = false; } }
    else if (id === 'defend') { if (rnd() < 0.35) { text = 'عندك حق، الشارع زحمة النهاردة.'; } else { tipMul = 0; dStars = -1; text = 'مش عاجبني ردك ده خالص!'; good = false; } }
    else { tipMul = 0; text = 'تمام، كده خلصنا. مع السلامة.'; }
  } else {
    if (id === 'take') { text = 'تسلم يا غالي!'; }
    else if (id === 'ask') { if (rnd() < 0.5) { tipMul = 2; text = 'خد كمان! أنت تستاهل.'; } else { tipMul = 0; text = 'لا كده كتير، كفاية!'; good = false; } }
    else { tipMul = 0; dStars = 1; text = 'أخلاق عالية! هديك 5 نجوم.'; }
  }
  const stars = clamp(res.stars + dStars, 1, 5), tip = Math.round(res.tip * tipMul);
  const points = Math.round(res.points * ((0.6 + 0.1 * stars) / (0.6 + 0.1 * res.stars)));
  return { res: { ...res, stars, tip, points, total: points + tip, comment: text }, text, good };
}
