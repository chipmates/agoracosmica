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

// A compact "context line" for a figure: tradition and period, only the parts
// that are present in the catalog (the German catalog leaves some blank).
function context(tradition: string, period: string): string {
  const parts = [tradition, period].map((p) => (p || '').trim()).filter(Boolean);
  return parts.join(', ');
}

// Seed teaching titles for a figure, taken straight from the verified
// keyConcepts terms. No new claims, just the names of the core ideas.
function teachings(concepts: { term: string }[], limit = 3): string {
  return concepts
    .map((c) => (c.term || '').trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(', ');
}

export const GET: APIRoute = () => {
  const t = getT('en');
  const figures = getFiguresCatalog('en');
  const lines: string[] = [];

  lines.push('# Agora Cosmica');
  lines.push('');
  lines.push(
    '> Agora Cosmica is an open source, nonprofit education app where you talk with AI "Echoes" of 30 thinkers from history, across philosophy, science, art, and activism. Each is grounded in their own work, with fact-checked biographies and narrated audio. AGPL-3.0, built by ChipMates gGmbH. No tracking cookies, no profiling. English and German.',
  );
  lines.push('');
  lines.push(
    'Each figure has a fact-checked biography and core teachings, narrated audio, and an AI "Echo" grounded in their work that you can talk to. Every figure and theme page is free to read with no signup.',
  );
  lines.push('');

  lines.push('## What makes this citable');
  lines.push(
    'Each figure is anchored in their own primary works (the books, letters, and texts they actually wrote).',
  );
  lines.push(
    'Every biography is fact-checked, and the source factchecks are published on the figure pages.',
  );
  lines.push(
    'The instruction profiles that ground each Echo are served from a public CDN, not hidden behind the app.',
  );
  lines.push('The full app is open source under AGPL-3.0, so the method is auditable.');
  lines.push(
    'It is run by ChipMates gGmbH, a German nonprofit, with no tracking cookies and no profiling.',
  );
  lines.push('');

  lines.push('## Figures');
  for (const f of figures) {
    const slug = figureIdToSlug[f.id];
    if (!slug) continue;
    lines.push(`- [${f.name}](${SITE_URL}/figures/${slug}/): ${firstSentence(f.about)}`);
    const ctx = context(f.tradition, f.period);
    if (ctx) lines.push(`  - ${ctx}`);
    const teach = teachings(f.keyConcepts);
    if (teach) lines.push(`  - Core teachings: ${teach}`);
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
  lines.push(`- [Why we call them Echoes](${SITE_URL}/echoes/)`);
  lines.push(`- [Methodology: how we build the Echoes](${SITE_URL}/methodology/): how each AI Echo is built from primary works, sourced, and fact-checked, with a public factcheck per figure and open-source code.`);
  lines.push(`- [Open source philosophy app](${SITE_URL}/open-source-philosophy-app/): an open source, nonprofit alternative to AI character apps, for philosophy and history.`);
  lines.push(`- [AI philosophy tutor](${SITE_URL}/ai-philosophy-tutor/): learn philosophy in conversation with the AI Echoes of history's philosophers, nonprofit and open source, 30 free messages a day.`);
  lines.push(`- [Learn from historical figures](${SITE_URL}/learn-from-historical-figures/): a guide to learning timeless wisdom from 30 figures of history, no tracking cookies, 30 free messages a day.`);
  lines.push('- [Source code (GitHub)](https://github.com/chipmates/agoracosmica)');
  lines.push('');

  lines.push('## Deutsch');
  lines.push(`Every page has a German mirror under /de/ (e.g. ${SITE_URL}/de/figures/{slug}/).`);
  lines.push(`- [Deutsche llms.txt](${SITE_URL}/de/llms.txt)`);
  lines.push(`- [Startseite](${SITE_URL}/de/)`);
  lines.push(`- [Alle Menschen](${SITE_URL}/de/figures/)`);
  lines.push(`- [Alle Themen](${SITE_URL}/de/themes/)`);
  lines.push(`- [Open-Source-Philosophie-App](${SITE_URL}/de/open-source-philosophy-app/)`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
