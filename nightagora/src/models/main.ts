/* THE MODEL BENCH — where one model of the library is judged.

   Dev and preview only, off the wheel, no journey walks it. It is the
   swatch route's sibling and it answers the three questions a model can be
   wrong about in ways a code review cannot see:

     SCALE      the body stands on a grid of one-metre squares with a
                one-metre post beside it. A door that is two and a half
                metres tall covers two and a half posts. Nothing on this
                page is scaled to fit; the camera moves and the grid does
                not.
     NORMALS    the key rakes across the body at about sixty degrees, the
                same angle the swatch route proved a normal at, so a face
                lit from the wrong side shows as a joint shadowed on the
                wrong side.
     TEXTURES   what did not arrive draws as flat grey against a source's
                own preview render standing in the same frame.

   One model at a time, by `?model=`. Sixty models held at once is several
   gigabytes of texture at the hero tier, and a page that cannot hold its own
   library cannot say anything true about one of its models. */

import {
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
  Box3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { createStack, type Stack } from '../stack'
import { GRADES, type Grade } from '../stack/grade'
import { isTierName, type TierName } from '../stack/tier'
import { ASSET_BASE } from '../stack/materials'
import type { ModelAsset } from '../stack/models'
import type { SkyProbe } from '../stack/hdri'
import { loadManifest, type ManifestEntry } from '../manifest'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { abs, cameraPosition, float, fract, length, max, min, positionWorld, smoothstep, vec3 } =
  TSL as unknown as Record<string, N>

/* ONE KEY FOR THE WHOLE LIBRARY, and it is the swatch route's own. Sixty
   frames are one comparison or they are sixty pictures. */
const KEY = { azimuth: 155, elevation: 30 }
const PROBE = 'sky-overcast'

/** neutral on purpose, for the same reason the swatch route is: a model is
    compared against the source's own render, so the look has to be the
    plainest the chain can be. */
const PLAIN: Grade = {
  ...GRADES['first-station'],
  name: 'model-bench',
  exposure: 0.72,
  split: 0,
  vignette: 0.08,
  grain: 0.006,
  bloom: { strength: 0.16, radius: 0.4, threshold: 0.92, warmth: 0 },
}

const canvas = document.getElementById('stage') as HTMLCanvasElement
const nameEl = document.getElementById('name') as HTMLElement
const licenceEl = document.getElementById('licence') as HTMLElement
const sourceEl = document.getElementById('source') as HTMLElement
const numbersEl = document.getElementById('numbers') as HTMLElement
const plateEl = document.getElementById('plate') as HTMLElement
const plateImg = document.getElementById('plate-img') as HTMLImageElement
const plateCap = document.getElementById('plate-cap') as HTMLElement
const indexEl = document.getElementById('index') as HTMLElement

const asked = new URLSearchParams(location.search)
const tierAsked = asked.get('tier')

const scene = new Scene()
const camera = new PerspectiveCamera(38, innerWidth / innerHeight, 0.02, 120)
const stack: Stack = await createStack({ canvas })
stack.setScene(scene, camera, PLAIN)

/* THE GRID IS THE INSTRUMENT, and it is drawn in world metres rather than
   painted on, so it is exactly one metre at every camera distance and a body
   can be counted against it. Three weights: a decimetre, a metre, and five
   metres. Each line's width is a fraction of the distance the eye stands at,
   which is what keeps a far line from breaking into moire and a near one
   from vanishing, and the decimetre band fades out before it can alias. */
const grid = new Mesh(new PlaneGeometry(120, 120), new MeshStandardNodeMaterial({
  roughness: 0.96,
  metalness: 0,
}))
grid.rotation.x = -Math.PI / 2
grid.position.y = -0.0005
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
  /* a band is only drawn while it is coarser than the pixel it lands in:
     ten centimetres at twenty metres is one line, not a hundred */
  const fine = near(0.1, w).mul(float(1).sub(smoothstep(0.6, 2.2, eye))).mul(0.45)
  const metre = near(1, w).mul(float(1).sub(smoothstep(9, 24, eye))).mul(0.8)
  const five = near(5, w.mul(1.6)).mul(float(1).sub(smoothstep(26, 60, eye)))
  /* and the whole lattice goes before the horizon does: at a grazing angle
     no line width survives the pixel it lands in, and what a far grid draws
     is not a grid but its own aliasing */
  const line = max(max(fine, metre), five).mul(float(1).sub(smoothstep(18, 42, eye)))
  const mat = grid.material as MeshStandardNodeMaterial
  mat.colorNode = vec3(0.055, 0.06, 0.075).add(vec3(0.62, 0.64, 0.7).mul(line))
}
scene.add(grid)

/* AND A RULER, BECAUSE THE GRID ANSWERS FOR THE PLAN AND SAYS NOTHING ABOUT
   HEIGHT. Height is where a model's scale error hides: a chair at twice its
   size still stands inside its own square. The ruler is upright, banded at a
   tenth of its own length, and its length is a round number chosen for the
   body it stands beside, so a seven-centimetre stone gets a ten-centimetre
   ruler and a three-metre door gets a two-metre one. The card prints which. */
const RULERS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5]
const ruler = new Object3D()
scene.add(ruler)
let rulerLength = 1

function setRuler(height: number, at: number): void {
  /* the largest round length that still fits inside the body's own height,
     the way a scale bar on a map is shorter than the thing it measures */
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
  ruler.position.set(at, 0, 0)
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

/* THE SHADOW HAS TO BE ABLE TO SEE A THING THIS SMALL. The stack's key is
   built for a room: its shadow camera runs from half a metre to sixty and it
   carries a three-centimetre normal bias, which is the right slack for a
   colonnade and is larger than a hand stone. So on this bench, and only
   here, the cascades are re-fitted to the body standing in front of them.
   Nothing in the museum's own scenes is touched: this walks the bench's own
   scene after its own light was built. */
function tighten(span: number): void {
  scene.traverse((o: Object3D) => {
    const l = o as unknown as DirectionalLight
    if (!l.isDirectionalLight || !l.castShadow) return
    const d = l.position.length()
    l.shadow.camera.near = Math.max(0.02, d - span * 6)
    l.shadow.camera.far = d + span * 6
    l.shadow.bias = 0
    l.shadow.normalBias = Math.max(0.0003, span * 0.005)
    l.shadow.camera.updateProjectionMatrix()
    l.shadow.needsUpdate = true
  })
}

/** the body's own longest side, from the manifest, before anything is
    loaded: the light has to be built at the right size the first time */
async function spanOf(slug: string): Promise<number> {
  const entry = (await loadManifest()).byId.get(`models/${slug}`)
  const b = entry?.bounds_m
  return b ? Math.max(b[0], b[1], b[2]) : 1
}

let standing: Object3D | null = null
let current = asked.get('model') ?? ''
let slugs: string[] = []

async function index(): Promise<string[]> {
  if (slugs.length) return slugs
  const manifest = await loadManifest()
  slugs = manifest.all
    .filter((e) => e.wing === 'models' && e.path.endsWith('/'))
    .map((e) => e.id.replace(/^models\//, ''))
  return slugs
}

function chips(): void {
  indexEl.replaceChildren()
  for (const slug of slugs) {
    const a = document.createElement('a')
    a.href = `?model=${slug}${tierAsked ? `&tier=${tierAsked}` : ''}`
    a.textContent = slug
    if (slug === current) a.setAttribute('aria-current', 'true')
    indexEl.append(a)
  }
}

/* WHERE THE EYE STANDS. Framed off the body's own bounding sphere so a
   three-centimetre stone and a three-metre door are both readable, from one
   fixed direction so every frame of the library is the same comparison. The
   grid does not move, so the frame still says how big the thing is. */
function frame(size: Vector3, centre: Vector3): void {
  /* wide enough that the body AND its ruler are both in shot, so no frame of
     this bench can show a thing without showing how big it is */
  const radius = Math.max(0.06, size.length() / 2, rulerLength * 0.78)
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.35
  const dir = new Vector3(0.62, 0.42, 1).normalize()
  camera.position.copy(centre).addScaledVector(dir, distance)
  camera.lookAt(centre)
  camera.near = Math.max(0.01, distance / 200)
  camera.far = distance * 12 + 40
  camera.updateProjectionMatrix()
}

async function show(slug: string): Promise<void> {
  current = slug
  await index()
  chips()
  if (standing) {
    scene.remove(standing)
    standing = null
  }
  plateEl.hidden = false

  const sky = await probe(PROBE)
  const span = await spanOf(slug)
  /* THE SHADOW IS SIZED TO THE BODY. One cascade over thirty metres of ground
     puts a three-centimetre stone inside a single shadow texel, and a model
     with no contact shadow reads as floating, which is the exact defect this
     bench exists to catch. */
  const reach = Math.min(40, Math.max(2.5, span * 5))
  if (sky) {
    stack.light({
      ...KEY,
      kelvin: sky.sun.kelvin,
      lux: 380,
      probe: sky.texture,
      ambient: 1,
      reach,
      cascades: [Math.max(0.4, span * 1.6), reach],
    })
    scene.background = sky.texture
    /* the sky's own sun is turned onto the key, exactly as the swatch route
       turns it: one hour in the frame, and the card says by how much */
    const turn = ((sky.sun.azimuth - KEY.azimuth) * Math.PI) / 180
    scene.environmentRotation.set(0, turn, 0)
    scene.backgroundRotation.set(0, turn, 0)
    scene.backgroundBlurriness = 0.55
    scene.backgroundIntensity = 0.14
    /* held back on purpose, and the same reason the swatch route holds it
       back: a full dome lays an even veil over a body and the frame becomes
       a picture of the exposure. The key does the modelling here. */
    scene.environmentIntensity = 0.45
  } else {
    stack.light({ ...KEY, kelvin: 5200, lux: 420, ambient: 1, reach })
  }
  tighten(span)

  let asset: ModelAsset | null = null
  let entry: ManifestEntry | undefined
  try {
    asset = await stack.models.load(slug)
    standing = await stack.models.place(slug, { position: [0, 0, 0], snap: 'ground' })
    scene.add(standing)
    entry = asset.entry
  } catch (err) {
    licenceEl.textContent = `this model did not load: ${(err as Error).message}`
    sourceEl.textContent = ''
    numbersEl.textContent = ''
    plateEl.hidden = true
    nameEl.textContent = slug
    return
  }

  /* the record is the file's own measurement; the scene box three builds
     around a rotated node is the axis-aligned box of an axis-aligned box and
     reads a few per cent large, so it is used for framing and never quoted */
  const box = new Box3().setFromObject(standing)
  const centre = new Vector3()
  box.getCenter(centre)
  const size = new Vector3()
  box.getSize(size)
  setRuler(size.y, -(size.x / 2 + Math.max(0.06, size.x * 0.28)))
  frame(size, centre)

  nameEl.textContent = slug
  const fit = document.createElement('span')
  fit.className = 'fit'
  fit.textContent = `${asset.category} · ${asset.periodFit}`
  nameEl.append(fit)
  licenceEl.textContent = `${entry.role ?? ''}${entry.role ? ' · ' : ''}${entry.licence}`
  sourceEl.textContent = entry.source_url ?? ''
  const cost = stack.cost()
  const b = entry.bounds_m ?? [size.x, size.y, size.z]
  const dressed =
    asset.texelsPerMetre && asset.texelsPerMetre < 400
      ? ` · dressed with ${entry.gltf?.detail_set ?? '?'}, whose own maps are coarse`
      : ''
  const metre = rulerLength >= 1 ? `${rulerLength} m` : `${Math.round(rulerLength * 100)} cm`
  const band =
    rulerLength >= 1 ? `${rulerLength * 10} cm` : `${Math.round(rulerLength * 100) / 10} cm`
  numbersEl.textContent =
    `${b[0]} by ${b[1]} by ${b[2]} m, measured off the file · ` +
    `${asset.tris.toLocaleString('en')} triangles · ` +
    `${entry.gltf?.resolution ?? '?'} maps at about ${asset.texelsPerMetre} texels per metre` +
    `${dressed} · ${cost.textureMB.toFixed(1)} MB held · ` +
    `the ruler is ${metre}, banded at ${band}, the grid one metre · ` +
    `${PROBE}, sun turned to ${KEY.azimuth}°`
  plateImg.src = `${ASSET_BASE}${entry.wing}/${entry.path}reference.jpg`
  plateCap.textContent = "the source's own preview render"
  document.title = `${slug} · model library`
}

await index()
if (!current) current = slugs[0] ?? ''
if (current) await show(current)
else {
  licenceEl.textContent = 'no model is manifested yet'
  chips()
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
  stack.render(dt)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

/* the rig's own door, the same shape the museum's forge hook takes, so one
   eye shoots the night, the swatches and the bench without three dialects */
declare global {
  interface Window {
    __forgeModels?: {
      jump: (state: string, opts?: { model?: string }) => void
      freeze: (t: number) => void
      tier: (name: TierName) => void
      look: (yaw: number, pitch: number) => void
      cost: () => ReturnType<Stack['cost']>
      state: () => { texturesPending: number; model: string; tris: number }
      models: () => string[]
    }
  }
}
window.__forgeModels = {
  jump(_state, opts = {}) {
    document.body.classList.add('forge')
    document.body.dataset['forge'] = 'pending'
    void show(opts.model ?? current).then(() => {
      document.body.dataset['forge'] = 'model'
    })
  },
  freeze() {
    /* nothing on this route moves, so there is no clock to hold */
  },
  tier(name) {
    if (isTierName(name)) stack.tier(name)
  },
  look() {
    /* one fixed viewpoint: a model compared from two angles is two models */
  },
  cost: () => stack.cost(),
  state: () => ({
    /* the rig waits on this before every shot: a glTF still in flight is a
       frame with a hole in it, and a texture still in flight is a grey body */
    texturesPending: stack.materials.pending() + stack.models.pending(),
    model: current,
    tris: stack.models.tris(),
  }),
  models: () => slugs,
}
