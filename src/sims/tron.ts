import type { SimDef, ParamDef, ParamGroup } from '../core/types';
import { PixelBuffer, stampGrid } from '../core/util';

const NAMES = ['Cyan', 'Magenta', 'Lime', 'Orange'];
const COLS: [number, number, number][] = [[34, 211, 238], [232, 121, 249], [163, 230, 53], [251, 146, 60]];
const HEX = ['#22d3ee', '#e879f9', '#a3e635', '#fb923c'];
const AIS = [
  { value: 'voronoi', label: 'Territory (Voronoi)' },
  { value: 'space', label: 'Space-maximiser (flood fill)' },
  { value: 'hunter', label: 'Hunter (cut them off)' },
  { value: 'wallhug', label: 'Wall-hugger' },
  { value: 'straight', label: 'Straight until blocked' },
  { value: 'random', label: 'Random' },
  { value: 'human', label: 'You (arrow keys / WASD)' },
];
const ANAME: Record<string, string> = { voronoi: 'Territory', space: 'Space-max', hunter: 'Hunter', wallhug: 'Wall-hug', straight: 'Straight', random: 'Random', human: 'You' };
const DEF = ['voronoi', 'space', 'hunter', 'wallhug'];
const bots: (ParamDef | ParamGroup)[] = [{ type: 'group', label: 'Drivers' }];
for (let b = 0; b < 4; b++) bots.push({ type: 'select', key: `ai${b}`, label: `${NAMES[b]}`, default: DEF[b], options: AIS, reset: true });

const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

export const tron: SimDef = {
  id: 'tron',
  title: 'Tron Light-Cycle AIs',
  tagline: 'Light cycles leave walls behind them. Which brain survives longest: grab territory, maximise space, hunt, or hug the walls? Or take the wheel yourself.',
  category: 'Algorithms at War',
  accent: '#22d3ee',
  controls: 'Drag to draw obstacles · pick “You” as a driver and steer with arrow keys / WASD',
  thumbSteps: 140,
  params: [
    { key: 'riders', label: 'Riders', min: 2, max: 4, step: 1, default: 2, reset: true },
    { key: 'cell', label: 'Cell size (px)', min: 4, max: 20, step: 1, default: 9, reset: true },
    { key: 'slow', label: 'Frames per move', min: 1, max: 8, step: 1, default: 1, hint: 'Raise this if you are driving' },
    { type: 'select', key: 'map', label: 'Arena', default: 'empty', reset: true, options: [
      { value: 'empty', label: 'Empty' }, { value: 'pillars', label: 'Pillars' }, { value: 'blocks', label: 'Random blocks' }, { value: 'cross', label: 'Cross' }] },
    { key: 'look', label: 'Lookahead budget (cells)', min: 50, max: 4000, step: 50, default: 1500, hint: 'Caps the flood fills — lower makes every AI more short-sighted' },
    ...bots,
  ],
  presets: [
    { name: 'Territory vs Space-max', values: {} },
    { name: 'Four-way free-for-all', values: { riders: 4 } },
    { name: 'Hunter vs Wall-hugger', values: { ai0: 'hunter', ai1: 'wallhug' } },
    { name: 'Clever vs Random', values: { ai0: 'voronoi', ai1: 'random', riders: 4, ai2: 'random', ai3: 'random' } },
    { name: 'Pillar maze', values: { map: 'pillars', riders: 4 } },
    { name: 'Short-sighted AIs', values: { look: 60, riders: 4 } },
    { name: 'You vs Hunter', values: { ai0: 'human', ai1: 'hunter', slow: 4, cell: 16 } },
    { name: 'You vs 3 AIs', values: { ai0: 'human', riders: 4, slow: 4, cell: 16 } },
  ],
  about: `<p>Each rider moves one cell per tick and leaves a solid trail. Hitting any wall, trail or another rider's head is fatal; the last one riding wins the round. All riders choose simultaneously, then move. The AIs only look one move ahead but each scores its three options differently:</p>
<ul><li><b>Territory</b> runs a breadth-first search from every head at once and counts the cells it would reach before anyone else (a Voronoi partition) — the classic strong heuristic from AI Tron contests.</li>
<li><b>Space-maximiser</b> flood-fills from each option and picks the biggest pocket.</li>
<li><b>Hunter</b> steers towards a point just ahead of its nearest rival, but only through safe options.</li>
<li><b>Wall-hugger</b> keeps close to walls so it wastes as little room as possible, which helps in the endgame.</li></ul>
<p>The lookahead budget caps each flood fill; with tiny budgets every AI becomes short-sighted and drives itself into dead ends.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 7 : (P.cell as number);
    const gw = Math.floor(W / cs), gh = Math.floor(H / cs), G = gw * gh;
    const ox = ((W - gw * cs) / 2) | 0, oy = ((H - gh * cs) / 2) | 0;
    const N = P.riders as number;
    const grid = new Int8Array(G);
    const obst = new Uint8Array(G);
    const hx = new Int32Array(N), hy = new Int32Array(N), hd = new Int32Array(N), alive = new Uint8Array(N);
    const ai = Array.from({ length: N }, (_, b) => P[`ai${b}`] as string);
    const wins = new Int32Array(N);
    let draws = 0, rounds = 0, pause = 0, banner = '', frame = 0;
    const pending = new Int32Array(N).fill(-1);

    if (P.map === 'pillars') {
      const s = Math.max(6, (Math.min(gw, gh) / 7) | 0);
      for (let y = s; y < gh - s / 2; y += s) for (let x = s; x < gw - s / 2; x += s) for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) obst[(y + a) * gw + x + c] = 1;
    } else if (P.map === 'blocks') {
      for (let k = 0; k < Math.max(1, (G / 500) | 0); k++) {
        const x = (Math.random() * gw) | 0, y = (Math.random() * gh) | 0, w = 1 + ((Math.random() * 5) | 0), h = 1 + ((Math.random() * 5) | 0);
        for (let a = 0; a < h; a++) for (let c = 0; c < w; c++) if (x + c < gw && y + a < gh) obst[(y + a) * gw + x + c] = 1;
      }
    } else if (P.map === 'cross') {
      const cx = (gw / 2) | 0, cy = (gh / 2) | 0, L = (Math.min(gw, gh) * 0.3) | 0;
      for (let t = -L; t <= L; t++) { obst[cy * gw + cx + t] = 1; obst[(cy + t) * gw + cx] = 1; }
    }

    const reset = () => {
      for (let i = 0; i < G; i++) grid[i] = obst[i] ? -1 : 0;
      const spots: [number, number, number][] = N === 2
        ? [[0.2, 0.5, 0], [0.8, 0.5, 2]]
        : [[0.2, 0.2, 0], [0.8, 0.8, 2], [0.8, 0.2, 1], [0.2, 0.8, 3]];
      for (let b = 0; b < N; b++) {
        const [fx, fy, d] = spots[b];
        hx[b] = (fx * gw) | 0; hy[b] = (fy * gh) | 0; hd[b] = d; alive[b] = 1; pending[b] = -1;
        const i = hy[b] * gw + hx[b];
        stampGrid(gw, gh, hx[b], hy[b], 2, (j) => { if (grid[j] === -1) grid[j] = 0; });
        grid[i] = b + 1;
      }
    };
    reset();

    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && grid[y * gw + x] === 0;
    const mark = new Int32Array(G);
    let stamp = 1;
    const q = new Int32Array(G);
    const flood = (sx: number, sy: number, cap: number) => {
      stamp++;
      let h = 0, t = 0;
      q[t++] = sy * gw + sx; mark[sy * gw + sx] = stamp;
      while (h < t && t < cap) {
        const i = q[h++], x = i % gw, y = (i / gw) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (grid[j] !== 0 || mark[j] === stamp) continue;
          mark[j] = stamp; q[t++] = j;
        }
      }
      return t;
    };
    const dist = new Int32Array(G), who = new Int8Array(G);
    const voronoi = (b: number, sx: number, sy: number, cap: number) => {
      stamp++;
      let h = 0, t = 0;
      const push = (i: number, d: number, o: number) => { mark[i] = stamp; dist[i] = d; who[i] = o; q[t++] = i; };
      push(sy * gw + sx, 0, b);
      for (let o = 0; o < N; o++) {
        if (o === b || !alive[o]) continue;
        for (let d = 0; d < 4; d++) {
          const nx = hx[o] + DX[d], ny = hy[o] + DY[d];
          if (!free(nx, ny)) continue;
          const j = ny * gw + nx;
          if (mark[j] === stamp) { if (dist[j] === 0) who[j] = -1; continue; }
          push(j, 0, o);
        }
      }
      let mine = 0, theirs = 0;
      while (h < t && h < cap * 2) {
        const i = q[h++], x = i % gw, y = (i / gw) | 0, o = who[i];
        if (o === b) mine++; else if (o >= 0) theirs++;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (grid[j] !== 0) continue;
          if (mark[j] === stamp) { if (dist[j] === dist[i] + 1 && who[j] !== o) who[j] = -1; continue; }
          push(j, dist[i] + 1, o);
        }
      }
      return mine - theirs * 0.9;
    };
    const nearHead = (b: number, x: number, y: number) => {
      for (let o = 0; o < N; o++) if (o !== b && alive[o] && Math.abs(hx[o] - x) + Math.abs(hy[o] - y) === 1) return true;
      return false;
    };

    const decide = (b: number) => {
      const kind = ai[b], cap = P.look as number, cur = hd[b];
      if (kind === 'human') { if (pending[b] >= 0 && pending[b] !== (cur + 2) % 4) hd[b] = pending[b]; pending[b] = -1; return; }
      const opts = [cur, (cur + 1) % 4, (cur + 3) % 4];
      const ok = opts.filter((d) => free(hx[b] + DX[d], hy[b] + DY[d]));
      if (!ok.length) return;
      if (kind === 'random') {
        if (ok.includes(cur) && Math.random() < 0.9) return;
        hd[b] = ok[(Math.random() * ok.length) | 0]; return;
      }
      const area = ok.map((d) => flood(hx[b] + DX[d], hy[b] + DY[d], cap));
      const maxA = Math.max(...area);
      let best = ok[0], bs = -1e9;
      ok.forEach((d, k) => {
        const nx = hx[b] + DX[d], ny = hy[b] + DY[d];
        let s: number;
        const safe = area[k] >= maxA * 0.8;
        switch (kind) {
          case 'space': s = area[k] + (d === cur ? 0.5 : 0); break;
          case 'straight': s = (safe ? 1000 : 0) + (d === cur ? 1 : 0) + area[k] * 0.001; break;
          case 'wallhug': {
            let walls = 0;
            for (let e = 0; e < 4; e++) if (!free(nx + DX[e], ny + DY[e])) walls++;
            s = (safe ? 1000 : area[k]) + walls * 2 + (d === cur ? 0.5 : 0); break;
          }
          case 'hunter': {
            let tx = gw / 2, ty = gh / 2, bd = 1e9;
            for (let o = 0; o < N; o++) {
              if (o === b || !alive[o]) continue;
              const px = hx[o] + DX[hd[o]] * 5, py = hy[o] + DY[hd[o]] * 5, dd = Math.abs(px - hx[b]) + Math.abs(py - hy[b]);
              if (dd < bd) { bd = dd; tx = px; ty = py; }
            }
            s = (safe ? 1000 : area[k]) - Math.hypot(tx - nx, ty - ny); break;
          }
          default: s = (area[k] < maxA * 0.5 ? area[k] - 1e5 : 0) + voronoi(b, nx, ny, cap) + (d === cur ? 0.3 : 0);
        }
        if (nearHead(b, nx, ny)) s -= 500;
        if (s > bs) { bs = s; best = d; }
      });
      hd[b] = best;
    };

    const step = () => {
      frame++;
      if (pause > 0) { if (--pause === 0) reset(); return; }
      if (frame % (P.slow as number)) return;
      for (let b = 0; b < N; b++) if (alive[b]) decide(b);
      const nx = new Int32Array(N), ny = new Int32Array(N), die = new Uint8Array(N);
      for (let b = 0; b < N; b++) {
        if (!alive[b]) continue;
        nx[b] = hx[b] + DX[hd[b]]; ny[b] = hy[b] + DY[hd[b]];
        if (!free(nx[b], ny[b])) die[b] = 1;
      }
      for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++)
        if (alive[a] && alive[b] && nx[a] === nx[b] && ny[a] === ny[b]) die[a] = die[b] = 1;
      for (let b = 0; b < N; b++) {
        if (!alive[b]) continue;
        if (die[b]) { alive[b] = 0; continue; }
        hx[b] = nx[b]; hy[b] = ny[b]; grid[ny[b] * gw + nx[b]] = b + 1;
      }
      let left = 0, last = -1;
      for (let b = 0; b < N; b++) if (alive[b]) { left++; last = b; }
      if (left <= 1) {
        rounds++;
        if (left === 1) { wins[last]++; banner = `${NAMES[last]} (${ANAME[ai[last]]}) wins`; }
        else { draws++; banner = 'Draw — nobody survived'; }
        pause = thumbnail ? 1 : 70;
      }
    };

    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) {
        const v = grid[i], o = i * 4;
        if (v === -1) { d[o] = 70; d[o + 1] = 76; d[o + 2] = 92; }
        else if (v === 0) { const x = i % gw, y = (i / gw) | 0, g = x % 8 === 0 || y % 8 === 0 ? 16 : 8; d[o] = g; d[o + 1] = g + 2; d[o + 2] = g + 8; }
        else { const c = COLS[v - 1], m = alive[v - 1] ? 0.75 : 0.3; d[o] = c[0] * m; d[o + 1] = c[1] * m; d[o + 2] = c[2] * m; }
      }
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(ox, oy);
      buf.blit(ctx, gw * cs, gh * cs);
      for (let b = 0; b < N; b++) {
        if (!alive[b]) continue;
        const x = (hx[b] + 0.5) * cs, y = (hy[b] + 0.5) * cs;
        ctx.shadowColor = HEX[b]; ctx.shadowBlur = 14;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, cs * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      if (thumbnail) return;
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(5,7,13,0.75)';
      ctx.fillRect(W - 210, 12, 198, 14 + (N + 1) * 18);
      for (let b = 0; b <= N; b++) {
        ctx.fillStyle = b < N ? HEX[b] : '#94a3b8';
        ctx.fillText(b < N ? `${NAMES[b]} · ${ANAME[ai[b]]}` : 'Draws', W - 200, 30 + b * 18);
        ctx.fillStyle = '#e5e7eb'; ctx.textAlign = 'right';
        ctx.fillText(`${b < N ? wins[b] : draws}`, W - 22, 30 + b * 18); ctx.textAlign = 'start';
      }
      if (pause > 0) {
        ctx.font = '700 24px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
        const tw = ctx.measureText(banner).width;
        ctx.fillStyle = 'rgba(5,7,13,0.85)'; ctx.fillRect(W / 2 - tw / 2 - 18, H / 2 - 26, tw + 36, 44);
        ctx.fillStyle = '#f8fafc'; ctx.fillText(banner, W / 2, H / 2 + 4); ctx.textAlign = 'start';
      }
    };

    const KEYS: Record<string, number> = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3 };
    const human = ai.indexOf('human');
    const onKey = (e: KeyboardEvent) => {
      if (human < 0 || !(e.key in KEYS)) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      e.preventDefault();
      pending[human] = KEYS[e.key];
    };
    if (!thumbnail) window.addEventListener('keydown', onKey);

    return {
      step, draw,
      pointer(p) {
        if (!p.down) return;
        stampGrid(gw, gh, (p.x - ox) / cs, (p.y - oy) / cs, 1.5, (i) => { if (grid[i] === 0) { grid[i] = -1; obst[i] = 1; } });
      },
      stats: () => [...Array.from({ length: N }, (_, b) => [`${NAMES[b]} wins`, wins[b]] as [string, number]), ['Rounds', rounds]],
      actions: [
        { label: 'Restart round', run: () => { pause = 0; reset(); } },
        { label: 'Clear obstacles', run: () => { obst.fill(0); for (let i = 0; i < G; i++) if (grid[i] === -1) grid[i] = 0; } },
        { label: 'Reset score', run: () => { wins.fill(0); draws = 0; rounds = 0; } },
      ],
      dispose: () => window.removeEventListener('keydown', onKey),
    };
  },
};
