// ───────── October Rider — إعدادات عامة ─────────
export const CITY = {
  name: '6th of October City',
  // مركز الخريطة: منطقة ميدان الحصري (تقريبي). غيّره لأي نقطة تانية في أكتوبر.
  center: { lat: 29.924063, lon: 30.926437 }, // كود الموقع WWFG+JH — الأحياء الجنوبية، شارع 103 (الجراج الرئيسي)
  half: 1000, // نص ضلع الخريطة بالمتر (الخريطة 2كم × 2كم)
  cacheVer: 'v3',
  overpass: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ],
};

// الجراج الرئيسي: نقطة البداية وسط الخريطة — شارع 103 عمارة 72، الأحياء الجنوبية، 6 أكتوبر (WWFG+JH)
export const HOME = {
  lat: 29.924063, lon: 30.926437, plus: 'WWFG+JH', street: 'شارع 103', no: '72', district: 'الأحياء الجنوبية',
  name: 'الجراج الرئيسي — شارع 103', landmark: { id: 'home-elgehainy', name: 'صيدليات الجهيني — عمارة 72', image: 'assets/landmarks/elgehainy.jpg', mode: 'both' },
};

export const NET = {
  prefix: 'orider-',
  sendHz: 12,
  // لو الشبكات الموبايل مش بتوصّل بين اللاعبين: ضيف سيرفر TURN هنا
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // { urls: 'turn:YOUR_TURN_HOST:3478', username: 'user', credential: 'pass' },
  ],
};

export const VOICE = { maxDist: 160, mode: 'prox' }; // prox = قريب/بعيد، lobby = الكل يسمع الكل
