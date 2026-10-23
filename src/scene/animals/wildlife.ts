// Background wildlife, chosen to fit the place, season and time of day:
// birds overhead (songbirds flitting, gulls gliding, Canada geese in a V
// in spring and autumn, ducks dropping onto the water), squirrels darting
// between trees, rabbits hopping, the odd deer or fox at the forest edge,
// fish leaping and frogs plopping into the background water, a loon on the
// Algonquin lake. Everything is small and unhurried.
import * as THREE from 'three';
import { buildBird, buildQuadruped, buildFish } from './rigs';
import type { Season, TimeOfDay } from '../world/palettes';

export interface Habitat {
  birds: ('songbirds' | 'gulls' | 'geese' | 'ducks' | 'crows')[];
  /** squirrel trees [x, z] */
  trees?: [number, number][];
  rabbits?: [number, number, number, number]; // lawn rectangle x0, z0, x1, z1
  deer?: boolean;
  fox?: boolean;
  /** background open water: x0, z0, x1, z1 */
  water?: [number, number, number, number];
  frogs?: boolean;
  loons?: boolean;
}

interface Actor {
  obj: THREE.Object3D;
  update(dt: number, t: number): boolean; // false = finished
}

/** expanding rings on open water (fish, frogs, ducks landing) */
class Rings {
  readonly group = new THREE.Group();
  private list: { m: THREE.Mesh; age: number; max: number }[] = [];
  add(x: number, z: number, size: number) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    this.group.add(m);
    this.list.push({ m, age: 0, max: size });
  }
  update(dt: number) {
    for (const r of this.list) {
      r.age += dt;
      const k = r.age / 2.5;
      r.m.scale.setScalar(0.05 + k * r.max);
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
    }
    this.list = this.list.filter((r) => {
      if (r.age < 2.5) return true;
      this.group.remove(r.m);
      r.m.geometry.dispose();
      (r.m.material as THREE.Material).dispose();
      return false;
    });
  }
}

export class Wildlife {
  readonly group = new THREE.Group();
  private actors: Actor[] = [];
  private rings = new Rings();
  private hab: Habitat | null = null;
  private season: Season = 'summer';
  private time: TimeOfDay = 'day';
  private timers: Record<string, number> = {};

  constructor() {
    this.group.add(this.rings.group);
  }

  configure(h: Habitat | null, season: Season, time: TimeOfDay) {
    this.hab = h;
    this.season = season;
    this.time = time;
    for (const a of this.actors) this.group.remove(a.obj);
    this.actors = [];
    this.timers = {};
  }

  private due(key: string, dt: number, mean: number) {
    if (this.timers[key] === undefined) this.timers[key] = mean * (0.2 + Math.random() * 0.6);
    this.timers[key] -= dt;
    if (this.timers[key] > 0) return false;
    this.timers[key] = mean * (0.5 + Math.random());
    return true;
  }

  private add(a: Actor) {
    this.actors.push(a);
    this.group.add(a.obj);
  }

  update(dt: number, t: number) {
    this.rings.update(dt);
    this.actors = this.actors.filter((a) => {
      const keep = a.update(dt, t);
      if (!keep) this.group.remove(a.obj);
      return keep;
    });
    const h = this.hab;
    if (!h) return;
    const night = this.time === 'night';
    const winter = this.season === 'winter';
    const dusk = this.time === 'sunrise' || this.time === 'sunset';

    // birds
    if (!night && this.due('birds', dt, winter ? 40 : 18)) {
      const kinds = h.birds.filter((b) => !(b === 'geese' && (this.season === 'summer' || winter)));
      if (kinds.length) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (kind === 'geese') this.add(this.flock('#3a3633', 1.6, 7, true, 90, 38, 6.5));
        else if (kind === 'gulls') this.add(this.flock('#eef0f2', 1.2, 1 + Math.floor(Math.random() * 3), false, 45, 20, 5, true));
        else if (kind === 'crows') this.add(this.flock('#1c1c22', 0.9, 1 + Math.floor(Math.random() * 2), false, 35, 18, 7));
        else if (kind === 'ducks' && h.water) this.add(this.duckLanding(h.water));
        else this.add(this.flock('#5a4a3c', 0.25, 2 + Math.floor(Math.random() * 3), false, 14, 6, 6, false, true));
      }
    }
    // squirrels: frequent, daytime
    if (h.trees && h.trees.length > 1 && !night && !winter && this.due('squirrel', dt, 22)) this.add(this.squirrel(h.trees));
    // rabbits: dawn, dusk and night are rabbit hours
    if (h.rabbits && this.due('rabbit', dt, dusk || night ? 25 : 45)) this.add(this.rabbit(h.rabbits));
    // deer and foxes: rare
    if (h.deer && !winter && this.due('deer', dt, dusk ? 120 : 260)) this.add(this.walker('deer'));
    if (h.fox && this.due('fox', dt, dusk || night ? 140 : 320)) this.add(this.walker('fox'));
    // fish, frogs and loons in the background water
    if (h.water && !winter) {
      if (this.due('fish', dt, 16)) this.add(this.fishJump(h.water));
      if (h.frogs && (this.season === 'spring' || this.season === 'summer') && this.due('frog', dt, 14)) {
        const [x0, z0, x1] = h.water;
        const x = x0 + Math.random() * (x1 - x0);
        this.rings.add(x, z0 - 0.5 - Math.random() * 2, 0.6);
      }
    }
    if (h.loons && h.water && !winter && !this.actors.some((a) => a.obj.name === 'loon')) this.add(this.loon(h.water));
  }

  // ── birds ────────────────────────────────────────────────────────────────
  private flock(color: string, span: number, n: number, vee: boolean, dist: number, alt: number, speed: number, glide = false, flutter = false): Actor {
    const obj = new THREE.Group();
    const birds = Array.from({ length: n }, (_, k) => {
      const b = buildBird(color, span);
      // a V: each bird trails behind and to the side of the one ahead
      const row = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      b.root.position.set(vee ? -row * span * 1.4 : -k * span * 3 * Math.random(), (Math.random() - 0.5) * span, vee ? side * row * span * 1.1 : (Math.random() - 0.5) * span * 4);
      obj.add(b.root);
      return { ...b, phase: Math.random() * 6 };
    });
    const dir = Math.random() < 0.5 ? 1 : -1;
    const z = -dist * (0.6 + Math.random() * 0.8);
    obj.position.set(-dir * (dist * 1.2 + 20), alt * (0.7 + Math.random() * 0.6), z);
    obj.rotation.y = dir > 0 ? 0 : Math.PI;
    obj.rotation.y += (Math.random() - 0.5) * 0.4;
    let age = 0;
    return {
      obj,
      update: (dt, t) => {
        age += dt;
        obj.translateX(speed * dt);
        if (flutter) obj.position.y += Math.sin(t * 4) * dt * 0.8; // songbirds undulate
        for (const b of birds) {
          const flap = glide && Math.sin(t * 0.7 + b.phase) > 0.3 ? 0.15 : Math.sin(t * (flutter ? 22 : 6) + b.phase) * 0.7;
          b.wings[0].rotation.x = flap;
          b.wings[1].rotation.x = -flap;
        }
        return age < (dist * 2.4 + 40) / speed;
      },
    };
  }

  private duckLanding(w: [number, number, number, number]): Actor {
    const b = buildBird('#4a3f35', 0.7);
    const obj = b.root;
    const [x0, z0, x1, z1] = w;
    const land = new THREE.Vector3(x0 + Math.random() * (x1 - x0), 0.03, z0 + (z1 - z0) * (0.2 + Math.random() * 0.3));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const start = land.clone().add(new THREE.Vector3(-dir * 40, 14, 0));
    obj.position.copy(start);
    obj.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0, landed = false;
    return {
      obj,
      update: (dt, t) => {
        age += dt;
        if (!landed) {
          const k = Math.min(age / 5, 1);
          obj.position.lerpVectors(start, land, 1 - (1 - k) * (1 - k));
          const flap = k > 0.8 ? 0.9 : Math.sin(t * 9) * 0.8;
          b.wings[0].rotation.x = flap;
          b.wings[1].rotation.x = -flap;
          if (k >= 1) {
            landed = true;
            this.rings.add(land.x, land.z, 2.5);
          }
        } else {
          b.wings[0].rotation.x = 1.4;
          b.wings[1].rotation.x = -1.4;
          obj.translateX(0.25 * dt);
        }
        return age < 40;
      },
    };
  }

  // ── small mammals ─────────────────────────────────────────────────────────
  private squirrel(trees: [number, number][]): Actor {
    const r = buildQuadruped({ len: 0.22, height: 0.05, color: '#8a5a3a', belly: '#c9b39a', legR: 0.008, tail: 'bushy', ears: 0.02, neck: 0.03 });
    const a = trees[Math.floor(Math.random() * trees.length)];
    let b = trees[Math.floor(Math.random() * trees.length)];
    if (b === a) b = trees[(trees.indexOf(a) + 1) % trees.length];
    const p = new THREE.Vector3(a[0], 0, a[1]);
    const goal = new THREE.Vector3(b[0], 0, b[1]);
    r.root.position.copy(p);
    let age = 0, pause = 0, hop = 0;
    return {
      obj: r.root,
      update: (dt, t) => {
        age += dt;
        const to = goal.clone().sub(r.root.position);
        if (to.length() < 0.2) {
          // up the trunk and gone
          r.root.position.y += dt * 1.5;
          r.root.rotation.z = Math.PI / 2;
          return r.root.position.y < 3;
        }
        if (pause > 0) {
          pause -= dt;
          r.torso.rotation.z = 0.8; // sits up to look around
          r.tail.rotation.z = 1.2 + Math.sin(t * 12) * 0.2;
        } else {
          hop += dt * 9;
          r.torso.rotation.z = 0;
          r.torso.position.y = 0.05 + Math.abs(Math.sin(hop)) * 0.05;
          r.tail.rotation.z = 0.6;
          r.root.rotation.y = Math.atan2(-to.z, to.x);
          r.root.position.addScaledVector(to.normalize(), 1.6 * dt);
          if (Math.random() < dt * 0.6) pause = 0.6 + Math.random();
        }
        return age < 30;
      },
    };
  }

  private rabbit(area: [number, number, number, number]): Actor {
    const r = buildQuadruped({ len: 0.3, height: 0.08, color: '#8b7b68', belly: '#d8cfc2', legR: 0.012, tail: 'puff', ears: 0.09, neck: 0.04 });
    const [x0, z0, x1, z1] = area;
    const p = new THREE.Vector3(Math.random() < 0.5 ? x0 : x1, 0, z0 + Math.random() * (z1 - z0));
    const dir = p.x === x0 ? 1 : -1;
    r.root.position.copy(p);
    r.root.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0, sit = 0, hop = 0;
    return {
      obj: r.root,
      update: (dt) => {
        age += dt;
        if (sit > 0) {
          sit -= dt;
          r.neck.rotation.z = Math.sin(age * 3) * 0.2 - 0.4; // nibbling
        } else {
          hop += dt * 6;
          r.torso.position.y = 0.08 + Math.max(0, Math.sin(hop)) * 0.09;
          r.root.position.x += dir * 0.9 * dt;
          r.neck.rotation.z = 0;
          if (Math.sin(hop) < -0.95 && Math.random() < 0.25) sit = 1 + Math.random() * 3;
        }
        return age < 40 && r.root.position.x > x0 - 1 && r.root.position.x < x1 + 1;
      },
    };
  }

  private walker(kind: 'deer' | 'fox'): Actor {
    const deer = kind === 'deer';
    const r = deer
      ? buildQuadruped({ len: 1.5, height: 0.85, color: '#8a6a4a', belly: '#d6c4a8', legR: 0.035, tail: 'puff', ears: 0.14, neck: 0.55 })
      : buildQuadruped({ len: 0.7, height: 0.32, color: '#c4642c', belly: '#efe2d0', legR: 0.02, tail: 'long', ears: 0.08, neck: 0.12 });
    const dir = Math.random() < 0.5 ? 1 : -1;
    const z = -(deer ? 16 : 10) - Math.random() * 10;
    r.root.position.set(-dir * 22, 0, z);
    r.root.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0, stop = 0, phase = 0;
    const speed = deer ? 0.9 : 1.6;
    return {
      obj: r.root,
      update: (dt) => {
        age += dt;
        if (stop > 0) {
          stop -= dt;
          r.neck.rotation.z = deer ? 0.25 : 0; // head up, listening
          r.neck.rotation.y = Math.sin(age) * 0.5;
        } else {
          phase += dt * speed * 6;
          r.legs.forEach((l, k) => (l.rotation.z = Math.sin(phase + (k % 2 ? Math.PI : 0) + (k < 2 ? 0 : Math.PI / 2)) * 0.4));
          r.root.position.x += dir * speed * dt;
          r.neck.rotation.z = deer ? -0.15 : 0;
          if (deer && Math.random() < dt * 0.08) stop = 2 + Math.random() * 3;
        }
        return Math.abs(r.root.position.x) < 24;
      },
    };
  }

  // ── water ─────────────────────────────────────────────────────────────────
  private fishJump(w: [number, number, number, number]): Actor {
    const f = buildFish();
    const [x0, z0, x1, z1] = w;
    const x = x0 + Math.random() * (x1 - x0);
    const z = z0 + (z1 - z0) * Math.random() * 0.4;
    const dir = Math.random() < 0.5 ? 1 : -1;
    f.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0;
    const T = 0.55;
    this.rings.add(x, z, 1.2);
    return {
      obj: f,
      update: (dt) => {
        age += dt;
        const k = age / T;
        f.position.set(x + dir * k * 0.6, Math.sin(Math.PI * Math.min(k, 1)) * 0.45, z);
        f.rotation.z = (0.5 - k) * 1.6 * dir;
        if (k >= 1 && k - dt / T < 1) this.rings.add(f.position.x, z, 1.4);
        return k < 1.05;
      },
    };
  }

  private loon(w: [number, number, number, number]): Actor {
    const mat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.6 });
    const obj = new THREE.Group();
    obj.name = 'loon';
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8).scale(1.8, 0.6, 0.8), mat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.35, 8), mat);
    neck.position.set(0.42, 0.18, 0);
    neck.rotation.z = -0.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8).scale(1.4, 1, 1), mat);
    head.position.set(0.5, 0.36, 0);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), white);
    collar.position.set(0.46, 0.25, 0);
    collar.rotation.y = Math.PI / 2;
    obj.add(body, neck, head, collar);
    const [x0, z0, x1, z1] = w;
    obj.position.set(x0 + (x1 - x0) * 0.3, 0.02, z0 + (z1 - z0) * 0.15);
    let age = 0, under = 0, dir = 1;
    return {
      obj,
      update: (dt) => {
        age += dt;
        if (under > 0) {
          // dived: surfaces somewhere else after ~20 s
          under -= dt;
          obj.visible = false;
          if (under <= 0) {
            obj.visible = true;
            obj.position.x += (Math.random() - 0.5) * 30;
            this.rings.add(obj.position.x, obj.position.z, 2);
          }
          return true;
        }
        obj.position.x += dir * 0.3 * dt;
        if ((dir > 0 && obj.position.x > x1 - 5) || (dir < 0 && obj.position.x < x0 + 5)) {
          dir = -dir;
          obj.rotation.y = dir > 0 ? 0 : Math.PI;
        }
        if (Math.random() < dt / 40) {
          under = 12 + Math.random() * 15;
          this.rings.add(obj.position.x, obj.position.z, 2.5);
        }
        return age < 600;
      },
    };
  }
}
