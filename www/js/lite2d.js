// النسخة الخفيفة 2D: نفس الخريطة والفيزيا والطلبات بس من فوق على كانفس واحد (من غير مباني/ظلال/مجسمات 3D)
import { newBike, stepBike } from './physics.js';
import { makeOffer, retimeOffer, startMission, tickMission, scoreMission, hitMission } from './missions.js';
import { LOADS } from './loads.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ROAD_COL = { 6: '#7d8aa3', 5: '#7d8aa3', 4: '#6f7d96', 3: '#617089', 2: '#556480', 1: '#4a5871', 0: '#3d4a62' };

export class Lite {
  // deps: { canvas, data, roads, profile, params, keys, touch, half, hooks:{ onDone(m,res), onFail(m), toast(msg,cls) } }
  constructor(d) {
    Object.assign(this, d); this.ctx = this.canvas.getContext('2d'); this.rnd = Math.random;
    this.bike = newBike(0, 0, 0); this.steerS = 0; this.m = null; this.wait = 1.5; this.clock = 0; this.t = 0;
    this.bb = this.roads.roads.map((r) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of r.pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; } return [x0, x1, z0, z1]; });
    const n = this.roads.nearest(0, 0, 600) || this.roads.randomPoint(this.rnd, 2), h = n.hx !== undefined ? Math.atan2(n.hx, -n.hz) : 0;
    Object.assign(this.bike, { x: n.x, z: n.z, heading: h });
  }
  resize() { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); this.canvas.width = Math.round(window.innerWidth * dpr); this.canvas.height = Math.round(window.innerHeight * dpr); }
  step(dt) {
    const b = this.bike, k = this.keys, t = this.touch; this.clock += dt;
    const steerT = (k.ArrowRight || k.KeyD || t.r ? 1 : 0) - (k.ArrowLeft || k.KeyA || t.l ? 1 : 0);
    this.steerS += (steerT - this.steerS) * Math.min(1, dt * (steerT === 0 ? 22 : 16));
    const brake = k.ArrowDown || k.KeyS || k.Space || t.brake ? 1 : 0, manual = !!(k.ArrowUp || k.KeyW || t.gas);
    const throttle = manual || (this.profile.settings.autoGas && !brake) ? 1 : 0;
    const q = this.roads.nearest(b.x, b.z, 30), onRoad = !!q && q.d <= q.road.w / 2 + 1.2;
    stepBike(b, { throttle, brake, steer: this.steerS, reverse: !!k.KeyR, roadHeading: q && q.hx !== undefined ? Math.atan2(q.hx, -q.hz) : undefined }, dt, onRoad, this.params);
    b.x = clamp(b.x, -this.half + 12, this.half - 12); b.z = clamp(b.z, -this.half + 12, this.half - 12);
    if (b.fell) hitMission(this.m, 'fall');
    this.throttle = throttle;
    if (!this.m) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const o = makeOffer({ completed: this.profile.deliveries, pos: b, pois: this.data.pois, roads: this.roads, rnd: this.rnd });
        retimeOffer(o, b); this.m = startMission(o); this.hooks.toast('طلب جديد: روح استلمه 📦', 'good');
      }
    } else {
      const ev = tickMission(this.m, dt, b, b.risk);
      if (ev === 'pickedup') this.hooks.toast('استلمت الطلب! وصّله 🔥', 'good');
      else if (ev === 'done') { const m = this.m, res = scoreMission(m, this.profile.streak); this.m = null; this.wait = 3; this.hooks.onDone(m, res); }
      else if (ev === 'fail') { const m = this.m; this.m = null; this.wait = 3; this.hooks.onFail(m); }
    }
  }
  draw() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, b = this.bike, s = Math.min(W, H) / 200;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0f1b2e'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H * 0.66); c.rotate(-b.heading); c.scale(s, s); c.translate(-b.x, -b.z);
    const R = Math.hypot(W, H) / s * 0.62, x0 = b.x - R, x1 = b.x + R, z0 = b.z - R, z1 = b.z + R;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // حدود الخريطة
    c.strokeStyle = 'rgba(255,77,109,.6)'; c.lineWidth = 3; c.strokeRect(-this.half, -this.half, this.half * 2, this.half * 2);
    const vis = []; this.roads.roads.forEach((r, i) => { const bb = this.bb[i]; if (bb[1] < x0 || bb[0] > x1 || bb[3] < z0 || bb[2] > z1) return; vis.push(r); });
    const path = (r) => { c.beginPath(); r.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.z) : c.moveTo(p.x, p.z))); };
    for (const r of vis) { if (r.deck) continue; c.strokeStyle = '#08111f'; c.lineWidth = Math.max(4, (r.w || 6) + 2.5); path(r); c.stroke(); }
    for (const r of vis) { c.strokeStyle = r.deck ? '#8b94a8' : ROAD_COL[r.rank] || ROAD_COL[1]; c.lineWidth = Math.max(2.5, r.w || 6); path(r); c.stroke(); }
    for (const r of vis) if (r.rank >= 3 && !r.deck) { c.strokeStyle = 'rgba(255,200,61,.55)'; c.lineWidth = 0.5; c.setLineDash([4, 5]); path(r); c.stroke(); c.setLineDash([]); }
    // المعالم
    for (const p of this.data.pois) { if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue; c.fillStyle = p.kind === 'food' ? '#ff7a1a' : '#5aa9ff'; c.beginPath(); c.arc(p.x, p.z, 2.2, 0, 7); c.fill(); }
    // هدف الطلب
    const m = this.m;
    if (m) {
      const tgt = m.stage === 'dropoff' ? m.dropoff : m.pickup, col = m.stage === 'dropoff' ? '#19c2a0' : '#ff7a1a', pulse = 1 + 0.18 * Math.sin(this.clock * 5);
      c.fillStyle = col + '55'; c.beginPath(); c.arc(tgt.x, tgt.z, 12 * pulse, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(tgt.x, tgt.z, 5, 0, 7); c.fill();
    }
    c.restore();
    // سهم اتجاه الهدف لو برّه الشاشة
    if (m) {
      const tgt = m.stage === 'dropoff' ? m.dropoff : m.pickup, rel = Math.atan2(tgt.x - b.x, -(tgt.z - b.z)) - b.heading, d = Math.hypot(tgt.x - b.x, tgt.z - b.z);
      if (d * s > Math.min(W, H) * 0.42) { const px = W / 2 + Math.sin(rel) * Math.min(W, H) * 0.36, py = H * 0.66 - Math.cos(rel) * Math.min(W, H) * 0.36; c.save(); c.translate(px, py); c.rotate(rel); c.fillStyle = m.stage === 'dropoff' ? '#19c2a0' : '#ff7a1a'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -18); c.lineTo(13, 12); c.lineTo(0, 6); c.lineTo(-13, 12); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    }
    // الموتوسيكل (دايمًا لفوق لأن الكاميرا بتلف معاه)
    c.save(); c.translate(W / 2, H * 0.66); c.scale(s, s); c.rotate(b.lean * 0.4); c.fillStyle = '#fff'; c.strokeStyle = '#ff7a1a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -5); c.lineTo(3.2, 4.5); c.lineTo(0, 2.4); c.lineTo(-3.2, 4.5); c.closePath(); c.fill(); c.stroke(); c.restore();
    // معلومات الطلب (فوق في النص)
    const fz = Math.max(13, Math.round(H / 38)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${fz}px Cairo, Tahoma, Arial`;
    const line = m ? ((LOADS[m.load] || LOADS.parcel).glyph + ' ' + (m.stage === 'pickup' ? 'استلم من: ' : 'وصّل لـ: ') + (m.stage === 'pickup' ? m.pickup : m.dropoff).name) : 'بندوّر على طلب…';
    const sub = m ? `📍 ${Math.round(m.distToTarget)} م · ⏱ ${Math.max(0, Math.ceil(m.timeLeft))} ث · +${m.reward}` : 'بدون بنزين في النسخة الخفيفة';
    const bw = Math.min(W * 0.9, 560), bx = W / 2 - bw / 2, by = Math.max(10, fz * 0.6);
    c.fillStyle = 'rgba(14,26,43,.78)'; c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, fz * 3.2, 14) : c.rect(bx, by, bw, fz * 3.2); c.fill();
    c.fillStyle = '#F7F1E3'; c.fillText(line, W / 2, by + fz * 1.0, bw - 20); c.fillStyle = '#FFC83D'; c.font = `700 ${Math.round(fz * 0.85)}px Cairo, Tahoma, Arial`; c.fillText(sub, W / 2, by + fz * 2.3, bw - 20);
  }
}
