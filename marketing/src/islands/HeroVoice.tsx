// React island: hero voice button for the landing-lab Exchange hero.
//
// Reuses useFigureTrailer exactly like TrailerButton.tsx (same webm/mp3
// probing, tap-to-play inside the gesture for iOS, R2 trailer URL), and
// renders the existing pub-trailer button markup. Additionally owns the
// hero's motion gate: it adds .is-live to the hero root after idle (unless
// the user prefers reduced motion), parks loops via .is-hidden when the tab
// is backgrounded, and mirrors playback onto the card as data-voice so the
// portrait ring can pulse while the figure speaks.
//
// The label stays "Hear his voice", never "hear this answer": the 50s
// trailer is the figure introducing himself, not a reading of the card.

import { useEffect } from 'react';
import { getPublicT } from '@client/utils/public/publicI18n';
import { useFigureTrailer } from '@client/hooks/useFigureTrailer';

interface Props {
  figureId: string;
  lang: 'en' | 'de';
  /** id of the hero root that receives .is-live / .is-hidden */
  rootId: string;
  /** id of the card that receives data-voice="playing" */
  cardId: string;
  /** localized idle label, e.g. "Hear his voice" */
  label: string;
}

export default function HeroVoice({ figureId, lang, rootId, cardId, label }: Props) {
  const trailer = useFigureTrailer();
  const t = getPublicT(lang);
  const status = trailer.activeId === figureId ? trailer.status : 'idle';
  const engaged = status === 'loading' || status === 'playing';

  // Motion gate: .is-live only when the user allows motion, parked when the
  // tab hides. Re-evaluated live if the OS preference changes mid-session.
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyLive = () => root.classList.toggle('is-live', !reduceQuery.matches);
    const onVisibility = () => root.classList.toggle('is-hidden', document.hidden);

    applyLive();
    reduceQuery.addEventListener('change', applyLive);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      reduceQuery.removeEventListener('change', applyLive);
      document.removeEventListener('visibilitychange', onVisibility);
      root.classList.remove('is-live', 'is-hidden');
    };
  }, [rootId]);

  // Mirror playback state onto the card for the speaking pulse.
  useEffect(() => {
    const card = document.getElementById(cardId);
    if (!card) return;
    if (engaged) {
      card.setAttribute('data-voice', 'playing');
    } else {
      card.removeAttribute('data-voice');
    }
    return () => card.removeAttribute('data-voice');
  }, [engaged, cardId]);

  return (
    <button
      type="button"
      className={`pub-trailer ${engaged ? 'pub-trailer--on' : ''}`}
      onClick={() => trailer.toggle(figureId, lang)}
      aria-pressed={engaged}
      aria-label={engaged ? t('figures.pauseIntro') : label}
    >
      <span className="pub-trailer__icon" aria-hidden="true">
        {engaged ? (
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M4 3h3v10H4zM9 3h3v10H9z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M4 3l9 5-9 5z" />
          </svg>
        )}
      </span>
      <span className="pub-trailer__label">
        {engaged ? t('figures.pauseIntro') : label}
      </span>
      {!engaged && <span className="pub-trailer__dur">0:50</span>}
    </button>
  );
}
