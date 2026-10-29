// ─────────────────────────────────────────────────────────────────────────────
// Fluid properties
//
// The simulation runs in real SI units at real size (the puddle really is
// ~2 m across and ~2.5 cm deep), so every property below goes into the
// equations exactly as measured. There is no hidden "fudge" scaling: the only
// mapping between the real world and the simulation is the grid spacing dx
// (see grid.ts), which sets the shortest wave the grid can represent.
//
// Every fluid fills the same bowl, so differences on screen come from the
// physics, not from a different container.
//
// Where a real value varies a lot (honey with temperature and water content,
// oobleck with starch fraction) the chosen value and its range are documented.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Viscosity model.
 *  • newtonian: μ is a constant.
 *  • shearThickening: μ depends on the local strain rate γ̇ (see rheology.ts).
 */
export type Rheology =
  | { kind: 'newtonian' }
  | {
      /** a soft elastic solid (gel): Kelvin–Voigt, shear modulus G plus viscosity */
      kind: 'elastic';
      /** G, shear modulus [Pa] */
      G: number;
    }
  | {
      kind: 'shearThickening';
      /** μ₀, viscosity in the liquid (low-shear) regime [Pa·s] */
      mu0: number;
      /** γ̇_c, onset strain rate of thickening [1/s] */
      gammaC: number;
      /** power-law exponent of the thickening branch (n > 1) */
      n: number;
      /** μ_max, viscosity of the fully jammed state [Pa·s] */
      muMax: number;
      /** τ_y, small yield stress of the resting suspension [Pa] */
      yieldStress: number;
    };

/** How the fluid looks. */
export type Optics =
  | {
      kind: 'dielectric';
      /** refractive index n */
      ior: number;
      /** Beer–Lambert absorption κ for red/green/blue [1/m] */
      absorption: [number, number, number];
      /** surface micro-roughness (GGX α) */
      roughness: number;
    }
  | {
      kind: 'metal';
      /** complex refractive index n + ik for red/green/blue */
      n: [number, number, number];
      k: [number, number, number];
      roughness: number;
    }
  | {
      /** molten rock: glows by its temperature, skins over with dark crust */
      kind: 'lava';
      /** temperature of the exposed melt [K] */
      temperature: number;
      /** colour of the cooled crust (linear RGB) */
      crust: [number, number, number];
      /** seconds for an undisturbed surface to skin over */
      crustTime: number;
      roughness: number;
    }
  | {
      kind: 'opaque';
      /** diffuse colour (linear RGB) */
      albedo: [number, number, number];
      /** refractive index of the liquid at the surface (for the sheen) */
      ior: number;
      /** extinction coefficient: how quickly the bed disappears [1/m] */
      extinction: number;
      roughness: number;
      /** how lumpy the resting surface is (1 = oobleck's yield-stress lumps) */
      bump?: number;
      /** boost of the wet sheen over plain Fresnel (oobleck's cream: 1.6) */
      sheen?: number;
    };

export interface FluidProperties {
  id: 'water' | 'honey' | 'mercury' | 'oobleck' | 'lava' | 'jello' | 'chocolate';
  name: string;
  /** ρ, density [kg/m³] */
  density: number;
  /** μ, dynamic viscosity [Pa·s] (low-shear value for oobleck) */
  viscosity: number;
  /** σ, liquid–air surface tension [N/m] */
  surfaceTension: number;
  rheology: Rheology;
  optics: Optics;
  /** does the liquid wet soil? (mercury does not: contact angle ≈ 140°) */
  wetsGround: boolean;
  /** colour of soaked ground / residue, linear RGB multiplier */
  stain: [number, number, number];
  /** can it hold a pressed dent? (see interaction notes in the write-up) */
  holdable: boolean;
  /** can it splash at all? */
  splashes: boolean;
  sources: string[];
}

/**
 * Water at 20 °C.
 *
 * - ρ  = 998.21 kg/m³    IAPWS-95 formulation
 * - μ  = 1.0016 mPa·s    IAPWS 2008 viscosity formulation
 * - σ  = 72.74 mN/m      IAPWS R1-76(2014)
 * - n  = 1.333
 *
 * Absorption (Pope & Fry 1997): a(650 nm) = 0.340 /m, a(550) = 0.0565 /m,
 * a(450) = 0.00922 /m. Through 2.5 cm that is invisible, so a real puddle's
 * tint comes mostly from fine sediment; that is added separately in the
 * renderer and labelled as a scene choice.
 */
export const WATER: FluidProperties = {
  id: 'water',
  name: 'Water',
  density: 998.21,
  viscosity: 1.0016e-3,
  surfaceTension: 72.74e-3,
  rheology: { kind: 'newtonian' },
  optics: { kind: 'dielectric', ior: 1.333, absorption: [0.34, 0.0565, 0.00922], roughness: 0.05 },
  wetsGround: true,
  stain: [0.5, 0.5, 0.5],
  holdable: false,
  splashes: true,
  sources: [
    'IAPWS R1-76(2014): Revised Release on the Surface Tension of Ordinary Water Substance',
    'IAPWS (2008): Release on the IAPWS Formulation 2008 for the Viscosity of Ordinary Water Substance',
    'Pope, R. M. & Fry, E. S. (1997). Absorption spectrum (380–700 nm) of pure water. II. Applied Optics 36, 8710–8723',
  ],
};

/**
 * Honey at about 20 °C, ~18 % water.
 *
 * - ρ  = 1420 kg/m³      measured 1.42–1.455 g/cm³ (poly-floral honeys)
 * - μ  = 7.4 Pa·s        mean of commercial honeys at 20 °C (7.43 Pa·s);
 *                        honey is Newtonian (Yanniotis et al. 2006) but μ
 *                        varies from ~2 to ~60 Pa·s with water content and
 *                        temperature (e.g. 9.9 Pa·s at 18.9 % water,
 *                        61 Pa·s at 13.9 %, Lazaridou et al. 2004)
 * - σ  = 63 mN/m         measured 59.6–66.4 dyn/cm
 * - n  = 1.49            measured 1.48–1.493 (and ~1.50 for drier honey)
 *
 * Absorption: honey's colour comes from strong blue absorption by
 * polyphenols and Maillard products. The coefficients are estimated to give
 * a light golden honey in a 2.5 cm layer (transmits ~88 % red, ~59 % green,
 * ~9 % blue); this is a colour choice within the natural range (water-white
 * to dark amber), not a single measured sample.
 */
export const HONEY: FluidProperties = {
  id: 'honey',
  name: 'Honey',
  density: 1420,
  viscosity: 7.4,
  surfaceTension: 63e-3,
  rheology: { kind: 'newtonian' },
  optics: { kind: 'dielectric', ior: 1.49, absorption: [5, 21, 96], roughness: 0.035 },
  wetsGround: true,
  stain: [0.62, 0.42, 0.16],
  holdable: true,
  splashes: true,
  sources: [
    'Yanniotis, S., Skaltsi, S. & Karaburnioti, S. (2006). Effect of moisture content on the viscosity of honey at different temperatures. J. Food Eng. 72, 372–377',
    'Lazaridou, A. et al. (2004). Composition, thermal and rheological behaviour of selected Greek honeys. J. Food Eng. 64, 9–21',
    'Honey density, surface tension and refractive index: measurements on poly-floral and Sudanese honeys (1.42–1.455 g/cm³; 59.6–66.4 dyn/cm; n = 1.48–1.50)',
  ],
};

/**
 * Mercury at 25 °C.
 *
 * - ρ  = 13 534 kg/m³    (13 546 at 20 °C)
 * - μ  = 1.526 mPa·s
 * - σ  = 485.4 mN/m      (Univ. of Tasmania thesis, within 0.2 %)
 *
 * Optics: mercury is a metal, so light does not enter it; reflection follows
 * the conductor Fresnel equations with a complex refractive index n + ik
 * (Inagaki, Arakawa & Williams 1981, liquid Hg at room temperature):
 *   650 nm: 2.07 + 5.34i   550 nm: 1.55 + 4.65i   450 nm: 1.06 + 3.86i
 * which gives ≈ 78 % reflectance at normal incidence in all three colours:
 * a bright, neutral mirror.
 *
 * Interview fact: per unit mass, mercury's surface tension effect σ/ρ is
 * 3.6×10⁻⁵ m³/s², *half* of water's 7.3×10⁻⁵. Its ripples look lively because
 * its kinematic viscosity ν = μ/ρ = 1.1×10⁻⁷ m²/s is 9× lower than water's,
 * so waves lose energy far more slowly.
 */
export const MERCURY: FluidProperties = {
  id: 'mercury',
  name: 'Mercury',
  density: 13534,
  viscosity: 1.526e-3,
  surfaceTension: 485.4e-3,
  rheology: { kind: 'newtonian' },
  optics: { kind: 'metal', n: [2.07, 1.55, 1.06], k: [5.34, 4.65, 3.86], roughness: 0.03 },
  wetsGround: false,
  stain: [1, 1, 1],
  holdable: false,
  splashes: true,
  sources: [
    'Inagaki, T., Arakawa, E. T. & Williams, M. W. (1981). Optical properties of liquid mercury. Phys. Rev. B 23, 5246–5262 (via refractiveindex.info)',
    'The surface tension of mercury and the adsorption of some hydrocarbons on mercury, University of Tasmania thesis (485.4 dyn/cm at 25 °C)',
    'Mercury viscosity 1.526 mPa·s and density 13 534 kg/m³: standard property tables',
  ],
};

/**
 * Oobleck: cornstarch in water at a starch volume fraction φ ≈ 0.44.
 *
 * - ρ  ≈ 1260 kg/m³      φ·ρ_starch + (1−φ)·ρ_water with ρ_starch ≈ 1.6 g/cm³
 *                        (Fall et al. density-match cornstarch with a 55 wt %
 *                        CsCl solution)
 * - μ₀ ≈ 5 Pa·s          liquid-regime viscosity of a 44 % suspension
 *                        (Fall et al. 2012, viscosity curves of order 1–10 Pa·s)
 * - γ̇_c ≈ 5 /s           onset of thickening: Fall et al. measure a few /s in
 *                        millimetre gaps, growing linearly with gap size
 * - σ  ≈ 72 mN/m         taken equal to water (starch is barely surface active)
 *
 * The rheology model and its justification are in rheology.ts.
 */
export const OOBLECK: FluidProperties = {
  id: 'oobleck',
  name: 'Oobleck',
  density: 1260,
  viscosity: 5,
  surfaceTension: 72e-3,
  rheology: { kind: 'shearThickening', mu0: 5, gammaC: 5, n: 3, muMax: 2000, yieldStress: 0.5 },
  optics: { kind: 'opaque', albedo: [0.7, 0.68, 0.62], ior: 1.36, extinction: 900, roughness: 0.1 },
  wetsGround: true,
  stain: [1.25, 1.22, 1.15],
  holdable: true,
  splashes: false,
  sources: [
    'Fall, A., Bertrand, F., Ovarlez, G. & Bonn, D. (2012). Shear thickening of cornstarch suspensions. J. Rheol. 56, 575–591',
    'Fall, A. et al. (2008). Shear thickening of cornstarch suspensions as a reentrant jamming transition. Phys. Rev. Lett. 100, 018301',
    'Wyart, M. & Cates, M. E. (2014). Discontinuous shear thickening without inertia in dense non-Brownian suspensions. Phys. Rev. Lett. 112, 098302',
    'Brown, E. & Jaeger, H. M. (2014). Shear thickening in concentrated suspensions: phenomenology, mechanisms and relations to jamming. Rep. Prog. Phys. 77, 046602',
  ],
};

/**
 * Lava: basaltic (Hawaiian pāhoehoe) melt at about 1150 °C.
 *
 * - ρ  ≈ 2600 kg/m³      dense basalt melt is ~2700; a little gas lowers it
 * - μ  ≈ 100 Pa·s        pāhoehoe near the vent is 10²–10³ Pa·s; it stiffens
 *                        as it cools and crystallises
 * - σ  ≈ 0.35 N/m        basaltic melts measure 0.30–0.40 N/m
 *
 * Optics: hot enough to glow. The colour is blackbody radiation, ~1000 K
 * (dull red) to ~1550 K (yellow-orange): by Wien's law the peak is in the
 * infrared, so only the red end reaches the visible. The melt is not one
 * temperature: hotter and cooler streaks are folded together by the flow,
 * and the coolest go nearly black. A still surface radiates and darkens;
 * moving melt brings hot rock up and glows brighter.
 */
export const LAVA: FluidProperties = {
  id: 'lava',
  name: 'Lava',
  density: 2600,
  viscosity: 100,
  surfaceTension: 0.35,
  rheology: { kind: 'newtonian' },
  optics: { kind: 'lava', temperature: 1420, crust: [0.035, 0.03, 0.03], crustTime: 2.5, roughness: 0.25 },
  wetsGround: true,
  stain: [0.18, 0.16, 0.15],
  holdable: true,
  splashes: true,
  sources: [
    'Shaw, H. R. et al. (1968). Viscosity, temperature, and stress in molten basalt. Am. J. Sci. 266, 225–264',
    'Murase, T. & McBirney, A. R. (1973). Properties of some common igneous rocks and their melts at high temperatures. GSA Bull. 84, 3563–3592 (density, surface tension)',
    'Hon, K. et al. (1994). Emplacement and inflation of pahoehoe sheet flows. GSA Bull. 106, 351–370 (crust growth)',
  ],
};

/**
 * Red jello: a gelatin dessert gel (~3 % gelatin, sugar), a soft elastic
 * solid rather than a liquid.
 *
 * - ρ  ≈ 1050 kg/m³      water plus dissolved sugar
 * - G  ≈ 1 kPa           shear modulus of a dessert-strength gelatin gel
 *                        (2–3 wt % gelatin gels measure ~0.3–3 kPa)
 * - μ  ≈ 0.6 Pa·s        the internal friction that damps its wobble
 *                        (it settles in about a second)
 * - n  = 1.34
 *
 * Mechanics (a Kelvin–Voigt layer): each column of jello is held to the
 * bowl like a block of rubber glued to a plate. Sheared sideways by ξ, a
 * layer of depth h pulls back with a stress 3Gξ/h, so a column wobbles at
 * ω = √(3G/ρ)/h ≈ 70 rad/s (≈ 11 Hz) in 2.5 cm, and neighbouring columns
 * are coupled by shear waves at c_s = √(G/ρ) ≈ 1 m/s. Slap it and the whole
 * puddle jiggles and springs back.
 *
 * Optics: clear and deep red (strong green and blue absorption by the dye).
 */
export const JELLO: FluidProperties = {
  id: 'jello',
  name: 'Red jello',
  density: 1050,
  viscosity: 0.6,
  surfaceTension: 0.05,
  rheology: { kind: 'elastic', G: 1000 },
  optics: { kind: 'dielectric', ior: 1.34, absorption: [5, 150, 110], roughness: 0.03 },
  wetsGround: false,
  stain: [1, 1, 1],
  holdable: true,
  splashes: false,
  sources: [
    'Gelatin gel moduli: Djabourov, M. et al. (1988). Gelation of aqueous gelatin solutions. J. Phys. France 49, 333–343',
    'Elastic layer on a rigid base (shear spring 3G/h): standard result for a thin bonded layer, cf. lubrication analogy',
  ],
};

/**
 * Hot-tub water at 38 °C (IAPWS formulations): warmer water is a little
 * less dense, about a third less viscous and has lower surface tension, so
 * its ripples live slightly longer.
 */
export const HOT_WATER: FluidProperties = {
  ...WATER,
  density: 992.96,
  viscosity: 0.681e-3,
  surfaceTension: 69.9e-3,
};

/**
 * Chocolate sauce: a cocoa and sugar syrup at room temperature.
 *
 * - ρ  ≈ 1300 kg/m³      a ~65 wt % sugar syrup is 1.32 g/cm³; cocoa solids
 *                        and a little fat bring it close to that
 * - μ  ≈ 2 Pa·s          (estimate) a thick pouring syrup, a few times
 *                        thinner than honey. Real sauces are mildly
 *                        shear-thinning; at puddle shear rates a single
 *                        Newtonian value is a fair approximation
 * - σ  ≈ 0.06 N/m        (estimate) sugar raises water's surface tension a
 *                        little; cocoa butter and emulsifiers lower it
 *
 * Optics: cocoa particles absorb and scatter light within a fraction of a
 * millimetre, so it is opaque and very dark brown, with the glossy sheen of
 * a sugar syrup (n ≈ 1.45, the index of a ~65 % sucrose solution). Its
 * surface is smooth, not lumpy like oobleck's.
 */
export const CHOCOLATE: FluidProperties = {
  id: 'chocolate',
  name: 'Chocolate sauce',
  density: 1300,
  viscosity: 2,
  surfaceTension: 0.06,
  rheology: { kind: 'newtonian' },
  optics: { kind: 'opaque', albedo: [0.075, 0.04, 0.02], ior: 1.45, extinction: 4000, roughness: 0.05, bump: 0.12, sheen: 0.8 },
  wetsGround: true,
  stain: [0.55, 0.42, 0.33],
  holdable: true,
  splashes: true,
  sources: [
    'Sucrose solution tables: ~65 wt % sucrose has ρ ≈ 1.32 g/cm³ and n ≈ 1.45',
    'Viscosity and surface tension: estimates for a thick commercial chocolate syrup (a few Pa·s, mildly shear-thinning)',
  ],
};

export const FLUIDS = { water: WATER, honey: HONEY, chocolate: CHOCOLATE, mercury: MERCURY, oobleck: OOBLECK, lava: LAVA, jello: JELLO };
export type FluidId = keyof typeof FLUIDS;

/** ν = μ/ρ, kinematic viscosity [m²/s]. Momentum diffuses at this rate. */
export function kinematicViscosity(f: FluidProperties): number {
  return f.viscosity / f.density;
}

/**
 * Capillary length ℓc = √(σ / (ρ g)) [m]. Waves much shorter than 2πℓc are
 * dominated by surface tension; much longer ones by gravity.
 * Water ≈ 2.7 mm, mercury ≈ 1.9 mm.
 */
export function capillaryLength(f: FluidProperties, g: number): number {
  return Math.sqrt(f.surfaceTension / (f.density * g));
}

/**
 * Ohnesorge number Oh = μ / √(ρ σ L): viscous forces against inertia and
 * surface tension at length L. Oh ≪ 1 (water, mercury): a liquid sheet
 * breaks into droplets. Oh ≫ 1 (honey ≈ 13): viscosity stops the breakup and
 * you get a few heavy blobs and strings instead of spray.
 */
export function ohnesorge(f: FluidProperties, L = 0.003): number {
  return f.viscosity / Math.sqrt(f.density * f.surfaceTension * L);
}
