import type { SimDef } from '../core/types';
import { PALETTES, PixelBuffer, TAU, makePalette, paletteOptions, rand, stampGrid } from '../core/util';

export const physarum: SimDef = {
  id: 'physarum',
  title: 'Slime Mold',
  tagline: 'Physarum polycephalum: thousands of agents following their own chemical trails weave transport networks.',
  category: 'Growth & Patterns',
  accent: '#facc15',
  controls: 'Drag to drop food (left) · shift-drag to erase',
  thumbSteps: 260,
  params: [
    { key: 'agents', label: 'Agents', min: 5000, max: 300000, step: 5000, default: 120000, reset: true },
    { type: 'select', key: 'spawn', label: 'Spawn', default: 'disc', reset: true, options: [
      { value: 'disc', label: 'Disc' }, { value: 'ring', label: 'Ring (inward)' }, { value: 'random', label: 'Everywhere' }, { value: 'points', label: 'Few points' } ] },
    { type: 'group', label: 'Sensing' },
    { key: 'sensorAngle', label: 'Sensor angle', min: 2, max: 90, step: 0.5, default: 22.5, fmt: (v) => `${v}°` },
    { key: 'sensorDist', label: 'Sensor distance', min: 1, max: 40, step: 0.5, default: 9 },
    { key: 'turn', label: 'Turn angle', min: 2, max: 90, step: 0.5, default: 45, fmt: (v) => `${v}°` },
    { key: 'speed', label: 'Step size', min: 0.2, max: 3, step: 0.05, default: 1 },
    { type: 'group', label: 'Chemistry' },
    { key: 'deposit', label: 'Deposit', min: 0.5, max: 20, step: 0.5, default: 5 },
    { key: 'decay', label: 'Decay', min: 0.01, max: 0.5, step: 0.005, default: 0.1 },
    { key: 'diffuse', label: 'Diffusion', min: 0, max: 1, step: 0.01, default: 0.5 },
    { type: 'select', key: 'palette', label: 'Palette', default: 'ember', options: paletteOptions },
  ],
  presets: [
    { name: 'Network', values: {} },
    { name: 'Cells', values: { sensorAngle: 45, sensorDist: 20, turn: 22.5, decay: 0.05, palette: 'aurora' } },
    { name: 'Worms', values: { sensorAngle: 11, sensorDist: 25, turn: 11, deposit: 3, palette: 'toxic' } },
    { name: 'Fine lace', values: { sensorAngle: 30, sensorDist: 4, turn: 30, decay: 0.2, palette: 'ocean' } },
    { name: 'Rings', values: { sensorAngle: 60, sensorDist: 15, turn: 80, spawn: 'ring', palette: 'viridis' } },
    { name: 'Explorers', values: { spawn: 'points', agents: 40000, sensorDist: 15, decay: 0.04 } },
  ],
  about: `<p>Jeff Jones' agent model of the slime mold <b>Physarum</b>. Each particle has three forward sensors; it turns toward whichever smells strongest, steps forward and deposits chemoattractant. The trail map then <b>diffuses</b> and <b>decays</b>.</p>
<p>That positive feedback loop collapses the cloud into veins that merge, compete and reorganise — the same mechanism that lets real Physarum solve mazes and famously reproduce the Tokyo rail network. Drop food points and watch it build a minimal network between them.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const scale = thumbnail ? 1 : 2;
    const gw = Math.ceil(W / scale), gh = Math.ceil(H / scale), G = gw * gh;
    let trail = new Float32Array(G), tmp = new Float32Array(G);
    const food = new Float32Array(G);
    const N = thumbnail ? 25000 : (P.agents as number);
    const x = new Float32Array(N), y = new Float32Array(N), a = new Float32Array(N);
    const cx = gw / 2, cy = gh / 2, R = Math.min(gw, gh) * 0.4;
    const pts = Array.from({ length: 6 }, () => [rand(gw), rand(gh)]);
    for (let i = 0; i < N; i++) {
      if (P.spawn === 'random') { x[i] = rand(gw); y[i] = rand(gh); a[i] = rand(TAU); }
      else if (P.spawn === 'ring') { const t = rand(TAU); x[i] = cx + Math.cos(t) * R; y[i] = cy + Math.sin(t) * R; a[i] = t + Math.PI; }
      else if (P.spawn === 'points') { const p = pts[i % pts.length]; x[i] = p[0]; y[i] = p[1]; a[i] = rand(TAU); }
      else { const t = rand(TAU), r = R * Math.sqrt(Math.random()); x[i] = cx + Math.cos(t) * r; y[i] = cy + Math.sin(t) * r; a[i] = rand(TAU); }
    }
    let lut = makePalette(PALETTES[P.palette]);
    const buf = new PixelBuffer(gw, gh);

    const step = () => {
      const sa = ((P.sensorAngle as number) * Math.PI) / 180, sd = P.sensorDist as number;
      const ra = ((P.turn as number) * Math.PI) / 180, sp = P.speed as number, dep = P.deposit as number;
      const t = trail;
      for (let i = 0; i < N; i++) {
        const xi = x[i], yi = y[i], ai = a[i];
        const sx = (q: number) => { let v = (xi + Math.cos(q) * sd) | 0; return v < 0 ? v + gw : v >= gw ? v - gw : v; };
        const sy = (q: number) => { let v = (yi + Math.sin(q) * sd) | 0; return v < 0 ? v + gh : v >= gh ? v - gh : v; };
        const f = t[sy(ai) * gw + sx(ai)];
        const fl = t[sy(ai - sa) * gw + sx(ai - sa)];
        const fr = t[sy(ai + sa) * gw + sx(ai + sa)];
        let na = ai;
        if (f > fl && f > fr) {}
        else if (f < fl && f < fr) na += (Math.random() < 0.5 ? -1 : 1) * ra;
        else if (fl < fr) na += ra;
        else if (fr < fl) na -= ra;
        let nx = xi + Math.cos(na) * sp, ny = yi + Math.sin(na) * sp;
        if (nx < 0) nx += gw; else if (nx >= gw) nx -= gw;
        if (ny < 0) ny += gh; else if (ny >= gh) ny -= gh;
        x[i] = nx; y[i] = ny; a[i] = na;
        t[(ny | 0) * gw + (nx | 0)] += dep;
      }
      // diffuse (3x3 box) + decay
      const k = 1 - (P.decay as number), df = P.diffuse as number;
      for (let yy = 0; yy < gh; yy++) {
        const ym = (yy === 0 ? gh - 1 : yy - 1) * gw, y0 = yy * gw, yp = (yy === gh - 1 ? 0 : yy + 1) * gw;
        for (let xx = 0; xx < gw; xx++) {
          const xm = xx === 0 ? gw - 1 : xx - 1, xp = xx === gw - 1 ? 0 : xx + 1;
          const s = t[ym + xm] + t[ym + xx] + t[ym + xp] + t[y0 + xm] + t[y0 + xx] + t[y0 + xp] + t[yp + xm] + t[yp + xx] + t[yp + xp];
          const v = t[y0 + xx] * (1 - df) + (s / 9) * df;
          tmp[y0 + xx] = v * k + food[y0 + xx];
        }
      }
      const sw = trail; trail = tmp; tmp = sw;
    };

    const draw = () => {
      buf.fromField(trail, lut, 1 / 30);
      buf.blit(ctx, gw * scale, gh * scale, true);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < G; i += 1) if (food[i] > 0 && i % 3 === 0) ctx.fillRect((i % gw) * scale, ((i / gw) | 0) * scale, scale, scale);
    };

    return {
      step, draw,
      paramChanged(k) { if (k === 'palette') lut = makePalette(PALETTES[P.palette]); },
      pointer(p) {
        if (!p.down) return;
        const erase = p.shift || p.button === 2;
        stampGrid(gw, gh, p.x / scale, p.y / scale, erase ? 14 : 4, (i) => {
          if (erase) { food[i] = 0; trail[i] = 0; } else food[i] = 3;
        });
      },
      stats: () => [['Agents', N], ['Grid', `${gw}×${gh}`]],
      actions: [
        { label: 'Clear food', run: () => food.fill(0) },
        { label: 'Random food', run: () => { for (let k = 0; k < 8; k++) stampGrid(gw, gh, rand(gw), rand(gh), 4, (i) => (food[i] = 3)); } },
        { label: 'Scramble', run: () => { for (let i = 0; i < N; i++) a[i] = rand(TAU); } },
      ],
    };
  },
};
