// Test tanks for the validation page: a flat-bottomed rectangular tank with
// vertical walls, filling the simulation grid except for a one-cell dry rim.
//
// The real puddle is a lumpy bowl; analytical results (wave speed, standing
// wave frequencies, decay rates, dam breaks) need a flat floor and straight
// walls, so these tests run the same solver in a simpler container.
import type { Grid } from '../physics/grid';
import { DOMAIN_X, DOMAIN_Z } from '../physics/grid';
import type { PuddleShape } from '../physics/puddleShape';

/**
 * A flat tank of rest depth H [m]. Wet cells are i = 1…nx−2 and
 * j = 1…nz−2, so the walls sit on the faces at i = 1 and i = nx−1. A wave
 * mode cos(mπx/L) with x measured from the left wall and L = (nx−2)·dx is
 * then an exact eigenmode of the discrete tank.
 */
export function flatTank(grid: Grid, H: number): PuddleShape {
  const { nx, nz, dx } = grid;
  const data = new Float32Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 4;
      const wet = i >= 1 && i <= nx - 2 && j >= 1 && j <= nz - 2;
      // distance to the nearest wall face (negative inside)
      const d = Math.min(i - 0.5, nx - 1.5 - i, j - 0.5, nz - 1.5 - j) * dx;
      data[k] = wet ? H : 0;
      data[k + 1] = -d;
      data[k + 2] = wet ? 1 : 0;
    }
  }
  const hx = DOMAIN_X / 2, hz = DOMAIN_Z / 2;
  return {
    outline: [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]],
    data,
    grid,
    halfX: hx,
    halfZ: hz,
  };
}

/** Length of the tank between its walls [m]. */
export const tankLength = (grid: Grid) => (grid.nx - 2) * grid.dx;

/** x of cell i's centre measured from the left wall [m]. */
export const cellX = (grid: Grid, i: number) => (i - 0.5) * grid.dx;

/**
 * A state texture (η, u, v, θ) with η(i,j) = f(x) for every wet cell and the
 * fluid at rest. Used to start standing waves, ridges and dam breaks.
 */
export function stateFromProfile(grid: Grid, f: (x: number) => number): Float32Array {
  const { nx, nz } = grid;
  const s = new Float32Array(nx * nz * 4);
  for (let j = 1; j < nz - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = (j * nx + i) * 4;
      s[k] = f(cellX(grid, i));
      s[k + 3] = 1;
    }
  }
  return s;
}
