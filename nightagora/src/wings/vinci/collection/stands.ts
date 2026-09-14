/** WHERE EVERY MACHINE STANDS, and what the exhibition builds under it.
 *
 * One table for the three grounds this museum stands machines on: the rooms
 * of the insertion, the court outside, and the house itself. The runtime
 * mounts from this table and the offline clearance certificate is written
 * against it, so a placement can never move on one side only.
 *
 * Every number here is a modern exhibition-design choice. The machines'
 * own sizes come from their dossiers and are not restated.
 */
import { dossiers, type MachineSlug } from '../machines/catalog'
import { mountBoxes } from '../machines/bench/mounts'
import { COURT, FLOOR } from './layout'

/** The three walking levels a machine can stand on. */
export type StandGround = 'hall' | 'court' | 'house'
/** The house's own ground floor, which the four house stations stand on. */
export const HOUSE_FLOOR = 0

export interface Stand {
  east: number
  north: number
  /** Degrees; the machine's own front turns with it. */
  bearing: number
  /** Height of the stone under the machine. Zero means it stands on its feet. */
  plinth: number
  ground: StandGround
  /** Machines sharing a name stand on one plinth sized over both. */
  plinthGroup?: string
}

/** THE MACHINES ACROSS THE MUSEUM.
 *
 * The court takes what wants the sky: the parachute behind the display wall,
 * the crane that was built outdoors, and the two weather instruments on one
 * plinth. The hall keeps the workshop, one aisle wide, with the camera
 * obscura in the dark bay its image needs and the gun apart at the far end.
 * The compass stands in the house, where its own ledge will be.
 */
export const STANDS: Record<MachineSlug, Stand> = {
  // The court. The parachute is 10.34 m tall and the tallest room in the
  // insertion is 6.61 m, so it stands outside on its own four uprights.
  'parachute': { east: -44, north: -25, bearing: 18, plinth: .1, ground: 'court' },
  // The hall, where thirteen machines stand today.
  'aerial-screw': { east: -51.5, north: -49, bearing: 0, plinth: .12, ground: 'hall' },
  'revolving-crane': { east: -59.2, north: -46, bearing: 28, plinth: .16, ground: 'hall' },
  'ball-bearing': { east: -59.6, north: -50.3, bearing: 0, plinth: .62, ground: 'hall' },
  'camera-obscura': { east: -59.4, north: -52.9, bearing: 104, plinth: .3, ground: 'hall' },
  'anemometer': { east: -57.9, north: -42.95, bearing: 8, plinth: .72, ground: 'hall' },
  'inclinometer': { east: -56.2, north: -42.95, bearing: -6, plinth: .72, ground: 'hall' },
  'proportional-compass': { east: -54.6, north: -42.95, bearing: 4, plinth: .78, ground: 'hall' },
  'miter-lock-gates': { east: -44.4, north: -46.4, bearing: -22, plinth: .18, ground: 'hall' },
  'multi-barrel-gun': { east: -42.6, north: -50.6, bearing: 208, plinth: .16, ground: 'hall' },
  'water-lifting-screw': { east: -41.9, north: -53.6, bearing: 90, plinth: .16, ground: 'hall' },
  'lathe': { east: -46.2, north: -52.9, bearing: 12, plinth: .2, ground: 'hall' },
  'flywheel': { east: -45.8, north: -48.8, bearing: 0, plinth: .26, ground: 'hall' },
  'rolling-mill': { east: -47.4, north: -44.2, bearing: -24, plinth: .34, ground: 'hall' },
}

export const standLevel = (ground: StandGround): number =>
  ground === 'court' ? COURT.level : ground === 'house' ? HOUSE_FLOOR : FLOOR

/** A box in the wing's own frame, in the order `RoomBatch.box` takes. */
export interface StandBox {
  east: number; north: number; height: number
  width: number; depth: number; tall: number
  role: 2 | 3
}

/** The dossier's conservative declared envelope, with its own origin. */
function envelope(slug: MachineSlug): { min: [number, number, number]; size: [number, number, number] } {
  const { x, y, z } = dossiers[slug].scale_m
  const floor = dossiers[slug].frame.ground_y_m ?? 0
  // The four machines whose swept volume is not centred on their origin.
  const forwardMin: Partial<Record<MachineSlug, number>> = {
    'camera-obscura': -.02, 'miter-lock-gates': -.35, 'multi-barrel-gun': -2, 'water-lifting-screw': -1.6,
  }
  return { min: [-x / 2, floor, forwardMin[slug] ?? -z / 2], size: [x, y, z] }
}

/** The plan footprint a plinth has to cover, in east and north. */
function footprint(slug: MachineSlug): { east: number; north: number; width: number; depth: number } {
  const stand = STANDS[slug], { min, size } = envelope(slug)
  const angle = stand.bearing * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  const centre = [min[0] + size[0] / 2, min[1] + size[1] / 2, min[2] + size[2] / 2] as const
  return {
    east: stand.east + centre[0] * cos + centre[2] * sin,
    north: stand.north + centre[0] * sin - centre[2] * cos,
    width: Math.abs(size[0] * cos) + Math.abs(size[2] * sin) + .34,
    depth: Math.abs(size[0] * sin) + Math.abs(size[2] * cos) + .34,
  }
}

/** THE EXHIBITION'S OWN FURNITURE: the plinth under each machine, the plinth
 * two machines share, and the modern hardware their dossiers do not carry.
 * Every box is fixed at mount: the clearance certificate hashes this body,
 * so nothing here may wait for a machine to finish loading.
 */
export function standBoxes(): StandBox[] {
  const boxes: StandBox[] = []
  const groups = new Map<string, MachineSlug[]>()
  for (const slug of Object.keys(STANDS) as MachineSlug[]) {
    const stand = STANDS[slug]
    const level = standLevel(stand.ground)
    const angle = stand.bearing * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
    // The modern hardware belongs to the exhibition and not to the dossier,
    // so it stands whether or not this machine is given a plinth.
    for (const box of mountBoxes(slug)) {
      boxes.push({
        east: stand.east + box.centre[0] * cos + box.centre[2] * sin,
        north: stand.north + box.centre[0] * sin - box.centre[2] * cos,
        height: level + stand.plinth + box.centre[1],
        width: box.size[0], depth: box.size[2], tall: box.size[1], role: 3,
      })
    }
    if (stand.plinth <= 0) continue
    if (stand.plinthGroup) {
      const shared = groups.get(stand.plinthGroup) ?? []
      shared.push(slug)
      groups.set(stand.plinthGroup, shared)
      continue
    }
    boxes.push(...plinth(footprint(slug), level, stand.plinth))
  }
  // A shared plinth is one stone over both machines' footprints.
  for (const shared of groups.values()) {
    const prints = shared.map(footprint)
    const west = Math.min(...prints.map(p => p.east - p.width / 2))
    const east = Math.max(...prints.map(p => p.east + p.width / 2))
    const south = Math.min(...prints.map(p => p.north - p.depth / 2))
    const north = Math.max(...prints.map(p => p.north + p.depth / 2))
    const stand = STANDS[shared[0]!]
    boxes.push(...plinth({ east: (west + east) / 2, north: (south + north) / 2, width: east - west, depth: north - south },
      standLevel(stand.ground), stand.plinth))
  }
  return boxes
}

/** A plinth is a top slab with a shadow gap under it and a smaller shaft. */
function plinth(print: { east: number; north: number; width: number; depth: number }, level: number, height: number): StandBox[] {
  const boxes: StandBox[] = [{ east: print.east, north: print.north, height: level + height - .05,
    width: print.width, depth: print.depth, tall: .1, role: 2 }]
  if (height > .1) {
    boxes.push({ east: print.east, north: print.north, height: level + (height - .1) / 2,
      width: print.width - .16, depth: print.depth - .16, tall: height - .1, role: 3 })
  }
  return boxes
}

/** THE PARACHUTE'S SHADOW DOUBLE. The court's one shadow snapshot is taken
 * while every caster in it is a surface the cache has proved static, and a
 * machine's own material graph is not one of those. So the cloth casts
 * through a plain double three centimetres inside it, which the cloth hides.
 */
export function parachuteCloth(): { corners: [number, number, number][]; top: [number, number, number] } {
  const stand = STANDS['parachute'], level = standLevel(stand.ground) + stand.plinth
  const angle = stand.bearing * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle)
  const cloth = 6.86, sill = 3.32, apex = 10.24
  const corner = (sx: number, sz: number): [number, number, number] => {
    const x = sx * cloth / 2, z = sz * cloth / 2
    return [stand.east + x * cos + z * sin, stand.north + x * sin - z * cos, level + sill]
  }
  const feet: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  return { corners: feet.map(foot => corner(foot[0], foot[1])), top: [stand.east, stand.north, level + apex] }
}
