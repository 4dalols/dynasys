import type { SimDef } from '../core/types';

export const cloth: SimDef = {
  id: 'cloth',
  title: 'Tearable Cloth',
  tagline: 'A Verlet mass–spring sheet: grab it, blow wind through it, and rip it apart when the stretch gets too much.',
  category: 'Cosmos & Mechanics',
  accent: '#c4b5fd',
  controls: 'Drag to pull the cloth · right-drag or shift-drag to cut',
  thumbSteps: 120,
  params: [
    { key: 'cols', label: 'Columns', min: 10, max: 120, step: 1, default: 60, reset: true },
    { key: 'rows', label: 'Rows', min: 10, max: 80, step: 1, default: 38, reset: true },
    { type: 'select', key: 'pin', label: 'Pinning', default: 'top', reset: true, options: [{ value: 'top', label: 'Whole top edge' }, { value: 'corners', label: 'Two corners' }, { value: 'every', label: 'Every 6th top point' }, { value: 'center', label: 'Centre point (tablecloth)' }] },
    { key: 'gravity', label: 'Gravity', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'wind', label: 'Wind', min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: 'stiff', label: 'Constraint iterations', min: 1, max: 20, step: 1, default: 6 },
    { key: 'tear', label: 'Tear threshold (× rest length)', min: 1.5, max: 10, step: 0.1, default: 4 },
    { key: 'damp', label: 'Air damping', min: 0.9, max: 1, step: 0.001, default: 0.99 },
    { type: 'select', key: 'color', label: 'Colour by', default: 'stretch', options: [{ value: 'stretch', label: 'Strain' }, { value: 'flag', label: 'Pattern' }, { value: 'mono', label: 'Plain' }] },
  ],
  presets: [
    { name: 'Curtain', values: {} },
    { name: 'Flag in a gale', values: { pin: 'every', wind: 0.8, color: 'flag' } },
    { name: 'Hammock', values: { pin: 'corners', gravity: 0.5 } },
    { name: 'Tablecloth', values: { pin: 'center', rows: 50, cols: 50 } },
    { name: 'Tissue paper', values: { tear: 1.7, stiff: 3 } },
    { name: 'Rubber sheet', values: { tear: 10, stiff: 2 } },
  ],
  about: `<p>The cloth is a grid of point masses joined by distance constraints, integrated with <b>Verlet integration</b> (position-based dynamics):</p>
<div class="eq">x_new = x + (x − x_prev)·damping + a·dt²</div>
<p>After each step, every link is nudged back toward its rest length; repeating this a few times per frame makes the sheet stiffer. A link that is stretched beyond the tear threshold snaps, and the cloth rips along stress concentrations. Wind is a turbulent force field acting on each triangle according to its orientation.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const C = P.cols as number, R = P.rows as number;
    const sp = Math.min((W * 0.8) / (C - 1), (H * 0.75) / (R - 1));
    const ox = (W - sp * (C - 1)) / 2, oy = H * 0.06;
    const N = C * R;
    const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N), pinned = new Uint8Array(N);
    const pinMode = P.pin as string;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c;
      if (pinMode === 'center') { x[i] = W / 2 + (c - (C - 1) / 2) * sp * 0.9; y[i] = H * 0.3 + (r - (R - 1) / 2) * sp * 0.3; }
      else { x[i] = ox + c * sp; y[i] = oy + r * sp; }
      px[i] = x[i]; py[i] = y[i];
      if (pinMode === 'top' && r === 0) pinned[i] = 1;
      if (pinMode === 'corners' && r === 0 && (c === 0 || c === C - 1)) pinned[i] = 1;
      if (pinMode === 'every' && r === 0 && c % 6 === 0) pinned[i] = 1;
    }
    if (pinMode === 'center') pinned[((R / 2) | 0) * C + ((C / 2) | 0)] = 1;
    const la: number[] = [], lb: number[] = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const i = r * C + c; if (c < C - 1) { la.push(i); lb.push(i + 1); } if (r < R - 1) { la.push(i); lb.push(i + C); } }
    const L = la.length;
    const A = Int32Array.from(la), B = Int32Array.from(lb), alive = new Uint8Array(L).fill(1), strain = new Float32Array(L);
    const rest = pinMode === 'center' ? sp * 0.9 : sp;
    let grab: { i: number; x: number; y: number } | null = null;
    let cut: { x: number; y: number } | null = null;
    let t = 0, torn = 0;
    const step = () => {
      t += 0.016;
      const g = P.gravity as number, wind = P.wind as number, damp = P.damp as number;
      for (let i = 0; i < N; i++) {
        if (pinned[i]) continue;
        const vx = (x[i] - px[i]) * damp, vy = (y[i] - py[i]) * damp;
        px[i] = x[i]; py[i] = y[i];
        const wv = wind * (0.6 + 0.4 * Math.sin(t * 1.7 + x[i] * 0.01 + y[i] * 0.013) + 0.3 * Math.sin(t * 5.1 + y[i] * 0.05));
        x[i] += vx + wv * 0.25; y[i] += vy + g * 0.5 + wv * 0.03 * Math.sin(t * 3 + x[i] * 0.02);
      }
      if (grab && !pinned[grab.i]) { x[grab.i] = grab.x; y[grab.i] = grab.y; }
      const its = P.stiff as number, tear = (P.tear as number) * rest;
      for (let k = 0; k < its; k++) {
        for (let l = 0; l < L; l++) {
          if (!alive[l]) continue;
          const a = A[l], b = B[l];
          const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          if (d > tear) { alive[l] = 0; torn++; continue; }
          strain[l] = d / rest;
          const diff = (d - rest) / d * 0.5;
          const ma = pinned[a] ? 0 : 1, mb = pinned[b] ? 0 : 1, s = ma + mb;
          if (!s) continue;
          x[a] += dx * diff * (2 * ma / s); y[a] += dy * diff * (2 * ma / s);
          x[b] -= dx * diff * (2 * mb / s); y[b] -= dy * diff * (2 * mb / s);
        }
        if (grab && !pinned[grab.i]) { x[grab.i] = grab.x; y[grab.i] = grab.y; }
      }
      for (let i = 0; i < N; i++) { if (y[i] > H - 2) { y[i] = H - 2; px[i] = x[i] - (x[i] - px[i]) * 0.5; } if (x[i] < 0) x[i] = 0; if (x[i] > W) x[i] = W; }
      if (cut) for (let l = 0; l < L; l++) {
        if (!alive[l]) continue;
        const mx = (x[A[l]] + x[B[l]]) / 2, my = (y[A[l]] + y[B[l]]) / 2;
        if ((mx - cut.x) ** 2 + (my - cut.y) ** 2 < 100) { alive[l] = 0; torn++; }
      }
    };
    const draw = () => {
      ctx.fillStyle = '#07080f'; ctx.fillRect(0, 0, W, H);
      const mode = P.color as string;
      ctx.lineWidth = thumbnail ? 1 : 1.2;
      if (mode === 'mono') {
        ctx.strokeStyle = '#c4b5fd'; ctx.beginPath();
        for (let l = 0; l < L; l++) if (alive[l]) { ctx.moveTo(x[A[l]], y[A[l]]); ctx.lineTo(x[B[l]], y[B[l]]); }
        ctx.stroke();
      } else {
        const buckets: Path2D[] = Array.from({ length: 12 }, () => new Path2D());
        for (let l = 0; l < L; l++) {
          if (!alive[l]) continue;
          let k: number;
          if (mode === 'stretch') k = Math.min(11, Math.max(0, ((strain[l] - 1) * 12) | 0));
          else { const a = A[l], r = (a / C) | 0, c = a % C; k = (((r / 4) | 0) + ((c / 4) | 0)) % 2 ? 2 : 8; }
          buckets[k].moveTo(x[A[l]], y[A[l]]); buckets[k].lineTo(x[B[l]], y[B[l]]);
        }
        buckets.forEach((p, k) => { ctx.strokeStyle = mode === 'stretch' ? `hsl(${260 - k * 22},80%,${62 + k * 2}%)` : k === 2 ? '#f43f5e' : '#f8fafc'; ctx.stroke(p); });
      }
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < N; i++) if (pinned[i]) ctx.fillRect(x[i] - 2, y[i] - 2, 4, 4);
    };
    return {
      step, draw,
      pointer(p) {
        const cutting = p.shift || p.button === 2;
        if (p.type === 'down' && !cutting) {
          let best = -1, bd = 40 * 40;
          for (let i = 0; i < N; i++) { const d = (x[i] - p.x) ** 2 + (y[i] - p.y) ** 2; if (d < bd) { bd = d; best = i; } }
          grab = best >= 0 ? { i: best, x: p.x, y: p.y } : null;
        }
        if (grab && p.down) { grab.x = p.x; grab.y = p.y; }
        cut = p.down && cutting ? { x: p.x, y: p.y } : null;
        if (p.type === 'up') { grab = null; cut = null; }
      },
      stats: () => [['Points', N], ['Links torn', torn]],
      actions: [{ label: 'Unpin all (drop it)', run: () => pinned.fill(0) }],
    };
  },
};
