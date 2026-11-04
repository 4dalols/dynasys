import type { SimDef } from '../core/types';
import { PixelBuffer, rand, stampGrid } from '../core/util';

const RULES: Record<string, { name: string; rule: string }> = {
  conway: { name: "Conway's Life", rule: 'B3/S23' },
  highlife: { name: 'HighLife', rule: 'B36/S23' },
  daynight: { name: 'Day & Night', rule: 'B3678/S34678' },
  seeds: { name: 'Seeds', rule: 'B2/S' },
  maze: { name: 'Maze', rule: 'B3/S12345' },
  coral: { name: 'Coral', rule: 'B3/S45678' },
  anneal: { name: 'Anneal', rule: 'B4678/S35678' },
  brain: { name: "Brian's Brain", rule: 'B2/S/C3' },
  starwars: { name: 'Star Wars', rule: 'B2/S345/C4' },
  fireworks: { name: 'Fireworks', rule: 'B13/S2/C21' },
  frogs: { name: 'Frogs', rule: 'B34/S12/C3' },
};

function parse(rule: string) {
  const born = new Uint8Array(9), surv = new Uint8Array(9);
  let C = 2;
  for (const part of rule.split('/')) {
    if (part[0] === 'B') for (const c of part.slice(1)) born[+c] = 1;
    else if (part[0] === 'S') for (const c of part.slice(1)) surv[+c] = 1;
    else if (part[0] === 'C') C = +part.slice(1);
  }
  return { born, surv, C };
}

export const life: SimDef = {
  id: 'life',
  title: 'Life-like Automata',
  tagline: "Conway's Game of Life and its cousins — HighLife, Day & Night, Brian's Brain, Star Wars and more.",
  category: 'Growth & Patterns',
  accent: '#34d399',
  controls: 'Drag to draw live cells · right/shift-drag to erase',
  thumbSteps: 120,
  params: [
    { type: 'select', key: 'rule', label: 'Rule', default: 'conway', options: Object.entries(RULES).map(([k, v]) => ({ value: k, label: `${v.name} (${v.rule})` })) },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 12, step: 1, default: 4, reset: true },
    { key: 'density', label: 'Random fill', min: 0.02, max: 0.9, step: 0.01, default: 0.3, reset: true },
    { key: 'ghost', label: 'Ghost trails', min: 0, max: 0.98, step: 0.01, default: 0.85 },
    { type: 'toggle', key: 'wrap', label: 'Wrap edges', default: true },
  ],
  presets: Object.entries(RULES).map(([k, v]) => ({ name: v.name, values: { rule: k, density: k === 'seeds' || k === 'brain' || k === 'fireworks' ? 0.05 : k === 'daynight' || k === 'anneal' ? 0.5 : 0.3 } })),
  about: `<p>A grid of cells, each alive or dead. Every tick, a dead cell is <b>born</b> if it has exactly the listed numbers of live neighbours (B), and a live cell <b>survives</b> if its count is in the S list. Conway's <code>B3/S23</code> is enough to build gliders, guns and even a universal computer.</p>
<p>"Generations" rules (with a C number) add dying states: a cell that fails to survive fades through C−2 refractory states before it can be reborn, giving the waves of <b>Brian's Brain</b> and <b>Star Wars</b>.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    let a = new Uint8Array(G), b = new Uint8Array(G);
    const heat = new Float32Array(G);
    for (let i = 0; i < G; i++) a[i] = Math.random() < P.density ? 1 : 0;
    let gen = 0;
    const step = () => {
      const { born, surv, C } = parse(RULES[P.rule as string].rule);
      const wrap = P.wrap as boolean;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            let yy = y + dy;
            if (yy < 0 || yy >= gh) { if (!wrap) continue; yy = (yy + gh) % gh; }
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              let xx = x + dx;
              if (xx < 0 || xx >= gw) { if (!wrap) continue; xx = (xx + gw) % gw; }
              if (a[yy * gw + xx] === 1) n++;
            }
          }
          const i = y * gw + x, s = a[i];
          if (s === 0) b[i] = born[n] ? 1 : 0;
          else if (s === 1) b[i] = surv[n] ? 1 : C > 2 ? 2 : 0;
          else b[i] = s + 1 >= C ? 0 : s + 1;
        }
      }
      const t = a; a = b; b = t;
      const g = P.ghost as number;
      for (let i = 0; i < G; i++) heat[i] = a[i] === 1 ? 1 : heat[i] * g;
      gen++;
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data, C = parse(RULES[P.rule as string].rule).C;
      for (let i = 0; i < G; i++) {
        const o = i * 4, s = a[i];
        if (s === 1) { d[o] = 200; d[o + 1] = 255; d[o + 2] = 230; }
        else if (s > 1) { const f = 1 - (s - 1) / (C - 1); d[o] = 40 + 180 * f; d[o + 1] = 80 * f; d[o + 2] = 120 + 120 * f; }
        else { const h = heat[i]; d[o] = 6 + h * 20; d[o + 1] = 8 + h * 120; d[o + 2] = 14 + h * 110; }
      }
      buf.blit(ctx, gw * cs, gh * cs);
    };
    return {
      step, draw,
      pointer(p) {
        if (!p.down) return;
        const erase = p.button === 2 || p.shift;
        stampGrid(gw, gh, p.x / cs, p.y / cs, erase ? 6 : 2.5, (i) => (a[i] = erase ? 0 : Math.random() < 0.6 ? 1 : a[i]));
      },
      stats: () => { let n = 0; for (let i = 0; i < G; i++) if (a[i] === 1) n++; return [['Generation', gen], ['Alive', n], ['Rule', RULES[P.rule as string].rule]]; },
      actions: [
        { label: 'Randomize', run: () => { for (let i = 0; i < G; i++) a[i] = Math.random() < P.density ? 1 : 0; } },
        { label: 'Clear', run: () => { a.fill(0); heat.fill(0); } },
        { label: 'Glider gun', run: () => {
          const gun = ['........................O', '......................O.O', '............OO......OO............OO', '...........O...O....OO............OO', 'OO........O.....O...OO', 'OO........O...O.OO....O.O', '..........O.....O.......O', '...........O...O', '............OO'];
          const ox = 4 + (rand(gw - 50) | 0), oy = 4 + (rand(gh - 20) | 0);
          gun.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'O' && ox + x < gw && oy + y < gh) a[(oy + y) * gw + ox + x] = 1; }));
        } },
      ],
    };
  },
};
