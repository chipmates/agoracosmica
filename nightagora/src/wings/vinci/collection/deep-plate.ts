/** THE WING'S WHOLE PLATE: the museum's deep viewer with this wing's words
 * and this wing's records around it.
 *
 * The vitrine owns the window and the payload owns the viewer. What stands
 * here is what only the picture wing can say: which pyramid in the store
 * belongs to this plate, what the plate shows for a visitor who cannot see
 * it, the sentence at the ceiling, and the rule's own numerals.
 */
import { lang } from '../../content'
import { ASSET_BASE } from '../../../stack/materials'
import { loadManifest, type ManifestEntry, type ManifestIndex } from '../../../manifest'
import { createDeepPlatePayload, type DeepPlateDetail, type DeepPlateSource, type DeepPlateTier } from '../../vitrine/deep-plate'
import type { DeepTilePyramid } from '../../vitrine/deep-viewer'
import type { VitrineExhibit, VitrineRect } from '../../vitrine'
import { validatePaintingRecord } from '../pictures/policy'
import { createPolicyWorkLabel } from '../pictures/policy-label'
import { pictureDisplayUV, pictureDisplayWindow } from '../pictures/registration'
import type { PictureWork, ResolvedPicturePlate } from '../pictures/register'
import cardsRaw from '../data/cards.json?raw'
import linesRaw from '../data/lines.json?raw'
import platesRaw from '../data/plate-descriptions.json?raw'

type Words = { en: string; de: string }
const CARDS = JSON.parse(cardsRaw) as {
  zoom_ceiling: Words
  rule_labels: readonly Words[]
  controls: { shared: { back: Words }; machine: { viewpoints: readonly (Words & { id: string })[] } }
}
const DESCRIPTIONS = (JSON.parse(platesRaw) as { descriptions: Record<string, Words> }).descriptions
type DetailRect = { x: number; y: number; w: number; h: number; name_en: string; name_de: string }
const LINES = (JSON.parse(linesRaw) as { lines: Record<string, { detail?: DetailRect }> }).lines

/** The whole plate stands in front of the close look of the same work, so
 * it carries the same id with one word after it. */
const WHOLE = '/whole'
export const isWholePlate = (id: string | null): boolean => Boolean(id?.endsWith(WHOLE))

/** THE RULE'S NUMERALS, as the card models write them. A numeral is a
 * measurement and reads the same in both languages, so the centimetres are
 * taken from the label itself rather than kept a second time in code. */
const RULE: readonly { label: string; cm: number }[] = CARDS.rule_labels
  .map(words => ({ label: words[lang()], cm: Number.parseFloat(words.en) }))
  .filter(step => Number.isFinite(step.cm) && step.cm > 0)

/** THE TWO STEPS, in the page's language. The wheel, the pinch, the double
 * tap and the keys all reach the ceiling; a hand with none of them needs a
 * control, and the card models hold no word for one yet. */
export const NEARER: Words = { en: 'Zoom in', de: 'Näher' }
export const FURTHER: Words = { en: 'Zoom out', de: 'Weiter weg' }

/** What is on the plate, in the page's language, for a visitor who cannot
 * see it. Null where no one has written it yet. */
export function vinciPlateDescription(id: string): string | null {
  return DESCRIPTIONS[id]?.[lang()] ?? null
}

/** WHAT A LINE POINTS AT on this plate, named in the page's language by the
 * register that holds the rectangle. The fractions are of the source, which
 * is what the record's own numbers are measured against. */
export function vinciPlateDetails(id: string): readonly DeepPlateDetail[] {
  const detail = LINES[id]?.detail
  if (!detail) return []
  return [{ x: detail.x, y: detail.y, w: detail.w, h: detail.h,
    name: lang() === 'de' ? detail.name_de : detail.name_en }]
}

/** THE STORE'S PYRAMID FOR THIS PLATE, or nothing. A record is read only
 * when it says it was cut from this very file: the id, the hash and the
 * pixels all have to agree, or the view falls back to the file itself and
 * the ceiling is that file's own pixels. */
interface TilesRecord extends ManifestEntry {
  readonly role?: string
  readonly derived_from?: string
  readonly source_sha256?: string
  readonly width?: number
  readonly height?: number
  readonly tile_size?: number
  readonly scale_factors?: readonly number[]
}
/** THE DEEP SOURCE OF THIS FACE, where the store holds one: the same source
 * page as the plate the wall hangs, unbounded. The wall keeps its own plate,
 * which is the file a texture can carry; this is the one the close view
 * opens, so the ceiling is the source's own pixels rather than the wall's
 * copy of them. Read synchronously, because the view needs the source's
 * shape and its centimetres in the same breath it is built. */
let INDEX: ManifestIndex | null = null
void loadManifest().then(index => { INDEX = index })
export function vinciDeepPlate(plate: ResolvedPicturePlate):
{ pyramid: DeepTilePyramid; width: number; height: number } | null {
  if (!INDEX) return null
  const record = validatePaintingRecord(plate.plate, 'painting-plate')
  const tiles = INDEX.byId.get(`vinci/deep-tiles/${record.identity.replace(':', '-')}`) as TilesRecord | undefined
  if (!tiles || tiles.role !== 'deep-tiles' || tiles.display !== true) return null
  if (!tiles.width || !tiles.height || !tiles.tile_size || !tiles.scale_factors?.length) return null
  if (!tiles.path.endsWith('/')) return null
  // The deep file has to be the one admitted BESIDE this very plate, or it
  // is another work's source and the label under it would be false.
  const source = INDEX.byId.get(tiles.derived_from ?? '') as (ManifestEntry & { stands_beside?: string }) | undefined
  if (!source || source.stands_beside !== plate.plate.id || source.sha256 !== tiles.source_sha256) return null
  if (source.licence !== plate.plate.licence || source.class !== plate.plate.class) return null
  return {
    pyramid: { base: `${ASSET_BASE}${tiles.wing}/${tiles.path}`.slice(0, -1), width: tiles.width,
      height: tiles.height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors },
    width: tiles.width,
    height: tiles.height,
  }
}

export async function vinciPlatePyramid(plate: ResolvedPicturePlate): Promise<DeepTilePyramid | null> {
  // The two faces of one panel share a file name, so a pyramid is named by
  // the face the records give the plate and never by its path.
  const record = validatePaintingRecord(plate.plate, 'painting-plate')
  const index = await loadManifest()
  const tiles = index.byId.get(`vinci/painting-tiles/${record.identity.replace(':', '-')}`) as TilesRecord | undefined
  if (!tiles || tiles.role !== 'painting-tiles' || tiles.display !== true) return null
  if (tiles.derived_from !== plate.plate.id || tiles.source_sha256 !== plate.plate.sha256) return null
  if (tiles.width !== plate.pixels.width || tiles.height !== plate.pixels.height) return null
  if (!tiles.tile_size || !tiles.scale_factors?.length || !tiles.path.endsWith('/')) return null
  // Not assetUrl: a pyramid's source_url is the plate's own source page, the
  // provenance line, and never a place to fetch a tile from.
  return { base: `${ASSET_BASE}${tiles.wing}/${tiles.path}`.slice(0, -1), width: tiles.width,
    height: tiles.height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors }
}

/** THE STORE'S PYRAMID FOR ONE LEAF OF THE EDITION, or the scan itself
 * where none is cut. The nearer scan of a leaf is admitted beside the one
 * the strip shows, so the pyramid carries its own pixels and the source's
 * shape is taken from the pyramid rather than from the thumb's record. A
 * record is read only when the file it names is the one it says it was cut
 * from; anything else falls back to the scan, and the ceiling sentence
 * stays true either way, because the ceiling is whatever source the window
 * opened. */
const LEAF_PYRAMIDS = new WeakMap<ManifestIndex, Map<string, TilesRecord>>()
export function vinciLeafSource(index: ManifestIndex, page: string,
  scan: { file: string; width: number; height: number }): DeepPlateSource {
  // A reading builds 188 sides, so the records are gathered once per index
  // rather than walked once per side.
  let cut = LEAF_PYRAMIDS.get(index)
  if (!cut) {
    cut = new Map()
    for (const entry of index.all) {
      const record = entry as TilesRecord & { page?: string }
      if (record.role === 'leaf-tiles' && record.page) cut.set(record.page, record)
    }
    LEAF_PYRAMIDS.set(index, cut)
  }
  const tiles = cut.get(page)
  if (!tiles || tiles.display !== true || !tiles.width || !tiles.height) return { pyramid: null, ...scan }
  if (!tiles.tile_size || !tiles.scale_factors?.length || !tiles.path.endsWith('/')) return { pyramid: null, ...scan }
  const source = index.byId.get(tiles.derived_from ?? '')
  if (!source || !tiles.source_sha256 || source.sha256 !== tiles.source_sha256) return { pyramid: null, ...scan }
  return {
    pyramid: { base: `${ASSET_BASE}${tiles.wing}/${tiles.path}`.slice(0, -1), width: tiles.width,
      height: tiles.height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors },
    file: scan.file,
    width: tiles.width,
    height: tiles.height,
  }
}

/** PIXELS OF THE SOURCE ACROSS ONE CENTIMETRE OF THE WORK. The display
 * window is the extent the museum hangs the work by and the register holds
 * its size in centimetres; a work missing either has no rule. The window's
 * own aspect and the register's differ by a little, and the room resolves
 * that by containing the measurement inside the window, so the rule takes
 * the same reading rather than a second one. The window carries
 * physicalRegistration: false, so this is the museum's own assumption and
 * never an authenticated registration of the panel. */
function platePxPerCm(work: PictureWork, plate: ResolvedPicturePlate,
  cut: { left: number; right: number; top: number; bottom: number } | null, scale: number): number | null {
  if (!work.width_cm || !work.height_cm || !(work.width_cm > 0) || !(work.height_cm > 0)) return null
  if (!(scale > 0)) return null
  // The magnification the rule multiplies is one screen pixel per pixel of
  // the source standing in the window, so a deeper source of the same work
  // carries proportionally more of its own pixels across one centimetre.
  const across = (cut ? cut.right - cut.left : 1) * plate.pixels.width * scale
  const down = (cut ? cut.bottom - cut.top : 1) * plate.pixels.height * scale
  if (!(across > 0) || !(down > 0)) return null
  return Math.max(across / work.width_cm, down / work.height_cm)
}

/** THE WHOLE PLATE AS AN EXHIBIT of the wing's own window: the same label
 * the room hangs, folded to its first line, the deep viewer as its payload,
 * and three controls. Back returns to the close look the visitor came from,
 * which is the one motion this window adds to the wall. */
export function createVinciWholePlate(options: {
  /** The picture exhibit this one stands in front of. */
  id: string
  title: string
  line: string | null
  work: PictureWork
  entries: readonly ResolvedPicturePlate[]
  plate: ResolvedPicturePlate
  limit: string | null
  visualNote: string | null
  /** The record and Close, composed by the wing as they are everywhere. */
  controls: readonly HTMLElement[]
  /** Walk back to the close look. */
  back(): void
  from(): VitrineRect | null
  tier(): DeepPlateTier
  /** The phone folds the card so the viewport takes the sheet. */
  narrow: boolean
}): VitrineExhibit {
  const language = lang()
  const registration = pictureDisplayWindow(options.plate.plate)
  const cut = registration ? pictureDisplayUV(registration) : null
  // The same label the close look carries, folded where it folds there: the
  // plate is what this window is for, and the words stand beside it.
  const label = createPolicyWorkLabel(options.work, options.entries, false, [], options.narrow)
  for (const column of [...label.querySelectorAll<HTMLElement>('.picture-label-language')]) {
    if (column.lang !== language) column.remove()
  }
  // THE DEEP SOURCE WHERE THE STORE HOLDS ONE. Its pixels are the view's
  // ceiling and the rule's own scale, so the centimetres are measured
  // against the source that stands in the window, not the wall's plate.
  const deep = vinciDeepPlate(options.plate)
  const payload = createDeepPlatePayload({
    title: options.title,
    description: vinciPlateDescription(options.id),
    window: cut ? { left: cut.left, top: cut.top, right: cut.right, bottom: cut.bottom } : null,
    source: {
      pyramid: deep ? deep.pyramid : vinciPlatePyramid(options.plate),
      file: ASSET_BASE + validatePaintingRecord(options.plate.plate, 'painting-plate').path,
      width: deep ? deep.width : options.plate.pixels.width,
      height: deep ? deep.height : options.plate.pixels.height,
    },
    words: { whole: CARDS.controls.machine.viewpoints[0]![language], nearer: NEARER[language],
      further: FURTHER[language], ceiling: CARDS.zoom_ceiling[language], rule: RULE },
    from: options.from,
    tier: options.tier,
    pxPerCm: platePxPerCm(options.work, options.plate, cut, deep ? deep.width / options.plate.pixels.width : 1),
    details: vinciPlateDetails(options.id),
  })
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'vitrine-control'
  back.textContent = CARDS.controls.shared.back[language]
  back.addEventListener('click', options.back)
  return {
    id: `${options.id}${WHOLE}`,
    title: options.title,
    line: options.line,
    card: [label],
    controls: [back, ...options.controls],
    payload,
    work: () => payload.origin(),
    limit: options.limit,
    visualNote: options.visualNote,
  }
}
