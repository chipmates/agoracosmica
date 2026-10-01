/* THE LIFE THIS WING HOLDS, read from the records it already carries: the 56
   dates with their own calendar and sentences, the register's painted works
   by the years it dates them to, the people those dates name, and the record
   behind one date. Nothing here reads the scene, so a wing without one (the
   film) composes the same life the live wing composes in its own closure. */

import cardsSource from './data/cards.json?raw'
import { lang } from '../content'
import { vinciContent, vinciHourValues, vinciLifeBands, vinciLifeCertaintyCounted, vinciLifeCut, vinciLifeFloorCount, vinciLifeHourMark,
  vinciLifePeople, vinciLifeSecondLine, vinciLifeWorksCount, vinciLifeWorksEmpty, vinciLifeWorksRow, vinciThroughLine, type VinciText } from './content'
import { LINE_SECTIONS, LINE_STUDS, type Stud } from './line/studs'
import { CIRCA_YEARS, ageAt, studBounds, studEdtf, studLimits } from './line/edtf'
import { SOURCE_READINGS } from './line/bench/visitor-sources'
import { CERTAINTY as LINE_CERTAINTY } from './line/lettering'
import { REGISTER } from './pictures/register'
import { capitalise, fill, spokenCount } from '../life/words'
import { dateYears } from '../life/scale'
import type { LifeBand, LifeEvent, LifePerson, LifeRecord, LifeWork, MuseumDate, Sure } from '../life/types'

/** THE TWELVE DATES THE FLOOR CUTS: three rows of four, the walk's own. */
export const VINCI_LIFE_CUT: ReadonlySet<string> = new Set(LINE_SECTIONS.flatMap(section => [0, 1, 2, 3].map(offset => LINE_STUDS[section.selected + offset]?.id ?? '')))
const BIRTH = LINE_STUDS.find(stud => stud.id === 'life-01')!, DEATH = LINE_STUDS.find(stud => stud.id === 'life-41')!
const CARDS = JSON.parse(cardsSource) as { controls: { shared: { back: VinciText }; machine: { provenance: VinciText }; date: { age: VinciText; age_about: VinciText } } }
const AGE_WORDS = { exact: CARDS.controls.date.age, about: CARDS.controls.date.age_about }
const SURE_RANK: Record<string, number> = { documented: 2, inferred: 1, tradition: 0 }
/** a key the wing does not rank stands under every one it does */
const sureRank = (key: string): number => SURE_RANK[key] ?? -1
/** a day and a year apart, the widest span an age may be said about */
const YEAR_MS = 366 * 864e5

export const vinciLifeStud = (id: string): Stud | undefined => LINE_STUDS.find(stud => stud.id === id)

function lifeDate(stud: Stud): MuseumDate {
  const bounds = studBounds(stud), limits = studLimits(stud)
  return { edtf: studEdtf(stud), calendar: stud.calendar, earliest: bounds.earliest, latest: bounds.latest,
    label: { en: stud.date_label_en, de: stud.date_label_de },
    // the date's own certainty, where the record says it differs from the event's
    certainty: (stud.date_certainty ?? stud.certainty) as Sure,
    ...(stud.date_precision === 'circa' ? { approximate: true, limits } : {}),
    ...(stud.date_precision === 'disputed' ? { disputed: true } : {}),
    ...(stud.date_note_en && stud.date_note_de ? { note: { en: stud.date_note_en, de: stud.date_note_de } } : {}) }
}

/** THE AGE BESIDE A YEAR: exact where every day the date can mean gives the
    same one, about where a year or a season gives two (counted at its last
    day), nothing where the span is wider than a year or the life has ended. */
function lifeAge(stud: Stud): { age: number | null; about: boolean } {
  const exact = ageAt(stud, BIRTH, DEATH)
  if (exact !== null) return { age: exact, about: false }
  const { earliest, latest } = studBounds(stud)
  if (!earliest || !latest || stud.calendar !== BIRTH.calendar || earliest < BIRTH.date || latest > DEATH.date) return { age: null, about: false }
  if (Date.parse(`${latest}T00:00:00Z`) - Date.parse(`${earliest}T00:00:00Z`) > YEAR_MS) return { age: null, about: false }
  const [by, bm, bd] = BIRTH.date.split('-').map(Number), [y, m, d] = latest.split('-').map(Number)
  const years = y! - by! - (m! < bm! || (m === bm && d! < bd!) ? 1 : 0)
  return years > 0 ? { age: years, about: true } : { age: null, about: false }
}

/** THE WORKS ROW: the register's paintings by the span it dates them to; a
    work stands on the row with the door to its wall where `hangs` says the
    wing can show it. */
function lifeWorks(hangs: (exhibit: string) => boolean): LifeWork[] {
  return REGISTER.map(work => {
    const from = work.date_from, to = work.date_to ?? work.date_from
    const sure: Sure = work.date_certainty === 'documented' ? 'documented' : 'inferred'
    const mark = work.date_certainty === 'documented' ? '' : work.date_certainty === 'disputed' ? '?' : '~'
    const front = `picture/${work.id}/front`
    return { id: work.id, title: { en: work.title_en, de: work.title_de }, domain: 'painting',
      state: work.rights_class === 'DG' ? 'reproduction' : 'absent',
      exhibit: hangs(front) ? front : null,
      date: from === null || to === null ? null : { edtf: from === to ? `${from}${mark}` : `${from}${mark}/${to}${mark}`,
        calendar: 'Gregorian', earliest: `${from}-01-01`, latest: `${to}-12-31`,
        label: { en: work.date_label_en, de: work.date_label_de }, certainty: sure } }
  })
}

export function vinciLifeRecord(hangs: (exhibit: string) => boolean): LifeRecord {
  const events: LifeEvent[] = []
  for (const band of vinciLifeBands) {
    const first = LINE_STUDS.findIndex(stud => stud.id === band.from), last = LINE_STUDS.findIndex(stud => stud.id === band.to)
    if (first < 0 || last < first) continue
    for (const stud of LINE_STUDS.slice(first, last + 1)) {
      const { age, about } = lifeAge(stud)
      events.push({ id: stud.id, band: band.id, date: lifeDate(stud), certainty: stud.certainty as Sure,
        line: { en: stud.line_en, de: stud.line_de }, source: SOURCE_READINGS[stud.id] ?? null, age, ageApproximate: about,
        walk: VINCI_LIFE_CUT.has(stud.id) ? { stud: `stud/${stud.id}` } : { station: stud.station }, exhibit: null,
        people: vinciLifePeople.filter(person => person.events.includes(stud.id)).map(person => person.id) })
    }
  }
  const bands: LifeBand[] = []
  for (const band of vinciLifeBands) {
    const own = events.filter(event => event.band === band.id)
    if (!own.length) continue
    const from = own[0]!.date, to = own[own.length - 1]!.date
    // a period is declared, not measured; the rows after the death run on their own clock
    const reach = own.map(event => dateYears(event.date)).filter(Boolean) as { from: number; to: number }[]
    const years = band.years ?? { from: Math.min(...reach.map(span => span.from)), to: Math.max(...reach.map(span => span.to)) }
    bands.push({ id: band.id, name: band.name, place: band.place, line: band.line, from, to, years,
      ...(band.afterlife ? { afterlife: true as const } : {}) })
  }
  const people: LifePerson[] = vinciLifePeople.map(person => ({ id: person.id, name: person.name, role: person.role,
    events: person.events,
    certainty: person.events.reduce<Sure>((best, id) => {
      const kind = (vinciLifeStud(id)?.certainty ?? 'tradition') as Sure
      return sureRank(kind) > sureRank(best) ? kind : best
    }, 'tradition') }))
  const sure = Object.fromEntries((Object.keys(vinciLifeCertaintyCounted) as (keyof typeof vinciLifeCertaintyCounted)[]).map(key =>
    [key, { word: { en: LINE_CERTAINTY[key].en, de: LINE_CERTAINTY[key].de },
      counted: vinciLifeCertaintyCounted[key], colour: LINE_CERTAINTY[key].colour }])) as LifeRecord['sure']
  const span = { from: Number(BIRTH.date.slice(0, 4)), to: Number(DEATH.date.slice(0, 4)) }
  // the floor's count is read from the floor and names the room it stands in
  const counted = (language: 'en' | 'de'): string => capitalise(fill(vinciLifeFloorCount[language],
    { cut: spokenCount(VINCI_LIFE_CUT.size, language), total: spokenCount(LINE_STUDS.length, language) }))
  return { bands, events, works: lifeWorks(hangs), people, sure,
    here: LINE_STUDS.find(stud => stud.date === vinciHourValues.julianDate)?.id,
    words: { throughLine: vinciThroughLine, secondLine: { en: fill(vinciLifeSecondLine.en, span), de: fill(vinciLifeSecondLine.de, span) },
      honesty: { en: counted('en'), de: counted('de') }, cut: vinciLifeCut,
      worksRow: vinciLifeWorksRow, worksCount: vinciLifeWorksCount, worksEmpty: vinciLifeWorksEmpty, age: AGE_WORDS, back: CARDS.controls.shared.back,
      provenance: CARDS.controls.machine.provenance, hour: vinciLifeHourMark },
    span }
}

/** THE RECORD BEHIND ONE DATE, written under the window's heading, which it
    rewrites in the date's own word of certainty. */
export function renderVinciLifeRecord(stud: Stud, host: HTMLElement): void {
  const page = host.ownerDocument, here = lang()
  const heading = host.querySelector<HTMLElement>('.vinci-certainty')
  const sure = LINE_CERTAINTY[stud.certainty as keyof typeof LINE_CERTAINTY]
  if (heading && sure) { heading.textContent = sure[here]; heading.dataset['certainty'] = stud.certainty; heading.style.color = sure.colour }
  const full = page.createElement('div'); full.className = 'vinci-record'; full.dataset['register'] = 'record'
  const add = (text: string | null | undefined): void => {
    if (!text) return
    const line = page.createElement('p'); line.className = 'vinci-statement'; line.textContent = text; full.append(line)
  }
  add(here === 'de' ? stud.date_label_de : stud.date_label_en)
  add(here === 'de' ? stud.date_note_de : stud.date_note_en)
  add(SOURCE_READINGS[stud.id]?.[here])
  add(stud.document); add(stud.holder)
  add(here === 'de' ? stud.qualifications_de : stud.qualifications_en)
  for (const gap of here === 'de' ? stud.gaps_de : stud.gaps) add(gap)
  // a link names the source as a person would, never the field it filled
  for (const source of stud.sources) {
    const link = page.createElement('a'); link.className = 'vinci-picture-source'
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = here === 'de' ? source.name_de : source.name_en
    full.append(link)
  }
  add(stud.licence_line)
  const limits = studLimits(stud)
  const data = page.createElement('pre'); data.className = 'vinci-arithmetic'
  data.textContent = JSON.stringify({ edtf: studEdtf(stud), calendar: stud.calendar, earliest: limits.earliest, latest: limits.latest,
    ...(stud.date_precision === 'circa' ? { about_years: CIRCA_YEARS } : {}), date_original: stud.date_original,
    date_certainty: stud.date_certainty ?? stud.certainty, date_alternatives: stud.date_alternatives,
    date_note_source: stud.date_note_source, document_status: stud.document_status }, null, 1)
  full.append(data)
  host.append(full)
}

/** THE LINE'S OWN WORKS for a plan: the twelve dates the floor cuts, then the
    floor itself, under the line's station, as the live registry lists them. */
export function vinciLineHighlights(floor: string): { id: string; title: VinciText }[] {
  const line = vinciContent.find(station => station.id === 'line-early')
  return [...LINE_STUDS.filter(stud => VINCI_LIFE_CUT.has(stud.id)).map(stud => ({ id: `stud/${stud.id}`, title: { en: stud.date_label_en, de: stud.date_label_de } })),
    ...(line ? [{ id: floor, title: line.name }] : [])]
}
