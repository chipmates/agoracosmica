/* THE NIGHT'S BED — the one sound that runs under the whole walk, and the
   four laws it is built out of.

   1. THE BED IS STANDARD, THE VISITOR IS SOVEREIGN. It rises with the wake,
      which is itself the first deliberate gesture of the night, and one
      press of the rail silences it for good and is remembered. Nothing ever
      sounds before a gesture: browsers forbid it and so does the night.
      (The stricter reading — nothing until the rail is pressed — is one
      line in enable(), kept documented there.) A no remembered from an
      earlier night is honoured before the wake is even offered, and it
      stands until the rail says otherwise.
   2. THE DOOR. Browsers unlock sound on a hand: a pointer, a key, a touch
      that ends. A wheel is the one gesture that carries this whole descent
      and the specification does not count it, though some engines do. So
      the bed asks the browser AND keeps its own witness, and starts only
      when one of them says the door is open. It never fires play() at
      every frame hoping to be let through, which is why the console stays
      clean and why the rail never promises a sound that cannot come.
   3. A ROOM, NOT A SLIDER. Every move runs on the audio clock: the wake
      swells, a voice closes the air over the bed, the walk carries it from
      room to room. Nothing steps, so nothing clicks.
   4. NO SEAM. The bed is longer than most visits but not longer than a
      night, so its two ends are walked past each other instead of spliced.
      The element's own loop stays on underneath as the belt.

   The bed's own level is the one this night was authored at, 0.30, written
   the way ears count it. The duck lands about as deep as the old flat one,
   but half of it is now the air closing rather than the level dropping,
   which is what a room does and what leaves the bed still there. */

import { AUDIO_AMBIENT } from '../content/media'
import { FOUNDING_SEED, mulberry32 } from './seed'

const STORE_KEY = 'na-sound'

// ------------------------------------------------------------- the levels
/** decibels to amplitude: the one conversion in the file */
const db = (x: number): number => Math.pow(10, x / 20)

/** the bed at rest */
const BED_DB = -10.5
/** how far it steps back when a voice takes the floor. Shallower than the
    old flat duck on purpose: the air below carries the other half, and a
    bed that vanishes under every sentence is a bed the room keeps losing. */
const DUCK_DB = -7
/** how far the air closes over it. Speech lives from about 300 Hz up, so
    taking the bed's presence band away buys the voices more room than six
    more decibels of level ever would, and the bed stays a presence. */
const DUCK_HZ = 640
const OPEN_HZ = 19000

/** how far the breath moves the bed, either side of its level */
const BREATH = 0.032

/* THE ROOMS OF THE WALK. The bed reads the one state this night publishes
   (body.dataset.phase, the same string the rig steers by), so nothing new
   has to cross the wall between the walk and its sound. Small numbers on
   purpose: this is the size of the room, not a volume control. */
const ROOM_OPEN = { db: 0, hz: OPEN_HZ }
const ROOMS: Record<string, { db: number; hz: number }> = {
  // before the descent the night is still beyond the door
  transit: { db: -7, hz: 7000 },
  held: { db: -7, hz: 7000 },
  descent: { db: -2.5, hz: 14000 },
  // between two places, with the hatching holding the frame
  crossing: { db: -3.5, hz: 11000 },
  // his ground has its own fires to listen to
  camp: { db: -1.5, hz: OPEN_HZ },
}

/** every approach in the file, named. Down is always faster than up: that
    is the asymmetry that makes a duck read as a room and not as a fader. */
const TAU = {
  wake: 1.05,
  rest: 0.45,
  leave: 0.12,
  duckIn: 0.16,
  duckOut: 0.8,
  airIn: 0.13,
  airOut: 0.9,
  room: 1.4,
}
/** a breath between two sentences is not the end of the speaking */
const DUCK_HOLD_MS = 450
/** how long the two ends of the bed walk past each other */
const SEAM = 2.4
/** how early the other end is woken. A cold element can take seconds to
    roll, and the walk itself must never wait on a promise to be exact. */
const SEAM_LEAD = 6
/** how long a witnessed gesture is taken to hold the door open, a little
    under the transient window browsers themselves work with */
const GESTURE_MS = 4000

// -------------------------------------------------------------- the state
let wanted = false
let ducked = false
let voiceGoneAt = -1
/** the bed is rolling */
let sounding = false
/** it has rolled at least once, so the browser's door stays open */
let unlocked = false
/** the asset never arrived: stop asking, and tell the truth */
let broken = false
/** the tab was left behind */
let away = false
let lastGesture = -1e9
let starting = false

// ---------------------------------------------------------------- the door
function activationLive(): boolean {
  const nav = navigator as Navigator & { userActivation?: { isActive: boolean } }
  if (nav.userActivation?.isActive) return true
  return performance.now() - lastGesture < GESTURE_MS
}

function doorOpen(): boolean {
  return unlocked || activationLive()
}

/* The witness. A wheel scrolls the whole descent without ever unlocking
   audio, so a bed that trusted the wake would claim a sound it cannot make.
   These three events are the ones browsers count. */
function witness(e: Event): void {
  lastGesture = performance.now()
  prime()
  // the rail speaks for itself: its press is about to be handled, and a bed
  // that lit on the way down would make that press mean the opposite of
  // what its label promises
  const t = e.target
  if (t instanceof Element && t.closest('#rail-sound')) return
  light()
}
for (const kind of ['pointerdown', 'keydown', 'touchend'] as const)
  addEventListener(kind, witness, { capture: true, passive: true })

// --------------------------------------------------------------- the organ
/* One graph, built inside the visitor's own gesture and never before it:

     bed A ─┐  (each end has its own side of the seam)
            ├→ air ──→ voices ──→ breath ──→ night ──→ out
     bed B ─┘

   air     the size of the room, and what a voice closes over the bed
   voices  the duck
   breath  two slow seeded sines: the bed is never machine-flat
   night   the level itself: the wake, the rooms of the walk, the rest

   If a graph cannot be had, the same laws run on the element's own volume
   (plain mode): no air, no seam, everything else intact. */

interface Bed {
  el: HTMLAudioElement
  /** its side of the crossfade (graph mode only) */
  x: GainNode | null
}

let ctx: AudioContext | null = null
let air: BiquadFilterNode | null = null
let voices: GainNode | null = null
let night: GainNode | null = null
let bedA: Bed | null = null
let bedB: Bed | null = null
let primary: Bed | null = null
let plain = false
let plainTried = false
/** plain mode's own level, since there is no audio clock to hold it */
let plainLevel = 0
let blessed = false
let built = false
let seamless = true
let seamEnds = -1
/** the other end has been woken for the coming walk */
let seamWoke = false
let lastLevel = 0
let lastDuck = 1
let lastAir = OPEN_HZ

function reduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function makeBed(cors: boolean): Bed {
  const el = new Audio()
  el.loop = true // the belt under the seam: a refused partner costs a join, never silence
  // metadata only until the night is actually asked for: this is what makes
  // the duration known early, and it is a few dozen kilobytes, not the bed
  el.preload = 'metadata'
  // a graph may only read a cross-origin source that says it may be read
  el.crossOrigin = cors ? 'anonymous' : null
  el.volume = 0 // nothing is ever loud before something owns its level
  const bed: Bed = { el, x: null }
  el.addEventListener('error', () => onBedError(bed))
  el.src = AUDIO_AMBIENT
  return bed
}

/* THE PRIMING. Built at the visitor's first gesture, not before it and not
   at the invitation: a bed that starts buffering only when the rail is
   pressed answers a second and a half late, and a night that was turned off
   last time should not spend a phone's data at all. Making an element is
   not playing one. */
function prime(): void {
  if (bedA || broken || readChoice() === 'off') return
  bedA = makeBed(true)
  bedB = makeBed(true)
  primary = bedA
}

function buildGraph(): boolean {
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext }
  const Ctor = window.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return false
  let c: AudioContext | null = null
  try {
    c = new Ctor()
    const a = c.createBiquadFilter()
    a.type = 'lowpass'
    a.frequency.value = OPEN_HZ
    a.Q.value = 0.707 // no ring at the corner: a wall, not an effect
    const v = c.createGain()
    const breath = c.createGain()
    const n = c.createGain()
    n.gain.value = 0
    a.connect(v)
    v.connect(breath)
    breath.connect(n)
    n.connect(c.destination)

    const one = bedA
    const two = bedB
    if (!one || !two) return false
    for (const bed of [one, two]) {
      const g = c.createGain()
      g.gain.value = bed === one ? 1 : 0
      c.createMediaElementSource(bed.el).connect(g)
      g.connect(a)
      bed.x = g
      bed.el.volume = 1 // the level lives downstream now
    }

    /* THE BREATH — two slow sines, seeded from the founding date, summed
       into a gain of their own so silence stays absolute when the night is
       off. A room drifts; only a machine holds a level exactly. */
    const rand = mulberry32(FOUNDING_SEED)
    const still = reduced()
    for (const base of [0.017, 0.0271]) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = base * (0.85 + rand() * 0.3)
      const depth = c.createGain()
      depth.gain.value = still ? 0 : BREATH * (0.7 + rand() * 0.6)
      o.connect(depth)
      depth.connect(breath.gain)
      o.start()
    }

    ctx = c
    air = a
    voices = v
    night = n
    primary = one
    return true
  } catch {
    // a half built graph may already own an element's output, and a tapped
    // element never reaches the speakers on its own again. Whatever was
    // touched here is abandoned and the plain night gets a fresh bed.
    try {
      void c?.close()
    } catch {
      /* nothing to close */
    }
    ctx = null
    air = voices = night = null
    bedA = makeBed(false)
    bedB = null
    primary = bedA
    return false
  }
}

/** no graph to be had: the same laws, walked on the element's own volume */
function buildPlain(): boolean {
  plain = true
  plainTried = true
  plainLevel = 0
  if (!bedA) return false
  bedA.el.volume = 0
  // one bed carries a plain night: without a graph there is nothing to
  // crossfade with, and its own loop is the join
  bedB = null
  primary = bedA
  return true
}

function ensure(): boolean {
  prime()
  if (!bedA) return false
  if (!built) {
    built = true
    if (!buildGraph()) buildPlain()
    // the invitation was given: fetch the whole bed. The other end stays on
    // metadata until the seam wakes it, a lap away.
    if (primary) primary.el.preload = 'auto'
  }
  return Boolean(primary)
}

/* iOS blesses media one element at a time: an element that no hand ever
   started cannot be started later by the clock. The seam's partner is woken
   here, inside the same gesture, and put straight back down. The pause
   waits for the play to resolve, because pausing a pending play is what
   writes "the play() request was interrupted" into the console. */
function bless(): void {
  const other = primary === bedA ? bedB : bedA
  if (!other || blessed) return
  blessed = true
  other.el.play().then(
    () => {
      other.el.pause()
      other.el.currentTime = 0
    },
    () => {
      seamless = false
    }
  )
}

function onBedError(bed: Bed): void {
  // the far end failing costs the walk past, never the night: the bed that
  // is carrying goes on carrying, seam and all
  if (bed !== primary) {
    seamless = false
    return
  }
  // a graph that never sounded may simply be a graph this browser or this
  // asset will not give us. One fall back to a plain element, then silence
  // and no more asking.
  if (!unlocked && !plainTried) {
    ctx = null
    air = voices = night = null
    bedB = null
    sounding = false
    starting = false
    blessed = false
    // the graph's own requirement, a cross-origin bed the browser will let
    // us read, is the likeliest thing to have failed. Try once without it.
    const solo = makeBed(false)
    bedA = solo
    primary = solo
    buildPlain()
    solo.el.preload = 'auto'
    light()
    return
  }
  broken = true
  wanted = false
  sounding = false
}

// --------------------------------------------------------------- the light
function light(): void {
  if (!wanted || broken || away || sounding || starting) return
  if (!doorOpen()) return
  if (!ensure()) return
  const p = primary
  if (!p) return
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  starting = true
  p.el.play().then(
    () => {
      starting = false
      sounding = true
      unlocked = true
      bless()
    },
    () => {
      // the door was shut after all. No storm and no console: the next
      // real gesture asks again, once.
      starting = false
    }
  )
}

function putDown(): void {
  sounding = false
  // a walk that was still in the air is landed here rather than left half
  // done, or the bed would come back at half its level
  if (seamEnds > 0) finishSeam(true)
  seamEnds = -1
  seamWoke = false
  for (const bed of [bedA, bedB]) if (bed) bed.el.pause()
}

// ---------------------------------------------------------------- the seam
function halfCurve(rising: boolean): Float32Array {
  const n = 48
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (Math.PI / 2)
    c[i] = rising ? Math.sin(t) : Math.cos(t)
  }
  return c
}

/** The walk past is over: the old end is put down, the new one carries.
    `force` lands it even mid-curve, for the case where the whole bed is
    being put down anyway and the curve will end where it was going. */
function finishSeam(force: boolean): void {
  const p = primary
  const other = p === bedA ? bedB : bedA
  if (!p || !other || !p.x || !other.x) return
  let landed = true
  try {
    p.x.gain.value = 0
    other.x.gain.value = 1
  } catch {
    landed = false
  }
  if (!landed && !force) {
    // a curve is still running over this param: land just after it
    seamEnds = ctx ? ctx.currentTime + 0.3 : -1
    return
  }
  seamEnds = -1
  p.el.pause()
  p.el.currentTime = 0
  primary = other
}

/* THE WALK PAST, in three beats: wake the other end early, walk the two
   ends past each other exactly on time, land it. Waking and walking are
   kept apart on purpose. A cold element took two and a half seconds to
   roll in the rig, and a walk scheduled inside that promise would have
   started after the join it was there to hide. */
function seam(): void {
  if (!ctx || !sounding) return
  const p = primary
  const other = p === bedA ? bedB : bedA
  if (!p || !other || !p.x || !other.x) return

  // landing always runs, even if the seam has since been abandoned: a bed
  // left rolling under a silent gain is a bed nobody ever puts down
  if (seamEnds > 0) {
    if (ctx.currentTime >= seamEnds) finishSeam(false)
    return
  }
  if (!seamless) return

  const dur = p.el.duration
  if (!Number.isFinite(dur) || dur < SEAM * 4) return
  const left = dur - p.el.currentTime

  if (left > SEAM + SEAM_LEAD) {
    // a fresh lap: the other end may sleep again
    if (seamWoke) {
      seamWoke = false
      if (!other.el.paused) other.el.pause()
      other.el.currentTime = 0
    }
    return
  }

  if (!seamWoke) {
    seamWoke = true
    other.el.preload = 'auto'
    other.el.currentTime = 0
    // a refusal here is not a failure: the lap wraps on the element's own
    // loop, one join, and the next lap asks again
    void other.el.play().catch(() => undefined)
    return
  }

  if (left > SEAM || other.el.paused) return

  // both ends are rolling: walk them past each other on the audio clock,
  // where no frame stall and no promise can move them
  try {
    const when = ctx.currentTime
    p.x.gain.setValueCurveAtTime(halfCurve(false), when, SEAM)
    other.x.gain.setValueCurveAtTime(halfCurve(true), when, SEAM)
    seamEnds = when + SEAM + 0.05
  } catch {
    seamless = false
  }
}

// -------------------------------------------------------------- the levels
function room(): { db: number; hz: number } {
  const phase = document.body.dataset['phase'] ?? ''
  return ROOMS[phase] ?? ROOM_OPEN
}

function levelTarget(): number {
  if (!wanted || away || broken) return 0
  return db(BED_DB + room().db)
}

function ramp(param: AudioParam, target: number, tau: number): void {
  if (!ctx) return
  param.setTargetAtTime(target, ctx.currentTime, Math.max(0.01, tau))
}

/** how long the level itself takes to move, which is the difference between
    a night arriving, a night leaving, and a night changing rooms */
function levelTau(from: number, to: number): number {
  if (to > from) return TAU.wake
  if (away) return TAU.leave
  return from > 0 && to > 0 ? TAU.room : TAU.rest
}

/** schedule whatever moved, and only what moved: the audio clock does the
    walking between calls, so a stalled frame cannot dent a fade */
function applyGraph(): void {
  if (!ctx || !night || !voices || !air) return
  const level = levelTarget()
  if (Math.abs(level - lastLevel) > 0.0004) {
    ramp(night.gain, level, levelTau(lastLevel, level))
    lastLevel = level
  }
  const duck = ducked ? db(DUCK_DB) : 1
  if (Math.abs(duck - lastDuck) > 0.002) {
    ramp(voices.gain, duck, duck < lastDuck ? TAU.duckIn : TAU.duckOut)
    lastDuck = duck
  }
  const hz = ducked ? DUCK_HZ : room().hz
  if (Math.abs(hz - lastAir) > 4) {
    ramp(air.frequency, hz, hz < lastAir ? TAU.airIn : TAU.airOut)
    lastAir = hz
  }
}

function applyPlain(dt: number): void {
  const p = primary
  if (!p) return
  const level = levelTarget() * (ducked ? db(DUCK_DB) : 1)
  // without an air to close, the duck is only a level here, so it gets the
  // duck's own timings and the rest of the walk keeps the level's
  const tau =
    ducked && level < plainLevel ? TAU.duckIn : levelTau(plainLevel, level)
  plainLevel += (level - plainLevel) * (1 - Math.exp(-dt / tau))
  p.el.volume = Math.max(0, Math.min(1, plainLevel))
}

function levelNow(): number {
  if (plain) return plainLevel
  return night ? night.gain.value : 0
}

// ------------------------------------------------- the tab, left behind
/* rAF stops when the tab goes, so the fade has to be scheduled on the audio
   clock and the elements put down by a timer. A night you walked away from
   holds its breath rather than playing to an empty room. */
document.addEventListener('visibilitychange', () => {
  const gone = document.visibilityState === 'hidden'
  if (gone === away) return
  away = gone
  if (!primary) return
  if (!away) {
    light()
    return
  }
  if (!sounding) return
  if (ctx && night) {
    ramp(night.gain, 0, TAU.leave)
    lastLevel = 0
    // a visitor who comes straight back finds the bed still there
    window.setTimeout(() => {
      if (away) putDown()
    }, 420)
    return
  }
  const p = primary
  const walk = window.setInterval(() => {
    if (!away) {
      window.clearInterval(walk)
      return
    }
    plainLevel *= 0.72
    p.el.volume = Math.max(0, plainLevel)
    if (plainLevel < 0.004) {
      window.clearInterval(walk)
      putDown()
    }
  }, 30)
})

// -------------------------------------------------------------- the choice
function readChoice(): 'on' | 'off' | null {
  try {
    const v = localStorage.getItem(STORE_KEY)
    return v === 'on' ? 'on' : v === 'off' ? 'off' : null
  } catch {
    return null
  }
}

function writeChoice(v: 'on' | 'off'): void {
  try {
    localStorage.setItem(STORE_KEY, v)
  } catch {
    /* private mode: the night still plays, it just forgets */
  }
}

export const ambience = {
  /** The remembered choice from an earlier night. */
  remembered(): 'on' | 'off' | null {
    return readChoice()
  },

  on(): boolean {
    return wanted
  },

  /** Call from a user gesture: browsers only unlock audio there. */
  enable(): void {
    const choice = readChoice()
    // LAW 1. The bed is STANDARD (a blessed decision, 2026-07-20): a night
    // with no answer on record takes the wake's offer, because the wake is
    // itself the visitor's first deliberate gesture and the rail lights the
    // moment it runs. A remembered no is honoured by the caller and by
    // readChoice below, and one press turns it off for good.
    //
    // The alternative — decline the wake and stay silent until the rail is
    // pressed — is one line (`if (choice === null && first) return`) and is
    // worth revisiting if the night ever wants a quieter door.
    wanted = true
    writeChoice('on')
    // LAW 2. If the browser's door is shut, the choice still stands and the
    // rail is right to say so. The first real gesture lights it.
    light()
  },

  disable(): void {
    wanted = false
    writeChoice('off')
  },

  duck(d: boolean): void {
    if (d) {
      ducked = true
      voiceGoneAt = -1
    } else if (ducked && voiceGoneAt < 0) {
      voiceGoneAt = performance.now()
    }
  },

  /** Drive from the frame loop: the level breathes, it never steps. */
  update(dt: number): void {
    // the hold runs whether or not there is a bed to hear it, so a night
    // invited in the middle of a sentence does not open ducked
    if (voiceGoneAt > 0 && performance.now() - voiceGoneAt > DUCK_HOLD_MS) {
      ducked = false
      voiceGoneAt = -1
    }
    if (!primary) return
    // a stalled frame must not slam a level: a tenth of a second is the
    // most any single step of the walk is allowed to be worth
    const step = Math.min(0.1, Math.max(0, dt))
    if (plain) applyPlain(step)
    else applyGraph()
    if (sounding) seam()
    // under sixty decibels there is nothing left to hear: put the bed down
    // rather than stream a silence
    if (sounding && !wanted && !starting && levelNow() < 0.0006) putDown()
  },
}
