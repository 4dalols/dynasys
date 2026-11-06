import type { SimDef } from '../core/types';
import { History, PixelBuffer, SpatialGrid, TAU, hexToRgb, rand, stampGrid } from '../core/util';

const COLORS = ['#f87171', '#60a5fa', '#4ade80', '#facc15'];
const NAMES = ['Red', 'Blue', 'Green', 'Gold'];
const PAIRS: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const noPacts = { a01: false, a02: false, a03: false, a12: false, a13: false, a23: false };

export const antwars: SimDef = {
  id: 'antwars',
  title: 'Ant Wars',
  tagline: 'Rival colonies forage, breed soldiers, raid each other’s nests and sign pacts — food turns into armies, and corpses into food.',
  category: 'Swarms & Life',
  accent: '#ef4444',
  controls: 'Drag to paint with the selected tool',
  thumbSteps: 900,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'food', options: [
      { value: 'food', label: 'Drop food' }, { value: 'wall', label: 'Draw walls' }, { value: 'erase', label: 'Erase' }] },
    { key: 'colonies', label: 'Colonies', min: 2, max: 4, step: 1, default: 4, reset: true },
    { type: 'select', key: 'layout', label: 'Terrain', default: 'rocks', reset: true, options: [
      { value: 'open', label: 'Open field' }, { value: 'rocks', label: 'Scattered rocks' }, { value: 'arena', label: 'Central feast' }, { value: 'walls', label: 'Walled kingdoms' }] },
    { key: 'start', label: 'Starting ants / colony', min: 20, max: 1500, step: 10, default: 350, reset: true },
    { key: 'cap', label: 'Max ants / colony', min: 100, max: 3000, step: 50, default: 1200, reset: true },
    { type: 'group', label: 'Behaviour' },
    { key: 'soldiers', label: 'Soldier share of births', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'aggression', label: 'Soldier aggression', min: 0, max: 1, step: 0.01, default: 0.6, hint: 'How strongly soldiers follow enemy trails toward their nests' },
    { key: 'attack', label: 'Bite strength', min: 0.1, max: 3, step: 0.05, default: 1 },
    { key: 'speed', label: 'Walk speed', min: 0.3, max: 2.5, step: 0.05, default: 1.1 },
    { type: 'group', label: 'Economy' },
    { key: 'cost', label: 'Food per new ant', min: 1, max: 20, step: 0.5, default: 3 },
    { key: 'regrow', label: 'Food regrowth', min: 0, max: 1, step: 0.01, default: 0.35 },
    { key: 'life', label: 'Lifespan (steps)', min: 1000, max: 20000, step: 250, default: 6000 },
    { key: 'evap', label: 'Pheromone evaporation', min: 0.001, max: 0.04, step: 0.001, default: 0.007 },
    { type: 'group', label: 'Alliances' },
    ...PAIRS.map(([a, b]) => ({ type: 'toggle' as const, key: `a${a}${b}`, label: `${NAMES[a]} & ${NAMES[b]} allied`, default: false })),
    { type: 'toggle', key: 'trails', label: 'Show territory trails', default: true },
  ],
  presets: [
    { name: 'Four-way war', values: {} },
    { name: 'Two blocs (Red+Blue vs Green+Gold)', values: { a01: true, a23: true } },
    { name: 'Three gang up on Gold', values: { a01: true, a02: true, a12: true } },
    { name: 'Duel', values: { colonies: 2, start: 600, cap: 2500 } },
    { name: 'Total war', values: { soldiers: 0.6, aggression: 1, attack: 2, cost: 2 } },
    { name: 'Peaceful foragers', values: { ...noPacts, soldiers: 0, aggression: 0, attack: 0.1 } },
    { name: 'Walled kingdoms', values: { layout: 'walls', soldiers: 0.35 } },
  ],
  about: `<p>Every colony runs the same rules as the single <b>Ant Colony</b> sim — workers lay a "home" trail while searching and a "food" trail while carrying — but now there are rivals. Food delivered to a nest is spent on new ants; a share of births become <b>soldiers</b>, which follow <em>enemy</em> home trails straight to their nests, bite anything hostile they meet and steal from enemy stores.</p>
<p>Dead ants become food, so battles feed whoever holds the field. Ants also age and die, so a colony that stops foraging starves. Toggle the <b>alliances</b> while it runs: allied ants ignore each other, and a pact between two colonies usually spells doom for the others — until you break it.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : 4;
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const K = P.colonies as number;
    const home: Float32Array[] = [], ftrail: Float32Array[] = [];
    for (let c = 0; c < K; c++) { home.push(new Float32Array(G)); ftrail.push(new Float32Array(G)); }
    const food = new Float32Array(G), wall = new Uint8Array(G);
    const rgb = COLORS.map(hexToRgb);
    const idx = (x: number, y: number) => ((y / cs) | 0) * gw + ((x / cs) | 0);
    const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const wallAt = (x: number, y: number) => !inb(x, y) || wall[idx(x, y)] === 1;
    const paint = (x: number, y: number, r: number, fn: (i: number) => void) => stampGrid(gw, gh, x / cs, y / cs, r / cs, (i) => fn(i));
    const addFood = (x: number, y: number, r = 20, amt = 25) => paint(x, y, r, (i) => { if (!wall[i]) food[i] = Math.min(60, food[i] + amt); });

    const spots: [number, number][] = K === 2 ? [[0.12, 0.5], [0.88, 0.5]]
      : K === 3 ? [[0.12, 0.2], [0.88, 0.2], [0.5, 0.88]]
      : [[0.1, 0.18], [0.1, 0.82], [0.9, 0.18], [0.9, 0.82]];
    const nests = spots.map(([fx, fy]) => ({ x: fx * W, y: fy * H, r: 15, store: 0, kills: 0, lost: 0, born: 0 }));

    const layout = P.layout as string;
    if (layout === 'rocks') {
      for (let k = 0; k < 16; k++) paint(rand(W * 0.2, W * 0.8), rand(H), rand(12, 40), (i) => (wall[i] = 1));
    } else if (layout === 'walls') {
      const t = Math.max(cs, 6);
      for (const n of nests) {
        const R = Math.min(W, H) * 0.2;
        for (let a = 0; a < TAU; a += 0.01) {
          const gap = Math.sin(a * 3 + n.x) > 0.75;
          if (!gap) paint(n.x + Math.cos(a) * R, n.y + Math.sin(a) * R, t / 2, (i) => (wall[i] = 1));
        }
      }
    }
    for (const n of nests) paint(n.x, n.y, n.r + 6, (i) => (wall[i] = 0));
    if (layout === 'arena') addFood(W / 2, H / 2, Math.min(W, H) * 0.12, 60);
    else {
      addFood(W / 2, H / 2, 30, 40);
      for (let k = 0; k < 8; k++) addFood(rand(W * 0.2, W * 0.8), rand(H * 0.1, H * 0.9), rand(10, 20));
    }
    for (const n of nests) for (let k = 0; k < 2; k++) {
      const a = rand(TAU), d = rand(60, 110);
      addFood(n.x + Math.cos(a) * d, n.y + Math.sin(a) * d, 12);
    }

    const capPer = P.cap as number, M = capPer * K;
    const ax = new Float32Array(M), ay = new Float32Array(M), aa = new Float32Array(M), hp = new Float32Array(M);
    const age = new Float32Array(M), life = new Float32Array(M), timer = new Float32Array(M);
    const col = new Uint8Array(M), alive = new Uint8Array(M), carry = new Uint8Array(M), sold = new Uint8Array(M);
    const pop = new Int32Array(K);
    const free: number[] = [];
    for (let i = M - 1; i >= 0; i--) free.push(i);
    const spawn = (c: number, soldier: boolean) => {
      if (!free.length || pop[c] >= capPer) return;
      const i = free.pop()!, n = nests[c];
      ax[i] = n.x + rand(-4, 4); ay[i] = n.y + rand(-4, 4); aa[i] = rand(TAU);
      col[i] = c; alive[i] = 1; carry[i] = 0; sold[i] = soldier ? 1 : 0; hp[i] = soldier ? 3 : 1;
      age[i] = rand(0, 1500); life[i] = (P.life as number) * rand(0.7, 1.3); timer[i] = 0;
      pop[c]++; n.born++;
    };
    for (let c = 0; c < K; c++) for (let k = 0; k < Math.min(P.start as number, capPer); k++) spawn(c, Math.random() < (P.soldiers as number));

    const allied = (a: number, b: number) => a === b || !!P[a < b ? `a${a}${b}` : `a${b}${a}`];
    const grid = new SpatialGrid(W, H, 16);
    const sparks: number[] = [];
    const hist = new History(NAMES.slice(0, K), COLORS.slice(0, K), 300);
    let frame = 0;

    const kill = (j: number, by: number) => {
      alive[j] = 0; pop[col[j]]--; nests[col[j]].lost++;
      if (by >= 0) nests[by].kills++;
      const gi = idx(ax[j], ay[j]);
      food[gi] = Math.min(60, food[gi] + (sold[j] ? 4 : 2));
      if (carry[j]) food[gi] += 1;
      free.push(j);
    };
    const sense = (field: Float32Array, x: number, y: number) => {
      if (!inb(x, y)) return -1;
      const i = idx(x, y);
      return wall[i] ? -1 : field[i];
    };
    const senseHostile = (c: number, x: number, y: number) => {
      if (!inb(x, y)) return -1;
      const i = idx(x, y);
      if (wall[i]) return -1;
      let s = 0;
      for (let k = 0; k < K; k++) if (!allied(c, k)) s += home[k][i];
      return s;
    };

    const step = () => {
      frame++;
      const sp = P.speed as number, sa = 0.6, sd = 9, agg = P.aggression as number, bite = (P.attack as number) * 0.06;
      grid.build(ax, ay, M);
      for (let i = 0; i < M; i++) {
        if (!alive[i]) continue;
        const c = col[i], n = nests[c];
        if (++age[i] > life[i]) { kill(i, -1); continue; }
        let a = aa[i];
        const x = ax[i], y = ay[i];
        // combat + targeting
        let target = -1, td = 1e9;
        const scanR = sold[i] && (i + frame) % 3 === 0 ? 32 : 6;
        grid.query(x, y, scanR, (j) => {
          if (!alive[j] || allied(c, col[j])) return;
          const d = (ax[j] - x) ** 2 + (ay[j] - y) ** 2;
          if (d < td) { td = d; target = j; }
        });
        if (target >= 0 && td < 36) {
          hp[target] -= bite * (sold[i] ? 1 : 0.3);
          if (sparks.length < 600 && Math.random() < 0.15) sparks.push(ax[target], ay[target], 8);
          if (hp[target] <= 0) kill(target, c);
          if (!sold[i]) a += Math.PI * 0.5 * (Math.random() - 0.5) + Math.PI; // workers flee
          aa[i] = a;
          continue;
        }
        if (sold[i] && !carry[i] && target >= 0 && Math.random() < 0.3 + agg * 0.7) {
          a = Math.atan2(ay[target] - y, ax[target] - x);
        } else {
          let l: number, m: number, r: number;
          const cl = Math.cos(a - sa) * sd, sl = Math.sin(a - sa) * sd, cm = Math.cos(a) * sd, sm = Math.sin(a) * sd, cr = Math.cos(a + sa) * sd, sr = Math.sin(a + sa) * sd;
          if (carry[i]) { const f = home[c]; l = sense(f, x + cl, y + sl); m = sense(f, x + cm, y + sm); r = sense(f, x + cr, y + sr); }
          else if (sold[i] && Math.random() < agg) { l = senseHostile(c, x + cl, y + sl); m = senseHostile(c, x + cm, y + sm); r = senseHostile(c, x + cr, y + sr); }
          else { const f = ftrail[c]; l = sense(f, x + cl, y + sl); m = sense(f, x + cm, y + sm); r = sense(f, x + cr, y + sr); }
          if (!(m >= l && m >= r)) a += l > r ? -sa * 0.5 : sa * 0.5;
          if (!carry[i] && !sold[i]) {
            const fl = sense(food, x + cl, y + sl), fr = sense(food, x + cr, y + sr);
            if (fl > 0 && fl > fr) a -= sa * 0.5; else if (fr > 0) a += sa * 0.5;
          } else if (carry[i]) {
            const dx = n.x - x, dy = n.y - y;
            if (dx * dx + dy * dy < 3600) a = Math.atan2(dy, dx);
          }
        }
        a += (Math.random() - 0.5) * 0.3;
        const v = sold[i] ? sp * 1.15 : sp;
        let nx = x + Math.cos(a) * v, ny = y + Math.sin(a) * v;
        if (wallAt(nx, ny)) { a += Math.PI * rand(0.6, 1.4); nx = x; ny = y; }
        ax[i] = nx; ay[i] = ny; aa[i] = a;
        timer[i]++;
        const gi = idx(nx, ny), dep = Math.exp(-timer[i] / 450);
        if (carry[i]) ftrail[c][gi] = Math.min(10, ftrail[c][gi] + dep);
        else home[c][gi] = Math.min(10, home[c][gi] + dep * (sold[i] ? 0.3 : 1));
        const atHome = (nx - n.x) ** 2 + (ny - n.y) ** 2 < n.r * n.r;
        if (carry[i] && atHome) { carry[i] = 0; n.store += 1; timer[i] = 0; aa[i] += Math.PI; }
        else if (atHome) timer[i] = 0;
        else if (!carry[i] && !sold[i] && food[gi] > 0) { food[gi] -= 1; if (food[gi] < 0) food[gi] = 0; carry[i] = 1; timer[i] = 0; aa[i] += Math.PI; }
        else if (sold[i] && !carry[i]) {
          for (let k = 0; k < K; k++) {
            if (allied(c, k)) continue;
            const e = nests[k];
            if ((nx - e.x) ** 2 + (ny - e.y) ** 2 < e.r * e.r * 1.6 && e.store >= 1) {
              e.store -= 1; carry[i] = 1; timer[i] = 0; aa[i] += Math.PI;
              if (sparks.length < 600) sparks.push(e.x + rand(-8, 8), e.y + rand(-8, 8), 10);
              break;
            }
          }
        }
      }
      const cost = P.cost as number, sh = P.soldiers as number;
      for (let c = 0; c < K; c++) {
        let k = 0;
        while (nests[c].store >= cost && pop[c] < capPer && k++ < 6) { nests[c].store -= cost; spawn(c, Math.random() < sh); }
      }
      if (Math.random() < (P.regrow as number) * 0.03) {
        for (let t = 0; t < 10; t++) {
          const x = rand(W * 0.05, W * 0.95), y = rand(H * 0.05, H * 0.95);
          if (!wallAt(x, y)) { addFood(x, y, rand(8, 18), 20); break; }
        }
      }
      const ev = 1 - (P.evap as number);
      for (let c = 0; c < K; c++) { const h = home[c], f = ftrail[c]; for (let i = 0; i < G; i++) { h[i] *= ev; f[i] *= ev; } }
      for (let s = 0; s < sparks.length; s += 3) sparks[s + 2]--;
      for (let s = sparks.length - 3; s >= 0; s -= 3) if (sparks[s + 2] <= 0) sparks.splice(s, 3);
      if (frame % 10 === 0) hist.push(...Array.from(pop));
    };

    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data, tr = P.trails;
      for (let i = 0; i < G; i++) {
        const o = i * 4;
        if (wall[i]) { d[o] = 70; d[o + 1] = 62; d[o + 2] = 56; continue; }
        if (food[i] > 0.5) { const f = Math.min(1, food[i] / 30); d[o] = 90 + 110 * f; d[o + 1] = 150 + 70 * f; d[o + 2] = 40; continue; }
        let r = 16, g = 13, b = 12;
        if (tr) for (let c = 0; c < K; c++) {
          const t = Math.min(1, home[c][i] * 0.12 + ftrail[c][i] * 0.25) * 0.55;
          if (t > 0.01) { const cc = rgb[c]; r += cc[0] * t; g += cc[1] * t; b += cc[2] * t; }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
      }
      buf.blit(ctx, gw * cs, gh * cs);
      for (let c = 0; c < K; c++) {
        const n = nests[c];
        if (!pop[c]) continue;
        ctx.fillStyle = COLORS[c] + '55';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 1.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = COLORS[c]; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.stroke();
      }
      for (let c = 0; c < K; c++) {
        ctx.fillStyle = COLORS[c];
        for (let i = 0; i < M; i++) {
          if (!alive[i] || col[i] !== c) continue;
          if (sold[i]) ctx.fillRect(ax[i] - 1.5, ay[i] - 1.5, 3.2, 3.2);
          else ctx.fillRect(ax[i] - 1, ay[i] - 1, 2, 2);
        }
      }
      ctx.fillStyle = '#fef08a';
      for (let i = 0; i < M; i++) if (alive[i] && carry[i]) ctx.fillRect(ax[i] - 0.5, ay[i] - 0.5, 1.5, 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s < sparks.length; s += 3) {
        const x = sparks[s], y = sparks[s + 1], r = 1 + (10 - sparks[s + 2]) * 0.4;
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
      }
      ctx.stroke();
      if (!thumbnail) hist.draw(ctx, W - 280, H - 92, 268, 80, { title: 'Population' });
    };

    return {
      step, draw,
      pointer(p) {
        if (!p.down && p.type !== 'down') return;
        const t = P.tool;
        if (t === 'wall') paint(p.x, p.y, 8, (i) => { wall[i] = 1; food[i] = 0; });
        else if (t === 'erase') paint(p.x, p.y, 14, (i) => { wall[i] = 0; food[i] = 0; });
        else addFood(p.x, p.y, 12, 10);
      },
      stats: () => {
        const out: [string, string | number][] = [];
        for (let c = 0; c < K; c++) {
          let s = 0;
          for (let i = 0; i < M; i++) if (alive[i] && col[i] === c && sold[i]) s++;
          out.push([NAMES[c], pop[c] ? `${pop[c]} ants (${s} soldiers) · ${nests[c].kills} kills` : 'wiped out']);
        }
        return out;
      },
      actions: [
        { label: 'Food windfall', run: () => { for (let k = 0; k < 6; k++) addFood(rand(W * 0.15, W * 0.85), rand(H * 0.1, H * 0.9), rand(14, 26), 40); } },
        { label: 'Clear trails', run: () => { for (let c = 0; c < K; c++) { home[c].fill(0); ftrail[c].fill(0); } } },
        { label: 'Clear walls', run: () => wall.fill(0) },
      ],
    };
  },
};
