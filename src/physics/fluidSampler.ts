// ─────────────────────────────────────────────────────────────────────────────
// Reading the fluid back for the rigid bodies
//
// The bodies run on the CPU but the fluid lives on the GPU. Each frame we
// upload the world positions of every hull sample (a small float texture),
// run one "gather" pass that bilinearly interpolates the surface height η and
// the depth-averaged velocity (u, v) at each position, and read the result
// back asynchronously so the frame never stalls waiting for the GPU. The
// bodies therefore see the fluid as it was one or two frames ago (~20–30 ms),
// which is far shorter than any wave period they respond to.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const W = 32, H = 32; // up to 1024 samples
export const SAMPLER_CAPACITY = W * H;

export class FluidSampler {
  private posTex: THREE.DataTexture;
  private posData = new Float32Array(W * H * 4);
  private target: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  private busy = false;
  private readBuf = new Float32Array(W * H * 4);
  /** latest results: (η, u, v, unused) per sample, and the request tag they belong to */
  result = new Float32Array(W * H * 4);
  resultTag: unknown = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    state: () => THREE.Texture,
    size: [number, number],
    origin: [number, number],
    dx: number,
  ) {
    this.posTex = new THREE.DataTexture(this.posData, W, H, THREE.RGBAFormat, THREE.FloatType);
    this.target = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uPos: { value: this.posTex },
        uSize: { value: new THREE.Vector2(...size) },
        uOrigin: { value: new THREE.Vector2(...origin) },
        uDx: { value: dx },
      },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        precision highp sampler2D;
        uniform sampler2D uState, uPos;
        uniform ivec2 uSize;
        uniform vec2 uOrigin;
        uniform float uDx;
        vec4 S(ivec2 c) { return texelFetch(uState, clamp(c, ivec2(0), uSize - 1), 0); }
        // bilinear sample of η (cell centres) and cell-centred velocity
        vec3 fluidAt(vec2 g) {
          vec2 f = g - 0.5;
          ivec2 i = ivec2(floor(f));
          vec2 t = f - vec2(i);
          vec3 acc = vec3(0.0);
          for (int dy = 0; dy <= 1; dy++)
          for (int dx = 0; dx <= 1; dx++) {
            ivec2 c = i + ivec2(dx, dy);
            vec4 s = S(c);
            vec2 vel = 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b);
            float w = (dx == 1 ? t.x : 1.0 - t.x) * (dy == 1 ? t.y : 1.0 - t.y);
            acc += w * vec3(s.r, vel);
          }
          return acc;
        }
        void main() {
          vec4 p = texelFetch(uPos, ivec2(gl_FragCoord.xy), 0);
          vec2 g = (p.xy - uOrigin) / uDx;   // grid coordinates
          gl_FragColor = vec4(fluidAt(g), 0.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(mat);
    this.stateTex = state;
  }
  private stateTex: () => THREE.Texture;

  /**
   * Ask for the fluid at these (x, z) positions. Ignored while the previous
   * request is still in flight; `tag` comes back with the result so callers
   * know which positions it belongs to.
   */
  request(xz: Float32Array, count: number, tag: unknown) {
    if (this.busy) return;
    const n = Math.min(count, SAMPLER_CAPACITY);
    for (let k = 0; k < n; k++) {
      this.posData[k * 4] = xz[k * 2];
      this.posData[k * 4 + 1] = xz[k * 2 + 1];
    }
    this.posTex.needsUpdate = true;
    const mat = this.quad.material as THREE.ShaderMaterial;
    mat.uniforms.uState.value = this.stateTex();
    this.renderer.setRenderTarget(this.target);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
    this.busy = true;
    const rows = Math.max(1, Math.ceil(n / W));
    this.renderer
      .readRenderTargetPixelsAsync(this.target, 0, 0, W, rows, this.readBuf)
      .then(() => {
        this.result.set(this.readBuf.subarray(0, rows * W * 4));
        this.resultTag = tag;
      })
      .catch(() => {})
      .finally(() => (this.busy = false));
  }
}
