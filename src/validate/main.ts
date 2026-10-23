// The validation page: runs every test on this device's GPU and shows the
// results next to the theory they are checked against.
import '../docs/docs.css';
import * as THREE from 'three';
import { Bench, waveSpeed, dispersion, damping, volume, damBreak } from './tests';
import { plot } from './plot';

const params = new URLSearchParams(location.search);
const cells = Math.max(64, Math.min(1024, parseInt(params.get('grid') ?? '512', 10) || 512));

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const results = $('#results');
const status = $('#status');
const bar = $<HTMLDivElement>('#bar > div');
const color = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function section(title: string, about: string) {
  const card = document.createElement('section');
  card.className = 'card';
  card.innerHTML = `<h3>${title}</h3><p class="small">${about}</p>`;
  results.append(card);
  return card;
}
function chart(card: HTMLElement) {
  const c = document.createElement('canvas');
  c.className = 'chart';
  card.append(c);
  return c;
}
function table(card: HTMLElement, head: string[], rows: (string | number)[][]) {
  const t = document.createElement('table');
  t.innerHTML = `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  card.append(t);
}
function verdict(card: HTMLElement, ok: boolean, text: string) {
  const p = document.createElement('p');
  p.className = `verdict ${ok ? 'ok' : 'warn'}`;
  p.textContent = text;
  card.append(p);
}
const pct = (a: number, b: number) => {
  const e = ((a - b) / b) * 100;
  return `${e < 0 ? '−' : '+'}${Math.abs(e).toFixed(2)} %`;
};
const redraw: (() => void)[] = [];
addEventListener('resize', () => redraw.forEach((f) => f()));

async function run() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  if (!renderer.extensions.has('EXT_color_buffer_float')) {
    status.textContent = 'This GPU cannot render to float textures, so the solver runs in half precision here and the tests would not be meaningful.';
    return;
  }
  const bench = new Bench(renderer, cells);
  $('#gridinfo').textContent = `${bench.grid.nx} × ${bench.grid.nz} cells, Δx = ${(bench.grid.dx * 1000).toFixed(2)} mm`;
  const steps = 5;
  let stage = 0;
  const progress = (label: string, f: number) => {
    status.textContent = `Running: ${label}…`;
    bar.style.width = `${((stage + f) / steps) * 100}%`;
  };
  const t0 = performance.now();
  const all: Record<string, unknown> = { grid: bench.grid };

  // 1 ─ wave speed
  const speed = await waveSpeed(bench, progress);
  all.waveSpeed = speed;
  stage++;
  {
    const card = section(
      '1. Wave speed',
      'A long, low ridge of water in a flat tank splits into two pulses. Shallow-water theory says each travels at c = √(gH). The ridge is tracked to sub-cell precision and its speed fitted over its run.',
    );
    const c = chart(card);
    const draw = () =>
      plot(c, {
        xLabel: 'theory √(gH)  [m/s]',
        yLabel: 'measured  [m/s]',
        xRange: [0, 0.6],
        yRange: [0, 0.6],
        series: [
          { label: 'measured = theory', points: [[0, 0], [0.6, 0.6]], color: color('--faint'), kind: 'dash' },
          { label: 'simulation', points: speed.map((r) => [r.theory, r.measured]), color: color('--accent'), kind: 'dots' },
        ],
      });
    draw();
    redraw.push(draw);
    table(card, ['Depth H', '√(gH)', 'Measured', 'Error'], speed.map((r) => [`${r.H * 1000} mm`, `${r.theory.toFixed(4)} m/s`, `${r.measured.toFixed(4)} m/s`, pct(r.measured, r.theory)]));
    const worst = Math.max(...speed.map((r) => Math.abs(r.measured / r.theory - 1)));
    verdict(card, worst < 0.02, `Largest error ${(worst * 100).toFixed(2)} %.`);
  }

  // 2 ─ dispersion
  const disp = await dispersion(bench, progress);
  all.dispersion = disp;
  stage++;
  {
    const card = section(
      '2. Dispersion: gravity waves to capillary ripples',
      'Standing waves η = A cos(kx) in water 1 cm deep, from tank-length waves down to ripples a few cells long. Long waves are gravity waves, short ones are held up by surface tension and travel faster. Dots: measured frequencies. Grey line: what the discrete scheme should give. Dashed: the continuum shallow-water relation ω² = Hk²(g + σk²/ρ). Orange: full linear water-wave theory, for comparison.',
    );
    const c = chart(card);
    const k0 = disp[0].k * 0.8, k1 = disp[disp.length - 1].k * 1.15;
    const ks = Array.from({ length: 80 }, (_, i) => k0 * (k1 / k0) ** (i / 79));
    const H = 0.01, sr = 0.07274 / 998.21;
    const draw = () =>
      plot(c, {
        xLabel: 'wavenumber k  [1/m]',
        yLabel: 'angular frequency ω  [rad/s]',
        xLog: true,
        yLog: true,
        series: [
          { label: 'shallow-water theory', points: ks.map((k) => [k, Math.sqrt(H * k * k * (9.81 + sr * k * k))]), color: color('--faint'), kind: 'dash' },
          { label: 'full linear theory (Airy)', points: ks.map((k) => [k, Math.sqrt((9.81 * k + sr * k ** 3) * Math.tanh(k * H))]), color: color('--accent2'), kind: 'line' },
          { label: 'discrete scheme (expected)', points: disp.map((r) => [r.k, r.discrete]), color: color('--soft'), kind: 'line' },
          { label: 'simulation', points: disp.map((r) => [r.k, r.measured]), color: color('--accent'), kind: 'dots' },
        ],
      });
    draw();
    redraw.push(draw);
    table(
      card,
      ['Mode', 'Wavelength', 'Measured ω', 'Scheme', 'Error', 'SWE theory', 'Airy'],
      disp.map((r) => [r.m, `${((2 * Math.PI) / r.k * 100).toFixed(1)} cm`, r.measured.toFixed(3), r.discrete.toFixed(3), pct(r.measured, r.discrete), r.swe.toFixed(3), r.airy.toFixed(3)]),
    );
    const worst = Math.max(...disp.map((r) => Math.abs(r.measured / r.discrete - 1)));
    verdict(card, worst < 0.02, `The solver matches its own discrete dispersion relation to within ${(worst * 100).toFixed(2)} %. The gap to the theory curves at short wavelengths is grid resolution (and, against Airy, the shallow-water approximation itself).`);
  }

  // 3 ─ damping
  const damp = await damping(bench, progress);
  all.damping = damp;
  stage++;
  {
    const card = section(
      '3. Damping by the bed',
      'Standing waves lose energy to friction at the floor. In thin, water-like fluids the shear sits in a Stokes boundary layer, c_f = √(νω/2)/h; in honey the whole layer is viscous, c_f = 3ν/h², and the waves are overdamped: the surface levels like a diffusion with D = gh³/3ν. Predicted decay rates come from the damped oscillator with that friction.',
    );
    const c = chart(card);
    const lo = Math.min(...damp.map((r) => Math.min(r.predicted, r.measured))) * 0.5;
    const hi = Math.max(...damp.map((r) => Math.max(r.predicted, r.measured))) * 2;
    const draw = () =>
      plot(c, {
        xLabel: 'predicted decay rate  [1/s]',
        yLabel: 'measured  [1/s]',
        xLog: true,
        yLog: true,
        xRange: [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))],
        yRange: [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))],
        series: [
          { label: 'measured = predicted', points: [[1e-4, 1e-4], [1e3, 1e3]], color: color('--faint'), kind: 'dash' },
          { label: 'Stokes layer (water-like)', points: damp.filter((r) => r.regime === 'stokes').map((r) => [r.predicted, r.measured]), color: color('--accent'), kind: 'dots' },
          { label: 'Poiseuille (honey)', points: damp.filter((r) => r.regime === 'poiseuille').map((r) => [r.predicted, r.measured]), color: color('--accent2'), kind: 'dots' },
        ],
      });
    draw();
    redraw.push(draw);
    table(
      card,
      ['Regime', 'ν [m²/s]', 'Depth', 'c_f [1/s]', 'Predicted', 'Measured', 'Error'],
      damp.map((r) => [r.regime === 'stokes' ? 'Stokes layer' : 'Poiseuille', r.nu.toExponential(1), `${r.H * 1000} mm`, r.frictionLaw.toPrecision(3), r.predicted.toPrecision(3), r.measured.toPrecision(3), pct(r.measured, r.predicted)]),
    );
    const worst = Math.max(...damp.map((r) => Math.abs(r.measured / r.predicted - 1)));
    verdict(card, worst < 0.05, `Largest error ${(worst * 100).toFixed(1)} %.`);
  }

  // 4 ─ volume
  const vol = await volume(bench, progress);
  all.volume = vol;
  stage++;
  {
    const card = section(
      '4. Volume conservation under abuse',
      'Twenty very hard slaps (a 6 cm hand at 5 m/s, with the Froude cap and spray turned off) in the real puddle bowl. The flow runs far past Froude 1 and the positivity limiter has to stop cells draining below empty. Total volume should stay constant to round-off and depth should never go negative.',
    );
    const c = chart(card);
    const cols = ['--accent', '--accent2', '--soft', '--good'];
    const draw = () =>
      plot(c, {
        xLabel: 'time  [s]',
        yLabel: 'volume change  [mL]',
        series: vol.map((r, i) => ({ label: r.fluid, points: r.series, color: color(cols[i]), kind: 'line' as const })),
      });
    draw();
    redraw.push(draw);
    table(
      card,
      ['Fluid', 'Puddle volume', 'Slaps', 'Largest drift', 'Relative', 'Shallowest depth', 'NaN cells'],
      vol.map((r) => [r.fluid, `${(r.puddleMl / 1000).toFixed(2)} L`, r.slaps, `${r.maxDriftMl.toExponential(1)} mL`, r.relDrift.toExponential(1), `${r.minDepthMm.toFixed(3)} mm`, r.nan]),
    );
    const worst = Math.max(...vol.map((r) => r.relDrift));
    const neg = Math.min(...vol.map((r) => r.minDepthMm));
    verdict(card, worst < 1e-5 && neg >= 0 && vol.every((r) => r.nan === 0), `Worst relative drift ${worst.toExponential(1)}; depth never below ${neg.toFixed(3)} mm.`);
  }

  // 5 ─ dam break
  const dam = await damBreak(bench, progress);
  all.damBreak = dam;
  stage++;
  {
    const card = section(
      '5. Dam break (nonlinear)',
      `A wall holding 20 mm of water against 5 mm vanishes. Stoker's exact solution has a rarefaction running back into the deep side and a bore running into the shallow side, with a flat ${(dam.hm * 1000).toFixed(2)} mm state between. This tests the nonlinear terms, the upwinding and the breaking model.`,
    );
    const c = chart(card);
    const draw = () =>
      plot(c, {
        xLabel: 'distance from the dam  [m]',
        yLabel: 'depth  [mm]',
        xRange: [-0.5, 0.6],
        series: dam.profiles.flatMap((p, i) => [
          { label: `exact, t = ${p.t} s`, points: p.x.map((x, k) => [x, p.exact[k] * 1000] as [number, number]), color: color(i ? '--accent2' : '--accent'), kind: 'dash' as const },
          { label: `simulation, t = ${p.t} s`, points: p.x.map((x, k) => [x, p.sim[k] * 1000] as [number, number]), color: color(i ? '--accent2' : '--accent'), kind: 'line' as const },
        ]),
      });
    draw();
    redraw.push(draw);
    table(
      card,
      ['Time', 'Bore position (sim)', 'Exact', 'Error', 'Profile L1 error'],
      dam.profiles.map((p) => [`${p.t} s`, `${(p.shockSim * 100).toFixed(1)} cm`, `${(p.shockExact * 100).toFixed(1)} cm`, pct(p.shockSim, p.shockExact), `${(p.l1 * 100).toFixed(1)} %`]),
    );
    const worst = Math.max(...dam.profiles.map((p) => Math.abs(p.shockSim / p.shockExact - 1)));
    verdict(card, worst < 0.05, `Bore position within ${(worst * 100).toFixed(1)} % of Stoker's solution.`);
  }

  bar.style.width = '100%';
  const secs = (performance.now() - t0) / 1000;
  status.textContent = `Done in ${secs.toFixed(0)} s on this device.`;
  all.seconds = secs;
  (window as unknown as { __validation: unknown }).__validation = all;
  renderer.dispose();
}

run().catch((e) => {
  status.textContent = `Failed: ${e instanceof Error ? e.message : e}`;
  (window as unknown as { __validation: unknown }).__validation = { error: String(e) };
  throw e;
});
