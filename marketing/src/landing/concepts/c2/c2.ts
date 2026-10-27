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
  const keep = Array.from(root.querySelectorAll<HTMLElement>('[data-c2-keep], [data-stage-name], [data-stage-meta], .ls-card__credit'));
  runMoment({
    image,
    line: root.querySelector<HTMLElement>('[data-stage-line]'),
    end: root.querySelector('[data-stage-disc]'),
    keep,
    eyes: MAIN_EYES,
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

let installed = false;

export function installC2(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('click', onPick, true);
  installSwipe();
  onStageSwap(d => {
    attach(d.previous === '');
    centreRail(d.previous !== '');
    afterSwap();
  });
  // the stage may have attached before this script ran (the opening swap event is then past)
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
