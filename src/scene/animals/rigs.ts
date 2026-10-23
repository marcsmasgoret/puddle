// Simple articulated animals, built from smooth primitives. Each rig is a
// hierarchy of pivots that the behaviours pose every frame (legs swing,
// hips wiggle, tails curl, heads turn). Sizes are real: the cat's body is
// ~45 cm long, the mouse ~7 cm.
import * as THREE from 'three';
import { LAYER_REFLECT } from '../../render/pipeline';
import { NOISE } from '../../render/glsl';

const sphere = (r: number, sx = 1, sy = 1, sz = 1, seg = 18) => {
  const g = new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2));
  g.scale(sx, sy, sz);
  return g;
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.layers.enable(LAYER_REFLECT);
  return m;
}

// ── the cat ─────────────────────────────────────────────────────────────────
/**
 * Tabby coat: grey with black mackerel stripes over the back and flanks,
 * white chest, muzzle and paws. Evaluated in the cat's own body frame (so
 * the stripes stay put as the limbs move) via the root's inverse matrix.
 */
export function tabbyMaterial() {
  const uRootInv = { value: new THREE.Matrix4() };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  mat.onBeforeCompile = (s) => {
    s.uniforms.uRootInv = uRootInv;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uRootInv;\nvarying vec3 vCat;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCat = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCat;\n${NOISE}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 p = vCat;
        vec3 grey = vec3(0.47, 0.46, 0.44);
        vec3 dark = vec3(0.09, 0.09, 0.1);
        vec3 white = vec3(0.92, 0.91, 0.88);
        // mackerel stripes run around the body, wavy, stronger on top
        float wav = vnoise(p.xz * 18.0) * 0.6 + vnoise(p.xy * 25.0) * 0.4;
        float stripe = smoothstep(0.35, 0.6, sin(p.x * 95.0 + wav * 5.0) * 0.5 + 0.5);
        stripe *= smoothstep(0.08, 0.2, p.y);
        // a dark spine line, tail rings
        stripe = max(stripe, smoothstep(0.02, 0.0, abs(p.z)) * step(0.18, p.y));
        vec3 col = mix(grey, dark, stripe * 0.85);
        // white socks, chest and muzzle
        float w = 1.0 - smoothstep(0.04, 0.07, p.y);
        w = max(w, smoothstep(0.12, 0.2, p.x) * (1.0 - smoothstep(0.15, 0.24, p.y)));
        w = max(w, smoothstep(0.31, 0.34, p.x) * (1.0 - smoothstep(0.25, 0.3, p.y)));
        col = mix(col, white, clamp(w, 0.0, 1.0));
        diffuseColor.rgb = col;`,
      );
  };
  mat.customProgramCacheKey = () => 'tabby';
  return { mat, uRootInv };
}

export interface Leg {
  hip: THREE.Object3D;
  knee: THREE.Object3D;
}

export interface CatRig {
  root: THREE.Group;
  torso: THREE.Group;
  hips: THREE.Group;
  head: THREE.Group;
  frontLegs: Leg[];
  backLegs: Leg[];
  tail: THREE.Object3D[];
  ears: THREE.Object3D[];
  uRootInv: { value: THREE.Matrix4 };
}

function leg(mat: THREE.Material, upper: number, lower: number, r: number): Leg {
  const hip = new THREE.Group();
  const up = mesh(new THREE.CylinderGeometry(r * 1.2, r, upper, 8).translate(0, -upper / 2, 0), mat);
  hip.add(up);
  const knee = new THREE.Group();
  knee.position.y = -upper;
  const lo = mesh(new THREE.CylinderGeometry(r, r * 0.85, lower, 8).translate(0, -lower / 2, 0), mat);
  const paw = mesh(sphere(r * 1.25, 1.4, 0.7, 1.1, 10), mat);
  paw.position.set(r * 0.5, -lower, 0);
  knee.add(lo, paw);
  hip.add(knee);
  return { hip, knee };
}

export function buildCat(): CatRig {
  const { mat, uRootInv } = tabbyMaterial();
  const root = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.y = 0.23;
  root.add(torso);
  const chest = mesh(sphere(0.1, 1.15, 1, 0.85), mat);
  chest.position.x = 0.11;
  const belly = mesh(sphere(0.1, 1.7, 0.9, 0.8), mat);
  belly.position.x = -0.03;
  torso.add(chest, belly);
  const hips = new THREE.Group();
  hips.position.x = -0.15;
  torso.add(hips);
  const haunch = mesh(sphere(0.095, 1.2, 1, 0.9), mat);
  hips.add(haunch);
  const backLegs = [-1, 1].map((s) => {
    const l = leg(mat, 0.12, 0.12, 0.02);
    l.hip.position.set(-0.01, -0.03, s * 0.05);
    hips.add(l.hip);
    return l;
  });
  const frontLegs = [-1, 1].map((s) => {
    const l = leg(mat, 0.11, 0.11, 0.018);
    l.hip.position.set(0.16, -0.05, s * 0.045);
    torso.add(l.hip);
    return l;
  });
  // tail: a chain of segments that can curl
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = hips;
  for (let k = 0; k < 7; k++) {
    const seg = new THREE.Group();
    seg.position.set(k === 0 ? -0.09 : -0.045, k === 0 ? 0.03 : 0, 0);
    const piece = mesh(new THREE.CylinderGeometry(0.014 - k * 0.0012, 0.016 - k * 0.0012, 0.05, 6).rotateZ(Math.PI / 2).translate(-0.022, 0, 0), mat);
    seg.add(piece);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  const head = new THREE.Group();
  head.position.set(0.24, 0.08, 0);
  torso.add(head);
  const skull = mesh(sphere(0.06, 1.05, 0.92, 1), mat);
  const muzzle = mesh(sphere(0.03, 1, 0.8, 1.2), mat);
  muzzle.position.set(0.05, -0.02, 0);
  head.add(skull, muzzle);
  const ears = [-1, 1].map((s) => {
    const e = mesh(new THREE.ConeGeometry(0.022, 0.045, 4), mat);
    e.position.set(0.0, 0.058, s * 0.032);
    e.rotation.x = s * -0.25;
    head.add(e);
    return e;
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#c9b84a', roughness: 0.2, emissive: new THREE.Color('#3a3a10') });
  for (const s of [-1, 1]) {
    const eye = mesh(sphere(0.009), eyeMat);
    eye.position.set(0.052, 0.012, s * 0.024);
    head.add(eye);
  }
  const nose = mesh(sphere(0.006), new THREE.MeshStandardMaterial({ color: '#c98a8a' }));
  nose.position.set(0.081, -0.008, 0);
  head.add(nose);
  return { root, torso, hips, head, frontLegs, backLegs, tail, ears, uRootInv };
}

// ── the mouse ───────────────────────────────────────────────────────────────
export interface MouseRig {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Object3D[];
  tail: THREE.Object3D[];
  head: THREE.Object3D;
}

export function buildMouse(): MouseRig {
  const fur = new THREE.MeshStandardMaterial({ color: '#7d6d60', roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: '#d9a0a0', roughness: 0.6 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.022;
  root.add(body);
  body.add(mesh(sphere(0.022, 1.6, 1, 1.05, 14), fur));
  const head = new THREE.Group();
  head.position.set(0.034, 0.004, 0);
  const skull = mesh(sphere(0.014, 1.5, 1, 1, 12), fur);
  const nose = mesh(sphere(0.003), pink);
  nose.position.set(0.021, -0.001, 0);
  head.add(skull, nose);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.CircleGeometry(0.008, 10), pink);
    ear.material = pink.clone();
    (ear.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    ear.position.set(-0.002, 0.012, s * 0.009);
    ear.rotation.y = Math.PI / 2 - s * 0.4;
    head.add(ear);
  }
  body.add(head);
  const legs = [0, 1, 2, 3].map((k) => {
    const l = new THREE.Group();
    l.position.set(k < 2 ? 0.018 : -0.016, -0.012, (k % 2 ? 1 : -1) * 0.011);
    l.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 5).translate(0, -0.006, 0), pink));
    body.add(l);
    return l;
  });
  const tail: THREE.Object3D[] = [];
  let parent: THREE.Object3D = body;
  for (let k = 0; k < 6; k++) {
    const seg = new THREE.Group();
    seg.position.set(k === 0 ? -0.034 : -0.012, 0, 0);
    seg.add(mesh(new THREE.CylinderGeometry(0.0018, 0.0022, 0.012, 4).rotateZ(Math.PI / 2).translate(-0.006, 0, 0), pink));
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }
  return { root, body, legs, tail, head };
}

// ── wildlife: small, simple, mostly seen at a distance ──────────────────────
export function buildBird(color: string, span: number) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const root = new THREE.Group();
  const body = mesh(sphere(span * 0.09, 2.6, 0.9, 0.9, 10), mat);
  root.add(body);
  const head = mesh(sphere(span * 0.06, 1, 1, 1, 8), mat);
  head.position.x = span * 0.26;
  root.add(head);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    const w = new THREE.Shape();
    w.moveTo(span * 0.1, 0);
    w.lineTo(-span * 0.12, 0);
    w.lineTo(-span * 0.05, span * 0.5);
    w.lineTo(span * 0.06, span * 0.42);
    const g = new THREE.ShapeGeometry(w);
    g.rotateX(s * Math.PI / 2);
    const wing = mesh(g, mat);
    pivot.add(wing);
    root.add(pivot);
    return pivot;
  });
  return { root, wings, side: [-1, 1] };
}

export function buildQuadruped(o: { len: number; height: number; color: string; belly?: string; neck?: number; legR: number; tail?: 'bushy' | 'puff' | 'long'; ears?: number }) {
  const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.9 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: o.belly ?? o.color, roughness: 0.9 });
  const root = new THREE.Group();
  const torso = new THREE.Group();
  torso.position.y = o.height;
  root.add(torso);
  torso.add(mesh(sphere(o.len * 0.28, 1.8, 0.85, 0.75), mat));
  const under = mesh(sphere(o.len * 0.24, 1.6, 0.6, 0.65), bellyMat);
  under.position.y = -o.len * 0.06;
  torso.add(under);
  const legLen = o.height;
  const legs = [0, 1, 2, 3].map((k) => {
    const hip = new THREE.Group();
    hip.position.set((k < 2 ? 1 : -1) * o.len * 0.32, -o.len * 0.05, (k % 2 ? 1 : -1) * o.len * 0.12);
    hip.add(mesh(new THREE.CylinderGeometry(o.legR, o.legR * 0.7, legLen, 6).translate(0, -legLen / 2, 0), mat));
    torso.add(hip);
    return hip;
  });
  const neck = new THREE.Group();
  neck.position.set(o.len * 0.45, o.len * 0.05, 0);
  torso.add(neck);
  const nl = o.neck ?? o.len * 0.2;
  const neckMesh = mesh(new THREE.CylinderGeometry(o.len * 0.07, o.len * 0.1, nl, 8).translate(0, nl / 2, 0), mat);
  neckMesh.rotation.z = -0.5;
  neck.add(neckMesh);
  const head = new THREE.Group();
  head.position.set(nl * 0.5, nl * 0.85, 0);
  neck.add(head);
  head.add(mesh(sphere(o.len * 0.11, 1.5, 0.9, 0.9), mat));
  if (o.ears) {
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.ConeGeometry(o.len * 0.035, o.ears, 5), mat);
      e.position.set(-o.len * 0.03, o.ears * 0.5, s * o.len * 0.05);
      e.rotation.x = s * -0.3;
      head.add(e);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(-o.len * 0.48, o.len * 0.05, 0);
  torso.add(tail);
  if (o.tail === 'bushy') tail.add(mesh(sphere(o.len * 0.2, 1.8, 0.7, 0.7), mat).translateX(-o.len * 0.2));
  else if (o.tail === 'puff') tail.add(mesh(sphere(o.len * 0.09), bellyMat));
  else if (o.tail === 'long') tail.add(mesh(sphere(o.len * 0.15, 2.4, 0.5, 0.5), mat).translateX(-o.len * 0.25));
  return { root, torso, legs, neck, head, tail };
}

export function buildFish() {
  const mat = new THREE.MeshStandardMaterial({ color: '#8f9aa0', roughness: 0.3, metalness: 0.3 });
  const root = new THREE.Group();
  root.add(mesh(sphere(0.05, 2.4, 0.9, 0.5), mat));
  const t = mesh(new THREE.ConeGeometry(0.04, 0.06, 4).rotateZ(Math.PI / 2), mat);
  t.position.x = -0.13;
  root.add(t);
  return root;
}
