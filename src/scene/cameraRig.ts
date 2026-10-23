// Camera poses for each way of playing, with smooth moves between them.
//   slap / boat / fish   the framed view: the puddle fills the bottom of the screen
//   skip          first person: crouched just off one end of the puddle's
//                 longest chord, looking along it to the farthest shore
import * as THREE from 'three';
import type { Framing } from './framing';

export type PlayMode = 'slap' | 'skip' | 'fish' | 'boat';

interface Pose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

export class CameraRig {
  mode: PlayMode = 'slap';
  private base: Framing | null = null;
  private halfX = 1;
  private halfZ = 0.7;
  private portrait = false;
  private current: Pose | null = null;
  /** the puddle's longest chord, near end first (for skipping) */
  skipLine: { from: THREE.Vector2; to: THREE.Vector2 } | null = null;

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** the framed view for this screen and puddle (from framing.ts) */
  setBase(f: Framing, halfX: number, halfZ: number, aspect: number) {
    this.base = f;
    this.halfX = halfX;
    this.halfZ = halfZ;
    this.portrait = aspect < 1;
    if (!this.current) this.snap();
  }

  target(): Pose {
    const b = this.base!;
    const hx = this.halfX, hz = this.halfZ;
    switch (this.mode) {
      case 'skip': {
        const l = this.skipLine;
        if (!l) return { pos: new THREE.Vector3(-hx * 0.78, 0.42, hz * 0.95), look: new THREE.Vector3(hx * 0.55, -0.12, -hz * 0.55), fov: this.portrait ? 72 : 58 };
        const back = l.from.clone().sub(l.to).normalize();
        const len = l.from.distanceTo(l.to);
        const at = l.from.clone().addScaledVector(back, 0.4 + 0.1 * len);
        const look = l.from.clone().lerp(l.to, 0.75);
        return {
          pos: new THREE.Vector3(at.x, 0.36 + 0.05 * len, at.y),
          look: new THREE.Vector3(look.x, -0.06, look.y),
          fov: this.portrait ? 72 : 56,
        };
      }
      default:
        return { pos: b.position.clone(), look: b.target.clone(), fov: b.fov };
    }
  }

  /** jump straight to the current mode's pose */
  snap() {
    if (!this.base) return;
    this.current = this.target();
    this.apply(this.current);
  }

  /** ease toward the mode's pose (time constant ~0.35 s) */
  update(dt: number) {
    if (!this.base) return;
    const t = this.target();
    const c = this.current ?? t;
    const k = 1 - Math.exp(-dt / 0.35);
    c.pos.lerp(t.pos, k);
    c.look.lerp(t.look, k);
    c.fov += (t.fov - c.fov) * k;
    this.current = c;
    this.apply(c);
  }

  /** settled into the mode's pose? */
  get settled() {
    if (!this.current) return true;
    return this.current.pos.distanceTo(this.target().pos) < 0.01;
  }

  private apply(p: Pose) {
    this.camera.position.copy(p.pos);
    this.camera.lookAt(p.look);
    if (Math.abs(this.camera.fov - p.fov) > 1e-3) {
      this.camera.fov = p.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
  }

  /** the horizontal direction the camera faces (for first-person throws) */
  forward() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    d.y = 0;
    return d.normalize();
  }
}
