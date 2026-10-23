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
        uniform sampler2D uShape, uCaustics;
        uniform vec2 uOrigin, uExtent;
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
        // The bed mesh continues 6 cm past the edge at ground level and the
        // ground mesh starts 2 cm out. In the overlap both are flat at y = 0
        // and shaded identically, so there is no crack at the seam.
        #ifdef BED
          if (gSdf > 0.06) discard;
        #else
          if (gSdf < 0.02) discard;
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
        gWet = 1.0 - smoothstep(0.0, ring, gSdf);
        // Under water there is no air–film sheen: the stone–water interface
        // reflects very little, so the glossiness applies only above water.
        gGloss = gWet * smoothstep(-0.004, 0.004, gSdf);
        // soaked ground is darker (roughly half the albedo) and glossier
        col *= mix(1.0, 0.5, gWet);
        diffuseColor.rgb = col;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, gGloss);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `#include <lights_fragment_end>
        #ifdef BED
          // caustics only modulate direct sunlight on the bed
          reflectedLight.directDiffuse *= mix(1.0, texture2D(uCaustics, gUv).r, step(gSdf, 0.0));
        #endif`,
      );
  };
  return mat;
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

/** The bed: a grid over the domain pushed down to y = −H(x, z). */
export function createBed(solver: ShallowWaterSolver, material: THREE.Material) {
  const { nx, nz } = solver.grid;
  const [ox, oz] = solver.origin;
  const [ex, ez] = solver.extent;
  // ~9 mm triangles, fine enough that the bed is flat by the overlap zone
  const sx = Math.ceil(ex / 0.009), sz = Math.ceil(ez / 0.009);
  const geo = new THREE.PlaneGeometry(ex, ez, sx, sz);
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
