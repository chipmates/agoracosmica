// Short figure name for a given language. The catalog's short names are
// English surnames ("Aurelius", "Plato"); where the German catalog name is a
// different name altogether ("Mark Aurel", "Platon") the surname is not part
// of it, and the German page has to use the German name or the button and the
// heading above it disagree.

import { getShortDisplayName } from '@client/data/councilCatalog';
import { getFigureById } from '@client/data/public/figuresCatalog';

export function localizedShortName(figureId: string, lang: 'en' | 'de'): string {
  const short = getShortDisplayName(figureId);
  if (lang === 'en') return short;
  const full = getFigureById(figureId, 'de')?.name;
  if (!full) return short;
  return full.includes(short) ? short : full;
}
