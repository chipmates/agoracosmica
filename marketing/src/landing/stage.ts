// The stage's script: puts any of the thirty on the stage in place (the swap), gives each figure its own address in
// history, keeps focus, and leaves the dock alone, so a story keeps playing across a swap. The plate is the figure
// page's own (player/page.ts reads the page's queue script); a swap rewrites that script and the player follows.
//
// Back and forward between stage addresses stay in place: the client router's traversal to an entry this script
// wrote is answered without a fetch or a swap of the page (window capture listeners run before the router's own and
// the player's document listeners). Any other navigation is the router's as on every player page.

import { refreshPageQueue } from '../player/controller';
import { cancelMoment, momentStill, runMoment } from './dust';
import { LONG_NAME } from './eyes';
import type { Moment, MomentOptions } from './dust';
import type { StageFigure, StagePayload } from './thirty';

export interface SwapOptions {
  /** 'push' writes a new history entry (a visitor's pick); 'replace' and 'none' do not add one. */
  history?: 'push' | 'replace' | 'none';
  /** Run the moment on the new face (default: unless the stage's moment is off). */
  moment?: boolean;
  /** Overrides the stage's focus rule for this swap. */
  focus?: 'keep' | 'name';
  /** Say the new name to a screen reader (default true). */
  announce?: boolean;
}

export interface SwapDetail {
  id: string;
  previous: string;
  figure: StageFigure;
}

interface Templates { now: string; title: string; all: string }

interface StageView {
  root: HTMLElement;
  img: HTMLImageElement;
  name: HTMLElement;
  meta: HTMLElement;
  line: HTMLElement;
  disc: HTMLElement | null;
  all: HTMLAnchorElement | null;
  live: HTMLElement | null;
  queue: HTMLScriptElement;
  payload: StagePayload;
  byId: Map<string, StageFigure>;
  bySlug: Map<string, StageFigure>;
  templates: Templates;
}

let view: StageView | null = null;
let current = '';
let pageTitle = '';
let loadToken = 0;
let traversing = false;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
}

function readView(): StageView | null {
  const root = document.querySelector<HTMLElement>('[data-landing-stage]');
  if (!root) return null;
  const img = root.querySelector<HTMLImageElement>('[data-stage-img]');
  const name = root.querySelector<HTMLElement>('[data-stage-name]');
  const meta = root.querySelector<HTMLElement>('[data-stage-meta]');
  const line = root.querySelector<HTMLElement>('[data-stage-line]');
  const queue = root.querySelector<HTMLScriptElement>('script[data-story-queue]');
  const data = root.querySelector<HTMLScriptElement>('script[data-landing-thirty]');
  if (!img || !name || !meta || !line || !queue || !data) return null;
  let payload: StagePayload;
  let templates: Templates;
  try {
    payload = JSON.parse(data.textContent ?? '') as StagePayload;
    templates = JSON.parse(root.dataset.templates ?? '{}') as Templates;
  } catch {
    return null;
  }
  return {
    root,
    img,
    name,
    meta,
    line,
    disc: root.querySelector<HTMLElement>('[data-stage-disc]'),
    all: root.querySelector<HTMLAnchorElement>('[data-stage-all]'),
    live: root.querySelector<HTMLElement>('[data-stage-live]'),
    queue,
    payload,
    byId: new Map(payload.figures.map(f => [f.id, f])),
    bySlug: new Map(payload.figures.map(f => [f.slug, f])),
    templates,
  };
}

// ---- reading the stage from outside ----------------------------------------------

/** The figure on the stage now, or '' on a page without one. */
export function stageFigureId(): string {
  return view ? current : '';
}

/** Every figure the stage can show, in the page's language, oldest first. */
export function stageFigures(): StageFigure[] {
  return view ? view.payload.figures : [];
}

/** Calls back after every swap (and once for the figure a page opens on). Returns the unsubscribe. */
export function onStageSwap(fn: (detail: SwapDetail) => void): () => void {
  const listener = (e: Event) => fn((e as CustomEvent<SwapDetail>).detail);
  document.addEventListener('landing:swap', listener);
  return () => document.removeEventListener('landing:swap', listener);
}

// ---- the moment on the stage ---------------------------------------------------------

/** The stage's own moment: the face condenses, the stream writes the line and runs into the plate's disc. The name,
 * its line of facts and the AI-image credit stay legible over the painting throughout. */
export function stageMoment(extra: Partial<MomentOptions> = {}): Moment | null {
  if (!view) return null;
  const credit = view.root.querySelector('.ai-credit');
  return runMoment({ image: view.img, line: view.line, end: view.disc, keep: [view.name, view.meta, ...(credit ? [credit] : [])], ...extra });
}

function freezeAt(): number | null {
  const t = new URLSearchParams(location.search).get('t');
  return t !== null && /^\d+$/.test(t) ? Number(t) : null;
}

// ---- addresses ----------------------------------------------------------------------

function addressFor(v: StageView, f: StageFigure): string {
  if (v.root.dataset.address === 'path') return f.href;
  const url = new URL(location.href);
  if (f.id === v.payload.first) url.searchParams.delete('figure');
  else url.searchParams.set('figure', f.slug);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The figure a fresh load asks for: `?figure=<slug or id>`, else the entry's own mark. */
function requested(v: StageView): StageFigure | null {
  const q = new URLSearchParams(location.search).get('figure');
  if (q) return v.bySlug.get(q) ?? v.byId.get(q) ?? null;
  const mark = (history.state as { landingStage?: unknown } | null)?.landingStage;
  return typeof mark === 'string' ? v.byId.get(mark) ?? null : null;
}

function markEntry(id: string): void {
  // the router's own fields first (index, scroll), so its traversal logic keeps working
  const st = (history.state ?? {}) as Record<string, unknown>;
  history.replaceState({ index: 0, scrollX: window.scrollX, scrollY: window.scrollY, ...st, landingStage: id }, '');
}

function pushEntry(id: string, url: string): void {
  const st = (history.state ?? {}) as { index?: number };
  const index = (typeof st.index === 'number' ? st.index : 0) + 1;
  history.pushState({ index, scrollX: window.scrollX, scrollY: window.scrollY, landingStage: id }, '', url);
}

// ---- the swap -------------------------------------------------------------------------

function announce(v: StageView, text: string): void {
  if (!v.live) return;
  v.live.textContent = '';
  // a fresh node for the same words, so a repeat is read again
  window.setTimeout(() => {
    if (v.live) v.live.textContent = text;
  }, 60);
}

function markPicks(id: string): void {
  document.querySelectorAll<HTMLElement>('[data-landing-pick]').forEach(el => {
    if (el.dataset.landingPick === id) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
}

function setCrop(img: HTMLImageElement, f: StageFigure): void {
  img.style.setProperty('--ls-fx', `${f.focal}%`);
  img.style.setProperty('--ls-py', `${f.crop.py}%`);
  img.style.setProperty('--ls-pyd', `${f.crop.pyd}%`);
}

function setPortrait(v: StageView, f: StageFigure): void {
  v.img.srcset = f.main.srcset;
  v.img.src = f.main.src;
  v.img.alt = f.alt;
  setCrop(v.img, f);
}

function showPortrait(v: StageView, f: StageFigure, withMoment: boolean): void {
  const token = ++loadToken;
  const still = momentStill();
  if (!still) {
    // the old face lets go while the new one loads
    v.img.style.animation = 'none';
    v.img.style.transition = 'opacity 180ms ease';
    v.img.style.opacity = '0';
  }
  const pre = new Image();
  pre.crossOrigin = 'anonymous';
  pre.sizes = v.img.sizes;
  pre.srcset = f.main.srcset;
  pre.src = f.main.src;
  const go = () => {
    if (token !== loadToken || !view) return;
    setPortrait(v, f);
    if (withMoment && !still) {
      stageMoment();
      return;
    }
    v.img.style.removeProperty('transition');
    v.img.style.removeProperty('opacity');
  };
  pre.decode().then(go, go);
}

/** Puts figure `id` (or its slug) on the stage in place. A story playing in the dock keeps playing. */
export function swapStage(idOrSlug: string, opts: SwapOptions = {}): boolean {
  const v = view;
  if (!v) return false;
  const f = v.byId.get(idOrSlug) ?? v.bySlug.get(idOrSlug);
  if (!f) return false;
  const previous = current;
  if (f.id === previous) return true;
  cancelMoment();
  current = f.id;
  v.root.dataset.figure = f.id;

  v.name.textContent = f.name;
  v.name.toggleAttribute('data-long', f.name.length > LONG_NAME);
  v.meta.textContent = f.meta;
  v.line.textContent = f.line;
  if (v.all) {
    v.all.href = f.href;
    v.all.textContent = fill(v.templates.all, { n: f.queue.entries.filter(e => e.n > 0).length });
  }
  // the plate's queue: the player reads it on the next tap, and its marks follow at once
  v.queue.textContent = JSON.stringify(f.queue);
  refreshPageQueue();
  markPicks(f.id);
  document.title = f.id === v.payload.first ? pageTitle : fill(v.templates.title, { name: f.name });

  const mode = opts.history ?? 'push';
  if (mode === 'push') {
    if ((history.state as { landingStage?: unknown } | null)?.landingStage === undefined) markEntry(previous);
    pushEntry(f.id, addressFor(v, f));
  } else if (mode === 'replace') {
    history.replaceState({ ...((history.state ?? {}) as object), landingStage: f.id }, '', addressFor(v, f));
  }

  const focus = opts.focus ?? (v.root.dataset.focus === 'name' ? 'name' : 'keep');
  if (focus === 'name') v.name.focus({ preventScroll: true });
  if (opts.announce !== false) announce(v, fill(v.templates.now, { name: f.name }));

  const withMoment = opts.moment ?? v.root.dataset.moment !== 'off';
  showPortrait(v, f, withMoment);
  document.dispatchEvent(new CustomEvent<SwapDetail>('landing:swap', { detail: { id: f.id, previous, figure: f } }));
  return true;
}

/** Plays the stage's moment again on the figure that is there. */
export function replayMoment(): Moment | null {
  return stageMoment();
}

// ---- picks: any element with data-landing-pick="<id>" swaps instead of leaving -------------

function onPick(e: MouseEvent): void {
  if (!view || e.defaultPrevented) return;
  const target = e.target instanceof Element ? e.target : null;
  const pick = target?.closest<HTMLElement>('[data-landing-pick]');
  if (!pick) return;
  // a new tab or window stays the browser's: the link's own address opens there
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = pick.dataset.landingPick ?? '';
  if (!view.byId.has(id)) return;
  // capture phase: the client router claims link clicks in the bubble phase
  e.preventDefault();
  swapStage(id, { history: 'push' });
}

// ---- back and forward between stage entries, in place ------------------------------------

type RouterEvent = Event & {
  navigationType?: string;
  loader?: () => Promise<void>;
  newDocument?: Document;
  swap?: () => void;
};

function stageEntry(): string | null {
  const mark = (history.state as { landingStage?: unknown } | null)?.landingStage;
  return typeof mark === 'string' ? mark : null;
}

function onBeforePreparation(e: Event): void {
  const ev = e as RouterEvent;
  const target = stageEntry();
  if (!view || ev.navigationType !== 'traverse' || !target || !view.byId.has(target)) {
    // a real page change: the running moment ends at its end state
    cancelMoment();
    return;
  }
  traversing = true;
  e.stopImmediatePropagation();
  ev.loader = async () => {
    ev.newDocument = document;
  };
}

function onBeforeSwap(e: Event): void {
  // a traversal answered in place hands the router this very document; when two overlap (back, then forward at once)
  // the first one's swap arrives after the flag is spent, and a swap of the page with itself drops the dock
  if (!traversing && (e as RouterEvent).newDocument !== document) return;
  e.stopImmediatePropagation();
  (e as RouterEvent).swap = () => undefined;
}

function onAfterSwap(e: Event): void {
  if (traversing) e.stopImmediatePropagation();
}

function onPageLoad(): void {
  if (traversing) {
    traversing = false;
    const target = stageEntry();
    if (target) swapStage(target, { history: 'none', focus: 'keep' });
    return;
  }
  // the first load's page-load finds the stage already attached; a soft page change brings a new one
  if (view && document.contains(view.root)) return;
  attach();
}

/** Without the client router, the browser's own popstate carries the traversal. */
function onPopState(): void {
  if (document.querySelector('[name="astro-view-transitions-enabled"]')) return;
  const target = stageEntry();
  if (view && target) swapStage(target, { history: 'none' });
}

// ---- start ---------------------------------------------------------------------------

function attach(): void {
  const v = readView();
  view = v;
  if (!v) {
    current = '';
    return;
  }
  current = v.root.dataset.figure ?? v.payload.first;
  pageTitle = document.title;
  const shown = v.byId.get(current);
  if (shown) setCrop(v.img, shown);
  markPicks(current);
  const want = requested(v);
  if (want && want.id !== current) {
    swapStage(want.id, { history: 'none', announce: false });
    return;
  }
  if (v.root.dataset.moment !== 'off') {
    const t = freezeAt();
    stageMoment(t !== null ? { freezeAt: t } : {});
  }
  document.dispatchEvent(new CustomEvent<SwapDetail>('landing:swap', { detail: { id: current, previous: '', figure: v.byId.get(current)! } }));
}

let installed = false;

export function installStage(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onPick, true);
  window.addEventListener('astro:before-preparation', onBeforePreparation, true);
  window.addEventListener('astro:before-swap', onBeforeSwap, true);
  window.addEventListener('astro:after-swap', onAfterSwap, true);
  document.addEventListener('astro:page-load', onPageLoad);
  window.addEventListener('popstate', onPopState);
  attach();
}
