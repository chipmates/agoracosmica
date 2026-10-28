// Concept 2's script: the moment on the full face and what a pick does to the view. The stage itself (swap, plate,
// addresses, back and forward) is the base's; its own moment is off here so the tagline over the painting can be
// kept clear of the dust like the name.

import { onStageSwap, stageFigureId, stageFigures, swapStage } from '../../stage';
import { momentStill, runMoment } from '../../dust';
import type { Beats } from '../../dust';
import { MAIN_EYES } from '../../eyes';
import { afterSwap, installSwipe } from './swipe';

let observed: HTMLImageElement | null = null;
// a swap's new face arrives through the short moment (the face alone); the arrival keeps the face and the line
const watcher = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => runOnHero(null, 'face'));

function hero(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-c2-hero]');
}

function freezeAt(): number | null {
  const t = new URLSearchParams(location.search).get('t');
  return t !== null && /^\d+$/.test(t) ? Number(t) : null;
}

/** The face condenses, the stream writes the figure's line and runs into the plate's disc. */
function runOnHero(freeze: number | null, beats: Beats = 'face+line'): void {
  const root = hero();
  const image = root?.querySelector<HTMLImageElement>('[data-stage-img]');
  if (!root || !image) return;
  const keep = Array.from(root.querySelectorAll<HTMLElement>('[data-c2-keep], [data-stage-name], [data-stage-meta]'));
  // the dust leads from this painting's own measured eyes
  const shown = stageFigures().find(f => f.id === stageFigureId());
  runMoment({
    image,
    line: root.querySelector<HTMLElement>('[data-stage-line]'),
    end: root.querySelector('[data-stage-disc]'),
    keep,
    eyes: shown?.eyes ?? MAIN_EYES,
    beats,
    freezeAt: freeze,
  });
}

/** True while the stage's swap is still loading the new painting (the image shows another figure's file). */
function swapInFlight(image: HTMLImageElement): boolean {
  const id = stageFigureId();
  const f = stageFigures().find(x => x.id === id);
  return !!f && image.getAttribute('src') !== f.main.src;
}

/** Watches the stage's painting: every new picture the swap sets runs the moment before it is painted. */
function attach(arrival: boolean): void {
  const image = hero()?.querySelector<HTMLImageElement>('[data-stage-img]') ?? null;
  if (!image || image === observed) return;
  watcher?.disconnect();
  watcher?.observe(image, { attributes: true, attributeFilter: ['src'] });
  observed = image;
  if (arrival && !swapInFlight(image)) runOnHero(freezeAt());
}

function reduced(): boolean {
  return momentStill();
}

/** After a pick the new face is brought back into view (the moment is the answer to the pick): from the list below
 * always, from the rail only when the face has scrolled away (a dock up over the rail makes a visitor scroll). */
function bringStage(from: string): void {
  const root = hero();
  if (!root) return;
  const top = root.getBoundingClientRect().top;
  if (from !== 'index' && top > -120) return;
  const bar = document.querySelector('.pub-navbar')?.getBoundingClientRect().height ?? 0;
  window.scrollTo({ top: Math.max(0, top + window.scrollY - bar), behavior: reduced() ? 'auto' : 'smooth' });
}

function onPick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const target = e.target instanceof Element ? e.target : null;
  const pick = target?.closest<HTMLElement>('[data-landing-pick][data-c2-from]');
  if (!pick || !hero()) return;
  const id = pick.dataset.landingPick ?? '';
  const from = pick.dataset.c2From ?? 'rail';
  // window capture runs before the stage's own document listener: this pick decides where focus goes
  if (!swapStage(id, { history: 'push', focus: from === 'index' ? 'name' : 'keep' })) return;
  e.preventDefault();
  bringStage(from);
}

/** The face on the stage stays in the row's view (an address with ?figure=, a swipe, an arrow); only the row moves. */
function centreRail(smooth: boolean): void {
  const rail = document.querySelector<HTMLElement>('[data-c2-rail]');
  const on = rail?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!rail || !on || rail.scrollWidth <= rail.clientWidth) return;
  const li = on.closest('li') ?? on;
  const left = (li as HTMLElement).offsetLeft;
  if (left >= rail.scrollLeft && left + on.offsetWidth <= rail.scrollLeft + rail.clientWidth) return;
  const to = Math.max(0, left - rail.clientWidth / 2 + on.offsetWidth / 2);
  rail.scrollTo({ left: to, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
}

// ---- the italic line's left edge ---------------------------------------------------------------------------
let measure: CanvasRenderingContext2D | null = null;

/** The first letter of each of the element's lines, read from the layout. */
function lineStarts(el: HTMLElement): string[] {
  const out: string[] = [];
  let lastTop = Number.NEGATIVE_INFINITY;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i]!)) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const r = range.getClientRects()[0];
      if (!r) continue;
      if (r.top > lastTop + 4) out.push(text[i]!);
      lastTop = Math.max(lastTop, r.top);
    }
  }
  return out;
}

/** An italic letter can reach left of its line (an f's hook, a D's serif): each line is set in by its first letter's
 * measured overhang, the first line by text-indent and the others by padding, so the ink starts on the text edge. */
function alignLine(): void {
  const el = hero()?.querySelector<HTMLElement>('[data-stage-line]');
  if (!el) return;
  measure ??= document.createElement('canvas').getContext('2d');
  if (!measure) return;
  const cs = getComputedStyle(el);
  measure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const over = (ch: string) => Math.max(0, Math.ceil(measure!.measureText(ch).actualBoundingBoxLeft * 2) / 2);
  el.style.removeProperty('padding-left');
  el.style.removeProperty('text-indent');
  let starts = lineStarts(el);
  // a set-in can move a break: measured again once
  for (let pass = 0; pass < 2; pass++) {
    const first = over(starts[0] ?? '');
    const rest = Math.max(0, ...starts.slice(1).map(over));
    el.style.setProperty('padding-left', `${rest}px`);
    el.style.setProperty('text-indent', `${first - rest}px`);
    const now = lineStarts(el);
    if (now.join('') === starts.join('')) break;
    starts = now;
  }
}

let installed = false;

export function installC2(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('click', onPick, true);
  installSwipe();
  onStageSwap(d => {
    alignLine();
    attach(d.previous === '');
    centreRail(d.previous !== '');
    afterSwap();
  });
  // the stage may have attached before this script ran (the opening swap event is then past)
  alignLine();
  void document.fonts?.ready.then(alignLine);
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    window.requestAnimationFrame(alignLine);
  });
  if (stageFigureId()) {
    attach(true);
    centreRail(false);
    afterSwap();
  }
  document.addEventListener('astro:before-swap', () => {
    watcher?.disconnect();
    observed = null;
  });
}
