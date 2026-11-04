import type { SimDef } from '../core/types';
import { SpatialGrid, TAU, rand, roundRect } from '../core/util';

const S = 0, I = 1, R = 2, D = 3, V = 4;
const COLORS = ['#60a5fa', '#f43f5e', '#a3a3a3', '#3f3f46', '#34d399'];

export const epidemic: SimDef = {
  id: 'epidemic',
  title: 'Epidemic',
  tagline: 'An SIR(S) outbreak among moving people — distancing, quarantine, vaccines and waning immunity.',
  category: 'Societies',
  accent: '#f43f5e',
  controls: 'Click to infect people nearby',
  thumbSteps: 500,
  params: [
    { key: 'count', label: 'Population', min: 100, max: 5000, step: 100, default: 1500, reset: true },
    { key: 'initial', label: 'Initially infected', min: 1, max: 50, step: 1, default: 3, reset: true },
    { type: 'group', label: 'Disease' },
    { key: 'radius', label: 'Infection radius', min: 2, max: 30, step: 0.5, default: 7 },
    { key: 'pInf', label: 'Transmission chance', min: 0.005, max: 0.5, step: 0.005, default: 0.06 },
    { key: 'duration', label: 'Days infectious', min: 2, max: 30, step: 0.5, default: 10 },
    { key: 'mortality', label: 'Fatality rate', min: 0, max: 0.2, step: 0.005, default: 0.01, fmt: (v) => `${(v * 100).toFixed(1)}%` },
    { key: 'waning', label: 'Immunity lasts (days, 0=∞)', min: 0, max: 200, step: 5, default: 0 },
    { type: 'group', label: 'Behaviour' },
    { key: 'speed', label: 'Movement', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'distancing', label: 'Social distancing', min: 0, max: 0.95, step: 0.05, default: 0, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Fraction of people who stay put' },
    { key: 'quarantine', label: 'Quarantine compliance', min: 0, max: 1, step: 0.05, default: 0, fmt: (v) => `${Math.round(v * 100)}%`, hint: 'Chance a sick person stops moving after 2 days' },
    { type: 'toggle', key: 'market', label: 'Central market trips', default: false },
  ],
  presets: [
    { name: 'Uncontrolled', values: {} },
    { name: 'Flatten the curve', values: { distancing: 0.75 } },
    { name: 'Quarantine', values: { quarantine: 0.9 } },
    { name: 'Endemic (SIRS)', values: { waning: 60 } },
    { name: 'Super-spreader market', values: { market: true, pInf: 0.04 } },
  ],
  about: `<p>Every person is <b style="color:#60a5fa">Susceptible</b>, <b style="color:#f43f5e">Infected</b>, <b style="color:#a3a3a3">Recovered</b> (or dead / vaccinated). Infection passes on contact with a per-tick probability; after the infectious period people recover or die.</p>
<p>The key number is <b>R₀</b>, the average number of people one case infects. Distancing lowers contacts, quarantine shortens effective infectiousness, vaccination removes susceptibles. Once enough are immune (<b>herd immunity</b>, ≈ 1 − 1/R₀) the epidemic burns out — unless immunity wanes, in which case it settles into recurring waves.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const N = P.count as number, dayTicks = 30;
    const x = new Float32Array(N), y = new Float32Array(N), a = new Float32Array(N), st = new Uint8Array(N), timer = new Float32Array(N), home = new Uint8Array(N), q = new Uint8Array(N);
    const tx = new Float32Array(N), ty = new Float32Array(N), trip = new Float32Array(N);
    const plotH = thumbnail ? 0 : 110, top = 0, Hh = H - plotH - (thumbnail ? 0 : 12);
    for (let i = 0; i < N; i++) { x[i] = rand(W); y[i] = rand(top, Hh); a[i] = rand(TAU); home[i] = Math.random() < P.distancing ? 1 : 0; }
    for (let k = 0; k < P.initial; k++) { const i = (Math.random() * N) | 0; st[i] = I; timer[i] = 0; }
    const grid = new SpatialGrid(W, H, 30);
    let t = 0, peak = 0, totalInf = P.initial as number, secondary = 0, resolved = 0;
    const history: number[][] = [];
    const step = () => {
      t++;
      // re-evaluate distancing compliance if slider moved
      if (t % 30 === 0) for (let i = 0; i < N; i++) home[i] = (i * 0.618034) % 1 < P.distancing ? 1 : 0;
      grid.build(x, y, N);
      const r = P.radius as number, r2 = r * r, p = P.pInf as number;
      for (let i = 0; i < N; i++) {
        if (st[i] !== I) continue;
        grid.query(x[i], y[i], r, (j) => {
          if (st[j] !== S) return;
          const dx = x[j] - x[i], dy = y[j] - y[i];
          if (dx * dx + dy * dy < r2 && Math.random() < p) { st[j] = I; timer[j] = 0; totalInf++; secondary++; }
        });
      }
      const dur = (P.duration as number) * dayTicks, wan = (P.waning as number) * dayTicks;
      for (let i = 0; i < N; i++) {
        if (st[i] === I) {
          timer[i]++;
          if (timer[i] === 2 * dayTicks && Math.random() < P.quarantine) q[i] = 1;
          if (timer[i] > dur) { st[i] = Math.random() < P.mortality ? D : R; timer[i] = 0; q[i] = 0; resolved++; }
        } else if ((st[i] === R || st[i] === V) && wan > 0) {
          timer[i]++;
          if (timer[i] > wan) { st[i] = S; timer[i] = 0; }
        }
        if (st[i] === D || home[i] || q[i]) continue;
        let sp = P.speed as number;
        if (P.market) {
          if (trip[i] > 0) {
            trip[i]--;
            const dx = tx[i] - x[i], dy = ty[i] - y[i];
            a[i] = Math.atan2(dy, dx) + rand(-0.3, 0.3);
            if (dx * dx + dy * dy < 100) { trip[i] = 0; a[i] = rand(TAU); }
            sp *= 1.5;
          } else if (Math.random() < 0.0015) { trip[i] = 200; tx[i] = W / 2 + rand(-15, 15); ty[i] = Hh / 2 + rand(-15, 15); }
        }
        a[i] += rand(-0.3, 0.3);
        x[i] += Math.cos(a[i]) * sp; y[i] += Math.sin(a[i]) * sp;
        if (x[i] < 0 || x[i] > W) { a[i] = Math.PI - a[i]; x[i] = Math.max(0, Math.min(W, x[i])); }
        if (y[i] < top || y[i] > Hh) { a[i] = -a[i]; y[i] = Math.max(top, Math.min(Hh, y[i])); }
      }
      if (t % 6 === 0) {
        const c = [0, 0, 0, 0, 0];
        for (let i = 0; i < N; i++) c[st[i]]++;
        history.push(c);
        if (history.length > 600) history.shift();
        peak = Math.max(peak, c[I]);
      }
    };
    const draw = () => {
      ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
      if (P.market) { ctx.strokeStyle = 'rgba(250,204,21,0.4)'; ctx.beginPath(); ctx.arc(W / 2, Hh / 2, 24, 0, TAU); ctx.stroke(); }
      for (let s = 0; s < 5; s++) {
        ctx.fillStyle = COLORS[s];
        ctx.beginPath();
        for (let i = 0; i < N; i++) if (st[i] === s) { ctx.moveTo(x[i] + 2.4, y[i]); ctx.arc(x[i], y[i], 2.4, 0, TAU); }
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(244,63,94,0.25)';
      ctx.beginPath();
      for (let i = 0; i < N; i++) if (st[i] === I) { ctx.moveTo(x[i] + P.radius, y[i]); ctx.arc(x[i], y[i], P.radius, 0, TAU); }
      ctx.stroke();
      if (thumbnail || !history.length) return;
      // stacked area chart
      const px = 12, py = H - plotH - 4, pw = W - 24;
      ctx.fillStyle = 'rgba(13,16,27,0.9)'; roundRect(ctx, px, py, pw, plotH, 8); ctx.fill();
      const n = history.length, cw = pw / 600;
      const order = [I, S, R, V, D];
      for (let k = 0; k < n; k++) {
        let acc = 0;
        for (const s of order) {
          const h = (history[k][s] / N) * (plotH - 8);
          ctx.fillStyle = COLORS[s];
          ctx.fillRect(px + k * cw, py + plotH - 4 - acc - h, Math.ceil(cw), h);
          acc += h;
        }
      }
    };
    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down') return;
        for (let i = 0; i < N; i++) if (st[i] === S && (x[i] - p.x) ** 2 + (y[i] - p.y) ** 2 < 900) { st[i] = I; timer[i] = 0; totalInf++; }
      },
      stats: () => {
        const c = [0, 0, 0, 0, 0];
        for (let i = 0; i < N; i++) c[st[i]]++;
        const r0 = resolved > 0 ? secondary / Math.max(1, resolved) : 0;
        return [['Day', (t / dayTicks).toFixed(0)], ['Susceptible', c[S]], ['Infected', c[I]], ['Recovered', c[R]], ['Vaccinated', c[V]], ['Dead', c[D]], ['Peak infected', peak], ['Ever infected', totalInf], ['Avg. secondary cases', r0]];
      },
      actions: [
        { label: 'Vaccinate 10%', run: () => { let k = 0; for (let i = 0; i < N && k < N * 0.1; i++) if (st[i] === S && Math.random() < 0.3) { st[i] = V; timer[i] = 0; k++; } } },
        { label: 'Patient zero', run: () => { const i = (Math.random() * N) | 0; st[i] = I; timer[i] = 0; } },
      ],
    };
  },
};
