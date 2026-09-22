/** THE HALL'S LIGHT FOR THE FILM: the north clerestory's daylight and the
 * museum's own spots on the beams, each throwing a shadow, so every machine
 * stands on its floor and is modelled by a direction instead of by an even
 * fill. Modern exhibition lighting; nothing here claims a light of 1517.
 *
 * Four shadowed lights and no more: every lit surface of the wing samples
 * every shadow map in one shader stage, and the stage holds sixteen textures.
 */
import { Color, Group, Object3D, SpotLight } from 'three/webgpu'
import { kelvinToColour } from '../../../stack/light'
import { FACE, FLOOR } from './layout'

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
  recipe: 'Modern exhibition lighting of the mechanism hall: two broad 7200 K sources under the north clerestory and four 3300 to 3400 K spots on the beams, two of them and both clerestory sources casting shadows. A lighting design choice; no light of 1517 is claimed.',
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
    colour: kelvinToColour(3300), intensity: 190, angle: .5, penumbra: .75, decay: 2, reach: 22, mapPx: 1024 },
  { name: 'spot-works', at: [-46.2, -46, underBeam(-46)], aim: [-49, -44.9, FLOOR + 1],
    colour: kelvinToColour(3300), intensity: 150, angle: .6, penumbra: .8, decay: 2, reach: 18, mapPx: 1024 },
  // Two narrow accents without a map of their own: the gates across the
  // aisle, and the mill and the lathe at the second stop's shoulder.
  { name: 'accent-gates', at: [-52.4, -50, underBeam(-50)], aim: [-55.5, -51.2, FLOOR + 1.3],
    colour: kelvinToColour(3400), intensity: 90, angle: .36, penumbra: .85, decay: 2, reach: 14, mapPx: 0 },
  { name: 'accent-mill', at: [-44, -46, underBeam(-46)], aim: [-45.4, -44, FLOOR + .7],
    colour: kelvinToColour(3400), intensity: 60, angle: .4, penumbra: .85, decay: 2, reach: 12, mapPx: 0 },
]

/** The hall's shadowed lights, standing from the first frame: a light that
 * joins the scene later relinks every lit surface in view. */
export function mountHallLight(host: Group): { update(inHall: boolean): void; dispose(): void } {
  const lights: SpotLight[] = [], targets: Object3D[] = []
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
    host.add(light, target)
    lights.push(light); targets.push(target)
  }
  let drawn = false
  return {
    // Outside the hall no machine is drawn and no pixel these reach is in
    // view, so their maps hold the last frame instead of redrawing it.
    update(inHall) {
      for (const light of lights) {
        if (!light.castShadow) continue
        light.shadow.autoUpdate = inHall
        if (!drawn) light.shadow.needsUpdate = true
      }
      drawn = true
    },
    dispose() {
      for (const light of lights) { light.removeFromParent(); light.dispose() }
      for (const target of targets) target.removeFromParent()
    },
  }
}
