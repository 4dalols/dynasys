import type { SimDef, ParamDef, ParamGroup } from '../core/types';
import { History, PixelBuffer, clamp, stampGrid } from '../core/util';

const NAMES = ['Red', 'Blue', 'Green', 'Gold'];
const COLS: [number, number, number][] = [[239, 68, 68], [59, 130, 246], [34, 197, 94], [234, 179, 8]];
const HEX = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
const STRATS = [
  { value: 'expander', label: 'Expander (grab nearest empty land)' },
  { value: 'raider', label: 'Raider (attack weakest enemy cells)' },
  { value: 'turtle', label: 'Turtle (fortify borders, creep)' },
  { value: 'explorer', label: 'Explorer (shoot out long tendrils)' },
  { value: 'encircler', label: 'Encircler (fill gaps, surround)' },
  { value: 'random', label: 'Random' },
];
const DEF_STRAT = ['expander', 'raider', 'turtle', 'explorer'];
const SNAME: Record<string, string> = { expander: 'Expander', raider: 'Raider', turtle: 'Turtle', explorer: 'Explorer', encircler: 'Encircler', random: 'Random' };

const botParams: (ParamDef | ParamGroup)[] = [];
for (let b = 0; b < 4; b++) {
  botParams.push(
    { type: 'group', label: `${NAMES[b]} bot` },
    { type: 'select', key: `s${b}`, label: 'Strategy', default: DEF_STRAT[b], options: STRATS },
    { key: `sp${b}`, label: 'Speed (moves/tick)', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: `st${b}`, label: 'Attack strength', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: `df${b}`, label: 'Defence', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: `iq${b}`, label: 'Smarts (options weighed)', min: 1, max: 24, step: 1, default: 6 },
  );
}

export const landgrab: SimDef = {
  id: 'landgrab',
  title: 'Land Grab Bots',
  tagline: 'Bots with different brains and different superpowers fight for every square of a map. Is it better to be fast, strong, tough — or clever?',
  category: 'Algorithms at War',
  accent: '#f97316',
  controls: 'Drag to paint with the selected tool · right-drag erases walls',
  thumbSteps: 260,
  params: [
    { key: 'bots', label: 'Bots', min: 2, max: 4, step: 1, default: 2, reset: true },
    { type: 'select', key: 'map', label: 'Map', default: 'rocks', reset: true, options: [
      { value: 'open', label: 'Open field' }, { value: 'rocks', label: 'Scattered rocks' },
      { value: 'walls', label: 'Walls with gaps' }, { value: 'islands', label: 'Islands & bridges' }] },
    { key: 'cell', label: 'Cell size (px)', min: 3, max: 12, step: 1, default: 6, reset: true },
    { type: 'toggle', key: 'income', label: 'Bigger territory → more moves', default: true },
    { key: 'fortcap', label: 'Max fortification', min: 1, max: 10, step: 0.5, default: 4 },
    { type: 'toggle', key: 'auto', label: 'Auto-restart rounds & keep score', default: true },
    { key: 'round', label: 'Round time limit (ticks)', min: 500, max: 10000, step: 100, default: 3000 },
    { type: 'select', key: 'tool', label: 'Mouse tool', default: 'wall', options: [
      { value: 'wall', label: 'Draw walls' }, { value: 'erase', label: 'Erase' },
      ...NAMES.map((n, i) => ({ value: `g${i}`, label: `Gift land to ${n}` }))] },
    ...botParams,
  ],
  presets: [
    { name: 'Expander vs Raider', values: {} },
    { name: 'Four brains', values: { bots: 4 } },
    { name: 'Fast vs strong', values: { s0: 'expander', s1: 'expander', sp0: 2, st0: 0.6, df0: 0.6, sp1: 0.6, st1: 2, df1: 1.5 } },
    { name: 'Smart vs dumb (but fast)', values: { s0: 'raider', s1: 'random', iq0: 20, iq1: 1, sp1: 2.2 } },
    { name: 'Turtle vs Raider', values: { s0: 'turtle', s1: 'raider' } },
    { name: 'Encircler vs Explorer', values: { s0: 'encircler', s1: 'explorer', map: 'open' } },
    { name: 'Same brain, 3× strength', values: { s0: 'raider', s1: 'raider', st1: 3 } },
    { name: 'Island war', values: { bots: 4, map: 'islands', s0: 'expander', s1: 'raider', s2: 'turtle', s3: 'encircler' } },
  ],
  about: `<p>Every tick each bot gets a budget of moves (its <b>speed</b>, plus a bonus for territory if enabled). For each move it looks at a handful of possible targets next to its land — how many is its <b>smarts</b> — scores them with its <b>strategy</b> and acts on the best one. Empty land is claimed instantly. An enemy cell has a fortification level; an attack knocks off <i>strength ÷ enemy defence</i>, and when it drops to zero the cell flips.</p>
<p>The strategies are deliberately simple: the <b>Expander</b> grabs empty land near home, the <b>Raider</b> hunts the weakest enemy cells, the <b>Turtle</b> spends half its moves fortifying its border, the <b>Explorer</b> pushes as far from home as possible, and the <b>Encircler</b> prefers cells it already surrounds, which squeezes out enemy salients. Keep score over many rounds and tune the powers until the matchup is fair — then change one slider and watch the balance tip.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 5 : (P.cell as number);
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    const NB = P.bots as number;
    const owner = new Int8Array(G);
    const fort = new Float32Array(G);
    const wall = new Uint8Array(G);
    const list: Int32Array[] = [], cnt = new Int32Array(NB), pos = new Int32Array(G);
    for (let b = 0; b < NB; b++) list.push(new Int32Array(G));
    const wins = new Int32Array(NB);
    let draws = 0, tick = 0, rounds = 0, banner = '', bannerT = 0;
    const home: [number, number][] = [];
    const hist = new History(NAMES.slice(0, NB).map((n) => `${n} %`), HEX.slice(0, NB), 300);

    const buildMap = () => {
      wall.fill(0);
      const map = P.map as string;
      if (map === 'rocks') {
        for (let k = 0; k < ((G / 900) | 0); k++) stampGrid(gw, gh, Math.random() * gw, Math.random() * gh, 2 + Math.random() * 6, (i) => (wall[i] = 1));
      } else if (map === 'walls') {
        const n = 4;
        for (let k = 1; k < n; k++) {
          const x = ((k * gw) / n) | 0;
          for (let y = 0; y < gh; y++) if ((y / gh * 5 + k * 0.5) % 1 > 0.18) for (let t = 0; t < 2; t++) wall[y * gw + x + t] = 1;
          const y = ((k * gh) / n) | 0;
          for (let x2 = 0; x2 < gw; x2++) if ((x2 / gw * 5 + k * 0.3) % 1 > 0.18) for (let t = 0; t < 2; t++) wall[(y + t) * gw + x2] = 1;
        }
      } else if (map === 'islands') {
        wall.fill(1);
        const cx = [0.22, 0.78, 0.22, 0.78, 0.5], cy = [0.25, 0.25, 0.75, 0.75, 0.5];
        for (let k = 0; k < 5; k++) stampGrid(gw, gh, cx[k] * gw, cy[k] * gh, Math.min(gw, gh) * (k === 4 ? 0.16 : 0.2), (i) => (wall[i] = 0));
        const bridge = (x0: number, y0: number, x1: number, y1: number) => {
          const n = Math.hypot((x1 - x0) * gw, (y1 - y0) * gh);
          for (let t = 0; t <= n; t++) stampGrid(gw, gh, (x0 + (x1 - x0) * t / n) * gw, (y0 + (y1 - y0) * t / n) * gh, 1.6, (i) => (wall[i] = 0));
        };
        for (let k = 0; k < 4; k++) bridge(cx[k], cy[k], 0.5, 0.5);
        bridge(0.22, 0.25, 0.78, 0.25); bridge(0.22, 0.75, 0.78, 0.75);
      }
    };
    const add = (i: number, b: number) => {
      const o = owner[i] - 1;
      if (o === b) return;
      if (o >= 0) { const p = pos[i], last = list[o][--cnt[o]]; list[o][p] = last; pos[last] = p; }
      owner[i] = b + 1;
      if (b >= 0) { pos[i] = cnt[b]; list[b][cnt[b]++] = i; }
    };
    const newRound = () => {
      owner.fill(0); fort.fill(0); cnt.fill(0); tick = 0;
      if (P.map !== 'walls' || !rounds) buildMap();
      const spots = NB === 2 ? [[0.12, 0.5], [0.88, 0.5]] : [[0.12, 0.15], [0.88, 0.85], [0.88, 0.15], [0.12, 0.85]];
      const isl = P.map === 'islands' ? [[0.22, 0.25], [0.78, 0.75], [0.78, 0.25], [0.22, 0.75]] : spots;
      home.length = 0;
      for (let b = 0; b < NB; b++) {
        const [fx, fy] = (P.map === 'islands' ? isl : spots)[b];
        const x = (fx * gw) | 0, y = (fy * gh) | 0;
        home.push([x, y]);
        stampGrid(gw, gh, x, y, 3, (i) => { wall[i] = 0; add(i, b); fort[i] = 1; });
      }
    };
    newRound();

    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    const ownNbrs = (i: number, b: number) => {
      const x = i % gw, y = (i / gw) | 0;
      let n = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && owner[ny * gw + nx] === b + 1) n++;
      }
      return n;
    };
    const act = (b: number) => {
      const strat = P[`s${b}`] as string, iq = P[`iq${b}`] as number;
      const L = list[b], n = cnt[b];
      if (!n) return;
      if (strat === 'turtle' && Math.random() < 0.5) {
        let best = -1, bs = 1e9;
        for (let k = 0; k < iq; k++) {
          const i = L[(Math.random() * n) | 0];
          const s = fort[i] + ownNbrs(i, b) * 0.6;
          if (s < bs) { bs = s; best = i; }
        }
        if (best >= 0) fort[best] = Math.min(P.fortcap as number, fort[best] + 0.5);
        return;
      }
      const [hx, hy] = home[b];
      let best = -1, bs = -1e9;
      for (let k = 0; k < iq; k++) {
        const src = L[(Math.random() * n) | 0], d = (Math.random() * 4) | 0;
        const x = src % gw + DX[d], y = ((src / gw) | 0) + DY[d];
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const t = y * gw + x;
        if (wall[t] || owner[t] === b + 1) continue;
        const enemy = owner[t] > 0, dist = Math.hypot(x - hx, y - hy);
        let s = Math.random() * 0.5;
        switch (strat) {
          case 'expander': s += enemy ? 2 - fort[t] : 10 - dist * 0.05; break;
          case 'raider': s += enemy ? 12 - fort[t] * 2 : 3; break;
          case 'turtle': s += enemy ? 4 - fort[t] : 6 - dist * 0.08; break;
          case 'explorer': s += (enemy ? 3 : 8) + dist * 0.1; break;
          case 'encircler': s += ownNbrs(t, b) * 3 + (enemy ? 2 - fort[t] * 0.5 : 3); break;
          default: s = Math.random();
        }
        if (s > bs) { bs = s; best = t; }
      }
      if (best < 0) return;
      if (!owner[best]) { add(best, b); fort[best] = 1; return; }
      const e = owner[best] - 1;
      fort[best] -= (P[`st${b}`] as number) / (P[`df${e}`] as number);
      if (fort[best] <= 0) { add(best, b); fort[best] = 0.6; }
    };
    let budget = new Float32Array(NB);
    const step = () => {
      tick++;
      const share = G / NB / 6;
      for (let b = 0; b < NB; b++) {
        if (!cnt[b]) continue;
        const inc = P.income ? 0.5 + Math.sqrt(cnt[b] / share) : 1;
        budget[b] += (P[`sp${b}`] as number) * inc * G * 0.0012;
      }
      // interleave moves so no bot always goes first
      let any = true;
      while (any) {
        any = false;
        for (let k = 0; k < NB; k++) {
          const b = (k + tick) % NB;
          if (budget[b] >= 1) { budget[b] -= 1; act(b); any = true; }
        }
      }
      if (tick % 4 === 0) {
        let tot = 0;
        for (let b = 0; b < NB; b++) tot += cnt[b];
        hist.push(...Array.from(cnt, (c) => (c / (tot || 1)) * 100));
      }
      if (bannerT > 0) bannerT--;
      if (!P.auto || thumbnail) return;
      let alive = 0, lead = 0, tot = 0;
      for (let b = 0; b < NB; b++) { if (cnt[b]) alive++; if (cnt[b] > cnt[lead]) lead = b; tot += cnt[b]; }
      const done = alive <= 1 || tick >= (P.round as number);
      if (done) {
        const second = Math.max(...Array.from(cnt).filter((_, b) => b !== lead));
        rounds++;
        if (cnt[lead] > second * 1.1 || alive <= 1) { wins[lead]++; banner = `${NAMES[lead]} (${SNAME[P[`s${lead}`] as string]}) wins with ${((cnt[lead] / tot) * 100).toFixed(0)}%`; }
        else { draws++; banner = 'Round drawn — too close to call'; }
        bannerT = 150;
        budget = new Float32Array(NB);
        newRound();
      }
    };

    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data, cap = P.fortcap as number;
      for (let i = 0; i < G; i++) {
        const o = i * 4;
        if (wall[i]) { d[o] = 52; d[o + 1] = 56; d[o + 2] = 68; continue; }
        const b = owner[i] - 1;
        if (b < 0) { d[o] = 14; d[o + 1] = 16; d[o + 2] = 24; continue; }
        const c = COLS[b], f = 0.45 + 0.55 * clamp(fort[i] / cap, 0, 1);
        const x = i % gw, y = (i / gw) | 0;
        const edge = (x > 0 && owner[i - 1] !== owner[i] && owner[i - 1] > 0) || (y > 0 && owner[i - gw] !== owner[i] && owner[i - gw] > 0);
        const m = edge ? 1.35 : f;
        d[o] = Math.min(255, c[0] * m); d[o + 1] = Math.min(255, c[1] * m); d[o + 2] = Math.min(255, c[2] * m);
      }
      buf.blit(ctx, gw * cs, gh * cs);
      if (thumbnail) return;
      hist.draw(ctx, W - 250, H - 90, 238, 78, { yMax: 100 });
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      const lines = Array.from({ length: NB }, (_, b) => [`${NAMES[b]} · ${SNAME[P[`s${b}`] as string]}`, `${wins[b]} wins`, HEX[b]]);
      if (P.auto) lines.push([`Draws`, `${draws}`, '#94a3b8']);
      ctx.fillStyle = 'rgba(5,7,13,0.7)';
      ctx.fillRect(W - 230, 12, 218, 14 + lines.length * 18);
      lines.forEach(([a, b, c], k) => {
        ctx.fillStyle = c; ctx.fillText(a, W - 220, 30 + k * 18);
        ctx.fillStyle = '#e5e7eb'; ctx.textAlign = 'right'; ctx.fillText(b, W - 22, 30 + k * 18); ctx.textAlign = 'start';
      });
      if (P.auto) {
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillRect(W - 230, 14 + lines.length * 18 + 6, 218 * Math.min(1, tick / (P.round as number)), 3);
      }
      if (bannerT > 0) {
        ctx.globalAlpha = Math.min(1, bannerT / 30);
        ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(banner).width;
        ctx.fillStyle = 'rgba(5,7,13,0.8)'; ctx.fillRect(W / 2 - tw / 2 - 16, H / 2 - 24, tw + 32, 40);
        ctx.fillStyle = '#f8fafc'; ctx.fillText(banner, W / 2, H / 2 + 4);
        ctx.textAlign = 'start'; ctx.globalAlpha = 1;
      }
    };
    return {
      step, draw,
      pointer(p) {
        if (!p.down) return;
        const tool = p.button === 2 ? 'erase' : (P.tool as string);
        stampGrid(gw, gh, p.x / cs, p.y / cs, 3, (i) => {
          if (tool === 'wall') { add(i, -1); owner[i] = 0; wall[i] = 1; }
          else if (tool === 'erase') wall[i] = 0;
          else { const b = +tool[1]; if (b < NB && !wall[i]) { add(i, b); fort[i] = 1; } }
        });
      },
      stats: () => {
        let tot = 0;
        for (let b = 0; b < NB; b++) tot += cnt[b];
        return [...Array.from({ length: NB }, (_, b) => [`${NAMES[b]} land`, `${((cnt[b] / (tot || 1)) * 100).toFixed(1)}%`] as [string, string]), ['Round', `${rounds + 1}`]];
      },
      actions: [
        { label: 'New round', run: () => { budget = new Float32Array(NB); newRound(); } },
        { label: 'Reset score', run: () => { wins.fill(0); draws = 0; rounds = 0; } },
      ],
    };
  },
};
