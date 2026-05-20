// "Play preview" button for the theme page's hero debate card.
// Reuses useCouncilPreview (HTML5 audio, tap-to-play, webm with mp3 fallback,
// served from R2). 50s clip — matches the figure trailer length, which is the
// minimum that lets a four-voice council exchange land.
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';
import { useCouncilPreview } from '../../hooks/useCouncilPreview';

interface PublicCouncilPreviewButtonProps {
  councilId: string;
}

export default function PublicCouncilPreviewButton({ councilId }: PublicCouncilPreviewButtonProps) {
  const { t, lang } = usePublicLang();
  const preview = useCouncilPreview();
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
