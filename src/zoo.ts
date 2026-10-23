// Development-only model sheet for the sculpted animals (zoo.html; not part of
// the production build). ?a=cat,fox&yaw=0.6
import * as THREE from 'three';
import { sculpt, type AnimalSpec } from './scene/animals/sculpt';
import { Quadruped, type Gait } from './scene/animals/gait';
import { catSpec, mouseSpec, squirrelSpec, rabbitSpec, deerSpec, foxSpec, birdSpec, BIRDS, fishSpec } from './scene/animals/species';

const specs: Record<string, () => AnimalSpec> = {
  cat: catSpec, mouse: mouseSpec, squirrel: squirrelSpec, rabbit: rabbitSpec, deer: () => deerSpec(false), fox: foxSpec, fish: fishSpec,
  ...Object.fromEntries(Object.entries(BIRDS).map(([k, b]) => [k, () => birdSpec(b)])),
};
const q = new URLSearchParams(location.search);
const names = (q.get('a') ?? 'cat').split(',');
const yaw = parseFloat(q.get('yaw') ?? '0.6');
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd6da');
scene.add(new THREE.HemisphereLight('#dfe8f0', '#6a6050', 1.6));
const sun = new THREE.DirectionalLight('#fff3e0', 2.5);
sun.position.set(2, 4, 3);
scene.add(sun);
const t0 = performance.now();
let x = 0;
const box = new THREE.Box3();
const walkers: Quadruped[] = [];
const gait = q.get('gait') as Gait | null;
const speed = parseFloat(q.get('speed') ?? '0.5');
for (const n of names) {
  const a = sculpt(specs[n]());
  a.root.updateMatrixWorld(true);
  box.setFromObject(a.root);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / Math.max(size.x, size.y, size.z * 1.5);
  a.root.scale.setScalar(s);
  a.root.position.set(x, -box.min.y * s, 0);
  a.root.rotation.y = yaw;
  scene.add(a.root);
  if (gait) {
    const spec = specs[n]();
    const H = spec.bones.find((b) => b.name === 'body')!.at[1];
    const w = new Quadruped(a, spec, { cadence: 1.0 / Math.sqrt(H / 0.2), cadenceGain: 0.8, height: H, tailCurve: 0.15 });
    w.gait = gait;
    w.targetSpeed = w.speed = speed;
    w.crouch = parseFloat(q.get('crouch') ?? '0');
    w.sit = parseFloat(q.get('sit') ?? '0');
    w.tailUp = 1;
    walkers.push(w);
    const holder = new THREE.Group();
    holder.position.copy(a.root.position);
    holder.scale.copy(a.root.scale);
    holder.rotation.y = yaw;
    scene.add(holder);
    holder.add(a.root);
    a.root.position.set(0, 0, 0);
    a.root.scale.setScalar(1);
  }
  x += 1.25;
}
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);
cam.position.set((x - 1.25) / 2, 0.6, 2.2 + names.length * 0.9);
cam.lookAt((x - 1.25) / 2, 0.35, 0);
renderer.render(scene, cam);
(window as unknown as { __zoo: unknown }).__zoo = {
  ms: performance.now() - t0,
  done: true,
  step(n: number) {
    for (let k = 0; k < n; k++) for (const w of walkers) {
      w.update(1 / 60);
      w.pos.set(0, 0, 0); // walk on the spot
      w.yaw = 0;
    }
    renderer.render(scene, cam);
  },
};
