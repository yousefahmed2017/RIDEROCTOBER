// بروفايل اللاعب + الإحصائيات (محفوظة على الجهاز)
import { START_MONEY, normalizeBike, resolveBikeId } from './bikes.js';
const KEY = 'october-rider-profile-v1';
export const COLORS = [0xff7a1a, 0x19c2a0, 0xff4d6d, 0xffc83d, 0x5aa9ff, 0xb388ff];

const defaults = () => ({
  id: Math.random().toString(36).slice(2, 10),
  name: 'كابتن ' + Math.floor(100 + Math.random() * 900),
  color: COLORS[0],
  points: 0, deliveries: 0, failed: 0, streak: 0, bestStreak: 0,
  totalTime: 0, starsSum: 0, rated: 0, distance: 0,
  settings: { assist: 1, autoGas: true, density: 'mid', hideBox: false, stunts: true }, outfit: null, money: START_MONEY, bike: 'ninja', owned: { ninja: true }, upg: {}, fuel: 14, patrols: 0, endlessRuns: 0, bestEndless: 0, fines: 0, totalEarned: 0, bestShift: 0, bestRace: 0, races: 0,
});

export function loadProfile() {
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.id) { const d = defaults(); return normalizeBike({ ...d, ...j, settings: { ...d.settings, ...(j.settings || {}) } }); } } catch (e) { /* ignore */ }
  return defaults();
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } }

export const publicProfile = (p) => ({ outfit: p.outfit || null, id: p.id, name: p.name, color: p.color, points: p.points, deliveries: p.deliveries, streak: p.streak, bike: resolveBikeId(p.bike), level: levelOf(p.points), earned: p.totalEarned || 0, shift: p.bestShift || 0, bestRace: p.bestRace || 0 });
export const levelOf = (points) => 1 + Math.floor(Math.sqrt(points / 120));
export const avgTime = (p) => (p.deliveries ? p.totalTime / p.deliveries : 0);
export const avgRating = (p) => (p.rated ? p.starsSum / p.rated : 0);
export const successRate = (p) => { const t = p.deliveries + p.failed; return t ? p.deliveries / t : 0; };

export function recordSuccess(p, m, res) {
  p.points += res.total; p.money += Math.round(res.total * 0.6); p.deliveries++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak);
  p.totalTime += m.elapsed; p.starsSum += res.stars; p.rated++; p.distance += m.dist;
  saveProfile(p);
}
export function recordFail(p) { p.failed++; p.streak = 0; saveProfile(p); }
