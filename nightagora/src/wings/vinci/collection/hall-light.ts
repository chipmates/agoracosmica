/** THE HALL'S LIGHT FOR THE FILM: the north clerestory's daylight and the
 * museum's own spots on the beams, each throwing a shadow, so every machine
 * stands on its floor and is modelled by a direction instead of by an even
 * fill. Modern exhibition lighting; nothing here claims a light of 1517.
 *
 * Four shadowed lights and no more: every lit surface of the wing samples
 * every shadow map in one shader stage, and the stage holds sixteen textures.
 */
import { BoxGeometry, Color, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, Object3D, SpotLight } from 'three/webgpu'
import { kelvinToColour } from '../../../stack/light'
import { FACE, FLOOR, OPENING } from './layout'

/** The layer only the hall's spots cast from: no eye and no sun sees it. */
const DOOR_LAYER = 3

/** The hall's roof falls south from its clerestory; its beams follow it. */
const hallSoffit = (north: number): number => 1.05 - .75 * (-42.5 - north) / 22.2
/** What the hall's five point fittings give once the eye stands in the hall. */
export const HALL_FILL = 1.4
/** Where a spot hangs under a beam: the beam's soffit less its own depth. */
const underBeam = (north: number): number => hallSoffit(north) - .34 - .29 - .18

interface HallSpot {
  name: string
  at: [number, number, number]
  aim: [number, number, number]
  colour: Color
  intensity: number
  angle: number
  penumbra: number
  decay: number
  reach: number
  /** zero for an accent that throws no shadow */
  mapPx: number
}

export const HALL_LIGHT_PROVENANCE = {
  manifestId: 'vinci/collection-rooms', assetClass: 'GENERATED', certainty: 'reconstructed',
  recipe: 'Modern exhibition lighting of the mechanism hall: two broad 7200 K sources under the north clerestory and three 3300 to 3400 K spots on the beams, two of them and both clerestory sources casting shadows. A lighting design choice; no light of 1517 is claimed.',
} as const

/** East, north, height in the wing's metres; the world reads [east, height, -north]. */
export const HALL_SPOTS: readonly HallSpot[] = [
  // THE CLERESTORY. Two broad sources just inside the north glazing, under
  // its light shelf, falling south across the whole floor. Sky light is a
  // large source, so its shadow map is coarse on purpose: the edge softens.
  // The east one is held down and turned off the aisle: the two stops
  // stand under it, and a bright floor at the feet outshines the machines.
  ...([[-56.2, -57.7, -48.5, 20], [-46.4, -47.6, -51.5, 12]] as const).map(([east, aimEast, aimNorth, intensity], i): HallSpot => ({
    name: `clerestory-${i}`, at: [east, FACE.pictureWallSouth - .5, -1.95], aim: [aimEast, aimNorth, FLOOR],
    colour: kelvinToColour(7200), intensity, angle: .74, penumbra: 1, decay: 1, reach: 34, mapPx: 512,
  })),
  // THE SPOTS ON THE BEAMS: the screw from the aisle side, and the two water
  // and metal machines the second stop looks along.
  { name: 'spot-screw', at: [-53.4, -50, underBeam(-50)], aim: [-57, -45.6, FLOOR + 2.1],
    colour: kelvinToColour(3300), intensity: 270, angle: .5, penumbra: .75, decay: 2, reach: 10.2, mapPx: 1024 },
  { name: 'spot-works', at: [-46.2, -46, underBeam(-46)], aim: [-49, -44.9, FLOOR + 1],
    colour: kelvinToColour(3300), intensity: 170, angle: .6, penumbra: .8, decay: 2, reach: 18, mapPx: 1024 },
  // One narrow accent without a map of its own, on the gates across the
  // aisle. It throws no shadow, so its cone is turned away from every wall
  // with a room behind it and cut off before it could pass one.
  { name: 'accent-gates', at: [-52.4, -50, underBeam(-50)], aim: [-55.5, -51.2, FLOOR + 1.3],
    colour: kelvinToColour(3400), intensity: 90, angle: .36, penumbra: .85, decay: 2, reach: 9, mapPx: 0 },
]

/** A SPOT AIMED ACROSS THE HALL LOOKS THROUGH ITS DOORS. The screw's spot
 * points at the picture room's door behind it, and the rooms beyond are not
 * this lighting's to change. So each door carries a leaf only these spots'
 * shadow maps can see, built at mount like the rest of the hall's fixed body. */
function doorLeaves(): Mesh[] {
  const material = new MeshBasicNodeMaterial({ side: DoubleSide })
  material.name = 'vinci/collection-rooms/hall-door-leaf'
  const top = -1.7
  const leaf = (west: number, east: number, south: number, north: number): Mesh => {
    const mesh = new Mesh(new BoxGeometry(east - west, top - FLOOR, north - south), material)
    mesh.position.set((west + east) / 2, (FLOOR + top) / 2, -(south + north) / 2)
    mesh.name = 'vinci/collection-rooms/hall-door-leaf'
    mesh.userData = { ...HALL_LIGHT_PROVENANCE }
    mesh.layers.set(DOOR_LAYER)
    mesh.castShadow = true; mesh.receiveShadow = false
    mesh.updateMatrixWorld(true)
    return mesh
  }
  const across = [FACE.hallPartitionWest + .04, FACE.hallPartitionEast - .04] as const
  return [
    leaf(OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1], FACE.pictureWallSouth + .04, FACE.pictureWallNorth - .04),
    leaf(across[0], across[1], OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1]),
    leaf(across[0], across[1], OPENING.hallToSouth.north[0], OPENING.hallToSouth.north[1]),
  ]
}

/** The hall's shadowed lights, standing from the first frame: a light that
 * joins the scene later relinks every lit surface in view. */
export function mountHallLight(host: Group): { dispose(): void } {
  const lights: SpotLight[] = [], targets: Object3D[] = []
  const leaves = doorLeaves()
  host.add(...leaves)
  for (const spec of HALL_SPOTS) {
    const light = new SpotLight(spec.colour, spec.intensity, spec.reach, spec.angle, spec.penumbra, spec.decay)
    light.name = `vinci/collection-rooms/hall-${spec.name}`
    light.userData = HALL_LIGHT_PROVENANCE
    light.position.set(spec.at[0], spec.at[2], -spec.at[1])
    const target = new Object3D()
    target.position.set(spec.aim[0], spec.aim[2], -spec.aim[1])
    light.target = target
    light.castShadow = spec.mapPx > 0
    light.shadow.mapSize.set(Math.max(spec.mapPx, 256), Math.max(spec.mapPx, 256))
    light.shadow.camera.near = .25
    light.shadow.camera.far = spec.reach
    light.shadow.bias = -.0004
    light.shadow.normalBias = .025
    light.shadow.camera.layers.enable(DOOR_LAYER)
    host.add(light, target)
    lights.push(light); targets.push(target)
  }
  // THE MAPS ARE DRAWN EVERY FRAME, wherever the eye is. A map held from a
  // frame in which the rooms were not yet drawn has no wall in it, and the
  // spots then shine through every wall into the rooms beside the hall.
  return {
    dispose() {
      for (const light of lights) { light.removeFromParent(); light.dispose() }
      for (const target of targets) target.removeFromParent()
      for (const leaf of leaves) { leaf.removeFromParent(); leaf.geometry.dispose() }
      const leafMaterial = leaves[0]?.material
      if (leafMaterial instanceof MeshBasicNodeMaterial) leafMaterial.dispose()
    },
  }
}
