// Shared scenery pieces for the locations: hazy ridgelines, conifers,
// seasonal broadleaf trees, boulders, and open water (lakes, the sea).
// Everything is simple geometry with smooth shading, in keeping with the calm
// style; distance and haze do the rest.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_REFLECT } from '../../render/pipeline';
import { NOISE } from '../../render/glsl';
import type { Season } from './palettes';

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Atmospheric perspective: colour of an object at distance d seen through haze. */
export function hazed(base: THREE.Color | string, haze: THREE.Color, d: number, scale: number) {
  return new THREE.Color(base).lerp(haze, 1 - Math.exp(-d / scale));
}

export function reflective<T extends THREE.Object3D>(o: T): T {
  o.layers.enable(LAYER_REFLECT);
  return o;
}

function setColor(g: THREE.BufferGeometry, c: THREE.Color | string) {
  const col = new THREE.Color(c);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) col.toArray(a, k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}
export const tint = setColor;

// ── ridgelines ───────────────────────────────────────────────────────────────
export interface RidgeOpts {
  z: number;
  width: number;
  base: number;
  hill: number;
  treeH?: number;
  treeDensity?: number;
  pointy?: boolean;
  color: THREE.Color;
  haze: THREE.Color;
  mist: number;
  seed: number;
  /** custom skyline: return extra height at x (e.g. a city or mountain peaks) */
  extra?: (x: number) => number;
  x?: number;
}

export function ridge(o: RidgeOpts) {
  const r = rng(o.seed);
  const S = 1400;
  const top = new Float32Array(S + 1);
  const ph = [r() * 10, r() * 10, r() * 10];
  // horizontal frequencies shrink with distance so far ranges stay broad
  const zs = 100 / Math.abs(o.z);
  for (let k = 0; k <= S; k++) {
    const x = (k / S - 0.5) * o.width;
    const xs = x * zs;
    top[k] = o.base + o.hill * (0.5 + 0.3 * Math.sin(xs * 0.011 + ph[0]) + 0.2 * Math.sin(xs * 0.031 + ph[1]) + 0.08 * Math.sin(xs * 0.09 + ph[2]));
    if (o.extra) top[k] += o.extra(x + (o.x ?? 0));
  }
  // trees stand on the hill itself, not on each other
  const hillTop = top.slice();
  const trees = Math.round(o.width * (o.treeDensity ?? 0));
  for (let t = 0; t < trees; t++) {
    const xc = (r() - 0.5) * o.width;
    const h = (o.treeH ?? 0) * (0.7 + 0.45 * r());
    const w = h * (o.pointy ? 0.5 + 0.15 * r() : 2.5 + 1.5 * r());
    const k0 = Math.floor(((xc - w / 2) / o.width + 0.5) * S);
    const k1 = Math.ceil(((xc + w / 2) / o.width + 0.5) * S);
    const kc = Math.round((xc / o.width + 0.5) * S);
    const ground = hillTop[Math.max(0, Math.min(S, kc))] - h * 0.15;
    for (let k = Math.max(0, k0); k <= Math.min(S, k1); k++) {
      const x = (k / S - 0.5) * o.width;
      const u = 1 - Math.abs(x - xc) / (w / 2);
      if (u <= 0) continue;
      const prof = o.pointy ? u * (1 - 0.1 * ((u * 4) % 1)) : Math.sqrt(u * (2 - u));
      top[k] = Math.max(top[k], ground + h * prof);
    }
  }
  const shape = new THREE.Shape();
  shape.moveTo(-o.width / 2, -40);
  for (let k = 0; k <= S; k++) shape.lineTo((k / S - 0.5) * o.width, top[k]);
  shape.lineTo(o.width / 2, -40);
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.ShaderMaterial({
    fog: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: o.color },
      uHaze: { value: o.haze },
      uMistTop: { value: o.base + o.hill * 0.4 },
      uMist: { value: o.mist },
    },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uHaze;
      uniform float uMistTop, uMist;
      varying float vY;
      void main() {
        // valley mist: each layer fades toward the haze colour at its foot
        float m = (1.0 - smoothstep(0.0, uMistTop, vY)) * uMist;
        gl_FragColor = vec4(mix(uColor, uHaze, m), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(o.x ?? 0, 0, o.z);
  return reflective(mesh);
}

// ── trees ────────────────────────────────────────────────────────────────────
/** wind sway: displaces vertices by height² · sin(t), applied to tree materials */
export const sway = { time: { value: 0 }, strength: { value: 0.02 } };

function swayMaterial(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uSwayT = sway.time;
    s.uniforms.uSwayK = sway.strength;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayT, uSwayK;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wpos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 wpos = vec3(0.0);
          #endif
          float hgt = max(transformed.y, 0.0);
          float ph = wpos.x * 0.37 + wpos.z * 0.23;
          transformed.x += uSwayK * hgt * hgt * (sin(uSwayT * 1.3 + ph) + 0.35 * sin(uSwayT * 3.1 + ph * 1.7));
          transformed.z += uSwayK * 0.5 * hgt * hgt * sin(uSwayT * 1.1 + ph * 0.8);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'sway';
  return m;
}

function pineGeometry(seed: number, snow: boolean) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.03, 0.06, 1.0, 6);
  trunk.translate(0, 0.5, 0);
  parts.push(setColor(trunk, '#4a3526'));
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const radius = 0.62 * (1 - f * 0.85) * (0.9 + 0.2 * r());
    const height = 1.0 * (1 - f * 0.4);
    const cone = new THREE.ConeGeometry(radius, height, 7, 3, true);
    cone.rotateY(r() * Math.PI);
    const green = new THREE.Color('#2f4a2c').multiplyScalar(0.85 + 0.25 * f);
    const g = setColor(cone, green);
    if (snow) {
      // snow settles on the upper part of each tier and thins toward the
      // drooping tips, so the tree still reads as a dark pine under a load
      // of snow (every face of a cone points the same amount upward, so a
      // normal test alone would turn the whole tree white)
      const pos = g.attributes.position as THREE.BufferAttribute;
      const col = g.attributes.color as THREE.BufferAttribute;
      const white = new THREE.Color(0.9, 0.93, 0.96);
      const c = new THREE.Color();
      for (let k = 0; k < col.count; k++) {
        const t = pos.getY(k) / height + 0.5; // 0 at the rim, 1 at the apex
        const s = THREE.MathUtils.smoothstep(t, 0.3, 0.85) * 0.9;
        c.copy(green).lerp(white, s);
        col.setXYZ(k, c.r, c.g, c.b);
      }
    }
    g.translate(0, 0.35 + f * 3.3 + height / 2, 0);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Conifers at the given spots [x, z, height]. */
export function conifers(spots: [number, number, number][], season: Season, seed = 1) {
  const snow = season === 'winter';
  const mat = swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }));
  const variants = [pineGeometry(3 + seed, snow), pineGeometry(8 + seed, snow), pineGeometry(15 + seed, snow)];
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const r = rng(seed * 31 + 7);
  variants.forEach((geo, v) => {
    const mine = spots.filter((_, i) => i % 3 === v);
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(mine.length, 1));
    mine.forEach(([x, z, h], i) => {
      const s = h / 4.3;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * (0.85 + 0.3 * r()), s, s * (0.85 + 0.3 * r())));
      inst.setMatrixAt(i, m);
    });
    inst.count = mine.length;
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    group.add(reflective(inst));
  });
  return group;
}

const FOLIAGE: Record<Season, string[]> = {
  spring: ['#8cbf5a', '#9fcb6a', '#f2c6d6', '#7fb24a'],
  summer: ['#4f7f36', '#5d8c3c', '#46732f', '#5a8a3a'],
  autumn: ['#d9832b', '#c4521f', '#e6b13a', '#b8442a'],
  winter: [],
};

function broadleafGeometry(seed: number, season: Season) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.06, 0.11, 1.6, 7);
  trunk.translate(0, 0.8, 0);
  parts.push(setColor(trunk, '#5a4636'));
  // a few limbs (always there; the only thing visible in winter)
  for (let b = 0; b < 4; b++) {
    const limb = new THREE.CylinderGeometry(0.02, 0.045, 1.1, 5);
    limb.translate(0, 0.55, 0);
    limb.rotateZ((r() - 0.5) * 1.2);
    limb.rotateY(r() * Math.PI * 2);
    limb.translate(0, 1.4 + r() * 0.4, 0);
    parts.push(setColor(limb, '#5a4636'));
  }
  const cols = FOLIAGE[season];
  if (cols.length) {
    for (let k = 0; k < 7; k++) {
      let blob: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.55 + r() * 0.35, 2);
      blob.deleteAttribute('normal');
      blob.deleteAttribute('uv');
      blob = mergeVertices(blob);
      blob.translate((r() - 0.5) * 1.3, 2.1 + r() * 1.0, (r() - 0.5) * 1.3);
      blob.computeVertexNormals();
      parts.push(setColor(blob, cols[Math.floor(r() * cols.length)]));
    }
  }
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** Broadleaf trees (maple / birch style) with seasonal foliage. */
export function broadleaves(spots: [number, number, number][], season: Season, seed = 1) {
  const mat = swayMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const group = new THREE.Group();
  const r = rng(seed * 13 + 5);
  const variants = [broadleafGeometry(seed + 2, season), broadleafGeometry(seed + 9, season)];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  variants.forEach((geo, v) => {
    const mine = spots.filter((_, i) => i % 2 === v);
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(mine.length, 1));
    mine.forEach(([x, z, h], i) => {
      const s = h / 3.4;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(i, m);
    });
    inst.count = mine.length;
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    group.add(reflective(inst));
  });
  return group;
}

// ── boulders ────────────────────────────────────────────────────────────────
export function boulderGeometry(seed: number, stone = '#8a877f', moss = '#617a34', mossAmount = 1) {
  const r = rng(seed);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 5);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const ph = [r() * 9, r() * 9, r() * 9, r() * 9];
  const squash = 0.55 + 0.15 * r();
  const stretch = 1 + 0.35 * r();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k);
    const d =
      1 +
      0.16 * Math.sin(v.x * 1.5 + ph[0]) * Math.sin(v.z * 1.7 + ph[1]) +
      0.07 * Math.sin(v.y * 2.4 + ph[2]) * Math.sin(v.x * 2.1 + ph[3]) +
      0.1 * Math.max(0, v.x * Math.cos(ph[0]) + v.z * Math.sin(ph[0]));
    v.multiplyScalar(d);
    v.x *= stretch;
    v.y *= squash;
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  const cols = new Float32Array(n.count * 3);
  const sc = new THREE.Color(stone);
  const mc = new THREE.Color(moss);
  const c = new THREE.Color();
  const line = 0.72 + 0.12 * r();
  for (let k = 0; k < n.count; k++) {
    const top = n.getY(k) + 0.25 * pos.getY(k);
    c.copy(sc).lerp(mc, THREE.MathUtils.smoothstep(top, line, line + 0.18) * 0.9 * mossAmount);
    c.toArray(cols, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export function boulders(
  list: [number, number, number, number][],
  sdfAt: (x: number, z: number) => number,
  opts: { stone?: string; moss?: string; mossAmount?: number; snow?: boolean } = {},
) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  for (const [x0, z0, s, seed] of list) {
    // slide the rock outward until it clears the water's edge
    let x = x0, z = z0;
    const len = Math.hypot(x, z) || 1;
    for (let k = 0; k < 60 && sdfAt(x, z) < s * 1.05; k++) {
      x += (x0 / len) * 0.03;
      z += (z0 / len) * 0.03;
    }
    const mesh = new THREE.Mesh(boulderGeometry(seed, opts.stone, opts.snow ? '#e8edf2' : opts.moss, opts.snow ? 1.2 : opts.mossAmount ?? 1), mat);
    mesh.scale.setScalar(s);
    // sunk about a third of its height into the ground, like a real boulder
    mesh.position.set(x, -s * 0.2, z);
    mesh.rotation.y = seed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(reflective(mesh));
  }
  return group;
}

// ── open water: lakes, ponds, the sea ───────────────────────────────────────
// A flat surface at height y, reflecting the scene through the same mirrored
// render the puddle uses (its plane is close enough to y = 0 at a distance),
// with slow procedural ripples, Fresnel, and the water's own deep colour.
export interface Waters {
  reflection: { texture: THREE.Texture | null; matrix: THREE.Matrix4 };
  time: THREE.IUniform<number>;
  resolution: THREE.Vector2;
}

export function openWater(
  size: { w: number; d: number },
  y: number,
  deep: string,
  waters: Waters,
  opts: { waves?: number; ice?: boolean; holes?: [number, number, number, number][] } = {},
) {
  // a finely divided plane: enormous single triangles lose depth precision
  // and flicker against the ground
  const geo = new THREE.PlaneGeometry(size.w, size.d, Math.ceil(size.w / 25), Math.ceil(size.d / 25));
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uRefl: { value: null },
        uReflMatrix: { value: new THREE.Matrix4() },
        uDeep: { value: new THREE.Color(deep) },
        uWaves: { value: opts.waves ?? 1 },
        uIce: { value: opts.ice ? 1 : 0 },
        // world-space rectangles (x0, z0, x1, z1) left dry: a dock, the shore
        uHoles: { value: [0, 1, 2].map((k) => new THREE.Vector4(...(opts.holes?.[k] ?? [0, 0, 0, 0]))) },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform sampler2D uRefl;
      uniform mat4 uReflMatrix;
      uniform vec3 uDeep;
      uniform float uTime, uWaves, uIce;
      uniform vec4 uHoles[3];
      varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 p = vW.xz;
        for (int k = 0; k < 3; k++)
          if (p.x > uHoles[k].x && p.x < uHoles[k].z && p.y > uHoles[k].y && p.y < uHoles[k].w) discard;
        float e = 0.15;
        float t = uTime * 0.6;
        float h0 = vnoise(p * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise(p * 2.1 - vec2(t * 0.8, 0.0));
        float hx = vnoise((p + vec2(e, 0.0)) * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise((p + vec2(e, 0.0)) * 2.1 - vec2(t * 0.8, 0.0));
        float hz = vnoise((p + vec2(0.0, e)) * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise((p + vec2(0.0, e)) * 2.1 - vec2(t * 0.8, 0.0));
        vec3 n = normalize(vec3(-(hx - h0) / e * 0.06 * uWaves * (1.0 - uIce), 1.0, -(hz - h0) / e * 0.06 * uWaves * (1.0 - uIce)));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n);
        vec4 rc = uReflMatrix * vec4(vW + R * 30.0, 1.0);
        vec3 refl = texture2D(uRefl, clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
        float cosV = clamp(dot(n, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
        vec3 col = mix(uDeep, refl, F);
        if (uIce > 0.5) col = mix(vec3(0.82, 0.88, 0.94), refl, F * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = waters.time;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.onBeforeRender = () => {
    mat.uniforms.uRefl.value = waters.reflection.texture;
    (mat.uniforms.uReflMatrix.value as THREE.Matrix4).copy(waters.reflection.matrix);
  };
  return mesh;
}


// ── the CN Tower ────────────────────────────────────────────────────────────
/**
 * The CN Tower (553 m): tapering shaft, main pod, SkyPod, antenna. At night
 * its LED lighting runs up the shaft, the pod glows and red aircraft beacons
 * blink on the antenna.
 */
export function cnTower(mat: THREE.Material, glow: THREE.Material, night = 0) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 15, 335, 6), mat);
  shaft.position.y = 167;
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(22, 18, 18, 24), mat);
  pod.position.y = 342;
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(21, 2, 8, 32), glow);
  podRing.rotation.x = Math.PI / 2;
  podRing.position.y = 344;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 105, 8), mat);
  upper.position.y = 402;
  const skypod = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 8, 12), mat);
  skypod.position.y = 447;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.5, 100, 6), mat);
  antenna.position.y = 503;
  g.add(shaft, pod, podRing, upper, skypod, antenna);
  if (night > 0) {
    const pts: number[] = [];
    // LED strips up the three corners of the shaft
    for (let y = 8; y < 330; y += 6) {
      const w = 15 - (11 * y) / 335;
      for (const a of [0, 2.09, 4.19]) pts.push(Math.cos(a) * w, y, Math.sin(a) * w + 1, 0.05, 0.9);
    }
    // the pod's windows and the SkyPod
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      pts.push(Math.cos(a) * 22, 340, Math.sin(a) * 22, 0.7, 1.2);
      pts.push(Math.cos(a) * 22, 346, Math.sin(a) * 22, 0.7, 1.0);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.4) pts.push(Math.cos(a) * 7, 447, Math.sin(a) * 7, 0.5, 0.9);
    g.add(nightLights(pts, night, { size: 2.2, gain: 2.6 }));
    // red beacons up the antenna
    const red: number[] = [];
    for (const y of [460, 500, 552]) red.push(0, y, 2, 1, 2.2);
    const beacons = nightLights(red, night, { size: 3.6, gain: 3 });
    (beacons.material as THREE.ShaderMaterial).fragmentShader = (beacons.material as THREE.ShaderMaterial).fragmentShader.replace(
      'gl_FragColor = vec4(vCol',
      'gl_FragColor = vec4(vec3(1.0, 0.08, 0.04) * step(0.5, fract(vTw * 3.0 + 0.3)) * 2.0 + vCol * 0.0',
    );
    g.add(beacons);
  }
  return g;
}

// ── night lights ────────────────────────────────────────────────────────────
/**
 * Lit windows and street lights for distant cities at night: one point per
 * light, drawn as a tiny soft glow a few pixels across (they are far away),
 * with an HDR core so the bloom gives each a halo, a slow twinkle from the
 * air between, and a mix of warm homes and cooler offices.
 * Give it the points (x, y, z, warmth 0…1, brightness) in the group's space.
 */
export function nightLights(pts: number[], night: number, opts: { size?: number; gain?: number } = {}) {
  const n = pts.length / 5;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    pos.set([pts[k * 5], pts[k * 5 + 1], pts[k * 5 + 2]], k * 3);
    const warm = pts[k * 5 + 3], b = pts[k * 5 + 4];
    const c = new THREE.Color().setRGB(1.0, 0.72, 0.42).lerp(new THREE.Color(0.82, 0.9, 1.0), 1 - warm);
    col.set([c.r * b, c.g * b, c.b * b], k * 3);
    ph[k] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: night }, uTime: sway.time, uSize: { value: opts.size ?? 2 }, uGain: { value: opts.gain ?? 1.4 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float phase;
      uniform float uTime, uSize;
      varying vec3 vCol;
      varying float vTw;
      void main() {
        vCol = color;
        vTw = 0.8 + 0.2 * sin(uTime * (0.7 + fract(phase) * 2.0) + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight, uGain;
      varying vec3 vCol;
      varying float vTw;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(vCol * uGain * vTw * (0.4 + 1.6 * a * a), a * uNight);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.visible = night > 0.01;
  p.layers.enable(LAYER_REFLECT);
  return p;
}

/** Window lights over the faces of buildings: rects [x0, x1, y0, y1, z]. */
export function windowLights(rects: [number, number, number, number, number][], floor: number, fill: number, seed: number) {
  const r = rng(seed);
  const pts: number[] = [];
  for (const [x0, x1, y0, y1, z] of rects) {
    const office = r() < 0.5;
    for (let y = y0 + floor * 0.7; y < y1 - floor * 0.3; y += floor) {
      for (let x = x0 + floor * 0.5; x < x1; x += floor * 0.9) {
        if (r() > fill) continue;
        // whole floors tend to be lit or dark together
        if (r() < 0.25) continue;
        pts.push(x + (r() - 0.5) * floor * 0.3, y + (r() - 0.5) * floor * 0.2, z, office ? 0.3 + r() * 0.4 : 0.7 + r() * 0.3, 0.35 + r() * 0.65);
      }
    }
  }
  return pts;
}
