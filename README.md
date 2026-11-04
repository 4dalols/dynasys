# dynasys

A browser playground of interactive dynamical systems. Every world has live parameter sliders, presets, mouse tools and a short explainer.

| Category | Simulations |
| --- | --- |
| Swarms & Life | Fish school (boids + sharks), Ant colony (pheromone foraging), Particle life, Synchronizing fireflies (Kuramoto) |
| Cosmos & Mechanics | Gravity sandbox (planet formation, galaxy collision, figure-eight 3-body, …) |
| Chaos | Double pendulum fan, Strange attractors (Lorenz, Rössler, Aizawa, Thomas, …), Magnetic pendulum basins |
| Growth & Patterns | Fungal mycelium, Slime mold (Physarum), Gray–Scott reaction–diffusion, Life-like automata, DLA crystals, Abelian sandpile, Forest fire |
| Waves & Fluids | Ripple tank (wave equation), Smoke & ink (stable fluids), Cyclic CA spirals, Ising magnet |
| Societies | Rabbits & foxes ecosystem, Epidemic (SIRS), Phantom traffic jams (IDM) |

Keyboard: `space` pause · `.` step · `r` reset · `h` hide panel · `esc` back. Parameter changes are written to the URL so you can share a configuration.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

Plain TypeScript + Canvas 2D, built with Vite; no runtime dependencies. Deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Adding a simulation

Create `src/sims/<name>.ts` exporting a `SimDef` (see `src/core/types.ts`): metadata, a list of params (sliders/selects/toggles), optional presets, and `create(ctx)` returning `{ step, draw, pointer?, stats?, actions? }`. Register it in `src/sims/index.ts`.
