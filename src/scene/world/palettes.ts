// Lighting moods: a base palette per time of day, then adjusted for weather
// and season. Everything that is lit reads from the resulting Palette.
import * as THREE from 'three';
import type { Palette } from '../atmosphere';

export type TimeOfDay = 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'rain' | 'wind' | 'snow';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Mood extends Palette {
  /** 0 = day … 1 = full night (stars, lit windows, moonlight) */
  night: number;
  /** 0 = clear … 1 = fully overcast */
  overcast: number;
  fogNear: number;
  fogFar: number;
  exposure: number;
}

const c = (h: string) => new THREE.Color(h);
const deg = THREE.MathUtils.degToRad;

const BASE: Record<TimeOfDay, Mood> = {
  sunrise: {
    skyTop: c('#7486c0'), skyHorizon: c('#f7c4a6'), haze: c('#dcc6c4'),
    sunColor: c('#ffc79e'), sunIntensity: 2.4, sunElevation: deg(7), sunAzimuth: deg(55),
    hemiSky: c('#c8c4df'), hemiGround: c('#6a5c52'), hemiIntensity: 1.15,
    cloudColor: c('#ffd9c4'), cloudAmount: 0.5,
    night: 0, overcast: 0, fogNear: 20, fogFar: 230, exposure: 1.0,
  },
  day: {
    skyTop: c('#6d9bd1'), skyHorizon: c('#f6dcc0'), haze: c('#c8d6dc'),
    sunColor: c('#ffe6c2'), sunIntensity: 3.6, sunElevation: deg(24), sunAzimuth: deg(-58),
    hemiSky: c('#c4dbf0'), hemiGround: c('#6b6a48'), hemiIntensity: 1.5,
    cloudColor: c('#fff4ea'), cloudAmount: 0.45,
    night: 0, overcast: 0, fogNear: 25, fogFar: 260, exposure: 1.0,
  },
  sunset: {
    skyTop: c('#55619e'), skyHorizon: c('#f7a473'), haze: c('#e0ad9a'),
    sunColor: c('#ff9b5e'), sunIntensity: 2.7, sunElevation: deg(4), sunAzimuth: deg(-18),
    hemiSky: c('#b7a9cf'), hemiGround: c('#5c4a42'), hemiIntensity: 1.05,
    cloudColor: c('#ffb98f'), cloudAmount: 0.55,
    night: 0, overcast: 0, fogNear: 20, fogFar: 230, exposure: 1.0,
  },
  night: {
    // a clear moonlit night: deep blue sky, silvery moonlight. The moon
    // hangs low over the far side of the scene, where you can see it (and
    // its reflection in the puddle)
    skyTop: c('#0a1838'), skyHorizon: c('#2b3f6e'), haze: c('#263862'),
    sunColor: c('#c2d2f5'), sunIntensity: 1.25, sunElevation: deg(13), sunAzimuth: deg(-14),
    hemiSky: c('#5068a0'), hemiGround: c('#20232e'), hemiIntensity: 1.0,
    cloudColor: c('#46557d'), cloudAmount: 0.25,
    night: 1, overcast: 0, fogNear: 18, fogFar: 230, exposure: 1.4,
  },
};

function clone(m: Mood): Mood {
  const o = { ...m } as Mood;
  for (const k of Object.keys(o) as (keyof Mood)[]) {
    const v = o[k];
    if (v instanceof THREE.Color) (o as unknown as Record<string, unknown>)[k] = v.clone();
  }
  return o;
}

export function makeMood(time: TimeOfDay, weather: Weather, season: Season): Mood {
  const m = clone(BASE[time]);
  if (weather === 'rain' || weather === 'snow') {
    // overcast: a flat grey sky, soft light from everywhere, little direct sun
    const grey = c(weather === 'rain' ? '#8f99a4' : '#c3cad4');
    const k = time === 'night' ? 0.35 : 0.72;
    for (const col of [m.skyTop, m.skyHorizon, m.haze, m.cloudColor]) col.lerp(time === 'night' ? grey.clone().multiplyScalar(0.25) : grey, k);
    m.sunIntensity *= 0.22;
    m.hemiSky.lerp(grey, 0.5);
    m.hemiIntensity *= weather === 'snow' ? 1.05 : 0.85;
    m.cloudAmount = 1;
    m.overcast = 1;
    m.fogNear *= 0.5;
    m.fogFar *= weather === 'snow' ? 0.45 : 0.6;
  } else if (weather === 'wind') {
    m.cloudAmount = Math.min(1, m.cloudAmount + 0.3);
    m.overcast = 0.25;
  }
  if (season === 'winter') {
    // snow cover bounces light back up; cooler haze
    m.hemiGround.lerp(c('#c9ced6'), 0.6);
    m.haze.lerp(c('#cfd8e2'), 0.25);
    m.sunIntensity *= 0.9;
  } else if (season === 'autumn') {
    m.haze.lerp(c('#d8c4ac'), 0.2);
    m.hemiGround.lerp(c('#7a5a3a'), 0.3);
  } else if (season === 'spring') {
    m.haze.lerp(c('#d3e0d6'), 0.15);
  }
  return m;
}
