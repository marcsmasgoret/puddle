// ─────────────────────────────────────────────────────────────────────────────
// Water surface shading
//
// What you see at each point of the surface is a mix of two light paths:
//
//  1. REFRACTED: light from the puddle bed, bent by Snell's law at the wavy
//     surface (n₁ sin θ₁ = n₂ sin θ₂) and dimmed by absorption along the path
//     through the fluid (Beer–Lambert: I = I₀ e^(−κL), per colour channel).
//
//  2. REFLECTED: the sky and scenery, mirrored in the surface.
//
// The split between them is the Fresnel reflectance F(θ): almost all
// refraction looking straight down (F ≈ 2 % for water), almost all reflection
// at grazing angles. That is why a puddle looks like a window near your feet
// and like a mirror further away.
//
// Add a sharp specular highlight of the sun (GGX microfacet model) and you
// have the full surface.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { ShallowWaterSolver } from '../physics/solver';
import type { FluidProperties } from '../physics/fluids';

export function createWaterMesh(solver: ShallowWaterSolver, fluid: FluidProperties) {
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
    uSceneColor: { value: null as THREE.Texture | null },
    uSceneDepth: { value: null as THREE.Texture | null },
    uReflection: { value: null as THREE.Texture | null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbient: { value: new THREE.Color(0.5, 0.55, 0.6) },
    uIor: { value: fluid.refractiveIndex },
    uAbsorption: { value: new THREE.Vector3(...fluid.absorption) },
    // Suspended sediment / dissolved organics in a real puddle (scene choice,
    // not a property of water): extra extinction [1/m] and its scatter colour.
    uTurbidity: { value: new THREE.Vector3(2.0, 2.6, 3.4) },
    uScatter: { value: new THREE.Color('#6f6a4c') },
    uRoughness: { value: 0.05 },
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
      uniform sampler2D uSurface, uShape, uSceneColor, uSceneDepth, uReflection;
      uniform mat4 projectionMatrix;
      uniform vec2 uOrigin, uExtent, uResolution;
      uniform mat4 uReflMatrix;
      uniform vec3 uSunDir, uSunColor, uAmbient, uAbsorption, uTurbidity, uScatter;
      uniform float uIor, uRoughness;
      varying vec3 vWPos;
      varying vec2 vUv;

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
        vec3 V = normalize(cameraPosition - vWPos);
        float cosV = clamp(dot(n, V), 0.0, 1.0);
        vec2 screenUv = gl_FragCoord.xy / uResolution;

        // ── 1. refraction: follow the bent ray to the bed ────────────────
        vec3 rd = refract(-V, n, 1.0 / uIor);
        float depth = max(H + s.r, 0.0);
        vec3 P = vWPos + rd * (depth / max(-rd.y, 0.15));
        // second iteration: use the bed depth where the ray actually lands
        float Hp = texture2D(uShape, (P.xz - uOrigin) / uExtent).g;
        P = vWPos + rd * ((vWPos.y + Hp) / max(-rd.y, 0.15));
        vec2 refrUv = clamp(toScreen(P), 0.001, 0.999);
        // if something above the water sits at that pixel (a rock, later a
        // duck), refraction there is invalid: fall back to the direct view
        if (texture2D(uSceneDepth, refrUv).r < gl_FragCoord.z) refrUv = screenUv;
        float L = length(P - vWPos);
        vec3 transmit = exp(-(uAbsorption + uTurbidity) * L);
        vec3 refr = texture2D(uSceneColor, refrUv).rgb * transmit
                  + uScatter * uAmbient * (1.0 - exp(-uTurbidity * L)) * 0.35;

        // ── 2. reflection: perturb the mirrored ray by the surface slope ──
        vec3 R = reflect(-V, n);
        vec4 rc = uReflMatrix * vec4(vWPos + R * 8.0, 1.0);
        vec2 reflUv = clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999);
        vec3 refl = texture2D(uReflection, reflUv).rgb;

        // ── 3. sun glints: GGX microfacet specular ───────────────────────
        vec3 Hv = normalize(V + uSunDir);
        float NdH = max(dot(n, Hv), 0.0), NdL = max(dot(n, uSunDir), 0.0);
        float a2 = uRoughness * uRoughness * uRoughness * uRoughness;
        float d = NdH * NdH * (a2 - 1.0) + 1.0;
        float D = a2 / (3.14159265 * d * d);
        float spec = min(D * fresnel(max(dot(V, Hv), 0.0), uIor) * NdL / max(4.0 * NdL * cosV, 1e-3), 80.0);

        float F = fresnel(cosV, uIor);
        vec3 col = mix(refr, refl, F) + uSunColor * spec * NdL;

        // ── shoreline: the film thins to nothing, blend into the ground ──
        vec3 direct = texture2D(uSceneColor, screenUv).rgb;
        col = mix(col, direct, smoothstep(-0.004, 0.0015, sdf));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
