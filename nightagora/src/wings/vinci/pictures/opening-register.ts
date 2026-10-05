/** THE OPENING'S DRAWING. The wing opens on one sheet held off the wall, so
 * its record stands beside the locked paintings register instead of inside
 * it: the work, the holder, the date, the reproduction's tier, and the lines
 * its label prints. The card and the store record are both checked against
 * this one entry, and a store record that disagrees is never shown. Its
 * data lives in data/opening-drawings.json, as the paintings' does in theirs.
 */
import drawingsSource from './data/opening-drawings.json?raw'

export interface OpeningBilingual { readonly en: string; readonly de: string }

export interface OpeningPhotograph {
  /** the photographer as the source names them; credited though PD-self does not ask it */
  readonly by: string
  readonly licence_template: 'PD-self'
  /** the manifest's licence line, verbatim */
  readonly licence_line: string
  /** EDTF day of the capture, from the file page and its EXIF */
  readonly taken: string
  readonly taken_label: OpeningBilingual
  readonly file: string
  readonly commons_pageid: number
  readonly source_url: string
  readonly original_url: string
  /** of the original as the source serves it, checked at the fetch */
  readonly sha1: string
  readonly width: number
  readonly height: number
}

export interface OpeningDrawing {
  readonly id: string
  /** the store record the card hangs; each of its files is named by the stem and its own size */
  readonly manifest_id: string
  readonly role: 'opening-plate'
  readonly path_stem: string
  readonly title: OpeningBilingual
  readonly maker: string
  /** EDTF */
  readonly date: string
  readonly date_label: OpeningBilingual
  readonly date_certainty: 'documented'
  readonly date_source: string
  readonly holder: OpeningBilingual
  readonly holder_type: 'italian-state'
  readonly inventory: OpeningBilingual
  readonly tier: 'TIER2'
  readonly class: 'PD-ART'
  readonly photograph: OpeningPhotograph
  /** what was done to the photograph, each step a non-creative correction */
  readonly correction: { readonly kind: 'non-creative'; readonly steps: readonly OpeningBilingual[] }
  readonly rights: {
    readonly decision: string
    readonly basis: readonly string[]
    readonly residual_risk: string
    readonly open_points: readonly string[]
  }
}

/** RIGHTS-POLICY.md, Tier 2, worded for a drawing as the wing's sheets are. */
export const TIER2_DRAWING_HONESTY: OpeningBilingual = Object.freeze({
  en: 'Public domain work. Reproduction from Wikimedia Commons. The museum labels the reproduction, not the drawing. Non-profit cultural use.',
  de: 'Gemeinfreies Werk. Reproduktion aus Wikimedia Commons. Das Museum kennzeichnet die Reproduktion, nicht die Zeichnung. Kulturelle Nutzung ohne Gewinnabsicht.',
})

/** An Italian state-held work names the code and the exemption it rests on. */
export const ITALIAN_CODE_LINE: OpeningBilingual = Object.freeze({
  en: 'Italian Codice dei beni culturali, art. 108 comma 3-bis: exemption for non-profit study, research and promotion of knowledge of the cultural heritage.',
  de: 'Italienischer Codice dei beni culturali, Art. 108 comma 3-bis: Ausnahme für Studium, Forschung und Förderung der Kenntnis des Kulturerbes, jeweils ohne Gewinnabsicht.',
})

interface OpeningDrawingsFile { readonly drawings: readonly OpeningDrawing[] }
const FIXED: ReadonlyArray<[keyof OpeningDrawing, string]> = [['role', 'opening-plate'], ['tier', 'TIER2'], ['class', 'PD-ART'], ['date_certainty', 'documented']]
/** The data file is read, never trusted: the fields the label rests on are
 * checked here, so an edit that breaks one fails at load, not on a card. */
function drawingFrom(raw: OpeningDrawing): OpeningDrawing {
  for (const [key, value] of FIXED) if (raw[key] !== value) throw new Error(`Opening drawing ${raw.id}: ${key} is not ${value}`)
  if (raw.photograph?.licence_template !== 'PD-self' || !/^[a-f0-9]{40}$/.test(raw.photograph.sha1 ?? '')) {
    throw new Error(`Opening drawing ${raw.id}: its photograph is not the recorded PD-self file`)
  }
  if (raw.correction?.kind !== 'non-creative' || !raw.correction.steps?.length) throw new Error(`Opening drawing ${raw.id}: no correction record`)
  for (const text of [raw.title, raw.holder, raw.inventory, raw.date_label, raw.photograph.taken_label]) {
    if (!text?.en?.trim() || !text.de?.trim()) throw new Error(`Opening drawing ${raw.id}: a bilingual field is empty`)
  }
  if (!raw.photograph.by.trim() || !raw.photograph.licence_line.includes(raw.photograph.by)) {
    throw new Error(`Opening drawing ${raw.id}: the photographer is not credited`)
  }
  return Object.freeze(raw)
}
const DRAWINGS = (JSON.parse(drawingsSource) as OpeningDrawingsFile).drawings.map(drawingFrom)
const byId = (id: string): OpeningDrawing => {
  const found = DRAWINGS.find(drawing => drawing.id === id)
  if (!found) throw new Error(`Unknown opening drawing: ${id}`)
  return found
}
export const ARNO_1473: OpeningDrawing = byId('arno-1473')

/** THE LABEL'S HONESTY LINE, as the store record carries it: the work, the
 * policy's Tier 2 sentences, the photograph, the correction, the holder, the
 * code. One function writes it so the card and the record cannot drift. */
export function openingHonesty(drawing: OpeningDrawing): OpeningBilingual {
  const line = (language: 'en' | 'de'): string => {
    const photo = drawing.photograph
    const credit = language === 'en'
      ? `Photograph by ${photo.by}, ${photo.taken_label.en}, released into the public domain by the photographer (${photo.licence_template}).`
      : `Aufnahme von ${photo.by}, ${photo.taken_label.de}, vom Fotografen gemeinfrei gestellt (${photo.licence_template}).`
    const corrected = language === 'en'
      ? 'Perspective corrected and cropped to the visible sheet, a non-creative correction, no retouching.'
      : 'Perspektive entzerrt und auf das sichtbare Blatt beschnitten, eine nicht schöpferische Korrektur, ohne Retusche.'
    const holder = language === 'en'
      ? `Holder: ${drawing.holder.en}, ${drawing.inventory.en}.`
      : `Sammlung: ${drawing.holder.de}, ${drawing.inventory.de}.`
    return [`${drawing.title[language]}. ${drawing.maker}, ${drawing.date_label[language]}.`,
      TIER2_DRAWING_HONESTY[language], credit, corrected, holder,
      ...(drawing.holder_type === 'italian-state' ? [ITALIAN_CODE_LINE[language]] : [])].join(' ')
  }
  return { en: line('en'), de: line('de') }
}

/** The label as the card's record shows it: the honesty line, then the
 * code line as its own paragraph. The correction's steps stay in the record
 * and the store's note; the label names the correction once. */
export function openingLabel(drawing: OpeningDrawing, language: 'en' | 'de'): readonly string[] {
  const honesty = openingHonesty(drawing)[language]
  const code = drawing.holder_type === 'italian-state' ? ITALIAN_CODE_LINE[language] : ''
  const body = code ? honesty.slice(0, honesty.length - code.length).trimEnd() : honesty
  return [body, ...(code ? [code] : [])]
}

export interface OpeningFile { readonly path: string; readonly width: number; readonly height: number; readonly sha256: string; readonly bytes: number }
export interface OpeningAdmission { readonly ok: boolean; readonly reason: string; readonly files: readonly OpeningFile[] }

const HEX64 = /^[a-f0-9]{64}$/
function openingFile(record: unknown, stem: string): OpeningFile | string {
  const r = record as Partial<OpeningFile> | null
  if (!r || typeof r !== 'object') return 'a file record is not an object'
  const named = typeof r.path === 'string' ? new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}__([1-9]\\d*)x([1-9]\\d*)\\.jpg$`).exec(r.path) : null
  if (!named) return `${String(r.path)} is not named ${stem}__<w>x<h>.jpg`
  if (Number(named[1]) !== r.width || Number(named[2]) !== r.height) return `${r.path} disagrees with its own size`
  if (!HEX64.test(r.sha256 ?? '')) return `${r.path} carries no sha256`
  if (!Number.isSafeInteger(r.bytes) || (r.bytes ?? 0) <= 0) return `${r.path} carries no byte count`
  return r as OpeningFile
}

/** THE STORE RECORD ADMITTED, OR NOT. Every field the label rests on must
 * equal this register's, so an edited record is refused rather than shown
 * under a label it no longer matches. The files come back smallest first. */
export function admitOpeningRecord(entry: unknown, drawing: OpeningDrawing): OpeningAdmission {
  const refuse = (reason: string): OpeningAdmission => ({ ok: false, reason, files: [] })
  const e = entry as Record<string, unknown> | undefined
  if (!e || typeof e !== 'object') return refuse(`no store record ${drawing.manifest_id}`)
  const honesty = openingHonesty(drawing)
  if (e['id'] !== drawing.manifest_id) return refuse(`the record is ${String(e['id'])}`)
  if (e['role'] !== drawing.role) return refuse(`role ${String(e['role'])}`)
  if (e['display'] !== true) return refuse('display is not true')
  if (e['class'] !== drawing.class) return refuse(`class ${String(e['class'])}`)
  if (e['tier'] !== drawing.tier) return refuse(`tier ${String(e['tier'])}`)
  if (e['honesty_en'] !== honesty.en || e['honesty_de'] !== honesty.de) return refuse('the honesty lines differ from the register')
  if (e['licence'] !== drawing.photograph.licence_line) return refuse('the licence line differs from the register')
  if (e['source_url'] !== drawing.photograph.source_url) return refuse('the source differs from the register')
  if (e['source_sha1'] !== drawing.photograph.sha1) return refuse('the source hash differs from the register')
  const main = openingFile(e, drawing.path_stem)
  if (typeof main === 'string') return refuse(main)
  const previews = Array.isArray(e['previews']) ? e['previews'] : []
  const files: OpeningFile[] = [main]
  for (const preview of previews) {
    const file = openingFile(preview, drawing.path_stem)
    if (typeof file === 'string') return refuse(file)
    // every size is the same sheet: one pixel of rounding, never another crop
    if (Math.abs(file.width / file.height - main.width / main.height) > 2 / Math.min(file.width, file.height)) {
      return refuse(`${file.path} is not the same crop`)
    }
    if (file.width >= main.width) return refuse(`${file.path} is not smaller than the plate`)
    files.push(file)
  }
  if (main.width > drawing.photograph.width || main.height > drawing.photograph.height) return refuse('the plate is larger than its source')
  return { ok: true, reason: '', files: files.sort((a, b) => a.width - b.width) }
}
