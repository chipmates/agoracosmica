/**
 * createAtlasSky — the living night behind the Celestial Atlas.
 *
 * Synthesis of the two Wisdom Sky prototypes (design-forge verdict):
 * proto A contributes the LIVING SKY (parallax depth starfield, one
 * continuous world-space, eased camera glides, drag-to-peek with
 * spring-back, celebration hush), proto B contributes the celebration
 * choreography rendered here as light (surveyor's flourish, gold dust
 * gathering inward, the engraver's sequential gold re-inking, one
 * gilding light pass).
 *
 * Two Canvas 2D layers:
 *   field — deep parallax starfield + nebula whispers + paper wash
 *   fx    — transient gold: flourish rings, motes, gild strokes, light pass
 *
 * The engraved linework itself (SVG plate, cartouche, marginalia) and the
 * interactive DOM stars live in `worldEl`; the engine drives that element's
 * transform so ink and sky travel together during glides and drags.
 *
 * Loaded behind a dynamic import(); nothing heavy, no three.js.
 */

import type { AtlasSky, AtlasSkyOptions, SkyScene } from './types';

/* ------------------------------------------------------------ helpers */

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutSoft = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Deterministic rng so the sky is the same sky on every visit. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-figure hash: every figure arrives from its own sky direction. */
function figureDirection(figureKey: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < figureKey.length; i++) {
    h ^= figureKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const angle = (((h >>> 0) % 360) / 360) * TAU;
  return { x: Math.cos(angle), y: Math.sin(angle) * 0.45 };
}

interface FieldStar {
  /** Unit-space coordinates, tiled across the layer span. */
  x: number;
  y: number;
  r: number;
  a: number;
  ph: number;
  sp: number;
  /** 0 cool blue, 1 pale blue, 2 ice, 3 rare warm gold */
  tint: number;
  flare: boolean;
}

interface FieldLayer {
  par: number;
  stars: FieldStar[];
}

type FxItem =
  | {
      kind: 'flourish';
      x: number;
      y: number;
      r: number;
      t0: number;
      draw: number;
      hold: number;
      fade: number;
    }
  | {
      kind: 'gather';
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      r: number;
      a: number;
      t0: number;
      life: number;
      warm: boolean;
    }
  | { kind: 'pulse'; x: number; y: number; r0: number; r1: number; a: number; t0: number; life: number }
  | { kind: 'settle'; x0: number; y0: number; vx: number; vy: number; r: number; a: number; t0: number; life: number }
  | { kind: 'gild'; x1: number; y1: number; x2: number; y2: number; t0: number; dur: number }
  | { kind: 'sweep'; x0: number; x1: number; y: number; r: number; t0: number; dur: number };

const TINTS = ['180, 200, 255', '210, 235, 255', '190, 215, 255', '230, 200, 140'];

/* ------------------------------------------------------------ engine */

export function createAtlasSky(
  fieldCanvas: HTMLCanvasElement,
  fxCanvas: HTMLCanvasElement,
  opts: AtlasSkyOptions
): AtlasSky {
  const fieldCtx = fieldCanvas.getContext('2d');
  const fxCtx = fxCanvas.getContext('2d');
  if (!fieldCtx || !fxCtx) throw new Error('atlas-sky: 2d context unavailable');
  const fieldX: CanvasRenderingContext2D = fieldCtx;
  const fxX: CanvasRenderingContext2D = fxCtx;

  let W = Math.max(1, fieldCanvas.clientWidth || 1);
  let H = Math.max(1, fieldCanvas.clientHeight || 1);
  let DPR = Math.min(window.devicePixelRatio || 1, opts.dprCap);

  let scene: SkyScene | null = null;
  let disposed = false;
  let paused = false;
  let firstFrameSent = false;

  /* camera: pixel offset of the world relative to rest. The deep field
     moves at layer parallax factors of this offset; the world moves 1:1. */
  const cam = { x: 0, y: 0 };
  let worldScale = 1;
  let worldRot = 0;
  let worldOpacity = 1;

  /* hush 0..1 (opacity of the edge-dimming overlay) */
  let hush = 0;
  let hushTarget = 0;

  /* figures whose plate has been completed this session: their
     neighbourhood of the sky stays a little brighter (proto B step 5). */
  const gilded = new Set<string>();

  let fx: FxItem[] = [];
  /** Persistent gold re-inked links after ignite (kept until figure change). */
  let gildKeep: { x1: number; y1: number; x2: number; y2: number; a: number }[] = [];
  let gildKeepFigure: string | null = null;

  /* ---------------------------------------------------------- field */

  const rnd = mulberry32(20260717);
  const makeLayer = (par: number, share: number, rMin: number, rMax: number): FieldLayer => {
    const count = Math.max(24, Math.round(opts.starBudget * share));
    const stars: FieldStar[] = [];
    for (let i = 0; i < count; i++) {
      const gold = rnd() > 0.955; // rare gold twinkles
      stars.push({
        x: rnd(),
        y: rnd(),
        r: rMin + rnd() * (rMax - rMin),
        a: 0.14 + rnd() * 0.5,
        ph: rnd() * TAU,
        sp: 0.3 + rnd() * 0.9,
        tint: gold ? 3 : Math.floor(rnd() * 3),
        flare: !gold && rnd() > 0.97,
      });
    }
    return { par, stars };
  };

  // Proto A's three depths; the nearest layer carries the flares.
  const layers: FieldLayer[] = [
    makeLayer(0.22, 0.5, 0.35, 0.85),
    makeLayer(0.45, 0.32, 0.45, 1.15),
    makeLayer(0.72, 0.18, 0.6, 1.5),
  ];

  // Nebula whispers painted once offscreen (proto A), drawn with low parallax.
  const nebula = document.createElement('canvas');
  nebula.width = 900;
  nebula.height = 550;
  (function paintNebula() {
    const n = nebula.getContext('2d');
    if (!n) return;
    n.globalCompositeOperation = 'lighter';
    const blobs: [number, number, number, string, number][] = [
      [0.2, 0.68, 250, '20, 28, 80', 0.5],
      [0.38, 0.5, 300, '26, 27, 75', 0.5],
      [0.56, 0.4, 310, '24, 34, 92', 0.45],
      [0.74, 0.3, 280, '30, 30, 80', 0.45],
      [0.5, 0.52, 150, '62, 52, 60', 0.14], // faint warm heart
      [0.82, 0.62, 200, '18, 24, 70', 0.36],
    ];
    for (const [px, py, r, rgb, a] of blobs) {
      const g = n.createRadialGradient(px * 900, py * 550, 0, px * 900, py * 550, r);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      n.fillStyle = g;
      n.fillRect(0, 0, 900, 550);
    }
  })();

  // Paper grain tile (proto B): a whisper of stipple over the whole page.
  const grainTile = document.createElement('canvas');
  grainTile.width = grainTile.height = 160;
  (function paintGrain() {
    const g = grainTile.getContext('2d');
    if (!g) return;
    const img = g.createImageData(160, 160);
    const r = mulberry32(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = r() * 14;
    }
    g.putImageData(img, 0, 0);
  })();
  let grainPattern: CanvasPattern | null = null;

  function sizeCanvases(): void {
    DPR = Math.min(window.devicePixelRatio || 1, opts.dprCap);
    for (const c of [fieldCanvas, fxCanvas]) {
      c.width = Math.max(1, Math.round(W * DPR));
      c.height = Math.max(1, Math.round(H * DPR));
      const ctx = c.getContext('2d');
      ctx?.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  function drawField(now: number): void {
    fieldX.clearRect(0, 0, W, H);

    // Navy paper wash, brighter toward the middle of the page (proto B).
    const bg = fieldX.createRadialGradient(
      W / 2, H * 0.44, 0,
      W / 2, H * 0.44, Math.max(W, H) * 0.75
    );
    bg.addColorStop(0, '#141A4A');
    bg.addColorStop(0.55, '#0D1338');
    bg.addColorStop(1, '#080B20');
    fieldX.fillStyle = bg;
    fieldX.fillRect(0, 0, W, H);

    // Nebula band, deep parallax.
    {
      const par = 0.3;
      const nx = -cam.x * par;
      const ny = -cam.y * par;
      fieldX.save();
      fieldX.globalAlpha = 0.9;
      fieldX.drawImage(nebula, nx - W * 0.25, ny - H * 0.25, W * 1.5, H * 1.5);
      fieldX.restore();
    }

    const brighten = scene && gilded.has(scene.figureKey) ? 1.22 : 1;

    for (const layer of layers) {
      const spanW = W * 1.9;
      const spanH = H * 1.9;
      const ox = -cam.x * layer.par;
      const oy = -cam.y * layer.par;
      for (const s of layer.stars) {
        // Tile the layer so drag-to-peek never runs out of sky.
        let x = ((s.x * spanW + ox) % spanW + spanW) % spanW - W * 0.45;
        let y = ((s.y * spanH + oy) % spanH + spanH) % spanH - H * 0.45;
        if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
        const tw = 0.72 + 0.28 * Math.sin(now * 0.001 * s.sp + s.ph);
        let a = s.a * tw * brighten;
        if (brighten > 1) {
          // Completed constellations glow strongest near the plate's heart.
          const d = Math.hypot(x - W / 2, y - H / 2) / Math.max(W, H);
          a = Math.min(1, a * (1 + 0.45 * Math.max(0, 1 - d * 2.2)));
        }
        fieldX.fillStyle = `rgba(${TINTS[s.tint]}, ${a.toFixed(3)})`;
        fieldX.beginPath();
        fieldX.arc(x, y, s.r, 0, TAU);
        fieldX.fill();
        if (s.flare && s.r > 1.1) {
          fieldX.strokeStyle = `rgba(210, 235, 255, ${(a * 0.45).toFixed(3)})`;
          fieldX.lineWidth = 0.6;
          fieldX.beginPath();
          fieldX.moveTo(x - s.r * 5, y);
          fieldX.lineTo(x + s.r * 5, y);
          fieldX.moveTo(x, y - s.r * 5);
          fieldX.lineTo(x, y + s.r * 5);
          fieldX.stroke();
        }
      }
    }

    // paper grain over the page
    if (!grainPattern) grainPattern = fieldX.createPattern(grainTile, 'repeat');
    if (grainPattern) {
      fieldX.save();
      fieldX.globalAlpha = 0.5;
      fieldX.fillStyle = grainPattern;
      fieldX.fillRect(0, 0, W, H);
      fieldX.restore();
    }
  }

  /* ---------------------------------------------------------- fx layer */

  function drawFx(now: number): boolean {
    fxX.clearRect(0, 0, W, H);
    let active = false;

    // Persistent gold links of a finished plate (this figure only).
    if (gildKeep.length && scene && gildKeepFigure === scene.figureKey) {
      fxX.save();
      fxX.translate(cam.x * -1, cam.y * -1);
      for (const l of gildKeep) {
        fxX.strokeStyle = `rgba(230, 188, 92, ${l.a})`;
        fxX.lineWidth = 1.25;
        fxX.shadowColor = 'rgba(230, 188, 92, 0.5)';
        fxX.shadowBlur = 3;
        fxX.beginPath();
        fxX.moveTo(l.x1, l.y1);
        fxX.lineTo(l.x2, l.y2);
        fxX.stroke();
      }
      fxX.restore();
    }

    fx = fx.filter((m) => {
      if (m.kind === 'flourish') return now < m.t0 + m.draw + m.hold + m.fade;
      if (m.kind === 'gild') return now < m.t0 + m.dur + 60;
      if (m.kind === 'sweep') return now < m.t0 + m.dur;
      return now < m.t0 + m.life;
    });

    for (const m of fx) {
      const el = now - m.t0;
      if (el < 0) {
        active = true;
        continue;
      }

      if (m.kind === 'flourish') {
        // A fine gold circle being inked around the star, then it fades.
        active = true;
        const drawT = clamp(el / m.draw, 0, 1);
        const fadeT = clamp((el - m.draw - m.hold) / m.fade, 0, 1);
        const alpha = 0.85 * (1 - fadeT);
        if (alpha <= 0) continue;
        fxX.strokeStyle = `rgba(230, 188, 92, ${alpha.toFixed(3)})`;
        fxX.lineWidth = 1.1;
        fxX.beginPath();
        fxX.arc(m.x, m.y, m.r, -Math.PI * 0.45, -Math.PI * 0.45 + TAU * easeOutExpo(drawT));
        fxX.stroke();
      } else if (m.kind === 'gather') {
        active = true;
        const t = clamp(el / m.life, 0, 1);
        const e = t * t * (3 - 2 * t);
        const x = lerp(m.x0, m.x1, e);
        const y = lerp(m.y0, m.y1, e);
        const a = m.a * (t < 0.85 ? 1 : (1 - t) / 0.15);
        const r = m.r * (1 - 0.4 * t);
        fxX.fillStyle = `rgba(${m.warm ? '246, 213, 92' : '230, 188, 92'}, ${a.toFixed(3)})`;
        fxX.beginPath();
        fxX.arc(x, y, r, 0, TAU);
        fxX.fill();
      } else if (m.kind === 'pulse') {
        active = true;
        const t = clamp(el / m.life, 0, 1);
        const r = lerp(m.r0, m.r1, easeOutExpo(t));
        const a = m.a * (1 - t);
        const g = fxX.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        g.addColorStop(0, `rgba(255, 226, 130, ${(a * 0.5).toFixed(3)})`);
        g.addColorStop(0.6, `rgba(230, 188, 92, ${(a * 0.22).toFixed(3)})`);
        g.addColorStop(1, 'rgba(230, 188, 92, 0)');
        fxX.fillStyle = g;
        fxX.beginPath();
        fxX.arc(m.x, m.y, r, 0, TAU);
        fxX.fill();
      } else if (m.kind === 'settle') {
        active = true;
        const t = clamp(el / m.life, 0, 1);
        const x = m.x0 + m.vx * el * 0.001;
        const y = m.y0 + m.vy * el * 0.001;
        const a = m.a * Math.sin(Math.PI * t);
        fxX.fillStyle = `rgba(246, 213, 92, ${a.toFixed(3)})`;
        fxX.beginPath();
        fxX.arc(x, y, m.r, 0, TAU);
        fxX.fill();
      } else if (m.kind === 'gild') {
        // The engraver re-inks one connecting line in gold, stroke by stroke.
        active = true;
        const t = easeOutExpo(clamp(el / m.dur, 0, 1));
        const x = lerp(m.x1, m.x2, t);
        const y = lerp(m.y1, m.y2, t);
        fxX.save();
        fxX.translate(-cam.x, -cam.y);
        fxX.strokeStyle = 'rgba(230, 188, 92, 0.78)';
        fxX.lineWidth = 1.25;
        fxX.shadowColor = 'rgba(230, 188, 92, 0.5)';
        fxX.shadowBlur = 3;
        fxX.beginPath();
        fxX.moveTo(m.x1, m.y1);
        fxX.lineTo(x, y);
        fxX.stroke();
        if (t < 1) {
          // the engraver's point of light
          const g = fxX.createRadialGradient(x, y, 0, x, y, 16);
          g.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
          g.addColorStop(1, 'rgba(246, 213, 92, 0)');
          fxX.fillStyle = g;
          fxX.beginPath();
          fxX.arc(x, y, 16, 0, TAU);
          fxX.fill();
        }
        fxX.restore();
        if (t >= 1) {
          // move to the persistent layer exactly once
          if (!gildKeep.some((l) => l.x1 === m.x1 && l.y1 === m.y1 && l.x2 === m.x2 && l.y2 === m.y2)) {
            gildKeep.push({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, a: 0.78 });
          }
        }
      } else if (m.kind === 'sweep') {
        // The gilding light passes once across the plate, left to right.
        active = true;
        const t = clamp(el / m.dur, 0, 1);
        const x = lerp(m.x0, m.x1, easeInOutSoft(t));
        const a = Math.sin(Math.PI * t) * 0.16;
        const g = fxX.createRadialGradient(x, m.y, 0, x, m.y, m.r);
        g.addColorStop(0, `rgba(246, 213, 92, ${a.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(230, 188, 92, ${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1, 'rgba(230, 188, 92, 0)');
        fxX.fillStyle = g;
        fxX.fillRect(x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      }
    }

    return active || (gildKeep.length > 0 && gildKeepFigure === scene?.figureKey);
  }

  /* ---------------------------------------------------------- world transform */

  function applyWorld(): void {
    opts.worldEl.style.transform =
      `translate3d(${(-cam.x).toFixed(2)}px, ${(-cam.y).toFixed(2)}px, 0)` +
      ` scale(${worldScale.toFixed(4)}) rotate(${worldRot.toFixed(3)}deg)`;
    opts.worldEl.style.opacity = worldOpacity.toFixed(3);
  }

  /* ---------------------------------------------------------- glide + drag */

  let glide: { t0: number; dur: number; fromX: number; fromY: number } | null = null;
  let spring: { t0: number; dur: number; fromX: number; fromY: number } | null = null;

  function startGlide(figureKey: string): void {
    const dir = figureDirection(figureKey);
    // The new constellation enters from its own direction of the sky.
    cam.x = dir.x * W * 0.42;
    cam.y = dir.y * H * 0.42;
    glide = { t0: performance.now(), dur: 850, fromX: cam.x, fromY: cam.y };
    spring = null;
    worldOpacity = 0;
  }

  function stepGlide(now: number): void {
    if (glide) {
      const t = clamp((now - glide.t0) / glide.dur, 0, 1);
      const e = easeInOutSoft(t);
      cam.x = lerp(glide.fromX, 0, e);
      cam.y = lerp(glide.fromY, 0, e);
      // the page turns very slightly under the eye, and the camera lifts
      const arc = Math.sin(Math.PI * t);
      worldScale = 1 - 0.06 * arc;
      worldRot = 0.6 * arc * Math.sign(glide.fromX || 1);
      worldOpacity = clamp(t / 0.35, 0, 1);
      if (t >= 1) {
        glide = null;
        worldScale = 1;
        worldRot = 0;
        worldOpacity = 1;
      }
      applyWorld();
    } else if (spring) {
      const t = clamp((now - spring.t0) / spring.dur, 0, 1);
      const e = easeOutExpo(t);
      cam.x = lerp(spring.fromX, 0, e);
      cam.y = lerp(spring.fromY, 0, e);
      if (t >= 1) spring = null;
      applyWorld();
    }
  }

  // Drag-to-peek: the reader takes hold of the page, with soft resistance,
  // and it settles back on release (proto A + proto B).
  let dragging = false;
  let dragBase: { px: number; py: number; cx: number; cy: number } | null = null;

  const onPointerDown = (e: PointerEvent): void => {
    if (disposed || glide) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest('.star, button, a, input, .seed-details-panel, .bloom-card-overlay, .helper-popup, .modal-header')
    ) {
      return;
    }
    dragging = true;
    spring = null;
    dragBase = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y };
    try {
      opts.dragSurface.setPointerCapture(e.pointerId);
    } catch {
      /* older browsers */
    }
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging || !dragBase) return;
    // soft resistance: this is a peek, not a scroll
    const dx = (e.clientX - dragBase.px) * 0.7;
    const dy = (e.clientY - dragBase.py) * 0.7;
    cam.x = clamp(dragBase.cx - dx, -W * 0.38, W * 0.38);
    cam.y = clamp(dragBase.cy - dy, -H * 0.34, H * 0.34);
    applyWorld();
  };
  const onPointerUp = (): void => {
    if (!dragging) return;
    dragging = false;
    dragBase = null;
    if (Math.abs(cam.x) > 0.5 || Math.abs(cam.y) > 0.5) {
      spring = { t0: performance.now(), dur: 900, fromX: cam.x, fromY: cam.y };
    }
  };

  opts.dragSurface.addEventListener('pointerdown', onPointerDown);
  opts.dragSurface.addEventListener('pointermove', onPointerMove);
  opts.dragSurface.addEventListener('pointerup', onPointerUp);
  opts.dragSurface.addEventListener('pointercancel', onPointerUp);

  /* ---------------------------------------------------------- loop */

  let rafId = 0;
  let lastFieldDraw = 0;

  function frame(now: number): void {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    if (paused) return;

    stepGlide(now);

    // hush follows its target gently (A's celebration dim)
    hush = lerp(hush, hushTarget, 0.07);
    if (Math.abs(hush - hushTarget) < 0.004) hush = hushTarget;
    opts.hushEl.style.opacity = hush.toFixed(3);

    // The field twinkles at ~30fps when idle; every frame while moving.
    const moving = dragging || glide !== null || spring !== null;
    if (moving || now - lastFieldDraw > 32) {
      drawField(now);
      lastFieldDraw = now;
      if (!firstFrameSent) {
        firstFrameSent = true;
        opts.onFirstFrame?.();
      }
    }

    drawFx(now);
  }

  sizeCanvases();
  rafId = requestAnimationFrame(frame);

  /* ---------------------------------------------------------- celebrations */

  function starScreenPos(seedId: string): { x: number; y: number } | null {
    if (!scene) return null;
    const s = scene.stars.find((st) => st.id === seedId);
    if (!s) return null;
    return { x: (s.xPct / 100) * W - cam.x, y: (s.yPct / 100) * H - cam.y };
  }

  /* ---------------------------------------------------------- api */

  return {
    setScene(next: SkyScene): void {
      const prevKey = scene?.figureKey;
      const sizeChanged = !scene || scene.width !== next.width || scene.height !== next.height;
      scene = next;
      if (sizeChanged && next.width > 1 && next.height > 1) {
        W = next.width;
        H = next.height;
        sizeCanvases();
        lastFieldDraw = 0;
      }
      if (prevKey !== undefined && prevKey !== next.figureKey) {
        // a new plate: retire the old figure's transient gold
        fx = fx.filter((m) => m.kind !== 'gild' && m.kind !== 'sweep');
        if (gildKeepFigure !== next.figureKey) {
          gildKeep = [];
          gildKeepFigure = null;
        }
        startGlide(next.figureKey);
      } else if (prevKey === undefined) {
        // arrival: glide into the first plate as well
        startGlide(next.figureKey);
      }
    },

    setSize(width: number, height: number): void {
      if (width < 2 || height < 2) return;
      W = width;
      H = height;
      sizeCanvases();
      lastFieldDraw = 0;
    },

    nova(seedId: string): void {
      const p = starScreenPos(seedId);
      if (!p) return;
      const now = performance.now();

      // 1. the surveyor's flourish is inked around the star
      fx.push({ kind: 'flourish', x: p.x, y: p.y, r: 26, t0: now, draw: 850, hold: 200, fade: 650 });

      // 2. gold dust gathers INWARD (gathering, not bursting)
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * TAU;
        const R = 46 + Math.random() * 34;
        fx.push({
          kind: 'gather',
          x0: p.x + Math.cos(a) * R,
          y0: p.y + Math.sin(a) * R,
          x1: p.x,
          y1: p.y,
          r: 0.8 + Math.random() * 1.5,
          a: 0.5 + Math.random() * 0.45,
          t0: now + i * 42,
          life: 780 + Math.random() * 420,
          warm: Math.random() > 0.5,
        });
      }

      // 3. one soft pulse as the dust arrives
      fx.push({ kind: 'pulse', x: p.x, y: p.y, r0: 6, r1: 46, a: 0.85, t0: now + 900, life: 900 });

      // 4. a few stray flecks settle in the margin
      for (let i = 0; i < 4; i++) {
        fx.push({
          kind: 'settle',
          x0: p.x + (Math.random() - 0.5) * 130,
          y0: p.y + (Math.random() - 0.5) * 110,
          vx: (Math.random() - 0.5) * 14,
          vy: 8 + Math.random() * 10,
          r: 0.7 + Math.random(),
          a: 0.35,
          t0: now + 500,
          life: 1900,
        });
      }

      // A's ambient hush: the sky dims from the edges, then releases.
      hushTarget = 0.55;
      window.setTimeout(() => {
        if (!disposed) hushTarget = 0;
      }, 1900);
    },

    ignite(): void {
      if (!scene) return;
      const now = performance.now();
      const segs = scene.segments;
      const per = 110;

      // 1. every connecting line is re-inked in gold, one stroke after another
      segs.forEach((s, i) => {
        fx.push({
          kind: 'gild',
          x1: s.x1,
          y1: s.y1,
          x2: s.x2,
          y2: s.y2,
          t0: now + 300 + i * per,
          dur: 480,
        });
      });
      gildKeepFigure = scene.figureKey;
      const linksDone = 300 + segs.length * per + 480;

      // 2. the gilding light passes once across the plate
      fx.push({
        kind: 'sweep',
        x0: -W * 0.15,
        x1: W * 1.15,
        y: H * 0.48,
        r: Math.max(320, H * 0.55),
        t0: now + linksDone - 500,
        dur: 2400,
      });

      // 3. gold dust drifts down over the finished figure
      for (let i = 0; i < 26; i++) {
        fx.push({
          kind: 'settle',
          x0: W * (0.12 + Math.random() * 0.76),
          y0: H * (0.08 + Math.random() * 0.6),
          vx: (Math.random() - 0.5) * 10,
          vy: 10 + Math.random() * 12,
          r: 0.6 + Math.random() * 1.2,
          a: 0.4,
          t0: now + linksDone - 300 + Math.random() * 1400,
          life: 2200 + Math.random() * 900,
        });
      }

      // 4. this neighbourhood of the sky brightens a little, permanently
      window.setTimeout(() => {
        if (!disposed && scene) gilded.add(scene.figureKey);
      }, linksDone + 1200);

      // deep hush while the engraver works, then calm
      hushTarget = 0.75;
      window.setTimeout(() => {
        if (!disposed) hushTarget = 0;
      }, linksDone + 1800);
    },

    setPaused(next: boolean): void {
      paused = next;
    },

    dispose(): void {
      disposed = true;
      cancelAnimationFrame(rafId);
      opts.dragSurface.removeEventListener('pointerdown', onPointerDown);
      opts.dragSurface.removeEventListener('pointermove', onPointerMove);
      opts.dragSurface.removeEventListener('pointerup', onPointerUp);
      opts.dragSurface.removeEventListener('pointercancel', onPointerUp);
      fx = [];
      gildKeep = [];
      fieldX.clearRect(0, 0, W, H);
      fxX.clearRect(0, 0, W, H);
    },
  };
}
