import { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createKeeper } from './scenes/keeper'
import { createBreath } from './scenes/breath'
import { createAtlas } from './scenes/atlas'
import { createMandala } from './scenes/mandala'
import { createHotspots } from './core/hotspots'
import { FIRE_SCRIPT } from './content/keeper-script'
import { ambience } from './core/ambience'
import { WANDERERS } from './content/wanderers'
import { CONSTELLATIONS, SKY_INVITE } from './content/constellations'
import { channel } from './core/motion'
import { mediaUrl } from './content/media'
import { createWingFrame, stationFromHash } from './wings/frame'
import { WINGS, wingBySlug, wingsOpen, wingsPreparing } from './wings/registry'
import { wingCount } from './wings/content'

type Phase = 'transit' | 'held' | 'descent' | 'agora' | 'wheel' | 'breath' | 'wing'
/** what the rig may ask for: the phases, plus the wheel with a pane open */
type ForgeState = Phase | 'pane'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const keeper = document.getElementById('keeper')
const descent = document.getElementById('descent')
const verse = document.getElementById('verse')
const voiceDom = document.getElementById('voice')
const plate = document.getElementById('constellation-plate')
const invite = document.getElementById('sky-invite')
const marks = document.getElementById('chapter-marks')
const chips = document.getElementById('star-chips')
const pane = document.getElementById('figure-pane')
const wingHost = document.getElementById('wing')
const lobbyPlate = document.getElementById('lobby-plate')
if (
  !stage || !status || !keeper || !descent || !verse || !voiceDom ||
  !plate || !invite || !marks || !chips || !pane || !wingHost
)
  throw new Error('missing shell')
const keeperEl: HTMLElement = keeper
const descentEl: HTMLElement = descent
const verseEl: HTMLElement = verse
const voiceEl2: HTMLElement = voiceDom
const plateEl: HTMLElement = plate
const inviteEl: HTMLElement = invite
const marksEl: HTMLElement = marks
const chipsEl: HTMLElement = chips
const paneEl: HTMLElement = pane
const wingEl: HTMLElement = wingHost

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scene = new Scene()
const camera = new PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 0)

const eclipse = createEclipse(scene)
const agora = createAgora(scene)
const keeperScene = createKeeper(keeperEl, reducedMotion, () => keeperExit())

/** The keeper's one way onward: he lifts your gaze to the wheel. */
function keeperExit(): void {
  if (phase === 'agora') lookTarget = 1
}
const breath = createBreath()
const atlas = createAtlas(scene)
const mandala = createMandala(scene)

// ---- the lobby's points: the world itself is the menu ----
const hotspotsHost = document.getElementById('hotspots')
if (!hotspotsHost) throw new Error('missing hotspots shell')
const hotspots = createHotspots(hotspotsHost)

const HUB_SPOTS = [
  {
    id: 'wheel',
    label: 'The Sky',
    pos: new Vector3(0, 2.3, -6.2),
    posNarrow: new Vector3(0, 1.75, -5.6),
    open: () => {
      lookTarget = 1 // the gaze lifts itself; the wheel receives you
    },
  },
]

// WebGL is the proven backend tonight; ?webgpu opts into the newer path
// until it is verified on real hardware (see FORGE-STATE DEEPEN list).
const wantWebGPU = location.search.includes('webgpu') && 'gpu' in navigator
const renderer = new WebGPURenderer({ antialias: true, forceWebGL: !wantWebGPU })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
stage.appendChild(renderer.domElement)

let phase: Phase = 'transit'
let transit = 0
let door = 0
let desc = 0
let descTarget = 0
let skyBirth = 0
let flashAt = -1
let elapsed = 0
let frozen = false
let agoraReveal = 0
let lookUp = 0
let lookTarget = 0
let agoraEnteredAt = -1
let voiceTimerA = 0
let voiceTimerB = 0
let chapter = 0
let chapterChangedAt = -99
let paneOpen = false
let skyAcc = 0
let atlasReveal = 0

// ---- the remembered night ----
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode: the night still works, it just forgets */
  }
}
let musicWoken = false

/** The first scroll is the browser's unlock gesture: the ambient bed
    starts with the descent as the night's standard voice. */
function wakeMusic(): void {
  if (musicWoken) return
  musicWoken = true
  if (ambience.remembered() !== 'off') ambience.enable()
  railEl.hidden = false
  syncSoundLabel()
}
// ---- the wheel of the night: plate, marks, chips, pane ----
const roster = new Map(WANDERERS.map((w) => [w.slug, w]))
const plateKicker = plateEl.querySelector('.plate-kicker') as HTMLElement | null
const plateName = plateEl.querySelector('.plate-name') as HTMLElement | null
const plateVoices = plateEl.querySelector('.plate-voices') as HTMLElement | null

for (const c of CONSTELLATIONS) {
  const m = document.createElement('span')
  m.textContent = c.numeral
  marksEl.appendChild(m)
}

function setPlate(): void {
  const c = CONSTELLATIONS[chapter]
  if (!c) return
  if (plateKicker) plateKicker.textContent = `Constellation ${c.numeral}`
  if (plateName) plateName.textContent = c.name
  if (plateVoices) plateVoices.textContent = `${c.voices} · ${c.after}`
  const spans = Array.from(marksEl.children)
  for (let i = 0; i < spans.length; i++) spans[i]?.classList.toggle('here', i === chapter)
}

interface Chip {
  el: HTMLButtonElement
  slug: string
  chapter: number
}
const chipList: Chip[] = []
for (const s of atlas.stars) {
  const w = roster.get(s.slug)
  if (!w) continue
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'star-chip'
  b.textContent = w.name
  b.style.visibility = 'hidden'
  b.addEventListener('click', () => openPane(s.slug))
  chipsEl.appendChild(b)
  chipList.push({ el: b, slug: s.slug, chapter: s.chapter })
}

function stepChapter(dir: number): void {
  chapter = (chapter + dir + CONSTELLATIONS.length) % CONSTELLATIONS.length
  chapterChangedAt = elapsed
  atlas.setChapter(chapter)
  if (reducedMotion) atlas.snap(chapter)
  setPlate()
}

const paneKicker = paneEl.querySelector('.pane-kicker') as HTMLElement | null
const paneName = paneEl.querySelector('.pane-name') as HTMLElement | null
const paneTradition = paneEl.querySelector('.pane-tradition') as HTMLElement | null
const paneYears = paneEl.querySelector('.pane-years') as HTMLElement | null
const panePromise = paneEl.querySelector('.pane-promise') as HTMLElement | null
const paneEnter = paneEl.querySelector('.pane-enter') as HTMLButtonElement | null
const paneDrawn = paneEl.querySelector('.pane-drawn') as HTMLElement | null
const paneSiblings = paneEl.querySelector('.pane-siblings') as HTMLElement | null
const panePortrait = paneEl.querySelector('.pane-portrait img') as HTMLImageElement | null
const paneClose = paneEl.querySelector('.pane-close') as HTMLButtonElement | null
/** whose pane is open, which is also whose museum the button enters */
let paneSlug = ''

function openPane(slug: string): void {
  const ci = CONSTELLATIONS.findIndex((c) => c.stars.some((s) => s.slug === slug))
  const c = CONSTELLATIONS[ci]
  const star = c?.stars.find((s) => s.slug === slug)
  const w = roster.get(slug)
  if (!c || !star || !w) return
  paneSlug = slug
  if (ci !== chapter) {
    chapter = ci
    chapterChangedAt = elapsed
    atlas.setChapter(ci)
    setPlate()
  }
  if (paneKicker) paneKicker.textContent = `Constellation ${c.numeral} · ${c.name}`
  if (paneName) paneName.textContent = w.name
  if (paneTradition) paneTradition.textContent = star.tradition
  if (paneYears) paneYears.textContent = w.years
  if (panePromise) panePromise.textContent = star.promise
  // the wheel promises only what the register can answer
  const wing = wingBySlug(slug)
  if (paneEnter) paneEnter.hidden = !wing
  if (paneDrawn) paneDrawn.hidden = Boolean(wing)
  if (panePortrait) {
    panePortrait.src = mediaUrl(`/images/figures/${slug}/main/900.webp`)
    panePortrait.alt = `AI-generated portrait of ${w.name}`
  }
  const sibLabel = paneEl.querySelector('.pane-sib-label')
  if (sibLabel) sibLabel.textContent = `Also among the ${c.name}`
  if (paneSiblings) {
    paneSiblings.textContent = ''
    for (const sib of c.stars) {
      if (sib.slug === slug) continue
      const sw = roster.get(sib.slug)
      if (!sw) continue
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'pane-sibling'
      b.textContent = sw.name
      b.addEventListener('click', () => openPane(sib.slug))
      paneSiblings.appendChild(b)
    }
  }
  paneOpen = true
  paneEl.hidden = false
  document.body.classList.add('pane-open')
  requestAnimationFrame(() => requestAnimationFrame(() => paneEl.classList.add('lit')))
  // the sky chrome steps back while a figure holds the frame
  plateEl.classList.remove('lit')
  inviteEl.classList.remove('lit')
  marksEl.classList.remove('lit')
}

function closePane(): void {
  paneOpen = false
  paneEl.classList.remove('lit')
  document.body.classList.remove('pane-open')
  paneEl.hidden = true
  if (phase === 'wheel') {
    plateEl.classList.add('lit')
    inviteEl.classList.add('lit')
    marksEl.classList.add('lit')
  }
}

paneClose?.addEventListener('click', () => closePane())
paneEl.addEventListener('click', (e) => {
  if (e.target === paneEl) closePane()
})
paneEnter?.addEventListener('click', () => enterWing(paneSlug))
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paneOpen) closePane()
})

/** dress or strike the sky's letterpress in one move */
const skyReturnEl = document.getElementById('sky-return')
skyReturnEl?.addEventListener('click', () => returnToFire())
function skyDress(on: boolean): void {
  plateEl.classList.toggle('lit', on)
  inviteEl.classList.toggle('lit', on)
  marksEl.classList.toggle('lit', on)
  if (skyReturnEl) {
    skyReturnEl.hidden = false
    skyReturnEl.classList.toggle('lit', on)
  }
  chipsEl.hidden = !on
  if (on) inviteEl.textContent = SKY_INVITE
  if (!on) closePane()
}

const chipProject = new Vector3()
interface ChipPlace {
  chip: Chip
  x: number
  y: number
  half: number
  above: boolean
}
function syncChips(): void {
  const settled = phase === 'wheel' && !paneOpen && elapsed - chapterChangedAt > 0.9
  const places: ChipPlace[] = []
  for (const chip of chipList) {
    const on = settled && chip.chapter === chapter && atlasReveal > 0.6
    if (!on) {
      chip.el.classList.remove('lit')
      chip.el.style.visibility = 'hidden'
      continue
    }
    // narrow stages call the names the way the register does
    const w = roster.get(chip.slug)
    const label = camera.aspect < 0.9 ? (w?.short ?? w?.name ?? '') : (w?.name ?? '')
    if (chip.el.textContent !== label) chip.el.textContent = label
    const star = atlas.stars.find((s) => s.slug === chip.slug)
    if (!star) continue
    star.sprite.updateWorldMatrix(true, false)
    chipProject.setFromMatrixPosition(star.sprite.matrixWorld).project(camera)
    if (chipProject.z > 1 || Math.abs(chipProject.x) > 0.96) {
      chip.el.classList.remove('lit')
      chip.el.style.visibility = 'hidden'
      continue
    }
    // ridge stars carry their names above, valley stars below; edges
    // clamp inside the frame
    chip.el.style.visibility = 'visible'
    const above = star.sprite.position.y >= 0
    const half = chip.el.offsetWidth / 2 || 40
    const x = Math.min(
      Math.max((chipProject.x * 0.5 + 0.5) * innerWidth, half + 8),
      innerWidth - half - 8
    )
    const y = (-chipProject.y * 0.5 + 0.5) * innerHeight + (above ? -48 : 24)
    places.push({ chip, x, y, half, above })
  }
  // a tiny label solver: any two names that would touch step apart along
  // their own side of the sky until every name has clear air
  for (let i = 0; i < places.length; i++) {
    const a = places[i]
    if (!a) continue
    for (let guard = 0; guard < 4; guard++) {
      let bumped = false
      for (let j = 0; j < i; j++) {
        const b = places[j]
        if (!b) continue
        const overlapX = Math.abs(a.x - b.x) < a.half + b.half + 10
        const overlapY = Math.abs(a.y - b.y) < 26
        if (overlapX && overlapY) {
          // one gentle step per round, or crowded rows leapfrog their stars
          a.y += a.above ? -26 : 26
          bumped = true
          break
        }
      }
      if (!bumped) break
    }
  }
  for (const p of places) {
    p.chip.el.style.left = `${p.x}px`
    p.chip.el.style.top = `${p.y}px`
    p.chip.el.classList.add('lit')
  }
}

/** From the sky back down to the hearth, the gaze easing all the way. */
function returnToFire(): void {
  if (phase !== 'wheel') return
  setPhase('agora')
  lookUp = 1 // land the gaze from above, no snap
  lookTarget = 0
}

// ---- the descent staging: through the ring, then the plumb-line dive
// into the agora mandala. ONE gesture carries the whole travel. ----
const GATE_END = 0.16 // corona bloom, one black breath, then above the ring
const smooth = (a: number, b: number, k: number): number => {
  const t = Math.min(1, Math.max(0, (k - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The dolly, concept-01 law: every camera value is a pure channel of
    progress, position + lookAt on a slow helix. The flip into the
    top-down view hides inside the black breath; the spiral carries the
    dive; the flare banks to the seated eye at the fire. */
// the flip waits until the moon has fully swallowed the frame (door
// completes at GATE_END): the turn happens inside true black
const dCamY = channel([
  { p: 0, v: 0 }, { p: 0.15, v: 0 },
  { p: 0.28, v: 58, e: 'sineInOut' },
  { p: 0.50, v: 40, e: 'sineInOut' },
  { p: 0.70, v: 23, e: 'sineInOut' },
  { p: 0.82, v: 13, e: 'sineInOut' },
  { p: 0.90, v: 5, e: 'sineInOut' },
  { p: 0.948, v: 0, e: 'sineInOut' },
])
const dCamR = channel([
  { p: 0, v: 0.001 }, { p: 0.15, v: 0.001 },
  { p: 0.28, v: 32, e: 'sineInOut' },
  { p: 0.50, v: 36, e: 'sineInOut' },
  { p: 0.70, v: 38, e: 'sineInOut' },
  { p: 0.82, v: 37, e: 'sineInOut' },
  { p: 0.90, v: 32, e: 'sineInOut' },
  { p: 0.948, v: 0, e: 'sineInOut' },
])
const dCamTh = channel([
  { p: 0, v: 0 }, { p: 0.28, v: -0.30 },
  { p: 0.70, v: 0.22, e: 'sineInOut' },
  { p: 0.948, v: 0, e: 'sineInOut' },
])
const dLookX = channel([{ p: 0, v: 0 }, { p: 1, v: 0 }])
const dLookY = channel([
  { p: 0, v: 0 }, { p: 0.06, v: 1.35, e: 'sineInOut' },
  { p: 0.15, v: 1.35 }, { p: 0.28, v: 4, e: 'sineInOut' },
  { p: 0.82, v: 3, e: 'sineInOut' },
  { p: 0.948, v: -Math.tan(0.12) * 5.6, e: 'sineInOut' },
])
const dLookZ = channel([
  { p: 0, v: -10 }, { p: 0.15, v: -10 },
  { p: 0.28, v: 0, e: 'sineInOut' }, { p: 0.88, v: 0 },
  { p: 0.948, v: -5.6, e: 'sineInOut' },
])
const descentLook = new Vector3()
function descentCamera(k: number): void {
  const th = dCamTh(k)
  const r = dCamR(k)
  camera.position.set(Math.sin(th) * r, dCamY(k), Math.cos(th) * r)
  descentLook.set(dLookX(k), dLookY(k), dLookZ(k))
  camera.lookAt(descentLook)
}




// the impatient door on the totality screen: straight down to the fire
document.getElementById('overture-skip')?.addEventListener('click', () => {
  if (phase !== 'held' && phase !== 'transit') return
  wakeMusic()
  transit = 1
  if (phase === 'held') setPhase('descent')
  descTarget = 1
  desc = Math.max(desc, 0.93)
})

// ---- the instrument rail: the plain-faced layer over the poetry ----
const railNode = document.getElementById('rail')
const railSound = document.getElementById('rail-sound')
const railInstruments = document.getElementById('rail-instruments')
const instrumentsNode = document.getElementById('instruments')
if (!railNode || !railSound || !railInstruments || !instrumentsNode) throw new Error('missing rail')
const railEl: HTMLElement = railNode
const instrumentsEl: HTMLElement = instrumentsNode

function syncSoundLabel(): void {
  railSound?.setAttribute('aria-pressed', ambience.on() ? 'true' : 'false')
  if (railSound) railSound.textContent = ambience.on() ? 'Sound · On' : 'Sound · Off'
}
railSound?.addEventListener('click', () => {
  if (ambience.on()) ambience.disable()
  else ambience.enable()
  syncSoundLabel()
})
railInstruments?.addEventListener('click', () => {
  const open = instrumentsEl.hidden
  instrumentsEl.hidden = !open
  railInstruments.setAttribute('aria-expanded', open ? 'true' : 'false')
})
instrumentsEl.querySelector('.inst-close')?.addEventListener('click', () => {
  instrumentsEl.hidden = true
  railInstruments?.setAttribute('aria-expanded', 'false')
})
syncSoundLabel()
// (music standard: wakeMusic() fires with the first gesture that opens
// the descent, for first and returning nights alike)

// a voice holding the floor ducks the ambient bed
addEventListener('na-voice', (e) => {
  ambience.duck(Boolean((e as CustomEvent).detail))
})

// each poem line appears once, at its appointed threshold
const spokenVerses = new Set<string>()
let verseTimer = 0
function verseShow(line: string, holdMs = 5600): void {
  if (spokenVerses.has(line)) return
  spokenVerses.add(line)
  verseEl.textContent = line
  verseEl.classList.add('lit')
  window.clearTimeout(verseTimer)
  verseTimer = window.setTimeout(() => verseEl.classList.remove('lit'), holdMs)
}

// forge hook: lets the screenshot rig drive deterministic states
declare global {
  interface Window {
    __forge?: {
      jump: (
        p: ForgeState,
        opts?: {
          desc?: number
          transit?: number
          skyBirth?: number
          sinceFlash?: number
          keeper?: number
          chapter?: number
          figure?: string
          /** which wing a `wing` or `pane` state stands in */
          slug?: string
          /** Shell close-ups for THE EYES; the journey uses real input. */
          shell?: 'instruments'
        }
      ) => void
      freeze: (t: number) => void
      state: () => {
        phase: Phase
        agoraReveal: number
        desc: number
        draws: number
        tris: number
      }
    }
  }
}
// ---- THE MUSEUM'S ROUTE: / is the lobby, /w/<slug> is a wing ----
const wingFrame = createWingFrame(wingEl, () => toLobby())
let wingSlug = ''

/** A wing's own address, with the station the visitor stood at. */
function wingPath(): { slug: string; station: number } | null {
  const m = /^\/w\/([a-z0-9-]{1,64})\/?$/.exec(location.pathname)
  return m?.[1] === undefined ? null : { slug: m[1], station: stationFromHash() }
}

/** Stand in a wing. The overture is never replayed to get here. */
async function openWing(slug: string, at: number): Promise<void> {
  const entry = wingBySlug(slug)
  if (!entry) {
    toLobby()
    return
  }
  wingSlug = slug
  setPhase('wing') // the room is claimed before its module arrives
  const mod = await entry.load()
  if (wingSlug !== slug) return // the visitor left while it loaded
  wingFrame.open(entry, mod.createWing(), at)
}

/** One gold breath, then a hard cut into the wing that was chosen. */
function enterWing(slug: string): void {
  if (!wingBySlug(slug)) return
  closePane()
  setPhase('breath')
  breath.begin(() => {
    history.pushState({}, '', `/w/${slug}${location.search}`)
    void openWing(slug, 0)
  })
}

/** The way home lands at the wheel, where the choosing happens, never at
    the eclipse: a museum whose every entry replays the overture is a
    museum you see once. */
function toLobby(): void {
  wingFrame.close()
  wingSlug = ''
  if (location.pathname !== '/') history.pushState({}, '', `/${location.search}`)
  setPhase('wheel')
  atlas.snap(chapter)
  atlasReveal = 1
  atlas.visible(true)
  camera.rotation.set(atlas.currentElevation(), 0, 0)
}

// the browser's own back and forward walk the same two addresses
addEventListener('popstate', () => {
  const here = wingPath()
  if (here) void openWing(here.slug, here.station)
  else if (phase === 'wing') toLobby()
})

// the lobby's plate: what the register can answer for, said once
if (lobbyPlate) lobbyPlate.textContent = wingCount(wingsOpen(), wingsPreparing())

window.__forge = {
  jump(state, opts = {}) {
    document.body.classList.add('forge') // DOM beats compose instantly
    // the rig proves the state it ASKED for took, which the phase alone
    // cannot say: the pane is the wheel with a figure held open
    document.body.dataset['forge'] = 'pending'
    const p: Phase = state === 'pane' ? 'wheel' : state
    setPhase(p)
    // each jump is a single composed moment: no scene leaks across
    if (p !== 'breath') breath.stop()
    window.clearTimeout(voiceTimerA)
    window.clearTimeout(voiceTimerB)
    voiceEl2.classList.remove('lit', 'clean')
    transit = opts.transit ?? (p === 'transit' ? 0.5 : 1)
    desc = descTarget = p === 'descent' ? (opts.desc ?? 0.5) : p === 'transit' || p === 'held' ? 0 : 1
    door = p === 'transit' || p === 'held' ? 0 : Math.min(1, desc / 0.18)
    skyBirth =
      opts.skyBirth ??
      (p === 'transit' || p === 'held' ? 0
      : p === 'descent' ? smooth(0.2, 0.98, desc) * 0.8
      : p === 'breath' ? 0.12
      : p === 'wheel' ? 0
      : p === 'agora' ? 1
      : 1)
    flashAt = elapsed - (opts.sinceFlash ?? 999)
    agoraReveal =
      p === 'agora' || p === 'wheel' ? 1
      : p === 'descent' ? smooth(0.95, 0.998, desc)
      : 0
    lookUp = lookTarget = p === 'wheel' ? 1 : 0
    camera.position.y = 0
    if (p === 'descent') {
      descentCamera(desc)
    }
    if (p === 'agora') {
      agoraEnteredAt = Math.max(0, elapsed - 2)
      camera.rotation.x = -0.12
    }
    if (p === 'wheel') {
      chapter = opts.chapter ?? 0
      atlas.snap(chapter)
      atlasReveal = 1
      atlas.visible(true)
      chapterChangedAt = -99
      setPlate()
      skyDress(true)
      camera.rotation.set(atlas.currentElevation(), 0, 0)
      const held = state === 'pane' ? (opts.slug ?? opts.figure) : opts.figure
      if (held) openPane(held)
      else closePane()
    } else {
      atlasReveal = 0
      atlas.visible(false)
      skyDress(false)
    }
    if (p !== 'agora' && p !== 'wheel' && p !== 'descent')
      camera.rotation.set(0, 0, 0)
    railEl.hidden = p === 'transit' || p === 'held' || p === 'breath'
    if (opts.keeper) {
      keeperEl.hidden = false
      keeperScene.forgeStage(opts.keeper)
      verseEl.classList.remove('lit') // the verse is long gone by the exchange
    }
    if (p === 'breath') breath.forgeStage()
    // Additive shell staging, explicitly allowed by the commission's eyes loop.
    instrumentsEl.hidden = opts.shell !== 'instruments'
    railInstruments?.setAttribute('aria-expanded', String(opts.shell === 'instruments'))
    if (p === 'wing') {
      // a wing loads its own module, so this state lands a frame later:
      // the rig waits on the marker rather than on a guessed delay
      void openWing(opts.slug ?? WINGS[0]?.slug ?? '', 0).then(() => {
        document.body.dataset['forge'] = state
      })
      return
    }
    document.body.dataset['forge'] = state
  },
  freeze(t) {
    elapsed = t
    frozen = true
  },
  // the rig's stethoscope: read the live blend state without guessing
  // from pixels (numbers first, then the shot)
  state() {
    return {
      phase,
      agoraReveal,
      desc,
      // what the last frame actually cost: the rig quotes this instead of
      // guessing from a software-rasterizer fps number
      draws: renderer.info.render.drawCalls,
      tris: renderer.info.render.triangles,
      cam: {
        p: camera.position.toArray(),
        r: camera.rotation.toArray().slice(0, 3),
        fov: camera.fov,
        proj: camera.projectionMatrix.elements.slice(0, 4),
      },
    }
  },
}

const TRANSIT_SECONDS = 2.0

function setPhase(next: Phase): void {
  phase = next
  document.body.dataset['phase'] = next
  if (next === 'held') setStatus('Scroll to enter')
  if (next === 'descent') {
    wakeMusic() // reaching the descent IS the first gesture
    setStatus('Scroll to descend')
    descentEl.hidden = false
  } else {
    descentEl.hidden = true
  }
  if (next === 'agora') {
    agoraEnteredAt = elapsed
    lookTarget = 0
    lookUp = 0
    keeperScene.setScript(FIRE_SCRIPT)
    keeperEl.hidden = true
    setStatus('The night agora · scroll to look up')
    verseShow('Questions shine within you')
  }
  if (next === 'wheel') {
    setStatus('')
    chapterChangedAt = elapsed
    setPlate()
    skyDress(true)
    if (reducedMotion) atlas.snap(chapter)
  } else {
    skyDress(false)
  }
  if (next === 'breath' || next === 'wing') {
    setStatus('')
    verseEl.classList.remove('lit') // the cut carries no letterpress
    railEl.hidden = true
  } else if (musicWoken) {
    railEl.hidden = false
  }
  if (next !== 'wing' && wingSlug) {
    wingSlug = ''
    wingFrame.close()
  }
  hotspots.set(next === 'agora' ? HUB_SPOTS : [])
  // every stage is the SEATED eye at the origin
  camera.position.set(0, 0, 0)
  camera.rotation.set(next === 'agora' ? -0.12 : 0, 0, 0)
  if (camera.fov !== 46) {
    camera.fov = 46
    camera.updateProjectionMatrix()
  }
}

function setStatus(text: string): void {
  if (status) status.textContent = text
}

// ---- input: scroll is the only verb ----
function push(delta: number): void {
  if (phase === 'transit') return
  if (phase === 'held' && delta > 0) setPhase('descent')
  if (phase === 'descent') {
    // ONE gesture is the whole descent: the first push down commits the
    // travel and the plates turn the visitor into the lobby. A push back
    // before the gate has bloomed returns to the eclipse.
    if (delta > 0) descTarget = 1
    else if (desc < GATE_END) {
      descTarget = 0
      if (desc < 0.02) setPhase('held')
    }
  }
  if (phase === 'agora') {
    // the lobby's one verb: the gaze rises to the wheel
    if (agoraEnteredAt >= 0 && elapsed - agoraEnteredAt < 1.6) return
    lookTarget = Math.min(1, Math.max(0, lookTarget + delta * 0.0009))
  }
  // the wheel of the night: scroll or swipe steps the carousel, wrapping.
  // A short cooldown makes one gesture one step and keeps the look-up
  // momentum from bleeding into the wheel.
  if (phase === 'wheel') {
    if (elapsed - chapterChangedAt < 0.8) return
    if (paneOpen) return
    if (Math.sign(delta) !== Math.sign(skyAcc)) skyAcc = 0
    skyAcc += delta
    if (Math.abs(skyAcc) > 150) {
      // the wheel turns both ways; the way home is its own visible mark
      stepChapter(skyAcc > 0 ? 1 : -1)
      skyAcc = 0
    }
  }
}

addEventListener('wheel', (e) => push(e.deltaY), { passive: true })
addEventListener('keydown', (e) => {
  // the visitor is writing or choosing, not steering
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') push(160)
  if (e.key === 'ArrowUp' || e.key === 'PageUp') push(-160)
  // in the sky the carousel also answers left and right
  if (phase === 'wheel' && !paneOpen) {
    if (e.key === 'ArrowRight') stepChapter(1)
    if (e.key === 'ArrowLeft') stepChapter(-1)
  }
  if (e.key === 'Enter' && phase === 'transit') transit = 1
})
let touchY: number | null = null
let touchX: number | null = null
addEventListener('touchstart', (e) => {
  // a second finger arriving restarts the measurement from its midpoint,
  // or the first frame of a two-finger gesture jumps the gaze
  const two = e.touches.length > 1
  const a = e.touches[0]
  const b = e.touches[1]
  touchY = two && a && b ? (a.clientY + b.clientY) / 2 : (a?.clientY ?? null)
  touchX = two && a && b ? (a.clientX + b.clientX) / 2 : (a?.clientX ?? null)
}, { passive: true })
addEventListener('touchend', (e) => {
  // and a finger leaving does the same, so the walk never lurches
  const a = e.touches[0]
  touchY = a?.clientY ?? null
  touchX = a?.clientX ?? null
}, { passive: true })
addEventListener('touchmove', (e) => {
  // two fingers move together: their midpoint is the gesture
  const twoFinger = e.touches.length > 1
  const t0 = e.touches[0]
  const t1 = e.touches[1]
  const y = twoFinger && t0 && t1 ? (t0.clientY + t1.clientY) / 2 : t0?.clientY
  const x = twoFinger && t0 && t1 ? (t0.clientX + t1.clientX) / 2 : t0?.clientX
  if (y === undefined || x === undefined || touchY === null || touchX === null) return
  const dy = touchY - y
  const dx = touchX - x
  if (dragAllowed()) {
    // at the fire the finger moves the gaze itself
    applyDrag(-dx, -dy)
  } else {
    // in the sky a horizontal swipe is the natural carousel gesture; the
    // dominant axis wins so diagonals never double-count
    push(phase === 'wheel' && Math.abs(dx) > Math.abs(dy) ? dx * 3 : dy * 3)
  }
  touchY = y
  touchX = x
}, { passive: true })
let lastMouseX = 0
let lastMouseY = 0
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return
  // movementX/Y is not filled in by every driver (headless chromium among
  // them): the hand's own delta is the honest source
  const dx = e.clientX - lastMouseX
  const dy = e.clientY - lastMouseY
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  if (dragging) applyDrag(-dx, -dy)
})

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// ---- the loop ----
let last = performance.now()
let hidden = false
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden
  last = performance.now()
})

function frame(now: number): void {
  requestAnimationFrame(frame)
  if (hidden) return
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  if (!frozen) elapsed += dt

  if (phase === 'transit') {
    transit = reducedMotion ? 1 : Math.min(1, transit + dt / TRANSIT_SECONDS)
    if (transit >= 1) {
      flashAt = elapsed
      setPhase('held')
    }
  }

  // the descent: one gesture is the whole travel down. The eclipse gate
  // opens itself in the first fifth and the agora materializes below.
  desc += (descTarget - desc) * Math.min(1, dt * 2.4)
  if (reducedMotion) desc = descTarget
  const doorTarget = phase === 'transit' || phase === 'held' ? 0 : Math.min(1, desc / GATE_END)
  door += (doorTarget - door) * Math.min(1, dt * 4)
  if (reducedMotion) door = doorTarget
  if (phase === 'descent') {
    descentCamera(desc)
    if (desc > 0.993) {
      camera.position.y = 0
      setPhase('agora')
    }
  }

  // the map carries the whole dive; the territory only wakes at the very
  // cut, once the camera has leveled (from above, the flame billboard
  // would fill the frame with streaks)
  const mandalaReveal =
    phase === 'descent' ? smooth(0.26, 0.36, desc) * (1 - smooth(0.915, 0.948, desc)) : 0
  mandala.visible(mandalaReveal > 0.004)
  // the heart warms at overview altitude and yields before the close
  // pass, or its glow would paint the whole near frame beige
  mandala.update(
    dt,
    elapsed,
    mandalaReveal,
    smooth(0.55, 0.89, desc),
    desc
  )

  const revealTarget =
    phase === 'agora' ? 1
    // looking up, the court is scenery: it still frames the sky from below,
    // but its own embers stop cutting across the wheel's letterpress (and the
    // heaviest fragment shader in the night stops paying full price)
    : phase === 'wheel' ? 0.72
    : phase === 'descent' ? smooth(0.95, 0.998, desc)
    : 0
  // a wing owns its own room: the lobby's court strikes fast so nothing
  // of the fire is left standing behind the first station
  // the fire materializes briskly on arrival (the wait read as lag);
  // every other blend keeps the night's slow breath
  agoraReveal +=
    (revealTarget - agoraReveal) *
    Math.min(1, dt * (reducedMotion ? 20 : phase === 'agora' ? 2.2 : 1.2))

  if (phase === 'agora') {
    lookUp += (lookTarget - lookUp) * Math.min(1, dt * 4)
    if (reducedMotion) lookUp = lookTarget
    camera.rotation.x = -0.12 + lookUp * 0.78
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2.2)
    // the sky opens only while the gaze is RISING toward it: on the
    // way home lookUp starts at 1 and one 60fps easing step still
    // sits above the threshold — without the target guard the return
    // bounced straight back into the sky (frame-rate dependent; the
    // slow headless eye never saw it)
    if (lookTarget > 0.9 && lookUp > 0.93) setPhase('wheel')
    if (agoraEnteredAt >= 0 && elapsed - agoraEnteredAt > 0.5) keeperEl.hidden = false
  } else if (phase !== 'wheel') {
    keeperEl.hidden = true
  }

  // stars are born at totality and burn FULL at the fire (the lobby is
  // the one place the whole firmament belongs to the visitor). In the
  // constellation sky they leave entirely: the six houses own that
  // night, and inside the breath the sky withdraws to ember. The
  // heavens are earned by the passage: NONE at the eclipse (the corona
  // owns that frame), blooming bit by bit through the descent, whole
  // when the fire appears
  const birthTarget =
    phase === 'transit' || phase === 'held' ? 0
    : phase === 'descent' ? smooth(0.2, 0.98, desc) * 0.8
    : phase === 'agora' ? 1
    : phase === 'breath' ? 0.12
    : phase === 'wheel' ? 0
    // a wing stands under a quiet field, never on flat black
    : phase === 'wing' ? 0.34
    : 1
  skyBirth += (birthTarget - skyBirth) * Math.min(1, dt * (reducedMotion ? 20 : 0.9))

  const state: EclipseState = {
    transit,
    door,
    skyBirth,
    // in the sky the anonymous sparks recede: the thirty resolve into
    // their six houses (the atlas takes the light over)
    // the anonymous wanderer sparks belong to the birth moment alone:
    // at the hub they read as cheap floating blobs against the true field
    lanterns:
      phase === 'wheel' ? Math.max(0.08, 0.55 * (1 - atlasReveal))
      : phase === 'agora' ? 0.05
      : phase === 'breath' || phase === 'wing' ? 0
      : 0.3,
    sinceFlash: flashAt < 0 ? -1 : elapsed - flashAt,
    elapsed,
  }
  eclipse.update(state)

  // the wheel of the night: the dome carries the six houses around the
  // visitor; the camera only breathes toward the focused elevation
  if (phase === 'wheel') {
    keeperEl.hidden = true
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2)
    camera.rotation.x +=
      (atlas.currentElevation() - camera.rotation.x) * Math.min(1, dt * 2.2)
  }
  atlasReveal +=
    ((phase === 'wheel' ? 1 : 0) - atlasReveal) * Math.min(1, dt * (reducedMotion ? 20 : 1.4))
  atlas.visible(atlasReveal > 0.005)
  atlas.update(dt, elapsed, camera.aspect, atlasReveal)
  syncChips()

  keeperScene.update(dt)
  ambience.update(dt)
  agora.update({ reveal: agoraReveal, elapsed, speak: keeperScene.speak() })

  // the lobby's points breathe in after the arrival breath
  const spotsVisible =
    phase === 'agora' &&
    agoraReveal > 0.6 &&
    agoraEnteredAt >= 0 &&
    elapsed - agoraEnteredAt > 1.4
  hotspots.sync(camera, spotsVisible)

  // free-look: the world answers the hand, a few damped degrees only
  // (render-only offset: every projection reads last frame's matrices,
  // so the letterpress rides the same breath as the world)
  freeLook += (freeLookTarget() - freeLook) * Math.min(1, dt * 2.4)
  freeLookY += (freeLookYTarget() - freeLookY) * Math.min(1, dt * 2.4)
  // the overture never stands still (concept law): a slow breathing
  // drift through the eclipse and the whole descent, deterministic in
  // the rig's frozen clock
  const idleWanted =
    !reducedMotion && (phase === 'transit' || phase === 'held' || phase === 'descent') ? 1 : 0
  idleAmt += (idleWanted - idleAmt) * Math.min(1, dt * 1.2)
  const idleYaw = (Math.sin(elapsed * 0.11) * 0.013 + Math.sin(elapsed * 0.053 + 2.1) * 0.006) * idleAmt
  const idlePitch = (Math.sin(elapsed * 0.083 + 1.3) * 0.009 + Math.sin(elapsed * 0.041) * 0.004) * idleAmt
  // drag inertia glides and the gaze drifts home when the hand rests
  if (!dragging) {
    dragYaw = Math.max(-0.42, Math.min(0.42, dragYaw + dragVX * dt))
    dragPitch = Math.max(-0.2, Math.min(0.2, dragPitch + dragVY * dt))
    dragVX *= Math.exp(-3 * dt)
    dragVY *= Math.exp(-3 * dt)
    if (!dragAllowed()) {
      dragYaw *= Math.exp(-2.5 * dt)
      dragPitch *= Math.exp(-2.5 * dt)
    }
  }
  const baseRx = camera.rotation.x
  const baseRy = camera.rotation.y
  camera.rotation.y -= freeLook * 0.026 - dragYaw - idleYaw
  camera.rotation.x -= freeLookY * 0.018 - dragPitch - idlePitch
  renderer.render(scene, camera)
  camera.rotation.x = baseRx
  camera.rotation.y = baseRy
}

// ---- free-look state: pointer position, eased, phase-gated ----
let pointerNX = 0
let pointerNY = 0
let freeLook = 0
let freeLookY = 0
addEventListener('pointermove', (e) => {
  pointerNX = (e.clientX / innerWidth - 0.5) * 2
  pointerNY = (e.clientY / innerHeight - 0.5) * 2
})

// ---- drag-to-look (state of the art on touch: the frame can never
// hold a world, the hand moves the gaze). Selection stages only; the
// sky keeps its wheel, the descent its rail. Damped, rubber-limited. ----
let dragYaw = 0
let dragPitch = 0
let idleAmt = 0
let dragVX = 0
let dragVY = 0
let dragging = false
function dragAllowed(): boolean {
  return phase === 'agora' && !paneOpen
}
function applyDrag(dx: number, dy: number): void {
  if (!dragAllowed()) return
  dragYaw = Math.max(-0.42, Math.min(0.42, dragYaw - dx * 0.0021))
  dragPitch = Math.max(-0.2, Math.min(0.2, dragPitch - dy * 0.0016))
  dragVX = -dx * 0.0021 * 60
  dragVY = -dy * 0.0016 * 60
}
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  dragging = true
})
addEventListener('pointerup', () => {
  dragging = false
})
addEventListener('pointercancel', () => {
  dragging = false
})
function freeLookAllowed(): boolean {
  if (reducedMotion || frozen) return false
  return phase === 'agora' || phase === 'wheel'
}
function freeLookTarget(): number {
  return freeLookAllowed() ? pointerNX : 0
}
function freeLookYTarget(): number {
  return freeLookAllowed() ? pointerNY : 0
}

/** A visitor who arrives at /w/<slug> came back for the wing, not for the
    overture: the eclipse and the descent are skipped whole. */
function bootRoute(): boolean {
  const here = wingPath()
  if (!here) return false
  if (!wingBySlug(here.slug)) {
    // an address for a wing that does not exist: the night begins where a
    // night begins, and the bar stops claiming a room that is not there
    history.replaceState({}, '', `/${location.search}`)
    return false
  }
  transit = 1
  desc = descTarget = 1
  door = 1
  agoraReveal = 0
  skyBirth = 0.34
  flashAt = -1
  wakeMusic()
  void openWing(here.slug, here.station)
  return true
}

async function main(): Promise<void> {
  try {
    await renderer.init()
  } catch (err) {
    console.error('renderer init failed', err)
    setStatus('This night needs a newer browser')
    return
  }
  if (!bootRoute()) setStatus('First light')
  console.log(`[na] init ok, gpu=${'gpu' in navigator}, hidden=${document.hidden}`)
  let logged = false
  const origRender = frame
  requestAnimationFrame((t) => {
    last = t
    origRender(t)
    if (!logged) {
      logged = true
      console.log('[na] first frame requested')
    }
  })
}

void main()
