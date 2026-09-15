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
}

export interface VinciCloseLook {
  /** The exhibit standing open, or null. */
  readonly id: string | null
  open(exhibit: VinciCloseLookExhibit, invoker?: HTMLElement | null): void
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
  /** Walk the eye to the exhibit. False leaves the eye where it stands, which
   * is the calm tier's own body and reduced motion's. */
  onOpen(id: string): boolean
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
  const question = document.createElement('p')
  question.className = 'vinci-exhibit-question'
  card.append(body, controls, question)
  host.append(card)

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
    body.textContent = ''
    controls.textContent = ''
    onClose(id)
    const back = invoker
    invoker = null
    if (back?.isConnected) back.focus({ preventScroll: true })
  }
  view.addEventListener('popstate', () => {
    if (popping) { popping = false; return }
    if (!open) return
    marked = false
    dismiss()
  })

  function shut(pop = true): void {
    if (!open) return
    if (pop) unmark(); else marked = false
    dismiss()
  }

  return {
    get id() { return open },
    element: card,
    open(exhibit, from = null) {
      if (disposed) return
      if (open === exhibit.id) return
      if (open) { marked = false; dismiss() }
      open = exhibit.id
      invoker = from
      card.dataset['exhibit'] = exhibit.id
      card.setAttribute('aria-label', exhibit.title)
      body.textContent = ''
      body.append(exhibit.label)
      controls.replaceChildren(...exhibit.controls)
      question.textContent = exhibit.question
      card.hidden = false
      mark()
      // The eye walks where it can walk. On calm and on reduced motion it
      // stands still and the card is the whole close look.
      onOpen(exhibit.id)
      card.focus({ preventScroll: true })
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
      card.remove()
    },
  }
}
