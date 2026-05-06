// Breadcrumb navigation for public pages
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl, canonicalUrl } from '../../utils/public/publicSeo';
import JsonLd, { breadcrumbSchema } from './JsonLd';

export interface BreadcrumbItem {
  label: string;
  path?: string; // omit for current page (last item)
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { lang, t } = usePublicLang();

  const allItems = [
    { label: t('breadcrumbs.home'), path: '/' },
    ...items,
  ];

  const schemaItems = allItems
    .filter(item => item.path)
    .map(item => ({
      name: item.label,
      url: canonicalUrl(publicUrl(lang, item.path!)),
    }));

  return (
    <>
      <JsonLd data={breadcrumbSchema(schemaItems)} />
      <nav aria-label="Breadcrumb" className="pub-breadcrumbs">
        <ol>
          {allItems.map((item, i) => (
            <li key={i}>
              {i > 0 && <span className="pub-breadcrumbs__sep" aria-hidden="true">/</span>}
              {item.path ? (
                <Link to={publicUrl(lang, item.path)}>{item.label}</Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
