// The quotes on the theme pages, from the hand-kept list in
// data/quotes/themes.json. Nothing else can put a quote on a page, and an
// entry that fails a check below stops the build.
import list from '../data/quotes/themes.json';
import { QUOTE_CAP, shownQuotes } from '../data/quotes/themeQuotes.mjs';
import { characterLine } from './spokenLines';
import type { Lang } from '../i18n';
import { THEMES } from '@client/data/councilCatalog';
import { getFigureById } from '@client/data/public/figuresCatalog';

export interface QuoteSource {
  /** Who wrote or said the words. The page prints the site's own name for the figure. */
  author: string;
  /** The work the words stand in, where there is one. */
  work?: string;
  /** Where in the work: book and section, chapter, act and scene, plate. */
  place?: string;
  /** Whose translation the text is, or the mark for one of our own. */
  translator?: string;
  /** Year of the work or of the edition quoted. */
  year?: string;
  /** The source line as printed: after the name, or after the work's title
   *  for a line a character speaks. A title between underscores is set in
   *  italics. */
  line: string;
}

export interface ThemeQuote {
  id: string;
  lang: Lang;
  /** Figure id, as in the figure catalog. */
  figure: string;
  /** Theme pages the quote may stand on. */
  themes: string[];
  /** The words as the source has them. A line break is a verse break. */
  text: string;
  source: QuoteSource;
  /** Why the text may be shown. */
  rights: string;
  /** The public text the wording was compared with. */
  checked?: string;
  /** The character who speaks the line, for a line from a play or a novel. */
  speaker?: string;
  /** Raises the length limit for this entry alone. */
  cap?: number;
}

// Two estates whose prose is still in copyright never appear here.
const RIGHTS_EXCLUDED = new Set(['angelou', 'king']);
const THEME_IDS = new Set<string>(THEMES.map(theme => theme.id));

function check(quotes: ThemeQuote[]): ThemeQuote[] {
  const seen = new Set<string>();
  for (const q of quotes) {
    const fail = (why: string): never => {
      throw new Error(`themes.json, quote "${q.id}": ${why}`);
    };
    if (!q.id || seen.has(q.id)) fail('the id is missing or used twice');
    seen.add(q.id);
    if (q.lang !== 'en' && q.lang !== 'de') fail('lang must be en or de');
    if (RIGHTS_EXCLUDED.has(q.figure)) fail('this figure is never quoted on a theme page');
    if (!getFigureById(q.figure, q.lang)) fail(`unknown figure "${q.figure}"`);
    if (!q.themes?.length || q.themes.some(id => !THEME_IDS.has(id))) fail('themes must name theme pages');
    const text = q.text?.trim() ?? '';
    if (!text || text !== q.text) fail('the text is empty or has loose whitespace');
    if (text.length > (q.cap ?? QUOTE_CAP)) fail(`the text has ${text.length} characters, over its limit`);
    if (text.startsWith('[') || /(\.\.\.|…)$/.test(text)) fail('the text is a fragment or a paraphrase');
    if (!q.source?.author?.trim() || !q.source?.line?.trim()) fail('the source needs an author and a line');
    if (/[—–]/.test(q.source.line)) fail('the source line carries a dash');
    const printed = q.source.line.replaceAll('_', '');
    for (const part of [q.source.place, q.source.translator]) {
      if (part && !printed.includes(part)) fail(`the source line does not print "${part}"`);
    }
    if (!q.rights?.trim()) fail('the rights note is missing');
    const spoken = characterLine(q.figure, q.text, q.lang);
    if ((spoken?.speaker ?? '') !== (q.speaker ?? '')) fail('the speaker does not match spokenLines.ts');
    if (spoken && spoken.work !== q.source.work) fail('the work does not match spokenLines.ts');
    if (!spoken && q.source.work && !printed.includes(q.source.work)) {
      fail('the source line does not print the work');
    }
  }
  return quotes;
}

const QUOTES = check(list.quotes as ThemeQuote[]);

/** The source line in runs, the titles between underscores marked. */
const lineRuns = (line: string) =>
  line.split('_').map((text, i) => ({ text, title: i % 2 === 1 })).filter(run => run.text);

/** The quotes one theme page draws, each with its speaker credit where a character speaks it. */
export function themeQuotes(themeId: string, lang: Lang) {
  return (shownQuotes(QUOTES, themeId, lang) as ThemeQuote[]).map(quote => ({
    ...quote,
    spoken: characterLine(quote.figure, quote.text, lang),
    lineRuns: lineRuns(quote.source.line),
  }));
}
