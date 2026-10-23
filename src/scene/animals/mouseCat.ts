// The secret: now and then (every few minutes, never on a schedule you can
// count on) a small mouse pops out somewhere fitting for the place, sniffs,
// and scurries off to a hiding spot. Sometimes a tabby cat has spotted it:
// it creeps in, belly low, wiggles its hips, pounces, gives a bounding
// chase, and is always just too late. The mouse vanishes into its hole; the
// cat sits there, puzzled, looks around, and wanders off.
//
// Gait notes (from watching cats): a walking cat moves its legs in a lateral
// sequence (left hind, left fore, right hind, right fore, a quarter cycle
// apart); stalking is the same gait, slow, with the belly low, head forward
// and tail low; before the pounce the hindquarters shift side to side to set
// the hind feet ("the wiggle"); a chase is a bound, hind legs then fore legs,
// with the spine flexing. Mice move in quick trotting dashes with stops.
//
// Both animals keep to solid ground: the cat chooses a way in that crosses
// neither open water nor the puddle (cats don't wade), and walks off the
// same way.
import * as THREE from 'three';
import { sculpt, prepare } from './sculpt';
import { catSpec, mouseSpec } from './species';
import { Quadruped } from './gait';
import type { Prints } from './prints';

export interface MouseSpots {
  from: [number, number];
  to: [number, number];
  /** what it hides in: a hole, a storm drain, a gap, grass, a snowbank */
  hide: 'hole' | 'drain' | 'gap' | 'grass' | 'snowbank';
}

const yawTo = (dx: number, dz: number) => Math.atan2(-dz, dx);

type MouseState = 'hidden' | 'emerge' | 'sniff' | 'scurry' | 'wait' | 'flee' | 'dive';
type CatState = 'away' | 'walkIn' | 'stalk' | 'wiggle' | 'pounce' | 'bound' | 'sit' | 'wander';

export class MouseCat {
  readonly group = new THREE.Group();
  private mouse: Quadruped | null = null;
  private cat: Quadruped | null = null;
  private holes: THREE.Mesh[] = [];
  private mounds: THREE.Mesh[] = [];
  private spots: MouseSpots | null = null;
  private walkable: (x: number, z: number) => boolean = () => true;
  private snowy = false;
  private next = 60 + Math.random() * 120;
  private t = 0;

  private mState: MouseState = 'hidden';
  private mTime = 0;
  private waitAt = new THREE.Vector3();
  private sink = 0;

  private chase = false;
  private cState: CatState = 'away';
  private cTime = 0;
  private entry = new THREE.Vector3();
  private leapFrom = new THREE.Vector3();
  private leapTo = new THREE.Vector3();
  private looks: THREE.Vector3[] = [];

  constructor(private prints: Prints) {
    // mesh both animals in the background now, so they are ready when needed
    Promise.all([prepare(catSpec()), prepare(mouseSpec())]).then(() => this.build());
  }

  private build() {
    const cs = catSpec(), ms = mouseSpec();
    this.cat = new Quadruped(sculpt(cs), cs, { cadence: 1.7, cadenceGain: 1.3, height: 0.2, tailCurve: 0.16 });
    this.mouse = new Quadruped(sculpt(ms), ms, { cadence: 7, cadenceGain: 4, height: 0.02, tailCurve: 0.02 });
    this.cat.root.visible = this.mouse.root.visible = false;
    this.group.add(this.cat.root, this.mouse.root);
    this.cat.onFootDown = (_leg, p) => {
      if (this.snowy) this.prints.stamp(p.x, p.z, 0.034, 0.04, this.cat!.yaw, 0.95);
    };
    this.mouse.onFootDown = (leg, p) => {
      if (this.snowy && leg[0] === 'h') this.prints.stamp(p.x, p.z, 0.01, 0.012, this.mouse!.yaw, 0.8);
    };
  }

  /** New place or season: where the mouse lives, and where it is safe to walk. */
  configure(spots: MouseSpots | null, snowy: boolean, walkable: (x: number, z: number) => boolean = () => true) {
    this.spots = spots;
    this.snowy = snowy;
    this.walkable = walkable;
    for (const m of [...this.holes, ...this.mounds]) this.group.remove(m);
    this.holes = [];
    this.mounds = [];
    this.mState = 'hidden';
    this.cState = 'away';
    if (this.cat) this.cat.root.visible = this.mouse!.root.visible = false;
    if (!spots) return;
    const hide = snowy && (spots.hide === 'hole' || spots.hide === 'grass') ? 'snowbank' : spots.hide;
    for (const [x, z] of [spots.from, spots.to]) {
      if (hide === 'snowbank') {
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.75 }));
        mound.scale.set(1.3, 0.55, 1);
        mound.position.set(x, -0.01, z);
        mound.receiveShadow = mound.castShadow = true;
        this.mounds.push(mound);
        this.group.add(mound);
      } else if (hide === 'hole' || hide === 'gap') {
        // a hole: a dark opening with a soft rim of disturbed earth
        const hole = new THREE.Mesh(new THREE.CircleGeometry(hide === 'gap' ? 0.035 : 0.028, 20), new THREE.MeshBasicMaterial({ color: '#0d0907' }));
        hole.rotation.x = -Math.PI / 2;
        hole.scale.set(1.3, 0.85, 1);
        hole.position.set(x, 0.003, z);
        const rim = new THREE.Mesh(new THREE.RingGeometry(hide === 'gap' ? 0.035 : 0.028, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1, transparent: true, opacity: 0.6 }));
        rim.rotation.x = -Math.PI / 2;
        rim.scale.set(1.3, 0.85, 1);
        rim.position.set(x, 0.002, z);
        this.holes.push(hole, rim);
        this.group.add(hole, rim);
      }
    }
  }

  /** A straight path is fine if every point on it is on walkable ground. */
  private clear(a: THREE.Vector3, b: THREE.Vector3) {
    for (let k = 0; k <= 16; k++) {
      const p = a.clone().lerp(b, k / 16);
      if (!this.walkable(p.x, p.z)) return false;
    }
    return true;
  }

  /** Start a visit now (for testing); chase decides whether the cat comes. */
  trigger(chase = Math.random() < 0.45) {
    if (!this.spots || !this.cat || !this.mouse) return;
    const [fx, fz] = this.spots.from;
    const [tx, tz] = this.spots.to;
    const m = this.mouse;
    m.pos.set(fx, 0, fz);
    m.yaw = yawTo(tx - fx, tz - fz);
    m.speed = m.targetSpeed = 0;
    // the mouse stops to sniff ~1.3 m short of its hiding place
    const d = Math.hypot(tx - fx, tz - fz);
    const stop = Math.max(0.25, Math.min(1.3, d * 0.55));
    this.waitAt.set(tx - ((tx - fx) / d) * stop, 0, tz - ((tz - fz) / d) * stop);
    this.setMouse('emerge');
    m.root.visible = true;
    this.chase = false;
    if (chase) {
      // the cat appears from a direction it could really have walked in from
      const from = new THREE.Vector3(fx, 0, fz);
      const away = Math.sign(fx - tx) || 1;
      const candidates = [
        [away, 0.15], [away, 0.8], [0.35 * away, 1], [-away, 0.3], [0, 1], [away, -0.6],
      ].map(([x, z]) => from.clone().add(new THREE.Vector3(x, 0, z).normalize().multiplyScalar(3.2)));
      const start = candidates.find((c) => this.walkable(c.x, c.z) && this.clear(c, this.waitAt));
      if (start) {
        this.chase = true;
        const c = this.cat;
        c.pos.copy(start);
        c.yaw = yawTo(this.waitAt.x - start.x, this.waitAt.z - start.z);
        c.speed = c.targetSpeed = 0.4;
        this.entry.copy(start);
        this.setCat('walkIn');
        c.root.visible = true;
      }
    }
  }

  get state() {
    return `${this.mState}/${this.cState}`;
  }

  get busy() {
    return this.mState !== 'hidden' || this.cState !== 'away';
  }

  private setMouse(s: MouseState) {
    this.mState = s;
    this.mTime = 0;
  }
  private setCat(s: CatState) {
    this.cState = s;
    this.cTime = 0;
  }

  update(dt: number) {
    this.t += dt;
    if (!this.cat || !this.mouse) return;
    if (this.mState === 'hidden' && this.cState === 'away') {
      this.next -= dt;
      if (this.next <= 0 && this.spots) {
        this.next = 150 + Math.random() * 240;
        this.trigger();
      }
      return;
    }
    if (this.mState !== 'hidden') this.updateMouse(dt);
    if (this.cState !== 'away') this.updateCat(dt);
  }

  // ── mouse ─────────────────────────────────────────────────────────────────
  private updateMouse(dt: number) {
    const m = this.mouse!;
    this.mTime += dt;
    const hole = new THREE.Vector3(this.spots!.to[0], 0, this.spots!.to[1]);
    m.lookAt = null;
    m.sit = 0;
    m.headDown = 0;
    switch (this.mState) {
      case 'emerge':
        // nose first out of the hole / snowbank
        this.sink = (1 - Math.min(this.mTime / 0.6, 1)) * 0.035;
        if (this.mTime > 0.6) this.setMouse('sniff');
        break;
      case 'sniff':
        m.targetSpeed = 0;
        m.headDown = 0.3 + 0.25 * Math.sin(this.t * 11);
        m.lookAt = m.pos.clone().add(new THREE.Vector3(Math.cos(this.t * 2.3), 0.02, Math.sin(this.t * 1.7)));
        if (this.mTime > 1.1) this.setMouse('scurry');
        break;
      case 'scurry': {
        // quick dashes with little stops
        const dash = Math.sin(this.mTime * 3.1) > -0.55;
        const to = this.waitAt.clone().sub(m.pos);
        m.targetSpeed = dash ? Math.min(0.9, to.length() * 4) : 0;
        m.gait = 'trot';
        m.turnToward(yawTo(to.x, to.z) + Math.sin(this.t * 2) * 0.2, 10, dt);
        if (to.length() < 0.03) this.setMouse('wait');
        break;
      }
      case 'wait':
        // up on its haunches, sniffing the air
        m.targetSpeed = 0;
        m.speed = 0;
        m.sit = 0.7;
        m.headDown = -0.3 + 0.15 * Math.sin(this.t * 12);
        if (!this.chase && this.mTime > 1.4) this.setMouse('flee');
        break;
      case 'flee': {
        m.gait = 'bound';
        const to = hole.clone().sub(m.pos);
        m.targetSpeed = 1.6;
        m.speed = Math.max(m.speed, 1.2);
        m.turnToward(yawTo(to.x, to.z), 14, dt);
        if (to.length() < 0.05) this.setMouse('dive');
        break;
      }
      case 'dive':
        m.targetSpeed = 0.3;
        this.sink = Math.min(this.mTime / 0.25, 1) * 0.05;
        if (this.mTime > 0.3) {
          this.mState = 'hidden';
          m.root.visible = false;
        }
        break;
    }
    m.update(dt, -this.sink);
  }

  // ── cat ───────────────────────────────────────────────────────────────────
  private updateCat(dt: number) {
    const c = this.cat!;
    const m = this.mouse!;
    this.cTime += dt;
    const toMouse = m.pos.clone().sub(c.pos);
    toMouse.y = 0;
    const hole = new THREE.Vector3(this.spots!.to[0], 0, this.spots!.to[1]);
    c.wiggle = 0;
    c.lift = 0;
    switch (this.cState) {
      case 'walkIn':
        // strolls in, tail up; drops into a stalk once it locks on
        c.gait = 'walk';
        c.targetSpeed = 0.42;
        c.tailUp = 0.8;
        c.crouch = Math.max(0, c.crouch - dt);
        c.lookAt = m.pos.clone().setY(0.05);
        c.turnToward(yawTo(toMouse.x, toMouse.z), 1.6, dt);
        if (toMouse.length() < 1.9 || this.cTime > 8) this.setCat('stalk');
        break;
      case 'stalk': {
        // belly low, slow deliberate steps, freezing now and then
        c.crouch = Math.min(1, c.crouch + dt * 2);
        c.tailUp = -1;
        const freeze = Math.sin(this.cTime * 1.6) < -0.3;
        c.targetSpeed = freeze || toMouse.length() < 0.8 ? 0 : 0.16;
        c.lookAt = m.pos.clone().setY(0.03);
        c.turnToward(yawTo(toMouse.x, toMouse.z), 2.5, dt);
        if (toMouse.length() <= 0.85 && this.mState === 'wait') this.setCat('wiggle');
        if (this.cTime > 14) this.setCat('wiggle');
        break;
      }
      case 'wiggle':
        c.targetSpeed = 0;
        c.crouch = 1;
        c.wiggle = Math.min(1, this.cTime * 3);
        c.lookAt = m.pos.clone().setY(0.03);
        c.turnToward(yawTo(toMouse.x, toMouse.z), 4, dt);
        if (this.cTime > 1.3) {
          this.leapFrom.copy(c.pos);
          this.leapTo.copy(m.pos).addScaledVector(toMouse.clone().normalize(), -0.14);
          this.setCat('pounce');
        }
        break;
      case 'pounce': {
        // a low arcing leap; the mouse bolts a beat after take-off
        const T = 0.42;
        const k = Math.min(this.cTime / T, 1);
        c.crouch = Math.max(0, 1 - this.cTime * 6);
        c.gait = 'bound';
        c.speed = c.targetSpeed = 0.01;
        c.pos.lerpVectors(this.leapFrom, this.leapTo, k);
        c.lift = Math.sin(Math.PI * k) * 0.12;
        c.tailUp = 0;
        if (this.cTime > 0.08 && this.mState === 'wait') this.setMouse('flee');
        if (k >= 1) this.setCat('bound');
        break;
      }
      case 'bound': {
        const to = hole.clone().sub(c.pos);
        to.y = 0;
        c.gait = 'bound';
        c.targetSpeed = to.length() > 0.25 ? 2.1 : 0;
        c.lookAt = hole.clone().setY(0.02);
        c.turnToward(yawTo(to.x, to.z), 5, dt);
        if (to.length() < 0.25 || this.cTime > 1.6) {
          this.setCat('sit');
          this.looks = [0.7, -0.8, 0.2].map((a) => c.pos.clone().add(new THREE.Vector3(Math.cos(c.yaw + a), 0.2, -Math.sin(c.yaw + a))));
        }
        break;
      }
      case 'sit':
        // nose at the hole, puzzled: looks down, then about, tail curled
        c.gait = 'walk';
        c.targetSpeed = 0;
        c.sit = Math.min(1, this.cTime * 2.5);
        c.tailUp = 0.3;
        c.lookAt = this.cTime < 1.6 ? hole.clone() : this.looks[Math.min(2, Math.floor((this.cTime - 1.6) / 1.1))];
        if (this.cTime > 5) {
          this.setCat('wander');
          c.lookAt = null;
        }
        break;
      case 'wander': {
        // back the way it came
        c.sit = Math.max(0, c.sit - dt * 2);
        c.gait = 'walk';
        c.tailUp = 0.9;
        c.targetSpeed = c.sit > 0.2 ? 0 : 0.45;
        const to = this.entry.clone().sub(c.pos);
        c.turnToward(yawTo(to.x, to.z), 1.8, dt);
        if (to.length() < 0.3 || this.cTime > 14) {
          this.cState = 'away';
          c.root.visible = false;
        }
        break;
      }
    }
    c.update(dt);
  }
}
