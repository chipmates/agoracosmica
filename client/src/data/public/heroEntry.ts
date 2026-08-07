// Per-figure entry question — the one table behind "what you clicked is what
// you get". The landing hero shows a different first question per figure, so
// the app has to prefill exactly that one, in the visitor's language. The same
// strings are rendered by marketing/src/scripts/agora-hero.js (RAW columns
// 8/9); the two must stay in step.
//
// seedId is the anchor teaching that answers the question. It is never shown
// at entry, only selected as the conversation's seed context so the reply is
// grounded in the right material.

import { getIdeaSeedId } from './figurePageContent';

export interface HeroEntry {
  figureId: string;
  questionEn: string;
  questionDe: string;
  seedId: number;
}

export const heroEntries: HeroEntry[] = [
  {
    figureId: 'laozi',
    questionEn: 'I push and push and nothing moves. What would you do instead?',
    questionDe: 'Ich drücke und drücke, und nichts bewegt sich. Was würdest du tun?',
    seedId: 7,
  },
  {
    figureId: 'angelou',
    questionEn: 'I go quiet where I should speak. How do I get my voice back?',
    questionDe: 'Wo ich reden sollte, werde ich still. Wie finde ich meine Stimme wieder?',
    seedId: 1,
  },
  {
    figureId: 'austen',
    questionEn: 'I never know if people actually like me or are just being polite.',
    questionDe: 'Ich weiß nie, ob Leute mich mögen oder einfach nur höflich sind.',
    seedId: 1,
  },
  {
    figureId: 'aurelius',
    questionEn: 'How do I stop small annoyances from taking my whole day?',
    questionDe: 'Wie halte ich kleine Ärgernisse davon ab, mir den ganzen Tag zu nehmen?',
    seedId: 2,
  },
  {
    figureId: 'beauvoir',
    questionEn: 'How much of what I want is actually mine?',
    questionDe: 'Wie viel von dem, was ich will, ist wirklich meins?',
    seedId: 1,
  },
  {
    figureId: 'bingen',
    questionEn: 'I feel burned out. Does anything grow back after that?',
    questionDe: 'Ich fühle mich ausgebrannt. Wächst danach noch mal etwas?',
    seedId: 1,
  },
  {
    figureId: 'campbell',
    questionEn: 'I am in the middle of a big change. What is this part called?',
    questionDe: 'Ich stecke mitten in einer großen Veränderung. Wie nennt man diesen Teil?',
    seedId: 5,
  },
  {
    figureId: 'zenji',
    questionEn: 'Most of my day is chores. Is that time just lost?',
    questionDe: 'Mein Tag besteht meistens aus Kleinkram. Ist diese Zeit verloren?',
    seedId: 6,
  },
  {
    figureId: 'dickinson',
    questionEn: 'How do I say a hard thing without breaking the person who hears it?',
    questionDe: 'Wie sage ich etwas Schweres, ohne den zu zerbrechen, der es hört?',
    seedId: 6,
  },
  {
    figureId: 'einstein',
    questionEn: 'I used to be curious about everything. When did that stop?',
    questionDe: 'Früher war ich auf alles neugierig. Wann hat das aufgehört?',
    seedId: 1,
  },
  {
    figureId: 'eckhart',
    questionEn: 'I hold on too tight to the people I love. How do I loosen it?',
    questionDe: 'Ich halte die Menschen, die ich liebe, zu fest. Wie lasse ich locker?',
    seedId: 1,
  },
  {
    figureId: 'galilei',
    questionEn: 'Everyone around me is sure. How do I check for myself?',
    questionDe: 'Alle um mich herum sind sich sicher. Wie prüfe ich es selbst?',
    seedId: 8,
  },
  {
    figureId: 'gandhi',
    questionEn: 'How do I argue with someone without needing to win?',
    questionDe: 'Wie streite ich mit jemandem, ohne gewinnen zu müssen?',
    seedId: 10,
  },
  {
    figureId: 'goethe',
    questionEn: 'I read a lot and understand little. What am I doing wrong?',
    questionDe: 'Ich lese viel und verstehe wenig. Was mache ich falsch?',
    seedId: 3,
  },
  {
    figureId: 'gautama',
    questionEn: 'My life is good and I still feel unsatisfied. What is wrong with me?',
    questionDe: 'Mir geht es gut, und trotzdem fehlt etwas. Was stimmt nicht mit mir?',
    seedId: 2,
  },
  {
    figureId: 'jung',
    questionEn: 'Why does one particular person get under my skin so fast?',
    questionDe: 'Warum geht mir ausgerechnet ein Mensch so schnell unter die Haut?',
    seedId: 4,
  },
  {
    figureId: 'kahlo',
    questionEn: 'How do I make something out of pain without pretending it is fine?',
    questionDe: 'Wie mache ich aus Schmerz etwas, ohne so zu tun, als wäre alles gut?',
    seedId: 2,
  },
  {
    figureId: 'king',
    questionEn: 'How do I keep going when nothing I do seems to matter?',
    questionDe: 'Wie mache ich weiter, wenn nichts von dem, was ich tue, etwas ändert?',
    seedId: 11,
  },
  {
    figureId: 'lovelace',
    questionEn: 'They say a machine will do my job. Could it do the part that is mine?',
    questionDe: 'Angeblich macht bald eine Maschine meinen Job. Auch den Teil, der wirklich meiner ist?',
    seedId: 12,
  },
  {
    figureId: 'mandela',
    questionEn: 'Someone took years from me. How do I stop carrying it?',
    questionDe: 'Jemand hat mir Jahre genommen. Wie höre ich auf, das zu tragen?',
    seedId: 3,
  },
  {
    figureId: 'mozart',
    questionEn: 'When did the thing I loved doing turn into work?',
    questionDe: 'Wann ist das, was ich geliebt habe, zu Arbeit geworden?',
    seedId: 3,
  },
  {
    figureId: 'blake',
    questionEn: 'Two parts of me want opposite things. Do I have to give one up?',
    questionDe: 'Zwei Seiten in mir wollen genau das Gegenteil. Muss ich eine aufgeben?',
    seedId: 6,
  },
  {
    figureId: 'nietzsche',
    questionEn: 'Nothing I was handed to believe holds. What now?',
    questionDe: 'Nichts, was man mir zu glauben gab, trägt noch. Was jetzt?',
    seedId: 3,
  },
  {
    figureId: 'plato',
    questionEn: 'How do I know if I actually believe what I say I believe?',
    questionDe: 'Woher weiß ich, ob ich wirklich glaube, was ich zu glauben sage?',
    seedId: 2,
  },
  {
    figureId: 'rumi',
    questionEn: 'I miss something I cannot name. What is it?',
    questionDe: 'Mir fehlt etwas, das ich nicht benennen kann. Was ist es?',
    seedId: 6,
  },
  {
    figureId: 'schopenhauer',
    questionEn: 'Why is the satisfaction always shorter than the wanting?',
    questionDe: 'Warum ist die Zufriedenheit immer kürzer als das Wollen?',
    seedId: 1,
  },
  {
    figureId: 'shakespeare',
    questionEn: 'I saw it clearly only after it was over. What good is that?',
    questionDe: 'Ich habe es erst verstanden, als es vorbei war. Was nützt mir das?',
    seedId: 11,
  },
  {
    figureId: 'woolf',
    questionEn: 'I never get an hour that is really mine. Does that matter?',
    questionDe: 'Ich habe nie eine Stunde, die wirklich mir gehört. Ist das schlimm?',
    seedId: 4,
  },
  {
    figureId: 'tubman',
    questionEn: 'I know what I have to do and I keep not doing it. How do you move?',
    questionDe: 'Ich weiß, was ich tun muss, und tue es doch nicht. Wie kommst du in Bewegung?',
    seedId: 3,
  },
  {
    figureId: 'vinci',
    questionEn: 'I am curious about everything and finish nothing. Is that a flaw?',
    questionDe: 'Ich interessiere mich für alles und bringe nichts zu Ende. Ist das ein Fehler?',
    seedId: 8,
  },
];

// Map lookups run against untrusted URL input, so membership is answered by a
// Set. A plain object would report inherited keys ("constructor") as present.
const byFigure = new Map<string, HeroEntry>(heroEntries.map((e) => [e.figureId, e]));

/** True only for one of the thirty figure ids in the table above. */
export const hasHeroEntry = (figureId: string | null | undefined): boolean =>
  !!figureId && byFigure.has(figureId);

export const getHeroEntry = (figureId: string | null | undefined): HeroEntry | null =>
  (figureId && byFigure.get(figureId)) || null;

/** The figure's entry question in the app's language, or null for unknown ids. */
export const getHeroEntryQuestion = (
  figureId: string | null | undefined,
  lang: string
): string | null => {
  const entry = getHeroEntry(figureId);
  if (!entry) return null;
  return lang === 'de' ? entry.questionDe : entry.questionEn;
};

/** The anchor seed for a figure's entry question, or null for unknown ids. */
export const getHeroEntrySeedId = (figureId: string | null | undefined): number | null =>
  getHeroEntry(figureId)?.seedId ?? null;

// Same shape as entryIntent's ask-tag pattern. Duplicated rather than imported
// because entryIntent reads this table, and the cycle would be worse.
const FIGURE_ASK_TAG = /^f:([a-z]+):([1-3])$/;

/**
 * The anchor seed behind a staged question, by the ask tag that named it.
 * Follows the same figure the question text follows, so text and grounding
 * never come from different tables. Returns null whenever the tag names no
 * teaching we can trust (council handoffs, the figure-less life question,
 * unmapped idea slots): no anchor beats a wrong one.
 */
export const resolveAnchorSeedId = (figureId: string, tag: string): string | null => {
  const match = FIGURE_ASK_TAG.exec(tag);
  if (match) {
    // Slot 2 is the figure page's idea question, slots 1 and 3 the hero one.
    const seedId = match[2] === '2'
      ? getIdeaSeedId(match[1])
      : getHeroEntrySeedId(match[1]);
    return seedId === null ? null : String(seedId);
  }
  if (tag === 'hero') {
    const seedId = getHeroEntrySeedId(figureId);
    return seedId === null ? null : String(seedId);
  }
  return null;
};
