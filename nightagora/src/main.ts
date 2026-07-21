import { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { createAgora } from './scenes/agora'
import { createKeeper } from './scenes/keeper'
import { createCrossing } from './scenes/crossing'
import { createCamp } from './scenes/camp'
import { createCouncil } from './scenes/council'
import { CAMP_SCRIPT } from './content/keeper-script'
import { COUNCIL_DONE } from './content/council'
import { WANDERERS } from './content/wanderers'

const MARCUS = WANDERERS.findIndex((w) => w.slug === 'aurelius')

type Phase = 'transit' | 'held' | 'door' | 'stone' | 'agora' | 'sky' | 'crossing' | 'camp' | 'council'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const card = document.getElementById('atlas-card')
const keeper = document.getElementById('keeper')
const stone = document.getElementById('stone')
const verse = document.getElementById('verse')
const voiceDom = document.getElementById('voice')
const traceCard = document.getElementById('trace-card')
const ringflash = document.getElementById('ringflash')
if (!stage || !status || !card || !keeper || !stone || !verse || !voiceDom || !traceCard || !ringflash)
  throw new Error('missing shell')
const keeperEl: HTMLElement = keeper
const stoneEl: HTMLElement = stone
const verseEl: HTMLElement = verse
const voiceEl2: HTMLElement = voiceDom
const traceEl: HTMLElement = traceCard
const ringEl: HTMLElement = ringflash
const cardName = card.querySelector('.card-name')
const cardYears = card.querySelector('.card-years')
const cardEpithet = card.querySelector('.card-epithet')
const cardNote = card.querySelector('.card-note')

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
        }
      ) => void
      freeze: (t: number) => void
      focusWanderer: (i: number) => void
    }
  }
}
// ---- the atlas: wanderer focus + card ----
let pointerX = -1
let pointerY = -1
let hoverIdx: number | null = null
let lockedIdx: number | null = null
const projected = new Vector3()

function wandererScreenPos(i: number): { x: number; y: number } | null {
  const base = eclipse.wandererBase[i]
  if (!base) return null
  projected.set(base[0], base[1], base[2]).applyMatrix4(eclipse.wanderers.matrixWorld).project(camera)
  if (projected.z > 1) return null
  const x = (projected.x * 0.5 + 0.5) * innerWidth
  const y = (-projected.y * 0.5 + 0.5) * innerHeight
  if (x < -40 || x > innerWidth + 40 || y < -40 || y > innerHeight + 40) return null
  return { x, y }
}

function nearestWanderer(px: number, py: number, radius: number): number | null {
  let best: number | null = null
  let bestDist = radius
  for (let i = 0; i < WANDERERS.length; i++) {
    const p = wandererScreenPos(i)
    if (!p) continue
    const d = Math.hypot(p.x - px, p.y - py)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function syncCard(): void {
  if (!card) return
  const idx = lockedIdx ?? hoverIdx
  const visible = phase === 'sky' && idx !== null && eclipse.wandererOpacity() > 0.4
  if (!visible || idx === null) {
    card.hidden = true
    return
  }
  const w = WANDERERS[idx]
  const p = wandererScreenPos(idx)
  if (!w || !p) {
    card.hidden = true
    return
  }
  if (cardName) cardName.textContent = w.name
  if (cardYears) cardYears.textContent = w.years
  if (cardEpithet) cardEpithet.textContent = w.epithet
  if (cardNote) {
    cardNote.textContent =
      idx === MARCUS
        ? lockedIdx === MARCUS
          ? 'His night is open · tap his light again'
          : 'Tap his light to cross'
        : 'This world is still being drawn'
  }
  const el = card as HTMLElement
  el.style.left = `${Math.min(Math.max(p.x + 22, 16), innerWidth - 300)}px`
  el.style.top = `${Math.min(Math.max(p.y - 24, 16), innerHeight - 140)}px`
  card.hidden = false
}

addEventListener('pointermove', (e) => {
  pointerX = e.clientX
  pointerY = e.clientY
})
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

function beginCrossing(): void {
  const base = eclipse.wandererBase[MARCUS]
  if (!base) return
  const to = new Vector3(base[0], base[1], base[2]).applyMatrix4(eclipse.wanderers.matrixWorld)
  setPhase('crossing')
  crossing.begin(to)
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
  if (phase !== 'sky') return
  const hit = nearestWanderer(e.clientX, e.clientY, 64)
  if (hit === MARCUS && lockedIdx === MARCUS) {
    beginCrossing()
    return
  }
  lockedIdx = hit !== null && hit === lockedIdx ? null : hit
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
    if (p === 'sky') camera.rotation.x = 0.62
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
  focusWanderer(i) {
    if (i >= 0) {
      lockedIdx = i
      return
    }
    // i < 0: pick the visible wanderer nearest the frame center
    let best: number | null = null
    let bestDist = Number.POSITIVE_INFINITY
    for (let k = 0; k < WANDERERS.length; k++) {
      const p = wandererScreenPos(k)
      if (!p) continue
      const d = Math.hypot(p.x - innerWidth / 2, p.y - innerHeight / 2)
      if (d < bestDist) {
        bestDist = d
        best = k
      }
    }
    lockedIdx = best
  },
}

const TRANSIT_SECONDS = 2.8

function setPhase(next: Phase): void {
  phase = next
  document.body.dataset['phase'] = next
  if (next === 'stone') {
    stoneEnteredAt = elapsed
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
    setStatus('The sky is the map · the gold lights are the thirty')
    verseShow('Voices awaken across Time')
  }
  if (next === 'crossing') {
    setStatus('')
    lockedIdx = null
    hoverIdx = null
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
  if (e.key === 'Enter' && phase === 'transit') transit = 1
})
let touchY: number | null = null
addEventListener('touchstart', (e) => {
  touchY = e.touches[0]?.clientY ?? null
}, { passive: true })
addEventListener('touchmove', (e) => {
  const y = e.touches[0]?.clientY
  if (y === undefined || touchY === null) return
  push((touchY - y) * 3)
  touchY = y
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

  if (phase === 'door') {
    door += (doorTarget - door) * Math.min(1, dt * 4)
    if (reducedMotion) door = doorTarget
    if (door > 0.985) setPhase('stone')
  }

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
    lanterns:
      phase === 'sky' ? 1
      : phase === 'agora' || phase === 'council' ? 0.55
      : phase === 'crossing' || phase === 'camp' ? 0
      : 0.3,
    sinceFlash: flashAt < 0 ? -1 : elapsed - flashAt,
    elapsed,
  }
  eclipse.update(state)

  // in the born sky, the visitor gazes upward and the dome drifts
  if (phase === 'sky') {
    keeperEl.hidden = true
    camera.rotation.y += dt * 0.008
    camera.rotation.x = 0.62 + Math.sin(elapsed * 0.05) * 0.02
    if (lockedIdx === null && pointerX >= 0) hoverIdx = nearestWanderer(pointerX, pointerY, 64)
  }

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
  syncCard()
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
