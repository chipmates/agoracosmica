// Call-to-action component for public pages
// Sticky bottom bar on mobile, inline block on desktop
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';

interface PublicCTAProps {
  figureName?: string;
  variant?: 'sticky' | 'inline';
  className?: string;
}

export default function PublicCTA({
  figureName,
  variant = 'sticky',
  className = '',
}: PublicCTAProps) {
  const { t } = usePublicLang();

  const label = figureName
    ? t('cta.startConversation').replace('{name}', figureName)
    : t('cta.startFree');

  return (
    <div className={`pub-cta pub-cta--${variant} ${className}`}>
      <a href="/" className="pub-cta__button liquid-glass--cosmic">
        {label}
      </a>
    </div>
  );
}
