// Rafts of solid crust on a lava puddle. Each plate is a rigid slab of
// basalt a few millimetres thick: it keeps its outline, and moves only as a
// whole, translating with the melt under its centre and turning with the
// melt's local spin (half its vorticity, ½ ∂u/∂z − ½ ∂v/∂x). Plates do not
// pass through each other: overlapping plates are pushed apart and lose
// their closing speed, so a slap shoves them outward into a jostling ring
// and opens a patch of glowing melt, which slowly closes again as the plates
// spread back out (a weak repulsion between close neighbours) and the lake's
// slow convection keeps them drifting.
//
// Each plate rides the surface as a rigid plane fitted to η across its
// footprint (four samples a plate-radius out), so it rocks gently on a
// passing wave instead of bending with it or following every short ripple.
// Plates that get shoved together override, one riding up over the other.
import * as THREE from 'three';
import { FluidSampler, SAMPLER_CAPACITY } from '../physics/fluidSampler';
import type { ShallowWaterSolver } from '../physics/solver';

const MAX_PLATES = Math.floor(SAMPLER_CAPACITY / 3);
const MAX_SIDES = 8;
const VERTS = 1 + 3 * MAX_SIDES; // centre, inner ring, top rim, bottom rim
const TOP = 0.0025; // [m] plate top above the melt surface
const BOTTOM = -0.004; // [m] its underside, hidden in the melt
const TAU = 0.25; // [s] how quickly a plate takes up the melt's motion

interface Plate {
  x: number;
  z: number;
  a: number; // heading [rad] about +y
  vx: number;
  vz: number;
  w: number; // spin [rad/s]
  /** collision radius [m] */
  r: number;
  /** outline in the plate's own frame */
  ang: number[];
  rad: number[];
  seed: number;
}

export class LavaPlates {
  readonly mesh: THREE.Mesh;
  private plates: Plate[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private centre: Float32Array;
  private local: Float32Array;
  private sampler: FluidSampler;
  private xz = new Float32Array(SAMPLER_CAPACITY * 2);
  private probe = 0.03; // [m] spacing of the spin samples
  private t = 0;
  enabled = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    private solver: ShallowWaterSolver,
    /** the water mesh's uniforms: surface, lighting and crust colour are shared */
    u: Record<string, THREE.IUniform>,
  ) {
    this.sampler = new FluidSampler(renderer, () => solver.stateTexture, [solver.grid.nx, solver.grid.nz], solver.origin, solver.grid.dx);
    const n = MAX_PLATES * VERTS;
    this.pos = new Float32Array(n * 3);
    this.centre = new Float32Array(n * 2);
    this.local = new Float32Array(n * 2);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aCentre', new THREE.BufferAttribute(this.centre, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aLocal', new THREE.BufferAttribute(this.local, 2));
    this.geo.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('aRad', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSurface: u.uSurface,
        uOrigin: u.uOrigin,
        uExtent: u.uExtent,
        uSunDir: u.uSunDir,
        uSunColor: u.uSunColor,
        uAmbient: u.uAmbient,
        uCrustColor: u.uCrustColor,
      },
      vertexShader: /* glsl */ `
        uniform sampler2D uSurface;
        uniform vec2 uOrigin, uExtent;
        attribute vec2 aCentre, aLocal;
        attribute float aEdge, aSide, aSeed, aRad;
        varying vec3 vWPos, vN;
        varying vec2 vLocal;
        varying float vEdge, vSide, vSeed, vDepth;
        float eta(vec2 xz) { return texture2D(uSurface, (xz - uOrigin) / uExtent).r; }
        void main() {
          // a rigid plane fitted to the surface across the plate
          float R = aRad;
          float e = eta(aCentre + vec2(R, 0.0)), w = eta(aCentre - vec2(R, 0.0));
          float nn = eta(aCentre + vec2(0.0, R)), ss = eta(aCentre - vec2(0.0, R));
          float h = 0.5 * eta(aCentre) + 0.125 * (e + w + nn + ss);
          vec2 sl = clamp(vec2(e - w, nn - ss) / (2.0 * R), -0.2, 0.2);
          vec2 r = position.xz - aCentre;
          // each plate a hair higher or lower, so overriding plates stack
          vec3 p = vec3(position.x, h + dot(sl, r) + position.y + aSeed * 0.0015, position.z);
          vec3 up = normalize(vec3(-sl.x, 1.0, -sl.y));
          vN = aSide > 0.5 ? normalize(vec3(r.x, 0.0, r.y)) : up;
          vWPos = p;
          vLocal = aLocal;
          vEdge = aEdge;
          vSide = aSide;
          vSeed = aSeed;
          vDepth = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir, uSunColor, uAmbient, uCrustColor;
        varying vec3 vWPos, vN;
        varying vec2 vLocal;
        varying float vEdge, vSide, vSeed, vDepth;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        vec3 blackbody(float T) {
          float t = clamp((T - 800.0) / 800.0, 0.0, 1.0);
          return vec3(1.0, 0.08 + 0.55 * t * t + 0.1 * t, 0.005 + 0.2 * t * t * t);
        }
        void main() {
          vec3 V = normalize(cameraPosition - vWPos);
          // ropy pāhoehoe skin, fixed to the plate (it turns with it), and
          // each plate tilted a touch its own way so they read as pieces
          float tilt = vSeed * 6.283;
          vec3 n = vN;
          if (vSide < 0.5) {
            vec2 b = vec2(vnoise(vLocal * 140.0), vnoise(vLocal * 140.0 + 7.0)) - 0.5;
            float rope = sin(vLocal.x * 260.0 + 3.0 * vnoise(vLocal * 40.0)) * 0.5;
            n = normalize(n + vec3(cos(tilt), 0.0, sin(tilt)) * 0.1 + vec3(b.x + rope * 0.3, 0.0, b.y) * 0.22);
          }
          float NdL = max(dot(n, uSunDir), 0.0);
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(n, H), 0.0), 40.0) * 0.6;
          float F = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);
          vec3 col = uCrustColor * (uAmbient * 0.6 + uSunColor * NdL * 0.5) * (1.0 + 0.35 * (vnoise(vLocal * 30.0 + vSeed * 50.0) - 0.5))
                   + uSunColor * spec * NdL * 0.15 + uAmbient * F * 0.12;
          // the rim is thinner and still hot: a dull red glow toward the
          // edge, and an incandescent side where the melt wets it
          float edge = 1.0 - smoothstep(0.0, 1.0, vEdge);
          col += blackbody(950.0) * edge * edge * 0.3 * (1.0 - vSide);
          if (vSide > 0.5) {
            float hot = smoothstep(${TOP.toFixed(4)}, ${BOTTOM.toFixed(4)}, vDepth);
            col = mix(col * 0.6, blackbody(1150.0) * 1.4, hot);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; // over the melt
    this.mesh.visible = false;
  }

  /**
   * A freshly poured puddle: the crust has cracked into plates that tile it,
   * cells of a Voronoi tiling of jittered seeds (cooling cracks meet at
   * roughly 120°), each pulled in a little from its neighbours to open a
   * crack. A few plates are missing, where the melt wells up.
   */
  restart() {
    const s = this.solver;
    const hx = s.shape.halfX, hz = s.shape.halfZ;
    let inside = 0;
    const g = 0.02;
    for (let x = -hx; x <= hx; x += g) for (let z = -hz; z <= hz; z += g) if (s.sdfAt(x, z) < 0) inside++;
    const area = inside * g * g;
    // ~10 cm plates on a normal puddle; larger ones if there would be too many
    const spacing = Math.max(0.095, Math.sqrt(((area / (MAX_PLATES * 0.85)) * 2) / Math.sqrt(3)));
    this.probe = spacing * 0.3;
    // jittered hex seeds over the whole puddle and a margin around it
    const seeds: [number, number][] = [];
    for (let j = 0, z = -hz - spacing; z <= hz + spacing; j++, z += spacing * 0.866)
      for (let x = -hx - spacing + (j % 2) * spacing * 0.5; x <= hx + spacing; x += spacing)
        seeds.push([x + (Math.random() - 0.5) * spacing * 0.7, z + (Math.random() - 0.5) * spacing * 0.7]);
    const plates: Plate[] = [];
    for (const [sx, sz] of seeds) {
      if (plates.length >= MAX_PLATES) break;
      if (s.sdfAt(sx, sz) > -spacing * 0.3) continue;
      // the cell: a square clipped by the bisector with every near seed
      let poly: [number, number][] = [[sx - 2 * spacing, sz - 2 * spacing], [sx + 2 * spacing, sz - 2 * spacing], [sx + 2 * spacing, sz + 2 * spacing], [sx - 2 * spacing, sz + 2 * spacing]];
      for (const [nx, nz] of seeds) {
        const dx = nx - sx, dz = nz - sz;
        if ((dx === 0 && dz === 0) || dx * dx + dz * dz > 6 * spacing * spacing) continue;
        const mx = (sx + nx) / 2, mz = (sz + nz) / 2;
        const keep = (p: [number, number]) => (p[0] - mx) * dx + (p[1] - mz) * dz <= 0;
        const out: [number, number][] = [];
        for (let k = 0; k < poly.length; k++) {
          const a = poly[k], b = poly[(k + 1) % poly.length];
          const ka = keep(a), kb = keep(b);
          if (ka) out.push(a);
          if (ka !== kb) {
            const da = (a[0] - mx) * dx + (a[1] - mz) * dz, db = (b[0] - mx) * dx + (b[1] - mz) * dz;
            const t = da / (da - db);
            out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          }
        }
        poly = out;
      }
      // at most MAX_SIDES corners: merge the shortest edges away
      while (poly.length > MAX_SIDES) {
        let best = 0, bl = Infinity;
        for (let k = 0; k < poly.length; k++) {
          const a = poly[k], b = poly[(k + 1) % poly.length];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (l < bl) (bl = l), (best = k);
        }
        const a = poly[best], b = poly[(best + 1) % poly.length];
        poly.splice(best, 1);
        poly[best % poly.length] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      }
      // a crack: the plate is drawn in from the cell's edges
      const cx = poly.reduce((t, p) => t + p[0], 0) / poly.length, cz = poly.reduce((t, p) => t + p[1], 0) / poly.length;
      const keepFrac = 1 - (0.06 + Math.random() * 0.07);
      const pts = poly.map(([x, z]) => [cx + (x - cx) * keepFrac, cz + (z - cz) * keepFrac] as [number, number]);
      if (pts.some(([x, z]) => s.sdfAt(x, z) > -0.008)) continue;
      if (Math.random() < 0.05) continue; // an upwelling: open melt
      const ang: number[] = [], rad: number[] = [];
      for (const [x, z] of pts) {
        // heading convention of writeVertices: world = R_y(a)·local, a = 0 here
        ang.push(Math.atan2(z - cz, x - cx));
        rad.push(Math.hypot(x - cx, z - cz));
      }
      const r = (rad.reduce((a, b) => a + b, 0) / rad.length) * 0.82;
      plates.push({ x: cx, z: cz, a: 0, vx: 0, vz: 0, w: 0, r, ang, rad, seed: Math.random() });
    }
    this.plates = plates;
    this.buildTopology();
  }

  private buildTopology() {
    const idx: number[] = [];
    const edge = this.geo.attributes.aEdge.array as Float32Array;
    const side = this.geo.attributes.aSide.array as Float32Array;
    const seed = this.geo.attributes.aSeed.array as Float32Array;
    const rads = this.geo.attributes.aRad.array as Float32Array;
    edge.fill(0);
    side.fill(0);
    this.plates.forEach((p, i) => {
      const o = i * VERTS, n = p.ang.length;
      const inner = o + 1, rim = o + 1 + MAX_SIDES, bot = o + 1 + 2 * MAX_SIDES;
      edge[o] = 1;
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n;
        edge[inner + k] = 0.8;
        side[bot + k] = 1;
        idx.push(o, inner + k1, inner + k);
        idx.push(inner + k, inner + k1, rim + k1, inner + k, rim + k1, rim + k);
        idx.push(rim + k, rim + k1, bot + k1, rim + k, bot + k1, bot + k);
      }
      const R = p.rad.reduce((a, b) => a + b, 0) / n;
      for (let k = 0; k < VERTS; k++) {
        seed[o + k] = p.seed;
        rads[o + k] = R;
      }
    });
    // the wall shares the top rim's vertices, so its upper edge blends from
    // the top face's shading into the hot side: it reads as a bevel
    this.geo.setIndex(idx);
    this.geo.attributes.aEdge.needsUpdate = true;
    this.geo.attributes.aSide.needsUpdate = true;
    this.geo.attributes.aSeed.needsUpdate = true;
    this.geo.attributes.aRad.needsUpdate = true;
    this.writeVertices(true);
  }

  private writeVertices(withLocal = false) {
    const P = this.pos, C = this.centre, L = this.local;
    this.plates.forEach((p, i) => {
      const o = i * VERTS, n = p.ang.length;
      const c = Math.cos(p.a), s = Math.sin(p.a);
      const put = (v: number, lx: number, lz: number, y: number) => {
        P[v * 3] = p.x + lx * c + lz * s;
        P[v * 3 + 1] = y;
        P[v * 3 + 2] = p.z - lx * s + lz * c;
        C[v * 2] = p.x;
        C[v * 2 + 1] = p.z;
        if (withLocal) {
          L[v * 2] = lx + p.seed * 3;
          L[v * 2 + 1] = lz;
        }
      };
      put(o, 0, 0, TOP + 0.0005);
      for (let k = 0; k < MAX_SIDES; k++) {
        // unused corners collapse onto the last real one
        const kk = Math.min(k, n - 1);
        const lx = Math.cos(p.ang[kk]) * p.rad[kk], lz = Math.sin(p.ang[kk]) * p.rad[kk];
        put(o + 1 + k, lx * 0.88, lz * 0.88, TOP + 0.0003);
        put(o + 1 + MAX_SIDES + k, lx, lz, TOP);
        put(o + 1 + 2 * MAX_SIDES + k, lx * 0.97, lz * 0.97, BOTTOM);
      }
    });
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCentre.needsUpdate = true;
    if (withLocal) this.geo.attributes.aLocal.needsUpdate = true;
  }

  update(dt: number) {
    this.mesh.visible = this.enabled;
    if (!this.enabled || dt <= 0) return;
    this.t += dt;
    const ps = this.plates;
    // 1. the melt under each plate, from the last readback: velocity at the
    //    centre, and spin from two neighbouring samples
    const tag = this.sampler.resultTag as Plate[] | null;
    const res = this.sampler.result;
    const kTau = 1 - Math.exp(-dt / TAU);
    const d = this.probe;
    ps.forEach((p, i) => {
      if (tag !== ps) return;
      const u0 = res[i * 12 + 1], v0 = res[i * 12 + 2];
      const v1 = res[i * 12 + 6]; // at (x + d, z)
      const u2 = res[i * 12 + 9]; // at (x, z + d)
      // the lake's slow convection, so it is never quite still
      const cx = Math.sin(p.z * 9 + this.t * 0.11) * 0.004, cz = Math.cos(p.x * 8 - this.t * 0.09) * 0.004;
      p.vx += (u0 + cx - p.vx) * kTau;
      p.vz += (v0 + cz - p.vz) * kTau;
      const spin = 0.5 * ((u2 - u0) / d - (v1 - v0) / d);
      p.w += (THREE.MathUtils.clamp(spin, -3, 3) - p.w) * kTau;
    });
    if (tag === ps) this.sampler.resultTag = null;
    // 2. move rigidly
    for (const p of ps) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.a += p.w * dt;
    }
    // 3. plates push each other apart; neighbours repel gently out to a bit
    //    beyond their usual spacing, which spreads the plates back over any
    //    patch of open melt within ten or twenty seconds
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = b.x - a.x, dz = b.z - a.z;
          const reach = (a.r + b.r) * 1.5;
          if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
          const dd = Math.hypot(dx, dz) || 1e-6;
          if (dd > reach) continue;
          const nx = dx / dd, nz = dz / dd;
          const contact = (a.r + b.r) * 0.98;
          if (dd < contact) {
            const push = (contact - dd) * 0.5;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
            // inelastic: they stop closing on each other
            const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (vn < 0) {
              a.vx += nx * vn * 0.5;
              a.vz += nz * vn * 0.5;
              b.vx -= nx * vn * 0.5;
              b.vz -= nz * vn * 0.5;
            }
          } else if (it === 0) {
            const f = (reach - dd) * 0.25 * dt;
            a.x -= nx * f;
            a.z -= nz * f;
            b.x += nx * f;
            b.z += nz * f;
          }
        }
      }
    }
    // 4. kept inside the puddle, off its edge
    for (const p of ps) {
      const s = this.solver.sdfAt(p.x, p.z);
      const lim = -p.r * 0.85;
      if (s > lim) {
        const e = 0.01;
        let gx = this.solver.sdfAt(p.x + e, p.z) - this.solver.sdfAt(p.x - e, p.z);
        let gz = this.solver.sdfAt(p.x, p.z + e) - this.solver.sdfAt(p.x, p.z - e);
        const gl = Math.hypot(gx, gz) || 1;
        gx /= gl;
        gz /= gl;
        p.x -= gx * (s - lim);
        p.z -= gz * (s - lim);
        const vn = p.vx * gx + p.vz * gz;
        if (vn > 0) {
          p.vx -= gx * vn;
          p.vz -= gz * vn;
        }
      }
    }
    this.writeVertices();
    // 5. ask for the melt under each plate for the next frame
    ps.forEach((p, i) => {
      const o = i * 6;
      this.xz[o] = p.x;
      this.xz[o + 1] = p.z;
      this.xz[o + 2] = p.x + d;
      this.xz[o + 3] = p.z;
      this.xz[o + 4] = p.x;
      this.xz[o + 5] = p.z + d;
    });
    if (ps.length) this.sampler.request(this.xz, ps.length * 3, ps);
  }
}
