import type { SimDef } from '../core/types';
import { TAU, rand } from '../core/util';

type Q = { x: number; y: number; q: number; vx: number; vy: number };

export const charges: SimDef = {
  id: 'charges',
  title: 'Electric Field Lines',
  tagline: 'Drag point charges around and watch field lines, equipotentials and test particles reorganise in real time.',
  category: 'Cosmos & Mechanics',
  accent: '#facc15',
  controls: 'Drag charges · click empty space to add + · shift-click adds − · right-click removes',
  thumbSteps: 30,
  params: [
    { type: 'select', key: 'setup', label: 'Setup', default: 'dipole', reset: true, options: [{ value: 'dipole', label: 'Dipole' }, { value: 'quad', label: 'Quadrupole' }, { value: 'like', label: 'Two like charges' }, { value: 'capacitor', label: 'Capacitor plates' }, { value: 'random', label: 'Random' }] },
    { key: 'lines', label: 'Lines per unit charge', min: 4, max: 40, step: 1, default: 16 },
    { type: 'toggle', key: 'potential', label: 'Show potential', default: true },
    { key: 'contours', label: 'Equipotential lines', min: 0, max: 40, step: 1, default: 16 },
    { key: 'particles', label: 'Test particles', min: 0, max: 1500, step: 10, default: 400, reset: true },
    { type: 'toggle', key: 'move', label: 'Charges feel each other', default: false },
  ],
  presets: [
    { name: 'Dipole', values: { setup: 'dipole' } },
    { name: 'Quadrupole', values: { setup: 'quad' } },
    { name: 'Like charges', values: { setup: 'like' } },
    { name: 'Capacitor', values: { setup: 'capacitor', lines: 6 } },
    { name: 'Dancing charges', values: { setup: 'random', move: true } },
  ],
  about: `<p>Each point charge q creates a field E = k·q·r̂ / r², and fields simply add (superposition). <b>Field lines</b> are traced from positive charges by following E; their density shows field strength, and they end on negative charges or escape to infinity.</p>
<p>The background colour is the electric <b>potential</b> V = Σ k·q/r (warm = positive, cool = negative) and the thin contours are equipotentials, always perpendicular to the field lines. Tiny test particles drift along E, revealing the flow. Enable "charges feel each other" and opposite charges orbit and collide while like charges fly apart.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const Qs: Q[] = [];
    const add = (x: number, y: number, q: number) => Qs.push({ x, y, q, vx: 0, vy: 0 });
    const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.18;
    switch (P.setup) {
      case 'dipole': add(cx - s, cy, 1); add(cx + s, cy, -1); break;
      case 'quad': add(cx - s, cy - s, 1); add(cx + s, cy + s, 1); add(cx + s, cy - s, -1); add(cx - s, cy + s, -1); break;
      case 'like': add(cx - s, cy, 1); add(cx + s, cy, 1); break;
      case 'capacitor': for (let k = -4; k <= 4; k++) { add(cx - s, cy + k * s * 0.25, 0.5); add(cx + s, cy + k * s * 0.25, -0.5); } break;
      default: for (let k = 0; k < 6; k++) add(rand(W * 0.2, W * 0.8), rand(H * 0.2, H * 0.8), k % 2 ? -1 : 1);
    }
    const field = (x: number, y: number, o: number[]) => {
      let ex = 0, ey = 0, v = 0;
      for (const c of Qs) { const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + 25, r = Math.sqrt(r2); ex += (c.q * dx) / (r2 * r); ey += (c.q * dy) / (r2 * r); v += c.q / r; }
      o[0] = ex; o[1] = ey; o[2] = v;
    };
    const NP = thumbnail ? 200 : (P.particles as number);
    const tx = new Float32Array(NP), ty = new Float32Array(NP), age = new Float32Array(NP);
    for (let i = 0; i < NP; i++) { tx[i] = rand(W); ty[i] = rand(H); age[i] = rand(200); }
    const o = [0, 0, 0];
    const ps = 4, pw = Math.ceil(W / ps), ph = Math.ceil(H / ps);
    const off = document.createElement('canvas'); off.width = pw; off.height = ph;
    const octx = off.getContext('2d')!; const img = octx.createImageData(pw, ph);
    let dragging: Q | null = null;
    const step = () => {
      if (P.move) {
        for (const a of Qs) {
          if (a === dragging) continue;
          let ax = 0, ay = 0;
          for (const b of Qs) { if (a === b) continue; const dx = a.x - b.x, dy = a.y - b.y, r2 = dx * dx + dy * dy + 400, r = Math.sqrt(r2); ax += (a.q * b.q * dx) / (r2 * r) * 300; ay += (a.q * b.q * dy) / (r2 * r) * 300; }
          a.vx = (a.vx + ax) * 0.995; a.vy = (a.vy + ay) * 0.995;
        }
        for (const a of Qs) { if (a === dragging) continue; a.x += a.vx; a.y += a.vy; if (a.x < 10 || a.x > W - 10) a.vx *= -1; if (a.y < 10 || a.y > H - 10) a.vy *= -1; a.x = Math.max(10, Math.min(W - 10, a.x)); a.y = Math.max(10, Math.min(H - 10, a.y)); }
      }
      for (let i = 0; i < NP; i++) {
        field(tx[i], ty[i], o);
        const m = Math.hypot(o[0], o[1]) + 1e-9, sp = Math.min(3, m * 4000);
        tx[i] += (o[0] / m) * sp; ty[i] += (o[1] / m) * sp; age[i]++;
        let dead = age[i] > 300 || tx[i] < 0 || ty[i] < 0 || tx[i] > W || ty[i] > H;
        for (const c of Qs) if (c.q < 0 && (tx[i] - c.x) ** 2 + (ty[i] - c.y) ** 2 < 64) dead = true;
        if (dead) {
          const pos = Qs.filter((c) => c.q > 0);
          if (pos.length && Math.random() < 0.7) { const c = pos[(Math.random() * pos.length) | 0], a = rand(TAU); tx[i] = c.x + Math.cos(a) * 10; ty[i] = c.y + Math.sin(a) * 10; }
          else { tx[i] = rand(W); ty[i] = rand(H); }
          age[i] = 0;
        }
      }
    };
    const draw = () => {
      const showV = P.potential as boolean, nc = P.contours as number, d = img.data;
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
        field(i * ps + ps / 2, j * ps + ps / 2, o);
        const v = o[2] * 40, t = Math.tanh(v), k = (j * pw + i) * 4;
        let r = 6, g = 8, b = 16;
        if (showV) { if (t > 0) { r += 150 * t; g += 50 * t; } else { b += 170 * -t; g += 60 * -t; } }
        if (nc) { const ph2 = Math.abs(((t * nc) % 1 + 1) % 1 - 0.5); if (ph2 > 0.475) { r += 35; g += 35; b += 35; } }
        d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
      const lpc = P.lines as number;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const c of Qs) {
        if (c.q <= 0) continue;
        const n = Math.max(2, Math.round(lpc * c.q));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU;
          let x = c.x + Math.cos(a) * 8, y = c.y + Math.sin(a) * 8;
          ctx.moveTo(x, y);
          for (let st = 0; st < 600; st++) {
            field(x, y, o); let m = Math.hypot(o[0], o[1]) + 1e-12;
            const hx = x + (o[0] / m) * 2, hy = y + (o[1] / m) * 2;
            field(hx, hy, o); m = Math.hypot(o[0], o[1]) + 1e-12;
            x += (o[0] / m) * 4; y += (o[1] / m) * 4;
            ctx.lineTo(x, y);
            if (x < -50 || y < -50 || x > W + 50 || y > H + 50) break;
            let hit = false; for (const q of Qs) if (q.q < 0 && (x - q.x) ** 2 + (y - q.y) ** 2 < 49) hit = true;
            if (hit) break;
          }
        }
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(253,224,71,0.85)';
      for (let i = 0; i < NP; i++) ctx.fillRect(tx[i] - 1, ty[i] - 1, 2, 2);
      for (const c of Qs) {
        ctx.fillStyle = c.q > 0 ? '#ef4444' : '#3b82f6';
        ctx.beginPath(); ctx.arc(c.x, c.y, 6 + 6 * Math.abs(c.q), 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px ui-sans-serif, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(c.q > 0 ? '+' : '−', c.x, c.y + 1);
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    };
    const hit = (x: number, y: number) => Qs.find((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < 18 * 18) ?? null;
    return {
      step, draw,
      pointer(p) {
        if (p.type === 'down') {
          const h = hit(p.x, p.y);
          if (p.button === 2) { if (h) Qs.splice(Qs.indexOf(h), 1); return; }
          if (h) dragging = h; else add(p.x, p.y, p.shift ? -1 : 1);
        }
        if (p.type === 'move' && dragging) { dragging.x = p.x; dragging.y = p.y; dragging.vx = dragging.vy = 0; }
        if (p.type === 'up') dragging = null;
      },
      stats: () => [['Charges', Qs.length], ['Net charge', Qs.reduce((s, c) => s + c.q, 0)]],
      actions: [{ label: 'Remove all', run: () => { Qs.length = 0; } }, { label: 'Flip all signs', run: () => Qs.forEach((c) => (c.q = -c.q)) }],
    };
  },
};
