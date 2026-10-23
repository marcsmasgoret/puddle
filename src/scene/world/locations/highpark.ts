// High Park, Toronto: a puddle on the lawn above Grenadier Pond, with oaks
// and willows along the shore and the downtown skyline in the distance,
// CN Tower and all. Heights are the real ones, scaled by distance.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, broadleaves, conifers, rng, reflective, cnTower, nightLights, windowLights } from '../props';


const def: LocationDef = {
  id: 'highpark',
  shape: () => ({ kind: 'blob', seed: 9, rx: 1.0, rz: 0.62 }),
  ground: { style: 'park', a: '#5e7f3b', b: '#6f9247', c: '#8a6f4a', bed: '#6d5a43', bedAccent: '#7c776c' },
  water: (_x, z) => z < -18 && z > -143,
  critters: {
    mouse: { from: [-2.8, -2.9], to: [2.6, -3.4], hide: 'hole' },
    habitat: {
      birds: ['songbirds', 'geese', 'ducks', 'crows'],
      trees: [[-6.5, -7], [7.5, -9], [-12, -14], [13, -6]],
      rabbits: [-7, -14, 7, -3],
      fox: true,
      water: [-80, -22, 80, -70],
      frogs: true,
    },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const g = new THREE.Group();
    // Grenadier Pond below the slope
    // Grenadier Pond: from ~18 m out to its far bank ~140 m away
    const pond = openWater({ w: 600, d: 125 }, 0.015, season === 'winter' ? '#3a4a52' : '#30483c', waters, { waves: 0.6, ice: season === 'winter' });
    pond.position.z = -18 - 62.5;
    g.add(pond);
    // the far bank: trees, then the city beyond
    const r = rng(19);
    const bank: [number, number, number][] = [];
    for (let k = 0; k < 40; k++) bank.push([(r() - 0.5) * 260, -150 - r() * 30, 14 + r() * 8]);
    g.add(broadleaves(bank, season, 7));
    // near trees framing the view: oaks and a willow-ish one
    g.add(broadleaves([[-6.5, -7, 9], [7.5, -9, 10], [-12, -14, 11], [13, -6, 8.5]], season, 13));
    g.add(conifers([[-16, -18, 13], [17, -20, 12]], season, 9));
    // downtown Toronto ~7 km away: real heights, so they read small
    const skyCol = hazed('#6b7686', haze, 6500, 9000).lerp(new THREE.Color('#1a2133'), night * 0.7);
    const mat = new THREE.MeshBasicMaterial({ color: skyCol, fog: false });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a4a').multiplyScalar(0.2 + night * 0.9), fog: false });
    const city = new THREE.Group();
    const towers: [number, number, number][] = [
      // [x offset (m), height (m), width (m)]: First Canadian Place, Scotia
      // Plaza, the TD towers, Commerce Court, Aura, and the cluster around them
      [140, 298, 50], [200, 275, 45], [90, 223, 40], [250, 239, 40], [-60, 272, 35], [310, 200, 45],
      [30, 180, 40], [-130, 160, 40], [400, 150, 50], [-220, 140, 45], [480, 120, 45], [-300, 110, 50],
    ];
    for (const [x, h, w] of towers) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      b.position.set(x, h / 2, 0);
      city.add(b);
    }
    // at night: lit office floors on the towers' faces, and the waterfront
    if (night > 0) {
      const rects = towers.map(([x, h, w]) => [x - w / 2, x + w / 2, 0, h, w / 2 + 1] as [number, number, number, number, number]);
      for (let x = -700; x < 900; x += 70) rects.push([x, x + 60, 0, 25 + ((x * 7919) % 40 + 40) % 40, 60]);
      city.add(nightLights(windowLights(rects, 9, 0.35, 3), night, { size: 1.6, gain: 0.9 }));
    }
    const cn = cnTower(mat, glow, night);
    cn.position.set(-10, 0, 40);
    city.add(cn);
    // ~6.5 km away: drawn at 900 m and scaled by 900/6500, which subtends
    // exactly the same angle (and stays inside the camera's far plane)
    const s = 900 / 6500;
    city.scale.setScalar(s);
    city.position.set(60 * s, -60 * s, -900);
    g.add(reflective(city));
    // the lake-shore ridge under the city
    g.add(ridge({ z: -1000, width: 6000, base: -5, hill: 25, treeH: 10, treeDensity: 0.4, color: hazed('#3d5240', haze, 1200, 900), haze, mist: 0.6, seed: 31 }));
    return { group: g };
  },
};
export default def;
