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
}

/** The smallest proxy an exhibit gets, so a small object keeps its own size
 * in the room and still takes a press. */
const PROXY_FLOOR_M = .11
const ANCHOR_OFF_M = .05
const PLATES = 'vinci/collection-plates/'

function proxy(object: Object3D): { centre: Vector3; radiusM: number } {
  const box = new Box3().setFromObject(object)
  const sphere = box.getBoundingSphere(new Sphere())
  return { centre: sphere.center.clone(), radiusM: Math.max(PROXY_FLOOR_M, sphere.radius) }
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
    if (!(object instanceof Mesh)) return
    const data = object.userData
    if (object.name.startsWith(PLATES) && !object.name.startsWith(PLATES + 'source-shoulder/')) {
      const workId = typeof data['workId'] === 'string' ? data['workId'] : null
      const face = data['face'] === 'reverse' ? 'reverse' as const : data['face'] === 'front' ? 'front' as const : null
      const sheet = typeof data['sheetId'] === 'string' ? data['sheetId'] : null
      const id = workId && face ? vinciPlateExhibitId(workId, face) : sheet ? `sheet/${sheet}` : null
      if (!id) return
      const openable = vinciApproachPose(id, false) !== undefined && vinciApproachPose(id, true) !== undefined
      const kind: VinciExhibitKind = sheet ? 'sheet' : workId === 'last-supper' ? 'mural' : 'picture'
      const { centre, radiusM } = proxy(object)
      entries.push({ id, kind, station: openable ? 'picture-room' : null, object, centre, radiusM,
        anchor: centre.clone().addScaledVector(faceNormal(object), ANCHOR_OFF_M), openable, workId, face })
      return
    }
    // The machines arrive part by part under one stamp, so they are collected
    // and closed once the whole scene has been read.
    const manifestId = typeof data['manifestId'] === 'string' ? data['manifestId'] : ''
    if (manifestId.startsWith('vinci/machine/')) {
      const slug = manifestId.slice('vinci/machine/'.length)
      const parts = machines.get(slug) ?? []
      parts.push(object)
      machines.set(slug, parts)
      return
    }
    const stud = typeof data['studId'] === 'string' ? data['studId'] : null
    const page = data['page']
    // A stud and a leaf are read for the window that opens them; their station
    // is assigned with their viewing pose, not guessed here.
    if (stud !== null) {
      const { centre, radiusM } = proxy(object)
      entries.push({ id: `stud/${stud}`, kind: 'stud', station: null, object, centre, radiusM,
        anchor: centre.clone(), openable: false, workId: null, face: null })
    } else if (typeof page === 'number' || typeof page === 'string') {
      const { centre, radiusM } = proxy(object)
      entries.push({ id: `leaf/${page}`, kind: 'leaf', station: null, object, centre, radiusM,
        anchor: centre.clone(), openable: false, workId: null, face: null })
    }
  })
  for (const [slug, parts] of machines) {
    const box = new Box3()
    for (const part of parts) box.union(new Box3().setFromObject(part))
    const sphere = box.getBoundingSphere(new Sphere())
    entries.push({ id: `machine/${slug}`, kind: 'machine', station: null,
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
