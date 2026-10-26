// React island: the story dock, its full player, the sheets (facts, display,
// saved) and the reading view. Mounted once per document inside an element
// the client router persists, so it keeps playing while the visitor moves
// between player pages. The page's own controls are plain HTML (page.ts).

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  acceptResume,
  declineResume,
  getState,
  hasNext,
  hasPrevious,
  installPlayer,
  listenNow,
  nextStory,
  openReader,
  openSheet,
  previousStory,
  readPageQueue,
  seekTo,
  setAway,
  skipBack,
  skipForward,
  stayHere,
  stepRate,
  subscribe,
  togglePlay,
  closeReader,
  RATE_MAX,
  RATE_MIN,
} from '../player/controller';
import { installPage } from '../player/page';
import StoryReader from '../player/StoryReader';
import Sheets from '../player/sheets';
import { Icon } from '../player/icons';
import { clockLabel, playerStrings, rateLabel } from '../player/strings';
import type { FactWords } from '../player/factWords';
import type { PlayerLang } from '../player/strings';
import type { PlayerState } from '../player/types';

interface Label {
  brief: string;
  expanded: string;
}

interface Props {
  /** The page's language, for the resume offer before any story plays. */
  lang: PlayerLang;
  labels: Record<PlayerLang, Label>;
  facts: Record<PlayerLang, FactWords>;
}

const SERVER_STATE: PlayerState = getState();

/** The figure page a queue belongs to, as a path. */
function figurePath(lang: PlayerLang, slug: string): string {
  return `${lang === 'de' ? '/de' : ''}/figures/${slug}/`;
}

function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

export default function StoryDock({ lang, labels, facts }: Props) {
  const state = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const seekRef = useRef<HTMLInputElement | null>(null);
  const [path, setPath] = useState(currentPath);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    installPlayer({ en: labels.en.brief, de: labels.de.brief });
    installPage();
  }, [labels]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // The dock lives across pages: it learns where it is after each swap.
  useEffect(() => {
    const update = () => setPath(currentPath());
    document.addEventListener('astro:page-load', update);
    return () => document.removeEventListener('astro:page-load', update);
  }, []);

  // CSSOM, not a style attribute: the strict style-src blocks attributes.
  const pct = state.duration > 0 ? Math.min(100, (state.time / state.duration) * 100) : 0;
  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    if (seekRef.current) seekRef.current.style.setProperty('--story-seek', `${pct}%`);
  }, [pct]);

  // The page and the reader keep room for the dock's real height: the title may wrap.
  const observer = useRef<ResizeObserver | null>(null);
  const dockEl = useRef<HTMLDivElement | null>(null);
  const publish = useCallback(() => {
    const el = dockEl.current;
    const root = document.documentElement.style;
    if (!el) {
      root.setProperty('--sp-dock-h', '0px');
      root.removeProperty('--story-dock-space');
      return;
    }
    const h = `${Math.ceil(el.getBoundingClientRect().height)}px`;
    root.setProperty('--story-dock-space', h);
    root.setProperty('--sp-dock-h', h);
  }, []);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    dockEl.current = el;
    publish();
    if (!el || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(publish);
    observer.current.observe(el);
  }, [publish]);
  // The router swaps the root's attributes on a page change and drops the property.
  useEffect(() => {
    document.addEventListener('astro:after-swap', publish);
    return () => document.removeEventListener('astro:after-swap', publish);
  }, [publish]);

  const storyLang: PlayerLang = state.queue?.lang ?? lang;
  const s = playerStrings(storyLang);
  const label = labels[storyLang];
  const loaded = state.current !== null && !state.dismissed;
  // One offer at a time: where the page's plate offers the kept point, the dock stays down.
  const plateOffers = typeof document !== 'undefined' && document.querySelector('[data-story-hero-plate]') !== null;
  const offer = !loaded && state.resume !== null && !plateOffers;
  const readerQueue = state.readerOpen ? readPageQueue() ?? state.queue : null;

  const overlays = (
    <>
      {state.readerOpen && readerQueue && state.readerN !== null && (
        <StoryReader state={state} queue={readerQueue} n={state.readerN} label={labels[readerQueue.lang]}
          factsWord={facts[readerQueue.lang].facts} documentedWord={facts[readerQueue.lang].documented}
          recreatedWord={facts[readerQueue.lang].recreated} />
      )}
      {state.sheet && (
        <Sheets state={state} labels={labels} facts={facts} wide={wide} />
      )}
    </>
  );

  if (!loaded && !offer) {
    return <div className="story-dock-slot">{overlays}</div>;
  }

  if (offer && state.resume) {
    const point = state.resume;
    const title = readPageQueue()?.entries.find(e => e.n === point.n)?.title ?? s.storyN(point.n);
    const text = point.t > 0 ? s.continueAt(title, clockLabel(point.t)) : s.continueNext(title);
    return (
      <div className="story-dock-slot">
        {overlays}
        <div ref={measureRef} className="story-dock story-dock--offer" role="region" aria-label={s.dockLabel}>
          <div className="story-dock__offer">
            <button type="button" className="story-dock__go" onClick={acceptResume}>
              <span className="story-dock__go-disc" aria-hidden="true">{Icon.play}</span>
              <span className="story-dock__go-text">{text}</span>
            </button>
            <button type="button" className="story-dock__no" onClick={declineResume}>{s.notNow}</button>
          </div>
        </div>
      </div>
    );
  }

  const queue = state.queue;
  const current = state.current;
  if (!queue || current === null) return <div className="story-dock-slot">{overlays}</div>;
  const entry = queue.entries.find(e => e.n === current);
  const title = current === 0 ? s.introTitle : entry?.title ?? s.storyN(current);
  const playing = state.status === 'playing' || state.status === 'loading';
  const home = figurePath(queue.lang, queue.slug);
  const away = path !== '' && path !== home;
  const inReader = state.readerOpen && state.readerN === current;
  const card = state.endCard;
  const nextEntry = card ? queue.entries.find(e => e.n === card.next) : undefined;
  const clock = `${clockLabel(state.time)} / ${clockLabel(state.duration)}`;
  const rate = rateLabel(state.rate, storyLang);

  const readSlot = inReader && state.away ? (
    <button type="button" className="story-dock__read story-dock__read--voice" onClick={() => setAway(false)}>
      {Icon.up}
      <span>{s.follow}</span>
    </button>
  ) : (
    <button type="button" className="story-dock__read" aria-pressed={inReader}
      onClick={() => (inReader ? closeReader() : openReader(current))}>
      {Icon.book}
      <span>{s.readAlong}</span>
    </button>
  );

  return (
    <div className="story-dock-slot">
      {overlays}
      <div ref={measureRef} className="story-dock" role="region" aria-label={s.dockLabel} data-status={state.status}>
        {card && nextEntry && (
          <div className="story-dock__end" role="status">
            <span className="story-dock__count" aria-hidden="true">{card.left}</span>
            <div className="story-dock__endtext">
              <p className="story-dock__endk">{card.n === 0 ? s.endedIntro : s.ended(card.n)}</p>
              <p className="story-dock__endt">{s.soon(card.next, nextEntry.title)}</p>
            </div>
            <div className="story-dock__endacts">
              <button type="button" className="story-dock__stay" onClick={stayHere}>{s.stay}</button>
              <button type="button" className="story-dock__now" onClick={listenNow}>{s.listenNow}</button>
            </div>
          </div>
        )}
        <div className="story-dock__progress" aria-hidden="true">
          <div ref={fillRef} className="story-dock__fill" />
        </div>
        <div className="story-dock__inner">
          {away && (
            <a className="story-dock__home" href={home} aria-label={s.backToAria(queue.name)}>
              {Icon.back}
              <span>{queue.name}</span>
            </a>
          )}
          <button type="button" className="story-dock__open" onClick={() => openSheet('player')}
            aria-label={`${s.openPlayer}: ${title}`}>
            <span className="story-dock__title">{title}</span>
            {/* The loading word takes the clock's place only on a slow load (CSS delay), never beside a stale time. */}
            <span className="story-dock__time">
              <span className="story-dock__clock">{clock}</span>
              <span className="story-dock__wait">{s.loading}</span>
              {Icon.up}
            </span>
            <span className="story-dock__sub">{state.status === 'error' ? s.error : label.brief}</span>
          </button>
          <div className="story-dock__ctrls">
            {wide && (
              <button type="button" className="story-btn story-dock__prev" onClick={previousStory} disabled={!hasPrevious() && state.time < 1}
                aria-label={s.prevAria}>{Icon.prev}</button>
            )}
            <button type="button" className="story-btn story-dock__back" onClick={skipBack} aria-label={s.back15Aria}>
              {Icon.back15}
            </button>
            <button type="button" className="story-btn story-dock__play" onClick={togglePlay}
              aria-label={playing ? s.pauseAria : s.playAria}>
              {playing ? Icon.pause : Icon.play}
            </button>
            {wide && (
              <button type="button" className="story-btn story-dock__fwd" onClick={skipForward} aria-label={s.fwd15Aria}>
                {Icon.fwd15}
              </button>
            )}
            <button type="button" className="story-btn story-dock__next" onClick={nextStory} disabled={!hasNext()}
              aria-label={s.nextAria}>
              {Icon.next}
            </button>
            {!wide && (
              <button type="button" className="story-btn story-dock__speed" onClick={() => openSheet('player')}
                aria-label={s.speedAria(rate)}>
                {rate}
              </button>
            )}
            {!wide && readSlot}
          </div>
          {wide && (
            <>
              <div className="story-dock__seek">
                <span className="story-dock__t0">{clockLabel(state.time)}</span>
                <input
                  ref={seekRef}
                  type="range"
                  min={0}
                  max={state.duration > 0 ? Math.floor(state.duration) : 0}
                  step={1}
                  value={Math.floor(state.time)}
                  aria-label={s.seekAria}
                  aria-valuetext={clock}
                  onChange={e => seekTo(Number(e.currentTarget.value))}
                />
                <span className="story-dock__t1">{clockLabel(state.duration)}</span>
              </div>
              <div className="story-dock__rate" role="group" aria-label={s.speed}>
                <button type="button" className="story-btn" onClick={() => stepRate(-1)} disabled={state.rate <= RATE_MIN}
                  aria-label={s.slower}>{Icon.minus}</button>
                <span className="story-dock__rateval" aria-live="polite">{rate}</span>
                <button type="button" className="story-btn" onClick={() => stepRate(1)} disabled={state.rate >= RATE_MAX}
                  aria-label={s.faster}>{Icon.plus}</button>
              </div>
              {readSlot}
              <button type="button" className="story-btn story-dock__handle" onClick={() => openSheet('player')}
                aria-label={s.openPlayer}>{Icon.up}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
