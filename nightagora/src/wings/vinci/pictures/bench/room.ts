/** Exhibition architecture for the picture bench, in metres. No historical
 * room is claimed. Library reference plates are never sampled or displayed.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh,
  MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../../stack'
import type { MaterialSet } from '../../../../stack/materials'
import { NORTH_WINDOW_LIGHT as APERTURE, apertureFacing, underAperture } from '../aperture'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { abs, attribute, cameraPosition, clamp, dot, float, floor, length, max, min, mix,
  mx_noise_float, normalGeometry, positionWorld, pow, smoothstep, uv, vec3 } = TSL as unknown as Record<string, N>
const ID = 'vinci/pictures/bench-room'
type Point = [number, number, number]
interface Batch { p: number[]; n: number[]; uv: number[]; tone: number[] }
const batch = (): Batch => ({ p: [], n: [], uv: [], tone: [] })

/** THE NORTH LIGHT.
 *
 * The declaration, the arithmetic and the compression all live with the hang
 * (`wings/vinci/pictures/aperture.ts`), because the frames on this wall take
 * the same opening the wall takes and one room cannot have two windows in it.
 * The room re-exports the record it was built around.
 */
export const NORTH_WINDOW_LIGHT = APERTURE

/** The sky is cool; what returns from the oak floor at the far end is not. */
function underNorthLight(m: MeshStandardNodeMaterial): void {
  underAperture(m, APERTURE)
}

export async function prepareRoomMaterials(stack: Stack): Promise<void> {
  await Promise.all(['gold-leaf', 'oak-beams', 'canvas-raw', 'plaster-lime-aged',
    'oak-planks-worn', 'limestone-pale'].map(name => stack.materials.load(name)))
}

function quad(b: Batch, points: readonly Point[], normal: Point, tone = 1,
  mapping?: (p: Point) => [number, number]): void {
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const p = points[i]!
    const tex = mapping?.(p) ?? (Math.abs(normal[1]) > .7 ? [p[2], p[0]]
      : Math.abs(normal[0]) > .7 ? [p[2], p[1]] : [p[0], p[1]])
    b.p.push(...p)
    b.n.push(...normal)
    b.uv.push(...tex)
    b.tone.push(tone)
  }
}

function box(b: Batch, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone = 1): void {
  quad(b, [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], [0,0,1], tone)
  quad(b, [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]], [0,0,-1], tone)
  quad(b, [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]], [1,0,0], tone)
  quad(b, [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]], [-1,0,0], tone)
  quad(b, [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], [0,1,0], tone)
  quad(b, [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], [0,-1,0], tone)
}

/** A 1.5 mm bevel is a surface normal and silhouette, not a dark painted line.
 * The 2.4 mm gap between boards exposes the continuous darker bed beneath. */
function board(b: Batch, x0: number, x1: number, z0: number, z1: number, tone: number, seed: number): void {
  const bevel = .0015
  const top: Point[] = [[x0+bevel,0,z0+bevel],[x0+bevel,0,z1-bevel],
    [x1-bevel,0,z1-bevel],[x1-bevel,0,z0+bevel]]
  const outer: Point[] = [[x0,-bevel,z0],[x0,-bevel,z1],[x1,-bevel,z1],[x1,-bevel,z0]]
  // The plate is laid at 1.7 courses to the metre: a board's own figure, not
  // one photograph spread over a metre of it.
  const mapping = (p: Point): [number, number] => [(p[2] + seed * 3) * 1.7, p[0] * 1.7]
  quad(b, top, [0,1,0], tone, mapping)
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    const a = top[i]!, c = top[j]!, d = outer[j]!, e = outer[i]!
    const outward: Point = i === 0 ? [-1,0,0] : i === 1 ? [0,0,1] : i === 2 ? [1,0,0] : [0,0,-1]
    const k = Math.SQRT1_2
    quad(b, [a,e,d,c], [outward[0]*k,k,outward[2]*k], tone, mapping)
    quad(b, [e,[e[0],-.026,e[2]],[d[0],-.026,d[2]],d], outward, tone*.82, mapping)
  }
}

/** THE PLINTH'S SECTION, across its run, in metres.
 *
 * A dark stone band with a tonal top is a painted bar. What a visitor reads
 * from six metres is the ARRIS: a bullnose turns the stone through ninety
 * degrees, so a single line of it faces the window straight on and the rest
 * falls away. The setback at the floor stays, so the stack's occlusion still
 * collects under the stone.
 */
const PLINTH_SECTION: ReadonlyArray<{ y: number; d: number; smooth?: boolean }> = (() => {
  const front = .046, top = .112, radius = .024, foot = .005
  const points = [{ y: foot, d: .003 }, { y: foot, d: front },
    { y: top - radius, d: front, smooth: true }]
  for (let i = 1; i <= 6; i++) {
    const a = i / 6 * Math.PI / 2
    points.push({ y: top - radius + Math.sin(a) * radius, d: front - radius + Math.cos(a) * radius, smooth: i < 6 })
  }
  points.push({ y: top, d: .001 })
  return points
})()

/** Sweep that section along the room: `x` for the hanging wall's own run,
 * `z` for the return down the window wall. `d` is measured out of the wall. */
function plinthRun(b: Batch, from: number, to: number, axis: 'x' | 'z', base = 0, tone = 1): void {
  const P = PLINTH_SECTION
  const faceNormal = (i: number): [number, number] => {
    const a = P[i]!, c = P[i + 1]!
    const dy = c.y - a.y, dd = c.d - a.d
    const size = Math.hypot(dy, dd)
    return [-dd / size, dy / size]
  }
  const at = (i: number, endpoint: 0 | 1): [number, number] => {
    const own = faceNormal(i)
    const point = endpoint === 0 ? P[i]! : P[i + 1]!
    if (!point.smooth) return own
    const other = faceNormal(endpoint === 0 ? i - 1 : i + 1)
    const y = own[0] + other[0], d = own[1] + other[1]
    const size = Math.hypot(y, d)
    return [y / size, d / size]
  }
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i]!, c = P[i + 1]!
    const na = at(i, 0), nc = at(i, 1)
    // One quad per section face, its two edges carrying the section's own
    // normals, so the roll reads as a turn and the flats stay crisp.
    const place = (run: number, s: { y: number; d: number }): Point =>
      axis === 'x' ? [run, s.y, base + s.d] : [base + s.d, s.y, run]
    const normal = (n: [number, number]): Point =>
      axis === 'x' ? [0, n[0], n[1]] : [n[1], n[0], 0]
    const corners: Point[] = [place(from, a), place(to, a), place(to, c), place(from, c)]
    const normals = [normal(na), normal(na), normal(nc), normal(nc)]
    const mapping = (p: Point): [number, number] => [axis === 'x' ? p[0] : p[2], p[1]]
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = corners[k]!
      b.p.push(...p)
      b.n.push(...normals[k]!)
      b.uv.push(...mapping(p))
      b.tone.push(tone)
    }
  }
}

function geometry(b: Batch): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(b.p, 3))
  g.setAttribute('normal', new Float32BufferAttribute(b.n, 3))
  g.setAttribute('uv', new Float32BufferAttribute(b.uv, 2))
  g.setAttribute('tone', new Float32BufferAttribute(b.tone, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

function tint(m: MeshStandardNodeMaterial, set: MaterialSet, colour: string): void {
  const c = new Color(colour)
  m.colorNode = m.colorNode!.mul(vec3(c.r / set.albedo.r, c.g / set.albedo.g, c.b / set.albedo.b))
    .mul(attribute('tone', 'float'))
}

export function buildPictureRoom(stack: Stack, extent: number, options: { height?: number; depth?: number } = {}): { group: Group; dispose(): void } {
  if (!Number.isFinite(extent) || extent < 0) throw new Error('Invalid picture-room extent')
  const group = new Group()
  group.name = 'vinci/pictures/north-window-bench'
  group.userData['manifestId'] = ID
  const left = -1.2, right = Math.max(2.8, extent + 1.2), depth = options.depth ?? 12, height = options.height ?? 4.4
  if (!Number.isFinite(depth) || depth < 4 || !Number.isFinite(height) || height < 4.4) throw new Error('Invalid dressed room dimensions')
  // A life-size mural is viewed from much farther away. Retain architectural
  // form there while keeping every material feature in its metre coordinates.
  const reach = depth > 12 ? 4 : 1
  const plasterSet = stack.materials.sync('plaster-lime-aged')
  const oakSet = stack.materials.sync('oak-planks-worn')
  const timberSet = stack.materials.sync('oak-beams')
  const stoneSet = stack.materials.sync('limestone-pale')
  const plaster = plasterSet.material({ uv: uv(), scales: [1.6,.115,.0035], macro: .145,
    mid: .19, micro: .34, maps: .25, fade: [7*reach,30*reach], count: 3 })
  tint(plaster, plasterSet, '#d6d0be')
  plaster.roughnessNode = clamp((plaster.roughnessNode as N).add(.23), .71, .96)
  // Oak reads as GRAIN, not as patches. The library's own plate is the
  // material and stays at full weight; what made the floor read as stains was
  // its SIZE, a whole plate stretched over a metre of board. The procedural
  // macro is held down and the plate is laid at its finer pitch below.
  const oak = oakSet.material({ uv: uv(), scales: [1.5,.065,.0022], macro: .085,
    mid: .30, micro: .50, maps: .60, fade: [3*reach,16*reach], count: 3 })
  tint(oak, oakSet, '#a88a60')
  oak.roughnessNode = clamp((oak.roughnessNode as N).add(.08), .56, .83)
  const stone = stoneSet.material({ uv: uv(), scales: [1.8,.18,.006], macro: .20,
    mid: .28, micro: .35, fade: [4*reach,18*reach], count: 3 })
  tint(stone, stoneSet, '#c2b9a2')
  const plinth = stoneSet.material({ uv: uv(), scales: [1.2,.16,.014], macro: .25,
    mid: .18, micro: .45, maps: .52, fade: [7*reach,30*reach], count: 3 })
  tint(plinth, stoneSet, '#414644')
  plinth.roughnessNode = clamp((plinth.roughnessNode as N).add(.12), .65, .90)
  // A run of dark stone is cut in lengths and no two blocks match. The drift
  // reads at the wall's distance; the joints read when a visitor comes close.
  {
    const run = positionWorld.x.div(1.18).add(.37)
    const within = run.sub(floor(run))
    const joint = float(1).sub(smoothstep(.0026, .0105, min(within, float(1).sub(within))))
    const block = mx_noise_float(vec3(floor(run).mul(.41), 2.7, .9))
    const drift = mx_noise_float(vec3(positionWorld.x.mul(.62), positionWorld.y.mul(2.4), 5.3))
    plinth.colorNode = (plinth.colorNode as N)
      .mul(float(1).add(block.mul(.24)).add(drift.mul(.16)).sub(joint.mul(.42)))
    plinth.roughnessNode = clamp((plinth.roughnessNode as N).add(joint.mul(.07)), .65, .94)
    // THE THIRD SCALE. Joints and block tone are the first two. The finest thing a dark limestone shows from six metres is not its
    // tooth, which averages to grey at this distance, but the grain that
    // survives: patches of four and twelve centimetres, the rubbed sheen of
    // the top where hands and cloths pass, and the scuffed foot the mop
    // reaches. Anything under two centimetres is kept for the close view.
    // These weights are large because they are linear and the stone is dark:
    // a tenth here is three levels once the frame is encoded.
    const coarse = mx_noise_float(positionWorld.mul(8.4).add(vec3(11.3, 2.1, 7.7)))
    const fine = mx_noise_float(positionWorld.mul(24.5))
    const grain = coarse.mul(.6).add(fine.mul(.4))
    const rubbed = smoothstep(.078, .112, positionWorld.y)
      .mul(float(.62).add(mx_noise_float(vec3(positionWorld.x.mul(2.6), 3.1, .4)).mul(.38)))
    // A bullnose is where every hand and every cloth passes, so the arris is
    // the one part of this stone that is polished. Low roughness there is what
    // turns the roll into a line of window rather than a painted edge.
    const arris = smoothstep(.086, .108, positionWorld.y)
    const scuffLine = float(.030).add(mx_noise_float(vec3(positionWorld.x.mul(3.1), 1.7, 2.2)).mul(.013))
    const scuff = float(1).sub(smoothstep(float(.006), scuffLine, positionWorld.y))
      .mul(float(.55).add(mx_noise_float(vec3(positionWorld.x.mul(9.4), .9, 5.1)).mul(.45)))
    plinth.colorNode = (plinth.colorNode as N)
      .mul(float(1).add(grain.mul(.42)).add(rubbed.mul(.58)).sub(scuff.mul(.40)))
    plinth.roughnessNode = clamp((plinth.roughnessNode as N)
      .add(grain.mul(.07)).sub(rubbed.mul(.2)).sub(arris.mul(.30)).add(scuff.mul(.07)), .17, .96)
    // The plinth stands in the hanging wall's own plane, so the window models
    // its turned faces the way it models a moulding's: the roll reads, the
    // front face keeps the wall's value.
    plinth.colorNode = (plinth.colorNode as N).mul(apertureFacing(APERTURE))
  }
  // THE FLOAT MARKS. Lime plaster laid by hand keeps the sweep of the float:
  // strokes about a third of a metre long and a hand wide, crossed by the
  // second pass. They are a sheen before they are a tone, so most of this
  // lands in roughness and only a little in value.
  {
    const sweep = mx_noise_float(vec3(positionWorld.x.mul(2.2).add(positionWorld.y.mul(.75)),
      positionWorld.y.mul(8.1), 4.2))
    const cross = mx_noise_float(vec3(positionWorld.x.mul(6.4),
      positionWorld.y.mul(1.9).sub(positionWorld.x.mul(.6)), 8.7))
    const marks = sweep.mul(.56).add(cross.mul(.44))
    const skim = mx_noise_float(vec3(positionWorld.x.mul(.85), positionWorld.y.mul(.62), 1.9))
    // What the wall owes the eye at arm's length: the pinholes the float
    // leaves when the lime takes air, and the hairline shrinkage the skim
    // coat keeps. Both are under a pixel from six metres and both are the
    // difference between plaster and paint at one metre.
    // Both are under a pixel past six metres, so they are faded out there:
    // a sub-pixel feature does not survive a moving camera, it shimmers.
    const near = float(1).sub(smoothstep(3.2, 6.4, length(positionWorld.sub(cameraPosition))))
    const pits = mx_noise_float(positionWorld.mul(310))
    const pinholes = smoothstep(.46, .62, pits).mul(.9).mul(near)
    // Shrinkage in a skim coat runs in broken lines, not in closed rings.
    // The zero set of one noise field IS a ring, so the ring is cut: a second
    // slow field decides where the coat let go at all, and a fast one breaks
    // what is left into segments the length of a finger.
    const web = abs(mx_noise_float(positionWorld.mul(26).add(vec3(4.1, .7, 9.2))))
    const where = smoothstep(-.08, .38, mx_noise_float(vec3(positionWorld.x.mul(1.35),
      positionWorld.y.mul(1.05), 6.4)))
    const broken = smoothstep(.04, .44, mx_noise_float(vec3(positionWorld.x.mul(21),
      positionWorld.y.mul(23), 2.8)))
    const hairline = float(1).sub(smoothstep(.0, .038, web)).mul(where).mul(broken).mul(near)
    plaster.colorNode = (plaster.colorNode as N)
      .mul(float(1).add(marks.mul(.15)).add(skim.mul(.065)))
      .mul(float(1).sub(pinholes.mul(.16)).sub(hairline.mul(.085)))
    plaster.roughnessNode = clamp((plaster.roughnessNode as N)
      .add(marks.mul(.11)).add(skim.mul(.04)).add(pinholes.mul(.12)), .62, .98)
  }
  const timber = timberSet.material({ uv: uv(), scales: [.7,.025,.002], macro: .22,
    mid: .20, micro: .35, maps: .7, fade: [3,14], count: 3 })
  tint(timber, timberSet, '#514639')
  const bed = new MeshStandardNodeMaterial({ color: '#332b20', roughness: .94 })
  const bedColour = bed.color
  bed.colorNode = vec3(bedColour.r, bedColour.g, bedColour.b)
  stack.detail(bed, timberSet, { uv: uv(), scales: [.65,.065,.004], macro: .18,
    mid: .1, micro: .35, maps: .25, fade: [3,16], count: 3 })
  const pane = new MeshStandardNodeMaterial({ color: '#dce4e2', roughness: .92,
    emissive: '#d7e4e8', emissiveIntensity: .30 })
  // Frosted glazing carries restrained glass texture at 0.8 m, 6 cm and
  // 2 mm. It transmits the key; it is not itself a second lighting rig.
  const density = float(1).sub(smoothstep(3,12,length(positionWorld.sub(cameraPosition))))
  const broad = mx_noise_float(positionWorld.mul(1.25)).mul(.008).mul(density).add(1)
  const cloud = mx_noise_float(positionWorld.mul(16)).mul(.005).mul(density).add(1)
  const tooth = mx_noise_float(positionWorld.mul(500)).mul(.008).mul(density)
  const pc = pane.color
  pane.colorNode = vec3(pc.r,pc.g,pc.b).mul(broad).mul(cloud)
  pane.roughnessNode = clamp(mix(.90,.96,attribute('tone','float')).add(tooth), .88, .98)

  // WHAT THE ROOM DOES TO ITS OWN LIGHT. Three terms, all geometry: the
  // boards at the foot of a wall see half a sky, the top of a wall sees less
  // of the window and more of the ceiling, and the metre above the skirting
  // takes a warm return off the oak.
  {
    const atWall = float(1).sub(smoothstep(0, .95, positionWorld.z))
    const atSide = float(1).sub(smoothstep(0, .80, positionWorld.x.sub(left)))
    const footing = max(atWall, atSide).mul(.20)
    // A gallery floor is walked down the middle and not at its edges. Where
    // feet pass the finish is worn THIN, so the oak there is more matt and a
    // little greyer; at the edges the coat is still full, which is darker and
    // holds a sheen. The board is also cupped a little across its width, and
    // the two read at different sizes.
    const lane = float(1).sub(smoothstep(.9, 3.4, abs(positionWorld.z.sub(2.4))))
      .mul(float(.72).add(mx_noise_float(vec3(positionWorld.x.mul(.42), 2.2, positionWorld.z.mul(.3))).mul(.28)))
    const cup = abs(positionWorld.x.div(.1875).sub(floor(positionWorld.x.div(.1875))).sub(.5)).mul(2)
    // The third scale, and the one only a close camera earns: the traffic
    // leaves fine drags along the way it walks, never across it.
    const closeBy = float(1).sub(smoothstep(2.2, 5.5, length(positionWorld.sub(cameraPosition))))
    const drag = mx_noise_float(vec3(positionWorld.x.mul(180), 4.7, positionWorld.z.mul(9)))
      .mul(lane).mul(closeBy)
    oak.colorNode = (oak.colorNode as N).mul(float(1).sub(footing))
      .mul(float(1).add(lane.mul(.085)).sub(cup.mul(.045)).add(drag.mul(.035)))
    oak.roughnessNode = clamp((oak.roughnessNode as N)
      .add(lane.mul(.14)).sub(cup.mul(.06)).add(drag.mul(.10)), .42, .90)
    // The glazing stops at 3.2 m and the ceiling is at six. The band above
    // the hang sees less and less of the opening and more of the ceiling, so
    // it carries the room's own falloff rather than one plaster value.
    const high = smoothstep(2.2, 5.4, positionWorld.y).mul(.22)
    const bounce = float(1).sub(smoothstep(.14, 1.05, positionWorld.y)).mul(.07)
    // A wall this high is plastered in two lifts off a scaffold. The line
    // where the day's work stopped wanders, takes the float differently and
    // is the one event in the metres above the pictures.
    const liftAt = float(2.36).add(mx_noise_float(vec3(positionWorld.x.mul(.52), 7.3, 1.1)).mul(.04))
    const lift = float(1).sub(smoothstep(float(0), float(.019), abs(positionWorld.y.sub(liftAt))))
    const upper = smoothstep(liftAt.sub(.03), liftAt.add(.03), positionWorld.y)
    plaster.colorNode = (plaster.colorNode as N).mul(float(1).sub(high))
      .mul(float(1).sub(lift.mul(.05)).sub(upper.mul(.014)))
      .mul(mix(vec3(1, 1, 1), vec3(1.03, 1.005, .965), bounce.mul(14).clamp(0, 1)))
    plaster.roughnessNode = clamp((plaster.roughnessNode as N).add(lift.mul(.06)), .62, .98)
  }
  // The dressed members turn out of the wall's plane the way a moulding does:
  // a reveal, a sill, a cornice, the window's timber and the plaster that
  // returns down the window wall take the room's run and then their own
  // facing. The hanging wall's own facing is exactly one, so the wall the
  // pictures are on does not move.
  for (const m of [stone, timber, plaster]) m.colorNode = (m.colorNode as N).mul(apertureFacing(APERTURE))
  for (const m of [plaster,oak,stone,plinth,timber,bed]) underNorthLight(m)
  const materials = [plaster,oak,stone,plinth,timber,bed,pane]
  const names = ['plaster','oak-boards','limestone-reveals','graphite-plinth','window-timber','floor-joints','north-glazing']
  const batches = materials.map(() => batch())
  const [wallB,oakB,stoneB,plinthB,timberB,bedB,paneB] = batches as [Batch,Batch,Batch,Batch,Batch,Batch,Batch]
  // The hanging wall's visible face is exactly z=0. The measured objects are
  // entirely in front of it; no backing plane intrudes into their apertures.
  box(wallB,left,right,0,height,-.26,0)
  // Four solid masses leave a genuine opening through the side wall.
  box(wallB,left-.26,left,0,.5,0,depth)
  box(wallB,left-.26,left,3.2,height,0,depth)
  box(wallB,left-.26,left,.5,3.2,0,.3)
  box(wallB,left-.26,left,.5,3.2,3,depth)
  // Top rail and a shallow cornice catch the shared light through geometry.
  box(stoneB,left,right,height-.45,height-.36,0,.032)
  box(stoneB,left,right,height-.22,height-.12,-.01,.095)
  box(stoneB,left,right,height-.12,height-.07,-.01,.12)
  // Window lining and projecting sill are dressed limestone.
  box(stoneB,left-.26,left+.075,.45,.53,.235,3.065)
  box(stoneB,left-.26,left+.025,3.18,3.25,.25,3.05)
  box(stoneB,left-.26,left+.035,.5,3.2,.245,.315)
  box(stoneB,left-.26,left+.035,.5,3.2,2.985,3.055)
  // Recessed glazing, two bays, and a restrained transom. Glazing geometry
  // does not cast shadows; the solid mullion and reveals cast the real ones.
  quad(paneB,[[left-.18,.53,2.985],[left-.18,.53,.315],[left-.18,3.18,.315],[left-.18,3.18,2.985]], [1,0,0])
  for (const z of [.345,1.65,2.955]) box(timberB,left-.19,left-.10,.54,3.16,z-.022,z+.022)
  for (const y of [.555,1.84,3.145]) box(timberB,left-.19,left-.10,y-.021,y+.021,.335,2.965)
  // The plinth is one swept section: a setback at the floor, a front face and
  // a bullnose top that turns the stone into the window. It returns down the
  // window wall on the same section.
  plinthRun(plinthB,left,right,'x')
  plinthRun(plinthB,0,depth,'z',left)
  box(bedB,left,right,-.031,-.026,0,depth)
  const width = .1875, gap = .0024
  let plankCount = 0
  for (let row = 0; left + row * width < right; row++) {
    const x0 = left + row * width + gap/2
    const x1 = Math.min(right, left + (row+1)*width) - gap/2
    if (x1-x0 < .01) continue
    let from = -((row % 3) * .89 + (row % 5) * .073)
    let member = 0
    while (from < depth) {
      const span = 2.5 + ((row*7+member*11)%9)*.137
      const z0 = Math.max(0,from)+gap/2
      const z1 = Math.min(depth,from+span)-gap/2
      const seed = ((row*71+member*37)%101)/101
      if (z1-z0 > .01) {
        board(oakB,x0,x1,z0,z1,.925+seed*.14,seed)
        plankCount++
      }
      from += span
      member++
    }
  }
  group.userData['room'] = { extent_m: extent, height_m: height, floorDepth_m: depth, sideWallX_m: left,
    boardWidth_m: width, boardGap_m: gap, boardCount: plankCount,
    window: { y: [.5,3.2], z: [.3,3], revealDepth_m: .26 } }
  const geometries = batches.map(geometry)
  for (let i=0;i<materials.length;i++) {
    const material = materials[i]!
    material.name = `vinci/pictures/room/${names[i]}`
    material.userData['manifestId'] = ID
    const mesh = new Mesh(geometries[i]!,material)
    mesh.name = material.name
    // No solar beam enters a north window, so no room mass projects one.
    // The frames keep their own cast shadow; the wall keeps receiving it.
    mesh.castShadow = false
    mesh.receiveShadow = i !== 6
    mesh.userData['manifestId'] = ID
    group.add(mesh)
  }
  let live = true
  return { group, dispose() {
    if (!live) return
    live = false
    group.removeFromParent()
    for (const g of geometries) g.dispose()
    for (const m of materials) m.dispose()
    group.clear()
  } }
}
