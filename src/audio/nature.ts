// ─────────────────────────────────────────────────────────────────────────────
// Nature sounds: a soundscape for every place, season, time of day and
// weather, synthesised live. Birds lead; wind is only a faint bed under them.
// Every place has its own birds, each call modelled on the real song:
//
//  Forest (Ontario hardwoods)
//   wood thrush           "ee-oh-LAY… trrrl": low pickups, a liquid flute
//                          phrase, then a shimmering two-voiced trill
//   veery                 a breezy spiral falling in pitch, two voices beating
//   ovenbird              "teacher TEACHER TEACHER", growing louder
//   red-eyed vireo        "here I am… where are you…", short phrases, all day
//  Algonquin and the cottage
//   hermit thrush         a held flute note, then a shimmering cascade, each
//                          phrase at a new pitch (two syrinx sides at once)
//   white-throated sparrow "oh sweet Canada Canada Canada"; sometimes the
//                          newer "Cana-Cana" doublets spreading east from BC
//   Swainson's thrush     an upward spiral of rolled flute notes
//   winter wren           a long bubbling run of rapid notes and trills
//   junco / pine warbler  a level musical trill
//   belted kingfisher     a dry rattle flying along the shore
//   raven                 deep hollow "kronk"s
//   whip-poor-will        "WHIP-poor-WILL" on and on through summer nights
//   common loon           wail, tremolo and yodel, echoing across the lake
//  High Park, backyard, city (Toronto)
//   robin                 "cheerily, cheer-up, cheerio": slurred whistle groups
//   northern cardinal     slow "cheer"s, then quick "birdy birdy birdy"
//   Baltimore oriole      rich, unhurried whistles, like a person whistling
//   song sparrow          "maids maids maids, put on your tea-kettle-ettle"
//   house finch           a long cheerful jumble, ending on a burry slur
//   house wren            a short bubbly cascade
//   red-winged blackbird  "conk-la-reeee" from the reeds
//   goldfinch, warbler    "po-ta-to-chip"; "sweet sweet I'm so sweet"
//   starling, sparrows,   wolf-whistles and clicks; chirps; soft coos
//   pigeons, chimney swifts chittering over the rooftops at dusk
//  Lions Gate (Vancouver)
//   varied thrush         one long eerie burry whistle, then silence, then
//                          another at a new pitch: wet coastal forest in winter
//   bald eagle            a surprisingly thin, high "kleek-kik-ik-ik"
//   glaucous-winged gulls, northwestern crows, Pacific wren, song sparrow
//  PEI dunes
//   piping plover         soft, mellow "peep-lo" whistles from the sand
//   common tern           a harsh "kee-arrr" over the surf
//   savannah sparrow      "tsit tsit tsit tseeee-tsaay" from the marram grass
//  Beach (Mediterranean)
//   Eurasian blackbird    low, unhurried fluting, ending in a quiet twitter
//   nightingale           the night's virtuoso: crescendos, "chook"s, trills
//   scops owl             a soft sonar-like "tyuu" every couple of seconds
//   common swifts         screaming parties racing over the rooftops
//   serin, European robin a glassy jingle; thin wistful winter cascades
//   collared dove         "coo-COOO-cook" from the rooftops
//
//  and the rest of the place: a far-off chorus of its small birds, crows
//  and jays, Canada geese, owls, woodpeckers drumming, spring peepers,
//  bullfrogs, crickets (chirp rate from the air temperature, Dolbear's law:
//  chirps/min ≈ 4 (T[°F] − 40)), cicadas, wolves, wind chimes, breaking
//  waves, wavelets on the dock, city traffic and the streetcar, a ship's
//  horn and, at noon at Lions Gate, the Canada Place horns playing the
//  first notes of "O Canada" across the harbour.
//
// Every event is placed in stereo at a random bearing and distance (farther
// = quieter and duller). Birds sing into their own bus with the echo of the
// place (tree trunks, a far shore, buildings) and share the scene reverb.
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
  | 'robin' | 'chickadee' | 'whiteThroat' | 'cardinal' | 'dove' | 'crow' | 'jay' | 'gull' | 'geese'
  | 'loonWail' | 'loonTremolo' | 'hornedOwl' | 'barredOwl' | 'woodpecker' | 'peepers' | 'bullfrog'
  | 'crickets' | 'wolf' | 'chimes' | 'car' | 'streetcar' | 'shipHorn' | 'heritageHorn'
  | 'drip' | 'fishJump' | 'thunder'
  | 'thrush' | 'wren' | 'warbler' | 'goldfinch' | 'redwing' | 'houseSparrow' | 'pigeon' | 'mallard' | 'gullCall'
  | 'loonYodel' | 'chorus' | 'wave' | 'lap'
  | 'woodThrush' | 'veery' | 'swainson' | 'ovenbird' | 'vireo' | 'songSparrow' | 'oriole' | 'houseFinch'
  | 'houseWren' | 'starling' | 'nuthatch' | 'junco' | 'kingfisher' | 'raven' | 'eagle' | 'variedThrush'
  | 'plover' | 'tern' | 'savannah' | 'blackbird' | 'nightingale' | 'scopsOwl' | 'swift' | 'serin'
  | 'collaredDove' | 'euroRobin' | 'whippoorwill';

interface Plan {
  beds: Partial<Record<Bed, number>>;
  /** events per minute */
  voices: Partial<Record<Voice, number>>;
  /** air temperature for the crickets [°C] */
  temperature: number;
  /** the small birds heard far off in the background chorus */
  chorus: Voice[];
  /** the echo that birdsong carries here: delay [s] and level */
  echo: [number, number];
}

type Rates = Partial<Record<Voice, number>>;

interface NoteOpts {
  /** where the swell peaks, as a fraction of the note */
  atk?: number;
  /** trill rate [Hz] and depth (× f) */
  trill?: number;
  depth?: number;
  /** the other side of the syrinx: frequency ratio and level */
  second?: number;
  level?: number;
  /** 2nd harmonic level */
  harm?: number;
}

/** the birds of each place in the breeding season [calls/min in full song] */
const SONG: Record<LocationId, Rates> = {
  forest: { woodThrush: 2, veery: 1.4, ovenbird: 1.3, vireo: 1.6, thrush: 0.8, wren: 0.8, warbler: 0.9, robin: 0.8, chickadee: 1, woodpecker: 0.6 },
  algonquin: { thrush: 2.4, whiteThroat: 2.2, swainson: 1.1, wren: 1.2, ovenbird: 1, vireo: 1.2, junco: 0.8, chickadee: 1, raven: 0.4, woodpecker: 0.5 },
  dock: { whiteThroat: 1.6, vireo: 1.4, thrush: 1, songSparrow: 1, junco: 0.7, warbler: 0.8, goldfinch: 0.8, chickadee: 0.9, kingfisher: 0.5 },
  highpark: { robin: 2, cardinal: 1.4, oriole: 1.4, songSparrow: 1.3, redwing: 1.6, warbler: 1, houseWren: 0.8, goldfinch: 0.8, woodThrush: 0.5, dove: 0.6, mallard: 1.2 },
  backyard: { robin: 2.2, cardinal: 1.6, houseFinch: 1.6, songSparrow: 1, dove: 0.8, goldfinch: 1, chickadee: 0.8, houseWren: 0.8, oriole: 0.4 },
  city: { houseSparrow: 3, starling: 1.6, houseFinch: 1.2, pigeon: 1.5, robin: 1, cardinal: 0.6, gull: 0.5 },
  lionsgate: { gull: 4, gullCall: 1.4, songSparrow: 1.4, swainson: 1.4, wren: 0.8, robin: 1, crow: 0.8, eagle: 0.35, variedThrush: 0.4 },
  beach: { gull: 3, gullCall: 1.2, plover: 2, tern: 1.6, savannah: 1.6, songSparrow: 1 },
  europe: { blackbird: 2, serin: 1, goldfinch: 1, collaredDove: 0.8, gull: 2, gullCall: 0.6, houseSparrow: 1, euroRobin: 0.6 },
};

/** who is still singing or calling in winter */
const WINTER: Record<LocationId, Rates> = {
  forest: { chickadee: 2.2, nuthatch: 1, jay: 0.7, crow: 0.6, woodpecker: 0.5 },
  algonquin: { chickadee: 2, nuthatch: 0.8, jay: 0.5, raven: 0.7, woodpecker: 0.4 },
  dock: { chickadee: 2, nuthatch: 0.8, jay: 0.6, crow: 0.6, raven: 0.3 },
  highpark: { chickadee: 1.4, cardinal: 1, nuthatch: 0.8, jay: 0.7, mallard: 0.8, crow: 0.6 },
  backyard: { chickadee: 1.6, cardinal: 1, jay: 0.6, houseFinch: 0.6, nuthatch: 0.5 },
  city: { houseSparrow: 2, pigeon: 1.4, starling: 0.8, crow: 1, gull: 0.4 },
  lionsgate: { variedThrush: 1.2, gull: 4, gullCall: 1, crow: 1, songSparrow: 0.6, eagle: 0.5, chickadee: 0.8 },
  beach: { gull: 2.5, gullCall: 0.8, crow: 0.8 },
  europe: { euroRobin: 1.4, blackbird: 0.8, gull: 2, collaredDove: 0.8, serin: 0.4, houseSparrow: 1 },
};

/** residents and calls that carry on after the breeding season */
const RESIDENT = new Set<Voice>([
  'chickadee', 'nuthatch', 'jay', 'crow', 'raven', 'gull', 'gullCall', 'pigeon', 'houseSparrow', 'mallard',
  'kingfisher', 'starling', 'eagle', 'euroRobin', 'collaredDove', 'woodpecker', 'dove',
]);
/** the evening singers: thrushes and blackbirds are at their best at dusk */
const DUSK = new Set<Voice>(['thrush', 'woodThrush', 'veery', 'swainson', 'robin', 'blackbird', 'whiteThroat']);
/** big or harsh voices, kept out of the far-off background chorus */
const LOUD = new Set<Voice>([
  'gull', 'gullCall', 'crow', 'raven', 'jay', 'eagle', 'mallard', 'pigeon', 'woodpecker', 'kingfisher', 'tern',
  'dove', 'collaredDove',
]);
/** everything that isn't a bird (it skips the birdsong bus) */
const NOT_BIRD = new Set<Voice>([
  'peepers', 'bullfrog', 'crickets', 'wolf', 'chimes', 'car', 'streetcar', 'shipHorn', 'heritageHorn', 'drip',
  'fishJump', 'thunder', 'wave', 'lap',
]);

/** What you would hear in this place, season, time and weather. */
export function planFor(s: Scene): Plan {
  const { location: L, season, time, weather } = s;
  const night = time === 'night', dawn = time === 'sunrise', dusk = time === 'sunset', day = time === 'day';
  const winter = season === 'winter', summer = season === 'summer', spring = season === 'spring', autumn = season === 'autumn';
  const lake = L === 'dock' || L === 'algonquin';
  const wet = lake || L === 'highpark';
  const shore = L === 'beach' || L === 'lionsgate' || L === 'europe';
  const leafy = L !== 'city' && !shore;
  // wind is only a faint bed: the birds should carry the scene
  const beds: Plan['beds'] = { wind: 0.035 };
  const v: Plan['voices'] = {};
  const temperature = { spring: 12, summer: 22, autumn: 11, winter: -6 }[season] + (night ? -5 : day ? 3 : 0);

  // ── water and weather beds
  // the sea: a steady wash under breaking waves
  if (L === 'beach') {
    beds.surf = 0.3;
    v.wave = 8;
  }
  if (L === 'europe') {
    beds.surf = 0.2;
    v.wave = 7;
  }
  if (L === 'lionsgate') beds.surf = 0.35;
  if (lake) {
    beds.lapping = 0.3;
    v.lap = L === 'dock' ? 40 : 15;
  }
  if (L === 'highpark') beds.lapping = 0.12;
  if (L === 'city') beds.traffic = night ? 0.15 : 0.25;
  if (L === 'algonquin') beds.fire = night ? 0.55 : dusk ? 0.4 : 0.2;
  if (L === 'backyard' && s.hotTub) beds.bubbles = 0.6;
  if (leafy && !winter) beds.rustle = 0.03;
  if (L === 'europe' && !winter) beds.rustle = 0.04; // palm fronds clattering softly
  if (weather === 'wind') {
    beds.wind = 0.3;
    if (leafy && !winter) beds.rustle = 0.15;
  }
  if (weather === 'rain') {
    beds.rain = 0.3;
    beds.wind = 0.1;
    v.drip = 6;
    v.thunder = 0.25;
  }
  if (weather === 'snow') beds.wind = 0.06; // snow hushes everything

  // ── birds
  const birdy = weather === 'rain' ? 0.35 : weather === 'snow' ? 0.5 : weather === 'wind' ? 0.7 : 1;
  const tf = dawn ? 2 : day ? 1 : dusk ? 0.9 : 0;
  const small: Voice[] = [];
  if (tf > 0) {
    for (const [name, r] of Object.entries(winter ? WINTER[L] : SONG[L]) as [Voice, number][]) {
      let k = r * birdy * tf;
      if (!RESIDENT.has(name)) k *= autumn ? 0.25 : spring ? 1.15 : 1;
      if (dusk && DUSK.has(name)) k *= 2.2;
      v[name] = k;
      if (!LOUD.has(name)) small.push(name);
    }
    if (autumn && leafy) {
      v.jay = 0.7 * birdy;
      v.nuthatch = 0.6 * birdy;
      small.push('nuthatch');
    }
    if (small.length) v.chorus = (winter ? 8 : autumn ? 14 : 34) * birdy * (dawn ? 1.6 : 1);
    // swifts screaming over the rooftops on summer evenings
    if (summer && !dawn && (L === 'europe' || L === 'city')) v.swift = (dusk ? 2 : 0.6) * birdy;
    if ((autumn || spring) && L !== 'city' && L !== 'europe') v.geese = 0.35;
  }

  // ── lake life
  if (lake && !winter) {
    // the cottage: loons calling across the lake, day and night
    const cottage = L === 'dock' ? 2 : 1;
    v.loonWail = (dawn ? 2.2 : dusk ? 1.8 : night ? 1.4 : 0.8) * cottage;
    v.loonTremolo = (night || dusk ? 0.7 : 0.3) * cottage;
    v.loonYodel = (night || dawn ? 0.35 : 0.12) * cottage;
    if (!night) v.fishJump = 0.8;
  }

  // ── night life
  if (night) {
    if (leafy || L === 'city') v.hornedOwl = winter ? 1.2 : 0.6;
    if (L === 'algonquin') {
      v.barredOwl = 0.7;
      v.wolf = winter ? 0.3 : 0.15;
    }
    if ((L === 'dock' || L === 'algonquin' || L === 'forest') && (spring || summer)) v.whippoorwill = 0.8;
    if (L === 'europe' && !winter) {
      v.scopsOwl = 1.2;
      if (spring || summer) v.nightingale = 2.2;
    }
  }
  if (L === 'europe' && dawn && (spring || summer)) v.nightingale = 1.5;
  if ((night || dusk) && !winter) {
    if (summer || autumn) v.crickets = (summer ? 60 : 30) * (L === 'city' ? 0.3 : 1);
    if (spring && wet) v.peepers = 40;
    if (summer && lake) v.bullfrog = 2;
  }
  if (summer && day && (L === 'backyard' || L === 'highpark' || L === 'city' || L === 'forest' || L === 'europe')) beds.cicadas = 0.25;
  // warm nights on the beach: crickets in the dune grass behind the palms
  if (L === 'europe' && night && !winter) v.crickets = 40;

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

  // the echo birdsong carries: tree trunks, the far shore, buildings, open sand
  const echo: [number, number] =
    L === 'forest' || L === 'algonquin' ? [0.21, 0.22]
    : L === 'dock' ? [0.34, 0.16]
    : L === 'city' ? [0.09, 0.18]
    : shore ? [0.25, 0.05]
    : [0.14, 0.12];
  return { beds, voices: v, temperature, chorus: small, echo };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Nature {
  private beds: Partial<Record<Bed, GainNode>> = {};
  private plan: Plan | null = null;
  private timer = 0;
  private cricketPhase = 0;
  /** calls placed at least this far away (the background chorus) */
  private distFloor = 0;
  /** birds sing into their own bus: louder than the beds, with an echo */
  private birds: GainNode;
  private echo: DelayNode;
  private echoWet: GainNode;
  /** where the call being placed goes (the bird bus or the plain mix) */
  private dest: AudioNode;

  constructor(
    private ctx: AudioContext,
    private noise: AudioBuffer,
    private out: AudioNode,
    /** long echo across open water (loons, wolves, horns) */
    private far: AudioNode,
  ) {
    this.dest = out;
    this.birds = ctx.createGain();
    this.birds.gain.value = 1.5;
    this.birds.connect(out);
    // a single soft repeat, darker each time round: song coming back off
    // tree trunks, the far shore or the buildings across the street
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    this.echoWet = ctx.createGain();
    this.echoWet.gain.value = 0.15;
    const spread = ctx.createStereoPanner();
    spread.pan.value = -0.35;
    this.birds.connect(this.echo);
    this.echo.connect(lp).connect(fb).connect(this.echo);
    lp.connect(this.echoWet).connect(spread).connect(out);
  }

  setScene(s: Scene) {
    this.plan = planFor(s);
    const t = this.ctx.currentTime;
    this.echo.delayTime.setTargetAtTime(this.plan.echo[0], t, 0.5);
    this.echoWet.gain.setTargetAtTime(this.plan.echo[1], t, 0.5);
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
    dist = Math.max(dist, this.distFloor);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 14000 - 9000 * dist;
    const g = ctx.createGain();
    g.gain.value = 1.15 - 0.75 * dist;
    p.connect(lp).connect(g).connect(this.dest);
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
    const prev = this.dest;
    this.dest = NOT_BIRD.has(v) ? this.out : this.birds;
    this.voice(v, t);
    this.dest = prev;
  }

  private voice(v: Voice, t: number) {
    switch (v) {
      case 'robin': return this.robin(t);
      case 'chickadee': return this.chickadee(t);
      case 'whiteThroat': return this.whiteThroat(t);
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
      case 'crickets': return;
      case 'thrush': return this.thrush(t);
      case 'wren': return this.wren(t);
      case 'warbler': return this.warbler(t);
      case 'goldfinch': return this.goldfinch(t);
      case 'redwing': return this.redwing(t);
      case 'houseSparrow': return this.houseSparrow(t);
      case 'pigeon': return this.pigeon(t);
      case 'mallard': return this.mallard(t);
      case 'gullCall': return this.gullCall(t);
      case 'loonYodel': return this.loonYodel(t);
      case 'wave': return this.wave(t);
      case 'lap': return this.lap(t);
      case 'woodThrush': return this.woodThrush(t);
      case 'veery': return this.veery(t);
      case 'swainson': return this.swainson(t);
      case 'ovenbird': return this.ovenbird(t);
      case 'vireo': return this.vireo(t);
      case 'songSparrow': return this.songSparrow(t);
      case 'oriole': return this.oriole(t);
      case 'houseFinch': return this.houseFinch(t);
      case 'houseWren': return this.houseWren(t);
      case 'starling': return this.starling(t);
      case 'nuthatch': return this.nuthatch(t);
      case 'junco': return this.junco(t);
      case 'kingfisher': return this.kingfisher(t);
      case 'raven': return this.raven(t);
      case 'eagle': return this.eagle(t);
      case 'variedThrush': return this.variedThrush(t);
      case 'plover': return this.plover(t);
      case 'tern': return this.tern(t);
      case 'savannah': return this.savannah(t);
      case 'blackbird': return this.blackbird(t);
      case 'nightingale': return this.nightingale(t);
      case 'scopsOwl': return this.scopsOwl(t);
      case 'swift': return this.swift(t);
      case 'serin': return this.serin(t);
      case 'collaredDove': return this.collaredDove(t);
      case 'euroRobin': return this.euroRobin(t);
      case 'whippoorwill': return this.whippoorwill(t);
      case 'chorus': {
        const list = this.plan?.chorus ?? [];
        if (!list.length) return;
        this.distFloor = rand(0.8, 1);
        this.call(list[Math.floor(Math.random() * list.length)], t + rand(0, 0.5));
        this.distFloor = 0;
        return;
      }
    }
  }

  robin(t: number) {
    // "cheerily, cheer-up, cheerio": groups of two to four slurred whistles,
    // each syllable a rise and fall, with a breath between groups
    const out = this.place();
    const base = rand(2100, 2600);
    const groups = 2 + Math.floor(Math.random() * 3);
    let tt = t;
    for (let g = 0; g < groups; g++) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const a = base * rand(0.85, 1.2), b = a * rand(1.12, 1.35), c = a * rand(0.8, 1.02);
        const d = rand(0.13, 0.19);
        this.note(tt, d, [[0, a], [0.35, b], [1, c]], 0.036, out, { atk: 0.35, harm: 0.1 });
        tt += d + rand(0.06, 0.12);
      }
      tt += rand(0.45, 0.8);
    }
  }

  chickadee(t: number) {
    const out = this.place();
    if (Math.random() < 0.35) {
      // the call: "chick-a-dee-dee-dee", bright chips then buzzy "dee"s
      // (a low fundamental whose harmonics ring up near 4 kHz)
      const f = rand(6200, 7000);
      this.note(t, 0.05, [[0, f], [1, f * 0.78]], 0.022, out);
      this.note(t + 0.07, 0.04, [[0, f * 0.9], [1, f * 0.7]], 0.018, out);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) this.nasal(t + 0.16 + k * 0.15, 420, 400, 0.12, 0.022, [3400, 4300], out);
      return;
    }
    // the song: "fee-bee", two pure whistles a step apart
    const hi = rand(3800, 4100);
    this.whistle(t, [[0, hi], [0.32, hi * 0.985]], 0.04, out, 0.02);
    // "bee": lower, with the small dip in the middle
    const lo = hi * 0.86;
    this.whistle(t + 0.42, [[0, lo], [0.12, lo * 0.97], [0.18, lo * 1.0], [0.38, lo * 0.98]], 0.036, out, 0.02);
  }

  whiteThroat(t: number) {
    // "oh sweet Canada Canada Canada": a long pure whistle, a step up, then
    // triplets, held and a little sad. Since ~2000 a "Cana-Cana" doublet
    // ending has spread east from BC; some Ontario birds sing it now.
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9), 0.3);
    const f = rand(3000, 3500);
    const opts: NoteOpts = { atk: 0.15, trill: 6, depth: 0.004 };
    this.note(t, 0.8, [[0, f], [1, f * 0.995]], 0.034, out, opts);
    const up = f * (Math.random() < 0.5 ? 1.19 : 1.26);
    this.note(t + 0.9, 0.75, [[0, up], [1, up * 0.997]], 0.032, out, opts);
    const doublets = Math.random() < 0.35;
    const cell: [number, number][] = doublets ? [[1.03, 0.14], [0.98, 0.13]] : [[1.04, 0.15], [1.0, 0.11], [0.98, 0.11]];
    let tt = t + 1.75;
    const reps = 3 + Math.floor(Math.random() * 2);
    for (let r = 0; r < reps; r++) {
      for (const [ratio, d] of cell) {
        const ff = up * ratio;
        this.note(tt, d, [[0, ff], [1, ff * 0.99]], 0.029 * (1 - r * 0.1), out, { atk: 0.3 });
        tt += d + 0.02;
      }
      tt += 0.03;
    }
  }

  cardinal(t: number) {
    // a few slow, ringing "cheer"s, then quick "birdy birdy birdy"s: steep
    // downslurs from ~4 to ~2 kHz, the fast ones with an upturned tail
    const out = this.place();
    const top = rand(3600, 4300);
    let tt = t;
    const slow = Math.floor(Math.random() * 4);
    for (let k = 0; k < slow; k++) {
      this.note(tt, 0.32, [[0, top * 1.05], [0.7, top * 0.5], [1, top * 0.46]], 0.036, out, { atk: 0.1, harm: 0.05 });
      tt += 0.42;
    }
    const n = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      this.note(tt, 0.15, [[0, top], [0.75, top * 0.48], [1, top * 0.6]], 0.034, out, { atk: 0.12, harm: 0.05 });
      tt += 0.19;
    }
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
  // ── birdsong ─────────────────────────────────────────────────────────────
  /**
   * One sung note: a smooth (raised-cosine) swell and fade, the pitch
   * gliding exponentially from f0 to f1, optionally warbled by a fast trill
   * (frequency modulation at `trill` Hz, depth `depth` × f). Real bird notes
   * are short, smooth and sweep fast; a flat-topped beep sounds electronic.
   */
  private sing(t: number, f0: number, f1: number, dur: number, peak: number, out: AudioNode, trill = 0, depth = 0, second = 0) {
    this.note(t, dur, [[0, f0], [1, f1]], peak, out, { trill, depth, second });
  }

  /**
   * One sung note with a detailed pitch contour: the pitch passes through
   * `pts` ([fraction of the note, Hz], …) in exponential glides, under a
   * smooth swell that peaks `atk` of the way through. Options: a trill
   * (frequency modulation at `trill` Hz, `depth` × f), the other side of
   * the syrinx (`second` × f at `level`; just off 1 the two voices beat,
   * the burry, ethereal sound of veeries and varied thrushes) and a little
   * 2nd harmonic (`harm`) for the fuller, flute-like voices.
   */
  private note(t: number, dur: number, pts: [number, number][], peak: number, out: AudioNode, o: NoteOpts = {}) {
    const ctx = this.ctx;
    const atk = o.atk ?? 0.5;
    const N = 24;
    const curve = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const x = k / (N - 1);
      const y = x < atk ? Math.sin((Math.PI / 2) * (x / atk)) : Math.cos((Math.PI / 2) * ((x - atk) / (1 - atk)));
      curve[k] = Math.pow(Math.max(y, 0), 1.4) + 1e-5;
    }
    const voices: [number, number][] = [[1, 1]];
    if (o.second) voices.push([o.second, o.level ?? 0.35]);
    if (o.harm) voices.push([2, o.harm]);
    let lfo: OscillatorNode | null = null;
    if (o.trill && o.depth) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = o.trill;
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    for (const [r, a] of voices) {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(pts[0][1] * r, t);
      for (const [x, f] of pts.slice(1)) osc.frequency.exponentialRampToValueAtTime(f * r, t + Math.max(x, 0.01) * dur);
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setValueCurveAtTime(curve.map((y) => y * peak * a), t, dur);
      osc.connect(g).connect(out);
      if (lfo) {
        const ld = ctx.createGain();
        ld.gain.value = pts[0][1] * r * o.depth!;
        lfo.connect(ld).connect(osc.frequency);
      }
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
  }

  thrush(t: number) {
    // a bout of three to five phrases, each at a new pitch, seconds apart
    const out = this.place(rand(0.3, 0.9), rand(-0.9, 0.9), 0.35);
    const phrases = 3 + Math.floor(Math.random() * 3);
    let tt = t;
    for (let p = 0; p < phrases; p++) {
      const base = rand(1700, 2900);
      // the held opening note
      this.sing(tt, base, base * 0.99, rand(0.22, 0.34), 0.05, out, 0, 0, 1.5);
      // the cascade: quick fluty notes climbing and shimmering
      let f = base * rand(1.25, 1.5);
      let at = tt + 0.36;
      const n = 5 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        this.sing(at, f, f * rand(0.92, 1.08), 0.045, 0.03, out, 0, 0, 1.5);
        at += 0.05;
        f *= k % 2 ? rand(0.85, 0.95) : rand(1.08, 1.2);
      }
      tt += rand(2.6, 4.5);
    }
  }

  wren(t: number) {
    // a long bubbling cascade: ~15 notes a second for several seconds,
    // with trills spliced in
    const out = this.place(rand(0.3, 0.9), rand(-0.9, 0.9), 0.15);
    const dur = rand(4, 7);
    let tt = t, f = rand(4000, 6000);
    while (tt < t + dur) {
      if (Math.random() < 0.12) {
        this.sing(tt, f, f * 0.95, 0.35, 0.02, out, rand(28, 45), 0.08);
        tt += 0.38;
      } else {
        const d = rand(0.04, 0.07);
        this.sing(tt, f * 1.08, f * 0.92, d, 0.022, out);
        tt += d + 0.015;
      }
      f = Math.min(8000, Math.max(3000, f * rand(0.82, 1.2)));
    }
  }

  warbler(t: number) {
    // "sweet sweet sweet, I'm so sweet": quick slurred chips, speeding up,
    // ending on an upslur
    const out = this.place();
    const f = rand(4800, 6200);
    const n = 5 + Math.floor(Math.random() * 4);
    let tt = t, gap = 0.16;
    for (let k = 0; k < n; k++) {
      this.sing(tt, f * 1.15, f * 0.85, 0.07, 0.026, out);
      tt += gap;
      gap *= 0.9;
    }
    this.sing(tt + 0.04, f * 0.85, f * 1.3, 0.16, 0.028, out);
  }

  goldfinch(t: number) {
    // twittering in bouncing flight: "po-ta-to-chip" and a few rising twitters
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9));
    const f = rand(3200, 4200);
    const seq = [1, 0.9, 1.05, 1.25];
    seq.forEach((r, k) => this.sing(t + k * 0.09, f * r, f * r * 0.8, 0.07, 0.024, out));
    for (let k = 0; k < 3 + Math.floor(Math.random() * 4); k++) {
      const ff = f * rand(0.9, 1.4);
      this.sing(t + 0.5 + k * rand(0.12, 0.2), ff * 0.85, ff * 1.15, 0.09, 0.02, out, 30, 0.05);
    }
  }

  redwing(t: number) {
    // "conk-la-reeee": two short notes, then a buzzy trill from the reeds
    const out = this.place(rand(0.4, 1), rand(-0.9, 0.9), 0.2);
    const f = rand(1900, 2300);
    this.sing(t, f * 0.75, f * 0.9, 0.09, 0.035, out);
    this.sing(t + 0.13, f * 1.1, f * 0.95, 0.08, 0.03, out);
    this.sing(t + 0.26, f * 1.6, f * 1.5, rand(0.7, 1.0), 0.03, out, 45, 0.12);
  }

  houseSparrow(t: number) {
    // "cheep… chirrup… cheep": a few bright chirps with a little roughness
    const out = this.place();
    for (let k = 0; k < 2 + Math.floor(Math.random() * 4); k++) {
      const f = rand(2800, 3800);
      this.sing(t + k * rand(0.25, 0.45), f * 1.15, f * 0.8, 0.1, 0.03, out, 60, 0.03);
    }
  }

  pigeon(t: number) {
    // a rock pigeon's soft, rolling coo
    const out = this.place(rand(0.3, 0.7));
    const f = rand(380, 440);
    this.sing(t, f * 0.9, f * 1.1, 0.25, 0.04, out, 18, 0.04);
    this.sing(t + 0.3, f * 1.1, f * 0.85, 0.5, 0.045, out, 14, 0.05);
  }

  mallard(t: number) {
    // a hen mallard's run of quacks, getting softer
    const out = this.place(rand(0.4, 0.9), rand(-0.8, 0.8), 0.2);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) this.nasal(t + k * 0.24, 560, 420, 0.16, 0.05 * (1 - k / (n + 2)), [900, 1800, 2700], out);
  }

  gullCall(t: number) {
    // the herring gull's long call: a squeal, then a run of "ha-ha-ha"s
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9), 0.3);
    const f = rand(1400, 1700);
    this.nasal(t, f * 0.8, f * 1.1, 0.5, 0.035, [f * 1.2, f * 2.4], out);
    const n = 5 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const ff = f * (1.05 - k * 0.02);
      this.nasal(t + 0.65 + k * 0.2, ff, ff * 0.8, 0.14, 0.03, [ff * 1.2, ff * 2.4], out);
    }
  }

  loonYodel(t: number) {
    // the male's territorial yodel: rising, then repeated swooping pairs
    const out = this.place(rand(0.6, 1), rand(-0.8, 0.8), 0.9);
    const f = rand(620, 700);
    this.whistle(t, [[0, f], [0.5, f * 1.5], [1.0, f * 1.6]], 0.04, out, 0.18);
    let tt = t + 1.1;
    for (let k = 0; k < 4 + Math.floor(Math.random() * 3); k++) {
      this.whistle(tt, [[0, f * 1.6], [0.18, f * 2.0], [0.42, f * 1.55]], 0.038, out, 0.15);
      tt += 0.48;
    }
  }

  // ── water ────────────────────────────────────────────────────────────────
  wave(t: number) {
    // a wave breaking: the crash as the lip falls, then the long hiss of
    // the swash running up the sand and draining back
    const ctx = this.ctx;
    const out = this.place(rand(0.4, 0.8), rand(-0.6, 0.6), 0.1);
    const big = rand(0.6, 1);
    const crash = ctx.createBufferSource();
    crash.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1400 * big, t + 0.7);
    lp.frequency.exponentialRampToValueAtTime(500, t + 2.6);
    crash.connect(lp).connect(this.env(t, 0.22 * big, 0.6, 0.2, 2.2, out));
    crash.start(t, Math.random());
    crash.stop(t + 3.2);
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2600, t + 1.2);
    hp.frequency.linearRampToValueAtTime(4200, t + 4);
    hp.Q.value = 0.5;
    hiss.connect(hp).connect(this.env(t + 1.0, 0.07 * big, 1.0, 0.6, 2.6, out));
    hiss.start(t + 1.0, Math.random());
    hiss.stop(t + 5.4);
  }

  lap(t: number) {
    // a wavelet slapping a dock post: a short, hollow, low splash
    const out = this.place(rand(0.2, 0.6), rand(-0.6, 0.6));
    this.noiseBurst(t, 'bandpass', rand(350, 650), 1.4, 0.05, 0.01, 0.16, out);
    if (Math.random() < 0.4) this.whistle(t, [[0, rand(180, 260)], [0.05, rand(120, 160)]], 0.01, out, 0);
  }

  // ── the birds of each place ──────────────────────────────────────────────
  woodThrush(t: number) {
    // "ee-oh-LAY… trrrl": two soft low pickups, a liquid flute phrase, then
    // a shimmering trill from both sides of the syrinx at once. Each phrase
    // differs from the last; a bout is a few phrases seconds apart.
    const out = this.place(rand(0.3, 0.9), rand(-0.9, 0.9), 0.3);
    const shapes = [[1, 1.26, 1.12], [1.19, 1.5, 1.33], [1, 1.33, 1.68, 1.5], [1.12, 1, 1.26]];
    const phrases = 3 + Math.floor(Math.random() * 3);
    let tt = t;
    for (let p = 0; p < phrases; p++) {
      const base = rand(1500, 2100);
      for (let k = 0; k < 2; k++) this.note(tt + k * 0.11, 0.06, [[0, base * 0.8], [1, base * 0.74]], 0.012, out, { harm: 0.1 });
      let at = tt + 0.26;
      for (const r of shapes[Math.floor(Math.random() * shapes.length)]) {
        const f = base * r;
        this.note(at, 0.17, [[0, f * 0.96], [0.3, f * 1.02], [1, f * 0.98]], 0.05, out, { atk: 0.25, harm: 0.08 });
        at += 0.19;
      }
      const ft = rand(3800, 5200);
      this.note(at + 0.02, rand(0.3, 0.5), [[0, ft], [1, ft * rand(0.9, 1.1)]], 0.022, out, { trill: rand(40, 60), depth: 0.12, second: rand(1.18, 1.32), atk: 0.2 });
      tt += rand(2.8, 4.2);
    }
  }

  veery(t: number) {
    // a breezy, liquid spiral falling in pitch: rolled notes overlapping,
    // two voices a few per cent apart beating against each other
    const out = this.place(rand(0.4, 1), rand(-0.9, 0.9), 0.35);
    const bouts = 1 + Math.floor(Math.random() * 2);
    for (let b = 0; b < bouts; b++) {
      const t0 = t + b * rand(3, 4.5);
      const f = rand(3600, 4300);
      const n = 6 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const ff = f * Math.pow(0.9, k);
        const a = 0.03 * Math.min(1, (k + 1) / 2) * (1 - k / (n + 4));
        this.note(t0 + k * 0.11, 0.22, [[0, ff * 1.05], [1, ff * 0.92]], a, out, { trill: rand(28, 36), depth: 0.05, second: 1.035, level: 0.6, atk: 0.3 });
      }
    }
  }

  swainson(t: number) {
    // Swainson's thrush: an upward spiral of rolled, flute-like notes
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9), 0.3);
    const f = rand(1500, 1800);
    const n = 7 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const ff = f * Math.pow(1.12, k);
      const a = 0.032 * (k < 2 ? 0.6 : 1) * (k > n - 3 ? 0.7 : 1);
      this.note(t + k * 0.12, 0.14, [[0, ff * 0.94], [0.5, ff * 1.06], [1, ff]], a, out, { trill: 24, depth: 0.04, second: 1.02, level: 0.4, atk: 0.3 });
    }
  }

  ovenbird(t: number) {
    // "teacher, TEACHER, TEACHER": two-note pairs, growing louder
    const out = this.place(rand(0.3, 0.9));
    const f = rand(3800, 4600);
    const n = 7 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const a = 0.008 + (0.034 * k) / (n - 1);
      const tt = t + k * 0.3;
      this.note(tt, 0.09, [[0, f * 1.15], [1, f * 0.95]], a, out, { atk: 0.15 });
      this.note(tt + 0.11, 0.1, [[0, f * 0.8], [0.5, f * 0.86], [1, f * 0.78]], a * 0.8, out);
    }
  }

  vireo(t: number) {
    // red-eyed vireo: "here I am… where are you… over here…": short
    // whistled phrases, each different, with a pause between, all day long
    const out = this.place();
    const n = 5 + Math.floor(Math.random() * 5);
    let tt = t;
    for (let k = 0; k < n; k++) {
      const f = rand(2600, 3600);
      const d = rand(0.18, 0.3);
      const shapes: [number, number][][] = [
        [[0, f * 0.75], [1, f * 1.25]],
        [[0, f * 1.3], [1, f * 0.7]],
        [[0, f * 0.8], [0.4, f * 1.3], [1, f * 0.9]],
        [[0, f * 1.2], [0.5, f * 0.8], [1, f * 1.15]],
      ];
      this.note(tt, d, shapes[Math.floor(Math.random() * shapes.length)], 0.032, out, { atk: 0.3, harm: 0.05 });
      if (Math.random() < 0.4) this.note(tt + d + 0.03, 0.08, [[0, f * 1.1], [1, f * 0.85]], 0.025, out);
      tt += d + rand(0.4, 0.75);
    }
  }

  songSparrow(t: number) {
    // "maids, maids, maids, put on your tea-kettle-ettle-ettle": three clear
    // notes, a buzz, a quick run of varied notes and a closing trill
    const out = this.place();
    const f = rand(2600, 3200);
    for (let k = 0; k < 3; k++) this.note(t + k * 0.24, 0.1, [[0, f * 1.05], [1, f * 0.95]], 0.03, out, { atk: 0.2 });
    this.note(t + 0.75, 0.3, [[0, f * 1.35], [1, f * 1.25]], 0.02, out, { trill: 110, depth: 0.06 });
    let tt = t + 1.12;
    for (let k = 0; k < 4; k++) {
      const ff = f * rand(0.8, 1.6);
      this.note(tt, 0.06, [[0, ff * 1.2], [1, ff * 0.8]], 0.026, out);
      tt += 0.085;
    }
    const ft = f * rand(1.1, 1.5);
    for (let k = 0; k < 6; k++) {
      this.note(tt, 0.04, [[0, ft * 1.1], [1, ft * 0.85]], 0.022 * (1 - k / 9), out);
      tt += 0.055;
    }
  }

  oriole(t: number) {
    // Baltimore oriole: rich, unhurried whistles, like someone whistling a
    // tune to themselves; fuller than most (a touch of 2nd harmonic)
    const out = this.place(rand(0.3, 0.9), rand(-0.9, 0.9), 0.15);
    const f = rand(1500, 2000);
    const steps = [1, 1.12, 1.26, 1.5, 0.84, 1.33];
    const n = 4 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let k = 0; k < n; k++) {
      const ff = f * steps[Math.floor(Math.random() * steps.length)];
      const d = rand(0.12, 0.28);
      this.note(tt, d, [[0, ff * rand(0.88, 1.1)], [0.5, ff], [1, ff * rand(0.85, 1.15)]], 0.045, out, { atk: 0.3, harm: 0.15 });
      tt += d + rand(0.05, 0.18);
    }
  }

  houseFinch(t: number) {
    // a long, cheerful, jumbled warble, often ending on a burry downslur
    const out = this.place();
    const end = t + rand(1.8, 3);
    let tt = t;
    while (tt < end) {
      const d = rand(0.05, 0.11);
      const ff = rand(2200, 5200);
      this.note(tt, d, [[0, ff * rand(0.8, 1.2)], [1, ff * rand(0.8, 1.2)]], 0.026, out);
      tt += d + rand(0.01, 0.05);
    }
    if (Math.random() < 0.6) this.note(tt + 0.05, 0.25, [[0, 4200], [1, 2300]], 0.026, out, { trill: 90, depth: 0.05 });
  }

  houseWren(t: number) {
    // house wren: a short, bubbly, tumbling cascade, lower than the winter
    // wren's, starting with a little rattle
    const out = this.place();
    let f = rand(3500, 4500);
    this.note(t, 0.25, [[0, f], [1, f * 0.9]], 0.018, out, { trill: 35, depth: 0.1 });
    let tt = t + 0.28;
    const end = tt + rand(1.5, 2.4);
    while (tt < end) {
      const d = rand(0.04, 0.08);
      this.note(tt, d, [[0, f * 1.1], [1, f * 0.88]], 0.024, out);
      tt += d + 0.012;
      f = Math.min(5500, Math.max(2400, f * rand(0.85, 1.12) * (tt > end - 0.6 ? 0.97 : 1)));
    }
  }

  starling(t: number) {
    // a medley from the wires: a drooping "wolf whistle", clicks, a rattle,
    // a rising whistle (starlings mimic everything around them)
    const out = this.place(rand(0.3, 0.8));
    this.note(t, 0.5, [[0, 3800], [0.4, 3600], [1, 1600]], 0.03, out, { atk: 0.1 });
    let tt = t + 0.65;
    for (let k = 0; k < 8; k++) this.noiseBurst(tt + k * 0.03, 'bandpass', rand(3000, 6000), 3, 0.025, 0.001, 0.012, out);
    tt += 0.35;
    this.note(tt, 0.3, [[0, 2500], [1, 2400]], 0.018, out, { trill: 70, depth: 0.25 });
    if (Math.random() < 0.6) this.note(tt + 0.45, 0.35, [[0, 1800], [0.7, 3600], [1, 3400]], 0.026, out, { atk: 0.4 });
  }

  nuthatch(t: number) {
    // white-breasted nuthatch: a nasal "yank yank", like a little toy horn
    const out = this.place(rand(0.3, 0.9));
    const n = 3 + Math.floor(Math.random() * 4);
    const f = rand(650, 750);
    for (let k = 0; k < n; k++) this.nasal(t + k * rand(0.2, 0.3), f, f * 0.97, 0.09, 0.04, [1400, 2800], out);
  }

  junco(t: number) {
    // dark-eyed junco or pine warbler: a level, musical trill, one note
    // repeated ~14 times a second
    const out = this.place();
    const f = rand(3500, 5000);
    const n = 18 + Math.floor(Math.random() * 10);
    for (let k = 0; k < n; k++) this.note(t + k * 0.07, 0.05, [[0, f * 1.1], [1, f * 0.9]], 0.024 * Math.min(1, (k + 1) / 4), out);
  }

  kingfisher(t: number) {
    // belted kingfisher: a loud, dry rattle as it flies along the shore
    const out = this.place(rand(0.4, 0.9), 0, 0.25);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dur = rand(1, 1.6);
    out.pan.setValueAtTime(-0.8 * dir, t);
    out.pan.linearRampToValueAtTime(0.8 * dir, t + dur);
    for (let tt = t; tt < t + dur; tt += rand(0.03, 0.04)) this.noiseBurst(tt, 'bandpass', rand(2800, 3600), 2.5, 0.07, 0.002, 0.02, out);
  }

  raven(t: number) {
    // common raven: deep, hollow "kronk"s that carry a long way
    const out = this.place(rand(0.5, 1), rand(-0.9, 0.9), 0.4);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) this.nasal(t + k * rand(0.5, 0.9), 330, 290, 0.25, 0.045, [700, 1300], out);
  }

  eagle(t: number) {
    // bald eagle: not the film scream (that is a red-tailed hawk) but a
    // thin, high chittering "kleek-kik-ik-ik-ik"
    const out = this.place(rand(0.5, 1), rand(-0.9, 0.9), 0.3);
    const f = rand(2600, 3000);
    this.note(t, 0.18, [[0, f * 0.9], [0.3, f * 1.1], [1, f * 0.95]], 0.03, out, { harm: 0.2 });
    for (let k = 0; k < 6; k++) this.note(t + 0.25 + k * 0.09, 0.06, [[0, f * 1.05], [1, f * 0.85]], 0.025 * (1 - k / 9), out, { harm: 0.2 });
  }

  variedThrush(t: number) {
    // varied thrush: one long, eerie, burry whistle, silence, then another
    // at a new pitch. Two voices 1–2 % apart beat ~50 times a second: the burr.
    const out = this.place(rand(0.4, 1), rand(-0.9, 0.9), 0.4);
    const n = 2 + Math.floor(Math.random() * 2);
    let tt = t;
    for (let k = 0; k < n; k++) {
      const f = rand(2400, 4200);
      const d = rand(1.4, 2.2);
      this.note(tt, d, [[0, f], [1, f * 0.99]], 0.03, out, { atk: 0.2, second: rand(1.012, 1.018), level: 0.8 });
      tt += d + rand(3, 6);
    }
  }

  plover(t: number) {
    // piping plover: soft, clear, mellow "peep-lo" whistles from the sand
    const out = this.place(rand(0.3, 0.9));
    const f = rand(2200, 2600);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const tt = t + k * rand(0.6, 1);
      this.note(tt, 0.14, [[0, f * 0.9], [0.4, f * 1.05], [1, f]], 0.032, out, { atk: 0.3, harm: 0.05 });
      this.note(tt + 0.16, 0.16, [[0, f * 0.92], [1, f * 0.78]], 0.026, out, { harm: 0.05 });
    }
  }

  tern(t: number) {
    // common tern: a harsh, drawn-out "kee-arrr" over the surf, and "kip"s
    const out = this.place(rand(0.3, 1), rand(-0.9, 0.9), 0.2);
    const f = rand(2600, 3200);
    this.nasal(t, f, f * 0.6, 0.45, 0.04, [f * 1.1, f * 2.2], out);
    const kips = Math.floor(Math.random() * 4);
    for (let k = 0; k < kips; k++) this.nasal(t + 0.6 + k * 0.22, f * 1.1, f, 0.06, 0.02, [f * 1.2, f * 2.4], out);
  }

  savannah(t: number) {
    // savannah sparrow: a thin, insect-like "tsit tsit tsit tseeeee-tsaay"
    const out = this.place(rand(0.3, 0.8));
    const f = rand(6000, 7000);
    for (let k = 0; k < 3; k++) this.note(t + k * 0.12, 0.03, [[0, f * 1.1], [1, f * 0.9]], 0.018, out);
    this.note(t + 0.42, 0.7, [[0, f * 0.95], [1, f]], 0.026, out, { trill: 140, depth: 0.03 });
    this.note(t + 1.15, 0.3, [[0, f * 0.75], [1, f * 0.7]], 0.016, out, { trill: 60, depth: 0.04 });
  }

  blackbird(t: number) {
    // Eurasian blackbird: low, rich, unhurried fluting, each phrase new,
    // often ending in a quiet, squeaky twitter
    const out = this.place(rand(0.3, 0.9), rand(-0.9, 0.9), 0.25);
    const phrases = 2 + Math.floor(Math.random() * 3);
    let tt = t;
    for (let p = 0; p < phrases; p++) {
      const base = rand(1400, 2100);
      const n = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const f = base * rand(0.85, 1.6);
        const d = rand(0.12, 0.3);
        this.note(tt, d, [[0, f * rand(0.9, 1.05)], [0.4, f * rand(1, 1.12)], [1, f * rand(0.85, 1)]], 0.042, out, { atk: 0.3, harm: 0.12 });
        tt += d + rand(0.02, 0.08);
      }
      if (Math.random() < 0.7) {
        const twitter = 4 + Math.floor(Math.random() * 4);
        for (let k = 0; k < twitter; k++) {
          const f = rand(5000, 7500);
          this.note(tt, 0.04, [[0, f], [1, f * rand(0.7, 1.3)]], 0.012, out);
          tt += 0.05;
        }
      }
      tt += rand(2.5, 4.5);
    }
  }

  nightingale(t: number) {
    // common nightingale, the night's virtuoso: phrase after phrase, each
    // different: pure "piu"s swelling into a crescendo, deep "chook"s, a
    // rattling trill, a long rising whistle; short pauses between
    const out = this.place(rand(0.3, 0.8), rand(-0.8, 0.8), 0.35);
    const phrases = 3 + Math.floor(Math.random() * 3);
    let tt = t;
    for (let p = 0; p < phrases; p++) {
      const kind = Math.floor(Math.random() * 4);
      if (kind === 0) {
        const f = rand(1800, 2600);
        const n = 6 + Math.floor(Math.random() * 5);
        let gap = 0.32;
        for (let k = 0; k < n; k++) {
          this.note(tt, 0.13, [[0, f * 0.9], [0.4, f * 1.1], [1, f * 0.95]], 0.012 + (0.035 * k) / n, out, { atk: 0.3, harm: 0.06 });
          tt += gap;
          gap = Math.max(0.15, gap * 0.9);
        }
      } else if (kind === 1) {
        const n = 4 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          this.note(tt, 0.06, [[0, 1300], [1, 650]], 0.04, out, { harm: 0.3 });
          tt += 0.11;
        }
      } else if (kind === 2) {
        const f = rand(3000, 4200);
        const end = tt + rand(0.8, 1.3);
        for (let k = 0; tt < end; k++) {
          const ff = k % 2 ? f : f * 0.75;
          this.note(tt, 0.03, [[0, ff], [1, ff * 0.92]], 0.026, out);
          tt += 0.04;
        }
      } else {
        const f = rand(1800, 2200);
        this.note(tt, 0.9, [[0, f], [0.6, f * 1.8], [1, f * 1.75]], 0.034, out, { atk: 0.6, trill: 6, depth: 0.006 });
        tt += 0.9;
      }
      tt += rand(0.7, 1.6);
    }
  }

  scopsOwl(t: number) {
    // Eurasian scops owl: a soft, pure "tyuu" every couple of seconds, like
    // a slow sonar through the warm Mediterranean night
    const out = this.place(rand(0.4, 1), rand(-0.8, 0.8), 0.35);
    const f = rand(1150, 1300);
    const n = 4 + Math.floor(Math.random() * 5);
    let tt = t;
    for (let k = 0; k < n; k++) {
      this.note(tt, 0.16, [[0, f * 0.96], [0.3, f], [1, f * 0.97]], 0.04, out, { atk: 0.3, harm: 0.05 });
      tt += rand(2.3, 2.8);
    }
  }

  swift(t: number) {
    // a screaming party of swifts racing over the rooftops: shrill trilled
    // screams sweeping across from one side to the other
    const out = this.place(rand(0.3, 0.8), 0, 0.15);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const dur = rand(1.5, 2.5);
    out.pan.setValueAtTime(-0.9 * dir, t);
    out.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
    const n = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const f = rand(5000, 6500);
      this.note(t + rand(0, dur - 0.5), rand(0.35, 0.7), [[0, f], [1, f * 0.9]], 0.016, out, { trill: rand(55, 80), depth: 0.08, second: 1.06, atk: 0.2 });
    }
  }

  serin(t: number) {
    // European serin: a fast, glassy, jingling twitter, like shaken keys
    const out = this.place();
    const end = t + rand(1.5, 2.5);
    let hi = true;
    for (let tt = t; tt < end; tt += 0.042) {
      const f = hi ? rand(6000, 8000) : rand(4000, 5500);
      this.note(tt, 0.034, [[0, f], [1, f * rand(0.8, 1.2)]], 0.022, out);
      hi = !hi || Math.random() < 0.3;
    }
  }

  collaredDove(t: number) {
    // Eurasian collared dove: "coo-COOO-cook", two or three times over
    const out = this.place(rand(0.3, 0.8));
    const f = rand(480, 540);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < n; k++) {
      const tt = t + k * 1.6;
      this.note(tt, 0.25, [[0, f], [1, f * 0.97]], 0.035, out, { harm: 0.2 });
      this.note(tt + 0.35, 0.55, [[0, f * 1.15], [1, f * 1.1]], 0.045, out, { harm: 0.2, atk: 0.3 });
      this.note(tt + 1.0, 0.3, [[0, f * 0.92], [1, f * 0.85]], 0.035, out, { harm: 0.2 });
    }
  }

  euroRobin(t: number) {
    // European robin: thin, wistful cascades of high notes, quick runs
    // sliding down and up; it sings right through the Mediterranean winter
    const out = this.place();
    const phrases = 2 + Math.floor(Math.random() * 2);
    let tt = t;
    for (let p = 0; p < phrases; p++) {
      const n = 6 + Math.floor(Math.random() * 7);
      let f = rand(5000, 7000);
      for (let k = 0; k < n; k++) {
        const d = rand(0.05, 0.12);
        this.note(tt, d, [[0, f], [1, f * rand(0.75, 1.1)]], 0.022, out, Math.random() < 0.15 ? { trill: 35, depth: 0.06 } : {});
        tt += d + rand(0.01, 0.04);
        f = Math.min(8000, Math.max(3000, f * rand(0.82, 1.1)));
      }
      tt += rand(1.5, 3);
    }
  }

  whippoorwill(t: number) {
    // eastern whip-poor-will: "WHIP-poor-WILL" over and over, from the dark
    // woods behind the cottage on summer nights
    const out = this.place(rand(0.5, 1), rand(-0.8, 0.8), 0.4);
    const f = rand(1300, 1500);
    const n = 6 + Math.floor(Math.random() * 8);
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.95;
      this.note(tt, 0.12, [[0, f * 1.2], [1, f * 1.5]], 0.03, out, { harm: 0.05 });
      this.note(tt + 0.17, 0.08, [[0, f], [1, f * 0.95]], 0.018, out);
      this.note(tt + 0.3, 0.26, [[0, f * 1.05], [0.6, f * 1.75], [1, f * 1.55]], 0.036, out, { atk: 0.5, harm: 0.05 });
    }
  }
}
