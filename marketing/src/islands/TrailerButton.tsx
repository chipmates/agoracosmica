// React island: "Play intro" trailer button on the figure detail page hero.
// Wraps useFigureTrailer (same hook the in-app figure carousel uses), so the
// audio playback semantics, webm/mp3 fallback, and R2 source are identical.
// Takes lang as a prop — no PublicLangContext dependency, because Astro pages
// don't have a React router/context tree.

import { getPublicT } from '@client/utils/public/publicI18n';
import { useFigureTrailer } from '@client/hooks/useFigureTrailer';
import { useHeardSeconds } from '../utils/heardSeconds';

interface Props {
  figureId: string;
  lang: 'en' | 'de';
}

export default function TrailerButton({ figureId, lang }: Props) {
  const trailer = useFigureTrailer();
  const t = getPublicT(lang);
  const status = trailer.activeId === figureId ? trailer.status : 'idle';
  const engaged = status === 'loading' || status === 'playing';

  // Counts toward the shared Listened threshold. The hook exposes no audio
  // element, so the seconds come from wall clock while it reports playing.
  useHeardSeconds(status === 'playing', figureId);

  return (
    <button
      type="button"
      className={`pub-trailer ${engaged ? 'pub-trailer--on' : ''}`}
      onClick={() => trailer.toggle(figureId, lang)}
      aria-pressed={engaged}
      aria-label={engaged ? t('figures.pauseIntro') : t('figures.playIntro')}
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
        {engaged ? t('figures.pauseIntro') : t('figures.playIntro')}
      </span>
      {!engaged && <span className="pub-trailer__dur">0:50</span>}
    </button>
  );
}
