// ─────────────────────────────────────────────────────────────────────────────
// Splash droplets
//
// Each drop is a small sphere of radius r flying ballistically under gravity
// and quadratic air drag:
//
//     m dv/dt = m g − ½ ρ_air C_d (π r²) |v| v
//  ⇒  dv/dt  = g − (3 ρ_air C_d / (8 ρ r)) |v| v
//
// (C_d ≈ 0.47 for a sphere at these Reynolds numbers, Re ~ 10²–10³.) Drops
// this size stay nearly spherical: the Weber number We = ρ_air v² (2r)/σ is
// below ~1, so surface tension holds them together in flight.
//
// When a drop comes back down:
//  • on the puddle: its downward momentum m|v_y| becomes a small pressure
//    impulse (a secondary ripple) and its volume is returned to the surface;
//  • on the ground: a wetting liquid leaves a splat. Its volume is assumed to
//    drain back into the puddle, so the puddle never slowly empties (stated
//    assumption). A non-wetting liquid (mercury) can't soak in: the drop
//    stays a bead, sits a moment, then rolls back down into the puddle.
//
// Drop size depends on the Ohnesorge number Oh = μ/√(ρσL). Low Oh (water,
// mercury): thin sheets break into fine drops. High Oh (honey ≈ 13):
// viscosity resists breakup, so honey throws fewer, much bigger blobs.
// ─────────────────────────────────────────────────────────────────────────────
import { ohnesorge, type FluidProperties } from './fluids';

const RHO_AIR = 1.204; // [kg/m³] at 20 °C
const CD_SPHERE = 0.47;
export const MAX_DROPS = 600;

export interface Landing {
  x: number;
  z: number;
  radius: number;
  volume: number;
  /** downward speed at impact [m/s] */
  speed: number;
  onWater: boolean;
}

export class Droplets {
  readonly pos = new Float32Array(MAX_DROPS * 3);
  readonly vel = new Float32Array(MAX_DROPS * 3);
  readonly radius = new Float32Array(MAX_DROPS);
  readonly alive = new Uint8Array(MAX_DROPS);
  /** 0 = flying, 1 = bead resting on the ground, 2 = bead rolling back */
  readonly mode = new Uint8Array(MAX_DROPS);
  private timer = new Float32Array(MAX_DROPS);
  count = 0; // number of live drops
  gravity = 9.81;

  constructor(
    public fluid: FluidProperties,
    private isWater: (x: number, z: number) => boolean,
    /** unit vector pointing downhill toward the puddle at (x, z) */
    private towardWater: (x: number, z: number) => [number, number],
  ) {}

  clear() {
    this.alive.fill(0);
    this.mode.fill(0);
    this.count = 0;
  }

  /**
   * Throw a crown of drops carrying a total mass `mass` [kg] from a ring of
   * radius `ringRadius` around (x, z), launched outward and upward at about
   * `meanSpeed` [m/s]. Returns the volume actually launched [m³].
   */
  spray(x: number, z: number, ringRadius: number, mass: number, meanSpeed: number): number {
    const rho = this.fluid.density;
    let volume = mass / rho;
    let launched = 0;
    for (let guard = 0; guard < MAX_DROPS && volume > 0; guard++) {
      const k = this.alive.indexOf(0);
      if (k < 0) break;
      // drop radius, log-uniform between 1.2 and 4.5 mm, scaled up for
      // viscous liquids that resist breakup
      const r = 0.0012 * Math.exp(Math.random() * Math.log(4.5 / 1.2)) * Math.cbrt(1 + ohnesorge(this.fluid));
      const v = (4 / 3) * Math.PI * r ** 3;
      const theta = Math.random() * Math.PI * 2;
      const elev = (25 + Math.random() * 45) * (Math.PI / 180);
      // smaller drops leave faster (thin sheet edges), larger ones slower
      const speed = meanSpeed * (0.55 + 0.9 * Math.random()) * Math.pow(0.0025 / r, 0.25);
      const rr = ringRadius * (0.8 + 0.6 * Math.random());
      this.pos[k * 3] = x + Math.cos(theta) * rr;
      this.pos[k * 3 + 1] = 0.004;
      this.pos[k * 3 + 2] = z + Math.sin(theta) * rr;
      this.vel[k * 3] = Math.cos(theta) * Math.cos(elev) * speed;
      this.vel[k * 3 + 1] = Math.sin(elev) * speed;
      this.vel[k * 3 + 2] = Math.sin(theta) * Math.cos(elev) * speed;
      this.radius[k] = r;
      this.alive[k] = 1;
      this.mode[k] = 0;
      this.count++;
      volume -= v;
      launched += v;
    }
    return launched;
  }

  /** A bead rests, then rolls downhill (≈ 8 cm/s) until it reaches the puddle. */
  private stepBead(k: number, dt: number, landings: Landing[]) {
    const i = k * 3;
    if (this.mode[k] === 1) {
      this.timer[k] -= dt;
      if (this.timer[k] <= 0) this.mode[k] = 2;
      return;
    }
    const [dx, dz] = this.towardWater(this.pos[i], this.pos[i + 2]);
    const speed = 0.08;
    this.vel[i] = dx * speed;
    this.vel[i + 2] = dz * speed;
    this.pos[i] += this.vel[i] * dt;
    this.pos[i + 2] += this.vel[i + 2] * dt;
    if (this.isWater(this.pos[i], this.pos[i + 2])) {
      const r = this.radius[k];
      landings.push({ x: this.pos[i], z: this.pos[i + 2], radius: r, volume: (4 / 3) * Math.PI * r ** 3, speed: 0.08, onWater: true });
      this.alive[k] = 0;
      this.mode[k] = 0;
      this.count--;
    }
  }

  /** Advance all drops by dt; returns the drops that landed this step. */
  step(dt: number): Landing[] {
    const landings: Landing[] = [];
    if (this.count === 0) return landings;
    const sub = Math.max(1, Math.ceil(dt / 0.004)); // small steps keep landings precise
    const h = dt / sub;
    for (let k = 0; k < MAX_DROPS; k++) {
      if (!this.alive[k]) continue;
      const r = this.radius[k];
      if (this.mode[k] !== 0) {
        this.stepBead(k, dt, landings);
        continue;
      }
      const kDrag = (3 * RHO_AIR * CD_SPHERE) / (8 * this.fluid.density * r);
      for (let s = 0; s < sub; s++) {
        const i = k * 3;
        const vx = this.vel[i], vy = this.vel[i + 1], vz = this.vel[i + 2];
        const speed = Math.hypot(vx, vy, vz);
        this.vel[i] -= kDrag * speed * vx * h;
        this.vel[i + 1] -= (this.gravity + kDrag * speed * vy) * h;
        this.vel[i + 2] -= kDrag * speed * vz * h;
        this.pos[i] += this.vel[i] * h;
        this.pos[i + 1] += this.vel[i + 1] * h;
        this.pos[i + 2] += this.vel[i + 2] * h;
        if (this.pos[i + 1] <= 0 && this.vel[i + 1] < 0) {
          const x = this.pos[i], z = this.pos[i + 2];
          if (!this.fluid.wetsGround && !this.isWater(x, z)) {
            // non-wetting: becomes a bead on the ground
            this.mode[k] = 1;
            this.timer[k] = 1.5 + Math.random() * 3;
            this.pos[i + 1] = r * 0.75;
            this.vel.fill(0, i, i + 3);
            break;
          }
          landings.push({
            x,
            z,
            radius: r,
            volume: (4 / 3) * Math.PI * r ** 3,
            speed: -this.vel[i + 1],
            onWater: this.isWater(x, z),
          });
          this.alive[k] = 0;
          this.count--;
          break;
        }
      }
    }
    return landings;
  }
}
