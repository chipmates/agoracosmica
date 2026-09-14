/* THE THREE REGISTERS OF DISPLAYED TEXT.
 *
 * The LABEL speaks: the hour as a person says it, the honest first line, the
 * certainty word. The DRAWER explains: one paragraph of how the thing works.
 * The RECORD proves, and it is the only register allowed arithmetic, bracket
 * citations, symbols and full precision; it lives behind "Read the evidence".
 *
 * The rules below are the refusals, and they are pure so the wing's offline
 * register checker can run them over every station without a browser.
 */

export type Register = 'label' | 'drawer' | 'record'

export const REGISTER_ATTRIBUTE = 'data-na-register'

/** Mark a node with the register its text belongs to. */
export function setRegister(element: Element, register: Register): void {
  element.setAttribute(REGISTER_ATTRIBUTE, register)
}

export interface RegisterRefusal {
  code: string
  says: string
  test: (text: string) => boolean
}

const citation = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/
const precision = /\d\.\d{3,}/
const symbols = /(?:^|[\s(])(?:LAT|UT|EoT|ΔT|λ)(?:[\s).,·=]|$)/

/** What may never stand in a spoken register. */
export const SPOKEN_REFUSALS: readonly RegisterRefusal[] = [
  { code: 'citation', says: 'a bracket citation is the record’s', test: t => citation.test(t) },
  { code: 'equation', says: 'an equation is the record’s', test: t => /=/.test(t) },
  { code: 'precision', says: 'more than two decimals is the record’s', test: t => precision.test(t) },
  { code: 'symbol', says: 'the hour’s symbols are the record’s', test: t => symbols.test(t) },
]

/** The spoken hour, as a person says it: a clock, the sun, a date. */
const SPOKEN_HOUR = {
  en: /^\d{1,2}:\d{2} by the sun, \d{1,2} \w+ \d{4}/,
  de: /^\d{1,2}:\d{2} nach der Sonne, \d{1,2}\. \w+ \d{4}/,
} as const

export function hourIsSpoken(text: string, language: 'en' | 'de'): boolean {
  return SPOKEN_HOUR[language].test(text)
}

/** Bracket citations leave the drawer without touching the locked sentence
 * around them; the same paragraph keeps them inside the record. */
export function withoutCitations(text: string): string {
  return text
    .replace(/\s*\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

export interface RegisterFinding {
  station: string
  language: 'en' | 'de'
  register: Register
  line: string
  code: string
  says: string
}

/** Every refusal a set of displayed lines earns. The record refuses nothing. */
export function auditRegisters(
  station: string,
  language: 'en' | 'de',
  lines: { register: Register; text: string }[],
): RegisterFinding[] {
  const findings: RegisterFinding[] = []
  for (const line of lines) {
    if (line.register === 'record') continue
    for (const rule of SPOKEN_REFUSALS)
      if (rule.test(line.text))
        findings.push({ station, language, register: line.register, line: line.text, code: rule.code, says: rule.says })
  }
  return findings
}

/** What the exhibit does not show, said plainly on the label. A drawer that
 * describes water in front of a dry deck leaves the visitor to notice the gap
 * on their own; absence is an exhibit and it gets a line. */
export const BENCH_ABSENCE: Record<string, { en: string; de: string }> = {
  'parachute': { en: 'Modern exhibition supports', de: 'Moderne Ausstellungshalterungen' },
  'proportional-compass': { en: 'Modern exhibition supports', de: 'Moderne Ausstellungshalterungen' },
  'miter-lock-gates': { en: 'The lock chamber and its water are not shown', de: 'Schleusenkammer und Wasser sind nicht dargestellt' },
  'water-lifting-screw': { en: 'The water is not shown', de: 'Das Wasser ist nicht dargestellt' },
}

/** Two dossiers spell the Paris holder without the apostrophe of the elided
 * article, and the string reads as broken on the frame. The record keeps the
 * source byte for byte; the wall prints the holder's own name. */
export function holderName(text: string): string {
  return text.replace(/\bde l Institut\b/g, 'de l\u2019Institut')
}
