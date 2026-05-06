// Content volume stats display
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';

export default function ContentVolume() {
  const { t } = usePublicLang();

  return (
    <div className="pub-volume">
      <span className="pub-volume__item">360 {t('volume.stories')}</span>
      <span className="pub-volume__sep">&middot;</span>
      <span className="pub-volume__item">360 {t('volume.teachings')}</span>
      <span className="pub-volume__sep">&middot;</span>
      <span className="pub-volume__item">110 {t('volume.debates')}</span>
    </div>
  );
}
