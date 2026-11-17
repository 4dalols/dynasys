import type { SimDef } from '../core/types';
import { PixelBuffer, stampGrid } from '../core/util';

const ALGOS = [
  { id: 'bfs', name: 'Breadth-first', col: '#38bdf8' },
  { id: 'dfs', name: 'Depth-first', col: '#f472b6' },
  { id: 'dij', name: 'Dijkstra', col: '#a78bfa' },
  { id: 'astar', name: 'A*', col: '#4ade80' },
  { id: 'wastar', name: 'Weighted A* (×2.5)', col: '#facc15' },
  { id: 'greedy', name: 'Greedy best-first', col: '#fb923c' },
];
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

class Heap {
  ids: number[] = [];
  pr: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number) {
    const a = this.ids, q = this.pr;
    let i = a.length;
    a.push(id); q.push(p);
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (q[par] <= p) break;
      a[i] = a[par]; q[i] = q[par]; i = par;
    }
    a[i] = id; q[i] = p;
  }
  pop() {
    const a = this.ids, q = this.pr, top = a[0], id = a.pop()!, p = q.pop()!;
    const n = a.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && q[c + 1] < q[c]) c++;
        if (q[c] >= p) break;
        a[i] = a[c]; q[i] = q[c]; i = c;
      }
      a[i] = id; q[i] = p;
    }
    return top;
  }
}

interface Run {
  algo: number;
  order: Int32Array;
  seen: Uint8Array;
  dist: Float32Array;
  prev: Int32Array;
  heap: Heap;
  queue: Int32Array;
  qh: number;
  qt: number;
  stack: number[];
  expanded: number;
  done: boolean;
  found: boolean;
  cost: number;
  path: number[];
  rank: number;
}

export const pathrace: SimDef = {
  id: 'pathrace',
  title: 'Pathfinding Race',
  tagline: 'Six search algorithms race through the same maze, one expansion at a time. A* is clever, breadth-first is thorough, depth-first is… brave.',
  category: 'Algorithms at War',
  accent: '#4ade80',
  controls: 'Drag in any panel to draw walls · right-drag erases · shift-click moves the goal',
  thumbSteps: 160,
  params: [
    { type: 'select', key: 'map', label: 'Terrain', default: 'maze', reset: true, options: [
      { value: 'maze', label: 'Maze' }, { value: 'rocks', label: 'Boulder field' }, { value: 'mud', label: 'Mud & walls (weighted)' }, { value: 'open', label: 'Open with a wall' }] },
    { key: 'size', label: 'Grid width (cells)', min: 15, max: 121, step: 2, default: 51, reset: true },
    { key: 'loops', label: 'Maze shortcuts', min: 0, max: 0.4, step: 0.01, default: 0.08, reset: true, hint: 'Knocks holes in the maze so there are many routes' },
    { key: 'mudcost', label: 'Mud cost', min: 2, max: 20, step: 1, default: 6, reset: true },
    { key: 'speed', label: 'Expansions per frame', min: 1, max: 100, step: 1, default: 6 },
    { type: 'toggle', key: 'auto', label: 'New map after each race', default: true },
    { type: 'group', label: 'Racers' },
    ...ALGOS.map((a) => ({ type: 'toggle' as const, key: a.id, label: a.name, default: true, reset: true })),
  ],
  presets: [
    { name: 'Maze race', values: {} },
    { name: 'Perfect maze (one route)', values: { loops: 0 } },
    { name: 'Boulder field', values: { map: 'rocks' } },
    { name: 'Mud: optimal vs fast', values: { map: 'mud', bfs: true, dfs: false, dij: true, astar: true, wastar: true, greedy: true } },
    { name: 'Open field', values: { map: 'open', size: 61 } },
    { name: 'A* vs Dijkstra', values: { bfs: false, dfs: false, wastar: false, greedy: false, map: 'rocks', size: 81 } },
    { name: 'Huge maze', values: { size: 121, speed: 40 } },
  ],
  about: `<p>All racers search the same grid from the green start to the red goal, expanding one cell per tick each, so the one that finishes first is the one that examined the fewest cells. Bright cells are the <b>frontier</b> waiting to be explored and faded cells are already done. The final route is drawn in white, with its total cost.</p>
<ul><li><b>Breadth-first</b> spreads out in rings and finds the path with the fewest steps, but ignores terrain cost.</li>
<li><b>Depth-first</b> charges down one corridor until it hits a dead end, then backs up. It is fast when it guesses right and the route it finds is often terrible.</li>
<li><b>Dijkstra</b> spreads like breadth-first but by cost, so in mud it is always optimal.</li>
<li><b>A*</b> adds a guess of the remaining distance (here the Manhattan distance), which pulls the search towards the goal while staying optimal.</li>
<li><b>Weighted A*</b> trusts that guess 2.5× more: much faster, and the path it finds is at most 2.5× longer than the best.</li>
<li><b>Greedy best-first</b> looks only at the guess. It is lightning fast in open fields and easily fooled by walls.</li></ul>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const active = ALGOS.map((_, i) => i).filter((i) => P[ALGOS[i].id]);
    if (!active.length) active.push(3);
    const n = active.length;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const top = thumbnail ? 0 : 76, labelH = thumbnail ? 0 : 34, pad = thumbnail ? 2 : 8;
    const pw = W / cols, ph = (H - top) / rows;
    let gw = thumbnail ? 31 : (P.size as number);
    if (!(gw % 2)) gw++;
    let gh = Math.round((gw * (ph - labelH - pad * 2)) / (pw - pad * 2));
    if (!(gh % 2)) gh++;
    gh = Math.max(9, gh);
    const G = gw * gh;
    const cs = Math.min((pw - pad * 2) / gw, (ph - labelH - pad * 2) / gh);
    const wall = new Uint8Array(G), cost = new Float32Array(G);
    let start = 0, goal = 0, wait = 0;
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

    const genMap = () => {
      wall.fill(0); cost.fill(1);
      const map = P.map as string;
      if (map === 'maze') {
        wall.fill(1);
        const stack = [gw + 1];
        wall[gw + 1] = 0;
        while (stack.length) {
          const c = stack[stack.length - 1], x = c % gw, y = (c / gw) | 0;
          const opts: number[] = [];
          for (let d = 0; d < 4; d++) {
            const nx = x + DX[d] * 2, ny = y + DY[d] * 2;
            if (nx > 0 && ny > 0 && nx < gw - 1 && ny < gh - 1 && wall[ny * gw + nx]) opts.push(d);
          }
          if (!opts.length) { stack.pop(); continue; }
          const d = opts[(Math.random() * opts.length) | 0];
          wall[(y + DY[d]) * gw + x + DX[d]] = 0;
          wall[(y + DY[d] * 2) * gw + x + DX[d] * 2] = 0;
          stack.push((y + DY[d] * 2) * gw + x + DX[d] * 2);
        }
        const L = P.loops as number;
        for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
          const i = y * gw + x;
          if (!wall[i] || Math.random() > L) continue;
          if ((wall[i - 1] && wall[i + 1] && !wall[i - gw] && !wall[i + gw]) || (!wall[i - 1] && !wall[i + 1] && wall[i - gw] && wall[i + gw])) wall[i] = 0;
        }
      } else if (map === 'rocks') {
        for (let k = 0; k < G * 0.012; k++) stampGrid(gw, gh, Math.random() * gw, Math.random() * gh, 0.8 + Math.random() * gw * 0.05, (i) => (wall[i] = 1));
      } else if (map === 'mud') {
        for (let k = 0; k < G * 0.004; k++) stampGrid(gw, gh, Math.random() * gw, Math.random() * gh, 2 + Math.random() * gw * 0.08, (i) => (cost[i] = P.mudcost as number));
        for (let k = 0; k < 5; k++) {
          const vert = Math.random() < 0.5, c = (Math.random() * (vert ? gw : gh)) | 0, a = (Math.random() * 0.5 * (vert ? gh : gw)) | 0, len = ((vert ? gh : gw) * 0.5) | 0;
          for (let t = a; t < a + len; t++) wall[vert ? t * gw + c : c * gw + t] = 1;
        }
      } else {
        const x = (gw * 0.5) | 0;
        for (let y = (gh * 0.15) | 0; y < gh * 0.85; y++) wall[y * gw + x] = 1;
        for (let t = (gw * 0.25) | 0; t <= x; t++) { wall[((gh * 0.15) | 0) * gw + t] = 1; wall[((gh * 0.85) | 0) * gw + t] = 1; }
      }
      start = gw + 1;
      goal = map === 'open' ? ((gh / 2) | 0) * gw + gw - 3 : (gh - 2) * gw + gw - 2;
      if (map === 'open') start = ((gh / 2) | 0) * gw + 2;
      for (const c of [start, goal]) { wall[c] = 0; cost[c] = 1; }
    };

    const runs: Run[] = active.map((a) => ({
      algo: a, order: new Int32Array(G), seen: new Uint8Array(G), dist: new Float32Array(G), prev: new Int32Array(G),
      heap: new Heap(), queue: new Int32Array(G), qh: 0, qt: 0, stack: [], expanded: 0, done: false, found: false, cost: 0, path: [], rank: 0,
    }));
    const hManhattan = (i: number) => Math.abs((i % gw) - (goal % gw)) + Math.abs(((i / gw) | 0) - ((goal / gw) | 0));
    const restart = () => {
      wait = 0;
      for (const r of runs) {
        r.order.fill(0); r.seen.fill(0); r.dist.fill(Infinity); r.prev.fill(-1);
        r.heap = new Heap(); r.qh = r.qt = 0; r.stack = []; r.expanded = 0; r.done = r.found = false; r.cost = 0; r.path = []; r.rank = 0;
        r.dist[start] = 0; r.seen[start] = 1;
        const id = ALGOS[r.algo].id;
        if (id === 'bfs') r.queue[r.qt++] = start;
        else if (id === 'dfs') r.stack.push(start, -1);
        else r.heap.push(start, 0);
      }
    };
    genMap(); restart();

    const finish = (r: Run, found: boolean) => {
      r.done = true; r.found = found;
      if (!found) return;
      let c = goal, total = 0;
      while (c !== -1) { r.path.push(c); if (c !== start) total += cost[c]; c = r.prev[c]; }
      r.cost = total;
    };
    const expand = (r: Run) => {
      const id = ALGOS[r.algo].id;
      let c = -1;
      if (id === 'bfs') {
        if (r.qh >= r.qt) return finish(r, false);
        c = r.queue[r.qh++];
      } else if (id === 'dfs') {
        for (;;) {
          if (!r.stack.length) return finish(r, false);
          const par = r.stack.pop()!, node = r.stack.pop()!;
          if (r.order[node]) continue;
          r.prev[node] = par; c = node; break;
        }
      } else {
        for (;;) {
          if (!r.heap.size) return finish(r, false);
          const node = r.heap.pop();
          if (!r.order[node]) { c = node; break; }
        }
      }
      r.order[c] = ++r.expanded;
      if (c === goal) return finish(r, true);
      const x = c % gw, y = (c / gw) | 0;
      for (let k = 0; k < 4; k++) {
        const d = id === 'dfs' ? 3 - k : k;
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (wall[j] || r.order[j]) continue;
        if (id === 'bfs') { if (!r.seen[j]) { r.seen[j] = 1; r.prev[j] = c; r.queue[r.qt++] = j; } continue; }
        if (id === 'dfs') { r.seen[j] = 1; r.stack.push(j, c); continue; }
        const nd = r.dist[c] + cost[j];
        if (nd >= r.dist[j]) continue;
        r.dist[j] = nd; r.prev[j] = c; r.seen[j] = 1;
        const h = hManhattan(j);
        const pr = id === 'dij' ? nd : id === 'astar' ? nd + h * 1.0001 : id === 'wastar' ? nd + h * 2.5 : h;
        r.heap.push(j, pr);
      }
    };
    const rankAll = () => {
      const fin = runs.filter((r) => r.found).sort((a, b) => a.expanded - b.expanded);
      fin.forEach((r, k) => (r.rank = k > 0 && fin[k - 1].expanded === r.expanded ? fin[k - 1].rank : k + 1));
    };
    const step = () => {
      if (runs.every((r) => r.done)) {
        if (!wait) rankAll();
        wait++;
        if (P.auto && wait > (thumbnail ? 1e9 : 150)) { genMap(); restart(); }
        return;
      }
      const k = P.speed as number;
      for (const r of runs) for (let t = 0; t < k && !r.done; t++) expand(r);
    };

    const bufs = runs.map(() => new PixelBuffer(gw, gh));
    const panel = (k: number) => {
      const c = k % cols, rr = (k / cols) | 0;
      const x = c * pw, y = top + rr * ph;
      const ox = x + (pw - gw * cs) / 2, oy = y + labelH + (ph - labelH - gh * cs) / 2;
      return { x, y, ox, oy };
    };
    const optimal = () => Math.min(...runs.filter((r) => r.found && ['dij', 'astar'].includes(ALGOS[r.algo].id)).map((r) => r.cost));
    const draw = () => {
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
      const best = optimal();
      runs.forEach((r, k) => {
        const { x, y, ox, oy } = panel(k);
        const col = hex(ALGOS[r.algo].col), d = bufs[k].data, ex = Math.max(1, r.expanded);
        for (let i = 0; i < G; i++) {
          const o = i * 4;
          if (wall[i]) { d[o] = 44; d[o + 1] = 48; d[o + 2] = 62; continue; }
          const mud = cost[i] > 1;
          let rr = mud ? 58 : 12, gg = mud ? 42 : 14, bb = mud ? 26 : 22;
          if (r.order[i]) { const f = 0.18 + 0.5 * (r.order[i] / ex); rr = rr * (1 - f) + col[0] * f; gg = gg * (1 - f) + col[1] * f; bb = bb * (1 - f) + col[2] * f; }
          else if (r.seen[i]) { rr = col[0]; gg = col[1]; bb = col[2]; }
          d[o] = rr; d[o + 1] = gg; d[o + 2] = bb;
        }
        ctx.save(); ctx.translate(ox, oy);
        bufs[k].blit(ctx, gw * cs, gh * cs);
        if (r.path.length > 1) {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, cs * 0.35); ctx.lineJoin = 'round';
          ctx.beginPath();
          for (const c of r.path) ctx.lineTo((c % gw + 0.5) * cs, (((c / gw) | 0) + 0.5) * cs);
          ctx.stroke();
        }
        for (const [c, f] of [[start, '#22c55e'], [goal, '#ef4444']] as [number, string][]) {
          ctx.fillStyle = f; ctx.beginPath(); ctx.arc((c % gw + 0.5) * cs, (((c / gw) | 0) + 0.5) * cs, Math.max(3, cs * 0.7), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        if (thumbnail) return;
        ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = ALGOS[r.algo].col;
        const medal = r.rank ? ['🥇 ', '🥈 ', '🥉 '][r.rank - 1] ?? `#${r.rank} ` : '';
        ctx.fillText(medal + ALGOS[r.algo].name, x + pad + 2, y + 20);
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'right';
        const status = !r.done ? `searching · ${r.expanded} cells` : r.found
          ? `${r.expanded} cells · cost ${+r.cost.toFixed(1)}${isFinite(best) ? (r.cost <= best + 1e-6 ? ' ✓ optimal' : ` (+${(((r.cost - best) / best) * 100).toFixed(0)}%)`) : ''}`
          : `no path · ${r.expanded} cells`;
        ctx.fillText(status, x + pw - pad - 2, y + 20); ctx.textAlign = 'start';
      });
    };

    const toCell = (px: number, py: number) => {
      for (let k = 0; k < runs.length; k++) {
        const { ox, oy } = panel(k);
        const cx = Math.floor((px - ox) / cs), cy = Math.floor((py - oy) / cs);
        if (cx >= 0 && cy >= 0 && cx < gw && cy < gh) return cy * gw + cx;
      }
      return -1;
    };
    return {
      step, draw,
      pointer(p) {
        if (!p.down) return;
        const c = toCell(p.x, p.y);
        if (c < 0) return;
        if (p.shift) { if (p.type === 'down' && c !== start) { goal = c; wall[c] = 0; restart(); } return; }
        const v = p.button === 2 ? 0 : 1;
        if (c === start || c === goal || wall[c] === v) return;
        wall[c] = v; restart();
      },
      stats: () => runs.map((r) => [ALGOS[r.algo].name, r.done ? (r.found ? `${r.expanded} · cost ${+r.cost.toFixed(1)}` : 'no path') : `${r.expanded}…`] as [string, string]),
      actions: [
        { label: 'New map', run: () => { genMap(); restart(); } },
        { label: 'Rerun race', run: restart },
      ],
    };
  },
};
