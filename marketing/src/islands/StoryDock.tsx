// React island: the story dock and its reading view. Mounted once per
// document inside an element the client router persists, so it keeps playing
// while the visitor moves between player pages. The page's own play buttons
// are plain HTML; the controller handles their taps.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  acceptResume,
  declineResume,
  dismiss,
  getState,
  hasNext,
  installPlayer,
  nextStory,
  setReaderOpen,
  skipBack,
  subscribe,
  togglePlay,
} from '../player/controller';
import StoryReader from '../player/StoryReader';
import { playerStrings } from '../player/strings';
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
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 2.5l10 5.5-10 5.5z" /></svg>
  ),
  pause: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></svg>
  ),
  back: (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 10a6 6 0 1 0 2-4.5" /><path d="M4 3v3h3" />
      <text x="10" y="13" textAnchor="middle" fontSize="6.5" fill="currentColor" stroke="none">15</text>
    </svg>
  ),
  next: (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 2.5l8 5.5-8 5.5zM12 2.5h2v11h-2z" /></svg>
  ),
  close: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
  ),
};

export default function StoryDock({ lang, labels }: Props) {
  const state = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const readRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    installPlayer({ en: labels.en.brief, de: labels.de.brief });
  }, [labels]);

  // CSSOM, not a style attribute: the strict style-src blocks attributes.
  const pct = state.duration > 0 ? Math.min(100, (state.time / state.duration) * 100) : 0;
  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
  }, [pct]);

  const closeReader = useCallback(() => {
    setReaderOpen(false);
    readRef.current?.focus();
  }, []);

  const storyLang: PlayerLang = state.queue?.lang ?? lang;
  const s = playerStrings(storyLang);
  const label = labels[storyLang];
  const loaded = state.current !== null && !state.dismissed;
  const offer = !loaded && state.resume !== null;

  if (!loaded && !offer) return <div className="story-dock-slot" />;

  if (offer && state.resume) {
    const point = state.resume;
    const text = point.t > 0 ? s.continueAt(point.n, fmt(point.t)) : s.continueNext(point.n);
    return (
      <div className="story-dock-slot">
        <div className="story-dock story-dock--offer" role="region" aria-label={s.dockLabel}>
          <div className="story-dock__inner">
            <button type="button" className="story-btn story-btn--wide" onClick={acceptResume}>
              {Icon.play}
              <span>{text}</span>
            </button>
            <button type="button" className="story-btn story-btn--text" onClick={declineResume}>{s.notNow}</button>
          </div>
        </div>
      </div>
    );
  }

  const queue = state.queue;
  const current = state.current;
  if (!queue || current === null) return <div className="story-dock-slot" />;
  const entry = queue.entries.find(e => e.n === current);
  const title = entry ? `${s.storyN(current)}: ${entry.title}` : s.storyN(current);
  const playing = state.status === 'playing' || state.status === 'loading';

  return (
    <div className="story-dock-slot">
      {state.readerOpen && (
        <StoryReader state={state} s={s} label={label} note={s.retellingNote} onClose={closeReader} />
      )}
      <div className="story-dock" role="region" aria-label={s.dockLabel} data-status={state.status}>
        <div className="story-dock__progress" aria-hidden="true">
          <div ref={fillRef} className="story-dock__fill" />
        </div>
        <div className="story-dock__inner">
          <button type="button" className="story-btn story-dock__play" onClick={togglePlay}
            aria-label={playing ? s.pauseAria : s.playAria}>
            {playing ? Icon.pause : Icon.play}
          </button>
          <button type="button" className="story-btn story-dock__back" onClick={skipBack} aria-label={s.back15Aria}>
            {Icon.back}
          </button>
          <div className="story-dock__text">
            <p className="story-dock__title">{`${queue.name} · ${title}`}</p>
            <p className="story-dock__sub">
              {state.status === 'error' ? s.error : label.brief}
            </p>
          </div>
          <span className="story-dock__time" aria-hidden="true">{`${fmt(state.time)} / ${fmt(state.duration)}`}</span>
          <button type="button" className="story-btn story-dock__next" onClick={nextStory} disabled={!hasNext()}
            aria-label={s.nextAria}>
            {Icon.next}
          </button>
          <button ref={readRef} type="button" className="story-btn story-btn--text story-dock__read"
            aria-expanded={state.readerOpen} onClick={() => setReaderOpen(!state.readerOpen)}>
            {s.readAlong}
          </button>
          <button type="button" className="story-btn story-dock__close" onClick={dismiss} aria-label={s.closeAria}>
            {Icon.close}
          </button>
        </div>
      </div>
    </div>
  );
}
