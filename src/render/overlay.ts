// Engineering overlays, drawn straight on top of the finished frame:
//   height     η as a diverging colour map
//   velocity   speed as colour, plus arrows of the depth-averaged velocity
//   viscosity  oobleck: the local viscosity μ(γ̇); other fluids: strain rate γ̇
//   forces     weight, buoyancy and drag on every floating toy
// Colours are written in display (sRGB) space and skip tone mapping, so the
// colour bars in the engineering card read true.
import * as THREE from 'three';
import type { ShallowWaterSolver } from '../physics/solver';
import { RHEOLOGY_GLSL, rheologyUniforms } from '../physics/rheology';
import type { FluidProperties } from '../physics/fluids';
import type { RigidBody } from '../physics/rigidbody';

export type OverlayMode = 'off' | 'height' | 'velocity' | 'viscosity' | 'forces' | 'vorticity' | 'froude';

/** Colour maps shared with the legend bars in the engineering card. */
export const COLORMAP_GLSL = /* glsl */ `
// matplotlib "viridis", polynomial fit (Mattias Ehrnström / shadertoy WlfXRN)
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061);
  const vec3 c1 = vec3(0.1050930431085774, 1.404613529898575, 1.384590162594685);
  const vec3 c2 = vec3(-0.3308618287255563, 0.214847559468213, 0.09509516302823659);
  const vec3 c3 = vec3(-4.634230498983486, -5.799100973351585, -19.33244095627987);
  const vec3 c4 = vec3(6.228269936347081, 14.17993336680509, 56.69055260068105);
  const vec3 c5 = vec3(4.776384997670288, -13.74514537774601, -65.35303263337234);
  const vec3 c6 = vec3(-5.435455855934631, 4.645852612178535, 26.3124352495832);
  t = clamp(t, 0.0, 1.0);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}
// blue – white – red, for signed quantities
vec3 diverging(float t) {
  t = clamp(t, -1.0, 1.0);
  vec3 lo = vec3(0.16, 0.38, 0.74), mid = vec3(0.96, 0.95, 0.93), hi = vec3(0.80, 0.22, 0.18);
  return t < 0.0 ? mix(mid, lo, -t) : mix(mid, hi, t);
}
`;

/** CSS gradients matching the GLSL maps, for the legend bars. */
export const LEGEND_CSS = {
  diverging: 'linear-gradient(90deg, rgb(41,97,189), rgb(245,242,237), rgb(204,56,46))',
  viridis: 'linear-gradient(90deg, #440154, #3b528b, #21918c, #5ec962, #fde725)',
};

const fieldVertex = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const COMMON = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;   // R = η, G = u(i-½,j), B = v(i,j-½)
uniform sampler2D uShape;   // R = sdf, G = H (half float, filterable)
uniform vec2 uOrigin;       // world xz of the grid corner
uniform vec2 uSize;         // cells
uniform float uDx;
ivec2 cellOf(vec2 world) { return ivec2(floor((world - uOrigin) / uDx)); }
vec4 S(ivec2 c) { return texelFetch(uState, clamp(c, ivec2(0), ivec2(uSize) - 1), 0); }
vec2 shapeAt(vec2 world) { return texture(uShape, (world - uOrigin) / (uSize * uDx)).rg; }
// cell-centred velocity: the average of the two faces in each direction
vec2 velAt(ivec2 c) { vec4 s = S(c); return 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b); }
`;

const fieldFragment = /* glsl */ `
${COMMON}
${COLORMAP_GLSL}
${RHEOLOGY_GLSL}
uniform int uMode;        // 1 height, 2 speed, 3 viscosity / strain rate, 4 vorticity, 5 Froude
uniform float uScale;     // height: η at full colour [m]; speed: |u| at full colour [m/s]
uniform float uG;
varying vec2 vWorld;

float strainRate(ivec2 c) {
  float ux = (S(c + ivec2(1, 0)).g - S(c).g) / uDx;
  float vz = (S(c + ivec2(0, 1)).b - S(c).b) / uDx;
  float uz = (S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) / (2.0 * uDx);
  float vx = (S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) / (2.0 * uDx);
  return sqrt(2.0 * ux * ux + 2.0 * vz * vz + (uz + vx) * (uz + vx));
}

void main() {
  vec2 shp = shapeAt(vWorld);
  if (shp.r > 0.0) discard;
  ivec2 c = cellOf(vWorld);
  vec4 s = S(c);
  vec3 col;
  float a = 0.82;
  if (uMode == 1) {
    col = diverging(s.r / uScale);
  } else if (uMode == 2) {
    col = viridis(length(velAt(c)) / uScale);
    a = 0.7;
  } else if (uMode == 4) {
    // vorticity ω = ∂v/∂x − ∂u/∂z: the water's spin (blue clockwise, red anticlockwise)
    float vx = (S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) / (2.0 * uDx);
    float uz = (S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) / (2.0 * uDx);
    col = diverging((vx - uz) / 4.0);
  } else if (uMode == 5) {
    // Froude number Fr = |u| / √(g h): above 1 the flow outruns its waves
    float h = max(shp.g + s.r, 0.0005);
    float fr = length(velAt(c)) / sqrt(uG * h);
    col = viridis(fr / 1.5);
    col = mix(col, vec3(1.0), smoothstep(0.06, 0.0, abs(fr - 1.0)));
  } else {
    // the same strain rate the solver uses: bed shear 3|ū|/h with the
    // in-plane strain added in quadrature
    float h = max(shp.g + s.r, 0.0005);
    float gb = 3.0 * length(velAt(c)) / h, st = strainRate(c);
    float gd = sqrt(gb * gb + st * st);
    if (uShearThick > 0.5) {
      float nu = viscosityAt(gd);
      col = viridis(log(nu / uRheo.x) / log(uRheo.w / uRheo.x));
    } else {
      // γ̇ from 0.1 to 1000 1/s, log scale
      col = viridis((log(max(gd, 1e-3)) / log(10.0) + 1.0) / 4.0);
    }
  }
  // soft shoreline
  a *= smoothstep(0.0, -0.01, shp.r);
  gl_FragColor = vec4(col, a);
}
`;

const arrowVertex = /* glsl */ `
${COMMON}
attribute vec2 aCell;     // world xz of this arrow's base
uniform float uArrowScale; // metres of arrow per m/s
uniform float uMaxLen;
varying float vA;
void main() {
  ivec2 c = cellOf(aCell);
  vec2 v = velAt(c);
  float sp = length(v);
  float len = min(sp * uArrowScale, uMaxLen);
  vec2 shp = shapeAt(aCell);
  vA = (shp.r < -2.0 * uDx && len > 0.002) ? 1.0 : 0.0;
  vec2 d = sp > 1e-6 ? v / sp : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  // position.x runs 0…1 along the arrow, position.z across (fixed width)
  vec2 p = aCell + d * position.x * len + n * position.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, 0.0, p.y, 1.0);
}
`;

const arrowFragment = /* glsl */ `
varying float vA;
void main() {
  if (vA < 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.95);
}
`;

/** Arrow shape: shaft 0…0.68, head 0.68…1 (x along, z across, metres). */
function arrowGeometry(spacing: number) {
  const w = spacing * 0.06, hw = spacing * 0.2;
  const pos = [
    0, 0, -w, 0.68, 0, -w, 0.68, 0, w,
    0, 0, -w, 0.68, 0, w, 0, 0, w,
    0.62, 0, -hw, 1, 0, 0, 0.62, 0, hw,
  ];
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export class Overlay {
  mode: OverlayMode = 'off';
  /** full-colour values for the legend */
  heightScale = 0.002;
  speedScale = 0.15;
  readonly scene = new THREE.Scene();
  private field: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private arrows: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private forces = new THREE.Group();
  private pool: { w: THREE.ArrowHelper; b: THREE.ArrowHelper; d: THREE.ArrowHelper }[] = [];

  constructor(private solver: ShallowWaterSolver) {
    const [ox, oz] = solver.origin;
    const [ex, ez] = solver.extent;
    const { nx, nz, dx } = solver.grid;
    const common = {
      uState: { value: solver.stateTexture },
      uShape: { value: solver.shapeTexture },
      uOrigin: { value: new THREE.Vector2(ox, oz) },
      uSize: { value: new THREE.Vector2(nx, nz) },
      uDx: { value: dx },
    };
    const r = { uShearThick: { value: 0 }, uRheo: { value: new THREE.Vector4(1, 1, 1, 1) }, uTauY: { value: 0 } };

    const plane = new THREE.PlaneGeometry(ex, ez);
    plane.rotateX(-Math.PI / 2);
    plane.translate(ox + ex / 2, 0, oz + ez / 2);
    this.field = new THREE.Mesh(
      plane,
      new THREE.ShaderMaterial({
        vertexShader: fieldVertex,
        fragmentShader: fieldFragment,
        uniforms: { ...common, ...r, uMode: { value: 1 }, uScale: { value: 0.002 }, uG: { value: 9.81 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.field.frustumCulled = false;

    // arrows on a ~4 cm lattice
    const spacing = 0.045;
    const cells: number[] = [];
    for (let z = oz + spacing / 2; z < oz + ez; z += spacing) {
      for (let x = ox + spacing / 2; x < ox + ex; x += spacing) cells.push(x, z);
    }
    const g = arrowGeometry(spacing);
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cells), 2));
    g.instanceCount = cells.length / 2;
    this.arrows = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        vertexShader: arrowVertex,
        fragmentShader: arrowFragment,
        side: THREE.DoubleSide,
        uniforms: { ...common, uArrowScale: { value: 0.8 }, uMaxLen: { value: spacing * 1.4 } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.arrows.frustumCulled = false;
    this.scene.add(this.field, this.arrows, this.forces);
  }

  setFluid(f: FluidProperties, g: number) {
    const r = rheologyUniforms(f);
    const u = this.field.material.uniforms;
    u.uShearThick.value = r.enabled;
    (u.uRheo.value as THREE.Vector4).set(r.nu0, r.gammaC, r.n, r.nuMax);
    u.uTauY.value = r.tauY;
    u.uG.value = g;
  }

  /**
   * Arrows for every floating toy, from its centre of mass:
   *   grey: weight mg   blue: buoyancy   orange: drag
   * Length ∝ √|F| so a 3 g paper boat and a 45 g sailboat both read.
   */
  private updateForces(bodies: RigidBody[], g: number) {
    const mk = (c: number) => {
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.1, c, 0.025, 0.014);
      for (const m of [a.line.material, a.cone.material] as THREE.Material[]) {
        m.depthTest = false;
        m.toneMapped = false;
        m.transparent = true;
      }
      a.renderOrder = 10;
      this.forces.add(a);
      return a;
    };
    while (this.pool.length < bodies.length) this.pool.push({ w: mk(0xb8bcc2), b: mk(0x4aa3e0), d: mk(0xf08a4b) });
    const len = (F: number) => 0.35 * Math.sqrt(F);
    const dir = new THREE.Vector3();
    this.pool.forEach((p, k) => {
      const body = bodies[k];
      const show = !!body;
      p.w.visible = p.b.visible = p.d.visible = show;
      if (!body) return;
      const o = body.pos;
      const set = (a: THREE.ArrowHelper, v: THREE.Vector3) => {
        const F = v.length();
        a.visible = F > 1e-5;
        if (!a.visible) return;
        const L = len(F);
        a.position.copy(o);
        a.setDirection(dir.copy(v).divideScalar(F));
        a.setLength(L, Math.min(0.025, L * 0.4), Math.min(0.014, L * 0.25));
      };
      set(p.w, new THREE.Vector3(0, -body.def.mass * g, 0));
      set(p.b, new THREE.Vector3(0, body.buoyancy, 0));
      set(p.d, body.drag);
    });
  }

  /** Draw over the frame already on screen. */
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera, bodies: RigidBody[], g: number) {
    if (this.mode === 'off') return;
    const fu = this.field.material.uniforms;
    fu.uState.value = this.solver.stateTexture;
    this.arrows.material.uniforms.uState.value = this.solver.stateTexture;
    this.field.visible = this.mode !== 'forces';
    this.arrows.visible = this.mode === 'velocity';
    this.forces.visible = this.mode === 'forces';
    fu.uMode.value = this.mode === 'height' ? 1 : this.mode === 'velocity' ? 2 : this.mode === 'vorticity' ? 4 : this.mode === 'froude' ? 5 : 3;
    fu.uScale.value = this.mode === 'height' ? this.heightScale : this.speedScale;
    if (this.mode === 'forces') this.updateForces(bodies, g);
    const auto = renderer.autoClear;
    const tm = renderer.toneMapping;
    renderer.autoClear = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, camera);
    renderer.autoClear = auto;
    renderer.toneMapping = tm;
  }
}
