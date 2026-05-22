// React island: 50s council preview button on the theme detail page's hero
// debate card. Reuses useCouncilPreview (HTML5 audio, webm with mp3 fallback,
// R2 served). Takes lang as a prop for the same reason as TrailerButton.

import { getPublicT } from '@client/utils/public/publicI18n';
import { useCouncilPreview } from '@client/hooks/useCouncilPreview';

interface Props {
  councilId: string;
  lang: 'en' | 'de';
}

export default function CouncilPreviewButton({ councilId, lang }: Props) {
  const preview = useCouncilPreview();
  const t = getPublicT(lang);
  const status = preview.activeId === councilId ? preview.status : 'idle';
  const engaged = status === 'loading' || status === 'playing';
  const label = engaged
    ? t('themes.pausePreview', 'Pause')
    : t('themes.playPreview', 'Play preview');

  return (
    <button
      type="button"
      className={`pub-trailer ${engaged ? 'pub-trailer--on' : ''}`}
      onClick={() => preview.toggle(councilId, lang)}
      aria-pressed={engaged}
      aria-label={label}
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
      <span className="pub-trailer__label">{label}</span>
      {!engaged && <span className="pub-trailer__dur">0:50</span>}
    </button>
  );
}
