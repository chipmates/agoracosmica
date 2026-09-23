/** THE READING ROOM: an oak niche set against the long gallery's west wall
 * round the table the page of Manuscript B lies open on. Modern exhibition
 * architecture, furniture and lighting; nothing here claims a room, a lamp or
 * a piece of furniture of 1517.
 *
 * ONE LAMP LIGHTS IT. A brass pendant over the book is the only light the
 * room's surfaces and the table take; everything else they receive is the
 * room's own bounce, read from a probe taken inside the room once it stands.
 * The sun, the sky's flat fill and the gallery's unshadowed fittings stay with
 * the rest of the wing: this is a room for works on paper, dark, and the page
 * is the brightest thing in it.
 *
 * The lamp is not a scene light. A scene light is sampled by every lit
 * surface of the wing, shadow map by shadow map, in a stage that holds sixteen
 * samplers, so it is hidden from the scene's own list and handed only to the
 * surfaces this module adopts.
 */
import {
  BackSide, BufferGeometry, Color, CubeCamera, CubeRenderTarget, CylinderGeometry, DoubleSide,
  Group, HalfFloatType, LatheGeometry, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D,
  PMREMGenerator, SpotLight, Vector2, type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Stack } from '../../../stack'
import { createMaterialLibrary } from '../../../stack/materials'
import {
  Batch, chairParts, linear, oakPieces, READING_LAMP, READING_ROOM, READING_ROOM_PROVENANCE,
  READING_SHADOW_LAYER, SHADE, T, v3, type Piece,
} from './reading-room-plan'

export { READING_CHAIR, READING_LAMP, READING_ROOM, READING_ROOM_PROVENANCE, READING_SHADOW_LAYER, readingRoomSolids } from './reading-room-plan'

const R = READING_ROOM

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  atan, attribute, float, lights: lightsOf, mx_noise_float, normalMap, normalWorldGeometry,
  pmremTexture, positionLocal, positionWorld, sin, smoothstep, sqrt, uniform, uv, vec2, vec3, vec4,
} = TSL as unknown as Record<string, N>

export interface ReadingRoom {
  group: Group
  /** Light the table and everything it carries by this room's lamp and bounce,
   * and let its top and its lamp throw their shadows. */
  embrace(table: Object3D): void
  /** Take the room's bounce again. The caller makes the room visible for the
   * length of the call. */
  bake(): void
  /** The table's shadows stand only while the table itself is drawn. */
  update(tableShown: boolean): void
  /** How many of the room's photographs are still on their way. */
  pending(): number
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

  // THE PHOTOGRAPH comes through a library of the room's own, so its bytes
  // never stand in the queue the machines' materials wait on.
  const library = createMaterialLibrary(stack.tierConfig())
  const oakSet = library.sync('oak-veneer-light')
  const unregister = stack.registerTextureMemory(() => library.textureMB(), 'reading room oak')

  // THE LAMP
  const L = READING_LAMP
  const lampAt = v3(L.east, L.north, L.rim + .014), aim = v3(L.east, L.north, T.top)
  const throwM = lampAt.distanceTo(aim)
  const lamp = new SpotLight(new Color(L.colour), L.lux / 100 * throwM * throwM, L.reach, L.angle, L.penumbra, 2)
  lamp.name = 'vinci/collection-reading-room/lamp'
  lamp.position.copy(lampAt)
  const target = new Object3D()
  target.position.copy(aim)
  lamp.target = target
  lamp.castShadow = full || tier === 'standard'
  const mapPx = full ? L.mapPx : 1024
  lamp.shadow.mapSize.set(mapPx, mapPx)
  lamp.shadow.camera.near = .04
  lamp.shadow.camera.far = L.reach
  lamp.shadow.bias = -.0002
  lamp.shadow.normalBias = .008
  lamp.shadow.radius = L.soft
  lamp.shadow.camera.layers.enable(READING_SHADOW_LAYER)
  // hidden from the scene's own list, still in the graph so its matrices follow
  lamp.visible = false
  group.add(lamp, target)

  // THE ROOM'S BOUNCE. A probe taken inside the room is the light the room
  // really holds: the lit page, the dark oak, the gallery beyond the opening.
  // It is read through the scene's own environment turn, so the cube is taken
  // turned by the same amount; and it is re-taken into the same target, so no
  // surface that reads it is ever rebuilt.
  // Deep in the niche, between the table and the canopy: the back wall and
  // the book see the gallery through the opening as it does from here.
  const PROBE_AT = v3(T.east - .28, T.north + .42, T.top + .8)
  let generator: PMREMGenerator | undefined, probe: RenderTarget | undefined
  let cube: { camera: CubeCamera; target: CubeRenderTarget } | undefined
  const gain = 1 / Math.max(.01, scene.environmentIntensity)
  let env: N
  if (tier !== 'calm') {
    const size = full ? 256 : 128
    const target = new CubeRenderTarget(size, { type: HalfFloatType })
    const camera = new CubeCamera(.05, 2400, target)
    camera.position.copy(PROBE_AT)
    camera.rotation.copy(scene.environmentRotation)
    camera.updateMatrixWorld(true)
    cube = { camera, target }
    generator = new PMREMGenerator(stack.renderer)
    probe = generator.fromCubemap(target.texture)
    env = pmremTexture(probe.texture).mul(gain)
  } else {
    // the calm tier takes no probe: a dim warm room, read as one colour
    env = vec3(.035, .029, .022).mul(gain)
  }

  /** Engine-only terms (the table's occlusion of the floor): the film's own
   * renderer computes these itself and sets this to zero. */
  const engineTerms = uniform(1)
  /** the table top's footprint in three's x and z, and its underside */
  const tableRect = uniform(vec4(0, 0, 0, 0)), tableUnder = uniform(0)

  function adopt(material: Material): void {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf([lamp])
    lit.envNode = env
    material.needsUpdate = true
  }

  // THE OAK
  const { oak, dark, bronze } = oakPieces()
  const oakMaterial = new MeshStandardNodeMaterial({ roughness: .55, metalness: 0 })
  {
    const read = oakSet.sample({ uv: uv(), metres: [1.83, 1.83] })
    const tone = attribute('pieceTone', 'vec3')
    // the figure held a little under the photograph's own: the page is the hero
    oakMaterial.colorNode = tone.mul(read.albedo.sub(1).mul(.72).add(1))
    // oiled, so smoother along the grain than the photograph's raw board
    oakMaterial.roughnessNode = read.roughness.mul(.8).add(.12).clamp(.3, .85)
    oakMaterial.normalNode = normalMap(read.normal.mul(.5).add(.5), vec2(.65, .65))
    // THE TABLE SHADES THE FLOOR UNDER IT. The form factor of its underside
    // seen from a point on the floor, by four corners (the corner formula is
    // odd in both sides, so the signed sum is exact).
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
    oakMaterial.aoNode = float(1).sub(covered.mul(facingUp).mul(under).mul(engineTerms)).clamp(.05, 1)
  }
  oakMaterial.name = 'vinci/collection-reading-room/oak'

  const darkMaterial = new MeshStandardNodeMaterial({ color: '#141312', roughness: .82, metalness: 0 })
  darkMaterial.name = 'vinci/collection-reading-room/backing'
  const bronzeMaterial = new MeshStandardNodeMaterial({ color: '#6b5537', roughness: .34, metalness: 1 })
  bronzeMaterial.roughnessNode = float(.32).add(mx_noise_float(positionWorld.mul(vec3(90, 900, 90))).mul(.05))
  bronzeMaterial.name = 'vinci/collection-reading-room/bronze'

  // THE PENDANT: a spun brass dome, white inside, an opal disc across its
  // mouth, hung on a black cord from a brass rose in the canopy.
  const brass = new MeshStandardNodeMaterial({ color: '#b08a4f', roughness: .3, metalness: 1 })
  {
    const radius = positionLocal.xz.length()
    // the spinning tool's rings, in the gloss and a touch in the tone
    const rings = sin(radius.mul(2400)).mul(.5).add(sin(radius.mul(830)).mul(.5))
    brass.roughnessNode = float(.26).add(rings.mul(.03)).add(mx_noise_float(positionLocal.mul(60)).mul(.04))
    brass.colorNode = vec3(...linear('#b08a4f')).mul(rings.mul(.02).add(mx_noise_float(positionLocal.mul(9)).mul(.05)).add(1))
  }
  brass.name = 'vinci/collection-reading-room/brass'
  const enamel = new MeshStandardNodeMaterial({ color: '#e9e3d6', roughness: .45, metalness: 0, side: BackSide })
  enamel.name = 'vinci/collection-reading-room/enamel'
  const cordMaterial = new MeshStandardNodeMaterial({ color: '#1b1a19', roughness: .92, metalness: 0 })
  cordMaterial.name = 'vinci/collection-reading-room/cord'
  // the opal disc glows at the lamp's own colour: it is seen, it lights nothing
  const glow = new MeshBasicNodeMaterial({ color: new Color(L.colour).multiplyScalar(2.2) })
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
  for (const m of [oakMaterial, darkMaterial, bronzeMaterial, brass, enamel, cordMaterial, leatherMaterial]) { adopt(m); materials.push(m) }
  materials.push(glow)

  const stampMesh = (mesh: Mesh, name: string): Mesh => {
    mesh.name = `vinci/collection-reading-room/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...READING_ROOM_PROVENANCE, asset: READING_ROOM_PROVENANCE.manifestId }
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const batch = (pieces: Piece[]): BufferGeometry => { const b = new Batch(); for (const q of pieces) b.piece(q); return b.geometry() }
  stampMesh(new Mesh(batch(oak), oakMaterial), 'oak')
  stampMesh(new Mesh(batch(dark), darkMaterial), 'backing')
  stampMesh(new Mesh(batch(bronze), bronzeMaterial), 'bronze')

  {
    const rim = L.rim, h = SHADE.height, r = SHADE.radius, f = SHADE.fitter
    // the outer skin, rim to fitter, with a rolled lip
    const outer = [
      [r + .002, 0], [r + .003, .004], [r, .02], [r * .95, .055], [r * .86, .09], [r * .72, .125],
      [r * .54, .155], [r * .34, .175], [f + .004, h - .006], [f, h],
    ].map(([x, y]) => new Vector2(x!, y!))
    const shell = new LatheGeometry(outer, 96)
    shell.translate(L.east, rim, -L.north)
    stampMesh(new Mesh(shell, brass), 'shade')
    const inner = outer.slice(1, -1).map(p => new Vector2(p.x - .0025, p.y + .001))
    const lining = new LatheGeometry(inner, 96)
    lining.translate(L.east, rim, -L.north)
    stampMesh(new Mesh(lining, enamel), 'shade-lining')
    // the opal disc, a centimetre inside the rim
    const disc = new CylinderGeometry(r - .012, r - .012, .004, 64)
    disc.translate(L.east, rim + .012, -L.north)
    const diffuser = stampMesh(new Mesh(disc, glow), 'diffuser')
    diffuser.receiveShadow = false
    diffuser.userData['labelOccluder'] = false
    // the fitter, the cord and the rose
    const fitter = new CylinderGeometry(f, f * 1.08, .045, 32)
    fitter.translate(L.east, rim + h + .02, -L.north)
    stampMesh(new Mesh(fitter, brass), 'fitter')
    const rose = new CylinderGeometry(.055, .05, .018, 48)
    rose.translate(L.east, R.ceiling - .009, -L.north)
    stampMesh(new Mesh(rose, brass), 'rose')
    const cordLength = R.ceiling - (rim + h + .04)
    const cord = new CylinderGeometry(.0035, .0035, cordLength, 10)
    cord.translate(L.east, rim + h + .04 + cordLength / 2, -L.north)
    stampMesh(new Mesh(cord, cordMaterial), 'cord').userData['labelOccluder'] = false
  }

  // THE TABLE'S SHADOWS. Its top and its lamp cast into this lamp's map from
  // doubles on the room's own layer; the table itself is left as it stands.
  const doubleMaterial = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
  doubleMaterial.shadowSide = BackSide
  doubleMaterial.name = 'vinci/collection-reading-room/shadow-double'
  materials.push(doubleMaterial)
  const doubles: Mesh[] = [], ownDoubles: Mesh[] = []
  /** the chair stands and is drawn with the table it is drawn up to */
  const chairBodies: Mesh[] = []
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
    const wood = stampMesh(new Mesh(flat(parts.oak), oakMaterial), 'chair')
    const seat = stampMesh(new Mesh(flat(parts.leather), leatherMaterial), 'chair-seat')
    ownDoubles.push(double(wood), double(seat))
    chairBodies.push(wood, seat, ...ownDoubles)
  }

  let live = true
  const ready = new Promise<void>(resolve => {
    const poll = (): void => { if (oakSet.ready.value || library.missing().length || !live) resolve(); else setTimeout(poll, 50) }
    poll()
  })

  return {
    group,
    ready,
    pending: () => library.pending(),
    embrace(table) {
      table.updateMatrixWorld(true)
      const seen = new Set<Material>()
      let top: Mesh | undefined, lampHead: Mesh | undefined
      table.traverse(child => {
        if (!(child instanceof Mesh)) return
        for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
          if (seen.has(surface)) continue
          seen.add(surface); adopt(surface)
        }
        if (child.name === 'oak-tabletop') top = child
        if (child.geometry.getAttribute('shadeInterior')) lampHead = child
      })
      const casters: Mesh[] = []
      if (top) casters.push(top)
      // the lamp on the table: its head and whatever stands in the same group
      if (lampHead?.parent) lampHead.parent.traverse(child => { if (child instanceof Mesh) casters.push(child) })
      for (const caster of casters) doubles.push(double(caster))
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
      if (!generator || !probe || !cube) return
      // the shade cannot see itself: it is out of the room while the room is read
      const shade = ['shade', 'shade-lining', 'diffuser', 'fitter']
        .map(name => group.getObjectByName(`vinci/collection-reading-room/${name}`))
        .filter((o): o is Object3D => Boolean(o))
      const shownBodies = [...doubles, ...chairBodies], doublesShown = shownBodies.map(d => d.visible)
      for (const o of shade) o.visible = false
      for (const d of shownBodies) d.visible = true
      cube.camera.update(stack.renderer, scene)
      for (const o of shade) o.visible = true
      shownBodies.forEach((d, i) => { d.visible = doublesShown[i]! })
      generator.fromCubemap(cube.target.texture, probe)
    },
    update(tableShown) {
      for (const d of [...doubles, ...chairBodies]) if (d.visible !== tableShown) d.visible = tableShown
    },
    dispose() {
      live = false
      unregister()
      for (const o of owned) o.geometry.dispose()
      for (const d of [...doubles, ...ownDoubles]) d.removeFromParent()
      for (const m of materials) m.dispose()
      lamp.shadow.dispose(); lamp.dispose()
      probe?.dispose(); cube?.target.dispose(); generator?.dispose()
      library.dispose()
      group.removeFromParent()
    },
  }
}
