// Prism Comet Preloader — شاشة تحميل سينمائية (شيدر WebGL واحد) محوّلة من مكوّن React لـ JS عادي بنفس المنطق والشيدر.
// التحميل الحقيقي بيحرّك الشيدر: ضوضاء → إحداثيات قطبية → كرة → مذنّب → نجمة بتتحول لبوابة بتدخّل منها على اللعبة.
// الاستخدام: const p = createPreloader(hostEl, opts); p.setProgress(0.4, 0.6); p.setStatus('…'); await p.finish(); p.destroy();

const TAU = Math.PI * 2;
const HERO_Y = 0.1, HERO_R = 0.28, HERO_ROT = 0.38, HEAD_R = 0.05;
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => t * t * (3 - 2 * t);

// #region timeline — دوال نقية (مختبرة في tests/preloader.test.mjs)
const KNOTS = [[0, 0], [0.16, 0.22], [0.27, 0.26], [0.55, 0.62], [0.66, 0.66], [0.84, 0.9], [1, 1]];
export function pcpSimulated(t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  for (let i = 0; i < KNOTS.length - 1; i++) { const [t0, p0] = KNOTS[i], [t1, p1] = KNOTS[i + 1]; if (t <= t1) return p0 + (p1 - p0) * sm((t - t0) / (t1 - t0)); }
  return 1;
}
export function pcpEase(t) { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
export function pcpMorph(p) { const x = clamp01(p) * 4, k = Math.min(3, Math.floor(x)); return k + sm(clamp01((x - k - 0.3) / 0.7)); }
export function pcpView(aspect) { const zoom = Math.max(1, 0.92 / Math.max(aspect, 0.1)); return { zoom, w: aspect * zoom, h: zoom }; }
export function pcpHead(aspect) {
  const v = pcpView(aspect), x = -Math.min(v.w * 0.3, 0.52), y = -v.h * 0.2, tail = lerp(1.05, 0.5, clamp01((aspect - 0.5) / 1));
  const room = Math.min((v.w / 2 - x) / Math.cos(tail), (v.h / 2 - y) / Math.sin(tail));
  return { x, y, tail, room };
}
export function pcpRig(m, aspect) {
  const { zoom, w, h } = pcpView(aspect), s1 = sm(clamp01(m)), s2 = sm(clamp01(m - 1)), s3 = sm(clamp01(m - 2)), s4 = sm(clamp01(m - 3));
  let phi = Math.max(0.02, s1 * TAU); const rho0 = ((1 - s1) * w) / phi; let ax = 0, ay = (h / 2) * (1 - s1) + rho0, beta = -Math.PI / 2, kv = lerp(1 / h, 2.6, s1);
  beta += s2 * Math.PI; phi = lerp(phi, 0.85, s2); ay = lerp(ay, -0.3, s2); kv = lerp(kv, 1.45, s2);
  const head = pcpHead(aspect); beta = lerp(beta, head.tail, s3); phi = lerp(phi, 0.55, s3); ax = lerp(ax, head.x, s3); ay = lerp(ay, head.y, s3);
  kv = lerp(kv, Math.max(0.75, 0.8 / (head.room * 0.92)), s3);
  const closed = sm(clamp01((phi / TAU - 0.9) / 0.1));
  return { zoom, ax, ay, beta, phi, rho0, kv, vf: lerp(1, 0.32, s3), narrow: lerp(lerp(1, 0.55, s2), 0.3, s3), wave: s3, bulge: s2 * (1 - s3), edge: clamp01(s1 * 4) * (1 - closed), closed, star: s4, lines: s4 };
}
export function pcpIgnite(i, aspect) {
  const head = pcpHead(aspect), x = clamp01(i), e = pcpEase(x), cx = head.x * 0.15 + 0.22, cy = head.y - 0.1, k = 1 - e;
  return { x: k * k * head.x + 2 * k * e * cx, y: k * k * head.y + 2 * k * e * cy + e * e * HERO_Y, r: lerp(HEAD_R, HERO_R, sm(clamp01((x - 0.08) / 0.8))), rot: lerp(0, HERO_ROT + TAU, e), mode: sm(clamp01((x - 0.3) / 0.55)), comet: 1 - sm(clamp01((x - 0.05) / 0.5)), retract: sm(clamp01(x / 0.5)), lines: 1 - sm(clamp01((x - 0.4) / 0.4)), bloom: Math.exp(-Math.pow((x - 0.32) / 0.08, 2)) };
}
export function pcpHex(s) { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s).trim()); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]; return [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16) / 255); }
// #endregion

// ألوان اللعبة: ليل أكتوبر + برتقالي الغروب + ذهبي + تركواز
export const OCTOBER_PALETTE = { background: '#060a14', blue: '#2447d6', violet: '#ff7a1a', magenta: '#ffc83d', cyan: '#8fe9d6', gold: '#ffd36b' };

const VERT = `attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uZoom; uniform float uTime;
uniform vec2 uApex; uniform float uBeta; uniform float uPhi; uniform float uRho0; uniform float uKv; uniform float uVf; uniform float uNarrow; uniform float uWave; uniform float uBulge; uniform float uEdge; uniform float uClosed; uniform float uComet; uniform float uLines; uniform float uLineDir;
uniform vec2 uStarC; uniform float uStarR; uniform float uStarAmt; uniform float uStarMode; uniform float uStarRot; uniform float uSwirl; uniform vec2 uTilt; uniform float uHoleOpen; uniform float uFlash; uniform float uBloom;
uniform vec3 uPtr; uniform vec3 uBg; uniform vec3 uBlue; uniform vec3 uViolet; uniform vec3 uMagenta; uniform vec3 uCyan; uniform vec3 uGold; uniform float uExposure; uniform float uGrain;
#define PI 3.14159265
#define TAU 6.28318531
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float pnoise(vec2 p, float per) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, per); float x1 = mod(i.x + 1.0, per);
  float a = hash(vec2(x0, i.y)); float b = hash(vec2(x1, i.y)); float c = hash(vec2(x0, i.y + 1.0)); float d = hash(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
float fbm(vec2 p, float per) { float s = 0.0; float amp = 0.5; for (int i = 0; i < 4; i++) { s += amp * pnoise(p, per); p = p * 2.0 + vec2(0.0, 17.3); per *= 2.0; amp *= 0.5; } return s / 0.9375; }
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }
vec3 sheet(float u, float v, float t) {
  float X = u * 20.0; float vy = v * uVf;
  float w = fbm(vec2(X * 0.5, vy * 1.3 - t * 0.12), 10.0);
  float wave = sin(v * 9.0 - t * 2.2) * uWave * 0.9;
  float n = fbm(vec2(X + (w - 0.5) * 5.0 + wave, vy * 1.6 - t * 0.22), 20.0);
  float ridge = 1.0 - abs(n * 2.0 - 1.0);
  float ribbons = pow(ridge, mix(5.0, 2.6, uWave));
  float blob = pnoise(vec2(X * 0.25, v * 2.2 - t * 0.18), 5.0);
  float len = 0.5 + 0.42 * pnoise(vec2(X * 0.5, 3.7 + t * 0.03), 10.0);
  float body = smoothstep(len + 0.08, len - 0.42, v) * smoothstep(-0.02, 0.07, v);
  float I = ribbons * body * (0.3 + 1.25 * blob);
  float hue = pnoise(vec2(X * 0.5, v * 0.7 + t * 0.04 + 9.0), 10.0);
  vec3 c = mix(uBlue, uViolet, smoothstep(0.22, 0.58, hue));
  c = mix(c, uMagenta, smoothstep(0.6, 0.9, hue) * 0.85);
  vec3 col = c * I * 1.7;
  float fringe = smoothstep(0.42, 0.62, I) * smoothstep(1.0, 0.68, I);
  col += mix(uGold, uCyan, smoothstep(0.3, 0.7, hue)) * fringe * 0.55;
  col += vec3(1.0, 0.97, 0.93) * smoothstep(0.72, 1.25, I) * 1.4;
  float across = mix(1.0 - 0.7 * smoothstep(0.0, 0.5, abs(u - 0.5)), 1.0, uClosed);
  float flare = exp(-abs(v) * 6.5) * 0.6 + exp(-abs(v) * 30.0) * 1.3;
  col += mix(uCyan, vec3(1.0), 0.45) * flare * across;
  vec2 g = vec2(u * 64.0, v * 20.0 - t * 0.7); vec2 id = floor(g); id.x = mod(id.x, 64.0);
  float h = hash(id + 11.0); vec2 off = vec2(hash(id + 3.7), hash(id + 9.1)) - 0.5;
  float spark = step(0.93, h) * smoothstep(0.17, 0.0, length(fract(g) - 0.5 - off * 0.6));
  spark *= (0.55 + 0.45 * sin(t * 6.0 + h * 40.0)) * smoothstep(0.05, 0.2, v) * smoothstep(1.15, 0.6, v);
  col += mix(uGold, vec3(1.0), 0.35) * spark * 1.5;
  return col;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; vec2 a = p * uZoom; float t = uTime;
  vec2 pd = a - uPtr.xy; float pr = dot(pd, pd);
  vec2 aw = uPtr.xy + rot(uPtr.z * 1.5 * exp(-pr * 14.0)) * pd * (1.0 - uPtr.z * 0.22 * exp(-pr * 24.0));
  vec3 col = uBg + uBlue * 0.05 * smoothstep(1.2, 0.0, length(p)); float alpha = 1.0;
  if (uComet > 0.001) {
    vec2 d = aw - uApex; float rho = length(d); float ang = mod(atan(d.y, d.x) - uBeta + PI, TAU) - PI; float v = (rho - uRho0) * uKv;
    float u = ang / uPhi * (1.0 - uBulge * 0.45 * sin(clamp(v, 0.0, 1.0) * PI)) + 0.5;
    float mask = mix(1.0, smoothstep(0.0, 0.07, u) * smoothstep(1.0, 0.93, u), uEdge);
    col += sheet(0.5 + (u - 0.5) * uNarrow, v, t) * mask * uComet;
    col += mix(uViolet, uCyan, 0.5) * exp(-pr * 70.0) * uPtr.z * 0.1;
  }
  if (uLines > 0.001) {
    vec2 dir = vec2(cos(uLineDir), sin(uLineDir)); float along = dot(a, dir); float across = dot(a, vec2(-dir.y, dir.x)) * 38.0;
    float h = hash(vec2(floor(across), 3.1)); float lane = fract(across) - 0.5; float seg = fract(along * 0.45 - t * (0.5 + h * 1.3) + h * 9.0);
    float line = step(0.8, h) * exp(-lane * lane * 40.0) * smoothstep(0.0, 0.08, seg) * smoothstep(0.42, 0.1, seg);
    col += mix(uBlue, uViolet, hash(vec2(h, 1.0))) * line * uLines * 0.85;
  }
  if (uStarAmt > 0.001) {
    vec2 q = a - uStarC; float den = max(0.2, 1.0 + dot(q, uTilt)); q /= den; float rr = length(q); float R = max(uStarR, 0.0001);
    q = rot(uStarRot + uSwirl * min(rr / R, 3.0)) * q; float e = mix(0.46, 0.6, uStarMode);
    vec2 qa = abs(q) / R + 0.00001; float S = pow(pow(qa.x, e) + pow(qa.y, e), 1.0 / e); float ang = atan(q.y, q.x);
    vec3 spark = vec3(1.0) * smoothstep(1.0, 0.5, S) * 2.4; spark += mix(uMagenta, uViolet, 0.35) * (0.7 / (1.0 + S * S * 0.5)); spark += uMagenta * exp(-rr / R * 0.8) * 0.5;
    col += spark * uStarAmt * (1.0 - uStarMode);
    if (uStarMode > 0.001) {
      float aa = 2.5 * uZoom * den / (uRes.y * R); float inside = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, S);
      float sf = S + 0.05 * sin(ang * 2.0 + t * 0.6) + 0.03 * sin(rr / R * 9.0 - t);
      vec3 ic = vec3(2.6, 2.55, 2.7); ic = mix(ic, mix(vec3(1.6), uMagenta * 1.9, 0.65), smoothstep(0.42, 0.66, sf)); ic = mix(ic, uViolet * 1.7, smoothstep(0.66, 0.82, sf)); ic = mix(ic, uCyan * 1.7, smoothstep(0.82, 0.94, sf));
      ic += vec3(0.9, 0.95, 1.0) * smoothstep(0.93, 1.0, S) * 1.3;
      float o = max(S - 1.0, 0.0); float fold = 0.5 + 0.5 * sin(ang * 2.0 + 0.7);
      vec3 mem = mix(uBg, uBlue, 0.1) * 1.3; mem += uBlue * (0.1 + 0.16 * fold) * exp(-o * 0.55); mem += uBlue * 0.45 * exp(-o * 4.5) + uCyan * 0.75 * exp(-o * 26.0); mem -= vec3(0.05) * exp(-o * 9.0) * (1.0 - exp(-o * 60.0));
      float rays = pow(0.5 + 0.5 * sin(ang * 6.0 + sin(ang * 3.0 + t * 0.2) * 1.6 + t * 0.05), 7.0);
      mem += mix(uCyan, vec3(1.0), 0.4) * rays * exp(-rr / R * 0.7) * 0.7; mem += mix(uCyan, vec3(1.0), 0.6) * exp(-o * 7.0) * 0.32;
      vec3 portal = mix(max(mem, vec3(0.0)), ic, inside); col = mix(col, portal, uStarMode);
      float hole = inside * (1.0 - smoothstep(0.5, 0.88, S)); alpha = 1.0 - uHoleOpen * hole * uStarMode;
    }
  }
  float bd = length(a - uStarC); col += vec3(1.0, 0.95, 1.0) * uBloom * (exp(-bd * 18.0) * 3.0 + exp(-bd * 5.5) * 1.1 + 0.03);
  col = 1.0 - exp(-col * uExposure); col *= 1.0 - 0.5 * smoothstep(0.35, 1.25, length(p * vec2(0.9, 1.0)));
  col += (hash(gl_FragCoord.xy + fract(t * 7.0) * 311.0) - 0.5) * uGrain; col = mix(col, vec3(1.0), uFlash); alpha = mix(alpha, 1.0, uFlash);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}`;
const UNIFORMS = ['uRes', 'uZoom', 'uTime', 'uApex', 'uBeta', 'uPhi', 'uRho0', 'uKv', 'uVf', 'uNarrow', 'uWave', 'uBulge', 'uEdge', 'uClosed', 'uComet', 'uLines', 'uLineDir', 'uStarC', 'uStarR', 'uStarAmt', 'uStarMode', 'uStarRot', 'uSwirl', 'uTilt', 'uHoleOpen', 'uFlash', 'uBloom', 'uPtr', 'uBg', 'uBlue', 'uViolet', 'uMagenta', 'uCyan', 'uGold', 'uExposure', 'uGrain'];

function link(gl, vert, frag) {
  const program = gl.createProgram(); if (!program) return null;
  for (const [type, source] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]]) {
    const sh = gl.createShader(type); if (!sh) return null; gl.shaderSource(sh, source); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error('preloader shader', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
    gl.attachShader(program, sh); gl.deleteShader(sh);
  }
  gl.linkProgram(program); return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

const CSS = `
.pcp-root { position: absolute; inset: 0; overflow: hidden; isolation: isolate; -webkit-tap-highlight-color: transparent; background: var(--pcp-bg); }
.pcp-root[data-phase="lift"][data-hole="true"] { background: transparent; }
.pcp-gate { position: absolute; inset: 0; z-index: 10; background: var(--pcp-bg); color: #f3f1ff; font-family: var(--pcp-mono); outline: none; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
.pcp-gate[data-skip="true"] { cursor: pointer; }
.pcp-root[data-phase="lift"] .pcp-gate { pointer-events: none; }
.pcp-root[data-phase="lift"][data-hole="true"] .pcp-gate { background: transparent; opacity: 0; transition: opacity 0.4s ease 1.25s; }
.pcp-root[data-fast="true"][data-phase="lift"][data-hole="true"] .pcp-gate { transition-delay: 0.6s; }
.pcp-layer, .pcp-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
.pcp-fallback { background: radial-gradient(circle at 50% 50%, var(--pcp-magenta) 0%, transparent 28%), radial-gradient(ellipse 60% 45% at 50% 50%, var(--pcp-violet) 0%, transparent 70%), radial-gradient(ellipse 90% 70% at 50% 40%, var(--pcp-blue) 0%, transparent 75%), var(--pcp-bg); opacity: calc(0.25 + var(--pcp-p) * 0.5); transition: opacity 1s ease; }
.pcp-root:not([data-phase="load"]) .pcp-fallback { opacity: 0.9; }
.pcp-grid { background-image: linear-gradient(rgba(150, 170, 255, 0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(150, 170, 255, 0.075) 1px, transparent 1px); background-size: calc(var(--pcp-u) * 0.065) calc(var(--pcp-u) * 0.065); background-position: 50% 50%; mix-blend-mode: screen; -webkit-mask-image: radial-gradient(ellipse at 50% 50%, #000 30%, transparent 85%); mask-image: radial-gradient(ellipse at 50% 50%, #000 30%, transparent 85%); transition: opacity 1.4s ease; }
.pcp-root:not([data-phase="load"]) .pcp-grid { opacity: 0; }
.pcp-bar { position: absolute; left: 0; right: 0; height: calc(var(--pcp-u) * 0.065); background: #000; pointer-events: none; transition: transform 1.1s cubic-bezier(0.7, 0, 0.2, 1); }
.pcp-bar-top { top: 0; transform: translateY(-101%); } .pcp-bar-bot { bottom: 0; transform: translateY(101%); }
.pcp-root[data-phase="ignite"] .pcp-bar, .pcp-root[data-phase="reveal"] .pcp-bar { transform: none; }
.pcp-hud { position: absolute; inset: 0; pointer-events: none; font-size: clamp(9px, calc(var(--pcp-u) * 0.017), 13px); letter-spacing: 0.16em; text-transform: uppercase; transition: opacity 0.7s ease; }
.pcp-root[data-phase="lift"] .pcp-hud { opacity: 0; }
.pcp-bl { position: absolute; left: calc(var(--pcp-u) * 0.05); bottom: calc(var(--pcp-u) * 0.05 + var(--pcp-adh, 0px)); transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.6, 0, 0.2, 1); }
.pcp-root:not([data-phase="load"]) .pcp-bl { opacity: 0; transform: translateY(1.2em); }
.pcp-count { font-family: var(--pcp-display); font-size: clamp(30px, calc(var(--pcp-u) * 0.13), 112px); font-weight: 300; line-height: 0.9; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin: 0; direction: ltr; text-shadow: -1px 0 color-mix(in srgb, var(--pcp-cyan) 60%, transparent), 1px 0 color-mix(in srgb, var(--pcp-magenta) 60%, transparent); }
.pcp-count small { font-size: 0.3em; letter-spacing: 0.1em; margin-left: 0.3em; vertical-align: top; opacity: 0.6; }
.pcp-segs { display: flex; gap: 4px; margin-top: 0.9em; width: clamp(120px, calc(var(--pcp-u) * 0.36), 300px); direction: ltr; }
.pcp-seg { position: relative; flex: 1; height: 2px; background: rgba(200, 205, 255, 0.16); overflow: hidden; }
.pcp-seg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, var(--pcp-cyan), var(--pcp-violet), var(--pcp-magenta)); transform-origin: 0 50%; transform: scaleX(clamp(0, calc(var(--pcp-p) * 4 - var(--k)), 1)); }
.pcp-status { margin: 0.9em 0 0; max-width: min(70vw, 420px); letter-spacing: 0; text-transform: none; font-family: var(--pcp-display); font-size: clamp(11px, calc(var(--pcp-u) * 0.022), 15px); color: rgba(225, 228, 255, 0.78); line-height: 1.7; }
.pcp-tip { margin: 0.4em 0 0; max-width: min(70vw, 420px); letter-spacing: 0; text-transform: none; font-family: var(--pcp-display); font-size: clamp(10px, calc(var(--pcp-u) * 0.018), 13px); color: rgba(225, 228, 255, 0.5); line-height: 1.7; }
.pcp-title { position: absolute; left: 0; right: 0; text-align: center; pointer-events: none; transition: opacity 0.6s ease, transform 1.7s cubic-bezier(0.6, 0, 0.3, 1), filter 1.2s ease; }
.pcp-root[data-phase="lift"] .pcp-title { opacity: 0; transform: scale(1.35); filter: blur(10px); }
.pcp-word { margin: 0; font-family: var(--pcp-display); font-size: clamp(26px, calc(var(--pcp-u) * 0.085), 110px); font-weight: 300; letter-spacing: 0.34em; text-indent: 0.34em; text-transform: uppercase; line-height: 1; white-space: nowrap; direction: ltr; }
.pcp-letter { display: inline-block; opacity: 0; filter: blur(14px); transform: translateY(0.35em) scale(1.4); text-shadow: -0.04em 0 color-mix(in srgb, var(--pcp-cyan) 75%, transparent), 0.04em 0 color-mix(in srgb, var(--pcp-magenta) 75%, transparent), 0 0 0.5em color-mix(in srgb, var(--pcp-violet) 60%, transparent); transition: opacity 1s ease, filter 1.2s ease, transform 1.4s cubic-bezier(0.15, 0.8, 0.15, 1); }
.pcp-root[data-phase="reveal"] .pcp-letter, .pcp-root[data-phase="lift"] .pcp-letter { opacity: 1; filter: blur(0); transform: none; }
.pcp-caption, .pcp-hint { margin: 1.2em 0 0; font-family: var(--pcp-display); font-size: clamp(11px, calc(var(--pcp-u) * 0.022), 16px); letter-spacing: 0; color: rgba(225, 228, 255, 0.78); opacity: 0; transition: opacity 1s ease 0.7s; }
.pcp-hint { margin-top: 0.6em; color: rgba(225, 228, 255, 0.5); transition-delay: 1.6s; }
.pcp-root[data-phase="reveal"] .pcp-caption { opacity: 1; } .pcp-root[data-phase="reveal"] .pcp-hint { opacity: 1; animation: pcp-breathe 2.4s ease-in-out 2.4s infinite; }
.pcp-adhost { position: absolute; left: 50%; bottom: calc(var(--pcp-u) * 0.025 + 6px); transform: translateX(-50%); width: min(92vw, 520px, calc(22vh * 3.2)); z-index: 12; pointer-events: auto; transition: opacity 0.6s ease; }
.pcp-root[data-phase="reveal"] .pcp-adhost, .pcp-root[data-phase="lift"] .pcp-adhost { opacity: 0; pointer-events: none; } /* بيختفي وقت ظهور الاسم عشان ما يغطيش عليه */
.pcp-frame { position: absolute; inset: 0; pointer-events: none; }
.pcp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
@keyframes pcp-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .pcp-root[data-phase="reveal"] .pcp-hint { animation: none; } .pcp-letter { filter: none; transform: none; transition: opacity 0.4s ease; } .pcp-root[data-phase="lift"] .pcp-title { transform: none; filter: none; } .pcp-bar, .pcp-bl { transition-duration: 0.01s; } .pcp-root[data-phase="lift"][data-hole="true"] .pcp-gate { transition-delay: 0s; } }
`;
let cssDone = false;
const DISPLAY_STACK = 'Cairo, "Segoe UI", Tahoma, system-ui, sans-serif', MONO_STACK = 'Cairo, "Segoe UI", Tahoma, system-ui, sans-serif';

export function createPreloader(host, opts = {}) {
  const o = { word: 'OCTOBER', caption: 'كوكب الجحود · دليفري في 6 أكتوبر', hint: 'اضغط للدخول', palette: OCTOBER_PALETTE, intensity: 1, speed: 1, quality: 0.6, fast: false, grid: true, adHTML: '', tip: '', ...opts };
  const colors = { ...OCTOBER_PALETTE, ...(o.palette || {}) };
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const igniteMs = still ? 600 : o.fast ? 1500 : 2600, holdMs = o.fast ? 300 : 1300, liftMs = still ? 700 : o.fast ? 1100 : 1700;
  if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }

  const root = document.createElement('div'); root.className = 'pcp-root'; root.dataset.phase = 'load'; root.dataset.hole = 'true'; root.dataset.gl = 'true'; root.dataset.fast = String(!!o.fast);
  const sv = (k, v) => root.style.setProperty(k, v);
  sv('--pcp-bg', colors.background); sv('--pcp-blue', colors.blue); sv('--pcp-violet', colors.violet); sv('--pcp-magenta', colors.magenta); sv('--pcp-cyan', colors.cyan); sv('--pcp-display', DISPLAY_STACK); sv('--pcp-mono', MONO_STACK); sv('--pcp-p', '0'); sv('--pcp-u', '720px');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  root.innerHTML = `<div class="pcp-gate" role="progressbar" aria-label="جاري تحميل اللعبة" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
    <canvas class="pcp-canvas" aria-hidden="true"></canvas>${o.grid ? '<div class="pcp-layer pcp-grid" aria-hidden="true"></div>' : ''}
    <div class="pcp-title" aria-hidden="true"><p class="pcp-word">${Array.from(o.word).map((ch, i) => `<span class="pcp-letter" style="transition-delay:${(0.05 + i * 0.08).toFixed(2)}s">${esc(ch)}</span>`).join('')}</p>
      <p class="pcp-caption">${esc(o.caption)}</p><p class="pcp-hint">${esc(o.hint)}</p></div>
    <div class="pcp-bar pcp-bar-top"></div><div class="pcp-bar pcp-bar-bot"></div>
    <div class="pcp-hud" aria-hidden="true"><div class="pcp-bl"><p class="pcp-count"><span class="pcp-n">000</span><small>%</small></p><div class="pcp-segs">${[0, 1, 2, 3].map((k) => `<i class="pcp-seg" style="--k:${k}"></i>`).join('')}</div><p class="pcp-status"></p>${o.tip ? `<p class="pcp-tip">${esc(o.tip)}</p>` : ''}</div></div>
    ${o.adHTML ? `<div class="pcp-adhost">${o.adHTML}</div>` : ''}<div class="pcp-frame"></div><span class="pcp-sr" aria-live="polite"></span></div>`;
  host.appendChild(root); host.classList.add('pcp-on');
  const gate = root.querySelector('.pcp-gate'), canvas = root.querySelector('.pcp-canvas'), nEl = root.querySelector('.pcp-n'), stEl = root.querySelector('.pcp-status'), titleEl = root.querySelector('.pcp-title'), srEl = root.querySelector('.pcp-sr'), adEl = root.querySelector('.pcp-adhost');

  let phase = 'load', phaseAt = performance.now(), shown = 0, base = 0, ceil = 0, baseAt = performance.now(), finishReq = false, rush = false, destroyed = false, lastPct = -1, resolveFin = null;
  const pointer = { cur: null }; let box = { w: 1280, h: 800 };
  const measure = () => { const r = root.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { box = { w: Math.round(r.width), h: Math.round(r.height) }; const u = Math.min(box.w, box.h); sv('--pcp-u', u + 'px'); const zoom = pcpView(box.w / Math.max(1, box.h)).zoom; titleEl.style.top = (0.5 + (HERO_R * 0.92 - HERO_Y + 0.05) / zoom) * 100 + '%'; if (adEl) sv('--pcp-adh', Math.round(adEl.getBoundingClientRect().height + 8) + 'px'); } };
  measure(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null; ro && ro.observe(root);
  const setPhase = (p) => { phase = p; phaseAt = performance.now(); root.dataset.phase = p; };

  // ── التقدم ──
  const targetNow = (now) => (finishReq ? 1 : Math.max(0, Math.min(base + (ceil - base) * (1 - Math.exp(-Math.max(0, now - baseAt) / 6000)), 0.98)));
  let raf1 = 0, last1 = performance.now();
  const tick = () => {
    if (destroyed || phase !== 'load') return;
    const now = performance.now(), dt = Math.max(0, Math.min(64, now - last1)); last1 = now; // نفس مصدر الوقت في كل حتة (توقيت الإطار ممكن يسبق performance.now)
    const target = targetNow(now), rate = rush ? 0.09 : finishReq ? 0.07 : 0.08;
    shown += (target - shown) * Math.min(1, rate * (dt / 16.7)); if (target - shown < 0.002) shown = target; shown = clamp01(shown);
    sv('--pcp-p', shown.toFixed(4)); const pct = Math.round(shown * 100); if (pct !== lastPct) { lastPct = pct; nEl.textContent = String(pct).padStart(3, '0'); gate.setAttribute('aria-valuenow', String(pct)); }
    if (shown >= 1) { setPhase('ignite'); setTimeout(() => !destroyed && phase === 'ignite' && setPhase('reveal'), igniteMs); return; }
    raf1 = requestAnimationFrame(tick);
  };
  raf1 = requestAnimationFrame(tick);

  // ── الشيدر ──
  let gl = null, failed = false;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  let program = null, buffer = null, raf2 = 0; const U = {};
  if (gl) program = link(gl, VERT, FRAG);
  if (!gl || !program) { failed = true; root.dataset.gl = 'false'; const fb = document.createElement('div'); fb.className = 'pcp-layer pcp-fallback'; canvas.replaceWith(fb); }
  else {
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.useProgram(program);
    for (const n of UNIFORMS) U[n] = gl.getUniformLocation(program, n);
    let last = performance.now(), clock = 0, mShown = 0, igShown = 0, doneLift = false; const ptr = { x: 0, y: 0, on: 0, nx: 0, ny: 0 };
    const rgb = (hex, fb) => pcpHex(hex) || pcpHex(fb) || [0, 0, 0], exposure = 1.25 * Math.min(2, Math.max(0.4, o.intensity)), spd = Math.min(3, Math.max(0, o.speed)), qual = Math.min(1, Math.max(0.35, o.quality));
    const frame = () => {
      if (destroyed) return; raf2 = requestAnimationFrame(frame); const now = performance.now();
      const dt = Math.max(0, Math.min(0.064, (now - last) / 1000)); last = now; if (document.hidden || gl.isContextLost()) return;
      if (!still) clock += dt * spd; const t = still ? 4 : clock % 600;
      const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.max(1, Math.round(canvas.clientWidth * dpr * qual)), ch = Math.max(1, Math.round(canvas.clientHeight * dpr * qual));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; } const aspect = cw / ch;
      const since = now - phaseAt, k = (rate) => (still ? 1 : 1 - Math.exp(-dt * rate)), loading = phase === 'load';
      const mTarget = loading ? pcpMorph(shown) : 4; mShown += (mTarget - mShown) * k(loading && mTarget < mShown ? 30 : 6);
      if (loading) igShown = 0; else if (phase === 'ignite') igShown = Math.max(igShown, clamp01(since / igniteMs)); else igShown += (1 - igShown) * k(5);
      const lift = phase === 'lift' ? clamp01(since / liftMs) : 0, rig = pcpRig(mShown, aspect), ig = pcpIgnite(igShown, aspect);
      const tg = pointer.cur; ptr.on += ((tg && !still ? 1 : 0) - ptr.on) * k(4);
      if (tg) { ptr.nx += (tg.x - ptr.nx) * k(7); ptr.ny += (tg.y - ptr.ny) * k(7); } else { ptr.nx += (0 - ptr.nx) * k(1.5); ptr.ny += (0 - ptr.ny) * k(1.5); }
      ptr.x = ptr.nx * (aspect * rig.zoom) * 0.5; ptr.y = -ptr.ny * rig.zoom * 0.5;
      const mode = loading ? 0 : ig.mode, breathe = still ? 0 : Math.sin(t * 1.3) * 0.025 * mode, zoomIn = still ? 1 : Math.exp(sm(lift) * 5.4);
      const starX = loading ? rig.ax : ig.x + ptr.x * 0.04 * mode, starY = loading ? rig.ay : ig.y + ptr.y * 0.04 * mode, starR = (loading ? HEAD_R : ig.r) * (1 + breathe) * zoomIn, fade = 1 - lift, comet = loading ? 1 : ig.comet;
      gl.viewport(0, 0, cw, ch); gl.uniform2f(U.uRes, cw, ch); gl.uniform1f(U.uZoom, rig.zoom); gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uApex, loading ? rig.ax : ig.x, loading ? rig.ay : ig.y); gl.uniform1f(U.uBeta, rig.beta); gl.uniform1f(U.uPhi, rig.phi); gl.uniform1f(U.uRho0, rig.rho0);
      gl.uniform1f(U.uKv, rig.kv * (1 + (loading ? 0 : ig.retract) * 5)); gl.uniform1f(U.uVf, rig.vf); gl.uniform1f(U.uNarrow, rig.narrow); gl.uniform1f(U.uWave, rig.wave); gl.uniform1f(U.uBulge, rig.bulge); gl.uniform1f(U.uEdge, rig.edge); gl.uniform1f(U.uClosed, rig.closed);
      gl.uniform1f(U.uComet, comet); gl.uniform1f(U.uLines, (loading ? rig.lines : ig.lines) * fade); gl.uniform1f(U.uLineDir, pcpHead(aspect).tail);
      gl.uniform2f(U.uStarC, starX, starY); gl.uniform1f(U.uStarR, starR); gl.uniform1f(U.uStarAmt, loading ? rig.star : 1); gl.uniform1f(U.uStarMode, mode);
      gl.uniform1f(U.uStarRot, (loading ? 0 : ig.rot) + (still ? 0 : Math.sin(t * 0.3) * 0.05 * mode)); gl.uniform1f(U.uSwirl, mode * (0.55 + (still ? 0 : Math.sin(t * 0.7) * 0.08)));
      gl.uniform2f(U.uTilt, (0.32 - ptr.nx * 0.4 * ptr.on) * mode * fade, (0.22 + ptr.ny * 0.34 * ptr.on) * mode * fade);
      gl.uniform1f(U.uHoleOpen, still ? lift : sm(clamp01(lift / 0.4))); gl.uniform1f(U.uBloom, loading || still ? 0 : ig.bloom * (1 - lift)); gl.uniform1f(U.uFlash, 0);
      gl.uniform3f(U.uPtr, ptr.x, ptr.y, ptr.on * (loading ? 1 : 1 - mode));
      const C = colors, D = OCTOBER_PALETTE; gl.uniform3fv(U.uBg, rgb(C.background, D.background)); gl.uniform3fv(U.uBlue, rgb(C.blue, D.blue)); gl.uniform3fv(U.uViolet, rgb(C.violet, D.violet)); gl.uniform3fv(U.uMagenta, rgb(C.magenta, D.magenta)); gl.uniform3fv(U.uCyan, rgb(C.cyan, D.cyan)); gl.uniform3fv(U.uGold, rgb(C.gold, D.gold));
      gl.uniform1f(U.uExposure, exposure); gl.uniform1f(U.uGrain, still ? 0 : 0.035); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf2 = requestAnimationFrame(frame);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf2); failed = true; root.dataset.gl = 'false'; });
  }

  // ── المراحل ──
  const phaseTimer = setInterval(() => {
    if (destroyed) return; const since = performance.now() - phaseAt;
    if (phase === 'reveal' && since >= holdMs) setPhase('lift');
    else if (phase === 'lift' && since >= liftMs) { setPhase('done'); finishDone(); }
    // من غير WebGL مفيش حلقة رسم؛ المرحلة بتتحرك بالتايمر
    if (failed && phase === 'ignite' && since >= igniteMs) setPhase('reveal');
  }, 60);
  const finishDone = () => { clearInterval(phaseTimer); if (resolveFin) { resolveFin(); resolveFin = null; } };
  const onActivate = () => { if (!finishReq) return; if (phase === 'load') rush = true; else if (phase === 'ignite') setPhase('reveal'); else if (phase === 'reveal') setPhase('lift'); };
  gate.addEventListener('click', (e) => { if (e.target.closest('.pcp-adhost')) return; onActivate(); });
  gate.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } });
  gate.addEventListener('pointermove', (e) => { const r = root.getBoundingClientRect(); pointer.cur = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 }; });
  gate.addEventListener('pointerleave', () => { pointer.cur = null; });

  return {
    root,
    get phase() { return phase; },
    // p: التقدم الأكيد (0..1) · ceil: أقصى تقدم تقديري لحد التحديث الجاي (بيزحف ناحيته ببطء)
    setProgress(p, c) { base = Math.max(base, clamp01(p)); ceil = Math.max(base, clamp01(c == null ? p : c)); baseAt = performance.now(); },
    setStatus(t) { stEl.textContent = t || ''; },
    // بيخلّص التقدم لـ100٪ ويشغّل الإشعال ثم البوابة؛ بيرجع Promise بيتحل لما البوابة تتفتح
    finish() { if (phase === 'done') return Promise.resolve(); finishReq = true; gate.dataset.skip = 'true'; srEl.textContent = 'اتحمّلت اللعبة'; return new Promise((res) => { resolveFin = res; }); },
    destroy() { destroyed = true; cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearInterval(phaseTimer); ro && ro.disconnect(); if (gl && !gl.isContextLost()) { try { gl.deleteProgram(program); gl.deleteBuffer(buffer); const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); } catch (e) { /* ignore */ } } root.remove(); host.classList.remove('pcp-on'); if (resolveFin) { resolveFin(); resolveFin = null; } },
  };
}
