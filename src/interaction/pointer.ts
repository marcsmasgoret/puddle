// Touch / mouse input on the canvas.
//   • tap on the water    → slap at the current strength
//   • drag across it      → stir (the finger drags the water along)
//   • press and hold      → push slowly into the fluid (honey, oobleck only)
//   • skip-stones mode    → flick sideways to throw a stone
//   • fishing mode        → tap the water to cast, tap off it to reel in
// On fluids that can be held, a press is ambiguous at first: it becomes a
// slap if released quickly, a stir if it moves, or a hold after 160 ms.
// Several fingers work at once on touch screens.
import * as THREE from 'three';

export interface PointerHandlers {
  isWater(x: number, z: number): boolean;
  canHold(): boolean;
  onSlap(x: number, z: number): void;
  /** finger moved from (x0,z0) to (x1,z1) over dt seconds while in the water */
  onStir(x0: number, z0: number, x1: number, z1: number, dt: number): void;
  onHoldStart(id: number, x: number, z: number): void;
  onHoldMove(id: number, x: number, z: number): void;
  onHoldEnd(id: number): void;
  /** return true to swallow the press (e.g. it closed a menu) */
  onPressAnywhere?(): boolean;
  /** return true if the press picked up an object (then it is carried) */
  onPickDown?(id: number, ndc: THREE.Vector2): boolean;
  onCarryMove?(id: number, ndc: THREE.Vector2): void;
  onCarryEnd?(id: number, clientX: number, clientY: number): void;
  mode(): 'slap' | 'skip' | 'fish';
  onFlick(dx: number, dy: number, ms: number, startGround: THREE.Vector3): void;
  onCast(x: number, z: number): void;
  onReel(): void;
}

const HOLD_DELAY = 160; // ms
const MOVE_SLOP = 10; // px

type State = 'pending' | 'stir' | 'hold' | 'carry' | 'flick';
interface Finger {
  x: number;
  z: number;
  t: number;
  sx: number;
  sy: number;
  state: State;
  timer?: number;
  t0: number;
  ground: THREE.Vector3;
}

export function attachPointer(canvas: HTMLCanvasElement, camera: THREE.Camera, h: PointerHandlers) {
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const fingers = new Map<number, Finger>();

  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const toWorld = (e: PointerEvent): THREE.Vector3 | null => {
    ray.setFromCamera(toNdc(e), camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (h.onPressAnywhere?.()) return;
    canvas.setPointerCapture(e.pointerId);
    if (h.onPickDown?.(e.pointerId, toNdc(e))) {
      fingers.set(e.pointerId, { x: 0, z: 0, t: e.timeStamp, sx: e.clientX, sy: e.clientY, state: 'carry', t0: e.timeStamp, ground: new THREE.Vector3() });
      return;
    }
    const p = toWorld(e);
    if (!p) return;
    const f: Finger = { x: p.x, z: p.z, t: e.timeStamp, sx: e.clientX, sy: e.clientY, state: 'stir', t0: e.timeStamp, ground: p.clone() };
    fingers.set(e.pointerId, f);
    const mode = h.mode();
    if (mode === 'skip') {
      f.state = 'flick';
      return;
    }
    if (mode === 'fish') {
      if (h.isWater(p.x, p.z)) h.onCast(p.x, p.z);
      else h.onReel();
      f.state = 'carry'; // swallow the rest of this press
      return;
    }
    if (!h.isWater(p.x, p.z)) return;
    if (!h.canHold()) {
      h.onSlap(p.x, p.z);
      return;
    }
    f.state = 'pending';
    f.timer = window.setTimeout(() => {
      if (f.state !== 'pending') return;
      f.state = 'hold';
      h.onHoldStart(e.pointerId, f.x, f.z);
    }, HOLD_DELAY);
  });

  canvas.addEventListener('pointermove', (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    if (f.state === 'carry') {
      h.onCarryMove?.(e.pointerId, toNdc(e));
      return;
    }
    if (f.state === 'flick') return;
    if (f.state === 'pending' && Math.hypot(e.clientX - f.sx, e.clientY - f.sy) > MOVE_SLOP) {
      f.state = 'stir';
      clearTimeout(f.timer);
    }
    // use every coalesced sample so fast drags stay smooth
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e]) {
      const p = toWorld(ev);
      if (!p) continue;
      const dt = Math.max((ev.timeStamp - f.t) / 1000, 1 / 240);
      if (f.state === 'stir' && (h.isWater(p.x, p.z) || h.isWater(f.x, f.z))) h.onStir(f.x, f.z, p.x, p.z, dt);
      if (f.state === 'hold') h.onHoldMove(e.pointerId, p.x, p.z);
      f.x = p.x;
      f.z = p.z;
      f.t = ev.timeStamp;
    }
  });

  const end = (e: PointerEvent) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    clearTimeout(f.timer);
    if (f.state === 'pending') h.onSlap(f.x, f.z);
    if (f.state === 'hold') h.onHoldEnd(e.pointerId);
    if (f.state === 'carry') h.onCarryEnd?.(e.pointerId, e.clientX, e.clientY);
    if (f.state === 'flick') {
      const dx = e.clientX - f.sx, dy = e.clientY - f.sy, ms = e.timeStamp - f.t0;
      if (Math.hypot(dx, dy) > 30 && ms < 700) h.onFlick(dx, dy, ms, f.ground);
      else if (h.isWater(f.x, f.z)) h.onSlap(f.x, f.z);
    }
    fingers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // stop iOS double-tap zoom and long-press callouts
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
}
