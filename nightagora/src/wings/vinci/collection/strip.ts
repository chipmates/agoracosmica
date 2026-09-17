/** THE HANG STRIP: the whole wall as one row, under the station's own card.
 *
 * A standpoint holds about ten of the picture room's twenty five works, and
 * the marks on the wall can only name what is in front of the eye. The strip
 * names the rest: every exhibit of the station a visitor is standing in, in
 * the order the wall hangs them, as one 44 px target each.
 *
 * It owns no words. A row's name is its station's, a button's is the work's
 * own title, and a colour is that object's certainty. A kind the spine
 * cannot open yet stands in the row disabled rather than absent, so the row
 * is the whole wall from the first day and lights up as the spine reaches it.
 */
/** THE STRIP NAMES A WORK WITH THE RECORD'S OWN WORDS. A Windsor sheet
 * carries no title of its own: its record opens with the author and then the
 * name the holder's catalogue gives the sheet, in both languages. */
export function vinciSheetTitle(honesty: string): string {
  const said = honesty.replace(/^Leonardo da Vinci,\s*/, '')
  const stop = said.indexOf('. ')
  return stop < 0 ? said : said.slice(0, stop)
}

export interface VinciStripEntry {
  id: string
  /** The exhibit's own name, already in the page's language. */
  title: string
  /** The certainty colour of this object, which is a fact, not a style. */
  colour: string
  /** The plate at rest, where the record carries one. */
  preview: string | null
  openable: boolean
}

export interface VinciHangStrip {
  element: HTMLElement
  /** The row stands only where a station holds more than one exhibit. */
  readonly count: number
  setEntries(entries: readonly VinciStripEntry[], label: string): void
  /** Which exhibit stands open, so the row says where the visitor is. */
  setOpen(id: string | null): void
  setHidden(hidden: boolean): void
  /** Dock the row under the station card on the wide stage. */
  dockUnder(top: number): void
  dispose(): void
}

export function createVinciHangStrip(options: {
  host: HTMLElement
  onOpen(id: string, button: HTMLButtonElement): void
}): VinciHangStrip {
  const { host, onOpen } = options
  const document = host.ownerDocument
  const row = document.createElement('ul')
  row.className = 'vinci-strip'
  row.setAttribute('role', 'list')
  row.hidden = true
  host.append(row)

  let entries: readonly VinciStripEntry[] = []
  let open: string | null = null, hidden = false, disposed = false
  const buttons: HTMLButtonElement[] = []

  /** THE ROW TAKES ONE TAB STOP. Inside it the arrows walk, which is what a
   * row of targets owes a keyboard: Home and End are its two ends. */
  function reachable(): HTMLButtonElement[] {
    return buttons.filter(button => !button.disabled)
  }
  function focusAt(index: number): void {
    const live = reachable()
    if (!live.length) return
    const at = Math.max(0, Math.min(live.length - 1, index))
    for (const button of live) button.tabIndex = button === live[at] ? 0 : -1
    live[at]!.focus({ preventScroll: true })
    live[at]!.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  row.addEventListener('keydown', event => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    const live = reachable(), at = live.indexOf(target)
    if (at < 0) return
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step) { event.preventDefault(); focusAt(at + step); return }
    if (event.key === 'Home') { event.preventDefault(); focusAt(0) }
    if (event.key === 'End') { event.preventDefault(); focusAt(live.length - 1) }
  })

  function paint(): void {
    row.textContent = ''
    buttons.length = 0
    for (const entry of entries) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'vinci-strip-item'
      button.dataset['exhibit'] = entry.id
      button.setAttribute('aria-label', entry.title)
      button.disabled = !entry.openable
      button.tabIndex = -1
      if (entry.preview) {
        const thumb = document.createElement('img')
        thumb.className = 'vinci-strip-thumb'
        // The plate the room already streams: the same file, from the cache,
        // and only the ones the row actually shows are decoded.
        thumb.loading = 'lazy'
        thumb.decoding = 'async'
        thumb.alt = ''
        thumb.src = entry.preview
        button.append(thumb)
      }
      const dot = document.createElement('span')
      dot.className = 'vinci-strip-dot'
      dot.style.setProperty('--certainty', entry.colour)
      button.append(dot)
      if (entry.openable) button.addEventListener('click', () => onOpen(entry.id, button))
      buttons.push(button)
      item.append(button)
      row.append(item)
    }
    const first = reachable()[0]
    if (first) first.tabIndex = 0
    mark()
  }

  function mark(): void {
    for (const button of buttons) {
      const current = button.dataset['exhibit'] === open && open !== null
      if (current) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
  }

  return {
    element: row,
    get count() { return entries.length },
    setEntries(next, label) {
      if (disposed) return
      const same = next.length === entries.length
        && next.every((entry, at) => entry.id === entries[at]!.id && entry.title === entries[at]!.title)
      entries = next
      row.setAttribute('aria-label', label)
      if (!same) paint()
      row.hidden = hidden || entries.length < 2
    },
    setOpen(id) {
      if (open === id) return
      open = id
      mark()
    },
    setHidden(next) {
      hidden = next
      row.hidden = hidden || entries.length < 2
    },
    dockUnder(top) {
      if (row.style.top !== `${top}px`) row.style.top = `${top}px`
    },
    dispose() {
      disposed = true
      row.remove()
      buttons.length = 0
    },
  }
}
