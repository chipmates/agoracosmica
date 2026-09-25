/** THE HANG'S LIGHT ON THE WALL, THE FRAMES AND THE REPRODUCTIONS, from the
 * one table `picture-room-plan.ts` keeps.
 *
 * A head's pool on the wall is a physical spot. Its frame's shadow is not a
 * map: a frame is a box standing parallel to the wall, so the ray from any
 * point of the room to its head either passes the box or it does not, and
 * the answer is arithmetic (the box projected from the head onto the plane
 * the point stands in, softened by the head's own size). A map at any size
 * the page can afford cannot resolve a nine centimetre frame at thirty
 * metres; the arithmetic is exact at every distance. It is an engine term:
 * a renderer that traces its own shadows sets `engineTerms` to zero.
 *
 * A reproduction is drawn by the picture module and lit by the room through
 * one multiplier on its raster (`tone`), so the same heads light it here,
 * read off its own vertices; its varnish is drawn apart, additively, as a
 * film over it. Neither ever touches a pixel of the source.
 */
import { Color, Vector4 } from 'three/webgpu'
import * as TSL from 'three/tsl'
import {
  BEAM_KEEP, CANVAS_Z, FRAME_BACK_Z, FRAME_FRONT_Z, FRAME_SHADOW_Z, HANG_LIGHT_FIELDS, hangFrames, hangLightTable, LAMP_COLOUR, ROOM, SLIP_Z,
  WALL_FACE, type HangLightData,
} from './picture-room-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs, attribute, cameraPosition, exp, float, int, length, max, min, mix, normalize, positionWorld, pow, smoothstep,
  sqrt, uniform, uniformArray, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The world z of the lining's face: depths are measured north from it. */
const WALL_Z = -WALL_FACE

const linear = (hex: string): Color => new Color(hex)

/** THE ROOM'S LOOKS AS UNIFORMS, so an instrument may lean on them live and
 * no shader is rebuilt. The values are the ones the look rounds chose. */
export function pictureLooks() {
  return {
    /** every head's level, on the table's own */
    lampGain: uniform(1),
    lampColour: uniform(linear(LAMP_COLOUR)),
    /** the head's radius as a source: how soft a frame's shadow falls */
    lampRadius: uniform(.16),
    /** THE POOL each head throws on the canvas, shaped to its frame: how far
     * past the frame its full light runs, and how soft its edge is, in metres */
    poolMargin: uniform(.2),
    poolSoft: uniform(.22),
    /** THE BEAM'S FOOTPRINT on the wall: a crisp top a little over the frame,
     * the sides a little outside it and opening as the beam falls, no floor
     * to it (it falls down the wall onto the boards); in metres */
    beamTop: uniform(.16),
    beamTopSoft: uniform(.12),
    beamSide: uniform(.12),
    beamSideSoft: uniform(.17),
    beamOpen: uniform(.12),
    /** how far the foot runs past the frame, and how soft it grows as it falls */
    beamTail: uniform(1.2),
    beamTailSoft: uniform(.55),
    /** THE HALO: the lens's own scatter past its cut, as a share of the pool,
     * dying over `haloReach` metres from the frame into the wall above and
     * between the works; a framing projector scatters `haloCut` of it */
    halo: uniform(.2),
    haloReach: uniform(.34),
    haloCut: uniform(.35),
    /** how much of the physical falloff down the wall the beam keeps: at one
     * the pool is brightest where the head is nearest, high on the wall */
    beamKeep: uniform(.78),
    /** the beam's field past its cone, as a share of its axis: the spill
     * that reaches the lower wall and the boards, and its half angle's cosine */
    spill: uniform(.27),
    spillField: uniform(Math.cos(45 * Math.PI / 180)),
    /** the room's own light on a reproduction apart from its heads: the
     * north glazing and the room's bounce, as the wall beside it reads them */
    fill: uniform(new Color(.07, .077, .092)),
    /** the varnish: its roughness and how much of its reflection is drawn */
    varnishRough: uniform(.34),
    varnish: uniform(1.6),
    varnishEnv: uniform(.7),
    /** the room's air over its length: the colour it lays down and the
     * distance over which it lays down a little more than half */
    airColour: uniform(new Color(.05, .056, .068)),
    airMetres: uniform(95),
    air: uniform(1),
    /** engine-only terms (the analytic shadows); zero for a renderer that
     * computes its own */
    engineTerms: uniform(1),
  }
}
export type PictureLooks = ReturnType<typeof pictureLooks>
/** One set of looks for the whole room: the reproductions and the walls
 * read the same uniforms. */
export const PICTURE_LOOKS = pictureLooks()

/** a soft 2D box coverage: one inside, zero outside, `w` wide at its edge */
function boxCover(x: N, y: N, x0: N, x1: N, y0: N, y1: N, w: N): N {
  const cx = x0.add(x1).mul(.5), cy = y0.add(y1).mul(.5)
  const hx = x1.sub(x0).mul(.5).abs(), hy = y1.sub(y0).mul(.5).abs()
  const qx = abs(x.sub(cx)).sub(hx), qy = abs(y.sub(cy)).sub(hy)
  const outside = length(vec2(max(qx, 0), max(qy, 0)))
  const sd = outside.add(min(max(qx, qy), 0))
  return float(1).sub(smoothstep(w.negate(), w, sd))
}

/** THE POOL A HEAD THROWS: its lens shapes the beam to a soft rounded
 * rectangle round its frame on the wall, read where the ray from the head
 * through the point meets the wall's plane. */
function poolMask(P: N, L: N, west: N, east: N, low: N, high: N, looks: PictureLooks): N {
  const p = float(WALL_Z).sub(P.z), dL = float(WALL_Z).sub(L.z)
  const t = dL.sub(ROOM.finish - WALL_FACE).div(dL.sub(p).max(1e-3))
  const x = L.x.add(P.x.sub(L.x).mul(t)), y = L.y.add(P.y.sub(L.y).mul(t))
  const ax = east.sub(west).mul(.5).add(looks.poolMargin), ay = high.sub(low).mul(.5).add(looks.poolMargin)
  const dx = x.sub(west.add(east).mul(.5)).div(ax), dy = y.sub(low.add(high).mul(.5)).div(ay)
  const dx2 = dx.mul(dx), dy2 = dy.mul(dy)
  const e = sqrt(sqrt(dx2.mul(dx2).add(dy2.mul(dy2))))
  const soft = looks.poolSoft.div(ax.min(ay))
  return float(1).sub(smoothstep(float(1).sub(soft.mul(.5)), float(1).add(soft), e))
}

/** THE HEAD'S ASYMMETRIC BEAM: what its lens throws toward a point this far
 * from it, over what it throws at its own aim. */
function beam(distance: N, level: N): N {
  return pow(distance.div(level).max(.2), float(3 * (1 - BEAM_KEEP))).clamp(.35, 4)
}

/** EVERY WORK'S LIGHT IN ONE TABLE, eight vectors a row: a plane carries
 * only the slot of its work, because a vertex may carry eight buffers and a
 * work's light is eight vectors on its own. */
let table: N | undefined
function hangTable(): N {
  table ??= uniformArray(hangLightTable().map(row => new Vector4(row[0], row[1], row[2], row[3])), 'vec4')
  return table
}
function hangRow(slot: N): Record<keyof HangLightData, N> {
  const base = slot.mul(HANG_LIGHT_FIELDS.length), rows = hangTable()
  const out = {} as Record<keyof HangLightData, N>
  HANG_LIGHT_FIELDS.forEach((name, i) => { out[name] = rows.element(base.add(i)) })
  return out
}
function hangAttributes(): Record<keyof HangLightData, N> {
  return hangRow(int(attribute('hangSlot', 'float').add(.5)))
}

/** WHICH TWO WORKS A POINT OF THE ROOM STANDS BETWEEN: the work whose share of
 * the wall it faces, and the neighbour on the side it leans to. A pool never
 * reaches past its neighbour, so no point of the room sees more than these. */
function slotsAt(x: N): { own: N; other: N; apart: N } {
  const frames = hangFrames()
  let slot: N = int(0)
  for (let i = 0; i + 1 < frames.length; i++) {
    const boundary = (frames[i]!.outer.west + frames[i + 1]!.outer.east) / 2
    slot = slot.add(x.lessThan(boundary).select(int(1), int(0)))
  }
  const own = slot.toVar()
  const sight = hangRow(own).sight
  const centre = sight.x.add(sight.y).mul(.5)
  const other = max(min(own.add(x.lessThan(centre).select(int(1), int(-1))), int(frames.length - 1)), int(0))
  // at either end of the wall the neighbour is the work itself: it counts once
  return { own, other, apart: other.notEqual(own).select(float(1), float(0)) }
}

/** one past either end of the hang, where only the end work is read and its
    halo may run on over the wall to the door */
function hangEnd(x: N): N {
  const frames = hangFrames()
  const west = Math.min(...frames.map(f => f.outer.west)), east = Math.max(...frames.map(f => f.outer.east))
  return x.lessThan(west).or(x.greaterThan(east)).select(float(1), float(0))
}

/** HOW MUCH OF A HEAD A POINT SEES PAST A BOX standing off the wall: the box
 * [x0, x1] by [y0, y1], from depth `back` to depth `front` off the lining,
 * projected from the head onto the plane parallel to the wall that the point
 * stands in, softened by the head's size. `L` is the head, in the world. */
function boxVisibilityOf(P: N, L: N, x0: N, x1: N, y0: N, y1: N, back: number, front: number, radius: N): N {
  const p = float(WALL_Z).sub(P.z), dL = float(WALL_Z).sub(L.z)
  const a = max(float(back), p)
  const k = (d: N): N => dL.sub(p).div(dL.sub(d))
  const ka = k(a), kf = k(float(front))
  const proj = (v: N, l: N, s: N): N => l.add(v.sub(l).mul(s))
  const X0 = min(proj(x0, L.x, ka), proj(x0, L.x, kf)), X1 = max(proj(x1, L.x, ka), proj(x1, L.x, kf))
  const Y0 = min(proj(y0, L.y, ka), proj(y0, L.y, kf)), Y1 = max(proj(y1, L.y, ka), proj(y1, L.y, kf))
  const w = radius.mul(float(front).sub(p).max(0)).div(dL.sub(front)).add(.002)
  const cover = boxCover(P.x, P.y, X0, X1, Y0, Y1, w)
  const own = P.x.greaterThan(x0.sub(.003)).and(P.x.lessThan(x1.add(.003))).and(P.y.greaterThan(y0.sub(.003))).and(P.y.lessThan(y1.add(.003)))
  const behind = p.lessThan(front).and(own.not())
  return float(1).sub(cover.mul(behind.select(float(1), float(0))))
}

/** THE BEAM'S FOOTPRINT, read where the ray from the head through the point
 * meets the wall's plane: the oblique cone's own shape, a short crisp top
 * over the frame with its corners rounded, and below the work a long foot
 * that fades down the wall. Its brightness is the head's own falloff. */
function footprint(x: N, y: N, west: N, east: N, low: N, high: N, looks: PictureLooks): N {
  const cx = west.add(east).mul(.5), cy = low.add(high).mul(.5)
  const below = cy.sub(y).max(0)
  const hw = east.sub(west).mul(.5).add(looks.beamSide).add(below.mul(looks.beamOpen))
  const up = high.sub(cy).add(looks.beamTop), down = cy.sub(low).add(looks.beamTail)
  const over = y.greaterThan(cy)
  const dx = x.sub(cx).abs().div(hw), dy = y.sub(cy).abs().div(over.select(up, down))
  // the top a rounded square (a lens's cut), the foot an ellipse
  const dx2 = dx.mul(dx), dy2 = dy.mul(dy)
  const e = over.select(sqrt(sqrt(dx2.mul(dx2).add(dy2.mul(dy2)))), sqrt(dx2.add(dy2)))
  // the edge's softness runs on from the sides into the top and the foot, so
  // the two halves meet without a seam at the work's middle
  const side = looks.beamSideSoft.div(hw)
  const soft = over.select(mix(side, looks.beamTopSoft.div(up), smoothstep(0, 1, dy)),
    side.max(dy.mul(dy).mul(looks.beamTailSoft).min(.6)))
  return float(1).sub(smoothstep(float(1).sub(soft), float(1).add(soft), e))
}

/** ONE HEAD ON A POINT OF THE ROOM facing `n`: its irradiance there (candela,
 * cone, distance, incidence, its footprint or its cut, and the field it
 * spills past its cone), past its own frame and the frieze, and the unit
 * vector toward it. `shadows` false for the boards, which no frame reaches. */
function headOnSurface(P: N, n: N, lamp: N, aim: N, inner: N, level: N, row: Record<keyof HangLightData, N>, looks: PictureLooks, shadows = true): { irradiance: N; toward: N } {
  const L = lamp.xyz, v = L.sub(P), d = length(v), dir = v.div(d)
  const axis = dir.dot(aim.xyz.negate())
  const spot = smoothstep(aim.w, inner, axis)
  const incidence = n.dot(dir).max(0)
  const o = row.outer, u = row.shutter
  const dL = float(WALL_Z).sub(L.z), p = float(WALL_Z).sub(P.z)
  const reach = dL.sub(p).max(1e-3)
  const cutT = dL.sub(FRAME_FRONT_Z).div(reach)
  const cx = L.x.add(P.x.sub(L.x).mul(cutT)), cy = L.y.add(P.y.sub(L.y).mul(cutT))
  const wallT = dL.sub(ROOM.finish - WALL_FACE).div(reach)
  const wx = L.x.add(P.x.sub(L.x).mul(wallT)), wy = L.y.add(P.y.sub(L.y).mul(wallT))
  const cut = u.y.sub(u.x).greaterThan(.001).select(boxCover(cx, cy, u.x, u.y, u.z, u.w, float(.05)),
    footprint(wx, wy, o.x, o.y, o.z, o.w, looks))
  // the field past the cone: what a lens lets by, falling down the wall to the
  // boards under its own work and never past the next one, which is as far as
  // a point of the room reads its neighbours
  const field = smoothstep(looks.spillField, float(1), axis)
  const half = o.y.sub(o.x).mul(.5), aside = P.x.sub(o.x.add(o.y).mul(.5)).abs()
  const lateral = float(1).sub(smoothstep(half, half.add(.5), aside))
  // it falls: over the work's middle it gives way to the beam's own top
  const falling = float(1).sub(smoothstep(o.z.add(o.w).mul(.5), o.w.add(.2), P.y))
  let shape = spot.mul(cut).add(pow(field, 1.25).mul(looks.spill).mul(lateral).mul(falling))
  if (shadows) {
    // the halo round the frame in the wall's plane, gone before the next
    // work's middle, where a point stops reading this head
    const qx = wx.sub(o.x.add(o.y).mul(.5)).abs().sub(half), qy = wy.sub(o.z.add(o.w).mul(.5)).abs().sub(o.w.sub(o.z).mul(.5))
    const out = length(vec2(max(qx, 0), max(qy, 0)))
    const guard = float(1).sub(smoothstep(half.add(.1), half.add(.42), aside)).max(hangEnd(P.x))
    const share = u.y.sub(u.x).greaterThan(.001).select(looks.halo.mul(looks.haloCut), looks.halo)
    const halo = exp(out.div(looks.haloReach).negate()).mul(share).mul(guard).mul(smoothstep(-.2, .15, dL.sub(p)))
    shape = shape.add(halo.mul(float(1).sub(shape.min(1))))
  }
  let shadow: N = float(1)
  if (shadows) {
    const frame = boxVisibilityOf(P, L, o.x, o.y, o.z, o.w, FRAME_BACK_Z, FRAME_SHADOW_Z, looks.lampRadius)
    const frieze = boxVisibilityOf(P, L, float(ROOM.west - 1), float(ROOM.east + 1), float(ROOM.friezeFoot), float(ROOM.bulkheadFoot),
      ROOM.finish - WALL_FACE, ROOM.frieze - WALL_FACE, looks.lampRadius)
    shadow = mix(float(1), frame.mul(frieze), looks.engineTerms)
  }
  const falloff = pow(d.div(level).max(.2), float(3).mul(float(1).sub(looks.beamKeep))).clamp(.35, 4)
  const irradiance = lamp.w.mul(shape).mul(incidence).div(d.mul(d).max(.01)).mul(falloff).mul(shadow)
  return { irradiance, toward: dir }
}

/** A dielectric or metal lobe of one head, for a surface of this roughness. */
function lobe(n: N, V: N, toward: N, roughness: N, F0: N): N {
  const alpha = roughness.mul(roughness), a2 = alpha.mul(alpha)
  const H = normalize(toward.add(V))
  const NH = n.dot(H).max(0), NL = n.dot(toward).max(0), NV = n.dot(V).max(1e-4), VH = V.dot(H).max(0)
  const dd = NH.mul(NH).mul(a2.sub(1)).add(1)
  const D = a2.div(dd.mul(dd).mul(Math.PI).max(1e-6))
  const G = float(.5).div(NL.mul(sqrt(NV.mul(NV).mul(float(1).sub(a2)).add(a2)))
    .add(NV.mul(sqrt(NL.mul(NL).mul(float(1).sub(a2)).add(a2)))).max(1e-5))
  const F = F0.add(float(1).sub(F0).mul(pow(float(1).sub(VH), 5)))
  return F.mul(G).mul(D)
}

/** THE HANG'S HEADS ON A SURFACE OF THE ROOM, as the light it sends to the
 * eye: the two works beside the point, each with its heads, a diffuse share
 * and a lobe. A physical spot per head stands in the scene as data; the page
 * evaluates only the heads a point can see, because every surface lit by
 * all twenty eight at once cost the room seventy milliseconds a frame. */
export function hangSurfaceLight(albedo: N, roughness: N, metalness: N, looks: PictureLooks = PICTURE_LOOKS, shadows = true, normal: N = null): N {
  // the surface's own relief, in the world, where the material bends one
  const P = positionWorld, n = normal ?? TSL.normalWorld, V = normalize(cameraPosition.sub(P))
  const { own, other, apart } = slotsAt(P.x)
  const F0 = mix(vec3(.04, .04, .04), albedo, metalness)
  const diffuse = albedo.mul(float(1).sub(metalness)).div(Math.PI)
  let sum: N = vec3(0, 0, 0)
  for (const [slot, weight] of [[own, float(1)], [other, apart]] as const) {
    const row = hangRow(slot)
    for (const [lamp, aim, inner, level] of [[row.lampA, row.aimA, row.cone.x, row.cone.z], [row.lampB, row.aimB, row.cone.y, row.cone.w]] as const) {
      const head = headOnSurface(P, n, lamp, aim, inner, level, row, looks, shadows)
      sum = sum.add(diffuse.add(lobe(n, V, head.toward, roughness, F0)).mul(head.irradiance.mul(weight)))
    }
  }
  return sum.mul(looks.lampColour).mul(looks.lampGain)
}

/** ONE HEAD ON A POINT OF THE CANVAS: its irradiance there (candela, cone,
 * distance, incidence, its lens), cut by the sight edge of the frame the
 * canvas stands in, and the unit vector toward it. */
function headOnCanvas(P: N, lamp: N, aim: N, inner: N, level: N, a: Record<keyof HangLightData, N>, looks: PictureLooks): { irradiance: N; toward: N } {
  const L = lamp.xyz, v = L.sub(P), d = length(v), dir = v.div(d)
  const angleCos = dir.dot(aim.xyz.negate())
  const spot = smoothstep(aim.w, inner, angleCos)
  const incidence = dir.z.negate().max(0)
  // the sight edge at the slip's top, projected from the head onto the canvas
  const dL = float(WALL_Z).sub(L.z)
  const k = dL.sub(CANVAS_Z).div(dL.sub(SLIP_Z))
  const s = a.sight
  const x0 = L.x.add(s.x.sub(L.x).mul(k)), x1 = L.x.add(s.y.sub(L.x).mul(k))
  const y0 = L.y.add(s.z.sub(L.y).mul(k)), y1 = L.y.add(s.w.sub(L.y).mul(k))
  const w = looks.lampRadius.mul(SLIP_Z - CANVAS_Z).div(dL.sub(SLIP_Z)).add(.0008)
  const sight = mix(float(1), boxCover(P.x, P.y, x0, x1, y0, y1, w), looks.engineTerms)
  // a projector's cut, in the plane of the frame's face
  const cutT = dL.sub(FRAME_FRONT_Z).div(dL.sub(CANVAS_Z))
  const cx = L.x.add(P.x.sub(L.x).mul(cutT)), cy = L.y.add(P.y.sub(L.y).mul(cutT))
  const u = a.shutter, hasCut = u.y.sub(u.x).greaterThan(.001), o = a.outer
  const cut = hasCut.select(boxCover(cx, cy, u.x, u.y, u.z, u.w, float(.05)), poolMask(P, L, o.x, o.y, o.z, o.w, looks))
  const irradiance = lamp.w.mul(spot).mul(incidence).div(d.mul(d).max(.01)).mul(beam(d, level)).mul(sight).mul(cut)
  return { irradiance, toward: dir }
}

/** THE ROOM'S AIR between the eye and a point: the share of what the point
 * sends that the room's own haze has laid over by the time it arrives. */
export function roomHaze(P: N = positionWorld, looks: PictureLooks = PICTURE_LOOKS): N {
  const distance = length(cameraPosition.sub(P))
  return float(1).sub(exp(distance.div(looks.airMetres).negate())).mul(looks.air)
}

/** THE LIGHT ON A REPRODUCTION, as a multiplier on its raster: each of its
 * heads through the frame's sight edge, and the room's fill; the room's air
 * takes its share on the way to the eye. */
export function hangTone(looks: PictureLooks = PICTURE_LOOKS): N {
  const P = positionWorld, a = hangAttributes()
  const A = headOnCanvas(P, a.lampA, a.aimA, a.cone.x, a.cone.z, a, looks)
  const B = headOnCanvas(P, a.lampB, a.aimB, a.cone.y, a.cone.w, a, looks)
  const lamps = A.irradiance.add(B.irradiance).mul(looks.lampGain).div(Math.PI)
  const light = looks.lampColour.mul(lamps).add(looks.fill)
  return light.mul(float(1).sub(roomHaze(P, looks)))
}

/** THE VARNISH, as the film over a reproduction: each head's gentle sheen (a
 * dielectric lobe, never a mirror), the room's own bounce by Fresnel, and the
 * room's air laid over the plane. Drawn additively over the raster. */
export function varnishFilm(environment: ((direction: N, roughness: N) => N) | null, looks: PictureLooks = PICTURE_LOOKS): N {
  const P = positionWorld, a = hangAttributes()
  const V = normalize(cameraPosition.sub(P)), Nn = vec3(0, 0, -1)
  const NV = Nn.dot(V).max(1e-4)
  const r = looks.varnishRough, alpha = r.mul(r), a2 = alpha.mul(alpha)
  const F0 = .04
  const lobe = (toward: N, irradiance: N): N => {
    const H = normalize(toward.add(V))
    const NH = Nn.dot(H).max(0), NL = Nn.dot(toward).max(0), VH = V.dot(H).max(0)
    const dd = NH.mul(NH).mul(a2.sub(1)).add(1)
    const D = a2.div(dd.mul(dd).mul(Math.PI).max(1e-6))
    const G = float(.5).div(NL.mul(sqrt(NV.mul(NV).mul(float(1).sub(a2)).add(a2)))
      .add(NV.mul(sqrt(NL.mul(NL).mul(float(1).sub(a2)).add(a2)))).max(1e-5))
    const F = float(F0).add(float(1 - F0).mul(pow(float(1).sub(VH), 5)))
    // the irradiance already carries the incidence
    return irradiance.mul(F).mul(G).mul(D)
  }
  const A = headOnCanvas(P, a.lampA, a.aimA, a.cone.x, a.cone.z, a, looks)
  const B = headOnCanvas(P, a.lampB, a.aimB, a.cone.y, a.cone.w, a, looks)
  const sheen = looks.lampColour.mul(lobe(A.toward, A.irradiance).add(lobe(B.toward, B.irradiance))).mul(looks.lampGain)
  const fresnel = float(F0).add(float(1 - F0).mul(pow(float(1).sub(NV), 5))).mul(float(1).sub(r.mul(.5)))
  const reflected = V.negate().reflect(Nn)
  const env = environment ? environment(reflected, r) : looks.fill.mul(.8)
  const film = sheen.add(env.mul(fresnel).mul(looks.varnishEnv)).mul(looks.varnish)
  const haze = roomHaze(P, looks)
  return film.mul(float(1).sub(haze)).add(looks.airColour.mul(haze))
}

/** THE ROOM'S AIR ON A LIT SURFACE: its output mixed toward the air colour. */
export function withRoomAir(output: N, looks: PictureLooks = PICTURE_LOOKS): N {
  const haze = roomHaze(positionWorld, looks)
  return TSL.vec4(mix(output.rgb, looks.airColour, haze), output.a)
}
