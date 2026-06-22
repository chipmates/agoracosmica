// Q&A for the Emily Dickinson "what are her poems about" capsule on her figure
// page. ONE source feeds BOTH the visible capsule (FigureDetailContent.astro)
// and the FAQPage JSON-LD (figures/[slug].astro + de/), so the structured data
// can never drift from the rendered DOM. Facts are the scholarly consensus on
// her themes (and match the live /poems page grouping); every claim is
// fact-clean and verifiable. No em/en dashes, no semicolons (house style).

export interface QA {
  q: string;
  a: string;
}

export const dickinsonPoemsFaqEn: QA[] = [
  {
    q: "What are Emily Dickinson's poems about?",
    a: "Emily Dickinson wrote nearly 1,800 poems and published almost none in her lifetime. They return to a handful of subjects: death and immortality, the inner self and its privacy, nature watched up close, faith and doubt, hope and despair, the reach of the mind, and love and longing. She takes the big questions and works them in the smallest spaces.",
  },
  {
    q: "Why does Emily Dickinson use so many dashes?",
    a: "Dickinson wrote with dashes in place of ordinary commas and periods, and capitalized nouns inside her lines. The smoothed versions printed after her death removed much of this. Read from her own manuscripts, the dashes and capitals are hers, and they set the pace and the silences of each poem.",
  },
  {
    q: "What is Emily Dickinson's most famous poem?",
    a: "Her best-known poems include 'Because I could not stop for Death' and 'Hope is the thing with feathers'. Both are short and plain-spoken, turning a small image, a carriage ride or a bird, into a large question about death or endurance. That move is the heart of her style.",
  },
];

export const dickinsonPoemsFaqDe: QA[] = [
  {
    q: "Worüber schreibt Emily Dickinson in ihren Gedichten?",
    a: "Emily Dickinson schrieb fast 1.800 Gedichte und veröffentlichte zu Lebzeiten kaum eines. Sie kreisen immer wieder um wenige Themen: Tod und Unsterblichkeit, das innere Selbst und seine Verborgenheit, die genau beobachtete Natur, Glaube und Zweifel, Hoffnung und Verzweiflung, die Weite des Geistes sowie Liebe und Sehnsucht. Sie nimmt die großen Fragen und bearbeitet sie auf kleinstem Raum.",
  },
  {
    q: "Warum verwendet Emily Dickinson so viele Gedankenstriche?",
    a: "Dickinson schrieb mit Gedankenstrichen statt gewöhnlicher Kommas und Punkte und schrieb Substantive mitten in der Zeile groß. Die geglätteten Fassungen, die nach ihrem Tod gedruckt wurden, entfernten vieles davon. Liest man sie aus ihren eigenen Manuskripten, stammen die Striche und die Großschreibung von ihr, und sie geben jedem Gedicht Tempo und Stille.",
  },
  {
    q: "Was ist Emily Dickinsons berühmtestes Gedicht?",
    a: "Zu ihren bekanntesten Gedichten zählen „Because I could not stop for Death“ und „Hope is the thing with feathers“. Beide sind kurz und schlicht und verwandeln ein kleines Bild, eine Kutschfahrt oder einen Vogel, in eine große Frage über Tod oder Beständigkeit. Genau das ist der Kern ihres Stils.",
  },
];
