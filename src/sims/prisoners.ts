import type { SimDef } from '../core/types';
import { History, PixelBuffer, stampGrid } from '../core/util';

export const prisoners: SimDef = {
  id: 'prisoners',
  title: "Prisoner's Dilemma Grid",
  tagline: 'Cooperators and defectors on a lattice copy their most successful neighbour — producing kaleidoscopes and frontiers of trust.',
  category: 'Societies',
  accent: '#60a5fa',
  controls: 'Drag to plant defectors · shift-drag plants cooperators',
  thumbSteps: 80,
  params: [
    { key: 'b', label: 'Temptation to defect b', min: 1, max: 2.5, step: 0.01, default: 1.85 },
    { type: 'select', key: 'start', label: 'Start', default: 'single', reset: true, options: [{ value: 'single', label: 'One defector (kaleidoscope)' }, { value: 'random', label: 'Random mix' }] },
    { key: 'pc', label: 'Initial cooperators', min: 0.05, max: 0.95, step: 0.01, default: 0.9, reset: true },
    { key: 'noise', label: 'Mutation rate', min: 0, max: 0.02, step: 0.0005, default: 0 },
    { type: 'toggle', key: 'self', label: 'Include self-interaction', default: true },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 8, step: 1, default: 3, reset: true },
  ],
  presets: [
    { name: 'Kaleidoscope', values: { start: 'single', b: 1.85 } },
    { name: 'Chaotic coexistence', values: { start: 'random', b: 1.85, pc: 0.9 } },
    { name: 'Cooperators win', values: { start: 'random', b: 1.6 } },
    { name: 'Defectors win', values: { start: 'random', b: 2.1 } },
    { name: 'Noisy world', values: { start: 'random', b: 1.75, noise: 0.003 } },
  ],
  about: `<p>Nowak &amp; May (1992): each cell plays the prisoner's dilemma with its 8 neighbours. Mutual cooperation pays 1, a defector exploiting a cooperator gets <b>b</b> &gt; 1, everything else pays 0. Then each cell adopts the strategy of the highest-scoring cell in its neighbourhood.</p>
<p>In a well-mixed population defectors always win. On a grid, clusters of cooperators protect each other, and for 1.8 &lt; b &lt; 2 the two coexist in endlessly shifting fractal patterns — starting from a single defector you get a perfect symmetric kaleidoscope.</p>
<p>Colours: <span style="color:#3b82f6">blue</span> cooperator, <span style="color:#ef4444">red</span> defector, <span style="color:#22c55e">green</span> just became cooperator, <span style="color:#facc15">yellow</span> just became defector.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.cell as number);
    let gw = Math.ceil(W / cs), gh = Math.ceil(H / cs);
    if (P.start === 'single') { gw |= 1; gh |= 1; }
    const G = gw * gh;
    let s = new Uint8Array(G), prev = new Uint8Array(G);
    const score = new Float32Array(G);
    if (P.start === 'single') s[((gh / 2) | 0) * gw + ((gw / 2) | 0)] = 1;
    else for (let i = 0; i < G; i++) s[i] = Math.random() < (P.pc as number) ? 0 : 1;
    prev.set(s);
    const hist = new History(['C %'], ['#60a5fa'], 300);
    let coop = 0;
    const step = () => {
      const b = P.b as number, self = P.self as boolean;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x; let sc = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !self) continue;
          const j = ((y + dy + gh) % gh) * gw + ((x + dx + gw) % gw);
          if (s[j] === 0) sc += s[i] === 0 ? 1 : b;
        }
        score[i] = sc;
      }
      const nx = prev; prev = s;
      const noise = P.noise as number;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x; let best = score[i], st = s[i];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = ((y + dy + gh) % gh) * gw + ((x + dx + gw) % gw);
          if (score[j] > best) { best = score[j]; st = s[j]; }
        }
        nx[i] = noise && Math.random() < noise ? 1 - st : st;
      }
      s = nx;
      coop = 0; for (let i = 0; i < G; i++) if (!s[i]) coop++;
      hist.push((coop / G) * 100);
    };
    const buf = new PixelBuffer(gw, gh);
    const C = [[59, 130, 246], [250, 204, 21], [34, 197, 94], [239, 68, 68]];
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) { const c = C[s[i] * 2 + prev[i] * 1 === 0 ? 0 : s[i] === 1 && prev[i] === 1 ? 3 : s[i] === 1 ? 1 : 2]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) hist.draw(ctx, W - 230, H - 90, 218, 78, { yMax: 100, title: 'Cooperators' });
    };
    return {
      step, draw,
      pointer(p) { if (p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 3, (i) => { s[i] = p.shift || p.button === 2 ? 0 : 1; }); },
      stats: () => [['Cooperators', `${((coop / G) * 100).toFixed(1)}%`]],
      actions: [{ label: 'Single defector', run: () => { s.fill(0); prev.fill(0); s[((gh / 2) | 0) * gw + ((gw / 2) | 0)] = 1; } }],
    };
  },
};
