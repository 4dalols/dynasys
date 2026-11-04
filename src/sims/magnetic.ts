import type { SimDef } from '../core/types';
import { TAU } from '../core/util';

export const magnetic: SimDef = {
  id: 'magnetic',
  title: 'Magnetic Pendulum',
  tagline: 'A pendulum over three magnets: which one it settles on is a fractal function of where you let go.',
  category: 'Chaos',
  accent: '#f59e0b',
  controls: 'Click anywhere to release the pendulum from there',
  thumbSteps: 60,
  params: [
    { key: 'magnets', label: 'Magnets', min: 2, max: 6, step: 1, default: 3, reset: true },
    { key: 'friction', label: 'Friction', min: 0.05, max: 0.5, step: 0.01, default: 0.2, reset: true },
    { key: 'spring', label: 'Spring pull to centre', min: 0.1, max: 1, step: 0.01, default: 0.5, reset: true },
    { key: 'height', label: 'Height above magnets', min: 0.1, max: 0.5, step: 0.01, default: 0.25, reset: true },
    { key: 'res', label: 'Basin pixel size', min: 1, max: 6, step: 1, default: 2, reset: true },
    { type: 'toggle', key: 'shade', label: 'Shade by settling time', default: true, reset: true },
  ],
  presets: [
    { name: 'Classic', values: {} },
    { name: 'Low friction', values: { friction: 0.08 } },
    { name: 'Five magnets', values: { magnets: 5, friction: 0.15 } },
    { name: 'High hanging', values: { height: 0.45 } },
  ],
  about: `<p>A bob hangs over a table with magnets. The pendulum's spring pulls it to the centre, friction slows it, and each magnet attracts it with an inverse-square-ish force. It always ends up on one magnet — but <b>which</b> one depends on the start position so sensitively that the map of outcomes (the <b>basins of attraction</b>) is a fractal.</p>
<div class="eq">r'' = −k r − c r' + Σ_i (m_i − r) / (|m_i − r|² + h²)^{3/2}</div>
<p>The background is computed progressively, one row at a time. Brightness shows how quickly that start point settles. Click to drop the real pendulum and see its path.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const M = P.magnets as number, fr = P.friction as number, k = P.spring as number, h2 = (P.height as number) ** 2;
    const mags = Array.from({ length: M }, (_, i) => [Math.cos((i / M) * TAU - Math.PI / 2), Math.sin((i / M) * TAU - Math.PI / 2)]);
    const hues = mags.map((_, i) => (i * 360) / M + 20);
    const S = Math.min(W, H) / 4.2;
    const toW = (sx: number, sy: number) => [(sx - W / 2) / S, (sy - H / 2) / S];
    const toS = (x: number, y: number) => [W / 2 + x * S, H / 2 + y * S];
    const dt = 0.03;
    const accel = (x: number, y: number, vx: number, vy: number, out: number[]) => {
      let ax = -k * x - fr * vx, ay = -k * y - fr * vy;
      for (const [mx, my] of mags) {
        const dx = mx - x, dy = my - y, d2 = dx * dx + dy * dy + h2, inv = 1 / (d2 * Math.sqrt(d2));
        ax += dx * inv; ay += dy * inv;
      }
      out[0] = ax; out[1] = ay;
    };
    const a = [0, 0];
    const settle = (x: number, y: number): [number, number] => {
      let vx = 0, vy = 0;
      for (let s = 0; s < 3000; s++) {
        accel(x, y, vx, vy, a);
        vx += a[0] * dt; vy += a[1] * dt; x += vx * dt; y += vy * dt;
        if (s > 20 && vx * vx + vy * vy < 1e-4) {
          for (let i = 0; i < M; i++) if ((mags[i][0] - x) ** 2 + (mags[i][1] - y) ** 2 < 0.04) return [i, s];
        }
      }
      let best = 0, bd = Infinity;
      for (let i = 0; i < M; i++) { const d = (mags[i][0] - x) ** 2 + (mags[i][1] - y) ** 2; if (d < bd) { bd = d; best = i; } }
      return [best, 3000];
    };
    const ps = thumbnail ? 4 : (P.res as number);
    const bw = Math.ceil(W / ps), bh = Math.ceil(H / ps);
    const basin = document.createElement('canvas');
    basin.width = bw; basin.height = bh;
    const bctx = basin.getContext('2d')!;
    bctx.fillStyle = '#05060b'; bctx.fillRect(0, 0, bw, bh);
    const rowImg = bctx.createImageData(bw, 1);
    const rgb = hues.map((h) => {
      const l = 0.55, A = 0.65 * Math.min(l, 1 - l), kk = (m: number) => (m + h / 30) % 12;
      const f = (m: number) => l - A * Math.max(-1, Math.min(kk(m) - 3, 9 - kk(m), 1));
      return [f(0) * 255, f(8) * 255, f(4) * 255];
    });
    let row = 0;
    const order: number[] = [];
    for (let step = 16; step >= 1; step = step >> 1) for (let r = 0; r < bh; r += step) if (!order.includes(r)) order.push(r);
    const renderRow = (r: number) => {
      const d = rowImg.data;
      for (let c = 0; c < bw; c++) {
        const [x, y] = toW((c + 0.5) * ps, (r + 0.5) * ps);
        const [m, s] = settle(x, y);
        const sh = P.shade ? Math.max(0.25, 1 - s / 900) : 1;
        d[c * 4] = rgb[m][0] * sh; d[c * 4 + 1] = rgb[m][1] * sh; d[c * 4 + 2] = rgb[m][2] * sh; d[c * 4 + 3] = 255;
      }
      bctx.putImageData(rowImg, 0, r);
    };
    let bob: { x: number; y: number; vx: number; vy: number; path: number[] } | null = null;
    const step = () => {
      const t0 = performance.now();
      while (row < order.length && performance.now() - t0 < (thumbnail ? 1000 : 10)) renderRow(order[row++]);
      if (bob) for (let s = 0; s < 4; s++) {
        accel(bob.x, bob.y, bob.vx, bob.vy, a);
        bob.vx += a[0] * dt; bob.vy += a[1] * dt; bob.x += bob.vx * dt; bob.y += bob.vy * dt;
        bob.path.push(bob.x, bob.y);
        if (bob.path.length > 4000) bob.path.splice(0, 2);
      }
    };
    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(basin, 0, 0, bw * ps, bh * ps);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, W, H);
      mags.forEach(([x, y], i) => {
        const [sx, sy] = toS(x, y);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(${hues[i]},80%,55%)`; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, TAU); ctx.fill();
      });
      if (bob) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < bob.path.length; i += 2) { const [sx, sy] = toS(bob.path[i], bob.path[i + 1]); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
        ctx.stroke();
        const [bx, by] = toS(bob.x, bob.y);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU); ctx.fill();
      }
    };
    return {
      step, draw,
      pointer(p) { if (p.type === 'down') { const [x, y] = toW(p.x, p.y); bob = { x, y, vx: 0, vy: 0, path: [] }; } },
      stats: () => [['Basin rendered', `${Math.round((row / order.length) * 100)}%`]],
    };
  },
};
