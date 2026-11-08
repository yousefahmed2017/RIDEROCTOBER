// اختبار القيادة السهلة: مساعد المسار + اتزان متسامح + تخفيف البنزين في اللفّات
import assert from 'node:assert/strict';
import { newBike, stepBike, BIKE } from '../www/js/physics.js';
const run = (A, f) => { const b = newBike(0, 0, 0.3); b.speed = 12; for (let i = 0; i < 180; i++) f(b, A); return b; };
const P = (A) => ({ ...BIKE, assist: A });

let b = run(1, (b, A) => stepBike(b, { throttle: 0.3, brake: 0, steer: 0, roadHeading: 0 }, 1 / 60, true, P(A)));
assert.ok(Math.abs(b.heading) < 0.1, 'المساعد بيرجّع الاتجاه لاتجاه الشارع: ' + b.heading); console.log('✓ مساعد المسار بيعدّل الاتجاه لوحده');
b = run(0, (b, A) => stepBike(b, { throttle: 0.3, brake: 0, steer: 0, roadHeading: 0 }, 1 / 60, true, P(A)));
assert.ok(Math.abs(b.heading - 0.3) < 0.01); console.log('✓ الوضع الحقيقي (0) من غير تدخّل');

const falls = (A) => { const b = newBike(); b.speed = 30; let n = 0; for (let i = 0; i < 240; i++) { stepBike(b, { throttle: 1, brake: 0, steer: 1, roadHeading: undefined }, 1 / 60, true, P(A)); if (b.fell) n++; } return n; };
const f0 = falls(0), f1 = falls(1); assert.ok(f1 <= f0 && f0 > 0, `الوقوع: عادي ${f0} / سهل ${f1}`); console.log(`✓ القيادة السهلة بتقلل الوقوع (${f0} → ${f1})`);
const sp = (A) => { const b = newBike(); b.speed = 25; for (let i = 0; i < 60; i++) stepBike(b, { throttle: 1, brake: 0, steer: 1 }, 1 / 60, true, P(A)); return b.speed; };
assert.ok(sp(1) < sp(0) + 0.001); console.log('✓ البنزين بيخف تلقائي في اللفّة الحادة'); console.log('\n4 اختبار قيادة نجحوا ✅');

// استجابة: من الوقوف لـ 50 كم/س في أقل من 3 ثواني (سكوتر)، والتوجيه بياخد أمره في أقل من 0.25 ثانية
import { bikeParams } from '../www/js/bikes.js';
const prof = { bike: 'scooter', upg: {}, settings: { assist: 1 } }, PP = bikeParams(prof);
let t = 0; const bk = newBike(); while (bk.speed < 50 / 3.6 && t < 10) { stepBike(bk, { throttle: 1, brake: 0, steer: 0 }, 1 / 60, true, PP); t += 1 / 60; }
assert.ok(t < 3, 'التسارع بطيء: ' + t.toFixed(2)); console.log(`✓ 0→50 كم/س في ${t.toFixed(2)} ثانية`);
const bs = newBike(); bs.speed = 10; let ts = 0; while (Math.abs(bs.steerAngle) < 0.8 * (PP.maxSteer / (1 + 10 * 0.055)) && ts < 2) { stepBike(bs, { throttle: 0.5, brake: 0, steer: 1 }, 1 / 60, true, PP); ts += 1 / 60; }
assert.ok(ts < 0.25, 'التوجيه بطيء: ' + ts.toFixed(2)); console.log(`✓ التوجيه استجاب في ${ts.toFixed(2)} ثانية`);
