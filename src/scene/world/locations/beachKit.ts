// Pieces for the two beaches: sculpted dunes with marram grass, sandstone
// cliffs, a lighthouse, beach umbrellas and loungers, a whitewashed
// village, umbrella pines and cypresses, and a sailboat out at sea.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, reflective, tint, swayMaterial } from '../props';
import { NOISE as NOISE_GLSL } from '../../../render/glsl';

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
  const cm = new THREE.Mesh(canopy.index ? canopy.toNonIndexed() : canopy, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }));
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

/**
 * Surf along a straight stretch of shore: lines of broken white water
 * rolling in, breaking up along their length, and the swash sheet sliding
 * up the sand and back with a lacy foam edge. The shore runs through `at`
 * along x turned by `angle` (radians about y); the sea is on its −z side.
 */
export function surf(o: { at: [number, number]; angle?: number; width: number; sea: string; period?: number; zone?: number }, time: THREE.IUniform<number>) {
  const zone = o.zone ?? 9;
  const geo = new THREE.PlaneGeometry(o.width, zone + 4, Math.ceil(o.width / 4), 24);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -zone / 2 + 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uShore: { value: 0 }, uZone: { value: zone }, uPeriod: { value: o.period ?? 7 }, uSea: { value: new THREE.Color(o.sea) } },
    ]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vW = position; // along-shore x, seaward −z
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime, uShore, uZone, uPeriod;
      uniform vec3 uSea;
      varying vec3 vW;
      ${NOISE_GLSL}
      void main() {
        float d = uShore - vW.z; // metres seaward of the mean waterline
        float x = vW.x;
        float fw = fwidth(d) + 1e-3;
        // swash: each wave's run-up slides up the beach and drains back
        float cyc = fract(uTime / uPeriod);
        float run = 1.6 * sin(3.14159 * min(cyc * 1.6, 1.0)) - 0.4;
        float edge = -run + 0.25 * (vnoise(vec2(x * 0.7, uTime * 0.2)) - 0.5);
        float sheet = smoothstep(edge - fw, edge + fw * 2.0, d) * (1.0 - smoothstep(0.0, 1.5, d - 1.0));
        float lace = smoothstep(0.35, 0.0, abs(d - edge) / 0.35) * (0.5 + 0.5 * vnoise(vec2(x * 5.0, d * 7.0 + uTime)));
        // broken waves rolling in: crests every uZone/3 m, fading near the sand
        float lam = uZone / 3.0;
        float ph = d / lam + cyc * 1.0;
        float crest = fract(ph);
        float k = floor(ph);
        float band = smoothstep(0.0, 0.02 + fw / lam, crest) * (1.0 - smoothstep(0.02, 0.16, crest));
        float breakup = smoothstep(0.35, 0.7, vnoise(vec2(x * 0.12 + k * 7.3, k * 1.7)) + 0.25 * vnoise(vec2(x * 1.3, k)));
        float trail = (1.0 - smoothstep(0.0, 0.45, crest)) * 0.35 * vnoise(vec2(x * 2.0, ph * 9.0));
        float zone = smoothstep(uZone, uZone * 0.6, d) * smoothstep(-0.3, 0.6, d);
        float foam = max(band, trail) * breakup * zone + lace * 0.9;
        vec3 water = mix(uSea, vec3(1.0), 0.15);
        vec3 col = mix(water, vec3(0.97, 0.98, 1.0), clamp(foam, 0.0, 1.0));
        float a = clamp(foam * 0.95 + sheet * 0.45, 0.0, 0.95);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = time;
  const m = new THREE.Mesh(geo, mat);
  m.position.set(o.at[0], 0.03, o.at[1]);
  m.rotation.y = o.angle ?? 0;
  m.renderOrder = 2;
  return m;
}

/**
 * A coconut palm: a slender ringed trunk curving up and leaning out, a crown
 * of a dozen arching fronds, each a midrib with drooping leaflets, and a few
 * coconuts. Fronds sway in the wind.
 */
export function palm(h: number, lean: number, seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  // trunk: a curve leaning out and back up, ringed with leaf scars
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    pts.push(new THREE.Vector3(lean * h * (t * 0.9 - 0.35 * t * t), h * t, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 40, h * 0.022, 9, false);
  const tp = trunk.attributes.position as THREE.BufferAttribute;
  const tc = new Float32Array(tp.count * 3);
  const bark = new THREE.Color('#8a7356'), scar = new THREE.Color('#6b5640');
  for (let k = 0; k < tp.count; k++) {
    const y = tp.getY(k);
    const t = y / h;
    // thicker at the foot, and a ring every ~12 cm
    const ring = 0.5 + 0.5 * Math.sin((y / 0.12) * Math.PI * 2);
    const c = curve.getPoint(Math.min(1, Math.max(0, t)));
    const s = 1 + 0.6 * Math.pow(1 - t, 4) + 0.06 * ring;
    tp.setX(k, c.x + (tp.getX(k) - c.x) * s);
    tp.setZ(k, c.z + (tp.getZ(k) - c.z) * s);
    bark.clone().lerp(scar, ring * 0.6).multiplyScalar(0.85 + 0.15 * t).toArray(tc, k * 3);
  }
  trunk.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  trunk.deleteAttribute('uv');
  parts.push(trunk.toNonIndexed());
  const top = curve.getPoint(1);
  // fronds
  const dark = new THREE.Color('#3f6b2a'), light = new THREE.Color('#7aa548'), dry = new THREE.Color('#a8955a');
  const nF = 13;
  for (let f = 0; f < nF; f++) {
    const az = (f / nF) * Math.PI * 2 + r() * 0.3;
    const len = h * (0.32 + r() * 0.1);
    const up = 0.5 + r() * 0.5; // initial rise
    const old = f % 5 === 0;
    const pos: number[] = [], col: number[] = [];
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const N = 18;
    const rib = (t: number) =>
      top.clone().addScaledVector(dir, len * t).add(new THREE.Vector3(0, len * (up * t - (old ? 1.3 : 0.9) * t * t), 0));
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const a = rib(t0), b = rib(t1);
      const w = len * 0.2 * Math.sin(Math.PI * Math.min(1, t0 * 1.15 + 0.05));
      const droop = new THREE.Vector3(0, -w * 0.7, 0);
      const c0 = (old ? dry : dark).clone().lerp(old ? dry : light, t0 * 0.8 + r() * 0.15);
      for (const sgn of [-1, 1]) {
        // a leaflet: from the midrib out and down
        const tip = a.clone().addScaledVector(side, sgn * w).add(droop).addScaledVector(dir, len * 0.04);
        const tri = [a, b, tip];
        for (const v of tri) pos.push(v.x, v.y, v.z);
        for (let q = 0; q < 3; q++) col.push(c0.r * (q === 2 ? 1.15 : 0.9), c0.g * (q === 2 ? 1.15 : 0.9), c0.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    parts.push(g);
  }
  // coconuts
  for (let k = 0; k < 4; k++) {
    const nut = new THREE.SphereGeometry(h * 0.018, 8, 6);
    const a = r() * Math.PI * 2;
    nut.translate(top.x + Math.cos(a) * h * 0.025, top.y - h * 0.025, top.z + Math.sin(a) * h * 0.025);
    parts.push(tint(nut, '#5a4a2a'));
  }
  const m = new THREE.Mesh(
    mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))),
    swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return reflective(m);
}

/**
 * A sandstone cliff along a line of points (the foot of the cliff, the sea
 * on the left as you walk the line): horizontal strata weathered into
 * ledges and overhangs, cut by gullies, darker and damp near the foot, with
 * a turf cap that lips over the edge and the grassy land running back from
 * the top. height(t) gives the height along the line, t = 0…1.
 */
export function cliffLine(o: {
  points: [number, number][];
  height: (t: number) => number;
  rock: string;
  band: string;
  pale: string;
  grass: string;
  seed: number;
}) {
  const r = rng(o.seed);
  const ph = Array.from({ length: 8 }, () => r() * 10);
  const curve = new THREE.CatmullRomCurve3(o.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const len = curve.getLength();
  const NU = Math.ceil(len / 0.8), NV = 40;
  const rock = new THREE.Color(o.rock), band = new THREE.Color(o.band), pale = new THREE.Color(o.pale), grass = new THREE.Color(o.grass);
  const c = new THREE.Color();
  const grid: THREE.Vector3[][] = [];
  const cols: THREE.Color[][] = [];
  const inland: THREE.Vector3[] = [];
  for (let i = 0; i <= NU; i++) {
    const t = i / NU;
    const P = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    const N = new THREE.Vector3(T.z, 0, -T.x); // seaward (left of the walk)
    inland.push(N.clone().multiplyScalar(-400));
    const s = t * len;
    const H = o.height(t);
    // gullies and buttresses along the face
    const gully = 0.5 + 0.5 * Math.sin(s * 0.42 + ph[0]) * Math.sin(s * 0.17 + ph[1]);
    const row: THREE.Vector3[] = [], crow: THREE.Color[] = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV;
      const y = v * H;
      // the face leans back; harder strata stand out as ledges
      const strata = Math.sin(y * 2.4 + Math.sin(s * 0.08 + ph[2]) * 1.2);
      const ledge = 0.25 * Math.max(0, strata) ** 3;
      let out = -0.22 * y - 2.2 * gully + ledge + 0.35 * Math.sin(s * 1.3 + y * 0.7 + ph[3]) + 0.15 * Math.sin(s * 3.1 + ph[4]);
      // the turf lips over the edge
      if (j === NV) out -= 0.15;
      const p = P.clone().addScaledVector(N, out);
      p.y = y + (j === NV ? 0.15 : 0);
      row.push(p);
      // red rock with paler and deeper bands, dark in the gullies, damp at
      // the foot, turf on top
      const b = 0.5 + 0.5 * Math.sin(y * 3.3 + Math.sin(s * 0.11) * 0.9 + ph[5]);
      c.copy(rock).lerp(band, b * 0.55);
      if (Math.sin(y * 1.1 + ph[6]) > 0.8) c.lerp(pale, 0.5);
      c.multiplyScalar(0.78 + 0.28 * (1 - gully) + 0.08 * Math.sin(s * 2.3 + y * 5));
      if (y < 0.7) c.multiplyScalar(0.7 + 0.3 * (y / 0.7));
      if (j >= NV - 1) c.copy(grass).multiplyScalar(0.9 + 0.2 * r());
      crow.push(c.clone());
    }
    grid.push(row);
    cols.push(crow);
  }
  const pos: number[] = [], col: number[] = [];
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++)
      for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]]) {
        const p = grid[a][b], cc = cols[a][b];
        pos.push(p.x, p.y, p.z);
        col.push(cc.r, cc.g, cc.b);
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  // the grassy land on top, running inland
  const top: number[] = [];
  for (let i = 0; i < NU; i++) {
    const a = grid[i][NV], b = grid[i + 1][NV];
    const a2 = a.clone().add(inland[i]), b2 = b.clone().add(inland[i + 1]);
    top.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, b.x, b.y, b.z, a.x, a.y, a.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  tg.computeVertexNormals();
  const land = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: o.grass, roughness: 1, side: THREE.DoubleSide }));
  land.receiveShadow = true;
  const group = new THREE.Group();
  group.add(m, land);
  return reflective(group);
}

/** A sea stack: a pillar of the same sandstone standing in the shallows, turf on top. */
export function seaStack(h: number, w: number, rock: string, band: string, grass: string, seed: number) {
  const r = rng(seed);
  let g: THREE.BufferGeometry = new THREE.CylinderGeometry(w * 0.42, w * 0.55, h, 9, 14);
  g.translate(0, h / 2, 0);
  g = g.toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const a = new THREE.Color(rock), b = new THREE.Color(band), gr = new THREE.Color(grass);
  const ph = r() * 10;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const ang = Math.atan2(z, x);
    const s = 1 + 0.18 * Math.sin(ang * 3 + ph) + 0.1 * Math.sin(y * 2.4 + ang * 2) - (y < 0.8 ? 0.15 * (1 - y / 0.8) : 0);
    p.setX(k, x * s);
    p.setZ(k, z * s);
    const c = a.clone().lerp(b, 0.5 + 0.5 * Math.sin(y * 3.3 + ph));
    (y > h - 0.25 ? gr : c).toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.castShadow = m.receiveShadow = true;
  return reflective(m);
}

/**
 * A Maritime lighthouse: a white octagonal tower tapering up, a red gallery
 * with railing posts, the glazed lantern room and red cap, and the keeper's
 * house beside it. At night the lamp glows and its beam sweeps the bay.
 */
export function lighthouse2(height: number, night: number) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.75 });
  const red = new THREE.MeshStandardMaterial({ color: '#b3231c', roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.1, height * 0.16, height, 8), white);
  tower.position.y = height / 2;
  for (let k = 0; k < 3; k++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(height * 0.05, height * 0.07, height * 0.02), dark);
    const y = height * (0.3 + 0.22 * k);
    w.position.set(0, y, height * (0.16 - 0.06 * (y / height)) + 0.01);
    g.add(w);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.17, height * 0.15, height * 0.04, 8), red);
  gallery.position.y = height * 1.02;
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(height * 0.085, height * 0.085, height * 0.15, 8),
    new THREE.MeshStandardMaterial({ color: '#3a3f44', emissive: new THREE.Color('#ffe2a0'), emissiveIntensity: 0.25 + night * 6, roughness: 0.15, metalness: 0.3 }),
  );
  lantern.position.y = height * 1.115;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(height * 0.11, height * 0.1, 8), red);
  cap.position.y = height * 1.24;
  const vent = new THREE.Mesh(new THREE.SphereGeometry(height * 0.025, 8, 6), red);
  vent.position.y = height * 1.3;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(height * 0.008, height * 0.05, height * 0.008), dark);
    post.position.set(Math.cos(a) * height * 0.165, height * 1.065, Math.sin(a) * height * 0.165);
    g.add(post);
  }
  // the keeper's house: white clapboard, red roof
  const body = new THREE.Mesh(new THREE.BoxGeometry(height * 0.55, height * 0.28, height * 0.38), white);
  body.position.set(height * 0.5, height * 0.14, height * 0.15);
  const roofGeo = new THREE.BufferGeometry();
  const W = height * 0.3, D = height * 0.21, R = height * 0.16;
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -W, 0, -D, W, 0, -D, W, R, 0, -W, 0, -D, W, R, 0, -W, R, 0,
    -W, 0, D, -W, R, 0, W, R, 0, -W, 0, D, W, R, 0, W, 0, D,
    -W, 0, -D, -W, R, 0, -W, 0, D, W, 0, -D, W, 0, D, W, R, 0,
  ], 3));
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#b3231c', roughness: 0.55, side: THREE.DoubleSide }));
  roof.position.set(height * 0.5, height * 0.28, height * 0.15);
  for (const o of [tower, gallery, cap, body, roof]) o.castShadow = true;
  g.add(tower, gallery, lantern, cap, vent, body, roof);
  let beam: THREE.Mesh | null = null;
  if (night > 0) {
    const geo = new THREE.ConeGeometry(height * 0.6, height * 9, 24, 1, true);
    geo.translate(0, -height * 4.5, 0);
    geo.rotateZ(Math.PI / 2);
    beam = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6b0').multiplyScalar(0.25 * night), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.position.y = height * 1.115;
    g.add(beam);
  }
  return {
    group: reflective(g),
    update(t: number) {
      if (beam) beam.rotation.y = t * 0.6;
    },
  };
}
