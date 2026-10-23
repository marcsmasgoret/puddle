// Pieces for the two beaches: sculpted dunes with marram grass, sandstone
// cliffs, a lighthouse, beach umbrellas and loungers, a whitewashed
// village, umbrella pines and cypresses, and a sailboat out at sea.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, reflective, tint } from '../props';

/** a dune field: smooth mounds as a height field, h(x, z) [m] */
export function duneHeight(mounds: [number, number, number, number, number][]) {
  // each mound: x, z, height, length (along x), depth (along z)
  return (x: number, z: number) => {
    let h = 0;
    for (const [mx, mz, mh, lx, lz] of mounds) h = Math.max(h, mh * Math.exp(-(((x - mx) / lx) ** 2) - ((z - mz) / lz) ** 2));
    return h;
  };
}

export function dunes(h: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, sand: THREE.Color, seed: number) {
  const nx = Math.ceil((x1 - x0) / 0.35), nz = Math.ceil((z1 - z0) / 0.35);
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const r = rng(seed);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k);
    // wind ripples on the slopes
    const y = h(x, z) + 0.015 * Math.sin(x * 9 + z * 3) * Math.min(1, h(x, z));
    p.setY(k, y - 0.02);
    c.copy(sand).multiplyScalar(0.92 + 0.12 * r() + 0.08 * Math.min(1, y / 2));
    c.toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true;
  m.castShadow = true;
  return reflective(m);
}

/** Marram grass: tall thin blades in clumps, bending in the wind. */
export function marram(spots: [number, number, number, number][], color: string, seed: number) {
  const blades: THREE.BufferGeometry[] = [];
  const r = rng(seed);
  const base = new THREE.Color(color);
  for (const [x, y, z, s] of spots) {
    const n = 10 + Math.floor(r() * 8);
    for (let b = 0; b < n; b++) {
      const h = s * (0.45 + r() * 0.55);
      const blade = new THREE.ConeGeometry(0.006 * s + 0.004, h, 3, 3);
      blade.translate(0, h / 2, 0);
      // arching blades: bend progressively with height
      const pos = blade.attributes.position as THREE.BufferAttribute;
      const lean = (r() - 0.5) * 0.9;
      for (let k = 0; k < pos.count; k++) {
        const t = pos.getY(k) / h;
        pos.setX(k, pos.getX(k) + lean * t * t * h * 0.5);
      }
      blade.rotateY(r() * Math.PI * 2);
      blade.translate(x + (r() - 0.5) * 0.3 * s, y, z + (r() - 0.5) * 0.3 * s);
      const c = base.clone().multiplyScalar(0.8 + 0.4 * r());
      blades.push(tint(blade, '#' + c.getHexString()));
    }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(mergeGeometries(blades), mat);
  mesh.castShadow = true;
  return reflective(mesh);
}

/** A row of weathered dune-fence posts with slats. */
export function duneFence(x0: number, z0: number, x1: number, z1: number, h: (x: number, z: number) => number) {
  const wood = new THREE.MeshStandardMaterial({ color: '#9a8a74', roughness: 0.95 });
  const g = new THREE.Group();
  const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.12);
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n;
    const tall = 0.75 + 0.15 * Math.sin(k * 7.1);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, tall, 0.012), wood);
    s.position.set(x, h(x, z) + tall / 2 - 0.1, z);
    s.rotation.set((Math.sin(k * 3.3) * 0.08), Math.atan2(-(z1 - z0), x1 - x0), Math.sin(k * 5.7) * 0.06);
    s.castShadow = true;
    g.add(s);
  }
  return reflective(g);
}

/**
 * Sandstone cliffs: a wall of horizontal strata (red on PEI), weathered into
 * buttresses, with a cap of grass along the top. Runs along z at x.
 */
export function cliff(o: { x: number; z0: number; z1: number; height: number; rock: string; band: string; grass: string; face: -1 | 1; seed: number }) {
  const len = Math.abs(o.z1 - o.z0);
  const nz = Math.ceil(len / 0.6), ny = Math.ceil(o.height / 0.5);
  const g = new THREE.PlaneGeometry(len, o.height, nz, ny);
  g.translate(0, o.height / 2, 0);
  g.rotateY(o.face > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(o.x, 0, (o.z0 + o.z1) / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const rock = new THREE.Color(o.rock), band = new THREE.Color(o.band), grass = new THREE.Color(o.grass);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const y = p.getY(k), z = p.getZ(k);
    // buttresses and gullies, and the face leaning back a little
    const out = 1.2 * Math.sin(z * 0.35) + 0.6 * Math.sin(z * 1.1 + 2) + 0.25 * Math.sin(z * 3.7);
    const lean = (y / o.height) * o.height * 0.18;
    p.setX(k, p.getX(k) + o.face * (out - lean));
    // strata: alternating bands, a little wavy
    const strata = 0.5 + 0.5 * Math.sin(y * 3.1 + Math.sin(z * 0.2) * 0.8);
    c.copy(rock).lerp(band, strata * 0.6);
    if (y > o.height - 0.5) c.copy(grass); // the turf cap
    c.toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  // the grassy land on top
  const top = new THREE.Mesh(new THREE.PlaneGeometry(400, len), new THREE.MeshStandardMaterial({ color: o.grass, roughness: 1 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(o.x + o.face * 200, o.height - 0.05, (o.z0 + o.z1) / 2);
  const g2 = new THREE.Group();
  g2.add(m, top);
  return reflective(g2);
}

/**
 * A Maritime lighthouse: white tapering wooden tower, red lantern room and
 * gallery. At night the lamp glows and its beam sweeps around.
 */
export function lighthouse(height: number, night: number) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: '#b3231c', roughness: 0.6 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.12, height * 0.2, height, 4), white);
  tower.rotation.y = Math.PI / 4;
  tower.position.y = height / 2;
  const gallery = new THREE.Mesh(new THREE.BoxGeometry(height * 0.34, height * 0.04, height * 0.34), red);
  gallery.position.y = height + height * 0.02;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.09, height * 0.09, height * 0.16, 8), new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: new THREE.Color('#ffe2a0'), emissiveIntensity: 0.3 + night * 6 }));
  lantern.position.y = height * 1.12;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(height * 0.13, height * 0.12, 8), red);
  cap.position.y = height * 1.26;
  for (const o of [tower, gallery, cap]) o.castShadow = true;
  g.add(tower, gallery, lantern, cap);
  let beam: THREE.Mesh | null = null;
  if (night > 0) {
    const geo = new THREE.ConeGeometry(height * 0.6, height * 9, 24, 1, true);
    geo.translate(0, -height * 4.5, 0);
    geo.rotateZ(Math.PI / 2);
    beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6b0').multiplyScalar(0.25 * night), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.position.y = height * 1.12;
    g.add(beam);
  }
  return {
    group: reflective(g),
    /** the beam goes round every ~10 s */
    update(t: number) {
      if (beam) beam.rotation.y = t * 0.6;
    },
  };
}

/** A beach umbrella: striped canopy (two colours), pole tilted a little. */
export function umbrella(colors: [string, string], seed: number) {
  const r = rng(seed);
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.5 }));
  pole.position.y = 1.1;
  const canopy = new THREE.ConeGeometry(1.0, 0.38, 16, 1, true);
  const pos = canopy.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(colors[0]), b = new THREE.Color(colors[1]);
  for (let k = 0; k < pos.count; k++) {
    const ang = Math.atan2(pos.getZ(k), pos.getX(k));
    (Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 2 ? a : b).toArray(col, k * 3);
  }
  canopy.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const cm = new THREE.Mesh(canopy.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }));
  cm.position.y = 2.15;
  g.add(pole, cm);
  g.rotation.set((r() - 0.5) * 0.12, r() * 6, (r() - 0.5) * 0.12);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return reflective(g);
}

/** A white sun lounger with a towel. */
export function lounger(towel: string) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#d9d5cc', roughness: 0.6 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.62), frame);
  bed.position.y = 0.32;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), frame);
  back.position.set(-0.8, 0.52, 0);
  back.rotation.z = -0.65;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.012, 0.5), new THREE.MeshStandardMaterial({ color: towel, roughness: 0.95 }));
  cloth.position.set(0.25, 0.352, 0);
  g.add(bed, back, cloth);
  for (const x of [-0.85, 0.85]) for (const z of [-0.27, 0.27]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), frame);
    leg.position.set(x, 0.16, z);
    g.add(leg);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return reflective(g);
}

/** A whitewashed hillside village: cubic houses, blue doors, a few domes. */
export function village(o: { x: number; z: number; width: number; depth: number; hill: (x: number) => number; count: number; seed: number; night: number }) {
  const r = rng(o.seed);
  const white = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2a5fa8', roughness: 0.6 });
  const ochre = new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.9 });
  const boxes: THREE.Mesh[] = [];
  const g = new THREE.Group();
  for (let k = 0; k < o.count; k++) {
    const x = o.x + (r() - 0.5) * o.width;
    const z = o.z - r() * o.depth;
    const w = 4 + r() * 6, d = 4 + r() * 5, h = 3 + r() * 4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), r() < 0.82 ? white : ochre);
    m.position.set(x, o.hill(x) + h / 2 - 0.5, z);
    m.rotation.y = (r() - 0.5) * 0.3;
    boxes.push(m);
    g.add(m);
    if (r() < 0.12) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), blue);
      dome.position.set(x, o.hill(x) + h - 0.5, z);
      g.add(dome);
    }
  }
  return reflective(g);
}

/** Mediterranean stone pine: a tall bare trunk and a flat umbrella crown. */
export function stonePine(h: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(h * 0.025, h * 0.04, h * 0.8, 7);
  trunk.translate(0, h * 0.4, 0);
  trunk.rotateZ((r() - 0.5) * 0.25);
  parts.push(tint(trunk, '#6a5240'));
  for (let k = 0; k < 9; k++) {
    let b: THREE.BufferGeometry = new THREE.SphereGeometry(h * (0.16 + r() * 0.08), 10, 6);
    b.scale(1.3, 0.45, 1.3);
    b.translate((r() - 0.5) * h * 0.55, h * (0.78 + r() * 0.12), (r() - 0.5) * h * 0.55);
    b = tint(b, r() < 0.5 ? '#3f5a31' : '#4a6638');
    parts.push(b);
  }
  const m = new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  m.castShadow = true;
  return reflective(m);
}

/** Italian cypress: a tall, narrow dark-green flame. */
export function cypress(h: number) {
  const g = new THREE.SphereGeometry(h * 0.1, 10, 12);
  g.scale(1, 5, 1);
  g.translate(0, h * 0.5, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2c4128', roughness: 0.95 }));
  m.castShadow = true;
  return reflective(m);
}

/** A small sailboat far out: white hull and sail. */
export function sailboat(scale: number) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.6 }));
  hull.position.y = 0.4;
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([0.3, 0.8, 0, 0.3, 8, 0, -2.6, 0.8, 0], 3));
  sail.computeVertexNormals();
  const sm = new THREE.Mesh(sail, new THREE.MeshStandardMaterial({ color: '#fbfaf6', side: THREE.DoubleSide, roughness: 0.7 }));
  g.add(hull, sm);
  g.scale.setScalar(scale);
  return reflective(g);
}
