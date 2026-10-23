// Sky, sun and haze. A palette describes one lighting mood; Phase 6 will
// blend between palettes for time of day and weather.
import * as THREE from 'three';
import { NOISE } from '../render/glsl';

export interface Palette {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  /** colour distant layers fade into */
  haze: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  /** elevation and azimuth of the sun [rad]; azimuth 0 = straight ahead (−z) */
  sunElevation: number;
  sunAzimuth: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  cloudColor: THREE.Color;
  cloudAmount: number;
}

export const LATE_AFTERNOON: Palette = {
  skyTop: new THREE.Color('#6d9bd1'),
  skyHorizon: new THREE.Color('#f6dcc0'),
  haze: new THREE.Color('#c8d6dc'),
  sunColor: new THREE.Color('#ffe6c2'),
  sunIntensity: 3.6,
  sunElevation: THREE.MathUtils.degToRad(24),
  sunAzimuth: THREE.MathUtils.degToRad(-58),
  hemiSky: new THREE.Color('#c4dbf0'),
  hemiGround: new THREE.Color('#6b6a48'),
  hemiIntensity: 1.5,
  cloudColor: new THREE.Color('#fff4ea'),
  cloudAmount: 0.45,
};

export function sunDirection(p: Palette, target = new THREE.Vector3()) {
  const ce = Math.cos(p.sunElevation);
  return target.set(Math.sin(p.sunAzimuth) * ce, Math.sin(p.sunElevation), -Math.cos(p.sunAzimuth) * ce).normalize();
}

/** A huge inverted sphere with a gradient sky, sun (or moon), clouds and stars. */
export function createSky(p: Palette) {
  const uniforms = {
    uTop: { value: p.skyTop.clone() },
    uHorizon: { value: p.skyHorizon.clone() },
    uSunDir: { value: sunDirection(p) },
    uSunColor: { value: p.sunColor.clone() },
    uCloud: { value: p.cloudColor.clone() },
    uCloudAmount: { value: p.cloudAmount },
    uNight: { value: 0 },
    uOvercast: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunDir, uSunColor, uCloud;
      uniform float uCloudAmount, uNight, uOvercast, uTime;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        float s = max(dot(d, uSunDir), 0.0);
        // gradient: horizon band warmed toward the sun
        vec3 horizon = mix(uHorizon, uHorizon * vec3(1.08, 0.98, 0.9), pow(s, 4.0) * (1.0 - uNight));
        vec3 col = mix(horizon, uTop, pow(smoothstep(0.0, 0.4, y), 0.6));
        if (d.y < 0.0) col = horizon;
        // stars: sparse hashed points, twinkling, fading toward the horizon
        if (uNight > 0.0) {
          vec2 sp = d.xz / max(d.y + 0.15, 0.05) * 140.0;
          vec2 cell = floor(sp);
          float h = hash12(cell);
          vec2 o = hash22(cell) - 0.5;
          float star = smoothstep(0.08, 0.0, length(fract(sp) - 0.5 - o * 0.6)) * step(0.985, h);
          star *= 0.6 + 0.4 * sin(uTime * (1.5 + 3.0 * h) + h * 40.0);
          col += vec3(0.9, 0.95, 1.0) * star * uNight * smoothstep(0.05, 0.3, y) * (1.0 - uOvercast);
        }
        // soft stratus streaks, projected on a high flat layer
        vec2 cp = d.xz / max(d.y + 0.08, 0.02) * 0.6;
        float c = fbm(cp * vec2(0.6, 2.2) + vec2(3.0 + uTime * 0.004, 1.0));
        c = smoothstep(0.62 - 0.3 * uCloudAmount, 0.95, c) * smoothstep(0.0, 0.12, d.y) * (1.0 - smoothstep(0.35, 0.8, d.y));
        col = mix(col, uCloud * (1.0 + 0.5 * pow(s, 3.0)), c * 0.55 * (1.0 - uOvercast));
        // sun by day (HDR disc that blooms) or a small, cool moon by night
        float disc = mix(smoothstep(0.9994, 0.9997, s) * 30.0, smoothstep(0.99955, 0.9997, s) * 6.0, uNight);
        float glow = mix(pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.18, pow(s, 200.0) * 0.4, uNight);
        col += uSunColor * (disc + glow) * (1.0 - 0.9 * uOvercast);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, uniforms };
}
