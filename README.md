# Puddle

Slap a puddle and watch real waves move. A browser toy built on a GPU solver for the 2D shallow-water equations, with surface tension, viscosity, and refraction, reflection and caustics computed from the wave surface.

**Live:** https://marcmasgoret.ca/puddle/ · **Every build:** https://marcmasgoret.ca/puddle/builds.html

Work in progress. A full write-up of the physics, the architecture and the credits comes with the engineering-mode phase.

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:5173/puddle/. Add `?grid=256` to force the phone-sized grid.

## Where the physics lives

| File | What it holds |
|---|---|
| `src/physics/fluids.ts` | Real fluid properties with sources |
| `src/physics/swe/shaders.ts` | Governing equations and the discretization (GPU passes) |
| `src/physics/stability.ts` | CFL / von Neumann time-step selection |
| `src/physics/solver.ts` | Ping-pong render targets, substeps, impulses |
| `src/physics/puddleShape.ts` | Signed-distance edge and floor depth |
| `src/render/caustics.ts` | Caustics by ray refraction and area ratio |
| `src/render/water.ts` | Fresnel, Snell refraction, Beer–Lambert absorption |
