/* WHAT STANDS ON THE GROUND — steps, a fence, a gate.

   The verdicts asked for three things this file answers. "Give the doorway a
   leaf and a threshold, a hollow worn into the doorstep." "The only fence in
   the collection is modern wire." And, on a garden that had nothing between
   the visitor and the field: "no hedge, no fence, no field boundary."

   The wear is the part worth arguing for. A stone step that is a box is a box
   at every distance; a stone step with a hollow rubbed into its middle is
   five hundred years old, and it costs eight vertices. Nobody looking at it
   will say the word wear, and everybody will believe the building. */

import {
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three/webgpu'
import {
  Bench,
  RAD,
  at,
  between,
  body,
  chamfered,
  hand,
  metreBox,
  metreCylinder,
  metreExtrude,
  seal,
  shiftUV,
  weld,
  type Part,
} from './common'
import { hollow } from './openings'

const STONE = 'stone-tuffeau'
const OAK = 'oak-beams'
const PLANK = 'oak-planks-worn'
const IRON = 'iron-forged'

/* ── steps ─────────────────────────────────────────────────────────────── */

export interface StepsOptions {
  width: number
  count: number
  /** the height of one step. A worn stone stair reads 0.15 to 0.19. */
  rise?: number
  /** the depth of one tread */
  going?: number
  /** how deep the hollow the traffic rubbed in, in metres */
  wear?: number
  /** low walls at the sides */
  cheeks?: boolean
  set?: string
  seed?: number
}

/**
 * A flight of stone steps, worn. It climbs in +y and out in -z from its own
 * origin, which sits at the middle of the BOTTOM step's front edge, so a wing
 * places it at the point a visitor's foot first lands.
 */
export function stepsPart(bench: Bench, o: StepsOptions): Part {
  const w = o.width
  const n = o.count
  const rise = o.rise ?? 0.165
  const going = o.going ?? 0.32
  const wear = o.wear ?? 0.02
  const setName = o.set ?? STONE
  const r = hand(o.seed ?? 13)
  const group = new Group()
  group.name = `steps x${n}`
  const stone = bench.surface(setName, { roughFloor: 0.7 })

  const treads: BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    /* the tread runs back under the one above it, and stands 3 cm proud of
       the riser under it: the nosing is the line a low sun draws the whole
       flight with */
    const depth = going + 0.06
    const slab = metreBox(w, rise, depth, 16, 1, 7)
    /* every step settled its own way, and the top one is walked hardest at
       its middle while the bottom one is walked everywhere */
    hollow(slab, w, depth, wear * between(r, 0.6, 1.25))
    at(
      slab,
      [between(r, -0.004, 0.004), rise * (i + 0.5), -going * i - depth / 2 + 0.03],
      [between(r, -0.004, 0.004), between(r, -0.003, 0.003), between(r, -0.004, 0.004)]
    )
    treads.push(slab)
  }
  group.add(body(weld(treads), stone, 'treads'))

  if (o.cheeks) {
    const cheeks: BufferGeometry[] = []
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < n; i++) {
        cheeks.push(
          at(metreBox(0.22, rise * (n - i) + 0.24, going), [
            side * (w / 2 + 0.11),
            (rise * (n - i) + 0.24) / 2 + rise * i,
            -going * (i + 0.5),
          ])
        )
      }
    }
    group.add(body(weld(cheeks), stone, 'cheeks'))
  }

  return seal(group, 'steps', `${n} worn treads, ${w} m wide`, [setName])
}

/* ── the fence ─────────────────────────────────────────────────────────── */

export interface FenceOptions {
  length: number
  height?: number
  /** what kind of boundary. `wattle` is the woven hazel a 1517 garden has;
      `paling` is cleft oak; `post-and-rail` is the field fence. */
  kind?: 'wattle' | 'paling' | 'post-and-rail'
  /** metres between posts */
  bay?: number
  sets?: { post?: string; rail?: string; weave?: string }
  seed?: number
  lod?: 1 | 2 | 3
}

/**
 * A fence, running along x from its own middle, standing on y = 0. Three
 * kinds, and the one to reach for in a garden of 1517 is the wattle: hazel
 * rods woven through cleft stakes, which is what enclosed a physic garden and
 * what no CC0 collection carries.
 */
export function fencePart(bench: Bench, o: FenceOptions): Part {
  const L = o.length
  const kind = o.kind ?? 'wattle'
  const H = o.height ?? (kind === 'wattle' ? 1.05 : kind === 'paling' ? 1.25 : 1.15)
  const bay = o.bay ?? (kind === 'wattle' ? 0.42 : 1.9)
  const lod = o.lod ?? bench.detail()
  const sets = o.sets ?? {}
  const r = hand(o.seed ?? 29)
  const group = new Group()
  group.name = `fence ${L} m`
  const postSet = sets.post ?? OAK
  const post = bench.surface(postSet, { roughFloor: 0.78 })
  const used = [postSet]

  const bays = Math.max(1, Math.round(L / bay))
  const step = L / bays
  const stakes: BufferGeometry[] = []
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + i * step
    const thick = kind === 'wattle' ? between(r, 0.035, 0.052) : between(r, 0.09, 0.115)
    const tall = H + between(r, -0.04, 0.09)
    stakes.push(
      at(metreCylinder(thick * 0.86, thick, tall, kind === 'wattle' ? 6 : 8), [
        x,
        tall / 2,
        between(r, -0.012, 0.012),
      ], [between(r, -0.02, 0.02), between(r, 0, 6.2), between(r, -0.025, 0.025)])
    )
  }
  group.add(body(weld(stakes), post, 'stakes'))

  if (kind === 'wattle') {
    /* THE WEAVE. Each rod runs the whole length, passing in front of one
       stake and behind the next, and the next rod starts on the other side.
       That alternation is the entire read: a row of straight rods is a
       hurdle nobody wove. */
    const weaveSet = sets.weave ?? 'rope'
    used.push(weaveSet)
    const hazel = bench.surface(weaveSet, { roughFloor: 0.78, value: 0.92 })
    const rods: BufferGeometry[] = []
    /* WOVEN CLOSE. A hurdle's rods touch: they are driven down onto the one
       below so the panel is a wall and not a lattice. Laid at a hand's width
       apart it reads as a garden trellis, which is a different object and a
       different century. */
    const rod = 0.016
    const courses = Math.max(5, Math.round(H / (rod * (lod >= 3 ? 2.1 : lod === 2 ? 2.6 : 4))))
    const swing = Math.max(0.055, 0.055 + rod)
    for (let c = 0; c < courses; c++) {
      const y = rod + (H - rod * 2) * (c / Math.max(1, courses - 1))
      const phase = c % 2 ? 1 : -1
      const points: Vector3[] = []
      for (let i = 0; i <= bays; i++) {
        const x = -L / 2 + i * step
        const side = i % 2 ? phase : -phase
        points.push(new Vector3(x, y + between(r, -0.006, 0.006), side * swing))
      }
      if (points.length < 2) continue
      const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.5)
      const tube = new TubeGeometry(
        curve,
        Math.max(10, bays * (lod >= 3 ? 5 : 3)),
        between(r, rod * 0.82, rod * 1.1),
        lod >= 3 ? 6 : 4,
        false
      )
      rods.push(tube)
    }
    group.add(body(weld(rods), hazel, 'woven rods'))
  } else {
    const railSet = sets.rail ?? PLANK
    used.push(railSet)
    const oak = bench.surface(railSet, { roughFloor: 0.74 })
    const rails: BufferGeometry[] = []
    const heights = kind === 'paling' ? [H * 0.26, H * 0.76] : [H * 0.3, H * 0.6, H * 0.9]
    for (const y of heights) {
      rails.push(at(metreBox(L, 0.075, 0.045), [0, y, 0]))
    }
    group.add(body(weld(rails), oak, 'rails'))
    if (kind === 'paling') {
      /* cleft pales, each one its own width, each one pointed at the head so
         the rain runs off it. Instanced: two hundred of them are one draw. */
      const pales = Math.max(4, Math.round(L / 0.13))
      const geometry = metreExtrude(paleProfile(0.1, H * 0.96), 0.022)
      const mesh = new InstancedMesh(geometry, oak, pales)
      const m = new Matrix4()
      for (let i = 0; i < pales; i++) {
        m.compose(
          new Vector3(-L / 2 + ((i + 0.5) * L) / pales, 0, 0.04),
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), between(r, -0.02, 0.02)),
          new Vector3(between(r, 0.82, 1.14), between(r, 0.94, 1.04), 1)
        )
        mesh.setMatrixAt(i, m)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = 'pales'
      group.add(mesh)
    }
  }

  return seal(group, 'fence', `${L} m of ${kind} fence, ${H} m high`, used)
}

/** a cleft pale: square below, pointed at the head so the rain runs off it */
function paleProfile(w: number, h: number): Shape {
  const shape = new Shape()
  shape.moveTo(-w / 2, 0)
  shape.lineTo(w / 2, 0)
  shape.lineTo(w / 2, h - w * 0.8)
  shape.lineTo(0, h)
  shape.lineTo(-w / 2, h - w * 0.8)
  shape.closePath()
  return shape
}

/* ── the gate ──────────────────────────────────────────────────────────── */

export interface GateOptions {
  width: number
  height?: number
  kind?: 'field' | 'boarded'
  /** how far it stands open, in degrees */
  open?: number
  /** which side it is hung on */
  hinge?: 'left' | 'right'
  /** the posts it hangs between */
  posts?: boolean
  sets?: { timber?: string; iron?: string }
  seed?: number
}

/**
 * A gate. `field` is the five-bar with its diagonal brace, which is the one
 * piece of joinery whose whole shape is a load path: the brace runs from the
 * bottom of the head post to the top of the harr, and a gate braced the other
 * way sags in a year. `boarded` is the yard gate, planks on ledges with
 * straps. Its origin is the HARR, the post it turns on, so an angle is one
 * number and nothing has to be moved to swing it.
 */
export function gatePart(bench: Bench, o: GateOptions): Part {
  const w = o.width
  const H = o.height ?? 1.25
  const kind = o.kind ?? 'field'
  const hinge = o.hinge === 'right' ? 1 : -1
  const r = hand(o.seed ?? 47)
  const sets = o.sets ?? {}
  const timberSet = sets.timber ?? PLANK
  const ironSet = sets.iron ?? IRON
  const oak = bench.surface(timberSet, { roughFloor: 0.74 })
  const iron = bench.surface(ironSet, { roughFloor: 0.5 })
  const group = new Group()
  group.name = `gate ${w} m`

  const leaf = new Group()
  leaf.name = 'the leaf'
  const timber: BufferGeometry[] = []
  const irons: BufferGeometry[] = []

  /* the two uprights: the harr it hangs on, heavier, and the head it shuts
     against */
  timber.push(at(metreBox(0.11, H, 0.075), [0.055, H / 2, 0]))
  timber.push(at(metreBox(0.085, H * 0.86, 0.07), [w - 0.043, (H * 0.86) / 2, 0]))

  if (kind === 'field') {
    for (let i = 0; i < 5; i++) {
      const y = 0.14 + (i * (H - 0.24)) / 4
      timber.push(at(metreBox(w, 0.075, 0.045), [w / 2, y, 0.002]))
    }
    /* THE BRACE, and it runs the only way that works: from the foot of the
       harr up to the head. Drawn the other way the gate is a parallelogram
       within a season. */
    const run = Math.hypot(w - 0.16, H - 0.34)
    const angle = Math.atan2(H - 0.34, w - 0.16)
    timber.push(
      at(metreBox(run, 0.07, 0.04), [w / 2, H / 2, -0.045], [0, 0, angle])
    )
  } else {
    const count = Math.max(4, Math.round(w / 0.19))
    const bw = w / count
    for (let i = 0; i < count; i++) {
      const t = between(r, 0.028, 0.036)
      const x = bw * (i + 0.5)
      timber.push(at(shiftUV(metreBox(bw - 0.004, H, t), x, 0), [x, H / 2, t / 2]))
    }
    for (const y of [H * 0.17, H * 0.83]) {
      timber.push(at(metreBox(w * 0.94, 0.09, 0.035), [w / 2, y, -0.018]))
      irons.push(at(metreBox(w * 0.6, 0.05, 0.008), [w * 0.32, y, 0.042]))
    }
  }

  /* the hinges, and they are what a gate hangs on */
  for (const y of [H * 0.14, H * 0.82]) {
    irons.push(at(metreBox(w * 0.34, 0.055, 0.009), [w * 0.2, y, 0.05]))
    irons.push(at(metreCylinder(0.017, 0.017, 0.11, 8), [0.02, y, 0], [Math.PI / 2, 0, 0]))
  }
  leaf.add(body(weld(timber), oak, 'timber'))
  leaf.add(body(weld(irons), iron, 'ironwork'))
  leaf.scale.x = hinge
  const swing = new Group()
  swing.add(leaf)
  swing.rotation.y = hinge * (o.open ?? 0) * RAD
  group.add(swing)

  if (o.posts !== false) {
    const stone = bench.surface(STONE, { roughFloor: 0.7 })
    const posts: BufferGeometry[] = []
    for (const side of [0, 1] as const) {
      const x = side ? hinge * w + hinge * 0.12 : -hinge * 0.12
      posts.push(
        at(metreExtrude(chamfered(0.24, H + 0.42, 0.03, [0, 0, 1, 1]), 0.24), [
          x,
          (H + 0.42) / 2 - 0.08,
          -0.12,
        ])
      )
    }
    group.add(body(weld(posts), stone, 'posts'))
  }

  return seal(group, 'gate', `a ${kind} gate, ${w} m wide`, [timberSet, ironSet, STONE])
}
