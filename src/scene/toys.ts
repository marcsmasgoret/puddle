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

const RING = 8; // fluid samples on a ring around each toy

interface Toy {
  kind: ToyKind;
  body: RigidBody;
  mesh: THREE.Mesh;
  loads: Load[];
  /** the fluid around this toy, from the last readback */
  fluid: LocalFluid;
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
    const toy: Toy = { kind, body, mesh, loads: [], fluid: { eta0: 0, slopeX: 0, slopeZ: 0, u: 0, v: 0, depth: 0 } };
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

  moveCarry(id: number, ndc: THREE.Vector2) {
    const c = this.carried.get(id);
    if (!c) return;
    const p = this.rayFrom(ndc).intersectPlane(this.carryPlane, new THREE.Vector3());
    if (p) c.target.copy(p);
  }

  /** Let go: the toy falls with whatever velocity the hand gave it. */
  endCarry(id: number, discard = false) {
    const c = this.carried.get(id);
    if (!c) return;
    this.carried.delete(id);
    c.toy.body.held = false;
    c.toy.body.airborne = true;
    if (discard) this.remove(c.toy);
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
        let e0 = 0, sx = 0, sz = 0, u = 0, v = 0;
        for (let k = 0; k < RING; k++) {
          const a = (k / RING) * Math.PI * 2;
          const e = res[(offset + k) * 4];
          e0 += e;
          sx += e * Math.cos(a);
          sz += e * Math.sin(a);
          u += res[(offset + k) * 4 + 1];
          v += res[(offset + k) * 4 + 2];
        }
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
    for (const toy of this.toys) {
      const b = toy.body;
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
      b.step(dt, fluid, g, toy.fluid, this.floorAt, windForce?.(toy));
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

  private allLoads() {
    return this.toys.flatMap((t) => t.loads);
  }

  /** just outside the hull footprint, clear of the toy's own dent */
  private ringRadius(toy: Toy) {
    return toy.body.def.radius * 1.6 + 1.5 * this.solver.grid.dx;
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
      const R = Math.max(spread * 1.2, minR);
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
  }
}
