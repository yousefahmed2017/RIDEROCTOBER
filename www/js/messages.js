// كتالوج رسائل اللعب (التوست اللي بيظهر تحت بانل الطلبات) + إعدادات الإدارة ليها.
// كل رسالة ليها مفتاح ثابت ونص افتراضي؛ الإدارة تقدر تغيّر النص/النوع/المدة أو توقف أي رسالة من تبويب «💬 الرسائل».
// المتغيرات داخل النص بتتكتب {n} {name}… وبتتبدّل وقت العرض.
export const GROUPS = {
  crash: '💥 التصادم والوقوع',
  mission: '📦 الطلبات',
  fuel: '⛽ البنزين',
  patrol: '👮 لجنة أكتوبر',
  endless: '🏁 تحدي الطريق',
  room: '👥 الغرفة والشبكة',
  voice: '🎙️ الفويس',
  race: '🏎️ سباق الشارع',
  customer: '🗣️ الزبون',
  misc: '🧭 رسائل تانية',
};
// [المجموعة، الاسم في الإدارة، النص الافتراضي، النوع الافتراضي (''|'good'|'bad')، المتغيرات المتاحة]
export const MSGS = {
  hitPed: ['crash', 'خبط مشاة', 'خبطت واحد ماشي! خلّي بالك من المشاة 🚶', 'bad'],
  hitCar: ['crash', 'خبط عربية', 'اتخبطت في عربية!', 'bad'],
  dismount: ['misc', 'نزلت من الموتوسيكل', 'نزلت من الموتوسيكل 🚶 — اضغط F (أو زر الركوب) عشان تركب تاني', ''],
  mount: ['misc', 'ركبت الموتوسيكل', 'ركبت الموتوسيكل 🏍️', 'good'],
  farFromBike: ['misc', 'بعيد عن الموتوسيكل', 'قرّب من الموتوسيكل عشان تركب!', 'bad'],
  mustStop: ['misc', 'لازم توقف قبل النزول', 'وقّف الموتوسيكل الأول عشان تنزل!', 'bad'],
  hitBuilding: ['crash', 'خبط مبنى', 'خبطت في مبنى!', 'bad'],
  fall: ['crash', 'وقوع في اللفّ', 'وقعت! خفّف السرعة في اللفّ', 'bad'],
  wheelieFall: ['crash', 'فقد الاتزان من الويلي', 'فقدت الاتزان من الويلي الطويل! 😵', 'bad'],
  offroad: ['crash', 'رجوع للشارع من الرمل', 'رجع للشارع — الرمل بيبطّأك', ''],
  unstick: ['crash', 'إعادة اللاعب للشارع', 'رجّعتك على الشارع', 'good'],

  acceptDelivery: ['mission', 'قبول طلب توصيل', 'روح استلم الطلب!', 'good'],
  acceptRide: ['mission', 'قبول راكب', 'روح للراكب!', 'good'],
  pickedDelivery: ['mission', 'استلام الأكل', 'استلمت الأكل! وصّله سخن 🔥', 'good'],
  pickedRide: ['mission', 'ركوب الراكب', 'الراكب ركب! سوق بهدوء', 'good'],
  cancelled: ['mission', 'إلغاء الطلب', 'الطلب اتلغى', 'bad'],

  lowFuel: ['fuel', 'البنزين قرب يخلص', 'البنزين قرب يخلص ⛽ — اتبع السهم لأقرب محطة', 'bad', ['n']],
  refueled: ['fuel', 'انتهاء التعبئة', 'خلصت التعبئة — دفعت {n} جنيه ✔', 'good', ['n']],
  towed: ['fuel', 'سحب الونش', 'الونش سحبك لأقرب محطة — غرامة {n} جنيه', 'bad', ['n']],
  garageFar: ['fuel', 'الجراج بعيد', 'روح جراجك الأول 🏠 (العلامة الدهبي على الخريطة)', 'bad'],

  patrolStart: ['patrol', 'بدء بلاغ', 'بلاغ! {name} هرب — الحقه! 👮', 'bad', ['name']],
  pulledOver: ['patrol', 'المخالف وقف', 'وقف! قف جنبه (أقل من 10م) وخليك ثابت 3 ثواني 📋', 'good'],
  escaped: ['patrol', 'المخالف هرب', 'المخالف هرب منك!', 'bad'],
  modePatrol: ['patrol', 'دخول الوضع', 'لجنة أكتوبر: طارد المخالفين ووقّفهم', 'good'],

  endlessCrash: ['endless', 'اصطدام', 'خبطة! باقي {n} ❤', 'bad', ['n']],
  endlessNear: ['endless', 'قرّبت من عربية', 'قرّبت منه! +{bonus} ×{combo}', 'good', ['bonus', 'combo']],
  endlessStunt: ['endless', 'ويلي', 'ويلي {secs} ثانية! +{bonus} 🏍️', 'good', ['secs', 'bonus']],
  modeRace: ['race', 'دخول السباق', 'سباق الشارع: لفّتين — عدّي كل النقط بالترتيب. نفس المسار لكل اللاعبين!', 'good'],
  raceCount: ['race', 'العد التنازلي', '{n}…', '', ['n']],
  raceGo: ['race', 'انطلاق', 'انطلق! 🏁', 'good'],
  raceCp: ['race', 'عدّيت نقطة', 'نقطة {i} من {n} ✔', 'good', ['i', 'n']],
  raceLap: ['race', 'لفّة جديدة', 'اللفّة {lap} من {laps}', 'good', ['lap', 'laps']],
  raceFinish: ['race', 'نهاية السباق', 'خلّصت السباق في {time}!', 'good', ['time']],
  raceBest: ['race', 'رقم قياسي', 'رقم قياسي جديد: {time} 🏆', 'good', ['time']],
  racePeer: ['race', 'لاعب خلّص السباق', '{name} خلّص السباق في {time}', '', ['name', 'time']],
  customerGood: ['customer', 'رد الزبون كويس', '{text}', 'good', ['text']],
  customerBad: ['customer', 'رد الزبون وحش', '{text}', 'bad', ['text']],
  modeEndless: ['endless', 'دخول الوضع', 'تحدي الطريق: 3 فرص — قرّب من العربيات واعمل ويلي!', 'good'],

  join: ['room', 'لاعب دخل', '{name} دخل الغرفة', 'good', ['name']],
  leave: ['room', 'لاعب خرج', '{name} خرج', '', ['name']],
  netError: ['room', 'مشكلة في الشبكة', 'مشكلة في الشبكة: {type}', 'bad', ['type']],
  codeCopied: ['room', 'نسخ كود الغرفة', 'الكود اتنسخ: {code}', 'good', ['code']],

  voiceNoRoom: ['voice', 'الفويس برا الغرفة', 'الفويس شغال جوه الغرف بس — اعمل غرفة أو ادخل بكود', 'bad'],
  micOn: ['voice', 'المايك اتفتح', 'المايك مفتوح — صحابك سامعينك', 'good'],
  micUnmuted: ['voice', 'المايك رجع', 'المايك مفتوح', 'good'],
  micMuted: ['voice', 'المايك اتكتم', 'المايك مكتوم', 'bad'],
  micFail: ['voice', 'فشل فتح المايك', 'مقدرتش أفتح المايك — لازم إذن + HTTPS', 'bad'],
  voiceProx: ['voice', 'صوت بالقرب', 'الصوت بالقرب: بتسمع اللي حواليك', ''],
  voiceRoom: ['voice', 'صوت الغرفة', 'صوت الغرفة: الكل بيسمع الكل', ''],
};
for (const k of Object.keys(MSGS)) { const m = MSGS[k]; MSGS[k] = { group: m[0], label: m[1], text: m[2], cls: m[3] || '', vars: m[4] || [] }; }

export const POSITIONS = { under: 'تحت بانل الطلبات (الافتراضي)', top: 'أعلى الشاشة', mid: 'وسط الشاشة', bottom: 'أسفل الشاشة' };
export const CLASSES = { '': 'عادي', good: 'إيجابي (أخضر)', bad: 'تحذير (أحمر)' };
export const DEFAULTS = { on: true, ms: 3000, max: 4, pos: 'under' };
// الكلام (Text-to-Speech): بينطق الرسائل بصوت عربي. الإدارة تتحكم: تشغيل عام، السرعة/النبرة/الصوت، وتشغيل أو تعديل نص النطق لكل رسالة.
export const SPEECH_DEFAULTS = { on: true, rate: 1, pitch: 1, vol: 1, lang: 'ar-EG' };
export const LANGS = { 'ar-EG': 'عربي مصري', 'ar-SA': 'عربي سعودي (فصحى)', ar: 'عربي (أي صوت متاح)' };
// الافتراضي: بينطق التحذيرات (bad) ورسائل الطلبات واللجنة؛ الباقي صامت لحد ما الإدارة تشغّله
export const speakDefault = (key) => { const m = MSGS[key]; return !!m && (m.cls === 'bad' || m.group === 'mission' || m.group === 'patrol'); };
export const spokenFrom = (t) => String(t).replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B50\u2B06\u2B07\uFE0F\u2714\u2764]/gu, ' ').replace(/[—–]/g, '،').replace(/\s+/g, ' ').trim();

const clampN = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const fill = (t, vars) => String(t).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : ''));

// إعدادات الإدارة بعد التنقية (بتتستخدم في اللعبة وفي السيرفر)
export function normalizeMessages(inp) {
  const src = inp && typeof inp === 'object' ? inp : {}, sp = src.speech && typeof src.speech === 'object' ? src.speech : {}, out = { speech: { on: sp.on !== false, rate: clampN(sp.rate, 0.5, 1.6, 1), pitch: clampN(sp.pitch, 0.5, 1.6, 1), vol: clampN(sp.vol, 0, 1, 1), lang: LANGS[sp.lang] ? sp.lang : SPEECH_DEFAULTS.lang }, on: src.on !== false, ms: clampN(src.ms, 800, 15000, DEFAULTS.ms), max: Math.round(clampN(src.max, 1, 8, DEFAULTS.max)), pos: POSITIONS[src.pos] ? src.pos : DEFAULTS.pos, items: {} };
  for (const [k, v] of Object.entries(src.items || {})) {
    if (!MSGS[k] || !v || typeof v !== 'object') continue;
    const it = {}; if (v.on === false) it.on = false;
    if (typeof v.text === 'string' && v.text.trim() && v.text.trim() !== MSGS[k].text) it.text = v.text.trim().slice(0, 140);
    if (v.cls === '' || v.cls === 'good' || v.cls === 'bad') { if (v.cls !== MSGS[k].cls) it.cls = v.cls; }
    if (typeof v.speak === 'boolean' && v.speak !== speakDefault(k)) it.speak = v.speak;
    if (typeof v.say === 'string' && v.say.trim()) it.say = v.say.trim().slice(0, 140);
    if (v.ms != null && v.ms !== '') it.ms = clampN(v.ms, 800, 15000, DEFAULTS.ms);
    if (Object.keys(it).length) out.items[k] = it;
  }
  return out;
}

// بيرجّع { text, cls, ms } أو null لو الرسالة موقوفة
export function resolveMessage(cfg, key, vars) {
  const base = MSGS[key]; if (!base) return null;
  const c = normalizeMessages(cfg), it = c.items[key] || {};
  if (!c.on || it.on === false) return null;
  const text = fill(it.text != null ? it.text : base.text, vars);
  const speak = it.speak != null ? it.speak : speakDefault(key), sayTxt = it.say ? fill(it.say, vars) : spokenFrom(text);
  return text ? { text, cls: it.cls != null ? it.cls : base.cls, ms: it.ms != null ? it.ms : c.ms, speak: c.speech.on && speak ? sayTxt : '', speech: c.speech } : null;
}
