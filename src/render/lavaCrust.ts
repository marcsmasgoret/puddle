// The skin on a lava puddle. Exposed melt radiates and cools; within a few
// seconds a dark, glassy crust grows over any surface that sits still
// (pāhoehoe skins over fast). Wherever the melt moves or is stretched, the
// crust tears and the glowing interior shows through.
//
// One value per simulation cell, 0 (bare, glowing) to 1 (fully crusted):
//   growth   dc/dt = (c_eq − c) / t_crust
//            c_eq < 1 over slow-drifting hot spots: convection in the pool
//            brings fresh melt up and keeps reopening the skin there
//   tearing  dc/dt = −c · (|u| / 0.02 m/s + |S| / 2 s⁻¹)
// with u the depth-averaged velocity and |S| the strain rate from the solver.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { ShallowWaterSolver } from '../physics/solver';

export class LavaCrust {
  private rt: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  private reset = true;
  enabled = false;
  crustTime = 2.5;

  constructor(private renderer: THREE.WebGLRenderer, private solver: ShallowWaterSolver) {
    const { nx, nz } = solver.grid;
    const make = () =>
      new THREE.WebGLRenderTarget(nx, nz, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    this.rt = [make(), make()];
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null },
        uPrev: { value: null },
        uDt: { value: 0 },
        uT: { value: 2.5 },
        uDx: { value: solver.grid.dx },
        uReset: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uState, uPrev;
        uniform float uDt, uT, uDx, uReset, uTime;
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        vec4 S(ivec2 c) { return texelFetch(uState, c, 0); }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          ivec2 c = ivec2(gl_FragCoord.xy);
          vec4 s = S(c);
          vec2 vel = 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b);
          float ux = (S(c + ivec2(1, 0)).g - s.g) / uDx;
          float vz = (S(c + ivec2(0, 1)).b - s.b) / uDx;
          float strain = sqrt(2.0 * ux * ux + 2.0 * vz * vz);
          float crust = uReset > 0.5 ? 0.75 + 0.2 * hash(vec2(c)) : texelFetch(uPrev, c, 0).r;
          // upwelling hot spots drift slowly across the pool
          vec2 p = vec2(c) * uDx;
          float up = vnoise(p * 3.0 + vec2(uTime * 0.04, uTime * 0.025)) * 0.65 + vnoise(p * 7.0 - uTime * 0.06) * 0.35;
          float eq = 0.97 - 0.85 * smoothstep(0.45, 0.85, up);
          crust += uDt * (eq - crust) / uT;
          crust -= uDt * crust * (length(vel) / 0.02 + strain / 2.0);
          gl_FragColor = vec4(clamp(crust, 0.0, 1.0), 0.0, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }

  get texture() {
    return this.rt[0].texture;
  }

  /** start over: a freshly poured puddle, mostly skinned with a few cracks */
  restart() {
    this.reset = true;
  }

  update(dt: number) {
    if (!this.enabled) return;
    const u = this.mat.uniforms;
    u.uState.value = this.solver.stateTexture;
    u.uPrev.value = this.rt[0].texture;
    u.uDt.value = Math.min(dt, 0.05);
    u.uT.value = this.crustTime;
    u.uReset.value = this.reset ? 1 : 0;
    u.uTime.value += u.uDt.value;
    this.reset = false;
    this.renderer.setRenderTarget(this.rt[1]);
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
    this.rt.reverse();
  }
}
