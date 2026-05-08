/**
 * Shortens display names for figures whose full names overflow the mobile chrome
 * title (top-left FAB collides with centered title) or wrap chat bubble headers
 * onto two lines. Initials replace middle names; surnames stay intact.
 *
 * Operates on either the raw figure name or the prefixed form ("Echo of ...",
 * "Echo von ...") since the regex anchors on the figure-name segment.
 *
 * Borderline cases (Bingen, Nietzsche, Schopenhauer, Shakespeare) are left
 * full — they fit on most devices and the abbreviation cost outweighs the gain.
 */
export function getDisplayShortName(figureName: string | null | undefined): string {
  if (!figureName) return '';
  return figureName
    .replace(/Johann Wolfgang von Goethe/g, 'J. W. von Goethe')
    .replace(/Wolfgang Amadeus Mozart/g, 'W. A. Mozart')
    .replace(/Martin Luther King Jr\.?/g, 'M. L. King Jr.');
}
