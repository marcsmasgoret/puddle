import * as THREE from 'three';
import { WATER } from './physics/fluids';
import { makeGrid, pickResolution } from './physics/grid';
import { buildPuddle } from './physics/puddleShape';
import { ShallowWaterSolver, GRAVITY, type Impulse } from './physics/solver';
import { computeSlap, handSpeed } from './physics/slap';
import { stirImpulses } from './physics/stir';
import { Droplets } from './physics/droplets';
import { createDropletMesh } from './render/droplets';
import { WetMap } from './render/wetmap';
import { createPanel } from './ui/panel';
import { settings } from './ui/settings';
import { Caustics } from './render/caustics';
import { createWaterMesh } from './render/water';
import { createGroundMaterial, createGround, createBed, FOREST_GROUND } from './render/ground';
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
const fluid = WATER;

// ── physics ──────────────────────────────────────────────────────────────────
const grid = makeGrid(pickResolution());
const shape = buildPuddle(grid, fluid.restDepth);
const solver = new ShallowWaterSolver(renderer, shape, fluid);
const caustics = new Caustics(solver, fluid.refractiveIndex, phoneish ? 1 : 2);

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
const groundMesh = createGround(createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, FOREST_GROUND, false));
const bedMesh = createBed(solver, createGroundMaterial(solver, caustics.target.texture, wetMap.target.texture, FOREST_GROUND, true));
scene.add(groundMesh, bedMesh);
buildForest(scene, palette, [shape.halfX, shape.halfZ], (x, z) => solver.sdfAt(x, z));

const waterScene = new THREE.Scene();
const water = createWaterMesh(solver, fluid);
water.uniforms.uSunDir.value.copy(sunDir);
water.uniforms.uSunColor.value.copy(palette.sunColor).multiplyScalar(palette.sunIntensity);
water.uniforms.uAmbient.value.copy(palette.hemiSky).multiplyScalar(palette.hemiIntensity);
waterScene.add(water.mesh);

const isWater = (x: number, z: number) => solver.sdfAt(x, z) < 0;
const drops = new Droplets(fluid, isWater);
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
function slapAt(x: number, z: number) {
  const slap = computeSlap(handSpeed(settings.strength), solver.depthAt(x, z), fluid, GRAVITY);
  const launched = slap.sprayMass > 0 ? drops.spray(x, z, slap.radius, slap.sprayMass, slap.sprayMeanSpeed) : 0;
  solver.addImpulse({ x, z, radius: slap.radius, pressureImpulse: slap.pressureImpulse, volume: -launched });
  lastSlap = { froude: +slap.froudeRequested.toFixed(2), sprayMl: +(launched * 1e6).toFixed(1) };
}

attachPointer(canvas, camera, {
  isWater,
  onPressAnywhere: () => {
    if (!panel.isOpen()) return false;
    panel.close();
    return true;
  },
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
