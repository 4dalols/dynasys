import type { SimDef } from '../core/types';
import { PixelBuffer, TAU, stampGrid } from '../core/util';

export const ripple: SimDef = {
  id: 'ripple',
  title: 'Ripple Tank',
  tagline: 'The 2D wave equation: double slits, interference fringes, lenses and reflections you can draw yourself.',
  category: 'Waves & Fluids',
  accent: '#60a5fa',
  controls: 'Drag to use the selected tool',
  thumbSteps: 400,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'drop', options: [
      { value: 'drop', label: 'Splash' }, { value: 'source', label: 'Add oscillator' }, { value: 'wall', label: 'Draw wall' }, { value: 'erase', label: 'Erase' } ] },
    { type: 'select', key: 'layout', label: 'Setup', default: 'slit2', reset: true, options: [
      { value: 'slit2', label: 'Double slit' }, { value: 'slit1', label: 'Single slit' }, { value: 'two', label: 'Two sources' },
      { value: 'lens', label: 'Convex lens' }, { value: 'parabola', label: 'Parabolic mirror' }, { value: 'rain', label: 'Rain' }, { value: 'empty', label: 'Empty tank' } ] },
    { key: 'freq', label: 'Source frequency', min: 0.01, max: 0.2, step: 0.002, default: 0.06 },
    { key: 'c', label: 'Wave speed', min: 0.1, max: 0.5, step: 0.01, default: 0.45 },
    { key: 'damping', label: 'Damping', min: 0, max: 0.02, step: 0.0005, default: 0.001 },
    { key: 'res', label: 'Cell size (px)', min: 2, max: 6, step: 1, default: 3, reset: true },
    { type: 'select', key: 'view', label: 'Show', default: 'wave', options: [{ value: 'wave', label: 'Wave height' }, { value: 'intensity', label: 'Intensity (time-avg)' }] },
  ],
  presets: [
    { name: 'Double slit', values: { layout: 'slit2' } },
    { name: 'Interference fringes', values: { layout: 'slit2', view: 'intensity' } },
    { name: 'Two sources', values: { layout: 'two' } },
    { name: 'Lens focus', values: { layout: 'lens', freq: 0.08 } },
    { name: 'Parabolic mirror', values: { layout: 'parabola', freq: 0.08 } },
    { name: 'Rain', values: { layout: 'rain', damping: 0.004 } },
  ],
  about: `<p>A finite-difference solution of the <b>wave equation</b> on a grid, with absorbing edges so waves leave the tank cleanly:</p>
<div class="eq">∂²u/∂t² = c(x)² ∇²u − γ ∂u/∂t</div>
<p>Walls are fixed (u = 0) and reflect waves. In the lens setup, a region where waves travel slower bends wavefronts toward a focus — refraction. Switch <b>Show</b> to intensity to see the time-averaged u², which reveals the bright and dark fringes of Young's double-slit experiment.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.res as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    let u = new Float32Array(G), up = new Float32Array(G);
    const wall = new Uint8Array(G), speed = new Float32Array(G).fill(1), absorb = new Float32Array(G), inten = new Float32Array(G);
    const B = 24;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const d = Math.min(x, y, gw - 1 - x, gh - 1 - y);
      absorb[y * gw + x] = d < B ? ((B - d) / B) ** 2 * 0.15 : 0;
    }
    type Src = { x: number; y: number; phase: number };
    const sources: Src[] = [];
    const L = P.layout as string;
    const vwall = (gx: number, gaps: [number, number][]) => {
      for (let y = 0; y < gh; y++) {
        if (gaps.some(([a, b]) => y >= a && y < b)) continue;
        for (let t = 0; t < 2; t++) wall[y * gw + gx + t] = 1;
      }
    };
    const mid = gh / 2 | 0;
    if (L === 'slit2') {
      const sep = Math.round(gh * 0.08), w = Math.max(2, Math.round(gh * 0.02));
      vwall(gw * 0.35 | 0, [[mid - sep - w, mid - sep + w], [mid + sep - w, mid + sep + w]]);
      for (let y = B; y < gh - B; y += 2) sources.push({ x: B + 4, y, phase: 0 });
    } else if (L === 'slit1') {
      const w = Math.round(gh * 0.03);
      vwall(gw * 0.35 | 0, [[mid - w, mid + w]]);
      for (let y = B; y < gh - B; y += 2) sources.push({ x: B + 4, y, phase: 0 });
    } else if (L === 'two') {
      sources.push({ x: gw * 0.3, y: mid - gh * 0.08, phase: 0 }, { x: gw * 0.3, y: mid + gh * 0.08, phase: 0 });
    } else if (L === 'lens') {
      const cx = gw * 0.4, R = gh * 0.6, half = gh * 0.32;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const dy = y - mid;
        if (Math.abs(dy) > half) continue;
        const thick = Math.sqrt(R * R - dy * dy) - Math.sqrt(R * R - half * half);
        if (Math.abs(x - cx) < thick * 0.6) speed[y * gw + x] = 0.55;
      }
      for (let y = B; y < gh - B; y += 2) sources.push({ x: B + 4, y, phase: 0 });
    } else if (L === 'parabola') {
      const fx = gw * 0.55;
      for (let y = 0; y < gh; y++) {
        const dy = (y - mid) / (gh * 0.45);
        const x = Math.round(gw * 0.85 - dy * dy * gw * 0.18);
        if (Math.abs(y - mid) < gh * 0.42) for (let t = 0; t < 2; t++) wall[y * gw + x + t] = 1;
      }
      sources.push({ x: fx + gw * 0.08, y: mid, phase: 0 });
    }
    let t = 0;
    const step = () => {
      const c2 = (P.c as number) ** 2, damp = P.damping as number;
      for (const s of sources) {
        const i = (s.y | 0) * gw + (s.x | 0);
        u[i] = Math.sin(t * P.freq * TAU + s.phase) * 1.0;
      }
      if (L === 'rain' && Math.random() < 0.05) {
        const rx = Math.random() * gw, ry = Math.random() * gh;
        stampGrid(gw, gh, rx, ry, 2.5, (i, f) => (u[i] += f * 2));
      }
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = y * gw + x;
          if (wall[i]) { up[i] = 0; continue; }
          const lap = u[i - 1] + u[i + 1] + u[i - gw] + u[i + gw] - 4 * u[i];
          const sp = speed[i];
          const a = absorb[i] + damp;
          up[i] = (2 * u[i] - up[i] * (1 - a) + c2 * sp * sp * lap) / (1 + a);
        }
      }
      const tmp = u; u = up; up = tmp;
      for (let i = 0; i < G; i++) inten[i] = inten[i] * 0.985 + u[i] * u[i] * 0.015;
      t++;
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data, iv = P.view === 'intensity';
      for (let i = 0; i < G; i++) {
        const o = i * 4;
        if (wall[i]) { d[o] = 200; d[o + 1] = 205; d[o + 2] = 215; continue; }
        const lens = speed[i] < 1 ? 18 : 0;
        if (iv) {
          const v = Math.min(1, Math.sqrt(inten[i]) * 1.6);
          d[o] = 10 + v * 120 + lens; d[o + 1] = 14 + v * 200 + lens; d[o + 2] = 30 + v * 225;
        } else {
          const v = Math.max(-1, Math.min(1, u[i] * 1.4));
          if (v > 0) { d[o] = 8 + v * 150 + lens; d[o + 1] = 20 + v * 230 + lens; d[o + 2] = 45 + v * 210; }
          else { d[o] = 8 + lens; d[o + 1] = 20 + v * 15 + lens; d[o + 2] = 45 + v * 30 + lens; }
        }
      }
      buf.blit(ctx, gw * cs, gh * cs, true);
      ctx.fillStyle = '#fde047';
      if (sources.length < 20) for (const s of sources) { ctx.beginPath(); ctx.arc(s.x * cs, s.y * cs, 3, 0, TAU); ctx.fill(); }
    };
    return {
      step, draw,
      pointer(p) {
        const gx = p.x / cs, gy = p.y / cs;
        if (P.tool === 'drop' && p.down) stampGrid(gw, gh, gx, gy, 3, (i, f) => (u[i] += f * 1.5));
        else if (P.tool === 'source' && p.type === 'down') sources.push({ x: gx, y: gy, phase: 0 });
        else if (P.tool === 'wall' && p.down) stampGrid(gw, gh, gx, gy, 1.5, (i) => { wall[i] = 1; u[i] = 0; up[i] = 0; });
        else if (P.tool === 'erase' && p.down) {
          stampGrid(gw, gh, gx, gy, 6, (i) => { wall[i] = 0; speed[i] = 1; });
          for (let k = sources.length - 1; k >= 0; k--) if ((sources[k].x - gx) ** 2 + (sources[k].y - gy) ** 2 < 49) sources.splice(k, 1);
        }
      },
      stats: () => [['Grid', `${gw}×${gh}`], ['Sources', sources.length], ['Wavelength', `${((P.c as number) / (P.freq as number) * cs).toFixed(0)} px`]],
      actions: [
        { label: 'Calm water', run: () => { u.fill(0); up.fill(0); inten.fill(0); } },
        { label: 'Remove sources', run: () => (sources.length = 0) },
      ],
    };
  },
};
