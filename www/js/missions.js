// نظام الميشنز والصعوبة التصاعدية (نقي بدون DOM)
import { classifyLoad } from './loads.js';
export const HOLD_TIME = 1.5; // ثواني وقوف داخل دايرة الهدف (بسرعة هادية) لحد ما الاستلام/التسليم يتم — فيها حركات الشخصيات والتأثيرات
export const NAMES = ['أحمد', 'محمد', 'منى', 'سارة', 'يوسف', 'هبة', 'كريم', 'نور', 'عمر', 'ريم', 'مصطفى', 'دينا'];
export const COMMENTS = {
  5: ['تحفة! الأكل وصل سخن، تسلم يا كابتن 🔥', 'أسرع دليفري في أكتوبر! 5 نجوم', 'سواقة محترمة وهادية، شكراً'],
  4: ['كويس جداً، تسلم إيدك', 'تمام، الطلب وصل بحالة كويسة', 'شغل نضيف 👌'],
  3: ['تمام بس اتأخرت شوية', 'الطلب وصل.. بس كان ممكن أحسن', 'عادي'],
  2: ['الأكل برد.. مش كده يا كابتن', 'السواقة كانت متهورة شوية', 'مش حلو'],
  1: ['اتأخرت قوي وحالة الطلب وحشة!!', 'مش هطلب منك تاني 😡'],
};
const pick = (a, r) => a[Math.floor(r() * a.length)];
let counter = 0;

export const levelFor = (completed) => Math.min(30, 1 + Math.floor(completed / 3));
export const trafficFor = (level) => Math.min(60, 12 + level * 3);

function snap(roads, c) {
  const n = roads.nearest(c.x, c.z, 90);
  return n ? { ...c, x: n.x, z: n.z } : c;
}

// ctx: { completed, pos:{x,z}, pois, roads:RoadIndex, rnd }
export function makeOffer(ctx) {
  const { completed, pos, pois, roads, rnd } = ctx;
  const level = levelFor(completed);
  const minD = 150 + level * 40, maxD = Math.min(2200, 350 + level * 90);
  const type = level >= 2 && rnd() < 0.3 ? 'passenger' : 'delivery';
  const shops = pois.filter((p) => p.kind === 'food' || p.kind === 'shop' || p.sub === 'pharmacy');
  const rider = () => { const r = roads.randomPoint(rnd, 1); return { x: r.x, z: r.z, name: 'راكب: ' + pick(NAMES, rnd), kind: 'rider' }; };
  const home = () => { const r = roads.randomPoint(rnd, 1); return { x: r.x, z: r.z, name: 'عميل: ' + pick(NAMES, rnd), kind: 'home' }; };

  let pickup = null, bestP = null;
  for (let k = 0; k < 60 && !pickup; k++) {
    const c = type === 'delivery' && shops.length && rnd() < 0.85 ? pick(shops, rnd) : rider();
    const d = Math.hypot(c.x - pos.x, c.z - pos.z);
    if (!bestP || d < bestP.d) bestP = { c, d };
    if (d > 60 && d < 650) pickup = snap(roads, c);
  }
  if (!pickup) pickup = snap(roads, bestP.c);

  let dropoff = null, best = null;
  const mid = (minD + maxD) / 2;
  for (let k = 0; k < 80 && !dropoff; k++) {
    const c = rnd() < 0.3 && pois.length ? pick(pois, rnd) : type === 'passenger' && rnd() < 0.5 ? pick(pois.length ? pois : [home()], rnd) : home();
    if (c === pickup) continue;
    const d = Math.hypot(c.x - pickup.x, c.z - pickup.z);
    if (!best || Math.abs(d - mid) < Math.abs(best.d - mid)) best = { c, d };
    if (d >= minD && d <= maxD) dropoff = snap(roads, c);
  }
  if (!dropoff) dropoff = snap(roads, best.c);

  const load = classifyLoad(pickup, type), pax = type === 'passenger' && level >= 6 && rnd() < 0.35 ? 2 : 1; // مستوى 6+: أحيانًا راكبين مع بعض
  const dist = Math.hypot(dropoff.x - pickup.x, dropoff.z - pickup.z);
  const approach = Math.hypot(pickup.x - pos.x, pickup.z - pos.z);
  const slack = Math.max(1.05, 1.6 - level * 0.03);
  const limit = Math.round(Math.max(35, ((approach * 1.4) / 11) * 1.3 + ((dist * 1.4) / 11) * slack) + HOLD_TIME * 2);
  const reward = Math.round(40 + dist * 0.12 + level * 8 + (type === 'passenger' ? 15 : 0) + (pax > 1 ? 20 : 0));
  return {
    id: ++counter, type, load, pax, level, pickup, dropoff, dist: Math.round(dist), limit, reward, slack,
    stage: 'offer', timeLeft: limit, elapsed: 0, quality: 100, hits: 0, falls: 0, hold: 0, distToTarget: approach,
  };
}

// الوقت بيتحسب من مكان الموتوسيكل وقت القبول (مش وقت ظهور الطلب في القائمة)
export function retimeOffer(o, pos) {
  const approach = Math.hypot(o.pickup.x - pos.x, o.pickup.z - pos.z);
  o.distToTarget = approach;
  o.limit = Math.round(Math.max(35, ((approach * 1.4) / 11) * 1.3 + ((o.dist * 1.4) / 11) * o.slack) + HOLD_TIME * 2); o.timeLeft = o.limit;
  return o;
}
export const startMission = (m) => { m.stage = 'pickup'; return m; };

// يرجّع: null | 'slow' | 'pickedup' | 'done' | 'fail'
export function tickMission(m, dt, bike, risk = 0) {
  if (m.stage !== 'pickup' && m.stage !== 'dropoff') return null;
  m.timeLeft -= dt; m.elapsed += dt;
  if (m.stage === 'dropoff') {
    m.quality = Math.max(0, m.quality - dt * (m.type === 'delivery' ? 0.22 : 0.05));
    if (risk > 0.6) m.quality = Math.max(0, m.quality - dt * (m.type === 'passenger' ? 7 : 2));
  }
  if (m.timeLeft <= 0) { m.stage = 'failed'; return 'fail'; }
  const tgt = m.stage === 'pickup' ? m.pickup : m.dropoff;
  const d = Math.hypot(bike.x - tgt.x, bike.z - tgt.z);
  m.distToTarget = d;
  if (d < 12) {
    if (Math.abs(bike.speed) < 9) {
      m.hold += dt;
      if (m.hold >= HOLD_TIME) {
        m.hold = 0;
        if (m.stage === 'pickup') { m.stage = 'dropoff'; return 'pickedup'; }
        m.stage = 'done'; return 'done';
      }
    } else { m.hold = 0; return 'slow'; }
  } else m.hold = 0;
  return null;
}

export function hitMission(m, kind) {
  if (!m || (m.stage !== 'pickup' && m.stage !== 'dropoff')) return;
  if (kind === 'fall') { m.falls++; if (m.stage === 'dropoff') m.quality = Math.max(0, m.quality - 15); }
  else { m.hits++; if (m.stage === 'dropoff') m.quality = Math.max(0, m.quality - 8); }
}

export function scoreMission(m, streak = 0, rnd = Math.random) {
  const ratio = Math.max(0, m.timeLeft) / m.limit;
  let stars = 5;
  if (ratio < 0.15) stars--;
  if (m.quality < 60) stars--;
  if (m.quality < 35) stars--;
  if (m.hits + m.falls >= 3) stars--;
  stars = Math.max(1, Math.min(5, stars));
  const timeBonus = Math.round(m.reward * 0.5 * ratio);
  const mult = 1 + Math.min(streak, 10) * 0.1;
  const points = Math.round((m.reward + timeBonus) * mult * (0.6 + 0.1 * stars));
  const tip = Math.round(m.reward * (stars === 5 ? 0.2 : stars === 4 ? 0.1 : 0));
  return { stars, points, tip, timeBonus, mult, total: points + tip, comment: pick(COMMENTS[stars], rnd) };
}
