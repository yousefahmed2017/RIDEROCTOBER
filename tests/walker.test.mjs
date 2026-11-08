import { createWalker, EMOTE_KEYS } from '../www/js/walker.js';
import assert from 'node:assert/strict';
const w = createWalker({ top: 0x123456 }, 0xff7a1a);
for (const e of [null, ...EMOTE_KEYS]) { for (let i = 0; i < 90; i++) w.update(0.016, e ? 0 : 2.3, e, 0); assert.equal(w.anim, e || 'walk'); }
for (let i = 0; i < 30; i++) w.update(0.016, 5.2, null, 0.4); assert.equal(w.anim, 'run');
w.update(0.016, 0, null, 0); assert.equal(w.anim, 'idle');
console.log('✓ الشخصية: كل الحركات (مشي/جري/' + EMOTE_KEYS.join('/') + ') شغالة');
console.log('\nاختبار الشخصية نجح ✅');
