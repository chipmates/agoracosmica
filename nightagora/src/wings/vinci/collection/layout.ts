/** The collection ground's ROOM PROGRAMME, in the wing's own metres
 * (east, north, height above the house datum). The pavilion envelope, its
 * floor slab, its four perimeter walls and its three interior partitions are
 * built by `../collection.ts` and are FIXED: the rail's clearance certificate
 * hashes that geometry, so this module only adds. Every number below is a
 * modern exhibition-design choice; none of it documents a building in 1517.
 */

/** The finished floor of the whole insertion: 10 mm of stone over the slab. */
export const FLOOR = -6.3
/** Underside of the low roof, north strip and east block (it falls south). */
export const CEILING_NORTH = -1.65
export const CEILING_SOUTH = -1.77
/** Underside of the hall roof, which falls south from its clerestory. */
export const HALL_CEILING_NORTH = 1.05
export const HALL_CEILING_SOUTH = 0.3

/** Inner faces of the built envelope, measured off `collection.ts`. */
export const FACE = {
  glazingNorth: -34.07, glazingEast: -22.07,
  wallWest: -61.66, wallSouth: -63.66,
  /** the picture room's hanging wall (north face) and its back (south face) */
  pictureWallNorth: -41.8, pictureWallSouth: -42.04,
  /** the hall's east partition */
  hallPartitionEast: -38.78, hallPartitionWest: -39.02,
  /** the south-east cross wall */
  southStripNorth: -62.81,
} as const

/** The existing partitions do not run wall to wall. Their ends are the doors
 * the rail walks through, and this module dresses them as openings. */
export const OPENING = {
  /** picture room to the hall, at the west end of the hanging wall */
  pictureToHall: { east: [-61.66, -60.5], north: FACE.pictureWallNorth },
  /** picture room to the long gallery, at its east end */
  pictureToGallery: { east: [-24.1, -22.07], north: FACE.pictureWallNorth },
  /** the hall's north-east door, between the hanging wall and the partition */
  hallToGallery: { north: [-44.2, -42.04], east: FACE.hallPartitionEast },
  /** the hall's south-east door */
  hallToSouth: { north: [-63.66, -62.2], east: FACE.hallPartitionEast },
} as const

export interface Room {
  id: string
  west: number; east: number; south: number; north: number
  ceilingNorth: number; ceilingSouth: number
}

/** Four rooms, each the space between built faces. The long gallery is one
 * room and not four: the line the museum lets into its floor is 26 m long,
 * and a room cut to fit a card would have buried half of it. */
export const ROOMS: Record<'picture' | 'hall' | 'gallery', Room> = {
  picture: { id: 'picture-room', west: FACE.wallWest, east: FACE.glazingEast,
    south: FACE.pictureWallNorth, north: FACE.glazingNorth,
    ceilingNorth: CEILING_NORTH, ceilingSouth: CEILING_SOUTH },
  hall: { id: 'mechanism-hall', west: FACE.wallWest, east: FACE.hallPartitionWest,
    south: FACE.wallSouth, north: FACE.pictureWallSouth,
    ceilingNorth: HALL_CEILING_NORTH, ceilingSouth: HALL_CEILING_SOUTH },
  gallery: { id: 'long-gallery', west: FACE.hallPartitionEast, east: FACE.glazingEast,
    south: FACE.wallSouth, north: FACE.pictureWallSouth,
    ceilingNorth: CEILING_NORTH, ceilingSouth: CEILING_SOUTH },
}

/** The hang: one datum for every picture, so the sizes read against a fixed
 * eye level. Centre height of every frame on the wall. */
export const HANG_DATUM = FLOOR + 1.55

/** The line is let into the gallery's floor on this grid, and the room's own
 * paving is laid on the same one, so the two meet without a seam. */
export const LINE_ORIGIN = { east: -30.4, north: -59 }
export const LINE_SLAB = { pitchEast: 1.6, pitchNorth: 1.65, width: 1.585, depth: 1.635, thickness: 0.18 }
/** What the line module lays down around its origin: sixteen courses by
 * seven, which is what the room's own floor is cut around. */
export const LINE_FIELD = {
  west: LINE_ORIGIN.east - 3 * LINE_SLAB.pitchEast - LINE_SLAB.width / 2,
  east: LINE_ORIGIN.east + 3 * LINE_SLAB.pitchEast + LINE_SLAB.width / 2,
  south: LINE_ORIGIN.north - 6 * LINE_SLAB.pitchNorth - LINE_SLAB.depth / 2,
  north: LINE_ORIGIN.north + 9 * LINE_SLAB.pitchNorth + LINE_SLAB.depth / 2,
}

/** The court: the museum's own terrace, north-west of the pavilion, carrying
 * the three exhibits that need the sky or the height the rooms do not have.
 * It stands on the platform's own level and its north face retains the bank.
 */
export const COURT = {
  west: -59.5, east: -30.5, south: -31, north: -19, level: -6.44,
  parapet: 0.52, parapetThickness: 0.36,
}
/** The grave's own floor is the west half of the court's paving, which is
 * why the court is exactly as deep as that floor. */
export const GRAVE_ORIGIN = { east: -55.5, north: -25 }
/** The parachute stands on the court's east half, on the module's own feet:
 * 10.34 m of it, and the tallest room in the insertion is 6.61 m. */
export const PARACHUTE_ORIGIN = { east: -44, north: -25 }
/** The display wall for the Last Supper's measured absence: a wall of its
 * own on the north apron, north-lit, its field 880 by 460 cm. */
export const SUPPER_WALL = {
  east: -45, north: -29.5, length: 9.9, height: 5.94, thickness: 0.46,
  field: { width: 8.8, height: 4.6, sill: 0.62 },
}

/** Where each machine stands in the hall, in metres, with the bearing its
 * front takes. Plinth sizes come from the module's own declared envelope. */
export const HALL_BAY = { west: FACE.wallWest + 0.6, east: FACE.hallPartitionWest - 0.6, north: FACE.pictureWallSouth - 0.8, south: -53.4 }
export const CORRECTIONS_BAY = { north: -53.6, south: FACE.wallSouth }

export const world3 = (east: number, north: number, height: number): [number, number, number] => [east, height, -north]
