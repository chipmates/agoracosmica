/* THE WORDS THE OBJECTS CARRY, drawn by the page over the picture.
   The scene cuts only what reads the same in every language: the years, the
   name, the painter. The life line's certainty words and cues and the grave's
   plaque, ledge and label are set here in the wing's world metres and
   projected point by point onto the picture, through the live camera or the
   film's printed one, so one film carries every language (RENDER-GRAPH §7).
   They are drawn at rest, and only at the stations whose picture holds them
   in clear view: a projection knows no wall, so the station is the proof of
   sight. */
import { Matrix4, Vector3 } from 'three/webgpu'
import { LINE_FLOOR_SECTIONS, lineLettering, lineSectionShift, type LinePiece } from './line/lettering'
import { graveDeathbedLettering, graveLettering, type GraveLetters } from './grave/lettering'
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
  const fromGrave = (letters: GraveLetters): PictureWordRun => ({ id: letters.id, stations: GRAVE_STATIONS,
    contours: contoursOf(letters.outline, grave.clone().multiply(letters.matrix)), finish: letters.finish })
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

/** One SVG over the picture and under every mark: a path per finish,
 * filled nonzero, so a stroke alphabet's overlapping strokes read as one
 * letter. `place` stands it in the host's order of layers. */
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
  const point: [number, number, number] = [0, 0, 0]
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
      let held = 0
      for (const run of pictureWords(language)) {
        if (!run.stations.includes(station)) continue
        held++
        const drawn: string[] = []
        let behind = false
        for (const contour of run.contours) {
          const parts: string[] = []
          for (let i = 0; i < contour.length; i += 3) {
            point[0] = contour[i]!; point[1] = contour[i + 1]!; point[2] = contour[i + 2]!
            const at = project(point)
            if (!at) { behind = true; break }
            parts.push(`${parts.length ? 'L' : 'M'}${at.x.toFixed(1)} ${at.y.toFixed(1)}`)
          }
          if (behind) break
          drawn.push(parts.join('') + 'Z')
        }
        // a run that reaches behind the eye is left out whole, never cut
        if (behind) continue
        const list = d.get(run.finish) ?? []
        list.push(drawn.join(''))
        d.set(run.finish, list)
      }
      for (const [finish, path] of paths) path.setAttribute('d', (d.get(finish) ?? []).join(''))
      if (!d.size) { hide(); return held === 0 }
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
