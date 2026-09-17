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
import { loadManifest, type ManifestEntry } from '../../../manifest'
import { createDeepPlatePayload, type DeepPlateTier } from '../../vitrine/deep-plate'
import type { DeepTilePyramid } from '../../vitrine/deep-viewer'
import type { VitrineExhibit, VitrineRect } from '../../vitrine'
import { validatePaintingRecord } from '../pictures/policy'
import { createPolicyWorkLabel } from '../pictures/policy-label'
import { pictureDisplayUV, pictureDisplayWindow } from '../pictures/registration'
import type { PictureWork, ResolvedPicturePlate } from '../pictures/register'
import cardsRaw from '../data/cards.json?raw'
import platesRaw from '../data/plate-descriptions.json?raw'

type Words = { en: string; de: string }
const CARDS = JSON.parse(cardsRaw) as {
  zoom_ceiling: Words
  rule_labels: readonly Words[]
  controls: { shared: { back: Words }; machine: { viewpoints: readonly (Words & { id: string })[] } }
}
const DESCRIPTIONS = (JSON.parse(platesRaw) as { descriptions: Record<string, Words> }).descriptions

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

/** What is on the plate, in the page's language, for a visitor who cannot
 * see it. Null where no one has written it yet. */
export function vinciPlateDescription(id: string): string | null {
  return DESCRIPTIONS[id]?.[lang()] ?? null
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
export async function vinciPlatePyramid(plate: ResolvedPicturePlate): Promise<DeepTilePyramid | null> {
  const record = validatePaintingRecord(plate.plate, 'painting-plate')
  const name = /\/([a-z0-9-]+)__[1-9]\d*x[1-9]\d*\.jpg$/.exec(record.path)?.[1]
  if (!name) return null
  const index = await loadManifest()
  const tiles = index.byId.get(`vinci/painting-tiles/${name}`) as TilesRecord | undefined
  if (!tiles || tiles.role !== 'painting-tiles' || tiles.display !== true) return null
  if (tiles.derived_from !== plate.plate.id || tiles.source_sha256 !== plate.plate.sha256) return null
  if (tiles.width !== plate.pixels.width || tiles.height !== plate.pixels.height) return null
  if (!tiles.tile_size || !tiles.scale_factors?.length || !tiles.path.endsWith('/')) return null
  // Not assetUrl: a pyramid's source_url is the plate's own source page, the
  // provenance line, and never a place to fetch a tile from.
  return { base: `${ASSET_BASE}${tiles.wing}/${tiles.path}`.slice(0, -1), width: tiles.width,
    height: tiles.height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors }
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
  cut: { left: number; right: number; top: number; bottom: number } | null): number | null {
  if (!work.width_cm || !work.height_cm || !(work.width_cm > 0) || !(work.height_cm > 0)) return null
  const across = (cut ? cut.right - cut.left : 1) * plate.pixels.width
  const down = (cut ? cut.bottom - cut.top : 1) * plate.pixels.height
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
}): VitrineExhibit {
  const language = lang()
  const registration = pictureDisplayWindow(options.plate.plate)
  const cut = registration ? pictureDisplayUV(registration) : null
  // TWO TO FOUR SENTENCES ON A CARD, here one and More: the plate is what
  // the window is for, so the words fold and the viewport takes the room.
  const label = createPolicyWorkLabel(options.work, options.entries, false, [], true)
  for (const column of [...label.querySelectorAll<HTMLElement>('.picture-label-language')]) {
    if (column.lang !== language) column.remove()
  }
  const payload = createDeepPlatePayload({
    title: options.title,
    description: vinciPlateDescription(options.id),
    window: cut ? { left: cut.left, top: cut.top, right: cut.right, bottom: cut.bottom } : null,
    source: {
      pyramid: vinciPlatePyramid(options.plate),
      file: ASSET_BASE + validatePaintingRecord(options.plate.plate, 'painting-plate').path,
      width: options.plate.pixels.width,
      height: options.plate.pixels.height,
    },
    words: { whole: CARDS.controls.machine.viewpoints[0]![language], ceiling: CARDS.zoom_ceiling[language], rule: RULE },
    from: options.from,
    tier: options.tier,
    pxPerCm: platePxPerCm(options.work, options.plate, cut),
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
