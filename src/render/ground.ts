// Ground around the puddle and the puddle bed beneath the water.
//
// Both use MeshStandardMaterial (real lighting, shadows and the sky
// environment) with procedural colour injected. Each location has its own
// ground pattern (moss, sand, asphalt, pool tile, dock planks, park grass,
// Canadian Shield granite, shoreline pebbles), with seasonal overlays (snow,
// fallen leaves, spring green) and two physical effects:
//   • Wet ground: water fills the pores between grains, lowering the
//     refractive-index contrast at their surfaces, so less light scatters
//     back out: wet ground is darker and glossier. Applied in a ring around
//     the puddle, where splashes land, and everywhere when it rains.
//   • Caustics: on the bed, the direct sunlight is multiplied by the caustic
//     intensity computed from the wave surface (caustics.ts).
import * as THREE from 'three';
import { NOISE } from './glsl';
import type { ShallowWaterSolver } from '../physics/solver';
import { WETMAP_SIZE } from './wetmap';

export type GroundStyleId = 'forest' | 'sand' | 'asphalt' | 'tile' | 'planks' | 'park' | 'granite' | 'shore';
const STYLE_INDEX: Record<GroundStyleId, number> = { forest: 0, sand: 1, asphalt: 2, tile: 3, planks: 4, park: 5, granite: 6, shore: 7 };

export interface GroundLook {
  style: GroundStyleId;
  /** main, secondary and accent colours of the ground pattern */
  a: string;
  b: string;
  c: string;
  /** puddle bed colours */
  bed: string;
  bedAccent: string;
}

export interface SeasonLook {
  /** 0…1 snow cover */
  snow: number;
  /** 0…1 fallen leaves */
  leaves: number;
  /** grass tint multiplier (spring bright, autumn straw, winter dull) */
  grass: [number, number, number];
}

export function createGroundMaterial(solver: ShallowWaterSolver, caustics: THREE.Texture, wetMap: THREE.Texture, bed: boolean) {
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
    uStyle: { value: 0 },
    uA: { value: new THREE.Color() },
    uB: { value: new THREE.Color() },
    uC: { value: new THREE.Color() },
    uBed: { value: new THREE.Color() },
    uBedAccent: { value: new THREE.Color() },
    uSnow: { value: 0 },
    uLeaves: { value: 0 },
    uGrass: { value: new THREE.Vector3(1, 1, 1) },
    uRain: { value: 0 },
    uPrints: { value: null as THREE.Texture | null },
    uPrintsArea: { value: new THREE.Vector4(-8, -9, 16, 9) },
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
        uniform vec3 uStain, uA, uB, uC, uBed, uBedAccent, uGrass;
        uniform float uWets, uRingRough, uSnow, uLeaves, uRain;
        uniform sampler2D uPrints;
        uniform vec4 uPrintsArea;
        uniform int uStyle;
        ${NOISE}
        float gWet; float gGloss; float gSdf; vec2 gUv; float gSnow;

        // ── ground patterns, one per location ─────────────────────────────
        vec3 groundColor(vec2 p, float fine) {
          if (uStyle == 0) {            // forest: soft moss over earth, needle litter
            float m = fbm(p * 0.9);
            vec3 col = mix(uA, uB * uGrass, 0.55 + 0.45 * smoothstep(0.35, 0.7, m));
            return mix(col, uC, smoothstep(0.6, 0.85, fbm(p * 2.3 + 9.0)) * 0.35);
          } else if (uStyle == 1) {     // sand: wind ripples and darker patches
            float r = sin((p.x * 0.6 + p.y + fbm(p * 0.7) * 2.0) * 32.0) * 0.5 + 0.5;
            vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, fbm(p * 0.6)) * 0.5);
            return col * (0.93 + 0.07 * r);
          } else if (uStyle == 2) {     // asphalt: aggregate speckle, tar patches, a lane line
            vec3 col = uA * (0.85 + 0.3 * vnoise(p * 140.0)) * (0.9 + 0.2 * fbm(p * 0.8));
            col = mix(col, uA * 0.6, smoothstep(0.65, 0.75, fbm(p * 1.7 + 3.0)) * 0.6);
            return col;
          } else if (uStyle == 3) {     // pool deck: square pavers with grout
            vec2 t = fract(p / 0.3);
            float grout = 1.0 - smoothstep(0.0, 0.02, min(min(t.x, t.y), min(1.0 - t.x, 1.0 - t.y)));
            vec3 col = uA * (0.92 + 0.12 * hash12(floor(p / 0.3)));
            return mix(col, uC, grout);
          } else if (uStyle == 4) {     // dock planks running along x
            float w = 0.14;
            float row = floor(p.y / w);
            float gap = 1.0 - smoothstep(0.0, 0.012, min(fract(p.y / w), 1.0 - fract(p.y / w)) * w);
            float grain = vnoise(vec2(p.x * 3.0, p.y * 60.0) + row * 7.0);
            vec3 col = mix(uA, uB, 0.3 + 0.5 * hash12(vec2(row, 1.0)) ) * (0.85 + 0.25 * grain);
            float knot = smoothstep(0.06, 0.0, length(vec2(fract(p.x * 0.7 + row * 0.37) - 0.5, (fract(p.y / w) - 0.5) * 0.3)));
            return mix(mix(col, uC * 0.8, knot * 0.5), uC * 0.35, gap);
          } else if (uStyle == 5) {     // park lawn
            float m = fbm(p * 0.5);
            vec3 col = mix(uA, uB, smoothstep(0.3, 0.7, m)) * uGrass;
            return col * (0.9 + 0.2 * vnoise(p * 60.0));
          } else if (uStyle == 6) {     // Canadian Shield granite: pink feldspar, quartz, biotite, lichen
            vec3 col = mix(uA, uB, smoothstep(0.35, 0.65, fbm(p * 1.2)));
            float g = vnoise(p * 180.0);
            col = mix(col, vec3(0.9, 0.88, 0.85), step(0.82, g) * 0.5);   // quartz
            col = mix(col, vec3(0.12), step(0.9, vnoise(p * 210.0 + 5.0)) * 0.6); // biotite
            float lichen = smoothstep(0.62, 0.7, fbm(p * 3.0 + 11.0));
            return mix(col, uC, lichen * 0.6);
          } else {                       // shoreline: small rounded pebbles in sand
            vec2 pw = vec2(vnoise(p * 12.0), vnoise(p * 12.0 + 3.0)) * 0.4;
            vec3 v = voronoi(p * 18.0 + pw);
            float peb = smoothstep(0.4, 0.28, v.x) * smoothstep(0.25, 0.6, fbm(p * 0.7));
            vec3 stone = mix(uA, uB, v.z) * (0.9 + 0.15 * fine);
            return mix(uC * (0.92 + 0.15 * fine), stone, peb * 0.75);
          }
        }
        vec3 bedColor(vec2 p, float fine) {
          if (uStyle == 3) {             // pool: small blue mosaic tiles
            vec2 t = fract(p / 0.025);
            float grout = 1.0 - smoothstep(0.0, 0.12, min(min(t.x, t.y), min(1.0 - t.x, 1.0 - t.y)));
            vec3 col = uBed * (0.85 + 0.3 * hash12(floor(p / 0.025)));
            return mix(col, uBedAccent, grout * 0.7);
          }
          if (uStyle == 4) return groundColor(p, fine) * 0.9;   // a puddle on the planks
          if (uStyle == 2) return groundColor(p, fine) * 0.95;  // on the asphalt
          // natural beds: silt with scattered, irregular gravel. Its texture is
          // what makes the refraction wobble visible.
          vec2 gw = vec2(vnoise(p * 30.0), vnoise(p * 30.0 + 7.0)) * 0.6;
          vec3 g = voronoi(p * 22.0 + gw);
          float gravel = smoothstep(0.34, 0.2, g.x) * step(0.55, g.z);
          vec3 b = uBed * (0.8 + 0.4 * vnoise(p * 14.0)) * (0.9 + 0.2 * fine);
          return mix(b, uBedAccent * (0.55 + 0.45 * g.z) * (0.85 + 0.3 * fine), gravel * 0.7);
        }`,
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
        float fine = vnoise(p * 38.0) * 0.6 + vnoise(p * 90.0) * 0.4;
        vec3 col = groundColor(p, fine);
        // fallen leaves (autumn): scattered blots in warm colours
        if (uLeaves > 0.0) {
          // drifts of leaves: small, varied, gathered in patches
          float leafPatch = smoothstep(0.3, 0.7, fbm(p * 0.8 + 2.0));
          // fewer on swept surfaces (street, deck, dock) than on the ground
          float amt = uLeaves * ((uStyle == 2 || uStyle == 3 || uStyle == 4) ? 0.3 : 1.0);
          // each grid cell may hold one leaf: random position, angle, size
          // and colour; the shape is an ellipse pinched to a point at both
          // ends, with a darker midrib
          vec2 lp = p * 14.0;
          vec2 cell = floor(lp);
          float leaf = 0.0, rib = 0.0;
          vec3 lc = vec3(0.0);
          for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 c = cell + vec2(float(i), float(j));
            float h = hash12(c);
            if (h > amt * (0.25 + 0.85 * leafPatch)) continue;
            float h2 = hash12(c + 17.3), h3 = hash12(c + 41.9);
            vec2 q = lp - c - vec2(hash12(c + 3.1), hash12(c + 8.7));
            float a = h2 * 6.2832;
            q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
            float L = 0.38 + 0.22 * h3;               // half-length (cells)
            float w = L * (0.42 + 0.12 * h2) * (1.0 - smoothstep(0.2, 1.0, abs(q.x) / L) * 0.85);
            float inside = smoothstep(0.03, 0.0, abs(q.y) - w) * step(abs(q.x), L);
            if (inside > leaf) {
              leaf = inside;
              rib = smoothstep(0.035, 0.0, abs(q.y)) * step(abs(q.x), L * 0.9);
              // maple red, burnt orange, ochre, faded brown
              float t = fract(h3 * 7.3);
              lc = t < 0.25 ? vec3(0.58, 0.15, 0.07) : t < 0.55 ? vec3(0.72, 0.32, 0.08) : t < 0.8 ? vec3(0.7, 0.48, 0.12) : vec3(0.38, 0.23, 0.12);
              lc *= 0.75 + 0.3 * hash12(c + 5.5);
            }
          }
          // far away a leaf is smaller than a few pixels: blend toward the
          // average colour of the litter instead of shimmering
          float far = smoothstep(0.06, 0.2, length(fwidth(lp)));
          vec3 nearCol = mix(col, mix(lc, lc * 0.6, rib * 0.5), leaf);
          float cover = clamp(amt * (0.25 + 0.85 * leafPatch), 0.0, 1.0) * 0.4;
          col = mix(nearCol, mix(col, vec3(0.6, 0.31, 0.1), cover), far);
        }
        col *= 0.88 + 0.24 * fine;
        float underwater = 1.0 - smoothstep(-0.03, 0.0, gSdf);
        col = mix(col, bedColor(p, fine), underwater);
        // wet ring: width varies along the edge
        float ring = 0.035 + 0.06 * vnoise(p * 4.0);
        gWet = (1.0 - smoothstep(0.0, ring, gSdf)) * uWets;
        // splashes that landed on the ground (drying over time)
        vec2 wuv = vec2(vWPos.x / uWetSize.x + 0.5, 0.5 - vWPos.z / uWetSize.y);
        if (all(greaterThan(wuv, vec2(0.0))) && all(lessThan(wuv, vec2(1.0))))
          gWet = max(gWet, texture2D(uWetMap, wuv).r * 0.9);
        // rain wets everything
        gWet = max(gWet, uRain * 0.85);
        // Under water there is no air–film sheen: the stone–water interface
        // reflects very little, so the glossiness applies only above water.
        gGloss = gWet * smoothstep(-0.004, 0.004, gSdf);
        col *= mix(vec3(1.0), uStain, gWet);
        // snow cover: thinner near the water (meltwater) and patchy at the edges
        gSnow = uSnow * smoothstep(0.05, 0.25, gSdf) * smoothstep(0.25, 0.45, fbm(p * 1.5) + uSnow * 0.5);
        // footprints pressed into the snow: shadowed blue-grey hollows
        vec2 puv = vec2((vWPos.x - uPrintsArea.x) / uPrintsArea.z, (uPrintsArea.y + uPrintsArea.w - vWPos.z) / uPrintsArea.w);
        float pr = 0.0;
        if (gSnow > 0.0 && all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0)))) pr = texture2D(uPrints, puv).r;
        col = mix(col, vec3(0.93, 0.95, 0.98) * (0.94 + 0.06 * fine), gSnow);
        col = mix(col, vec3(0.62, 0.68, 0.8), pr * gSnow * 0.7);
        diffuseColor.rgb = min(col, vec3(1.0));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uRingRough, gGloss);
        roughnessFactor = mix(roughnessFactor, 0.7, gSnow);`,
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

export function setGroundPrints(mat: THREE.Material, tex: THREE.Texture) {
  mat.userData.uniforms.uPrints.value = tex;
}

/** Location pattern and colours. */
export function applyGroundLook(mat: THREE.Material, look: GroundLook) {
  const u = mat.userData.uniforms;
  u.uStyle.value = STYLE_INDEX[look.style];
  u.uA.value.set(look.a);
  u.uB.value.set(look.b);
  u.uC.value.set(look.c);
  u.uBed.value.set(look.bed);
  u.uBedAccent.value.set(look.bedAccent);
}

export function applyGroundSeason(mat: THREE.Material, s: SeasonLook, rain: number) {
  const u = mat.userData.uniforms;
  u.uSnow.value = s.snow;
  u.uLeaves.value = s.leaves;
  u.uGrass.value.set(...s.grass);
  u.uRain.value = rain;
}

/** Flat ground (large plane) with the puddle cut out. */
export function createGround(material: THREE.Material) {
  const geo = new THREE.PlaneGeometry(6000, 6000, 120, 120);
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
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  const update = () => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const data = solver.shape.data;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      pos.setY(k, -bilinear(data, nx, nz, (x - ox) / ex * nx - 0.5, (z - oz) / ez * nz - 0.5));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  update();
  return { mesh, update };
}
