// ─────────────────────────────────────────────────────────────────────────────
// Validation tests: the production GPU solver, run in simple tanks where the
// answer is known analytically.
//
//  1. Wave speed: a long ridge splits into two pulses moving at √(gH).
//  2. Dispersion: standing waves cos(kx) oscillate at ω(k); gravity waves at
//     long wavelengths, capillary ripples at short ones.
//  3. Damping: standing waves decay at the rate set by the bottom-friction
//     law (Stokes layer for water-like fluids, Poiseuille 3ν/h² for honey).
//  4. Volume: hard slaps far beyond Froude 1 in the real puddle bowl; total
//     volume must not drift and depth must never go negative.
//  5. Dam break: the nonlinear solver against Stoker's exact solution.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeGrid, type Grid } from '../physics/grid';
import { ShallowWaterSolver } from '../physics/solver';
import { buildPuddle } from '../physics/puddleShape';
import { WATER, HONEY, MERCURY, OOBLECK, type FluidProperties } from '../physics/fluids';
import { flatTank, stateFromProfile, tankLength, cellX } from './tank';
import { frictionRate, omegaSWE, omegaAiry, omegaDiscrete, decayRate, stoker, fitLine } from './theory';

const g = 9.81;
/**
 * Amplitude for the linear tests [m]: 20 µm, under 0.5 % of the shallowest
 * depth, so nonlinear effects (which grow with amplitude/depth) stay out of
 * the comparison with linear theory.
 */
const A_LINEAR = 2e-5;

/** A Newtonian fluid like water but with a chosen kinematic viscosity / σ. */
function fluidWith(base: FluidProperties, nu: number, sigma = base.surfaceTension): FluidProperties {
  return { ...base, viscosity: nu * base.density, surfaceTension: sigma, rheology: { kind: 'newtonian' } };
}

export interface Progress {
  (label: string, fraction: number): void;
}

/** Yield to the browser now and then so the page stays responsive. */
const breathe = () => new Promise((r) => setTimeout(r, 0));

export class Bench {
  readonly grid: Grid;
  readonly solver: ShallowWaterSolver;
  readonly jMid: number;

  constructor(renderer: THREE.WebGLRenderer, cells: number) {
    this.grid = makeGrid(cells);
    this.solver = new ShallowWaterSolver(renderer, flatTank(this.grid, 0.01), WATER);
    this.jMid = Math.floor(this.grid.nz / 2);
  }

  /** Flat tank of depth H, given fluid, initial η profile along x. */
  start(H: number, fluid: FluidProperties, eta: (x: number) => number) {
    this.solver.setShape(flatTank(this.grid, H));
    this.solver.setFluid(fluid);
    this.solver.loadState(stateFromProfile(this.grid, eta));
    this.solver.simTime = 0;
  }

  /** η along the middle row of the tank. */
  row(): Float32Array {
    const r = this.solver.readRegion(0, this.jMid, this.grid.nx, 1);
    const eta = new Float32Array(this.grid.nx);
    for (let i = 0; i < this.grid.nx; i++) eta[i] = r[i * 4];
    return eta;
  }

  /** η at one cell of the middle row. */
  at(i: number): number {
    return this.solver.readRegion(i, this.jMid, 1, 1)[0];
  }
}

// ── 1. wave speed ────────────────────────────────────────────────────────────
export interface SpeedResult { H: number; theory: number; measured: number }

export async function waveSpeed(b: Bench, progress: Progress): Promise<SpeedResult[]> {
  const depths = [0.005, 0.01, 0.02, 0.03];
  const L = tankLength(b.grid);
  const out: SpeedResult[] = [];
  // an inviscid, tension-free fluid isolates the long-wave speed √(gH)
  const fluid = fluidWith(WATER, 1e-9, 0);
  for (const [n, H] of depths.entries()) {
    progress(`Wave speed, H = ${H * 100} cm`, n / depths.length);
    const w = 0.08; // ridge half-width [m], long compared with the depth
    b.start(H, fluid, (x) => A_LINEAR * Math.exp(-(((x - L / 2) / w) ** 2)));
    const c = Math.sqrt(g * H);
    const tEnd = (0.38 * L) / c; // stop before the pulse reaches the wall
    const ts: number[] = [], xs: number[] = [];
    const frame = tEnd / 60;
    while (b.solver.simTime < tEnd) {
      b.solver.step(frame);
      const t = b.solver.simTime;
      if (t < 0.25 * tEnd) continue; // let the two pulses separate first
      const eta = b.row();
      // right-moving pulse: the highest point right of centre, refined by a
      // parabola through the three samples around it (sub-cell precision)
      let im = Math.ceil(b.grid.nx / 2), best = -Infinity;
      for (let i = im; i < b.grid.nx - 2; i++) if (eta[i] > best) { best = eta[i]; im = i; }
      const y0 = eta[im - 1], y1 = eta[im], y2 = eta[im + 1];
      const d = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
      ts.push(t);
      xs.push(cellX(b.grid, im + d));
      if (ts.length % 8 === 0) await breathe();
    }
    out.push({ H, theory: c, measured: fitLine(ts, xs).slope });
  }
  return out;
}

// ── 2. dispersion ────────────────────────────────────────────────────────────
export interface DispersionResult {
  m: number; k: number; measured: number; swe: number; discrete: number; airy: number;
}

/**
 * Standing wave η = A cos(kx), k = mπ/L. Its period comes from the zero
 * crossings of η at the wall, sampled 32 times per period.
 */
function measureStanding(b: Bench, H: number, fluid: FluidProperties, m: number, periods: number, tSpan?: number) {
  const L = tankLength(b.grid);
  const k = (m * Math.PI) / L;
  const sr = fluid.surfaceTension / fluid.density;
  const T = (2 * Math.PI) / omegaSWE(k, H, g, sr);
  b.start(H, fluid, (x) => A_LINEAR * Math.cos(k * x));
  const frame = Math.min(T / 32, 1 / 30);
  const tEnd = tSpan ?? periods * T;
  const ts: number[] = [], ys: number[] = [];
  while (b.solver.simTime < tEnd) {
    b.solver.step(frame);
    ts.push(b.solver.simTime);
    ys.push(b.at(1));
  }
  return { k, ts, ys, dt: b.solver.lastPlan!.dt };
}

/** Times where a sampled signal crosses zero (linear interpolation). */
function zeroCrossings(ts: number[], ys: number[]) {
  const z: number[] = [];
  for (let i = 1; i < ys.length; i++) {
    if (ys[i - 1] === 0 || Math.sign(ys[i - 1]) === Math.sign(ys[i])) continue;
    z.push(ts[i - 1] + ((ts[i] - ts[i - 1]) * ys[i - 1]) / (ys[i - 1] - ys[i]));
  }
  return z;
}

export async function dispersion(b: Bench, progress: Progress): Promise<DispersionResult[]> {
  const H = 0.01;
  const fluid = WATER;
  const sr = fluid.surfaceTension / fluid.density;
  const nu = fluid.viscosity / fluid.density;
  const nMax = b.grid.nx - 2;
  const modes = [2, 4, 8, 16, 32, 64, 96, 128, 160, 192, 224].map((m) => Math.round((m * nMax) / 510)).filter((m, i, a) => m >= 2 && a.indexOf(m) === i);
  const out: DispersionResult[] = [];
  for (const [n, m] of modes.entries()) {
    progress(`Dispersion, mode ${m}`, n / modes.length);
    const { k, ts, ys, dt } = measureStanding(b, H, fluid, m, 5);
    const z = zeroCrossings(ts, ys);
    // crossings are half a period apart
    const half = fitLine(z.map((_, i) => i), z).slope;
    const s = (2 / b.grid.dx) * Math.sin((k * b.grid.dx) / 2);
    const gamma = frictionRate(H, nu) + Math.min(nu, (0.2 * b.grid.dx ** 2) / dt) * s * s;
    out.push({
      m,
      k,
      measured: Math.PI / half,
      swe: omegaSWE(k, H, g, sr),
      discrete: omegaDiscrete(k, H, g, sr, b.grid.dx, dt, gamma),
      airy: omegaAiry(k, H, g, sr),
    });
    await breathe();
  }
  return out;
}

// ── 3. damping ───────────────────────────────────────────────────────────────
export interface DampingResult {
  regime: 'stokes' | 'poiseuille';
  nu: number; H: number; m: number; predicted: number; measured: number; frictionLaw: number;
}

export async function damping(b: Bench, progress: Progress): Promise<DampingResult[]> {
  // Stokes-layer regime: water-like fluids of rising viscosity in 2 cm
  // Poiseuille regime: honey (ν = 5.2×10⁻³ m²/s) in layers 4–15 mm deep
  const cases: { regime: DampingResult['regime']; nu: number; H: number; m: number; fluid: FluidProperties }[] = [
    ...[1e-6, 1e-5, 1e-4, 3e-4].map((nu) => ({ regime: 'stokes' as const, nu, H: 0.02, m: 8, fluid: fluidWith(WATER, nu) })),
    ...[0.004, 0.006, 0.01, 0.015].map((H) => ({ regime: 'poiseuille' as const, nu: HONEY.viscosity / HONEY.density, H, m: 16, fluid: HONEY })),
  ];
  const L = tankLength(b.grid);
  const out: DampingResult[] = [];
  for (const [n, c] of cases.entries()) {
    progress(`Damping, ν = ${c.nu.toExponential(0)} m²/s, H = ${c.H * 1000} mm`, n / cases.length);
    const k = (c.m * Math.PI) / L;
    const sr = c.fluid.surfaceTension / c.fluid.density;
    const lamS = (2 / b.grid.dx) * Math.sin((k * b.grid.dx) / 2);
    const lam = lamS * lamS;
    const w0 = Math.sqrt(c.H * (g * lam + sr * lam * lam));
    const cf = frictionRate(c.H, c.nu);
    // run for a few periods and long enough to see the amplitude fall by
    // ~e, but stop before it falls ~e⁶ (then round-off would dominate)
    const guess = decayRate(cf, w0);
    const span = Math.min(20, 6 / guess, Math.max(2.5, (4 * 2 * Math.PI) / w0, 1.2 / guess));
    const { ts, ys, dt } = measureStanding(b, c.H, c.fluid, c.m, 0, span);
    const gamma = cf + Math.min(c.nu, (0.2 * b.grid.dx ** 2) / dt) * lam;
    const predicted = decayRate(gamma, w0);

    let measured: number;
    if (gamma < 2 * w0) {
      // underdamped: fit ln|η| at the successive peaks
      const pt: number[] = [], pa: number[] = [];
      for (let i = 0; i < ys.length - 1; i++) {
        const a = Math.abs(ys[i]);
        if ((i === 0 || a > Math.abs(ys[i - 1])) && a >= Math.abs(ys[i + 1])) {
          pt.push(ts[i]);
          pa.push(Math.log(a));
        }
      }
      measured = -fitLine(pt, pa).slope;
    } else {
      // overdamped: after the fast mode dies out (t > 5/γ), η decays as a
      // single exponential
      const t0 = 5 / gamma;
      const sel = ts.map((t, i) => [t, ys[i]]).filter(([t, y]) => t > t0 && y > 0);
      measured = -fitLine(sel.map((p) => p[0]), sel.map((p) => Math.log(p[1]))).slope;
    }
    out.push({ regime: c.regime, nu: c.nu, H: c.H, m: c.m, predicted, measured, frictionLaw: cf });
    await breathe();
  }
  return out;
}

// ── 4. volume conservation ───────────────────────────────────────────────────
export interface VolumeResult {
  fluid: string; puddleMl: number; slaps: number; maxDriftMl: number; relDrift: number; minDepthMm: number; nan: number;
  series: [number, number][];
}

export async function volume(b: Bench, progress: Progress): Promise<VolumeResult[]> {
  const out: VolumeResult[] = [];
  const fluids = [WATER, HONEY, MERCURY, OOBLECK];
  const { nx, nz, dx } = b.grid;
  for (const [n, f] of fluids.entries()) {
    progress(`Volume, ${f.name}`, n / fluids.length);
    const shape = buildPuddle(b.grid);
    b.solver.setShape(shape);
    b.solver.setFluid(f);
    b.solver.simTime = 0;
    let puddle = 0;
    for (let k = 0; k < nx * nz; k++) puddle += shape.data[k * 4] * dx * dx;

    // a deterministic sequence of very hard slaps: a 6 cm hand at 5 m/s,
    // with *no* Froude cap or spray, so the flow runs far past Fr = 1 and the
    // positivity limiter has to work
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const a = 0.06, V = 5;
    const J = (4 / 3) * f.density * a ** 3 * V;
    const Pi0 = J / (Math.PI * a * a);
    const series: [number, number][] = [];
    let maxDrift = 0, minDepth = Infinity, nan = 0, slaps = 0;
    const frame = 1 / 60;
    for (let step = 0; step < 6 * 60; step++) {
      if (step % 12 === 0 && step < 4 * 60) {
        for (let tries = 0; tries < 20; tries++) {
          const x = (rand() - 0.5) * 1.4, z = (rand() - 0.5) * 0.9;
          if (b.solver.depthAt(x, z) > 0.012) {
            b.solver.addImpulse({ x, z, radius: a, pressureImpulse: Pi0 });
            slaps++;
            break;
          }
        }
      }
      b.solver.step(frame);
      if (step % 10 === 9) {
        const s = b.solver.readState();
        let vol = 0;
        for (let k = 0; k < nx * nz; k++) {
          const e = s[k * 4];
          if (!Number.isFinite(e)) { nan++; continue; }
          vol += e * dx * dx;
          if (shape.data[k * 4 + 2] > 0.5) minDepth = Math.min(minDepth, shape.data[k * 4] + e);
        }
        maxDrift = Math.max(maxDrift, Math.abs(vol));
        series.push([b.solver.simTime, vol * 1e6]);
        await breathe();
      }
    }
    out.push({
      fluid: f.name,
      puddleMl: puddle * 1e6,
      slaps,
      maxDriftMl: maxDrift * 1e6,
      relDrift: maxDrift / puddle,
      minDepthMm: minDepth * 1000,
      nan,
      series,
    });
  }
  return out;
}

// ── 5. dam break ─────────────────────────────────────────────────────────────
export interface DamBreakResult {
  h0: number; h1: number; hm: number; times: number[];
  profiles: { t: number; x: number[]; sim: number[]; exact: number[]; l1: number; shockSim: number; shockExact: number }[];
}

export async function damBreak(b: Bench, progress: Progress): Promise<DamBreakResult> {
  progress('Dam break', 0);
  const h0 = 0.02, h1 = 0.005, Hrest = 0.5 * (h0 + h1);
  const L = tankLength(b.grid);
  const x0 = L / 2;
  // frictionless, tension-free water: Stoker's solution is for the inviscid
  // equations. The Smagorinsky term stays on: it is the scheme's dissipation.
  const fluid = fluidWith(WATER, 1e-9, 0);
  b.start(Hrest, fluid, (x) => (x < x0 ? h0 : h1) - Hrest);
  const exact = stoker(h0, h1, g);
  const times = [0.3, 0.6];
  const profiles: DamBreakResult['profiles'] = [];
  for (const t of times) {
    while (b.solver.simTime < t - 1e-9) b.solver.step(Math.min(1 / 120, t - b.solver.simTime));
    const eta = b.row();
    const xs: number[] = [], sim: number[] = [], ex: number[] = [];
    let err = 0, ref = 0;
    let shockSim = NaN;
    const mid = 0.5 * (exact.hm + h1);
    for (let i = 1; i < b.grid.nx - 1; i++) {
      const x = cellX(b.grid, i) - x0;
      const h = Hrest + eta[i];
      const he = exact.depth(x, t);
      xs.push(x);
      sim.push(h);
      ex.push(he);
      err += Math.abs(h - he);
      ref += Math.abs(he - h1);
      if (Number.isNaN(shockSim) && x > 0 && h < mid) {
        const hp = Hrest + eta[i - 1];
        shockSim = x - b.grid.dx * ((mid - h) / (hp - h));
      }
    }
    profiles.push({ t, x: xs, sim, exact: ex, l1: err / ref, shockSim, shockExact: exact.shock * t });
    progress('Dam break', profiles.length / times.length);
    await breathe();
  }
  return { h0, h1, hm: exact.hm, times, profiles };
}
