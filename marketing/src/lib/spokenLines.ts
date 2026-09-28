// Lines an author gave to a character. The theme pages pick quotes from the
// seeds, which credit the author; these get the speaker and the work instead,
// so a character's line never reads as the author's own view. Matched on the
// opening words of the EN or DE seed quote.
import type { Lang } from '../i18n';

interface CharacterLine {
  figureId: string;
  opens: string[];
  speaker: string;
  work: Record<Lang, string>;
}

const PRIDE = { en: 'Pride and Prejudice', de: 'Stolz und Vorurteil' };

const LINES: CharacterLine[] = [
  // Pride and Prejudice, chapter 36
  {
    figureId: 'austen',
    opens: ['Till this moment', 'Bis zu diesem Moment', 'Bis zu diesem Augenblick'],
    speaker: 'Elizabeth Bennet',
    work: PRIDE,
  },
  // Pride and Prejudice, chapter 31
  {
    figureId: 'austen',
    opens: ['There is a stubbornness about me', 'Es gibt eine Hartnäckigkeit in mir', 'Es ist ein Eigensinn in mir'],
    speaker: 'Elizabeth Bennet',
    work: PRIDE,
  },
  // Northanger Abbey, chapter 14; German editions keep the English title
  {
    figureId: 'austen',
    opens: ['The person, be it gentleman or lady', 'Die Person, sei es Herr oder Dame', 'Wer, ob Herr oder Dame'],
    speaker: 'Henry Tilney',
    work: { en: 'Northanger Abbey', de: 'Northanger Abbey' },
  },
  // Hamlet, act 2, scene 2
  {
    figureId: 'shakespeare',
    opens: ['There is nothing either good or bad', 'Es gibt nichts, was entweder gut oder schlecht ist'],
    speaker: 'Hamlet',
    work: { en: 'Hamlet', de: 'Hamlet' },
  },
];

/** The character who speaks a quoted line, and the work, or null for the author's own words. */
export function characterLine(
  figureId: string,
  quote: string,
  lang: Lang,
): { speaker: string; work: string } | null {
  const text = quote.trim().toLowerCase();
  const hit = LINES.find(
    line => line.figureId === figureId && line.opens.some(open => text.startsWith(open.toLowerCase())),
  );
  return hit ? { speaker: hit.speaker, work: hit.work[lang] } : null;
}
