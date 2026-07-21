import { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createKeeper } from './scenes/keeper'
import { createCrossing } from './scenes/crossing'
import { createCamp } from './scenes/camp'
import { createCouncil } from './scenes/council'
import { createAtlas } from './scenes/atlas'
import { CAMP_SCRIPT } from './content/keeper-script'
import { COUNCIL_DONE } from './content/council'
import { WANDERERS } from './content/wanderers'
import { CONSTELLATIONS, OPEN_WORLD } from './content/constellations'
import { mediaUrl } from './content/media'

type Phase = 'transit' | 'held' | 'door' | 'stone' | 'agora' | 'sky' | 'crossing' | 'camp' | 'council'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const keeper = document.getElementById('keeper')
const stone = document.getElementById('stone')
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
  !stage || !status || !keeper || !stone || !verse || !voiceDom || !traceCard ||
  !ringflash || !plate || !invite || !marks || !chips || !pane
)
  throw new Error('missing shell')
const keeperEl: HTMLElement = keeper
const stoneEl: HTMLElement = stone
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
const keeperScene = createKeeper(keeperEl, reducedMotion, () => returnFromCamp())
const crossing = createCrossing(scene, () => setPhase('camp'))
const camp = createCamp(scene)
const council = createCouncil(scene, () => councilEnded())
const atlas = createAtlas(scene)

function councilEnded(): void {
  setStatus(COUNCIL_DONE)
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
let doorTarget = 0
let skyBirth = 0
let flashAt = -1
let elapsed = 0
let frozen = false
let agoraReveal = 0
let lookUp = 0
let lookTarget = 0
let agoraEnteredAt = -1
let stoneEnteredAt = -1
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
  // the sky chrome steps back while a figure holds the frame
  plateEl.classList.remove('lit')
  inviteEl.classList.remove('lit')
  marksEl.classList.remove('lit')
}

function closePane(): void {
  paneOpen = false
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
function skyDress(on: boolean): void {
  plateEl.classList.toggle('lit', on)
  inviteEl.classList.toggle('lit', on)
  marksEl.classList.toggle('lit', on)
  chipsEl.hidden = !on
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

/** The short-dawn rhyme: one diamond-ring breath, and the agora is
    changed: the council is convening. */
function returnFromCamp(): void {
  if (phase !== 'camp') return
  ringEl.classList.add('lit')
  window.setTimeout(() => {
    setPhase('council')
    council.begin()
    ringEl.classList.remove('lit')
    ringEl.classList.add('passing')
    window.setTimeout(() => ringEl.classList.remove('passing'), 1200)
  }, 460)
}

// each poem line appears once, at its appointed threshold
const spokenVerses = new Set<string>()
let verseTimer = 0
function verseShow(line: string): void {
  if (spokenVerses.has(line)) return
  spokenVerses.add(line)
  verseEl.textContent = line
  verseEl.classList.add('lit')
  window.clearTimeout(verseTimer)
  verseTimer = window.setTimeout(() => verseEl.classList.remove('lit'), 5600)
}

// forge hook: lets the screenshot rig drive deterministic states
declare global {
  interface Window {
    __forge?: {
      jump: (
        p: Phase,
        opts?: {
          door?: number
          transit?: number
          skyBirth?: number
          sinceFlash?: number
          keeper?: number
          crossing?: 'hatch' | 'portrait' | 'breath'
          camp?: 'trace' | 'hearth'
          chapter?: number
          figure?: string
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
    door = doorTarget =
      opts.door ?? (p === 'door' ? 0.5 : p === 'transit' || p === 'held' ? 0 : 1)
    skyBirth =
      opts.skyBirth ??
      (p === 'transit' ? 0
      : p === 'held' || p === 'stone' ? 0.75
      : p === 'crossing' ? 0.12
      : p === 'camp' ? 0.08
      : p === 'council' ? 0.55
      : 1)
    flashAt = elapsed - (opts.sinceFlash ?? 999)
    agoraReveal = p === 'agora' || p === 'sky' ? 1 : 0
    lookUp = lookTarget = p === 'sky' ? 1 : 0
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
    if (p !== 'agora' && p !== 'sky' && p !== 'camp' && p !== 'council') camera.rotation.set(0, 0, 0)
    if (p === 'council') {
      agoraReveal = 1
      camera.rotation.set(-0.12, 0, 0)
      verseEl.classList.remove('lit')
      council.forgeStage(camera)
    }
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
  if (next === 'stone') {
    stoneEnteredAt = elapsed
    doorTarget = 1 // the crossed door completes on its own
    setStatus('')
    stoneEl.classList.add('lit')
  } else {
    stoneEl.classList.remove('lit')
  }
  if (next === 'held') setStatus('Scroll to enter')
  if (next === 'door') setStatus('')
  if (next === 'agora') {
    agoraEnteredAt = elapsed
    lookTarget = 0
    lookUp = 0
    setStatus('The night agora · scroll to look up')
    verseShow('Questions shine within you')
  }
  if (next === 'sky') {
    setStatus('')
    verseShow('Voices awaken across Time')
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
  }
  if (next === 'council') {
    setStatus('')
    verseShow('This is the Agora.')
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
  }
}

function setStatus(text: string): void {
  if (status) status.textContent = text
}

// ---- input: scroll is the only verb ----
function push(delta: number): void {
  if (phase === 'transit') return
  if (phase === 'held' && delta > 0) setPhase('door')
  if (phase === 'door') {
    doorTarget = Math.min(1, Math.max(0, doorTarget + delta * 0.0012))
  }
  if (phase === 'stone' && delta > 0 && elapsed - stoneEnteredAt > 1.2) setPhase('agora')
  if (phase === 'agora') {
    lookTarget = Math.min(1, Math.max(0, lookTarget + delta * 0.0009))
  }
  // the wheel of the night: scroll or swipe steps the carousel, wrapping
  if (phase === 'sky' && !paneOpen) {
    if (Math.sign(delta) !== Math.sign(skyAcc)) skyAcc = 0
    skyAcc += delta
    if (Math.abs(skyAcc) > 150) {
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

  // the door keeps easing in every phase: once crossed it must finish its
  // swing to 1, or its dark plane hangs across the live sky forever
  door += (doorTarget - door) * Math.min(1, dt * 4)
  if (reducedMotion) door = doorTarget
  if (phase === 'door' && door > 0.985) setPhase('stone')

  // the stone: one held black breath, long enough to be read
  if (phase === 'stone' && elapsed - stoneEnteredAt > 4.8) setPhase('agora')

  const revealTarget = phase === 'agora' || phase === 'sky' || phase === 'council' ? 1 : 0
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
      campHearthOpen = true
      keeperScene.setScript(CAMP_SCRIPT)
      keeperEl.hidden = false
    }
  } else if (phase !== 'sky') {
    keeperEl.hidden = true
  }

  // the camp world breathes in and out with its phase
  const campTarget = phase === 'camp' ? 1 : 0
  campReveal += (campTarget - campReveal) * Math.min(1, dt * (reducedMotion ? 20 : 1.1))
  if (phase === 'camp') {
    camera.rotation.x += (-0.12 - camera.rotation.x) * Math.min(1, dt * 2)
    camera.rotation.y += (0 - camera.rotation.y) * Math.min(1, dt * 2)
  }
  campYield += ((phase === 'camp' && !keeperEl.hidden ? 1 : 0) - campYield) * Math.min(1, dt * 2.5)
  camp.update({ reveal: campReveal, elapsed, yield: campYield })
  syncTrace()

  // stars are born at totality; near the fire they yield to its light,
  // and during the crossing the sky withdraws to ember
  const birthTarget =
    phase === 'transit' ? 0
    : phase === 'held' || phase === 'stone' ? 0.75
    : phase === 'agora' || phase === 'council' ? 0.55
    : phase === 'crossing' ? 0.12
    : phase === 'camp' ? 0.08
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
  agora.update({ reveal: agoraReveal, elapsed, speak: keeperScene.speak(), blaze: council.blaze() })

  renderer.render(scene, camera)
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
