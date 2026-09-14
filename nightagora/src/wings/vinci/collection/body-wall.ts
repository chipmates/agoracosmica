/** The body wall's own register: the Windsor sheets the rights pass admits.
 *
 * About six hundred sheets are at Windsor. The Royal Collection keeps its
 * reproduction terms, and the museum shows the faithful public-domain
 * reproductions the source policy admits at Tier 2, labelled as
 * reproductions. Twenty eight of them stand in the four courses, and the
 * sheet the vortex arithmetic in the drawer is read from stands apart.
 *
 * The mounts are modern furniture. The register records no centimetres for
 * twenty eight of these sheets, so each carrier holds a constant area and
 * takes its sheet's own proportion: a mount here is never a claim about a
 * sheet's size. The one sheet whose centimetres the holder's catalogue does
 * record is built at that size instead, and its own record carries the
 * second published measurement.
 */
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import { validateSheetRecord, type SheetManifestEntry } from '../pictures/sheet-record'
import { FACE, FLOOR } from './layout'

export interface BodySheetSize { readonly widthCm: number; readonly heightCm: number }
export interface BodySheet {
  readonly id: string
  /** The course, or the sheet that stands apart from the four courses. */
  readonly row: number | 'vortex'
  readonly column: number
  readonly pixels: { readonly width: number; readonly height: number }
  /** Present only where the holder's catalogue records the sheet itself. */
  readonly measured?: BodySheetSize
}
const s = (id: string, width: number, height: number, row: number | 'vortex', column: number,
  measured?: BodySheetSize): BodySheet => ({ id, row, column, pixels: { width, height }, measured })

/** One mount holds this much wall, and the sheet's proportion decides the
 * rest. It is the area the four courses were laid out with. */
const MOUNT_AREA = .19 * .278

export const BODY_WALL: readonly BodySheet[] = [
  s('rcin-919000', 1176, 1676, 0, 0),
  s('rcin-919001', 1208, 1722, 0, 1),
  s('rcin-919002', 1208, 1732, 0, 2),
  s('rcin-919003', 2854, 4096, 0, 3),
  s('rcin-919004', 1202, 1710, 0, 4),
  s('rcin-919005', 2211, 3196, 0, 5),
  s('rcin-919006', 1088, 1576, 0, 6),
  s('rcin-919007', 1628, 2250, 1, 0),
  s('rcin-919008', 1592, 2250, 1, 1),
  s('rcin-919009', 1216, 1725, 1, 2),
  s('rcin-919010', 1218, 1708, 1, 3),
  s('rcin-919011', 1172, 1692, 1, 4),
  s('rcin-919012', 1641, 2250, 1, 5),
  s('rcin-919013', 1228, 1746, 1, 6),
  s('rcin-919014', 1210, 1626, 2, 0),
  s('rcin-919015', 1250, 1752, 2, 1),
  s('rcin-919016', 1194, 1740, 2, 2),
  s('rcin-919017', 1483, 2000, 2, 3),
  s('rcin-919018', 1554, 2250, 2, 4),
  s('rcin-919019', 1130, 1588, 2, 5),
  s('rcin-919028', 1218, 1674, 2, 6),
  s('rcin-919055', 1236, 1672, 3, 0),
  s('rcin-919057', 1665, 2250, 3, 1),
  s('rcin-919058', 1155, 1596, 3, 2),
  s('rcin-919075', 1508, 2000, 3, 3),
  s('rcin-919101', 1477, 2000, 3, 4),
  s('rcin-919102', 1498, 2000, 3, 5),
  s('rcin-919116', 1808, 1273, 3, 6),
  s('rcin-919082', 1253, 1698, 'vortex', 0, { widthCm: 20.4, heightCm: 28.3 }),
]

const WALL = FACE.hallPartitionEast + .033
const CENTRE = -52.6, DATUM = FLOOR + 1.52
const COLUMN_PITCH = .46, ROW_PITCH = .42

export interface BodyMount extends BodySheet {
  /** Metres of wall the carrier's opening holds. */
  readonly width: number
  readonly height: number
  readonly east: number
  readonly north: number
  readonly datum: number
}

/** A single layout supplies both the wall's carriers and the sheets on them. */
export function bodyMounts(): readonly BodyMount[] {
  return BODY_WALL.map(sheet => {
    const aspect = sheet.pixels.width / sheet.pixels.height
    const width = sheet.measured ? sheet.measured.widthCm / 100 : Math.sqrt(MOUNT_AREA * aspect)
    const height = sheet.measured ? sheet.measured.heightCm / 100 : Math.sqrt(MOUNT_AREA / aspect)
    const north = sheet.row === 'vortex' ? CENTRE + 4.05 : CENTRE + (sheet.column - 3) * COLUMN_PITCH
    const datum = sheet.row === 'vortex' ? DATUM + .28 : DATUM + (1.5 - sheet.row) * ROW_PITCH
    return { ...sheet, width, height, east: WALL + .026, north, datum }
  })
}

export interface BodySheetSource {
  readonly sheet: BodyMount
  readonly preview: SheetManifestEntry
  readonly page: SheetManifestEntry
}

/** The store decides what hangs here. A sheet whose records the store does
 * not carry, or carries without the policy's tier and label, never reaches a
 * texture: the wall throws instead of standing an empty carrier. */
export function bodySheetSources(manifest: ManifestIndex): readonly BodySheetSource[] {
  return bodyMounts().map(sheet => {
    const pick = (role: SheetManifestEntry['role']): SheetManifestEntry => {
      const found = manifest.all.filter((entry: ManifestEntry) => {
        const e = entry as Partial<SheetManifestEntry>
        return e.role === role && typeof e.path === 'string' && new RegExp(`/${sheet.id}__`).test(e.path)
      })
      if (found.length !== 1) throw new Error(`The body wall needs one ${role} for ${sheet.id}`)
      return validateSheetRecord(found[0]!, role).entry
    }
    const page = pick('sheet-page'), preview = pick('sheet-thumb')
    if (page.honesty_en !== preview.honesty_en || page.honesty_de !== preview.honesty_de
      || page.source_url !== preview.source_url || page.licence !== preview.licence) {
      throw new Error(`The body wall's thumb changes the sheet's record: ${sheet.id}`)
    }
    if (page.width !== sheet.pixels.width || page.height !== sheet.pixels.height) {
      throw new Error(`The body wall's register disagrees with the store: ${sheet.id}`)
    }
    return { sheet, preview, page }
  })
}
