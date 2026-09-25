/** THE PICTURE ROOM, FOR THE FILM: the wing's great room. The hang's wall in
 * a deep lapis-slate lime plaster over a shadow gap, the rail read as the
 * foot of a frieze that steps forward, the soffit and its ribs in the
 * building's board-formed concrete; smoked oak boards underfoot with the walk
 * worn into them; every work in a dark oiled oak frame with a bronze slip;
 * the benches built in oak on bronze shoes.
 *
 * Its light, as data: a warm head on a black track over every work, each
 * throwing its pool and its frame's shadow; the portrait he kept under a
 * framing projector cut to her frame; the north glazing as one cool area
 * source held low and its daylight over the floor; the two doorways bright
 * with the next rooms' daylight; the room's bounce from a probe of its own;
 * the room's air over its length. ONLY THE ROOM'S OWN SURFACES TAKE THESE
 * LIGHTS (`lightsNode`): nothing else in the wing samples anything new. The
 * finish lies over the certified construction and is no rail solid; the
 * benches, frames and fittings stand outside the fingerprint and
 * `picture-room-check.mjs` proves them clear of the walk. A modern room; no
 * light or building of 1517 is claimed.
 */
import {
  AdditiveBlending, Color, CubeCamera, CubeRenderTarget, CustomBlending, CylinderGeometry, DirectionalLight, DoubleSide, DstColorFactor, Float32BufferAttribute, FrontSide,
  Group, HalfFloatType, Matrix4, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, PMREMGenerator, PlaneGeometry,
  OneFactor, Quaternion, RectAreaLight, RectAreaLightNode, SpotLight, Vector3, ZeroFactor, type BufferGeometry, type Light, type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf, output, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import {
  benches, ceilingSkin, DOORWAYS, fittings, floorSkins, frameGeometry, hangFrames, hangLamps, LAMP_COLOUR, lensOf,
  PICTURE_ROOM_PROVENANCE, PICTURE_SHADOW_LAYER, PROBE_AT, REVEAL, ROOM, ROOM_LIGHTS, shadowCasters, stampHangLight, v3,
  wallSkins, WINDOW, type HangLamp, type RoomLight, type Skin, type Solid,
} from './picture-room-plan'
import { hangSurfaceLight, hangWallPool, PICTURE_LOOKS, varnishFilm, withRoomAir } from './picture-light'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, attribute, cameraPosition, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, length, max, min, mix, mx_noise_float,
  normalWorldGeometry, positionWorld, pow, select, smoothstep, uniform, uv, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** how far along each beam the air's glow is drawn, in metres */
const GLOW_REACH = .85

/** The sets the room is dressed from, all CC0 and already in the store. */
const SETS = ['concrete-wall-formed', 'oak-veneer-light', 'concrete-floor-polished'] as const

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

/** the tangent frame a world-aligned face is photographed in: u runs along
    the face, v up it; a level face's u runs east and v north */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}

/** a tangent-space normal from a set, bent into the world */
const bendWorld = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize()
/** the same, handed over in view space */
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  bendWorld(t, b, n, tangent, strength).transformDirection(cameraViewMatrix)

const luminance = (c: N): N => dot(c, vec3(.2126, .7152, .0722))

/** THE SURFACES' LOOKS AS UNIFORMS: a live instrument leans on them and no
 * shader is rebuilt. Values are the room's own, chosen in the look rounds. */
function looks() {
  return {
    /** the hang's deep wall (AD-2, C4): lapis-slate lime plaster */
    plaster: uniform(new Color('#2b3440')),
    /** how much of the photograph's own cloud the trowelled face keeps */
    plasterCloud: uniform(.36),
    plasterRough: uniform(.62),
    plasterNormal: uniform(.2),
    /** THE TOOTH: the same photograph laid at a hand's width, read for its
     * relief and a breath of its tone, so the trowelled face has a grain at
     * the distance a label is read from */
    plasterTooth: uniform(.55),
    plasterToothTone: uniform(.1),
    plasterSand: uniform(.17),
    plasterSandTone: uniform(.035),
    /** THE TROWEL'S CLOUD at the stops' distance: the lime's slow drift over
     * a metre, the laps a trowel leaves over a hand, and the fleck of the
     * aggregate a pixel still holds, as shares of the tone */
    plasterDrift: uniform(.16),
    plasterLap: uniform(.11),
    plasterFleck: uniform(.075),
    /** the fleck's own relief, which the heads rake across */
    plasterFleckRelief: uniform(.17),
    /** the building's concrete, poured a shade cooler than the gallery's */
    concreteTint: uniform(new Color(.9, .95, 1.12)),
    soffitTint: uniform(new Color(.84, .9, 1.1)),
    /** smoked oak boards, and how far the walk has worn them */
    floorTint: uniform(new Color(.3, .232, .19)),
    floorWear: uniform(.22),
    floorRough: uniform(.42),
    /** the frames' dark oiled oak and the benches' lighter oiled oak */
    frameTint: uniform(new Color(.064, .041, .026)),
    frameRough: uniform(.72),
    /** metres the oak is laid at on the frames, and how far its figure bends the light */
    frameGrain: .95,
    frameRelief: uniform(.42),
    /** a frame's outer side, in the pool beside it: the wall's bounce and the
     * neighbouring heads' graze together, a stand-in and not a solve */
    frameSide: uniform(.3),
    benchTint: uniform(new Color(.74, .66, .58)),
    /** a dark honed stone: the glazing's band, the thresholds, the gaps' backs */
    darkTint: uniform(new Color(.4, .39, .38)),
    bronze: uniform(new Color(.5, .36, .2)),
    /** the probe read at the scene's own level; the lift is the room's */
    envGain: uniform(1),
    envLift: uniform(1),
    /** how much of the room the oiled floor carries, read off the probe
     * where the reflected ray meets the room's own walls */
    floorMirror: uniform(.8),
    floorGloss: uniform(.3),
    /** the lit lens of every head, and the air it lights in front of it */
    lens: uniform(18),
    glow: uniform(.045),
    /** the next rooms through the doors as an eye settled to the hang reads
     * them: what of their light is kept, and how near the eye comes before
     * it has left this room's level, in metres */
    doorKeep: uniform(new Color(.23, .255, .32)),
    doorNear: uniform(1.3),
    doorFar: uniform(4.5),
  }
}
type Looks = ReturnType<typeof looks>

/** THE HANG'S DEEP WALL: a burnished plaster, read off a jointless sealed
 * photograph laid at a wall's scale, its colour taken back to the one
 * lapis-slate and only its cloud and its fine relief kept, so the paint is
 * the warm thing on it. */
function plasterMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .6, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const at = vec2(dot(P, t), dot(P, b))
  const sample = set.sample({ uv: at, metres: 1.4 })
  // a second, larger lay of the same photograph so no tile repeats down 39 m
  const wide = set.sample({ uv: at.mul(.37).add(vec2(11.3, 4.1)), metres: 1.4 })
  const tooth = set.sample({ uv: at, metres: .21, turn: .83, offset: [3.7, 1.3] })
  // THE SAND IN THE LIME: a grain of a few millimetres the heads rake across,
  // faded where a pixel holds more than a grain
  const sand = at.mul(310), fine = at.mul(720)
  const sandFade = float(1).sub(smoothstep(.35, .9, TSL.fwidth(sand.x)))
  const fineFade = float(1).sub(smoothstep(.35, .9, TSL.fwidth(fine.x)))
  const grit = vec2(mx_noise_float(vec3(sand, 1.3)), mx_noise_float(vec3(sand, 7.1))).mul(sandFade)
    .add(vec2(mx_noise_float(vec3(fine, 3.7)), mx_noise_float(vec3(fine, 9.9))).mul(fineFade.mul(.5)))
  const cloud = luminance(sample.albedo).mul(.6).add(luminance(wide.albedo).mul(.4))
  const drift = mx_noise_float(P.mul(.21)).mul(.05).add(mx_noise_float(P.mul(.73)).mul(.025))
  const grain = luminance(tooth.albedo).sub(1).mul(L.plasterToothTone).add(mx_noise_float(vec3(sand, 4.4)).mul(sandFade).mul(L.plasterSandTone))
  // the laps run in arcs a forearm long, so they are drawn out along two
  // swept directions; the fleck is a centimetre and fades as the grain does
  const slow = mx_noise_float(vec3(at.mul(1.15), 2.9)).mul(.65).add(mx_noise_float(vec3(at.mul(2.6), 5.3)).mul(.35))
  const lapA = mx_noise_float(vec3(at.x.mul(3.1).add(at.y.mul(1.9)), at.y.mul(7.4).sub(at.x.mul(4.2)), 1.7))
  const lapB = mx_noise_float(vec3(at.x.mul(6.3).sub(at.y.mul(2.2)), at.y.mul(3.3).add(at.x.mul(5.1)), 8.3))
  const fleckAt = at.mul(105)
  const fleckFade = float(1).sub(smoothstep(.3, .8, TSL.fwidth(fleckAt.x)))
  const fleck = mx_noise_float(vec3(fleckAt, 6.6)).add(mx_noise_float(vec3(fleckAt.mul(2.3), 3.1)).mul(.5)).mul(fleckFade)
  const trowel = slow.mul(L.plasterDrift).add(lapA.max(lapB).mul(L.plasterLap)).add(fleck.mul(L.plasterFleck))
  const tone = mix(float(1), cloud, L.plasterCloud).add(drift).add(grain).add(trowel)
  const albedo = L.plaster.mul(tone).toVar()
  const rough = mix(L.plasterRough.sub(.1), L.plasterRough.add(.14), sample.roughness.mul(.6).add(tooth.roughness.mul(.4))).clamp(.3, .95).toVar()
  // the broad trowel and the fine tooth, one relief: the heads read it too
  const bump = vec2(mx_noise_float(vec3(fleckAt, 11.2)), mx_noise_float(vec3(fleckAt, 13.9))).mul(fleckFade.mul(L.plasterFleckRelief))
  const relief = vec3(sample.normal.x.mul(L.plasterNormal).add(tooth.normal.x.mul(L.plasterTooth)).add(grit.x.mul(L.plasterSand)).add(bump.x),
    sample.normal.y.mul(L.plasterNormal).add(tooth.normal.y.mul(L.plasterTooth)).add(grit.y.mul(L.plasterSand)).add(bump.y), 1)
  const world = bendWorld(t, b, n, relief, 1).toVar()
  m.colorNode = albedo
  m.roughnessNode = rough
  m.normalNode = world.transformDirection(cameraViewMatrix)
  m.aoNode = sample.occlusion
  m.emissiveNode = hangSurfaceLight(albedo, rough, float(0), PICTURE_LOOKS, true, world)
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/plaster'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE BUILDING'S CONCRETE: the frieze, the bulkhead, the soffit and its ribs,
 * the formwork photograph at the hall's own size, the soffit cooler. */
function concreteMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 2.71 })
  const down = n.y.lessThan(-.5)
  const drift = mx_noise_float(P.mul(.11)).mul(.06).add(mx_noise_float(P.mul(.37)).mul(.03))
  m.colorNode = sample.colour.mul(select(down, L.soffitTint, L.concreteTint)).mul(drift.add(1))
  m.roughnessNode = mix(float(.66), float(.95), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .9)
  m.aoNode = sample.occlusion
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/concrete'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** SMOKED OAK BOARDS laid along the room: each board its own piece of the
 * photograph at its own length, the ends broken row by row, a board's own
 * tone; oiled to a satin, worn paler and duller along the walk and at the
 * doors, the dust of the walk at its edges. */
const BOARD = { width: .19, short: 2.1, long: 4.2 } as const
function floorMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .45, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = P.x, north = P.z.negate()
  const row = floorOf(north.div(BOARD.width))
  const length = float(BOARD.short).add(hash(row, float(0), 1.3).mul(BOARD.long - BOARD.short))
  const shift = hash(row, float(0), 7.9).mul(length)
  const along = east.add(shift)
  const board = floorOf(along.div(length))
  const h1 = hash(row, board, 3.1), h2 = hash(row, board, 5.7), h3 = hash(row, board, 9.2)
  // the grain along the board: the photograph's v along east, u across it
  const sample = set.sample({ uv: vec2(north.add(h1.mul(9.1)), east.add(h2.mul(13.7))), metres: 1.83 })
  const { east: pe, north: pn } = axisFootprint(P)
  const cut = (c: N, period: N, width: number, pixel: N): N => {
    const f = fract(c.div(period)), edge = f.min(float(1).sub(f)).mul(period)
    return lineCoverage(edge, width, period, pixel)
  }
  const joint = cut(north, float(BOARD.width), .0016, pn).max(cut(along, length, .0012, pe))
  // the walk: the room is read along its length, three metres off the hang
  const fromWalk = abs(north.add(38.6))
  const walked = smoothstep(1.9, .5, fromWalk).mul(float(.75).add(h3.mul(.5))).clamp(0, 1)
  const doors = smoothstep(1.6, .2, vec2(east.add(60.9), north.add(41.8)).length())
    .max(smoothstep(1.6, .2, vec2(east.add(23.14), north.add(41.8)).length()))
  const wear = walked.max(doors).mul(L.floorWear)
  const dust = walked.mul(walked.oneMinus()).mul(4).mul(L.floorWear.mul(.3))
  const tone = float(1).add(h1.sub(.5).mul(.16))
  const albedo = sample.colour.mul(L.floorTint).mul(tone).mul(float(1).add(wear.mul(.55)))
    .mul(float(1).sub(dust.mul(.25))).mul(float(1).sub(joint.mul(.6))).toVar()
  const rough = L.floorRough.add(sample.roughness.sub(.5).mul(.2)).add(wear.mul(.5)).add(joint.mul(.25)).clamp(.18, .95).toVar()
  m.colorNode = albedo
  m.roughnessNode = rough
  // the heads' beams fall down the wall and onto the boards in front of it
  m.emissiveNode = hangSurfaceLight(albedo, rough, float(0), PICTURE_LOOKS, false)
  m.normalNode = bend(vec3(0, 0, -1), vec3(1, 0, 0), n, sample.normal, .45)
  m.aoNode = sample.occlusion
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/oak-floor'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** A DARK HONED STONE: the glazing's band, the thresholds and the gaps' backs. */
function darkMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.5 })
  m.colorNode = sample.colour.mul(L.darkTint)
  m.roughnessNode = mix(float(.34), float(.62), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .5)
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/dark-stone'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE FRAMES' DARK OILED OAK, its grain along each member: the frame's own
 * uv runs `u` along the member and `v` round the section. */
function frameOakMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .4, metalness: 0, side: FrontSide })
  const n = normalWorldGeometry, at = uv()
  // the oak laid a size under the veneer's own, so its grain holds at the
  // distance a label is read from; its figure bent along each member
  const sample = set.sample({ uv: vec2(at.y, at.x), metres: L.frameGrain })
  // the slip at the sight edge is bronze, carried on the same mesh
  const metal = attribute('metal', 'float').greaterThan(.5)
  const worn = mx_noise_float(positionWorld.mul(9.3)).mul(.5).add(.5)
  const albedo = select(metal, L.bronze.mul(worn.mul(.2).add(.9)), sample.colour.mul(L.frameTint)).toVar()
  const rough = select(metal, float(.3).add(worn.mul(.12)), mix(L.frameRough.sub(.14), L.frameRough.add(.1), sample.roughness).clamp(.2, .98)).toVar()
  const metalness = select(metal, float(1), float(0)).toVar()
  const along = attribute('along', 'vec3')
  const round = cross(along, n).normalize()
  const world = select(metal, n, bendWorld(round, along, n, sample.normal, L.frameRelief)).toVar()
  m.colorNode = albedo
  m.roughnessNode = rough
  m.metalnessNode = metalness
  // THE OUTER SIDE faces along the wall and takes no head: what it reads by
  // is the pool its frame stands in, off the lining beside it and off its
  // own oiled sheen, so its grain holds instead of going to a slab
  const P = positionWorld
  const side = float(1).sub(smoothstep(.3, .75, abs(n.z))).mul(select(metal, float(0), float(1)))
  const beside = vec3(P.x.add(n.x.mul(.06)), P.y.add(n.y.mul(.06)), float(-ROOM.finish - .002))
  const sideLight = albedo.mul(hangWallPool(beside)).mul(L.frameSide).mul(side)
  m.emissiveNode = hangSurfaceLight(albedo, rough, metalness, PICTURE_LOOKS, true, world).add(sideLight)
  m.normalNode = world.transformDirection(cameraViewMatrix)
  // an oiled frame takes the room's light as a sheen, not as a grey film
  m.envMapIntensity = .45
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/frame-oak'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** OILED OAK for the benches, its grain along each bench and up its legs: the
 * top glued up from boards across its width, each board its own piece of the
 * photograph drawn out along the grain as a sawn board's figure runs, its
 * rings fine and sharp at a sitter's distance. */
const BENCH_BOARD = .118
function benchOakMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .55, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = attribute('grain', 'float').greaterThan(.5)
  const along = select(east, vec3(1, 0, 0), vec3(0, 1, 0))
  const end = abs(dot(n, along)).greaterThan(.5)
  const grain = select(end, vec3(0, 0, -1), along)
  const t = cross(grain, n).normalize()
  const board = floorOf(P.z.div(BENCH_BOARD))
  const b1 = hash(board, float(0), 2.3), b2 = hash(board, float(0), 6.1), b3 = hash(board, float(0), 8.7)
  const u = dot(P, t), v = dot(P, grain)
  const sample = set.sample({ uv: vec2(u.add(b1.mul(7.3)), v.add(b2.mul(11.9))), metres: [.6, 2.3] })
  // THE RINGS a pixel can hold: late wood lines along the board, their run
  // bent a little, read as their mean where a pixel holds several
  const ringAt = u.add(mx_noise_float(vec3(v.mul(.9), u.mul(7), b3.mul(9))).mul(.006))
    .add(mx_noise_float(vec3(v.mul(6), u.mul(40), 2.1)).mul(.0009)).div(.0023)
  const ringF = fract(ringAt)
  const sharp = float(1).sub(smoothstep(.3, .75, TSL.fwidth(ringAt)))
  const lateRing = smoothstep(.58, .8, ringF).mul(float(1).sub(smoothstep(.84, 1, ringF))).sub(.22).mul(sharp).add(.22)
  const faceGrain = sample.colour.mul(L.benchTint).mul(float(1).add(b3.sub(.5).mul(.12))).mul(float(1.03).sub(lateRing.mul(.14)))
  // THE END OF A BOARD SHOWS ITS RINGS: arcs round a heart that lies under
  // and beside the board, the late wood dark, the rays across them, the cut
  // end drinking the oil darker than the face
  const off = P.sub(attribute('heart', 'vec3'))
  const radial = off.sub(along.mul(dot(off, along)))
  const wobble = mx_noise_float(P.mul(9)).mul(.0014)
  const r = length(radial).add(wobble)
  const ring = fract(r.div(.0045))
  // a ring finer than the pixel it falls in is read as its average, not as a moiré
  const resolved = float(1).sub(smoothstep(.25, .7, TSL.fwidth(r).div(.0045)))
  const late = smoothstep(.55, .9, ring).mul(float(1).sub(smoothstep(.9, 1, ring))).sub(.19).mul(resolved).add(.19)
  const turn = TSL.atan(dot(radial, t), dot(radial, cross(along, t)))
  const ray = smoothstep(.8, .97, mx_noise_float(vec3(turn.mul(260), length(radial).mul(40), 1.7)).mul(.5).add(.5))
  const endGrain = sample.colour.mul(L.benchTint).mul(float(.6).sub(late.mul(.2)).add(ray.mul(.12)))
  // the shoes under the legs are dark bronze, carried on the same mesh
  const metal = attribute('metal', 'float').greaterThan(.5)
  m.colorNode = select(metal, L.bronze.mul(.55), select(end, endGrain, faceGrain))
  m.roughnessNode = select(metal, float(.42), select(end, float(.72), mix(float(.4), float(.66), sample.roughness)))
  m.metalnessNode = select(metal, float(1), float(0))
  m.normalNode = select(metal, n.transformDirection(cameraViewMatrix), bend(t, grain, n, sample.normal, .7))
  m.aoNode = select(metal, float(1), sample.occlusion)
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/bench-oak'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE ARCH MATS in the frames' own oak, laid on the wall's plane: a mat
 * over the shoulders of a photograph taken with its arched frame. */
function maskMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .45, metalness: 0, side: DoubleSide })
  const P = positionWorld, n = normalWorldGeometry
  const sample = set.sample({ uv: vec2(P.y, P.x), metres: 1.83 })
  const albedo = sample.colour.mul(L.frameTint).toVar()
  const rough = mix(float(.32), float(.58), sample.roughness).toVar()
  m.colorNode = albedo
  m.roughnessNode = rough
  m.emissiveNode = hangSurfaceLight(albedo, rough, float(0))
  m.normalNode = n.transformDirection(cameraViewMatrix)
  m.outputNode = withRoomAir(output)
  m.name = 'vinci/collection-picture-room/arch-mat'
  m.userData = { ...PICTURE_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE ROOM SEEN IN ITS FLOOR: the reflected ray carried to the room's own
 * box and read off the probe from where the probe stands, so a pool on the
 * wall lands in the boards in front of its work and not at the probe's feet.
 * An engine term standing for the second pass a planar mirror would cost. */
function boxReflection(probe: N, probeAt: [number, number, number], rough: N): N {
  const P = positionWorld, n = normalWorldGeometry
  const V = cameraPosition.sub(P).normalize()
  const R = V.negate().reflect(n)
  const lo = vec3(ROOM.westFinish, ROOM.floor, -WINDOW.north), hi = vec3(ROOM.east, ROOM.soffit, -ROOM.finish)
  const safe = R.sign().mul(max(R.abs(), float(1e-4)))
  const t1 = lo.sub(P).div(safe), t2 = hi.sub(P).div(safe)
  const far = max(t1, t2), t = min(min(far.x, far.y), far.z).max(0)
  const hit = P.add(R.mul(t))
  const dir = hit.sub(vec3(probeAt[0], probeAt[2], -probeAt[1])).normalize()
  const facing = n.dot(V).clamp(0, 1)
  const fresnel = float(.04).add(float(.96).mul(pow(float(1).sub(facing), 5)))
  return probe(dir, rough).mul(fresnel)
}

export interface PictureRoom {
  /** the finish, the frames, the benches and the fittings, to ride with the rooms */
  group: Group
  /** the arch mats' finish: the frame's own oak */
  maskMaterial: Material
  /** every set on the GPU */
  ready: Promise<void>
  /** How many takes of the room's bounce are still owed. A take is drawn in
   * a frame of its own, with the bodies it must see shown for its length. */
  tick(bodies: readonly Object3D[]): void
  dispose(): void
}

/** The calm tier takes no probe: the hero tier's bounce read as a fill,
 * cooler from the glazing side. */
const CALM_FILL = { up: [.05, .05, .052], down: [.034, .034, .036], window: [.05, .055, .065] } as const

export function mountPictureRoom(stack: Stack): PictureRoom {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks(), H = PICTURE_LOOKS
  const group = new Group()
  group.name = 'vinci/collection-picture-room'
  group.userData = { ...PICTURE_ROOM_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = []
  const frames = hangFrames()
  const frameOf = new Map(frames.map(f => [f.key, f.outer]))

  // THE LIGHTS, from the one table that builds the fittings too
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const solo = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('picturesolo')
  const lamps = hangLamps()
  const heads: { light: SpotLight; spec: HangLamp }[] = [], rooms: { light: Light; spec: RoomLight }[] = [], targets: Object3D[] = []
  for (const spec of lamps) {
    const light = new SpotLight(new Color(LAMP_COLOUR), solo && !spec.name.includes(solo) ? 0 : spec.intensity * H.lampGain.value, 0, spec.angle, spec.penumbra, 2)
    light.position.copy(v3(...spec.at))
    const target = new Object3D()
    target.position.copy(v3(...spec.aim))
    light.target = target
    // A PHYSICAL HEAD, AS DATA: the lens's pool round its frame (or the
    // projector's cut) rides with it for a renderer that traces it. The page
    // itself evaluates each head only where it can land (`hangSurfaceLight`).
    light.name = `vinci/collection-picture-room/${spec.name}`
    light.userData = { ...PICTURE_ROOM_PROVENANCE, pool: frameOf.get(spec.key), poolMargin: H.poolMargin.value,
      poolSoft: H.poolSoft.value, shutter: spec.shutter ?? null, level: spec.level }
    // hidden from the scene's own list, which every other surface reads;
    // still in the graph, so its matrices follow
    light.visible = false
    group.add(light, target)
    targets.push(target)
    heads.push({ light, spec })
  }
  for (const spec of ROOM_LIGHTS) {
    if (calm && spec.shadow) continue
    const level = solo && !spec.name.startsWith(solo) ? 0 : spec.intensity
    let light: Light
    if (spec.kind === 'sky') {
      const sky = new DirectionalLight(new Color(spec.colour), level)
      sky.position.copy(v3(...spec.at))
      const target = new Object3D()
      target.position.copy(v3(...spec.aim))
      sky.target = target
      targets.push(target)
      group.add(target)
      if (spec.shadow) {
        const px = tier === 'hero' ? spec.shadow.mapPx : Math.max(512, spec.shadow.mapPx / 2)
        sky.castShadow = true
        sky.shadow.mapSize.set(px, px)
        const [across, up] = spec.shadow.span
        Object.assign(sky.shadow.camera, { left: -across, right: across, top: up, bottom: -up, near: 1, far: 90 })
        sky.shadow.camera.updateProjectionMatrix()
        sky.shadow.bias = -.0003
        sky.shadow.normalBias = .02
        sky.shadow.radius = spec.shadow.soft
        // the map is drawn from the room's own casters alone
        sky.shadow.camera.layers.set(PICTURE_SHADOW_LAYER)
      }
      light = sky
    } else if (spec.kind === 'spot') {
      const spot = new SpotLight(new Color(spec.colour), level, 0, spec.angle, spec.penumbra, 2)
      spot.position.copy(v3(...spec.at))
      const target = new Object3D()
      target.position.copy(v3(...spec.aim))
      spot.target = target
      targets.push(target)
      group.add(target)
      light = spot
    } else {
      const area = new RectAreaLight(new Color(spec.colour), level, spec.width!, spec.height!)
      area.position.copy(v3(...spec.at))
      area.lookAt(v3(...spec.aim))
      light = area
    }
    light.name = `vinci/collection-picture-room/${spec.name}`
    light.userData = { ...PICTURE_ROOM_PROVENANCE }
    light.visible = false
    group.add(light)
    rooms.push({ light, spec })
  }
  const roomAll = rooms.filter(({ spec }) => spec.receivers === 'room').map(({ light }) => light)
  const floorAll = rooms.map(({ light }) => light)
  const rig = { wall: roomAll, floor: floorAll, ceiling: roomAll }

  // THE ROOM'S BOUNCE: a probe at the room's middle, taken turned by the
  // scene's own environment turn and re-taken into the same target
  let generator: PMREMGenerator | undefined, probe: { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget } | undefined
  let env: N
  let reflection: ((direction: N, roughness: N) => N) | null = null
  if (!calm) {
    generator = new PMREMGenerator(stack.renderer)
    const target = new CubeRenderTarget(tier === 'hero' ? 256 : 128, { type: HalfFloatType })
    const camera = new CubeCamera(.05, 2400, target)
    camera.position.copy(v3(...PROBE_AT))
    probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
    env = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
    const texture = probe.pmrem.texture
    reflection = (direction, roughness) => pmremTexture(texture, direction, roughness).mul(L.envGain)
  } else {
    const n = normalWorldGeometry
    const up = vec3(...CALM_FILL.up), down = vec3(...CALM_FILL.down), side = vec3(...CALM_FILL.window)
    env = mix(down, up, n.y.mul(.5).add(.5)).add(side.mul(n.z.negate().max(0))).mul(L.envGain).mul(L.envLift)
  }
  const adopt = (material: Material, lights: readonly Light[]): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf([...lights])
    lit.envNode = env
    material.needsUpdate = true
  }

  // THE SURFACES
  const [concreteSet, oakSet, stoneSet] = SETS.map(name => stack.materials.sync(name))
  // the plaster is trowelled over the sealed floor's own photograph: burnished,
  // jointless, and a set the page already holds
  const plaster = plasterMaterial(stoneSet!, L)
  const concrete = concreteMaterial(concreteSet!, L)
  const floor = floorMaterial(oakSet!, L)
  if (reflection) floor.emissiveNode = (floor.emissiveNode as N).add(boxReflection(reflection, PROBE_AT, L.floorGloss).mul(L.floorMirror))
  const dark = darkMaterial(stoneSet!, L)
  const frameOak = frameOakMaterial(oakSet!, L)
  const benchOak = benchOakMaterial(oakSet!, L)
  // the arch mats: the frame's own oak, read off the world as a mat is laid
  const mask = maskMaterial(oakSet!, L)
  for (const m of [plaster, dark, frameOak, mask]) adopt(m, rig.wall)
  adopt(concrete, rig.ceiling)
  for (const m of [floor, benchOak]) adopt(m, rig.floor)
  materials.push(plaster, concrete, floor, dark, frameOak, benchOak, mask)

  const make = (geometry: BufferGeometry, material: Material, name: string, receive = true): Mesh => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-picture-room/${name}`
    mesh.castShadow = false; mesh.receiveShadow = receive
    mesh.userData = { ...PICTURE_ROOM_PROVENANCE, asset: PICTURE_ROOM_PROVENANCE.manifestId, labelOccluder: false }
    // a skin lies over the certified construction: a ray meets that first
    mesh.raycast = () => {}
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const merged = (parts: BufferGeometry[]): BufferGeometry => {
    const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p))
    for (const p of parts) p.dispose()
    return g
  }
  const skin = (s: Skin): BufferGeometry => s.geometry()
  const solid = (s: Solid): BufferGeometry => merged(s.parts)

  const walls = wallSkins()
  make(merged([skin(walls.plaster), skin(walls.frieze)]), plaster, 'plaster')
  make(skin(ceilingSkin()), concrete, 'concrete')
  const floors = floorSkins()
  make(skin(floors.oak), floor, 'oak-floor')
  make(merged([skin(floors.stone), skin(walls.backing)]), dark, 'dark-stone')
  // ONE MESH PER FINISH FAMILY: a bronze part rides with its oak, a lamp's
  // face with its head, each told apart by a vertex's own flag
  const flag = (g: BufferGeometry, name: string, value: number): BufferGeometry => {
    g.setAttribute(name, new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(value), 1))
    return g
  }
  const frameParts = frameGeometry(frames)
  // the numbers are cast in the slip's bronze and ride on the frames' mesh
  make(merged([flag(frameParts.oak, 'metal', 0), flag(frameParts.bronze, 'metal', 1), flag(frameParts.numbers, 'metal', 1)]), frameOak, 'frames')
  const bench = benches()
  const hearted = (g: BufferGeometry): BufferGeometry => {
    g.setAttribute('heart', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3))
    return g
  }
  make(merged([...bench.oak.parts.map(g => flag(g, 'metal', 0)), ...bench.bronze.parts.map(g => hearted(flag(flag(g, 'grain', 0), 'metal', 1)))]), benchOak, 'benches')
  {
    const { metal, lenses } = fittings()
    const anodised = new MeshStandardNodeMaterial({ roughness: .38, metalness: .8 })
    const lit = attribute('lens', 'float').greaterThan(.5)
    anodised.colorNode = select(lit, vec3(0, 0, 0), vec3(.0085, .009, .01))
    anodised.emissiveNode = select(lit, vec3(new Color(LAMP_COLOUR).r, new Color(LAMP_COLOUR).g, new Color(LAMP_COLOUR).b).mul(L.lens), vec3(0, 0, 0))
    anodised.name = 'vinci/collection-picture-room/fixtures'
    adopt(anodised, rig.ceiling)
    materials.push(anodised)
    make(merged([...metal.parts.map(g => flag(g, 'lens', 0)), ...lenses.parts.map(g => flag(g, 'lens', 1))]), anodised, 'fixtures', false)
  }

  // THE BEAMS IN THE AIR: a faint glow of the room's air the first
  // metre of every beam, brightest at the lens, an engine term like the air
  {
    const cones: BufferGeometry[] = []
    for (const lamp of lamps) {
      const { at, axis } = lensOf(lamp)
      const reach = GLOW_REACH, wide = Math.tan(lamp.angle * (1 - lamp.penumbra)) * reach
      const g = new CylinderGeometry(wide, .045, reach, 28, 1, true)
      g.applyMatrix4(new Matrix4().compose(at.clone().addScaledVector(axis, reach / 2),
        new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis), new Vector3(1, 1, 1)))
      cones.push(g.toNonIndexed())
      g.dispose()
    }
    const air = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide })
    // the air lit along the beam: thicker where the eye looks through it,
    // fading from the lens over the first metre
    const along = uv().y, facing = abs(dot(normalWorldGeometry, cameraPosition.sub(positionWorld).normalize()))
    air.colorNode = H.lampColour.mul(L.glow).mul(pow(facing, 3)).mul(pow(float(1).sub(along), 2.2))
      .mul(TSL.exp(along.mul(-2.2))).mul(H.engineTerms)
    air.blending = AdditiveBlending
    air.name = 'vinci/collection-picture-room/beam-air'
    materials.push(air)
    const mesh = make(merged(cones), air, 'beam-air', false)
    mesh.renderOrder = 3
  }

  // THE NEXT ROOMS THROUGH THE DOORS: a daylit room seen from the dim hang
  // reads lower and cooler to an eye settled to the hang. A grade across the
  // back of each opening, faced into this room alone, gone as the eye nears
  // the door; an engine term, as the air is
  {
    const quads: BufferGeometry[] = []
    for (const door of DOORWAYS) {
      const width = door.east - door.west + .02, height = ROOM.friezeFoot - ROOM.floor + .02
      const g = new PlaneGeometry(width, height)
      g.rotateY(Math.PI)
      const at = v3((door.west + door.east) / 2, REVEAL.back, (ROOM.floor + ROOM.friezeFoot) / 2)
      g.translate(at.x, at.y, at.z)
      const count = g.getAttribute('position').count
      g.setAttribute('door', new Float32BufferAttribute(Array.from({ length: count }, () => [at.x, at.z]).flat(), 2))
      quads.push(g.toNonIndexed())
      g.dispose()
    }
    const grade = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: FrontSide, fog: false })
    const near = length(cameraPosition.xz.sub(attribute('door', 'vec2')))
    const keep = smoothstep(L.doorNear, L.doorFar, near).mul(H.engineTerms)
    grade.colorNode = mix(vec3(1, 1, 1), L.doorKeep, keep)
    grade.blending = CustomBlending
    grade.blendSrc = DstColorFactor
    grade.blendDst = ZeroFactor
    grade.blendSrcAlpha = ZeroFactor
    grade.blendDstAlpha = OneFactor
    grade.toneMapped = false
    grade.name = 'vinci/collection-picture-room/door-grade'
    materials.push(grade)
    const mesh = make(merged(quads), grade, 'door-grade', false)
    mesh.renderOrder = 4
  }

  // THE VARNISH: one film over every reproduction, a hair in front of it,
  // stamped with its work's heads, drawn additively after the plates
  {
    const quads: BufferGeometry[] = []
    for (const f of frames) {
      const g = new PlaneGeometry(f.width, f.height)
      g.rotateY(Math.PI)
      g.translate(f.east, f.datum, -(f.canvasNorth + .0004))
      stampHangLight(g, f.key)
      quads.push(g.toNonIndexed())
      g.dispose()
    }
    const film = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: FrontSide })
    film.colorNode = varnishFilm(reflection, H)
    film.blending = AdditiveBlending
    film.toneMapped = false
    film.name = 'vinci/collection-picture-room/varnish'
    materials.push(film)
    const mesh = make(merged(quads), film, 'varnish', false)
    mesh.renderOrder = 2
  }

  if (!calm) {
    // THE CASTERS, seen only by the room's daylight
    const hidden = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    hidden.shadowSide = DoubleSide
    hidden.name = 'vinci/collection-picture-room/shadow-double'
    materials.push(hidden)
    const casters = make(solid(shadowCasters()), hidden, 'shadow-double', false)
    casters.layers.set(PICTURE_SHADOW_LAYER)
    casters.castShadow = true
  }

  // `?picturerig` hands an instrument the rig's levels and the looks, to lean
  // on a standing frame instead of rebuilding the page for each value
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('picturerig')) {
    const full = new Map<Light, number>([
      ...heads.map(({ light, spec }) => [light, spec.intensity] as [Light, number]),
      ...rooms.map(({ light, spec }) => [light, spec.intensity] as [Light, number]),
    ])
    const all = [...heads.map(({ light, spec }) => ({ light, name: spec.name })), ...rooms.map(({ light, spec }) => ({ light, name: spec.name }))]
    ;(window as unknown as Record<string, unknown>)['__pictureRig'] = {
      names: all.map(({ name }) => name),
      solo(name: string | null) {
        for (const { light, name: own } of all) light.intensity = name === null || own.includes(name) ? full.get(light)! * (heads.some(h => h.light === light) ? H.lampGain.value : 1) : 0
      },
      level(name: string, value: number) {
        for (const { light, name: own } of all) if (own.startsWith(name)) { light.intensity = value; full.set(light, value) }
      },
      gain(value: number) {
        H.lampGain.value = value
        for (const { light, spec } of heads) light.intensity = spec.intensity * value
      },
      looks: L, hang: H,
      bake: () => { owed = 3 },
    }
  }

  let owed = 0, live = true
  // three takes, so the bounce carries two bounces of its own
  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 3 }, () => { if (live) owed = 3 })

  function take(bodies: readonly Object3D[]): void {
    if (!probe || !generator) return
    let scene: Object3D = group
    while (scene.parent) scene = scene.parent
    const root = scene as Scene
    if (!root.isScene) return
    probe.camera.rotation.copy(root.environmentRotation)
    probe.camera.updateMatrixWorld(true)
    L.envGain.value = 1 / Math.max(.01, root.environmentIntensity)
    const shown = bodies.map(body => body.visible)
    for (const body of bodies) body.visible = true
    try { probe.camera.update(stack.renderer, root) } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
    generator.fromCubemap(probe.target.texture, probe.pmrem)
  }

  return {
    group,
    maskMaterial: mask,
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    dispose() {
      live = false
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose() }
      for (const m of materials) m.dispose()
      for (const { light } of [...heads, ...rooms]) { light.removeFromParent(); light.dispose() }
      for (const target of targets) target.removeFromParent()
      if (probe) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}
