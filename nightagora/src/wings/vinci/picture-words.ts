/* THE WORDS THE OBJECTS CARRY, drawn by the page over the picture.
   The scene cuts only what reads the same in every language: the years, the
   name, the painter. The life line's certainty words and cues and the grave's
   plaque, ledge and label are set here in the wing's world metres and
   projected point by point onto the picture, through the live camera or the
   film's printed one, so one film carries every language (RENDER-GRAPH §7).
   They are drawn at rest, and only at the stations whose picture holds them
   in clear view: a projection knows no wall, so the station is the proof of
   sight, save where a run names the solids that stand before it at one of
   its station's views. */
import { Matrix4, Vector3 } from 'three/webgpu'
import { LINE_FLOOR_SECTIONS, lineLettering, lineSectionShift, type LinePiece } from './line/lettering'
import { graveDeathbedLettering, graveLettering, type GraveFace, type GraveLetters } from './grave/lettering'
import { GRAVE_AT, LINE_FLOOR_AT } from './collection/layout'

type Language = 'en' | 'de'
type Point = readonly [number, number, number]

/** How the letters take the light: the floor's and the stones' ink, or bronze. */
export type PictureWordFinish = 'ink' | 'bronze'

export interface PictureWordRun {
  id: string
  /** the stations whose picture carries this run */
  stations: readonly string[]
  /** closed contours in world metres, three numbers a point */
  contours: Float32Array[]
  finish: PictureWordFinish
  /** Faces of solids the whole run lies behind, in world metres, wound
   * counter-clockwise seen from outside: a face turned to the eye hides the
   * run where it covers it. */
  behind?: Float32Array[]
}

const LINE_STATIONS = LINE_FLOOR_SECTIONS.map(section => section.station)
const GRAVE_STATIONS = ['grave'] as const

function contoursOf(outline: { contours: [number, number][][] }, matrix: Matrix4): Float32Array[] {
  const v = new Vector3()
  return outline.contours.map(contour => {
    const out = new Float32Array(contour.length * 3)
    contour.forEach(([x, y], i) => {
      v.set(x, y, 0).applyMatrix4(matrix)
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z
    })
    return out
  })
}

/** a floor piece: its outline laid face up at `at`, stretched along the walk */
function floorMatrix(base: Matrix4, piece: LinePiece, southward = 0): Matrix4 {
  return base.clone()
    .multiply(new Matrix4().makeTranslation(piece.at[0], piece.at[1], piece.at[2] + southward))
    .multiply(new Matrix4().makeRotationX(-Math.PI / 2))
    .multiply(new Matrix4().makeScale(1, piece.stretch, 1))
}

function faceOf(face: GraveFace, matrix: Matrix4): Float32Array {
  const v = new Vector3(), out = new Float32Array(face.length * 3)
  face.forEach((p, i) => { v.set(p[0], p[1], p[2]).applyMatrix4(matrix); out.set([v.x, v.y, v.z], i * 3) })
  return out
}
/** Every point of the run on the inner side of the face's plane: only then
 * does the face, turned to an eye, stand between that eye and all it covers. */
function whollyBehind(contours: readonly Float32Array[], face: Float32Array): boolean {
  const a = new Vector3().fromArray(face, 0)
  const n = new Vector3().fromArray(face, 3).sub(a).cross(new Vector3().fromArray(face, 6).sub(a))
  const p = new Vector3()
  return contours.every(c => { for (let i = 0; i < c.length; i += 3) if (n.dot(p.fromArray(c, i).sub(a)) >= 0) return false; return true })
}

const cache = new Map<Language, PictureWordRun[]>()
/** Every run of words the wing's objects carry, in one language. */
export function pictureWords(language: Language): PictureWordRun[] {
  const had = cache.get(language)
  if (had) return had
  const runs: PictureWordRun[] = []
  const floor = new Matrix4().makeTranslation(...LINE_FLOOR_AT)
  for (const section of LINE_FLOOR_SECTIONS) {
    const base = floor.clone().multiply(new Matrix4().makeTranslation(0, 0, lineSectionShift(section.row)))
    for (let n = section.selected; n < section.selected + 4; n++) {
      const lettering = lineLettering(n, section.selected, language, false, section.lettering)
      for (const [kind, piece] of [['word', lettering.word], ['cue', lettering.cue]] as const) {
        if (!piece) continue
        const contours = contoursOf(piece.outline, floorMatrix(base, piece))
        // a row cuts each text twice, the second a little south: so is it drawn
        if (piece.bold) contours.push(...contoursOf(piece.outline, floorMatrix(base, piece, piece.bold)))
        runs.push({ id: `line/${lettering.studId}/${kind}`, stations: LINE_STATIONS, contours, finish: 'ink' })
      }
    }
  }
  const grave = new Matrix4().makeTranslation(...GRAVE_AT.position).multiply(new Matrix4().makeRotationY(GRAVE_AT.rotationY))
  const fromGrave = (letters: GraveLetters): PictureWordRun => {
    const contours = contoursOf(letters.outline, grave.clone().multiply(letters.matrix))
    const behind = (letters.behind ?? []).map(face => faceOf(face, grave)).filter(face => whollyBehind(contours, face))
    return { id: letters.id, stations: GRAVE_STATIONS, contours, finish: letters.finish, ...(behind.length ? { behind } : {}) }
  }
  for (const letters of [...graveLettering(language), ...graveDeathbedLettering(language)]) runs.push(fromGrave(letters))
  cache.set(language, runs)
  return runs
}

/** A world point on the host's own pixels, or null behind the eye. */
export type PictureProjector = (point: Point) => { x: number; y: number } | null

export interface PictureWordsLayer {
  /** Draw the runs the station holds, projected; `null` takes them down.
   * False when the station holds runs and not one of them could be projected:
   * the picture's camera is not known yet, and the caller asks again. */
  paint(station: string | null, language: Language, project: PictureProjector): boolean
  hide(): void
  dispose(): void
}

const SVG = 'http://www.w3.org/2000/svg'
/** the page may hold more than one layer: each names its masks apart */
let layers = 0

/** The projected contours as one path, or null when a point is behind the eye. */
function trace(contours: readonly Float32Array[], project: PictureProjector): string | null {
  const point: [number, number, number] = [0, 0, 0]
  let out = ''
  for (const contour of contours) {
    let part = ''
    for (let i = 0; i < contour.length; i += 3) {
      point[0] = contour[i]!; point[1] = contour[i + 1]!; point[2] = contour[i + 2]!
      const at = project(point)
      if (!at) return null
      part += `${part ? 'L' : 'M'}${at.x.toFixed(1)} ${at.y.toFixed(1)}`
    }
    out += part + 'Z'
  }
  return out
}

/** The faces turned to the eye, projected. Wound counter-clockwise seen from
 * outside, a face before the eye winds negative on the y-down pixels; a face
 * that reaches behind the eye is left out. */
function turned(faces: readonly Float32Array[], project: PictureProjector): string {
  let out = ''
  for (const face of faces) {
    const corners: { x: number; y: number }[] = []
    for (let i = 0; i < face.length; i += 3) {
      const at = project([face[i]!, face[i + 1]!, face[i + 2]!])
      if (!at) break
      corners.push(at)
    }
    if (corners.length * 3 !== face.length) continue
    let area = 0
    corners.forEach((a, i) => { const b = corners[(i + 1) % corners.length]!; area += a.x * b.y - b.x * a.y })
    if (area >= 0) continue
    out += corners.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z'
  }
  return out
}

/** One SVG over the picture and under every mark: a path per finish,
 * filled nonzero, so a stroke alphabet's overlapping strokes read as one
 * letter. A run with solids before it has a path of its own under a mask
 * that its faces turned to the eye cut away. `place` stands it in the host's
 * order of layers. */
export function createPictureWords(place: (layer: SVGSVGElement) => void): PictureWordsLayer {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('class', 'vinci-picture-words')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.visibility = 'hidden'
  svg.style.opacity = '0'
  const paths = new Map<PictureWordFinish, SVGPathElement>()
  for (const finish of ['ink', 'bronze'] as const) {
    const path = document.createElementNS(SVG, 'path')
    path.dataset['finish'] = finish
    path.setAttribute('fill-rule', 'nonzero')
    svg.append(path)
    paths.set(finish, path)
  }
  place(svg)
  const name = `vinci-picture-words-${++layers}`
  const screens = new Map<string, { path: SVGPathElement; faces: SVGPathElement }>()
  function screen(run: PictureWordRun): { path: SVGPathElement; faces: SVGPathElement } {
    const had = screens.get(run.id)
    if (had) return had
    const id = `${name}-${screens.size}`
    // the mask keeps its own box, the run's: the white beneath the faces only
    // has to cover that, and a run may stand off the picture
    const mask = document.createElementNS(SVG, 'mask')
    const whole = document.createElementNS(SVG, 'rect')
    for (const [k, v] of [['x', '-50000'], ['y', '-50000'], ['width', '100000'], ['height', '100000'], ['fill', 'white']] as const) whole.setAttribute(k, v)
    mask.id = id
    const faces = document.createElementNS(SVG, 'path')
    faces.setAttribute('fill', 'black')
    mask.append(whole, faces)
    const path = document.createElementNS(SVG, 'path')
    path.dataset['finish'] = run.finish
    path.setAttribute('fill-rule', 'nonzero')
    path.setAttribute('mask', `url(#${id})`)
    svg.append(mask, path)
    const made = { path, faces }
    screens.set(run.id, made)
    return made
  }
  // `data-shown` lets a rig ask whether the words stand, and show them alone.
  // They leave at once, as the picture starts to move, and come in softly.
  function hide(): void {
    svg.style.transition = 'none'
    svg.style.opacity = '0'
    svg.style.visibility = 'hidden'
    delete svg.dataset['shown']
  }
  return {
    paint(station, language, project) {
      if (!station) { hide(); return true }
      const d = new Map<PictureWordFinish, string[]>()
      const screened = new Set<string>()
      let held = 0, drawn = 0
      for (const run of pictureWords(language)) {
        if (!run.stations.includes(station)) continue
        held++
        const traced = trace(run.contours, project)
        // a run that reaches behind the eye is left out whole, never cut
        if (traced === null) continue
        drawn++
        if (run.behind) {
          const own = screen(run)
          own.path.setAttribute('d', traced)
          own.faces.setAttribute('d', turned(run.behind, project))
          screened.add(run.id)
          continue
        }
        const list = d.get(run.finish) ?? []
        list.push(traced)
        d.set(run.finish, list)
      }
      for (const [finish, path] of paths) path.setAttribute('d', (d.get(finish) ?? []).join(''))
      for (const [id, own] of screens) if (!screened.has(id)) own.path.setAttribute('d', '')
      if (!drawn) { hide(); return held === 0 }
      if (!('shown' in svg.dataset)) {
        svg.style.visibility = ''
        svg.dataset['shown'] = ''
        requestAnimationFrame(() => { if ('shown' in svg.dataset) { svg.style.transition = ''; svg.style.opacity = '1' } })
      }
      return true
    },
    hide,
    dispose() { svg.remove() },
  }
}
