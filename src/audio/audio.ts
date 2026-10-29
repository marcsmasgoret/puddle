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
//  • A water slap is built the way it happens: the smack of the palm, the
//    crackle of the shattering sheet, the low "bloop" of the cavity's
//    bubble, a cloud of small bubbles and the wash; then each spray drop
//    is heard landing where the simulation drops it, panned on screen.
//  • Each fluid slaps differently: water is a splash; honey a slow, low
//    "gloop" (viscous, no droplets); mercury a bright metallic ring (it is a
//    metal with a stiff, dense surface); oobleck a dull thud (it jams solid).
//  • Nature (nature.ts) and music (music.ts) are separate layers with their
//    own volume, so the puddle can sit quietly next to your own music.
//
// The context starts on the first touch (browsers require a user gesture).
//
// Mix:  effects ─┐
//       nature ──┼─ reverb send ─ convolver ─┐
//       music ───┘                           ├─ compressor ─ out
//       (dry) ───────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────
import type { FluidId } from '../physics/fluids';
import { Music } from './music';
import { Nature, type Scene } from './nature';

const MINNAERT = 3.26; // Hz·m
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A synthetic room / landscape impulse response: decaying stereo noise. */
function impulse(ctx: AudioContext, seconds: number, decay: number, pre = 0.01) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let k = 0; k < n; k++) {
      const t = k / ctx.sampleRate;
      lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; // a little darker than white
      d[k] = t < pre ? 0 : lp * Math.pow(1 - t / seconds, decay);
    }
  }
  return b;
}

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private natureBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private music: Music | null = null;
  private nature: Nature | null = null;
  private scene: Scene | null = null;
  private analyser: AnalyserNode | null = null;
  /** effects and nature */
  volume = 0.7;
  musicVolume = 0.5;
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
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    comp.connect(this.analyser);
    // the shared reverb: a soft outdoor space
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 2.8, 3.2);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    verb.connect(verbOut).connect(this.master);
    // the far shore: a long, dark echo for loons, wolves and horns
    const far = ctx.createConvolver();
    far.buffer = impulse(ctx, 5, 2.2, 0.12);
    const farLp = ctx.createBiquadFilter();
    farLp.type = 'lowpass';
    farLp.frequency.value = 2200;
    const farOut = ctx.createGain();
    farOut.gain.value = 0.5;
    far.connect(farLp).connect(farOut).connect(this.master);

    this.sfx = ctx.createGain();
    this.natureBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    for (const [bus, send] of [[this.sfx, 0.12], [this.natureBus, 0.3], [this.musicBus, 0.42]] as [GainNode, number][]) {
      bus.connect(this.master);
      const g = ctx.createGain();
      g.gain.value = send;
      bus.connect(g).connect(verb);
    }
    const natureIn = ctx.createGain();
    natureIn.gain.value = 0.7;
    natureIn.connect(this.natureBus);
    const farSend = ctx.createGain();
    farSend.connect(far);
    // music gets a gentle high cut so it sits behind the scene
    const musicIn = ctx.createBiquadFilter();
    musicIn.type = 'lowpass';
    musicIn.frequency.value = 7000;
    musicIn.connect(this.musicBus);
    // 2 s of white noise, reused by every noisy sound
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    this.nature = new Nature(ctx, this.noise, natureIn, farSend);
    this.music = new Music(ctx, this.noise, musicIn);
    this.applyVolume();
    if (this.scene) this.setScene(this.scene);
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyVolume();
  }
  setMusicVolume(v: number) {
    this.musicVolume = v;
    this.applyVolume();
  }
  setMuted(m: boolean) {
    this.muted = m;
    this.applyVolume();
  }
  private applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.05);
    // perceptual taper
    this.sfx.gain.setTargetAtTime(this.volume * this.volume, t, 0.05);
    this.natureBus.gain.setTargetAtTime(this.volume * this.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * this.musicVolume * 0.9, t, 0.05);
    // stop composing when nobody can hear it
    if (this.music) {
      if (this.muted || this.musicVolume < 0.01) this.music.stop();
      else this.music.start();
    }
  }

  /** output level right now: peak and RMS of the last ~40 ms (tests, meters) */
  meter() {
    if (!this.analyser) return { peak: 0, rms: 0 };
    const d = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(d);
    let peak = 0, sum = 0;
    for (const x of d) {
      peak = Math.max(peak, Math.abs(x));
      sum += x * x;
    }
    return { peak, rms: Math.sqrt(sum / d.length) };
  }

  private motor: { o: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
  /** the RC boat's little electric motor: a whine that rises with throttle */
  setMotor(level: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.motor) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      o2.connect(f);
      f.connect(g).connect(this.sfx);
      o.start();
      o2.start();
      this.motor = { o, o2, g, f };
    }
    const t = ctx.currentTime;
    const m = this.motor;
    m.o.frequency.setTargetAtTime(120 + 520 * level, t, 0.08);
    m.o2.frequency.setTargetAtTime(60 + 260 * level, t, 0.08);
    m.f.frequency.setTargetAtTime(500 + 2500 * level, t, 0.08);
    m.g.gain.setTargetAtTime(level > 0.01 ? 0.015 + 0.05 * level : 0, t, 0.1);
  }

  /** where we are: drives the nature soundscape and the music's mood */
  setScene(s: Scene) {
    this.scene = s;
    if (!this.ctx) return;
    this.nature!.setScene(s);
    this.music!.setMood(s.season, s.time);
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

  /** a point in the stereo field (−1 left … 1 right) feeding the effects bus */
  private panned(pan: number) {
    const p = this.ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.sfx);
    return p;
  }

  /**
   * The ring of a bubble of radius r [m] pinched off under the surface
   * (Minnaert). It rings for only a few dozen cycles (thermal, viscous and
   * radiation damping, decay time ≈ 1 / (π f δ)), and its pitch rises as it
   * is pulled toward the surface. That quick upward chirp is what makes
   * water sound wet.
   */
  bubble(r: number, gain = 0.15, delay = 0, pan = 0, chirp = rand(1.15, 1.35)) {
    if (!this.ctx) return;
    const f = MINNAERT / Math.max(r, 2e-4);
    if (f > 16000) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const tau = Math.min(0.12, 1 / (Math.PI * f * 0.012));
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * chirp, t + tau * 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.0015);
    g.gain.setTargetAtTime(0, t + 0.0015, tau);
    o.connect(g).connect(this.panned(pan));
    o.start(t);
    o.stop(t + tau * 7 + 0.01);
  }

  /** one fragment of a splash: a tiny tick of band-limited noise */
  private grain(t: number, f: number, q: number, peak: number, decay: number, pan: number) {
    const ctx = this.ctx!;
    const s = this.noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(peak, 0.0002), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(bp).connect(g).connect(this.panned(pan));
    s.start(t, Math.random() * 1.9);
    s.stop(t + decay + 0.01);
  }

  /**
   * Water struck by a hand or a toy, in the order it happens:
   *  1. the smack: the flat palm meets the surface; a sharp broadband crack
   *     (air squeezed out from under it) over a soft low thud
   *  2. the sheet: the crown thrown up shatters into fragments; a rapid
   *     crackle of tiny noise grains, thinning out
   *  3. the cavity: the hole left behind collapses and pinches off a big
   *     bubble that rings low and chirps upward, the "bloop"
   *  4. the bubble cloud: dozens of small bubbles, sizes from a power law
   *     (many small, few large), each ringing at its Minnaert pitch
   *  5. the wash: the displaced water rushing back, a soft fading swish
   * The spray that flies out is heard later, drop by drop, as each one
   * lands in the simulation (dropLanded).
   */
  private waterHit(s: number, pan: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const at = this.panned(pan);
    // 1. smack
    this.burst('highpass', 1800, 0.6, 0.3 * s, 0.001, 0.035, 0, at);
    this.burst('bandpass', 900, 0.9, 0.22 * s, 0.002, 0.07, 0, at);
    this.tone(130, 70, 0.18 * s, 0.003, 0.09, 0, 'sine', at);
    // 2. sheet crackle
    const n = Math.round(20 + 45 * s);
    for (let k = 0; k < n; k++) {
      const dt = 0.004 - Math.log(1 - Math.random()) * 0.06 * (0.6 + 0.6 * s);
      this.grain(t + dt, rand(1500, 7500), rand(1.2, 3), rand(0.03, 0.08) * s * Math.exp(-dt * 5), rand(0.006, 0.02), pan + rand(-0.5, 0.5));
    }
    // 3. the cavity's bloop (radius ~6–14 mm: ~230–540 Hz)
    const R = 0.006 + 0.008 * s * Math.random();
    this.bubble(R, 0.14 * s, rand(0.035, 0.07), pan, rand(1.3, 1.6));
    if (Math.random() < 0.5) this.bubble(R * rand(0.4, 0.6), 0.07 * s, rand(0.06, 0.12), pan + rand(-0.3, 0.3));
    // 4. bubble cloud, radii 0.6–5 mm with p(r) ∝ r⁻²
    const rMin = 0.0006, rMax = 0.005;
    const m = Math.round(8 + 24 * s);
    for (let k = 0; k < m; k++) {
      const r = rMin / (1 - Math.random() * (1 - rMin / rMax));
      const dt = 0.01 - Math.log(1 - Math.random()) * 0.08;
      this.bubble(r, rand(0.02, 0.045) * s * Math.exp(-dt * 3), dt, pan + rand(-0.6, 0.6));
    }
    // 5. the wash
    const w = this.noiseSrc();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t + 0.02);
    lp.frequency.exponentialRampToValueAtTime(450, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 * s, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    w.connect(lp).connect(g).connect(at);
    w.start(t, Math.random());
    w.stop(t + 0.8);
  }

  // ── effects ───────────────────────────────────────────────────────────────
  slap(fluid: FluidId, strength: number, sprayMl: number, pan = 0) {
    if (!this.ctx) return;
    const s = 0.25 + strength * 0.75;
    if (fluid === 'water') {
      this.waterHit(Math.min(1, s * (0.9 + Math.min(sprayMl, 20) * 0.01)), pan);
    } else if (fluid === 'honey' || fluid === 'chocolate') {
      // heavy and sticky: a low gloop, then a slow suction pop
      this.tone(110, 60, 0.6 * s, 0.01, 0.45);
      this.burst('lowpass', 500, 1, 0.3 * s, 0.01, 0.4);
      this.tone(220, 360, 0.18 * s, 0.02, 0.18, 0.28);
    } else if (fluid === 'mercury') {
      // a metallic, dense ring: inharmonic partials decaying slowly
      this.tone(120, 70, 0.45 * s, 0.003, 0.15);
      for (const [f, a] of [[2150, 0.12], [3370, 0.09], [5260, 0.06], [7110, 0.04]]) this.tone(f, f * 0.99, a * s, 0.002, 0.9, 0, 'sine');
      // beads skittering off: hard little ticks, no bubbles
      for (let k = 0; k < Math.min(16, sprayMl * 0.6); k++) this.grain(this.ctx.currentTime + rand(0.05, 0.4), rand(4000, 8000), 4, 0.03, 0.01, pan + rand(-0.5, 0.5));
    } else if (fluid === 'lava') {
      // molten rock: a heavy, slow glorp, a hiss of steam and a crackle of crust
      this.tone(80, 40, 0.65 * s, 0.015, 0.5);
      this.burst('lowpass', 380, 1, 0.3 * s, 0.02, 0.5);
      this.burst('highpass', 3500, 0.6, 0.12 * s, 0.05, 0.9, 0.08);
      for (let k = 0; k < 5; k++) this.burst('bandpass', 2000 + Math.random() * 3000, 2, 0.06 * s, 0.001, 0.03, 0.1 + Math.random() * 0.5);
    } else if (fluid === 'jello') {
      // a gel: a soft slap and a wobbling, springy body (it rings at the
      // jiggle frequency, ~11 Hz modulating a low thump)
      this.tone(140, 60, 0.45 * s, 0.003, 0.12);
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
      const am = ctx.createOscillator();
      am.frequency.value = 11;
      const ag = ctx.createGain();
      ag.gain.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3 * s, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      const mod = ctx.createGain();
      mod.gain.value = 0.5;
      am.connect(ag).connect(mod.gain);
      o.connect(mod).connect(g).connect(this.sfx);
      for (const x of [o, am]) {
        x.start(t);
        x.stop(t + 0.85);
      }
    } else {
      // oobleck jams: a short, dull thud, nothing else
      this.tone(90, 45, 0.7 * s, 0.002, 0.12);
      this.burst('lowpass', 300, 1, 0.35 * s, 0.002, 0.08);
    }
  }

  /**
   * A drop from the spray landing. On water it always makes a little tick,
   * and about half the time traps a bubble that plinks (drops this size
   * entrain bubbles only within a band of speeds and sizes).
   */
  dropLanded(r: number, onWater: boolean, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (onWater) {
      this.grain(t, rand(2500, 6000), 1.5, 0.012 + Math.min(r * 10, 0.02), 0.008, pan);
      if (Math.random() < 0.5) this.bubble(r * rand(0.3, 0.6), rand(0.025, 0.045), 0.002, pan);
    } else this.grain(t, rand(3000, 5000), 0.8, 0.015, 0.02, pan);
  }

  /** a finger drawn through the liquid: a soft slosh, and in water the odd gurgle of air dragged under */
  stir(speed: number, fluid: FluidId = 'water', pan = 0) {
    if (!this.ctx || speed < 0.05) return;
    const at = this.panned(pan);
    this.burst('lowpass', 450 + speed * 700, 0.7, Math.min(0.1, speed * 0.06), 0.04, 0.16, 0, at);
    if (fluid !== 'water') return;
    this.burst('bandpass', 1800 + speed * 1500, 1.2, Math.min(0.03, speed * 0.02), 0.02, 0.08, 0, at);
    if (Math.random() < Math.min(0.7, speed * 0.4)) this.bubble(rand(0.002, 0.006), 0.04, rand(0, 0.08), pan);
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

  skip(speed: number, fluid: FluidId, pan = 0) {
    if (!this.ctx) return;
    if (fluid === 'mercury') this.tone(3000, 2900, 0.08, 0.002, 0.4);
    if (fluid === 'oobleck') return this.tone(260, 140, 0.25, 0.002, 0.06, 0, 'triangle');
    // a stone kissing the surface: a crisp tick, a fan of spray, one bubble
    const t = this.ctx.currentTime;
    this.burst('highpass', 2200, 0.7, 0.09 + speed * 0.02, 0.001, 0.03, 0, this.panned(pan));
    this.burst('bandpass', 1200, 1, 0.06, 0.002, 0.05, 0, this.panned(pan));
    for (let k = 0; k < 8; k++) this.grain(t + rand(0, 0.07), rand(2000, 6500), 2, 0.035, 0.012, pan + rand(-0.3, 0.3));
    this.bubble(rand(0.0012, 0.0025), 0.07, 0.01, pan);
  }

  /**
   * A stone dropping in. The deep cavity it opens snaps shut and pinches
   * off a big bubble whose pitch rises as it collapses: a plop goes up,
   * not down.
   */
  plop(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst('lowpass', 700, 0.8, 0.12, 0.002, 0.06, 0, this.panned(pan));
    for (let k = 0; k < 6; k++) this.grain(t + rand(0, 0.05), rand(1500, 5000), 2, 0.03, 0.012, pan + rand(-0.2, 0.2));
    this.bubble(rand(0.006, 0.008), 0.2, 0.025, pan, rand(1.5, 1.8));
    this.bubble(rand(0.0015, 0.003), 0.05, rand(0.06, 0.12), pan);
  }

  crack() {
    if (!this.ctx) return;
    for (let k = 0; k < 6; k++) this.burst('highpass', 2500 + Math.random() * 3000, 1, 0.12, 0.001, 0.03 + Math.random() * 0.05, Math.random() * 0.15);
    this.tone(180, 90, 0.15, 0.002, 0.2);
  }

  entry(mass: number, speed: number, fluid: FluidId, pan = 0) {
    if (!this.ctx) return;
    const s = Math.min(1, mass * speed * 8);
    if (fluid === 'oobleck') return this.tone(120, 60, 0.4 * s + 0.1, 0.002, 0.1);
    if (fluid === 'water') return this.waterHit(0.2 + 0.55 * s, pan);
    this.tone(260, 110, 0.3 * s + 0.08, 0.003, 0.15);
  }

  cast() {
    if (!this.ctx) return;
    this.burst('bandpass', 1800, 2, 0.06, 0.15, 0.35);
  }
  nibble() {
    if (!this.ctx) return;
    this.bubble(0.003, 0.06);
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
