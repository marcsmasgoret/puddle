// ─────────────────────────────────────────────────────────────────────────────
// Press and hold: a fingertip slowly pushed into the fluid
//
// A held finger is a steady pressure load p(x) on the surface (Gaussian,
// radius ≈ fingertip). In equilibrium the surface sinks until hydrostatics
// balances it:  ρ g Δη = p.  The finger presses in gradually,
//
//     p(t) = p_max (1 − e^(−t/τ)),   τ = 0.5 s,   p_max = ρ g · 0.8 H
//
// so it reaches a dent of ~80 % of the local depth without touching bottom.
// How fast the dent actually forms, and how fast it fills back in after
// release, is entirely down to the fluid's own physics.
//
// Which fluids allow it, and why:
//  • Honey: yes. Thin-film (lubrication) theory says the surface levels like
//    a diffusion with D = ρ g h³ / (3μ). For honey 2.5 cm deep,
//    D ≈ 1×10⁻² m²/s, so a fingertip dent of radius R = 2.2 cm halves in
//    t ≈ R²/(4D) ≈ 0.01 s at full depth (slower as the layer under the finger
//    thins, since D ∝ h³) and refills smoothly, with no waves. For water D is effectively
//    unbounded (inertia, not viscosity, controls it): the dent springs back
//    as sloshing waves instead. That contrast, smooth ooze vs. ringing, is
//    what makes holding honey worthwhile: it oozes back without oscillating.
//  • Oobleck: yes, and it's the point. A slow press keeps the strain rate
//    below γ̇_c, so it flows like thick cream and the finger sinks in. Slap it
//    instead and it jams.
//  • Water and mercury: no. Viscosity is ~10³× too small to control the
//    refill; a finger dent is replaced by waves at once, so holding just stirs.
// ─────────────────────────────────────────────────────────────────────────────
import type { Load } from './pressureMap';

export const PRESS_RADIUS = 0.022; // [m] fingertip
const TAU = 0.5; // [s]

export interface HeldFinger {
  x: number;
  z: number;
  t: number; // seconds held
  depth: number; // local rest depth under the finger [m]
}

export function pressLoad(f: HeldFinger, density: number, g: number): Load {
  const pMax = density * g * 0.8 * f.depth;
  return { x: f.x, z: f.z, radius: PRESS_RADIUS, pressure: pMax * (1 - Math.exp(-f.t / TAU)) };
}
