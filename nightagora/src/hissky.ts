/* HIS SKY — the Wisdom Map of Marcus Aurelius, as a living concept
   page. The classic map's truth (12 seeds, bloom levels 0..4 earned
   through story / dialogue / prism / quest) becomes his own
   constellation: a LAUREL WREATH of twelve stars over the night, each
   bloom stage a visibly richer form of light, hairlines binding
   neighbours as they waken. The demo timeline shows the whole life of
   the wreath; the real build reads the classic storage keys and the
   dusk falls over his day cosmos (COSMOS-CONTRACT §6). */

import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  PointsNodeMaterial,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import {
  attribute,
  clamp,
  float,
  length,
  pointUV,
  positionView,
  sin,
  smoothstep,
  time,
  uniform,
  vec2,
} from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from './core/seed'

const GOLD = new Color('#e0b96a')
const EMBER = new Color('#8a6a3a')
const STARLIGHT = new Color('#f3efe2')
const ABYSS = new Color('#060b1c')
const LAPIS = new Color('#0c1430')
const HORIZON = new Color('#182350')
const STAR_COOL = new Color('#b4c8ff')
const STAR_ICE = new Color('#d2ebff')
const STAR_PALE = new Color('#b4d2ff')
const STAR_WARM = new Color('#e6bc5c')

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

// ---- the concept firmament (same law as the night) ----
{
  const COUNT = 2600
  const geo = new BufferGeometry()
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  const size = new Float32Array(COUNT)
  const tw = new Float32Array(COUNT * 2)
  const TINTS = [STAR_COOL, STAR_ICE, STAR_PALE, STAR_WARM]
  for (let i = 0; i < COUNT; i++) {
    const r = i % 6 === 0 ? 24 + rand() * 40 : 60 + rand() * 120
    const th = rand() * Math.PI * 2
    const y = -0.2 + rand() * 1.2
    const ph = Math.acos(Math.max(-1, Math.min(1, y)))
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r
    pos[i * 3 + 1] = Math.cos(ph) * r
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r
    const tint = TINTS[rand() < 0.085 ? 3 : Math.floor(rand() * 3)] ?? STAR_COOL
    const dim = 0.5 + rand() * 0.4
    col[i * 3] = tint.r * dim
    col[i * 3 + 1] = tint.g * dim
    col[i * 3 + 2] = tint.b * dim
    size[i] = 0.7 + rand() * 1.3
    tw[i * 2] = 0.4 + rand() * 1.2
    tw[i * 2 + 1] = rand() * Math.PI * 2
  }
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new Float32BufferAttribute(col, 3))
  geo.setAttribute('aSize', new Float32BufferAttribute(size, 1))
  geo.setAttribute('aTw', new Float32BufferAttribute(tw, 2))
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mat.sizeAttenuation = false
  const uPx = uniform(Math.min(devicePixelRatio, 2))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aSizeN = attribute('aSize', 'float') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twN = attribute('aTw', 'vec2') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pUV = pointUV as any
  mat.sizeNode = clamp(aSizeN.mul(float(900)).div(positionView.z.negate().max(1)), 0.6, 26).mul(uPx)
  const twinkle = sin(time.mul(twN.x).add(twN.y)).mul(0.28).add(0.72)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mat.colorNode = attribute('aColor', 'vec3') as any
  mat.opacityNode = smoothstep(0.5, 0.08, length(pUV.sub(vec2(0.5, 0.5))))
    .mul(twinkle)
    .mul(0.55)
  const pts = new Points(geo, mat)
  pts.frustumCulled = false
  scene.add(pts)
}

// ---- textures for the bloom language ----
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
function rays(count: number, lenFrac: number): CanvasTexture {
  const s = 256
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d unavailable')
  ctx.translate(s / 2, s / 2)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * s * lenFrac, Math.sin(a) * s * lenFrac)
    grad.addColorStop(0, 'rgba(246, 223, 174, 0.8)')
    grad.addColorStop(1, 'rgba(224, 185, 106, 0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * s * lenFrac, Math.sin(a) * s * lenFrac)
    ctx.stroke()
  }
  return new CanvasTexture(canvas)
}
const coreMap = radial([
  [0, 'rgba(255, 252, 240, 1)'],
  [0.2, 'rgba(255, 250, 232, 0.95)'],
  [0.4, 'rgba(246, 223, 174, 0.3)'],
  [1, 'rgba(0, 0, 0, 0)'],
])
const haloMap = radial([
  [0, 'rgba(246, 223, 174, 0.55)'],
  [0.4, 'rgba(224, 185, 106, 0.16)'],
  [1, 'rgba(0, 0, 0, 0)'],
])
const raysMap = rays(8, 0.48)
const ringMap = (() => {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d unavailable')
  ctx.strokeStyle = 'rgba(224, 185, 106, 0.9)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s * 0.34, 0, Math.PI * 2)
  ctx.stroke()
  return new CanvasTexture(canvas)
})()

// ---- THE WREATH: twelve seats in an open laurel crown ----
const wreath = new Group()
wreath.position.set(0, 8.5, -34)
scene.add(wreath)

interface SeedStar {
  group: Group
  core: Sprite
  coreMat: SpriteMaterial
  halo: Sprite
  haloMat: SpriteMaterial
  ring: Sprite
  ringMat: SpriteMaterial
  ray: Sprite
  rayMat: SpriteMaterial
  /** displayed bloom 0..4, eased */
  shown: number
  /** target bloom */
  level: number
  title: string
  base: Vector3
  phase: number
}

const seeds: SeedStar[] = []
// two laurel branches, TIED at the bottom and OPEN at the crown's top —
// the wreath of the emperor who refused the laurels' vanity
const SEAT: Array<[number, number]> = []
for (let side = 0; side < 2; side++) {
  for (let i = 0; i < 6; i++) {
    const u = i / 5
    // left branch climbs 265° -> 105°, right branch 275° -> 75°: a near
    // circle with a 30° opening at the top and a close tie at the base
    const phi = ((side === 0 ? 265 - u * 160 : 275 + u * 160) * Math.PI) / 180
    const r = 7.4
    SEAT.push([Math.cos(phi) * r, Math.sin(phi) * r - 1.2])
  }
}

function makeSeed(i: number, title: string): SeedStar {
  const group = new Group()
  const seat = SEAT[i] ?? [0, 0]
  const base = new Vector3(seat[0], seat[1], 0)
  group.position.copy(base)
  wreath.add(group)
  const coreMat = new SpriteMaterial({
    map: coreMap,
    color: EMBER,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const core = new Sprite(coreMat)
  core.scale.setScalar(0.5)
  group.add(core)
  const haloMat = new SpriteMaterial({
    map: haloMap,
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const halo = new Sprite(haloMat)
  halo.scale.setScalar(2.6)
  group.add(halo)
  const ringMat = new SpriteMaterial({
    map: ringMap,
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const ring = new Sprite(ringMat)
  ring.scale.setScalar(1.5)
  group.add(ring)
  const rayMat = new SpriteMaterial({
    map: raysMap,
    color: STARLIGHT,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const ray = new Sprite(rayMat)
  ray.scale.setScalar(2.4)
  group.add(ray)
  return {
    group,
    core,
    coreMat,
    halo,
    haloMat,
    ring,
    ringMat,
    ray,
    rayMat,
    shown: 0,
    level: 0,
    title,
    base,
    phase: rand() * Math.PI * 2,
  }
}

// ---- the binding: hairlines between neighbours, drawn by growth ----
interface Bind {
  line: Line
  mat: LineBasicMaterial
  a: number
  b: number
}
const binds: Bind[] = []
function bind(a: number, b: number): void {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3))
  const mat = new LineBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const line = new Line(geo, mat)
  line.frustumCulled = false
  wreath.add(line)
  binds.push({ line, mat, a, b })
}

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

  // seed titles: the real twelve from R2, graceful fallback offline
  let titles = Array.from({ length: 12 }, (_, i) => `Seed ${i + 1}`)
  try {
    const res = await fetch('https://media.agoracosmica.org/seeds/en/aurelius-seeds.json')
    const data = (await res.json()) as { seeds?: Array<{ title?: string }> }
    if (data.seeds)
      titles = data.seeds.slice(0, 12).map((s, i) => s.title ?? `Seed ${i + 1}`)
  } catch {
    /* the wreath still grows */
  }
  for (let i = 0; i < 12; i++) seeds.push(makeSeed(i, titles[i] ?? `Seed ${i + 1}`))
  for (let i = 0; i < 5; i++) bind(i, i + 1)
  for (let i = 6; i < 11; i++) bind(i, i + 1)
  bind(0, 6) // the tie at the base, where the two branches are bound

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
  function frame(now: number): void {
    requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const elapsed = now / 1000

    if (autoPlay) demoT = (demoT + dt / 26) % 1.12
    else if (held !== null) demoT += (held - demoT) * Math.min(1, dt * 2.2)
    const t = Math.min(1, demoT)

    const lv = levelsAt(t)
    let bloomed = 0
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      if (!s) continue
      s.level = lv[i] ?? 0
      s.shown += (s.level - s.shown) * Math.min(1, dt * 2.4)
      const L = s.shown
      if (s.level >= 3.9) bloomed++
      const breathe = 1 + 0.05 * Math.sin(elapsed * (0.8 + s.phase * 0.1) + s.phase) * Math.min(1, L)
      // the language of the five stages, continuous:
      const coreScale = (0.42 + 0.16 * L) * breathe
      s.core.scale.setScalar(coreScale)
      s.coreMat.color.copy(EMBER).lerp(STARLIGHT, Math.min(1, L / 2.2))
      s.coreMat.opacity = 0.32 + 0.17 * L
      s.haloMat.opacity = Math.max(0, (L - 1.6) / 2.4) * 0.8
      s.halo.scale.setScalar((2.1 + 0.5 * L) * breathe)
      s.ringMat.opacity = Math.max(0, Math.min(1, L - 0.7)) * 0.75
      s.ring.scale.setScalar(1.3 + 0.14 * L)
      s.rayMat.opacity = Math.max(0, (L - 2.7) / 1.3) * 0.85
      s.ray.scale.setScalar(2.0 + 0.5 * (L - 2.5))
      s.ray.material.rotation = elapsed * 0.05 + s.phase
      // a waking star drifts a breath upward as it comes alive
      s.group.position.y = s.base.y + Math.min(1, L / 4) * 0.22
    }
    for (const b of binds) {
      const la = seeds[b.a]?.shown ?? 0
      const lb = seeds[b.b]?.shown ?? 0
      const on = Math.max(0, Math.min(la, lb) - 1.2) / 2.8
      b.mat.opacity = on * 0.5
      const pa = seeds[b.a]?.group.position
      const pb = seeds[b.b]?.group.position
      if (pa && pb) {
        const arr = b.line.geometry.getAttribute('position')
        arr.setXYZ(0, pa.x, pa.y, pa.z)
        arr.setXYZ(1, pb.x, pb.y, pb.z)
        arr.needsUpdate = true
      }
    }

    // the wreath breathes as one, and narrow stages hold all of it
    wreath.rotation.z = Math.sin(elapsed * 0.05) * 0.012
    wreath.scale.setScalar(camera.aspect < 0.9 ? 0.56 : 1)

    // letterpress: night count + the most recently waking seed's name
    if (nightLine)
      nightLine.textContent = `Night ${Math.max(1, Math.ceil(t * 12))} · ${bloomed} of 12 in bloom`
    let waking: SeedStar | null = null
    for (const s of seeds) if (s.shown > 0.4 && s.shown < 3.6) waking = s
    if (seedLabel) {
      if (waking) {
        proj.copy(waking.group.position)
        wreath.localToWorld(proj)
        proj.project(camera)
        seedLabel.textContent = waking.title
        seedLabel.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`
        seedLabel.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight + 26}px`
        seedLabel.classList.add('lit')
      } else {
        seedLabel.classList.remove('lit')
      }
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
