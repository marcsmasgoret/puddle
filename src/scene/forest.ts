// Forest location: stone and moss ground, layered pine ridges fading into
// haze, a ring of low-poly pines and mossy boulders around the puddle.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_REFLECT } from '../render/pipeline';
import type { Palette } from './atmosphere';

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Atmospheric perspective: colour of an object at distance d seen through haze. */
function hazed(base: THREE.Color, haze: THREE.Color, d: number, scale: number) {
  return base.clone().lerp(haze, 1 - Math.exp(-d / scale));
}

// ── distant ridges: flat silhouettes whose skyline is dotted with pines ──────
function ridgeMesh(opts: {
  z: number;
  width: number;
  base: number;
  hill: number;
  treeH: number;
  treeDensity: number;
  color: THREE.Color;
  haze: THREE.Color;
  mist: number;
  seed: number;
  /** 0 = rounded canopy bumps (distant forest), 1 = pointed pines */
  pointy: number;
}) {
  const r = rng(opts.seed);
  const S = 1400;
  const top = new Float32Array(S + 1);
  const ph = [r() * 10, r() * 10, r() * 10];
  // horizontal frequencies shrink with distance so far ranges stay broad
  const zs = 100 / Math.abs(opts.z);
  for (let k = 0; k <= S; k++) {
    const x = (k / S - 0.5) * opts.width * zs;
    top[k] =
      opts.base +
      opts.hill * (0.5 + 0.3 * Math.sin(x * 0.011 + ph[0]) + 0.2 * Math.sin(x * 0.031 + ph[1]) + 0.08 * Math.sin(x * 0.09 + ph[2]));
  }
  // trees on the skyline: pointed pines up close, soft rounded canopy far away
  const trees = Math.round(opts.width * opts.treeDensity);
  for (let t = 0; t < trees; t++) {
    const xc = (r() - 0.5) * opts.width;
    const h = opts.treeH * (0.7 + 0.45 * r());
    const w = h * (opts.pointy > 0.5 ? 0.5 + 0.15 * r() : 2.5 + 1.5 * r());
    const k0 = Math.floor(((xc - w / 2) / opts.width + 0.5) * S);
    const k1 = Math.ceil(((xc + w / 2) / opts.width + 0.5) * S);
    const kc = Math.round((xc / opts.width + 0.5) * S);
    const ground = top[Math.max(0, Math.min(S, kc))] - h * 0.15;
    for (let k = Math.max(0, k0); k <= Math.min(S, k1); k++) {
      const x = (k / S - 0.5) * opts.width;
      const u = 1 - Math.abs(x - xc) / (w / 2);
      if (u <= 0) continue;
      const prof = opts.pointy > 0.5 ? u * (1 - 0.1 * ((u * 4) % 1)) : Math.sqrt(u * (2 - u));
      top[k] = Math.max(top[k], ground + h * prof);
    }
  }
  const shape = new THREE.Shape();
  shape.moveTo(-opts.width / 2, -30);
  for (let k = 0; k <= S; k++) shape.lineTo((k / S - 0.5) * opts.width, top[k]);
  shape.lineTo(opts.width / 2, -30);
  const geo = new THREE.ShapeGeometry(shape);

  const mat = new THREE.ShaderMaterial({
    fog: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: opts.color },
      uHaze: { value: opts.haze },
      uMistTop: { value: opts.base + opts.hill * 0.4 },
      uMist: { value: opts.mist },
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
  mesh.position.z = opts.z;
  mesh.layers.enable(LAYER_REFLECT);
  return mesh;
}

// ── a low-poly pine: trunk + stacked, slightly irregular cones ───────────────
function pineGeometry(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.03, 0.06, 1.0, 6);
  trunk.translate(0, 0.5, 0);
  setColor(trunk, new THREE.Color('#4a3526'));
  parts.push(trunk);
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const radius = 0.62 * (1 - f * 0.85) * (0.9 + 0.2 * r());
    const height = 1.0 * (1 - f * 0.4);
    const cone = new THREE.ConeGeometry(radius, height, 7, 1, true);
    cone.rotateY(r() * Math.PI);
    cone.translate(0, 0.35 + f * 3.3 + height / 2, 0);
    setColor(cone, new THREE.Color('#2f4a2c').multiplyScalar(0.85 + 0.25 * f));
    parts.push(cone);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  g.computeVertexNormals();
  return g;
}

function setColor(g: THREE.BufferGeometry, c: THREE.Color) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) c.toArray(a, k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
}

// ── a mossy boulder: a smooth, gently lumpy pebble shape with a soft moss
//    cap. Smooth normals keep it clean and calm (no visible facets).
function boulderGeometry(seed: number) {
  const r = rng(seed);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 6);
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
    // two octaves of very low-frequency lumps: rounded, river-stone-like
    const d =
      1 +
      0.16 * Math.sin(v.x * 1.5 + ph[0]) * Math.sin(v.z * 1.7 + ph[1]) +
      0.07 * Math.sin(v.y * 2.4 + ph[2]) * Math.sin(v.x * 2.1 + ph[3]) +
      0.1 * Math.max(0, v.x * Math.cos(ph[0]) + v.z * Math.sin(ph[0])); // lean to one side
    v.multiplyScalar(d);
    v.x *= stretch;
    v.y *= squash;
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  const cols = new Float32Array(n.count * 3);
  const stone = new THREE.Color('#8a877f');
  const moss = new THREE.Color('#617a34');
  const c = new THREE.Color();
  const mossLine = 0.72 + 0.12 * r();
  for (let k = 0; k < n.count; k++) {
    // moss only on the flattest, highest part of the top
    const top = n.getY(k) + 0.25 * pos.getY(k);
    c.copy(stone).lerp(moss, THREE.MathUtils.smoothstep(top, mossLine, mossLine + 0.18) * 0.9);
    c.toArray(cols, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export function buildForest(
  scene: THREE.Scene,
  palette: Palette,
  puddleHalf: [number, number],
  sdfAt: (x: number, z: number) => number,
) {
  const haze = palette.haze;
  const group = new THREE.Group();

  // layered ridges: far blue mountains, then forested hills whose skylines
  // are dotted with small pines (each tree ~10 m tall at its real distance)
  const mountain = new THREE.Color('#7c8ba3');
  const pine = new THREE.Color('#2a4230');
  group.add(
    ridgeMesh({ z: -900, width: 4000, base: 20, hill: 200, treeH: 0, treeDensity: 0, color: hazed(mountain, haze, 900, 700), haze, mist: 0.55, seed: 5, pointy: 0 }),
    ridgeMesh({ z: -520, width: 2600, base: 10, hill: 95, treeH: 0, treeDensity: 0, color: hazed(mountain, haze, 520, 500).multiplyScalar(0.92), haze, mist: 0.5, seed: 11, pointy: 0 }),
  );
  const ridges = [
    { z: -300, base: 4, hill: 38, treeH: 3, density: 0.6, pointy: 0 },
    { z: -190, base: 2, hill: 20, treeH: 2.5, density: 0.8, pointy: 0 },
    { z: -125, base: 0, hill: 8, treeH: 7, density: 0.9, pointy: 1 },
  ];
  ridges.forEach((rd, k) =>
    group.add(
      ridgeMesh({
        z: rd.z,
        width: Math.abs(rd.z) * 6,
        base: rd.base,
        hill: rd.hill,
        treeH: rd.treeH,
        treeDensity: rd.density,
        color: hazed(pine, haze, -rd.z, 220),
        haze,
        mist: 0.6 - k * 0.12,
        seed: 21 + k * 7,
        pointy: rd.pointy,
      }),
    ),
  );

  // 3D pines around the clearing
  const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
  const variants = [pineGeometry(3), pineGeometry(8), pineGeometry(15)];
  const r = rng(42);
  const placed: THREE.Matrix4[][] = [[], [], []];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spots: [number, number, number][] = [];
  // framing clusters on both sides of the glade
  for (const side of [-1, 1]) {
    for (let t = 0; t < 7; t++) {
      spots.push([side * (5 + r() * 6), -6 - r() * 10, 3.2 + r() * 1.6]);
    }
  }
  // the forest beyond: a broad ring with an open view through the middle,
  // so the distant ridges show above the puddle
  for (let t = 0; t < 220; t++) {
    const ang = (r() - 0.5) * Math.PI * 1.2;
    const dist = 22 + Math.pow(r(), 0.8) * 90;
    if (Math.abs(ang) < 0.32 && dist < 70) continue;
    spots.push([Math.sin(ang) * dist * 1.4, -Math.cos(ang) * dist, 2.2 + r() * 2.4]);
  }
  for (let t = 0; t < spots.length; t++) {
    const [x, z, s] = spots[t];
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * (0.85 + 0.3 * r()), s, s * (0.85 + 0.3 * r())));
    placed[t % 3].push(m.clone());
  }
  variants.forEach((geo, k) => {
    const inst = new THREE.InstancedMesh(geo, pineMat, placed[k].length);
    placed[k].forEach((mm, i) => inst.setMatrixAt(i, mm));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    inst.layers.enable(LAYER_REFLECT);
    group.add(inst);
  });

  // boulders: a few large ones framing the puddle, smaller ones scattered
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const [hx, hz] = puddleHalf;
  const rocks: [number, number, number, number][] = [
    [hx + 0.3, -hz * 0.35, 0.32, 1],
    [hx * 0.25, -hz - 0.5, 0.42, 3],
    [-hx * 0.7, -hz - 0.3, 0.16, 4],
    [hx + 2.2, -hz - 3.5, 1.1, 5],
    [-hx - 2.6, -hz - 2.4, 0.8, 6],
    [-hx - 0.05, hz * 0.3, 0.08, 9],
  ];
  for (const [x0, z0, s, seed] of rocks) {
    // slide the rock outward until it clears the water's edge
    let x = x0, z = z0;
    const len = Math.hypot(x, z);
    for (let k = 0; k < 60 && sdfAt(x, z) < s * 1.05; k++) {
      x += (x0 / len) * 0.03;
      z += (z0 / len) * 0.03;
    }
    const mesh = new THREE.Mesh(boulderGeometry(seed), rockMat);
    mesh.scale.setScalar(s);
    // sunk about a third of its height into the ground, like a real boulder
    mesh.position.set(x, -s * 0.2, z);
    mesh.rotation.y = seed;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(LAYER_REFLECT);
    group.add(mesh);
  }

  scene.add(group);
  return group;
}
