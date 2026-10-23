// Splash drops: instanced spheres, stretched slightly along their velocity
// (the eye blends a fast drop's motion over a frame), shaded like the puddle
// surface: refracted background + Fresnel sky reflection + a sun glint.
import * as THREE from 'three';
import { MAX_DROPS, type Droplets } from '../physics/droplets';

export function createDropletMesh(drops: Droplets, waterUniforms: Record<string, THREE.IUniform>) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSceneColor: waterUniforms.uSceneColor,
      uResolution: waterUniforms.uResolution,
      uSunDir: waterUniforms.uSunDir,
      uSunColor: waterUniforms.uSunColor,
      uSkyTop: { value: new THREE.Color() },
      uSkyHorizon: { value: new THREE.Color() },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uMetal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSceneColor;
      uniform vec2 uResolution;
      uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uTint;
      uniform float uMetal;
      varying vec3 vN;
      varying vec3 vWPos;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWPos);
        float cosV = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);       // Schlick, n = 1.33
        // a sphere acts like a strong lens: the background appears shifted
        vec3 Nv = (viewMatrix * vec4(N, 0.0)).xyz;
        vec2 uv = gl_FragCoord.xy / uResolution - Nv.xy * 0.035;
        vec3 refr = texture2D(uSceneColor, clamp(uv, 0.001, 0.999)).rgb * uTint;
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 2.0, 0.0, 1.0));
        float spec = pow(max(dot(R, uSunDir), 0.0), 400.0) * 6.0;
        // mercury beads: a tiny curved mirror (≈ 78 % reflectance, no refraction)
        vec3 col = uMetal > 0.5 ? sky * 0.78 + uSunColor * spec * 0.78 : mix(refr, sky, F) + uSunColor * spec;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_DROPS);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  function update() {
    let n = 0;
    for (let k = 0; k < MAX_DROPS; k++) {
      if (!drops.alive[k]) continue;
      const r = drops.radius[k];
      dir.set(drops.vel[k * 3], drops.vel[k * 3 + 1], drops.vel[k * 3 + 2]);
      const speed = dir.length();
      // stretch by the distance travelled in about a third of a frame
      const stretch = 1 + (speed / 180) / r;
      if (speed > 1e-4) q.setFromUnitVectors(up, dir.multiplyScalar(1 / speed));
      else q.identity();
      pos.set(drops.pos[k * 3], drops.pos[k * 3 + 1], drops.pos[k * 3 + 2]);
      if (drops.mode[k] !== 0) {
        // a bead resting on the ground, squashed a little by its own weight
        q.identity();
        scl.set(r * 1.1, r * 0.75, r * 1.1);
      } else scl.set(r, r * Math.min(stretch, 3), r);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, material: mat, update };
}
