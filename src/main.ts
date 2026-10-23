import * as THREE from 'three';
import { WATER } from './physics/fluids';
import { makeGrid, pickResolution } from './physics/grid';
import { buildPuddle } from './physics/puddleShape';
import { ShallowWaterSolver } from './physics/solver';
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

scene.add(createGround(createGroundMaterial(solver, caustics.target.texture, FOREST_GROUND, false)));
scene.add(createBed(solver, createGroundMaterial(solver, caustics.target.texture, FOREST_GROUND, true)));
buildForest(scene, palette, [shape.halfX, shape.halfZ], (x, z) => solver.sdfAt(x, z));

const waterScene = new THREE.Scene();
const water = createWaterMesh(solver, fluid);
water.uniforms.uSunDir.value.copy(sunDir);
water.uniforms.uSunColor.value.copy(palette.sunColor).multiplyScalar(palette.sunIntensity);
water.uniforms.uAmbient.value.copy(palette.hemiSky).multiplyScalar(palette.hemiIntensity);
waterScene.add(water.mesh);

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

attachPointer(canvas, camera, solver);

// gentle ambient life: an occasional drip from the trees
let nextDrip = 2 + Math.random() * 4;
function maybeDrip(t: number) {
  if (t < nextDrip) return;
  nextDrip = t + 5 + Math.random() * 9;
  for (let k = 0; k < 20; k++) {
    const x = (Math.random() * 2 - 1) * shape.halfX;
    const z = (Math.random() * 2 - 1) * shape.halfZ;
    if (solver.sdfAt(x, z) < -0.08) {
      // a 4 mm drop falling from ~2 m: impulse ≈ ρ·v·(drop size)
      solver.addImpulse({ x, z, radius: 0.006, pressureImpulse: 6 });
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
  causticStats: () => caustics.stats(renderer),
  setPaused: (p: boolean) => (paused = p),
};


renderer.setAnimationLoop(() => {
  if (document.hidden || paused) return; // simulation pauses while the tab is hidden
  clock.update();
  const dt = clock.getDelta();
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  maybeDrip(solver.simTime);
  solver.step(dt);
  caustics.update(renderer, sunDir);
  pipeline.render(dt);
  stats.fps = Math.round(fps);
  stats.substeps = solver.lastPlan?.substeps ?? 0;
  stats.dtMs = +((solver.lastPlan?.dt ?? 0) * 1000).toFixed(3);
  stats.simTime = +solver.simTime.toFixed(2);
});
