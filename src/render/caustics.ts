// ─────────────────────────────────────────────────────────────────────────────
// Caustics: the bright, wobbling light network on the floor of a puddle.
//
// Method (after Evan Wallace, "WebGL Water", 2011): take a fine grid of
// sunlight rays hitting the surface. Refract each ray through the local
// surface normal (Snell's law) and find where it lands on the floor. Draw the
// grid at the *landing* positions. Each little triangle carries the light that
// fell on its original (flat-water) area, so the brightness at the floor is
//
//     I = A_flat / A_landed
//
// computed per pixel from screen-space derivatives of the two positions. Where
// curved wave crests act as lenses the triangles shrink and the floor gets
// brighter; between them it gets darker. Flat water gives exactly I = 1, and
// total light is conserved because the triangles tile the floor.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { ShallowWaterSolver } from '../physics/solver';

export class Caustics {
  readonly target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;

  constructor(solver: ShallowWaterSolver, ior: number, meshDivisor: number) {
    const { nx, nz } = solver.grid;
    this.target = new THREE.WebGLRenderTarget(nx, nz, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    const sx = Math.round(nx / meshDivisor), sz = Math.round(nz / meshDivisor);
    // grid in uv space [0,1]²
    const geo = new THREE.PlaneGeometry(1, 1, sx, sz);
    geo.translate(0.5, 0.5, 0);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSurface: { value: solver.surface.texture },
        uShape: { value: solver.shapeTexture },
        uExtent: { value: new THREE.Vector2(...solver.extent) },
        uLight: { value: new THREE.Vector3(0, -1, 0) },
        uEta: { value: 1 / ior },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uSurface, uShape;
        uniform vec2 uExtent;
        uniform vec3 uLight;   // direction sunlight travels (unit, pointing down)
        uniform float uEta;    // n_air / n_fluid
        varying vec3 vOld, vNew;
        void main() {
          vec2 uv = position.xy;
          vec4 s = texture2D(uSurface, uv);
          float H = texture2D(uShape, uv).g;
          vec3 n = normalize(vec3(-s.g, 1.0, -s.b));
          vec2 q = uv * uExtent;
          vec3 p = vec3(q.x, s.r, q.y);                    // point on the surface (y = η)
          vec3 r0 = refract(uLight, vec3(0, 1, 0), uEta); // through flat water
          vec3 r  = refract(uLight, n, uEta);              // through the real surface
          // follow each ray down to the floor at depth H below rest level
          vOld = vec3(q.x, 0.0, q.y) + r0 * (H / -r0.y);
          vNew = p + r * ((H + s.r) / -r.y);
          vec2 clip = (vNew.xz / uExtent) * 2.0 - 1.0;
          gl_Position = vec4(clip, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vOld, vNew;
        void main() {
          float aOld = length(dFdx(vOld.xz)) * length(dFdy(vOld.xz));
          float aNew = length(dFdx(vNew.xz)) * length(dFdy(vNew.xz));
          float I = aOld / max(aNew, 1e-12);
          gl_FragColor = vec4(min(I, 12.0), 0.0, 0.0, 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** min / mean / max intensity over the texture (slow; for tests). */
  stats(renderer: THREE.WebGLRenderer) {
    const { width, height } = this.target;
    const buf = new Uint16Array(width * height * 4);
    renderer.readRenderTargetPixels(this.target, 0, 0, width, height, buf);
    let min = Infinity, max = 0, sum = 0;
    for (let k = 0; k < buf.length; k += 4) {
      const v = THREE.DataUtils.fromHalfFloat(buf[k]);
      min = Math.min(min, v); max = Math.max(max, v); sum += v;
    }
    return { min, max, mean: sum / (buf.length / 4) };
  }

  /** sunDir points *toward* the sun. */
  update(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3) {
    this.material.uniforms.uLight.value.copy(sunDir).negate();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    // the light grid tiles the whole domain, so every texel is written; flat
    // water sums to exactly 1 ("normal sunlight")
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevAlpha);
  }
}
