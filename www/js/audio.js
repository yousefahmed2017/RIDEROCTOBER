// مؤثرات صوتية متولدة بالكود (Web Audio): موتور، كلاكس، تنبيهات. مفيش ملفات صوت خارجية.
export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.vol = { master: 1, sfx: 1, eng: 1 }; }
  setVol(k, v) { this.vol[k] = Math.max(0, Math.min(1, v)); if (this.master) this.master.gain.value = 0.5 * this.vol.master; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain(); this.master.gain.value = 0.5 * this.vol.master; this.master.connect(ctx.destination);
    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth';
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 500;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(this.lp); this.eng2.connect(this.lp); this.lp.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.start(); this.eng2.start();
  }
  engine(speed, throttle, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 48 + Math.abs(speed) * 4.2 + throttle * 18;
    this.eng.frequency.setTargetAtTime(f, t, 0.08); this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.lp.frequency.setTargetAtTime(380 + Math.abs(speed) * 28 + throttle * 220, t, 0.1);
    this.engGain.gain.setTargetAtTime(active && this.on ? (0.035 + throttle * 0.03) * this.vol.eng : 0, t, 0.1);
  }
  _tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    vol *= this.vol.sfx; if (vol < 0.0005) return; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  horn(vol = 1) { this._tone(392, 0.35, 'square', 0.07 * vol); this._tone(494, 0.35, 'square', 0.07 * vol); }
  ding() { this._tone(880, 0.12, 'sine', 0.18); setTimeout(() => this._tone(1320, 0.18, 'sine', 0.18), 110); }
  win() { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'triangle', 0.16), i * 90)); }
  coin() { this._tone(1568, 0.08, 'square', 0.07); setTimeout(() => this._tone(2093, 0.16, 'square', 0.07), 70); }
  whoosh() { this._tone(300, 0.22, 'sine', 0.08, 900); }
  pop() { this._tone(520, 0.1, 'triangle', 0.14, 380); }
  chime() { [784, 988, 1175].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'sine', 0.14), i * 80)); }
  fail() { this._tone(300, 0.5, 'sawtooth', 0.14, -200); }
  // تدوير الموتور (مارش) ثم اشتغال
  crank(dur = 1.7) {
    if (!this.ctx || !this.on) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 420; o.frequency.setValueAtTime(34, t); o.frequency.linearRampToValueAtTime(52, t + dur * 0.7); o.frequency.exponentialRampToValueAtTime(110, t + dur);
    g.gain.setValueAtTime(0.0001, t); for (let k = 0; k * 0.1 < dur * 0.72; k++) { g.gain.setValueAtTime(0.16, t + k * 0.1); g.gain.setValueAtTime(0.03, t + k * 0.1 + 0.055); }
    g.gain.setValueAtTime(0.13, t + dur * 0.76); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.35);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.4);
  }
  tick() { this._tone(520, 0.05, 'square', 0.05); }
  siren() { this._tone(700, 0.18, 'square', 0.08); setTimeout(() => this._tone(930, 0.18, 'square', 0.08), 180); }
  bump() { this._tone(90, 0.18, 'square', 0.2, -40); }
}
