/** THE READING ROOM: a studiolo of modern oak joinery standing on its own
 * plinth against the long gallery's west wall, round the table the page of
 * Manuscript B lies open on. Modern exhibition architecture, furniture and
 * lighting in the manner of a Renaissance scholar's panelled study; nothing
 * here claims a room, a lamp or a piece of furniture of 1517.
 *
 * INSIDE, A BRASS PENDANT OVER THE BOOK IS THE READING LIGHT, and a warm cove
 * on the cornice lays its light on the coffered ceiling, so the room is lit
 * by what the ceiling sends back and glows through its doorway. OUTSIDE, the
 * room takes the gallery's daylight through the east glass and the gallery's
 * bounce; the doorway's own light onto the gallery floor is the gallery's
 * (`line-gallery-plan.ts`, the opening as data).
 *
 * The lights are not scene lights. A scene light is sampled by every lit
 * surface of the wing, shadow map by shadow map, in a stage that holds sixteen
 * samplers, so each is hidden from the scene's own list and handed only to
 * the surfaces this module adopts.
 */
import {
  BackSide, BufferGeometry, Color, CubeCamera, CubeRenderTarget, CylinderGeometry, DoubleSide,
  Group, HalfFloatType, LatheGeometry, Matrix4, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D,
  PMREMGenerator, Quaternion, RectAreaLight, SpotLight, Vector2, Vector3, type Light, type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Stack } from '../../../stack'
import { kelvinToColour } from '../../../stack/light'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import { FLOOR } from './layout'
import { GALLERY_LIGHTS } from './line-gallery-plan'
import {
  Batch, bookcasePieces, chairFloor, chairParts, linear, OAK, OAK_READ, PLANES, READING_COVE, READING_LAMP, READING_ROOM, READING_ROOM_PROVENANCE, READING_STAND, READING_THRESHOLD, READING_WASH,
  READING_SHADOW_LAYER, SHADE, studioloParts, T, TABLE_BOARDS, TABLE_TOP, toned, v3, volumeGeometry,
} from './reading-room-plan'

export { READING_CHAIR, READING_LAMP, READING_ROOM, READING_ROOM_PROVENANCE, READING_SHADOW_LAYER, readingRoomSolids } from './reading-room-plan'

const R = READING_ROOM, Pl = PLANES
/** The calm tier's bounce, in the probes' own linear units: set so its walls
 * and floor stand where the hero tier's probes put them. Inside, the warm
 * room; outside, the gallery's own measured fill. */
const CALM_FILL = { inside: [.2, .15, .1], low: [.13, .1, .07], up: [.36, .34, .31], down: [.21, .2, .2], window: [.3, .32, .35] } as const

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  atan, attribute, float, fract, lights: lightsOf, mix, mx_noise_float, normalMap, normalWorldGeometry,
  pmremTexture, positionLocal, positionWorld, sin, smoothstep, sqrt, step, uniform, uv, vec2, vec3, vec4,
} = TSL as unknown as Record<string, N>

export interface ReadingRoom {
  group: Group
  /** Light the table and everything it carries by this room's lamp and bounce,
   * and let its top throw its shadow; its desk lamp is taken off. */
  embrace(table: Object3D): void
  /** Take the room's bounce again. The caller makes the room visible for the
   * length of the call. */
  bake(): void
  /** The table's shadows stand only while the table itself is drawn. */
  update(tableShown: boolean): void
  /** How many of the room's photographs are still on their way. */
  pending(): number
  /** The engine's own stand-ins (the table's occlusion of the floor) on or
   * off: a renderer that computes them itself turns them off. */
  engineOnly(on: boolean): void
  ready: Promise<void>
  dispose(): void
}

export function mountReadingRoom(stack: Stack, host: Object3D): ReadingRoom {
  let root: Object3D = host
  while (root.parent) root = root.parent
  const scene = root as Scene
  const tier = stack.tierName()
  const full = tier !== 'standard' && tier !== 'calm'
  const group = new Group()
  group.name = 'vinci/collection-reading-room'
  group.userData = { ...READING_ROOM_PROVENANCE }
  const owned: { geometry: BufferGeometry }[] = []
  const materials: Material[] = []
  const lights: Light[] = []

  // THE PHOTOGRAPH is the building's own oak from the wing's one library, so
  // a set the hall already holds is never uploaded twice.
  const oakSet = stack.materials.sync('oak-veneer-light')
  const ownSets = [oakSet]
  const waiting = (): number => {
    const gone = new Set(stack.materials.missing().map(set => set.name))
    return ownSets.filter(set => !set.ready.value && !gone.has(set.name)).length
  }
  /** a light in the graph for its matrices, hidden from the scene's own list */
  const keep = (light: Light, name: string): void => {
    light.name = `vinci/collection-reading-room/${name}`
    light.visible = false
    group.add(light)
    lights.push(light)
  }

  // THE LAMP
  const L = READING_LAMP
  const lampAt = v3(L.east, L.north, L.rim + L.disc + .002), aim = v3(L.east, L.north, T.top)
  const throwM = lampAt.distanceTo(aim)
  const lamp = new SpotLight(new Color(L.colour), L.lux / 100 * throwM * throwM, L.reach, L.angle, L.penumbra, 2)
  lamp.position.copy(lampAt)
  const target = new Object3D()
  target.position.copy(aim)
  lamp.target = target
  // the one shadow map the room owns stands at every tier, the calm one small:
  // without it the pool falls through the table onto the floor
  lamp.castShadow = true
  const mapPx = full ? L.mapPx : tier === 'standard' ? 1024 : 512
  lamp.shadow.mapSize.set(mapPx, mapPx)
  lamp.shadow.camera.near = .04
  lamp.shadow.camera.far = L.reach
  lamp.shadow.bias = -.0002
  lamp.shadow.normalBias = .008
  lamp.shadow.radius = L.soft
  lamp.shadow.camera.layers.enable(READING_SHADOW_LAYER)
  keep(lamp, 'lamp')
  group.add(target)

  // THE COVE: a warm plane on the cornice's top facing up, the size of the
  // room, so the ceiling takes its light and nothing under it does
  const cove = new RectAreaLight(kelvinToColour(READING_COVE.kelvin), READING_COVE.intensity, Pl.frontInner - Pl.back, Pl.northInner - Pl.southInner)
  cove.position.copy(v3((Pl.back + Pl.frontInner) / 2, (Pl.southInner + Pl.northInner) / 2, READING_COVE.height))
  // a light looks down its own -z: turned a quarter about east, it looks up
  cove.rotation.set(Math.PI / 2, 0, 0)
  keep(cove, 'cove')

  // THE BACK WALL'S LIGHT: a head over the doorway inside, aimed at the
  // panelling above the book
  const WA = READING_WASH
  const wash = new SpotLight(kelvinToColour(WA.kelvin), WA.candela, WA.reach, WA.angle, WA.penumbra, 2)
  wash.position.copy(v3(...WA.at))
  const washAim = new Object3D()
  washAim.position.copy(v3(...WA.aim))
  wash.target = washAim
  wash.castShadow = false
  keep(wash, 'wash')
  group.add(washAim)

  // THE THRESHOLD'S DOWNLIGHT, in the doorway's head: the sill, the floor
  // inside the door and what stands there take it; the gallery lights its own
  // floor from the same numbers
  const TH = READING_THRESHOLD
  const threshold = new SpotLight(kelvinToColour(TH.kelvin), TH.candela, TH.reach, TH.angle, TH.penumbra, 2)
  threshold.position.copy(v3(...TH.at))
  const thresholdAim = new Object3D()
  thresholdAim.position.copy(v3(...TH.aim))
  threshold.target = thresholdAim
  threshold.castShadow = false
  keep(threshold, 'threshold')
  group.add(thresholdAim)

  // THE GALLERY'S DAYLIGHT on the room's outside: the east glazing as the
  // gallery's own table has it, one opening read by two rooms
  const glazing = GALLERY_LIGHTS.find(light => light.name === 'window')
  let daylight: RectAreaLight | undefined
  if (glazing) {
    daylight = new RectAreaLight(kelvinToColour(glazing.kelvin), glazing.intensity, glazing.width!, glazing.height!)
    daylight.position.copy(v3(...glazing.at))
    daylight.lookAt(v3(...glazing.aim))
    keep(daylight, 'daylight')
  }

  // THE ROOM'S BOUNCE. A probe taken inside the room is the light the room
  // really holds: the lit ceiling and page, the oak, the gallery through the
  // doorway. It is read through the scene's own environment turn, so the
  // cube is taken turned by the same amount; and it is re-taken into the
  // same target, so no surface that reads it is ever rebuilt. Three are
  // taken: one in the room's middle at head height, one low inside the
  // doorway for the floor and what stands on it, and one out in the gallery
  // before the doorway for the room's outside.
  const PROBES = [
    v3(T.east + .27, T.north + .65, FLOOR + 1.75),
    v3(Pl.frontInner - .12, T.north + .72, R.floor + .45),
    v3(R.front + 1.1, T.north, FLOOR + 1.5),
  ]
  let generator: PMREMGenerator | undefined
  const probes: { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget }[] = []
  const gain = 1 / Math.max(.01, scene.environmentIntensity)
  let envIn: N, envOut: N
  if (tier !== 'calm') {
    const size = full ? 256 : 128
    generator = new PMREMGenerator(stack.renderer)
    for (const at of PROBES) {
      const target = new CubeRenderTarget(size, { type: HalfFloatType })
      const camera = new CubeCamera(.05, 2400, target)
      camera.position.copy(at)
      camera.rotation.copy(scene.environmentRotation)
      camera.updateMatrixWorld(true)
      probes.push({ camera, target, pmrem: generator.fromCubemap(target.texture) })
    }
    const [middle, low, gallery] = probes.map(probe => pmremTexture(probe.pmrem.texture))
    // a surface near the floor reads the low probe, which sees out under
    // the table's edge and through the doorway
    envIn = mix(middle, low, smoothstep(.75, .2, positionWorld.y.sub(R.floor))).mul(gain)
    envOut = gallery.mul(gain)
  } else {
    // the calm tier takes no probe: the hero's measured bounce as levels,
    // warm inside, the gallery's fill outside, stronger toward the doorway
    const toDoor = normalWorldGeometry.x.mul(.35).add(1)
    envIn = mix(vec3(...CALM_FILL.inside), vec3(...CALM_FILL.low), smoothstep(.75, .2, positionWorld.y.sub(R.floor))).mul(toDoor).mul(gain)
    const n = normalWorldGeometry
    envOut = mix(vec3(...CALM_FILL.down), vec3(...CALM_FILL.up), n.y.mul(.5).add(.5)).add(vec3(...CALM_FILL.window).mul(n.x.max(0))).mul(gain)
  }

  /** Engine-only terms (the table's occlusion of the floor): the film's own
   * renderer computes these itself and sets this to zero. */
  const engineTerms = uniform(1)
  /** the table top's footprint in three's x and z, and its underside */
  const tableRect = uniform(vec4(0, 0, 0, 0)), tableUnder = uniform(0)
  /** the reading stand's footprint in three's x and z: the top darkens round
   * its foot, the soft contact a lamp this wide leaves */
  const standRect = uniform(vec4(0, 0, 0, 0))

  function adopt(material: Material, rig: readonly Light[], env: N): void {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf([...rig])
    lit.envNode = env
    material.needsUpdate = true
  }

  // THE TABLE SHADES WHAT STANDS UNDER IT. The form factor of its underside
  // seen from a point below it that faces up, by four corners (the corner
  // formula is odd in both sides, so the signed sum is exact).
  const underTable = ((): N => {
    const P = positionWorld
    const c = tableUnder.sub(P.y).max(.02)
    const corner = (a: N, b: N): N => {
      const X = a.div(c), Y = b.div(c)
      const sx = sqrt(X.mul(X).add(1)), sy = sqrt(Y.mul(Y).add(1))
      return X.div(sx).mul(atan(Y.div(sx))).add(Y.div(sy).mul(atan(X.div(sy)))).mul(1 / (2 * Math.PI))
    }
    const x0 = tableRect.x.sub(P.x), z0 = tableRect.y.sub(P.z), x1 = tableRect.z.sub(P.x), z1 = tableRect.w.sub(P.z)
    const covered = corner(x1, z1).sub(corner(x0, z1)).sub(corner(x1, z0)).add(corner(x0, z0)).abs()
    const facingUp = smoothstep(.5, .9, normalWorldGeometry.y)
    const under = P.y.lessThan(tableUnder).select(float(1), float(0))
    return float(1).sub(covered.mul(facingUp).mul(under).mul(engineTerms)).clamp(.3, 1)
  })()
  // THE CHAIR STANDS ON THE FLOOR: its seat frame shades the boards under it
  // by the same form factor, and each foot darkens the floor close round it.
  // The threshold's downlight reaches under the chair unshadowed and the
  // pendant's map is too soft for a leg, so this is laid on the boards' colour.
  const underChair = ((): N => {
    const P = positionWorld, F = chairFloor()
    const c = float(R.floor + F.under).sub(P.y).max(.02)
    const corner = (a: N, b: N): N => {
      const X = a.div(c), Y = b.div(c)
      const sx = sqrt(X.mul(X).add(1)), sy = sqrt(Y.mul(Y).add(1))
      return X.div(sx).mul(atan(Y.div(sx))).add(Y.div(sy).mul(atan(X.div(sy)))).mul(1 / (2 * Math.PI))
    }
    const [w, s, e, n] = F.seat
    const x0 = float(w).sub(P.x), x1 = float(e).sub(P.x), z0 = float(-n).sub(P.z), z1 = float(-s).sub(P.z)
    const seat = corner(x1, z1).sub(corner(x0, z1)).sub(corner(x1, z0)).add(corner(x0, z0)).abs()
    let feet: N = float(0)
    for (const [fe, fn] of F.feet) feet = feet.add(smoothstep(F.foot * 5, F.foot, P.xz.sub(vec2(fe, -fn)).length()).mul(.55))
    const facingUp = smoothstep(.5, .9, normalWorldGeometry.y)
    const low = P.y.lessThan(R.floor + .03).select(float(1), float(0))
    return float(1).sub(seat.mul(1.6).add(feet).mul(facingUp).mul(low).mul(engineTerms)).clamp(.4, 1)
  })()

  /** OILED OAK: the photograph read along each piece's grain in metres, each
   * piece's own tone, the figure held a little under the photograph's own */
  const oak = (name: string, figure: number, occluded: boolean, colour = .75): MeshStandardNodeMaterial => {
    const m = new MeshStandardNodeMaterial({ roughness: .55, metalness: 0 })
    const read = oakSet.sample({ uv: uv(), metres: [...OAK_READ] })
    const tone = attribute('pieceTone', 'vec3')
    // the photograph's own red held back a little: oiled oak reads golden
    const figured = read.albedo.sub(1).mul(figure).add(1)
    const albedo = tone.mul(mix(vec3(figured.dot(vec3(.3, .5, .2))), figured, colour))
    m.colorNode = occluded ? albedo.mul(underChair) : albedo
    // oiled, so smoother along the grain than the photograph's raw board
    m.roughnessNode = read.roughness.mul(.8).add(.12).clamp(.3, .85)
    m.normalNode = normalMap(read.normal.mul(.5).add(.5), vec2(.65, .65))
    if (occluded) m.aoNode = underTable
    m.name = `vinci/collection-reading-room/${name}`
    return m
  }
  const oakIn = oak('oak', .72, true), oakCeiling = oak('ceiling', .6, false), oakOut = oak('oak-outside', .6, false, .9)

  /** THE TABLE'S TOP, dressed by the room in the room's own oak: every board
   * its own piece of the photograph (its own width, tone, figure, direction
   * and run of grain), the breadboards' grain across the board ends, the
   * joints dark, and the finish worn pale where forearms rest at the near
   * edge. Read in the wing's metres off the top's own declared place. */
  const tableTop = ((): MeshStandardNodeMaterial => {
    const m = new MeshStandardNodeMaterial({ roughness: .45, metalness: 0 })
    const P = positionWorld, north = P.z.negate(), east = P.x
    const J = TABLE_BOARDS.joints, west = TABLE_TOP[0], edge = TABLE_TOP[3], bread = TABLE_BOARDS.bread
    let index: N = float(0), lo: N = float(J[0]!), width: N = float(J[1]! - J[0]!)
    for (let k = 1; k < J.length - 1; k++) {
      const past = step(J[k]!, north)
      index = index.add(past)
      lo = lo.add(past.mul(J[k]! - J[k - 1]!))
      width = width.add(past.mul((J[k + 1]! - J[k]!) - (J[k]! - J[k - 1]!)))
    }
    const near = step(edge - bread, east), far = float(1).sub(step(west + bread, east)), ends = near.max(far)
    // a board's own numbers, from its place in the top
    const piece = mix(index, near.mul(20).add(far.mul(30)), ends)
    const rnd = (salt: number): N => fract(sin(piece.mul(12.9898).add(salt * 78.233)).mul(43758.5453))
    const across = north.sub(lo), along = east.sub(west)
    const flip = rnd(2).lessThan(.5).select(float(1), float(-1))
    const board = vec2(across.mul(rnd(1).mul(.45).add(.8)).add(along.mul(rnd(3).sub(.5).mul(.05))).add(rnd(4).mul(1.83)),
      along.mul(flip).add(rnd(5).mul(1.83)))
    const cleat = vec2(east.sub(near.greaterThan(.5).select(float(edge - bread), float(west))).add(rnd(4).mul(1.83)), north.add(rnd(5).mul(1.83)))
    const read = oakSet.sample({ uv: mix(board, cleat, ends), metres: [1.83, 1.83] })
    const value = rnd(6).sub(.5).mul(.2).add(1), warm = rnd(7).sub(.5).mul(.07)
    const tone = vec3(...linear('#705a3e')).mul(vec3(value.mul(warm.add(1)), value, value.mul(float(1).sub(warm))))
    const figured = read.albedo.sub(1).mul(rnd(8).mul(.4).add(.75)).add(1)
    // the joints, each filtered by the pixel along its own axis
    const pixel = axisFootprint(P)
    const toJoint = across.min(width.sub(across))
    const toCleat = east.sub(west + bread).abs().min(east.sub(edge - bread).abs())
    const seam = lineCoverage(toJoint, .0012, .25, pixel.north).mul(float(1).sub(ends))
      .max(lineCoverage(toCleat, .0012, 1.8, pixel.east))
    const arris = smoothstep(.008, .002, toJoint.min(toCleat)).mul(float(1).sub(seam)).mul(.08)
    // WHERE HANDS REST: the near edge before the chair, worn through the wax
    // to the paler wood, patchy, and the arris itself polished pale
    const fromEdge = float(edge).sub(east)
    const patch = smoothstep(.3, .75, mx_noise_float(P.mul(vec3(9, 0, 5))).mul(.5).add(.5))
    // two patches where the forearms lie either side of the reader's place,
    // a paler band the length of the edge, and the arris polished pale
    const forearm = (side: number): N => smoothstep(1, .35, vec2(north.sub(T.north + side * .33).div(.17), fromEdge.sub(.13).div(.1)).length())
    const worn = forearm(1).max(forearm(-1)).mul(patch.mul(.5).add(.5))
      .max(smoothstep(.2, .03, fromEdge).mul(smoothstep(.9, .4, north.sub(T.north).abs())).mul(patch).mul(.55))
      .add(smoothstep(.012, .002, fromEdge).mul(.9)).clamp(0, 1)
    const albedo = tone.mul(mix(vec3(figured.dot(vec3(.3, .5, .2))), figured, .85))
    const outX = standRect.x.sub(P.x).max(P.x.sub(standRect.z)).max(0), outZ = standRect.y.sub(P.z).max(P.z.sub(standRect.w)).max(0)
    const contact = smoothstep(READING_STAND.contact, 0, vec2(outX, outZ).length()).mul(READING_STAND.contactDepth)
    // THE READER'S PAD: a green tanned leather laid under the stand, a gilt
    // fillet tooled round it, its edge drawn a few millimetres proud of the
    // oak by the shade it lays on the grain beside it. A second material, and the
    // place the top is used, so the top reads as a desk and not a floor.
    const into = east.sub(T.east - .2).min(float(T.east + .45).sub(east)).min(north.sub(T.north - .42).min(float(T.north + .42).sub(north)))
    const padPixel = pixel.east.max(pixel.north)
    const pad = into.div(padPixel).add(.5).clamp(0, 1)
    const hide = mx_noise_float(P.mul(vec3(140, 0, 140))).mul(.07).add(mx_noise_float(P.mul(vec3(9, 0, 9))).mul(.1))
    const leather = vec3(...linear('#4a6650')).mul(hide.add(1))
    const fillet = lineCoverage(into.sub(.024), .0011, 1, padPixel).add(lineCoverage(into.sub(.031), .0005, 1, padPixel).mul(.7)).clamp(0, 1)
    const padColour = mix(leather, vec3(...linear('#8c6d38')), fillet.mul(.85)).mul(smoothstep(0, .006, into).mul(.25).add(.75))
    const rim = float(1).sub(smoothstep(.007, 0, into.negate()).mul(float(1).sub(pad)).mul(.4))
    const wood = mix(albedo, albedo.dot(vec3(.3, .5, .2)).mul(vec3(1.5, 1.3, 1.05)), worn.mul(.55)).mul(float(1).sub(seam.mul(.72))).mul(arris.add(1)).mul(worn.mul(.28).add(1))
    m.colorNode = mix(wood.mul(rim), padColour, pad).mul(float(1).sub(contact))
    m.roughnessNode = mix(read.roughness.mul(.45).add(.2).add(seam.mul(.4)).sub(worn.mul(.08)).clamp(.22, .9),
      float(.5).add(hide.mul(.3)).sub(fillet.mul(.2)), pad)
    m.metalnessNode = fillet.mul(pad).mul(.6)
    m.normalNode = normalMap(mix(read.normal.mul(.5).add(.5), vec3(.5, .5, 1), pad), vec2(.5, .5))
    m.name = 'vinci/collection-reading-room/table-top'
    return m
  })()
  const darkIn = new MeshStandardNodeMaterial({ color: '#171412', roughness: .8, metalness: 0 })
  darkIn.name = 'vinci/collection-reading-room/ground'

  const bronzeMaterial = new MeshStandardNodeMaterial({ color: '#6b5537', roughness: .34, metalness: 1 })
  bronzeMaterial.roughnessNode = float(.34).add(mx_noise_float(positionWorld.mul(vec3(90, 900, 90))).mul(.05))
  bronzeMaterial.name = 'vinci/collection-reading-room/bronze'

  // THE PENDANT: a spun brass dome, white inside, an opal disc set up inside
  // it, hung on a black cord from a brass cup in the ceiling.
  // Darkened brass: polished, it mirrored the lit table and outshone the page.
  const brass = new MeshStandardNodeMaterial({ color: '#6e5638', roughness: .4, metalness: 1 })
  {
    const radius = positionLocal.xz.length()
    // the spinning tool's rings, in the gloss and a touch in the tone
    const rings = sin(radius.mul(2400)).mul(.5).add(sin(radius.mul(830)).mul(.5))
    brass.roughnessNode = float(.38).add(rings.mul(.03)).add(mx_noise_float(positionLocal.mul(60)).mul(.05))
    brass.colorNode = vec3(...linear('#6e5638')).mul(rings.mul(.02).add(mx_noise_float(positionLocal.mul(9)).mul(.06)).add(1))
    // the opal bowl under the rim lights the rolled lip and a hand's breadth
    // of the skin over it; the fitter and the cup stay dark
    const overRim = positionLocal.y.sub(L.rim)
    brass.emissiveNode = vec3(...linear(L.colour)).mul(smoothstep(SHADE.lipGlow, 0, overRim).mul(smoothstep(-.004, .002, overRim)).mul(SHADE.lipLevel))
  }
  brass.name = 'vinci/collection-reading-room/brass'
  const enamel = new MeshStandardNodeMaterial({ color: '#e9e3d6', roughness: .45, metalness: 0, side: BackSide })
  enamel.name = 'vinci/collection-reading-room/enamel'
  const cordMaterial = new MeshStandardNodeMaterial({ color: '#1b1a19', roughness: .92, metalness: 0 })
  cordMaterial.name = 'vinci/collection-reading-room/cord'
  // THE OPAL BOWL glows at the lamp's own colour, brightest where the bulb
  // sits over it: it is seen from every stop that sees the shade, it lights nothing
  const glow = new MeshBasicNodeMaterial({ side: DoubleSide })
  glow.colorNode = vec3(...linear(L.colour)).mul(smoothstep(-SHADE.bowl, 0, positionLocal.y.sub(L.rim)).mul(.45).add(.55).mul(SHADE.bowlLevel))
  glow.name = 'vinci/collection-reading-room/diffuser'
  // THE SEAT'S LEATHER: vegetable tanned, darker where it is sat on, satin
  // where hands and cloth have polished it
  const leatherMaterial = new MeshStandardNodeMaterial({ color: '#4a2e1c', roughness: .55, metalness: 0 })
  {
    const P = positionWorld
    const hide = mx_noise_float(P.mul(vec3(38, 38, 38))).mul(.06).add(mx_noise_float(P.mul(vec3(160, 160, 160))).mul(.03))
    leatherMaterial.colorNode = vec3(...linear('#4a2e1c')).mul(hide.add(1))
    leatherMaterial.roughnessNode = float(.5).add(mx_noise_float(P.mul(vec3(90, 90, 90))).mul(.08))
  }
  leatherMaterial.name = 'vinci/collection-reading-room/leather'
  // THE VOLUMES: each its own cloth or leather. The leather is rubbed paler
  // at the joints, the caps and the boards' corners, where hands take a book
  // down; the paper shows its leaves as fine lines across the block; the
  // gilt rules are metal.
  const bindings = new MeshStandardNodeMaterial({ roughness: .72, metalness: 0 })
  {
    const P = positionWorld, tone = attribute('pieceTone', 'vec3'), part = attribute('bookPart', 'float'), at = uv()
    const is = (k: number): N => smoothstep(.45, .05, part.sub(k).abs())
    const paper = is(1), gilt = is(2), spine = is(3)
    const wear = mx_noise_float(P.mul(vec3(60, 140, 60))).mul(.07).add(mx_noise_float(P.mul(900)).mul(.04))
    // the rub: across the back at its two joints and its caps, on a board at
    // its fore-edge and its corners
    const edgeU = smoothstep(.16, 0, at.x).max(smoothstep(.84, 1, at.x))
    const edgeV = smoothstep(.05, 0, at.y).max(smoothstep(.95, 1, at.y))
    const rubbed = mix(edgeV.max(smoothstep(.97, 1, at.x).mul(edgeV.add(.35).min(1))), edgeU.mul(.8).max(edgeV), spine)
      .mul(mx_noise_float(P.mul(420)).mul(.35).add(.75)).clamp(0, 1)
    // A HALF-LEATHER BOARD: the leather runs a hand's breadth onto the board
    // from the spine and wraps its two outer corners, the marbled paper covers
    // the rest; a cloth board is its cloth throughout
    const onBoard = is(0), corner = float(1).sub(at.x).add(at.y.min(float(1).sub(at.y))).lessThan(.16)
    const leatherArea = at.x.lessThan(.19).or(corner).select(float(1), float(0))
    const marble = mx_noise_float(P.mul(vec3(40, 90, 40)).add(mx_noise_float(P.mul(25)).mul(1.6))).mul(.16)
      .add(mx_noise_float(P.mul(vec3(160, 60, 160))).mul(.07)).add(1)
    const face = mix(tone, attribute('sideTone', 'vec3').mul(marble), onBoard.mul(float(1).sub(leatherArea)))
    const cover = face.mul(wear.add(1)).mul(mix(vec3(1), vec3(1.7, 1.6, 1.5), rubbed.mul(.7)))
    // the leaves: a line every few tenths of a millimetre across the block,
    // and the edge browned where air and hands reach it
    const leaves = mx_noise_float(vec3(at.x.mul(2600), at.y.mul(6), 0)).mul(.09).add(mx_noise_float(vec3(at.x.mul(700), at.y.mul(3), 3)).mul(.06))
    const leafEdge = tone.mul(leaves.add(.97)).mul(mx_noise_float(P.mul(35)).mul(.05).add(.97))
    const goldLeaf = tone.mul(mx_noise_float(P.mul(1800)).mul(.18).add(.95))
    bindings.colorNode = mix(mix(cover, leafEdge, paper), goldLeaf, gilt)
    bindings.roughnessNode = mix(mix(float(.62).add(wear.mul(.8)).add(rubbed.mul(.18)), float(.86), paper), float(.36), gilt)
    bindings.metalnessNode = gilt.mul(.85)
  }
  bindings.name = 'vinci/collection-reading-room/bindings'
  const outsideRig = daylight ? [daylight] : []
  for (const m of [oakIn, darkIn, leatherMaterial]) adopt(m, [lamp, threshold, wash], envIn)
  for (const m of [brass, enamel, cordMaterial, bindings]) adopt(m, [lamp], envIn)
  adopt(oakCeiling, [lamp, cove], envIn)
  adopt(oakOut, outsideRig, envOut)
  adopt(bronzeMaterial, [...outsideRig, threshold], envOut)
  adopt(tableTop, [lamp, threshold], envIn.mul(READING_STAND.tableBounce))
  materials.push(tableTop, oakIn, oakCeiling, oakOut, darkIn, bronzeMaterial, brass, enamel, cordMaterial, leatherMaterial, bindings, glow)

  const stampMesh = (mesh: Mesh, name: string): Mesh => {
    mesh.name = `vinci/collection-reading-room/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...READING_ROOM_PROVENANCE, asset: READING_ROOM_PROVENANCE.manifestId }
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  // THE BODY: the oak inside with the bookcase, the ceiling, the oak outside,
  // the ground and the threshold's bronze
  const body = studioloParts(), shelf = bookcasePieces()
  for (const q of shelf.oak) body.inside.piece(q)
  stampMesh(new Mesh(body.inside.geometry(), oakIn), 'oak')
  stampMesh(new Mesh(body.ceiling.geometry(), oakCeiling), 'ceiling')
  stampMesh(new Mesh(body.outside.geometry(), oakOut), 'oak-outside')
  stampMesh(new Mesh(body.dark.geometry(), darkIn), 'ground')
  stampMesh(new Mesh(body.bronze.geometry(), bronzeMaterial), 'bronze')
  stampMesh(new Mesh(volumeGeometry(shelf.volumes), bindings), 'books')
  {
    const can = new CylinderGeometry(.034, .03, .09, 20, 1)
    const from = v3(...WA.at), dirTo = v3(...WA.aim).sub(from).normalize()
    can.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dirTo))
    can.translate(from.x - dirTo.x * .045, from.y - dirTo.y * .045, from.z - dirTo.z * .045)
    stampMesh(new Mesh(can, cordMaterial), 'wash-head').userData['labelOccluder'] = false
  }
  {
    const slot = new Batch(), w = TH.slot.width / 2, l = TH.slot.length / 2, [e, n, h] = TH.at
    slot.piece({ box: [e - w, n - l, h - .002, e + w, n + l, h + .004], grain: 'north', offset: [0, 0], tone: [1, 1, 1] })
    const lens = new MeshBasicNodeMaterial({ color: kelvinToColour(TH.kelvin).multiplyScalar(1.6) })
    lens.name = 'vinci/collection-reading-room/threshold-lens'
    materials.push(lens)
    stampMesh(new Mesh(slot.geometry(), lens), 'threshold-lens').receiveShadow = false
  }

  {
    const rim = L.rim, h = SHADE.height, r = SHADE.radius, f = SHADE.fitter
    // the outer skin, rim to fitter, with a rolled lip
    const outer = [
      [r + .002, 0], [r + .003, .004], [r, .02], [r * .95, .055], [r * .86, .09], [r * .72, .125],
      [r * .54, .155], [r * .34, .175], [f + .004, h - .006], [f, h],
    ].map(([x, y]) => new Vector2(x!, y!))
    const shell = new LatheGeometry(outer, 96)
    shell.translate(L.east, rim, -L.north)
    // the fitter and the cup are the same spun brass: one body with the shade
    const fitter = new CylinderGeometry(f, f * 1.08, .045, 32)
    fitter.translate(L.east, rim + h + .02, -L.north)
    // the ceiling cup the cord runs up into, set against the coffered ceiling
    const cup = new LatheGeometry([[0, -.034], [.012, -.034], [.02, -.032], [.046, -.022], [.056, -.01], [.058, 0]].map(([x, y]) => new Vector2(x!, y!)), 48)
    cup.translate(L.east, R.ceiling - .002, -L.north)
    stampMesh(new Mesh(mergeGeometries([shell, fitter, cup], false)!, brass), 'shade')
    for (const g of [shell, fitter, cup]) g.dispose()
    // Inside the shade its white lining, seen only from under it, which no
    // stop is; the calm tier leaves it out.
    if (tier !== 'calm') {
      const inner = outer.slice(1, -1).map(p => new Vector2(p.x - .0025, p.y + .001))
      const lining = new LatheGeometry(inner, 96)
      lining.translate(L.east, rim, -L.north)
      stampMesh(new Mesh(lining, enamel), 'shade-lining')
    }
    // THE OPAL BOWL set in the rim and swelling under it: the eye stands just
    // over the rim's plane, so the lit glass under the dark dome is what says
    // the pool is this lamp's
    {
      const b = r - .006, steps = 12
      const bowlProfile = Array.from({ length: steps + 1 }, (_, i) => {
        const x = b * i / steps
        return new Vector2(x, -SHADE.bowl * (1 - (x / b) ** 2))
      })
      const bowl = new LatheGeometry(bowlProfile, 96)
      bowl.translate(L.east, rim + .003, -L.north)
      const diffuser = stampMesh(new Mesh(bowl, glow), 'diffuser')
      diffuser.receiveShadow = false
      diffuser.userData['labelOccluder'] = false
    }
    const cordLength = R.ceiling - .03 - (rim + h + .04)
    const cord = new CylinderGeometry(.0035, .0035, cordLength, 10)
    cord.translate(L.east, rim + h + .04 + cordLength / 2, -L.north)
    stampMesh(new Mesh(cord, cordMaterial), 'cord').userData['labelOccluder'] = false
  }

  // THE TABLE'S SHADOWS. Its top casts into this lamp's map from a double
  // on the room's own layer; the table itself is left as it stands.
  const doubleMaterial = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
  doubleMaterial.shadowSide = BackSide
  doubleMaterial.name = 'vinci/collection-reading-room/shadow-double'
  materials.push(doubleMaterial)
  const doubles: Mesh[] = [], ownDoubles: Mesh[] = []
  /** the chair stands and is drawn with the table it is drawn up to */
  const chairBodies: Mesh[] = []
  /** the room's own bodies drawn only with the table: its reading stand */
  const withTable: Mesh[] = []
  /** A shadow-only copy of a body on the room's own layer, in the body's place. */
  const double = (caster: Mesh): Mesh => {
    const copy = new Mesh(caster.geometry, doubleMaterial)
    copy.name = 'vinci/collection-reading-room/shadow-double'
    copy.matrixAutoUpdate = false
    caster.updateWorldMatrix(true, false)
    copy.matrix.copy(caster.matrixWorld)
    copy.layers.set(READING_SHADOW_LAYER)
    copy.castShadow = true; copy.receiveShadow = false
    copy.raycast = () => {}
    copy.userData = { ...READING_ROOM_PROVENANCE, labelOccluder: false, naLabelOccluder: false }
    group.add(copy)
    return copy
  }

  // THE CHAIR, and the shadow it throws under the lamp
  {
    const parts = chairParts()
    const flat = (list: BufferGeometry[]): BufferGeometry => {
      const merged = mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false)!
      for (const g of list) g.dispose()
      merged.computeBoundingBox(); merged.computeBoundingSphere()
      return merged
    }
    const wood = stampMesh(new Mesh(flat(parts.oak), oakIn), 'chair')
    const seat = stampMesh(new Mesh(flat(parts.leather), leatherMaterial), 'chair-seat')
    ownDoubles.push(double(wood), double(seat))
    chairBodies.push(wood, seat, ...ownDoubles)
  }

  /** THE WEDGE under the tilted book, in the table's own frame (x across the
   * spread, z toward the reader, y up from the top) and then the world's: a
   * sloped top under the linen board, square faces down to the table, and a
   * ledge at the foot that the book's lower edge stands clear of. */
  const standMesh = (table: Object3D, pivot: Group): Mesh => {
    const S = READING_STAND, W = S.half, Z = S.reach, y0 = -S.under
    const tilt = new Matrix4().compose(pivot.position, pivot.quaternion, pivot.scale)
    const at = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(tilt)
    const down = (p: Vector3): Vector3 => new Vector3(p.x, 0, p.z)
    const b = new Batch(), tone = toned(OAK.chair, 3, 91, 0)
    const uvOf = (ps: Vector3[], u: (p: Vector3) => number, v: (p: Vector3) => number): [number, number][] => ps.map(p => [u(p) + .4, v(p) + .7])
    const face = (ps: Vector3[], normal: Vector3, v: (p: Vector3) => number): void => b.quad(ps, normal, uvOf(ps, p => p.x, v), tone)
    const up = new Vector3(0, Math.cos(S.tilt), Math.sin(S.tilt))
    const fl = at(-W, y0, Z), fr = at(W, y0, Z), bl = at(-W, y0, -Z), br = at(W, y0, -Z)
    face([bl, br, fr, fl], up, p => p.z)
    face([down(fl), down(fr), fr, fl], new Vector3(0, 0, 1), p => p.y)
    face([down(bl), down(br), br, bl], new Vector3(0, 0, -1), p => p.y)
    b.quad([down(bl), down(fl), fl, bl], new Vector3(-1, 0, 0), uvOf([down(bl), down(fl), fl, bl], p => p.z, p => p.y), tone)
    b.quad([down(br), down(fr), fr, br], new Vector3(1, 0, 0), uvOf([down(br), down(fr), fr, br], p => p.z, p => p.y), tone)
    // the ledge: a strip on the slope's foot, its own box in the book's frame
    const lw = W - .004, z0 = Z - S.lip, lt = S.ledge
    const c = (x: number, y: number, z: number): Vector3 => at(x, y, z)
    face([c(-lw, lt, z0), c(lw, lt, z0), c(lw, lt, Z), c(-lw, lt, Z)], up, p => p.z)
    face([c(-lw, y0, Z), c(lw, y0, Z), c(lw, lt, Z), c(-lw, lt, Z)], new Vector3(0, -Math.sin(S.tilt), Math.cos(S.tilt)), p => p.y)
    face([c(-lw, y0, z0), c(lw, y0, z0), c(lw, lt, z0), c(-lw, lt, z0)], new Vector3(0, Math.sin(S.tilt), -Math.cos(S.tilt)), p => p.y)
    for (const x of [-lw, lw]) {
      const ps = [c(x, y0, z0), c(x, y0, Z), c(x, lt, Z), c(x, lt, z0)]
      b.quad(ps, new Vector3(Math.sign(x), 0, 0), uvOf(ps, p => p.z, p => p.y), tone)
    }
    const g = b.geometry()
    g.applyMatrix4(table.matrixWorld)
    g.computeBoundingBox(); g.computeBoundingSphere()
    standRect.value.set(g.boundingBox!.min.x, g.boundingBox!.min.z, g.boundingBox!.max.x, g.boundingBox!.max.z)
    // it casts no map: the pendant's opal is a hand wide, so its shadow round
    // the foot is the soft contact the top draws, never a hard edge
    return stampMesh(new Mesh(g, oakIn), 'reading-stand')
  }

  // `?roomrig` hands an instrument the room's lights, to lean on a standing
  // frame instead of rebuilding the page for each value
  let rebake = 0
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('roomrig')) {
    ;(window as unknown as Record<string, unknown>)['__roomRig'] = {
      lamp, cove, daylight, threshold, wash,
      /** the lamp's level at the page, in lux */
      lux(value: number) { lamp.intensity = value / 100 * throwM * throwM },
      bake: () => { rebake = 2 },
    }
  }

  let live = true
  const ready = new Promise<void>(resolve => {
    const poll = (): void => { if (!waiting() || !live) resolve(); else setTimeout(poll, 50) }
    poll()
  })

  return {
    group,
    ready,
    pending: waiting,
    engineOnly(on) { engineTerms.value = on ? 1 : 0 },
    embrace(table) {
      table.updateMatrixWorld(true)
      // the table's own stand-in for a lamp gives way to this room's lamp
      const standIn = table.userData['lampStandIn'] as { value: number } | undefined
      if (standIn) standIn.value = 0
      const seen = new Set<Material>()
      let top: Mesh | undefined, lampHead: Mesh | undefined
      table.traverse(child => {
        if (!(child instanceof Mesh)) return
        for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
          if (seen.has(surface)) continue
          seen.add(surface); adopt(surface, [lamp, threshold], envIn)
        }
        if (child.name === 'oak-tabletop') top = child
        if (child.geometry.getAttribute('shadeInterior')) lampHead = child
      })
      // THE DESK LAMP GOES: the pendant is the reading light here, and a
      // second lamp lit on the table turns its glow to the visitor
      if (lampHead?.parent) lampHead.parent.visible = false
      // THE BOOK ON ITS STAND: what the table carries for the open book rides
      // a pivot the room tilts onto its wedge; the top, the lamp and the rack stay
      const S = READING_STAND
      const pivot = new Group()
      pivot.name = 'reading-stand'
      pivot.position.set(0, S.front + S.under * Math.cos(S.tilt) + S.reach * Math.sin(S.tilt), 0)
      pivot.rotation.x = S.tilt
      const keepFlat = new Set([top?.parent, lampHead?.parent, table.getObjectByName('named-folio-reading-rack')])
      for (const child of [...table.children]) if (!keepFlat.has(child)) pivot.add(child)
      table.add(pivot)
      table.updateMatrixWorld(true)
      withTable.push(standMesh(table, pivot))
      if (top) doubles.push(double(top))
      // the top wears the room's own oak, board by board
      if (top) top.material = tableTop
      // THE FLOOR UNDER THE TABLE: the top's own footprint and underside, read
      // off the body that stands there
      if (top) {
        top.geometry.computeBoundingBox()
        const box = top.geometry.boundingBox!.clone().applyMatrix4(top.matrixWorld)
        tableRect.value.set(box.min.x, box.min.z, box.max.x, box.max.z)
        tableUnder.value = box.min.y
      }
    },
    bake() {
      if (!generator) return
      // the shade cannot see itself: it is out of the room while the room is read
      const shade = ['shade', 'shade-lining', 'diffuser']
        .map(name => group.getObjectByName(`vinci/collection-reading-room/${name}`))
        .filter((o): o is Object3D => Boolean(o))
      const shownBodies = [...doubles, ...chairBodies, ...withTable], doublesShown = shownBodies.map(d => d.visible)
      for (const o of shade) o.visible = false
      for (const d of shownBodies) d.visible = true
      for (const probe of probes) probe.camera.update(stack.renderer, scene)
      for (const o of shade) o.visible = true
      shownBodies.forEach((d, i) => { d.visible = doublesShown[i]! })
      for (const probe of probes) generator.fromCubemap(probe.target.texture, probe.pmrem)
    },
    update(tableShown) {
      for (const d of [...doubles, ...chairBodies, ...withTable]) if (d.visible !== tableShown) d.visible = tableShown
      if (rebake > 0) { rebake--; this.bake() }
    },
    dispose() {
      live = false
      for (const o of owned) o.geometry.dispose()
      for (const d of [...doubles, ...ownDoubles]) d.removeFromParent()
      for (const m of materials) m.dispose()
      lamp.shadow.dispose()
      for (const light of lights) light.dispose()
      for (const probe of probes) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}
