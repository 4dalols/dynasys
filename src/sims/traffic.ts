import type { SimDef } from '../core/types';
import { TAU, rand, roundRect } from '../core/util';

export const traffic: SimDef = {
  id: 'traffic',
  title: 'Phantom Traffic Jams',
  tagline: 'Cars on a ring road with the Intelligent Driver Model: one tap of the brakes spawns a jam that travels backwards.',
  category: 'Societies',
  accent: '#fb923c',
  controls: 'Click a car (or anywhere) to make the nearest car brake hard',
  thumbSteps: 900,
  params: [
    { key: 'cars', label: 'Cars', min: 5, max: 120, step: 1, default: 45, reset: true },
    { key: 'v0', label: 'Desired speed (km/h)', min: 20, max: 140, step: 1, default: 90 },
    { key: 'T', label: 'Time headway (s)', min: 0.5, max: 3, step: 0.05, default: 1.5 },
    { key: 'a', label: 'Max acceleration', min: 0.2, max: 4, step: 0.05, default: 1 },
    { key: 'b', label: 'Comfortable braking', min: 0.5, max: 6, step: 0.1, default: 1.5 },
    { key: 's0', label: 'Minimum gap (m)', min: 1, max: 10, step: 0.5, default: 2 },
    { key: 'noise', label: 'Driver randomness', min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: 'L', label: 'Road length (m)', min: 300, max: 3000, step: 50, default: 1100, reset: true },
  ],
  presets: [
    { name: 'Stop-and-go', values: {} },
    { name: 'Free flow', values: { cars: 20 } },
    { name: 'Gridlock', values: { cars: 110, L: 1100 } },
    { name: 'Tailgaters', values: { T: 0.6, noise: 0.4 } },
    { name: 'Patient drivers', values: { T: 2.5, a: 2, noise: 0.05 } },
  ],
  about: `<p>Each car follows Treiber's <b>Intelligent Driver Model</b>: accelerate toward a desired speed v₀, but brake to keep a safe gap s* that grows with speed and closing rate.</p>
<div class="eq">dv/dt = a [1 − (v/v₀)⁴ − (s*/s)²],  s* = s₀ + vT + vΔv / 2√(ab)</div>
<p>Above a critical density the uniform flow is <b>unstable</b>: a small perturbation amplifies as it propagates upstream, producing a jam that moves backward against traffic with nobody at fault — exactly what Sugiyama et al. filmed with real drivers on a circular track in 2008. The right panel is a <b>space–time diagram</b>: each row is a moment, red stripes are jams sliding backward.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const n = P.cars as number, L = P.L as number;
    const pos = new Float64Array(n), vel = new Float64Array(n), brake = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i] = (i / n) * L + rand(-0.5, 0.5); vel[i] = 10; }
    const dt = 0.1;
    let t = 0;
    const st = document.createElement('canvas');
    const stW = thumbnail ? Math.round(W * 0.45) : Math.round(Math.min(W * 0.42, 520)), stH = thumbnail ? H : H - 40;
    st.width = stW; st.height = stH;
    const sctx = st.getContext('2d')!;
    sctx.fillStyle = '#0b0d14'; sctx.fillRect(0, 0, stW, stH);
    let row = 0;
    const color = (v: number, v0: number) => `hsl(${Math.max(0, Math.min(1, v / v0)) * 130},85%,55%)`;
    const step = () => {
      const v0 = (P.v0 as number) / 3.6, T = P.T as number, a = P.a as number, b = P.b as number, s0 = P.s0 as number;
      const acc = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        let gap = pos[j] - pos[i] - 4.5;
        if (gap <= -4.5 + 1e-9 || j === i) gap = L - 4.5;
        if (gap < 0) gap += L;
        const dv = vel[i] - vel[j];
        const sStar = s0 + Math.max(0, vel[i] * T + (vel[i] * dv) / (2 * Math.sqrt(a * b)));
        acc[i] = a * (1 - Math.pow(vel[i] / v0, 4) - (sStar / Math.max(gap, 0.1)) ** 2);
        acc[i] += (Math.random() - 0.5) * P.noise * 2;
        if (brake[i] > 0) { acc[i] = -6; brake[i] -= dt; }
      }
      for (let i = 0; i < n; i++) {
        vel[i] = Math.max(0, vel[i] + acc[i] * dt);
        pos[i] = (pos[i] + vel[i] * dt) % L;
      }
      t += dt;
      // space-time diagram: one row every 0.5s
      if (Math.round(t / dt) % 5 === 0) {
        if (row >= stH) { sctx.drawImage(st, 0, -1); row = stH - 1; }
        sctx.fillStyle = '#0b0d14'; sctx.fillRect(0, row, stW, 1);
        for (let i = 0; i < n; i++) { sctx.fillStyle = color(vel[i], v0); sctx.fillRect((pos[i] / L) * stW, row, 2, 1); }
        row++;
      }
    };
    const roadW = thumbnail ? W * 0.55 : W - stW - 40;
    const cx = roadW / 2 + 10, cy = H / 2, R = Math.min(roadW, H) * 0.38;
    const draw = () => {
      ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#1f2330'; ctx.lineWidth = 26;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const v0 = (P.v0 as number) / 3.6;
      const carLen = Math.max(3, (4.5 / L) * TAU * R);
      for (let i = 0; i < n; i++) {
        const th = (pos[i] / L) * TAU - Math.PI / 2;
        const x = cx + Math.cos(th) * R, y = cy + Math.sin(th) * R;
        ctx.save(); ctx.translate(x, y); ctx.rotate(th + Math.PI / 2);
        ctx.fillStyle = color(vel[i], v0);
        roundRect(ctx, -carLen / 2, -6, carLen, 12, 2); ctx.fill();
        if (brake[i] > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(-carLen / 2, -6, 2, 12); }
        ctx.restore();
      }
      let avg = 0; for (let i = 0; i < n; i++) avg += vel[i];
      avg /= n;
      ctx.fillStyle = '#e5e7eb'; ctx.font = '600 28px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${(avg * 3.6).toFixed(0)} km/h`, cx, cy + 4);
      ctx.font = '12px ui-sans-serif, system-ui'; ctx.fillStyle = '#8a93a8';
      ctx.fillText('average speed', cx, cy + 24);
      ctx.textAlign = 'left';
      const sx = W - stW - 14, sy = thumbnail ? 0 : 28;
      ctx.drawImage(st, sx, sy);
      if (!thumbnail) { ctx.fillStyle = '#8a93a8'; ctx.fillText('space →   (time ↓)', sx, sy - 8); }
    };
    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down') return;
        const th = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
        const s = (((th / TAU) % 1) + 1) % 1 * L;
        let best = 0, bd = Infinity;
        for (let i = 0; i < n; i++) { const d = Math.min(Math.abs(pos[i] - s), L - Math.abs(pos[i] - s)); if (d < bd) { bd = d; best = i; } }
        brake[best] = 2;
      },
      stats: () => {
        let avg = 0, stopped = 0; for (let i = 0; i < n; i++) { avg += vel[i]; if (vel[i] < 2) stopped++; }
        return [['Density', `${((n / L) * 1000).toFixed(1)} cars/km`], ['Avg speed', `${((avg / n) * 3.6).toFixed(1)} km/h`], ['Flow', `${((avg / n) * (n / L) * 3600).toFixed(0)} cars/h`], ['Nearly stopped', stopped]];
      },
      actions: [{ label: 'Random brake', run: () => { brake[(Math.random() * n) | 0] = 2; } }],
    };
  },
};
