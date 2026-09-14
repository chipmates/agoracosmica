import { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createKeeper } from './scenes/keeper'
import { createBreath } from './scenes/breath'
import { createAtlas, type LabelBounds } from './scenes/atlas'
import { createMandala } from './scenes/mandala'
import { createHotspots } from './core/hotspots'
import { FIRE_SCRIPT } from './content/keeper-script'
import { ambience } from './core/ambience'
import { WANDERERS } from './content/wanderers'
import { CONSTELLATIONS, SKY_INVITE } from './content/constellations'
import { channel, EASE } from './core/motion'
import { mediaUrl } from './content/media'
import { createStack } from './stack'
import type { GradeName } from './stack/grade'
import { isTierName, type TierName } from './stack/tier'
import { createWingFrame, stationFromHash } from './wings/frame'
import { readLabels, type ForgeLabel } from './core/labels'
import { DISCLOSURES } from './content/disclosures'
import { WINGS, wingBySlug, wingsOpen, wingsPreparing } from './wings/registry'
import { wingCount } from './wings/content'
import { benchOptions, benchPath, createBench, type BenchOptions } from './bench'

type Phase = 'transit' | 'held' | 'descent' | 'agora' | 'wheel' | 'breath' | 'wing' | 'bench'
/** what the rig may ask for: the phases, plus the wheel with a pane open */
type ForgeState = Phase | 'pane'

/** every stage of the night names its own look; the table is in stack/grade */
const LOOK = {
  transit: 'cold-moon',
  held: 'cold-moon',
  descent: 'falling-plates',
  agora: 'lapis-ember',
  wheel: 'gold-on-ink',
  breath: 'gold-breath',
  wing: 'first-station',
  bench: 'first-station',
} satisfies Record<Phase, GradeName>

function isPhase(v: string | null | undefined): v is Phase {
  return v !== null && v !== undefined && v in LOOK
}

/** the states the rig may ask for: every phase, plus the pane */
function isForgeState(v: string | null | undefined): v is ForgeState {
  return v === 'pane' || isPhase(v)
}

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const keeper = document.getElementById('keeper')
const descent = document.getElementById('descent')
const descentSkip = document.getElementById('descent-skip')
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
  !stage || !status || !keeper || !descent || !descentSkip || !verse || !voiceDom ||
  !plate || !invite || !marks || !chips || !pane || !wingHost
)
  throw new Error('missing shell')
const keeperEl: HTMLElement = keeper
const descentEl: HTMLElement = descent
const descentBeats = Array.from(descentEl.querySelectorAll('.descent-beat')) as HTMLElement[]
const hearthVeil = descentEl.querySelector('.hearth') as HTMLElement | null
const plumbEl = descentEl.querySelector('.plumb') as HTMLElement | null
/* the rest at a line is measured against the line: the shortest question does
   not take as long to read as the longest one. The weights average to one, so
   the ride's whole length is unchanged. */
const askLengths = descentBeats.map((b) => (b.textContent ?? '').trim().length)
const askMean = Math.max(1, askLengths.reduce((a, b) => a + b, 0) / Math.max(1, askLengths.length))
const readWeights = askLengths.map((l) => 0.55 + (0.45 * l) / askMean)
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

/* The stack is built before anything is put in the scene: the backend and the
   tier are facts about the machine, and every scene below asks the tier what
   it may afford. Top-level await, so no organ is ever constructed against a
   renderer that does not exist yet. */
const stack = await createStack({})
const renderer = stack.renderer
stage.appendChild(renderer.domElement)
stack.setScene(scene, camera, 'cold-moon')

/* THE ONE KEY: a low late moon behind the colonnade. It is the only light in
   the night that casts, and what it casts is what tells the visitor the court
   is a place with a sky over it and not a set. The fire is not a key: it is
   an object in the room that happens to glow, and the agora paints it itself. */
const KEY_OPTIONS = {
  // the moon stands low BEHIND the colonnade, so the shadows of the columns
  // come toward the visitor across the court instead of away from him
  azimuth: 24,
  elevation: 21,
  kelvin: 4300,
  lux: 22,
  reach: 54,
  cascades: [14, 34] as [number, number],
  ambient: 0.9,
  sky: { zenith: '#04060e', horizon: '#111c40', ground: '#05060f', stars: 1 },
}
const key = stack.light(KEY_OPTIONS)

const eclipse = createEclipse(scene)
const agora = createAgora(scene, { key, stack })
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
  /** the line of type, kept as its own node so redrawing the name never
      throws away the leader beside it */
  name: HTMLElement
  /** the hairline from the name to the star it belongs to */
  leader: HTMLElement
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
  const nameEl = document.createElement('span')
  nameEl.textContent = w.name
  b.appendChild(nameEl)
  /* THE LEADER. A name in a sky is only a name if you can see which light
     it belongs to. The hairline is laid out from the solver's final seat,
     so it always ends on the star and never on the neighbour. Its styling
     is inline because it is geometry, not chrome. */
  const leaderEl = document.createElement('span')
  leaderEl.setAttribute('aria-hidden', 'true')
  leaderEl.style.cssText =
    'position:absolute;left:50%;top:32px;width:0;height:1px;' +
    'transform-origin:0 50%;pointer-events:none;background:linear-gradient(to right,' +
    'color-mix(in srgb, var(--na-mist) 22%, transparent),' +
    'color-mix(in srgb, var(--na-gold) 44%, transparent))'
  b.appendChild(leaderEl)
  /* and the marker the leader leaves ON the name: a small open ring, the
     atlas register's own way of saying this word is an entry */
  const markEl = document.createElement('span')
  markEl.setAttribute('aria-hidden', 'true')
  markEl.style.cssText =
    'position:absolute;top:13px;right:2px;width:3px;height:3px;border-radius:50%;' +
    'border:1px solid color-mix(in srgb, var(--na-mist) 52%, transparent);pointer-events:none'
  b.appendChild(markEl)
  // the name of a person who lived is documented; the star it hangs on is
  // this night's own invention, which is why the anchor is procedural
  b.dataset['naClaim'] = 'documented'
  b.dataset['naAnchor'] = 'lobby/register'
  b.dataset['naAnchorClass'] = 'procedural'
  b.style.visibility = 'hidden'
  b.addEventListener('click', () => openPane(s.slug))
  chipsEl.appendChild(b)
  chipList.push({ el: b, name: nameEl, leader: leaderEl, slug: s.slug, chapter: s.chapter })
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

/* THE PAGE HANDS THE SKY ITS OWN LINES. Every standing line of type on the
   glass is measured and given to the sky, which thins its field inside those
   rectangles: no star sits in a glyph and none lands in the masthead's gap.
   The rectangles only move when the layout does, so this is measured on a
   slow beat and not once a frame. */
const pageMarks: Array<HTMLElement | null> = [
  document.querySelector('.brand'),
  document.getElementById('lobby-plate'),
  document.getElementById('sky-invite'),
  document.getElementById('sky-return'),
  document.getElementById('chapter-marks'),
  document.getElementById('constellation-plate'),
  document.getElementById('status'),
]
const pageRects: LabelBounds[] = []
const pageHeights: number[] = []
let pageMeasured = -99
function syncPageReserve(force: boolean): void {
  // the rig freezes the scene clock, so this beat runs on the wall clock
  const now = performance.now() / 1000
  if (!force && now - pageMeasured < 0.4) return
  pageMeasured = now
  pageRects.length = 0
  pageHeights.length = 0
  for (const el of pageMarks) {
    // a fixed element has no offsetParent, so presence is read off the box
    if (!el || el.hidden) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    pageRects.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, half: r.width / 2 + 4 })
    pageHeights.push(r.height / 2 + 3)
  }
  atlas.reservePage(pageRects, pageHeights, innerWidth, innerHeight)
  const boxes = pageRects.map((p, i) => ({
    x: p.x,
    y: p.y,
    half: p.half,
    vhalf: pageHeights[i] ?? 9,
  }))
  eclipse.reservePage(boxes, innerWidth, innerHeight)
  agora.reservePage(boxes, innerWidth, innerHeight)
}

const chipProject = new Vector3()
interface ChipPlace {
  chip: Chip
  x: number
  y: number
  half: number
  above: boolean
  /** where the star itself landed on the glass, so the leader can reach it */
  starX: number
  starY: number
}
const chipSeats = new Map<string, { x: number; y: number }>()
function syncChips(): void {
  syncPageReserve(false)
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
    if (chip.name.textContent !== label) chip.name.textContent = label
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
    const rawX = Math.min(
      Math.max((chipProject.x * 0.5 + 0.5) * innerWidth, half + 8),
      innerWidth - half - 8
    )
    const rawY = (-chipProject.y * 0.5 + 0.5) * innerHeight + (above ? -48 : 24)
    /* TYPE DOES NOT SHIMMER. The dome breathes, so a name re-projected every
       frame re-rasterises on a fraction of a pixel and the glyphs crawl. A
       seat is taken on whole pixels and kept until its star has really
       moved, which is the difference between a sky that lives and letters
       that vibrate. */
    /* A NAME IS SEATED, AND THE SKY MOVES UNDER IT. A pixel and a half of
       deadband only made the jumps rarer; the glyphs still re-rasterised
       whenever the dome's breath crossed the threshold. The seat now holds
       until the star has REALLY moved (a chapter, a resize, a turn), which
       is the difference between type and a light. */
    const seat = chipSeats.get(chip.slug)
    const moved = !seat || Math.abs(seat.x - rawX) > 11 || Math.abs(seat.y - rawY) > 11
    const x = moved ? Math.round(rawX) : seat.x
    const y = moved ? Math.round(rawY) : seat.y
    if (moved) chipSeats.set(chip.slug, { x, y })
    places.push({
      chip,
      x,
      y,
      half,
      above,
      starX: Math.round((chipProject.x * 0.5 + 0.5) * innerWidth),
      starY: Math.round((-chipProject.y * 0.5 + 0.5) * innerHeight),
    })
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
    chipSeats.set(p.chip.slug, { x: p.x, y: p.y })
    p.chip.el.style.left = `${p.x}px`
    p.chip.el.style.top = `${p.y}px`
    // the leader leaves the type on the side the star is on and stops a
    // few pixels short of the disc, so it rests against the light
    const attach = p.above ? 32 : 12
    const dx = p.starX - p.x
    const dy = p.starY - p.y - attach
    p.chip.leader.style.top = `${attach}px`
    // the leader is quantised with the seat: a hairline that re-renders on
    // a fraction of a pixel is the same shimmer, one element further down
    p.chip.leader.style.width = `${Math.round(Math.max(0, Math.hypot(dx, dy) - 11))}px`
    p.chip.leader.style.transform =
      `rotate(${(Math.round(Math.atan2(dy, dx) * 200) / 200).toFixed(3)}rad)`
    p.chip.el.classList.add('lit')
  }
  // the sky is told where the names sit, so its ink stays off them
  atlas.reserveLabels(places, innerWidth, innerHeight)
}

/** From the sky back down to the hearth, the gaze easing all the way. */
function returnToFire(): void {
  if (phase !== 'wheel') return
  setPhase('agora')
  lookUp = 1 // land the gaze from above, no snap
  lookTarget = 0
}

// ---- the descent staging: through the ring, then the plumb-line dive
// into the agora mandala, one question per stride, then the flare ----
const GATE_END = 0.16 // corona bloom, one black breath, then above the ring
const smooth = (a: number, b: number, k: number): number => {
  const t = Math.min(1, Math.max(0, (k - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// the overture stays clean: a title card in the black breath, then eight
// questions on the way down. The Echo disclosure lives where the figures
// speak (the pane's ink and the keeper's colophon).
// Every beat RESTS at the middle of its band and the ride stops at those
// rests, so the sealed states (0.10, 0.35, 0.60, 0.85) each stand on a
// line that is being read rather than on a line passing by.
const BEAT_HALF = 0.03
// the title card holds through the turn over the ring, where the eclipse has
// gone and the map has not risen yet: the widest band of the ride
const CARD_HALF = 0.075
const DESCENT_RESTS = [0.105, 0.2667, 0.35, 0.4333, 0.5167, 0.6, 0.6833, 0.7667, 0.85]
const DESCENT_STATIONS: Array<[number, number]> = DESCENT_RESTS.map(
  (r, i): [number, number] => {
    const h = i === 0 ? CARD_HALF : BEAT_HALF
    return [r - h, r + h]
  }
)
/** the ride's stops: the eclipse, the nine lines, the fire */
const RIDE_STOPS = [0, ...DESCENT_RESTS, 1]

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
  { p: 0.88, v: 9, e: 'sineInOut' },
  { p: 0.92, v: 4.2, e: 'sineInOut' },
  { p: 0.948, v: 0, e: 'sineInOut' },
])
const dCamR = channel([
  { p: 0, v: 0.001 }, { p: 0.15, v: 0.001 },
  { p: 0.28, v: 32, e: 'sineInOut' },
  { p: 0.50, v: 36, e: 'sineInOut' },
  { p: 0.70, v: 36, e: 'sineInOut' },
  { p: 0.82, v: 30, e: 'sineInOut' },
  { p: 0.88, v: 19, e: 'sineInOut' },
  { p: 0.92, v: 6, e: 'sineInOut' },
  { p: 0.948, v: 0, e: 'sineInOut' },
])
const dCamTh = channel([
  { p: 0, v: 0 }, { p: 0.28, v: -0.17 },
  { p: 0.70, v: 0.11, e: 'sineInOut' },
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
const dLead = channel([
  { p: 0, v: 0 }, { p: 0.30, v: 0 },
  { p: 0.46, v: 0.26, e: 'sineInOut' },
  { p: 0.78, v: 0.26 },
  { p: 0.90, v: 0, e: 'sineInOut' },
])
const descentLook = new Vector3()
const descentAhead = new Vector3()
function descentPos(k: number, out: Vector3): Vector3 {
  const th = dCamTh(k)
  const r = dCamR(k)
  return out.set(Math.sin(th) * r, dCamY(k), Math.cos(th) * r)
}
/** The narrow stage restages. The map draws itself smaller on a phone (its
    own aspect rule), so the ride comes in exactly as close as the map is
    small and the tall frame holds the same picture instead of a small drum
    in a void. The factor gives way as the fall reaches the floor, where
    what the camera stands in is the room and not the map. */
function mapScale(): number {
  return Math.min(1, innerWidth / innerHeight / 1.05)
}
function descentCamera(k: number): void {
  const ms = mapScale()
  descentPos(k, camera.position).multiplyScalar(ms)
  descentLook.set(dLookX(k), dLookY(k), dLookZ(k))
  const lead = dLead(k)
  if (lead > 0) {
    // where the ride will be a moment from now: the camera heads down the
    // travel instead of holding one point while the world slides past it
    descentPos(Math.min(0.99, k + 0.12), descentAhead)
    descentLook.lerp(descentAhead, lead)
  }
  descentLook.multiplyScalar(ms)
  camera.lookAt(descentLook)
}

/* THE RIDE. A push takes ONE STRIDE, from the line being read to the next
   one, and the world eases the whole way: the travel can never collapse
   into a single gesture, and a flick's momentum tail cannot stack strides.
   With no hand on it the ride carries itself on, waiting while the visitor
   is plainly there and walking on once the frame is unwatched, so someone
   who only watches still arrives at the fire. Its clock is WALL time, never
   frame count, and the rig's freeze stops it dead. */
const HAND_WINDOW = 3.0 // seconds a push keeps the ride waiting for its owner
const DWELL_HAND = 2.4 // the rest at a line while a hand is on the ride
const DWELL_ALONE = 0.34 // and the rest when the frame is unwatched
// two strides taken by hand and the ride is the visitor's: it then waits at
// every line long enough to read it twice, and the whole prelude is as long
// as he wants it. Nobody is ever stranded, the ride simply goes on last.
const DWELL_OWNED = 9.0
let handStrides = 0
let rideClock = 0
let strideFrom = 0
let strideEnd = 0
let strideAt = -99
let strideFor = 1
let lastHand = -99

/** the stop being rested at, as an index into the beats (or -1) */
function beatAt(k: number): number {
  for (let i = 0; i < DESCENT_RESTS.length; i++) {
    const r = DESCENT_RESTS[i]
    if (r !== undefined && Math.abs(k - r) < 0.006) return i
  }
  return -1
}

/** the next stop of the ride beyond k, in the direction of travel */
function nextStop(k: number, dir: number): number {
  if (dir > 0) {
    for (const s of RIDE_STOPS) if (s > k + 0.004) return s
    return 1
  }
  for (let i = RIDE_STOPS.length - 1; i >= 0; i--) {
    const s = RIDE_STOPS[i]
    if (s !== undefined && s < k - 0.004) return s
  }
  return 0
}

/** hold the ride exactly where it stands (the rig jumps, the skip lands) */
function holdRide(k: number): void {
  handStrides = 0
  desc = descTarget = strideFrom = strideEnd = k
  strideAt = rideClock
  strideFor = 0
}

/** one stride of the travel; a stride still in flight swallows the push */
function takeStride(dir: 1 | -1, byHand: boolean): void {
  if (byHand) lastHand = rideClock
  // the ride is a walk, not a scrub: a push mid-stride is absorbed, except
  // in its last fifth, where a second push flows on without a stop. A stage
  // that asks for no motion still gets one line per gesture, never a race
  if (rideClock - strideAt < Math.max(strideFor, reducedMotion ? 0.56 : 0) * 0.8) return
  const to = nextStop(descTarget, dir)
  if (to === descTarget) return
  // a push back is the plainest word for "I am steering", so it takes the
  // ride in one gesture where a push on takes two
  if (byHand) handStrides = dir < 0 ? Math.max(handStrides, 2) : handStrides + 1
  const span = Math.abs(to - desc)
  strideFrom = desc
  strideEnd = to
  descTarget = to
  strideAt = rideClock
  // a fall gathers speed: the long turn over the ring breathes, the last
  // strides are a plain drop into the light
  strideFor = reducedMotion ? 0 : Math.min(1.9, Math.max(0.72, 0.5 + span * 6.5)) * (1 - 0.18 * to)
}

/** the ride's own clock drives desc; nothing else writes it while it runs */
function rideFrame(): void {
  if (strideFor <= 0) {
    desc = strideEnd
    return
  }
  const t = Math.min(1, (rideClock - strideAt) / strideFor)
  desc = strideFrom + (strideEnd - strideFrom) * (EASE['sineInOut'] ?? ((x: number) => x))(t)
}

/** The questions drift past with parallax: each line rises through the
    frame as the visitor falls, near lines faster than far ones. */
function syncDescentBeats(k: number): void {
  // the arrival's own light: it takes the frame where the map is leaving and
  // the room has not stood up yet, and it is gone before the fire is seen
  // the plumb hangs while the destination is still far below; it leaves the
  // frame before the plate takes the foot, so no mark lies on the stone. The
  // tall stage is filled by the map sooner, so its gauge goes sooner
  const tall = innerWidth / innerHeight < 0.9
  if (plumbEl)
    plumbEl.style.opacity = (1 - smooth(tall ? 0.3 : 0.52, tall ? 0.42 : 0.66, k)).toFixed(3)
  if (hearthVeil)
    hearthVeil.style.opacity = (smooth(0.89, 0.945, k) * (1 - smooth(0.972, 0.998, k)) * 0.95).toFixed(3)
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
    // the title card holds nearly still; every question travels past, near
    // lines faster than far ones. The stroke is short enough that a line
    // fades out well below the masthead instead of printing through it
    const travel = (i === 0 ? 7 : 15 + (i % 3) * 4) * (p < 0 ? 0.5 : 1)
    const scale = i === 0 ? 1 : 1 + p * 0.045
    beat.style.opacity = String(Math.max(0, 1 - Math.pow(Math.abs(p), 1.6)))
    beat.style.transform = `translate3d(0, ${(-p * travel).toFixed(2)}vh, 0) scale(${scale.toFixed(3)})`
  }
}

function skipDescent(): void {
  if (phase !== 'descent') return
  lastHand = rideClock
  // the impatient way down is still a move: the last stretch of the travel
  // runs out under the visitor instead of cutting
  strideFrom = Math.max(desc, 0.86)
  strideEnd = 1
  descTarget = 1
  strideAt = rideClock
  strideFor = reducedMotion ? 0 : 0.9
  desc = strideFrom
}
descentSkip.addEventListener('click', () => skipDescent())

// the impatient door on the totality screen: straight down to the fire
document.getElementById('overture-skip')?.addEventListener('click', () => {
  if (phase !== 'held' && phase !== 'transit') return
  wakeMusic()
  transit = 1
  if (phase === 'held') setPhase('descent')
  skipDescent()
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
          /** which station of that wing, by its own id or by index */
          station?: string
          /** a named composition at that station */
          view?: string
          /** Shell close-ups for THE EYES; the journey uses real input. */
          shell?: 'instruments'
          /** which bench a `bench` state stands at, and which of its states:
              a machine by `slug`, the table or the line by `state`, the
              picture bench by `segment` */
          kind?: string
          state?: string
          segment?: string
          lang?: 'en' | 'de'
        }
      ) => void
      freeze: (t: number) => void
      /** the rig and the owner switch tiers without a reload */
      tier: (name: TierName) => void
      state: () => {
        phase: Phase
        agoraReveal: number
        desc: number
        draws: number
        tris: number
        /** where along a wing's rail the visitor stands, and how far it runs */
        station: number
        stations: number
        /** the station standing, and every station, by id: an instrument
            addresses a station by name, never by an integer into a
            normalised rail, which repeats the last one */
        stationId: string
        stationIds: string[]
        /** where the door at this station goes, and what it asks */
        door: { href: string; question: string }
        /** library sets still in flight; a frame shot over zero is a frame
            drawn on a surface that is not dressed yet */
        texturesPending: number
      }
      /** what the last two seconds cost, per the stack's own meter */
      /** every asset the app has resolved, with its class and licence line */
      manifest: () => Array<{ id: string; class: string; licence: string }>
      /** every label and control the current station is showing, measured
          off the live frame, which is what the honesty gate reads */
      labels: () => ForgeLabel[]
      /** the canon of the three disclosure layers, for the verbatim diff */
      disclosures: () => Record<string, { en: string; de: string }>
      /** the drag envelope of a station, in degrees: the rig shoots the
          four corners of the look cone through this */
      look: (yaw: number, pitch: number) => void
      /** what the stack is holding: key rigs, and objects in the scene. A
          wing rebuilds its key at every station, so neither may grow. */
      lights: () => { rigs: number; sceneObjects: number }
      /** rebuild the standing scene's key, which is what a wing does when
          it re-stages a station. The lobby's own materials were compiled
          against the FIRST rig's shadow node, so the court's shadows go
          flat after one call: this drives the leak gate, never a visitor. */
      relight: () => { rigs: number; sceneObjects: number }
      /** 0 to 1 along a wing's rail; outside a wing it does nothing */
      rail: (t: number) => void
      /** stand at a station by its id. False when this wing has no such
          station, so a rig reports a station that never took. */
      station: (id: string) => boolean
      /** what the standing bench measures of itself: its own joints, its
          own scale, its own plate. Null when no bench stands. */
      bench: () => unknown
      /** the machine bench under its own name, for a rig written against
          it. Null when another kind stands. */
      machine: () => unknown
      /** the reading table's own reading, or null when it is not standing */
      table: () => unknown
      cost: () => {
        draws: number
        triangles: number
        frameMsP50: number
        frameMsP95: number
        cpuMsP50: number
        cpuMsP95: number
        tier: string
        backend: string
        textureMB: number
        frames: number
        budget: { draws: number; triangles: number; fps: number; textureMB: number }
      }
    }
  }
}
// ---- THE MUSEUM'S ROUTE: / is the lobby, /w/<slug> is a wing ----
const wingFrame = createWingFrame(wingEl, () => toLobby(), stack, () => performance.now() / 1000)
let wingSlug = ''
const bench = createBench(stack, () => toLobby())

/** A wing's own address, with the station the visitor stood at. */
function wingPath(): { slug: string; station: number | string } | null {
  const m = /^\/w\/([a-z0-9-]{1,64})\/?$/.exec(location.pathname)
  return m?.[1] === undefined ? null : { slug: m[1], station: stationFromHash() }
}

/** Stand in a wing. The overture is never replayed to get here. */
async function openWing(slug: string, at: number | string, view?: string): Promise<void> {
  const entry = wingBySlug(slug)
  if (!entry) {
    toLobby()
    return
  }
  wingSlug = slug
  // the room is claimed before its module arrives, and only once: claiming
  // it again between two stations strikes the wing that is standing
  if (phase !== 'wing') setPhase('wing')
  const mod = await entry.load()
  if (wingSlug !== slug) return // the visitor left while it loaded
  wingFrame.open(entry, mod.createWing(), at, view)
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
  const stand = benchPath()
  if (stand) {
    if (phase !== 'bench') setPhase('bench')
    void bench.open(benchOptions(stand))
    return
  }
  const here = wingPath()
  if (here) void openWing(here.slug, here.station)
  else if (phase === 'wing' || phase === 'bench') toLobby()
})

// the lobby's plate: what the register can answer for, said once
if (lobbyPlate) lobbyPlate.textContent = wingCount(wingsOpen(), wingsPreparing())

window.__forge = {
  jump(state, opts = {}) {
    // a state the museum does not have is a mistake in the rig's own spec:
    // say so and leave the marker unset, so the eye reports a stage that
    // never took instead of shooting whatever was on screen
    if (!isForgeState(state)) {
      console.warn(`no such state: ${String(state)}`)
      return
    }
    document.body.classList.add('forge') // DOM beats compose instantly
    /* a bench stamps the marker itself, when the thing it stands is
       actually standing: its geometry and its plate arrive after the jump
       returns, and a frame shot in between is of an empty stage */
    if (state === 'bench') {
      if (phase !== 'bench') setPhase('bench')
      void bench.open(opts as BenchOptions).catch((e: unknown) => console.error(e))
      return
    }
    // the rig proves the state it ASKED for took, which the phase alone
    // cannot say: the pane is the wheel with a figure held open
    document.body.dataset['forge'] = 'pending'
    forgeLook = null // a new state is looked at straight on
    const p: Phase = state === 'pane' ? 'wheel' : state
    // a jump from one station of a wing to another is not a new night: the
    // phase is only re-entered when the state or the wing actually changes
    if (p !== 'wing' || phase !== 'wing' || (opts.slug && opts.slug !== wingSlug)) setPhase(p)
    // each jump is a single composed moment: no scene leaks across
    if (p !== 'breath') breath.stop()
    window.clearTimeout(voiceTimerA)
    window.clearTimeout(voiceTimerB)
    voiceEl2.classList.remove('lit', 'clean')
    transit = opts.transit ?? (p === 'transit' ? 0.5 : 1)
    desc = descTarget = p === 'descent' ? (opts.desc ?? 0.5) : p === 'transit' || p === 'held' ? 0 : 1
    holdRide(desc)
    door = p === 'transit' || p === 'held' ? 0 : Math.min(1, desc / 0.18)
    skyBirth =
      opts.skyBirth ??
      (p === 'transit' || p === 'held' ? 0
      : p === 'descent' ? Math.pow(smooth(0.04, 0.95, desc), 0.55) * 0.85
      : p === 'breath' ? 0.12
      : p === 'wheel' ? 0
      : p === 'agora' ? 1
      : 1)
    flashAt = elapsed - (opts.sinceFlash ?? 999)
    agoraReveal =
      p === 'agora' || p === 'wheel' ? 1
      : p === 'descent' ? smooth(0.952, 0.995, desc)
      : 0
    lookUp = lookTarget = p === 'wheel' ? 1 : 0
    camera.position.y = 0
    if (p === 'descent') {
      descentCamera(desc)
      syncDescentBeats(desc)
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
    railEl.hidden = p === 'transit' || p === 'held' || p === 'breath' || p === 'wing'
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
      void openWing(opts.slug ?? WINGS[0]?.slug ?? '', opts.station ?? 0, opts.view).then(() => {
        document.body.dataset['forge'] = state
      })
      return
    }
    document.body.dataset['forge'] = state
  },
  freeze(t) {
    bench.freeze(t)
    elapsed = t
    frozen = true
  },
  tier(name) {
    if (!isTierName(name)) return
    /* a bench whose geometry and maps are allocated for one tier is sent
       round its own address again: switching live would leave half of it
       dressed for the tier before */
    const here = bench.reloadOnTier() ? bench.address() : null
    if (here) {
      const target = new URL(location.href)
      target.pathname = here
      target.searchParams.set('tier', name)
      location.assign(target)
      return
    }
    stack.tier(name)
  },
  cost() {
    return stack.cost()
  },
  manifest() {
    return [...stack.materials.manifest(), ...bench.manifest()]
  },
  labels() {
    return readLabels()
  },
  disclosures() {
    return DISCLOSURES
  },
  /** what the standing bench measures of itself, or null when none stands */
  bench() {
    return bench.telemetry()
  },
  machine() {
    return bench.kind() === 'machines' ? bench.telemetry() : null
  },
  /** the reading table as the rig addresses it: the open folio, the turn's
      progress and the panel's text. Null unless the table is the standing
      bench, so a rig cannot read one bench's numbers off another. */
  table() {
    return bench.kind() === 'table' ? bench.telemetry() : null
  },
  look(yaw, pitch) {
    // a wing drives its own camera, so the cone of a station is turned
    // there and never on the lobby's seated eye
    if (phase === 'wing') {
      wingFrame.look(yaw * DEG, pitch * DEG)
      return
    }
    // the rig looks where a hand could look, and past it: the cone of a
    // station is the envelope being inspected, not the damping that
    // returns a resting gaze to centre
    forgeLook = yaw === 0 && pitch === 0 ? null : { yaw: yaw * DEG, pitch: pitch * DEG }
  },
  lights() {
    return { rigs: stack.lights(), sceneObjects: stack.sceneObjects() }
  },
  relight() {
    if (bench.active()) {
      bench.relight()
      return bench.lights() ?? { rigs: stack.lights(), sceneObjects: stack.sceneObjects() }
    }
    stack.light(KEY_OPTIONS)
    return { rigs: stack.lights(), sceneObjects: stack.sceneObjects() }
  },
  rail(t) {
    if (bench.active()) {
      bench.rail(t)
      return
    }
    const count = wingFrame.stations()
    if (!count) return
    wingFrame.goto(Math.round(Math.min(1, Math.max(0, t)) * (count - 1)))
  },
  station(id) {
    return bench.active() ? bench.station(id) : wingFrame.gotoId(id)
  },
  // the rig's stethoscope: read the live blend state without guessing
  // from pixels (numbers first, then the shot)
  state() {
    const stand = bench.reading()
    return {
      phase,
      agoraReveal,
      desc,
      station: stand ? stand.station : wingFrame.station(),
      stations: stand ? stand.stations : wingFrame.stations(),
      stationId: stand ? stand.stationId : wingFrame.stationId(),
      stationIds: stand ? stand.stationIds : wingFrame.stationIds(),
      door: wingFrame.doorHere(),
      texturesPending: stack.materials.pending() + (stand?.texturesPending ?? 0),
      // what the last frame actually cost: the rig quotes this instead of
      // guessing from a software-rasterizer fps number
      draws: renderer.info.render.drawCalls,
      tris: renderer.info.render.triangles,
      cam: {
        p: (phase === 'wing' ? wingFrame.camera() : camera).position.toArray(),
        r: (phase === 'wing' ? wingFrame.camera() : camera).rotation.toArray().slice(0, 3),
        fov: (phase === 'wing' ? wingFrame.camera() : camera).fov,
        proj: (phase === 'wing' ? wingFrame.camera() : camera).projectionMatrix.elements.slice(0, 4),
      },
    }
  },
}

const TRANSIT_SECONDS = 2.0

function setPhase(next: Phase): void {
  // the phase arrives from the rig as well as from the night's own verbs, so
  // a name nobody wrote is reachable: refuse it and keep the stage standing
  if (!isPhase(next)) {
    console.warn(`no such phase: ${String(next)}`)
    return
  }
  if (next !== 'bench') bench.close()
  phase = next
  document.body.dataset['phase'] = next
  stack.setScene(scene, camera, LOOK[next])
  if (next === 'held') setStatus('Scroll to enter')
  if (next === 'descent') {
    wakeMusic() // reaching the descent IS the first gesture
    setStatus('Scroll to descend')
    descentEl.hidden = false
    holdRide(desc)
    lastHand = rideClock
  } else {
    descentEl.hidden = true
    document.body.classList.remove('arriving')
    for (const b of descentBeats) b.style.opacity = '0'
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
    // the verse belongs to the fire, so it leaves when the gaze does: its own
    // hold outlives a quick look up and the line was landing on the sky
    verseEl.classList.remove('lit')
    chapterChangedAt = elapsed
    setPlate()
    skyDress(true)
    if (reducedMotion) atlas.snap(chapter)
  } else {
    skyDress(false)
  }
  if (next === 'breath' || next === 'wing' || next === 'bench') {
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
  // the page's lines change with the phase: measure them at the change
  syncPageReserve(true)
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
    // one push is ONE STRIDE of the travel: the line being read to the next
    // one. The whole ride scrubs both ways, and a push back at the top hands
    // the visitor to the eclipse again.
    takeStride(delta > 0 ? 1 : -1, true)
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
  if (e.key === 'Enter' && phase === 'descent') skipDescent()
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
  stack.setSize(innerWidth, innerHeight)
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
  // the ride is dramaturgy, so it runs on WALL time: a headless frame rate
  // would make the same travel take twice as long as the visitor's
  const dtWall = Math.min((now - last) / 1000, 0.25)
  last = now
  /* a bench owns the whole frame: its own clock, its own scene, its own
     render. Nothing of the night's overture runs behind it. */
  if (bench.active()) {
    bench.frame(dt)
    return
  }
  if (!frozen) elapsed += dt

  /* The overture crosses on its own clock, and the eye's clock is frozen:
     without this line the transit kept travelling while the rig waited out
     the settle, so the same state shot twice was two different moments of
     a two second animation and no two folders could be paired. A frozen
     eye holds the transit where the jump put it. */
  if (phase === 'transit' && !frozen) {
    transit = reducedMotion ? 1 : Math.min(1, transit + dt / TRANSIT_SECONDS)
    if (transit >= 1) {
      flashAt = elapsed
      setPhase('held')
    }
  }

  // the descent: one stride is one line of the travel down. The eclipse gate
  // opens itself in the first fifth, the agora materializes below, and the
  // ride carries itself on whenever no hand is on it.
  if (!frozen) rideClock += dtWall
  if (phase === 'descent') {
    if (!frozen && !reducedMotion && descTarget < 1) {
      const here = beatAt(descTarget)
      const weight = here < 0 ? 1 : (readWeights[here] ?? 1)
      const dwell =
        (handStrides >= 2 ? DWELL_OWNED
        : rideClock - lastHand < HAND_WINDOW ? DWELL_HAND
        : DWELL_ALONE) * weight
      if (rideClock - strideAt >= strideFor + dwell) takeStride(1, false)
    }
    if (!frozen) rideFrame()
    if (reducedMotion) desc = descTarget
  }
  const doorTarget = phase === 'transit' || phase === 'held' ? 0 : Math.min(1, desc / GATE_END)
  door += (doorTarget - door) * Math.min(1, dt * 4)
  if (reducedMotion) door = doorTarget
  if (phase === 'descent') {
    descentCamera(desc)
    syncDescentBeats(desc)
    // the arrival clears the foot of the frame: no instruction, no gauge and
    // no way past standing on the fire as it comes up
    document.body.classList.toggle('arriving', desc > 0.74)
    // a push back at the top of the travel hands the night to the eclipse
    if (descTarget <= 0 && desc < 0.02) setPhase('held')
    if (desc > 0.993) {
      camera.position.y = 0
      setPhase('agora')
    }
  }

  // the map carries the whole dive; the territory only wakes at the very
  // cut, once the camera has leveled (from above, the flame billboard
  // would fill the frame with streaks)
  const mandalaReveal =
    phase === 'descent' ? smooth(0.22, 0.32, desc) * (1 - smooth(0.918, 0.955, desc)) : 0
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
    : phase === 'descent' ? smooth(0.952, 0.995, desc)
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
    : phase === 'descent' ? Math.pow(smooth(0.04, 0.95, desc), 0.55) * 0.85
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
  const yaw = forgeLook ? forgeLook.yaw : dragYaw + idleYaw - freeLook * 0.026
  const pitch = forgeLook ? forgeLook.pitch : dragPitch + idlePitch - freeLookY * 0.018
  camera.rotation.y += yaw
  camera.rotation.x += pitch
  if (phase === 'wing') wingFrame.update(dt)
  stack.render(dt)
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
/** radians per degree: the rig speaks in the degrees a cone is written in */
const DEG = Math.PI / 180
/** the rig's own gaze, held until it is released, so a shot of a corner is
    not a shot of a gaze on its way home */
let forgeLook: { yaw: number; pitch: number } | null = null
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
  const stand = benchPath()
  if (stand) {
    setPhase('bench')
    void bench.open(benchOptions(stand))
    return true
  }
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

function main(): void {
  if (!bootRoute()) setStatus('First light')
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

main()
