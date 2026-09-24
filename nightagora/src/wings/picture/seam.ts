/* THE ONE SEAM between the museum's words and its picture. The chrome asks the
   picture to go somewhere and is answered on arrival, reads where it stands,
   takes the marks of a node and places anything that must ride the picture;
   a filmed source and the live engine both stand behind it, so the chrome
   never knows which one it is speaking to.

   A NODE is the film graph's own name for a place the visitor stands still
   (`forge/film/graph.mjs`): `stop:<walk id>` for a stop of the story,
   `view:<exhibit id>` for the eye in front of one work. */

export type PictureNode = string

/** The certificate's two authored families: the desktop's and the phone's. */
export type PictureFraming = 'wide' | 'upright'

/** The authored aspect of each framing, width over height. A master is drawn
    at it and covered onto any glass, so a covered picture shows the crop the
    live lens would draw there (`rail-projection.ts`). */
export const PICTURE_ASPECT: Readonly<Record<PictureFraming, number>> = { wide: 1280 / 720, upright: 390 / 844 }

export interface PictureBox { left: number; top: number; width: number; height: number }

/** One mark at rest, in picture-box pixels. */
export interface PictureMark {
  /** the exhibit it opens: the same in every language */
  id: string
  x: number
  y: number
  /** a gold mark walks the body there; a detail mark opens where he stands */
  walks: boolean
  label: string
  /** the word a walking mark carries beside its name */
  word: string
  colour: string
}

export interface PictureWords { en: string; de: string }

export type PictureState =
  | { kind: 'rest'; node: PictureNode }
  /** a clip plays; `share` is how much of it has played, 0 to 1 */
  | { kind: 'walk'; from: PictureNode; to: PictureNode; target: PictureNode; clip: string; share: number }
  /** a clip is asked for and its bytes are not here yet */
  | { kind: 'wait'; from: PictureNode; to: PictureNode; target: PictureNode; clip: string; share: number }
  /** the picture goes down to the museum's dark and comes up somewhere else */
  | { kind: 'dip'; from: PictureNode; to: PictureNode; title: PictureWords | null }

export type PictureEvent = 'state' | 'rest' | 'depart' | 'wait' | 'dip'

export interface PictureSource {
  readonly kind: 'film' | 'live'
  /** the picture's own element, which the chrome stands over */
  readonly element: HTMLElement
  /** Walk, open or dip to a node. Resolves with the node the picture rests at
      when the press is answered: the node asked for, or the node he already
      stands at when the work asked for opens where he stands. */
  go(node: PictureNode): Promise<PictureNode>
  /** a second press of the way on while a clip plays: the walk goes faster */
  hurry(): void
  /** the ways the chrome offers from here, the likeliest first: a source may
      fetch them while the visitor reads */
  ahead(nodes: readonly PictureNode[]): void
  /** a hand resting on a way: a source may fetch the start of it */
  lean(node: PictureNode): void
  /** how a press would be answered from here: walked, opened where he stands,
      reached by a dip, or not at all; a mark promises only what this says */
  reach(node: PictureNode): 'walk' | 'open' | 'dip' | 'none'
  state(): PictureState
  /** the marks of a node, in picture-box pixels, in one language */
  marks(node: PictureNode, lang: 'en' | 'de'): readonly PictureMark[]
  /** a point of the world on the picture as it stands now, or null behind the eye */
  project(point: readonly [number, number, number]): { x: number; y: number } | null
  box(): PictureBox
  framing(): PictureFraming
  on(event: PictureEvent, fn: (state: PictureState) => void): () => void
  /** resolves once the first picture stands */
  ready(): Promise<void>
  /** one frame of the page's own time */
  update(): void
  /** hide the picture while a live island draws the stage, and give it back */
  veil(hidden: boolean): void
  dispose(): void
}

/** WHERE A MASTER STANDS ON A BOX, covered and centred the way `object-fit:
    cover` stands it: its scale and the offset of its top left corner. */
export function coverOf(aspect: number, box: PictureBox): { scale: number; width: number; height: number; x: number; y: number } {
  // measured in the box's own pixels: the master is `aspect` wide per unit high
  const byWidth = box.width / aspect
  const height = Math.max(box.height, byWidth)
  const width = height * aspect
  return { scale: height, width, height, x: (box.width - width) / 2, y: (box.height - height) / 2 }
}

/** A point given in the master's own fractions, on the box. */
export function onBox(aspect: number, box: PictureBox, u: number, v: number): { x: number; y: number } {
  const c = coverOf(aspect, box)
  return { x: c.x + u * c.width, y: c.y + v * c.height }
}

/** A CAMERA AS THE FILM PRINTS IT: eye, rotation (Euler XYZ, radians) and the
    vertical lens in degrees, seven numbers, the rig's own print. */
export type CameraPrint = readonly [number, number, number, number, number, number, number]

export function parsePrint(print: string): CameraPrint | null {
  const n = print.split(',').map(Number)
  if (n.length !== 7 || n.some(v => !Number.isFinite(v))) return null
  return n as unknown as CameraPrint
}

/** A POINT OF THE WORLD ON THE MASTER, as the print's camera sees it, in the
    master's own fractions (0 to 1 across and down), or null behind the eye. */
export function projectPrint(print: CameraPrint, aspect: number, point: readonly [number, number, number]): { u: number; v: number } | null {
  const [ex, ey, ez, rx, ry, rz, fov] = print
  // three's Euler order XYZ: the camera's world rotation is Rx * Ry * Rz
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  const m00 = cy * cz, m01 = -cy * sz, m02 = sy
  const m10 = cx * sz + sx * sy * cz, m11 = cx * cz - sx * sy * sz, m12 = -sx * cy
  const m20 = sx * sz - cx * sy * cz, m21 = sx * cz + cx * sy * sz, m22 = cx * cy
  const dx = point[0] - ex, dy = point[1] - ey, dz = point[2] - ez
  // the transpose takes the world into the camera's own frame
  const vx = m00 * dx + m10 * dy + m20 * dz
  const vy = m01 * dx + m11 * dy + m21 * dz
  const vz = m02 * dx + m12 * dy + m22 * dz
  if (vz > -0.05) return null
  const f = 1 / Math.tan((fov * Math.PI) / 360)
  const ndcX = (f / aspect) * (vx / -vz), ndcY = f * (vy / -vz)
  return { u: (ndcX + 1) / 2, v: (1 - ndcY) / 2 }
}

/** The line the visitor is on, as the browser admits it: Save-Data and the
    slow lines fetch nothing ahead. */
export function lineIsLean(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (!c) return false
  if (c.saveData) return true
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g' || c.effectiveType === '3g'
}
