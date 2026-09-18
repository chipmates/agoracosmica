/** THE PAYLOAD CONTRACT. The vitrine is one window for every kind of work;
 * the payload is the kind. A picture, a machine, a leaf and a year each
 * implement this, and the window around them does not change. */

/** Who draws the stage while a payload stands.
 * `room`: the wing draws its own scene, as it stands.
 * `hold`: nothing draws; the canvas keeps its last frame and a DOM payload
 * stands over it.
 * `own`: the payload draws its own scene through the museum's one stack. */
export type VitrineSurface = 'room' | 'hold' | 'own'

/** A rectangle on the stage, in CSS pixels from its top left. */
export interface VitrineRect { left: number; top: number; width: number; height: number }

export interface VitrinePayloadHost {
  /** The viewport, over the canvas. The payload owns what is inside it. */
  readonly element: HTMLElement
  /** The row under the viewport. On the phone it is the thumb zone. */
  readonly controls: HTMLElement
  /** The payload's own text in the card: the steps, a leaf's lines. */
  readonly aside: HTMLElement
  /** One line under the viewport, read aloud as it changes. */
  readonly caption: HTMLElement
  readonly lang: 'en' | 'de'
  readonly narrow: boolean
  readonly reducedMotion: boolean
  /** The viewport's rectangle on the stage. */
  viewport(): VitrineRect
  /** The work's own rectangle on the frame the room stands at, where the
   * room shows the work; null where it does not. */
  work(): VitrineRect | null
  /** Who draws the stage from the next frame on. */
  surface(kind: VitrineSurface): void
  /** The viewport's accessible name, in the page's language. */
  describe(text: string): void
  /** Raise the card over the work, or put it back to its peek. Only the
   * narrow stage folds a card, so a wide window ignores it. */
  raise?(open: boolean): void
  /** True while a folded card stands at its peek, false while it is raised,
   * and undefined on a stage that folds no card. */
  peeked?(): boolean
  /** A payload that walks a list of works renames the card as it goes: the
   * card's accessible name, and the line at its head where the payload
   * carries one. The words are the caller's, as every word here is. */
  rename?(title: string, head?: string | null): void
}

export interface VitrinePayload {
  readonly kind: string
  /** THE WORK TAKES THE SCREEN. On the narrow stage the viewport runs from
   * under the brand line to the bar and the card folds to a peek over its
   * foot. A payload that does not ask for it is laid out as before. */
  readonly fill?: boolean
  /** What the grabber of a folded card is called while the card is down and
   * while it is up, in the page's language. The window falls back to its
   * caller's own word where a payload names none. */
  readonly raiseWords?: { up: string; down: string }
  mount(host: VitrinePayloadHost): void
  /** One frame of the payload's own time, in seconds. */
  update?(dt: number): void
  /** The viewport moved or the stage changed size. */
  layout?(): void
  /** True when the payload took the key. */
  key?(event: KeyboardEvent): boolean
  /** Leave the stage as it was found. The window resumes the room after it. */
  unmount(): void
}

export interface VitrineExhibit {
  id: string
  /** The exhibit's own name, in the page's language. */
  title: string
  /** The one thing to remember, in the page's language, or null where the
   * registers hold no line for this work. */
  line: string | null
  /** The module's own label sentences, already in the page's language. */
  card: readonly HTMLElement[]
  /** The card's words that stand after the payload's own text. */
  after?: readonly HTMLElement[]
  /** The controls under the card, in the order a hand meets them. */
  controls: readonly HTMLElement[]
  /** The two that walk the station's own row, at the card's two ends. */
  walk?: readonly HTMLElement[]
  payload: VitrinePayload | null
  /** The work's rectangle at the frame the room stands at. */
  work?: () => VitrineRect | null
  /** What the evidence does not say, and what the view invents or refuses
   * to show. Read behind the record's control; empty until a text seat
   * writes them. */
  limit?: string | null
  visualNote?: string | null
}
