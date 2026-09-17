/** THE LOBBY'S OFFER, next visit. A museum without accounts has one way to
 * carry a visit across a night: the recap waiting at the front door. Where a
 * record exists, the wing's own pane gains one line under its state line and
 * one control that enters the wing and opens the recap at once, with the
 * privacy sentence under it.
 *
 * IT IS OFF. The night on the device is the owner's decision, and the lobby
 * is another seat's surface, so this composes the offer and nothing calls it
 * yet. Turning it on is this constant and the two lines named in the seat's
 * status.
 */

import { readVisit } from '../visit'
import { RECAP_WORDS, VISIT_OFFER, visitOfferLine } from './words'

export const LOBBY_OFFER = false

export interface VisitOffer {
  /** one form and many, with the count written into the sentence */
  line: string
  /** the control that enters the wing and opens the recap */
  again: string
  privacy: string
  forget: string
  count: number
}

/** The offer for a wing, or null where the device holds no record of it. */
export function visitOffer(wing: string, language: 'en' | 'de'): VisitOffer | null {
  if (!LOBBY_OFFER) return null
  const record = readVisit(wing)
  const line = visitOfferLine(record?.opened.length ?? 0, language)
  if (!record || !line) return null
  return {
    line,
    again: VISIT_OFFER.again[language],
    privacy: RECAP_WORDS.privacy[language],
    forget: RECAP_WORDS.forget[language],
    count: record.opened.length,
  }
}
