import type { SimDef } from '../core/types';
import { TAU, gauss, rand } from '../core/util';

type Body = { x: number; y: number; vx: number; vy: number; ax: number; ay: number; m: number; hue: number; trail: number[]; alive: boolean };

export const gravity: SimDef = {
  id: 'gravity',
  title: 'Gravity Sandbox',
  tagline: 'N-body gravitation: accreting planetesimals, colliding galaxies, the figure-eight three-body orbit.',
  category: 'Cosmos & Mechanics',
  accent: '#fbbf24',
  controls: 'Drag to fling a new body · right-drag to pan · scroll to zoom',
  thumbSteps: 320,
  params: [
    { type: 'select', key: 'scenario', label: 'Scenario', default: 'accretion', reset: true, options: [
      { value: 'accretion', label: 'Planet formation' }, { value: 'solar', label: 'Solar system' },
      { value: 'galaxies', label: 'Galaxy collision' }, { value: 'figure8', label: 'Figure-eight 3-body' },
      { value: 'binary', label: 'Binary star + planets' }, { value: 'cluster', label: 'Star cluster' },
      { value: 'empty', label: 'Empty space' } ] },
    { key: 'bodies', label: 'Bodies (formation / cluster)', min: 20, max: 1500, step: 10, default: 600, reset: true },
    { type: 'group', label: 'Physics' },
    { key: 'G', label: 'Gravity G', min: 0.1, max: 4, step: 0.05, default: 1 },
    { key: 'dt', label: 'Time step', min: 0.005, max: 0.2, step: 0.005, default: 0.05 },
    { key: 'soft', label: 'Softening', min: 0, max: 20, step: 0.5, default: 2 },
    { type: 'toggle', key: 'merge', label: 'Merge on collision', default: true },
    { key: 'newMass', label: 'Flung body mass', min: 1, max: 2000, step: 1, default: 20 },
    { type: 'group', label: 'View' },
    { type: 'toggle', key: 'trails', label: 'Trails', default: true },
    { key: 'trailLen', label: 'Trail length', min: 10, max: 600, step: 10, default: 120 },
    { type: 'toggle', key: 'follow', label: 'Follow centre of mass', default: true },
  ],
  presets: [
    { name: 'Planet formation', values: { scenario: 'accretion' } },
    { name: 'Solar system', values: { scenario: 'solar', soft: 0.5, trailLen: 300 } },
    { name: 'Galaxy collision', values: { scenario: 'galaxies', trails: false, merge: false, soft: 4 } },
    { name: 'Figure-eight', values: { scenario: 'figure8', soft: 0, merge: false, dt: 0.02, trailLen: 600 } },
    { name: 'Binary star', values: { scenario: 'binary', soft: 0.5, trailLen: 250 } },
    { name: 'Cluster', values: { scenario: 'cluster', merge: false, trails: false, bodies: 800, soft: 4 } },
  ],
  about: `<p>Every body pulls on every other with Newton's inverse-square law, integrated with a symplectic <b>leapfrog</b> scheme that conserves energy well over long runs.</p>
<div class="eq">a_i = G Σ_j m_j (r_j − r_i) / (|r_j − r_i|² + ε²)^{3/2}</div>
<p><b>Planet formation</b>: a rotating disc of planetesimals merges (momentum-conserving) into a few planets. <b>Galaxy collision</b>: two cores carry discs of massless stars whose tidal tails mimic the Antennae galaxies. The <b>figure-eight</b> is Chenciner &amp; Montgomery's choreography where three equal masses chase each other on one curve — set softening to 0 and watch how long it survives numerical error.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const bodies: Body[] = [];
    let dust = { x: new Float32Array(0), y: new Float32Array(0), vx: new Float32Array(0), vy: new Float32Array(0), hue: new Float32Array(0), n: 0 };
    const cam = { x: 0, y: 0, zoom: 1 };
    const add = (x: number, y: number, vx: number, vy: number, m: number, hue = rand(180, 260)) =>
      bodies.push({ x, y, vx, vy, ax: 0, ay: 0, m, hue, trail: [], alive: true });
    const S = Math.min(W, H);
    const scen = P.scenario as string;

    if (scen === 'accretion') {
      add(0, 0, 0, 0, 1500, 45);
      const n = P.bodies as number;
      for (let i = 0; i < n; i++) {
        const r = S * (0.08 + 0.38 * Math.sqrt(Math.random())), a = rand(TAU);
        const v = Math.sqrt((P.G * (1500 + n * 0.4 * (r / (S * 0.46)))) / r) * rand(0.97, 1.03);
        add(Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, rand(0.5, 3));
      }
    } else if (scen === 'solar') {
      const M = 4000;
      add(0, 0, 0, 0, M, 45);
      const orbits = [0.08, 0.13, 0.19, 0.25, 0.33, 0.41, 0.47];
      const masses = [0.5, 3, 4, 1.5, 60, 40, 12];
      const hues = [20, 40, 200, 10, 30, 50, 190];
      orbits.forEach((o, k) => {
        const r = o * S, a = rand(TAU), v = Math.sqrt((P.G * M) / r);
        add(Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, masses[k], hues[k]);
        if (k === 4) { // a moon for the giant
          const mr = 14, mv = Math.sqrt((P.G * masses[k]) / mr);
          add(Math.cos(a) * (r + mr), Math.sin(a) * (r + mr), -Math.sin(a) * (v + mv), Math.cos(a) * (v + mv), 0.05, 0);
        }
      });
      for (let i = 0; i < 120; i++) { // asteroid belt
        const r = S * rand(0.28, 0.3), a = rand(TAU), v = Math.sqrt((P.G * M) / r);
        add(Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, 0.01, 30);
      }
    } else if (scen === 'figure8') {
      const L = S * 0.3, M = 1000, f = Math.sqrt((P.G * M) / L);
      const p1 = [0.97000436, -0.24308753], v3 = [-0.93240737, -0.86473146];
      add(p1[0] * L, p1[1] * L, (-v3[0] / 2) * f, (-v3[1] / 2) * f, M, 0);
      add(-p1[0] * L, -p1[1] * L, (-v3[0] / 2) * f, (-v3[1] / 2) * f, M, 120);
      add(0, 0, v3[0] * f, v3[1] * f, M, 220);
    } else if (scen === 'binary') {
      const M = 1500, d = S * 0.06, v = Math.sqrt((P.G * M) / (4 * d));
      add(-d, 0, 0, -v, M, 30);
      add(d, 0, 0, v, M, 210);
      for (let i = 0; i < 6; i++) {
        const r = S * (0.2 + i * 0.05), a = rand(TAU), vv = Math.sqrt((P.G * 2 * M) / r);
        add(Math.cos(a) * r, Math.sin(a) * r, -Math.sin(a) * vv, Math.cos(a) * vv, rand(1, 8), rand(100, 330));
      }
    } else if (scen === 'cluster') {
      const n = P.bodies as number;
      for (let i = 0; i < n; i++) {
        const r = S * 0.25 * Math.pow(Math.random(), 0.7), a = rand(TAU);
        add(Math.cos(a) * r, Math.sin(a) * r, gauss() * 1.2, gauss() * 1.2, rand(1, 10), rand(0, 360));
      }
    } else if (scen === 'galaxies') {
      const M = 6000, per = thumbnail ? 1200 : 3500;
      const n = per * 2;
      dust = { x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), hue: new Float32Array(n), n };
      const gal = (cx: number, cy: number, vx: number, vy: number, hue: number, spin: number, off: number) => {
        add(cx, cy, vx, vy, M, hue);
        for (let i = 0; i < per; i++) {
          const r = S * (0.03 + 0.17 * Math.sqrt(Math.random())), a = rand(TAU), v = Math.sqrt((P.G * M) / r) * spin;
          const k = off + i;
          dust.x[k] = cx + Math.cos(a) * r; dust.y[k] = cy + Math.sin(a) * r;
          dust.vx[k] = vx - Math.sin(a) * v; dust.vy[k] = vy + Math.cos(a) * v;
          dust.hue[k] = hue + rand(-20, 20);
        }
      };
      const sep = S * 0.36;
      gal(-sep, -sep * 0.35, 3.2, 0.6, 200, 1, 0);
      gal(sep, sep * 0.35, -3.2, -0.6, 320, -1, per);
    }

    const accel = () => {
      const G = P.G as number, e2 = (P.soft as number) ** 2 + 1e-6;
      const n = bodies.length;
      for (const b of bodies) { b.ax = 0; b.ay = 0; }
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy + e2, inv = G / (d2 * Math.sqrt(d2));
          a.ax += dx * inv * b.m; a.ay += dy * inv * b.m;
          b.ax -= dx * inv * a.m; b.ay -= dy * inv * a.m;
        }
      }
    };
    accel();
    const radius = (m: number) => Math.max(1.2, Math.cbrt(m) * 0.9);
    let merges = 0;

    const step = () => {
      const dt = P.dt as number;
      for (const b of bodies) { b.vx += b.ax * dt * 0.5; b.vy += b.ay * dt * 0.5; b.x += b.vx * dt; b.y += b.vy * dt; }
      accel();
      for (const b of bodies) { b.vx += b.ax * dt * 0.5; b.vy += b.ay * dt * 0.5; }
      // dust: test particles under massive bodies only
      if (dust.n) {
        const G = P.G as number, e2 = (P.soft as number) ** 2 + 4;
        const heavy = bodies.filter((b) => b.m > 100);
        for (let k = 0; k < dust.n; k++) {
          let ax = 0, ay = 0;
          for (const b of heavy) {
            const dx = b.x - dust.x[k], dy = b.y - dust.y[k], d2 = dx * dx + dy * dy + e2, inv = (G * b.m) / (d2 * Math.sqrt(d2));
            ax += dx * inv; ay += dy * inv;
          }
          dust.vx[k] += ax * dt; dust.vy[k] += ay * dt;
          dust.x[k] += dust.vx[k] * dt; dust.y[k] += dust.vy[k] * dt;
        }
      }
      if (P.merge) {
        bodies.sort((a, b) => a.x - b.x);
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i];
          if (!a.alive) continue;
          const ra = radius(a.m);
          for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j];
            if (b.x - a.x > ra + 40) break;
            if (!b.alive) continue;
            const dx = b.x - a.x, dy = b.y - a.y, rr = ra + radius(b.m);
            if (dx * dx + dy * dy < rr * rr) {
              const m = a.m + b.m;
              const big = a.m >= b.m ? a : b;
              a.x = (a.x * a.m + b.x * b.m) / m; a.y = (a.y * a.m + b.y * b.m) / m;
              a.vx = (a.vx * a.m + b.vx * b.m) / m; a.vy = (a.vy * a.m + b.vy * b.m) / m;
              a.hue = big.hue; a.trail = big.trail; a.m = m;
              b.alive = false; merges++;
            }
          }
        }
        for (let i = bodies.length - 1; i >= 0; i--) if (!bodies[i].alive) bodies.splice(i, 1);
      }
      const tl = P.trailLen as number;
      if (P.trails && bodies.length <= 400) for (const b of bodies) {
        b.trail.push(b.x, b.y);
        if (b.trail.length > tl * 2) b.trail.splice(0, b.trail.length - tl * 2);
      }
      if (P.follow && bodies.length) {
        let mx = 0, my = 0, mm = 0;
        for (const b of bodies) { mx += b.x * b.m; my += b.y * b.m; mm += b.m; }
        cam.x += (mx / mm - cam.x) * 0.1; cam.y += (my / mm - cam.y) * 0.1;
      }
    };

    const toScreen = (x: number, y: number): [number, number] => [(x - cam.x) * cam.zoom + W / 2, (y - cam.y) * cam.zoom + H / 2];
    const toWorld = (sx: number, sy: number): [number, number] => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
    const stars = Array.from({ length: 160 }, () => [rand(W), rand(H), rand(0.2, 0.8)]);
    let drag: { x0: number; y0: number; x: number; y: number } | null = null;

    const draw = () => {
      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, W, H);
      for (const [sx, sy, a] of stars) { ctx.fillStyle = `rgba(200,210,255,${a * 0.5})`; ctx.fillRect(sx, sy, 1, 1); }
      ctx.globalCompositeOperation = 'lighter';
      if (dust.n) {
        for (let k = 0; k < dust.n; k++) {
          const [sx, sy] = toScreen(dust.x[k], dust.y[k]);
          if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
          ctx.fillStyle = `hsla(${dust.hue[k]},80%,65%,0.55)`;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
      }
      if (P.trails) {
        ctx.lineWidth = 1;
        for (const b of bodies) {
          const t = b.trail;
          if (t.length < 4) continue;
          ctx.strokeStyle = `hsla(${b.hue},80%,60%,0.35)`;
          ctx.beginPath();
          for (let k = 0; k < t.length; k += 2) {
            const [sx, sy] = toScreen(t[k], t[k + 1]);
            k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
          }
          ctx.stroke();
        }
      }
      for (const b of bodies) {
        const [sx, sy] = toScreen(b.x, b.y);
        const r = radius(b.m) * cam.zoom;
        if (b.m > 300) {
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
          g.addColorStop(0, `hsla(${b.hue},100%,85%,1)`);
          g.addColorStop(0.25, `hsla(${b.hue},100%,60%,0.6)`);
          g.addColorStop(1, `hsla(${b.hue},100%,50%,0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(sx, sy, r * 4, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = `hsl(${b.hue},70%,${b.m > 300 ? 90 : 65}%)`;
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.8, r), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (drag) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(drag.x0, drag.y0); ctx.lineTo(drag.x, drag.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(drag.x0, drag.y0, Math.max(2, radius(P.newMass) * cam.zoom), 0, TAU); ctx.fill();
      }
    };

    return {
      step, draw,
      pointer(p) {
        if (p.button === 2 || p.shift) {
          if (p.down && p.type === 'move') { cam.x -= p.dx / cam.zoom; cam.y -= p.dy / cam.zoom; P.follow = false; }
          return;
        }
        if (p.type === 'down') drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
        else if (p.type === 'move' && drag) { drag.x = p.x; drag.y = p.y; }
        else if (p.type === 'up' && drag) {
          const [wx, wy] = toWorld(drag.x0, drag.y0);
          const k = 0.04 / cam.zoom;
          add(wx, wy, (drag.x0 - drag.x) * k * 2, (drag.y0 - drag.y) * k * 2, P.newMass, rand(0, 360));
          const b = bodies[bodies.length - 1];
          b.vx += P.follow ? 0 : 0;
          drag = null;
        }
      },
      wheel(x, y, delta) {
        const [wx, wy] = toWorld(x, y);
        cam.zoom *= Math.exp(-delta * 0.0015);
        cam.zoom = Math.min(20, Math.max(0.05, cam.zoom));
        const [nx, ny] = toWorld(x, y);
        cam.x += wx - nx; cam.y += wy - ny;
      },
      stats: () => {
        let ke = 0, mm = 0;
        for (const b of bodies) { ke += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy); mm += b.m; }
        const biggest = bodies.reduce((a, b) => Math.max(a, b.m), 0);
        return [['Bodies', bodies.length], ['Test stars', dust.n], ['Merges', merges], ['Largest mass', biggest], ['Total mass', mm], ['Kinetic energy', ke], ['Zoom', cam.zoom]];
      },
      actions: [
        { label: 'Zoom to fit', run: () => {
          let R = 1; for (const b of bodies) R = Math.max(R, Math.hypot(b.x - cam.x, b.y - cam.y));
          cam.zoom = Math.min(4, (Math.min(W, H) * 0.45) / R);
        } },
        { label: 'Clear dust', run: () => { dust.n = 0; } },
      ],
    };
  },
};
