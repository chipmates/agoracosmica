/* WHAT THE OBJECT BENCH CAN STAND, one entry per built body.
 *
 * An object here is a glTF out of the store, built by a script in the Blender
 * kit and packed at three tiers. The entry is what the bench needs that the
 * file cannot say: which manifest record holds which tier, the line the label
 * prints, the word for how certain its shape is, where the four stations
 * stand, and the paragraphs of the drawer. Everything measurable (the bounds,
 * the triangles, the texel density, the licence lines) comes off the manifest
 * and off the loaded body, never from this file.
 */

import type { TierName } from '../../../../stack'

export interface Station {
  /** how far the eye stands off the body, in metres */
  metres: number
  /** where it looks, in the body's own frame */
  at: [number, number, number]
  /** the bearing the eye stands on, as a direction in the body's own frame */
  from: [number, number, number]
  /** degrees; left out, the frame is fitted to the whole body */
  fov?: number
  /** the phone frames the same body upright */
  phoneFov?: number
  title: string
  /** the one line under the title on this station */
  note: string
  /** the museum's own exposure at this station, where it differs */
  exposure?: number
}

export interface BenchObject {
  id: string
  title: string
  kicker: string
  /** the museum's own line, in the museum's voice */
  label: string
  /** the certainty word beside the dot, and the claim the mark carries */
  certainty: 'documented' | 'inferred' | 'tradition'
  certaintyWord: string
  /** the hour the museum lights it at */
  hour: { label: string; azimuth: number; elevation: number; kelvin: number; lux: number; sky: string }
  /** one manifest id per tier */
  tiers: Record<TierName, string>
  /** what the drawer says, in plain paragraphs */
  sources: string[]
  /** the machine chain, opened on purpose: paths, hashes, arithmetic */
  record: string[]
  stations: Record<'approach' | 'near' | 'detail' | 'phone', Station>
}

export const OBJECT_STATES = ['approach', 'near', 'detail', 'phone'] as const
export type ObjectState = (typeof OBJECT_STATES)[number]

/* The dovecote's own frame, after the export turned it upright for the web:
   the doorway looks south, which is +z here, the west wall is -x, and the
   floor is at y = 0. The sun of the named hour stands to the south west, so
   the two lit faces are the two the approach shows. */
export const OBJECTS: Record<string, BenchObject> = {
  'revolving-crane-opus': {
    id: 'revolving-crane-opus',
    title: 'Revolving crane',
    kicker: 'Leonardo da Vinci · The machines',
    label:
      'Reconstructed from Manuscript B 49r with modern dimensions. A hand crank raises the load.',
    certainty: 'inferred',
    certaintyWord: 'Reconstructed',
    hour: {
      label: '10 October 1517 · 15:19',
      azimuth: 232,
      elevation: 17,
      kelvin: 4400,
      lux: 340,
      sky: 'sky-afternoon-warm',
    },
    tiers: {
      hero: 'vinci/revolving-crane-opus-hero',
      standard: 'vinci/revolving-crane-opus-standard',
      calm: 'vinci/revolving-crane-opus-calm',
    },
    stations: {
      approach: {
        metres: 4.2,
        at: [0.2, 1.26, 0.12],
        from: [0.62, 0.24, 0.75],
        exposure: 1.2,
        title: 'The whole machine',
        note: 'Three quarters on, from six metres, with the sun across the jib.',
      },
      near: {
        // the brace rakes over the drum from the front, so the winch is read
        // from the crank's own side, where nothing stands between
        metres: 1.55,
        at: [-0.13, 1.07, 0],
        from: [0.42, 0.16, 0.893],
        fov: 39,
        // the narrow stage restages: the same winch needs a wider field on a
        // phone or the ratchet leaves the frame
        phoneFov: 64,
        exposure: 1.16,
        title: 'The drum and the crank',
        note: 'A metre and a half off the drum, where the ratchet, the pawl and the crank can be read.',
      },
      detail: {
        metres: 0.48,
        at: [0.02, 2.56, 1.52],
        from: [-0.3, 0.35, 0.885],
        fov: 44,
        phoneFov: 56,
        exposure: 1.24,
        title: 'The rope through the jib',
        note: 'At arm\u2019s length on the tip: the rope over its sheave and down through the bored hole.',
      },
      phone: {
        metres: 3,
        // the eye looks below the middle, so the machine stands in the upper
        // two thirds and the chrome of a phone has the lower one
        at: [0, 0.86, 0.26],
        from: [0.5, 0.24, 0.83],
        exposure: 1.2,
        title: 'The crane',
        note: 'The whole machine upright, framed for a phone.',
      },
    },
    sources: [
      'A revolving crane, reconstructed from the drawing on folio 49 recto of Manuscript B. Leonardo drew the machine. He never wrote down how big it was, so every size here is a modern choice made to explain how it works, and the amber dot says so.',
      'It stands 2.7 metres high and sweeps a circle 3.7 metres across. A rope runs from the drum, up through the jib, over the rear pulley, along the jib and over the tip pulley, and down to the stone. Turning the crank raises the stone. The pawl beside the ratchet is parked clear, so the person at the crank has to keep holding it.',
      'Everything you see is geometry. The oak is squared with the arris a plane takes off, the rope holes are bored and their mouths are worn, the drum is turned and runs in bored bearings, the ratchet is twenty four forged teeth, the pulleys are wheels between cheeks on their pins, and the rope is a three strand hemp helix. The counterweight and the stone are dressed blocks, slung.',
      'What the model adds beyond those sizes is only what holds a wooden machine together: pegs, wedges, iron bands, the post the pawl hangs on. They are dressing, and none of them claims anything about the drawing.',
      'Colour, relief, roughness, metal and occlusion were measured off that geometry and written into texture sheets, one per moving body. No light is baked into any of them. The sun in this frame is the museum\u2019s own, at the hour named above, and the occlusion the bake measured reaches the ambient light alone.',
      'The surfaces are dressed from the museum\u2019s open licence material library: weathered oak, forged iron, laid hemp and aged lime for the stone.',
    ],
    record: [
      'Recipe: forge/blender/examples/revolving-crane-opus.py, run through forge/blender/build-object.sh (Blender 5.2, Cycles on the Metal GPU), packed with gltfpack -cc -tc -tq 8 -kn.',
      'Geometry read from client/src/wings/vinci/machines/data/revolving-crane.json: 30 declared parts, each built at its own metres and parent transform, every built part within 2 per cent of its declared box.',
      'Arithmetic from the page: drum radius 0.0800 m at 0.2500 rad/s gives a rope speed of 0.0200 m/s, so the load rises 0.2400 m in 12 s; a 20 kg load needs 15.7 Nm of ideal drum torque. Modern demonstration values, not measurements of a historical machine.',
      'Joint nodes, in the turntable\u2019s frame: turntable (0, 0.12, 0) about +Y; drum (0, 1.0000, 0), rear-pulley (0, 2.5000, 0) and tip-pulley (0, 2.5000, 1.5000) about +X; rope-fall (0, 2.5000, 1.5800) scales in Y; load (0, 0.8200, 1.5800) slides along +Y.',
      'Bake passes: albedo, roughness, normal from a high poly onto the low poly, ambient occlusion, curvature and a metal mask. Curvature lifts the albedo on a worn arris and drops it into a joint. The bake scene holds no lamp and no sky.',
      'Key: azimuth 232.0000\u00b0, elevation 17.0000\u00b0, 4400 K, 340 lx. Direction = (sin A cos h, sin h, \u2212cos A cos h).',
      'Tiers: one atlas per body at its own size, 4096\u00b2 for the frame and the jib down to 512\u00b2 for the rope, halved at standard and quartered at calm. The geometry is identical in all three: a tier is a second pack, never a cut.',
    ],
  },
  dovecote: {
    id: 'dovecote',
    title: 'The square dovecote',
    kicker: 'Clos Luce · The park',
    label:
      'The square dovecote. Brick with stone dressings, and a roof of small tiles. Its dimensions are proposed from photographs.',
    certainty: 'inferred',
    certaintyWord: 'Reconstructed',
    hour: {
      label: '10 October 1517 · 15:19',
      azimuth: 232,
      elevation: 17,
      kelvin: 4400,
      lux: 340,
      sky: 'sky-afternoon-warm',
    },
    tiers: {
      hero: 'vinci/dovecote-hero',
      standard: 'vinci/dovecote-standard',
      calm: 'vinci/dovecote-calm',
    },
    stations: {
      approach: {
        metres: 12,
        at: [0, 5.6, 0],
        from: [0.66, 0.15, 0.74],
        title: 'The whole body',
        note: 'Three quarters on, from twelve metres, with the sun across the face rather than behind the eye.',
      },
      near: {
        metres: 2,
        at: [-0.95, 2.7, 4.0],
        from: [0.46, 0.1, 0.88],
        fov: 52,
        phoneFov: 66,
        title: 'The brickwork',
        note: 'Two metres off the south wall, where the courses and the lime bed can be read.',
      },
      detail: {
        metres: 0.6,
        at: [1.06, 1.45, 4.0],
        from: [0.62, 0.06, 0.79],
        fov: 42,
        phoneFov: 56,
        exposure: 1.3,
        title: 'One joint',
        note: 'Where the brick courses meet the dressed jamb of the door, at sixty centimetres.',
      },
      phone: {
        metres: 12,
        // the eye looks below the middle, so the body stands in the upper two
        // thirds and the chrome of a phone has the lower one
        at: [0, 3.7, 0],
        from: [0.58, 0.19, 0.79],
        title: 'The dovecote',
        note: 'The whole building upright, framed for a phone.',
      },
    },
    sources: [
      'The building stands eight metres a side, seven and a half to the eaves, under a roof at forty eight degrees. All three are proposed readings of photographs of the building that still stands, not measurements taken on site, and the amber dot says so.',
      'It was modelled as one body and every piece of it is geometry: eighteen thousand bricks laid in Flemish bond on a recessed lime bed, three and a half thousand clay tiles in lapped courses, the quoins, jambs, lintels and the rat ledge in dressed limestone, an oak door on forged straps, and nine hundred nesting cells in courses on the four inner walls.',
      'Colour, relief, roughness, metal and occlusion were measured off that geometry and written into three texture sheets. No light is baked into any of them. The sun in this frame is the museum’s own, at the hour named above, and the occlusion the bake measured reaches the ambient light alone.',
      'The photographs behind the dimensions were used as measurement. Not one of them is projected onto the building.',
      'The surfaces are dressed from the museum’s open licence material library: old red brick, pale limestone, unglazed clay tile, oak and forged iron.',
    ],
    record: [
      'Recipe: forge/blender/examples/dovecote.py, run through forge/blender/build-object.sh (Blender 5.2, Cycles on the Metal GPU), packed with gltfpack -cc -tc -tq 8.',
      'Bake passes: albedo, roughness, normal from a high poly onto the low poly, ambient occlusion, curvature and a metal mask. Curvature lifts the albedo on a worn arris and drops it into a joint. The bake scene holds no lamp and no sky.',
      'Key: azimuth 232.0000°, elevation 17.0000°, 4400 K, 340 lx. Direction = (sin A cos h, sin h, −cos A cos h).',
      'Tiers: hero 4096² atlases, standard 2048², calm 1024², one pack each. The geometry is identical in all three: a tier is a second pack, never a cut.',
    ],
  },
}

export function objectFor(id: string): BenchObject | null {
  return OBJECTS[id] ?? null
}

export function objectIds(): string[] {
  return Object.keys(OBJECTS)
}
