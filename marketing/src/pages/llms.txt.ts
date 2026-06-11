import type { APIRoute } from 'astro';
import { getFiguresCatalog } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import { THEMES } from '@client/data/councilCatalog';
import { getT } from '../i18n';
import { SITE_URL } from '../lib/urls';

// Generated /llms.txt: a small machine-readable map for AI agents (Perplexity
// and Claude confirmed use it; Google does not). Built from the same catalog
// the pages use, so it never drifts. Regenerates on every build with the site.
export const prerender = true;

function firstSentence(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const dot = flat.indexOf('. ');
  const cut = dot > 0 && dot < max ? dot + 1 : Math.min(flat.length, max);
  const s = flat.slice(0, cut).trimEnd();
  return s.length < flat.length && !s.endsWith('.') ? s + '…' : s;
}

export const GET: APIRoute = () => {
  const t = getT('en');
  const figures = getFiguresCatalog('en');
  const lines: string[] = [];

  lines.push('# Agora Cosmica');
  lines.push('');
  lines.push(
    '> Learn from 30 remarkable people across philosophy, science, art, and activism through fact-checked biographies, narrated audio, and AI-voiced conversations. Open source (AGPL-3.0), nonprofit (ChipMates gGmbH), no tracking cookies, no profiling. English and German.',
  );
  lines.push('');
  lines.push(
    'Each figure has a fact-checked biography and core teachings, narrated audio, and an AI "Echo" grounded in their work that you can talk to. Every figure and theme page is free to read with no signup.',
  );
  lines.push('');

  lines.push('## Figures');
  for (const f of figures) {
    const slug = figureIdToSlug[f.id];
    if (!slug) continue;
    lines.push(`- [${f.name}](${SITE_URL}/figures/${slug}/): ${firstSentence(f.about)}`);
  }
  lines.push('');

  lines.push('## Themes');
  for (const th of THEMES) {
    const name = t(`themes.${th.id}.name`);
    const tagline = t(`themes.${th.id}.tagline`);
    lines.push(`- [${name}](${SITE_URL}/themes/${th.id}/): ${tagline}`);
  }
  lines.push('');

  lines.push('## Key pages');
  lines.push(`- [Home](${SITE_URL}/)`);
  lines.push(`- [All figures](${SITE_URL}/figures/)`);
  lines.push(`- [All themes](${SITE_URL}/themes/)`);
  lines.push(`- [About](${SITE_URL}/about/)`);
  lines.push(`- [Why we speak for the dead](${SITE_URL}/echoes/)`);
  lines.push('- [Source code (GitHub)](https://github.com/chipmates/agoracosmica)');
  lines.push('');

  lines.push('## Deutsch');
  lines.push(`Every page has a German mirror under /de/ (e.g. ${SITE_URL}/de/figures/{slug}/).`);
  lines.push(`- [Startseite](${SITE_URL}/de/)`);
  lines.push(`- [Alle Menschen](${SITE_URL}/de/figures/)`);
  lines.push(`- [Alle Themen](${SITE_URL}/de/themes/)`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
