// Forest: stone and moss floor, a clearing ringed by pines with a few
// broadleaf trees that change with the seasons, mossy boulders, and layered
// forested ridges fading into blue mountains.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, conifers, broadleaves, boulders, hazed, rng } from '../props';

const def: LocationDef = {
  id: 'forest',
  shape: () => ({ kind: 'blob', seed: 7 }),
  ground: { style: 'forest', a: '#6a5639', b: '#5f7336', c: '#7b5634', bed: '#7a6a52', bedAccent: '#8a877b' },
  critters: {
    mouse: { from: [-2.4, -2.3], to: [2.3, -2.7], hide: 'hole' },
    habitat: { birds: ['songbirds', 'crows', 'geese'], trees: [[-4, -6], [4.5, -7], [-6, -9.5], [6.5, -10]], rabbits: [-7, -9, 7, -3], deer: true, fox: true },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season } = ctx;
    const haze = mood.haze;
    const g = new THREE.Group();
    const mountain = new THREE.Color('#7c8ba3');
    const pine = season === 'winter' ? new THREE.Color('#3d4f48') : new THREE.Color('#2a4230');
    g.add(
      ridge({ z: -900, width: 4000, base: 20, hill: 200, color: hazed(mountain, haze, 900, 700), haze, mist: 0.55, seed: 5 }),
      ridge({ z: -520, width: 2600, base: 10, hill: 95, color: hazed(mountain, haze, 520, 500).multiplyScalar(0.92), haze, mist: 0.5, seed: 11 }),
    );
    [
      { z: -300, base: 4, hill: 38, treeH: 3, density: 0.6, pointy: false },
      { z: -190, base: 2, hill: 20, treeH: 2.5, density: 0.8, pointy: false },
      { z: -125, base: 0, hill: 8, treeH: 7, density: 0.9, pointy: true },
    ].forEach((rd, k) =>
      g.add(
        ridge({
          z: rd.z, width: Math.abs(rd.z) * 6, base: rd.base, hill: rd.hill, treeH: rd.treeH, treeDensity: rd.density, pointy: rd.pointy,
          color: hazed(pine, haze, -rd.z, 220), haze, mist: 0.6 - k * 0.12, seed: 21 + k * 7,
        }),
      ),
    );
    // the clearing: framing pines on both sides, the forest beyond with an
    // open view through the middle
    const r = rng(42);
    const pines: [number, number, number][] = [];
    for (const side of [-1, 1]) for (let t = 0; t < 7; t++) pines.push([side * (5 + r() * 6), -6 - r() * 10, 14 + r() * 7]);
    for (let t = 0; t < 220; t++) {
      const ang = (r() - 0.5) * Math.PI * 1.2;
      const dist = 22 + Math.pow(r(), 0.8) * 90;
      if (Math.abs(ang) < 0.32 && dist < 70) continue;
      pines.push([Math.sin(ang) * dist * 1.4, -Math.cos(ang) * dist, 9.5 + r() * 10]);
    }
    g.add(conifers(pines, season, 1));
    const leafy: [number, number, number][] = [];
    for (let t = 0; t < 14; t++) {
      const side = t % 2 ? 1 : -1;
      leafy.push([side * (3.5 + r() * 9), -4 - r() * 14, 6 + r() * 4]);
    }
    g.add(broadleaves(leafy, season, 3));
    const [hx, hz] = [ctx.halfX, ctx.halfZ];
    g.add(
      boulders(
        [
          [hx + 0.3, -hz * 0.35, 0.32, 1],
          [hx * 0.25, -hz - 0.5, 0.42, 3],
          [-hx * 0.7, -hz - 0.3, 0.16, 4],
          [hx + 2.2, -hz - 3.5, 1.1, 5],
          [-hx - 2.6, -hz - 2.4, 0.8, 6],
          [-hx - 0.05, hz * 0.3, 0.08, 9],
        ],
        ctx.sdfAt,
        { snow: season === 'winter' },
      ),
    );
    return { group: g };
  },
};
export default def;
