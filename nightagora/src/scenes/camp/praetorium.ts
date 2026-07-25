/* THE PRAETORIUM — the commander's tent at the far end of the via, the one
   warm thing on a dark planet. His inner citadel, and the Hearth law made
   architecture: nothing else here is a lantern.

   And THE DESK: an open codex, an ink pot, a stylus, the smallest flame in
   the world. The tent is lived in, which is the whole argument — a chest,
   a folded cloak, a cuirass set down for the night, a second tablet still
   open.

   THE OBJECTS OF A MAN WHO WRITES AT NIGHT (2026-07-25): the dispatches
   that came up the river, the scroll case they live in, the tablets he
   answers them on, the supper somebody left and he has not finished, the
   pan of coals against a March night on the Danube, and his armour set
   down two steps away, because none of this is a study. It is a tent, and
   at first light he goes back out. */

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
import { field, type FieldItem, inkMaterial, MAP } from './hour'
import { openPrism } from './fort'
import { palette } from './materials'

const mp = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z)

export function createPraetorium(rand: () => number): Group {
  const P = palette()
  const group = new Group()
  const add = <T extends Mesh | Group>(m: T): T => {
    group.add(m)
    return m
  }
  const T = MAP.praetorium
  const D = MAP.desk

  /* the two surfaces this tent needs that the camp outside does not: the
     wax he writes on, and the iron on his chest and his blade */
  const inner = {
    wax: inkMaterial({ rim: 0.5, albedo: '#6E5F4A', baseK: 0.46, facePow: 1.4 }),
    iron: inkMaterial({ rim: 1.15, albedo: '#7E7A76', baseK: 0.44, facePow: 3.2 }),
  }

  // ------------------------------------------------------------ THE TENT
  {
    const body = new Mesh(openPrism(T.w, T.h, T.d), P.praetorium)
    body.position.copy(mp(T.x, 0, T.z))
    add(body)
    // the back gable, so the tent is a room and not a tunnel
    const gable = new Mesh(
      (() => {
        const g = new BufferGeometry()
        const w = T.w / 2
        g.setAttribute('position', new Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, T.h, 0], 3))
        g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
        g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
        return g
      })(),
      P.praetorium
    )
    gable.position.copy(mp(T.x, 0, T.z - T.d / 2 + 0.02))
    add(gable)
    // the parted flaps: the wedge of gold that spills onto the via
    for (const sx of [-1, 1]) {
      const flap = new Mesh(new PlaneGeometry(0.82, T.h * 0.42), P.flap)
      flap.position.copy(mp(T.x + sx * 3.14, T.h * 0.21, T.z + T.d / 2 + 0.5))
      flap.rotation.y = -sx * 1.02
      add(flap)
    }
    // the ridge pole and the guy stakes: a tent is a rigging
    const ridge = new Mesh(new CylinderGeometry(0.07, 0.07, T.d + 0.34, 6), P.timber)
    ridge.rotation.x = Math.PI / 2
    ridge.position.copy(mp(T.x, T.h - 0.03, T.z))
    add(ridge)
    for (const sx of [-1, 1]) {
      // the doorway posts stand at the flaps, never down the middle of the
      // frame: the composition wants the lamp on the axis, not a pole
      const front = new Mesh(new CylinderGeometry(0.06, 0.075, T.h * 0.78, 6), P.timber)
      front.position.copy(mp(T.x + sx * 3.05, T.h * 0.39, T.z + T.d / 2 + 0.35))
      add(front)
      const guys: FieldItem[] = []
      for (let i = 0; i < 5; i++) {
        guys.push({
          p: [T.x + sx * (T.w / 2 + 0.85), 0.16, T.z - T.d / 2 + 0.6 + i * 1.2],
          s: [1, 1, 1],
          r: rand(),
        })
      }
      add(field(new CylinderGeometry(0.03, 0.04, 0.34, 5).translate(0, 0.17, 0), P.timberI, guys))
    }
    // the interior floor, where the lamp lands
    const floor = new Mesh(new PlaneGeometry(T.w * 0.9, T.d * 0.9), P.floor)
    floor.rotation.x = -Math.PI / 2
    floor.position.copy(mp(T.x, 0.03, T.z))
    add(floor)

    /* THE SIDE GUYS — the stakes were already in the ground and nothing
       reached them, which is the one thing that reads as unbuilt. A rope
       runs from a loop sewn at mid-slope down to each of them. The lean is
       baked into the geometry, because an instanced field carries one yaw
       and no tilt. */
    const ropes: FieldItem[] = []
    const HOLD = 2.3
    const rise = 1.25 - 0.16
    const run = T.w / 2 + 0.85 - HOLD
    const L = Math.hypot(run, rise)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        ropes.push({
          p: [T.x + sx * (T.w / 2 + 0.85), 0.2, T.z - T.d / 2 + 0.6 + i * 1.2],
          s: [L, L, L],
          r: -sx * (Math.PI / 2),
          tint: 0.85 + rand() * 0.25,
        })
      }
    }
    add(
      field(
        (() => {
          const g = new CylinderGeometry(0.011, 0.02, 1, 4)
          g.translate(0, 0.5, 0)
          g.rotateX(Math.atan2(run, rise))
          return g
        })(),
        P.timberI,
        ropes
      )
    )

    /* THE DOORWAY — his shield and a pilum stood against the right post,
       where a man puts them down on the way in */
    {
      const px = T.x + 3.05
      const pz = T.z + T.d / 2 + 0.35
      const shield = new Mesh(
        new CylinderGeometry(0.42, 0.42, 1.02, 12, 1, true, -0.85, 1.7),
        P.ochre
      )
      shield.position.copy(mp(px - 0.3, 0.5, pz + 0.16))
      shield.rotation.y = 2.4
      shield.rotation.x = 0.2
      add(shield)
      const boss = new Mesh(new SphereGeometry(0.055, 8, 6), P.gilt)
      boss.scale.z = 0.6
      boss.position.copy(mp(px - 0.62, 0.55, pz + 0.29))
      add(boss)
      const pil = new Mesh(new CylinderGeometry(0.014, 0.018, 2.05, 5), P.timber)
      pil.position.copy(mp(px + 0.2, 1.0, pz - 0.1))
      pil.rotation.z = 0.14
      pil.rotation.x = -0.1
      add(pil)
      const head = new Mesh(new ConeGeometry(0.022, 0.16, 5), P.gilt)
      head.position.copy(mp(px + 0.35, 2.06, pz - 0.2))
      add(head)
    }
  }

  // ------------------------------------------------------------ THE DESK
  {
    const top = new Mesh(new BoxGeometry(1.5, 0.055, 0.78), P.timber)
    top.position.copy(mp(D.x, 0.62, D.z))
    add(top)
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as Array<[number, number]>) {
      const leg = new Mesh(new CylinderGeometry(0.035, 0.04, 0.62, 5), P.timber)
      leg.position.copy(mp(D.x + dx * 0.64, 0.31, D.z + dz * 0.29))
      add(leg)
    }
    // the open codex: two leaves at a reader's angle
    for (const sx of [-1, 1]) {
      const leaf = new Mesh(new BoxGeometry(0.34, 0.012, 0.44), P.parchment)
      leaf.position.copy(mp(D.x + sx * 0.18, 0.665, D.z + 0.02))
      leaf.rotation.z = -sx * 0.1
      add(leaf)
    }
    const spine = new Mesh(new BoxGeometry(0.05, 0.035, 0.44), P.timber)
    spine.position.copy(mp(D.x, 0.667, D.z + 0.02))
    add(spine)
    const pot = new Mesh(new CylinderGeometry(0.045, 0.052, 0.075, 10), P.timber)
    pot.position.copy(mp(D.x + 0.55, 0.685, D.z - 0.16))
    add(pot)
    const stylus = new Mesh(new CylinderGeometry(0.006, 0.009, 0.19, 5), P.timber)
    stylus.position.copy(mp(D.x + 0.42, 0.7, D.z + 0.2))
    stylus.rotation.z = 1.15
    stylus.rotation.y = 0.6
    add(stylus)

    /* THE NIGHT'S WORK — what came up the river today and what goes back
       down it in the morning. A desk with only a book on it is a prop. */
    // the dispatches, rolled, one of them still tied
    for (const [dx, dz, yaw, s] of [
      [-0.28, -0.28, 0.28, 1.0],
      [-0.2, -0.34, 0.34, 0.86],
      [0.62, 0.05, -1.25, 0.92],
    ] as Array<[number, number, number, number]>) {
      const roll = new Mesh(new CylinderGeometry(0.021, 0.021, 0.3, 8), P.parchment)
      roll.scale.setScalar(s)
      roll.rotation.z = Math.PI / 2
      roll.rotation.y = yaw
      roll.position.copy(mp(D.x + dx, 0.657, D.z + dz))
      add(roll)
    }
    const tie = new Mesh(new TorusGeometry(0.022, 0.005, 4, 10), P.ochre)
    tie.rotation.y = 0.28
    tie.position.copy(mp(D.x - 0.28, 0.657, D.z - 0.28))
    add(tie)
    // the wax tablets he answers them on: a stack, and one left open
    for (let i = 0; i < 3; i++) {
      const t = new Mesh(new BoxGeometry(0.24, 0.017, 0.19), P.timber)
      t.position.copy(mp(D.x + 0.52 + i * 0.006, 0.657 + i * 0.019, D.z + 0.26 + i * 0.008))
      t.rotation.y = -0.42 + i * 0.05
      add(t)
    }
    const openTablet = new Mesh(new BoxGeometry(0.23, 0.012, 0.18), inner.wax)
    openTablet.position.copy(mp(D.x + 0.52, 0.716, D.z + 0.26))
    openTablet.rotation.y = -0.3
    add(openTablet)
    // the pen knife, laid across the ink pot's shadow
    const knife = new Mesh(new BoxGeometry(0.085, 0.005, 0.014), inner.iron)
    knife.position.copy(mp(D.x + 0.46, 0.658, D.z - 0.06))
    knife.rotation.y = 0.9
    add(knife)
    const grip = new Mesh(new CylinderGeometry(0.008, 0.009, 0.05, 5), P.timber)
    grip.rotation.z = Math.PI / 2
    grip.rotation.y = 0.9
    grip.position.copy(mp(D.x + 0.41, 0.66, D.z - 0.1))
    add(grip)

    /* THE SUPPER SOMEBODY LEFT — a cup, a plate, half a loaf. He is not a
       statue and he has been up since the fourth watch. */
    const plate = new Mesh(new CylinderGeometry(0.1, 0.085, 0.016, 12), P.pot)
    plate.position.copy(mp(D.x - 0.16, 0.653, D.z + 0.3))
    add(plate)
    const loaf = new Mesh(new SphereGeometry(0.06, 9, 7), P.parchment)
    loaf.scale.set(1, 0.6, 0.85)
    loaf.position.copy(mp(D.x - 0.17, 0.672, D.z + 0.3))
    add(loaf)
    const cup = new Mesh(new CylinderGeometry(0.037, 0.03, 0.075, 10), P.pot)
    cup.position.copy(mp(D.x - 0.02, 0.682, D.z + 0.29))
    add(cup)
    // the oil lamp: a clay body, a wick, the smallest flame in the world
    const lampBody = new Mesh(new SphereGeometry(0.085, 12, 8), P.lamp)
    lampBody.scale.set(1, 0.55, 1.25)
    lampBody.position.copy(mp(D.x - 0.52, 0.665, D.z - 0.1))
    add(lampBody)
    const spout = new Mesh(new ConeGeometry(0.035, 0.09, 8), P.lamp)
    spout.rotation.x = -Math.PI / 2
    spout.position.copy(mp(D.x - 0.52, 0.665, D.z + 0.03))
    add(spout)
    /* THE FOLDING CHAIR — four crossed bars was a diagram of a stool. A
       sella castrensis is a leather sling on an X of oak, and it is the
       one seat in this world. */
    {
      // pushed back from the desk and off its axis: at the desk station the
      // seat is a metre from the eye, and dead centre it becomes the
      // subject of the frame instead of his codex
      const cx = D.x + 0.36
      const cz = D.z + 0.84
      for (const sx of [-1, 1]) {
        for (const d of [-1, 1]) {
          const bar = new Mesh(new CylinderGeometry(0.019, 0.019, 0.62, 5), P.timber)
          bar.position.copy(mp(cx + sx * 0.27, 0.26, cz))
          bar.rotation.x = d * 0.52
          add(bar)
        }
      }
      // the seat is a slung hide, and a hide is a SURFACE. Two rounds of
      // sphere segments here read as a sausage lying across the front of
      // his desk, which is the whole reason the loop exists.
      const sling = new Mesh(new BoxGeometry(0.4, 0.035, 0.36), P.hide)
      sling.position.copy(mp(cx, 0.5, cz))
      sling.rotation.x = 0.05
      sling.rotation.y = 0.34
      add(sling)
      const lip = new Mesh(new BoxGeometry(0.42, 0.06, 0.05), P.hide)
      lip.position.copy(mp(cx + 0.06, 0.485, cz + 0.18))
      lip.rotation.y = 0.34
      add(lip)
      // the cloth thrown over the seat: bare leather this close to the eye
      // is a table top, and he does not eat at his desk
      const throwCloth = new Mesh(new PlaneGeometry(0.32, 0.28), P.cloak)
      throwCloth.rotation.x = -Math.PI / 2 + 0.06
      throwCloth.rotation.z = 0.34
      throwCloth.position.copy(mp(cx - 0.02, 0.525, cz - 0.02))
      add(throwCloth)
      for (const dz of [-1, 1]) {
        const rail = new Mesh(new CylinderGeometry(0.016, 0.016, 0.58, 5), P.timber)
        rail.rotation.z = Math.PI / 2
        rail.position.copy(mp(cx, 0.5, cz + dz * 0.24))
        add(rail)
      }
    }

    // the tent is lived in
    const rug = new Mesh(new PlaneGeometry(3.1, 2.6), P.rug)
    rug.rotation.x = -Math.PI / 2
    rug.position.copy(mp(D.x - 0.2, 0.045, D.z + 0.7))
    add(rug)

    /* THE CHEST — banded, locked, and everything he owns on campaign is
       inside it. His sword lies on the lid, where a man puts it down. */
    const chest = new Mesh(new BoxGeometry(0.9, 0.44, 0.5), P.timber)
    chest.position.copy(mp(D.x - 1.9, 0.22, D.z + 0.3))
    chest.rotation.y = 0.18
    add(chest)
    const lid = new Mesh(new CylinderGeometry(0.25, 0.25, 0.9, 10, 1, false, 0, Math.PI), P.timber)
    lid.rotation.z = Math.PI / 2
    lid.position.copy(mp(D.x - 1.9, 0.44, D.z + 0.3))
    lid.rotation.y = 0.18
    add(lid)
    for (const dz of [-0.17, 0.17]) {
      const band = new Mesh(new BoxGeometry(0.93, 0.46, 0.045), inner.iron)
      band.position.copy(mp(D.x - 1.9 + Math.sin(0.18) * dz, 0.22, D.z + 0.3 + Math.cos(0.18) * dz))
      band.rotation.y = 0.18
      add(band)
    }
    const lock = new Mesh(new BoxGeometry(0.1, 0.13, 0.03), inner.iron)
    lock.position.copy(mp(D.x - 1.86, 0.3, D.z + 0.56))
    lock.rotation.y = 0.18
    add(lock)
    // his gladius, scabbard down, on the lid
    const scab = new Mesh(new BoxGeometry(0.075, 0.036, 0.66), P.hide)
    scab.position.copy(mp(D.x - 1.86, 0.68, D.z + 0.26))
    scab.rotation.y = 0.55
    scab.rotation.x = 0.04
    add(scab)
    const hilt = new Mesh(new CylinderGeometry(0.028, 0.026, 0.12, 8), P.timber)
    hilt.rotation.x = Math.PI / 2
    hilt.rotation.y = 0.55
    hilt.position.copy(mp(D.x - 2.05, 0.7, D.z + 0.58))
    add(hilt)
    const pommel = new Mesh(new SphereGeometry(0.032, 8, 6), P.gilt)
    pommel.position.copy(mp(D.x - 2.09, 0.7, D.z + 0.64))
    add(pommel)

    // the second cloak, folded on the floor: moved off the seat's ground
    // once the chair became a chair, because the two were standing in each
    // other (a frame catches that, a file never does)
    const cloak = new Mesh(new SphereGeometry(0.26, 10, 8, 0, 6.28, 0, 1.7), P.cloak)
    cloak.scale.set(1.25, 0.78, 1.0)
    cloak.position.copy(mp(D.x - 1.5, 0.52, D.z + 1.08))
    add(cloak)
    // the second tablet, ON the desk this time: it used to float a hand
    // past the right edge, which is exactly the kind of thing a frame
    // shows and code never does
    const tablet = new Mesh(new BoxGeometry(0.26, 0.02, 0.2), P.timber)
    tablet.position.copy(mp(D.x + 0.62, 0.655, D.z - 0.24))
    tablet.rotation.y = -0.5
    add(tablet)

    /* HIS ARMOUR, set down for the night: a cuirass on its stand, the
       shoulder pieces still buckled, and the helmet on top of it. Two
       steps from the desk, because he is a soldier who writes and not a
       philosopher who campaigns. */
    const cuir = new Mesh(new CylinderGeometry(0.19, 0.22, 0.44, 10, 1, true), P.cuirass)
    cuir.position.copy(mp(D.x + 1.5, 0.72, D.z - 0.5))
    add(cuir)
    // the shoulder yoke, then the caps on it: two loose domes read as lumps
    const yoke = new Mesh(new BoxGeometry(0.46, 0.075, 0.24), P.cuirass)
    yoke.position.copy(mp(D.x + 1.5, 0.9, D.z - 0.5))
    add(yoke)
    for (const sx of [-1, 1]) {
      const pauldron = new Mesh(new SphereGeometry(0.105, 10, 6, 0, 6.28, 0, 1.5), P.cuirass)
      pauldron.scale.set(1, 0.5, 0.9)
      pauldron.position.copy(mp(D.x + 1.5 + sx * 0.15, 0.92, D.z - 0.5))
      pauldron.rotation.z = sx * 0.32
      add(pauldron)
    }
    const helmet = new Mesh(new SphereGeometry(0.115, 12, 8, 0, 6.28, 0, 1.5), P.helm)
    helmet.scale.set(0.94, 1.05, 1)
    helmet.position.copy(mp(D.x + 1.5, 1.02, D.z - 0.5))
    add(helmet)
    // the neck guard, which is what stops a dome from reading as a mushroom
    const nape = new Mesh(new SphereGeometry(0.125, 10, 6, 0, 3.1, 1.1, 0.5), P.helm)
    nape.scale.set(0.95, 0.9, 1.2)
    nape.rotation.y = Math.PI / 2
    nape.position.copy(mp(D.x + 1.5, 1.02, D.z - 0.5))
    add(nape)
    const crest = new Mesh(new BoxGeometry(0.024, 0.062, 0.2), P.ochre)
    crest.position.copy(mp(D.x + 1.5, 1.14, D.z - 0.5))
    add(crest)
    const brow = new Mesh(new TorusGeometry(0.118, 0.012, 5, 14), P.helm)
    brow.rotation.x = Math.PI / 2
    brow.position.copy(mp(D.x + 1.5, 1.02, D.z - 0.5))
    add(brow)
    const stand = new Mesh(new CylinderGeometry(0.03, 0.05, 0.5, 6), P.timber)
    stand.position.copy(mp(D.x + 1.5, 0.25, D.z - 0.5))
    add(stand)

    /* THE SCROLL CASE — the whole correspondence of a frontier, standing
       open on the floor where he can reach into it without getting up. */
    {
      const cx = D.x - 1.05
      const cz = D.z - 0.15
      const capsa = new Mesh(new CylinderGeometry(0.18, 0.165, 0.44, 12, 1, true), P.timber)
      capsa.position.copy(mp(cx, 0.22, cz))
      add(capsa)
      const rim = new Mesh(new TorusGeometry(0.18, 0.014, 5, 14), inner.iron)
      rim.rotation.x = Math.PI / 2
      rim.position.copy(mp(cx, 0.44, cz))
      add(rim)
      const rollGeo = new CylinderGeometry(0.028, 0.028, 0.5, 8)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4
        const r = 0.055 + rand() * 0.06
        const roll = new Mesh(rollGeo, P.parchment)
        roll.position.copy(mp(cx + Math.cos(a) * r, 0.34 + rand() * 0.06, cz + Math.sin(a) * r))
        roll.rotation.z = Math.cos(a) * 0.16
        roll.rotation.x = -Math.sin(a) * 0.16
        add(roll)
      }
    }

    /* THE PAN OF COALS — it is March on the Danube and he writes with his
       hands. It carries no flame of its own: the coals only ever show what
       the tent's own light finds in them. */
    {
      const bx = D.x + 0.84
      const bz = D.z + 0.34
      const pan = new Mesh(new CylinderGeometry(0.16, 0.12, 0.13, 12, 1, true), P.bronze)
      pan.position.copy(mp(bx, 0.42, bz))
      add(pan)
      const panRim = new Mesh(new TorusGeometry(0.16, 0.016, 5, 14), P.bronze)
      panRim.rotation.x = Math.PI / 2
      panRim.position.copy(mp(bx, 0.48, bz))
      add(panRim)
      const embers = new Mesh(new SphereGeometry(0.13, 10, 6), P.coal)
      embers.scale.y = 0.4
      embers.position.copy(mp(bx, 0.44, bz))
      add(embers)
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.7
        const leg = new Mesh(new CylinderGeometry(0.014, 0.018, 0.4, 5), P.bronze)
        leg.position.copy(mp(bx + Math.cos(a) * 0.1, 0.2, bz + Math.sin(a) * 0.1))
        leg.rotation.z = -Math.cos(a) * 0.2
        leg.rotation.x = Math.sin(a) * 0.2
        add(leg)
      }
    }

    /* WHAT HANGS FROM THE CANVAS — a bar looped into the seam behind the
       desk, his marching cloak over it and the courier's satchel beside.
       Everything else in this tent is on the floor, and a room with
       nothing at eye height is a stage set. */
    {
      const hx = D.x + 0.35
      const hz = D.z - 0.72
      for (const sx of [-1, 1]) {
        const cord = new Mesh(new CylinderGeometry(0.013, 0.013, 0.68, 5), P.timber)
        cord.position.copy(mp(hx + sx * 0.33, 1.73, hz))
        add(cord)
      }
      const bar = new Mesh(new CylinderGeometry(0.024, 0.024, 0.86, 6), P.timber)
      bar.rotation.z = Math.PI / 2
      bar.position.copy(mp(hx, 1.39, hz))
      add(bar)
      /* the cloak in THREE falls, not one slab. Round 1 hung a single wide
         cylinder here and a phone read it as a banner: cloth needs an
         uneven hem and more than one fold before it stops being a flag. */
      /* A CLOAK IS A SILHOUETTE, not a surface treatment. At this distance
         no shading gradient survives, so what says cloth is the OUTLINE:
         three falls of different length and lean, and a thin roll where the
         wool goes over the timber. Flat panels read as a banner, one fat
         cylinder reads as a rolled carpet. Both were tried on frames. */
      for (const [dx, w, len, yaw] of [
        [-0.23, 0.112, 0.44, 0.2],
        [-0.1, 0.098, 0.54, -0.3],
        [0.02, 0.082, 0.37, 0.5],
      ] as Array<[number, number, number, number]>) {
        const fall = new Mesh(
          new CylinderGeometry(w * 0.82, w, len, 8, 1, true, 0.6, 3.9),
          P.cloak
        )
        fall.scale.set(1.25, 1, 0.66)
        fall.rotation.y = yaw
        fall.position.copy(mp(hx + dx, 1.37 - len / 2, hz))
        add(fall)
      }
      const fold = new Mesh(new CylinderGeometry(0.05, 0.05, 0.46, 10, 1, true), P.cloak)
      fold.rotation.z = Math.PI / 2
      fold.scale.set(1, 1, 1.2)
      fold.position.copy(mp(hx - 0.11, 1.39, hz))
      add(fold)
      // THE HANGING LAMP — bronze, on its own hook, and gold here is a
      // reflection and never a fill: it carries no flame of its own, it
      // only shows what his one wick is already doing
      const hook = new Mesh(new CylinderGeometry(0.006, 0.006, 0.22, 4), P.timber)
      hook.position.copy(mp(hx + 0.19, 1.28, hz))
      add(hook)
      const lampBowl = new Mesh(new SphereGeometry(0.075, 12, 8, 0, 6.28, 1.0, 1.1), P.bronze)
      lampBowl.scale.set(1, 0.9, 1)
      lampBowl.position.copy(mp(hx + 0.19, 1.14, hz))
      add(lampBowl)
      const lampRim = new Mesh(new TorusGeometry(0.062, 0.008, 4, 12), P.bronze)
      lampRim.rotation.x = Math.PI / 2
      lampRim.position.copy(mp(hx + 0.19, 1.18, hz))
      add(lampRim)
      const satchel = new Mesh(new BoxGeometry(0.19, 0.22, 0.085), P.hide)
      satchel.position.copy(mp(hx + 0.36, 1.21, hz))
      add(satchel)
      const flapTop = new Mesh(new BoxGeometry(0.2, 0.08, 0.095), P.hide)
      flapTop.position.copy(mp(hx + 0.36, 1.32, hz + 0.005))
      add(flapTop)
      const strap = new Mesh(new TorusGeometry(0.085, 0.008, 4, 12, Math.PI), P.hide)
      strap.position.copy(mp(hx + 0.36, 1.34, hz))
      add(strap)
    }

    /* THE WASHSTAND — a basin, a jug, and the reason a man on campaign
       still looks like a consul in the morning */
    {
      const wx = D.x - 1.95
      const wz = D.z - 1.0
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5
        const leg = new Mesh(new CylinderGeometry(0.018, 0.022, 0.66, 5), P.timber)
        leg.position.copy(mp(wx + Math.cos(a) * 0.15, 0.33, wz + Math.sin(a) * 0.15))
        leg.rotation.z = -Math.cos(a) * 0.24
        leg.rotation.x = Math.sin(a) * 0.24
        add(leg)
      }
      const basin = new Mesh(new SphereGeometry(0.19, 12, 8, 0, 6.28, 0, 1.5), P.bronze)
      basin.scale.y = 0.5
      basin.rotation.x = Math.PI
      basin.position.copy(mp(wx, 0.68, wz))
      add(basin)
      const jug = new Mesh(new SphereGeometry(0.1, 10, 8), P.pot)
      jug.scale.set(1, 1.25, 1)
      jug.position.copy(mp(wx + 0.34, 0.14, wz + 0.14))
      add(jug)
      const neck = new Mesh(new CylinderGeometry(0.035, 0.05, 0.11, 8), P.pot)
      neck.position.copy(mp(wx + 0.34, 0.3, wz + 0.14))
      add(neck)
    }

    /* HIS BOOTS, beside the chest, where they came off */
    for (const sx of [-1, 1]) {
      const boot = new Mesh(new SphereGeometry(0.075, 9, 7), P.hide)
      boot.scale.set(0.8, 0.85, 1.7)
      boot.position.copy(mp(D.x - 1.2 + sx * 0.11, 0.07, D.z + 0.72 + sx * 0.03))
      boot.rotation.y = sx * 0.24 - 0.2
      add(boot)
    }

    /* THE CURTAIN at the back of the tent: pulled aside, so the tent is a
       room he sleeps in and not a stage with a wall painted behind him */
    {
      const cur = new Mesh(new PlaneGeometry(1.5, 1.85, 4, 1), P.cloth)
      cur.position.copy(mp(T.x - 1.55, 0.92, T.z - T.d / 2 + 0.42))
      cur.rotation.y = 0.3
      add(cur)
      const cloth2 = new Mesh(new PlaneGeometry(0.7, 1.8), P.cloth)
      cloth2.position.copy(mp(T.x - 2.42, 0.9, T.z - T.d / 2 + 0.6))
      cloth2.rotation.y = 0.85
      add(cloth2)
      const rail = new Mesh(new CylinderGeometry(0.02, 0.02, 2.6, 5), P.timber)
      rail.rotation.z = Math.PI / 2
      rail.position.copy(mp(T.x - 1.7, 1.85, T.z - T.d / 2 + 0.45))
      add(rail)
    }
  }

  return group
}
