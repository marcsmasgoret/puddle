// Autumn leaves: they flutter down, and the ones that land on the puddle
// float. A floating leaf is a passive tracer on the surface: it rides the
// wave height η and is carried by the depth-averaged current (u, v) read back
// from the solver, plus a little wind drift (a leaf sits in the thin surface
// layer the wind drags fastest, ~3 % of the wind speed, the classic
// rule of thumb for surface drift).
import * as THREE from 'three';
import { FluidSampler } from '../../physics/fluidSampler';
import type { ShallowWaterSolver } from '../../physics/solver';

const N = 28;
type State = 0 | 1 | 2; // falling, floating, on the ground

export class Leaves {
  private mesh: THREE.InstancedMesh;
  private pos = Array.from({ length: N }, () => new THREE.Vector3());
  private vel = Array.from({ length: N }, () => new THREE.Vector3());
  private spin = new Float32Array(N);
  private angle = new Float32Array(N);
  private state = new Uint8Array(N) as unknown as State[];
  private age = new Float32Array(N);
  private cur = new Float32Array(N * 3); // last read η, u, v under each leaf
  private sampler: FluidSampler;
  private xz = new Float32Array(N * 2);
  private dummy = new THREE.Object3D();
  active = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, private solver: ShallowWaterSolver) {
    // a simple leaf: an ellipse with a pointed tip, slightly cupped
    const s = new THREE.Shape();
    s.moveTo(0, -0.03);
    s.quadraticCurveTo(0.024, -0.005, 0, 0.035);
    s.quadraticCurveTo(-0.024, -0.005, 0, -0.03);
    const geo = new THREE.ShapeGeometry(s, 6);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), N);
    const palette = ['#d9832b', '#c4521f', '#e6b13a', '#b8442a', '#e0962c'];
    for (let k = 0; k < N; k++) {
      this.mesh.setColorAt(k, new THREE.Color(palette[k % palette.length]));
      this.respawn(k, true);
    }
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.sampler = new FluidSampler(renderer, () => solver.stateTexture, [solver.grid.nx, solver.grid.nz], solver.origin, solver.grid.dx);
  }

  setActive(a: boolean) {
    this.active = a;
    this.mesh.visible = a;
    if (a) for (let k = 0; k < N; k++) this.respawn(k, true);
  }

  private respawn(k: number, anywhere = false) {
    this.pos[k].set((Math.random() * 2 - 1) * 3.5, anywhere ? Math.random() * 4 + 0.5 : 4 + Math.random() * 1.5, -2.5 + Math.random() * 3.6);
    this.vel[k].set(0, -0.6, 0);
    this.spin[k] = (Math.random() - 0.5) * 6;
    this.angle[k] = Math.random() * 6.28;
    this.state[k] = 0;
    this.age[k] = 0;
  }

  update(dt: number, t: number, wind: THREE.Vector2) {
    if (!this.active) return;
    const res = this.sampler.result;
    const fresh = this.sampler.resultTag !== null;
    for (let k = 0; k < N; k++) {
      const p = this.pos[k];
      const st = this.state[k];
      this.age[k] += dt;
      if (st === 0) {
        // fluttering fall: slow sink, side-to-side swing, carried by wind
        p.x += (Math.sin(t * 2.1 + k) * 0.35 + wind.x * 0.5) * dt;
        p.z += (Math.cos(t * 1.7 + k * 1.3) * 0.25 + wind.y * 0.5) * dt;
        p.y -= (0.55 + 0.25 * Math.sin(t * 3 + k)) * dt;
        this.angle[k] += this.spin[k] * dt;
        if (p.y <= 0.002) {
          const onWater = this.solver.sdfAt(p.x, p.z) < -0.01;
          this.state[k] = onWater ? 1 : 2;
          this.age[k] = 0;
          this.cur.fill(0, k * 3, k * 3 + 3);
          p.y = 0.002;
        }
      } else if (st === 1) {
        // floating: ride η, drift with the current and the wind
        if (fresh) this.cur.set([res[k * 4], res[k * 4 + 1], res[k * 4 + 2]], k * 3);
        p.y = this.cur[k * 3] + 0.002;
        p.x += (this.cur[k * 3 + 1] + wind.x * 0.03) * dt;
        p.z += (this.cur[k * 3 + 2] + wind.y * 0.03) * dt;
        this.angle[k] += (this.cur[k * 3 + 1] - this.cur[k * 3 + 2]) * dt * 4;
        // stranded on the shore: becomes a ground leaf
        if (this.solver.sdfAt(p.x, p.z) > 0) this.state[k] = 2;
        if (this.age[k] > 90) this.respawn(k);
      } else {
        p.x += wind.x * 0.05 * dt;
        p.z += wind.y * 0.05 * dt;
        if (this.age[k] > 40 || Math.abs(p.x) > 7) this.respawn(k);
      }
      this.dummy.position.copy(p);
      this.dummy.rotation.set(st === 0 ? Math.sin(t * 3 + k) * 0.8 : 0, this.angle[k], st === 0 ? Math.cos(t * 2.5 + k) * 0.6 : 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(k, this.dummy.matrix);
      this.xz[k * 2] = p.x;
      this.xz[k * 2 + 1] = p.z;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.sampler.resultTag = null;
    this.sampler.request(this.xz, N, true);
  }
}
