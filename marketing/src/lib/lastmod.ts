import { execSync } from 'node:child_process';

// Build-time "last content modified" date for theme pages. The Article JSON-LD
// dateModified used to be `new Date()`, so it advanced on every deploy even when
// nothing changed and contradicted the git-derived sitemap lastmod. This derives
// the date from git the same way generate-sitemap.mjs themeLastmod() does (git
// log of the theme content + template files), so the two always agree.
//
// Fallback is a fixed date (never today), so if git is somehow unavailable at
// build time the churn still cannot come back.
const FALLBACK = '2026-05-06';

const THEME_FILES = [
  'client/src/assets/translations/public-en.json',
  'client/src/assets/translations/public-de.json',
  'marketing/src/pages/themes/[theme].astro',
  'marketing/src/pages/de/themes/[theme].astro',
  'marketing/src/components/ThemeDetailContent.astro',
];

let cached: string | null = null;

export function themeContentLastmod(): string {
  if (cached) return cached;
  try {
    const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const paths = THEME_FILES.map((f) => `'${f}'`).join(' ');
    const out = execSync(`git -C '${root}' log -1 --format=%cI -- ${paths}`, {
      encoding: 'utf8',
    }).trim();
    cached = out ? out.split('T')[0] : FALLBACK;
  } catch {
    cached = FALLBACK;
  }
  return cached;
}
