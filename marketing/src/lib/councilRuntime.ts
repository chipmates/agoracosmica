// Real council runtimes, summed from the shipped level-1 segment manifests.
// Both languages, because the German reads roughly ten percent longer. A
// council whose manifest is missing returns null, and its door then carries no
// duration at all: an invented number would be worse than none.

import type { Lang } from '../i18n';

type Manifest = { segments: { duration?: number }[] };

const manifestModules = {
  en: import.meta.glob<{ default: Manifest }>(
    '../../../client/src/assets/councils/*/level-1/en/manifest-en.json',
    { eager: true },
  ),
  de: import.meta.glob<{ default: Manifest }>(
    '../../../client/src/assets/councils/*/level-1/de/manifest-de.json',
    { eager: true },
  ),
};

export function runtimeMinutes(councilId: string, lang: Lang): number | null {
  const entry = Object.entries(manifestModules[lang]).find(([path]) =>
    path.includes(`/councils/${councilId}/level-1/`),
  );
  if (!entry) return null;
  const total = entry[1].default.segments.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  return total > 0 ? Math.round(total / 60) : null;
}

/** What the debate door promises, with the real runtime when one exists. */
export function hearDebateLabel(minutes: number | null, lang: Lang): string {
  if (lang === 'de') {
    return minutes ? `Debatte anhören. Etwa ${minutes} Minuten.` : 'Debatte anhören';
  }
  return minutes ? `Hear the debate. About ${minutes} minutes.` : 'Hear the debate';
}

/** The same runtime, short enough for a list row. */
export function shortMinutes(minutes: number | null, lang: Lang): string | null {
  if (!minutes) return null;
  return lang === 'de' ? `${minutes} Min.` : `${minutes} min`;
}
