import type { SimDef } from '../core/types';
import { History, PixelBuffer, stampGrid } from '../core/util';

export const forestfire: SimDef = {
  id: 'forest-fire',
  title: 'Forest Fire',
  tagline: 'Trees grow, lightning strikes, fire spreads: a self-organised critical forest with power-law burn sizes.',
  category: 'Growth & Patterns',
  accent: '#ef4444',
  controls: 'Click to ignite · shift-drag to plant trees',
  thumbSteps: 600,
  params: [
    { key: 'grow', label: 'Tree growth p', min: 0.0005, max: 0.05, step: 0.0005, default: 0.01 },
    { key: 'lightning', label: 'Lightning f', min: 0, max: 0.0005, step: 0.000005, default: 0.00002, fmt: (v) => v.toExponential(1) },
    { key: 'spread', label: 'Spread chance', min: 0.2, max: 1, step: 0.01, default: 0.9 },
    { key: 'wind', label: 'Wind →', min: -1, max: 1, step: 0.05, default: 0.3 },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 8, step: 1, default: 3, reset: true },
  ],
  presets: [
    { name: 'Critical forest', values: {} },
    { name: 'Dry & windy', values: { spread: 1, wind: 0.8 } },
    { name: 'Damp', values: { spread: 0.55, lightning: 0.0001 } },
    { name: 'Fast regrowth', values: { grow: 0.04 } },
    { name: 'Rare storms', values: { lightning: 0.000002, grow: 0.005 } },
  ],
  about: `<p>The Drossel–Schwabl model: empty ground sprouts a tree with probability p, a tree is struck by lightning with probability f, and fire jumps to neighbouring trees. Burnt cells become ash and then empty ground.</p>
<p>With f ≪ p the forest drives itself to a <b>critical state</b> without any tuning: fires of every size occur, following a power law — the same statistics as real wildfires, earthquakes and avalanches. Wind biases the spread so fronts become elongated.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    // 0 empty, 1 tree, 2..5 burning (intensity), 6 ash
    let a = new Uint8Array(G), b = new Uint8Array(G);
    const age = new Uint8Array(G);
    for (let i = 0; i < G; i++) if (Math.random() < 0.55) { a[i] = 1; age[i] = (Math.random() * 255) | 0; }
    const hist = new History(['Trees %', 'Burning ×10'], ['#4ade80', '#f97316'], 400);
    let t = 0, strikes = 0;
    const step = () => {
      t++;
      const p = P.grow as number, f = P.lightning as number, sp = P.spread as number, wind = P.wind as number;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x, s = a[i];
        if (s === 0) b[i] = Math.random() < p ? 1 : 0;
        else if (s === 6) b[i] = Math.random() < 0.05 ? 0 : 6;
        else if (s >= 2) b[i] = s >= 5 ? 6 : s + 1;
        else {
          let burn = false;
          const chk = (xx: number, yy: number, bias: number) => {
            if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) return;
            const n = a[yy * gw + xx];
            if (n >= 2 && n <= 5 && Math.random() < sp * bias) burn = true;
          };
          chk(x - 1, y, 1 + wind); chk(x + 1, y, 1 - wind); chk(x, y - 1, 1); chk(x, y + 1, 1);
          if (!burn) { chk(x - 1, y - 1, 0.5 + wind * 0.5); chk(x - 1, y + 1, 0.5 + wind * 0.5); chk(x + 1, y - 1, 0.5 - wind * 0.5); chk(x + 1, y + 1, 0.5 - wind * 0.5); }
          if (!burn && Math.random() < f) { burn = true; strikes++; }
          b[i] = burn ? 2 : 1;
          if (age[i] < 255) age[i]++;
        }
      }
      const tmp = a; a = b; b = tmp;
      if (t % 3 === 0) {
        let tr = 0, bu = 0;
        for (let i = 0; i < G; i++) { if (a[i] === 1) tr++; else if (a[i] >= 2 && a[i] <= 5) bu++; }
        hist.push((tr / G) * 100, (bu / G) * 1000);
      }
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) {
        const o = i * 4, s = a[i];
        if (s === 1) { const g = Math.min(1, age[i] / 200); d[o] = 20 + 20 * (1 - g); d[o + 1] = 80 + 90 * (1 - g); d[o + 2] = 30 + 20 * g; }
        else if (s >= 2 && s <= 5) { const k = (s - 2) / 3; d[o] = 255; d[o + 1] = 230 - k * 170; d[o + 2] = 120 - k * 110; }
        else if (s === 6) { d[o] = 45; d[o + 1] = 32; d[o + 2] = 28; }
        else { d[o] = 18; d[o + 1] = 14; d[o + 2] = 10; }
      }
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) hist.draw(ctx, W - 260, H - 100, 248, 88, { yMax: 100 });
    };
    return {
      step, draw,
      pointer(p) {
        if (p.shift && p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 8, (i) => (a[i] = 1));
        else if (p.type === 'down') stampGrid(gw, gh, p.x / cs, p.y / cs, 2, (i) => { if (a[i] === 1) a[i] = 2; });
      },
      stats: () => { let tr = 0; for (let i = 0; i < G; i++) if (a[i] === 1) tr++; return [['Tick', t], ['Tree cover', `${((tr / G) * 100).toFixed(1)}%`], ['Lightning strikes', strikes]]; },
      actions: [{ label: 'Lightning!', run: () => { for (let k = 0; k < 5; k++) { const i = (Math.random() * G) | 0; if (a[i] === 1) a[i] = 2; } } }],
    };
  },
};
