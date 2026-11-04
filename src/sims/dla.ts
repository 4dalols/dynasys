import type { SimDef } from '../core/types';
import { PixelBuffer, TAU, rand } from '../core/util';

export const dla: SimDef = {
  id: 'dla',
  title: 'Crystal Growth (DLA)',
  tagline: 'Diffusion-limited aggregation: random walkers stick on contact and grow branching corals, frost and lightning.',
  category: 'Growth & Patterns',
  accent: '#93c5fd',
  controls: 'Click to plant a new seed',
  thumbSteps: 500,
  params: [
    { type: 'select', key: 'seed', label: 'Seed', default: 'point', reset: true, options: [{ value: 'point', label: 'Single point' }, { value: 'line', label: 'Ground line (frost)' }, { value: 'ring', label: 'Outer ring (inward)' }, { value: 'multi', label: 'Several points' }] },
    { key: 'stick', label: 'Stickiness', min: 0.02, max: 1, step: 0.01, default: 1 },
    { key: 'walkers', label: 'Walkers', min: 100, max: 5000, step: 100, default: 1500 },
    { key: 'bias', label: 'Drift (gravity)', min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: 'cell', label: 'Cell size (px)', min: 1, max: 4, step: 1, default: 2, reset: true },
    { key: 'hueSpeed', label: 'Colour cycling', min: 0, max: 5, step: 0.1, default: 1 },
  ],
  presets: [
    { name: 'Coral', values: {} },
    { name: 'Dense crystal', values: { stick: 0.08 } },
    { name: 'Frost', values: { seed: 'line', bias: 0.15 } },
    { name: 'Inward', values: { seed: 'ring' } },
    { name: 'Competing', values: { seed: 'multi' } },
  ],
  about: `<p>Particles wander randomly until they touch the aggregate, then freeze. Tips stick out further into the cloud and catch walkers first, so they grow faster — a runaway instability that yields fractal branching with dimension ≈ 1.71 in 2D (Witten &amp; Sander, 1981).</p>
<p>The same physics shapes electro-deposited copper, mineral dendrites, river networks and Lichtenberg figures. Lower stickiness lets walkers penetrate before sticking, producing denser, crystalline clusters.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 2 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const grid = new Int32Array(G).fill(-1);
    let count = 0;
    const buf = new PixelBuffer(gw, gh);
    for (let i = 0; i < G; i++) { buf.data[i * 4] = 4; buf.data[i * 4 + 1] = 6; buf.data[i * 4 + 2] = 14; }
    let hue = 190;
    const setC = (i: number) => {
      grid[i] = count++;
      hue = (hue + 0.02 * P.hueSpeed) % 360;
      const h = hue, l = 0.6, A = 0.6 * Math.min(l, 1 - l);
      const k = (m: number) => (m + h / 30) % 12;
      const f = (m: number) => l - A * Math.max(-1, Math.min(k(m) - 3, 9 - k(m), 1));
      buf.data[i * 4] = f(0) * 255; buf.data[i * 4 + 1] = f(8) * 255; buf.data[i * 4 + 2] = f(4) * 255;
    };
    const cx = gw / 2, cy = gh / 2;
    let rMax = 4;
    const seed = P.seed as string;
    if (seed === 'point') setC((cy | 0) * gw + (cx | 0));
    else if (seed === 'line') for (let x = 0; x < gw; x++) setC((gh - 1) * gw + x);
    else if (seed === 'ring') { const R = Math.min(gw, gh) * 0.46; for (let t = 0; t < TAU; t += 0.5 / R) setC(((cy + Math.sin(t) * R) | 0) * gw + ((cx + Math.cos(t) * R) | 0)); }
    else for (let k = 0; k < 5; k++) setC(((rand(gh * 0.2, gh * 0.8)) | 0) * gw + ((rand(gw * 0.2, gw * 0.8)) | 0));
    const global = seed !== 'point';
    const wx = new Float32Array(5000), wy = new Float32Array(5000);
    const spawn = (k: number) => {
      if (global) {
        if (seed === 'line') { wx[k] = rand(gw); wy[k] = rand(gh * 0.5); }
        else if (seed === 'ring') { const t = rand(TAU), r = rand(Math.min(gw, gh) * 0.2); wx[k] = cx + Math.cos(t) * r; wy[k] = cy + Math.sin(t) * r; }
        else { wx[k] = rand(gw); wy[k] = rand(gh); }
      } else { const t = rand(TAU), r = rMax + 6; wx[k] = cx + Math.cos(t) * r; wy[k] = cy + Math.sin(t) * r; }
    };
    for (let k = 0; k < 5000; k++) spawn(k);
    const step = () => {
      const n = P.walkers as number, st = P.stick as number, bias = P.bias as number;
      const kill = Math.min(Math.max(gw, gh), rMax * 2 + 30);
      for (let it = 0; it < (thumbnail ? 60 : 30); it++) {
        for (let k = 0; k < n; k++) {
          let x = wx[k], y = wy[k];
          const r = Math.random();
          if (r < 0.25) x++; else if (r < 0.5) x--; else if (r < 0.75) y++; else y--;
          if (bias && Math.random() < bias) y++;
          if (x < 1 || y < 1 || x >= gw - 1 || y >= gh - 1 || (!global && (x - cx) ** 2 + (y - cy) ** 2 > kill * kill)) { spawn(k); continue; }
          const i = (y | 0) * gw + (x | 0);
          if (grid[i] >= 0) { spawn(k); continue; }
          if ((grid[i - 1] >= 0 || grid[i + 1] >= 0 || grid[i - gw] >= 0 || grid[i + gw] >= 0) && Math.random() < st) {
            setC(i);
            if (!global) rMax = Math.max(rMax, Math.hypot(x - cx, y - cy));
            spawn(k);
            continue;
          }
          wx[k] = x; wy[k] = y;
        }
      }
    };
    const draw = () => {
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        const n = P.walkers as number;
        for (let k = 0; k < n; k += 3) ctx.fillRect(wx[k] * cs, wy[k] * cs, 1, 1);
      }
    };
    return {
      step, draw,
      pointer(p) { if (p.type === 'down') { const x = (p.x / cs) | 0, y = (p.y / cs) | 0; if (x >= 0 && y >= 0 && x < gw && y < gh) setC(y * gw + x); } },
      stats: () => [['Particles stuck', count], ['Cluster radius', `${(rMax * cs).toFixed(0)} px`]],
    };
  },
};
