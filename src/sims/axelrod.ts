import type { SimDef } from '../core/types';
import { PixelBuffer } from '../core/util';

const S = [
  { id: 'ALLC', name: 'Always cooperate', col: '#4ade80', on: true },
  { id: 'ALLD', name: 'Always defect', col: '#ef4444', on: true },
  { id: 'TFT', name: 'Tit for tat', col: '#38bdf8', on: true },
  { id: 'TF2T', name: 'Tit for two tats', col: '#818cf8', on: true },
  { id: 'GRIM', name: 'Grudger', col: '#a8a29e', on: true },
  { id: 'WSLS', name: 'Pavlov (win-stay)', col: '#f472b6', on: true },
  { id: 'GTFT', name: 'Generous TFT', col: '#2dd4bf', on: true },
  { id: 'STFT', name: 'Suspicious TFT', col: '#fb923c', on: true },
  { id: 'JOSS', name: 'Joss (sneaky TFT)', col: '#facc15', on: true },
  { id: 'RAND', name: 'Random', col: '#c084fc', on: true },
];
const NS = S.length;
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RGB = S.map((s) => rgb(s.col));

const decide = (s: number, t: number, my: number, op: number, op2: number, opD: number) => {
  switch (s) {
    case 0: return 0;
    case 1: return 1;
    case 2: return t ? op : 0;
    case 3: return t > 1 && op && op2 ? 1 : 0;
    case 4: return opD;
    case 5: return t ? (my === op ? 0 : 1) : 0;
    case 6: return t && op ? (Math.random() < 1 / 3 ? 0 : 1) : 0;
    case 7: return t ? op : 1;
    case 8: return t ? (op ? 1 : Math.random() < 0.1 ? 1 : 0) : 0;
    default: return Math.random() < 0.5 ? 1 : 0;
  }
};

export const axelrod: SimDef = {
  id: 'axelrod',
  title: 'Axelrod Tournament',
  tagline: 'Ten prisoner’s-dilemma strategies play each other over and over; winners multiply. Watch cooperation win, get invaded, and win again.',
  category: 'Algorithms at War',
  accent: '#38bdf8',
  controls: 'In spatial mode, drag to paint the brush strategy',
  thumbSteps: 200,
  params: [
    { type: 'select', key: 'mode', label: 'Population', default: 'mixed', reset: true, options: [
      { value: 'mixed', label: 'Well-mixed (everyone meets everyone)' }, { value: 'spatial', label: 'Spatial (play your 8 neighbours)' }] },
    { key: 'rounds', label: 'Rounds per match', min: 1, max: 300, step: 1, default: 60, hint: 'The “shadow of the future” — short games favour defectors' },
    { key: 'noise', label: 'Mistake rate', min: 0, max: 0.2, step: 0.005, default: 0.01 },
    { type: 'group', label: 'Payoffs' },
    { key: 'T', label: 'Temptation (I defect, you cooperate)', min: 3, max: 10, step: 0.1, default: 5 },
    { key: 'R', label: 'Reward (both cooperate)', min: 1, max: 6, step: 0.1, default: 3 },
    { key: 'P', label: 'Punishment (both defect)', min: 0, max: 3, step: 0.1, default: 1 },
    { key: 'Sk', label: 'Sucker (I cooperate, you defect)', min: -3, max: 2, step: 0.1, default: 0 },
    { type: 'group', label: 'Evolution' },
    { key: 'sel', label: 'Selection strength', min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: 'mut', label: 'Mutation rate', min: 0, max: 0.05, step: 0.001, default: 0.002 },
    { key: 'upd', label: 'Spatial: share updating per tick', min: 0.05, max: 1, step: 0.05, default: 0.3 },
    { key: 'cell', label: 'Spatial: cell size (px)', min: 2, max: 12, step: 1, default: 5, reset: true },
    { type: 'select', key: 'brush', label: 'Brush / invader', default: '1', options: S.map((s, i) => ({ value: `${i}`, label: s.name })) },
    { type: 'toggle', key: 'matrix', label: 'Show payoff matrix', default: true },
    { type: 'group', label: 'Entrants' },
    ...S.map((s, i) => ({ type: 'toggle' as const, key: `e${i}`, label: s.name, default: s.on, reset: true })),
  ],
  presets: [
    { name: 'Classic tournament', values: {} },
    { name: 'Noisy world', values: { noise: 0.06 } },
    { name: 'One-shot games', values: { rounds: 2 } },
    { name: 'Doves, hawks & TFT', values: { e3: false, e4: false, e5: false, e6: false, e7: false, e8: false, e9: false, mut: 0.004 } },
    { name: 'Pavlov vs TFT under noise', values: { e0: true, e1: true, e2: true, e3: false, e4: false, e5: true, e6: false, e7: false, e8: false, e9: false, noise: 0.05 } },
    { name: 'Spatial', values: { mode: 'spatial' } },
    { name: 'Spatial, short games', values: { mode: 'spatial', rounds: 4 } },
    { name: 'Huge temptation', values: { T: 9 } },
  ],
  about: `<p>In 1980 Robert Axelrod invited game theorists to submit programs for a repeated prisoner’s dilemma. Each pair plays a match; cooperating together pays <b>R</b>, defecting together pays <b>P</b>, and a defector exploiting a cooperator gets <b>T</b> while the cooperator gets <b>S</b>. The simplest entry, <b>tit for tat</b> (cooperate first, then copy your opponent), won.</p>
<p>Here every pair of strategies plays a full match, with each move flipped by mistake at the given rate, to build the payoff matrix. Then strategies reproduce in proportion to how well they do against the current population (replicator dynamics), with occasional mutants. In <b>spatial</b> mode each cell plays its 8 neighbours and copies the best-scoring one, so cooperators can survive in clusters even when defection pays. Things to try: noise lets <b>Pavlov</b> and <b>Generous TFT</b> beat plain TFT; very short matches hand the world to defectors; a world of naive cooperators is an open door for <b>Always defect</b>.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const inc: number[] = [];
    for (let i = 0; i < NS; i++) if (P[`e${i}`]) inc.push(i);
    if (!inc.length) inc.push(0, 1, 2);
    const M = new Float64Array(NS * NS);
    const computeMatrix = () => {
      const R = P.rounds as number, e = P.noise as number;
      const pay = [[P.R as number, P.Sk as number], [P.T as number, P.P as number]];
      const reps = thumbnail ? 3 : 12;
      for (const a of inc) for (const b of inc) {
        if (b < a) continue;
        let sa = 0, sb = 0;
        for (let r = 0; r < reps; r++) {
          let ma = 0, mb = 0, ma2 = 0, mb2 = 0, aD = 0, bD = 0;
          for (let t = 0; t < R; t++) {
            let x = decide(a, t, ma, mb, mb2, bD), y = decide(b, t, mb, ma, ma2, aD);
            if (Math.random() < e) x ^= 1;
            if (Math.random() < e) y ^= 1;
            sa += pay[x][y]; sb += pay[y][x];
            ma2 = ma; mb2 = mb; ma = x; mb = y;
            if (x) aD = 1;
            if (y) bD = 1;
          }
        }
        M[a * NS + b] = sa / (reps * R); M[b * NS + a] = sb / (reps * R);
      }
    };
    computeMatrix();

    const spatial = P.mode === 'spatial' && !thumbnail;
    const side = thumbnail ? 0 : 250;
    const x = new Float64Array(NS);
    const hist: Float32Array[] = [];
    const HMAX = 500;
    let gen = 0, fbar = 0;
    // spatial grid
    const cs = P.cell as number;
    const gw = spatial ? Math.floor((W - side - 16) / cs) : 1, gh = spatial ? Math.floor(H / cs) : 1, G = gw * gh;
    const g = new Uint8Array(G), g2 = new Uint8Array(G), pay = new Float32Array(G);
    const randomize = () => {
      x.fill(0);
      for (const i of inc) x[i] = 1 / inc.length;
      for (let i = 0; i < G; i++) g[i] = inc[(Math.random() * inc.length) | 0];
      hist.length = 0; gen = 0;
    };
    randomize();
    const shares = () => {
      if (!spatial) return x;
      const c = new Float64Array(NS);
      for (let i = 0; i < G; i++) c[g[i]]++;
      for (let i = 0; i < NS; i++) c[i] /= G;
      return c;
    };
    const record = () => {
      const s = shares();
      hist.push(Float32Array.from(s));
      if (hist.length > HMAX) hist.shift();
      fbar = 0;
      if (spatial) {
        for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
          const c = g[yy * gw + xx];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
            if (dx || dy) fbar += M[c * NS + g[((yy + dy + gh) % gh) * gw + ((xx + dx + gw) % gw)]];
        }
        fbar /= 8 * G;
      } else for (const i of inc) for (const j of inc) fbar += s[i] * s[j] * M[i * NS + j];
    };
    record();
    const step = () => {
      gen++;
      const mu = P.mut as number;
      if (!spatial) {
        const f = new Float64Array(NS);
        let fb = 0;
        for (const i of inc) { for (const j of inc) f[i] += x[j] * M[i * NS + j]; fb += x[i] * f[i]; }
        let tot = 0;
        for (const i of inc) { x[i] *= Math.exp((P.sel as number) * 0.15 * (f[i] - fb)); tot += x[i]; }
        for (const i of inc) x[i] = (1 - mu) * (x[i] / tot) + mu / inc.length;
      } else {
        for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
          const i = yy * gw + xx, s = g[i];
          let p = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const j = ((yy + dy + gh) % gh) * gw + ((xx + dx + gw) % gw);
            if (dx || dy) p += M[s * NS + g[j]];
          }
          pay[i] = p;
        }
        const u = P.upd as number, sel = P.sel as number;
        for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
          const i = yy * gw + xx;
          g2[i] = g[i];
          if (Math.random() > u) continue;
          if (Math.random() < mu) { g2[i] = inc[(Math.random() * inc.length) | 0]; continue; }
          let best = i, bp = pay[i] + (Math.random() - 0.5) / sel;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = ((yy + dy + gh) % gh) * gw + ((xx + dx + gw) % gw);
            const pj = pay[j] + (Math.random() - 0.5) / sel;
            if (pj > bp) { bp = pj; best = j; }
          }
          g2[i] = g[best];
        }
        g.set(g2);
      }
      record();
    };

    const drawStack = (x0: number, y0: number, w: number, h: number) => {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x0, y0, w, h);
      const n = hist.length;
      if (n < 2) return;
      const cum = new Float32Array(n);
      for (const s of inc) {
        ctx.beginPath();
        for (let t = 0; t < n; t++) { const px = x0 + (t / (HMAX - 1)) * w; ctx.lineTo(px, y0 + h - (cum[t] + hist[t][s]) * h); }
        for (let t = n - 1; t >= 0; t--) { const px = x0 + (t / (HMAX - 1)) * w; ctx.lineTo(px, y0 + h - cum[t] * h); }
        ctx.closePath(); ctx.fillStyle = S[s].col; ctx.fill();
        for (let t = 0; t < n; t++) cum[t] += hist[t][s];
      }
    };
    const buf = spatial ? new PixelBuffer(gw, gh) : null;
    const draw = () => {
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
      if (thumbnail) { drawStack(0, 0, W, H); return; }
      const sh = shares();
      if (spatial && buf) {
        const d = buf.data;
        for (let i = 0; i < G; i++) { const c = RGB[g[i]]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
        buf.blit(ctx, gw * cs, gh * cs);
      } else {
        drawStack(24, 84, W - side - 48, H - 130);
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(`Population share over the last ${HMAX} generations`, 24, H - 28);
      }
      // legend
      const lx = W - side, order = [...inc].sort((a, b) => sh[b] - sh[a]);
      ctx.fillStyle = 'rgba(5,7,13,0.8)'; ctx.fillRect(lx - 8, 70, side, 24 + order.length * 22);
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1'; ctx.fillText(`Generation ${gen} · mean payoff ${fbar.toFixed(2)}`, lx, 88);
      order.forEach((s, k) => {
        const y = 104 + k * 22;
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(lx, y, side - 24, 16);
        ctx.fillStyle = S[s].col; ctx.globalAlpha = 0.55; ctx.fillRect(lx, y, (side - 24) * sh[s], 16); ctx.globalAlpha = 1;
        ctx.fillStyle = '#f8fafc'; ctx.fillText(S[s].name, lx + 6, y + 12);
        ctx.textAlign = 'right'; ctx.fillText(`${(sh[s] * 100).toFixed(1)}%`, lx + side - 30, y + 12); ctx.textAlign = 'start';
      });
      let my = 104 + order.length * 22 + 16;
      if (spatial) { drawStack(lx, my, side - 24, 90); my += 106; }
      if (P.matrix) {
        const n = inc.length, sz = Math.min(18, (side - 60) / n);
        let lo = 1e9, hi = -1e9;
        for (const a of inc) for (const b of inc) { const v = M[a * NS + b]; if (v < lo) lo = v; if (v > hi) hi = v; }
        ctx.fillStyle = 'rgba(5,7,13,0.8)'; ctx.fillRect(lx - 8, my - 4, side, n * sz + 40);
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('Avg payoff per round: row vs column', lx, my + 8);
        inc.forEach((a, r) => {
          ctx.fillStyle = S[a].col; ctx.fillRect(lx, my + 16 + r * sz, 8, sz - 1);
          ctx.fillRect(lx + 14 + r * sz, my + 16 + n * sz + 2, sz - 1, 4);
          inc.forEach((b, c) => {
            const v = (M[a * NS + b] - lo) / (hi - lo || 1);
            ctx.fillStyle = `hsl(${v * 130}, 70%, ${22 + v * 30}%)`;
            ctx.fillRect(lx + 14 + c * sz, my + 16 + r * sz, sz - 1, sz - 1);
          });
        });
      }
    };
    const invade = () => {
      const s = +(P.brush as string);
      if (!inc.includes(s)) return;
      if (!spatial) { x[s] += 0.05; let t = 0; for (let i = 0; i < NS; i++) t += x[i]; for (let i = 0; i < NS; i++) x[i] /= t; }
      else for (let i = 0; i < G; i++) if (Math.random() < 0.05) g[i] = s;
    };
    return {
      step, draw,
      paramChanged(k) { if (['rounds', 'noise', 'T', 'R', 'P', 'Sk'].includes(k)) computeMatrix(); },
      pointer(p) {
        if (!spatial || !p.down) return;
        const s = +(P.brush as string), cx = (p.x / cs) | 0, cy = (p.y / cs) | 0;
        if (!inc.includes(s)) return;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && yy >= 0 && xx < gw && yy < gh && dx * dx + dy * dy <= 9) g[yy * gw + xx] = s;
        }
      },
      stats: () => {
        const sh = shares();
        const top = [...inc].sort((a, b) => sh[b] - sh[a])[0];
        return [['Generation', gen], ['Leader', `${S[top].id} ${(sh[top] * 100).toFixed(0)}%`], ['Mean payoff', fbar.toFixed(2)]];
      },
      actions: [
        { label: 'Reshuffle population', run: randomize },
        { label: 'Invade with brush strategy', run: invade },
      ],
    };
  },
};
