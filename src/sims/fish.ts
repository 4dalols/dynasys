import type { SimDef } from '../core/types';
import { SpatialGrid, TAU, rand } from '../core/util';

export const fish: SimDef = {
  id: 'fish',
  title: 'Fish School',
  tagline: 'Boids with predators: separation, alignment and cohesion produce shoals, bait balls and fountain escapes.',
  category: 'Swarms & Life',
  accent: '#38bdf8',
  controls: 'Click/drag to use the selected tool · sharks hunt automatically',
  thumbSteps: 260,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'food', options: [
      { value: 'food', label: 'Drop food' }, { value: 'scare', label: 'Scare' }, { value: 'shark', label: 'Add shark' } ] },
    { type: 'group', label: 'School' },
    { key: 'count', label: 'Fish', min: 20, max: 2500, step: 10, default: 700, reset: true },
    { key: 'speed', label: 'Max speed', min: 0.5, max: 6, step: 0.1, default: 2.6 },
    { key: 'vision', label: 'Vision radius', min: 10, max: 120, step: 1, default: 46 },
    { key: 'fov', label: 'Field of view', min: 60, max: 360, step: 5, default: 280, fmt: (v) => `${v}°` },
    { type: 'group', label: 'Rules' },
    { key: 'separation', label: 'Separation', min: 0, max: 5, step: 0.05, default: 1.6 },
    { key: 'sepDist', label: 'Personal space', min: 4, max: 60, step: 1, default: 16 },
    { key: 'alignment', label: 'Alignment', min: 0, max: 3, step: 0.05, default: 1 },
    { key: 'cohesion', label: 'Cohesion', min: 0, max: 3, step: 0.05, default: 0.8 },
    { key: 'noise', label: 'Wander', min: 0, max: 1, step: 0.01, default: 0.1 },
    { type: 'group', label: 'Predators' },
    { key: 'sharks', label: 'Sharks', min: 0, max: 8, step: 1, default: 1 },
    { key: 'fear', label: 'Fear', min: 0, max: 8, step: 0.1, default: 3.5 },
    { key: 'sharkSpeed', label: 'Shark speed', min: 0.5, max: 5, step: 0.1, default: 2.2 },
    { type: 'group', label: 'Look' },
    { type: 'toggle', key: 'wrap', label: 'Wrap edges', default: true },
    { type: 'toggle', key: 'trails', label: 'Trails', default: false },
    { type: 'select', key: 'colorBy', label: 'Color by', default: 'heading', options: [
      { value: 'heading', label: 'Heading' }, { value: 'crowd', label: 'Crowding' }, { value: 'mono', label: 'Silver' } ] },
  ],
  presets: [
    { name: 'Tight shoal', values: { cohesion: 1.8, alignment: 1.6, separation: 1.2, sepDist: 12, sharks: 0 } },
    { name: 'Bait ball', values: { cohesion: 2.6, alignment: 0.4, separation: 1.4, vision: 70, sharks: 3, fear: 5 } },
    { name: 'Loose swarm', values: { cohesion: 0.2, alignment: 0.3, separation: 2, noise: 0.5, sharks: 0 } },
    { name: 'Torus mill', values: { cohesion: 1.4, alignment: 2.2, fov: 180, vision: 60, sharks: 0, count: 900 } },
    { name: 'Shark frenzy', values: { sharks: 6, fear: 7, sharkSpeed: 3, count: 1200 } },
  ],
  about: `<p>Each fish follows three local rules from Craig Reynolds' <b>boids</b> (1987): steer away from neighbours that are too close (<b>separation</b>), match their heading (<b>alignment</b>), and drift toward their centre (<b>cohesion</b>). Nobody leads the school.</p>
<p>Sharks chase the nearest fish; fish inside their scare radius flee, which produces the "flash expansion" and "fountain" escapes seen in real shoals. Narrow the field of view and boost alignment to get a rotating <b>mill</b>.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const N = P.count as number;
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    const crowd = new Float32Array(N), phase = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = rand(W); y[i] = rand(H);
      const a = rand(TAU);
      vx[i] = Math.cos(a) * 2; vy[i] = Math.sin(a) * 2;
      phase[i] = rand(TAU);
    }
    type Shark = { x: number; y: number; vx: number; vy: number; phase: number };
    const sharks: Shark[] = [];
    const addShark = (sx = rand(W), sy = rand(H)) => sharks.push({ x: sx, y: sy, vx: rand(-1, 1), vy: rand(-1, 1), phase: 0 });
    for (let i = 0; i < P.sharks; i++) addShark();
    const food: { x: number; y: number; life: number }[] = [];
    if (thumbnail) for (let i = 0; i < 3; i++) food.push({ x: rand(W), y: rand(H), life: 1 });
    const grid = new SpatialGrid(W, H, P.vision);
    let mouse: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
    let eaten = 0;
    const wrapD = (d: number, L: number) => (P.wrap ? (d > L / 2 ? d - L : d < -L / 2 ? d + L : d) : d);

    const step = () => {
      if (grid.cell !== Math.max(4, P.vision)) grid.resize(W, H, P.vision);
      grid.build(x, y, N);
      const vis = P.vision, vis2 = vis * vis, sd2 = P.sepDist * P.sepDist;
      const cosFov = Math.cos(((P.fov as number) / 2) * (Math.PI / 180));
      const maxS = P.speed as number;
      for (let i = 0; i < N; i++) {
        let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
        const xi = x[i], yi = y[i], vi = Math.hypot(vx[i], vy[i]) || 1;
        const hx = vx[i] / vi, hy = vy[i] / vi;
        grid.query(xi, yi, vis, (j) => {
          if (j === i) return;
          const dx = wrapD(x[j] - xi, W), dy = wrapD(y[j] - yi, H);
          const d2 = dx * dx + dy * dy;
          if (d2 > vis2 || d2 === 0) return;
          const d = Math.sqrt(d2);
          if (P.fov < 360 && (dx * hx + dy * hy) / d < cosFov) return;
          n++;
          ax += vx[j]; ay += vy[j];
          cx += dx; cy += dy;
          if (d2 < sd2) { sx -= dx / d2; sy -= dy / d2; }
        }, P.wrap);
        crowd[i] = crowd[i] * 0.9 + n * 0.1;
        let fx = 0, fy = 0;
        if (n > 0) {
          fx += (ax / n - vx[i]) * 0.05 * P.alignment;
          fy += (ay / n - vy[i]) * 0.05 * P.alignment;
          fx += (cx / n) * 0.0025 * P.cohesion;
          fy += (cy / n) * 0.0025 * P.cohesion;
          fx += sx * 1.2 * P.separation;
          fy += sy * 1.2 * P.separation;
        }
        // predators
        let panic = 0;
        for (const s of sharks) {
          const dx = wrapD(xi - s.x, W), dy = wrapD(yi - s.y, H);
          const d2 = dx * dx + dy * dy, R = 90;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1, k = (1 - d / R) * P.fear * 0.25;
            fx += (dx / d) * k; fy += (dy / d) * k;
            panic = Math.max(panic, 1 - d / R);
          }
        }
        if (mouse.active && P.tool === 'scare') {
          const dx = xi - mouse.x, dy = yi - mouse.y, d2 = dx * dx + dy * dy, R = 120;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1, k = (1 - d / R) * 1.2; fx += (dx / d) * k; fy += (dy / d) * k; panic = 1; }
        }
        // food
        for (const f of food) {
          const dx = f.x - xi, dy = f.y - yi, d2 = dx * dx + dy * dy;
          if (d2 < 220 * 220) {
            const d = Math.sqrt(d2) || 1;
            fx += (dx / d) * 0.08; fy += (dy / d) * 0.08;
            if (d < 5) f.life -= 0.01;
          }
        }
        if (!P.wrap) {
          const m = 40, k = 0.15;
          if (xi < m) fx += k * (1 - xi / m); if (xi > W - m) fx -= k * (1 - (W - xi) / m);
          if (yi < m) fy += k * (1 - yi / m); if (yi > H - m) fy -= k * (1 - (H - yi) / m);
        }
        const a = rand(TAU);
        fx += Math.cos(a) * P.noise * 0.3; fy += Math.sin(a) * P.noise * 0.3;
        vx[i] += fx; vy[i] += fy;
        const sp = Math.hypot(vx[i], vy[i]);
        const lim = maxS * (1 + panic * 0.8), minS = maxS * 0.35;
        if (sp > lim) { vx[i] *= lim / sp; vy[i] *= lim / sp; }
        else if (sp < minS && sp > 0) { vx[i] *= minS / sp; vy[i] *= minS / sp; }
        phase[i] += 0.25 + sp * 0.12;
      }
      for (let i = 0; i < N; i++) {
        x[i] += vx[i]; y[i] += vy[i];
        if (P.wrap) { x[i] = (x[i] + W) % W; y[i] = (y[i] + H) % H; }
        else { x[i] = Math.min(W - 1, Math.max(0, x[i])); y[i] = Math.min(H - 1, Math.max(0, y[i])); }
      }
      // sharks
      while (sharks.length < P.sharks) addShark();
      while (sharks.length > P.sharks) sharks.pop();
      for (const s of sharks) {
        let best = -1, bd = 1e12;
        grid.query(s.x, s.y, 200, (j) => {
          const dx = wrapD(x[j] - s.x, W), dy = wrapD(y[j] - s.y, H), d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = j; }
        }, P.wrap);
        if (best >= 0) {
          const dx = wrapD(x[best] - s.x, W), dy = wrapD(y[best] - s.y, H), d = Math.sqrt(bd) || 1;
          s.vx += (dx / d) * 0.09; s.vy += (dy / d) * 0.09;
          if (d < 8) { eaten++; x[best] = rand(W); y[best] = rand(H); }
        } else { s.vx += rand(-0.1, 0.1); s.vy += rand(-0.1, 0.1); }
        const sp = Math.hypot(s.vx, s.vy), lim = P.sharkSpeed;
        if (sp > lim) { s.vx *= lim / sp; s.vy *= lim / sp; }
        s.x += s.vx; s.y += s.vy; s.phase += 0.15;
        if (P.wrap) { s.x = (s.x + W) % W; s.y = (s.y + H) % H; }
        else { if (s.x < 0 || s.x > W) s.vx *= -1; if (s.y < 0 || s.y > H) s.vy *= -1; }
      }
      for (let k = food.length - 1; k >= 0; k--) {
        food[k].life -= 0.0007;
        if (food[k].life <= 0) food.splice(k, 1);
      }
    };

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04233a');
    bg.addColorStop(1, '#020812');

    const drawFish = (px: number, py: number, hx: number, hy: number, L: number, wig: number) => {
      const nx = -hy, ny = hx, w = L * 0.28;
      const tx = px - hx * L, ty = py - hy * L;
      const tailx = tx - hx * L * 0.35 + nx * wig * L * 0.5, taily = ty - hy * L * 0.35 + ny * wig * L * 0.5;
      ctx.moveTo(px + hx * L * 0.5, py + hy * L * 0.5);
      ctx.quadraticCurveTo(px + nx * w, py + ny * w, tx, ty);
      ctx.lineTo(tailx + nx * w, taily + ny * w);
      ctx.lineTo(tailx - nx * w, taily - ny * w);
      ctx.lineTo(tx, ty);
      ctx.quadraticCurveTo(px - nx * w, py - ny * w, px + hx * L * 0.5, py + hy * L * 0.5);
    };

    const draw = () => {
      if (P.trails) { ctx.fillStyle = 'rgba(3,18,32,0.18)'; ctx.fillRect(0, 0, W, H); }
      else { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
      for (const f of food) {
        ctx.fillStyle = `rgba(250,204,21,${0.3 + f.life * 0.7})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 + f.life * 3, 0, TAU); ctx.fill();
      }
      const L = N > 1500 ? 4 : N > 800 ? 5 : 6.5;
      const buckets = 12;
      for (let b = 0; b < buckets; b++) {
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < N; i++) {
          let key: number;
          if (P.colorBy === 'heading') key = Math.floor(((Math.atan2(vy[i], vx[i]) + Math.PI) / TAU) * buckets) % buckets;
          else if (P.colorBy === 'crowd') key = Math.min(buckets - 1, Math.floor(crowd[i] / 2));
          else key = i % buckets;
          if (key !== b) continue;
          any = true;
          const sp = Math.hypot(vx[i], vy[i]) || 1;
          drawFish(x[i], y[i], vx[i] / sp, vy[i] / sp, L, Math.sin(phase[i]) * 0.4);
        }
        if (!any) continue;
        ctx.fillStyle =
          P.colorBy === 'heading' ? `hsl(${170 + (b / buckets) * 120},80%,68%)`
          : P.colorBy === 'crowd' ? `hsl(${200 - b * 15},85%,${55 + b * 2}%)`
          : `hsl(205,25%,${70 + (b % 4) * 5}%)`;
        ctx.fill();
      }
      ctx.fillStyle = '#94a3b8';
      for (const s of sharks) {
        const sp = Math.hypot(s.vx, s.vy) || 1;
        ctx.beginPath();
        drawFish(s.x, s.y, s.vx / sp, s.vy / sp, 22, Math.sin(s.phase) * 0.3);
        ctx.fill();
        const hx = s.vx / sp, hy = s.vy / sp;
        ctx.beginPath();
        ctx.moveTo(s.x - hx * 6 - hy * 0, s.y - hy * 6);
        ctx.lineTo(s.x - hx * 14 - hy * 10, s.y - hy * 14 + hx * 10);
        ctx.lineTo(s.x - hx * 16, s.y - hy * 16);
        ctx.fill();
      }
      if (mouse.active && P.tool === 'scare') {
        ctx.strokeStyle = 'rgba(248,113,113,0.5)';
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 120, 0, TAU); ctx.stroke();
      }
    };

    let lastDrop = 0;
    return {
      step, draw,
      pointer(p) {
        mouse = { x: p.x, y: p.y, active: p.down };
        if (p.type === 'up') mouse.active = false;
        if (P.tool === 'food' && p.down && performance.now() - lastDrop > 60) {
          lastDrop = performance.now();
          food.push({ x: p.x + rand(-8, 8), y: p.y + rand(-8, 8), life: 1 });
        }
        if (P.tool === 'shark' && p.type === 'down') { P.sharks = Math.min(8, P.sharks + 1); sharks.push({ x: p.x, y: p.y, vx: 0, vy: 0, phase: 0 }); }
      },
      stats: () => [['Fish', N], ['Sharks', sharks.length], ['Eaten', eaten], ['Avg neighbours', crowd.reduce((a, b) => a + b, 0) / N]],
    };
  },
};
