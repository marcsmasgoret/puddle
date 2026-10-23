# Credits

## Assets

Puddle ships **no third-party art or audio assets**. Everything you see and hear is generated in code at runtime:

| What | How it is made |
|---|---|
| Scenery (ridges, mountains, trees, boulders, buildings, the Lions Gate Bridge, the CN Tower, the canoe, tent, dock, Muskoka chair) | Procedural geometry from Three.js primitives (`src/scene/world/`) |
| Rubber duck, paper boat, toy sailboat, bobber, skipping stone | Procedural geometry (`src/scene/toyModels.ts`, `src/scene/stones.ts`) |
| Animals (mouse, tabby cat, birds, squirrels, rabbits, deer, fox, fish, loon) | Sculpted from blended shapes, meshed with Surface Nets, auto-skinned and animated with a foot-placement gait engine (`src/scene/animals/`). Coats are shaders; close animals have shell fur. |
| Ground, sand, asphalt, tile, wood, granite, pebbles, snow, leaves | Procedural shaders (`src/render/ground.ts`) |
| Sky, stars, moon, clouds | Procedural shader (`src/scene/atmosphere.ts`) |
| Music, sound effects and nature sounds | Synthesised live with the Web Audio API (`src/audio/`). The winter music includes arrangements of traditional carols in the public domain: *Silent Night* (Gruber, 1818), *Jingle Bells* (Pierpont, 1857), *We Wish You a Merry Christmas* and *Deck the Halls* (traditional). The Lions Gate soundscape quotes the opening notes of *O Canada* (Lavallée, 1880; public domain) as the Canada Place horns play them. |

The original plan allowed CC0 models and sounds (Poly Pizza, Kenney, Quaternius, Poly Haven, Freesound CC0). In the end the calm, abstract art direction worked better with a single procedural style, and it keeps the first load small. If CC0 assets are added later, list each one here with its source URL, author and licence.

## Software

| Library | Licence | Use |
|---|---|---|
| [Three.js](https://threejs.org) | MIT | WebGL rendering, post-processing (EffectComposer, UnrealBloomPass, OutputPass) |
| [Vite](https://vite.dev) | MIT | Build and dev server |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Language |
| [KaTeX](https://katex.org) | MIT | Equation typesetting on the physics write-up page (bundled into that page only) |
| [marked](https://marked.js.org) | MIT | Markdown rendering of the physics write-up |

## Data and science

Physical properties and models are cited where they are used in the code. The main sources:

- IAPWS R1-76(2014), surface tension of ordinary water; IAPWS (2008) viscosity of water; IAPWS-95 density.
- Pope, R. M. & Fry, E. S. (1997). Absorption spectrum (380–700 nm) of pure water. II. *Applied Optics* 36, 8710–8723. Data via the Oregon Medical Laser Center.
- Inagaki, T., Arakawa, E. T. & Williams, M. W. (1981). Optical properties of liquid mercury. *Phys. Rev. B* 23, 5246–5262. Data via refractiveindex.info.
- Yanniotis, S., Skaltsi, S. & Karaburnioti, S. (2006). Effect of moisture content on the viscosity of honey at different temperatures. *J. Food Eng.* 72, 372–377.
- Lazaridou, A. et al. (2004). Composition, thermal and rheological behaviour of selected Greek honeys. *J. Food Eng.* 64, 9–21.
- Fall, A., Bertrand, F., Ovarlez, G. & Bonn, D. (2012). Shear thickening of cornstarch suspensions. *J. Rheol.* 56, 575–591.
- Wyart, M. & Cates, M. E. (2014). Discontinuous shear thickening without inertia in dense non-Brownian suspensions. *Phys. Rev. Lett.* 112, 098302.
- Brown, E. & Jaeger, H. M. (2014). Shear thickening in concentrated suspensions. *Rep. Prog. Phys.* 77, 046602.
- Waitukaitis, S. R. & Jaeger, H. M. (2012). Impact-activated solidification of dense suspensions via dynamic jamming fronts. *Nature* 487, 205–209.
- Glasheen, J. W. & McMahon, T. A. (1996). A hydrodynamic model of locomotion in the basilisk lizard. *Nature* 380, 340–342.
- Bocquet, L. (2003). The physics of stone skipping. *Am. J. Phys.* 71, 150–155.
- Clanet, C., Hersen, F. & Bocquet, L. (2004). Secrets of successful stone-skipping. *Nature* 427, 29.
- Nagahiro, S. & Hayakawa, Y. (2005). Theoretical and numerical approach to "magic angle" of stone skipping. *Phys. Rev. Lett.* 94, 174501.
- Phillips, O. M. (1957). On the generation of waves by turbulent wind. *J. Fluid Mech.* 2, 417–445.
- Gunn, R. & Kinzer, G. D. (1949). The terminal velocity of fall for water droplets in stagnant air. *J. Meteorology* 6, 243–248.
- Minnaert, M. (1933). On musical air-bubbles and the sounds of running water. *Phil. Mag.* 16, 235–248.
- Longuet-Higgins, M. S. & Stewart, R. W. (1964). Radiation stresses in water waves. *Deep-Sea Research* 11, 529–562 (wave drift on toys).
- Shaw, H. R. et al. (1968) and Murase, T. & McBirney, A. R. (1973): basaltic lava viscosity, density and surface tension.
- Djabourov, M. et al. (1988): gelatin gel rheology (red jello).
- Dolbear, A. E. (1897). The cricket as a thermometer. *American Naturalist* 31, 970–971 (cricket chirp rates).
- Wallace, E. (2011). *WebGL Water*: the area-ratio caustics technique (madebyevan.com/webgl-water).
- Stelling, G. S. & Duinmeijer, S. P. A. (2003). A staggered conservative scheme for every Froude number in rapidly varied shallow water flows. *Int. J. Numer. Meth. Fluids* 43, 1329–1354.
- Stoker, J. J. (1957). *Water Waves*. Interscience (the dam-break solution used in validation).
- Smagorinsky, J. (1963). General circulation experiments with the primitive equations. *Monthly Weather Review* 91, 99–164.
