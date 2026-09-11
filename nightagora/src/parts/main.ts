/* THE PARTS BENCH — where one part of the kit is judged.

   Dev and preview only, off the wheel, no journey walks it. It is the swatch
   route's and the model bench's third sibling, and it exists for the one
   thing a code review cannot do: a window that reads as a rectangle FAILS,
   and no amount of correct arithmetic in `openings.ts` will say so. Only a
   frame will.

   So every part stands alone on a grid of one-metre squares, under the same
   key the library was read under, beside a scale bar sized to itself, with
   its own numbers on the card: what it is, how big it measured, what it cost
   in triangles and draws, and which library sets it put on its surfaces.

   One part at a time, by `?part=`. The specimens are real dimensions out of
   the Clos Luce's own schedule wherever the schedule has one. */

import {
  Box3,
  Color,
  type DirectionalLight,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  CylinderGeometry,
  Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { createStack, type Stack } from '../stack'
import { GRADES, type Grade } from '../stack/grade'
import { isTierName, type TierName } from '../stack/tier'
import type { SkyProbe } from '../stack/hdri'
import { createParts, type Part, type PartsKit } from '../stack/parts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { abs, cameraPosition, float, fract, length, max, min, positionWorld, smoothstep, vec3 } =
  TSL as unknown as Record<string, N>

/* ONE KEY FOR THE WHOLE KIT, and it is the swatch route's and the model
   bench's own: thirty frames are one comparison or they are thirty pictures. */
const KEY = { azimuth: 155, elevation: 30 }
const PROBE = 'sky-overcast'

const PLAIN: Grade = {
  ...GRADES['first-station'],
  name: 'parts-bench',
  exposure: 0.72,
  split: 0,
  vignette: 0.08,
  grain: 0.006,
  bloom: { strength: 0.16, radius: 0.4, threshold: 0.92, warmth: 0 },
}

const canvas = document.getElementById('stage') as HTMLCanvasElement
const nameEl = document.getElementById('name') as HTMLElement
const saysEl = document.getElementById('says') as HTMLElement
const numbersEl = document.getElementById('numbers') as HTMLElement
const setsEl = document.getElementById('sets') as HTMLElement
const indexEl = document.getElementById('index') as HTMLElement

const asked = new URLSearchParams(location.search)
const tierAsked = asked.get('tier')

const scene = new Scene()
const camera = new PerspectiveCamera(38, innerWidth / innerHeight, 0.02, 400)
const stack: Stack = await createStack({ canvas })
stack.setScene(scene, camera, PLAIN)
const kit: PartsKit = createParts(stack)

/* THE GRID, in world metres, three weights, each fading before it can alias.
   The same instrument the model bench proved: a painted grid would be a
   different size at every camera distance and would say nothing. */
const grid = new Mesh(
  new PlaneGeometry(400, 400),
  new MeshStandardNodeMaterial({ roughness: 0.96, metalness: 0 })
)
grid.rotation.x = -Math.PI / 2
grid.position.y = -0.0006
grid.receiveShadow = true
{
  const p = positionWorld
  const eye = length(p.sub(cameraPosition))
  const near = (spacing: number, width: N): N => {
    const gx = abs(fract(p.x.div(spacing).add(0.5)).sub(0.5)).mul(spacing)
    const gz = abs(fract(p.z.div(spacing).add(0.5)).sub(0.5)).mul(spacing)
    return float(1).sub(smoothstep(width.mul(0.4), width, min(gx, gz)))
  }
  const w = eye.mul(0.0016)
  const fine = near(0.1, w).mul(float(1).sub(smoothstep(0.6, 2.2, eye))).mul(0.45)
  const metre = near(1, w).mul(float(1).sub(smoothstep(9, 26, eye))).mul(0.8)
  const five = near(5, w.mul(1.6)).mul(float(1).sub(smoothstep(30, 90, eye)))
  const line = max(max(fine, metre), five).mul(float(1).sub(smoothstep(40, 110, eye)))
  const mat = grid.material as MeshStandardNodeMaterial
  mat.colorNode = vec3(0.055, 0.06, 0.075).add(vec3(0.62, 0.64, 0.7).mul(line))
}
scene.add(grid)

/* THE RULER. The grid answers for the plan and says nothing about height,
   and height is where a part's scale error hides. The bar is the largest
   round length that still fits inside the body, banded at a tenth of itself. */
const RULERS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
const ruler = new Object3D()
scene.add(ruler)
let rulerLength = 1

function setRuler(height: number, x: number): void {
  rulerLength = [...RULERS].reverse().find((r) => r <= height) ?? RULERS[0] ?? 0.05
  ruler.clear()
  const band = rulerLength / 10
  for (let i = 0; i < 10; i++) {
    const piece = new Mesh(
      new CylinderGeometry(rulerLength * 0.017, rulerLength * 0.017, band, 14),
      new MeshStandardNodeMaterial({
        color: new Color(i % 2 ? '#191b22' : '#e8e6df'),
        roughness: 0.75,
        metalness: 0,
      })
    )
    piece.position.y = band / 2 + i * band
    piece.castShadow = true
    ruler.add(piece)
  }
  ruler.position.set(x, 0, 0)
}

const skies = new Map<string, SkyProbe>()
async function probe(name: string): Promise<SkyProbe | null> {
  const held = skies.get(name)
  if (held) return held
  try {
    const sky = await stack.hdri(name)
    skies.set(name, sky)
    return sky
  } catch {
    return null
  }
}

/* THE SHADOW HAS TO SEE THE PART. The stack's key is built for a room: its
   cascades run from half a metre to sixty with a three-centimetre normal
   bias, which is right for a colonnade and larger than a gear tooth. So on
   this bench, and only here, the cascades are re-fitted to the body in front
   of them. Nothing in the museum's own scenes is touched. */
function tighten(span: number): void {
  scene.traverse((o: Object3D) => {
    const l = o as unknown as DirectionalLight
    if (!l.isDirectionalLight || !l.castShadow) return
    const d = l.position.length()
    l.shadow.camera.near = Math.max(0.02, d - span * 6)
    l.shadow.camera.far = d + span * 6
    l.shadow.bias = 0
    l.shadow.normalBias = Math.max(0.0004, span * 0.004)
    l.shadow.camera.updateProjectionMatrix()
    l.shadow.needsUpdate = true
  })
}

/* ── the specimens ─────────────────────────────────────────────────────── */

/** every specimen is a real dimension. Where the Clos Luce's own aperture
    schedule has a number, that number is the one used: 1.55 by 2.35 on the
    west range's ground floor, 1.15 by 1.75 in the attic, 1.20 by 2.50 at the
    entrance door, 0.85 by 1.80 for the chapel's single light. */
const SPECIMENS: Record<string, () => Part> = {
  'window-cross': () =>
    kit.window({
      width: 1.55,
      height: 2.35,
      mullion: 0.14,
      transom: 1.2,
      glazing: 'leaded',
      seed: 5,
    }),
  'window-ogee': () =>
    kit.window({ width: 0.85, height: 1.8, head: 'ogee', glazing: 'leaded', seed: 11 }),
  'window-pointed': () =>
    kit.window({ width: 1.6, height: 2.2, head: 'pointed', mullion: 0.12, glazing: 'leaded', seed: 12 }),
  'window-segmental': () =>
    kit.window({ width: 1.2, height: 2.05, head: 'segmental', glazing: 'panes', seed: 13 }),
  'window-attic': () => kit.window({ width: 1.15, height: 1.75, glazing: 'leaded', seed: 14 }),
  'window-shutters-open': () =>
    kit.window({
      width: 1.55,
      height: 2.35,
      mullion: 0.14,
      transom: 1.2,
      shutters: 'open',
      seed: 15,
    }),
  'window-shutters-closed': () =>
    kit.window({ width: 1.55, height: 2.35, shutters: 'closed', seed: 16 }),
  door: () => kit.door({ width: 1.2, height: 2.5, head: 'segmental', open: 26, seed: 17 }),
  'door-shut': () => kit.door({ width: 1.2, height: 2.5, head: 'flat', open: 0, seed: 18 }),
  wall: () =>
    kit.wall({
      length: 11,
      height: 7.6,
      thickness: 0.62,
      set: 'brick-old-red',
      plinth: 0.55,
      openings: [
        {
          x: -3.8,
          base: 1.55,
          width: 1.55,
          height: 2.35,
          window: { mullion: 0.14, transom: 1.2, shutters: 'open' },
        },
        { x: -1.2, base: 1.55, width: 1.55, height: 2.35, fill: 'window' },
        { x: 1.4, base: 0.0, width: 1.2, height: 2.5, fill: 'door', head: 'segmental' },
        { x: 4.0, base: 1.55, width: 1.55, height: 2.35, fill: 'window' },
        { x: -3.8, base: 5.05, width: 1.55, height: 2.3, fill: 'window' },
        { x: 1.4, base: 5.05, width: 1.55, height: 2.3, fill: 'window' },
      ],
      seed: 19,
    }),
  'wall-bay': () =>
    kit.wall({
      length: 3.9,
      height: 4.4,
      thickness: 0.62,
      set: 'brick-old-red',
      plinth: 0.5,
      openings: [
        {
          x: 0,
          base: 1.55,
          width: 1.55,
          height: 2.35,
          window: { mullion: 0.14, transom: 1.2 },
        },
      ],
      seed: 20,
    }),
  'roof-gable': () =>
    kit.roof({ width: 9.4, depth: 7.2, pitch: 49, gable: 'crow', seed: 21 }),
  'roof-hip': () => kit.roof({ width: 7.4, depth: 6.2, pitch: 55, kind: 'hip', seed: 22 }),
  dormer: () => kit.dormer({ width: 1.15, height: 1.4, roofPitch: 49, seed: 23 }),
  chimney: () => kit.chimney({ height: 3.4, flues: 2, seed: 24 }),
  steps: () => kit.steps({ width: 2.2, count: 5, cheeks: true, seed: 25 }),
  'fence-wattle': () => kit.fence({ length: 6.4, kind: 'wattle', seed: 26 }),
  'fence-paling': () => kit.fence({ length: 6.4, kind: 'paling', seed: 27 }),
  gate: () => kit.gate({ width: 3.2, kind: 'field', open: 34, seed: 28 }),
  'gate-boarded': () => kit.gate({ width: 2.4, kind: 'boarded', open: 0, seed: 29 }),
  wheel: () => kit.wheel({ diameter: 1.32, spokes: 12, seed: 31 }),
  'gear-spur': () => kit.gear({ module: 0.06, teeth: 26, thickness: 0.09, arms: 6, seed: 32 }),
  'gear-lantern': () => kit.gear({ kind: 'lantern', module: 0.06, teeth: 9, thickness: 0.22, seed: 33 }),
  'gear-worm': () => kit.gear({ kind: 'worm', module: 0.05, teeth: 1, thickness: 0.1, length: 0.55, seed: 34 }),
  rope: () => kit.hang([-1, 1.5, 0], [1, 1.15, 0], 1.1, { radius: 0.028, seed: 35 }),
  'rope-fall': () => kit.hang([-2.6, 3.2, 0], [2.6, 2.1, 0], 1.06, { radius: 0.032, seed: 37 }),
  beam: () => kit.beam({ length: 4.2, width: 0.24, depth: 0.2, tenon: 0.12, seed: 36 }),
  'tree-oak': () => kit.tree({ species: 'oak', height: 16, season: 'october', seed: 41 }),
  'tree-oak-bare': () => kit.tree({ species: 'oak', height: 16, season: 'bare', seed: 41 }),
  'tree-lime': () => kit.tree({ species: 'lime', height: 14, season: 'october', seed: 42 }),
  'tree-plane': () => kit.tree({ species: 'plane', height: 15, season: 'summer', seed: 43 }),
  'tree-yew': () => kit.tree({ species: 'yew', height: 6, season: 'october', seed: 44 }),
  'tree-cypress': () => kit.tree({ species: 'cypress', height: 9, season: 'october', seed: 45 }),
  shrub: () => kit.shrub({ height: 1.5, season: 'october', seed: 46 }),
  grass: () => kit.grass({ width: 4, depth: 4, kind: 'meadow', seed: 47 }),
  'grass-lawn': () => kit.grass({ width: 3, depth: 3, kind: 'lawn', density: 520, seed: 48 }),
}

const names = Object.keys(SPECIMENS)
let standing: Object3D | null = null
let current = asked.get('part') ?? ''

function chips(): void {
  indexEl.replaceChildren()
  for (const name of names) {
    const a = document.createElement('a')
    a.href = `?part=${name}${tierAsked ? `&tier=${tierAsked}` : ''}`
    a.textContent = name
    if (name === current) a.setAttribute('aria-current', 'true')
    indexEl.append(a)
  }
}

/** where the eye stands: framed off the body's own bounds so a gear tooth
    and an eleven-metre wall are both readable, from one fixed direction so
    every frame of the kit is the same comparison */
function frame(size: Vector3, centre: Vector3): void {
  const radius = Math.max(0.06, size.length() / 2, rulerLength * 0.78)
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.3
  const dir = new Vector3(0.62, 0.36, 1).normalize()
  camera.position.copy(centre).addScaledVector(dir, distance)
  camera.lookAt(centre)
  camera.near = Math.max(0.01, distance / 260)
  camera.far = distance * 14 + 60
  camera.updateProjectionMatrix()
}

async function show(name: string): Promise<void> {
  current = names.includes(name) ? name : (names[0] as string)
  chips()
  if (standing) {
    scene.remove(standing)
    standing = null
  }

  const make = SPECIMENS[current]
  if (!make) return
  /* A BENCH THAT DIES ON ONE PART CANNOT JUDGE THE OTHER THIRTY-FIVE. A
     builder that throws puts its message on the card and leaves the page
     alive, so the rig gets a frame that says what went wrong rather than a
     dead route it waits thirty seconds for. */
  let part: Part
  try {
    part = make()
  } catch (err) {
    nameEl.textContent = current
    saysEl.textContent = `this part did not build: ${(err as Error).message}`
    numbersEl.textContent = ''
    setsEl.textContent = ''
    return
  }
  standing = part
  scene.add(part)

  const box = new Box3().setFromObject(part)
  /* A PART STANDS ON THE GRID. Several of them are built about their own
     working origin rather than their foot: a wheel turns on its nave and a
     gear hangs on its shaft, so both would sink half their diameter into the
     ground and the one thing this bench exists to catch, whether a body has
     a contact shadow under it, could not be read. Anything already clear of
     the ground (a hung rope) is left where it is. */
  if (box.min.y < -0.001) {
    part.position.y = -box.min.y
    part.updateMatrixWorld(true)
    box.setFromObject(part)
  }
  const centre = new Vector3()
  const size = new Vector3()
  box.getCenter(centre)
  box.getSize(size)
  const span = Math.max(size.x, size.y, size.z, 0.05)

  /* the shadow is sized to the body: one cascade over sixty metres puts a
     gear tooth inside a single shadow texel, and a part with no contact
     shadow reads as floating, which is the exact defect this bench catches */
  const sky = await probe(PROBE)
  const reach = Math.min(120, Math.max(3, span * 4.5))
  if (sky) {
    stack.light({
      ...KEY,
      kelvin: sky.sun.kelvin,
      lux: 380,
      probe: sky.texture,
      ambient: 1,
      reach,
      cascades: [Math.max(0.5, span * 1.4), reach],
    })
    scene.background = sky.texture
    const turn = ((sky.sun.azimuth - KEY.azimuth) * Math.PI) / 180
    scene.environmentRotation.set(0, turn, 0)
    scene.backgroundRotation.set(0, turn, 0)
    scene.backgroundBlurriness = 0.55
    scene.backgroundIntensity = 0.14
    scene.environmentIntensity = 0.45
  } else {
    stack.light({ ...KEY, kelvin: 5200, lux: 420, ambient: 1, reach })
  }
  tighten(span)

  setRuler(Math.max(size.y, 0.1), box.min.x - Math.max(0.12, size.x * 0.16))
  frame(size, centre)

  const record = part.userData.part
  nameEl.textContent = current
  const fit = document.createElement('span')
  fit.className = 'fit'
  fit.textContent = `${record.name} · tier ${stack.tierName()}`
  nameEl.append(fit)
  saysEl.textContent = record.says
  const cost = stack.cost()
  const metre = rulerLength >= 1 ? `${rulerLength} m` : `${Math.round(rulerLength * 100)} cm`
  const band = rulerLength >= 1 ? `${rulerLength * 10} cm` : `${Math.round(rulerLength * 100) / 10} cm`
  numbersEl.textContent =
    `${round(size.x)} by ${round(size.y)} by ${round(size.z)} m, measured off what was built · ` +
    `${record.tris.toLocaleString('en')} triangles in ${record.draws} draw call(s) · ` +
    `the frame holds ${cost.draws} draws and ${cost.triangles.toLocaleString('en')} triangles · ` +
    `the ruler is ${metre}, banded at ${band}, the grid one metre`
  /* WHAT EACH SURFACE IS STANDING ON, printed. A part that reads grey is
     either a set whose bytes never landed or a base colour still holding the
     placeholder, and the frame has to say which without a second window. The
     line is rewritten every frame while anything is still in flight: a card
     that says WAITING under a dressed roof is as misleading as one that says
     nothing under a grey one. */
  standingOn = record
  writeHolding()
  document.title = `${current} · parts kit`
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}

let standingOn: Part['userData']['part'] | null = null

function writeHolding(): void {
  if (!standingOn) return
  const held = kit.bench
    .report()
    .map((b) => `${b.set} ${b.ready ? '' : 'WAITING '}${b.base.map((v) => v.toFixed(2)).join('/')}`)
  setsEl.textContent =
    `library sets: ${standingOn.sets.join(', ') || 'none'}` +
    (standingOn.generated.length ? ` · generated here: ${standingOn.generated.join('; ')}` : '') +
    ` · ${PROBE}, sun turned to ${KEY.azimuth} degrees · holding ${held.join(' | ')}`
}

if (!current) current = names[0] as string
try {
  await show(current)
} catch (err) {
  saysEl.textContent = `this part did not build: ${(err as Error).message}`
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  stack.setSize(innerWidth, innerHeight)
})

let last = performance.now()
function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (kit.bench.report().some((b) => !b.ready)) writeHolding()
  stack.render(dt)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

/* the rig's own door, the same shape the museum's forge hook takes, so one
   eye shoots the night, the swatches, the models and the kit without four
   dialects */
declare global {
  interface Window {
    __forgeParts?: {
      jump: (state: string, opts?: { part?: string }) => void
      freeze: (t: number) => void
      tier: (name: TierName) => void
      look: (yaw: number, pitch: number) => void
      cost: () => ReturnType<Stack['cost']>
      state: () => { texturesPending: number; part: string; tris: number; draws: number }
      parts: () => string[]
    }
  }
}
window.__forgeParts = {
  jump(_state, opts = {}) {
    document.body.classList.add('forge')
    document.body.dataset['forge'] = 'pending'
    void show(opts.part ?? current)
      .catch((err: Error) => {
        saysEl.textContent = `this part did not build: ${err.message}`
      })
      .then(() => {
        document.body.dataset['forge'] = 'part'
      })
  },
  freeze() {
    /* nothing on this route moves, so there is no clock to hold */
  },
  tier(name) {
    if (isTierName(name)) stack.tier(name)
  },
  look() {
    /* one fixed viewpoint: a part compared from two angles is two parts */
  },
  cost: () => stack.cost(),
  state: () => ({
    /* the rig waits on this before every shot: a texture still in flight is
       a grey part, and a grey part cannot be judged */
    texturesPending: stack.materials.pending() + stack.models.pending(),
    part: current,
    tris: standing?.userData?.['part']?.tris ?? 0,
    draws: standing?.userData?.['part']?.draws ?? 0,
  }),
  parts: () => names,
}
