/** THE PLAQUE BESIDE THE PARACHUTE.
 *
 * The line about flight is the most quoted sentence he never wrote, and it is
 * read where the flight machine stands. The words are the museum's own record
 * of that quotation; nothing here is authored beside them.
 *
 * It is a plaque and not a wall: a standing stone on the court's paving, cut
 * in the same grammar as the grave's, turned to the eye that reads it. It
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
  /** Every line cut into the face, in reading order. */
  exactText: readonly string[]
  source: string
  certainty: string
  sizeM: readonly [number, number]
}

/** The flight quotation, its true source and its year, cut into one stone. */
export function createCourtPlaque(materials: ExhibitMaterials, language: 'en' | 'de' = 'en'): ExhibitionObject<CourtPlaqueMetadata> {
  const build = new Construction(materials, 'vinci-court-plaque', COURT_PLAQUE_MANIFEST_ID)
  const de = language === 'de'
  const width = 1.72, faceWidth = 1.46
  const top = 1.53, left = -faceWidth / 2, ink = 0.05
  // A footed stone: base course, cap, a bronze bead, the body and its face.
  build.box(0, .085, -.08, width + .20, .17, .46, materials.dark)
  build.box(0, .188, -.06, width + .04, .05, .40, materials.stone)
  build.box(0, .225, .06, width - .04, .028, .13, materials.bronze)
  build.box(0, .89, -.11, width, 1.32, .20, materials.stone)
  build.box(0, .92, .014, width + .06, 1.24, .065, materials.stone)
  const lines: string[] = []
  let y = top
  const cut = (value: string, size: number, material = materials.ink, gap = .075) => {
    const block = build.text(value, left, y, ink, size, faceWidth, material)
    lines.push(value)
    y -= block.height + gap
    return block
  }
  cut(de ? PLATE.title_de : PLATE.title_en, .058, materials.ink, .105)
  // The sentence itself stands in English on every stage, the way it circulates.
  cut(PLATE.quote, .062, materials.ink, .115)
  cut(de ? PLATE.line_de : PLATE.line_en, .046)
  cut(de ? PLATE.where_de : PLATE.where_en, .042, materials.ink, .065)
  if (de) cut(PLATE.language_note_de, .036, materials.ink, .065)
  cut(PLATE.when, .056, materials.bronze)
  const group = build.finish()
  // The registry reads one proxy per exhibit, and the body is that proxy.
  for (const child of group.children) {
    if (child instanceof Mesh && child.material === materials.stone) child.userData['studId'] = COURT_PLAQUE_STUD
  }
  const metadata: CourtPlaqueMetadata = {
    kind: 'court-plaque', stud: COURT_PLAQUE_STUD, language, exactText: lines,
    source: de ? PLATE.where_de : PLATE.where_en, certainty: PLATE.certainty,
    sizeM: [width + .20, top + .12],
  }
  group.userData['exhibit'] = metadata
  return { group, metadata, dispose: () => build.dispose() }
}
