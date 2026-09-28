/** THE MECHANICAL LION, the museum's reconstruction from the old accounts.
 *
 * It keeps the machine contract (a dossier, joints, one finite schedule that
 * holds at its end, a section view) but is not assembled from dossier
 * primitives: the carved parts are distance functions sampled on a private
 * WebGL2 canvas at load, and the works are built from their own numbers.
 * The object's origin is on the floor under the body at rest; the body walks
 * 1.2 m along +z. The section takes the near (left, +x) flank panel off.
 */
import {
  Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Object3D, Uint32BufferAttribute, Vector3, type Material,
} from 'three/webgpu'
import type { MaterialSet, Stack } from '../../../stack'
import { machineCatalog } from './catalog'
import { loadMachineMaterial, materialDressed, materialFailure } from './parts'
import type { ReadyMachineBuild } from './runtime'
import { LionBaker, type Baked } from './lion/bake'
import { CARVED, K, SDF_LIB } from './lion/sdf'
import { LEGS, LION_PERIOD, RACK_RUN, TRAVEL, lionJoints, lionPose, type LegId } from './lion/gait'
import * as works from './lion/works'
import { brassMaterial, chestLight, gildMaterial, librarySurface, paintedMaterial, plainSurface } from './lion/surface'

type V3 = readonly number[]
const SLUG = 'mechanical-lion' as const

/** Grid step multiplier by tier: the film's frame takes the finest carving. */
function carvingScale(stack: Stack): number {
  if (stack.film) return 1
  const tier = stack.tierName()
  return tier === 'hero' ? 1.8 : tier === 'standard' ? 2.4 : 3.0
}

/** The part's code in aAttr.w, read by the paint (surface.ts): the paws are
 * baked in their own frames, negative when mirrored. */
const PART_CODE: Record<string, number> = { paw: 1, hindPaw: 2, face: 3, head: 4, tail: 5, foreUpper: 6, foreLower: 6, hindUpper: 6, hindLower: 6 }

function carvedGeometry(b: Baked, mirror = false, code = 0): BufferGeometry {
  const n = b.position.length / 3
  const pos = new Float32Array(b.position), nor = new Float32Array(b.normal)
  const attr = new Float32Array(n * 4), mat = new Float32Array(n * 4)
  const w = mirror ? -code : code
  for (let i = 0; i < n; i++) {
    attr[i * 4] = b.attr[i * 4]!; attr[i * 4 + 1] = b.attr[i * 4 + 1]!; attr[i * 4 + 2] = b.attr[i * 4 + 2]!; attr[i * 4 + 3] = w
    const m = Math.round(b.attr[i * 4 + 3]!)
    if (m >= 1 && m <= 4) mat[i * 4 + m - 1] = 1
    if (mirror) { pos[i * 3] = -pos[i * 3]!; nor[i * 3] = -nor[i * 3]! }
  }
  const index = new Uint32Array(b.index)
  if (mirror) for (let i = 0; i < index.length; i += 3) { const t = index[i + 1]!; index[i + 1] = index[i + 2]!; index[i + 2] = t }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('aAttr', new Float32BufferAttribute(attr, 4))
  g.setAttribute('aMat', new Float32BufferAttribute(mat, 4))
  g.setIndex(new Uint32BufferAttribute(index, 1))
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}
/** A non-indexed geometry mirrored across x, its winding kept outward. */
function mirrored(src: BufferGeometry): BufferGeometry {
  const g = src.clone()
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name)
    const arr = a.array as Float32Array, size = a.itemSize
    if (name === 'position' || name === 'normal') for (let i = 0; i < a.count; i++) arr[i * size] = -arr[i * size]!
    for (let t = 0; t + 2 < a.count; t += 3) for (let c = 0; c < size; c++) {
      const i1 = (t + 1) * size + c, i2 = (t + 2) * size + c
      const tmp = arr[i1]!; arr[i1] = arr[i2]!; arr[i2] = tmp
    }
    a.needsUpdate = true
  }
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}

const pivotGroup = (parent: Object3D, name: string, at: V3, parentAt: V3 = [0, 0, 0]): Group => {
  const g = new Group()
  g.name = name
  g.position.set(at[0]! - parentAt[0]!, at[1]! - parentAt[1]!, at[2]! - parentAt[2]!)
  parent.add(g)
  return g
}
const addMesh = (parent: Object3D, name: string, geometry: BufferGeometry, material: Material, at: V3 = [0, 0, 0]): Mesh => {
  const m = new Mesh(geometry, material)
  m.name = `${name}:surface`
  m.position.set(-at[0]!, -at[1]!, -at[2]!)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
const flip = (p: V3, side: number): V3 => [p[0]! * side, p[1]!, p[2]!]
/** The +x door's outer face, z at (x, y) in the rest frame, from its baked
 * vertices (the forward-facing ones, the highest z in each 4 mm cell). */
function doorFaceLookup(b: Baked): (x: number, y: number) => number {
  const cell = 0.004, top = new Map<number, number>()
  const key = (i: number, j: number): number => i * 4096 + j
  for (let i = 0; i < b.position.length; i += 3) {
    if (b.normal[i + 2]! < 0.2) continue
    const k = key(Math.round(b.position[i]! / cell), Math.round(b.position[i + 1]! / cell))
    const z = b.position[i + 2]!
    if (z > (top.get(k) ?? -Infinity)) top.set(k, z)
  }
  return (x, y) => {
    const i0 = Math.round(x / cell), j0 = Math.round(y / cell)
    // the nearest cell that holds the face, searching outward
    for (let r = 0; r <= 4; r++) {
      let best = -Infinity
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) best = Math.max(best, top.get(key(i0 + di, j0 + dj)) ?? -Infinity)
      if (best > -Infinity) return best
    }
    return K.HINGE[2]!
  }
}

interface Leg { upper: Group; lower: Group; paw: Group; side: number; fore: boolean }

export function build(stack: Stack): ReadyMachineBuild {
  const record = machineCatalog[SLUG]
  const object = new Group()
  object.name = `vinci/${SLUG}`
  object.userData['assetClass'] = 'GENERATED'
  object.userData['manifestId'] = `vinci/machine/${SLUG}`
  object.userData['dossier'] = record.sourcePath
  object.userData['certainty'] = 'C'
  const { x, y, z } = record.dossier.scale_m
  // the envelope runs from the tail at rest to the nose after the walk
  const bounds = new Box3(new Vector3(-x / 2, 0, -1.1), new Vector3(x / 2, y, -1.1 + z))

  const body = new Group()
  body.name = 'lion-body'
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const sets = new Set<MaterialSet>()
  const parts = new Map<string, { node: Object3D; geometry: BufferGeometry }>()
  const legs = new Map<LegId, Leg>()
  const nodes: Record<string, Group> = {}
  const rods = new Map<LegId, { node: Group; rest: number }>()
  let flank: Object3D | null = null
  let sectionEnabled = false
  let mounted = false, disposed = false, failure: string | null = null
  let time = 0
  const inside = chestLight()

  const keep = (g: BufferGeometry): BufferGeometry => { geometries.add(g); return g }
  const own = <T extends Material>(m: T): T => { materials.add(m); return m }
  // A part is the mesh that draws it: a pivot holds its mesh at an offset, and
  // a view framed on the pivot with the mesh's geometry would land beside it.
  const named = (id: string, node: Object3D, geometry: BufferGeometry): void => {
    if (parts.has(id)) return
    let holder: Object3D = node
    node.traverse(child => { if (holder === node && child instanceof Mesh && child.geometry === geometry) holder = child })
    parts.set(id, { node: holder, geometry })
  }
  // THE CHEST'S PLACE AFTER THE WALK, the board's span at the end of its run.
  // The close look's chest view looks at it, so the walk comes into that view
  // and opens there. Nothing draws it and no light lands on it.
  const stage = new Object3D()
  stage.name = 'chest-stage'
  stage.userData['vitrineTarget'] = true
  const reveal = works.W.board.z + TRAVEL + RACK_RUN
  const stageGeometry = keep(new BufferGeometry().setAttribute('position', new Float32BufferAttribute([
    -0.26, works.W.board.y - 0.14, reveal - 0.06, 0.26, works.W.board.y + 0.14, reveal + 0.12], 3)))
  stageGeometry.computeBoundingBox()
  object.add(stage)
  parts.set('chest-stage', { node: stage, geometry: stageGeometry })

  function applyPose(t: number): void {
    const q = lionPose(t)
    body.position.set(0, q.bob, q.z)
    body.rotation.set(q.pitch, 0, q.roll)
    for (const [id, leg] of legs) {
      const [a1, a2, a3] = q.legs[id]
      leg.upper.rotation.x = a1
      leg.lower.rotation.x = a2
      leg.paw.rotation.x = a3
    }
    nodes['key']!.rotation.x = q.key
    nodes['barrel']!.rotation.x = q.barrel
    nodes['fore-shaft']!.rotation.x = q.foreCrank
    nodes['hind-shaft']!.rotation.x = q.hindCrank
    nodes['detent']!.rotation.x = q.detent
    nodes['latch-rod']!.position.z = -q.pull
    nodes['latch']!.position.y = works.W.latch.y + q.latch
    nodes['door-left']!.rotation.y = q.door
    nodes['door-right']!.rotation.y = -q.door
    // the room fills with light as the doors part
    const open = Math.min(1, Math.abs(q.door) / 0.6)
    inside.value = open * open * (3 - 2 * open)
    nodes['lily-rack']!.position.z = q.rack
    nodes['lily-pinion']!.rotation.y = q.lilyPinion
    // Each rod runs from its lever's pin to its crank's pin; the slot at
    // the crank end takes up the difference in length.
    for (const [id, rod] of rods) {
      const leg = legs.get(id)!
      const hip = leg.fore ? K.SH : K.HP
      const shaft = leg.fore ? works.W.fore : works.W.hind
      const angle = q.legs[id][0]
      const [dy, dz] = leg.fore ? works.W.leverPin.fore : works.W.leverPin.hind
      const ly = hip[1] + dy * Math.cos(angle) - dz * Math.sin(angle), lz = hip[2] + dy * Math.sin(angle) + dz * Math.cos(angle)
      const c = leg.fore ? q.foreCrank : q.hindCrank
      const r = works.W.crankR * leg.side
      const cy = shaft.y + r * Math.cos(c), cz = shaft.z + r * Math.sin(c)
      rod.node.position.set(leg.side > 0 ? works.W.rodXNear : -works.W.rodX, ly, lz)
      rod.node.rotation.set(Math.atan2(-(cy - ly), cz - lz), 0, 0)
    }
    object.updateMatrixWorld(true)
  }

  async function assemble(): Promise<void> {
    const baker = new LionBaker(SDF_LIB)
    const baked: Record<string, Baked> = {}
    const scale = carvingScale(stack)
    try {
      for (const [name, spec] of Object.entries(CARVED)) {
        if (disposed) return
        baked[name] = baker.bake({ name, ...spec, h: spec.h * scale })
        // one part per task, so the frame keeps drawing while the carving is cut
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    } finally {
      baker.dispose()
    }
    const [oakSet, ironSet] = await Promise.all([loadMachineMaterial(stack, 'oak-veneer-light'), loadMachineMaterial(stack, 'iron-forged')])
    if (disposed) return
    sets.add(oakSet); sets.add(ironSet)
    const paint = own(paintedMaterial(inside)), gild = own(gildMaterial(inside)), brass = own(brassMaterial())
    const oak = own(materialDressed(oakSet) ? librarySurface(stack, oakSet, 'oak') : plainSurface('oak'))
    const iron = own(materialDressed(ironSet) ? librarySurface(stack, ironSet, 'iron') : plainSurface('iron'))
    const carved = (name: string, mirror = false): BufferGeometry => keep(carvedGeometry(baked[name]!, mirror, PART_CODE[name] ?? 0))

    // the shell, its near flank panel, the head and the tail stand with the body
    const shell = new Group(); shell.name = 'shell'; body.add(shell)
    named('shell', shell, addMesh(shell, 'shell', carved('shell'), paint).geometry)
    const panel = new Group(); panel.name = 'flank-panel'; body.add(panel); flank = panel
    named('flank-panel', panel, addMesh(panel, 'flank-panel', carved('flank'), paint).geometry)
    const head = new Group(); head.name = 'head'; body.add(head)
    named('head', head, addMesh(head, 'head', carved('head'), paint).geometry)
    addMesh(head, 'face', carved('face'), paint)
    const tail = new Group(); tail.name = 'tail'; body.add(tail)
    named('tail', tail, addMesh(tail, 'tail', carved('tail'), paint).geometry)

    // the frame and its fixed ironwork
    const frame = new Group(); frame.name = 'frame'; body.add(frame)
    named('frame', frame, addMesh(frame, 'frame', keep(works.frameGeometry()), oak).geometry)
    const fittings = new Group(); fittings.name = 'bearings'; body.add(fittings)
    named('bearings', fittings, addMesh(fittings, 'bearings', keep(works.merge([works.frameIronGeometry(), works.clickGeometry()])), iron).geometry)
    const spring = new Group(); spring.name = 'lily-barrel'; body.add(spring)
    named('lily-barrel', spring, addMesh(spring, 'lily-barrel', keep(works.lilyBarrelGeometry()), iron).geometry)

    // the train: barrel with the great wheel and the count wheel on it
    const B = [0, works.W.barrel.y, works.W.barrel.z]
    const barrel = pivotGroup(body, 'barrel', B); nodes['barrel'] = barrel
    named('barrel', barrel, addMesh(barrel, 'barrel', keep(works.barrelGeometry()), iron, B).geometry)
    const wheel = new Group(); wheel.name = 'great-wheel'; barrel.add(wheel)
    named('great-wheel', wheel, addMesh(wheel, 'great-wheel', keep(works.greatWheelGeometry()), brass, B).geometry)
    const count = new Group(); count.name = 'count-wheel'; barrel.add(count)
    named('count-wheel', count, addMesh(count, 'count-wheel', keep(works.countWheelGeometry()), iron, B).geometry)
    const key = pivotGroup(body, 'key', B); nodes['key'] = key
    named('key', key, addMesh(key, 'key', keep(works.keyGeometry()), iron, B).geometry)
    for (const [id, at] of [['fore-shaft', works.W.fore], ['hind-shaft', works.W.hind]] as const) {
      const P = [0, at.y, at.z]
      const shaft = pivotGroup(body, id, P); nodes[id] = shaft
      const geo = works.shaftGeometry(at)
      named(id, shaft, addMesh(shaft, id, keep(geo.iron), iron, P).geometry)
      const pinion = new Group(); pinion.name = id === 'fore-shaft' ? 'fore-pinion' : 'hind-pinion'; shaft.add(pinion)
      named(pinion.name, pinion, addMesh(pinion, pinion.name, keep(geo.brass), brass, P).geometry)
    }
    const D = [works.W.countX, works.W.detent.y, works.W.detent.z]
    const detent = pivotGroup(body, 'detent', D); nodes['detent'] = detent
    named('detent', detent, addMesh(detent, 'detent', keep(works.detentGeometry()), iron).geometry)
    const latchRod = new Group(); latchRod.name = 'latch-rod'; body.add(latchRod); nodes['latch-rod'] = latchRod
    named('latch-rod', latchRod, addMesh(latchRod, 'latch-rod', keep(works.latchRodGeometry()), iron).geometry)
    const latch = new Group(); latch.name = 'latch'; latch.position.set(0, works.W.latch.y, works.W.latch.z); body.add(latch); nodes['latch'] = latch
    named('latch', latch, addMesh(latch, 'latch', keep(works.latchGeometry()), iron).geometry)

    // the doors on their iron hinges, the straps on their outer faces read off the carving
    const doorSurf = doorFaceLookup(baked['door']!)
    for (const side of [1, -1]) {
      const id = side > 0 ? 'door-left' : 'door-right'
      const H = flip(K.HINGE, side)
      const door = pivotGroup(body, id, H); nodes[id] = door
      named(id, door, addMesh(door, id, carved('door', side < 0), paint, H).geometry)
      addMesh(door, `${id}-hinge`, keep(works.hingeGeometry()), iron)
      addMesh(door, `${id}-straps`, keep(works.doorStrapGeometry(doorSurf, side)), iron, H)
    }

    // the lily carriage on its rack, and the pinion that drives it
    const carriage = new Group(); carriage.name = 'lily-rack'; body.add(carriage); nodes['lily-rack'] = carriage
    const c = works.carriageGeometry()
    const boardGroup = new Group(); boardGroup.name = 'lily-board'; carriage.add(boardGroup)
    named('lily-board', boardGroup, addMesh(boardGroup, 'lily-board', keep(works.withAttributes(c.board, [1, 0.9, 0], [1, 0, 0, 0])), paint).geometry)
    addMesh(boardGroup, 'lily-sill', keep(c.sill), oak)
    named('lily-rack', carriage, addMesh(carriage, 'lily-rack', keep(c.rack), iron).geometry)
    const lilyGeo = carved('lily')
    works.LILIES.forEach((l, i) => {
      const id = l.back ? `lily-back-${i - 3}` : `lily-front-${i}`
      const g = new Group(); g.name = id
      g.position.set(l.x, l.y, works.W.board.z + works.W.board.t / 2 + l.z)
      g.scale.setScalar(l.s)
      // each lily cut by hand leans and sits a little differently
      const h = Math.sin((l.x * 91.7 + l.y * 47.3) * 12.9898) * 43758.5453, j = h - Math.floor(h)
      g.rotation.set((j - 0.5) * 0.06, (Math.sin(j * 17.1)) * 0.05, (j - 0.5) * 0.12)
      carriage.add(g)
      named(id, g, addMesh(g, id, lilyGeo, gild).geometry)
    })
    const pin = pivotGroup(body, 'lily-pinion', [works.LILY_PINION_AT.x, works.LILY_PINION_AT.y, works.LILY_PINION_AT.z]); nodes['lily-pinion'] = pin
    named('lily-pinion', pin, addMesh(pin, 'lily-pinion', keep(works.lilyPinionGeometry()), iron).geometry)

    // the four legs: upper on its axle with its lever, lower, paw
    const upperFore = carved('foreUpper'), lowerFore = carved('foreLower'), upperHind = carved('hindUpper'), lowerHind = carved('hindLower')
    const upperForeM = carved('foreUpper', true), lowerForeM = carved('foreLower', true), upperHindM = carved('hindUpper', true), lowerHindM = carved('hindLower', true)
    // each paw carries its half of the lower lap, so the right one is the left mirrored
    const pawGeo = carved('paw'), pawGeoM = carved('paw', true), hindPawGeo = carved('hindPaw'), hindPawGeoM = carved('hindPaw', true)
    // the legs' hinges, pins and bearing plates, forged: meshes on the pieces they are nailed to
    const ironSets = [true, false].map(fore => {
      const a = works.legIron(fore)
      const m = { upper: mirrored(a.upper), lower: mirrored(a.lower), paw: mirrored(a.paw) }
      for (const g of [a.upper, a.lower, a.paw, m.upper, m.lower, m.paw]) keep(g)
      return [a, m] as const
    })
    for (const id of LEGS) {
      const fore = id.startsWith('fore'), side = id.endsWith('left') ? 1 : -1
      const piv = fore ? works.PIVOTS.fore : works.PIVOTS.hind
      const hip = flip(piv.hip, side), knee = flip(piv.knee, side), wrist = flip(piv.wrist, side)
      const upper = pivotGroup(body, `${id}-upper`, hip)
      named(upper.name, upper, addMesh(upper, upper.name, side > 0 ? (fore ? upperFore : upperHind) : (fore ? upperForeM : upperHindM), paint, hip).geometry)
      const lever = new Group(); lever.name = `${id}-lever`; upper.add(lever)
      named(lever.name, lever, addMesh(lever, lever.name, keep(works.leverGeometry(piv.hip, side, fore)), iron, hip).geometry)
      const lower = pivotGroup(upper, `${id}-lower`, knee, hip)
      named(lower.name, lower, addMesh(lower, lower.name, side > 0 ? (fore ? lowerFore : lowerHind) : (fore ? lowerForeM : lowerHindM), paint, knee).geometry)
      const paw = pivotGroup(lower, `${id}-paw`, wrist, knee)
      named(paw.name, paw, addMesh(paw, paw.name, fore ? (side > 0 ? pawGeo : pawGeoM) : (side > 0 ? hindPawGeo : hindPawGeoM), paint).geometry)
      const set = ironSets[fore ? 0 : 1]![side > 0 ? 0 : 1]
      addMesh(upper, `${id}-iron-upper`, set.upper, iron, hip)
      addMesh(lower, `${id}-iron-lower`, set.lower, iron, knee)
      addMesh(paw, `${id}-iron-paw`, set.paw, iron)
      legs.set(id, { upper, lower, paw, side, fore })
      // the rod from the crank to this leg's lever
      const rodNode = new Group(); rodNode.name = `${id}-rod`; body.add(rodNode)
      const shaft = fore ? works.W.fore : works.W.hind
      const lp = fore ? works.W.leverPin.fore : works.W.leverPin.hind
      const rest = Math.hypot(piv.hip[1] + lp[0] - shaft.y - works.W.crankR * side, piv.hip[2] + lp[1] - shaft.z)
      const rg = works.rodGeometry(rest)
      named(rodNode.name, rodNode, addMesh(rodNode, rodNode.name, keep(rg.oak), oak).geometry)
      addMesh(rodNode, `${id}-rod-strap`, keep(rg.iron), iron)
      rods.set(id, { node: rodNode, rest })
    }
    object.add(body)
    mounted = true
    applySection()
    applyPose(time)
    if (stack.film || new URLSearchParams(location.search).has('lionstats')) console.info(`LION carving x${scale}: ${baker.stats.join('; ')}`)
  }

  function applySection(): void {
    if (flank) flank.visible = !sectionEnabled
  }

  const ready = assemble().catch((error: unknown) => {
    failure = error instanceof Error ? error.message : String(error)
    console.error(`The machine ${SLUG} was not built: ${failure}`)
    throw error
  })

  return {
    object,
    slug: SLUG,
    period: LION_PERIOD,
    bounds,
    label: { ...record.label },
    ready,
    animate(t) {
      if (disposed) return
      time = Math.max(0, Number.isFinite(t) ? t : 0)
      if (mounted) applyPose(time)
    },
    joints: () => lionJoints(time),
    tightBounds() {
      object.updateMatrixWorld(true)
      return new Box3().setFromObject(object, true)
    },
    section(enabled) {
      if (disposed) return
      sectionEnabled = enabled
      applySection()
    },
    part(id) {
      return parts.get(id) ?? null
    },
    standing() {
      if (!mounted || disposed) return { mounted: false, dressed: false, error: failure }
      const bare = [...sets].filter(set => !materialDressed(set))
      const reasons = bare.flatMap(set => { const why = materialFailure(set); return why ? [`${set.name} undressed (${why})`] : [] })
      return { mounted: true, dressed: bare.length === 0, error: reasons.length ? reasons.join('; ') : null }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      object.clear()
      object.removeFromParent()
    },
  }
}

/** The travel the body makes along its own z, for placement checks. */
export const LION_TRAVEL = TRAVEL
