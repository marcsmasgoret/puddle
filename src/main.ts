import * as THREE from 'three';
import { FLUIDS, type FluidId, type FluidProperties } from './physics/fluids';
import { makeGrid, pickResolution } from './physics/grid';
import { buildPuddle } from './physics/puddleShape';
import { ShallowWaterSolver, GRAVITY, type Impulse } from './physics/solver';
import { pressLoad, type HeldFinger } from './physics/press';
import type { Load } from './physics/pressureMap';
import { computeSlap, handSpeed } from './physics/slap';
import { stirImpulses } from './physics/stir';
import { Droplets } from './physics/droplets';
import { createDropletMesh } from './render/droplets';
import { WetMap } from './render/wetmap';
import { createPanel } from './ui/panel';
import { createFullscreenButton } from './ui/fullscreen';
import { createDrawer } from './ui/drawer';
import { Toys } from './scene/toys';
import { Stones } from './scene/stones';
import { Fishing } from './scene/fishing';
import { STONE } from './physics/skipping';
import { toast } from './ui/toast';
import { settings, saveSettings } from './ui/settings';
import { Caustics } from './render/caustics';
import { createWaterMesh } from './render/water';
import { createGroundMaterial, createGround, createBed, applyGroundFluid, FOREST_GROUND } from './render/ground';
import { PuddleRenderer, LAYER_REFLECT } from './render/pipeline';
import { createSky, LATE_AFTERNOON, sunDirection } from './scene/atmosphere';
import { buildForest } from './scene/forest';
import { frameCamera } from './scene/framing';
import { attachPointer } from './interaction/pointer';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const phoneish = navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900;
const palette = LATE_AFTERNOON;
let fluid: FluidProperties = FLUIDS[settings.fluid] ?? FLUIDS.water;

// ── physics ──────────────────────────────────────────────────────────────────
const grid = makeGrid(pickResolution());
const shape = buildPuddle(grid);
const solver = new ShallowWaterSolver(renderer, shape, fluid);
const caustics = new Caustics(solver, 1.333, phoneish ? 1 : 2);

// ── scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(palette.haze, 25, 260);
const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 1200);

const sky = createSky(palette);
sky.mesh.layers.enable(LAYER_REFLECT);
scene.add(sky.mesh);

const sunDir = sunDirection(palette);
const sun = new THREE.DirectionalLight(palette.sunColor, palette.sunIntensity);
sun.position.copy(sunDir).multiplyScalar(60);
sun.castShadow = true;
sun.shadow.mapSize.set(phoneish ? 1024 : 2048, phoneish ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 4;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity);
hemi.layers.enable(LAYER_REFLECT);
sun.layers.enable(LAYER_REFLECT);
scene.add(hemi);

// sky-lit environment for glossy surfaces (wet ground, rocks)
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(createSky(palette).mesh);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;
scene.environmentIntensity = 0.6;

const wetMap = new WetMap();
const groundMat = createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, FOREST_GROUND, false);
const bedMat = createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, FOREST_GROUND, true);
const groundMesh = createGround(groundMat);
const bedMesh = createBed(solver, bedMat);
scene.add(groundMesh, bedMesh);
buildForest(scene, palette, [shape.halfX, shape.halfZ], (x, z) => solver.sdfAt(x, z));

const waterScene = new THREE.Scene();
const water = createWaterMesh(solver);
water.uniforms.uSunDir.value.copy(sunDir);
water.uniforms.uSunColor.value.copy(palette.sunColor).multiplyScalar(palette.sunIntensity);
water.uniforms.uAmbient.value.copy(palette.hemiSky).multiplyScalar(palette.hemiIntensity);
waterScene.add(water.mesh);

const isWater = (x: number, z: number) => solver.sdfAt(x, z) < 0;
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
dropMesh.material.uniforms.uSkyTop.value.copy(palette.skyTop);
dropMesh.material.uniforms.uSkyHorizon.value.copy(palette.skyHorizon);
waterScene.add(dropMesh.mesh);

const pipeline = new PuddleRenderer(renderer, scene, waterScene, camera, water.uniforms, phoneish ? 0 : 4);

// ── layout ───────────────────────────────────────────────────────────────────
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const f = frameCamera(shape.outline, w / h);
  camera.fov = f.fov;
  camera.aspect = w / h;
  camera.position.copy(f.position);
  camera.lookAt(f.target);
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h, Math.min(window.devicePixelRatio, phoneish ? 2 : 1.75));
}
window.addEventListener('resize', resize);
resize();

// ── interaction ──────────────────────────────────────────────────────────────
const panel = createPanel();
createFullscreenButton();

// ── floating toys ────────────────────────────────────────────────────────────
const toys = new Toys(scene, solver, renderer, camera, {
  impulse: (imp) => solver.addImpulse(imp),
  onEntry(_kind, x, z, v, mass, radius) {
    // a toy landing is a small slap: same impact model, limited to the
    // momentum the toy actually carries (m·v)
    if (!isWater(x, z)) return;
    const hit = computeSlap(v, solver.depthAt(x, z), fluid, GRAVITY, radius * 0.7, mass * v);
    const launched = hit.sprayMass > 0 ? drops.spray(x, z, hit.radius, hit.sprayMass, hit.sprayMeanSpeed) : 0;
    solver.addImpulse({ x, z, radius: hit.radius, pressureImpulse: hit.pressureImpulse, volume: -launched });
  },
});
// ── skipping stones ──────────────────────────────────────────────────────────
const stones = new Stones(
  scene,
  { isFluid: isWater, floorAt: (x, z) => toys.floorAt(x, z), halfX: shape.halfX, halfZ: shape.halfZ },
  (e) => {
    if (!isWater(e.x, e.z)) return;
    const R = Math.max(STONE.radius * 1.5, 1.5 * grid.dx);
    if (e.kind === 'clatter') {
      // a jammed impact on oobleck: a brief matte patch, no spray
      jamMarks.unshift({ x: e.x, z: e.z, t: solver.simTime, s: 0.8 });
      jamMarks.length = Math.min(jamMarks.length, 4);
      return;
    }
    // the momentum the stone gave the fluid becomes a ripple; a hard hit
    // throws a little spray (same impact model as a slap)
    const hit = computeSlap(e.speed, solver.depthAt(e.x, e.z), fluid, GRAVITY, STONE.radius, e.momentum);
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
const fishing = new Fishing(scene, toys, camera, () => {});

function setMode(m: 'slap' | 'skip' | 'fish') {
  settings.mode = m;
  saveSettings();
  if (m !== 'fish') fishing.reelIn(true);
  if (m === 'skip') toast('flick sideways across the puddle <small>· about 20° up is the magic angle</small>', 4200);
  if (m === 'fish') toast('tap the water to cast <small>· tap the grass to reel in</small>', 4200);
}

const ndcAt = (cx: number, cy: number) => {
  const r = canvas.getBoundingClientRect();
  return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
};
const drawer = createDrawer({
  onDragStart: (kind, id, x, y) => toys.carryNew(id, kind, ndcAt(x, y)),
  onDragMove: (id, x, y) => toys.moveCarry(id, ndcAt(x, y)),
  onDragEnd: (id, x, y) => toys.endCarry(id, drawer.isOverButton(x, y)),
  onTap(kind) {
    // drop it from a hand's height somewhere over the water
    for (let k = 0; k < 30; k++) {
      const x = (Math.random() * 2 - 1) * shape.halfX * 0.6;
      const z = (Math.random() * 2 - 1) * shape.halfZ * 0.6;
      if (solver.sdfAt(x, z) < -0.12) {
        toys.spawn(kind, new THREE.Vector3(x, 0.3, z));
        return;
      }
    }
  },
  onClear: () => toys.clear(),
});

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

function slapAt(x: number, z: number) {
  if (fluid.rheology.kind === 'shearThickening') {
    jamMarks.unshift({ x, z, t: solver.simTime, s: Math.min(1, 0.4 + settings.strength) });
    jamMarks.length = Math.min(jamMarks.length, 4);
  }
  const slap = computeSlap(handSpeed(settings.strength), solver.depthAt(x, z), fluid, GRAVITY);
  const launched = slap.sprayMass > 0 ? drops.spray(x, z, slap.radius, slap.sprayMass, slap.sprayMeanSpeed) : 0;
  solver.addImpulse({ x, z, radius: slap.radius, pressureImpulse: slap.pressureImpulse, volume: -launched });
  lastSlap = { froude: +slap.froudeRequested.toFixed(2), sprayMl: +(launched * 1e6).toFixed(1) };
}

attachPointer(canvas, camera, {
  isWater,
  canHold: () => fluid.holdable,
  onHoldStart(id, x, z) {
    held.set(id, { x, z, t: 0, depth: Math.max(solver.depthAt(x, z), 0.002) });
  },
  onHoldMove(id, x, z) {
    const f = held.get(id);
    if (!f || !isWater(x, z)) return;
    f.x = x;
    f.z = z;
    f.depth = Math.max(solver.depthAt(x, z), 0.002);
  },
  onHoldEnd(id) {
    held.delete(id);
  },
  onPressAnywhere: () => {
    if (!panel.isOpen() && !drawer.isOpen()) return false;
    panel.close();
    drawer.close();
    return true;
  },
  onPickDown: (id, ndc) => settings.mode !== 'fish' && toys.pick(id, ndc),
  mode: () => settings.mode,
  onFlick(dx, dy, ms, start) {
    stones.throwFrom({ dx, dy, ms, start }, canvas.clientWidth);
  },
  onCast: (x, z) => fishing.cast(x, z),
  onReel: () => fishing.reelIn(),
  onCarryMove: (id, ndc) => toys.moveCarry(id, ndc),
  onCarryEnd: (id, x, y) => toys.endCarry(id, drawer.isOverButton(x, y)),
  onSlap: slapAt,
  onStir(x0, z0, x1, z1, dt) {
    for (const imp of stirImpulses(x0, z0, x1, z1, dt)) if (isWater(imp.x, imp.z)) solver.addImpulse(imp);
  },
});

// drops that land on the ground drain back into the puddle (see droplets.ts)
let drainBack = 0;
function updateDrops(dt: number) {
  for (const L of drops.step(dt)) {
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

// gentle ambient life: an occasional drip from the trees
let nextDrip = 2 + Math.random() * 4;
function maybeDrip(t: number) {
  if (t < nextDrip) return;
  nextDrip = t + 5 + Math.random() * 9;
  for (let k = 0; k < 20; k++) {
    const x = (Math.random() * 2 - 1) * shape.halfX;
    const z = (Math.random() * 2 - 1) * shape.halfZ;
    if (solver.sdfAt(x, z) < -0.08) {
      // a 2.5 mm drop falling a couple of metres arrives at ~5 m/s
      solver.addImpulse(dropImpact(x, z, 0.0025, 5));
      return;
    }
  }
}

// ── fluids ───────────────────────────────────────────────────────────────────
function applyFluid(f: FluidProperties) {
  fluid = f;
  solver.setFluid(f);
  water.applyFluid(f);
  drops.fluid = f;
  drops.clear();
  drainBack = 0;
  held.clear();
  const o = f.optics;
  caustics.setOptics(o.kind === 'dielectric' ? o.ior : null, o.kind === 'dielectric' ? o.absorption : [0, 0, 0]);
  const ringRough = f.id === 'honey' ? 0.3 : f.id === 'oobleck' ? 0.9 : 0.78;
  for (const m of [groundMat, bedMat]) applyGroundFluid(m, f.stain, f.wetsGround, ringRough);
  const dm = dropMesh.material.uniforms;
  dm.uMetal.value = o.kind === 'metal' ? 1 : 0;
  if (o.kind === 'dielectric') {
    // a drop a few mm across: absorption over its diameter
    const d = 0.006;
    dm.uTint.value.setRGB(...(o.absorption.map((k) => Math.exp(-k * d)) as [number, number, number]));
  } else dm.uTint.value.setRGB(1, 1, 1);
  wetMap.clear(renderer);
}

// fingers held down on honey / oobleck
const held = new Map<number, HeldFinger>();
let fingerLoads: Load[] = [];
function updateHolds(dt: number) {
  for (const f of held.values()) f.t += dt;
  fingerLoads = [...held.values()].map((f) => pressLoad(f, fluid.density, GRAVITY));
}

panel.addChoice<FluidId>(
  'Fluid',
  [['water', 'Water'], ['honey', 'Honey'], ['mercury', 'Mercury'], ['oobleck', 'Oobleck']],
  () => fluid.id,
  (id) => {
    settings.fluid = id;
    saveSettings();
    applyFluid(FLUIDS[id]);
  },
);
panel.addChoice<'slap' | 'skip' | 'fish'>(
  'Play',
  [['slap', 'Slap'], ['skip', 'Skip stones'], ['fish', 'Fishing']],
  () => settings.mode,
  setMode,
);
applyFluid(fluid);

document.getElementById('build')!.textContent = `build ${__COMMIT__}`;

// ── main loop ────────────────────────────────────────────────────────────────
const clock = new THREE.Timer();
clock.connect(document);
let fps = 60;
const stats = { fps: 0, substeps: 0, dtMs: 0, grid: `${grid.nx}x${grid.nz}`, dxMm: +(grid.dx * 1000).toFixed(2), simTime: 0 };
(window as unknown as { __stats: typeof stats }).__stats = stats;
let paused = false;
// test hooks (used by the automated screenshot checks)
(window as unknown as { __puddle: unknown }).__puddle = {
  solver,
  camera,
  shape,
  water: water.mesh,
  scene,
  groundMesh,
  bedMesh,
  causticStats: () => caustics.stats(renderer),
  drops,
  lastSlap: () => lastSlap,
  slapAt: (x: number, z: number, strength: number) => {
    settings.strength = strength;
    slapAt(x, z);
    return lastSlap;
  },
  setFluid: (id: FluidId) => applyFluid(FLUIDS[id]),
  toys,
  stones,
  fishing,
  setMode,
  flick: (dx: number, dy: number, ms: number, z = 0) => stones.throwFrom({ dx, dy, ms, start: new THREE.Vector3(0, 0, z) }, canvas.clientWidth),
  spawnToy: (kind: 'duck' | 'paperBoat' | 'sailboat', x: number, y: number, z: number) => toys.spawn(kind, new THREE.Vector3(x, y, z)),
  hold: (id: number, x: number, z: number) => held.set(id, { x, z, t: 0, depth: Math.max(solver.depthAt(x, z), 0.002) }),
  release: (id: number) => held.delete(id),
  stir: (x0: number, z0: number, x1: number, z1: number, dt: number) => {
    for (const imp of stirImpulses(x0, z0, x1, z1, dt)) if (isWater(imp.x, imp.z)) solver.addImpulse(imp);
  },
  setPaused: (p: boolean) => (paused = p),
};


renderer.setAnimationLoop(() => {
  if (document.hidden || paused) return; // simulation pauses while the tab is hidden
  clock.update();
  const dt = clock.getDelta();
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  maybeDrip(solver.simTime);
  updateHolds(Math.min(dt, 1 / 20));
  updateJamMarks();
  const toyLoads = toys.update(Math.min(dt, 1 / 20), fluid, GRAVITY, (t) => fishing.forceFor(t));
  stones.update(Math.min(dt, 1 / 20), fluid, GRAVITY);
  fishing.update(Math.min(dt, 1 / 20));
  solver.setLoads([...fingerLoads, ...toyLoads]);
  updateDrops(Math.min(dt, 1 / 20));
  solver.step(dt);
  wetMap.update(renderer, Math.min(dt, 1 / 20));
  caustics.update(renderer, sunDir);
  pipeline.render(dt);
  stats.fps = Math.round(fps);
  stats.substeps = solver.lastPlan?.substeps ?? 0;
  stats.dtMs = +((solver.lastPlan?.dt ?? 0) * 1000).toFixed(3);
  stats.simTime = +solver.simTime.toFixed(2);
});
