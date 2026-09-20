/** THE PICK REGISTRY: a READ over the scene, not a second data file.
 *
 * Every exhibit already carries its identity in its own scene data, put there
 * by the module that built it: a plate by work and face, a machine by the
 * stamp on its parts, the dates by the floor's own list of its sockets, the
 * book by the table it lies on, the grave's and the plaque's stones by their
 * exhibit records. This module joins those to a stable id, a proxy a 44 px
 * target can sit on without enlarging the object, and the station a close
 * look returns to.
 *
 * An exhibit opens where it carries a certified viewing pose at both
 * viewports; a sheet is read and inert until the window that wires it.
 */
import { Box3, Mesh, Raycaster, Sphere, Vector3, type Object3D } from 'three/webgpu'
import type { VinciStationId } from '../content'
import { LINE_FLOOR_PICK, VINCI_LINE_STATION, vinciApproachPose, vinciApproachStation, vinciPlateExhibitId, type VinciExhibitKind } from './approaches'
import { vinciWallOrderOf } from './wall'
import { hangPlacements } from './hang'
import { STANDS } from './stands'

export interface VinciPickEntry {
  id: string
  kind: VinciExhibitKind
  /** The station an approach leaves from, where this window stands one. */
  station: VinciStationId | null
  object: Object3D
  /** The proxy, in world metres: a sphere over the object's own bounds with a
   * floor under it, so a 140 mm instrument is not a one-pixel target. */
  centre: Vector3
  radiusM: number
  /** Where the dot sits: just off the object's own face, so the occlusion
   * test does not read the object as its own occluder. */
  anchor: Vector3
  /** An exhibit with a certified viewing pose at both viewports. */
  openable: boolean
  workId: string | null
  face: 'front' | 'reverse' | null
  /** Where this exhibit stands in its own station's hang: the wall's own
   * order, so a row of them reads as the wall reads. */
  order: number
}

/** The smallest proxy an exhibit gets, so a small object keeps its own size
 * in the room and still takes a press. */
const PROXY_FLOOR_M = .11
/** Clear of the frame's own profile, which stands 74 mm off the wall. */
const ANCHOR_OFF_M = .1
/** A LABEL STANDS UNDER A WORK, NEVER ON ITS FACE. The mark drops out of the
 * work's own bounds onto the frame's lower band, where a museum screws its
 * plaque, and the drop grows with the work so one rule serves a 21 cm panel
 * and a 2.4 m canvas. */
const ANCHOR_BAND_M = { least: .014, most: .05, share: .03 }
const PLATES = 'vinci/collection-plates/'
/** The mural hangs on the display wall in the court, where the four outdoor
 * machines stand: it takes the first place in that station's own order. */
const MURAL_ORDER = 0, MACHINE_OFFSET = 1

/** WHERE AN EXHIBIT IS READ FROM, and in what order its station hangs it.
 * Both are placements the collection already made: the hang's own list, the
 * body wall's courses, the machines' placement table. A kind whose station
 * this window cannot name yet is read and left standing where it is. */
function placedAt(kind: VinciExhibitKind, id: string, workId: string | null, sheet: string | null, slug?: string)
  : { station: VinciStationId | null; order: number } {
  if (kind === 'mural') return { station: 'supper-wall', order: MURAL_ORDER }
  if (kind === 'picture') {
    const at = hangPlacements().findIndex(field => vinciPlateExhibitId(field.id, field.face) === id)
    return { station: at < 0 ? null : 'picture-room', order: Math.max(0, at) }
  }
  if (kind === 'sheet') {
    // The row reads as the wall is walked, which on a grid of courses is not
    // the register's own order.
    const at = sheet === null ? undefined : vinciWallOrderOf(`sheet/${sheet}`)
    return { station: at === undefined ? null : 'body', order: at ?? 0 }
  }
  if (kind === 'machine' && slug !== undefined) {
    const table = Object.keys(STANDS), at = table.indexOf(slug)
    // THE HALL IS ONE ROOM UNDER TWO STATIONS, and both walk one row of its
    // machines; the station a machine's certified leg leaves from is its own.
    // The house's compass waits for its ledge.
    return { station: vinciApproachStation(id) ?? null, order: MACHINE_OFFSET + Math.max(0, at) }
  }
  return { station: vinciApproachStation(id) ?? null, order: 0 }
}
/** The stations that share one room's row of machines. */
export function vinciMachineRoom(station: VinciStationId | null): readonly VinciStationId[] {
  return station === 'flight' || station === 'works' ? ['flight', 'works'] : station ? [station] : []
}
/** A MACHINE'S MARK STANDS LOW ON ITS OWN BODY, above the plinth it stands
 * on, so the plinth is never read as the mark's own occluder. */
const MACHINE_MARK_SHARE = .12

function proxy(object: Object3D): { centre: Vector3; radiusM: number; corner: Vector3 } {
  // A BODY THE REGISTRY READS BEFORE ITS FIRST FRAME still has to be measured
  // where it stands: three's box reads the matrices as they are.
  object.updateWorldMatrix(true, true)
  const box = new Box3().setFromObject(object)
  const sphere = box.getBoundingSphere(new Sphere())
  const size = box.getSize(new Vector3())
  const band = Math.max(ANCHOR_BAND_M.least, Math.min(ANCHOR_BAND_M.most, size.y * ANCHOR_BAND_M.share))
  const corner = sphere.center.clone()
  corner.y -= size.y / 2 + band
  return { centre: sphere.center.clone(), radiusM: Math.max(PROXY_FLOOR_M, sphere.radius), corner }
}

/** The face a flat exhibit presents, from its own world transform. */
function faceNormal(mesh: Mesh): Vector3 {
  mesh.updateWorldMatrix(true, false)
  return new Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(mesh.quaternion.clone())).normalize()
}

/** A date's proxy covers its socket and the numerals beside it. */
const STUD_PROXY_M = .6, STUD_MARK_M = .06
/** The floor between the sockets, pressed where no single date is resolved.
 * It stays a stride wide: a proxy over the whole eighteen metre run would
 * swallow every other exhibit of the gallery. */
const FLOOR_PROXY_M = 1.2
/** The slab and the framed diagram take a press over their own size. */
const GRAVE_PROXY_M = { slab: 1.2, frame: 1.7 }
const TABLE_OBJECT = 'vinci-reading-table', TABLE_LEAF = 'open-facsimile-plate', TABLE_BOOK = 'facsimile-binding'
/** The open leaf lies this far over the table's own top, and a hand needs
 * this much of it to press. */
const BOOK_OVER_TABLE_M = .04, BOOK_PROXY_M = .22, BOOK_MARK_M = .09
const DEATHBED_PLATE = 'Ingres-full-image-unwarped'

/** An exhibit that is not a plate or a machine: a proxy, a mark, a station. */
function place(id: string, kind: VinciExhibitKind, object: Object3D, centre: Vector3, radiusM: number, anchor: Vector3, order: number): VinciPickEntry {
  return { id, kind, station: vinciApproachStation(id) ?? null, order, object, centre, radiusM: Math.max(PROXY_FLOOR_M, radiusM), anchor,
    openable: vinciApproachPose(id, false) !== undefined && vinciApproachPose(id, true) !== undefined, workId: null, face: null }
}

export function readVinciExhibits(root: Object3D): VinciPickEntry[] {
  const entries: VinciPickEntry[] = []
  const machines = new Map<string, Object3D[]>()
  root.traverse(object => {
    const data = object.userData
    // A MACHINE IS ITS OWN GROUP, and its parts arrive from the library a
    // moment after that group stands, so it is read where it is named: by the
    // stamp the hall puts on it, or by its own name where the group carries
    // the id of the model it was built from.
    const stamped = typeof data['manifestId'] === 'string' ? data['manifestId'] : ''
    const named = /^vinci\/([a-z0-9-]+)$/.exec(object.name)
    const slug = stamped.startsWith('vinci/machine/') ? stamped.slice('vinci/machine/'.length)
      : named && Object.hasOwn(STANDS, named[1]!) ? named[1]! : ''
    if (slug) {
      const parts = machines.get(slug) ?? []
      parts.push(object)
      machines.set(slug, parts)
      return
    }
    if (!(object instanceof Mesh)) return
    if (object.name.startsWith(PLATES) && !object.name.startsWith(PLATES + 'source-shoulder/')) {
      const workId = typeof data['workId'] === 'string' ? data['workId'] : null
      const face = data['face'] === 'reverse' ? 'reverse' as const : data['face'] === 'front' ? 'front' as const : null
      const sheet = typeof data['sheetId'] === 'string' ? data['sheetId'] : null
      const id = workId && face ? vinciPlateExhibitId(workId, face) : sheet ? `sheet/${sheet}` : null
      if (!id) return
      const openable = vinciApproachPose(id, false) !== undefined && vinciApproachPose(id, true) !== undefined
      const kind: VinciExhibitKind = sheet ? 'sheet' : workId === 'last-supper' ? 'mural' : 'picture'
      const { centre, radiusM, corner } = proxy(object)
      const placed = placedAt(kind, id, workId, sheet)
      entries.push({ id, kind, station: placed.station, order: placed.order, object, centre, radiusM,
        anchor: corner.addScaledVector(faceNormal(object), ANCHOR_OFF_M), openable, workId, face })
    }
  })
  // THE KINDS THAT ARE NOT A PLATE OR A MACHINE are read by what their own
  // factories put on their groups: the floor's list of its sockets, the
  // table's name, the grave's and the plaque's exhibit records.
  root.traverse(object => {
    const exhibit = object.userData['exhibit'] as { kind?: string; anchors?: Record<string, number[]> } | undefined
    if (object.name === 'vinci/collection-line-floor' && Array.isArray(object.userData['studs'])) {
      // THE DATES ARE THE FLOOR'S OWN SOCKETS. The floor is welded, so a date is
      // a place on it: a proxy over the socket, the mark just above the stone.
      const studs = object.userData['studs'] as { id: string; east: number; north: number }[]
      object.updateWorldMatrix(true, false)
      const level = object.getWorldPosition(new Vector3()).y
      for (const [index, stud] of studs.entries()) {
        const id = `stud/${stud.id}`
        const centre = new Vector3(stud.east, level, -stud.north)
        // A date is read from the station the visitor is already standing on,
        // so it opens on its own account and carries no certified leg.
        entries.push({ ...place(id, 'stud', object, centre, STUD_PROXY_M, centre.clone().setY(level + STUD_MARK_M), index),
          station: VINCI_LINE_STATION, openable: true })
      }
      /* THE FLOOR IS ONE SELECTABLE THING. The twelve sockets are one run of
         eighteen metres read from one station, so the line itself takes a
         press and carries the room's one mark; a socket the eye can resolve
         still takes its own press and opens the life at that date. The field
         is walked to by standing at the station, so it needs no approach of
         its own and its entry says openable on its own account. */
      if (studs.length) {
        const first = studs[0]!, last = studs[studs.length - 1]!
        const middle = new Vector3((first.east + last.east) / 2, level, -(first.north + last.north) / 2)
        entries.push({ ...place(LINE_FLOOR_PICK, 'stud', object, middle, FLOOR_PROXY_M,
          middle.clone().setY(level + STUD_MARK_M), studs.length),
          // the field is the station's own ground, and the station is its approach
          station: VINCI_LINE_STATION, openable: true })
      }
    } else if (object.name === TABLE_OBJECT) {
      // THE BOOK, NOT THE ROOM THE TABLE BRINGS: the open leaf is the exhibit,
      // and until its plate is mounted the book's own place on the table is.
      object.updateWorldMatrix(true, true)
      const leaf = object.getObjectByName(TABLE_LEAF) ?? object.getObjectByName(TABLE_BOOK)
      const box = leaf ? new Box3().setFromObject(leaf) : new Box3()
      if (box.isEmpty()) {
        const at = object.getWorldPosition(new Vector3())
        box.setFromCenterAndSize(at.setY(at.y + BOOK_OVER_TABLE_M), new Vector3(.36, .08, .26))
      }
      const sphere = box.getBoundingSphere(new Sphere())
      // The mark stands over the open leaf, not inside the book.
      const over = sphere.center.clone().setY(box.max.y + BOOK_MARK_M)
      entries.push(place('codex/paris-B', 'manuscript', object, sphere.center.clone(),
        Math.max(BOOK_PROXY_M, sphere.radius), over, 0))
    } else if (exhibit?.kind === 'court-plaque') {
      const { centre, radiusM } = proxy(object)
      entries.push(place('plaque/flight-quote', 'place', object, centre, radiusM, centre.clone(), MACHINE_OFFSET + Object.keys(STANDS).length))
    } else if (exhibit?.kind === 'grave' && exhibit.anchors) {
      object.updateWorldMatrix(true, true)
      const slab = new Vector3().fromArray(exhibit.anchors['slab']!)
      const frame = new Vector3().fromArray(exhibit.anchors['computedFrame']!)
      entries.push(place('grave', 'place', object, object.localToWorld(slab.clone()), GRAVE_PROXY_M.slab, object.localToWorld(slab.clone()), 0))
      entries.push(place('grave-diagram', 'place', object, object.localToWorld(frame.clone()), GRAVE_PROXY_M.frame, object.localToWorld(frame.clone()), 1))
    } else if (object instanceof Mesh && object.name === DEATHBED_PLATE) {
      const { centre, radiusM, corner } = proxy(object)
      const id = vinciPlateExhibitId('deathbed-painting', 'front')
      entries.push({ ...place(id, 'picture', object, centre, radiusM, corner.addScaledVector(faceNormal(object), ANCHOR_OFF_M), 2),
        workId: 'deathbed-painting', face: 'front' })
    }
  })
  for (const [slug, parts] of machines) {
    // The machine's own group is the one its builder named: the stamp only
    // reaches the meshes that stood when it was put on.
    const body = parts.find(part => part.name === `vinci/${slug}`) ?? parts[0]!
    const box = new Box3().setFromObject(body)
    // A machine whose parts have not landed is still an exhibit of its
    // station: it stands at its own group's place until they do.
    if (box.isEmpty()) box.expandByPoint(body.getWorldPosition(new Vector3()))
    const sphere = box.getBoundingSphere(new Sphere())
    const placed = placedAt('machine', `machine/${slug}`, null, null, slug)
    const anchor = box.getCenter(new Vector3())
    anchor.y = box.min.y + (box.max.y - box.min.y) * MACHINE_MARK_SHARE
    entries.push({ id: `machine/${slug}`, kind: 'machine', station: placed.station, order: placed.order,
      object: body, centre: sphere.center.clone(),
      radiusM: Math.max(PROXY_FLOOR_M, sphere.radius), anchor,
      openable: placed.station !== null, workId: null, face: null })
  }
  return entries
}

/** ONE RAY ON A PRESS, never on a hover, and never through a wall: the hit is
 * depth tested against the same opaque occluders the dots are, so a plate in
 * the next room cannot win from behind its own wall.
 */
export function pickVinciExhibit(options: {
  ray: Raycaster
  entries: readonly VinciPickEntry[]
  occluded: (from: Vector3, to: Vector3) => boolean
}): VinciPickEntry | undefined {
  const { ray, entries, occluded } = options
  const live = entries.filter(entry => entry.openable && entry.object.visible)
  if (!live.length) return undefined
  let best: VinciPickEntry | undefined, at = Infinity
  for (const entry of live) {
    // A date, a place and the book are a region of a larger body: only their
    // proxy takes the press.
    if (entry.kind === 'stud' || entry.kind === 'place' || entry.kind === 'manuscript') continue
    const hits = ray.intersectObject(entry.object, entry.kind === 'machine')
    const hit = hits[0]
    if (!hit || hit.distance >= at) continue
    best = entry
    at = hit.distance
  }
  if (!best) {
    // The proxy is what a thumb lands on: a small exhibit is still its own
    // size in the room, and the press has the slack a hand needs.
    for (const entry of live) {
      const along = ray.ray.closestPointToPoint(entry.centre, new Vector3())
      const reach = along.distanceTo(ray.ray.origin)
      if (along.distanceTo(entry.centre) > entry.radiusM || reach >= at) continue
      best = entry
      at = reach
    }
  }
  if (!best) return undefined
  return occluded(ray.ray.origin, best.anchor) ? undefined : best
}
