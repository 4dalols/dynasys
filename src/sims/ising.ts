import type { SimDef } from '../core/types';
import { History, PixelBuffer, stampGrid } from '../core/util';

export const ising: SimDef = {
  id: 'ising',
  title: 'Ising Magnet',
  tagline: 'Spins flip by Metropolis Monte Carlo; sweep temperature through T꜀ ≈ 2.27 to watch magnetism appear.',
  category: 'Waves & Fluids',
  accent: '#818cf8',
  controls: 'Drag to paint spin-up · shift-drag paints spin-down',
  thumbSteps: 60,
  params: [
    { key: 'T', label: 'Temperature T', min: 0.5, max: 5, step: 0.01, default: 2.27 },
    { key: 'Hf', label: 'External field h', min: -1, max: 1, step: 0.01, default: 0 },
    { key: 'J', label: 'Coupling J', min: -1, max: 1, step: 0.05, default: 1, hint: 'Negative J = antiferromagnet' },
    { key: 'sweeps', label: 'Sweeps / frame', min: 0.1, max: 4, step: 0.1, default: 1 },
    { key: 'cell', label: 'Cell size (px)', min: 1, max: 8, step: 1, default: 3, reset: true },
    { type: 'select', key: 'start', label: 'Start', default: 'random', reset: true, options: [{ value: 'random', label: 'Hot (random)' }, { value: 'up', label: 'Cold (all up)' }] },
  ],
  presets: [
    { name: 'Critical point', values: { T: 2.27 } },
    { name: 'Cold: domains coarsen', values: { T: 1.5 } },
    { name: 'Hot: paramagnet', values: { T: 4 } },
    { name: 'Antiferromagnet', values: { J: -1, T: 1.5 } },
    { name: 'Field-driven', values: { T: 1.8, Hf: 0.15, start: 'random' } },
  ],
  about: `<p>The 2D <b>Ising model</b>: a lattice of spins ±1 that prefer to align with their four neighbours. Each step picks random spins and flips them with the <b>Metropolis</b> rule: always if it lowers the energy, otherwise with probability e^{−ΔE/T}.</p>
<div class="eq">E = −J Σ⟨ij⟩ s_i s_j − h Σ s_i</div>
<p>Below Onsager's critical temperature T꜀ = 2/ln(1+√2) ≈ 2.269 the system spontaneously magnetises; above it, thermal noise wins. Right at T꜀ you see domains of all sizes — a scale-free critical state.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 2 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const s = new Int8Array(G);
    for (let i = 0; i < G; i++) s[i] = P.start === 'up' ? 1 : Math.random() < 0.5 ? 1 : -1;
    const hist = new History(['|m| %'], ['#a5b4fc'], 300);
    let mag = 0;
    const step = () => {
      const T = P.T as number, J = P.J as number, h = P.Hf as number;
      const flips = Math.floor(G * (P.sweeps as number));
      for (let k = 0; k < flips; k++) {
        const i = (Math.random() * G) | 0, x = i % gw, y = (i / gw) | 0;
        const nb = s[y * gw + ((x + 1) % gw)] + s[y * gw + ((x - 1 + gw) % gw)] + s[((y + 1) % gh) * gw + x] + s[((y - 1 + gh) % gh) * gw + x];
        const dE = 2 * s[i] * (J * nb + h);
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) s[i] = -s[i] as 1 | -1;
      }
      let m = 0; for (let i = 0; i < G; i++) m += s[i];
      mag = m / G;
      hist.push(Math.abs(mag) * 100);
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) {
        const o = i * 4;
        if (s[i] > 0) { d[o] = 165; d[o + 1] = 180; d[o + 2] = 252; } else { d[o] = 20; d[o + 1] = 16; d[o + 2] = 48; }
      }
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) hist.draw(ctx, W - 230, H - 90, 218, 78, { yMax: 100, title: 'Magnetisation' });
    };
    return {
      step, draw,
      pointer(p) { if (p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 10, (i) => (s[i] = p.shift || p.button === 2 ? -1 : 1)); },
      stats: () => [['Magnetisation m', mag], ['T / T꜀', (P.T as number) / 2.269]],
      actions: [{ label: 'Randomize', run: () => { for (let i = 0; i < G; i++) s[i] = Math.random() < 0.5 ? 1 : -1; } }, { label: 'All up', run: () => s.fill(1) }],
    };
  },
};
