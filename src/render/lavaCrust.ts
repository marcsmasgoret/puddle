// The skin on the melt of a lava puddle. Exposed melt radiates and cools;
// within a few seconds a thin, darker skin forms over a surface that sits
// still, and the flow tears it open again. The skin is still liquid and
// streams with the melt. The solid crust plates that ride on top are rigid
// bodies of their own (lavaPlates.ts).
//
// Per simulation cell:
//   R   crust cover, 0 (bare, glowing melt) to 1 (closed crust)
//   GB  material coordinates [m]: where this bit of surface started. They
//       are carried with the flow, so the glow pattern drawn on them
//       (water.ts) streams with the melt instead of sitting still on screen
//
//   advection  both are moved semi-Lagrangian with the depth-averaged
//              velocity u
//   growth     dc/dt = (c_eq − c) / t_crust; c_eq ≈ 0.65 at rest (convection
//              keeps the skin from closing) and lower over slow-
//              drifting hot spots where fresh melt wells up
//   tearing    dc/dt = −c · (|S| / 1.5 s⁻¹ + |u| / 0.08 m/s)
// with |S| the strain rate. Where the melt lies bare, the coordinates are
// reset to the cell's own position.
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
          float uz = 0.5 * ((S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) + (S(c + ivec2(1, 1)).g - S(c + ivec2(1, -1)).g)) / (2.0 * uDx);
          float vx = 0.5 * ((S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) + (S(c + ivec2(1, 1)).b - S(c + ivec2(-1, 1)).b)) / (2.0 * uDx);
          float strain = sqrt(2.0 * ux * ux + 2.0 * vz * vz + (uz + vx) * (uz + vx));
          vec2 size = vec2(textureSize(uState, 0));
          vec2 p = (vec2(c) + 0.5) * uDx;
          // carried with the flow: look up where this surface was a step ago
          vec2 back = (vec2(c) + 0.5 - vel * uDt / uDx) / size;
          vec4 prev = texture(uPrev, back);
          float crust = uReset > 0.5 ? 0.6 + 0.3 * hash(vec2(c)) : prev.r;
          vec2 m = uReset > 0.5 ? p : prev.gb;
          // upwelling hot spots drift slowly across the pool
          float up = vnoise(p * 3.0 + vec2(uTime * 0.04, uTime * 0.025)) * 0.65 + vnoise(p * 7.0 - uTime * 0.06) * 0.35;
          float eq = 0.64 - 0.55 * smoothstep(0.45, 0.85, up);
          crust += uDt * (eq - crust) / uT;
          crust -= uDt * crust * (strain / 1.5 + length(vel) / 0.08);
          crust = clamp(crust, 0.0, 1.0);
          // bare melt: fresh surface, fresh coordinates
          m = mix(m, p, smoothstep(0.06, 0.0, crust));
          gl_FragColor = vec4(crust, m, 1.0);
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
