// Concept 2's script: the moment on the full face and what a pick does to the view. The stage itself (swap, plate,
// addresses, back and forward) is the base's; its own moment is off here so the tagline over the painting can be
// kept clear of the dust like the name.

import { onStageSwap, stageFigureId, stageFigures, swapStage } from '../../stage';
import { momentStill, runMoment } from '../../dust';
import { MAIN_EYES } from '../../eyes';

let observed: HTMLImageElement | null = null;
const watcher = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => runOnHero(null));

function hero(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-c2-hero]');
}

function freezeAt(): number | null {
  const t = new URLSearchParams(location.search).get('t');
  return t !== null && /^\d+$/.test(t) ? Number(t) : null;
}

/** The face condenses, the stream writes the figure's line and runs into the plate's disc. */
function runOnHero(freeze: number | null): void {
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

/** After a pick from the list below, the stage comes back into view; from the rail, only the plate is brought in. */
function bringStage(from: string): void {
  const root = hero();
  if (!root) return;
  const behavior: ScrollBehavior = reduced() ? 'auto' : 'smooth';
  if (from === 'index') {
    window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.scrollY - 66), behavior });
    return;
  }
  const plate = root.querySelector<HTMLElement>('[data-story-hero-plate]');
  if (!plate) return;
  const r = plate.getBoundingClientRect();
  if (r.top < 66) window.scrollBy({ top: r.top - 80, behavior });
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

/** A page opened on a later figure (an address with ?figure=) shows its face in the row. */
function centreRail(): void {
  const rail = document.querySelector<HTMLElement>('[data-c2-rail]');
  const on = rail?.querySelector<HTMLElement>('[aria-current="true"]');
  if (!rail || !on) return;
  if (on.offsetLeft + on.offsetWidth <= rail.scrollLeft + rail.clientWidth) return;
  rail.scrollLeft = Math.max(0, on.offsetLeft - rail.clientWidth / 2 + on.offsetWidth / 2);
}

let installed = false;

export function installC2(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('click', onPick, true);
  onStageSwap(d => {
    attach(d.previous === '');
    if (d.previous === '') centreRail();
  });
  // the stage may have attached before this script ran (the opening swap event is then past)
  if (stageFigureId()) {
    attach(true);
    centreRail();
  }
  document.addEventListener('astro:before-swap', () => {
    watcher?.disconnect();
    observed = null;
  });
}
