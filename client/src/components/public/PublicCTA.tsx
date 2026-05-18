// Call-to-action component for public pages
// Sticky bottom bar on mobile, inline block on desktop
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
    ? t('cta.startConversation').replace('{name}', figureName)
    : t('cta.startFree');

  // Fire start_exploring conversion synchronously inside the click. The link
  // is a hard <a href> that triggers a full navigation, so the fetch uses
  // keepalive to survive the page unload. sendConversion is idempotent per
  // tab (sessionStorage flag) and no-ops if no gclid was captured.
  const handleClick = (): void => {
    captureEntryIntent(figureId, lang);
    sendConversion('start_exploring', figureId ? { figureId } : undefined);
  };

  return (
    <div className={`pub-cta pub-cta--${variant} ${className}`}>
      <a href="/" onClick={handleClick} className="pub-cta__button liquid-glass--cosmic">
        {label}
      </a>
    </div>
  );
}
