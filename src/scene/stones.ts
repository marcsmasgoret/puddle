// Skipping stones in the scene: throwing from a flick, stepping the physics
// (physics/skipping.ts), drawing the pebbles and turning bounces into
// ripples, spray and score.
import * as THREE from 'three';
import { Stone, STONE, STONE_MASS, type SkipEvent } from '../physics/skipping';
import type { FluidProperties } from '../physics/fluids';
import { LAYER_REFLECT } from '../render/pipeline';

const MAX_STONES = 8;
/** incidence of the throw: released ~4 cm above the water, heading down at
 *  18°, roughly a side-arm throw. With this the best tilt is ~20° */
const RELEASE_HEIGHT = 0.04;
const RELEASE_ANGLE = (18 * Math.PI) / 180;

export interface Flick {
  /** screen-space flick vector in pixels (x right, y down) and duration [ms] */
  dx: number;
  dy: number;
  ms: number;
  /** where the flick started, as a world point on the ground plane */
  start: THREE.Vector3;
}

export interface ThrowInfo {
  speed: number;
  tiltDeg: number;
  spinHz: number;
}

export class Stones {
  private list: { stone: Stone; mesh: THREE.Mesh; age: number }[] = [];
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshStandardMaterial;
  current: Stone | null = null;

  constructor(
    private scene: THREE.Scene,
    private world: {
      isFluid(x: number, z: number): boolean;
      floorAt(x: number, z: number): number;
      halfX: number;
      halfZ: number;
    },
    private onEvent: (e: SkipEvent, stone: Stone) => void,
    private onDone: (skips: number, stone: Stone) => void,
  ) {
    // a smooth flat pebble: a squashed, slightly lopsided sphere
    const g = new THREE.SphereGeometry(1, 28, 14);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      p.setXYZ(k, x * (1 + 0.08 * z), y * 0.5 * (1 - 0.15 * x * x), z * 0.92);
    }
    g.computeVertexNormals();
    g.scale(STONE.radius, STONE.thickness, STONE.radius);
    this.geo = g;
    this.mat = new THREE.MeshStandardMaterial({ color: '#7e7a72', roughness: 0.6 });
  }

  /** Turn a screen flick into a throw. Returns the throw for the readout. */
  throwFrom(f: Flick, screenW: number): ThrowInfo {
    // speed: a flick across ~2/3 of the screen in a fifth of a second is a
    // strong throw (~6 m/s); faster flicks also spin the stone harder
    const widthsPerSec = Math.hypot(f.dx, f.dy) / screenW / Math.max(f.ms / 1000, 0.04);
    const speed = THREE.MathUtils.clamp(0.6 + widthsPerSec * 1.6, 0.6, 9);
    const spinHz = THREE.MathUtils.clamp(2 + widthsPerSec * 3.5, 2, 22);
    // tilt: the angle of the flick above horizontal
    const tilt = THREE.MathUtils.clamp(Math.atan2(-f.dy, Math.abs(f.dx)), -0.1, 1.3);
    const dir = Math.sign(f.dx) || 1;
    // release over the near end of the puddle, in the flick's lane, so the
    // first touchdown lands about 8 cm inside the water's edge
    const z = THREE.MathUtils.clamp(f.start.z, -this.world.halfZ * 0.5, this.world.halfZ * 0.5);
    let edge = -dir * this.world.halfX;
    for (let x = -dir * (this.world.halfX + 0.1); Math.abs(x) > 0.01; x += dir * 0.01) {
      if (this.world.isFluid(x, z)) {
        edge = x;
        break;
      }
    }
    const run = RELEASE_HEIGHT / Math.tan(RELEASE_ANGLE);
    const pos = new THREE.Vector3(edge + dir * (0.08 - run), RELEASE_HEIGHT, z);
    const vel = new THREE.Vector3(dir * speed * Math.cos(RELEASE_ANGLE), -speed * Math.sin(RELEASE_ANGLE), 0);
    const stone = new Stone(pos, vel, Math.max(tilt, 0), spinHz * Math.PI * 2);
    this.add(stone);
    return { speed, tiltDeg: (tilt * 180) / Math.PI, spinHz };
  }

  private add(stone: Stone) {
    if (this.list.length >= MAX_STONES) {
      const old = this.list.shift()!;
      this.scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.castShadow = true;
    mesh.layers.enable(LAYER_REFLECT);
    this.scene.add(mesh);
    this.list.push({ stone, mesh, age: 0 });
    this.current = stone;
  }

  clear() {
    this.list.forEach((s) => this.scene.remove(s.mesh));
    this.list = [];
    this.current = null;
  }

  update(dt: number, fluid: FluidProperties, g: number) {
    for (const s of this.list) {
      const st = s.stone;
      s.age += dt;
      const was = st.state;
      if (st.state === 'flying' || st.state === 'sinking' || st.state === 'floating') {
        const events = st.step(dt, fluid, g, () => 0, this.world.isFluid, this.world.floorAt);
        for (const e of events) this.onEvent(e, st);
        if (was === 'flying' && st.state !== 'flying') this.onDone(st.skips, st);
      }
      // pose: tilted back by φ about the axis across the heading, spinning
      const n = st.normal();
      s.mesh.position.copy(st.pos);
      s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      s.mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.angle));
    }
    // stones that came to rest long ago are cleared away
    this.list = this.list.filter((s) => {
      const keep = s.age < 120;
      if (!keep) this.scene.remove(s.mesh);
      return keep;
    });
  }

  static massKg() {
    return STONE_MASS;
  }
}
