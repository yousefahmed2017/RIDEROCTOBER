// فك أكواد الموقع (Plus Codes) اللي بتظهر في خرائط جوجل، مثال: XWFV+2H — بتتحوّل لإحداثيات. الكود القصير بيتكمّل من أقرب مرجع (مركز الخريطة).
const A = '23456789CFGHJMPQRVWX', STEPS = [20, 1, 0.05, 0.0025, 0.000125];
export function decodeFull(code) {
  const c = String(code).toUpperCase().replace(/[+\s]/g, ''); if (c.length < 8 || c.length > 15 || [...c].some((ch) => !A.includes(ch))) return null;
  let lat = -90, lon = -180; for (let j = 0; j < 5 && j * 2 + 1 < c.length; j++) { lat += A.indexOf(c[j * 2]) * STEPS[j]; lon += A.indexOf(c[j * 2 + 1]) * STEPS[j]; }
  const pairs = Math.min(5, Math.floor(c.length / 2)); let sz = STEPS[pairs - 1], h = sz, w = sz;
  if (c.length > 10) { const r = A.indexOf(c[10]); h = sz / 5; w = sz / 4; lat += Math.floor(r / 4) * h; lon += (r % 4) * w; }
  return { lat: lat + h / 2, lon: lon + w / 2 };
}
const prefixOf = (lat, lon) => { lat += 90; lon += 180; let s = ''; for (const st of [20, 1]) { const a = Math.floor(lat / st), b = Math.floor(lon / st); s += A[a] + A[b]; lat -= a * st; lon -= b * st; } return s; };
// يقبل: "29.97, 30.94" أو رابط/نص فيه إحداثيات @lat,lon أو كود كامل أو قصير (XWFV+2H مع أو من غير اسم مدينة)
export function parsePlace(text, ref = { lat: 29.924063, lon: 30.926437 }) {
  const t = String(text || '').trim(); if (!t) return null;
  const m = t.match(/(-?\d{1,2}\.\d{3,})\s*[,،\s]\s*(-?\d{1,3}\.\d{3,})/); if (m) { const lat = +m[1], lon = +m[2]; if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon }; }
  const pc = t.match(/([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,7})/i); if (!pc) return null;
  const code = pc[1].toUpperCase(), before = code.split('+')[0]; return decodeFull(before.length >= 8 ? code : prefixOf(ref.lat, ref.lon) .slice(0, 8 - before.length) + code);
}
