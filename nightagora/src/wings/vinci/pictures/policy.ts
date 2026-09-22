/** The 2026-09-09 source policy overlays the immutable historical register.
 * The store is authoritative for the displayed reproduction. The register is
 * still authoritative for the object's dimensions, attribution and chronology.
 * No audit filename becomes a URL and no legacy RC field admits an image.
 */
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import type { PaintingManifestEntry, PicturePixels, PictureWork, ResolvedPicturePlate } from './register'

export type PicturePolicyTier = 'TIER1' | 'TIER2'
export interface PolicyPaintingEntry extends PaintingManifestEntry {
  readonly tier?: PicturePolicyTier
  readonly honesty_en?: string
  readonly honesty_de?: string
  readonly state_note?: string
  readonly plate_id?: string
  readonly supersedes?: readonly string[]
  /** A per-work owner decision: this plate hangs before the named plates,
   * which stay admitted as evidence in the record and are never superseded. */
  readonly chosen_over?: readonly string[]
  readonly width?: number
  readonly height?: number
  readonly licence_url?: string
}
export interface ValidatedPaintingRecord {
  readonly entry: PolicyPaintingEntry
  readonly pixels: PicturePixels
  /** Stable across the preview and full plate, even when their ids differ. */
  readonly identity: string
  readonly face: 'front' | 'reverse'
  readonly path: string
}
export interface PolicyPicturePlate extends ResolvedPicturePlate {
  readonly preview: PolicyPaintingEntry
  readonly plate: PolicyPaintingEntry
  readonly identity: string
  readonly policyTier: PicturePolicyTier | null
  /** The print is an independent image, never a state of the measured panel. */
  readonly relationship: 'primary' | 'reverse' | 'historical-photograph' | 'independent-print'
}
export interface PicturePolicySelection {
  readonly primary: PolicyPicturePlate | null
  readonly mainPlates: readonly PolicyPicturePlate[]
  readonly alternatives: readonly PolicyPicturePlate[]
  readonly all: readonly PolicyPicturePlate[]
  /** The plates the primary was chosen over, shown in its record. */
  readonly evidence: readonly PolicyPicturePlate[]
}
const DISPLAY_CLASSES = new Set(['CAPTURED', 'CC0', 'CC-BY', 'CC-BY-SA', 'PD-ART'])
/** A source that is itself a print after the painting is a document ABOUT the
 * work, not a photograph OF it. Set inside the measured field it would make
 * the field say "this is the object", so such a work hangs as an absence at
 * true size and its document is opened on purpose.
 */
const PRINTED_DOCUMENT = /printed reproduction|Druckreproduktion|print after|engraving/i
export function isPrintedDocument(plate: PolicyPaintingEntry): boolean {
  return PRINTED_DOCUMENT.test(plate.state_note ?? '')
}
const WORK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Used by both resolution and the stream. It admits store records, never a
 * loosely matching URL. It also understands policy ids whose suffix records
 * each derivative's dimensions, and named states such as Salvator's Cook photo.
 */
export function validatePaintingRecord(entry: ManifestEntry, expectedRole?: PaintingManifestEntry['role']): ValidatedPaintingRecord {
  const e = entry as PolicyPaintingEntry
  const match = /^vinci\/(painting-preview|painting-plate)\/([a-z0-9-]+)(?:__([1-9]\d*)x([1-9]\d*))?$/.exec(e.id)
  const path = /^paintings\/([a-z0-9-]+)\/([a-z0-9-]+)__([1-9]\d*)x([1-9]\d*)\.jpg$/.exec(e.path)
  if (!match || !path || !WORK_ID.test(e.work_id ?? '') || e.role !== match[1]
    || expectedRole && e.role !== expectedRole || e.wing !== 'wing-vinci'
    || e.display !== true || !DISPLAY_CLASSES.has(e.class) || path[1] !== e.work_id
    || !/^[a-f0-9]{64}$/.test(e.sha256 ?? '') || !e.licence?.trim()) {
    throw new Error(`Inadmissible painting manifest record: ${e.id}`)
  }
  const width = Number(path[3]), height = Number(path[4])
  if (width * height !== e.pixels || Math.max(width, height) > (e.role === 'painting-preview' ? 1024 : 4096)
    || e.width !== undefined && e.width !== width || e.height !== undefined && e.height !== height
    || match[3] !== undefined && (Number(match[3]) !== width || Number(match[4]) !== height)) {
    throw new Error(`Painting dimensions disagree: ${e.id}`)
  }
  let identity: string
  if (e.tier !== undefined || e.plate_id !== undefined || e.honesty_en !== undefined || e.honesty_de !== undefined) {
    if (!['TIER1', 'TIER2'].includes(e.tier ?? '') || !e.honesty_en?.trim() || !e.honesty_de?.trim()
      || !e.plate_id || !e.source_url?.trim()
      || !(e.plate_id === e.work_id || e.plate_id.startsWith(`${e.work_id}:`))
      || !/^[a-z0-9-]+(?::[a-z0-9-]+)?$/.test(e.plate_id)
      || path[2] !== e.plate_id.replace(':', '-') || match[2] !== path[2]) {
      throw new Error(`Incomplete or mismatched painting policy: ${e.id}`)
    }
    identity = e.plate_id
  } else {
    const front = match[2] === e.work_id || match[2] === `${e.work_id}-obverse`
    const reverse = match[2] === `${e.work_id}-reverse`
    if ((!front && !reverse) || path[2] !== e.work_id || match[3] !== undefined) {
      throw new Error(`Unknown legacy painting face: ${e.id}`)
    }
    identity = reverse ? `${e.work_id}:reverse` : e.work_id
  }
  return { entry: e, pixels: { width, height }, identity,
    face: identity.endsWith(':reverse') ? 'reverse' : 'front', path: `${e.wing}/${e.path}` }
}

/** A deterministic, source-first ordering. Explicit store supersession is
 * applied before this ranking. Alternative documentary states stay distinct.
 * A plate another surviving plate was chosen over ranks behind every tier.
 */
function rank(plate: PolicyPicturePlate, outranked: ReadonlySet<string>): number {
  const tier = outranked.has(plate.plate.id) ? 30
    : plate.policyTier === 'TIER1' ? 0 : plate.policyTier === 'TIER2' ? 10 : 20
  const relationship = plate.relationship === 'primary' ? 0 : plate.relationship === 'reverse' ? 100
    : plate.relationship === 'historical-photograph' ? 200 : 300
  return tier + relationship
}

/** Resolve all surviving source identities, including store-only supplements.
 * Superseded scans remain in the public manifest, but are not display choices.
 * This function intentionally supplies no historical dimensions for a work
 * missing from the commissioned register.
 */
export function resolveManifestWorkPlates(workId: string, manifest: ManifestIndex): readonly PolicyPicturePlate[] {
  if (!WORK_ID.test(workId)) throw new Error(`Invalid painting work id: ${workId}`)
  const raw = manifest.all.filter(entry => {
    const e = entry as Partial<PolicyPaintingEntry>
    return e.work_id === workId && ['painting-preview', 'painting-plate'].includes(e.role ?? '')
    })
  const records = raw.map(entry => validatePaintingRecord(entry))
  const ids = new Set<string>()
  for (const record of records) {
    if (ids.has(record.entry.id)) throw new Error(`Duplicate painting manifest id: ${record.entry.id}`)
    ids.add(record.entry.id)
  }
  const full = records.filter(record => record.entry.role === 'painting-plate')
  const superseded = new Set<string>()
  for (const record of full) for (const id of record.entry.supersedes ?? []) {
    const target = manifest.byId.get(id) as PolicyPaintingEntry | undefined
    if (!record.entry.tier || !target || target.work_id !== workId || target.role !== 'painting-plate'
      || id === record.entry.id) throw new Error(`Invalid painting supersession: ${record.entry.id} -> ${id}`)
    superseded.add(id)
  }
  const surviving = full.filter(record => !superseded.has(record.entry.id))
  if (full.length && !surviving.length) throw new Error(`Cyclic painting supersession: ${workId}`)
  // A choice names a surviving plate of the same work and is itself tiered;
  // two plates choosing each other would leave no order to hang by.
  const outranked = new Set<string>()
  for (const record of surviving) for (const id of record.entry.chosen_over ?? []) {
    const target = surviving.find(candidate => candidate.entry.id === id)
    if (!record.entry.tier || !target || id === record.entry.id
      || (target.entry.chosen_over ?? []).includes(record.entry.id)) {
      throw new Error(`Invalid painting choice: ${record.entry.id} -> ${id}`)
    }
    outranked.add(id)
  }
  return surviving.map(record => {
    const matches = records.filter(candidate => candidate.entry.role === 'painting-preview'
      && candidate.identity === record.identity
      && candidate.entry.tier === record.entry.tier
      && candidate.entry.source_url === record.entry.source_url
      && candidate.entry.licence === record.entry.licence)
    if (matches.length !== 1) throw new Error(`Painting needs one matching preview: ${record.entry.id}`)
    const preview = matches[0]!
    // Both derivatives are rounded from the original. Compare in preview
    // pixels, where one pixel of rounding has the same meaning for a narrow
    // predella as for a portrait; an absolute aspect-ratio epsilon does not.
    const factor = Math.max(preview.pixels.width, preview.pixels.height) / Math.max(record.pixels.width, record.pixels.height)
    if (preview.pixels.width > record.pixels.width || preview.pixels.height > record.pixels.height
      || Math.abs(preview.pixels.width - record.pixels.width * factor) > 1.1
      || Math.abs(preview.pixels.height - record.pixels.height * factor) > 1.1
      || preview.entry.honesty_en !== record.entry.honesty_en || preview.entry.honesty_de !== record.entry.honesty_de) {
      throw new Error(`Painting preview changes the source: ${record.entry.id}`)
    }
    const relationship: PolicyPicturePlate['relationship'] = record.face === 'reverse' ? 'reverse'
      : record.identity.endsWith(':print-1844') ? 'independent-print'
      : record.identity.endsWith(':cook-historical') ? 'historical-photograph' : 'primary'
    return { id: record.entry.id.slice('vinci/painting-plate/'.length), workId, face: record.face,
      plateFile: record.entry.path, pixels: record.pixels, licenceLine: record.entry.licence,
      preview: preview.entry, plate: record.entry, identity: record.identity,
      policyTier: record.entry.tier ?? null, relationship }
  }).sort((a, b) => rank(a, outranked) - rank(b, outranked) || a.plate.id.localeCompare(b.plate.id))
}

/** Drop-in policy selection for the hang. The reverse belongs to Ginevra's
 * single panel; Salvator's separate states are accessible via alternatives.
 */
export function resolvePicturePolicy(work: PictureWork, manifest: ManifestIndex): PicturePolicySelection {
  const all = resolveManifestWorkPlates(work.id, manifest)
  // The legacy admission is still an explicit DG allowlist. The new policy
  // admits an old RC work only when an actual tiered source record exists.
  const admitted = all.filter(entry => entry.policyTier !== null || work.rights_class === 'DG')
  if (!admitted.length && work.rights_class === 'DG') throw new Error(`Missing admitted picture source: ${work.id}`)
  const primary = admitted.find(entry => entry.relationship === 'primary') ?? null
  const mainPlates = primary ? [primary, ...admitted.filter(entry => entry.relationship === 'reverse')] : []
  const mainIds = new Set(mainPlates.map(entry => entry.plate.id))
  const chosenOver = new Set(primary?.plate.chosen_over ?? [])
  return { primary, mainPlates, alternatives: admitted.filter(entry => !mainIds.has(entry.plate.id)), all: admitted,
    evidence: admitted.filter(entry => chosenOver.has(entry.plate.id)) }
}
