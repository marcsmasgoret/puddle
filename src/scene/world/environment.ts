// Sky, sun/moon, ambient light, fog and the reflection environment, all
// driven by one Mood (time of day × weather × season).
import * as THREE from 'three';
import { createSky, sunDirection } from '../atmosphere';
import { LAYER_REFLECT } from '../../render/pipeline';
import type { Mood } from './palettes';

export class Environment {
  readonly sky: ReturnType<typeof createSky>;
  readonly sun = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  mood: Mood;
  private pmrem: THREE.PMREMGenerator;
  private envSky: ReturnType<typeof createSky>;
  private envScene = new THREE.Scene();
  private envRT: THREE.WebGLRenderTarget | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    initial: Mood,
    shadowSize: number,
  ) {
    this.mood = initial;
    this.sky = createSky(initial);
    this.envSky = createSky(initial);
    this.sky.mesh.layers.enable(LAYER_REFLECT);
    scene.add(this.sky.mesh);
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.layers.enable(LAYER_REFLECT);
    this.hemi.layers.enable(LAYER_REFLECT);
    scene.add(sun, sun.target, this.hemi);
    scene.fog = new THREE.Fog(initial.haze, initial.fogNear, initial.fogFar);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene.add(this.envSky.mesh);
    this.apply(initial);
  }

  apply(m: Mood) {
    this.mood = m;
    sunDirection(m, this.sunDir);
    for (const u of [this.sky.uniforms, this.envSky.uniforms]) {
      u.uTop.value.copy(m.skyTop);
      u.uHorizon.value.copy(m.skyHorizon);
      u.uSunDir.value.copy(this.sunDir);
      u.uSunColor.value.copy(m.sunColor);
      u.uCloud.value.copy(m.cloudColor);
      u.uCloudAmount.value = m.cloudAmount;
      u.uNight.value = m.night;
      u.uOvercast.value = m.overcast;
    }
    this.sun.color.copy(m.sunColor);
    this.sun.intensity = m.sunIntensity;
    this.sun.position.copy(this.sunDir).multiplyScalar(60);
    // overcast light is soft: no crisp shadows
    this.sun.castShadow = m.overcast < 0.5;
    this.hemi.color.copy(m.hemiSky);
    this.hemi.groundColor.copy(m.hemiGround);
    this.hemi.intensity = m.hemiIntensity;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(m.haze);
    fog.near = m.fogNear;
    fog.far = m.fogFar;
    this.renderer.toneMappingExposure = m.exposure;
    // re-bake the sky into the environment map for glossy surfaces
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.6 * (1 - 0.6 * m.night);
  }

  update(t: number) {
    this.sky.uniforms.uTime.value = t;
  }
}
