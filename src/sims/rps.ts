import type { SimDef } from '../core/types';
import { History, PixelBuffer, stampGrid } from '../core/util';

const COLORS = [[244, 63, 94], [250, 204, 21], [56, 189, 248], [168, 85, 247], [52, 211, 153]];

export const rps: SimDef = {
  id: 'rps',
  title: 'Rock–Paper–Scissors Species',
  tagline: 'Three species that each beat one other and lose to another — mobility decides between spiral coexistence and extinction.',
  category: 'Swarms & Life',
  accent: '#f43f5e',
  controls: 'Drag to drop a patch of the next species · shift-drag clears space',
  thumbSteps: 150,
  params: [
    { key: 'species', label: 'Species', min: 3, max: 5, step: 1, default: 3, reset: true },
    { key: 'mobility', label: 'Mobility', min: 0, max: 1, step: 0.01, default: 0.25, hint: 'Above a critical mobility spirals outgrow the box and biodiversity collapses' },
    { key: 'predation', label: 'Predation rate', min: 0.1, max: 1, step: 0.01, default: 1 },
    { key: 'birth', label: 'Reproduction rate', min: 0.1, max: 1, step: 0.01, default: 1 },
    { key: 'speed', label: 'Monte Carlo sweeps / frame', min: 0.2, max: 4, step: 0.1, default: 1.2 },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 8, step: 1, default: 3, reset: true },
  ],
  presets: [
    { name: 'Spirals', values: {} },
    { name: 'Low mobility (fine mosaic)', values: { mobility: 0.02 } },
    { name: 'High mobility (collapse)', values: { mobility: 0.85 } },
    { name: 'Five species (RPSLS)', values: { species: 5, mobility: 0.15 } },
  ],
  about: `<p>The May–Leonard model of cyclic competition (Reichenbach, Mobilia &amp; Frey, <i>Nature</i> 2007). Each tick a random individual interacts with a random neighbour: it may <b>eat</b> it if it's its prey (leaving an empty site), <b>reproduce</b> into an empty neighbour, or <b>swap</b> places with it.</p>
<p>Because no species is best, all three persist as rotating spiral waves — a mechanism seen in <i>E. coli</i> strains and side-blotched lizards. But mobility matters: if individuals move too much, spirals grow larger than the habitat and two species go extinct.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const S = P.species as number;
    const a = new Uint8Array(G);
    for (let i = 0; i < G; i++) a[i] = Math.random() < 0.1 ? 0 : 1 + ((Math.random() * S) | 0);
    const hist = new History(Array.from({ length: S }, (_, k) => `S${k + 1}`), COLORS.slice(0, S).map((c) => `rgb(${c})`), 300);
    const counts = new Int32Array(S + 1);
    let brushSpecies = 1;
    const beats = (x: number, y: number) => { const d = (y - x + S) % S; return S === 3 ? d === 1 : d === 1 || d === 3; };
    const step = () => {
      const m = P.mobility as number, sig = P.predation as number, mu = P.birth as number;
      const eps = 100 * m * m, tot = eps + sig + mu, pm = eps / tot, ps = sig / tot;
      const events = Math.floor(G * (P.speed as number));
      for (let e = 0; e < events; e++) {
        const i = (Math.random() * G) | 0, x = i % gw, y = (i / gw) | 0;
        const r = (Math.random() * 4) | 0;
        const j = r === 0 ? y * gw + ((x + 1) % gw) : r === 1 ? y * gw + ((x - 1 + gw) % gw) : r === 2 ? ((y + 1) % gh) * gw + x : ((y - 1 + gh) % gh) * gw + x;
        const u = Math.random(), si = a[i], sj = a[j];
        if (u < pm) { a[i] = sj; a[j] = si; }
        else if (u < pm + ps) { if (si && sj && beats(si - 1, sj - 1)) a[j] = 0; }
        else if (si && !sj) a[j] = si;
      }
      counts.fill(0); for (let i = 0; i < G; i++) counts[a[i]]++;
      hist.push(...Array.from({ length: S }, (_, k) => (counts[k + 1] / G) * 100));
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) { const o = i * 4; if (!a[i]) { d[o] = 8; d[o + 1] = 9; d[o + 2] = 16; } else { const c = COLORS[a[i] - 1]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; } }
      buf.blit(ctx, gw * cs, gh * cs);
      if (!thumbnail) hist.draw(ctx, W - 250, H - 90, 238, 78, { yMax: 100 });
    };
    return {
      step, draw,
      pointer(p) {
        if (p.type === 'down') brushSpecies = (brushSpecies % S) + 1;
        if (p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 12, (i) => (a[i] = p.shift || p.button === 2 ? 0 : brushSpecies));
      },
      stats: () => Array.from({ length: S }, (_, k) => [`Species ${k + 1}`, `${((counts[k + 1] / G) * 100).toFixed(1)}%`] as [string, string]),
      actions: [{ label: 'Re-seed', run: () => { for (let i = 0; i < G; i++) a[i] = Math.random() < 0.1 ? 0 : 1 + ((Math.random() * S) | 0); } }],
    };
  },
};
