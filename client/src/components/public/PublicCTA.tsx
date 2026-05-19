// Call-to-action for public pages. Sticky bottom bar: the trust signal above
// one primary action. On figure pages the action is "Learn from Echo of
// {name}"; elsewhere it is the generic "Start exploring".
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';
import { sendConversion } from '../../utils/public/gclidCapture';
import { captureEntryIntent } from '../../utils/public/entryIntent';

interface PublicCTAProps {
  figureName?: string;
  /**
   * Optional figureId for the page this CTA lives on. When provided, gets
   * sent as metadata on the start_exploring conversion event so the dashboard
   * can show "Top Figures by CTA Clicks". Theme pages don't pass this.
   */
  figureId?: string;
  variant?: 'sticky' | 'inline';
  className?: string;
}

export default function PublicCTA({
  figureName,
  figureId,
  variant = 'sticky',
  className = '',
}: PublicCTAProps) {
  const { t, lang } = usePublicLang();

  const label = figureName
    ? t('cta.learnFrom').replace('{name}', figureName)
    : t('cta.startFree');

  // Fire start_exploring synchronously inside the click. The link is a hard
  // <a href> that triggers a full navigation, so the fetch uses keepalive to
  // survive the page unload. sendConversion is idempotent per tab and no-ops
  // if no gclid was captured.
  const handleClick = (): void => {
    captureEntryIntent(figureId, lang);
    sendConversion('start_exploring', figureId ? { figureId } : undefined);
  };

  return (
    <div className={`pub-cta pub-cta--${variant} ${className}`}>
      <div className="pub-cta__inner">
        <p className="pub-cta__trust">{t('cta.trust')}</p>
        <a href="/" onClick={handleClick} className="pub-cta__button">
          {label}
        </a>
      </div>
    </div>
  );
}
