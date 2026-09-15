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
import { createCollectionLineFloor, fitCollectionExhibitFloor } from './line-floor'
import { createGrave } from '../grave'
import { createMythDeathbed, createMythQuotes } from '../myths'
import { buildTable, type PageRecord } from '../table'
import { loadManifest } from '../../../manifest'
import pageMap from '../table/data/msb-pages.json?raw'
import { lang } from '../../content'
import { stamp } from './build'
import { collectionExhibitMaterials, collectionInteriorMaterial, collectionProceduralStack } from './materials'
import { COURT, FLOOR, GRAVE_ORIGIN, LINE_ORIGIN } from './layout'
import { createCollectionStandSolids, standLevel, STANDS, type StandGround } from './stands'
import { mountCollectionPlates, type CollectionPictureSource } from './plates'

/** Which ground each machine is built with, and when. The court's own
 * exhibit is built at once because it is seen from every station on this
 * ground; the rest arrive as the visitor walks up to them. */
const GROUNDS: readonly StandGround[] = ['court', 'hall', 'house']

export interface CollectionExhibits {
  update(seconds: number, delta: number, eye: Vector3): void
  /** Build the hall before the camera is in it (an inspection eye). */
  warm(): void
  /** NO MACHINE ANIMATES WHILE THE VISITOR WALKS. Each stands in the pose its
   * own schedule has at t=0. The close-look host names the one machine whose
   * clock may run, and `null` puts every machine back at rest. */
  demonstrate(slug: MachineSlug | null): void
  dispose(): void
  ready: Promise<void>
  pending(): number
  pictureSources(): readonly CollectionPictureSource[]
  pictureErrors(): readonly string[]
  /** The room's own sources, separately from the whole ground: the close
   * look's registry is a read over these meshes. */
  picturesReady: Promise<unknown>
}

export function mountCollectionExhibits(host: Group, stack: Stack): CollectionExhibits {
  const machines: { build: ReadyMachineBuild; slug: MachineSlug; ground: StandGround; at: Vector3; reach: number }[] = []
  const material = collectionInteriorMaterial()
  const pictures = mountCollectionPlates(host, stack)
  let live = true
  let demonstrating: MachineSlug | null = null
  const warmed = new Set<StandGround>()
  let reading: ReturnType<typeof buildTable> | undefined
  const teardown: (() => void)[] = []
  // The court's exhibit stands outdoors and is seen from every station on
  // this ground, so it is built at once and dressed from this module's own
  // recipe rather than from the library the page has already spent.
  const courtStack = collectionProceduralStack(stack)
  // THE PLINTHS AND BASES ARE ONE FIXED BODY, built from the same function
  // the clearance certificate is written against: it is complete before the
  // first frame and never waits for a machine to finish loading.
  const plinthMesh = createCollectionStandSolids(material)
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
    const spot = STANDS[slug], level = standLevel(spot.ground)
    const machine = buildMachine(slug, spot.ground === 'court' && slug === 'parachute' ? courtStack : stack)
    machine.object.rotation.y = spot.bearing * Math.PI / 180
    machine.object.position.set(spot.east, level + spot.plinth - machine.bounds.min.y, -spot.north)
    machine.object.updateMatrixWorld(true)
    machine.object.visible = false
    // A MACHINE IS DRAWN AT THE DISTANCE ITS OWN SIZE CAN BE READ FROM. Nine
    // metres of screw is the hall's landmark and a bearing is a hand's width:
    // one radius for both leaves the hall's far end empty from its own door
    // and draws three court exhibits from the house, fifty metres away with
    // the whole building between.
    machines.push({ build: machine, slug, ground: spot.ground,
      at: new Vector3(spot.east, level + spot.plinth, -spot.north),
      reach: Math.max(14, 3.2 * machine.bounds.getSize(new Vector3()).length()) })
    stamp(machine.object, `vinci/machine/${slug}`)
    host.add(machine.object)
    // THE REST POSE IS THE POSE AT t=0 of this machine's own schedule.
    machine.animate(0, 0)
    // A VISIBLE CASTER WHOSE MATERIAL GRAPH THE SHADOW CACHE HAS NOT PROVED
    // STATIC RE-RENDERS THE WHOLE SHADOW MAP ON EVERY FRAME OF THE WALK, and
    // a machine's own graph is not one of those. The court's cloth casts
    // through a plain double three centimetres inside it, which it hides.
    void machine.ready.then(() => machine.object.traverse(child => { child.castShadow = false }))
    return machine
  }

  /** A GROUND IS BUILT WHEN THE VISITOR IS WALKING UP TO IT. Nine machines
   * hold a library the whole page pays for, and from outside the hall's
   * envelope not one of them can be seen: the picture room's wall and two
   * closed elevations stand in front of them. The court's cloth is the one
   * exhibit built at once, because it is seen from the whole ground. */
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
  /** The house's own court, where the compass stands. */
  const HOUSE_AT = new Vector3(STANDS['proportional-compass'].east, 0, -STANDS['proportional-compass'].north)
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
  warmed.add('court')
  /** One promise per ground, so a ground is built once and in its own turn. */
  const built = new Map<StandGround, Promise<void>>()
  function warmGround(ground: StandGround): Promise<void> {
    const already = built.get(ground)
    if (already) return already
    warmed.add(ground)
    // ONE MACHINE PER TURN. Nine of them in a single tick is half a minute of
    // frozen frame, and the visitor is standing in the room next door while
    // it happens. The ground arrives while the walk goes on.
    const work = court.then(() => seed(['bronze-dark', 'leather-worn', 'parchment-laid', 'limestone-pale'])).then(async () => {
      for (const slug of MACHINE_SLUGS) {
        if (!live) return
        if (slug === 'parachute' || STANDS[slug].ground !== ground) continue
        stand(slug)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    })
    built.set(ground, work)
    return work
  }
  // THE COURT IS BUILT WITH THE PAGE. Its three exhibits stand under the open
  // sky and are read from every station on this ground, so a build that waits
  // for the visitor to walk up to them is a build that arrives after the
  // frame. They still queue behind the house's own library loads.
  const courtGround = warmGround('court')
  let hall: Promise<void> | undefined
  function warmHall(): void {
    if (hall || !live) return
    hall = warmGround('hall').then(async () => {
      if (!live) return
      // The hall's own fittings. The machines carry their bench's shading and
      // no opening in this room reaches them, so the luminaires on the beams
      // are lights here and not a term on a surface. They cast no shadow: the
      // one shadowing light in this scene is the measured sun.
      for (const [east, north] of [[-51, -44], [-47.2, -45.6], [-56.2, -51.4], [-46.4, -51.2], [-51.4, -58.6]]) {
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
      // Keep the bench's south edge and shorten only the north end. At the
      // mounted bearing the 3.25 m panel ends at north -44.35, 150 mm short
      // of the hall door's south reveal at -44.2.
      const backWall = built.object.getObjectByName('reading-room-wall')
      if (!(backWall instanceof Mesh)) throw new Error('The reading table has no back wall')
      backWall.scale.x = 3.25 / 4.4
      backWall.position.x = -.575
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
    ready: Promise.all([court.then(() => courtGround).then(() => hall ?? Promise.resolve()).then(() => table ?? Promise.resolve()), pictures.ready]).then(() => undefined),
    pending: () => [...warmed].filter(ground => !machines.some(machine => machine.ground === ground)).length + pictures.pending(),
    pictureSources: pictures.sources,
    pictureErrors: pictures.errors,
    picturesReady: pictures.ready,
    warm: warmHall,
    demonstrate(slug) { demonstrating = slug },
    update(now, step, eye) {
      if (!live) return
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
      // The court's three standing exhibits and the compass in the house are
      // built on the way to them, not at the head of the page: each ground is
      // asked for at the distance a visitor can still be walked up to it.
      if (eye.distanceToSquared(HOUSE_AT) < 26 * 26) void warmGround('house')
      // AND THE GROUND ITSELF IS DRAWN WHEN IT IS BEING LOOKED AT. From the
      // street and the court of the house this ground is fifty metres off
      // with the whole building between; the rooms stay, their contents come
      // back at the distance a visitor can read them. The four house stations
      // share one eye 52.2 m from here and the garden stands at 23.0 m, so
      // the radius sits between them.
      const near = eye.distanceToSquared(graveNear) < 48 * 48
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
        const reach = eye.distanceToSquared(machine.at) < machine.reach * machine.reach
        const visible = machine.ground === 'hall' ? inHall && reach
          : machine.ground === 'house' ? reach
          : near && reach
        if (machine.build.object.visible !== visible) machine.build.object.visible = visible
        // ONE CLOCK RUNS AT A TIME, and only for the machine a close look has
        // been asked for. Everything else stands in its rest pose, which is
        // what lets the walk keep one shadow map and one certificate.
        if (visible && machine.slug === demonstrating) machine.build.animate(now, step)
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
