/** The benches' objects, stood in the rooms.
 *
 * Every object here is imported UNCHANGED from the bench that built it and
 * judged it: `machines/` by `buildMachine(slug, stack)`, `line/`, `table/`,
 * `grave/` by their own factories. This module owns where they stand, what
 * they stand on and which way they face, and nothing else.
 */
import { Group, Mesh, MeshStandardNodeMaterial, PointLight, Vector3, type Material, type Object3D, type PlaneGeometry, type Scene } from 'three/webgpu'
import { translucentCloth } from './hall-cloth'
import type { Stack } from '../../../stack'
import { buildMachine, MACHINE_SLUGS, type MachineSlug } from '../machines'
import type { ReadyMachineBuild } from '../machines/runtime'
import { createCollectionLineFloor, fitCollectionExhibitFloor } from './line-floor'
import { createCourtPlaque, COURT_PLAQUE_STAND } from './court-plaque'
import { createGrave, createGraveDeathbed } from '../grave'
import { loadPlate, PLATES } from '../line/bench/assets'
import { buildTable, type PageRecord } from '../table'
import { loadManifest } from '../../../manifest'
import pageMap from '../table/data/msb-pages.json?raw'
import { lang } from '../../content'
import { stamp } from './build'
import { collectionExhibitMaterials, collectionInteriorMaterial, collectionProceduralStack } from './materials'
import { COURT, FLOOR, GRAVE_ORIGIN, LINE_ORIGIN } from './layout'
import { createCollectionStandSolids, standLevel, STANDS, standOf, type StandGround } from './stands'
import { mountCollectionPlates, type CollectionPictureSource } from './plates'
import { HALL_FILL, mountHallLight } from './hall-light'
import { mountHallFabric } from './hall-fabric'
import { mountHallAir } from './hall-air'
import { VINCI_READING_TABLE } from './approaches'
import type { BodySheetSource } from './body-wall'
import { mountReadingRoom, type ReadingRoom } from './reading-room'

/** How thick the hall's air is: a haze a spot's shaft is seen in, no more. */
const HALL_AIR_DENSITY = .085

/** Which ground each machine is built with. Every ground is built at entry,
 * the court's first because it is seen from every station on this ground. */
const GROUNDS: readonly StandGround[] = ['court', 'hall', 'house']

export interface CollectionExhibits {
  update(seconds: number, delta: number, eye: Vector3): void
  /** Build the hall before the camera is in it (an inspection eye). */
  warm(): void
  /** NO MACHINE ANIMATES WHILE THE VISITOR WALKS. Each stands in the pose its
   * own schedule has at t=0. The close-look host names the one machine whose
   * clock may run, and `null` puts every machine back at rest. */
  demonstrate(slug: MachineSlug | null): void
  /** Release the room's one full plate while a payload holds the stage
   * (true), and let the room choose again once it lets go (false). */
  holdPlates(release: boolean): void
  /** Where the room's one full plate measures its near rule from while a run
   * along the wall is under way, and `null` when the body is the eye again. */
  aimPlates(eye: Vector3 | null): void
  dispose(): void
  ready: Promise<void>
  /** THE ENTRY'S OWN COUNT. Every body this module builds before the wing's
   * first frame, and how many of them stand: the machines of all three
   * grounds, the reading table, the grave's reproduction and the pictures on
   * the walls. The field over the entry shows this and never a clock. */
  bodies(): { done: number; total: number }
  pending(): number
  pictureSources(): readonly CollectionPictureSource[]
  /** The body wall's own records, for the row that names every sheet. */
  sheetSources(): readonly BodySheetSource[]
  /** What can no longer arrive: a picture, or a ground whose own build failed. */
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
  /** the hall's rig, once it stands; a machine is only ever ready after it */
  let hallRig: { adopt(surface: Material): void; release(surface: Material): void } | undefined
  /** which hall machines are lit by the hall's rig right now */
  const hallLit = new Map<ReadyMachineBuild, boolean>()
  function lightHallMachine(machine: ReadyMachineBuild, inHall: boolean): void {
    machine.object.traverse(child => {
      if (!(child instanceof Mesh)) return
      for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
        if (inHall) hallRig?.adopt(surface)
        else hallRig?.release(surface)
      }
    })
  }
  /* A GROUND IS IN FLIGHT UNTIL ITS OWN BUILD HAS SETTLED, not until a
     machine stands on it: the house is warmed and carries no machine. Each
     machine it asked for is counted by the machine registry from then on. */
  const building = new Set<StandGround>()
  const groundErrors: string[] = []
  /* Counted, never timed: each of these rises once and never falls, and a
     body whose own build FAILED still counts as settled, or the count would
     stand short of its total for the rest of the entry. */
  let machinesUp = 0, tableUp = 0, deathbedUp = 0, picturesAsked = 0, picturesUp = 0
  const machineUp = (): void => { machinesUp++ }
  let reading: ReturnType<typeof buildTable> | undefined
  /** The room round the reading table, and how many takes of its bounce are
   * still owed: a take is drawn in a frame of its own, never in a build. */
  let readingRoom: ReadingRoom | undefined, roomBakes = 0
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
    const spot = standOf(slug), level = standLevel(spot.ground)
    const machine = buildMachine(slug, spot.ground === 'court' && slug === 'parachute' ? courtStack : stack)
    machine.object.rotation.y = spot.bearing * Math.PI / 180
    machine.object.position.set(spot.east, level + spot.plinth - machine.bounds.min.y, -spot.north)
    machine.object.updateMatrixWorld(true)
    machine.object.visible = false
    machine.object.userData['naWarm'] = true
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
    // The hall's machines keep their casts: its own spots draw their maps, and
    // the sun cannot reach inside the hall to be re-rendered for them.
    if (spot.ground !== 'hall') void machine.ready.then(() => machine.object.traverse(child => { child.castShadow = false }))
    // A machine in the hall is lit by the hall's own rig while it stands in
    // the hall; `update` hands it back while the close look borrows it.
    else void machine.ready.then(() => {
      // the screw's sail is a thin cloth: a light behind it shows through it
      if (slug === 'aerial-screw') machine.object.traverse(child => {
        if (!(child instanceof Mesh) || Array.isArray(child.material)) return
        if (/linen/.test(child.material.name) && !/thread/.test(child.material.name) && child.material instanceof MeshStandardNodeMaterial) {
          const thick = child.material
          child.material = translucentCloth(thick)
          teardown.push(() => { child.material.dispose(); thick.dispose() })
          if (new URLSearchParams(location.search).has('hallrig')) console.warn(`hall cloth: ${thick.name} made thin`)
        }
      })
      hallLit.set(machine, true)
      lightHallMachine(machine, true)
    })
    void machine.ready.then(machineUp, machineUp)
    return machine
  }

  /** A GROUND IS DRAWN WHERE IT CAN BE SEEN. From outside the hall's envelope
   * not one of its machines can be seen: the picture room's wall and two
   * closed elevations stand in front of them. So every machine is built at
   * entry and hidden, and `update` shows it by distance. */
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
  /** Where the reading table stands, for the distance it is drawn at. */
  const TABLE_AT = new Vector3(VINCI_READING_TABLE.east, VINCI_READING_TABLE.top, -VINCI_READING_TABLE.north)
  const tableReach = stack.tierName() === 'hero' ? 18.5 : 16
  const rooms = host.getObjectByName('vinci/collection-rooms')
  // The bench's phone restaging moves the diagram frame in front of the
  // deathbed painting hung on this backdrop, so the wing keeps the one
  // composition both viewports hold whole and takes only the language.
  const grave = createGrave(exhibitStones, lang())
  fitCollectionExhibitFloor(grave.group, exhibitStones, 'grave')
  grave.group.rotation.y = Math.PI / 2
  grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)
  stamp(grave.group, 'vinci/grave-geometry')
  host.add(grave.group)
  // THE PAINTING OF THE KING AT THE BEDSIDE HANGS HERE, and the frame is built
  // inside the plate's own promise: a reproduction that never arrives leaves
  // the wall bare instead of standing an empty frame in front of a visitor.
  let deathbedArrived: () => void = () => {}
  const deathbed = new Promise<void>(resolve => { deathbedArrived = resolve })
  void loadPlate(PLATES.ingres, stack.tierName()).then(plate => {
    if (!live) { plate.texture.dispose(); return }
    const hung = createGraveDeathbed(exhibitStones, plate.texture, plate.entry.id, lang())
    grave.group.add(hung.group)
    teardown.push(() => { hung.dispose(); plate.texture.dispose() })
  }).catch((error: unknown) => console.error(`The grave's reproduction did not arrive: ${String(error)}`))
    .finally(() => { deathbedUp = 1; deathbedArrived() })

  // THE FLIGHT QUOTATION STANDS BESIDE THE FLIGHT MACHINE. One plaque on the
  // court's paving, built with the page like the cloth beside it, because it
  // is read from the display wall's own station.
  const plaque = createCourtPlaque(exhibitStones, lang())
  plaque.group.rotation.y = COURT_PLAQUE_STAND.bearing * Math.PI / 180
  plaque.group.position.set(COURT_PLAQUE_STAND.east, COURT.level, -COURT_PLAQUE_STAND.north)
  stamp(plaque.group, 'vinci/court-plaque')
  host.add(plaque.group)

  // Nothing is seeded for the court: its exhibit asks the library for no
  // set, so there is no wait at the head of the page and the walk's one
  // shadow snapshot is taken with the exhibit already standing.
  const court = stand('parachute').ready
  /** One promise per ground, so a ground is built once and in its own turn. */
  const built = new Map<StandGround, Promise<void>>()
  function warmGround(ground: StandGround): Promise<void> {
    const already = built.get(ground)
    if (already) return already
    building.add(ground)
    // ONE MACHINE PER TURN. Nine of them in a single tick is half a minute of
    // frozen frame; behind the entry's field it is a wait, never a stall.
    const work = court.then(() => seed(['bronze-dark', 'leather-worn', 'parchment-laid', 'limestone-pale'])).then(async () => {
      for (const slug of MACHINE_SLUGS) {
        if (!live) return
        if (slug === 'parachute' || STANDS[slug]?.ground !== ground) continue
        stand(slug)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    })
    built.set(ground, work)
    // A build that fails is settled and named, never a count that hangs.
    void work.then(() => { building.delete(ground) }, (error: unknown) => {
      building.delete(ground)
      const said = `ground ${ground}: ${error instanceof Error ? error.message : String(error)}`
      groundErrors.push(said)
      console.error(`The ${ground}'s exhibits were not all stood: ${said}`)
    })
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
    // THE HALL'S SOUTH END CARRIES NO EXHIBIT. The corrections stood here
    // and the walk no longer holds a station for them: the shell stays, and
    // the words went where each of their subjects stands.
    hall = warmGround('hall')
  }
  /** THE TABLE is built last, after the hall, and drawn only at the table. */
  let table: Promise<void> | undefined
  function warmTable(): void {
    if (table || !live) return
    table = (hall ?? court).then(async () => {
      if (!live) return
      const manifest = await loadManifest()
      if (!live) return
      const built = buildTable(stack, (JSON.parse(pageMap) as { pages: PageRecord[] }).pages, manifest)
      built.object.visible = false
      built.object.userData['naWarm'] = true
      // The table brings a back wall of its own, because its bench had none.
      // It stands against the gallery's west wall, so that wall is the one it
      // brings: the reader faces it with the window elevation behind them.
      // THE PANEL IS CENTRED ON THE TABLE, at the length the table's own place
      // is derived from, so the book and its lamp stand in the middle of the
      // brown and neither end of the top overhangs it.
      const backWall = built.object.getObjectByName('reading-room-wall')
      if (!(backWall instanceof Mesh)) throw new Error('The reading table has no back wall')
      backWall.scale.x = VINCI_READING_TABLE.panelWidthM / (backWall.geometry as PlaneGeometry).parameters.width
      backWall.position.x = 0
      // The reading room brings the wall now: the table's own panel stands
      // behind the room's panelling, out of sight.
      backWall.visible = false
      built.object.rotation.y = Math.PI / 2
      built.object.position.set(VINCI_READING_TABLE.east, VINCI_READING_TABLE.top, -VINCI_READING_TABLE.north)
      stamp(built.object, 'vinci/table-furniture')
      host.add(built.object)
      reading = built
      teardown.push(() => { built.dispose() })
      // THE READING ROOM stands round the table the moment the table does, and
      // lights it: its lamp, its bounce and the shadows of its top.
      // A room that cannot stand says so and leaves the table standing.
      try {
        const room = mountReadingRoom(stack, host)
        ;(rooms ?? host).add(room.group)
        room.embrace(built.object)
        readingRoom = room
        roomBakes = 1
        teardown.push(() => { room.dispose() })
        // the bounce is read again once its oak and the page have arrived,
        // twice, so the bounce carries a bounce of its own
        void Promise.all([room.ready, built.ready()]).then(() => { if (live) roomBakes = 2 }, () => { if (live) roomBakes = 2 })
      } catch (error) {
        console.error(`The reading room did not stand: ${String(error)}`)
      }
    })
    const settled = (): void => { tableUp = 1 }
    void table.then(settled, settled)
  }

  /* THE WALK CREATES NOTHING. A body, a material or a light that first
   * appears in the middle of a leg is a node graph, a pipeline and a buffer
   * built inside the frame that needed it, and a light that joins the scene
   * relinks every lit surface in view. So every luminaire of the insertion
   * stands from the first frame (each reaches fifteen metres at most and the
   * house stands fifty away, so no pixel it cannot reach changes), every
   * ground and the table are built at entry, and the entry's warm up waits
   * for them before its sweep draws each of them once. What a station draws
   * is still decided by distance, below. */
  const FITTINGS: readonly [string, number, number, number, number, number, string][] = [
    // The hall's own fittings. The machines carry their bench's shading and
    // no opening in this room reaches them, so the luminaires on the beams
    // are lights here and not a term on a surface.
    ...[[-51, -44], [-47.2, -45.6], [-56.2, -51.4], [-46.4, -51.2], [-51.4, -58.6]]
      .map(([east, north]) => ['hall-fitting', east!, north!, FLOOR + 4.6, 9.5, 15, '#f4e6cc'] as [string, number, number, number, number, number, string]),
    // THE GALLERY HAS ITS OWN FITTINGS TOO, or the alcove and the wall of
    // sheets stand a stop and a half under the rest of the insertion.
    ...[[-35.6, -47, 13], [-32.4, -50.6, 12], [-31.6, -58.4, 13]]
      .map(([east, north, reach]) => ['gallery-fitting', east!, north!, FLOOR + 3.9, 7.4, reach!, '#f4e6cc'] as [string, number, number, number, number, number, string]),
  ]
  // None casts a shadow: the one shadowing light in this scene is the measured sun.
  const hallFittings: PointLight[] = []
  for (const [name, east, north, height, intensity, reach, colour] of FITTINGS) {
    const fitting = new PointLight(colour, intensity, reach, 2)
    if (name === 'hall-fitting') hallFittings.push(fitting)
    fitting.position.set(east, height, -north)
    fitting.castShadow = false
    fitting.name = `vinci/collection-rooms/${name}`
    host.add(fitting)
    teardown.push(() => { fitting.removeFromParent(); fitting.dispose() })
  }
  // THE HALL IS LIT BY ITS OWN RIG: its spots and the room's own bounce. The
  // sun's two cascades, the sky's flat fill and the unshadowed fittings stay
  // with the rest of the wing.
  let root: Object3D = host
  while (root.parent) root = root.parent
  const hallLight = mountHallLight(host, [], stack.renderer, root as Scene)
  hallRig = hallLight
  teardown.push(() => { hallLight.dispose() })
  // The hall's finish rides with the rooms, so it is drawn when they are.
  const hallFabric = mountHallFabric(stack, hallLight.adopt)
  ;(rooms ?? host).add(hallFabric.group)
  teardown.push(() => { hallFabric.group.removeFromParent(); hallFabric.dispose() })
  // The hall's air is drawn only while the eye stands in the hall.
  const hallAir = mountHallAir(root as Scene, hallLight.shadowed.filter(light => !/clerestory/.test(light.name)), HALL_AIR_DENSITY)
  hallAir.mesh.visible = false
  host.add(hallAir.mesh)
  teardown.push(() => { hallAir.mesh.removeFromParent(); hallAir.dispose() })
  warmHall()
  /* THE ROOM'S BOUNCE IS TAKEN ONCE THE HALL STANDS: every machine in it
     built and dressed and the finish's photographs on the GPU. Twice, so the
     bounce carries a bounce of its own. */
  let bakes = 0
  const hallStands = (): void => { bakes = 2 }
  void Promise.all([hall, hallFabric.ready.catch(() => undefined)])
    .then(() => Promise.allSettled(machines.filter(machine => machine.ground === 'hall').map(machine => machine.build.ready)))
    .then(hallStands, hallStands)
  const house = warmGround('house')
  warmTable()
  /** Every body the walk can show, standing with its materials resolved. */
  const standing = Promise.all([courtGround, hall, house, table]).then(() =>
    Promise.all([...machines.map(machine => machine.build.ready), reading?.ready(), deathbed, pictures.ready, readingRoom?.ready]))
  stack.hold(standing)
  for (const body of [rooms, line, grave.group, plaque.group]) if (body) body.userData['naWarm'] = true

  /** The walls' pictures are only countable once the manifest names them, so
   * they are read as what is still outstanding against the most that was ever
   * outstanding at once. Both halves are held at their own high water mark,
   * so a total that grows never pushes the count backwards. */
  function pictureBodies(): { done: number; total: number } {
    const left = pictures.pending()
    picturesAsked = Math.max(picturesAsked, picturesUp + left)
    picturesUp = Math.max(picturesUp, picturesAsked - left)
    return { done: picturesUp, total: picturesAsked }
  }

  return {
    bodies() {
      const plates = pictureBodies()
      return {
        done: machinesUp + tableUp + deathbedUp + plates.done,
        // the reading table and the grave's reproduction are one body each
        total: MACHINE_SLUGS.length + 1 + 1 + plates.total,
      }
    },
    ready: Promise.all([court.then(() => courtGround).then(() => hall ?? Promise.resolve()).then(() => table ?? Promise.resolve()), pictures.ready]).then(() => undefined),
    pending: () => building.size + pictures.pending() + (readingRoom?.pending() ?? 0) + roomBakes,
    pictureSources: pictures.sources,
    sheetSources: pictures.sheets,
    pictureErrors: () => [...pictures.errors(), ...groundErrors],
    picturesReady: pictures.ready,
    warm: warmHall,
    demonstrate(slug) { demonstrating = slug },
    holdPlates(release) { pictures.hold(release) },
    aimPlates(eye) { pictures.aim(eye) },
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
      // AND THE GROUND ITSELF IS DRAWN WHEN IT IS BEING LOOKED AT. From the
      // street and the court of the house this ground is fifty metres off
      // with the whole building between; the rooms stay, their contents come
      // back at the distance a visitor can read them. The four house stations
      // share one eye 52.2 m from here and the garden stands at 23.0 m, so
      // the radius sits between them.
      const near = eye.distanceToSquared(graveNear) < 48 * 48
      if (rooms && rooms.visible !== near) rooms.visible = near
      pictures.show(near)
      if (line.visible !== near) line.visible = near
      if (grave.group.visible !== near) grave.group.visible = near
      if (plaque.group.visible !== near) plaque.group.visible = near
      // The reading table is read at the table, not from the next room. At the
      // top tier it is drawn from the line's own stop too, down the same room.
      const toTable = eye.distanceToSquared(TABLE_AT)
      const atTable = near && toTable < tableReach * tableReach
      if (reading && reading.object.visible !== atTable) reading.object.visible = atTable
      // A MACHINE IS DRAWN WHERE IT CAN BE SEEN AND READ. The hall's fourteen
      // are behind the hanging wall and two closed elevations: from the
      // picture room, the gallery or the court not one of them is in the
      // room the visitor is standing in, and at the far end of a
      // twenty-two metre hall a machine is a few pixels of itself. The rail
      // now stands stations inside these rooms, so this is the difference
      // between a walk and a frame that draws the whole ground at once.
      const inHall = eye.x > -62.4 && eye.x < -38.6 && eye.z > 41.8 && eye.z < 64.2 && eye.y < -1.9
      // THE HALL'S OWN FITTINGS GO DOWN TO A FILL ONCE THE EYE IS IN THE HALL,
      // where its spots take over. They reach the rooms beside it unshadowed,
      // so from outside the hall they keep their full level, and the change
      // runs over the first metres past a door instead of at its line.
      const inside = Math.min(eye.x + 61.66, -39.02 - eye.x, eye.z - 42.04, 63.66 - eye.z)
      const t = Math.min(1, Math.max(0, inside / 2.5)), dim = t * t * (3 - 2 * t)
      for (const fitting of hallFittings) fitting.intensity = 9.5 + (HALL_FILL - 9.5) * dim
      if (hallAir.mesh.visible !== inHall) hallAir.mesh.visible = inHall
      for (const machine of machines) {
        // lent to the close look's table, a machine takes that table's light
        const lit = hallLit.get(machine.build)
        if (lit !== undefined && lit !== (machine.build.object.parent === host)) {
          hallLit.set(machine.build, !lit)
          lightHallMachine(machine.build, !lit)
        }
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
      if (bakes > 0) {
        bakes--
        // the hall drawn whole for the length of the take, wherever the eye is
        const shown = machines.filter(machine => machine.ground === 'hall' && !machine.build.object.visible && machine.build.object.parent === host)
        const roomsHidden = rooms !== undefined && !rooms.visible
        for (const machine of shown) machine.build.object.visible = true
        if (roomsHidden) rooms.visible = true
        const levels = hallFittings.map(fitting => fitting.intensity)
        for (const fitting of hallFittings) fitting.intensity = HALL_FILL
        const air = hallAir.mesh.visible
        hallAir.mesh.visible = false
        hallLight.bake()
        hallAir.mesh.visible = air
        hallFittings.forEach((fitting, i) => { fitting.intensity = levels[i]! })
        for (const machine of shown) machine.build.object.visible = false
        if (roomsHidden) rooms.visible = false
      }
      reading?.update(now * 1000)
      if (readingRoom) {
        readingRoom.update(atTable)
        if (roomBakes > 0) {
          roomBakes--
          // the room's bounce is read with the gallery standing round it,
          // wherever the eye happens to be when it is taken
          const bodies = [rooms, line, reading?.object].filter((body): body is NonNullable<typeof rooms> => body !== undefined)
          const shown = bodies.map(body => body.visible)
          for (const body of bodies) body.visible = true
          try { readingRoom.bake() } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
        }
      }
    },
    dispose() {
      live = false
      pictures.dispose()
      for (const machine of machines) machine.build.dispose()
      for (const strike of teardown) strike()
      grave.dispose()
      plaque.dispose()
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
