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

/**
 * The visible credit: institution, work, hand, year, and the rights token the
 * record asserts. Parts that a record leaves empty are left out rather than
 * printed as a gap.
 */
export const creditLineOf = (parts: {
  institution: string;
  title: string;
  artist?: string;
  date?: string;
  rights?: string;
}): string =>
  [
    parts.institution,
    parts.title,
    [parts.artist, parts.date].filter(Boolean).join(', '),
    parts.rights,
  ]
    .filter(Boolean)
    .join(' · ');
