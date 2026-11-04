import type { SimDef } from '../core/types';
import { PixelBuffer } from '../core/util';

const COLS = [[8, 10, 24], [56, 189, 248], [250, 204, 21], [244, 63, 94]];

export const sandpile: SimDef = {
  id: 'sandpile',
  title: 'Abelian Sandpile',
  tagline: 'Drop grains one by one; any cell with 4 topples onto its neighbours. Avalanches of every size build a fractal.',
  category: 'Growth & Patterns',
  accent: '#38bdf8',
  controls: 'Click/drag to pour sand',
  thumbSteps: 400,
  params: [
    { type: 'select', key: 'mode', label: 'Drop grains', default: 'center', reset: true, options: [{ value: 'center', label: 'At the centre' }, { value: 'random', label: 'Randomly (SOC)' }, { value: 'four', label: 'Four sources' }] },
    { key: 'rate', label: 'Grains per tick', min: 1, max: 2000, step: 1, default: 400 },
    { key: 'cell', label: 'Cell size (px)', min: 1, max: 6, step: 1, default: 2, reset: true },
  ],
  presets: [
    { name: 'Fractal', values: {} },
    { name: 'Criticality', values: { mode: 'random', rate: 20 } },
    { name: 'Four sources', values: { mode: 'four' } },
  ],
  about: `<p>The Bak–Tang–Wiesenfeld sandpile (1987), the original model of <b>self-organised criticality</b>. Each cell holds 0–3 grains (colours). When a cell reaches 4 it topples, sending one grain to each neighbour, which may topple in turn.</p>
<p>Pouring at one point grows an intricate, perfectly symmetric fractal. Dropping grains randomly drives the pile to a critical state where avalanche sizes follow a power law — no characteristic scale.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 1 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const s = new Uint32Array(G);
    const stack = new Int32Array(G * 4);
    let sp = 0, grains = 0, lastAval = 0, maxAval = 0;
    const add = (i: number, n: number) => {
      s[i] += n; grains += n;
      if (s[i] >= 4) stack[sp++] = i;
    };
    const relax = () => {
      let topples = 0;
      while (sp > 0) {
        const i = stack[--sp];
        if (s[i] < 4) continue;
        const q = s[i] >> 2;
        s[i] &= 3;
        topples += q;
        const x = i % gw, y = (i / gw) | 0;
        const push = (j: number) => { s[j] += q; if (s[j] >= 4 && s[j] - q < 4) { if (sp < stack.length) stack[sp++] = j; } };
        if (x > 0) push(i - 1); if (x < gw - 1) push(i + 1);
        if (y > 0) push(i - gw); if (y < gh - 1) push(i + gw);
        if (s[i] >= 4) stack[sp++] = i;
      }
      return topples;
    };
    const centers = P.mode === 'four' ? [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]] : [[0.5, 0.5]];
    let pour: number | null = null;
    const step = () => {
      const r = thumbnail ? 2000 : (P.rate as number);
      if (P.mode === 'random') {
        for (let k = 0; k < r; k++) { add((Math.random() * G) | 0, 1); lastAval = relax(); maxAval = Math.max(maxAval, lastAval); }
      } else {
        for (const [fx, fy] of centers) add(((fy * gh) | 0) * gw + ((fx * gw) | 0), Math.ceil(r / centers.length));
        lastAval = relax();
      }
      if (pour !== null) { add(pour, Math.max(50, r)); relax(); }
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) { const c = COLS[s[i] & 3]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
      buf.blit(ctx, gw * cs, gh * cs);
    };
    return {
      step, draw,
      pointer(p) {
        if (p.down) { const x = Math.min(gw - 1, Math.max(0, (p.x / cs) | 0)), y = Math.min(gh - 1, Math.max(0, (p.y / cs) | 0)); pour = y * gw + x; }
        else pour = null;
      },
      stats: () => [['Grains', grains], ['Last avalanche', `${lastAval} topples`], ['Largest (random mode)', maxAval]],
      actions: [{ label: 'Clear', run: () => { s.fill(0); grains = 0; } }],
    };
  },
};
