/** The store's record shape for a drawn sheet, beside the painting plates.
 *
 * A sheet is not a painting: it has no measured aperture in the picture
 * register and it hangs in a modern carrier. Its admission is the same all
 * the same, and it is written down here rather than in the caller, so a room
 * can never widen what the stream accepts by passing its own rule.
 */
import type { ManifestEntry } from '../../../manifest';

export interface SheetManifestEntry extends ManifestEntry {
  readonly role: 'sheet-page' | 'sheet-thumb';
  readonly tier: 'TIER1' | 'TIER2';
  readonly honesty_en: string;
  readonly honesty_de: string;
  readonly sheet: string;
  readonly width: number;
  readonly height: number;
  readonly state_note?: string;
  readonly licence_obligations?: string;
}
export interface ValidatedSheetRecord {
  readonly entry: SheetManifestEntry;
  readonly pixels: { readonly width: number; readonly height: number };
  readonly identity: string;
  readonly path: string;
}

const DISPLAY_CLASSES = new Set(['CAPTURED', 'CC0', 'CC-BY', 'CC-BY-SA', 'PD-ART']);
const SHEET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Fail closed. The source_url is a citation, never an image endpoint; only
 * wing plus path forms a texture URL, and the record must carry the policy's
 * tier and both honesty lines before a single byte is requested. */
export function validateSheetRecord(entry: ManifestEntry, expectedRole?: SheetManifestEntry['role']): ValidatedSheetRecord {
  const e = entry as SheetManifestEntry;
  const match = /^vinci\/(sheet-page|sheet-thumb)\/([a-z0-9-]+)__([1-9]\d*)x([1-9]\d*)$/.exec(e.id);
  const path = /^sheets\/windsor\/(?:thumbs\/)?([a-z0-9-]+)__([1-9]\d*)x([1-9]\d*)\.jpg$/.exec(e.path ?? '');
  if (!match || !path || e.role !== match[1] || expectedRole && e.role !== expectedRole
    || e.wing !== 'wing-vinci' || e.display !== true || !DISPLAY_CLASSES.has(e.class)
    || !SHEET_ID.test(match[2]!) || path[1] !== match[2]
    || (e.role === 'sheet-thumb') !== e.path.startsWith('sheets/windsor/thumbs/')
    || !/^[a-f0-9]{64}$/.test(e.sha256 ?? '') || !e.licence?.trim()
    || !['TIER1', 'TIER2'].includes(e.tier) || !e.honesty_en?.trim() || !e.honesty_de?.trim()
    || !e.sheet?.trim() || !e.source_url?.trim()) {
    throw new Error(`Inadmissible sheet manifest record: ${e.id}`);
  }
  const width = Number(match[3]), height = Number(match[4]);
  if (width !== Number(path[2]) || height !== Number(path[3]) || width * height !== e.pixels
    || e.width !== width || e.height !== height
    || Math.max(width, height) > (e.role === 'sheet-thumb' ? 1024 : 4096)) {
    throw new Error(`Sheet dimensions disagree: ${e.id}`);
  }
  return { entry: e, pixels: { width, height }, identity: match[2]!, path: `${e.wing}/${e.path}` };
}
