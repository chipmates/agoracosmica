import type { PlaybackSchedule, PlaybackState } from './playback'

/** GENERATED navigation copy and pure policy helpers. No DOM effects on import.
 * Prepared for R18 integration; this file does not change locked evidence copy.
 */
export type ControlLanguage = 'en' | 'de'

export const controlCopy = {
  en: {
    host: 'Leonardo da Vinci machine bench',
    subtitle: 'Leonardo da Vinci · The machine bench',
    navigation: 'Machines',
    previous: 'Previous machine',
    next: 'Next machine',
    chooser: 'Choose a machine',
    exitText: 'The museum ↗',
    exitLabel: 'The museum · return to Leonardo da Vinci',
    languageGroup: 'Display language',
    english: 'EN · Read in English',
    german: 'DE · Read in German',
    loading: 'Preparing the object',
  },
  de: {
    host: 'Maschinenwerkstatt von Leonardo da Vinci',
    subtitle: 'Leonardo da Vinci · Die Maschinenwerkstatt',
    navigation: 'Maschinen',
    previous: 'Vorherige Maschine',
    next: 'Nächste Maschine',
    chooser: 'Maschine auswählen',
    exitText: 'Das Museum ↗',
    exitLabel: 'Das Museum · zurück zu Leonardo da Vinci',
    languageGroup: 'Anzeigesprache',
    english: 'EN · Auf Englisch lesen',
    german: 'DE · Auf Deutsch lesen',
    loading: 'Das Objekt wird vorbereitet',
  },
} as const

/** Explicit inspection language wins. Public open/popstate reads the current
 * address each time; absent or unsupported query values deterministically use EN.
 */
export function controlLanguage(search: string, explicit?: ControlLanguage): ControlLanguage {
  return explicit ?? (new URLSearchParams(search).get('lang') === 'de' ? 'de' : 'en')
}

/** Return a same-origin relative address, preserving the path, hash and all
 * other query values. The integration owns history.replaceState(history.state).
 */
export function addressWithLanguage(address: string, lang: ControlLanguage): string {
  const url = new URL(address)
  url.searchParams.set('lang', lang)
  return url.pathname + url.search + url.hash
}

/** Turning reduction on pauses at the displayed pose. Turning it off never
 * resumes by itself; explicit Play remains allowed. Fixed inspection poses are
 * invariant. Public static state retains its existing zero-clock contract.
 */
export function playbackOnReducedMotionChange(
  schedule: PlaybackSchedule,
  state: PlaybackState,
  reduced: boolean,
): PlaybackState {
  if (state.fixed) return state
  if (schedule.kind === 'static') {
    return state.clock === 0 && !state.playing ? state : { clock: 0, playing: false, fixed: false }
  }
  return reduced && state.playing ? { ...state, playing: false } : state
}
