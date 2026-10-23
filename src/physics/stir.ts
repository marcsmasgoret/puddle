// ─────────────────────────────────────────────────────────────────────────────
// Stirring: a finger dragged through the water
//
// The finger is a small moving obstacle of radius R_f. Water right around it
// is dragged along (no-slip) and water ahead is shoved aside, so a point the
// finger passes over is pushed toward the finger's velocity U_f:
//
//     Δu_total = κ U_f,   κ = 1 − exp(−t_c/τ),   t_c = 2R_f / |U_f|
//
// t_c is how long the finger sits over that point and τ ≈ 50 ms is how fast
// the water there catches up to it. The push is laid down as Gaussians
// exp(−r²/R_f²) spaced d apart along the finger's path; a point on the path
// then collects Σ ≈ R_f√π/d of them, so each one carries κ U_f · d/(R_f√π).
// The Gaussian push converges ahead of the finger (a bow bulge) and diverges
// behind it (a trough), which is what a real finger does.
//
// A nice consequence of shallow-water physics: if the finger moves faster
// than the wave speed c = √(gH) (≈ 0.5 m/s in 2.5 cm of water), the
// disturbances it makes can't outrun it and pile up into a V-shaped wake with
// half-angle sin α = c / U_f — exactly the Mach cone of a supersonic jet.
// Slower than c and there is no V, just a spreading bulge.
// ─────────────────────────────────────────────────────────────────────────────
import type { Impulse } from './solver';

export const FINGER_RADIUS = 0.02; // [m]
const TAU = 0.05; // [s]
const MAX_FINGER_SPEED = 1.5; // [m/s] above this a drag is a sweep, not a stir

export function stirImpulses(x0: number, z0: number, x1: number, z1: number, dt: number): Impulse[] {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 1e-5) return [];
  let ux = dx / dt, uz = dz / dt;
  const speed = Math.hypot(ux, uz);
  if (speed > MAX_FINGER_SPEED) {
    ux *= MAX_FINGER_SPEED / speed;
    uz *= MAX_FINGER_SPEED / speed;
  }
  const speedC = Math.hypot(ux, uz);
  const kappa = 1 - Math.exp(-(2 * FINGER_RADIUS) / Math.max(speedC, 1e-3) / TAU);
  const n = Math.max(1, Math.ceil(len / (FINGER_RADIUS * 0.5)));
  const d = len / n;
  const share = Math.min(1, d / (FINGER_RADIUS * Math.sqrt(Math.PI)));
  const out: Impulse[] = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    out.push({
      x: x0 + dx * t,
      z: z0 + dz * t,
      radius: FINGER_RADIUS,
      pressureImpulse: 0,
      push: [ux * kappa * share, uz * kappa * share],
    });
  }
  return out;
}
