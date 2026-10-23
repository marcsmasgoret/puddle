// Low ground cover around the puddle: grass tufts, ferns, wildflowers and
// (in autumn) mushrooms, scattered with clumping noise, kept off the puddle
// and open water, thinned out by snow. Each kind is one instanced mesh, so
// thousands of plants cost a handful of draw calls. They sway with the wind.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, reflective, sway } from './props';
import type { Season } from './palettes';

function blade(h: number, w: number, lean: number, a: number) {
  const g = new THREE.BufferGeometry();
  // a tapering, curving blade in three segments
  const pts: number[] = [];
  const seg = 3;
  for (let k = 0; k < seg; k++) {
    const t0 = k / seg, t1 = (k + 1) / seg;
    const x0 = lean * t0 * t0 * h, x1 = lean * t1 * t1 * h;
    const w0 = w * (1 - t0), w1 = w * (1 - t1);
    pts.push(x0 - w0, t0 * h, 0, x0 + w0, t0 * h, 0, x1 + w1, t1 * h, 0, x0 - w0, t0 * h, 0, x1 + w1, t1 * h, 0, x1 - w1, t1 * h, 0);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.rotateY(a);
  g.computeVertexNormals();
  return g;
}

function colorize(g: THREE.BufferGeometry, base: THREE.Color, tipLight = 0.35) {
  const p = g.attributes.position as THREE.BufferAttribute;
  let maxY = 0;
  for (let k = 0; k < p.count; k++) maxY = Math.max(maxY, p.getY(k));
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    c.copy(base).multiplyScalar(0.6 + tipLight * 2 * (p.getY(k) / (maxY || 1)));
    c.toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function tuft(r: () => number, color: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [];
  // short, dense, splaying blades: a clump of turf rather than a weed
  const tall = r() < 0.15;
  for (let k = 0; k < 14; k++) parts.push(blade((tall ? 0.1 : 0.045) + r() * (tall ? 0.1 : 0.06), 0.005, (r() - 0.5) * 1.4, r() * Math.PI));
  return colorize(mergeGeometries(parts), color);
}

function fern(r: () => number, color: THREE.Color) {
  // fronds: arching midribs with leaflets along them
  const parts: THREE.BufferGeometry[] = [];
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2 + r() * 0.4;
    const len = 0.3 + r() * 0.15;
    for (let k = 0; k < 9; k++) {
      const t = k / 9;
      const x = t * len, y = Math.sin(t * Math.PI * 0.8) * len * 0.55;
      const leaf = new THREE.PlaneGeometry(0.06 * (1 - t * 0.7), 0.018);
      leaf.translate(0.03 * (1 - t * 0.7), 0, 0);
      for (const s of [-1, 1]) {
        const l = leaf.clone();
        l.rotateY(s * 1.3);
        l.rotateX(-0.4);
        l.translate(x, y, 0);
        l.rotateY(a);
        parts.push(l);
      }
    }
  }
  return colorize(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), color, 0.25);
}

function flower(r: () => number, petal: THREE.Color) {
  const stem = blade(0.16 + r() * 0.1, 0.003, 0.1, 0);
  colorize(stem, new THREE.Color('#4c7a32'));
  const sp = stem.attributes.position as THREE.BufferAttribute;
  let h = 0;
  for (let k = 0; k < sp.count; k++) h = Math.max(h, sp.getY(k));
  const head = new THREE.IcosahedronGeometry(0.014, 0);
  head.scale(1, 0.5, 1);
  head.translate(0.01, h, 0);
  const hc = new Float32Array(head.attributes.position.count * 3);
  for (let k = 0; k < head.attributes.position.count; k++) petal.toArray(hc, k * 3);
  head.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  head.deleteAttribute('uv');
  return mergeGeometries([stem, head.index ? head.toNonIndexed() : head]);
}

function mushroom(r: () => number) {
  const stalk = new THREE.CylinderGeometry(0.008, 0.01, 0.05, 6);
  stalk.translate(0, 0.025, 0);
  const cap = new THREE.SphereGeometry(0.025 + r() * 0.015, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.6, 1);
  cap.translate(0, 0.048, 0);
  const tint = (g: THREE.BufferGeometry, c: string) => {
    const a = new Float32Array(g.attributes.position.count * 3);
    const cc = new THREE.Color(c);
    for (let k = 0; k < g.attributes.position.count; k++) cc.toArray(a, k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  };
  return mergeGeometries([tint(stalk, '#e7dccb'), tint(cap, r() < 0.5 ? '#9a5a32' : '#b98a5a')]);
}

function swayed(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uSwayT = sway.time;
    s.uniforms.uSwayK = sway.strength;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSwayT, uSwayK;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 ip = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float k = transformed.y * transformed.y * 40.0;
      transformed.x += uSwayK * k * sin(uSwayT * 2.0 + ip.x * 1.3 + ip.z * 0.7);
      transformed.z += uSwayK * k * 0.6 * sin(uSwayT * 1.7 + ip.x * 0.4 + ip.z * 1.1);`,
    );
  };
  m.customProgramCacheKey = () => 'cover';
  return m;
}

export interface CoverSpec {
  /** area to fill: x0, z0, x1, z1 */
  area: [number, number, number, number];
  grass?: number;
  ferns?: number;
  flowers?: number;
  mushrooms?: number;
  /** grass colour by season */
  grassColor?: string;
}

/**
 * Scatter ground cover. `free(x, z)` says where plants may grow (off the
 * puddle, off water, off paths).
 */
export function groundCover(spec: CoverSpec, season: Season, free: (x: number, z: number) => boolean, seed = 1, near?: (x: number, z: number) => number) {
  const r = rng(seed);
  const group = new THREE.Group();
  const winter = season === 'winter';
  const thin = winter ? 0.15 : 1;
  const grassBase = new THREE.Color(
    spec.grassColor ?? (season === 'autumn' ? '#8b8a45' : season === 'spring' ? '#6f9a3c' : winter ? '#8d8a70' : '#5d8635'),
  );
  const [x0, z0, x1, z1] = spec.area;
  // clumping: plants gather where a slow noise is high
  const clump = (x: number, z: number) => 0.5 + 0.5 * Math.sin(x * 1.3 + Math.sin(z * 0.9) * 2) * Math.sin(z * 1.7 + x * 0.3);
  const place = (n: number, make: () => THREE.BufferGeometry, scale: [number, number], variants = 3) => {
    if (n <= 0) return;
    const mat = swayed(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
    const geos = Array.from({ length: variants }, make);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let v = 0; v < variants; v++) {
      const spots: THREE.Matrix4[] = [];
      for (let k = 0; k < (n * 3) / variants && spots.length < n / variants; k++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (!free(x, z)) continue;
        // lusher along the puddle's damp edge
        const lush = near ? 1 + 2.5 * Math.exp(-Math.max(near(x, z), 0) / 0.5) : 1;
        if (r() > clump(x, z) * lush * 0.6) continue;
        const s = scale[0] + r() * (scale[1] - scale[0]);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
        spots.push(m4.clone().compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)));
      }
      if (!spots.length) continue;
      const inst = new THREE.InstancedMesh(geos[v], mat, spots.length);
      spots.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      group.add(reflective(inst));
    }
  };
  place(Math.round((spec.grass ?? 0) * thin), () => tuft(r, grassBase), [0.7, 1.4]);
  place(winter ? 0 : spec.ferns ?? 0, () => fern(r, new THREE.Color(season === 'autumn' ? '#9a7a3a' : '#4f7a35')), [0.7, 1.3]);
  if (season === 'spring' || season === 'summer') {
    const petals = season === 'spring' ? ['#f2f0e8', '#f4d64a', '#c9a6e0'] : ['#f6f2e6', '#f0c03a', '#e07a9a', '#8fa6e8'];
    place(spec.flowers ?? 0, () => flower(r, new THREE.Color(petals[Math.floor(r() * petals.length)])), [0.8, 1.2], 4);
  }
  if (season === 'autumn') place(spec.mushrooms ?? 0, () => mushroom(r), [0.8, 1.4]);
  return group;
}
