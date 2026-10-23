// The floating toys in the scene: spawning, carrying, dropping, and the
// two-way coupling with the fluid each frame.
//
//   fluid → body : buoyancy, drag and current, from samples of the GPU fluid
//                  (physics/rigidbody.ts)
//   body → fluid : (1) a pressure load equal to the buoyant force, spread
//                  over the hull's footprint (physics/pressureMap.ts), so the
//                  toy sits in a real dent and pushes waves as it moves;
//                  (2) the reaction to drag, added as momentum to the water
//                  (a wake); (3) an impact impulse and spray when it lands.
//
// Wave drift. Waves that run into a floating body are partly reflected, and
// reflecting a wave takes momentum: the body feels a steady push along the
// waves' direction of travel, the "wave drift force" (radiation stress,
// Longuet-Higgins & Stewart 1964). For a shallow-water wave the momentum it
// carries per unit width is E/c with E = ½ρga², and E/c = ρ c ⟨η u⟩ (since
// u = ηc/h in a progressive wave). Reflecting it from a body of width W gives
//     F = ρ c ⟨η u⟩ W.
// ⟨η u⟩ is measured on the ring around each toy and averaged over ~0.4 s. It
// is what pushes toys away from a slap and herds them along with the waves.
//
// The shore. The water surface is level with the ground, so nothing stops a
// floating toy drifting up the bank. A real toy runs aground on the rising
// bed; here, a toy floating in the water is held a little inside the edge
// (signed distance ≤ −0.6 R) and bounces off it softly.
import * as THREE from 'three';
import { RigidBody, type LocalFluid } from '../physics/rigidbody';
import { bodyDef, type ToyKind } from '../physics/toyBodies';
import type { Load } from '../physics/pressureMap';
import type { Impulse, ShallowWaterSolver } from '../physics/solver';
import type { FluidProperties } from '../physics/fluids';
import { FluidSampler, SAMPLER_CAPACITY } from '../physics/fluidSampler';
import { toyMesh } from './toyModels';

export const MAX_TOYS = 6;
const CARRY_HEIGHT = 0.2; // [m] held toys hover this far above the ground

const RING = 12; // fluid samples on a ring around each toy
const DRIFT_TAU = 0.4; // [s] averaging time for the wave drift force

interface Toy {
  kind: ToyKind;
  body: RigidBody;
  mesh: THREE.Mesh;
  loads: Load[];
  /** the fluid around this toy, from the last readback */
  fluid: LocalFluid;
  /** ⟨η u⟩, ⟨η v⟩ on the ring, low-pass filtered [m²/s] */
  etaU: THREE.Vector2;
  /** latest instantaneous ⟨η u⟩ sample */
  etaUNow: THREE.Vector2;
  /** wave drift force [N] (for the engineering overlay) */
  drift: THREE.Vector3;
  /** floating in the puddle (rather than lying on the ground) */
  inWater: boolean;
  /** 1 = full size; shrinks while hovering over the toy drawer */
  scale: number;
  /** being put away: shrinks to nothing, then is removed */
  dying: boolean;
  overDrawer: boolean;
}

interface Tag {
  toys: { toy: Toy; offset: number; count: number }[];
}

export interface ToyEvents {
  /** a toy hit the fluid at vertical speed v [m/s] */
  onEntry(kind: ToyKind, x: number, z: number, v: number, mass: number, radius: number): void;
  /** momentum and pressure handed to the fluid */
  impulse(imp: Impulse): void;
}

export class Toys {
  readonly toys: Toy[] = [];
  private sampler: FluidSampler;
  private xz = new Float32Array(SAMPLER_CAPACITY * 2);
  private ray = new THREE.Raycaster();
  private carryPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CARRY_HEIGHT);
  private carried = new Map<number, { toy: Toy; target: THREE.Vector3 }>();
  /** sum of the latest drag/buoyancy readouts, for the engineering overlay */
  wind = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private solver: ShallowWaterSolver,
    renderer: THREE.WebGLRenderer,
    private camera: THREE.Camera,
    private events: ToyEvents,
  ) {
    this.sampler = new FluidSampler(renderer, () => solver.stateTexture, [solver.grid.nx, solver.grid.nz], solver.origin, solver.grid.dx);
  }

  /** Bed under the puddle, flat ground elsewhere. */
  floorAt = (x: number, z: number) => {
    const H = this.solver.depthAt(x, z);
    return H > 0 ? -H : 0;
  };

  spawn(kind: ToyKind, at: THREE.Vector3): Toy {
    if (this.toys.length >= MAX_TOYS) this.remove(this.toys.find((t) => !t.body.held) ?? this.toys[0]);
    const body = new RigidBody(bodyDef(kind));
    body.pos.copy(at);
    body.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    const mesh = toyMesh(kind);
    this.scene.add(mesh);
    const toy: Toy = {
      kind, body, mesh, loads: [], fluid: { eta0: 0, slopeX: 0, slopeZ: 0, u: 0, v: 0, depth: 0 },
      etaU: new THREE.Vector2(), etaUNow: new THREE.Vector2(), drift: new THREE.Vector3(), inWater: false, scale: 1, dying: false, overDrawer: false,
    };
    this.toys.push(toy);
    this.sync(toy);
    return toy;
  }

  remove(toy: Toy) {
    const i = this.toys.indexOf(toy);
    if (i >= 0) this.toys.splice(i, 1);
    this.scene.remove(toy.mesh);
    for (const [id, c] of this.carried) if (c.toy === toy) this.carried.delete(id);
  }

  clear() {
    [...this.toys].forEach((t) => this.remove(t));
  }

  private rayFrom(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.ray;
  }

  /** Start carrying a new toy from the drawer. */
  carryNew(id: number, kind: ToyKind, ndc: THREE.Vector2) {
    const p = this.rayFrom(ndc).intersectPlane(this.carryPlane, new THREE.Vector3()) ?? new THREE.Vector3(0, CARRY_HEIGHT, 0);
    const toy = this.spawn(kind, p);
    toy.body.held = true;
    this.carried.set(id, { toy, target: p.clone() });
  }

  /** Try to pick up a toy under the pointer. */
  pick(id: number, ndc: THREE.Vector2): boolean {
    const ray = this.rayFrom(ndc);
    let best: Toy | null = null;
    let bestD = Infinity;
    for (const t of this.toys) {
      const s = new THREE.Sphere(t.body.pos, t.body.def.radius * 1.3);
      const hit = ray.intersectSphere(s, new THREE.Vector3());
      if (hit) {
        const d = hit.distanceTo(ray.origin);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
    }
    if (!best) return false;
    best.body.held = true;
    const target = ray.intersectPlane(this.carryPlane, new THREE.Vector3()) ?? best.body.pos.clone();
    this.carried.set(id, { toy: best, target });
    return true;
  }

  moveCarry(id: number, ndc: THREE.Vector2, overDrawer = false) {
    const c = this.carried.get(id);
    if (!c) return;
    c.toy.overDrawer = overDrawer;
    const p = this.rayFrom(ndc).intersectPlane(this.carryPlane, new THREE.Vector3());
    if (!p) return;
    // keep a carried toy over the scene: near the bottom of the screen the
    // carry plane comes right up to the camera, and the toy would balloon
    const hx = this.solver.shape.halfX + 0.5, hz = this.solver.shape.halfZ;
    p.x = THREE.MathUtils.clamp(p.x, -hx, hx);
    p.z = THREE.MathUtils.clamp(p.z, -hz - 1.2, hz + 0.15);
    c.target.copy(p);
  }

  /** Let go: the toy falls with whatever velocity the hand gave it. */
  endCarry(id: number, discard = false) {
    const c = this.carried.get(id);
    if (!c) return;
    this.carried.delete(id);
    c.toy.body.held = false;
    c.toy.body.airborne = true;
    c.toy.overDrawer = false;
    if (discard) {
      // put away: it shrinks into the drawer instead of vanishing
      c.toy.dying = true;
      c.toy.body.held = true;
    }
  }

  isCarrying(id: number) {
    return this.carried.has(id);
  }

  update(dt: number, fluid: FluidProperties, g: number, windForce?: (t: Toy) => THREE.Vector3 | undefined): Load[] {
    if (dt <= 0) return this.allLoads();
    // 1. hand the latest readback to the toys it belongs to
    const tag = this.sampler.resultTag as Tag | null;
    if (tag) {
      for (const { toy, offset, count } of tag.toys) {
        if (!this.toys.includes(toy) || count < RING) continue;
        // least-squares plane through the ring: for points evenly spaced on
        // a circle of radius ρ, η₀ = mean, s_x = Σ η Δx / Σ Δx² (same for z)
        const res = this.sampler.result;
        const rr = this.ringRadius(toy);
        let e0 = 0, sx = 0, sz = 0, u = 0, v = 0, eu = 0, ev = 0;
        for (let k = 0; k < RING; k++) {
          const a = (k / RING) * Math.PI * 2;
          const e = res[(offset + k) * 4];
          const uk = res[(offset + k) * 4 + 1], vk = res[(offset + k) * 4 + 2];
          e0 += e;
          sx += e * Math.cos(a);
          sz += e * Math.sin(a);
          u += uk;
          v += vk;
          eu += e * uk;
          ev += e * vk;
        }
        toy.etaUNow.set(eu / RING, ev / RING);
        const norm = (RING / 2) * rr;
        toy.fluid.eta0 = e0 / RING;
        toy.fluid.slopeX = sx / norm;
        toy.fluid.slopeZ = sz / norm;
        toy.fluid.u = u / RING;
        toy.fluid.v = v / RING;
      }
      this.sampler.resultTag = null;
    }

    // 2. step each toy
    for (const toy of [...this.toys]) {
      const b = toy.body;
      // shrink over the drawer, and away to nothing when put away
      const want = toy.dying ? 0 : toy.overDrawer ? 0.35 : 1;
      toy.scale += (want - toy.scale) * (1 - Math.exp(-dt * (toy.dying ? 14 : 10)));
      if (toy.dying && toy.scale < 0.03) {
        this.remove(toy);
        continue;
      }
      if (b.held) {
        // follow the finger with a critically damped spring; the velocity it
        // builds up is kept on release, so toys can be tossed
        const c = [...this.carried.values()].find((x) => x.toy === toy);
        if (c) {
          const k = 1 - Math.exp(-dt * 18);
          const next = b.pos.clone().lerp(c.target, k);
          b.vel.copy(next).sub(b.pos).divideScalar(dt).clampLength(0, 3);
          b.pos.copy(next);
          b.omega.multiplyScalar(0.9);
          b.quat.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, new THREE.Euler().setFromQuaternion(b.quat).y, 0)), 0.15);
        }
        toy.loads = [];
        this.sync(toy);
        continue;
      }
      const wasAirborne = b.airborne;
      const vIn = -b.vel.y;
      toy.fluid.depth = this.solver.depthAt(b.pos.x, b.pos.z);
      // wave drift force F = ρ c ⟨η u⟩ W, with W the toy's width
      toy.etaU.lerp(toy.etaUNow, 1 - Math.exp(-dt / DRIFT_TAU));
      const h = Math.max(toy.fluid.depth, 0.002);
      const c = Math.sqrt(g * h);
      const W = 2 * b.def.radius;
      if (b.submerged > 0) toy.drift.set(toy.etaU.x, 0, toy.etaU.y).multiplyScalar(fluid.density * c * W);
      else toy.drift.set(0, 0, 0);
      const extra = (windForce?.(toy) ?? new THREE.Vector3()).clone().add(toy.drift);
      b.step(dt, fluid, g, toy.fluid, this.floorAt, extra);
      this.keepOffShore(toy);
      if (wasAirborne && !b.airborne && vIn > 0.3) {
        this.events.onEntry(toy.kind, b.pos.x, b.pos.z, vIn, b.def.mass, b.def.radius);
      }
      this.coupleToFluid(toy, dt, fluid, g);
      this.sync(toy);
      // anything that wanders far off the puddle area is tidied away
      if (b.pos.y < -1 || Math.abs(b.pos.x) > 6 || Math.abs(b.pos.z) > 6) this.remove(toy);
    }

    // 3. request the fluid under every sample for the next frame
    const t: Tag = { toys: [] };
    let n = 0;
    for (const toy of this.toys) {
      if (n + RING > SAMPLER_CAPACITY) break;
      const rr = this.ringRadius(toy);
      for (let k = 0; k < RING; k++) {
        const a = (k / RING) * Math.PI * 2;
        this.xz[(n + k) * 2] = toy.body.pos.x + Math.cos(a) * rr;
        this.xz[(n + k) * 2 + 1] = toy.body.pos.z + Math.sin(a) * rr;
      }
      t.toys.push({ toy, offset: n, count: RING });
      n += RING;
    }
    if (n) this.sampler.request(this.xz, n, t);
    return this.allLoads();
  }

  /**
   * A toy floating in the puddle stays in it: its centre is held at least
   * 0.6 R inside the edge, and its motion toward the shore is reflected with
   * a soft restitution (0.3), like nudging a reed bank.
   */
  private keepOffShore(toy: Toy) {
    const b = toy.body;
    const s = this.solver.sdfAt(b.pos.x, b.pos.z);
    const margin = -0.6 * b.def.radius;
    if (b.airborne) {
      toy.inWater = false;
      return;
    }
    if (!toy.inWater) {
      // only toys that are actually afloat are kept in (one dropped on the
      // grass stays on the grass)
      toy.inWater = s < margin && b.submerged > 0;
      return;
    }
    if (s <= margin) return;
    const e = 0.02;
    let gx = this.solver.sdfAt(b.pos.x + e, b.pos.z) - this.solver.sdfAt(b.pos.x - e, b.pos.z);
    let gz = this.solver.sdfAt(b.pos.x, b.pos.z + e) - this.solver.sdfAt(b.pos.x, b.pos.z - e);
    const l = Math.hypot(gx, gz) || 1;
    gx /= l;
    gz /= l;
    b.pos.x -= gx * (s - margin);
    b.pos.z -= gz * (s - margin);
    const vn = b.vel.x * gx + b.vel.z * gz;
    if (vn > 0) {
      b.vel.x -= 1.3 * vn * gx;
      b.vel.z -= 1.3 * vn * gz;
    }
  }

  private allLoads() {
    return this.toys.flatMap((t) => t.loads);
  }

  /** just outside the hull footprint, clear of most of the toy's own dent */
  private ringRadius(toy: Toy) {
    return toy.body.def.radius * 1.25 + this.solver.grid.dx;
  }

  /**
   * Body → fluid. The buoyant force of the submerged samples is binned into
   * three patches along the hull (bow, middle, stern); each becomes a
   * Gaussian pressure load with the same total force. Drag's reaction is
   * added to the water as momentum over the hull's footprint.
   */
  private coupleToFluid(toy: Toy, dt: number, fluid: FluidProperties, g: number) {
    const b = toy.body;
    const d = b.def;
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(b.quat);
    const bins = [0, 1, 2].map(() => ({ f: 0, x: 0, z: 0, xx: 0, zz: 0 }));
    const len = d.radius;
    const minR = 1.5 * this.solver.grid.dx;
    for (let k = 0; k < d.samples.length; k++) {
      const P = b.world[k];
      const frac = b.frac[k];
      if (frac <= 0) continue;
      const F = fluid.density * g * frac * d.samples[k].dV;
      const along = (P.x - b.pos.x) * fwd.x + (P.z - b.pos.z) * fwd.z;
      const bi = along < -len / 3 ? 0 : along > len / 3 ? 2 : 1;
      const bin = bins[bi];
      bin.f += F;
      bin.x += F * P.x;
      bin.z += F * P.z;
      bin.xx += F * P.x * P.x;
      bin.zz += F * P.z * P.z;
    }
    toy.loads = [];
    for (const bin of bins) {
      if (bin.f <= 0) continue;
      const cx = bin.x / bin.f, cz = bin.z / bin.f;
      const spread = Math.sqrt(Math.max(bin.xx / bin.f - cx * cx + bin.zz / bin.f - cz * cz, 0));
      // keep the dent under the hull: a Gaussian wider than the hull would
      // leave a visible crater rim around the toy (real water meets the
      // hull at its waterline and is flat outside it)
      const R = Math.max(spread * 0.75, minR);
      // a load can't push the surface below the bed: cap at ρ g H
      const H = Math.max(this.solver.depthAt(cx, cz), 0.001);
      const p = Math.min(bin.f / (Math.PI * R * R), 0.9 * fluid.density * g * H);
      toy.loads.push({ x: cx, z: cz, radius: R, pressure: p });
    }
    // wake: drag's reaction as momentum Δu = −F dt / (ρ h π R²)
    const h = Math.max(this.solver.depthAt(b.pos.x, b.pos.z), 0.002);
    if (b.submerged > 0 && this.solver.sdfAt(b.pos.x, b.pos.z) < 0) {
      const R = Math.max(d.radius * 0.7, minR);
      const k = -dt / (fluid.density * h * Math.PI * R * R);
      const push: [number, number] = [b.drag.x * k, b.drag.z * k];
      if (Math.hypot(...push) > 1e-5) this.events.impulse({ x: b.pos.x, z: b.pos.z, radius: R, pressureImpulse: 0, push });
    }
  }

  private sync(toy: Toy) {
    toy.mesh.position.copy(toy.body.pos);
    toy.mesh.quaternion.copy(toy.body.quat);
    toy.mesh.scale.setScalar(toy.scale);
  }
}
