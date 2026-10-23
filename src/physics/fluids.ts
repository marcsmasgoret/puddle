// ─────────────────────────────────────────────────────────────────────────────
// Fluid properties
//
// The simulation runs in real SI units at real size (the puddle really is
// ~2 m across and ~1.5 cm deep), so every property below goes into the
// equations exactly as measured. There is no hidden "fudge" scaling: the only
// mapping between the real world and the simulation is the grid spacing dx
// (see grid.ts), which sets the shortest wave the grid can represent.
//
// Every number has a source. Where a fluid's real value varies a lot (honey
// with temperature and water content, for example) the chosen value and the
// range are both documented.
// ─────────────────────────────────────────────────────────────────────────────

export interface FluidProperties {
  id: string;
  name: string;

  /** ρ, density [kg/m³] */
  density: number;
  /** μ, dynamic viscosity [Pa·s] (Newtonian fluids; oobleck overrides it) */
  viscosity: number;
  /** σ, liquid–air surface tension [N/m] */
  surfaceTension: number;

  /** H₀, resting depth at the deepest point of the puddle [m] */
  restDepth: number;

  /**
   * Optical absorption coefficients κ for red / green / blue light [1/m].
   * Light travelling a distance L through the fluid is attenuated by
   * exp(-κ·L) (Beer–Lambert law), which is what gives fluids their colour in
   * depth.
   */
  absorption: [number, number, number];
  /** Refractive index n (for Snell refraction and Fresnel reflectance). */
  refractiveIndex: number;

  /** Short list of sources for the numbers above. */
  sources: string[];
}

/**
 * Water at 20 °C.
 *
 * - ρ  = 998.21 kg/m³    IAPWS-95 formulation (as tabulated, e.g. Anton Paar)
 * - μ  = 1.0016 mPa·s    IAPWS 2008 viscosity formulation
 * - σ  = 72.74 mN/m      IAPWS R1-76(2014), surface tension of ordinary water
 * - n  = 1.333           (visible light, 20 °C)
 *
 * Absorption: pure water absorbs red far more than blue (Pope & Fry 1997,
 * integrating-cavity measurements, OMLC data table):
 *   a(650 nm) = 0.340 /m,  a(550 nm) = 0.0565 /m,  a(450 nm) = 0.00922 /m.
 * Through 1.5 cm of pure water that is invisible (exp(-0.34·0.03) ≈ 0.99), so
 * a real puddle's slight tint comes mostly from fine suspended sediment and
 * dissolved organic matter. That is modelled separately as a small, roughly
 * grey-brown "turbidity" term added in the renderer, and is clearly labelled
 * as a scene choice rather than a property of water itself.
 */
export const WATER: FluidProperties = {
  id: 'water',
  name: 'Water',
  density: 998.21,
  viscosity: 1.0016e-3,
  surfaceTension: 72.74e-3,
  restDepth: 0.015,
  absorption: [0.34, 0.0565, 0.00922],
  refractiveIndex: 1.333,
  sources: [
    'IAPWS R1-76(2014): Revised Release on the Surface Tension of Ordinary Water Substance',
    'IAPWS (2008): Release on the IAPWS Formulation 2008 for the Viscosity of Ordinary Water Substance',
    'Pope, R. M. & Fry, E. S. (1997). Absorption spectrum (380–700 nm) of pure water. II. Applied Optics 36, 8710–8723',
  ],
};

/** ν = μ/ρ, kinematic viscosity [m²/s]. Momentum diffuses at this rate. */
export function kinematicViscosity(f: FluidProperties): number {
  return f.viscosity / f.density;
}

/**
 * Capillary length ℓc = √(σ / (ρ g)) [m]. Waves much shorter than 2πℓc are
 * dominated by surface tension (capillary ripples); much longer ones by
 * gravity. For water ℓc ≈ 2.7 mm.
 */
export function capillaryLength(f: FluidProperties, g: number): number {
  return Math.sqrt(f.surfaceTension / (f.density * g));
}
