// ─────────────────────────────────────────────────────────────────────────────
// Stone skipping
//
// Model after Bocquet (2003, Am. J. Phys. 71, 150), which explains the
// experiments of Clanet, Hersen & Bocquet (2004, Nature 427, 29); see also
// Nagahiro & Hayakawa (2005, Phys. Rev. Lett. 94, 174501).
//
// The stone is a thin disc (radius R, thickness d, mass M) flying with
// velocity v, tilted at angle φ to the water (its back edge lower). Spin keeps
// φ nearly constant through each contact (gyroscopic stabilisation).
//
// Contact force (Bocquet eq. 1): a hydrodynamic lift along the disc's normal
// n and a friction along the disc, both scaling with the dynamic pressure:
//     F = ½ ρ V² S ( C_l n − C_f t̂ )      while the disc is wetted
//   S = wetted area, t̂ = direction of motion along the disc. C_l ≈ 1.
//   Bocquet takes C_f ≈ C_l ≈ 1 as an order-of-magnitude upper bound; the
//   real skin friction of a planing disc at Re ~ 10⁵ is ~100× smaller, and
//   with C_f = 1 a stone loses ~3/4 of its speed in one contact, which is
//   not what high-speed films show. Most of the braking is the lift itself
//   leaning back with the tilted face (horizontal/vertical = tan φ, the
//   pressure picture of Nagahiro & Hayakawa). We use C_f = 0.05 (skin
//   friction plus spray drag). Because V² is dominated by the fast horizontal
//   speed, the vertical motion during contact is a spring (stiffness ∝ V² S):
//   the stone rebounds nearly elastically, as observed.
// Wetted area: the trailing edge dips to a depth z below the surface, which
// wets a circular segment of the disc of chord depth s = z / sin φ
// (Bocquet eq. 9):
//     S = R² [ acos(1 − s/R) − (1 − s/R) √(1 − (1 − s/R)²) ]
// If the whole face goes under (s ≥ 2R) the lift is lost and the stone sinks.
//
// What comes out of this, with nothing tuned per throw:
//  • A minimum speed for a bounce (Bocquet eq. 14): the lift ½ C ρ V² a² has
//    to carry the weight M g.
//  • The "magic angle" φ ≈ 20°: too flat and the whole face slaps in and
//    drags; too steep and the stone digs in and dives. Around 20° the
//    contact is shortest and the needed speed lowest (Clanet et al.).
//  • Each bounce costs speed: reversing the vertical velocity V_z takes a
//    vertical impulse 2 M V_z, and the face's tilt turns a fraction
//    μ ≈ tan φ + C_f/C_l of it into braking. More speed means more bounces;
//    Bocquet's estimate is N ≈ V² / (2 μ g ℓ) (eq. 23), ℓ = contact length.
//  • Spin: each impact knocks the tilt by about δφ ~ g / (R Ω²) (Bocquet
//    §V). The errors accumulate and once φ wanders out of the skipping
//    window the stone dives: N_spin ~ R Ω² / g (Bocquet eq. 25). A lazy
//    throw with little spin wobbles out after a couple of skips.
//
// Other fluids, same equations:
//  • Mercury: ρ is 13.5× higher, so the lift is too: high, long skips at low
//    speed, and since granite (2.65 g/cm³) is lighter than mercury, the stone
//    ends up floating rather than sinking.
//  • Honey: added viscous drag F = −6π μ R_e v drains the speed within a
//    bounce or two and the stone is swallowed.
//  • Oobleck: a fast impact shears the suspension far above γ̇_c and the
//    surface jams solid, so the stone clatters across it like on a hard floor
//    (restitution e ≈ 0.45, sliding friction); once it is slow it sinks in.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { FluidProperties } from './fluids';

export const STONE = {
  radius: 0.02, // [m] a small flat pebble, 4 cm across
  thickness: 0.005,
  density: 2650, // granite [kg/m³]
};
export const STONE_MASS = STONE.density * Math.PI * STONE.radius ** 2 * STONE.thickness; // ≈ 17 g
const CL = 1.0; // lift coefficient (Bocquet)
const CF = 0.05; // skin friction + spray drag (see above)
const R_EQ = Math.cbrt((3 * Math.PI * STONE.radius ** 2 * STONE.thickness) / (4 * Math.PI));

/** Wetted area of a disc of radius R whose edge is immersed by chord depth s. */
export function wettedArea(s: number, R = STONE.radius) {
  if (s <= 0) return 0;
  if (s >= 2 * R) return Math.PI * R * R;
  const c = 1 - s / R;
  return R * R * (Math.acos(c) - c * Math.sqrt(1 - c * c));
}

export type StoneState = 'flying' | 'sinking' | 'floating' | 'resting' | 'gone';

export interface SkipEvent {
  kind: 'skip' | 'plop' | 'clatter' | 'ground';
  x: number;
  z: number;
  /** momentum handed to the fluid [N·s] and impact speed [m/s] */
  momentum: number;
  speed: number;
}

export class Stone {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  /** tilt φ [rad] (back edge low), and spin Ω [rad/s] */
  tilt: number;
  spin: number;
  /** heading on the ground plane (unit) */
  heading = new THREE.Vector2(1, 0);
  state: StoneState = 'flying';
  skips = 0;
  private inContact = false;
  private contactMomentum = 0;
  private contactSpeed = 0;
  /** visual spin angle */
  angle = 0;

  constructor(pos: THREE.Vector3, vel: THREE.Vector3, tilt: number, spin: number) {
    this.pos.copy(pos);
    this.vel.copy(vel);
    this.tilt = tilt;
    this.spin = spin;
    const h = new THREE.Vector2(vel.x, vel.z);
    if (h.lengthSq() > 0) this.heading.copy(h.normalize());
  }

  /** disc normal in world space: tilted back (against the heading) by φ */
  normal() {
    return new THREE.Vector3(-this.heading.x * Math.sin(this.tilt), Math.cos(this.tilt), -this.heading.y * Math.sin(this.tilt));
  }

  /**
   * Advance by dt. surfaceAt / isFluid / floorAt describe the world;
   * returns events (skips, plops) for ripples, spray and sound.
   */
  step(
    dt: number,
    f: FluidProperties,
    g: number,
    surfaceAt: (x: number, z: number) => number,
    isFluid: (x: number, z: number) => boolean,
    floorAt: (x: number, z: number) => number,
  ): SkipEvent[] {
    const events: SkipEvent[] = [];
    const n = Math.max(1, Math.ceil(dt / 0.0005));
    const h = dt / n;
    const R = STONE.radius;
    const M = STONE_MASS;
    this.angle += this.spin * dt;
    for (let k = 0; k < n && this.state !== 'gone'; k++) {
      if (this.state === 'resting') break;
      const F = new THREE.Vector3(0, -M * g, 0);
      const nrm = this.normal();
      // trailing (lowest) edge of the disc
      const edge = this.pos.clone().add(new THREE.Vector3(-this.heading.x * Math.cos(this.tilt) * R, -Math.sin(this.tilt) * R, -this.heading.y * Math.cos(this.tilt) * R));
      const wet = isFluid(edge.x, edge.z);
      const surface = wet ? surfaceAt(edge.x, edge.z) : -Infinity;
      const depth = surface - edge.y;

      if (this.state === 'flying' && wet && depth > 0) {
        if (f.rheology.kind === 'shearThickening' && Math.abs(this.vel.y) / STONE.thickness > f.rheology.gammaC * 4) {
          // jammed oobleck: a solid-like bounce with sliding friction
          const vy = this.vel.y;
          this.vel.y = -vy * 0.45;
          const slide = Math.min(1, (0.35 * (1.45 * Math.abs(vy))) / Math.max(Math.hypot(this.vel.x, this.vel.z), 1e-6));
          this.vel.x *= 1 - slide;
          this.vel.z *= 1 - slide;
          this.pos.y = surface + Math.sin(this.tilt) * R + 1e-4;
          this.skips++;
          events.push({ kind: 'clatter', x: edge.x, z: edge.z, momentum: M * 1.45 * Math.abs(vy), speed: Math.abs(vy) });
          this.perturbTilt(g);
          continue;
        }
        const s = depth / Math.max(Math.sin(this.tilt), 0.02);
        const S = wettedArea(s, R);
        const vn = this.vel.dot(nrm);
        if (s >= 2 * R || this.tilt <= 0.01) {
          // face fully under: the lift is gone and the stone goes down
          this.toSinking(events, f);
          break;
        }
        const q = 0.5 * f.density * this.vel.lengthSq() * S; // dynamic pressure × area
        F.addScaledVector(nrm, CL * q);
        const vt = this.vel.clone().addScaledVector(nrm, -vn);
        if (vt.lengthSq() > 1e-8) F.addScaledVector(vt.normalize(), -CF * q);
        // viscous drag on the wetted part (matters only in honey)
        F.addScaledVector(this.vel, -6 * Math.PI * f.viscosity * R_EQ * (S / (Math.PI * R * R)));
        if (!this.inContact) {
          this.inContact = true;
          this.contactMomentum = 0;
          this.contactSpeed = -this.vel.y;
        }
        this.contactMomentum += F.y * h + M * g * h;
      } else if (this.inContact && this.state === 'flying') {
        // left the surface: that was a skip
        this.inContact = false;
        if (this.vel.y > 0) {
          this.skips++;
          events.push({ kind: 'skip', x: this.pos.x, z: this.pos.z, momentum: this.contactMomentum, speed: this.contactSpeed });
          this.perturbTilt(g);
        } else {
          this.toSinking(events, f);
          break;
        }
      }

      if (this.state === 'sinking') {
        // settling through the fluid: buoyancy and quadratic drag of a disc
        // falling flat (C_d ≈ 1.2), plus viscous drag
        const V = M / STONE.density;
        F.y += f.density * g * V;
        F.addScaledVector(this.vel, -0.5 * 1.2 * f.density * Math.PI * R * R * this.vel.length());
        F.addScaledVector(this.vel, -6 * Math.PI * f.viscosity * R_EQ);
        this.tilt *= 1 - h * 4; // settles flat
      }
      if (this.state === 'floating') {
        // lighter than mercury: bob to the surface and drift to a stop
        const V = M / STONE.density;
        const sub = THREE.MathUtils.clamp((surfaceAt(this.pos.x, this.pos.z) - (this.pos.y - STONE.thickness / 2)) / STONE.thickness, 0, 1);
        F.y += f.density * g * V * sub;
        this.vel.multiplyScalar(1 - h * 3);
        this.tilt *= 1 - h * 6;
      }

      this.vel.addScaledVector(F, h / M);
      this.pos.addScaledVector(this.vel, h);

      // ground and bed
      const floor = floorAt(this.pos.x, this.pos.z) + STONE.thickness / 2;
      if (this.pos.y < floor) {
        this.pos.y = floor;
        if (this.state === 'flying' && !isFluid(this.pos.x, this.pos.z)) {
          events.push({ kind: 'ground', x: this.pos.x, z: this.pos.z, momentum: 0, speed: Math.abs(this.vel.y) });
        }
        this.vel.set(0, 0, 0);
        this.state = 'resting';
      }
    }
    return events;
  }

  private toSinking(events: SkipEvent[], f: FluidProperties) {
    this.inContact = false;
    this.state = STONE.density < f.density ? 'floating' : 'sinking';
    events.push({ kind: 'plop', x: this.pos.x, z: this.pos.z, momentum: STONE_MASS * this.vel.length() * 0.5, speed: this.vel.length() });
    // most of the horizontal speed is lost in the final dig-in
    this.vel.x *= 0.15;
    this.vel.z *= 0.15;
    this.vel.y = Math.min(this.vel.y, 0) * 0.3;
  }

  /** Each impact knocks the tilt by ~ g/(R Ω²); spin keeps that small. */
  private perturbTilt(g: number) {
    const delta = g / (STONE.radius * Math.max(this.spin * this.spin, 1));
    this.tilt += (Math.random() * 2 - 1) * delta * 0.6;
    this.tilt = THREE.MathUtils.clamp(this.tilt, -0.2, 1.4);
  }
}
