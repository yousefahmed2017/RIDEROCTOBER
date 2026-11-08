// أوضاع اللعب (نقي بدون DOM): دورية/لجنة أكتوبر + تحدي الطريق المفتوح.

// ───────────────── الدورية (لجنة أكتوبر) ─────────────────
export const PATROL_NAMES = ['ميكروباص مخالف', 'عربية بدون رخصة', 'توك توك عكس الاتجاه', 'نقل زيادة حمولة', 'ملاكي بسرعة زيادة'];
export const newPatrol = (name = PATROL_NAMES[0]) => ({ stage: 'chase', name, timeLeft: 70, close: 0, check: 0, dist: 0 });

// بيرجّع حدث: null | 'pulledover' | 'caught' | 'escaped'
export function tickPatrol(p, dt, dist, speed) {
  p.dist = dist;
  if (p.stage === 'chase') {
    p.timeLeft -= dt;
    if (dist > 420 || p.timeLeft <= 0) { p.stage = 'escaped'; return 'escaped'; }
    if (dist < 9 && speed > 3) p.close += dt; else p.close = Math.max(0, p.close - dt * 0.5);
    if (p.close > 2.2) { p.stage = 'pullover'; p.check = 0; return 'pulledover'; }
  } else if (p.stage === 'pullover') {
    if (dist > 28) { p.stage = 'chase'; p.close = 0; p.timeLeft = Math.max(p.timeLeft, 25); return null; }
    if (dist < 10 && Math.abs(speed) < 2.5) p.check += dt; else p.check = Math.max(0, p.check - dt * 0.7);
    if (p.check >= 3) { p.stage = 'caught'; return 'caught'; }
  }
  return null;
}
export const patrolReward = (level, timeLeft) => ({ money: Math.round(80 + level * 12 + timeLeft), points: Math.round(60 + level * 10 + timeLeft * 0.8) });

// ───────────────── تحدي الطريق المفتوح (Endless) ─────────────────
export const HW = { lanes: [-6, -2, 2, 6], half: 7.4, len: 2400, maxCrashes: 3 };
const pick = (a, r) => a[Math.floor(r() * a.length)];

export function newEndless(rnd = Math.random) {
  return { rnd, cars: [], score: 0, dist: 0, near: 0, combo: 0, comboT: 0, crashes: 0, over: false, wheelie: { on: false, t: 0 }, spawnT: 0, stunts: 0, lastZ: 0, started: false };
}

// bike: {x,z,speed} ، input: {wheelie:bool} ، بيرجّع قايمة أحداث
export function stepEndless(st, bike, dt, input = {}) {
  const ev = [];
  if (st.over) return ev;
  if (!st.started) { st.started = true; st.lastZ = bike.z; }
  // مسافة
  const adv = Math.max(0, st.lastZ - bike.z); st.lastZ = bike.z; st.dist += adv; st.score += adv * 0.1;
  // ظهور عربيات قدام
  st.spawnT -= dt;
  if (st.spawnT <= 0 && st.cars.length < 18) {
    st.spawnT = 0.7 + st.rnd() * 0.9;
    const lane = Math.floor(st.rnd() * HW.lanes.length), x = HW.lanes[lane], oncoming = x < 0, dz = 220 + st.rnd() * 140, z = bike.z - dz;
    const busy = st.cars.some((c) => c.lane === lane && Math.abs(c.z - z) < 38);
    if (!busy) st.cars.push({ lane, x, z, v: (oncoming ? 1 : -1) * (7 + st.rnd() * 7), kind: pick(['car', 'car', 'car', 'tuktuk', 'bus'], st.rnd), color: Math.floor(st.rnd() * 6), minLat: 99, passed: false, hit: false });
  }
  // حركة + تصادم + قرب شديد
  for (const c of st.cars) {
    c.z += c.v * dt;
    const dx = Math.abs(c.x - bike.x), dz = Math.abs(c.z - bike.z), len = c.kind === 'bus' ? 3.4 : c.kind === 'tuktuk' ? 2.0 : 2.7;
    if (!c.hit && dx < 1.45 && dz < len + 0.8) { c.hit = true; st.crashes++; st.combo = 0; st.score = Math.max(0, st.score - 40); ev.push({ t: 'crash', car: c }); if (st.crashes >= HW.maxCrashes) { st.over = true; ev.push({ t: 'over' }); } }
    if (dz < 5) c.minLat = Math.min(c.minLat, dx);
    const behind = c.v > 0 ? c.z > bike.z + 3 : c.z > bike.z + 3; // العربية عدّت من جنبنا
    if (!c.passed && behind) {
      c.passed = true;
      if (!c.hit && c.minLat < 2.5 && Math.abs(bike.speed) > 14) { st.near++; st.combo++; st.comboT = 4; const bonus = 25 * Math.min(5, st.combo); st.score += bonus; ev.push({ t: 'near', bonus, combo: st.combo }); }
    }
  }
  st.cars = st.cars.filter((c) => c.z < bike.z + 60 && c.z > bike.z - 520);
  st.comboT -= dt; if (st.comboT <= 0) st.combo = 0;
  // ويلي
  const w = st.wheelie;
  if (input.wheelie && Math.abs(bike.speed) > 12) {
    if (!w.on) { w.on = true; w.t = 0; }
    w.t += dt; st.score += 18 * dt;
    if (w.t > 5) { w.on = false; w.t = 0; st.crashes++; st.combo = 0; ev.push({ t: 'wheelieFall' }); if (st.crashes >= HW.maxCrashes) { st.over = true; ev.push({ t: 'over' }); } }
  } else if (w.on) {
    if (w.t >= 1.5) { st.stunts++; const b = Math.round(60 + w.t * 20); st.score += b; ev.push({ t: 'stunt', bonus: b, secs: w.t }); }
    w.on = false; w.t = 0;
  }
  return ev;
}
export const endlessReward = (st) => ({ money: Math.round(st.score * 0.35), points: Math.round(st.score * 0.5) });
