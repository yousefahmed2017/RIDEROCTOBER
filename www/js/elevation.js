// ارتفاعات الطرق: كباري + منحدرات + وصلات (نقي، بدون DOM).
// الفكرة: أي طريق عليه bridge=yes بيطلع لسطح ارتفاعه DECK_H، وبينزل بمنحدر ناعم (RAMP) عند نهاياته اللي بتلمس أرض.
// الوصلات (_link) والطرق اللي بتبدأ من نقطة مرتفعة بتنزل من الارتفاع ده لحد الأرض.
// بيحط على كل طريق مرتفع: r.elev (ارتفاع كل نقطة) و r.deck = true و r.pts اتقسّمت لنقط أقرب (كل ≤ STEP متر).
export const DECK_H = 6.5, RAMP = 100, STEP = 8, SLAB = 1.1;

const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const cellKey = (x, z) => Math.round(x / 2) + ',' + Math.round(z / 2);
const lenOf = (pts) => { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z); return L; };

// تقسيم الخط لنقط مسافتها ≤ step (بيحافظ على النقط الأصلية)
export function densify(pts, step = STEP) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
    out.push(b);
  }
  return out;
}

const hasNear = (set, p) => { const cx = Math.round(p.x / 2), cz = Math.round(p.z / 2); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (set.has((cx + a) + ',' + (cz + b))) return true; return false; };

// outside(p): نقطة برّه الخريطة (النهاية دي مش أرض، الكوبري بيكمّل مرتفع)
export function applyElevation(roads, { deck = DECK_H, ramp = RAMP, step = STEP, outside = () => false } = {}) {
  const isBr = (r) => r.bridge && r.pts.length >= 2;
  const bridges = roads.filter(isBr), others = roads.filter((r) => !isBr(r));
  if (!bridges.length) return { bridges: 0, decks: 0 };
  // مفاتيح نقط الطرق الأرضية + نقط الكباري (لمعرفة النهاية بتلمس إيه)
  const groundKeys = new Set(), bridgeKeys = new Map(); // bridgeKeys: مفتاح → عدد الكباري اللي بتمر بيه
  for (const r of others) for (const p of r.pts) groundKeys.add(cellKey(p.x, p.z));
  bridges.forEach((r, bi) => { const seen = new Set(); for (const p of r.pts) { const k = cellKey(p.x, p.z); if (!seen.has(k)) { seen.add(k); (bridgeKeys.get(k) || bridgeKeys.set(k, new Set()).get(k)).add(bi); } } });
  const touchBridges = (p, self) => { const cx = Math.round(p.x / 2), cz = Math.round(p.z / 2), s = new Set(); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const v = bridgeKeys.get((cx + a) + ',' + (cz + b)); if (v) for (const i of v) if (i !== self) s.add(i); } return s; };
  // رسم بياني للنهايات: عقدة = مفتاح نهاية، حافة = كوبري بطوله
  const node = (p) => cellKey(p.x, p.z), nodes = new Map(); // مفتاح → { ground, edges: [{to,len}] , dist }
  const getN = (k) => nodes.get(k) || nodes.set(k, { ground: false, edges: [], dist: Infinity }).get(k);
  const info = bridges.map((r, bi) => {
    const a = r.pts[0], b = r.pts[r.pts.length - 1], L = lenOf(r.pts), ka = node(a), kb = node(b), na = getN(ka), nb = getN(kb);
    for (const [p, n] of [[a, na], [b, nb]]) {
      if (outside(p)) continue; // نهاية برّه الخريطة = كمل مرتفع
      const otherBr = touchBridges(p, bi).size > 0;
      if (!otherBr) n.ground = true; // لا لمس كوبري تاني ولا حاجة: ينزل لأرض (حتى لو طريق مقطوع)
    }
    if (ka !== kb) { na.edges.push({ to: nb, len: L }); nb.edges.push({ to: na, len: L }); }
    return { r, L, na, nb, ka, kb };
  });
  // أقصر مسافة من أي نهاية أرضية (Dijkstra بسيط)
  const q = []; for (const n of nodes.values()) if (n.ground) { n.dist = 0; q.push(n); }
  while (q.length) { q.sort((x, y) => x.dist - y.dist); const n = q.shift(); for (const e of n.edges) if (n.dist + e.len < e.to.dist) { e.to.dist = n.dist + e.len; q.push(e.to); } }
  const bridgeH = new Map(); // مفتاح نقطة كوبري → ارتفاع (لربط الوصلات)
  let decks = 0;
  for (const { r, L, na, nb } of info) {
    const rampEff = Math.min(ramp, Math.max(60, L * 0.45)), H = r.layer >= 2 ? deck * 1.8 : deck, pts = densify(r.pts, step);
    const elev = new Float32Array(pts.length); let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const d = Math.min(na.dist + s, nb.dist + (L - s)); // مسافة لأقرب أرض
      elev[i] = H * smooth(d / rampEff); bridgeH.set(cellKey(pts[i].x, pts[i].z), elev[i]);
    }
    r.pts = pts; r.elev = elev; r.deck = true; decks++;
  }
  // الطرق العادية اللي بتبدأ/بتنتهي عند نقطة مرتفعة (وصلات نازلة من الكوبري)
  const hAt = (p) => { const cx = Math.round(p.x / 2), cz = Math.round(p.z / 2); let h = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const v = bridgeH.get((cx + a) + ',' + (cz + b)); if (v !== undefined && v > h) h = v; } return h; };
  let links = 0;
  for (const r of others) {
    if (r.pts.length < 2) continue;
    const hA = hAt(r.pts[0]), hB = hAt(r.pts[r.pts.length - 1]);
    if (hA < 0.4 && hB < 0.4) continue;
    const L = lenOf(r.pts), pts = densify(r.pts, step), elev = new Float32Array(pts.length); let s = 0;
    const rampEff = Math.min(ramp, Math.max(30, L * 0.9));
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (hA >= 0.4 && hB >= 0.4) elev[i] = hA + (hB - hA) * (s / (L || 1));            // وصلة بين كوبريين
      else elev[i] = Math.max(hA * (1 - smooth(s / rampEff)), hB * (1 - smooth((L - s) / rampEff)));
    }
    if (Math.max(...elev) < 0.3) continue;
    r.pts = pts; r.elev = elev; r.deck = true; links++;
  }
  return { bridges: bridges.length, decks: decks + links, links };
}

// ارتفاع الطريق عند مسافة s من أوله (r._cum لازم يكون محسوب)
export function elevAtS(r, s, hint = 0) {
  if (!r.elev) return 0;
  const cum = r._cum; let i = Math.max(0, Math.min(hint | 0, cum.length - 2));
  while (i < cum.length - 2 && s > cum[i + 1]) i++; while (i > 0 && s < cum[i]) i--;
  const L = cum[i + 1] - cum[i] || 1, t = Math.max(0, Math.min(1, (s - cum[i]) / L));
  return r.elev[i] + (r.elev[i + 1] - r.elev[i]) * t;
}
