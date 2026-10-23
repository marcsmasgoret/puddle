// Analytical results the simulation is checked against.
import { OMEGA_REF } from '../physics/solver';

/**
 * Bottom friction rate c_f [1/s], the CPU twin of frictionRate() in
 * swe/shaders.ts: the larger of the Poiseuille law 3ν/h² and the Stokes-layer
 * law √(νω/2)/h.
 */
export function frictionRate(h: number, nu: number): number {
  return Math.max((3 * nu) / (h * h), Math.sqrt(nu * OMEGA_REF * 0.5) / h);
}

/**
 * Shallow-water dispersion relation (continuum), gravity + surface tension:
 *   ω² = H k² (g + (σ/ρ) k²)
 */
export function omegaSWE(k: number, H: number, g: number, sigRho: number): number {
  return Math.sqrt(H * k * k * (g + sigRho * k * k));
}

/**
 * Full linear (Airy) water-wave theory with surface tension, for reference:
 *   ω² = (g k + (σ/ρ) k³) tanh(k H)
 * Shallow water is its kH → 0 limit; the gap between the two is the
 * shallow-water approximation's error, not the solver's.
 */
export function omegaAiry(k: number, H: number, g: number, sigRho: number): number {
  return Math.sqrt((g * k + sigRho * k * k * k) * Math.tanh(k * H));
}

/**
 * What the discrete scheme should give for a standing mode of wavenumber k:
 *  • space: the staggered 2-point differences turn k² into
 *      λ = (2/Δx · sin(kΔx/2))²
 *  • time: forward–backward stepping of an oscillator of frequency ω₀
 *    oscillates at ω̃ with sin(ω̃Δt/2) = ω₀Δt/2
 *  • damping γ (friction + in-plane viscosity) lowers it to √(ω̃² − (γ/2)²)
 */
export function omegaDiscrete(k: number, H: number, g: number, sigRho: number, dx: number, dt: number, gamma: number): number {
  const s = (2 / dx) * Math.sin((k * dx) / 2);
  const lam = s * s;
  const w0 = Math.sqrt(H * (g * lam + sigRho * lam * lam));
  const wt = (2 / dt) * Math.asin(Math.min(1, (w0 * dt) / 2));
  return Math.sqrt(Math.max(wt * wt - 0.25 * gamma * gamma, 0));
}

/**
 * Decay rate [1/s] of a damped oscillator  η'' + γ η' + ω₀² η = 0:
 *   underdamped (γ < 2ω₀): γ/2
 *   overdamped  (γ > 2ω₀): the slow root (γ − √(γ² − 4ω₀²))/2
 * In the very viscous limit the slow root is ω₀²/γ = g h³ k² / 3ν: the
 * thin-film levelling rate (a diffusion with D = g h³/3ν).
 */
export function decayRate(gamma: number, w0: number): number {
  if (gamma < 2 * w0) return gamma / 2;
  return (gamma - Math.sqrt(gamma * gamma - 4 * w0 * w0)) / 2;
}

/**
 * Stoker's (1957) exact solution of the shallow-water dam break over a wet
 * bed: depth h0 for x < 0, h1 for x > 0, fluid at rest, frictionless.
 *
 * A rarefaction fan runs back into the deep side and a bore (shock) runs
 * into the shallow side, with a uniform middle state (h_m, u_m) between:
 *   rarefaction (Riemann invariant):  u_m = 2(√(g h0) − √(g h_m))
 *   bore (mass + momentum jump):      u_m = (h_m − h1) √(g (h_m + h1) / (2 h_m h1))
 * h_m is found by bisection where the two agree.
 */
export function stoker(h0: number, h1: number, g: number) {
  const fan = (hm: number) => 2 * (Math.sqrt(g * h0) - Math.sqrt(g * hm));
  const bore = (hm: number) => (hm - h1) * Math.sqrt((g * (hm + h1)) / (2 * hm * h1));
  let lo = h1, hi = h0;
  for (let n = 0; n < 100; n++) {
    const mid = 0.5 * (lo + hi);
    if (fan(mid) > bore(mid)) lo = mid;
    else hi = mid;
  }
  const hm = 0.5 * (lo + hi);
  const um = fan(hm);
  const shock = (hm * um) / (hm - h1);
  const c0 = Math.sqrt(g * h0);
  return {
    hm,
    um,
    shock,
    /** depth at position x (from the dam) and time t */
    depth(x: number, t: number) {
      if (x <= -c0 * t) return h0;
      if (x <= (um - Math.sqrt(g * hm)) * t) {
        const r = 2 * c0 - x / t;
        return (r * r) / (9 * g);
      }
      if (x <= shock * t) return hm;
      return h1;
    },
  };
}

/** Least-squares slope and intercept of y on x. */
export function fitLine(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}
