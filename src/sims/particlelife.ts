import type { SimDef } from '../core/types';
import { SpatialGrid, rand, roundRect } from '../core/util';

export const particleLife: SimDef = {
  id: 'particle-life',
  title: 'Particle Life',
  tagline: 'Colored species attract or repel each other asymmetrically — cells, worms and predators emerge from a 6×6 matrix.',
  category: 'Swarms & Life',
  accent: '#f472b6',
  controls: 'Click matrix cells to tweak rules (right-click lowers) · drag the canvas to stir',
  thumbSteps: 300,
  params: [
    { key: 'species', label: 'Species', min: 2, max: 8, step: 1, default: 6, reset: true },
    { key: 'count', label: 'Particles', min: 200, max: 6000, step: 100, default: 2500, reset: true },
    { key: 'rmax', label: 'Interaction radius', min: 20, max: 150, step: 1, default: 70 },
    { key: 'beta', label: 'Core repulsion zone', min: 0.05, max: 0.6, step: 0.01, default: 0.3 },
    { key: 'force', label: 'Force strength', min: 0.1, max: 3, step: 0.05, default: 1 },
    { key: 'friction', label: 'Friction', min: 0.01, max: 0.5, step: 0.01, default: 0.12 },
    { type: 'toggle', key: 'symmetric', label: 'Symmetric rules (Newton 3rd law)', default: false, reset: true },
    { type: 'toggle', key: 'showMatrix', label: 'Show rule matrix', default: true },
    { type: 'toggle', key: 'trails', label: 'Trails', default: false },
  ],
  presets: [
    { name: 'Random', values: {} },
    { name: 'Symmetric (settles)', values: { symmetric: true } },
    { name: 'Two species', values: { species: 2, count: 1800 } },
    { name: 'Big swarm', values: { count: 5000, rmax: 50, species: 5 } },
    { name: 'Sticky', values: { friction: 0.35, beta: 0.15 } },
  ],
  about: `<p>Each particle belongs to a species. Species A feels a force from species B given by entry <b>M[A][B]</b> of the rule matrix: positive attracts, negative repels. Everybody also repels at very short range so matter doesn't collapse.</p>
<p>Because the matrix needn't be symmetric, A can chase B while B flees A — breaking Newton's third law and injecting energy. That's what makes the system look alive: membranes, spinning cells, snakes and swarms emerge (popularised by Jeffrey Ventrella's <i>Clusters</i> and Tom Mohr's Particle Life). Hit <b>Snake rules</b> for a predator chain.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const K = P.species as number, N = thumbnail ? 1500 : (P.count as number);
    const M: number[][] = [];
    const randomize = () => {
      for (let a = 0; a < K; a++) { M[a] = []; for (let b = 0; b < K; b++) M[a][b] = rand(-1, 1); }
      if (P.symmetric) for (let a = 0; a < K; a++) for (let b = 0; b < a; b++) M[a][b] = M[b][a];
    };
    randomize();
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), s = new Uint8Array(N);
    for (let i = 0; i < N; i++) { x[i] = rand(W); y[i] = rand(H); s[i] = i % K; }
    const grid = new SpatialGrid(W, H, P.rmax);
    const hues = Array.from({ length: K }, (_, k) => (k * 360) / K);
    let stir: { x: number; y: number; dx: number; dy: number } | null = null;

    const step = () => {
      const R = P.rmax as number, beta = P.beta as number, fs = (P.force as number) * 0.1 * (thumbnail ? 0.8 : 1);
      if (grid.cell !== R) grid.resize(W, H, R);
      grid.build(x, y, N);
      const fr = 1 - (P.friction as number);
      for (let i = 0; i < N; i++) {
        let fx = 0, fy = 0;
        const xi = x[i], yi = y[i], row = M[s[i]];
        grid.query(xi, yi, R, (j) => {
          if (j === i) return;
          let dx = x[j] - xi, dy = y[j] - yi;
          if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
          if (dy > H / 2) dy -= H; else if (dy < -H / 2) dy += H;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R || d2 === 0) return;
          const d = Math.sqrt(d2), r = d / R;
          let f: number;
          if (r < beta) f = r / beta - 1;
          else f = row[s[j]] * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
          fx += (dx / d) * f; fy += (dy / d) * f;
        }, true);
        vx[i] = vx[i] * fr + fx * fs * R * 0.1;
        vy[i] = vy[i] * fr + fy * fs * R * 0.1;
        if (stir) {
          const dx = xi - stir.x, dy = yi - stir.y, d2 = dx * dx + dy * dy;
          if (d2 < 80 * 80) { vx[i] += stir.dx * 0.15; vy[i] += stir.dy * 0.15; }
        }
      }
      for (let i = 0; i < N; i++) {
        x[i] = (x[i] + vx[i] + W) % W; y[i] = (y[i] + vy[i] + H) % H;
      }
      if (stir) { stir.dx *= 0.5; stir.dy *= 0.5; }
    };

    const cell = 22, mx = 12, my = H - 12 - cell * (K + 1);
    const draw = () => {
      if (P.trails) { ctx.fillStyle = 'rgba(5,6,12,0.2)'; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H); }
      const r = N > 4000 ? 1.6 : 2.2;
      for (let k = 0; k < K; k++) {
        ctx.fillStyle = `hsl(${hues[k]},90%,62%)`;
        ctx.beginPath();
        for (let i = 0; i < N; i++) if (s[i] === k) { ctx.moveTo(x[i] + r, y[i]); ctx.arc(x[i], y[i], r, 0, 6.2832); }
        ctx.fill();
      }
      if (P.showMatrix && !thumbnail) {
        ctx.fillStyle = 'rgba(8,10,18,0.8)';
        roundRect(ctx, mx - 6, my - 6, cell * (K + 1) + 12, cell * (K + 1) + 12, 8);
        ctx.fill();
        for (let k = 0; k < K; k++) {
          ctx.fillStyle = `hsl(${hues[k]},90%,62%)`;
          ctx.beginPath(); ctx.arc(mx + cell * (k + 1.5), my + cell / 2, 5, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + cell / 2, my + cell * (k + 1.5), 5, 0, 6.2832); ctx.fill();
        }
        for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
          const v = M[a][b];
          ctx.fillStyle = v > 0 ? `rgba(74,222,128,${Math.abs(v)})` : `rgba(248,113,113,${Math.abs(v)})`;
          ctx.fillRect(mx + cell * (b + 1) + 1, my + cell * (a + 1) + 1, cell - 2, cell - 2);
        }
      }
    };

    const hitMatrix = (px: number, py: number): [number, number] | null => {
      if (!P.showMatrix) return null;
      const b = Math.floor((px - mx) / cell) - 1, a = Math.floor((py - my) / cell) - 1;
      return a >= 0 && b >= 0 && a < K && b < K ? [a, b] : null;
    };

    return {
      step, draw,
      pointer(p) {
        const hit = hitMatrix(p.x, p.y);
        if (p.type === 'down' && hit) {
          const [a, b] = hit, d = p.button === 2 || p.shift ? -0.25 : 0.25;
          let v = M[a][b] + d;
          if (v > 1) v = -1; if (v < -1) v = 1;
          M[a][b] = Math.round(v * 4) / 4;
          return;
        }
        if (p.down && !hit) stir = { x: p.x, y: p.y, dx: p.dx, dy: p.dy };
        if (p.type === 'up') stir = null;
      },
      stats: () => {
        let ke = 0; for (let i = 0; i < N; i++) ke += vx[i] * vx[i] + vy[i] * vy[i];
        return [['Particles', N], ['Species', K], ['Mean speed²', ke / N]];
      },
      actions: [
        { label: 'Randomize rules', run: randomize },
        { label: 'Snake rules', run: () => { for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) M[a][b] = a === b ? 1 : b === (a + 1) % K ? 0.25 : -0.1; } },
        { label: 'Mutate', run: () => { for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) M[a][b] = Math.max(-1, Math.min(1, M[a][b] + rand(-0.2, 0.2))); } },
        { label: 'Scatter', run: () => { for (let i = 0; i < N; i++) { x[i] = rand(W); y[i] = rand(H); } } },
      ],
    };
  },
};
