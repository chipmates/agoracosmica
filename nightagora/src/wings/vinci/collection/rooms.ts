/** The rooms of the collection ground: floors, linings, soffits, the doors
 * the rail walks through, and the court outside that carries what the rooms
 * cannot hold. The pavilion's envelope, slab and three partitions are older
 * than this module and are never touched here.
 */
import { Group } from 'three/webgpu'
import { RoomBatch } from './build'
import { buildBodyWall, buildHang, buildPictureRoomFurniture } from './hang'
import { collectionBorrowedLightMaterial, collectionInteriorMaterial, collectionRoomsProvenance } from './materials'
import {
  COURT, DARK_BAY, FACE, FLOOR, GRAVE_ORIGIN, HANG_DATUM, LINE_FIELD, OPENING, ROOMS, SUPPER_WALL,
} from './layout'

const CEILING = -1.88, COFFER = .19, BAY = 4
const BASE = .16, LINING = .022, GAP = .04

/** The hall's roof falls south from its clerestory; its beams follow it. */
const hallSoffit = (north: number) => 1.05 - .75 * (-42.5 - north) / 22.2

function wallEastWest(b: RoomBatch, north: number, inward: 1 | -1, west: number, east: number, top: number, skip: [number, number][] = []): void {
  const face = north + inward * .011
  const runs: [number, number][] = []
  let cursor = west
  for (const [from, to] of [...skip].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) runs.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (cursor < east) runs.push([cursor, east])
  for (const [from, to] of runs) {
    const width = to - from
    if (width <= .001) continue
    b.box((from + to) / 2, face, (FLOOR + BASE + top - GAP) / 2, width, LINING * 2, top - GAP - FLOOR - BASE, 1)
    b.box((from + to) / 2, north + inward * .018, FLOOR + BASE / 2, width, .036, BASE, 2)
    // Ribs on the structure's own bay give the plane its middle scale.
    for (let east2 = Math.ceil(from / BAY) * BAY; east2 < to; east2 += BAY) {
      if (east2 - from < .4 || to - east2 < .4) continue
      b.box(east2, face + inward * .012, (FLOOR + BASE + top - GAP) / 2, .34, .024, top - GAP - FLOOR - BASE, 1)
    }
  }
}

function wallNorthSouth(b: RoomBatch, east: number, inward: 1 | -1, south: number, north: number, top: number, skip: [number, number][] = []): void {
  const face = east + inward * .011
  const runs: [number, number][] = []
  let cursor = south
  for (const [from, to] of [...skip].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) runs.push([cursor, from])
    cursor = Math.max(cursor, to)
  }
  if (cursor < north) runs.push([cursor, north])
  for (const [from, to] of runs) {
    const depth = to - from
    if (depth <= .001) continue
    b.box(face, (from + to) / 2, (FLOOR + BASE + top - GAP) / 2, LINING * 2, depth, top - GAP - FLOOR - BASE, 1)
    b.box(east + inward * .018, (from + to) / 2, FLOOR + BASE / 2, .036, depth, BASE, 2)
    for (let north2 = Math.ceil(from / BAY) * BAY; north2 < to; north2 += BAY) {
      if (north2 - from < .4 || to - north2 < .4) continue
      b.box(face + inward * .012, north2, (FLOOR + BASE + top - GAP) / 2, .024, .34, top - GAP - FLOOR - BASE, 1)
    }
  }
}

/** A door is a dressed hole: two stone reveals, a head, and a floor band
 * that says the threshold is a threshold. */
function doorEastWest(b: RoomBatch, north: number, west: number, east: number, head: number): void {
  for (const at of [west, east]) b.box(at, north, (FLOOR + head) / 2, .26, .46, head - FLOOR, 2)
  b.box((west + east) / 2, north, head + .13, east - west + .52, .46, .26, 2)
  b.box((west + east) / 2, north, FLOOR - .006, east - west, .5, .024, 2)
}

function doorNorthSouth(b: RoomBatch, east: number, south: number, north: number, head: number): void {
  for (const at of [south, north]) b.box(east, at, (FLOOR + head) / 2, .46, .26, head - FLOOR, 2)
  b.box(east, (south + north) / 2, head + .13, .46, north - south + .52, .26, 2)
  b.box(east, (south + north) / 2, FLOOR - .006, .5, north - south, .024, 2)
}

/** A flat plaster soffit with the structure's bay read back into it as a
 * coffer grid, and a cove along the wall the pictures hang on. */
function ceiling(b: RoomBatch, west: number, south: number, east: number, north: number): void {
  b.slab(west, south, east, north, CEILING, .07, 4)
  for (let at = Math.ceil(west / BAY) * BAY; at < east; at += BAY)
    b.box(at, (south + north) / 2, CEILING - .07 - COFFER / 2, .28, north - south, COFFER, 4)
  for (let at = Math.ceil(south / BAY) * BAY; at < north; at += BAY)
    b.box((west + east) / 2, at, CEILING - .07 - COFFER / 2, east - west, .28, COFFER, 4)
}

function lightCove(b: RoomBatch, north: number, west: number, east: number, inward: 1 | -1): void {
  const depth = .62
  b.box((west + east) / 2, north + inward * depth / 2, CEILING - .10, east - west, depth, .06, 4)
  b.box((west + east) / 2, north + inward * depth, CEILING - .28, east - west, .07, .30, 4)
  b.box((west + east) / 2, north + inward * (depth - .03), CEILING - .40, east - west, .05, .07, 3)
}

export function createCollectionRooms(): Group {
  const b = new RoomBatch(), glass = new RoomBatch()
  const P = ROOMS.picture, H = ROOMS.hall, G = ROOMS.gallery

  // THE PICTURE ROOM. North-lit, and the wall it hangs on is the one the
  // window looks at. Its floor is laid on the line's own grid.
  b.slab(P.west, P.south, P.east, P.north, FLOOR, .09, 0)
  b.slab(P.west, P.north - .9, P.east, P.north, FLOOR + .001, .09, 2)
  wallEastWest(b, FACE.pictureWallNorth, 1, P.west, P.east, -2.04, [[OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]], [OPENING.pictureToGallery.east[0], OPENING.pictureToGallery.east[1]]])
  wallNorthSouth(b, FACE.wallWest, 1, P.south, P.north, -1.94)
  ceiling(b, P.west, P.south, P.east, P.north)
  lightCove(b, FACE.pictureWallNorth, P.west + .3, P.east - .3, 1)
  // The hanging wall gets its own picture rail and a continuous stone bench
  // under it, so the room reads as a room before a single frame is hung.
  b.box((P.west + P.east) / 2, FACE.pictureWallNorth + .09, HANG_DATUM + 1.42, P.east - P.west - .6, .16, .07, 3)
  buildHang(b)
  buildPictureRoomFurniture(b)
  doorEastWest(b, FACE.pictureWallNorth - .1, OPENING.pictureToHall.east[0] + .1, OPENING.pictureToHall.east[1], -2.5)
  doorEastWest(b, FACE.pictureWallNorth - .1, OPENING.pictureToGallery.east[0], OPENING.pictureToGallery.east[1] - .1, -2.5)

  // THE MECHANISM HALL. Six metres of clear height and a north clerestory,
  // which is the only room in the insertion tall enough for the screw.
  b.slab(H.west, H.south, H.east, H.north, FLOOR, .09, 0)
  wallNorthSouth(b, FACE.wallWest, 1, H.south, H.north, hallSoffit(-52) - .5)
  wallEastWest(b, FACE.wallSouth, 1, H.west, H.east, hallSoffit(H.south) - .35)
  wallNorthSouth(b, FACE.hallPartitionWest, -1, H.south, H.north, hallSoffit(-52) - .5, [[OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1]], [OPENING.hallToSouth.north[0], OPENING.hallToSouth.north[1]]])
  wallEastWest(b, FACE.pictureWallSouth, -1, H.west, H.east, -2.06, [[OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]]])
  // The clerestory's light shelf: a pale reflector that throws the north sky
  // at the hall's ceiling instead of at the visitor's eye.
  b.box((H.west + H.east) / 2, FACE.pictureWallSouth - .62, -1.62, H.east - H.west - .5, 1.24, .08, 4)
  b.box((H.west + H.east) / 2, FACE.pictureWallSouth - 1.24, -1.46, H.east - H.west - .5, .09, .34, 4)
  for (let north = -46; north > H.south + 2; north -= BAY) {
    b.box((H.west + H.east) / 2, north, hallSoffit(north) - .34, H.east - H.west, .34, .58, 4)
    for (const east of [H.west + 3.4, H.east - 3.4]) b.box(east, north, hallSoffit(north) - .74, .5, .42, .26, 3)
  }
  doorEastWest(b, FACE.pictureWallSouth + .1, OPENING.pictureToHall.east[0] + .1, OPENING.pictureToHall.east[1], -2.5)
  doorNorthSouth(b, FACE.hallPartitionWest - .1, OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1] - .1, -2.5)
  doorNorthSouth(b, FACE.hallPartitionWest - .1, OPENING.hallToSouth.north[0] + .1, OPENING.hallToSouth.north[1], -2.5)
  // THE DARK BAY. A camera obscura has nothing to show in a lit room, so the
  // hall gives it three walls of its own and keeps the fourth side open to
  // the aisle. The bay is 2.7 m high: the hall's luminaires hang above it.
  for (const [west, south, east, north] of [
    [DARK_BAY.west - DARK_BAY.wall, DARK_BAY.south - DARK_BAY.wall, DARK_BAY.west, DARK_BAY.north],
    [DARK_BAY.east, DARK_BAY.south - DARK_BAY.wall, DARK_BAY.east + DARK_BAY.wall, DARK_BAY.north],
    [DARK_BAY.west - DARK_BAY.wall, DARK_BAY.south - DARK_BAY.wall, DARK_BAY.east + DARK_BAY.wall, DARK_BAY.south],
  ]) {
    b.box((west! + east!) / 2, (south! + north!) / 2, FLOOR + DARK_BAY.height / 2,
      east! - west!, north! - south!, DARK_BAY.height, 1)
    b.box((west! + east!) / 2, (south! + north!) / 2, FLOOR + BASE / 2, east! - west!, north! - south!, BASE, 2)
    b.box((west! + east!) / 2, (south! + north!) / 2, FLOOR + DARK_BAY.height + .07,
      east! - west! + .06, north! - south! + .06, .14, 2)
  }

  // THE LONG GALLERY. One room and not four: the line the museum lets into
  // its floor is twenty-six metres long. The floor is cut around it.
  b.slabAround(G.west, G.south, G.east, G.north, FLOOR, .09, LINE_FIELD, 0)
  buildBodyWall(b)
  wallNorthSouth(b, FACE.hallPartitionEast, 1, G.south, G.north, -2.06, [[OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1]], [OPENING.hallToSouth.north[0], OPENING.hallToSouth.north[1]]])
  wallEastWest(b, FACE.pictureWallSouth, -1, G.west, G.east, -2.06, [[OPENING.pictureToGallery.east[0], OPENING.pictureToGallery.east[1]]])
  wallEastWest(b, FACE.southStripNorth, 1, G.west + .1, -22.8, -2.1)
  ceiling(b, G.west, G.south, G.east, G.north)
  doorEastWest(b, FACE.pictureWallSouth + .1, OPENING.pictureToGallery.east[0], OPENING.pictureToGallery.east[1] - .1, -2.5)
  // The gallery's east end is the glazed elevation: its sill and reveal are
  // dressed so the room ends in a window and not in an edge.
  b.box(FACE.glazingEast + .13, (G.south + G.north) / 2, FLOOR + .21, .26, G.north - G.south, .42, 2)
  b.box(FACE.glazingEast + .13, (P.south + P.north) / 2, FLOOR + .21, .26, P.north - P.south, .42, 2)

  // THE COURT. Three exhibits need the sky or a height no room here has: the
  // grave, the parachute at 10.34 m, and the wall that is not here. The
  // museum's own terrace carries them, north of the pavilion, on the same
  // level as its apron.
  b.slabAround(COURT.west, COURT.south, COURT.east, COURT.north, COURT.level, .22,
    { west: GRAVE_ORIGIN.east - 4, south: GRAVE_ORIGIN.north - 6, east: GRAVE_ORIGIN.east + 9, north: GRAVE_ORIGIN.north + 6 }, 5)
  for (const [west, south, east, north] of [
    [COURT.west, COURT.north - COURT.parapetThickness, COURT.east, COURT.north],
    [COURT.west, COURT.south, COURT.west + COURT.parapetThickness, COURT.north],
    [COURT.east - COURT.parapetThickness, COURT.south, COURT.east, COURT.north],
  ]) {
    b.box((west! + east!) / 2, (south! + north!) / 2, COURT.level + COURT.parapet / 2, east! - west!, north! - south!, COURT.parapet, 5)
    b.box((west! + east!) / 2, (south! + north!) / 2, COURT.level + COURT.parapet + .03, east! - west! + .07, north! - south! + .07, .06, 2)
  }
  // The terrace stands on the falling ground west of the house. Its faces
  // are the retaining construction, closed to below the natural grade.
  const faceTop = COURT.level - .22
  b.box((COURT.west + COURT.east) / 2, COURT.north - .17, (faceTop - 11.2) / 2, COURT.east - COURT.west, .34, faceTop + 11.2, 5)
  for (const east of [COURT.west + .17, COURT.east - .17])
    b.box(east, (COURT.south + COURT.north) / 2, (faceTop - 11.2) / 2, .34, COURT.north - COURT.south, faceTop + 11.2, 5)
  // A shadow course at the head of the retaining face, which is what stops
  // a four-metre concrete wall reading as a blank.
  for (let height = faceTop - .55; height > -10.2; height -= .55) {
    b.box((COURT.west + COURT.east) / 2, COURT.north - .335, height, COURT.east - COURT.west, .01, .02, 5)
  }
  // A stone band marks where the court's own paving ends and the grave's
  // floor begins, which is the join the exhibit brings with it.
  b.slab(GRAVE_ORIGIN.east + 9, COURT.south, GRAVE_ORIGIN.east + 9.12, COURT.north, COURT.level + .003, .012, 2)

  // THE WALL THAT IS NOT HERE. A wall of its own in the court, turned to
  // the way a visitor arrives, carrying a measured absence of 880 by 460 cm
  // and nothing else. Its field is recessed, so its edge is a shadow.
  const S = SUPPER_WALL, base = COURT.level
  b.box(S.east, S.north, base + S.height / 2, S.thickness, S.length, S.height, 1)
  b.box(S.east, S.north, base + S.height + .08, S.thickness + .18, S.length + .18, .16, 2)
  b.box(S.east, S.north, base + .11, S.thickness + .14, S.length + .14, .22, 2)
  for (const side of [-1, 1]) b.box(S.east - S.thickness / 2 - .45, S.north + side * (S.length / 2 - .42), base + S.height / 2 - .25, .9, .84, S.height - .5, 1)
  const fieldBase = base + S.field.sill, fieldFace = S.east + S.thickness / 2
  // The field is the painting's own measurement. A stone band stands proud
  // around it and the plaster inside steps back, so at any distance the
  // rectangle is an edge with a shadow in it and not a change of tone.
  b.box(fieldFace - .03, S.north, fieldBase + S.field.height / 2, .06, S.field.width, S.field.height, 4)
  for (const side of [-1, 1]) {
    b.box(fieldFace + .06, S.north + side * (S.field.width / 2 + .11), fieldBase + S.field.height / 2, .12, .22, S.field.height + .44, 2)
    b.box(fieldFace + .06, S.north, fieldBase + (side > 0 ? S.field.height + .11 : -.11), .12, S.field.width + .44, .22, 2)
    b.quad([fieldFace, S.north + side * S.field.width / 2, fieldBase], [fieldFace - .06, S.north + side * S.field.width / 2, fieldBase],
      [fieldFace - .06, S.north + side * S.field.width / 2, fieldBase + S.field.height], [fieldFace, S.north + side * S.field.width / 2, fieldBase + S.field.height], 2, [side, 0, 0])
    b.quad([fieldFace, S.north - S.field.width / 2, fieldBase + (side > 0 ? S.field.height : 0)], [fieldFace, S.north + S.field.width / 2, fieldBase + (side > 0 ? S.field.height : 0)],
      [fieldFace - .06, S.north + S.field.width / 2, fieldBase + (side > 0 ? S.field.height : 0)], [fieldFace - .06, S.north - S.field.width / 2, fieldBase + (side > 0 ? S.field.height : 0)], 2, [0, 0, side])
  }
  // A stone sill at the foot of the field, at the distance a visitor stops.
  b.box(fieldFace + .42, S.north, base + .22, .84, S.field.width, .44, 2)

  const group = new Group()
  group.name = 'vinci/collection-rooms'
  const material = collectionInteriorMaterial()
  group.add(b.mesh('vinci/collection-rooms/construction', material))
  if (glass.triangles > 0) group.add(glass.mesh('vinci/collection-rooms/borrowed-light', collectionBorrowedLightMaterial(), false))
  group.userData = { ...collectionRoomsProvenance, triangles: b.triangles + glass.triangles }
  return group
}
