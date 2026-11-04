import type { SimDef } from '../core/types';
import { PixelBuffer, PALETTES, makePalette, paletteOptions, stampGrid, rand } from '../core/util';

export const lenia: SimDef = {
  id: 'lenia',
  title: 'Lenia',
  tagline: 'Continuous Game of Life: smooth kernels and a growth curve give rise to gliding, breathing, lifelike creatures.',
  category: 'Growth & Patterns',
  accent: '#22d3ee',
  controls: 'Drag to paint life · shift-drag erases',
  thumbSteps: 120,
  params: [
    { key: 'size', label: 'Grid size', min: 96, max: 256, step: 8, default: 160, reset: true },
    { key: 'R', label: 'Kernel radius R', min: 6, max: 20, step: 1, default: 13, reset: true },
    { key: 'rings', label: 'Kernel rings', min: 1, max: 3, step: 1, default: 1, reset: true },
    { key: 'mu', label: 'Growth centre μ', min: 0.05, max: 0.45, step: 0.001, default: 0.15 },
    { key: 'sigma', label: 'Growth width σ', min: 0.003, max: 0.06, step: 0.001, default: 0.017 },
    { key: 'dt', label: 'Time step dt', min: 0.02, max: 0.5, step: 0.01, default: 0.1 },
    { type: 'select', key: 'seed', label: 'Seed', default: 'blobs', reset: true, options: [{ value: 'blobs', label: 'Random blobs' }, { value: 'noise', label: 'Noise soup' }] },
    { type: 'select', key: 'palette', label: 'Palette', default: 'aurora', options: paletteOptions },
  ],
  presets: [
    { name: 'Orbium gliders', values: { R: 13, rings: 1, mu: 0.15, sigma: 0.016, dt: 0.1 } },
    { name: 'Wobbling cells', values: { R: 10, rings: 2, mu: 0.26, sigma: 0.036, dt: 0.1 } },
    { name: 'Triple-ring', values: { R: 16, rings: 3, mu: 0.28, sigma: 0.045, dt: 0.1 } },
    { name: 'Spreading foam', values: { R: 10, rings: 1, mu: 0.12, sigma: 0.025, dt: 0.15, seed: 'noise' } },
    { name: 'Dividing', values: { R: 13, rings: 1, mu: 0.15, sigma: 0.018, dt: 0.1 } },
  ],
  about: `<p><b>Lenia</b> (Bert Chan, 2018) makes the Game of Life continuous in space, time and state. Each cell holds a value in [0,1]. Its neighbourhood sum is a smooth ring-shaped kernel K convolved with the field, and the field grows or decays depending on whether that sum is near μ:</p>
<div class="eq">A ← clip(A + dt · G(K ∗ A), 0, 1),   G(u) = 2·exp(−(u−μ)²/2σ²) − 1</div>
<p>Within a narrow band of μ and σ, random blobs condense into self-organising "creatures" like the <i>Orbium</i>, which glides steadily across the toroidal world. Nudge σ to see them destabilise, divide, or dissolve.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const N = thumbnail ? 96 : (P.size as number);
    const gw = Math.round(N * Math.max(1, W / H)), gh = Math.round(N * Math.max(1, H / W));
    const G = gw * gh, R = thumbnail ? 10 : (P.R as number), rings = P.rings as number;
    let A = new Float32Array(G), B = new Float32Array(G);
    const offs: number[] = [], wts: number[] = [];
    let sum = 0;
    const peaks = rings === 1 ? [1] : rings === 2 ? [1, 2 / 3] : [1 / 2, 1, 2 / 3];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx, dy) / R;
      if (r >= 1 || r === 0) continue;
      const br = r * rings, k = Math.min(rings - 1, br | 0), f = br - k;
      const w = peaks[k] * Math.exp(4 - 1 / Math.max(1e-6, f * (1 - f)));
      if (w < 1e-4) continue;
      offs.push(dx, dy); wts.push(w); sum += w;
    }
    const K = offs.length / 2;
    const ox = new Int32Array(K), oy = new Int32Array(K), kw = new Float32Array(K);
    for (let k = 0; k < K; k++) { ox[k] = offs[2 * k]; oy[k] = offs[2 * k + 1]; kw[k] = wts[k] / sum; }
    const seed = () => {
      A.fill(0);
      if (P.seed === 'noise') { for (let i = 0; i < G; i++) A[i] = Math.random() < 0.5 ? Math.random() : 0; return; }
      const n = Math.max(2, Math.round(G / (R * R * 45)));
      for (let b = 0; b < n; b++) {
        const cx = rand(gw), cy = rand(gh), s = R * rand(0.7, 1.1);
        for (let dy = -s; dy <= s; dy++) for (let dx = -s; dx <= s; dx++) {
          if (dx * dx + dy * dy > s * s) continue;
          const x = (((cx + dx) | 0) % gw + gw) % gw, y = (((cy + dy) | 0) % gh + gh) % gh;
          A[y * gw + x] = Math.random();
        }
      }
    };
    seed();
    const step = () => {
      const mu = P.mu as number, s2 = 2 * (P.sigma as number) ** 2, dt = P.dt as number;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let u = 0;
        const inner = x >= R && x < gw - R && y >= R && y < gh - R;
        if (inner) { const base = y * gw + x; for (let k = 0; k < K; k++) u += A[base + oy[k] * gw + ox[k]] * kw[k]; }
        else for (let k = 0; k < K; k++) u += A[((y + oy[k] + gh) % gh) * gw + ((x + ox[k] + gw) % gw)] * kw[k];
        const i = y * gw + x, g = 2 * Math.exp(-((u - mu) ** 2) / s2) - 1;
        const v = A[i] + dt * g;
        B[i] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
      const t = A; A = B; B = t;
    };
    const buf = new PixelBuffer(gw, gh);
    let lutName = '', lut = makePalette(PALETTES.aurora);
    const draw = () => {
      if (lutName !== P.palette) { lutName = P.palette as string; lut = makePalette(PALETTES[lutName] ?? PALETTES.aurora); }
      buf.fromField(A, lut);
      const sc = Math.max(W / gw, H / gh);
      buf.blit(ctx, gw * sc, gh * sc, true);
    };
    return {
      step, draw,
      pointer(p) {
        if (!p.down) return;
        const sc = Math.max(W / gw, H / gh);
        stampGrid(gw, gh, p.x / sc, p.y / sc, R * 0.8, (i) => (A[i] = p.shift || p.button === 2 ? 0 : Math.random()));
      },
      stats: () => { let m = 0; for (let i = 0; i < G; i++) m += A[i]; return [['Mass', m.toFixed(0)], ['Kernel taps', K]]; },
      actions: [{ label: 'Re-seed', run: seed }, { label: 'Clear', run: () => A.fill(0) }],
    };
  },
};
