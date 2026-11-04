import type { SimDef } from '../core/types';
import { PixelBuffer, TAU, rand, stampGrid } from '../core/util';

export const ants: SimDef = {
  id: 'ants',
  title: 'Ant Colony',
  tagline: 'Foragers lay pheromone trails that evaporate — the colony finds short paths through obstacles without a map.',
  category: 'Swarms & Life',
  accent: '#f97316',
  controls: 'Drag to paint with the selected tool',
  thumbSteps: 700,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'wall', options: [
      { value: 'wall', label: 'Draw walls' }, { value: 'food', label: 'Place food' }, { value: 'erase', label: 'Erase' }, { value: 'nest', label: 'Move nest' } ] },
    { type: 'select', key: 'layout', label: 'Terrain', default: 'rocks', reset: true, options: [
      { value: 'open', label: 'Open field' }, { value: 'rocks', label: 'Scattered rocks' }, { value: 'maze', label: 'Maze' }, { value: 'bridges', label: 'Two bridges' } ] },
    { key: 'count', label: 'Ants', min: 50, max: 6000, step: 50, default: 1500, reset: true },
    { type: 'group', label: 'Behaviour' },
    { key: 'speed', label: 'Walk speed', min: 0.3, max: 3, step: 0.05, default: 1.2 },
    { key: 'sensorAngle', label: 'Sensor angle', min: 5, max: 90, step: 1, default: 35, fmt: (v) => `${v}°` },
    { key: 'sensorDist', label: 'Sensor distance', min: 2, max: 30, step: 1, default: 10 },
    { key: 'follow', label: 'Trail following', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'wander', label: 'Wander', min: 0, max: 1, step: 0.01, default: 0.25 },
    { type: 'group', label: 'Pheromones' },
    { key: 'deposit', label: 'Deposit', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'evap', label: 'Evaporation', min: 0, max: 0.05, step: 0.001, default: 0.008 },
    { type: 'toggle', key: 'showHome', label: 'Show home trail', default: true },
    { type: 'toggle', key: 'showFood', label: 'Show food trail', default: true },
  ],
  presets: [
    { name: 'Default', values: {} },
    { name: 'Maze runners', values: { layout: 'maze', count: 3000, evap: 0.004 } },
    { name: 'Bridge choice', values: { layout: 'bridges', count: 2000 } },
    { name: 'Forgetful', values: { evap: 0.03 } },
    { name: 'Highway', values: { follow: 1, wander: 0.08, evap: 0.003 } },
  ],
  about: `<p>Each ant is a tiny state machine: <b>searching</b> or <b>carrying food</b>. While searching it drops "home" pheromone and follows "food" pheromone; once it finds food it turns around, drops "food" pheromone and follows the "home" trail back.</p>
<p>Deposits fade the longer an ant has been away from its last landmark, and all trails <b>evaporate</b>. Shorter routes get reinforced faster, so the colony converges on efficient paths — the idea behind <b>ant colony optimisation</b>. Try the two-bridges terrain (after Deneubourg's double-bridge experiment) or block an established trail and watch the colony re-route.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : 4;
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const home = new Float32Array(G), foodT = new Float32Array(G), food = new Float32Array(G), wall = new Uint8Array(G);
    const nest = { x: W * 0.2, y: H * 0.5, r: 16 };
    const idx = (x: number, y: number) => ((y / cs) | 0) * gw + ((x / cs) | 0);
    const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const wallAt = (x: number, y: number) => !inb(x, y) || wall[idx(x, y)] === 1;
    const paint = (x: number, y: number, r: number, fn: (i: number) => void) => stampGrid(gw, gh, x / cs, y / cs, r / cs, (i) => fn(i));
    const addFood = (x: number, y: number, r = 22) => paint(x, y, r, (i) => { if (!wall[i]) food[i] = 30; });

    const layout = P.layout as string;
    if (layout === 'rocks') {
      for (let k = 0; k < 14; k++) {
        const rx = rand(W * 0.3, W * 0.85), ry = rand(H);
        paint(rx, ry, rand(15, 50), (i) => (wall[i] = 1));
      }
      addFood(W * 0.85, H * 0.25); addFood(W * 0.8, H * 0.8); addFood(W * 0.55, H * 0.12, 16);
    } else if (layout === 'maze') {
      const cols = 9, rows = 6, cw = W / cols, ch = H / rows;
      const thick = Math.max(cs, 6);
      for (let c = 1; c < cols; c++) for (let r = 0; r < rows; r++) if (Math.random() < 0.55) {
        for (let y = r * ch; y < (r + 1) * ch; y += cs / 2) paint(c * cw, y, thick, (i) => (wall[i] = 1));
      }
      for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < 0.45) {
        for (let x = c * cw; x < (c + 1) * cw; x += cs / 2) paint(x, r * ch, thick, (i) => (wall[i] = 1));
      }
      nest.x = cw * 0.5; nest.y = ch * 0.5;
      paint(nest.x, nest.y, 40, (i) => (wall[i] = 0));
      addFood(W - cw * 0.5, H - ch * 0.5, 26); addFood(W - cw * 0.5, ch * 0.5, 18);
    } else if (layout === 'bridges') {
      const x0 = W * 0.42, x1 = W * 0.58;
      for (let y = 0; y < H; y += cs) for (let x = x0; x < x1; x += cs) wall[idx(x, y)] = 1;
      // a short bridge and a long detour
      for (let y = H * 0.44; y < H * 0.5; y += cs) for (let x = x0; x < x1; x += cs) wall[idx(x, y)] = 0;
      for (let y = H * 0.06; y < H * 0.12; y += cs) for (let x = x0; x < x1; x += cs) wall[idx(x, y)] = 0;
      nest.x = W * 0.15; nest.y = H * 0.5;
      addFood(W * 0.85, H * 0.5, 26);
    } else {
      addFood(W * 0.8, H * 0.3); addFood(W * 0.75, H * 0.75);
    }
    paint(nest.x, nest.y, nest.r + 4, (i) => (wall[i] = 0));

    const N = P.count as number;
    const ax = new Float32Array(N), ay = new Float32Array(N), aa = new Float32Array(N), carry = new Uint8Array(N), timer = new Float32Array(N);
    for (let i = 0; i < N; i++) { ax[i] = nest.x; ay[i] = nest.y; aa[i] = rand(TAU); timer[i] = 0; }
    let delivered = 0;

    const sense = (field: Float32Array, x: number, y: number) => {
      if (!inb(x, y)) return -1;
      const i = idx(x, y);
      return wall[i] ? -1 : field[i];
    };

    const step = () => {
      const sa = ((P.sensorAngle as number) * Math.PI) / 180, sd = P.sensorDist as number, sp = P.speed as number;
      const follow = P.follow as number, wander = P.wander as number, dep = P.deposit as number;
      for (let i = 0; i < N; i++) {
        let a = aa[i];
        const x = ax[i], y = ay[i];
        const field = carry[i] ? home : foodT;
        // food smell: ants searching sense food directly when near
        const l = sense(field, x + Math.cos(a - sa) * sd, y + Math.sin(a - sa) * sd);
        const c = sense(field, x + Math.cos(a) * sd, y + Math.sin(a) * sd);
        const r = sense(field, x + Math.cos(a + sa) * sd, y + Math.sin(a + sa) * sd);
        if (Math.random() < follow) {
          if (c >= l && c >= r) {}
          else if (l > r) a -= sa * 0.5;
          else if (r > l) a += sa * 0.5;
        }
        if (!carry[i]) {
          const fl = sense(food, x + Math.cos(a - sa) * sd, y + Math.sin(a - sa) * sd);
          const fr = sense(food, x + Math.cos(a + sa) * sd, y + Math.sin(a + sa) * sd);
          if (fl > 0 && fl > fr) a -= sa * 0.5; else if (fr > 0) a += sa * 0.5;
        } else {
          const dx = nest.x - x, dy = nest.y - y, d = Math.hypot(dx, dy);
          if (d < 60) a = Math.atan2(dy, dx);
        }
        a += (Math.random() - 0.5) * wander;
        let nx = x + Math.cos(a) * sp, ny = y + Math.sin(a) * sp;
        if (wallAt(nx, ny)) {
          a += Math.PI * rand(0.6, 1.4);
          nx = x; ny = y;
        }
        ax[i] = nx; ay[i] = ny; aa[i] = a;
        timer[i] += 1;
        const gi = idx(nx, ny);
        const strength = dep * Math.exp(-timer[i] / 400);
        if (carry[i]) foodT[gi] = Math.min(10, foodT[gi] + strength);
        else home[gi] = Math.min(10, home[gi] + strength);
        if (!carry[i] && food[gi] > 0) {
          food[gi] -= 1; carry[i] = 1; timer[i] = 0; aa[i] += Math.PI;
        } else if (carry[i] && (nx - nest.x) ** 2 + (ny - nest.y) ** 2 < nest.r * nest.r) {
          carry[i] = 0; timer[i] = 0; delivered++; aa[i] += Math.PI;
        } else if (!carry[i] && (nx - nest.x) ** 2 + (ny - nest.y) ** 2 < nest.r * nest.r) timer[i] = 0;
      }
      const k = 1 - (P.evap as number);
      for (let i = 0; i < G; i++) { home[i] *= k; foodT[i] *= k; }
    };

    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data, sh = P.showHome, sf = P.showFood;
      for (let i = 0; i < G; i++) {
        const o = i * 4;
        if (wall[i]) { d[o] = 74; d[o + 1] = 64; d[o + 2] = 58; continue; }
        if (food[i] > 0) { const f = Math.min(1, food[i] / 30); d[o] = 120 + 130 * f; d[o + 1] = 200 * f + 40; d[o + 2] = 40; continue; }
        const hm = sh ? Math.min(1, home[i] * 0.4) : 0, fd = sf ? Math.min(1, foodT[i] * 0.4) : 0;
        d[o] = 18 + fd * 230 + hm * 30;
        d[o + 1] = 14 + fd * 90 + hm * 120;
        d[o + 2] = 12 + hm * 235 + fd * 20;
      }
      buf.blit(ctx, gw * cs, gh * cs);
      // nest
      const g = ctx.createRadialGradient(nest.x, nest.y, 0, nest.x, nest.y, nest.r * 1.6);
      g.addColorStop(0, '#7c2d12'); g.addColorStop(1, 'rgba(124,45,18,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(nest.x, nest.y, nest.r * 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e5e7eb';
      for (let i = 0; i < N; i++) if (!carry[i]) ctx.fillRect(ax[i] - 1, ay[i] - 1, 2, 2);
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < N; i++) if (carry[i]) ctx.fillRect(ax[i] - 1.5, ay[i] - 1.5, 3, 3);
    };

    return {
      step, draw,
      pointer(p) {
        if (!p.down && p.type !== 'down') return;
        const t = P.tool;
        if (t === 'wall') paint(p.x, p.y, 10, (i) => { wall[i] = 1; food[i] = 0; });
        else if (t === 'erase') paint(p.x, p.y, 16, (i) => { wall[i] = 0; food[i] = 0; home[i] = 0; foodT[i] = 0; });
        else if (t === 'food') addFood(p.x, p.y, 14);
        else if (t === 'nest') { nest.x = p.x; nest.y = p.y; paint(p.x, p.y, nest.r + 4, (i) => (wall[i] = 0)); }
      },
      stats: () => {
        let left = 0, c = 0;
        for (let i = 0; i < G; i++) left += food[i];
        for (let i = 0; i < N; i++) c += carry[i];
        return [['Ants', N], ['Carrying food', c], ['Food delivered', delivered], ['Food remaining', Math.round(left)]];
      },
      actions: [
        { label: 'Clear trails', run: () => { home.fill(0); foodT.fill(0); } },
        { label: 'Clear walls', run: () => wall.fill(0) },
        { label: 'Random food', run: () => addFood(rand(W), rand(H), rand(12, 26)) },
      ],
    };
  },
};
