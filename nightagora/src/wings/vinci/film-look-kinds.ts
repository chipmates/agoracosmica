/* WHAT A MARK OPENS IN THE FILM: every exhibit id a mark can carry, by the
   close look the film opens for it, each the live wing's own branch. The ids
   are written here rather than imported: the modules that name them carry
   the whole site, which the film's close looks never need
   (`forge/film/look-kinds.test.mjs` holds them equal). */

import { isCollectionBook } from './table/codex-shelf'

/** the line's floor, which opens the life view whole (`LINE_FLOOR_PICK`) */
export const FILM_LINE_FLOOR = 'line/floor'
/** the leaf on the study's support (`VINCI_STUDY_LEAF`) */
export const FILM_STUDY_LEAF = 'leaf/paris-B-83v'
/** the painting at the grave, read under a place's card, not the hang's */
export const FILM_DEATHBED = 'picture/deathbed-painting/front'
/** the store's reproduction the painting at the grave hangs (`PLATES.ingres`) */
export const FILM_DEATHBED_PLATE = 'vinci/place-plate/jean-auguste-dominique-ingres-francois-ier-recoit-les-derniers-soupirs__petit-palais-musee-des-beaux-arts-de-la-ville-de-paris__4096x3252'
/** the grave's own places */
export const FILM_PLACES: ReadonlySet<string> = new Set(['grave', 'grave-diagram'])
/** the book on the table (`EDITION_EXHIBIT`) and the whole edition of 1883 */
export const FILM_EDITION = 'codex/paris-B'
export const FILM_EDITION_WHOLE = 'codex/edition'

export type FilmLookKind = 'edition' | 'whole-edition' | 'topic' | 'book' | 'life' | 'study-leaf' | 'sheet' | 'place' | 'picture' | 'machine'

/** the look a mark's id opens, or null for an id no look answers */
export function filmLookKind(id: string): FilmLookKind | null {
  if (id === FILM_EDITION) return 'edition'
  if (id.startsWith('topic/')) return 'topic'
  if (id === FILM_EDITION_WHOLE) return 'whole-edition'
  if (isCollectionBook(id)) return 'book'
  if (id === FILM_LINE_FLOOR) return 'life'
  if (id === FILM_STUDY_LEAF) return 'study-leaf'
  if (id.startsWith('sheet/')) return 'sheet'
  if (FILM_PLACES.has(id) || id === FILM_DEATHBED) return 'place'
  if (id.startsWith('picture/')) return 'picture'
  if (id.startsWith('machine/')) return 'machine'
  return null
}
