// The full face turns like a page: a sideways swipe on the hero, the two arrow buttons, or the arrow keys while focus
// is in the hero put the next or previous of the thirty on the stage (era order, wrapping at the ends). The surface
// keeps the browser's vertical pan (touch-action in c2.css), so the browser decides a vertical scroll and cancels our
// pointer; a sideways start that ends mostly vertical is refused at release. A swipe never reaches the plate's click.

import { stageFigureId, stageFigures, swapStage } from '../../stage';
import { momentStill } from '../../dust';

/** Movement before the gesture picks its axis, in CSS px. */
const SLOP = 10;
/** The sideways part must lead the vertical part by this factor, at the slop and again at release. */
const AXIS = 1.2;
/** A release past this share of the surface's width (or COMMIT_MIN px) turns; a fast flick turns from FLICK_MIN px. */
const COMMIT = 0.16;
const COMMIT_MIN = 56;
const FLICK_SPEED = 0.45;
const FLICK_MIN = 28;
/** The old painting's way out, and the spring back of a swipe that does not turn. */
const OUT_MS = 170;
const BACK_MS = 200;

type Dir = 1 | -1;

interface Drag {
  id: number;
  el: Element;
  x0: number;
  y0: number;
  t0: number;
  axis: 'none' | 'x' | 'y';
  dx: number;
  dy: number;
  lastX: number;
  lastT: number;
  speed: number;
}

let drag: Drag | null = null;
let turning = false;
let swallowUntil = 0;

function hero(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-c2-hero]');
}

function mat(): HTMLElement | null {
  return hero()?.querySelector<HTMLElement>('.ls-card__mat') ?? null;
}

function neighbour(dir: Dir): string {
  const all = stageFigures();
  if (!all.length) return '';
  const i = all.findIndex(f => f.id === stageFigureId());
  const next = all[(Math.max(0, i) + dir + all.length) % all.length];
  return next?.id ?? '';
}

function fill(template: string | undefined, name: string): string {
  return (template ?? '').replace('{name}', name);
}

/** The arrows say whom they lead to; they wait hidden in the markup, since only this script can turn the stage. */
function labelArrows(): void {
  const box = document.querySelector<HTMLElement>('[data-c2-turn]');
  if (!box) return;
  box.hidden = false;
  const all = stageFigures();
  for (const btn of box.querySelectorAll<HTMLButtonElement>('[data-c2-dir]')) {
    const dir: Dir = btn.dataset.c2Dir === 'prev' ? -1 : 1;
    const f = all.find(x => x.id === neighbour(dir));
    if (!f) continue;
    btn.setAttribute('aria-label', fill(dir === 1 ? box.dataset.next : box.dataset.prev, f.name));
  }
}

const warmed = new Set<string>();

/** Fetches a neighbour's painting ahead of a turn (a finger on the face, a pointer or focus on an arrow), as the stage
 * will ask for it, so the new face does not wait on the network; nothing is fetched before a visitor reaches for it. */
function warm(dir: Dir | 0): void {
  const img = hero()?.querySelector<HTMLImageElement>('[data-stage-img]');
  if (!img) return;
  const all = stageFigures();
  for (const d of dir ? [dir] : ([1, -1] as const)) {
    const f = all.find(x => x.id === neighbour(d));
    if (!f || warmed.has(f.id)) continue;
    warmed.add(f.id);
    const pre = new Image();
    pre.crossOrigin = 'anonymous';
    pre.sizes = img.sizes;
    pre.srcset = f.main.srcset;
    pre.src = f.main.src;
  }
}

function setMat(x: number, fade: number, ms: number): void {
  const m = mat();
  if (!m) return;
  m.style.transition = ms ? `transform ${ms}ms ease, opacity ${ms}ms ease` : 'none';
  m.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
  m.style.opacity = fade < 1 ? String(fade) : '';
}

/** Puts the neighbour on the stage; the old painting leaves the way the finger went. */
export function turn(dir: Dir): boolean {
  if (turning) return false;
  const id = neighbour(dir);
  lastDir = dir;
  if (!id || !hero()) return false;
  const m = mat();
  const still = momentStill();
  const go = () => {
    turning = false;
    if (!swapStage(id, { history: 'replace', focus: 'keep' })) {
      setMat(0, 1, 0);
      return;
    }
    // the painting already left with the mat: it stays hidden until the new face condenses (or shows, when still)
    const img = hero()?.querySelector<HTMLImageElement>('[data-stage-img]');
    if (img && !still) {
      img.style.transition = 'none';
      img.style.opacity = '0';
    }
    setMat(0, 1, 0);
  };
  if (still || !m) {
    go();
    return true;
  }
  turning = true;
  const width = m.getBoundingClientRect().width || window.innerWidth;
  setMat(-dir * width * 0.34, 0, OUT_MS);
  window.setTimeout(go, OUT_MS);
  return true;
}

// ---- touch ----------------------------------------------------------------------------

function onDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse' || !e.isPrimary || turning) return;
  const target = e.target instanceof Element ? e.target : null;
  if (!target || target.closest('[data-c2-rail]')) return;
  const el = hero();
  if (!el) return;
  // a finger on the face, not on a control: a tap on the plate keeps the network for its story
  if (!target.closest('a, button, summary')) warm(0);
  drag = { id: e.pointerId, el, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, axis: 'none', dx: 0, dy: 0, lastX: e.clientX, lastT: e.timeStamp, speed: 0 };
}

function onMove(e: PointerEvent): void {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  d.dx = e.clientX - d.x0;
  d.dy = e.clientY - d.y0;
  const dt = e.timeStamp - d.lastT;
  if (dt > 0) d.speed = (e.clientX - d.lastX) / dt;
  d.lastX = e.clientX;
  d.lastT = e.timeStamp;
  if (d.axis === 'none') {
    if (Math.abs(d.dx) < SLOP && Math.abs(d.dy) < SLOP) return;
    d.axis = Math.abs(d.dx) > Math.abs(d.dy) * AXIS ? 'x' : 'y';
    if (d.axis === 'y') {
      drag = null;
      return;
    }
    try {
      d.el.setPointerCapture(d.id);
    } catch {
      // a synthetic or already released pointer
    }
  }
  if (d.axis !== 'x') return;
  const width = mat()?.getBoundingClientRect().width || window.innerWidth;
  setMat(d.dx, 1 - Math.min(0.55, Math.abs(d.dx) / width), 0);
}

function onUp(e: PointerEvent): void {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  drag = null;
  if (d.axis !== 'x') return;
  // the click a touch may still send after a sideways move never plays a story
  swallowUntil = e.timeStamp + 600;
  const width = mat()?.getBoundingClientRect().width || window.innerWidth;
  const far = Math.abs(d.dx) >= Math.max(COMMIT_MIN, width * COMMIT);
  const flick = Math.abs(d.dx) >= FLICK_MIN && Math.abs(d.speed) >= FLICK_SPEED && Math.sign(d.speed) === Math.sign(d.dx);
  const sideways = Math.abs(d.dx) > Math.abs(d.dy) * AXIS;
  if (sideways && (far || flick)) {
    turn(d.dx < 0 ? 1 : -1);
    return;
  }
  setMat(0, 1, momentStill() ? 0 : BACK_MS);
}

function onCancel(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.id) return;
  const was = drag.axis;
  drag = null;
  if (was === 'x') setMat(0, 1, momentStill() ? 0 : BACK_MS);
}

function onClickCapture(e: MouseEvent): void {
  if (e.timeStamp > swallowUntil) return;
  swallowUntil = 0;
  e.preventDefault();
  e.stopPropagation();
}

// ---- buttons and keys -------------------------------------------------------------------

function onClick(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  const btn = target?.closest<HTMLButtonElement>('[data-c2-dir]');
  if (!btn) return;
  e.preventDefault();
  turn(btn.dataset.c2Dir === 'prev' ? -1 : 1);
}

function onReach(e: Event): void {
  const target = e.target instanceof Element ? e.target : null;
  const btn = target?.closest<HTMLElement>('[data-c2-dir]');
  if (btn) warm(btn.dataset.c2Dir === 'prev' ? -1 : 1);
}

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const target = e.target instanceof Element ? e.target : null;
  const root = hero();
  if (!target || !root || !root.contains(target)) return;
  // the rail scrolls with its own keys; a field keeps its caret
  if (target.closest('[data-c2-rail], input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  turn(e.key === 'ArrowRight' ? 1 : -1);
}

let installed = false;

export function installSwipe(): void {
  if (installed) return;
  installed = true;
  // listeners on the document survive the router's soft page changes; each one asks for the hero first
  document.addEventListener('pointerdown', e => {
    // a new touch is a new gesture: only the click left over from a swipe is swallowed
    swallowUntil = 0;
    if (hero()?.contains(e.target as Node)) onDown(e);
  });
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  window.addEventListener('click', onClickCapture, true);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerover', onReach);
  document.addEventListener('focusin', onReach);
}

let lastDir: Dir | 0 = 0;

/** Called after every swap: the arrows' names follow the stage; after a turn, the next one the same way is warmed. */
export function afterSwap(): void {
  labelArrows();
  if (lastDir) warm(lastDir);
  lastDir = 0;
}
