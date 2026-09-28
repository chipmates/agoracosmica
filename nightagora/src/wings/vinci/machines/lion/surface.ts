/** THE LION'S SURFACES. The carved shell is tempera over gesso on limewood:
 * a tawny body, a darker mane, bare wood where panels part and inside, iron
 * bands at the joints, the chest lined in blue (1509, 1517 letters) with its
 * lilies in gold. The colours of the outside are the museum's choice. The
 * frame is oak and the works iron and brass, from the library's own sets.
 * Per-vertex occlusion and convexity come from the baker.
 */
import { Color, MeshStandardNodeMaterial, type UniformNode } from 'three/webgpu'
import {
  atan, attribute, clamp, faceDirection, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, normalGeometry,
  normalView, positionGeometry, positionView, smoothstep, uniform, uv, vec3,
} from 'three/tsl'
import type { MaterialSet, Stack } from '../../../../stack'
import { FACE, faceCalm, faceColour } from './head'
import { ARBOR, FLANK, K } from './sdf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const lin = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }

/** A carved surface's gouge facets as a view-space normal: the height is a
 * field of shallow cups, read through screen derivatives (the scale-true
 * form of Mikkelsen's surface gradient) and faded where a pixel spans a cup. */
function carvedNormal(height: N): N {
  const sx = positionView.dFdx(), sy = positionView.dFdy()
  const lx = sx.length().max(1e-6), ly = sy.length().max(1e-6)
  const ex = sx.div(lx), ey = sy.div(ly), n = normalView
  const r1 = ey.cross(n), r2 = n.cross(ex)
  const det = ex.dot(r1).mul(faceDirection)
  const fade = float(1).sub(smoothstep(0.0025, 0.007, lx.max(ly)))
  const grad = height.dFdx().div(lx).mul(r1).add(height.dFdy().div(ly).mul(r2)).mul(fade)
  return det.abs().mul(n).sub(det.sign().mul(grad)).normalize()
}

/** The light inside the chest, 0 shut to 1 open. A shut chest is dark
 * inside, so its seam shows no lit blue; nothing else here shades the room
 * the doors close. One per lion. */
export type ChestLight = UniformNode<'float', number>
export const chestLight = (): ChestLight => uniform(1)

/** The doors' own rims: a band a finger wide inside each door's edge and
 * along the meeting line, on the doors' outer faces, in the carving's rest frame. */
function doorRim(P: N): N {
  // the doors' outline (sdf.ts doorOutline): a rounded box half 0.152 by 0.1225 about y 0.6575, corners 0.06
  const qx = P.x.abs(), qy = P.y.sub(0.6575).abs()
  const bx = qx.sub(0.152 - 0.06), by = qy.sub(0.1225 - 0.06)
  const box = vec3(bx.max(0), by.max(0), 0).length().add(bx.max(by).min(0)).sub(0.06)
  // each leaf ends 5 mm inside the outline and 2.5 mm off the meeting line
  const edge = box.add(0.005).max(float(0.0025).sub(qx))
  const band = smoothstep(-0.013, -0.009, edge).mul(smoothstep(0.001, -0.002, edge))
  return band.mul(smoothstep(0.46, 0.52, P.z)).mul(smoothstep(0.1, 0.45, normalGeometry.z))
}

/** Where hands and years rub the paint through to the gesso: the brow and
 * the nose's bridge, the knuckles' tops, round the winding key, the doors'
 * edges. 0 to 1, before the carving's own convexity picks the high points.
 * P and Ng in the rest frame. (No rings on the joints: a pale rim there reads
 * as a gap. The window's rim is worn apart, off its edge: windowRim.) */
function rubbed(P: N, Ng: N): N {
  const ax = P.x.abs()
  // the face's frame as the carving carries it (head.ts FACE)
  const q0 = vec3(ax, P.y, P.z).sub(vec3(FACE.at[0], FACE.at[1], FACE.at[2]))
  const cp = Math.cos(FACE.pitch), sp = Math.sin(FACE.pitch)
  const qy = q0.y.mul(cp).add(q0.z.mul(sp)), qz = q0.z.mul(cp).sub(q0.y.mul(sp))
  const brow = smoothstep(0.012, 0.035, qy).mul(smoothstep(0.1, 0.07, qy)).mul(smoothstep(0.06, 0.12, qz)).mul(smoothstep(0.13, 0.08, ax))
  const bridge = smoothstep(0.035, 0.015, ax).mul(smoothstep(0.14, 0.2, qz)).mul(smoothstep(-0.05, -0.02, qy))
  const key = smoothstep(0.075, 0.04, vec3(0, P.y.sub(ARBOR.y), P.z.sub(ARBOR.z)).length()).mul(smoothstep(0.12, 0.16, P.x))
  // the knuckles' tops: the plane across the toes, facing up
  const knuckles = smoothstep(0.03, 0.042, P.y).mul(smoothstep(0.072, 0.058, P.y)).mul(smoothstep(0.45, 0.8, Ng.y))
  return clamp(brow.add(bridge).add(key).add(knuckles).add(doorRim(P).mul(0.8)), 0, 1)
}

/** The near flank's opening, a band a hand wide round its rim on the outside,
 * starting a finger off the cut edge (sdf.ts flankRegion, its top edge taken as
 * a line under the back): hands rub the face beside the edge, and the edge's own
 * convexity, jagged at the shell's grid, would fleck it. */
function windowRim(P: N): N {
  const dz = P.z.sub(FLANK.zc)
  // (the back line less the panel's band, sdf.ts TR_TOP: lowest at z -0.1)
  const top = P.z.add(0.1).mul(-0.08).max(P.z.add(0.1).mul(0.155)).add(0.902), bot = dz.mul(FLANK.slope).add(FLANK.bot)
  const qx = dz.abs().sub(FLANK.hz - FLANK.r), qy = P.y.sub(top.add(bot).mul(0.5)).abs().sub(top.sub(bot).mul(0.5).sub(FLANK.r))
  const box = vec3(qx.max(0), qy.max(0), 0).length().add(qx.max(qy).min(0)).sub(FLANK.r)
  return smoothstep(0.008, 0.014, box).mul(smoothstep(0.03, 0.018, box)).mul(smoothstep(0.1, 0.14, P.x))
}

/** How far behind the face's rim a point lies, in metres, from the temples
 * down (over the crown it reads far, so no band lies across the forehead):
 * the mane begins at RIM_Z round the face (head.ts, its frame before the
 * scale), a copy of that table read only to feather the cheek ruff's paint. */
const RIM_Z = [0.07, 0.05, 0.008, -0.012, 0.03, 0.085, 0.11]
function ruffZone(P: N): N {
  const HS = FACE.scale, cp = Math.cos(FACE.pitch), sp = Math.sin(FACE.pitch)
  const q0 = vec3(P.x.abs(), P.y, P.z).sub(vec3(FACE.at[0], FACE.at[1], FACE.at[2]))
  const qx = q0.x.div(HS), qy = q0.y.mul(cp).add(q0.z.mul(sp)).div(HS), qz = q0.z.mul(cp).sub(q0.y.mul(sp)).div(HS)
  // 0 at the crown, 6 at the throat
  const a = atan(qx, qy.add(0.05)).mul(6 / Math.PI)
  let rim: N = float(RIM_Z[0]!)
  for (let k = 0; k < 6; k++) rim = rim.add(smoothstep(k, k + 1, a).mul(RIM_Z[k + 1]! - RIM_Z[k]!))
  rim = mix(float(0.04), rim, smoothstep(0.02, 0.06, vec3(qx, qy.add(0.05), 0).length()))
  return rim.sub(qz).mul(HS).add(smoothstep(1.9, 1.1, a).mul(0.2))
}

/** The claws' tips in the paw's own frame (sdf.ts foot(): the fore foot at z0
 * 0.02, width 1.1, the floor 0.115 below the wrist's pin; the hind at z0 0.07,
 * width 0.95, the floor 0.245 below the hock's pin). */
function clawTips(P0: N, fore: N, hind: N): N {
  const q = vec3(P0.x.abs(), P0.y, P0.z)
  const tip = (x: number, y: number, z: number): N => smoothstep(0.006, 0.0025, q.sub(vec3(x, y, z)).length())
  const f = tip(0.02035, -0.1, 0.13).max(tip(0.06105, -0.1, 0.11))
  const h = tip(0.017575, -0.23, 0.18).max(tip(0.052725, -0.23, 0.16))
  return f.mul(fore).add(h.mul(hind))
}

/** The painted carved parts: one material for every baked body. aAttr is
 * (normal occlusion, hemisphere occlusion, convexity, the part's code); aMat
 * is the one-hot weight of (blue, mane, iron, bare wood), paint where all are
 * zero. Tempera over gesso, matte with a satin where it is rubbed: a tawny
 * hide with a mottle a hand across, an umber band down the spine, darker down
 * the backs of the legs, paler under the belly and inside the legs; the mane
 * dark umber, near black in its hollows, the cheek ruff a step lighter; gold
 * on most of the mane's crests, the claws' tips
 * and the doors' rims; the gesso and a fine crackle where hands have rubbed. */
export function paintedMaterial(chest: ChestLight): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0 })
  m.name = 'mechanical-lion:tempera'
  const A: N = attribute('aAttr', 'vec4'), W: N = attribute('aMat', 'vec4')
  const aoN = A.x, aoH = clamp(A.y.div(0.9), 0, 1), cv = A.z
  // the part's code (mechanical-lion.ts): 1 a fore paw, 2 a hind paw, 6 a
  // leg's upper or lower (negative when mirrored), 3 the face; the paws are
  // baked in their own frames, the pin at the origin, and are carried back to
  // the rest frame here
  const code = A.w, side = code.sign()
  const forePaw = smoothstep(0.5, 0.0, code.abs().sub(1).abs()), hindPaw = smoothstep(0.5, 0.0, code.abs().sub(2).abs())
  const onLeg = smoothstep(0.5, 0.0, code.abs().sub(6).abs())
  const P0 = positionGeometry
  const P = P0.add(vec3(side.mul(K.WF[0]), K.WF[1], K.WF[2]).mul(forePaw)).add(vec3(side.mul(K.WH[0]), K.WH[1], K.WH[2]).mul(hindPaw))
  const Ng = normalGeometry
  // where the face's planes carry the shading (head.ts): no grime blotches, no mottle
  const calm = faceCalm(P)
  const n1 = mx_noise_float(P.mul(38)).mul(0.5).add(0.5)
  const n2 = mx_fractal_noise_float(P.mul(7.5), 3, 2, 0.5).mul(0.5).add(0.5)
  const n3 = mx_noise_float(P.mul(160)).mul(0.5).add(0.5)
  // brush marks run along the carving, slow in one direction and quick across
  const stroke = mx_noise_float(vec3(P.x.mul(30), P.y.mul(95), P.z.mul(30))).mul(0.5).add(0.5)
  const recess = smoothstep(0.02, -0.22, cv)
  const ridge = smoothstep(0.16, 0.5, cv.add(n1.sub(0.5).mul(0.25)))
  // (on the face's front a third of it)
  const grime = clamp(recess.mul(0.7).add(float(1).sub(aoN).mul(0.45)).add(float(1).sub(aoH).mul(0.3)), 0, 1).mul(mix(float(1), float(0.35), calm))
  const paint = float(1).sub(clamp(W.x.add(W.y).add(W.z).add(W.w), 0, 1))

  // THE HIDE, in the rest frame, so the pattern rides with each piece
  const ax = P.x.abs()
  const inward = Ng.x.mul(P.x).negate().div(ax.add(0.02))
  // an umber band down the spine, by position and not by the light's side:
  // full along the back's top line (sdf.ts TR_TOP, as a few ramps), fading
  // 16 cm down the sides so it reads from the side and from the hall's eye
  // above it, on up the neck under the mane's end and down the tail's top
  const topLine = float(0.99).add(smoothstep(-0.1, 0.35, P.z).mul(0.045)).sub(smoothstep(0.4, 0.55, P.z).mul(0.035)).sub(smoothstep(-0.55, -0.75, P.z).mul(0.09))
    .sub(smoothstep(-0.32, -0.15, P.z).mul(smoothstep(0.08, -0.05, P.z)).mul(0.016))
  const back = smoothstep(0.16, 0.04, topLine.sub(P.y)).mul(float(1).sub(onLeg)).mul(smoothstep(0.44, 0.32, P.z)).mul(smoothstep(-0.66, -0.56, P.z))
  const tailTop = smoothstep(-0.64, -0.7, P.z).mul(smoothstep(0.034, 0.016, ax)).mul(smoothstep(0.0, 0.5, Ng.y.mul(0.6).sub(Ng.z.mul(0.8))))
  const spine = clamp(back.add(tailTop), 0, 1)
  const legBacks = smoothstep(0.76, 0.6, P.y).mul(smoothstep(-0.15, -0.7, Ng.z))
  const under = smoothstep(-0.05, -0.6, Ng.y).mul(smoothstep(0.86, 0.66, P.y))
  const innerLegs = smoothstep(0.15, 0.6, inward).mul(smoothstep(0.7, 0.5, P.y))
  // blotches 6 to 10 cm across, some 24 percent in value, none on the face
  const mottle = mx_fractal_noise_float(P.mul(11).add(vec3(3.1, 7.7, 1.3)), 2, 2, 0.5).mul(float(1).sub(calm))
  const hide0 = mix(lin('#86603c'), lin('#936a41'), n2).mul(mix(0.93, 1.05, stroke)).mul(mottle.mul(0.24).add(1))
  const pale = lin('#b59269').mul(mix(0.94, 1.04, n2))
  // (the band some 40 percent darker in value, warmer)
  const hide = mix(mix(hide0, pale, clamp(under.mul(0.6).add(innerLegs.mul(0.35)), 0, 0.7)), hide0.mul(lin('#9a8f86')),
    clamp(spine.mul(0.9).add(legBacks.mul(0.4)), 0, 0.9))
  const body = mix(hide, hide.mul(1.25).add(lin('#1a120a')), ridge.mul(0.4))

  // THE MANE: dark umber, near black at the roots and in the hollows, a warm
  // brown only on each crest's top third; the cheek ruff round the face a step
  // lighter, fading out over 3 cm behind its row
  const maneBase = mix(lin('#3b2a1d'), lin('#4f3827'), n2).mul(mix(0.88, 1.08, stroke))
  const maneRoot = mix(lin('#1b130c'), lin('#271c13'), n2)
  const maneHi = mix(lin('#6a4a2f'), lin('#79573a'), n1)
  const hollow = smoothstep(0.7, 0.3, aoH).max(recess.mul(0.8))
  // (the mane's convexity: median about 0.01, the top tenth over 0.15)
  const top3 = smoothstep(0.03, 0.13, cv.add(n1.sub(0.5).mul(0.06)))
  const maneDark = mix(mix(maneBase, maneRoot, hollow.mul(0.85)), maneHi, top3.mul(0.5))
  const ruffTone = mix(mix(maneHi, hide0, 0.3), maneRoot, hollow.mul(0.7))
  const zone = ruffZone(P)
  const mane = mix(maneDark, ruffTone, smoothstep(0.085, 0.05, zone).mul(0.7))

  const gesso = lin('#d2c29d')
  // bare limewood: fresh at the cut edges, darkened inside the shell where no light reaches
  const wood = mix(lin('#9c7a52'), lin('#b08d62'), mx_noise_float(vec3(P.x.mul(60), P.y.mul(5), P.z.mul(60)).add(n2.mul(1.5))).mul(0.5).add(0.5))
    .mul(mix(float(0.36), float(1), smoothstep(0.25, 0.85, aoH)))
  const blue = lin('#233f86').mul(mix(0.82, 1.08, n2)).mul(mix(0.9, 1.04, n3)).mul(mix(float(0.06), float(1), chest))
  const iron = lin('#3f3a35').mul(mix(0.82, 1.14, n1))

  let col: N = body.mul(paint).add(blue.mul(W.x)).add(mane.mul(W.y)).add(iron.mul(W.z)).add(wood.mul(W.w))
  // the face's colours, owned with its carving by head.ts (face.calm: where the face's planes carry the shading)
  const face = faceColour(P, col, paint, n1, n2)
  col = face.col
  const eyeW = face.eye
  // rubbed through to the gesso at the high points of the worn places
  // (patches a few centimetres across, worn smooth, not flecked)
  const worn = rubbed(P, Ng).mul(smoothstep(0.02, 0.32, cv.add(n1.sub(0.5).mul(0.2)))).add(windowRim(P).mul(0.35))
    .mul(smoothstep(0.42, 0.68, n2.add(n1.sub(0.5).mul(0.35))))
  const wear = worn.mul(paint.add(W.y.mul(0.5))).mul(float(1).sub(eyeW))
  col = mix(col, gesso.mul(mix(0.9, 1.02, n3)), wear.mul(0.8))
  // a fine crackle in the ground, dark hairlines, only where the paint is
  // rubbed and off the face; it fades where a pixel spans a cell
  const cell = mx_worley_noise_vec2(P.mul(75))
  const fine = float(1).sub(smoothstep(0.0012, 0.0035, positionView.dFdx().length().max(positionView.dFdy().length())))
  const crack = smoothstep(0.05, 0.0, cell.y.sub(cell.x)).mul(fine).mul(wear.mul(0.8)).mul(float(1).sub(W.z)).mul(float(1).sub(eyeW)).mul(float(1).sub(calm))
  col = col.mul(float(1).sub(crack.mul(0.4)))
  // an umber glaze pools in the hollows and under the overhangs
  col = mix(col, col.mul(lin('#6b4424')).mul(1.2), grime.mul(float(1).sub(W.z)).mul(0.7))
  col = col.mul(mix(float(1), float(0.42), grime.mul(float(1).sub(W.z))))
  // GOLD over red bole: most of the crests of the mane's rows behind the cheek
  // ruff (none on the ruff, none on the tail's tuft; off the sharpest tips, which
  // gilded read as fangs), the claws' tips, the doors' rims; worn through to the
  // bole on a fifth to a third of it
  const crest = smoothstep(0.12, 0.18, cv.add(n1.sub(0.5).mul(0.05))).mul(smoothstep(0.34, 0.24, cv))
  const most = smoothstep(0.38, 0.5, mx_noise_float(P.mul(9).add(vec3(5.3, 1.1, 2.9))).mul(0.5).add(0.5))
  // (none on the hood's lip over the shoulder, inside the shoulder's circle where no lock lies: gilt, its rims framed it as a panel)
  const lip = float(1).sub(smoothstep(0.1, 0.12, vec3(0, P.y.sub(K.SH[1]), P.z.sub(K.SH[2])).length())).mul(smoothstep(0.885, 0.83, P.y))
  const maneGilt = crest.mul(most).mul(W.y).mul(smoothstep(-0.55, -0.45, P.z)).mul(smoothstep(0.06, 0.1, zone)).mul(float(1).sub(lip))
  const gilt: N = clamp(maneGilt.add(clawTips(P0, forePaw, hindPaw)).add(doorRim(P).mul(paint)), 0, 1).mul(float(1).sub(eyeW))
  // the doors' rims worn through in places, so they read as a gilt edge and not a drawn frame
  const giltWorn = smoothstep(0.56, 0.74, n2.add(n1.sub(0.5).mul(0.3))).max(wear).max(doorRim(P).mul(smoothstep(0.45, 0.6, n2)))
  const gold = mix(lin('#c9a24a'), lin('#dcb45c'), n1).mul(mix(float(1), float(0.68), grime))
  const giltCol: N = mix(gold, lin('#7c3421'), giltWorn.mul(0.8))
  col = mix(col, giltCol, gilt)
  m.colorNode = col
  // tempera, matte, with a satin where it is rubbed and on the high points, so
  // the planes catch the room's light; the iron a little smoother; the gold's highlight broad
  const satin = clamp(wear.mul(1.2).add(ridge.mul(0.12)), 0, 1)
  const rough = mix(mix(float(0.76), float(0.88), n1), mix(float(0.56), float(0.66), n2), satin).mul(paint)
    .add(mix(float(0.84), float(0.92), n1).mul(W.y))
    .add(mix(float(0.8), float(0.88), n3).mul(W.x))
    .add(mix(float(0.52), float(0.66), n1).mul(W.z))
    .add(mix(float(0.74), float(0.84), n2).mul(W.w))
  m.roughnessNode = mix(clamp(rough, 0.4, 1), mix(float(0.42), float(0.58), giltWorn), gilt)
  m.metalnessNode = mix(W.z.mul(0.15), float(0.9).sub(giltWorn.mul(0.8)), gilt)
  m.aoNode = mix(float(0.3), float(1), aoN.mul(mix(float(1), aoH, 0.6)))
  // gouge marks under the paint, longer along the grain than across; hammer dents in the iron
  const cups = mx_worley_noise_float(vec3(P.x.mul(46), P.y.mul(30), P.z.mul(40)))
  const dents = mx_worley_noise_float(P.mul(70))
  m.normalNode = carvedNormal(cups.mul(cups).mul(0.0007).mul(float(1).sub(W.z)).add(dents.mul(dents).mul(0.0005).mul(W.z)))
  return m
}

/** Water gilding over bole on the lilies: burnished where raised. */
export function gildMaterial(chest: ChestLight): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: 0.25, metalness: 1 })
  m.name = 'mechanical-lion:gilding'
  const A: N = attribute('aAttr', 'vec4')
  const P = positionGeometry
  const n1 = mx_noise_float(P.mul(90)).mul(0.5).add(0.5)
  const recess = smoothstep(0.02, -0.3, A.z)
  m.colorNode = lin('#f2c46a').mul(mix(0.9, 1.04, n1)).mul(mix(float(1), float(0.55), recess)).mul(mix(float(0.06), float(1), chest))
  m.roughnessNode = mix(float(0.18), float(0.4), recess.add(n1.mul(0.2)))
  m.aoNode = A.x
  return m
}

/** Brass for the great wheel and the pinions' cheeks. */
export function brassMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: 0.34, metalness: 1 })
  m.name = 'mechanical-lion:brass'
  const P = positionGeometry
  const n1 = mx_noise_float(P.mul(70)).mul(0.5).add(0.5)
  const n2 = mx_noise_float(P.mul(9)).mul(0.5).add(0.5)
  m.colorNode = lin('#c9a15a').mul(mix(0.78, 1.0, n2)).mul(mix(0.94, 1.03, n1))
  // old brass: a broad sheen, no white slivers on the teeth
  m.roughnessNode = mix(float(0.34), float(0.52), n1.mul(0.6).add(n2.mul(0.4)))
  return m
}

/** Oak or iron from the library, read through the geometry's own metric
 * coordinates, whose V runs along each member. */
export function librarySurface(stack: Stack, set: MaterialSet, kind: 'oak' | 'iron'): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: kind === 'iron' ? 0.12 : set.metalness, roughness: set.roughness })
  m.name = `mechanical-lion:${kind}:${set.name}`
  const detailSet: MaterialSet = kind === 'iron'
    ? { ...set, normalStrength: 0.3, scale: [0.3, 0.3], scales: [0.25, 0.045, 0.0012], detail: { ...set.detail, macro: 0.25, macroContrast: 0.2, mid: 0.45, micro: 0.2 } }
    : { ...set, normalStrength: 0.2, grain: set.grain ? { ...set.grain, relief: 0.1, shade: 0.14, sheen: 0.05 } : null }
  const nodes = stack.detail(m, detailSet, { uv: uv(), count: 3, maps: 1, fade: [6, 35] })
  if (kind === 'iron') {
    const grain = nodes.albedo.dot(vec3(0.2126, 0.7152, 0.0722))
    // forged iron, dark but not black, so the hammered face reads in the hall's light
    m.colorNode = lin('#57504a').mul(grain.mul(0.55).add(0.4)).mul(nodes.occlusion)
    m.roughnessNode = nodes.roughness.mul(0.9).clamp(0.6, 0.86)
  } else {
    const fibres = nodes.albedo.dot(vec3(0.2126, 0.7152, 0.0722))
    m.colorNode = lin('#7c5a38').mul(fibres.mul(0.7).add(0.35)).mul(nodes.occlusion)
    m.roughnessNode = nodes.roughness.max(0.62)
  }
  return m
}

/** A surface for a set that never dressed: the part still stands, plainly. */
export function plainSurface(kind: 'oak' | 'iron'): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: kind === 'iron' ? 0.45 : 0, roughness: kind === 'iron' ? 0.5 : 0.7 })
  m.name = `mechanical-lion:${kind}:plain`
  m.colorNode = kind === 'iron' ? lin('#3a3a39') : lin('#8c7358')
  return m
}
