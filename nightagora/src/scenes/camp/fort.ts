/* THE FORT — his discipline: a rectilinear grid pressed onto a dark,
   curved, indifferent planet. The bridge and the ford, the agger and its
   four hundred stakes, the porta praetoria, the towers, the forty
   contubernia in the Roman grid, the standards, the arms, the picket, and
   the sentries who are the only people in this world.

   No Bodies, no faces (concept law): a sentry is a cloak, a helmet line
   and a spear. They breathe, they shift their weight, and that is all.

   AND THE THINGS A LEGION LEAVES LYING ABOUT. A marching fort on the
   Danube is not a diagram: it is eight thousand men who cut firewood,
   carried water, pitched cloth that has been pitched a hundred times
   before, and went to sleep. Every repeated thing here is an instanced
   field, because a fort is four hundred stakes and not four hundred
   meshes. */

import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu'
import { field, type FieldItem, inkMaterial, MAP, place } from './hour'
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

/* the same tent after a season of marching: the ridge sags between its
   poles and the walls belly out under it. Forty identical tents are a
   diagram, and a diagram is the one thing this camp must not be. */
function tiredTent(w: number, h: number, len: number, sag: number): BufferGeometry {
  const geo = new CylinderGeometry(1, 1, 1, 3, 6, false)
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0.5, 0)
  geo.scale(w / 1.7320508, h / 1.5, len)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const dip = sag * Math.cos((pos.getZ(i) / len) * Math.PI) * (y / h)
    pos.setY(i, y - dip)
    pos.setX(i, pos.getX(i) * (1 + dip * 0.55))
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

/* AN INSTANCED FIELD CARRIES ONE YAW AND NO TILT, so anything that does not
   stand upright leans inside its own geometry and the yaw aims it at the
   world: guy ropes, propped stakes, ladder rails. Uniform instance scale is
   the price, because a scale applied after the lean would bend the angle. */
function leaned(geo: BufferGeometry, tilt: number): BufferGeometry {
  geo.translate(0, 0.5, 0)
  geo.rotateX(tilt)
  return geo
}

/* and the things that lie down: a billet of firewood, a plank, a rung */
function lying(geo: BufferGeometry): BufferGeometry {
  geo.rotateX(Math.PI / 2)
  return geo
}

/** the instanced field's own yaw convention, so JS and the shader agree */
function yawTo(dx: number, dz: number): number {
  return Math.atan2(dx, dz)
}
/** a local offset turned by that same yaw */
function turn(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [x * c + z * s, -x * s + z * c]
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

  /* THE GEAR — five surfaces the palette does not carry, because they only
     exist out here among the tents. Same ink family, same skylight, same
     eight fires: this is a legion's clutter, not a second look. */
  const gear = {
    // split billets show their pale cut ends to whatever light finds them
    fuel: inkMaterial({ rim: 0.7, albedo: '#A08256', baseK: 0.46, instanced: true }),
    // sacked grain and wicker: soft, thirsty, almost no specular memory
    sack: inkMaterial({ rim: 0.44, albedo: '#9C8C6E', baseK: 0.5, ambK: 0.072, instanced: true }),
    // wet linen on a line is the highest-albedo thing in this whole camp,
    // so it holds the dome's light even where no fire reaches it. That is
    // what makes a drying line read at fifteen metres (round 2).
    linen: inkMaterial({ rim: 1.05, albedo: '#C6B99E', baseK: 0.36, ambK: 0.19, side: DoubleSide }),
    // roosting birds: a value, a beak, nothing more
    rook: inkMaterial({ rim: 0.5, albedo: '#4A4A56', baseK: 0.34, instanced: true }),
    // iron: bands, hoops, blades. It holds an edge of firelight and stops
    iron: inkMaterial({ rim: 1.15, albedo: '#7E7A76', baseK: 0.44, facePow: 3.2 }),
    ironI: inkMaterial({
      rim: 1.15, albedo: '#7E7A76', baseK: 0.44, facePow: 3.2, instanced: true,
    }),
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

    /* THE BRIDGE IS A WORKPLACE. Sixty men laid these planks in a week and
       the gear never went away: coils of rope, a bucket for the pitch, the
       spare deck timber, and the bollards the barges tie to. All of it in
       the brazier's own light, which is why it lives on this half. */
    const coilGeo = new TorusGeometry(0.17, 0.045, 5, 12)
    for (const [x, z, s] of [
      [1.02, 11.35, 1.0],
      [0.72, 11.05, 0.82],
      [-1.06, 14.2, 0.9],
    ] as Array<[number, number, number]>) {
      const coil = new Mesh(coilGeo, P.timber)
      coil.rotation.x = Math.PI / 2
      coil.scale.setScalar(s)
      coil.position.copy(mp(x, MAP.bridge.y + 0.09, z))
      add(coil)
    }
    const pail = new Mesh(new CylinderGeometry(0.13, 0.11, 0.2, 9), P.timber)
    pail.position.copy(mp(-0.86, MAP.bridge.y + 0.17, 10.6))
    add(pail)
    const bail = new Mesh(new TorusGeometry(0.13, 0.008, 4, 10, Math.PI), gear.iron)
    bail.rotation.y = Math.PI / 2
    bail.position.copy(mp(-0.86, MAP.bridge.y + 0.27, 10.6))
    add(bail)
    // the spare deck timber, stacked where the next repair will want it
    const planks: FieldItem[] = []
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 3 - (r % 2); i++) {
        planks.push({
          p: [0.62 + i * 0.2 + (rand() - 0.5) * 0.02, MAP.bridge.y + 0.06 + r * 0.09, 8.9],
          s: [1, 1, 1],
          r: 0.02 * (rand() - 0.5),
          tint: 0.82 + rand() * 0.3,
        })
      }
    }
    add(field(lying(new BoxGeometry(0.17, 0.075, 1.5)), P.timberI, planks))
    // the bollards a barge ties to, at the head of the crossing
    for (const [x, z] of [
      [1.62, 6.5],
      [-1.62, 6.5],
    ] as Array<[number, number]>) {
      const b = new Mesh(new CylinderGeometry(0.09, 0.11, 0.62, 7), P.timber)
      b.position.copy(mp(x, 0.31, z))
      add(b)
      const cap = new Mesh(new SphereGeometry(0.095, 8, 6), P.timber)
      cap.scale.y = 0.5
      cap.position.copy(mp(x, 0.62, z))
      add(cap)
    }

    /* THE FAR BANK — where the visitor is standing when the night opens.
       Nothing burns over here, so these are pure silhouette: two mooring
       posts, the timber that did not get used, and a skiff pulled up out of
       the current. A shore with nothing on it is a shore nobody left. */
    const bank: FieldItem[] = []
    for (const [x, z, s] of [
      [2.5, 25.4, 1.0],
      [-2.35, 25.9, 0.86],
      [3.35, 27.6, 0.74],
    ] as Array<[number, number, number]>) {
      bank.push({ p: [x, 0, z], s: [s, s, s], r: rand() * 3, tint: 0.85 + rand() * 0.3 })
    }
    add(field(new CylinderGeometry(0.075, 0.1, 1.35, 6).translate(0, 0.68, 0), P.timberI, bank))
    const drift: FieldItem[] = []
    for (let i = 0; i < 7; i++) {
      const yaw = 1.1 + (rand() - 0.5) * 0.5
      drift.push({
        p: [4.3 + (rand() - 0.5) * 0.5, 0.09 + Math.floor(i / 3) * 0.15, 26.5 + (rand() - 0.5) * 0.6],
        s: [1, 1, 1],
        r: yaw,
        tint: 0.8 + rand() * 0.3,
      })
    }
    add(field(lying(new CylinderGeometry(0.075, 0.085, 1.9, 6)), P.timberI, drift))
    // the skiff: a hull, upturned, the way a river crew leaves one
    // (the tripod surface, because a half hull has to read from both faces)
    const hull = new Mesh(new CylinderGeometry(0.42, 0.42, 2.5, 9, 1, true, 0, Math.PI), P.tripod)
    hull.rotation.z = Math.PI / 2
    hull.rotation.y = 0.42
    hull.position.copy(mp(-4.1, 0.22, 24.6))
    add(hull)
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

    /* THE THRESHOLD — a gate you cross should be a line you cross. One sill
       beam BEDDED into the crest, not laid on it: from the gate station the
       eye is a metre above this, and a proud beam there is a black bar
       across the bottom of the frame (round 1 showed exactly that). */
    const sill = new Mesh(new BoxGeometry(3.9, 0.1, 0.3), P.timber)
    sill.position.copy(mp(0, 1.14, MAP.gate.z))
    add(sill)
    for (const sx of [-1, 1]) {
      const cleat = new Mesh(new BoxGeometry(0.2, 0.16, 0.44), P.timber)
      cleat.position.copy(mp(sx * 1.84, 1.16, MAP.gate.z))
      add(cleat)
    }
    // the iron ring the gate leaves are hauled on, and their pintles
    for (const sx of [-1, 1]) {
      const ring = new Mesh(new TorusGeometry(0.075, 0.014, 5, 12), gear.iron)
      ring.position.copy(mp(sx * (MAP.gate.halfW + 1.36), 1.4, MAP.gate.z - 1.14))
      ring.rotation.y = sx * 0.75
      add(ring)
    }

    /* THE LADDERS — the rampart is only walkable because someone leaves
       these leaning on it, and they are the one diagonal in a fort built
       entirely of uprights. */
    const rails: FieldItem[] = []
    const rungs: FieldItem[] = []
    const LEAN = 0.36
    for (const [x, z, yaw, h] of [
      [-3.35, 2.85, 0.06, 1.5],
      [5.25, 2.6, -0.22, 1.45],
      [-11.4, 1.05, -1.5, 1.42],
    ] as Array<[number, number, number, number]>) {
      const L = h / Math.cos(LEAN)
      for (const sx of [-1, 1]) {
        const [ox, oz] = turn(sx * 0.21, 0, yaw)
        rails.push({ p: [x + ox, 0, z + oz], s: [L, L, L], r: yaw, tint: 0.9 + rand() * 0.2 })
      }
      const steps = 5
      for (let i = 1; i <= steps; i++) {
        const t = (i / (steps + 1)) * L
        const [rx, rz] = turn(0, Math.sin(LEAN) * t, yaw)
        rungs.push({
          p: [x + rx, Math.cos(LEAN) * t, z + rz],
          s: [1, 1, 1],
          r: yaw + Math.PI / 2,
          tint: 0.85 + rand() * 0.25,
        })
      }
    }
    add(field(leaned(new CylinderGeometry(0.032, 0.042, 1, 5), LEAN), P.timberI, rails))
    add(field(lying(new CylinderGeometry(0.022, 0.022, 0.44, 5)), P.timberI, rungs))

    /* THE SPARE SUDES — every legionary carried stakes, and the ones the
       rampart did not swallow stand bundled against it, waiting for the
       next camp. */
    const spare: FieldItem[] = []
    for (const [x, z, yaw] of [
      [-2.9, 2.2, 0.5],
      [-2.7, 2.05, 0.5],
      [3.15, 2.35, -0.62],
      [3.32, 2.2, -0.62],
      [3.02, 2.5, -0.62],
      [-7.9, 0.6, 1.35],
      [-7.75, 0.48, 1.35],
    ] as Array<[number, number, number]>) {
      spare.push({
        p: [x, 0, z],
        s: [1.28, 1.28, 1.28],
        r: yaw + (rand() - 0.5) * 0.14,
        tint: 0.8 + rand() * 0.3,
      })
    }
    add(field(leaned(new CylinderGeometry(0.02, 0.05, 1, 5), 0.62), P.stakes, spare))

    /* THE DIGGING KIT — an agger is made with baskets and mattocks, and
       they are stacked where the work stopped. */
    const kit: FieldItem[] = []
    for (let i = 0; i < 7; i++) {
      const a = 1.9 + i * 0.5
      kit.push({
        p: [-4.55 + Math.cos(a) * 0.26, 0.02 + (i % 3) * 0.14, 1.5 + Math.sin(a) * 0.22],
        s: [1, 0.8 + rand() * 0.4, 1],
        r: rand() * 3,
        tint: 0.78 + rand() * 0.35,
      })
    }
    add(field(new CylinderGeometry(0.19, 0.13, 0.19, 8).translate(0, 0.1, 0), gear.sack, kit))
    for (const [x, z, yaw] of [
      [-4.15, 1.85, -0.4],
      [-4.9, 1.15, 0.8],
    ] as Array<[number, number, number]>) {
      const haft = new Mesh(new CylinderGeometry(0.02, 0.024, 1.15, 5), P.timber)
      haft.position.copy(mp(x, 0.5, z))
      haft.rotation.z = Math.sin(yaw) * 0.42
      haft.rotation.x = Math.cos(yaw) * 0.42
      add(haft)
      const blade = new Mesh(new BoxGeometry(0.055, 0.24, 0.11), gear.iron)
      blade.position.copy(mp(x + Math.sin(yaw) * 0.44, 0.98, z + Math.cos(yaw) * 0.44))
      blade.rotation.y = yaw
      add(blade)
    }
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
  /* eight men to a tent, and the grid is still his discipline: the yaw
     scatter stays small on purpose. What varies is what a season varies —
     how far the ridge has sagged, how tight the cloth was pulled tonight,
     and how much smoke and river the canvas has taken. */
  const TW = 1.9
  const TH = 1.55
  const TL = 2.55
  {
    const taut: FieldItem[] = []
    const worn: FieldItem[] = []
    const guys: FieldItem[] = []
    /* THE RIGGING — the one detail that turns a wedge into cloth: four
       ropes off each ridge end, and they REACH THE GROUND. The lean lives
       in the geometry, so the reach is fixed and the pegs are placed where
       the rope actually lands. */
    const GUY = 0.44
    const reach = Math.tan(GUY)
    const pitch = (x: number, z: number, sy: number, yaw: number, tint: number): void => {
      const item: FieldItem = { p: [x, 0, z], s: [1, sy, 1], r: yaw, tint }
      ;(rand() > 0.42 ? worn : taut).push(item)
      const h = TH * sy
      const L = h / Math.cos(GUY)
      for (const dz of [-1, 1]) {
        for (const dx of [-1, 1]) {
          const [ex, ez] = turn(0, (dz * TL) / 2, yaw)
          const m = Math.hypot(dx * 0.62, dz)
          const [ux, uz] = turn((dx * 0.62) / m, dz / m, yaw)
          guys.push({
            p: [x + ex + ux * h * reach, 0, z + ez + uz * h * reach],
            s: [L, L, L],
            r: yawTo(-ux, -uz),
            tint: 0.8 + rand() * 0.3,
          })
        }
      }
    }
    const rowsZ: number[] = []
    for (let i = 0; i < 6; i++) rowsZ.push(-0.6 - i * 2.95)
    for (const side of [-1, 1]) {
      for (const cx of [5.1, 8.7, 11.8]) {
        for (const z of rowsZ) {
          if (cx > 11.5 && z < -12) continue
          pitch(
            side * (cx + (rand() - 0.5) * 0.16),
            z + (rand() - 0.5) * 0.22,
            0.94 + rand() * 0.12,
            (rand() - 0.5) * 0.05,
            0.88 + rand() * 0.26
          )
        }
      }
    }
    // the rear block, behind the praetorium
    for (const cx of [-7.6, -4.6, 4.6, 7.6]) {
      for (const z of [-25.4, -28.0]) {
        pitch(cx + (rand() - 0.5) * 0.2, z, 0.92, (rand() - 0.5) * 0.06, 0.8)
      }
    }
    add(field(ridgeTent(TW, TH, TL), P.canvas, taut))
    add(field(tiredTent(TW * 1.02, TH, TL, 0.16), P.canvas, worn))
    add(field(leaned(new CylinderGeometry(0.008, 0.019, 1, 4), GUY), P.timberI, guys))
  }

  /* ------------------------------------------------- THE VIA'S FRONTAGE
     The strip between the kerb and the first row of tents is where a camp
     actually lives: cut wood, water, grain, and the gear of eighty men who
     will strike all of it before dawn. Every pile is placed to be found by
     a fire that already exists, because darkness carves and nothing here
     gets a lamp of its own. */
  {
    const billets: FieldItem[] = []
    const stackWood = (cx: number, cz: number, yaw: number, rows: number): void => {
      for (let r = 0; r < rows; r++) {
        const n = 4 - (r % 2)
        for (let i = 0; i < n; i++) {
          const lx = (i - (n - 1) / 2) * 0.17 + (rand() - 0.5) * 0.035
          const [ox, oz] = turn(lx, 0, yaw)
          const s = 0.9 + rand() * 0.2
          billets.push({
            p: [cx + ox, 0.055 + r * 0.15, cz + oz],
            s: [s, s, s],
            r: yaw + (rand() - 0.5) * 0.1,
            tint: 0.78 + rand() * 0.4,
          })
        }
      }
    }
    stackWood(-3.75, -2.4, 0.08, 3)
    stackWood(-3.72, -6.3, 0.12, 2)
    stackWood(3.75, -4.6, -0.1, 3)
    stackWood(-3.88, -9.4, 0.5, 2)
    stackWood(6.55, -9.5, 0.9, 3)
    stackWood(3.65, -13.7, 0.05, 3)
    stackWood(-3.7, -18.1, 0.2, 2)
    stackWood(2.6, 8.05, 1.5, 2)
    add(field(lying(new CylinderGeometry(0.05, 0.056, 0.74, 6)), gear.fuel, billets))

    // water: the barrels the mules brought up from the ford, and the
    // buckets that go back and forth all night
    const casks: FieldItem[] = []
    const cask = (x: number, z: number, s: number, squat: number): void => {
      casks.push({
        p: [x, 0, z],
        s: [s, s * squat, s],
        r: rand() * 3,
        tint: 0.82 + rand() * 0.3,
      })
    }
    cask(3.6, -1.2, 1, 1)
    cask(3.62, -1.75, 0.94, 0.96)
    cask(-3.66, -5.1, 1.02, 1)
    cask(-3.55, -11.9, 0.44, 0.8)
    cask(3.7, -12.0, 1, 1)
    cask(3.52, -12.55, 0.42, 0.78)
    cask(-3.62, -18.2, 0.96, 1)
    cask(5.15, -21.4, 1, 0.94)
    cask(6.2, -7.6, 0.9, 1)
    cask(6.05, -8.15, 0.46, 0.8)
    cask(6.85, -4.2, 0.9, 1)
    cask(-6.9, -7.3, 0.92, 1)
    cask(2.35, 7.4, 0.86, 1)
    cask(-2.5, 5.9, 0.44, 0.8)
    add(field(new CylinderGeometry(0.21, 0.185, 0.52, 10).translate(0, 0.26, 0), P.timberI, casks))
    // an iron hoop on each of the standing barrels, and the yoke of the
    // water carrier lying where he set it down
    const hoops: FieldItem[] = []
    for (const c of casks) {
      if ((c.s?.[0] ?? 1) < 0.6) continue
      hoops.push({ p: [c.p[0], 0.33 * (c.s?.[1] ?? 1), c.p[2]], s: [c.s?.[0] ?? 1, 1, c.s?.[0] ?? 1] })
    }
    add(field(new TorusGeometry(0.2, 0.011, 4, 12).rotateX(Math.PI / 2), gear.ironI, hoops))

    // grain, and the sacks it comes in
    const sacks: FieldItem[] = []
    const heap = (cx: number, cz: number, n: number, spread: number): void => {
      for (let i = 0; i < n; i++) {
        const a = rand() * 6.28
        const r = Math.pow(rand(), 0.7) * spread
        sacks.push({
          p: [cx + Math.cos(a) * r, 0.01 + (i % 2) * 0.2, cz + Math.sin(a) * r * 0.8],
          s: [0.9 + rand() * 0.3, 0.62 + rand() * 0.2, 0.72 + rand() * 0.25],
          r: rand() * 3,
          tint: 0.8 + rand() * 0.35,
        })
      }
    }
    heap(8.5, -18.0, 6, 0.55)
    heap(-7.9, -19.4, 5, 0.5)
    heap(5.5, -17.5, 4, 0.42)
    heap(6.15, -10.4, 4, 0.4)
    heap(-11.2, -25.4, 5, 0.6)
    add(field(new SphereGeometry(0.3, 8, 6), gear.sack, sacks))
  }

  /* -------------------------------------------------- THE DRYING LINE
     Wet linen on the frontage, hung where a fire actually reaches it. Two
     rounds of frames taught this: the left-hand strip of the via has no
     light source at all between the gate torches and the praetorium, so
     anything put there is a black shape, and white linen in the dark is
     just a hole. It hangs on the lit side, and it is the only thing in
     this fort that is not military. It moves on the same gust as the
     flames, a beat later, because wet cloth is heavy. */
  const laundry: Array<{ g: Group; ph: number }> = []
  {
    const x = 4.3
    for (const z of [-17.0, -19.8]) {
      const post = new Mesh(new CylinderGeometry(0.035, 0.05, 1.62, 6), P.timber)
      post.position.copy(mp(x, 0.81, z))
      add(post)
      const brace = new Mesh(new CylinderGeometry(0.022, 0.03, 0.9, 5), P.timber)
      brace.position.copy(mp(x + 0.24, 0.44, z))
      brace.rotation.z = 0.58
      add(brace)
    }
    const line = new Mesh(new CylinderGeometry(0.008, 0.008, 3.2, 4), P.timber)
    line.rotation.x = Math.PI / 2
    line.position.copy(mp(x, 1.56, -18.4))
    add(line)
    const clothGeo = new PlaneGeometry(0.5, 0.58)
    for (let i = 0; i < 5; i++) {
      const g = new Group()
      g.position.copy(mp(x, 1.54, -17.35 - i * 0.62))
      const c = new Mesh(clothGeo, gear.linen)
      // the face the eye sees is the face that must be lit: turned the
      // other way, a hanging cloth shows the walk its own shadow
      c.rotation.y = -Math.PI / 2
      c.position.set(0, -0.26 - rand() * 0.05, 0)
      c.scale.set(0.85 + rand() * 0.35, 0.85 + rand() * 0.3, 1)
      g.add(c)
      add(g)
      laundry.push({ g, ph: rand() * 6.28 })
    }
  }

  /* ------------------------------------------------------------ THE DOG
     Asleep in the wedge of gold the praetorium throws onto the via. He was
     at the crossed-log fire for three rounds and the frames showed a black
     lump: that corner of the camp has no light in it. Here the tent's own
     glow finds him, and a dog at his commander's door is the better story
     anyway. He is the only body in this camp not standing a watch, and he
     breathes. */
  const dog = new Group()
  {
    const body = new Mesh(new SphereGeometry(0.24, 10, 8), P.hide)
    body.scale.set(1.5, 0.72, 0.95)
    body.rotation.y = 0.5
    dog.add(body)
    const head = new Mesh(new SphereGeometry(0.115, 9, 7), P.hide)
    head.scale.set(1.15, 0.9, 1.0)
    head.position.set(0.3, -0.02, 0.16)
    dog.add(head)
    const muzzle = new Mesh(new ConeGeometry(0.055, 0.16, 7), P.hide)
    muzzle.rotation.x = Math.PI / 2
    muzzle.rotation.z = -0.4
    muzzle.position.set(0.36, -0.06, 0.27)
    dog.add(muzzle)
    const tail = new Mesh(new ConeGeometry(0.05, 0.42, 6), P.hide)
    tail.rotation.z = 1.5
    tail.rotation.y = -0.8
    tail.position.set(-0.3, -0.06, 0.22)
    dog.add(tail)
    dog.position.copy(mp(2.05, 0.15, -18.35))
    dog.rotation.y = -2.1
    add(dog)
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

    /* THE SACELLUM — the standards are kept at a small altar, and the
       legion's pay chest sleeps under it. Stone, so it takes the tent's
       spill on its upper faces and nothing else. */
    const ax = x - 0.95
    const az = z - 0.35
    const foot = new Mesh(new BoxGeometry(0.62, 0.11, 0.5), P.earthStone)
    foot.position.copy(mp(ax, 0.055, az))
    add(foot)
    const shaft = new Mesh(new BoxGeometry(0.44, 0.46, 0.36), P.earthStone)
    shaft.position.copy(mp(ax, 0.34, az))
    add(shaft)
    const cap = new Mesh(new BoxGeometry(0.6, 0.1, 0.48), P.earthStone)
    cap.position.copy(mp(ax, 0.62, az))
    add(cap)
    // the offering bowl, and what is left of the evening's incense
    const bowl = new Mesh(new SphereGeometry(0.1, 10, 6, 0, 6.28, 0, 1.6), P.bronze)
    bowl.scale.y = 0.5
    bowl.position.copy(mp(ax, 0.72, az))
    add(bowl)
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

    /* what a picket line needs: water at one end, fodder at the other, and
       the tack piled where the riders dropped it */
    const trough = new Mesh(new BoxGeometry(2.1, 0.3, 0.44), P.timber)
    trough.position.copy(mp(-8.4, 0.15, -23.55))
    add(trough)
    for (const sx of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.1, 0.3, 0.4), P.timber)
      leg.position.copy(mp(-8.4 + sx * 0.9, 0.15, -23.55))
      add(leg)
    }
    const fodder: FieldItem[] = []
    for (let i = 0; i < 9; i++) {
      const a = rand() * 6.28
      const r = Math.pow(rand(), 0.6) * 0.62
      fodder.push({
        p: [-12.35 + Math.cos(a) * r, 0.02 + (i % 3) * 0.17, -24.8 + Math.sin(a) * r * 0.85],
        s: [1.05 + rand() * 0.3, 0.55 + rand() * 0.25, 0.85 + rand() * 0.3],
        r: rand() * 3,
        tint: 0.85 + rand() * 0.35,
      })
    }
    add(field(new SphereGeometry(0.3, 8, 6), gear.sack, fodder))
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
  // the gate watch: near enough to the torches that they are edges of gold
  // and not shapes, which is the whole argument for a silhouette
  sentry(-2.95, 1.18, 3.85, 0.16)
  sentry(2.95, 1.18, 3.9, -0.14)

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

  /* ------------------------------------------------- THE BROKEN WAGON
     A cart with its wheel off, propped on a billet, waiting for a smith
     who will not get to it tonight. Nothing says a place is real like
     something in it being out of order. */
  {
    const x = 5.45
    const z = -20.7
    const yaw = -0.55
    const bed = new Mesh(new BoxGeometry(1.1, 0.42, 2.15), P.timber)
    bed.position.copy(mp(x, 0.62, z))
    bed.rotation.y = yaw
    bed.rotation.z = 0.13
    add(bed)
    for (const [dx, dz] of [
      [-0.6, -0.74],
      [0.6, -0.74],
      [0.6, 0.74],
    ] as Array<[number, number]>) {
      const [wx, wz] = turn(dx, dz, -yaw)
      const w = new Mesh(new TorusGeometry(0.4, 0.048, 5, 14), P.timber)
      w.position.copy(mp(x + wx, 0.4, z + wz))
      w.rotation.y = yaw + Math.PI / 2
      add(w)
    }
    // the wheel that came off, leaning on the bed
    const off = new Mesh(new TorusGeometry(0.4, 0.048, 5, 14), P.timber)
    off.position.copy(mp(x - 1.05, 0.38, z + 0.55))
    off.rotation.y = yaw + 0.4
    off.rotation.x = 0.42
    add(off)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI + 0.3
      const spoke = new Mesh(new CylinderGeometry(0.02, 0.02, 0.78, 4), P.timber)
      spoke.position.copy(mp(x - 1.05, 0.38, z + 0.55))
      spoke.rotation.y = yaw + 0.4
      spoke.rotation.x = 0.42
      spoke.rotation.z = a
      add(spoke)
    }
    // and the prop under the axle
    const prop = new Mesh(new CylinderGeometry(0.07, 0.08, 0.5, 6), P.timber)
    prop.position.copy(mp(x - 0.52, 0.25, z - 0.6))
    prop.rotation.z = 0.16
    add(prop)
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
  /* and his company: the birds a wall attracts, asleep on the lintel, the
     stakes and the tower rail. Silhouettes, one draw call, no eyes. */
  {
    const roost: FieldItem[] = []
    for (const [x, y, z, s] of [
      [-0.35, 3.37, MAP.gate.z, 1.0],
      [-0.68, 3.36, MAP.gate.z, 0.86],
      [2.05, 3.35, MAP.gate.z, 0.78],
      [-4.4, 5.6, 6.0, 0.9],
      [-8.9, 1.78, 4.42, 0.82],
      [9.65, 1.76, 4.35, 0.86],
      [-12.6, 1.72, -6.5, 0.8],
      [12.55, 1.74, -19.8, 0.84],
    ] as Array<[number, number, number, number]>) {
      roost.push({ p: [x, y, z], s: [s * 0.8, s * 0.9, s * 1.5], r: rand() * 3, tint: 0.7 + rand() * 0.4 })
    }
    add(field(new SphereGeometry(0.075, 7, 5), gear.rook, roost))
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
    // THE VIA QUINTANA — the cross street the grid implies, kerbed the same
    // way, so the fort reads as a plan and not as one road with tents
    for (let i = 0; i < 12; i++) {
      const x = 3.5 + i * 0.78
      for (const sx of [-1, 1]) {
        kerb.push({
          p: [sx * (x + (rand() - 0.5) * 0.2), 0.045, -16.7 + (rand() - 0.5) * 0.22],
          s: [0.55 + rand() * 0.4, 0.45 + rand() * 0.5, 0.55 + rand() * 0.35],
          r: rand() * 3,
          tint: 0.82 + rand() * 0.3,
        })
      }
    }
    add(field(new BoxGeometry(0.24, 0.14, 0.3), P.kerb, kerb))

    /* THE LATRINE SCREEN — far off at the rear angle, downwind, a wattle
       hurdle standing on its own. Camps have one, and putting it where a
       camp would put it is what makes the rest of the plan believable. */
    const hurdle: FieldItem[] = []
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.42
      hurdle.push({
        p: [-8.6 + Math.cos(a) * 1.5, 0, -29.3 + Math.sin(a) * 1.5],
        s: [1, 0.9 + rand() * 0.22, 1],
        r: a + Math.PI / 2,
        tint: 0.78 + rand() * 0.3,
      })
    }
    add(field(new BoxGeometry(0.85, 1.05, 0.06).translate(0, 0.52, 0), gear.sack, hurdle))

    const rubble: FieldItem[] = []
    /* THE CHURN — a marching camp sweeps its road, and the one place it
       cannot keep swept is the gap every boot in the legion comes through.
       Three bands: the approach outside, the crest of the sill itself, and
       the ground just inside where the mud gets carried in. */
    for (const [z0, z1, y] of [
      [6.1, 8.4, 0.02],
      [3.5, 4.9, 1.11],
      [0.5, 2.9, 0.02],
    ] as Array<[number, number, number]>) {
      // the crest band is a metre and a half from the eye at the gate, so
      // its clods are small: at full size they read as crates on a wall
      const n = y > 1 ? 18 : 26
      const k = y > 1 ? 0.42 : 1
      for (let i = 0; i < n; i++) {
        rubble.push({
          p: [(rand() - 0.5) * 5.2, y, z0 + rand() * (z1 - z0)],
          s: [
            k * (0.5 + rand() * 0.7),
            k * (0.26 + rand() * 0.4),
            k * (0.5 + rand() * 0.7),
          ],
          r: rand() * 3,
          tint: 0.66 + rand() * 0.4,
        })
      }
    }
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
      // the linen answers the same wind the flames answer, a beat later,
      // because wet cloth is heavy and the fire is not
      for (const l of laundry) {
        l.g.rotation.z = lift * (0.34 + 0.1 * Math.sin(l.ph)) + 0.04 * Math.sin(t * 0.6 + l.ph)
      }
      // and the dog sleeps through all of it
      dog.scale.set(1, 1 + 0.03 * Math.sin(t * 0.72), 1 + 0.022 * Math.sin(t * 0.72))
    },
  }
}
