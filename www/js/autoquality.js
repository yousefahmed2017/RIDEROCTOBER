// جودة الرسم التلقائية: بتراقب الـFPS وبتنزّل/ترفع مستوى الجرافيك (نقي بدون DOM)
export const GFX_LEVELS = [
  { pr: 1, shadows: false, density: 'low' },
  { pr: 1.25, shadows: false, density: null },
  { pr: 1.5, shadows: false, density: null },
  { pr: 2, shadows: true, density: null },
];
export function createGovernor({ start = 1, max = GFX_LEVELS.length - 1, onLevel = () => {}, lowFps = 38, highFps = 57, win = 2 } = {}) {
  const g = { level: start, acc: 0, frames: 0, lowRuns: 0, highRuns: 0, since: 0, now: 0, block: {}, fps: 60 };
  g.tick = (dt) => {
    if (dt <= 0 || dt > 0.25) return; // تبويب مخفي/تهنيج لحظي: نتجاهله
    g.now += dt; g.acc += dt; g.frames++;
    if (g.acc < win) return;
    g.fps = g.frames / g.acc; g.acc = 0; g.frames = 0;
    if (g.fps < lowFps) { g.lowRuns++; g.highRuns = 0; } else if (g.fps > highFps) { g.highRuns++; g.lowRuns = 0; } else { g.lowRuns = 0; g.highRuns = 0; }
    if (g.lowRuns >= 2 && g.level > 0 && g.now - g.since > 3) { g.block[g.level] = g.now + 60; g.level--; g.lowRuns = 0; g.since = g.now; onLevel(g.level, GFX_LEVELS[g.level]); }
    else if (g.highRuns >= 5 && g.level < max && g.now - g.since > 10 && !(g.block[g.level + 1] > g.now)) { g.level++; g.highRuns = 0; g.since = g.now; onLevel(g.level, GFX_LEVELS[g.level]); }
  };
  return g;
}
