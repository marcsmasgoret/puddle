// Frame pipeline:
//   1. reflection  – scene seen from a camera mirrored below the water plane
//   2. opaque      – everything except the water, into a texture + depth
//   3. composite   – copy (2) to the output, then draw the water on top,
//                    sampling (1) and (2) for reflection and refraction
//   4. bloom       – soft glow around the brightest highlights (sun glints)
//   5. output      – ACES filmic tone mapping + sRGB
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Objects on this layer appear in the water's reflection. */
export const LAYER_REFLECT = 1;

class PuddlePass extends Pass {
  opaque: THREE.WebGLRenderTarget;
  reflection: THREE.WebGLRenderTarget;
  reflCam = new THREE.PerspectiveCamera();
  /** projection × view of the mirrored camera, read by the water shader */
  reflMatrix = new THREE.Matrix4();
  private copy: FullScreenQuad;
  private clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.002)];

  constructor(
    private scene: THREE.Scene,
    private waterScene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    samples: number,
  ) {
    super();
    this.opaque = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
    });
    this.reflection = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Math.min(samples, 2) });
    this.copy = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tColor: { value: this.opaque.texture }, tDepth: { value: this.opaque.depthTexture } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform sampler2D tColor, tDepth; varying vec2 vUv;
          void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).r; }`,
        depthTest: true,
        depthWrite: true,
        depthFunc: THREE.AlwaysDepth,
      }),
    );
  }

  setSize(w: number, h: number) {
    this.opaque.setSize(w, h);
    this.reflection.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    const cam = this.camera;

    // 1. mirror the camera through the plane y = 0
    const rc = this.reflCam;
    rc.copy(cam, false);
    rc.position.set(cam.position.x, -cam.position.y, cam.position.z);
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    rc.up.set(0, 1, 0);
    rc.lookAt(rc.position.clone().add(new THREE.Vector3(fwd.x, -fwd.y, fwd.z)));
    rc.updateMatrixWorld();
    this.reflMatrix.multiplyMatrices(rc.projectionMatrix, rc.matrixWorldInverse);
    rc.layers.set(LAYER_REFLECT);
    renderer.shadowMap.needsUpdate = true; // refreshed once per frame, by the first render
    renderer.clippingPlanes = this.clip; // drop anything below the water line
    renderer.setRenderTarget(this.reflection);
    renderer.clear();
    renderer.render(this.scene, rc);
    renderer.clippingPlanes = [];

    // 2. opaque scene
    renderer.setRenderTarget(this.opaque);
    renderer.clear();
    renderer.render(this.scene, cam);

    // 3. composite
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.clear();
    this.copy.render(renderer);
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.waterScene, cam);
    renderer.autoClear = auto;
  }
}

export class PuddleRenderer {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  private main: PuddlePass;

  constructor(
    private renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    waterScene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    private waterUniforms: Record<string, THREE.IUniform>,
    samples: number,
  ) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(renderer, target);
    this.main = new PuddlePass(scene, waterScene, camera, samples);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.0);
    this.composer.addPass(this.main);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    waterUniforms.uSceneColor.value = this.main.opaque.texture;
    waterUniforms.uSceneDepth.value = this.main.opaque.depthTexture;
    waterUniforms.uReflection.value = this.main.reflection.texture;
    waterUniforms.uReflMatrix.value = this.main.reflMatrix;
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    const W = Math.round(w * pixelRatio), Hh = Math.round(h * pixelRatio);
    this.main.setSize(W, Hh);
    (this.waterUniforms.uResolution.value as THREE.Vector2).set(W, Hh);
  }

  render(dt: number) {
    this.composer.render(dt);
  }
}
