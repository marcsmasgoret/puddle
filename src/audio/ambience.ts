// Which background sounds suit a given place, season, time and weather.
import type { AmbienceSpec } from './audio';
import type { WorldConfig } from '../scene/world/world';

export function ambienceFor(c: WorldConfig, hotTub: boolean): AmbienceSpec {
  const night = c.time === 'night';
  const dusk = c.time === 'sunrise' || c.time === 'sunset';
  const warm = c.season === 'summer' || c.season === 'spring';
  const winter = c.season === 'winter';
  const s: AmbienceSpec = { wind: 0.12, waves: 0, lapping: 0, traffic: 0, rain: 0, birds: 0, crickets: 0, frogs: 0, fire: 0, bubbles: 0, loons: 0 };
  const L = c.location;
  if (L === 'beach') s.waves = 0.55;
  if (L === 'lionsgate') s.waves = 0.3;
  if (L === 'dock' || L === 'algonquin') s.lapping = 0.35;
  if (L === 'highpark') s.lapping = 0.1;
  if (L === 'city') s.traffic = night ? 0.25 : 0.45;
  if (L === 'algonquin') s.fire = night ? 0.5 : 0.25;
  if ((L === 'algonquin' || L === 'dock') && !winter) s.loons = dusk || night ? 1 : 0.4;
  if (L === 'backyard' && hotTub) s.bubbles = 0.6;
  // life: birds by day (fewer in winter, none at night), crickets on warm
  // nights, frogs near water at dusk and night
  const leafy = L !== 'city';
  if (!night) s.birds = (leafy ? 0.9 : 0.35) * (winter ? 0.25 : 1) * (c.weather === 'rain' ? 0.3 : 1);
  if (night && c.season === 'summer' && L !== 'city') s.crickets = 0.8;
  if ((night || dusk) && warm && (L === 'dock' || L === 'highpark' || L === 'algonquin')) s.frogs = 0.6;
  // weather
  if (c.weather === 'wind') s.wind = 0.7;
  if (c.weather === 'rain') {
    s.rain = 0.6;
    s.wind = 0.3;
  }
  if (c.weather === 'snow') {
    s.wind = 0.18; // snow muffles everything
    s.birds *= 0.3;
  }
  return s;
}
