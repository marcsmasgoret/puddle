// The world: which location, season, time of day and weather, and
// everything that follows from them (scenery, lighting, ground, the puddle's
// shape, weather, leaves, ice, the hot tub).
import * as THREE from 'three';
import { buildPuddle } from '../../physics/puddleShape';
import type { ShallowWaterSolver } from '../../physics/solver';
import { applyGroundLook, applyGroundSeason, type SeasonLook } from '../../render/ground';
import { Environment } from './environment';
import { loaders, type LocationDef, type LocationId, type BuiltLocation } from './location';
import { makeMood, type Season, type TimeOfDay, type Weather } from './palettes';
import { sway, type Waters } from './props';
import { WeatherSystem } from './weather';
import { Leaves } from './leaves';
import { Ice } from './ice';

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
  winter: { snow: 0.85, leaves: 0, grass: [0.85, 0.85, 0.8] },
};

export interface WorldHooks {
  /** the puddle's outline changed (reframe the camera, rebuild the bed) */
  onShapeChanged(): void;
  /** hot tub on/off */
  onHotTub(on: boolean): void;
  groundMaterials: THREE.Material[];
}

export class World {
  config: WorldConfig;
  readonly env: Environment;
  readonly weather: WeatherSystem;
  readonly leaves: Leaves;
  readonly ice: Ice;
  def: LocationDef | null = null;
  private built: BuiltLocation | null = null;
  private shapeKey = '';
  private loading = Promise.resolve();
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
    this.leaves = new Leaves(scene, renderer, solver);
    this.ice = new Ice(renderer, solver);
    waters.time = this.time;
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
    }
    this.def = def;

    // weather, leaves, ice, hot tub
    this.weather.set(c.weather);
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

  update(dt: number) {
    this.time.value += dt;
    sway.time.value = this.time.value;
    this.env.update(this.time.value);
    this.built?.update?.(this.time.value, dt);
    this.weather.update(dt);
    this.solver.setWind(this.weather.wind.x, this.weather.wind.y);
    this.leaves.update(dt, this.time.value, this.weather.wind);
    this.ice.update(dt);
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
