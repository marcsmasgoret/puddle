// User settings, remembered between visits (localStorage, failing silently
// in private windows).
import type { FluidId } from '../physics/fluids';

const KEY = 'puddle.settings.v1';

export interface Settings {
  /** slap strength slider, 0…1 */
  strength: number;
  fluid: FluidId;
}

const defaults: Settings = { strength: 0.35, fluid: 'water' };

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
