/** THE CHAMBER THAT SHOWS WHAT HAPPENS INSIDE IT.
 *
 * The dossier builds a shut box, and a shut box withholds the only thing the
 * sheet describes. So this machine carries a demonstration beside its parts:
 * a lit candle standing outside the front face, and the candle's image on the
 * white paper at the back, dim, upside down and mirrored, sized by the hole's
 * own geometry. Both belong to the museum, not to Manuscript D: they are
 * built here and not in the dossier, so the record stays what the sheet says
 * and the machine on the hall's floor keeps the silhouette, the plinth and
 * the clearance it was certified with.
 *
 * WHERE THE BOX OPENS. Only where it is looked at closely. The room's machine
 * is the vitrine's machine, lent to the turntable and handed back, so the body
 * watches its own parent: under the table it stands turned to its front, with
 * the near corner off and the demonstration lit; under the room it is the shut
 * box on its plinth.
 */
import {
  AdditiveBlending, Box3, Color, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, RingGeometry, SphereGeometry,
  type BufferGeometry, type Material,
} from 'three/webgpu'
import type { Stack } from '../../../stack'
import { machineCatalog } from './catalog'
import { makeMachine, type ReadyMachineBuild } from './runtime'

/** The dossier's own numbers, read from `data/camera-obscura.json`: the hole
 * sits in the front plate, the paper stands at the back of the chamber. The
 * 0.64 m of the card is the box's outer depth, never the throw. */
const HOLE_Y = 0.62
const PLATE_Z = -0.015
const PAPER_Z = 0.5
/** The throw, hole to paper, and the candle's distance the other way. */
const THROW = PAPER_Z - PLATE_Z
const SOURCE_U = 0.35
/** Image height = object height times the throw over the object's distance. */
const MAGNIFY = THROW / SOURCE_U
const SOURCE_Z = PLATE_Z - SOURCE_U
/** A flat picture on the paper, not a solid standing in front of it. */
const FLATTEN = 0.02
const IMAGE_Z = PAPER_Z - 0.003
/** How far the candle travels either side of the hole over one turn. Held so
 * the image, which travels 1.47 times as far the other way, stays on the part
 * of the paper the cutaway leaves open. */
const SWEEP = 0.15
const PERIOD = 12
/** WHERE A HAND CAN LAND ON THE HOLE, AND WHAT MARKS IT. The bore is 2 mm in a
 * 1.24 m box, about one pixel of the whole view and three at the plate, so two
 * bodies stand at it and neither is ever drawn: a ball the hand can reach,
 * which keeps its width from every bearing, and a flat ring the light marks
 * the place with, open in the middle so the mark never covers the hole. */
/* The reach is the hand's, not the eye's: at the table's own distance the old
 * ball came to 20 by 22 CSS pixels on a 390 px stage, under the 44 a thumb
 * needs, so it is grown until it measures over 44 both ways. The ring the
 * light marks the place with does not move: the drawn hole is unchanged. */
const HOLE_REACH = 0.082
const HOLE_MARK = { inner: 0.014, outer: 0.037, front: 0.004 }

/** The vitrine's own eye stands at yaw 35 degrees off the world's +z, and the
 * chamber's hole faces the other way, because the hall's visitor meets it from
 * the front. So the body is turned half a circle on the table: the eye then
 * stands 35 degrees off the optical axis on the front left, where the candle
 * is never behind a wall, the paper is read at 0.82 of its width, and the
 * sight line into the chamber goes straight through the opened corner. Half a
 * circle is also the only turn that leaves the body's box where it was, so the
 * table's one measurement frames the turned pose as tightly as the shut one. */
const TABLE_YAW = Math.PI
const TABLE_PARENT = 'vitrine/turntable'
/** The near corner, from that eye, and the back. The roof stays on: the
 * chamber has to read dark for a dim image to read at all. The back comes off
 * because the sheet says the paper is very thin and seen from the reverse,
 * which is where the close viewpoint on the paper stands. */
const CUTAWAY = ['left-wall', 'front-left', 'back-wall']

function candleParts(): { id: string; geometry: BufferGeometry; y: number; lit: boolean }[] {
  const flame = new SphereGeometry(0.05, 18, 12)
  flame.scale(0.62, 1.35, 0.62)
  return [
    { id: 'flame', geometry: flame, y: 0.125, lit: true },
    { id: 'candle', geometry: new CylinderGeometry(0.036, 0.04, 0.26, 20, 1), y: -0.07, lit: true },
    { id: 'post', geometry: new CylinderGeometry(0.018, 0.022, 0.42, 12, 1), y: -0.41, lit: false },
    { id: 'foot', geometry: new CylinderGeometry(0.11, 0.12, 0.024, 20, 1), y: -0.608, lit: false },
  ]
}

export function build(stack: Stack): ReadyMachineBuild {
  const base = makeMachine(stack, machineCatalog['camera-obscura'])
  const owned: (BufferGeometry | Material)[] = []
  const keep = <T extends BufferGeometry | Material>(thing: T): T => { owned.push(thing); return thing }

  const wax = keep(new MeshStandardNodeMaterial({ color: new Color('#e8ddc6'), roughness: 0.62, metalness: 0 }))
  const iron = keep(new MeshStandardNodeMaterial({ color: new Color('#3f4347'), roughness: 0.52, metalness: 0.4 }))
  const fire = keep(new MeshBasicNodeMaterial({ color: new Color('#ffc063'), toneMapped: false }))
  /** The image is light landing on paper, so it is added to the paper rather
   * than painted over it, and it writes no depth. */
  const cast = (opacity: number, colour: string): MeshBasicNodeMaterial => keep(new MeshBasicNodeMaterial({
    color: new Color(colour), transparent: true, opacity, depthWrite: false, side: DoubleSide,
    blending: AdditiveBlending, fog: false, toneMapped: false,
  }))
  const castFlame = cast(0.95, '#ffcf86')
  const castWax = cast(0.3, '#d8c49a')

  const stage = new Group()
  stage.name = 'vinci/camera-obscura/stage'
  const demonstration = new Group()
  demonstration.name = 'vinci/camera-obscura/demonstration'
  const subject = new Group()
  subject.name = 'vinci/camera-obscura/source'
  subject.position.set(0, HOLE_Y, SOURCE_Z)
  // ONE PICTURE, ON BOTH FACES OF ONE SHEET. The paper is very thin and is
  // read from the reverse, so the image stands a breath in front of it and a
  // breath behind it; the sheet's own depth hides whichever side is away.
  const carried: Group[] = []
  // Both faces hang from one named body: a tap on either is the same picture.
  const picture = new Group()
  picture.name = 'vinci/camera-obscura/image'
  const faces = [IMAGE_Z, PAPER_Z + 0.003].map((z, side) => {
    const image = new Group()
    image.name = `vinci/camera-obscura/image-${side === 0 ? 'front' : 'reverse'}`
    image.position.set(0, HOLE_Y, z)
    // The pinhole map: every point about the hole lands scaled and turned half
    // a circle, which is the upside down and the mirror in one transform.
    image.scale.set(-MAGNIFY, -MAGNIFY, FLATTEN)
    const carrier = new Group()
    image.add(carrier)
    carried.push(carrier)
    return image
  })
  for (const part of candleParts()) {
    keep(part.geometry)
    const solid = new Mesh(part.geometry, part.id === 'flame' ? fire : part.lit ? wax : iron)
    solid.name = `vinci/camera-obscura/${part.id}`
    solid.position.y = part.y
    subject.add(solid)
    if (!part.lit) continue
    for (const carrier of carried) {
      const thrown = new Mesh(part.geometry, part.id === 'flame' ? castFlame : castWax)
      thrown.name = `vinci/camera-obscura/${part.id}-image`
      thrown.position.y = part.y
      thrown.renderOrder = 6
      carrier.add(thrown)
    }
  }
  picture.add(...faces)
  /* The hole's own body: nothing draws either mesh, the vitrine hits the ball
     because it is flagged as a mark built to be tapped, and the light lands on
     the ring alone. */
  const hole = new Group()
  hole.name = 'vinci/camera-obscura/hole'
  hole.position.set(0, HOLE_Y, PLATE_Z)
  const unseen = (): MeshBasicNodeMaterial => {
    const material = keep(new MeshBasicNodeMaterial({ color: new Color('#f2c77a'), side: DoubleSide }))
    material.visible = false
    return material
  }
  const reach = new Mesh(keep(new SphereGeometry(HOLE_REACH, 16, 12)), unseen())
  reach.name = 'vinci/camera-obscura/hole-reach'
  reach.userData['vitrineTarget'] = true
  const mark = new Mesh(keep(new RingGeometry(HOLE_MARK.inner, HOLE_MARK.outer, 48)), unseen())
  mark.name = 'vinci/camera-obscura/hole-mark'
  mark.position.z = -HOLE_MARK.front
  hole.add(reach, mark)
  hole.userData['assetClass'] = 'GENERATED'
  demonstration.add(subject, picture, hole)
  demonstration.visible = false
  // A MOVING CASTER IS A SHADOW MAP RE-RENDERED EVERY FRAME, and the frame
  // that catches it mid render lights the whole chamber. The candle throws no
  // shadow: what darkens the paper is the chamber the table never moves.
  demonstration.traverse(node => { node.castShadow = false; node.receiveShadow = false })
  stage.add(demonstration)
  base.object.add(stage)

  /** Turning half a circle about the body's own box centre puts every corner
   * back where it was, so the table measures one box for both poses. */
  const turn = { x: 0, z: 0 }
  function measureTurn(): void {
    const box = new Box3().setFromObject(stage)
    if (box.isEmpty()) return
    box.applyMatrix4(new Matrix4().copy(base.object.matrixWorld).invert())
    turn.x = box.min.x + box.max.x
    turn.z = box.min.z + box.max.z
  }

  let asked = false
  let showing: boolean | null = null
  let applied = false

  /** The assembly arrives after the first frames, so the near corner is taken
   * off again the moment the parts exist. */
  function cutaway(open: boolean): boolean {
    let found = 0
    for (const id of CUTAWAY) {
      const part = base.part?.(id)
      if (part) { part.node.visible = !open; found++ }
    }
    return found === CUTAWAY.length
  }
  function show(open: boolean): void {
    if (showing === open && applied) return
    showing = open
    demonstration.visible = open
    // The table lends itself every caster in the body, so the candle says no
    // again on the frame it is shown.
    if (open) demonstration.traverse(node => { node.castShadow = false })
    stage.rotation.y = open ? TABLE_YAW : 0
    stage.position.set(open ? turn.x : 0, 0, open ? turn.z : 0)
    applied = cutaway(open)
  }
  const wanted = (): boolean => asked || base.object.parent?.name === TABLE_PARENT

  return {
    ...base,
    object: base.object,
    ready: base.ready.then(() => {
      // The dossier's assembly arrives on the root; it joins the stage so the
      // chamber and the demonstration turn as one body.
      for (const child of [...base.object.children]) if (child !== stage) stage.add(child)
      stage.rotation.y = 0
      stage.position.set(0, 0, 0)
      base.object.updateMatrixWorld(true)
      measureTurn()
      showing = null
      show(wanted())
    }),
    animate(t, dt) {
      base.animate(t, dt)
      show(wanted())
      if (!demonstration.visible) return
      const across = Math.sin((2 * Math.PI * (t % PERIOD)) / PERIOD) * SWEEP
      subject.position.x = across
      for (const carrier of carried) carrier.position.x = across
    },
    section(enabled) { asked = enabled; show(wanted()) },
    part(id) { return base.part?.(id) ?? null },
    dispose() {
      base.dispose()
      stage.clear()
      for (const thing of owned) thing.dispose()
      owned.length = 0
    },
  }
}

/** What a reader of this file should be able to check without running it. */
export const CAMERA_OBSCURA_OPTICS = { throwM: THROW, sourceDistanceM: SOURCE_U, magnification: MAGNIFY } as const
