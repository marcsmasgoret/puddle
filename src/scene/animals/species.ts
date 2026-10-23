// ─────────────────────────────────────────────────────────────────────────────
// The animals, blocked out from real proportions (see sculpt.ts for how the
// shapes become one smooth skinned body). Model space: +x forward, +y up,
// +z to the animal's left; the feet stand on y = 0. Units: metres.
//
// Quadruped bone names (used by gait.ts):
//   body (pelvis, root) · chest · neck · head · tail0…tailN
//   legs fl, fr, hl, hr (front/hind, left/right), each with joints 0, 1, 2
//   (shoulder/hip, elbow/stifle, wrist/hock)
// Bird bone names: body · neck · head · wl0, wl1 / wr0, wr1 (shoulder,
// wrist) · tail
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { AnimalSpec, BoneSpec, Prim } from './sculpt';

type V3 = [number, number, number];
const mirror = (v: V3, s: number): V3 => [v[0], v[1], v[2] * s];

/** a leg as three bones and three tapered segments, for both sides */
function legs(
  front: boolean,
  parent: string,
  joints: [V3, V3, V3, V3],
  radii: [number, number, number, number],
  foot: { r: V3; at: V3 },
) {
  const bones: BoneSpec[] = [];
  const prims: Prim[] = [];
  for (const [side, s] of [['l', 1], ['r', -1]] as const) {
    const n = (front ? 'f' : 'h') + side;
    const j = joints.map((v) => mirror(v, s)) as [V3, V3, V3, V3];
    bones.push({ name: n + '0', parent, at: j[0] }, { name: n + '1', parent: n + '0', at: j[1] }, { name: n + '2', parent: n + '1', at: j[2] });
    prims.push(
      { kind: 'capsule', bone: n + '0', a: j[0], b: j[1], ra: radii[0], rb: radii[1], blend: radii[0] * 0.6 },
      { kind: 'capsule', bone: n + '1', a: j[1], b: j[2], ra: radii[1], rb: radii[2], blend: radii[2] * 0.6 },
      { kind: 'capsule', bone: n + '2', a: j[2], b: j[3], ra: radii[2], rb: radii[3], blend: radii[3] * 0.6 },
      { kind: 'ellipsoid', bone: n + '2', c: mirror(foot.at, s), r: foot.r, blend: radii[3] * 0.8 },
    );
  }
  return { bones, prims };
}

/** a tail as a chain of bones with tapering segments */
function tail(points: V3[], r0: number, r1: number, parent = 'body') {
  const bones: BoneSpec[] = [];
  const prims: Prim[] = [];
  points.forEach((p, i) => bones.push({ name: 'tail' + i, parent: i === 0 ? parent : 'tail' + (i - 1), at: p }));
  for (let i = 0; i < points.length - 1; i++) {
    const t0 = i / (points.length - 1), t1 = (i + 1) / (points.length - 1);
    prims.push({ kind: 'capsule', bone: 'tail' + i, a: points[i], b: points[i + 1], ra: r0 + (r1 - r0) * t0, rb: r0 + (r1 - r0) * t1, blend: 0.006 });
  }
  return { bones, prims };
}

const sph = (r: number, sx = 1, sy = 1, sz = 1) => () => new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz);

// ── domestic cat (tabby, white belly) ───────────────────────────────────────
export function catSpec(): AnimalSpec {
  // a sturdy domestic shorthair: deep chest, round haunches, legs about
  // half the shoulder height, a big round head and a thick tail
  const front = legs(true, 'chest', [[0.11, 0.17, 0.042], [0.098, 0.1, 0.046], [0.112, 0.03, 0.046], [0.118, 0.014, 0.046]], [0.033, 0.021, 0.016, 0.014], { at: [0.124, 0.013, 0.046], r: [0.023, 0.013, 0.018] });
  const hind = legs(false, 'body', [[-0.12, 0.17, 0.046], [-0.075, 0.1, 0.054], [-0.14, 0.048, 0.052], [-0.13, 0.014, 0.052]], [0.042, 0.025, 0.016, 0.014], { at: [-0.12, 0.013, 0.052], r: [0.026, 0.013, 0.019] });
  const t = tail([[-0.18, 0.215, 0], [-0.235, 0.205, 0], [-0.29, 0.195, 0], [-0.345, 0.195, 0], [-0.395, 0.205, 0], [-0.43, 0.215, 0]], 0.02, 0.014);
  return {
    name: 'cat',
    voxel: 0.0045,
    bones: [
      { name: 'body', parent: null, at: [-0.02, 0.21, 0] },
      { name: 'chest', parent: 'body', at: [0.08, 0.22, 0] },
      { name: 'neck', parent: 'chest', at: [0.16, 0.245, 0] },
      { name: 'head', parent: 'neck', at: [0.205, 0.295, 0] },
      ...front.bones,
      ...hind.bones,
      ...t.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'chest', c: [0.07, 0.2, 0], r: [0.09, 0.085, 0.072], blend: 0.035 },
      { kind: 'ellipsoid', bone: 'body', c: [-0.03, 0.195, 0], r: [0.115, 0.08, 0.075], blend: 0.035 },
      { kind: 'ellipsoid', bone: 'body', c: [-0.115, 0.19, 0], r: [0.08, 0.08, 0.07], blend: 0.035 },
      { kind: 'capsule', bone: 'neck', a: [0.12, 0.225, 0], b: [0.195, 0.28, 0], ra: 0.055, rb: 0.046, blend: 0.03 },
      // head: round skull, wide cheeks, short muzzle, small chin
      { kind: 'ellipsoid', bone: 'head', c: [0.212, 0.305, 0], r: [0.054, 0.05, 0.052], blend: 0.016 },
      { kind: 'ellipsoid', bone: 'head', c: [0.234, 0.288, 0], r: [0.043, 0.036, 0.057], blend: 0.016 },
      { kind: 'ellipsoid', bone: 'head', c: [0.265, 0.283, 0], r: [0.023, 0.021, 0.029], blend: 0.011 },
      { kind: 'ellipsoid', bone: 'head', c: [0.256, 0.266, 0], r: [0.018, 0.012, 0.019], blend: 0.009 },
      // ears: thin triangles, slightly forward
      { kind: 'capsule', bone: 'head', a: [0.21, 0.34, 0.03], b: [0.213, 0.392, 0.043], ra: 0.018, rb: 0.003, blend: 0.006 },
      { kind: 'capsule', bone: 'head', a: [0.21, 0.34, -0.03], b: [0.213, 0.392, -0.043], ra: 0.018, rb: 0.003, blend: 0.006 },
      ...front.prims,
      ...hind.prims,
      ...t.prims,
    ],
    fur: { shells: 8, length: 0.004, density: 900 },
    roughness: 0.9,
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        // dark grey tabby on top, white belly, chest, muzzle and paws
        vec3 grey = vec3(0.2, 0.2, 0.21);
        vec3 charcoal = vec3(0.055, 0.055, 0.06);
        vec3 white = vec3(0.86, 0.85, 0.82);
        float grain = fbm3(p * 260.0);
        // mackerel stripes: narrow dark bands running down the flanks from
        // the spine, wavy; rings on the legs and tail; an "M" on the brow
        float wav = fbm3(p * 40.0) * 2.0;
        float stripes = sin(p.x * 230.0 + wav * 4.0 + abs(p.z) * 30.0);
        float legBands = sin(p.y * 260.0 + wav * 3.0);
        float onLeg = smoothstep(0.15, 0.11, p.y);
        float s = mix(stripes, legBands, onLeg);
        if (p.x < -0.19) s = sin(length(p.xy - vec2(-0.19, 0.21)) * 210.0);
        float stripe = smoothstep(0.25, 0.75, s * 0.5 + 0.5);
        stripe = max(stripe, smoothstep(0.012, 0.0, abs(p.z)) * step(0.24, p.y) * step(p.x, 0.18));
        vec3 c = mix(grey, charcoal, stripe * 0.9);
        c *= 0.85 + 0.3 * grain;
        // white: underside, throat, chest, muzzle, paws
        float w = smoothstep(-0.05, -0.45, n.y) * smoothstep(0.235, 0.195, p.y);
        w = max(w, smoothstep(0.12, 0.17, p.x) * smoothstep(0.255, 0.215, p.y) * smoothstep(0.0, 0.5, n.x + 0.2));
        w = max(w, smoothstep(0.245, 0.258, p.x) * smoothstep(0.3, 0.285, p.y));
        w = max(w, smoothstep(0.045, 0.03, p.y));
        // pink inner ears
        float ear = smoothstep(0.34, 0.35, p.y) * smoothstep(0.2, 0.6, n.x);
        c = mix(c, white * (0.9 + 0.1 * grain), clamp(w, 0.0, 1.0));
        return mix(c, vec3(0.75, 0.5, 0.5), ear * 0.7);
      }`,
    extras: [
      { bone: 'head', geo: sph(0.0105), color: '#b6bd3a', at: [0.251, 0.312, 0.026], rough: 0.08, emissive: '#2a2a08' },
      { bone: 'head', geo: sph(0.0105), color: '#b6bd3a', at: [0.251, 0.312, -0.026], rough: 0.08, emissive: '#2a2a08' },
      { bone: 'head', geo: sph(0.0065, 0.4, 1.2, 0.5), color: '#050505', at: [0.2605, 0.312, 0.0245], rough: 0.05 },
      { bone: 'head', geo: sph(0.0065, 0.4, 1.2, 0.5), color: '#050505', at: [0.2605, 0.312, -0.0245], rough: 0.05 },
      { bone: 'head', geo: sph(0.006, 1, 0.8, 1.2), color: '#c48a88', at: [0.286, 0.292, 0], rough: 0.4 },
    ],
  };
}

// ── house mouse ─────────────────────────────────────────────────────────────
export function mouseSpec(): AnimalSpec {
  const fl = legs(true, 'chest', [[0.022, 0.016, 0.01], [0.026, 0.008, 0.011], [0.028, 0.002, 0.011], [0.032, 0.002, 0.011]], [0.0045, 0.003, 0.0022, 0.002], { at: [0.031, 0.0018, 0.011], r: [0.004, 0.0015, 0.003] });
  const hl = legs(false, 'body', [[-0.02, 0.018, 0.012], [-0.012, 0.009, 0.013], [-0.022, 0.003, 0.013], [-0.018, 0.002, 0.013]], [0.006, 0.0035, 0.0022, 0.002], { at: [-0.014, 0.0018, 0.013], r: [0.006, 0.0015, 0.003] });
  const t = tail([[-0.036, 0.016, 0], [-0.056, 0.012, 0], [-0.076, 0.009, 0], [-0.096, 0.007, 0], [-0.114, 0.006, 0]], 0.0026, 0.0011);
  return {
    name: 'mouse',
    voxel: 0.0013,
    bones: [
      { name: 'body', parent: null, at: [-0.01, 0.02, 0] },
      { name: 'chest', parent: 'body', at: [0.012, 0.021, 0] },
      { name: 'neck', parent: 'chest', at: [0.026, 0.022, 0] },
      { name: 'head', parent: 'neck', at: [0.034, 0.024, 0] },
      ...fl.bones,
      ...hl.bones,
      ...t.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [-0.012, 0.02, 0], r: [0.027, 0.019, 0.018], blend: 0.01 },
      { kind: 'ellipsoid', bone: 'chest', c: [0.014, 0.02, 0], r: [0.02, 0.016, 0.015], blend: 0.01 },
      { kind: 'ellipsoid', bone: 'head', c: [0.04, 0.024, 0], r: [0.017, 0.012, 0.011], blend: 0.006 },
      { kind: 'ellipsoid', bone: 'head', c: [0.054, 0.021, 0], r: [0.009, 0.006, 0.006], blend: 0.005 },
      // big round ears
      { kind: 'ellipsoid', bone: 'head', c: [0.034, 0.038, 0.011], r: [0.003, 0.009, 0.008], blend: 0.002 },
      { kind: 'ellipsoid', bone: 'head', c: [0.034, 0.038, -0.011], r: [0.003, 0.009, 0.008], blend: 0.002 },
      ...fl.prims,
      ...hl.prims,
      ...t.prims,
    ],
    fur: { shells: 3, length: 0.0012, density: 2500 },
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        vec3 top = vec3(0.32, 0.26, 0.21), belly = vec3(0.62, 0.57, 0.5), pink = vec3(0.78, 0.55, 0.53);
        vec3 c = mix(top, belly, smoothstep(0.0, -0.6, n.y));
        c *= 0.85 + 0.3 * fbm3(p * 900.0);
        float bare = max(step(p.x, -0.035), step(p.y, 0.004));
        bare = max(bare, step(0.03, p.y) * step(p.x, 0.04) * step(0.028, p.x)); // ears
        bare = max(bare, step(0.06, p.x)); // nose
        return mix(c, pink, bare);
      }`,
    extras: [
      { bone: 'head', geo: sph(0.0028), color: '#050505', at: [0.048, 0.029, 0.0075], rough: 0.05 },
      { bone: 'head', geo: sph(0.0028), color: '#050505', at: [0.048, 0.029, -0.0075], rough: 0.05 },
    ],
  };
}

// ── eastern grey squirrel ───────────────────────────────────────────────────
export function squirrelSpec(): AnimalSpec {
  const fl = legs(true, 'chest', [[0.06, 0.06, 0.022], [0.065, 0.035, 0.024], [0.07, 0.01, 0.024], [0.075, 0.005, 0.024]], [0.01, 0.007, 0.005, 0.004], { at: [0.075, 0.004, 0.024], r: [0.008, 0.004, 0.006] });
  const hl = legs(false, 'body', [[-0.05, 0.065, 0.028], [-0.025, 0.035, 0.032], [-0.06, 0.012, 0.03], [-0.04, 0.005, 0.03]], [0.018, 0.01, 0.006, 0.005], { at: [-0.03, 0.004, 0.03], r: [0.016, 0.004, 0.007] });
  const t = tail([[-0.075, 0.075, 0], [-0.105, 0.1, 0], [-0.12, 0.14, 0], [-0.11, 0.175, 0], [-0.085, 0.195, 0]], 0.028, 0.034);
  return {
    name: 'squirrel',
    voxel: 0.003,
    bones: [
      { name: 'body', parent: null, at: [-0.02, 0.07, 0] },
      { name: 'chest', parent: 'body', at: [0.04, 0.075, 0] },
      { name: 'neck', parent: 'chest', at: [0.075, 0.09, 0] },
      { name: 'head', parent: 'neck', at: [0.095, 0.1, 0] },
      ...fl.bones,
      ...hl.bones,
      ...t.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [-0.03, 0.068, 0], r: [0.058, 0.05, 0.044], blend: 0.025 },
      { kind: 'ellipsoid', bone: 'chest', c: [0.035, 0.082, 0], r: [0.042, 0.04, 0.034], blend: 0.025 },
      { kind: 'ellipsoid', bone: 'head', c: [0.098, 0.106, 0], r: [0.034, 0.03, 0.028], blend: 0.012 },
      { kind: 'ellipsoid', bone: 'head', c: [0.125, 0.099, 0], r: [0.016, 0.014, 0.015], blend: 0.009 },
      { kind: 'capsule', bone: 'head', a: [0.095, 0.122, 0.014], b: [0.092, 0.142, 0.017], ra: 0.007, rb: 0.003, blend: 0.004 },
      { kind: 'capsule', bone: 'head', a: [0.095, 0.122, -0.014], b: [0.092, 0.142, -0.017], ra: 0.007, rb: 0.003, blend: 0.004 },
      ...fl.prims,
      ...hl.prims,
      ...t.prims,
    ],
    fur: { shells: 4, length: 0.004, density: 900 },
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        vec3 grey = vec3(0.36, 0.34, 0.31), brown = vec3(0.42, 0.3, 0.2), white = vec3(0.82, 0.8, 0.76);
        vec3 c = mix(grey, brown, smoothstep(0.3, 0.9, n.y) * 0.5 + 0.15 * fbm3(p * 60.0));
        c *= 0.8 + 0.4 * fbm3(p * 500.0);
        // the tail: grey with a silver fringe
        if (p.x < -0.08) c = mix(vec3(0.3, 0.29, 0.27), vec3(0.78, 0.76, 0.72), smoothstep(0.55, 0.85, fbm3(p * 120.0) + abs(n.z) * 0.3));
        return mix(c, white, smoothstep(-0.1, -0.5, n.y) * step(-0.07, p.x));
      }`,
    extras: [
      { bone: 'head', geo: sph(0.0045), color: '#050505', at: [0.115, 0.11, 0.017], rough: 0.05 },
      { bone: 'head', geo: sph(0.0045), color: '#050505', at: [0.115, 0.11, -0.017], rough: 0.05 },
    ],
  };
}

// ── eastern cottontail ──────────────────────────────────────────────────────
export function rabbitSpec(): AnimalSpec {
  const fl = legs(true, 'chest', [[0.08, 0.07, 0.03], [0.085, 0.04, 0.032], [0.09, 0.012, 0.032], [0.097, 0.006, 0.032]], [0.013, 0.009, 0.007, 0.006], { at: [0.097, 0.005, 0.032], r: [0.01, 0.005, 0.008] });
  const hl = legs(false, 'body', [[-0.07, 0.09, 0.04], [-0.035, 0.05, 0.045], [-0.08, 0.018, 0.045], [-0.04, 0.008, 0.045]], [0.03, 0.017, 0.009, 0.008], { at: [-0.04, 0.006, 0.045], r: [0.03, 0.006, 0.011] });
  return {
    name: 'rabbit',
    voxel: 0.0035,
    bones: [
      { name: 'body', parent: null, at: [-0.03, 0.1, 0] },
      { name: 'chest', parent: 'body', at: [0.05, 0.1, 0] },
      { name: 'neck', parent: 'chest', at: [0.1, 0.13, 0] },
      { name: 'head', parent: 'neck', at: [0.125, 0.15, 0] },
      { name: 'tail0', parent: 'body', at: [-0.12, 0.11, 0] },
      ...fl.bones,
      ...hl.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [-0.04, 0.1, 0], r: [0.085, 0.072, 0.065], blend: 0.03 },
      { kind: 'ellipsoid', bone: 'chest', c: [0.05, 0.1, 0], r: [0.055, 0.058, 0.048], blend: 0.03 },
      { kind: 'ellipsoid', bone: 'head', c: [0.135, 0.15, 0], r: [0.04, 0.034, 0.032], blend: 0.012 },
      { kind: 'ellipsoid', bone: 'head', c: [0.163, 0.14, 0], r: [0.02, 0.02, 0.02], blend: 0.01 },
      // long ears, laid back a little
      { kind: 'ellipsoid', bone: 'head', c: [0.115, 0.215, 0.018], r: [0.012, 0.05, 0.02], blend: 0.006 },
      { kind: 'ellipsoid', bone: 'head', c: [0.115, 0.215, -0.018], r: [0.012, 0.05, 0.02], blend: 0.006 },
      { kind: 'ellipsoid', bone: 'tail0', c: [-0.128, 0.115, 0], r: [0.022, 0.022, 0.022], blend: 0.01 },
      ...fl.prims,
      ...hl.prims,
    ],
    fur: { shells: 5, length: 0.005, density: 700 },
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        vec3 agouti = vec3(0.4, 0.31, 0.22), dark = vec3(0.2, 0.16, 0.12), white = vec3(0.86, 0.84, 0.8);
        vec3 c = mix(agouti, dark, smoothstep(0.55, 0.8, fbm3(p * 160.0)));
        c *= 0.85 + 0.3 * fbm3(p * 600.0);
        float w = smoothstep(-0.1, -0.5, n.y);
        w = max(w, step(p.x, -0.13));                 // the cotton tail
        float ear = step(0.18, p.y) * smoothstep(0.2, 0.7, n.x);
        c = mix(c, white, clamp(w, 0.0, 1.0));
        return mix(c, vec3(0.7, 0.55, 0.5), ear * 0.6);
      }`,
    extras: [
      { bone: 'head', geo: sph(0.0075), color: '#120c08', at: [0.152, 0.163, 0.024], rough: 0.05 },
      { bone: 'head', geo: sph(0.0075), color: '#120c08', at: [0.152, 0.163, -0.024], rough: 0.05 },
    ],
  };
}

// ── white-tailed deer (doe) ─────────────────────────────────────────────────
export function deerSpec(winter: boolean): AnimalSpec {
  const fl = legs(true, 'chest', [[0.45, 0.78, 0.13], [0.43, 0.48, 0.13], [0.45, 0.17, 0.13], [0.46, 0.03, 0.13]], [0.065, 0.032, 0.022, 0.02], { at: [0.47, 0.025, 0.13], r: [0.03, 0.025, 0.02] });
  const hl = legs(false, 'body', [[-0.42, 0.8, 0.14], [-0.33, 0.5, 0.15], [-0.47, 0.25, 0.15], [-0.45, 0.03, 0.15]], [0.09, 0.04, 0.022, 0.02], { at: [-0.44, 0.025, 0.15], r: [0.03, 0.025, 0.02] });
  const t = tail([[-0.6, 0.9, 0], [-0.68, 0.84, 0]], 0.04, 0.03);
  const tan = winter ? 'vec3(0.29, 0.25, 0.21)' : 'vec3(0.5, 0.32, 0.18)';
  return {
    name: winter ? 'deerW' : 'deer',
    voxel: 0.012,
    bones: [
      { name: 'body', parent: null, at: [-0.15, 0.9, 0] },
      { name: 'chest', parent: 'body', at: [0.3, 0.92, 0] },
      { name: 'neck', parent: 'chest', at: [0.5, 1.0, 0] },
      { name: 'head', parent: 'neck', at: [0.7, 1.35, 0] },
      ...fl.bones,
      ...hl.bones,
      ...t.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [-0.2, 0.92, 0], r: [0.42, 0.2, 0.18], blend: 0.1 },
      { kind: 'ellipsoid', bone: 'chest', c: [0.3, 0.93, 0], r: [0.28, 0.21, 0.17], blend: 0.1 },
      { kind: 'ellipsoid', bone: 'body', c: [-0.45, 0.9, 0], r: [0.17, 0.18, 0.16], blend: 0.08 },
      { kind: 'capsule', bone: 'neck', a: [0.45, 1.0, 0], b: [0.68, 1.33, 0], ra: 0.11, rb: 0.065, blend: 0.07 },
      { kind: 'ellipsoid', bone: 'head', c: [0.74, 1.37, 0], r: [0.1, 0.075, 0.07], blend: 0.03 },
      { kind: 'capsule', bone: 'head', a: [0.76, 1.36, 0], b: [0.92, 1.3, 0], ra: 0.05, rb: 0.032, blend: 0.03 },
      { kind: 'ellipsoid', bone: 'head', c: [0.7, 1.47, 0.07], r: [0.025, 0.07, 0.04], blend: 0.015 },
      { kind: 'ellipsoid', bone: 'head', c: [0.7, 1.47, -0.07], r: [0.025, 0.07, 0.04], blend: 0.015 },
      ...fl.prims,
      ...hl.prims,
      ...t.prims,
    ],
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        vec3 tan = ${tan}, white = vec3(0.86, 0.84, 0.8), dark = vec3(0.12, 0.1, 0.09);
        vec3 c = tan * (0.85 + 0.3 * fbm3(p * 25.0));
        float w = smoothstep(-0.1, -0.55, n.y) * step(0.5, p.y);
        w = max(w, step(0.8, p.x) * step(p.y, 1.33));               // muzzle band
        w = max(w, smoothstep(0.03, 0.0, abs(p.y - 1.2)) * step(0.6, p.x) * step(p.x, 0.7)); // throat patch
        w = max(w, step(p.x, -0.6) * smoothstep(0.2, -0.4, n.y));   // under the tail
        c = mix(c, white, clamp(w, 0.0, 1.0));
        c = mix(c, dark, step(0.9, p.x) + step(p.y, 0.06));         // nose, hooves
        return c;
      }`,
    extras: [
      { bone: 'head', geo: sph(0.017), color: '#080605', at: [0.8, 1.4, 0.055], rough: 0.05 },
      { bone: 'head', geo: sph(0.017), color: '#080605', at: [0.8, 1.4, -0.055], rough: 0.05 },
    ],
  };
}

// ── red fox ─────────────────────────────────────────────────────────────────
export function foxSpec(): AnimalSpec {
  const fl = legs(true, 'chest', [[0.2, 0.3, 0.06], [0.19, 0.17, 0.06], [0.2, 0.05, 0.06], [0.21, 0.012, 0.06]], [0.032, 0.017, 0.012, 0.011], { at: [0.215, 0.011, 0.06], r: [0.02, 0.011, 0.015] });
  const hl = legs(false, 'body', [[-0.2, 0.31, 0.065], [-0.14, 0.18, 0.07], [-0.23, 0.08, 0.07], [-0.21, 0.012, 0.07]], [0.045, 0.022, 0.012, 0.011], { at: [-0.205, 0.011, 0.07], r: [0.022, 0.011, 0.015] });
  const t = tail([[-0.28, 0.33, 0], [-0.38, 0.29, 0], [-0.48, 0.24, 0], [-0.56, 0.2, 0], [-0.62, 0.18, 0]], 0.045, 0.04);
  return {
    name: 'fox',
    voxel: 0.006,
    bones: [
      { name: 'body', parent: null, at: [-0.05, 0.33, 0] },
      { name: 'chest', parent: 'body', at: [0.13, 0.34, 0] },
      { name: 'neck', parent: 'chest', at: [0.24, 0.38, 0] },
      { name: 'head', parent: 'neck', at: [0.31, 0.45, 0] },
      ...fl.bones,
      ...hl.bones,
      ...t.bones,
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [-0.08, 0.33, 0], r: [0.19, 0.085, 0.075], blend: 0.05 },
      { kind: 'ellipsoid', bone: 'chest', c: [0.13, 0.34, 0], r: [0.12, 0.095, 0.075], blend: 0.05 },
      { kind: 'capsule', bone: 'neck', a: [0.2, 0.36, 0], b: [0.3, 0.44, 0], ra: 0.06, rb: 0.048, blend: 0.03 },
      { kind: 'ellipsoid', bone: 'head', c: [0.32, 0.46, 0], r: [0.06, 0.05, 0.055], blend: 0.02 },
      { kind: 'capsule', bone: 'head', a: [0.34, 0.45, 0], b: [0.42, 0.43, 0], ra: 0.03, rb: 0.012, blend: 0.02 },
      { kind: 'capsule', bone: 'head', a: [0.31, 0.5, 0.03], b: [0.31, 0.56, 0.045], ra: 0.022, rb: 0.004, blend: 0.008 },
      { kind: 'capsule', bone: 'head', a: [0.31, 0.5, -0.03], b: [0.31, 0.56, -0.045], ra: 0.022, rb: 0.004, blend: 0.008 },
      ...fl.prims,
      ...hl.prims,
      ...t.prims,
    ],
    fur: { shells: 5, length: 0.008, density: 500 },
    coat: /* glsl */ `
      vec3 coat(vec3 p, vec3 n) {
        vec3 red = vec3(0.62, 0.24, 0.07), white = vec3(0.88, 0.86, 0.82), black = vec3(0.06, 0.05, 0.05);
        vec3 c = red * (0.8 + 0.4 * fbm3(p * 120.0));
        float w = smoothstep(-0.05, -0.5, n.y) * step(0.1, p.x) * step(0.2, p.y);
        w = max(w, step(0.35, p.x) * step(p.y, 0.45));   // muzzle and chin
        w = max(w, step(p.x, -0.57));                     // the white tail tip
        c = mix(c, white, clamp(w, 0.0, 1.0));
        float socks = smoothstep(0.17, 0.12, p.y);        // black stockings
        socks = max(socks, step(0.52, p.y) * step(n.x, 0.0)); // black ear backs
        socks = max(socks, step(0.415, p.x));             // nose
        return mix(c, black, socks);
      }`,
    extras: [
      { bone: 'head', geo: sph(0.008), color: '#2a1a05', at: [0.36, 0.475, 0.032], rough: 0.05, emissive: '#100800' },
      { bone: 'head', geo: sph(0.008), color: '#2a1a05', at: [0.36, 0.475, -0.032], rough: 0.05, emissive: '#100800' },
    ],
  };
}

// ── birds ───────────────────────────────────────────────────────────────────
export interface BirdLook {
  name: string;
  span: number; // wingspan [m]
  body: number; // body length [m]
  neck?: number; // long neck (geese, loons)
  coat: string;
  beak: string;
  beakLen: number;
}

export function birdSpec(b: BirdLook): AnimalSpec {
  const L = b.body, S = b.span;
  const r = L * 0.18;
  const neck = b.neck ?? 0;
  const head: V3 = [L * 0.42 + neck * 0.6, r * 0.6 + neck * 0.8, 0];
  const bones: BoneSpec[] = [
    { name: 'body', parent: null, at: [0, 0, 0] },
    { name: 'neck', parent: 'body', at: [L * 0.32, r * 0.3, 0] },
    { name: 'head', parent: 'neck', at: head },
    { name: 'tail', parent: 'body', at: [-L * 0.35, 0, 0] },
  ];
  const prims: Prim[] = [
    { kind: 'ellipsoid', bone: 'body', c: [0, 0, 0], r: [L * 0.38, r, r * 1.05], blend: r * 0.5 },
    { kind: 'capsule', bone: 'neck', a: [L * 0.28, r * 0.2, 0], b: head, ra: r * (neck ? 0.45 : 0.7), rb: r * 0.5, blend: r * 0.4 },
    { kind: 'ellipsoid', bone: 'head', c: head, r: [r * 0.75, r * 0.62, r * 0.6], blend: r * 0.3 },
    { kind: 'ellipsoid', bone: 'tail', c: [-L * 0.48, 0, 0], r: [L * 0.18, r * 0.12, r * 0.7], blend: r * 0.4 },
  ];
  for (const [side, s] of [['l', 1], ['r', -1]] as const) {
    const sh: V3 = [L * 0.1, r * 0.5, s * r * 0.8];
    const wr: V3 = [L * 0.05, r * 0.5, s * S * 0.25];
    bones.push({ name: 'w' + side + '0', parent: 'body', at: sh }, { name: 'w' + side + '1', parent: 'w' + side + '0', at: wr });
    prims.push(
      { kind: 'ellipsoid', bone: 'w' + side + '0', c: [L * 0.02, r * 0.5, s * S * 0.14], r: [L * 0.2, r * 0.13, S * 0.13], blend: r * 0.3 },
      { kind: 'ellipsoid', bone: 'w' + side + '1', c: [-L * 0.04, r * 0.5, s * S * 0.37], r: [L * 0.17, r * 0.09, S * 0.14], blend: r * 0.25 },
    );
  }
  return {
    name: 'bird-' + b.name,
    voxel: Math.max(S / 90, 0.0018),
    bones,
    prims,
    coat: b.coat,
    roughness: 0.75,
    extras: [
      {
        bone: 'head',
        geo: () => new THREE.ConeGeometry(r * 0.22, b.beakLen, 8).rotateZ(-Math.PI / 2),
        color: b.beak,
        at: [head[0] + r * 0.6 + b.beakLen * 0.45, head[1] - r * 0.05, 0],
        rough: 0.5,
      },
      { bone: 'head', geo: sph(r * 0.12), color: '#060606', at: [head[0] + r * 0.35, head[1] + r * 0.15, r * 0.5], rough: 0.05 },
      { bone: 'head', geo: sph(r * 0.12), color: '#060606', at: [head[0] + r * 0.35, head[1] + r * 0.15, -r * 0.5], rough: 0.05 },
    ],
  };
}

export const BIRDS: Record<string, BirdLook> = {
  robin: {
    name: 'robin', span: 0.34, body: 0.24, beak: '#e0a23a', beakLen: 0.018,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 back = vec3(0.24, 0.22, 0.2), breast = vec3(0.72, 0.3, 0.1), headc = vec3(0.07, 0.07, 0.07);
      vec3 c = mix(back, breast, smoothstep(0.1, -0.4, n.y) * step(-0.05, p.x));
      return mix(c, headc, step(0.09, p.x) * step(0.0, p.y));
    }`,
  },
  crow: {
    name: 'crow', span: 0.9, body: 0.45, beak: '#0b0b0d', beakLen: 0.05,
    coat: `vec3 coat(vec3 p, vec3 n) { return vec3(0.03, 0.03, 0.04) + 0.03 * vec3(0.3, 0.3, 0.6) * max(n.y, 0.0); }`,
  },
  gull: {
    name: 'gull', span: 1.3, body: 0.55, beak: '#e8c43a', beakLen: 0.055,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 c = vec3(0.92, 0.92, 0.9);
      float wing = step(0.12, abs(p.z));
      c = mix(c, vec3(0.58, 0.61, 0.65), wing * smoothstep(-0.2, 0.3, n.y));
      return mix(c, vec3(0.05), step(0.55, abs(p.z)));   // black wingtips
    }`,
  },
  goose: {
    name: 'goose', span: 1.6, body: 0.8, neck: 0.3, beak: '#151515', beakLen: 0.06,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 c = mix(vec3(0.42, 0.36, 0.3), vec3(0.78, 0.74, 0.68), smoothstep(0.0, -0.6, n.y));
      float neck = step(0.3, p.x);
      c = mix(c, vec3(0.05), neck);
      float chin = neck * step(0.42, p.y) * smoothstep(-0.1, 0.4, abs(n.z)) * step(0.45, p.x);
      return mix(c, vec3(0.92), chin);    // the white chinstrap
    }`,
  },
  mallard: {
    name: 'mallard', span: 0.9, body: 0.55, beak: '#e0c040', beakLen: 0.05,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 c = mix(vec3(0.55, 0.53, 0.5), vec3(0.75, 0.73, 0.7), smoothstep(0.0, -0.5, n.y));
      c = mix(c, vec3(0.32, 0.18, 0.12), step(0.15, p.x) * step(p.y, 0.06));   // chestnut breast
      return mix(c, vec3(0.03, 0.22, 0.12), step(0.2, p.x) * step(0.06, p.y)); // green head
    }`,
  },
  loon: {
    name: 'loon', span: 1.2, body: 0.8, neck: 0.12, beak: '#0b0b0d', beakLen: 0.08,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 black = vec3(0.03, 0.04, 0.04), white = vec3(0.9);
      // checkerboard of white spots on the back, white belly
      vec2 g = fract(p.xz * vec2(28.0, 24.0)) - 0.5;
      float spot = step(length(g), 0.22) * step(0.0, n.y) * step(p.x, 0.25);
      vec3 c = mix(black, white, max(spot, smoothstep(0.0, -0.5, n.y)));
      // the striped necklace
      float neck = step(0.3, p.x) * step(p.x, 0.36) * step(0.5, fract(p.y * 90.0));
      return mix(c, white, neck * 0.8);
    }`,
  },
};

// ── fish (a smallmouth bass leaping) ────────────────────────────────────────
export function fishSpec(): AnimalSpec {
  return {
    name: 'fish',
    voxel: 0.004,
    bones: [
      { name: 'body', parent: null, at: [0.03, 0, 0] },
      { name: 'tail0', parent: 'body', at: [-0.08, 0, 0] },
    ],
    prims: [
      { kind: 'ellipsoid', bone: 'body', c: [0.02, 0, 0], r: [0.12, 0.05, 0.025], blend: 0.02 },
      { kind: 'ellipsoid', bone: 'tail0', c: [-0.11, 0, 0], r: [0.05, 0.025, 0.012], blend: 0.02 },
      { kind: 'ellipsoid', bone: 'tail0', c: [-0.17, 0, 0], r: [0.025, 0.05, 0.004], blend: 0.015 },
      { kind: 'ellipsoid', bone: 'body', c: [0.0, 0.055, 0], r: [0.07, 0.02, 0.004], blend: 0.01 },
    ],
    roughness: 0.3,
    coat: `vec3 coat(vec3 p, vec3 n) {
      vec3 c = mix(vec3(0.25, 0.3, 0.18), vec3(0.75, 0.72, 0.55), smoothstep(0.2, -0.5, n.y));
      return c * (0.8 + 0.3 * step(0.5, fract(p.x * 25.0)) * step(-0.2, n.y));
    }`,
  };
}
