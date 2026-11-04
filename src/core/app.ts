import type { ParamDef, ParamGroup, Params, PointerInfo, SimDef, SimInstance } from './types';

const CATEGORY_ORDER = ['Swarms & Life', 'Cosmos & Mechanics', 'Chaos', 'Growth & Patterns', 'Waves & Fluids', 'Societies'];
const THUMB_VERSION = 'v1';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

const isParam = (p: ParamDef | ParamGroup): p is ParamDef => p.type !== 'group';

export function defaults(def: SimDef): Params {
  const out: Params = {};
  for (const p of def.params) if (isParam(p)) out[p.key] = p.default;
  return out;
}

function parseQuery(def: SimDef, q: string): Params {
  const out: Params = {};
  const sp = new URLSearchParams(q);
  for (const p of def.params) {
    if (!isParam(p) || !sp.has(p.key)) continue;
    const raw = sp.get(p.key)!;
    if (p.type === 'toggle') out[p.key] = raw === '1' || raw === 'true';
    else if (p.type === 'select' || p.type === 'color') out[p.key] = raw;
    else if (!Number.isNaN(Number(raw))) out[p.key] = Number(raw);
  }
  return out;
}

export class App {
  private root: HTMLElement;
  private cleanup: (() => void) | null = null;
  private byId = new Map<string, SimDef>();

  constructor(root: HTMLElement, private sims: SimDef[]) {
    this.root = root;
    for (const s of sims) this.byId.set(s.id, s);
    window.addEventListener('hashchange', () => this.route());
    this.route();
  }

  private route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [id, q = ''] = h.split('?');
    this.cleanup?.();
    this.cleanup = null;
    this.root.innerHTML = '';
    const def = this.byId.get(id);
    if (def) this.cleanup = mountSim(this.root, def, parseQuery(def, q), this.sims);
    else this.cleanup = mountGallery(this.root, this.sims);
    window.scrollTo(0, 0);
  }
}

/* ------------------------------------------------------------------ gallery */

function mountGallery(root: HTMLElement, sims: SimDef[]) {
  document.title = 'dynasys — playground of dynamical systems';
  const page = el('div', 'gallery');
  const hero = el('header', 'hero');
  const heroCanvas = el('canvas', 'hero-canvas');
  hero.append(heroCanvas);
  hero.append(
    el(
      'div',
      'hero-text',
      `<h1>dynasys</h1>
       <p>A playground of dynamical systems. Simple local rules, wild emergent behaviour.
       Pick a world, poke it, and turn the knobs.</p>
       <div class="hero-meta">${sims.length} simulations · runs entirely in your browser</div>`,
    ),
  );
  page.append(hero);
  const stopHero = heroAnimation(heroCanvas);

  const cats = CATEGORY_ORDER.filter((c) => sims.some((s) => s.category === c));
  const thumbJobs: { def: SimDef; img: HTMLDivElement }[] = [];
  for (const cat of cats) {
    const sec = el('section', 'cat');
    sec.append(el('h2', '', cat));
    const grid = el('div', 'cards');
    for (const def of sims.filter((s) => s.category === cat)) {
      const a = el('a', 'card') as HTMLAnchorElement;
      a.href = `#/${def.id}`;
      a.style.setProperty('--accent', def.accent);
      const img = el('div', 'thumb');
      a.append(img, el('div', 'card-body', `<h3>${def.title}</h3><p>${def.tagline}</p>`));
      grid.append(a);
      thumbJobs.push({ def, img });
    }
    sec.append(grid);
    page.append(sec);
  }
  page.append(
    el(
      'footer',
      'foot',
      `Keyboard in a sim: <kbd>space</kbd> pause · <kbd>.</kbd> step · <kbd>r</kbd> reset · <kbd>h</kbd> hide panel · <kbd>esc</kbd> back`,
    ),
  );
  root.append(page);

  let cancelled = false;
  const runJobs = async () => {
    for (const job of thumbJobs) {
      if (cancelled) return;
      const key = `thumb:${THUMB_VERSION}:${job.def.id}`;
      let url: string | null = null;
      try {
        url = localStorage.getItem(key);
      } catch {}
      if (!url) {
        await new Promise((r) => setTimeout(r, 16));
        if (cancelled) return;
        url = renderThumb(job.def);
        try {
          if (url) localStorage.setItem(key, url);
        } catch {}
      }
      if (url) {
        job.img.style.backgroundImage = `url(${url})`;
        job.img.classList.add('ready');
      }
    }
  };
  runJobs();
  return () => {
    cancelled = true;
    stopHero();
  };
}

function renderThumb(def: SimDef): string | null {
  try {
    const W = 360, H = 225;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const inst = def.create({ canvas, ctx, width: W, height: H, params: defaults(def), thumbnail: true });
    const n = def.thumbSteps ?? 120;
    for (let i = 0; i < n; i++) {
      inst.step();
      if (n - i <= 40) inst.draw();
    }
    inst.draw();
    inst.dispose?.();
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (e) {
    console.warn('thumb failed', def.id, e);
    return null;
  }
}

function heroAnimation(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  let raf = 0, t = 0;
  const pts = Array.from({ length: 900 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 30, h: Math.random() }));
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const frame = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = 'rgba(5,7,13,0.09)';
    ctx.fillRect(0, 0, w, h);
    t += 0.003;
    const dt = 0.006;
    for (const p of pts) {
      // Lorenz attractor, scaled
      const x = p.x * 20, y = p.y * 20, z = p.z;
      const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - (8 / 3) * z;
      p.x += (dx * dt) / 20;
      p.y += (dy * dt) / 20;
      p.z += dz * dt;
      const ca = Math.cos(t), sa = Math.sin(t);
      const X = x * ca - y * sa;
      const s = Math.min(w * 0.55, h) / 62;
      ctx.fillStyle = `hsla(${200 + p.h * 120},90%,65%,0.8)`;
      ctx.fillRect(w * 0.7 + X * s, h * 0.5 - (z - 25) * s, 1.4, 1.4);
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

/* ---------------------------------------------------------------- sim view */

function mountSim(root: HTMLElement, def: SimDef, initial: Params, all: SimDef[]) {
  document.title = `${def.title} — dynasys`;
  const params: Params = { ...defaults(def), ...initial };
  const view = el('div', 'simview');
  view.style.setProperty('--accent', def.accent);
  const stage = el('div', 'stage');
  const canvas = el('canvas');
  stage.append(canvas);
  const overlay = el(
    'div',
    'overlay',
    `<a class="back" href="#/" title="All simulations (esc)">←</a>
     <div class="titles"><h1>${def.title}</h1>${def.controls ? `<p>${def.controls}</p>` : ''}</div>`,
  );
  stage.append(overlay);
  const fpsEl = el('div', 'fps');
  stage.append(fpsEl);
  const panel = el('aside', 'panel');
  const showBtn = el('button', 'show-panel', '☰');
  showBtn.title = 'Show controls (h)';
  view.append(stage, panel, showBtn);
  root.append(view);

  const ctx = canvas.getContext('2d')!;
  let width = 0, height = 0;
  let inst: SimInstance | null = null;
  let running = true;
  let speed = 1;
  let acc = 0;

  const build = () => {
    inst?.dispose?.();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.min(2, devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inst = def.create({ canvas, ctx, width, height, params, thumbnail: false });
    renderActions();
    inst.draw();
  };

  const sizeCanvas = () => {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    width = Math.max(1, Math.floor(r.width));
    height = Math.max(1, Math.floor(r.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  };

  /* ---- panel */
  const playBtn = el('button', 'btn primary', '❚❚ Pause');
  const stepBtn = el('button', 'btn', 'Step');
  const resetBtn = el('button', 'btn', 'Reset');
  const playback = el('div', 'section');
  playback.append(el('div', 'row btns'));
  playback.firstElementChild!.append(playBtn, stepBtn, resetBtn);
  const speedRow = rangeRow('Speed', 0.25, 8, 0.25, speed, (v) => (speed = v), (v) => `${v}×`);
  playback.append(speedRow);
  panel.append(el('div', 'panel-head', `<span>Controls</span>`));
  const hideBtn = el('button', 'icon', '✕');
  hideBtn.title = 'Hide panel (h)';
  panel.firstElementChild!.append(hideBtn);
  panel.append(playback);

  const setRunning = (v: boolean) => {
    running = v;
    playBtn.innerHTML = running ? '❚❚ Pause' : '▶ Play';
  };
  playBtn.onclick = () => setRunning(!running);
  stepBtn.onclick = () => {
    setRunning(false);
    inst?.step();
    inst?.draw();
  };
  resetBtn.onclick = () => build();

  const actionsSec = el('div', 'section actions');
  const renderActions = () => {
    actionsSec.innerHTML = '';
    if (!inst?.actions?.length) {
      actionsSec.style.display = 'none';
      return;
    }
    actionsSec.style.display = '';
    const row = el('div', 'row btns wrap');
    for (const a of inst.actions) {
      const b = el('button', 'btn', a.label);
      b.onclick = () => {
        a.run();
        inst?.draw();
      };
      row.append(b);
    }
    actionsSec.append(row);
  };

  if (def.presets?.length) {
    const sec = el('div', 'section');
    sec.append(el('h4', '', 'Presets'));
    const row = el('div', 'row btns wrap');
    for (const pr of def.presets) {
      const b = el('button', 'btn chip', pr.name);
      b.onclick = () => {
        Object.assign(params, defaults(def), pr.values);
        syncInputs();
        syncUrl();
        build();
      };
      row.append(b);
    }
    sec.append(row);
    panel.append(sec);
  }
  panel.append(actionsSec);

  const inputs: (() => void)[] = [];
  const paramSec = el('div', 'section');
  paramSec.append(el('h4', '', 'Parameters'));
  const onChange = (p: ParamDef) => {
    syncUrl();
    if (p.reset) build();
    else inst?.paramChanged?.(p.key);
  };
  for (const p of def.params) {
    if (!isParam(p)) {
      paramSec.append(el('h5', '', p.label));
      continue;
    }
    if (p.type === 'select') {
      const row = el('label', 'row field');
      row.append(el('span', 'lbl', p.label));
      const sel = el('select');
      for (const o of p.options) {
        const opt = el('option');
        opt.value = o.value;
        opt.textContent = o.label;
        sel.append(opt);
      }
      sel.value = params[p.key];
      sel.onchange = () => {
        params[p.key] = sel.value;
        onChange(p);
      };
      inputs.push(() => (sel.value = params[p.key]));
      if (p.hint) row.title = p.hint;
      row.append(sel);
      paramSec.append(row);
    } else if (p.type === 'toggle') {
      const row = el('label', 'row field toggle');
      row.append(el('span', 'lbl', p.label));
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = params[p.key];
      cb.onchange = () => {
        params[p.key] = cb.checked;
        onChange(p);
      };
      inputs.push(() => (cb.checked = params[p.key]));
      if (p.hint) row.title = p.hint;
      row.append(cb);
      paramSec.append(row);
    } else if (p.type === 'color') {
      const row = el('label', 'row field');
      row.append(el('span', 'lbl', p.label));
      const ci = el('input');
      ci.type = 'color';
      ci.value = params[p.key];
      ci.oninput = () => {
        params[p.key] = ci.value;
        onChange(p);
      };
      inputs.push(() => (ci.value = params[p.key]));
      row.append(ci);
      paramSec.append(row);
    } else {
      const row = rangeRow(
        p.label,
        p.min,
        p.max,
        p.step ?? (p.max - p.min) / 100,
        params[p.key],
        (v) => {
          params[p.key] = v;
          if (!p.reset) onChange(p);
        },
        p.fmt,
        p.reset ? () => onChange(p) : undefined,
      );
      if (p.hint) row.title = p.hint;
      inputs.push(() => (row as any).setValue(params[p.key]));
      paramSec.append(row);
    }
  }
  const syncInputs = () => inputs.forEach((f) => f());
  if (def.params.length) panel.append(paramSec);

  const statsSec = el('div', 'section stats');
  panel.append(statsSec);

  const about = el('div', 'section about');
  about.append(el('h4', '', 'What’s going on'));
  about.append(el('div', 'about-body', def.about));
  panel.append(about);

  const more = el('div', 'section more');
  more.append(el('h4', '', 'More worlds'));
  const moreRow = el('div', 'row btns wrap');
  const idx = all.indexOf(def);
  for (let k = 1; k <= 4; k++) {
    const o = all[(idx + k) % all.length];
    const a = el('a', 'btn chip', o.title) as HTMLAnchorElement;
    a.href = `#/${o.id}`;
    moreRow.append(a);
  }
  more.append(moreRow);
  panel.append(more);

  const syncUrl = () => {
    const sp = new URLSearchParams();
    const d = defaults(def);
    for (const k of Object.keys(params)) {
      if (params[k] === d[k]) continue;
      const v = params[k];
      sp.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    const q = sp.toString();
    history.replaceState(null, '', `#/${def.id}${q ? '?' + q : ''}`);
  };

  /* ---- panel visibility */
  const setPanel = (show: boolean) => {
    view.classList.toggle('panel-hidden', !show);
    requestAnimationFrame(() => {
      sizeCanvas();
      build();
    });
  };
  hideBtn.onclick = () => setPanel(false);
  showBtn.onclick = () => setPanel(true);
  if (window.innerWidth < 760) view.classList.add('panel-hidden');

  /* ---- pointer */
  let down = false, lastX = 0, lastY = 0, btn = 0;
  const pinfo = (e: PointerEvent, type: PointerInfo['type']): PointerInfo => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const info = { type, x, y, dx: x - lastX, dy: y - lastY, button: btn, down, shift: e.shiftKey, alt: e.altKey };
    lastX = x;
    lastY = y;
    return info;
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = true;
    btn = e.button;
    const r = canvas.getBoundingClientRect();
    lastX = e.clientX - r.left;
    lastY = e.clientY - r.top;
    inst?.pointer?.(pinfo(e, 'down'));
  });
  canvas.addEventListener('pointermove', (e) => inst?.pointer?.(pinfo(e, 'move')));
  const up = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    inst?.pointer?.(pinfo(e, 'up'));
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!inst?.wheel) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      inst.wheel(e.clientX - r.left, e.clientY - r.top, e.deltaY);
    },
    { passive: false },
  );

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return;
    if (e.key === ' ') {
      e.preventDefault();
      setRunning(!running);
    } else if (e.key === 'r') build();
    else if (e.key === '.') stepBtn.click();
    else if (e.key === 'h') setPanel(view.classList.contains('panel-hidden'));
    else if (e.key === 'Escape') location.hash = '#/';
  };
  window.addEventListener('keydown', onKey);

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      sizeCanvas();
      build();
    }, 150);
  };
  window.addEventListener('resize', onResize);

  /* ---- loop */
  let raf = 0, frames = 0, lastFps = performance.now(), lastStats = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!inst) return;
    if (running) {
      acc += speed;
      let n = 0;
      while (acc >= 1 && n < 32) {
        inst.step();
        acc -= 1;
        n++;
      }
      if (acc > 1) acc = 0;
      inst.draw();
    }
    frames++;
    if (now - lastFps > 500) {
      fpsEl.textContent = `${Math.round((frames * 1000) / (now - lastFps))} fps`;
      frames = 0;
      lastFps = now;
    }
    if (now - lastStats > 250) {
      lastStats = now;
      const st = inst.stats?.();
      if (st?.length) {
        statsSec.style.display = '';
        statsSec.innerHTML =
          '<h4>Readout</h4><div class="stat-grid">' +
          st.map(([k, v]) => `<span>${k}</span><b>${typeof v === 'number' ? fmtNum(v) : v}</b>`).join('') +
          '</div>';
      } else statsSec.style.display = 'none';
    }
  };

  requestAnimationFrame(() => {
    sizeCanvas();
    build();
    raf = requestAnimationFrame(frame);
  });

  return () => {
    cancelAnimationFrame(raf);
    inst?.dispose?.();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
  };
}

function fmtNum(v: number) {
  if (Number.isInteger(v)) return v.toLocaleString();
  const a = Math.abs(v);
  return a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
}

function rangeRow(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  onInput: (v: number) => void,
  fmt?: (v: number) => string,
  onCommit?: () => void,
) {
  const row = el('label', 'row field range');
  const top = el('div', 'range-top');
  const val = el('span', 'val');
  top.append(el('span', 'lbl', label), val);
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const show = (v: number) => (val.textContent = fmt ? fmt(v) : fmtNum(Number(v.toFixed(6))));
  show(value);
  input.oninput = () => {
    const v = Number(input.value);
    show(v);
    onInput(v);
  };
  if (onCommit) input.onchange = onCommit;
  row.append(top, input);
  (row as any).setValue = (v: number) => {
    input.value = String(v);
    show(v);
  };
  return row;
}
