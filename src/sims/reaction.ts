import type { SimDef } from '../core/types';
import { PALETTES, PixelBuffer, makePalette, paletteOptions, rand, stampGrid } from '../core/util';

export const reaction: SimDef = {
  id: 'reaction',
  title: 'Reaction–Diffusion',
  tagline: 'Gray–Scott chemistry: two diffusing reagents self-organise into coral, mitosis, worms and travelling spots.',
  category: 'Growth & Patterns',
  accent: '#a78bfa',
  controls: 'Drag to paint reagent V · shift-drag to erase',
  thumbSteps: 260,
  params: [
    { key: 'feed', label: 'Feed rate F', min: 0.005, max: 0.1, step: 0.0005, default: 0.0545, fmt: (v) => v.toFixed(4) },
    { key: 'kill', label: 'Kill rate k', min: 0.04, max: 0.075, step: 0.0005, default: 0.062, fmt: (v) => v.toFixed(4) },
    { key: 'du', label: 'Diffusion U', min: 0.1, max: 1, step: 0.01, default: 1 },
    { key: 'dv', label: 'Diffusion V', min: 0.05, max: 0.8, step: 0.01, default: 0.5 },
    { key: 'iters', label: 'Iterations / frame', min: 1, max: 40, step: 1, default: 12 },
    { key: 'res', label: 'Cell size (px)', min: 2, max: 6, step: 1, default: 3, reset: true },
    { type: 'select', key: 'seed', label: 'Seed', default: 'squares', reset: true, options: [
      { value: 'squares', label: 'Random squares' }, { value: 'center', label: 'Single drop' }, { value: 'noise', label: 'Noise' }, { value: 'ring', label: 'Ring' } ] },
    { type: 'toggle', key: 'gradient', label: 'Map F/k across canvas', default: false, hint: 'Feed varies left→right, kill bottom→top: a whole parameter map at once' },
    { type: 'select', key: 'palette', label: 'Palette', default: 'aurora', options: paletteOptions },
  ],
  presets: [
    { name: 'Coral', values: { feed: 0.0545, kill: 0.062 } },
    { name: 'Mitosis', values: { feed: 0.0367, kill: 0.0649, palette: 'viridis' } },
    { name: 'Worms', values: { feed: 0.078, kill: 0.061, palette: 'toxic' } },
    { name: 'Solitons', values: { feed: 0.03, kill: 0.062, palette: 'ember' } },
    { name: 'U-skate', values: { feed: 0.062, kill: 0.0609, seed: 'center', palette: 'ocean' } },
    { name: 'Maze', values: { feed: 0.029, kill: 0.057, palette: 'bone' } },
    { name: 'Waves', values: { feed: 0.014, kill: 0.045, palette: 'inferno' } },
    { name: 'Holes', values: { feed: 0.039, kill: 0.058, palette: 'aurora' } },
    { name: 'Parameter map', values: { gradient: true, seed: 'noise', palette: 'viridis' } },
  ],
  about: `<p>Two chemicals U and V diffuse at different rates. V eats U to make more of itself (<code>U + 2V → 3V</code>), U is fed in at rate F, and V is removed at rate F + k.</p>
<div class="eq">∂u/∂t = D_u ∇²u − uv² + F(1 − u)
∂v/∂t = D_v ∇²v + uv² − (F + k)v</div>
<p>Alan Turing proposed in 1952 that such systems could explain animal coat patterns. Tiny changes in F and k flip between radically different regimes — Robert Munafo's map lists dozens. Tick <b>Map F/k across canvas</b> to see many regimes side by side.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 2 : (P.res as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    let u = new Float32Array(G).fill(1), v = new Float32Array(G);
    let u2 = new Float32Array(G), v2 = new Float32Array(G);
    const seed = P.seed as string;
    const blob = (x: number, y: number, r: number) => stampGrid(gw, gh, x, y, r, (i) => { u[i] = 0.5; v[i] = 0.25 + rand(0.05); });
    if (seed === 'squares') for (let k = 0; k < Math.max(8, (G / 3000) | 0); k++) {
      const x0 = rand(gw), y0 = rand(gh), s = rand(3, 8);
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) if (x < gw && y < gh) { const i = (y | 0) * gw + (x | 0); u[i] = 0.5; v[i] = 0.25; }
    }
    else if (seed === 'center') blob(gw / 2, gh / 2, 6);
    else if (seed === 'ring') { for (let t = 0; t < 360; t += 3) blob(gw / 2 + Math.cos(t) * gh * 0.3, gh / 2 + Math.sin(t) * gh * 0.3, 2); }
    else for (let i = 0; i < G; i++) if (Math.random() < 0.05) { u[i] = 0.5; v[i] = 0.25; }
    let lut = makePalette(PALETTES[P.palette]);
    const buf = new PixelBuffer(gw, gh);

    const step = () => {
      const du = P.du as number, dv = P.dv as number, grad = P.gradient as boolean;
      for (let it = 0; it < P.iters; it++) {
        for (let y = 0; y < gh; y++) {
          const ym = (y === 0 ? gh - 1 : y - 1) * gw, y0 = y * gw, yp = (y === gh - 1 ? 0 : y + 1) * gw;
          const kk = grad ? 0.045 + (1 - y / gh) * 0.025 : (P.kill as number);
          for (let x = 0; x < gw; x++) {
            const xm = x === 0 ? gw - 1 : x - 1, xp = x === gw - 1 ? 0 : x + 1;
            const i = y0 + x;
            const uu = u[i], vv = v[i];
            const lu = (u[ym + x] + u[yp + x] + u[y0 + xm] + u[y0 + xp]) * 0.2 + (u[ym + xm] + u[ym + xp] + u[yp + xm] + u[yp + xp]) * 0.05 - uu;
            const lv = (v[ym + x] + v[yp + x] + v[y0 + xm] + v[y0 + xp]) * 0.2 + (v[ym + xm] + v[ym + xp] + v[yp + xm] + v[yp + xp]) * 0.05 - vv;
            const ff = grad ? 0.01 + (x / gw) * 0.09 : (P.feed as number);
            const uvv = uu * vv * vv;
            u2[i] = uu + du * lu - uvv + ff * (1 - uu);
            v2[i] = vv + dv * lv + uvv - (ff + kk) * vv;
          }
        }
        let t = u; u = u2; u2 = t;
        t = v; v = v2; v2 = t;
      }
    };
    const draw = () => {
      buf.fromField(v, lut, 2.6);
      buf.blit(ctx, gw * cs, gh * cs, true);
    };
    return {
      step, draw,
      paramChanged(k) { if (k === 'palette') lut = makePalette(PALETTES[P.palette]); },
      pointer(p) {
        if (!p.down) return;
        const erase = p.shift || p.button === 2;
        stampGrid(gw, gh, p.x / cs, p.y / cs, erase ? 10 : 4, (i) => { if (erase) { u[i] = 1; v[i] = 0; } else { u[i] = 0.5; v[i] = 0.25; } });
      },
      stats: () => [['Grid', `${gw}×${gh}`], ['F', P.gradient ? 'map' : P.feed], ['k', P.gradient ? 'map' : P.kill]],
      actions: [
        { label: 'Sprinkle', run: () => { for (let k = 0; k < 12; k++) blob(rand(gw), rand(gh), 3); } },
        { label: 'Clear', run: () => { u.fill(1); v.fill(0); blob(gw / 2, gh / 2, 5); } },
      ],
    };
  },
};
