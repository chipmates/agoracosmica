// Shared helpers for /llms.txt, /de/llms.txt and their /llms-full.txt twins.
// Everything here reads the same catalogs the pages render, so the machine
// files cannot drift from the visible content.

import { execSync } from 'node:child_process';
import { figureEntities } from './figureEntities';
import { getFiguresCatalog } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import { getFigureQA } from '@client/data/public/figureQA';
import { THEMES } from '@client/data/councilCatalog';
import publicEn from '@client/assets/translations/public-en.json';
import publicDe from '@client/assets/translations/public-de.json';
import { SITE_URL } from './urls';

// Last time any published content changed, taken from git (the same source the
// sitemap uses) so a rebuild with no content change does not advance the date.
// Fixed fallback, never today, for builds without git.
const LASTMOD_FALLBACK = '2026-05-06';
let cachedLastmod: string | null = null;

export function contentLastmod(): string {
  if (cachedLastmod) return cachedLastmod;
  try {
    const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const out = execSync(`git -C '${root}' log -1 --format=%cI`, { encoding: 'utf8' }).trim();
    cachedLastmod = out ? out.split('T')[0] : LASTMOD_FALLBACK;
  } catch {
    cachedLastmod = LASTMOD_FALLBACK;
  }
  return cachedLastmod;
}

// Verified birth/death years for the entity, or '' when the record is not solid
// enough to state (BCE, legendary, or disputed dates are omitted in
// figureEntities on purpose, and that omission is respected here).
export function figureYears(slug: string, lang: 'en' | 'de'): string {
  const entity = figureEntities[slug];
  if (!entity) return '';
  const born = entity.birthDate?.slice(0, 4).replace(/^0+/, '');
  const died = entity.deathDate?.slice(0, 4).replace(/^0+/, '');
  if (born && died) return `${born}-${died}`;
  if (died) return lang === 'de' ? `gest. ${died}` : `d. ${died}`;
  if (born) return lang === 'de' ? `geb. ${born}` : `b. ${born}`;
  return '';
}

// The llms.txt convention's long half: every figure description and every
// question-and-answer pair in full, plus the eight themes. Generated from the
// same catalogs the pages render, so it cannot drift, and it carries each
// figure's AI disclosure so anything quoting this file quotes that too.
export function buildLlmsFull(lang: 'en' | 'de'): string {
  const isDe = lang === 'de';
  const base = isDe ? `${SITE_URL}/de` : SITE_URL;
  const bundle = (isDe ? publicDe : publicEn) as Record<string, any>;
  const figures = getFiguresCatalog(lang);
  const L = isDe
    ? {
      head: '# Agora Cosmica, Volltext-Verzeichnis',
      intro: 'Diese Datei enthält die vollständige Beschreibung jedes Menschen, alle Frage-Antwort-Paare und die acht Themenfragen. Das kurze Verzeichnis steht unter',
      shortIndex: `${SITE_URL}/de/llms.txt`,
      figuresH: '## Menschen',
      themesH: '## Themen',
      tradition: 'Tradition',
      period: 'Lebenszeit',
      about: 'Beschreibung',
      pageUrl: 'Seite',
    }
    : {
      head: '# Agora Cosmica, full text index',
      intro: 'This file carries the complete description of every figure, all question-and-answer pairs, and the eight theme questions. The short index is at',
      shortIndex: `${SITE_URL}/llms.txt`,
      figuresH: '## Figures',
      themesH: '## Themes',
      tradition: 'Tradition',
      period: 'Period',
      about: 'About',
      pageUrl: 'Page',
    };

  const lines: string[] = [];
  lines.push(L.head);
  lines.push('');
  lines.push(`> ${L.intro} ${L.shortIndex}`);
  lines.push('');
  lines.push(...citationBlock(lang, `${base}/`));

  lines.push(L.figuresH);
  lines.push('');
  for (const f of figures) {
    const slug = figureIdToSlug[f.id];
    if (!slug) continue;
    const years = figureYears(slug, lang);
    lines.push(`### ${f.name}${years ? ` (${years})` : ''}`);
    lines.push(`${L.pageUrl}: ${base}/figures/${slug}/`);
    if (f.tradition) lines.push(`${L.tradition}: ${f.tradition}`);
    if (f.period) lines.push(`${L.period}: ${f.period}`);
    lines.push(`${L.about}: ${f.about.replace(/\s+/g, ' ').trim()}`);
    const qa = getFigureQA(f.id, lang);
    if (qa) {
      for (const pair of [...qa.pairs, qa.disclosure]) {
        lines.push(`Q: ${pair.q}`);
        lines.push(`A: ${pair.a.replace(/\s+/g, ' ').trim()}`);
      }
    }
    lines.push('');
  }

  lines.push(L.themesH);
  lines.push('');
  for (const th of THEMES) {
    const entry = bundle.themes?.[th.id];
    if (!entry) continue;
    lines.push(`### ${entry.name}`);
    lines.push(`${L.pageUrl}: ${base}/themes/${th.id}/`);
    if (entry.question && entry.answer) {
      lines.push(`Q: ${entry.question}`);
      lines.push(`A: ${String(entry.answer).replace(/\s+/g, ' ').trim()}`);
    }
    for (const block of (entry.substance ?? []) as { q: string; a: string }[]) {
      lines.push(`Q: ${block.q}`);
      lines.push(`A: ${block.a.replace(/\s+/g, ' ').trim()}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function citationBlock(lang: 'en' | 'de', url: string): string[] {
  const date = contentLastmod();
  // The field keys stay English in both languages: they are the machine-readable
  // convention, not prose a reader is meant to enjoy.
  void lang;
  return [
    '## Citation',
    `Cite as: Agora Cosmica, ChipMates gemeinnützige GmbH, ${url}`,
    `Last updated: ${date}`,
    '',
  ];
}
