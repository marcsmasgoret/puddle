// ─────────────────────────────────────────────────────────────────────────────
// Physical definitions of the floating toys
//
// Dimensions and masses are those of the real objects. Each hull is turned
// into sample volumes by voxelising an inside-test on a regular grid; every
// voxel inside the hull becomes a HullSample of volume s³. The body frame's
// origin is the centre of mass.
//
//  Rubber duck   9 cm long, 25 g hollow vinyl with a flat base. Mean density
//                of its envelope ≈ 0.1 g/cm³ (25 g in ~240 cm³), so it floats
//                very high: in water it sinks about 7 mm, in mercury well under
//                a millimetre.
//  Paper boat    12 cm folded from A5 printer paper (80 g/m² × 0.031 m²
//                ≈ 2.5 g) → 3 g. Almost weightless: rides on its fold line.
//  Bobber        2.4 cm fishing float, 3.6 g: half the weight of the water
//                its sphere would displace, so it rides half under.
//  Toy sailboat  16 cm light wooden hull with a lead strip along the bottom,
//                45 g in all (draft ≈ 1 cm, so it clears a 1.5 cm puddle).
//                The low centre of mass keeps the tall mast upright
//                (positive metacentric height).
//  RC boat       a 20 cm toy speedboat: a V hull 6.5 cm across, 60 g with
//                its motor and battery. Draft ≈ 1 cm, so it runs aground in
//                the shallows at the puddle's edge, as a real one would.
//  Beach donut   toy-sized inflatable ring, 17 cm across, a 2.5 cm vinyl
//                tube around a 6 cm centre circle, 12 g. Its 740 cm³ of air
//                make it ride almost on top of the water (draft ~1 mm), so
//                the wind pushes it about more than anything else.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { BodyDef, HullSample } from './rigidbody';

export type ToyKind = 'duck' | 'paperBoat' | 'sailboat' | 'bobber' | 'donut' | 'rcboat';

function voxelize(inside: (p: THREE.Vector3) => boolean, min: THREE.Vector3, max: THREE.Vector3, s: number, com: THREE.Vector3): HullSample[] {
  const out: HullSample[] = [];
  const p = new THREE.Vector3();
  for (let x = min.x + s / 2; x < max.x; x += s)
    for (let y = min.y + s / 2; y < max.y; y += s)
      for (let z = min.z + s / 2; z < max.z; z += s) {
        p.set(x, y, z);
        if (inside(p)) out.push({ p: p.clone().sub(com), dV: s * s * s, h: s });
      }
  return out;
}

/** Inertia of a solid ellipsoid with semi-axes (a, b, c), scaled for a hollow shell. */
function ellipsoidInertia(m: number, a: number, b: number, c: number, shell = 1) {
  return new THREE.Vector3((m / 5) * (b * b + c * c), (m / 5) * (a * a + c * c), (m / 5) * (a * a + b * b)).multiplyScalar(shell);
}

// model-space shapes are shared with the visual models (scene/toyModels.ts)
export const DUCK = {
  body: { c: new THREE.Vector3(0, 0.03, 0), r: new THREE.Vector3(0.045, 0.03, 0.035) },
  head: { c: new THREE.Vector3(0.027, 0.07, 0), r: 0.023 },
  /** the bottom of the body is flattened at this height (a stable base) */
  base: 0.007,
  com: new THREE.Vector3(0, 0.028, 0),
  mass: 0.025,
};
export const PAPER = { length: 0.12, keel: 0.07, width: 0.05, hull: 0.026, com: new THREE.Vector3(0, 0.009, 0), mass: 0.003 };
export const SAIL = {
  hull: { c: new THREE.Vector3(0, 0.026, 0), r: new THREE.Vector3(0.08, 0.026, 0.032) },
  mast: 0.19,
  com: new THREE.Vector3(0, 0.012, 0),
  mass: 0.045,
};

export const BOBBER = { r: 0.012, mass: 0.0036, com: new THREE.Vector3(0, -0.003, 0) };
export const RCBOAT = { length: 0.2, beam: 0.065, depth: 0.04, mass: 0.06, com: new THREE.Vector3(-0.01, 0.012, 0) };
/** half-beam of the RC boat's V hull at height y and station x */
export function rcHalfBeam(x: number, y: number) {
  const { length: L, beam: B, depth: D } = RCBOAT;
  if (y < 0 || y > D || Math.abs(x) > L / 2) return -1;
  const vee = Math.min(1, (y / D) * 1.8 + 0.15);
  const bow = x > -L * 0.05 ? 1 - Math.pow((x + L * 0.05) / (L * 0.55), 2) : 1;
  return (B / 2) * vee * Math.max(bow, 0);
}
/** torus: centre-circle radius R, tube radius r */
export const DONUT = { R: 0.06, r: 0.025, mass: 0.012, com: new THREE.Vector3(0, 0.025, 0) };

/** area each toy shows to the wind above the water [m²] (sail + hull side) */
export const WINDAGE: Record<ToyKind, number> = { duck: 0.0032, paperBoat: 0.0035, sailboat: 0.011, bobber: 0.0003, donut: 0.0075, rcboat: 0.004 };

export function bodyDef(kind: ToyKind): BodyDef {
  if (kind === 'bobber') {
    const { r, mass, com } = BOBBER;
    const samples = voxelize((p) => p.length() <= r, new THREE.Vector3(-r, -r, -r), new THREE.Vector3(r, r, r), 0.004, com);
    return { mass, inertia: ellipsoidInertia(mass, r, r, r, 1.5), samples, bottom: -r - com.y, radius: r };
  }
  if (kind === 'rcboat') {
    const { length: L, depth: D, beam: B, mass, com } = RCBOAT;
    const samples = voxelize((p) => Math.abs(p.z) <= rcHalfBeam(p.x, p.y), new THREE.Vector3(-L / 2, 0, -B / 2), new THREE.Vector3(L / 2, D, B / 2), 0.008, com);
    const I = new THREE.Vector3((mass / 12) * (B * B + D * D), (mass / 12) * (L * L + B * B), (mass / 12) * (L * L + D * D)).multiplyScalar(1.3);
    return { mass, inertia: I, samples, bottom: -com.y, radius: L * 0.5 };
  }
  if (kind === 'donut') {
    const { R, r, mass, com } = DONUT;
    const inside = (p: THREE.Vector3) => (Math.hypot(p.x, p.z) - R) ** 2 + (p.y - r) ** 2 <= r * r;
    const e = R + r;
    const samples = voxelize(inside, new THREE.Vector3(-e, 0, -e), new THREE.Vector3(e, 2 * r, e), 0.01, com);
    // thin-walled torus: mass in the skin, I_y = m(R² + 3r²/2), I_x = I_z = m(R²/2 + 5r²/8) (×1.2 for the shell)
    const I = new THREE.Vector3(mass * (R * R / 2 + (5 / 8) * r * r), mass * (R * R + 1.5 * r * r), mass * (R * R / 2 + (5 / 8) * r * r)).multiplyScalar(1.2);
    return { mass, inertia: I, samples, bottom: -com.y, radius: R + r };
  }
  if (kind === 'duck') {
    const { body, head, com, mass } = DUCK;
    const inside = (p: THREE.Vector3) => {
      if (p.y < DUCK.base) return false;
      const q = p.clone().sub(body.c).divide(body.r);
      return q.lengthSq() <= 1 || p.distanceTo(head.c) <= head.r;
    };
    const samples = voxelize(inside, new THREE.Vector3(-0.05, DUCK.base, -0.04), new THREE.Vector3(0.055, 0.095, 0.04), 0.008, com);
    // hollow: most mass in the skin, so ~1.5× a solid body's inertia
    return { mass, inertia: ellipsoidInertia(mass, 0.045, 0.04, 0.035, 1.5), samples, bottom: DUCK.base - com.y, radius: 0.045 };
  }
  if (kind === 'paperBoat') {
    const { length, keel, width, hull, com, mass } = PAPER;
    // folded hull: a flat folded base ~3 cm wide flaring out to the rim,
    // with raked ends. The wide base gives it a positive metacentric
    // height (BM = I_waterplane / V ≈ 5 cm ≫ the 9 mm centre of mass)
    const inside = (p: THREE.Vector3) => {
      if (p.y < 0 || p.y > hull) return false;
      const t = p.y / hull;
      const halfLen = (keel + (length - keel) * t) / 2;
      const halfW = (width / 2) * Math.min(1, 0.6 + 0.6 * t);
      return Math.abs(p.x) <= halfLen && Math.abs(p.z) <= halfW;
    };
    const samples = voxelize(inside, new THREE.Vector3(-0.06, 0, -0.025), new THREE.Vector3(0.06, hull, 0.025), 0.006, com);
    const I = new THREE.Vector3((mass / 12) * (width ** 2 + hull ** 2), (mass / 12) * (length ** 2 + width ** 2), (mass / 12) * (length ** 2 + hull ** 2));
    return { mass, inertia: I.multiplyScalar(1.6), samples, bottom: -com.y, radius: 0.055 };
  }
  const { hull, com, mass } = SAIL;
  const inside = (p: THREE.Vector3) => {
    if (p.y > hull.c.y) return false; // the hull is the lower half of an ellipsoid
    return p.clone().sub(hull.c).divide(hull.r).lengthSq() <= 1;
  };
  const samples = voxelize(inside, new THREE.Vector3(-0.08, 0, -0.032), new THREE.Vector3(0.08, 0.026, 0.032), 0.01, com);
  // hull plus a mast: the mast adds to pitch/roll inertia
  const I = ellipsoidInertia(mass, 0.08, 0.026, 0.032);
  I.x += 0.004 * (SAIL.mast * SAIL.mast) / 3;
  I.z += 0.004 * (SAIL.mast * SAIL.mast) / 3;
  return { mass, inertia: I, samples, bottom: -com.y, radius: 0.07 };
}
