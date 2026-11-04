import type { SimDef } from '../core/types';
import { TAU } from '../core/util';

export const fluid: SimDef = {
  id: 'fluid',
  title: 'Smoke & Ink',
  tagline: 'Stable-fluids Navier–Stokes solver with vorticity confinement — swirl colored ink with your cursor.',
  category: 'Waves & Fluids',
  accent: '#c084fc',
  controls: 'Drag to push fluid and inject ink',
  thumbSteps: 220,
  params: [
    { key: 'res', label: 'Grid resolution', min: 64, max: 256, step: 16, default: 160, reset: true },
    { key: 'visc', label: 'Viscosity', min: 0, max: 0.001, step: 0.00001, default: 0.00002, fmt: (v) => v.toExponential(1) },
    { key: 'vort', label: 'Vorticity confinement', min: 0, max: 60, step: 1, default: 20 },
    { key: 'fadeInk', label: 'Ink dissipation', min: 0, max: 0.05, step: 0.001, default: 0.006 },
    { key: 'iters', label: 'Pressure iterations', min: 4, max: 60, step: 1, default: 20 },
    { key: 'brush', label: 'Brush size', min: 1, max: 12, step: 0.5, default: 4 },
    { type: 'toggle', key: 'jets', label: 'Auto jets', default: true },
    { type: 'toggle', key: 'buoy', label: 'Buoyancy (smoke rises)', default: false },
  ],
  presets: [
    { name: 'Ink jets', values: {} },
    { name: 'Smoke', values: { buoy: true, jets: true, vort: 35, fadeInk: 0.01 } },
    { name: 'Honey', values: { visc: 0.0005, vort: 0, fadeInk: 0.002 } },
    { name: 'Turbulent', values: { vort: 60, visc: 0, iters: 30 } },
  ],
  about: `<p>Jos Stam's <b>stable fluids</b> (1999): each step the velocity field is advected along itself (semi-Lagrangian back-tracing), diffused, and then <b>projected</b> to be divergence-free by solving a Poisson equation for pressure with Jacobi iterations. That projection is what makes the fluid incompressible and produces swirls.</p>
<div class="eq">∂u/∂t = −(u·∇)u − ∇p + ν∇²u + f,   ∇·u = 0</div>
<p>Numerical diffusion kills small eddies, so <b>vorticity confinement</b> adds back a force that spins up existing vortices. Ink is a passive dye carried along by the flow.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const NX = thumbnail ? 96 : (P.res as number);
    const NY = Math.max(16, Math.round((NX * H) / W));
    const sz = (NX + 2) * (NY + 2);
    const IX = (i: number, j: number) => i + (NX + 2) * j;
    let u = new Float32Array(sz), v = new Float32Array(sz), u0 = new Float32Array(sz), v0 = new Float32Array(sz);
    let r = new Float32Array(sz), g = new Float32Array(sz), b = new Float32Array(sz), tmp = new Float32Array(sz);
    const p = new Float32Array(sz), div = new Float32Array(sz), curl = new Float32Array(sz);
    const dt = 0.1;

    const bnd = (kind: number, x: Float32Array) => {
      for (let i = 1; i <= NX; i++) { x[IX(i, 0)] = kind === 2 ? -x[IX(i, 1)] : x[IX(i, 1)]; x[IX(i, NY + 1)] = kind === 2 ? -x[IX(i, NY)] : x[IX(i, NY)]; }
      for (let j = 1; j <= NY; j++) { x[IX(0, j)] = kind === 1 ? -x[IX(1, j)] : x[IX(1, j)]; x[IX(NX + 1, j)] = kind === 1 ? -x[IX(NX, j)] : x[IX(NX, j)]; }
    };
    const advect = (kind: number, d: Float32Array, d0: Float32Array, uu: Float32Array, vv: Float32Array, decay: number) => {
      const dx = dt * NX, dy = dt * NX;
      for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
        let x = i - dx * uu[IX(i, j)], y = j - dy * vv[IX(i, j)];
        x = Math.max(0.5, Math.min(NX + 0.5, x)); y = Math.max(0.5, Math.min(NY + 0.5, y));
        const i0 = x | 0, j0 = y | 0, s1 = x - i0, t1 = y - j0;
        d[IX(i, j)] = decay * ((1 - s1) * ((1 - t1) * d0[IX(i0, j0)] + t1 * d0[IX(i0, j0 + 1)]) + s1 * ((1 - t1) * d0[IX(i0 + 1, j0)] + t1 * d0[IX(i0 + 1, j0 + 1)]));
      }
      bnd(kind, d);
    };
    const diffuse = (kind: number, x: Float32Array, x0: Float32Array, k: number) => {
      const a = dt * k * NX * NY;
      if (a === 0) { x.set(x0); return; }
      for (let it = 0; it < 8; it++) {
        for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++)
          x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / (1 + 4 * a);
        bnd(kind, x);
      }
    };
    const project = () => {
      const h = 1 / NX;
      for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
        div[IX(i, j)] = -0.5 * h * (u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)]);
        p[IX(i, j)] = 0;
      }
      bnd(0, div); bnd(0, p);
      for (let it = 0; it < P.iters; it++) {
        for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++)
          p[IX(i, j)] = (div[IX(i, j)] + p[IX(i - 1, j)] + p[IX(i + 1, j)] + p[IX(i, j - 1)] + p[IX(i, j + 1)]) / 4;
        bnd(0, p);
      }
      for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++) {
        u[IX(i, j)] -= (0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)])) / h;
        v[IX(i, j)] -= (0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)])) / h;
      }
      bnd(1, u); bnd(2, v);
    };
    const vorticity = () => {
      const eps = (P.vort as number) * 0.0001;
      if (eps === 0) return;
      for (let j = 1; j <= NY; j++) for (let i = 1; i <= NX; i++)
        curl[IX(i, j)] = (v[IX(i + 1, j)] - v[IX(i - 1, j)] - u[IX(i, j + 1)] + u[IX(i, j - 1)]) * 0.5;
      for (let j = 2; j < NY; j++) for (let i = 2; i < NX; i++) {
        const nx = Math.abs(curl[IX(i + 1, j)]) - Math.abs(curl[IX(i - 1, j)]);
        const ny = Math.abs(curl[IX(i, j + 1)]) - Math.abs(curl[IX(i, j - 1)]);
        const len = Math.hypot(nx, ny) + 1e-6, c = curl[IX(i, j)];
        u[IX(i, j)] += (ny / len) * c * eps * NX * dt;
        v[IX(i, j)] -= (nx / len) * c * eps * NX * dt;
      }
    };
    const splat = (cx: number, cy: number, fx: number, fy: number, hue: number, rad: number) => {
      const col = hsv(hue);
      const R = rad;
      for (let j = Math.max(1, (cy - R * 2) | 0); j <= Math.min(NY, (cy + R * 2) | 0); j++)
        for (let i = Math.max(1, (cx - R * 2) | 0); i <= Math.min(NX, (cx + R * 2) | 0); i++) {
          const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (R * R));
          const k = IX(i, j);
          u[k] += fx * w; v[k] += fy * w;
          r[k] += col[0] * w * 0.8; g[k] += col[1] * w * 0.8; b[k] += col[2] * w * 0.8;
        }
    };
    let t = 0;
    let hue = 0;
    const step = () => {
      t++;
      if (P.jets) {
        const a = t * 0.01;
        splat(NX * 0.2, NY * 0.5 + Math.sin(a * 1.3) * NY * 0.2, 0.012 + Math.cos(a) * 0.004, Math.sin(a * 2) * 0.006, (t * 0.4) % 360, 3);
        splat(NX * 0.8, NY * 0.5 + Math.cos(a * 1.1) * NY * 0.2, -0.012 + Math.sin(a) * 0.004, Math.cos(a * 1.7) * 0.006, (t * 0.4 + 180) % 360, 3);
      }
      if (P.buoy) for (let k = 0; k < sz; k++) v[k] -= (r[k] + g[k] + b[k]) * 0.0004;
      vorticity();
      u0.set(u); v0.set(v);
      diffuse(1, u, u0, P.visc); diffuse(2, v, v0, P.visc);
      project();
      u0.set(u); v0.set(v);
      advect(1, u, u0, u0, v0, 1); advect(2, v, v0, u0, v0, 1);
      project();
      const keep = 1 - (P.fadeInk as number);
      tmp.set(r); advect(0, r, tmp, u, v, keep);
      tmp.set(g); advect(0, g, tmp, u, v, keep);
      tmp.set(b); advect(0, b, tmp, u, v, keep);
    };
    const off = document.createElement('canvas');
    off.width = NX; off.height = NY;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(NX, NY);
    const draw = () => {
      const d = img.data;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = IX(i + 1, j + 1), o = (j * NX + i) * 4;
        const R = r[k], G2 = g[k], B2 = b[k];
        // soft tone-map
        d[o] = 255 * (1 - Math.exp(-R * 1.4)) + 4; d[o + 1] = 255 * (1 - Math.exp(-G2 * 1.4)) + 5; d[o + 2] = 255 * (1 - Math.exp(-B2 * 1.4)) + 10; d[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, W, H);
    };
    return {
      step, draw,
      pointer(pp) {
        if (!pp.down) return;
        hue = (hue + 2) % 360;
        const gx = (pp.x / W) * NX, gy = (pp.y / H) * NY;
        splat(gx, gy, (pp.dx / W) * 0.6, (pp.dy / H) * 0.6 * (NY / NX) * (W / H), hue, P.brush);
      },
      stats: () => [['Grid', `${NX}×${NY}`]],
      actions: [
        { label: 'Clear ink', run: () => { r.fill(0); g.fill(0); b.fill(0); } },
        { label: 'Still the water', run: () => { u.fill(0); v.fill(0); } },
        { label: 'Big bang', run: () => { for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; splat(NX / 2, NY / 2, Math.cos(a) * 0.05, Math.sin(a) * 0.05, k * 30, 4); } } },
      ],
    };
  },
};

function hsv(h: number): [number, number, number] {
  const f = (n: number) => { const k = (n + h / 60) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
