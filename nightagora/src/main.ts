import { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createKeeper } from './scenes/keeper'
import { createCrossing } from './scenes/crossing'
import { createCamp } from './scenes/camp'
import { createCouncil } from './scenes/council'
import { createAtlas } from './scenes/atlas'
import { createMandala } from './scenes/mandala'
import { createHotspots } from './core/hotspots'
import { createChapters } from './core/chapters'
import { CAMP_SCRIPT, FIRE_SCRIPT } from './content/keeper-script'
import { ambience } from './core/ambience'
import { COUNCIL_DONE } from './content/council'
import { WANDERERS } from './content/wanderers'
import { CONSTELLATIONS, OPEN_WORLD } from './content/constellations'
import { channel } from './core/motion'
import { mediaUrl } from './content/media'

type Phase = 'transit' | 'held' | 'descent' | 'agora' | 'sky' | 'crossing' | 'camp' | 'council'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const keeper = document.getElementById('keeper')
const descent = document.getElementById('descent')
const descentSkip = document.getElementById('descent-skip')
const verse = document.getElementById('verse')
const voiceDom = document.getElementById('voice')
const traceCard = document.getElementById('trace-card')
const ringflash = document.getElementById('ringflash')
const plate = document.getElementById('constellation-plate')
const invite = document.getElementById('sky-invite')
const marks = document.getElementById('chapter-marks')
const chips = document.getElementById('star-chips')
const pane = document.getElementById('figure-pane')
if (
  !stage || !status || !keeper || !descent || !descentSkip || !verse || !voiceDom ||
  !traceCard || !ringflash || !plate || !invite || !marks || !chips || !pane
)
  throw new Error('missing shell')
const keeperEl: HTMLElement = keeper
const descentEl: HTMLElement = descent
const descentSkipEl: HTMLElement = descentSkip
const descentBeats = Array.from(descentEl.querySelectorAll('.descent-beat')) as HTMLElement[]
const verseEl: HTMLElement = verse
const voiceEl2: HTMLElement = voiceDom
const traceEl: HTMLElement = traceCard
const ringEl: HTMLElement = ringflash
const plateEl: HTMLElement = plate
const inviteEl: HTMLElement = invite
const marksEl: HTMLElement = marks
const chipsEl: HTMLElement = chips
const paneEl: HTMLElement = pane

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scene = new Scene()
const camera = new PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 0)

const eclipse = createEclipse(scene)
const agora = createAgora(scene)
const keeperScene = createKeeper(keeperEl, reducedMotion, () => keeperExit())

/** The keeper's way onward depends on where he stands: at the hub he
    lifts your gaze to the sky, at his hearth he walks you back. */
function keeperExit(): void {
  if (phase === 'camp') returnFromCamp()
  else if (phase === 'agora') lookTarget = 1
}
const crossing = createCrossing(scene, () => setPhase('camp'))
const camp = createCamp(scene)
const council = createCouncil(scene, () => councilEnded())
const atlas = createAtlas(scene)
const mandala = createMandala(scene)

// ---- the cosmos points: the world itself is the menu (contract §s
// hearth/trace/chapters; the wisdom-map sky is the next forge) ----
const hotspotsHost = document.getElementById('hotspots')
if (!hotspotsHost) throw new Error('missing hotspots shell')
const hotspots = createHotspots(hotspotsHost)
const chapters = createChapters('aurelius', 12)

function openHearthNow(): void {
  if (phase !== 'camp' || campHearthOpen) return
  campHearthOpen = true
  keeperScene.setScript(CAMP_SCRIPT)
  keeperEl.hidden = false
}

/** Sitting down is the contract: the first hearth of the night shows
    the Sitting once; after that, every hearth simply opens. */
function openHearth(): void {
  if (phase !== 'camp' || campHearthOpen) return
  if (!gateAccepted) {
    hearthWanted = true
    sittingEl.hidden = false
    return
  }
  openHearthNow()
}

// ---- the being-drawn pane: the honest placeholder (concept law) ----
const drawnNode = document.getElementById('drawn-pane')
const drawnEl: HTMLElement = drawnNode ?? document.createElement('div')
function openDrawn(kicker: string, title: string, promise: string): void {
  const k = drawnEl.querySelector('.drawn-kicker')
  const t = drawnEl.querySelector('.drawn-title')
  const p = drawnEl.querySelector('.drawn-promise')
  if (k) k.textContent = kicker
  if (t) t.textContent = title
  if (p) p.textContent = promise
  drawnEl.hidden = false
}
drawnEl.querySelector('.drawn-close')?.addEventListener('click', () => {
  drawnEl.hidden = true
})

const CAMP_SPOTS = [
  {
    id: 'hearth',
    label: 'The Hearth',
    pos: new Vector3(-0.75, -0.28, -5.2),
    open: () => openHearth(),
  },
  {
    id: 'trace',
    label: 'The Trace',
    pos: new Vector3(0.42, 0.06, -4.55),
    open: () => {
      traceOpen = !traceOpen
    },
  },
  {
    id: 'chapters',
    label: 'His Nights',
    pos: new Vector3(1.82, 0.62, -5.9),
    open: () => chapters.open(),
  },
  {
    id: 'prism',
    label: 'The Prism',
    pos: new Vector3(-2.2, 0.1, -6.6),
    open: () =>
      openDrawn(
        'Chapter III',
        'The Prism',
        'His thought, split into its colors. The prism will be light in this world, not a card.'
      ),
  },
  {
    id: 'quest',
    label: 'The Quest',
    pos: new Vector3(1.05, -0.32, -3.7),
    open: () =>
      openDrawn(
        'Chapter IV',
        'The Quest',
        'A journey across his ground, one honest step at a time.'
      ),
  },
  {
    id: 'hissky',
    label: 'His Sky',
    pos: new Vector3(0.3, 1.55, -7.2),
    open: () =>
      openDrawn(
        'The Wisdom Map',
        'His Sky',
        'His themes as his own constellation, growing brighter as you learn.'
      ),
  },
]
const HUB_SPOTS = [
  {
    id: 'sky',
    label: 'The Sky',
    pos: new Vector3(0, 2.3, -6.2),
    open: () => {
      lookTarget = 1 // the gaze lifts itself; the wheel receives you
    },
  },
  {
    id: 'council',
    label: "Tonight's Council",
    // on the engraved circle BEFORE the fire, never behind the flame
    pos: new Vector3(0, -0.68, -3.7),
    open: () => conveneCouncil(),
  },
  {
    id: 'commons',
    label: 'The Commons',
    pos: new Vector3(-4.6, 0.6, -8.6),
    open: () =>
      openDrawn(
        'The Agora',
        'The Commons',
        'Where visitors will leave marks for one another under the colonnade.'
      ),
  },
]
document.getElementById('inst-library')?.addEventListener('click', () =>
  openDrawn(
    'The Archive',
    'The Library',
    'Every night and every council of the thirty, gathered in one place.'
  )
)

function councilEnded(): void {
  setStatus(COUNCIL_DONE)
  showDoor(false)
}

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
let campReveal = 0
let campYield = 0
let campEnteredAt = -1
let campHearthOpen = false
let traceOpen = false
let voiceTimerA = 0
let voiceTimerB = 0
let chapter = 0
let chapterChangedAt = -99
let paneOpen = false
let skyAcc = 0
let atlasReveal = 0

// ---- the Sitting + the remembered night (concept-revision §2b) ----
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
let gateAccepted = stored('na-gate') === '1'
let firstNight = stored('na-first') !== '1'
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
// the first ride is a rail: scroll alone opens Marcus and enters his
// cosmos. Any deliberate browsing gesture hands the wheel back.
let autoRide = firstNight

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
  autoRide = false // turning the wheel by hand is browsing
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

function openPane(slug: string): void {
  const ci = CONSTELLATIONS.findIndex((c) => c.stars.some((s) => s.slug === slug))
  const c = CONSTELLATIONS[ci]
  const star = c?.stars.find((s) => s.slug === slug)
  const w = roster.get(slug)
  if (!c || !star || !w) return
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
  if (paneEnter) paneEnter.hidden = slug !== OPEN_WORLD
  if (paneDrawn) paneDrawn.hidden = slug === OPEN_WORLD
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
  // a REAL close (pane open, in the sky) is a browsing gesture and the
  // rail lets go; the cleanup calls from phase changes are not
  if (paneOpen && phase === 'sky') autoRide = false
  paneOpen = false
  paneEl.classList.remove('lit')
  document.body.classList.remove('pane-open')
  paneEl.hidden = true
  if (phase === 'sky') {
    plateEl.classList.add('lit')
    inviteEl.classList.add('lit')
    marksEl.classList.add('lit')
  }
}

paneClose?.addEventListener('click', () => closePane())
paneEl.addEventListener('click', (e) => {
  if (e.target === paneEl) closePane()
})
paneEnter?.addEventListener('click', () => {
  closePane()
  beginCrossing()
})
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
    // the way home appears once the wheel is yours, not on the rail
    skyReturnEl.classList.toggle('lit', on && !autoRide)
  }
  chipsEl.hidden = !on
  if (on) {
    // the first night is a rail: the sky itself says so
    inviteEl.textContent = autoRide
      ? 'Scroll on · the first night begins with Marcus Aurelius'
      : 'Open any name to explore their life and ideas.'
  }
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
  const settled = phase === 'sky' && !paneOpen && elapsed - chapterChangedAt > 0.9
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
    // the first night: Marcus's name beckons, three quiet breaths
    if (firstNight && chip.slug === OPEN_WORLD && !chip.el.classList.contains('beckon'))
      chip.el.classList.add('beckon')
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

/** The short-dawn rhyme: one diamond-ring breath carries you home to
    the fire. The council is not forced on the returner: it waits on the
    circle, chosen by its own mark. */
function returnFromCamp(): void {
  if (phase !== 'camp') return
  ringEl.classList.add('lit')
  window.setTimeout(() => {
    setPhase('agora')
    campReveal = 0 // the cut hides inside the ring's white breath
    ringEl.classList.remove('lit')
    ringEl.classList.add('passing')
    window.setTimeout(() => ringEl.classList.remove('passing'), 1200)
  }, 460)
}

/** The circle convenes only when asked. */
function conveneCouncil(): void {
  if (phase !== 'agora') return
  setPhase('council')
  council.begin()
}

/** From the sky back down to the hearth, the gaze easing all the way. */
function returnToFire(): void {
  if (phase !== 'sky') return
  setPhase('agora')
  lookUp = 1 // land the gaze from above, no snap
  lookTarget = 0
}

// ---- the descent staging: through the ring, then the plumb-line dive
// into the agora mandala, one question per breath, then the flare ----
const GATE_END = 0.16 // corona bloom, one black breath, then above the ring
const smooth = (a: number, b: number, k: number): number => {
  const t = Math.min(1, Math.max(0, (k - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// the overture stays clean: a title card in the black breath, then eight
// questions drifting past on the way down. The Echo disclosure lives
// where the figures speak (pane ink, keeper colophon, council cartouche).
const DESCENT_STATIONS: Array<[number, number]> = [
  [0.06, 0.2], // the disclosure stone, carved in the black (read in passing)
  [0.24, 0.34], // The Descent · eight questions (over the emerging ring)
  [0.38, 0.435], // Who am I?
  [0.448, 0.503], // What binds us to each other?
  [0.516, 0.571], // What makes a life worth living?
  [0.584, 0.639], // Where do ideas come from?
  [0.652, 0.707], // How should we live?
  [0.72, 0.775], // What does it mean to be free?
  [0.788, 0.843], // What lies beyond what we know?
  [0.856, 0.911], // How do we carry what we have lost?
]

/** The dolly, concept-01 law: every camera value is a pure channel of
    progress, position + lookAt on a slow helix. The flip into the
    top-down view hides inside the black breath; the spiral carries the
    dive; the flare banks to the seated eye at the fire. */
// the flip waits until the moon has fully swallowed the frame (door
// completes at GATE_END): the turn happens inside true black
const dCamY = channel([
  { p: 0, v: 0 },
  { p: 0.15, v: 0 },
  { p: 0.28, v: 66, e: 'sineInOut' },
  { p: 0.995, v: 0, e: 'sineInOut' },
])
const dCamR = channel([
  { p: 0, v: 0.001 },
  { p: 0.15, v: 0.001 },
  { p: 0.28, v: 7, e: 'sineInOut' },
  { p: 0.7, v: 4.5 },
  { p: 0.995, v: 0.001, e: 'cubicInOut' },
])
const dCamTh = channel([
  { p: 0, v: 0 },
  { p: 0.28, v: 0 },
  { p: 0.995, v: 2.6, e: 'sineInOut' },
])
// gaze: the disc's heart through the dive, banking to the fire for landing
const dLookX = channel([
  { p: 0, v: 0 },
  { p: 0.88, v: 0 },
  { p: 0.995, v: 0, e: 'sineInOut' },
])
const dLookY = channel([
  // starts exactly on the held gaze (level), lifting into the eclipse's
  // heart as the zoom begins: the first scroll must not snap the view
  { p: 0, v: 0 },
  { p: 0.06, v: 1.35, e: 'sineInOut' },
  { p: 0.15, v: 1.35 },
  { p: 0.28, v: -0.9, e: 'sineInOut' },
  { p: 0.88, v: -0.9 },
  { p: 0.995, v: -0.68, e: 'sineInOut' },
])
const dLookZ = channel([
  { p: 0, v: -10 },
  { p: 0.15, v: -10 },
  { p: 0.28, v: 0, e: 'sineInOut' },
  { p: 0.88, v: 0 },
  { p: 0.995, v: -5.6, e: 'sineInOut' },
])
const descentLook = new Vector3()
function descentCamera(k: number): void {
  const th = dCamTh(k)
  const r = dCamR(k)
  camera.position.set(Math.sin(th) * r, dCamY(k), Math.cos(th) * r)
  descentLook.set(dLookX(k), dLookY(k), dLookZ(k))
  camera.lookAt(descentLook)
}

/** The questions drift past with parallax: each line rises through the
    frame as the visitor falls, near lines faster than far ones. */
function syncDescentBeats(k: number): void {
  for (let i = 0; i < descentBeats.length; i++) {
    const beat = descentBeats[i]
    const range = DESCENT_STATIONS[i]
    if (!beat || !range) continue
    const mid = (range[0] + range[1]) / 2
    const half = (range[1] - range[0]) / 2
    const p = (k - mid) / (half * 1.55)
    if (Math.abs(p) > 1.1) {
      beat.style.opacity = '0'
      continue
    }
    // the stone and the title card hold nearly still; every question
    // travels past
    const travel = i <= 1 ? 9 : 34 + (i % 3) * 9
    const scale = i <= 1 ? 1 : 1 + p * 0.045
    beat.style.opacity = String(Math.max(0, 1 - Math.pow(Math.abs(p), 1.6)))
    beat.style.transform = `translate3d(0, ${(-p * travel).toFixed(2)}vh, 0) scale(${scale.toFixed(3)})`
  }
}

function skipDescent(): void {
  if (phase !== 'descent') return
  descTarget = 1
  desc = Math.max(desc, 0.93)
}
document.getElementById('descent-skip')?.addEventListener('click', () => skipDescent())

// ---- THE SITTING: the night's one contract, taken at the first
// hearth (terms + age 16 in one declarative action; legal basis:
// transparency memo 01; storage per § 25 Abs. 2 Nr. 2 TDDDG). The
// black-breath stone above is information only; passive listening
// stays ungated. ----
const sittingNode = document.getElementById('sitting')
const sittingEl: HTMLElement = sittingNode ?? document.createElement('div')
let hearthWanted = false

function acceptSitting(): void {
  if (gateAccepted) return
  gateAccepted = true
  store('na-gate', '1')
  sittingEl.hidden = true
  if (hearthWanted) {
    hearthWanted = false
    openHearthNow()
  }
}
document.getElementById('sitting-accept')?.addEventListener('click', () => acceptSitting())

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

// the council voices hold the floor; the ambient bed steps back
addEventListener('na-voice', (e) => {
  ambience.duck(Boolean((e as CustomEvent).detail))
})

// ---- the Forward Door: after the council, the one door that faces
// the morning ----
const doorNode = document.getElementById('forward-door')
const doorEl: HTMLElement = doorNode ?? document.createElement('div')

function showDoor(instant: boolean): void {
  // the council's letterpress yields the frame to the way onward
  document.getElementById('council-topic')?.classList.remove('lit')
  const names = document.getElementById('council-names')
  if (names) names.hidden = true
  const cartouche = document.getElementById('cartouche')
  if (cartouche) cartouche.hidden = true
  doorEl.hidden = false
  if (instant) doorEl.classList.add('lit')
  else requestAnimationFrame(() => requestAnimationFrame(() => doorEl.classList.add('lit')))
}
function hideDoor(): void {
  doorEl.classList.remove('lit')
  doorEl.hidden = true
}
doorEl.querySelector('.door-stay')?.addEventListener('click', () => {
  hideDoor()
  council.stop()
  setPhase('agora')
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
        p: Phase,
        opts?: {
          desc?: number
          transit?: number
          skyBirth?: number
          sinceFlash?: number
          keeper?: number
          crossing?: 'hatch' | 'portrait' | 'breath'
          camp?: 'trace' | 'hearth'
          chapter?: number
          figure?: string
          coda?: number
        }
      ) => void
      freeze: (t: number) => void
    }
  }
}
// ---- the trace: the carved words at the tent post ----
const traceProjected = new Vector3()
function traceScreenPos(): { x: number; y: number } | null {
  traceProjected.copy(camp.tracePos).project(camera)
  if (traceProjected.z > 1) return null
  return {
    x: (traceProjected.x * 0.5 + 0.5) * innerWidth,
    y: (-traceProjected.y * 0.5 + 0.5) * innerHeight,
  }
}

function syncTrace(): void {
  const p = phase === 'camp' && traceOpen && campReveal > 0.4 ? traceScreenPos() : null
  if (!p) {
    traceEl.hidden = true
    return
  }
  traceEl.style.left = `${Math.min(Math.max(p.x - 150, 16), innerWidth - 320)}px`
  traceEl.style.top = `${Math.max(p.y - 190, 16)}px`
  traceEl.hidden = false
}

const crossingTo = new Vector3()
function beginCrossing(): void {
  if (!atlas.starWorld(OPEN_WORLD, crossingTo)) return
  if (firstNight) {
    firstNight = false
    autoRide = false
    store('na-first', '1')
  }
  setPhase('crossing')
  crossing.begin(crossingTo.clone())
}

addEventListener('click', (e) => {
  if (phase === 'crossing') {
    crossing.skip()
    return
  }
  if (phase === 'camp') {
    const p = traceScreenPos()
    if (p && Math.hypot(p.x - e.clientX, p.y - e.clientY) < 60) traceOpen = !traceOpen
    return
  }
})

window.__forge = {
  jump(p, opts = {}) {
    document.body.classList.add('forge') // DOM beats compose instantly
    setPhase(p)
    // each jump is a single composed moment: no scene leaks across
    if (p !== 'crossing') crossing.stop()
    if (p !== 'council') council.stop()
    if (p !== 'camp') {
      campReveal = 0
      campYield = 0
      window.clearTimeout(voiceTimerA)
      window.clearTimeout(voiceTimerB)
      voiceEl2.classList.remove('lit', 'clean')
    }
    ringEl.classList.remove('lit', 'passing')
    transit = opts.transit ?? (p === 'transit' ? 0.5 : 1)
    desc = descTarget = p === 'descent' ? (opts.desc ?? 0.5) : p === 'transit' || p === 'held' ? 0 : 1
    door = p === 'transit' || p === 'held' ? 0 : Math.min(1, desc / 0.18)
    skyBirth =
      opts.skyBirth ??
      (p === 'transit' ? 0
      : p === 'held' ? 0.75
      : p === 'descent' ? 0.75 - 0.2 * desc
      : p === 'crossing' ? 0.12
      : p === 'camp' ? 0.08
      : p === 'council' ? 0.78
      : p === 'sky' ? 0.4
      : p === 'agora' ? 0.78
      : 1)
    flashAt = elapsed - (opts.sinceFlash ?? 999)
    agoraReveal =
      p === 'agora' || p === 'sky' ? 1
      : p === 'descent' ? smooth(0.95, 0.998, desc)
      : 0
    lookUp = lookTarget = p === 'sky' ? 1 : 0
    camera.position.y = 0
    if (p === 'descent') {
      descentCamera(desc)
      syncDescentBeats(desc)
    }
    if (p === 'agora') {
      agoraEnteredAt = Math.max(0, elapsed - 2)
      camera.rotation.x = -0.12
    }
    if (p === 'sky') {
      chapter = opts.chapter ?? 0
      atlas.snap(chapter)
      atlasReveal = 1
      atlas.visible(true)
      chapterChangedAt = -99
      setPlate()
      skyDress(true)
      camera.rotation.set(atlas.currentElevation(), 0, 0)
      if (opts.figure) openPane(opts.figure)
      else closePane()
    } else {
      atlasReveal = 0
      atlas.visible(false)
      skyDress(false)
    }
    if (p !== 'agora' && p !== 'sky' && p !== 'camp' && p !== 'council' && p !== 'descent')
      camera.rotation.set(0, 0, 0)
    if (p === 'council') {
      agoraReveal = 1
      camera.rotation.set(-0.12, 0, 0)
      verseEl.classList.remove('lit')
      council.forgeStage(camera)
      if (opts.coda) showDoor(true)
    }
    railEl.hidden = p === 'transit' || p === 'held'
    if (p === 'camp') {
      campReveal = 1
      camera.rotation.set(-0.12, 0, 0)
      campYield = opts.camp === 'hearth' ? 1 : 0
      // rig frames are single moments: the arrival voice never overlaps
      window.clearTimeout(voiceTimerA)
      window.clearTimeout(voiceTimerB)
      if (opts.camp) voiceEl2.classList.remove('lit')
      if (opts.camp === 'trace') traceOpen = true
      if (opts.camp === 'hearth') {
        campHearthOpen = true
        keeperScene.setScript(CAMP_SCRIPT)
        keeperEl.hidden = false
        keeperScene.forgeStage(3)
      }
    }
    if (opts.keeper) {
      keeperEl.hidden = false
      keeperScene.forgeStage(opts.keeper)
      verseEl.classList.remove('lit') // the verse is long gone by the exchange
    }
    if (p === 'crossing' && opts.crossing) crossing.forgeStage(opts.crossing)
  },
  freeze(t) {
    elapsed = t
    frozen = true
  },
}

const TRANSIT_SECONDS = 2.8

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
    for (const b of descentBeats) b.style.opacity = '0'
  }
  if (next === 'agora') {
    agoraEnteredAt = elapsed
    lookTarget = 0
    lookUp = 0
    keeperScene.setScript(FIRE_SCRIPT)
    keeperEl.hidden = true
    setStatus(autoRide ? 'The night agora · scroll to look up' : 'The night agora')
    verseShow('Questions shine within you')
  }
  if (next !== 'council') hideDoor()
  if (next === 'sky') {
    setStatus('')
    chapterChangedAt = elapsed
    setPlate()
    skyDress(true)
    if (reducedMotion) atlas.snap(chapter)
  } else {
    skyDress(false)
  }
  if (next === 'crossing') {
    setStatus('')
    verseEl.classList.remove('lit') // a fast chooser carries no verse across
    // one short breath only: the voice line needs the frame to itself
    verseShow('You enter a life through its light', 2900)
  }
  if (next === 'council') {
    setStatus('')
    verseShow('This is the Agora.')
  }
  hotspots.set(next === 'camp' ? CAMP_SPOTS : next === 'agora' ? HUB_SPOTS : [])
  drawnEl.hidden = true
  if (next !== 'camp') {
    sittingEl.hidden = true
    hearthWanted = false
  }
  if (next === 'camp') {
    setStatus('Carnuntum on the Danube')
    campEnteredAt = elapsed
    campHearthOpen = false
    traceOpen = false
    // the sentence begun in space completes on the ground
    window.clearTimeout(voiceTimerA)
    window.clearTimeout(voiceTimerB)
    voiceTimerA = window.setTimeout(() => {
      if (phase !== 'camp') return
      voiceEl2.textContent = 'The Danube is quiet tonight. We can talk.'
      voiceEl2.classList.add('lit', 'clean')
      voiceTimerB = window.setTimeout(() => voiceEl2.classList.remove('lit'), 5600)
    }, 900)
  } else {
    traceOpen = false
    chapters.close()
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
    // the gate blooms in about two flicks; the dive breathes one
    // question per flick. The whole travel scrubs both ways; the stone
    // is read in passing (the contract waits at the first hearth).
    const rate = desc < GATE_END ? 0.0005 : 0.00042
    descTarget = Math.min(1, Math.max(0, descTarget + delta * rate))
    if (descTarget <= 0 && desc < 0.02 && delta < 0) setPhase('held')
  }
  if (phase === 'agora') {
    // ONE grammar per stage (Michel): on the guided first night the
    // scroll still carries you skyward; in free hub life the marks are
    // the only way — scroll rests, selection speaks
    if (!autoRide) return
    if (agoraEnteredAt >= 0 && elapsed - agoraEnteredAt < 1.6) return
    lookTarget = Math.min(1, Math.max(0, lookTarget + delta * 0.0009))
  }
  // the wheel of the night: scroll or swipe steps the carousel, wrapping.
  // A short cooldown makes one gesture one step and keeps the look-up
  // momentum from bleeding into the wheel. On the first night the same
  // scroll rides the rail instead: open Marcus, then enter his cosmos.
  if (phase === 'sky') {
    if (elapsed - chapterChangedAt < 0.8) return
    if (autoRide && delta > 0) {
      if (Math.sign(delta) !== Math.sign(skyAcc)) skyAcc = 0
      skyAcc += delta
      if (Math.abs(skyAcc) > 150) {
        skyAcc = 0
        chapterChangedAt = elapsed // one breath between rail steps
        if (!paneOpen) openPane(OPEN_WORLD)
        else beginCrossing()
      }
      return
    }
    if (paneOpen) return
    if (Math.sign(delta) !== Math.sign(skyAcc)) skyAcc = 0
    skyAcc += delta
    if (Math.abs(skyAcc) > 150) {
      // the wheel turns both ways; the way home is its own visible mark
      stepChapter(skyAcc > 0 ? 1 : -1)
      skyAcc = 0
    }
  }
  if (phase === 'council' && delta > 0 && council.active()) {
    council.stop()
    councilEnded()
  }
}

addEventListener('wheel', (e) => push(e.deltaY), { passive: true })
addEventListener('keydown', (e) => {
  // the visitor is writing or choosing, not steering
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') push(160)
  if (e.key === 'ArrowUp' || e.key === 'PageUp') push(-160)
  // in the sky the carousel also answers left and right
  if (phase === 'sky' && !paneOpen) {
    if (e.key === 'ArrowRight') stepChapter(1)
    if (e.key === 'ArrowLeft') stepChapter(-1)
  }
  if (e.key === 'Enter' && phase === 'transit') transit = 1
  if (e.key === 'Enter' && phase === 'descent') skipDescent()
})
let touchY: number | null = null
let touchX: number | null = null
addEventListener('touchstart', (e) => {
  touchY = e.touches[0]?.clientY ?? null
  touchX = e.touches[0]?.clientX ?? null
}, { passive: true })
addEventListener('touchmove', (e) => {
  const y = e.touches[0]?.clientY
  const x = e.touches[0]?.clientX
  if (y === undefined || x === undefined || touchY === null || touchX === null) return
  const dy = touchY - y
  const dx = touchX - x
  // in the sky a horizontal swipe is the natural carousel gesture; the
  // dominant axis wins so diagonals never double-count
  push(phase === 'sky' && Math.abs(dx) > Math.abs(dy) ? dx * 3 : dy * 3)
  touchY = y
  touchX = x
}, { passive: true })

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

  // the descent: every scroll is a step of the travel down. The eclipse
  // gate opens itself in the first fifth, the agora materializes below,
  // and one question at a time holds the frame.
  desc += (descTarget - desc) * Math.min(1, dt * 2.4)
  if (reducedMotion) desc = descTarget
  const doorTarget = phase === 'transit' || phase === 'held' ? 0 : Math.min(1, desc / GATE_END)
  door += (doorTarget - door) * Math.min(1, dt * 4)
  if (reducedMotion) door = doorTarget
  if (phase === 'descent') {
    descentCamera(desc)
    syncDescentBeats(desc)
    if (desc > 0.36) verseShow('Voices awaken across Time')
    if (desc > 0.993) {
      camera.position.y = 0
      setPhase('agora')
    }
  }

  // the map carries the whole dive; the territory only wakes at the very
  // cut, once the camera has leveled (from above, the flame billboard
  // would fill the frame with streaks)
  const mandalaReveal =
    phase === 'descent' ? smooth(0.26, 0.36, desc) * (1 - smooth(0.93, 0.99, desc)) : 0
  mandala.visible(mandalaReveal > 0.004)
  // the heart warms at overview altitude and yields before the close
  // pass, or its glow would paint the whole near frame beige
  mandala.update(
    dt,
    elapsed,
    mandalaReveal,
    smooth(0.55, 0.78, desc) * (1 - smooth(0.84, 0.93, desc))
  )

  const revealTarget =
    phase === 'agora' || phase === 'sky' || phase === 'council' ? 1
    : phase === 'descent' ? smooth(0.95, 0.998, desc)
    : 0
  agoraReveal += (revealTarget - agoraReveal) * Math.min(1, dt * (reducedMotion ? 20 : 1.2))

  if (phase === 'agora') {
    lookUp += (lookTarget - lookUp) * Math.min(1, dt * 4)
    if (reducedMotion) lookUp = lookTarget
    camera.rotation.x = -0.12 + lookUp * 0.78
    if (lookUp > 0.93) setPhase('sky')
    if (agoraEnteredAt >= 0 && elapsed - agoraEnteredAt > 1.1) keeperEl.hidden = false
  } else if (phase === 'camp') {
    // the hearth opens once the arrival sentence has had its say
    if (!campHearthOpen && campEnteredAt >= 0 && elapsed - campEnteredAt > 6.6) {
      // the auto-open routes through the Sitting: the first hearth of
      // the night asks its one question before the keeper speaks
      openHearth()
    }
  } else if (phase !== 'sky') {
    keeperEl.hidden = true
  }

  // the camp world breathes in with its phase and strikes FAST on the
  // way out: its ink is opaque, and a slow fade leaves ghost silhouettes
  // standing in the agora
  const campTarget = phase === 'camp' ? 1 : 0
  campReveal +=
    (campTarget - campReveal) * Math.min(1, dt * (reducedMotion ? 20 : campTarget ? 1.1 : 3.4))
  if (phase === 'camp') {
    camera.rotation.x += (-0.12 - camera.rotation.x) * Math.min(1, dt * 2)
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2)
  }
  campYield += ((phase === 'camp' && !keeperEl.hidden ? 1 : 0) - campYield) * Math.min(1, dt * 2.5)
  camp.update({ reveal: campReveal, elapsed, yield: campYield })
  syncTrace()

  // stars are born at totality; near the fire they yield to its light,
  // and during the crossing the sky withdraws to ember
  // in the constellation sky the background stars step well back, so
  // the six houses own the night without competition
  const birthTarget =
    phase === 'transit' ? 0
    : phase === 'held' ? 0.75
    : phase === 'descent' ? 0.75 - 0.2 * desc
    : phase === 'agora' || phase === 'council' ? 0.78
    : phase === 'crossing' ? 0.12
    : phase === 'camp' ? 0.08
    : phase === 'sky' ? 0.4
    : 1
  skyBirth += (birthTarget - skyBirth) * Math.min(1, dt * (reducedMotion ? 20 : 0.9))

  const state: EclipseState = {
    transit,
    door,
    skyBirth,
    // in the sky the anonymous sparks recede: the thirty resolve into
    // their six houses (the atlas takes the light over)
    lanterns:
      phase === 'sky' ? Math.max(0.08, 0.55 * (1 - atlasReveal))
      : phase === 'agora' || phase === 'council' ? 0.55
      : phase === 'crossing' || phase === 'camp' ? 0
      : 0.3,
    sinceFlash: flashAt < 0 ? -1 : elapsed - flashAt,
    elapsed,
  }
  eclipse.update(state)

  // the wheel of the night: the dome carries the six houses around the
  // visitor; the camera only breathes toward the focused elevation
  if (phase === 'sky') {
    keeperEl.hidden = true
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2)
    camera.rotation.x +=
      (atlas.currentElevation() - camera.rotation.x) * Math.min(1, dt * 2.2)
  }
  atlasReveal +=
    ((phase === 'sky' ? 1 : 0) - atlasReveal) * Math.min(1, dt * (reducedMotion ? 20 : 1.4))
  atlas.visible(atlasReveal > 0.005)
  atlas.update(dt, elapsed, camera.aspect, atlasReveal)
  syncChips()

  // the crossing: the gaze levels out and the hatching carries you
  if (phase === 'crossing') {
    camera.rotation.x += (0 - camera.rotation.x) * Math.min(1, dt * 2.2)
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2.2)
    crossing.update(dt, elapsed)
  }

  // the council: back at the seated eye, the circle convening
  if (phase === 'council') {
    camera.rotation.x += (-0.12 - camera.rotation.x) * Math.min(1, dt * 2.4)
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2.4)
    council.update(dt, elapsed, camera)
  }
  keeperScene.update(dt)
  ambience.update(dt)
  agora.update({ reveal: agoraReveal, elapsed, speak: keeperScene.speak(), blaze: council.blaze() })

  // the world's points breathe with their stage; the hub offers the
  // council after the arrival breath, the camp its learning paths
  const spotsVisible =
    (phase === 'camp' && campReveal > 0.6 && !chapters.isOpen()) ||
    (phase === 'agora' &&
      agoraReveal > 0.6 &&
      agoraEnteredAt >= 0 &&
      elapsed - agoraEnteredAt > 2.4)
  hotspots.sync(camera, spotsVisible)
  chapters.update()

  // free-look: the world answers the hand, a few damped degrees only
  // (render-only offset: every projection reads last frame's matrices,
  // so the letterpress rides the same breath as the world)
  freeLook += (freeLookTarget() - freeLook) * Math.min(1, dt * 2.4)
  freeLookY += (freeLookYTarget() - freeLookY) * Math.min(1, dt * 2.4)
  const baseRx = camera.rotation.x
  const baseRy = camera.rotation.y
  camera.rotation.y -= freeLook * 0.026
  camera.rotation.x -= freeLookY * 0.018
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
function freeLookAllowed(): boolean {
  if (reducedMotion || frozen) return false
  return phase === 'agora' || phase === 'sky' || phase === 'camp' || phase === 'council'
}
function freeLookTarget(): number {
  return freeLookAllowed() ? pointerNX : 0
}
function freeLookYTarget(): number {
  return freeLookAllowed() ? pointerNY : 0
}

async function main(): Promise<void> {
  try {
    await renderer.init()
  } catch (err) {
    console.error('renderer init failed', err)
    setStatus('This night needs a newer browser')
    return
  }
  setStatus('First light')
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
