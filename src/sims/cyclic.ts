import type { SimDef } from '../core/types';
import { PixelBuffer, stampGrid } from '../core/util';

export const cyclic: SimDef = {
  id: 'cyclic',
  title: 'Chemical Spirals',
  tagline: 'A cyclic cellular automaton: each colour eats the next, and random noise self-organises into rotating spiral waves.',
  category: 'Waves & Fluids',
  accent: '#e879f9',
  controls: 'Drag to scramble a region',
  thumbSteps: 300,
  params: [
    { key: 'states', label: 'States (colours)', min: 3, max: 24, step: 1, default: 14 },
    { key: 'range', label: 'Neighbourhood range', min: 1, max: 4, step: 1, default: 1 },
    { key: 'threshold', label: 'Threshold', min: 1, max: 20, step: 1, default: 1 },
    { type: 'select', key: 'shape', label: 'Neighbourhood', default: 'moore', options: [{ value: 'moore', label: 'Moore (square)' }, { value: 'vn', label: 'von Neumann (diamond)' }] },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 8, step: 1, default: 3, reset: true },
    { key: 'hue', label: 'Hue shift', min: 0, max: 360, step: 1, default: 200 },
  ],
  presets: [
    { name: 'Classic spirals', values: {} },
    { name: '313', values: { states: 3, range: 1, threshold: 3 } },
    { name: 'Big spirals', values: { states: 8, range: 3, threshold: 5 } },
    { name: 'Squarish', values: { states: 6, range: 2, threshold: 2, shape: 'vn' } },
    { name: 'Amoebae', values: { states: 4, range: 2, threshold: 6, shape: 'vn' } },
    { name: 'Turbulent', values: { states: 5, range: 1, threshold: 2 } },
  ],
  about: `<p>Every cell has a state 0…n−1, arranged in a cycle. A cell advances to the next state if at least <b>threshold</b> of its neighbours are already in that next state — like rock–paper–scissors, or an excitable chemical medium.</p>
<p>Starting from pure noise the grid passes through debris, then droplets of waves, and finally a few self-sustaining <b>spirals</b> take over. The look echoes the Belousov–Zhabotinsky reaction and the cAMP waves of aggregating Dictyostelium amoebae.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 2 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    let a = new Uint8Array(G), b = new Uint8Array(G);
    const n0 = P.states as number;
    for (let i = 0; i < G; i++) a[i] = (Math.random() * n0) | 0;
    let gen = 0;
    const step = () => {
      const n = P.states as number, r = P.range as number, T = P.threshold as number, vn = P.shape === 'vn';
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x, s = a[i] % n, nx = s + 1 === n ? 0 : s + 1;
        let c = 0;
        for (let dy = -r; dy <= r && c < T; dy++) {
          const yy = (y + dy + gh) % gh;
          const span = vn ? r - Math.abs(dy) : r;
          for (let dx = -span; dx <= span; dx++) {
            if (!dx && !dy) continue;
            if (a[yy * gw + ((x + dx + gw) % gw)] % n === nx) { c++; if (c >= T) break; }
          }
        }
        b[i] = c >= T ? nx : s;
      }
      const t = a; a = b; b = t;
      gen++;
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const n = P.states as number, h0 = P.hue as number, d = buf.data;
      const lut: number[][] = [];
      for (let s = 0; s < n; s++) {
        const h = (h0 + (s / n) * 300) % 360, l = 0.25 + 0.45 * (s / n);
        const k = (m: number) => (m + h / 30) % 12, A = 0.8 * Math.min(l, 1 - l);
        const f = (m: number) => l - A * Math.max(-1, Math.min(k(m) - 3, 9 - k(m), 1));
        lut.push([f(0) * 255, f(8) * 255, f(4) * 255]);
      }
      for (let i = 0; i < G; i++) { const c = lut[a[i] % n]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
      buf.blit(ctx, gw * cs, gh * cs);
    };
    return {
      step, draw,
      pointer(p) { if (p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 10, (i) => (a[i] = (Math.random() * P.states) | 0)); },
      stats: () => [['Generation', gen]],
      actions: [{ label: 'Re-randomize', run: () => { for (let i = 0; i < G; i++) a[i] = (Math.random() * P.states) | 0; } }],
    };
  },
};
