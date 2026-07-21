/* HIS SKY — the Wisdom Map of Marcus Aurelius, as a living concept
   page. The classic map's truth (12 seeds, bloom levels 0..4 earned
   through story / dialogue / prism / quest) becomes his own
   constellation: a LAUREL WREATH of twelve stars over the night, each
   bloom stage a visibly richer form of light, hairlines binding
   neighbours as they waken. The demo timeline shows the whole life of
   the wreath; the real build reads the classic storage keys and the
   dusk falls over his day cosmos (COSMOS-CONTRACT §6). The sign itself
   is the shared organ in core/sign.ts (the camp raises the same one). */

import {
  AdditiveBlending,
  BackSide,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGPURenderer,
  CanvasTexture,
} from 'three/webgpu'
import { mulberry32, FOUNDING_SEED } from './core/seed'
import { createSign } from './core/sign'
import { createFirmament } from './core/firmament'
import { STOIC_TAURUS } from './content/signs'

const ABYSS = new Color('#060b1c')
const LAPIS = new Color('#0c1430')
const HORIZON = new Color('#182350')

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stage = document.getElementById('stage')
if (!stage) throw new Error('missing stage')

const scene = new Scene()
const camera = new PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 400)
camera.position.set(0, 0, 0)

const wantWebGPU = location.search.includes('webgpu') && 'gpu' in navigator
const renderer = new WebGPURenderer({ antialias: true, forceWebGL: !wantWebGPU })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
stage.appendChild(renderer.domElement)

const rand = mulberry32(FOUNDING_SEED + 144)

// ---- the night dome ----
{
  const domeGeo = new SphereGeometry(90, 32, 24)
  const dpos = domeGeo.getAttribute('position')
  const colors: number[] = []
  const c = new Color()
  for (let i = 0; i < dpos.count; i++) {
    const y = (dpos.getY(i) / 90 + 1) / 2
    if (y < 0.46) c.copy(ABYSS)
    else if (y < 0.52) c.copy(ABYSS).lerp(HORIZON, (y - 0.46) / 0.06)
    else if (y < 0.58) c.copy(HORIZON).lerp(LAPIS, (y - 0.52) / 0.06)
    else c.copy(LAPIS).lerp(ABYSS, Math.min(1, (y - 0.58) / 0.34))
    colors.push(c.r, c.g, c.b)
  }
  domeGeo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  const dome = new Mesh(
    domeGeo,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false })
  )
  dome.renderOrder = -2
  scene.add(dome)
}

// ---- the standard firmament (core/firmament.ts, same law as the
// night); its inline ancestor held the field at 0.55 so the wreath
// owns the frame — the organ receives that as its master ----
const firmament = createFirmament({
  count: 2600,
  far: [60, 180],
  near: [24, 64],
  bias: 'zenith',
  rand,
})
scene.add(firmament.points)

// ---- THE SIGN in its sky ----
const wreath = new Group()
wreath.position.set(0, 8.5, -34)
scene.add(wreath)

// the mist the classic sky breathes: three vast quiet clouds behind
{
  function radial(stops: Array<[number, string]>): CanvasTexture {
    const s = 128
    const canvas = document.createElement('canvas')
    canvas.width = s
    canvas.height = s
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d unavailable')
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    for (const [at, cc] of stops) g.addColorStop(at, cc)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    return new CanvasTexture(canvas)
  }
  const mistMap = radial([
    [0, 'rgba(90, 116, 178, 0.16)'],
    [0.5, 'rgba(60, 82, 140, 0.07)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  const seats: Array<[number, number, number, number]> = [
    [-7, 2.5, -9, 30],
    [8, -3, -11, 26],
    [-1, -7.5, -8, 22],
  ]
  for (const [mx, my, mz, ms] of seats) {
    const m = new Sprite(
      new SpriteMaterial({
        map: mistMap,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      })
    )
    m.position.set(mx, my, mz)
    m.scale.setScalar(ms)
    wreath.add(m)
  }
}

// the shared organ, raised in the concept's generous frame
const sign = createSign({ pattern: STOIC_TAURUS, width: 26, height: 19, rand })
wreath.add(sign.group)

// ---- the demo timeline: an authored life of the wreath ----
// order in which the nights waken (a believable learning path)
const WAKE_ORDER = [2, 1, 3, 0, 4, 8, 7, 9, 5, 10, 6, 11]
let demoT = 0 // 0..1 across the whole life
let autoPlay = !reducedMotion
let held: number | null = null

function levelsAt(t: number): number[] {
  // each seed rises 0->4 along its own staggered window
  const lv: number[] = new Array(12).fill(0)
  for (let k = 0; k < WAKE_ORDER.length; k++) {
    const idx = WAKE_ORDER[k] ?? 0
    const start = k * 0.06
    const span = 0.3
    const p = Math.min(1, Math.max(0, (t - start) / span))
    lv[idx] = p * 4
  }
  return lv
}

const seedLabel = document.getElementById('seed-label')
const nightLine = document.getElementById('night-line')

async function boot(): Promise<void> {
  try {
    await renderer.init()
  } catch {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<p style="position:fixed;inset:40% 0;text-align:center;font:12px sans-serif;color:#8d93ad">This concept needs a newer browser.</p>'
    )
    return
  }

  // the real twelve from R2 (title + summary + quote feed the panel)
  interface SeedData {
    title?: string
    summary?: string
    quote?: string
  }
  let seedData: SeedData[] = Array.from({ length: 12 }, (_, i) => ({ title: `Seed ${i + 1}` }))
  try {
    const res = await fetch('https://media.agoracosmica.org/seeds/en/aurelius-seeds.json')
    const data = (await res.json()) as { seeds?: SeedData[] }
    if (data.seeds) seedData = data.seeds.slice(0, 12)
  } catch {
    /* the sign still grows */
  }
  const titles = seedData.map((d, i) => d.title ?? `Seed ${i + 1}`)

  // ---- selectable seeds: every star opens its own letterpress ----
  const seedButtons = document.getElementById('seed-buttons')
  const seedPanel = document.getElementById('seed-panel')
  const btns: HTMLButtonElement[] = []
  function openSeed(i: number): void {
    if (!seedPanel) return
    const d = seedData[i]
    const k = seedPanel.querySelector('.panel-kicker')
    const t = seedPanel.querySelector('.panel-title')
    const sm = seedPanel.querySelector('.panel-summary')
    const q = seedPanel.querySelector('.panel-quote')
    if (k) k.textContent = `Seed ${i + 1} · The Stoic Taurus`
    if (t) t.textContent = d?.title ?? `Seed ${i + 1}`
    if (sm) sm.textContent = d?.summary ?? ''
    if (q) q.textContent = d?.quote ? `“${d.quote}”` : ''
    seedPanel.hidden = false
  }
  seedPanel?.querySelector('.panel-close')?.addEventListener('click', () => {
    if (seedPanel) seedPanel.hidden = true
  })
  if (seedButtons) {
    for (let i = 0; i < 12; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'seed-btn'
      b.setAttribute('aria-label', titles[i] ?? `Seed ${i + 1}`)
      b.addEventListener('click', () => openSeed(i))
      seedButtons.appendChild(b)
      btns.push(b)
    }
  }

  const stages = Array.from(document.querySelectorAll('#stages button'))
  for (const b of stages) {
    b.addEventListener('click', () => {
      for (const o of stages) o.classList.remove('here')
      b.classList.add('here')
      const v = (b as HTMLElement).dataset['stage']
      if (v === 'auto') {
        autoPlay = true
        held = null
      } else {
        autoPlay = false
        held = v === '0' ? 0.04 : v === '1' ? 0.45 : 1
      }
    })
  }

  // the rig's hand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__hisSky = {
    set(t: number) {
      autoPlay = false
      held = t
    },
  }

  let last = performance.now()
  const proj = new Vector3()
  function project(star: Group): Vector3 {
    star.updateWorldMatrix(true, false)
    return proj.setFromMatrixPosition(star.matrixWorld).project(camera)
  }
  function frame(now: number): void {
    requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const elapsed = now / 1000

    if (autoPlay) demoT = (demoT + dt / 26) % 1.12
    else if (held !== null) demoT += (held - demoT) * Math.min(1, dt * 2.2)
    const t = Math.min(1, demoT)

    const lv = levelsAt(t)
    sign.update(dt, elapsed, lv)
    firmament.update(elapsed, 0.55)
    let bloomed = 0
    for (const v of lv) if (v >= 3.9) bloomed++

    // the wreath breathes as one, and narrow stages hold all of it
    wreath.rotation.z = Math.sin(elapsed * 0.05) * 0.012
    wreath.scale.setScalar(camera.aspect < 0.9 ? 0.5 : 1)

    // letterpress: night count + the most recently waking seed's name
    if (nightLine)
      nightLine.textContent = `Night ${Math.max(1, Math.ceil(t * 12))} · ${bloomed} of 12 in bloom`
    let waking = -1
    for (let i = 0; i < sign.shown.length; i++) {
      const L = sign.shown[i] ?? 0
      if (L > 0.4 && L < 3.6) waking = i
    }
    if (seedLabel) {
      const star = waking >= 0 ? sign.stars[waking] : undefined
      if (star) {
        project(star)
        seedLabel.textContent = titles[waking] ?? ''
        seedLabel.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`
        seedLabel.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight + 26}px`
        seedLabel.classList.add('lit')
      } else {
        seedLabel.classList.remove('lit')
      }
    }

    for (let i = 0; i < btns.length; i++) {
      const b = btns[i]
      const star = sign.stars[i]
      if (!b || !star) continue
      project(star)
      b.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`
      b.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight}px`
    }

    camera.rotation.x = 0.24
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  // the legend, from the same visual language
  const legend = document.getElementById('legend')
  if (legend) {
    const STAGES: Array<[string, string]> = [
      ['Ember', 'rgba(138, 106, 58, 0.7)'],
      ['Kindled', 'rgba(200, 168, 110, 0.85)'],
      ['Risen', 'rgba(224, 185, 106, 1)'],
      ['Radiant', 'rgba(243, 239, 226, 1)'],
      ['Bloomed', 'rgba(255, 252, 240, 1)'],
    ]
    for (const [name, colorCss] of STAGES) {
      const item = document.createElement('div')
      item.className = 'legend-item'
      const dot = document.createElement('span')
      dot.className = 'legend-dot'
      dot.style.background = colorCss
      dot.style.boxShadow = `0 0 8px ${colorCss}`
      const label = document.createElement('span')
      label.className = 'legend-name'
      label.textContent = name
      item.append(dot, label)
      legend.appendChild(item)
    }
  }
}

void boot()
