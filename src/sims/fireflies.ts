import type { SimDef } from '../core/types';
import { History, SpatialGrid, TAU, gauss, rand } from '../core/util';

export const fireflies: SimDef = {
  id: 'fireflies',
  title: 'Synchronizing Fireflies',
  tagline: 'Kuramoto oscillators: blinking fireflies nudge their neighbours until the whole forest flashes in unison.',
  category: 'Swarms & Life',
  accent: '#bef264',
  controls: 'Click to make nearby fireflies flash · watch the sync meter',
  thumbSteps: 500,
  params: [
    { key: 'count', label: 'Fireflies', min: 50, max: 3000, step: 50, default: 900, reset: true },
    { key: 'K', label: 'Coupling K', min: 0, max: 5, step: 0.05, default: 1.2 },
    { key: 'radius', label: 'Sight radius', min: 10, max: 400, step: 5, default: 90 },
    { type: 'toggle', key: 'global', label: 'Everyone sees everyone', default: false },
    { key: 'freq', label: 'Flash rate (Hz)', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'spread', label: 'Frequency spread', min: 0, max: 0.5, step: 0.01, default: 0.08, reset: true },
    { key: 'move', label: 'Wandering', min: 0, max: 2, step: 0.05, default: 0.4 },
    { key: 'glow', label: 'Glow size', min: 2, max: 20, step: 0.5, default: 8 },
  ],
  presets: [
    { name: 'Gradual sync', values: {} },
    { name: 'No coupling', values: { K: 0 } },
    { name: 'Strong & fast', values: { K: 4, radius: 150 } },
    { name: 'Travelling waves', values: { K: 2, radius: 35, move: 0.05, count: 2000 } },
    { name: 'Too diverse', values: { spread: 0.45, K: 0.6 } },
    { name: 'Mean field', values: { global: true, K: 0.8 } },
  ],
  about: `<p>Each firefly is a phase oscillator θ that ticks at its own natural frequency ω and flashes when θ wraps around. It also nudges its phase toward neighbours it can see — the <b>Kuramoto model</b>:</p>
<div class="eq">dθ_i/dt = ω_i + (K/n) Σ_j sin(θ_j − θ_i)</div>
<p>Below a critical coupling the swarm stays incoherent; above it, a synchronised cluster forms and recruits the rest — a phase transition. The meter shows the <b>order parameter</b> r = |⟨e^{iθ}⟩| (0 = chaos, 1 = perfect sync). With short sight radius you get spiral and travelling waves, like the real synchronous fireflies of the Great Smoky Mountains.</p>`,
  create({ ctx, width: W, height: H, params: P }) {
    const N = P.count as number;
    const x = new Float32Array(N), y = new Float32Array(N), hd = new Float32Array(N), th = new Float32Array(N), om = new Float32Array(N), flash = new Float32Array(N);
    for (let i = 0; i < N; i++) { x[i] = rand(W); y[i] = rand(H); hd[i] = rand(TAU); th[i] = rand(TAU); om[i] = 1 + gauss() * P.spread; }
    const grid = new SpatialGrid(W, H, P.radius);
    const dth = new Float32Array(N);
    const hist = new History(['sync r'], ['#bef264'], 300);
    let r = 0;
    const dt = 1 / 60;

    const step = () => {
      const R = P.radius as number, K = P.K as number;
      let cr = 0, ci = 0;
      for (let i = 0; i < N; i++) { cr += Math.cos(th[i]); ci += Math.sin(th[i]); }
      r = Math.hypot(cr, ci) / N;
      const psi = Math.atan2(ci, cr);
      if (P.global) {
        for (let i = 0; i < N; i++) dth[i] = K * r * Math.sin(psi - th[i]);
      } else {
        if (grid.cell !== R) grid.resize(W, H, R);
        grid.build(x, y, N);
        for (let i = 0; i < N; i++) {
          let s = 0, n = 0;
          grid.query(x[i], y[i], R, (j) => {
            const dx = x[j] - x[i], dy = y[j] - y[i];
            if (dx * dx + dy * dy < R * R && j !== i) { s += Math.sin(th[j] - th[i]); n++; }
          });
          dth[i] = n ? (K * s) / n : 0;
        }
      }
      const w0 = TAU * P.freq;
      for (let i = 0; i < N; i++) {
        const before = th[i];
        th[i] += (w0 * om[i] + dth[i] * w0 * 0.5) * dt;
        if (th[i] >= TAU) { th[i] -= TAU; flash[i] = 1; }
        else if (th[i] < 0) th[i] += TAU;
        if (before > th[i] && flash[i] !== 1) flash[i] = 1;
        flash[i] *= 0.88;
        hd[i] += (Math.random() - 0.5) * 0.4;
        x[i] += Math.cos(hd[i]) * P.move; y[i] += Math.sin(hd[i]) * P.move;
        if (x[i] < 0) x[i] += W; if (x[i] >= W) x[i] -= W;
        if (y[i] < 0) y[i] += H; if (y[i] >= H) y[i] -= H;
      }
      hist.push(r * 100);
    };

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#020617'); sky.addColorStop(1, '#03140c');
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sc = sprite.getContext('2d')!;
    const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.15, 'rgba(220,255,120,0.8)'); g.addColorStop(1, 'rgba(120,255,60,0)');
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);

    const draw = () => {
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const gs = P.glow as number;
      for (let i = 0; i < N; i++) {
        const f = flash[i];
        ctx.fillStyle = 'rgba(190,242,100,0.25)';
        ctx.fillRect(x[i] - 0.75, y[i] - 0.75, 1.5, 1.5);
        if (f < 0.03) continue;
        ctx.globalAlpha = f;
        const s = gs * (1 + f);
        ctx.drawImage(sprite, x[i] - s, y[i] - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      hist.draw(ctx, W - 230, H - 90, 218, 78, { yMax: 100, title: 'Sync %' });
    };

    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down') return;
        for (let i = 0; i < N; i++) if ((x[i] - p.x) ** 2 + (y[i] - p.y) ** 2 < 100 * 100) { th[i] = 0; flash[i] = 1; }
      },
      stats: () => [['Order parameter r', r], ['Fireflies', N]],
      actions: [{ label: 'Scramble phases', run: () => { for (let i = 0; i < N; i++) th[i] = rand(TAU); } }],
    };
  },
};
