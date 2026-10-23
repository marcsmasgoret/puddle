// A Mediterranean beach: pale golden sand, water going from clear turquoise
// over the sand to deep blue, striped umbrellas and white loungers in rows,
// a whitewashed village climbing the headland on the left with a blue dome
// or two, umbrella pines and cypresses, and a sailboat out in the bay.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, rng, nightLights, boulders } from '../props';
import { umbrella, lounger, village, stonePine, cypress, sailboat, duneHeight, dunes } from './beachKit';

const def: LocationDef = {
  id: 'europe',
  shape: () => ({ kind: 'blob', seed: 21, rx: 1.0, rz: 0.58, wobble: 1.0 }),
  ground: { style: 'sand', a: '#e6d2a8', b: '#d9c193', c: '#efe0bf', bed: '#c8b089', bedAccent: '#b8a58a' },
  water: (_x, z) => z < -10,
  critters: {
    mouse: { from: [-2.9, -3.0], to: [2.6, -3.3], hide: 'gap' },
    habitat: { birds: ['gulls', 'songbirds'], water: [-40, -14, 40, -70] },
  },
  freezes: () => false,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const winter = season === 'winter';
    const g = new THREE.Group();
    const r = rng(12);
    // deep blue sea, and a clear turquoise shallow band over the sand
    const sea = openWater({ w: 3000, d: 1200 }, 0.012, winter ? '#24506a' : '#1a86a6', waters, { waves: 0.8 });
    sea.position.z = -10 - 600;
    g.add(sea);
    const shallow = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 14),
      new THREE.MeshBasicMaterial({ color: '#46d6cc', transparent: true, opacity: winter ? 0.3 : 0.6, depthWrite: false }),
    );
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.set(0, 0.016, -17);
    g.add(shallow);
    const swash = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1.8), new THREE.MeshStandardMaterial({ color: '#c7ad80', roughness: 0.3, transparent: true, opacity: 0.8 }));
    swash.rotation.x = -Math.PI / 2;
    swash.position.set(0, 0.006, -9.6);
    g.add(swash);
    // umbrellas and loungers in loose rows (summer and the shoulder seasons;
    // in winter the beach is empty)
    if (!winter) {
      const pairs: [string, string][] = [['#e94b3c', '#f6f1e6'], ['#2a7fc1', '#f6f1e6'], ['#f2b632', '#f6f1e6'], ['#2f9e8f', '#f6f1e6']];
      let k = 0;
      for (const zRow of [-5.5, -2.5, 0.5]) {
        for (let x = -19; x <= 19; x += 4.2) {
          if (Math.abs(x) < 4 && zRow > -4) continue; // keep the puddle clear
          if (season !== 'summer' && r() < 0.5) continue;
          const u = umbrella(pairs[k++ % pairs.length], k);
          u.position.set(x + (r() - 0.5), 0, zRow + (r() - 0.5) * 0.6);
          g.add(u);
          for (const s of [-1, 1]) {
            if (r() < 0.3) continue;
            const l = lounger(['#f08a7a', '#7cc0e0', '#f4d36b', '#ffffff'][Math.floor(r() * 4)]);
            l.position.set(u.position.x + s * 0.8, 0, u.position.z + 0.6);
            l.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.2;
            g.add(l);
          }
        }
      }
    }
    // the headland on the left: a real hill, the village climbing it
    const hh = duneHeight([[-75, -125, 34, 45, 35], [-40, -100, 14, 25, 20], [-110, -95, 22, 30, 25]]);
    g.add(dunes(hh, -190, -12, -200, -60, new THREE.Color(winter ? '#9c9b8c' : '#a89a72'), 41));
    g.add(village({ x: -70, z: -95, width: 70, depth: 30, hill: (x) => hh(x, -105), count: 70, seed: 3, night }));
    if (night > 0) {
      const pts: number[] = [];
      for (let k2 = 0; k2 < 180; k2++) {
        const x = -70 + (r() - 0.5) * 70;
        const z = -95 - r() * 30;
        pts.push(x, hh(x, z) + 1 + r() * 4, z + 3, 1, 0.6 + r() * 0.6);
      }
      g.add(nightLights(pts, night, { size: 2.6 }));
    }
    // pines and cypresses on the headland and behind the beach
    for (let k2 = 0; k2 < 9; k2++) {
      const p = stonePine(10 + r() * 6, k2);
      const x = -30 - r() * 60, z = -75 - r() * 40;
      p.position.set(x, hh(x, z) - 0.5, z);
      g.add(p);
    }
    for (let k2 = 0; k2 < 7; k2++) {
      const p = stonePine(11 + r() * 5, 20 + k2);
      p.position.set((r() < 0.5 ? -1 : 1) * (22 + r() * 14), 0, 4 + r() * 12);
      g.add(p);
    }
    for (let k2 = 0; k2 < 8; k2++) {
      const c = cypress(9 + r() * 5);
      const x = -80 + r() * 50, z = -105 - r() * 15;
      c.position.set(x, hh(x, z) - 0.5, z);
      g.add(c);
    }
    // the rocky point on the right
    g.add(ridge({ z: -120, width: 300, base: -2, hill: 22, color: hazed('#8c8270', haze, 150, 500), haze, mist: 0.3, seed: 9, x: 190 }));
    g.add(boulders([[11, -8.5, 0.6, 2], [13.5, -9.5, 0.9, 5], [16, -9, 0.5, 7], [2.2, -3.6, 0.2, 9], [3.0, -3.5, 0.24, 11]], ctx.sdfAt, { stone: '#b9ad97', moss: '#8a8a60', mossAmount: 0.1 }));
    // islands on the horizon and a sailboat
    g.add(ridge({ z: -900, width: 3000, base: -8, hill: 40, color: hazed('#7d8a9a', haze, 900, 600), haze, mist: 0.7, seed: 33, x: 300 }));
    const boat = sailboat(1);
    boat.position.set(40, 0, -320);
    g.add(boat);
    return {
      group: g,
      update(t) {
        boat.position.x = 40 + Math.sin(t * 0.01) * 30;
        boat.rotation.z = Math.sin(t * 0.7) * 0.04;
      },
    };
  },
};
export default def;
