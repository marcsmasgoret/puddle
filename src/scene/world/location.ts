// A location: its puddle shape, ground, and the scenery around it. Each one
// lives in its own module and is loaded only when chosen (code-split), so
// the first visit downloads just one.
import type * as THREE from 'three';
import type { ShapeSpec } from '../../physics/puddleShape';
import type { GroundLook } from '../../render/ground';
import type { Mood, Season, Weather } from './palettes';
import type { Waters } from './props';
import type { MouseSpots } from '../animals/mouseCat';
import type { Habitat } from '../animals/wildlife';

export type LocationId = 'forest' | 'beach' | 'europe' | 'city' | 'backyard' | 'dock' | 'highpark' | 'lionsgate' | 'algonquin';

export const LOCATIONS: [LocationId, string][] = [
  ['forest', 'Forest'],
  ['beach', 'PEI beach'],
  ['europe', 'Mediterranean'],
  ['city', 'City street'],
  ['backyard', 'Backyard pool'],
  ['dock', 'Cottage dock'],
  ['highpark', 'High Park'],
  ['lionsgate', 'Lions Gate'],
  ['algonquin', 'Algonquin'],
];

export interface LocationContext {
  mood: Mood;
  season: Season;
  weather: Weather;
  sdfAt(x: number, z: number): number;
  halfX: number;
  halfZ: number;
  waters: Waters;
}

export interface BuiltLocation {
  group: THREE.Group;
  /** per-frame animation (flames, steam, lights) */
  update?(t: number, dt: number): void;
}

export interface LocationDef {
  id: LocationId;
  shape(season: Season): ShapeSpec;
  ground: GroundLook;
  /** does the puddle grow an ice skim in winter? (not the hot tub) */
  freezes(season: Season): boolean;
  /** backyard pool in winter */
  hotTub?(season: Season): boolean;
  build(ctx: LocationContext): BuiltLocation;
  /** is (x, z) open water (lake, sea, pond)? Animals keep off it. */
  water?(x: number, z: number): boolean;
  /** where the mouse lives, and what else lives here */
  critters: { mouse: MouseSpots; habitat: Habitat };
}

export const loaders: Record<LocationId, () => Promise<{ default: LocationDef }>> = {
  forest: () => import('./locations/forest'),
  beach: () => import('./locations/beach'),
  europe: () => import('./locations/europe'),
  city: () => import('./locations/city'),
  backyard: () => import('./locations/backyard'),
  dock: () => import('./locations/dock'),
  highpark: () => import('./locations/highpark'),
  lionsgate: () => import('./locations/lionsgate'),
  algonquin: () => import('./locations/algonquin'),
};
