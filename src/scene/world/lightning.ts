// Lightning: in rain, a strike every ~10–40 s somewhere ahead.
//
// A cloud-to-ground flash is not one spark. A stepped leader opens a
// channel, then usually 3 or 4 return strokes race up it 40–120 ms apart,
// each a fierce flash that fades in tens of milliseconds: that is why
// lightning flickers. Each stroke here lights the sky and the scene (the
// hemisphere light) and makes the channel glow. The channel is a jagged
// path (midpoint displacement) with a few forks that only show on the first
// stroke. Strikes farther off stay hidden in the cloud and only light it
// from inside.
//
// Thunder: the light arrives at once, the sound at 343 m/s, so it rolls in
// d / 343 s after the flash (about 3 s per km: count and divide by three).
// Near strikes crack; far ones only rumble, the air having soaked up the
// highs on the way (audio: nature.ts).
import * as THREE from 'three';
import type { Environment } from './environment';
import { LAYER_REFLECT } from '../../render/pipeline';

/** bolts are drawn just inside the sky dome (radius 500 m) */
const SKY_R = 430;
/** cloud base above the ground [m]: sets how tall a strike at distance d looks */
const CLOUD_BASE = 1500;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface Strike {
  /** how far away it struck [m] */
  distance: number;
  /** bearing from straight ahead [rad], positive to the right */
  azimuth: number;
}

export class Lightning {
  enabled = false;
  private wait = rand(4, 10);
  /** return strokes of the current flash: [start time s, strength] */
  private strokes: [number, number][] = [];
  private age = 1e9;
  private power = 0;
  private showBolt = false;
  private lit = false;
  private bolt: THREE.Mesh;
  private glow: THREE.Mesh;
  private boltMat: THREE.MeshBasicMaterial;
  private glowMat: THREE.MeshBasicMaterial;
  private white = new THREE.Color('#e9efff');

  constructor(
    scene: THREE.Scene,
    private env: Environment,
    private onStrike: (s: Strike) => void,
  ) {
    const mat = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
    this.boltMat = mat('#f6f8ff');
    this.glowMat = mat('#8fa6ff');
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), this.boltMat);
    this.glow = new THREE.Mesh(new THREE.BufferGeometry(), this.glowMat);
    for (const m of [this.glow, this.bolt]) {
      m.frustumCulled = false;
      m.visible = false;
      m.layers.enable(LAYER_REFLECT); // the flash shows in the puddle too
      scene.add(m);
    }
  }

  update(dt: number, camera: THREE.Camera) {
    if (this.enabled) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.strike(camera);
        this.wait = rand(10, 40);
      }
    } else this.strokes = [];
    this.age += dt;
    let f = 0;
    for (const [s, a] of this.strokes) if (this.age >= s) f += a * Math.exp(-(this.age - s) / 0.045);
    this.apply(f * this.power);
  }

  private strike(camera: THREE.Camera) {
    // a third stay inside the cloud, far off; the rest come down in view,
    // most of them a few km away, now and then a close one
    const cloud = Math.random() < 0.35;
    const distance = cloud ? rand(3000, 6000) : 800 + 3200 * Math.random() ** 2;
    const azimuth = rand(-0.45, 0.45);
    this.power = Math.min(1, 1600 / distance) * (cloud ? 0.55 : 1);
    this.strokes = [[0, 1]];
    let t = 0;
    const n = 1 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) this.strokes.push([(t += rand(0.04, 0.12)), rand(0.45, 0.9)]);
    this.age = 0;
    this.showBolt = !cloud;
    if (!cloud) this.buildBolt(camera, distance, azimuth);
    this.onStrike({ distance, azimuth });
  }

  /** brightness f (≈0…1) of the flash this frame */
  private apply(f: number) {
    const on = f > 0.004;
    if (!on && !this.lit) return;
    this.lit = on;
    const k = on ? Math.min(f, 1.2) : 0;
    const m = this.env.mood;
    const u = this.env.sky.uniforms;
    u.uTop.value.copy(m.skyTop).lerp(this.white, 0.35 * k);
    u.uHorizon.value.copy(m.skyHorizon).lerp(this.white, 0.55 * k);
    u.uCloud.value.copy(m.cloudColor).lerp(this.white, 0.65 * k);
    this.env.hemi.intensity = m.hemiIntensity + 1.8 * k;
    const b = this.showBolt ? Math.min(1, k * 1.6) : 0;
    this.boltMat.opacity = b;
    this.glowMat.opacity = 0.35 * b;
    this.bolt.visible = this.glow.visible = b > 0.01;
  }

  private buildBolt(camera: THREE.Camera, distance: number, azimuth: number) {
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const dir = fwd.clone().multiplyScalar(Math.cos(azimuth)).addScaledVector(right, Math.sin(azimuth));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const base = new THREE.Vector3(camera.position.x, 0, camera.position.z).addScaledVector(dir, SKY_R);
    // as tall as a real channel from the cloud base would look from here
    const top = SKY_R * Math.tan(Math.min(Math.atan(CLOUD_BASE / distance), 0.5));
    // points in the bolt's plane: (sideways, height)
    const zigzag = (a: [number, number], b: [number, number], depth: number, rough: number): [number, number][] => {
      let pts = [a, b];
      for (let d = 0; d < depth; d++) {
        const next: [number, number][] = [pts[0]];
        for (let k = 1; k < pts.length; k++) {
          const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
          const len = Math.hypot(x1 - x0, y1 - y0);
          next.push([(x0 + x1) / 2 + (Math.random() - 0.5) * len * rough, (y0 + y1) / 2 + (Math.random() - 0.5) * len * rough * 0.3], pts[k]);
        }
        pts = next;
      }
      return pts;
    };
    const main = zigzag([0, top], [rand(-0.2, 0.2) * top, -2], 7, 0.55);
    const paths: [[number, number][], number][] = [[main, 1]];
    const forks = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < forks; k++) {
      const from = main[Math.floor(rand(0.1, 0.6) * main.length)];
      const len = top * rand(0.15, 0.35);
      const ang = rand(0.4, 1.1) * (Math.random() < 0.5 ? -1 : 1);
      paths.push([zigzag(from, [from[0] + Math.sin(ang) * len, from[1] - Math.cos(ang) * len], 5, 0.6), 0.45]);
    }
    // ribbons a few pixels wide, facing the viewer, a wide soft one for the glow
    const w = SKY_R * 0.0028 * (0.7 + 0.5 * this.power);
    const ribbon = (scale: number) => {
      const v: number[] = [];
      const P = ([s, y]: [number, number]) => base.clone().addScaledVector(side, s).setY(y);
      for (const [pts, thick] of paths) {
        for (let k = 1; k < pts.length; k++) {
          const a = P(pts[k - 1]), b = P(pts[k]);
          const n = new THREE.Vector3().subVectors(b, a).cross(dir).normalize().multiplyScalar((w * scale * thick) / 2);
          const q = [a.clone().sub(n), a.clone().add(n), b.clone().add(n), b.clone().sub(n)];
          for (const i of [0, 1, 2, 0, 2, 3]) v.push(q[i].x, q[i].y, q[i].z);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      return g;
    };
    this.bolt.geometry.dispose();
    this.glow.geometry.dispose();
    this.bolt.geometry = ribbon(1);
    this.glow.geometry = ribbon(7);
  }
}
