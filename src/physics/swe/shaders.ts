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
uniform float uDt;        // time step [s]
uniform float uG;         // gravity [m/s²]
uniform float uSigmaRho;  // σ/ρ [m³/s²]
uniform float uNu;        // kinematic viscosity ν [m²/s]
uniform float uOmegaRef;  // representative wave angular frequency [rad/s]
uniform float uHMin;      // smallest depth used in friction [m]
uniform float uUMax;      // velocity safety clamp [m/s]
uniform float uExtraDamp; // optional extra linear damping [1/s] (engineering slider)
uniform float uCs;        // Smagorinsky constant (≈ 0.17)

// Discrete Laplacian of η at a cell, ∇²η ≈ (Σ neighbours − 4η)/dx².
float lapEta(ivec2 c) {
  float e = S(c).r;
  float s = etaOr(c + ivec2(1, 0), e) + etaOr(c - ivec2(1, 0), e)
          + etaOr(c + ivec2(0, 1), e) + etaOr(c - ivec2(0, 1), e) - 4.0 * e;
  return s / (uDx * uDx);
}

// Bilinear sample of the u component at a point p in grid coordinates.
// u(i-½,j) lives at (i, j+½), so shift by (0, ½) before interpolating.
float sampleU(vec2 p) {
  vec2 f = p - vec2(0.0, 0.5);
  ivec2 i0 = ivec2(floor(f));
  vec2 t = f - vec2(i0);
  float a = S(i0).g, b = S(i0 + ivec2(1, 0)).g;
  float c = S(i0 + ivec2(0, 1)).g, d = S(i0 + ivec2(1, 1)).g;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
// v(i,j-½) lives at (i+½, j).
float sampleV(vec2 p) {
  vec2 f = p - vec2(0.5, 0.0);
  ivec2 i0 = ivec2(floor(f));
  vec2 t = f - vec2(i0);
  float a = S(i0).b, b = S(i0 + ivec2(1, 0)).b;
  float c = S(i0 + ivec2(0, 1)).b, d = S(i0 + ivec2(1, 1)).b;
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

// Horizontal strain rate |S| at a cell centre [1/s]:
//   |S| = √( 2 u_x² + 2 v_z² + (u_z + v_x)² )
// (the magnitude of the symmetric velocity-gradient tensor).
float strainRate(ivec2 c) {
  float ux = (S(c + ivec2(1, 0)).g - S(c).g) / uDx;
  float vz = (S(c + ivec2(0, 1)).b - S(c).b) / uDx;
  float uz = (S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) / (2.0 * uDx);
  float vx = (S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) / (2.0 * uDx);
  return sqrt(2.0 * ux * ux + 2.0 * vz * vz + (uz + vx) * (uz + vx));
}

// Effective horizontal viscosity = molecular ν + Smagorinsky eddy viscosity.
// A hard slap makes flow faster than the local wave speed √(gh) (Froude > 1):
// the water "breaks" and turns turbulent at scales smaller than one cell.
// The Smagorinsky model represents those unresolved eddies as an extra
// viscosity ν_t = (C_s Δx)² |S| that only switches on where the flow is
// sharply sheared, and keeps the scheme stable through these hydraulic jumps.
float effectiveNu(ivec2 c) {
  return uNu + (uCs * uDx) * (uCs * uDx) * strainRate(c);
}

// Bottom friction rate c_f [1/s] for a layer of depth h.
//
// The bed is no-slip, so a thin boundary layer forms. Two regimes:
//  • Steady / slow flow, or a very viscous fluid: the whole depth is viscous
//    and the velocity profile is parabolic (Poiseuille). Depth-averaging the
//    wall shear τ = 3μū/h gives  c_f = 3ν/h².
//  • Oscillating wave flow in a low-viscosity fluid: shear is confined to a
//    Stokes layer of thickness δ = √(2ν/ω) ≪ h. The time-averaged energy loss
//    gives an equivalent linear rate  c_f ≈ √(νω/2) / h.
// The larger of the two is used, which automatically picks the right regime
// (δ > h ⇒ Poiseuille, δ ≪ h ⇒ Stokes layer).
float frictionRate(float h) {
  h = max(h, uHMin);
  float poiseuille = 3.0 * uNu / (h * h);
  float stokes = sqrt(uNu * uOmegaRef * 0.5) / h;
  return max(poiseuille, stokes) + uExtraDamp;
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  float eta = s.r;
  ivec2 W = c - ivec2(1, 0);
  ivec2 Sth = c - ivec2(0, 1);

  float lapC = lapEta(c);
  float nuEff = effectiveNu(c);

  // ── u on the face between cell W and cell c ─────────────────────────────
  float uNew = 0.0;
  if (wet(c) && wet(W)) {
    vec2 p = vec2(c) + vec2(0.0, 0.5);
    // velocity at this face: u is here, v is the average of the 4 nearby v's
    float vHere = 0.25 * (S(W).b + s.b + S(W + ivec2(0, 1)).b + S(c + ivec2(0, 1)).b);
    // (u·∇)u by semi-Lagrangian back-tracing: the value arriving here is the
    // value that was one time step upstream.
    float u = sampleU(p - uDt / uDx * vec2(s.g, vHere));

    float etaW = S(W).r;
    float gravity   = -uG * (eta - etaW) / uDx;
    float capillary =  uSigmaRho * (lapC - lapEta(W)) / uDx;
    float lapU = (S(c + ivec2(1, 0)).g + S(W).g + S(c + ivec2(0, 1)).g + S(Sth).g - 4.0 * s.g) / (uDx * uDx);
    float viscous = nuEff * lapU;

    u += uDt * (gravity + capillary + viscous);

    // bottom friction, implicit: (u_new − u)/dt = −c_f u_new  ⇒  u_new = u/(1 + c_f dt).
    // Unconditionally stable even when c_f is huge (honey, very shallow edges).
    float hFace = 0.5 * (H(c) + H(W)) + 0.5 * (eta + etaW);
    u /= 1.0 + uDt * frictionRate(hFace);
    uNew = clamp(u, -uUMax, uUMax);
  }

  // ── v on the face between cell Sth and cell c ───────────────────────────
  float vNew = 0.0;
  if (wet(c) && wet(Sth)) {
    vec2 p = vec2(c) + vec2(0.5, 0.0);
    float uHere = 0.25 * (S(Sth).g + s.g + S(Sth + ivec2(1, 0)).g + S(c + ivec2(1, 0)).g);
    float v = sampleV(p - uDt / uDx * vec2(uHere, s.b));

    float etaS = S(Sth).r;
    float gravity   = -uG * (eta - etaS) / uDx;
    float capillary =  uSigmaRho * (lapC - lapEta(Sth)) / uDx;
    float lapV = (S(c + ivec2(1, 0)).b + S(c - ivec2(1, 0)).b + S(c + ivec2(0, 1)).b + S(Sth).b - 4.0 * s.b) / (uDx * uDx);
    float viscous = nuEff * lapV;

    v += uDt * (gravity + capillary + viscous);
    float hFace = 0.5 * (H(c) + H(Sth)) + 0.5 * (eta + etaS);
    v /= 1.0 + uDt * frictionRate(hFace);
    vNew = clamp(v, -uUMax, uUMax);
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
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_IMPULSES = 8;

export const impulseFragment = /* glsl */ `
${COMMON}
#define MAX_IMPULSES ${MAX_IMPULSES}
uniform int uCount;
uniform vec4 uImp[MAX_IMPULSES];   // (x, z, R, φ = Π₀/ρ)
uniform vec4 uPush[MAX_IMPULSES];  // (Δu_x, Δu_z, 0, 0)
uniform vec2 uOrigin;              // world xz of the grid corner

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  // world positions of this texel's u-face and v-face
  vec2 pu = uOrigin + vec2(float(c.x), float(c.y) + 0.5) * uDx;
  vec2 pv = uOrigin + vec2(float(c.x) + 0.5, float(c.y)) * uDx;
  bool openU = wet(c) && wet(c - ivec2(1, 0));
  bool openV = wet(c) && wet(c - ivec2(0, 1));

  for (int k = 0; k < MAX_IMPULSES; k++) {
    if (k >= uCount) break;
    vec4 I = uImp[k];
    vec2 du = pu - I.xy, dv = pv - I.xy;
    float R2 = I.z * I.z;
    float gu = exp(-dot(du, du) / R2);
    float gv = exp(-dot(dv, dv) / R2);
    if (openU) s.g += 2.0 * du.x / R2 * I.w * gu + uPush[k].x * gu;
    if (openV) s.b += 2.0 * dv.y / R2 * I.w * gv + uPush[k].y * gv;
  }
  gl_FragColor = s;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE PASS — packs what the renderer needs into a filterable texture:
//   R = η,  G = ∂η/∂x,  B = ∂η/∂z,  A = |u| (local flow speed)
// The surface normal is then n ∝ (−∂η/∂x, 1, −∂η/∂z).
// ─────────────────────────────────────────────────────────────────────────────
export const surfaceFragment = /* glsl */ `
${COMMON}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = S(c);
  float e = s.r;
  float dEx = (etaOr(c + ivec2(1, 0), e) - etaOr(c - ivec2(1, 0), e)) / (2.0 * uDx);
  float dEz = (etaOr(c + ivec2(0, 1), e) - etaOr(c - ivec2(0, 1), e)) / (2.0 * uDx);
  // cell-centred velocity = average of the two faces in each direction
  vec2 vel = 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b);
  gl_FragColor = vec4(wet(c) ? e : 0.0, dEx, dEz, length(vel));
}
`;
