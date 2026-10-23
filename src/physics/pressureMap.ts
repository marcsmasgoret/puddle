// ─────────────────────────────────────────────────────────────────────────────
// Surface pressure map
//
// Anything resting on or pressing into the surface (a held finger, a floating
// duck) acts on the fluid as a pressure load p(x, z). In the momentum
// equation it appears next to gravity:
//
//     ∂u/∂t = −g ∇η − ∇p / ρ + …
//
// Each load is a Gaussian p₀ exp(−r²/R²). They are drawn additively into a
// grid-sized texture once per frame (one draw call however many there are),
// and the velocity pass reads p/ρ straight from it.
//
// A floating body's loads add up to its weight (Archimedes: at rest the
// buoyant force equals the weight, and the fluid feels the equal and
// opposite push). Moving loads therefore push waves ahead of them and leave
// a wake behind, which is the body-to-fluid half of the two-way coupling.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface Load {
  x: number;
  z: number;
  /** Gaussian radius [m] */
  radius: number;
  /** peak pressure p₀ [Pa] */
  pressure: number;
}

const MAX_LOADS = 128;

export class PressureMap {
  readonly target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private mesh: THREE.InstancedMesh;
  private amp: THREE.InstancedBufferAttribute;
  private dummy = new THREE.Object3D();
  private loads: Load[] = [];

  constructor(nx: number, nz: number, origin: [number, number], extent: [number, number]) {
    this.target = new THREE.WebGLRenderTarget(nx, nz, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    // orthographic view of the grid: x → texel i, z → texel j
    const [ox, oz] = origin;
    const [ex, ez] = extent;
    this.camera = new THREE.OrthographicCamera(ox, ox + ex, oz + ez, oz, -1, 1);

    const geo = new THREE.PlaneGeometry(6, 6); // ±3 R covers 99.99 % of a Gaussian
    this.amp = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LOADS), 1);
    geo.setAttribute('aAmp', this.amp);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aAmp;
        varying vec2 vP;
        varying float vAmp;
        void main() {
          vP = position.xy;           // in units of R
          vAmp = aAmp;
          gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        varying float vAmp;
        void main() { gl_FragColor = vec4(vAmp * exp(-dot(vP, vP)), 0.0, 0.0, 1.0); }`,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_LOADS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }

  /** Loads for this frame (pressures in Pa; stored as p/ρ). */
  set(loads: Load[]) {
    this.loads = loads.slice(0, MAX_LOADS);
  }

  render(renderer: THREE.WebGLRenderer, density: number) {
    const n = this.loads.length;
    this.loads.forEach((l, k) => {
      // the plane lies in xy; the camera looks down −z with y as world z
      this.dummy.position.set(l.x, l.z, 0);
      this.dummy.scale.set(l.radius, l.radius, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(k, this.dummy.matrix);
      this.amp.setX(k, l.pressure / density);
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.amp.needsUpdate = true;
    const prev = renderer.getClearColor(new THREE.Color());
    const a = renderer.getClearAlpha();
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    if (n) renderer.render(this.scene, this.camera);
    renderer.setClearColor(prev, a);
    renderer.setRenderTarget(null);
  }
}
