// React island: the story dock and its reading view. Mounted once per
// document inside an element the client router persists, so it keeps playing
// while the visitor moves between player pages. The page's own play buttons
// are plain HTML; the controller handles their taps.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  RATES,
  acceptResume,
  declineResume,
  dismiss,
  getState,
  hasNext,
  installPlayer,
  nextStory,
  readPageQueue,
  seekTo,
  setRate,
  setReaderOpen,
  skipBack,
  subscribe,
  togglePlay,
} from '../player/controller';
import StoryReader from '../player/StoryReader';
import { playerStrings, rateLabel } from '../player/strings';
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
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SERVER_STATE: PlayerState = getState();

const Icon = {
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8.2 5.3v13.4c0 .5.5.8.9.5l10.3-6.7a.6.6 0 0 0 0-1L9.1 4.8c-.4-.3-.9 0-.9.5z" /></svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6.6" y="5" width="3.8" height="14" rx="1" /><rect x="13.6" y="5" width="3.8" height="14" rx="1" /></svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6.3 6.6A8.4 8.4 0 1 1 3.6 12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.6 2.6v4.3H2.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12.4" y="15.3" textAnchor="middle" fontSize="8" fontWeight="600" fill="currentColor" stroke="none">15</text>
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M5.8 6.2v11.6c0 .5.5.8.9.5l8.6-5.8a.6.6 0 0 0 0-1L6.7 5.7c-.4-.3-.9 0-.9.5z" /><rect x="16.6" y="5.6" width="2.4" height="12.8" rx="1" /></svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 6.6C9.7 5 6.6 4.7 3.5 5.6v12.8c3.1-.9 6.2-.6 8.5 1M12 6.6c2.3-1.6 5.4-1.9 8.5-1v12.8c-3.1-.9-6.2-.6-8.5 1M12 6.6v12.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
  ),
  backTo: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

/** The figure page a queue belongs to, as a path. */
function figurePath(lang: PlayerLang, slug: string): string {
  return `${lang === 'de' ? '/de' : ''}/figures/${slug}/`;
}

function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

export default function StoryDock({ lang, labels }: Props) {
  const state = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const seekRef = useRef<HTMLInputElement | null>(null);
  const readRef = useRef<HTMLButtonElement | null>(null);
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    installPlayer({ en: labels.en.brief, de: labels.de.brief });
  }, [labels]);

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

  // The page keeps room for the dock's real height: the title and label may wrap.
  const observer = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const root = document.documentElement.style;
    if (!el) {
      root.removeProperty('--story-dock-space');
      return;
    }
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => {
      root.setProperty('--story-dock-space', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    });
    observer.current.observe(el);
  }, []);

  const closeReader = useCallback(() => {
    setReaderOpen(false);
    readRef.current?.focus();
  }, []);

  const storyLang: PlayerLang = state.queue?.lang ?? lang;
  const s = playerStrings(storyLang);
  const label = labels[storyLang];
  const loaded = state.current !== null && !state.dismissed;
  // One offer at a time: where the page's plate offers the kept point, the dock stays down.
  const plateOffers = typeof document !== 'undefined' && document.querySelector('[data-story-hero-plate]') !== null;
  const offer = !loaded && state.resume !== null && !plateOffers;

  if (!loaded && !offer) return <div className="story-dock-slot" />;

  if (offer && state.resume) {
    const point = state.resume;
    const title = readPageQueue()?.entries.find(e => e.n === point.n)?.title ?? s.storyN(point.n);
    const text = point.t > 0 ? s.continueAt(title, fmt(point.t)) : s.continueNext(title);
    return (
      <div className="story-dock-slot">
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
  if (!queue || current === null) return <div className="story-dock-slot" />;
  const entry = queue.entries.find(e => e.n === current);
  const title = entry?.title ?? s.storyN(current);
  const playing = state.status === 'playing' || state.status === 'loading';
  const home = figurePath(queue.lang, queue.slug);
  const away = path !== '' && path !== home;
  const nextRate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length] ?? 1;

  return (
    <div className="story-dock-slot">
      {state.readerOpen && (
        <StoryReader state={state} s={s} label={label} onClose={closeReader} />
      )}
      <div ref={measureRef} className="story-dock" role="region" aria-label={s.dockLabel} data-status={state.status}>
        <div className="story-dock__progress" aria-hidden="true">
          <div ref={fillRef} className="story-dock__fill" />
        </div>
        <div className="story-dock__inner">
          <div className="story-dock__ctrls">
            <button type="button" className="story-btn story-dock__back" onClick={skipBack} aria-label={s.back15Aria}>
              {Icon.back}
            </button>
            <button type="button" className="story-btn story-dock__play" onClick={togglePlay}
              aria-label={playing ? s.pauseAria : s.playAria}>
              {playing ? Icon.pause : Icon.play}
            </button>
            <button type="button" className="story-btn story-dock__next" onClick={nextStory} disabled={!hasNext()}
              aria-label={s.nextAria}>
              {Icon.next}
            </button>
          </div>
          <div className={away ? 'story-dock__text story-dock__text--away' : 'story-dock__text'}>
            {away && (
              <a className="story-dock__home" href={home} aria-label={s.backToAria(queue.name)}>
                {Icon.backTo}
                <span>{queue.name}</span>
              </a>
            )}
            <p className="story-dock__title">
              {!away && <span className="story-dock__who">{`${queue.name} · `}</span>}
              {title}
            </p>
          </div>
          <p className="story-dock__sub">{state.status === 'error' ? s.error : label.brief}</p>
          <div className="story-dock__seek">
            <input
              ref={seekRef}
              type="range"
              min={0}
              max={state.duration > 0 ? Math.floor(state.duration) : 0}
              step={1}
              value={Math.floor(state.time)}
              aria-label={s.seekAria}
              aria-valuetext={`${fmt(state.time)} / ${fmt(state.duration)}`}
              onChange={e => seekTo(Number(e.currentTarget.value))}
            />
          </div>
          {/* The loading word takes the clock's place only on a slow load (CSS delay), never beside a stale time. */}
          <span className="story-dock__time">
            <span className="story-dock__clock" aria-hidden="true">{`${fmt(state.time)} / ${fmt(state.duration)}`}</span>
            <span className="story-dock__wait">{s.loading}</span>
          </span>
          <div className="story-dock__aux">
            <button type="button" className="story-btn story-dock__speed" onClick={() => setRate(nextRate)}
              aria-label={s.speedAria(rateLabel(state.rate, storyLang))}>
              {rateLabel(state.rate, storyLang)}
            </button>
            <button ref={readRef} type="button" className="story-dock__read"
              aria-expanded={state.readerOpen} onClick={() => setReaderOpen(!state.readerOpen)}>
              {Icon.book}
              <span>{s.readAlong}</span>
            </button>
            <button type="button" className="story-btn story-dock__close" onClick={dismiss} aria-label={s.closeAria}>
              {Icon.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
