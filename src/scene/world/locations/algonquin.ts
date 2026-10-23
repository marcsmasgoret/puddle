// Algonquin: canoe camping on the Canadian Shield. A rain-filled pool in a
// pink granite outcrop, a red canoe pulled up on the rock, a tent, a
// campfire that glows at night, windswept white pines, and a still lake
// with a far shore of spruce and pine.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, conifers, rng, reflective, tint } from '../props';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A canoe: a lathe-like hull narrowing and rising to both ends. */
function canoe(color: string) {
  const L = 4.9, W = 0.9, D = 0.34;
  const segs = 40, ring = 14;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = (u - 0.5) * L;
    const width = W * Math.pow(Math.sin(Math.PI * u), 0.65) * 0.5;
    const sheer = D + 0.18 * Math.pow(2 * u - 1, 4); // ends rise
    for (let j = 0; j <= ring; j++) {
      const a = Math.PI * (j / ring); // half circle: the hull below the gunwale
      pos.push(x, sheer - Math.sin(a) * D * Math.pow(Math.sin(Math.PI * u), 0.4), Math.cos(a) * width);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < ring; j++) {
      const a = i * (ring + 1) + j, b = a + ring + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const hull = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.45, side: THREE.DoubleSide }));
  const thwart = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, W * 0.95), new THREE.MeshStandardMaterial({ color: '#b98b55' }));
  thwart.position.set(0, D, 0);
  const grp = new THREE.Group();
  grp.add(hull, thwart);
  return grp;
}

/** Windswept white pine: tiers of flat sprays swept to one side. */
function whitePine(seed: number, snow: boolean) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.12, 0.28, 11, 7);
  trunk.translate(0, 5.5, 0);
  parts.push(tint(trunk, '#4d3a2b'));
  for (let k = 0; k < 6; k++) {
    const y = 4 + k * 1.4;
    const len = 3.2 - k * 0.35 + r() * 0.8;
    const spray = new THREE.SphereGeometry(1, 10, 6);
    spray.scale(len, 0.38, 0.9);
    spray.translate(len * 0.65, y, (r() - 0.5) * 0.6);
    parts.push(tint(spray, snow && k % 2 ? '#dfe6ea' : '#2f4a33'));
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  m.castShadow = true;
  return reflective(m);
}

const def: LocationDef = {
  id: 'algonquin',
  shape: () => ({ kind: 'blob', seed: 21, rx: 0.95, rz: 0.6, wobble: 1.3 }),
  ground: { style: 'granite', a: '#a99088', b: '#8e8682', c: '#a3a77c', bed: '#6d6158', bedAccent: '#9a8a7d' },
  water: (_x, z) => z < -6.5,
  critters: {
    // out from under the canoe, across the rock to a crevice
    mouse: { from: [1.9, -2.1], to: [-0.4, -4.1], hide: 'hole' },
    habitat: {
      birds: ['songbirds', 'geese', 'ducks'],
      trees: [[-6.5, -5.5], [7.5, -7], [-9.5, -8], [10, -10]],
      deer: true,
      fox: true,
      water: [-40, -9, 40, -90],
      frogs: true,
      loons: true,
    },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const g = new THREE.Group();
    const lake = openWater({ w: 3000, d: 1300 }, 0.012, season === 'winter' ? '#3c4b54' : '#1f3a40', waters, { waves: 0.5, ice: season === 'winter' });
    lake.position.z = -6.5 - 650;
    g.add(lake);
    // far shores: layered spruce and pine
    const pine = season === 'winter' ? '#3f514a' : '#243b2c';
    g.add(ridge({ z: -160, width: 1400, base: -1, hill: 10, treeH: 12, treeDensity: 1.4, pointy: true, color: hazed(pine, haze, 160, 260), haze, mist: 0.35, seed: 41 }));
    g.add(ridge({ z: -420, width: 2600, base: 0, hill: 40, treeH: 5, treeDensity: 0.5, color: hazed(pine, haze, 420, 420), haze, mist: 0.5, seed: 43 }));
    // the canoe pulled up on the rock to the right, the tent behind
    const c = canoe('#c4372b');
    c.position.set(2.6, 0.02, -2.4);
    c.rotation.y = 0.5;
    c.rotation.z = 0.06;
    c.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(reflective(c));
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.5, 4, 1), new THREE.MeshStandardMaterial({ color: season === 'winter' ? '#e8a23a' : '#e07b2e', roughness: 0.8 }));
    tent.position.set(-3.6, 0.75, -4.5);
    tent.rotation.y = Math.PI / 4 + 0.3;
    tent.scale.set(1.3, 1, 1);
    tent.castShadow = true;
    g.add(reflective(tent));
    // campfire: a ring of stones, logs and a flickering flame + light
    const fire = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({ color: '#7d756e', roughness: 0.9 });
    for (let k = 0; k < 9; k++) {
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6), ringMat);
      const a = (k / 9) * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42);
      st.scale.set(1, 0.7, 1);
      fire.add(st);
    }
    const logMat = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.9 });
    for (let k = 0; k < 3; k++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 7), logMat);
      log.rotation.set(Math.PI / 2 - 0.5, (k / 3) * Math.PI * 2, 0);
      log.position.y = 0.12;
      fire.add(log);
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3.5), transparent: true, opacity: 0.9 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8), flameMat);
    flame.position.y = 0.3;
    const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(4) }));
    flame2.position.y = 0.25;
    fire.add(flame, flame2);
    const firelight = new THREE.PointLight('#ff9a4a', 4 + night * 22, 9, 1.6);
    firelight.position.y = 0.5;
    fire.add(firelight);
    fire.position.set(-1.9, 0, -3.0);
    g.add(reflective(fire));
    // windswept white pines on the point, and spruce along the shore
    const wp = whitePine(5, season === 'winter');
    wp.position.set(-6.5, 0, -5.5);
    const wp2 = whitePine(9, season === 'winter');
    wp2.position.set(7.5, 0, -7);
    wp2.scale.setScalar(0.85);
    g.add(wp, wp2);
    const r = rng(3);
    const spruce: [number, number, number][] = [];
    for (let k = 0; k < 16; k++) spruce.push([(k % 2 ? 1 : -1) * (9 + r() * 12), -6 - r() * 10, 9 + r() * 7]);
    g.add(conifers(spruce, season, 15));
    const update = (t: number) => {
      const f = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
      flame.scale.set(1, f, 1);
      flame2.scale.set(1, 2 - f, 1);
      firelight.intensity = (4 + night * 22) * f;
    };
    return { group: g, update };
  },
};
export default def;
