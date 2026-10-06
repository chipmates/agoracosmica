/* THE RELEASE A BUILD PLAYS AT A BARE WING ADDRESS: VITE_NA_FILM_RELEASE names
   a film release under the origin's /film/, and the wing opens as that film
   without ?film=. The rigs, the renders and the walk servers carry none and
   keep the live engine; ?film= still names another release. */
const value: unknown = import.meta.env['VITE_NA_FILM_RELEASE']
export const FILM_RELEASE: string | null = typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value) ? value : null
