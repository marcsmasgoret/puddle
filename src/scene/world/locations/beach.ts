// Beach: a tide pool in the sand, dunes with marram grass to either side,
// and the open sea rolling in under a wide sky with a far headland.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, rng, reflective, tint } from '../props';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function grassTufts(spots: [number, number, number][], color: string) {
  const blades: THREE.BufferGeometry[] = [];
  const r = rng(77);
  for (const [x, z, s] of spots) {
    for (let b = 0; b < 9; b++) {
      const h = s * (0.5 + r() * 0.6);
      const blade = new THREE.ConeGeometry(0.012 * s, h, 3);
      blade.translate(0, h / 2, 0);
      blade.rotateZ((r() - 0.5) * 0.7);
      blade.rotateY(r() * Math.PI * 2);
      blade.translate(x + (r() - 0.5) * 0.25 * s, 0, z + (r() - 0.5) * 0.25 * s);
      blades.push(tint(blade, color));
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(blades), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  mesh.castShadow = true;
  return reflective(mesh);
}

const def: LocationDef = {
  id: 'beach',
  shape: () => ({ kind: 'blob', seed: 3, rx: 1.0, rz: 0.6, wobble: 1.2 }),
  ground: { style: 'sand', a: '#dcc8a0', b: '#cdb388', c: '#e8d8b4', bed: '#b79c74', bedAccent: '#a39478' },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const g = new THREE.Group();
    // the sea, starting ~9 m out; a calm swell
    const sea = openWater({ w: 3000, d: 1200 }, 0.012, season === 'winter' ? '#2d4a5a' : '#2f6f86', waters, { waves: 2.2 });
    sea.position.z = -9 - 600;
    g.add(sea);
    // wet, darker sand band where the swash runs up
    const swash = new THREE.Mesh(new THREE.PlaneGeometry(3000, 2.5), new THREE.MeshStandardMaterial({ color: '#b39a72', roughness: 0.35, transparent: true, opacity: 0.85 }));
    swash.rotation.x = -Math.PI / 2;
    swash.position.set(0, 0.006, -8.5);
    g.add(swash);
    // dunes framing the left and right
    const dune = new THREE.Color(season === 'winter' ? '#e7e9ec' : '#d6bf92');
    for (const side of [-1, 1]) {
      const d = ridge({ z: -7, width: 18, base: -1, hill: 2.6, color: dune, haze, mist: 0.1, seed: side > 0 ? 3 : 8 });
      d.position.x = side * 12;
      d.rotation.y = side * 0.5;
      g.add(d);
    }
    // a distant headland across the bay
    g.add(ridge({ z: -700, width: 2000, base: -10, hill: 60, color: hazed('#5d6f63', haze, 700, 500), haze, mist: 0.6, seed: 17, x: -500 }));
    const r = rng(5);
    const tufts: [number, number, number][] = [];
    for (let k = 0; k < 40; k++) {
      const side = k % 2 ? 1 : -1;
      tufts.push([side * (2.5 + r() * 6), -2 - r() * 6, 0.6 + r() * 0.6]);
    }
    const grassCol = season === 'autumn' ? '#c2a35c' : season === 'winter' ? '#b8ad8c' : '#8ea35a';
    g.add(grassTufts(tufts, grassCol));
    // a couple of driftwood logs
    const wood = new THREE.MeshStandardMaterial({ color: '#a39783', roughness: 0.9 });
    for (const [x, z, l, a] of [[1.9, -1.3, 1.4, 0.4], [-2.6, -2.2, 0.9, -0.8]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, l, 10), wood);
      log.rotation.set(0, a, Math.PI / 2);
      log.position.set(x, 0.05, z);
      log.castShadow = true;
      g.add(reflective(log));
    }
    return { group: g };
  },
};
export default def;
