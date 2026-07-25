/* THE PRAETORIUM — the commander's tent at the far end of the via, the one
   warm thing on a dark planet. His inner citadel, and the Hearth law made
   architecture: nothing else here is a lantern.

   And THE DESK: an open codex, an ink pot, a stylus, the smallest flame in
   the world. The tent is lived in, which is the whole argument — a chest,
   a folded cloak, a cuirass set down for the night, a second tablet still
   open. */

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
  Vector3,
} from 'three/webgpu'
import { field, type FieldItem, MAP } from './hour'
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
    // the oil lamp: a clay body, a wick, the smallest flame in the world
    const lampBody = new Mesh(new SphereGeometry(0.085, 12, 8), P.lamp)
    lampBody.scale.set(1, 0.55, 1.25)
    lampBody.position.copy(mp(D.x - 0.52, 0.665, D.z - 0.1))
    add(lampBody)
    const spout = new Mesh(new ConeGeometry(0.035, 0.09, 8), P.lamp)
    spout.rotation.x = -Math.PI / 2
    spout.position.copy(mp(D.x - 0.52, 0.665, D.z + 0.03))
    add(spout)
    // the folding stool
    for (const sx of [-1, 1]) {
      for (const d of [-1, 1]) {
        const bar = new Mesh(new CylinderGeometry(0.018, 0.018, 0.56, 5), P.timber)
        bar.position.copy(mp(D.x + sx * 0.3, 0.24, D.z + 0.85))
        bar.rotation.x = d * 0.5
        add(bar)
      }
    }
    // the tent is lived in
    const rug = new Mesh(new PlaneGeometry(3.1, 2.6), P.rug)
    rug.rotation.x = -Math.PI / 2
    rug.position.copy(mp(D.x - 0.2, 0.045, D.z + 0.7))
    add(rug)
    const chest = new Mesh(new BoxGeometry(0.9, 0.44, 0.5), P.timber)
    chest.position.copy(mp(D.x - 1.9, 0.22, D.z + 0.3))
    chest.rotation.y = 0.18
    add(chest)
    const lid = new Mesh(new CylinderGeometry(0.25, 0.25, 0.9, 10, 1, false, 0, Math.PI), P.timber)
    lid.rotation.z = Math.PI / 2
    lid.position.copy(mp(D.x - 1.9, 0.44, D.z + 0.3))
    lid.rotation.y = 0.18
    add(lid)
    const cloak = new Mesh(new SphereGeometry(0.26, 10, 8, 0, 6.28, 0, 1.7), P.cloak)
    cloak.scale.set(1.25, 0.78, 1.0)
    cloak.position.copy(mp(D.x + 0.34, 0.52, D.z + 1.05))
    add(cloak)
    const tablet = new Mesh(new BoxGeometry(0.26, 0.02, 0.2), P.timber)
    tablet.position.copy(mp(D.x + 0.9, 0.655, D.z + 0.24))
    tablet.rotation.y = -0.5
    add(tablet)
    // his cuirass on a stand, set down for the night
    const cuir = new Mesh(new CylinderGeometry(0.19, 0.22, 0.44, 10, 1, true), P.cuirass)
    cuir.position.copy(mp(D.x + 1.5, 0.72, D.z - 0.5))
    add(cuir)
    const stand = new Mesh(new CylinderGeometry(0.03, 0.05, 0.5, 6), P.timber)
    stand.position.copy(mp(D.x + 1.5, 0.25, D.z - 0.5))
    add(stand)
  }

  return group
}
