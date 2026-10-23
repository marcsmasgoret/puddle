// ─────────────────────────────────────────────────────────────────────────────
// Sound: everything is synthesised live with the Web Audio API (no audio
// files), and several sounds follow directly from the physics:
//
//  • Drops, rain and splashes "plink" because a drop landing on water traps
//    a tiny air bubble, which rings at its Minnaert resonance
//        f = (1 / 2πR) √(3 γ p₀ / ρ) ≈ 3.26 / R   [Hz, R in metres]
//    (γ = 1.4, p₀ = 101 kPa, ρ = 1000 kg/m³). A 0.5 mm bubble sings at
//    ~6.5 kHz; bigger drops trap bigger bubbles and plunk lower. The pitch
//    rises slightly as the bubble is pinched toward the surface.
//  • Each fluid slaps differently: water is a splash; honey a slow, low
//    "gloop" (viscous, no droplets); mercury a bright metallic ring (it is a
//    metal with a stiff, dense surface); oobleck a dull thud (it jams solid).
//  • Ambience per place, season, time and weather: wind, waves or lapping
//    water, birdsong by day, crickets on summer nights, rain hiss, a
//    crackling campfire, hot-tub bubbles.
//
// The context starts on the first touch (browsers require a user gesture).
// One master volume, one mute.
// ─────────────────────────────────────────────────────────────────────────────
import type { FluidId } from '../physics/fluids';

const MINNAERT = 3.26; // Hz·m

export interface AmbienceSpec {
  wind: number;
  waves: number; // surf (beach, inlet)
  lapping: number; // lake against a dock or rock
  traffic: number;
  rain: number;
  birds: number;
  crickets: number;
  frogs: number;
  fire: number;
  bubbles: number; // hot tub
  loons: number;
}

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private beds: Partial<Record<keyof AmbienceSpec, { gain: GainNode; stop: () => void }>> = {};
  private spec: AmbienceSpec | null = null;
  private timers: number[] = [];
  volume = 0.7;
  muted = false;

  /** call from a user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.amb.gain.value = 0.55;
    // 2 s of white noise, reused by every noisy sound
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    this.applyVolume();
    if (this.spec) this.setAmbience(this.spec);
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyVolume();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
  }
  private applyVolume() {
    if (!this.ctx) return;
    const v = this.muted ? 0 : this.volume * this.volume; // perceptual taper
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ── building blocks ───────────────────────────────────────────────────────
  private noiseSrc(loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    s.loopStart = Math.random();
    return s;
  }
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  /** filtered noise burst */
  private burst(type: BiquadFilterType, freq: number, q: number, peak: number, attack: number, decay: number, delay = 0, out: AudioNode = this.sfx) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const s = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, attack, decay);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + attack + decay + 0.05);
  }
  /** a sine (or other) tone gliding from f0 to f1 */
  private tone(f0: number, f1: number, peak: number, attack: number, decay: number, delay = 0, type: OscillatorType = 'sine', out: AudioNode = this.sfx) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** the ring of a bubble of radius r [m] pinched off by a drop (Minnaert) */
  bubble(r: number, gain = 0.15, delay = 0, out: AudioNode = this.sfx) {
    if (!this.ctx) return;
    const f = MINNAERT / Math.max(r, 2e-4);
    if (f > 16000) return;
    this.tone(f * 0.9, f * 1.25, gain, 0.002, 0.03 + r * 30, delay, 'sine', out);
  }

  // ── effects ───────────────────────────────────────────────────────────────
  slap(fluid: FluidId, strength: number, sprayMl: number) {
    if (!this.ctx) return;
    const s = 0.25 + strength * 0.75;
    if (fluid === 'water') {
      this.tone(160, 55, 0.5 * s, 0.003, 0.18); // the hand hitting the layer
      this.burst('bandpass', 1400, 0.7, 0.45 * s, 0.003, 0.25);
      this.splashTail(sprayMl, 0.0015);
    } else if (fluid === 'honey') {
      // heavy and sticky: a low gloop, then a slow suction pop
      this.tone(110, 60, 0.6 * s, 0.01, 0.45);
      this.burst('lowpass', 500, 1, 0.3 * s, 0.01, 0.4);
      this.tone(220, 360, 0.18 * s, 0.02, 0.18, 0.28);
    } else if (fluid === 'mercury') {
      // a metallic, dense ring: inharmonic partials decaying slowly
      this.tone(120, 70, 0.45 * s, 0.003, 0.15);
      for (const [f, a] of [[2150, 0.12], [3370, 0.09], [5260, 0.06], [7110, 0.04]]) this.tone(f, f * 0.99, a * s, 0.002, 0.9, 0, 'sine');
      this.splashTail(sprayMl, 0.0012);
    } else {
      // oobleck jams: a short, dull thud, nothing else
      this.tone(90, 45, 0.7 * s, 0.002, 0.12);
      this.burst('lowpass', 300, 1, 0.35 * s, 0.002, 0.08);
    }
  }

  /** splash spray landing back: a scatter of bubble plinks */
  private splashTail(sprayMl: number, rMean: number) {
    const n = Math.min(24, Math.round(sprayMl * 0.8));
    for (let k = 0; k < n; k++) this.bubble(rMean * (0.4 + Math.random() * 1.6), 0.05, 0.12 + Math.random() * 0.6);
  }

  dropLanded(r: number, onWater: boolean) {
    if (!this.ctx) return;
    if (onWater) this.bubble(r * 0.4, 0.04);
    else this.burst('highpass', 3000, 0.7, 0.015, 0.001, 0.02);
  }

  stir(speed: number) {
    if (!this.ctx || speed < 0.05) return;
    this.burst('bandpass', 700 + speed * 900, 0.8, Math.min(0.12, speed * 0.08), 0.03, 0.12);
  }

  squeak() {
    if (!this.ctx) return;
    // a rubber duck: air forced through a reed, pitch up then down
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.linearRampToValueAtTime(2100, t + 0.08);
    o.frequency.linearRampToValueAtTime(1600, t + 0.28);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 3;
    const g = ctx.createGain();
    this.env(g, t, 0.18, 0.02, 0.3);
    o.connect(f).connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.4);
  }

  skip(speed: number, fluid: FluidId) {
    if (!this.ctx) return;
    if (fluid === 'mercury') this.tone(3000, 2900, 0.08, 0.002, 0.4);
    if (fluid === 'oobleck') return this.tone(260, 140, 0.25, 0.002, 0.06, 0, 'triangle');
    this.burst('bandpass', 2500, 1.2, 0.12 + speed * 0.03, 0.002, 0.06);
    this.bubble(0.0015 + Math.random() * 0.001, 0.08, 0.01);
  }

  plop() {
    if (!this.ctx) return;
    this.tone(420, 140, 0.25, 0.003, 0.22);
    this.bubble(0.004, 0.12, 0.03);
  }

  crack() {
    if (!this.ctx) return;
    for (let k = 0; k < 6; k++) this.burst('highpass', 2500 + Math.random() * 3000, 1, 0.12, 0.001, 0.03 + Math.random() * 0.05, Math.random() * 0.15);
    this.tone(180, 90, 0.15, 0.002, 0.2);
  }

  entry(mass: number, speed: number, fluid: FluidId) {
    if (!this.ctx) return;
    const s = Math.min(1, mass * speed * 8);
    if (fluid === 'oobleck') return this.tone(120, 60, 0.4 * s + 0.1, 0.002, 0.1);
    this.tone(260, 110, 0.3 * s + 0.08, 0.003, 0.15);
    this.splashTail(s * 10, 0.0018);
  }

  cast() {
    if (!this.ctx) return;
    this.burst('bandpass', 1800, 2, 0.06, 0.15, 0.35);
  }
  nibble() {
    if (!this.ctx) return;
    this.bubble(0.003, 0.06);
  }

  // ── ambience ──────────────────────────────────────────────────────────────
  setAmbience(spec: AmbienceSpec) {
    this.spec = spec;
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const k of Object.keys(spec) as (keyof AmbienceSpec)[]) {
      const level = spec[k];
      let bed = this.beds[k];
      if (!bed && level > 0) bed = this.beds[k] = this.makeBed(k);
      bed?.gain.gain.setTargetAtTime(level, ctx.currentTime, 1.2);
    }
    // sparse events: birdsong, crickets, frogs, fire crackle, loons
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
    const every = (ms: number, fn: () => void) => this.timers.push(window.setInterval(() => document.hidden || fn(), ms));
    if (spec.birds > 0) every(900, () => Math.random() < 0.35 * spec.birds && this.birdsong(spec.birds));
    if (spec.crickets > 0) every(350, () => Math.random() < 0.6 && this.cricket(spec.crickets));
    if (spec.frogs > 0) every(1300, () => Math.random() < 0.4 && this.frog(spec.frogs));
    if (spec.fire > 0) every(120, () => Math.random() < 0.35 && this.crackle(spec.fire));
    if (spec.loons > 0) every(9000, () => Math.random() < 0.3 && this.loon(spec.loons));
    if (spec.rain > 0) every(60, () => this.bubble(0.0004 + Math.random() * 0.0012, 0.025 * spec.rain, 0, this.amb));
    if (spec.bubbles > 0) every(70, () => this.bubble(0.002 + Math.random() * 0.004, 0.05 * spec.bubbles, 0, this.amb));
  }

  /** continuous beds: shaped noise loops */
  private makeBed(kind: keyof AmbienceSpec) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.amb);
    const s = this.noiseSrc(true);
    const f = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const mod = ctx.createGain();
    mod.gain.value = 0.6;
    lfo.connect(lfoGain).connect(mod.gain);
    s.connect(f).connect(mod).connect(gain);
    const set = (type: BiquadFilterType, freq: number, q: number, rate: number, depth: number) => {
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      lfo.frequency.value = rate;
      lfoGain.gain.value = depth;
    };
    if (kind === 'wind') set('lowpass', 420, 0.8, 0.09, 0.45);
    else if (kind === 'waves') set('lowpass', 900, 0.6, 0.11, 0.55); // swell every ~9 s
    else if (kind === 'lapping') set('bandpass', 500, 0.8, 0.45, 0.4);
    else if (kind === 'traffic') set('lowpass', 160, 0.7, 0.05, 0.3);
    else if (kind === 'rain') set('highpass', 2200, 0.5, 0.2, 0.08);
    else if (kind === 'fire') set('lowpass', 250, 0.7, 0.3, 0.3);
    else if (kind === 'bubbles') set('lowpass', 700, 0.7, 2.5, 0.3);
    else set('bandpass', 3000, 1, 0.1, 0.0); // event-only kinds stay silent
    s.start();
    lfo.start();
    return { gain, stop: () => (s.stop(), lfo.stop()) };
  }

  private birdsong(level: number) {
    // a short phrase of FM chirps
    const base = 2600 + Math.random() * 2200;
    const n = 2 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const f = base * (0.85 + Math.random() * 0.4);
      this.tone(f, f * (Math.random() < 0.5 ? 1.35 : 0.75), 0.03 * level, 0.01, 0.07, k * 0.11, 'sine', this.amb);
    }
  }
  private cricket(level: number) {
    for (let k = 0; k < 3; k++) this.tone(4600, 4580, 0.012 * level, 0.002, 0.018, k * 0.035, 'sine', this.amb);
  }
  private frog(level: number) {
    for (let k = 0; k < 2; k++) this.tone(260, 220, 0.05 * level, 0.01, 0.08, k * 0.15, 'triangle', this.amb);
  }
  private crackle(level: number) {
    this.burst('highpass', 1800 + Math.random() * 2500, 1, 0.05 * level, 0.001, 0.02 + Math.random() * 0.03, 0, this.amb);
  }
  private loon(level: number) {
    // the common loon's wail: a slow rise, hold and fall
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(1050, t + 0.6);
    o.frequency.setValueAtTime(1050, t + 1.5);
    o.frequency.linearRampToValueAtTime(880, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * level, t + 0.3);
    g.gain.setValueAtTime(0.05 * level, t + 1.9);
    g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(this.amb);
    o.start(t);
    o.stop(t + 2.5);
  }
}

/** a gentle buzz on phones that can vibrate; silently nothing elsewhere */
export function haptic(ms: number) {
  try {
    navigator.vibrate?.(Math.round(ms));
  } catch {
    /* not supported */
  }
}
