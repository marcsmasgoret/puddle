// Adaptive quality. Devices that hold a smooth frame rate never see a change.
// On a device that can't, the render resolution steps down (the simulation
// keeps its grid, so the physics is unchanged), one step at a time, and the
// level is remembered for the next visit. If even the lowest step is too slow,
// the next visit also uses the phone-sized simulation grid.
import { GRID_HINT_KEY } from '../physics/grid';

const KEY = 'puddle.quality';
/** render-resolution scale per level */
const SCALES = [1, 0.8, 0.65, 0.5];
const WARMUP = 4; // [s] ignore start-up hitches (shader compiles, first world)
const WINDOW = 2.5; // [s] averaging window
const SLOW = 1 / 42; // [s] mean frame time that counts as struggling

export class AdaptiveQuality {
  level: number;
  private warm = 0;
  private frames = 0;
  private time = 0;
  private slowAtBottom = 0;
  private steady = 0;
  /** automated test browsers render in software; judging them would be meaningless */
  private enabled = !navigator.webdriver;

  constructor(private onChange: () => void, private gridCells: number) {
    let saved = 0;
    try {
      saved = parseInt(localStorage.getItem(KEY) ?? '0', 10) || 0;
    } catch {
      /* storage blocked: start at full quality */
    }
    // start one step above last time, so a device that was only briefly
    // struggling (on battery, busy) gets back to full quality
    this.level = Math.min(Math.max(saved - 1, 0), SCALES.length - 1);
  }

  /** multiplier on the device pixel ratio */
  get scale() {
    return SCALES[this.level];
  }

  /** Call once per frame with the real frame time. */
  sample(dt: number) {
    if (!this.enabled || dt > 0.25) return; // a stall (tab switch, world rebuild), not steady load
    this.warm += dt;
    if (this.warm < WARMUP) return;
    this.frames++;
    this.time += dt;
    if (this.time < WINDOW) return;
    const mean = this.time / this.frames;
    this.frames = 0;
    this.time = 0;
    if (mean <= SLOW) {
      // holding up fine at this level: remember it (once, after ~20 s)
      if (++this.steady === 8) this.save(KEY, String(this.level));
      return;
    }
    this.steady = 0;
    if (this.level < SCALES.length - 1) {
      this.level++;
      this.warm = WARMUP - 1.5; // let the new size settle before judging it
      this.save(KEY, String(this.level));
      this.onChange();
    } else if (this.gridCells > 256 && ++this.slowAtBottom >= 3) {
      // still struggling at the lowest resolution: use the smaller grid next time
      this.save(GRID_HINT_KEY, '256');
    }
  }

  private save(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked: nothing to remember */
    }
  }
}
