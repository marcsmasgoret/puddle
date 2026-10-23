// ─────────────────────────────────────────────────────────────────────────────
// Floating rigid bodies
//
// Each object is a rigid body (position, velocity, orientation quaternion,
// angular velocity) whose hull is a cloud of small sample volumes dV_i fixed
// in the body frame (voxelised from its shape, see toyBodies.ts).
//
// The local water surface
//   A floating body presses a dent into the water under itself (that is the
//   body → fluid coupling, pressureMap.ts). To avoid feeling its own dent, a
//   body reads the fluid on a ring just outside its footprint and fits a
//   plane to it:  η(x, z) ≈ η₀ + s_x (x − x₀) + s_z (z − z₀).
//   That plane carries the incoming waves and their slope, which is what
//   makes a duck rise, fall and rock on a passing wave.
//
// Forces
//   Buoyancy (Archimedes)     F_b,i = ρ g · f_i dV_i ŷ   at each sample
//       f_i = submerged fraction of the sample (linear across its height).
//       On a tilted wave plane the low side gets more buoyancy, so the
//       torque Σ r_i × F_b,i rocks the body with the slope.
//
//   Viscous drag (Stokes)     F_v = −6π μ R_e φ^(1/3) · w
//       on the equivalent sphere R_e = (3V/4π)^(1/3), reduced by the immersed
//       fraction φ = V_sub/V. w = body velocity − fluid velocity. Dominates in
//       honey and oobleck (Re = ρ|w|R/μ ≲ 1). For oobleck μ is evaluated at
//       the strain rate |w|/R_e: a fast impact meets an almost solid surface,
//       a slow body sinks in.
//   Form drag                 F_q = −½ ρ C_d π R_e² φ^(2/3) |w| w
//       Dominates in water and mercury.
//   Wave-radiation damping    F_r = −B (v_y − 0),   B = ρ ω A² / (4h)
//       A bobbing body makes waves, and the waves carry its energy away.
//       Shallow water is mathematically 2D acoustics (pressure ρgη, sound
//       speed √(gh)); the power radiated by a pulsating source of volume flux
//       Q is P = ρ ω Q² / (8h), and Q = A v for a waterplane area A, giving B.
//       In a 2.5 cm puddle this is strong: bodies settle in a bob or two
//       instead of bouncing, and a duck dropped onto dense mercury lands
//       with a plop rather than springing back up.
//
//   Gravity                   F_g = m g
//
// The damping terms can be enormous (jammed oobleck, mercury), so they are
// integrated implicitly:  v ← (v + a dt) / (1 + C dt / m), unconditionally
// stable. Buoyancy and gravity use semi-implicit Euler with substeps sized
// from the heave frequency ω = √(ρ g A / m).
//
// Contact with the bed and ground uses position projection plus friction.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { FluidProperties } from './fluids';
import { viscosityAt } from './rheology';

export interface HullSample {
  /** body-frame position [m] */
  p: THREE.Vector3;
  /** volume represented [m³] */
  dV: number;
  /** edge length of the sample cube [m] */
  h: number;
}

export interface BodyDef {
  mass: number;
  /** principal moments of inertia in the body frame [kg·m²] */
  inertia: THREE.Vector3;
  samples: HullSample[];
  /** body-frame height of the bottom of the hull (for ground contact) */
  bottom: number;
  /** rough radius for picking, the fluid-sampling ring and splash size [m] */
  radius: number;
}

/** The fluid around a body: a plane fitted to the surface, and the current. */
export interface LocalFluid {
  eta0: number;
  slopeX: number;
  slopeZ: number;
  u: number;
  v: number;
  /** resting depth at the body [m] */
  depth: number;
}

const CD = 1.0; // form drag coefficient of a bluff body

export class RigidBody {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  quat = new THREE.Quaternion();
  omega = new THREE.Vector3();
  /** world positions of the samples, updated every step */
  readonly world: THREE.Vector3[];
  /** submerged fraction per sample from the last step */
  readonly frac: Float32Array;
  /** readouts for the engineering overlay */
  submerged = 0;
  buoyancy = 0;
  drag = new THREE.Vector3();
  /** true until the body first touches the fluid (for the entry splash) */
  airborne = true;
  held = false;
  private volume: number;
  private Re: number;

  constructor(public def: BodyDef) {
    this.world = def.samples.map(() => new THREE.Vector3());
    this.frac = new Float32Array(def.samples.length);
    this.volume = def.samples.reduce((a, s) => a + s.dV, 0);
    this.Re = Math.cbrt((3 * this.volume) / (4 * Math.PI));
  }

  updateWorld() {
    this.def.samples.forEach((s, k) => this.world[k].copy(s.p).applyQuaternion(this.quat).add(this.pos));
  }

  surfaceAt(fl: LocalFluid, x: number, z: number) {
    return fl.eta0 + fl.slopeX * (x - this.pos.x) + fl.slopeZ * (z - this.pos.z);
  }

  step(
    dt: number,
    f: FluidProperties,
    g: number,
    fl: LocalFluid,
    floorAt: (x: number, z: number) => number,
    extraForce?: THREE.Vector3,
  ) {
    const d = this.def;
    // heave frequency for the substep size (waterplane ≈ footprint πR²/2)
    const omegaMax = Math.sqrt((f.density * g * Math.PI * d.radius * d.radius * 0.5) / d.mass);
    const n = Math.min(64, Math.max(1, Math.ceil((dt * omegaMax) / 0.4)));
    const h = dt / n;
    const force = new THREE.Vector3();
    const torque = new THREE.Vector3();
    const r = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const w = new THREE.Vector3();
    const fi = new THREE.Vector3();
    const Iinv = new THREE.Matrix3().set(1 / d.inertia.x, 0, 0, 0, 1 / d.inertia.y, 0, 0, 0, 1 / d.inertia.z);
    const R = new THREE.Matrix3();
    const m4 = new THREE.Matrix4();

    for (let s = 0; s < n; s++) {
      this.updateWorld();
      force.set(0, -d.mass * g, 0);
      torque.set(0, 0, 0);
      cb.set(0, 0, 0);
      let sub = 0, Awp = 0, Iwp = 0;
      for (let k = 0; k < d.samples.length; k++) {
        const smp = d.samples[k];
        const P = this.world[k];
        const surface = this.surfaceAt(fl, P.x, P.z);
        const fr = THREE.MathUtils.clamp((surface - P.y) / smp.h + 0.5, 0, 1);
        this.frac[k] = fr;
        if (fr <= 0) continue;
        sub += fr * smp.dV;
        r.subVectors(P, this.pos);
        fi.set(0, f.density * g * fr * smp.dV, 0);
        force.add(fi);
        torque.add(r.clone().cross(fi));
        cb.addScaledVector(P, fr * smp.dV);
        // samples cut by the waterline make up the waterplane area
        if (fr < 1) {
          Awp += smp.h * smp.h;
          Iwp += smp.h * smp.h * (r.x * r.x + r.z * r.z);
        }
      }
      this.submerged = sub;
      this.buoyancy = f.density * g * sub;
      if (sub > 0) this.airborne = false;
      if (extraForce) force.add(extraForce);

      let C = 0; // implicit damping coefficient, translation [N·s/m]
      let Cy = 0; // extra vertical (wave radiation)
      let Crot = 0; // rotation [N·m·s]
      this.drag.set(0, 0, 0);
      if (sub > 0) {
        cb.divideScalar(sub);
        const phi = sub / this.volume;
        // velocity of the immersed part relative to the current
        r.subVectors(cb, this.pos);
        w.copy(this.omega).cross(r).add(this.vel);
        w.x -= fl.u;
        w.z -= fl.v;
        const speed = w.length();
        const mu = viscosityAt(f, speed / this.Re);
        const cv = 6 * Math.PI * mu * this.Re * Math.cbrt(phi);
        const cq = 0.5 * f.density * CD * Math.PI * this.Re * this.Re * Math.pow(phi, 2 / 3) * speed;
        C = cv + cq;
        // the current drags the body along: the implicit term pulls v toward u
        fi.set(fl.u, 0, fl.v).multiplyScalar(C);
        force.add(fi);
        torque.add(r.clone().cross(fi));
        this.drag.copy(w).multiplyScalar(-C);
        // rotational viscous drag of a sphere, 8π μ R³
        Crot = 8 * Math.PI * mu * this.Re ** 3 * phi + cq * this.Re * this.Re * 0.2;
        // wave radiation (heave and roll/pitch)
        const omega = Math.sqrt((f.density * g * Math.max(Awp, 1e-6)) / d.mass);
        const depth = Math.max(fl.depth, 0.003);
        Cy = (f.density * omega * Awp * Awp) / (4 * depth);
        Crot += (f.density * omega * Awp * Iwp) / (4 * depth);
      }

      // translation (implicit damping)
      this.vel.addScaledVector(force, h / d.mass);
      const kx = 1 / (1 + (C * h) / d.mass);
      this.vel.x *= kx;
      this.vel.z *= kx;
      this.vel.y *= 1 / (1 + ((C + Cy) * h) / d.mass);

      // rotation: world inverse inertia R I⁻¹ Rᵀ (gyroscopic term negligible
      // for these slow, small bodies)
      R.setFromMatrix4(m4.makeRotationFromQuaternion(this.quat));
      const invI = R.clone().multiply(Iinv).multiply(R.clone().transpose());
      this.omega.add(torque.applyMatrix3(invI).multiplyScalar(h));
      const Imin = Math.min(d.inertia.x, d.inertia.y, d.inertia.z);
      this.omega.multiplyScalar(1 / (1 + (Crot * h) / Imin));

      // integrate the pose
      this.pos.addScaledVector(this.vel, h);
      const dq = new THREE.Quaternion(this.omega.x * h * 0.5, this.omega.y * h * 0.5, this.omega.z * h * 0.5, 0).multiply(this.quat);
      this.quat.set(this.quat.x + dq.x, this.quat.y + dq.y, this.quat.z + dq.z, this.quat.w + dq.w).normalize();

      this.resolveContact(floorAt, h);
    }
    this.updateWorld();
  }

  /** Keep every sample above the bed / ground, with friction. */
  private resolveContact(floorAt: (x: number, z: number) => number, h: number) {
    let push = 0;
    const d = this.def;
    this.updateWorld();
    for (let k = 0; k < d.samples.length; k++) {
      const P = this.world[k];
      push = Math.max(push, floorAt(P.x, P.z) - (P.y - d.samples[k].h * 0.5));
    }
    if (push <= 0) return;
    this.pos.y += push;
    if (this.vel.y < 0) this.vel.y *= -0.15; // a little bounce
    // friction while touching the ground or bed
    const k = Math.exp(-h * 6);
    this.vel.x *= k;
    this.vel.z *= k;
    this.omega.multiplyScalar(Math.exp(-h * 8));
    // the toys are bottom-heavy: on solid ground they roll back upright
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    this.omega.addScaledVector(up.clone().cross(new THREE.Vector3(0, 1, 0)), h * 25);
  }
}
