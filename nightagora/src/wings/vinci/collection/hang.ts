/** The hang, at true scale, on the picture room's own wall.
 *
 * This module builds the WALL's side of the hang, which is the part a room
 * owes an exhibit: every work's frame at the size the holder records, on one
 * datum, in the order the life produced them. Each one stands over a prepared
 * pale field and the picture module streams its reproduction onto that field
 * through collection/plates.ts. Nothing here carries a label, a name or a
 * claim: the station's own locked copy does that.
 *
 * The wall keeps no rights register of its own. A work stands here when the
 * picture module's register admits a reproduction for it; a work with none
 * leaves this list, frame and battens with it, and the room's sources say in
 * one line what is elsewhere or lost.
 *
 * Sizes are the holders' own, in centimetres, as the concept's register
 * lists them (CONCEPT-OPUS.md S11).
 */
import type { RoomBatch } from './build'
import { bodyMounts } from './body-wall'
import { FACE, FLOOR, HANG_DATUM, ROOMS } from './layout'

interface Work { id: string; face: 'front' | 'reverse'; width: number; height: number; slotWidth: number }
const w = (id: string, width: number, height: number, face: Work['face'] = 'front', slotWidth = width): Work =>
  ({ id, face, width: width / 100, height: height / 100, slotWidth: slotWidth / 100 })

/** In the order the life produced them, one line of the whole life. */
export const HANG: readonly Work[] = [
  w('baptism-of-christ', 151, 177), w('annunciation', 217, 98),
  w('ginevra-de-benci', 37, 38.1), w('ginevra-de-benci', 37, 38.1, 'reverse'),
  w('madonna-of-the-carnation', 48.5, 62), w('benois-madonna', 33, 49.5),
  // The holder's pair is 244 by 240 with the width first, which the
  // restoration record states in words. Its old layout slot keeps every
  // neighbouring frame and batten in place.
  // https://opificiodellepietredure.cultura.gov.it/attivita/leonardo-da-vinci-adorazione-dei-magi-le-gallerie-degli-uffizi-firenze/
  w('saint-jerome', 75, 103), w('adoration-of-the-magi', 244, 240, 'front', 240),
  w('annunciation-predella', 60, 16), w('virgin-of-the-rocks-louvre', 122, 199.5),
  w('portrait-of-a-musician', 32, 44.7), w('lady-with-an-ermine', 40.3, 54.8),
  w('la-belle-ferronniere', 45, 63), w('madonna-litta', 33, 42),
  w('burlington-house-cartoon', 104.6, 141.5), w('yarnwinder-buccleuch', 36.9, 48.3),
  // Current holder record L.2026.5 supersedes the concept's 50.2 by 36.4 cm.
  // Its old layout slot keeps every neighbouring frame and batten in place.
  // https://www.metmuseum.org/art/collection/search/941909
  w('yarnwinder-lansdowne', 37.1, 49.5, 'front', 36.4), w('anghiari-copy', 63.6, 45.3),
  w('mona-lisa', 53.4, 79.4), w('virgin-of-the-rocks-london', 120, 189.5),
  w('virgin-and-child-with-st-anne', 113, 168), w('salvator-mundi', 45.7, 65.7),
  w('saint-john-the-baptist', 56.3, 72.9), w('la-scapigliata', 21, 24.7),
  w('bacchus', 115, 177),
]

const WALL = FACE.pictureWallNorth + .033
const MOULDING = .08, DEPTH = .062

/** A single layout supplies both the room's frames and the imported plates.
 *
 * THE WALL IS LAID FROM ITS EAST END, which is the end a visitor comes in by
 * from the garden: the earliest work hangs at the door, the walk down the wall
 * runs forward in time, and the list above stays in the order of the life.
 */
export function hangPlacements(): readonly (Work & { east: number; north: number; datum: number })[] {
  const span: [number, number] = [-60.5 + .9, -24.1 - .9]
  const total = HANG.reduce((sum, work) => sum + work.slotWidth + MOULDING * 2, 0)
  const gap = (span[1] - span[0] - total) / (HANG.length - 1)
  let east = span[1]
  return HANG.map(work => {
    const centre = east - MOULDING - work.slotWidth / 2
    east = centre - work.slotWidth / 2 - MOULDING - gap
    return { ...work, east: centre, north: WALL + .0165, datum: HANG_DATUM }
  })
}

export function buildHang(b: RoomBatch): void {
  for (const work of hangPlacements()) {
    const centre = work.east
    const high = HANG_DATUM + work.height / 2
    // Every frame on this wall carries the pale panel its plate is prepared
    // on. No frame stands over the bare wall: an empty one would say the
    // museum is keeping something back that the register in fact admits.
    const back = WALL + .012
    b.box(centre, WALL + .008, HANG_DATUM, work.width, .016, work.height, 4)
    for (const side of [-1, 1]) {
      b.box(centre + side * (work.width + MOULDING) / 2, back + DEPTH / 2, HANG_DATUM, MOULDING, DEPTH, work.height + MOULDING * 2, 2)
      b.box(centre, back + DEPTH / 2, HANG_DATUM + side * (work.height + MOULDING) / 2, work.width, DEPTH, MOULDING, 2)
      b.box(centre + side * (work.width + MOULDING * .42) / 2, back + DEPTH - .012, HANG_DATUM, MOULDING * .42, .024, work.height + MOULDING * .42, 3)
      b.box(centre, back + DEPTH - .012, HANG_DATUM + side * (work.height + MOULDING * .42) / 2, work.width, .024, MOULDING * .42, 3)
    }
    // Two brass hangers back to the rail, which is what holds it up.
    for (const side of [-1, 1]) {
      const at = centre + side * work.width * .28
      b.box(at, WALL + .006, (high + MOULDING + HANG_DATUM + 1.42) / 2, .012, .012, HANG_DATUM + 1.42 - high - MOULDING, 3)
    }
  }
}

/** What a picture room has besides pictures: a bench to sit on at the
 * distance the hang is read from, and a reading ledge at its east end. */
export function buildPictureRoomFurniture(b: RoomBatch): void {
  const P = ROOMS.picture, north = FACE.pictureWallNorth + 3.3
  for (const [west, east] of [[-57.8, -52.2], [-46.4, -40.8], [-35, -29.4]]) {
    b.box((west! + east!) / 2, north, FLOOR + .40, east! - west!, .62, .10, 2)
    for (const at of [west! + .5, east! - .5]) b.box(at, north, FLOOR + .175, .16, .5, .45, 3)
  }
  // The reading ledge stands where the room's own argument is read, off the
  // bright wall and out of the walk.
  const ledge = P.east - 3.4
  b.box(ledge, FACE.pictureWallNorth + 1.5, FLOOR + .52, 1.9, .1, .06, 3)
  b.quad([ledge - .95, FACE.pictureWallNorth + 1.5, FLOOR + .55], [ledge + .95, FACE.pictureWallNorth + 1.5, FLOOR + .55],
    [ledge + .95, FACE.pictureWallNorth + 1.9, FLOOR + .44], [ledge - .95, FACE.pictureWallNorth + 1.9, FLOOR + .44], 2)
  for (const at of [ledge - .8, ledge + .8]) b.box(at, FACE.pictureWallNorth + 1.7, FLOOR + .22, .06, .06, .44, 3)
}

/** The body as a machine: about six hundred sheets are at Windsor, and the
 * ones whose faithful reproductions the source policy admits hang here. Each
 * carrier holds its sheet at the size the holder records, and the three
 * without a recorded size at a constant area; the picture module streams the
 * sheets onto them through plates.ts.
 */
export function buildBodyWall(b: RoomBatch): void {
  const wall = FACE.hallPartitionEast + .033
  const centre = -52.6
  for (const mount of bodyMounts()) {
    const north = mount.north, height = mount.datum
    // The carrier: a backing board the sheet stands on, then the four
    // sections of its moulding.
    b.box(wall + .014, north, height, .012, mount.width, mount.height, 4)
    for (const side of [-1, 1]) {
      b.box(wall + .026, north + side * (mount.width + .028) / 2, height, .042, .028, mount.height + .056, 3)
      b.box(wall + .026, north, height + side * (mount.height + .028) / 2, .042, mount.width, .028, 3)
    }
  }
  // A reading ledge under the sheets, and a shadow gap above the base.
  b.box(wall + .3, centre, FLOOR + .92, .6, 5.4, .05, 3)
  for (const north of [centre - 2.4, centre, centre + 2.4]) b.box(wall + .28, north, FLOOR + .46, .07, .07, .92, 3)
}
