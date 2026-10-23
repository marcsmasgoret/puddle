// ─────────────────────────────────────────────────────────────────────────────
// Rheology: viscosity as a function of how fast the fluid is being sheared
//
// Water, honey and mercury are Newtonian: μ is a constant. Oobleck (cornstarch
// in water, φ ≈ 0.44) is not. It shear-thickens: stir it slowly and it flows
// like thick cream; hit it and it locks up almost like a solid.
//
// What happens microscopically (Fall et al. 2008/2012, Brown & Jaeger 2014,
// Wyart & Cates 2014): at low strain rate a thin lubricating film keeps the
// grains apart. Above a critical rate the grains are pushed into frictional
// contact, the packing wants to dilate, but the free surface confines it, so
// it jams. The viscosity jumps by orders of magnitude.
//
// Model used here: a regularised power law (Ostwald–de Waele) thickening
// branch with a jammed ceiling and a small yield stress:
//
//     μ(γ̇) = min( μ_max ,  μ₀ [1 + (γ̇/γ̇_c)^(n−1)]  +  τ_y / (γ̇ + γ̇_ε) )
//
//  • μ₀ [1 + (γ̇/γ̇_c)^(n−1)]: Newtonian at γ̇ ≪ γ̇_c, then rising as γ̇^(n−1).
//    The power law is the standard two-parameter description of the
//    thickening branch, and every term has a clear physical reading
//    (onset rate γ̇_c, steepness n). Real cornstarch thickening is
//    *discontinuous*; n = 3 is a smoothed, numerically stable stand-in for
//    that jump, steep enough that 10× faster flow means ~100× more viscous.
//  • μ_max: the jammed state is not infinitely stiff. Brown & Jaeger show the
//    maximum stress a thickened suspension can carry is set by how hard the
//    free surface can confine it, τ_max ~ σ/a (σ: surface tension, a: grain
//    size ≈ 15 µm), i.e. a few kPa. μ_max = 2000 Pa·s reaches that stress at
//    γ̇ ~ 1 /s, so in practice "solid".
//  • τ_y/(γ̇ + γ̇_ε): Fall et al. find a small yield stress at very low rates
//    (the "solid–liquid–solid" sequence), which is why a dent in oobleck
//    stays a little lumpy instead of levelling perfectly. γ̇_ε regularises
//    the division at rest.
//
// Why not a full Wyart–Cates model? It needs the local stress and a
// frictional-contact fraction, i.e. an extra evolving field. The capped
// power law captures the behaviour that matters here (slow = liquid,
// fast = solid, with the right onset rate) using only the local strain rate.
//
// Strain rate in a depth-averaged layer
//   The velocity varies through the depth, so the shear is largest at the
//   bed. For the parabolic (Poiseuille) profile the bed shear rate is
//   3ū/h. The in-plane strain |S| of the depth-averaged flow is added in
//   quadrature:  γ̇ = √( (3|ū|/h)² + |S|² ).
// ─────────────────────────────────────────────────────────────────────────────
import type { FluidProperties } from './fluids';

/** regularisation of the yield term at rest [1/s] */
export const GAMMA_EPS = 0.05;

/** CPU version, used by tests, the engineering plots and the write-up. */
export function viscosityAt(f: FluidProperties, gammaDot: number): number {
  const r = f.rheology;
  if (r.kind === 'newtonian') return f.viscosity;
  const thick = r.mu0 * (1 + Math.pow(gammaDot / r.gammaC, r.n - 1));
  return Math.min(r.muMax, thick + r.yieldStress / (gammaDot + GAMMA_EPS));
}

/** Uniform values the GPU needs (all divided by ρ: kinematic units). */
export function rheologyUniforms(f: FluidProperties) {
  const r = f.rheology;
  if (r.kind === 'newtonian') {
    return { enabled: 0, nu0: f.viscosity / f.density, gammaC: 1, n: 1, nuMax: f.viscosity / f.density, tauY: 0 };
  }
  return {
    enabled: 1,
    nu0: r.mu0 / f.density,
    gammaC: r.gammaC,
    n: r.n,
    nuMax: r.muMax / f.density,
    tauY: r.yieldStress / f.density,
  };
}

/** GLSL twin of viscosityAt (kinematic: returns ν = μ/ρ). */
export const RHEOLOGY_GLSL = /* glsl */ `
uniform float uShearThick;   // 1 = shear-thickening model, 0 = Newtonian
uniform vec4 uRheo;          // (ν₀, γ̇_c, n, ν_max)
uniform float uTauY;         // τ_y / ρ
float viscosityAt(float gammaDot) {
  if (uShearThick < 0.5) return uRheo.x;
  float thick = uRheo.x * (1.0 + pow(gammaDot / uRheo.y, uRheo.z - 1.0));
  return min(uRheo.w, thick + uTauY / (gammaDot + ${GAMMA_EPS.toFixed(3)}));
}
`;
