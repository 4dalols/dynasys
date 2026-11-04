import type { SimDef } from '../core/types';
import { PixelBuffer, stampGrid, rand } from '../core/util';

const EMPTY = 0, WALL = 1, SAND = 2, WATER = 3, OIL = 4, WOOD = 5, FIRE = 6, SMOKE = 7, PLANT = 8, LAVA = 9, STEAM = 10, STONE = 11, ACID = 12;
const NAMES: [number, string][] = [[SAND, 'Sand'], [WATER, 'Water'], [OIL, 'Oil'], [WOOD, 'Wood'], [FIRE, 'Fire'], [PLANT, 'Plant seed'], [LAVA, 'Lava'], [ACID, 'Acid'], [STONE, 'Stone'], [WALL, 'Wall'], [EMPTY, 'Eraser']];
const COL: number[][] = [];
COL[EMPTY] = [6, 8, 14]; COL[WALL] = [90, 96, 110]; COL[SAND] = [222, 190, 120]; COL[WATER] = [40, 110, 220]; COL[OIL] = [70, 50, 30];
COL[WOOD] = [120, 72, 36]; COL[FIRE] = [255, 120, 20]; COL[SMOKE] = [70, 70, 78]; COL[PLANT] = [60, 180, 70]; COL[LAVA] = [255, 70, 10];
COL[STEAM] = [180, 200, 220]; COL[STONE] = [120, 116, 112]; COL[ACID] = [150, 255, 60];
// density for liquids/powders: heavier sinks through lighter
const DENS: number[] = [];
DENS[EMPTY] = 0; DENS[SMOKE] = 0; DENS[STEAM] = 0; DENS[FIRE] = 0; DENS[OIL] = 1; DENS[WATER] = 2; DENS[ACID] = 2.5; DENS[LAVA] = 3; DENS[SAND] = 4; DENS[STONE] = 5;
const isFluid = (t: number) => t === EMPTY || t === WATER || t === OIL || t === SMOKE || t === STEAM || t === ACID || t === FIRE;
const flammable = (t: number) => t === WOOD || t === OIL || t === PLANT;

export const sand: SimDef = {
  id: 'sand',
  title: 'Falling Sand',
  tagline: 'A toy universe of elements: sand piles, water flows, oil floats and burns, lava meets water and turns to stone.',
  category: 'Waves & Fluids',
  accent: '#fbbf24',
  controls: 'Drag to pour the selected element · right-drag erases',
  thumbSteps: 300,
  params: [
    { type: 'select', key: 'el', label: 'Element', default: String(SAND), options: NAMES.map(([v, l]) => ({ value: String(v), label: l })) },
    { key: 'brush', label: 'Brush size', min: 1, max: 20, step: 1, default: 5 },
    { type: 'select', key: 'scene', label: 'Scene', default: 'volcano', reset: true, options: [{ value: 'empty', label: 'Empty box' }, { value: 'hourglass', label: 'Hourglass' }, { value: 'volcano', label: 'Volcano & lake' }, { value: 'forest', label: 'Forest fire' }, { value: 'layers', label: 'Density layers' }] },
    { key: 'cell', label: 'Cell size (px)', min: 2, max: 6, step: 1, default: 3, reset: true },
    { key: 'rain', label: 'Rain', min: 0, max: 1, step: 0.01, default: 0 },
  ],
  presets: [
    { name: 'Volcano', values: { scene: 'volcano' } },
    { name: 'Hourglass', values: { scene: 'hourglass', el: String(SAND) } },
    { name: 'Forest fire', values: { scene: 'forest', el: String(FIRE) } },
    { name: 'Density layers', values: { scene: 'layers', el: String(WATER) } },
    { name: 'Garden in the rain', values: { scene: 'empty', el: String(PLANT), rain: 0.3 } },
  ],
  about: `<p>A <b>falling-sand</b> cellular automaton. Every cell holds one element and follows tiny local rules each tick: powders fall and slide diagonally, liquids also spread sideways, gases rise, and heavier stuff sinks through lighter stuff.</p>
<p>Reactions add chemistry: fire spreads to wood, oil and plants and leaves smoke; water quenches fire into steam; lava ignites what it touches and solidifies into stone when it meets water; plants creep into water; acid dissolves almost anything (including itself, slowly). Large-scale behaviour — angle of repose, buoyancy, wildfire fronts — emerges from these rules alone.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 3 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const t = new Uint8Array(G), life = new Uint8Array(G), shade = new Uint8Array(G), stamp = new Uint8Array(G);
    for (let i = 0; i < G; i++) shade[i] = (Math.random() * 40) | 0;
    let frame = 1;
    const set = (i: number, v: number, l = 0) => { t[i] = v; life[i] = l; };
    const at = (x: number, y: number) => y * gw + x;
    const fillRect = (x0: number, y0: number, x1: number, y1: number, v: number, p = 1) => {
      for (let y = Math.max(0, y0 | 0); y < Math.min(gh, y1 | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(gw, x1 | 0); x++) if (Math.random() < p) set(at(x, y), v, v === FIRE ? 60 : 0);
    };
    const scene = P.scene as string;
    for (let x = 0; x < gw; x++) { set(at(x, gh - 1), WALL); }
    for (let y = 0; y < gh; y++) { set(at(0, y), WALL); set(at(gw - 1, y), WALL); }
    if (scene === 'hourglass') {
      const cx = gw / 2;
      for (let y = 0; y < gh; y++) {
        const half = Math.abs(y - gh / 2) / (gh / 2) * gw * 0.4 + 2;
        for (let x = 0; x < gw; x++) if (Math.abs(x - cx) > half && Math.abs(x - cx) < half + 2) set(at(x, y), WALL);
      }
      for (let y = (gh * 0.08) | 0; y < gh * 0.4; y++) { const half = Math.abs(y - gh / 2) / (gh / 2) * gw * 0.4; for (let x = Math.ceil(cx - half); x < cx + half; x++) set(at(x, y), SAND); }
    } else if (scene === 'volcano') {
      const cx = gw * 0.35;
      for (let x = 1; x < gw - 1; x++) {
        const hgt = Math.max(0, gh * 0.55 - Math.abs(x - cx) * 1.1);
        for (let y = gh - 1 - hgt; y < gh - 1; y++) if (Math.abs(x - cx) > 3 || y > gh - 1 - hgt + 4) set(at(x, y | 0), STONE);
      }
      for (let y = (gh * 0.5) | 0; y < gh - 1; y++) for (let x = (cx - 2) | 0; x <= cx + 2; x++) set(at(x | 0, y), LAVA);
      fillRect(gw * 0.68, gh * 0.75, gw - 1, gh - 1, WATER);
      fillRect(gw * 0.62, gh * 0.75, gw * 0.68, gh - 1, SAND);
    } else if (scene === 'forest') {
      fillRect(1, gh * 0.85, gw - 1, gh - 1, SAND);
      for (let k = 0; k < gw / 9; k++) {
        const x = (rand(4, gw - 4)) | 0, h = rand(gh * 0.15, gh * 0.4);
        fillRect(x, gh * 0.85 - h, x + 2, gh * 0.85, WOOD);
        for (let j = 0; j < 140; j++) { const a = rand(Math.PI * 2), r = rand(h * 0.35); const px = (x + Math.cos(a) * r) | 0, py = (gh * 0.85 - h + Math.sin(a) * r * 0.7) | 0; if (px > 0 && px < gw - 1 && py > 0) set(at(px, py), PLANT); }
      }
      fillRect(2, gh * 0.85 - 4, 5, gh * 0.85, FIRE);
    } else if (scene === 'layers') {
      fillRect(1, gh * 0.25, gw - 1, gh * 0.4, SAND);
      fillRect(1, gh * 0.4, gw - 1, gh * 0.6, OIL);
      fillRect(1, gh * 0.6, gw - 1, gh - 1, WATER);
      fillRect(gw * 0.3, gh * 0.18, gw * 0.4, gh * 0.25, LAVA);
    }
    let brushing: { x: number; y: number; erase: boolean } | null = null;
    const swap = (i: number, j: number) => {
      const a = t[i], la = life[i];
      t[i] = t[j]; life[i] = life[j]; t[j] = a; life[j] = la;
      stamp[j] = frame;
    };
    const neighbors4 = (x: number, y: number, fn: (j: number) => void) => {
      if (x > 0) fn(at(x - 1, y)); if (x < gw - 1) fn(at(x + 1, y));
      if (y > 0) fn(at(x, y - 1)); if (y < gh - 1) fn(at(x, y + 1));
    };
    const fall = (x: number, y: number, i: number, dens: number, spread: number) => {
      if (y + 1 < gh) {
        const b = at(x, y + 1);
        if (isFluid(t[b]) && DENS[t[b]] < dens) { swap(i, b); return true; }
        const d = Math.random() < 0.5 ? 1 : -1;
        for (const dx of [d, -d]) {
          const nx = x + dx;
          if (nx < 0 || nx >= gw) continue;
          const j = at(nx, y + 1);
          if (isFluid(t[j]) && DENS[t[j]] < dens && isFluid(t[at(nx, y)])) { swap(i, j); return true; }
        }
      }
      if (spread) {
        const d = Math.random() < 0.5 ? 1 : -1;
        let cur = i, cx = x;
        for (let s = 0; s < spread; s++) {
          const nx = cx + d;
          if (nx < 0 || nx >= gw) break;
          const j = at(nx, y);
          if (!(isFluid(t[j]) && DENS[t[j]] < dens)) break;
          swap(cur, j); cur = j; cx = nx;
          if (y + 1 < gh && isFluid(t[at(cx, y + 1)]) && DENS[t[at(cx, y + 1)]] < dens) break;
        }
        return cur !== i;
      }
      return false;
    };
    const rise = (x: number, y: number, i: number) => {
      if (y === 0) return;
      const dx = (Math.random() * 3 | 0) - 1, nx = x + dx;
      if (nx < 0 || nx >= gw) return;
      const j = at(nx, y - 1);
      if (t[j] === EMPTY || t[j] === WATER || t[j] === OIL) swap(i, j);
    };
    const step = () => {
      frame = (frame % 255) + 1;
      const rain = P.rain as number;
      if (rain > 0) for (let k = 0; k < gw * rain * 0.05; k++) { const x = (rand(1, gw - 1)) | 0; if (t[at(x, 0)] === EMPTY) set(at(x, 0), WATER); }
      if (brushing) {
        const v = brushing.erase ? EMPTY : Number(P.el);
        const spray = v === SAND || v === WATER || v === OIL || v === FIRE || v === ACID || v === LAVA || v === PLANT;
        stampGrid(gw, gh, brushing.x, brushing.y, P.brush as number, (i) => {
          if (i % gw === 0 || i % gw === gw - 1 || i >= G - gw) return;
          if (v === EMPTY || (t[i] === EMPTY && (!spray || Math.random() < 0.3)) || (!spray && v !== EMPTY)) set(i, v, v === FIRE ? 50 + rand(40) : 0);
        });
      }
      const leftFirst = frame & 1;
      for (let y = gh - 1; y >= 0; y--) {
        for (let k = 0; k < gw; k++) {
          const x = leftFirst ? k : gw - 1 - k, i = y * gw + x, e = t[i];
          if (e === EMPTY || e === WALL || e === WOOD || stamp[i] === frame) continue;
          stamp[i] = frame;
          switch (e) {
            case SAND: case STONE: fall(x, y, i, DENS[e], 0); break;
            case WATER: fall(x, y, i, DENS[e], 4); break;
            case OIL: fall(x, y, i, DENS[e], 3); break;
            case ACID: {
              let done = false;
              neighbors4(x, y, (j) => {
                if (done) return;
                const o = t[j];
                if (o !== EMPTY && o !== ACID && o !== WALL && o !== FIRE && Math.random() < 0.08) { set(j, Math.random() < 0.3 ? SMOKE : EMPTY, 40); if (Math.random() < 0.25) { set(i, EMPTY); done = true; } }
              });
              if (!done) fall(x, y, i, DENS[e], 3);
              break;
            }
            case LAVA: {
              neighbors4(x, y, (j) => {
                if (flammable(t[j]) && Math.random() < 0.3) set(j, FIRE, 60);
                else if (t[j] === WATER) { set(j, STEAM, 120); if (Math.random() < 0.5) set(i, STONE); }
                else if (t[j] === SAND && Math.random() < 0.002) set(j, LAVA);
              });
              if (t[i] === LAVA && Math.random() < 0.5) fall(x, y, i, DENS[e], 1);
              break;
            }
            case FIRE: {
              neighbors4(x, y, (j) => {
                if (flammable(t[j]) && Math.random() < (t[j] === OIL ? 0.5 : 0.12)) set(j, FIRE, t[j] === WOOD ? 120 + rand(60) : 50 + rand(30));
                else if (t[j] === WATER && Math.random() < 0.5) { set(j, STEAM, 120); set(i, EMPTY); }
              });
              if (t[i] !== FIRE) break;
              if (life[i] <= 1) { set(i, Math.random() < 0.4 ? SMOKE : EMPTY, 80); break; }
              life[i]--;
              if (Math.random() < 0.3) rise(x, y, i);
              break;
            }
            case SMOKE: case STEAM: {
              if (life[i] <= 1) { set(i, e === STEAM && Math.random() < 0.4 ? WATER : EMPTY); break; }
              life[i]--;
              rise(x, y, i);
              break;
            }
            case PLANT: {
              if (Math.random() < 0.05) neighbors4(x, y, (j) => { if (t[j] === WATER && Math.random() < 0.3) set(j, PLANT); });
              if (y + 1 < gh && t[at(x, y + 1)] === EMPTY) {
                let support = false; neighbors4(x, y, (j) => { if (t[j] !== EMPTY && t[j] !== SMOKE && t[j] !== STEAM && t[j] !== FIRE) support = true; });
                if (!support) swap(i, at(x, y + 1));
              }
              break;
            }
          }
        }
      }
    };
    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let i = 0; i < G; i++) {
        const e = t[i], c = COL[e], o = i * 4;
        let s = e === EMPTY ? 0 : shade[i] - 20;
        if (e === FIRE) s = life[i] - 40 + (Math.random() * 60 - 30);
        if (e === LAVA) s = Math.random() * 50 - 25;
        if (e === SMOKE || e === STEAM) { const a = Math.min(1, life[i] / 80); d[o] = COL[EMPTY][0] + (c[0] - COL[EMPTY][0]) * a; d[o + 1] = COL[EMPTY][1] + (c[1] - COL[EMPTY][1]) * a; d[o + 2] = COL[EMPTY][2] + (c[2] - COL[EMPTY][2]) * a; continue; }
        d[o] = c[0] + s; d[o + 1] = c[1] + s * (e === FIRE ? 1.5 : 1); d[o + 2] = c[2] + s;
      }
      buf.blit(ctx, gw * cs, gh * cs);
    };
    return {
      step, draw,
      pointer(p) { brushing = p.down ? { x: p.x / cs, y: p.y / cs, erase: p.button === 2 || P.el === String(EMPTY) } : null; },
      stats: () => {
        let n = 0, f = 0; for (let i = 0; i < G; i++) { if (t[i] !== EMPTY && t[i] !== WALL) n++; if (t[i] === FIRE) f++; }
        return [['Particles', n], ['Burning', f]];
      },
      actions: [
        { label: 'Clear', run: () => { for (let y = 0; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) set(at(x, y), EMPTY); } },
        { label: 'Earthquake', run: () => { for (let k = 0; k < G / 4; k++) { const i = ((Math.random() * (G - 2 * gw)) | 0) + gw, j = i + ((Math.random() * 3) | 0) - 1; if (t[i] !== WALL && t[j] !== WALL) swap(i, j); } } },
      ],
    };
  },
};
