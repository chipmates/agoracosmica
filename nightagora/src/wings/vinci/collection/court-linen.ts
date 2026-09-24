/** THE PARACHUTE'S CLOTH, AS SEALED LINEN.
 *
 * The sheet names the cloth and its size and nothing of its making:
 * "pannolino intasato", linen with its pores stopped, twelve braccia a side
 * and twelve high (CA 1058v). How such a cloth is made up is the museum's
 * assumption, declared in the dossier (a-cloth-make-up, a-cloth-sealing,
 * a-cloth-light): cloths of a hand loom's width joined with felled seams, a
 * tape over each ridge, a folded hem laced to the frame, a patch at each
 * corner and at the apex, and a size brushed into the weave. All of it is
 * drawn on the dossier's four flat faces: no vertex moves, so its envelope
 * and every clearance proved against it stand.
 *
 * Linen is thin. What reaches a face's far side comes through it, warmer and
 * weaker, and every doubled layer lets less through, so a face with the sun
 * behind it shows its making as darker lines in a glow. The lighting model
 * adds that one term to the standard one and keeps the rest.
 */
import { Color, DoubleSide, MeshStandardNodeMaterial, PhysicalLightingModel, type Mesh, type Object3D } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lineCoverage, reliefNormal, resolved } from '../../../stack/detail'
import { dossiers } from '../machines/catalog'
import { hourKey } from '../site'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs, atan, attribute, float, length, min, mix, modelWorldMatrix, modelWorldMatrixInverse, mx_noise_float, positionGeometry,
  positionViewDirection, positionWorld, select, sin, smoothstep, step, transformNormalToView, vec2, vec3, vec4,
} = TSL as unknown as Record<string, N>

/** The canopy's own faces, off the dossier: its half base, its sill and its rise. */
const CANOPY = (() => {
  const part = dossiers['parachute'].parts.find(p => p.id === 'canopy')
  const vertices = part && typeof part.shape !== 'string' ? part.shape.vertices_m : undefined
  const corner = vertices?.[0], apex = vertices?.[4]
  if (!corner || !apex) throw new Error('The parachute dossier has no canopy mesh')
  const half = Math.abs(corner[0] ?? 0), sill = corner[1] ?? 0, top = apex[1] ?? 0
  return { half, sill, top, rise: top - sill, slant: Math.hypot(top - sill, half) }
})()
/** each face's outward normal, in the dossier's frame: out and up */
const OUT = CANOPY.rise / CANOPY.slant, UP = CANOPY.half / CANOPY.slant
const FACES: [number, number, number][] = [[OUT, UP, 0], [-OUT, UP, 0], [0, UP, OUT], [0, UP, -OUT]]

/** THE MAKING UP, every number an assumption the dossier declares. Metres
 * in the plane of a face: across it, and up its slant from the hem. */
export const SEALED_LINEN = {
  /** seam centres: cloths about three quarters of a metre wide, less the fell */
  cloth: .7,
  /** half a felled seam */
  seam: .011,
  /** the tape either side of a ridge */
  tape: .045,
  /** the folded hem, and the pitch of the eyelets the lacing passes through */
  hem: .07, lacing: .2,
  /** the corner patch's leg and the apex patch's depth */
  corner: .5, apex: .45,
  /** how far a face gives inward between its three edges, at its middle */
  give: .24,
  /** what one layer of the sized cloth passes, diffusely */
  through: .24,
  /** the share of the sun-facing cloth the hour's key reaches over the court's walls */
  lit: .6,
}

/** Unbleached linen under its size. */
const LINEN = new Color('#b0a893')

/** toward the sun of the hour, in the wing's own frame */
const SUN = (() => {
  const az = hourKey.sun_azimuth_deg.value * Math.PI / 180, el = hourKey.sun_elevation_deg.value * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})()

const hash = (a: N, b: N): N => sin(a.mul(12.9898).add(b.mul(78.233))).mul(43758.5453).fract()

interface ClothLight {
  /** the face's outward normal in view space */
  outward: N
  /** 1 where the eye stands outside the tent */
  outside: N
  /** what one layer passes here, as a share of a plain cloth's */
  through: N
  /** the colour the light takes through it */
  tint: N
  /** the four faces' outward normals in view space */
  faces: N[]
  /** the cloth's own colour */
  albedo: N
}

/** THE CLOTH IS THIN. What arrives on the far side of a face comes through
 * it: from outside, the tent's own inside, filled by what the sunlit faces
 * pass, and on a face the key stands behind the key itself, through the face
 * it lit; from inside, the key on the face's outside. Light passed through a
 * weave keeps going the way it went, so a face seen against the key glows
 * most. The key's shadow is read where its light enters the tent. */
class LinenLight extends PhysicalLightingModel {
  constructor(private readonly cloth: ClothLight) { super() }
  override direct(...[input, builder]: Parameters<PhysicalLightingModel['direct']>): void {
    const lightDirection = input.lightDirection as N, lightColor = input.lightColor as N
    const reflected = input.reflectedLight as unknown as { directDiffuse: N }
    const node = input.lightNode as unknown as { baseColorNode?: N | null }
    const { outward, outside, through, tint, faces, albedo } = this.cloth
    const T = SEALED_LINEN.through
    const facing = outward.dot(lightDirection)
    // the tent's inside, filled by what its sunlit faces pass: unshadowed
    // key, the share of the sun-facing cloth the hour's key reaches, and
    // what the enclosure keeps of it
    const open = node.baseColorNode ?? lightColor
    const inside = open.mul(faces.map(n => n.dot(lightDirection).max(0)).reduce((a, b) => a.add(b))
      .mul(T * SEALED_LINEN.lit * .25))
    // from inside, the key reaches a face only through the face it lit
    super.direct({ ...input, lightColor: lightColor.mul(mix(float(T), float(1), outside)) }, builder)
    const forward = positionViewDirection.dot(lightDirection).negate().max(0)
    const ahead = forward.mul(forward).mul(1.2).add(.6)
    const beam = lightColor.mul(mix(facing.max(0), facing.negate().max(0).mul(T), outside).mul(ahead))
    reflected.directDiffuse.addAssign(beam.add(inside.mul(outside)).mul(through.mul(T / Math.PI)).mul(tint))
    // and the inside of the tent, seen from under it, gives back what fills it
    reflected.directDiffuse.addAssign(inside.mul(outside.oneMinus()).mul(albedo).mul(1 / Math.PI))
  }
}

class SealedLinenMaterial extends MeshStandardNodeMaterial {
  cloth: ClothLight | null = null
  override setupLightingModel(): PhysicalLightingModel {
    return this.cloth ? new LinenLight(this.cloth) : new PhysicalLightingModel()
  }
}

/** The canopy's surface: its making, its give, and the light through it. */
export function sealedLinen(name: string): MeshStandardNodeMaterial {
  const m = new SealedLinenMaterial({ roughness: .9, metalness: 0 })
  m.name = name
  m.side = DoubleSide
  const L = SEALED_LINEN
  const p = positionGeometry
  // which face: the pair along Z where |z| leads, the pair along X elsewhere
  const onZ = step(abs(p.x), abs(p.z))
  const across = mix(p.z, p.x, onZ)
  const sign = select(mix(p.x, p.z, onZ).greaterThan(0), float(1), float(-1))
  const face = onZ.mul(2).add(sign.mul(.5).add(.5))
  const t = p.y.sub(CANOPY.sill).div(CANOPY.rise).clamp(0, 1)
  const up = t.mul(CANOPY.slant)
  const halfAt = t.oneMinus().mul(CANOPY.half)
  const toRidge = halfAt.sub(abs(across)).mul(CANOPY.slant / Math.hypot(CANOPY.slant, CANOPY.half)).max(0)
  // the pixel across each of the face's own lines
  const pixelAcross = vec2(across.dFdx(), across.dFdy()).length().max(.00002)
  const pixelUp = vec2(up.dFdx(), up.dFdy()).length().max(.00002)
  const pixelRidge = vec2(toRidge.dFdx(), toRidge.dFdy()).length().max(.00002)

  // THE CLOTHS: one centred on the face's own middle, the seams between
  const q = across.div(L.cloth).add(.5)
  const panel = q.floor()
  const toSeam = float(.5).sub(q.fract().sub(.5).abs()).mul(L.cloth)
  const seam = lineCoverage(toSeam, L.seam, L.cloth, pixelAcross)
  const pooled = float(1).sub(smoothstep(0, .05, toSeam)).mul(resolved(.05, pixelAcross))
  // THE EDGES: the ridge tape, the hem, the corner and apex patches
  const within = (distance: N, width: number | N, pixel: N): N =>
    float(1).sub(smoothstep(float(width).sub(pixel), float(width).add(pixel), distance))
  const tape = within(toRidge, L.tape, pixelRidge)
  const hem = within(up, L.hem, pixelUp)
  const patch = within(up.add(toRidge), L.corner, pixelUp.add(pixelRidge))
    .max(float(1).sub(within(up, CANOPY.slant - L.apex, pixelUp)))
  // the eyelets the lacing passes through, along the hem
  const eyeAcross = across.div(L.lacing).add(.5).fract().sub(.5).mul(L.lacing)
  const eyelet = float(1).sub(smoothstep(.004, .008, length(vec2(eyeAcross, up.sub(L.hem * .5)))))
    .mul(resolved(.016, pixelAcross))

  // THE SIZE, brushed into each cloth: a patchiness a face wide, and where
  // each brushful ran out, a hand's width across
  const coat = mx_noise_float(vec3(across.mul(.8), up.mul(.55), face.mul(3.1))).mul(.7)
    .add(mx_noise_float(vec3(across.mul(5.5), up.mul(7.5), face.mul(5.3).add(panel.mul(1.7)))).mul(.3).mul(resolved(.1, pixelAcross.max(pixelUp))))
  // each cloth shades a little from one selvage to the other
  const selvage = q.fract().sub(.5).mul(hash(panel.add(2), face.add(9)).sub(.5).mul(2))
  // THE THREAD, three scales down: a cloud where the weave runs close or
  // open, the warp's slub runs and the weft's uneven beat, and the slubs
  // themselves; each is gone where the pixel is wider than it
  const cloud = mx_noise_float(vec3(across.mul(16), up.mul(11), face.add(panel.mul(3.7)))).mul(resolved(.05, pixelAcross.max(pixelUp)))
  const runs = mx_noise_float(vec3(across.mul(150), up.mul(2.6), panel.mul(2.1).add(face))).mul(resolved(.007, pixelAcross))
  const beat = mx_noise_float(vec3(across.mul(2.2), up.mul(120), face.mul(1.7).add(panel))).mul(resolved(.009, pixelUp))
  const warp = smoothstep(.45, .85, mx_noise_float(vec3(across.mul(260), up.mul(5), panel.mul(2.3).add(face))))
    .mul(resolved(.004, pixelAcross))
  const weft = smoothstep(.5, .9, mx_noise_float(vec3(across.mul(4), up.mul(240), face.mul(1.9).add(panel))))
    .mul(resolved(.004, pixelUp))
  const grain = cloud.mul(.45).add(runs.mul(.35)).add(beat.mul(.3))

  // THE GIVE: each face sags between its three edges, most at its middle,
  // and the stiff cloth breaks into a few long folds that run to the apex;
  // where a corner is pulled the cloth draws into rays from it, and between
  // two eyelets the hem sags a little from the frame
  const w = across.div(halfAt.max(.05)).clamp(-1, 1)
  const bump = t.oneMinus().mul(w.oneMinus()).mul(t.oneMinus().mul(w.add(1))).mul(t).mul(27 / 4).max(0)
  const folds = mx_noise_float(vec3(w.mul(2.6), t.mul(1.4), face.mul(2.3))).mul(bump.sqrt())
  const fromCorner = vec2(float(CANOPY.half).sub(abs(across)), up)
  const ray = sin(atan(fromCorner.y, fromCorner.x.max(.001)).mul(9).add(mx_noise_float(vec3(fromCorner.mul(1.6), face.add(sign))).mul(2.2)))
  const rays = ray.mul(float(1).sub(smoothstep(.2, 1.6, length(fromCorner)))).mul(smoothstep(.05, .25, length(fromCorner)))
    .mul(resolved(.12, pixelAcross.max(pixelUp)))
  const scallop = sin(across.mul(Math.PI * 2 / L.lacing)).abs().mul(float(1).sub(smoothstep(0, .12, up))).mul(resolved(.1, pixelAcross))
  const seamRidge = float(1).sub(smoothstep(0, L.seam * 1.6, toSeam)).mul(resolved(L.seam * 3, pixelAcross))
  const pucker = sin(up.mul(Math.PI * 2 / .05).add(panel.mul(1.3))).mul(float(1).sub(smoothstep(0, .03, toSeam)))
    .mul(resolved(.05, pixelUp)).mul(resolved(.03, pixelAcross))
  const height = bump.mul(-L.give).add(folds.mul(.03)).add(rays.mul(.006)).sub(scallop.mul(.003))
    .add(seamRidge.mul(.0022)).add(pucker.mul(.0007)).add(hem.mul(.0025)).add(tape.mul(.0015))
    .add(runs.mul(.0003)).add(beat.mul(.0003))

  // THE OUTWARD NORMAL, from the face and not from the triangle's winding
  const nLocal = mix(vec3(sign.mul(OUT), UP, 0), vec3(0, UP, sign.mul(OUT)), onZ)
  const outward = transformNormalToView(nLocal).normalize()
  const outside = step(0, outward.dot(positionViewDirection))
  const toEye = outside.mul(2).sub(1)
  m.normalNode = reliefNormal(outward.mul(toEye), height.mul(toEye), .25)

  // THE COLOUR: a tone per cloth, the size darker where it lies thick and
  // where it pools along a seam, the layers a little darker, the thread's
  // own grain, and the hem darkened by handling
  const tone = hash(face, panel).sub(.5).mul(.1).add(1).add(selvage.mul(.02))
  const warmth = hash(panel.add(7), face.add(3)).sub(.5).mul(.05)
  let albedo = vec3(LINEN.r, LINEN.g, LINEN.b).mul(tone).mul(vec3(warmth.add(1), 1, warmth.oneMinus()))
  albedo = albedo.mul(coat.mul(-.06).add(1)).mul(pooled.mul(-.08).add(1))
  albedo = albedo.mul(seam.mul(-.12).add(1)).mul(tape.mul(-.07).add(1)).mul(hem.mul(-.14).add(1)).mul(patch.mul(-.04).add(1))
  albedo = albedo.mul(grain.mul(.05).add(1)).mul(warp.mul(.06).add(1)).mul(weft.mul(-.05).add(1))
  albedo = albedo.mul(folds.mul(.05).add(1)).mul(rays.mul(.025).add(1))
  albedo = albedo.mul(float(1).sub(smoothstep(0, .6, up)).mul(-.07).add(1)).mul(eyelet.mul(-.5).add(1))
  m.colorNode = albedo
  m.roughnessNode = coat.mul(-.04).add(.9).sub(pooled.mul(.04))

  // WHAT ONE LAYER PASSES HERE: less through every doubled layer, through
  // the size where it lies thick, and where the weave runs close
  const thickness = hash(face.add(11), panel.add(5)).sub(.5).mul(.16).add(1)
  const through = thickness.mul(seam.mul(-.7).add(1)).mul(tape.mul(-.6).add(1)).mul(hem.mul(-.8).add(1))
    .mul(patch.mul(-.5).add(1)).mul(coat.mul(-.18).add(1)).mul(pooled.mul(-.3).add(1))
    .mul(grain.mul(-.18).add(1)).mul(warp.add(weft).mul(-.35).add(1)).mul(eyelet.oneMinus())
  // light through linen comes out warmer than it went in
  const lum = LINEN.r * .2126 + LINEN.g * .7152 + LINEN.b * .0722
  const tint = vec3((LINEN.r / lum) ** 1.5, (LINEN.g / lum) ** 1.5, (LINEN.b / lum) ** 1.5).mul(tone)
  const faces = FACES.map(n => transformNormalToView(vec3(n[0], n[1], n[2])).normalize())
  m.cloth = { outward, outside, through, tint, faces, albedo }

  // WHERE THE KEY ENTERS. A face turned from the sun is lit through the
  // faces that take it, so its shadow is read where the ray from it toward
  // the sun leaves the tent, a few centimetres out; a sunlit face reads its own.
  const toward = modelWorldMatrixInverse.mul(vec4(SUN[0], SUN[1], SUN[2], 0)).xyz.normalize()
  const apex = vec3(0, CANOPY.top, 0)
  const exits = FACES.map(n => {
    const normal = vec3(n[0], n[1], n[2]), along = normal.dot(toward)
    return select(along.greaterThan(.001), normal.dot(apex.sub(p)).div(along.max(.001)), float(1e4))
  })
  const leave = exits.reduce((a, b) => min(a, b))
  const entry = modelWorldMatrix.mul(vec4(p.add(toward.mul(leave.add(.05))), 1)).xyz
  m.receivedShadowPositionNode = mix(positionWorld, entry, step(nLocal.dot(toward), 0))
  return m
}

/** Dress the court's canopy in its cloth. The surface it was built with is
 * put back on release and disposed by the machine; this one is released here. */
export function dressParachuteCloth(object: Object3D): () => void {
  let canopy: Mesh | undefined
  object.traverse(child => { if ((child as Mesh).isMesh && child.userData['partId'] === 'canopy') canopy = child as Mesh })
  if (!canopy) throw new Error('The parachute has no canopy to dress')
  const mesh = canopy, built = mesh.material
  const cloth = sealedLinen('vinci/machine/parachute/sealed-linen')
  mesh.material = cloth
  return () => { mesh.material = built; cloth.dispose() }
}

/** THE CLOTH'S SHADOW DOUBLE CASTS AND IS NEVER DRAWN. It stands three
 * centimetres inside the cloth, and from under the canopy its floor closes
 * the open base the dossier keeps open. The wing's shadow body folds its
 * triangles and the rail keeps it as a solid; in the stands' own body the
 * double is the only surface of role 4. */
export function hideClothDouble(standSolids: MeshStandardNodeMaterial): void {
  standSolids.maskNode = attribute('collectionRoomRole', 'float').lessThan(3.5)
}
