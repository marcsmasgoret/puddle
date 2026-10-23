// Wet splats on the ground where drops land. A single half-float texture over
// the area around the puddle holds "wetness" 0…1. New splats are stamped with
// MAX blending; every frame the whole map is multiplied by exp(−dt/τ) so the
// ground dries out over about a minute (τ = 40 s).
import * as THREE from 'three';

export const WETMAP_SIZE: [number, number] = [5.2, 4.2]; // metres, centred on the puddle
const RES: [number, number] = [1024, 828];
const DRY_TAU = 40;

export class WetMap {
  readonly target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-WETMAP_SIZE[0] / 2, WETMAP_SIZE[0] / 2, WETMAP_SIZE[1] / 2, -WETMAP_SIZE[1] / 2, 0, 1);
  private splats: THREE.InstancedMesh;
  private decayScene = new THREE.Scene();
  private decayMat: THREE.ShaderMaterial;
  private pending: { x: number; z: number; r: number }[] = [];
  private dummy = new THREE.Object3D();

  constructor() {
    this.target = new THREE.WebGLRenderTarget(RES[0], RES[1], {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    // looking straight down; texture u = x/W + ½, v = ½ − z/H
    this.camera.position.set(0, 0.5, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    this.decayMat = new THREE.ShaderMaterial({
      uniforms: { uFactor: { value: 1 } },
      vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform float uFactor; void main(){ gl_FragColor = vec4(uFactor); }',
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.decayMat);
    quad.frustumCulled = false;
    this.decayScene.add(quad);

    const splatMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv * 2.0 - 1.0;
          vSeed = instanceMatrix[3].x * 31.7 + instanceMatrix[3].z * 17.3;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          // irregular blot: radius wobbles with angle
          float a = atan(vUv.y, vUv.x);
          float r = 0.75 + 0.12 * sin(a * 5.0 + vSeed) + 0.08 * sin(a * 9.0 + vSeed * 2.3);
          float d = length(vUv);
          if (d > r) discard;
          gl_FragColor = vec4(1.0 - smoothstep(r * 0.7, r, d) * 0.4);
        }`,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      depthTest: false,
      depthWrite: false,
    });
    const g = new THREE.PlaneGeometry(2, 2);
    g.rotateX(-Math.PI / 2);
    this.splats = new THREE.InstancedMesh(g, splatMat, 256);
    this.splats.frustumCulled = false;
    this.splats.count = 0;
    this.scene.add(this.splats);
  }

  /** Dry everything instantly (used when the fluid changes). */
  clear(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(this.target);
    const prev = renderer.getClearColor(new THREE.Color());
    const a = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.setClearColor(prev, a);
    renderer.setRenderTarget(null);
    this.pending.length = 0;
  }

  /** Queue a wet blot of radius r [m] at world (x, z). */
  stamp(x: number, z: number, r: number) {
    this.pending.push({ x, z, r });
  }

  update(renderer: THREE.WebGLRenderer, dt: number) {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.target);
    this.decayMat.uniforms.uFactor.value = Math.exp(-dt / DRY_TAU);
    renderer.render(this.decayScene, this.camera);
    if (this.pending.length) {
      const batch = this.pending.splice(0, 256);
      batch.forEach((s, i) => {
        this.dummy.position.set(s.x, 0, s.z);
        this.dummy.scale.setScalar(s.r);
        this.dummy.updateMatrix();
        this.splats.setMatrixAt(i, this.dummy.matrix);
      });
      this.splats.count = batch.length;
      this.splats.instanceMatrix.needsUpdate = true;
      renderer.render(this.scene, this.camera);
    }
    renderer.setRenderTarget(null);
    renderer.autoClear = auto;
  }
}
