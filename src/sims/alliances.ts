import type { SimDef } from '../core/types';
import { History, TAU, clamp, gauss, rand } from '../core/util';

const SYL = ['ar', 'bel', 'cor', 'dra', 'el', 'fen', 'gal', 'hav', 'is', 'jor', 'kal', 'lum', 'mor', 'nor', 'ost', 'pra', 'quel', 'ros', 'sar', 'tor', 'ul', 'var', 'wen', 'yr', 'zan'];
const nameOf = (i: number) => {
  const a = SYL[(i * 7) % SYL.length], b = SYL[(i * 13 + 5) % SYL.length];
  return (a + b).replace(/^./, (c) => c.toUpperCase());
};

export const alliances: SimDef = {
  id: 'alliances',
  title: 'Alliance Network',
  tagline: '“The enemy of my enemy is my friend” — a web of rivalries relaxes into two hostile blocs.',
  category: 'Societies',
  accent: '#a3e635',
  controls: 'Drag nations around · shift-click a nation to make it switch sides · right-click to make everyone hate it',
  thumbSteps: 300,
  params: [
    { key: 'n', label: 'Nations', min: 4, max: 60, step: 1, default: 22, reset: true },
    { key: 'bias', label: 'Initial friendliness', min: -0.6, max: 0.6, step: 0.01, default: 0, reset: true },
    { key: 'spread', label: 'Initial variety', min: 0.05, max: 1, step: 0.01, default: 0.5, reset: true },
    { key: 'rate', label: 'Pressure to balance', min: 0, max: 4, step: 0.05, default: 1 },
    { key: 'noise', label: 'Diplomatic noise', min: 0, max: 0.3, step: 0.005, default: 0.01 },
    { key: 'memory', label: 'Grudges fade', min: 0, max: 0.05, step: 0.001, default: 0, hint: 'Pulls every relation back toward neutral' },
    { key: 'show', label: 'Hide relations weaker than', min: 0, max: 0.95, step: 0.01, default: 0.2 },
    { type: 'toggle', key: 'hostile', label: 'Show hostile links', default: true },
  ],
  presets: [
    { name: 'Two blocs', values: {} },
    { name: 'Friendly world', values: { bias: 0.3 } },
    { name: 'Hostile world', values: { bias: -0.35 } },
    { name: 'Restless (noisy, forgetful)', values: { noise: 0.12, memory: 0.01 } },
    { name: 'Great powers (6)', values: { n: 6, spread: 0.8 } },
    { name: 'Crowded (50)', values: { n: 50, show: 0.5 } },
  ],
  about: `<p>Heider's <b>structural balance</b> theory: a triangle of relationships is stable when the product of its signs is positive — friend of a friend is a friend, enemy of an enemy is a friend. Unbalanced triangles (three mutual enemies, or two friends who both hate a third's friend) create pressure to change.</p>
<p>Each relation <i>w<sub>ij</sub></i> ∈ [−1, 1] evolves by the Kułakowski–Gawroński rule <i>dw<sub>ij</sub>/dt = (1 − w<sub>ij</sub>²) Σ<sub>k</sub> w<sub>ik</sub> w<sub>kj</sub></i>. Almost any starting web ends up as <b>two blocs</b>, all friends inside and enemies across — the Cold-War outcome — or one grand alliance if everyone starts friendly. Nations are coloured by the leading eigenvector of the relation matrix; positions come from a spring layout where friends pull together and enemies push apart. Try turning a nation traitor, or creating a common enemy and watching rivals unite against it.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const N = P.n as number;
    const w = new Float32Array(N * N);
    const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    const ev = new Float32Array(N).map(() => rand(-1, 1));
    const flash = new Float32Array(N);
    const randomize = () => {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const v = clamp((P.bias as number) + gauss() * (P.spread as number), -0.98, 0.98);
        w[i * N + j] = w[j * N + i] = v;
      }
    };
    randomize();
    const R = Math.min(W, H) * 0.38;
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU; px[i] = W / 2 + Math.cos(a) * R; py[i] = H / 2 + Math.sin(a) * R; }
    const hist = new History(['Balanced triads %', 'Largest bloc %'], ['#a3e635', '#38bdf8'], 400);
    let balanced = 0, bloc = 0, frame = 0, drag = -1;
    const tmp = new Float32Array(N * N);

    const measure = () => {
      // leading eigenvector by power iteration (shifted to keep it positive definite-ish)
      const v = ev;
      for (let it = 0; it < 12; it++) {
        const nv = new Float32Array(N);
        let norm = 0;
        for (let i = 0; i < N; i++) { let s = 2 * v[i]; for (let j = 0; j < N; j++) s += w[i * N + j] * v[j]; nv[i] = s; norm += s * s; }
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < N; i++) v[i] = nv[i] / norm;
      }
      let pos = 0;
      for (let i = 0; i < N; i++) if (v[i] >= 0) pos++;
      bloc = (Math.max(pos, N - pos) / N) * 100;
      let tot = 0, bal = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = w[i * N + j];
        for (let k = j + 1; k < N; k++) { tot++; if (a * w[j * N + k] * w[i * N + k] > 0) bal++; }
      }
      balanced = tot ? (bal / tot) * 100 : 100;
    };

    const step = () => {
      frame++;
      const dt = 0.04 * (P.rate as number), nz = P.noise as number, mem = P.memory as number;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let s = 0;
        for (let k = 0; k < N; k++) if (k !== i && k !== j) s += w[i * N + k] * w[k * N + j];
        const v = w[i * N + j];
        tmp[i * N + j] = clamp(v + dt * (1 - v * v) * (s / Math.max(1, N - 2)) * 3 + nz * gauss() * 0.1 - mem * v, -0.999, 0.999);
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) w[i * N + j] = w[j * N + i] = tmp[i * N + j];
      // layout
      const L = Math.min(W, H);
      for (let i = 0; i < N; i++) {
        let fx = (W / 2 - px[i]) * 0.002, fy = (H / 2 - py[i]) * 0.002;
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i], d = Math.hypot(dx, dy) + 0.01;
          const rel = w[i * N + j];
          const rest = rel > 0 ? L * (0.2 + 0.15 * (1 - rel)) * Math.sqrt(20 / Math.max(N, 8)) : L * (0.5 - 0.1 * rel);
          const k = (0.25 + Math.abs(rel)) * 0.004;
          fx += (dx / d) * (d - rest) * k; fy += (dy / d) * (d - rest) * k;
          if (d < 55) { fx -= (dx / d) * (55 - d) * 0.04; fy -= (dy / d) * (55 - d) * 0.04; }
        }
        vx[i] = (vx[i] + fx) * 0.85; vy[i] = (vy[i] + fy) * 0.85;
      }
      for (let i = 0; i < N; i++) {
        if (i === drag) continue;
        px[i] = clamp(px[i] + vx[i], 20, W - 20); py[i] = clamp(py[i] + vy[i], 20, H - 20);
        flash[i] *= 0.96;
      }
      if (frame % 3 === 0) { measure(); hist.push(balanced, bloc); }
    };
    measure();

    const draw = () => {
      ctx.fillStyle = '#060a0d'; ctx.fillRect(0, 0, W, H);
      const th = P.show as number;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const v = w[i * N + j];
        if (Math.abs(v) < th) continue;
        if (v < 0 && !P.hostile) continue;
        const a = ((Math.abs(v) - th) / (1 - th + 1e-6)) * 0.55 + 0.05;
        ctx.strokeStyle = v > 0 ? `rgba(163,230,53,${a})` : `rgba(248,113,113,${a * 0.6})`;
        if (v < 0) ctx.setLineDash([4, 5]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[j], py[j]); ctx.stroke();
      }
      ctx.setLineDash([]);
      let mx = 1e-6;
      for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(ev[i]));
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < N; i++) {
        const t = ev[i] / mx;
        const col = t >= 0 ? `hsl(200,85%,${45 + 20 * t}%)` : `hsl(28,95%,${45 - 20 * t}%)`;
        const r = thumbnail ? 5 : 8;
        if (flash[i] > 0.05) {
          ctx.fillStyle = `rgba(255,255,255,${flash[i] * 0.5})`;
          ctx.beginPath(); ctx.arc(px[i], py[i], r + 10 * flash[i], 0, TAU); ctx.fill();
        }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (!thumbnail && N <= 30) { ctx.fillStyle = 'rgba(226,232,240,0.75)'; ctx.fillText(nameOf(i), px[i], py[i] - r - 5); }
      }
      ctx.textAlign = 'start';
      if (!thumbnail) hist.draw(ctx, W - 290, H - 92, 278, 80, { yMax: 100 });
    };

    const pick = (x: number, y: number) => {
      let b = -1, bd = 400;
      for (let i = 0; i < N; i++) { const d = (px[i] - x) ** 2 + (py[i] - y) ** 2; if (d < bd) { bd = d; b = i; } }
      return b;
    };
    return {
      step, draw,
      pointer(p) {
        if (p.type === 'down') {
          const i = pick(p.x, p.y);
          if (i < 0) return;
          if (p.button === 2) {
            for (let j = 0; j < N; j++) if (j !== i) w[i * N + j] = w[j * N + i] = -0.95;
            flash[i] = 1;
          } else if (p.shift) {
            for (let j = 0; j < N; j++) if (j !== i) w[i * N + j] = w[j * N + i] = -w[i * N + j];
            flash[i] = 1;
          } else drag = i;
        } else if (p.type === 'move' && drag >= 0 && p.down) { px[drag] = p.x; py[drag] = p.y; vx[drag] = vy[drag] = 0; }
        else if (p.type === 'up') drag = -1;
      },
      stats: () => {
        let f = 0, e = 0;
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const v = w[i * N + j]; if (v > 0.5) f++; else if (v < -0.5) e++; }
        return [['Balanced triangles', `${balanced.toFixed(1)}%`], ['Largest bloc', `${bloc.toFixed(0)}%`], ['Strong friendships', f], ['Strong enmities', e]];
      },
      actions: [
        { label: 'Reshuffle relations', run: randomize },
        { label: 'Diplomatic shock', run: () => { for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) w[i * N + j] = w[j * N + i] = clamp(w[i * N + j] + gauss() * 0.6, -0.98, 0.98); } },
        { label: 'Random traitor', run: () => { const i = (Math.random() * N) | 0; for (let j = 0; j < N; j++) if (j !== i) w[i * N + j] = w[j * N + i] = -w[i * N + j]; flash[i] = 1; } },
      ],
    };
  },
};
