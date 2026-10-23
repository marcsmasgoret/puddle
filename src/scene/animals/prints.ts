// Footprints in the snow: a stamp texture over the ground behind the puddle.
// Each footfall stamps a small oval (MAX blending); fresh snow slowly fills
// them in again (decay over a few minutes).
import * as THREE from 'three';

export const PRINTS_AREA = { x0: -8, z0: -9, w: 16, d: 9 };
const RES: [number, number] = [2048, 1152]; // ≈ 8 mm per texel
const FILL_TAU = 240; // [s]

export class Prints {
  readonly target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private stamps: THREE.InstancedMesh;
  private fade = new THREE.Scene();
  private fadeMat: THREE.ShaderMaterial;
  private pending: { x: number; z: number; w: number; l: number; yaw: number; depth: number }[] = [];
  private dummy = new THREE.Object3D();
  private fadeAcc = 0;
  /** seconds of fading still needed before the map is blank again */
  private live = 0;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(RES[0], RES[1], { type: THREE.HalfFloatType, depthBuffer: false });
    const { x0, z0, w, d } = PRINTS_AREA;
    // top-down with world −z up the texture (same as the wet map):
    // u = (x − x0)/w,  v = (z0 + d − z)/d
    this.camera = new THREE.OrthographicCamera(x0, x0 + w, -z0, -(z0 + d), -1, 1);
    this.camera.position.set(0, 0.5, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.fadeMat = new THREE.ShaderMaterial({
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
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fadeMat);
    q.frustumCulled = false;
    this.fade.add(q);
    const g = new THREE.PlaneGeometry(2, 2);
    g.rotateX(-Math.PI / 2);
    const depth = new THREE.InstancedBufferAttribute(new Float32Array(256), 1);
    g.setAttribute('aDepth', depth);
    this.stamps = new THREE.InstancedMesh(
      g,
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aDepth;
          varying vec2 vUv; varying float vD;
          void main() { vUv = uv * 2.0 - 1.0; vD = aDepth; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv; varying float vD;
          void main() { float d = length(vUv); if (d > 1.0) discard; gl_FragColor = vec4(vD * (1.0 - d * d * 0.6)); }`,
        blending: THREE.CustomBlending,
        blendEquation: THREE.MaxEquation,
        depthTest: false,
        depthWrite: false,
      }),
      256,
    );
    this.stamps.frustumCulled = false;
    this.stamps.count = 0;
    this.scene.add(this.stamps);
  }

  /** a footprint: an oval w × l [m] at (x, z), turned by yaw, of depth 0…1 */
  stamp(x: number, z: number, w: number, l: number, yaw: number, depth = 1) {
    this.pending.push({ x, z, w, l, yaw, depth });
  }

  clear(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.setRenderTarget(null);
  }

  update(renderer: THREE.WebGLRenderer, dt: number) {
    // nothing to draw and nothing left to fade: skip the (large) map entirely
    this.fadeAcc += dt;
    const doFade = this.live > 0 && this.fadeAcc >= 0.25;
    if (!doFade && !this.pending.length) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.target);
    if (doFade) {
      this.fadeMat.uniforms.uFactor.value = Math.exp(-this.fadeAcc / FILL_TAU);
      renderer.render(this.fade, this.camera);
      this.live -= this.fadeAcc;
      this.fadeAcc = 0;
    }
    if (this.pending.length) {
      this.live = FILL_TAU * 5;
      const batch = this.pending.splice(0, 256);
      const depth = this.stamps.geometry.attributes.aDepth as THREE.InstancedBufferAttribute;
      batch.forEach((s, i) => {
        this.dummy.position.set(s.x, 0, s.z);
        this.dummy.rotation.set(0, s.yaw, 0);
        this.dummy.scale.set(s.l / 2, 1, s.w / 2);
        this.dummy.updateMatrix();
        this.stamps.setMatrixAt(i, this.dummy.matrix);
        depth.setX(i, s.depth);
      });
      depth.needsUpdate = true;
      this.stamps.count = batch.length;
      this.stamps.instanceMatrix.needsUpdate = true;
      renderer.render(this.scene, this.camera);
    }
    renderer.setRenderTarget(null);
    renderer.autoClear = auto;
  }
}
