import type { APIRoute } from 'astro';
import { getFiguresCatalog } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import { THEMES } from '@client/data/councilCatalog';
import { getT } from '../../i18n';
import { SITE_URL } from '../../lib/urls';

// Deutsche /de/llms.txt: das gleiche maschinenlesbare Verzeichnis für
// KI-Agenten wie die englische Fassung, nur aus dem deutschen Katalog. Wird
// bei jedem Build neu erzeugt, damit es nie vom Inhalt abweicht.
export const prerender = true;

function firstSentence(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const dot = flat.indexOf('. ');
  const cut = dot > 0 && dot < max ? dot + 1 : Math.min(flat.length, max);
  const s = flat.slice(0, cut).trimEnd();
  return s.length < flat.length && !s.endsWith('.') ? s + '…' : s;
}

// Kurze Kontextzeile: Tradition und Lebenszeit, nur die im Katalog
// vorhandenen Teile (manche deutschen Einträge lassen Felder leer).
function context(tradition: string, period: string): string {
  const parts = [tradition, period].map((p) => (p || '').trim()).filter(Boolean);
  return parts.join(', ');
}

// Kernlehren direkt aus den geprüften keyConcepts. Keine neuen Aussagen,
// nur die Namen der zentralen Ideen.
function teachings(concepts: { term: string }[], limit = 3): string {
  return concepts
    .map((c) => (c.term || '').trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(', ');
}

export const GET: APIRoute = () => {
  const t = getT('de');
  const figures = getFiguresCatalog('de');
  const lines: string[] = [];

  lines.push('# Agora Cosmica');
  lines.push('');
  lines.push(
    '> Agora Cosmica ist eine quelloffene, gemeinnützige Lern-App, in der du mit KI-"Echos" von 30 Menschen aus der Geschichte sprichst, quer durch Philosophie, Wissenschaft, Kunst und Aktivismus. Jedes Echo ist im eigenen Werk verankert, mit faktengeprüften Biografien und vertonten Texten. AGPL-3.0, entwickelt von der ChipMates gGmbH. Keine Tracking-Cookies, kein Profiling. Englisch und Deutsch.',
  );
  lines.push('');
  lines.push(
    'Jede Person hat eine faktengeprüfte Biografie und Kernlehren, vertonte Audios und ein KI-"Echo", das in ihrem Werk verankert ist und mit dem du sprechen kannst. Jede Personen- und Themenseite ist ohne Anmeldung frei lesbar.',
  );
  lines.push('');

  lines.push('## Warum das zitierbar ist');
  lines.push(
    'Jede Person ist in ihren eigenen Hauptwerken verankert, also in den Büchern, Briefen und Texten, die sie tatsächlich geschrieben hat.',
  );
  lines.push(
    'Jede Biografie ist faktengeprüft, und die zugrunde liegenden Faktenchecks stehen auf den Personenseiten.',
  );
  lines.push(
    'Die Anweisungsprofile, die jedes Echo verankern, kommen von einem öffentlichen CDN, nicht versteckt in der App.',
  );
  lines.push('Die gesamte App ist quelloffen unter AGPL-3.0, die Methode ist also nachprüfbar.');
  lines.push(
    'Betrieben wird sie von der ChipMates gGmbH, einer deutschen gemeinnützigen Organisation, ohne Tracking-Cookies und ohne Profiling.',
  );
  lines.push('');

  lines.push('## Menschen');
  for (const f of figures) {
    const slug = figureIdToSlug[f.id];
    if (!slug) continue;
    lines.push(`- [${f.name}](${SITE_URL}/de/figures/${slug}/): ${firstSentence(f.about)}`);
    const ctx = context(f.tradition, f.period);
    if (ctx) lines.push(`  - ${ctx}`);
    const teach = teachings(f.keyConcepts);
    if (teach) lines.push(`  - Kernlehren: ${teach}`);
  }
  lines.push('');

  lines.push('## Themen');
  for (const th of THEMES) {
    const name = t(`themes.${th.id}.name`);
    const tagline = t(`themes.${th.id}.tagline`);
    lines.push(`- [${name}](${SITE_URL}/de/themes/${th.id}/): ${tagline}`);
  }
  lines.push('');

  lines.push('## Wichtige Seiten');
  lines.push(`- [Startseite](${SITE_URL}/de/)`);
  lines.push(`- [Alle Menschen](${SITE_URL}/de/figures/)`);
  lines.push(`- [Alle Themen](${SITE_URL}/de/themes/)`);
  lines.push(`- [Über uns](${SITE_URL}/de/about/)`);
  lines.push(`- [Warum wir sie Echos nennen](${SITE_URL}/de/echoes/)`);
  lines.push(`- [Methodik: wie wir die Echos bauen](${SITE_URL}/de/methodik/): wie jedes KI-Echo aus Primärwerken gebaut, belegt und faktengeprüft wird, mit einem öffentlichen Faktencheck pro Mensch und quelloffenem Code.`);
  lines.push(`- [Open-Source-Philosophie-App](${SITE_URL}/de/open-source-philosophy-app/): eine quelloffene, gemeinnützige Alternative zu KI-Charakter-Apps, für Philosophie und Geschichte.`);
  lines.push(`- [Philosophie lernen mit einem KI-Tutor](${SITE_URL}/de/philosophie-lernen/): Philosophie im Gespräch mit den KI-Echos der Philosophen der Geschichte lernen, gemeinnützig und quelloffen, 30 kostenlose Nachrichten pro Tag.`);
  lines.push(`- [Von historischen Persönlichkeiten lernen](${SITE_URL}/de/von-historischen-persoenlichkeiten-lernen/): ein Leitfaden, um zeitlose Weisheit von 30 Menschen der Geschichte zu lernen, keine Tracking-Cookies, 30 kostenlose Nachrichten pro Tag.`);
  lines.push('- [Quellcode (GitHub)](https://github.com/chipmates/agoracosmica)');
  lines.push('');

  lines.push('## English');
  lines.push(`Every page also exists in English (e.g. ${SITE_URL}/figures/{slug}/).`);
  lines.push(`- [English llms.txt](${SITE_URL}/llms.txt)`);
  lines.push(`- [Home](${SITE_URL}/)`);
  lines.push(`- [All figures](${SITE_URL}/figures/)`);
  lines.push(`- [All themes](${SITE_URL}/themes/)`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
