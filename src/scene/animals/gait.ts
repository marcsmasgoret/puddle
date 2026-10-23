// ─────────────────────────────────────────────────────────────────────────────
// Locomotion for the four-legged animals
//
// Feet are placed, not swung. Each leg runs a cycle of phase φ ∈ [0, 1):
//   stance (φ < β): the paw is planted on the ground and slides backward in
//                   the body frame exactly as fast as the body moves forward,
//                   so in the world it stays put (no skating);
//   swing  (φ ≥ β): the paw lifts on an arc and is carried forward.
// The stride length follows from speed and cadence: S = v / f, with the
// cadence rising gently with speed, as in real animals. Leg order comes
// from the gait (Hildebrand's gait diagrams):
//   walk   lateral sequence: hind-left, fore-left, hind-right, fore-right
//   trot   diagonal pairs together
//   bound  hind pair, then fore pair (a cat's chasing gallop)
// Each leg is then posed by two-bone inverse kinematics in its own vertical
// plane (upper bone + the rest of the leg as one), with elbows bending
// backward and stifles forward, so crouching, stalking and sitting simply
// bend the legs with the paws staying on the ground.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { Animal, AnimalSpec } from './sculpt';

export type Gait = 'walk' | 'trot' | 'bound';

const GAITS: Record<Gait, { stance: number; offsets: Record<string, number>; lift: number }> = {
  walk: { stance: 0.62, offsets: { hl: 0, fl: 0.25, hr: 0.5, fr: 0.75 }, lift: 0.16 },
  trot: { stance: 0.5, offsets: { hl: 0, fr: 0, hr: 0.5, fl: 0.5 }, lift: 0.2 },
  bound: { stance: 0.32, offsets: { hl: 0, hr: 0.06, fl: 0.48, fr: 0.54 }, lift: 0.28 },
};

interface LegInfo {
  name: string;
  j0: THREE.Bone;
  j1: THREE.Bone;
  j2: THREE.Bone;
  L1: number;
  L2: number;
  a0: number; // rest angle of the upper segment
  a1: number; // rest angle of the lower segment (joint 1 → paw)
  bend: number; // +1 / −1: which way the middle joint points
  rest: THREE.Vector2; // paw position at rest (x, y) in model space
  hip: THREE.Vector2; // rest position of joint 0
  z: number; // sideways position of the paw
  lastPh: number;
}

export interface QuadOpts {
  /** cadence at walking pace [Hz] and how it grows with speed [Hz per m/s] */
  cadence: number;
  cadenceGain: number;
  /** hip height [m] (scales bob, crouch and lift) */
  height: number;
  /** tail resting curve (radians per segment, + = up) and swish */
  tailCurve?: number;
}

export class Quadruped {
  readonly root: THREE.Group;
  pos = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  /** what the behaviour asks for */
  targetSpeed = 0;
  gait: Gait = 'walk';
  /** 0…1 pose layers */
  crouch = 0;
  sit = 0;
  /** extra head pitch (+ = nose down, e.g. sniffing / grazing) */
  headDown = 0;
  /** world point to look at, or null */
  lookAt: THREE.Vector3 | null = null;
  /** tail attitude: 1 = up (happy cat), 0 = level, −1 = low (stalking) */
  tailUp = 0;
  /** extra rump wiggle before a pounce, 0…1 */
  wiggle = 0;
  /** extra height of the whole animal above the ground (a leap) [m] */
  lift = 0;
  /** called when a paw is set down: leg name and world position */
  onFootDown: ((leg: string, at: THREE.Vector3) => void) | null = null;
  private phase = Math.random();
  private legs: LegInfo[] = [];
  private bones: Record<string, THREE.Bone>;
  private tail: THREE.Bone[] = [];
  private tailVel: number[] = [];
  private tailAng: number[] = [];
  private t = Math.random() * 10;
  private lastYaw = 0;
  private bodyRest: THREE.Vector3;

  constructor(animal: Animal, spec: AnimalSpec, private o: QuadOpts) {
    this.root = animal.root;
    this.bones = animal.bones;
    this.bodyRest = this.bones.body.position.clone();
    const at = (n: string) => spec.bones.find((b) => b.name === n)!.at;
    for (const n of ['fl', 'fr', 'hl', 'hr']) {
      if (!this.bones[n + '0']) continue;
      const p0 = new THREE.Vector2(at(n + '0')[0], at(n + '0')[1]);
      const p1 = new THREE.Vector2(at(n + '1')[0], at(n + '1')[1]);
      const capsule = spec.prims.find((p) => p.kind === 'capsule' && p.bone === n + '2');
      const p3 = capsule && capsule.kind === 'capsule' ? new THREE.Vector2(capsule.b[0], capsule.b[1]) : new THREE.Vector2(at(n + '2')[0], 0);
      const u = p1.clone().sub(p0), w = p3.clone().sub(p1);
      const cross = u.x * (p3.y - p0.y) - u.y * (p3.x - p0.x);
      this.legs.push({
        name: n, j0: this.bones[n + '0'], j1: this.bones[n + '1'], j2: this.bones[n + '2'],
        L1: u.length(), L2: w.length(), a0: Math.atan2(u.y, u.x), a1: Math.atan2(w.y, w.x),
        bend: -(Math.sign(cross) || 1), rest: p3, hip: p0, z: at(n + '0')[2], lastPh: 0,
      });
    }
    for (let k = 0; this.bones['tail' + k]; k++) {
      this.tail.push(this.bones['tail' + k]);
      this.tailVel.push(0);
      this.tailAng.push(0);
    }
  }

  /** Face toward a heading, turning at most `rate` rad/s. */
  turnToward(yaw: number, rate: number, dt: number) {
    let d = yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }

  get forward() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt: number, groundY = 0) {
    this.t += dt;
    const o = this.o;
    // ease speed toward the target (animals don't start or stop instantly)
    const acc = this.targetSpeed > this.speed ? 2.5 : 4;
    this.speed += THREE.MathUtils.clamp(this.targetSpeed - this.speed, -acc * dt, acc * dt);
    const v = Math.max(this.speed, 0);
    this.pos.addScaledVector(this.forward, v * dt);
    this.root.position.set(this.pos.x, groundY + this.lift, this.pos.z);
    this.root.rotation.y = this.yaw;

    // gait cycle
    const g = GAITS[this.gait];
    const f = v > 0.005 ? o.cadence + o.cadenceGain * v : 0;
    const S = f > 0 ? v / f : 0;
    this.phase = (this.phase + f * dt) % 1;
    const moving = Math.min(1, v / 0.05);

    // body: bob twice per cycle, crouch, sit, wiggle
    const H = o.height;
    const b = this.bones.body;
    const bob = moving * (this.gait === 'bound' ? 0.06 : 0.025) * H * (0.5 - 0.5 * Math.cos(this.phase * Math.PI * 4));
    b.position.copy(this.bodyRest);
    b.position.y += -bob - this.crouch * 0.32 * H - this.sit * 0.42 * H;
    b.position.x += -this.sit * 0.12 * H;
    b.position.z += this.wiggle * 0.02 * H * Math.sin(this.t * 22);
    // pitch: nose up when sitting, rocking when bounding
    const pitchB = this.sit * 0.62 + (this.gait === 'bound' ? moving * 0.18 * Math.sin(this.phase * Math.PI * 2) : 0);
    b.rotation.set(0, this.wiggle * 0.08 * Math.sin(this.t * 22), pitchB);
    const chest = this.bones.chest;
    // breathing; spine flex when bounding
    const breath = 1 + 0.025 * Math.sin(this.t * (v > 0.3 ? 5 : 1.8));
    chest.scale.set(1, breath, breath);
    chest.rotation.z = (this.gait === 'bound' ? moving * -0.25 * Math.sin(this.phase * Math.PI * 2 + 0.6) : 0) - this.sit * 0.25;

    // head: look at something, steadied against the bob
    const head = this.bones.head, neck = this.bones.neck;
    let yawL = 0, pitchL = 0;
    if (this.lookAt) {
      const local = this.root.worldToLocal(this.lookAt.clone());
      const hp = head.getWorldPosition(new THREE.Vector3());
      const hl = this.root.worldToLocal(hp);
      const d = local.sub(hl);
      yawL = THREE.MathUtils.clamp(Math.atan2(d.z, d.x), -1.2, 1.2);
      pitchL = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.8, 0.6);
    }
    const turn = Math.atan2(Math.sin(this.yaw - this.lastYaw), Math.cos(this.yaw - this.lastYaw)) / Math.max(dt, 1e-3);
    this.lastYaw = this.yaw;
    neck.rotation.set(0, yawL * 0.5 + turn * 0.05, pitchL * 0.4 - this.headDown * 0.5 - this.crouch * 0.25 - pitchB * 0.5);
    head.rotation.set(0, yawL * 0.5, pitchL * 0.6 - this.headDown * 0.6 + this.crouch * 0.2 - pitchB * 0.3 + bob * 3);

    // legs: foot targets in model space, then IK
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    for (const L of this.legs) {
      const off = g.offsets[L.name] ?? 0;
      const ph = (this.phase + off) % 1;
      if (S > 0 && this.lift < 0.005 && ph < L.lastPh && this.onFootDown) {
        // a new stance began: the paw lands at the front of its stride
        this.onFootDown(L.name, this.root.localToWorld(new THREE.Vector3(L.rest.x + S / 2, 0, L.z)));
      }
      L.lastPh = ph;
      const target = L.rest.clone();
      if (S > 0) {
        if (ph < g.stance) {
          target.x += S / 2 - (S * ph) / g.stance;
        } else {
          const s = (ph - g.stance) / (1 - g.stance);
          target.x += -S / 2 + S * (s * s * (3 - 2 * s));
          target.y += g.lift * H * Math.sin(Math.PI * s) * moving;
        }
      }
      // sitting: hind paws come forward under the haunches
      if (L.name[0] === 'h') target.x += this.sit * 0.3 * H;
      this.solve(L, target, inv);
    }

    // tail: a damped spring chain following a resting curve and a slow swish
    const swish = Math.sin(this.t * (this.crouch > 0.5 ? 6 : 1.3)) * (this.crouch > 0.5 ? 0.18 : 0.12);
    for (let k = 0; k < this.tail.length; k++) {
      const curve = (o.tailCurve ?? 0.1) * this.tailUp - (this.tailUp < 0 ? 0.05 : 0);
      const want = curve + swish * (0.3 + k * 0.25) - turn * 0.02 * k;
      const a = this.tailAng[k];
      this.tailVel[k] += ((want - a) * 60 - this.tailVel[k] * 9) * dt;
      this.tailAng[k] += this.tailVel[k] * dt;
      this.tail[k].rotation.set(0, this.tailAng[k] * 0.8 * Math.sin(this.t * 0.7 + k), k === 0 ? this.tailAng[k] + 0.25 * this.tailUp : this.tailAng[k]);
    }
  }

  /** two-bone IK in the leg's vertical (x, y) plane */
  private solve(L: LegInfo, target: THREE.Vector2, inv: THREE.Matrix4) {
    // where the hip joint actually is now, and how its parent is pitched
    const parent = L.j0.parent as THREE.Object3D;
    const p0w = L.j0.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const pq = parent.getWorldQuaternion(new THREE.Quaternion());
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(pq);
    const rho = new THREE.Euler().setFromQuaternion(rq, 'YXZ').z;
    const dx = target.x - p0w.x, dy = target.y - p0w.y;
    let d = Math.hypot(dx, dy);
    d = THREE.MathUtils.clamp(d, Math.abs(L.L1 - L.L2) + 1e-4, (L.L1 + L.L2) * 0.999);
    const beta = Math.atan2(dy, dx);
    const cosA = THREE.MathUtils.clamp((L.L1 * L.L1 + d * d - L.L2 * L.L2) / (2 * L.L1 * d), -1, 1);
    const th0 = beta + L.bend * Math.acos(cosA);
    const e = new THREE.Vector2(p0w.x + L.L1 * Math.cos(th0), p0w.y + L.L1 * Math.sin(th0));
    const th1 = Math.atan2(target.y - e.y, target.x - e.x);
    const r0 = th0 - L.a0 - rho;
    L.j0.rotation.set(0, 0, r0);
    L.j1.rotation.set(0, 0, th1 - L.a1 - (th0 - L.a0));
    L.j2.rotation.set(0, 0, 0);
  }
}
