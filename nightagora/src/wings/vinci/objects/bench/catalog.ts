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
import type { AssetClass } from '../../../../manifest'

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
  /** the manifest class of the body the label anchors. A body this museum
      built is GENERATED, which is the default; one lent by an open collection
      is that collection's class and the frame may not say otherwise. */
  anchorClass?: AssetClass
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

/* ─────────────────────────────── WHAT THE OPEN COLLECTION LENDS THE MUSEUM
 *
 * The entries above are bodies this museum BUILT: a recipe, a bake, a pack,
 * three tiers. A body out of the CC0 model library is none of those things.
 * It arrives whole, at real scale, with its own maps, and the only questions
 * left are the object ones: is the material true, is it made rather than
 * placed, does the craft hold, would a visitor stop. So the library's bodies
 * get ONE builder rather than one hand written entry each: everything that
 * differs between them is either measured (the bounds, off the manifest) or
 * one clause of museum voice, and everything else is the same sentence for
 * all of them, which is the honest shape of the claim.
 *
 * The stations are DERIVED from the measured bounds, not authored per body:
 * a jug and a bed are the same question asked at the size each one is.
 */

/** what the builder needs that the manifest cannot say in the museum's voice */
export interface LibraryBody {
  /** the manifest slug in the `models` scope */
  slug: string
  title: string
  /** the label's own clause: what the thing is, as a person would say it */
  what: string
  /** what a house of 1517 makes of it, in the museum's voice */
  standing: string
  /** the drawer's second paragraph: the period and the place, plainly */
  period: string
  /** the record's own word: plausible-1517, generic or modern */
  periodWord: string
  /** metres, off the manifest, measured from the delivered document */
  size: [number, number, number]
  /** the lowest corner of the body in the document's own frame, measured.
      A model is published around whatever origin its author left it at, so a
      station aimed at the frame's zero misses the body it is meant to read. */
  origin: [number, number, number]
  /** the line of the wing's wanted list this answers */
  answers: string
}

/** the museum's own hour, the one every object on this bench is lit at */
const HOUR = {
  label: '10 October 1517 · 15:19',
  azimuth: 232,
  elevation: 17,
  kelvin: 4400,
  lux: 340,
  sky: 'sky-afternoon-warm',
} as const

/* the bench's own formula for how far a bearing reaches through a body, so a
   station derived here stands where the bench will put it */
const reach = (bearing: readonly [number, number, number], size: readonly [number, number, number]): number => {
  const length = Math.hypot(bearing[0], bearing[1], bearing[2]) || 1
  return (
    (Math.abs(bearing[0]) * size[0] + Math.abs(bearing[1]) * size[1] + Math.abs(bearing[2]) * size[2]) /
    (2 * length)
  )
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const round = (value: number): number => Math.round(value * 100) / 100

/** the vertical field that holds `height` metres of a body from `metres` off */
const fieldFor = (height: number, metres: number): number =>
  round(clamp((Math.atan(height / 2 / metres) * 360) / Math.PI, 24, 64))

/** three quarters on, the sun across the face rather than behind the eye */
const OVER: [number, number, number] = [0.62, 0.26, 0.74]
/** flatter, for the two stations that ask about a surface */
const ACROSS: [number, number, number] = [0.54, 0.14, 0.83]

export function libraryObject(body: LibraryBody): BenchObject {
  const [w, h, d] = body.size
  const [ox, oy, oz] = body.origin
  const axis = { x: round(ox + w / 2), z: round(oz + d / 2) }
  const middle = oy + h * 0.46
  const span = Math.max(w, h, d)
  const diagonal = Math.hypot(w, h, d)

  /* the clear air each station leaves between the eye and the body, in the
     body's own scale: a jug read from a bed's distance is a speck */
  const off = round(clamp(diagonal * 0.95, 0.55, 7))
  /* THE CHROME STANDS ON THE VIEWPORT, so the whole-body stations carry their
     own field rather than the one the bench fits to the bounds: a field fitted
     to the last pixel of a body puts its feet under the station rail. The
     diagonal is the widest the body can project from any bearing, so a field
     that holds it holds the body whichever way it is turned. */
  const wholeMetres = round(reach(OVER, body.size) + off)
  const wholeField = fieldFor(diagonal * 1.02, wholeMetres)
  /* A PHONE IS NARROW, AND A VERTICAL FIELD IS NOT WHAT CROPS A BODY THERE.
     At this aspect the horizontal field is under half the vertical one, so a
     wide body has to be held by the width and the vertical field follows from
     it. The same station, restaged: never the same numbers. */
  const phoneWhole = round(Math.min(70, wholeField * 1.85))
  const phoneMetres = round(reach(OVER, body.size) + off * 1.12)
  const nearClear = clamp(span * 0.26, 0.1, 0.62)
  const nearMetres = round(reach(ACROSS, body.size) + nearClear)
  const nearField = fieldFor(Math.max(h * 0.46, 0.1), nearMetres)
  const detailClear = clamp(span * 0.1, 0.05, 0.3)
  const detailMetres = round(reach(ACROSS, body.size) + detailClear)
  const detailField = fieldFor(Math.max(h * 0.17, 0.04), detailMetres)

  const id = `library-${body.slug.toLowerCase().replace(/_/g, '-')}`
  const record = `models/${body.slug}`

  return {
    id,
    title: body.title,
    kicker: 'The open collection · On the bench',
    label: `${body.what} ${body.standing}`,
    /* a body the museum did not make and no document places may never carry
       a green dot: it stands for a kind of thing, which is the amber claim */
    certainty: 'inferred',
    certaintyWord: 'Library',
    anchorClass: 'CC0',
    hour: { ...HOUR },
    tiers: { hero: record, standard: record, calm: record },
    stations: {
      approach: {
        metres: wholeMetres,
        at: [axis.x, round(middle), axis.z],
        from: OVER,
        fov: wholeField,
        phoneFov: phoneWhole,
        title: 'The whole body',
        note: 'Three quarters on, at the distance this thing is met from, with the sun across it.',
      },
      near: {
        metres: nearMetres,
        at: [axis.x, round(oy + h * 0.62), axis.z],
        from: ACROSS,
        fov: nearField,
        phoneFov: round(Math.min(70, nearField * 1.3)),
        title: 'The surface',
        note: 'Close enough to ask what it is made of, and whether the maps still carry it there.',
      },
      detail: {
        metres: detailMetres,
        at: [axis.x, round(oy + h * 0.7), axis.z],
        from: ACROSS,
        fov: detailField,
        phoneFov: round(Math.min(70, detailField * 1.3)),
        exposure: 1.12,
        title: 'At arm’s length',
        note: 'The distance a hand would reach, where a seam or a smoothed edge has nowhere left to hide.',
      },
      phone: {
        metres: phoneMetres,
        fov: round(Math.min(70, fieldFor(diagonal * 1.2, phoneMetres) * 1.7)),
        // the eye looks below the middle, so the body stands in the upper two
        // thirds and the chrome of a phone has the lower one
        at: [axis.x, round(oy + h * 0.42), axis.z],
        from: OVER,
        title: body.title,
        note: 'The whole body upright, framed for a phone.',
      },
    },
    sources: [
      'This body was not built for the museum. It was published as an open model through Poly Haven, a collection that releases everything it makes into the public domain, and the library holds it as it was published: nothing remodelled, nothing repainted, nothing retouched. The name of the person who made it travels in the licence line below.',
      body.period,
      'A body out of the library may dress a room and it may never testify. What the museum says about this house stands on documents, and a thing lent by an open collection is not one. That is what the amber dot beside the line means here: the museum is showing you the kind of thing, not the thing itself.',
    ],
    record: [
      `Source: polyhaven.com/a/${body.slug}, taken as glTF at 2k through the collection's own interface and recorded in the store's models scope as ${record}. The licence line under this block is the source's own, verbatim.`,
      `Bounds ${w.toFixed(2)} by ${h.toFixed(2)} by ${d.toFixed(2)} m and the triangle count are measured off the delivered document, not taken from the catalogue's claim. Its lowest corner in its own frame is ${ox.toFixed(4)}, ${oy.toFixed(4)}, ${oz.toFixed(4)} m, which is what the loader snaps to the ground and what these stations are aimed by.`,
      'Tiers: one document serves all three. The geometry is identical and the calm tier halves the side of every map on the decode thread, so a tier here is a cheaper upload and never a cut.',
      `Period fit: ${body.periodWord}. That word is a judgement of the model against a Loire house of 1517, read off the frame, and it is the only field in this record that is not a measurement.`,
      `Answers: ${body.answers}, from the wing's wanted list of 2026-09-11.`,
      'Stations: derived from the measured bounds by one formula for every body on this bench, never authored per object.',
    ],
  }
}

/* The fourteen the sweep put forward, and the manifest's own numbers for each.
   Every one is CC0 through Poly Haven; the licence line with its author is on
   the frame, printed off the manifest by the bench itself. */
const LIBRARY: LibraryBody[] = [
  {
    slug: 'treasure_chest',
    title: 'The banded chest',
    what: 'A boarded chest under iron bands, with a domed lid and a hasp.',
    standing: 'A house of this century could have held one like it.',
    period: 'The form is old and wide: a boarded chest bound in iron is the storage of most of Europe for several centuries either side of this one. Nothing about this one is Italian, French or dated, and the museum claims none of those things for it.',
    periodWord: 'plausible-1517',
    size: [0.959, 0.619, 0.5229],
    origin: [-0.4795, -0.0017, -0.2608],
    answers: 'the chest for the chamber',
  },
  {
    slug: 'painted_wooden_bench',
    title: 'The painted bench',
    what: 'A painted settle with a back, scrolled ends and a shelf beneath the seat.',
    standing: 'The paint and the turning are of no one century.',
    period: 'A painted cottage settle, boards cut to shape and butted, with a shelf under the seat. The hall the wing wants furnished asks for a plain oak bench with no back and no arms, so this one answers the word and not the thing.',
    periodWord: 'generic',
    size: [1.1649, 0.8893, 0.4965],
    origin: [-0.5761, -0.0005, -0.2537],
    answers: 'the plain oak bench for the hall',
  },
  {
    slug: 'dining_chair_02',
    title: 'The buttoned chair',
    what: 'A dining chair, buttoned leather over a stained hardwood frame.',
    standing: 'The upholstery is later than this house, and the museum says so.',
    period: 'Buttoned leather on a machine cut frame is a nineteenth century pattern at the earliest and a restaurant chair at heart. The study the wing wants furnished asks for a turned or boarded chair with no upholstery at all.',
    periodWord: 'modern',
    size: [0.4336, 0.9734, 0.5764],
    origin: [-0.2168, 0.0013, -0.331],
    answers: 'the plain writing chair for the study',
  },
  {
    slug: 'wooden_stool_01',
    title: 'The turned stool',
    what: 'A round stool on four turned legs, braced by stretchers.',
    standing: 'A stool like this belongs to no one century.',
    period: 'A turned stool with a dished seat and stretchers between the legs. The form runs from long before this house to long after it, which is why the museum calls it timeless rather than period, and its size is right for a service room.',
    periodWord: 'generic',
    size: [0.4254, 0.4374, 0.4424],
    origin: [-0.2127, 0, -0.2212],
    answers: 'the three legged stool for the kitchen',
  },
  {
    slug: 'GothicBed_01',
    title: 'The carved bed',
    what: 'A bed with carved tracery at both ends, made up under a white cover.',
    standing: 'The carving quotes this century. The bed does not.',
    period: 'The tracery is a nineteenth century revival of a late gothic pattern, and the piece is made up with a sprung mattress and a duvet on steel rails. The chamber the wing wants asks for the opposite of this: a plain frame, conjectural and stated as such, with no hangings and no carving.',
    periodWord: 'modern',
    size: [1.4938, 1.5338, 2.04],
    origin: [-0.7113, 0, -1.0531],
    answers: 'the plain bed frame for the chamber',
  },
  {
    slug: 'ceramic_vase_04',
    title: 'The slipped jug',
    what: 'A thrown jug with one strap handle, white slip over a coarse body.',
    standing: 'A kitchen of this century could have held one like it.',
    period: 'Thrown, slipped and unpainted. There is no transfer print on it and no painted scene, which is what would have dated it. Its neck is drawn and round with no pouring lip pinched into it, so it carries water better than it pours.',
    periodWord: 'plausible-1517',
    size: [0.1811, 0.3419, 0.1811],
    origin: [-0.0906, 0.0005, -0.0906],
    answers: 'the earthenware jug for the kitchen and the hall',
  },
  {
    slug: 'book_encyclopedia_set_01',
    title: 'The row of volumes',
    what: 'Twenty volumes standing in a row, leather over boards, every spine lettered.',
    standing: 'The bindings are later than this house, and the museum says so.',
    period: 'The word on every spine is a modern one in a modern face, and the volume letters beside it are gilt on a nineteenth century case. The study wants folio volumes with nothing written on them at all, so this row reads from across a room and fails where a hand reaches.',
    periodWord: 'modern',
    size: [0.5513, 0.2374, 0.1631],
    origin: [-0.0193, 0, -0.0621],
    answers: 'the closed folio volumes for the study',
  },
  {
    slug: 'cross_pein_hammer',
    title: 'The cross pein hammer',
    what: 'A forged hammer with a cross pein and a shaped wooden handle.',
    standing: 'A bench of this century could have held one like it.',
    period: 'The cross pein is one of the oldest hammer heads in use and it is still the smith’s and the joiner’s. Nothing on this one is stamped, ground or branded, which is what would have dated it.',
    periodWord: 'plausible-1517',
    size: [0.0991, 0.3002, 0.0243],
    origin: [-0.0444, -0.1232, -0.0098],
    answers: 'the hammer for the workshop bench',
  },
  {
    slug: 'hand_plane_no4',
    title: 'The bench plane',
    what: 'A cast iron smoothing plane with a rosewood tote and a lever cap.',
    standing: 'The whole pattern is three centuries later than this house.',
    period: 'A cast body, a screw adjuster and a lever cap are a Victorian factory plane. The workshop wants a plane with a wooden stock and an iron blade held by a wedge, which is a different object and not a version of this one.',
    periodWord: 'modern',
    size: [0.3308, 0.1978, 0.0843],
    origin: [-0.1451, 0.0012, -0.0503],
    answers: 'the wooden hand plane for the workshop bench',
  },
  {
    slug: 'wicker_basket_01',
    title: 'The woven basket',
    what: 'A shallow rectangular basket, woven in willow rods over uprights.',
    standing: 'A basket like this belongs to no one century.',
    period: 'Willow woven over a frame is a pre industrial form that survived industry unchanged. The museum calls it timeless rather than period and uses it in a kitchen or a garden without claiming anything by it.',
    periodWord: 'plausible-1517',
    size: [0.3832, 0.1174, 0.295],
    origin: [-0.1919, -0.0009, -0.1479],
    answers: 'the wicker basket for the kitchen and the garden',
  },
  {
    slug: 'wooden_lantern_01',
    title: 'The hand lantern',
    what: 'A hand lantern in a pegged wooden frame, with an iron hood and a wire bail.',
    standing: 'A house of this century could have held one like it.',
    period: 'A framed lantern with a forged hood and a bail to carry it by. Its four panes read as dark panels and nothing is behind them, so it is a lantern put down and closed, never one that has been lit. The hour this wing stands at is the middle of the afternoon anyway.',
    periodWord: 'plausible-1517',
    size: [0.221, 0.5301, 0.2347],
    origin: [-0.1105, -0.0114, -0.1105],
    answers: 'the candle lantern for the court and the hall',
  },
  {
    slug: 'wine_barrel_01',
    title: 'The wine cask',
    what: 'A cask standing on its head, staved and hooped, with a bung in one stave.',
    standing: 'A cellar of this century held casks like it.',
    period: 'Staves, heads and driven hoops: a cask made this way in this century was made the same way three hundred years later. Its upper hoops are bright rolled steel, which is not, and a court of 1517 would want them dark. The cellars of this house are supporting space the visitor never enters, so a cask earns its place in the court instead.',
    periodWord: 'plausible-1517',
    size: [0.7419, 0.8713, 0.756],
    origin: [-0.3709, 0.0007, -0.371],
    answers: 'the barrel for the cellar and the court',
  },
  {
    slug: 'planter_pot_clay',
    title: 'The clay pot',
    what: 'A thrown clay pot with a rolled rim, unglazed.',
    standing: 'A garden of this century could have held one like it.',
    period: 'Thrown, unglazed and weathered, with lime bloom up one side. A maker’s mark is pressed into the band under its rim, which only a hand’s distance finds. The terrace of this house has no formal beds in the record, so a pot is the honest way to put a plant on it.',
    periodWord: 'plausible-1517',
    size: [0.266, 0.2219, 0.2635],
    origin: [-0.134, 0.0004, -0.1203],
    answers: 'the terracotta pot for the garden and the terrace',
  },
  {
    slug: 'quiver_tree_02',
    title: 'The quiver tree',
    what: 'A quiver tree, waist high, an aloe of the southern African deserts.',
    standing: 'It grows six thousand miles from this house.',
    period: 'This is the only whole tree body the open collection holds that a page can carry: every oak, pine and plane in it runs to millions of triangles and hundreds of megabytes. What is left is a desert aloe as tall as a person, and a park on the Loire is not a place it can stand.',
    periodWord: 'generic',
    size: [0.8716, 1.4689, 0.8808],
    origin: [-0.4839, -0.0493, -0.432],
    answers: 'the oak and the plane tree for the park',
  },
]

for (const body of LIBRARY) {
  const made = libraryObject(body)
  OBJECTS[made.id] = made
}

/** the slugs the library lent this bench, in the order they were put on it */
export const LIBRARY_IDS: string[] = LIBRARY.map(
  (body) => `library-${body.slug.toLowerCase().replace(/_/g, '-')}`
)
