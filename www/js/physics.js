// فيزياء موتوسيكل نص-واقعية (نموذج الدراجة + ميل + نظام اتزان). ملف نقي بدون DOM.
export const BIKE = {
  maxSpeed: 34,      // م/ث (~122 كم/س)
  accel: 13,
  brake: 19,
  drag: 0.02,
  rolling: 0.4,
  offRoadDrag: 0.09,
  wheelbase: 1.35,
  maxSteer: 0.62,
  leanMax: 0.65,
  reverseMax: 4,
  assist: 0, // 0 = عادي، 1 = قيادة سهلة (مساعد مسار + اتزان متسامح + تخفيف تلقائي في اللفّات)
};

export function newBike(x = 0, z = 0, heading = 0) {
  return { x, z, heading, speed: 0, steerAngle: 0, lean: 0, yawRate: 0, wobble: 0, risk: 0, fell: false, fallTimer: 0 };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// inp: { throttle 0..1, brake 0..1, steer -1..1, reverse?: bool }
export function stepBike(b, inp, dt, onRoad = true, P = BIKE) {
  b.fell = false;

  if (b.fallTimer > 0) { // واقع: ثبّت لحد ما يقوم
    b.fallTimer -= dt;
    b.speed *= Math.max(0, 1 - 6 * dt);
    b.lean += (0 - b.lean) * Math.min(1, dt * 6);
    return b;
  }

  const drag = onRoad ? P.drag : P.offRoadDrag;
  let v = b.speed;
  const A = P.assist || 0;
  // قيادة سهلة: لفّة حادة بسرعة عالية = البنزين بيخف لوحده (من غير ما اللاعب يفرمل)
  const cornerEase = A ? 1 - 0.55 * A * Math.min(1, Math.abs(inp.steer) * Math.max(0, v - 9) / 16) : 1;
  const launch = 1 + 0.7 * Math.max(0, 1 - Math.abs(v) / 9); // دفعة انطلاق: بيستجيب فورًا من الوقوف
  let a = inp.throttle * cornerEase * launch * P.accel * (1 - Math.max(0, v) / P.maxSpeed);
  a -= drag * v + (v > 0.05 ? P.rolling : v < -0.05 ? -P.rolling : 0);

  if (inp.brake > 0 && v > 0.3) a -= P.brake * inp.brake;
  if (inp.reverse && v <= 0.3 && inp.throttle < 0.1) a -= 4; // ريفيرس بسيط (إدخال منفصل)
  v += a * dt;
  if (inp.brake > 0 && b.speed > 0 && v < 0) v = 0; // الفرامل لوحدها متقلبش الاتجاه
  b.speed = clamp(v, -P.reverseMax, P.maxSpeed);

  // توجيه: كل ما السرعة تزيد زاوية الدركسيون تقل
  const target = inp.steer * P.maxSteer / (1 + Math.max(0, Math.abs(b.speed)) * 0.055);
  b.steerAngle += (target - b.steerAngle) * Math.min(1, dt * 18); // توجيه فوري تقريبًا
  b.yawRate = (b.speed / P.wheelbase) * Math.tan(b.steerAngle);
  b.heading += b.yawRate * dt;
  // مساعد المسار: لما إيدك بعيدة عن التوجيه، الموتوسيكل بيتظبّط بالراحة مع اتجاه الشارع
  if (A && inp.roadHeading !== undefined && onRoad && Math.abs(b.speed) > 2.5 && Math.abs(inp.steer) < 0.2) {
    let d = ((inp.roadHeading - b.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    if (Math.abs(d) > Math.PI / 2) d = ((d + Math.PI + Math.PI) % (2 * Math.PI)) - Math.PI; // الشارع بالاتجاهين
    if (Math.abs(d) < 0.7) b.heading += d * Math.min(1, dt * 2.6 * A);
  }

  // ميل الموتوسيكل = تسارع جانبي / جاذبية
  const leanTarget = clamp(Math.atan((b.speed * b.yawRate) / 9.81), -P.leanMax, P.leanMax);
  b.lean += (leanTarget - b.lean) * Math.min(1, dt * 10);

  // الاتزان: ميل كبير × سرعة عالية = خطر. مساعد تلقائي يسامح شوية.
  b.risk = (Math.abs(b.lean) / P.leanMax) * (Math.abs(b.speed) / P.maxSpeed) * (0.6 + Math.abs(inp.steer) * 0.5);
  const thr = 0.7 + 0.22 * A;
  if (b.risk > thr) b.wobble += dt * (b.risk - (thr - 0.12)) * (2.4 - 1.1 * A);
  else b.wobble = Math.max(0, b.wobble - dt * (0.8 + 0.8 * A));
  if (b.wobble > 1) {
    b.fell = true; b.wobble = 0; b.fallTimer = 1.1;
    b.speed *= 0.25; b.lean = 0;
  }

  b.x += Math.sin(b.heading) * b.speed * dt;
  b.z += -Math.cos(b.heading) * b.speed * dt;
  return b;
}

export function forward(h) { return { x: Math.sin(h), z: -Math.cos(h) }; }
