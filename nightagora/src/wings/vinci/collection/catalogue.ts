/** THE HANG'S CATALOGUE: what the band says of a work of the picture wall,
 * under the number cast on its frame. The number is the wall's own order
 * from the east door; the date and the holder are the register's words; the
 * certainty class is the label's own word, shown where the attribution is
 * not a plain one or the record names more than one hand. The word that says
 * the wall shows a reproduction is the card data's.
 */
import cardsRaw from '../data/cards.json?raw'
import { JOINT_WORK, policyCertainty } from '../pictures/policy-label'
import type { PictureWork, ResolvedPicturePlate } from '../pictures/register'
import { frameKey, hangNumber } from './picture-room-plan'

type Words = { en: string; de: string }
const PICTURE = (JSON.parse(cardsRaw) as { controls: { picture: { reproduction?: Words } } }).controls.picture

/** One work's entry: its number, its date, and where the original is, with
 * what the wall shows of it. */
export interface HangCatalogue {
  number: string
  date: string
  where: string
}

/** The attribution classes the band names beside the holder. */
const QUALIFIED = new Set(['disputed', 'qualified', 'workshop', 'copy'])
/** A hand the record names beside another is a person, not a shop or a rank. */
const NOT_A_HAND = /workshop|studio|follower|pupil|after|copy|attributed|disputed|circle|school/i

/** THE HANDS A RECORD NAMES in the first sentence of its attribution: a
 * documented work of two named hands is a joint work, and the band says so. */
export function namedHands(work: Pick<PictureWork, 'attribution_line_en'>): number {
  const first = (work.attribution_line_en ?? '').split(/(?<=[.!?])\s/)[0]!.replace(/[.!?]$/, '')
  return first.split(/\s*,\s*|\s+and\s+/).filter(part => part && !NOT_A_HAND.test(part)).length
}

export function hangCatalogue(work: PictureWork, face: 'front' | 'reverse' | null | undefined,
  entries: readonly ResolvedPicturePlate[], language: 'en' | 'de'): HangCatalogue | null {
  const number = hangNumber(frameKey(work.id, face ?? 'front'))
  if (number === null) return null
  const date = language === 'de' ? work.date_label_de : work.date_label_en
  const said = PICTURE.reproduction?.[language]
  const kind = QUALIFIED.has(work.attribution_certainty) ? policyCertainty(work, entries.length > 0, entries).word[language]
    : work.attribution_certainty === 'documented' && namedHands(work) > 1 ? JOINT_WORK[language] : null
  // the holder stays in the language it publishes its name in
  const where = [work.holder, said, kind].filter((part): part is string => Boolean(part)).join(' · ')
  return { number: String(number), date, where }
}
