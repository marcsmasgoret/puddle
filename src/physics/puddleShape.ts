// ─────────────────────────────────────────────────────────────────────────────
// Puddle shape: signed distance field (SDF) + bathymetry (floor depth)
//
// The outline is an irregular closed curve r(θ) built from a few random
// Fourier harmonics, which gives the lumpy, organic edge of a real puddle.
// From it we compute, for every grid cell:
//
//   sdf(x)  signed distance to the edge [m]: negative inside, positive outside.
//           Used for the wall (wave reflection) boundary, the soft rendered
//           shoreline and the darker wet ring around the edge.
//
//   H(x)    resting water depth [m]: a shallow saucer, deepest in the middle
//           and thinning to ~1 mm at the edge, plus gentle floor lumps.
//           Depth matters physically: long waves travel at √(gH), so waves
//           slow down and bend (refract) as they run into the shallows, just
//           like ocean swell approaching a beach.
// ─────────────────────────────────────────────────────────────────────────────
import { DOMAIN_X, DOMAIN_Z, type Grid } from './grid';

export interface PuddleShape {
  /** Outline polygon in world xz [m] */
  outline: [number, number][];
  /** Per-cell RGBA: R = H (rest depth) [m], G = sdf [m], B = wet flag, A = 0 */
  data: Float32Array;
  grid: Grid;
  /** Half extents of the outline's bounding box [m] */
  halfX: number;
  halfZ: number;
}

/** Small deterministic PRNG so a given seed always yields the same puddle. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t >>> 0) / 4294967296);
  };
}

/** Deepest point of the bowl [m]: every fluid fills the same 1.5 cm bowl. */
export const BOWL_DEPTH = 0.015;

export function buildPuddle(grid: Grid, restDepth = BOWL_DEPTH, seed = 7): PuddleShape {
  const rand = mulberry32(seed);

  // ── outline r(θ) = 1 + Σ aₖ sin(kθ + φₖ), stretched to an ellipse ──
  const harmonics = [2, 3, 4, 5, 7].map((k) => ({
    k,
    a: (0.11 / k ** 0.8) * (0.5 + rand()),
    phase: rand() * Math.PI * 2,
  }));
  const RX = 0.98;
  const RZ = 0.66;
  const N = 256;
  const outline: [number, number][] = [];
  for (let n = 0; n < N; n++) {
    const th = (n / N) * Math.PI * 2;
    let r = 1;
    for (const h of harmonics) r += h.a * Math.sin(h.k * th + h.phase);
    outline.push([Math.cos(th) * r * RX, Math.sin(th) * r * RZ]);
  }
  let halfX = 0;
  let halfZ = 0;
  for (const [x, z] of outline) {
    halfX = Math.max(halfX, Math.abs(x));
    halfZ = Math.max(halfZ, Math.abs(z));
  }
  // keep a margin for the wet ring inside the domain
  const fit = Math.min((DOMAIN_X / 2 - 0.12) / halfX, (DOMAIN_Z / 2 - 0.12) / halfZ, 1);
  for (const p of outline) {
    p[0] *= fit;
    p[1] *= fit;
  }
  halfX *= fit;
  halfZ *= fit;

  // ── exact signed distance to the polygon (brute force, done once) ──
  const { nx, nz, dx } = grid;
  const data = new Float32Array(nx * nz * 4);
  const ax = new Float32Array(N), az = new Float32Array(N);
  const bx = new Float32Array(N), bz = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const [x0, z0] = outline[n];
    const [x1, z1] = outline[(n + 1) % N];
    ax[n] = x0; az[n] = z0; bx[n] = x1 - x0; bz[n] = z1 - z0;
  }
  const floorLumps = Array.from({ length: 14 }, () => ({
    x: (rand() * 2 - 1) * halfX * 0.8,
    z: (rand() * 2 - 1) * halfZ * 0.8,
    r: 0.06 + rand() * 0.18,
    h: (rand() * 2 - 1) * 0.25,
  }));

  for (let j = 0; j < nz; j++) {
    const z = -DOMAIN_Z / 2 + (j + 0.5) * dx;
    for (let i = 0; i < nx; i++) {
      const x = -DOMAIN_X / 2 + (i + 0.5) * dx;
      // distance to nearest segment, and inside test by crossing number
      let d2 = Infinity;
      let inside = false;
      for (let n = 0; n < N; n++) {
        const px = x - ax[n], pz = z - az[n];
        const t = Math.max(0, Math.min(1, (px * bx[n] + pz * bz[n]) / (bx[n] * bx[n] + bz[n] * bz[n])));
        const ex = px - bx[n] * t, ez = pz - bz[n] * t;
        const e2 = ex * ex + ez * ez;
        if (e2 < d2) d2 = e2;
        const zA = az[n], zB = az[n] + bz[n];
        if ((zA > z) !== (zB > z)) {
          const xCross = ax[n] + ((z - zA) / (zB - zA)) * bx[n];
          if (x < xCross) inside = !inside;
        }
      }
      const sdf = inside ? -Math.sqrt(d2) : Math.sqrt(d2);

      // ── bathymetry: saucer profile + lumps, never shallower than 1 mm ──
      let H = 0;
      if (sdf < 0) {
        const inward = -sdf;
        const saucer = Math.pow(Math.min(inward / 0.32, 1), 0.75);
        let lump = 0;
        for (const L of floorLumps) {
          const q = ((x - L.x) ** 2 + (z - L.z) ** 2) / (L.r * L.r);
          lump += L.h * Math.exp(-q);
        }
        H = Math.max(0.001, restDepth * saucer * (1 + lump));
      }
      const o = (j * nx + i) * 4;
      data[o] = H;
      data[o + 1] = sdf;
      data[o + 2] = sdf < 0 ? 1 : 0;
    }
  }
  return { outline, data, grid, halfX, halfZ };
}
