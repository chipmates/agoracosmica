import type { EvidenceRecord, Language } from '../catalog'
import { wrapTitleSelect } from './title-select'
import { controlCopy } from './control-polish'

export interface EvidenceDialogOptions {
  host: HTMLElement
  source: HTMLElement
  page: HTMLElement
  closeButton: HTMLButtonElement
  partialRecords: readonly EvidenceRecord[]
  completeRecord(): EvidenceRecord
  language(): Language
  /** Existing locked-page renderer. Call controller.rendered(record) at its end. */
  render(record: EvidenceRecord): void
  changeLanguage(language: Language): void
  onClose?(): void
}

export interface EvidenceDialog {
  open(record: EvidenceRecord, opener?: HTMLElement): void
  select(record: EvidenceRecord): void
  /** Refresh only navigation and naming after article/language/plate updates. */
  rendered(record: EvidenceRecord): void
  /** Pass false when navigating away, so focus does not return to the old view. */
  close(restoreFocus?: boolean): void
  isOpen(): boolean
  dispose(): void
}

let nextDialogId = 0

/** Optional GENERATED navigation around the unchanged locked evidence article.
 * This helper never changes a record, machine, URL, joint, or playback state.
 * Native inert protects every background branch; focus containment supplements
 * the existing section's dialog semantics. No synthetic click/input is used.
 */
export function createEvidenceDialog(options: EvidenceDialogOptions): EvidenceDialog {
  const { host, source, page, closeButton, partialRecords } = options
  const doc = source.ownerDocument
  const uid = `vinci-evidence-${++nextDialogId}`
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const node = doc.createElement(tag)
    node.className = className
    return node
  }
  const toolbar = make('div', 'bench-evidence-tools')
  const top = make('div', 'bench-evidence-top')
  const title = make('p', 'bench-evidence-caption')
  const languages = make('div', 'bench-evidence-languages')
  const en = make('button', ''), de = make('button', '')
  en.type = de.type = 'button'
  en.textContent = 'EN'; de.textContent = 'DE'
  languages.append(en, de)
  top.append(title, languages, closeButton)
  const label = make('label', 'bench-evidence-picker')
  const labelText = make('span', 'bench-evidence-picker-label')
  const picker = make('select', 'bench-evidence-record')
  const pickerTitle = wrapTitleSelect(picker)
  label.append(labelText, pickerTitle.element)
  const back = make('button', 'bench-evidence-return')
  back.type = 'button'; back.hidden = true
  toolbar.append(top, label, back)
  source.prepend(toolbar)
  source.classList.add('bench-evidence-enhanced')
  const backdrop = make('div', 'bench-evidence-backdrop')
  backdrop.hidden = true
  backdrop.setAttribute('aria-hidden', 'true')
  host.insertBefore(backdrop, source)

  let opened = false, disposed = false, opener: HTMLElement | null = null
  let navigationKey = '', optionsKey = ''
  const priorInert = new Map<HTMLElement, string | null>()
  const text = (english: string, german: string) => options.language() === 'de' ? german : english

  function backgroundInert(): void {
    // Start at the dialog and protect siblings along its path to body. This
    // includes the inherited museum controls outside the bench host. Restore
    // each original attribute, including pre-existing inert branches, on close.
    let branch: HTMLElement = source
    while (branch !== doc.body) {
      const parent = branch.parentElement
      if (!parent) break
      for (const child of Array.from(parent.children)) {
        if (!(child instanceof HTMLElement) || child === branch || child === backdrop) continue
        if (!priorInert.has(child)) priorInert.set(child, child.getAttribute('inert'))
        child.inert = true
      }
      branch = parent
    }
  }

  function restoreBackground(): void {
    for (const [node, value] of priorInert) {
      if (value === null) node.removeAttribute('inert')
      else node.setAttribute('inert', value)
    }
    priorInert.clear()
  }

  function focusable(): HTMLElement[] {
    return Array.from(source.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'))
      .filter(node => node.tabIndex >= 0 && !node.closest('[inert]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden')
  }

  function focusHeading(): void {
    const heading = page.querySelector<HTMLElement>('h1')
    ;(heading ?? closeButton).focus({ preventScroll: true })
    source.scrollTop = 0
  }

  function rendered(record: EvidenceRecord): void {
    if (disposed) return
    const lang = options.language(), complete = options.completeRecord()
    source.lang = lang
    const heading = page.querySelector<HTMLElement>('h1')
    if (heading) {
      heading.id ||= `${uid}-title`
      heading.tabIndex = -1
      source.setAttribute('aria-labelledby', heading.id)
    }
    // Plate refreshes may replace the article without changing its record.
    // Name the new heading, but preserve the focused navigation controls.
    const nextKey = `${lang}:${complete.slug}:${record.slug}`
    if (nextKey === navigationKey) return
    navigationKey = nextKey
    title.textContent = text('Evidence', 'Quellen')
    labelText.textContent = text(`Record · ${partialRecords.length} partial and documentary records`, `Aufzeichnung · ${partialRecords.length} teilweise und dokumentarische Aufzeichnungen`)
    closeButton.setAttribute('aria-label', text('Close evidence', 'Quellen schließen'))
    languages.setAttribute('role', 'group')
    languages.setAttribute('aria-label', text('Evidence language', 'Sprache der Quellen'))
    en.setAttribute('aria-label', controlCopy[lang].english)
    de.setAttribute('aria-label', controlCopy[lang].german)
    en.setAttribute('aria-pressed', String(lang === 'en'))
    de.setAttribute('aria-pressed', String(lang === 'de'))
    const nextOptionsKey = `${lang}:${complete.slug}`
    if (nextOptionsKey !== optionsKey) {
      optionsKey = nextOptionsKey
      picker.replaceChildren()
      const current = doc.createElement('option')
      current.value = complete.slug; current.textContent = complete.title[lang]
      picker.append(current)
      const group = doc.createElement('optgroup')
      group.label = text('Partial and documentary records', 'Teilweise und dokumentarische Aufzeichnungen')
      for (const entry of partialRecords) {
        const option = doc.createElement('option')
        option.value = entry.slug; option.textContent = entry.title[lang]
        group.append(option)
      }
      picker.append(group)
    }
    picker.value = record.slug
    pickerTitle.refresh()
    back.hidden = record.slug === complete.slug
    back.textContent = text(`← Back to ${complete.title[lang]}`, `← Zurück zu ${complete.title[lang]}`)
  }

  function select(record: EvidenceRecord, moveFocus = true): void {
    if (disposed || !opened) return
    options.render(record)
    // Calling rendered here also supports renderers without the optional
    // refresh hook. The hook is needed for later language/plate-only updates.
    rendered(record)
    if (moveFocus) focusHeading()
    else source.scrollTop = 0
  }

  function close(restoreFocus = true): void {
    if (!opened) return
    opened = false
    source.hidden = true
    backdrop.hidden = true
    restoreBackground()
    if (restoreFocus && opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true })
    opener = null
    options.onClose?.()
  }

  function keydown(event: KeyboardEvent): void {
    if (!opened) return
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close()
    } else if (event.key === 'Tab') {
      const targets = focusable(), first = targets[0], last = targets[targets.length - 1]
      if (!first || !last) {
        event.preventDefault(); closeButton.focus()
      } else if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault(); first.focus()
      }
      // One owner of Tab containment; avoid the old window-level trap.
      event.stopPropagation()
    }
  }

  function focusin(event: FocusEvent): void {
    if (opened && event.target instanceof Node && !source.contains(event.target)) closeButton.focus({ preventScroll: true })
  }

  const choose = () => {
    const complete = options.completeRecord()
    const record = picker.value === complete.slug ? complete : partialRecords.find(entry => entry.slug === picker.value)
    // Native arrow-key selection can emit change before the visitor has
    // finished choosing. Keep the same picker focused and update its article;
    // explicit open/return/article buttons still focus the new heading.
    if (record) select(record, false)
  }
  const goBack = () => select(options.completeRecord())
  const useEnglish = () => options.changeLanguage('en')
  const useGerman = () => options.changeLanguage('de')
  const dismiss = () => close()
  picker.addEventListener('change', choose)
  back.addEventListener('click', goBack)
  en.addEventListener('click', useEnglish)
  de.addEventListener('click', useGerman)
  closeButton.addEventListener('click', dismiss)
  source.addEventListener('keydown', keydown)
  doc.addEventListener('focusin', focusin)

  return {
    open(record, from) {
      if (disposed) return
      if (!opened) opener = from ?? (doc.activeElement instanceof HTMLElement ? doc.activeElement : null)
      opened = true
      source.hidden = false
      backdrop.hidden = false
      backgroundInert()
      select(record)
    },
    select,
    rendered,
    close,
    isOpen: () => opened,
    dispose() {
      if (disposed) return
      close(false); disposed = true
      pickerTitle.dispose()
      picker.removeEventListener('change', choose)
      back.removeEventListener('click', goBack)
      en.removeEventListener('click', useEnglish)
      de.removeEventListener('click', useGerman)
      closeButton.removeEventListener('click', dismiss)
      source.removeEventListener('keydown', keydown)
      doc.removeEventListener('focusin', focusin)
      source.prepend(closeButton)
      toolbar.remove(); backdrop.remove()
      source.classList.remove('bench-evidence-enhanced')
    },
  }
}
