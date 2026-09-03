/**
 * The crisis note a conversation is carrying, if any. Set from the worker's
 * response headers, read by the chat surface. Lives outside React like the
 * carried thread, so a send can raise it and the log can show it without
 * threading state through every layer in between.
 */

export type CrisisNoteKind = 'topical' | 'distress';

export interface CrisisNote {
  kind: CrisisNoteKind;
  /** ISO country code from the edge, null when unknown. */
  country: string | null;
}

export const CRISIS_NOTE_EVENT = 'agc:crisis-note';

/** Header the worker sets when the visitor sounds like they cannot go on. */
export const DISTRESS_HEADER = 'X-Distress';
/** Header the worker sets when the subject came up; value is a country code or 1. */
export const CRISIS_RESOURCES_HEADER = 'X-Crisis-Resources';

let current: CrisisNote | null = null;
let topicalDismissed = false;
let distressDismissed = false;

function emit(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CRISIS_NOTE_EVENT));
}

export function readCrisisNote(): CrisisNote | null {
  return current;
}

/**
 * Distress outranks topical and stays for the visit with this figure. Once the
 * visitor closed the banner it stays closed, even though the worker keeps
 * flagging the next turns. Topical shows once per conversation and not again
 * after the visitor closed it.
 */
export function raiseCrisisNote(kind: CrisisNoteKind, country: string | null): void {
  if (kind === 'distress') {
    if (distressDismissed || current?.kind === 'distress') return;
    current = { kind, country };
    emit();
    return;
  }
  if (current || topicalDismissed) return;
  current = { kind, country };
  emit();
}

export function dismissCrisisNote(): void {
  if (!current) return;
  if (current.kind === 'topical') topicalDismissed = true;
  if (current.kind === 'distress') distressDismissed = true;
  current = null;
  emit();
}

/**
 * A new conversation with the same figure starts without the topical line;
 * a distress banner and its dismissal carry across, they belong to the visit.
 */
export function resetConversationCrisisNote(): void {
  topicalDismissed = false;
  if (current?.kind === 'topical') current = null;
  emit();
}

/** A new figure starts clean. */
export function clearCrisisNote(): void {
  current = null;
  topicalDismissed = false;
  distressDismissed = false;
  emit();
}

export function subscribeCrisisNote(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CRISIS_NOTE_EVENT, listener);
  return () => window.removeEventListener(CRISIS_NOTE_EVENT, listener);
}

function countryFrom(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) && v !== 'XX' ? v : null;
}

/** Read the two headers off a worker response and raise the matching note. */
export function readCrisisHeaders(headers: Headers): void {
  const distress = headers.get(DISTRESS_HEADER);
  const resources = headers.get(CRISIS_RESOURCES_HEADER);
  if (distress) {
    raiseCrisisNote('distress', countryFrom(resources));
    return;
  }
  if (resources) raiseCrisisNote('topical', countryFrom(resources));
}
