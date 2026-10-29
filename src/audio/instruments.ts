// ─────────────────────────────────────────────────────────────────────────────
// Synthesised instruments for the music (Web Audio, no samples)
//
//  piano      a harmonic spectrum with slightly stretched partials (real
//             strings are stiff, so overtones run sharp), through a lowpass
//             that closes as the note rings: high partials die first, as on
//             a real piano. A soft hammer thump on the attack.
//  rhodes     two-operator FM (carrier and modulator at the same frequency)
//             with a decaying index, plus a short high "tine" partial: the
//             warm, bell-edged electric piano.
//  guitar     Karplus–Strong plucked string: a burst of noise circulating in
//             a delay line one period long, gently lowpassed each pass. The
//             physics of a real string in a dozen lines; buffers are cached.
//  musicBox   a steel comb tooth: fundamental plus its inharmonic bending
//             modes (≈2.76× and 5.40×, a clamped bar), fast attack.
//  bell       FM with a non-integer ratio (3.5): a celesta / glockenspiel.
//  flute      a near-sine with a little breath noise and delayed vibrato.
//  pad        three detuned saws spread across the stereo field, through a
//             slowly breathing lowpass: strings.
//  bass       a round sine-triangle bass.
//  sleigh     a few jingles: short high resonances on noise.
//  shaker     a shaken seed pod: a short burst of highpassed noise.
//  handDrum   a soft frame drum / cajón: a sine whose pitch drops as the
//             skin relaxes, with a touch of slap noise.
//  brush      a brush swept across a snare: a slow swell of soft noise.
// ─────────────────────────────────────────────────────────────────────────────

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Instruments {
  private ks = new Map<number, AudioBuffer>();
  private pianoWave: PeriodicWave;
  private noise: AudioBuffer;

  constructor(private ctx: AudioContext, noise: AudioBuffer) {
    this.noise = noise;
    // piano-like spectrum: strong fundamental, falling partials, a dip at the
    // 7th (hammers strike near 1/7 of the string length)
    const n = 16;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (k === 7 ? 0.15 : 1) / Math.pow(k, 1.35);
    this.pianoWave = ctx.createPeriodicWave(re, im);
  }

  private gainEnv(t: number, peak: number, attack: number, decay: number, out: AudioNode, hold = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    if (hold > 0) g.gain.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    g.connect(out);
    return g;
  }

  piano(t: number, m: number, vel: number, dur: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    // lower notes ring longer
    const ring = Math.min(6, 2.2 * Math.sqrt(220 / f) + 0.8);
    const end = t + Math.min(dur + 0.4, ring);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(f * (4 + 6 * vel), 12000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 200), t + 1.2);
    lp.connect(g).connect(out);
    for (const det of [-3, 3]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.pianoWave);
      o.frequency.value = f;
      o.detune.value = det; // two strings per note, slightly out of unison
      o.connect(lp);
      o.start(t);
      o.stop(end + 0.05);
    }
    // hammer thump
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(f * 3, 5000);
    bp.Q.value = 1.2;
    s.connect(bp).connect(this.gainEnv(t, 0.02 * vel, 0.002, 0.04, out));
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }

  rhodes(t: number, m: number, vel: number, dur: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    const end = t + Math.min(dur + 0.6, 4);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * (1.6 + 1.4 * vel), t);
    idx.gain.exponentialRampToValueAtTime(f * 0.25, t + 1.0);
    mod.connect(idx).connect(car.frequency);
    const tine = ctx.createOscillator();
    tine.frequency.value = f * 14.2;
    const g = this.gainEnv(t, 0.11 * vel, 0.004, Math.min(dur + 0.5, 3.6), out, 0.05);
    const tg = this.gainEnv(t, 0.012 * vel, 0.001, 0.08, out);
    car.connect(g);
    tine.connect(tg);
    for (const o of [car, mod, tine]) {
      o.start(t);
      o.stop(end);
    }
  }

  /** Karplus–Strong plucked string, rendered once per pitch and cached. */
  private string(m: number) {
    let b = this.ks.get(m);
    if (b) return b;
    const sr = this.ctx.sampleRate;
    const f = midiHz(m);
    const N = Math.round(sr / f);
    const len = Math.floor(sr * 3.2);
    b = this.ctx.createBuffer(1, len, sr);
    const out = b.getChannelData(0);
    const line = new Float32Array(N);
    // pluck: noise, softened (a thumb rather than a pick)
    let prev = 0;
    for (let k = 0; k < N; k++) {
      const x = Math.random() * 2 - 1;
      prev = prev * 0.55 + x * 0.45;
      line[k] = prev;
    }
    // damping per pass: higher strings lose energy faster per second
    const loss = 0.4985 + Math.min(0.0012, 60 / f / 1000);
    let i = 0;
    for (let n = 0; n < len; n++) {
      const a = line[i];
      const bnext = line[(i + 1) % N];
      line[i] = (a + bnext) * loss;
      out[n] = a;
      i = (i + 1) % N;
    }
    // gentle fade so the cached tail ends cleanly
    for (let n = len - 2000; n < len; n++) out[n] *= (len - n) / 2000;
    this.ks.set(m, b);
    return b;
  }

  guitar(t: number, m: number, vel: number, dur: number, out: AudioNode) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.string(m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + 2500 * vel;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.42 * vel, t);
    g.gain.setValueAtTime(0.42 * vel, t + Math.max(dur, 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.2) + 0.5);
    s.connect(lp).connect(g).connect(out);
    s.start(t);
    s.stop(t + Math.max(dur, 0.2) + 0.6);
  }

  musicBox(t: number, m: number, vel: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    // a clamped steel tooth: modes at 1, 2.76, 5.40 × the fundamental
    const modes: [number, number, number][] = [[1, 1, 2.2], [2.76, 0.18, 0.7], [5.4, 0.08, 0.3]];
    for (const [r, a, dec] of modes) {
      const o = ctx.createOscillator();
      o.frequency.value = f * r;
      o.connect(this.gainEnv(t, 0.07 * vel * a, 0.002, dec, out));
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  bell(t: number, m: number, vel: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 2.2, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.1, t + 1.5);
    mod.connect(idx).connect(car.frequency);
    car.connect(this.gainEnv(t, 0.06 * vel, 0.002, 2.6, out));
    car.start(t);
    mod.start(t);
    car.stop(t + 2.7);
    mod.stop(t + 2.7);
  }

  flute(t: number, m: number, vel: number, dur: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    const end = t + dur + 0.35;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    // vibrato that blooms after the attack
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vd = ctx.createGain();
    vd.gain.setValueAtTime(0, t);
    vd.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur));
    vib.connect(vd).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = f * 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.09);
    g.gain.setValueAtTime(0.06 * vel, t + Math.max(dur - 0.05, 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(lp).connect(g).connect(out);
    // breath
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 2;
    const bg = this.gainEnv(t, 0.012 * vel, 0.05, dur, out);
    s.connect(bp).connect(bg);
    for (const x of [o, vib]) {
      x.start(t);
      x.stop(end);
    }
    s.start(t, Math.random());
    s.stop(end);
  }

  /** a sustained chord pad; returns nothing, fades itself out at t + dur */
  pad(t: number, notes: number[], vel: number, dur: number, out: AudioNode, bright = 0.5) {
    const ctx = this.ctx;
    const attack = Math.min(2, dur * 0.35);
    const release = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.025 * vel, t + attack);
    g.gain.setValueAtTime(0.025 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.5;
    lp.frequency.value = 500 + 1400 * bright;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 250 * bright + 80;
    lfo.connect(lg).connect(lp.frequency);
    lp.connect(g).connect(out);
    const stop = t + dur + release + 0.1;
    // the three detuned voices spread left, centre and right: a wide section
    const sides = [-0.6, 0, 0.6].map((pan) => {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(lp);
      return p;
    });
    for (const m of notes) {
      [-7, 0, 7].forEach((det, k) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(m);
        o.detune.value = det + (Math.random() - 0.5) * 3;
        o.connect(sides[k]);
        o.start(t);
        o.stop(stop);
      });
    }
    lfo.start(t);
    lfo.stop(stop);
  }

  bass(t: number, m: number, vel: number, dur: number, out: AudioNode) {
    const ctx = this.ctx;
    const f = midiHz(m);
    const g = this.gainEnv(t, 0.16 * vel, 0.02, Math.max(dur, 0.4), out, dur * 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.connect(g);
    for (const type of ['sine', 'triangle'] as OscillatorType[]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur * 1.4 + 0.5);
    }
  }

  shaker(t: number, vel: number, out: AudioNode) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 7000;
    hp.Q.value = 1.2;
    s.connect(hp).connect(this.gainEnv(t, 0.035 * vel, 0.012, 0.07, out));
    s.start(t, Math.random() * 2);
    s.stop(t + 0.15);
  }

  handDrum(t: number, f: number, vel: number, out: AudioNode) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    o.connect(this.gainEnv(t, 0.11 * vel, 0.004, 0.35, out));
    o.start(t);
    o.stop(t + 0.45);
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    s.connect(bp).connect(this.gainEnv(t, 0.02 * vel, 0.002, 0.05, out));
    s.start(t, Math.random() * 2);
    s.stop(t + 0.1);
  }

  brush(t: number, vel: number, dur: number, out: AudioNode) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 3200;
    lp.Q.value = 0.6;
    s.connect(lp).connect(this.gainEnv(t, 0.022 * vel, dur * 0.4, dur * 0.6, out));
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.05);
  }

  sleigh(t: number, vel: number, out: AudioNode) {
    const ctx = this.ctx;
    for (let k = 0; k < 4; k++) {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5200 + Math.random() * 3800;
      bp.Q.value = 18;
      const dt = k * 0.012 + Math.random() * 0.01;
      s.connect(bp).connect(this.gainEnv(t + dt, 0.05 * vel, 0.001, 0.12, out));
      s.start(t + dt, Math.random());
      s.stop(t + dt + 0.15);
    }
  }
}
