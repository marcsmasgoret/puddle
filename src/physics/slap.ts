// ─────────────────────────────────────────────────────────────────────────────
// Slap model: how a hand hitting the surface turns into waves and spray
//
// 1. Impulse of the slap
//    A flat object of radius a hitting a free surface at speed V suddenly sets
//    the water under it in motion. The momentum it hands over equals the
//    "added mass" of a disc on a free surface times its speed:
//
//        J = (4/3) ρ a³ V                         [N·s]
//
//    This is the same model Glasheen & McMahon (1996) used for the slap phase
//    of the basilisk lizard running on water.
//
// 2. Spreading it over the footprint
//    The solver applies a Gaussian pressure impulse Π(r) = Π₀ exp(−r²/a²),
//    whose integral over the surface is Π₀·π a². Matching J:
//
//        Π₀ = J / (π a²) = (4 / 3π) ρ a V
//
//    and the instantaneous velocity it gives the layer is Δu = −∇Π/ρ, with a
//    peak of Δu_max = √(2/e) · Π₀/(ρ a) ≈ 0.36 V.
//
// 3. Where shallow water stops being shallow water
//    A depth-averaged layer cannot carry flow much faster than its own wave
//    speed c = √(gH): beyond Froude number Fr = Δu/c ≈ 1 the water leaves the
//    surface as a sheet and breaks into drops. So we cap the impulse given to
//    the solver at Fr = 1 and send the rest of the momentum into droplets:
//
//        s = min(1, c / Δu_max)                fraction kept by the layer
//        J_spray = (1 − s) · J · ε             momentum carried by drops
//
//    ε ≈ 0.5 accounts for momentum lost to the bed, turbulence and the crater
//    (an assumption, stated as such in the write-up). The spray mass follows
//    from the drops' mean launch speed v̄:  m_spray = J_spray / v̄.
//
//    Mass is conserved: the spray volume is removed from the puddle at the
//    slap and returned wherever each drop lands.
// ─────────────────────────────────────────────────────────────────────────────
import type { FluidProperties } from './fluids';

/** Palm radius [m]: an adult palm is roughly 8–9 cm across. */
export const HAND_RADIUS = 0.045;
/** Largest froude number the depth-averaged layer is allowed to carry. */
export const FROUDE_MAX = 1.0;
/** Fraction of the excess momentum that actually leaves as spray. */
export const SPRAY_EFFICIENCY = 0.5;

/** Map the UI strength slider (0…1) to hand speed [m/s]. */
export function handSpeed(strength: number): number {
  return 0.3 + 4.7 * Math.pow(Math.max(0, Math.min(1, strength)), 1.4);
}

export interface SlapResult {
  /** pressure impulse handed to the solver [Pa·s] */
  pressureImpulse: number;
  /** footprint radius [m] */
  radius: number;
  /** spray mass [kg] (0 = no splash) and the drops' mean launch speed [m/s] */
  sprayMass: number;
  sprayMeanSpeed: number;
  /** for the engineering readout */
  froudeRequested: number;
}

export function computeSlap(V: number, localDepth: number, fluid: FluidProperties, g: number): SlapResult {
  const a = HAND_RADIUS;
  const rho = fluid.density;
  const J = (4 / 3) * rho * a ** 3 * V;
  const Pi0 = J / (Math.PI * a * a);
  const duMax = Math.sqrt(2 / Math.E) * Pi0 / (rho * a);
  const c = Math.sqrt(g * Math.max(localDepth, 0.002));
  const froudeRequested = duMax / c;
  const s = Math.min(1, (FROUDE_MAX * c) / duMax);

  const meanSpeed = Math.min(0.8 * V, 6);
  let sprayMass = s < 1 ? ((1 - s) * J * SPRAY_EFFICIENCY) / meanSpeed : 0;
  // can't throw more than half the water that is actually under the hand
  const available = 0.5 * rho * Math.PI * a * a * localDepth;
  sprayMass = Math.min(sprayMass, available);

  return { pressureImpulse: s * Pi0, radius: a, sprayMass, sprayMeanSpeed: meanSpeed, froudeRequested };
}
