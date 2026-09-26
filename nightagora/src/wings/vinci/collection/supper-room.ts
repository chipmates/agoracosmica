/** THE SUPPER ROOM: the room the Last Supper's measured field stands at the
 * end of. The field's wall is its end wall, plastered white round a reveal;
 * a concrete roof on deep beams closes it over, a top light along its south
 * wall lets the sky in over the field's left, the way the painted room's own
 * light falls, and the north side stands open on the court's afternoon. The
 * floor is fine pale marble that sends the light back up onto the wall.
 *
 * ONLY THE ROOM'S SURFACES TAKE ITS LIGHTS (`lightsNode`), and the field's
 * reproduction takes the same lights through `supperMuralLight()`: the image
 * is multiplied by the light that falls on it and is never itself changed.
 * The room is no rail solid; `supper-room-check.mjs` proves its triangles
 * clear of the walk. A modern room; no building of Milan or of 1517 is claimed.
 */
import {
  BufferGeometry, Color, CubeCamera, CubeRenderTarget, Float32BufferAttribute, FrontSide, Group, HalfFloatType, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, PMREMGenerator, RectAreaLight, RectAreaLightNode, type Light, type Material,
  type Object3D, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { kelvinToColour } from '../../../stack/light'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import { setSupperMuralLight } from './supper-light'
import {
  DOOR, END_FACE, FIELD, FINS, FLOOR_RISE, casing, NAVE_PROBE_AT, OUTLINE, PARAPET, PROBE_AT, ROOM, SILL, SPOUT, SPOUTS, SUPPER_LIGHTS,
  SUPPER_ROOM_PROVENANCE, TOP_LIGHT, v3, endWall, fins, floor as floorBody, frame, outside, roof, sillDress, southWall,
  upperEndWall, type Body, type SupperLight,
} from './supper-room-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, acos, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, length, max, min, mix, mx_noise_float,
  normalWorldGeometry, positionWorld, select, smoothstep, uniform, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The sets the room is made of, all CC0 and already in the store. */
const SETS = ['plaster-lime-aged', 'concrete-wall-formed', 'marble-white', 'limestone-pale'] as const

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

/** the tangent frame a world-aligned face is photographed in */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize().transformDirection(cameraViewMatrix)

/** THE LOOK OF EACH SURFACE, as uniforms an instrument may lean on. */
function looks() {
  return {
    /** the plaster's white (AD-2's range), the photograph only its variation */
    plasterWhite: uniform(new Color(.66, .65, .62)),
    /** how much of the photograph's staining the new plaster keeps */
    plasterKeep: uniform(.28),
    plasterNormal: uniform(.6),
    /** board-formed concrete of warm limestone aggregate (AD-2, 0.33) */
    concreteBase: uniform(new Color(.36, .345, .315)),
    concreteKeep: uniform(.85),
    concreteNormal: uniform(.85),
    marbleTint: uniform(new Color(.47, .46, .45)),
    borderTone: uniform(.8),
    naveFloor: uniform(.55),
    marbleTone: uniform(.1),
    marbleRough: uniform(.35),
    groutColour: uniform(new Color(.52, .5, .47)),
    /** the panels' batches, their brass strips, the walked floor and the dust */
    panelTone: uniform(.12),
    stripColour: uniform(new Color(.07, .055, .04)),
    wearClean: uniform(.12),
    wearPolish: uniform(.17),
    wallDust: uniform(.12),
    stoneTint: uniform(new Color(.9, .9, .9)),
    /** the diffuser as the eye sees it, over the light it gives the room */
    diffuserGlow: uniform(.72),
    /** the probe read at the scene's own level; the lift is the room's */
    envGain: uniform(1),
    envLift: uniform(.45),
    /** the field's own light: the direct terms, the bounce, the plaster's relief */
    muralDirect: uniform(1),
    muralBounce: uniform(1),
    muralRelief: uniform(.45),
    /** the white the field is lit in, and how far its light is held to it */
    muralWhite: uniform(new Color(.99, 1, 1.03)),
    muralNeutral: uniform(1),
    /** the sill's and the bay floor's own brightness, lit by the top light */
    sillGlow: uniform(new Color(.56, .55, .53)),
    floorGlow: uniform(new Color(.3, .29, .28)),
    /** Engine-only terms: a renderer that shadows the reveal itself sets 0 */
    engineTerms: uniform(1),
    /** THE OUTSIDE: how much of the photograph the pour keeps, each panel's
     * own tone, what a joint and a tie hole take, the weather's two stains */
    /** the pour outside, a warm limestone aggregate a shade paler than the
     * soffits, so it holds its warmth in the sky's shade (AD-2) */
    outsideBase: uniform(new Color(.45, .395, .33)),
    outsideKeep: uniform(.6),
    outsideNormal: uniform(.7),
    pourTone: uniform(.16),
    jointShade: uniform(.5),
    /** the grey a joint's lost fines leave either side of it */
    rimShade: uniform(.1),
    tieShade: uniform(.7),
    dripShade: uniform(.24),
    spoutShade: uniform(.45),
    /** patinated bronze: the metal where it is kept, the skin where it is not */
    bronze: uniform(new Color(.36, .25, .14)),
    patina: uniform(new Color(.13, .12, .095)),
    deckBase: uniform(new Color(.38, .37, .35)),
    /** the base course, the threshold and the floor's open edges: a hard
     * grey stone that grounds the pale pour */
    baseStone: uniform(new Color(.3, .3, .31)),
    baseGrey: uniform(.75),
    deckJoint: uniform(.8),
  }
}
type Looks = ReturnType<typeof looks>

/** WHITE COARSE PLASTER, the room's walls: the photograph's relief kept, its
 * staining laid back toward a clean white, a slow drift so no wall is flat. */
function plasterMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .92, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.6 })
  const kept = mix(float(1), sample.albedo, L.plasterKeep)
  const drift = mx_noise_float(P.mul(.21)).mul(.035).add(mx_noise_float(P.mul(.93)).mul(.02))
  m.colorNode = L.plasterWhite.mul(kept).mul(drift.add(1))
  m.roughnessNode = mix(float(.84), float(.97), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, L.plasterNormal)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-supper-room/plaster'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** BOARD-FORMED CONCRETE, the roof, its beams and piers: the hall's own
 * photograph poured paler and warmer, its boards along the room's length. */
function concreteMaterial(set: MaterialSet, L: Looks, name: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const flat = abs(n.y).greaterThan(.5)
  // the boards run east, toward the field, on the soffit and on every beam
  const t = select(flat, vec3(0, 0, -1), select(abs(n.x).greaterThan(.5), vec3(0, 0, -1), vec3(1, 0, 0)))
  const b = select(flat, vec3(1, 0, 0), vec3(0, 1, 0))
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 2.71 })
  const drift = mx_noise_float(P.mul(.13)).mul(.05).add(mx_noise_float(P.mul(.41)).mul(.025))
  m.colorNode = L.concreteBase.mul(mix(float(1), sample.albedo, L.concreteKeep)).mul(drift.add(1))
  m.roughnessNode = mix(float(.66), float(.95), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, L.concreteNormal)
  m.aoNode = sample.occlusion
  m.name = `vinci/collection-supper-room/${name}`
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE FLOOR: white marble in slabs a metre and a bit square, each cut from
 * its own piece of the stone and parted by a dark bronze strip, inside a
 * border of the same marble laid long; at the walk's distances a slab reads
 * as stone, where a mosaic's joints read as a printed grid. */
/** the border's width, and the lines it is laid to */
const BORDER = .32, FINS_FRONT = FINS.front, SILL_EAST = SILL.east
/** the slabs inside the border, measured from the border's inner corner at
 * the step, and the brass strip between them */
const PANEL = { size: 1.2, strip: .008, east: ROOM.step + BORDER, north: FINS.front + BORDER } as const
/** the line the way in is walked along: the middle of the nave's floor */
const WALK_NORTH = (FINS.front + ROOM.naveNorth) / 2
function marbleMaterial(set: MaterialSet, L: Looks, shade: N = float(1)): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .34, metalness: 0, side: FrontSide })
  const P = positionWorld
  const east = P.x, north = P.z.negate()
  const ue = east.sub(PANEL.east).div(PANEL.size), un = north.sub(PANEL.north).div(PANEL.size)
  const i = floorOf(ue), j = floorOf(un)
  const h1 = hash(i, j, 5.3), h2 = hash(i, j, 9.1)
  // each slab shows its own piece of the stone, its veins run on across it
  const sample = set.sample({ uv: vec2(east, north).add(vec2(h1, h2).mul(3.7)), metres: 1.2 })
  const coarse = set.sample({ uv: vec2(east, north).mul(.37).add(vec2(11.2, 4.4)), metres: 2.4 })
  const { east: pe, north: pn } = axisFootprint(P)
  const pixel = max(pe, pn)
  const tone = float(1).add(h1.sub(.5).mul(L.marbleTone)).add(h2.sub(.5).mul(L.marbleTone.mul(.4)))
  const stone = sample.colour.mul(.55).add(coarse.colour.mul(.45)).mul(L.marbleTint).mul(tone).mul(shade)
  // A BORDER OF THE SAME MARBLE LAID LONG, a shade darker, round every edge
  // the floor meets, and across the step where the nave gives onto the bay
  const inBay = east.lessThan(ROOM.step)
  const toWall = min(
    select(inBay, north.sub(ROOM.baySouth), north.sub(FINS_FRONT)),
    select(inBay, float(ROOM.north).sub(north), float(ROOM.naveNorth).sub(north)))
  const toEnd = min(east.sub(SILL_EAST), abs(east.sub(ROOM.step)))
  const edge = min(toWall, toEnd)
  const band = smoothstep(BORDER + .004, BORDER - .004, edge)
  const seam = lineCoverage(edge.sub(BORDER), .0016, 1, pixel)
  // THE SLABS: each from its own batch of the stone, parted by a dark bronze strip
  const panelTone = float(1).add(hash(i, j, 3.7).sub(.5).mul(L.panelTone))
  // each strip is held by the pixel's own reach across it, not the floor's
  // longest: a strip running away from the eye stays drawn where the ones
  // across the view have become a tone
  const toE = min(fract(ue), float(1).sub(fract(ue))).mul(PANEL.size), toN = min(fract(un), float(1).sub(fract(un))).mul(PANEL.size)
  const strip = lineCoverage(toE, PANEL.strip / 2, PANEL.size, pe).max(lineCoverage(toN, PANEL.strip / 2, PANEL.size, pn))
    .mul(float(1).sub(band))
  // THE WEAR: the walk down the way in and the place before the field are
  // walked smooth and a little cleaner; the floor along the walls keeps dust
  const walked = select(inBay, smoothstep(SILL_EAST + .15, SILL_EAST + .9, east),
    smoothstep(1.25, .35, abs(north.sub(WALK_NORTH))))
  const scuff = mx_noise_float(vec3(east.mul(.8), north.mul(.8), 2.3)).mul(.5).add(.5)
  const wear = walked.mul(scuff.mul(.5).add(.5)).mul(float(1).sub(band))
  const dust = smoothstep(BORDER * 1.4, 0, edge).mul(mx_noise_float(vec3(east.mul(3.1), north.mul(3.1), 5.9)).mul(.3).add(.7))
  const laid = mix(stone.mul(panelTone), stone.mul(L.borderTone), band)
    .mul(float(1).add(wear.mul(L.wearClean))).mul(float(1).sub(dust.mul(L.wallDust)))
  const grouted = mix(laid, L.groutColour, seam.mul(.9))
  m.colorNode = mix(grouted, L.stripColour, strip.mul(.9))
  m.roughnessNode = L.marbleRough.add(h2.sub(.5).mul(.08)).add(band.mul(.08))
    .sub(wear.mul(L.wearPolish)).add(dust.mul(.1)).mul(float(1).sub(strip.mul(.3))).clamp(.08, 1)
  m.name = 'vinci/collection-supper-room/marble'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE SILL IN PALE LIMESTONE, honed. */
function stoneMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.6 })
  m.colorNode = sample.colour.mul(L.stoneTint)
  m.roughnessNode = mix(float(.42), float(.66), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .5)
  m.name = 'vinci/collection-supper-room/limestone'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/* ---- the outside --------------------------------------------------------- */

/** The pour the walls are cast in: panels of the building's own size, a tie
 * hole on a 0.6 m grid inside each, the joints a hand wide at most. */
const POUR = { u: 2.4, v: 1.2, joint: .005, tie: .6, tieR: .013 } as const

/** THE OUTSIDE'S CONCRETE: the room's own photograph under a pour of panels,
 * each its own tone, its joints and tie holes drawn only where a pixel holds
 * them, and the weather where the water runs: a drift of streaks under every
 * coping, and a darker, greener run under each bronze spout. */
function outsideMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .88, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const u = dot(P, t), v = dot(P, b).sub(ROOM.floor)
  const sample = set.sample({ uv: vec2(u, v), metres: 2.71 })
  const pu = u.dFdx().abs().add(u.dFdy().abs()).max(1e-5), pv = v.dFdx().abs().add(v.dFdy().abs()).max(1e-5)
  const toJoint = (x: N, period: number): N => { const f = fract(x.div(period)); return min(f, float(1).sub(f)).mul(period) }
  const joint = lineCoverage(toJoint(u, POUR.u), POUR.joint, POUR.u, pu).max(lineCoverage(toJoint(v, POUR.v), POUR.joint, POUR.v, pv))
  const rim = lineCoverage(toJoint(u, POUR.u), .03, POUR.u, pu).max(lineCoverage(toJoint(v, POUR.v), .03, POUR.v, pv))
  // a tie hole is a small cone: drawn where the pixel is finer than it, its
  // own share of the pixel where it is not
  const tu = fract(u.div(POUR.tie)).sub(.5).mul(POUR.tie), tv = fract(v.div(POUR.tie)).sub(.5).mul(POUR.tie)
  const px = max(pu, pv), r = float(POUR.tieR)
  const share = r.mul(2).div(px).min(1)
  const hole = smoothstep(r.add(px.mul(.5)), r.sub(px.mul(.5)).max(0), vec2(tu, tv).length()).mul(share.mul(share))
  const salt = n.x.mul(3.1).add(n.z.mul(7.3))
  const iu = floorOf(u.div(POUR.u)), iv = floorOf(v.div(POUR.v))
  const tone = float(1).add(hash(iu.add(salt), iv, 2.7).sub(.5).mul(L.pourTone))
  const drift = mx_noise_float(P.mul(.13)).mul(.04).add(mx_noise_float(P.mul(.47)).mul(.02))
  // THE WEATHER, on the walls only: under each coping, streaks that fade
  // over the first metres; under each spout, one run that widens as it falls
  const wall = float(1).sub(abs(n.y).mul(2).clamp(0, 1))
  const east = P.x, north = P.z.negate()
  const copingFoot = select(east.lessThan(OUTLINE.nave.west + .01), float(OUTLINE.bay.top + PARAPET.rise - PARAPET.drip), float(OUTLINE.nave.top + PARAPET.rise - PARAPET.drip))
  const below = copingFoot.sub(P.y)
  // the coping sheds unevenly: runs gather along some stretches and not
  // others, and each falls its own length
  const gather = smoothstep(.35, .75, mx_noise_float(vec3(u.mul(.7), 11.3, 2.9)).mul(.5).add(.5))
  const reach = mx_noise_float(vec3(u.mul(2.3), 4.2, 7.7)).mul(.5).add(.5).mul(2.4).add(.6)
  const streak = smoothstep(.3, .8, mx_noise_float(vec3(u.mul(4.7), P.y.mul(.3), 3.1)).mul(.5).add(.5)).mul(gather.mul(.8).add(.2))
    .mul(smoothstep(-.01, .05, below)).mul(smoothstep(reach, .1, below))
  let run: N = float(0)
  for (const s of SPOUTS) {
    const fall = float(s.top + SPOUT.lift).sub(P.y)
    const width = fall.mul(.07).add(SPOUT.width * .45)
    const onFace = smoothstep(.04, .01, abs(east.sub(s.face))).mul(smoothstep(.5, .8, n.x))
    const ragged = mx_noise_float(vec3(north.mul(9), P.y.mul(1.3), 5.7)).mul(.25).add(.85)
    run = max(run, smoothstep(width, width.mul(.35), abs(north.sub(s.north))).mul(smoothstep(-.02, .08, fall)).mul(smoothstep(4.5, .3, fall)).mul(onFace).mul(ragged))
  }
  const stain = mix(vec3(1, 1, 1), vec3(.8, .86, .83), run).mul(float(1).sub(run.mul(L.spoutShade)))
  const kept = mix(float(1), sample.albedo, L.outsideKeep)
  m.colorNode = L.outsideBase.mul(kept).mul(tone).mul(drift.add(1))
    .mul(float(1).sub(joint.mul(L.jointShade))).mul(float(1).sub(rim.mul(L.rimShade))).mul(float(1).sub(hole.mul(L.tieShade)))
    .mul(float(1).sub(streak.mul(L.dripShade).mul(wall))).mul(mix(vec3(1, 1, 1), stain, wall))
  m.roughnessNode = mix(float(.8), float(.95), sample.roughness).add(run.mul(-.12))
  m.normalNode = bend(t, b, n, sample.normal, L.outsideNormal)
  m.aoNode = sample.occlusion.mul(float(1).sub(joint.mul(.35))).mul(float(1).sub(hole.mul(.5)))
  m.name = 'vinci/collection-supper-room/concrete-out'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE BASE'S STONE: the same honed limestone photograph, greyed and
 * darkened to a hard stone, so the foot of the wall reads as its own course. */
function baseStoneMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .6, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.6 })
  const grey = dot(sample.albedo, vec3(.2126, .7152, .0722))
  m.colorNode = L.baseStone.mul(mix(sample.albedo, vec3(grey, grey, grey), L.baseGrey))
  m.roughnessNode = mix(float(.5), float(.72), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .6)
  m.name = 'vinci/collection-supper-room/base-stone'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** PATINATED BRONZE, the copings, the spouts, the lid's frame and the door's
 * lining: the metal kept on the edges, a mineral skin over the rest. */
function bronzeMaterial(L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: .8, side: FrontSide })
  const P = positionWorld
  const skin = mx_noise_float(P.mul(1.7)).mul(.5).add(.5).mul(.7).add(mx_noise_float(P.mul(19)).mul(.5).add(.5).mul(.3))
  m.colorNode = mix(L.bronze, L.patina, skin.mul(.8))
  m.roughnessNode = float(.34).add(skin.mul(.3))
  m.metalnessNode = mix(float(.92), float(.45), skin)
  m.name = 'vinci/collection-supper-room/bronze'
  m.userData = { ...SUPPER_ROOM_PROVENANCE }
  return m
}

/** THE DECKS: pale concrete pavers on pedestals, 0.6 m square, their open
 * joints dark, each paver cast on its own day. */
const PAVER = .6
function deckMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0, side: FrontSide })
  const P = positionWorld, east = P.x, north = P.z.negate()
  const sample = set.sample({ uv: vec2(east, north), metres: 2.71 })
  const { east: pe, north: pn } = axisFootprint(P)
  const fe = fract(east.div(PAVER)), fn = fract(north.div(PAVER))
  const de = min(fe, float(1).sub(fe)).mul(PAVER), dn = min(fn, float(1).sub(fn)).mul(PAVER)
  const joint = lineCoverage(de, .004, PAVER, pe).max(lineCoverage(dn, .004, PAVER, pn))
  const tone = float(1).add(hash(floorOf(east.div(PAVER)), floorOf(north.div(PAVER)), 6.1).sub(.5).mul(.12))
  m.colorNode = L.deckBase.mul(mix(float(1), sample.albedo, .7)).mul(tone).mul(float(1).sub(joint.mul(L.deckJoint)))
  m.roughnessNode = mix(float(.82), float(.96), sample.roughness)
  m.name = 'vinci/collection-supper-room/deck'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/* ---- the field's own light ---------------------------------------------- */

/** One edge of Lambert's polygon integral, seen from P with normal n. */
function edgeTerm(P: N, n: N, a: N, b: N): N {
  const va = a.sub(P).normalize(), vb = b.sub(P).normalize()
  const c = cross(va, vb)
  return acos(dot(va, vb).clamp(-.99999, .99999)).mul(dot(n, c).div(length(c).max(1e-7)))
}
/** The form factor of a four-cornered emitter from P: the share of a
 * Lambertian surface's irradiance a unit-radiance emitter gives it. */
function formFactor(P: N, n: N, c: readonly [N, N, N, N]): N {
  return edgeTerm(P, n, c[0], c[1]).add(edgeTerm(P, n, c[1], c[2])).add(edgeTerm(P, n, c[2], c[3])).add(edgeTerm(P, n, c[3], c[0]))
    .abs().div(2 * Math.PI)
}

interface MuralLight {
  node: N
  /** each light's radiance, kept equal to the rig's own */
  radiance: Map<string, N>
}

let mural: MuralLight | undefined

/** THE LIGHT ON THE FIELD. The reproduction is drawn unlit and multiplied by
 * this: each of the room's openings as an exact polygon from every point of
 * the field, clipped where the reveal stands between them, the plaster's own
 * relief turning each a little, and the room's bounce from its probe, looked
 * up lower toward the floor and higher toward the soffit. */
function buildMuralLight(L: Looks, plasterSet: MaterialSet, bounce: N): MuralLight {
  const P = positionWorld
  const n = vec3(1, 0, 0)
  const d = END_FACE - FIELD.face
  const x0 = float(FIELD.face)
  const yP = P.y, nP = P.z.negate()
  const radiance = new Map<string, N>()
  for (const spec of SUPPER_LIGHTS) radiance.set(spec.name, uniform(kelvinToColour(spec.kelvin).multiplyScalar(spec.intensity)))
  // the plaster under the paint, in the set's own tangent space (u north, v
  // up) turned into the wall's frame; a slow wave so the wall is not a plane
  const s = plasterSet.sample({ uv: vec2(nP, yP), metres: 1.6 })
  const slow = mx_noise_float(vec3(nP.mul(.9), yP.mul(.9), 1.7)).mul(.06)
  const bumped = vec3(s.normal.z, s.normal.y.add(slow.mul(.6)), s.normal.x.add(slow).negate()).normalize()
  const turn = (dir: N): N => mix(float(1), dot(bumped, dir).div(dot(n, dir).max(.02)).clamp(.55, 1.6), L.muralRelief)
  // THE TOP LIGHT, a level rectangle over the south wall. The reveal's head
  // hides the part of it nearest the wall from a point high on the field, its
  // south jamb the part a point near the field's left edge looks past.
  const T = TOP_LIGHT
  const yD = float(T.diffuser)
  const reachTop = yD.sub(yP).mul(d).div(float(FIELD.top).sub(yP).max(.0015))
  const reachSouth = nP.sub(T.south).mul(d).div(nP.sub(FIELD.south).max(.0015))
  const near = max(float(T.west - FIELD.face), max(reachTop, reachSouth)).min(T.east - FIELD.face)
  const xa = x0.add(near)
  const top = formFactor(P, n, [vec3(xa, yD, -T.south), vec3(T.east, yD, -T.south), vec3(T.east, yD, -T.north), vec3(xa, yD, -T.north)])
  const keyDir = vec3(xa.add(T.east).mul(.5), yD, -(T.south + T.north) / 2).sub(P).normalize()
  let direct: N = radiance.get('top-light')!.mul(top).mul(turn(keyDir))
  // THE OPEN NORTH SIDE, two upright rectangles: the nave's face and the
  // bay's. The reveal's north jamb hides the bay's nearest part from a point
  // near the field's right edge.
  for (const spec of SUPPER_LIGHTS) {
    if (spec.name === 'top-light' || spec.receivers === 'nave') continue
    const opening = uprightOpening(spec)
    let west: N = float(Math.max(0, opening.west - FIELD.face))
    if (opening.north > FIELD.north) {
      const reach = float(opening.north).sub(nP).mul(d).div(float(FIELD.north).sub(nP).max(.0015))
      west = max(west, reach).min(opening.east - FIELD.face)
    }
    const xw = x0.add(west)
    const f = formFactor(P, n, [vec3(xw, opening.low, -opening.north), vec3(opening.east, opening.low, -opening.north),
      vec3(opening.east, opening.high, -opening.north), vec3(xw, opening.high, -opening.north)])
    const dir = vec3(xw.add(opening.east).mul(.5), (opening.low + opening.high) / 2, -opening.north).sub(P).normalize()
    direct = direct.add(radiance.get(spec.name)!.mul(f).mul(turn(dir)))
  }
  // THE SILL AND THE FLOOR BEFORE IT, lit from above, throw their light back
  // up into the field's lowest band: the sill from just under the reveal's
  // bottom, which hides the part nearest the wall from a point low on the
  // field, and the floor past the sill's front edge, which hides the rest.
  const sillTop = float(SILL.top), floorTop = float(ROOM.floor + FLOOR_RISE)
  const underReveal = yP.sub(sillTop).mul(d).div(yP.sub(FIELD.bottom).max(.0015))
  const xs = x0.add(max(float(d), underReveal).min(SILL.east - FIELD.face))
  const sill = formFactor(P, n, [vec3(xs, sillTop, -FIELD.south), vec3(xs, sillTop, -FIELD.north),
    vec3(SILL.east, sillTop, -FIELD.north), vec3(SILL.east, sillTop, -FIELD.south)])
  const overSill = yP.sub(floorTop).mul(SILL.east - FIELD.face).div(yP.sub(sillTop).max(.0015))
  const xf = x0.add(max(float(SILL.east - FIELD.face), overSill).min(ROOM.step - FIELD.face))
  const floorLight = formFactor(P, n, [vec3(xf, floorTop, -ROOM.baySouth), vec3(xf, floorTop, -ROOM.north),
    vec3(ROOM.step, floorTop, -ROOM.north), vec3(ROOM.step, floorTop, -ROOM.baySouth)])
  direct = direct.add(L.sillGlow.mul(sill)).add(L.floorGlow.mul(floorLight))
  // THE BOUNCE: the reveal's rim sees less of the room than the field's middle
  const edgeIn = min(min(nP.sub(FIELD.south), float(FIELD.north).sub(nP)), min(yP.sub(FIELD.bottom), float(FIELD.top).sub(yP)))
  const rim = smoothstep(0, d * 2.4, edgeIn).mul(.2).add(.8)
  const ambient = bounce.mul(L.envLift).mul(L.muralBounce).mul(mix(float(1), rim, L.engineTerms))
  // A PAINTING IS LIT WHITE: the room's warm bounce stays on its plaster, and
  // the light on the field keeps its strength and its fall but not its tint
  const lit = direct.mul(L.muralDirect).add(ambient)
  const strength = dot(lit, vec3(.2126, .7152, .0722))
  return { node: mix(lit, L.muralWhite.mul(strength), L.muralNeutral), radiance }
}

/** An opening of the north side as an upright rectangle facing south. */
function uprightOpening(spec: SupperLight): { west: number; east: number; north: number; low: number; high: number } {
  const [e, n, h] = spec.at
  return { west: e - spec.width / 2, east: e + spec.width / 2, north: n, low: h - spec.height / 2, high: h + spec.height / 2 }
}

/** A face of the east door's reveal: its jambs and its head, which the
 * outside reads as the door's bronze lining. */
function inDoorReveal(c: { e: number; n: number; h: number }, normal: { e: number; n: number; h: number }): boolean {
  const across = c.e > ROOM.east - .001 && c.e < OUTLINE.nave.east + .001
  const jamb = Math.abs(normal.n) > .9 && (Math.abs(c.n - DOOR.south) < .01 || Math.abs(c.n - DOOR.north) < .01)
  const head = normal.h < -.9 && Math.abs(c.h - DOOR.head) < .01 && c.n > DOOR.south && c.n < DOOR.north
  return across && (jamb || head)
}

/** One geometry's triangles, parted by a test on each one's centre and facing. */
function split(g: BufferGeometry, test: (c: { e: number; n: number; h: number }, normal: { e: number; n: number; h: number }) => boolean): [BufferGeometry | null, BufferGeometry | null] {
  const p = g.getAttribute('position'), nr = g.getAttribute('normal'), uv = g.getAttribute('uv')
  const lists: [number[], number[]] = [[], []]
  for (let t = 0; t < p.count; t += 3) {
    const c = { e: (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, h: (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, n: -(p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3 }
    lists[test(c, { e: nr.getX(t), h: nr.getY(t), n: -nr.getZ(t) }) ? 0 : 1].push(t)
  }
  const pick = (list: number[]): BufferGeometry | null => {
    if (!list.length) return null
    const q: number[] = [], m: number[] = [], w: number[] = []
    for (const t of list) for (let k = 0; k < 3; k++) {
      q.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k))
      m.push(nr.getX(t + k), nr.getY(t + k), nr.getZ(t + k))
      w.push(uv.getX(t + k), uv.getY(t + k))
    }
    const made = new BufferGeometry()
    made.setAttribute('position', new Float32BufferAttribute(q, 3))
    made.setAttribute('normal', new Float32BufferAttribute(m, 3))
    made.setAttribute('uv', new Float32BufferAttribute(w, 2))
    made.computeBoundingBox(); made.computeBoundingSphere()
    return made
  }
  const out: [BufferGeometry | null, BufferGeometry | null] = [pick(lists[0]), pick(lists[1])]
  g.dispose()
  return out
}

export interface SupperRoom {
  group: Group
  ready: Promise<void>
  /** How many takes of the room's bounce are still owed. */
  tick(bodies: readonly Object3D[]): void
  dispose(): void
}

/** The calm tier takes no probe: the hero tier's bounce measured as a fill,
 * the bay's lit by its top light and the nave's by the bay and the court. */
const CALM_FILL = {
  bay: { up: [.3, .3, .3], down: [.34, .33, .31], side: [.32, .32, .33] },
  nave: { up: [.16, .16, .16], down: [.2, .19, .18], side: [.22, .21, .2] },
} as const

type Zone = 'bay' | 'nave' | 'out'

export function mountSupperRoom(stack: Stack): SupperRoom {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks()
  const group = new Group()
  group.name = 'vinci/collection-supper-room'
  group.userData = { ...SUPPER_ROOM_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = []

  // THE LIGHTS, from the one table; each handed only to what it can see
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const built: { light: RectAreaLight; spec: SupperLight }[] = []
  for (const spec of SUPPER_LIGHTS) {
    const area = new RectAreaLight(kelvinToColour(spec.kelvin), spec.intensity, spec.width, spec.height)
    area.position.copy(v3(...spec.at))
    area.lookAt(v3(...spec.aim))
    area.name = `vinci/collection-supper-room/${spec.name}`
    area.userData = { ...SUPPER_ROOM_PROVENANCE }
    // out of the scene's own list, which every other surface reads
    area.visible = false
    group.add(area)
    built.push({ light: area, spec })
  }
  const rigOf = (zone: 'bay' | 'nave'): Light[] => built.filter(({ spec }) => spec.receivers === zone || spec.receivers === 'both').map(({ light }) => light)

  // THE BOUNCE: a probe in each volume, turned by the scene's own
  // environment turn and re-taken into the same target
  let generator: PMREMGenerator | undefined
  type Probe = { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget }
  const probes: Partial<Record<'bay' | 'nave', Probe>> = {}
  const env: Record<'bay' | 'nave', N> = { bay: null, nave: null }
  for (const zone of ['bay', 'nave'] as const) {
    if (!calm) {
      generator ??= new PMREMGenerator(stack.renderer)
      const target = new CubeRenderTarget(tier === 'hero' ? 256 : 128, { type: HalfFloatType })
      const camera = new CubeCamera(.05, 2400, target)
      camera.position.copy(v3(...(zone === 'bay' ? PROBE_AT : NAVE_PROBE_AT)))
      const probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
      probes[zone] = probe
      env[zone] = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
    } else {
      const n = normalWorldGeometry, F = CALM_FILL[zone]
      env[zone] = mix(vec3(...F.down), vec3(...F.up), n.y.mul(.5).add(.5)).add(vec3(...F.side).mul(n.z.max(0))).mul(L.envGain).mul(L.envLift)
    }
  }
  const adopt = (material: Material, zone: 'bay' | 'nave'): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown }
    lit.lightsNode = lightsOf(rigOf(zone))
    lit.envNode = env[zone]
    material.needsUpdate = true
  }

  // THE SURFACES, one of each for the bay and for the nave
  const [plasterSet, concreteSet, marbleSet, stoneSet] = SETS.map(name => stack.materials.sync(name))
  const lit: Record<'plaster' | 'concrete' | 'marble', Record<'bay' | 'nave', MeshStandardNodeMaterial>> = {
    plaster: { bay: plasterMaterial(plasterSet!, L), nave: plasterMaterial(plasterSet!, L) },
    concrete: { bay: concreteMaterial(concreteSet!, L, 'concrete-bay'), nave: concreteMaterial(concreteSet!, L, 'concrete-nave') },
    // the way in is laid in the same marble a shade deeper, so the bay's floor
    // and the field, not the foreground, take the eye
    marble: { bay: marbleMaterial(marbleSet!, L), nave: marbleMaterial(marbleSet!, L, L.naveFloor) },
  }
  for (const family of Object.values(lit)) for (const zone of ['bay', 'nave'] as const) {
    adopt(family[zone], zone)
    family[zone].name += `-${zone}`
    materials.push(family[zone])
  }
  const concreteOut = outsideMaterial(concreteSet!, L)
  const bronze = bronzeMaterial(L)
  const deck = deckMaterial(concreteSet!, L)
  const stoneOut = baseStoneMaterial(stoneSet!, L)
  const stone = stoneMaterial(stoneSet!, L)
  adopt(stone, 'bay')
  const skirt = new MeshStandardNodeMaterial({ color: '#2a2622', roughness: .45, metalness: .7 })
  skirt.name = 'vinci/collection-supper-room/diffuser-frame'
  adopt(skirt, 'bay')
  const top = SUPPER_LIGHTS[0]!
  const glowColour = kelvinToColour(top.kelvin).multiplyScalar(top.intensity)
  const diffuser = new MeshBasicNodeMaterial()
  {
    const P = positionWorld
    // a panel of etched glass: its joints every 1.2 m and the slot's own
    // falloff toward its ends, where the well shades it
    const along = P.x.sub(TOP_LIGHT.west).div(1.2)
    const seam = smoothstep(.012, 0, abs(fract(along).sub(.5)).mul(-1).add(.5).mul(1.2)).mul(.25)
    const ends = smoothstep(0, .9, P.x.sub(TOP_LIGHT.west)).mul(smoothstep(0, .9, float(TOP_LIGHT.east).sub(P.x)))
    diffuser.colorNode = vec3(glowColour.r, glowColour.g, glowColour.b).mul(L.diffuserGlow).mul(ends.mul(.25).add(.75)).mul(float(1).sub(seam))
  }
  diffuser.name = 'vinci/collection-supper-room/diffuser'
  const glass = new MeshStandardNodeMaterial({ color: '#1c2226', roughness: .08, metalness: .1 })
  glass.name = 'vinci/collection-supper-room/skylight'
  materials.push(concreteOut, bronze, deck, stoneOut, stone, skirt, diffuser, glass)

  // WHICH VOLUME A FACE LOOKS INTO: a face whose outside lies in the bay's air
  // or the nave's takes that volume's light; every other face is lit by the day
  const zoneOf = (e: number, n: number, h: number): Zone => {
    if (h < ROOM.floor - .01 || n < ROOM.south - .001 || e < ROOM.west - .001) return 'out'
    if (e < ROOM.step && n < ROOM.baySouth - .001 && h < ROOM.baySoffit) return 'out'
    const inSlot = h < ROOM.bayTop + .05 && e > TOP_LIGHT.west - .001 && e < TOP_LIGHT.east + .001 && n > TOP_LIGHT.south - .001 && n < TOP_LIGHT.north + .001
    if (inSlot || (e < ROOM.step + .001 && n < ROOM.north + .001 && h < ROOM.baySoffit + .001)) return e < ROOM.step ? 'bay' : 'nave'
    if (e < ROOM.east + .001 && n < ROOM.naveNorth + .001 && h < ROOM.naveSoffit + .001) return 'nave'
    return 'out'
  }
  const sort = (body: Body): Record<Zone, BufferGeometry | null> => {
    const g = body.geometry(), p = g.getAttribute('position'), nr = g.getAttribute('normal'), uv = g.getAttribute('uv')
    const keep: Record<Zone, number[]> = { bay: [], nave: [], out: [] }
    for (let t = 0; t < p.count; t += 3) {
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3
      const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3
      keep[zoneOf(cx + nr.getX(t) * .05, -(cz + nr.getZ(t) * .05), cy + nr.getY(t) * .05)].push(t)
    }
    const pick = (list: number[]): BufferGeometry | null => {
      if (!list.length) return null
      const q: number[] = [], m: number[] = [], w: number[] = []
      for (const t of list) for (let k = 0; k < 3; k++) {
        q.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k))
        m.push(nr.getX(t + k), nr.getY(t + k), nr.getZ(t + k))
        w.push(uv.getX(t + k), uv.getY(t + k))
      }
      const made = new BufferGeometry()
      made.setAttribute('position', new Float32BufferAttribute(q, 3))
      made.setAttribute('normal', new Float32BufferAttribute(m, 3))
      made.setAttribute('uv', new Float32BufferAttribute(w, 2))
      made.computeBoundingBox(); made.computeBoundingSphere()
      return made
    }
    const out = { bay: pick(keep.bay), nave: pick(keep.nave), out: pick(keep.out) }
    g.dispose()
    return out
  }
  const make = (geometry: BufferGeometry | null, material: Material, name: string, shadow: boolean): Mesh | null => {
    if (!geometry) return null
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-supper-room/${name}`
    mesh.castShadow = shadow; mesh.receiveShadow = true
    mesh.userData = { ...SUPPER_ROOM_PROVENANCE, asset: SUPPER_ROOM_PROVENANCE.manifestId }
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const merged = (parts: (BufferGeometry | null)[]): BufferGeometry | null => {
    const kept = parts.filter((part): part is BufferGeometry => part !== null)
    if (!kept.length) return null
    const g = mergeGeometries(kept)
    for (const part of kept) part.dispose()
    return g
  }

  const { plaster: wall, reveal } = endWall()
  const { slab, well, diffuser: panel, glass: pane } = roof()
  const parts = { wall: sort(wall), reveal: sort(reveal), south: sort(southWall()), upper: sort(upperEndWall()),
    slab: sort(slab), frame: sort(frame()), fins: sort(fins()), casing: sort(casing()), floor: sort(floorBody()) }
  for (const zone of ['bay', 'nave'] as const) {
    // the beams and the pier are poured with the roof; the east wall is a wall
    const [poured, walls] = parts.frame[zone] ? split(parts.frame[zone], c => c.e < ROOM.east - .001) : [null, null]
    // the bay's side wall stands right under the top light: in white plaster
    // its wash burns out, in the roof's concrete the light shows its fall
    const side = zone === 'bay' ? parts.south[zone] : null
    make(merged([parts.wall[zone], parts.reveal[zone], side ? null : parts.south[zone], walls, parts.fins[zone]]), lit.plaster[zone], `plaster-${zone}`, false)
    make(merged([parts.slab[zone], parts.upper[zone], parts.casing[zone], side, poured]), lit.concrete[zone], `concrete-${zone}`, false)
    make(parts.floor[zone], lit.marble[zone], `floor-${zone}`, false)
  }
  // THE ROOM'S OUTSIDE stands in the day and throws the day's shadow: its
  // walls and parapets in concrete, the door lined and the roofs capped in
  // bronze, the decks in pavers, the floor's open edges and the base in stone
  const shell = outside()
  const [lining, walls] = parts.frame.out ? split(parts.frame.out, inDoorReveal) : [null, null]
  make(merged([parts.wall.out, parts.reveal.out, parts.south.out, parts.upper.out, parts.slab.out, walls, parts.fins.out, parts.casing.out, shell.parapet.geometry()]),
    concreteOut, 'concrete-out', true)
  make(merged([lining, shell.bronze.geometry()]), bronze, 'bronze', true)
  make(shell.deck.geometry(), deck, 'deck', false)
  make(merged([parts.floor.out, shell.stone.geometry()]), stoneOut, 'stone-out', true)
  make(sillDress().geometry(), stone, 'sill', false)
  make(well.geometry(), skirt, 'diffuser-frame', false)
  const glow = make(panel.geometry(), diffuser, 'diffuser', false)
  if (glow) glow.receiveShadow = false
  make(pane.geometry(), glass, 'skylight', false)

  // THE FIELD'S OWN LIGHT, the bay's openings from the same table, and the
  // bounce the bay's walls take (the walls read the probe through the scene's
  // own environment level and divide it back out; the field reads it straight)
  const look = vec3(1, positionWorld.y.sub((FIELD.bottom + FIELD.top) / 2).mul(.22), 0).normalize()
  const bayProbe = probes.bay
  const bounce = bayProbe ? pmremTexture(bayProbe.pmrem.texture, look, float(1)) : vec3(...CALM_FILL.bay.side).add(.02)
  mural = buildMuralLight(L, plasterSet!, bounce)
  setSupperMuralLight(mural.node)
  const syncRadiance = (): void => {
    for (const { light, spec } of built) mural?.radiance.get(spec.name)?.value.copy(light.color).multiplyScalar(light.intensity)
  }
  syncRadiance()

  // `?supperrig` hands an instrument the rig's levels and the looks
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('supperrig')) {
    ;(window as unknown as Record<string, unknown>)['__supperRig'] = {
      names: built.map(({ spec }) => spec.name),
      level(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.intensity = value
        syncRadiance()
      },
      kelvin(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.color.copy(kelvinToColour(value))
        syncRadiance()
      },
      looks: L,
      lights: Object.fromEntries(built.map(({ light, spec }) => [spec.name, light])),
      bake: () => { owed = 3 },
      /** the scene the room stands in, for an instrument that hides a body */
      root: () => { let o: Object3D = group; while (o.parent) o = o.parent; return o },
    }
  }

  let owed = 0, live = true
  // three takes, so the bounce carries two bounces of its own
  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 3 }, () => { if (live) owed = 3 })

  function take(bodies: readonly Object3D[]): void {
    if (!generator) return
    let scene: Object3D = group
    while (scene.parent) scene = scene.parent
    const root = scene as Scene
    if (!root.isScene) return
    L.envGain.value = 1 / Math.max(.01, root.environmentIntensity)
    const shown = bodies.map(body => body.visible)
    for (const body of bodies) body.visible = true
    try {
      for (const probe of Object.values(probes)) {
        probe.camera.rotation.copy(root.environmentRotation)
        probe.camera.updateMatrixWorld(true)
        probe.camera.update(stack.renderer, root)
        generator.fromCubemap(probe.target.texture, probe.pmrem)
      }
    } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
  }

  return {
    group,
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    dispose() {
      live = false
      mural = undefined
      setSupperMuralLight(undefined)
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose() }
      for (const m of materials) m.dispose()
      for (const { light } of built) { light.removeFromParent(); light.dispose() }
      for (const probe of Object.values(probes)) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}
