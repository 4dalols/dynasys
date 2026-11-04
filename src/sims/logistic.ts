import type { SimDef } from '../core/types';
import { roundRect } from '../core/util';

type MapDef = { f: (r: number, x: number) => number; r: [number, number]; x: [number, number]; label: string; x0: number };
const MAPS: Record<string, MapDef> = {
  logistic: { f: (r, x) => r * x * (1 - x), r: [2.5, 4], x: [0, 1], label: 'x → r·x(1−x)', x0: 0.5 },
  sine: { f: (r, x) => (r / 4) * Math.sin(Math.PI * x), r: [2.5, 4], x: [0, 1], label: 'x → (r/4)·sin(πx)', x0: 0.5 },
  tent: { f: (r, x) => (r / 2) * Math.min(x, 1 - x), r: [2, 4], x: [0, 1], label: 'x → (r/2)·min(x, 1−x)', x0: 0.37 },
  gauss: { f: (r, x) => Math.exp(-6.2 * x * x) + r, r: [-1, 1], x: [-1, 1.5], label: 'x → exp(−6.2x²) + r', x0: 0.1 },
  cubic: { f: (r, x) => r * x - x * x * x, r: [1, 3], x: [-2, 2], label: 'x → r·x − x³', x0: 0.1 },
};

export const logistic: SimDef = {
  id: 'logistic',
  title: 'Road to Chaos',
  tagline: 'The bifurcation diagram of the logistic map: period-doubling cascades, windows of order, and Feigenbaum’s constant.',
  category: 'Chaos',
  accent: '#a3e635',
  controls: 'Hover to pick r (cobweb + time series) · scroll to zoom · drag to pan',
  thumbSteps: 4,
  params: [
    { type: 'select', key: 'map', label: 'Map', default: 'logistic', reset: true, options: Object.keys(MAPS).map((k) => ({ value: k, label: `${k[0].toUpperCase()}${k.slice(1)}  ${MAPS[k].label}` })) },
    { key: 'iters', label: 'Points per column', min: 100, max: 4000, step: 100, default: 1200, reset: true },
    { key: 'gamma', label: 'Brightness', min: 0.2, max: 1, step: 0.01, default: 0.45, reset: true },
    { type: 'toggle', key: 'lyap', label: 'Show Lyapunov exponent', default: true },
  ],
  presets: [
    { name: 'Logistic', values: { map: 'logistic' } },
    { name: 'Sine map', values: { map: 'sine' } },
    { name: 'Gauss map', values: { map: 'gauss' } },
    { name: 'Cubic (symmetric)', values: { map: 'cubic' } },
  ],
  about: `<p>Iterate a one-line rule like <b>x → r·x(1−x)</b> and plot where x ends up for each r. For small r it settles to one value; at r = 3 it flips between two, then 4, 8, 16… with each doubling arriving faster by the ratio <b>δ ≈ 4.669</b> — Feigenbaum's constant, the same for every smooth one-hump map.</p>
<p>Past r ≈ 3.5699 the orbit is chaotic, but laced with windows of order (look for the period-3 window near r ≈ 3.83 — and "period three implies chaos"). The green/red strip is the <b>Lyapunov exponent</b>: positive (red) means nearby orbits diverge exponentially.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const M = MAPS[P.map as string] ?? MAPS.logistic;
    let [r0, r1] = M.r, [x0, x1] = M.x;
    const strip = 40;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d')!;
    const dens = new Float32Array(W * H);
    const lyap = new Float32Array(W);
    let col = 0;
    const img = octx.createImageData(W, H);
    const iters = thumbnail ? 300 : (P.iters as number);
    const restart = () => { col = 0; dens.fill(0); };
    const plotH = () => (P.lyap ? H - strip : H);
    const renderColumn = (c: number) => {
      const r = r0 + ((c + 0.5) / W) * (r1 - r0), ph = plotH();
      let x = M.x0, l = 0;
      for (let k = 0; k < 400; k++) x = M.f(r, x);
      for (let k = 0; k < iters; k++) {
        const nx = M.f(r, x);
        const h = 1e-6, d = (M.f(r, x + h) - M.f(r, x - h)) / (2 * h);
        l += Math.log(Math.abs(d) + 1e-12);
        x = nx;
        if (!isFinite(x)) break;
        const py = ((x1 - x) / (x1 - x0)) * ph;
        if (py >= 0 && py < ph) dens[(py | 0) * W + c]++;
      }
      lyap[c] = l / iters;
      let mx = 1; for (let y = 0; y < ph; y++) mx = Math.max(mx, dens[y * W + c]);
      const gam = P.gamma as number;
      for (let y = 0; y < H; y++) {
        const o = (y * W + c) * 4;
        if (y < ph) {
          const v = Math.pow(Math.min(1, dens[y * W + c] / (mx * 0.5)), gam);
          img.data[o] = 20 + 180 * v; img.data[o + 1] = 25 + 230 * v; img.data[o + 2] = 40 + 120 * v; img.data[o + 3] = 255;
        } else {
          const L = lyap[c], t = Math.max(-1, Math.min(1, L));
          img.data[o] = t > 0 ? 60 + 195 * t : 15; img.data[o + 1] = t < 0 ? 60 + 150 * -t : 15; img.data[o + 2] = 25; img.data[o + 3] = 255;
          if (y === ph + strip / 2 && Math.abs(L) < 0.02) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; }
        }
      }
    };
    let hoverR: number | null = null;
    let drag: { x: number; y: number } | null = null;
    const step = () => {
      const t0 = performance.now();
      while (col < W && performance.now() - t0 < (thumbnail ? 2000 : 12)) renderColumn(col++);
    };
    const draw = () => {
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0);
      if (thumbnail) return;
      const ph = plotH();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px ui-sans-serif, system-ui';
      ctx.fillText(`r ∈ [${r0.toFixed(5)}, ${r1.toFixed(5)}]   x ∈ [${x0.toFixed(4)}, ${x1.toFixed(4)}]`, 12, ph - 10);
      if (hoverR === null) return;
      const r = hoverR, sx = ((r - r0) / (r1 - r0)) * W;
      ctx.strokeStyle = 'rgba(250,204,21,0.6)'; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
      const bw = 220, bh = 220, bx = sx > W / 2 ? 16 : W - bw - 16, by = 16;
      ctx.fillStyle = 'rgba(8,10,18,0.88)'; roundRect(ctx, bx, by, bw, bh + 70, 10); ctx.fill();
      const [a, b] = M.x;
      const X = (v: number) => bx + 10 + ((v - a) / (b - a)) * (bw - 20), Y = (v: number) => by + bh - 10 - ((v - a) / (b - a)) * (bh - 20);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
      ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 100; k++) { const v = a + ((b - a) * k) / 100; k ? ctx.lineTo(X(v), Y(M.f(r, v))) : ctx.moveTo(X(v), Y(M.f(r, v))); }
      ctx.stroke();
      let x = M.x0; const seq: number[] = [];
      ctx.strokeStyle = 'rgba(250,204,21,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(x), Y(a));
      for (let k = 0; k < 80; k++) { const nx = M.f(r, x); ctx.lineTo(X(x), Y(nx)); ctx.lineTo(X(nx), Y(nx)); x = nx; seq.push(x); }
      ctx.stroke();
      ctx.strokeStyle = '#facc15'; ctx.beginPath();
      seq.forEach((v, k) => { const px = bx + 10 + (k / 79) * (bw - 20), py = by + bh + 60 - ((v - a) / (b - a)) * 50; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(`r = ${r.toFixed(5)}`, bx + 10, by + 14);
    };
    return {
      step, draw,
      pointer(p) {
        hoverR = r0 + (p.x / W) * (r1 - r0);
        if (p.type === 'down') drag = { x: p.x, y: p.y };
        if (p.type === 'up') drag = null;
        if (p.type === 'move' && drag && p.down) {
          const dr = (-p.dx / W) * (r1 - r0), dx = (p.dy / plotH()) * (x1 - x0);
          r0 += dr; r1 += dr; x0 += dx; x1 += dx; restart();
        }
      },
      wheel(px, py, delta) {
        const f = delta > 0 ? 1.25 : 0.8;
        const rc = r0 + (px / W) * (r1 - r0), xc = x1 - (py / plotH()) * (x1 - x0);
        r0 = rc + (r0 - rc) * f; r1 = rc + (r1 - rc) * f; x0 = xc + (x0 - xc) * f; x1 = xc + (x1 - xc) * f; restart();
      },
      paramChanged(k) { if (k === 'lyap') restart(); },
      stats: () => [['Rendered', `${Math.round((col / W) * 100)}%`], ['λ at cursor', hoverR === null ? '—' : lyap[Math.max(0, Math.min(W - 1, (((hoverR - r0) / (r1 - r0)) * W) | 0))].toFixed(3)]],
      actions: [
        { label: 'Reset view', run: () => { [r0, r1] = M.r; [x0, x1] = M.x; restart(); } },
        { label: 'Zoom: period-3 window', run: () => { r0 = 3.82; r1 = 3.86; x0 = 0; x1 = 1; restart(); } },
        { label: 'Zoom: Feigenbaum point', run: () => { r0 = 3.54; r1 = 3.58; x0 = 0.82; x1 = 0.9; restart(); } },
      ],
    };
  },
};
