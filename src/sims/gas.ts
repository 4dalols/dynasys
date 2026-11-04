import type { SimDef } from '../core/types';
import { SpatialGrid, rand, gauss, TAU, roundRect } from '../core/util';

export const gas: SimDef = {
  id: 'gas',
  title: 'Gas in a Box',
  tagline: 'Hard-sphere molecules bouncing elastically: watch speeds relax to the Maxwell–Boltzmann curve, gases mix, and a pollen grain jitter.',
  category: 'Cosmos & Mechanics',
  accent: '#f472b6',
  controls: 'Drag to stir the gas',
  thumbSteps: 200,
  params: [
    { type: 'select', key: 'mode', label: 'Experiment', default: 'mixing', reset: true, options: [{ value: 'box', label: 'All at one speed (relaxation)' }, { value: 'mixing', label: 'Two gases + divider' }, { value: 'brownian', label: 'Brownian motion' }, { value: 'hotcold', label: 'Hot meets cold' }] },
    { key: 'n', label: 'Molecules', min: 100, max: 4000, step: 50, default: 1500, reset: true },
    { key: 'r', label: 'Molecule radius', min: 1, max: 8, step: 0.5, default: 3, reset: true },
    { key: 'T', label: 'Wall temperature', min: 0, max: 10, step: 0.1, default: 0, hint: '0 = walls are perfectly elastic (no heat exchange)' },
    { key: 'g', label: 'Gravity', min: 0, max: 0.05, step: 0.001, default: 0 },
    { key: 'hole', label: 'Hole in divider', min: 0, max: 0.6, step: 0.01, default: 0.12 },
    { type: 'select', key: 'color', label: 'Colour by', default: 'species', options: [{ value: 'species', label: 'Species' }, { value: 'speed', label: 'Speed' }] },
  ],
  presets: [
    { name: 'Mixing (entropy)', values: { mode: 'mixing' } },
    { name: 'Maxwell–Boltzmann', values: { mode: 'box', color: 'speed' } },
    { name: 'Brownian motion', values: { mode: 'brownian', n: 1800, r: 2 } },
    { name: 'Heat flow', values: { mode: 'hotcold', color: 'speed', hole: 0.6 } },
    { name: 'Atmosphere', values: { mode: 'box', g: 0.02, T: 2, color: 'speed' } },
  ],
  about: `<p>Molecules are hard discs that collide elastically, conserving momentum and energy. No randomness is added — yet the velocity distribution quickly forgets its initial state and settles onto the 2D <b>Maxwell–Boltzmann</b> curve (white line in the histogram):</p>
<div class="eq">f(v) = (v/σ²) · exp(−v²/2σ²),  σ² = kT/m</div>
<p>With a divider, two gases leak through the hole and irreversibly mix — the arrow of time from reversible laws. In Brownian mode, one heavy grain is kicked around by invisible molecules, the effect Einstein used in 1905 to prove atoms exist. Add gravity and a hot floor for an exponential atmosphere.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const mode = P.mode as string;
    const N0 = thumbnail ? 600 : (P.n as number), r = P.r as number;
    const big = mode === 'brownian';
    const N = N0 + (big ? 1 : 0);
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    const rad = new Float32Array(N).fill(r), m = new Float32Array(N).fill(1), sp = new Uint8Array(N);
    const div = mode === 'mixing' || mode === 'hotcold';
    let divider = div;
    for (let i = 0; i < N0; i++) {
      const left = i < N0 / 2;
      x[i] = div ? (left ? rand(r, W / 2 - r - 2) : rand(W / 2 + r + 2, W - r)) : rand(r, W - r);
      y[i] = rand(r, H - r);
      sp[i] = div ? (left ? 0 : 1) : 0;
      let s = 1.5;
      if (mode === 'hotcold') s = left ? 3 : 0.6;
      if (mode === 'box') { const a = rand(TAU); vx[i] = Math.cos(a) * 2; vy[i] = Math.sin(a) * 2; continue; }
      vx[i] = gauss() * s; vy[i] = gauss() * s;
    }
    if (big) { const b = N - 1; rad[b] = 26; m[b] = 60; x[b] = W / 2; y[b] = H / 2; vx[b] = vy[b] = 0; sp[b] = 2; for (let i = 0; i < N0; i++) if ((x[i] - W / 2) ** 2 + (y[i] - H / 2) ** 2 < 32 * 32) x[i] = rand(r, W * 0.3); }
    const grid = new SpatialGrid(W, H, Math.max(8, r * 2 + 1));
    const path: number[] = [];
    const hist = new Float32Array(40);
    let pointer: { x: number; y: number; dx: number; dy: number } | null = null;
    const collide = (i: number, j: number) => {
      const dx = x[j] - x[i], dy = y[j] - y[i], R = rad[i] + rad[j], d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 === 0) return;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const rel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
      const ov = (R - d) / 2;
      x[i] -= nx * ov; y[i] -= ny * ov; x[j] += nx * ov; y[j] += ny * ov;
      if (rel <= 0) return;
      const imp = (2 * rel) / (m[i] + m[j]);
      vx[i] -= imp * m[j] * nx; vy[i] -= imp * m[j] * ny; vx[j] += imp * m[i] * nx; vy[j] += imp * m[i] * ny;
    };
    const wall = (i: number, vn: number) => {
      const T = P.T as number;
      if (T <= 0) return Math.abs(vn);
      return Math.abs(gauss() * Math.sqrt(T * 0.5 / m[i])) + 0.05;
    };
    const step = () => {
      const g = P.g as number, hole = (P.hole as number) * H;
      for (let sub = 0; sub < 2; sub++) {
        for (let i = 0; i < N; i++) {
          vy[i] += g * 0.5;
          const ox = x[i];
          x[i] += vx[i] * 0.5; y[i] += vy[i] * 0.5;
          const R = rad[i];
          if (x[i] < R) { x[i] = R; vx[i] = wall(i, vx[i]); }
          if (x[i] > W - R) { x[i] = W - R; vx[i] = -wall(i, vx[i]); }
          if (y[i] < R) { y[i] = R; vy[i] = wall(i, vy[i]); }
          if (y[i] > H - R) { y[i] = H - R; vy[i] = -wall(i, vy[i]); }
          if (divider && Math.abs(y[i] - H / 2) > hole / 2) {
            const c = W / 2;
            if ((ox < c) !== (x[i] < c) || Math.abs(x[i] - c) < R + 1) { x[i] = ox < c ? c - R - 1 : c + R + 1; vx[i] = -vx[i]; }
          }
          if (pointer) {
            const dx = x[i] - pointer.x, dy = y[i] - pointer.y;
            if (dx * dx + dy * dy < 3600) { vx[i] += pointer.dx * 0.05; vy[i] += pointer.dy * 0.05; }
          }
        }
        grid.build(x, y, N0);
        for (let i = 0; i < N0; i++) grid.query(x[i], y[i], r * 2, (j) => { if (j > i) collide(i, j); });
        if (big) { const b = N - 1; grid.query(x[b], y[b], rad[b] + r, (j) => collide(j, b)); }
      }
      if (big) { path.push(x[N - 1], y[N - 1]); if (path.length > 6000) path.splice(0, 2); }
    };
    const draw = () => {
      ctx.fillStyle = '#070912'; ctx.fillRect(0, 0, W, H);
      const hole = (P.hole as number) * H;
      if (divider) { ctx.fillStyle = '#334155'; ctx.fillRect(W / 2 - 2, 0, 4, H / 2 - hole / 2); ctx.fillRect(W / 2 - 2, H / 2 + hole / 2, 4, H / 2 - hole / 2); }
      let v2 = 0;
      for (let i = 0; i < N0; i++) v2 += vx[i] * vx[i] + vy[i] * vy[i];
      const vrms = Math.sqrt(v2 / N0) || 1;
      const bySpeed = P.color === 'speed';
      for (let i = 0; i < N0; i++) {
        if (bySpeed) { const s = Math.min(1, Math.hypot(vx[i], vy[i]) / (vrms * 2)); ctx.fillStyle = `hsl(${240 - s * 240},90%,${45 + s * 20}%)`; }
        else ctx.fillStyle = sp[i] ? '#fb7185' : '#38bdf8';
        ctx.fillRect(x[i] - r, y[i] - r, r * 2, r * 2);
      }
      if (big) {
        ctx.strokeStyle = 'rgba(250,204,21,0.6)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = 0; k < path.length; k += 2) k ? ctx.lineTo(path[k], path[k + 1]) : ctx.moveTo(path[k], path[k + 1]);
        ctx.stroke();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(x[N - 1], y[N - 1], rad[N - 1], 0, TAU); ctx.fill();
      }
      if (thumbnail) return;
      hist.fill(0);
      const vmax = vrms * 3;
      for (let i = 0; i < N0; i++) { const b = Math.min(39, (Math.hypot(vx[i], vy[i]) / vmax * 40) | 0); hist[b]++; }
      const bx = W - 240, by = H - 120, bw = 226, bh = 106;
      ctx.fillStyle = 'rgba(8,10,18,0.8)'; roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
      const sig2 = v2 / N0 / 2, dv = vmax / 40;
      let hm = 0; for (let k = 0; k < 40; k++) hm = Math.max(hm, hist[k]);
      const theo = (v: number) => (N0 * dv * v / sig2) * Math.exp(-v * v / (2 * sig2));
      hm = Math.max(hm, theo(Math.sqrt(sig2)));
      for (let k = 0; k < 40; k++) { const hgt = (hist[k] / hm) * (bh - 28); ctx.fillStyle = `hsl(${240 - k * 6},80%,60%)`; ctx.fillRect(bx + 8 + k * 5.25, by + bh - 8 - hgt, 4.5, hgt); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 40; k++) { const v = k * dv, hy = by + bh - 8 - (theo(v + dv / 2) / hm) * (bh - 28); k ? ctx.lineTo(bx + 8 + k * 5.25, hy) : ctx.moveTo(bx + 8, hy); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '11px ui-sans-serif, system-ui'; ctx.fillText('Speed distribution vs Maxwell–Boltzmann', bx + 8, by + 14);
    };
    return {
      step, draw,
      pointer(p) { pointer = p.down ? { x: p.x, y: p.y, dx: p.dx, dy: p.dy } : null; },
      stats: () => {
        let ke = 0, l = 0, lr = 0;
        for (let i = 0; i < N0; i++) { ke += 0.5 * (vx[i] ** 2 + vy[i] ** 2); if (x[i] < W / 2) { l++; if (sp[i] === 1) lr++; } }
        const out: [string, string | number][] = [['Temperature (KE/N)', ke / N0]];
        if (div) out.push(['Left side red share', `${Math.round((lr / Math.max(1, l)) * 100)}%`]);
        return out;
      },
      actions: [
        { label: 'Toggle divider', run: () => { divider = !divider; } },
        { label: 'Heat up', run: () => { for (let i = 0; i < N; i++) { vx[i] *= 1.25; vy[i] *= 1.25; } } },
        { label: 'Cool down', run: () => { for (let i = 0; i < N; i++) { vx[i] *= 0.8; vy[i] *= 0.8; } } },
      ],
    };
  },
};
