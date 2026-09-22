/* THE LIKENESSES on the wheel's panes. The museum shows no generated image
   of a person: each pane hangs a public-domain likeness out of the asset
   store, or it shows the name alone. A record is admitted by the rights
   policy at Tier 1 or Tier 2, and what the pane prints under the picture is
   the record's own label, verbatim, with the Tier 2 honesty sentence and the
   Italian code line as its second line where the record carries them.

   Only the store's own address helper ever forms an image URL here.
   `source_url` in a record cites the holder's page and is never fetched. */

import { loadManifest, type ManifestEntry } from '../manifest'
import { assetAddress } from '../stack/materials'
import type { Lang } from '../wings/content'

/** one measured file of a record: the original, a preview, a crop. Each file
    is hashed on its own, so a preview re-encoded at the same size still
    changes the address the pane hangs. */
export interface LikenessFile {
  path: string
  width: number
  height: number
  sha256?: string
}

/** a likeness record as the store writes it. The rights fields the pane
    prints are the ones the data pass measured and quoted; the accession, the
    hashes and the verification notes stay in the record and off the frame. */
export interface LikenessRecord extends ManifestEntry {
  slug: string
  tier: number
  label_en: string
  label_de: string
  honesty_en?: string
  honesty_de?: string
  italian_state_en?: string
  italian_state_de?: string
  previews?: LikenessFile[]
}

/** what the pane needs to hang one: the plate and the credit under it */
export interface PaneLikeness {
  id: string
  src: string
  srcset: string
  width: number
  height: number
  /** the record's label: maker and date, holder, the licence line verbatim */
  credit: string
  /** the honesty sentence, and the code line where one applies */
  note: string
}

const PREFIX = 'lobby/likeness-'

let held: Map<string, LikenessRecord> | null = null

/** every likeness the store admits, by figure slug. Resolves once; a record
    that may not be displayed never reaches a pane. */
export async function loadLikenesses(): Promise<Map<string, LikenessRecord>> {
  if (held) return held
  const index = await loadManifest()
  const out = new Map<string, LikenessRecord>()
  for (const entry of index.all) {
    if (!entry.id.startsWith(PREFIX) || !entry.display) continue
    const record = entry as LikenessRecord
    const slug = record.slug || entry.id.slice(PREFIX.length)
    if (slug) out.set(slug, record)
  }
  held = out
  return out
}

const longEdge = (file: LikenessFile): number => Math.max(file.width, file.height)

/** the previews in ascending size: the pane hangs a preview, never the
    original, and never an upscale of one */
const previewsOf = (record: LikenessRecord): LikenessFile[] =>
  (record.previews ?? []).filter((p) => p.width > 0 && p.height > 0).sort((a, b) => longEdge(a) - longEdge(b))

/** the record's label with the honesty sentence and the code line taken off
    its end: those two stand as the credit's own second line */
export function likenessCredit(record: LikenessRecord, language: Lang): { credit: string; note: string } {
  const label = language === 'de' ? record.label_de : record.label_en
  const honesty = language === 'de' ? record.honesty_de : record.honesty_en
  const code = language === 'de' ? record.italian_state_de : record.italian_state_en
  let credit = label ?? ''
  for (const tail of [code, honesty]) {
    if (tail && credit.endsWith(tail)) credit = credit.slice(0, credit.length - tail.length).trim()
  }
  return { credit, note: [honesty, code].filter(Boolean).join(' ') }
}

/** the plate and its credit, or null when the record carries no preview */
export function paneLikeness(record: LikenessRecord, language: Lang): PaneLikeness | null {
  const previews = previewsOf(record)
  const hang = previews[previews.length - 1]
  if (!hang) return null
  const url = (file: LikenessFile): string => assetAddress({ ...file, wing: record.wing })
  const { credit, note } = likenessCredit(record, language)
  return {
    id: record.id,
    src: url(hang),
    srcset: previews.map((p) => `${url(p)} ${p.width}w`).join(', '),
    width: hang.width,
    height: hang.height,
    credit,
    note,
  }
}
