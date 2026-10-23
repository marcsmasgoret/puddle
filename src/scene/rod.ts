// The fishing rod in your hands: held from just outside the bottom-right
// corner of the view, so only its last stretch shows, the tip bending under
// the line's pull. It flicks back and forward when you cast and dips when
// something nibbles.
import * as THREE from 'three';

const LEN = 1.9; // rod length [m]

export class Rod {
  readonly group = new THREE.Group();
  private segs: THREE.Group[] = [];
  private cast = -1; // cast animation clock (s), −1 = idle
  private dip = 0;
  /** how hard the line pulls on the tip (0…1), bends the rod */
  load = 0;

  constructor(scene: THREE.Scene) {
    const blank = new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.35, metalness: 0.3 });
    const cork = new THREE.MeshStandardMaterial({ color: '#b48a5c', roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.3, metalness: 0.8 });
    // grip + reel at the butt
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.28, 12), cork);
    grip.rotation.x = Math.PI / 2;
    grip.position.z = -0.1;
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 20), metal);
    reel.rotation.z = Math.PI / 2;
    reel.position.set(0, -0.04, 0.02);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.035, 0.03), metal);
    foot.position.set(0, -0.02, 0.02);
    this.group.add(grip, reel, foot);
    // the blank in 8 segments, so it can bend
    let parent: THREE.Object3D = this.group;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const seg = new THREE.Group();
      seg.position.z = k === 0 ? 0.04 : LEN / n;
      const r0 = 0.009 * (1 - k / n) + 0.0015, r1 = 0.009 * (1 - (k + 1) / n) + 0.0015;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, LEN / n, 8), blank);
      m.rotation.x = Math.PI / 2;
      m.position.z = LEN / n / 2;
      seg.add(m);
      if (k % 2 === 1) {
        const guide = new THREE.Mesh(new THREE.TorusGeometry(0.008 - k * 0.0006, 0.0012, 6, 12), metal);
        guide.position.set(0, -0.012, LEN / n);
        seg.add(guide);
      }
      parent.add(seg);
      this.segs.push(seg);
      parent = seg;
    }
    this.group.traverse((o) => ((o as THREE.Mesh).castShadow = false));
    this.group.visible = false;
    scene.add(this.group);
  }

  set visible(v: boolean) {
    this.group.visible = v;
  }

  startCast() {
    this.cast = 0;
  }

  nibble(strength: number) {
    this.dip = Math.min(1, this.dip + strength * 25);
  }

  /** Hold the rod from off-screen, bottom right; returns the tip. */
  update(camera: THREE.PerspectiveCamera, dt: number) {
    // the tip just inside the right edge, under a metre out; the rest of
    // the rod runs off to the right to the hands, out of shot
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tx = ty * camera.aspect;
    const tipCam = new THREE.Vector3(0.62 * tx, -0.22 * ty, -1).multiplyScalar(0.75);
    const buttCam = tipCam.clone().add(new THREE.Vector3(0.85, -0.22, 0.5).normalize().multiplyScalar(LEN));
    const butt = buttCam.applyMatrix4(camera.matrixWorld);
    const aim = tipCam.applyMatrix4(camera.matrixWorld);
    // never through the ground
    const lift = Math.max(0, 0.12 - aim.y);
    butt.y += lift;
    aim.y += lift;
    this.group.position.copy(butt);
    this.group.lookAt(aim);
    // cast: the rod sweeps back over the shoulder, then whips forward
    let swing = 0;
    if (this.cast >= 0) {
      this.cast += dt;
      const t = this.cast;
      swing = t < 0.18 ? -0.9 * (t / 0.18) : t < 0.38 ? -0.9 + 1.4 * ((t - 0.18) / 0.2) : 0.5 * Math.exp(-(t - 0.38) * 6);
      if (t > 1.2) this.cast = -1;
    }
    this.group.rotateX(-swing);
    this.dip *= Math.exp(-dt * 4);
    // the blank bends progressively toward the tip under load
    const bend = 0.03 + 0.12 * this.load + 0.25 * this.dip;
    this.segs.forEach((s, k) => (s.rotation.x = bend * (k / this.segs.length) * 0.45 + (this.cast >= 0 ? swing * 0.08 : 0)));
    this.group.updateMatrixWorld(true);
    return this.tip();
  }

  tip() {
    return new THREE.Vector3(0, 0, 0).applyMatrix4(this.segs[this.segs.length - 1].matrixWorld).add(
      new THREE.Vector3(0, 0, LEN / this.segs.length).applyQuaternion(this.segs[this.segs.length - 1].getWorldQuaternion(new THREE.Quaternion())),
    );
  }
}
