/** ONE OWNER FOR THE CLOSE LOOK.
 *
 * Opening an exhibit is a move of the body, not a window over a frozen room:
 * the room stays live, the station rail stays live, one exhibit is open at a
 * time, and the way back is the way the visitor came. This module owns the
 * card, the reading history inside it, the one history entry a visitor's Back
 * dismisses, where the focus goes and where it returns to. It owns no words:
 * the card is the picture module's own label, mounted as it is.
 */
import { setRegister } from '../../frame'

export interface VinciCloseLookExhibit {
  id: string
  /** The exhibit's own name, already in the page's language. */
  title: string
  /** The museum's own label for this object, built by the caller. */
  label: HTMLElement
  /** The station's question, which is the door's while an exhibit is open. */
  question: string
  /** The controls under the label, in the order a hand meets them. */
  controls: readonly HTMLElement[]
  /** The two that walk this station's own row, at the card's two ends. */
  walk?: readonly HTMLElement[]
}

export interface VinciCloseLook {
  /** The exhibit standing open, or null. */
  readonly id: string | null
  /** `advance` puts the next exhibit in the card a visitor already has open:
   * the same card, the same history entry, the hand where it was left. */
  open(exhibit: VinciCloseLookExhibit, invoker?: HTMLElement | null, how?: 'enter' | 'advance'): void
  /** `pop` false leaves the browser's own entry where it is, for a caller
   * that is composing a still rather than dismissing on a visitor's behalf. */
  close(pop?: boolean): void
  /** One step back: the record first, then the exhibit. True when it took it. */
  escape(): boolean
  /** True while this reader owns the keys and the wheel over its own surface. */
  owns(target: Element | null): boolean
  element: HTMLElement
  dispose(): void
}

const HISTORY_MARK = 'vinciExhibit'

export function createVinciCloseLook(options: {
  host: HTMLElement
  /** Walk the eye to the exhibit. `from` is the exhibit the visitor is
   * walking on from, which is one motion and not a second opening. False
   * leaves the eye where it stands, which is the calm tier's own body and
   * reduced motion's. */
  onOpen(id: string, from: string | null): boolean
  /** Walk the eye back to the station it left. */
  onClose(id: string): void
  narrow(): boolean
}): VinciCloseLook {
  const { host, onOpen, onClose } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const card = document.createElement('section')
  card.className = 'vinci-exhibit-card'
  // The drawer a visitor opens carries an id, and the marks that open it name
  // it, so the walk can open it the way a hand does.
  card.id = 'vinci-exhibit-card'
  card.hidden = true
  card.tabIndex = -1
  card.setAttribute('role', 'group')
  setRegister(card, 'drawer')
  const body = document.createElement('div')
  body.className = 'vinci-exhibit-body'
  const controls = document.createElement('div')
  controls.className = 'vinci-exhibit-controls'
  const walk = document.createElement('div')
  walk.className = 'vinci-exhibit-walk'
  const question = document.createElement('p')
  question.className = 'vinci-exhibit-question'
  card.append(body, controls, walk, question)
  // A CARD THAT IS NOT OPEN IS NOT A DRAWER ON THE PAGE. It is mounted when
  // an exhibit stands and taken off when it closes, so nothing offers a
  // reading surface no control can open.

  let open: string | null = null, invoker: HTMLElement | null = null
  let marked = false, popping = false, disposed = false

  /** Our own entry, so a visitor's Back dismisses the exhibit and nothing
   * else. The address does not change: an exhibit is a place inside a
   * station, not a second station. */
  function mark(): void {
    const state = { ...(view.history.state as object | null ?? {}), [HISTORY_MARK]: open }
    view.history.pushState(state, '')
    marked = true
  }
  function unmark(): void {
    const state = view.history.state as Record<string, unknown> | null
    const ours = marked && state?.[HISTORY_MARK] !== undefined
    marked = false
    if (!ours) return
    popping = true
    view.history.back()
  }
  function dismiss(): void {
    if (!open) return
    const id = open
    open = null
    card.hidden = true
    card.remove()
    body.textContent = ''
    controls.textContent = ''
    walk.textContent = ''
    onClose(id)
    const back = invoker
    invoker = null
    if (back?.isConnected) back.focus({ preventScroll: true })
  }
  const leaving = new AbortController()
  view.addEventListener('popstate', () => {
    if (popping) { popping = false; return }
    if (!open) return
    marked = false
    dismiss()
  }, { signal: leaving.signal })

  function shut(pop = true): void {
    if (!open) return
    if (pop) unmark(); else marked = false
    dismiss()
  }

  return {
    get id() { return open },
    element: card,
    open(exhibit, from = null, how = 'enter') {
      if (disposed) return
      if (open === exhibit.id) return
      const previous = open
      const advancing = how === 'advance' && previous !== null
      // WALKING ON IS NOT A SECOND OPENING. The card stays mounted, the one
      // history entry stays where it is, and the hand keeps the control it
      // was on, so a visitor holding next walks the wall with one finger.
      const hand = advancing && card.contains(document.activeElement) ? document.activeElement : null
      const held = hand ? [...controls.children, ...walk.children].findIndex(child => child.contains(hand)) : -1
      if (previous && !advancing) { marked = false; dismiss() }
      open = exhibit.id
      if (!advancing) invoker = from
      card.dataset['exhibit'] = exhibit.id
      card.setAttribute('aria-label', exhibit.title)
      body.textContent = ''
      body.append(exhibit.label)
      body.scrollTop = 0
      controls.replaceChildren(...exhibit.controls)
      walk.replaceChildren(...exhibit.walk ?? [])
      question.textContent = exhibit.question
      card.hidden = false
      if (!card.isConnected) host.append(card)
      if (!advancing) mark()
      // The eye walks where it can walk. On calm and on reduced motion it
      // stands still and the card is the whole close look.
      onOpen(exhibit.id, advancing ? previous : null)
      const row = [...controls.children, ...walk.children]
      const back = held < 0 ? null : row[Math.min(held, row.length - 1)]
      if (back instanceof HTMLElement) back.focus({ preventScroll: true })
      else if (!advancing) card.focus({ preventScroll: true })
    },
    close: shut,
    escape() {
      if (!open) return false
      shut()
      return true
    },
    owns(target) {
      return open !== null && target !== null && card.contains(target)
    },
    dispose() {
      disposed = true
      open = null
      leaving.abort()
      card.remove()
    },
  }
}
