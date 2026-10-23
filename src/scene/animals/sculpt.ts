// ─────────────────────────────────────────────────────────────────────────────
// Sculpted, skinned animals
//
// Each animal is described the way a sculptor blocks one out: a set of
// rounded primitives (ellipsoids and tapered capsules) for the skull, chest,
// belly, haunches, limb segments, tail…, melted together with a smooth
// union so they become one continuous body with no seams. That signed
// distance field is turned into a mesh once (Surface Nets on a voxel grid,
// vertices projected back onto the surface, normals from the field's
// gradient), then skinned automatically: every primitive belongs to a bone,
// and a vertex is weighted to the bones whose primitives it lies on, with a
// soft fall-off across joints so elbows and hips bend smoothly.
//
// Coat patterns are painted in the shader from the vertex's rest-pose
// position (an extra attribute), so stripes, bellies and socks stay exactly
// where they belong however the bones move. Close-up animals get shell fur:
// a few copies of the skin pushed out along the normal, with strands cut
// out of each shell by a noise threshold that rises toward the tips.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { LAYER_REFLECT } from '../../render/pipeline';

import { buildMeshData, type MeshData, type Prim, type V3 } from './sculptMesh';
export type { Prim } from './sculptMesh';

export interface BoneSpec {
  name: string;
  parent: string | null;
  /** rest position in model space [m] */
  at: V3;
}


export interface AnimalSpec {
  name: string;
  bones: BoneSpec[];
  prims: Prim[];
  /** voxel size for meshing [m] */
  voxel: number;
  /** GLSL body: `vec3 coat(vec3 p, vec3 n)` in rest space (p, n) */
  coat: string;
  roughness?: number;
  /** shell fur: number of shells and fur length [m] (0 = none) */
  fur?: { shells: number; length: number; density: number };
  /** extra non-skinned parts glued to bones (eyes, beaks, antlers) */
  extras?: { bone: string; geo: () => THREE.BufferGeometry; color: string; at: V3; rough?: number; emissive?: string }[];
}

const NOISE3 = /* glsl */ `
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { return 0.55 * n3(p) + 0.3 * n3(p * 2.1) + 0.15 * n3(p * 4.3); }
`;

function coatMaterial(spec: AnimalSpec, shell: number, shells: number) {
  const fur = spec.fur;
  const mat = new THREE.MeshStandardMaterial({ roughness: spec.roughness ?? 0.85 });
  const uShell = { value: shell / Math.max(shells, 1) };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uShell = uShell;
    s.uniforms.uFurLen = { value: fur?.length ?? 0 };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest;\nattribute vec3 aRestN;\nvarying vec3 vRest;\nvarying vec3 vRestN;\nuniform float uShell, uFurLen;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uShell * uFurLen;\nvRest = aRest;\nvRestN = aRestN;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying vec3 vRestN;
        uniform float uShell;
        ${NOISE3}
        ${spec.coat}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 coatCol = coat(vRest, normalize(vRestN));
        ${
          fur && shells > 0
            ? `// strands: thin out toward the tips; roots in the shadow of the fur
        float strand = n3(vRest * ${fur.density.toFixed(1)}) * 0.75 + n3(vRest * ${(fur.density * 2.7).toFixed(1)}) * 0.25;
        if (uShell > 0.0 && strand < uShell * 0.9 + 0.05) discard;
        coatCol *= mix(0.55, 1.08, uShell);`
            : ''
        }
        diffuseColor.rgb = coatCol;`,
      );
  };
  mat.customProgramCacheKey = () => `coat-${spec.name}-${shell > 0 ? 'shell' : 'skin'}`;
  return { mat, uShell };
}

export interface Animal {
  root: THREE.Group;
  bones: Record<string, THREE.Bone>;
  /** rest rotations are identity; poses are set on bone.quaternion / rotation */
  reset(): void;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const pending = new Map<string, Promise<void>>();
let worker: Worker | null = null;
let jobId = 0;
const jobs = new Map<number, (d: MeshData) => void>();

function toGeometry(m: MeshData) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  geo.setAttribute('aRest', new THREE.BufferAttribute(m.pos.slice(), 3));
  geo.setAttribute('aRestN', new THREE.BufferAttribute(m.nrm.slice(), 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(m.si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(m.sw, 4));
  geo.setIndex(new THREE.BufferAttribute(m.index, 1));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Mesh a species in the background (a Web Worker) so the page never
 * stutters; resolves once sculpt() can build it instantly.
 */
export function prepare(spec: AnimalSpec): Promise<void> {
  if (geoCache.has(spec.name)) return Promise.resolve();
  let p = pending.get(spec.name);
  if (p) return p;
  p = new Promise<void>((resolve) => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./sculptWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<{ id: number; data: MeshData }>) => {
          jobs.get(e.data.id)?.(e.data.data);
          jobs.delete(e.data.id);
        };
      }
      const id = ++jobId;
      jobs.set(id, (d) => {
        geoCache.set(spec.name, toGeometry(d));
        resolve();
      });
      worker.postMessage({ id, spec: { name: spec.name, bones: spec.bones.map((b) => ({ name: b.name })), prims: spec.prims, voxel: spec.voxel } });
    } catch {
      // no workers: build here instead
      geoCache.set(spec.name, toGeometry(buildMeshData(spec)));
      resolve();
    }
  });
  pending.set(spec.name, p);
  return p;
}

/** Build (meshing once per species) and return a posable animal. */
export function sculpt(spec: AnimalSpec, quality: 'full' | 'low' = 'full'): Animal {
  let geo = geoCache.get(spec.name);
  if (!geo) {
    geo = toGeometry(buildMeshData(spec));
    geoCache.set(spec.name, geo);
  }
  // skeleton
  const bones: Record<string, THREE.Bone> = {};
  const list: THREE.Bone[] = [];
  for (const b of spec.bones) {
    const bone = new THREE.Bone();
    bone.name = b.name;
    const parent = b.parent ? spec.bones.find((x) => x.name === b.parent)! : null;
    bone.position.set(b.at[0] - (parent?.at[0] ?? 0), b.at[1] - (parent?.at[1] ?? 0), b.at[2] - (parent?.at[2] ?? 0));
    if (b.parent) bones[b.parent].add(bone);
    bones[b.name] = bone;
    list.push(bone);
  }
  const root = new THREE.Group();
  root.add(list[0]);
  // the bones must have their world matrices before the skeleton records
  // its inverse bind matrices
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const shells = quality === 'full' ? (spec.fur?.shells ?? 0) : Math.min(spec.fur?.shells ?? 0, 3);
  for (let s = 0; s <= shells; s++) {
    const { mat } = coatMaterial(spec, s, shells);
    const m = new THREE.SkinnedMesh(geo, mat);
    m.bind(skeleton);
    m.frustumCulled = false;
    m.castShadow = s === 0;
    m.receiveShadow = s === 0;
    m.layers.enable(LAYER_REFLECT);
    root.add(m);
  }
  // rigid extras (eyes, nose, beak…) ride on their bones
  for (const x of spec.extras ?? []) {
    const bone = bones[x.bone];
    const bs = spec.bones.find((b) => b.name === x.bone)!;
    const mm = new THREE.Mesh(
      x.geo(),
      new THREE.MeshStandardMaterial({ color: x.color, roughness: x.rough ?? 0.4, ...(x.emissive ? { emissive: new THREE.Color(x.emissive) } : {}) }),
    );
    mm.position.set(x.at[0] - bs.at[0], x.at[1] - bs.at[1], x.at[2] - bs.at[2]);
    mm.castShadow = true;
    mm.layers.enable(LAYER_REFLECT);
    bone.add(mm);
  }
  const reset = () => list.forEach((b) => b.quaternion.identity());
  return { root, bones, reset };
}

/** Rotate a bone by Euler angles (x, y, z) relative to its rest pose. */
export function pose(b: THREE.Bone | undefined, x = 0, y = 0, z = 0) {
  if (b) b.rotation.set(x, y, z);
}
