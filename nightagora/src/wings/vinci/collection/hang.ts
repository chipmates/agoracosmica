/** The hang, at true scale, on the picture room's own wall.
 *
 * The picture bench (window 4) has not landed in this tree: there is no
 * `pictures/` module to import, and no plate may be invented here. So this
 * module builds the WALL's side of the hang only, which is the part a room
 * owes an exhibit: every work's frame at the size the holder records, on one
 * datum, in the order the life produced them. Fourteen of them are the
 * withheld works and stand over a dark field; eleven are the display-grade
 * works whose plates the picture bench streams, and they stand over a
 * prepared pale field until it does. Nothing here carries a label, a name or
 * a claim: the station's own locked copy does that.
 *
 * Sizes are the holders' own, in centimetres, as the concept's register
 * lists them (CONCEPT-OPUS.md S11).
 */
import type { RoomBatch } from './build'
import { FACE, FLOOR, HANG_DATUM, ROOMS } from './layout'

interface Work { width: number; height: number; withheld: boolean }
const w = (width: number, height: number, withheld = false): Work => ({ width: width / 100, height: height / 100, withheld })

/** In the order the life produced them, present and absent in one line. */
export const HANG: readonly Work[] = [
  w(151, 177, true), w(217, 98, true), w(37, 38.1), w(37, 38.1), w(48.5, 62),
  w(33, 49.5, true), w(75, 103, true), w(240, 244, true), w(60, 16, true), w(122, 199.5),
  w(32, 44.7, true), w(40.3, 54.8), w(45, 63, true), w(33, 42), w(104.6, 141.5, true),
  w(36.9, 48.3), w(36.4, 50.2), w(63.6, 45.3), w(53.4, 79.4, true), w(120, 189.5, true),
  w(113, 168), w(45.7, 65.7, true), w(56.3, 72.9, true), w(21, 24.7, true), w(115, 177),
]

const WALL = FACE.pictureWallNorth + .033
const MOULDING = .08, DEPTH = .062

export function buildHang(b: RoomBatch): void {
  const span: [number, number] = [-60.5 + .9, -24.1 - .9]
  const total = HANG.reduce((sum, work) => sum + work.width + MOULDING * 2, 0)
  const gap = (span[1] - span[0] - total) / (HANG.length - 1)
  let east = span[0]
  for (const work of HANG) {
    const centre = east + MOULDING + work.width / 2
    const high = HANG_DATUM + work.height / 2
    // A withheld work is an EMPTY FRAME: the moulding stands 30 mm off the
    // wall on its battens and what is inside it is the wall. The eleven the
    // museum may show carry the pale panel their plate is prepared on.
    const back = WALL + (work.withheld ? .03 : .012)
    if (!work.withheld) b.box(centre, WALL + .008, HANG_DATUM, work.width, .016, work.height, 4)
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
    east = centre + work.width / 2 + MOULDING + gap
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

/** The body as a machine: about six hundred sheets are at Windsor and this
 * museum may show none of them, so the wall carries the sheets' own size and
 * nothing in them. Four courses of a Windsor folio's measurement, and one
 * larger absence for the sheet the arithmetic in the drawer is taken from.
 */
export function buildBodyWall(b: RoomBatch): void {
  const wall = FACE.hallPartitionEast + .033
  const sheet = { width: .19, height: .278 }
  const centre = -52.6, datum = FLOOR + 1.52
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 7; column++) {
      const north = centre + (column - 3) * .46
      const height = datum + (1.5 - row) * .42
      for (const side of [-1, 1]) {
        b.box(wall + .026, north + side * (sheet.width + .028) / 2, height, .042, .028, sheet.height + .056, 3)
        b.box(wall + .026, north, height + side * (sheet.height + .028) / 2, .042, sheet.width, .028, 3)
      }
    }
  }
  // The one sheet the vortex arithmetic is read from, at its own size.
  const big = { width: .284, height: .42 }
  for (const side of [-1, 1]) {
    b.box(wall + .026, centre + 4.05 + side * (big.width + .04) / 2, datum + .28, .042, .04, big.height + .08, 3)
    b.box(wall + .026, centre + 4.05, datum + .28 + side * (big.height + .04) / 2, .042, big.width, .04, 3)
  }
  // A reading ledge under the sheets, and a shadow gap above the base.
  b.box(wall + .3, centre, FLOOR + .92, .6, 5.4, .05, 3)
  for (const north of [centre - 2.4, centre, centre + 2.4]) b.box(wall + .28, north, FLOOR + .46, .07, .07, .92, 3)
}
