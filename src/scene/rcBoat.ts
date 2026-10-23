// ─────────────────────────────────────────────────────────────────────────────
// RC boat mode: drive a 20 cm toy speedboat around the puddle.
//
// The boat is a floating rigid body like the other toys (buoyancy, drag,
// wave drift, its own pressure dent pushing a bow wave). On top of that:
//
//   thrust     the propeller pushes with up to T_max = 0.25 N along the
//              hull; its reaction is a jet of water thrown backward, added
//              to the fluid as momentum −F Δt over a small patch at the stern
//   rudder     the rudder sits in the propeller's wash, so it bites even
//              at low speed (the wash speed grows with √thrust) and harder
//              as the boat speeds up; the hull follows a turn of radius
//              ≈ L / tan δ, so the yaw rate is (flow over the rudder) × tan δ
//              / L, capped at what a 20 cm hull manages (~2.5 rad/s).
//              Steering is applied to the heading directly: the solver's
//              roll damping would otherwise swallow the small yaw torque
//
// Top speed is where thrust balances form drag, ~0.8 m/s, faster than the
// shallow-water wave speed √(gh) ≈ 0.5 m/s in 2.5 cm: the boat outruns its
// own waves and drags a V-shaped wake behind it, the shallow-water version
// of a supersonic jet's Mach cone (half-angle sin α = c / U).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { Toys } from './toys';
import type { Impulse } from '../physics/solver';

const T_MAX = 0.25; // [N]
const LENGTH = 0.2; // [m]
const DELTA_MAX = 0.6; // [rad] full rudder
const YAW_MAX = 2.5; // [rad/s]
const UP = new THREE.Vector3(0, 1, 0);

type BoatToy = ReturnType<Toys['spawn']>;

export class RcBoat {
  private boat: BoatToy | null = null;
  throttle = 0;
  steer = 0;
  private keys = new Set<string>();
  private yawRate = 0;
  /** called with the motor level 0…1 every frame (for the sound) */
  onMotor: (level: number) => void = () => {};

  constructor(private toys: Toys) {
    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }

  get active() {
    return !!this.boat;
  }

  launch(at: THREE.Vector3) {
    this.remove();
    this.boat = this.toys.spawn('rcboat', at);
    this.boat.body.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
  }

  remove() {
    if (this.boat) this.toys.remove(this.boat);
    this.boat = null;
    this.onMotor(0);
  }

  /** extra force on the boat this frame (thrust); used by the toy step */
  forceFor(toy: { kind: string }) {
    if (!this.boat || toy !== this.boat) return undefined;
    const b = this.boat.body;
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(b.quat);
    fwd.y = 0;
    fwd.normalize();
    return b.submerged > 0 ? fwd.multiplyScalar(T_MAX * this.throttle) : new THREE.Vector3();
  }

  /** per frame: read the controls, steer, and throw the propeller jet */
  update(dt: number, density: number, depthAt: (x: number, z: number) => number, impulse: (i: Impulse) => void) {
    if (!this.boat) return;
    if (!this.toys.toys.includes(this.boat)) {
      this.boat = null;
      return;
    }
    // keyboard adds to the on-screen stick
    const k = this.keys;
    const kt = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 0.5 : 0);
    const ks = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const throttle = THREE.MathUtils.clamp(this.stickT + kt, -0.5, 1);
    const steer = THREE.MathUtils.clamp(this.stickS + ks, -1, 1);
    this.throttle += (throttle - this.throttle) * (1 - Math.exp(-dt * 6));
    this.steer += (steer - this.steer) * (1 - Math.exp(-dt * 8));
    this.onMotor(Math.abs(this.throttle));

    const b = this.boat.body;
    if (b.submerged <= 0) return;
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(b.quat);
    fwd.y = 0;
    fwd.normalize();
    const v = b.vel.dot(fwd);
    // flow over the rudder: the boat's own speed plus the propeller wash
    // (actuator disc: wash ∝ √(T / ρA), ≈ 0.6 m/s at full throttle here)
    const wash = 0.6 * Math.sqrt(Math.abs(this.throttle)) * Math.sign(this.throttle);
    const flow = v + wash;
    // stick right turns right (clockwise seen from above = negative yaw)
    const want = THREE.MathUtils.clamp((-flow * Math.tan(this.steer * DELTA_MAX)) / LENGTH, -YAW_MAX, YAW_MAX);
    this.yawRate += (want - this.yawRate) * (1 - Math.exp(-dt * 5));
    b.quat.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, this.yawRate * dt));
    b.omega.y = 0;
    // sideways drag of the keel: the hull goes where it points
    const side = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    const vs = b.vel.dot(side);
    b.vel.addScaledVector(side, -vs * (1 - Math.exp(-dt * 6)));
    // the propeller jet: thrust's reaction thrown backward from the stern
    if (Math.abs(this.throttle) > 0.02) {
      const stern = b.pos.clone().addScaledVector(fwd, -0.1);
      const h = Math.max(depthAt(stern.x, stern.z), 0.003);
      const R = 0.02;
      const dv = (-T_MAX * this.throttle * dt) / (density * h * Math.PI * R * R);
      impulse({ x: stern.x, z: stern.z, radius: R, pressureImpulse: 0, push: [fwd.x * dv, fwd.z * dv] });
    }
  }

  // ── on-screen stick ───────────────────────────────────────────────────────
  private stickT = 0;
  private stickS = 0;
  private stickEl: HTMLDivElement | null = null;

  /** a thumb stick at the bottom right: up = throttle, sideways = rudder */
  createStick() {
    const el = document.createElement('div');
    el.className = 'ui-stick';
    el.innerHTML = '<div class="ui-stick-knob"></div>';
    document.body.append(el);
    const knob = el.querySelector<HTMLDivElement>('.ui-stick-knob')!;
    let id = -1;
    const R = 46;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > R) {
        dx *= R / l;
        dy *= R / l;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stickS = dx / R;
      this.stickT = -dy / R;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      knob.style.transform = '';
      this.stickS = this.stickT = 0;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      id = e.pointerId;
      el.setPointerCapture(id);
      move(e);
    });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this.stickEl = el;
  }

  set stickVisible(v: boolean) {
    this.stickEl?.classList.toggle('show', v);
  }
}
