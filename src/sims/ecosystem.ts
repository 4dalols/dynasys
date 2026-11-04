import type { SimDef } from '../core/types';
import { History, SpatialGrid, TAU, rand } from '../core/util';

export const ecosystem: SimDef = {
  id: 'ecosystem',
  title: 'Rabbits & Foxes',
  tagline: 'An agent-based predator–prey ecosystem on regrowing grass: boom, bust and Lotka–Volterra cycles.',
  category: 'Societies',
  accent: '#4ade80',
  controls: 'Click to drop the selected animal',
  thumbSteps: 600,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'rabbit', options: [{ value: 'rabbit', label: 'Add rabbits' }, { value: 'fox', label: 'Add foxes' }, { value: 'kill', label: 'Cull' }] },
    { key: 'rabbits0', label: 'Starting rabbits', min: 10, max: 2000, step: 10, default: 400, reset: true },
    { key: 'foxes0', label: 'Starting foxes', min: 0, max: 300, step: 1, default: 30, reset: true },
    { type: 'group', label: 'Grass' },
    { key: 'regrow', label: 'Regrowth rate', min: 0.0005, max: 0.03, step: 0.0005, default: 0.006 },
    { type: 'group', label: 'Rabbits' },
    { key: 'rSpeed', label: 'Speed', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'rBreed', label: 'Breed at energy', min: 2, max: 20, step: 0.5, default: 6 },
    { key: 'rFear', label: 'Fear radius', min: 0, max: 80, step: 1, default: 30 },
    { type: 'group', label: 'Foxes' },
    { key: 'fSpeed', label: 'Speed', min: 0.2, max: 3, step: 0.05, default: 1.35 },
    { key: 'fVision', label: 'Vision', min: 10, max: 200, step: 1, default: 70 },
    { key: 'fGain', label: 'Energy per rabbit', min: 1, max: 15, step: 0.5, default: 5 },
    { key: 'fBreed', label: 'Breed at energy', min: 5, max: 40, step: 0.5, default: 14 },
    { key: 'fBurn', label: 'Metabolism', min: 0.005, max: 0.1, step: 0.001, default: 0.03 },
  ],
  presets: [
    { name: 'Cycles', values: {} },
    { name: 'Overgrazing', values: { foxes0: 0, regrow: 0.002 } },
    { name: 'Lazy foxes', values: { fSpeed: 0.9, fVision: 40 } },
    { name: 'Apex crash', values: { fGain: 10, fBreed: 8, foxes0: 80 } },
    { name: 'Lush meadow', values: { regrow: 0.02, rabbits0: 100 } },
  ],
  about: `<p>Grass regrows on every patch. <b>Rabbits</b> wander, graze to gain energy, flee foxes they see, and split in two when well-fed. <b>Foxes</b> burn energy constantly, chase the nearest rabbit they can see and reproduce after enough meals. Anyone at zero energy dies.</p>
<p>The populations chase each other in delayed cycles, the agent-based cousin of the <b>Lotka–Volterra</b> equations <code>ẋ = αx − βxy, ẏ = δxy − γy</code>. Unlike the ODE, finite populations can go extinct — try to find settings where both species persist indefinitely.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = 8, gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const grass = new Float32Array(G);
    for (let i = 0; i < G; i++) grass[i] = rand(0.3, 1);
    type An = { x: number; y: number; a: number; e: number; alive: boolean };
    let rabbits: An[] = [], foxes: An[] = [];
    const mk = (x = rand(W), y = rand(H), e = rand(1, 4)): An => ({ x, y, a: rand(TAU), e, alive: true });
    for (let i = 0; i < P.rabbits0; i++) rabbits.push(mk());
    for (let i = 0; i < P.foxes0; i++) foxes.push(mk(rand(W), rand(H), rand(6, 10)));
    const hist = new History(['Rabbits', 'Foxes ×5'], ['#e5e7eb', '#fb923c'], 500);
    const grid = new SpatialGrid(W, H, 70);
    let rx = new Float32Array(0), ry = new Float32Array(0);
    let t = 0;
    const move = (an: An, sp: number) => {
      an.x += Math.cos(an.a) * sp; an.y += Math.sin(an.a) * sp;
      if (an.x < 0) an.x += W; if (an.x >= W) an.x -= W;
      if (an.y < 0) an.y += H; if (an.y >= H) an.y -= H;
    };
    const step = () => {
      t++;
      const rg = P.regrow as number;
      for (let i = 0; i < G; i++) grass[i] = Math.min(1, grass[i] + rg * (0.2 + grass[i]));
      if (rx.length < rabbits.length) { rx = new Float32Array(rabbits.length * 2); ry = new Float32Array(rabbits.length * 2); }
      rabbits.forEach((r, i) => { rx[i] = r.x; ry[i] = r.y; });
      if (grid.cell !== P.fVision) grid.resize(W, H, P.fVision);
      grid.build(rx, ry, rabbits.length);
      // foxes
      const fv = P.fVision as number;
      const babiesF: An[] = [];
      for (const f of foxes) {
        let best = -1, bd = fv * fv;
        grid.query(f.x, f.y, fv, (j) => {
          const r = rabbits[j]; if (!r.alive) return;
          const d2 = (r.x - f.x) ** 2 + (r.y - f.y) ** 2;
          if (d2 < bd) { bd = d2; best = j; }
        });
        if (best >= 0) {
          const r = rabbits[best];
          const want = Math.atan2(r.y - f.y, r.x - f.x);
          let da = want - f.a; da = Math.atan2(Math.sin(da), Math.cos(da));
          f.a += da * 0.3;
          if (bd < 36) { r.alive = false; f.e += P.fGain; }
        } else f.a += rand(-0.3, 0.3);
        move(f, P.fSpeed);
        f.e -= P.fBurn;
        if (f.e > P.fBreed) { f.e /= 2; babiesF.push({ ...f, a: rand(TAU) }); }
        if (f.e <= 0) f.alive = false;
      }
      foxes = foxes.filter((f) => f.alive).concat(babiesF);
      // rabbits
      const babiesR: An[] = [];
      const fear = P.rFear as number;
      for (const r of rabbits) {
        if (!r.alive) continue;
        let fled = false;
        if (fear > 0) for (const f of foxes) {
          const dx = r.x - f.x, dy = r.y - f.y;
          if (dx * dx + dy * dy < fear * fear) { r.a = Math.atan2(dy, dx) + rand(-0.4, 0.4); fled = true; break; }
        }
        if (!fled) r.a += rand(-0.5, 0.5);
        move(r, P.rSpeed * (fled ? 1.3 : 1));
        const gi = ((r.y / cs) | 0) * gw + ((r.x / cs) | 0);
        const bite = Math.min(grass[gi], 0.12);
        grass[gi] -= bite; r.e += bite * 2 - 0.035;
        if (r.e > P.rBreed) { r.e /= 2; babiesR.push({ ...r, a: rand(TAU) }); }
        if (r.e <= 0) r.alive = false;
      }
      rabbits = rabbits.filter((r) => r.alive).concat(babiesR);
      if (rabbits.length > 8000) rabbits.length = 8000;
      if (t % 4 === 0) hist.push(rabbits.length, foxes.length * 5);
    };
    const off = document.createElement('canvas');
    off.width = gw; off.height = gh;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(gw, gh);
    const draw = () => {
      const d = img.data;
      for (let i = 0; i < G; i++) { const v = grass[i]; d[i * 4] = 30 + v * 10; d[i * 4 + 1] = 22 + v * 80; d[i * 4 + 2] = 14 + v * 18; d[i * 4 + 3] = 255; }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, gw * cs, gh * cs);
      ctx.fillStyle = '#f1f5f9';
      for (const r of rabbits) ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3);
      ctx.fillStyle = '#fb923c';
      for (const f of foxes) {
        ctx.beginPath();
        const c = Math.cos(f.a), s = Math.sin(f.a);
        ctx.moveTo(f.x + c * 7, f.y + s * 7);
        ctx.lineTo(f.x - c * 4 - s * 4, f.y - s * 4 + c * 4);
        ctx.lineTo(f.x - c * 4 + s * 4, f.y - s * 4 - c * 4);
        ctx.fill();
      }
      if (!thumbnail) hist.draw(ctx, W - 300, H - 120, 288, 108, { title: 'Population' });
    };
    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down' && !(p.down && Math.random() < 0.3)) return;
        if (P.tool === 'rabbit') for (let k = 0; k < 10; k++) rabbits.push(mk(p.x + rand(-20, 20), p.y + rand(-20, 20)));
        else if (P.tool === 'fox') foxes.push(mk(p.x, p.y, 8));
        else { rabbits = rabbits.filter((r) => (r.x - p.x) ** 2 + (r.y - p.y) ** 2 > 2500); foxes = foxes.filter((r) => (r.x - p.x) ** 2 + (r.y - p.y) ** 2 > 2500); }
      },
      stats: () => {
        let gs = 0; for (let i = 0; i < G; i++) gs += grass[i];
        return [['Rabbits', rabbits.length], ['Foxes', foxes.length], ['Grass cover', `${((gs / G) * 100).toFixed(0)}%`], ['Time', t]];
      },
    };
  },
};
