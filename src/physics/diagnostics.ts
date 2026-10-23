// ─────────────────────────────────────────────────────────────────────────────
// Live diagnostics for engineering mode, computed on the GPU.
//
// A reduction pass sums, over 16 × 16-cell blocks of the grid,
//   kinetic energy     KE = ½ ρ ∫ h |u|² dA
//   potential energy   PE = ½ ρ g ∫ η² dA     (relative to the flat surface)
//   momentum           P  = ρ ∫ h u dA        (x and z components)
// and only the small block image is read back, so the graphs cost almost
// nothing. A row of η along the puddle's long axis is read each frame too,
// for the space–time (Hovmöller) diagram and the wave probe.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { ShallowWaterSolver } from './solver';

const B = 16;

export interface Totals {
  ke: number;
  pe: number;
  px: number;
  pz: number;
}

export class Diagnostics {
  private rt: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  private bw: number;
  private bh: number;
  private buf: Float32Array;

  constructor(private renderer: THREE.WebGLRenderer, private solver: ShallowWaterSolver) {
    const { nx, nz } = solver.grid;
    this.bw = Math.ceil(nx / B);
    this.bh = Math.ceil(nz / B);
    this.rt = new THREE.WebGLRenderTarget(this.bw, this.bh, { type: THREE.FloatType, depthBuffer: false });
    this.buf = new Float32Array(this.bw * this.bh * 4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uState: { value: null }, uShape: { value: null }, uSize: { value: new THREE.Vector2(nx, nz) }, uG: { value: 9.81 } },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uState, uShape;
        uniform vec2 uSize;
        uniform float uG;
        void main() {
          ivec2 b = ivec2(gl_FragCoord.xy) * ${B};
          vec4 acc = vec4(0.0);
          for (int j = 0; j < ${B}; j++)
          for (int i = 0; i < ${B}; i++) {
            ivec2 c = b + ivec2(i, j);
            if (c.x >= int(uSize.x) || c.y >= int(uSize.y)) continue;
            vec4 sh = texelFetch(uShape, c, 0);
            if (sh.b < 0.5) continue;
            vec4 s = texelFetch(uState, c, 0);
            float h = max(sh.r + s.r, 0.0);
            vec2 u = 0.5 * vec2(s.g + texelFetch(uState, c + ivec2(1, 0), 0).g, s.b + texelFetch(uState, c + ivec2(0, 1), 0).b);
            acc += vec4(0.5 * h * dot(u, u), 0.5 * uG * s.r * s.r, h * u.x, h * u.y);
          }
          gl_FragColor = acc;
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }

  /** whole-puddle totals [J, J, kg·m/s, kg·m/s] */
  totals(density: number, g: number, shapeSim: THREE.Texture): Totals {
    const u = this.mat.uniforms;
    u.uState.value = this.solver.stateTexture;
    u.uShape.value = shapeSim;
    u.uG.value = g;
    this.renderer.setRenderTarget(this.rt);
    this.quad.render(this.renderer);
    this.renderer.readRenderTargetPixels(this.rt, 0, 0, this.bw, this.bh, this.buf);
    this.renderer.setRenderTarget(null);
    let ke = 0, pe = 0, px = 0, pz = 0;
    for (let k = 0; k < this.buf.length; k += 4) {
      ke += this.buf[k];
      pe += this.buf[k + 1];
      px += this.buf[k + 2];
      pz += this.buf[k + 3];
    }
    const dA = this.solver.grid.dx ** 2;
    return { ke: ke * density * dA, pe: pe * density * dA, px: px * density * dA, pz: pz * density * dA };
  }

  /** η along the middle row of the grid [m], one value per cell */
  row(): Float32Array {
    const { nx, nz } = this.solver.grid;
    const r = this.solver.readRegion(0, Math.floor(nz / 2), nx, 1);
    const out = new Float32Array(nx);
    for (let i = 0; i < nx; i++) out[i] = r[i * 4];
    return out;
  }
}
