import type { SimDef } from '../core/types';

export const pendulum: SimDef = {
  id: 'double-pendulum',
  title: 'Double Pendulum Chaos',
  tagline: 'Hundreds of double pendulums released a hair apart — watch the butterfly effect fan them out into a rainbow.',
  category: 'Chaos',
  accent: '#fb7185',
  controls: 'Click to release all pendulums pointing at the cursor',
  thumbSteps: 500,
  params: [
    { key: 'count', label: 'Pendulums', min: 1, max: 1000, step: 1, default: 300, reset: true },
    { key: 'spread', label: 'Initial spread (log10 rad)', min: -12, max: -1, step: 0.5, default: -5, reset: true, fmt: (v) => `1e${v}` },
    { key: 'angle', label: 'Release angle', min: 10, max: 180, step: 1, default: 130, reset: true, fmt: (v) => `${v}°` },
    { type: 'group', label: 'Physics' },
    { key: 'g', label: 'Gravity', min: 1, max: 30, step: 0.1, default: 9.81 },
    { key: 'l1', label: 'Upper arm length', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'l2', label: 'Lower arm length', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'm1', label: 'Upper mass', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'm2', label: 'Lower mass', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'damping', label: 'Damping', min: 0, max: 0.5, step: 0.005, default: 0 },
    { key: 'dt', label: 'Time step', min: 0.001, max: 0.02, step: 0.001, default: 0.005 },
    { type: 'group', label: 'View' },
    { type: 'toggle', key: 'arms', label: 'Draw arms', default: true },
    { type: 'toggle', key: 'trails', label: 'Tip trails', default: true },
    { key: 'fadeT', label: 'Trail fade', min: 0.005, max: 0.3, step: 0.005, default: 0.04 },
  ],
  presets: [
    { name: 'Butterfly effect', values: {} },
    { name: 'Single', values: { count: 1, fadeT: 0.005 } },
    { name: 'Gentle (regular)', values: { angle: 30, spread: -2 } },
    { name: 'Upside down', values: { angle: 179, spread: -10 } },
    { name: 'Heavy tip', values: { m2: 4, m1: 0.5 } },
  ],
  about: `<p>A double pendulum has just two degrees of freedom, yet for large swings it is <b>chaotic</b>: nearby trajectories separate exponentially fast (positive Lyapunov exponent).</p>
<p>All pendulums start within a tiny angle of each other (1e-5 radians by default). For a while they move as one; then the difference is amplified until they're effectively independent — the fan of colours is the error growing. At small angles (try <b>Gentle</b>) the motion is quasi-periodic and they stay together. Equations of motion are integrated with RK4 from the Lagrangian.</p>`,
  create({ ctx, width: W, height: H, params: P }) {
    const N = P.count as number;
    const th1 = new Float64Array(N), th2 = new Float64Array(N), w1 = new Float64Array(N), w2 = new Float64Array(N);
    let t = 0;
    const release = (a1: number, a2: number) => {
      const eps = Math.pow(10, P.spread as number);
      for (let i = 0; i < N; i++) { th1[i] = a1; th2[i] = a2 + i * eps; w1[i] = 0; w2[i] = 0; }
      trailCtx.clearRect(0, 0, W, H);
      t = 0;
    };
    const trail = document.createElement('canvas');
    trail.width = W; trail.height = H;
    const trailCtx = trail.getContext('2d')!;
    const a0 = ((P.angle as number) * Math.PI) / 180;
    release(a0, a0);

    const deriv = (a1: number, a2: number, v1: number, v2: number, out: number[]) => {
      const g = P.g, m1 = P.m1, m2 = P.m2, l1 = P.l1, l2 = P.l2, d = a1 - a2;
      const den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
      const acc1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * m2 * (v2 * v2 * l2 + v1 * v1 * l1 * Math.cos(d))) / (l1 * den);
      const acc2 = (2 * Math.sin(d) * (v1 * v1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + v2 * v2 * l2 * m2 * Math.cos(d))) / (l2 * den);
      out[0] = v1; out[1] = v2; out[2] = acc1 - P.damping * v1; out[3] = acc2 - P.damping * v2;
    };
    const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0];
    const L = () => (Math.min(W, H) * 0.45) / (P.l1 + P.l2);
    const ox = W / 2, oy = H * 0.42;
    let prevTip: Float32Array | null = null;

    const tip = (i: number): [number, number, number, number] => {
      const s = L();
      const x1 = ox + Math.sin(th1[i]) * P.l1 * s, y1 = oy + Math.cos(th1[i]) * P.l1 * s;
      return [x1, y1, x1 + Math.sin(th2[i]) * P.l2 * s, y1 + Math.cos(th2[i]) * P.l2 * s];
    };

    const step = () => {
      const dt = P.dt as number;
      for (let sub = 0; sub < 4; sub++) {
        for (let i = 0; i < N; i++) {
          const a1 = th1[i], a2 = th2[i], v1 = w1[i], v2 = w2[i];
          deriv(a1, a2, v1, v2, k1);
          deriv(a1 + k1[0] * dt / 2, a2 + k1[1] * dt / 2, v1 + k1[2] * dt / 2, v2 + k1[3] * dt / 2, k2);
          deriv(a1 + k2[0] * dt / 2, a2 + k2[1] * dt / 2, v1 + k2[2] * dt / 2, v2 + k2[3] * dt / 2, k3);
          deriv(a1 + k3[0] * dt, a2 + k3[1] * dt, v1 + k3[2] * dt, v2 + k3[3] * dt, k4);
          th1[i] += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
          th2[i] += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          w1[i] += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
          w2[i] += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
        }
        t += dt;
      }
      if (P.trails) {
        trailCtx.fillStyle = `rgba(6,6,12,${P.fadeT})`;
        trailCtx.fillRect(0, 0, W, H);
        trailCtx.lineWidth = 1.2;
        if (!prevTip || prevTip.length !== N * 2) { prevTip = new Float32Array(N * 2); for (let i = 0; i < N; i++) { const p = tip(i); prevTip[i * 2] = p[2]; prevTip[i * 2 + 1] = p[3]; } }
        for (let i = 0; i < N; i++) {
          const p = tip(i);
          trailCtx.strokeStyle = `hsla(${(i / Math.max(1, N)) * 300},90%,60%,0.8)`;
          trailCtx.beginPath(); trailCtx.moveTo(prevTip[i * 2], prevTip[i * 2 + 1]); trailCtx.lineTo(p[2], p[3]); trailCtx.stroke();
          prevTip[i * 2] = p[2]; prevTip[i * 2 + 1] = p[3];
        }
      }
    };

    const draw = () => {
      ctx.fillStyle = '#06060c';
      ctx.fillRect(0, 0, W, H);
      if (P.trails) ctx.drawImage(trail, 0, 0, W, H);
      if (P.arms) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = N > 50 ? 1 : 2.5;
        const alpha = Math.max(0.06, Math.min(0.9, 6 / N));
        for (let i = 0; i < N; i++) {
          const [x1, y1, x2, y2] = tip(i);
          ctx.strokeStyle = `hsla(${(i / Math.max(1, N)) * 300},90%,60%,${alpha})`;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          if (N <= 20) {
            ctx.fillStyle = `hsl(${(i / Math.max(1, N)) * 300},90%,70%)`;
            ctx.beginPath(); ctx.arc(x1, y1, 4 + P.m1 * 2, 0, 6.2832); ctx.arc(x2, y2, 4 + P.m2 * 2, 0, 6.2832); ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath(); ctx.arc(ox, oy, 3, 0, 6.2832); ctx.fill();
    };

    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down') return;
        const a = Math.atan2(p.x - ox, p.y - oy);
        release(a, a);
        prevTip = null;
      },
      stats: () => {
        let sx = 0, sy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < N; i++) { const [, , x2, y2] = tip(i); sx += x2; sy += y2; sxx += x2 * x2; syy += y2 * y2; }
        const spread = Math.sqrt(Math.max(0, sxx / N - (sx / N) ** 2 + syy / N - (sy / N) ** 2));
        const g = P.g, m1 = P.m1, m2 = P.m2, l1 = P.l1, l2 = P.l2, a1 = th1[0], a2 = th2[0], v1 = w1[0], v2 = w2[0];
        const KE = 0.5 * (m1 + m2) * l1 * l1 * v1 * v1 + 0.5 * m2 * l2 * l2 * v2 * v2 + m2 * l1 * l2 * v1 * v2 * Math.cos(a1 - a2);
        const PE = -(m1 + m2) * g * l1 * Math.cos(a1) - m2 * g * l2 * Math.cos(a2);
        return [['Time', `${t.toFixed(1)} s`], ['Tip spread', `${spread.toFixed(1)} px`], ['Energy (#1)', KE + PE]];
      },
    };
  },
};
