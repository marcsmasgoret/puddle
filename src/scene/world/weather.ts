// Weather: rain, snow and wind, each acting on the fluid physically.
//
//  Rain   Drops of ~1–2.5 mm fall at their terminal velocity (≈ 6.5 m/s for
//         2 mm drops, Gunn & Kinzer 1949). Each one that lands on the puddle
//         hands over its momentum m·v and volume, exactly like a splash drop
//         landing (dropImpact in main.ts): real rings, everywhere at once.
//         Moderate rain ≈ 4 mm/h ≈ 250 drops per m² per second; we simulate
//         a sparser, visually readable fraction of the larger drops.
//
//  Snow   Flakes fall at ~1 m/s, swaying. They melt into the puddle without
//         disturbing it (their momentum is negligible).
//
//  Wind   (a) Mean surface stress τ = ρ_air C_D U² (solver.setWind) slowly
//         drives a drift current. (b) Turbulent gusts press on the surface as
//         patches of fluctuating pressure (a few Pa) moving with the wind:
//         Phillips' (1957) mechanism for how wind first raises ripples.
//         Here they are moving Gaussian pressure loads, so the "cat's paws"
//         that scud across the puddle are real solver waves. (c) Drag on the
//         toys above the water, ½ ρ_air C_d A U², pushes them downwind.
import * as THREE from 'three';
import type { Weather } from './palettes';
import type { Load } from '../../physics/pressureMap';

const RHO_AIR = 1.204;

export class WeatherSystem {
  kind: Weather = 'clear';
  /** wind velocity over the puddle [m/s] */
  readonly wind = new THREE.Vector2();
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private snow: THREE.Points;
  private snowPos: Float32Array;
  private gusts: { x: number; z: number; r: number; amp: number; phase: number }[] = [];
  private rainDebt = 0;
  private t = 0;
  private readonly N_RAIN: number;
  private readonly N_SNOW: number;

  constructor(
    scene: THREE.Scene,
    private bounds: { halfX: number; halfZ: number },
    private isWater: (x: number, z: number) => boolean,
    /** a drop (radius r, speed v) lands on the water at (x, z) */
    private onRaindrop: (x: number, z: number, r: number, v: number) => void,
    phone: boolean,
  ) {
    this.N_RAIN = phone ? 500 : 1200;
    this.N_SNOW = phone ? 500 : 1100;
    this.rainPos = new Float32Array(this.N_RAIN * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#dfe7ef', transparent: true, opacity: 0.32, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.snowPos = new Float32Array(this.N_SNOW * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: '#ffffff', size: 0.035, transparent: true, opacity: 0.9, depthWrite: false, map: snowflakeTexture(), alphaTest: 0.01 }),
    );
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    for (let k = 0; k < this.N_RAIN; k++) this.respawnRain(k, true);
    for (let k = 0; k < this.N_SNOW; k++) this.respawnSnow(k, true);
    scene.add(this.rain, this.snow);
  }

  set(kind: Weather) {
    this.kind = kind;
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
    // wind blows from the left, slightly toward us; stormy weather is breezy too
    const U = kind === 'wind' ? 7 : kind === 'rain' ? 2.5 : kind === 'snow' ? 1.5 : 0.6;
    this.wind.set(U * 0.95, U * 0.3);
    this.gusts = [];
    const n = kind === 'wind' ? 5 : kind === 'rain' ? 2 : 0;
    for (let k = 0; k < n; k++) this.gusts.push(this.newGust(true));
  }

  /** the volume (x ∈ ±6 m, z ∈ [−8, 1.5] m, y ∈ [0, 6] m) the camera sees */
  private respawnRain(k: number, anywhere = false) {
    const x = (Math.random() * 2 - 1) * 6, z = -8 + Math.random() * 9.5;
    const y = anywhere ? Math.random() * 6 : 6;
    this.rainPos.set([x, y, z, x, y + 0.18, z], k * 6);
  }
  private respawnSnow(k: number, anywhere = false) {
    this.snowPos.set([(Math.random() * 2 - 1) * 6, anywhere ? Math.random() * 5 : 5, -8 + Math.random() * 9.5], k * 3);
  }
  private newGust(anywhere = false) {
    const hx = this.bounds.halfX;
    return {
      x: anywhere ? (Math.random() * 2 - 1) * hx : -hx - 0.4,
      z: (Math.random() * 2 - 1) * this.bounds.halfZ,
      r: 0.18 + Math.random() * 0.2,
      amp: 1.5 + Math.random() * 3, // Pa
      phase: Math.random() * 6.28,
    };
  }

  /** wind drag on the part of a toy that sticks out of the water [N] */
  windForce(area: number) {
    const U = this.wind.length();
    return new THREE.Vector3(this.wind.x, 0, this.wind.y).multiplyScalar(0.5 * RHO_AIR * 1.0 * area * U);
  }

  /** gust pressure patches for this frame */
  loads(): Load[] {
    return this.gusts.map((g) => ({ x: g.x, z: g.z, radius: g.r, pressure: g.amp * Math.sin(this.t * 9 + g.phase) }));
  }

  update(dt: number) {
    this.t += dt;
    const wx = this.wind.x, wz = this.wind.y;
    if (this.kind === 'rain') {
      const vy = 6.5;
      for (let k = 0; k < this.N_RAIN; k++) {
        const o = k * 6;
        for (const j of [0, 3]) {
          this.rainPos[o + j] += wx * 0.4 * dt;
          this.rainPos[o + j + 1] -= vy * dt;
          this.rainPos[o + j + 2] += wz * 0.4 * dt;
        }
        // streak tilts with the wind
        this.rainPos[o + 3] = this.rainPos[o] - wx * 0.012;
        if (this.rainPos[o + 1] < 0) this.respawnRain(k);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      // impacts on the puddle: ~45 per second over its ~2.3 m² (a readable
      // fraction of real rain), drop radii 1–2.5 mm
      this.rainDebt += dt * 45;
      while (this.rainDebt >= 1) {
        this.rainDebt -= 1;
        for (let tries = 0; tries < 6; tries++) {
          const x = (Math.random() * 2 - 1) * this.bounds.halfX, z = (Math.random() * 2 - 1) * this.bounds.halfZ;
          if (this.isWater(x, z)) {
            const r = 0.001 + Math.random() * 0.0015;
            this.onRaindrop(x, z, r, 4 + r * 1200); // bigger drops fall faster
            break;
          }
        }
      }
    }
    if (this.kind === 'snow') {
      for (let k = 0; k < this.N_SNOW; k++) {
        const o = k * 3;
        this.snowPos[o] += (wx * 0.5 + Math.sin(this.t * 1.3 + k) * 0.25) * dt;
        this.snowPos[o + 1] -= (0.7 + (k % 5) * 0.08) * dt;
        this.snowPos[o + 2] += (wz * 0.5 + Math.cos(this.t * 1.1 + k * 1.7) * 0.2) * dt;
        if (this.snowPos[o + 1] < 0) this.respawnSnow(k);
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
    // gusts sweep across downwind at ~60 % of the wind speed
    for (let k = 0; k < this.gusts.length; k++) {
      const g = this.gusts[k];
      g.x += wx * 0.6 * dt * 0.25;
      g.z += wz * 0.6 * dt * 0.25;
      if (g.x > this.bounds.halfX + 0.5 || Math.abs(g.z) > this.bounds.halfZ + 0.5) this.gusts[k] = this.newGust();
    }
  }
}

function snowflakeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
