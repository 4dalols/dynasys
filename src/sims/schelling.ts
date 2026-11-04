import type { SimDef } from '../core/types';
import { History, PixelBuffer } from '../core/util';

const COLS = [[8, 9, 16], [56, 189, 248], [251, 146, 60], [167, 139, 250]];

export const schelling: SimDef = {
  id: 'schelling',
  title: 'Schelling Segregation',
  tagline: 'Mildly picky neighbours who only want a third of their neighbours like them still end up in sharply divided neighbourhoods.',
  category: 'Societies',
  accent: '#fb923c',
  thumbSteps: 60,
  params: [
    { key: 'threshold', label: 'Wants at least this share alike', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'empty', label: 'Vacancy rate', min: 0.02, max: 0.5, step: 0.01, default: 0.1, reset: true },
    { key: 'groups', label: 'Groups', min: 2, max: 3, step: 1, default: 2, reset: true },
    { key: 'cap', label: 'Also leave if alike share above', min: 0.5, max: 1, step: 0.01, default: 1, hint: 'Values below 1 model a preference for diversity' },
    { key: 'moves', label: 'Moves per frame (% of unhappy)', min: 1, max: 100, step: 1, default: 20 },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 10, step: 1, default: 5, reset: true },
  ],
  presets: [
    { name: 'Mild preference (35%)', values: { threshold: 0.35 } },
    { name: 'Tolerant (25%)', values: { threshold: 0.25 } },
    { name: 'Picky (60%)', values: { threshold: 0.6 } },
    { name: 'Three groups', values: { groups: 3, threshold: 0.4 } },
    { name: 'Diversity seekers', values: { threshold: 0.3, cap: 0.7 } },
    { name: 'Too picky (gridlock)', values: { threshold: 0.8, empty: 0.05 } },
  ],
  about: `<p>Thomas Schelling's 1971 model of how individual preferences add up to collective outcomes. Each agent looks at its 8 neighbours; if fewer than the threshold share are like it, it is <b>unhappy</b> and moves to a random vacant home.</p>
<p>The surprise: even agents who would be perfectly happy as a one-third minority produce cities that are 70–80% segregated. The macro pattern is far more extreme than any individual's wish — a classic example of emergence. Try adding an upper limit so agents also leave too-uniform neighbourhoods.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 4 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const ng = P.groups as number, ve = P.empty as number;
    const a = new Uint8Array(G);
    for (let i = 0; i < G; i++) a[i] = Math.random() < ve ? 0 : 1 + ((Math.random() * ng) | 0);
    const hist = new History(['Happy %', 'Alike %'], ['#4ade80', '#fb923c'], 300);
    let happyPct = 0, alikePct = 0;
    const unhappy: number[] = [], empties: number[] = [];
    const scan = () => {
      const th = P.threshold as number, cap = P.cap as number;
      unhappy.length = 0; empties.length = 0;
      let agents = 0, happy = 0, alikeSum = 0;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x, s = a[i];
        if (!s) { empties.push(i); continue; }
        let same = 0, tot = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const o = a[ny * gw + nx];
          if (o) { tot++; if (o === s) same++; }
        }
        const f = tot ? same / tot : 1;
        agents++; alikeSum += f;
        if (f >= th && (f <= cap || cap >= 1)) happy++; else unhappy.push(i);
      }
      happyPct = (happy / agents) * 100; alikePct = (alikeSum / agents) * 100;
    };
    scan();
    const step = () => {
      const m = Math.max(1, Math.ceil(unhappy.length * (P.moves as number) / 100));
      for (let k = 0; k < m && unhappy.length && empties.length; k++) {
        const ui = (Math.random() * unhappy.length) | 0, ei = (Math.random() * empties.length) | 0;
        const from = unhappy[ui], to = empties[ei];
        a[to] = a[from]; a[from] = 0;
        empties[ei] = from; unhappy[ui] = unhappy[unhappy.length - 1]; unhappy.pop();
      }
      scan();
      hist.push(happyPct, alikePct);
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) { const c = COLS[a[i]]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) hist.draw(ctx, W - 250, H - 90, 238, 78, { yMax: 100 });
    };
    return {
      step, draw,
      stats: () => [['Happy', `${happyPct.toFixed(1)}%`], ['Avg. alike neighbours', `${alikePct.toFixed(1)}%`], ['Unhappy agents', unhappy.length]],
      actions: [{ label: 'Shuffle', run: () => { for (let i = G - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } scan(); } }],
    };
  },
};
