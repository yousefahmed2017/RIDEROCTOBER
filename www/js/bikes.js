// موتوسيكلات المتجر + التطويرات + البنزين + الفلوس (نقي بدون DOM).
import { BIKE } from './physics.js';

export const FUEL_PRICE = 12;   // جنيه / لتر
export const TOW_FINE = 500;    // غرامة السحب لو البنزين خلص
export const START_MONEY = 300;
// استهلاك واقعي × BURN_MULT: التانك الكامل بيكفي حوالي 40–60 كم في اللعبة (الواقع: 240–360 كم)،
// فالمحطات بتفرق بس مش بتقطع عليك الطريق في نص الطلب.
export const BURN_MULT = 6;
export const MIN_TOW_FUEL = 3;  // لترات بعد السحب

export const BIKES = {
  // المركبة الوحيدة المتاحة للاعب: نينجا (Bike Ninja). باقي الأنواع (سكوتر/125/سبورت/كروزر) متعطّلة من اللعبة بس كودها موجود.
  ninja:    { id: 'ninja',    name: 'نينجا',          price: 0,    maxSpeed: 46, accel: 15,   brake: 24, maxSteer: 0.52, tank: 14, burn: 0.040, style: 'ninja',    blurb: 'سبورت فيرنج: سريعة وثابتة وبتلف بدقة.' },
  scooter:  { id: 'scooter',  name: 'سكوتر',          price: 0,    maxSpeed: 26, accel: 8,    brake: 15, maxSteer: 0.70, tank: 6,  burn: 0.025, style: 'scooter',  blurb: 'خفيف وسهل في اللفّ. بداية كل كابتن.' },
  standard: { id: 'standard', name: 'موتوسيكل 125',   price: 1200, maxSpeed: 32, accel: 10,   brake: 18, maxSteer: 0.62, tank: 11, burn: 0.030, style: 'standard', blurb: 'متوازن: سرعة معقولة وتانك كويس.' },
  sport:    { id: 'sport',    name: 'سبورت 250',      price: 3500, maxSpeed: 42, accel: 14,   brake: 22, maxSteer: 0.55, tank: 14, burn: 0.040, style: 'sport',    blurb: 'سريع جدًا. بياكل بنزين ولفّاته محتاجة إيد.' },
  cruiser:  { id: 'cruiser',  name: 'كروزر',          price: 6000, maxSpeed: 38, accel: 9.5,  brake: 20, maxSteer: 0.50, tank: 17, burn: 0.050, style: 'cruiser',  blurb: 'تانك كبير وثبات على الطريق الطويل.' },
};
export const ONLY_BIKE = 'ninja';
export const BIKE_ORDER = [ONLY_BIKE]; // المتاح للاعب فقط
// أي رقم موتوسيكل تاني (من حفظ قديم أو لاعب أونلاين) بيتحوّل لنينجا
export const resolveBikeId = (id) => (BIKE_ORDER.includes(id) ? id : ONLY_BIKE);
export function normalizeBike(p) { p.bike = ONLY_BIKE; p.owned = { ...(p.owned || {}), [ONLY_BIKE]: true }; return p; }

export const UPGRADES = {
  engine: { id: 'engine', name: 'تطوير المحرك', icon: '⚙️', price: [400, 900, 1800], blurb: '+ سرعة قصوى وتسارع' },
  brakes: { id: 'brakes', name: 'تطوير الفرامل', icon: '🛑', price: [300, 700, 1400], blurb: '+ قوة الفرامل' },
  tank:   { id: 'tank',   name: 'تانك أكبر',     icon: '⛽', price: [350, 800, 1500], blurb: '+ سعة البنزين' },
};
export const UPGRADE_ORDER = ['engine', 'brakes', 'tank'];

const lvl = (p, k) => (p.upg && p.upg[k]) || 0;
export const currentBike = (p) => BIKES[resolveBikeId(p.bike)];
export const tankSize = (p) => currentBike(p).tank * (1 + 0.2 * lvl(p, 'tank'));

// باراميترات الفيزياء للموتوسيكل الحالي بعد التطويرات
export function bikeParams(p) {
  const b = currentBike(p), e = lvl(p, 'engine'), br = lvl(p, 'brakes');
  return { ...BIKE, maxSpeed: b.maxSpeed + 2.5 * e, accel: (b.accel + 1.1 * e) * 1.3, brake: (b.brake + 2.2 * br) * 1.1, maxSteer: b.maxSteer, assist: p.settings ? +p.settings.assist || 0 : 1 };
}

export function canBuy(p, id) { const b = BIKES[id]; return BIKE_ORDER.includes(id) && !!b && !(p.owned && p.owned[id]) && p.money >= b.price; }
export function buyBike(p, id) {
  if (!canBuy(p, id)) return false;
  p.money -= BIKES[id].price; p.owned = { ...(p.owned || {}), [id]: true }; return true;
}
export function selectBike(p, id) {
  if (!BIKE_ORDER.includes(id) || !(p.owned && p.owned[id])) return false;
  p.bike = id; p.fuel = Math.min(p.fuel, tankSize(p)); return true;
}
export function upgradePrice(p, k) { const l = lvl(p, k), U = UPGRADES[k]; return l >= U.price.length ? null : U.price[l]; }
export function buyUpgrade(p, k) {
  const price = upgradePrice(p, k); if (price == null || p.money < price) return false;
  p.money -= price; p.upg = { ...(p.upg || {}), [k]: lvl(p, k) + 1 }; return true;
}

// استهلاك البنزين: لتر/كم حقيقي × BURN_MULT، بيزيد شوية مع الغاز، وفيه استهلاك بسيط وهو واقف والموتور شغّال (لترات)
export function burnFuel(fuel, speed, throttle, dt, burnPerKm) {
  const km = (Math.abs(speed) * dt) / 1000;
  return Math.max(0, fuel - km * burnPerKm * BURN_MULT * (0.8 + 0.4 * throttle) - 0.0005 * dt);
}
// المدى المتبقي بالكيلومتر بالاستهلاك المتوسط
export const rangeKm = (fuel, burnPerKm) => Math.max(0, fuel) / (burnPerKm * BURN_MULT * 1.0);
// تعبئة في محطة: بتشتري لترات بالفلوس لحد التانك ما يتملي (maxL = أقصى كمية في الخطوة دي)
export function refuelStep(p, dt, rate = 2.0, maxL = Infinity) {
  const room = tankSize(p) - p.fuel; if (room <= 0.01) return { liters: 0, cost: 0, full: true };
  const L = Math.min(room, rate * dt, p.money / FUEL_PRICE, maxL); if (L <= 0) return { liters: 0, cost: 0, broke: p.money / FUEL_PRICE <= 0 };
  p.fuel += L; p.money -= L * FUEL_PRICE; return { liters: L, cost: L * FUEL_PRICE };
}
// هدف التعبئة المختار عند الطلمبة → اللترات المتبقية: { kind:'full' } | { kind:'liters', v } | { kind:'money', v }
export function pumpWant(p, target, filled = 0, spent = 0) {
  const room = Math.max(0, tankSize(p) - p.fuel); if (!target || target.kind === 'full') return room;
  if (target.kind === 'liters') return Math.max(0, Math.min(room, target.v - filled));
  if (target.kind === 'money') return Math.max(0, Math.min(room, (target.v - spent) / FUEL_PRICE));
  return room;
}
export function towFine(money) { return Math.min(money, TOW_FINE); }
export function nearestStation(stations, x, z) {
  let best = null; for (const s of stations) { const d = Math.hypot(s.x - x, s.z - z); if (!best || d < best.d) best = { s, d }; } return best;
}
