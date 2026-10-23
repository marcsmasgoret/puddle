// A tiny canvas plotter for the validation page: axes, lines, dots, legend,
// linear or log scales. No dependencies.

export interface Series {
  label: string;
  points: [number, number][];
  color: string;
  kind: 'line' | 'dots' | 'dash';
}

export interface PlotSpec {
  xLabel: string;
  yLabel: string;
  xLog?: boolean;
  yLog?: boolean;
  series: Series[];
  /** fixed axis ranges (data units) */
  xRange?: [number, number];
  yRange?: [number, number];
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function niceTicks(lo: number, hi: number, log: boolean): number[] {
  if (log) {
    const t: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      const v = 10 ** e;
      if (v >= lo * 0.999 && v <= hi * 1.001) t.push(v);
    }
    return t;
  }
  const span = hi - lo;
  const step0 = 10 ** Math.floor(Math.log10(span / 5));
  const step = [1, 2, 5, 10].map((m) => m * step0).find((s) => span / s <= 6)!;
  const t: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) t.push(+v.toPrecision(10));
  return t;
}

const fmt = (v: number) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return v.toExponential(0).replace('e+', 'e');
  return String(+v.toPrecision(3));
};

export function plot(canvas: HTMLCanvasElement, spec: PlotSpec) {
  const dpr = Math.min(devicePixelRatio, 2);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const pts = spec.series.flatMap((s) => s.points).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const range = (vals: number[], log?: boolean, fixed?: [number, number]): [number, number] => {
    if (fixed) return fixed;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (log) {
      lo = 10 ** Math.floor(Math.log10(lo));
      hi = 10 ** Math.ceil(Math.log10(hi));
    } else {
      const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
      lo -= pad;
      hi += pad;
    }
    return [lo, hi];
  };
  const [x0, x1] = range(pts.map((p) => p[0]).filter((v) => !spec.xLog || v > 0), spec.xLog, spec.xRange);
  const [y0, y1] = range(pts.map((p) => p[1]).filter((v) => !spec.yLog || v > 0), spec.yLog, spec.yRange);

  const m = { l: 58, r: 14, t: 12, b: 40 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const tx = (v: number) => m.l + pw * (spec.xLog ? Math.log(v / x0) / Math.log(x1 / x0) : (v - x0) / (x1 - x0));
  const ty = (v: number) => m.t + ph * (1 - (spec.yLog ? Math.log(v / y0) / Math.log(y1 / y0) : (v - y0) / (y1 - y0)));

  const ink = css('--ink'), faint = css('--faint'), grid = css('--grid');
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
  ctx.lineWidth = 1;
  // grid + tick labels
  ctx.fillStyle = faint;
  ctx.strokeStyle = grid;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of niceTicks(x0, x1, !!spec.xLog)) {
    const X = tx(v);
    ctx.beginPath();
    ctx.moveTo(X, m.t);
    ctx.lineTo(X, m.t + ph);
    ctx.stroke();
    ctx.fillText(fmt(v), X, m.t + ph + 5);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of niceTicks(y0, y1, !!spec.yLog)) {
    const Y = ty(v);
    ctx.beginPath();
    ctx.moveTo(m.l, Y);
    ctx.lineTo(m.l + pw, Y);
    ctx.stroke();
    ctx.fillText(fmt(v), m.l - 6, Y);
  }
  ctx.strokeStyle = faint;
  ctx.strokeRect(m.l, m.t, pw, ph);
  // axis labels
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(spec.xLabel, m.l + pw / 2, H - 2);
  ctx.save();
  ctx.translate(12, m.t + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.yLabel, 0, 0);
  ctx.restore();

  // data
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.l, m.t, pw, ph);
  ctx.clip();
  for (const s of spec.series) {
    const p = s.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!spec.xLog || x > 0) && (!spec.yLog || y > 0));
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    if (s.kind === 'dots') {
      for (const [x, y] of p) {
        ctx.beginPath();
        ctx.arc(tx(x), ty(y), 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.lineWidth = 1.6;
      ctx.setLineDash(s.kind === 'dash' ? [5, 4] : []);
      ctx.beginPath();
      p.forEach(([x, y], i) => (i ? ctx.lineTo(tx(x), ty(y)) : ctx.moveTo(tx(x), ty(y))));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();

  // legend
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let ly = m.t + 12;
  for (const s of spec.series) {
    const lx = m.l + 10;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    if (s.kind === 'dots') {
      ctx.beginPath();
      ctx.arc(lx + 8, ly, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 1.6;
      ctx.setLineDash(s.kind === 'dash' ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 16, ly);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = ink;
    ctx.fillText(s.label, lx + 24, ly);
    ly += 16;
  }
}
