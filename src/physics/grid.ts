// ─────────────────────────────────────────────────────────────────────────────
// Simulation grid
//
// The puddle sits inside a rectangular domain of DOMAIN_X × DOMAIN_Z metres,
// centred on the world origin, on the y = 0 plane (y is up). The domain is
// split into Nx × Nz square cells of side dx.
//
// Variables live on a *staggered* (Arakawa C / "MAC") grid:
//
//            v(i, j+½)
//          ┌─────●─────┐
//          │           │
//  u(i-½,j)●    η(i,j) ●u(i+½, j)
//          │           │
//          └─────●─────┘
//            v(i, j-½)
//
//   η  (surface height) at cell centres
//   u  (x-velocity) on the left/right faces
//   v  (z-velocity) on the near/far faces
//
// Staggering means every difference used in the equations is a compact
// two-point difference across a cell, which avoids the "checkerboard" noise a
// collocated grid suffers from and conserves volume exactly.
//
// Storage: one RGBA float texel per cell holds
//   R = η(i,j)   G = u(i-½,j)   B = v(i,j-½)   A = outflow limiter θ (see swe/shaders.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Domain extent along x and z [m]. The puddle fits inside with a margin. */
export const DOMAIN_X = 2.3;
export const DOMAIN_Z = 1.65;

export interface Grid {
  nx: number;
  nz: number;
  /** cell size [m] */
  dx: number;
}

/**
 * Grid resolution is chosen per device: ~512 cells across on desktop, ~256 on
 * phones (cost scales with cells × substeps, and substeps grow as dx shrinks,
 * so halving resolution makes the sim roughly 8× cheaper).
 */
export function makeGrid(cellsAcross: number): Grid {
  const dx = DOMAIN_X / cellsAcross;
  return { nx: cellsAcross, nz: Math.round(DOMAIN_Z / dx), dx };
}

export function pickResolution(): number {
  const q = new URLSearchParams(location.search).get('grid');
  if (q) return Math.max(64, Math.min(1024, parseInt(q, 10) || 512));
  const touch = navigator.maxTouchPoints > 0;
  const small = Math.min(screen.width, screen.height) < 900;
  return touch && small ? 256 : 512;
}
