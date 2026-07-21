import { PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu'
import { createEclipse, type EclipseState } from './scenes/eclipse'

type Phase = 'transit' | 'held' | 'door' | 'sky'

const stage = document.getElementById('stage')
const status = document.getElementById('status')
if (!stage || !status) throw new Error('missing shell')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scene = new Scene()
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200)
camera.position.set(0, 0, 0)

const eclipse = createEclipse(scene)

const renderer = new WebGPURenderer({ antialias: true })
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
  elapsed += dt

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
  const birthTarget = phase === 'transit' ? 0 : phase === 'held' ? 0.55 : 1
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
  }

  renderer.render(scene, camera)
}

async function main(): Promise<void> {
  await renderer.init()
  setStatus('First light')
  requestAnimationFrame((t) => {
    last = t
    frame(t)
  })
}

void main()
