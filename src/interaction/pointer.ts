// Phase 1 pointer: a tap on the puddle makes a gentle disturbance so the
// waves can be tested. Phase 2 replaces this with slap / stir / splash.
import * as THREE from 'three';
import type { ShallowWaterSolver } from '../physics/solver';

export function attachPointer(canvas: HTMLCanvasElement, camera: THREE.Camera, solver: ShallowWaterSolver) {
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    if (solver.sdfAt(hit.x, hit.z) > -0.01) return;
    solver.addImpulse({ x: hit.x, z: hit.z, radius: 0.035, pressureImpulse: 60 });
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
