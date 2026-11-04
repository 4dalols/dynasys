import type { SimDef } from '../core/types';
import { rand } from '../core/util';

type Attr = { name: string; p: number[]; f: (x: number, y: number, z: number, p: number[], o: number[]) => void; dt: number; scale: number; center: [number, number, number]; init: () => [number, number, number] };

const A: Record<string, Attr> = {
  lorenz: { name: 'Lorenz', p: [10, 28, 8 / 3], dt: 0.006, scale: 0.022, center: [0, 0, 25], init: () => [rand(-10, 10), rand(-10, 10), rand(10, 40)],
    f: (x, y, z, [s, r, b], o) => { o[0] = s * (y - x); o[1] = x * (r - z) - y; o[2] = x * y - b * z; } },
  rossler: { name: 'Rössler', p: [0.2, 0.2, 5.7], dt: 0.02, scale: 0.04, center: [0, 0, 5], init: () => [rand(-10, 10), rand(-10, 10), rand(0, 5)],
    f: (x, y, z, [a, b, c], o) => { o[0] = -y - z; o[1] = x + a * y; o[2] = b + z * (x - c); } },
  aizawa: { name: 'Aizawa', p: [0.95, 0.7, 0.6], dt: 0.01, scale: 0.38, center: [0, 0, 0.6], init: () => [rand(-1, 1), rand(-1, 1), rand(-1, 1)],
    f: (x, y, z, [a, b, c], o) => { const d = 3.5, e = 0.25, f = 0.1; o[0] = (z - b) * x - d * y; o[1] = d * x + (z - b) * y; o[2] = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x; } },
  thomas: { name: 'Thomas', p: [0.208186, 1, 1], dt: 0.05, scale: 0.17, center: [0, 0, 0], init: () => [rand(-3, 3), rand(-3, 3), rand(-3, 3)],
    f: (x, y, z, [b], o) => { o[0] = Math.sin(y) - b * x; o[1] = Math.sin(z) - b * y; o[2] = Math.sin(x) - b * z; } },
  halvorsen: { name: 'Halvorsen', p: [1.89, 1, 1], dt: 0.005, scale: 0.05, center: [-3, -3, -3], init: () => [rand(-5, 5), rand(-5, 5), rand(-5, 5)],
    f: (x, y, z, [a], o) => { o[0] = -a * x - 4 * y - 4 * z - y * y; o[1] = -a * y - 4 * z - 4 * x - z * z; o[2] = -a * z - 4 * x - 4 * y - x * x; } },
  dadras: { name: 'Dadras', p: [3, 2.7, 1.7], dt: 0.008, scale: 0.06, center: [0, 0, 0], init: () => [rand(-5, 5), rand(-5, 5), rand(-5, 5)],
    f: (x, y, z, [a, b, c], o) => { o[0] = y - a * x + b * y * z; o[1] = c * y - x * z + z; o[2] = 2 * x * y - 9 * z; } },
  chen: { name: 'Chen', p: [5, -10, -0.38], dt: 0.004, scale: 0.035, center: [0, 0, 10], init: () => [rand(-10, 10), rand(-10, 10), rand(0, 20)],
    f: (x, y, z, [a, b, c], o) => { o[0] = a * x - y * z; o[1] = b * y + x * z; o[2] = c * z + (x * y) / 3; } },
  sprott: { name: 'Sprott', p: [2.07, 1.79, 1], dt: 0.01, scale: 0.32, center: [0, 0.5, 0], init: () => [rand(-1, 1), rand(-1, 1), rand(-1, 1)],
    f: (x, y, z, [a, b], o) => { o[0] = y + a * x * y + x * z; o[1] = 1 - b * x * x + y * z; o[2] = x - x * x - y * y; } },
};

export const attractors: SimDef = {
  id: 'attractors',
  title: 'Strange Attractors',
  tagline: 'Thousands of particles streaming along Lorenz, Rössler, Aizawa, Thomas and other chaotic flows in 3D.',
  category: 'Chaos',
  accent: '#22d3ee',
  controls: 'Drag to rotate · scroll to zoom',
  thumbSteps: 260,
  params: [
    { type: 'select', key: 'system', label: 'System', default: 'lorenz', reset: true, options: Object.entries(A).map(([k, v]) => ({ value: k, label: v.name })) },
    { key: 'count', label: 'Particles', min: 100, max: 30000, step: 100, default: 8000, reset: true },
    { key: 'p0', label: 'Parameter a ×', min: 0.5, max: 1.5, step: 0.01, default: 1 },
    { key: 'p1', label: 'Parameter b ×', min: 0.5, max: 1.5, step: 0.01, default: 1 },
    { key: 'p2', label: 'Parameter c ×', min: 0.5, max: 1.5, step: 0.01, default: 1 },
    { key: 'flow', label: 'Flow speed', min: 0.1, max: 3, step: 0.05, default: 1 },
    { key: 'fadeT', label: 'Trail persistence', min: 0, max: 0.97, step: 0.01, default: 0.85 },
    { key: 'spin', label: 'Auto-rotate', min: 0, max: 2, step: 0.05, default: 0.4 },
    { type: 'select', key: 'color', label: 'Colour by', default: 'speed', options: [{ value: 'speed', label: 'Speed' }, { value: 'index', label: 'Particle' }, { value: 'depth', label: 'Depth' }] },
  ],
  presets: Object.entries(A).map(([k, v]) => ({ name: v.name, values: { system: k } })),
  about: `<p>Each system is three coupled ODEs. Trajectories never repeat and never cross, yet stay confined to a fractal set — a <b>strange attractor</b>. Edward Lorenz found the first one in 1963 in a toy model of convection; it gave us "the butterfly effect".</p>
<div class="eq">Lorenz: x' = σ(y − x), y' = x(ρ − z) − y, z' = xy − βz</div>
<p>The <b>Parameter ×</b> sliders scale each system's constants. Nudge Lorenz's ρ (b) below ~24.7 and the chaos collapses onto two fixed points; Rössler's c changes the period-doubling route to chaos.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const sys = A[P.system as string];
    const N = thumbnail ? 4000 : (P.count as number);
    const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N), sp = new Float32Array(N);
    for (let i = 0; i < N; i++) { const [a, b, c] = sys.init(); x[i] = a; y[i] = b; z[i] = c; }
    const o = [0, 0, 0], pp = [0, 0, 0];
    let yaw = 0.6, pitch = 0.25, zoom = 1;
    // warm up onto the attractor
    const adv = (dt: number) => {
      pp[0] = sys.p[0] * P.p0; pp[1] = sys.p[1] * P.p1; pp[2] = sys.p[2] * P.p2;
      for (let i = 0; i < N; i++) {
        // midpoint (RK2)
        sys.f(x[i], y[i], z[i], pp, o);
        const mx = x[i] + o[0] * dt * 0.5, my = y[i] + o[1] * dt * 0.5, mz = z[i] + o[2] * dt * 0.5;
        sys.f(mx, my, mz, pp, o);
        x[i] += o[0] * dt; y[i] += o[1] * dt; z[i] += o[2] * dt;
        sp[i] = Math.hypot(o[0], o[1], o[2]);
        if (!Number.isFinite(x[i] + y[i] + z[i]) || Math.abs(x[i]) > 1e4) { const [a, b, c] = sys.init(); x[i] = a; y[i] = b; z[i] = c; }
      }
    };
    for (let k = 0; k < 200; k++) adv(sys.dt);
    let maxSp = 1;
    for (let i = 0; i < N; i++) maxSp = Math.max(maxSp, sp[i]);
    let dragging = false;

    const step = () => {
      adv(sys.dt * P.flow);
      if (!dragging) yaw += 0.004 * P.spin;
    };
    const draw = () => {
      ctx.fillStyle = `rgba(3,5,10,${1 - P.fadeT})`;
      ctx.fillRect(0, 0, W, H);
      const S = Math.min(W, H) * sys.scale * zoom;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), spc = Math.sin(pitch);
      const [c0, c1, c2] = sys.center;
      ctx.globalCompositeOperation = 'lighter';
      const buckets = 10;
      const paths: Path2D[] = Array.from({ length: buckets }, () => new Path2D());
      for (let i = 0; i < N; i++) {
        const X = x[i] - c0, Y = y[i] - c1, Z = z[i] - c2;
        // rotate around vertical (z) axis then tilt
        const rx = X * cy - Y * sy, ry = X * sy + Y * cy;
        const py = Z * cp - ry * spc, depth = Z * spc + ry * cp;
        const sx = W / 2 + rx * S, syy = H / 2 - py * S;
        let b: number;
        if (P.color === 'speed') b = Math.min(buckets - 1, ((sp[i] / maxSp) * buckets * 1.2) | 0);
        else if (P.color === 'index') b = (i * buckets / N) | 0;
        else b = Math.max(0, Math.min(buckets - 1, ((depth * S) / (Math.min(W, H) * 0.4) * 0.5 + 0.5) * buckets | 0));
        paths[b].rect(sx, syy, 1.2, 1.2);
      }
      for (let b = 0; b < buckets; b++) {
        ctx.fillStyle = `hsla(${190 + b * 14},90%,${50 + b * 3}%,0.55)`;
        ctx.fill(paths[b]);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    return {
      step, draw,
      pointer(p) {
        dragging = p.down;
        if (p.down && p.type === 'move') { yaw += p.dx * 0.008; pitch = Math.max(-1.5, Math.min(1.5, pitch + p.dy * 0.008)); }
      },
      wheel(_x, _y, d) { zoom = Math.max(0.2, Math.min(6, zoom * Math.exp(-d * 0.001))); },
      stats: () => [['System', sys.name], ['a, b, c', (sys.p.map((v, k) => (v * [P.p0, P.p1, P.p2][k]).toFixed(3)).join(', '))], ['Particles', N]],
      actions: [{ label: 'Re-seed', run: () => { for (let i = 0; i < N; i++) { const [a, b, c] = sys.init(); x[i] = a; y[i] = b; z[i] = c; } } },
        { label: 'Seed one point', run: () => { const [a, b, c] = sys.init(); for (let i = 0; i < N; i++) { x[i] = a + rand(-1e-3, 1e-3); y[i] = b + rand(-1e-3, 1e-3); z[i] = c; } } }],
    };
  },
};
