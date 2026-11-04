import type { SimDef } from '../core/types';
import { SpatialGrid, rand, gauss, TAU } from '../core/util';

export const murmuration: SimDef = {
  id: 'murmuration',
  title: 'Starling Murmuration',
  tagline: 'Thousands of starlings in 3D, each watching its few nearest neighbours, ripple like smoke when a falcon dives.',
  category: 'Swarms & Life',
  accent: '#fb923c',
  controls: 'Drag to orbit the camera · click to send the falcon at that spot',
  thumbSteps: 200,
  params: [
    { key: 'n', label: 'Starlings', min: 200, max: 6000, step: 100, default: 2500, reset: true },
    { key: 'speed', label: 'Flight speed', min: 1, max: 6, step: 0.1, default: 3 },
    { key: 'radius', label: 'Interaction radius', min: 8, max: 60, step: 1, default: 26 },
    { key: 'k', label: 'Neighbours tracked (topological)', min: 3, max: 15, step: 1, default: 7 },
    { key: 'align', label: 'Alignment', min: 0, max: 0.2, step: 0.005, default: 0.08 },
    { key: 'cohesion', label: 'Cohesion', min: 0, max: 0.05, step: 0.001, default: 0.01 },
    { key: 'separation', label: 'Separation', min: 0, max: 0.5, step: 0.01, default: 0.15 },
    { key: 'roost', label: 'Pull to roost', min: 0, max: 0.02, step: 0.0005, default: 0.004 },
    { key: 'noise', label: 'Turbulence', min: 0, max: 0.3, step: 0.01, default: 0.05 },
    { type: 'toggle', key: 'falcon', label: 'Peregrine falcon', default: true },
    { key: 'fear', label: 'Fear radius', min: 20, max: 200, step: 5, default: 90 },
    { type: 'toggle', key: 'spin', label: 'Auto-rotate camera', default: true },
  ],
  presets: [
    { name: 'Dusk murmuration', values: {} },
    { name: 'Calm', values: { falcon: false, noise: 0.02 } },
    { name: 'Loose cloud', values: { align: 0.02, cohesion: 0.004, k: 4 } },
    { name: 'Tight ribbon', values: { align: 0.18, cohesion: 0.02, k: 12, separation: 0.08 } },
    { name: 'Panic', values: { fear: 180, speed: 4.5 } },
  ],
  about: `<p>Field studies of starlings (Ballerini et al., 2008) found each bird responds to a fixed number of nearest neighbours — about <b>seven</b> — rather than to everyone within a distance. That <b>topological</b> rule keeps the flock cohesive even when it stretches and thins.</p>
<p>Here every bird aligns, coheres and separates using its k nearest neighbours in 3D, is gently pulled back toward the roost, and flees the falcon. Waves of turning sweep through the flock faster than any single bird could fly — the "scale-free correlation" that makes murmurations look like one organism.</p>`,
  create({ ctx, width: W, height: H, params: P, thumbnail }) {
    const N = thumbnail ? 1200 : (P.n as number), L = 500;
    const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
    const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
    const gx = new Float32Array(N), gy = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      px[i] = gauss() * 120; py[i] = gauss() * 50; pz[i] = gauss() * 120;
      const a = rand(TAU); vx[i] = Math.cos(a) * 2; vz[i] = Math.sin(a) * 2; vy[i] = gauss() * 0.3;
    }
    const grid = new SpatialGrid(L * 4, L * 4, 30);
    let lastR = -1;
    const falcon = { x: 600, y: -300, z: 0, vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, t: 0 };
    let yaw = 0.4, pitch = 0.25;
    const nd = new Float32Array(32), ni = new Int32Array(32);
    const step = () => {
      const R = P.radius as number, K = P.k as number, sp = P.speed as number;
      const al = P.align as number, co = P.cohesion as number, se = P.separation as number, ro = P.roost as number, no = P.noise as number;
      const fear = P.fear as number, hasF = P.falcon as boolean;
      for (let i = 0; i < N; i++) { gx[i] = px[i] + L * 2; gy[i] = pz[i] + L * 2; }
      if (R !== lastR) { grid.resize(L * 4, L * 4, R); lastR = R; }
      grid.build(gx, gy, N);
      if (hasF) {
        falcon.t--;
        if (falcon.t <= 0) { const j = (Math.random() * N) | 0; falcon.tx = px[j]; falcon.ty = py[j]; falcon.tz = pz[j]; falcon.t = 260; }
        const dx = falcon.tx - falcon.x, dy = falcon.ty - falcon.y, dz = falcon.tz - falcon.z, d = Math.hypot(dx, dy, dz) + 1e-6;
        falcon.vx += (dx / d) * 0.25; falcon.vy += (dy / d) * 0.25; falcon.vz += (dz / d) * 0.25;
        const fs = Math.hypot(falcon.vx, falcon.vy, falcon.vz), fmax = sp * 2.2;
        if (fs > fmax) { falcon.vx *= fmax / fs; falcon.vy *= fmax / fs; falcon.vz *= fmax / fs; }
        falcon.x += falcon.vx; falcon.y += falcon.vy; falcon.z += falcon.vz;
        if (d < 30) falcon.t = Math.min(falcon.t, 30);
      }
      for (let i = 0; i < N; i++) {
        let cnt = 0;
        grid.query(gx[i], gy[i], R, (j) => {
          if (j === i) return;
          const dx = px[j] - px[i], dy = py[j] - py[i], dz = pz[j] - pz[i], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > R * R) return;
          if (cnt < K) { let k = cnt++; while (k > 0 && nd[k - 1] > d2) { nd[k] = nd[k - 1]; ni[k] = ni[k - 1]; k--; } nd[k] = d2; ni[k] = j; }
          else if (d2 < nd[K - 1]) { let k = K - 1; while (k > 0 && nd[k - 1] > d2) { nd[k] = nd[k - 1]; ni[k] = ni[k - 1]; k--; } nd[k] = d2; ni[k] = j; }
        });
        let ax = 0, ay = 0, az = 0;
        if (cnt) {
          let mvx = 0, mvy = 0, mvz = 0, cx = 0, cy = 0, cz = 0, sx = 0, sy = 0, sz = 0;
          for (let k = 0; k < cnt; k++) {
            const j = ni[k];
            mvx += vx[j]; mvy += vy[j]; mvz += vz[j]; cx += px[j]; cy += py[j]; cz += pz[j];
            const inv = 1 / (nd[k] + 1);
            sx += (px[i] - px[j]) * inv; sy += (py[i] - py[j]) * inv; sz += (pz[i] - pz[j]) * inv;
          }
          ax += (mvx / cnt - vx[i]) * al + (cx / cnt - px[i]) * co + sx * se * 10;
          ay += (mvy / cnt - vy[i]) * al + (cy / cnt - py[i]) * co + sy * se * 10;
          az += (mvz / cnt - vz[i]) * al + (cz / cnt - pz[i]) * co + sz * se * 10;
        }
        ax -= px[i] * ro * 0.1; ay -= py[i] * ro * 0.3; az -= pz[i] * ro * 0.1;
        const r = Math.hypot(px[i], py[i], pz[i]);
        if (r > L) { ax -= (px[i] / r) * 0.1; ay -= (py[i] / r) * 0.1; az -= (pz[i] / r) * 0.1; }
        if (hasF) {
          const dx = px[i] - falcon.x, dy = py[i] - falcon.y, dz = pz[i] - falcon.z, d = Math.hypot(dx, dy, dz);
          if (d < fear) { const f = (1 - d / fear) * 0.6 / (d + 1e-3); ax += dx * f; ay += dy * f; az += dz * f; }
        }
        ax += gauss() * no; ay += gauss() * no * 0.5; az += gauss() * no;
        vx[i] += ax; vy[i] += ay; vz[i] += az;
        const s = Math.hypot(vx[i], vy[i], vz[i]) + 1e-6, target = s < sp * 0.6 ? sp * 0.6 : s > sp * 1.4 ? sp * 1.4 : s;
        vx[i] *= target / s; vy[i] *= target / s; vz[i] *= target / s;
      }
      for (let i = 0; i < N; i++) { px[i] += vx[i]; py[i] += vy[i]; pz[i] += vz[i]; }
      if (P.spin) yaw += 0.0015;
    };
    const order = new Uint32Array(N), depth = new Float32Array(N), sx = new Float32Array(N), sy = new Float32Array(N);
    const proj = (x: number, y: number, z: number): [number, number, number] => {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), spt = Math.sin(pitch);
      const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
      const y2 = y * cp - z1 * spt, z2 = y * spt + z1 * cp;
      const f = 900 / (900 + z2 + 600);
      const S = Math.min(W, H) / 700;
      return [W / 2 + x1 * f * S, H * 0.45 + y2 * f * S, f];
    };
    const draw = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1e1b4b'); g.addColorStop(0.55, '#9d4e7a'); g.addColorStop(0.85, '#f59e62'); g.addColorStop(1, '#fde68a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#120d1a';
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 30 - 14 * Math.sin(x * 0.01) - 8 * Math.sin(x * 0.037));
      ctx.lineTo(W, H); ctx.fill();
      for (let i = 0; i < N; i++) { const [a, b, f] = proj(px[i], py[i], pz[i]); sx[i] = a; sy[i] = b; depth[i] = f; order[i] = i; }
      ctx.fillStyle = 'rgba(15,10,20,0.85)';
      for (let i = 0; i < N; i++) {
        const f = depth[i], s = 1.6 * f * Math.min(W, H) / 700;
        ctx.globalAlpha = Math.min(1, 0.35 + f * 0.6);
        ctx.fillRect(sx[i] - s, sy[i] - s * 0.5, s * 2, s);
      }
      ctx.globalAlpha = 1;
      if (P.falcon) {
        const [a, b, f] = proj(falcon.x, falcon.y, falcon.z);
        ctx.fillStyle = '#000'; ctx.beginPath();
        const s = 7 * f;
        ctx.moveTo(a - s * 1.6, b - s * 0.3); ctx.lineTo(a, b + s * 0.4); ctx.lineTo(a + s * 1.6, b - s * 0.3); ctx.lineTo(a, b); ctx.fill();
      }
    };
    let dragged = false;
    return {
      step, draw,
      pointer(p) {
        if (p.type === 'down') dragged = false;
        if (p.type === 'move' && p.down) { yaw += p.dx * 0.005; pitch = Math.max(-1.2, Math.min(1.2, pitch + p.dy * 0.005)); if (Math.abs(p.dx) + Math.abs(p.dy) > 1) dragged = true; }
        if (p.type === 'up' && !dragged) {
          let best = 0, bd = Infinity;
          for (let i = 0; i < N; i += 7) { const d = (sx[i] - p.x) ** 2 + (sy[i] - p.y) ** 2; if (d < bd) { bd = d; best = i; } }
          falcon.tx = px[best]; falcon.ty = py[best]; falcon.tz = pz[best]; falcon.t = 200;
        }
      },
      stats: () => {
        let mx = 0, my = 0, mz = 0; for (let i = 0; i < N; i++) { const s = Math.hypot(vx[i], vy[i], vz[i]) || 1; mx += vx[i] / s; my += vy[i] / s; mz += vz[i] / s; }
        return [['Birds', N], ['Polarisation', Math.hypot(mx, my, mz) / N]];
      },
    };
  },
};
