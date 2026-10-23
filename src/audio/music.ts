// ─────────────────────────────────────────────────────────────────────────────
// Music: a generative, endlessly varying, relaxing score that follows the
// season and the time of day. Nothing is recorded; every note is composed
// and synthesised in the browser (instruments.ts).
//
//   spring   airy and bright: piano arpeggios, a flute melody
//   summer   warm and open: nylon guitar, sunny lydian colour, soft bass
//   autumn   cozy: electric piano, jazzy seventh and ninth chords, bass
//   winter   music box, celesta and soft sleigh bells; now and then a quiet
//            arrangement of a traditional carol (all public domain)
//   night    any season: slower, lower, sparser, more reverb
//
// Structure: a section is a chord progression (each chord two bars) played
// as a sustained pad, an accompaniment pattern and a melody built from a
// short motif that is repeated and varied, so it sounds composed rather than
// random. Sections change key and progression every minute or two, and there
// are gentle pauses between them.
//
// Scheduling uses the standard Web Audio look-ahead pattern: a timer wakes
// every 100 ms and queues the notes due in the next 300 ms at exact times.
// ─────────────────────────────────────────────────────────────────────────────
import { Instruments } from './instruments';
import type { Season, TimeOfDay } from '../scene/world/palettes';

type Quality = 'maj' | 'min' | 'maj7' | 'min7' | 'dom7' | 'add9' | 'min9' | 'maj9' | 'sus4';
/** [scale degree semitones above the tonic, quality] */
type Chord = [number, Quality];

const SHAPES: Record<Quality, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14], min9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], sus4: [0, 5, 7],
};
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

interface Style {
  bpm: number;
  keys: number[]; // MIDI tonics to choose from
  progressions: Chord[][];
  scale: number[];
  accomp: 'piano' | 'guitar' | 'rhodes' | 'musicBox';
  melody: 'flute' | 'piano' | 'guitar' | 'rhodes' | 'musicBox' | 'bell';
  bass: boolean;
  bells: boolean;
  /** pad brightness 0…1 */
  bright: number;
  /** chance a bar's melody slot rests */
  rest: number;
}

const I: Chord = [0, 'maj'], ii7: Chord = [2, 'min7'], iii7: Chord = [4, 'min7'], IV: Chord = [5, 'maj'], V: Chord = [7, 'maj'];
const vi: Chord = [9, 'min'], vi7: Chord = [9, 'min7'], Imaj7: Chord = [0, 'maj7'], IVmaj7: Chord = [5, 'maj7'], V7: Chord = [7, 'dom7'];

const STYLES: Record<Season, Style> = {
  spring: {
    bpm: 74, keys: [62, 64, 65], scale: MAJOR, accomp: 'piano', melody: 'flute', bass: false, bells: false, bright: 0.65, rest: 0.25,
    progressions: [[I, V, vi, IV], [IVmaj7, I, [5, 'add9'], V], [I, [4, 'min'], IV, I], [vi, IV, I, [7, 'sus4']]],
  },
  summer: {
    bpm: 68, keys: [55, 57, 60], scale: LYDIAN, accomp: 'guitar', melody: 'guitar', bass: true, bells: false, bright: 0.55, rest: 0.3,
    progressions: [[Imaj7, [2, 'maj'], Imaj7, [2, 'maj']], [IVmaj7, Imaj7, IVmaj7, [7, 'sus4']], [Imaj7, vi7, IVmaj7, [0, 'add9']]],
  },
  autumn: {
    bpm: 64, keys: [53, 55, 58], scale: MAJOR, accomp: 'rhodes', melody: 'rhodes', bass: true, bells: false, bright: 0.4, rest: 0.35,
    progressions: [[ii7, V7, [0, 'maj9'], vi7], [IVmaj7, iii7, ii7, Imaj7], [[9, 'min9'], [2, 'min9'], [7, 'sus4'], [0, 'maj9']], [Imaj7, [4, 'min7'], IVmaj7, V7]],
  },
  winter: {
    bpm: 62, keys: [60, 62, 65], scale: MAJOR, accomp: 'musicBox', melody: 'bell', bass: false, bells: true, bright: 0.5, rest: 0.3,
    progressions: [[I, vi, IV, V], [I, [4, 'min'], IV, V7], [[0, 'add9'], IV, [9, 'min'], V], [IV, I, [2, 'min'], V7]],
  },
};

// ── carols (traditional, public domain), in C, for winter ───────────────────
// notes: [MIDI or null for a rest, duration in beats]; chords per bar
interface Carol {
  name: string;
  beatsPerBar: number;
  bpm: number;
  notes: [number | null, number][];
  chords: Chord[];
}
const C4 = 60;
const n = (s: string, d: number): [number | null, number] => {
  if (s === '-') return [null, d];
  const names: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let m = C4 + names[s[0]];
  if (s.includes('#')) m += 1;
  if (s.includes('b') && s.length > 1) m -= 1;
  m += 12 * (s.split("'").length - 1) - 12 * (s.split(',').length - 1);
  return [m, d];
};
const CAROLS: Carol[] = [
  {
    // Silent Night (Gruber, 1818), 6/8 counted in eighth notes
    name: 'Silent Night', beatsPerBar: 6, bpm: 150,
    notes: [
      n('G', 3), n('A', 1), n('G', 2), n('E', 6), n('G', 3), n('A', 1), n('G', 2), n('E', 6),
      n("D'", 4), n("D'", 2), n('B', 6), n("C'", 4), n("C'", 2), n('G', 6),
      n('A', 4), n('A', 2), n("C'", 3), n('B', 1), n('A', 2), n('G', 3), n('A', 1), n('G', 2), n('E', 6),
      n('A', 4), n('A', 2), n("C'", 3), n('B', 1), n('A', 2), n('G', 3), n('A', 1), n('G', 2), n('E', 6),
      n("D'", 4), n("D'", 2), n("F'", 3), n("D'", 1), n('B', 2), n("C'", 6), n("E'", 6),
      n("C'", 3), n('G', 1), n('E', 2), n('G', 3), n('F', 1), n('D', 2), n('C', 12),
    ],
    // one chord per 6/8 bar (24 bars)
    chords: [I, I, I, I, V, V, I, I, IV, IV, I, I, IV, IV, I, I, V, V, I, I, I, V7, I, I],
  },
  {
    // Jingle Bells (Pierpont, 1857), refrain, played slowly
    name: 'Jingle Bells', beatsPerBar: 4, bpm: 84,
    notes: [
      n('E', 1), n('E', 1), n('E', 2), n('E', 1), n('E', 1), n('E', 2), n('E', 1), n('G', 1), n('C', 1.5), n('D', 0.5), n('E', 4),
      n('F', 1), n('F', 1), n('F', 1.5), n('F', 0.5), n('F', 1), n('E', 1), n('E', 1), n('E', 0.5), n('E', 0.5),
      n('E', 1), n('D', 1), n('D', 1), n('E', 1), n('D', 2), n('G', 2),
      n('E', 1), n('E', 1), n('E', 2), n('E', 1), n('E', 1), n('E', 2), n('E', 1), n('G', 1), n('C', 1.5), n('D', 0.5), n('E', 4),
      n('F', 1), n('F', 1), n('F', 1.5), n('F', 0.5), n('F', 1), n('E', 1), n('E', 1), n('E', 0.5), n('E', 0.5),
      n('G', 1), n('G', 1), n('F', 1), n('D', 1), n('C', 4),
    ],
    chords: [I, I, I, I, IV, I, V, V, I, I, I, I, IV, I, V7, I],
  },
  {
    // We Wish You a Merry Christmas (English traditional), 3/4 with a pickup
    name: 'We Wish You a Merry Christmas', beatsPerBar: 3, bpm: 96,
    notes: [
      n('-', 2), n('G', 1),
      n("C'", 1), n("C'", 0.5), n("D'", 0.5), n("C'", 0.5), n('B', 0.5), n('A', 1), n('A', 1), n('A', 1),
      n("D'", 1), n("D'", 0.5), n("E'", 0.5), n("D'", 0.5), n("C'", 0.5), n('B', 1), n('G', 1), n('G', 1),
      n("E'", 1), n("E'", 0.5), n("F'", 0.5), n("E'", 0.5), n("D'", 0.5), n("C'", 1), n('A', 1), n('G', 0.5), n('G', 0.5),
      n('A', 1), n("D'", 1), n('B', 1), n("C'", 3),
    ],
    chords: [I, I, vi, [2, 'maj'], V, [4, 'maj'], vi, V7, I],
  },
  {
    // Deck the Halls (Welsh traditional)
    name: 'Deck the Halls', beatsPerBar: 4, bpm: 88,
    notes: [
      n('G', 1.5), n('F', 0.5), n('E', 1), n('D', 1), n('C', 1), n('D', 1), n('E', 1), n('C', 1),
      n('D', 0.5), n('E', 0.5), n('F', 0.5), n('D', 0.5), n('E', 1.5), n('D', 0.5), n('C', 1), n('B,', 1), n('C', 2),
      n('G', 1.5), n('F', 0.5), n('E', 1), n('D', 1), n('C', 1), n('D', 1), n('E', 1), n('C', 1),
      n('D', 0.5), n('E', 0.5), n('F', 0.5), n('D', 0.5), n('E', 1.5), n('D', 0.5), n('C', 1), n('B,', 1), n('C', 2),
    ],
    chords: [I, I, V7, I, I, I, V7, I],
  },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export class Music {
  private ins: Instruments;
  private timer = 0;
  private nextTime = 0; // when the next bar starts
  private season: Season = 'summer';
  private time: TimeOfDay = 'day';
  private style = STYLES.summer;
  private key = 60;
  private prog: Chord[] = [];
  private bar = 0; // bar index within the section
  private sectionBars = 16;
  private motif: { beat: number; len: number; step: number }[] = [];
  private carol: Carol | null = null;
  private carolIndex = 0;
  private carolBar = 0;
  private sectionCount = 0;
  private running = false;

  constructor(private ctx: AudioContext, noise: AudioBuffer, private out: AudioNode) {
    this.ins = new Instruments(ctx, noise);
  }

  setMood(season: Season, time: TimeOfDay) {
    const changed = season !== this.season || time !== this.time;
    this.season = season;
    this.time = time;
    this.style = STYLES[season];
    if (changed && this.running) this.newSection(true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 1.5;
    this.newSection(false);
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
  }

  private get night() {
    return this.time === 'night';
  }
  private get beat() {
    // night is slower; sunrise a touch slower too
    const k = this.night ? 0.82 : this.time === 'sunrise' ? 0.92 : 1;
    return 60 / (this.style.bpm * k);
  }

  private newSection(fromChange: boolean) {
    this.sectionCount++;
    this.bar = 0;
    // winter: every third section is a carol
    if (this.season === 'winter' && this.sectionCount % 3 === 2) {
      this.carol = CAROLS[this.carolIndex++ % CAROLS.length];
      this.carolBar = 0;
      return;
    }
    this.carol = null;
    this.key = pick(this.style.keys) - (this.night ? 2 : 0);
    this.prog = pick(this.style.progressions);
    this.sectionBars = this.prog.length * 2 * (Math.random() < 0.5 ? 2 : 3);
    this.makeMotif();
    // a breath between sections (shorter when the scene just changed)
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime) + (fromChange ? 0.5 : rand(2, 6) * this.beat);
  }

  /** a two-bar rhythmic and melodic idea, reused and varied through the section */
  private makeMotif() {
    const rhythms = [
      [[0, 1.5], [1.5, 0.5], [2, 2], [4, 1], [5, 1], [6, 2]],
      [[0, 1], [1, 1], [2, 1], [3, 1], [4, 3], [7, 1]],
      [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2]],
      [[0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5], [4, 4]],
      [[0, 3], [3, 1], [4, 1], [5, 1], [6, 2]],
    ];
    const r = pick(rhythms);
    let step = 0;
    this.motif = r.map(([beat, len], k) => {
      // an arch: up in the first half, settling at the end
      const s = k < r.length / 2 ? pick([1, 1, 2, -1]) : pick([-1, -1, -2, 1]);
      step += k === 0 ? 0 : s;
      return { beat, len, step };
    });
  }

  private tick() {
    if (!this.running) return;
    // timers are throttled in background tabs: never try to "catch up" on
    // missed bars (that would play them all at once), just carry on
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.1;
    const ahead = this.ctx.currentTime + 0.3;
    while (this.nextTime < ahead) {
      if (this.carol) this.scheduleCarolBar(this.nextTime);
      else this.scheduleBar(this.nextTime);
    }
  }

  private chordNotes(c: Chord, root: number) {
    return SHAPES[c[1]].map((iv) => root + c[0] + iv);
  }

  private scheduleBar(t: number) {
    const st = this.style;
    const b = this.beat;
    const chord = this.prog[Math.floor(this.bar / 2) % this.prog.length];
    const root = this.key + chord[0];
    const notes = this.chordNotes(chord, this.key);
    const o = this.out;
    const vel = this.night ? 0.6 : 0.8;
    const first = this.bar % 2 === 0;

    // pad: one per chord (two bars), voiced around middle C
    if (first) {
      const voiced = notes.map((m) => ((m - 52) % 12) + 52 + (m - this.key >= 12 ? 12 : 0));
      this.ins.pad(t, voiced, this.night ? 0.8 : 1, 8 * b, o, st.bright * (this.night ? 0.6 : 1));
    }
    // bass on the downbeat (and beat 3 sometimes)
    if (st.bass) {
      const bm = ((root - 36) % 12) + 36;
      if (first || Math.random() < 0.5) this.ins.bass(t, bm, vel, 2.5 * b, o);
      if (Math.random() < 0.35) this.ins.bass(t + 2 * b, bm + 7, vel * 0.7, 1.5 * b, o);
    }
    // accompaniment: a broken chord in eighths, humanised
    const arp = [0, 1, 2, 3, 2, 1, 2, 3].map((k) => notes[k % notes.length] + (k === 3 ? 12 : 0));
    const sparse = this.night ? 2 : 1;
    for (let k = 0; k < 8; k += sparse) {
      if (Math.random() < (this.night ? 0.25 : 0.12)) continue;
      const tt = t + k * (b / 2) + (k % 2 ? b * 0.06 : 0) + rand(-0.01, 0.01);
      let m = arp[k] + (st.accomp === 'musicBox' ? 12 : 0);
      if (this.night) m -= 12;
      const v = vel * (k === 0 ? 0.85 : 0.55) * rand(0.85, 1.05);
      this.playAccomp(tt, m, v, b * 1.5);
    }
    // melody: the motif on the first bar of each pair, varied on repeats
    if (first && Math.random() > st.rest) {
      const variation = (this.bar / 2) % 4;
      const scale = st.scale;
      const center = this.key + 12 + (this.night ? -5 : 0);
      for (const ev of this.motif) {
        if (variation === 3 && Math.random() < 0.3) continue; // thin out on the 4th pass
        let deg = ev.step + (variation === 2 ? 2 : 0);
        // pull toward a chord tone on strong beats
        if (ev.beat % 2 === 0) deg = Math.round(deg / 2) * 2;
        const oct = Math.floor(deg / scale.length);
        const m = center + scale[((deg % scale.length) + scale.length) % scale.length] + 12 * oct;
        this.playMelody(t + ev.beat * b + rand(-0.012, 0.012), m, vel * rand(0.8, 1), ev.len * b * 0.95);
      }
    }
    // winter: a soft shimmer of sleigh bells on the off-beats, now and then
    if (st.bells && !this.night && first && Math.random() < 0.3) {
      for (let k = 1; k < 8; k += 2) this.ins.sleigh(t + k * b, 0.25, o);
    }
    this.nextTime = t + 4 * b;
    this.bar++;
    if (this.bar >= this.sectionBars) this.newSection(false);
  }

  private scheduleCarolBar(t: number) {
    const c = this.carol!;
    const b = 60 / (c.bpm * (this.night ? 0.85 : 1));
    // find the notes that start in this bar
    const start = this.carolBar * c.beatsPerBar;
    let acc = 0;
    for (const [m, d] of c.notes) {
      if (acc >= start && acc < start + c.beatsPerBar && m !== null) {
        this.ins.musicBox(t + (acc - start) * b, m + 12, 0.9, this.out);
      }
      acc += d;
    }
    const chord = c.chords[this.carolBar % c.chords.length];
    const notes = this.chordNotes(chord, 60);
    if (this.carolBar < c.chords.length) {
      this.ins.pad(t, notes.map((m) => m - 12), 0.8, c.beatsPerBar * b, this.out, 0.4);
      this.ins.bell(t, notes[0] - 12, 0.4, this.out);
    }
    this.carolBar++;
    this.nextTime = t + c.beatsPerBar * b;
    if (acc <= this.carolBar * c.beatsPerBar) {
      this.nextTime += 4 * b; // a moment of quiet after the carol
      this.newSection(false);
    }
  }

  private playAccomp(t: number, m: number, v: number, dur: number) {
    const o = this.out;
    switch (this.style.accomp) {
      case 'piano': return this.ins.piano(t, m, v * 0.7, dur, o);
      case 'guitar': return this.ins.guitar(t, m, v * 0.6, dur, o);
      case 'rhodes': return this.ins.rhodes(t, m, v * 0.6, dur, o);
      case 'musicBox': return this.ins.musicBox(t, m, v * 0.6, o);
    }
  }

  private playMelody(t: number, m: number, v: number, dur: number) {
    const o = this.out;
    // at night the piano takes the melody in every season
    const inst = this.night ? 'piano' : this.style.melody;
    switch (inst) {
      case 'flute': return this.ins.flute(t, m, v, dur, o);
      case 'piano': return this.ins.piano(t, m, v, dur, o);
      case 'guitar': return this.ins.guitar(t, m, v * 1.1, dur, o);
      case 'rhodes': return this.ins.rhodes(t, m, v, dur, o);
      case 'musicBox': return this.ins.musicBox(t, m, v, o);
      case 'bell': return this.ins.bell(t, m, v * 0.8, o);
    }
  }
}
