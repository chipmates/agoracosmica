// Authored per-figure content for the public figure detail pages.
//
// Everything the figure template renders comes from data that already exists
// (seeds, stories, factchecks, catalog, councils) EXCEPT three things that have
// to be written by a person: the concept sections whose heading is a real
// search query, the idea question for the three-question block, and the one
// line that says what each primary work actually is. Those three live here.
//
// The template renders a figure's blocks only when that figure has an entry,
// and skips them cleanly when it does not, so this file can be filled one
// figure at a time without touching the components.
//
// Writing bar for every string in this file:
//   - everyday words, short sentences (avg <= 16 words, hard max ~28)
//   - concrete before abstract, second person where it fits
//   - no em/en dashes, no semicolons, no AI filler
//   - German is WRITTEN in German, never translated from the English
//   - every claim traceable to seeds / factchecks / catalog. Never invent a
//     fact, never strengthen one.

import { fragments } from './figureContent/registry';

export interface FigureConceptBlock {
  /** The visible <h2>. A question someone actually typed, never a shelf label. */
  h2: string;
  /** 55 to 150 visible words. Self-contained: no "as mentioned above". */
  body: string;
  /**
   * The seed (1-12) this section is anchored to. When set, the seed's own
   * coreInsights render as the section's bullets and the section links to
   * that chapter. Omit for sections that summarise the whole figure.
   */
  seedId?: number;
}

export interface FigureWork {
  /** Verbatim from figuresCatalog.primaryWorks or the factcheck sources. */
  title: string;
  /** One line on what it is and why it is worth opening. */
  note: string;
}

export interface FigurePageLang {
  /** Concept sections, most-wanted query first. */
  concepts: FigureConceptBlock[];
  /**
   * Q2 of the three-question block: the idea question, in the visitor's
   * voice, anchored to a different seed than the hero question. Max 90 chars.
   */
  ideaQuestion: string;
  /** The primary works, in reading order, each with its one line. */
  works: FigureWork[];
}

export const figurePageContent: Record<string, { en: FigurePageLang; de: FigurePageLang }> = {
  jung: {
    en: {
      concepts: [
        {
          h2: 'What is the shadow?',
          seedId: 4,
          body:
            "The shadow is what Jung called 'the thing a person has no wish to be'. It is everything about you that got pushed out of sight. The traits your family disliked. The wishes you learned to be ashamed of. Even strengths you never let yourself use. Jung did not want you to kill it. He wanted you to know it. What you refuse to look at runs you anyway, and a lot of your unused power is sitting in there.",
        },
      ],
      ideaQuestion: 'The parts of me I keep out of sight, how do I meet them without falling apart?',
      works: [
        {
          title: 'Studies in Word Association (1904-1910)',
          note: 'The stopwatch years. Jung read a word to a patient and timed the pause before the answer, and the long pauses showed him where the sore spots were.',
        },
        {
          title: 'Symbols of Transformation (1912, revised 1952)',
          note: 'Published the year his friendship with Freud began to break. In it he argues that the images in dreams and myths point to more than sex and childhood.',
        },
        {
          title: 'Psychological Types (1921)',
          note: 'Where introversion and extraversion come from. He maps the different ways people take the world in, which is also a map of your own blind spots.',
        },
      ],
    },
    de: {
      concepts: [
        {
          h2: 'Was ist der Schatten bei C.G. Jung?',
          seedId: 4,
          body:
            "Der Schatten ist das, was Jung 'die Sache, die ein Mensch nicht sein will' nannte. Es ist alles an dir, was aus dem Blick geschoben wurde. Eigenschaften, die deine Familie nicht mochte. Wünsche, für die du dich schämen solltest. Sogar Stärken, die du nie benutzt hast. Jung wollte nicht, dass du ihn loswirst. Er wollte, dass du ihn kennst. Was du nicht anschaust, steuert dich trotzdem, und ein großer Teil deiner ungenutzten Kraft steckt genau dort.",
        },
        {
          h2: 'Carl Gustav Jung einfach erklärt',
          body:
            'Jung war Psychiater in Zürich. Er behandelte Menschen, die sich selbst nicht mehr verstanden, und kam dabei zu einem einfachen Schluss: Der größte Teil von dir ist dir nicht bewusst. Vier Begriffe reichen, um ihn zu verstehen. Der Schatten ist das, was du an dir nicht sehen willst. Die Persona ist die Maske, die du im Beruf und unter Leuten trägst. Archetypen sind alte Muster, die in Träumen und Märchen überall auf der Welt auftauchen. Individuation ist der Weg, all diese Teile als deine eigenen anzunehmen. Jung hat das nicht am Schreibtisch erdacht. Er hat es an Patienten gemessen, mit Stoppuhr und Assoziationstest, und erst danach aufgeschrieben.',
        },
      ],
      ideaQuestion: 'Die Teile von mir, die ich wegschiebe, wie begegne ich ihnen, ohne zu zerbrechen?',
      works: [
        {
          title: 'Psychologische Typen (1921)',
          note: 'Hier kommen Introversion und Extraversion her. Jung beschreibt, wie unterschiedlich Menschen die Welt aufnehmen, und wo dabei die blinden Flecken liegen.',
        },
        {
          title: 'Symbole der Wandlung (1912, überarbeitet 1952)',
          note: 'Erschienen in dem Jahr, in dem seine Freundschaft mit Freud zu zerbrechen begann. Er zeigt darin, dass die Bilder in Träumen und Mythen auf mehr deuten als auf Sexualität und Kindheit.',
        },
        {
          title: 'Erinnerungen, Träume, Gedanken (1962)',
          note: 'Sein Rückblick auf das eigene Leben, aufgezeichnet in seinen letzten Jahren. Der persönlichste seiner Texte.',
        },
      ],
    },
  },
};

// The seed whose teaching answers each figure's idea question (ask slot 2).
// The question itself is authored per figure, so the anchor has to be named
// here rather than derived. A figure missing from this table gets no anchor
// for that slot, which is deliberate: a wrong teaching grounds the first reply
// worse than none.
export const ideaSeedIds: Record<string, number> = {
  angelou: 3,
  aurelius: 10,
  austen: 8,
  beauvoir: 9,
  bingen: 4,
  blake: 2,
  campbell: 6,
  dickinson: 10,
  eckhart: 5,
  einstein: 11,
  galilei: 11,
  gandhi: 1,
  gautama: 1,
  goethe: 1,
  jung: 4,
  kahlo: 3,
  king: 2,
  laozi: 5,
  lovelace: 5,
  mandela: 7,
  mozart: 4,
  nietzsche: 11,
  plato: 6,
  rumi: 7,
  schopenhauer: 7,
  shakespeare: 4,
  tubman: 11,
  vinci: 2,
  woolf: 2,
  zenji: 2,
};

/** The idea question's anchor seed, or null when the figure has no clean match. */
export function getIdeaSeedId(figureId: string | null | undefined): number | null {
  if (!figureId) return null;
  return Object.prototype.hasOwnProperty.call(ideaSeedIds, figureId)
    ? ideaSeedIds[figureId]
    : null;
}

export function getFigurePageContent(
  figureId: string | null | undefined,
  lang: string
): FigurePageLang | null {
  if (!figureId) return null;
  const fragment = fragments[figureId]?.page;
  const entry = fragment
    ?? (Object.prototype.hasOwnProperty.call(figurePageContent, figureId)
      ? figurePageContent[figureId]
      : undefined);
  if (!entry) return null;
  return lang === 'de' ? entry.de : entry.en;
}
