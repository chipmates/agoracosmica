/** THE GREAT HALL TABLE'S TWO PIECES, which the house builds because no
 * plinth of the exhibition's stands under them (`HALL_TABLE_PIECES`): the
 * inclinometer on its own base board, and the compass held as the exhibition
 * holds it everywhere, a plate, a stem and a collar at the pivot. Both turn
 * their fronts to the hall's door and are lit by the house's scene, like the
 * table under them.
 */
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import { vec3 } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Stack } from '../../stack'
import { buildMachine, type ReadyMachineBuild } from './machines'
import { mountBoxes } from './machines/bench/mounts'
import { stamp } from './collection/build'
import { HALL_TABLE, HALL_TABLE_PIECES, HALL_TABLE_PIECE_SLUGS, type HallTablePiece } from './collection/stands'
import { hallLedgeProvenance } from './entry-passage'

/** A hair over the table's boards, so a foot never shares their plane. */
const PROUD_M = .001
/** The bench's mount lets the compass's lowest moving tip clear its plate by
 * 48 mm, which reads as floating: it sits 40 mm lower on a shorter stem, and
 * its tips still clear the plate by 8 mm. */
const COMPASS_DROP_M = .04

export interface HallTablePieces { group: Group; builds: Record<HallTablePiece, ReadyMachineBuild> }

export function createHallTablePieces(stack: Stack): HallTablePieces {
  const group = new Group(); group.name = 'vinci/house-exhibits'
  const top = HALL_TABLE.floor + HALL_TABLE.top + PROUD_M
  const builds = {} as Record<HallTablePiece, ReadyMachineBuild>
  for (const slug of HALL_TABLE_PIECE_SLUGS) {
    const place = HALL_TABLE_PIECES[slug], build = buildMachine(slug, stack)
    const lift = top - build.bounds.min.y, drop = slug === 'proportional-compass' ? COMPASS_DROP_M : 0
    build.object.rotation.y = place.bearing * Math.PI / 180
    build.object.position.set(place.east, lift - drop, -place.north)
    build.object.updateMatrixWorld(true)
    stamp(build.object, `vinci/machine/${slug}`)
    // THE REST POSE IS THE POSE AT t=0 of the machine's own schedule.
    build.animate(0, 0)
    group.add(build.object)
    if (slug === 'proportional-compass') group.add(compassMount(place, lift))
    builds[slug] = build
  }
  return { group, builds }
}

/** The compass's plate, stem and collar, the stem shortened by the drop. */
function compassMount(place: { east: number; north: number; bearing: number }, lift: number): Mesh {
  const drop = COMPASS_DROP_M
  const held = mountBoxes('proportional-compass').map(box => box.centre[1] > .3
    ? { size: box.size, centre: [box.centre[0], box.centre[1] - drop, box.centre[2]] as const }
    : box.size[1] > .1 ? { size: [box.size[0], box.size[1] - drop, box.size[2]] as const, centre: [box.centre[0], box.centre[1] - drop / 2, box.centre[2]] as const }
    : box)
  const at = new Matrix4().makeRotationY(place.bearing * Math.PI / 180).setPosition(place.east, lift, -place.north)
  const geometry = mergeGeometries(held.map(({ size, centre }) =>
    new BoxGeometry(size[0], size[1], size[2]).translate(centre[0], centre[1], centre[2]).applyMatrix4(at)), false)!
  // bronze, the museum's metal for what a hand or an eye finds
  const material = new MeshStandardNodeMaterial({ metalness: .6, roughness: .38 })
  material.colorNode = vec3(.30, .20, .095)
  material.name = 'vinci/hall-table/compass-mount'
  const mesh = new Mesh(geometry, material); mesh.name = 'wing-vinci/hall-table/compass-mount'
  mesh.castShadow = true; mesh.receiveShadow = true
  mesh.userData = { manifestId: hallLedgeProvenance.manifestId, labelOccluder: false }
  return mesh
}
