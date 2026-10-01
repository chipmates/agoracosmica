// How the reviewed quote list in themes.json becomes one theme page's block.
// Plain ESM: the page reads it, and so does the date helper the Node sitemap
// script imports.

/** A block draws only with at least this many quotes. */
export const MIN_QUOTES = 2;

/** A block never holds more than this many. */
export const MAX_QUOTES = 4;

/** Longest quote in characters, unless the entry carries its own `cap`. */
export const QUOTE_CAP = 200;

/** The entries that list one page, in file order. */
export const listedQuotes = (quotes, themeId, lang) =>
  quotes.filter((q) => q.lang === lang && q.themes.includes(themeId)).slice(0, MAX_QUOTES);

/** What the page draws: its listed entries, or nothing under the minimum. */
export const shownQuotes = (quotes, themeId, lang) => {
  const listed = listedQuotes(quotes, themeId, lang);
  return listed.length >= MIN_QUOTES ? listed : [];
};
