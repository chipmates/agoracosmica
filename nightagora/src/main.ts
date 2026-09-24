import { PerspectiveCamera, Scene, Vector3 } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createBreath } from './scenes/breath'
import { createAtlas, type LabelBounds } from './scenes/atlas'
import { courtRiseAt, createMandala, CUT, mapScaleAt } from './scenes/mandala'
import { createHotspots } from './core/hotspots'
import { ambience } from './core/ambience'
import { WANDERERS } from './content/wanderers'
import { CONSTELLATIONS, SKY_INVITE } from './content/constellations'
import { channel, EASE } from './core/motion'
import { PANE_AMONG, PANE_SHARED, paneWords } from './content/panes'
import { loadLikenesses, paneLikeness, type LikenessRecord } from './content/likenesses'
import { createStack } from './stack'
import type { GradeName } from './stack/grade'
import { isTierName, type TierName } from './stack/tier'
import { createWingFrame, stationFromHash } from './wings/frame'
import { deskOn } from './wings/desk-switches'
import type { DeskPanelRow } from './wings/desk-panel'
import { readLabels, type ForgeLabel } from './core/labels'
import { DISCLOSURES } from './content/disclosures'
import { WINGS, wingBySlug, wingsOpen, wingsPreparing } from './wings/registry'
import { lang, say, wingCount } from './wings/content'
import { LOBBY_TEXT } from './content/lobby'
import { gaitPace, setGaitPace } from './wings/vinci/gait'
import { benchOptions, benchPath, createBench, type BenchOptions } from './bench'

function syncLobbyCopy(): void {
  document.documentElement.lang = lang()
  for (const el of document.querySelectorAll<HTMLElement>('[data-lobby]')) {
    const key = el.dataset['lobby'] as keyof typeof LOBBY_TEXT
    if (!(key in LOBBY_TEXT)) continue
    const text = say(LOBBY_TEXT[key])
    if (el instanceof HTMLMetaElement) el.content = text
    else el.textContent = text
  }
  const count = wingCount(wingsOpen(), wingsPreparing())
  for (const el of document.querySelectorAll<HTMLElement>('#lobby-plate, [data-lobby-count]'))
    el.textContent = count
  for (const el of document.querySelectorAll<HTMLElement>('[data-na-disclosure]')) {
    const key = el.dataset['naDisclosure'] as keyof typeof DISCLOSURES
    if (key in DISCLOSURES) el.textContent = say(DISCLOSURES[key])
  }
}
syncLobbyCopy()

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

/** the phases the lobby's own room is shown in */
const LOBBY_PHASES: ReadonlySet<Phase> = new Set<Phase>(['transit', 'held', 'descent', 'agora', 'wheel'])

/** the states the rig may ask for: every phase, plus the pane */
function isForgeState(v: string | null | undefined): v is ForgeState {
  return v === 'pane' || isPhase(v)
}

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const blackout = document.getElementById('blackout')
const enterDoor = document.getElementById('enter-museum')
const doorMeasure = document.getElementById('door-measure')
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
if (
  !stage || !status || !blackout || !enterDoor || !doorMeasure ||
  !descent || !descentSkip || !verse || !voiceDom ||
  !plate || !invite || !marks || !chips || !pane || !wingHost
)
  throw new Error('missing shell')
const blackoutEl: HTMLElement = blackout
const enterEl: HTMLElement = enterDoor
const doorMeasureEl: HTMLElement = doorMeasure
const doorFill = doorMeasureEl.querySelector('.door-fill') as HTMLElement | null
const descentEl: HTMLElement = descent
const descentBeats = Array.from(descentEl.querySelectorAll('.descent-beat')) as HTMLElement[]
const hearthVeil = descentEl.querySelector('.hearth') as HTMLElement | null
const plumbEl = descentEl.querySelector('.plumb') as HTMLElement | null
/* the rest at a line is measured against the line: the shortest question does
   not take as long to read as the longest one. The weights average to one, so
   the ride's whole length is unchanged. */
let readWeights: number[] = []
function syncReadWeights(): void {
  const lengths = descentBeats.map((b) => (b.textContent ?? '').trim().length)
  const mean = Math.max(1, lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length))
  readWeights = lengths.map((length) => 0.55 + (0.45 * length) / mean)
}
syncReadWeights()
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
/* a page that opens on a wing or a bench asks for the lobby's sets with the
   room and sends for them on the way home, never beside a wing's first
   picture; an address for a wing that does not exist opens on the lobby */
const opensOnLobby = !benchPath() && !wingBySlug(wingPath()?.slug ?? '')
const agora = createAgora(scene, { key, stack, eager: opensOnLobby })
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
    label: say(LOBBY_TEXT.sky),
    pos: new Vector3(0, 2.3, -6.2),
    posNarrow: new Vector3(0, 1.75, -5.6),
    open: () => {
      lookTarget = 1 // the gaze lifts itself; the wheel receives you
    },
  },
]


/* THE NIGHT OPENS ON THE EVENT ITSELF: the moon crosses the sun, and the
   door arrives at the totality it holds. The way on stands on both states
   and is pressable on both, so nobody is made to watch the crossing out. */
let phase: Phase = 'transit'
/** frames the night has actually drawn; the door waits for the first one */
let painted = 0
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
let railAwake = false

/** Entering the museum reveals the controls. Sound waits for its own request. */
function wakeInstruments(): void {
  if (railAwake) return
  railAwake = true
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
const paneYears = paneEl.querySelector('.pane-years') as HTMLElement | null
const paneLine = paneEl.querySelector('.pane-line') as HTMLElement | null
const paneNone = paneEl.querySelector('.pane-none') as HTMLElement | null
const paneState = paneEl.querySelector('.pane-state') as HTMLElement | null
const paneEnter = paneEl.querySelector('.pane-enter') as HTMLButtonElement | null
const paneSiblings = paneEl.querySelector('.pane-siblings') as HTMLElement | null
const paneFigure = paneEl.querySelector('.pane-portrait') as HTMLElement | null
const panePortrait = paneEl.querySelector('.pane-portrait img') as HTMLImageElement | null
const paneCredit = paneEl.querySelector('.pane-credit') as HTMLElement | null
const paneCreditLine = paneEl.querySelector('.pane-credit-line') as HTMLElement | null
const paneCreditNote = paneEl.querySelector('.pane-credit-note') as HTMLElement | null
const paneClose = paneEl.querySelector('.pane-close') as HTMLButtonElement | null
/** whose pane is open, which is also whose museum the button enters */
let paneSlug = ''
/* THE LIKENESSES, once. Null until the store's record has arrived: a pane
   opened before it lands hangs nothing and says nothing about a likeness,
   rather than claiming there is none. */
let likenesses: Map<string, LikenessRecord> | null = null
void loadLikenesses().then((held) => {
  likenesses = held
  if (paneOpen) openPane(paneSlug)
})

/** the pane's plate: the store's likeness with its credit, or the name
    alone with the one honest line. Never a placeholder picture. */
function hangLikeness(slug: string, name: string): void {
  const record = likenesses?.get(slug)
  const hang = record ? paneLikeness(record, lang()) : null
  if (panePortrait) {
    if (hang) {
      panePortrait.src = hang.src
      panePortrait.srcset = hang.srcset
      panePortrait.width = hang.width
      panePortrait.height = hang.height
      panePortrait.alt = name
    } else {
      panePortrait.removeAttribute('srcset')
      panePortrait.removeAttribute('src')
      panePortrait.alt = ''
    }
  }
  // the plate's own ratio, so the column takes the picture's measure
  if (paneFigure) paneFigure.style.setProperty('--plate-ratio', hang ? String(hang.width / hang.height) : '0.72')
  if (paneCredit && hang) paneCredit.dataset['naAnchor'] = hang.id
  if (paneCreditLine) paneCreditLine.textContent = hang?.credit ?? ''
  if (paneCreditNote) paneCreditNote.textContent = hang?.note ?? ''
  if (paneFigure) paneFigure.hidden = !hang
  // the honest line only once the store has spoken: a record that never
  // arrived and a figure with no likeness are not the same thing, and an
  // empty index is a manifest that did not land, never thirty absences
  const none = Boolean(likenesses?.size) && !hang
  if (paneNone) {
    paneNone.hidden = !none
    paneNone.textContent = none ? say(PANE_SHARED.nameOnly) : ''
  }
  paneEl.classList.toggle('name-only', none)
}

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
  // the wheel promises only what the register can answer
  const wing = wingBySlug(slug)
  const words = paneWords(slug)
  // the place and the year stand on the pane only where the wing does
  if (paneKicker) paneKicker.textContent = wing && words?.wing ? say(words.wing) : ''
  if (paneName) paneName.textContent = w.name
  if (paneYears) paneYears.textContent = w.years
  if (paneLine) paneLine.textContent = words ? say(words.line) : ''
  if (paneState) paneState.textContent = say(wing?.status === 'open' ? PANE_SHARED.open : PANE_SHARED.preparing)
  if (paneEnter) paneEnter.hidden = !wing
  hangLikeness(slug, w.name)
  const sibLabel = paneEl.querySelector('.pane-sib-label')
  const among = PANE_AMONG[c.key]
  if (sibLabel) sibLabel.textContent = among ? say(among) : `Also among the ${c.name}`
  if (paneClose) paneClose.textContent = say(PANE_SHARED.close)
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
  // the front door's way on: it stands on the eclipse, so no star may sit
  // inside it. It measures zero on every other frame of the night.
  document.getElementById('enter-museum'),
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
// Three reading stops over the falling disc: the museum, the walk, tonight.
const BEAT_HALF = 0.065
/** how far past its rest the closing line is gone */
const LAST_EXIT = 0.04
const CARD_HALF = 0.075
const DESCENT_RESTS = [0.35, 0.6, 0.85]
const DESCENT_STATIONS: Array<[number, number]> = DESCENT_RESTS.map(
  (r, i): [number, number] => {
    const h = i === 0 ? CARD_HALF : BEAT_HALF
    return [r - h, r + h]
  }
)
/** The ride's stops: the eclipse, the three lines, the fire. */
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
/* THE NARROW STAGE FLIES THE SAME RIDE FROM FURTHER OUT. A 46 degree
   vertical frame is three times narrower across at 390 than at 1512, so the
   wide stage's flight path cuts the map at both edges for the whole middle
   of the fall. These two channels are the phone's own flight: the ride steps
   back far enough for the silhouette to CLOSE, and the gaze rides above the
   plate so the mass sits low and the question keeps its air. Both give way
   before the handover, where the platform is the floor and not a shape. */
const dFitTall = channel([
  { p: 0.14, v: 1 },
  { p: 0.27, v: 1.96, e: 'sineInOut' },
  { p: 0.45, v: 1.86 },
  { p: 0.62, v: 1.78 },
  { p: 0.78, v: 1.60, e: 'sineInOut' },
  // the map now carries the court's colonnade, three metres of stone at the
  // rim where there used to be a lamp's height: the last stretch of the
  // narrow ride gives that back, so the closing line still has sky behind it
  // while it can be read
  { p: 0.86, v: 1.24, e: 'sineInOut' },
  { p: 0.948, v: 1, e: 'sineInOut' },
])
const dLiftTall = channel([
  { p: 0.16, v: 0 },
  { p: 0.30, v: 2.6, e: 'sineInOut' },
  { p: 0.52, v: 2.9 },
  { p: 0.70, v: 1.4, e: 'sineInOut' },
  { p: 0.84, v: 0, e: 'sineInOut' },
])
/* and the wide stage steps IN. At 1512 the map held a third of the frame for
   the whole middle of the fall, which left the picture to the empty field
   around it; the ride comes as close as the question band allows and the
   growth runs from a third of the frame to the whole of it. */
const dFitWide = channel([
  { p: 0.14, v: 1 },
  { p: 0.30, v: 0.80, e: 'sineInOut' },
  { p: 0.66, v: 0.82 },
  { p: 0.80, v: 0.92, e: 'sineInOut' },
  { p: 0.90, v: 1, e: 'sineInOut' },
])
const dLiftWide = channel([
  { p: 0.16, v: 0 },
  { p: 0.30, v: 3.3, e: 'sineInOut' },
  { p: 0.55, v: 1.8 },
  { p: 0.72, v: 0.6, e: 'sineInOut' },
  { p: 0.84, v: 0, e: 'sineInOut' },
])
/** 0 on a wide stage, 1 on a phone held upright */
function tallness(): number {
  const a = innerWidth / innerHeight
  return Math.min(1, Math.max(0, (1.15 - a) / (1.15 - 0.46)))
}
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
function mapScale(k: number): number {
  return mapScaleAt(k, innerWidth / innerHeight)
}
function descentCamera(k: number): void {
  const tall = tallness()
  const fit = dFitWide(k) + (dFitTall(k) - dFitWide(k)) * tall
  const lift = dLiftWide(k) + (dLiftTall(k) - dLiftWide(k)) * tall
  const ms = mapScale(k) * fit
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
  descentLook.y += lift
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
const DWELL_ALONE = 3.2 // museum sentences remain long enough to read without a hand
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
  // the cut is carried by the room itself now: the court stands behind the
  // ring before the map goes, so no veil is laid over the handover
  if (hearthVeil) hearthVeil.style.opacity = '0'
  for (let i = 0; i < descentBeats.length; i++) {
    const beat = descentBeats[i]
    const range = DESCENT_STATIONS[i]
    if (!beat || !range) continue
    const mid = (range[0] + range[1]) / 2
    const half = (range[1] - range[0]) / 2
    const p = (k - mid) / (half * 1.55)
    // the last line fades on the way down before the ring's crown climbs into
    // its band (0.895 on the wide stage, 0.893 on the tall one), while it
    // still travels at the questions' own pace, below the masthead
    const fade = i === descentBeats.length - 1 && k > mid ? (k - mid) / LAST_EXIT : p
    if (Math.abs(p) > 1.1 || Math.abs(fade) >= 1) {
      beat.style.opacity = '0'
      continue
    }
    // the title card holds nearly still; every question travels past, near
    // lines faster than far ones. The stroke is short enough that a line
    // fades out well below the masthead instead of printing through it
    const travel = (i === 0 ? 7 : 15 + (i % 3) * 4) * (p < 0 ? 0.5 : 1)
    const scale = i === 0 ? 1 : 1 + p * 0.045
    beat.style.opacity = String(Math.max(0, 1 - Math.pow(Math.abs(fade), 1.6)))
    beat.style.transform = `translate3d(0, ${(-p * travel).toFixed(2)}vh, 0) scale(${scale.toFixed(3)})`
  }
}

/** whether the room has stood once already, which it does in one frame */
let courtWarm = false

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

/* ---- THE FRONT DOOR. The moon crossing the sun and the totality it holds,
   one way on, and the room behind it built while the visitor watches. The
   way on is unlit until the fire stands, because a press that lands on a
   room whose materials are not built yet buys a stutter instead of an
   arrival. ---- */

/** the two states the front door stands in: the crossing, and the totality
    it arrives at. Everything the door owns answers to both. */
function atDoor(): boolean {
  return phase === 'transit' || phase === 'held'
}

/** how far the door's own measure has counted: the stage painted, the room
    built. Nothing else is counted, so the mark never claims a share it has
    not earned. */
let doorShare = 0
let fireReady = false
let building = false
/** a press while the door was still waiting: it is honoured the moment the
    fire stands, so an early hand is never a dead press */
let pressedEarly = false
/** 0 none, 1 falling, 2 black and standing at the fire, 3 the room has had
    its one dark frame */
let curtain = 0

function doorCount(share: number): void {
  if (share <= doorShare) return
  doorShare = share
  if (doorFill) doorFill.style.transform = `scaleX(${share.toFixed(3)})`
}

function fireStands(): void {
  if (fireReady) return
  fireReady = true
  doorCount(1)
  doorMeasureEl.classList.add('done')
  enterEl.removeAttribute('aria-disabled')
  enterEl.removeAttribute('aria-busy')
  // the door's word is the button now: the status line steps back
  if (atDoor()) setStatus('')
  if (pressedEarly) enterTheFire()
}

/** Where an engine has no `scheduler.yield`, the renderer's compile waits a
    whole frame between two of its steps, and the way on arrives seconds
    late. For the length of the door's build, and no longer, such an engine
    is lent a yield that waits one task. */
function lendYield(): () => void {
  const host = self as unknown as { scheduler?: { yield?: () => Promise<void> } }
  if (typeof host.scheduler?.yield === 'function') return () => {}
  try {
    const channel = new MessageChannel()
    const waiting: Array<() => void> = []
    channel.port1.onmessage = () => waiting.shift()?.()
    const lent = Object.create(host.scheduler ?? null) as { yield: () => Promise<void> }
    lent.yield = () =>
      new Promise<void>((resolve) => {
        waiting.push(resolve)
        channel.port2.postMessage(0)
      })
    Object.defineProperty(self, 'scheduler', { value: lent, configurable: true, writable: true })
    return () => {
      delete (self as unknown as { scheduler?: unknown }).scheduler
      channel.port1.close()
    }
  } catch {
    return () => {}
  }
}

/** Build the court's materials behind the door. A material compiles in the
    pass that first DRAWS it, and this room stands around the eye, so a drawn
    warm frame here would be a black flash over the eclipse: the renderer
    compiles it off the frame instead. The room is listed for the compile
    inside the call itself, where the listing is synchronous, and struck
    again before the next frame, so the loop never has to hold still. */
function buildTheFire(): void {
  if (building || fireReady) return
  building = true
  doorCount(0.5)
  const returnYield = lendYield()
  const done = (): void => {
    if (!building) return
    building = false
    returnYield()
    fireStands()
  }
  agora.warm(true)
  const built = renderer.compileAsync(scene, camera)
  agora.warm(false)
  void built.then(done, done)
  // a compile that never answers may not strand the visitor at a dark button
  window.setTimeout(done, 8000)
}

function enterTheFire(): void {
  if (curtain || !atDoor()) return
  if (!fireReady) {
    pressedEarly = true
    return
  }
  curtain = 1
  wakeInstruments()
  blackoutEl.classList.add('down')
  window.setTimeout(
    () => {
      standAtTheFire()
      curtain = 2
    },
    reducedMotion ? 0 : 340
  )
}

/** the night on the other side of the curtain: the door open, the sky whole,
    the court standing, the eye seated at the fire */
function standAtTheFire(): void {
  transit = 1
  desc = descTarget = 1
  holdRide(1)
  door = 1
  skyBirth = 1
  agoraReveal = 1
  setPhase('agora')
}

enterEl.addEventListener('click', () => enterTheFire())

// ---- the instrument rail: the plain-faced layer over the poetry ----
const railNode = document.getElementById('rail')
const railSound = document.getElementById('rail-sound')
const railInstruments = document.getElementById('rail-instruments')
const instrumentsNode = document.getElementById('instruments')
if (!railNode || !railSound || !railInstruments || !instrumentsNode) throw new Error('missing rail')
const railEl: HTMLElement = railNode
const instrumentsEl: HTMLElement = instrumentsNode
const instSound = document.getElementById('inst-sound')
/** THE PLAN BELONGS TO A WING, so its row stands only while one does. The
    panel tells the wing standing to open it and gets out of the way. */
const instPlan = document.getElementById('inst-plan') as HTMLButtonElement | null
instPlan?.addEventListener('click', () => {
  setInstruments(false, false)
  dispatchEvent(new Event('na-wing-plan'))
})
const inertBefore = new Map<HTMLElement, boolean>()

function syncSoundLabel(): void {
  const on = ambience.on()
  for (const el of [railSound, instSound]) {
    el?.setAttribute('aria-pressed', String(on))
    if (el) el.textContent = say(on ? LOBBY_TEXT.soundOn : LOBBY_TEXT.soundOff)
  }
}
function toggleSound(): void {
  if (ambience.on()) ambience.disable()
  else ambience.enable()
  syncSoundLabel()
}
railSound?.addEventListener('click', toggleSound)
instSound?.addEventListener('click', toggleSound)

/** THE PANEL IS A SHEET INSIDE A WING. The museum's own control stands on the
    wing's band, the panel it opens takes the frame's whole height, and the
    picture beside it stays visible, so a press on it gives the room back. */
const panelIsSheet = (): boolean => phase === 'wing' && deskPanel()

/** The instruments stand on the desktop's band only where that band stands:
    a narrow stage keeps the phone's own way to them. */
function deskPanel(): boolean {
  return deskOn('panel') && innerWidth / innerHeight > 0.9
}

/** where the museum's control stands, and what the sheet's rules key on */
function markPanel(): void {
  const sheet = panelIsSheet()
  if (sheet) document.documentElement.dataset['naPanel'] = instrumentsEl.hidden ? 'wing' : 'open'
  else delete document.documentElement.dataset['naPanel']
  if (sheet) return
  if (wingRows.length) { wingRows = []; paintWingRows() }
  for (const name of ['--desk-band-h', '--desk-panel-g'])
    document.documentElement.style.removeProperty(name)
}

/** a press outside the sheet gives the picture back, as Escape and Close do */
function pressOutside(event: Event): void {
  const target = event.target
  if (!(target instanceof Node)) return
  if (instrumentsEl.contains(target) || railInstruments?.contains(target)) return
  setInstruments(false)
}

function setInstruments(open: boolean, focus = true): void {
  const sheet = panelIsSheet()
  instrumentsEl.hidden = !open
  if (instPlan) instPlan.disabled = phase !== 'wing'
  railInstruments?.setAttribute('aria-expanded', String(open))
  if (open) {
    /* THE HANDLE IS THE CONTROL, RISEN. Inside a wing the same element moves
       to the sheet's head, so the hand that opened it closes it without
       moving and the sheet keeps one tab order. */
    if (sheet && railInstruments) instrumentsEl.prepend(railInstruments)
    // the sheet leaves the room reachable on purpose: a press on the picture
    // is the third way out of it
    if (!sheet) for (const el of Array.from(document.body.children)) {
      if (!(el instanceof HTMLElement) || el === instrumentsEl || el.matches('script, style')) continue
      if (!inertBefore.has(el)) inertBefore.set(el, el.inert)
      el.inert = true
    }
    if (sheet) addEventListener('pointerdown', pressOutside, true)
    if (focus) {
      const first = sheet ? instrumentsEl.querySelector<HTMLElement>('.inst-wing button, .inst-links button') : instSound
      first?.focus()
    }
  } else {
    if (railInstruments && railInstruments.parentElement === instrumentsEl) railEl.append(railInstruments)
    removeEventListener('pointerdown', pressOutside, true)
    for (const [el, inert] of inertBefore) el.inert = inert
    inertBefore.clear()
    if (focus) railInstruments?.focus()
  }
  markPanel()
}

/* ---- THE FIVE ROWS A WING ADDS AT THE PANEL'S HEAD ----
   The panel is the museum's and knows no wing. The wing standing says which
   rows it adds and what each is called in the page's language, and a press
   here says which row it was: the wing answers with its own control. No word
   of a wing is written in this file. */
let wingRows: DeskPanelRow[] = []
const instWing = instrumentsEl.querySelector<HTMLElement>('.inst-wing')
/** the way out of the wing, drawn and not fetched */
function rowMark(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', 'inst-row-mark')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.4')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  line.setAttribute('d', 'M13 8H3M7 4L3 8l4 4')
  svg.append(line)
  return svg
}

function paintWingRows(): void {
  if (!instWing) return
  instWing.textContent = ''
  instWing.hidden = wingRows.length === 0
  for (const row of wingRows) {
    const control = document.createElement('button')
    control.type = 'button'
    control.dataset['row'] = row.id
    if (row.mark === 'back') control.append(rowMark())
    control.append(document.createTextNode(row.label))
    if (row.count) {
      const count = document.createElement('span')
      count.className = 'inst-row-count'
      count.textContent = row.count
      control.append(count)
    }
    // a row whose own surface is not built names itself and refuses
    if (row.disabled) control.setAttribute('aria-disabled', 'true')
    control.addEventListener('click', () => {
      if (control.getAttribute('aria-disabled') === 'true') return
      setInstruments(false, false)
      dispatchEvent(new CustomEvent('na-wing-instrument', { detail: { row: row.id } }))
    })
    instWing.append(control)
  }
}

addEventListener('na-wing-instruments', event => {
  const rows = (event as CustomEvent<{ rows?: DeskPanelRow[] }>).detail?.rows
  wingRows = Array.isArray(rows) ? rows : []
  paintWingRows()
})
railInstruments?.addEventListener('click', () => setInstruments(instrumentsEl.hidden))
instrumentsEl.querySelector('.inst-close')?.addEventListener('click', () => setInstruments(false))
instrumentsEl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    setInstruments(false)
    return
  }
  if (event.key !== 'Tab') return
  const controls = Array.from(instrumentsEl.querySelectorAll<HTMLElement>('button:not(:disabled), a, summary'))
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
})

function syncInstruments(): void {
  for (const control of instrumentsEl.querySelectorAll<HTMLElement>('[data-language]'))
    control.setAttribute('aria-pressed', String(control.dataset['language'] === lang()))
  for (const control of instrumentsEl.querySelectorAll<HTMLElement>('[data-tier-choice]'))
    control.setAttribute('aria-pressed', String(control.dataset['tierChoice'] === stack.tierName()))
  for (const control of instrumentsEl.querySelectorAll<HTMLElement>('[data-pace-choice]'))
    control.setAttribute('aria-pressed', String(control.dataset['paceChoice'] === gaitPace()))
  const library = instrumentsEl.querySelector<HTMLAnchorElement>('.inst-library')
  if (library) library.href = `https://agoracosmica.org/app?lang=${lang()}`
  syncSoundLabel()
}

function setLobbyLanguage(language: 'en' | 'de'): void {
  const address = new URL(location.href)
  address.searchParams.set('lang', language)
  history.replaceState({}, '', address)
  document.documentElement.lang = language
  syncLobbyCopy()
  syncReadWeights()
  const sky = HUB_SPOTS[0]
  if (sky) sky.label = say(LOBBY_TEXT.sky)
  if (phase === 'agora') hotspots.set(HUB_SPOTS)
  if (phase === 'agora') fireLine()
  if (paneOpen) openPane(paneSlug)
  syncInstruments()
  syncPageReserve(true)
  /* THE LANGUAGE IS CHOSEN HERE AND SPOKEN EVERYWHERE. The lobby's control
     rewrites the page's language under whatever stands above it, so the
     choice is announced once, after the page itself is in it, and every
     surface outside this file repaints from the one event. */
  dispatchEvent(new CustomEvent('na-language', { detail: language }))
}

for (const control of instrumentsEl.querySelectorAll<HTMLButtonElement>('[data-language]')) {
  control.addEventListener('click', () => {
    const language = control.dataset['language']
    if (language === 'en' || language === 'de') setLobbyLanguage(language)
  })
}
/* THE PACE THE VISITOR SETS. It stands beside the tier because it is the same
   kind of choice: how the museum should behave on this device, kept on it. The
   row is built here rather than in the page, so the wing that owns the walk
   owns its three numbers and the shell only stands them. */
const paceRow = document.createElement('fieldset')
paceRow.className = 'inst-setting inst-tiers inst-pace'
const paceLegend = document.createElement('legend')
paceLegend.dataset['lobby'] = 'pace'
paceLegend.textContent = say(LOBBY_TEXT.pace)
paceRow.append(paceLegend)
for (const [name, key] of [['stroll', 'paceStroll'], ['walk', 'paceWalk'], ['brisk', 'paceBrisk']] as const) {
  const control = document.createElement('button')
  control.type = 'button'
  control.dataset['paceChoice'] = name
  control.setAttribute('aria-pressed', String(gaitPace() === name))
  const word = document.createElement('span')
  word.dataset['lobby'] = key
  word.textContent = say(LOBBY_TEXT[key])
  control.append(word)
  if (name === 'walk') {
    const cost = document.createElement('small')
    cost.dataset['lobby'] = 'paceCost'
    cost.textContent = say(LOBBY_TEXT.paceCost)
    control.append(cost)
  }
  control.addEventListener('click', () => {
    setGaitPace(name)
    syncInstruments()
  })
  paceRow.append(control)
}
instrumentsEl.querySelector('.inst-tiers')?.after(paceRow)
for (const control of instrumentsEl.querySelectorAll<HTMLButtonElement>('[data-tier-choice]')) {
  control.addEventListener('click', () => {
    const name = control.dataset['tierChoice']
    if (!isTierName(name)) return
    stack.tier(name)
    syncInstruments()
  })
}
syncInstruments()
addEventListener('na-sound-change', syncSoundLabel)

// a voice holding the floor ducks the ambient bed
addEventListener('na-voice', (e) => {
  ambience.duck(Boolean((e as CustomEvent).detail))
})

/** THE ONE SENTENCE AT THE FIRE. It is the whole instruction of the lobby,
    so it stands for as long as the fire is the frame and leaves with the
    gaze, never on a timer. */
function fireLine(): void {
  verseEl.textContent = say(LOBBY_TEXT.fireLine)
  verseEl.classList.add('lit')
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
          chapter?: number
          figure?: string
          /** which wing a `wing` or `pane` state stands in */
          slug?: string
          /** which station of that wing, by its own id or by index */
          station?: string
          /** a named composition at that station */
          view?: string
          /** Shell close-ups for THE EYES; the journey uses real input. */
          shell?: 'instruments' | 'instruments-labels'
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
  /* THE ENTRY IS OVER WHEN THE WALK IS PAID FOR. A wing compiles the
     pipelines of a room the first time a frame draws it, so without this the
     wait would only look shorter: the seconds would move out of the entry and
     into the first leg, as stutters. The caller's loading field holds until
     this resolves, and the count of poses warmed is what it shows. */
  await wingFrame.ready(breath.progress)
}

/** One gold breath, then a hard cut into the wing that was chosen. The cut
    is not on a clock: the gold holds its own beat and then for as long as the
    wing needs, so what follows it is a wing and never a raw stage. */
function enterWing(slug: string): void {
  if (!wingBySlug(slug)) return
  closePane()
  setPhase('breath')
  breath.begin(() => {
    history.pushState({}, '', `/w/${slug}${location.search}`)
    return openWing(slug, 0)
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
  // A POP THAT LANDS WHERE THE VISITOR ALREADY STANDS IS THE WING'S OWN. The
  // close look pushes an entry inside a station, and re-opening the wing on
  // that pop strikes the card the wing just raised and cuts its walk short.
  if (here && phase === 'wing' && wingSlug === here.slug && wingFrame.standsAt(here.station)) return
  if (here) void openWing(here.slug, here.station)
  else if (phase === 'wing' || phase === 'bench') toLobby()
})

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
    if (opts.lang) setLobbyLanguage(opts.lang)
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
      : p === 'descent' ? courtRiseAt(desc)
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
    railEl.hidden = p === 'transit' || p === 'held' || p === 'breath' || (p === 'wing' && !deskPanel())
    // the rig's front door is the door as it STANDS. The frame where it is
    // still waiting is shot by navigating to it, never by a jump: a frozen
    // eye would hold that frame for as long as it looked.
    if (p === 'held') fireStands()
    if (p === 'breath') breath.forgeStage()
    // Additive shell staging, explicitly allowed by the commission's eyes loop.
    setInstruments(Boolean(opts.shell), false)
    const labels = instrumentsEl.querySelector<HTMLDetailsElement>('.inst-labels')
    if (labels) labels.open = opts.shell === 'instruments-labels'
    instrumentsEl.scrollTop = opts.shell === 'instruments-labels' ? instrumentsEl.scrollHeight : 0
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
    syncInstruments()
  },
  cost() {
    return stack.cost()
  },
  manifest() {
    return [...stack.materials.manifest(), ...bench.manifest(), ...wingFrame.manifest()]
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
      texturesPending: stack.materials.pending() + (stand?.texturesPending ?? 0) + wingFrame.pending(),
      // a library set that failed has left the count above, so it is named here
      textureErrors: [...wingFrame.errors(), ...stack.materials.missing().map(({ name, reason }) => `library/${name}: ${reason}`)],
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
/** how long the opening may hold its first frame waiting for the room */
const OPENING_HOLD = 2.5

/* THE WAY HOME IN FRONT OF THE VISITOR. At a wing's last stop the next step
   is the lobby, so its sets may go out ahead of it, but only on a line that
   says it can spare them: never under Save-Data, never on 2G or 3G, and not
   where the browser does not say what the line is. */
let lobbyAhead = false
function sendLobbyAhead(): void {
  if (lobbyAhead) return
  const count = wingFrame.stations()
  if (!count || wingFrame.station() !== count - 1) return
  lobbyAhead = true
  const line = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const spare =
    line !== undefined &&
    line.saveData !== true &&
    typeof line.effectiveType === 'string' &&
    !['slow-2g', '2g', '3g'].includes(line.effectiveType)
  if (spare) agora.fetchSets()
}

function setPhase(next: Phase): void {
  // the phase arrives from the rig as well as from the night's own verbs, so
  // a name nobody wrote is reachable: refuse it and keep the stage standing
  if (!isPhase(next)) {
    console.warn(`no such phase: ${String(next)}`)
    return
  }
  if (next !== 'bench') bench.close()
  setInstruments(false, false)
  phase = next
  document.body.dataset['phase'] = next
  if (LOBBY_PHASES.has(next)) agora.fetchSets()
  stack.setScene(scene, camera, LOOK[next])
  /* the door's own layer answers to the door, not to one of its two states:
     the way on, its measure and its word stand while the moon travels and
     while the totality holds, and a page that has not reached the door yet
     carries none of them */
  document.body.classList.toggle('door', next === 'transit' || next === 'held')
  // the door says only what it is doing: the word while the room is built,
  // nothing once the way on is lit
  if (next === 'transit' || next === 'held') setStatus(fireReady ? '' : 'firstLight')
  if (next === 'descent') {
    wakeInstruments()
    setStatus('descend')
    descentEl.hidden = false
    holdRide(desc)
    lastHand = rideClock
  } else {
    descentEl.hidden = true
    document.body.classList.remove('arriving')
    document.body.classList.remove('riding')
    for (const b of descentBeats) b.style.opacity = '0'
  }
  if (next === 'agora') {
    agoraEnteredAt = elapsed
    lookTarget = 0
    lookUp = 0
    setStatus('fireStatus')
    fireLine()
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
    /* THE MUSEUM'S CONTROL STANDS INSIDE A WING. The rail carries it alone
       there: a wing plays no sound in the first product, and a control that
       does nothing does not stand. */
    railEl.hidden = !(next === 'wing' && deskPanel())
  } else if (railAwake) {
    railEl.hidden = false
  }
  markPanel()
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

function setStatus(key: keyof typeof LOBBY_TEXT | ''): void {
  if (!status) return
  // the ride asks for this every frame; only a change touches the page
  if (status.dataset['lobby'] === key) return
  status.dataset['lobby'] = key
  status.textContent = key ? say(LOBBY_TEXT[key]) : ''
}

// ---- input: scroll is the only verb ----
function push(delta: number): void {
  if (!instrumentsEl.hidden) return
  if (phase === 'transit' || phase === 'held') return
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
  if (!instrumentsEl.hidden) return
  // the visitor is writing or choosing, not steering
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') push(160)
  if (e.key === 'ArrowUp' || e.key === 'PageUp') push(-160)
  // in the sky the carousel also answers left and right
  if (phase === 'wheel' && !paneOpen) {
    if (e.key === 'ArrowRight') stepChapter(1)
    if (e.key === 'ArrowLeft') stepChapter(-1)
  }
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
  /* THE OPENING GIVES THE BUILD THE WHOLE THREAD. The moon is held at its
     first frame until the room stands, so a frame drawn now would repeat
     the frame already on the glass and buy nothing, while it costs the
     compile a step and the way on its arrival. */
  if (building) return
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
    /* THE MOON WAITS FOR THE ROOM. Building the court behind the door costs
       one long main thread stall, and a stall inside the travel is a hitch
       in the one motion the visitor is watching. So the opening holds its
       first frame until the room stands, and moves after it. The cap is the
       machine that never answers: better a hitch than a door that never
       opens. */
    const waiting = !fireReady && elapsed < OPENING_HOLD
    if (!waiting) transit = reducedMotion ? 1 : Math.min(1, transit + dt / TRANSIT_SECONDS)
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
    /* THREE MARKS, AND A WAY ON AT EVERY STATE. The foot of the frame holds
       exactly one line: the instruction while the ride is being taken up and
       again as the fire comes, the way past it through the body of the fall.
       Instruments withdraws for the ride. Sound keeps its own control. */
    document.body.classList.toggle('riding', desc > 0.155 && desc <= 0.80)
    document.body.classList.toggle('arriving', desc > 0.80)
    /* WHERE THE ROOM COMES UP, THE RIDE IS OVER. A scroll cannot descend
       any further from here, so the foot of the frame stops asking for one
       and names what the court expects instead. Scrubbing back up the
       travel gives the instruction back. */
    setStatus(desc >= CUT.courtRise[0] ? 'fireStatus' : 'descend')
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
  // the map is switched off, not faded: by then the court stands complete
  // behind its ring and the camera is within centimetres of the seat, where
  // the two rings are the same pixels
  const mandalaReveal =
    phase === 'descent' && desc < CUT.mapOut ? smooth(0.22, 0.32, desc) : 0
  mandala.visible(mandalaReveal > 0.004)
  // the heart warms at overview altitude and yields before the close
  // pass, or its glow would paint the whole near frame beige
  mandala.update(
    dt,
    elapsed,
    mandalaReveal,
    smooth(0.55, 0.89, desc),
    // the deep opens INSIDE the door and closes into the fire's own light
    phase === 'descent' ? smooth(0.02, 0.14, desc) * (1 - smooth(0.90, 0.965, desc)) : 0,
    phase === 'descent' ? desc : 1
  )

  const revealTarget =
    phase === 'agora' ? 1
    // looking up, the court is scenery: it still frames the sky from below,
    // but its own embers stop cutting across the wheel's letterpress (and the
    // heaviest fragment shader in the night stops paying full price)
    : phase === 'wheel' ? 0.72
    : phase === 'descent' ? courtRiseAt(desc)
    : 0
  // a wing owns its own room: the lobby's court strikes fast so nothing
  // of the fire is left standing behind the first station
  // the fire materializes briskly on arrival (the wait read as lag);
  // every other blend keeps the night's slow breath
  agoraReveal +=
    (revealTarget - agoraReveal) *
    Math.min(1, dt * (reducedMotion ? 20 : phase === 'agora' ? 2.2 : 1.2))
  // the ride's own clock already eases the fall: the court rises with it, or
  // the live cut lands on a room still a second behind the stills
  if (phase === 'descent') agoraReveal = revealTarget

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
      // and they LEAVE: a white spark loose among the letterpress was the
      // one thing in this frame that was neither a name nor a field star
      phase === 'wheel' ? 0.55 * (1 - atlasReveal)
      // and at the fire they are gone: the room has its own embers, and a
      // loose spark up at the masthead is a mark nobody chose
      : phase === 'agora' ? 0
      : phase === 'breath' || phase === 'wing' ? 0
      : 0.3,
    sinceFlash: flashAt < 0 ? -1 : elapsed - flashAt,
    elapsed,
  }
  eclipse.update(state)

  // the wheel of the night: the dome carries the six houses around the
  // visitor; the camera only breathes toward the focused elevation
  if (phase === 'wheel') {
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2)
    camera.rotation.x +=
      (atlas.currentElevation() - camera.rotation.x) * Math.min(1, dt * 2.2)
  }
  atlasReveal +=
    ((phase === 'wheel' ? 1 : 0) - atlasReveal) * Math.min(1, dt * (reducedMotion ? 20 : 1.4))
  atlas.visible(atlasReveal > 0.005)
  atlas.update(dt, elapsed, camera.aspect, atlasReveal)
  syncChips()

  ambience.update(dt)
  /* THE COURT IS PUT UP INSIDE THE BLACK BREATH. Every material of the room
     builds its shader and its pipeline in the frame that first draws it, and
     that frame used to be the landing: about three hundred milliseconds
     inside the one stride the visitor is watching. Here the room stands for
     a single frame while the moon holds the whole frame black, with every
     colour at zero, so the work is paid where there is nothing to see. The
     map is not up yet and the ride is between two questions. */
  const warmNow =
    !courtWarm &&
    !frozen &&
    // the passage from the door: the curtain is down and the room is the
    // only thing behind it, so its one dark frame is paid for here
    (curtain === 2 || (phase === 'descent' && desc > 0.17 && desc < 0.30))
  if (warmNow) agora.warm(true)
  agora.update({
    reveal: agoraReveal,
    elapsed,
    // looking up, the court is scenery and its air belongs to the room
    // below: the sky phase keeps the colonnade and gives back the sparks
    air: phase === 'wheel' || phase === 'breath' ? 0 : 1,
    // the court's floor layers and its near ring wait for the map to go
    landed: phase === 'descent' && desc < CUT.mapOut ? 0 : 1,
  })

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
  if (phase === 'wing') {
    wingFrame.update(dt)
    sendLobbyAhead()
  }
  if (!(phase === 'wing' && wingFrame.held())) stack.render(dt)
  if (warmNow) {
    agora.warm(false)
    courtWarm = true
  }
  camera.rotation.x = baseRx
  camera.rotation.y = baseRy
  painted++
  /* THE PASSAGE, FRAME BY FRAME. The room takes its one dark frame under
     the curtain, and the curtain lifts on the frame after it: lifting on
     the warm frame itself would show the court with every colour at zero. */
  if (curtain === 2) curtain = 3
  else if (curtain === 3) {
    curtain = 0
    blackoutEl.classList.add('lifting')
    blackoutEl.classList.remove('down')
    window.setTimeout(() => blackoutEl.classList.remove('lifting'), 700)
    // the way on has left the frame, so the hand that pressed it would be
    // left on the body: the fire's own sentence takes the focus, which is
    // also what a reader hears first on arriving
    verseEl.focus({ preventScroll: true })
  }
  // the door's own wait starts once its first frame is actually on the
  // glass: the room is built behind a picture, never instead of one
  if (atDoor() && painted > 0 && !frozen) buildTheFire()
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
  return phase === 'agora' && !paneOpen && instrumentsEl.hidden
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
  wakeInstruments()
  /* A DEEP LINK WAITS AT THE SAME FIELD. Typed straight in, the address used
     to stand the visitor on the raw stage until the wing was built. */
  breath.hold(openWing(here.slug, here.station))
  return true
}

function main(): void {
  /* THE NIGHT OPENS AT ITS FRONT DOOR: the eclipse happening, with one way
     on. The page carries the shell's own opening state until here and never
     the door's own layer, so a wing address never paints the door's way on
     for a frame. The stage is not re-entered: it is where the night already
     is, and a phase change here would put a scene rebuild in front of the
     first painted frame. */
  if (!bootRoute()) {
    /* a stage that asks for no motion is given the totality itself, at once
       and complete: no crossing, and no bead in time either */
    if (reducedMotion) {
      phase = 'held'
      transit = 1
    }
    document.body.dataset['phase'] = phase
    document.body.classList.add('door')
    setStatus('firstLight')
  }
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
