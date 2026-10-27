// The figure page's own controls, plain HTML from the build: the plate, the
// rows that unfold, the map, the saved count and the "hear" buttons in the
// facts below. This module mirrors the player's state onto them and turns
// their taps into the player's calls. An unfolded row holds only its four
// actions: nothing of the story's text is fetched before Read or Listen.

import {
  activeQueue,
  getState,
  listenNow,
  openReader,
  openSheet,
  pause,
  play,
  playFrom,
  playStory,
  readPageQueue,
  readProgress,
  subscribe,
} from './controller';
import { LIST_SEP, clockLabel, playerStrings } from './strings';
import { showToast } from './toast';
import type { PlayerState, StoryQueue } from './types';

const DESKTOP = '(min-width: 1024px)';

function sameQueue(a: StoryQueue | null, b: StoryQueue | null): boolean {
  return !!a && !!b && a.figureId === b.figureId && a.lang === b.lang;
}

function setText(el: Element | null | undefined, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}

/** Whole minutes left, at least one, rounded as the contents round a story's length; a clock under a minute. */
function leftWords(state: PlayerState, lang: 'en' | 'de', seconds?: number): string {
  const s = playerStrings(lang);
  const total = state.duration > 0 ? state.duration : seconds ?? 0;
  const left = Math.max(0, total - state.time);
  if (total > 0 && left < 60) return s.timeLeft(clockLabel(left));
  return s.minutesLeft(Math.max(1, Math.round(left / 60)));
}

function ringTo(el: Element, fraction: number): void {
  // CSSOM: the stylesheet's offset outranks an SVG attribute.
  const pct = Math.min(100, Math.max(0, fraction * 100));
  (el as SVGElement).style.setProperty('stroke-dashoffset', (100 - pct).toFixed(2));
}

interface View {
  queue: StoryQueue;
  onPage: boolean;
  current: number | null;
  mode: 'idle' | 'playing' | 'loading' | 'paused';
}

function view(state: PlayerState, queue: StoryQueue): View {
  const onPage = sameQueue(queue, state.queue) && state.current !== null && !state.dismissed;
  const mode = !onPage ? 'idle' : state.status === 'playing' ? 'playing' : state.status === 'loading' ? 'loading' : 'paused';
  return { queue, onPage, current: onPage ? state.current : null, mode };
}

// ---- the plate --------------------------------------------------------------

/** What the plate does now: the item it plays and from where, or a toggle. */
function plateAction(state: PlayerState, queue: StoryQueue): { kind: 'toggle' } | { kind: 'next' } | { kind: 'play'; n: number; from: number } {
  const v = view(state, queue);
  if (v.onPage && state.endCard) return { kind: 'next' };
  if (v.onPage) return { kind: 'toggle' };
  const point = state.resume;
  if (point && point.figureId === queue.figureId && point.lang === queue.lang) return { kind: 'play', n: point.n, from: point.t };
  const next = nextUnheard(state, queue);
  if (next !== null) return { kind: 'play', n: next, from: 0 };
  return { kind: 'play', n: queue.entries[0]?.n ?? 1, from: 0 };
}

/** After some were heard and none is half-way: the first story not yet heard. */
function nextUnheard(state: PlayerState, queue: StoryQueue): number | null {
  if (!state.done.some(n => n > 0)) return null;
  return queue.entries.find(e => e.n > 0 && !state.done.includes(e.n))?.n ?? null;
}

function syncPlate(state: PlayerState, queue: StoryQueue): void {
  document.querySelectorAll<HTMLElement>('[data-story-hero-plate]').forEach(plate => {
    const s = playerStrings(queue.lang);
    const v = view(state, queue);
    const doEl = plate.querySelector('[data-story-hero-do]');
    const whatEl = plate.querySelector('[data-story-hero-what]');
    const intro = queue.entries.find(e => e.n === 0);
    const action = plateAction(state, queue);
    let doText: string;
    let whatText: string;
    let offer = false;
    let mode: string = v.mode;
    const card = v.onPage ? state.endCard : null;
    if (card) {
      // the story ended and the next one waits: the plate says what follows, as the dock does
      const next = queue.entries.find(e => e.n === card.next);
      doText = s.continueWith(card.next);
      whatText = next?.title ?? '';
      mode = 'idle';
      plate.dataset.storyN = String(card.next);
    } else if (v.onPage && v.current !== null) {
      const entry = queue.entries.find(e => e.n === v.current);
      doText = v.mode === 'playing' || v.mode === 'loading' ? s.pause : s.resume;
      whatText = [v.current === 0 ? s.introTitle : entry?.title, leftWords(state, queue.lang, entry?.seconds)].filter(Boolean).join(LIST_SEP);
      plate.dataset.storyN = String(v.current);
      ringTo(plate.querySelector('[data-story-ring]') ?? plate, state.duration > 0 ? state.time / state.duration : 0);
    } else if (action.kind === 'play' && action.from > 0) {
      const entry = queue.entries.find(e => e.n === action.n);
      offer = true;
      doText = s.continueStory(action.n);
      whatText = [entry?.title, s.fromTime(clockLabel(action.from))].filter(Boolean).join(LIST_SEP);
      plate.dataset.storyN = String(action.n);
      const total = entry?.seconds ?? 0;
      ringTo(plate.querySelector('[data-story-ring]') ?? plate, total > 0 ? action.from / total : 0);
    } else if (action.kind === 'play' && action.n > 0 && state.done.some(n => n > 0)) {
      const entry = queue.entries.find(e => e.n === action.n);
      offer = true;
      doText = s.continueWith(action.n);
      whatText = [entry?.title, entry?.minutes ? s.minutes(entry.minutes) : ''].filter(Boolean).join(LIST_SEP);
      plate.dataset.storyN = String(action.n);
    } else {
      doText = s.begin;
      whatText = plate.dataset.idleWhat ?? (intro?.minutes ? s.beginSub(intro.minutes) : queue.entries[0]?.title ?? '');
      plate.dataset.storyN = String(queue.entries[0]?.n ?? 0);
    }
    plate.dataset.state = mode;
    plate.dataset.offer = offer ? 'resume' : '';
    plate.setAttribute('aria-pressed', String(mode === 'playing' || mode === 'loading'));
    setText(doEl, doText);
    setText(whatEl, whatText);
    const startOver = plate.parentElement?.querySelector<HTMLElement>('[data-story-startover]');
    if (startOver) startOver.hidden = !offer;
  });
}

// ---- rows, the map, the hear buttons ------------------------------------------

function rowState(state: PlayerState, queue: StoryQueue, n: number): 'current' | 'done' | 'started' | '' {
  const v = view(state, queue);
  // an ended story waiting on the end card is heard, not playing
  if (v.current === n && !state.endCard) return 'current';
  if (state.done.includes(n)) return 'done';
  if (readProgress(queue, n)) return 'started';
  return '';
}

function syncRows(state: PlayerState, queue: StoryQueue, timeOnly: boolean): void {
  const s = playerStrings(queue.lang);
  const v = view(state, queue);
  document.querySelectorAll<HTMLElement>('.sp-row[data-n]').forEach(row => {
    const n = Number(row.dataset.n);
    const entry = queue.entries.find(e => e.n === n);
    if (!entry) return;
    const kind = timeOnly && v.current !== n ? null : rowState(state, queue, n);
    if (kind === null) return;
    row.classList.toggle('is-current', kind === 'current');
    row.classList.toggle('is-done', kind === 'done');
    row.classList.toggle('is-started', kind === 'started');
    const ring = row.querySelector('.sp-row__state [data-story-ring]');
    const progress = kind === 'current' ? (state.duration > 0 ? state.time / state.duration : 0)
      : kind === 'started' ? (readProgress(queue, n)?.t ?? 0) / (entry.seconds || 1) : 0;
    if (ring) ringTo(ring, progress);
    const btn = row.querySelector<HTMLElement>('.sp-row__btn');
    if (btn && !timeOnly) {
      const base = btn.dataset.ariaBase ?? btn.getAttribute('aria-label') ?? '';
      btn.dataset.ariaBase = base;
      const word = kind === 'current' ? (v.mode === 'paused' ? s.pausedWord : s.playingWord)
        : kind === 'done' ? s.finishedWord : kind === 'started' ? s.startedWord : '';
      btn.setAttribute('aria-label', word ? `${base}, ${word}` : base);
    }
    // the unfolded row's main action
    const main = row.querySelector<HTMLElement>('.sp-act--main');
    if (main) {
      const p = kind === 'current' ? null : readProgress(queue, n);
      main.dataset.state = kind === 'current' ? v.mode : 'idle';
      setText(main.querySelector('[data-act-t]'), kind === 'current' ? (v.mode === 'paused' ? s.resume : s.pause) : p ? s.continueFrom : s.listen);
      setText(main.querySelector('[data-act-s]'), kind === 'current' ? leftWords(state, queue.lang, entry.seconds)
        : p ? s.fromTime(clockLabel(p.t)) : entry.minutes ? s.minutes(entry.minutes) : '');
    }
  });
  // the phone map's copy of a row
  const card = document.querySelector<HTMLElement>('[data-story-mapsel]');
  const cardMain = card && !card.hidden ? card.querySelector<HTMLElement>('.sp-act--main') : null;
  const rowMain = cardMain ? document.querySelector<HTMLElement>(`.sp-row[data-n="${cardMain.dataset.storyN}"] .sp-act--main`) : null;
  if (cardMain && rowMain) {
    cardMain.dataset.state = rowMain.dataset.state ?? 'idle';
    setText(cardMain.querySelector('[data-act-t]'), rowMain.querySelector('[data-act-t]')?.textContent ?? '');
    setText(cardMain.querySelector('[data-act-s]'), rowMain.querySelector('[data-act-s]')?.textContent ?? '');
  }
  if (!timeOnly) syncSaved(state, queue);
}

function nextStar(state: PlayerState, queue: StoryQueue): number | null {
  const v = view(state, queue);
  return queue.entries.find(e => e.n !== v.current && !state.done.includes(e.n) && !readProgress(queue, e.n))?.n ?? null;
}

function syncMap(state: PlayerState, queue: StoryQueue, timeOnly: boolean): void {
  const map = document.querySelector<SVGElement>('[data-story-map]');
  if (!map) return;
  const s = playerStrings(queue.lang);
  const v = view(state, queue);
  const next = timeOnly ? null : nextStar(state, queue);
  map.querySelectorAll<SVGGElement>('[data-story-star]').forEach(star => {
    const n = Number(star.dataset.storyStar);
    const entry = queue.entries.find(e => e.n === n);
    if (!entry) return;
    if (timeOnly && v.current !== n) return;
    const kind = rowState(state, queue, n);
    const arc = star.querySelector('[data-star-arc]');
    const progress = kind === 'current' ? (state.duration > 0 ? state.time / state.duration : 0)
      : kind === 'started' ? (readProgress(queue, n)?.t ?? 0) / (entry.seconds || 1) : 0;
    if (arc) ringTo(arc, progress);
    if (timeOnly) return;
    star.classList.toggle('is-current', kind === 'current');
    star.classList.toggle('is-done', kind === 'done' || (kind === 'current' && state.done.includes(n)));
    star.classList.toggle('is-started', kind === 'started');
    star.classList.toggle('is-next', n === next);
    const base = star.dataset.ariaBase ?? star.getAttribute('aria-label') ?? '';
    star.dataset.ariaBase = base;
    const word = kind === 'current' ? s.playingWord : kind === 'done' ? s.finishedWord : kind === 'started' ? s.startedWord : n === next ? s.nextTag : '';
    star.setAttribute('aria-label', word ? `${base}, ${word}` : base);
  });
  if (timeOnly) return;
  // a gold line joins two neighbours heard (or playing)
  const lit = (n: number) => state.done.includes(n) || v.current === n;
  map.querySelectorAll<SVGLineElement>('[data-link]').forEach(line => {
    const [a, b] = (line.dataset.link ?? '').split('-').map(Number);
    line.classList.toggle('is-lit', a !== undefined && b !== undefined && lit(a) && lit(b));
  });
}

function syncHearButtons(state: PlayerState, queue: StoryQueue): void {
  const s = playerStrings(queue.lang);
  const v = view(state, queue);
  document.querySelectorAll<HTMLElement>('.story-play--hear[data-story-play]').forEach(btn => {
    const n = Number(btn.dataset.storyN);
    const text = btn.querySelector<HTMLElement>('[data-story-play-text]');
    if (text && btn.dataset.idleLabel === undefined) btn.dataset.idleLabel = text.textContent ?? '';
    const mode = v.current === n ? v.mode : 'idle';
    btn.dataset.state = mode;
    btn.setAttribute('aria-pressed', String(mode === 'playing' || mode === 'loading'));
    setText(text, mode === 'playing' || mode === 'loading' ? s.pause : mode === 'paused' ? s.resume : btn.dataset.idleLabel ?? '');
  });
}

function syncSaved(state: PlayerState, queue: StoryQueue): void {
  const s = playerStrings(queue.lang);
  document.querySelectorAll<HTMLElement>('[data-story-saved-open]').forEach(btn => {
    btn.hidden = state.saved.length === 0;
    setText(btn.querySelector('[data-saved-count]'), s.savedCount(state.saved.length));
  });
}

let last: { status: string; current: number | null; done: number[]; saved: unknown; resume: unknown; dismissed: boolean; queue: unknown } | null = null;

function sync(): void {
  const queue = readPageQueue();
  if (!queue) return;
  const state = getState();
  const timeOnly = !!last && last.status === state.status && last.current === state.current && last.done === state.done
    && last.saved === state.saved && last.resume === state.resume && last.dismissed === state.dismissed && last.queue === state.queue;
  last = { status: state.status, current: state.current, done: state.done, saved: state.saved, resume: state.resume, dismissed: state.dismissed, queue: state.queue };
  syncPlate(state, queue);
  syncRows(state, queue, timeOnly);
  syncMap(state, queue, timeOnly);
  if (!timeOnly) syncHearButtons(state, queue);
}

// ---- unfolding, the view switch, the map's star ------------------------------

/** A tap's unfolded row (or a star selected on the map) comes into view whole. */
function unfold(n: number, opts: { scroll?: boolean; toggle?: boolean } = {}): void {
  const queue = readPageQueue();
  if (!queue) return;
  document.querySelectorAll<HTMLElement>('.sp-row[data-n]').forEach(row => {
    const rn = Number(row.dataset.n);
    const btn = row.querySelector<HTMLElement>('.sp-row__btn');
    const panel = row.querySelector<HTMLElement>('.sp-row__panel');
    if (!btn || !panel) return;
    const open = rn === n && !(opts.toggle && btn.getAttribute('aria-expanded') === 'true');
    btn.setAttribute('aria-expanded', String(open));
    row.classList.toggle('is-open', open);
    panel.hidden = !open;
    if (open && (opts.scroll || opts.toggle)) keepClear(row);
  });
  sync();
}

/**
 * Scrolls just enough that a block stands whole between the site bar and the resting dock (the screen's foot while
 * no dock is up). A block taller than that space keeps its head under the bar.
 */
function keepClear(el: HTMLElement): void {
  const box = el.getBoundingClientRect();
  const dock = document.querySelector<HTMLElement>('.story-dock');
  const dockBox = dock?.getBoundingClientRect();
  const foot = dockBox && dockBox.height >= 20 ? dockBox.top : window.innerHeight;
  const bar = document.querySelector<HTMLElement>('.pub-navbar');
  const head = bar && getComputedStyle(bar).position !== 'static' ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  const rise = box.top - head - 8;
  const over = box.bottom + 12 - foot;
  // a head under the bar comes down into view; a foot under the dock comes up as far as the head allows
  const by = rise < 0 ? rise : over > 0 ? Math.min(over, rise) : 0;
  if (Math.abs(by) < 1) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({ top: by, behavior: reduce ? 'auto' : 'smooth' });
}

function setView(kind: 'list' | 'map'): void {
  const spread = document.querySelector<HTMLElement>('.sp-spread');
  if (!spread) return;
  spread.dataset.view = kind;
  document.querySelectorAll<HTMLElement>('[data-story-view]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.storyView === kind));
  });
}

function selectStar(n: number): void {
  const queue = readPageQueue();
  if (!queue) return;
  document.querySelectorAll<SVGGElement>('[data-story-star]').forEach(star => {
    star.classList.toggle('is-selected', Number(star.dataset.storyStar) === n);
  });
  if (window.matchMedia(DESKTOP).matches) {
    unfold(n, { scroll: true });
    return;
  }
  // On a phone the map stands in for the list: the star's row opens under it.
  const card = document.querySelector<HTMLElement>('[data-story-mapsel]');
  const row = document.querySelector<HTMLElement>(`.sp-row[data-n="${n}"]`);
  if (!card || !row) return;
  const head = row.querySelector('.sp-row__btn')?.cloneNode(true) as HTMLElement | undefined;
  const acts = row.querySelector('.sp-acts')?.cloneNode(true) as HTMLElement | undefined;
  card.replaceChildren();
  if (head) {
    const title = document.createElement('div');
    title.className = 'sp-mapsel__head';
    title.append(...Array.from(head.querySelectorAll('.sp-row__year, .sp-row__body')).map(x => x.cloneNode(true)));
    card.append(title);
  }
  if (acts) card.append(acts);
  card.hidden = false;
  sync();
  keepClear(card);
}

/** The dock rises under the thumb: the control just pressed, with the whole row or map card around it, moves up out of its way. */
function keepPressedInView(el: HTMLElement): void {
  const block = el.closest<HTMLElement>('.sp-row.is-open, [data-story-mapsel]') ?? el;
  let frames = 0;
  const check = () => {
    const dock = document.querySelector<HTMLElement>('.story-dock');
    if (!dock || dock.getBoundingClientRect().height < 20) {
      if (++frames < 40) requestAnimationFrame(check);
      return;
    }
    keepClear(block);
  };
  requestAnimationFrame(check);
}

// ---- share --------------------------------------------------------------------

export function shareStory(queue: StoryQueue, n: number): void {
  const s = playerStrings(queue.lang);
  const url = `https://agoracosmica.org${queue.lang === 'de' ? '/de' : ''}/figures/${queue.slug}/#story-${n}`;
  const entry = queue.entries.find(e => e.n === n);
  const title = `${queue.name}: ${entry?.title ?? ''}`;
  if (typeof navigator.share === 'function') {
    navigator.share({ title, url }).catch(() => {
      /* the visitor closed the sheet */
    });
    return;
  }
  navigator.clipboard?.writeText(url).then(() => showToast(s.copied), () => showToast(url));
}

// ---- taps -----------------------------------------------------------------------

function onClick(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (!target || target.closest('.story-dock-slot')) return;
  const queue = activeQueue();
  if (!queue) return;
  const state = getState();

  const plate = target.closest<HTMLElement>('[data-story-hero-plate]');
  if (plate) {
    e.preventDefault();
    const dockWasUp = state.current !== null && !state.dismissed;
    const action = plateAction(state, queue);
    if (action.kind === 'next') {
      listenNow();
    } else if (action.kind === 'toggle') {
      if (state.status === 'playing' || state.status === 'loading') pause();
      else play();
    } else {
      playStory(queue, action.n, action.from);
    }
    if (!dockWasUp) keepPressedInView(plate);
    return;
  }
  const playBtn = target.closest<HTMLElement>('[data-story-play]');
  if (playBtn) {
    const n = Number(playBtn.dataset.storyN);
    if (!queue.entries.some(entry => entry.n === n)) return;
    e.preventDefault();
    const dockWasUp = state.current !== null && !state.dismissed;
    if (playBtn.dataset.storyFrom !== undefined) playFrom(queue, n, Number(playBtn.dataset.storyFrom) || 0);
    else playStory(queue, n);
    if (!dockWasUp) keepPressedInView(playBtn);
    return;
  }
  const row = target.closest<HTMLElement>('[data-story-row]');
  if (row) {
    e.preventDefault();
    unfold(Number(row.dataset.storyRow), { toggle: true });
    return;
  }
  const read = target.closest<HTMLElement>('[data-story-read]');
  if (read) {
    e.preventDefault();
    openReader(Number(read.dataset.storyRead));
    return;
  }
  const facts = target.closest<HTMLElement>('[data-story-facts]');
  if (facts) {
    e.preventDefault();
    openSheet('facts', Number(facts.dataset.storyFacts));
    return;
  }
  const share = target.closest<HTMLElement>('[data-story-share]');
  if (share) {
    e.preventDefault();
    shareStory(queue, Number(share.dataset.storyShare));
    return;
  }
  const viewBtn = target.closest<HTMLElement>('[data-story-view]');
  if (viewBtn) {
    e.preventDefault();
    setView(viewBtn.dataset.storyView === 'map' ? 'map' : 'list');
    return;
  }
  const star = target.closest<SVGGElement>('[data-story-star]');
  if (star) {
    e.preventDefault();
    selectStar(Number(star.dataset.storyStar));
    return;
  }
  if (target.closest('[data-story-saved-open]')) {
    e.preventDefault();
    openSheet('saved');
  }
}

/** A star is a link to its row for a page without script; the router claims link clicks in the bubble phase. */
function onStarCapture(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('[data-story-star]')) e.preventDefault();
}

function onKey(e: KeyboardEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if ((e.key === 'Enter' || e.key === ' ') && target?.matches('[data-story-star]')) {
    e.preventDefault();
    selectStar(Number((target as SVGGElement).dataset.storyStar));
  }
}

/** A shared link (#story-5) opens that row. */
function openFromHash(): void {
  const m = /^#(?:story|idea)-(\d{1,2})$/.exec(window.location.hash);
  if (!m) return;
  const n = Number(m[1]);
  if (!document.querySelector(`.sp-row[data-n="${n}"]`)) return;
  setView('list');
  unfold(n);
  const row = document.querySelector<HTMLElement>(`.sp-row[data-n="${n}"]`);
  void document.fonts?.ready.then(() => row?.scrollIntoView({ block: 'start' }));
}

let installed = false;

export function installPage(): void {
  if (installed) return;
  installed = true;
  document.addEventListener('click', onStarCapture, true);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  subscribe(sync);
  document.addEventListener('astro:page-load', () => {
    last = null;
    sync();
    openFromHash();
  });
  sync();
  openFromHash();
}
