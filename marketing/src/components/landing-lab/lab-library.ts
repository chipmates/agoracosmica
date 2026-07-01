// The six ways to learn from one figure (Aurelius), resolved server-side and
// passed to the compact Library island. Three modes have real playable audio
// (Story, Prism, Council); Wisdom shows a real core teaching; Quest and Free
// Talk are described with an app entry. Each mode carries its scale ("one of
// 360...") and a cross-reference link, so the showcase reads as an index into
// the library, not a demo. Bilingual: display strings come from TX[lang]
// (German reviewed twice), figure/council titles from the localized catalog.
// Verified assets 2026-07-01. Display copy: human voice, Echo-voice labeling.

import { getPublicAudioUrl, getPublicTrailerUrl, getPublicCouncilPreviewUrl } from '@client/utils/public/publicMediaUrl';
import { getFiguresCatalog } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import {
  councilCatalog,
  heroConfrontational,
  getLocalizedTitle,
  getLocalizedQuestion,
} from '@client/data/councilCatalog';
import { MEDIA_URL, publicUrl } from '../../lib/urls';

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const MEDIA_BASE = isDev ? '' : 'https://media.agoracosmica.org';

export const FEATURED_ID = 'aurelius';

export interface LibMode {
  id: string;
  group: 'arc' | 'more'; // "arc" = the four-step learning arc; "more" = go further
  step?: string;      // arc position marker, e.g. "Chapter 2" (arc modes only)
  tab: string;        // tab label
  glyph: string;      // one-word descriptor under the tab
  kicker: string;     // panel overline
  title: string;
  body: string;       // opening line or short description
  audioWebm?: string;
  audioMp3?: string;
  duration?: string;
  tasteSeconds?: number;
  playLabel?: string;
  scale?: string;     // "one of 360 stories"
  disclosure?: string;
  linkHref: string;
  linkLabel: string;
  cast?: { name: string; src: string }[];
}

// Per-language display strings. German reviewed by two independent passes
// (naturalness + brand/correctness). "Mark Aurel" with k; Echo-voice labeling.
type ModeText = {
  step?: string; tab: string; glyph: string; kicker: string;
  title?: string; body?: string; duration?: string; playLabel?: string;
  scale?: string; disclosure?: string; linkLabel: string;
};
const TX: Record<'en' | 'de', Record<string, ModeText>> = {
  en: {
    story: { step: 'Chapter 1', tab: 'Story', glyph: 'Learn by story', kicker: 'A teaching, told as a story', title: 'The Stoic Path', body: 'The cypress trees were better than the painting.', playLabel: 'Play Chapter 1', scale: 'the first of twelve chapters', disclosure: "Each chapter turns one of his ideas into a scene you move through. Read in his Echo's voice. An interpretation, not a recording.", linkLabel: 'Open his full page' },
    wisdom: { step: 'Chapter 2', tab: 'Wisdom', glyph: 'Study an idea', kicker: 'One of his twelve core teachings', title: 'Preferred Indifferents', body: 'Health, family, success, worth wanting and worth working for. And still not what decides whether you live well.', scale: 'one of 360 core teachings', linkLabel: 'Study this with him' },
    prism: { step: 'Chapter 3', tab: 'Prism', glyph: 'Hear a dialogue', kicker: 'A four-voice dialogue between Echoes', title: 'The Stoic Path', body: 'During the plague years along the Danube, I watched men die faster than we could burn the dead.', duration: 'The opening exchange', playLabel: 'Play the opening', scale: 'one of 360 prism dialogues', disclosure: 'Four AI Echoes in dialogue. Interpretations, not recordings.', linkLabel: 'Hear the full dialogue' },
    quest: { step: 'Chapter 4', tab: 'Quest', glyph: 'Test yourself', kicker: 'A short Socratic challenge', title: 'Four questions, going deeper', body: 'His Echo asks you four questions about one of his ideas, each going deeper than the last. It measures what you understand, not what you can recite.', linkLabel: 'Take the quest' },
    council: { tab: 'Council', glyph: 'Hear a debate', kicker: 'A four-voice debate you sit in on', playLabel: 'Play preview', scale: 'one of 110 council debates', disclosure: 'Four AI Echoes, one of them moderating. Interpretations, not recordings.', linkLabel: 'See the debate' },
    freetalk: { tab: 'Free Talk', glyph: 'Ask anything', kicker: 'Open conversation, whenever you want', title: 'Ask him anything', body: "The exchange at the top of this page is Free Talk. Bring your own question and he answers in his Echo's voice.", scale: '30 free messages a day', linkLabel: 'Start talking' },
  },
  de: {
    story: { step: 'Kapitel 1', tab: 'Story', glyph: 'Mit Geschichten lernen', kicker: 'Eine Lehre, als Geschichte erzählt', title: 'Der stoische Weg', body: 'Die Zypressen waren besser als das Gemälde.', playLabel: 'Kapitel 1 abspielen', scale: 'das erste von zwölf Kapiteln', disclosure: 'Jedes Kapitel macht aus einer seiner Ideen eine Szene, durch die du dich bewegst. Gelesen in seiner Echo-Stimme. Eine Deutung, keine Aufnahme.', linkLabel: 'Seine ganze Seite öffnen' },
    wisdom: { step: 'Kapitel 2', tab: 'Weisheit', glyph: 'Eine Idee vertiefen', kicker: 'Eine seiner zwölf Kernlehren', title: 'Bevorzugte Indifferente', body: 'Gesundheit, Familie, Erfolg. Erstrebenswert und die Mühe wert. Und trotzdem nicht das, was entscheidet, ob du gut lebst.', scale: 'eine von 360 Kernlehren', linkLabel: 'Das mit ihm vertiefen' },
    prism: { step: 'Kapitel 3', tab: 'Prisma', glyph: 'Einen Dialog hören', kicker: 'Ein vierstimmiger Dialog zwischen Echos', title: 'Der stoische Weg', body: 'Während der Pestjahre an der Donau sah ich Männer schneller sterben, als wir die Toten verbrennen konnten.', duration: 'Der erste Wortwechsel', playLabel: 'Den Anfang abspielen', scale: 'einer von 360 Prisma-Dialogen', disclosure: 'Vier KI-Echos im Dialog. Deutungen, keine Aufnahmen.', linkLabel: 'Den ganzen Dialog hören' },
    quest: { step: 'Kapitel 4', tab: 'Quest', glyph: 'Dich selbst prüfen', kicker: 'Eine kurze sokratische Herausforderung', title: 'Vier Fragen, immer tiefer', body: 'Sein Echo stellt dir vier Fragen zu einer seiner Ideen, jede tiefer als die vorige. Es zählt, was du verstehst, nicht, was du auswendig aufsagen kannst.', linkLabel: 'Die Quest starten' },
    council: { tab: 'Council', glyph: 'Eine Debatte hören', kicker: 'Eine vierstimmige Debatte, bei der du zuhörst', playLabel: 'Vorschau abspielen', scale: 'eine von 110 Council-Debatten', disclosure: 'Vier KI-Echos, eines davon moderiert. Deutungen, keine Aufnahmen.', linkLabel: 'Die Debatte ansehen' },
    freetalk: { tab: 'Free Talk', glyph: 'Frag alles', kicker: 'Offenes Gespräch, wann immer du willst', title: 'Frag ihn alles', body: 'Das Gespräch oben auf dieser Seite ist Free Talk. Bring deine eigene Frage mit, und er antwortet in seiner Echo-Stimme.', scale: '30 kostenlose Nachrichten pro Tag', linkLabel: 'Jetzt loslegen' },
  },
};

export function getLibraryModes(lang: 'en' | 'de'): LibMode[] {
  const figures = getFiguresCatalog(lang);
  const featured = figures.find(f => f.id === FEATURED_ID);
  const figureHref = publicUrl(lang, `/figures/${figureIdToSlug[FEATURED_ID]}`);
  const t = TX[lang];
  // Wisdom shows a different teaching than the hero (the hero Q&A is already
  // "Examination of Impressions" = keyConcepts[0]). keyConcepts[2] is "Preferred
  // Indifferents", distinct from both the hero and the Story chapter.
  const wisdomConcept = featured?.keyConcepts?.[2];

  // A council Aurelius himself moderates, so Council is genuinely "learn from
  // him": he convenes it, on his own restless-mind theme. Cast shown = his three
  // co-debaters (his portrait already leads the panel), so nobody is doubled.
  const council =
    councilCatalog.find(c => c.id === 'the-mind-that-wont-be-quiet') ?? heroConfrontational;
  const councilCast = [council.moderator, ...council.participants]
    .filter(p => p.id !== FEATURED_ID)
    .slice(0, 3)
    .map(p => ({
      name: p.name,
      src: `${MEDIA_URL}/images/figures/${p.id}/thumbnail/160.webp`,
    }));

  return [
    // ── The learning arc: story → wisdom → prism → quest ──────────────────
    {
      id: 'story',
      group: 'arc',
      step: t.story.step,
      tab: t.story.tab,
      glyph: t.story.glyph,
      kicker: t.story.kicker,
      title: t.story.title!,
      body: t.story.body!,
      audioWebm: getPublicAudioUrl(FEATURED_ID, lang, 1),
      audioMp3: getPublicAudioUrl(FEATURED_ID, lang, 1).replace('.webm', '.mp3'),
      duration: '13:54',
      tasteSeconds: 75,
      playLabel: t.story.playLabel,
      scale: t.story.scale,
      disclosure: t.story.disclosure,
      linkHref: figureHref,
      linkLabel: t.story.linkLabel,
    },
    {
      id: 'wisdom',
      group: 'arc',
      step: t.wisdom.step,
      tab: t.wisdom.tab,
      glyph: t.wisdom.glyph,
      kicker: t.wisdom.kicker,
      title: wisdomConcept ? wisdomConcept.term : t.wisdom.title!,
      body: t.wisdom.body!,
      scale: t.wisdom.scale,
      linkHref: '/app',
      linkLabel: t.wisdom.linkLabel,
    },
    {
      id: 'prism',
      group: 'arc',
      step: t.prism.step,
      tab: t.prism.tab,
      glyph: t.prism.glyph,
      kicker: t.prism.kicker,
      title: t.prism.title!,
      body: t.prism.body!,
      // The four voices in this dialogue (Marcus opens, Plato answers, then
      // Campbell and Tubman). Shown so the panel reads as a dialogue at a glance.
      cast: [
        { name: 'Plato', src: `${MEDIA_URL}/images/figures/plato/thumbnail/160.webp` },
        { name: 'Joseph Campbell', src: `${MEDIA_URL}/images/figures/campbell/thumbnail/160.webp` },
        { name: 'Harriet Tubman', src: `${MEDIA_URL}/images/figures/tubman/thumbnail/160.webp` },
      ],
      audioWebm: `${MEDIA_BASE}/prisms/${FEATURED_ID}/seed-1/audio/combined-raw-${lang}.webm`,
      audioMp3: `${MEDIA_BASE}/prisms/${FEATURED_ID}/seed-1/audio/combined-raw-${lang}.mp3`,
      duration: t.prism.duration,
      // Marcus's opening turn ends ~73s; extend past the handoff so the sample
      // actually hands to Plato's reply and you hear a second voice.
      tasteSeconds: 96,
      playLabel: t.prism.playLabel,
      scale: t.prism.scale,
      disclosure: t.prism.disclosure,
      linkHref: '/app',
      linkLabel: t.prism.linkLabel,
    },
    {
      id: 'quest',
      group: 'arc',
      step: t.quest.step,
      tab: t.quest.tab,
      glyph: t.quest.glyph,
      kicker: t.quest.kicker,
      title: t.quest.title!,
      body: t.quest.body!,
      linkHref: '/app',
      linkLabel: t.quest.linkLabel,
    },
    // ── Go further: council + free talk ───────────────────────────────────
    {
      id: 'council',
      group: 'more',
      tab: t.council.tab,
      glyph: t.council.glyph,
      kicker: t.council.kicker,
      title: getLocalizedTitle(council, lang),
      body: getLocalizedQuestion(council, lang),
      audioWebm: getPublicCouncilPreviewUrl(council.id, lang, 'webm'),
      audioMp3: getPublicCouncilPreviewUrl(council.id, lang, 'mp3'),
      duration: '0:50',
      playLabel: t.council.playLabel,
      scale: t.council.scale,
      disclosure: t.council.disclosure,
      linkHref: publicUrl(lang, `/themes/${council.theme}`),
      linkLabel: t.council.linkLabel,
      cast: councilCast,
    },
    {
      id: 'freetalk',
      group: 'more',
      tab: t.freetalk.tab,
      glyph: t.freetalk.glyph,
      kicker: t.freetalk.kicker,
      title: t.freetalk.title!,
      body: t.freetalk.body!,
      scale: t.freetalk.scale,
      linkHref: '/app',
      linkLabel: t.freetalk.linkLabel,
    },
  ];
}
