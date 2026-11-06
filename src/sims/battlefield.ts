import type { SimDef } from '../core/types';
import { History, SpatialGrid, TAU, clamp, rand } from '../core/util';

const COLORS = ['#f87171', '#60a5fa', '#4ade80', '#facc15'];
const NAMES = ['Crimson', 'Azure', 'Verdant', 'Gold'];
// infantry, archers, cavalry
const SPEED = [0.55, 0.6, 1.35], HP = [10, 6, 12], MELEE = [1, 0.4, 1.3], RAD = [3.2, 2.8, 4.2];

export const battlefield: SimDef = {
  id: 'battlefield',
  title: 'Battlefield',
  tagline: 'Spears beat horses, horses ride down archers, arrows shred spearmen — and armies break when morale does.',
  category: 'Societies',
  accent: '#f43f5e',
  controls: 'Click to drop a squad for the selected army · drag to keep reinforcing',
  thumbSteps: 260,
  params: [
    { key: 'sides', label: 'Armies', min: 2, max: 4, step: 1, default: 2, reset: true },
    { type: 'select', key: 'teams', label: 'Alliances', default: 'ffa', reset: false, options: [
      { value: 'ffa', label: 'Everyone for themselves' }, { value: '2v2', label: 'Crimson+Verdant vs Azure+Gold' }, { value: '1vall', label: 'Everyone vs Crimson' }] },
    { key: 'size', label: 'Soldiers per army', min: 40, max: 800, step: 10, default: 320, reset: true },
    { key: 'ratio', label: 'Azure size ×', min: 0.25, max: 2.5, step: 0.05, default: 1, reset: true, hint: 'Lanchester: fighting strength scales with the square of numbers' },
    { type: 'select', key: 'formation', label: 'Formation', default: 'lines', reset: true, options: [
      { value: 'lines', label: 'Battle lines' }, { value: 'blocks', label: 'Mixed blocks' }, { value: 'scatter', label: 'Skirmish (scattered)' }] },
    { type: 'group', label: 'Army composition' },
    { key: 'inf', label: 'Infantry (spears)', min: 0, max: 1, step: 0.05, default: 0.5, reset: true },
    { key: 'arch', label: 'Archers', min: 0, max: 1, step: 0.05, default: 0.3, reset: true },
    { key: 'cav', label: 'Cavalry', min: 0, max: 1, step: 0.05, default: 0.2, reset: true },
    { type: 'group', label: 'Combat' },
    { key: 'counter', label: 'Counter bonus (rock–paper–scissors)', min: 1, max: 4, step: 0.1, default: 2.2 },
    { key: 'damage', label: 'Lethality', min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: 'range', label: 'Archer range', min: 40, max: 260, step: 5, default: 150 },
    { type: 'toggle', key: 'morale', label: 'Morale & routing', default: true },
    { key: 'courage', label: 'Courage', min: 0, max: 1, step: 0.01, default: 0.5, hint: 'Higher = fights on longer before fleeing' },
    { type: 'group', label: 'Reinforcements' },
    { type: 'select', key: 'dropSide', label: 'Mouse drops for', default: '0', options: NAMES.map((n, i) => ({ value: String(i), label: n })) },
    { type: 'select', key: 'dropType', label: 'Unit type', default: '2', options: [{ value: '0', label: 'Infantry' }, { value: '1', label: 'Archers' }, { value: '2', label: 'Cavalry' }] },
  ],
  presets: [
    { name: 'Pitched battle', values: {} },
    { name: 'Lanchester 2 : 1', values: { ratio: 2, formation: 'blocks', inf: 1, arch: 0, cav: 0, morale: false } },
    { name: 'Archer wall vs cavalry', values: { inf: 0.3, arch: 0.7, cav: 0 } },
    { name: 'Cavalry charge', values: { inf: 0.2, arch: 0.2, cav: 0.6 } },
    { name: 'Four-way melee', values: { sides: 4, size: 220 } },
    { name: '2 v 2 alliance', values: { sides: 4, size: 220, teams: '2v2' } },
    { name: 'Everyone vs Crimson', values: { sides: 3, size: 200, teams: '1vall' } },
    { name: 'Fearless (no morale)', values: { morale: false } },
  ],
  about: `<p>Each soldier is an agent: it picks the nearest enemy, closes in and strikes; archers hold back and loose arrows that land with some spread. Unit types form a <b>rock–paper–scissors</b> cycle — infantry spears counter cavalry, cavalry rides down archers, archers out-range infantry — scaled by the <em>counter bonus</em>.</p>
<p><b>Morale</b> drops when a soldier is hit, sees friends fall, or is outnumbered nearby; below a threshold it <b>routs</b> and runs for its own edge of the map, which can cascade into a collapse of the whole line. Turn morale off and battles become pure attrition, close to <b>Lanchester's square law</b>: an army twice as big wins while losing only about a seventh of its men.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const S = P.sides as number;
    const base = P.size as number;
    const cap = Math.ceil(base * S * 2.5) + 600;
    const x = new Float32Array(cap), y = new Float32Array(cap), vx = new Float32Array(cap), vy = new Float32Array(cap);
    const hp = new Float32Array(cap), mor = new Float32Array(cap), cd = new Float32Array(cap), retarget = new Int16Array(cap);
    const side = new Uint8Array(cap), type = new Uint8Array(cap), alive = new Uint8Array(cap), rout = new Uint8Array(cap);
    const target = new Int32Array(cap).fill(-1);
    let n = 0;
    const fled = new Int32Array(S), fallen = new Int32Array(S);
    const cx = W / 2, cy = H / 2;
    const homeAng = (s: number) => (S === 2 ? [Math.PI, 0][s] : Math.PI + (s * TAU) / S);
    const home = Array.from({ length: S }, (_, s) => {
      const a = homeAng(s);
      return { x: cx + Math.cos(a) * W * 0.6, y: cy + Math.sin(a) * H * 0.6, fx: -Math.cos(a), fy: -Math.sin(a) };
    });
    const team = (s: number) => {
      const t = P.teams;
      if (t === '2v2') return s % 2;
      if (t === '1vall') return s === 0 ? 0 : 1;
      return s;
    };
    const add = (s: number, t: number, px: number, py: number) => {
      let i = -1;
      if (n < cap) i = n++;
      else for (let k = 0; k < n; k++) if (!alive[k]) { i = k; break; }
      if (i < 0) return;
      x[i] = clamp(px, 2, W - 2); y[i] = clamp(py, 2, H - 2); vx[i] = vy[i] = 0;
      side[i] = s; type[i] = t; hp[i] = HP[t]; mor[i] = 1; cd[i] = rand(0, 40); alive[i] = 1; rout[i] = 0;
      target[i] = -1; retarget[i] = (Math.random() * 10) | 0;
    };

    const wsum = (P.inf as number) + (P.arch as number) + (P.cav as number) || 1;
    const sp = 7.5;
    for (let s = 0; s < S; s++) {
      const count = Math.round(base * (s === 1 ? (P.ratio as number) : 1));
      const nInf = Math.round((count * (P.inf as number)) / wsum), nArch = Math.round((count * (P.arch as number)) / wsum);
      const nCav = Math.max(0, count - nInf - nArch);
      const a = homeAng(s), fx = -Math.cos(a), fy = -Math.sin(a), lx = -fy, ly = fx;
      const dist = S === 2 ? W * 0.3 : Math.min(W, H) * 0.36;
      const ox = cx - fx * dist, oy = cy - fy * dist;
      const place = (fwd: number, lat: number, t: number) => add(s, t, ox + fx * fwd + lx * lat, oy + fy * fwd + ly * lat);
      if (P.formation === 'scatter') {
        const R = Math.min(W, H) * 0.18;
        const types = [...Array(nInf).fill(0), ...Array(nArch).fill(1), ...Array(nCav).fill(2)];
        for (const t of types) { const r = Math.sqrt(Math.random()) * R, q = rand(TAU); place(Math.cos(q) * r, Math.sin(q) * r, t); }
      } else if (P.formation === 'blocks') {
        const types = [...Array(nInf).fill(0), ...Array(nArch).fill(1), ...Array(nCav).fill(2)].sort(() => Math.random() - 0.5);
        const w = Math.ceil(Math.sqrt(types.length));
        types.forEach((t, k) => place(-((k / w) | 0) * sp, ((k % w) - w / 2) * sp, t));
      } else {
        const lineW = Math.max(10, Math.ceil(Math.sqrt(nInf * 4)));
        for (let k = 0; k < nInf; k++) place(-((k / lineW) | 0) * sp, ((k % lineW) - lineW / 2) * sp, 0);
        const rowsInf = Math.ceil(nInf / lineW);
        for (let k = 0; k < nArch; k++) place(-(rowsInf + 1 + ((k / lineW) | 0)) * sp, ((k % lineW) - lineW / 2) * sp, 1);
        const cw = 6;
        for (let k = 0; k < nCav; k++) {
          const flank = k % 2 ? 1 : -1, j = (k / 2) | 0;
          place(-((j / cw) | 0) * sp * 1.4, flank * ((lineW / 2) * sp + 14 + (j % cw) * sp * 1.4), 2);
        }
      }
    }

    const grid = new SpatialGrid(W, H, 20);
    const arrows: { x: number; y: number; vx: number; vy: number; t: number; s: number }[] = [];
    const hist = new History(NAMES.slice(0, S), COLORS.slice(0, S), 400);
    const ground = document.createElement('canvas');
    ground.width = Math.max(1, Math.round(W)); ground.height = Math.max(1, Math.round(H));
    const gctx = ground.getContext('2d')!;
    let frame = 0;

    const mult = (a: number, b: number) => {
      const c = P.counter as number;
      if ((a === 0 && b === 2) || (a === 2 && b === 1) || (a === 1 && b === 0)) return c;
      return 1;
    };
    const hurt = (j: number, dmg: number, by: number) => {
      hp[j] -= dmg;
      mor[j] -= dmg * 0.03;
      if (hp[j] <= 0 && alive[j]) die(j, by);
    };
    const die = (j: number, _by: number) => {
      alive[j] = 0; fallen[side[j]]++;
      gctx.fillStyle = COLORS[side[j]] + '40';
      gctx.fillRect(x[j] - 1.5, y[j] - 1.5, 3, 3);
      gctx.fillStyle = 'rgba(90,10,10,0.25)';
      gctx.beginPath(); gctx.arc(x[j] + rand(-2, 2), y[j] + rand(-2, 2), rand(1.5, 3.5), 0, TAU); gctx.fill();
      if (P.morale) grid.query(x[j], y[j], 45, (k) => { if (alive[k] && side[k] === side[j]) mor[k] -= 0.04; });
    };

    const step = () => {
      frame++;
      grid.build(x, y, n);
      const dmgK = (P.damage as number) * 0.12, range = P.range as number, morale = P.morale, brk = 0.45 - (P.courage as number) * 0.4;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const s = side[i], t = type[i], tm = team(s);
        let dx = 0, dy = 0;
        // separation + contact
        let sx = 0, sy = 0, near = -1, nd = 1e9;
        grid.query(x[i], y[i], 10, (j) => {
          if (j === i || !alive[j]) return;
          const ex = x[i] - x[j], ey = y[i] - y[j], d2 = ex * ex + ey * ey, rr = RAD[t] + RAD[type[j]];
          if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), f = (rr - d) / d; sx += ex * f; sy += ey * f; }
          if (team(side[j]) !== tm && d2 < nd) { nd = d2; near = j; }
        });
        if (--retarget[i] <= 0) {
          retarget[i] = 12 + ((Math.random() * 8) | 0);
          let best = -1, bd = 1e12, fr = 0, en = 0;
          grid.query(x[i], y[i], t === 1 ? Math.max(range, 120) : 120, (j) => {
            if (!alive[j]) return;
            const ex = x[j] - x[i], ey = y[j] - y[i], d2 = ex * ex + ey * ey;
            if (team(side[j]) === tm) { if (d2 < 3600) fr++; return; }
            if (d2 < 3600) en++;
            let w = d2;
            if (mult(t, type[j]) > 1) w *= 0.6;
            if (w < bd) { bd = w; best = j; }
          });
          target[i] = best;
          if (morale) {
            mor[i] += 0.012 * (fr - 1.4 * en) / (fr + en + 1) + 0.004;
            mor[i] = clamp(mor[i], -0.2, 1);
            if (!rout[i] && mor[i] < brk) rout[i] = 1;
            else if (rout[i] && mor[i] > brk + 0.35) rout[i] = 0;
          } else { rout[i] = 0; mor[i] = 1; }
        }
        let tg = target[i];
        if (tg >= 0 && !alive[tg]) { tg = target[i] = -1; retarget[i] = 0; }
        const speed = SPEED[t];
        if (rout[i]) {
          const h = home[s];
          dx = h.x - x[i]; dy = h.y - y[i];
          if (x[i] < 3 || y[i] < 3 || x[i] > W - 3 || y[i] > H - 3) { alive[i] = 0; fled[s]++; continue; }
        } else if (near >= 0 && nd < (RAD[t] + RAD[type[near]] + 2) ** 2) {
          // melee
          const charge = t === 2 ? 1 + Math.hypot(vx[i], vy[i]) * 0.8 : 1;
          hurt(near, MELEE[t] * mult(t, type[near]) * dmgK * charge * (0.5 + Math.random()), s);
          vx[i] *= 0.5; vy[i] *= 0.5;
          dx = x[near] - x[i]; dy = y[near] - y[i];
        } else if (tg >= 0) {
          dx = x[tg] - x[i]; dy = y[tg] - y[i];
          const d = Math.hypot(dx, dy);
          if (t === 1) {
            if (d < range && --cd[i] <= 0) {
              cd[i] = rand(35, 55);
              const spread = d * 0.12, tx = x[tg] + vx[tg] * d / 5 + rand(-spread, spread), ty = y[tg] + vy[tg] * d / 5 + rand(-spread, spread);
              const ad = Math.hypot(tx - x[i], ty - y[i]) || 1;
              arrows.push({ x: x[i], y: y[i], vx: ((tx - x[i]) / ad) * 5, vy: ((ty - y[i]) / ad) * 5, t: ad / 5, s });
            }
            if (d < range * 0.55) { dx = -dx; dy = -dy; } else if (d < range * 0.95) { dx = 0; dy = 0; }
          }
        } else {
          const h = home[s];
          dx = h.fx; dy = h.fy;
        }
        const dl = Math.hypot(dx, dy);
        const sv = rout[i] ? speed * 1.2 : speed;
        const tx = dl > 1e-6 ? (dx / dl) * sv : 0, ty = dl > 1e-6 ? (dy / dl) * sv : 0;
        const inert = t === 2 ? 0.08 : 0.2;
        vx[i] += (tx - vx[i]) * inert; vy[i] += (ty - vy[i]) * inert;
        x[i] += vx[i] + sx * 0.5; y[i] += vy[i] + sy * 0.5;
        if (!rout[i]) { x[i] = clamp(x[i], 2, W - 2); y[i] = clamp(y[i], 2, H - 2); }
      }
      for (let k = arrows.length - 1; k >= 0; k--) {
        const a = arrows[k];
        a.x += a.vx; a.y += a.vy; a.t--;
        if (a.t <= 0) {
          let hit = -1;
          const tm = team(a.s);
          grid.query(a.x, a.y, 5, (j) => { if (hit < 0 && alive[j] && team(side[j]) !== tm && (x[j] - a.x) ** 2 + (y[j] - a.y) ** 2 < 25) hit = j; });
          if (hit >= 0) hurt(hit, 1.6 * mult(1, type[hit]) * dmgK * 2.2, a.s);
          arrows[k] = arrows[arrows.length - 1]; arrows.pop();
        }
      }
      if (frame % 4 === 0) {
        const cnt = new Array(S).fill(0);
        for (let i = 0; i < n; i++) if (alive[i] && !rout[i]) cnt[side[i]]++;
        hist.push(...cnt);
      }
    };

    const draw = () => {
      ctx.fillStyle = '#0c120c'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(ground, 0, 0, W, H);
      for (let s = 0; s < S; s++) {
        for (const r of [0, 1]) {
          ctx.fillStyle = COLORS[s];
          ctx.globalAlpha = r ? 0.35 : 1;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            if (!alive[i] || side[i] !== s || rout[i] !== r) continue;
            const t = type[i];
            if (t === 0) ctx.rect(x[i] - 2.4, y[i] - 2.4, 4.8, 4.8);
            else if (t === 1) { ctx.moveTo(x[i] + 2.2, y[i]); ctx.arc(x[i], y[i], 2.2, 0, TAU); }
            else {
              const a = Math.atan2(vy[i], vx[i]) || homeAng(s) + Math.PI, c = Math.cos(a), q = Math.sin(a);
              ctx.moveTo(x[i] + c * 5, y[i] + q * 5);
              ctx.lineTo(x[i] - c * 3 - q * 3, y[i] - q * 3 + c * 3);
              ctx.lineTo(x[i] - c * 3 + q * 3, y[i] - q * 3 - c * 3);
              ctx.closePath();
            }
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,245,220,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const a of arrows) { ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx * 1.4, a.y - a.vy * 1.4); }
      ctx.stroke();
      if (!thumbnail) hist.draw(ctx, W - 280, H - 92, 268, 80, { title: 'Fighting' });
    };

    return {
      step, draw,
      pointer(p) {
        if (p.type !== 'down' && !(p.down && frame % 6 === 0)) return;
        const s = Math.min(S - 1, +P.dropSide), t = +P.dropType;
        for (let k = 0; k < 16; k++) add(s, t, p.x + ((k % 4) - 1.5) * 8, p.y + (((k / 4) | 0) - 1.5) * 8);
      },
      stats: () => {
        const out: [string, string | number][] = [];
        for (let s = 0; s < S; s++) {
          let a = 0, r = 0;
          for (let i = 0; i < n; i++) if (alive[i] && side[i] === s) { a++; if (rout[i]) r++; }
          out.push([NAMES[s], `${a - r} fighting · ${r} fleeing · ${fallen[s]} fallen · ${fled[s]} fled`]);
        }
        return out;
      },
      actions: [
        { label: 'Rally everyone', run: () => { for (let i = 0; i < n; i++) { mor[i] = 1; rout[i] = 0; } } },
        { label: 'Clear the dead', run: () => gctx.clearRect(0, 0, ground.width, ground.height) },
      ],
    };
  },
};
