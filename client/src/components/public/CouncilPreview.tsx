// Council preview card for figure and theme pages
// Remove this file when stripping marketing pages from a fork

import type { CatalogCouncil } from '../../data/councilCatalog';
import { getLocalizedTitle, getLocalizedHook } from '../../data/councilCatalog';
import { usePublicLang } from './PublicLangContext';

interface CouncilPreviewProps {
  council: CatalogCouncil;
}

export default function CouncilPreview({ council }: CouncilPreviewProps) {
  const { lang } = usePublicLang();

  const title = getLocalizedTitle(council, lang);
  const hook = getLocalizedHook(council, lang);
  const participants = [council.moderator, ...council.participants]
    .map(p => p.name)
    .join(', ');

  const typeLabel = lang === 'de'
    ? (council.type === 'confrontational' ? 'konfrontativ' : 'reflektiv')
    : council.type;

  return (
    <div className="pub-council">
      <h3 className="pub-council__title">{title}</h3>
      <p className="pub-council__hook">{hook}</p>
      <div className="pub-council__meta">
        <span className="pub-council__type">{typeLabel}</span>
      </div>
      <p className="pub-council__participants">{participants}</p>
    </div>
  );
}
