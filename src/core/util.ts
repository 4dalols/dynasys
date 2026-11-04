export const TAU = Math.PI * 2;

export const rand = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a: number, b: number) => Math.floor(rand(a, b));
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const gauss = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function hsl(h: number, s: number, l: number, a = 1) {
  return a === 1 ? `hsl(${h},${s}%,${l}%)` : `hsla(${h},${s}%,${l}%,${a})`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Build a 256-entry RGB lookup table from color stops. */
export function makePalette(stops: [number, string][]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const s = stops.map(([t, c]) => [t, ...hexToRgb(c)] as [number, number, number, number]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const a = s[k], b = s[k + 1];
    const u = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1);
    lut[i * 3] = lerp(a[1], b[1], u);
    lut[i * 3 + 1] = lerp(a[2], b[2], u);
    lut[i * 3 + 2] = lerp(a[3], b[3], u);
  }
  return lut;
}

export const PALETTES: Record<string, [number, string][]> = {
  inferno: [[0, '#000004'], [0.25, '#57106e'], [0.5, '#bc3754'], [0.75, '#f98e09'], [1, '#fcffa4']],
  viridis: [[0, '#0d0221'], [0.25, '#3b528b'], [0.5, '#21918c'], [0.75, '#5ec962'], [1, '#fde725']],
  ocean: [[0, '#020617'], [0.35, '#0c4a6e'], [0.65, '#22d3ee'], [1, '#f0fdfa']],
  ember: [[0, '#0a0503'], [0.4, '#7c2d12'], [0.7, '#f97316'], [1, '#fff7ed']],
  aurora: [[0, '#030712'], [0.3, '#134e4a'], [0.6, '#a855f7'], [0.85, '#f0abfc'], [1, '#ffffff']],
  bone: [[0, '#050505'], [1, '#f5f5f4']],
  toxic: [[0, '#020a04'], [0.4, '#14532d'], [0.75, '#a3e635'], [1, '#fefce8']],
};

export const paletteOptions = Object.keys(PALETTES).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }));

/**
 * A low-resolution pixel buffer that is scaled up to fill the canvas.
 */
export class PixelBuffer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly data: Uint8ClampedArray;
  constructor(public w: number, public h: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.image = this.ctx.createImageData(w, h);
    this.data = this.image.data;
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
  }
  /** Map a scalar field (0..1) through a palette. */
  fromField(field: ArrayLike<number>, lut: Uint8ClampedArray, scale = 1, offset = 0) {
    const d = this.data;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      let v = (field[i] * scale + offset) * 255;
      v = v < 0 ? 0 : v > 255 ? 255 : v | 0;
      d[i * 4] = lut[v * 3];
      d[i * 4 + 1] = lut[v * 3 + 1];
      d[i * 4 + 2] = lut[v * 3 + 2];
    }
  }
  blit(ctx: CanvasRenderingContext2D, width: number, height: number, smooth = false) {
    this.ctx.putImageData(this.image, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(this.canvas, 0, 0, width, height);
    ctx.restore();
  }
}

/** Uniform-grid spatial hash for neighbor queries among moving points. */
export class SpatialGrid {
  cols = 0;
  rows = 0;
  cellStart: Int32Array = new Int32Array(0);
  cellCount: Int32Array = new Int32Array(0);
  items: Int32Array = new Int32Array(0);
  private cellOf: Int32Array = new Int32Array(0);
  constructor(public width: number, public height: number, public cell: number) {
    this.resize(width, height, cell);
  }
  resize(width: number, height: number, cell: number) {
    this.width = width;
    this.height = height;
    this.cell = Math.max(4, cell);
    this.cols = Math.max(1, Math.ceil(width / this.cell));
    this.rows = Math.max(1, Math.ceil(height / this.cell));
    this.cellStart = new Int32Array(this.cols * this.rows + 1);
    this.cellCount = new Int32Array(this.cols * this.rows);
  }
  build(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number) {
    if (this.items.length < n) {
      this.items = new Int32Array(n * 2);
      this.cellOf = new Int32Array(n * 2);
    }
    const { cols, rows, cell } = this;
    this.cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      const cx = clamp((xs[i] / cell) | 0, 0, cols - 1);
      const cy = clamp((ys[i] / cell) | 0, 0, rows - 1);
      const c = cy * cols + cx;
      this.cellOf[i] = c;
      this.cellCount[c]++;
    }
    let acc = 0;
    for (let c = 0; c < cols * rows; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
    }
    this.cellStart[cols * rows] = acc;
    const fill = this.cellCount;
    fill.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];
      this.items[this.cellStart[c] + fill[c]++] = i;
    }
  }
  /** Calls fn(j) for every item in cells overlapping the radius around (x,y). wrap = toroidal. */
  query(x: number, y: number, r: number, fn: (j: number) => void, wrap = false) {
    const { cols, rows, cell } = this;
    const span = Math.ceil(r / cell);
    const cx = (x / cell) | 0, cy = (y / cell) | 0;
    for (let oy = -span; oy <= span; oy++) {
      let gy = cy + oy;
      if (wrap) gy = (gy + rows) % rows;
      else if (gy < 0 || gy >= rows) continue;
      for (let ox = -span; ox <= span; ox++) {
        let gx = cx + ox;
        if (wrap) gx = (gx + cols) % cols;
        else if (gx < 0 || gx >= cols) continue;
        const c = gy * cols + gx;
        for (let k = this.cellStart[c], e = this.cellStart[c + 1]; k < e; k++) fn(this.items[k]);
      }
    }
  }
}

/** Rolling time series + mini chart renderer. */
export class History {
  series: number[][];
  constructor(public names: string[], public colors: string[], public max = 400) {
    this.series = names.map(() => []);
  }
  push(...vals: number[]) {
    vals.forEach((v, i) => {
      const s = this.series[i];
      s.push(v);
      if (s.length > this.max) s.shift();
    });
  }
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts: { yMax?: number; title?: string } = {}) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    let m = opts.yMax ?? 0;
    if (!opts.yMax) for (const s of this.series) for (const v of s) if (v > m) m = v;
    m = m || 1;
    const pad = 8, top = opts.title ? 20 : 8;
    const iw = w - pad * 2, ih = h - top - pad;
    this.series.forEach((s, i) => {
      if (s.length < 2) return;
      ctx.strokeStyle = this.colors[i];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < s.length; k++) {
        const px = x + pad + (k / (this.max - 1)) * iw;
        const py = y + top + ih - (s[k] / m) * ih;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    });
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    let tx = x + pad;
    if (opts.title) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(opts.title, tx, y + 5);
      tx += ctx.measureText(opts.title).width + 10;
    }
    this.names.forEach((n, i) => {
      ctx.fillStyle = this.colors[i];
      const label = `${n} ${Math.round(this.series[i][this.series[i].length - 1] ?? 0)}`;
      if (opts.title || i > 0 || true) {
        ctx.fillText(label, tx, y + 5);
        tx += ctx.measureText(label).width + 10;
      }
    });
    ctx.restore();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fade the canvas toward a background color (motion trails). */
export function fade(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, color = '5,7,13') {
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number, color = '#05070d') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Stamp a disc into a grid (for brushes). */
export function stampGrid(w: number, h: number, cx: number, cy: number, r: number, fn: (i: number, falloff: number) => void) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= r2) fn(y * w + x, 1 - Math.sqrt(d2) / (r || 1));
    }
  }
}
