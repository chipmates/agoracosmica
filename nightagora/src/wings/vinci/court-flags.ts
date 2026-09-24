/* THE FACE OF A LAID FLAG, OUTDOORS.

   A slab laid in a court is its own stone, at three scales. At the slab: a
   tone and a tint from the bed it was quarried from, and a lie of its own,
   settled a little out of level (more where a root has lifted it), so it
   takes the light at its own angle and holds the rain along its low edge.
   Within the slab: the finish its mason left (the bands of a toothed chisel
   on a dressed flag, the lines of the saw on a sawn one), worn off along
   the way feet take; corners spalled and arrises chipped; the leaves'
   stains under a tree; lichen where nobody walks. At arm's length: grain,
   shell and vein where the stone has them, pits. The laying (the grid, the
   bond, the joints) is the caller's; this is only the face, each scale drawn
   where a pixel can hold it and falling to its own mean where it cannot. */
import * as TSL from 'three/tsl'
import { anisotropicFootprint, resolved } from '../../stack/detail'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { abs, cos, exp, float, floor, fract, length, max, min, mix, mx_noise_float, positionWorld, sin, smoothstep, vec2, vec3 } =
  TSL as unknown as Record<string, N>

/** How the flags are laid, in metres: courses along the east axis
    `pitchEast` apart from `east`, slabs along the north axis `pitchNorth`
    apart from `north`, every other course shifted by `bond` along north. */
export interface FlagGrid { east: number; north: number; pitchEast: number; pitchNorth: number; bond: number }

export interface FlagOptions {
  /** the laying frame when it is not the wing's own east and north; the
      grid's origin is taken off these as off the world's */
  at?: { east: N; north: N }
  /** stems standing among the flags, in the frame the face is laid in: the
      slabs round them heave, and the fall stains the stone under them */
  roots?: readonly { east: number; north: number }[]
  /** a hand-dressed flag keeps the bands of its chisel, a sawn one the
      lines of its saw */
  tooled?: 'dressed' | 'sawn'
}

/** What a flag's face does to the surface drawn on it: a factor on its
    albedo around one, a change of roughness, a height in metres a caller
    may relieve, the slab's own lie as a slope (d height / d east, d height
    / d north, in the laying frame) for a caller without a height path, and
    how wet the face stands (0 to 1). */
export interface FlagFace { tone: N; rough: N; height: N; slope: N; wet: N }

/** a line `width` wide at distance `d`, as much of it as the pixel holds */
const lineCover = (d: N, width: number | N, pixel: N): N => {
  const w = typeof width === 'number' ? float(width) : width
  return float(1).sub(smoothstep(w.mul(.5), w.mul(.5).add(pixel), d)).mul(w.div(pixel).min(1))
}

/** The face of the flag under this pixel. `walked` is 0 to 1, how much of
    the traffic crosses it; `damp` 0 to 1, how little sun and wind dry it. */
export function flagFace(grid: FlagGrid, walked: N, damp: N, opts: FlagOptions = {}): FlagFace {
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const east = (opts.at ? opts.at.east : P.x).sub(grid.east)
  const north = (opts.at ? opts.at.north : P.z.negate()).sub(grid.north)
  const pE = grid.pitchEast, pN = grid.pitchNorth
  const course = floor(east.div(pE))
  const shift = fract(course.mul(.5)).mul(2).mul(grid.bond)
  const along = north.sub(shift).div(pN)
  const slab = floor(along)
  const inE = fract(east.div(pE)).mul(pE), inN = fract(along).mul(pN)
  const hash = (salt: number): N => fract(sin(course.mul(12.9898).add(slab.mul(78.233)).add(salt)).mul(43758.5453))
  const seen = resolved(Math.min(pE, pN), pixel)
  // where this point stands from its slab's middle, and the middle itself
  const dE = inE.sub(pE / 2), dN = inN.sub(pN / 2)
  const cE = course.add(.5).mul(pE), cN = slab.add(.5).mul(pN).add(shift)

  // ─── the slab ───────────────────────────────────────────────────────────
  // its lie: every slab a little out of level, one in five settled further;
  // near a stem the root lifts the slab's near side
  const settled = smoothstep(.78, .95, hash(13)).mul(1.6).add(1)
  let tiltE: N = hash(11).sub(.5).mul(.02).mul(settled), tiltN: N = hash(12).sub(.5).mul(.02).mul(settled)
  let heave: N = float(0)
  for (const r of opts.roots ?? []) {
    const rE = cE.sub(r.east - grid.east), rN = cN.sub(r.north - grid.north)
    const d = length(vec2(rE, rN)).max(.35)
    const h = exp(d.div(2.2).pow(2).negate())
    tiltE = tiltE.sub(rE.div(d).mul(h).mul(.034)); tiltN = tiltN.sub(rN.div(d).mul(h).mul(.034))
    heave = heave.max(h)
  }
  const plane = dE.mul(tiltE).add(dN.mul(tiltN)).add(heave.mul(.009))
  // its bed: a tone, and a tint that leans warm or cool; one slab in ten from
  // an ochre bed and one in eight from a blue-grey one
  const own = hash(0).sub(.5).mul(seen)
  const bed = hash(15)
  const bedTint = mix(mix(vec3(1.06, 1, .86), vec3(1, 1, 1), smoothstep(.08, .11, bed)), vec3(.88, .93, .99), smoothstep(.86, .89, bed))
  const hue = mix(vec3(1.045, 1, .935), vec3(.955, .99, 1.05), hash(6.6)).mul(bedTint)
  const tint = mix(vec3(1, 1, 1), hue, seen)
  // the rain runs to the slab's low edge and stands there along the joint
  const lean = length(vec2(tiltE, tiltN)).max(1e-5)
  const lowE = tiltE.greaterThan(0).select(inE, float(pE).sub(inE))
  const lowN = tiltN.greaterThan(0).select(inN, float(pN).sub(inN))
  const seamW = mx_noise_float(vec3(east.mul(3.1), north.mul(3.1), 5.5)).mul(.025).add(.05)
  const seam = max(abs(tiltE).div(lean).mul(float(1).sub(smoothstep(0, seamW, lowE))),
    abs(tiltN).div(lean).mul(float(1).sub(smoothstep(0, seamW, lowN))))
    .mul(smoothstep(.0015, .005, lean)).mul(resolved(.06, pixel))

  // ─── within the slab ────────────────────────────────────────────────────
  // the grain runs the way the bed ran, a different way in every slab
  const turn = hash(3.7).mul(3.1416)
  const bedAt = east.mul(cos(turn)).add(north.mul(sin(turn)))
  const grain = mx_noise_float(vec3(bedAt.mul(22), bedAt.mul(1.6).add(hash(5.1).mul(40)), hash(1.3).mul(20))).mul(resolved(.045, pixel))
  const fleck = mx_noise_float(vec3(east, north, hash(2.4).mul(9)).mul(70)).mul(resolved(.014, pixel))
  const cloud = mx_noise_float(vec3(east.mul(2.1), north.mul(2.1), hash(8.2).mul(30))).mul(resolved(.5, pixel))
    .add(smoothstep(.1, .6, mx_noise_float(vec3(east.mul(6.5), north.mul(6.5), hash(8.4).mul(30)))).mul(-.8).mul(resolved(.15, pixel)))
  const pits = smoothstep(.62, .82, mx_noise_float(vec3(east, north, 4.1).mul(160))).mul(resolved(.006, pixel))
  // the stone's own granule, a few millimetres, pale and dark
  const granule = mx_noise_float(vec3(east, north, hash(7.7).mul(5)).mul(260)).mul(resolved(.004, pixel))
  // THE MASON'S FINISH. A dressed flag is worked in passes of a toothed
  // chisel, each a band a few centimetres wide with its teeth's grooves
  // along it, every band its own depth; a sawn one keeps the saw's lines.
  // Feet wear either off.
  const toolTurn = hash(19).greaterThan(.5).select(float(1.5708), float(0)).add(hash(19.3).sub(.5).mul(.3))
  const across = dE.mul(cos(toolTurn)).add(dN.mul(sin(toolTurn)))
  const lengthwise = dN.mul(cos(toolTurn)).sub(dE.mul(sin(toolTurn)))
  const dressed = opts.tooled !== 'sawn'
  const bandM = dressed ? .042 : .021
  const bandAt = across.div(bandM).add(mx_noise_float(vec3(lengthwise.mul(6), hash(19.7).mul(17), 2.2)).mul(dressed ? .35 : .15))
  const band = fract(sin(floor(bandAt).mul(41.37).add(hash(19.9).mul(91))).mul(24634.6345)).sub(.5)
  // the teeth's grooves wander as a hand-held chisel wanders, and each band
  // is struck a little off the last
  const teethAt = across.div(dressed ? .0055 : .0024).add(mx_noise_float(vec3(lengthwise.mul(3), across.mul(3), hash(19.5).mul(7))).mul(1.6))
    .add(floor(bandAt).mul(.37))
  const teeth = sin(teethAt.mul(6.2832)).mul(resolved(dressed ? .0055 : .0024, pixel))
  const kept = float(1).sub(walked.mul(.85))
  const tooling = band.mul(resolved(bandM, pixel)).mul(dressed ? .075 : .03).add(teeth.mul(dressed ? .006 : .004)).mul(kept)
  // shell in some beds: a fragment's section a centimetre or two across, a
  // pale calcite rim; in others a vein of calcite or a dark stylolite seam
  const shellCell = vec2(east, north).div(.055), sc = floor(shellCell), sf = fract(shellCell)
  const sh = (salt: number): N => fract(sin(sc.x.mul(127.1).add(sc.y.mul(311.7)).add(salt)).mul(43758.5453))
  const shelly = smoothstep(.35, .55, hash(16))
  const sq = sf.sub(vec2(sh(3).mul(.5).add(.25), sh(4).mul(.5).add(.25)))
  const st = sh(5).mul(3.1416), sr = sh(2).mul(.1).add(.08)
  const su = sq.x.mul(cos(st)).add(sq.y.mul(sin(st))), sv = sq.y.mul(cos(st)).sub(sq.x.mul(sin(st)))
  const rho = length(vec2(su.div(sr), sv.div(sr.mul(sh(6).mul(.45).add(.4)))))
  const half = sh(7).greaterThan(.45).select(float(1), smoothstep(-.05, .05, sv))
  const shellHere = sh(1).lessThan(.2).select(float(1), float(0)).mul(shelly).mul(resolved(.012, pixel))
  const shell = float(1).sub(smoothstep(.1, .28, rho.sub(1).abs())).mul(half).mul(shellHere)
  const shellCore = float(1).sub(smoothstep(.7, .95, rho)).mul(shellHere)
  const veinTurn = hash(17.5).mul(3.1416)
  const veinAcross = dE.mul(cos(veinTurn)).add(dN.mul(sin(veinTurn))), veinAlong = dN.mul(cos(veinTurn)).sub(dE.mul(sin(veinTurn)))
  const veinD = veinAcross.sub(hash(17.7).sub(.5).mul(Math.min(pE, pN) * .7))
    .add(mx_noise_float(vec3(veinAlong.mul(2.4), hash(17.9).mul(13), 1.9)).mul(.06)).abs()
  const vein = lineCover(veinD, mx_noise_float(vec3(veinAlong.mul(7), 3.3, hash(17.2).mul(7))).mul(.0015).add(.003), pixel)
    .mul(smoothstep(.7, .72, hash(17))).mul(resolved(.06, pixel))
  const styloD = veinAcross.add(hash(18.3).sub(.5).mul(Math.min(pE, pN) * .6))
    .add(mx_noise_float(vec3(veinAlong.mul(1.7), 7.7, hash(18.5).mul(11))).mul(.05))
    .add(fract(veinAlong.div(.011)).sub(.5).abs().sub(.25).mul(.009)).abs()
  const stylolite = lineCover(styloD, .0022, pixel).mul(smoothstep(.82, .84, hash(18))).mul(resolved(.06, pixel))

  // ─── the edges ──────────────────────────────────────────────────────────
  // the arrises hold the dirt of the joint; worn slabs have them rounded paler
  const toE = min(inE, float(pE).sub(inE)), toN = min(inN, float(pN).sub(inN))
  const toJoint = min(toE, toN)
  const halo = mx_noise_float(vec3(east.mul(9), north.mul(9), hash(2.9).mul(11))).mul(.035).add(.06)
  const arris = float(1).sub(smoothstep(0, halo, toJoint)).mul(resolved(.06, pixel))
  // algae creeps in from the joints where the court stays damp
  const film = smoothstep(.35, .75, mx_noise_float(vec3(east.mul(1.3), north.mul(1.3), 2.9)).add(damp.mul(.6)))
    .mul(float(1).sub(smoothstep(.02, .45, toJoint))).mul(damp).mul(resolved(.2, pixel))
  // CHIPPED ARRISES: an edge has lost a flake here and there, pale where the
  // chip is fresh, the joint's dirt where it is old
  const edgeAt = toE.lessThan(toN).select(north, east)
  const chipSize = smoothstep(.45, .85, mx_noise_float(vec3(edgeAt.mul(7), hash(9.1).mul(31), 3.3))).mul(.03)
  const chip = float(1).sub(smoothstep(chipSize.mul(.6), chipSize.add(.002), toJoint)).mul(chipSize.greaterThan(.004).select(float(1), float(0)))
    .mul(resolved(.02, pixel))
  const oldChip = hash(4.4).greaterThan(.5)
  // A SPALLED CORNER: a corner takes every knock, and about one in three
  // has lost a wedge of stone a few centimetres across, its break a line of
  // shadow along the inner edge
  const quad = inE.greaterThan(pE / 2).select(float(3.1), float(0)).add(inN.greaterThan(pN / 2).select(float(5.7), float(0)))
  const corner = fract(sin(course.mul(12.9898).add(slab.mul(78.233)).add(quad).add(21.3)).mul(43758.5453))
  const spallR = smoothstep(.4, .9, corner).mul(.1)
  const cut = toE.mul(corner.mul(.9).add(.6)).add(toN)
  const spall = float(1).sub(smoothstep(spallR.sub(.004), spallR, cut)).mul(spallR.greaterThan(.01).select(float(1), float(0))).mul(resolved(.03, pixel))
  const spallEdge = lineCover(cut.sub(spallR).abs(), .003, pixel).mul(spallR.greaterThan(.01).select(float(1), float(0))).mul(resolved(.03, pixel))
  const freshSpall = fract(corner.mul(71.1)).greaterThan(.55)
  // GRIT AND MOSS IN THE JOINTS: the sand of the joint is dark grit at its
  // edge, and where the court stays damp a cushion of moss sits in it
  const inJoint = float(1).sub(smoothstep(.004, .016, toJoint))
  const grit = smoothstep(.2, .7, mx_noise_float(vec3(east, north, 6.1).mul(90))).mul(inJoint).mul(resolved(.01, pixel))
  const moss = smoothstep(.35, .7, mx_noise_float(vec3(east.mul(4), north.mul(4), 8.8)).add(damp.mul(.5))).mul(inJoint).mul(damp)
    .mul(resolved(.03, pixel))

  // ─── what lies on it ────────────────────────────────────────────────────
  // under a tree the fall has lain wet and left its tannin: brown leaf-shaped
  // stains, some fresh, most faded
  let under: N = float(0)
  for (const r of opts.roots ?? []) {
    const d = length(vec2(east.sub(r.east - grid.east), north.sub(r.north - grid.north)))
    under = under.max(exp(d.div(4.2).pow(2).negate()))
  }
  const leafCell = vec2(east, north).div(.11), lc = floor(leafCell), lf = fract(leafCell)
  const lh = (salt: number): N => fract(sin(lc.x.mul(269.5).add(lc.y.mul(183.3)).add(salt)).mul(43758.5453))
  const lq = lf.sub(vec2(lh(2).mul(.3).add(.35), lh(3).mul(.3).add(.35)))
  const lt = lh(4).mul(3.1416)
  const lu = lq.x.mul(cos(lt)).add(lq.y.mul(sin(lt))), lv = lq.y.mul(cos(lt)).sub(lq.x.mul(sin(lt)))
  const leafRho = length(vec2(lu.div(lh(5).mul(.1).add(.2)), lv.div(lh(6).mul(.06).add(.1).mul(float(1).sub(lu.mul(1.6)).max(.3)))))
  const stain = float(1).sub(smoothstep(.55, 1, leafRho)).mul(lh(1).lessThan(under.mul(.42)).select(float(1), float(0)))
    .mul(lh(7).mul(.7).add(.3)).mul(float(1).sub(walked.mul(.5))).mul(resolved(.03, pixel))
  // lichen: grey-white rosettes on the stone feet do not reach
  const lichenCell = vec2(east, north).div(.085), kc = floor(lichenCell), kf = fract(lichenCell)
  const kh = (salt: number): N => fract(sin(kc.x.mul(419.2).add(kc.y.mul(371.9)).add(salt)).mul(43758.5453))
  // in colonies, each rosette its own size and a ragged rim, grey on the stone
  const colony = smoothstep(.15, .6, mx_noise_float(vec3(east.mul(1.7), north.mul(1.7), 9.3)).add(damp.mul(.3)))
  const kq = kf.sub(vec2(kh(2).mul(.4).add(.3), kh(3).mul(.4).add(.3)))
  const kRho = length(kq).div(kh(4).pow(2).mul(.3).add(.08)).add(mx_noise_float(vec3(kq.mul(40), kh(5).mul(9))).mul(.25))
  const lichen = float(1).sub(smoothstep(.7, 1, kRho)).mul(kh(1).lessThan(float(1).sub(walked).mul(colony).mul(damp.mul(.3).add(.12))).select(float(1), float(0)))
    .mul(kh(6).mul(.6).add(.4)).mul(resolved(.02, pixel))

  // ─── wear ───────────────────────────────────────────────────────────────
  // A DISHED FACE ON THE WAY FEET TAKE: each slab worn hollow toward its
  // middle where it is walked, a few millimetres at most
  const bowl = sin(inE.div(pE).mul(3.1416)).mul(sin(inN.div(pN).mul(3.1416)))
  const dish = bowl.mul(walked).mul(.003)
  const wet = seam.mul(float(.75).sub(walked.mul(.3))).max(film.mul(.5))

  const lum = float(1).add(own.mul(.36)).add(grain.mul(.12)).add(fleck.mul(.07)).add(granule.mul(.06)).add(cloud.mul(.1)).sub(pits.mul(.14))
    .add(tooling.mul(1.25)).add(shell.mul(.22)).sub(shellCore.mul(.05)).add(vein.mul(.24)).sub(stylolite.mul(.34))
    .sub(arris.mul(float(.26).sub(walked.mul(.14)))).add(walked.mul(.06)).sub(film.mul(.26)).add(dish.mul(15))
    .add(chip.mul(oldChip.select(float(-.2), float(.14)))).sub(grit.mul(.3))
    .add(spall.mul(freshSpall.select(float(.2), float(-.26)))).sub(spallEdge.mul(.5))
    .sub(wet.mul(.3)).sub(stain.mul(.3)).add(lichen.mul(.1))
  let tone: N = tint.mul(max(lum, .45))
  tone = mix(tone, tone.mul(vec3(1.02, .9, .74)), stain.mul(.8))
  tone = mix(tone, tone.mul(vec3(.93, 1, .9)), lichen.mul(.7))
  tone = mix(tone, tone.mul(vec3(.93, 1, .9)), wet.mul(damp).mul(.5))
  tone = mix(tone, vec3(.55, .66, .42), moss.mul(.75))
  const rough = own.mul(.08).add(hash(14.2).sub(.5).mul(.24).mul(seen)).add(grain.mul(.03)).sub(walked.mul(.16)).add(film.mul(.04)).add(chip.mul(.05)).sub(dish.mul(20))
    .add(tooling.abs().mul(.3)).add(spall.mul(.06)).sub(wet.mul(.24)).add(lichen.mul(.06))
  const toolHeight = teeth.mul(dressed ? .00015 : .00005).mul(kept)
  const height = plane.sub(dish).sub(chip.mul(.002)).sub(spall.mul(.004)).sub(inJoint.mul(.0008)).add(toolHeight)
  return { tone, rough, height, slope: vec2(tiltE, tiltN).mul(seen), wet }
}

/** a distance to the nearest of a few boxes on the ground plane, for damp */
export function distanceToBoxes(boxes: readonly { west: number; south: number; east: number; north: number }[]): N {
  const P = positionWorld
  const e = P.x, n = P.z.negate()
  let d: N = float(1e4)
  for (const b of boxes) {
    const dx = max(max(float(b.west).sub(e), e.sub(b.east)), 0), dn = max(max(float(b.south).sub(n), n.sub(b.north)), 0)
    d = min(d, length(vec2(dx, dn)))
  }
  return d
}

/** a distance to the nearest of a few walked lines on the ground plane, in
    the wing's east and north, for the wear along them */
export function distanceToLines(lines: readonly (readonly (readonly [number, number])[])[]): N {
  const P = positionWorld
  const p = vec2(P.x, P.z.negate())
  let d: N = float(1e4)
  for (const line of lines)
    for (let i = 0; i + 1 < line.length; i++) {
      const a = vec2(line[i]![0], line[i]![1]), b = vec2(line[i + 1]![0], line[i + 1]![1])
      const ab = b.sub(a), t = p.sub(a).dot(ab).div(ab.dot(ab)).clamp(0, 1)
      d = min(d, length(p.sub(a.add(ab.mul(t)))))
    }
  return d
}
