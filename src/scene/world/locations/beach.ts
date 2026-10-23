// Prince Edward Island: a tide pool on the north shore's red sand, iron-rich
// and rust-coloured; dunes held together by marram grass and dune fencing;
// red sandstone cliffs capped with turf curving away to the right, a white
// lighthouse with a red lantern on the point (its beam sweeps the bay at
// night); the green-blue Gulf of St. Lawrence rolling in.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, rng, reflective } from '../props';
import { duneHeight, dunes, marram, duneFence, cliff, lighthouse } from './beachKit';

const def: LocationDef = {
  id: 'beach',
  shape: () => ({ kind: 'blob', seed: 3, rx: 1.0, rz: 0.6, wobble: 1.2 }),
  ground: { style: 'sand', a: '#b8603f', b: '#a65236', c: '#c97a56', bed: '#8e4a33', bedAccent: '#9a6a52' },
  water: (_x, z) => z < -9,
  critters: {
    mouse: { from: [-2.8, -3.1], to: [2.7, -2.8], hide: 'grass' },
    habitat: { birds: ['gulls', 'gulls', 'songbirds'], water: [-40, -12, 40, -70] },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const winter = season === 'winter';
    const g = new THREE.Group();
    // the Gulf, starting ~9 m out
    const sea = openWater({ w: 3000, d: 1200 }, 0.012, winter ? '#2d4a55' : '#2b6a70', waters, { waves: 2.0 });
    sea.position.z = -9 - 600;
    g.add(sea);
    // wet, darker red sand where the swash runs up
    const swash = new THREE.Mesh(new THREE.PlaneGeometry(3000, 2.5), new THREE.MeshStandardMaterial({ color: '#7c3b26', roughness: 0.3, transparent: true, opacity: 0.85 }));
    swash.rotation.x = -Math.PI / 2;
    swash.position.set(0, 0.006, -8.5);
    g.add(swash);
    // dunes to either side and behind the puddle's flanks
    // the shore curves away to the left: a line of dunes running off into
    // the distance along it, growing taller
    const h = duneHeight([
      [-6.5, -1.5, 1.0, 2.2, 1.4], [-9, -5.5, 2.0, 3, 2], [-13, -10.5, 2.8, 3.8, 2.8],
      [-18, -16, 3.4, 4.5, 3.4], [-24, -23, 4, 5.5, 4], [-31, -31, 4.5, 6, 5], [-39, -40, 5, 7, 6],
    ]);
    const sand = new THREE.Color(winter ? '#e4e3e6' : '#c47252');
    g.add(dunes(h, -52, -4, -52, 3, sand, 8));
    // marram grass on the dune crests and lee slopes
    const r = rng(5);
    const tufts: [number, number, number, number][] = [];
    for (let k = 0; k < 420; k++) {
      const x = -4.5 - r() * 42;
      const z = -48 + r() * 50;
      const y = h(x, z);
      if (y < 0.35 || r() > Math.min(1, y / 1.5)) continue;
      tufts.push([x, y - 0.03, z, 0.45 + r() * 0.35]);
    }
    const grassCol = season === 'autumn' ? '#b99a5a' : winter ? '#b3a98a' : '#8a9a52';
    g.add(marram(tufts, grassCol, 7));
    // dune fences leaning in the sand
    g.add(duneFence(-9.5, -2.5, -15, -8.5, h));
    // red sandstone cliffs curving away along the right of the bay
    const rock = winter ? '#9a5a48' : '#a8492e';
    // red sandstone cliffs running away on the right, rising toward the point
    const cliffAt = (z: number) => 10 + 0.42 * -z;
    for (let k = 0; k < 5; k++) {
      const za = -10 - k * 40, zb = za - 40;
      const height = 4 + k * 2;
      const c = cliff({ x: 0, z0: 20, z1: -20, height, rock, band: '#c9673f', grass: winter ? '#e8ecef' : '#6f8a3c', face: -1, seed: k });
      c.position.set((cliffAt(za) + cliffAt(zb)) / 2, 0, (za + zb) / 2);
      c.rotation.y = Math.atan(0.42);
      g.add(c);
    }
    // the lighthouse out on the point
    const lh = lighthouse(12, night);
    lh.group.position.set(cliffAt(-185) + 8, 12, -185);
    lh.group.scale.setScalar(1);
    g.add(lh.group);
    // the far shore: low farmland across the bay
    g.add(ridge({ z: -700, width: 2400, base: -6, hill: 30, color: hazed(winter ? '#c9d0d6' : '#5f7a4a', haze, 700, 500), haze, mist: 0.6, seed: 17, x: -400 }));
    // a couple of bleached driftwood logs
    const wood = new THREE.MeshStandardMaterial({ color: '#b2a897', roughness: 0.9 });
    for (const [x, z, l, a] of [[1.9, -1.3, 1.4, 0.4], [-2.6, -2.2, 0.9, -0.8]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, l, 10), wood);
      log.rotation.set(0, a, Math.PI / 2);
      log.position.set(x, 0.05, z);
      log.castShadow = true;
      g.add(reflective(log));
    }
    return { group: g, update: (t) => lh.update(t) };
  },
};
export default def;
