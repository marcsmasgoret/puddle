// Ground around the puddle and the puddle bed beneath the water.
//
// Both use MeshStandardMaterial (so they get real lighting, shadows and the
// sky environment) with procedural colour injected. Two physical effects are
// added on top:
//   • Wet ring: soil next to the water is soaked. Water fills the pores, which
//     lowers the refractive-index contrast at grain surfaces so less light
//     scatters back out: wet soil is darker and glossier.
//   • Caustics: on the bed, the direct sunlight is multiplied by the caustic
//     intensity computed from the wave surface (caustics.ts).
import * as THREE from 'three';
import { NOISE } from './glsl';
import type { ShallowWaterSolver } from '../physics/solver';
import { WETMAP_SIZE } from './wetmap';

export interface GroundStyle {
  moss: THREE.Color;
  earth: THREE.Color;
  stone: THREE.Color;
  litter: THREE.Color;
  mud: THREE.Color;
}

export const FOREST_GROUND: GroundStyle = {
  moss: new THREE.Color('#5f7336'),
  earth: new THREE.Color('#6a5639'),
  stone: new THREE.Color('#8a877b'),
  litter: new THREE.Color('#7b5634'),
  mud: new THREE.Color('#7a6a52'),
};

export function createGroundMaterial(
  solver: ShallowWaterSolver,
  caustics: THREE.Texture,
  wetMap: THREE.Texture,
  style: GroundStyle,
  bed: boolean,
) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.45 });
  if (bed) mat.defines = { BED: '' };
  // ground and bed share the same patch code, so give them distinct shader
  // cache keys or Three.js would compile one program for both
  mat.customProgramCacheKey = () => (bed ? 'puddle-bed' : 'puddle-ground');
  const uniforms = {
    uShape: { value: solver.shapeTexture },
    uCaustics: { value: caustics },
    uWetMap: { value: wetMap },
    uWetSize: { value: new THREE.Vector2(...WETMAP_SIZE) },
    uStain: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    uWets: { value: 1 },
    uRingRough: { value: 0.78 },
    uOrigin: { value: new THREE.Vector2(...solver.origin) },
    uExtent: { value: new THREE.Vector2(...solver.extent) },
    uMoss: { value: style.moss },
    uEarth: { value: style.earth },
    uStone: { value: style.stone },
    uLitter: { value: style.litter },
    uMud: { value: style.mud },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vWPos;
        uniform sampler2D uShape, uCaustics, uWetMap;
        uniform vec2 uOrigin, uExtent, uWetSize;
        uniform vec3 uStain;
        uniform float uWets, uRingRough;
        uniform vec3 uMoss, uEarth, uStone, uLitter, uMud;
        ${NOISE}
        float gWet; float gGloss; float gSdf; vec2 gUv;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        gUv = (vWPos.xz - uOrigin) / uExtent;
        bool inDomain = all(greaterThan(gUv, vec2(0.0))) && all(lessThan(gUv, vec2(1.0)));
        gSdf = inDomain ? texture2D(uShape, gUv).r : 1.0;
        // The bed mesh covers the simulation area plus a 0.5 m apron at ground
        // level; the big ground plane has a rectangular hole 0.25 m inside the
        // apron. Where they overlap both are flat at y = 0 and shaded by the
        // same code, so the seam is invisible and can never crack open.
        #ifndef BED
          if (all(greaterThan(vWPos.xz, uOrigin - 0.25)) && all(lessThan(vWPos.xz, uOrigin + uExtent + 0.25))) discard;
        #endif
        vec2 p = vWPos.xz;
        // forest floor: soft moss with gentle patches of earth and needle
        // litter (low contrast, in keeping with the calm art style)
        float m = fbm(p * 0.9);
        float fine = vnoise(p * 38.0) * 0.6 + vnoise(p * 90.0) * 0.4;
        vec3 col = mix(uEarth, uMoss, 0.55 + 0.45 * smoothstep(0.35, 0.7, m));
        col = mix(col, uLitter, smoothstep(0.6, 0.85, fbm(p * 2.3 + 9.0)) * 0.35);
        col *= 0.88 + 0.24 * fine;
        // puddle bed: silt with scattered, irregular gravel. Its fine texture
        // is what lets you see the refraction wobble.
        vec2 gw = vec2(vnoise(p * 30.0), vnoise(p * 30.0 + 7.0)) * 0.6;
        vec3 g = voronoi(p * 22.0 + gw);
        float gravel = smoothstep(0.34, 0.2, g.x) * step(0.55, g.z);
        vec3 bed = uMud * (0.8 + 0.4 * vnoise(p * 14.0)) * (0.9 + 0.2 * fine);
        bed = mix(bed, uStone * (0.55 + 0.45 * g.z) * (0.85 + 0.3 * fine), gravel * 0.7);
        bed = mix(bed, uMoss * 0.8, smoothstep(0.55, 0.8, m) * 0.35);
        float underwater = 1.0 - smoothstep(-0.03, 0.0, gSdf);
        col = mix(col, bed, underwater);
        // wet ring: width varies along the edge
        float ring = 0.035 + 0.06 * vnoise(p * 4.0);
        gWet = (1.0 - smoothstep(0.0, ring, gSdf)) * uWets;
        // splashes that landed on the ground (drying over time)
        vec2 wuv = vec2(vWPos.x / uWetSize.x + 0.5, 0.5 - vWPos.z / uWetSize.y);
        if (all(greaterThan(wuv, vec2(0.0))) && all(lessThan(wuv, vec2(1.0))))
          gWet = max(gWet, texture2D(uWetMap, wuv).r * 0.9);
        // Under water there is no air–film sheen: the stone–water interface
        // reflects very little, so the glossiness applies only above water.
        gGloss = gWet * smoothstep(-0.004, 0.004, gSdf);
        // soaked ground: water darkens it (≈ half the albedo), honey leaves an
        // amber film, oobleck a pale starch crust; mercury doesn't wet at all
        col *= mix(vec3(1.0), uStain, gWet);
        col = min(col, vec3(1.0));
        diffuseColor.rgb = col;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uRingRough, gGloss);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        #ifdef BED
          // caustics only modulate direct sunlight on the bed
          reflectedLight.directDiffuse *= mix(vec3(1.0), texture2D(uCaustics, gUv).rgb, step(gSdf, 0.0));
        #endif`,
      );
  };
  mat.userData.uniforms = uniforms;
  return mat;
}

/** Point the wet ring / splat stains at the current fluid. */
export function applyGroundFluid(mat: THREE.Material, stain: [number, number, number], wets: boolean, ringRough: number) {
  const u = mat.userData.uniforms;
  u.uStain.value.set(...stain);
  u.uWets.value = wets ? 1 : 0;
  u.uRingRough.value = ringRough;
}

/** Flat ground (large plane) with the puddle cut out. */
export function createGround(material: THREE.Material) {
  const geo = new THREE.PlaneGeometry(6000, 6000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function bilinear(data: Float32Array, nx: number, nz: number, fi: number, fj: number) {
  const i0 = Math.max(0, Math.min(nx - 2, Math.floor(fi)));
  const j0 = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
  const ti = Math.max(0, Math.min(1, fi - i0)), tj = Math.max(0, Math.min(1, fj - j0));
  const at = (i: number, j: number) => data[(j * nx + i) * 4];
  return (
    (at(i0, j0) * (1 - ti) + at(i0 + 1, j0) * ti) * (1 - tj) +
    (at(i0, j0 + 1) * (1 - ti) + at(i0 + 1, j0 + 1) * ti) * tj
  );
}

const BED_APRON = 0.5; // [m] flat ground-level margin around the simulation area

/** The bed: a grid over the domain pushed down to y = −H(x, z). */
export function createBed(solver: ShallowWaterSolver, material: THREE.Material) {
  const { nx, nz } = solver.grid;
  const [ox, oz] = solver.origin;
  const [ex, ez] = solver.extent;
  // ~9 mm triangles over the puddle (plus the apron, which is flat)
  const W = ex + 2 * BED_APRON, D = ez + 2 * BED_APRON;
  const sx = Math.ceil(W / 0.009), sz = Math.ceil(D / 0.009);
  const geo = new THREE.PlaneGeometry(W, D, sx, sz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const data = solver.shape.data;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k) + ox + ex / 2;
    const z = pos.getZ(k) + oz + ez / 2;
    pos.setXYZ(k, x, -bilinear(data, nx, nz, (x - ox) / ex * nx - 0.5, (z - oz) / ez * nz - 0.5), z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}
