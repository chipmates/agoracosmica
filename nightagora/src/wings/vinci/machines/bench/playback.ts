/** Public bench playback policy. This module has no renderer or DOM dependency.
 * Continuous schedules keep absolute, unwrapped time. Only the two admitted
 * finite demonstrations stop at their dossier endpoint; their final mechanical
 * states are still calculated by the unchanged machine motion module.
 */
export type PlaybackLanguage = 'en' | 'de'
export interface PlaybackDossier {
  readonly slug: string
  readonly motion: { readonly period_s: number | null; readonly loop: boolean }
}
export type PlaybackSchedule =
  | { readonly kind: 'static'; readonly period: null }
  | { readonly kind: 'loop'; readonly period: number }
  | { readonly kind: 'finite'; readonly period: 12; readonly slug: 'rolling-mill' | 'revolving-crane' }

export interface PlaybackState {
  readonly clock: number
  readonly playing: boolean
  /** An explicit inspection pose must not advance or acquire an automatic reset. */
  readonly fixed: boolean
}

const seconds = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0)

export function playbackSchedule(dossier: PlaybackDossier): PlaybackSchedule {
  const { period_s: period, loop } = dossier.motion
  if (period === null) return { kind: 'static', period: null }
  if (!Number.isFinite(period) || period <= 0) throw new Error(`Invalid motion period: ${dossier.slug}`)
  if (loop) return { kind: 'loop', period }
  if (period === 12 && (dossier.slug === 'rolling-mill' || dossier.slug === 'revolving-crane')) {
    return { kind: 'finite', period: 12, slug: dossier.slug }
  }
  throw new Error(`No admitted finite playback policy: ${dossier.slug}`)
}

/** Pass the forge class as fixed, and a requested pose as t. A normal static
 * route never autoplays. Reduced motion suppresses automatic playback, while
 * the visitor may still explicitly start a moving demonstration.
 */
export function initialPlayback(
  schedule: PlaybackSchedule,
  options: { t?: number; fixed?: boolean; reducedMotion?: boolean } = {},
): PlaybackState {
  const fixed = options.fixed === true || options.t !== undefined
  return {
    clock: fixed ? seconds(options.t ?? 0) : 0,
    fixed,
    playing: schedule.kind !== 'static' && !fixed && !options.reducedMotion,
  }
}

/** Call only for a ready scene, using elapsed wall seconds since the last frame.
 * Update the wall timestamp even while loading or paused, as the bench already
 * does, so resuming does not accumulate time spent waiting.
 */
export function advancePlayback(
  schedule: PlaybackSchedule,
  state: PlaybackState,
  elapsedSeconds: number,
): PlaybackState {
  if (state.fixed) return state
  if (schedule.kind === 'static') return { clock: 0, playing: false, fixed: false }
  const clock = seconds(state.clock) + (state.playing ? seconds(elapsedSeconds) : 0)
  if (schedule.kind === 'finite' && clock >= schedule.period) {
    return { clock: schedule.period, playing: false, fixed: false }
  }
  return { clock, playing: state.playing, fixed: false }
}

/** Starting again from a finite endpoint is an explicit visitor action. */
export function togglePlayback(schedule: PlaybackSchedule, state: PlaybackState): PlaybackState {
  if (schedule.kind === 'static') return { clock: 0, playing: false, fixed: false }
  if (schedule.kind === 'finite' && state.clock >= schedule.period) {
    return { clock: 0, playing: true, fixed: false }
  }
  return { clock: seconds(state.clock), playing: !state.playing, fixed: false }
}

export function restartPlayback(schedule: PlaybackSchedule, reducedMotion: boolean): PlaybackState {
  return { clock: 0, playing: schedule.kind !== 'static' && !reducedMotion, fixed: false }
}

export function freezePlayback(time: number): PlaybackState {
  return { clock: seconds(time), playing: false, fixed: true }
}

const holdCopy = {
  'rolling-mill': {
    en: { short: 'Cranking stopped', detail: 'The operator stops cranking at 12 s. The rollers remain in their final position.' },
    de: { short: 'Kurbeln beendet', detail: 'Die Bedienperson hört nach 12 s auf zu kurbeln. Die Walzen bleiben in ihrer Endstellung.' },
  },
  'revolving-crane': {
    en: { short: 'Operator holding', detail: 'At 12 s the operator continues to hold the handle with an ideal tangential force of 39.2 N. The pawl remains disengaged.' },
    de: { short: 'Von Hand gehalten', detail: 'Nach 12 s hält die Bedienperson den Griff weiterhin mit einer idealen Tangentialkraft von 39,2 N. Die Sperrklinke bleibt ausgerückt.' },
  },
} as const

/** Keep holdText/holdDetail separate from the compact time field so the longer
 * explanation can occupy its own status line without squeezing mobile controls.
 * An explicit fixed pose retains its requested time, even beyond a finite end.
 */
export function playbackPresentation(schedule: PlaybackSchedule, state: PlaybackState, lang: PlaybackLanguage) {
  const isStatic = schedule.kind === 'static'
  const held = schedule.kind === 'finite' && state.clock >= schedule.period
  const playing = !isStatic && state.playing && !state.fixed && !held
  const playText = playing
    ? 'Pause'
    : held ? (lang === 'en' ? 'Run again' : 'Erneut starten')
      : lang === 'en' ? 'Run the motion' : 'Bewegung starten'
  const hold = held && schedule.kind === 'finite' ? holdCopy[schedule.slug][lang] : null
  return {
    motionDisabled: isStatic,
    playText,
    pressed: playing,
    restartText: lang === 'en' ? 'Restart' : 'Neustart',
    timeText: isStatic ? (lang === 'en' ? 'Static' : 'Statisch') : `${state.clock.toFixed(1)} s / ${schedule.period} s`,
    holdText: hold?.short ?? '',
    holdDetail: hold?.detail ?? '',
  }
}
