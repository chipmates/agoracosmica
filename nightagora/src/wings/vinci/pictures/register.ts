/** The immutable collection supplies every visitor word and every measurement.
 * Audit filenames are evidence, never URLs. Only displayPlates + a manifest
 * work_id join may produce a texture request.
 */
import { resolvePicturePolicy } from './policy';
import lockedSource from './data/paintings.json?raw';
import type { ManifestEntry, ManifestIndex } from '../../../manifest';

export type PictureLanguage = 'en' | 'de';
export type PictureRights = 'DG' | 'RC' | 'REF';
export type PictureAttribution = 'documented' | 'disputed' | 'qualified' | 'workshop' | 'copy';
export type PictureWall = 'picture-room-main' | 'picture-room-drawer' | 'supper-wall' | 'supper-wall-drawer';
export type PictureDisplayMode = 'absence_outline' | 'reproduction_card_beside_measured_outline'
  | 'dimension_card_and_two_empty_image_wells' | 'drawer_crop_beside_empty_full_sheet_outline'
  | 'unillustrated_catalogue_card';

export interface PicturePixels { readonly width: number; readonly height: number }
export interface PictureSource {
  readonly url: string;
  readonly supports: readonly string[];
  readonly local_source?: string;
  readonly verification?: string;
}
export interface PictureMeasurement {
  readonly source_url: string;
  readonly status: string;
  readonly extent: string;
  readonly registration: string;
  readonly alternatives: readonly {
    readonly height_cm: number;
    readonly width_cm: number;
    readonly note: string;
    readonly source_url: string;
  }[];
  readonly original_thickness_cm?: number;
  readonly room_width_m?: number;
  readonly room_length_m?: number;
  readonly source_values?: { readonly height_in: number; readonly width_in: number };
  readonly conversion?: string;
}
export interface AdditionalPicturePlate {
  readonly plate_file: string;
  readonly plate_pixels: PicturePixels;
  readonly licence_line: string;
  readonly rights_class: 'DG';
  readonly rights_row: string;
  readonly role: 'reverse_of_same_panel';
  readonly inventory: string;
  readonly source_url: string;
}
export interface PictureWork {
  readonly id: string;
  readonly catalogue_number: number | null;
  readonly register_status: 'concept_register' | 'additional_catalogue_work';
  readonly title_en: string;
  readonly title_de: string;
  readonly holder: string;
  readonly inventory: string | null;
  readonly height_cm: number | null;
  readonly width_cm: number | null;
  readonly medium: string | null;
  readonly support: string | null;
  readonly medium_de: string | null;
  readonly support_de: string | null;
  readonly date_from: number | null;
  readonly date_to: number | null;
  readonly date_certainty: 'documented' | 'approximate' | 'disputed' | 'unknown';
  readonly date_label_en: string;
  readonly date_label_de: string;
  readonly date_note_en?: string;
  readonly date_note_de?: string;
  readonly attribution_line_en: string;
  readonly attribution_line_de: string;
  readonly attribution_certainty: PictureAttribution;
  readonly certainty_word_en: string;
  readonly certainty_word_de: string;
  readonly rights_class: PictureRights;
  readonly plate_file: string | null;
  readonly plate_pixels: PicturePixels | null;
  readonly licence_line: string | null;
  readonly absence_reason_en: string | null;
  readonly absence_reason_de: string | null;
  readonly label_first_line_en: string;
  readonly label_first_line_de: string;
  readonly hang: { readonly wall: PictureWall | null; readonly order: number | null; readonly eye_height_cm: number | null };
  readonly in_house_1517: boolean;
  readonly de_beatis: {
    readonly date: string;
    readonly quote_it: string;
    readonly quote_source: string;
    readonly source_url: string;
    readonly identification_certainty: 'inferred';
    readonly note_en: string;
    readonly note_de: string;
  } | null;
  readonly facts: readonly { readonly text_en: string; readonly text_de: string; readonly source_url: string; readonly certainty: string }[];
  readonly sources: readonly PictureSource[];
  readonly rights_basis: { readonly row: string | null; readonly decision: string };
  readonly held_scan_files: readonly string[];
  readonly clearance_sentence_en: string | null;
  readonly clearance_sentence_de: string | null;
  readonly additional_plates: readonly AdditionalPicturePlate[];
  readonly display_mode: PictureDisplayMode;
  readonly measurement: PictureMeasurement;
  readonly reproduction_note_en: string;
  readonly reproduction_note_de: string;
  readonly gaps: readonly string[];
}

interface LockedRegister { readonly works: readonly PictureWork[] }
const locked = JSON.parse(lockedSource) as LockedRegister;
const seen = new Set<string>();
for (const work of locked.works) {
  if (!work.id || seen.has(work.id)) throw new Error(`Invalid or duplicate picture id: ${work.id}`);
  seen.add(work.id);
  if (!work.label_first_line_en || !work.label_first_line_de) throw new Error(`Missing locked bilingual label: ${work.id}`);
  if (work.rights_class !== 'DG' && (work.plate_file !== null || work.plate_pixels !== null || work.additional_plates.length)) {
    throw new Error(`Excluded picture exposes a display path: ${work.id}`);
  }
  if ((work.height_cm === null) !== (work.width_cm === null)) throw new Error(`Incomplete dimensions: ${work.id}`);
  if (work.hang.wall === 'picture-room-main' && work.hang.eye_height_cm !== 155) throw new Error(`Main-wall datum is not 155 cm: ${work.id}`);
}

/** Exact locked work objects, with no rewritten label or dimension fields. */
export const REGISTER: readonly PictureWork[] = Object.freeze(locked.works);
export const MAIN_HANG: readonly PictureWork[] = Object.freeze(REGISTER
  .filter(work => work.hang.wall === 'picture-room-main')
  .slice().sort((a, b) => (a.hang.order ?? 0) - (b.hang.order ?? 0)));
const byId = new Map(REGISTER.map(work => [work.id, work]));
export function getWork(id: string): PictureWork {
  const work = byId.get(id);
  if (!work) throw new Error(`Unknown picture: ${id}`);
  return work;
}

export interface PictureSegment {
  readonly id: string;
  readonly title: string;
  readonly titleDe: string;
  readonly workIds: readonly string[];
  readonly initialWorkId: string;
  readonly kind: 'hang' | 'inspection' | 'drawer' | 'murals';
  /** Source/order explanation for the audit, not authored visitor copy. */
  readonly note: string;
}
const mainIds = (...orders: number[]): readonly string[] => MAIN_HANG
  .filter(work => orders.includes(work.hang.order ?? -1)).map(work => work.id);

/** The six commissioned rig views remain present. Additional views make all
 * thirty records selectable. Inspecting absences does not reorder MAIN_HANG.
 * No painting in this locked register is held at Windsor: inventing one to
 * match that shorthand in the commission would violate the locked register.
 */
export const SEGMENTS: readonly PictureSegment[] = Object.freeze([
  { id: 'early', title: 'Early Florence', titleDe: 'Frühes Florenz', workIds: mainIds(1, 2, 3, 4, 5), initialWorkId: 'ginevra-de-benci', kind: 'hang', note: 'Main orders 1–5. Arrival focus is Ginevra; earlier work remains reachable.' },
  { id: 'milan', title: 'Milan', titleDe: 'Mailand', workIds: mainIds(9, 10, 11, 12, 13, 14), initialWorkId: 'virgin-of-the-rocks-louvre', kind: 'hang', note: 'Main orders 9–14. Both Rocks versions retain their different dimensions and rights.' },
  { id: 'florence', title: 'Return to Florence', titleDe: 'Rückkehr nach Florenz', workIds: mainIds(15, 16, 17, 18, 19, 20), initialWorkId: 'yarnwinder-buccleuch', kind: 'hang', note: 'Main orders 15–20. Anghiari follows locked hang.order; the sheet is a later copy, not the lost mural.' },
  { id: 'late', title: 'The late paintings', titleDe: 'Die späten Gemälde', workIds: mainIds(18, 21, 22, 23, 24), initialWorkId: 'virgin-and-child-with-st-anne', kind: 'hang', note: 'Main orders 18, 21–24. Saint Anne repeats for the commissioned late view.' },
  { id: 'absences', title: 'The newly available pictures', titleDe: 'Die neu verfügbaren Bilder', workIds: mainIds(2, 6, 7, 8, 22), initialWorkId: 'benois-madonna', kind: 'inspection', note: 'Bench inspection of five works admitted by the new source policy. MAIN_HANG stays interleaved by date. The historical route id is retained.' },
  { id: 'signature', title: 'Mona Lisa', titleDe: 'Mona Lisa', workIds: ['mona-lisa'], initialWorkId: 'mona-lisa', kind: 'inspection', note: 'The locked 79.4 × 53.4 cm field at 1.55 m, displaying the admitted historical printed reproduction.' },
  { id: 'drawer', title: "Portrait of Isabella d'Este", titleDe: "Bildnis der Isabella d'Este", workIds: ['isabella-deste-cartoon'], initialWorkId: 'isabella-deste-cartoon', kind: 'drawer', note: 'The selected complete-sheet reproduction within the locked 61 × 46.5 cm field; native resolution and unregistered source edges remain explicit.' },
  { id: 'murals', title: 'The walls and the lost pictures', titleDe: 'Die Wände und die verlorenen Bilder', workIds: ['last-supper', 'sala-delle-asse', 'leda-spiridon', 'tavola-doria', 'leda-wilton'], initialWorkId: 'last-supper', kind: 'murals', note: 'Supper wall order 1–2, then its drawer order 1–3. The Sala has no measured outline; dates of the two copy records remain qualified or unknown.' },
  { id: 'complete-hang', title: 'The complete hang', titleDe: 'Die vollständige Hängung', workIds: [...MAIN_HANG.map(work => work.id), 'isabella-deste-cartoon'], initialWorkId: 'lady-with-an-ermine', kind: 'inspection', note: 'Budget inspection: 24 main works plus Isabella, 26 main-source previews including Ginevra’s second face, and at most one earned full plate. All assemblies stay mounted; the camera visits one at a time.' },
  { id: 'materials', title: 'Furniture and materials', titleDe: 'Ausstattung und Materialien', workIds: ['mona-lisa'], initialWorkId: 'mona-lisa', kind: 'inspection', note: 'Additional generated material evidence view with its own verified wider room. The painting assembly is hidden. Controlled pairs are library-default and actual production shaders on equal geometry.' },
]);
const segmentsById = new Map(SEGMENTS.map(segment => [segment.id, segment]));
export function getSegment(id: string): PictureSegment {
  const segment = segmentsById.get(id);
  if (!segment) throw new Error(`Unknown picture segment: ${id}`);
  return segment;
}
export const segmentWorks = (id: string): readonly PictureWork[] => getSegment(id).workIds.map(getWork);

export interface DisplayPicturePlate {
  readonly id: string;
  readonly workId: string;
  readonly face: 'front' | 'reverse';
  readonly plateFile: string;
  readonly pixels: PicturePixels;
  readonly licenceLine: string;
}

/** The only media allowlist. Audit-only held_scan_files are never consulted. */
export function displayPlates(work: PictureWork): readonly DisplayPicturePlate[] {
  if (work.rights_class !== 'DG') return [];
  if (!work.plate_file || !work.plate_pixels || !work.licence_line) throw new Error(`DG record has no explicit plate or licence: ${work.id}`);
  return [{
    id: work.id === 'ginevra-de-benci' ? `${work.id}-obverse` : work.id,
    workId: work.id, face: 'front', plateFile: work.plate_file,
    pixels: work.plate_pixels, licenceLine: work.licence_line,
  }, ...work.additional_plates.map(plate => ({
    id: `${work.id}-reverse`, workId: work.id, face: 'reverse' as const,
    plateFile: plate.plate_file, pixels: plate.plate_pixels, licenceLine: plate.licence_line,
  }))];
}

export interface PaintingManifestEntry extends ManifestEntry {
  readonly work_id: string;
  readonly role: 'painting-preview' | 'painting-plate';
}
export interface ResolvedPicturePlate extends DisplayPicturePlate {
  readonly preview: PaintingManifestEntry;
  readonly plate: PaintingManifestEntry;
}
/** Fail closed on missing joins, a face mismatch, or reference-only content.
 * The source_url is citation metadata; the texture URL uses wing + path.
 */
export function findPlateEntries(work: PictureWork, manifest: ManifestIndex): readonly ResolvedPicturePlate[] {
  return resolvePicturePolicy(work, manifest).mainPlates;
}
/** The admitted plates the hung one was chosen over: evidence for the record,
 * never a face on the wall. */
export function findEvidencePlates(work: PictureWork, manifest: ManifestIndex): readonly ResolvedPicturePlate[] {
  return resolvePicturePolicy(work, manifest).evidence;
}

/** Unregistered reproduction cards are display furniture. Their dimensions
 * never substitute for the work's measured aperture in a scale report. */
export function reproductionCardSize(work: PictureWork, pixels: PicturePixels): { widthM: number; heightM: number } {
  const availableHeight = (work.height_cm ?? 61) / 100;
  const availableWidth = (work.width_cm ?? 46.5) / 100;
  const metresPerPixel = Math.min(availableWidth / pixels.width, availableHeight / pixels.height);
  return { heightM: pixels.height * metresPerPixel, widthM: pixels.width * metresPerPixel };
}
