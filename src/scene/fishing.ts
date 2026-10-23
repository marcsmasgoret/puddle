// Fishing: nothing to catch, just a bobber to watch.
//
// Tap the water to cast. The bobber flies from a rod tip just off-screen on a
// ballistic arc, lands with a little splash, and then floats as a real rigid
// body (same physics as the toys): it rides passing waves and drifts with
// the current. Now and then something nibbles: a short downward tug on the
// line (a pull of ~0.02 N, a few grams-force), which dips the bobber and
// sends out its own rings. Rarely there is a proper bite that pulls it under
// for a moment. Tap anywhere off the water to reel in.
import * as THREE from 'three';
import type { Toys } from './toys';

const FLIGHT_TIME = 0.75; // [s]

export class Fishing {
  private bobber: ReturnType<Toys['spawn']> | null = null;
  private line: THREE.Line;
  private positions = new Float32Array(32 * 3);
  private nextNibble = 0;
  private tug = 0; // remaining tug time [s]
  private tugForce = 0;
  private queue: { delay: number; dur: number; force: number }[] = [];
  private reeling = false;
  active = false;

  constructor(
    scene: THREE.Scene,
    private toys: Toys,
    private camera: THREE.PerspectiveCamera,
    private onNibble: (strength: number) => void,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f2f0ea', transparent: true, opacity: 0.55 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
  }

  /** The rod tip: just off the bottom-right corner of the screen. */
  private rodTip() {
    return new THREE.Vector3(1.25, -0.25, 0.4).unproject(this.camera).sub(this.camera.position).normalize().multiplyScalar(0.9).add(this.camera.position);
  }

  onCast: () => void = () => {};

  cast(x: number, z: number) {
    this.onCast();
    this.reelIn(true);
    const tip = this.rodTip();
    const target = new THREE.Vector3(x, 0.012, z);
    const T = FLIGHT_TIME;
    const g = 9.81;
    const toy = this.toys.spawn('bobber', tip);
    toy.body.vel.set((target.x - tip.x) / T, (target.y - tip.y + 0.5 * g * T * T) / T, (target.z - tip.z) / T);
    toy.body.quat.identity();
    this.bobber = toy;
    this.line.visible = true;
    this.nextNibble = 5 + Math.random() * 10;
    this.queue = [];
    this.tug = 0;
    this.reeling = false;
  }

  /** Reel in: the bobber is pulled back to the rod and disappears. */
  reelIn(immediate = false) {
    if (!this.bobber) return;
    if (immediate) {
      this.toys.remove(this.bobber);
      this.bobber = null;
      this.line.visible = false;
      return;
    }
    this.reeling = true;
  }

  /** extra force on the bobber this frame (nibbles, reeling) */
  forceFor(toy: { kind: string }) {
    if (!this.bobber || toy !== this.bobber) return undefined;
    const f = new THREE.Vector3();
    if (this.tug > 0) f.y -= this.tugForce;
    if (this.reeling) {
      const d = this.rodTip().sub(this.bobber.body.pos);
      f.addScaledVector(d.normalize(), 0.08);
    }
    return f;
  }

  update(dt: number) {
    if (!this.bobber) return;
    if (!this.toys.toys.includes(this.bobber)) {
      this.bobber = null;
      this.line.visible = false;
      return;
    }
    const b = this.bobber.body;
    // nibbles: occasional runs of small tugs, rarely a real bite
    if (!b.airborne && !this.reeling) {
      this.nextNibble -= dt;
      if (this.nextNibble <= 0) {
        const bite = Math.random() < 0.15;
        const n = bite ? 1 : 1 + Math.floor(Math.random() * 3);
        let delay = 0;
        for (let k = 0; k < n; k++) {
          this.queue.push({ delay, dur: bite ? 0.7 : 0.12 + Math.random() * 0.1, force: bite ? 0.06 : 0.015 + Math.random() * 0.015 });
          delay += 0.25 + Math.random() * 0.35;
        }
        this.nextNibble = 8 + Math.random() * 18;
      }
    }
    for (const q of this.queue) q.delay -= dt;
    const due = this.queue.findIndex((q) => q.delay <= 0);
    if (due >= 0 && this.tug <= 0) {
      const q = this.queue.splice(due, 1)[0];
      this.tug = q.dur;
      this.tugForce = q.force;
      this.onNibble(q.force);
    }
    this.tug -= dt;

    if (this.reeling && b.pos.distanceTo(this.rodTip()) < 0.15) this.reelIn(true);

    // the line: a sagging curve from the rod tip to the bobber's eye
    const tip = this.rodTip();
    const end = b.pos.clone().add(new THREE.Vector3(0, 0.02, 0));
    const slack = b.airborne ? 0.05 : 0.18;
    for (let k = 0; k < 32; k++) {
      const t = k / 31;
      const p = tip.clone().lerp(end, t);
      p.y -= Math.sin(Math.PI * t) * slack * tip.distanceTo(end) * 0.5;
      p.y = Math.max(p.y, end.y - 0.01);
      p.toArray(this.positions, k * 3);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }

  get hasBobber() {
    return !!this.bobber;
  }
}
