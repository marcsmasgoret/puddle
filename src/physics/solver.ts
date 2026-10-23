// ─────────────────────────────────────────────────────────────────────────────
// ShallowWaterSolver — runs the shallow-water passes on the GPU.
//
// State lives in two float render targets that are "ping-ponged": every pass
// reads one and writes the other, then they swap. Per rendered frame:
//
//   plan substeps (stability.ts) → apply queued impulses →
//   repeat N times { velocity pass, height pass } → surface pass for rendering
//
// The equations themselves are in swe/shaders.ts.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { DOMAIN_X, DOMAIN_Z, type Grid } from './grid';
import { type FluidProperties } from './fluids';
import { rheologyUniforms } from './rheology';
import { type PuddleShape } from './puddleShape';
import { planSteps, U_MAX, type StepPlan } from './stability';
import {
  fullscreenVertex,
  velocityFragment,
  heightFragment,
  limiterFragment,
  impulseFragment,
  surfaceFragment,
  MAX_IMPULSES,
  MAX_PRESSES,
} from './swe/shaders';

export const GRAVITY = 9.81; // [m/s²]

/**
 * Representative angular frequency of the waves people make in a puddle,
 * used only by the Stokes-layer friction law. A 5 Hz ripple (wavelength a few
 * cm at these depths) is typical of slaps and stirring: ω = 2π·5 ≈ 31 rad/s.
 */
export const OMEGA_REF = 2 * Math.PI * 5;

/** Smallest depth the friction law and the height floor will use [m]. */
const H_MIN = 0.0005;

export interface Impulse {
  x: number;
  z: number;
  /** footprint radius [m] */
  radius: number;
  /** pressure impulse Π₀ [Pa·s] (0 for a pure push) */
  pressureImpulse: number;
  /** direct velocity added at the centre [m/s] */
  push?: [number, number];
  /** volume added (+) or removed (−) [m³] */
  volume?: number;
}

/** A finger held down on the surface: steady pressure p [Pa] over radius R. */
export interface Press {
  x: number;
  z: number;
  radius: number;
  pressure: number;
}

export class ShallowWaterSolver {
  readonly grid: Grid;
  readonly shape: PuddleShape;
  fluid: FluidProperties;
  gravity = GRAVITY;
  /** extra linear damping [1/s]; 0 = purely physical damping */
  extraDamping = 0;
  /** multiplies time; 0 pauses */
  timeScale = 1;

  /** RGBA16F, linear-filtered: η, ∂η/∂x, ∂η/∂z, |u| */
  readonly surface: THREE.WebGLRenderTarget;
  /** RGBA16F, linear-filtered: R = sdf, G = H (rest depth) */
  readonly shapeTexture: THREE.DataTexture;
  lastPlan: StepPlan | null = null;
  simTime = 0;

  private renderer: THREE.WebGLRenderer;
  private state: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private shapeSim: THREE.DataTexture;
  private quad = new FullScreenQuad();
  private velocityMat: THREE.ShaderMaterial;
  private heightMat: THREE.ShaderMaterial;
  private limiterMat: THREE.ShaderMaterial;
  private impulseMat: THREE.ShaderMaterial;
  private surfaceMat: THREE.ShaderMaterial;
  private pending: Impulse[] = [];
  private maxDepth: number;

  constructor(renderer: THREE.WebGLRenderer, shape: PuddleShape, fluid: FluidProperties) {
    this.renderer = renderer;
    this.shape = shape;
    this.grid = shape.grid;
    this.fluid = fluid;
    const { nx, nz } = this.grid;

    // Full 32-bit floats for the simulation state where the GPU can render to
    // them (needed for millimetre-scale heights accumulating tiny updates);
    // half floats as a fallback.
    const canFloat = renderer.extensions.has('EXT_color_buffer_float');
    const makeState = () =>
      new THREE.WebGLRenderTarget(nx, nz, {
        type: canFloat ? THREE.FloatType : THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });
    this.state = [makeState(), makeState()];

    this.surface = new THREE.WebGLRenderTarget(nx, nz, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });

    this.shapeSim = new THREE.DataTexture(shape.data, nx, nz, THREE.RGBAFormat, THREE.FloatType);
    this.shapeSim.needsUpdate = true;

    const half = new Uint16Array(nx * nz * 4);
    this.maxDepth = 0;
    for (let k = 0; k < nx * nz; k++) {
      const H = shape.data[k * 4];
      this.maxDepth = Math.max(this.maxDepth, H);
      half[k * 4] = THREE.DataUtils.toHalfFloat(shape.data[k * 4 + 1]);
      half[k * 4 + 1] = THREE.DataUtils.toHalfFloat(H);
    }
    this.shapeTexture = new THREE.DataTexture(half, nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
    this.shapeTexture.minFilter = THREE.LinearFilter;
    this.shapeTexture.magFilter = THREE.LinearFilter;
    this.shapeTexture.needsUpdate = true;

    const common = () => ({
      uState: { value: null as THREE.Texture | null },
      uShape: { value: this.shapeSim },
      uSize: { value: new THREE.Vector2(nx, nz) },
      uDx: { value: this.grid.dx },
    });
    const mat = (fragmentShader: string, extra: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVertex,
        fragmentShader,
        uniforms: { ...common(), ...extra },
        depthTest: false,
        depthWrite: false,
      });

    this.velocityMat = mat(velocityFragment, {
      uDt: { value: 0 },
      uG: { value: this.gravity },
      uSigmaRho: { value: 0 },
      uOrigin: { value: new THREE.Vector2(-DOMAIN_X / 2, -DOMAIN_Z / 2) },
      uPressCount: { value: 0 },
      uPress: { value: Array.from({ length: MAX_PRESSES }, () => new THREE.Vector4()) },
      ...this.rheoUniforms(),
      uOmegaRef: { value: OMEGA_REF },
      uHMin: { value: H_MIN },
      uUMax: { value: U_MAX },
      uExtraDamp: { value: 0 },
      uCs: { value: 0.17 },
    });
    this.heightMat = mat(heightFragment, { uDt: { value: 0 }, uHMin: { value: H_MIN } });
    this.limiterMat = mat(limiterFragment, { uDt: { value: 0 }, uHMin: { value: H_MIN } });
    this.impulseMat = mat(impulseFragment, {
      uCount: { value: 0 },
      uImp: { value: Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4()) },
      uPush: { value: Array.from({ length: MAX_IMPULSES }, () => new THREE.Vector4()) },
      uOrigin: { value: new THREE.Vector2(-DOMAIN_X / 2, -DOMAIN_Z / 2) },
      uHMin: { value: H_MIN },
    });
    this.surfaceMat = mat(surfaceFragment, { uHMin: { value: H_MIN }, ...this.rheoUniforms() });
    this.setFluid(fluid);
  }

  private rheoUniforms() {
    return {
      uShearThick: { value: 0 },
      uRheo: { value: new THREE.Vector4() },
      uTauY: { value: 0 },
    };
  }

  /** Switch fluid: new properties, and the puddle starts calm. */
  setFluid(f: FluidProperties) {
    this.fluid = f;
    const r = rheologyUniforms(f);
    for (const m of [this.velocityMat, this.surfaceMat]) {
      m.uniforms.uShearThick.value = r.enabled;
      (m.uniforms.uRheo.value as THREE.Vector4).set(r.nu0, r.gammaC, r.n, r.nuMax);
      m.uniforms.uTauY.value = r.tauY;
    }
    this.reset();
  }

  /** Flatten the surface and stop all motion. */
  reset() {
    const prev = this.renderer.getClearColor(new THREE.Color());
    const prevA = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 0);
    for (const t of this.state) {
      this.renderer.setRenderTarget(t);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(prev, prevA);
    this.pending.length = 0;
  }

  /** Fingers currently held on the surface (up to MAX_PRESSES). */
  setPresses(presses: Press[]) {
    const u = this.velocityMat.uniforms;
    const list = presses.slice(0, MAX_PRESSES);
    list.forEach((p, k) => (u.uPress.value[k] as THREE.Vector4).set(p.x, p.z, p.radius, p.pressure / this.fluid.density));
    u.uPressCount.value = list.length;
  }

  /** Queue a slap / push; applied at the start of the next step. */
  addImpulse(imp: Impulse) {
    this.pending.push(imp);
  }

  /** Advance the simulation by one rendered frame of length frameDt [s]. */
  step(frameDt: number) {
    const dtFrame = Math.min(frameDt, 1 / 20) * this.timeScale;
    if (dtFrame > 0) {
      const f = this.fluid;
      // budget for crests up to twice the rest depth (waves raise the local
      // depth, and with it the wave speed)
      // (viscosity no longer limits dt: friction is implicit and the in-plane
      // viscous term is capped at its own stability limit, see shaders.ts)
      const plan = planSteps(dtFrame, this.grid.dx, 2 * this.maxDepth, this.gravity, f.surfaceTension / f.density, 0);
      this.lastPlan = plan;

      const vu = this.velocityMat.uniforms;
      vu.uDt.value = plan.dt;
      vu.uG.value = this.gravity;
      vu.uSigmaRho.value = f.surfaceTension / f.density;
      vu.uExtraDamp.value = this.extraDamping;
      this.heightMat.uniforms.uDt.value = plan.dt;
      this.limiterMat.uniforms.uDt.value = plan.dt;

      this.applyImpulses();
      for (let n = 0; n < plan.substeps; n++) {
        this.pass(this.velocityMat);
        this.pass(this.limiterMat);
        this.pass(this.heightMat);
      }
      this.simTime += plan.dt * plan.substeps;
    }
    this.surfaceMat.uniforms.uState.value = this.state[0].texture;
    this.renderer.setRenderTarget(this.surface);
    this.quad.material = this.surfaceMat;
    this.quad.render(this.renderer);
    this.renderer.setRenderTarget(null);
  }

  private applyImpulses() {
    while (this.pending.length) {
      const batch = this.pending.splice(0, MAX_IMPULSES);
      const u = this.impulseMat.uniforms;
      batch.forEach((imp, k) => {
        (u.uImp.value[k] as THREE.Vector4).set(imp.x, imp.z, imp.radius, imp.pressureImpulse / this.fluid.density);
        const amp = (imp.volume ?? 0) / (Math.PI * imp.radius * imp.radius);
        (u.uPush.value[k] as THREE.Vector4).set(imp.push?.[0] ?? 0, imp.push?.[1] ?? 0, amp, 0);
      });
      u.uCount.value = batch.length;
      this.pass(this.impulseMat);
    }
  }

  /** Run one fullscreen pass: read state[0], write state[1], swap. */
  private pass(material: THREE.ShaderMaterial) {
    material.uniforms.uState.value = this.state[0].texture;
    this.renderer.setRenderTarget(this.state[1]);
    this.quad.material = material;
    this.quad.render(this.renderer);
    this.state.reverse();
  }

  /** World xz of the grid's corner, and the grid's size in metres. */
  get origin(): [number, number] {
    return [-DOMAIN_X / 2, -DOMAIN_Z / 2];
  }
  get extent(): [number, number] {
    return [this.grid.nx * this.grid.dx, this.grid.nz * this.grid.dx];
  }

  /** Rest depth H at a world point [m] (0 outside the puddle). */
  depthAt(x: number, z: number): number {
    const { nx, nz, dx } = this.grid;
    const i = Math.floor((x + DOMAIN_X / 2) / dx);
    const j = Math.floor((z + DOMAIN_Z / 2) / dx);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
    return this.shape.data[(j * nx + i) * 4];
  }

  /** Signed distance to the edge at a world point (CPU lookup, nearest cell). */
  sdfAt(x: number, z: number): number {
    const { nx, nz, dx } = this.grid;
    const i = Math.floor((x + DOMAIN_X / 2) / dx);
    const j = Math.floor((z + DOMAIN_Z / 2) / dx);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return 1;
    return this.shape.data[(j * nx + i) * 4 + 1];
  }

  /** Read the raw state back to the CPU (slow; for tests and validation). */
  readState(): Float32Array {
    const { nx, nz } = this.grid;
    const out = new Float32Array(nx * nz * 4);
    this.renderer.readRenderTargetPixels(this.state[0], 0, 0, nx, nz, out);
    return out;
  }

  /** Summary numbers for tests: max |η|, max |u|, total volume change. */
  diagnostics() {
    const s = this.readState();
    let maxEta = 0, maxU = 0, volume = 0, nan = 0;
    const cellArea = this.grid.dx * this.grid.dx;
    for (let k = 0; k < s.length; k += 4) {
      if (!Number.isFinite(s[k]) || !Number.isFinite(s[k + 1])) { nan++; continue; }
      maxEta = Math.max(maxEta, Math.abs(s[k]));
      maxU = Math.max(maxU, Math.abs(s[k + 1]), Math.abs(s[k + 2]));
      volume += s[k] * cellArea;
    }
    return { maxEtaMm: maxEta * 1000, maxU, volumeChangeMl: volume * 1e6, nan };
  }

  dispose() {
    this.state.forEach((t) => t.dispose());
    this.surface.dispose();
    this.shapeSim.dispose();
    this.shapeTexture.dispose();
    [this.velocityMat, this.heightMat, this.limiterMat, this.impulseMat, this.surfaceMat].forEach((m) => m.dispose());
    this.quad.dispose();
  }
}
