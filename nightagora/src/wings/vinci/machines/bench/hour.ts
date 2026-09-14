import { vinciHourArithmetic, vinciHourIntegrity, vinciHourValues } from '../../content'
import { setRegister } from './registers'

type HourLanguage = 'en' | 'de'

/** Geographic angles, clockwise from true north; geometric solar centre.
 * These are the same selected moment and numbers used by the wing label.
 * Convert the azimuth only if the receiving scene uses a rotated north axis.
 */
export const BENCH_SUN_AZIMUTH_DEGREES = vinciHourValues.sunAzimuthDegrees
export const BENCH_SUN_ELEVATION_DEGREES = vinciHourValues.sunElevationDegrees

const longitudeDegrees = .9920706
const longitudeCorrectionSeconds = longitudeDegrees * 4 * 60
const roundedClockCorrectionSeconds = 18 * 60 + 52

export const BENCH_HOUR = Object.freeze({
  ...vinciHourValues,
  latitudeDegrees: 47.4103059,
  longitudeDegrees,
  longitudeCorrectionSeconds,
  roundedClockCorrectionSeconds,
  // The label's clocks are already rounded to whole seconds. This residual
  // must not be passed off as a separately evaluated high-precision EoT.
  equationOfTimeSecondsFromRoundedClocks: roundedClockCorrectionSeconds - longitudeCorrectionSeconds,
  certainty: 'reconstructed' as const,
})

/** Source record, retained for the host's existing evidence presentation.
 * Read from the local record, not recomputed with the grave's 1519 date.
 * In light-rig.json, `hourly` is tabulated by LAT; this chosen 15 UT moment
 * belongs to the explicitly named 15:19:00 LAT keyframe instead.
 */
export const BENCH_HOUR_SOURCE = Object.freeze({
  path: 'src/wings/vinci/data/light-rig.json',
  record: 'dates[julian_date="1517-10-10"].keyframes[0]',
  label: '15:19:00 LAT',
  geographicDatum: 'src/wings/vinci/data/closluce.json: frame.origin_lat_deg, frame.origin_lon_deg',
  copySource: 'src/wings/vinci/content.ts: vinciHourArithmetic, vinciHourIntegrity, vinciHourValues',
  method: 'EPHEMERIS: local Meeus implementation; modelled delta-T 180.497 s, displayed as 180.5 s.',
  note: 'Chosen exhibition hour. Calculated geometric solar-centre altitude, without refraction or terrain correction. Longitude and EoT decomposition is rounded from the established clock arithmetic. No historical hour or weather observation is claimed.',
})

const COPY = {
  en: {
    // The label register: the hour as a visitor would say it aloud.
    clock: '15:19 by the sun, 10 October 1517 (Julian calendar)',
    // The same claim as the wing's chosen-minute line, in the plainest words.
    choice: 'The day is documented. We chose the hour.',
    title: 'The wing’s computed hour',
    recordTitle: 'The computed hour',
    formula: 'LAT = UT + 4λ + EoT · 4λ 3m58s · EoT 14m54s',
    sun: 'ΔT 180.5 s · azimuth 231.90° · altitude 17.39°',
    place: 'Clos Lucé, Amboise · 47.41° north, 0.99° east',
    meanings: 'LAT: local apparent solar time. UT: universal time. λ: east longitude in degrees, at four minutes per degree. EoT: equation of time. Azimuth is measured clockwise from true north, altitude is the geometric solar centre without refraction.',
    method: 'Method: Meeus, Astronomical Algorithms, second edition, with a modelled ΔT of 180.5 s.',
    integrity: 'The day is documented. The hour inside it is ours. No source gives the hour of the visit.',
  },
  de: {
    clock: '15:19 nach der Sonne, 10. Oktober 1517 (julianischer Kalender)',
    choice: 'Der Tag ist belegt. Die Stunde haben wir gewählt.',
    title: 'Die berechnete Stunde des Flügels',
    recordTitle: 'Die berechnete Stunde',
    formula: 'LAT = UT + 4λ + EoT · 4λ 3m58s · EoT 14m54s',
    sun: 'ΔT 180.5 s · Azimut 231.90° · Höhe 17.39°',
    place: 'Clos Lucé, Amboise · 47.41° Nord, 0.99° Ost',
    meanings: 'LAT: wahre Ortszeit. UT: Weltzeit. λ: östliche Länge in Grad, mit vier Minuten je Grad. EoT: Zeitgleichung. Das Azimut zählt im Uhrzeigersinn ab geografisch Nord, die Höhe ist die geometrische Sonnenmitte ohne Lichtbrechung.',
    method: 'Methode: Meeus, Astronomical Algorithms, zweite Ausgabe, mit einem modellierten ΔT von 180,5 s.',
    integrity: 'Der Tag ist belegt. Die Stunde darin ist von uns gewählt. Keine Quelle nennt die Uhrzeit des Besuchs.',
  },
} as const

const CSS = `
.bench-hour{box-sizing:border-box;margin:0;padding:9px 0 0;border-top:1px solid #8a82703b;display:grid;gap:4px;min-width:0;color:#bdb6a7;font:12px/1.45 Arial,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.01em}
.bench-hour p{margin:0;min-width:0;font:inherit;letter-spacing:inherit}
.bench-hour .bench-hour-choice{color:#d6ad67;display:flex;gap:8px;align-items:baseline}
.bench-hour-choice::before{content:"";flex:none;width:5px;height:5px;margin-top:5px;border-radius:50%;background:currentColor}
@media(max-width:1280px){.bench-hour{padding-top:7px;gap:3px;font-size:11px;line-height:1.4}}
`

export interface BenchHourBlock {
  element: HTMLElement
  setLanguage(language: HourLanguage): void
  dispose(): void
}

/** The record register of the hour: the arithmetic, the place, the method
 * and the chosen-minute disclosure, in the order the evidence page reads
 * them. Nothing here is allowed on the label. */
export interface BenchHourRecordLine { text: string; figure: boolean }
export function benchHourRecord(language: HourLanguage): { title: string; lines: BenchHourRecordLine[] } {
  const copy = COPY[language]
  const arithmetic = vinciHourArithmetic[language].split(' · ')[0] ?? ''
  const spoken = (text: string): BenchHourRecordLine => ({ text, figure: false })
  const figure = (text: string): BenchHourRecordLine => ({ text, figure: true })
  return {
    title: copy.recordTitle,
    lines: [
      spoken(copy.clock),
      figure(arithmetic),
      figure(copy.formula),
      figure(copy.sun),
      figure(copy.place),
      spoken(copy.meanings),
      spoken(copy.method),
      spoken(copy.integrity),
      spoken(`${BENCH_HOUR_SOURCE.path} · ${BENCH_HOUR_SOURCE.label}`),
    ],
  }
}

/** The label register of the hour: two spoken lines, the second one the
 * museum's plainest voice about what was chosen rather than found. The
 * arithmetic that stands behind them is built by benchHourRecord and read
 * in the evidence dialog. */
export function createBenchHour(language: HourLanguage = 'en'): BenchHourBlock {
  const element = document.createElement('section')
  element.className = 'bench-hour'
  element.dataset['naCertainty'] = BENCH_HOUR.certainty
  element.dataset['naSource'] = `${BENCH_HOUR_SOURCE.path}#${BENCH_HOUR_SOURCE.record}`
  setRegister(element, 'label')
  const style = document.createElement('style')
  style.textContent = CSS
  const clock = document.createElement('p'), choice = document.createElement('p')
  clock.className = 'bench-hour-clock'
  choice.className = 'bench-hour-choice'
  setRegister(clock, 'label')
  setRegister(choice, 'label')
  element.append(style, clock, choice)

  function setLanguage(next: HourLanguage): void {
    const copy = COPY[next]
    element.lang = next
    element.setAttribute('aria-label', copy.title)
    element.title = `${vinciHourIntegrity[next]}\n${copy.meanings}\n${BENCH_HOUR_SOURCE.path} · ${BENCH_HOUR_SOURCE.label}`
    clock.textContent = copy.clock
    choice.textContent = copy.choice
  }
  setLanguage(language)
  return { element, setLanguage, dispose: () => element.remove() }
}

/** The two lines the label register carries, for the offline checker. */
export function benchHourLabelLines(language: HourLanguage): string[] {
  return [COPY[language].clock, COPY[language].choice]
}
