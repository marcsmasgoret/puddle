// Engineering mode's live graphs, along the bottom of the screen:
//
//   Energy     kinetic and potential energy of the whole puddle over the
//              last 20 s. A wave trades one for the other; friction drains
//              both. Each slap is marked with the energy it put in.
//   Waves      a space–time (Hovmöller) diagram: the surface along the
//              puddle's long axis, newest at the bottom. Every wave front is
//              a diagonal streak, and its slope is its speed; dashed lines
//              from the last slap show √(gh) for comparison.
//   Spectrum   a wave probe at the centre: the frequencies present in the
//              last ~8 s of surface motion (a discrete Fourier transform),
//              with the wavelength each implies through √(gh).
//   Momentum   the fluid's total momentum: a slap pushes it up, the walls
//              bounce it back, friction takes it away.
import * as THREE from 'three';
import type { Diagnostics } from '../physics/diagnostics';
import type { ShallowWaterSolver } from '../physics/solver';

type Tab = 'energy' | 'waves' | 'spectrum' | 'momentum';
const WINDOW = 20; // [s] shown on the time graphs

export class EngGraphs {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private tab: Tab = 'energy';
  private t = 0;
  private hist: { t: number; ke: number; pe: number; px: number; pz: number }[] = [];
  private marks: { t: number; label: string }[] = [];
  private probe: { t: number; v: number }[] = [];
  private hov: ImageData | null = null;
  private hovRows = 0;
  private lastSlap: { x: number; t: number } | null = null;
  private acc = 0;
  open = false;

  constructor(private diag: Diagnostics, private solver: ShallowWaterSolver, private getRho: () => number, private getG: () => number) {
    const el = (this.el = document.createElement('div'));
    el.className = 'eng-graphs';
    el.innerHTML = `<div class="eng-tabs"></div><canvas></canvas><div class="eng-gnote"></div>`;
    const tabs = el.querySelector('.eng-tabs')!;
    for (const [k, label] of [['energy', 'Energy'], ['waves', 'Waves'], ['spectrum', 'Spectrum'], ['momentum', 'Momentum']] as [Tab, string][]) {
      const b = document.createElement('button');
      b.className = 'ui-chip';
      b.textContent = label;
      b.dataset.k = k;
      b.addEventListener('click', () => this.setTab(k));
      tabs.append(b);
    }
    this.canvas = el.querySelector('canvas')!;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.append(el);
    this.setTab('energy');
  }

  setOpen(o: boolean) {
    this.open = o;
    this.el.classList.toggle('open', o);
  }

  private setTab(k: Tab) {
    this.tab = k;
    this.el.querySelectorAll<HTMLButtonElement>('.eng-tabs .ui-chip').forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    const notes: Record<Tab, string> = {
      energy: 'Kinetic (blue) and potential (orange) energy of the puddle. Waves swap one for the other; bed friction slowly drains both.',
      waves: 'Surface along the puddle, time running downward. Each diagonal streak is a wave front: its slope is its speed. Dashed: √(gh).',
      spectrum: 'Frequencies at a wave probe in the middle of the puddle (last 8 s), and the wavelength each implies (λ = √(gh) / f).',
      momentum: 'Total momentum of the water, along (blue) and across (orange) the puddle. Slaps push it, walls reflect it, friction takes it away.',
    };
    this.el.querySelector('.eng-gnote')!.textContent = notes[k];
  }

  /** a slap happened: mark the energy it put in */
  slap(x: number, energy: number) {
    this.marks.push({ t: this.t, label: `+${(energy * 1000).toFixed(1)} mJ` });
    this.lastSlap = { x, t: this.t };
  }

  update(dt: number) {
    this.t += dt;
    if (!this.open) return;
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const tot = this.diag.totals(this.getRho(), this.getG(), this.solver.shapeSimTexture);
    this.hist.push({ t: this.t, ...tot });
    while (this.hist.length && this.hist[0].t < this.t - WINDOW) this.hist.shift();
    this.marks = this.marks.filter((m) => m.t > this.t - WINDOW);
    const row = this.diag.row();
    this.probe.push({ t: this.t, v: row[Math.floor(row.length / 2)] });
    while (this.probe.length && this.probe[0].t < this.t - 8.5) this.probe.shift();
    this.addHovRow(row);
    this.draw();
  }

  private size() {
    const dpr = Math.min(devicePixelRatio, 2);
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    if (this.canvas.width !== W * dpr || this.canvas.height !== H * dpr) {
      this.canvas.width = W * dpr;
      this.canvas.height = H * dpr;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }

  private addHovRow(row: Float32Array) {
    const W = 256, Hh = 120;
    if (!this.hov) this.hov = new ImageData(W, Hh);
    const d = this.hov.data;
    // scroll up one row
    d.copyWithin(0, W * 4);
    const scale = 0.002;
    for (let i = 0; i < W; i++) {
      const v = THREE.MathUtils.clamp(row[Math.floor((i / W) * row.length)] / scale, -1, 1);
      const o = ((Hh - 1) * W + i) * 4;
      // blue – white – red
      const c = v < 0 ? [245 + (41 - 245) * -v, 242 + (97 - 242) * -v, 237 + (189 - 237) * -v] : [245 + (204 - 245) * v, 242 + (56 - 242) * v, 237 + (46 - 237) * v];
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
    this.hovRows++;
  }

  private axes(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(36.5, 6.5, W - 44, H - 26);
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
  }

  private series(ctx: CanvasRenderingContext2D, W: number, H: number, vals: number[], ts: number[], lo: number, hi: number, color: string) {
    const x = (t: number) => 37 + ((t - (this.t - WINDOW)) / WINDOW) * (W - 45);
    const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (H - 26);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    vals.forEach((v, k) => (k ? ctx.lineTo(x(ts[k]), y(v)) : ctx.moveTo(x(ts[k]), y(v))));
    ctx.stroke();
  }

  private draw() {
    const { ctx, W, H } = this.size();
    this.axes(ctx, W, H);
    const ts = this.hist.map((h) => h.t);
    if (this.tab === 'energy') {
      const ke = this.hist.map((h) => h.ke * 1000), pe = this.hist.map((h) => h.pe * 1000);
      const hi = Math.max(0.05, ...ke.map((v, k) => v + pe[k])) * 1.1;
      this.series(ctx, W, H, ke.map((v, k) => v + pe[k]), ts, 0, hi, 'rgba(255,255,255,0.8)');
      this.series(ctx, W, H, ke, ts, 0, hi, '#6fb8f0');
      this.series(ctx, W, H, pe, ts, 0, hi, '#f0a05a');
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`${hi.toFixed(hi < 1 ? 2 : 1)} mJ`, 2, 14);
      ctx.fillText('0', 26, H - 20);
      for (const m of this.marks) {
        const x = 37 + ((m.t - (this.t - WINDOW)) / WINDOW) * (W - 45);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(x, 6, 1, H - 26);
        ctx.fillText(m.label, x + 3, 16);
      }
      const last = this.hist[this.hist.length - 1];
      if (last) ctx.fillText(`now: kinetic ${(last.ke * 1000).toFixed(2)} mJ · potential ${(last.pe * 1000).toFixed(2)} mJ`, 40, H - 6);
    } else if (this.tab === 'momentum') {
      const px = this.hist.map((h) => h.px * 1000), pz = this.hist.map((h) => h.pz * 1000);
      const m = Math.max(0.5, ...px.map(Math.abs), ...pz.map(Math.abs)) * 1.1;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(37, 6 + (H - 26) / 2);
      ctx.lineTo(W - 8, 6 + (H - 26) / 2);
      ctx.stroke();
      this.series(ctx, W, H, px, ts, -m, m, '#6fb8f0');
      this.series(ctx, W, H, pz, ts, -m, m, '#f0a05a');
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText(`${m.toFixed(1)}`, 4, 14);
      ctx.fillText(`−${m.toFixed(1)}`, 2, H - 20);
      ctx.fillText('g·m/s', 4, 26);
    } else if (this.tab === 'waves' && this.hov) {
      // draw the space–time image scaled into the plot area
      const off = document.createElement('canvas');
      off.width = this.hov.width;
      off.height = this.hov.height;
      off.getContext('2d')!.putImageData(this.hov, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 37, 6, W - 45, H - 26);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('← along the puddle →', W / 2 - 50, H - 6);
      ctx.fillText('4 s', 4, 14);
      // √(gh) reference from the last slap
      const s = this.lastSlap;
      if (s && this.t - s.t < 4) {
        const [ox] = this.solver.origin;
        const [ex] = this.solver.extent;
        const H0 = this.solver.depthAt(0, 0);
        const c = Math.sqrt(this.getG() * H0);
        const rowsPerSec = 30; // one image row per frame at ~30 Hz
        const px = (x: number) => 37 + ((x - ox) / ex) * (W - 45);
        const py = (age: number) => 6 + (H - 26) * (1 - (age * rowsPerSec) / this.hov!.height);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          const age = this.t - s.t;
          ctx.moveTo(px(s.x), py(age));
          ctx.lineTo(px(s.x + dir * c * age), py(0));
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillText(`√(gh) = ${c.toFixed(2)} m/s`, px(s.x) + 6, 30);
      }
    } else if (this.tab === 'spectrum') {
      // resample the probe at 30 Hz and take a DFT (Hann window)
      const N = 240;
      const t1 = this.t, t0 = t1 - 8;
      const x = new Float32Array(N);
      let j = 0;
      for (let k = 0; k < N; k++) {
        const t = t0 + (k / N) * 8;
        while (j < this.probe.length - 1 && this.probe[j + 1].t < t) j++;
        x[k] = (this.probe[j]?.v ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (N - 1)));
      }
      const fs = N / 8;
      const bins = 90; // up to 11 Hz
      const mag: number[] = [];
      for (let b = 1; b <= bins; b++) {
        let re = 0, im = 0;
        for (let k = 0; k < N; k++) {
          const a = (2 * Math.PI * b * k) / N;
          re += x[k] * Math.cos(a);
          im -= x[k] * Math.sin(a);
        }
        mag.push(Math.hypot(re, im));
      }
      const hi = Math.max(1e-7, ...mag);
      const bw = (W - 45) / bins;
      let peak = 0;
      mag.forEach((m, k) => {
        if (m > mag[peak]) peak = k;
        const h = (m / hi) * (H - 26);
        ctx.fillStyle = '#6fb8f0';
        ctx.fillRect(37 + k * bw, 6 + (H - 26) - h, Math.max(bw - 1, 1), h);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const f of [2, 4, 6, 8, 10]) ctx.fillText(`${f} Hz`, 37 + ((f * 8) / 1) * bw - 10, H - 6);
      const fpk = (peak + 1) / 8;
      const c = Math.sqrt(this.getG() * this.solver.depthAt(0, 0));
      if (hi > 1e-6) ctx.fillText(`peak ${fpk.toFixed(2)} Hz → wavelength ≈ ${((c / fpk) * 100).toFixed(0)} cm`, 40, 18);
      else ctx.fillText('slap or stir to make waves', 40, 18);
      void fs;
    }
  }
}
