// The interactive library taste for ANY figure detail page. A generalization of
// the homepage lab-library.ts (which pins Marcus Aurelius): resolves the same
// LibMode[] for a given figureId from real per-figure data, so the figure page
// can render the exact same Library island the homepage does. Story and Prism
// carry real audio (verified present for all 30 figures, EN+DE); Wisdom shows a
// real core teaching; Quest and Free Talk describe an app entry; Council appears
// only when this figure is actually in one.
//
// Copy is figure-AGNOSTIC and gender-neutral on purpose (30 figures, mixed
// gender): no "his/her" possessive that would misgender. Per-figure specificity
// comes from the data (seed titles, core teachings), not hand-authored lines.

import { getPublicAudioUrl, getPublicCouncilPreviewUrl } from '@client/utils/public/publicMediaUrl';
import { getFigureById } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import {
  councilCatalog,
  councilsByTheme,
  THEMES,
  getLocalizedTitle,
  getLocalizedQuestion,
} from '@client/data/councilCatalog';
import { getSeedsFor } from '../../lib/seeds';
import { MEDIA_URL, publicUrl } from '../../lib/urls';
import type { LibMode } from './lab-library';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const MEDIA_BASE = isDev ? '' : 'https://media.agoracosmica.org';

// Only one council per theme has a produced 50s preview trailer: the theme's
// "featured" council, which the theme pages hero as the lowest-sortOrder council
// (ThemeDetailContent uses the same councils[0] rule). Deriving the set from that
// invariant keeps Council audio in lockstep with what is actually produced,
// instead of a hand-maintained ID list that silently rots when content changes.
// The other ~47 councils are catalog-only and 404 on their preview URL, so a
// figure whose only councils lack audio gets a link-only Council panel instead
// of a broken player.
const COUNCIL_PREVIEW_IDS = new Set(
  THEMES
    .map(theme => [...(councilsByTheme[theme.id] ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id)
    .filter((id): id is string => Boolean(id)),
);

// Figure-agnostic per-mode display strings (the parts that do not change per
// figure). German reviewed for gender-neutrality: no possessive that assumes a
// gender. Per-figure title/body are filled from data below.
type ModeCopy = {
  tab: string; glyph: string; kicker: string;
  duration?: string; playLabel?: string; scale?: string;
  disclosure?: string; linkLabel: string;
};
const TX: Record<'en' | 'de', Record<string, ModeCopy>> = {
  en: {
    story: { tab: 'Story', glyph: 'Learn by story', kicker: 'A teaching, told as a story', playLabel: 'Play Chapter 1', duration: '~13 min', scale: 'the first of twelve chapters', disclosure: 'Each chapter turns one idea into a scene you move through, read in the Echo voice. An interpretation, not a recording.', linkLabel: 'Hear the whole story' },
    wisdom: { tab: 'Wisdom', glyph: 'Study an idea', kicker: 'One of twelve core teachings', scale: 'one of 360 core teachings', linkLabel: 'Study this together' },
    prism: { tab: 'Prism', glyph: 'Hear a dialogue', kicker: 'A four-voice dialogue between Echoes', duration: 'The opening exchange', playLabel: 'Play the opening', scale: 'one of 360 prism dialogues', disclosure: 'Four AI Echoes in dialogue. Interpretations, not recordings.', linkLabel: 'Hear the full dialogue' },
    quest: { tab: 'Quest', glyph: 'Test yourself', kicker: 'A short Socratic challenge', linkLabel: 'Take the quest' },
    council: { tab: 'Council', glyph: 'Hear a debate', kicker: 'A four-voice debate you sit in on', playLabel: 'Play preview', duration: '0:50', scale: 'one of 110 council debates', disclosure: 'Four AI Echoes, one of them moderating. Interpretations, not recordings.', linkLabel: 'See the debate' },
    freetalk: { tab: 'Free Talk', glyph: 'Ask anything', kicker: 'Open conversation, whenever you want', scale: '30 free messages a day', linkLabel: 'Start talking' },
  },
  de: {
    story: { tab: 'Story', glyph: 'Mit Geschichten lernen', kicker: 'Eine Lehre, als Geschichte erzählt', playLabel: 'Kapitel 1 abspielen', duration: '~13 Min.', scale: 'das erste von zwölf Kapiteln', disclosure: 'Jedes Kapitel macht aus einer Idee eine Szene, durch die du dich bewegst, gelesen in der Echo-Stimme. Eine Deutung, keine Aufnahme.', linkLabel: 'Die ganze Geschichte hören' },
    wisdom: { tab: 'Weisheit', glyph: 'Eine Idee vertiefen', kicker: 'Eine von zwölf Kernlehren', scale: 'eine von 360 Kernlehren', linkLabel: 'Das gemeinsam vertiefen' },
    prism: { tab: 'Prisma', glyph: 'Einen Dialog hören', kicker: 'Ein vierstimmiger Dialog zwischen Echos', duration: 'Der erste Wortwechsel', playLabel: 'Den Anfang abspielen', scale: 'einer von 360 Prisma-Dialogen', disclosure: 'Vier KI-Echos im Dialog. Deutungen, keine Aufnahmen.', linkLabel: 'Den ganzen Dialog hören' },
    quest: { tab: 'Quest', glyph: 'Dich selbst prüfen', kicker: 'Eine kurze sokratische Herausforderung', linkLabel: 'Die Quest starten' },
    council: { tab: 'Council', glyph: 'Eine Debatte hören', kicker: 'Eine vierstimmige Debatte, bei der du zuhörst', playLabel: 'Vorschau abspielen', duration: '0:50', scale: 'eine von 110 Council-Debatten', disclosure: 'Vier KI-Echos, eines davon moderiert. Deutungen, keine Aufnahmen.', linkLabel: 'Die Debatte ansehen' },
    freetalk: { tab: 'Free Talk', glyph: 'Frag alles', kicker: 'Offenes Gespräch, wann immer du willst', scale: '30 kostenlose Nachrichten pro Tag', linkLabel: 'Jetzt loslegen' },
  },
};

// Displayed-text cleanup: seed/teaching prose can carry em/en dashes and
// semicolons (AI markers the writing-style rule forbids on-screen). Same
// transform FigureDetailContent uses, applied here since this copy is surfaced
// verbatim into the panels.
function clean(s: string | undefined): string {
  return (s ?? '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim();
}

// First sentence of a summary, cleaned and capped, as a short taste gloss (the
// seed summary is a paragraph; the panel wants one evocative line).
function gloss(s: string | undefined, cap = 150): string {
  const c = clean(s);
  if (!c) return '';
  const first = c.split(/(?<=[.!?])\s/)[0].trim();
  return first.length > cap ? first.slice(0, cap - 1).trimEnd() + '…' : first;
}

/**
 * The six ways to learn from one figure, resolved for their detail page.
 * Mirrors getLibraryModes() but parameterized by figureId, from real data.
 * Council is included only if this figure is in one (graceful).
 */
export function getFigureLibraryModes(figureId: string, lang: 'en' | 'de'): LibMode[] {
  const figure = getFigureById(figureId, lang);
  const seeds = getSeedsFor(figureId, lang);
  const t = TX[lang];
  const slug = figureIdToSlug[figureId];
  const appHref = `/app?figure=${slug}`;

  const seed0 = seeds[0];
  const storyTitle = clean(seed0?.title);
  const storyBody = gloss(seed0?.coreInsights?.[0] ?? seed0?.summary);

  const concept = figure?.keyConcepts?.[0];
  const conceptTerm = clean(concept?.term);

  const modes: LibMode[] = [
    {
      id: 'story',
      group: 'arc',
      step: lang === 'de' ? 'Kapitel 1' : 'Chapter 1',
      tab: t.story.tab,
      glyph: t.story.glyph,
      kicker: t.story.kicker,
      title: storyTitle,
      body: storyBody,
      audioWebm: getPublicAudioUrl(figureId, lang, 1),
      audioMp3: getPublicAudioUrl(figureId, lang, 1).replace('.webm', '.mp3'),
      duration: t.story.duration,
      tasteSeconds: 75,
      playLabel: t.story.playLabel,
      scale: t.story.scale,
      disclosure: t.story.disclosure,
      linkHref: appHref,
      linkLabel: t.story.linkLabel,
    },
    {
      id: 'wisdom',
      group: 'arc',
      step: lang === 'de' ? 'Kapitel 2' : 'Chapter 2',
      tab: t.wisdom.tab,
      glyph: t.wisdom.glyph,
      kicker: t.wisdom.kicker,
      title: conceptTerm,
      body: gloss(concept?.definition),
      scale: t.wisdom.scale,
      linkHref: appHref,
      linkLabel: t.wisdom.linkLabel,
    },
    {
      id: 'prism',
      group: 'arc',
      step: lang === 'de' ? 'Kapitel 3' : 'Chapter 3',
      tab: t.prism.tab,
      glyph: t.prism.glyph,
      kicker: t.prism.kicker,
      title: storyTitle,
      body: gloss(seed0?.summary),
      audioWebm: `${MEDIA_BASE}/prisms/${figureId}/seed-1/audio/combined-raw-${lang}.webm`,
      audioMp3: `${MEDIA_BASE}/prisms/${figureId}/seed-1/audio/combined-raw-${lang}.mp3`,
      duration: t.prism.duration,
      tasteSeconds: 96,
      playLabel: t.prism.playLabel,
      scale: t.prism.scale,
      disclosure: t.prism.disclosure,
      linkHref: appHref,
      linkLabel: t.prism.linkLabel,
    },
    {
      id: 'quest',
      group: 'arc',
      step: lang === 'de' ? 'Kapitel 4' : 'Chapter 4',
      tab: t.quest.tab,
      glyph: t.quest.glyph,
      kicker: t.quest.kicker,
      title: lang === 'de' ? 'Vier Fragen, immer tiefer' : 'Four questions, going deeper',
      body: lang === 'de'
        ? 'Das Echo stellt dir vier Fragen zu einer Idee, jede tiefer als die vorige. Es zählt, was du verstehst, nicht, was du auswendig aufsagst.'
        : 'The Echo asks you four questions about one idea, each going deeper than the last. It measures what you understand, not what you can recite.',
      linkHref: appHref,
      linkLabel: t.quest.linkLabel,
    },
  ];

  // Council: only if this figure actually appears in one. Prefer a council they
  // are in that HAS a preview trailer (so the panel plays a real taste),
  // preferring one they moderate (they convene it, genuinely "learn from them").
  // Fall back to any council they take part in, rendered link-only rather than
  // with a play button that would 404.
  const inCouncils = councilCatalog.filter(
    c => c.moderator.id === figureId || c.participants.some(p => p.id === figureId),
  );
  const withPreview = inCouncils.filter(c => COUNCIL_PREVIEW_IDS.has(c.id));
  const council =
    withPreview.find(c => c.moderator.id === figureId) ??
    withPreview[0] ??
    inCouncils.find(c => c.moderator.id === figureId) ??
    inCouncils[0];
  if (council) {
    const hasPreview = COUNCIL_PREVIEW_IDS.has(council.id);
    const cast = [council.moderator, ...council.participants]
      .filter(p => p.id !== figureId)
      .slice(0, 3)
      .map(p => ({ name: p.name, src: `${MEDIA_URL}/images/figures/${p.id}/thumbnail/160.webp` }));
    modes.push({
      id: 'council',
      group: 'more',
      tab: t.council.tab,
      glyph: t.council.glyph,
      kicker: t.council.kicker,
      title: getLocalizedTitle(council, lang),
      body: getLocalizedQuestion(council, lang),
      // Audio + its disclosure only when the chosen council is a produced one;
      // otherwise the panel degrades to link-only (like Wisdom / Free Talk).
      ...(hasPreview
        ? {
            audioWebm: getPublicCouncilPreviewUrl(council.id, lang, 'webm'),
            audioMp3: getPublicCouncilPreviewUrl(council.id, lang, 'mp3'),
            duration: t.council.duration,
            playLabel: t.council.playLabel,
            disclosure: t.council.disclosure,
          }
        : {}),
      scale: t.council.scale,
      linkHref: publicUrl(lang, `/themes/${council.theme}`),
      linkLabel: t.council.linkLabel,
      cast,
    });
  }

  modes.push({
    id: 'freetalk',
    group: 'more',
    tab: t.freetalk.tab,
    glyph: t.freetalk.glyph,
    kicker: t.freetalk.kicker,
    title: lang === 'de' ? 'Frag alles' : 'Ask anything',
    body: lang === 'de'
      ? 'Bring deine eigene Frage mit, und das Echo antwortet in seiner Stimme, so lange du willst.'
      : 'Bring your own question, and the Echo answers in that voice, for as long as you like.',
    scale: t.freetalk.scale,
    linkHref: appHref,
    linkLabel: t.freetalk.linkLabel,
  });

  return modes;
}
