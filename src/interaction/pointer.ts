// Touch / mouse input on the canvas.
//   • press on the water  → slap at the current strength
//   • drag across it      → stir (the finger drags the water along)
// Several fingers work at once on touch screens.
import * as THREE from 'three';

export interface PointerHandlers {
  isWater(x: number, z: number): boolean;
  onSlap(x: number, z: number): void;
  /** finger moved from (x0,z0) to (x1,z1) over dt seconds while in the water */
  onStir(x0: number, z0: number, x1: number, z1: number, dt: number): void;
  /** return true to swallow the press (e.g. it closed a menu) */
  onPressAnywhere?(): boolean;
}

export function attachPointer(canvas: HTMLCanvasElement, camera: THREE.Camera, h: PointerHandlers) {
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const active = new Map<number, { x: number; z: number; t: number }>();

  const toWorld = (e: PointerEvent): THREE.Vector3 | null => {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (h.onPressAnywhere?.()) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    if (!p) return;
    active.set(e.pointerId, { x: p.x, z: p.z, t: e.timeStamp });
    if (h.isWater(p.x, p.z)) h.onSlap(p.x, p.z);
  });

  canvas.addEventListener('pointermove', (e) => {
    const last = active.get(e.pointerId);
    if (!last) return;
    // use every coalesced sample so fast drags stay smooth
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e]) {
      const p = toWorld(ev);
      if (!p) continue;
      const dt = Math.max((ev.timeStamp - last.t) / 1000, 1 / 240);
      if (h.isWater(p.x, p.z) || h.isWater(last.x, last.z)) h.onStir(last.x, last.z, p.x, p.z, dt);
      last.x = p.x;
      last.z = p.z;
      last.t = ev.timeStamp;
    }
  });

  const end = (e: PointerEvent) => active.delete(e.pointerId);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // stop iOS double-tap zoom and long-press callouts
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
}
