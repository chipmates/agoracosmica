/* THE SWATCH ROUTE — where a set of the library is judged.

   Dev and preview only. It is not a station of the museum, it is not on the
   wheel, and no journey walks it: it exists so that every set can be looked
   at as a sphere, a cube and a two-metre plane under one light, beside the
   source's own preview render of the same material, and so that a set that
   reads wrong (a scale, a flipped normal, a tint) is caught before it
   dresses anything.

   One set at a time, by `?set=`. Twenty-two sets held at once would be over
   a gigabyte of texture on the hero tier, and a page that cannot hold its
   own library cannot tell you anything true about one of its sets. */

import {
  BoxGeometry,
  Color,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
} from 'three/webgpu'
import { uv, vec2 } from 'three/tsl'
import { createStack, type Stack } from '../stack'
import { GRADES, type Grade } from '../stack/grade'
import { isTierName, type TierName } from '../stack/tier'
import type { MaterialSet } from '../stack/materials'
import { ASSET_BASE } from '../stack/materials'
import { loadManifest } from '../manifest'

/* THE ORDER THE LIBRARY IS READ IN: the museum's own rooms first (the stone
   a court and a colonnade are cut from), then what stands in them, then the
   ground outside. A judge walking the route walks it in this order. */
const SETS = [
  'marble-lapis',
  'marble-white',
  'limestone-pale',
  'stone-tuffeau',
  'brick-old-red',
  'plaster-lime-aged',
  'slate-roof',
  'terracotta-tiles',
  'bronze-dark',
  'iron-forged',
  'gold-leaf',
  'oak-beams',
  'oak-planks-worn',
  'canvas-raw',
  'linen',
  'wool-cloth',
  'leather-worn',
  'parchment-laid',
  'rope',
  'earth-packed',
  'gravel',
  'grass-short',
]

/* NEUTRAL ON PURPOSE. A swatch is compared against a photograph, so the look
   has to be the plainest the chain can be: no split, almost no vignette,
   almost no grain. Anything else and the judge is grading the grade. */
const PLAIN: Grade = {
  ...GRADES['first-station'],
  name: 'swatch',
  /* a full overcast dome is a bright room, and a metal reads the dome rather
     than the light: at exposure 1 the gold set clipped to white and the
     judge would have been shown the exposure instead of the leaf */
  exposure: 0.78,
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
let current = asked.get('set') ?? SETS[0] ?? 'marble-lapis'

for (const name of SETS) {
  const a = document.createElement('a')
  a.href = `?set=${name}${tierAsked ? `&tier=${tierAsked}` : ''}`
  a.textContent = name
  if (name === current) a.setAttribute('aria-current', 'true')
  indexEl.append(a)
}

const scene = new Scene()
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 60)
camera.position.set(-0.15, 1.24, 4.35)
camera.lookAt(0.28, 0.86, -0.4)

const stack: Stack = await createStack({ canvas })
stack.setScene(scene, camera, PLAIN)

/* the overcast sky is the reading light of this route: an even dome with no
   direction of its own, which is the light a source's own preview render is
   made under. The key is a weak warm rake on top of it, so a normal map has
   something to be wrong in front of. */
let probeName = 'sky-overcast'
try {
  const sky = await stack.hdri('sky-overcast')
  stack.light({
    azimuth: 34,
    elevation: 30,
    kelvin: 5200,
    lux: 200,
    probe: sky.texture,
    ambient: 1,
    reach: 14,
    cascades: [6, 14],
  })
  scene.background = sky.texture
  scene.backgroundIntensity = 0.16
  scene.backgroundBlurriness = 0.55
  scene.environmentIntensity = 0.62
} catch {
  probeName = 'baked sky (the library HDRI did not load)'
  stack.light({ azimuth: 34, elevation: 30, kelvin: 5200, lux: 260, ambient: 1 })
}

// the ground the three primitives stand on: matte, uniform, and not out of
// the library, so nothing on this page is compared against itself
const ground = new Mesh(
  new PlaneGeometry(30, 30),
  new MeshStandardNodeMaterial({ color: new Color('#20222a'), roughness: 0.95, metalness: 0 })
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

/* THE THREE BODIES, AND THE ONE NUMBER THAT MAKES THEM COMPARABLE. A uv runs
   0 to 1 over any geometry, so a set laid on all three without saying how big
   each one is would put one tile on a 0.8 m cube and one on a 2 m plane, and
   the swatch would say nothing about scale. Each carries the metres its own
   uv spans. */
const sphere = new Mesh(new SphereGeometry(0.5, 96, 64))
sphere.position.set(-1.02, 0.5, 0)
const cube = new Mesh(new BoxGeometry(0.8, 0.8, 0.8))
cube.position.set(0.24, 0.4, 0.06)
cube.rotation.y = 0.42
/** two metres square, standing up, so a tile can be counted */
const plane = new Mesh(new PlaneGeometry(2, 2))
plane.position.set(1.58, 1.0, -1.55)
plane.rotation.y = -0.58
/* the metres each body's own uv spans, u then v. A sphere's u runs once
   around its equator and its v only from pole to pole, which is half as far:
   given one number, every set would read as stretched on the sphere alone. */
const bodies: Array<[Mesh, [number, number]]> = [
  [sphere, [Math.PI, Math.PI / 2]],
  [cube, [0.8, 0.8]],
  [plane, [2, 2]],
]
for (const [m] of bodies) {
  m.castShadow = true
  m.receiveShadow = true
  scene.add(m)
}

async function show(name: string): Promise<void> {
  current = name
  const set: MaterialSet = await stack.materials.load(name)
  const count = stack.tierConfig().detail
  for (const [mesh, metres] of bodies) {
    mesh.material = set.material({ uv: uv().mul(vec2(metres[0], metres[1])), count })
  }

  const entry = set.entry
  nameEl.textContent = name
  licenceEl.textContent = entry.licence
  sourceEl.textContent = entry.source_url ?? ''
  const cost = stack.cost()
  numbersEl.textContent =
    `${entry.metres?.[0] ?? 1} by ${entry.metres?.[1] ?? 1} m per tile · ` +
    `roughness ${set.roughness} · ${(entry.maps ?? []).join(', ')} · ` +
    `${cost.textureMB.toFixed(1)} MB held · ${probeName}`
  plateImg.src = `${ASSET_BASE}${entry.wing}/${entry.path}reference.jpg`
  plateCap.textContent = "the source's own preview render"
  plateEl.hidden = false
  document.title = `${name} · material library`
  for (const a of indexEl.querySelectorAll('a')) {
    if (a.textContent === name) a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  }
}

await show(current)

// the manifest is fetched anyway; naming it here means a page that shows a
// set the record does not carry says so instead of drawing it silently
void loadManifest().then((index) => {
  if (!index.byId.get(`library/${current}`)) {
    licenceEl.textContent = 'this set is in no manifest'
  }
})

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  stack.setSize(innerWidth, innerHeight)
})

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  stack.render(dt)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

/* the rig's own door. `jump('swatch', { set })` is the same shape the museum's
   forge hook takes, so one eye drives both routes. */
declare global {
  interface Window {
    __forgeSwatch?: {
      jump: (state: string, opts?: { set?: string }) => void
      freeze: (t: number) => void
      tier: (name: TierName) => void
      look: (yaw: number, pitch: number) => void
      cost: () => ReturnType<Stack['cost']>
      sets: () => string[]
    }
  }
}
window.__forgeSwatch = {
  jump(_state, opts = {}) {
    document.body.classList.add('forge')
    document.body.dataset['forge'] = 'pending'
    void show(opts.set ?? current).then(() => {
      document.body.dataset['forge'] = 'swatch'
    })
  },
  freeze() {
    /* nothing on this route moves, so there is no clock to hold */
  },
  tier(name) {
    if (isTierName(name)) stack.tier(name)
  },
  look() {
    /* one fixed viewpoint: a swatch compared from two angles is two swatches */
  },
  cost: () => stack.cost(),
  sets: () => SETS,
}
