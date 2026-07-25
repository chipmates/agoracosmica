/* THE FORT — his discipline: a rectilinear grid pressed onto a dark,
   curved, indifferent planet. The bridge and the ford, the agger and its
   four hundred stakes, the porta praetoria, the towers, the forty
   contubernia in the Roman grid, the standards, the arms, the picket, and
   the four sentries who are the only people in this world.

   No Bodies, no faces (concept law): a sentry is a cloak, a helmet line
   and a spear. They breathe, they shift their weight, and that is all. */

import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu'
import { field, type FieldItem, MAP, place } from './hour'
import { palette } from './materials'

/** map space: the ink materials curve the planet in their own vertex
    path, so a solid is placed with its RAW map coordinates. place() is for
    the things that do not curve themselves (sprites, flames, projections);
    using it here would curve them twice. */
const mp = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z)

/* a ridge tent (papilio): a triangular prism, ridge up, floor at y=0 */
export function ridgeTent(w: number, h: number, len: number): BufferGeometry {
  const geo = new CylinderGeometry(1, 1, 1, 3, 1, false)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0.5, 0)
  geo.scale(w / 1.7320508, h / 1.5, len)
  geo.computeVertexNormals()
  return geo
}

/* the same prism with both ends open: the praetorium's front is a doorway */
export function openPrism(w: number, h: number, len: number): BufferGeometry {
  const geo = new CylinderGeometry(1, 1, 1, 3, 1, true)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0.5, 0)
  geo.scale(w / 1.7320508, h / 1.5, len)
  geo.computeVertexNormals()
  return geo
}

/* extrude a profile along a closed path — the agger (earth rampart) */
function ribbon(path: Array<[number, number]>, profile: Array<[number, number]>): BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  const n = path.length
  const P = profile.length
  for (let i = 0; i < n; i++) {
    const a = path[i]
    const b = path[(i + 1) % n]
    const c = path[(i - 1 + n) % n]
    if (!a || !b || !c) continue
    const tx = b[0] - c[0]
    const tz = b[1] - c[1]
    const L = Math.hypot(tx, tz) || 1
    const nx = tz / L
    const nz = -tx / L
    for (let j = 0; j < P; j++) {
      const cur = profile[j]
      if (!cur) continue
      const [o, h] = cur
      pos.push(a[0] + nx * o, h, a[1] + nz * o)
      const j2 = profile[Math.min(j + 1, P - 1)] ?? cur
      const j0 = profile[Math.max(j - 1, 0)] ?? cur
      const dO = j2[0] - j0[0]
      const dH = j2[1] - j0[1]
      const m = Math.hypot(dO, dH) || 1
      nor.push((nx * dH) / m, -dO / m, (nz * dH) / m)
    }
  }
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j
      const b = i2 * P + j
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  geo.setIndex(idx)
  return geo
}

/* the rounded-rectangle plan of a Roman castra */
function castraPath(
  hx: number,
  zF: number,
  zB: number,
  r: number,
  step: number
): Array<[number, number]> {
  const cz = (zF + zB) / 2
  const hz = (zF - zB) / 2
  const pts: Array<[number, number]> = []
  const corner = (cx: number, cz2: number, a0: number, a1: number): void => {
    const segs = Math.max(3, Math.round((Math.abs(a1 - a0) * r) / step))
    for (let i = 0; i <= segs; i++) {
      const a = a0 + ((a1 - a0) * i) / segs
      pts.push([cx + Math.cos(a) * r, cz2 + Math.sin(a) * r])
    }
  }
  const line = (x0: number, z0: number, x1: number, z1: number): void => {
    const L = Math.hypot(x1 - x0, z1 - z0)
    const segs = Math.max(1, Math.round(L / step))
    for (let i = 1; i < segs; i++)
      pts.push([x0 + ((x1 - x0) * i) / segs, z0 + ((z1 - z0) * i) / segs])
  }
  corner(hx - r, cz + hz - r, 0, Math.PI / 2)
  line(hx - r, cz + hz, -hx + r, cz + hz)
  corner(-hx + r, cz + hz - r, Math.PI / 2, Math.PI)
  line(-hx, cz + hz - r, -hx, cz - hz + r)
  corner(-hx + r, cz - hz + r, Math.PI, 1.5 * Math.PI)
  line(-hx + r, cz - hz, hx - r, cz - hz)
  corner(hx - r, cz - hz + r, 1.5 * Math.PI, 2 * Math.PI)
  line(hx, cz - hz + r, hx, cz + hz - r)
  return pts
}

interface Sentry {
  inner: Group
  ph: number
}

export interface Fort {
  group: Group
  /** where the sentries stand, for the frost breath organ */
  sentryAnchors: Vector3[]
  update(t: number, gust: number): void
}

export function createFort(rand: () => number): Fort {
  const P = palette()
  const group = new Group()
  const add = <T extends Mesh | Group>(m: T): T => {
    group.add(m)
    return m
  }

  // ------------------------------------------------- THE BRIDGE / THE FORD
  {
    const deck = new Mesh(new BoxGeometry(3.0, 0.14, 19.0), P.timber)
    deck.position.copy(mp(0, MAP.bridge.y, 15.0))
    add(deck)
    for (const sx of [-1, 1]) {
      const rail = new Mesh(new BoxGeometry(0.09, 0.09, 19.0), P.timber)
      rail.position.copy(mp(sx * 1.42, 0.86, 15.0))
      add(rail)
    }
    const posts: FieldItem[] = []
    for (let i = 0; i <= 12; i++) {
      const z = 6.2 + i * 1.55
      for (const sx of [-1, 1]) posts.push({ p: [sx * 1.42, -0.55, z], s: [1, 1.5, 1] })
    }
    // the piles that carry it into the dark water
    for (let i = 0; i <= 7; i++) {
      const z = 7.0 + i * 2.5
      for (const sx of [-1, 1]) posts.push({ p: [sx * 1.3, -0.7, z], s: [1.4, 1.4, 1.4] })
    }
    add(field(new CylinderGeometry(0.055, 0.07, 1.0, 6).translate(0, 0.5, 0), P.timberI, posts))
    // the brazier's plinth stands IN the shallows, its top a hand above the
    // water: a fire up on a deck reflects a metre and a half down and reads
    // as a second fire under the planks
    const plinth = new Mesh(new CylinderGeometry(0.42, 0.52, 0.6, 10), P.earthStone)
    plinth.position.copy(mp(2.85, -0.25, 12.6))
    add(plinth)
    // the bridge post that carries the river's trace
    const tracePost = new Mesh(new CylinderGeometry(0.06, 0.075, 1.2, 7), P.timber)
    tracePost.position.copy(mp(-1.42, 0.42, 12.4))
    add(tracePost)
  }

  // ---------------------------------------- THE PALISADE, GATE, TOWERS
  const path = castraPath(MAP.wall.x, MAP.wall.zFront, MAP.wall.zBack, MAP.wall.r, 0.55)
  {
    const agger = new Mesh(
      ribbon(path, [
        [-1.15, 0],
        [-0.95, 1.05],
        [0.55, 1.18],
        [1.65, 0],
      ]),
      P.earth
    )
    add(agger)
    const stakes: FieldItem[] = []
    for (let i = 0; i < path.length; i++) {
      const pt = path[i]
      if (!pt) continue
      const [x, z] = pt
      // the gate is a gap in the ring
      if (z > MAP.wall.zFront - 0.6 && Math.abs(x) < MAP.gate.halfW + 0.2) continue
      const jx = (rand() - 0.5) * 0.12
      const jz = (rand() - 0.5) * 0.12
      stakes.push({
        p: [x + jx, 1.05, z + jz],
        s: [1, 1.0 + rand() * 0.22, 1],
        r: rand() * 3,
        tint: 0.85 + rand() * 0.3,
      })
      if (i % 2 === 0) {
        stakes.push({
          p: [x + jx * 2 - 0.42 * Math.sign(x || 1), 0.9, z + jz * 2],
          s: [0.8, 0.72 + rand() * 0.2, 0.8],
          r: rand() * 3,
          tint: 0.7 + rand() * 0.25,
        })
      }
    }
    add(field(new CylinderGeometry(0.014, 0.075, 1.2, 6).translate(0, 0.6, 0), P.stakes, stakes))
  }

  {
    for (const sx of [-1, 1]) {
      const post = new Mesh(new CylinderGeometry(0.17, 0.2, 3.3, 8), P.timber)
      post.position.copy(mp(sx * MAP.gate.halfW, 1.65, MAP.gate.z))
      add(post)
      // the leaves, standing open for the night watch
      const leaf = new Mesh(new BoxGeometry(1.7, 2.5, 0.11), P.timber)
      leaf.position.copy(mp(sx * (MAP.gate.halfW + 0.72), 1.25, MAP.gate.z - 0.7))
      leaf.rotation.y = sx * 0.75
      add(leaf)
    }
    const lintel = new Mesh(new BoxGeometry(4.5, 0.24, 0.3), P.timber)
    lintel.position.copy(mp(0, 3.2, MAP.gate.z))
    add(lintel)
    const board = new Mesh(new BoxGeometry(2.2, 0.5, 0.07), P.timber)
    board.position.copy(mp(0, 3.6, MAP.gate.z))
    add(board)
  }

  // watchtowers: two over the gate, one at the rear angle
  function tower(x: number, z: number, h: number): void {
    const g = new Group()
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as Array<[number, number]>) {
      const leg = new Mesh(new CylinderGeometry(0.09, 0.13, h, 6), P.timber)
      leg.position.copy(mp(x + dx * 0.78, h / 2, z + dz * 0.78))
      leg.rotation.z = -dx * 0.045
      leg.rotation.x = dz * 0.045
      g.add(leg)
    }
    for (let i = 1; i <= 3; i++) {
      const brace = new Mesh(new BoxGeometry(1.9, 0.07, 0.07), P.timber)
      brace.position.copy(mp(x, (h * i) / 4, z + 0.78))
      g.add(brace)
      const brace2 = new Mesh(new BoxGeometry(0.07, 0.07, 1.9), P.timber)
      brace2.position.copy(mp(x + 0.78, (h * i) / 4, z))
      g.add(brace2)
    }
    const deck = new Mesh(new BoxGeometry(2.3, 0.16, 2.3), P.timber)
    deck.position.copy(mp(x, h, z))
    g.add(deck)
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as Array<[number, number]>) {
      const p = new Mesh(new CylinderGeometry(0.055, 0.06, 1.0, 5), P.timber)
      p.position.copy(mp(x + dx * 1.05, h + 0.5, z + dz * 1.05))
      g.add(p)
    }
    const rail = new Mesh(new BoxGeometry(2.35, 0.07, 0.07), P.timber)
    rail.position.copy(mp(x, h + 0.92, z + 1.05))
    g.add(rail)
    const roof = new Mesh(new ConeGeometry(1.95, 0.7, 4), P.timber)
    roof.rotation.y = Math.PI / 4
    roof.position.copy(mp(x, h + 1.75, z))
    g.add(roof)
    add(g)
  }
  tower(-4.4, 4.9, 4.6)
  tower(4.4, 4.9, 4.6)
  tower(-11.4, -28.2, 4.2)

  // ------------------------------------------------------ THE CONTUBERNIA
  {
    const tents: FieldItem[] = []
    const rowsZ: number[] = []
    for (let i = 0; i < 6; i++) rowsZ.push(-0.6 - i * 2.95)
    for (const side of [-1, 1]) {
      for (const cx of [5.1, 8.7, 11.8]) {
        for (const z of rowsZ) {
          if (cx > 11.5 && z < -12) continue
          tents.push({
            p: [side * (cx + (rand() - 0.5) * 0.16), 0, z + (rand() - 0.5) * 0.22],
            s: [1, 0.94 + rand() * 0.12, 1],
            r: (rand() - 0.5) * 0.05,
            tint: 0.88 + rand() * 0.26,
          })
        }
      }
    }
    // the rear block, behind the praetorium
    for (const cx of [-7.6, -4.6, 4.6, 7.6]) {
      for (const z of [-25.4, -28.0]) {
        tents.push({
          p: [cx + (rand() - 0.5) * 0.2, 0, z],
          s: [1, 0.92, 1],
          r: (rand() - 0.5) * 0.06,
          tint: 0.8,
        })
      }
    }
    add(field(ridgeTent(1.9, 1.55, 2.55), P.canvas, tents))
  }

  // -------------------------------------------------------- THE STANDARDS
  interface Vexillum {
    cloth: Mesh
  }
  function vexillum(x: number, z: number, yaw: number): Vexillum {
    const g = new Group()
    const pole = new Mesh(new CylinderGeometry(0.026, 0.032, 2.5, 6), P.timber)
    pole.position.copy(mp(x, 1.25, z))
    g.add(pole)
    const bar = new Mesh(new CylinderGeometry(0.018, 0.018, 0.62, 5), P.timber)
    bar.rotation.z = Math.PI / 2
    bar.position.copy(mp(x, 2.32, z))
    bar.rotation.y = yaw
    g.add(bar)
    const cloth = new Mesh(new PlaneGeometry(0.58, 0.46, 6, 4), P.ochre)
    cloth.position.copy(mp(x, 2.06, z))
    cloth.rotation.y = yaw
    g.add(cloth)
    const finial = new Mesh(new ConeGeometry(0.04, 0.13, 8), P.gilt)
    finial.position.copy(mp(x, 2.56, z))
    g.add(finial)
    add(g)
    return { cloth }
  }
  const vexA = vexillum(-2.7, 1.6, 0.1)
  const vexB = vexillum(4.35, -7.0, -0.35)

  // the aquila, at the praetorium: the eagle is INK with a gilded edge,
  // because gold is light and never paint
  {
    const x = -3.3
    const z = MAP.praetorium.z + MAP.praetorium.d / 2 + 1.3
    const pole = new Mesh(new CylinderGeometry(0.028, 0.034, 2.9, 6), P.timber)
    pole.position.copy(mp(x, 1.45, z))
    add(pole)
    const wreath = new Mesh(new TorusGeometry(0.11, 0.017, 6, 14), P.gilt)
    wreath.position.copy(mp(x, 2.62, z))
    add(wreath)
    const bird = new Mesh(new SphereGeometry(0.05, 8, 6), P.aquila)
    bird.scale.set(0.7, 1.1, 1.4)
    bird.position.copy(mp(x, 2.98, z))
    add(bird)
    for (const sx of [-1, 1]) {
      const wing = new Mesh(new BoxGeometry(0.14, 0.05, 0.025), P.aquila)
      wing.position.copy(mp(x + sx * 0.1, 3.03, z))
      wing.rotation.z = sx * 0.72
      add(wing)
    }
    const plate = new Mesh(new BoxGeometry(0.17, 0.11, 0.02), P.aquila)
    plate.position.copy(mp(x, 2.34, z))
    add(plate)
  }

  // ------------------------------------------- SHIELDS, PILA, THE PICKET
  const scutum = new CylinderGeometry(0.42, 0.42, 1.02, 12, 1, true, -0.85, 1.7)
  function shieldStack(x: number, z: number, yaw: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = new Mesh(scutum, P.ochre)
      s.position.copy(mp(x + i * 0.13, 0.52, z + i * 0.05))
      s.rotation.y = yaw + i * 0.09
      s.rotation.x = 0.12
      add(s)
      const boss = new Mesh(new SphereGeometry(0.055, 8, 6), P.gilt)
      boss.scale.z = 0.6
      boss.position.copy(
        mp(x + i * 0.13 + Math.sin(yaw) * 0.38, 0.56, z + i * 0.05 + Math.cos(yaw) * 0.38)
      )
      add(boss)
    }
  }
  shieldStack(3.6, -12.4, 0.5, 4)
  shieldStack(-4.7, -12.2, -2.6, 3)
  function pilaStack(x: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const p = new Mesh(new CylinderGeometry(0.012, 0.016, 2.1, 5), P.timber)
      p.position.copy(mp(x + Math.cos(a) * 0.16, 1.02, z + Math.sin(a) * 0.16))
      p.rotation.z = -Math.cos(a) * 0.16
      p.rotation.x = Math.sin(a) * 0.16
      add(p)
      const head = new Mesh(new ConeGeometry(0.02, 0.16, 5), P.gilt)
      head.position.copy(mp(x + Math.cos(a) * 0.32, 2.1, z + Math.sin(a) * 0.32))
      add(head)
    }
  }
  pilaStack(4.6, -12.2)
  pilaStack(-5.6, -12.0)

  // the horse picket line
  const horses: Array<{ head: Group; ph: number }> = []
  {
    const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 8.4, 5), P.timber)
    rope.rotation.z = Math.PI / 2
    rope.position.copy(mp(-8.0, 1.02, -24.6))
    add(rope)
    for (const x of [-11.6, -4.4]) {
      const p = new Mesh(new CylinderGeometry(0.05, 0.062, 1.3, 6), P.timber)
      p.position.copy(mp(x, 0.65, -24.6))
      add(p)
    }
    for (let i = 0; i < 5; i++) {
      const x = -11.0 + i * 1.65 + (rand() - 0.5) * 0.2
      const g = new Group()
      const z = -25.5
      const body = new Mesh(new CylinderGeometry(0.3, 0.27, 1.42, 8), P.hide)
      body.rotation.z = Math.PI / 2
      body.position.copy(mp(x, 1.06, z))
      body.rotation.y = 0.06
      g.add(body)
      const neck = new Mesh(new CylinderGeometry(0.11, 0.18, 0.62, 7), P.hide)
      neck.position.copy(mp(x + 0.68, 1.28, z))
      neck.rotation.z = 0.62
      g.add(neck)
      const head = new Group()
      const skull = new Mesh(new BoxGeometry(0.34, 0.16, 0.15), P.hide)
      skull.position.copy(mp(x + 1.02, 1.42, z))
      skull.rotation.z = -0.35
      head.add(skull)
      g.add(head)
      for (const [dx, dz] of [
        [-0.5, -0.16],
        [-0.5, 0.16],
        [0.5, -0.16],
        [0.5, 0.16],
      ] as Array<[number, number]>) {
        const leg = new Mesh(new CylinderGeometry(0.045, 0.035, 0.9, 5), P.hide)
        leg.position.copy(mp(x + dx, 0.45, z + dz))
        g.add(leg)
      }
      const tail = new Mesh(new ConeGeometry(0.07, 0.6, 6), P.hide)
      tail.position.copy(mp(x - 0.76, 0.94, z))
      tail.rotation.z = 0.4
      g.add(tail)
      add(g)
      horses.push({ head, ph: rand() * 6.28 })
    }
  }

  // ------------------------------------------------------- THE SENTRIES
  const sentries: Sentry[] = []
  const sentryAnchors: Vector3[] = []
  function sentry(x: number, y: number, z: number, yaw: number): void {
    const g = new Group()
    const inner = new Group()
    g.add(inner)
    const cloak = new Mesh(new ConeGeometry(0.3, 1.12, 9, 1, true), P.cloth)
    cloak.position.set(0, 0.56, 0)
    inner.add(cloak)
    const torso = new Mesh(new CylinderGeometry(0.155, 0.185, 0.6, 8), P.cloth)
    torso.position.set(0, 1.02, 0)
    inner.add(torso)
    const shoulders = new Mesh(new BoxGeometry(0.42, 0.11, 0.2), P.cloth)
    shoulders.position.set(0, 1.3, 0)
    inner.add(shoulders)
    const head = new Mesh(new SphereGeometry(0.105, 10, 8), P.cloth)
    head.position.set(0, 1.47, 0)
    inner.add(head)
    const helm = new Mesh(new SphereGeometry(0.115, 10, 6, 0, 6.28, 0, 1.5), P.helm)
    helm.position.set(0, 1.5, 0)
    inner.add(helm)
    const crest = new Mesh(new BoxGeometry(0.022, 0.075, 0.19), P.ochre)
    crest.position.set(0, 1.61, 0)
    inner.add(crest)
    const spear = new Mesh(new CylinderGeometry(0.013, 0.016, 2.2, 5), P.timber)
    spear.position.set(0.24, 1.0, 0.04)
    spear.rotation.z = -0.1
    inner.add(spear)
    const tip = new Mesh(new ConeGeometry(0.022, 0.17, 5), P.gilt)
    tip.position.set(0.35, 2.14, 0.04)
    inner.add(tip)
    const sh = new Mesh(scutum, P.ochre)
    sh.position.set(-0.28, 0.52, 0.02)
    sh.rotation.y = 1.5
    inner.add(sh)
    g.position.copy(mp(x, y, z))
    g.rotation.y = yaw
    add(g)
    sentries.push({ inner, ph: rand() * 6.28 })
    sentryAnchors.push(place(x, y + 1.5, z))
  }
  sentry(-6.6, 1.18, 4.0, 0.25)
  sentry(6.9, 1.18, 3.9, -0.3)
  sentry(-4.4, 4.78, 4.9, 0.1)
  sentry(11.9, 1.18, -14.0, -1.5)

  // ------------------------------------------------------- SUPPLY WAGONS
  for (const [x, z, yaw] of [
    [9.2, -19.4, 0.2],
    [-8.6, -20.6, -0.5],
  ] as Array<[number, number, number]>) {
    const g = new Group()
    const bed = new Mesh(new BoxGeometry(1.15, 0.46, 2.3), P.timber)
    bed.position.copy(mp(x, 0.78, z))
    bed.rotation.y = yaw
    g.add(bed)
    const hoop = new Mesh(new TorusGeometry(0.58, 0.03, 5, 14, Math.PI), P.timber)
    hoop.position.copy(mp(x, 1.02, z))
    hoop.rotation.y = yaw + Math.PI / 2
    g.add(hoop)
    const load = new Mesh(new BoxGeometry(1.0, 0.4, 1.9), P.load)
    load.position.copy(mp(x, 1.18, z))
    load.rotation.y = yaw
    g.add(load)
    for (const [dx, dz] of [
      [-0.62, -0.8],
      [0.62, -0.8],
      [-0.62, 0.8],
      [0.62, 0.8],
    ] as Array<[number, number]>) {
      const w = new Mesh(new TorusGeometry(0.42, 0.05, 5, 14), P.timber)
      const wx = x + dx * Math.cos(yaw) - dz * Math.sin(yaw)
      const wz = z + dx * Math.sin(yaw) + dz * Math.cos(yaw)
      w.position.copy(mp(wx, 0.42, wz))
      w.rotation.y = yaw + Math.PI / 2
      g.add(w)
    }
    const shaft = new Mesh(new CylinderGeometry(0.035, 0.045, 1.8, 5), P.timber)
    shaft.rotation.x = Math.PI / 2 - 0.14
    shaft.position.copy(mp(x - Math.sin(yaw) * 2.0, 0.6, z + Math.cos(yaw) * 2.0))
    shaft.rotation.y = yaw
    g.add(shaft)
    add(g)
  }

  // ------------------------------------------- THE TRACE POST + THE RAVEN
  {
    const post = new Mesh(new CylinderGeometry(0.075, 0.095, 1.55, 8), P.post)
    post.position.copy(mp(3.4, 0.77, -5.3))
    add(post)
    // the carved face: a shallow plaque that takes the firelight edge-on,
    // not a gold star (the second trace register)
    const carve = new Mesh(new PlaneGeometry(0.15, 0.46), P.carve)
    carve.position.copy(mp(3.31, 0.96, -5.21))
    carve.rotation.y = -0.79
    add(carve)
  }
  const raven = new Group()
  {
    const b = new Mesh(new SphereGeometry(0.075, 8, 6), P.raven)
    b.scale.set(0.8, 0.9, 1.5)
    b.position.copy(mp(1.15, 3.42, MAP.gate.z))
    raven.add(b)
    const hd = new Mesh(new SphereGeometry(0.04, 8, 6), P.raven)
    hd.position.copy(mp(1.15, 3.53, MAP.gate.z + 0.09))
    raven.add(hd)
    const tl = new Mesh(new ConeGeometry(0.035, 0.14, 5), P.raven)
    tl.rotation.x = -1.7
    tl.position.copy(mp(1.15, 3.44, MAP.gate.z - 0.16))
    raven.add(tl)
    add(raven)
  }

  // ---------------------------------------- THE KERB AND THE STONY GROUND
  {
    const kerb: FieldItem[] = []
    for (let i = 0; i < 44; i++) {
      const z = 4.0 - i * 0.62
      for (const sx of [-1, 1]) {
        kerb.push({
          p: [sx * (3.05 + (rand() - 0.5) * 0.22), 0.045, z + (rand() - 0.5) * 0.2],
          s: [0.62 + rand() * 0.45, 0.5 + rand() * 0.6, 0.62 + rand() * 0.4],
          r: rand() * 3,
          tint: 0.85 + rand() * 0.35,
        })
      }
    }
    add(field(new BoxGeometry(0.24, 0.14, 0.3), P.kerb, kerb))

    const rubble: FieldItem[] = []
    for (let i = 0; i < 220; i++) {
      const a = rand() * Math.PI * 2
      const r = 1.5 + Math.pow(rand(), 0.7) * 30
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (z > 5.6 && z < 25.0) continue
      // a marching camp sweeps its own road
      if (Math.abs(x) < 3.5 && z < 5.2 && z > -22.0) continue
      rubble.push({
        p: [x, 0.02, z],
        s: [0.4 + rand() * 0.8, 0.3 + rand() * 0.55, 0.4 + rand() * 0.8],
        r: rand() * 3,
        tint: 0.7 + rand() * 0.5,
      })
    }
    add(field(new BoxGeometry(0.2, 0.12, 0.24), P.rubble, rubble))
  }

  return {
    group,
    sentryAnchors,
    update(t, gust) {
      // the sentries: breathing, and shifting their weight on a long clock
      for (const s of sentries) {
        const br = 1 + 0.014 * Math.sin(t * 0.85 + s.ph)
        s.inner.scale.set(1, br, 1)
        const shift = Math.sin(t * 0.11 + s.ph) * 0.06 + Math.sin(t * 0.037 + s.ph * 2) * 0.05
        s.inner.rotation.z = shift * 0.5
        s.inner.position.x = shift
      }
      for (const h of horses) {
        h.head.rotation.x = 0.22 * Math.sin(t * 0.21 + h.ph) - 0.14
        h.head.position.y = -0.1 * Math.max(0, Math.sin(t * 0.21 + h.ph))
      }
      // the vexilla lift on the gust
      const lift = gust * 0.5 + 0.06 * Math.sin(t * 1.3)
      vexA.cloth.rotation.z = lift * 0.28
      vexB.cloth.rotation.z = -lift * 0.24
      raven.rotation.y = 0.12 * Math.sin(t * 0.23)
    },
  }
}
