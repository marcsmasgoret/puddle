// ─────────────────────────────────────────────────────────────────────────────
// Fluid surface shading
//
// Every fluid uses the same wave surface, but light interacts with it in
// physically different ways:
//
//  DIELECTRIC (water, honey) — light splits at the surface:
//   • REFRACTED: light from the bed, bent by Snell's law (n₁ sin θ₁ = n₂ sin θ₂)
//     and dimmed by absorption along the path (Beer–Lambert: I = I₀ e^(−κL)
//     per colour). Honey's strong blue absorption is what makes it golden.
//   • REFLECTED: sky and scenery, weighted by the exact Fresnel reflectance
//     F(θ) (≈ 2 % looking straight down for water, ~100 % at grazing).
//
//  METAL (mercury) — free electrons reflect light before it can enter, so
//   there is no refraction at all. Reflectance follows the conductor Fresnel
//   equations with a complex index n + ik (≈ 78 % for mercury at every
//   colour: a bright, neutral mirror). Mercury does not wet the ground
//   (contact angle ≈ 140°), so its edge is a rounded bead that curves down
//   into the soil, catching light along the rim.
//
//  OPAQUE (oobleck) — a dense starch suspension scatters light within a
//   millimetre: it looks like matte cream with a wet sheen. Very thin edges
//   still show the bed through them. When it jams under a hit, grains poke
//   through the surface and it briefly goes dull (dilatancy).
//
// All three add the sun's specular glint (GGX microfacet model).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { ShallowWaterSolver } from '../physics/solver';
import type { FluidProperties } from '../physics/fluids';
import { NOISE, ICE_BAND } from './glsl';

export function createWaterMesh(solver: ShallowWaterSolver) {
  const [ox, oz] = solver.origin;
  const [ex, ez] = solver.extent;
  const geo = new THREE.PlaneGeometry(ex, ez, Math.round(solver.grid.nx / 2), Math.round(solver.grid.nz / 2));
  geo.rotateX(-Math.PI / 2);
  geo.translate(ox + ex / 2, 0, oz + ez / 2);

  const uniforms = {
    uSurface: { value: solver.surface.texture },
    uShape: { value: solver.shapeTexture },
    uOrigin: { value: new THREE.Vector2(ox, oz) },
    uExtent: { value: new THREE.Vector2(ex, ez) },
    uTexel: { value: new THREE.Vector2(1 / solver.grid.nx, 1 / solver.grid.nz) },
    uSceneColor: { value: null as THREE.Texture | null },
    uSceneDepth: { value: null as THREE.Texture | null },
    uReflection: { value: null as THREE.Texture | null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbient: { value: new THREE.Color(0.5, 0.55, 0.6) },
    uMode: { value: 0 },
    uIor: { value: 1.333 },
    uAbsorption: { value: new THREE.Vector3() },
    uTurbidity: { value: new THREE.Vector3() },
    uScatter: { value: new THREE.Color('#6f6a4c') },
    uRoughness: { value: 0.05 },
    uMetalN: { value: new THREE.Vector3() },
    uMetalK: { value: new THREE.Vector3() },
    uAlbedo: { value: new THREE.Color() },
    uExtinction: { value: 0 },
    uMeniscus: { value: 0 },
    uIce: { value: null as THREE.Texture | null },
    uIceOn: { value: 0 },
    // lava: crust thickness field, melt temperature, crust colour, clock
    uCrust: { value: null as THREE.Texture | null },
    uLavaT: { value: 1420 },
    uCrustColor: { value: new THREE.Color() },
    uTime: { value: 0 },
    // recent impacts on a shear-thickening fluid: (x, z, R, strength 0…1)
    uJamMarks: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform sampler2D uSurface;
      uniform vec2 uOrigin, uExtent;
      varying vec3 vWPos;
      varying vec2 vUv;
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = (p.xz - uOrigin) / uExtent;
        p.y += texture2D(uSurface, vUv).r;   // real displacement (millimetres)
        vWPos = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSurface, uShape, uSceneColor, uSceneDepth, uReflection, uIce, uCrust;
      uniform float uIceOn, uLavaT, uTime;
      uniform vec3 uCrustColor;
      uniform mat4 projectionMatrix;
      uniform vec2 uOrigin, uExtent, uResolution, uTexel;
      uniform mat4 uReflMatrix;
      uniform vec3 uSunDir, uSunColor, uAmbient, uAbsorption, uTurbidity, uScatter, uAlbedo;
      uniform vec3 uMetalN, uMetalK;
      uniform float uIor, uRoughness, uExtinction, uMeniscus;
      uniform int uMode;
      uniform vec4 uJamMarks[4];
      varying vec3 vWPos;
      varying vec2 vUv;
      ${NOISE}
      ${ICE_BAND}

      // Exact Fresnel reflectance for unpolarised light at a dielectric
      // interface (average of s- and p-polarisations).
      float fresnel(float cosI, float n) {
        float sinT2 = (1.0 - cosI * cosI) / (n * n);
        if (sinT2 >= 1.0) return 1.0;
        float cosT = sqrt(1.0 - sinT2);
        float rs = (cosI - n * cosT) / (cosI + n * cosT);
        float rp = (n * cosI - cosT) / (n * cosI + cosT);
        return 0.5 * (rs * rs + rp * rp);
      }
      // Fresnel reflectance of a conductor with complex index n + ik (the
      // standard closed form used in physically based rendering), per colour.
      vec3 fresnelMetal(float c, vec3 n, vec3 k) {
        vec3 nk = n * n + k * k;
        float c2 = c * c;
        vec3 rs = (nk - 2.0 * n * c + c2) / (nk + 2.0 * n * c + c2);
        vec3 rp = (nk * c2 - 2.0 * n * c + 1.0) / (nk * c2 + 2.0 * n * c + 1.0);
        return 0.5 * (rs + rp);
      }
      float ggx(vec3 n, vec3 h, float a) {
        float a2 = a * a * a * a;
        float NdH = max(dot(n, h), 0.0);
        float d = NdH * NdH * (a2 - 1.0) + 1.0;
        return a2 / (3.14159265 * d * d);
      }
      // Blackbody colour of hot rock (linear RGB, normalised to its own
      // brightness), a fit to Planck's law over 800–1600 K: dull red at
      // 900 K, orange at 1200 K, yellow-orange at 1500 K.
      vec3 blackbody(float T) {
        float t = clamp((T - 800.0) / 800.0, 0.0, 1.0);
        return vec3(1.0, 0.08 + 0.55 * t * t + 0.1 * t, 0.005 + 0.2 * t * t * t);
      }
      vec2 toScreen(vec3 world) {
        vec4 c = projectionMatrix * viewMatrix * vec4(world, 1.0);
        return c.xy / c.w * 0.5 + 0.5;
      }

      void main() {
        vec2 shp = texture2D(uShape, vUv).rg;
        float sdf = shp.r, H = shp.g;
        if (sdf > 0.0015) discard;

        vec4 s = texture2D(uSurface, vUv);
        vec3 n = normalize(vec3(-s.g, 1.0, -s.b));
        // non-wetting rim (mercury): the surface rolls over into a bead at
        // the edge, so tilt the normal outward close to the contact line
        if (uMeniscus > 0.0) {
          float gx = texture2D(uShape, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uShape, vUv - vec2(uTexel.x, 0.0)).r;
          float gz = texture2D(uShape, vUv + vec2(0.0, uTexel.y)).r - texture2D(uShape, vUv - vec2(0.0, uTexel.y)).r;
          vec2 outward = normalize(vec2(gx, gz) + 1e-6);
          float t = clamp(1.0 + sdf / uMeniscus, 0.0, 1.0);    // 0 inside … 1 at the edge
          float slope = tan(t * t * 1.2);                      // up to ~50° at the rim
          n = normalize(n + vec3(outward.x, 0.0, outward.y) * slope);
        }
        vec3 V = normalize(cameraPosition - vWPos);
        float cosV = clamp(dot(n, V), 0.0, 1.0);
        vec2 screenUv = gl_FragCoord.xy / uResolution;
        vec3 direct = texture2D(uSceneColor, screenUv).rgb;

        // reflection: perturb the mirrored ray by the surface slope
        vec3 R = reflect(-V, n);
        vec4 rc = uReflMatrix * vec4(vWPos + R * 8.0, 1.0);
        vec2 reflUv = clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999);
        vec3 refl = texture2D(uReflection, reflUv).rgb;

        vec3 Hv = normalize(V + uSunDir);
        float NdL = max(dot(n, uSunDir), 0.0);
        float D = ggx(n, Hv, uRoughness);
        float geom = NdL / max(4.0 * NdL * cosV, 1e-3);

        // refraction path to the bed (used by dielectrics and thin opaque edges)
        vec3 rd = refract(-V, n, 1.0 / uIor);
        float depth = max(H + s.r, 0.0);
        vec3 P = vWPos + rd * (depth / max(-rd.y, 0.15));
        float Hp = texture2D(uShape, (P.xz - uOrigin) / uExtent).g;
        P = vWPos + rd * ((vWPos.y + Hp) / max(-rd.y, 0.15));
        vec2 refrUv = clamp(toScreen(P), 0.001, 0.999);
        // something above the surface at that pixel: refraction is invalid
        if (texture2D(uSceneDepth, refrUv).r < gl_FragCoord.z) refrUv = screenUv;
        float L = length(P - vWPos);

        vec3 col;
        float edgeBand = 0.004;
        if (uMode == 1) {
          // ── metal ──
          vec3 F = fresnelMetal(cosV, uMetalN, uMetalK);
          vec3 Fh = fresnelMetal(max(dot(V, Hv), 0.0), uMetalN, uMetalK);
          col = F * refl + uSunColor * Fh * min(D * geom, 80.0) * NdL;
          edgeBand = 0.0008;
        } else if (uMode == 2) {
          // ── opaque suspension ──
          // the small yield stress leaves the surface gently lumpy instead of
          // perfectly level: a soft, low-amplitude bump texture
          vec2 q = vWPos.xz * 9.0;
          float e = 0.05;
          float b = vnoise(q) + 0.5 * vnoise(q * 2.3 + 4.0);
          vec2 g = vec2(vnoise(q + vec2(e, 0.0)) + 0.5 * vnoise((q + vec2(e, 0.0)) * 2.3 + 4.0) - b,
                        vnoise(q + vec2(0.0, e)) + 0.5 * vnoise((q + vec2(0.0, e)) * 2.3 + 4.0) - b) / e;
          n = normalize(n + vec3(g.x, 0.0, g.y) * 0.025);
          cosV = clamp(dot(n, V), 0.0, 1.0);
          Hv = normalize(V + uSunDir);
          NdL = max(dot(n, uSunDir), 0.0);
          R = reflect(-V, n);
          rc = uReflMatrix * vec4(vWPos + R * 8.0, 1.0);
          refl = texture2D(uReflection, clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
          geom = NdL / max(4.0 * NdL * cosV, 1e-3);
          // jammed where the solver says the strain rate is high right now, and
          // where a recent impact froze the surface: an impact sends a jamming
          // front out wider than the impactor (Waitukaitis & Jaeger 2012),
          // which then "melts" back to liquid over a fraction of a second
          float jam = s.a;
          for (int k = 0; k < 4; k++) {
            vec2 d = vWPos.xz - uJamMarks[k].xy;
            jam = max(jam, uJamMarks[k].w * exp(-dot(d, d) / (uJamMarks[k].z * uJamMarks[k].z)));
          }
          float rough = mix(uRoughness, 0.85, jam);
          // jammed grains poke through the surface: it turns matte, a touch
          // paler and grainy, and loses its wet reflection
          float grain = vnoise(vWPos.xz * 900.0) * jam;
          float F = fresnel(cosV, uIor) * (1.0 - 0.85 * jam);
          // soft wrap lighting: light scatters a little way into the cream
          float wrap = clamp((dot(n, uSunDir) + 0.3) / 1.3, 0.0, 1.0);
          vec3 diffuse = uAlbedo * (uSunColor * wrap * 0.28 + uAmbient * 0.42);
          diffuse *= 1.0 + 0.1 * jam - 0.12 * grain;
          float Ds = ggx(n, Hv, rough);
          vec3 spec = uSunColor * fresnel(max(dot(V, Hv), 0.0), uIor) * min(Ds * geom, 40.0) * NdL * (1.0 - 0.9 * jam);
          vec3 body = mix(diffuse, refl, min(F * 1.6, 1.0));
          // a film thinner than the scattering length shows the bed through it
          float T = exp(-uExtinction * depth);
          col = mix(body, texture2D(uSceneColor, refrUv).rgb, T) + spec;
        } else if (uMode == 3) {
          // ── lava ──
          // rafts of solid crust floating on glowing melt. The plate pattern
          // lives on material coordinates carried with the flow (lavaCrust.ts),
          // so the plates drift, turn and pull apart with the melt
          vec4 cr = texture2D(uCrust, vUv);
          float crust = cr.r;
          vec2 mc = cr.gb;
          vec2 q = mc * 11.0 + vec2(vnoise(mc * 4.0), vnoise(mc * 4.0 + 3.0)) * 1.2;
          vec3 vc = voronoi(q);
          float edge = vc.y - vc.x; // distance to the plate's border (cell units)
          // thinner crust: wider cracks between plates, and some plates gone
          float gap = mix(0.03, 0.62, smoothstep(0.15, 0.95, 1.0 - crust));
          float present = step(fract(vc.z * 7.31) * 0.55, crust);
          float aa = fwidth(edge) * 1.2 + 1e-4;
          float solid = smoothstep(gap - aa, gap + aa, edge) * present;
          // the melt: flowing incandescent rock, cooler (darker, redder)
          // in streaks and in a skin along the edge of each plate
          float churn = fbm(mc * 7.0 + vec2(uTime * 0.12, -uTime * 0.08));
          float streak = fbm(mc * vec2(18.0, 6.0) + churn * 1.5 - uTime * 0.05);
          float rim = present * (1.0 - smoothstep(0.0, 0.16, edge - gap + 0.06));
          float T = uLavaT - 190.0 * (1.0 - churn) - 200.0 * streak * streak - 260.0 * rim - 100.0 * crust;
          // radiance ∝ T⁴ (Stefan–Boltzmann), relative to 1420 K
          float I = pow(T / 1420.0, 4.0) * 2.1;
          vec3 melt = blackbody(T) * I;
          // the liquid surface is smooth: a faint glassy sheen of the sky
          melt += refl * fresnel(cosV, 1.6) * 0.25 + uSunColor * min(D * geom, 30.0) * NdL * 0.05;
          // the plates: dark glassy basalt, each tilted a little its own way
          // so they catch the light as separate solid pieces, ropy on top
          float tilt = vc.z * 6.283;
          vec3 nc = normalize(n + vec3(cos(tilt), 0.0, sin(tilt)) * 0.12
                              + vec3(vnoise(mc * 60.0) - 0.5, 0.0, vnoise(mc * 60.0 + 7.0) - 0.5) * 0.12);
          // raised edges: a bevel facing out of the plate
          float bevel = 1.0 - smoothstep(gap, gap + 0.1, edge);
          float NdLc = max(dot(nc, uSunDir), 0.0);
          float Fc = fresnel(clamp(dot(nc, V), 0.0, 1.0), 1.55);
          vec3 Hc = normalize(uSunDir + V);
          float Dc = ggx(nc, Hc, 0.35);
          vec3 crustCol = uCrustColor * (uAmbient * 0.6 + uSunColor * NdLc * 0.5) * (1.0 + 0.25 * (vnoise(mc * 25.0) - 0.5))
                        + refl * Fc * 0.3 + uSunColor * min(Dc * geom, 20.0) * NdLc * 0.08;
          // hot underside showing at the plate's bevelled edge; young plates glow dull red
          crustCol += blackbody(1000.0) * (bevel * 0.35 + 0.1 * smoothstep(0.75, 1.0, fract(vc.z * 13.7)) * (1.0 - crust));
          col = mix(melt, crustCol, solid);
          edgeBand = 0.002;
        } else {
          // ── dielectric ──
          vec3 transmit = exp(-(uAbsorption + uTurbidity) * L);
          vec3 refr = texture2D(uSceneColor, refrUv).rgb * transmit
                    + uScatter * (uAmbient * 0.35 + uSunColor * 0.12) * (1.0 - exp(-uTurbidity * L));
          float F = fresnel(cosV, uIor);
          float spec = min(D * fresnel(max(dot(V, Hv), 0.0), uIor) * geom, 80.0);
          col = mix(refr, refl, F) + uSunColor * spec * NdL;
        }

        // ice skim: flat, pale and glassy, with white fracture lines where it
        // has been cracked; a sharp mirror sheen at grazing angles
        if (uIceOn > 0.5) {
          vec2 ic = texture2D(uIce, vUv).rg;
          // the ice texture lives on the simulation grid; its outline is
          // redrawn here per pixel so the edge never shows grid steps
          ic.r = min(smoothstep(0.0, 0.6, ic.r), iceBand(vWPos.xz, shp.r));
          if (ic.r > 0.01) {
            vec3 up = vec3(0.0, 1.0, 0.0);
            float cv = clamp(dot(up, V), 0.0, 1.0);
            vec4 rf = uReflMatrix * vec4(vWPos + reflect(-V, up) * 8.0, 1.0);
            vec3 flatRefl = texture2D(uReflection, clamp(rf.xy / rf.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
            vec3 frost = vec3(0.84, 0.9, 0.96) * (uAmbient * 0.55 + uSunColor * max(uSunDir.y, 0.0) * 0.25);
            vec3 iceCol = mix(mix(direct, frost, 0.55), flatRefl, fresnel(cv, 1.31));
            vec3 v = voronoi(vWPos.xz * 22.0);
            float line = smoothstep(0.06, 0.0, v.y - v.x) * ic.g;
            iceCol = mix(iceCol, vec3(0.97, 0.99, 1.0) * (uAmbient * 0.8 + uSunColor * 0.2), line * 0.8);
            col = mix(col, iceCol, ic.r);
          }
        }

        // shoreline: the film thins to nothing, blend into the ground
        col = mix(col, direct, smoothstep(-edgeBand, 0.0015, sdf));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  /** Load a fluid's optical properties into the shader. */
  function applyFluid(f: FluidProperties) {
    const o = f.optics;
    const u = uniforms;
    u.uMeniscus.value = 0;
    u.uTurbidity.value.set(0, 0, 0);
    if (o.kind === 'dielectric') {
      u.uMode.value = 0;
      u.uIor.value = o.ior;
      u.uAbsorption.value.set(...o.absorption);
      u.uRoughness.value = o.roughness;
      // puddle water carries a little fine sediment (scene choice)
      if (f.id === 'water') {
        u.uTurbidity.value.set(2.0, 2.6, 3.4);
        u.uScatter.value.set('#6f6a4c');
      }
      // gelatin scatters a little light inside: the soft glow of jello
      if (f.id === 'jello') {
        u.uTurbidity.value.set(14, 14, 14);
        u.uScatter.value.set('#ff2a2a');
      }
      // honey carries pollen and fine sugar crystals that scatter warm light
      if (f.id === 'honey') {
        u.uTurbidity.value.set(6, 6, 6);
        u.uScatter.value.set('#f0a02a');
      }
    } else if (o.kind === 'metal') {
      u.uMode.value = 1;
      u.uMetalN.value.set(...o.n);
      u.uMetalK.value.set(...o.k);
      u.uRoughness.value = o.roughness;
      u.uIor.value = 1.5;
      // rim width ≈ 3 capillary lengths (ℓc ≈ 1.9 mm for mercury), widened
      // slightly so it reads at screen resolution
      u.uMeniscus.value = 0.008;
    } else if (o.kind === 'lava') {
      u.uMode.value = 3;
      u.uLavaT.value = o.temperature;
      u.uCrustColor.value.setRGB(...o.crust);
      u.uRoughness.value = o.roughness;
      u.uIor.value = 1.55;
    } else {
      u.uMode.value = 2;
      u.uAlbedo.value.setRGB(...o.albedo);
      u.uIor.value = o.ior;
      u.uExtinction.value = o.extinction;
      u.uRoughness.value = o.roughness;
    }
  }

  return { mesh, uniforms, applyFluid };
}
