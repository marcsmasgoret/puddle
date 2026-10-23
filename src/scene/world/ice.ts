// Winter ice skim. Water at the puddle's edge is shallowest, so it loses heat
// fastest and freezes first: a thin band of ice grows in from the shore.
//
// The ice cover lives in a grid-sized texture (R = cover 0…1, G = cracks).
// Each frame one pass lets it grow back toward its frozen extent over about
// a minute, and applies any breaks: a slap shatters the ice within reach into
// Voronoi shards. Some shards vanish (pushed under and melted into the slush),
// the rest stay, crazed with cracks. The solver treats ice as a rigid lid
// (strong extra damping), so waves stop at the ice edge.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { NOISE } from '../../render/glsl';
import type { ShallowWaterSolver } from '../../physics/solver';

const MAX_BREAKS = 6;

export class Ice {
  private rt: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private quad: FullScreenQuad;
  private breaks: THREE.Vector4[] = [];
  enabled = false;

  constructor(private renderer: THREE.WebGLRenderer, private solver: ShallowWaterSolver) {
    const { nx, nz } = solver.grid;
    const make = () =>
      new THREE.WebGLRenderTarget(nx, nz, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rt = [make(), make()];
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          uPrev: { value: null },
          uShape: { value: solver.shapeTexture },
          uOrigin: { value: new THREE.Vector2(...solver.origin) },
          uExtent: { value: new THREE.Vector2(...solver.extent) },
          uDt: { value: 0 },
          uReset: { value: 1 },
          uCount: { value: 0 },
          uBreak: { value: Array.from({ length: MAX_BREAKS }, () => new THREE.Vector4()) },
          uSize: { value: new THREE.Vector2(nx, nz) },
        },
        vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D uPrev, uShape;
          uniform vec2 uOrigin, uExtent, uSize;
          uniform float uDt, uReset;
          uniform int uCount;
          uniform vec4 uBreak[${MAX_BREAKS}];   // (x, z, radius, unused)
          ${NOISE}
          void main() {
            vec2 uv = gl_FragCoord.xy / uSize;
            vec2 p = uOrigin + uv * uExtent;
            float sdf = texture2D(uShape, uv).r;
            // frozen extent: a band 5–14 cm wide, ragged with noise
            float w = 0.05 + 0.09 * fbm(p * 3.0);
            float target = sdf < 0.0 ? smoothstep(-w - 0.015, -w + 0.01, sdf) : 0.0;
            vec2 prev = uReset > 0.5 ? vec2(target, 0.0) : texture2D(uPrev, uv).rg;
            // refreezing: grow back toward the frozen extent over ~60 s,
            // cracks slowly heal
            float ice = min(prev.r + uDt / 60.0 * step(0.01, target), target);
            float crack = max(prev.g - uDt / 90.0, 0.0);
            for (int k = 0; k < ${MAX_BREAKS}; k++) {
              if (k >= uCount) break;
              float d = length(p - uBreak[k].xy) / uBreak[k].z;
              if (d < 1.0 && ice > 0.05) {
                vec3 v = voronoi(p * 22.0);
                // nearer the blow, more shards are lost
                if (v.z < 0.75 * (1.0 - d * d)) ice = 0.0;
                else crack = 1.0;
              }
            }
            gl_FragColor = vec4(ice, crack, 0.0, 1.0);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
  }

  get texture() {
    return this.rt[0].texture;
  }

  /** Shatter the ice within radius r [m] of (x, z). */
  breakAt(x: number, z: number, r: number) {
    if (!this.enabled) return;
    this.breaks.push(new THREE.Vector4(x, z, r, 0));
  }

  reset() {
    (this.quad.material as THREE.ShaderMaterial).uniforms.uReset.value = 1;
  }

  update(dt: number) {
    if (!this.enabled) return;
    const u = (this.quad.material as THREE.ShaderMaterial).uniforms;
    u.uPrev.value = this.rt[0].texture;
    u.uDt.value = dt;
    const batch = this.breaks.splice(0, MAX_BREAKS);
    batch.forEach((b, k) => (u.uBreak.value[k] as THREE.Vector4).copy(b));
    u.uCount.value = batch.length;
    this.renderer.setRenderTarget(this.rt[1]);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
    this.rt.reverse();
    u.uReset.value = 0;
    this.solver.setIce(this.rt[0].texture);
  }

  disable() {
    this.enabled = false;
    this.solver.setIce(null);
  }
}
