// The moment, refitted from today's landing (scripts/agora-hero.js): a painting condenses out of gold dust, then a
// thin gold stream lifts off its lit planes and writes a line, running on into an end mark (a play disc). Any layout
// calls it on any <img> at any size. One moment at a time: a new one, or cancelMoment(), ends the running one at
// its end state. It never holds, dims or covers a control: the canvas takes no pointer, and every control under it
// is cleared from each frame. Reduced motion (or ?motion=still) gives the end state at once.

export type Beats = 'face+line' | 'face' | 'line' | 'line+face';

export interface MomentOptions {
  /** The painting that condenses. Cross-origin images need crossorigin="anonymous" for their colours. */
  image: HTMLImageElement;
  /** The words the stream writes. Any element; its text nodes are wrapped word by word. */
  line?: HTMLElement | null | undefined;
  /** Where the stream ends after the line: drawn over, never dimmed or held. */
  end?: Element | null | undefined;
  /** Text that stays legible through the moment (a name over the painting): cleared from each frame like a control. */
  keep?: Element[] | undefined;
  beats?: Beats | undefined;
  /** Where the eyes sit in the natural image (fractions): the face leads from there. */
  eyes?: { x: number; y: number } | undefined;
  /** Grains for the face; by default from the painting's area on screen. */
  budget?: number | undefined;
  /** How far past the painting, line and end the dust may fly, in CSS px. */
  margin?: number | undefined;
  /** Draw this millisecond and stop there (designed stills for shots). */
  freezeAt?: number | null | undefined;
}

export type MomentEnd = 'done' | 'cancelled' | 'still' | 'failed';

export interface Moment {
  cancel(): void;
  readonly done: Promise<MomentEnd>;
}

const FLY = 1150;
const SPREAD = 880;
const CROSS_A = 1250;
const CROSS_B = 2100;
const FADE_A = 1560;
const FADE_B = 2300;
const Q_SPREAD = 560;
const Q_FLY: [number, number] = [520, 840];
const LINE_AFTER_FACE = 2200;
const FACE_AFTER_LINE = 1100;
const LOAD_WAIT_MS = 4000;
const GOLD: [number, number, number] = [236, 198, 116];
const GOLD_CSS = 'rgb(236,198,116)';
const CONTROLS = 'a[href], button, summary, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

export function momentStill(): boolean {
  try {
    if (/[?&]motion=still\b/.test(location.search)) return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function ease(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function sstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface Box { x: number; y: number; w: number; h: number }

/** An element's box in document coordinates. */
function docBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

function union(boxes: Box[]): Box {
  const x0 = Math.min(...boxes.map(b => b.x));
  const y0 = Math.min(...boxes.map(b => b.y));
  const x1 = Math.max(...boxes.map(b => b.x + b.w));
  const y1 = Math.max(...boxes.map(b => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// ---- the words ---------------------------------------------------------------------

/** Wraps each word of the line's text nodes in a <w>, keeping every other node and every space as it was. */
function wrapWords(line: HTMLElement): HTMLElement[] {
  const existing = Array.from(line.querySelectorAll<HTMLElement>('w[data-moment-word]'));
  if (existing.length) return existing;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  const words: HTMLElement[] = [];
  for (const node of nodes) {
    const parts = (node.nodeValue ?? '').split(/(\s+)/);
    if (parts.length < 2 && !parts[0]) continue;
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
        continue;
      }
      const w = document.createElement('w');
      w.dataset.momentWord = '';
      w.textContent = part;
      frag.appendChild(w);
      words.push(w);
    }
    node.replaceWith(frag);
  }
  return words;
}

function dimWords(words: HTMLElement[]): void {
  for (const w of words) {
    w.style.transition = 'opacity 0.34s ease, filter 0.34s ease';
    w.style.opacity = '0.13';
    w.style.filter = 'blur(1.6px)';
  }
}

function lightWords(words: HTMLElement[], upto: number): void {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w) continue;
    const lit = i < upto;
    w.style.opacity = lit ? '' : '0.13';
    w.style.filter = lit ? '' : 'blur(1.6px)';
  }
}

function clearWords(words: HTMLElement[]): void {
  for (const w of words) {
    w.style.removeProperty('opacity');
    w.style.removeProperty('filter');
    w.style.removeProperty('transition');
  }
}

// ---- the painting --------------------------------------------------------------------

interface Sample {
  m: Box;
  cols: number;
  rows: number;
  data: Uint8ClampedArray | null;
  eyeX: number;
  eyeY: number;
}

/** Samples the painting as the browser draws it (cover, contain or fill at its object-position), in canvas space. */
function sample(img: HTMLImageElement, origin: Box, budget: number, eyes: { x: number; y: number }): Sample | null {
  const b = docBox(img);
  const m: Box = { x: b.x - origin.x, y: b.y - origin.y, w: b.w, h: b.h };
  if (!m.w || !m.h || !img.naturalWidth || !img.naturalHeight) return null;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const cs = getComputedStyle(img);
  const fit = cs.objectFit;
  const s = fit === 'contain' ? Math.min(m.w / iw, m.h / ih) : fit === 'fill' ? 0 : Math.max(m.w / iw, m.h / ih);
  const pos = (cs.objectPosition || '50% 50%').split(/\s+/);
  const px = parseFloat(pos[0] ?? '50') / 100;
  const py = parseFloat(pos[1] ?? '50') / 100;
  const sx = s || m.w / iw;
  const sy = s || m.h / ih;
  const dx = m.x + (m.w - iw * sx) * (Number.isFinite(px) ? px : 0.5);
  const dy = m.y + (m.h - ih * sy) * (Number.isFinite(py) ? py : 0.5);
  const aspect = m.h / m.w;
  const cols = Math.max(16, Math.round(Math.sqrt(budget / aspect)));
  const rows = Math.max(16, Math.round(cols * aspect));
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const o = off.getContext('2d', { willReadFrequently: true });
  let data: Uint8ClampedArray | null = null;
  try {
    if (o) {
      o.drawImage(img, (m.x - dx) / sx, (m.y - dy) / sy, m.w / sx, m.h / sy, 0, 0, cols, rows);
      data = o.getImageData(0, 0, cols, rows).data;
    }
  } catch {
    // a tainted canvas: the dust stays gold, without the painting's colours
    data = null;
  }
  return { m, cols, rows, data, eyeX: dx + iw * sx * eyes.x, eyeY: dy + ih * sy * eyes.y };
}

interface Grain {
  tx: number; ty: number; ox: number; oy: number;
  r: number; g: number; b: number;
  sz: number; dl: number; ph: number;
  css: string;
}

interface Mote {
  sx: number; sy: number; tx: number; ty: number;
  c1x: number; c1y: number; c2x: number; c2y: number;
  del: number; dur: number; s: number; lum: number;
  css: string;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildFace(g: Sample, W: number, H: number, small: boolean, rnd: () => number): Grain[] {
  const { m } = g;
  const cw = m.w / g.cols;
  const ch = m.h / g.rows;
  const faceR = m.w * 0.52;
  const out: Grain[] = [];
  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      const gx = m.x + i * cw + cw / 2;
      const gy = m.y + j * ch + ch / 2;
      const d = Math.hypot(gx - g.eyeX, gy - g.eyeY) / faceR;
      // density falls away from the face, so the head reads before the ground
      if (rnd() > Math.min(1, Math.max(0.15, 1.2 - Math.min(d, 2.4) * 0.42))) continue;
      let r = 214;
      let gg = 168;
      let b = 64;
      if (g.data) {
        const k = (j * g.cols + i) * 4;
        r = g.data[k] ?? r;
        gg = g.data[k + 1] ?? gg;
        b = g.data[k + 2] ?? b;
      }
      const tx = gx + (rnd() - 0.5) * cw * 1.2;
      const ty = gy + (rnd() - 0.5) * ch * 1.2;
      out.push({
        tx,
        ty,
        // scattered over the canvas, pulled a little toward where it belongs
        ox: (rnd() * W * 1.04 - W * 0.02) * 0.86 + tx * 0.14,
        oy: (rnd() * H) * 0.86 + ty * 0.14,
        r, g: gg, b,
        sz: Math.max(cw, ch) * (small ? 0.8 + rnd() * 0.6 : 0.84 + rnd() * 0.76),
        dl: Math.pow(Math.min(d, 1), 1.25) * SPREAD + rnd() * 190,
        ph: rnd() * 6.283,
        css: `rgb(${r},${gg},${b})`,
      });
    }
  }
  return out;
}

function lineBoxes(line: HTMLElement | null | undefined, origin: Box): Box[] {
  if (!line) return [];
  const out: Box[] = [];
  const rects = line.getClientRects();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (!r || r.width < 4 || r.height < 4) continue;
    out.push({ x: r.left + window.scrollX - origin.x, y: r.top + window.scrollY - origin.y, w: r.width, h: r.height });
  }
  return out;
}

function buildStream(g: Sample, lines: Box[], end: Box | null, count: number, rnd: () => number): Mote[] {
  const { m } = g;
  const pool: { x: number; y: number; r: number; g: number; b: number; lum: number }[] = [];
  const cum: number[] = [];
  let acc = 0;
  if (g.data) {
    const cw = m.w / g.cols;
    const ch = m.h / g.rows;
    for (let j = 0; j < g.rows; j++) {
      for (let i = 0; i < g.cols; i++) {
        const k = (j * g.cols + i) * 4;
        const r = g.data[k] ?? 0;
        const gg = g.data[k + 1] ?? 0;
        const b = g.data[k + 2] ?? 0;
        const lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        if (lum < 0.3) continue;
        const x = m.x + (i + 0.5) * cw;
        const y = m.y + (j + 0.5) * ch;
        const u = (x - g.eyeX) / (m.w * 0.34);
        const v = (y - g.eyeY) / (m.h * 0.3);
        const w = Math.pow(lum, 1.5) * (0.14 + Math.exp(-(u * u + v * v)));
        if (w < 0.1) continue;
        pool.push({ x, y, r, g: gg, b, lum });
        acc += w;
        cum.push(acc);
      }
    }
  }
  const pick = (): (typeof pool)[number] | null => {
    if (!pool.length) return null;
    const t = rnd() * acc;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] ?? 0) < t) lo = mid + 1;
      else hi = mid;
    }
    return pool[lo] ?? null;
  };
  const motes: Mote[] = [];
  const targets = lines.length ? lines : end ? [end] : [];
  if (!targets.length) return motes;
  for (let n = 0; n < count; n++) {
    const c = pick();
    const sx = c ? c.x + (rnd() - 0.5) * 7 : m.x + m.w * 0.5 + (rnd() - 0.5) * m.w * 0.5;
    const sy = c ? c.y + (rnd() - 0.5) * 7 : m.y + m.h * 0.35 + (rnd() - 0.5) * m.h * 0.4;
    const ln = targets[(rnd() * targets.length) | 0] ?? targets[0]!;
    // land toward the start of the line, so the words fill in reading order
    let tx = ln.x + Math.pow(rnd(), 1.3) * ln.w;
    let ty = ln.y + rnd() * ln.h;
    let c2x = tx + (rnd() - 0.5) * 30;
    let c2y = ty - 30 - rnd() * 40;
    let del = Math.pow(rnd(), 0.9) * Q_SPREAD;
    // a quarter runs on through the line into the end mark
    if (end && lines.length && rnd() < 0.25) {
      c2x = tx;
      c2y = ty;
      tx = end.x + end.w / 2 + (rnd() - 0.5) * end.w * 0.5;
      ty = end.y + end.h / 2 + (rnd() - 0.5) * end.h * 0.5;
      del += 220;
    }
    const r = c ? c.r : GOLD[0];
    const gg = c ? c.g : GOLD[1];
    const b = c ? c.b : GOLD[2];
    motes.push({
      sx, sy, tx, ty,
      c1x: sx + (tx - sx) * (0.15 + rnd() * 0.2) + (rnd() - 0.5) * 40,
      c1y: sy + (rnd() - 0.5) * 60,
      c2x, c2y,
      del,
      dur: Q_FLY[0] + rnd() * (Q_FLY[1] - Q_FLY[0]),
      s: 0.62 + rnd() * 1.5,
      lum: c ? c.lum : 0.7,
      css: `rgb(${(r * 0.28 + GOLD[0] * 0.72) | 0},${(gg * 0.28 + GOLD[1] * 0.72) | 0},${(b * 0.32 + GOLD[2] * 0.68) | 0})`,
    });
  }
  return motes;
}

// ---- running ---------------------------------------------------------------------------

let active: { cancel: () => void } | null = null;

/** Ends the running moment at its end state. */
export function cancelMoment(): void {
  active?.cancel();
}

function waitForImage(img: HTMLImageElement, signal: { cancelled: boolean }): Promise<boolean> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
      window.clearTimeout(timer);
      resolve(ok && !signal.cancelled && img.naturalWidth > 0);
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);
    const timer = window.setTimeout(() => finish(false), LOAD_WAIT_MS);
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  });
}

export function runMoment(opts: MomentOptions): Moment {
  cancelMoment();
  const { image } = opts;
  const beats: Beats = opts.beats ?? 'face+line';
  const faceOn = beats !== 'line';
  const lineOn = beats !== 'face';
  const words = lineOn && opts.line ? wrapWords(opts.line) : [];
  let resolveDone: (end: MomentEnd) => void = () => undefined;
  const done = new Promise<MomentEnd>(r => (resolveDone = r));
  // the CSS hold (data-moment-hold) is handed to this script once it runs, so the painting never shows twice
  image.style.animation = 'none';

  const signal = { cancelled: false };
  let raf = 0;
  let canvas: HTMLCanvasElement | null = null;

  const restore = () => {
    image.style.removeProperty('opacity');
    image.style.removeProperty('transition');
    clearWords(words);
  };
  const finish = (end: MomentEnd) => {
    if (active === handle) active = null;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    canvas?.remove();
    canvas = null;
    restore();
    resolveDone(end);
  };
  const handle = {
    cancel: () => {
      if (signal.cancelled) return;
      signal.cancelled = true;
      finish('cancelled');
    },
  };
  const onResize = () => handle.cancel();

  if (momentStill()) {
    restore();
    resolveDone('still');
    return { cancel: () => undefined, done };
  }
  active = handle;
  if (faceOn) image.style.opacity = '0';
  if (words.length) dimWords(words);

  void waitForImage(image, signal).then(ok => {
    if (signal.cancelled) return;
    if (!ok) {
      signal.cancelled = true;
      finish('failed');
      return;
    }
    start();
  });

  function start(): void {
    const margin = opts.margin ?? 40;
    const endEl = opts.end ?? null;
    const parts = [image, ...(opts.line ? [opts.line] : []), ...(endEl ? [endEl] : [])].map(docBox);
    const u = union(parts);
    const docW = document.documentElement.scrollWidth;
    const x0 = Math.max(0, Math.floor(u.x - margin));
    const x1 = Math.min(docW, Math.ceil(u.x + u.w + margin));
    const origin: Box = { x: x0, y: Math.max(0, Math.floor(u.y - margin)), w: x1 - x0, h: 0 };
    origin.h = Math.ceil(u.y + u.h + margin) - origin.y;
    const W = origin.w;
    const H = origin.h;
    const small = window.innerWidth < 900;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 2 : 1.75);
    const ib = docBox(image);
    const area = ib.w * ib.h;
    const budget = opts.budget ?? Math.round(Math.min(small ? 3600 : 7200, Math.max(400, area / 24)));
    const eyes = opts.eyes ?? { x: 0.5, y: 0.275 };
    const g = sample(image, origin, budget, eyes);
    if (!g) {
      signal.cancelled = true;
      finish('failed');
      return;
    }
    canvas = document.createElement('canvas');
    canvas.className = 'lm-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const st = canvas.style;
    st.position = 'absolute';
    st.left = `${origin.x}px`;
    st.top = `${origin.y}px`;
    st.width = `${W}px`;
    st.height = `${H}px`;
    st.pointerEvents = 'none';
    st.zIndex = '2';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      signal.cancelled = true;
      finish('failed');
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rnd = rng(20260728);
    const face = faceOn ? buildFace(g, W, H, small, rnd) : [];
    const lines = lineBoxes(opts.line, origin);
    const endBox = endEl ? (() => { const b = docBox(endEl); return { x: b.x - origin.x, y: b.y - origin.y, w: b.w, h: b.h }; })() : null;
    const streamCount = Math.round(Math.min(small ? 240 : 460, Math.max(60, budget / 15)));
    const stream = lineOn ? buildStream(g, lines, endBox, streamCount, rnd) : [];

    // every control under the canvas is cleared from each frame; the end mark keeps its dust
    const canvasBox: Box = { x: origin.x, y: origin.y, w: W, h: H };
    const endDoc = endEl ? docBox(endEl) : null;
    const guards = Array.from(document.querySelectorAll(CONTROLS))
      .filter(el => !(endEl && (el === endEl || endEl.contains(el))))
      .map(el => ({ el, box: docBox(el) }))
      .filter(c => c.box.w > 0 && c.box.h > 0 && intersects(c.box, canvasBox))
      .map(c => ({ x: c.box.x - origin.x, y: c.box.y - origin.y, w: c.box.w, h: c.box.h, holdsEnd: !!(endEl && c.el.contains(endEl)) }));
    const endLocal = endDoc ? { x: endDoc.x - origin.x, y: endDoc.y - origin.y, w: endDoc.w, h: endDoc.h } : null;
    // the text's own line boxes, not its block: a full-width block would cut a band out of the face
    const kept: Box[] = [];
    for (const el of opts.keep ?? []) {
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width > 0 && r.height > 0) kept.push({ x: r.left + window.scrollX - origin.x, y: r.top + window.scrollY - origin.y, w: r.width, h: r.height });
      }
    }

    // the timeline, by beats
    const faceAt = beats === 'line+face' ? FACE_AFTER_LINE : 0;
    const lineAt = beats === 'face+line' ? LINE_AFTER_FACE : 0;
    const faceEnd = faceOn ? faceAt + FADE_B + 60 : 0;
    const lineEnd = lineOn && stream.length ? lineAt + Q_SPREAD + Q_FLY[1] + 380 : 0;
    const END = Math.max(faceEnd, lineEnd, 1);

    const drawFace = (tt: number) => {
      const t = tt - faceAt;
      if (t < 0) return;
      const rest = sstep(FADE_A, FADE_B, t);
      if (rest >= 1) return;
      const born = 0.34 + 0.66 * sstep(0, 320, t);
      let goldOn = false;
      for (const p of face) {
        const raw = Math.min(1, Math.max(0, (t - p.dl) / FLY));
        const e = ease(raw);
        const n = 1 - e;
        let x = p.ox + (p.tx - p.ox) * e;
        let y = p.oy + (p.ty - p.oy) * e;
        if (e < 1) {
          x += Math.sin(t * 0.00085 + p.ph) * n * 18;
          y += Math.cos(t * 0.0007 + p.ph * 1.7) * n * 15;
        }
        const rad = (2.0 + (p.sz * 0.5 - 2.0) * sstep(0.35, 1, e)) * (1 - rest);
        if (rad <= 0.06) continue;
        const al = born * (0.5 + 0.34 * e) * (1 - rest) * (e < 1 ? 0.74 + 0.26 * Math.sin(t * 0.002 + p.ph * 7) : 1);
        if (al <= 0.005) continue;
        ctx.globalAlpha = Math.min(1, al);
        // gold on the way in, the painting's own colour once it lands
        const k = sstep(0.4, 0.98, e);
        if (k < 0.05) {
          if (!goldOn) {
            ctx.fillStyle = GOLD_CSS;
            goldOn = true;
          }
        } else {
          goldOn = false;
          ctx.fillStyle = k >= 0.98 ? p.css : `rgb(${(GOLD[0] + (p.r - GOLD[0]) * k) | 0},${(GOLD[1] + (p.g - GOLD[1]) * k) | 0},${(GOLD[2] + (p.b - GOLD[2]) * k) | 0})`;
        }
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, 6.283);
        ctx.fill();
      }
    };
    const drawStream = (tt: number) => {
      const t = tt - lineAt;
      if (t <= 0) return;
      for (const s of stream) {
        const p = (t - s.del) / s.dur;
        if (p <= 0 || p >= 1) continue;
        const e = ease(p);
        const n = 1 - e;
        const x = n * n * n * s.sx + 3 * n * n * e * s.c1x + 3 * n * e * e * s.c2x + e * e * e * s.tx;
        const y = n * n * n * s.sy + 3 * n * n * e * s.c1y + 3 * n * e * e * s.c2y + e * e * e * s.ty;
        // born on the paint, spent as it becomes a word
        ctx.globalAlpha = Math.min(1, Math.min(1, p * 5) * (1 - Math.pow(p, 2.6)) * (0.5 + s.lum * 0.55));
        ctx.fillStyle = s.css;
        ctx.beginPath();
        ctx.arc(x, y, s.s * (1 + n * 0.55), 0, 6.283);
        ctx.fill();
      }
    };
    const guard = () => {
      for (const b of kept) ctx.clearRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      for (const b of guards) {
        if (!b.holdsEnd || !endLocal) {
          ctx.clearRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
          continue;
        }
        // the control around the end mark: clear all of it but the mark itself
        const top = endLocal.y - b.y;
        const bottom = b.y + b.h - (endLocal.y + endLocal.h);
        ctx.clearRect(b.x, b.y, b.w, Math.max(0, top));
        ctx.clearRect(b.x, endLocal.y + endLocal.h, b.w, Math.max(0, bottom));
        ctx.clearRect(b.x, endLocal.y, Math.max(0, endLocal.x - b.x), endLocal.h);
        ctx.clearRect(endLocal.x + endLocal.w, endLocal.y, Math.max(0, b.x + b.w - (endLocal.x + endLocal.w)), endLocal.h);
      }
    };
    const reveal = (tt: number) => {
      if (faceOn) image.style.opacity = String(sstep(faceAt + CROSS_A, faceAt + CROSS_B, tt));
      if (words.length) {
        const frac = Math.min(1, Math.max(0, (tt - lineAt - 60) / (Q_SPREAD + Q_FLY[0])));
        lightWords(words, Math.round(frac * (words.length + 1.2)));
      }
    };
    const render = (tt: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (faceOn) drawFace(tt);
      if (lineOn) drawStream(tt);
      ctx.restore();
      ctx.globalAlpha = 1;
      guard();
      reveal(tt);
    };

    if (typeof opts.freezeAt === 'number') {
      if (opts.freezeAt >= END) {
        signal.cancelled = true;
        finish('done');
        return;
      }
      render(opts.freezeAt);
      // a still keeps its frame; the next moment or cancelMoment() clears it
      return;
    }
    window.addEventListener('resize', onResize);
    let t0 = 0;
    const loop = (ts: number) => {
      if (signal.cancelled) return;
      if (!t0) t0 = ts;
      const tt = ts - t0;
      if (tt >= END) {
        signal.cancelled = true;
        finish('done');
        return;
      }
      render(tt);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
  }

  return { cancel: handle.cancel, done };
}
