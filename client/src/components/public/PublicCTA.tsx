// Call-to-action for public pages. Sticky bottom bar: the trust signal above
// one primary action. Figure pages say "Learn from Echo of {name}", theme
// pages deep-link to the page's featured council ("Listen to the featured
// debate"), everything else "Start exploring".
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';
import { sendConversion } from '../../utils/public/gclidCapture';
import { captureEntryIntent, captureCouncilIntent } from '../../utils/public/entryIntent';

interface PublicCTAProps {
  figureName?: string;
  /**
   * Optional figureId for the page this CTA lives on. When provided, gets
   * sent as metadata on the start_exploring conversion event so the dashboard
   * can show "Top Figures by CTA Clicks".
   */
  figureId?: string;
  /**
   * Theme pages: id of the featured council to deep-link into. When provided,
   * the CTA label becomes "Listen to the featured debate" and the click writes
   * a council intent that routeAfterOnboarding consumes to open that council.
   */
  councilId?: string;
  variant?: 'sticky' | 'inline';
  /** Theme pages without a featured council: a generic council-flavoured CTA. */
  councilCta?: boolean;
  className?: string;
}

export default function PublicCTA({
  figureName,
  figureId,
  councilId,
  variant = 'sticky',
  councilCta = false,
  className = '',
}: PublicCTAProps) {
  const { t, lang } = usePublicLang();

  const label = councilId
    ? t('cta.listenFeaturedDebate', 'Listen to the featured debate')
    : figureName
      ? t('cta.learnFrom').replace('{name}', figureName)
      : councilCta
        ? t('cta.enterCouncil', 'Enter the Cosmic Council')
        : t('cta.startFree');

  // Fire start_exploring synchronously inside the click. The link is a hard
  // <a href> that triggers a full navigation, so the fetch uses keepalive to
  // survive the page unload. sendConversion is idempotent per tab and no-ops
  // if no gclid was captured.
  const handleClick = (): void => {
    if (councilId) {
      captureCouncilIntent(councilId, lang);
    } else {
      captureEntryIntent(figureId, lang);
    }
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
