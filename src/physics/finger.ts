// ─────────────────────────────────────────────────────────────────────────────
// A fingertip in the fluid: poking, pressing and stirring
//
// The fingertip is a rounded rod of radius a ≈ 9 mm. Three things happen
// when it goes in, and the fluid's own physics decides how they look:
//
// 1. Displacement. Pushing the tip a depth d into the layer displaces a
//    volume π a² d, which has to go somewhere: it is added to the layer
//    around the finger (and taken back as it is pulled out). In water it
//    leaves as a ring of ripples; in honey it bulges into a raised collar
//    that slowly spreads.
//
// 2. The dimple. Water barely notices a slowly inserted finger: only the
//    meniscus dips. A viscous liquid is dragged down with the finger, so the
//    surface forms a funnel that follows it. The dimple depth is taken as
//    δ = w·d, with a "wetting drag" weight w rising with viscosity on a log
//    scale (w ≈ 0.08 for water and mercury, ≈ 0.85 for honey and oobleck).
//    It is applied as a surface pressure p = ρ g δ over the fingertip.
//    Dragged sideways, this moving pressure disturbance is exactly what a
//    ship's hull is to the sea: in water it makes a bow wave and, faster
//    than √(gh), a V-shaped wake; in honey the trench it leaves behind closes
//    slowly (thin-film levelling, D = ρ g h³ / 3μ).
//
// 3. No-slip drag. The fluid touching the finger moves with it
//    (stir.ts): the velocity it hands the fluid is what turns a drag into a
//    swirl in water, and what makes oobleck jam when you move too fast.
//
// Pulling out of a viscous liquid, the liquid clings to the skin and is
// lifted in a short-lived mound before it oozes back: a brief negative
// pressure (suction) after release, for the viscous fluids only.
// ─────────────────────────────────────────────────────────────────────────────
import type { FluidProperties } from './fluids';
import type { Load } from './pressureMap';
import type { Impulse } from './solver';
import { stirImpulses } from './stir';

export const FINGER_TIP = 0.009; // [m] fingertip radius

export type FingerMode = 'stir' | 'hold';

export interface Finger {
  x: number;
  z: number;
  mode: FingerMode;
  /** current depth of the tip below the rest surface [m] */
  depth: number;
  /** true once the finger has been lifted */
  up: boolean;
  /** seconds since lifted (for the cling and the visual) */
  sinceUp: number;
  /** depth at the moment of lifting [m] */
  liftDepth: number;
  /** fraction of the tip coated with fluid, 0…1 (visual) */
  coat: number;
  inWater: boolean;
}

/** how strongly the fluid is dragged down with a finger, 0…1 (log of viscosity) */
export function wettingDrag(f: FluidProperties) {
  const mu = f.rheology.kind === 'shearThickening' ? f.rheology.mu0 : f.viscosity;
  return Math.min(0.85, Math.max(0.08, (Math.log10(mu / 1e-3) / 4) * 0.85));
}

export function newFinger(x: number, z: number, mode: FingerMode): Finger {
  return { x, z, mode, depth: 0, up: false, sinceUp: 0, liftDepth: 0, coat: 0, inWater: true };
}

/**
 * Advance one finger by dt. `restDepth` is the layer depth H under it.
 * Returns the pressure loads for this frame and pushes the fluid impulses
 * (volume displaced, drag) into `out`.
 */
export function stepFinger(
  f: Finger,
  dt: number,
  fluid: FluidProperties,
  g: number,
  restDepth: number,
  moved: { x0: number; z0: number; dt: number } | null,
  out: Impulse[],
  /** smallest load the grid can resolve [m] */
  minR = 0,
): Load[] {
  const w = wettingDrag(fluid);
  const H = Math.max(restDepth, 0.001);
  // how deep the tip wants to be: a press goes most of the way down, a stir
  // skims through the upper part of the layer
  const target = f.up || !f.inWater ? 0 : f.mode === 'hold' ? 0.75 * H : 0.4 * H;
  // pushing in is slow and deliberate; pulling out is quicker
  const tau = target > f.depth ? (f.mode === 'hold' ? 0.45 : 0.1) : 0.15;
  const prev = f.depth;
  f.depth += (target - f.depth) * (1 - Math.exp(-dt / tau));
  const a = FINGER_TIP;

  // 1. displacement: the volume the tip pushes aside appears around it
  const dV = Math.PI * a * a * (f.depth - prev);
  if (Math.abs(dV) > 1e-10) out.push({ x: f.x, z: f.z, radius: Math.max(2.6 * a, 1.5 * minR), pressureImpulse: 0, volume: dV });

  // 3. drag while moving through the fluid
  if (moved && f.depth > 0.0005) {
    for (const imp of stirImpulses(moved.x0, moved.z0, f.x, f.z, moved.dt)) {
      imp.radius = 1.6 * a;
      if (imp.push) {
        const k = Math.min(1, f.depth / (0.3 * H));
        imp.push = [imp.push[0] * k, imp.push[1] * k];
      }
      out.push(imp);
    }
  }

  // coating builds up while the tip is in
  if (f.depth > 0.001) f.coat = Math.min(1, f.coat + dt * 1.5);

  // 2. the dimple, and the cling on the way out
  const loads: Load[] = [];
  if (f.depth > 0.0002) loads.push({ x: f.x, z: f.z, radius: Math.max(1.3 * a, minR), pressure: fluid.density * g * w * f.depth });
  if (f.up) {
    f.sinceUp += dt;
    if (w > 0.3 && f.sinceUp < 0.8) {
      const lift = 0.35 * w * f.liftDepth * Math.exp(-f.sinceUp / 0.22);
      loads.push({ x: f.x, z: f.z, radius: Math.max(1.5 * a, minR), pressure: -fluid.density * g * lift });
    }
  }
  return loads;
}

export function liftFinger(f: Finger) {
  if (f.up) return;
  f.up = true;
  f.sinceUp = 0;
  f.liftDepth = f.depth;
}

/** finished: out of the fluid and the cling has relaxed */
export function fingerDone(f: Finger) {
  return f.up && f.depth < 0.0002 && f.sinceUp > 0.8;
}
