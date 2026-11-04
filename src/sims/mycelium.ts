import type { SimDef } from '../core/types';
import { TAU, rand, stampGrid } from '../core/util';

type Tip = { x: number; y: number; a: number; colony: number; gen: number; energy: number; age: number };

export const mycelium: SimDef = {
  id: 'mycelium',
  title: 'Fungal Mycelium',
  tagline: 'Hyphal tips forage for nutrients, branch, fuse and compete — a living network grows from a few spores.',
  category: 'Growth & Patterns',
  accent: '#e2c48f',
  controls: 'Click to use the selected tool',
  thumbSteps: 500,
  params: [
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'spore', options: [
      { value: 'spore', label: 'Plant spore' }, { value: 'nutrient', label: 'Add nutrients' }, { value: 'toxin', label: 'Fungicide' } ] },
    { key: 'colonies', label: 'Starting colonies', min: 1, max: 8, step: 1, default: 3, reset: true },
    { key: 'richness', label: 'Soil richness', min: 0.1, max: 2, step: 0.05, default: 1, reset: true },
    { type: 'group', label: 'Growth' },
    { key: 'growth', label: 'Tip speed', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'branch', label: 'Branching rate', min: 0, max: 0.08, step: 0.001, default: 0.022 },
    { key: 'branchAngle', label: 'Branch angle', min: 10, max: 90, step: 1, default: 45, fmt: (v) => `${v}°` },
    { key: 'wiggle', label: 'Wiggle', min: 0, max: 0.6, step: 0.01, default: 0.18 },
    { key: 'tropism', label: 'Chemotropism', min: 0, max: 1, step: 0.01, default: 0.35, hint: 'How strongly tips steer toward nutrients' },
    { key: 'avoid', label: 'Self-avoidance', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'maxTips', label: 'Max tips', min: 100, max: 6000, step: 100, default: 2500 },
    { type: 'toggle', key: 'fuse', label: 'Anastomosis (fusion)', default: true },
    { type: 'toggle', key: 'showFood', label: 'Show nutrients', default: true },
  ],
  presets: [
    { name: 'Forager', values: {} },
    { name: 'Dense mat', values: { branch: 0.05, branchAngle: 60, wiggle: 0.3, tropism: 0.1, colonies: 1 } },
    { name: 'Explorer cords', values: { branch: 0.008, wiggle: 0.08, tropism: 0.7, growth: 1.6 } },
    { name: 'Turf war', values: { colonies: 8, branch: 0.03, richness: 0.6 } },
    { name: 'Starved soil', values: { richness: 0.25, tropism: 0.9 } },
  ],
  about: `<p>A fungus is mostly <b>mycelium</b>: a web of tubular hyphae that grow only at their tips. Each tip here is an agent that eats the nutrients beneath it, curves randomly, steers up the nutrient gradient (<b>chemotropism</b>) and avoids crowded soil.</p>
<p>Well-fed tips <b>branch</b>; starving tips stall and die. When a tip runs into an existing hypha of its own colony it <b>fuses</b> (anastomosis), closing loops that make the network robust. Different colonies can't fuse and block each other, carving the soil into territories — like the "fairy rings" and interaction zones seen on rotting logs.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = 4, gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const food = new Float32Array(G), occ = new Int16Array(G).fill(-1), density = new Float32Array(G);
    // patchy nutrients: sum of blobs
    const blobs = Math.round(30 * (W * H) / (1200 * 800)) + 8;
    for (let b = 0; b < blobs; b++) {
      const bx = rand(gw), by = rand(gh), br = rand(4, 22), amt = rand(0.4, 1) * P.richness;
      stampGrid(gw, gh, bx, by, br, (i, f) => (food[i] = Math.min(1.5, food[i] + amt * f)));
    }
    for (let i = 0; i < G; i++) food[i] += 0.15 * P.richness * Math.random();
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const lc = layer.getContext('2d')!;
    lc.lineCap = 'round';
    const hues: number[] = [];
    let tips: Tip[] = [];
    let total = 0, fusions = 0;
    const plant = (x: number, y: number) => {
      const colony = hues.length;
      hues.push((colony * 67 + 30) % 360);
      for (let k = 0; k < 8; k++) tips.push({ x, y, a: (k / 8) * TAU + rand(0.3), colony, gen: 0, energy: 1, age: 0 });
    };
    for (let c = 0; c < P.colonies; c++) plant(rand(W * 0.15, W * 0.85), rand(H * 0.15, H * 0.85));
    const mushrooms: { x: number; y: number; r: number; hue: number }[] = [];

    const foodAt = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return -1;
      const i = ((y / cs) | 0) * gw + ((x / cs) | 0);
      return food[i] - density[i] * P.avoid * 0.5;
    };

    const step = () => {
      const sp = P.growth as number, ba = ((P.branchAngle as number) * Math.PI) / 180;
      const next: Tip[] = [];
      for (const t of tips) {
        t.age++;
        const sd = 10, sa = 0.5;
        const l = foodAt(t.x + Math.cos(t.a - sa) * sd, t.y + Math.sin(t.a - sa) * sd);
        const r = foodAt(t.x + Math.cos(t.a + sa) * sd, t.y + Math.sin(t.a + sa) * sd);
        t.a += (r - l) * P.tropism * 0.8 + (Math.random() - 0.5) * P.wiggle;
        const ox = t.x, oy = t.y;
        t.x += Math.cos(t.a) * sp; t.y += Math.sin(t.a) * sp;
        if (t.x < 0 || t.y < 0 || t.x >= W || t.y >= H) continue;
        const gi = ((t.y / cs) | 0) * gw + ((t.x / cs) | 0);
        const eat = Math.min(food[gi], 0.04);
        food[gi] -= eat;
        t.energy += eat * 6 - 0.012;
        const prevCell = ((oy / cs) | 0) * gw + ((ox / cs) | 0);
        if (gi !== prevCell && occ[gi] >= 0 && t.age > 4) {
          if (occ[gi] !== t.colony) continue; // blocked by rival colony
          if (P.fuse && density[gi] > 0.5 && Math.random() < 0.5) { fusions++; drawSeg(ox, oy, t.x, t.y, t); continue; }
        }
        occ[gi] = t.colony;
        density[gi] = Math.min(3, density[gi] + 0.35);
        drawSeg(ox, oy, t.x, t.y, t);
        total += sp;
        if (t.energy <= 0) {
          if (Math.random() < 0.004 && density[gi] > 1.2 && mushrooms.length < 60)
            mushrooms.push({ x: t.x, y: t.y, r: rand(3, 7), hue: hues[t.colony] });
          continue;
        }
        next.push(t);
        const pb = (P.branch as number) * Math.min(2, 0.3 + t.energy);
        if (tips.length + next.length < P.maxTips && Math.random() < pb) {
          const side = Math.random() < 0.5 ? -1 : 1;
          t.energy *= 0.6;
          next.push({ x: t.x, y: t.y, a: t.a + side * ba * rand(0.7, 1.3), colony: t.colony, gen: t.gen + 1, energy: t.energy, age: 0 });
        }
      }
      tips = next;
      if (Math.random() < 0.3) for (let i = 0; i < G; i++) density[i] *= 0.995;
    };

    function drawSeg(x0: number, y0: number, x1: number, y1: number, t: Tip) {
      const h = hues[t.colony];
      const w = Math.max(0.5, 2.2 - t.gen * 0.12);
      lc.strokeStyle = `hsla(${h},${35 + Math.min(40, t.gen * 3)}%,${78 - Math.min(30, t.gen * 2)}%,${0.55})`;
      lc.lineWidth = w;
      lc.beginPath(); lc.moveTo(x0, y0); lc.lineTo(x1, y1); lc.stroke();
    }

    const soil = document.createElement('canvas');
    soil.width = gw; soil.height = gh;
    const sctx = soil.getContext('2d')!;
    const img = sctx.createImageData(gw, gh);
    let frame = 0;
    const draw = () => {
      if (frame++ % 6 === 0) {
        const d = img.data;
        for (let i = 0; i < G; i++) {
          const f = P.showFood ? Math.min(1, food[i]) : 0;
          d[i * 4] = 16 + f * 40; d[i * 4 + 1] = 12 + f * 30; d[i * 4 + 2] = 9 + f * 8; d[i * 4 + 3] = 255;
        }
        sctx.putImageData(img, 0, 0);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(soil, 0, 0, gw * cs, gh * cs);
      ctx.drawImage(layer, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const t of tips) {
        ctx.fillStyle = `hsla(${hues[t.colony]},90%,80%,0.9)`;
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const m of mushrooms) {
        ctx.fillStyle = '#e7dcc8';
        ctx.fillRect(m.x - m.r * 0.18, m.y - m.r * 0.2, m.r * 0.36, m.r * 0.9);
        ctx.fillStyle = `hsl(${m.hue},45%,45%)`;
        ctx.beginPath(); ctx.ellipse(m.x, m.y - m.r * 0.2, m.r, m.r * 0.6, 0, Math.PI, TAU); ctx.fill();
      }
    };
    if (thumbnail) for (let i = 0; i < 4; i++) plant(rand(W), rand(H));

    return {
      step, draw,
      pointer(p) {
        if (P.tool === 'spore' && p.type === 'down') plant(p.x, p.y);
        else if (P.tool === 'nutrient' && p.down) stampGrid(gw, gh, p.x / cs, p.y / cs, 8, (i, f) => (food[i] = Math.min(1.5, food[i] + f * 0.3)));
        else if (P.tool === 'toxin' && p.down) {
          const R = 30;
          tips = tips.filter((t) => (t.x - p.x) ** 2 + (t.y - p.y) ** 2 > R * R);
          stampGrid(gw, gh, p.x / cs, p.y / cs, R / cs, (i) => { food[i] = 0; occ[i] = -1; density[i] = 0; });
          lc.save(); lc.globalCompositeOperation = 'destination-out';
          lc.beginPath(); lc.arc(p.x, p.y, R, 0, TAU); lc.fill(); lc.restore();
        }
      },
      stats: () => {
        let f = 0; for (let i = 0; i < G; i++) f += food[i];
        return [['Growing tips', tips.length], ['Colonies', hues.length], ['Hyphae length', Math.round(total)], ['Fusions', fusions], ['Mushrooms', mushrooms.length], ['Nutrients left', Math.round(f)]];
      },
      actions: [{ label: 'Spore shower', run: () => { for (let i = 0; i < 5; i++) plant(rand(W), rand(H)); } }],
    };
  },
};
