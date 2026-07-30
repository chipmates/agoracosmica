// The figure page's Echo trailer, with an ending.
//
// Same hook and same playback semantics as the plain TrailerButton, plus one
// thing: when the 50 seconds run out on their own, the button hands you the
// next door instead of resetting to "play" as if nothing happened. You just
// heard the voice, so the offer is the twelve chapters that voice reads.
//
// The hook reports 'idle' both for a pause and for a finish, so a click sets a
// flag and a playing-to-idle transition without that flag is a real ending.

import { useEffect, useRef, useState } from 'react';
import { getPublicT } from '@client/utils/public/publicI18n';
import { useFigureTrailer } from '@client/hooks/useFigureTrailer';
import { useHeardSeconds } from '../utils/listenedConversion';

interface Props {
  figureId: string;
  lang: 'en' | 'de';
  /** Where the ending leads: chapter one of this figure's story. */
  chapterHref: string;
}

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
    <path d="M4 3l9 5-9 5z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
    <path d="M4 3h3v10H4zM9 3h3v10H9z" />
  </svg>
);

export default function FigureTrailer({ figureId, lang, chapterHref }: Props) {
  const trailer = useFigureTrailer();
  const t = getPublicT(lang);
  const status = trailer.activeId === figureId ? trailer.status : 'idle';
  const engaged = status === 'loading' || status === 'playing';

  const [ended, setEnded] = useState(false);
  const wasPlaying = useRef(false);
  const clicked = useRef(false);

  useHeardSeconds(status === 'playing', figureId);

  useEffect(() => {
    if (status === 'playing') {
      wasPlaying.current = true;
      return;
    }
    if (status === 'idle' && wasPlaying.current) {
      wasPlaying.current = false;
      if (!clicked.current) setEnded(true);
    }
    clicked.current = false;
  }, [status]);

  if (ended) {
    const label = lang === 'de'
      ? 'Diese Stimme, zwölf Kapitel tief →'
      : 'That voice, twelve chapters deep →';
    return (
      <a
        className="pub-trailer pub-trailer--after"
        href={chapterHref}
        data-agc-cta="start-exploring"
        data-agc-figure={figureId}
        data-agc-door="fig_trailer_end"
      >
        <span className="pub-trailer__label">{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={`pub-trailer ${engaged ? 'pub-trailer--on' : ''}`}
      onClick={() => {
        clicked.current = true;
        trailer.toggle(figureId, lang);
      }}
      aria-pressed={engaged}
      aria-label={engaged ? t('figures.pauseIntro') : t('figures.playIntro')}
    >
      <span className="pub-trailer__icon" aria-hidden="true">
        {engaged ? <PauseIcon /> : <PlayIcon />}
      </span>
      <span className="pub-trailer__label">
        {engaged ? t('figures.pauseIntro') : t('figures.playIntro')}
      </span>
      {!engaged && <span className="pub-trailer__dur">0:50</span>}
    </button>
  );
}
