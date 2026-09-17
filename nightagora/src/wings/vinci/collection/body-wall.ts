/** The body wall's own register: the Windsor sheets the rights pass admits.
 *
 * About six hundred sheets are at Windsor. The Royal Collection keeps its
 * reproduction terms, and the museum shows the faithful public-domain
 * reproductions the source policy admits at Tier 2, labelled as
 * reproductions. Twenty eight of them stand in the four courses, and the
 * sheet the vortex arithmetic in the drawer is read from stands apart.
 *
 * Every sheet hangs at the size its holder records (`data/sheet-sizes.json`);
 * a sheet whose holder entry is missing keeps a mount of constant area.
 */
import sizesSource from '../data/sheet-sizes.json?raw'
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
  /** Present only where the holder records the sheet's own size. */
  readonly measured?: BodySheetSize
}

interface SizeRecord { readonly heightCm: number | null; readonly widthCm: number | null }
const SIZES = (JSON.parse(sizesSource) as { sheets: Record<string, SizeRecord> }).sheets

/** A sheet without a size record is refused, never hung at a guess. */
function holderSize(id: string): BodySheetSize | undefined {
  const record = SIZES[id]
  if (!record) throw new Error(`The body wall has no size record for ${id}`)
  if (record.heightCm === null && record.widthCm === null) return undefined
  if (!(Number(record.heightCm) > 0 && Number(record.widthCm) > 0))
    throw new Error(`The body wall's size record is incomplete: ${id}`)
  return { widthCm: record.widthCm!, heightCm: record.heightCm! }
}
const s = (id: string, width: number, height: number, row: number | 'vortex', column: number): BodySheet =>
  ({ id, row, column, pixels: { width, height }, measured: holderSize(id) })

/** A sheet with no recorded size gets this much wall at its reproduction's
 * proportion: the area the courses were first laid out with. */
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
  s('rcin-919082', 1253, 1698, 'vortex', 0),
]

const WALL = FACE.hallPartitionEast + .033
/** The lowest edge of the lowest course. The reading ledge in front of the
 * wall is 0.92 m high and touches it at FLOOR + .945; the sheets clear that
 * contact line by a hand's width, so no sheet is read over the ledge. */
const SILL = FLOOR + 1.047
const CENTRE = -52.6
/** What the carrier's moulding adds beyond the sheet on each side. */
const MOULDING = .028
/** The clear interval the tightest pair of neighbours keeps, across a course
 * and down a column. Both pitches are uniform and set by that pair. */
const INTERVAL = .08

export interface BodyMount extends BodySheet {
  /** Metres of wall the carrier's opening holds. */
  readonly width: number
  readonly height: number
  readonly east: number
  readonly north: number
  readonly datum: number
}

/** A single layout supplies both the wall's carriers and the sheets on them.
 * A print room's grid of mixed sizes: every course shares one centre line,
 * every column one axis, so each sheet stands centred in its cell. */
export function bodyMounts(): readonly BodyMount[] {
  const sized = BODY_WALL.map(sheet => {
    const aspect = sheet.pixels.width / sheet.pixels.height
    const width = sheet.measured ? sheet.measured.widthCm / 100 : Math.sqrt(MOUNT_AREA * aspect)
    const height = sheet.measured ? sheet.measured.heightCm / 100 : Math.sqrt(MOUNT_AREA / aspect)
    return { sheet, width, height }
  })
  const grid = sized.filter(entry => entry.sheet.row !== 'vortex')
  const courses = Math.max(...grid.map(entry => entry.sheet.row as number)) + 1
  const columns = Math.max(...grid.map(entry => entry.sheet.column)) + 1
  let columnPitch = 0, coursePitch = 0
  for (const a of grid) for (const b of grid) {
    if (a.sheet.row === b.sheet.row && b.sheet.column === a.sheet.column + 1)
      columnPitch = Math.max(columnPitch, (a.width + b.width) / 2 + 2 * MOULDING + INTERVAL)
    if (a.sheet.column === b.sheet.column && b.sheet.row === (a.sheet.row as number) + 1)
      coursePitch = Math.max(coursePitch, (a.height + b.height) / 2 + 2 * MOULDING + INTERVAL)
  }
  const lowest = grid.filter(entry => entry.sheet.row === courses - 1)
  const lowestLine = SILL + Math.max(...lowest.map(entry => entry.height / 2 + MOULDING))
  const line = (row: number): number => lowestLine + (courses - 1 - row) * coursePitch
  return sized.map(({ sheet, width, height }) => {
    // The sheet apart stands on the second course's centre line, off the grid.
    const north = sheet.row === 'vortex' ? CENTRE + 4.05 : CENTRE + (sheet.column - (columns - 1) / 2) * columnPitch
    const datum = sheet.row === 'vortex' ? line(1) : line(sheet.row)
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
    // The thumb is a derivative of the same sheet, never a different framing.
    const factor = Math.max(preview.width, preview.height) / Math.max(page.width, page.height)
    if (preview.width > page.width || preview.height > page.height
      || Math.abs(preview.width - page.width * factor) > 1.1
      || Math.abs(preview.height - page.height * factor) > 1.1) {
      throw new Error(`The body wall's thumb changes the sheet: ${sheet.id}`)
    }
    return { sheet, preview, page }
  })
}
