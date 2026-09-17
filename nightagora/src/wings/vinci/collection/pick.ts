/** THE PICK REGISTRY: a READ over the scene, not a second data file.
 *
 * Every exhibit already carries its identity in its own scene data, put there
 * by the module that built it: a plate by work and face, a machine by the
 * stamp on its parts, a date inlay by its stud, a leaf by its page. This
 * module joins those to a stable id, a proxy a 44 px target can sit on
 * without enlarging the object, and the station a close look returns to.
 *
 * Only what carries a certified viewing pose can be opened. The other kinds
 * are read here and inert until the window that wires them.
 */
import { Box3, Mesh, Raycaster, Sphere, Vector3, type Object3D } from 'three/webgpu'
import type { VinciStationId } from '../content'
import { vinciApproachPose, vinciPlateExhibitId, type VinciExhibitKind } from './approaches'
import { BODY_WALL } from './body-wall'
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
    const at = BODY_WALL.findIndex(entry => entry.id === sheet)
    return { station: at < 0 ? null : 'body', order: Math.max(0, at) }
  }
  if (kind === 'machine' && slug !== undefined) {
    const table = Object.keys(STANDS), at = table.indexOf(slug)
    const stand = STANDS[slug as keyof typeof STANDS]
    return { station: stand?.ground === 'court' ? 'supper-wall' : null, order: MACHINE_OFFSET + Math.max(0, at) }
  }
  return { station: null, order: 0 }
}

function proxy(object: Object3D): { centre: Vector3; radiusM: number; corner: Vector3 } {
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
      return
    }
    const stud = typeof data['studId'] === 'string' ? data['studId'] : null
    const page = data['page']
    // A stud and a leaf are read for the window that opens them; their station
    // is assigned with their viewing pose, not guessed here.
    if (stud !== null) {
      const { centre, radiusM } = proxy(object)
      entries.push({ id: `stud/${stud}`, kind: 'stud', station: null, order: 0, object, centre, radiusM,
        anchor: centre.clone(), openable: false, workId: null, face: null })
    } else if (typeof page === 'number' || typeof page === 'string') {
      const { centre, radiusM } = proxy(object)
      entries.push({ id: `leaf/${page}`, kind: 'leaf', station: null, order: 0, object, centre, radiusM,
        anchor: centre.clone(), openable: false, workId: null, face: null })
    }
  })
  for (const [slug, parts] of machines) {
    const box = new Box3()
    for (const part of parts) box.union(new Box3().setFromObject(part))
    // A machine whose parts have not landed is still an exhibit of its
    // station: it stands at its own group's place until they do.
    if (box.isEmpty()) for (const part of parts) box.expandByPoint(part.getWorldPosition(new Vector3()))
    const sphere = box.getBoundingSphere(new Sphere())
    const placed = placedAt('machine', `machine/${slug}`, null, null, slug)
    entries.push({ id: `machine/${slug}`, kind: 'machine', station: placed.station, order: placed.order,
      object: parts[0]!.parent ?? parts[0]!, centre: sphere.center.clone(),
      radiusM: Math.max(PROXY_FLOOR_M, sphere.radius), anchor: sphere.center.clone(),
      openable: false, workId: null, face: null })
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
    const hits = ray.intersectObject(entry.object, false)
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
