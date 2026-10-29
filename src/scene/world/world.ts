// The world: which location, season, time of day and weather, and
// everything that follows from them (scenery, lighting, ground, the puddle's
// shape, weather and lightning, leaves, ice, the hot tub).
import * as THREE from 'three';
import { buildPuddle } from '../../physics/puddleShape';
import type { ShallowWaterSolver } from '../../physics/solver';
import { applyGroundLook, applyGroundSeason, type SeasonLook } from '../../render/ground';
import { Environment } from './environment';
import { loaders, type LocationDef, type LocationId, type BuiltLocation } from './location';
import { makeMood, type Season, type TimeOfDay, type Weather } from './palettes';
import { sway, type Waters, type Trunk } from './props';
import { WeatherSystem } from './weather';
import { Lightning } from './lightning';
import { Leaves } from './leaves';
import { Ice } from './ice';
import { MouseCat } from '../animals/mouseCat';
import { Wildlife } from '../animals/wildlife';
import { Prints } from '../animals/prints';
import { setGroundPrints } from '../../render/ground';

export interface WorldConfig {
  location: LocationId;
  season: Season;
  time: TimeOfDay;
  weather: Weather;
}

const SEASON_LOOK: Record<Season, SeasonLook> = {
  spring: { snow: 0, leaves: 0, grass: [1.08, 1.12, 0.92] },
  summer: { snow: 0, leaves: 0, grass: [1, 1, 1] },
  autumn: { snow: 0, leaves: 0.6, grass: [1.15, 1.0, 0.7] },
  winter: { snow: 0.85, leaves: 0, grass: [1.05, 0.86, 0.82] }, // dormant, browner grass and moss
};

export interface WorldHooks {
  /** the puddle's outline changed (reframe the camera, rebuild the bed) */
  onShapeChanged(): void;
  /** hot tub on/off */
  onHotTub(on: boolean): void;
  /** lightning struck `distance` m away, `azimuth` rad right of straight ahead */
  onLightning(distance: number, azimuth: number): void;
  groundMaterials: THREE.Material[];
}

export class World {
  config: WorldConfig;
  readonly env: Environment;
  readonly weather: WeatherSystem;
  readonly lightning: Lightning;
  readonly leaves: Leaves;
  readonly ice: Ice;
  readonly prints = new Prints();
  readonly mouseCat = new MouseCat(this.prints);
  readonly wildlife = new Wildlife();
  def: LocationDef | null = null;
  private built: BuiltLocation | null = null;
  private shapeKey = '';
  private loading = Promise.resolve();
  private renderer: THREE.WebGLRenderer;
  readonly time = { value: 0 };
  hotTub = false;
  waterFreezes = false;

  constructor(
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    private solver: ShallowWaterSolver,
    private waters: Waters,
    private hooks: WorldHooks,
    initial: WorldConfig,
    phone: boolean,
    onRaindrop: (x: number, z: number, r: number, v: number) => void,
  ) {
    this.config = initial;
    this.env = new Environment(renderer, scene, makeMood(initial.time, initial.weather, initial.season), phone ? 1024 : 2048);
    const bounds = { get halfX() { return solver.shape.halfX; }, get halfZ() { return solver.shape.halfZ; } };
    this.weather = new WeatherSystem(scene, bounds, (x, z) => solver.sdfAt(x, z) < 0, onRaindrop, phone);
    this.lightning = new Lightning(scene, this.env, (s) => hooks.onLightning(s.distance, s.azimuth));
    this.leaves = new Leaves(scene, renderer, solver);
    this.ice = new Ice(renderer, solver);
    waters.time = this.time;
    scene.add(this.mouseCat.group, this.wildlife.group);
    for (const m of hooks.groundMaterials) setGroundPrints(m, this.prints.target.texture);
    this.renderer = renderer;
    // build the starting place (asynchronous: the location module is loaded
    // on demand, so this runs after the rest of the app has been set up)
    this.loading = this.apply(initial);
  }

  /** Change any part of the configuration; scenery is rebuilt as needed. */
  set(partial: Partial<WorldConfig>) {
    const next = { ...this.config, ...partial };
    this.loading = this.loading.then(() => this.apply(next));
    return this.loading;
  }

  private async apply(c: WorldConfig) {
    const prev = this.config;
    this.config = c;
    const def = (await loaders[c.location]()).default;
    const mood = makeMood(c.time, c.weather, c.season);
    this.env.apply(mood);

    // puddle shape (only when it actually changes: that resets the water)
    const spec = def.shape(c.season);
    const key = JSON.stringify(spec);
    if (key !== this.shapeKey) {
      this.shapeKey = key;
      this.solver.setShape(buildPuddle(this.solver.grid, undefined, spec));
      this.hooks.onShapeChanged();
    }

    // ground
    for (const m of this.hooks.groundMaterials) {
      applyGroundLook(m, def.ground);
      applyGroundSeason(m, SEASON_LOOK[c.season], c.weather === 'rain' ? 1 : 0);
    }

    // scenery: rebuilt whenever location, season or time changes
    if (!this.built || def !== this.def || prev.season !== c.season || prev.time !== c.time || prev.weather !== c.weather) {
      if (this.built) {
        this.scene.remove(this.built.group);
        disposeTree(this.built.group);
      }
      this.built = def.build({
        mood,
        season: c.season,
        weather: c.weather,
        sdfAt: (x, z) => this.solver.sdfAt(x, z),
        halfX: this.solver.shape.halfX,
        halfZ: this.solver.shape.halfZ,
        waters: this.waters,
      });
      this.scene.add(this.built.group);
      this.clearPuddle(this.built.group);
      // real trunks near the puddle, for the squirrels (not shrubs)
      this.trunks = [];
      this.built.group.traverse((o) => {
        for (const t of (o.userData.trunks ?? []) as Trunk[]) if (t[3] >= 4 && Math.hypot(t[0], t[1]) < 15 && t[1] < 0) this.trunks.push(t);
      });
      this.critterKey = '';
    }
    this.def = def;

    // animals: rebuilt with the place, season and time
    const critterKey = `${c.location}|${c.season}|${c.time}`;
    if (critterKey !== this.critterKey) {
      this.critterKey = critterKey;
      // animals keep to solid ground: off open water and out of the puddle
      const walkable = (x: number, z: number) => !def.water?.(x, z) && this.solver.sdfAt(x, z) > 0.1;
      // the mouse's spots, moved out to the shore if the puddle has grown over them
      const spots = { ...def.critters.mouse, from: [...def.critters.mouse.from] as [number, number], to: [...def.critters.mouse.to] as [number, number] };
      for (const s of [spots.from, spots.to]) {
        for (let k = 0; k < 200 && this.solver.sdfAt(s[0], s[1]) < 0.25; k++) {
          s[0] *= 1.02;
          s[1] = s[1] * 1.02 - 0.005;
        }
      }
      this.mouseCat.configure(spots, c.season === 'winter', walkable);
      const habitat = { ...def.critters.habitat };
      if (habitat.trees) habitat.trees = this.trunks.filter(([x, z]) => walkable(x, z)).length >= 2 ? this.trunks : undefined;
      this.wildlife.configure(habitat, c.season, c.time, walkable);
      this.prints.clear(this.renderer);
    }

    // weather, leaves, ice, hot tub
    this.weather.set(c.weather);
    this.lightning.enabled = c.weather === 'rain';
    sway.strength.value = c.weather === 'wind' ? 0.012 : c.weather === 'rain' ? 0.005 : 0.002;
    this.leaves.setActive(c.season === 'autumn');
    const hot = !!def.hotTub?.(c.season);
    if (hot !== this.hotTub) {
      this.hotTub = hot;
      this.hooks.onHotTub(hot);
    }
    this.waterFreezes = c.season === 'winter' && def.freezes(c.season);
    this.updateIce();
  }

  /**
   * Props placed near the puddle (logs, chairs, rocks…) are nudged out of
   * the water when the puddle is made bigger.
   */
  private clearPuddle(group: THREE.Group) {
    const sdf = (x: number, z: number) => this.solver.sdfAt(x, z);
    for (const o of group.children) {
      const p = o.position;
      if (p.lengthSq() < 1e-6 || Math.hypot(p.x, p.z) > 12) continue;
      const box = new THREE.Box3().setFromObject(o);
      const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
      if (r > 4) continue;
      for (let k = 0; k < 200 && sdf(p.x, p.z) < r * 0.8 + 0.1; k++) {
        const e = 0.03;
        const gx = sdf(p.x + e, p.z) - sdf(p.x - e, p.z), gz = sdf(p.x, p.z + e) - sdf(p.x, p.z - e);
        const l = Math.hypot(gx, gz) || 1;
        p.x += (gx / l) * 0.03;
        p.z += (gz / l) * 0.03;
      }
    }
  }

  /** ice forms only on water (honey doesn't freeze, mercury not until −39 °C) */
  updateIce(fluidId = this.fluidId) {
    this.fluidId = fluidId;
    const on = this.waterFreezes && (fluidId === 'water' || fluidId === 'oobleck');
    if (on && !this.ice.enabled) {
      this.ice.enabled = true;
      this.ice.reset();
    } else if (!on && this.ice.enabled) this.ice.disable();
  }
  private fluidId = 'water';
  private trunks: Trunk[] = [];
  private critterKey = '';

  update(dt: number, camera: THREE.Camera) {
    this.time.value += dt;
    sway.time.value = this.time.value;
    this.env.update(this.time.value);
    this.built?.update?.(this.time.value, dt);
    this.weather.update(dt);
    this.lightning.update(dt, camera);
    this.solver.setWind(this.weather.wind.x, this.weather.wind.y);
    this.leaves.update(dt, this.time.value, this.weather.wind);
    this.ice.update(dt);
    this.mouseCat.update(dt);
    this.wildlife.update(dt, this.time.value);
    this.prints.update(this.renderer, dt);
  }

  /** the current location's scenery group (for tests) */
  get group() {
    return this.built?.group ?? null;
  }

  ready() {
    return this.loading;
  }
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
