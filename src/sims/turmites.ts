import type { SimDef } from '../core/types';
import { PixelBuffer } from '../core/util';

const RULES = ['RL', 'RLR', 'LLRR', 'LRRRRRLLR', 'LLRRRLRLRLLR', 'RRLLLRLLLRRR', 'RRLRLLRRRRRR', 'LRRRRLLLRRR', 'RLLR', 'LRRL'];

export const turmites: SimDef = {
  id: 'turmites',
  title: "Langton's Ant",
  tagline: 'An ant turns right on one colour and left on another. After 10,000 steps of chaos it suddenly builds a highway.',
  category: 'Growth & Patterns',
  accent: '#fde047',
  controls: 'Click to drop another ant',
  thumbSteps: 300,
  params: [
    { type: 'select', key: 'rule', label: 'Rule (turn per colour)', default: 'RL', reset: true, options: RULES.map((r) => ({ value: r, label: r })) },
    { key: 'ants', label: 'Ants', min: 1, max: 12, step: 1, default: 1, reset: true },
    { key: 'speed', label: 'Steps per frame', min: 1, max: 20000, step: 1, default: 200 },
    { key: 'cell', label: 'Cell size (px)', min: 1, max: 8, step: 1, default: 3, reset: true },
    { type: 'toggle', key: 'wrap', label: 'Wrap edges', default: true },
  ],
  presets: [
    { name: 'Classic highway', values: { rule: 'RL', speed: 200 } },
    { name: 'Symmetric growth', values: { rule: 'LLRR', speed: 2000 } },
    { name: 'Square builder', values: { rule: 'LRRRRRLLR', speed: 2000, cell: 2 } },
    { name: 'Convoluted highway', values: { rule: 'LLRRRLRLRLLR', speed: 3000, cell: 2 } },
    { name: 'Filled triangle', values: { rule: 'RRLLLRLLLRRR', speed: 4000, cell: 2 } },
    { name: 'Ant colony', values: { rule: 'RL', ants: 8, speed: 500 } },
  ],
  about: `<p>Langton's ant (1986) lives on a grid of coloured cells. Each step it turns according to the colour under it (R or L in the rule string), advances the cell to the next colour, and moves forward one square.</p>
<p>With rule <b>RL</b> the ant draws a symmetric blob, then ~10,000 steps of apparent chaos — and then, abruptly, a diagonal "highway" that repeats every 104 steps forever. Nobody has proved this always happens. Longer rules (generalised <b>turmites</b>) grow symmetric shapes, squares, triangles and spirals.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 2 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const rule = P.rule as string, n = rule.length;
    const turns = [...rule].map((c) => (c === 'R' ? 1 : -1));
    const g = new Uint8Array(G);
    const ants: { x: number; y: number; d: number }[] = [];
    const na = P.ants as number;
    for (let k = 0; k < na; k++) {
      const a = (k / na) * Math.PI * 2, r = na > 1 ? Math.min(gw, gh) * 0.2 : 0;
      ants.push({ x: ((gw / 2 + Math.cos(a) * r) | 0), y: ((gh / 2 + Math.sin(a) * r) | 0), d: k % 4 });
    }
    let steps = 0;
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    const step = () => {
      const sp = thumbnail ? (n > 2 ? 2000 : 60) : (P.speed as number), wrap = P.wrap as boolean;
      for (let s = 0; s < sp; s++) {
        for (const a of ants) {
          if (a.x < 0) continue;
          const i = a.y * gw + a.x, c = g[i];
          a.d = (a.d + turns[c] + 4) & 3;
          g[i] = c + 1 === n ? 0 : c + 1;
          a.x += DX[a.d]; a.y += DY[a.d];
          if (wrap) { a.x = (a.x + gw) % gw; a.y = (a.y + gh) % gh; }
          else if (a.x < 0 || a.y < 0 || a.x >= gw || a.y >= gh) a.x = -1;
        }
        steps++;
      }
    };
    const buf = new PixelBuffer(gw, gh);
    const lut: number[][] = [[8, 9, 16]];
    for (let k = 1; k < n; k++) {
      const h = (45 + (k - 1) * (300 / Math.max(1, n - 1))) % 360, l = 0.55, A = 0.7 * Math.min(l, 1 - l), kk = (m: number) => (m + h / 30) % 12;
      const f = (m: number) => l - A * Math.max(-1, Math.min(kk(m) - 3, 9 - kk(m), 1));
      lut.push([f(0) * 255, f(8) * 255, f(4) * 255]);
    }
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) { const c = lut[g[i]]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
      for (const a of ants) if (a.x >= 0) { const o = (a.y * gw + a.x) * 4; d[o] = 255; d[o + 1] = 60; d[o + 2] = 60; }
      buf.blit(ctx, gw * cs, gh * cs);
    };
    return {
      step, draw,
      pointer(p) { if (p.type === 'down') ants.push({ x: Math.min(gw - 1, Math.max(0, (p.x / cs) | 0)), y: Math.min(gh - 1, Math.max(0, (p.y / cs) | 0)), d: (Math.random() * 4) | 0 }); },
      stats: () => [['Steps', steps.toLocaleString()], ['Ants', ants.filter((a) => a.x >= 0).length]],
    };
  },
};
