// تواصل واتساب بالمطوّر: الرقم بيتحط في إعدادات الإدارة (content.contact) وممكن يتغيّر في أي وقت من غير ما نرجع للكود.
export const DEFAULT_CC = '20'; // مصر
export const DEFAULT_WA_MSG = 'مرحبًا، عايز أستفسر عن لعبة كوكب الجحود أكتوبر';
// أي صيغة (مسافات، +، 00، أو رقم محلي بيبدأ بـ0) → أرقام بكود الدولة، أو '' لو مش صالح
export function normalizeWhatsApp(raw, cc = DEFAULT_CC) {
  let d = String(raw == null ? '' : raw).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/[^\d+]/g, ''); // أرقام عربية/فارسية كمان
  const plus = d.startsWith('+'); d = d.replace(/\+/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (!plus && d.startsWith('0')) d = cc + d.slice(1);
  return /^[1-9]\d{7,14}$/.test(d) ? d : '';
}
export const waLink = (contact, text) => { const n = normalizeWhatsApp(contact && contact.whatsapp); if (!n) return ''; const m = text || (contact && contact.message) || DEFAULT_WA_MSG; return 'https://wa.me/' + n + '?text=' + encodeURIComponent(m); };
export function sanitizeContact(c) { const o = c && typeof c === 'object' ? c : {}; return { whatsapp: normalizeWhatsApp(o.whatsapp), message: String(o.message == null ? '' : o.message).trim().slice(0, 200) }; }
