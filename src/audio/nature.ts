// ─────────────────────────────────────────────────────────────────────────────
// Nature sounds: a soundscape for every place, season, time of day and
// weather, synthesised live. Each animal call is modelled on the real one:
//
//   robin                 caroling phrases of slurred whistles, 2–3 kHz
//   black-capped chickadee "fee-bee": two pure whistles, ~4.0 then ~3.4 kHz
//   white-throated sparrow "oh sweet Canada Canada Canada": a long low
//                          whistle, a higher one, then triplets
//   northern cardinal     "birdy birdy birdy": steep downslurs, 4 → 2 kHz
//   mourning dove         "coo-OO-oo-oo-oo", soft and low (~500 Hz)
//   crow, blue jay        harsh nasal caws / jeers (buzzy, formant-filtered)
//   gull                  "kee-ow" descending squeals
//   Canada geese          nasal two-tone honks from a passing flock
//   common loon           the wail (a slow rise and hold), the tremolo
//                          (a wavering laugh); echoing across the lake
//   owls                  great horned "hoo h'hoo hoo hoo"; barred owl
//                          "who cooks for you" in Algonquin
//   woodpecker            drumming: ~20 knocks in a second, slowing
//   spring peepers        rising "peep"s, a chorus near water in spring
//   bullfrog              "jug-o-rum", low and buzzy, summer lakes at night
//   crickets              chirping at a rate set by the air temperature
//                          (Dolbear's law: chirps/min ≈ 4 (T[°F] − 40))
//   cicadas               a high buzzing swell on hot summer days
//   wolves                a distant howl on Algonquin nights
//   wind chimes           tuned tubes struck by gusts (cottage, backyard)
//   city                  traffic hush, passing cars, a streetcar bell
//   Lions Gate            surf, gulls, a ship's horn; at noon, the
//                          Canada Place horns play the first notes of
//                          "O Canada" across the harbour
//
// Every event is placed in stereo at a random bearing and distance (farther
// = quieter and duller) and shares the scene reverb.
// ─────────────────────────────────────────────────────────────────────────────
import type { Season, TimeOfDay, Weather } from '../scene/world/palettes';
import type { LocationId } from '../scene/world/location';

export interface Scene {
  location: LocationId;
  season: Season;
  time: TimeOfDay;
  weather: Weather;
  hotTub: boolean;
}

type Bed = 'wind' | 'surf' | 'lapping' | 'traffic' | 'rain' | 'fire' | 'bubbles' | 'rustle' | 'cicadas';
type Voice =
  | 'robin' | 'chickadee' | 'sparrow' | 'cardinal' | 'dove' | 'crow' | 'jay' | 'gull' | 'geese'
  | 'loonWail' | 'loonTremolo' | 'hornedOwl' | 'barredOwl' | 'woodpecker' | 'peepers' | 'bullfrog'
  | 'crickets' | 'wolf' | 'chimes' | 'car' | 'streetcar' | 'shipHorn' | 'heritageHorn' | 'crackle'
  | 'drip' | 'fishJump' | 'thunder';

interface Plan {
  beds: Partial<Record<Bed, number>>;
  /** events per minute */
  voices: Partial<Record<Voice, number>>;
  /** air temperature for the crickets [°C] */
  temperature: number;
}

/** What you would hear in this place, season, time and weather. */
export function planFor(s: Scene): Plan {
  const { location: L, season, time, weather } = s;
  const night = time === 'night', dawn = time === 'sunrise', dusk = time === 'sunset', day = time === 'day';
  const winter = season === 'winter', summer = season === 'summer', spring = season === 'spring', autumn = season === 'autumn';
  const lake = L === 'dock' || L === 'algonquin';
  const wet = lake || L === 'highpark';
  const shore = L === 'beach' || L === 'lionsgate';
  const leafy = L !== 'city' && !shore;
  const beds: Plan['beds'] = { wind: 0.1 };
  const v: Plan['voices'] = {};
  const temperature = { spring: 12, summer: 22, autumn: 11, winter: -6 }[season] + (night ? -5 : day ? 3 : 0);

  // ── water and weather beds
  if (L === 'beach') beds.surf = 0.6;
  if (L === 'lionsgate') beds.surf = 0.35;
  if (lake) beds.lapping = 0.4;
  if (L === 'highpark') beds.lapping = 0.12;
  if (L === 'city') beds.traffic = night ? 0.15 : 0.25;
  if (L === 'algonquin') beds.fire = night ? 0.55 : dusk ? 0.4 : 0.2;
  if (L === 'backyard' && s.hotTub) beds.bubbles = 0.6;
  if (leafy && !winter) beds.rustle = 0.12;
  if (weather === 'wind') {
    beds.wind = 0.65;
    if (leafy && !winter) beds.rustle = 0.45;
  }
  if (weather === 'rain') {
    beds.rain = 0.3;
    beds.wind = 0.25;
    v.drip = 6;
    v.thunder = 0.25;
  }
  if (weather === 'snow') beds.wind = 0.16; // snow hushes everything

  // ── birds
  const birdy = weather === 'rain' ? 0.25 : weather === 'snow' ? 0.4 : weather === 'wind' ? 0.6 : 1;
  const chorus = dawn ? 2.2 : day ? 1 : dusk ? 0.9 : 0;
  if (chorus > 0 && !winter) {
    const k = chorus * birdy;
    if (leafy || L === 'city') v.robin = (L === 'city' ? 1.2 : 2.5) * k * (autumn ? 0.3 : 1);
    if (L === 'forest' || L === 'algonquin' || L === 'highpark') v.sparrow = 1.6 * k * (autumn ? 0.4 : 1);
    if (L === 'backyard' || L === 'highpark' || L === 'city') v.cardinal = 1.4 * k;
    if ((dawn || day) && (L === 'backyard' || L === 'highpark' || L === 'city')) v.dove = 0.8 * k;
    if (L === 'forest' || L === 'algonquin') v.woodpecker = day ? 0.7 * birdy : 0.25;
  }
  if (!night && leafy) v.chickadee = (winter ? 2.2 : 1) * birdy;
  if (!night && (L === 'city' || L === 'forest' || winter)) v.crow = (winter ? 1.2 : 0.6) * birdy;
  if (!night && (autumn || winter) && leafy) v.jay = 0.7 * birdy;
  if (!night && shore) v.gull = 2.2 * birdy;
  if (!night && (autumn || spring) && L !== 'city') v.geese = 0.35;

  // ── lake life
  if (lake && !winter) {
    v.loonWail = dawn ? 2.2 : dusk ? 1.8 : night ? 1.4 : 0.4;
    if (night || dusk) v.loonTremolo = 0.7;
    if (!night) v.fishJump = 0.8;
  }

  // ── night life
  if (night) {
    if (leafy || L === 'city') v.hornedOwl = winter ? 1.2 : 0.6;
    if (L === 'algonquin') {
      v.barredOwl = 0.7;
      v.wolf = winter ? 0.3 : 0.15;
    }
  }
  if ((night || dusk) && !winter) {
    if (summer || autumn) v.crickets = (summer ? 60 : 30) * (L === 'city' ? 0.3 : 1);
    if (spring && wet) v.peepers = 40;
    if (summer && lake) v.bullfrog = 2;
  }
  if (summer && day && (L === 'backyard' || L === 'highpark' || L === 'city' || L === 'forest')) beds.cicadas = 0.25;

  // ── people places
  if (L === 'city') {
    v.car = night ? 2 : 5;
    v.streetcar = 0.35;
  }
  if (L === 'lionsgate') {
    v.shipHorn = 0.12;
    if (day) v.heritageHorn = 0.06;
  }
  if ((L === 'dock' || L === 'backyard') && weather !== 'rain') v.chimes = weather === 'wind' ? 5 : 1.2;
  if (L === 'algonquin') v.crackle = beds.fire ? 0 : 0;
  return { beds, voices: v, temperature };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Nature {
  private beds: Partial<Record<Bed, GainNode>> = {};
  private plan: Plan | null = null;
  private timer = 0;
  private cricketPhase = 0;

  constructor(
    private ctx: AudioContext,
    private noise: AudioBuffer,
    private out: AudioNode,
    /** long echo across open water (loons, wolves, horns) */
    private far: AudioNode,
  ) {}

  setScene(s: Scene) {
    this.plan = planFor(s);
    const t = this.ctx.currentTime;
    const all: Bed[] = ['wind', 'surf', 'lapping', 'traffic', 'rain', 'fire', 'bubbles', 'rustle', 'cicadas'];
    for (const b of all) {
      const level = this.plan.beds[b] ?? 0;
      let g = this.beds[b];
      if (!g && level > 0) g = this.beds[b] = this.makeBed(b);
      g?.gain.setTargetAtTime(level, t, 1.5);
    }
    if (!this.timer) this.timer = window.setInterval(() => this.tick(0.25), 250);
  }

  private tick(dt: number) {
    if (!this.plan || document.hidden) return;
    const t = this.ctx.currentTime + 0.05;
    for (const [name, rate] of Object.entries(this.plan.voices) as [Voice, number][]) {
      if (!rate) continue;
      if (name === 'crickets') {
        this.crickets(t, dt, rate);
        continue;
      }
      if (Math.random() < (rate * dt) / 60) this.call(name, t);
    }
  }

  // ── plumbing ─────────────────────────────────────────────────────────────
  /** a source placed at a bearing and distance: pan, distance filter, level */
  private place(dist = rand(0.3, 1), pan = rand(-0.9, 0.9), far = 0) {
    const ctx = this.ctx;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 14000 - 9000 * dist;
    const g = ctx.createGain();
    g.gain.value = 1.15 - 0.75 * dist;
    p.connect(lp).connect(g).connect(this.out);
    if (far > 0) {
      const fg = ctx.createGain();
      fg.gain.value = far;
      g.connect(fg).connect(this.far);
    }
    return p;
  }

  private env(t: number, peak: number, a: number, hold: number, r: number, out: AudioNode) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
    g.connect(out);
    return g;
  }

  /** a pure whistle following a pitch contour [[time, Hz], …] */
  private whistle(t: number, contour: [number, number][], peak: number, out: AudioNode, harm = 0.06, type: OscillatorType = 'sine') {
    const ctx = this.ctx;
    const dur = contour[contour.length - 1][0];
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(contour[0][1], t);
    for (const [dt, f] of contour.slice(1)) o.frequency.linearRampToValueAtTime(f, t + dt);
    const g = this.env(t, peak, Math.min(0.02, dur * 0.2), Math.max(dur - 0.05, 0), 0.04, out);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.1);
    if (harm > 0) {
      const o2 = ctx.createOscillator();
      o2.frequency.setValueAtTime(contour[0][1] * 2, t);
      for (const [dt, f] of contour.slice(1)) o2.frequency.linearRampToValueAtTime(f * 2, t + dt);
      const g2 = this.env(t, peak * harm, 0.02, Math.max(dur - 0.05, 0), 0.04, out);
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + dur + 0.1);
    }
  }

  /** a harsh, nasal call: buzzy source through vocal-tract-like resonances */
  private nasal(t: number, f0: number, f1: number, dur: number, peak: number, formants: number[], out: AudioNode) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur);
    const g = this.env(t, peak, 0.015, dur * 0.6, dur * 0.4, out);
    for (const fq of formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = 3;
      o.connect(bp).connect(g);
    }
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private noiseBurst(t: number, type: BiquadFilterType, f: number, q: number, peak: number, a: number, r: number, out: AudioNode) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const bf = this.ctx.createBiquadFilter();
    bf.type = type;
    bf.frequency.value = f;
    bf.Q.value = q;
    s.connect(bf).connect(this.env(t, peak, a, 0, r, out));
    s.start(t, Math.random());
    s.stop(t + a + r + 0.05);
  }

  private makeBed(kind: Bed) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.out);
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    const mod = ctx.createGain();
    mod.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.connect(lg).connect(mod.gain);
    s.connect(f).connect(mod).connect(gain);
    const set = (type: BiquadFilterType, freq: number, q: number, rate: number, depth: number, level = 1) => {
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      lfo.frequency.value = rate;
      lg.gain.value = depth;
      mod.gain.value = 0.55 * level;
    };
    switch (kind) {
      case 'wind': set('lowpass', 380, 0.9, 0.07, 0.45); break;
      case 'surf': set('lowpass', 850, 0.6, 0.1, 0.6); break; // a wave every ~10 s
      case 'lapping': set('bandpass', 480, 0.9, 0.5, 0.4); break;
      case 'traffic': set('lowpass', 170, 0.7, 0.04, 0.25); break;
      case 'rain': set('highpass', 2400, 0.4, 0.17, 0.08); break;
      case 'fire': set('lowpass', 260, 0.7, 0.35, 0.35); break;
      case 'bubbles': set('lowpass', 650, 0.8, 2.6, 0.35); break;
      case 'rustle': set('bandpass', 3800, 0.5, 0.18, 0.5, 0.5); break; // leaves in the canopy
      case 'cicadas': {
        set('bandpass', 4800, 6, 0.06, 0.5, 0.6);
        // the buzz: fast amplitude modulation, the tymbal clicks
        const am = ctx.createOscillator();
        am.frequency.value = 180;
        const ag = ctx.createGain();
        ag.gain.value = 0.35;
        am.connect(ag).connect(mod.gain);
        am.start();
        break;
      }
    }
    s.start(0, Math.random());
    lfo.start();
    return gain;
  }

  // ── the calls ────────────────────────────────────────────────────────────
  private call(v: Voice, t: number) {
    switch (v) {
      case 'robin': return this.robin(t);
      case 'chickadee': return this.chickadee(t);
      case 'sparrow': return this.sparrow(t);
      case 'cardinal': return this.cardinal(t);
      case 'dove': return this.dove(t);
      case 'crow': return this.crow(t);
      case 'jay': return this.jay(t);
      case 'gull': return this.gull(t);
      case 'geese': return this.geese(t);
      case 'loonWail': return this.loonWail(t);
      case 'loonTremolo': return this.loonTremolo(t);
      case 'hornedOwl': return this.hornedOwl(t);
      case 'barredOwl': return this.barredOwl(t);
      case 'woodpecker': return this.woodpecker(t);
      case 'peepers': return this.peeper(t);
      case 'bullfrog': return this.bullfrog(t);
      case 'wolf': return this.wolf(t);
      case 'chimes': return this.chimes(t);
      case 'car': return this.car(t);
      case 'streetcar': return this.streetcar(t);
      case 'shipHorn': return this.shipHorn(t);
      case 'heritageHorn': return this.heritageHorn(t);
      case 'drip': return this.drip(t);
      case 'fishJump': return this.fishJump(t);
      case 'thunder': return this.thunder(t);
      case 'crackle': return;
      case 'crickets': return;
    }
  }

  robin(t: number) {
    const out = this.place();
    const n = 3 + Math.floor(Math.random() * 5);
    const base = rand(2100, 2600);
    let tt = t;
    for (let k = 0; k < n; k++) {
      const a = base * rand(0.9, 1.25), b = a * rand(1.1, 1.3), c = a * rand(0.85, 1.05);
      this.whistle(tt, [[0, a], [0.06, b], [0.16, c]], 0.035, out, 0.1);
      tt += rand(0.22, 0.34);
      if (k % 3 === 2) tt += 0.4; // the phrase breathes
    }
  }

  chickadee(t: number) {
    const out = this.place();
    const hi = rand(3800, 4100);
    this.whistle(t, [[0, hi], [0.32, hi * 0.985]], 0.04, out, 0.02);
    // "bee": lower, with the small dip in the middle
    const lo = hi * 0.86;
    this.whistle(t + 0.42, [[0, lo], [0.12, lo * 0.97], [0.18, lo * 1.0], [0.38, lo * 0.98]], 0.036, out, 0.02);
  }

  sparrow(t: number) {
    const out = this.place(rand(0.4, 1));
    const a = rand(3100, 3500), b = a * 1.22;
    this.whistle(t, [[0, a], [0.75, a]], 0.032, out, 0.02);
    this.whistle(t + 0.85, [[0, b], [0.7, b]], 0.03, out, 0.02);
    let tt = t + 1.65;
    for (let k = 0; k < 3; k++) {
      for (const f of [b * 1.04, b, b * 0.96]) {
        this.whistle(tt, [[0, f], [0.11, f]], 0.027, out, 0.02);
        tt += 0.13;
      }
      tt += 0.05;
    }
  }

  cardinal(t: number) {
    const out = this.place();
    const n = 4 + Math.floor(Math.random() * 4);
    const top = rand(3600, 4300);
    for (let k = 0; k < n; k++) this.whistle(t + k * 0.27, [[0, top], [0.2, top * 0.48]], 0.034, out, 0.04);
  }

  dove(t: number) {
    const out = this.place(rand(0.3, 0.8));
    const f = rand(470, 520);
    // breathy low hoots: a soft rising "coo-OO", then three level "oo"s
    const coo = (tt: number, c: [number, number][], peak: number) => this.whistle(tt, c, peak, out, 0.25, 'sine');
    coo(t, [[0, f * 0.95], [0.2, f * 1.12], [0.45, f * 1.05]], 0.03);
    coo(t + 0.55, [[0, f * 1.2], [0.5, f]], 0.04);
    for (let k = 0; k < 3; k++) coo(t + 1.3 + k * 0.62, [[0, f * 0.98], [0.45, f * 0.95]], 0.033);
  }

  crow(t: number) {
    const out = this.place(rand(0.5, 1), rand(-0.9, 0.9), 0.15);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) this.nasal(t + k * 0.5, 620, 520, 0.32, 0.05, [1300, 2100], out);
  }

  jay(t: number) {
    const out = this.place();
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) this.nasal(t + k * 0.38, 1800, 1500, 0.22, 0.03, [2400, 3600], out);
  }

  gull(t: number) {
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9), 0.25);
    const n = 1 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const f = rand(1500, 1900);
      this.nasal(t + k * 0.42, f, f * 0.62, 0.36, 0.03, [f * 1.1, f * 2.3], out);
    }
  }

  geese(t: number) {
    // a flock passing over: honks drifting across from one side to the other
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let k = 0; k < 14; k++) {
      const tt = t + k * rand(0.35, 0.7);
      const pan = dir * (-0.9 + (1.8 * k) / 14);
      const out = this.place(0.6, pan, 0.2);
      const f = rand(380, 450);
      this.nasal(tt, f * 0.8, f, 0.08, 0.025, [900, 1800], out);
      this.nasal(tt + 0.09, f * 1.05, f * 0.95, 0.2, 0.035, [1000, 2000], out);
    }
  }

  loonWail(t: number) {
    // a slow rise to a held note, sometimes a third note; echoing off the far shore
    const out = this.place(rand(0.5, 1), rand(-0.8, 0.8), 0.9);
    const a = rand(560, 640);
    const b = a * rand(1.6, 1.75);
    const c: [number, number][] = [[0, a], [0.5, a * 1.02], [0.9, b], [2.2, b * 0.99]];
    if (Math.random() < 0.5) c.push([2.6, b * 1.2], [3.6, b * 1.18]);
    c.push([c[c.length - 1][0] + 0.5, b * 0.9]);
    this.whistle(t, c, 0.045, out, 0.18, 'sine');
    // a little vibrato in the held note
    this.whistle(t, c.map(([x, f]) => [x, f * 3] as [number, number]), 0.004, out, 0, 'sine');
  }

  loonTremolo(t: number) {
    // the "laughing" call: a wavering note, ~9 wobbles a second
    const ctx = this.ctx;
    const out = this.place(rand(0.6, 1), rand(-0.8, 0.8), 0.9);
    const o = ctx.createOscillator();
    const f = rand(900, 1050);
    o.frequency.value = f;
    const wob = ctx.createOscillator();
    wob.frequency.value = rand(8, 10);
    const wd = ctx.createGain();
    wd.gain.value = f * 0.12;
    wob.connect(wd).connect(o.frequency);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const ag = ctx.createGain();
    ag.gain.value = 0.5;
    wob.connect(ag).connect(am.gain);
    const g = this.env(t, 0.03, 0.05, 1.3, 0.3, out);
    o.connect(am).connect(g);
    for (const x of [o, wob]) {
      x.start(t);
      x.stop(t + 1.8);
    }
  }

  hornedOwl(t: number) {
    const out = this.place(rand(0.5, 1), rand(-0.8, 0.8), 0.3);
    const f = rand(280, 320);
    const hoo = (tt: number, d: number, p: number) => this.whistle(tt, [[0, f * 0.97], [d * 0.3, f], [d, f * 0.96]], p, out, 0.15);
    hoo(t, 0.35, 0.05);
    hoo(t + 0.6, 0.12, 0.035);
    hoo(t + 0.78, 0.4, 0.055);
    hoo(t + 1.45, 0.3, 0.045);
    hoo(t + 1.95, 0.3, 0.04);
  }

  barredOwl(t: number) {
    const out = this.place(rand(0.6, 1), rand(-0.8, 0.8), 0.4);
    const f = rand(380, 430);
    const seq: [number, number, number, number][] = [[0, 0.22, 1, 1.1], [0.3, 0.2, 1.05, 1.12], [0.62, 0.18, 1.08, 1.0], [0.95, 0.45, 1.1, 0.75]];
    for (const [dt, d, a, b] of seq) this.whistle(t + dt, [[0, f * a], [d, f * b]], 0.045, out, 0.2);
    for (const [dt, d, a, b] of seq) this.whistle(t + 1.9 + dt, [[0, f * a], [d, f * b]], 0.04, out, 0.2);
  }

  woodpecker(t: number) {
    const out = this.place(rand(0.4, 1), rand(-0.9, 0.9), 0.2);
    let tt = t, gap = 0.045;
    const f = rand(900, 1400);
    for (let k = 0; k < 18; k++) {
      this.noiseBurst(tt, 'bandpass', f, 4, 0.06, 0.001, 0.025, out);
      tt += gap;
      gap *= 1.025;
    }
  }

  peeper(t: number) {
    const out = this.place(rand(0.3, 1));
    const f = rand(2700, 3100);
    for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) this.whistle(t + k * rand(0.5, 0.9), [[0, f * 0.9], [0.12, f]], 0.022, out, 0.03);
  }

  bullfrog(t: number) {
    const ctx = this.ctx;
    const out = this.place(rand(0.4, 1), rand(-0.8, 0.8), 0.3);
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
      const tt = t + k * 0.9;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(110, tt);
      o.frequency.linearRampToValueAtTime(140, tt + 0.15);
      o.frequency.linearRampToValueAtTime(100, tt + 0.6);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.Q.value = 4;
      const g = this.env(tt, 0.07, 0.04, 0.35, 0.2, out);
      o.connect(lp).connect(g);
      o.start(tt);
      o.stop(tt + 0.7);
    }
  }

  /** a few crickets chirping in loose time; rate from the temperature */
  private crickets(t: number, dt: number, level: number) {
    const tempF = (this.plan!.temperature * 9) / 5 + 32;
    const perMin = Math.max(4 * (tempF - 40), 20);
    this.cricketPhase += (perMin / 60) * dt;
    while (this.cricketPhase >= 1) {
      this.cricketPhase -= 1;
      const count = Math.round(level / 20);
      for (let c = 0; c < count; c++) {
        if (Math.random() < 0.3) continue;
        const out = this.place(rand(0.2, 1));
        const f = 4300 + c * 170 + rand(-40, 40);
        const tt = t + rand(0, 0.25);
        for (let k = 0; k < 3; k++) this.whistle(tt + k * 0.03, [[0, f], [0.016, f]], 0.012, out, 0);
      }
    }
  }

  wolf(t: number) {
    const out = this.place(1, rand(-0.8, 0.8), 1);
    const f = rand(380, 440);
    this.whistle(t, [[0, f], [0.8, f * 1.45], [2.6, f * 1.5], [3.8, f * 1.2], [4.4, f * 0.9]], 0.04, out, 0.2);
    if (Math.random() < 0.6) this.whistle(t + 1.6, [[0, f * 1.1], [0.9, f * 1.7], [2.8, f * 1.6], [3.4, f * 1.2]], 0.025, this.place(1, rand(-0.8, 0.8), 1), 0.2);
  }

  chimes(t: number) {
    const ctx = this.ctx;
    const out = this.place(0.35, rand(-0.5, 0.5));
    // five tubes tuned to a pentatonic chord
    const tubes = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3].map((r) => 784 * r);
    const n = 1 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const f = tubes[Math.floor(Math.random() * tubes.length)];
      const tt = t + k * rand(0.15, 0.6);
      // a struck tube: fundamental plus its inharmonic partials (2.76, 5.40)
      for (const [r, a] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f * r;
        o.connect(this.env(tt, 0.025 * a, 0.002, 0, 3.5 / r, out));
        o.start(tt);
        o.stop(tt + 4);
      }
    }
  }

  car(t: number) {
    // a car passing: swelling road noise sweeping across, with a Doppler drop
    const ctx = this.ctx;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dur = rand(3, 5);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.9 * dir, t);
    p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
    p.connect(this.out);
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(900, t + dur / 2);
    lp.frequency.linearRampToValueAtTime(380, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + dur / 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(lp).connect(g).connect(p);
    s.start(t, Math.random());
    s.stop(t + dur + 0.1);
  }

  streetcar(t: number) {
    // a TTC streetcar's two-stroke gong, a block away
    const ctx = this.ctx;
    const out = this.place(0.8, rand(-0.7, 0.7), 0.2);
    for (const dt of [0, 0.35]) {
      for (const [r, a] of [[1, 1], [2.32, 0.5], [4.25, 0.25]]) {
        const o = ctx.createOscillator();
        o.frequency.value = 1180 * r;
        o.connect(this.env(t + dt, 0.03 * a, 0.002, 0, 1.4 / r, out));
        o.start(t + dt);
        o.stop(t + dt + 1.6);
      }
    }
  }

  shipHorn(t: number) {
    const out = this.place(1, rand(-0.6, 0.6), 1);
    for (const f of [72, 90]) this.nasal(t, f, f, 3.2, 0.06, [180, 360], out);
  }

  heritageHorn(t: number) {
    // Canada Place's heritage horns: the opening of "O Canada" (Lavallée,
    // 1880): mi – sol, sol – do, as broad chords across the harbour
    const out = this.place(1, rand(-0.4, 0.4), 1);
    const notes: [number, number][] = [[0, 0.9], [1.0, 0.6], [1.7, 0.4], [2.2, 1.8]];
    const pitches = [329.6, 392, 392, 261.6];
    notes.forEach(([dt, d], k) => {
      const f = pitches[k];
      for (const r of [1, 1.25, 1.5]) this.nasal(t + dt, f * r * 0.5, f * r * 0.5, d, 0.02, [400, 900], out);
    });
  }

  drip(t: number) {
    // a drop from the leaves: Minnaert bubble ring (f ≈ 3.26 / R)
    const out = this.place(rand(0.2, 0.7));
    const R = rand(0.0015, 0.004);
    const f = 3.26 / R;
    this.whistle(t, [[0, f * 0.9], [0.04, f * 1.2]], 0.02, out, 0);
  }

  fishJump(t: number) {
    const out = this.place(rand(0.5, 1), rand(-0.8, 0.8), 0.3);
    this.noiseBurst(t, 'lowpass', 900, 0.7, 0.06, 0.002, 0.18, out);
    this.whistle(t + 0.01, [[0, 420], [0.06, 560]], 0.02, out, 0);
  }

  thunder(t: number) {
    const out = this.place(1, rand(-0.7, 0.7), 0.6);
    this.noiseBurst(t, 'lowpass', 120, 0.7, 0.2, 0.4, 5, out);
    this.noiseBurst(t + 0.6, 'lowpass', 70, 0.7, 0.2, 0.8, 4, out);
  }
}
