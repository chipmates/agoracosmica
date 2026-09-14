/** The benches' objects, stood in the rooms.
 *
 * Every object here is imported UNCHANGED from the bench that built it and
 * judged it: `machines/` by `buildMachine(slug, stack)`, `line/`, `table/`,
 * `grave/` and `myths/` by their own factories. This module owns where they
 * stand, what they stand on and which way they face, and nothing else.
 */
import { Group, Mesh, PointLight, Vector3, type Material } from 'three/webgpu'
import type { Stack } from '../../../stack'
import { buildMachine, MACHINE_SLUGS, type MachineSlug } from '../machines'
import type { ReadyMachineBuild } from '../machines/runtime'
import { mountBoxes } from '../machines/bench/mounts'
import { createCollectionLineFloor, fitCollectionExhibitFloor } from './line-floor'
import { createGrave } from '../grave'
import { createMythDeathbed, createMythQuotes } from '../myths'
import { buildTable, type PageRecord } from '../table'
import { loadManifest } from '../../../manifest'
import pageMap from '../table/data/msb-pages.json?raw'
import { lang } from '../../content'
import { RoomBatch, stamp } from './build'
import { collectionExhibitMaterials, collectionInteriorMaterial, collectionProceduralStack } from './materials'
import { COURT, FLOOR, GRAVE_ORIGIN, LINE_ORIGIN, PARACHUTE_ORIGIN } from './layout'
import { mountCollectionPlates, type CollectionPictureSource } from './plates'

interface Stand { east: number; north: number; bearing: number; plinth: number }

/** Where each machine stands in the hall, and which way it faces. The three
 * dimensions that are Leonardo's own are the screw's, the parachute's and
 * the crossbow's; every other size here is the module's declared envelope,
 * and the plinth is sized off that envelope and nothing else. */
const HALL: Record<MachineSlug, Stand> = {
  'aerial-screw': { east: -51.5, north: -49, bearing: 0, plinth: .12 },
  'revolving-crane': { east: -59.2, north: -46, bearing: 28, plinth: .16 },
  'ball-bearing': { east: -59.6, north: -50.3, bearing: 0, plinth: .62 },
  'camera-obscura': { east: -59.4, north: -52.9, bearing: 104, plinth: .3 },
  'anemometer': { east: -57.9, north: -42.95, bearing: 8, plinth: .72 },
  'inclinometer': { east: -56.2, north: -42.95, bearing: -6, plinth: .72 },
  'proportional-compass': { east: -54.6, north: -42.95, bearing: 4, plinth: .78 },
  'miter-lock-gates': { east: -44.4, north: -46.4, bearing: -22, plinth: .18 },
  'multi-barrel-gun': { east: -42.6, north: -50.6, bearing: 208, plinth: .16 },
  'water-lifting-screw': { east: -41.9, north: -53.6, bearing: 90, plinth: .16 },
  'lathe': { east: -46.2, north: -52.9, bearing: 12, plinth: .2 },
  'flywheel': { east: -45.8, north: -48.8, bearing: 0, plinth: .26 },
  'rolling-mill': { east: -47.4, north: -44.2, bearing: -24, plinth: .34 },
  // The parachute is 10.34 m tall and the tallest room here is 6.61 m, so it
  // stands outside in the court on the module's own four uprights.
  'parachute': { east: PARACHUTE_ORIGIN.east, north: PARACHUTE_ORIGIN.north, bearing: 18, plinth: .1 },
}

export interface CollectionExhibits {
  update(seconds: number, delta: number, eye: Vector3): void
  /** Build the hall before the camera is in it (an inspection eye). */
  warm(): void
  dispose(): void
  ready: Promise<void>
  pending(): number
  pictureSources(): readonly CollectionPictureSource[]
  pictureErrors(): readonly string[]
}

export function mountCollectionExhibits(host: Group, stack: Stack): CollectionExhibits {
  const machines: { build: ReadyMachineBuild; indoors: boolean }[] = []
  const plinths = new RoomBatch()
  const material = collectionInteriorMaterial()
  const pictures = mountCollectionPlates(host, stack)
  let live = true, halled = false, seconds = 0, delta = 0
  let reading: ReturnType<typeof buildTable> | undefined
  const teardown: (() => void)[] = []
  // The court's exhibit stands outdoors and is seen from every station on
  // this ground, so it is built at once and dressed from this module's own
  // recipe rather than from the library the page has already spent.
  const courtStack = collectionProceduralStack(stack)
  let plinthMesh = plinths.mesh('vinci/collection-rooms/plinths', material)
  host.add(plinthMesh)

  /** The library's budget belongs to the whole page, and this wing arrives at
   * the standard tier with its own sets already resident. A machine's set is
   * asked for at the smallest size the library offers before any machine asks
   * for it at the tier's, because a cached set keeps the maps it was loaded
   * with. The wait at the head is the house's own loads: they must finish at
   * their full size before this one narrows the budget. */
  async function seed(names: string[]): Promise<void> {
    const deadline = Date.now() + 20000
    while (stack.materials.pending() > 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    if (!live) return
    stack.materials.setTier({ ...stack.tierConfig(), detail: 1 })
    try { await Promise.allSettled(names.map(name => stack.materials.load(name))) }
    finally { stack.materials.setTier(stack.tierConfig()) }
  }

  function stand(slug: MachineSlug): ReadyMachineBuild {
    const spot = HALL[slug], outdoors = slug === 'parachute'
    const level = outdoors ? COURT.level : FLOOR
    const machine = buildMachine(slug, outdoors ? courtStack : stack)
    machines.push({ build: machine, indoors: !outdoors })
    const size = machine.bounds.getSize(new Vector3())
    const centre = machine.bounds.getCenter(new Vector3())
    const angle = spot.bearing * Math.PI / 180
    machine.object.rotation.y = angle
    machine.object.position.set(spot.east, level + spot.plinth - machine.bounds.min.y, -spot.north)
    machine.object.updateMatrixWorld(true)
    machine.object.visible = outdoors
    stamp(machine.object, `vinci/machine/${slug}`)
    host.add(machine.object)
    machine.animate(seconds, delta)
    if (outdoors) {
      // THE COURT'S EXHIBIT KEEPS ITS SHADOW WITHOUT COSTING THE WALK ONE.
      // The wing reuses one rendered shadow map while every caster in the
      // scene is a material it has proved static; a machine's own material
      // graph is not one of those, and one visible caster re-renders the
      // map on every frame of the whole walk. So the cloth casts through a
      // plain double three centimetres inside it, which the cloth hides.
      void machine.ready.then(() => machine.object.traverse(child => { child.castShadow = false }))
      const cloth = 6.86, sill = 3.32, apex = 10.24, cos = Math.cos(angle), sin = Math.sin(angle)
      const corner = (sx: number, sz: number): [number, number, number] => {
        const x = sx * cloth / 2, z = sz * cloth / 2
        return [spot.east + x * cos + z * sin, spot.north + x * sin - z * cos, level + sill]
      }
      const top: [number, number, number] = [spot.east, spot.north, level + apex]
      const feet: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      for (let i = 0; i < 4; i++) {
        const a = corner(feet[i]![0], feet[i]![1]), b = corner(feet[(i + 1) % 4]![0], feet[(i + 1) % 4]![1])
        plinths.quad(a, b, top, top, 2)
      }
      plinths.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), 2)
    }
    if (spot.plinth <= 0) return machine
    // The plinth is the exhibition's own furniture: the declared envelope
    // with a hand's width around it, and a shadow gap at the floor.
    const width = Math.abs(size.x * Math.cos(angle)) + Math.abs(size.z * Math.sin(angle)) + .34
    const depth = Math.abs(size.x * Math.sin(angle)) + Math.abs(size.z * Math.cos(angle)) + .34
    const east = spot.east + centre.x * Math.cos(angle) + centre.z * Math.sin(angle)
    const north = spot.north + centre.x * Math.sin(angle) - centre.z * Math.cos(angle)
    plinths.box(east, north, level + spot.plinth - .05, width, depth, .1, 2)
    plinths.box(east, north, level + (spot.plinth - .1) / 2, width - .16, depth - .16, spot.plinth - .1, 3)
    for (const box of mountBoxes(slug)) {
      plinths.box(spot.east + box.centre[0] * Math.cos(angle) + box.centre[2] * Math.sin(angle),
        spot.north + box.centre[0] * Math.sin(angle) - box.centre[2] * Math.cos(angle),
        level + spot.plinth + box.centre[1], box.size[0], box.size[2], box.size[1], 3)
    }
    return machine
  }

  function rebuildPlinths(): void {
    host.remove(plinthMesh)
    plinthMesh.geometry.dispose()
    plinthMesh = plinths.mesh('vinci/collection-rooms/plinths', material)
    host.add(plinthMesh)
  }

  /** THE HALL IS BUILT WHEN THE VISITOR IS IN IT. Fourteen machines hold a
   * library the whole page pays for and a shadow map the whole scene pays
   * for, and from outside this envelope not one of them can be seen: the
   * picture room's wall and two closed elevations stand in front of them.
   * The court's own exhibit stands outdoors and is built at once. */
  // THE LINE IS THE FLOOR OF THE LONG GALLERY, and the grave is the paving
  // of the court's west half: both bring their own ground with them, and the
  // rooms are cut around it. Both are built at once and from the rooms' own
  // procedural stones, so they cost the page no library and are visible
  // through the window wall from every station outside.
  const exhibitStones = collectionExhibitMaterials()
  const line = createCollectionLineFloor(exhibitStones, lang())
  line.position.set(LINE_ORIGIN.east, FLOOR + .01, -LINE_ORIGIN.north)
  stamp(line, 'vinci/collection-line-floor')
  host.add(line)
  const graveNear = new Vector3(-42, FLOOR, 46)
  /** The middle of the insertion, for the distance at which its rooms are
   * asked for and the distance at which their contents come back. */
  const hallNear = new Vector3(-46, FLOOR, 50)
  /** Where the reading table stands, for the two distances it answers to. */
  const TABLE_AT = new Vector3(-37.72, FLOOR + .755, 45.4)
  const rooms = host.getObjectByName('vinci/collection-rooms')
  const grave = createGrave(exhibitStones)
  fitCollectionExhibitFloor(grave.group, exhibitStones, 'grave')
  grave.group.rotation.y = Math.PI / 2
  grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)
  stamp(grave.group, 'vinci/grave-geometry')
  host.add(grave.group)

  // Nothing is seeded for the court: its exhibit asks the library for no
  // set, so there is no wait at the head of the page and the walk's one
  // shadow snapshot is taken with the exhibit already standing.
  const court = stand('parachute').ready
  rebuildPlinths()
  let hall: Promise<void> | undefined
  function warmHall(): void {
    if (hall || !live) return
    halled = true
    hall = court.then(() => seed(['bronze-dark', 'leather-worn', 'parchment-laid', 'limestone-pale'])).then(async () => {
      if (!live) return
      // ONE MACHINE PER TURN. Thirteen of them in a single tick is half a
      // minute of frozen frame, and the visitor is standing in the room next
      // door while it happens. The hall arrives while the walk goes on.
      for (const slug of MACHINE_SLUGS) {
        if (slug === 'parachute') continue
        stand(slug)
        await new Promise(resolve => setTimeout(resolve, 0))
        if (!live) return
      }
      // The hall's own fittings. The machines carry their bench's shading and
      // no opening in this room reaches them, so the luminaires on the beams
      // are lights here and not a term on a surface. They cast no shadow: the
      // one shadowing light in this scene is the measured sun.
      for (const [east, north] of [[-56.4, -45.2], [-47.2, -45.6], [-56.2, -51.4], [-46.4, -51.2], [-51.4, -58.6]]) {
        const fitting = new PointLight('#f4e6cc', 9.5, 15, 2)
        fitting.position.set(east!, FLOOR + 4.6, -north!)
        fitting.castShadow = false
        fitting.name = 'vinci/collection-rooms/hall-fitting'
        host.add(fitting)
        teardown.push(() => { fitting.removeFromParent(); fitting.dispose() })
      }
      // The corrections need six metres of clear height, and the hall is the
      // only room here that has them. Each stands on its own floor, and the
      // later one steps 60 mm over the earlier where the two floors meet.
      const deathbed = createMythDeathbed(exhibitStones)
      fitCollectionExhibitFloor(deathbed.group, exhibitStones, 'deathbed')
      deathbed.group.rotation.y = Math.PI
      deathbed.group.position.set(-57.5, FLOOR + .002, 63.2)
      stamp(deathbed.group, 'vinci/myths-geometry')
      const quotes = createMythQuotes(exhibitStones, { mobile: false, quoteIndex: 0 })
      fitCollectionExhibitFloor(quotes.group, exhibitStones, 'quotes')
      quotes.group.rotation.y = Math.PI
      quotes.group.position.set(-45.5, FLOOR + .062, 63.2)
      stamp(quotes.group, 'vinci/myths-geometry')
      host.add(deathbed.group, quotes.group)
      teardown.push(() => { deathbed.dispose(); quotes.dispose() })
      rebuildPlinths()
    })
  }
  /** THE TABLE IS THE LAST THING THIS PAGE CAN AFFORD, so it is built for the
   * visitor who is walking up to it and not for the whole ground. Its own
   * library sets are what carries the wing over its texture budget at every
   * station that cannot see it. */
  let table: Promise<void> | undefined
  function warmTable(): void {
    if (table || !live) return
    table = (hall ?? court).then(async () => {
      if (!live) return
      const manifest = await loadManifest()
      if (!live) return
      const built = buildTable(stack, (JSON.parse(pageMap) as { pages: PageRecord[] }).pages, manifest)
      // The table brings a back wall of its own, because its bench had none.
      // It stands against the gallery's west wall, so that wall is the one it
      // brings: the reader faces it with the window elevation behind them.
      // Its own back wall, 4.4 by 2.2 m a metre behind the book, is set
      // flush with the gallery's west lining, so the panel the bench needed
      // becomes the panelling of the alcove the table stands in.
      built.object.rotation.y = Math.PI / 2
      built.object.position.set(-37.72, FLOOR + .755, 45.4)
      stamp(built.object, 'vinci/table-furniture')
      host.add(built.object)
      // The reading lamp on the table is emissive geometry: it shows that it
      // is lit, it does not light the book. The room's own fitting over the
      // table does that, and it is the one luminaire in this insertion that
      // is a light and not a term on a surface, because the object under it
      // is not this module's to shade.
      const lamp = new PointLight('#ffcf92', 5.2, 5.4, 2)
      lamp.position.set(-37.55, FLOOR + 1.34, 45.3)
      lamp.castShadow = false
      lamp.name = 'vinci/collection-rooms/reading-lamp'
      host.add(lamp)
      teardown.push(() => { lamp.removeFromParent(); lamp.dispose() })
      // THE GALLERY HAS ITS OWN FITTINGS TOO. The hall got five and this room
      // got none, so the two rooms a visitor reads closest, the alcove and the
      // wall of sheets, stood a stop and a half under the rest of the
      // insertion. Like the hall's, they cast no shadow: the one shadowing
      // light in this scene is the measured sun.
      for (const [east, north, reach] of [[-35.6, -46.2, 13], [-32.4, -50.6, 12], [-31.6, -58.4, 13]]) {
        const fitting = new PointLight('#f4e6cc', 7.4, reach!, 2)
        fitting.position.set(east!, FLOOR + 3.9, -north!)
        fitting.castShadow = false
        fitting.name = 'vinci/collection-rooms/gallery-fitting'
        host.add(fitting)
        teardown.push(() => { fitting.removeFromParent(); fitting.dispose() })
      }
      reading = built
      teardown.push(() => { built.dispose() })
    })
  }

  return {
    ready: Promise.all([court.then(() => hall ?? Promise.resolve()).then(() => table ?? Promise.resolve()), pictures.ready]).then(() => undefined),
    pending: () => (halled && !machines.some(machine => machine.indoors) ? 1 : 0) + pictures.pending(),
    pictureSources: pictures.sources,
    pictureErrors: pictures.errors,
    warm: warmHall,
    update(now, step, eye) {
      if (!live) return
      seconds = now; delta = step
      pictures.update(step, eye)
      // A ROOM THE CAMERA IS NOT IN IS NOT DRAWN.
      // The envelope itself, not the ground around it: the garden station
      // stands on the apron three metres north of the north elevation, and a
      // margin that caught it built the hall for the whole of the rest of the
      // walk.
      // A ROOM THE CAMERA IS NOT IN IS NOT DRAWN, and a room the camera is
      // walking towards is already being built: the rail stands stations
      // inside these rooms, and a build that starts at the threshold is a
      // build the visitor waits through.
      const inside = eye.x > -62.4 && eye.x < -21.6 && eye.z > 34.4 && eye.z < 63.6 && eye.y < -1.9
      if (inside || eye.distanceToSquared(hallNear) < 46 * 46) warmHall()
      // AND THE GROUND ITSELF IS DRAWN WHEN IT IS BEING LOOKED AT. From the
      // street and the court of the house this ground is seventy metres off
      // and every exhibit on it is a few pixels wide; the rooms stay, their
      // contents come back at the distance a visitor can read them.
      const near = eye.distanceToSquared(graveNear) < 54 * 54
      if (rooms && rooms.visible !== near) rooms.visible = near
      if (line.visible !== near) line.visible = near
      if (grave.group.visible !== near) grave.group.visible = near
      // The reading table is read at the table, not from the next room.
      const toTable = eye.distanceToSquared(TABLE_AT)
      if (toTable < 22 * 22) warmTable()
      const atTable = near && toTable < 16 * 16
      if (reading && reading.object.visible !== atTable) reading.object.visible = atTable
      // A MACHINE IS DRAWN WHERE IT CAN BE SEEN AND READ. The hall's fourteen
      // are behind the hanging wall and two closed elevations: from the
      // picture room, the gallery or the court not one of them is in the
      // room the visitor is standing in, and at the far end of a
      // twenty-two metre hall a machine is a few pixels of itself. The rail
      // now stands stations inside these rooms, so this is the difference
      // between a walk and a frame that draws the whole ground at once.
      const inHall = eye.x > -62.4 && eye.x < -38.6 && eye.z > 41.8 && eye.z < 64.2 && eye.y < -1.9
      for (const machine of machines) {
        const visible = machine.indoors
          ? inHall && eye.distanceToSquared(machine.build.object.position) < 14 * 14
          : near
        if (machine.build.object.visible !== visible) machine.build.object.visible = visible
        if (visible) machine.build.animate(now, step)
      }
      reading?.update(now * 1000)
    },
    dispose() {
      live = false
      pictures.dispose()
      for (const machine of machines) machine.build.dispose()
      for (const strike of teardown) strike()
      grave.dispose()
      const lineMaterials = new Set<Material>()
      line.traverse(object => {
        if (!(object instanceof Mesh)) return
        object.geometry.dispose()
        for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
          if (surface.userData['owned']) lineMaterials.add(surface)
        }
      })
      for (const surface of lineMaterials) surface.dispose()
      for (const stone of Object.values(exhibitStones)) stone.dispose()
      material.dispose()
      plinthMesh.geometry.dispose()
    },
  }
}
