import * as THREE from 'three';
import { FLUIDS, HOT_WATER, type FluidId, type FluidProperties } from './physics/fluids';
import { makeGrid, pickResolution, SIZES, type PuddleSize } from './physics/grid';
import { buildPuddle } from './physics/puddleShape';
import { ShallowWaterSolver, GRAVITY, type Impulse } from './physics/solver';
import { newFinger, stepFinger, liftFinger, fingerDone, type Finger } from './physics/finger';
import type { Load } from './physics/pressureMap';
import { computeSlap, handSpeed } from './physics/slap';
import { stirImpulses } from './physics/stir';
import type { Impulse as FingerImpulse } from './physics/solver';
import { Droplets } from './physics/droplets';
import { WINDAGE } from './physics/toyBodies';
import { createDropletMesh } from './render/droplets';
import { WetMap } from './render/wetmap';
import { createPanel } from './ui/panel';
import { createFullscreenButton } from './ui/fullscreen';
import { createDrawer } from './ui/drawer';
import { createSoundButton } from './ui/sound';
import { Audio, haptic } from './audio/audio';
import { Engineering } from './ui/engineering';
import { Overlay } from './render/overlay';
import { AdaptiveQuality } from './render/quality';
import { LavaCrust } from './render/lavaCrust';
import { Toys } from './scene/toys';
import { Stones } from './scene/stones';
import { Fishing } from './scene/fishing';
import { CameraRig } from './scene/cameraRig';
import { Rod } from './scene/rod';
import { RcBoat } from './scene/rcBoat';
import { createTutorial } from './ui/tutorial';
import { STONE } from './physics/skipping';
import { toast } from './ui/toast';
import { settings, saveSettings } from './ui/settings';
import { Caustics } from './render/caustics';
import { createWaterMesh } from './render/water';
import { createGroundMaterial, createGround, createBed, applyGroundFluid } from './render/ground';
import { PuddleRenderer, LAYER_REFLECT } from './render/pipeline';
import { frameCamera } from './scene/framing';
import { attachPointer } from './interaction/pointer';
import { World } from './scene/world/world';
import { LOCATIONS, type LocationId } from './scene/world/location';
import type { Season, TimeOfDay, Weather } from './scene/world/palettes';
import type { Waters } from './scene/world/props';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const phoneish = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
/** the fluid chosen in the panel (the hot tub swaps water for 38 °C water) */
let chosenFluid: FluidProperties = FLUIDS[settings.fluid] ?? FLUIDS.water;
let fluid: FluidProperties = chosenFluid;
/** the fluid with its measured properties (engineering sliders may modify `fluid`) */
let measuredFluid: FluidProperties = chosenFluid;
/** gravity [m/s²]: Earth's, unless the engineering slider changes it */
let gravity = GRAVITY;
let engineering: Engineering | undefined;

// ── physics ──────────────────────────────────────────────────────────────────
const grid = makeGrid(pickResolution());
const solver = new ShallowWaterSolver(renderer, buildPuddle(grid), fluid);
const caustics = new Caustics(solver, 1.333, phoneish ? 1 : 2);
const lavaCrust = new LavaCrust(renderer, solver);

// ── scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 1200);

const wetMap = new WetMap();
const groundMat = createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, false);
const bedMat = createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, true);
const groundMesh = createGround(groundMat);
const bed = createBed(solver, bedMat);
scene.add(groundMesh, bed.mesh);

const waterScene = new THREE.Scene();
const water = createWaterMesh(solver);
waterScene.add(water.mesh);

const isWater = (x: number, z: number) => solver.sdfAt(x, z) < 0;
// molten rock lights up its surroundings (a warm light just above the pool)
const lavaLight = new THREE.PointLight('#ff6a1f', 0, 6, 1.4);
lavaLight.position.set(0, 0.35, 0);
let lavaOn = false;
lavaLight.intensity = 0; // kept in the scene so switching fluids never recompiles shaders
lavaLight.layers.enable(LAYER_REFLECT);
scene.add(lavaLight);
// unit vector pointing down the sdf gradient (toward the puddle)
const towardWater = (x: number, z: number): [number, number] => {
  const e = 0.02;
  const gx = solver.sdfAt(x + e, z) - solver.sdfAt(x - e, z);
  const gz = solver.sdfAt(x, z + e) - solver.sdfAt(x, z - e);
  const l = Math.hypot(gx, gz) || 1;
  return [-gx / l, -gz / l];
};
const drops = new Droplets(fluid, isWater, towardWater);
const dropMesh = createDropletMesh(drops, water.uniforms);
waterScene.add(dropMesh.mesh);

const pipeline = new PuddleRenderer(renderer, scene, waterScene, camera, water.uniforms, phoneish ? 0 : 4);

/**
 * A falling drop of radius r hitting the water at speed v hands its momentum
 * m·v to the surface as a pressure impulse over a footprint a few drop radii
 * wide (never narrower than the grid can resolve), and adds its volume.
 */
function dropImpact(x: number, z: number, r: number, v: number): Impulse {
  const volume = (4 / 3) * Math.PI * r ** 3;
  const R = Math.max(2.5 * r, 1.5 * grid.dx);
  return { x, z, radius: R, pressureImpulse: (fluid.density * volume * v) / (Math.PI * R * R), volume };
}

// ── sound ────────────────────────────────────────────────────────────────────
const audio = new Audio();
audio.volume = settings.volume;
audio.musicVolume = settings.musicVolume ?? 0.45;
audio.muted = settings.muted;
const soundScene = () => ({ ...world.config, hotTub: world.hotTub });
// browsers only allow sound after a user gesture
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

// ── the world: location, season, time of day, weather ───────────────────────
const waters: Waters = {
  reflection: { texture: water.uniforms.uReflection.value as THREE.Texture, matrix: water.uniforms.uReflMatrix.value as THREE.Matrix4 },
  time: { value: 0 },
  resolution: new THREE.Vector2(),
};
const world = new World(
  scene,
  renderer,
  solver,
  waters,
  {
    groundMaterials: [groundMat, bedMat],
    onShapeChanged() {
      bed.update();
      resize();
    },
    onHotTub(on) {
      applyFluid(chosenFluid, on);
      audio.setScene({ ...world.config, hotTub: on });
      if (on) toast('the pool is a hot tub for the winter <small>· 38 °C</small>', 3500);
    },
  },
  { location: settings.location, season: settings.season, time: settings.time, weather: settings.weather },
  phoneish,
  (x, z, r, v) => solver.addImpulse(dropImpact(x, z, r, v)),
);

/** lighting changed: pass the sun and sky to the hand-written shaders */
function syncMood() {
  audio.setScene(soundScene());
  const m = world.env.mood;
  water.uniforms.uSunDir.value.copy(world.env.sunDir);
  water.uniforms.uSunColor.value.copy(m.sunColor).multiplyScalar(m.sunIntensity);
  water.uniforms.uAmbient.value.copy(m.hemiSky).multiplyScalar(m.hemiIntensity);
  dropMesh.material.uniforms.uSkyTop.value.copy(m.skyTop);
  dropMesh.material.uniforms.uSkyHorizon.value.copy(m.skyHorizon);
}

// ── layout ───────────────────────────────────────────────────────────────────
const quality = new AdaptiveQuality(() => resize(), grid.nx);
const rig = new CameraRig(camera);
/** the puddle's longest chord: skipping stones are thrown along it */
function skipLine() {
  const o = solver.shape.outline;
  let best = 0, a = o[0], b = o[0];
  for (let i = 0; i < o.length; i++)
    for (let j = i + 1; j < o.length; j++) {
      const d = Math.hypot(o[i][0] - o[j][0], o[i][1] - o[j][1]);
      if (d > best) [best, a, b] = [d, o[i], o[j]];
    }
  // stand at the end nearer the viewer (or the left end of a crosswise chord)
  const flip = Math.abs(a[1] - b[1]) > 0.25 * Math.abs(a[0] - b[0]) ? a[1] < b[1] : a[0] > b[0];
  if (flip) [a, b] = [b, a];
  return { from: new THREE.Vector2(a[0], a[1]), to: new THREE.Vector2(b[0], b[1]) };
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  rig.skipLine = skipLine();
  const f = frameCamera(solver.shape.outline, w / h);
  camera.aspect = w / h;
  rig.setBase(f, solver.shape.halfX, solver.shape.halfZ, w / h);
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h, Math.min(window.devicePixelRatio, phoneish ? 2 : 1.75) * quality.scale);
}
window.addEventListener('resize', resize);
resize();

// ── interaction ──────────────────────────────────────────────────────────────
const panel = createPanel();
createFullscreenButton();

// ── floating toys ────────────────────────────────────────────────────────────
const toys = new Toys(scene, solver, renderer, camera, {
  impulse: (imp) => solver.addImpulse(imp),
  onEntry(kind, x, z, v, mass, radius) {
    // a toy landing is a small slap: same impact model, limited to the
    // momentum the toy actually carries (m·v)
    if (kind === 'duck') audio.squeak();
    if (!isWater(x, z)) return;
    audio.entry(mass, v, chosenFluid.id, panAt(x, z));
    const hit = computeSlap(v, solver.depthAt(x, z), fluid, gravity, radius * 0.7, mass * v);
    const launched = hit.sprayMass > 0 ? drops.spray(x, z, hit.radius, hit.sprayMass, hit.sprayMeanSpeed) : 0;
    solver.addImpulse({ x, z, radius: hit.radius, pressureImpulse: hit.pressureImpulse, volume: -launched });
  },
});
// ── skipping stones ──────────────────────────────────────────────────────────
const stones = new Stones(
  scene,
  {
    isFluid: isWater,
    floorAt: (x, z) => toys.floorAt(x, z),
    get halfX() {
      return solver.shape.halfX;
    },
    get halfZ() {
      return solver.shape.halfZ;
    },
  },
  (e) => {
    if (!isWater(e.x, e.z)) return;
    const R = Math.max(STONE.radius * 1.5, 1.5 * grid.dx);
    if (world.ice.enabled) world.ice.breakAt(e.x, e.z, 0.08);
    if (e.kind === 'skip' || e.kind === 'clatter') audio.skip(e.speed, chosenFluid.id, panAt(e.x, e.z));
    if (e.kind === 'plop') audio.plop(panAt(e.x, e.z));
    if (e.kind === 'clatter') {
      // a jammed impact on oobleck: a brief matte patch, no spray
      jamMarks.unshift({ x: e.x, z: e.z, t: solver.simTime, s: 0.8 });
      jamMarks.length = Math.min(jamMarks.length, 4);
      return;
    }
    // the momentum the stone gave the fluid becomes a ripple; a hard hit
    // throws a little spray (same impact model as a slap)
    const hit = computeSlap(e.speed, solver.depthAt(e.x, e.z), fluid, gravity, STONE.radius, e.momentum);
    const launched = hit.sprayMass > 0 ? drops.spray(e.x, e.z, R, hit.sprayMass, hit.sprayMeanSpeed) : 0;
    solver.addImpulse({ x: e.x, z: e.z, radius: R, pressureImpulse: Math.max(hit.pressureImpulse, e.momentum / (Math.PI * R * R)), volume: -launched });
    if (e.kind === 'skip') {
      const n = stones.current?.skips ?? 0;
      toast(`<b>${n}</b> ${n === 1 ? 'skip' : 'skips'}`, 1800);
    }
  },
  (skips) => {
    const prev = settings.best[fluid.id] ?? 0;
    const record = skips > prev;
    if (record) {
      settings.best[fluid.id] = skips;
      saveSettings();
    }
    const word = skips === 1 ? 'skip' : 'skips';
    toast(
      skips === 0
        ? `straight in <small>· best ${prev} on ${fluid.name.toLowerCase()}</small>`
        : `<b>${skips}</b> ${word} ${record ? '<small>· new best!</small>' : `<small>· best ${prev}</small>`}`,
      3200,
    );
  },
);

// ── fishing ──────────────────────────────────────────────────────────────────
// the line is drawn after the water (waterScene): drawn with the scene, the
// water's refraction would pick it up again and show a second line
const fishing = new Fishing(waterScene, toys, camera, (s) => {
  audio.nibble();
  rod.nibble(s);
});

// ── ways to play: camera, rod, boat, and the how-to button ───────────────────
const rod = new Rod(scene);
fishing.tipProvider = () => rod.tip();
fishing.onCast = () => {
  audio.cast();
  rod.startCast();
};
const boat = new RcBoat(toys);
boat.createStick();
boat.onMotor = (l) => audio.setMotor(l);
const tutorial = createTutorial();
function setMode(m: 'slap' | 'skip' | 'fish' | 'boat') {
  settings.mode = m;
  saveSettings();
  rig.mode = m;
  rod.visible = m === 'fish';
  if (m !== 'fish') fishing.reelIn(true);
  if (m === 'boat') {
    // launch the boat on the water near the middle
    for (let k = 0; k < 40; k++) {
      const x = (Math.random() - 0.5) * solver.shape.halfX, z = (Math.random() - 0.5) * solver.shape.halfZ;
      if (solver.sdfAt(x, z) < -0.25) {
        boat.launch(new THREE.Vector3(x, 0.08, z));
        break;
      }
    }
  } else boat.remove();
  boat.stickVisible = m === 'boat';
  tutorial.show(m === 'slap' ? null : m);
}

const ndcAt = (cx: number, cy: number) => {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
};
const drawer = createDrawer({
  onDragStart: (kind, id, x, y) => toys.carryNew(id, kind, ndcAt(x, y)),
  onDragMove: (id, x, y) => toys.moveCarry(id, ndcAt(x, y), drawer.isOverButton(x, y)),
  onDragEnd: (id, x, y) => toys.endCarry(id, drawer.isOverButton(x, y)),
  onTap(kind) {
    // drop it from a hand's height somewhere over the water
    for (let k = 0; k < 30; k++) {
      const x = (Math.random() * 2 - 1) * solver.shape.halfX * 0.6;
      const z = (Math.random() * 2 - 1) * solver.shape.halfZ * 0.6;
      if (solver.sdfAt(x, z) < -0.12) {
        toys.spawn(kind, new THREE.Vector3(x, 0.3, z));
        return;
      }
    }
  },
  onClear: () => toys.clear(),
});

let lastSlap = { froude: 0, sprayMl: 0 };
// recent impacts on oobleck, for the brief matte "jammed" patch they leave
const jamMarks: { x: number; z: number; t: number; s: number }[] = [];
function updateJamMarks() {
  const now = solver.simTime;
  const marks = water.uniforms.uJamMarks.value as THREE.Vector4[];
  for (let k = 0; k < 4; k++) {
    const m = jamMarks[k];
    if (!m) { marks[k].set(0, 0, 1, 0); continue; }
    marks[k].set(m.x, m.z, 0.075, m.s * Math.exp(-(now - m.t) / 0.4));
  }
}

function fingerUp(f: Finger) {
  liftFinger(f);
  // yanked out of oobleck: it jams around the hole (a brief matte patch)
  if (fluid.rheology.kind === 'shearThickening' && f.inWater && f.depth > 0.004) {
    jamMarks.unshift({ x: f.x, z: f.z, t: solver.simTime, s: 1 });
    jamMarks.length = Math.min(jamMarks.length, 4);
  }
}

function slapAt(x: number, z: number) {
  // a slap shatters any ice within reach of the hand
  if (world.ice.enabled && solver.sdfAt(x, z) > -0.2) {
    world.ice.breakAt(x, z, 0.08 + settings.strength * 0.14);
    audio.crack();
  }
  if (fluid.rheology.kind === 'shearThickening') {
    jamMarks.unshift({ x, z, t: solver.simTime, s: Math.min(1, 0.4 + settings.strength) });
    jamMarks.length = Math.min(jamMarks.length, 4);
  }
  const slap = computeSlap(handSpeed(settings.strength), solver.depthAt(x, z), fluid, gravity);
  const launched = slap.sprayMass > 0 ? drops.spray(x, z, slap.radius, slap.sprayMass, slap.sprayMeanSpeed) : 0;
  solver.addImpulse({ x, z, radius: slap.radius, pressureImpulse: slap.pressureImpulse, volume: -launched });
  lastSlap = { froude: +slap.froudeRequested.toFixed(2), sprayMl: +(launched * 1e6).toFixed(1) };
  audio.slap(chosenFluid.id, settings.strength, launched * 1e6, panAt(x, z));
  haptic(8 + settings.strength * 32);
}

const panPoint = new THREE.Vector3();
/** where a point of the puddle sits on screen, as a stereo position (−0.7 … 0.7) */
function panAt(x: number, z: number) {
  panPoint.set(x, 0, z).project(camera);
  return Math.max(-1, Math.min(1, panPoint.x)) * 0.7;
}

attachPointer(canvas, camera, {
  isWater,
  onFingerDown(id, x, z, mode) {
    const old = fingers.get(id);
    if (old && !old.up) {
      old.mode = mode;
      return;
    }
    const f = newFinger(x, z, mode);
    f.inWater = isWater(x, z);
    fingers.set(id, f);
    fingerMoves.delete(id);
  },
  onFingerMove(id, x, z, dt) {
    const f = fingers.get(id);
    if (!f || f.up) return;
    const m = fingerMoves.get(id) ?? { x0: f.x, z0: f.z, dt: 0 };
    m.dt += dt;
    fingerMoves.set(id, m);
    f.x = x;
    f.z = z;
    f.inWater = isWater(x, z);
    const now = performance.now();
    if (f.inWater && now - lastSwish > 110) {
      lastSwish = now;
      audio.stir(Math.hypot(x - m.x0, z - m.z0) / Math.max(m.dt, 1e-3), chosenFluid.id, panAt(x, z));
    }
  },
  onFingerUp(id) {
    const f = fingers.get(id);
    if (f) fingerUp(f);
  },
  onPressAnywhere: () => {
    if (!panel.isOpen() && !drawer.isOpen() && !soundCard.isOpen() && !tutorial.isOpen()) return false;
    panel.close();
    drawer.close();
    soundCard.close();
    tutorial.close();
    return true;
  },
  onPickDown: (id, ndc) => settings.mode !== 'fish' && toys.pick(id, ndc),
  mode: () => (settings.mode === 'boat' ? 'slap' : settings.mode),
  onFlick(dx, dy, ms, start) {
    // first person: the stone goes where you are facing
    stones.throwFrom({ dx, dy, ms, start }, canvas.clientWidth, { origin: camera.position.clone(), dir: rig.forward() });
  },
  onCast: (x, z) => fishing.cast(x, z),
  onReel: () => fishing.reelIn(),
  onCarryMove: (id, ndc, x, y) => toys.moveCarry(id, ndc, drawer.isOverButton(x, y)),
  onCarryEnd: (id, x, y) => toys.endCarry(id, drawer.isOverButton(x, y)),
  onSlap: slapAt,
});

let lastSwish = 0;

// drops that land on the ground drain back into the puddle (see droplets.ts)
let drainBack = 0;
function updateDrops(dt: number) {
  for (const L of drops.step(dt)) {
    if (Math.random() < 0.35) audio.dropLanded(L.radius, L.onWater, panAt(L.x, L.z));
    if (L.onWater) {
      solver.addImpulse(dropImpact(L.x, L.z, L.radius, L.speed));
    } else {
      wetMap.stamp(L.x, L.z, L.radius * (4 + 3 * Math.random()));
      drainBack += L.volume;
    }
  }
  if (drainBack > 0 && drops.count === 0) {
    solver.addImpulse({ x: 0, z: 0, radius: 0.6, pressureImpulse: 0, volume: drainBack });
    drainBack = 0;
  }
  dropMesh.update();
}

// gentle ambient life: an occasional drip from overhanging trees
let nextDrip = 2 + Math.random() * 4;
function maybeDrip(t: number) {
  if (t < nextDrip) return;
  nextDrip = t + 5 + Math.random() * 9;
  const loc = world.config.location;
  if (loc === 'beach' || loc === 'city' || loc === 'dock' || world.config.weather !== 'clear') return;
  for (let k = 0; k < 20; k++) {
    const x = (Math.random() * 2 - 1) * solver.shape.halfX;
    const z = (Math.random() * 2 - 1) * solver.shape.halfZ;
    if (solver.sdfAt(x, z) < -0.08) {
      // a 2.5 mm drop falling a couple of metres arrives at ~5 m/s
      solver.addImpulse(dropImpact(x, z, 0.0025, 5));
      return;
    }
  }
}

// hot tub jets: bubbles rising from jets along the walls and the floor push
// the surface up and outward in little domes
let jetDebt = 0;
function hotTubJets(dt: number) {
  if (!world.hotTub) return;
  jetDebt += dt * 14;
  while (jetDebt >= 1) {
    jetDebt -= 1;
    const wall = Math.random() < 0.6;
    const a = Math.random() * Math.PI * 2;
    const x = wall ? Math.cos(a) * solver.shape.halfX * 0.85 : (Math.random() - 0.5) * solver.shape.halfX;
    const z = wall ? Math.sin(a) * solver.shape.halfZ * 0.8 : (Math.random() - 0.5) * solver.shape.halfZ;
    if (isWater(x, z)) solver.addImpulse({ x, z, radius: 0.025 + Math.random() * 0.02, pressureImpulse: -(1.5 + Math.random() * 2.5) });
  }
}

// ── fluids ───────────────────────────────────────────────────────────────────
function applyFluid(chosen: FluidProperties, hot = world.hotTub) {
  chosenFluid = chosen;
  const f = hot && chosen.id === 'water' ? HOT_WATER : chosen;
  fluid = f;
  measuredFluid = f;
  world.updateIce(f.id);
  solver.setFluid(f);
  water.applyFluid(f);
  drops.fluid = f;
  drops.clear();
  drainBack = 0;
  fingers.clear();
  const o = f.optics;
  caustics.setOptics(o.kind === 'dielectric' ? o.ior : null, o.kind === 'dielectric' ? o.absorption : [0, 0, 0]);
  const ringRough = f.id === 'honey' || f.id === 'chocolate' ? 0.3 : f.id === 'oobleck' ? 0.9 : 0.78;
  for (const m of [groundMat, bedMat]) applyGroundFluid(m, f.stain, f.wetsGround, ringRough);
  const dm = dropMesh.material.uniforms;
  dm.uMetal.value = o.kind === 'metal' ? 1 : 0;
  if (o.kind === 'dielectric') {
    // a drop a few mm across: absorption over its diameter
    const d = 0.006;
    dm.uTint.value.setRGB(...(o.absorption.map((k) => Math.exp(-k * d)) as [number, number, number]));
  } else if (o.kind === 'opaque') {
    // an opaque drop shows its own colour, not the scene through it
    dm.uTint.value.setRGB(...o.albedo);
  } else dm.uTint.value.setRGB(1, 1, 1);
  // lava: the flowing marbled melt, glowing drops, and the warm light it throws
  lavaCrust.enabled = o.kind === 'lava';
  if (o.kind === 'lava') {
    lavaCrust.crustTime = o.crustTime;
    lavaCrust.restart();
    dm.uTint.value.setRGB(0.05, 0.03, 0.03);
  }
  (dm.uEmit.value as THREE.Color).setRGB(...((o.kind === 'lava' ? [3.2, 0.7, 0.08] : [0, 0, 0]) as [number, number, number]));
  lavaOn = o.kind === 'lava';
  if (!lavaOn) lavaLight.intensity = 0;
  wetMap.clear(renderer);
  engineering?.fluidChanged();
}

// fingertips in the fluid (physics/finger.ts): poking, pressing, stirring
const fingers = new Map<number, Finger>();
const fingerMoves = new Map<number, { x0: number; z0: number; dt: number }>();
let fingerLoads: Load[] = [];
function updateFingers(dt: number) {
  fingerLoads = [];
  const imps: FingerImpulse[] = [];
  for (const [id, f] of fingers) {
    const moved = fingerMoves.get(id) ?? null;
    fingerMoves.delete(id);
    const H = Math.max(solver.depthAt(f.x, f.z), 0.002);
    fingerLoads.push(...stepFinger(f, dt, fluid, gravity, H, moved && moved.dt > 0 ? moved : null, imps, 1.6 * grid.dx));
    if (fingerDone(f)) fingers.delete(id);
  }
  for (const imp of imps) if (isWater(imp.x, imp.z)) solver.addImpulse(imp);
}

let markFluid: (v: FluidId) => void = () => {};
const soundCard = createSoundButton({
  music: () => settings.musicVolume ?? 0.45,
  setMusic(v) {
    settings.musicVolume = v;
    audio.setMusicVolume(v);
    saveSettings();
  },
  sounds: () => settings.volume,
  setSounds(v) {
    settings.volume = v;
    audio.setVolume(v);
    saveSettings();
  },
  muted: () => settings.muted,
  setMuted(m) {
    settings.muted = m;
    audio.setMuted(m);
    saveSettings();
  },
});
markFluid = panel.addChoice<FluidId>(
  'Fluid',
  [['water', 'Water'], ['honey', 'Honey'], ['chocolate', 'Chocolate sauce'], ['mercury', 'Mercury'], ['oobleck', 'Oobleck'], ['lava', 'Lava'], ['jello', 'Red jello']],
  () => fluid.id,
  (id) => {
    settings.fluid = id;
    saveSettings();
    applyFluid(FLUIDS[id]);
  },
);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const SEASONS: [Season, string][] = [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']];
const TIMES: [TimeOfDay, string][] = [['sunrise', 'Sunrise'], ['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']];
const WEATHERS: [Weather, string][] = [['clear', 'Clear'], ['rain', 'Rain'], ['wind', 'Wind'], ['snow', 'Snow']];
const marks: { [K in 'location' | 'season' | 'time' | 'weather']?: (v: string) => void } = {};
function setWorld(part: Partial<{ location: LocationId; season: Season; time: TimeOfDay; weather: Weather }>) {
  Object.assign(settings, part);
  saveSettings();
  for (const [k, v] of Object.entries(part)) marks[k as keyof typeof marks]?.(v as string);
  world.set(part).then(syncMood);
}
marks.location = panel.addChoice<LocationId>('Place', LOCATIONS, () => world.config.location, (v) => setWorld({ location: v })) as (v: string) => void;
marks.season = panel.addChoice<Season>('Season', SEASONS, () => world.config.season, (v) => setWorld({ season: v })) as (v: string) => void;
marks.time = panel.addChoice<TimeOfDay>('Time', TIMES, () => world.config.time, (v) => setWorld({ time: v })) as (v: string) => void;
marks.weather = panel.addChoice<Weather>('Weather', WEATHERS, () => world.config.weather, (v) => setWorld({ weather: v })) as (v: string) => void;
panel.addButtons([
  [
    'Shuffle everything',
    () => {
      const part = {
        location: pick(LOCATIONS)[0],
        season: pick(SEASONS)[0],
        time: pick(TIMES)[0],
        weather: pick(WEATHERS)[0],
      };
      const f = pick(['water', 'water', 'water', 'honey', 'chocolate', 'mercury', 'oobleck', 'lava', 'jello'] as FluidId[]);
      settings.fluid = f;
      applyFluid(FLUIDS[f]);
      markFluid(f);
      setWorld(part);
    },
  ],
]);
panel.addChoice<PuddleSize>(
  'Puddle size',
  [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']],
  () => settings.size ?? 'normal',
  (s) => {
    const was = settings.size ?? 'normal';
    if (s === was) return;
    settings.size = s;
    saveSettings();
    // the simulation is built for one size: fade out and start again
    const veil = document.createElement('div');
    veil.className = 'ui-veil';
    veil.textContent = SIZES[s] < SIZES[was] ? 'a smaller puddle…' : 'a bigger puddle…';
    document.body.append(veil);
    requestAnimationFrame(() => veil.classList.add('on'));
    setTimeout(() => {
      const q = new URLSearchParams(location.search);
      q.delete('size');
      location.search = q.toString();
      location.reload();
    }, 450);
  },
);
const markMode = panel.addChoice<'slap' | 'skip' | 'fish' | 'boat'>(
  'Play',
  [['slap', 'Slap'], ['skip', 'Skip stones'], ['fish', 'Fishing'], ['boat', 'RC boat']],
  () => settings.mode,
  setMode,
);
const [engButton] = panel.addButtons([
  [
    'Engineering mode',
    () => {
      panel.close();
      engineering!.toggle();
    },
  ],
]);
world.ready().then(() => {
  syncMood();
  applyFluid(chosenFluid);
  setMode(settings.mode ?? 'slap');
  rig.snap();
});


// ── main loop ────────────────────────────────────────────────────────────────
const clock = new THREE.Timer();
clock.connect(document);
let fps = 60;
const stats = { cpuMs: 0, fps: 0, substeps: 0, dtMs: 0, grid: `${grid.nx}x${grid.nz}`, dxMm: +(grid.dx * 1000).toFixed(2), simTime: 0 };
(window as unknown as { __stats: typeof stats }).__stats = stats;
let paused = false;

// ── engineering mode ─────────────────────────────────────────────────────────
const overlay = new Overlay(solver);
engineering = new Engineering(
  solver,
  overlay,
  {
    base: () => measuredFluid,
    setFluid(f) {
      fluid = f;
      solver.updateFluid(f);
      drops.fluid = f;
    },
    setGravity(g) {
      gravity = g;
      solver.gravity = g;
    },
    bodies: () => toys.toys.map((t) => ({ kind: t.kind, body: t.body })),
    lastSlap: () => lastSlap,
    stats,
  },
  __COMMIT__,
);
engineering.onToggle = (o) => {
  engButton.classList.toggle('on', o);
  // the overlays read best on the plain puddle: engineering mode slaps
  if (o && settings.mode !== 'slap') {
    setMode('slap');
    markMode('slap');
  }
};
if (new URLSearchParams(location.search).has('eng')) engineering.toggle(true);
// test hooks (used by the automated screenshot checks)
(window as unknown as { __puddle: unknown }).__puddle = {
  solver,
  camera,
  world,
  setWorld,
  water: water.mesh,
  scene,
  groundMesh,
  bedMesh: bed.mesh,
  causticStats: () => caustics.stats(renderer),
  drops,
  lastSlap: () => lastSlap,
  slapAt: (x: number, z: number, strength: number) => {
    settings.strength = strength;
    slapAt(x, z);
    return lastSlap;
  },
  setFluid: (id: FluidId) => {
    settings.fluid = id;
    applyFluid(FLUIDS[id]);
  },
  toys,
  stones,
  fishing,
  setMode,
  flick: (dx: number, dy: number, ms: number, z = 0) =>
    settings.mode === 'skip'
      ? stones.throwFrom({ dx, dy, ms, start: new THREE.Vector3(0, 0, z) }, canvas.clientWidth, { origin: camera.position.clone(), dir: rig.forward() })
      : stones.throwFrom({ dx, dy, ms, start: new THREE.Vector3(0, 0, z) }, canvas.clientWidth),
  boat,
  rig,
  get engineering() {
    return engineering;
  },
  spawnToy: (kind: 'duck' | 'paperBoat' | 'sailboat' | 'donut', x: number, y: number, z: number) => toys.spawn(kind, new THREE.Vector3(x, y, z)),
  hold: (id: number, x: number, z: number) => fingers.set(id, newFinger(x, z, 'hold')),
  release: (id: number) => fingers.get(id) && fingerUp(fingers.get(id)!),
  fingers,
  stir: (x0: number, z0: number, x1: number, z1: number, dt: number) => {
    for (const imp of stirImpulses(x0, z0, x1, z1, dt)) if (isWater(imp.x, imp.z)) solver.addImpulse(imp);
  },
  setPaused: (p: boolean) => (paused = p),
  audio,
  mouse: (chase: boolean) => world.mouseCat.trigger(chase),
  renderer,
  printsMax: () => {
    const t = world.prints.target;
    const buf = new Uint16Array(t.width * t.height * 4);
    renderer.readRenderTargetPixels(t, 0, 0, t.width, t.height, buf);
    let m = 0, n = 0;
    for (let k = 0; k < buf.length; k += 4) {
      const v = THREE.DataUtils.fromHalfFloat(buf[k]);
      if (v > 0.05) n++;
      m = Math.max(m, v);
    }
    return { max: m, texels: n };
  },
};


renderer.setAnimationLoop(() => {
  if (document.hidden || paused) return; // simulation pauses while the tab is hidden
  clock.update();
  const dt = clock.getDelta();
  const cpu0 = performance.now();
  quality.sample(dt);
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  maybeDrip(solver.simTime);
  updateFingers(Math.min(dt, 1 / 20));
  updateJamMarks();
  world.update(Math.min(dt, 1 / 20));
  hotTubJets(Math.min(dt, 1 / 20));
  water.uniforms.uIce.value = world.ice.texture;
  water.uniforms.uIceOn.value = world.ice.enabled ? 1 : 0;
  rig.update(Math.min(dt, 1 / 20));
  if (rod.group.visible) {
    rod.load = fishing.load;
    rod.update(camera, Math.min(dt, 1 / 20));
  }
  boat.update(Math.min(dt, 1 / 20), fluid.density, (x, z) => solver.depthAt(x, z), (imp) => solver.addImpulse(imp));
  const toyLoads = toys.update(Math.min(dt, 1 / 20), fluid, gravity, (t) => {
    const f = fishing.forceFor(t) ?? boat.forceFor(t) ?? new THREE.Vector3();
    return f.add(world.weather.windForce(WINDAGE[t.kind]));
  });
  stones.update(Math.min(dt, 1 / 20), fluid, gravity);
  fishing.update(Math.min(dt, 1 / 20));
  solver.setLoads([...fingerLoads, ...toyLoads, ...world.weather.loads()]);
  updateDrops(Math.min(dt, 1 / 20));
  solver.step(dt);
  wetMap.update(renderer, Math.min(dt, 1 / 20));
  caustics.update(renderer, world.env.sunDir);
  lavaCrust.update(Math.min(dt, 1 / 20));
  water.uniforms.uCrust.value = lavaCrust.texture;
  water.uniforms.uTime.value += dt;
  if (lavaOn) lavaLight.intensity = 7 + 0.6 * Math.sin(solver.simTime * 2.3) + 0.5 * Math.sin(solver.simTime * 5.1);
  pipeline.render(dt);
  if (engineering!.isOpen) {
    overlay.render(renderer, camera, toys.toys.map((t) => t.body), gravity);
    engineering!.update(performance.now());
  }
  stats.fps = Math.round(fps);
  stats.cpuMs = +(stats.cpuMs * 0.9 + (performance.now() - cpu0) * 0.1).toFixed(1);
  stats.substeps = solver.lastPlan?.substeps ?? 0;
  stats.dtMs = +((solver.lastPlan?.dt ?? 0) * 1000).toFixed(3);
  stats.simTime = +solver.simTime.toFixed(2);
});
