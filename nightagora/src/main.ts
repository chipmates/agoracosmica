import { PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'
import { WANDERERS } from './content/wanderers'

type Phase = 'transit' | 'held' | 'door' | 'sky'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
const card = document.getElementById('atlas-card')
if (!stage || !status || !card) throw new Error('missing shell')
const cardName = card.querySelector('.card-name')
const cardYears = card.querySelector('.card-years')
const cardEpithet = card.querySelector('.card-epithet')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scene = new Scene()
const camera = new PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 0)

const eclipse = createEclipse(scene)

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

// forge hook: lets the screenshot rig drive deterministic states
declare global {
  interface Window {
    __forge?: {
      jump: (p: Phase, opts?: { door?: number; transit?: number; skyBirth?: number; sinceFlash?: number }) => void
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
  const el = card as HTMLElement
  el.style.left = `${Math.min(Math.max(p.x + 22, 16), innerWidth - 300)}px`
  el.style.top = `${Math.min(Math.max(p.y - 24, 16), innerHeight - 140)}px`
  card.hidden = false
}

addEventListener('pointermove', (e) => {
  pointerX = e.clientX
  pointerY = e.clientY
})
addEventListener('click', (e) => {
  if (phase !== 'sky') return
  const hit = nearestWanderer(e.clientX, e.clientY, 64)
  lockedIdx = hit !== null && hit === lockedIdx ? null : hit
})

window.__forge = {
  jump(p, opts = {}) {
    setPhase(p)
    transit = opts.transit ?? (p === 'transit' ? 0.5 : 1)
    door = doorTarget = opts.door ?? (p === 'door' ? 0.5 : p === 'sky' ? 1 : 0)
    skyBirth = opts.skyBirth ?? (p === 'transit' ? 0 : p === 'held' ? 0.75 : 1)
    flashAt = elapsed - (opts.sinceFlash ?? 999)
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
  if (next === 'held') setStatus('Scroll to enter')
  if (next === 'door') setStatus('')
  if (next === 'sky') setStatus('Night Agora · the rest of the universe is still being drawn')
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
}

addEventListener('wheel', (e) => push(e.deltaY), { passive: true })
addEventListener('keydown', (e) => {
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
    if (door > 0.985) setPhase('sky')
  }

  // stars are born at totality and complete through the door
  const birthTarget = phase === 'transit' ? 0 : phase === 'held' ? 0.75 : 1
  skyBirth += (birthTarget - skyBirth) * Math.min(1, dt * (reducedMotion ? 20 : 0.9))

  const state: EclipseState = {
    transit,
    door,
    skyBirth,
    sinceFlash: flashAt < 0 ? -1 : elapsed - flashAt,
    elapsed,
  }
  eclipse.update(state)

  // in the born sky, the camera drifts like a slow exhale
  if (phase === 'sky') {
    camera.rotation.y += dt * 0.008
    camera.rotation.x = Math.sin(elapsed * 0.05) * 0.02
    if (lockedIdx === null && pointerX >= 0) hoverIdx = nearestWanderer(pointerX, pointerY, 64)
  }
  syncCard()

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
