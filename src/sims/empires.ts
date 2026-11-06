import type { SimDef } from '../core/types';
import { PixelBuffer, clamp, rand } from '../core/util';

const CAP = 40;
const SYL = ['ka', 'lo', 'ver', 'an', 'dor', 'mi', 'tal', 'zen', 'ru', 'sha', 'bor', 'el', 'qu', 'ith', 'na', 'gor', 'vel', 'sa', 'thu', 'ra', 'pe', 'om', 'ly', 'xan'];
const SUFFIX = ['ia', 'or', 'an', 'heim', 'ar', 'is', 'ania', 'ostan', 'mark', 'ea'];
const genName = () => {
  const n = 1 + ((Math.random() * 2) | 0);
  let s = '';
  for (let i = 0; i < n; i++) s += SYL[(Math.random() * SYL.length) | 0];
  s += SUFFIX[(Math.random() * SUFFIX.length) | 0];
  return s[0].toUpperCase() + s.slice(1);
};
const hslRgb = (h: number, s: number, l: number): [number, number, number] => {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

export const empires: SimDef = {
  id: 'empires',
  title: 'Rise of Empires',
  tagline: 'Nations settle a procedural world, sign alliances, betray them, wage border wars — and big empires crack into rebel states.',
  category: 'Societies',
  accent: '#eab308',
  controls: 'Click a territory to spark a revolt there · shift-click to fund that nation’s army',
  thumbSteps: 500,
  params: [
    { key: 'nations', label: 'Starting nations', min: 2, max: 30, step: 1, default: 12, reset: true },
    { type: 'select', key: 'map', label: 'World', default: 'continents', reset: true, options: [
      { value: 'continents', label: 'Continents' }, { value: 'pangaea', label: 'Pangaea' }, { value: 'archipelago', label: 'Archipelago' }] },
    { key: 'pace', label: 'Pace', min: 0.2, max: 4, step: 0.1, default: 1 },
    { type: 'group', label: 'Growth & war' },
    { key: 'expand', label: 'Settling speed', min: 0.05, max: 1, step: 0.01, default: 0.5 },
    { key: 'aggression', label: 'Border tension', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'attack', label: 'Conquest speed', min: 0.05, max: 1, step: 0.01, default: 0.45 },
    { key: 'weariness', label: 'War weariness', min: 0, max: 1, step: 0.01, default: 0.4, hint: 'How fast wars burn out into peace' },
    { type: 'group', label: 'Diplomacy' },
    { key: 'solidarity', label: 'Bloc solidarity', min: 0, max: 1, step: 0.01, default: 0.5, hint: 'Enemy of my enemy is my friend; allies join wars' },
    { key: 'treachery', label: 'Treachery', min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: 'rebellion', label: 'Rebellion in big empires', min: 0, max: 1, step: 0.01, default: 0.35 },
    { type: 'toggle', key: 'showDip', label: 'Show alliances & wars', default: true },
  ],
  presets: [
    { name: 'Age of nations', values: {} },
    { name: 'Warring states', values: { aggression: 0.9, treachery: 0.5, weariness: 0.2, nations: 20 } },
    { name: 'Pax (peaceful)', values: { aggression: 0.1, weariness: 0.9, treachery: 0 } },
    { name: 'Rise and fall', values: { rebellion: 0.9, attack: 0.7 } },
    { name: 'Two-bloc world', values: { solidarity: 1, treachery: 0, nations: 16 } },
    { name: 'Pangaea', values: { map: 'pangaea', nations: 18 } },
    { name: 'Archipelago', values: { map: 'archipelago', nations: 16 } },
  ],
  about: `<p>An agent-based toy history. Each nation's <b>army</b> grows with its territory and drains with upkeep and war. Every tick a sample of border cells is examined: empty land gets settled (slowly in mountains), and if the neighbour belongs to a nation you are <b>at war</b> with, the attacker may capture it with a chance proportional to relative army strength — mountains favour the defender, and losing your capital costs half your army.</p>
<p>Diplomacy is a matrix of relations in [−1, 1]. Shared borders breed tension; wars wear down into peace; nations share friends and enemies through <b>bloc solidarity</b>; and a strong ally next to a weak one may <b>betray</b> it. Big empires occasionally fracture as a far province <b>rebels</b> and fights a war of independence, so you get cycles of expansion, hegemony and collapse instead of one winner.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const cs = thumbnail ? 4 : 5;
    const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), G = gw * gh;
    // terrain from value noise
    const hgt = new Float32Array(G);
    const octave = (cell: number, amp: number) => {
      const cw = Math.ceil(gw / cell) + 2, ch = Math.ceil(gh / cell) + 2;
      const r = new Float32Array(cw * ch).map(() => Math.random());
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const fx = x / cell, fy = y / cell, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = r[y0 * cw + x0], b = r[y0 * cw + x0 + 1], c = r[(y0 + 1) * cw + x0], d = r[(y0 + 1) * cw + x0 + 1];
        hgt[y * gw + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
      }
    };
    const base = Math.max(gw, gh);
    octave(base / 3, 0.5); octave(base / 7, 0.28); octave(base / 16, 0.14); octave(base / 40, 0.08);
    const map = P.map as string;
    const sea = map === 'archipelago' ? 0.58 : map === 'pangaea' ? 0.4 : 0.5;
    const terr = new Uint8Array(G); // 0 sea, 1 plain, 2 mountain
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const ex = (x / gw - 0.5) * 2, ey = (y / gh - 0.5) * 2, edge = Math.max(Math.abs(ex), Math.abs(ey));
      let h = hgt[i];
      if (map === 'pangaea') h += 0.25 - Math.hypot(ex, ey) * 0.35;
      h -= Math.max(0, edge - 0.85) * 1.5;
      hgt[i] = h;
      terr[i] = h < sea ? 0 : h > sea + 0.22 ? 2 : 1;
    }

    const owner = new Int16Array(G).fill(-1);
    const alive = new Uint8Array(CAP), area = new Int32Array(CAP), capital = new Int32Array(CAP);
    const army = new Float32Array(CAP), rel = new Float32Array(CAP * CAP), border = new Float32Array(CAP * CAP);
    const color: [number, number, number][] = [], names: string[] = new Array(CAP).fill('');
    let hueSeed = rand(360);
    for (let k = 0; k < CAP; k++) color.push([0, 0, 0]);
    const events: { t: string; c: string; age: number }[] = [];
    const log = (t: string, c = '#e5e7eb') => { events.unshift({ t, c, age: 0 }); if (events.length > 6) events.pop(); };
    const war = (a: number, b: number) => rel[a * CAP + b] < -0.5;
    const ally = (a: number, b: number) => rel[a * CAP + b] > 0.5;
    const setRel = (a: number, b: number, v: number) => { rel[a * CAP + b] = rel[b * CAP + a] = clamp(v, -1, 1); };
    const setOwner = (i: number, o: number) => {
      const p = owner[i];
      if (p === o) return;
      if (p >= 0) area[p]--;
      if (o >= 0) area[o]++;
      owner[i] = o;
    };
    const newNation = () => {
      for (let k = 0; k < CAP; k++) if (!alive[k] && area[k] === 0) {
        alive[k] = 1; army[k] = 5; names[k] = genName();
        hueSeed = (hueSeed + 137.5) % 360;
        color[k] = hslRgb(hueSeed, 0.62, 0.55);
        for (let j = 0; j < CAP; j++) if (j !== k) setRel(k, j, rand(-0.2, 0.2));
        return k;
      }
      return -1;
    };
    const land: number[] = [];
    for (let i = 0; i < G; i++) if (terr[i] === 1) land.push(i);
    const nStart = P.nations as number;
    for (let n = 0; n < nStart && land.length; n++) {
      const k = newNation();
      let c = land[(Math.random() * land.length) | 0];
      for (let t = 0; t < 30 && owner[c] >= 0; t++) c = land[(Math.random() * land.length) | 0];
      capital[k] = c; setOwner(c, k);
    }
    const nameSpan = (k: number) => names[k];
    const css = (k: number) => `rgb(${color[k].map((v) => v | 0).join(',')})`;
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

    const relocateCapital = (k: number) => {
      for (let t = 0; t < 4000; t++) { const i = (Math.random() * G) | 0; if (owner[i] === k) { capital[k] = i; return; } }
    };
    const revolt = (from: number, start: number) => {
      const k = newNation();
      if (k < 0) return;
      const target = Math.max(4, (area[from] * rand(0.2, 0.4)) | 0);
      const q = [start];
      const seen = new Uint8Array(G); seen[start] = 1;
      let got = 0;
      while (q.length && got < target) {
        const i = q.shift()!;
        if (owner[i] !== from || i === capital[from]) continue;
        setOwner(i, k); got++;
        const x = i % gw, y = (i / gw) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = ny * gw + nx;
          if (!seen[j]) { seen[j] = 1; q.push(j); }
        }
      }
      if (!got) { alive[k] = 0; return; }
      capital[k] = start;
      const share = got / (area[from] + got);
      army[k] = army[from] * share * 1.2; army[from] *= 1 - share * 0.5;
      for (let j = 0; j < CAP; j++) if (j !== k && alive[j]) setRel(k, j, rel[from * CAP + j] * -0.5 + rand(-0.2, 0.2));
      setRel(k, from, -1);
      log(`${names[k]} rebels against ${names[from]}`, css(k));
    };

    let tick = 0;
    const step = () => {
      tick++;
      const samples = Math.round(G * 0.12 * (P.pace as number));
      const exp = P.expand as number, att = (P.attack as number) * 0.5;
      for (let s = 0; s < samples; s++) {
        const i = (Math.random() * G) | 0, a = owner[i];
        if (a < 0) continue;
        const d = (Math.random() * 4) | 0;
        let x = i % gw + DX[d], y = ((i / gw) | 0) + DY[d];
        if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        let j = y * gw + x;
        if (terr[j] === 0) {
          if (Math.random() > 0.04) continue;
          let hop = 0;
          while (hop++ < 14) {
            x += DX[d]; y += DY[d];
            if (x < 0 || y < 0 || x >= gw || y >= gh) break;
            j = y * gw + x;
            if (terr[j]) break;
          }
          if (!terr[j] || x < 0 || y < 0 || x >= gw || y >= gh) continue;
        }
        const b = owner[j];
        if (b === a) continue;
        if (b < 0) {
          if (Math.random() < exp * (terr[j] === 2 ? 0.25 : 1)) setOwner(j, a);
          continue;
        }
        border[a * CAP + b] += 1;
        if (!war(a, b)) continue;
        const sa = army[a] / Math.sqrt(area[a] + 1), sb = army[b] / Math.sqrt(area[b] + 1);
        const pWin = att * (sa / (sa + sb + 1e-6)) * (terr[j] === 2 ? 0.4 : 1);
        const cost = 0.02 + 0.02 * Math.random();
        if (Math.random() < pWin) {
          setOwner(j, a); army[b] -= cost * 1.5; army[a] -= cost;
          if (j === capital[b]) {
            army[b] *= 0.5;
            log(`${names[a]} captures the capital of ${names[b]}`, css(a));
            if (area[b] > 0) relocateCapital(b);
          }
        } else { army[a] -= cost * 1.2; army[b] -= cost * 0.5; }
      }
      // economy
      for (let k = 0; k < CAP; k++) {
        if (!alive[k]) continue;
        if (area[k] <= 0) { alive[k] = 0; log(`${names[k]} falls`, '#94a3b8'); continue; }
        army[k] = Math.max(0.1, army[k] + 0.004 * area[k] * 0.1 - 0.004 * army[k]);
        if (owner[capital[k]] !== k) relocateCapital(k);
      }
      if (tick % 6 === 0) diplomacy();
      if (tick % 40 === 0 && (P.rebellion as number) > 0) {
        let landTot = 0;
        for (let k = 0; k < CAP; k++) if (alive[k]) landTot += area[k];
        for (let k = 0; k < CAP; k++) {
          if (!alive[k] || area[k] < 200) continue;
          const share = area[k] / (landTot || 1);
          if (Math.random() < (P.rebellion as number) * share * share * 2.5 + (P.rebellion as number) * 0.01 * share) {
            // far-away province
            let best = -1, bd = -1;
            const cx = capital[k] % gw, cy = (capital[k] / gw) | 0;
            for (let t = 0; t < 400; t++) {
              const i = (Math.random() * G) | 0;
              if (owner[i] !== k) continue;
              const dd = (i % gw - cx) ** 2 + (((i / gw) | 0) - cy) ** 2;
              if (dd > bd) { bd = dd; best = i; }
            }
            if (best >= 0) revolt(k, best);
          }
        }
      }
      for (const e of events) e.age++;
    };

    const diplomacy = () => {
      const agg = P.aggression as number, wear = P.weariness as number, sol = P.solidarity as number, tre = P.treachery as number;
      const ids: number[] = [];
      for (let k = 0; k < CAP; k++) if (alive[k]) ids.push(k);
      for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
        const a = ids[x], b = ids[y];
        let r = rel[a * CAP + b];
        const wasWar = r < -0.5, wasAlly = r > 0.5;
        const bd = border[a * CAP + b] + border[b * CAP + a];
        if (bd > 0) r -= agg * 0.02 * Math.min(1, bd / 8);
        if (wasWar) r += wear * 0.012;
        let common = 0;
        for (const c of ids) {
          if (c === a || c === b) continue;
          const ra = rel[a * CAP + c], rb = rel[b * CAP + c];
          if (ra < -0.5 && rb < -0.5) common += 1;
          else if ((ra > 0.5 && rb < -0.5) || (rb > 0.5 && ra < -0.5)) common -= 1;
          else if (ra > 0.5 && rb > 0.5) common += 0.5;
        }
        r += sol * 0.012 * common;
        r += (Math.random() - 0.5) * 0.03;
        if (!bd) r *= 0.995;
        if (wasAlly && bd > 0 && Math.random() < tre * 0.01) {
          const strong = army[a] > army[b] * 2 ? a : army[b] > army[a] * 2 ? b : -1;
          if (strong >= 0) { r = -1; log(`${names[strong]} betrays ${names[strong === a ? b : a]}!`, '#f87171'); }
        }
        r = clamp(r, -1, 1);
        if (!wasWar && r < -0.5) { r = -0.85; log(`War: ${names[a]} vs ${names[b]}`, '#fca5a5'); }
        else if (wasWar && r >= -0.5) { r = -0.15; log(`Peace between ${names[a]} and ${names[b]}`, '#93c5fd'); }
        else if (!wasAlly && r > 0.5) { r = 0.8; log(`Alliance: ${names[a]} + ${names[b]}`, '#86efac'); }
        setRel(a, b, r);
      }
      border.fill(0);
    };

    const buf = new PixelBuffer(gw, gh);
    const draw = () => {
      const d = buf.data;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x, o = i * 4, t = terr[i], h = hgt[i];
        let r: number, g: number, b: number;
        if (t === 0) { const k = clamp(h / sea, 0, 1); r = 10 + 20 * k; g = 26 + 40 * k; b = 52 + 60 * k; }
        else {
          const sh = clamp((h - sea) / 0.4, 0, 1);
          if (t === 2) { r = g = b = 110 + 80 * sh; } else { r = 70 + 40 * sh; g = 92 + 30 * sh; b = 58 + 20 * sh; }
          const k = owner[i];
          if (k >= 0) {
            const c = color[k], m = t === 2 ? 0.55 : 0.75;
            r = r * (1 - m) + c[0] * m; g = g * (1 - m) + c[1] * m; b = b * (1 - m) + c[2] * m;
            const kr = x + 1 < gw ? owner[i + 1] : k, kd = y + 1 < gh ? owner[i + gw] : k;
            if ((kr !== k && kr >= 0) || (kd !== k && kd >= 0)) {
              const other = kr !== k ? kr : kd;
              if (war(k, other)) { r = 255; g = 70; b = 60; } else { r *= 0.35; g *= 0.35; b *= 0.35; }
            }
          }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
      }
      buf.blit(ctx, gw * cs, gh * cs);
      const pos = (k: number) => [(capital[k] % gw + 0.5) * cs, (((capital[k] / gw) | 0) + 0.5) * cs];
      if (P.showDip) {
        ctx.lineWidth = 1.5;
        for (let a = 0; a < CAP; a++) for (let b = a + 1; b < CAP; b++) {
          if (!alive[a] || !alive[b]) continue;
          const w = war(a, b), al = ally(a, b);
          if (!w && !al) continue;
          const [x1, y1] = pos(a), [x2, y2] = pos(b);
          ctx.strokeStyle = w ? 'rgba(248,113,113,0.75)' : 'rgba(134,239,172,0.7)';
          ctx.setLineDash(w ? [5, 4] : []);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < CAP; k++) {
        if (!alive[k]) continue;
        const [x, y] = pos(k);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!thumbnail && area[k] > 60) {
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(nameSpan(k), x, y - 8);
          ctx.fillStyle = '#f8fafc'; ctx.fillText(nameSpan(k), x, y - 8);
        }
      }
      ctx.textAlign = 'start';
      if (!thumbnail) {
        ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
        events.forEach((e, k) => {
          ctx.globalAlpha = Math.max(0.25, 1 - e.age / 900);
          ctx.fillStyle = 'rgba(5,7,13,0.65)';
          const tw = ctx.measureText(e.t).width;
          ctx.fillRect(12, H - 30 - k * 20, tw + 12, 18);
          ctx.fillStyle = e.c;
          ctx.fillText(e.t, 18, H - 17 - k * 20);
        });
        ctx.globalAlpha = 1;
      }
    };

    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down') return;
        const x = clamp((p.x / cs) | 0, 0, gw - 1), y = clamp((p.y / cs) | 0, 0, gh - 1), i = y * gw + x, k = owner[i];
        if (k < 0) return;
        if (p.shift) { army[k] *= 2.5; log(`${names[k]} raises a great army`, css(k)); }
        else revolt(k, i);
      },
      stats: () => {
        let n = 0, wars = 0, al = 0, big = -1, landTot = 0;
        for (let a = 0; a < CAP; a++) {
          if (!alive[a]) continue;
          n++; landTot += area[a];
          if (big < 0 || area[a] > area[big]) big = a;
          for (let b = a + 1; b < CAP; b++) if (alive[b]) { if (war(a, b)) wars++; else if (ally(a, b)) al++; }
        }
        return [['Nations', n], ['Wars', wars], ['Alliances', al], ['Largest', big >= 0 ? `${names[big]} (${((area[big] / (landTot || 1)) * 100).toFixed(0)}%)` : '—']];
      },
      actions: [
        { label: 'World peace', run: () => { for (let a = 0; a < CAP; a++) for (let b = a + 1; b < CAP; b++) if (rel[a * CAP + b] < 0) setRel(a, b, 0); log('A great peace is signed', '#93c5fd'); } },
        { label: 'Plague', run: () => { for (let k = 0; k < CAP; k++) army[k] *= 0.3; log('Plague sweeps the world', '#a3e635'); } },
      ],
    };
  },
};
