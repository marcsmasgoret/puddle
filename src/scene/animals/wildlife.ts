// Background wildlife, chosen to fit the place, season and time of day:
// birds overhead (robins flitting, crows and gulls flapping and gliding,
// Canada geese in a V in spring and autumn, mallards dropping onto the
// water), grey squirrels bounding between trees, cottontails hopping and
// nibbling, a white-tailed doe or a red fox at the forest edge, bass
// leaping and frogs plopping into the background water, a loon on the lake.
// All are sculpted, skinned animals (species.ts), meshed in the background
// before they first appear, and every walking animal keeps to land.
import * as THREE from 'three';
import { sculpt, prepare, type AnimalSpec } from './sculpt';
import { squirrelSpec, rabbitSpec, deerSpec, foxSpec, birdSpec, BIRDS, fishSpec } from './species';
import { Quadruped } from './gait';
import type { Season, TimeOfDay } from '../world/palettes';

export interface Habitat {
  birds: ('songbirds' | 'gulls' | 'geese' | 'ducks' | 'crows')[];
  /**
   * squirrel trees [x, z]; the world swaps these for the real trunks it
   * built ([x, z, radius, height]) so a squirrel climbs an actual tree
   */
  trees?: ([number, number] | [number, number, number, number])[];
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
  private geo = new THREE.RingGeometry(0.9, 1, 48);
  add(x: number, z: number, size: number) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    this.group.add(m);
    this.list.push({ m, age: 0, max: size });
  }
  update(dt: number) {
    for (const r of this.list) {
      r.age += dt;
      const k = r.age / 2.5;
      r.m.scale.setScalar(0.05 + Math.sqrt(k) * r.max);
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - k) * (1 - k);
    }
    this.list = this.list.filter((r) => {
      if (r.age < 2.5) return true;
      this.group.remove(r.m);
      (r.m.material as THREE.Material).dispose();
      return false;
    });
  }
}

/** A sculpted bird with flapping, gliding and folded-wing poses. */
class Bird {
  readonly root: THREE.Group;
  private b: Record<string, THREE.Bone>;
  private t = Math.random() * 10;
  constructor(spec: AnimalSpec, private flapHz: number, private style: 'flap' | 'burst' | 'glide') {
    const a = sculpt(spec, 'low');
    this.root = a.root;
    this.b = a.bones;
  }
  /** wings beating, held out in a glide, or folded on the water */
  pose(dt: number, mode: 'fly' | 'land' | 'swim') {
    this.t += dt;
    const { wl0, wr0, wl1, wr1, neck, tail } = this.b;
    if (mode === 'swim') {
      wl0.rotation.set(0.15, -1.45, 0);
      wr0.rotation.set(-0.15, 1.45, 0);
      wl1.rotation.set(0, -0.2, 0);
      wr1.rotation.set(0, 0.2, 0);
      neck.rotation.z = 0.15 + 0.05 * Math.sin(this.t * 0.8);
      return;
    }
    let beat = Math.sin(this.t * this.flapHz * Math.PI * 2);
    let amp = 0.75;
    if (this.style === 'burst') {
      // songbirds: a burst of wingbeats, then wings tucked (undulating flight)
      const cyc = (this.t * 1.4) % 1;
      if (cyc > 0.55) {
        beat = 0;
        amp = 0;
      }
    } else if (this.style === 'glide' && Math.sin(this.t * 0.5) > 0.2) {
      beat = 0.15;
      amp = 1;
    }
    if (mode === 'land') {
      // flaring: wings up and forward, beating hard
      beat = Math.sin(this.t * this.flapHz * 1.5 * Math.PI * 2);
      amp = 1;
    }
    const up = amp * beat;
    wl0.rotation.set(-up, 0, 0);
    wr0.rotation.set(up, 0, 0);
    // the hand lags the arm: folds a little on the upstroke
    const fold = Math.max(0, Math.cos(this.t * this.flapHz * Math.PI * 2)) * 0.5 * amp;
    wl1.rotation.set(-up * 0.4, -fold * 0.4, 0);
    wr1.rotation.set(up * 0.4, fold * 0.4, 0);
    tail.rotation.z = mode === 'land' ? 0.5 : 0.05 * beat;
    neck.rotation.z = 0;
  }
}

const SPECIES = {
  robin: () => birdSpec(BIRDS.robin),
  crow: () => birdSpec(BIRDS.crow),
  gull: () => birdSpec(BIRDS.gull),
  goose: () => birdSpec(BIRDS.goose),
  mallard: () => birdSpec(BIRDS.mallard),
  loon: () => birdSpec(BIRDS.loon),
  squirrel: squirrelSpec,
  rabbit: rabbitSpec,
  deer: () => deerSpec(false),
  deerW: () => deerSpec(true),
  fox: foxSpec,
  fish: fishSpec,
};
type Kind = keyof typeof SPECIES;

export class Wildlife {
  readonly group = new THREE.Group();
  private actors: Actor[] = [];
  private rings = new Rings();
  private hab: Habitat | null = null;
  private season: Season = 'summer';
  private time: TimeOfDay = 'day';
  private timers: Record<string, number> = {};
  private ready = new Set<Kind>();
  private specs = new Map<Kind, AnimalSpec>();
  private walkable: (x: number, z: number) => boolean = () => true;
  private now = 0;

  constructor() {
    this.group.add(this.rings.group);
  }

  configure(h: Habitat | null, season: Season, time: TimeOfDay, walkable: (x: number, z: number) => boolean = () => true) {
    this.hab = h;
    this.season = season;
    this.time = time;
    this.walkable = walkable;
    for (const a of this.actors) this.group.remove(a.obj);
    this.actors = [];
    this.timers = {};
    if (!h) return;
    // mesh what this place needs, in the background
    const need: Kind[] = [];
    if (h.birds.includes('songbirds')) need.push('robin');
    if (h.birds.includes('crows')) need.push('crow');
    if (h.birds.includes('gulls')) need.push('gull');
    if (h.birds.includes('geese')) need.push('goose');
    if (h.birds.includes('ducks')) need.push('mallard');
    if (h.loons) need.push('loon');
    if (h.trees) need.push('squirrel');
    if (h.rabbits) need.push('rabbit');
    if (h.deer) need.push(season === 'winter' ? 'deerW' : 'deer');
    if (h.fox) need.push('fox');
    if (h.water) need.push('fish');
    for (const k of need) {
      const spec = this.specs.get(k) ?? SPECIES[k]();
      this.specs.set(k, spec);
      prepare(spec).then(() => this.ready.add(k));
    }
  }

  private spec(k: Kind) {
    return this.specs.get(k)!;
  }

  private due(key: string, dt: number, mean: number) {
    if (this.timers[key] === undefined) this.timers[key] = mean * (0.2 + Math.random() * 0.6);
    this.timers[key] -= dt;
    if (this.timers[key] > 0) return false;
    this.timers[key] = mean * (0.5 + Math.random());
    return true;
  }

  private add(a: Actor | null) {
    if (!a) return;
    // place and pose it before it is first drawn: an animal's root starts at
    // the origin, right in front of the camera, and would flash up there
    a.update(1 / 60, this.now);
    this.actors.push(a);
    this.group.add(a.obj);
  }

  update(dt: number, t: number) {
    this.now = t;
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
    const r = this.ready;

    // birds
    if (!night && this.due('birds', dt, winter ? 40 : 18)) {
      const kinds = h.birds.filter((b) => !(b === 'geese' && (this.season === 'summer' || winter)));
      if (kinds.length) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (kind === 'geese' && r.has('goose')) this.add(this.flock('goose', 7, true, 90, 38, 7, 3.2, 'flap'));
        else if (kind === 'gulls' && r.has('gull')) this.add(this.flock('gull', 1 + Math.floor(Math.random() * 3), false, 45, 18, 6, 2.6, 'glide'));
        else if (kind === 'crows' && r.has('crow')) this.add(this.flock('crow', 1 + Math.floor(Math.random() * 2), false, 35, 16, 8, 4, 'flap'));
        else if (kind === 'ducks' && h.water && r.has('mallard')) this.add(this.duckLanding(h.water));
        else if (kind === 'songbirds' && r.has('robin')) this.add(this.flock('robin', 1 + Math.floor(Math.random() * 3), false, 14, 5, 7, 14, 'burst'));
      }
    }
    // squirrels: frequent, daytime
    if (h.trees && h.trees.length > 1 && !night && !winter && r.has('squirrel') && this.due('squirrel', dt, 22)) this.add(this.squirrel(h.trees));
    // rabbits: dawn, dusk and night are rabbit hours
    if (h.rabbits && r.has('rabbit') && this.due('rabbit', dt, dusk || night ? 25 : 45)) this.add(this.rabbit(h.rabbits));
    // deer and foxes: rare
    const deerKind: Kind = winter ? 'deerW' : 'deer';
    if (h.deer && r.has(deerKind) && this.due('deer', dt, dusk ? 110 : 240)) this.add(this.walker(deerKind));
    if (h.fox && r.has('fox') && this.due('fox', dt, dusk || night ? 140 : 320)) this.add(this.walker('fox'));
    // fish, frogs and loons in the background water
    if (h.water && !winter) {
      if (r.has('fish') && this.due('fish', dt, 16)) this.add(this.fishJump(h.water));
      if (h.frogs && (this.season === 'spring' || this.season === 'summer') && this.due('frog', dt, 14)) {
        const [x0, z0, x1] = h.water;
        this.rings.add(x0 + Math.random() * (x1 - x0), z0 - 0.5 - Math.random() * 2, 0.6);
      }
    }
    if (h.loons && h.water && !winter && r.has('loon') && !this.actors.some((a) => a.obj.name === 'loon')) this.add(this.loon(h.water));
  }

  // ── birds ────────────────────────────────────────────────────────────────
  private flock(kind: Kind, n: number, vee: boolean, dist: number, alt: number, speed: number, hz: number, style: 'flap' | 'burst' | 'glide'): Actor {
    const obj = new THREE.Group();
    const span = BIRDS[kind as keyof typeof BIRDS]?.span ?? 1;
    const birds = Array.from({ length: n }, (_, k) => {
      const b = new Bird(this.spec(kind), hz * (0.92 + Math.random() * 0.16), style);
      // a V: each bird trails behind and to the side of the one ahead
      const row = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      b.root.position.set(vee ? -row * span * 1.3 : -k * span * 3 * Math.random(), (Math.random() - 0.5) * span, vee ? side * row * span * 1.0 : (Math.random() - 0.5) * span * 4);
      obj.add(b.root);
      return b;
    });
    const dir = Math.random() < 0.5 ? 1 : -1;
    const z = -dist * (0.6 + Math.random() * 0.8);
    obj.position.set(-dir * (dist * 1.2 + 20), alt * (0.7 + Math.random() * 0.6), z);
    obj.rotation.y = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.4;
    let age = 0;
    return {
      obj,
      update: (dt, t) => {
        age += dt;
        obj.translateX(speed * dt);
        if (style === 'burst') obj.position.y += Math.sin(t * 5) * dt * 0.6; // undulating
        for (const b of birds) b.pose(dt, 'fly');
        return age < (dist * 2.4 + 40) / speed;
      },
    };
  }

  private duckLanding(w: [number, number, number, number]): Actor {
    const b = new Bird(this.spec('mallard'), 5, 'flap');
    const obj = new THREE.Group();
    obj.add(b.root);
    const [x0, z0, x1, z1] = w;
    const land = new THREE.Vector3(x0 + Math.random() * (x1 - x0), 0.04, z0 + (z1 - z0) * (0.2 + Math.random() * 0.3));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const start = land.clone().add(new THREE.Vector3(-dir * 40, 14, 0));
    obj.position.copy(start);
    obj.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0, landed = false;
    return {
      obj,
      update: (dt) => {
        age += dt;
        if (!landed) {
          const k = Math.min(age / 5, 1);
          obj.position.lerpVectors(start, land, 1 - (1 - k) * (1 - k));
          b.root.rotation.z = k > 0.8 ? 0.5 : 0; // flare: body up, feet down
          b.pose(dt, k > 0.8 ? 'land' : 'fly');
          if (k >= 1) {
            landed = true;
            b.root.rotation.z = 0;
            this.rings.add(land.x, land.z, 2.5);
          }
        } else {
          b.pose(dt, 'swim');
          obj.translateX(0.25 * dt);
          obj.position.y = 0.04 + Math.sin(age * 1.3) * 0.01;
        }
        return age < 40;
      },
    };
  }

  // ── small mammals ─────────────────────────────────────────────────────────
  private squirrel(all: NonNullable<Habitat['trees']>): Actor | null {
    // only trees on land, and a run between them that stays on land
    const trees = all.filter(([x, z]) => this.walkable(x, z));
    if (trees.length < 2) return null;
    const a = trees[Math.floor(Math.random() * trees.length)];
    let b = trees[Math.floor(Math.random() * trees.length)];
    if (b === a) b = trees[(trees.indexOf(a) + 1) % trees.length];
    for (let k = 1; k < 20; k++) {
      const t = k / 20;
      if (!this.walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return null;
    }
    // it climbs the side of the trunk facing the puddle and the viewer, so
    // the crown's leaves and branches hide it as it goes up into them
    const trunkR = b[2] ?? 0.12, treeH = b[3] ?? 6;
    const out = new THREE.Vector3(-b[0], 0, 3 - b[1]).normalize();
    const at = (y: number) => {
      const r = trunkR * (1 - 0.3 * Math.min(1, y / (0.4 * treeH))) + 0.03;
      return new THREE.Vector3(b[0] + out.x * r, y, b[1] + out.z * r);
    };
    const p = new THREE.Vector3(a[0], 0, a[1]).addScaledVector(out, (a[2] ?? 0.12) + 0.1);
    const goal = at(0);
    // belly to the bark, head up: local +x up, local +y (its back) outward
    const climbPose = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), out, new THREE.Vector3(0, 1, 0).cross(out)),
    );
    const s = this.spec('squirrel');
    const q = new Quadruped(sculpt(s), s, { cadence: 3.2, cadenceGain: 1.5, height: 0.07, tailCurve: 0.45 });
    q.pos.copy(p);
    q.gait = 'bound';
    q.tailUp = 1;
    const obj = new THREE.Group();
    obj.add(q.root);
    let age = 0, pause = 0, climb = -1;
    return {
      obj,
      update: (dt) => {
        age += dt;
        const to = goal.clone().sub(q.pos);
        to.y = 0;
        if (climb >= 0 || to.length() < 0.12) {
          // up the trunk in scurries, and gone into the crown
          climb = Math.max(climb, 0) + dt;
          q.targetSpeed = 0;
          const y = 0.08 + climb * 1.1 - 0.12 * Math.max(0, Math.sin(climb * 9));
          q.root.position.copy(at(y));
          q.root.quaternion.copy(climbPose);
          return y < 0.5 * treeH;
        }
        if (pause > 0) {
          pause -= dt;
          q.targetSpeed = 0;
          q.sit = Math.min(1, q.sit + dt * 4);
          q.lookAt = q.pos.clone().add(new THREE.Vector3(Math.sin(age * 2) * 2, 0.6, 2));
        } else {
          q.sit = Math.max(0, q.sit - dt * 4);
          q.lookAt = null;
          q.targetSpeed = 1.5;
          q.turnToward(Math.atan2(-to.z, to.x), 6, dt);
          if (Math.random() < dt * 0.5) pause = 0.8 + Math.random() * 1.5;
        }
        q.update(dt);
        return age < 40;
      },
    };
  }

  private rabbit(area: [number, number, number, number]): Actor | null {
    const [x0, z0, x1, z1] = area;
    const p = new THREE.Vector3(Math.random() < 0.5 ? x0 : x1, 0, z0 + Math.random() * (z1 - z0));
    if (!this.walkable(p.x, p.z)) return null;
    const dir = p.x === x0 ? 1 : -1;
    const s = this.spec('rabbit');
    const q = new Quadruped(sculpt(s), s, { cadence: 2.6, cadenceGain: 1, height: 0.1, tailCurve: 0 });
    q.pos.copy(p);
    q.yaw = dir > 0 ? 0 : Math.PI;
    q.gait = 'bound';
    const obj = new THREE.Group();
    obj.add(q.root);
    let age = 0, sit = 0;
    return {
      obj,
      update: (dt) => {
        age += dt;
        if (sit > 0) {
          sit -= dt;
          q.targetSpeed = 0;
          q.headDown = 0.6 + 0.15 * Math.sin(age * 9); // nibbling clover
        } else {
          q.headDown = 0;
          q.targetSpeed = 0.9;
          if (Math.random() < dt * 0.35) sit = 1.5 + Math.random() * 4;
        }
        q.update(dt);
        const ahead = q.pos.clone().addScaledVector(q.forward, 0.4);
        if (!this.walkable(ahead.x, ahead.z)) q.turnToward(q.yaw + Math.PI, 3, dt);
        return age < 50 && q.pos.x > x0 - 1.5 && q.pos.x < x1 + 1.5;
      },
    };
  }

  private walker(kind: Kind): Actor | null {
    const deer = kind !== 'fox';
    const s = this.spec(kind);
    const q = deer
      ? new Quadruped(sculpt(s, 'low'), s, { cadence: 1.0, cadenceGain: 0.5, height: 0.9, tailCurve: 0.2 })
      : new Quadruped(sculpt(s), s, { cadence: 2.0, cadenceGain: 0.8, height: 0.33, tailCurve: 0.05 });
    const dir = Math.random() < 0.5 ? 1 : -1;
    // a crossing line that is land all the way (never across a lake)
    const lineOk = (z: number) => {
      for (let x = -22; x <= 22; x += 2) if (!this.walkable(x, z)) return false;
      return true;
    };
    const tries = [0, 1, 2, 3, 4, 5].map(() => -(deer ? 16 : 10) - Math.random() * 10).concat([-6, -5, -4.5]);
    const z = tries.find(lineOk);
    if (z === undefined) return null;
    q.pos.set(-dir * 22, 0, z);
    q.yaw = dir > 0 ? 0 : Math.PI;
    q.gait = deer ? 'walk' : 'trot';
    const obj = new THREE.Group();
    obj.add(q.root);
    let age = 0, stop = 0, graze = false;
    const speed = deer ? 0.9 : 1.4;
    return {
      obj,
      update: (dt) => {
        age += dt;
        if (stop > 0) {
          stop -= dt;
          q.targetSpeed = 0;
          // grazing, or head up and listening with a look toward you
          q.headDown = graze ? 1 : 0;
          q.lookAt = graze ? null : new THREE.Vector3(0, 1.2, 3);
        } else {
          q.targetSpeed = speed;
          q.headDown = 0;
          q.lookAt = null;
          if (deer && Math.random() < dt * 0.08) {
            stop = 3 + Math.random() * 5;
            graze = Math.random() < 0.6;
          }
        }
        q.update(dt);
        return Math.abs(q.pos.x) < 24 && age < 120;
      },
    };
  }

  // ── water ─────────────────────────────────────────────────────────────────
  private fishJump(w: [number, number, number, number]): Actor {
    const s = this.spec('fish');
    const a = sculpt(s, 'low');
    const obj = new THREE.Group();
    obj.add(a.root);
    const [x0, z0, x1, z1] = w;
    const x = x0 + Math.random() * (x1 - x0);
    const z = z0 + (z1 - z0) * Math.random() * 0.4;
    const dir = Math.random() < 0.5 ? 1 : -1;
    obj.rotation.y = dir > 0 ? 0 : Math.PI;
    let age = 0;
    const T = 0.6;
    this.rings.add(x, z, 1.2);
    return {
      obj,
      update: (dt) => {
        age += dt;
        const k = age / T;
        obj.position.set(x + dir * k * 0.7, Math.sin(Math.PI * Math.min(k, 1)) * 0.5, z);
        a.root.rotation.z = (0.5 - k) * 1.8; // nose up, then down
        a.bones.tail0.rotation.y = Math.sin(age * 30) * 0.4;
        if (k >= 1 && k - dt / T < 1) this.rings.add(obj.position.x, z, 1.4);
        return k < 1.05;
      },
    };
  }

  private loon(w: [number, number, number, number]): Actor {
    const b = new Bird(this.spec('loon'), 3, 'flap');
    const obj = new THREE.Group();
    obj.name = 'loon';
    obj.add(b.root);
    const [x0, z0, x1, z1] = w;
    obj.position.set(x0 + (x1 - x0) * 0.3, 0.06, z0 + (z1 - z0) * 0.15);
    let age = 0, under = 0, dir = 1;
    return {
      obj,
      update: (dt) => {
        age += dt;
        b.pose(dt, 'swim');
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
        obj.position.y = 0.06 + Math.sin(age * 1.1) * 0.012;
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
