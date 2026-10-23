// The geometry half of sculpt.ts: signed distance field, Surface Nets
// meshing and automatic skin weights. No three.js here, so it can run in a
// Web Worker (sculptWorker.ts) and keep the page smooth while animals are
// being built.

export type V3 = [number, number, number];

export type Prim =
  | { kind: 'ellipsoid'; bone: string; c: V3; r: V3; blend?: number }
  | { kind: 'capsule'; bone: string; a: V3; b: V3; ra: number; rb: number; blend?: number };

export interface MeshSpec {
  name: string;
  bones: { name: string }[];
  prims: Prim[];
  voxel: number;
}

export interface MeshData {
  pos: Float32Array;
  nrm: Float32Array;
  index: Uint32Array;
  si: Uint16Array;
  sw: Float32Array;
}

// ── signed distance functions (Inigo Quilez's forms) ────────────────────────
function sdEllipsoid(px: number, py: number, pz: number, r: V3) {
  const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...r);
}
function sdRoundCone(px: number, py: number, pz: number, a: V3, b: V3, r1: number, r2: number) {
  // tapered capsule from a (radius r1) to b (radius r2)
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = (pax * l2 - bax * y) ** 2 + (pay * l2 - bay * y) ** 2 + (paz * l2 - baz * y) ** 2;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * xx;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(xx + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(xx + y2) * il2 - r1;
  return (Math.sqrt(xx * a2 * il2) + y * rr) * il2 - r1;
}
function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function primDist(p: Prim, x: number, y: number, z: number) {
  if (p.kind === 'ellipsoid') return sdEllipsoid(x - p.c[0], y - p.c[1], z - p.c[2], p.r);
  return sdRoundCone(x, y, z, p.a, p.b, p.ra, p.rb);
}

/** bounding sphere of each primitive, to skip far ones quickly */
const sphereCache = new WeakMap<Prim[], Float32Array>();
function spheres(prims: Prim[]) {
  let s = sphereCache.get(prims);
  if (s) return s;
  s = new Float32Array(prims.length * 4);
  prims.forEach((p, i) => {
    if (p.kind === 'ellipsoid') s!.set([p.c[0], p.c[1], p.c[2], Math.max(...p.r)], i * 4);
    else {
      const c: V3 = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2];
      const half = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]) / 2;
      s!.set([...c, half + Math.max(p.ra, p.rb)], i * 4);
    }
  });
  sphereCache.set(prims, s);
  return s;
}

function field(prims: Prim[], x: number, y: number, z: number) {
  const sp = spheres(prims);
  let d = Infinity;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    const k = p.blend ?? 0.012;
    // a lower bound on this primitive's distance: too far to matter? skip
    const lb = Math.hypot(x - sp[i * 4], y - sp[i * 4 + 1], z - sp[i * 4 + 2]) - sp[i * 4 + 3];
    if (lb > d + k) continue;
    d = smin(d, primDist(p, x, y, z), k);
  }
  return d;
}

function bounds(prims: Prim[]) {
  const lo = { x: Infinity, y: Infinity, z: Infinity }, hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  const add = (c: V3, r: number) => {
    lo.x = Math.min(lo.x, c[0] - r); lo.y = Math.min(lo.y, c[1] - r); lo.z = Math.min(lo.z, c[2] - r);
    hi.x = Math.max(hi.x, c[0] + r); hi.y = Math.max(hi.y, c[1] + r); hi.z = Math.max(hi.z, c[2] + r);
  };
  for (const p of prims) {
    if (p.kind === 'ellipsoid') add(p.c, Math.max(...p.r));
    else {
      add(p.a, p.ra);
      add(p.b, p.rb);
    }
  }
  return { lo, hi };
}

/** Surface Nets: one vertex per surface cell, one quad per crossing edge. */
function mesh(spec: MeshSpec) {
  const h = spec.voxel;
  const { lo, hi } = bounds(spec.prims);
  const pad = 2 * h + 0.01;
  lo.x -= pad; lo.y -= pad; lo.z -= pad;
  hi.x += pad; hi.y += pad; hi.z += pad;
  const nx = Math.ceil((hi.x - lo.x) / h) + 1, ny = Math.ceil((hi.y - lo.y) / h) + 1, nz = Math.ceil((hi.z - lo.z) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) F[idx(i, j, k)] = field(spec.prims, lo.x + i * h, lo.y + j * h, lo.z + k * h);

  const vid = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const v = corners.map(([a, b, c]) => F[idx(i + a, j + b, k + c)]);
        let inside = 0;
        for (const x of v) if (x < 0) inside++;
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [e0, e1] of edges) {
          const a = v[e0], b = v[e1];
          if ((a < 0) === (b < 0)) continue;
          const t = a / (a - b);
          const c0 = corners[e0], c1 = corners[e1];
          sx += c0[0] + (c1[0] - c0[0]) * t;
          sy += c0[1] + (c1[1] - c0[1]) * t;
          sz += c0[2] + (c1[2] - c0[2]) * t;
          n++;
        }
        vid[idx(i, j, k)] = pos.length / 3;
        pos.push(lo.x + (i + sx / n) * h, lo.y + (j + sy / n) * h, lo.z + (k + sz / n) * h);
      }
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const f0 = F[idx(i, j, k)] < 0;
        if (f0 !== F[idx(i + 1, j, k)] < 0)
          quad(vid[idx(i, j - 1, k - 1)], vid[idx(i, j, k - 1)], vid[idx(i, j, k)], vid[idx(i, j - 1, k)], f0);
        if (f0 !== F[idx(i, j + 1, k)] < 0)
          quad(vid[idx(i - 1, j, k - 1)], vid[idx(i - 1, j, k)], vid[idx(i, j, k)], vid[idx(i, j, k - 1)], f0);
        if (f0 !== F[idx(i, j, k + 1)] < 0)
          quad(vid[idx(i - 1, j - 1, k)], vid[idx(i, j - 1, k)], vid[idx(i, j, k)], vid[idx(i - 1, j, k)], f0);
      }

  // orient every triangle outward (along the field gradient)
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const cx = (pos[a] + pos[b] + pos[c]) / 3, cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    const e0 = h * 0.5;
    const gx = field(spec.prims, cx + e0, cy, cz) - field(spec.prims, cx - e0, cy, cz);
    const gy = field(spec.prims, cx, cy + e0, cz) - field(spec.prims, cx, cy - e0, cz);
    const gz = field(spec.prims, cx, cy, cz + e0) - field(spec.prims, cx, cy, cz - e0);
    if (fx * gx + fy * gy + fz * gz < 0) {
      const tmp = index[t + 1];
      index[t + 1] = index[t + 2];
      index[t + 2] = tmp;
    }
  }

  // project onto the true surface and take normals from the field gradient
  const nrm = new Float32Array(pos.length);
  const e = h * 0.25;
  for (let v = 0; v < pos.length; v += 3) {
    let x = pos[v], y = pos[v + 1], z = pos[v + 2];
    for (let it = 0; it < 2; it++) {
      const d = field(spec.prims, x, y, z);
      const gx = field(spec.prims, x + e, y, z) - field(spec.prims, x - e, y, z);
      const gy = field(spec.prims, x, y + e, z) - field(spec.prims, x, y - e, z);
      const gz = field(spec.prims, x, y, z + e) - field(spec.prims, x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      x -= (d * gx) / gl;
      y -= (d * gy) / gl;
      z -= (d * gz) / gl;
      nrm[v] = gx / gl;
      nrm[v + 1] = gy / gl;
      nrm[v + 2] = gz / gl;
    }
    pos[v] = x;
    pos[v + 1] = y;
    pos[v + 2] = z;
  }
  return { pos: new Float32Array(pos), nrm, index };
}

/** Skin weights: each vertex follows the bones whose primitives it lies on. */
function weights(spec: MeshSpec, pos: Float32Array, boneIndex: Map<string, number>) {
  const n = pos.length / 3;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const fall = spec.voxel * 2.5;
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const per = new Map<number, number>();
    for (const p of spec.prims) {
      const d = Math.max(primDist(p, x, y, z), 0);
      const w = Math.exp(-d / fall);
      const b = boneIndex.get(p.bone)!;
      per.set(b, (per.get(b) ?? 0) + w);
    }
    const top = [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, t) => a + t[1], 0) || 1;
    top.forEach(([b, w], k) => {
      si[v * 4 + k] = b;
      sw[v * 4 + k] = w / sum;
    });
  }
  return { si, sw };
}

export function buildMeshData(spec: MeshSpec): MeshData {
  const boneIndex = new Map(spec.bones.map((b, i) => [b.name, i]));
  const m = mesh(spec);
  const { si, sw } = weights(spec, m.pos, boneIndex);
  return { pos: m.pos, nrm: m.nrm, index: new Uint32Array(m.index), si, sw };
}
