// ─────────────────────────────────────────────────────────────────────────────
// Time step selection (CFL / von Neumann stability)
//
// An explicit scheme is only stable if information never jumps more than about
// one cell per step. We pick the largest stable dt from three limits and then
// split each rendered frame into enough substeps of that size.
//
// 1. Waves (gravity + capillary), forward–backward ("symplectic Euler") scheme.
//    Linearised, the discrete scheme has wave frequency ω for each grid mode,
//        ω² = H · ( g·λ + (σ/ρ)·λ² ),
//    where λ is the eigenvalue of the discrete Laplacian −∇²_h.
//    In 2D the largest is λ_max = 8/dx² (the checkerboard mode). The
//    forward–backward scheme is stable iff ω·dt ≤ 2 for every mode, so
//        dt ≤ 2 / ω_max ,   ω_max = √( H_max (8g/dx² + 64σ/(ρ dx⁴)) ).
//    The capillary part grows like 1/dx², so surface tension, not gravity,
//    usually limits the step at fine resolution.
//
// 2. Advection: the momentum-conserving upwind scheme (swe/shaders.ts) is
//    explicit, so in 2D it needs (|u| + |v|)·dt ≤ dx. The shader clamps the
//    speed √(u² + v²) to U_MAX, and |u| + |v| ≤ √2·|u|, so
//        dt ≤ dx / (√2 · U_MAX).
//
// 3. Horizontal viscosity ν∇²u, treated explicitly: dt ≤ dx² / (4ν).
//    (Bottom friction is treated implicitly and never limits dt.)
//
// A safety factor keeps us comfortably inside all three limits.
// ─────────────────────────────────────────────────────────────────────────────

export const U_MAX = 1.2; // [m/s] velocity clamp used by the solver
const SAFETY = 0.8;
const MAX_SUBSTEPS = 32;

export interface StepPlan {
  dt: number;
  substeps: number;
  /** each individual limit, for the engineering readout */
  limits: { wave: number; advection: number; viscous: number };
  /** true if MAX_SUBSTEPS forced the sim to run slower than real time */
  slowMotion: boolean;
}

export function planSteps(
  frameDt: number,
  dx: number,
  maxDepth: number,
  g: number,
  sigmaOverRho: number,
  nu: number,
): StepPlan {
  const lambdaMax = 8 / (dx * dx);
  const omegaMax = Math.sqrt(maxDepth * (g * lambdaMax + sigmaOverRho * lambdaMax * lambdaMax));
  const wave = 2 / omegaMax;
  const advection = dx / (Math.SQRT2 * U_MAX);
  const viscous = nu > 0 ? (dx * dx) / (4 * nu) : Infinity;
  const dtMax = SAFETY * Math.min(wave, advection, viscous);

  let substeps = Math.ceil(frameDt / dtMax);
  let slowMotion = false;
  if (substeps > MAX_SUBSTEPS) {
    substeps = MAX_SUBSTEPS;
    slowMotion = true;
  }
  const dt = slowMotion ? dtMax : frameDt / substeps;
  return { dt, substeps, limits: { wave, advection, viscous }, slowMotion };
}
