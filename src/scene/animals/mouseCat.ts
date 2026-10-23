// The secret: now and then (every few minutes, never on a schedule you can
// count on) a small mouse pops out somewhere fitting for the place, sniffs,
// and scurries off to a hiding spot. Sometimes a tabby cat has spotted it:
// it creeps in, crouched low, wiggles its hips, pounces, gives a bounding
// chase, and is always just too late. The mouse vanishes into its hole; the
// cat sits there, puzzled, looks around, and wanders off.
//
// Gait notes (from watching cats): a walking cat moves its legs in a lateral
// sequence (left hind, left fore, right hind, right fore, a quarter cycle
// apart); stalking is the same gait, slow, with the belly low, head forward
// and ears up; before the pounce the hindquarters shift side to side to set
// the hind feet ("the wiggle"); a bound is a gallop with front and hind legs
// working in pairs while the spine flexes.
import * as THREE from 'three';
import { buildCat, buildMouse, type CatRig, type MouseRig } from './rigs';
import type { Prints } from './prints';

export interface MouseSpots {
  from: [number, number];
  to: [number, number];
  /** what it hides in: a hole, a storm drain, a gap, grass, a snowbank */
  hide: 'hole' | 'drain' | 'gap' | 'grass' | 'snowbank';
}

const yawTo = (dx: number, dz: number) => Math.atan2(-dz, dx);
const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

type MouseState = 'hidden' | 'emerge' | 'sniff' | 'scurry' | 'wait' | 'flee' | 'dive';
type CatState = 'away' | 'walkIn' | 'stalk' | 'wiggle' | 'pounce' | 'bound' | 'sit' | 'wander';

export class MouseCat {
  readonly group = new THREE.Group();
  private mouse: MouseRig;
  private cat: CatRig;
  private holes: THREE.Mesh[] = [];
  private mounds: THREE.Mesh[] = [];
  private spots: MouseSpots | null = null;
  private snowy = false;
  private next = 60 + Math.random() * 120;
  private t = 0;

  private mState: MouseState = 'hidden';
  private mTime = 0;
  private mPos = new THREE.Vector3();
  private mYaw = 0;
  private mPhase = 0;
  private waitAt = new THREE.Vector3();
  private lastPrint = new THREE.Vector3();

  private chase = false;
  private cState: CatState = 'away';
  private cTime = 0;
  private cPos = new THREE.Vector3();
  private cYaw = 0;
  private cPhase = 0;
  private leapFrom = new THREE.Vector3();
  private leapTo = new THREE.Vector3();
  private exitDir = 1;
  private lastPaw = new THREE.Vector3();
  private pawSide = 0;

  constructor(private prints: Prints) {
    this.mouse = buildMouse();
    this.cat = buildCat();
    this.mouse.root.visible = false;
    this.cat.root.visible = false;
    this.group.add(this.mouse.root, this.cat.root);
  }

  /** New place or season: where the mouse lives, and whether it is snowy. */
  configure(spots: MouseSpots | null, snowy: boolean) {
    this.spots = spots;
    this.snowy = snowy;
    for (const m of [...this.holes, ...this.mounds]) this.group.remove(m);
    this.holes = [];
    this.mounds = [];
    this.mState = 'hidden';
    this.cState = 'away';
    this.mouse.root.visible = this.cat.root.visible = false;
    if (!spots) return;
    const hide = snowy && (spots.hide === 'hole' || spots.hide === 'grass') ? 'snowbank' : spots.hide;
    for (const [x, z] of [spots.from, spots.to]) {
      if (hide === 'snowbank') {
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.75 }));
        mound.scale.set(1.3, 0.55, 1);
        mound.position.set(x, -0.01, z);
        mound.receiveShadow = mound.castShadow = true;
        this.mounds.push(mound);
        this.group.add(mound);
      } else if (hide === 'hole' || hide === 'gap') {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(hide === 'gap' ? 0.035 : 0.028, 16), new THREE.MeshBasicMaterial({ color: '#120d0a' }));
        hole.rotation.x = -Math.PI / 2;
        hole.scale.set(1.3, 0.8, 1);
        hole.position.set(x, 0.003, z);
        this.holes.push(hole);
        this.group.add(hole);
      }
    }
  }

  /** Start a visit now (for testing); chase decides whether the cat comes. */
  trigger(chase = Math.random() < 0.45) {
    if (!this.spots) return;
    const [fx, fz] = this.spots.from;
    const [tx, tz] = this.spots.to;
    this.mPos.set(fx, 0, fz);
    this.mYaw = yawTo(tx - fx, tz - fz);
    // the mouse stops to sniff ~1.3 m short of its hiding place
    const d = Math.hypot(tx - fx, tz - fz);
    const stop = Math.max(0.25, Math.min(1.3, d * 0.55));
    this.waitAt.set(tx - ((tx - fx) / d) * stop, 0, tz - ((tz - fz) / d) * stop);
    this.setMouse('emerge');
    this.mouse.root.visible = true;
    this.chase = chase;
    this.lastPrint.copy(this.mPos);
    if (chase) {
      // the cat comes in from the side the mouse is heading away from
      this.exitDir = Math.sign(fx - tx) || 1;
      this.cPos.set(fx + this.exitDir * 3.2, 0, fz - 0.4);
      this.cYaw = yawTo(-this.exitDir, 0);
      this.setCat('walkIn');
      this.cat.root.visible = true;
      this.lastPaw.copy(this.cPos);
    }
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
    if (this.mState === 'hidden' && this.cState === 'away') {
      this.next -= dt;
      if (this.next <= 0 && this.spots) {
        this.next = 150 + Math.random() * 240;
        this.trigger();
      }
      return;
    }
    this.updateMouse(dt);
    this.updateCat(dt);
  }

  // ── mouse ─────────────────────────────────────────────────────────────────
  private updateMouse(dt: number) {
    const m = this.mouse;
    this.mTime += dt;
    const target = new THREE.Vector3(this.spots!.to[0], 0, this.spots!.to[1]);
    let speed = 0;
    let sink = 0;
    switch (this.mState) {
      case 'emerge':
        // nose first out of the hole / snowbank
        sink = (1 - Math.min(this.mTime / 0.6, 1)) * 0.04;
        if (this.mTime > 0.6) this.setMouse('sniff');
        break;
      case 'sniff':
        m.head.rotation.y = Math.sin(this.t * 9) * 0.35;
        m.head.rotation.z = Math.sin(this.t * 13) * 0.15;
        if (this.mTime > 0.9 + Math.random() * 0.02) this.setMouse('scurry');
        break;
      case 'scurry': {
        // quick dashes with little stops, toward the waiting spot
        const dash = Math.sin(this.mTime * 3.1) > -0.6;
        speed = dash ? 1.1 : 0;
        const to = this.waitAt.clone().sub(this.mPos);
        if (to.length() < 0.03) this.setMouse('wait');
        else {
          this.mYaw = lerpAngle(this.mYaw, yawTo(to.x, to.z) + Math.sin(this.t * 2) * 0.25, dt * 8);
          this.mPos.addScaledVector(to.normalize(), Math.min(speed * dt, to.length()));
        }
        break;
      }
      case 'wait':
        m.head.rotation.y = Math.sin(this.t * 7) * 0.4;
        m.body.rotation.z = 0.15 + Math.sin(this.t * 11) * 0.03; // up on its haunches
        if (!this.chase && this.mTime > 1.2) this.setMouse('flee');
        break;
      case 'flee': {
        m.body.rotation.z = 0;
        speed = this.chase ? 1.8 : 0.7;
        const to = target.clone().sub(this.mPos);
        this.mYaw = lerpAngle(this.mYaw, yawTo(to.x, to.z), dt * 14);
        if (to.length() < 0.02) this.setMouse('dive');
        else this.mPos.addScaledVector(to.normalize(), Math.min(speed * dt, to.length()));
        break;
      }
      case 'dive':
        sink = Math.min(this.mTime / 0.25, 1) * 0.05;
        speed = 0.3;
        if (this.mTime > 0.3) {
          this.mState = 'hidden';
          m.root.visible = false;
        }
        break;
    }
    // scurrying legs, a bobbing body and a waving tail
    this.mPhase += dt * (6 + speed * 60);
    m.legs.forEach((l, k) => (l.rotation.z = speed > 0 ? Math.sin(this.mPhase + (k % 2 ? Math.PI : 0) + (k < 2 ? 0 : Math.PI / 2)) * 0.9 : 0));
    m.tail.forEach((s, k) => (s.rotation.y = Math.sin(this.t * 6 - k * 0.7) * (0.15 + speed * 0.2)));
    m.body.position.y = 0.022 + (speed > 0 ? Math.abs(Math.sin(this.mPhase)) * 0.004 : 0);
    m.root.position.set(this.mPos.x, -sink, this.mPos.z);
    m.root.rotation.y = this.mYaw;
    // snow: tiny paired prints and the drag line of the tail
    if (this.snowy && speed > 0 && this.mPos.distanceTo(this.lastPrint) > 0.035) {
      const side = new THREE.Vector3(Math.sin(this.mYaw), 0, Math.cos(this.mYaw)).multiplyScalar(0.012);
      this.prints.stamp(this.mPos.x + side.x, this.mPos.z + side.z, 0.012, 0.014, this.mYaw, 0.8);
      this.prints.stamp(this.mPos.x - side.x, this.mPos.z - side.z, 0.012, 0.014, this.mYaw, 0.8);
      this.prints.stamp(this.mPos.x, this.mPos.z, 0.006, 0.04, this.mYaw, 0.45);
      this.lastPrint.copy(this.mPos);
    }
  }

  // ── cat ───────────────────────────────────────────────────────────────────
  private updateCat(dt: number) {
    if (this.cState === 'away') return;
    const c = this.cat;
    this.cTime += dt;
    let speed = 0;
    let crouch = 0;
    let sit = 0;
    let wiggle = 0;
    let leap = -1;
    let gallop = false;
    const toMouse = new THREE.Vector3(this.mPos.x - this.cPos.x, 0, this.mPos.z - this.cPos.z);
    const hole = new THREE.Vector3(this.spots!.to[0], 0, this.spots!.to[1]);
    switch (this.cState) {
      case 'walkIn': {
        // strolls in; drops into a stalk once it locks on to the mouse
        speed = 0.6;
        this.cYaw = lerpAngle(this.cYaw, yawTo(toMouse.x, toMouse.z), dt * 2);
        this.cPos.addScaledVector(new THREE.Vector3(Math.cos(this.cYaw), 0, -Math.sin(this.cYaw)), speed * dt);
        if (toMouse.length() < 1.9 || this.cTime > 7) this.setCat('stalk');
        break;
      }
      case 'stalk':
        // belly low, slow deliberate steps, freezing now and then
        crouch = Math.min(1, this.cTime * 2);
        speed = Math.sin(this.cTime * 1.7) > -0.2 ? 0.22 : 0;
        this.cYaw = lerpAngle(this.cYaw, yawTo(toMouse.x, toMouse.z), dt * 3);
        if (toMouse.length() > 0.75) this.cPos.addScaledVector(toMouse.clone().normalize(), speed * dt);
        if (toMouse.length() <= 0.8 && this.mState === 'wait') this.setCat('wiggle');
        break;
      case 'wiggle':
        crouch = 1;
        wiggle = 1;
        this.cYaw = lerpAngle(this.cYaw, yawTo(toMouse.x, toMouse.z), dt * 5);
        if (this.cTime > 1.3) {
          // pounce at where the mouse is now; the mouse bolts a beat later
          this.leapFrom.copy(this.cPos);
          this.leapTo.copy(this.mPos).addScaledVector(toMouse.clone().normalize(), -0.12);
          this.setCat('pounce');
        }
        break;
      case 'pounce': {
        const T = 0.45;
        leap = Math.min(this.cTime / T, 1);
        this.cPos.lerpVectors(this.leapFrom, this.leapTo, leap);
        if (this.cTime > 0.08 && this.mState === 'wait') this.setMouse('flee');
        if (leap >= 1) this.setCat('bound');
        break;
      }
      case 'bound': {
        // a couple of bounds after the fleeing mouse
        gallop = true;
        speed = 1.4;
        const to = hole.clone().sub(this.cPos);
        this.cYaw = lerpAngle(this.cYaw, yawTo(to.x, to.z), dt * 8);
        if (to.length() < 0.16 || this.cTime > 1.4) this.setCat('sit');
        else this.cPos.addScaledVector(to.normalize(), speed * dt);
        break;
      }
      case 'sit':
        // nose at the hole, puzzled: head tilts, looks about, tail flicks
        sit = Math.min(1, this.cTime * 3);
        c.head.rotation.x = Math.sin(this.cTime * 2.2) > 0 ? 0.35 : -0.25;
        c.head.rotation.y = this.cTime > 2.2 ? Math.sin(this.cTime * 1.3) * 0.7 : 0;
        if (this.cTime > 4.5) {
          this.setCat('wander');
          this.cYaw = yawTo(this.exitDir * -1 || 1, 0.3);
          c.head.rotation.set(0, 0, 0);
        }
        break;
      case 'wander':
        speed = 0.4;
        this.cYaw = lerpAngle(this.cYaw, yawTo(-this.exitDir, 0.25), dt * 1.5);
        this.cPos.addScaledVector(new THREE.Vector3(Math.cos(this.cYaw), 0, -Math.sin(this.cYaw)), speed * dt);
        if (this.cTime > 9) {
          this.cState = 'away';
          c.root.visible = false;
        }
        break;
    }
    this.poseCat(dt, speed, crouch, sit, wiggle, leap, gallop);
    // bigger prints beside the mouse's trail
    if (this.snowy && (speed > 0 || leap >= 1) && this.cPos.distanceTo(this.lastPaw) > (gallop ? 0.3 : 0.14)) {
      const side = new THREE.Vector3(Math.sin(this.cYaw), 0, Math.cos(this.cYaw)).multiplyScalar(this.pawSide ? 0.045 : -0.045);
      this.prints.stamp(this.cPos.x + side.x, this.cPos.z + side.z, 0.04, 0.048, this.cYaw, 0.95);
      this.pawSide ^= 1;
      this.lastPaw.copy(this.cPos);
    }
  }

  private poseCat(dt: number, speed: number, crouch: number, sit: number, wiggle: number, leap: number, gallop: boolean) {
    const c = this.cat;
    const stride = gallop ? 0.55 : 0.32;
    this.cPhase += (speed / stride) * Math.PI * 2 * dt;
    const ph = this.cPhase;
    // body height: standing 0.23 m, crouched 0.13, sitting with hips down
    const leapY = leap >= 0 ? Math.sin(Math.PI * leap) * 0.22 : 0;
    c.torso.position.y = 0.23 - crouch * 0.1 - sit * 0.06 + leapY;
    c.torso.rotation.z = sit * 0.55 + (leap >= 0 ? (0.5 - leap) * 0.5 : 0) + (gallop ? Math.sin(ph) * 0.12 : 0);
    // legs: lateral-sequence walk, paired gallop, extended in the air
    const swing = (off: number) => Math.sin(ph + off) * (speed > 0 ? (gallop ? 0.9 : 0.5) : 0);
    const offs = gallop ? [0, 0.3, Math.PI, Math.PI + 0.3] : [0, Math.PI, Math.PI / 2, (3 * Math.PI) / 2];
    c.frontLegs.forEach((l, k) => {
      let a = swing(offs[k]) - crouch * 0.35;
      let knee = -crouch * 0.5;
      if (leap >= 0) a = -1.1 + leap * 0.6;
      if (sit) {
        a = -sit * 0.55;
        knee = 0;
      }
      l.hip.rotation.z = a;
      l.knee.rotation.z = knee + Math.max(0, Math.sin(ph + offs[k] + 1.5)) * (speed > 0 ? 0.5 : 0);
    });
    c.backLegs.forEach((l, k) => {
      let a = swing(offs[k + 2]) + crouch * 0.55;
      let knee = -crouch * 1.1;
      if (leap >= 0) a = 1.0 - leap * 0.5;
      if (sit) {
        a = sit * 1.5;
        knee = -sit * 2.3;
      }
      l.hip.rotation.z = a;
      l.knee.rotation.z = knee - Math.max(0, Math.sin(ph + offs[k + 2] - 1.5)) * (speed > 0 ? 0.4 : 0);
    });
    // the wiggle: hindquarters shifting side to side, hind feet treading
    c.hips.rotation.y = wiggle * Math.sin(this.t * 15) * 0.22;
    c.hips.position.y = wiggle * 0.015;
    // head low and forward when stalking
    if (!sit) {
      c.head.rotation.z = -crouch * 0.25;
      c.head.position.set(0.24 + crouch * 0.03, 0.08 - crouch * 0.04, 0);
    }
    // tail: low and still when stalking (tip twitching), up when walking,
    // curled around when sitting
    c.tail.forEach((s, k) => {
      const tip = k / (c.tail.length - 1);
      const base = sit ? -0.35 : crouch > 0.5 ? -0.1 : 0.35;
      s.rotation.z = (k === 0 ? base : sit ? -0.05 : 0.08) + (crouch > 0.5 ? Math.sin(this.t * 9) * 0.25 * tip * tip : Math.sin(this.t * 2 - k) * 0.06);
      s.rotation.y = sit ? 0.45 : Math.sin(this.t * 1.5 - k * 0.5) * 0.08;
    });
    c.ears.forEach((e) => (e.rotation.z = crouch > 0.5 ? -0.3 : 0));
    c.root.position.set(this.cPos.x, 0, this.cPos.z);
    c.root.rotation.y = this.cYaw;
    c.root.updateMatrixWorld();
    c.uRootInv.value.copy(c.root.matrixWorld).invert();
  }

  get state() {
    return `${this.mState}/${this.cState}`;
  }

  get busy() {
    return this.mState !== 'hidden' || this.cState !== 'away';
  }
}
