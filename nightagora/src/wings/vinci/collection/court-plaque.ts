/** THE PLACE BESIDE THE PARACHUTE WHERE THE FLIGHT QUOTATION IS READ.
 *
 * The line about flight is the most quoted sentence he never wrote, and it is
 * read where the flight machine stands. Its words live in the place's own
 * card, in the drawer, and nowhere in the court: the museum's words stay in
 * one place. What stands here is a stone bench in the grave's grammar, turned
 * to the eye that reads it, a place to sit under the flying machines. It
 * stands clear of every certified route and outside the cone between the
 * display wall's eye and its field.
 */
import { Mesh } from 'three/webgpu'
import { Construction, type ExhibitMaterials, type ExhibitionObject } from '../myths/construction'
import words from '../line/data/never-said.json'

/** The exhibit id the close look's registry reads off this stone. */
export const COURT_PLAQUE_STUD = 'flight-quote'
export const COURT_PLAQUE_MANIFEST_ID = 'vinci/court-plaque'

/** East, north and the bearing its face takes, in the wing's own metres. The
 * parachute stands at -37.00, -23.10, and this is four metres south-west of
 * its axis on open paving, turned to the display wall's own station eye.
 * Both of the station frame's limits set it: its whole width stands inside
 * the wide frame at 7.5 m, and its nearest corner clears the cone between
 * that eye and its field by 0.42 m, so nothing of it is before the field. */
export const COURT_PLAQUE_STAND = { east: -40.2, north: -25.5, bearing: 57.6 } as const

const PLATE = words.court_plaque

export interface CourtPlaqueMetadata {
  kind: 'court-plaque'
  stud: string
  language: 'en' | 'de'
  /** Every line cut into the stone, in reading order: none, the words are
   * read in the place's card */
  exactText: readonly string[]
  source: string
  certainty: string
  sizeM: readonly [number, number]
}

/** The flight quotation, its true source and its year, cut into one stone. */
export function createCourtPlaque(materials: ExhibitMaterials, language: 'en' | 'de' = 'en'): ExhibitionObject<CourtPlaqueMetadata> {
  const build = new Construction(materials, 'vinci-court-plaque', COURT_PLAQUE_MANIFEST_ID)
  const de = language === 'de'
  const width = 1.72, seat = .46, depth = .44
  // A footed stone seat: a dark base course set back under a stone slab, and
  // the bronze bead the plaque carried, now along the seat's front arris.
  build.box(0, .06, -.02, width - .1, .12, depth - .1, materials.dark)
  build.box(0, (seat - .09 + .12) / 2, -.02, width - .16, seat - .09 - .12, depth - .16, materials.stone)
  build.box(0, seat - .045, -.02, width, .09, depth, materials.stone)
  build.box(0, seat - .092, depth / 2 - .02 + .006, width - .04, .014, .012, materials.bronze)
  const group = build.finish()
  // The registry reads one proxy per exhibit, and the seat is that proxy.
  for (const child of group.children) {
    if (child instanceof Mesh && child.material === materials.stone) child.userData['studId'] = COURT_PLAQUE_STUD
  }
  const metadata: CourtPlaqueMetadata = {
    kind: 'court-plaque', stud: COURT_PLAQUE_STUD, language, exactText: [],
    source: de ? PLATE.where_de : PLATE.where_en, certainty: PLATE.certainty,
    sizeM: [width, seat],
  }
  group.userData['exhibit'] = metadata
  return { group, metadata, dispose: () => build.dispose() }
}
