/* THE SWATCH ROUTE — where a set of the library is judged.

   Dev and preview only. It is not a station of the museum, it is not on the
   wheel, and no journey walks it: it exists so that every set can be looked
   at as a sphere, a cube and a two-metre plane under one light, beside the
   source's own preview render of the same material, and so that a set that
   reads wrong (a scale, a flipped normal, a tint) is caught before it
   dresses anything.

   THE KEY RAKES THE PLANE. The first pass put the key behind every vertical
   surface in the frame: only the tops were lit, relief went soft everywhere,
   and a flipped green channel would have been invisible because no surface
   took the light across itself. The key now stands where the plane's own
   normal can reach it, at about sixty degrees of incidence, which is the
   angle a joint casts a shadow at and the only angle that proves a normal.

   AND A METAL IS READ UNDER A SKY THAT HAS SOMETHING IN IT. A metal under a
   blurred dome at a fraction of its strength reflects an even grey and reads
   as stone: it is not that the set is wrong, it is that there is nothing in
   the room to be metal with. So a metal takes the same overcast probe as the
   rest of the library, whole and unblurred, where the cloud deck, the horizon
   and the dark ground give a sheet of gold something to be. The three skies
   are themselves swatch states, a mirror ball and a matte ball under each.

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
import type { SkyProbe } from '../stack/hdri'
import { loadManifest } from '../manifest'

/* THE ORDER THE LIBRARY IS READ IN: the museum's own rooms first (the stone
   a court and a colonnade are cut from), then what stands in them, then the
   ground outside, and last the three skies they are all read under. A judge
   walking the route walks it in this order. */
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
const SKIES = ['sky-overcast', 'sky-afternoon-warm', 'sky-night-moon']
const isSky = (name: string): boolean => SKIES.includes(name)

/* WHERE THE KEY STANDS, and it is not a taste. The plane is turned -0.58 rad
   about Y, so its normal is (-0.548, 0, 0.836); at azimuth 155 and elevation
   30 the key's direction is (0.373, 0.5, 0.782) and the two meet at 0.45,
   which is sixty-three degrees of incidence. The cube is turned the other
   way from the first pass so that both of its visible faces take the light
   as well, one at 0.56 and one at 0.66. */
const KEY = { azimuth: 155, elevation: 30 }

/* ONE PROBE FOR THE WHOLE LIBRARY, and it is the overcast day: the light a
   source's own preview render is made under, and therefore the only honest
   light to compare one against. What the metals needed was never another
   sky, it was this one arriving whole. They get the probe at full strength
   and the background sharp, because a metal is judged on what it reflects
   and a blurred dome is nothing to reflect. `?sky=` reads any set under any
   of the three. */
const PROBE = 'sky-overcast'

/* NEUTRAL ON PURPOSE. A swatch is compared against a photograph, so the look
   has to be the plainest the chain can be: no split, almost no vignette,
   almost no grain. Anything else and the judge is grading the grade. */
const PLAIN: Grade = {
  ...GRADES['first-station'],
  name: 'swatch',
  /* a full dome is a bright room and a metal reads the dome rather than the
     light: at exposure 1 the gold set clipped to white and the judge would
     have been shown the exposure instead of the leaf */
  exposure: 0.62,
  split: 0,
  vignette: 0.08,
  grain: 0.006,
  bloom: { strength: 0.16, radius: 0.4, threshold: 0.92, warmth: 0 },
}
/** what a sky is read at as a swatch of its own */
const EXPOSURE: Record<string, number> = {
  'sky-overcast': 0.62,
  /* a clear late afternoon with a sun 19 degrees up: the frame has to be a
     bright hour and not a dusk, and the sun's own disc is allowed to clip */
  'sky-afternoon-warm': 0.5,
  /* the moonlit probe carries a real night's levels, and at an exposure that
     makes its matte ball easy to read the whole frame arrives as daylight.
     This one is set so the sky is still a night sky. */
  'sky-night-moon': 0.9,
}
/** and what a set is read at under it. A metal returns almost everything the
    sky sends it, so the same exposure that shows an overcast stone as stone
    shows a sheet of gold as white paper. */
const SET_EXPOSURE: Record<string, number> = {
  'sky-overcast': 0.62,
  'sky-afternoon-warm': 0.3,
  'sky-night-moon': 2.6,
}
const METAL_EXPOSURE: Record<string, number> = {
  'sky-overcast': 0.34,
  'sky-afternoon-warm': 0.13,
  'sky-night-moon': 1.6,
}
const exposureFor = (sky: string, metal: boolean): number =>
  (metal ? METAL_EXPOSURE[sky] : SET_EXPOSURE[sky]) ?? PLAIN.exposure

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
const skyAsked = asked.get('sky')
let current = asked.get('set') ?? SETS[0] ?? 'marble-lapis'

for (const name of [...SETS, ...SKIES]) {
  const a = document.createElement('a')
  a.href = `?set=${name}${tierAsked ? `&tier=${tierAsked}` : ''}`
  a.textContent = name
  if (name === current) a.setAttribute('aria-current', 'true')
  indexEl.append(a)
}

const scene = new Scene()
const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 60)
/* two seats, and only two. A set is read from the first, always, so that
   twenty-two frames are one comparison; a sky is read from the second, which
   stands closer to the two balls it is read on. */
const SEAT = {
  set: { at: [-0.15, 1.24, 4.35], to: [0.28, 0.86, -0.4] },
  sky: { at: [-0.15, 1.06, 3.5], to: [-0.15, 0.6, 0] },
} as const
function seat(which: 'set' | 'sky'): void {
  const s = SEAT[which]
  camera.position.set(s.at[0], s.at[1], s.at[2])
  camera.lookAt(s.to[0], s.to[1], s.to[2])
}
seat('set')

const stack: Stack = await createStack({ canvas })
stack.setScene(scene, camera, PLAIN)

// the ground the bodies stand on: matte, uniform, and not out of the library,
// so nothing on this page is compared against itself
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
cube.rotation.y = -0.42
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

/* THE TWO BALLS A SKY IS READ ON. A mirror shows what is in the sky and a
   matte ball shows what the sky does to a surface that reflects nothing, and
   between them there is no third thing an environment can hide behind. */
const mirrorBall = new Mesh(
  new SphereGeometry(0.55, 128, 96),
  new MeshStandardNodeMaterial({ color: new Color('#ffffff'), roughness: 0.02, metalness: 1 })
)
mirrorBall.position.set(-0.92, 0.62, 0)
const matteBall = new Mesh(
  new SphereGeometry(0.5, 96, 64),
  new MeshStandardNodeMaterial({ color: new Color('#b4b2ab'), roughness: 0.95, metalness: 0 })
)
matteBall.position.set(0.62, 0.5, 0.1)
for (const m of [mirrorBall, matteBall]) {
  m.castShadow = true
  m.receiveShadow = true
  m.visible = false
  scene.add(m)
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

/** what a set was read under, printed on the frame it was read in */
let readUnder = ''

async function showSet(name: string): Promise<void> {
  seat('set')
  const set: MaterialSet = await stack.materials.load(name)
  const wanted = skyAsked ?? PROBE
  const sky = await probe(wanted)
  const metal = set.cls === 'metal'
  stack.setScene(scene, camera, { ...PLAIN, exposure: exposureFor(wanted, metal) })

  if (sky) {
    stack.light({
      ...KEY,
      kelvin: sky.sun.kelvin,
      lux: 240,
      probe: sky.texture,
      ambient: 1,
      reach: 14,
      cascades: [6, 14],
    })
    scene.background = sky.texture
    /* THE SKY IS TURNED, NOT THE LIGHT. Every set in the library has to be
       read under one key or the frames are not comparable, and a probe whose
       sun stands somewhere else would light a metal from one hour and shade
       it from another. So the environment is rotated until the sky's own sun
       lands where the key does, and the frame says by how much. */
    const turn = ((sky.sun.azimuth - KEY.azimuth) * Math.PI) / 180
    scene.environmentRotation.set(0, turn, 0)
    scene.backgroundRotation.set(0, turn, 0)
    /* a metal is judged on what it reflects, so the background it reflects is
       shown sharp; a stone is judged on itself, and a legible landscape
       behind it is only a distraction */
    /* THE DOME ARRIVES WHOLE ON A METAL AND HELD BACK ON EVERYTHING ELSE, and
       that is a statement about what a swatch is for. A metal has no albedo
       to show: it IS what it reflects, and the first reading could not judge
       one because the probe never arrived. A dielectric does have an albedo,
       and a dome at full strength lays an even specular veil over it: held
       whole, the white marble's own veins measured 1.3 per cent of its mean
       against 2.3 held back, which is the material disappearing under the
       light. Held back, and the key does the modelling.
       The background stays blurred for everything but a metal, because a
       legible landscape behind a stone is something to grade instead of the
       stone. */
    scene.backgroundBlurriness = metal ? 0 : 0.55
    scene.backgroundIntensity = metal ? 0.5 : 0.16
    scene.environmentIntensity = metal ? 1 : 0.62
    readUnder = `${wanted}, sun at ${sky.sun.azimuth.toFixed(0)}° turned to ${KEY.azimuth}°`
  } else {
    stack.light({ ...KEY, kelvin: 5200, lux: 300, ambient: 1 })
    readUnder = 'a baked sky (the library HDRI did not load)'
  }

  const count = stack.tierConfig().detail
  for (const [mesh, metres] of bodies) {
    mesh.visible = true
    mesh.material = set.material({ uv: uv().mul(vec2(metres[0], metres[1])), count })
  }
  mirrorBall.visible = false
  matteBall.visible = false

  const entry = set.entry
  licenceEl.textContent = entry.licence
  sourceEl.textContent = entry.source_url ?? ''
  const cost = stack.cost()
  const d = set.detail
  const laid =
    set.scale[0] === set.metres[0] && set.scale[1] === set.metres[1]
      ? ''
      : ` laid at ${set.scale[0]} by ${set.scale[1]}`
  const turned = entry.orientation ? ` turned ${entry.orientation}°` : ''
  const floor = entry.roughness_floor
  const rough = floor
    ? `roughness ${set.roughness} (the map measures ${entry.measured?.roughness ?? '?'}, floored)`
    : `roughness ${set.roughness}`
  const g = set.grain
  const grain = g
    ? ` · grain ${g.kind} at ${Math.round(g.pitch * 100)} cm` +
      `${g.angle ? ` running ${Math.round((g.angle * 180) / Math.PI)}°` : ''}` +
      `, relief ${g.relief}` +
      `${g.fold ? `, fold ${Math.round(g.fold * 100)} cm` : ''}` +
      `${g.tooth ? `, tooth ${(g.tooth * 100).toFixed(1)} cm` : ''}` +
      `${g.sheen ? `, sheen ${g.sheen}` : ''}`
    : ''
  numbersEl.textContent =
    `${entry.metres?.[0] ?? 1} by ${entry.metres?.[1] ?? 1} m per tile${laid}${turned} · ` +
    `${set.cls} · ${rough} · metalness ${set.metalness} · ` +
    `macro ${Math.round(d.macro * 100)} cm at ${d.macroContrast} · ` +
    `mid ${d.mid ? `${Math.round(d.mid * 100)} cm` : 'none'} · micro ${d.micro}${grain}` +
    `${set.detile ? ` · tiling broken at ${Math.round(set.detile * 100)} cm` : ''} · ` +
    `exposure ${exposureFor(wanted, metal).toFixed(2)} · ` +
    `${cost.textureMB.toFixed(1)} MB held · ${readUnder}`
  plateImg.src = `${ASSET_BASE}${entry.wing}/${entry.path}reference.jpg`
  plateCap.textContent = "the source's own preview render"
}

async function showSky(name: string): Promise<void> {
  seat('sky')
  const sky = await probe(name)
  stack.setScene(scene, camera, { ...PLAIN, exposure: EXPOSURE[name] ?? PLAIN.exposure })
  for (const [mesh] of bodies) mesh.visible = false
  mirrorBall.visible = true
  matteBall.visible = true

  if (!sky) {
    licenceEl.textContent = 'this sky did not load'
    sourceEl.textContent = ''
    numbersEl.textContent = ''
    plateEl.hidden = true
    return
  }
  /* THE HOUR IS THE SKY'S OWN. Nothing is turned here and nothing is guessed:
     the key stands where this sky's brightest place stands, so the shadow on
     the ground and the sun in the background are the same sun. */
  stack.light({ hdri: sky, lux: 240, ambient: 1, reach: 14, cascades: [6, 14] })
  scene.background = sky.texture
  scene.environmentRotation.set(0, 0, 0)
  scene.backgroundRotation.set(0, 0, 0)
  scene.backgroundBlurriness = 0
  scene.backgroundIntensity = 1
  scene.environmentIntensity = 1

  const entry = sky.entry
  licenceEl.textContent = entry.licence
  sourceEl.textContent = entry.source_url ?? ''
  const s = sky.sun
  numbersEl.textContent =
    `2K equirectangular · sun at azimuth ${s.azimuth.toFixed(0)}°, ` +
    `elevation ${s.elevation.toFixed(0)}° · ${s.kelvin} K · ` +
    `peak ${s.contrast.toFixed(0)}x the dome's mean · ` +
    `read at exposure ${(EXPOSURE[name] ?? PLAIN.exposure).toFixed(2)} · ` +
    'a mirror ball and a matte ball, and the sky itself behind them'
  const index = await loadManifest()
  const ref = index.byId.get(`library/${name}-reference`)
  plateImg.src = ref ? `${ASSET_BASE}${ref.wing}/${ref.path}` : ''
  plateCap.textContent = "the source's own preview render"
}

async function show(name: string): Promise<void> {
  current = name
  plateEl.hidden = false
  if (isSky(name)) await showSky(name)
  else await showSet(name)
  nameEl.textContent = name
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
  sets: () => [...SETS, ...SKIES],
}
