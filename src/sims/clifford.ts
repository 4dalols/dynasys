import type { SimDef } from '../core/types';
import { PALETTES, makePalette, paletteOptions } from '../core/util';

type Map2 = (x: number, y: number, a: number, b: number, c: number, d: number, o: Float64Array) => void;
const MAPS: Record<string, Map2> = {
  clifford: (x, y, a, b, c, d, o) => { o[0] = Math.sin(a * y) + c * Math.cos(a * x); o[1] = Math.sin(b * x) + d * Math.cos(b * y); },
  dejong: (x, y, a, b, c, d, o) => { o[0] = Math.sin(a * y) - Math.cos(b * x); o[1] = Math.sin(c * x) - Math.cos(d * y); },
  svensson: (x, y, a, b, c, d, o) => { o[0] = d * Math.sin(a * x) - Math.sin(b * y); o[1] = c * Math.cos(a * x) + Math.cos(b * y); },
  bedhead: (x, y, a, b, _c, _d, o) => { o[0] = Math.sin((x * y) / b) * y + Math.cos(a * x - y); o[1] = x + Math.sin(y) / b; },
};

export const clifford: SimDef = {
  id: 'clifford',
  title: 'Attractor Lace',
  tagline: 'Two-line iterated maps (Clifford, de Jong, Svensson) plotted millions of times — delicate fractal silk that morphs as you drag sliders.',
  category: 'Chaos',
  accent: '#f0abfc',
  controls: 'Use the sliders, presets or "Random parameters" · toggle Morph to drift through parameter space',
  thumbSteps: 40,
  params: [
    { type: 'select', key: 'map', label: 'Map', default: 'clifford', options: Object.keys(MAPS).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })) },
    { key: 'a', label: 'a', min: -3, max: 3, step: 0.001, default: -1.7 },
    { key: 'b', label: 'b', min: -3, max: 3, step: 0.001, default: 1.8 },
    { key: 'c', label: 'c', min: -3, max: 3, step: 0.001, default: -0.9 },
    { key: 'd', label: 'd', min: -3, max: 3, step: 0.001, default: -0.4 },
    { type: 'toggle', key: 'morph', label: 'Morph', default: false },
    { key: 'exposure', label: 'Exposure', min: 0.2, max: 3, step: 0.05, default: 1 },
    { type: 'select', key: 'palette', label: 'Palette', default: 'aurora', options: paletteOptions },
  ],
  presets: [
    { name: 'Clifford silk', values: { map: 'clifford', a: -1.7, b: 1.8, c: -0.9, d: -0.4 } },
    { name: 'Clifford ribbon', values: { map: 'clifford', a: 1.5, b: -1.8, c: 1.6, d: 0.9 } },
    { name: 'de Jong nebula', values: { map: 'dejong', a: -2, b: -2, c: -1.2, d: 2, palette: 'ember' } },
    { name: 'de Jong shells', values: { map: 'dejong', a: 1.641, b: 1.902, c: 0.316, d: 1.525, palette: 'ocean' } },
    { name: 'Svensson', values: { map: 'svensson', a: 1.4, b: 1.56, c: 1.4, d: -2.5, palette: 'viridis' } },
    { name: 'Bedhead', values: { map: 'bedhead', a: -0.81, b: -0.92, palette: 'inferno' } },
    { name: 'Morphing', values: { morph: true } },
  ],
  about: `<p>A <b>Clifford attractor</b> is just two trigonometric equations iterated over and over:</p>
<div class="eq">x' = sin(a·y) + c·cos(a·x)<br>y' = sin(b·x) + d·cos(b·y)</div>
<p>Each new point depends only on the last one, yet the orbit never repeats: it wanders a strange attractor forever. We plot millions of iterates into a density histogram and tone-map it logarithmically, so frequently visited regions glow. Small parameter changes can switch between smooth ribbons, dusty clouds and collapse to a few points.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const S = thumbnail ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(W * S), h = Math.floor(H * S);
    const dens = new Float32Array(w * h);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const octx = off.getContext('2d')!; const img = octx.createImageData(w, h);
    let x = 0.1, y = 0.1, total = 0;
    const o = new Float64Array(2);
    let minX = -3, maxX = 3, minY = -3, maxY = 3, fitted = false;
    let mt = 0;
    const reset = () => { dens.fill(0); total = 0; fitted = false; x = 0.1; y = 0.1; };
    const fit = () => {
      const f = MAPS[P.map as string] ?? MAPS.clifford;
      let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity, px = 0.1, py = 0.1;
      for (let k = 0; k < 20000; k++) {
        f(px, py, P.a, P.b, P.c, P.d, o); px = o[0]; py = o[1];
        if (!isFinite(px) || !isFinite(py) || Math.abs(px) > 1e6) { px = 0.1; py = 0.1; continue; }
        if (k > 100) { ax = Math.min(ax, px); bx = Math.max(bx, px); ay = Math.min(ay, py); by = Math.max(by, py); }
      }
      if (!isFinite(ax)) { ax = -1; bx = 1; ay = -1; by = 1; }
      const cx = (ax + bx) / 2, cy = (ay + by) / 2;
      const span = Math.max((bx - ax) / (w * 0.9), (by - ay) / (h * 0.9), 1e-6);
      minX = cx - (span * w) / 2; maxX = cx + (span * w) / 2; minY = cy - (span * h) / 2; maxY = cy + (span * h) / 2;
      fitted = true;
    };
    const step = () => {
      if (P.morph) {
        mt += 0.004;
        P.a = -1.7 + 0.5 * Math.sin(mt * 1.3); P.b = 1.8 + 0.4 * Math.cos(mt * 0.9);
        P.c = -0.9 + 0.6 * Math.sin(mt * 0.7); P.d = -0.4 + 0.6 * Math.cos(mt * 1.1);
        dens.fill(0); total = 0; if (mt % 0.2 < 0.004) fitted = false;
      }
      if (!fitted) fit();
      const f = MAPS[P.map as string] ?? MAPS.clifford;
      const a = P.a, b = P.b, c = P.c, d = P.d, sx = w / (maxX - minX), sy = h / (maxY - minY);
      const n = P.morph ? 250000 : thumbnail ? 400000 : 150000;
      for (let k = 0; k < n; k++) {
        f(x, y, a, b, c, d, o); x = o[0]; y = o[1];
        if (!isFinite(x) || !isFinite(y)) { x = Math.random(); y = Math.random(); continue; }
        const px = ((x - minX) * sx) | 0, py = ((maxY - y) * sy) | 0;
        if (px >= 0 && py >= 0 && px < w && py < h) dens[py * w + px]++;
      }
      total += n;
    };
    let lutName = '', lut = makePalette(PALETTES.aurora);
    const draw = () => {
      if (lutName !== P.palette) { lutName = P.palette as string; lut = makePalette(PALETTES[lutName] ?? PALETTES.aurora); }
      let mx = 1; for (let i = 0; i < dens.length; i += 7) if (dens[i] > mx) mx = dens[i];
      const lm = Math.log(1 + mx), ex = P.exposure as number, dd = img.data;
      for (let i = 0; i < dens.length; i++) {
        let v = dens[i] ? Math.pow(Math.log(1 + dens[i]) / lm, 1 / ex) : 0;
        const k = Math.min(255, (v * 255) | 0) * 3;
        dd[i * 4] = lut[k]; dd[i * 4 + 1] = lut[k + 1]; dd[i * 4 + 2] = lut[k + 2]; dd[i * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, W, H);
    };
    return {
      step, draw,
      paramChanged(k) { if (k !== 'palette' && k !== 'exposure' && k !== 'morph') reset(); },
      stats: () => [['Points plotted', `${(total / 1e6).toFixed(1)} M`], ['a, b, c, d', `${(+P.a).toFixed(2)}, ${(+P.b).toFixed(2)}, ${(+P.c).toFixed(2)}, ${(+P.d).toFixed(2)}`]],
      actions: [{ label: 'Random parameters', run: () => { for (const k of ['a', 'b', 'c', 'd']) P[k] = +(Math.random() * 6 - 3).toFixed(3); reset(); } }],
    };
  },
};
