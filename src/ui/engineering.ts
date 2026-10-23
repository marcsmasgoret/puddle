// Engineering mode: a card of live readouts, overlays of the fields the solver
// computes, and sliders for every physical parameter. Changing a slider takes
// effect on the running simulation without resetting it.
import type { FluidProperties } from '../physics/fluids';
import type { ShallowWaterSolver } from '../physics/solver';
import { GRAVITY } from '../physics/solver';
import { viscosityAt } from '../physics/rheology';
import { LEGEND_CSS, type Overlay, type OverlayMode } from '../render/overlay';
import type { RigidBody } from '../physics/rigidbody';

export interface EngineeringHooks {
  /** the fluid as chosen in the panel (measured values) */
  base(): FluidProperties;
  /** apply a modified fluid to the running simulation */
  setFluid(f: FluidProperties): void;
  setGravity(g: number): void;
  bodies(): { kind: string; body: RigidBody }[];
  lastSlap(): { froude: number; sprayMl: number };
  stats: { fps: number; cpuMs: number };
}

interface Param {
  label: string;
  unit: string;
  min: number;
  max: number;
  log: boolean;
  get(): number;
  set(v: number): void;
  fmt(v: number): string;
  /** shown only for this kind of fluid */
  only?: 'newtonian' | 'oobleck';
}

const sig = (v: number, n = 3) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  return a >= 1e4 || a < 1e-3 ? v.toExponential(n - 1) : String(+v.toPrecision(n));
};

export class Engineering {
  readonly el: HTMLElement;
  private open = false;
  private fluid: FluidProperties;
  private g = GRAVITY;
  private readouts: Record<string, HTMLElement> = {};
  private sliders: { p: Param; input: HTMLInputElement; value: HTMLElement; row: HTMLElement }[] = [];
  private legend: HTMLElement;
  private chips: HTMLButtonElement[] = [];
  private lastHeavy = 0;
  private lastLight = 0;
  private baseVolume = 0;

  constructor(
    private solver: ShallowWaterSolver,
    private overlay: Overlay,
    private hooks: EngineeringHooks,
    commit: string,
  ) {
    this.fluid = hooks.base();
    const el = (this.el = document.createElement('div'));
    el.className = 'eng';
    el.innerHTML = `
      <div class="eng-head"><b>Engineering</b><span class="eng-commit">build ${commit}</span><button class="eng-close" aria-label="Close">×</button></div>
      <div class="eng-grid" data-r></div>
      <div class="eng-sub">Overlay</div>
      <div class="eng-chips" data-o></div>
      <div class="eng-legend" data-l></div>
      <div class="eng-sub">Parameters <span class="eng-note">live, no reset</span></div>
      <div data-p></div>
      <div class="eng-sub">Grid</div>
      <div class="eng-chips" data-g></div>
      <div class="eng-links"><button class="eng-btn" data-reset>Back to measured values</button></div>
      <div class="eng-links"><a href="./physics.html" target="_blank" rel="noopener">Physics write-up ↗</a><a href="./validate.html" target="_blank" rel="noopener">Validation ↗</a></div>`;
    document.body.append(el);
    el.querySelector('.eng-close')!.addEventListener('click', () => this.toggle(false));
    el.addEventListener('pointerdown', (e) => e.stopPropagation());

    // readouts
    const grid = el.querySelector('[data-r]')!;
    const rows: [string, string][] = [
      ['fps', 'Frame rate'],
      ['cpu', 'CPU per frame'],
      ['grid', 'Grid'],
      ['steps', 'Substeps'],
      ['limits', 'dt limits'],
      ['c', 'Wave speed √(gH)'],
      ['eta', 'Max |η|'],
      ['u', 'Max |u|'],
      ['fr', 'Max Froude'],
      ['vol', 'Volume change'],
      ['slap', 'Last slap'],
      ['mu', 'Viscosity'],
      ['toys', 'Toys F_b / mg'],
    ];
    for (const [k, label] of rows) {
      const a = document.createElement('span');
      a.textContent = label;
      const b = document.createElement('span');
      b.className = 'eng-v';
      grid.append(a, b);
      this.readouts[k] = b;
    }

    // overlays
    const oc = el.querySelector('[data-o]')!;
    const modes: [OverlayMode, string][] = [
      ['off', 'Off'], ['height', 'Height'], ['velocity', 'Velocity'], ['vorticity', 'Vorticity'], ['froude', 'Froude'], ['viscosity', 'Strain / μ'], ['forces', 'Forces'],
    ];
    for (const [m, label] of modes) {
      const b = document.createElement('button');
      b.className = 'ui-chip';
      b.textContent = label;
      b.addEventListener('click', () => this.setOverlay(m));
      b.dataset.m = m;
      oc.append(b);
      this.chips.push(b);
    }
    this.legend = el.querySelector('[data-l]')!;

    // parameters
    const params: Param[] = [
      { label: 'Density ρ', unit: 'kg/m³', min: 100, max: 20000, log: true, get: () => this.fluid.density, set: (v) => this.patch({ density: v }), fmt: (v) => sig(v, 4) },
      { label: 'Viscosity μ', unit: 'Pa·s', min: 1e-5, max: 100, log: true, get: () => this.fluid.viscosity, set: (v) => this.patch({ viscosity: v }), fmt: (v) => sig(v), only: 'newtonian' },
      { label: 'Surface tension σ', unit: 'N/m', min: 0, max: 0.6, log: false, get: () => this.fluid.surfaceTension, set: (v) => this.patch({ surfaceTension: v }), fmt: (v) => sig(v) },
      { label: 'Gravity g', unit: 'm/s²', min: 0.5, max: 30, log: true, get: () => this.g, set: (v) => this.setGravity(v), fmt: (v) => `${sig(v)}${gravityName(v)}` },
      { label: 'Extra damping', unit: '1/s', min: 0, max: 5, log: false, get: () => this.solver.extraDamping, set: (v) => (this.solver.extraDamping = v), fmt: (v) => sig(v, 2) },
      { label: 'Smagorinsky C_s', unit: '', min: 0, max: 0.4, log: false, get: () => this.solver.smagorinsky, set: (v) => (this.solver.smagorinsky = v), fmt: (v) => v.toFixed(2) },
      { label: 'μ₀ (liquid)', unit: 'Pa·s', min: 0.05, max: 50, log: true, get: () => this.rheo('mu0'), set: (v) => this.patchRheo({ mu0: v }), fmt: (v) => sig(v), only: 'oobleck' },
      { label: 'γ̇_c (onset)', unit: '1/s', min: 0.2, max: 100, log: true, get: () => this.rheo('gammaC'), set: (v) => this.patchRheo({ gammaC: v }), fmt: (v) => sig(v), only: 'oobleck' },
      { label: 'n (steepness)', unit: '', min: 1, max: 6, log: false, get: () => this.rheo('n'), set: (v) => this.patchRheo({ n: v }), fmt: (v) => v.toFixed(2), only: 'oobleck' },
      { label: 'μ_max (jammed)', unit: 'Pa·s', min: 10, max: 1e5, log: true, get: () => this.rheo('muMax'), set: (v) => this.patchRheo({ muMax: v }), fmt: (v) => sig(v), only: 'oobleck' },
      { label: 'τ_y (yield)', unit: 'Pa', min: 0, max: 20, log: false, get: () => this.rheo('yieldStress'), set: (v) => this.patchRheo({ yieldStress: v }), fmt: (v) => sig(v, 2), only: 'oobleck' },
    ];
    const pc = el.querySelector('[data-p]')!;
    for (const p of params) {
      const row = document.createElement('div');
      row.className = 'eng-param';
      row.innerHTML = `<div class="eng-prow"><span>${p.label}</span><span class="eng-v"></span></div><input type="range" min="0" max="1000" step="1">`;
      const input = row.querySelector('input')!;
      const value = row.querySelector<HTMLElement>('.eng-v')!;
      input.addEventListener('input', () => {
        const t = +input.value / 1000;
        p.set(p.log ? p.min * (p.max / p.min) ** t : p.min + (p.max - p.min) * t);
        value.textContent = `${p.fmt(p.get())} ${p.unit}`;
      });
      pc.append(row);
      this.sliders.push({ p, input, value, row });
    }

    // grid resolution needs a reload (every texture and shader is sized to it)
    const gc = el.querySelector('[data-g]')!;
    for (const n of [128, 256, 384, 512, 768]) {
      const b = document.createElement('button');
      b.className = 'ui-chip';
      b.textContent = String(n);
      b.classList.toggle('on', n === solver.grid.nx);
      b.addEventListener('click', () => {
        const q = new URLSearchParams(location.search);
        q.set('grid', String(n));
        q.set('eng', '1');
        location.search = q.toString();
      });
      gc.append(b);
    }
    el.querySelector('[data-reset]')!.addEventListener('click', () => this.resetParams());

    this.setOverlay('off');
    this.syncSliders();
  }

  get isOpen() {
    return this.open;
  }

  /** called when the card opens or closes (to show the graphs with it) */
  onToggle: (open: boolean) => void = () => {};

  toggle(on = !this.open) {
    this.open = on;
    this.el.classList.toggle('open', on);
    this.onToggle(on);
    if (!on) this.setOverlay('off');
    else {
      this.syncSliders();
      this.baseVolume = this.volume();
    }
  }

  /** The panel picked a new fluid: parameters return to its measured values. */
  fluidChanged() {
    this.fluid = this.hooks.base();
    this.overlay.setFluid(this.fluid, this.g);
    this.syncSliders();
    this.baseVolume = 0;
  }

  /** the fluid currently running (with any slider changes) */
  get current() {
    return this.fluid;
  }

  private rheo<K extends 'mu0' | 'gammaC' | 'n' | 'muMax' | 'yieldStress'>(k: K): number {
    const r = this.fluid.rheology;
    return r.kind === 'shearThickening' ? r[k] : 0;
  }

  private patch(p: Partial<FluidProperties>) {
    this.fluid = { ...this.fluid, ...p };
    this.apply();
  }

  private patchRheo(p: Partial<{ mu0: number; gammaC: number; n: number; muMax: number; yieldStress: number }>) {
    const r = this.fluid.rheology;
    if (r.kind !== 'shearThickening') return;
    this.fluid = { ...this.fluid, rheology: { ...r, ...p }, viscosity: p.mu0 ?? this.fluid.viscosity };
    this.apply();
  }

  private apply() {
    this.hooks.setFluid(this.fluid);
    this.overlay.setFluid(this.fluid, this.g);
  }

  private setGravity(g: number) {
    this.g = g;
    this.hooks.setGravity(g);
    this.overlay.setFluid(this.fluid, g);
  }

  private resetParams() {
    this.fluid = this.hooks.base();
    this.apply();
    this.setGravity(GRAVITY);
    this.solver.extraDamping = 0;
    this.solver.smagorinsky = 0.17;
    this.syncSliders();
  }

  private syncSliders() {
    const kind = this.fluid.rheology.kind === 'shearThickening' ? 'oobleck' : 'newtonian';
    for (const s of this.sliders) {
      const { p } = s;
      s.row.style.display = p.only && p.only !== kind ? 'none' : '';
      const v = p.get();
      const t = p.log ? Math.log(Math.max(v, p.min) / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min);
      s.input.value = String(Math.round(Math.min(Math.max(t, 0), 1) * 1000));
      s.value.textContent = `${p.fmt(v)} ${p.unit}`;
    }
  }

  private setOverlay(m: OverlayMode) {
    this.overlay.mode = m;
    this.chips.forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    const f = this.fluid;
    const bar = (css: string, lo: string, hi: string, caption: string) =>
      `<div class="eng-bar" style="background:${css}"></div><div class="eng-scale"><span>${lo}</span><span>${caption}</span><span>${hi}</span></div>`;
    const r = f.rheology;
    this.legend.innerHTML =
      m === 'height'
        ? bar(LEGEND_CSS.diverging, `−${this.overlay.heightScale * 1000} mm`, `+${this.overlay.heightScale * 1000} mm`, 'surface height η')
        : m === 'velocity'
          ? bar(LEGEND_CSS.viridis, '0', `${this.overlay.speedScale} m/s`, 'depth-averaged speed')
          : m === 'viscosity'
            ? r.kind === 'shearThickening'
              ? bar(LEGEND_CSS.viridis, `${sig(r.mu0)} Pa·s`, `${sig(r.muMax)} Pa·s`, 'viscosity μ(γ̇), log')
              : bar(LEGEND_CSS.viridis, '0.1 /s', '1000 /s', 'strain rate γ̇, log')
            : m === 'vorticity'
              ? bar(LEGEND_CSS.diverging, '−4 /s', '+4 /s', 'vorticity (spin of the water)')
            : m === 'froude'
              ? bar(LEGEND_CSS.viridis, '0', '1.5', 'Froude number; white line: Fr = 1')
            : m === 'forces'
              ? `<div class="eng-keys"><span><i style="background:#b8bcc2"></i>weight</span><span><i style="background:#4aa3e0"></i>buoyancy</span><span><i style="background:#f08a4b"></i>drag</span></div><div class="eng-scale"><span>arrow length ∝ √|F|</span></div>`
              : '';
  }

  private volume() {
    const s = this.solver.readState();
    const a = this.solver.grid.dx ** 2;
    let v = 0;
    for (let k = 0; k < s.length; k += 4) v += s[k] * a;
    return v;
  }

  /** Refresh the readouts: cheap ones 4× a second, a full readback 1× a second. */
  update(now: number) {
    if (!this.open || now - this.lastLight < 250) return;
    this.lastLight = now;
    const R = this.readouts;
    const s = this.solver;
    const plan = s.lastPlan;
    const f = this.fluid;
    const { nx, nz, dx } = s.grid;
    R.fps.textContent = `${this.hooks.stats.fps}`;
    R.cpu.textContent = `${this.hooks.stats.cpuMs.toFixed(1)} ms`;
    R.grid.textContent = `${nx} × ${nz}, Δx ${(dx * 1000).toFixed(2)} mm`;
    if (plan) {
      R.steps.textContent = `${plan.substeps} × ${(plan.dt * 1000).toFixed(2)} ms${plan.slowMotion ? ' (slowed)' : ''}`;
      R.limits.textContent = `wave ${(plan.limits.wave * 1000).toFixed(2)} · adv ${(plan.limits.advection * 1000).toFixed(1)} ms`;
    }
    let Hmax = 0;
    const d = s.shape.data;
    for (let k = 0; k < nx * nz; k++) Hmax = Math.max(Hmax, d[k * 4]);
    R.c.textContent = `${Math.sqrt(this.g * Hmax).toFixed(3)} m/s at ${(Hmax * 1000).toFixed(1)} mm`;
    const ls = this.hooks.lastSlap();
    R.slap.textContent = ls.froude ? `Fr ${ls.froude}, spray ${ls.sprayMl} mL` : '–';
    const r = f.rheology;
    R.mu.textContent =
      r.kind === 'shearThickening'
        ? `${sig(viscosityAt(f, 0.5))} → ${sig(viscosityAt(f, 50))} Pa·s (γ̇ 0.5 → 50 /s)`
        : `${sig(f.viscosity)} Pa·s, ν ${sig(f.viscosity / f.density)} m²/s`;
    const toys = this.hooks.bodies();
    R.toys.textContent = toys.length
      ? toys.map((t) => `${t.kind} ${(t.body.buoyancy / (t.body.def.mass * this.g)).toFixed(2)}`).join(', ')
      : '–';

    if (now - this.lastHeavy < 1000) return;
    this.lastHeavy = now;
    // full-state readback: max η, max |u|, max Froude, total volume
    const st = s.readState();
    let me = 0, mu = 0, fr = 0, vol = 0;
    for (let k = 0; k < nx * nz; k++) {
      if (d[k * 4 + 2] < 0.5) continue;
      const e = st[k * 4], u = st[k * 4 + 1], v = st[k * 4 + 2];
      me = Math.max(me, Math.abs(e));
      const sp = Math.hypot(u, v);
      mu = Math.max(mu, sp);
      const h = d[k * 4] + e;
      if (h > 0.002) fr = Math.max(fr, sp / Math.sqrt(this.g * h));
      vol += e * dx * dx;
    }
    if (!this.baseVolume) this.baseVolume = vol;
    R.eta.textContent = `${(me * 1000).toFixed(2)} mm`;
    R.u.textContent = `${mu.toFixed(3)} m/s`;
    R.fr.textContent = fr.toFixed(2);
    R.vol.textContent = `${((vol - this.baseVolume) * 1e6).toFixed(3)} mL`;
  }
}

function gravityName(g: number) {
  const near = (x: number) => Math.abs(g / x - 1) < 0.03;
  return near(9.81) ? ' (Earth)' : near(1.62) ? ' (Moon)' : near(3.71) ? ' (Mars)' : near(24.8) ? ' (Jupiter)' : '';
}
