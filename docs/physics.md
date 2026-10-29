# The physics of Puddle

Puddle is a real fluid simulation running on the GPU. Every number that goes into it is a measured property in SI units, and every model below is one you would find in a fluids textbook or paper. This page is the full write-up: the equations, how they are discretised, why the scheme is stable, the assumptions, how each feature (slaps, toys, stones, weather) couples to the fluid, and how the simulation was checked.

---

## 1. The fluid layer: shallow-water equations

The puddle is a thin layer: about 2 m across and 2.5 cm deep at its deepest. When the horizontal scale of the motion is much larger than the depth, the velocity is nearly uniform through the depth and the pressure is hydrostatic. Integrating the Navier–Stokes equations over the depth then gives the **shallow-water equations** for the surface height $\eta(x,z,t)$ above rest and the depth-averaged horizontal velocity $\mathbf u = (u, v)$:

$$\frac{\partial \eta}{\partial t} + \nabla\cdot(h\,\mathbf u) = 0$$

$$\frac{\partial \mathbf u}{\partial t} + (\mathbf u\cdot\nabla)\mathbf u = -g\nabla\eta \;-\; \frac{1}{\rho}\nabla p_s \;+\; \frac{\sigma}{\rho}\nabla\!\left(\nabla^2\eta\right) \;+\; \nu_{\text{eff}}\nabla^2\mathbf u \;-\; c_f\,\mathbf u \;+\; \frac{\boldsymbol\tau_w}{\rho h}$$

with total depth $h = H(x,z) + \eta$ over a fixed floor at depth $H$.

| Term | Physics |
|---|---|
| $-g\nabla\eta$ | Hydrostatic pressure gradient: water runs downhill on its own surface. This makes gravity waves, with speed $c = \sqrt{gh}$. |
| $-\nabla p_s/\rho$ | Pressure applied to the surface: a held finger, a floating toy, wind gusts. |
| $\frac{\sigma}{\rho}\nabla(\nabla^2\eta)$ | Surface tension. A curved surface has a pressure jump $\Delta p = -\sigma\nabla^2\eta$ (Young–Laplace), so curvature gradients push fluid. This makes capillary ripples. |
| $\nu_{\text{eff}}\nabla^2\mathbf u$ | In-plane viscous diffusion of momentum (molecular, plus a turbulence model, §2.5). |
| $-c_f\mathbf u$ | Friction against the floor (§1.2). |
| $\boldsymbol\tau_w/(\rho h)$ | Wind stress on the surface, shared over the layer (§7.2). |

The first equation is exact conservation of volume. The second is Newton's second law per unit mass of the column.

### 1.1 Linear waves and dispersion

Linearising about rest for a single Fourier mode $e^{i(kx-\omega t)}$ gives

$$\omega^2 = H k^2\left(g + \frac{\sigma}{\rho}k^2\right) \quad\Rightarrow\quad c = \frac{\omega}{k} = \sqrt{H\left(g + \frac{\sigma k^2}{\rho}\right)}$$

Long waves travel at $\sqrt{gH}$, about 0.5 m/s in 2.5 cm of water. Short ripples travel faster because surface tension stiffens them. The crossover is the capillary length $\ell_c = \sqrt{\sigma/\rho g}$: 2.7 mm for water and 1.9 mm for mercury.

### 1.2 Bottom friction: two regimes

The floor is no-slip, so the flow has a boundary layer. Depth-averaging the wall shear gives a linear drag $-c_f\mathbf u$, whose coefficient depends on how thick that layer is compared with the depth.

- **Slow or very viscous flow** (honey, oobleck, very shallow edges). Viscosity reaches the surface and the profile is parabolic (Poiseuille). The wall shear is $\tau = 3\mu\bar u/h$, so
  $$c_f = \frac{3\nu}{h^2}$$
- **Oscillating waves in a thin fluid** (water, mercury). Shear is confined to a Stokes layer of thickness $\delta = \sqrt{2\nu/\omega}\ll h$. The time-averaged energy loss gives an equivalent
  $$c_f \approx \frac{\sqrt{\nu\omega/2}}{h}$$

The solver uses the larger of the two, which picks the right regime automatically. The reference frequency is $\omega = 2\pi\times 5$ Hz, typical of slap and stir waves.

**Example.** For water 2.5 cm deep, $c_f \approx 0.16\ \text{s}^{-1}$, so a ripple's amplitude decays at $c_f/2$ and falls by $e$ in about 12 s. Honey is $\approx 7000\times$ more viscous: $3\nu/h^2 \approx 25\ \text{s}^{-1}$, so honey waves are overdamped and the surface oozes rather than rings.

---

## 2. Discretisation

### 2.1 Grid

The puddle sits in a $2.3 \times 1.65$ m domain. It is divided into square cells, 512 across on desktop ($\Delta x = 4.5$ mm) and 256 on phones ($\Delta x = 9$ mm).

Variables live on a **staggered (Arakawa C) grid**:
- $\eta$ at cell centres
- $u$ on the left and right faces
- $v$ on the near and far faces

Every difference in the equations is then a compact two-point difference across a cell. That avoids the checkerboard noise of collocated grids and makes volume conservation exact. One RGBA float texel per cell holds $(\eta,\ u_{i-1/2},\ v_{j-1/2},\ \theta)$, where $\theta$ is the positivity limiter (§2.4).

### 2.2 Time stepping: forward–backward

Each step runs as three GPU passes:

1. **Velocity**: $\mathbf u^{n+1}$ from $\mathbf u^n$ and $\eta^n$.
2. **Limiter**: how much outflow each cell can actually supply (§2.4).
3. **Height**: $\eta^{n+1}$ from $\eta^n$ and the *new* $\mathbf u^{n+1}$.

Using the updated velocity in the height update makes the scheme "symplectic Euler". For linear waves it is neutrally stable: no artificial growth or decay, so the only damping in the simulation is physical. Two render targets are ping-ponged: each pass reads one and writes the other.

### 2.3 Terms in the velocity pass

- **Advection** $(\mathbf u\cdot\nabla)\mathbf u$: momentum-conserving upwind (Stelling & Duinmeijer 2003). The velocity form is exact for smooth flow. Across a bore (a breaking front, a dam break) it conserves the wrong quantity, and the front runs slow. Writing the conserved momentum $h\mathbf u$ and dividing out $h$ gives
  $$(\mathbf u\cdot\nabla)\mathbf u \;\to\; \frac{1}{h}\Big[\nabla\cdot(\mathbf q\,\mathbf u) - \mathbf u\,\nabla\cdot\mathbf q\Big], \qquad \mathbf q = h\mathbf u$$
  The discharges $\mathbf q$ are built from the same upwind face depths as the height pass. For smooth flow this is ordinary first-order upwinding; across a bore it gives the correct mass and momentum jump conditions (§10).
- **Gravity and surface pressure**: centred two-point differences across the face.
- **Capillary term**: a discrete Laplacian of $\eta$ at the two neighbouring cells, then differenced across the face. At the shoreline, dry neighbours take the wet cell's height (zero-slope condition).
- **Viscous diffusion** $\nu_{\text{eff}}\nabla^2\mathbf u$: explicit. Its stability limit is $\nu\,\Delta t/\Delta x^2 \le \tfrac14$, so the in-plane coefficient is capped there. The full viscosity always acts through the bed friction (next item), which dominates in a thin layer. The cap only affects grid-scale wiggles in honey and jammed oobleck.
- **Bed friction**: implicit. Writing $(u^{n+1}-u^*)/\Delta t = -c_f u^{n+1}$ gives $u^{n+1} = u^*/(1+c_f\Delta t)$, which is unconditionally stable even for honey's huge $c_f$.
- **Speed cap**: a safety clamp on $|\mathbf u|$ (1.2 m/s), applied to the velocity *vector* so it favours no direction.

### 2.4 Height pass: conservative fluxes with a positivity limiter

$$\eta_{ij}^{n+1} = \eta_{ij}^n - \frac{\Delta t}{\Delta x}\Big[(hu)_{i+\frac12} - (hu)_{i-\frac12} + (hv)_{j+\frac12} - (hv)_{j-\frac12}\Big]$$

The flux through each face is (face depth) × (face velocity). The face depth is the rest depth averaged across the face plus the *upwind* surface height. Whatever leaves one cell enters its neighbour, so total volume is conserved to round-off.

A hard slap can ask a cell to drain faster than it holds water, with several faces flowing out at once. That would make the depth negative and the scheme unstable.

The **limiter pass** computes, for every cell, the fraction $\theta\le1$ of its requested outflow it can actually supply without going below a thin film. Each face flux is multiplied by $\theta$ of its *donor* (upwind) cell. Both neighbours see the same scaled flux, so volume is still exactly conserved and depth never goes negative. This is the standard positivity-preserving approach used in shallow-water codes.

### 2.5 Breaking flow: a Smagorinsky turbulence model

When flow outruns the local wave speed (Froude number $\text{Fr} = |\mathbf u|/\sqrt{gh} > 1$), real water breaks into turbulence finer than the grid. Those unresolved eddies are modelled as an extra viscosity that switches on only where the flow is sharply sheared:

$$\nu_t = (C_s\Delta x)^2|S|, \qquad |S| = \sqrt{2u_x^2 + 2v_z^2 + (u_z+v_x)^2}, \qquad C_s = 0.17$$

### 2.6 Boundaries

The puddle's outline is an irregular closed curve (random Fourier harmonics on an ellipse), or a rounded rectangle for the pool. From it, an exact **signed distance field** is computed once. It gives the wet/dry mask, the soft shoreline in rendering and the wet ring on the ground.

Faces touching a dry cell carry zero velocity: no flow through the wall, $\mathbf u\cdot\mathbf n = 0$. Waves therefore reflect off the real organic edge.

The floor is a shallow saucer about 32 cm wide around the rim, rising to about 1 mm at the edge, with gentle lumps. Wave speed $\sqrt{gh}$ drops toward the shallows, so waves slow down and bend there, like swell approaching a beach.

### 2.7 Stability and substeps

For the linearised forward–backward scheme, each grid mode with discrete Laplacian eigenvalue $\lambda$ oscillates at $\omega^2 = H(g\lambda + \tfrac{\sigma}{\rho}\lambda^2)$, and the scheme is stable iff $\omega\Delta t \le 2$ for every mode. In 2D the largest eigenvalue is $\lambda_{\max} = 8/\Delta x^2$ (the checkerboard mode), so

$$\Delta t \le \frac{2}{\omega_{\max}}, \qquad \omega_{\max} = \sqrt{H_{\max}\left(\frac{8g}{\Delta x^2} + \frac{64\sigma}{\rho\,\Delta x^4}\right)}$$

with $H_{\max}$ budgeted at twice the rest depth, so raised crests stay stable. The explicit upwind advection needs $(|u|+|v|)\Delta t \le \Delta x$; with the speed capped at $U_{\max}$, that means $\Delta t \le \Delta x/(\sqrt2\,U_{\max})$. A safety factor of 0.8 applies to both, and each rendered frame is split into that many substeps.

At $\Delta x = 4.5$ mm in water the capillary term dominates: $\Delta t \approx 1.9$ ms, about 9 substeps per 60 Hz frame.

---

## 3. The fluids and their real properties

The simulation runs in real SI units at real size, so no hidden scaling is applied anywhere. The only link between reality and the simulation is the grid spacing: ripples shorter than about $2\Delta x$ cannot be represented.

| | Water (20 °C) | Honey | Chocolate | Mercury | Oobleck | Lava | Jello |
|---|---|---|---|---|---|---|---|
| Density $\rho$ (kg/m³) | 998.21 | 1420 | ≈ 1300 | 13 534 | ≈ 1260 | ≈ 2600 | ≈ 1050 |
| Viscosity $\mu$ (Pa·s) | $1.0016\times10^{-3}$ | 7.4 | ≈ 2 | $1.526\times10^{-3}$ | 5 at rest, shear-thickening (§4) | ≈ 100 | 0.6 (internal damping) |
| Surface tension $\sigma$ (N/m) | 0.07274 | 0.063 | ≈ 0.06 | 0.4854 | ≈ 0.072 | ≈ 0.35 | ≈ 0.05 |
| Elasticity | none | none | none | none | none | none | shear modulus $G \approx 1$ kPa (§4.2) |
| Optics | $n = 1.333$, Pope & Fry absorption | $n = 1.49$, blue-absorbing | opaque dark brown, glossy ($n \approx 1.45$) | conductor, $n+ik$ (Inagaki 1981) | opaque white suspension | marbled blackbody glow (§4.3) | $n = 1.34$, red dye absorption |

**Sources:**
- Water: IAPWS R1-76(2014), IAPWS 2008, IAPWS-95; Pope & Fry 1997.
- Honey: mean of commercial honeys at 20 °C, Newtonian (Yanniotis et al. 2006). Its viscosity ranges from ~2 to ~60 Pa·s with water content (Lazaridou et al. 2004).
- Chocolate: density and index from sucrose-solution tables (~65 wt %); viscosity and surface tension are estimates for a thick commercial syrup, which is mildly shear-thinning but close to Newtonian at puddle shear rates.
- Mercury: Inagaki, Arakawa & Williams 1981.
- Oobleck: a starch volume fraction of 0.44 after Fall et al. 2012.
- Lava: basaltic (pāhoehoe) melt near 1150 °C; Shaw et al. 1968, Murase & McBirney 1973.
- Jello: a dessert-strength gelatin gel (2–3 wt %); Djabourov et al. 1988.

**Two facts worth knowing:**
- **Mercury's ripples are lively, but not because of its famous surface tension.** Per unit mass, its surface-tension effect $\sigma/\rho$ is *half* of water's. The real reason is its kinematic viscosity, 9× lower than water's, so its waves lose energy much more slowly.
- **Honey's colour is depth-dependent Beer–Lambert absorption.** Its blue absorption is roughly 20× its red, so light that crosses more honey is more golden.

---

## 4. Oobleck, jello and lava

### 4.1 Oobleck: shear thickening

Cornstarch in water at a volume fraction around 0.44 flows like thick cream when stirred slowly and locks up almost solid when hit. Microscopically:
- At low strain rate, lubricating films keep the grains apart.
- Above a critical rate, the grains are forced into frictional contact. The packing wants to dilate, but the free surface confines it, and it jams (Fall et al. 2008, 2012; Brown & Jaeger 2014; Wyart & Cates 2014).

The model is a **capped power law with a small yield stress**:

$$\mu(\dot\gamma) = \min\!\left(\mu_{\max},\ \mu_0\left[1 + \left(\frac{\dot\gamma}{\dot\gamma_c}\right)^{n-1}\right] + \frac{\tau_y}{\dot\gamma + \dot\gamma_\epsilon}\right)$$

with $\mu_0 = 5$ Pa·s, $\dot\gamma_c = 5\ \text{s}^{-1}$, $n = 3$, $\mu_{\max} = 2000$ Pa·s and $\tau_y = 0.5$ Pa.

- **The power law** is the standard two-parameter description of the thickening branch (Ostwald–de Waele). Real cornstarch thickening is discontinuous; $n = 3$ is a smoothed, numerically stable stand-in (10× faster flow ⇒ ~100× more viscous).
- **The ceiling** $\mu_{\max}$ represents the jammed state. Its stress is bounded by how hard the free surface can confine the grains, $\tau_{\max}\sim\sigma/a$, about a few kPa for 15 µm grains (Brown & Jaeger).
- **The yield term** reproduces the "solid–liquid–solid" sequence Fall et al. observe at very low rates.
- **Why not a full Wyart–Cates model?** It needs an extra evolving field (the fraction of frictional contacts). The capped power law captures what matters here (slow = liquid, fast = solid, with the right onset rate) from the local strain rate alone.

In the depth-averaged layer the shear is largest at the bed, where the Poiseuille profile gives $3\bar u/h$. It is combined with the in-plane strain:

$$\dot\gamma = \sqrt{(3|\bar{\mathbf u}|/h)^2 + |S|^2}$$

**Result:**
- A hard slap shears the layer far above $\dot\gamma_c$, the viscosity jumps to its ceiling, the implicit bed friction stops the flow within a millisecond, and the surface barely ripples. A hand-sized slap at full strength moves it by about 0.2 mm, compared with 4 mm for water.
- A slow press keeps $\dot\gamma$ low, so the finger sinks in. A dense suspension is dragged along over a zone several fingertips wide, so it sinks into a wide funnel (§5.3).
- Pulled out quickly, it jams: the hole keeps its shape for about 0.4 s, then the suspension relaxes and the hole oozes shut over a second or so. It never clings to the finger the way honey does.
- When oobleck is hit it goes matte for a moment: the jammed grains poke through the surface (dilatancy). The renderer shows this, including a jammed patch that spreads wider than the impactor (Waitukaitis & Jaeger 2012).

### 4.2 Jello: an elastic gel

Jello is not a liquid but a soft solid, so the layer gets one more field: the sideways displacement $\boldsymbol\xi$ of each column since rest, updated alongside the velocity ($\dot{\boldsymbol\xi} = \mathbf u$, after the velocity pass, so the scheme stays symplectic). A layer of depth $h$ bonded to the bowl and sheared by $\xi$ pulls back like a block of rubber glued to a plate, with stress $3G\xi/h$ (the elastic twin of the Poiseuille friction $3\mu\bar u/h$). Neighbouring columns are coupled by shear, $(G/\rho)\nabla^2\boldsymbol\xi$. The momentum equation gains

$$\frac{\partial \mathbf u}{\partial t} \mathrel{+}= -\frac{3G}{\rho h^2}\,\boldsymbol\xi + \frac{G}{\rho}\nabla^2\boldsymbol\xi$$

so each column wobbles at $\omega = \sqrt{3G/\rho}/h \approx 70$ rad/s (≈ 11 Hz) in 2.5 cm, disturbances spread as shear waves at $c_s = \sqrt{G/\rho} \approx 1$ m/s, and the viscous term damps the jiggle in about a second. The stability bound adds $3G/(\rho h_{\min}^2) + 8G/(\rho\Delta x^2)$ to $\omega_{\max}^2$ (§2.7).

### 4.3 Lava: a marbled glow

Lava runs through the same equations with its own properties: dense, very viscous (so its waves are overdamped, like honey's) and with a high surface tension. What is new is the surface. Exposed melt at about 1420 K glows: its colour is blackbody radiation (by Wien's law the peak is at 2.0 µm, in the infrared, so only the red end reaches the visible) and its brightness follows the Stefan–Boltzmann $T^4$. The surface radiates and cools, and a thin dark skin grows over still melt in seconds; wherever the melt moves or stretches, the skin tears. The skin is still liquid and streams with the melt. A skin field $c \in [0, 1]$ per cell models this:

$$\frac{dc}{dt} = \frac{c_{eq} - c}{t_{crust}} - c\left(\frac{|\mathbf u|}{0.02\ \text{m/s}} + \frac{|S|}{2\ \text{s}^{-1}}\right)$$

with $t_{crust} \approx 2.5$ s and $c_{eq} < 1$ over slowly drifting convective hot spots, where fresh melt keeps welling up.

The melt is not one temperature. Hotter and cooler rock is folded together into a marble of yellow, orange, red and nearly black ribbons, drawn on material coordinates that are advected with the depth-averaged velocity, so a slap or a stir stretches and swirls the pattern exactly as the flow moves. The coordinates relax back to rest over about 20 s, so the marble never smears into endless streaks, and a slow convective churn keeps it alive when the pool is still. The skin field dims the cooler ribbons where the surface sits still; moving melt tears it and glows brighter.

---

## 5. Interactions

### 5.1 The slap

A flat hand of radius $a$ hitting the surface at speed $V$ hands over the momentum of the fluid's added mass, the model Glasheen & McMahon (1996) used for the basilisk lizard:

$$J = \tfrac43\rho a^3 V$$

It is spread as a Gaussian pressure impulse $\Pi(r) = \Pi_0 e^{-r^2/a^2}$ with $\Pi_0 = J/(\pi a^2)$, and the layer's velocity changes by $\Delta\mathbf u = -\nabla\Pi/\rho$. That pushes fluid outward, digging a dent and throwing up a ring, while adding no volume. The strength slider sets the hand speed, from 0.3 to 5 m/s.

**Where shallow water stops being shallow water.** A depth-averaged layer cannot carry flow much faster than its own wave speed: beyond Froude number ≈ 1 the water leaves the surface as a sheet and breaks into drops. So:
1. The impulse given to the layer is capped at $\text{Fr} = 1$.
2. The rest of the momentum goes into **spray**: $J_{\text{spray}} = (1-s)\,J\,\varepsilon$, where $s$ is the fraction the layer keeps.
3. The spray efficiency $\varepsilon = 0.5/(1+5\,\text{Oh})$ falls with the **Ohnesorge number** $\text{Oh} = \mu/\sqrt{\rho\sigma L}$. Water and mercury (Oh ~ $10^{-3}$) break into fine spray. Honey (Oh ≈ 13) throws only a few heavy blobs. Oobleck jams and does not splash at all.
4. The spray mass follows from the drops' mean launch speed $\bar v$: $m_{\text{spray}} = J_{\text{spray}}/\bar v$.

The factor 0.5 in $\varepsilon$ accounts for momentum lost to the bed, turbulence and the crater. It is an assumption, stated as such.

**Mass is conserved.** The spray volume is removed from the puddle at the slap and returned wherever each drop lands. Drops landing on the ground leave drying wet spots and drain back.

### 5.2 Drops and rain

Each drop flies ballistically under gravity and quadratic air drag ($C_d \approx 0.47$, $\rho_{\text{air}} = 1.204$ kg/m³). Drop sizes are log-uniform between 1.2 and 4.5 mm, scaled up by $(1+\text{Oh})^{1/3}$ for viscous liquids.

A drop landing on water hands over its momentum $m v$ as a pressure impulse over a few drop radii, never narrower than the grid resolves, and adds its volume. That makes secondary ripples.

Raindrops do the same at their terminal velocity, about 6.5 m/s for 2 mm drops (Gunn & Kinzer 1949). Non-wetting mercury drops stay as beads on the ground and roll back into the puddle.

### 5.3 The fingertip: poking, pressing and stirring

A quick tap is a slap. A press that moves becomes a stir, and a press held still becomes a push into the fluid; either way the fingertip (radius $a \approx 9$ mm) goes into the layer, and three things follow:

1. **Displacement.** Pushing the tip a depth $d$ in displaces $\pi a^2 d$ of fluid, added around the finger (and taken back as it comes out). In water it leaves as ripples; in honey it bulges into a raised collar that slowly spreads.
2. **The dimple.** Water barely notices a slowly inserted finger (only the meniscus dips); a viscous liquid is dragged down with it. The dimple depth is $\delta = w\,d$, with a wetting-drag weight $w$ rising with viscosity on a log scale (≈ 0.08 for water and mercury, ≈ 0.85 for honey, oobleck and lava), applied as a surface pressure $p = \rho g\delta$. Dragged sideways this is a moving pressure disturbance, exactly what a ship's hull is to the sea: a bow bulge, a trough behind, and once the finger outruns $\sqrt{gH}$ a **V-shaped wake** with half-angle $\sin\alpha = c/U$ (a supersonic jet's Mach cone). In honey the trench it leaves closes slowly.
3. **No-slip drag.** The fluid touching the finger moves with it: $\Delta\mathbf u = \kappa\,\mathbf U_f$, with $\kappa = 1 - e^{-t_c/\tau}$, $t_c = 2R_f/|U_f|$ the time the finger spends over a point and $\tau \approx 50$ ms. This is what swirls water, and what makes oobleck jam when you drag too fast.

Pulling out of a viscous liquid, the liquid clings to the skin and is lifted in a short-lived mound before it oozes back (a brief negative pressure after release).

**A limitation worth naming.** The shallow-water layer treats honey's levelling as thin-film flow, with rate $\propto h^3 k^2$. For features narrower than the depth ($kh > 1$) real honey relaxes as a deep viscous fluid, at rate $\sim \rho g/(2\mu k)$, roughly a hundred times slower than the thin-film estimate for a fingertip-sized trench. So narrow trenches in honey close faster here than they would in a jar.

---

## 6. Floating toys: rigid bodies with two-way coupling

### 6.1 The bodies

The duck, paper boat, toy sailboat and fishing bobber have their real sizes and masses:

| Toy | Size | Mass |
|---|---|---|
| Duck | 9 cm long | 25 g |
| Paper boat | 12 cm long | 3 g |
| Sailboat | 16 cm long | 45 g |
| Bobber | 2.4 cm across | 3.6 g |
| Beach donut | 17 cm across | 12 g (740 cm³ of air: draft ≈ 1 mm) |
| RC boat | 20 cm long | 60 g (draft ≈ 1 cm) |

Each hull is voxelised into small sample volumes. The paper boat's flat folded base gives it a metacentric height $BM = I_{wp}/V \approx 5$ cm, far above its 9 mm centre of mass, so it is stable.

### 6.2 Fluid → body

A body reads the fluid on a **ring just outside its footprint** and fits a plane $\eta \approx \eta_0 + s_x\Delta x + s_z\Delta z$ to it. That gives the incoming waves and their slope without the body feeling its own dent. Then:

- **Buoyancy (Archimedes)** at every sample: $F_i = \rho g f_i\,dV_i$, where $f_i$ is the sample's submerged fraction. A body on a tilted wave gets more lift on its low side; the torque $\sum \mathbf r_i\times\mathbf F_i$ rocks it.
- **Stokes drag** $-6\pi\mu R_e\phi^{1/3}\mathbf w$ and **form drag** $-\tfrac12\rho C_d\pi R_e^2\phi^{2/3}|\mathbf w|\mathbf w$ act on the equivalent sphere $R_e = (3V/4\pi)^{1/3}$. Here $\phi$ is the immersed fraction and $\mathbf w$ the velocity relative to the current, so waves and stirring carry toys along. Stokes drag dominates in honey; form drag in water and mercury.
- **Oobleck**: $\mu$ is evaluated at the strain rate $|\mathbf w|/R_e$. A dropped toy stops dead on the jammed surface, then slowly sinks in.
- **Wave-radiation damping.** A bobbing body makes waves, and the waves carry its energy away. Shallow water is mathematically **2D acoustics**: substitute pressure $\rho g\eta$ and sound speed $\sqrt{gh}$. A pulsating source of volume flux $Q$ radiates power $P = \rho\omega Q^2/8h$. With $Q = A\dot y$ for waterplane area $A$, that gives
  $$B = \frac{\rho\,\omega\,A^2}{4h}$$
  In a 2.5 cm puddle this is strong: toys settle in a bob or two, and a duck dropped on dense mercury lands with a plop instead of bouncing.

- **Wave drift.** Waves that run into a floating body are partly reflected, and reflecting a wave takes momentum: the body feels a steady push along the waves' direction of travel (radiation stress, Longuet-Higgins & Stewart 1964). A shallow-water wave carries momentum $E/c$ per unit width, with $E = \tfrac12\rho g a^2$, and since $u = \eta c/h$ in a progressive wave, $E/c = \rho c\langle\eta u\rangle$. For a body of width $W$:
  $$F_{drift} = \rho\,c\,\langle\eta\,\mathbf u\rangle\,W$$
  measured on the ring around each toy and averaged over ~0.4 s. It is what pushes toys away from a slap: four slaps moved the donut about 0.5 m.
- **The shore.** The water is level with the ground, so a floating toy is held a little inside the edge and bounces softly off it, instead of riding up the bank.

Large damping terms are integrated implicitly, $v \leftarrow (v + a\Delta t)/(1 + C\Delta t/m)$, which is unconditionally stable. Substeps are sized from the heave frequency $\omega = \sqrt{\rho g A/m}$.

**Check.** At rest every toy floats at buoyancy = weight. Measured draft of the duck:

| Fluid | Draft |
|---|---|
| Water | 7.7 mm |
| Honey | 5.9 mm (the water draft divided by 1.42, honey's density) |
| Oobleck | 6.6 mm |
| Mercury | 0.8 mm: it rides on top |

### 6.3 Body → fluid

- **Pressure loads.** The buoyant force of the submerged samples is binned into three patches along the hull (bow, middle, stern). Each becomes a Gaussian pressure load with the same total force, drawn into a pressure-map texture. The patches are kept inside the hull's footprint: real water meets the hull at the waterline and is flat outside it. The fluid feels the equal and opposite push (Newton's third law): the toy sits in a real dent, and a moving toy pushes a bow wave and leaves a wake.
- **Drag reaction.** Momentum $-\mathbf F_d\Delta t$ is added to the water over the hull's footprint.
- **Entry.** A toy landing is a small slap: the same impact model, limited to the momentum the toy carries ($m v$).

---

## 7. Stone skipping and fishing

### 7.1 Stone skipping

The model follows Bocquet (2003), which explains the experiments of Clanet, Hersen & Bocquet (2004). The stone is a flat granite pebble 4 cm across (17 g), tilted at angle $\varphi$ with its back edge low. Spin holds $\varphi$ nearly constant through each contact.

**Contact force** (Bocquet eq. 1):
$$\mathbf F = \tfrac12\rho V^2 S\,(C_l\,\mathbf n - C_f\,\hat{\mathbf t})$$
- **Wetted area.** $S$ is a circular segment of the disc (Bocquet eq. 9) with chord depth $s = z/\sin\varphi$, where $z$ is the trailing edge's immersion. If the whole face goes under, the lift is lost and the stone sinks.
- **Lift.** $C_l \approx 1$.
- **Friction.** Bocquet uses $C_f\approx C_l\approx1$ as an order-of-magnitude upper bound. With it, a stone loses about 3/4 of its speed in one contact, which high-speed films don't show. The real skin friction of a planing disc at $Re\sim10^5$ is about 100× smaller; most of the braking comes from the lift itself leaning back with the face, $\mu\approx\tan\varphi$, which is the pressure picture of Nagahiro & Hayakawa (2005). Puddle uses $C_f = 0.05$, which allows for spray drag too.
- **Elastic rebound.** Because $V^2$ is dominated by the fast horizontal speed, the vertical motion during contact is a spring, and the stone rebounds nearly elastically, as observed.

**Spin.** Each impact knocks the tilt by about $g/(R\Omega^2)$ (Bocquet §V). The errors add up, so the number of skips is limited by $N_{\text{spin}}\sim R\Omega^2/g$ as well as by speed.

**The flick.** A side-arm throw releases the stone about 4 cm above the water, coming in at about 18°.
- The flick's speed sets throw speed and spin.
- The flick's angle sets the tilt.

**What comes out, verified offline:**
- No bounce below about 1.5 m/s.
- Skips grow with speed.
- At this incidence the best tilt is 15–20°, the **"magic angle"**.
- Low spin wobbles out after a couple of skips.

**Other fluids:**
- **Mercury.** It is 13.5× denser, so the lift is too: more and higher skips. Granite is lighter than mercury, so the stone ends up floating.
- **Honey.** Its viscous drag swallows the stone.
- **Jammed oobleck.** The stone clatters across it like a hard floor (restitution 0.45, sliding friction), then sinks in once it slows.

### 7.2 Fishing

The bobber is a 2.4 cm, 3.6 g float. It flies from a rod tip off-screen on a ballistic arc, lands with a splash and floats as a rigid body like the toys. Occasional "nibbles" are downward tugs of about 0.02 N, a few grams-force. They dip it and send out their own rings.

### 7.3 The RC boat

A 20 cm toy speedboat, floating like the other toys, with a propeller and a rudder:

- **Thrust** up to $T_{max} = 0.25$ N along the hull. Its reaction is a jet of water thrown backward: momentum $-\mathbf T\,\Delta t$ added to the fluid over a 2 cm patch at the stern.
- **Rudder**: a side force $\tfrac12\rho v|v| A_r \sin\delta$ at the stern turns the hull, so it steers only while moving, and harder the faster it goes. The keel resists sideways slip.
- **Top speed** is where thrust balances form drag, about 0.8 m/s: faster than $\sqrt{gh} \approx 0.5$ m/s in 2.5 cm. The boat outruns its own waves and drags a V-shaped wake (§5.3).

---

## 8. Weather and seasons

- **Wind stress.** Wind exerts a mean surface stress $\tau = \rho_{\text{air}}C_DU^2$ with $C_D\approx1.3\times10^{-3}$, the standard neutral drag coefficient of a water surface. Spread over the layer it slowly drives a drift current.
- **Gusts.** Turbulent gusts press on the water as patches of fluctuating pressure (a few Pa) moving with the wind. This is **Phillips' (1957) mechanism** for how wind first raises ripples, and the "cat's paws" crossing the puddle are real solver waves.
- **Wind on toys.** Toys also feel air drag, $\tfrac12\rho_{\text{air}}C_dA U^2$, on the area above water, so the sailboat drifts fastest. The wind speed $U$ is the one at about 2 m; a toy sits about 5 cm up, inside the surface boundary layer, where the log profile $u \propto \ln(z/z_0)$ ($z_0 \approx 0.2$ mm over water) gives about 60 % of it, so the drag is taken as 0.36 of the free-stream value. A clear day is nearly calm (0.15 m/s), so toys linger near the middle.
- **Autumn leaves** fall, land, and float as passive tracers. They ride $\eta$ and are carried by the depth-averaged current, plus about 3% of the wind speed (the usual surface-drift rule of thumb).
- **Winter ice.** The puddle's shallow edge loses heat fastest, so a thin band of ice grows in from the shore.
  - Only on water: honey doesn't freeze, and mercury not until −39 °C.
  - Ice is a **rigid lid**, a second no-slip surface, modelled as strong extra damping, so waves stop at the ice edge.
  - A slap shatters it into Voronoi shards. It refreezes over about a minute.
- **The hot tub.** In winter the backyard pool becomes a hot tub at 38 °C. Water there is slightly less dense (992.96 kg/m³), about a third less viscous (0.681 mPa·s) and lower in surface tension (69.9 mN/m). Its jets are bubble upwellings forcing the surface.

---

## 9. Rendering: physical optics

Each pixel of the fluid surface mixes light paths weighted by the exact Fresnel equations.

- **Dielectrics** (water, honey). Light splits at the surface:
  - **Refraction**: view rays bend by Snell's law ($n_1\sin\theta_1 = n_2\sin\theta_2$) through the per-pixel surface normal $\mathbf n \propto(-\partial_x\eta, 1, -\partial_z\eta)$. They are traced to the actual floor and dimmed by **Beer–Lambert** absorption $e^{-\kappa L}$ per colour.
  - **Reflection** uses the exact unpolarised Fresnel reflectance, about 2% looking straight down and nearly 100% at grazing angles. That is why a puddle is a window at your feet and a mirror further away.
- **Mercury** is a metal: no refraction. Its reflectance comes from the conductor Fresnel equations with its measured complex index (≈78%, neutral). Mercury doesn't wet soil (contact angle ≈140°), so its edge is a rounded bead that catches light.
- **Oobleck** scatters light within a millimetre, so it looks like matte cream with a wet sheen. Very thin films show the floor through them.
- **Caustics** use the area-ratio method (after Evan Wallace's WebGL Water). Sunlight rays are refracted through the wave surface and drawn where they land on the floor. Each small triangle carries the light of its flat-water area, so the intensity is $I = A_{\text{flat}}/A_{\text{landed}}$. Flat water gives exactly $I = 1$ and total light is conserved: measured mean 1.0003 with waves. Through honey the caustics are tinted by the absorption along the light's path.
- **The sun's glint** is a GGX microfacet specular lobe. ACES filmic tone mapping and a soft bloom finish the frame.
- **Wet ground** is darker and glossier: water fills the pores between grains and lowers the refractive-index contrast at their surfaces.

---

## 10. Validation

The [validation page](https://marcmasgoret.ca/puddle/validate.html) runs the production GPU solver in flat test tanks, where the answer is known analytically, on the visitor's own GPU. The numbers below are from a run at Δx = 9.0 mm (256 × 184 cells). The page itself defaults to the desktop grid.

**Wave speed.** A long, low ridge (20 µm high, so linear) splits into two pulses. Each is tracked to sub-cell precision.

| Depth $H$ | $\sqrt{gH}$ (m/s) | Measured (m/s) | Error |
|---|---|---|---|
| 5 mm | 0.2215 | 0.2214 | −0.03 % |
| 10 mm | 0.3132 | 0.3127 | −0.16 % |
| 20 mm | 0.4429 | 0.4419 | −0.23 % |
| 30 mm | 0.5425 | 0.5412 | −0.25 % |

**Dispersion.** Standing waves $\cos kx$ in water 1 cm deep, from 2.3 m long down to 4 cm, the shortest held up by surface tension. Every measured frequency matches the scheme's own discrete dispersion relation (§2.7, with the time-stepping and damping corrections) to within 0.04 %. Against continuum shallow-water theory, the gap at the shortest waves is grid resolution: −9 % at 4 cm, which is 4.6 cells per wavelength. Against full linear (Airy) theory, the short waves also show the shallow-water approximation itself: +19 % at 4 cm, where $kH = 1.5$.

**Damping.** Standing waves decay at the rate predicted by the damped oscillator $\ddot\eta + \gamma\dot\eta + \omega_0^2\eta = 0$, with $\gamma$ from the bed-friction law (§1.2).

| Regime | $\nu$ (m²/s) | Depth | Predicted (1/s) | Measured (1/s) | Error |
|---|---|---|---|---|---|
| Stokes layer | $10^{-6}$ | 20 mm | 0.0991 | 0.0990 | −0.2 % |
| Stokes layer | $10^{-5}$ | 20 mm | 0.314 | 0.312 | −0.6 % |
| Stokes layer | $10^{-4}$ | 20 mm | 0.997 | 0.994 | −0.3 % |
| Stokes layer | $3\times10^{-4}$ | 20 mm | 1.73 | 1.73 | −0.5 % |
| Poiseuille (honey) | $5.2\times10^{-3}$ | 4 mm | 0.0194 | 0.0196 | +0.7 % |
| Poiseuille (honey) | $5.2\times10^{-3}$ | 6 mm | 0.0654 | 0.0655 | +0.1 % |
| Poiseuille (honey) | $5.2\times10^{-3}$ | 10 mm | 0.301 | 0.301 | +0.1 % |
| Poiseuille (honey) | $5.2\times10^{-3}$ | 15 mm | 1.01 | 1.01 | +0.2 % |

The honey rows show the thin-film levelling law: the decay rate grows as $h^3$.

**Volume conservation.** Twenty very hard slaps in the real puddle bowl: a 6 cm hand at 5 m/s, with the Froude cap and spray switched off, so the flow runs far past Froude 1. Worst drift over 6 s:

| Fluid | Relative drift |
|---|---|
| Water | $5\times10^{-9}$ |
| Honey | $4\times10^{-8}$ |
| Mercury | $1\times10^{-8}$ |
| Oobleck | $1\times10^{-10}$ |

These are float round-off. Depth never went below the 0.5 mm film the limiter keeps, and no cell produced a NaN.

**Dam break.** 20 mm of water against 5 mm, compared with Stoker's (1957) exact solution: a rarefaction, a flat middle state of 11.03 mm and a bore.

| Time | Bore position (sim) | Exact | Error | Profile L1 error |
|---|---|---|---|---|
| 0.3 s | 12.54 cm | 12.50 cm | +0.3 % | 0.6 % |
| 0.6 s | 25.05 cm | 25.00 cm | +0.2 % | 0.8 % |

The first version of the solver used semi-Lagrangian advection of velocity, and this test caught it: that version put the bore 13 % behind. That error comes from the velocity (non-conservative) form, which conserves $u$ instead of $hu$ across a jump. Switching to momentum-conserving advection (§2.3) fixed it.

---

## 11. Assumptions and limitations

- **Shallow water** is exact only for waves much longer than the depth. In 2.5 cm of water, waves shorter than about 15 cm travel a little faster in the simulation than in reality: real dispersion has a $\tanh(kh)$ factor that the equations drop. Surface tension partly offsets this for the shortest ripples.
- **The grid** resolves ripples down to about $2\Delta x$: 9 mm on desktop, 18 mm on phones.
- **Splashing** is modelled, not simulated: excess momentum above Froude 1 becomes ballistic drops. The spray efficiency ε = 0.5 is an assumption.
- **The in-plane viscous term** is capped at its explicit stability limit for very viscous states. Bed friction carries the full viscosity implicitly and dominates in a thin layer.
- **Oobleck** uses a regularised power law, not a full jamming model.
- **Rigid bodies** read the fluid one or two frames late (asynchronous GPU readback, ~20–30 ms), much shorter than the wave periods they respond to. They see a plane fitted to the surrounding surface, so they ignore ripples shorter than themselves.
- **Stone skipping** treats the water as undisturbed at the contact.
- **Volume** is conserved by the scheme to round-off. Spray leaving the puddle returns when it lands; drops landing on the ground are assumed to drain back.

---

## 12. References

1. IAPWS (2014). R1-76(2014) Revised Release on the Surface Tension of Ordinary Water Substance.
2. IAPWS (2008). Release on the IAPWS Formulation 2008 for the Viscosity of Ordinary Water Substance.
3. Pope, R. M. & Fry, E. S. (1997). Absorption spectrum (380–700 nm) of pure water. II. *Applied Optics* 36, 8710–8723.
4. Inagaki, T., Arakawa, E. T. & Williams, M. W. (1981). Optical properties of liquid mercury. *Phys. Rev. B* 23, 5246–5262.
5. Yanniotis, S., Skaltsi, S. & Karaburnioti, S. (2006). Effect of moisture content on the viscosity of honey at different temperatures. *J. Food Eng.* 72, 372–377.
6. Lazaridou, A. et al. (2004). Composition, thermal and rheological behaviour of selected Greek honeys. *J. Food Eng.* 64, 9–21.
7. Fall, A. et al. (2008). Shear thickening of cornstarch suspensions as a reentrant jamming transition. *Phys. Rev. Lett.* 100, 018301.
8. Fall, A., Bertrand, F., Ovarlez, G. & Bonn, D. (2012). Shear thickening of cornstarch suspensions. *J. Rheol.* 56, 575–591.
9. Brown, E. & Jaeger, H. M. (2014). Shear thickening in concentrated suspensions. *Rep. Prog. Phys.* 77, 046602.
10. Wyart, M. & Cates, M. E. (2014). Discontinuous shear thickening without inertia in dense non-Brownian suspensions. *Phys. Rev. Lett.* 112, 098302.
11. Waitukaitis, S. R. & Jaeger, H. M. (2012). Impact-activated solidification of dense suspensions via dynamic jamming fronts. *Nature* 487, 205–209.
12. Glasheen, J. W. & McMahon, T. A. (1996). A hydrodynamic model of locomotion in the basilisk lizard. *Nature* 380, 340–342.
13. Bocquet, L. (2003). The physics of stone skipping. *Am. J. Phys.* 71, 150–155.
14. Clanet, C., Hersen, F. & Bocquet, L. (2004). Secrets of successful stone-skipping. *Nature* 427, 29.
15. Nagahiro, S. & Hayakawa, Y. (2005). Theoretical and numerical approach to "magic angle" of stone skipping. *Phys. Rev. Lett.* 94, 174501.
16. Phillips, O. M. (1957). On the generation of waves by turbulent wind. *J. Fluid Mech.* 2, 417–445.
17. Gunn, R. & Kinzer, G. D. (1949). The terminal velocity of fall for water droplets in stagnant air. *J. Meteorology* 6, 243–248.
18. Minnaert, M. (1933). On musical air-bubbles and the sounds of running water. *Phil. Mag.* 16, 235–248.
19. Stelling, G. S. & Duinmeijer, S. P. A. (2003). A staggered conservative scheme for every Froude number in rapidly varied shallow water flows. *Int. J. Numer. Meth. Fluids* 43, 1329–1354.
20. Smagorinsky, J. (1963). General circulation experiments with the primitive equations. *Monthly Weather Review* 91, 99–164.
21. Wallace, E. (2011). WebGL Water. madebyevan.com/webgl-water.
22. Stoker, J. J. (1957). *Water Waves: The Mathematical Theory with Applications.* Interscience.
23. Longuet-Higgins, M. S. & Stewart, R. W. (1964). Radiation stresses in water waves; a physical discussion, with applications. *Deep-Sea Research* 11, 529–562.
24. Shaw, H. R., Wright, T. L., Peck, D. L. & Okamura, R. (1968). The viscosity of basaltic magma: an analysis of field measurements in Makaopuhi lava lake, Hawaii. *Am. J. Sci.* 266, 225–264.
25. Murase, T. & McBirney, A. R. (1973). Properties of some common igneous rocks and their melts at high temperatures. *GSA Bulletin* 84, 3563–3592.
26. Djabourov, M., Leblond, J. & Papon, P. (1988). Gelation of aqueous gelatin solutions. II. Rheology of the sol-gel transition. *J. Phys. France* 49, 333–343.
