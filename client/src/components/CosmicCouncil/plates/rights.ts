/**
 * The rights token a credit line prints, derived from the institution's own
 * assertion rather than assumed.
 *
 * The plates are not one licence. Some are museum CC0 dedications, some are
 * Public Domain Mark records, most are public-domain reproductions under the
 * PD-Art rationale. Printing one token for all three misstates two of them.
 *
 * Order matters: a record that carries a CC0 dedication usually also says
 * "public domain", and the dedication is the stronger, more specific claim.
 */
export const shortRights = (verbatim: string | undefined): string => {
  const text = verbatim ?? '';
  if (/cc0|creative commons zero/i.test(text)) return 'CC0';
  if (/public domain mark|publicdomain\/mark|creative commons mark/i.test(text)) {
    return 'Public Domain Mark 1.0';
  }
  if (/public domain/i.test(text)) return 'Public domain (PD-Art)';
  return '';
};

const GERMAN_MONTHS: Record<string, string> = {
  January: 'Januar', February: 'Februar', March: 'März', April: 'April', May: 'Mai', June: 'Juni',
  July: 'Juli', August: 'August', September: 'September', October: 'Oktober', November: 'November',
  December: 'Dezember',
};

/** A record's date in German: "ca." for "c.", German months and centuries. Years stay as written. */
export const germanCreditDate = (date: string): string =>
  date
    .replace(/\bmid-(\d+)(?:st|nd|rd|th) century\b/g, 'Mitte des $1. Jahrhunderts')
    .replace(/\blate (\d+)(?:st|nd|rd|th) century\b/g, 'spätes $1. Jahrhundert')
    .replace(/\bearly (\d+)(?:st|nd|rd|th) century\b/g, 'frühes $1. Jahrhundert')
    .replace(/\b(\d+)(?:st|nd|rd|th) century\b/g, '$1. Jahrhundert')
    .replace(/\bn\.d\./g, 'o. J.')
    .replace(/\bc\.(?=\s*\d)/g, 'ca.')
    // A protected space keeps "ca." on the line of its year.
    .replace(/\bca\.\s+(?=\d)/g, 'ca.\u00A0')
    .replace(/\bpublished\b/g, 'veröffentlicht')
    .replace(/\bQing dynasty\b/g, 'Qing-Dynastie')
    .replace(new RegExp(`\\b(${Object.keys(GERMAN_MONTHS).join('|')})\\b`, 'g'), (month) => GERMAN_MONTHS[month]);

/** The rights token in German. CC0 and the Public Domain Mark are names and stay. */
export const germanRights = (token: string): string =>
  token.replace(/^Public domain\b/, 'Gemeinfrei');

/**
 * The visible credit: institution, work, hand, year, and the rights token the
 * record asserts. Parts that a record leaves empty are left out rather than
 * printed as a gap. In German the date and the rights token are German; names
 * and titles stay as the institution records them.
 */
export const creditLineOf = (
  parts: {
    institution: string;
    title: string;
    artist?: string;
    date?: string;
    rights?: string;
  },
  lang: string = 'en',
): string => {
  const de = lang === 'de';
  return [
    parts.institution,
    parts.title,
    [parts.artist, de && parts.date ? germanCreditDate(parts.date) : parts.date].filter(Boolean).join(', '),
    de && parts.rights ? germanRights(parts.rights) : parts.rights,
  ]
    .filter(Boolean)
    .join(' · ');
};
