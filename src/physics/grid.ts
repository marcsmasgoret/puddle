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

/**
 * Puddle size (the size control in the settings): the whole simulation
 * domain, the puddle and its depth scale together. Chosen at load time
 * (the simulation's textures are built for it), from ?size= or the saved
 * setting.
 */
export const SIZES = { small: 0.8, normal: 1, large: 1.3, huge: 1.6 } as const;
export type PuddleSize = keyof typeof SIZES;
function readSize(): number {
  // the validation tests always run at the standard size
  if (location.pathname.endsWith('validate.html')) return 1;
  try {
    const q = new URLSearchParams(location.search).get('size') as PuddleSize | null;
    if (q && q in SIZES) return SIZES[q];
    const s = JSON.parse(localStorage.getItem('puddle.settings.v1') ?? '{}').size as PuddleSize | undefined;
    if (s && s in SIZES) return SIZES[s];
  } catch {
    /* no storage */
  }
  return 1;
}
export const SIZE_SCALE = typeof location === 'undefined' ? 1 : readSize();

/** Domain extent along x and z [m]. The puddle fits inside with a margin. */
export const DOMAIN_X = 2.3 * SIZE_SCALE;
export const DOMAIN_Z = 1.65 * SIZE_SCALE;

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

/** localStorage key: set when this device was too slow for the full grid */
export const GRID_HINT_KEY = 'puddle.grid';

export function pickResolution(): number {
  const q = new URLSearchParams(location.search).get('grid');
  if (q) return Math.max(64, Math.min(1024, parseInt(q, 10) || 512));
  try {
    const hint = localStorage.getItem(GRID_HINT_KEY);
    if (hint) return Math.max(64, Math.min(1024, parseInt(hint, 10) || 512));
  } catch {
    /* storage blocked */
  }
  const touch = navigator.maxTouchPoints > 0;
  const small = Math.min(screen.width, screen.height) < 900;
  return touch && small ? 256 : 512;
}
