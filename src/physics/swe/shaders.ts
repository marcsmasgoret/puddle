// ─────────────────────────────────────────────────────────────────────────────
// Shallow-water equations: GPU passes (GLSL ES 3.0)
//
// Governing equations (depth-averaged incompressible flow over a fixed floor):
//
//   ∂η/∂t + ∇·(h u) = 0                                         (mass)
//
//   ∂u/∂t + (u·∇)u = −g ∇η                                       (gravity)
//                    + (σ/ρ) ∇(∇²η)                              (surface tension)
//                    + ν ∇²u                                     (viscous diffusion)
//                    − c_f u                                     (bottom friction)
//
//   η = surface height above rest,  h = H + η = total depth,
//   u = depth-averaged horizontal velocity (u, v).
//
// One time step is three passes, "forward–backward" (symplectic Euler):
//   1. VELOCITY pass:  uⁿ⁺¹ from uⁿ and ηⁿ
//   2. LIMITER pass:   how much of each cell's outflow it can actually supply
//   3. HEIGHT pass:    ηⁿ⁺¹ from ηⁿ and the *new* uⁿ⁺¹
// Using the freshly updated velocity in the height update is what makes the
// scheme neutrally stable for waves (no artificial growth or decay).
//
// Grid coordinates: cell (i,j) has its centre at (i+½, j+½) in units of dx.
// Texel (i,j) stores R = η(i,j), G = u(i−½,j), B = v(i,j−½)  (see grid.ts).
// ─────────────────────────────────────────────────────────────────────────────

/** Helpers shared by every pass. */
import { RHEOLOGY_GLSL } from '../rheology';

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uState;  // R = η, G = u(i-½,j), B = v(i,j-½), A = outflow limiter
uniform sampler2D uShape;  // R = H (rest depth), G = sdf, B = wet flag
uniform ivec2 uSize;       // grid cells (Nx, Nz)
uniform float uDx;         // cell size [m]

bool inGrid(ivec2 c) { return all(greaterThanEqual(c, ivec2(0))) && all(lessThan(c, uSize)); }
vec4 S(ivec2 c) { return inGrid(c) ? texelFetch(uState, c, 0) : vec4(0.0); }
float H(ivec2 c) { return inGrid(c) ? texelFetch(uShape, c, 0).r : 0.0; }
bool wet(ivec2 c) { return inGrid(c) && texelFetch(uShape, c, 0).b > 0.5; }

// η with a zero-slope (Neumann) rule at the wall: a dry neighbour "sees" the
// height of the wet cell next to it, so no false pressure gradient appears at
// the edge.
float etaOr(ivec2 c, float fallback) { return wet(c) ? S(c).r : fallback; }
`;

// Horizontal strain rate |S| at a cell centre [1/s]:
//   |S| = √( 2 u_x² + 2 v_z² + (u_z + v_x)² )
// (the magnitude of the symmetric velocity-gradient tensor). It drives the
// Smagorinsky turbulence term and oobleck's shear thickening.
//
// Smagorinsky: a hard slap makes flow faster than the local wave speed √(gh)
// (Froude > 1); the water "breaks" and turns turbulent below the grid scale.
// Those unresolved eddies act as an extra viscosity ν_t = (C_s Δx)² |S| that
// switches on only where the flow is sharply sheared.
const STRAIN_GLSL = /* glsl */ `
float strainRate(ivec2 c) {
  float ux = (S(c + ivec2(1, 0)).g - S(c).g) / uDx;
  float vz = (S(c + ivec2(0, 1)).b - S(c).b) / uDx;
  float uz = (S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) / (2.0 * uDx);
  float vx = (S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) / (2.0 * uDx);
  return sqrt(2.0 * ux * ux + 2.0 * vz * vz + (uz + vx) * (uz + vx));
}
`;

export const fullscreenVertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// VELOCITY PASS
// ─────────────────────────────────────────────────────────────────────────────
export const velocityFragment = /* glsl */ `
${COMMON}
${RHEOLOGY_GLSL}
uniform float uDt;        // time step [s]
uniform float uG;         // gravity [m/s²]
uniform float uSigmaRho;  // σ/ρ [m³/s²]
uniform float uOmegaRef;  // representative wave angular frequency [rad/s]
uniform float uHMin;      // smallest depth used in friction [m]
uniform float uUMax;      // velocity safety clamp [m/s]
uniform float uExtraDamp; // optional extra linear damping [1/s] (engineering slider)
uniform float uCs;        // Smagorinsky constant (≈ 0.17)
uniform sampler2D uPressure; // surface pressure p/ρ from fingers and floating bodies (pressureMap.ts)
uniform sampler2D uIce;      // ice cover 0…1 (winter): a rigid lid where present
uniform vec2 uWindStress;    // mean wind stress τ/ρ [m²/s²]: τ = ρ_air C_D U²
uniform float uIceDrag;      // extra damping under ice [1/s]
// Elastic gel (jello): the sideways displacement ξ of each face's column
// since rest, and G/ρ. A sheared layer of depth h bonded to the bowl pulls
// back with a stress 3Gξ/h (per unit mass of the column: 3(G/ρ)ξ/h²), and
// neighbouring columns pull on each other by shear, (G/ρ)∇²ξ.
uniform sampler2D uXi;
uniform float uElastic;      // G/ρ [m²/s²], 0 for liquids

// Discrete Laplacian of η at a cell, ∇²η ≈ (Σ neighbours − 4η)/dx².
float lapEta(ivec2 c) {
  float e = S(c).r;
  float s = etaOr(c + ivec2(1, 0), e) + etaOr(c - ivec2(1, 0), e)
          + etaOr(c + ivec2(0, 1), e) + etaOr(c - ivec2(0, 1), e) - 4.0 * e;
  return s / (uDx * uDx);
}

// Surface pressure p/ρ at a cell. A steady pressure p pushes the surface
// down until ρ g Δη balances it.
float pressAt(ivec2 c) { return inGrid(c) ? texelFetch(uPressure, c, 0).r : 0.0; }

// ── Advection, momentum-conserving (Stelling & Duinmeijer 2003) ──────────
// The velocity form u_t + (u·∇)u is exact for smooth flow, but across a
// bore (a breaking wave front, a dam break) it conserves the wrong quantity
// and the front travels too slowly. Writing the conserved momentum hu and
// dividing out h gives the form used here:
//     (u·∇)u  →  (1/h) [ ∇·(q u) − u ∇·q ],   q = h u (discharge)
// discretised with discharges taken from the same upwind face depths as the
// height pass and upwind velocities, over the control volume around each
// face. For smooth flow it is an ordinary first-order upwind scheme; across a
// bore it gives the correct jump conditions (mass and momentum).

// depth carried through a face, upwind in the surface height (as in the
// height pass); a, b are the cells on the negative and positive sides
float upDepth(ivec2 a, ivec2 b, float vel) {
  float etaUp = vel > 0.0 ? S(a).r : S(b).r;
  return max(0.5 * (H(a) + H(b)) + etaUp, 0.0);
}
// discharge through the x-face on the left of cell c, and the z-face below it
float qx(ivec2 c) { float u = S(c).g; return u * upDepth(c - ivec2(1, 0), c, u); }
float qz(ivec2 c) { float v = S(c).b; return v * upDepth(c - ivec2(0, 1), c, v); }
float depthAt(ivec2 c) { return max(H(c) + S(c).r, 0.0); }

// (u·∇)u at the u-face on the left of cell c. Its control volume spans
// from the centre of cell W to the centre of cell c, one row tall.
float advectU(ivec2 c) {
  ivec2 W = c - ivec2(1, 0), E = c + ivec2(1, 0), N = c + ivec2(0, 1), So = c - ivec2(0, 1);
  float uf = S(c).g;
  float hbar = max(0.5 * (depthAt(W) + depthAt(c)), uHMin);
  // along x: discharges at the two cell centres, upwind velocities there
  float Qc = 0.5 * (qx(c) + qx(E));
  float QW = 0.5 * (qx(W) + qx(c));
  float uc = Qc > 0.0 ? uf : S(E).g;
  float uW = QW > 0.0 ? S(W).g : uf;
  float ax = Qc * uc - QW * uW - uf * (Qc - QW);
  // along z: discharges through the top and bottom edges of the volume
  float Qt = 0.5 * (qz(N) + qz(W + ivec2(0, 1)));
  float Qb = 0.5 * (qz(c) + qz(W));
  float ut = Qt > 0.0 ? uf : S(N).g;
  float ub = Qb > 0.0 ? S(So).g : uf;
  float az = Qt * ut - Qb * ub - uf * (Qt - Qb);
  return (ax + az) / (uDx * hbar);
}

// (u·∇)v at the v-face below cell c (between cell So and cell c).
float advectV(ivec2 c) {
  ivec2 So = c - ivec2(0, 1), N = c + ivec2(0, 1), E = c + ivec2(1, 0), W = c - ivec2(1, 0);
  float vf = S(c).b;
  float hbar = max(0.5 * (depthAt(So) + depthAt(c)), uHMin);
  float Qc = 0.5 * (qz(c) + qz(N));
  float QS = 0.5 * (qz(So) + qz(c));
  float vc = Qc > 0.0 ? vf : S(N).b;
  float vS = QS > 0.0 ? S(So).b : vf;
  float az = Qc * vc - QS * vS - vf * (Qc - QS);
  float Qr = 0.5 * (qx(E) + qx(So + ivec2(1, 0)));
  float Ql = 0.5 * (qx(c) + qx(So));
  float vr = Qr > 0.0 ? vf : S(E).b;
  float vl = Ql > 0.0 ? S(W).b : vf;
  float ax = Qr * vr - Ql * vl - vf * (Qr - Ql);
  return (ax + az) / (uDx * hbar);
}

${STRAIN_GLSL}

// Bottom friction rate c_f [1/s] for a layer of depth h and viscosity ν.
//
// The bed is no-slip, so a boundary layer forms. Two regimes:
//  • Slow flow, or a very viscous fluid: the whole depth is viscous and the
//    velocity profile is parabolic (Poiseuille). Depth-averaging the wall
//    shear τ = 3μū/h gives  c_f = 3ν/h².
//  • Oscillating wave flow in a low-viscosity fluid: shear is confined to a
//    Stokes layer of thickness δ = √(2ν/ω) ≪ h. The time-averaged energy loss
//    gives an equivalent linear rate  c_f ≈ √(νω/2) / h.
// The larger of the two is used, which automatically picks the right regime
// (δ > h ⇒ Poiseuille, δ ≪ h ⇒ Stokes layer).
float frictionRate(float h, float nu) {
  h = max(h, uHMin);
  float poiseuille = 3.0 * nu / (h * h);
  float stokes = sqrt(nu * uOmegaRef * 0.5) / h;
  return max(poiseuille, stokes) + uExtraDamp;
}

// Viscosity at a face: Newtonian fluids return ν; oobleck evaluates its
// rheology at the local strain rate γ̇ = √((3|ū|/h)² + |S|²) (rheology.ts).
float faceNu(float speed, float h, float S2) {
  float gb = 3.0 * speed / max(h, uHMin);
  return viscosityAt(sqrt(gb * gb + S2 * S2));
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  float eta = s.r;
  ivec2 W = c - ivec2(1, 0);
  ivec2 Sth = c - ivec2(0, 1);

  float lapC = lapEta(c);
  float strain = strainRate(c);
  float pC = pressAt(c);
  // The in-plane viscous term ν∇²u is explicit. Its stability limit is
  // ν dt/dx² ≤ ¼; above that (honey, jammed oobleck) the in-plane part is
  // capped there. Bottom friction carries the full viscosity implicitly and
  // dominates in a thin layer, so this cap only affects grid-scale wiggles.
  float nuCap = 0.2 * uDx * uDx / uDt;
  float nuTurb = (uCs * uDx) * (uCs * uDx) * strain;

  // ── u on the face between cell W and cell c ─────────────────────────────
  float uNew = 0.0;
  if (wet(c) && wet(W)) {
    // velocity at this face: u is here, v is the average of the 4 nearby v's
    float vHere = 0.25 * (S(W).b + s.b + S(W + ivec2(0, 1)).b + S(c + ivec2(0, 1)).b);
    float u = s.g - uDt * advectU(c);

    float etaW = S(W).r;
    float hFace = 0.5 * (H(c) + H(W)) + 0.5 * (eta + etaW);
    float nu = faceNu(length(vec2(s.g, vHere)), hFace, strain);
    float gravity   = -uG * (eta - etaW) / uDx;
    float pressure  = -(pC - pressAt(W)) / uDx;
    float capillary =  uSigmaRho * (lapC - lapEta(W)) / uDx;
    float lapU = (S(c + ivec2(1, 0)).g + S(W).g + S(c + ivec2(0, 1)).g + S(Sth).g - 4.0 * s.g) / (uDx * uDx);
    float viscous = min(nu + nuTurb, nuCap) * lapU;

    // wind drags the surface; spread over the layer it accelerates the
    // depth-averaged flow by τ/(ρh) (zero under ice)
    float iceU = max(texelFetch(uIce, c, 0).r, texelFetch(uIce, W, 0).r);
    float wind = uWindStress.x / max(hFace, uHMin) * (1.0 - iceU);
    float elastic = 0.0;
    if (uElastic > 0.0) {
      // (depth floored at 6 mm: thinner edges would only stiffen the step)
      float he = max(hFace, 0.006);
      float xi = texelFetch(uXi, c, 0).r;
      float lapXi = (texelFetch(uXi, c + ivec2(1, 0), 0).r + texelFetch(uXi, W, 0).r
                   + texelFetch(uXi, c + ivec2(0, 1), 0).r + texelFetch(uXi, Sth, 0).r - 4.0 * xi) / (uDx * uDx);
      elastic = -3.0 * uElastic / (he * he) * xi + uElastic * lapXi;
    }
    u += uDt * (gravity + pressure + capillary + viscous + wind + elastic);

    // bottom friction, implicit: (u_new − u)/dt = −c_f u_new  ⇒  u_new = u/(1 + c_f dt).
    // Unconditionally stable even when c_f is huge (honey, jammed oobleck).
    // A layer of ice is a rigid lid: a second no-slip surface that kills
    // the flow beneath it.
    u /= 1.0 + uDt * (frictionRate(hFace, nu) + uIceDrag * iceU);
    // safety cap on speed, applied to the velocity *vector* so it has no
    // preferred direction (clamping u and v separately would favour the grid
    // diagonals and turn round waves square)
    float sp = length(vec2(u, vHere));
    uNew = sp > uUMax ? u * uUMax / sp : u;
  }

  // ── v on the face between cell Sth and cell c ───────────────────────────
  float vNew = 0.0;
  if (wet(c) && wet(Sth)) {
    float uHere = 0.25 * (S(Sth).g + s.g + S(Sth + ivec2(1, 0)).g + S(c + ivec2(1, 0)).g);
    float v = s.b - uDt * advectV(c);

    float etaS = S(Sth).r;
    float hFace = 0.5 * (H(c) + H(Sth)) + 0.5 * (eta + etaS);
    float nu = faceNu(length(vec2(uHere, s.b)), hFace, strain);
    float gravity   = -uG * (eta - etaS) / uDx;
    float pressure  = -(pC - pressAt(Sth)) / uDx;
    float capillary =  uSigmaRho * (lapC - lapEta(Sth)) / uDx;
    float lapV = (S(c + ivec2(1, 0)).b + S(c - ivec2(1, 0)).b + S(c + ivec2(0, 1)).b + S(Sth).b - 4.0 * s.b) / (uDx * uDx);
    float viscous = min(nu + nuTurb, nuCap) * lapV;

    float iceV = max(texelFetch(uIce, c, 0).r, texelFetch(uIce, Sth, 0).r);
    float windV = uWindStress.y / max(hFace, uHMin) * (1.0 - iceV);
    float elasticV = 0.0;
    if (uElastic > 0.0) {
      float he = max(hFace, 0.006);
      float xi = texelFetch(uXi, c, 0).g;
      float lapXi = (texelFetch(uXi, c + ivec2(1, 0), 0).g + texelFetch(uXi, c - ivec2(1, 0), 0).g
                   + texelFetch(uXi, c + ivec2(0, 1), 0).g + texelFetch(uXi, Sth, 0).g - 4.0 * xi) / (uDx * uDx);
      elasticV = -3.0 * uElastic / (he * he) * xi + uElastic * lapXi;
    }
    v += uDt * (gravity + pressure + capillary + viscous + windV + elasticV);
    v /= 1.0 + uDt * (frictionRate(hFace, nu) + uIceDrag * iceV);
    float sp = length(vec2(uHere, v));
    vNew = sp > uUMax ? v * uUMax / sp : v;
  }

  // Faces touching a dry cell keep zero velocity: no flow through the wall
  // (u·n = 0), so waves reflect off the puddle's edge.
  gl_FragColor = vec4(eta, uNew, vNew, s.a);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// HEIGHT PASS  — conservation of volume
//
//   η_new = η − dt/dx · [ (hu)_{i+½} − (hu)_{i−½} + (hv)_{j+½} − (hv)_{j−½} ]
//
// The flux through each face is (face depth) × (face velocity). The face
// depth is the rest depth averaged across the face plus the *upwind* surface
// height. Whatever leaves one cell enters its neighbour, so total volume is
// conserved to round-off.
//
// Positivity: in a hard slap the flow can try to drain a cell faster than it
// holds water (several faces flowing out at once). The LIMITER pass computes,
// for every cell, the fraction θ ≤ 1 of its requested outflow it can actually
// supply without going below a thin film. Each face flux is then scaled by θ
// of its *donor* (upwind) cell. Because both neighbours use the same scaled
// flux, volume stays exactly conserved and depth never goes negative.
// ─────────────────────────────────────────────────────────────────────────────
const FLUX = /* glsl */ `
uniform float uDt;
uniform float uHMin;

float faceDepth(ivec2 a, ivec2 b, float vel) {
  // a is the cell on the negative side of the face, b on the positive side
  float etaUp = vel > 0.0 ? S(a).r : S(b).r;
  return max(0.5 * (H(a) + H(b)) + etaUp, 0.0);
}
`;

export const limiterFragment = /* glsl */ `
${COMMON}
${FLUX}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  if (!wet(c)) { gl_FragColor = vec4(s.rgb, 1.0); return; }
  ivec2 E = c + ivec2(1, 0), W = c - ivec2(1, 0);
  ivec2 N = c + ivec2(0, 1), Sth = c - ivec2(0, 1);
  float uL = s.g, uR = S(E).g, vB = s.b, vT = S(N).b;
  // volume per unit area this cell would send out during one step
  float out_ = max(uR, 0.0) * faceDepth(c, E, uR) + max(-uL, 0.0) * faceDepth(W, c, uL)
             + max(vT, 0.0) * faceDepth(c, N, vT) + max(-vB, 0.0) * faceDepth(Sth, c, vB);
  out_ *= uDt / uDx;
  float avail = max(H(c) + s.r - uHMin, 0.0);
  float theta = out_ > avail ? avail / out_ : 1.0;
  gl_FragColor = vec4(s.rgb, theta);
}
`;

export const heightFragment = /* glsl */ `
${COMMON}
${FLUX}
// flux through a face, scaled by the limiter of whichever cell supplies it
float flux(ivec2 a, ivec2 b, float vel) {
  float donor = vel > 0.0 ? S(a).a : S(b).a;
  return vel * faceDepth(a, b, vel) * donor;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  if (!wet(c)) { gl_FragColor = vec4(0.0, s.gba); return; }

  ivec2 E = c + ivec2(1, 0), W = c - ivec2(1, 0);
  ivec2 N = c + ivec2(0, 1), Sth = c - ivec2(0, 1);
  float fluxL = flux(W, c, s.g);
  float fluxR = flux(c, E, S(E).g);
  float fluxB = flux(Sth, c, s.b);
  float fluxT = flux(c, N, S(N).b);

  float eta = s.r - uDt / uDx * (fluxR - fluxL + fluxT - fluxB);
  gl_FragColor = vec4(eta, s.gba);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// ELASTIC PASS (gels only): the columns' displacement follows the velocity,
//   ξ ← ξ + Δt u      (after the velocity update: symplectic, like the waves)
// Closed faces (walls) carry no velocity, so they stay at ξ = 0.
// ─────────────────────────────────────────────────────────────────────────────
export const elasticFragment = /* glsl */ `
${COMMON}
uniform sampler2D uXiPrev;
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 xi = texelFetch(uXiPrev, c, 0).rg + uDt * S(c).gb;
  gl_FragColor = vec4(xi, 0.0, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// IMPULSE PASS — slaps, stirring, raindrops
//
// A slap is a short, intense pressure pulse p(x,t) on the surface. Integrated
// over its short duration it is a *pressure impulse* Π(x) = ∫p dt  [Pa·s],
// and the momentum equation gives the instantaneous velocity change
//     Δu = −∇Π / ρ.
// We use a Gaussian footprint Π = Π₀ exp(−r²/R²), so with φ = Π₀/ρ:
//     Δu = (2 (x − x₀) / R²) · φ · exp(−r²/R²)
// which pushes fluid radially outward. It adds no volume (it only moves it),
// so the slap digs a dent and throws up a ring that then propagates.
//
// Stirring adds a direct, Gaussian-weighted velocity Δu = w·exp(−r²/R²).
//
// Volume sources: spray leaving the surface (negative) or drops landing
// (positive) change η by a Gaussian of the right total volume:
//   Δη = A·exp(−r²/R²),  A = ΔV / (π R²).
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_IMPULSES = 8;

export const impulseFragment = /* glsl */ `
${COMMON}
#define MAX_IMPULSES ${MAX_IMPULSES}
uniform int uCount;
uniform vec4 uImp[MAX_IMPULSES];   // (x, z, R, φ = Π₀/ρ)
uniform vec4 uPush[MAX_IMPULSES];  // (Δu_x, Δu_z, A = ΔV/(πR²), 0)
uniform float uHMin;
uniform vec2 uOrigin;              // world xz of the grid corner

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  // world positions of this texel's u-face and v-face
  vec2 pu = uOrigin + vec2(float(c.x), float(c.y) + 0.5) * uDx;
  vec2 pv = uOrigin + vec2(float(c.x) + 0.5, float(c.y)) * uDx;
  bool openU = wet(c) && wet(c - ivec2(1, 0));
  bool openV = wet(c) && wet(c - ivec2(0, 1));
  vec2 pc = uOrigin + (vec2(c) + 0.5) * uDx;

  for (int k = 0; k < MAX_IMPULSES; k++) {
    if (k >= uCount) break;
    vec4 I = uImp[k];
    vec2 du = pu - I.xy, dv = pv - I.xy;
    float R2 = I.z * I.z;
    float gu = exp(-dot(du, du) / R2);
    float gv = exp(-dot(dv, dv) / R2);
    if (openU) s.g += 2.0 * du.x / R2 * I.w * gu + uPush[k].x * gu;
    if (openV) s.b += 2.0 * dv.y / R2 * I.w * gv + uPush[k].y * gv;
    if (wet(c)) {
      vec2 dc = pc - I.xy;
      s.r += uPush[k].z * exp(-dot(dc, dc) / R2);
    }
  }
  if (wet(c)) s.r = max(s.r, -H(c) + uHMin);
  gl_FragColor = s;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE PASS — packs what the renderer needs into a filterable texture:
//   R = η,  G = ∂η/∂x,  B = ∂η/∂z,  A = jam fraction (oobleck)
// The surface normal is then n ∝ (−∂η/∂x, 1, −∂η/∂z).
// ─────────────────────────────────────────────────────────────────────────────
export const surfaceFragment = /* glsl */ `
${COMMON}
${RHEOLOGY_GLSL}
${STRAIN_GLSL}
uniform float uHMin;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  float e = s.r;
  float dEx = (etaOr(c + ivec2(1, 0), e) - etaOr(c - ivec2(1, 0), e)) / (2.0 * uDx);
  float dEz = (etaOr(c + ivec2(0, 1), e) - etaOr(c - ivec2(0, 1), e)) / (2.0 * uDx);
  // cell-centred velocity = average of the two faces in each direction
  vec2 vel = 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b);
  // "jam" 0…1: how far up the thickening curve this cell is (log scale).
  // Used to render oobleck's surface going dull when it locks up, and by
  // the engineering overlay.
  float jam = 0.0;
  if (uShearThick > 0.5) {
    float h = max(H(c) + e, uHMin);
    float gb = 3.0 * length(vel) / h, st = strainRate(c);
    float nu = viscosityAt(sqrt(gb * gb + st * st));
    jam = clamp(log(max(nu / uRheo.x, 1.0)) / log(uRheo.w / uRheo.x), 0.0, 1.0);
  }
  gl_FragColor = vec4(wet(c) ? e : 0.0, dEx, dEz, jam);
}
`;
